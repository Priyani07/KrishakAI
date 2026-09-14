import { describe, expect, it, vi } from "vitest";
import { DIAGNOSTIC_EVIDENCE_STATUS, DISEASE_IMAGE_STATUS, DISEASE_RESULT_STATUS, SYMPTOM_EVIDENCE_STATUS } from "../shared/diseaseTaxonomy.js";
import { getDiseaseGuidance } from "../client/src/services/diseaseGuidance.js";
import { DiseaseImageGateError, evaluateDiseaseImageGate, parseDiseaseImageGateResponse } from "./diseaseImageGate.js";
import { inferDisease, normalizeDiseaseImageGateResult } from "./disease.js";

function llmResponse(payload) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

function plantGate(overrides = {}) {
  return {
    imageStatus: DISEASE_IMAGE_STATUS.PLANT_IMAGE,
    crop: "tomato",
    cropConfidence: 0.92,
    plantParts: ["leaf"],
    diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT,
    symptomEvidence: SYMPTOM_EVIDENCE_STATUS.VISIBLE_SYMPTOMS,
    uncertain: false,
    note: "Visible symptoms are suitable for specialist classification.",
    ...overrides,
  };
}

function tomatoEarlyBlightProviderResult() {
  return {
    isPlant: true,
    isPlantProbability: 0.99,
    crop: { id: "c4f0d775e03dd7fd", name: "tomato", probability: 0.93 },
    disease: { id: "a9bf74348b28ad62", name: "early blight", probability: 0.88 },
  };
}

describe("Disease Detection broad crop-image gate", () => {
  it("accepts valid broad plant parts without forcing a leaf-only category", () => {
    const wholePlant = parseDiseaseImageGateResponse(llmResponse(plantGate({ plantParts: ["whole_plant"], diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT, uncertain: true })));
    const fruitAndStem = parseDiseaseImageGateResponse(llmResponse(plantGate({ plantParts: ["fruit", "stem", "multiple_parts"] })));
    expect(wholePlant).toMatchObject({ imageStatus: DISEASE_IMAGE_STATUS.PLANT_IMAGE, plantParts: ["whole_plant"], diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT });
    expect(fruitAndStem.plantParts).toEqual(["fruit", "stem", "multiple_parts"]);
  });

  it("validates all intended broad part values in a structured gate response", () => {
    const parts = ["leaf", "stem", "branch", "flower", "fruit", "tuber", "seed", "pod", "cob", "whole_plant", "multiple_parts"];
    const parsed = parseDiseaseImageGateResponse(llmResponse(plantGate({ plantParts: parts })));
    expect(parsed.plantParts).toEqual(parts);
  });

  it("converts non-plant, low-quality, and ambiguous images into safe non-diagnosis states", () => {
    const nonPlant = normalizeDiseaseImageGateResult({ imageGate: plantGate({ imageStatus: DISEASE_IMAGE_STATUS.NON_PLANT_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN, uncertain: true, crop: "unknown", cropConfidence: 0, plantParts: ["unknown"] }), providerResult: null });
    const lowQuality = normalizeDiseaseImageGateResult({ imageGate: plantGate({ imageStatus: DISEASE_IMAGE_STATUS.LOW_QUALITY_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT, uncertain: true, crop: "unknown", cropConfidence: 0, plantParts: ["unknown"] }), providerResult: null });
    const ambiguous = normalizeDiseaseImageGateResult({ imageGate: plantGate({ imageStatus: DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN, uncertain: true, crop: "unknown", cropConfidence: 0, plantParts: ["unknown"] }), providerResult: null });
    expect(nonPlant).toMatchObject({ status: DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE, uncertain: true, imageStatus: DISEASE_IMAGE_STATUS.NON_PLANT_IMAGE });
    expect(lowQuality).toMatchObject({ status: DISEASE_RESULT_STATUS.LOW_QUALITY, uncertain: true, imageStatus: DISEASE_IMAGE_STATUS.LOW_QUALITY_IMAGE });
    expect(ambiguous).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, uncertain: true, imageStatus: DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE });
    expect(getDiseaseGuidance(nonPlant)).toMatchObject({ hasVerifiedGuidance: false, whatToDoNow: ["Check another image that clearly shows the crop or affected plant part."], source: null });
  });

  it("allows an exact mapped result only when the gate reports sufficient visual evidence", () => {
    const sufficient = normalizeDiseaseImageGateResult({ imageGate: plantGate({ plantParts: ["fruit", "stem", "multiple_parts"] }), providerResult: tomatoEarlyBlightProviderResult() });
    const insufficient = normalizeDiseaseImageGateResult({ imageGate: plantGate({ plantParts: ["whole_plant"], diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT, uncertain: true }), providerResult: tomatoEarlyBlightProviderResult() });
    expect(sufficient).toMatchObject({ status: DISEASE_RESULT_STATUS.VALID_LEAF, diagnosisId: "tomato_early_blight", guidanceStatus: "available", plantParts: ["fruit", "stem", "multiple_parts"] });
    expect(insufficient).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT });
    expect(getDiseaseGuidance(insufficient)).toMatchObject({ hasVerifiedGuidance: false, source: null });
  });

  it("suppresses a provider detection when the crop/class pair is not exact and crop identity conflicts", () => {
    const result = normalizeDiseaseImageGateResult({
      imageGate: plantGate({ crop: "corn", plantParts: ["leaf"] }),
      providerResult: {
        isPlant: true,
        isPlantProbability: 0.95,
        crop: { id: "wrong-crop", name: "eggplant", probability: 0.7 },
        disease: { id: "8cc41a5ca8d30d4f", name: "northern corn leaf blight", probability: 0.82 },
      },
    });
    expect(result).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true, plantParts: ["leaf"] });
    expect(getDiseaseGuidance(result)).toMatchObject({ hasVerifiedGuidance: false, source: null });
  });

  it("does not call Kindwise when the gate safely rejects a non-plant image", async () => {
    const classifyProvider = vi.fn();
    const result = await inferDisease(Buffer.from("image"), "image/jpeg", {
      evaluateImageGate: async () => plantGate({ imageStatus: DISEASE_IMAGE_STATUS.NON_PLANT_IMAGE, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.UNKNOWN, uncertain: true, crop: "unknown", cropConfidence: 0, plantParts: ["unknown"] }),
      classifyProvider,
    });
    expect(classifyProvider).not.toHaveBeenCalled();
    expect(result.status).toBe(DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE);
  });

  it("converts a malformed gate response to safe unknown without calling Kindwise", async () => {
    const classifyProvider = vi.fn();
    const result = await inferDisease(Buffer.from("image"), "image/jpeg", {
      evaluateImageGate: async () => { throw new DiseaseImageGateError("malformed_response", "Invalid structured gate response"); },
      classifyProvider,
    });
    expect(classifyProvider).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true, imageStatus: DISEASE_IMAGE_STATUS.AMBIGUOUS_IMAGE });
    expect(getDiseaseGuidance(result)).toMatchObject({ hasVerifiedGuidance: false, source: null });
  });

  it("passes local image data to the server-only visual gate with a strict result parser", async () => {
    const visionClassifier = vi.fn(async () => llmResponse(plantGate({ crop: "potato", cropConfidence: 0.85, plantParts: ["tuber"] })));
    const result = await evaluateDiseaseImageGate({ imageBuffer: Buffer.from("image-bytes"), mimeType: "image/jpeg", visionClassifier });
    expect(visionClassifier).toHaveBeenCalledWith(expect.objectContaining({ model: expect.any(String), imageUrl: expect.stringMatching(/^data:image\/jpeg;base64,/), responseFormat: expect.any(Object) }));
    expect(result).toMatchObject({ crop: "potato", plantParts: ["tuber"], diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT });
  });
});
