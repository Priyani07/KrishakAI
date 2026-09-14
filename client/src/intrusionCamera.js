export const CAMERA_SOURCE = Object.freeze({
  webcam: "webcam",
  home: "home",
});

export function validateHomeCameraUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, code: "missing" };
  if (/^rtsp:\/\//i.test(raw)) return { ok: false, code: "rtsp" };
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return { ok: false, code: "unsupported" };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, code: "invalid" };
  }
}

export function createSnapshotEvent(frameState, { source = CAMERA_SOURCE.webcam, snapshot = null, capturedAt = Date.now() } = {}) {
  const event = createBaseEvent(frameState, source, capturedAt);
  return event ? { ...event, snapshot } : null;
}

function createBaseEvent(frameState, source, capturedAt) {
  if (frameState?.status !== "confirmed" || !frameState.candidate) return null;
  return {
    id: `${capturedAt}-${frameState.candidate.class}`,
    timestamp: capturedAt,
    class: frameState.candidate.class,
    confidence: frameState.candidate.score,
    source,
    status: "potential_intrusion",
  };
}

export function canCaptureSnapshot({ lastCapturedAt = 0, now = Date.now(), cooldownMs = 10_000 } = {}) {
  return now - lastCapturedAt >= cooldownMs;
}

export function appendBoundedEvent(history = [], event, maxEvents = 5) {
  if (!event) return history.slice(0, maxEvents);
  return [event, ...history].slice(0, Math.max(1, maxEvents));
}

export function snapshotPreviewAlt(event) {
  if (!event) return "Potential intrusion snapshot";
  return `Potential intrusion snapshot: ${String(event.class || "object").replaceAll("_", " ")}`;
}
