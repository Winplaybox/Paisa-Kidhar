import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { config } from '@/lib/config';

/** Server-driven config (GET /v1/public/config). Lets the owner change announcements, flags, legal text,
 *  force-update and maintenance mode from the backend with no Play release. Cached for offline starts. */
export type Localized = Record<string, string>;
export type RemoteConfig = {
  announcement: { active: boolean; id: string; level: 'info' | 'warn'; text: Localized; url?: string | null };
  maintenance: { on: boolean; text: Localized };
  min_version: { android: string };
  flags: { shagun_cards: boolean; premium: boolean; feedback: boolean; ads: boolean };
  legal: { updated?: string } & Partial<Record<'privacy' | 'terms' | 'delete_account', Localized>>;
};

const DEFAULTS: RemoteConfig = {
  announcement: { active: false, id: 'none', level: 'info', text: {}, url: null },
  maintenance: { on: false, text: {} },
  min_version: { android: '0.0.0' },
  flags: { shagun_cards: true, premium: true, feedback: true, ads: true },
  legal: {},
};
const KEY = 'pk.rc.v1';

let state: RemoteConfig = DEFAULTS;
const listeners = new Set<() => void>();
const set = (next: RemoteConfig) => { state = next; listeners.forEach((l) => l()); };
const merge = (raw: Partial<RemoteConfig> | null | undefined): RemoteConfig => ({
  announcement: { ...DEFAULTS.announcement, ...raw?.announcement },
  maintenance: { ...DEFAULTS.maintenance, ...raw?.maintenance },
  min_version: { ...DEFAULTS.min_version, ...raw?.min_version },
  flags: { ...DEFAULTS.flags, ...raw?.flags },
  legal: { ...DEFAULTS.legal, ...raw?.legal },
});

export async function loadCachedConfig() {
  try { const s = await AsyncStorage.getItem(KEY); if (s) set(merge(JSON.parse(s))); } catch { /* ignore corrupt cache */ }
}

export async function refreshConfig(): Promise<void> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${config.apiUrl}/v1/public/config`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return;
    const next = merge(await r.json());
    set(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  } catch { /* offline: keep cached/default config */ }
}

/** Pick the user's language, then English, then any text. */
export function pick(text: Localized | undefined, lang: string): string {
  return (text?.[lang] || text?.en || Object.values(text ?? {})[0] || '').trim();
}

/** Compare dotted versions: -1, 0, 1. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0), pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';
export const needsForcedUpdate = (c: RemoteConfig): boolean => Platform.OS === 'android' && cmpVersion(appVersion(), c.min_version.android) < 0;

export function useRemoteConfig(): RemoteConfig {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
}
export const getFlags = () => state.flags;

/** Mount once: load cache, refresh now and whenever the app returns to the foreground. */
export function useRemoteConfigSync() {
  useEffect(() => {
    loadCachedConfig().finally(refreshConfig);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshConfig(); });
    return () => sub.remove();
  }, []);
}
