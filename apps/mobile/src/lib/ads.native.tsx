// AdMob — behind EXPO_PUBLIC_ADS_ENABLED. Test unit IDs in dev builds.
// Dashboard ads are frequency-capped. Rewarded cards are an opt-in for non-Premium guests.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import mobileAds, { AdEventType, AdsConsent, AppOpenAd, BannerAd, BannerAdSize, InterstitialAd, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

import { t as tr } from '@/i18n';
import { api } from './api';
import { useAuth } from './auth';
import { config } from './config';
import { getFlags, useRemoteConfig } from './remoteConfig';

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

// ---- Interstitial: at most once per 3 minutes, only at natural pauses (e.g. after publishing or confirming a gift). ----
const INTERSTITIAL_GAP_MS = 3 * 60 * 1000;
let lastInterstitial = 0;
export async function showInterstitial(opts: { premium?: boolean } = {}) {
  if (!(config.adsEnabled && getFlags().ads) || opts.premium || Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return;
  if (!(await init())) return;
  const ad = InterstitialAd.createForAdRequest(unit(config.admob.interstitial, TestIds.INTERSTITIAL), REQ);
  const offLoad = ad.addAdEventListener(AdEventType.LOADED, () => { lastInterstitial = Date.now(); ad.show().catch(() => {}); offLoad(); });
  ad.load();
}

function rewardedAdsEnabled() {
  const { ads, shagun_cards } = getFlags();
  return Platform.OS === 'android' && config.adsEnabled && ads && shagun_cards;
}

export function useCanShowRewardedCardAd(hidden: boolean) {
  const { ready, session } = useAuth();
  const { flags } = useRemoteConfig();
  const enabled = !hidden && Platform.OS === 'android' && config.adsEnabled && flags.ads && flags.shagun_cards;
  const registries = useQuery({
    queryKey: ['rewarded-card-registries', session?.user.id], queryFn: api.registries, enabled: enabled && !!session,
  });
  return enabled && ready && (!session || (registries.isSuccess && !registries.data.items.some((r) => r.plan === 'premium')));
}

export async function showRewardedCardAd(userId: string, cardId: string): Promise<boolean> {
  if (!rewardedAdsEnabled() || !(await init()) || !rewardedAdsEnabled()) return false;
  const ad = RewardedAd.createForAdRequest(unit(config.admob.rewarded, TestIds.REWARDED), {
    ...REQ, serverSideVerificationOptions: { userId, customData: cardId },
  });
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const finish = (completed: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      ad.destroy();
      resolve(completed);
    };
    const timeout = setTimeout(() => finish(false), 15000);
    try {
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timeout);
        ad.show().catch(() => finish(false));
      });
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned));
      ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      ad.load();
    } catch {
      finish(false);
    }
  });
}

// ---- App open: when the couple returns to the app, at most once per 2 hours, never on cold start. ----
const APP_OPEN_GAP_MS = 2 * 60 * 60 * 1000;
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
