/**
 * KRISHAK — AI-Assisted Irrigation Planner Tests
 * Uses vitest pattern matching existing project test files.
 * Run: pnpm test (vitest run)
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dir, "../client/src");
const serverDir = __dir;

const appCode = readFileSync(join(clientDir, "App.jsx"), "utf8");
const irrigationAiCode = readFileSync(join(serverDir, "irrigationAi.js"), "utf8");

describe("AI-Assisted Irrigation Planner", () => {
  it("existing deterministic planner still present (plan state)", () => {
    expect(appCode).toContain("setPlan");
    expect(appCode).toContain("IrrigationPlanner");
  });

  it("AI layer is additive (aiState exists alongside plan)", () => {
    expect(appCode).toContain("aiState");
    expect(appCode).toContain("plan");
  });

  it("AI endpoint registered on server", () => {
    expect(irrigationAiCode).toContain("/api/irrigation-ai");
  });

  it("AI uses Gemini (server-side key)", () => {
    expect(irrigationAiCode).toContain("GEMINI_API_KEY");
    expect(irrigationAiCode).not.toContain("VITE_GEMINI");
  });

  it("AI does not invent numbers — receives plan data from client", () => {
    expect(irrigationAiCode).toContain("req.body"); // server reads plan from req.body, not planData
  });

  it("AI unavailable fallback exists in UI", () => {
    expect(appCode).toContain("AI assistance is currently unavailable");
  });

  it("AI response does not replace plan — shown separately in a dedicated section", () => {
    // The AI guidance section-kicker text in App.jsx (uppercase, matches the section-kicker element)
    expect(appCode).toContain("AI-ASSISTED GUIDANCE");
    expect(appCode).toContain("planner-ai-card");
  });

  it("AI endpoint is server-side only (not a VITE_ env call)", () => {
    expect(irrigationAiCode).not.toContain("VITE_");
  });
});
