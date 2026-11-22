import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Linking, Modal, Platform, View } from 'react-native';

import { Button, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { config } from '@/lib/config';
import { getUpdateUi, refreshUpdates, startStoreUpdate, subscribeUpdate } from '@/lib/updates';

/** Mounted once at the root: keeps update state fresh and shows a blocking dialog ONLY for forced store updates.
 *  Optional updates are shown inline by <UpdateRow /> (Home + Settings). */
export function UpdateGate() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const s = useSyncExternalStore(subscribeUpdate, getUpdateUi, getUpdateUi);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void refreshUpdates();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refreshUpdates(); });
    return () => sub.remove();
  }, []);

  if (s.kind !== 'store' || !s.force) return null;
  const onUpdate = async () => { if (!(await startStoreUpdate(true))) Linking.openURL(config.playUrl).catch(() => {}); };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: t.space.xl }}>
        <View accessibilityViewIsModal style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: t.space.xl, gap: t.space.md }}>
          <Text variant="heading">{tx('up_force_title')}</Text>
          <Text muted>{tx('up_force_body')}</Text>
          <Button title={tx('up_update')} kind="primary" onPress={onUpdate} />
        </View>
      </View>
    </Modal>
  );
}
