import { describe, expect, it } from "vitest";
import { VERIFIED_TRANSLATION_ROUTES, getMissingHindiTranslationKeys, getTranslationIntegrityIssues, translations, translateUiText } from "../client/src/i18n/translations.js";

describe("application language coverage registry", () => {
  it("has a non-empty Hindi translation for every registered English translation key", () => {
    expect(getTranslationIntegrityIssues()).toEqual([]);
    expect(getMissingHindiTranslationKeys(Object.keys(translations.en))).toEqual([]);
  });

  it("keeps verified user-facing route coverage explicit and does not include arbitrary paths", () => {
    expect(VERIFIED_TRANSLATION_ROUTES).toEqual(expect.arrayContaining(["/", "/weather", "/disease-detection", "/animal-intrusion", "/soil-analysis", "/guide", "/guide/soil-testing", "/guide/crop-recommendation", "/guide/hybrid-seed", "/planner", "/community", "/community/discussion-forum", "/community/discussion-forum/details", "/community/sikayat-kendra", "/resources", "/profile", "/chatbot"]));
    expect(VERIFIED_TRANSLATION_ROUTES).not.toContain("/arbitrary-route");
  });

  it("uses a safe English fallback for missing future text and round-trips known presentation text", () => {
    expect(translateUiText("Future component text", "hi")).toBe("Future component text");
    expect(translateUiText("Weather", "hi")).toBe("मौसम");
    expect(translateUiText("मौसम", "en")).toBe("Weather");
  });

  it("covers representative visible UI from each major feature in Hindi", () => {
    const representativeKeys = [
      "Home", "Weather", "Disease Detection", "Animal / Farm Intrusion Detection", "Irrigation Planner", "Soil Testing", "Nutrient Levels Chart", "Crop Recommendation", "Hybrid Seed Reference Catalogue", "Analyze soil image", "Discussion Forums", "Sikayat Kendra", "DISCUSSION CHAT", "Chat connected", "Profile", "Login", "KRISHAK AI / FARMER ASSISTANT", "Resources & Support", "Voice", "Microphone permission was denied. You can continue using manual navigation.",
    ];

    expect(getMissingHindiTranslationKeys(representativeKeys)).toEqual([]);
    representativeKeys.forEach((key) => {
      expect(translateUiText(key, "hi")).not.toBe(key);
    });
  });

  it("translates the Krishak AI zero-state character count through the centralized registry", () => {
    expect(translateUiText("0/2000 characters", "hi")).toBe("0/2000 अक्षर");
    expect(translateUiText("/2000 characters", "hi")).toBe("/2000 अक्षर");
    expect(translateUiText("0/2000 characters", "en")).toBe("0/2000 characters");
  });

  it("translates every Discussion Forum loading, retry, pagination, and empty-state label", () => {
    const discussionStateKeys = [
      "Loading discussions…",
      "Requesting the first page of persisted Community discussions.",
      "Retry feed",
      "Loading more…",
      "Retry load more",
      "No discussions yet.",
      "Be the first to start a field conversation.",
      "No loaded discussions match this search.",
      "Try another term or load more discussions.",
      "No discussions loaded.",
      "No more discussions to load.",
    ];

    expect(getMissingHindiTranslationKeys(discussionStateKeys)).toEqual([]);
    discussionStateKeys.forEach((key) => expect(translateUiText(key, "hi")).not.toBe(key));
    expect(translateUiText("Loading discussions…", "hi")).toBe("चर्चाएँ लोड हो रही हैं…");
    expect(translateUiText("Requesting the first page of persisted Community discussions.", "hi")).toBe("सहेजी गई चर्चाओं का पहला पृष्ठ प्राप्त किया जा रहा है।");
    expect(translateUiText("Loading discussions…", "en")).toBe("Loading discussions…");
  });

  it("has a translated static-interface anchor for every verified route", () => {
    const routeAnchors = {
      "/": "KRISHAK / MAIN FIELD ATLAS", "/disease-farm-intrusion": "KRISHAK / FARM PROTECTION", "/planner": "FIELD TOOL / IRRIGATION PLANNER", "/weather": "FIELD TOOL / WEATHER APP", "/disease-detection": "Disease Detection", "/animal-intrusion": "Animal / Farm Intrusion Detection", "/soil-analysis": "FIELD TOOL / SOIL ANALYSIS", "/guide": "Farmer's Guide", "/guide/soil-testing": "FIELD GUIDE / SOIL TESTING", "/guide/hybrid-seed": "FIELD GUIDE / REFERENCE SEED CATALOGUE", "/guide/fertilizers": "FIELD GUIDE / FERTILIZERS", "/guide/soil-types": "FIELD GUIDE / SOIL TYPES", "/guide/crop-recommendation": "FIELD GUIDE / CROP REFERENCE", "/community": "COMMUNITY / KRISHAK", "/community/discussion-forum": "COMMUNITY / DISCUSSION FORUM", "/community/discussion-forum/create": "COMMUNITY / CREATE DISCUSSION", "/community/discussion-forum/details": "COMMUNITY / DISCUSSION DETAILS", "/community/sikayat-kendra": "COMMUNITY / SIKAYAT KENDRA", "/community/community-events": "COMMUNITY / EVENTS", "/community/community-events/details": "COMMUNITY / EVENT DETAILS", "/resources": "COMMUNITY / RESOURCES", "/login": "COMMUNITY / LOGIN", "/signup": "COMMUNITY / SIGNUP", "/profile": "COMMUNITY / PROFILE", "/chatbot": "KRISHAK AI / FARMER ASSISTANT", "/community-forum": "COMMUNITY / DISCUSSION FORUM",
    };

    expect(Object.keys(routeAnchors).sort()).toEqual([...VERIFIED_TRANSLATION_ROUTES].sort());
    Object.values(routeAnchors).forEach((key) => expect(translateUiText(key, "hi")).not.toBe(key));
  });
});
