const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const PHOTO_EXTENSIONS = /\.(jpe?g|png)$/i;
export const PHOTO_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";
export const PHOTO_CAPTURE = "environment";

export function validateSoilPhotoFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "");
  if (!file) return { valid: false, message: "Please choose a land or soil photo." };
  if (!PHOTO_TYPES.has(type) && !PHOTO_EXTENSIONS.test(name)) return { valid: false, message: "Please upload a JPG, JPEG, or PNG photo." };
  if (Number.isFinite(file.size) && file.size > 10 * 1024 * 1024) return { valid: false, message: "Please upload a photo smaller than 10 MB." };
  return { valid: true, message: "" };
}

export function chooseLatestSoilYear(years) {
  const labels = [...new Set((years || []).map((item) => String(item?.label ?? item?.value ?? item ?? "").trim()).filter(Boolean))];
  return labels.sort((a, b) => Number((b.match(/\d{4}/) || ["0"])[0]) - Number((a.match(/\d{4}/) || ["0"])[0]) || b.localeCompare(a))[0] || "";
}

export function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude); const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

export function geolocationErrorMessage(error) {
  if (error?.code === 1) return "Location access was not allowed. You can select your area manually.";
  if (error?.code === 2) return "Your location is unavailable. You can select your area manually.";
  if (error?.code === 3) return "Location request timed out. You can select your area manually.";
  return "Your location could not be retrieved. You can select your area manually.";
}

export function summarizeSoilPhotoPixels({ width, height, pixels }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240 || !pixels?.length) return { status: "error", message: "Please upload a clearer photo showing the soil surface." };
  let brightness = 0; let samples = 0;
  for (let index = 0; index + 2 < pixels.length; index += 16) { brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3; samples += 1; }
  if (!samples) return { status: "error", message: "Please upload a clearer photo showing the soil surface." };
  const average = brightness / samples;
  return { status: "success", observation: { color: average < 75 ? "dark brown" : average > 175 ? "light brown" : "mid-brown", framing: "The image loaded with sufficient resolution for a browser-only visual observation.", limitation: "Visual observation only; this does not measure nitrogen, phosphorus, potassium, pH, EC, organic carbon, or micronutrients." } };
}

export async function analyzeSoilPhoto(file) {
  const validation = validateSoilPhotoFile(file);
  if (!validation.valid) return validation;
  if (typeof window === "undefined" || typeof document === "undefined") return { status: "pending", valid: true };
  let objectUrl = "";
  try {
    objectUrl = URL.createObjectURL(file);
    const image = new Image(); image.src = objectUrl;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const scale = Math.min(1, 640 / image.width, 480 / image.height);
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { status: "error", message: "Please upload a clearer photo showing the soil surface." };
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { valid: true, ...summarizeSoilPhotoPixels({ width: image.width, height: image.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }) };
  } catch { return { status: "error", message: "Please upload a clearer photo showing the soil surface." }; }
  finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

export function observationIsSafe(observation) {
  const forbiddenKey = /^(nitrogen|phosphorus|potassium|pH|EC|organic carbon|micronutrient)(Value|Unit)?$/i;
  return Object.entries(observation || {}).every(([key, value]) => {
    if (forbiddenKey.test(String(key))) return false;
    return !value || typeof value !== "object" || observationIsSafe(value);
  });
}
export function sourceLocationSummary(location) { return [location?.village, location?.block, location?.district, location?.state].filter(Boolean).join(", "); }
export function chartMax(measurements) { return Math.max(...(measurements || []).map((item) => Number(item.value)).filter(Number.isFinite), 1); }
export function chartWidth(value, max) { return `${Math.max(0, Math.min(100, Number(value) / (Number(max) || 1) * 100))}%`; }
export function chartAnimationStyle(index, reduce) { return reduce ? {} : { animationDelay: `${Math.min(index, 8) * 45}ms` }; }
export function isCompleteLocation(location) { return ["state", "district", "block", "village"].every((key) => Boolean(location?.[key])); }
export function resetPhotoState() { return { status: "idle", previewUrl: "", observation: null, message: "" }; }
export function photoOnlyMessage() { return "For nutrient values, select your location to view Soil Health Card reference data."; }
export function emptyStartMessage() { return "Select a location or upload a soil photo to begin."; }
export function noVillageMessage() { return "Unable to match this location to a Soil Health Card reference village. Please select your location manually."; }
export function privacyMessage() { return "The photo stays in this browser session and is not uploaded to an AI service."; }
export function coordinatePrivacyMessage() { return "Precise coordinates are used only for this session’s lookup and are not stored in public links."; }
export function noChemistryMessage() { return "No chemical nutrient values are inferred from this photo."; }
export function sourceOnlyMessage() { return "Chart values are rendered only from the selected Soil Health Card reference response."; }
export function latestYearMessage(year) { return year ? `Latest available reference year: ${year}` : "Select a village to find the latest available reference year."; }
export function mapInitialCenter() { return { lat: 20.5937, lng: 78.9629 }; }
export function mapMarkerTitle() { return "You are here / selected marker"; }
export function reverseGeocodePayload(payload) { return { state: String(payload?.state || ""), district: String(payload?.district || ""), block: String(payload?.block || ""), village: String(payload?.village || ""), matched: Boolean(payload?.matched), message: String(payload?.message || "") }; }
export function coordinatesFromMarker(event) { const position = event?.latlng; return position ? normalizeCoordinates(position.lat, position.lng) : null; }
export function chartTooltip(item, location, year) { return `${item?.name || "Nutrient"}: ${item?.value ?? "—"} ${item?.unit || "Source unit unavailable"}; Reference year: ${year || "not available"}; Location: ${sourceLocationSummary(location) || "not available"}`; }
export function reducedMotion() { return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; }
export { PHOTO_TYPES };
