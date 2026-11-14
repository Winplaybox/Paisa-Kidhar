/**
 * AdMob with Google UMP consent. Ads never block the UI and never load before consent.
 * Placements (deliberately light so the app still feels premium):
 *   - Adaptive banner at the bottom of Insights and History
 *   - Interstitial after closing the report card, max once / 8h, never in first 2 days
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
  useInterstitialAd,
} from 'react-native-google-mobile-ads';

import { env } from '@/lib/env';

const UNIT_RE = /^ca-app-pub-\d{16}\/\d{10}$/;
const real = (id: string) => !__DEV__ && UNIT_RE.test(id);
const unit = {
  banner: real(env.admob.banner) ? env.admob.banner : TestIds.ADAPTIVE_BANNER,
  interstitial: real(env.admob.interstitial) ? env.admob.interstitial : TestIds.INTERSTITIAL,
};

const LAST_KEY = 'pk:lastInterstitial';
const FIRST_KEY = 'pk:firstOpen';
const GAP_MS = 8 * 3600_000;
const GRACE_MS = 2 * 86_400_000;

type AdsState = {
  ready: boolean;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
  /** Call after the user leaves the report card. Frequency-capped; never throws. */
  maybeShowInterstitial: () => Promise<void>;
};
const Ctx = createContext<AdsState>({ ready: false, privacyOptionsRequired: false, showPrivacyOptions: async () => {}, maybeShowInterstitial: async () => {} });

export function AdsProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [ready, setReady] = useState(false);
  const [privacyOptionsRequired, setPOR] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await AdsConsent.gatherConsent();
        if (cancelled) return;
        setPOR(info.privacyOptionsRequirementStatus === 'REQUIRED');
        if (!info.canRequestAds) return;
        await mobileAds().initialize();
        if (!cancelled) setReady(true);
      } catch {
        // Consent form failed (offline etc.) — try with whatever consent we already have.
        try {
          const info = await AdsConsent.getConsentInfo();
          if (info.canRequestAds) { await mobileAds().initialize(); if (!cancelled) setReady(true); }
        } catch { /* ads stay off */ }
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const { status, show } = useInterstitialAd({ adUnitId: unit.interstitial, autoLoad: ready });

  const value: AdsState = {
    ready,
    privacyOptionsRequired,
    showPrivacyOptions: async () => { try { await AdsConsent.showPrivacyOptionsForm(); } catch { /* noop */ } },
    maybeShowInterstitial: async () => {
      if (status !== 'loaded') return;
      try {
        const now = Date.now();
        let first = Number(await AsyncStorage.getItem(FIRST_KEY));
        if (!first) { first = now; await AsyncStorage.setItem(FIRST_KEY, String(now)); }
        const last = Number(await AsyncStorage.getItem(LAST_KEY)) || 0;
        if (now - first < GRACE_MS || now - last < GAP_MS) return;
        await AsyncStorage.setItem(LAST_KEY, String(now));
        show();
      } catch { /* never block navigation on ads */ }
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAds = () => useContext(Ctx);

export function AdBanner() {
  const { ready } = useAds();
  const [failed, setFailed] = useState(false);
  if (!ready || failed) return null;
  return (
    <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
      <BannerAd unitId={unit.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

