import { describe, expect, it } from "vitest";
import { DISEASE_KNOWLEDGE_BASE, DISEASE_RESULT_STATUS, DISEASE_TAXONOMY_VERSION, getDiseaseKnowledge, getDiseaseKnowledgeByModelLabel, HEALTHY_DIAGNOSIS_ID, LOW_QUALITY_DIAGNOSIS_ID, UNKNOWN_DIAGNOSIS_ID, UNSUPPORTED_DIAGNOSIS_ID, VERIFIED_TREATMENT_UNAVAILABLE } from "../shared/diseaseTaxonomy.js";
import { parseInferenceResponse } from "./disease.js";
import { getDiseaseGuidance } from "../client/src/services/diseaseGuidance.js";

function providerPayload(payload) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

describe("controlled Disease Detection taxonomy", () => {
  it("defines only versioned, source-backed canonical records", () => {
    expect(DISEASE_TAXONOMY_VERSION).toBe("1.2.0");
    expect(DISEASE_KNOWLEDGE_BASE).toHaveLength(4);
    expect(getDiseaseKnowledge("tomato_early_blight")).toMatchObject({
      crop: "tomato",
      displayName: "Tomato Early Blight",
      acceptedModelLabels: ["Tomato early blight", "Early blight of tomato"],
      source: expect.objectContaining({ organization: "University of Minnesota Extension", url: expect.stringContaining("extension.umn.edu") }),
    });
    expect(getDiseaseKnowledge("potato_late_blight")).toMatchObject({ crop: "potato", scientificPathogenNames: ["Phytophthora infestans"], source: expect.objectContaining({ url: expect.stringContaining("extension.umn.edu") }) });
    expect(getDiseaseKnowledge("tomato_late_blight")).toMatchObject({ crop: "tomato", scientificPathogenNames: ["Phytophthora infestans"], source: expect.objectContaining({ url: expect.stringContaining("extension.umn.edu") }) });
    expect(getDiseaseKnowledge("corn_northern_leaf_blight")).toMatchObject({ crop: "corn", scientificPathogenNames: ["Exserohilum turcicum"], source: expect.objectContaining({ url: expect.stringContaining("udel.edu") }) });
  });

  it("maps an exact supported model label and verified alias to the same canonical diagnosis ID", () => {
    expect(getDiseaseKnowledgeByModelLabel("Tomato early blight")?.diagnosisId).toBe("tomato_early_blight");
    expect(getDiseaseKnowledgeByModelLabel("  Early blight   of tomato ")?.diagnosisId).toBe("tomato_early_blight");
    expect(parseInferenceResponse(providerPayload({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Early blight of tomato", confidence: 0.81, uncertain: false, note: "Initial indication." }))).toMatchObject({ status: "valid_leaf", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", crop: "tomato" });
  });

  it("converts arbitrary unsupported labels and mismatched taxonomy details into a safe unknown result", () => {
    const arbitrary = parseInferenceResponse(providerPayload({ status: "valid_leaf", crop: "potato", diagnosisId: "unverified_condition", diagnosis: "Unverified condition", confidence: 0.72, uncertain: false, note: "Unsupported." }));
    const mismatched = parseInferenceResponse(providerPayload({ status: "valid_leaf", crop: "potato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato early blight", confidence: 0.72, uncertain: false, note: "Mismatch." }));
    expect(arbitrary).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: UNKNOWN_DIAGNOSIS_ID, diagnosis: "Unknown condition", uncertain: true, confidence: 0.72 });
    expect(mismatched).toMatchObject({ status: DISEASE_RESULT_STATUS.UNKNOWN, diagnosisId: UNKNOWN_DIAGNOSIS_ID, diagnosis: "Unknown condition", uncertain: true, confidence: 0.72 });
  });

  it("returns only source-backed guidance for a supported certain result and suppresses it for uncertain or unknown results", () => {
    const supported = getDiseaseGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", confidence: 0.85, uncertain: false });
    const uncertain = getDiseaseGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato Early Blight", confidence: 0.85, uncertain: true });
    const unknown = getDiseaseGuidance({ status: "unknown", crop: "unknown", diagnosisId: "unknown", diagnosis: "Unknown condition", confidence: 0.42, uncertain: true });
    expect(supported).toMatchObject({ hasVerifiedGuidance: true, source: expect.objectContaining({ url: expect.stringContaining("extension.umn.edu") }) });
    expect(uncertain).toMatchObject({ hasVerifiedGuidance: false, treatment: VERIFIED_TREATMENT_UNAVAILABLE, source: null });
    expect(unknown).toMatchObject({ hasVerifiedGuidance: false, treatment: VERIFIED_TREATMENT_UNAVAILABLE, source: null });
    expect(supported.treatment).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|ppm|%|lit(?:er|re)s?)\b|every\s+\d+/i);
  });

  it("returns safe image-gate outcomes for healthy, low-quality, non-plant, and unsupported inputs", () => {
    const healthy = parseInferenceResponse(providerPayload({ status: "healthy_or_no_visible_disease", crop: "tomato", diagnosisId: "healthy", diagnosis: "Healthy / no visible disease", confidence: 0.84, uncertain: false, note: "Healthy." }));
    const lowQuality = parseInferenceResponse(providerPayload({ status: "low_quality", crop: "unknown", diagnosisId: "low_quality", diagnosis: "Low-quality image", confidence: 0.18, uncertain: true, note: "Blurred." }));
    const notPlant = parseInferenceResponse(providerPayload({ status: "not_a_plant_image", crop: "unknown", diagnosisId: "unsupported", diagnosis: "Not a plant image", confidence: 0.91, uncertain: true, note: "No leaf." }));
    const unsupported = parseInferenceResponse(providerPayload({ status: "unsupported", crop: "tomato", diagnosisId: "unsupported", diagnosis: "Unsupported condition", confidence: 0.67, uncertain: true, note: "Outside taxonomy." }));
    expect(healthy).toMatchObject({ status: DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE, diagnosisId: HEALTHY_DIAGNOSIS_ID, crop: "tomato", uncertain: false });
    expect(lowQuality).toMatchObject({ status: DISEASE_RESULT_STATUS.LOW_QUALITY, diagnosisId: LOW_QUALITY_DIAGNOSIS_ID, crop: "unknown", uncertain: true });
    expect(notPlant).toMatchObject({ status: DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE, diagnosisId: UNSUPPORTED_DIAGNOSIS_ID, crop: "unknown", uncertain: true });
    expect(unsupported).toMatchObject({ status: DISEASE_RESULT_STATUS.UNSUPPORTED, diagnosisId: UNSUPPORTED_DIAGNOSIS_ID, crop: "tomato", uncertain: true });
  });
});
