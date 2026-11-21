/* Lightweight i18n — same architecture as Game Arcade / Multi View Browser:
   flat JSON locales, module-level state, AsyncStorage persistence, hook-driven re-render.
   Missing keys fall back to English, then to the key itself. Add a language = add JSON + one line below. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

export type Lang = 'en' | 'hi' | 'gu' | 'mr';
type Dict = Record<string, string>;

const KEY = 'pk.lang';
const dicts: Record<Lang, Dict> = { en, hi, gu, mr };

export const LANGUAGES: { code: Lang; label: string; native: string; locale: string }[] = [
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
];

const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in dicts;

function deviceLang(): Lang {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().split(/[-_]/)[0];
    return isLang(tag) ? tag : 'en';
  } catch { return 'en'; }
}

let current: Lang = deviceLang();
const listeners = new Set<(l: Lang) => void>();

export function t(key: string, vars?: Record<string, string | number>, lang: Lang = current): string {
  let s = dicts[lang]?.[key] ?? dicts.en[key as keyof typeof en] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const getLang = () => current;
export const dateLocale = () => LANGUAGES.find((l) => l.code === current)?.locale ?? 'en-IN';

export async function initLanguage() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (isLang(saved) && saved !== current) { current = saved; listeners.forEach((l) => l(current)); }
  } catch { /* keep device default */ }
}

export async function setLanguage(lang: Lang) {
  if (!isLang(lang)) return;
  current = lang;
  listeners.forEach((l) => l(lang));
  try { await AsyncStorage.setItem(KEY, lang); } catch { /* non-fatal */ }
}

/** Subscribe a component to language changes. */
export function useI18n() {
  const [lang, setLang] = useState<Lang>(current);
  useEffect(() => {
    listeners.add(setLang);
    setLang(current);
    return () => { listeners.delete(setLang); };
  }, []);
  const tr = useCallback((key: string, vars?: Record<string, string | number>) => t(key, vars, lang), [lang]);
  return { t: tr, lang, setLang: setLanguage };
}
