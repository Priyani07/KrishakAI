import { describe, expect, it } from "vitest";
import {
  EXPECTED_CLASS_COUNT,
  MODEL_ASSETS,
  applyPlantVillageSecondaryValidation,
  canRunLocalSecondaryValidator,
  createPlantVillageSecondaryValidator,
  decodeLocalPlantVillageOutput,
  getLocalPlantVillageMapping,
  reconcilePrimaryWithLocalSecondary,
} from "../client/src/services/plantVillageSecondaryValidator.js";

const labels = Object.freeze({
  0: "Apple___Apple_scab", 1: "Apple___Black_rot", 2: "Apple___Cedar_apple_rust", 3: "Apple___healthy", 4: "Blueberry___healthy", 5: "Cherry_(including_sour)___Powdery_mildew", 6: "Cherry_(including_sour)___healthy", 7: "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", 8: "Corn_(maize)___Common_rust_", 9: "Corn_(maize)___Northern_Leaf_Blight", 10: "Corn_(maize)___healthy", 11: "Grape___Black_rot", 12: "Grape___Esca_(Black_Measles)", 13: "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", 14: "Grape___healthy", 15: "Orange___Haunglongbing_(Citrus_greening)", 16: "Peach___Bacterial_spot", 17: "Peach___healthy", 18: "Pepper,_bell___Bacterial_spot", 19: "Pepper,_bell___healthy", 20: "Potato___Early_blight", 21: "Potato___Late_blight", 22: "Potato___healthy", 23: "Raspberry___healthy", 24: "Soybean___healthy", 25: "Squash___Powdery_mildew", 26: "Strawberry___Leaf_scorch", 27: "Strawberry___healthy", 28: "Tomato___Bacterial_spot", 29: "Tomato___Early_blight", 30: "Tomato___Late_blight", 31: "Tomato___Leaf_Mold", 32: "Tomato___Septoria_leaf_spot", 33: "Tomato___Spider_mites Two-spotted_spider_mite", 34: "Tomato___Target_Spot", 35: "Tomato___Tomato_Yellow_Leaf_Curl_Virus", 36: "Tomato___Tomato_mosaic_virus", 37: "Tomato___healthy",
});

const primaryTomatoLateBlight = Object.freeze({ status: "valid_leaf", crop: "tomato", diagnosisId: "tomato_late_blight", diagnosis: "Tomato Late Blight", confidence: 0.82, uncertain: false, guidanceStatus: "available" });
const localTomatoLateBlight = Object.freeze({ classIndex: 30, rawLabel: "Tomato___Late_blight", confidence: 0.74, mapping: getLocalPlantVillageMapping("Tomato___Late_blight") });

describe("PlantVillage Local38 secondary validator", () => {
  it("pins the exact controlled model asset sizes, hashes, and three-shard delivery contract", () => {
    expect(MODEL_ASSETS.model.bytes).toBe(120725);
    expect(MODEL_ASSETS.shards.map((asset) => asset.bytes)).toEqual([4194304, 4194304, 838040]);
    expect(MODEL_ASSETS.shards.map((asset) => asset.sha256)).toEqual([
      "e5f5839e8e0a6817ced84b550f298aa36d6231a8d11c4e845712536f897426e2",
      "b72ad56c0fdd9d1fbbbe7b36a1c9d66313451cd88ba5a56b26f8d44f336e15bb",
      "7918344c65af71c09f36a9ef406ed600458a385e9755c9a3e64829da1bff3dec",
    ]);
    expect(MODEL_ASSETS.labels.sha256).toBe("34df284e2554a15f82a4884be26ab22fa4198b1a16cee79dac9a9c85a050f6ef");
  });

  it("decodes the exact 38-label mapping and preserves raw model labels", () => {
    expect(Object.values(labels)).toHaveLength(EXPECTED_CLASS_COUNT);
    expect(new Set(Object.values(labels)).size).toBe(EXPECTED_CLASS_COUNT);
    const probabilities = Array(EXPECTED_CLASS_COUNT).fill(0.001);
    probabilities[36] = 0.93;
    const decoded = decodeLocalPlantVillageOutput(probabilities, labels);
    expect(decoded).toMatchObject({ classIndex: 36, rawLabel: "Tomato___Tomato_mosaic_virus", confidence: 0.93, mapping: null });
    expect(getLocalPlantVillageMapping("Tomato___Tomato_mosaic_virus")).toBeNull();
    expect(getLocalPlantVillageMapping("Tomato___Late_blight")).toEqual({ crop: "tomato", diagnosisId: "tomato_late_blight", kind: "disease" });
    expect(() => decodeLocalPlantVillageOutput([0.2], labels)).toThrow("invalid output");
  });

  it("uses a single lazy runtime/model load and disposes only inference tensors between attempts", async () => {
    const calls = { runtime: 0, assets: 0, model: 0, input: 0, inputDispose: 0, predictionDispose: 0, modelDispose: 0 };
    const tf = {};
    const validator = createPlantVillageSecondaryValidator({
      loadRuntime: async () => {
        calls.runtime += 1;
        return { tf, loadLayersModel: async () => { calls.model += 1; return { predict: () => ({ data: async () => Array.from({ length: EXPECTED_CLASS_COUNT }, (_, index) => index === 30 ? 0.91 : 0), dispose: () => { calls.predictionDispose += 1; } }), dispose: () => { calls.modelDispose += 1; } }; } };
      },
      loadAssets: async () => { calls.assets += 1; return { labels, artifacts: {} }; },
      prepareInput: async () => { calls.input += 1; return { dispose: () => { calls.inputDispose += 1; } }; },
    });
    const [firstLoad, secondLoad] = await Promise.all([validator.load(), validator.load()]);
    expect(firstLoad).toBe(secondLoad);
    expect(calls).toMatchObject({ runtime: 1, assets: 1, model: 1 });
    await validator.infer({});
    await validator.infer({});
    expect(calls).toMatchObject({ input: 2, inputDispose: 2, predictionDispose: 2, model: 1 });
    validator.dispose();
    expect(calls.modelDispose).toBe(1);
  });

  it("resets a failed lazy-load promise so a later local retry can succeed independently", async () => {
    let attempts = 0;
    const validator = createPlantVillageSecondaryValidator({
      loadRuntime: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("webgl unavailable");
        return { tf: {}, loadLayersModel: async () => ({ dispose: () => {} }) };
      },
      loadAssets: async () => ({ labels, artifacts: {} }),
    });
    await expect(validator.load()).rejects.toThrow("webgl unavailable");
    await expect(validator.load()).resolves.toMatchObject({ labels });
    expect(attempts).toBe(2);
  });

  it("keeps Kindwise primary on agreement and marks only corroboration", () => {
    expect(reconcilePrimaryWithLocalSecondary(primaryTomatoLateBlight, localTomatoLateBlight)).toEqual({ ...primaryTomatoLateBlight, secondaryValidation: "confirmed" });
  });

  it("returns a safe uncertain result for disease, crop, and healthy conflicts without selecting a winner", () => {
    const diseaseConflict = reconcilePrimaryWithLocalSecondary(primaryTomatoLateBlight, { ...localTomatoLateBlight, mapping: getLocalPlantVillageMapping("Tomato___Early_blight") });
    const cropConflict = reconcilePrimaryWithLocalSecondary(primaryTomatoLateBlight, { ...localTomatoLateBlight, mapping: getLocalPlantVillageMapping("Potato___Late_blight") });
    const healthyPrimary = { status: "healthy_or_no_visible_disease", crop: "tomato", diagnosisId: "healthy", diagnosis: "Healthy / no visible disease", confidence: 0.79, uncertain: false };
    const healthyConflict = reconcilePrimaryWithLocalSecondary(healthyPrimary, localTomatoLateBlight);
    [diseaseConflict, cropConflict, healthyConflict].forEach((result) => {
      expect(result).toMatchObject({ status: "unknown", diagnosisId: "unknown", diagnosis: "Uncertain / conflicting results", uncertain: true, guidanceStatus: "unavailable", secondaryValidation: "conflict" });
      expect(result.note).toContain("conflicting analysis results");
    });
  });

  it("keeps Kindwise primary when local validation is not applicable or unavailable", () => {
    const unsupportedPrimary = { status: "valid_leaf", crop: "tomato", diagnosisId: "unreviewed_provider_condition", diagnosis: "Unreviewed condition" };
    expect(canRunLocalSecondaryValidator(unsupportedPrimary)).toBe(false);
    expect(reconcilePrimaryWithLocalSecondary(unsupportedPrimary, localTomatoLateBlight)).toEqual({ ...unsupportedPrimary, secondaryValidation: "not_applicable" });
    expect(reconcilePrimaryWithLocalSecondary(primaryTomatoLateBlight, { rawLabel: "Tomato___Tomato_mosaic_virus", mapping: null })).toEqual({ ...primaryTomatoLateBlight, secondaryValidation: "not_applicable" });
  });

  it("isolates local inference failure and never turns the secondary model into a provider fallback", async () => {
    const localFailure = await applyPlantVillageSecondaryValidation(primaryTomatoLateBlight, {}, async () => { throw new Error("local artifact unavailable"); });
    const providerUnavailable = await applyPlantVillageSecondaryValidation({ status: "unknown", crop: "unknown", diagnosisId: "unknown", diagnosis: "Unknown condition" }, {}, async () => { throw new Error("must not run"); });
    expect(localFailure).toEqual({ ...primaryTomatoLateBlight, secondaryValidation: "unavailable" });
    expect(providerUnavailable).toEqual({ status: "unknown", crop: "unknown", diagnosisId: "unknown", diagnosis: "Unknown condition", secondaryValidation: "not_applicable" });
  });
});
