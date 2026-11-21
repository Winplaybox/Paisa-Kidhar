// App update plumbing (Android). Two independent channels:
//  1. OTA (expo-updates): JS/asset-only fixes, downloaded silently, applied on the user's OK.
//  2. Play in-app update (expo-in-app-updates): new store versions. Play Console "update priority" >= 4 forces the blocking
//     immediate flow (use it for breaking API changes); lower priorities show a dismissible prompt + background download.
// Everything is a no-op on web, in dev builds, and when the native module is missing — an update check must never break the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type UpdateState =
  | { kind: 'none' }
  | { kind: 'ota_ready' }
  | { kind: 'store'; storeVersion: string; force: boolean; immediate: boolean }
  | { kind: 'store_downloaded' };

const SKIP_KEY = 'pk.update.skipped';
export const FORCE_PRIORITY = 4;

const enabled = Platform.OS === 'android' && !__DEV__;

/* eslint-disable @typescript-eslint/no-require-imports */
const inApp = () => require('expo-in-app-updates') as typeof import('expo-in-app-updates');
const otaMod = () => require('expo-updates') as typeof import('expo-updates');

/** Downloads a pending OTA bundle in the background. Resolves true when one is ready to apply. */
export async function fetchOta(): Promise<boolean> {
  if (!enabled) return false;
  try {
    const U = otaMod();
    if (!U.isEnabled) return false;
    const r = await U.checkForUpdateAsync();
    if (!r.isAvailable) return false;
    const f = await U.fetchUpdateAsync();
    return f.isNew;
  } catch { return false; }
}

export async function applyOta() {
  try { await otaMod().reloadAsync(); } catch { /* stays on the current bundle */ }
}

/** Asks Play whether a newer version exists. `manual` ignores the "Later" the user already chose for that version. */
export async function checkStore(manual = false): Promise<UpdateState> {
  if (!enabled) return { kind: 'none' };
  try {
    const info = await inApp().checkForUpdate();
    if (!info.updateAvailable) return { kind: 'none' };
    const version = String(info.storeVersion ?? '');
    const force = (info.serverPriority ?? 0) >= FORCE_PRIORITY && !!info.immediateAllowed;
    if (!force && !manual && version && (await AsyncStorage.getItem(SKIP_KEY)) === version) return { kind: 'none' };
    return { kind: 'store', storeVersion: version, force, immediate: force };
  } catch { return { kind: 'none' }; }
}

export async function skipStoreVersion(version: string) {
  try { await AsyncStorage.setItem(SKIP_KEY, version); } catch { /* non-fatal */ }
}

/** Starts the Play flow. Returns false if Play refused (the caller can fall back to the store page). */
export async function startStoreUpdate(immediate: boolean): Promise<boolean> {
  try { return await inApp().startUpdate(immediate); } catch { return false; }
}

/** Fires once a flexible download finishes so the UI can offer "Restart to install". */
export function onStoreDownloaded(cb: () => void): () => void {
  if (!enabled) return () => {};
  try { return inApp().addUpdateListener('updateDownloaded', (e) => { if (e.readyToInstall) cb(); }); } catch { return () => {}; }
}
