export const KINDWISE_CROP_HEALTH_PROVIDER = "kindwise-crop-health";
export const KINDWISE_CROP_HEALTH_PROVIDER_NAME = "crop.health";

// These identifiers are exact provider IDs observed in an authorized live Kindwise
// response on 2026-08-22. They are intentionally separate from Krishak's canonical
// taxonomy and are mapped only after a one-to-one source and crop review.
export const REVIEWED_KINDWISE_DISEASE_MAPPINGS = [
  {
    providerDiseaseClassId: "a9bf74348b28ad62",
    providerCropClassId: "c4f0d775e03dd7fd",
    providerDiseaseName: "early blight",
    providerCropName: "tomato",
    canonicalDiagnosisId: "tomato_early_blight",
  },
  {
    providerDiseaseClassId: "b9ec757fefb92520",
    providerCropClassId: "2746768c8d99bfbb",
    providerDiseaseName: "late blight",
    providerCropName: "potato",
    canonicalDiagnosisId: "potato_late_blight",
  },
  {
    providerDiseaseClassId: "b9ec757fefb92520",
    providerCropClassId: "c4f0d775e03dd7fd",
    providerDiseaseName: "late blight",
    providerCropName: "tomato",
    canonicalDiagnosisId: "tomato_late_blight",
  },
  {
    providerDiseaseClassId: "8cc41a5ca8d30d4f",
    providerCropClassId: "9f2cfa1d346260e0",
    providerDiseaseName: "northern corn leaf blight",
    providerCropName: "corn",
    canonicalDiagnosisId: "corn_northern_leaf_blight",
  },
];

// A healthy result is accepted only for this exact provider class ID, verified from
// a live response. Name-based healthy matching is intentionally not used.
export const VERIFIED_KINDWISE_HEALTHY_CLASS_IDS = ["c35556c0c67c0591"];

export function getReviewedKindwiseDiseaseMapping({ providerDiseaseClassId, providerCropClassId }) {
  return REVIEWED_KINDWISE_DISEASE_MAPPINGS.find((mapping) => (
    mapping.providerDiseaseClassId === providerDiseaseClassId
    && mapping.providerCropClassId === providerCropClassId
  )) || null;
}

export function isVerifiedKindwiseHealthyClassId(providerDiseaseClassId) {
  return VERIFIED_KINDWISE_HEALTHY_CLASS_IDS.includes(providerDiseaseClassId);
}
