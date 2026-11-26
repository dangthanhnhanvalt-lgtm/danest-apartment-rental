import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { vi } from "./vi";
import type { Dict, Lang } from "./types";

const STORAGE_KEY = "danest.lang";
const DICTS: Record<Lang, Dict> = { en, vi };

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a dotted key with optional {var} interpolation. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Pick between en/vi strings inline (for data-driven labels). */
  pick: (enText: string, viText: string) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

function readInitialLang(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "vi" || raw === "en") return raw;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang];
      const template = dict[key] ?? en[key] ?? key;
      return interpolate(template, vars);
    },
    [lang],
  );

  const pick = useCallback((enText: string, viText: string) => (lang === "vi" ? viText : enText), [lang]);

  const value = useMemo<LanguageValue>(() => ({ lang, setLang, t, pick }), [lang, setLang, t, pick]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}

/** Convenience: only the translate function. */
export function useT() {
  return useI18n().t;
}

export function useLang(): Lang {
  return useI18n().lang;
}
