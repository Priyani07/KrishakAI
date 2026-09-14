export const LOCAL_REFERENCE_SOURCE = "Local reference rule — not independently agronomically validated";
export const DEMO_CATALOGUE_SOURCE = "Reference/demo catalogue entry — not a verified commercial seed recommendation.";

const storedDirections = {
  Loamy: { Wheat: "Wheat", Rice: "Vegetables", Maize: "Maize", Cotton: "Pulses", Tomato: "Tomato", Millet: "Maize" },
  Clayey: { Rice: "Rice", Wheat: "Wheat", Maize: "Rice", Cotton: "Rice", Tomato: "Rice", Millet: "Rice" },
  Sandy: { Millet: "Millet", Maize: "Maize", Tomato: "Groundnut", Wheat: "Millet", Rice: "Review drainage", Cotton: "Groundnut" },
  Black: { Cotton: "Cotton", Wheat: "Wheat", Maize: "Cotton", Rice: "Review drainage", Tomato: "Cotton", Millet: "Sorghum" },
  Silty: { Tomato: "Tomato", Wheat: "Wheat", Rice: "Vegetables", Maize: "Maize", Cotton: "Wheat", Millet: "Millet" },
  Peaty: { Rice: "Rice", Tomato: "Leafy vegetables", Wheat: "Review pH first", Maize: "Review pH first", Cotton: "Review pH first", Millet: "Review pH first" },
};

export const CROP_REFERENCE_REGISTRY = Object.freeze(
  Object.entries(storedDirections).flatMap(([soilType, crops]) => Object.entries(crops).map(([cropName, referenceDirection]) => Object.freeze({
    cropId: cropName.toLowerCase(),
    cropName,
    soilTypes: [soilType],
    season: null,
    referenceDirection,
    source: LOCAL_REFERENCE_SOURCE,
    sourceUrl: null,
    reviewDate: null,
    limitations: "This stored local reference direction does not include weather, crop stage, measured soil nutrients, moisture, location, yield, or profitability data.",
  }))),
);

export const SEED_REFERENCE_CATALOGUE = Object.freeze([
  {
    id: "hybrid-seed-101", name: "Hybrid Seed 101", crop: "Wheat", soilTypes: ["Loamy"], season: "Rabi",
    description: "Reference catalogue entry associated with wheat and loamy soil in the local catalogue.",
  },
  {
    id: "hybrid-seed-204", name: "Hybrid Seed 204", crop: "Rice", soilTypes: ["Clayey"], season: "Kharif",
    description: "Reference catalogue entry associated with rice and clayey soil in the local catalogue.",
  },
  {
    id: "hybrid-seed-307", name: "Hybrid Seed 307", crop: "Maize", soilTypes: ["Sandy"], season: "Kharif",
    description: "Reference catalogue entry associated with maize and sandy soil in the local catalogue.",
  },
  {
    id: "hybrid-seed-412", name: "Hybrid Seed 412", crop: "Cotton", soilTypes: ["Black"], season: "Kharif",
    description: "Reference catalogue entry associated with cotton and black soil in the local catalogue.",
  },
  {
    id: "hybrid-seed-516", name: "Hybrid Seed 516", crop: "Tomato", soilTypes: ["Silty"], season: "Year-round",
    description: "Reference catalogue entry associated with tomato and silty soil in the local catalogue.",
  },
  {
    id: "hybrid-seed-620", name: "Hybrid Seed 620", crop: "Millet", soilTypes: ["Sandy"], season: "Kharif",
    description: "Reference catalogue entry associated with millet and sandy soil in the local catalogue.",
  },
].map((entry) => Object.freeze({
  ...entry,
  source: DEMO_CATALOGUE_SOURCE,
  sourceUrl: null,
  reviewDate: null,
  catalogueStatus: "reference_demo_unverified",
  limitations: "This entry is a local reference catalogue record. It does not confirm commercial availability, seed quality, resistance, yield, or suitability for a specific field.",
})));

export function getCropReferenceGuidance(soilType, cropName) {
  if (!soilType || !cropName) {
    return { status: "incomplete", entry: null, message: "Select a soil type and crop to view the available local reference direction." };
  }
  const entry = CROP_REFERENCE_REGISTRY.find((item) => item.cropName === cropName && item.soilTypes.includes(soilType));
  if (!entry) {
    return { status: "unavailable", entry: null, message: "No verified reference direction is available for this combination." };
  }
  return { status: "available", entry, message: "Stored local reference direction available." };
}

export function filterReferenceSeeds({ crop = "All", soil = "All" } = {}) {
  return SEED_REFERENCE_CATALOGUE.filter((entry) => (crop === "All" || entry.crop === crop) && (soil === "All" || entry.soilTypes.includes(soil)));
}
