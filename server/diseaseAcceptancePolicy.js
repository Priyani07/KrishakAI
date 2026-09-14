import { DISEASE_RESULT_STATUS, SYMPTOM_EVIDENCE_STATUS, normalizeDiseaseValue } from "../shared/diseaseTaxonomy.js";

/**
 * CROP ACCEPTANCE POLICY
 * ======================
 *
 * Controls which crops are permitted to flow through the full disease-result
 * pipeline to the caller. Two evidence tiers are used:
 *
 * LIVE_VERIFIED  — Kindwise class IDs captured from real authorised API
 *                  responses (2026-08-22) and manually reviewed in
 *                  shared/kindwiseDiseaseMappings.js. Full treatment guidance
 *                  is available for the reviewed disease classes.
 *
 * KINDWISE_INFERENCE_ENABLED — Crops in Kindwise's documented 80+ plant-
 *                  species taxonomy. The acceptance gate is open so Kindwise
 *                  runs real inference and returns its own disease name.
 *                  Results carry guidanceStatus:"unavailable" until class IDs
 *                  are individually reviewed and treatment guidance is sourced
 *                  from a verified agricultural publication.
 *
 * How crop names are matched:
 *   gateCrop = what the Gemini image gate identifies (free-form string,
 *              normalised to lowercase-trim by normalizeDiseaseValue).
 *   providerCrop = what Kindwise identifies from the same image.
 *   Both must resolve to the SAME key in this policy; if they disagree the
 *   result is suppressed (reasonCode: "crop_mismatch").
 *   Aliases for the same plant (e.g. "corn"/"maize") are separate entries so
 *   each common name the gate or provider might return is accepted.
 *
 * DO NOT invent class IDs for entries below. Disease names for INFERENCE_ENABLED
 * crops come directly from Kindwise's own taxonomy via the existing fallback
 * path in normalizeKindwiseCropHealthResult.
 */
export const CROP_ACCEPTANCE_POLICY = {
  // ── LIVE_VERIFIED ──────────────────────────────────────────────────────────
  // Reviewed class ID mappings in shared/kindwiseDiseaseMappings.js.
  // Treatment guidance available for reviewed disease classes.
  tomato:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  potato:         { supportedPlantParts: ["leaf"] },
  corn:           { supportedPlantParts: ["leaf"] },

  // ── KINDWISE_INFERENCE_ENABLED ─────────────────────────────────────────────
  // Kindwise crop.health API documents 80+ plant species.
  // Acceptance gate opened; Kindwise provides real inference for these crops.
  // Disease names come from Kindwise's own classification (not invented).
  // guidanceStatus will be "unavailable" until class IDs are individually
  // reviewed and treatment guidance is added to diseaseTaxonomy.js.

  // Cereals / Grains
  wheat:          { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  rice:           { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  maize:          { supportedPlantParts: ["leaf", "cob", "whole_plant", "multiple_parts"] },
  barley:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  oat:            { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  sorghum:        { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  millet:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  "pearl millet": { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  "finger millet": { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  rye:            { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Legumes / Pulses
  soybean:        { supportedPlantParts: ["leaf", "stem", "pod", "whole_plant", "multiple_parts"] },
  chickpea:       { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  pea:            { supportedPlantParts: ["leaf", "stem", "pod", "whole_plant", "multiple_parts"] },
  lentil:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  groundnut:      { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  peanut:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  cowpea:         { supportedPlantParts: ["leaf", "stem", "pod", "whole_plant", "multiple_parts"] },
  "pigeon pea":   { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  "mung bean":    { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  "black gram":   { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Oilseeds / Fiber
  sunflower:      { supportedPlantParts: ["leaf", "stem", "flower", "whole_plant", "multiple_parts"] },
  mustard:        { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  canola:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  cotton:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  sesame:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  flax:           { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Industrial / Plantation
  sugarcane:      { supportedPlantParts: ["stem", "leaf", "whole_plant", "multiple_parts"] },
  tea:            { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  coffee:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  coconut:        { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  rubber:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Vegetables — Solanaceae
  chilli:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  pepper:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  "bell pepper":  { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  capsicum:       { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  eggplant:       { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  brinjal:        { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },

  // Vegetables — Cucurbits
  cucumber:       { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  watermelon:     { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  pumpkin:        { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  squash:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  "bitter melon": { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  "bitter gourd": { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  "bottle gourd": { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  muskmelon:      { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },

  // Vegetables — Other
  cabbage:        { supportedPlantParts: ["leaf", "whole_plant", "multiple_parts"] },
  cauliflower:    { supportedPlantParts: ["leaf", "whole_plant", "multiple_parts"] },
  okra:           { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  onion:          { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  garlic:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  carrot:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  radish:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  coriander:      { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Fruits — Temperate / Berry
  apple:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  grape:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  strawberry:     { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  peach:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  cherry:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  blueberry:      { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  raspberry:      { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  pear:           { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  avocado:        { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },

  // Fruits — Tropical
  banana:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  mango:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  papaya:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  guava:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  pomegranate:    { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },

  // Fruits — Citrus
  orange:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  citrus:         { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  lemon:          { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },
  lime:           { supportedPlantParts: ["leaf", "stem", "fruit", "whole_plant", "multiple_parts"] },

  // Root / Tuber
  cassava:        { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  "sweet potato": { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },

  // Spices / Aromatics
  ginger:         { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
  turmeric:       { supportedPlantParts: ["leaf", "stem", "whole_plant", "multiple_parts"] },
};

const UNKNOWN_POLICY_NOTE = "The crop or condition could not be confirmed consistently enough for a reliable result. Please upload a focused photo of the affected part and verify the condition with an agricultural expert or laboratory before treatment.";
const CROP_CONFLICT_NOTE = "The crop identification from the image does not agree with the provider result, so no disease conclusion is shown. Please upload a focused photo of the affected part.";
const HEALTH_CONFLICT_NOTE = "No visible symptoms were confirmed in the image, so a disease indication is not shown. Continue monitoring and upload a clear symptom photo if the crop condition changes.";
const PART_EVIDENCE_NOTE = "The visible plant part is not yet verified as sufficient for this crop's reviewed condition. Please upload a clear close-up of the affected part.";

function normalized(value) {
  return typeof value === "string" ? normalizeDiseaseValue(value) : "unknown";
}

const CROP_ALIASES = Object.freeze({
  maize: "corn", peanut: "groundnut", brinjal: "eggplant", aubergine: "eggplant",
  capsicum: "bell pepper", "sweet pepper": "bell pepper", pigeonpea: "pigeon pea",
  arhar: "pigeon pea", tur: "pigeon pea", mungbean: "mung bean", "green gram": "mung bean",
  urad: "black gram", bajra: "pearl millet", ragi: "finger millet",
  sweetpotato: "sweet potato", chili: "chilli",
});

export function canonicalizeCropName(value) {
  const name = normalized(value);
  return CROP_ALIASES[name] || name;
}

export function evaluateCropSpecificAcceptance({ normalizedResult, imageGate, providerResult }) {
  const gateCrop = canonicalizeCropName(imageGate?.crop);
  const providerCrop = canonicalizeCropName(providerResult?.crop?.name);
  const policy = CROP_ACCEPTANCE_POLICY[gateCrop];
  const cropMatches = gateCrop !== "unknown" && providerCrop === gateCrop;
  const hasSupportedPart = Array.isArray(imageGate?.plantParts)
    && Boolean(policy?.supportedPlantParts.some((part) => imageGate.plantParts.includes(part)));
  const symptomEvidence = imageGate?.symptomEvidence || SYMPTOM_EVIDENCE_STATUS.UNCLEAR;

  if (!policy) return { accepted: false, reason: UNKNOWN_POLICY_NOTE, reasonCode: "crop_outside_reviewed_scope" };
  if (!cropMatches) return { accepted: false, reason: CROP_CONFLICT_NOTE, reasonCode: "crop_mismatch" };
  if (!hasSupportedPart) return { accepted: false, reason: PART_EVIDENCE_NOTE, reasonCode: "unsupported_plant_part" };

  if (normalizedResult?.status === DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE) {
    return symptomEvidence === SYMPTOM_EVIDENCE_STATUS.NO_VISIBLE_SYMPTOMS
      ? { accepted: true, reason: null, reasonCode: null }
      : { accepted: false, reason: HEALTH_CONFLICT_NOTE, reasonCode: "healthy_conflicts_with_visible_or_unclear_symptoms" };
  }

  if (symptomEvidence !== SYMPTOM_EVIDENCE_STATUS.VISIBLE_SYMPTOMS) {
    return { accepted: false, reason: HEALTH_CONFLICT_NOTE, reasonCode: "disease_without_visible_symptoms" };
  }

  return { accepted: true, reason: null, reasonCode: null };
}
