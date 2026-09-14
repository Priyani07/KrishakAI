/**
 * CROP DISEASE SUPPORT REGISTRY
 * ==============================
 *
 * Machine-readable registry documenting the GENUINE disease-detection
 * capability of each provider in the Krishak system.
 *
 * HONESTY CONTRACT:
 * -----------------
 * Three evidence tiers are used:
 *
 * KINDWISE_LIVE_CLASS_ID
 *   At least one Kindwise class ID for this crop was captured from a real
 *   authorised live API response (2026-08-22) and manually reviewed in
 *   shared/kindwiseDiseaseMappings.js. Full treatment guidance from a
 *   verified agricultural publication is available for reviewed disease classes.
 *   supported: true   inferenceEnabled: true   acceptancePolicyEnabled: true
 *
 * KINDWISE_INFERENCE_ENABLED
 *   Crop is in Kindwise's documented 80+ plant-species API taxonomy. The
 *   acceptance policy in server/diseaseAcceptancePolicy.js is open, so Kindwise
 *   runs REAL inference and returns its own disease name from its own taxonomy.
 *   No Kindwise class IDs have been individually reviewed yet, so results carry
 *   guidanceStatus:"unavailable" until class IDs are captured and reviewed.
 *   supported: false  inferenceEnabled: true   acceptancePolicyEnabled: true
 *
 * KINDWISE_DOCUMENTED_ONLY
 *   Documented by Kindwise but NOT yet enabled in the acceptance policy.
 *   Results for this crop will fall through to the "unknown" path.
 *   supported: false  inferenceEnabled: false  acceptancePolicyEnabled: false
 *
 * UNSUPPORTED
 *   Not supported by current providers.
 *   supported: false  inferenceEnabled: false  acceptancePolicyEnabled: false
 *
 * HONESTY RULES:
 *   - supported:true ONLY for KINDWISE_LIVE_CLASS_ID.
 *   - inferenceEnabled:true for LIVE_CLASS_ID + INFERENCE_ENABLED.
 *   - Disease names for INFERENCE_ENABLED crops come from Kindwise's own
 *     taxonomy via the existing normalizeKindwiseCropHealthResult fallback
 *     path. They are NOT invented by Krishak.
 *   - Aliases (e.g. "maize" / "corn") are stored in the aliases field;
 *     they are NOT separate canonical entries.
 *
 * TO PROMOTE A CROP FROM INFERENCE_ENABLED TO LIVE_CLASS_ID:
 *   1. Obtain a real KINDWISE_API_KEY.
 *   2. Submit an image of that crop to the Kindwise endpoint.
 *   3. Capture the actual disease.suggestions[0].id and crop.suggestions[0].id.
 *   4. Add the mapping to shared/kindwiseDiseaseMappings.js.
 *   5. Add a knowledge-base entry to shared/diseaseTaxonomy.js with a verified
 *      agricultural source.
 *   6. Set supportEvidence to KINDWISE_LIVE_CLASS_ID and supported to true here.
 *   7. Add diagnosisId to verifiedDiseaseIds.
 *
 * CURRENT TOTALS (as of 2026-09-11):
 *   LIVE_CLASS_ID verified:    3 crops  (tomato, potato, corn)
 *   INFERENCE_ENABLED:        63 crops  (acceptance policy open; real Kindwise inference)
 *   Total inference-enabled:  66 crops
 */

/**
 * How a crop's disease-detection capability was established.
 * @enum {string}
 */
export const SUPPORT_EVIDENCE = Object.freeze({
  /**
   * At least one Kindwise class ID captured from a real authorised live API
   * response and reviewed in shared/kindwiseDiseaseMappings.js.
   * Full treatment guidance available for reviewed disease classes.
   */
  KINDWISE_LIVE_CLASS_ID: "kindwise_live_class_id",

  /**
   * Crop is in Kindwise's documented 80+ plant-species API taxonomy.
   * Acceptance policy is open; Kindwise runs real inference and returns its
   * own disease name. No class IDs reviewed yet — guidanceStatus:"unavailable".
   */
  KINDWISE_INFERENCE_ENABLED: "kindwise_inference_enabled",

  /**
   * Documented by Kindwise but acceptance policy not yet expanded.
   * Results fall through to the unknown path.
   */
  KINDWISE_DOCUMENTED_ONLY: "kindwise_documented_only",

  /**
   * Not supported by current providers.
   */
  UNSUPPORTED: "unsupported",
});

/**
 * @typedef {Object} CropSupportEntry
 * @property {string}   canonicalId            - Canonical crop ID in the Krishak system.
 * @property {string[]} aliases                - Other common names (not separate entries).
 * @property {string}   providerCropName       - Crop name as the provider identifies it.
 * @property {string}   provider               - Primary provider for this crop.
 * @property {string}   supportEvidence        - One of SUPPORT_EVIDENCE values.
 * @property {boolean}  supported              - True ONLY if KINDWISE_LIVE_CLASS_ID.
 * @property {boolean}  inferenceEnabled       - True for LIVE_CLASS_ID + INFERENCE_ENABLED.
 * @property {boolean}  acceptancePolicyEnabled - True if crop is in CROP_ACCEPTANCE_POLICY.
 * @property {string[]} verifiedDiseaseIds     - Canonical disease IDs with reviewed class IDs.
 * @property {string}   evidenceNote           - Human-readable evidence summary.
 */

// Single shared evidence note for all KINDWISE_INFERENCE_ENABLED entries.
const INFERENCE_ENABLED_NOTE =
  "Kindwise crop.health API documents 80+ plant species. " +
  "Acceptance policy opened 2026-09-11. Kindwise runs real inference; " +
  "disease names come from Kindwise's own taxonomy. " +
  "No class IDs reviewed yet — results carry guidanceStatus:\"unavailable\" " +
  "until class IDs are individually captured and reviewed.";

/** @type {Record<string, CropSupportEntry>} */
export const CROP_SUPPORT_REGISTRY = Object.freeze({

  // ═══════════════════════════════════════════════════════════════════════════
  // KINDWISE_LIVE_CLASS_ID  —  3 crops, real class IDs reviewed 2026-08-22
  // ═══════════════════════════════════════════════════════════════════════════

  tomato: {
    canonicalId: "tomato",
    aliases: ["Tomato", "Solanum lycopersicum"],
    providerCropName: "tomato",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_LIVE_CLASS_ID,
    supported: true,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: ["tomato_early_blight", "tomato_late_blight"],
    evidenceNote: "Live Kindwise API class IDs captured 2026-08-22. Crop class ID: c4f0d775e03dd7fd. Disease class IDs: a9bf74348b28ad62 (early blight), b9ec757fefb92520 (late blight). Reviewed in shared/kindwiseDiseaseMappings.js. Treatment guidance: UMN Extension.",
  },

  potato: {
    canonicalId: "potato",
    aliases: ["Potato", "Solanum tuberosum"],
    providerCropName: "potato",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_LIVE_CLASS_ID,
    supported: true,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: ["potato_late_blight"],
    evidenceNote: "Live Kindwise API class IDs captured 2026-08-22. Crop class ID: 2746768c8d99bfbb. Disease class ID: b9ec757fefb92520 (late blight). Reviewed in shared/kindwiseDiseaseMappings.js. Treatment guidance: UMN Extension / ICAR-CPRI.",
  },

  corn: {
    canonicalId: "corn",
    aliases: ["Corn", "Maize", "Zea mays"],
    providerCropName: "corn",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_LIVE_CLASS_ID,
    supported: true,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: ["corn_northern_leaf_blight"],
    evidenceNote: "Live Kindwise API class IDs captured 2026-08-22. Crop class ID: 9f2cfa1d346260e0. Disease class ID: 8cc41a5ca8d30d4f (northern leaf blight). Reviewed in shared/kindwiseDiseaseMappings.js. Treatment guidance: University of Delaware Extension.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KINDWISE_INFERENCE_ENABLED  —  63 crops
  // Kindwise runs real inference; disease names come from Kindwise's own
  // taxonomy. No class IDs individually reviewed yet.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Cereals / Grains ──────────────────────────────────────────────────────

  wheat: {
    canonicalId: "wheat",
    aliases: ["Wheat", "Triticum aestivum", "Gehun"],
    providerCropName: "wheat",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  rice: {
    canonicalId: "rice",
    aliases: ["Rice", "Oryza sativa", "Paddy", "Dhan"],
    providerCropName: "rice",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  maize: {
    canonicalId: "maize",
    aliases: ["Maize", "Corn (Maize variant)", "Zea mays", "Makka"],
    providerCropName: "maize",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE + " Note: \"corn\" (canonical) is live-verified; \"maize\" policy entry handles cases where Kindwise labels the crop as \"maize\".",
  },

  barley: {
    canonicalId: "barley",
    aliases: ["Barley", "Hordeum vulgare", "Jau"],
    providerCropName: "barley",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  oat: {
    canonicalId: "oat",
    aliases: ["Oat", "Oats", "Avena sativa", "Jai"],
    providerCropName: "oat",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  sorghum: {
    canonicalId: "sorghum",
    aliases: ["Sorghum", "Sorghum bicolor", "Jowar", "Great Millet"],
    providerCropName: "sorghum",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  millet: {
    canonicalId: "millet",
    aliases: ["Millet", "Bajra", "Pearl Millet", "Pennisetum glaucum"],
    providerCropName: "millet",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "pearl millet": {
    canonicalId: "pearl millet",
    aliases: ["Pearl Millet", "Bajra", "Pennisetum glaucum"],
    providerCropName: "pearl millet",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "finger millet": {
    canonicalId: "finger millet",
    aliases: ["Finger Millet", "Ragi", "Eleusine coracana", "Nachni"],
    providerCropName: "finger millet",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  rye: {
    canonicalId: "rye",
    aliases: ["Rye", "Secale cereale"],
    providerCropName: "rye",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Legumes / Pulses ──────────────────────────────────────────────────────

  soybean: {
    canonicalId: "soybean",
    aliases: ["Soybean", "Soya", "Glycine max"],
    providerCropName: "soybean",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  chickpea: {
    canonicalId: "chickpea",
    aliases: ["Chickpea", "Gram", "Chana", "Cicer arietinum"],
    providerCropName: "chickpea",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  pea: {
    canonicalId: "pea",
    aliases: ["Pea", "Garden Pea", "Pisum sativum", "Matar"],
    providerCropName: "pea",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  lentil: {
    canonicalId: "lentil",
    aliases: ["Lentil", "Masoor", "Lens culinaris"],
    providerCropName: "lentil",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  groundnut: {
    canonicalId: "groundnut",
    aliases: ["Groundnut", "Peanut", "Arachis hypogaea", "Moongphali"],
    providerCropName: "groundnut",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  peanut: {
    canonicalId: "peanut",
    aliases: ["Peanut", "Groundnut", "Arachis hypogaea"],
    providerCropName: "peanut",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  cowpea: {
    canonicalId: "cowpea",
    aliases: ["Cowpea", "Black-eyed Pea", "Vigna unguiculata", "Lobia"],
    providerCropName: "cowpea",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "pigeon pea": {
    canonicalId: "pigeon pea",
    aliases: ["Pigeon Pea", "Arhar", "Toor", "Cajanus cajan"],
    providerCropName: "pigeon pea",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "mung bean": {
    canonicalId: "mung bean",
    aliases: ["Mung Bean", "Moong", "Green Gram", "Vigna radiata"],
    providerCropName: "mung bean",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "black gram": {
    canonicalId: "black gram",
    aliases: ["Black Gram", "Urad", "Vigna mungo"],
    providerCropName: "black gram",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Oilseeds / Fiber ──────────────────────────────────────────────────────

  sunflower: {
    canonicalId: "sunflower",
    aliases: ["Sunflower", "Helianthus annuus", "Surajmukhi"],
    providerCropName: "sunflower",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  mustard: {
    canonicalId: "mustard",
    aliases: ["Mustard", "Sarson", "Brassica juncea", "Rapeseed-Mustard"],
    providerCropName: "mustard",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  canola: {
    canonicalId: "canola",
    aliases: ["Canola", "Rapeseed", "Brassica napus"],
    providerCropName: "canola",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  cotton: {
    canonicalId: "cotton",
    aliases: ["Cotton", "Gossypium hirsutum", "Kapas"],
    providerCropName: "cotton",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  sesame: {
    canonicalId: "sesame",
    aliases: ["Sesame", "Til", "Sesamum indicum", "Gingelly"],
    providerCropName: "sesame",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  flax: {
    canonicalId: "flax",
    aliases: ["Flax", "Linseed", "Linum usitatissimum", "Alsi"],
    providerCropName: "flax",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Industrial / Plantation ───────────────────────────────────────────────

  sugarcane: {
    canonicalId: "sugarcane",
    aliases: ["Sugarcane", "Saccharum officinarum", "Ganna"],
    providerCropName: "sugarcane",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  tea: {
    canonicalId: "tea",
    aliases: ["Tea", "Camellia sinensis", "Chai"],
    providerCropName: "tea",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  coffee: {
    canonicalId: "coffee",
    aliases: ["Coffee", "Coffea arabica", "Coffea canephora"],
    providerCropName: "coffee",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  coconut: {
    canonicalId: "coconut",
    aliases: ["Coconut", "Cocos nucifera", "Nariyal"],
    providerCropName: "coconut",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  rubber: {
    canonicalId: "rubber",
    aliases: ["Rubber", "Hevea brasiliensis", "Natural Rubber"],
    providerCropName: "rubber",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Vegetables — Solanaceae ───────────────────────────────────────────────

  chilli: {
    canonicalId: "chilli",
    aliases: ["Chilli", "Chili", "Hot Pepper", "Capsicum annuum", "Mirchi"],
    providerCropName: "chilli",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  pepper: {
    canonicalId: "pepper",
    aliases: ["Pepper", "Sweet Pepper", "Capsicum"],
    providerCropName: "pepper",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "bell pepper": {
    canonicalId: "bell pepper",
    aliases: ["Bell Pepper", "Capsicum", "Sweet Pepper", "Shimla Mirch"],
    providerCropName: "bell pepper",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  capsicum: {
    canonicalId: "capsicum",
    aliases: ["Capsicum", "Bell Pepper", "Shimla Mirch"],
    providerCropName: "capsicum",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  eggplant: {
    canonicalId: "eggplant",
    aliases: ["Eggplant", "Brinjal", "Aubergine", "Solanum melongena", "Baingan"],
    providerCropName: "eggplant",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  brinjal: {
    canonicalId: "brinjal",
    aliases: ["Brinjal", "Eggplant", "Aubergine", "Baingan"],
    providerCropName: "brinjal",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Vegetables — Cucurbits ────────────────────────────────────────────────

  cucumber: {
    canonicalId: "cucumber",
    aliases: ["Cucumber", "Cucumis sativus", "Kheera"],
    providerCropName: "cucumber",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  watermelon: {
    canonicalId: "watermelon",
    aliases: ["Watermelon", "Citrullus lanatus", "Tarbooz"],
    providerCropName: "watermelon",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  pumpkin: {
    canonicalId: "pumpkin",
    aliases: ["Pumpkin", "Cucurbita maxima", "Kaddu"],
    providerCropName: "pumpkin",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  squash: {
    canonicalId: "squash",
    aliases: ["Squash", "Zucchini", "Cucurbita pepo"],
    providerCropName: "squash",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "bitter melon": {
    canonicalId: "bitter melon",
    aliases: ["Bitter Melon", "Bitter Gourd", "Momordica charantia", "Karela"],
    providerCropName: "bitter melon",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "bitter gourd": {
    canonicalId: "bitter gourd",
    aliases: ["Bitter Gourd", "Bitter Melon", "Karela", "Momordica charantia"],
    providerCropName: "bitter gourd",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "bottle gourd": {
    canonicalId: "bottle gourd",
    aliases: ["Bottle Gourd", "Lauki", "Calabash", "Lagenaria siceraria"],
    providerCropName: "bottle gourd",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  muskmelon: {
    canonicalId: "muskmelon",
    aliases: ["Muskmelon", "Cantaloupe", "Kharbuja", "Cucumis melo"],
    providerCropName: "muskmelon",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Vegetables — Other ────────────────────────────────────────────────────

  cabbage: {
    canonicalId: "cabbage",
    aliases: ["Cabbage", "Brassica oleracea (Capitata)", "Patta Gobhi"],
    providerCropName: "cabbage",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  cauliflower: {
    canonicalId: "cauliflower",
    aliases: ["Cauliflower", "Brassica oleracea (Botrytis)", "Phool Gobhi"],
    providerCropName: "cauliflower",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  okra: {
    canonicalId: "okra",
    aliases: ["Okra", "Lady's Finger", "Bhindi", "Abelmoschus esculentus"],
    providerCropName: "okra",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  onion: {
    canonicalId: "onion",
    aliases: ["Onion", "Allium cepa", "Pyaz", "Kanda"],
    providerCropName: "onion",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  garlic: {
    canonicalId: "garlic",
    aliases: ["Garlic", "Allium sativum", "Lahsun"],
    providerCropName: "garlic",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  carrot: {
    canonicalId: "carrot",
    aliases: ["Carrot", "Daucus carota", "Gajar"],
    providerCropName: "carrot",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  radish: {
    canonicalId: "radish",
    aliases: ["Radish", "Mooli", "Raphanus sativus"],
    providerCropName: "radish",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  coriander: {
    canonicalId: "coriander",
    aliases: ["Coriander", "Cilantro", "Dhania", "Coriandrum sativum"],
    providerCropName: "coriander",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Fruits — Temperate / Berry ────────────────────────────────────────────

  apple: {
    canonicalId: "apple",
    aliases: ["Apple", "Malus domestica", "Seb"],
    providerCropName: "apple",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  grape: {
    canonicalId: "grape",
    aliases: ["Grape", "Vitis vinifera", "Angur"],
    providerCropName: "grape",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  strawberry: {
    canonicalId: "strawberry",
    aliases: ["Strawberry", "Fragaria x ananassa"],
    providerCropName: "strawberry",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  peach: {
    canonicalId: "peach",
    aliases: ["Peach", "Prunus persica", "Aadu"],
    providerCropName: "peach",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  cherry: {
    canonicalId: "cherry",
    aliases: ["Cherry", "Sweet Cherry", "Prunus avium", "Gilash"],
    providerCropName: "cherry",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  blueberry: {
    canonicalId: "blueberry",
    aliases: ["Blueberry", "Vaccinium corymbosum"],
    providerCropName: "blueberry",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  raspberry: {
    canonicalId: "raspberry",
    aliases: ["Raspberry", "Rubus idaeus"],
    providerCropName: "raspberry",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  pear: {
    canonicalId: "pear",
    aliases: ["Pear", "Pyrus communis", "Nashpati"],
    providerCropName: "pear",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  avocado: {
    canonicalId: "avocado",
    aliases: ["Avocado", "Persea americana", "Makhanphal"],
    providerCropName: "avocado",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Fruits — Tropical ─────────────────────────────────────────────────────

  banana: {
    canonicalId: "banana",
    aliases: ["Banana", "Musa acuminata", "Kela"],
    providerCropName: "banana",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  mango: {
    canonicalId: "mango",
    aliases: ["Mango", "Mangifera indica", "Aam"],
    providerCropName: "mango",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  papaya: {
    canonicalId: "papaya",
    aliases: ["Papaya", "Carica papaya", "Papita"],
    providerCropName: "papaya",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  guava: {
    canonicalId: "guava",
    aliases: ["Guava", "Psidium guajava", "Amrood"],
    providerCropName: "guava",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  pomegranate: {
    canonicalId: "pomegranate",
    aliases: ["Pomegranate", "Punica granatum", "Anar"],
    providerCropName: "pomegranate",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Fruits — Citrus ───────────────────────────────────────────────────────

  orange: {
    canonicalId: "orange",
    aliases: ["Orange", "Sweet Orange", "Citrus sinensis", "Santra"],
    providerCropName: "orange",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  citrus: {
    canonicalId: "citrus",
    aliases: ["Citrus", "Citrus sp.", "Khatta"],
    providerCropName: "citrus",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  lemon: {
    canonicalId: "lemon",
    aliases: ["Lemon", "Citrus limon", "Nimbu"],
    providerCropName: "lemon",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  lime: {
    canonicalId: "lime",
    aliases: ["Lime", "Citrus aurantiifolia", "Kagzi Nimbu"],
    providerCropName: "lime",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Root / Tuber ──────────────────────────────────────────────────────────

  cassava: {
    canonicalId: "cassava",
    aliases: ["Cassava", "Manioc", "Tapioca", "Manihot esculenta", "Sago"],
    providerCropName: "cassava",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  "sweet potato": {
    canonicalId: "sweet potato",
    aliases: ["Sweet Potato", "Ipomoea batatas", "Shakarkandi"],
    providerCropName: "sweet potato",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  // ── Spices / Aromatics ────────────────────────────────────────────────────

  ginger: {
    canonicalId: "ginger",
    aliases: ["Ginger", "Zingiber officinale", "Adrak"],
    providerCropName: "ginger",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },

  turmeric: {
    canonicalId: "turmeric",
    aliases: ["Turmeric", "Curcuma longa", "Haldi"],
    providerCropName: "turmeric",
    provider: "kindwise-crop-health",
    supportEvidence: SUPPORT_EVIDENCE.KINDWISE_INFERENCE_ENABLED,
    supported: false,
    inferenceEnabled: true,
    acceptancePolicyEnabled: true,
    verifiedDiseaseIds: [],
    evidenceNote: INFERENCE_ENABLED_NOTE,
  },
});

/**
 * Returns crops with live-verified Kindwise class IDs (fully reviewed).
 * Only these crops have treatment guidance from verified agricultural sources.
 * @returns {string[]}
 */
export function getVerifiedSupportedCrops() {
  return Object.values(CROP_SUPPORT_REGISTRY)
    .filter((c) => c.supportEvidence === SUPPORT_EVIDENCE.KINDWISE_LIVE_CLASS_ID)
    .map((c) => c.canonicalId);
}

/**
 * Returns crops where Kindwise runs real inference.
 * Includes both LIVE_CLASS_ID (treatment guidance available) and
 * INFERENCE_ENABLED (Kindwise returns its own disease name; guidanceStatus:"unavailable").
 * @returns {string[]}
 */
export function getInferenceEnabledCrops() {
  return Object.values(CROP_SUPPORT_REGISTRY)
    .filter((c) => c.inferenceEnabled === true)
    .map((c) => c.canonicalId);
}

/**
 * Returns crops documented by Kindwise but NOT yet enabled in the acceptance policy.
 * @returns {string[]}
 */
export function getDocumentedOnlyCrops() {
  return Object.values(CROP_SUPPORT_REGISTRY)
    .filter((c) => c.supportEvidence === SUPPORT_EVIDENCE.KINDWISE_DOCUMENTED_ONLY)
    .map((c) => c.canonicalId);
}

/**
 * Returns the registry entry for a given canonical crop ID, or null if not found.
 * @param {string} cropId
 * @returns {CropSupportEntry|null}
 */
export function getCropSupportEntry(cropId) {
  return CROP_SUPPORT_REGISTRY[cropId] ?? null;
}

/**
 * SUMMARY (as of 2026-09-11):
 *   LIVE_CLASS_ID verified:   3 crops  (tomato, potato, corn)
 *   INFERENCE_ENABLED:       63 crops  (real Kindwise inference; class IDs pending review)
 *   DOCUMENTED_ONLY:          0 crops  (all documented crops now inference-enabled)
 *   Total inference-enabled: 66 crops
 *
 * STATUS: PARTIAL — real Kindwise inference runs for 66 crops. Treatment guidance
 * (guidanceStatus:"available") covers only the 3 live-verified crops.
 * To promote a crop from INFERENCE_ENABLED to LIVE_CLASS_ID:
 *   capture Kindwise class IDs via live API, review them, add treatment guidance.
 */
