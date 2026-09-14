export const INTRUSION_RULE_CONFIG = Object.freeze({
  detectionThreshold: 0.66,
  stableFrameCount: 3,
  inferenceIntervalMs: 500,
  alertCooldownMs: 10_000,
  maxRecentEvents: 5,
});

// COCO-SSD's documented COCO vocabulary includes every value in this limited farm-relevant set.
export const COCO_INTRUSION_CLASSES = Object.freeze([
  "person",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
]);

const intrusionClassSet = new Set(COCO_INTRUSION_CLASSES);

function isValidBox(box) {
  return Array.isArray(box) && box.length === 4 && box.every((value) => Number.isFinite(value));
}

export function getQualifiedDetections(predictions = [], threshold = INTRUSION_RULE_CONFIG.detectionThreshold) {
  if (!Array.isArray(predictions)) return [];

  return predictions
    .filter((prediction) => prediction && typeof prediction.class === "string" && Number.isFinite(prediction.score) && prediction.score >= threshold && isValidBox(prediction.bbox))
    .map((prediction) => ({
      class: prediction.class.toLowerCase(),
      score: prediction.score,
      bbox: prediction.bbox,
      intrusionRelevant: intrusionClassSet.has(prediction.class.toLowerCase()),
    }));
}

export function evaluateIntrusionFrame(previous = {}, predictions = [], at = Date.now(), config = INTRUSION_RULE_CONFIG) {
  const detections = getQualifiedDetections(predictions, config.detectionThreshold);
  const candidates = detections.filter((detection) => detection.intrusionRelevant).sort((left, right) => right.score - left.score);
  const priorStatus = previous.status || "no_intrusion";

  if (candidates.length === 0) {
    return {
      status: priorStatus === "candidate" || priorStatus === "confirmed" ? "cleared" : "no_intrusion",
      detections,
      candidate: null,
      stableClass: null,
      stableFrames: 0,
      updatedAt: at,
    };
  }

  const candidate = candidates[0];
  const stableFrames = previous.stableClass === candidate.class ? (previous.stableFrames || 0) + 1 : 1;
  return {
    status: stableFrames >= config.stableFrameCount ? "confirmed" : "candidate",
    detections,
    candidate,
    stableClass: candidate.class,
    stableFrames,
    updatedAt: at,
  };
}

export function createIntrusionEvent(frameState) {
  if (frameState?.status !== "confirmed" || !frameState.candidate) return null;
  return {
    id: `${frameState.updatedAt}-${frameState.candidate.class}`,
    timestamp: frameState.updatedAt,
    class: frameState.candidate.class,
    confidence: frameState.candidate.score,
    source: "webcam",
    status: "potential_intrusion",
  };
}

export function shouldPlayIntrusionAlert({ muted = false, lastAlertAt = 0, now = Date.now(), status } = {}, config = INTRUSION_RULE_CONFIG) {
  return !muted && status === "confirmed" && now - lastAlertAt >= config.alertCooldownMs;
}

export function createInferenceGate() {
  let running = false;
  return {
    tryBegin() {
      if (running) return false;
      running = true;
      return true;
    },
    finish() { running = false; },
    isRunning() { return running; },
  };
}

export function stopMediaTracks(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}
