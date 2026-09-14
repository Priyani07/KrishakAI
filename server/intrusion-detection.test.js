import { describe, expect, it } from "vitest";
import {
  COCO_INTRUSION_CLASSES,
  createInferenceGate,
  createIntrusionEvent,
  evaluateIntrusionFrame,
  getQualifiedDetections,
  INTRUSION_RULE_CONFIG,
  shouldPlayIntrusionAlert,
  stopMediaTracks,
} from "../client/src/intrusionDetection.js";
import { analyzeIntrusionImageElement, summarizeIntrusionPredictions } from "../client/src/cocoSsdRuntime.js";

const person = (score = 0.9) => ({ class: "person", score, bbox: [10, 12, 60, 80] });
const car = (score = 0.98) => ({ class: "car", score, bbox: [3, 4, 30, 30] });

describe("COCO-SSD intrusion rule", () => {
  it("accepts only valid detections at or above the centralized threshold", () => {
    expect(getQualifiedDetections([person(0.65)])).toEqual([]);
    expect(getQualifiedDetections([person(0.66)])[0]).toMatchObject({ class: "person", intrusionRelevant: true });
    expect(COCO_INTRUSION_CLASSES).toEqual(expect.arrayContaining(["person", "bird", "dog", "cow", "bear"]));
  });

  it("moves from candidate to confirmed only after repeated supported detections", () => {
    const first = evaluateIntrusionFrame({}, [person()], 1000);
    const second = evaluateIntrusionFrame(first, [person()], 1500);
    const third = evaluateIntrusionFrame(second, [person()], 2000);
    expect(first.status).toBe("candidate");
    expect(second.status).toBe("candidate");
    expect(third.status).toBe("confirmed");
    expect(createIntrusionEvent(third)).toMatchObject({ class: "person", source: "webcam", status: "potential_intrusion" });
  });

  it("clears a candidate or confirmed condition after qualifying detections disappear", () => {
    const candidate = evaluateIntrusionFrame({}, [person()], 1000);
    expect(evaluateIntrusionFrame(candidate, [], 1500).status).toBe("cleared");
  });

  it("ignores unsupported objects and chooses the highest-confidence supported object from multiple detections", () => {
    expect(evaluateIntrusionFrame({}, [car()], 1000).status).toBe("no_intrusion");
    const state = evaluateIntrusionFrame({}, [car(), { class: "dog", score: 0.88, bbox: [1, 2, 40, 40] }, person(0.91)], 1000);
    expect(state.status).toBe("candidate");
    expect(state.candidate.class).toBe("person");
  });

  it("prevents audio spam while keeping confirmed visual state independent of mute or audio availability", () => {
    expect(shouldPlayIntrusionAlert({ muted: false, lastAlertAt: 0, now: INTRUSION_RULE_CONFIG.alertCooldownMs, status: "confirmed" })).toBe(true);
    expect(shouldPlayIntrusionAlert({ muted: true, lastAlertAt: 0, now: INTRUSION_RULE_CONFIG.alertCooldownMs, status: "confirmed" })).toBe(false);
    expect(shouldPlayIntrusionAlert({ muted: false, lastAlertAt: 10_000, now: 10_500, status: "confirmed" })).toBe(false);
    expect(evaluateIntrusionFrame({ stableClass: "person", stableFrames: 2 }, [person()], 10_500).status).toBe("confirmed");
  });
});

describe("webcam inference lifecycle safeguards", () => {
  it("does not permit overlapping inference work", () => {
    const gate = createInferenceGate();
    expect(gate.tryBegin()).toBe(true);
    expect(gate.tryBegin()).toBe(false);
    gate.finish();
    expect(gate.tryBegin()).toBe(true);
  });

  it("releases every media track when monitoring stops or unmounts", () => {
    let firstCalls = 0; let secondCalls = 0;
    const first = { stop: () => { firstCalls += 1; } }; const second = { stop: () => { secondCalls += 1; } };
    stopMediaTracks({ getTracks: () => [first, second] });
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
  });
});

describe("camera source and snapshot safeguards", () => {
  it("accepts browser-compatible HTTP(S) streams and blocks RTSP", async () => {
    const { validateHomeCameraUrl } = await import("../client/src/intrusionCamera.js");
    expect(validateHomeCameraUrl("https://camera.example/live.m3u8")).toMatchObject({ ok: true });
    expect(validateHomeCameraUrl("rtsp://camera.example/live")).toEqual({ ok: false, code: "rtsp" });
    expect(validateHomeCameraUrl("not-a-url").ok).toBe(false);
  });

  it("creates one bounded local snapshot event after confirmation and respects cooldown", async () => {
    const { appendBoundedEvent, canCaptureSnapshot, createSnapshotEvent, CAMERA_SOURCE, snapshotPreviewAlt } = await import("../client/src/intrusionCamera.js");
    const confirmed = evaluateIntrusionFrame(evaluateIntrusionFrame(evaluateIntrusionFrame({}, [person()], 1000), [person()], 1500), [person()], 2000);
    const event = createSnapshotEvent(confirmed, { source: CAMERA_SOURCE.webcam, snapshot: "data:image/jpeg;base64,local", capturedAt: 2000 });
    expect(event).toMatchObject({ class: "person", source: "webcam", timestamp: 2000, snapshot: "data:image/jpeg;base64,local" });
    expect(snapshotPreviewAlt(event)).toContain("person");
    expect(canCaptureSnapshot({ lastCapturedAt: 2000, now: 2500, cooldownMs: 10_000 })).toBe(false);
    expect(appendBoundedEvent([event, { id: "old-1" }, { id: "old-2" }], { id: "new" }, 2).map((item) => item.id)).toEqual(["new", "2000-person"]);
  });
});

describe("one-time COCO-SSD image analysis", () => {
  it("reports a potential intrusion only from actual monitored predictions above threshold", () => {
    const result = summarizeIntrusionPredictions([
      car(0.98),
      { class: "dog", score: 0.91, bbox: [1, 2, 30, 40] },
      person(0.65),
    ], "2026-09-12T06:00:00.000Z");
    expect(result).toMatchObject({
      model: "COCO-SSD",
      status: "potential_intrusion",
      threshold: 0.66,
      analyzedAt: "2026-09-12T06:00:00.000Z",
    });
    expect(result.monitoredDetections.map((item) => item.class)).toEqual(["dog"]);
    expect(result.detections.map((item) => item.class)).toEqual(expect.arrayContaining(["car", "dog"]));
  });

  it("does not call an empty frame safe and does not fabricate detections", () => {
    expect(summarizeIntrusionPredictions([], "2026-09-12T06:00:00.000Z")).toMatchObject({
      status: "no_supported_intrusion_detected",
      detections: [],
      monitoredDetections: [],
    });
  });

  it("runs the supplied COCO model against a decoded image element", async () => {
    const image = { complete: true, naturalWidth: 640, naturalHeight: 480 };
    const model = { detect: async (input, limit, threshold) => {
      expect(input).toBe(image);
      expect(limit).toBe(20);
      expect(threshold).toBe(INTRUSION_RULE_CONFIG.detectionThreshold);
      return [{ class: "cow", score: 0.89, bbox: [10, 10, 100, 100] }];
    } };
    await expect(analyzeIntrusionImageElement(image, model)).resolves.toMatchObject({
      status: "potential_intrusion",
      monitoredDetections: [expect.objectContaining({ class: "cow", score: 0.89 })],
    });
  });

  it("rejects an undecodable image before inference", async () => {
    const model = { detect: async () => [] };
    await expect(analyzeIntrusionImageElement({ complete: true, naturalWidth: 0, naturalHeight: 0 }, model)).rejects.toThrow("could not be decoded");
  });
});
