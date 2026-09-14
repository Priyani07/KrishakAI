import { describe, expect, it } from "vitest";
import { DISEASE_RESULT_STATUS } from "../shared/diseaseTaxonomy.js";
import { getDiseaseGuidance } from "../client/src/services/diseaseGuidance.js";
import { parseInferenceResponse } from "./disease.js";

function response(payload) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

describe("Disease Detection image-validity gate", () => {
  it("keeps only a valid supported leaf result eligible for disease-specific guidance", () => {
    const supported = parseInferenceResponse(response({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato early blight", confidence: 0.82, uncertain: false, note: "Initial." }));
    expect(supported.status).toBe(DISEASE_RESULT_STATUS.VALID_LEAF);
    expect(getDiseaseGuidance(supported)).toMatchObject({ hasVerifiedGuidance: true });
  });

  it("suppresses disease-specific treatment for low-quality, non-plant, healthy, unknown, and unsupported results", () => {
    const outcomes = [
      { status: "low_quality", crop: "unknown", diagnosisId: "low_quality", diagnosis: "Low-quality image", confidence: 0.2, uncertain: true, note: "" },
      { status: "not_a_plant_image", crop: "unknown", diagnosisId: "unsupported", diagnosis: "Not a plant image", confidence: 0.9, uncertain: true, note: "" },
      { status: "healthy_or_no_visible_disease", crop: "tomato", diagnosisId: "healthy", diagnosis: "Healthy / no visible disease", confidence: 0.8, uncertain: false, note: "" },
      { status: "unknown", crop: "unknown", diagnosisId: "unknown", diagnosis: "Unknown condition", confidence: 0.4, uncertain: true, note: "" },
      { status: "unsupported", crop: "tomato", diagnosisId: "unsupported", diagnosis: "Unsupported condition", confidence: 0.6, uncertain: true, note: "" },
    ].map((payload) => parseInferenceResponse(response(payload)));
    outcomes.forEach((outcome) => expect(getDiseaseGuidance(outcome)).toMatchObject({ hasVerifiedGuidance: false, source: null }));
  });

  it("converts a mismatched image-gate status or arbitrary provider string to safe unknown instead of forcing a taxonomy class", () => {
    const invalidStatus = parseInferenceResponse(response({ status: "valid_leaf", crop: "unknown", diagnosisId: "healthy", diagnosis: "Healthy / no visible disease", confidence: 0.8, uncertain: false, note: "" }));
    const arbitraryLabel = parseInferenceResponse(response({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Random disease", confidence: 0.8, uncertain: false, note: "" }));
    expect(invalidStatus).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true });
    expect(arbitraryLabel).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: "unknown", uncertain: true });
  });
});
