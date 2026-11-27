// Web: no native AdMob formats.
export function AdBanner(_: { hidden?: boolean }) {
  return null;
}
export async function showInterstitial(_: { premium?: boolean } = {}) {}
export function useAppOpenAd(_: boolean) {}
export function useCanShowRewardedCardAd(_: boolean) { return false; }
export async function showRewardedCardAd(_userId: string, _cardId: string) { return false; }
