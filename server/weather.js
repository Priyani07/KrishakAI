const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 10_000;

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function withTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

function providerError(response, fallback) {
  if (response.status === 429) return new Error("The weather provider rate limit was reached. Please try again later.");
  return new Error(fallback);
}

function localTimeMinutes(value) {
  if (typeof value !== "string") return Number.NaN;
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

function getDayNight(current, daily) {
  const currentDate = typeof current.time === "string" ? current.time.slice(0, 10) : "";
  const dateIndex = Array.isArray(daily.time) ? daily.time.indexOf(currentDate) : -1;
  const index = dateIndex >= 0 ? dateIndex : 0;
  const sunrise = daily.sunrise?.[index];
  const sunset = daily.sunset?.[index];
  const currentMinutes = localTimeMinutes(current.time);
  const sunriseMinutes = localTimeMinutes(sunrise);
  const sunsetMinutes = localTimeMinutes(sunset);
  if (Number.isFinite(currentMinutes) && Number.isFinite(sunriseMinutes) && Number.isFinite(sunsetMinutes)) {
    return { status: currentMinutes >= sunriseMinutes && currentMinutes < sunsetMinutes ? "Day" : "Night", sunrise, sunset };
  }
  if (current.is_day === 0 || current.is_day === 1) return { status: current.is_day === 1 ? "Day" : "Night", sunrise: sunrise || "", sunset: sunset || "" };
  return { status: "Unknown", sunrise: sunrise || "", sunset: sunset || "" };
}

function normalizeForecast(location, geocode, forecast, resolution = "exact") {
  const current = forecast.current;
  const daily = forecast.daily;
  if (!current || !daily || !Array.isArray(daily.time) || !Array.isArray(daily.weather_code)) {
    throw new Error("The weather provider returned an invalid response.");
  }
  if (!Number.isFinite(current.temperature_2m) || !Number.isFinite(current.relative_humidity_2m) || !Number.isFinite(current.wind_speed_10m)) {
    throw new Error("The weather provider returned incomplete current conditions.");
  }
  if (!Number.isFinite(geocode.latitude) || !Number.isFinite(geocode.longitude)) {
    throw new Error("The weather provider returned invalid coordinates.");
  }
  return {
    location: {
      query: location,
      name: geocode.name,
      admin1: geocode.admin1 || "",
      country: geocode.country || "",
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      timezone: forecast.timezone || geocode.timezone || "",
      resolution,
    },
    current: {
      observedAt: current.time,
      temperatureC: current.temperature_2m,
      condition: WEATHER_CODES[current.weather_code] || `Weather code ${current.weather_code}`,
      weatherCode: current.weather_code,
      humidityPercent: current.relative_humidity_2m,
      windSpeedKmh: current.wind_speed_10m,
    },
    dayNight: getDayNight(current, daily),
    forecast: daily.time.slice(0, 3).map((date, index) => ({
      date,
      condition: WEATHER_CODES[daily.weather_code[index]] || `Weather code ${daily.weather_code[index]}`,
      weatherCode: daily.weather_code[index],
      minTemperatureC: daily.temperature_2m_min?.[index],
      maxTemperatureC: daily.temperature_2m_max?.[index],
    })),
    source: "Open-Meteo",
  };
}

async function getForecastForCoordinates(query, latitude, longitude, geocode, resolution = "exact") {
  const forecastUrl = `${FORECAST_URL}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=3`;
  let forecastResponse;
  try {
    forecastResponse = await withTimeout(forecastUrl);
  } catch {
    throw new Error("The weather provider could not be reached. Please try again later.");
  }
  if (!forecastResponse.ok) throw providerError(forecastResponse, "The weather provider returned an error. Please try again later.");
  let forecast;
  try {
    forecast = await forecastResponse.json();
  } catch {
    throw new Error("The weather provider returned an invalid response.");
  }
  return normalizeForecast(query, { ...geocode, latitude, longitude }, forecast, resolution);
}

const PLACE_QUALIFIERS = new Set(["district", "dist", "tehsil", "tahsil", "taluka", "state"]);

function normalizePlaceTerm(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !PLACE_QUALIFIERS.has(token))
    .join(" ");
}

function isIndianPlace(place) {
  const countryCode = String(place.country_code || place.countryCode || "").toUpperCase();
  const country = normalizePlaceTerm(place.country);
  return countryCode === "IN" || country === "india";
}

function placeSpecificity(place) {
  const type = String(place.place_type || place.type || place.feature_code || "").toLowerCase();
  if (/(hamlet|village|locality|neighbourhood|suburb|quarter|residential)/.test(type)) return 40;
  if (/(town|ppl)/.test(type)) return 30;
  if (type.includes("city")) return 20;
  if (/(tehsil|tahsil|taluka|subdistrict)/.test(type)) return 10;
  return 0;
}

function scorePlace(place, query) {
  const normalizedQuery = normalizePlaceTerm(query);
  const names = [place.name, ...(Array.isArray(place.alternateNames) ? place.alternateNames : [])].map(normalizePlaceTerm).filter(Boolean);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const context = normalizePlaceTerm([place.admin1, place.admin2, place.admin3, place.country].filter(Boolean).join(" "));
  const nameMatches = tokens.filter((token) => names.some((name) => name.includes(token))).length;
  const contextMatches = tokens.filter((token) => context.includes(token)).length;
  const exactName = names.some((name) => name === normalizedQuery || normalizedQuery.startsWith(`${name} `));
  return (exactName ? 1000 : 0) + nameMatches * 10 + contextMatches * 3 + placeSpecificity(place);
}

function selectPlace(results, query) {
  const queryParts = String(query || "").split(",").map((part) => part.trim()).filter(Boolean);
  const nameQuery = normalizePlaceTerm(queryParts[0] || query);
  const contextTokens = normalizePlaceTerm(queryParts.slice(1).join(" ")).split(" ").filter(Boolean);
  const ranked = results
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && isIndianPlace(place))
    .sort((a, b) => scorePlace(b, query) - scorePlace(a, query));
  const place = ranked.find((candidate) => {
    const names = [candidate.name, ...(Array.isArray(candidate.alternateNames) ? candidate.alternateNames : [])].map(normalizePlaceTerm).filter(Boolean);
    const exactName = names.some((name) => name === nameQuery || nameQuery.startsWith(`${name} `));
    const context = normalizePlaceTerm([candidate.admin1, candidate.admin2, candidate.admin3, candidate.country].filter(Boolean).join(" "));
    return exactName && contextTokens.every((token) => context.includes(token));
  });
  return place ? { place, resolution: "exact" } : null;
}

async function requestOpenMeteoPlaces(search) {
  const params = new URLSearchParams({ name: search, count: "100", language: "en", format: "json", countryCode: "IN" });
  const response = await withTimeout(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) throw providerError(response, "The weather provider returned a location error.");
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function normalizeNominatimPlace(result) {
  const address = result?.address || {};
  return {
    name: result?.name || address.hamlet || address.village || address.town || address.city || address.locality || address.suburb || address.municipality || address.county || "",
    alternateNames: [address.hamlet, address.village, address.town, address.city, address.locality, address.suburb, address.neighbourhood, address.municipality, address.county].filter(Boolean),
    admin1: address.state || "",
    admin2: address.state_district || address.county || "",
    admin3: address.suburb || address.city_district || address.tehsil || "",
    country: address.country || "",
    country_code: String(address.country_code || "").toUpperCase(),
    latitude: Number(result?.lat),
    longitude: Number(result?.lon),
    place_type: result?.type || result?.category || "",
  };
}

async function requestNominatimPlaces(query) {
  const params = new URLSearchParams({ format: "jsonv2", q: query, countrycodes: "in", limit: "20", addressdetails: "1", namedetails: "1" });
  const response = await withTimeout(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "Krishak Agricultural Platform weather feature" },
  });
  if (!response.ok) throw providerError(response, "The weather provider returned a location error.");
  const payload = await response.json();
  return Array.isArray(payload) ? payload.map(normalizeNominatimPlace) : [];
}

async function geocodeLocation(query) {
  const searches = [query];
  const firstPart = query.split(",")[0].trim();
  if (firstPart && normalizePlaceTerm(firstPart) !== normalizePlaceTerm(query)) searches.push(firstPart);
  const candidates = [];
  let lastError = null;

  for (const search of searches) {
    try { candidates.push(...await requestOpenMeteoPlaces(search)); }
    catch (error) { lastError = error; }
  }
  try { candidates.push(...await requestNominatimPlaces(query)); }
  catch (error) { lastError = error; }

  const selected = selectPlace(candidates, query);
  if (selected) return selected;
  if (candidates.length === 0 && lastError) throw lastError;
  return null;
}

export async function getWeatherForLocation(location) {
  const query = typeof location === "string" ? location.trim() : "";
  if (!query) throw new Error("Enter a town, district, or village to check the weather.");

  const selected = await geocodeLocation(query);
  if (!selected) throw new Error("Exact location not found. Add the village, locality, tehsil, district, or state to disambiguate the place.");
  return getForecastForCoordinates(query, selected.place.latitude, selected.place.longitude, selected.place, selected.resolution);
}

function validateCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Current location coordinates are invalid.");
  }
}

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await withTimeout(`${REVERSE_GEOCODING_URL}?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=10&addressdetails=1`, {
      headers: { Accept: "application/json", "User-Agent": "Krishak Agricultural Platform weather feature" },
    });
    if (!response.ok) return { name: "Current location" };
    const payload = await response.json();
    const address = payload.address || {};
    if (String(address.country_code || "").toUpperCase() !== "IN") return { name: "Current location" };
    const name = address.hamlet || address.village || address.locality || address.neighbourhood || address.quarter || address.suburb || address.town || address.city || address.municipality || address.city_district || address.state_district || address.county || address.state || "Current location";
    return { name, admin1: address.state || "", country: address.country || "" };
  } catch {
    return { name: "Current location" };
  }
}

export async function getWeatherForCoordinates(latitude, longitude) {
  validateCoordinates(latitude, longitude);
  const isWithinIndia = latitude >= 6 && latitude <= 38.5 && longitude >= 68 && longitude <= 97.5;
  if (!isWithinIndia) {
    throw new Error("Current location coordinates are outside India. Search manually or pick your exact location on the map.");
  }
  const geocode = await reverseGeocode(latitude, longitude);
  return getForecastForCoordinates("Selected location", latitude, longitude, geocode, "coordinate");
}

export function registerWeatherRoutes(app) {
  app.get("/api/weather", async (req, res) => {
    try {
      const hasLatitude = req.query.latitude !== undefined;
      const hasLongitude = req.query.longitude !== undefined;
      if (hasLatitude || hasLongitude) {
        if (!hasLatitude || !hasLongitude) throw new Error("Current location requires both latitude and longitude.");
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const data = await getWeatherForCoordinates(latitude, longitude);
        res.json(data);
        return;
      }
      const data = await getWeatherForLocation(req.query.location);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The weather service returned an unexpected error.";
      const status = message.includes("Exact location not found") ? 404 : message.includes("invalid") || message.includes("requires both") ? 400 : message.includes("rate limit") ? 429 : 502;
      res.status(status).json({ error: message });
    }
  });
}

export { geocodeLocation, getDayNight, normalizeForecast, selectPlace, validateCoordinates, reverseGeocode };
