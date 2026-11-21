import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Modal, Platform, View } from 'react-native';

import { Button, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { config } from '@/lib/config';
import { applyOta, checkStore, fetchOta, onStoreDownloaded, skipStoreVersion, startStoreUpdate, type UpdateState } from '@/lib/updates';

/** Mounted once at the root. Silent when the app is current; otherwise one localized dialog (OTA restart / store update). */
export function UpdateGate() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const [state, setState] = useState<UpdateState>({ kind: 'none' });

  const run = useCallback(async () => {
    // A forced store update outranks everything; otherwise prefer the instant OTA fix.
    const store = await checkStore();
    if (store.kind === 'store' && store.force) { setState(store); return; }
    if (await fetchOta()) { setState({ kind: 'ota_ready' }); return; }
    if (store.kind === 'store') setState(store);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    const off = onStoreDownloaded(() => setState({ kind: 'store_downloaded' }));
    return () => { sub.remove(); off(); };
  }, [run]);

  if (state.kind === 'none') return null;

  const close = () => setState({ kind: 'none' });
  const force = state.kind === 'store' && state.force;
  let title = ''; let body = ''; let primary = ''; let onPrimary: () => void = close; let later = true;
  if (state.kind === 'ota_ready') {
    title = tx('up_ota_title'); body = tx('up_ota_body'); primary = tx('up_restart'); onPrimary = () => { applyOta(); };
  } else if (state.kind === 'store_downloaded') {
    title = tx('up_dl_title'); body = tx('up_dl_body'); primary = tx('up_install'); onPrimary = () => { startStoreUpdate(false); close(); };
  } else {
    title = tx(force ? 'up_force_title' : 'up_store_title'); body = tx(force ? 'up_force_body' : 'up_store_body');
    primary = tx('up_update'); later = !force;
    onPrimary = async () => {
      const ok = await startStoreUpdate(state.immediate);
      if (!ok) Linking.openURL(config.playUrl).catch(() => {});
      if (!force) close();
    };
  }
  const onLater = () => { if (state.kind === 'store') skipStoreVersion(state.storeVersion); close(); };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={force ? undefined : onLater}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: t.space.xl }}>
        <View accessibilityViewIsModal style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: t.space.xl, gap: t.space.md }}>
          <Text variant="heading">{title}</Text>
          <Text muted>{body}</Text>
          <Button title={primary} kind="primary" onPress={onPrimary} />
          {later ? <Button title={tx('up_later')} kind="ghost" onPress={onLater} /> : null}
        </View>
      </View>
    </Modal>
  );
}
