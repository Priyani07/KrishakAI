import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import {
  createVoiceNoticeTimer,
  createVoiceRecognitionSession,
  DEFAULT_VOICE_RECOGNITION_LANGUAGE,
  getVoiceLanguageButtonState,
  getRecognitionErrorMessage,
  isMicrophonePermissionError,
  resolveFinalVoiceNavigation,
  stopVoiceRecognitionSession,
  switchVoiceRecognitionLanguage,
  VOICE_BUTTON_LABELS,
  VOICE_STATUS_LABELS,
  MICROPHONE_PERMISSION_NOTICE_DURATION_MS,
} from "../voiceNavigation.js";
import { useLanguage } from "../contexts/LanguageContext.jsx";
const LANGUAGE_OPTIONS = [
  { code: "en", label: "EN", title: "Recognize English (India)", ariaLabel: "Change voice language to English" },
  { code: "hi", label: "हिं", title: "Recognize Hindi (India)", ariaLabel: "Change voice language to Hindi" },
];
export function VoiceNavigationControl({ navigate }) {
  const { language, setLanguage, voiceLocale } = useLanguage();
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null);
  const resetTimerRef = useRef(null);
  const permissionNoticeTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);

  const clearPermissionNoticeTimer = () => {
    permissionNoticeTimerRef.current?.clear();
    permissionNoticeTimerRef.current = null;
  };

  const clearTimers = () => {
    clearPermissionNoticeTimer();
    window.clearTimeout(resetTimerRef.current);
    window.clearTimeout(navigationTimerRef.current);
    resetTimerRef.current = null;
    navigationTimerRef.current = null;
  };

  useEffect(() => () => {
    clearTimers();
    try { recognitionRef.current?.abort(); } catch { /* The browser session has already ended. */ }
  }, []);

  const returnToIdle = (nextMessage, delay = 0) => {
    clearPermissionNoticeTimer();
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
    setMessage(nextMessage);
    if (!delay) {
      setStatus("idle");
      return;
    }
    setStatus("error");
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setStatus("idle");
    }, delay);
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { /* Recognition may already be stopping. */ }
    recognitionRef.current = null;
    setStatus("idle");
    setMessage("Voice navigation stopped. You can continue using the regular navigation menu.");
  };

  const handleLanguageChange = (nextLanguage) => {
    const wasListening = status === "listening" || status === "processing";
    const nextLocale = nextLanguage === "hi" ? "hi-IN" : DEFAULT_VOICE_RECOGNITION_LANGUAGE;
    const languageChange = switchVoiceRecognitionLanguage(voiceLocale, nextLocale, recognitionRef.current);
    if (!languageChange.changed) return;
    clearTimers();
    recognitionRef.current = null;
    setTranscript("");
    setLanguage(nextLanguage);
    setStatus("idle");
    setMessage(`${languageChange.language === "hi-IN" ? "Hindi" : "English"} selected.${wasListening ? " Listening stopped." : ""} Tap Voice to start listening.`);
  };

  const startListening = () => {
    clearTimers();
    if (status === "listening" || status === "processing") {
      stopListening();
      return;
    }

    const recognition = createVoiceRecognitionSession(window, voiceLocale);
    if (!recognition) {
      setStatus("unsupported");
      setMessage("Voice navigation is not supported in this browser. Please use the regular navigation menu.");
      return;
    }
    recognitionRef.current = recognition;
    setTranscript("");
    setMessage("");

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index]?.[0]?.transcript || "";
        if (event.results[index]?.isFinal) finalTranscript += phrase;
        else interimTranscript += phrase;
      }

      const heard = (finalTranscript || interimTranscript).trim();
      if (heard) setTranscript(heard);
      if (!finalTranscript.trim()) return;

      setStatus("processing");
      const target = resolveFinalVoiceNavigation(finalTranscript, true);
      if (!target) {
        try { recognition.stop(); } catch { /* Recognition may already have ended. */ }
        recognitionRef.current = null;
        returnToIdle("I didn't catch the destination. Try Weather, Community, Disease, Planner, Farmers Guide, or Soil.");
        return;
      }

      setMessage(`Opening ${target.label}.`);
      try { recognition.stop(); } catch { /* Recognition may already have ended. */ }
      recognitionRef.current = null;
      navigationTimerRef.current = window.setTimeout(() => {
        navigate(target.path);
      }, 160);
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      const nextMessage = getRecognitionErrorMessage(event.error);
      if (isMicrophonePermissionError(event.error)) {
        clearPermissionNoticeTimer();
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
        setStatus("error");
        setMessage(nextMessage);
        const noticeTimer = createVoiceNoticeTimer(window, () => {
          permissionNoticeTimerRef.current = null;
          setStatus("idle");
          setMessage("");
        });
        permissionNoticeTimerRef.current = noticeTimer;
        noticeTimer.start(MICROPHONE_PERMISSION_NOTICE_DURATION_MS);
        return;
      }
      returnToIdle(nextMessage, 2800);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setStatus((current) => (current === "listening" || current === "processing" ? "idle" : current));
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      returnToIdle("Voice navigation unavailable. Please try again or use the regular navigation menu.", 2800);
    }
  };

  const isListening = status === "listening" || status === "processing";
  const supported = status !== "unsupported";

  return (
    <div className="voice-navigation" aria-live="polite">
      <div className="voice-navigation__controls" role="group" aria-label="Voice navigation">
        <button
          type="button"
          className={`voice-navigation__button voice-navigation__button--${status}`}
          onClick={startListening}
          aria-label="Voice navigation"
          aria-pressed={isListening}
          title="Voice navigation"
        >
          {isListening ? <Square size={15} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
          <span className="voice-navigation__button-text">{VOICE_BUTTON_LABELS[status]}</span>
        </button>
        <div className="voice-navigation__languages" aria-label="Voice recognition language">
          {LANGUAGE_OPTIONS.map((option) => (
            (() => {
              const languageButtonState = getVoiceLanguageButtonState(voiceLocale, option.code === "hi" ? "hi-IN" : "en-IN");
              return (
                <button
                  type="button"
                  key={option.code}
                  className={`voice-navigation__language ${languageButtonState.isActive ? "voice-navigation__language--active" : ""}`}
                  onClick={() => handleLanguageChange(option.code)}
                  disabled={!supported}
                  aria-label={option.ariaLabel}
                  aria-pressed={languageButtonState.isActive}
                  title={option.title}
                >
                  {option.label}
                </button>
              );
            })()
          ))}
        </div>
      </div>
      {(transcript || message || isListening) && (
        <div className="voice-navigation__feedback" role={status === "error" ? "alert" : "status"}>
          {transcript && <p><Volume2 size={13} aria-hidden="true" /> <strong>Heard:</strong> “{transcript}”</p>}
          {isListening && !transcript && <p><Volume2 size={13} aria-hidden="true" /> Listening…</p>}
          {message && <p>{message}</p>}
          <small>Voice commands only open allowlisted Krishak pages; they never submit or change data.</small>
        </div>
      )}
    </div>
  );
}
