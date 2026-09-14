import { describe, expect, it } from "vitest";
import { normalizeKindwiseCropHealthResult } from "./disease.js";

describe("Kindwise Disease Detection normalization", () => {
  it.each([
    ["tomato early blight", "c4f0d775e03dd7fd", "tomato", "a9bf74348b28ad62", "early blight", "tomato_early_blight", "Tomato Early Blight"],
    ["potato late blight", "2746768c8d99bfbb", "potato", "b9ec757fefb92520", "late blight", "potato_late_blight", "Potato Late Blight"],
    ["tomato late blight", "c4f0d775e03dd7fd", "tomato", "b9ec757fefb92520", "late blight", "tomato_late_blight", "Tomato Late Blight"],
    ["northern corn leaf blight", "9f2cfa1d346260e0", "corn", "8cc41a5ca8d30d4f", "northern corn leaf blight", "corn_northern_leaf_blight", "Northern Corn Leaf Blight"],
  ])("maps the exact live-verified %s crop-and-class ID pair to its reviewed Krishak record", (_label, cropId, cropName, diseaseId, diseaseName, diagnosisId, diagnosis) => {
    const result = normalizeKindwiseCropHealthResult({
      isPlant: true,
      isPlantProbability: 0.99,
      crop: { id: cropId, name: cropName, scientificName: "Verified provider crop", probability: 0.96 },
      disease: { id: diseaseId, name: diseaseName, scientificName: "Verified provider pathogen", probability: 0.91 },
    });
    expect(result).toMatchObject({
      provider: "crop.health",
      providerType: "kindwise-crop-health",
      status: "valid_leaf",
      crop: cropName,
      diagnosisId,
      diagnosis,
      guidanceStatus: "available",
      providerClassId: diseaseId,
      providerCropClassId: cropId,
    });
  });

  it("preserves an actual valid but unreviewed provider condition without inventing a Krishak diagnosis or treatment", () => {
    const result = normalizeKindwiseCropHealthResult({
      isPlant: true,
      isPlantProbability: 0.95,
      crop: { id: "crop-unknown", name: "potato", scientificName: "Solanum tuberosum", probability: 0.94 },
      disease: { id: "provider-class-unknown", name: "late blight", scientificName: "Phytophthora infestans", probability: 0.88 },
    });
    expect(result).toMatchObject({
      status: "valid_leaf",
      crop: "potato",
      diagnosisId: "unreviewed_provider_condition",
      diagnosis: "late blight",
      confidence: 0.88,
      guidanceStatus: "unavailable",
      providerClassId: "provider-class-unknown",
    });
    expect(result.note).toContain("detailed treatment guidance from a verified agricultural source is not yet available");
  });

  it("accepts healthy only from the exact verified Kindwise healthy class ID", () => {
    const healthy = normalizeKindwiseCropHealthResult({
      isPlant: true,
      isPlantProbability: 0.99,
      crop: { id: "crop-1", name: "tomato", scientificName: "Solanum lycopersicum", probability: 0.9 },
      disease: { id: "c35556c0c67c0591", name: "healthy", scientificName: "healthy", probability: 0.98 },
    });
    expect(healthy).toMatchObject({ status: "healthy_or_no_visible_disease", diagnosisId: "healthy", uncertain: false });

    const unverifiedHealthyName = normalizeKindwiseCropHealthResult({
      isPlant: true,
      isPlantProbability: 0.99,
      crop: { id: "crop-1", name: "tomato", scientificName: "Solanum lycopersicum", probability: 0.9 },
      disease: { id: "not-verified", name: "healthy", scientificName: "healthy", probability: 0.98 },
    });
    expect(unverifiedHealthyName).toMatchObject({ status: "valid_leaf", diagnosisId: "unreviewed_provider_condition", guidanceStatus: "unavailable" });
  });

  it("keeps an actual non-plant result on the safe existing not-a-plant path", () => {
    expect(normalizeKindwiseCropHealthResult({ isPlant: false, isPlantProbability: 0.79 })).toMatchObject({
      status: "not_a_plant_image",
      diagnosisId: "unsupported",
      uncertain: true,
      provider: "crop.health",
    });
  });
});
