export const KINDWISE_CROP_HEALTH_ENDPOINT = "https://crop.kindwise.com/api/v1/identification";
export const KINDWISE_CROP_HEALTH_TIMEOUT_MS = 15_000;

export class KindwiseCropHealthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "KindwiseCropHealthError";
    this.code = code;
  }
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new KindwiseCropHealthError("malformed_response", `Kindwise response is missing ${fieldName}.`);
  }
  return value.trim();
}

function requiredProbability(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new KindwiseCropHealthError("malformed_response", `Kindwise response has an invalid ${fieldName}.`);
  }
  return value;
}

function normalizeSuggestion(suggestion, fieldName) {
  if (!suggestion || typeof suggestion !== "object") {
    throw new KindwiseCropHealthError("malformed_response", `Kindwise response is missing ${fieldName}.`);
  }
  return {
    id: requiredString(suggestion.id, `${fieldName}.id`),
    name: requiredString(suggestion.name, `${fieldName}.name`),
    scientificName: typeof suggestion.scientific_name === "string" ? suggestion.scientific_name.trim() : "",
    probability: requiredProbability(suggestion.probability, `${fieldName}.probability`),
  };
}

export function parseKindwiseCropHealthResponse(payload) {
  const isPlant = payload?.result?.is_plant;
  if (!isPlant || typeof isPlant.binary !== "boolean") {
    throw new KindwiseCropHealthError("malformed_response", "Kindwise response is missing plant-detection data.");
  }

  const normalized = {
    isPlant: isPlant.binary,
    isPlantProbability: requiredProbability(isPlant.probability, "is_plant.probability"),
  };

  if (!normalized.isPlant) return normalized;

  const diseaseSuggestion = payload?.result?.disease?.suggestions?.[0];
  normalized.disease = normalizeSuggestion(diseaseSuggestion, "disease suggestion");

  const cropSuggestion = payload?.result?.crop?.suggestions?.[0];
  normalized.crop = cropSuggestion ? normalizeSuggestion(cropSuggestion, "crop suggestion") : null;
  return normalized;
}

function providerErrorForStatus(status) {
  if (status === 400) return new KindwiseCropHealthError("bad_request", "Kindwise did not accept the image.");
  if (status === 401 || status === 403) return new KindwiseCropHealthError("unauthorized", "Kindwise authorization failed.");
  if (status === 429) return new KindwiseCropHealthError("rate_limited", "Kindwise quota is unavailable.");
  if (status >= 500) return new KindwiseCropHealthError("provider_unavailable", "Kindwise is unavailable.");
  return new KindwiseCropHealthError("provider_error", "Kindwise request failed.");
}

export async function classifyKindwiseCropHealthImage({ imageBuffer, mimeType, fetchImpl = fetch }) {
  const apiKey = process.env.KINDWISE_API_KEY;
  if (!apiKey) {
    throw new KindwiseCropHealthError("missing_api_key", "KINDWISE_API_KEY is not configured.");
  }

  const body = new FormData();
  body.append("image", new Blob([imageBuffer], { type: mimeType }), "crop-image");

  let response;
  try {
    response = await fetchImpl(KINDWISE_CROP_HEALTH_ENDPOINT, {
      method: "POST",
      headers: { "Api-Key": apiKey },
      body,
      signal: AbortSignal.timeout(KINDWISE_CROP_HEALTH_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new KindwiseCropHealthError("timeout", "Kindwise request timed out.");
    }
    throw new KindwiseCropHealthError("network_error", "Kindwise request could not be completed.");
  }

  if (!response.ok) {
  const errorBody = await response.text();
  console.error("[Kindwise crop.health]", response.status, errorBody);
  throw providerErrorForStatus(response.status);
}

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new KindwiseCropHealthError("malformed_response", "Kindwise response could not be read.");
  }
  return parseKindwiseCropHealthResponse(payload);
}
