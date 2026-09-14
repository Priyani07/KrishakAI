const SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 10_000;

export function validateFieldCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Selected field coordinates are invalid.");
  }
}

export function formatFieldCoordinates(latitude, longitude) {
  validateFieldCoordinates(latitude, longitude);
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function fetchJson(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "Accept-Language": "en" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Location service unavailable.");
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Location request timed out. Check your connection.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchFieldLocation(query, fetchImpl = fetch) {
  const value = typeof query === "string" ? query.trim() : "";
  if (!value) throw new Error("Enter a place name to search.");
  const payload = await fetchJson(`${SEARCH_URL}?name=${encodeURIComponent(value)}&count=10&language=en&format=json`, fetchImpl);
  const result = (Array.isArray(payload?.results) ? payload.results : []).find(
    (item) => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude),
  );
  if (!result) throw new Error(`No location found for "${value}". Try another name or select a point on the map.`);
  return {
    name: [result.name, result.admin2, result.admin1, result.country].filter(Boolean).join(", "),
    lat: result.latitude,
    lng: result.longitude,
  };
}

export async function reverseGeocodeField(latitude, longitude, fetchImpl = fetch) {
  validateFieldCoordinates(latitude, longitude);
  const coordinateName = formatFieldCoordinates(latitude, longitude);
  try {
    const payload = await fetchJson(`${REVERSE_URL}?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=16&addressdetails=1`, fetchImpl);
    return {
      name: typeof payload?.display_name === "string" && payload.display_name.trim()
        ? payload.display_name.split(",").slice(0, 4).join(",").trim()
        : coordinateName,
      lat: latitude,
      lng: longitude,
    };
  } catch {
    return { name: coordinateName, lat: latitude, lng: longitude };
  }
}
