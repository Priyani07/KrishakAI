import { describe, expect, it } from "vitest";
import { APPLICATION_LANGUAGES, DEFAULT_APPLICATION_LANGUAGE, getMissingHindiTranslationKeys, getVoiceRecognitionLocale, normalizeApplicationLanguage, translateUiText } from "../client/src/i18n/translations.js";

describe("shared application language system", () => {
  it("defaults safely to English and maps the two supported Voice locales", () => {
    expect(DEFAULT_APPLICATION_LANGUAGE).toBe("en");
    expect(normalizeApplicationLanguage()).toBe("en");
    expect(normalizeApplicationLanguage("hi")).toBe("hi");
    expect(normalizeApplicationLanguage("hi-IN")).toBe("en");
    expect(APPLICATION_LANGUAGES).toEqual({ en: "en-IN", hi: "hi-IN" });
    expect(getVoiceRecognitionLocale("en")).toBe("en-IN");
    expect(getVoiceRecognitionLocale("hi")).toBe("hi-IN");
  });

  it("translates representative global, Community, agricultural, and Voice text with English fallback", () => {
    expect(translateUiText("Home", "hi")).toBe("होम");
    expect(translateUiText("Discussion Forums", "hi")).toBe("चर्चा मंच");
    expect(translateUiText("Discussion chat is currently unavailable. Please try again later.", "hi")).toBe("चर्चा चैट अभी उपलब्ध नहीं है। कृपया बाद में फिर कोशिश करें।");
    expect(translateUiText("Check weather", "hi")).toBe("मौसम देखें");
    expect(translateUiText("Nutrient Levels Chart", "hi")).toBe("पोषक तत्व स्तर चार्ट");
    expect(translateUiText("Voice", "hi")).toBe("आवाज़");
    expect(translateUiText(" Explore now ", "hi")).toBe(" अभी देखें ");
    expect(translateUiText("आवाज़", "en")).toBe("Voice");
    expect(translateUiText("Unknown future label", "hi")).toBe("Unknown future label");
    expect(translateUiText("Community", "en")).toBe("Community");
  });

  it("keeps required Hindi keys non-empty and safely detects future omissions", () => {
    expect(getMissingHindiTranslationKeys(["Home", "Community", "Discussion Forums", "Voice"])).toEqual([]);
    expect(getMissingHindiTranslationKeys(["Home", "Missing key"])).toEqual(["Missing key"]);
  });
});
