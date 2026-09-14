import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSoilImage } from "../client/src/services/phase3Services.js";

const responsePayload = {
  imageStatus: "soil_image",
  likelySoilType: "Likely loam",
  visibleCharacteristics: ["Crumbly-looking surface"],
  suitableCrops: ["Wheat"],
  irrigationAdvice: ["Check drainage and irrigate according to field conditions"],
  managementAdvice: ["Verify the observation with a local soil test"],
  note: "Image-based observation only.",
  provider: "Gemini",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Soil Analysis browser-to-server boundary", () => {
  it("posts the selected image to the configured endpoint", async () => {
    vi.stubEnv("VITE_SOIL_ANALYSIS_API_URL", "/api/soil-analysis");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["soil-image"], "soil.png", { type: "image/png" });

    await expect(analyzeSoilImage(file)).resolves.toEqual(responsePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/soil-analysis");
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get("image")).toBe(file);
  });

  it("preserves the server unconfigured state and never substitutes a result", async () => {
    vi.stubEnv("VITE_SOIL_ANALYSIS_API_URL", "/api/soil-analysis");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "AI_NOT_CONFIGURED",
      error: "Soil image analysis is not configured.",
    }), { status: 503, headers: { "content-type": "application/json" } })));

    await expect(analyzeSoilImage(new File(["soil-image"], "soil.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 503,
    });
  });
});
