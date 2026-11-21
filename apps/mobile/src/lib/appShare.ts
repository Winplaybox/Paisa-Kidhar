import * as Clipboard from 'expo-clipboard';
import { Linking, Platform, Share } from 'react-native';

import { t } from '@/i18n';
import { config } from '@/lib/config';

/** Opens the Play listing (market:// first so the Play app opens directly, https as the fallback). */
export async function openStoreListing() {
  if (Platform.OS === 'android') {
    try { await Linking.openURL(`market://details?id=${config.playPackage}`); return; } catch { /* no Play app */ }
  }
  await Linking.openURL(config.playUrl).catch(() => {});
}

/** Share sheet with the live Play link. Falls back to copying the link where there is no share sheet. Returns 'copied' | 'shared'. */
export async function shareApp(): Promise<'copied' | 'shared'> {
  const message = t('share_app_msg', { url: config.playUrl });
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url: config.playUrl } : { message });
    return 'shared';
  } catch {
    await Clipboard.setStringAsync(config.playUrl);
    return 'copied';
  }
}
