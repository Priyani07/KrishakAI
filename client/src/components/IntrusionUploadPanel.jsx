import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import { analyzeIntrusionImageElement, loadCocoSsdModel } from "../cocoSsdRuntime.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function formatClass(value) { return String(value || "object").replaceAll("_", " "); }

export function IntrusionUploadPanel() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [status, setStatus] = useState("empty");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const imageRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => {
    try { modelRef.current?.dispose?.(); } catch { /* Optional cleanup. */ }
    modelRef.current = null;
  }, []);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setInputKey((value) => value + 1); setStatus("empty"); setMessage(""); setResult(null);
  };
  const onFileChange = (event) => {
    const selected = event.target.files?.[0];
    setMessage(""); setResult(null); setStatus("empty");
    if (!selected) return;
    setFile(null);
    setPreview((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    if (!acceptedImageTypes.includes(selected.type)) { setStatus("error"); setMessage("Use a JPG, PNG, or WEBP image."); return; }
    if (!selected.size) { setStatus("error"); setMessage("The selected image is empty."); return; }
    if (selected.size > MAX_IMAGE_BYTES) { setStatus("error"); setMessage("Choose an image smaller than 8 MB."); return; }
    setFile(selected);
    setPreview((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(selected); });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!file || !imageRef.current) { setStatus("error"); setMessage("Choose an image before starting the one-time analysis."); return; }
    setStatus("loading"); setMessage(""); setResult(null);
    try {
      if (!modelRef.current) modelRef.current = await loadCocoSsdModel();
      setResult(await analyzeIntrusionImageElement(imageRef.current, modelRef.current));
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "The COCO-SSD model could not analyze this image.");
    }
  };

  return <section className="intrusion-upload" aria-label="One-time intrusion image upload"><p className="section-kicker">02 / UPLOAD IMAGE</p><h2>Analyze one image locally.</h2><p>The selected image is checked by COCO-SSD in this browser. It is separate from live camera monitoring.</p><form className="upload-panel" onSubmit={submit}><label className="upload-dropzone" htmlFor="intrusion-image"><input key={inputKey} id="intrusion-image" type="file" accept={acceptedImageTypes.join(",")} onChange={onFileChange}/>{preview ? <img ref={imageRef} src={preview} alt="Selected farm image preview"/> : <div className="upload-empty"><span className="upload-symbol">↑</span><strong>Choose a farm image</strong><span>JPG, PNG, or WEBP up to 8 MB</span></div>}</label>{file && <div className="file-meta"><span>{file.name}</span><span>{Math.round(file.size / 1024)} KB</span></div>}<div className="upload-actions"><button className="button button--leaf" type="submit" disabled={status === "loading"}>{status === "loading" ? "Loading model and checking…" : "Start one-time analysis"} <ArrowRight size={15}/></button>{(file || status === "error") && <button className="text-button" type="button" onClick={reset}>Reset image</button>}</div>{status === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Image analysis unavailable</strong><p>{message}</p></div></div>}{status === "success" && result && <div className="service-result" aria-live="polite"><strong>{result.status === "potential_intrusion" ? "Potential monitored intrusion detected" : "No supported monitored intrusion detected"}</strong><p>{result.monitoredDetections.length ? `Detected: ${result.monitoredDetections.map((item) => `${formatClass(item.class)} ${Math.round(item.score * 100)}%`).join(", ")}.` : result.detections.length ? `COCO-SSD detected ${result.detections.map((item) => `${formatClass(item.class)} ${Math.round(item.score * 100)}%`).join(", ")}, but none are in the monitored intrusion classes.` : "COCO-SSD returned no supported detections above the configured threshold. This is not a guarantee that the area is safe."}</p><small>Model: {result.model} · Threshold: {Math.round(result.threshold * 100)}% · Analysis stayed in this browser.</small></div>}</form><div className="intrusion-upload__note"><ShieldCheck size={18}/><p>One image is checked once. Nothing is fabricated when the model cannot load or recognizes no supported object.</p></div></section>;
}
