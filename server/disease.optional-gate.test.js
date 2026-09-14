import { describe, expect, it, vi } from "vitest";
import { inferDisease } from "./disease.js";

const providerResult = {
  isPlant: true,
  isPlantProbability: 0.99,
  crop: { id: "provider-crop", name: "wheat", probability: 0.91 },
  disease: { id: "provider-disease", name: "leaf rust", probability: 0.82 },
};

describe("optional Disease image gate", () => {
  it("runs Kindwise directly when the optional Gemini gate is not configured", async () => {
    const gate = vi.fn();
    const classifyProvider = vi.fn().mockResolvedValue(providerResult);
    const result = await inferDisease(Buffer.from("image"), "image/jpeg", { useImageGate: false, evaluateImageGate: gate, classifyProvider });
    expect(gate).not.toHaveBeenCalled();
    expect(classifyProvider).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ providerType: "kindwise-crop-health", crop: "wheat", diagnosis: "leaf rust", confidence: 0.82, guidanceStatus: "unavailable" });
  });

  it("runs the gate before Kindwise when explicitly enabled", async () => {
    const order = [];
    const result = await inferDisease(Buffer.from("image"), "image/jpeg", {
      useImageGate: true,
      evaluateImageGate: async () => { order.push("gate"); return { imageStatus: "PLANT_IMAGE", crop: "maize", cropConfidence: 0.9, plantParts: ["leaf"], diagnosticEvidence: "SUFFICIENT", symptomEvidence: "VISIBLE_SYMPTOMS", uncertain: false, note: "" }; },
      classifyProvider: async () => { order.push("kindwise"); return { ...providerResult, crop: { id: "corn-id", name: "corn", probability: 0.9 }, disease: { id: "unreviewed", name: "corn rust", probability: 0.8 } }; },
    });
    expect(order).toEqual(["gate", "kindwise"]);
    expect(result.crop).toBe("corn");
  });
});
