// Firebase on Android: App Check (Play Integrity attestation), Crashlytics, Analytics. Auth stays on Supabase.
import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent as fbLogEvent } from '@react-native-firebase/analytics';
import { getToken, initializeAppCheck, ReactNativeFirebaseAppCheckProvider, type AppCheck } from '@react-native-firebase/app-check';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';

let appCheck: AppCheck | null = null;

export async function initFirebase() {
  if (appCheck) return;
  try {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({ android: { provider: __DEV__ ? 'debug' : 'playIntegrity' } });
    appCheck = await initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });
    await setCrashlyticsCollectionEnabled(getCrashlytics(), !__DEV__);
  } catch { /* never block the app on telemetry */ }
}

export async function appCheckToken(): Promise<string | null> {
  try { return appCheck ? (await getToken(appCheck)).token : null; } catch { return null; }
}

/** Event names/params are small and non-personal (no names, UPI IDs or amounts). */
export function logEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  try { fbLogEvent(getAnalytics(), name.slice(0, 40), params); } catch { /* ignore */ }
}
