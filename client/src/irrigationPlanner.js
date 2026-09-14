export const IRRIGATION_STATUS = Object.freeze({
  IRRIGATE_NOW: "IRRIGATE_NOW",
  WAIT: "WAIT",
  WEATHER_DEPENDENT: "WEATHER_DEPENDENT",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
});

const WET_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 85, 86, 95, 96, 99]);

export function validatePlannerInputs(inputs) {
  const area = Number(inputs?.area);
  if (!inputs?.crop) return "Select a crop before creating a plan.";
  if (!inputs?.soil) return "Select a soil type before creating a plan.";
  if (!inputs?.method) return "Select an irrigation method before creating a plan.";
  if (!Number.isFinite(area) || area <= 0) return "Enter a plot area greater than 0 acres.";
  if (inputs?.lastWatered) {
    const lastWatered = new Date(`${inputs.lastWatered}T00:00:00`);
    if (Number.isNaN(lastWatered.getTime())) return "Choose a valid last-watered date.";
    if (lastWatered > new Date()) return "Last-watered date cannot be in the future.";
  }
  return "";
}

export function hasWetForecast(weather) {
  return Boolean(weather?.forecast?.some((day) => WET_WEATHER_CODES.has(day.weatherCode)));
}

export function getPlannerTaskPriority(status) {
  if (status === IRRIGATION_STATUS.IRRIGATE_NOW) return "High";
  if (status === IRRIGATION_STATUS.WEATHER_DEPENDENT) return "Medium";
  return "Low";
}

function inputSummary(inputs, weather) {
  return [
    `Crop: ${inputs.crop}`,
    `Soil type: ${inputs.soil} (classification only; not a soil-moisture reading)`,
    `Irrigation method: ${inputs.method} (context only; no verified efficiency parameter applied)`,
    `Plot area: ${inputs.area} acres (not converted to a water volume without verified demand data)`,
    `Last watered: ${inputs.lastWatered || "not provided"}`,
    weather?.location?.name ? `Weather location: ${weather.location.name}` : "Weather location: not available",
  ];
}

function baseLimitations(inputs) {
  return [
    `Crop-specific irrigation guidance is not available from a verified source for the selected ${inputs.crop}.`,
    "No crop growth stage, locally validated crop coefficient, or reference evapotranspiration value is available in this Planner contract.",
    "No measured root-zone soil-moisture reading is available.",
    "Water quantity cannot be estimated reliably from the available verified inputs.",
  ];
}

export function buildIrrigationRecommendation(inputs, weather, { weatherUnavailable = false } = {}) {
  const validationError = validatePlannerInputs(inputs);
  if (validationError) {
    return { status: IRRIGATION_STATUS.INSUFFICIENT_DATA, recommendation: "Complete the field inputs", reason: validationError, nextActionDate: null, estimatedWaterLitres: null, weatherFactors: [], inputSummary: [], limitations: [], sources: [] };
  }

  const limitations = baseLimitations(inputs);
  if (!weather) {
    return {
      status: IRRIGATION_STATUS.INSUFFICIENT_DATA,
      recommendation: "Weather context unavailable",
      reason: weatherUnavailable ? "Weather data is temporarily unavailable. The planner can only provide a limited non-weather plan." : "Add a location to use weather-informed irrigation planning.",
      nextActionDate: null,
      estimatedWaterLitres: null,
      weatherFactors: [],
      inputSummary: inputSummary(inputs, null),
      limitations: weatherUnavailable ? ["No verified weather context was available for this plan.", ...limitations] : limitations,
      sources: [],
    };
  }

  const weatherFactors = [
    `Current temperature: ${weather.current.temperatureC}°C`,
    `Current humidity: ${weather.current.humidityPercent}%`,
    `Current condition: ${weather.current.condition}`,
    `Forecast: ${weather.forecast.map((day) => `${day.date} — ${day.condition}`).join("; ")}`,
  ];
  const wetForecast = hasWetForecast(weather);
  if (wetForecast) {
    limitations.unshift("The current Weather contract exposes forecast conditions but not verified precipitation quantity or probability.");
    return {
      status: IRRIGATION_STATUS.WEATHER_DEPENDENT,
      recommendation: "Review the forecast before irrigating",
      reason: "Rain-coded conditions are present in the selected-location forecast. This Planner cannot determine whether forecast rain is sufficient for this crop or field.",
      nextActionDate: null,
      estimatedWaterLitres: null,
      weatherFactors,
      inputSummary: inputSummary(inputs, weather),
      limitations,
      sources: ["Open-Meteo via the existing Krishak Weather service", "FAO Irrigation and Drainage Paper 56: crop water calculation requires crop stage, crop coefficient, and reference evapotranspiration."],
    };
  }

  return {
    status: IRRIGATION_STATUS.INSUFFICIENT_DATA,
    recommendation: "No irrigation timing is issued",
    reason: "Weather context is available, but verified crop-stage, crop-water, precipitation-amount, reference evapotranspiration, and root-zone moisture inputs are missing.",
    nextActionDate: null,
    estimatedWaterLitres: null,
    weatherFactors,
    inputSummary: inputSummary(inputs, weather),
    limitations,
    sources: ["Open-Meteo via the existing Krishak Weather service", "FAO Irrigation and Drainage Paper 56: crop water calculation requires crop stage, crop coefficient, and reference evapotranspiration."],
  };
}

export function createPlannerTask({ title, dueDate, priority }) {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!normalizedTitle) throw new Error("Enter a task title.");
  if (!dueDate) throw new Error("Choose a due date for this session task.");
  if (!['High', 'Medium', 'Low'].includes(priority)) throw new Error("Choose a valid task priority.");
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title: normalizedTitle, dueDate, priority, completed: false };
}
