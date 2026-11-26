import * as Clipboard from 'expo-clipboard';
import { Linking, Platform, Share } from 'react-native';

import { api } from '@/lib/api';
import { t } from '@/i18n';
import { config } from '@/lib/config';

/** Opens the Play listing (market:// first so the Play app opens directly, https as the fallback). */
export async function openStoreListing() {
  if (Platform.OS === 'android') {
    try { await Linking.openURL(`market://details?id=${config.playPackage}`); return; } catch { /* no Play app */ }
  }
  await Linking.openURL(config.playUrl).catch(() => {});
}

/** Share sheet with the live Play link (optional referrer attribution). Falls back to copying the link where there is no share sheet. */
export async function shareApp(referrer?: string): Promise<'copied' | 'shared'> {
  const url = referrer ? `${config.playUrl}&referrer=${encodeURIComponent(`utm_source=app_invite&utm_medium=${referrer}`)}` : config.playUrl;
  const message = t('share_app_msg', { url });
  api.track('referral_shared', { has_ref: !!referrer });
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url } : { message });
    return 'shared';
  } catch {
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
}
