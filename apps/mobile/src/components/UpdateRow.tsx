import Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';

import { Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { config } from '@/lib/config';
import { actOnUpdate, getUpdateUi, subscribeUpdate } from '@/lib/updates';

/** Inline update status: "Update available → Downloading… → Re-launch to install". Renders nothing when the app is current. */
export function UpdateRow() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const s = useSyncExternalStore(subscribeUpdate, getUpdateUi, getUpdateUi);
  if (Platform.OS !== 'android' || s.kind === 'none') return null;

  const ready = s.kind === 'ready_store' || s.kind === 'ready_ota';
  const title = ready ? tx('up_relaunch_title') : tx('up_store_title');
  const sub = ready ? tx('up_relaunch_sub') : s.kind === 'downloading' ? tx('up_downloading') : tx('up_row_sub');
  const action = ready ? tx('up_relaunch') : s.kind === 'store' ? tx('up_update') : null;
  const go = () => { void actOnUpdate(() => { Linking.openURL(config.playUrl).catch(() => {}); }); };

  return (
    <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: t.space.md }}>
      <Ionicons name="cloud-download-outline" size={26} color={t.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{title}</Text>
        <Text variant="caption" muted>{sub}</Text>
      </View>
      {s.kind === 'downloading' ? <ActivityIndicator color={t.colors.primary} /> : action ? (
        <Pressable accessibilityRole="button" onPress={go}
          style={{ backgroundColor: t.colors.primary, borderRadius: 999, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm }}>
          <Text style={{ color: t.colors.onPrimary, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
