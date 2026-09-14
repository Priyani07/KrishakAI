import { afterEach, describe, expect, it, vi } from "vitest";
import {
  geocodeLocation,
  getDayNight,
  getWeatherForCoordinates,
  normalizeForecast,
  selectPlace,
  validateCoordinates,
} from "./weather.js";
import {
  getWeather,
  getWeatherForCoordinates as requestWeatherForCoordinates,
} from "../client/src/services/weatherService.js";

const clientPayload = (latitude = 19.076, longitude = 72.8777) => ({
  location: { query: "Selected location", name: "Selected location", admin1: "", country: "India", latitude, longitude, timezone: "Asia/Kolkata", resolution: "coordinate" },
  current: { observedAt: "2026-08-21T15:00", temperatureC: 29, condition: "Mainly clear", weatherCode: 1, humidityPercent: 60, windSpeedKmh: 10 },
  dayNight: { status: "Day", sunrise: "2026-08-21T06:10", sunset: "2026-08-21T18:40" },
  forecast: [{ date: "2026-08-21", condition: "Mainly clear", weatherCode: 1, minTemperatureC: 22, maxTemperatureC: 31 }],
  source: "Open-Meteo",
});

const forecastPayload = {
  timezone: "Asia/Kolkata",
  current: { time: "2026-08-21T15:00", temperature_2m: 29, relative_humidity_2m: 60, weather_code: 1, wind_speed_10m: 10, is_day: 1 },
  daily: {
    time: ["2026-08-21", "2026-08-22", "2026-08-23"],
    weather_code: [1, 2, 3],
    temperature_2m_min: [22, 23, 24],
    temperature_2m_max: [31, 32, 33],
    sunrise: ["2026-08-21T06:10", "2026-08-22T06:11", "2026-08-23T06:12"],
    sunset: ["2026-08-21T18:40", "2026-08-22T18:40", "2026-08-23T18:39"],
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Weather server provider contract", () => {
  it("normalizes Open-Meteo conditions without inventing missing data", () => {
    const result = normalizeForecast(
      "Nashik, Maharashtra",
      { name: "Nashik", admin1: "Maharashtra", country: "India", latitude: 19.99, longitude: 73.79, timezone: "Asia/Kolkata" },
      forecastPayload,
    );
    expect(result).toMatchObject({
      source: "Open-Meteo",
      location: { name: "Nashik", latitude: 19.99, longitude: 73.79 },
      current: { temperatureC: 29, humidityPercent: 60, windSpeedKmh: 10 },
    });
    expect(result.forecast).toHaveLength(3);
  });

  it("rejects incomplete provider responses", () => {
    expect(() => normalizeForecast("Nashik", { name: "Nashik", latitude: 19, longitude: 73 }, {})).toThrow("invalid response");
  });

  it("validates coordinate ranges", () => {
    expect(() => validateCoordinates(-90, 180)).not.toThrow();
    expect(() => validateCoordinates(90.1, 0)).toThrow("coordinates are invalid");
    expect(() => validateCoordinates(0, Number.NaN)).toThrow("coordinates are invalid");
  });

  it("uses provider sunrise and sunset for day/night status", () => {
    expect(getDayNight({ time: "2026-08-21T08:00" }, forecastPayload.daily)).toMatchObject({ status: "Day" });
    expect(getDayNight({ time: "2026-08-21T20:00" }, forecastPayload.daily)).toMatchObject({ status: "Night" });
  });

  it("selects only an exact name plus context match", () => {
    const results = [
      { name: "Piplia Mandi", admin1: "Madhya Pradesh", admin2: "Mandsaur", latitude: 24.2071, longitude: 75.0708, feature_code: "PPL" },
      { name: "Piplia", admin1: "Rajasthan", latitude: 25, longitude: 75, feature_code: "PPL" },
    ];
    expect(selectPlace(results, "Piplia Mandi, Mandsaur, Madhya Pradesh")).toMatchObject({ place: { latitude: 24.2071, longitude: 75.0708 }, resolution: "exact" });
    expect(selectPlace([{ name: "Nearby village", admin1: "Other state", latitude: 20, longitude: 75 }], "Unknown hamlet")).toBeNull();
  });

  it("prioritizes India-scoped provider results for an exact local settlement", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ name: "Kothapalli", admin1: "Telangana", admin2: "Karimnagar", country: "India", country_code: "IN", latitude: 18.438, longitude: 79.094, feature_code: "PPL" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const selected = await geocodeLocation("Kothapalli, Karimnagar, Telangana");
    expect(selected).toMatchObject({ place: { name: "Kothapalli", latitude: 18.438, longitude: 79.094 }, resolution: "exact" });
    const providerUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(providerUrl.searchParams.get("countryCode")).toBe("IN");
    expect(providerUrl.searchParams.get("count")).toBe("100");
  });

  it("uses the existing Nominatim boundary when an Indian village is absent from Open-Meteo search", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ name: "Devpura", lat: "25.4101", lon: "75.5212", type: "village", address: { village: "Devpura", state_district: "Bundi", state: "Rajasthan", country: "India", country_code: "in" } }]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const selected = await geocodeLocation("Devpura, Bundi, Rajasthan");
    expect(selected).toMatchObject({ place: { name: "Devpura", latitude: 25.4101, longitude: 75.5212 }, resolution: "exact" });
    const providerUrl = new URL(fetchMock.mock.calls[2][0]);
    expect(providerUrl.hostname).toBe("nominatim.openstreetmap.org");
    expect(providerUrl.searchParams.get("countrycodes")).toBe("in");
  });

  it("keeps selected coordinates exact even when reverse geocoding fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(forecastPayload), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getWeatherForCoordinates(24.207123, 75.070812);
    expect(result.location).toMatchObject({ name: "Selected location", latitude: 24.207123, longitude: 75.070812, resolution: "coordinate" });
    const forecastUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(forecastUrl.searchParams.get("latitude")).toBe("24.207123");
    expect(forecastUrl.searchParams.get("longitude")).toBe("75.070812");
  });
});

describe("Weather browser-to-server boundary", () => {
  it("rejects an empty search before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getWeather(" ")).rejects.toThrow("Enter a town");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the configured or same-origin server endpoint for place search", async () => {
    vi.stubEnv("VITE_WEATHER_API_URL", "/api/weather");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(clientPayload()), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await getWeather("Piplia Mandi");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/weather?location=Piplia+Mandi");
  });

  it("forwards two different map coordinate pairs unchanged in one request each", async () => {
    vi.stubEnv("VITE_WEATHER_API_URL", "/api/weather");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(clientPayload(24.207123, 75.070812)), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(clientPayload(19.99727, 73.79096)), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await requestWeatherForCoordinates(24.207123, 75.070812);
    await requestWeatherForCoordinates(19.99727, 73.79096);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([raw]) => {
      const url = new URL(raw, "http://local.test");
      return [url.searchParams.get("latitude"), url.searchParams.get("longitude")];
    })).toEqual([
      ["24.207123", "75.070812"],
      ["19.99727", "73.79096"],
    ]);
  });

  it("rejects invalid coordinates before contacting the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestWeatherForCoordinates(91, 72)).rejects.toThrow("coordinates are invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a structured server error without fallback weather", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "The weather provider returned an error." }), { status: 502, headers: { "content-type": "application/json" } })));
    await expect(requestWeatherForCoordinates(24.2, 75.1)).rejects.toThrow("weather provider returned an error");
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ location: {} }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(getWeather("Nashik")).rejects.toThrow("invalid response");
  });
});
