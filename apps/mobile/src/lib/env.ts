/**
 * Public runtime config. EXPO_PUBLIC_* values are inlined at build time.
 * Never put secrets here — everything below ships inside the APK.
 */
function req(name: string, value: string | undefined): string {
  if (!value) {
    if (__DEV__) console.warn(`[env] Missing ${name} — check apps/mobile/.env`);
    return '';
  }
  return value;
}

export const env = {
  supabaseUrl: req('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: req('EXPO_PUBLIC_SUPABASE_KEY', process.env.EXPO_PUBLIC_SUPABASE_KEY),
  googleWebClientId: req('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
  admob: {
    banner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? '',
    interstitial: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? '',
  },
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://winplaybox.in/paisa-kidhar/privacy',
} as const;
