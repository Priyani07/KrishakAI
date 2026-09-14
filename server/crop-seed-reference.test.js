import { describe, expect, it } from "vitest";
import {
  CROP_REFERENCE_REGISTRY,
  DEMO_CATALOGUE_SOURCE,
  filterReferenceSeeds,
  getCropReferenceGuidance,
  LOCAL_REFERENCE_SOURCE,
  SEED_REFERENCE_CATALOGUE,
} from "../client/src/cropSeedReferenceRegistry.js";

describe("crop reference registry", () => {
  it("returns a local reference direction only for a stored crop and soil combination", () => {
    const result = getCropReferenceGuidance("Loamy", "Wheat");
    expect(result.status).toBe("available");
    expect(result.entry).toMatchObject({ cropName: "Wheat", soilTypes: ["Loamy"], referenceDirection: "Wheat", source: LOCAL_REFERENCE_SOURCE });
  });

  it("changes the stored reference result when a selection changes", () => {
    expect(getCropReferenceGuidance("Loamy", "Wheat").entry.referenceDirection).not.toBe(getCropReferenceGuidance("Loamy", "Rice").entry.referenceDirection);
  });

  it("keeps incomplete and unsupported input combinations as honest no-direction states", () => {
    expect(getCropReferenceGuidance("", "Wheat")).toMatchObject({ status: "incomplete" });
    expect(getCropReferenceGuidance("Unknown", "Wheat")).toMatchObject({ status: "unavailable" });
  });

  it("records source and limitation metadata without falsely labelling the local ruleset as AI", () => {
    CROP_REFERENCE_REGISTRY.forEach((entry) => {
      expect(entry).toHaveProperty("source", LOCAL_REFERENCE_SOURCE);
      expect(entry.limitations).toContain("does not include");
      expect(JSON.stringify(entry)).not.toMatch(/AI recommendation|ML prediction|best crop|guaranteed/i);
    });
  });
});

describe("hybrid seed reference catalogue", () => {
  it("filters entries by crop, soil, and their combined selection", () => {
    expect(filterReferenceSeeds({ crop: "Wheat" })).toHaveLength(1);
    expect(filterReferenceSeeds({ soil: "Sandy" })).toHaveLength(2);
    expect(filterReferenceSeeds({ crop: "Millet", soil: "Sandy" })).toMatchObject([{ id: "hybrid-seed-620" }]);
  });

  it("returns an honest empty result for an unmatched crop and soil filter", () => {
    expect(filterReferenceSeeds({ crop: "Wheat", soil: "Black" })).toEqual([]);
  });

  it("uses complete reference catalogue records and neutral descriptions", () => {
    SEED_REFERENCE_CATALOGUE.forEach((entry) => {
      expect(entry).toMatchObject({ source: DEMO_CATALOGUE_SOURCE, sourceUrl: null, reviewDate: null, catalogueStatus: "reference_demo_unverified" });
      expect(entry.id).toBeTruthy();
      expect(entry.soilTypes.length).toBeGreaterThan(0);
      expect(`${entry.name} ${entry.description} ${entry.limitations}`).not.toMatch(/high-yield|disease-resistant|drought-resistant|best seed|premium|guaranteed/i);
    });
  });
});
