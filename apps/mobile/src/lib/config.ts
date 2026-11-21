// Public runtime config (EXPO_PUBLIC_* are inlined at build time). No secrets here.
function req(name: string, value: string | undefined, fallback?: string): string {
  const v = value || fallback;
  if (!v) throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to .env`);
  return v.replace(/\/$/, '');
}

export const config = {
  supabaseUrl: req('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL, 'https://xatbfyiytcnogfbtfsym.supabase.co'),
  supabaseKey: req('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'sb_publishable_QpEcKrru1S6jW-k6llv30Q_4mV1QXO7'),
  apiUrl: req('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL, 'https://paisa-kidhar-registry-api.onrender.com'),
  webUrl: req('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL, 'https://paisa.winplaybox.in'),
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  adsEnabled: process.env.EXPO_PUBLIC_ADS_ENABLED === 'true',
  admob: {
    banner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? '',
    interstitial: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? '',
    appOpen: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_ID ?? '',
  },
  // Play policy: only enable after enrolling in Google Play user-choice/alternative billing for India.
  androidExternalBilling: process.env.EXPO_PUBLIC_ANDROID_EXTERNAL_BILLING === 'true',
  supportEmail: 'support@winplaybox.in',
  playPackage: 'com.winplaybox.paisakidhar',
  playUrl: 'https://play.google.com/store/apps/details?id=com.winplaybox.paisakidhar',
};
