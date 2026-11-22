import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, View } from 'react-native';

import { Button, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { config } from '@/lib/config';
import { needsForcedUpdate, pick, refreshConfig, useRemoteConfig, useRemoteConfigSync } from '@/lib/remoteConfig';

const SEEN = 'pk.ann.dismissed';

/** Root overlay driven by the backend: maintenance screen, minimum-version force update, dismissible announcement. */
export function RemoteGate() {
  const t = useTheme();
  const { t: tx, lang } = useI18n();
  const rc = useRemoteConfig();
  const [dismissed, setDismissed] = useState<string | null>(null);
  useRemoteConfigSync();
  useEffect(() => { AsyncStorage.getItem(SEEN).then(setDismissed).catch(() => {}); }, []);

  const blocking = rc.maintenance.on || needsForcedUpdate(rc);
  if (blocking) {
    const maint = rc.maintenance.on;
    const body = maint ? pick(rc.maintenance.text, lang) || tx('rc_maint_default') : tx('up_force_min');
    return (
      <Modal visible animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: t.colors.bg, justifyContent: 'center', padding: t.space.xl, gap: t.space.md }}>
          <Text variant="title">{maint ? tx('rc_maint_title') : tx('up_force_title')}</Text>
          <Text muted>{body}</Text>
          {maint
            ? <Button title={tx('rc_retry')} kind="primary" onPress={refreshConfig} />
            : <Button title={tx('up_update')} kind="primary" onPress={() => { Linking.openURL(config.playUrl).catch(() => {}); }} />}
        </View>
      </Modal>
    );
  }

  const a = rc.announcement;
  const text = pick(a.text, lang);
  if (!a.active || !text || dismissed === a.id) return null;
  const warn = a.level === 'warn';
  return (
    <View accessibilityLiveRegion="polite" style={{
      position: 'absolute', left: t.space.md, right: t.space.md, bottom: Platform.OS === 'web' ? t.space.md : t.space.xxl,
      backgroundColor: warn ? t.colors.warningBg : t.colors.surface, borderColor: t.colors.border, borderWidth: 1,
      borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.sm, elevation: 6,
    }}>
      <Text>{text}</Text>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        {a.url ? <Button title={tx('rc_ann_open')} kind="secondary" onPress={() => { Linking.openURL(a.url as string).catch(() => {}); }} /> : null}
        <Pressable accessibilityRole="button" onPress={() => { setDismissed(a.id); AsyncStorage.setItem(SEEN, a.id).catch(() => {}); }} style={{ padding: t.space.sm }}>
          <Text muted>{tx('rc_dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
