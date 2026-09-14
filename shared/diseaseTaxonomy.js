export const DISEASE_TAXONOMY_VERSION = "1.2.0";
export const UNKNOWN_DIAGNOSIS_ID = "unknown";
export const HEALTHY_DIAGNOSIS_ID = "healthy";
export const UNSUPPORTED_DIAGNOSIS_ID = "unsupported";
export const LOW_QUALITY_DIAGNOSIS_ID = "low_quality";

export const DISEASE_RESULT_STATUS = {
  VALID_LEAF: "valid_leaf",
  HEALTHY_OR_NO_VISIBLE_DISEASE: "healthy_or_no_visible_disease",
  LOW_QUALITY: "low_quality",
  NOT_A_PLANT_IMAGE: "not_a_plant_image",
  UNKNOWN: "unknown",
  UNSUPPORTED: "unsupported",
};

export const DISEASE_IMAGE_STATUS = {
  PLANT_IMAGE: "PLANT_IMAGE",
  NON_PLANT_IMAGE: "NON_PLANT_IMAGE",
  LOW_QUALITY_IMAGE: "LOW_QUALITY_IMAGE",
  AMBIGUOUS_IMAGE: "AMBIGUOUS_IMAGE",
};

export const DIAGNOSTIC_EVIDENCE_STATUS = {
  SUFFICIENT: "SUFFICIENT",
  INSUFFICIENT: "INSUFFICIENT",
  UNKNOWN: "UNKNOWN",
};

export const SYMPTOM_EVIDENCE_STATUS = {
  VISIBLE_SYMPTOMS: "VISIBLE_SYMPTOMS",
  NO_VISIBLE_SYMPTOMS: "NO_VISIBLE_SYMPTOMS",
  UNCLEAR: "UNCLEAR",
};

export const PLANT_PARTS = ["leaf", "stem", "branch", "flower", "fruit", "tuber", "seed", "pod", "cob", "whole_plant", "multiple_parts", "unknown"];

export const SPECIAL_RESULT_DEFINITIONS = [
  {
    status: DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE,
    diagnosisId: HEALTHY_DIAGNOSIS_ID,
    displayName: "Healthy / no visible disease",
    note: "No visible disease symptoms were identified in this image. Continue routine crop monitoring; an image alone cannot confirm plant health.",
    requiresUncertain: false,
    allowsKnownCrop: true,
  },
  {
    status: DISEASE_RESULT_STATUS.LOW_QUALITY,
    diagnosisId: LOW_QUALITY_DIAGNOSIS_ID,
    displayName: "Low-quality image",
    note: "The image quality is not sufficient for reliable diagnosis. Please upload a clearer photo in good lighting.",
    requiresUncertain: true,
    allowsKnownCrop: false,
  },
  {
    status: DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE,
    diagnosisId: UNSUPPORTED_DIAGNOSIS_ID,
    displayName: "Not a plant image",
    note: "This image does not appear to contain a crop or plant. Please upload a clear photo of the plant or affected plant part.",
    requiresUncertain: true,
    allowsKnownCrop: false,
  },
  {
    status: DISEASE_RESULT_STATUS.UNKNOWN,
    diagnosisId: UNKNOWN_DIAGNOSIS_ID,
    displayName: "Unknown condition",
    note: "This image could not be matched confidently to a supported disease. Treat this as an initial indication and verify the condition with an agricultural expert or laboratory before treatment.",
    requiresUncertain: true,
    allowsKnownCrop: true,
  },
  {
    status: DISEASE_RESULT_STATUS.UNSUPPORTED,
    diagnosisId: UNSUPPORTED_DIAGNOSIS_ID,
    displayName: "Unsupported condition",
    note: "The visible condition is outside the application’s currently supported disease taxonomy. Please consult an agricultural expert or laboratory before treatment.",
    requiresUncertain: true,
    allowsKnownCrop: true,
  },
];

export const VERIFIED_TREATMENT_UNAVAILABLE = "Treatment details are not available from a verified source. Please consult a local agricultural expert or laboratory before applying pesticides or other treatments.";

const TOMATO_EARLY_BLIGHT_SOURCE = {
  organization: "University of Minnesota Extension",
  title: "Early blight in tomato and potato",
  url: "https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/early-blight-in-tomato-and-potato",
  reviewDate: "2024",
};

const LATE_BLIGHT_SOURCE = {
  organization: "University of Minnesota Extension",
  title: "Late blight of tomato and potato",
  url: "https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/late-blight",
  reviewDate: "2021",
};

const ICAR_CPRI_LATE_BLIGHT_ADVISORY_SOURCE = {
  organization: "ICAR–Central Potato Research Institute",
  title: "Late blight advisory archive for potato crops",
  url: "https://icarcpri.res.in/Content/Index/?qlid=3048&&Ls_is=3066&&lngid=1",
  reviewDate: "2026",
};

const CORN_NORTHERN_LEAF_BLIGHT_SOURCE = {
  organization: "University of Delaware Cooperative Extension",
  title: "Northern Corn Leaf Blight",
  url: "https://www.udel.edu/academics/colleges/canr/cooperative-extension/fact-sheets/northern-corn-leaf-blight/",
  reviewDate: "October 2025",
};

const TNAU_TURCICUM_LEAF_BLIGHT_SOURCE = {
  organization: "Tamil Nadu Agricultural University",
  title: "Turcicum Leaf Blight (TLB)",
  url: "https://agritech.tnau.ac.in/crop_protection/maize_disease/maize_4.html",
  reviewDate: "Not stated",
};

export const DISEASE_KNOWLEDGE_BASE = [
  {
    crop: "tomato",
    diagnosisId: "tomato_early_blight",
    displayName: "Tomato Early Blight",
    acceptedModelLabels: ["Tomato early blight", "Early blight of tomato"],
    aliases: ["Tomato early blight", "Early blight of tomato"],
    scientificPathogenNames: ["Alternaria tomatophila", "Alternaria solani"],
    visibleSymptoms: [
      "Small dark, round brown leaf spots often begin on older foliage near the ground.",
      "Larger leaf spots can develop target-like concentric rings, with yellowing around the spots.",
      "Brown lesions with concentric rings may appear on stems; fruit can develop leathery black spots with raised concentric ridges near the stem.",
    ],
    affectedPlantParts: ["Leaves", "Stems", "Fruit"],
    progression: "Severely infected leaves can turn brown and fall; disease can progress through affected foliage, stems, and fruit.",
    whatToDoNow: [
      "Remove leaves with visible leaf spots where appropriate and dispose of the material safely; do not remove more than one-third of the plant's leaves.",
      "Wash hands after handling infected leaves and wash and sanitize pruning tools before using them on healthy tomato plants.",
      "Inspect nearby tomato plants for new or spreading leaf spots.",
    ],
    whatToAvoid: [
      "Avoid keeping leaves wet; use practices that keep foliage dry where practical.",
      "Avoid moving from infected foliage to healthy tomato plants without washing hands and cleaning pruning tools.",
      "Avoid working in tomato plants while leaves are wet from rain, irrigation, or dew.",
    ],
    prevention: [
      "Use practices that reduce foliage wetness, such as watering at the base of plants where practical.",
      "Use staking, trellising, weed management, and appropriate spacing to improve airflow and drying.",
      "Use a barrier such as mulch between contaminated soil and leaves, and rotate out of tomatoes and related crops for at least two years where practical.",
    ],
    treatmentGuidance: "University of Minnesota Extension describes cultural and physical controls for tomato early blight. This interface intentionally does not show pesticide products, doses, concentrations, intervals, or tank mixes; consult a local agricultural expert before applying any treatment.",
    monitoring: [
      "Scout regularly for new or spreading leaf spots so changes can be assessed promptly.",
      "Recheck if symptoms spread to nearby plants, stems, or fruit; another image is still only an initial indication.",
    ],
    expertReferral: "Seek local agricultural expert or laboratory confirmation before treatment when symptoms are uncertain, spreading quickly, affecting fruit, or not improving after cultural controls.",
    source: TOMATO_EARLY_BLIGHT_SOURCE,
    sourceOrganization: TOMATO_EARLY_BLIGHT_SOURCE.organization,
    sourceTitle: TOMATO_EARLY_BLIGHT_SOURCE.title,
    sourceUrl: TOMATO_EARLY_BLIGHT_SOURCE.url,
    sourceReviewDate: TOMATO_EARLY_BLIGHT_SOURCE.reviewDate,
  },
  {
    crop: "potato",
    diagnosisId: "potato_late_blight",
    displayName: "Potato Late Blight",
    acceptedModelLabels: ["Potato late blight", "Late blight of potato"],
    aliases: ["Potato late blight", "Late blight of potato"],
    scientificPathogenNames: ["Phytophthora infestans"],
    visibleSymptoms: [
      "Leaves can develop large dark brown blotches with a green-gray edge that are not confined by major leaf veins.",
      "In cool, wet weather, foliage can turn brown and wilted; affected potato tubers can become discolored and develop secondary soft rot.",
    ],
    affectedPlantParts: ["Leaves", "Stems", "Tubers"],
    progression: "Late blight can spread quickly in favorable cool, damp conditions, so suspected symptoms need prompt local assessment.",
    whatToDoNow: [
      "Scout potato crops regularly, especially in areas that dry slowly or remain wet from dew, rain, or poor air circulation.",
      "Destroy potato cull piles before the growing season and control volunteer potato plants that could carry the pathogen.",
      "If only a few plants are affected, separate and remove them promptly while seeking local agricultural confirmation.",
    ],
    whatToAvoid: [
      "Avoid retaining potato cull piles or volunteer potato plants that may allow late blight to persist between crops.",
      "Avoid treating the image result as a confirmed diagnosis or applying a disease-specific product without local expert guidance.",
    ],
    prevention: [
      "Use certified potato seed where available and inspect planting material for symptoms.",
      "Use field practices that improve foliage drying where practical, and keep cull material managed rather than exposed near production areas.",
    ],
    treatmentGuidance: VERIFIED_TREATMENT_UNAVAILABLE,
    monitoring: [
      "Inspect lower and slow-drying areas of the crop during regular scouting and record changes in blotches, wilting, or tuber symptoms.",
      "Escalate quickly if symptoms spread in cool, damp weather or appear across multiple plants.",
    ],
    expertReferral: "Seek local agricultural or laboratory confirmation promptly when late blight is suspected, because neighboring potato and tomato crops can be at risk.",
    source: LATE_BLIGHT_SOURCE,
    sources: [LATE_BLIGHT_SOURCE, ICAR_CPRI_LATE_BLIGHT_ADVISORY_SOURCE],
    sourceOrganization: LATE_BLIGHT_SOURCE.organization,
    sourceTitle: LATE_BLIGHT_SOURCE.title,
    sourceUrl: LATE_BLIGHT_SOURCE.url,
    sourceReviewDate: LATE_BLIGHT_SOURCE.reviewDate,
  },
  {
    crop: "tomato",
    diagnosisId: "tomato_late_blight",
    displayName: "Tomato Late Blight",
    acceptedModelLabels: ["Tomato late blight", "Late blight of tomato"],
    aliases: ["Tomato late blight", "Late blight of tomato"],
    scientificPathogenNames: ["Phytophthora infestans"],
    visibleSymptoms: [
      "Leaves can develop large dark brown blotches with a green-gray edge that are not confined by major leaf veins.",
      "Stem infections can be firm and dark brown; fruit can develop firm dark brown spots that may become soft as secondary bacteria invade.",
    ],
    affectedPlantParts: ["Leaves", "Stems", "Fruit"],
    progression: "Late blight can spread quickly under cool, damp conditions and can affect large areas of foliage and fruit.",
    whatToDoNow: [
      "Scout tomatoes regularly, particularly when weather is cool, wet, or humid, and inspect slow-drying portions of the planting.",
      "Inspect tomato transplants for symptoms before planting and remove plants with suspected late blight for local assessment.",
      "Remove or bury tomato plants at the end of the season and manage nearby potato cull piles and volunteer potatoes.",
    ],
    whatToAvoid: [
      "Avoid leaving volunteer potatoes, potato cull piles, or suspected infected tomato material unmanaged near production areas.",
      "Avoid treating the image result as a confirmed diagnosis or applying a disease-specific product without local expert guidance.",
    ],
    prevention: [
      "Keep leaves as dry as practical through base watering, morning watering, spacing, and support practices that improve airflow.",
      "Avoid planting tomatoes, potatoes, peppers, or eggplants in the same location for three to four years where practical.",
    ],
    treatmentGuidance: VERIFIED_TREATMENT_UNAVAILABLE,
    monitoring: [
      "Watch for dark blotches with green-gray edges, dark stem lesions, or rapidly changing foliage and fruit symptoms.",
      "Seek prompt confirmation if symptoms appear during cool, damp weather or spread through a planting.",
    ],
    expertReferral: "Seek local agricultural or laboratory confirmation promptly when late blight is suspected, because neighboring potato and tomato crops can be at risk.",
    source: LATE_BLIGHT_SOURCE,
    sources: [LATE_BLIGHT_SOURCE],
    sourceOrganization: LATE_BLIGHT_SOURCE.organization,
    sourceTitle: LATE_BLIGHT_SOURCE.title,
    sourceUrl: LATE_BLIGHT_SOURCE.url,
    sourceReviewDate: LATE_BLIGHT_SOURCE.reviewDate,
  },
  {
    crop: "corn",
    diagnosisId: "corn_northern_leaf_blight",
    displayName: "Northern Corn Leaf Blight",
    acceptedModelLabels: ["Northern corn leaf blight", "Turcicum leaf blight", "Northern leaf blight of corn"],
    aliases: ["Northern corn leaf blight", "Turcicum leaf blight", "Northern leaf blight of corn"],
    scientificPathogenNames: ["Exserohilum turcicum"],
    visibleSymptoms: [
      "Symptoms can begin on lower leaves as long, narrow tan lesions that run parallel to leaf veins.",
      "Lesions can enlarge into long, oblong, cigar-shaped tan-to-gray areas and may coalesce over time.",
    ],
    affectedPlantParts: ["Leaves", "Leaf sheaths", "Ear husks"],
    progression: "Symptoms can move higher through the canopy and coalesce across substantial leaf area when moisture and moderate temperatures favor disease.",
    whatToDoNow: [
      "Inspect lower leaves and the wider canopy for elongated lesions, especially after frequent rain, heavy dew, or humid weather.",
      "Use a local agricultural diagnostic service when symptoms are unclear or similar leaf diseases need to be distinguished.",
      "Clean tillage equipment before moving from an infested field to another field.",
    ],
    whatToAvoid: [
      "Avoid relying on an image alone to distinguish northern corn leaf blight from similar corn leaf diseases.",
      "Avoid treating crop rotation or tillage as the only control where nearby inoculum may be present.",
    ],
    prevention: [
      "When there is a field history of the disease, discuss northern corn leaf blight resistance ratings with a seed provider before planting.",
      "Rotate away from corn where practical and manage infected corn residue while recognising that spores can also move between fields.",
    ],
    treatmentGuidance: VERIFIED_TREATMENT_UNAVAILABLE,
    monitoring: [
      "Monitor leaf moisture, rainfall, humidity, and the appearance of long tan or gray lesions during regular field scouting.",
      "Recheck quickly if lesions expand, coalesce, or approach the upper canopy before or near tasseling.",
    ],
    expertReferral: "Seek a local agricultural expert or diagnostic laboratory when symptoms are uncertain, spread quickly, or could affect crop yield.",
    source: CORN_NORTHERN_LEAF_BLIGHT_SOURCE,
    sources: [CORN_NORTHERN_LEAF_BLIGHT_SOURCE, TNAU_TURCICUM_LEAF_BLIGHT_SOURCE],
    sourceOrganization: CORN_NORTHERN_LEAF_BLIGHT_SOURCE.organization,
    sourceTitle: CORN_NORTHERN_LEAF_BLIGHT_SOURCE.title,
    sourceUrl: CORN_NORTHERN_LEAF_BLIGHT_SOURCE.url,
    sourceReviewDate: CORN_NORTHERN_LEAF_BLIGHT_SOURCE.reviewDate,
  },
];

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

export function getDiseaseKnowledge(diagnosisId) {
  return DISEASE_KNOWLEDGE_BASE.find((entry) => entry.diagnosisId === diagnosisId) || null;
}

export function getDiseaseKnowledgeByModelLabel(label) {
  const normalizedLabel = normalize(label);
  return DISEASE_KNOWLEDGE_BASE.find((entry) => entry.acceptedModelLabels.some((acceptedLabel) => normalize(acceptedLabel) === normalizedLabel)) || null;
}

export function getSupportedDiagnosisIds() {
  return DISEASE_KNOWLEDGE_BASE.map((entry) => entry.diagnosisId);
}

export function getSpecialResultByStatus(status) {
  return SPECIAL_RESULT_DEFINITIONS.find((entry) => entry.status === status) || null;
}

export function getAllowedInferenceDiagnosisIds() {
  return [...getSupportedDiagnosisIds(), ...new Set(SPECIAL_RESULT_DEFINITIONS.map((entry) => entry.diagnosisId))];
}

export function getAllowedInferenceStatuses() {
  return [DISEASE_RESULT_STATUS.VALID_LEAF, ...SPECIAL_RESULT_DEFINITIONS.map((entry) => entry.status)];
}

export function getDiseaseResultStatusLabel(status) {
  const labels = {
    [DISEASE_RESULT_STATUS.VALID_LEAF]: "Valid crop image",
    [DISEASE_RESULT_STATUS.HEALTHY_OR_NO_VISIBLE_DISEASE]: "Valid crop image · no visible disease",
    [DISEASE_RESULT_STATUS.LOW_QUALITY]: "Low-quality image",
    [DISEASE_RESULT_STATUS.NOT_A_PLANT_IMAGE]: "Not a plant image",
    [DISEASE_RESULT_STATUS.UNKNOWN]: "Unknown condition",
    [DISEASE_RESULT_STATUS.UNSUPPORTED]: "Unsupported condition",
  };
  return labels[status] || "Unknown condition";
}

export function getAllowedInferenceLabels() {
  return [
    ...DISEASE_KNOWLEDGE_BASE.flatMap((entry) => entry.acceptedModelLabels),
    ...SPECIAL_RESULT_DEFINITIONS.map((entry) => entry.displayName),
  ];
}

// Crop names recognised in Kindwise inference results.
// These are crops where the acceptance policy is open and Kindwise runs real inference.
// Disease names come from Kindwise's own taxonomy for these crops.
// This list is kept separate from DISEASE_KNOWLEDGE_BASE, which requires verified
// treatment guidance from an authoritative agricultural publication.
export const KINDWISE_DOCUMENTED_CROP_NAMES = [
  // Cereals / Grains
  "wheat", "rice", "maize", "barley", "oat", "sorghum", "millet",
  "pearl millet", "finger millet", "rye",
  // Legumes / Pulses
  "soybean", "chickpea", "pea", "lentil", "groundnut", "peanut",
  "cowpea", "pigeon pea", "mung bean", "black gram",
  // Oilseeds / Fiber
  "sunflower", "mustard", "canola", "cotton", "sesame", "flax",
  // Industrial / Plantation
  "sugarcane", "tea", "coffee", "coconut", "rubber",
  // Vegetables - Solanaceae
  "chilli", "pepper", "bell pepper", "capsicum", "eggplant", "brinjal",
  // Vegetables - Cucurbits
  "cucumber", "watermelon", "pumpkin", "squash",
  "bitter melon", "bitter gourd", "bottle gourd", "muskmelon",
  // Vegetables - Other
  "cabbage", "cauliflower", "okra", "onion", "garlic",
  "carrot", "radish", "coriander",
  // Fruits - Temperate / Berry
  "apple", "grape", "strawberry", "peach", "cherry",
  "blueberry", "raspberry", "pear", "avocado",
  // Fruits - Tropical
  "banana", "mango", "papaya", "guava", "pomegranate",
  // Fruits - Citrus
  "orange", "citrus", "lemon", "lime",
  // Root / Tuber
  "cassava", "sweet potato",
  // Spices / Aromatics
  "ginger", "turmeric",
];

export function getKnownCrops() {
  const fromKnowledgeBase = DISEASE_KNOWLEDGE_BASE.map((entry) => entry.crop);
  return [...new Set([...fromKnowledgeBase, ...KINDWISE_DOCUMENTED_CROP_NAMES])];
}

export function normalizeDiseaseValue(value) {
  return normalize(value);
}

export { TOMATO_EARLY_BLIGHT_SOURCE, LATE_BLIGHT_SOURCE, CORN_NORTHERN_LEAF_BLIGHT_SOURCE };
