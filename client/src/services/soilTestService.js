const endpoint = "/api/soil-test";
const optionEndpoint = "/api/soil-test/options";
const locationEndpoint = "/api/soil-test/location";

function validMeasurement(value) {
  return value && value.value !== null && value.value !== undefined && value.value !== "" && Number.isFinite(Number(value.value)) && Number(value.value) >= 0 && typeof value.unit === "string" && value.unit.trim();
}
function validReferenceNutrients(nutrients) {
  return Array.isArray(nutrients) && nutrients.length > 0 && nutrients.every((item) => typeof item?.name === "string" && item.name.trim() && validMeasurement(item) && (item.level === null || typeof item.level === "string"));
}
export function normalizeReferenceOption(option) {
  if (typeof option === "string") return { value: option, label: option };
  const value = String(option?.value ?? option?.code ?? option?.label ?? "").trim();
  const label = String(option?.label ?? option?.name ?? option?.value ?? "").trim();
  return value && label ? { value, label } : null;
}
export function parseSoilTestResponse(payload) {
  if (!payload || !["no_result", "success"].includes(payload.status)) throw new Error("Soil testing service returned an invalid response.");
  if (payload.status === "no_result") return { status: "no_result", result: null, source: payload.source || null, sourceUrl: payload.sourceUrl || null, measuredAt: null, coverage: payload.coverage || null, metadata: payload.metadata || null, message: payload.message || "No verified soil test result is available." };
  if (validReferenceNutrients(payload.result?.nutrients)) return { status: "success", result: { nutrients: payload.result.nutrients.map((item) => ({ name: item.name.trim(), level: item.level || null, value: Number(item.value), unit: item.unit.trim() })), location: payload.result.location || null, year: payload.result.year || null }, source: typeof payload.source === "string" ? payload.source : null, sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : null, measuredAt: null, coverage: payload.coverage || null, metadata: payload.metadata || null, message: null };
  const result = payload.result;
  if (!validMeasurement(result?.nitrogen) || !validMeasurement(result?.phosphorus) || !validMeasurement(result?.potassium)) throw new Error("Soil testing service returned an invalid response.");
  return { status: "success", result: { nitrogen: { value: Number(result.nitrogen.value), unit: result.nitrogen.unit.trim() }, phosphorus: { value: Number(result.phosphorus.value), unit: result.phosphorus.unit.trim() }, potassium: { value: Number(result.potassium.value), unit: result.potassium.unit.trim() } }, source: typeof payload.source === "string" ? payload.source : null, sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : null, measuredAt: typeof payload.measuredAt === "string" ? payload.measuredAt : null, coverage: payload.coverage || null, metadata: payload.metadata || null, message: null };
}
export async function getSoilTest(filters = {}, signal) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const response = await fetch(`${endpoint}${query.toString() ? `?${query}` : ""}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error("Soil Health Card reference data is temporarily unavailable.");
  return parseSoilTestResponse(await response.json());
}
export async function getSoilReferenceOptions(level, filters = {}, signal) {
  const query = new URLSearchParams({ level, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
  const response = await fetch(`${optionEndpoint}?${query}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error("Soil Health Card reference data is temporarily unavailable.");
  const payload = await response.json();
  if (payload.status !== "success" || !Array.isArray(payload.options)) throw new Error("Soil Health Card reference data returned an invalid response.");
  return payload.options.map(normalizeReferenceOption).filter(Boolean);
}
export async function reverseGeocodeSoilLocation(latitude, longitude, signal) {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  const response = await fetch(`${locationEndpoint}?${query}`, { headers: { Accept: "application/json" }, signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== "success") throw new Error(payload?.message || "Unable to match this location to a Soil Health Card reference village. Please select your location manually.");
  return payload;
}
