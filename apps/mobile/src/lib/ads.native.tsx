// AdMob — behind EXPO_PUBLIC_ADS_ENABLED. Test unit IDs in dev builds.
// Rules: never on auth, guest gift/payment, receipt or card screens; never for Premium registries;
// full-screen formats are frequency-capped so the couple's dashboard stays pleasant.
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import mobileAds, { AdEventType, AdsConsent, AppOpenAd, BannerAd, BannerAdSize, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

import { t as tr } from '@/i18n';
import { config } from './config';
import { getFlags } from '@/lib/remoteConfig';

let initPromise: Promise<boolean> | null = null;
const REQ = { requestNonPersonalizedAdsOnly: true };
const unit = (live: string, test: string) => (__DEV__ || !live ? test : live);

function init(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await AdsConsent.gatherConsent();
        const { canRequestAds } = await AdsConsent.getConsentInfo();
        if (!canRequestAds) return false;
        await mobileAds().initialize();
        return true;
      } catch {
        return false;
      }
    })();
  }
  return initPromise;
}

export function AdBanner({ hidden }: { hidden?: boolean }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if ((config.adsEnabled && getFlags().ads) && !hidden) init().then(setOk); }, [hidden]);
  if (!(config.adsEnabled && getFlags().ads) || hidden || !ok) return null;
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }} accessibilityLabel={tr('cm_ad')}>
      <BannerAd unitId={unit(config.admob.banner, TestIds.ADAPTIVE_BANNER)} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={REQ} />
    </View>
  );
}

// ---- Interstitial: at most once per 5 minutes, only at natural pauses (e.g. after publishing). ----
const INTERSTITIAL_GAP_MS = 5 * 60 * 1000;
let lastInterstitial = 0;
export async function showInterstitial(opts: { premium?: boolean } = {}) {
  if (!(config.adsEnabled && getFlags().ads) || opts.premium || Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return;
  if (!(await init())) return;
  const ad = InterstitialAd.createForAdRequest(unit(config.admob.interstitial, TestIds.INTERSTITIAL), REQ);
  const offLoad = ad.addAdEventListener(AdEventType.LOADED, () => { lastInterstitial = Date.now(); ad.show().catch(() => {}); offLoad(); });
  ad.load();
}

// ---- App open: when the couple returns to the app, at most once per 4 hours, never on cold start. ----
const APP_OPEN_GAP_MS = 4 * 60 * 60 * 1000;
export function useAppOpenAd(enabled: boolean) {
  useEffect(() => {
    if (!(config.adsEnabled && getFlags().ads) || !enabled) return;
    let last = Date.now();
    let state = AppState.currentState;
    const sub = AppState.addEventListener('change', async (next) => {
      const resumed = /inactive|background/.test(String(state)) && next === 'active';
      state = next;
      if (!resumed || Date.now() - last < APP_OPEN_GAP_MS || !(await init())) return;
      const ad = AppOpenAd.createForAdRequest(unit(config.admob.appOpen, TestIds.APP_OPEN), REQ);
      const off = ad.addAdEventListener(AdEventType.LOADED, () => { last = Date.now(); ad.show().catch(() => {}); off(); });
      ad.load();
    });
    return () => sub.remove();
  }, [enabled]);
}
