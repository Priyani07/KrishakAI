const REQUEST_TIMEOUT_MS = 12_000;

function endpoint() {
  return import.meta.env.VITE_WEATHER_API_URL || "/api/weather";
}

function validatePayload(payload) {
  if (!payload?.location || !payload?.current || !Array.isArray(payload?.forecast) || typeof payload.source !== "string") {
    throw new Error("The weather service returned an invalid response.");
  }
  if (!Number.isFinite(payload.location.latitude) || !Number.isFinite(payload.location.longitude)) {
    throw new Error("The weather service returned invalid coordinates.");
  }
  return payload;
}

async function requestWeather(params) {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(endpoint(), origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  let response;
  try {
    response = await fetch(url.origin === origin ? `${url.pathname}${url.search}` : url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") throw new Error("The weather request timed out. Check your connection and try again.");
    throw new Error("The weather service could not be reached. Check your connection and try again.");
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error("The weather service returned an invalid response."); }
  if (!response.ok) throw new Error(payload?.error || "The weather provider returned an error. Please try again later.");
  return validatePayload(payload);
}

export async function getWeather(location) {
  const query = typeof location === "string" ? location.trim() : "";
  if (!query) throw new Error("Enter a town, district, or village to check the weather.");
  return requestWeather({ location: query });
}

export async function getWeatherForCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Current location coordinates are invalid.");
  }
  return requestWeather({ latitude, longitude });
}
