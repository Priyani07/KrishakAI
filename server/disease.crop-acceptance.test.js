import { describe, expect, it } from "vitest";
import { evaluateCropSpecificAcceptance } from "./diseaseAcceptancePolicy.js";
import { normalizeDiseaseImageGateResult } from "./disease.js";
import { DIAGNOSTIC_EVIDENCE_STATUS, DISEASE_IMAGE_STATUS, DISEASE_RESULT_STATUS, SYMPTOM_EVIDENCE_STATUS } from "../shared/diseaseTaxonomy.js";

function gate(overrides = {}) {
  return {
    imageStatus: DISEASE_IMAGE_STATUS.PLANT_IMAGE,
    crop: "tomato",
    cropConfidence: 0.9,
    plantParts: ["leaf"],
    diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.SUFFICIENT,
    symptomEvidence: SYMPTOM_EVIDENCE_STATUS.VISIBLE_SYMPTOMS,
    uncertain: false,
    note: "Visible symptoms are suitable for specialist classification.",
    ...overrides,
  };
}

function provider({ cropName = "tomato", cropId = "c4f0d775e03dd7fd", diseaseId = "a9bf74348b28ad62", diseaseName = "early blight" } = {}) {
  return {
    isPlant: true,
    isPlantProbability: 0.99,
    crop: { id: cropId, name: cropName, probability: 0.9 },
    disease: { id: diseaseId, name: diseaseName, probability: 0.88 },
  };
}

describe("Disease Detection crop-specific acceptance", () => {
  it("accepts an exact mapped disease only with matching crop, supported part, and visible symptoms", () => {
    const result = normalizeDiseaseImageGateResult({ imageGate: gate(), providerResult: provider() });
    expect(result).toMatchObject({ status: DISEASE_RESULT_STATUS.VALID_LEAF, diagnosisId: "tomato_early_blight", guidanceStatus: "available", symptomEvidence: SYMPTOM_EVIDENCE_STATUS.VISIBLE_SYMPTOMS });
  });

  it("suppresses an otherwise mapped disease when visible symptoms are not confirmed", () => {
    const result = normalizeDiseaseImageGateResult({ imageGate: gate({ symptomEvidence: SYMPTOM_EVIDENCE_STATUS.NO_VISIBLE_SYMPTOMS }), providerResult: provider() });
    expect(result).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", confidence: 0, providerConfidence: 0.88, uncertain: true, diagnosticEvidence: DIAGNOSTIC_EVIDENCE_STATUS.INSUFFICIENT });
    expect(result.note).toContain("No visible symptoms were confirmed");
  });

  it("suppresses a provider result when gate crop and provider crop disagree rather than exposing an unreviewed disease conclusion", () => {
    const result = normalizeDiseaseImageGateResult({ imageGate: gate({ crop: "potato" }), providerResult: provider({ cropName: "apple", cropId: "dcf39092de182ffc", diseaseId: "68b08da8db41ac47", diseaseName: "Alternaria brown spot" }) });
    expect(result).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true, crop: "potato" });
    expect(result.note).toContain("does not agree with the provider result");
  });

  it("requires a matching crop and no visible symptoms before accepting a healthy provider class", () => {
    const normalizedHealthy = { status: DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE };
    const healthyProvider = provider({ diseaseId: "c35556c0c67c0591", diseaseName: "healthy" });
    expect(evaluateCropSpecificAcceptance({ normalizedResult: normalizedHealthy, imageGate: gate({ symptomEvidence: SYMPTOM_EVIDENCE_STATUS.NO_VISIBLE_SYMPTOMS }), providerResult: healthyProvider })).toMatchObject({ accepted: true });
    expect(evaluateCropSpecificAcceptance({ normalizedResult: normalizedHealthy, imageGate: gate({ symptomEvidence: SYMPTOM_EVIDENCE_STATUS.VISIBLE_SYMPTOMS }), providerResult: healthyProvider })).toMatchObject({ accepted: false, reasonCode: "healthy_conflicts_with_visible_or_unclear_symptoms" });
    expect(evaluateCropSpecificAcceptance({ normalizedResult: normalizedHealthy, imageGate: gate({ crop: "potato", symptomEvidence: SYMPTOM_EVIDENCE_STATUS.NO_VISIBLE_SYMPTOMS }), providerResult: healthyProvider })).toMatchObject({ accepted: false, reasonCode: "crop_mismatch" });
  });
});
