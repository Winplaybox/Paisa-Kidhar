import type { ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

// Play infers <uses-feature android.hardware.screen.portrait required=true> from the portrait lock, which
// hides the app from landscape-only devices (tablets, desktops, XR). Declare it optional.
const withOptionalPortrait: ConfigPlugin = (config) =>
  withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    const features = (m['uses-feature'] ??= []);
    for (const name of ['android.hardware.screen.portrait', 'android.hardware.screen.landscape']) {
      const existing = features.find((f) => f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return c;
  });

// All values are public (EXPO_PUBLIC_*). Secrets never go in the app bundle.
const env = process.env;
const ADMOB_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713'; // Google sample ID — dev only
const webHost = (env.EXPO_PUBLIC_WEB_URL ?? 'https://paisa.winplaybox.in').replace(/^https?:\/\//, '').replace(/\/$/, '');

const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  'expo-web-browser',
  'expo-secure-store',
  [
    'expo-font',
    {
      fonts: [
        'node_modules/@expo-google-fonts/instrument-sans/400Regular/InstrumentSans_400Regular.ttf',
        'node_modules/@expo-google-fonts/instrument-sans/500Medium/InstrumentSans_500Medium.ttf',
        'node_modules/@expo-google-fonts/instrument-sans/600SemiBold/InstrumentSans_600SemiBold.ttf',
        'node_modules/@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf',
        'node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf',
      ],
    },
  ],
  [
    'expo-splash-screen',
    {
      image: './assets/splash-icon.png',
      imageWidth: 160,
      backgroundColor: '#FFFCF7',
      dark: { image: './assets/splash-icon.png', backgroundColor: '#0A0A0A' },
    },
  ],
  'expo-sharing',
  '@react-native-firebase/app',
  '@react-native-firebase/app-check',
  '@react-native-firebase/crashlytics',
  ['expo-build-properties', { android: { minSdkVersion: 24, compileSdkVersion: 37, targetSdkVersion: 36, enableProguardInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }],
  [
    'react-native-google-mobile-ads',
    {
      androidAppId: env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || ADMOB_TEST_ANDROID_APP_ID,
      delayAppMeasurementInit: true,
    },
  ],
];
if (env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
  plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME }]);
}

const config: ExpoConfig = {
  name: 'Paisa Kidhar',
  slug: 'paisa-kidhar',
  owner: 'winplaybox',
  scheme: 'paisakidhar',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  // OTA: JS/asset fixes reach installed apps of the same version without a Play review (eas update --channel production).
  updates: { url: 'https://u.expo.dev/c4f42188-ff47-47f9-a9b2-7b4a9b23f49d', fallbackToCacheTimeout: 0, checkAutomatically: 'ON_ERROR_RECOVERY' },
  ios: { supportsTablet: true, bundleIdentifier: 'com.winplaybox.paisakidhar' },
  android: {
    package: 'com.winplaybox.paisakidhar',
    versionCode: 1,
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#FFFCF7',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: webHost, pathPrefix: '/r/' }, { scheme: 'https', host: webHost, pathPrefix: '/card/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { favicon: './assets/favicon.png', output: 'single', bundler: 'metro', name: 'Paisa Kidhar', themeColor: '#9D174D' },
  plugins,
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: 'c4f42188-ff47-47f9-a9b2-7b4a9b23f49d' },
    router: { origin: `https://${webHost}` },
  },
};

export default withOptionalPortrait(config as never) as ExpoConfig;
