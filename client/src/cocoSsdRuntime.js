import { INTRUSION_RULE_CONFIG, getQualifiedDetections } from "./intrusionDetection.js";

export async function loadCocoSsdModel() {
  const [tf, , , cocoSsd] = await Promise.all([
    import("@tensorflow/tfjs-core"),
    import("@tensorflow/tfjs-backend-webgl"),
    import("@tensorflow/tfjs-backend-cpu"),
    import("@tensorflow-models/coco-ssd"),
  ]);
  try {
    const webglReady = await tf.setBackend("webgl");
    if (!webglReady) await tf.setBackend("cpu");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  return cocoSsd.load();
}

export function summarizeIntrusionPredictions(predictions, analyzedAt = new Date().toISOString()) {
  const detections = getQualifiedDetections(predictions, INTRUSION_RULE_CONFIG.detectionThreshold);
  const monitoredDetections = detections.filter((item) => item.intrusionRelevant);
  return {
    model: "COCO-SSD",
    status: monitoredDetections.length ? "potential_intrusion" : "no_supported_intrusion_detected",
    threshold: INTRUSION_RULE_CONFIG.detectionThreshold,
    detections,
    monitoredDetections,
    analyzedAt,
  };
}

export async function analyzeIntrusionImageElement(image, model) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) throw new Error("The selected image could not be decoded.");
  if (!model?.detect) throw new Error("The COCO-SSD model is unavailable.");
  const predictions = await model.detect(image, 20, INTRUSION_RULE_CONFIG.detectionThreshold);
  return summarizeIntrusionPredictions(predictions);
}
