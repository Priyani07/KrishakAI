import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiseaseActionGuidance } from "../client/src/components/DiseaseActionGuidance.jsx";
import { getDiseaseGuidance } from "../client/src/services/diseaseGuidance.js";
import { getDiseaseKnowledge } from "../shared/diseaseTaxonomy.js";

const approvedMappings = [
  { crop: "potato", providerCropClassId: "2746768c8d99bfbb", providerClassId: "b9ec757fefb92520", diagnosisId: "potato_late_blight", diagnosis: "Potato Late Blight", sourceHost: "extension.umn.edu" },
  { crop: "tomato", providerCropClassId: "c4f0d775e03dd7fd", providerClassId: "b9ec757fefb92520", diagnosisId: "tomato_late_blight", diagnosis: "Tomato Late Blight", sourceHost: "extension.umn.edu" },
  { crop: "corn", providerCropClassId: "9f2cfa1d346260e0", providerClassId: "8cc41a5ca8d30d4f", diagnosisId: "corn_northern_leaf_blight", diagnosis: "Northern Corn Leaf Blight", sourceHost: "udel.edu" },
];

describe("expanded Kindwise source-backed mappings", () => {
  it.each(approvedMappings)("keeps exact provider identifiers, crop, canonical diagnosis, and at least one guidance source for $diagnosis", (mapping) => {
    const knowledge = getDiseaseKnowledge(mapping.diagnosisId);
    expect(knowledge).toMatchObject({ crop: mapping.crop, diagnosisId: mapping.diagnosisId, displayName: mapping.diagnosis, source: expect.objectContaining({ url: expect.stringContaining(mapping.sourceHost) }) });
    expect(knowledge.sources?.length).toBeGreaterThan(0);
  });

  it.each(approvedMappings)("renders existing generic source-backed guidance for a certain mapped $diagnosis", (mapping) => {
    const result = { status: "valid_leaf", crop: mapping.crop, diagnosisId: mapping.diagnosisId, diagnosis: mapping.diagnosis, confidence: 0.9, uncertain: false };
    const guidance = getDiseaseGuidance(result);
    const markup = renderToStaticMarkup(createElement(DiseaseActionGuidance, { result, onCheckAnother: () => {} }));
    expect(guidance).toMatchObject({ hasVerifiedGuidance: true, source: expect.objectContaining({ url: expect.stringContaining(mapping.sourceHost) }) });
    expect(guidance.treatment).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|ppm|%|lit(?:er|re)s?)\b|every\s+\d+/i);
    expect(markup).toContain("TREATMENT GUIDANCE");
    expect(markup).toContain("Verified source:");
  });

  it("still suppresses all disease-specific guidance when an approved mapping is uncertain", () => {
    const guidance = getDiseaseGuidance({ status: "valid_leaf", crop: "potato", diagnosisId: "potato_late_blight", diagnosis: "Potato Late Blight", confidence: 0.9, uncertain: true });
    expect(guidance).toMatchObject({ hasVerifiedGuidance: false, source: null });
  });
});
