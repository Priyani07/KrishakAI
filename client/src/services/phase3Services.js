async function postImage(endpoint, file, label) {
  if (!endpoint) throw new Error(`${label} service is not configured yet.`);
  const body = new FormData();
  body.append("image", file);
  const response = await fetch(endpoint, { method: "POST", body });
  let payload = null;
  try { payload = await response.json(); } catch { /* Use the generic response error. */ }
  if (!response.ok) {
    const error = new Error(payload?.error || `${label} service returned an error. Please try again later.`);
    error.code = payload?.code || "service_error";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function detectDisease(file) {
  const endpoint = import.meta.env.VITE_DISEASE_DETECTION_API_URL || "/api/disease-detection";
  const result = await postImage(endpoint, file, "Disease detection");
  if (!result || typeof result.diagnosis !== "string" || !result.diagnosis.trim()) {
    throw new Error("Disease detection service returned an invalid response.");
  }
  return result;
}

export async function analyzeSoilImage(file) {
  const endpoint = import.meta.env.VITE_SOIL_ANALYSIS_API_URL || "/api/soil-analysis";
  const result = await postImage(endpoint, file, "Soil image analysis");
  const listFields = ["visibleCharacteristics", "suitableCrops", "irrigationAdvice", "managementAdvice"];
  if (!result || !["soil_image", "not_soil_image", "low_quality", "uncertain"].includes(result.imageStatus)) {
    throw new Error("Soil image analysis service returned an invalid response.");
  }
  if (typeof result.note !== "string" || listFields.some((field) => !Array.isArray(result[field]) || result[field].some((item) => typeof item !== "string"))) {
    throw new Error("Soil image analysis service returned an invalid response.");
  }
  if (result.imageStatus === "soil_image" && (typeof result.likelySoilType !== "string" || !result.likelySoilType.trim())) {
    throw new Error("Soil image analysis service returned an invalid response.");
  }
  return result;
}
