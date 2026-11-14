import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native config. Values here are baked into the binary at build time.
 * ADMOB_ANDROID_APP_ID is your AdMob *App* ID (ca-app-pub-xxx~yyy), not an ad unit ID.
 * Falls back to Google's public sample App ID so dev builds never crash.
 */
const APP_ID_RE = /^ca-app-pub-\d{16}~\d{10}$/;
const pick = (v: string | undefined, fallback: string) => (v && APP_ID_RE.test(v) ? v : fallback);
const ADMOB_ANDROID_APP_ID = pick(process.env.ADMOB_ANDROID_APP_ID, 'ca-app-pub-3940256099942544~3347511713');
const ADMOB_IOS_APP_ID = pick(process.env.ADMOB_IOS_APP_ID, 'ca-app-pub-3940256099942544~1458002511');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Paisa Kidhar?',
  slug: 'paisa-kidhar',
  owner: process.env.EXPO_OWNER || undefined,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'paisakidhar',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0B0F1A',
  ios: {
    bundleIdentifier: 'com.winplaybox.paisakidhar',
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'com.winplaybox.paisakidhar',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#0B0F1A',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Keep the permission surface minimal for Play review.
    blockedPermissions: [
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_PHONE_STATE',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    ['expo-splash-screen', { backgroundColor: '#0B0F1A', image: './assets/images/splash-icon.png', imageWidth: 120 }],
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#B8F34A', defaultChannel: 'daily-budget' }],
    '@react-native-google-signin/google-signin',
    ['react-native-google-mobile-ads', {
      androidAppId: ADMOB_ANDROID_APP_ID,
      iosAppId: ADMOB_IOS_APP_ID,
      delayAppMeasurementInit: true,
      userTrackingUsageDescription: 'Isse tumhe zyada relevant ads dikhenge.',
    }],
    ['expo-build-properties', { android: { minSdkVersion: 24 } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
