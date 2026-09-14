import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_APPLICATION_LANGUAGE, getVoiceRecognitionLocale, LANGUAGE_STORAGE_KEY, normalizeApplicationLanguage, translateUiText } from "../i18n/translations.js";

const LanguageContext = createContext(null);
const textSources = new WeakMap();
const attributeSources = new WeakMap();
const translatableAttributes = ["placeholder", "aria-label", "title", "alt"];

function isTranslatableTextNode(node) {
  const parent = node.parentElement;
  return Boolean(parent && !parent.closest("script, style, textarea, [contenteditable='true'], [data-i18n-skip]"));
}

function translateElementTree(root, language) {
  if (!root) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walk.nextNode()) textNodes.push(walk.currentNode);
  textNodes.forEach((node) => {
    if (!isTranslatableTextNode(node)) return;
    const stored = textSources.get(node);
    const source = stored && node.nodeValue === stored.translated ? stored.source : node.nodeValue;
    const next = translateUiText(source, language);
    textSources.set(node, { source, translated: next });
    if (node.nodeValue !== next) node.nodeValue = next;
  });
  root.querySelectorAll?.("*").forEach((element) => {
    let originals = attributeSources.get(element);
    translatableAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      if (!originals) { originals = {}; attributeSources.set(element, originals); }
      const source = originals[attribute] ?? element.getAttribute(attribute);
      originals[attribute] = source;
      const next = translateUiText(source, language);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => normalizeApplicationLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)));
  const setLanguage = (nextLanguage) => setLanguageState(normalizeApplicationLanguage(nextLanguage));

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === "hi" ? "hi" : "en";
    translateElementTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData" && isTranslatableTextNode(mutation.target)) {
          translateElementTree(mutation.target.parentElement, language);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) translateElementTree(node, language);
          if (node.nodeType === Node.TEXT_NODE && isTranslatableTextNode(node)) translateElementTree(node.parentElement, language);
        });
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, voiceLocale: getVoiceRecognitionLocale(language), t: (text) => translateUiText(text, language) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
