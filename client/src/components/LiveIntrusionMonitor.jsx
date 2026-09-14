import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AlertTriangle, Camera, RefreshCcw, ShieldCheck, Square, Volume2, VolumeX } from "lucide-react";
import {
  createInferenceGate,
  evaluateIntrusionFrame,
  INTRUSION_RULE_CONFIG,
  shouldPlayIntrusionAlert,
  stopMediaTracks,
} from "../intrusionDetection.js";
import { appendBoundedEvent, CAMERA_SOURCE, canCaptureSnapshot, createSnapshotEvent, snapshotPreviewAlt, validateHomeCameraUrl } from "../intrusionCamera.js";
import { useLanguage } from "../contexts/LanguageContext.jsx";
import { loadCocoSsdModel } from "../cocoSsdRuntime.js";

function formatClass(value) {
  return String(value || "object").replaceAll("_", " ");
}

function statusCopy(state, t) {
  if (state === "loading-model") return { title: t("Loading intrusion detection model…"), detail: t("Preparing a local COCO-SSD model in this browser.") };
  if (state === "requesting-camera") return { title: t("Starting camera…"), detail: t("Allow camera access to begin on-device monitoring.") };
  if (state === "requesting-home") return { title: t("Connecting home camera…"), detail: t("Waiting for a browser-compatible video stream.") };
  if (state === "camera-denied") return { title: t("Camera access was denied. You can use image upload or configure another camera source."), detail: t("No webcam frame was sent to Krishak.") };
  if (state === "camera-unavailable") return { title: t("Camera unavailable."), detail: t("You can continue with the webcam or use the one-time image upload workflow.") };
  if (state === "home-unavailable") return { title: t("Home camera unavailable. You can continue with the webcam."), detail: t("Unable to open this camera stream. Please verify the camera URL or use the webcam.") };
  if (state === "rtsp-blocked") return { title: t("This camera requires a compatible stream or gateway for browser use."), detail: t("Direct RTSP playback is not supported by this browser monitor.") };
  if (state === "model-error") return { title: t("Intrusion detection model could not be loaded. Please try again."), detail: t("No camera monitoring is active.") };
  if (state === "detection-error") return { title: t("Live detection paused. Please retry the camera."), detail: t("No new event was created.") };
  if (state === "stopped") return { title: t("Camera is off and no inference is running."), detail: t("Start a camera source to begin a new local monitoring session.") };
  return { title: t("No camera source active."), detail: t("Choose a camera source to begin local object monitoring.") };
}

function playLocalAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => context.close().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function captureLocalSnapshot(video, canvas) {
  if (!video?.videoWidth || !video?.videoHeight || !canvas) return null;
  try {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export function LiveIntrusionMonitor() {
  const { t } = useLanguage();
  const webcamRef = useRef(null);
  const homeVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const snapshotCanvasRef = useRef(null);
  const modelRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastInferenceAtRef = useRef(0);
  const lastAlertAtRef = useRef(0);
  const lastCaptureAtRef = useRef(0);
  const ruleRef = useRef({ status: "no_intrusion", stableClass: null, stableFrames: 0 });
  const inferenceGateRef = useRef(createInferenceGate());
  const monitoringRef = useRef(false);
  const mutedRef = useRef(false);
  const [cameraSource, setCameraSource] = useState(CAMERA_SOURCE.webcam);
  const [homeUrl, setHomeUrl] = useState("");
  const [homeRequested, setHomeRequested] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [monitorState, setMonitorState] = useState("initial");
  const [signal, setSignal] = useState({ status: "no_intrusion", candidate: null, updatedAt: null });
  const [detections, setDetections] = useState([]);
  const [muted, setMuted] = useState(false);
  const [recentEvents, setRecentEvents] = useState([]);
  const [audioNote, setAudioNote] = useState("");
  const [homeMessage, setHomeMessage] = useState("");

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const clearOverlay = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.("2d");
    if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const releaseResources = () => {
    monitoringRef.current = false;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    inferenceGateRef.current.finish();
    stopMediaTracks(streamRef.current);
    streamRef.current = null;
    try { modelRef.current?.dispose?.(); } catch { /* Optional model disposal is best effort. */ }
    modelRef.current = null;
    clearOverlay();
  };

  useEffect(() => () => releaseResources(), []);

  const drawOverlay = (video, nextDetections, frameState) => {
    const canvas = canvasRef.current;
    if (!canvas || !video?.videoWidth || !video?.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = Math.max(2, Math.round(canvas.width / 260));
    context.font = `${Math.max(13, Math.round(canvas.width / 44))}px DM Sans, sans-serif`;
    nextDetections.forEach((detection) => {
      const [x, y, width, height] = detection.bbox;
      const active = frameState.status === "confirmed" && frameState.candidate?.class === detection.class && detection.intrusionRelevant;
      const color = active ? "#ff4358" : detection.intrusionRelevant ? "#e7a72f" : "#75a7cf";
      const label = `${formatClass(detection.class)} ${Math.round(detection.score * 100)}%`;
      context.strokeStyle = color;
      context.fillStyle = color;
      context.strokeRect(x, y, width, height);
      const labelWidth = Math.min(canvas.width - x, context.measureText(label).width + 14);
      context.fillRect(x, Math.max(0, y - 24), labelWidth, 24);
      context.fillStyle = "#0d1824";
      context.fillText(label, x + 7, Math.max(17, y - 7));
    });
  };

  const getActiveVideo = () => cameraSource === CAMERA_SOURCE.home ? homeVideoRef.current : webcamRef.current?.video;

  const runInferenceLoop = () => {
    const loop = async (timestamp) => {
      if (!monitoringRef.current) return;
      const video = getActiveVideo();
      const model = modelRef.current;
      if (!video || !model || video.readyState < 2 || timestamp - lastInferenceAtRef.current < INTRUSION_RULE_CONFIG.inferenceIntervalMs || !inferenceGateRef.current.tryBegin()) {
        rafRef.current = window.requestAnimationFrame(loop);
        return;
      }
      lastInferenceAtRef.current = timestamp;
      try {
        const predictions = await model.detect(video, 12, INTRUSION_RULE_CONFIG.detectionThreshold);
        if (!monitoringRef.current) return;
        const nextRule = evaluateIntrusionFrame(ruleRef.current, predictions, Date.now());
        const becameConfirmed = nextRule.status === "confirmed" && ruleRef.current.status !== "confirmed";
        ruleRef.current = nextRule;
        setSignal(nextRule);
        setDetections(nextRule.detections);
        drawOverlay(video, nextRule.detections, nextRule);

        if (becameConfirmed && canCaptureSnapshot({ lastCapturedAt: lastCaptureAtRef.current, now: nextRule.updatedAt, cooldownMs: INTRUSION_RULE_CONFIG.alertCooldownMs })) {
          const event = createSnapshotEvent(nextRule, {
            source: cameraSource,
            snapshot: captureLocalSnapshot(video, snapshotCanvasRef.current),
            capturedAt: nextRule.updatedAt,
          });
          if (event) {
            lastCaptureAtRef.current = nextRule.updatedAt;
            setRecentEvents((items) => appendBoundedEvent(items, event, INTRUSION_RULE_CONFIG.maxRecentEvents));
          }
        }
        if (shouldPlayIntrusionAlert({ muted: mutedRef.current, lastAlertAt: lastAlertAtRef.current, now: nextRule.updatedAt, status: nextRule.status })) {
          lastAlertAtRef.current = nextRule.updatedAt;
          if (!playLocalAlertTone()) setAudioNote(t("Audio alert could not play in this browser. Visual monitoring remains active."));
          else setAudioNote("");
        }
      } catch {
        if (monitoringRef.current) {
          releaseResources();
          setCameraRequested(false);
          setHomeRequested(false);
          setMonitorState("detection-error");
        }
      } finally {
        inferenceGateRef.current.finish();
        if (monitoringRef.current) rafRef.current = window.requestAnimationFrame(loop);
      }
    };
    rafRef.current = window.requestAnimationFrame(loop);
  };

  const resetSession = () => {
    releaseResources();
    setCameraRequested(false);
    setHomeRequested(false);
    setDetections([]);
    setRecentEvents([]);
    setAudioNote("");
    lastCaptureAtRef.current = 0;
    ruleRef.current = { status: "no_intrusion", stableClass: null, stableFrames: 0 };
    setSignal(ruleRef.current);
  };

  const startModel = async () => {
    setMonitorState("loading-model");
    try {
      modelRef.current = await loadCocoSsdModel();
      return true;
    } catch {
      releaseResources();
      setMonitorState("model-error");
      return false;
    }
  };

  const startWebcam = async () => {
    resetSession();
    if (!navigator.mediaDevices?.getUserMedia) {
      setMonitorState("camera-unavailable");
      return;
    }
    if (!await startModel()) return;
    setMonitorState("requesting-camera");
    setCameraRequested(true);
  };

  const startHomeCamera = async () => {
    const validation = validateHomeCameraUrl(homeUrl);
    setHomeMessage("");
    if (!validation.ok) {
      setMonitorState(validation.code === "rtsp" ? "rtsp-blocked" : "home-unavailable");
      setHomeMessage(validation.code === "rtsp" ? t("This camera requires a compatible stream or gateway for browser use.") : t("Unable to open this camera stream. Please verify the camera URL or use the webcam."));
      return;
    }
    resetSession();
    if (!await startModel()) return;
    setMonitorState("requesting-home");
    setHomeUrl(validation.url);
    setHomeRequested(true);
  };

  const onCameraReady = (stream) => {
    if (monitoringRef.current) return;
    streamRef.current = stream;
    monitoringRef.current = true;
    setMonitorState("monitoring");
    runInferenceLoop();
  };

  const onCameraError = (error) => {
    releaseResources();
    setCameraRequested(false);
    const name = String(error?.name || "");
    setMonitorState(name === "NotAllowedError" || name === "PermissionDeniedError" ? "camera-denied" : "camera-unavailable");
  };

  const onHomeCanPlay = () => {
    if (monitoringRef.current) return;
    monitoringRef.current = true;
    setMonitorState("monitoring");
    setHomeMessage("");
    runInferenceLoop();
  };

  const onHomeError = () => {
    releaseResources();
    setHomeRequested(false);
    setMonitorState("home-unavailable");
    setHomeMessage(t("Unable to open this camera stream. Please verify the camera URL or use the webcam."));
  };

  const stopCamera = () => {
    resetSession();
    setMonitorState("stopped");
  };

  const changeSource = (source) => {
    resetSession();
    setCameraSource(source);
    setMonitorState("initial");
    setHomeMessage("");
  };

  const stateText = statusCopy(monitorState, t);
  const alertActive = signal.status === "confirmed";
  const cameraActive = monitorState === "monitoring";
  const sourceLabel = cameraSource === CAMERA_SOURCE.home ? t("Home / IP Camera") : t("Laptop / Webcam");

  return (
    <section className="intrusion-monitor" aria-label={t("Live local camera monitor")}>
      <div className="intrusion-monitor__head">
        <div><p className="section-kicker">01 / {t("LIVE CAMERA")}</p><h2>{t("Monitor your farm for potential animal/person intrusion.")}</h2><p>{t("Use your laptop webcam for the demo, or connect a compatible home/IP camera for farm monitoring.")}</p></div>
        <button className="button button--location" type="button" onClick={() => setMuted((value) => !value)} aria-pressed={muted}>{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {t("Audio alert")}: {muted ? t("OFF") : t("ON")}</button>
      </div>

      <div className="intrusion-monitor__source" role="group" aria-label={t("Camera Source")}>
        <span className="section-kicker">{t("Camera Source")}</span>
        <button type="button" className={`source-toggle ${cameraSource === CAMERA_SOURCE.webcam ? "source-toggle--active" : ""}`} aria-pressed={cameraSource === CAMERA_SOURCE.webcam} onClick={() => changeSource(CAMERA_SOURCE.webcam)}>{t("Laptop / Webcam")}</button>
        <button type="button" className={`source-toggle ${cameraSource === CAMERA_SOURCE.home ? "source-toggle--active" : ""}`} aria-pressed={cameraSource === CAMERA_SOURCE.home} onClick={() => changeSource(CAMERA_SOURCE.home)}>{t("Home / IP Camera")}</button>
      </div>

      {cameraSource === CAMERA_SOURCE.home && <div className="intrusion-monitor__home-config"><label htmlFor="home-camera-url">{t("Camera Stream URL")}</label><div><input id="home-camera-url" type="url" value={homeUrl} onChange={(event) => { setHomeUrl(event.target.value); setHomeMessage(""); }} placeholder="https://camera.example/stream.m3u8" autoComplete="off"/><button className="button button--leaf" type="button" onClick={startHomeCamera} disabled={monitorState === "loading-model" || monitorState === "requesting-home"}>{t("Connect Home Camera")}</button></div><p>{t("Only browser-compatible HTTP(S) video streams can be used here. RTSP needs a compatible gateway.")}</p></div>}

      <div className={`intrusion-monitor__stage ${alertActive ? "intrusion-monitor__stage--alert" : ""}`}>
        {cameraRequested && <><Webcam ref={webcamRef} audio={false} muted playsInline videoConstraints={{ facingMode: "environment" }} onUserMedia={onCameraReady} onUserMediaError={onCameraError} className="intrusion-monitor__video"/><canvas ref={canvasRef} className="intrusion-monitor__canvas" aria-hidden="true"/></>}
        {homeRequested && <><video ref={homeVideoRef} src={homeUrl} crossOrigin="anonymous" autoPlay muted playsInline onCanPlay={onHomeCanPlay} onError={onHomeError} className="intrusion-monitor__video"/><canvas ref={canvasRef} className="intrusion-monitor__canvas" aria-hidden="true"/></>}
        {!cameraRequested && !homeRequested && <div className="intrusion-monitor__placeholder"><Camera size={30}/><strong>{stateText.title}</strong><p>{stateText.detail}</p></div>}
      </div>
      <canvas ref={snapshotCanvasRef} className="intrusion-monitor__snapshot-canvas" aria-hidden="true"/>

      <div className={`intrusion-monitor__status-line ${cameraActive ? "intrusion-monitor__status-line--active" : ""}`} aria-live="polite"><span className="intrusion-monitor__status-dot" aria-hidden="true"/>{cameraActive ? (cameraSource === CAMERA_SOURCE.home ? t("Home camera connected") : t("Camera active")) : t("No camera source active.")}</div>
      <div className={`intrusion-monitor__signal intrusion-monitor__signal--${signal.status}`} aria-live="polite">
        {alertActive ? <AlertTriangle size={20}/> : <ShieldCheck size={20}/>}<div>{signal.status === "confirmed" ? <><strong>{t("Potential intrusion detected")}</strong><p>{formatClass(signal.candidate?.class)} — {Math.round((signal.candidate?.score || 0) * 100)}% · {t("Snapshot captured")} · {new Date(signal.updatedAt).toLocaleTimeString()}</p></> : signal.status === "candidate" ? <><strong>{t("Potential intrusion being checked")}: {formatClass(signal.candidate?.class)}</strong><p>{t("Checking three consecutive frames before raising a potential-intrusion alert.")}</p></> : signal.status === "cleared" ? <><strong>{t("Potential intrusion cleared")}</strong><p>{t("No stable intrusion-relevant object remains in the current frame.")}</p></> : <><strong>{t("No potential intrusion detected")}</strong><p>{cameraActive ? t("Monitoring supported living-object classes locally.") : t("Start a camera source to begin local monitoring.")}</p></>}</div>
      </div>

      <div className="intrusion-monitor__actions">
        {!cameraActive ? <button className="button button--leaf" type="button" onClick={cameraSource === CAMERA_SOURCE.home ? startHomeCamera : startWebcam} disabled={monitorState === "loading-model" || monitorState === "requesting-camera" || monitorState === "requesting-home"}><Camera size={16}/>{monitorState === "model-error" || monitorState === "detection-error" ? t("Retry") : cameraSource === CAMERA_SOURCE.home ? t("Connect Home Camera") : t("Start Camera")}</button> : <button className="button button--ochre" type="button" onClick={stopCamera}><Square size={15}/>{t("Stop Camera")}</button>}
        {(monitorState === "camera-denied" || monitorState === "camera-unavailable" || monitorState === "home-unavailable" || monitorState === "rtsp-blocked" || monitorState === "model-error" || monitorState === "detection-error" || monitorState === "stopped") && <button className="text-button" type="button" onClick={cameraSource === CAMERA_SOURCE.home ? startHomeCamera : startWebcam}><RefreshCcw size={14}/>{t("Retry camera")}</button>}
        <span>{t("Detection threshold")}: {Math.round(INTRUSION_RULE_CONFIG.detectionThreshold * 100)}% · {INTRUSION_RULE_CONFIG.stableFrameCount} {t("stable frames required")}</span>
      </div>
      {homeMessage && <p className="intrusion-monitor__home-message" role="alert">{homeMessage}</p>}
      {audioNote && <p className="intrusion-monitor__audio-note" role="status">{audioNote}</p>}

      {detections.length > 0 && <div className="intrusion-monitor__detections"><p className="section-kicker">{t("CURRENT QUALIFIED OBJECTS")}</p>{detections.map((detection, index) => <span key={`${detection.class}-${index}`}>{formatClass(detection.class)} · {Math.round(detection.score * 100)}%{detection.intrusionRelevant ? ` · ${t("monitored")}` : ` · ${t("not an intrusion class")}`}</span>)}</div>}
      <div className="intrusion-monitor__events"><p className="section-kicker">{t("RECENT INTRUSIONS")}</p>{recentEvents.length === 0 ? <p>{t("No confirmed potential-intrusion event in this browser session.")}</p> : <ol>{recentEvents.map((event) => <li key={event.id}>{event.snapshot ? <img src={event.snapshot} alt={snapshotPreviewAlt(event)} /> : <span className="intrusion-monitor__no-snapshot">{t("Snapshot unavailable")}</span>}<div><strong>{formatClass(event.class)}</strong><span>{Math.round(event.confidence * 100)}% · {new Date(event.timestamp).toLocaleTimeString()} · {event.source === CAMERA_SOURCE.home ? t("home camera") : t("webcam")}</span></div></li>)}</ol>}</div>
    </section>
  );
}
