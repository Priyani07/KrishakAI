export const KNOWN_VOICE_ROUTES = new Set([
  "/", "/weather", "/disease-farm-intrusion", "/disease-detection", "/animal-intrusion", "/soil-analysis", "/community", "/community/discussion-forum", "/community/community-events", "/community/sikayat-kendra", "/guide", "/guide/soil-testing", "/guide/hybrid-seed", "/guide/fertilizers", "/guide/soil-types", "/guide/crop-recommendation", "/resources", "/planner", "/profile", "/chatbot", "/admin", "/market-prices",
]);

const navigationPrefixes = [
  "please open ", "please show ", "please go to ", "take me to ", "navigate to ", "go to ", "open ", "show ", "please ",
  "कृपया ", "खोलो ", "खोलें ", "पर जाएं ", "पर जाओ ",
];

// These variants are deliberately limited to observed, route-unique recognition errors.
// They are resolved last and never route arbitrary words to a different destination.
export const CONTROLLED_RECOGNITION_VARIANTS = Object.freeze({
  whether: "weather", weathers: "weather", communities: "community", communitys: "community", planning: "planner", plan: "planner", diseases: "disease", resource: "resources",
});

// This is the sole navigation-intent registry. Every term is explicit, local, and
// route-unique; there is no fuzzy or AI semantic matching.
export const VOICE_INTENT_REGISTRY = Object.freeze([
  { route: "/", canonicalName: "Home", exactAliases: ["home"], relatedAliases: ["dashboard", "ghar"], hindiAliases: ["होम", "घर"], phraseAliases: ["go home", "main page", "मुख्य पृष्ठ"], distinctivePrefixes: [] },
  { route: "/weather", canonicalName: "Weather", exactAliases: ["weather"], relatedAliases: ["forecast", "mausam"], hindiAliases: ["मौसम"], phraseAliases: [], distinctivePrefixes: [] },
  { route: "/disease-detection", canonicalName: "Disease Detection", exactAliases: ["disease", "detection"], relatedAliases: [], hindiAliases: ["बीमारी", "रोग पहचान", "बीमारी पहचान"], phraseAliases: ["disease detection", "plant disease", "crop disease"], distinctivePrefixes: [] },
  { route: "/disease-farm-intrusion", canonicalName: "Disease & Farm Intrusion Overview", exactAliases: ["overview"], relatedAliases: [], hindiAliases: ["रोग और घुसपैठ"], phraseAliases: ["disease farm intrusion", "disease and farm intrusion", "disease overview", "farm protection overview"], distinctivePrefixes: ["disease farm", "disease and farm"] },
  { route: "/animal-intrusion", canonicalName: "Animal / Farm Intrusion", exactAliases: ["animal", "animals", "intrusion"], relatedAliases: [], hindiAliases: ["पशु", "पशु घुसपैठ", "फार्म घुसपैठ"], phraseAliases: ["animal intrusion", "farm intrusion", "disease detection and farm"], distinctivePrefixes: ["animal intr", "farm intru"] },
  { route: "/soil-analysis", canonicalName: "Soil Analysis", exactAliases: ["soil image"], relatedAliases: ["soil photo"], hindiAliases: ["मिट्टी विश्लेषण"], phraseAliases: ["analyze soil image"], distinctivePrefixes: ["soil analy", "soil phot"] },
  { route: "/guide/soil-testing", canonicalName: "Soil Testing", exactAliases: ["soil", "nutrient", "nutrients", "npk", "mitti"], relatedAliases: [], hindiAliases: ["मिट्टी"], phraseAliases: ["soil testing", "nutrient levels", "soil nutrients"], distinctivePrefixes: [] },
  { route: "/community", canonicalName: "Community", exactAliases: ["community"], relatedAliases: [], hindiAliases: ["समुदाय", "कम्युनिटी"], phraseAliases: ["community home"], distinctivePrefixes: [] },
  { route: "/community/discussion-forum", canonicalName: "Discussion Forum", exactAliases: ["forum", "forums", "discussion", "discussions", "questions", "article", "articles"], relatedAliases: ["field notes"], hindiAliases: ["चर्चा", "चर्चा मंच", "किसान चर्चा", "फोरम"], phraseAliases: ["discussion forum", "discussion forums", "open discussion forums", "go to discussion forums", "show discussion forums", "farmer discussion", "community forum"], distinctivePrefixes: ["discussion for"] },
  { route: "/community/community-events", canonicalName: "Community Events", exactAliases: ["events"], relatedAliases: [], hindiAliases: [], phraseAliases: ["community events"], distinctivePrefixes: [] },
  { route: "/community/sikayat-kendra", canonicalName: "Sikayat Kendra", exactAliases: ["sikayat", "complaint", "complaints"], relatedAliases: ["grievance"], hindiAliases: ["शिकायत", "शिकायत केंद्र", "शिकायत केन्द्र"], phraseAliases: ["sikayat kendra", "open sikayat kendra", "agricultural complaint", "agricultural complaints", "submit complaint", "submit a complaint", "report complaint", "grievance center", "complaint center", "शिकायत दर्ज", "कृषि शिकायत"], distinctivePrefixes: ["sikayat ken", "complaint cen"] },
  { route: "/guide", canonicalName: "Farmer's Guide", exactAliases: ["guide", "farmers"], relatedAliases: ["kisan guide"], hindiAliases: ["गाइड", "किसान गाइड", "किसान मार्गदर्शिका"], phraseAliases: ["farmers guide", "farmer guide"], distinctivePrefixes: ["farmers gui", "farmer gui", "kisan gui"] },
  { route: "/guide/crop-recommendation", canonicalName: "Crop Recommendation", exactAliases: ["crop", "crops", "recommendation", "fasal"], relatedAliases: [], hindiAliases: ["फसल"], phraseAliases: ["crop recommendation", "crop suggestions"], distinctivePrefixes: ["crop recommend"] },
  { route: "/guide/hybrid-seed", canonicalName: "Hybrid Seed", exactAliases: ["seed", "seeds", "beej"], relatedAliases: [], hindiAliases: ["बीज", "हाइब्रिड बीज", "संकर बीज"], phraseAliases: ["hybrid seed", "hybrid seeds", "seed selection"], distinctivePrefixes: ["hybrid see"] },
  { route: "/guide/fertilizers", canonicalName: "Fertilizers", exactAliases: ["fertilizer", "fertilizers"], relatedAliases: [], hindiAliases: [], phraseAliases: [], distinctivePrefixes: [] },
  { route: "/guide/soil-types", canonicalName: "Soil Types", exactAliases: [], relatedAliases: [], hindiAliases: [], phraseAliases: ["soil types"], distinctivePrefixes: [] },
  { route: "/resources", canonicalName: "Resources", exactAliases: ["resources", "support"], relatedAliases: [], hindiAliases: ["संसाधन"], phraseAliases: ["support resources"], distinctivePrefixes: [] },
  { route: "/planner", canonicalName: "Irrigation Planner", exactAliases: ["planner", "irrigation", "paani"], relatedAliases: [], hindiAliases: ["पानी", "योजना"], phraseAliases: ["irrigation planner"], distinctivePrefixes: [] },
  { route: "/profile", canonicalName: "Profile", exactAliases: ["profile"], relatedAliases: [], hindiAliases: ["प्रोफाइल"], phraseAliases: ["my profile", "मेरी प्रोफाइल"], distinctivePrefixes: [] },
  { route: "/chatbot", canonicalName: "Krishak AI", exactAliases: ["chatbot"], relatedAliases: [], hindiAliases: ["कृषक एआई", "कृषक सहायक"], phraseAliases: ["krishak ai", "farmer assistant", "open chatbot"], distinctivePrefixes: [] },
  { route: "/market-prices", canonicalName: "Market Prices", exactAliases: ["market", "mandi"], relatedAliases: ["mandi prices"], hindiAliases: ["मंडी", "मंडी भाव", "बाजार भाव", "बाज़ार भाव"], phraseAliases: ["market prices", "mandi bhav", "mandi prices"], distinctivePrefixes: ["market pr", "mandi bh"] },
].map((intent) => Object.freeze({ ...intent, route: intent.route })));

// Backward-compatible presentation shape for any existing consumers and focused tests.
export const VOICE_NAVIGATION_COMMANDS = Object.freeze(VOICE_INTENT_REGISTRY.map((intent) => Object.freeze({
  label: intent.canonicalName,
  path: intent.route,
  aliases: [...new Set([...intent.exactAliases, ...intent.relatedAliases, ...intent.hindiAliases, ...intent.phraseAliases])],
  exactAliases: intent.exactAliases,
  relatedAliases: intent.relatedAliases,
  hindiAliases: intent.hindiAliases,
  phraseAliases: intent.phraseAliases,
  distinctivePrefixes: intent.distinctivePrefixes,
})));

export const VOICE_STATUS_LABELS = {
  idle: "Voice navigation",
  listening: "Listening…",
  processing: "Listening…",
  error: "Voice navigation unavailable",
  unsupported: "Voice navigation unsupported",
};

export const VOICE_BUTTON_LABELS = {
  idle: "Voice",
  listening: "Listening…",
  processing: "Listening…",
  error: "Voice",
  unsupported: "Voice",
};

export const DEFAULT_VOICE_RECOGNITION_LANGUAGE = "en-IN";
export const VOICE_RECOGNITION_LANGUAGES = Object.freeze(["en-IN", "hi-IN"]);

export function resolveVoiceRecognitionLanguage(value) {
  return VOICE_RECOGNITION_LANGUAGES.includes(value) ? value : DEFAULT_VOICE_RECOGNITION_LANGUAGE;
}

export function getVoiceLanguageButtonState(selectedLanguage, optionLanguage) {
  return { isActive: resolveVoiceRecognitionLanguage(selectedLanguage) === optionLanguage };
}

export function switchVoiceRecognitionLanguage(currentLanguage, requestedLanguage, activeRecognition) {
  const language = resolveVoiceRecognitionLanguage(requestedLanguage);
  if (resolveVoiceRecognitionLanguage(currentLanguage) === language) return { language, changed: false, stopped: false };
  return { language, changed: true, stopped: stopVoiceRecognitionSession(activeRecognition) };
}

export function normalizeVoiceCommand(value) {
  if (typeof value !== "string") return "";
  let normalized = value.toLowerCase().trim().replace(/[.,!?;:()[\]{}"'`]/g, "").replace(/\s+/g, " ");
  let removedPrefix = true;
  while (removedPrefix) {
    removedPrefix = false;
    for (const prefix of navigationPrefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
        removedPrefix = true;
        break;
      }
    }
  }
  return normalized;
}

function toTarget(intent) {
  return KNOWN_VOICE_ROUTES.has(intent.route) ? { label: intent.canonicalName, path: intent.route } : null;
}

function resolveSingleIntent(intents) {
  return intents.length === 1 ? toTarget(intents[0]) : null;
}

function resolveExactCategory(normalized, category) {
  const matches = VOICE_INTENT_REGISTRY.filter((intent) => intent[category].some((alias) => normalizeVoiceCommand(alias) === normalized));
  return resolveSingleIntent(matches);
}

function resolveDistinctivePrefix(normalized) {
  const matches = VOICE_INTENT_REGISTRY.filter((intent) => intent.distinctivePrefixes.some((prefix) => normalized.startsWith(prefix)));
  return resolveSingleIntent(matches);
}

export function resolveVoiceNavigation(transcript) {
  const normalized = normalizeVoiceCommand(transcript);
  if (!normalized) return null;

  for (const category of ["exactAliases", "relatedAliases", "hindiAliases", "phraseAliases"]) {
    const target = resolveExactCategory(normalized, category);
    if (target) return target;
  }

  const prefixTarget = resolveDistinctivePrefix(normalized);
  if (prefixTarget) return prefixTarget;

  const observedVariant = CONTROLLED_RECOGNITION_VARIANTS[normalized];
  return observedVariant ? resolveVoiceNavigation(observedVariant) : null;
}

// Final transcripts are required. Distinctive interim words remain visible as feedback
// but never trigger navigation, avoiding accidental route changes during recognition.
export function resolveFinalVoiceNavigation(transcript, isFinal) {
  return isFinal ? resolveVoiceNavigation(transcript) : null;
}

export function getSpeechRecognitionConstructor(target = globalThis) {
  return target?.SpeechRecognition || target?.webkitSpeechRecognition || null;
}

export function createVoiceRecognitionSession(target = globalThis, selectedLanguage = DEFAULT_VOICE_RECOGNITION_LANGUAGE) {
  const Recognition = getSpeechRecognitionConstructor(target);
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = resolveVoiceRecognitionLanguage(selectedLanguage);
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function stopVoiceRecognitionSession(recognition) {
  if (!recognition) return false;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.stop();
    return true;
  } catch {
    return false;
  }
}

export const MICROPHONE_PERMISSION_NOTICE_DURATION_MS = 7000;

export function isMicrophonePermissionError(errorCode) {
  return errorCode === "not-allowed" || errorCode === "service-not-allowed";
}

export function getRecognitionErrorMessage(errorCode) {
  if (isMicrophonePermissionError(errorCode)) return "Microphone permission was denied. You can continue using manual navigation.";
  if (errorCode === "audio-capture") return "A microphone is not available. You can continue using manual navigation.";
  if (errorCode === "no-speech") return "No speech was detected. Try again, or use the regular navigation menu.";
  return "Voice navigation unavailable. Please try again or use the regular navigation menu.";
}

export function createVoiceNoticeTimer(target, onExpire) {
  let timerId = null;
  const clear = () => {
    if (timerId === null) return;
    target.clearTimeout(timerId);
    timerId = null;
  };
  return {
    start(delay = 7000) {
      clear();
      timerId = target.setTimeout(() => {
        timerId = null;
        onExpire();
      }, delay);
    },
    clear,
  };
}
