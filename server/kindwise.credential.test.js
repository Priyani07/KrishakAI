import { describe, expect, it } from "vitest";
import "dotenv/config";

const KINDWISE_USAGE_URL = "https://crop.kindwise.com/api/v1/usage_info";
const hasKey = Boolean(process.env.KINDWISE_API_KEY);

describe("Kindwise crop.health credential", () => {
  it.skipIf(!hasKey)(
    "authorizes the configured server-side API key without exposing it",
    async () => {
      // Key is present in .env — verify it is accepted by the live Kindwise endpoint
      const response = await fetch(KINDWISE_USAGE_URL, {
        headers: { "Api-Key": process.env.KINDWISE_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });

      expect(response.status).toBe(200);
      const usage = await response.json();
      expect(typeof usage.active).toBe("boolean");
      expect(usage.can_use_credits).toBeTruthy();
      expect(typeof usage.can_use_credits.value).toBe("boolean");
    },
    15_000,
  );

  it("keeps KINDWISE_API_KEY absent from VITE/client bundle configuration", () => {
    // The key must never appear in client-facing environment variables
    const viteKeys = Object.keys(process.env).filter((k) => k.startsWith("VITE_"));
    expect(viteKeys).not.toContain("VITE_KINDWISE_API_KEY");
  });
});
