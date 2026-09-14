import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMissingHindiTranslationKeys, translateUiText, VERIFIED_TRANSLATION_ROUTES } from "../client/src/i18n/translations.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "../client/src/App.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(here, "../client/src/index.css"), "utf8");

describe("Disease Detection & Farm Intrusion overview", () => {
  it("registers the overview without replacing operational routes", () => {
    expect(appSource).toContain('if (path === "/disease-farm-intrusion") return <DiseaseFarmIntrusionOverviewPage />;');
    expect(appSource).toContain('if (path === "/disease-detection") return <ImageDetectionPage kind="disease" />;');
    expect(appSource).toContain('if (path === "/animal-intrusion") return <ImageDetectionPage kind="intrusion" />;');
  });

  it("renders one scroll CTA and two separate feature choices", () => {
    expect(appSource).toContain('id="farm-safety-features"');
    expect(appSource).toContain('>{t("Get Started")}');
    expect(appSource).toContain('href="/disease-detection"');
    expect(appSource).toContain('href="/animal-intrusion"');
    expect((appSource.match(/className="farm-safety-card /g) || []).length).toBe(2);
  });

  it("respects reduced motion and gives the scroll target focus", () => {
    expect(appSource).toContain('window.matchMedia?.("(prefers-reduced-motion: reduce)").matches');
    expect(appSource).toContain('behavior: reducedMotion ? "auto" : "smooth"');
    expect(appSource).toContain('tabIndex="-1"');
  });

  it("stacks the equal cards on narrow screens", () => {
    expect(cssSource).toContain('.farm-safety-overview__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(cssSource).toContain('@media (max-width: 760px)');
    expect(cssSource).toContain('.farm-safety-overview__grid { grid-template-columns: 1fr; }');
  });

  it("has centralized English/Hindi coverage for every overview string", () => {
    const keys = [
      "KRISHAK / FARM PROTECTION",
      "Disease Detection & Farm Intrusion",
      "Check crop images for possible disease and monitor your farm for possible animal or person intrusion.",
      "Get Started",
      "CHOOSE A FARM SAFETY TOOL",
      "Disease Detection",
      "Upload a crop image to check for possible plant diseases.",
      "Open Detection",
      "Animal & Farm Intrusion",
      "Monitor possible animals or people entering the farm area.",
      "Open Monitoring",
    ];
    expect(getMissingHindiTranslationKeys(keys)).toEqual([]);
    expect(translateUiText("Get Started", "hi")).toBe("शुरू करें");
    expect(translateUiText("Open Detection", "hi")).toBe("रोग पहचान खोलें");
    expect(translateUiText("Open Monitoring", "hi")).toBe("निगरानी खोलें");
    expect(VERIFIED_TRANSLATION_ROUTES).toContain("/disease-farm-intrusion");
  });

  it("keeps the existing animal voice alias route available", () => {
    const voiceSource = fs.readFileSync(path.join(here, "../client/src/voiceNavigation.js"), "utf8");
    expect(voiceSource).toContain('canonicalName: "Animal / Farm Intrusion"');
    expect(voiceSource).toContain('"/animal-intrusion"');
    expect(voiceSource).toContain('"animal"');
  });
});
