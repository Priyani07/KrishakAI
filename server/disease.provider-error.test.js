import { describe, expect, it, vi } from "vitest";
import { getSafeProviderError } from "./disease.js";
import { KindwiseCropHealthError } from "./kindwiseCropHealth.js";
import { detectDisease } from "../client/src/services/phase3Services.js";

describe("Disease Detection provider error contract", () => {
  it("preserves a Kindwise rate-limit classification without exposing provider details", () => {
    expect(getSafeProviderError(new KindwiseCropHealthError("rate_limited", "private provider body"))).toEqual({
      status: 502,
      code: "rate_limited",
      message: "Kindwise disease detection quota is unavailable. Please try again later.",
    });
  });

  it("classifies a missing Kindwise key separately", () => {
    expect(getSafeProviderError(new KindwiseCropHealthError("missing_api_key", "private configuration detail"))).toEqual({
      status: 503,
      code: "missing_api_key",
      message: "Disease detection is not configured. Try again later.",
    });
  });

  it("preserves structured server errors in the frontend service boundary", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Kindwise disease detection quota is unavailable. Please try again later.", code: "rate_limited" }), { status: 502, headers: { "content-type": "application/json" } }));
    await expect(detectDisease(new File(["image"], "leaf.png", { type: "image/png" }))).rejects.toMatchObject({ code: "rate_limited", status: 502, message: "Kindwise disease detection quota is unavailable. Please try again later." });
    globalThis.fetch = originalFetch;
  });
});
