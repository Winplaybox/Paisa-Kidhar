// AdMob — behind EXPO_PUBLIC_ADS_ENABLED. Test unit IDs in dev; never shown on auth, gift/payment or receipt screens,
// never shown to Premium registries. Live IDs are supplied by the owner at release time.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import mobileAds, { AdsConsent, BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

import { config } from './config';

let initPromise: Promise<boolean> | null = null;

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
  useEffect(() => { if (config.adsEnabled && !hidden) init().then(setOk); }, [hidden]);
  if (!config.adsEnabled || hidden || !ok) return null;
  const unitId = __DEV__ || !config.admobBannerId ? TestIds.ADAPTIVE_BANNER : config.admobBannerId;
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }} accessibilityLabel="Advertisement">
      <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
    </View>
  );
}
