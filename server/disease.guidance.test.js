import { describe, expect, it } from "vitest";
import { getDiseaseGuidance, TOMATO_EARLY_BLIGHT_SOURCE, VERIFIED_GUIDANCE_DIAGNOSES, VERIFIED_TREATMENT_UNAVAILABLE } from "../client/src/services/diseaseGuidance.js";

describe("Disease post-result guidance", () => {
  it("returns source-backed non-dose guidance only for an exact verified canonical diagnosis", () => {
    const guidance = getDiseaseGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato early blight", confidence: 0.84, uncertain: false });
    expect(guidance).toMatchObject({
      hasVerifiedGuidance: true,
      source: TOMATO_EARLY_BLIGHT_SOURCE,
    });
    expect(guidance.whatToDoNow.join(" ")).toContain("sanitize pruning tools");
    expect(guidance.whatToAvoid.join(" ")).toContain("keeping leaves wet");
    expect(guidance.treatment).toContain("intentionally does not show pesticide products");
    expect(guidance.treatment).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|ppm|%|lit(?:er|re)s?)\b|every\s+\d+/i);
    expect(guidance.monitor).toHaveLength(2);
    expect(VERIFIED_GUIDANCE_DIAGNOSES).toEqual([
      "tomato early blight", "early blight of tomato", "potato late blight", "late blight of potato", "tomato late blight", "late blight of tomato", "northern corn leaf blight", "turcicum leaf blight", "northern leaf blight of corn",
    ]);
  });

  it("does not infer disease-specific guidance for an unmapped valid diagnosis", () => {
    const guidance = getDiseaseGuidance({ status: "unsupported", crop: "unknown", diagnosisId: "unsupported", diagnosis: "Unsupported condition", confidence: 0.84, uncertain: true });
    expect(guidance).toMatchObject({
      hasVerifiedGuidance: false,
      source: null,
      treatment: VERIFIED_TREATMENT_UNAVAILABLE,
    });
    expect(guidance.whatToDoNow.join(" ")).toContain("agricultural expert");
    expect(guidance.whatToAvoid.join(" ")).toContain("disease-specific treatment");
  });

  it("uses the provider uncertainty flag as a stronger caution and suppresses disease-specific guidance", () => {
    const guidance = getDiseaseGuidance({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_early_blight", diagnosis: "Tomato early blight", confidence: 0.34, uncertain: true });
    expect(guidance).toMatchObject({
      hasVerifiedGuidance: false,
      source: null,
      treatment: VERIFIED_TREATMENT_UNAVAILABLE,
    });
    expect(guidance.caution).toContain("Uncertain result");
    expect(guidance.whatToDoNow.join(" ")).toContain("Upload another clear image");
  });
});
