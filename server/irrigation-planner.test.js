import { describe, expect, it } from "vitest";
import { IRRIGATION_STATUS, buildIrrigationRecommendation, createPlannerTask, getPlannerTaskPriority, validatePlannerInputs } from "../client/src/irrigationPlanner.js";

const validInputs = { crop: "Tomato", soil: "Loamy", method: "Drip", area: "1", lastWatered: "2026-08-20" };
const clearWeather = {
  location: { name: "Mandsaur" },
  current: { temperatureC: 31, humidityPercent: 45, condition: "Clear sky" },
  forecast: [{ date: "2026-08-24", weatherCode: 0, condition: "Clear sky" }],
};

describe("weather-informed irrigation planner", () => {
  it.each([
    [{ ...validInputs, area: "0" }, "Enter a plot area greater than 0 acres."],
    [{ ...validInputs, area: "-1" }, "Enter a plot area greater than 0 acres."],
    [{ ...validInputs, lastWatered: "2999-01-01" }, "Last-watered date cannot be in the future."],
    [{ ...validInputs, crop: "" }, "Select a crop before creating a plan."],
    [{ ...validInputs, soil: "" }, "Select a soil type before creating a plan."],
    [{ ...validInputs, method: "" }, "Select an irrigation method before creating a plan."],
  ])("validates required planner inputs", (inputs, expected) => {
    expect(validatePlannerInputs(inputs)).toBe(expected);
  });

  it("returns insufficient data rather than fixed litres when weather or verified agronomic inputs are missing", () => {
    const result = buildIrrigationRecommendation(validInputs, null);
    expect(result.status).toBe(IRRIGATION_STATUS.INSUFFICIENT_DATA);
    expect(result.estimatedWaterLitres).toBeNull();
    expect(result.limitations).toContain("Water quantity cannot be estimated reliably from the available verified inputs.");
  });

  it("reports a limited non-weather plan when the existing weather provider fails", () => {
    const result = buildIrrigationRecommendation(validInputs, null, { weatherUnavailable: true });
    expect(result.status).toBe(IRRIGATION_STATUS.INSUFFICIENT_DATA);
    expect(result.reason).toContain("Weather data is temporarily unavailable");
  });

  it("retains a weather-informed but non-directive recommendation for a dry/hot context without fabricating a threshold", () => {
    const result = buildIrrigationRecommendation(validInputs, clearWeather);
    expect(result.status).toBe(IRRIGATION_STATUS.INSUFFICIENT_DATA);
    expect(result.weatherFactors).toContain("Current temperature: 31°C");
    expect(result.recommendation).toBe("No irrigation timing is issued");
  });

  it("marks rain-coded forecast conditions weather-dependent without asserting rainfall sufficiency", () => {
    const result = buildIrrigationRecommendation(validInputs, { ...clearWeather, forecast: [{ date: "2026-08-24", weatherCode: 63, condition: "Moderate rain" }] });
    expect(result.status).toBe(IRRIGATION_STATUS.WEATHER_DEPENDENT);
    expect(result.reason).toContain("cannot determine whether forecast rain is sufficient");
    expect(result.estimatedWaterLitres).toBeNull();
  });

  it("keeps crop, soil, and irrigation method transparent as inputs rather than fabricating unsupported coefficients", () => {
    const result = buildIrrigationRecommendation({ ...validInputs, crop: "Rice", soil: "Clayey", method: "Flood" }, clearWeather);
    expect(result.inputSummary.join(" ")).toContain("Crop: Rice");
    expect(result.inputSummary.join(" ")).toContain("Soil type: Clayey");
    expect(result.inputSummary.join(" ")).toContain("Irrigation method: Flood");
    expect(result.limitations.join(" ")).toContain("Crop-specific irrigation guidance is not available from a verified source for the selected Rice.");
  });

  it("creates a session task with due date and recommendation-derived priority", () => {
    expect(getPlannerTaskPriority(IRRIGATION_STATUS.IRRIGATE_NOW)).toBe("High");
    expect(getPlannerTaskPriority(IRRIGATION_STATUS.WEATHER_DEPENDENT)).toBe("Medium");
    const task = createPlannerTask({ title: "Review forecast", dueDate: "2026-08-24", priority: "Low" });
    expect(task).toMatchObject({ title: "Review forecast", dueDate: "2026-08-24", priority: "Low", completed: false });
  });

  it("rejects incomplete session tasks", () => {
    expect(() => createPlannerTask({ title: "", dueDate: "2026-08-24", priority: "Low" })).toThrow("Enter a task title.");
    expect(() => createPlannerTask({ title: "Review", dueDate: "", priority: "Low" })).toThrow("Choose a due date");
  });
});
