import { describe, expect, it, vi } from "vitest";
import {
  CONTROLLED_RECOGNITION_VARIANTS,
  createVoiceNoticeTimer,
  createVoiceRecognitionSession,
  DEFAULT_VOICE_RECOGNITION_LANGUAGE,
  getVoiceLanguageButtonState,
  getRecognitionErrorMessage,
  isMicrophonePermissionError,
  getSpeechRecognitionConstructor,
  KNOWN_VOICE_ROUTES,
  MICROPHONE_PERMISSION_NOTICE_DURATION_MS,
  normalizeVoiceCommand,
  resolveFinalVoiceNavigation,
  resolveVoiceRecognitionLanguage,
  resolveVoiceNavigation,
  stopVoiceRecognitionSession,
  switchVoiceRecognitionLanguage,
  VOICE_BUTTON_LABELS,
  VOICE_INTENT_REGISTRY,
  VOICE_NAVIGATION_COMMANDS,
  VOICE_STATUS_LABELS,
} from "../client/src/voiceNavigation.js";

const target = (label, path) => ({ label, path });

describe("universal deterministic voice registry", () => {
  it("uses one complete route-safe registry with the required explicit command groups", () => {
    VOICE_INTENT_REGISTRY.forEach((intent) => {
      expect(KNOWN_VOICE_ROUTES.has(intent.route)).toBe(true);
      ["canonicalName", "exactAliases", "relatedAliases", "hindiAliases", "phraseAliases", "distinctivePrefixes"].forEach((key) => expect(intent).toHaveProperty(key));
    });
    expect(VOICE_NAVIGATION_COMMANDS).toHaveLength(VOICE_INTENT_REGISTRY.length);
  });

  it("normalizes filler, punctuation, whitespace, and apostrophe variants without fuzzy matching", () => {
    expect(normalizeVoiceCommand("  Please open   Weather! ")).toBe("weather");
    expect(normalizeVoiceCommand("Farmer's Guide")).toBe("farmers guide");
    expect(resolveVoiceNavigation("Show Weather")).toEqual(target("Weather", "/weather"));
  });

  it.each([
    ["home", target("Home", "/")], ["weather", target("Weather", "/weather")], ["disease", target("Disease Detection", "/disease-detection")], ["intrusion", target("Animal / Farm Intrusion", "/animal-intrusion")], ["animal", target("Animal / Farm Intrusion", "/animal-intrusion")], ["soil analysis", target("Soil Analysis", "/soil-analysis")], ["soil", target("Soil Testing", "/guide/soil-testing")], ["nutrient", target("Soil Testing", "/guide/soil-testing")], ["crop", target("Crop Recommendation", "/guide/crop-recommendation")], ["seed", target("Hybrid Seed", "/guide/hybrid-seed")], ["planner", target("Irrigation Planner", "/planner")], ["farmers", target("Farmer's Guide", "/guide")], ["guide", target("Farmer's Guide", "/guide")], ["resources", target("Resources", "/resources")], ["profile", target("Profile", "/profile")], ["chatbot", target("Krishak AI", "/chatbot")],
  ])("routes exact term %s", (command, expected) => expect(resolveVoiceNavigation(command)).toEqual(expected));

  it.each([
    ["forecast", target("Weather", "/weather")], ["field notes", target("Discussion Forum", "/community/discussion-forum")], ["grievance", target("Sikayat Kendra", "/community/sikayat-kendra")], ["plant disease", target("Disease Detection", "/disease-detection")], ["farm intrusion", target("Animal / Farm Intrusion", "/animal-intrusion")], ["animals", target("Animal / Farm Intrusion", "/animal-intrusion")], ["soil photo", target("Soil Analysis", "/soil-analysis")], ["soil image", target("Soil Analysis", "/soil-analysis")], ["beej", target("Hybrid Seed", "/guide/hybrid-seed")], ["fasal", target("Crop Recommendation", "/guide/crop-recommendation")], ["paani", target("Irrigation Planner", "/planner")], ["mitti", target("Soil Testing", "/guide/soil-testing")], ["support", target("Resources", "/resources")], ["dashboard", target("Home", "/")], ["kisan guide", target("Farmer's Guide", "/guide")],
  ])("routes related term %s", (command, expected) => expect(resolveVoiceNavigation(command)).toEqual(expected));

  it.each([
    ["मौसम", target("Weather", "/weather")], ["समुदाय", target("Community", "/community")], ["चर्चा", target("Discussion Forum", "/community/discussion-forum")], ["फोरम", target("Discussion Forum", "/community/discussion-forum")], ["शिकायत", target("Sikayat Kendra", "/community/sikayat-kendra")], ["शिकायत केंद्र", target("Sikayat Kendra", "/community/sikayat-kendra")], ["बीमारी", target("Disease Detection", "/disease-detection")], ["पशु", target("Animal / Farm Intrusion", "/animal-intrusion")], ["बीज", target("Hybrid Seed", "/guide/hybrid-seed")], ["फसल", target("Crop Recommendation", "/guide/crop-recommendation")], ["पानी", target("Irrigation Planner", "/planner")], ["मिट्टी", target("Soil Testing", "/guide/soil-testing")], ["किसान गाइड", target("Farmer's Guide", "/guide")], ["घर", target("Home", "/")],
  ])("routes explicit Hindi alias %s", (command, expected) => expect(resolveVoiceNavigation(command)).toEqual(expected));

  it.each([
    ["disease detection and farm", target("Animal / Farm Intrusion", "/animal-intrusion")], ["disease detection", target("Disease Detection", "/disease-detection")], ["farm intrusion", target("Animal / Farm Intrusion", "/animal-intrusion")], ["farmers guide", target("Farmer's Guide", "/guide")], ["crop recommendation", target("Crop Recommendation", "/guide/crop-recommendation")], ["analyze soil image", target("Soil Analysis", "/soil-analysis")], ["hybrid seeds", target("Hybrid Seed", "/guide/hybrid-seed")], ["crop recommend more", target("Crop Recommendation", "/guide/crop-recommendation")], ["discussion forum", target("Discussion Forum", "/community/discussion-forum")], ["open discussion forums", target("Discussion Forum", "/community/discussion-forum")], ["discussion for crop notes", target("Discussion Forum", "/community/discussion-forum")], ["open sikayat kendra", target("Sikayat Kendra", "/community/sikayat-kendra")], ["agricultural complaint", target("Sikayat Kendra", "/community/sikayat-kendra")], ["complaint center for farmers", target("Sikayat Kendra", "/community/sikayat-kendra")],
  ])("routes an explicit phrase or distinctive prefix %s", (command, expected) => expect(resolveVoiceNavigation(command)).toEqual(expected));

  it.each(Object.keys(CONTROLLED_RECOGNITION_VARIANTS))("uses only the controlled observed variant %s", (variant) => {
    expect(resolveVoiceNavigation(variant)).not.toBeNull();
  });

  it.each([
    ["community", target("Community", "/community")], ["community home", target("Community", "/community")], ["forum", target("Discussion Forum", "/community/discussion-forum")], ["forums", target("Discussion Forum", "/community/discussion-forum")], ["discussion", target("Discussion Forum", "/community/discussion-forum")], ["questions", target("Discussion Forum", "/community/discussion-forum")], ["sikayat", target("Sikayat Kendra", "/community/sikayat-kendra")], ["complaint", target("Sikayat Kendra", "/community/sikayat-kendra")], ["complaints", target("Sikayat Kendra", "/community/sikayat-kendra")], ["submit complaint", target("Sikayat Kendra", "/community/sikayat-kendra")],
  ])("prioritizes the exact nested Community route for %s", (command, expected) => expect(resolveVoiceNavigation(command)).toEqual(expected));

  it("never turns Community speech into a mutation, arbitrary URL, or discussion-detail query", () => {
    expect(resolveVoiceNavigation("create discussion about fertilizer")).toBeNull();
    expect(resolveVoiceNavigation("submit complaint about irrigation")).toBeNull();
    expect(resolveVoiceNavigation("https://example.com/community/discussion-forum/details?id=123")).toBeNull();
    expect(KNOWN_VOICE_ROUTES.has("/community/discussion-forum/details")).toBe(false);
    expect(resolveVoiceNavigation("submit complaint")).toEqual(target("Sikayat Kendra", "/community/sikayat-kendra"));
  });

  it("rejects ambiguous, unrelated, destructive, external, arbitrary, and conflicting speech", () => {
    [null, undefined, 12, "", "farmer", "farm", "monitoring", "dise", "dis", "com", "soil something", "bees", "open https://example.com", "javascript:alert(1)", "open admin", "delete my comment", "start camera", "calculate irrigation", "check weather now"].forEach((value) => {
      expect(resolveVoiceNavigation(value)).toBeNull();
    });
  });

  it("requires final transcripts even for distinctive valid terms", () => {
    expect(resolveFinalVoiceNavigation("soil analysis", false)).toBeNull();
    expect(resolveFinalVoiceNavigation("weather", false)).toBeNull();
    expect(resolveFinalVoiceNavigation("far", false)).toBeNull();
    expect(resolveFinalVoiceNavigation("weather", true)).toEqual(target("Weather", "/weather"));
  });
});

describe("voice recognition states", () => {
  it("uses English India as the default and accepts only the two explicit recognition locales", () => {
    expect(DEFAULT_VOICE_RECOGNITION_LANGUAGE).toBe("en-IN");
    expect(resolveVoiceRecognitionLanguage()).toBe("en-IN");
    expect(resolveVoiceRecognitionLanguage("en-IN")).toBe("en-IN");
    expect(resolveVoiceRecognitionLanguage("hi-IN")).toBe("hi-IN");
    expect(resolveVoiceRecognitionLanguage("en-US")).toBe("en-IN");
  });

  it("derives the visible active language state from the same selected locale", () => {
    expect(getVoiceLanguageButtonState("en-IN", "en-IN")).toEqual({ isActive: true });
    expect(getVoiceLanguageButtonState("en-IN", "hi-IN")).toEqual({ isActive: false });
    expect(getVoiceLanguageButtonState("hi-IN", "en-IN")).toEqual({ isActive: false });
    expect(getVoiceLanguageButtonState("hi-IN", "hi-IN")).toEqual({ isActive: true });
  });

  it("creates every recognition session with the currently selected language", () => {
    const sessions = [];
    function StubRecognition() {
      this.stop = () => {};
      sessions.push(this);
    }
    const target = { SpeechRecognition: StubRecognition };
    const englishSession = createVoiceRecognitionSession(target, "en-IN");
    const hindiSession = createVoiceRecognitionSession(target, "hi-IN");
    expect(sessions).toHaveLength(2);
    expect(englishSession).toMatchObject({ lang: "en-IN", continuous: false, interimResults: true, maxAlternatives: 1 });
    expect(hindiSession).toMatchObject({ lang: "hi-IN", continuous: false, interimResults: true, maxAlternatives: 1 });
  });

  it("stops an active session once and detaches its listeners before a language change", () => {
    const recognition = {
      onstart: () => {}, onresult: () => {}, onerror: () => {}, onend: () => {},
      stop: vi.fn(),
    };
    expect(stopVoiceRecognitionSession(recognition)).toBe(true);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition).toMatchObject({ onstart: null, onresult: null, onerror: null, onend: null });
  });

  it("switches from English to Hindi by stopping the old session without duplicate listeners", () => {
    const previousSession = {
      onstart: () => {}, onresult: () => {}, onerror: () => {}, onend: () => {},
      stop: vi.fn(),
    };
    const changed = switchVoiceRecognitionLanguage("en-IN", "hi-IN", previousSession);
    expect(changed).toEqual({ language: "hi-IN", changed: true, stopped: true });
    expect(previousSession.stop).toHaveBeenCalledTimes(1);
    expect(previousSession).toMatchObject({ onstart: null, onresult: null, onerror: null, onend: null });
    expect(switchVoiceRecognitionLanguage("hi-IN", "hi-IN", previousSession)).toEqual({ language: "hi-IN", changed: false, stopped: false });
    expect(previousSession.stop).toHaveBeenCalledTimes(1);
  });

  it("keeps the compact Voice and Listening labels", () => {
    expect(VOICE_STATUS_LABELS).toMatchObject({ idle: "Voice navigation", listening: "Listening…", processing: "Listening…", error: "Voice navigation unavailable", unsupported: "Voice navigation unsupported" });
    expect(VOICE_BUTTON_LABELS).toMatchObject({ idle: "Voice", listening: "Listening…", processing: "Listening…" });
  });

  it("provides safe browser-recognition errors", () => {
    expect(getRecognitionErrorMessage("not-allowed")).toBe("Microphone permission was denied. You can continue using manual navigation.");
    expect(getRecognitionErrorMessage("audio-capture")).toBe("A microphone is not available. You can continue using manual navigation.");
    expect(getRecognitionErrorMessage("no-speech")).toContain("No speech was detected");
    expect(getRecognitionErrorMessage("network")).toContain("Voice navigation unavailable");
  });

  it("keeps the microphone-denied notice visible immediately and expires it after exactly seven seconds", () => {
    const scheduled = [];
    const target = {
      setTimeout: vi.fn((callback, delay) => {
        const timer = { callback, delay };
        scheduled.push(timer);
        return timer;
      }),
      clearTimeout: vi.fn(),
    };
    const onExpire = vi.fn();
    const noticeTimer = createVoiceNoticeTimer(target, onExpire);

    expect(isMicrophonePermissionError("not-allowed")).toBe(true);
    expect(getRecognitionErrorMessage("not-allowed")).toBe("Microphone permission was denied. You can continue using manual navigation.");
    noticeTimer.start(MICROPHONE_PERMISSION_NOTICE_DURATION_MS);
    expect(onExpire).not.toHaveBeenCalled();
    expect(target.setTimeout).toHaveBeenCalledTimes(1);
    expect(target.setTimeout).toHaveBeenCalledWith(expect.any(Function), 7000);
    expect(scheduled[0].delay).toBe(7000);

    scheduled[0].callback();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("replaces duplicate notice timers and clears safely for unmount/manual cleanup", () => {
    const timers = [];
    const target = {
      setTimeout: vi.fn((callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; }),
      clearTimeout: vi.fn(),
    };
    const noticeTimer = createVoiceNoticeTimer(target, vi.fn());

    noticeTimer.start(7000);
    noticeTimer.start(7000);
    expect(target.setTimeout).toHaveBeenCalledTimes(2);
    expect(target.clearTimeout).toHaveBeenCalledTimes(1);
    expect(target.clearTimeout).toHaveBeenCalledWith(timers[0]);

    noticeTimer.clear();
    expect(target.clearTimeout).toHaveBeenCalledTimes(2);
    expect(target.clearTimeout).toHaveBeenLastCalledWith(timers[1]);
    noticeTimer.clear();
    expect(target.clearTimeout).toHaveBeenCalledTimes(2);
  });

  it("preserves the permission error split and final-only manual navigation behavior", () => {
    expect(isMicrophonePermissionError("service-not-allowed")).toBe(true);
    expect(isMicrophonePermissionError("audio-capture")).toBe(false);
    expect(getRecognitionErrorMessage("audio-capture")).toContain("A microphone is not available");
    expect(resolveFinalVoiceNavigation("weather", false)).toBeNull();
    expect(resolveFinalVoiceNavigation("weather", true)).toEqual(target("Weather", "/weather"));
  });

  it("recognizes only native browser constructors", () => {
    expect(getSpeechRecognitionConstructor({})).toBeNull();
    const VendorRecognition = function VendorRecognition() {};
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition: VendorRecognition })).toBe(VendorRecognition);
  });
});
