import { describe, expect, it } from "vitest";
import "dotenv/config";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const hasKey = Boolean(process.env.GEMINI_API_KEY);

describe("Gemini credentials", () => {
  it.skipIf(!hasKey)(
    "accepts the configured server-only key",
    async () => {
      const key = process.env.GEMINI_API_KEY;
      const url = GEMINI_MODELS_URL + "?key=" + encodeURIComponent(key);
      const response = await fetch(url);
      expect(response.ok, `Gemini credential check returned HTTP ${response.status}`).toBe(true);
    },
    15_000,
  );

  it("keeps GEMINI_API_KEY absent from VITE/client bundle configuration", () => {
    // The key must never appear in client-facing environment variables
    const viteKeys = Object.keys(process.env).filter((k) => k.startsWith("VITE_"));
    expect(viteKeys).not.toContain("VITE_GEMINI_API_KEY");
  });
});
