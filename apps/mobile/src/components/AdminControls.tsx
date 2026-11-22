import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, Field, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api } from '@/lib/api';
import { refreshConfig, useRemoteConfig, type Localized } from '@/lib/remoteConfig';
import { errorMessage } from '@/lib/queries';

const LANGS = ['en', 'hi', 'gu', 'mr'] as const;

/** Owner-only: change announcement, maintenance, force-update version and feature flags live, no release needed. (Admin UI is English by design.) */
export function AdminControls() {
  const t = useTheme();
  const rc = useRemoteConfig();
  const [ann, setAnn] = useState<Localized>(rc.announcement.text);
  const [annUrl, setAnnUrl] = useState(rc.announcement.url ?? '');
  const [maint, setMaint] = useState<Localized>(rc.maintenance.text);
  const [minV, setMinV] = useState(rc.min_version.android);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (key: string, value: unknown, label: string) => {
    try { await api.adminSetConfig(key, value); await refreshConfig(); setMsg({ ok: true, text: `${label} saved — live for all users.` }); }
    catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
  };
  const langFields = (v: Localized, set: (x: Localized) => void) => LANGS.map((l) => (
    <Field key={l} label={`Text (${l})`} value={v[l] ?? ''} onChangeText={(x) => set({ ...v, [l]: x })} multiline />
  ));

  return (
    <Card>
      <Text variant="heading">App controls (live)</Text>
      {msg ? <Banner tone={msg.ok ? 'positive' : 'negative'} title={msg.text} /> : null}

      <Text variant="label">Announcement banner</Text>
      {langFields(ann, setAnn)}
      <Field label="Link (optional)" value={annUrl} onChangeText={setAnnUrl} autoCapitalize="none" />
      <View style={{ gap: t.space.sm }}>
        <Button title={rc.announcement.active ? 'Publish / update (currently ON)' : 'Publish announcement'} kind="primary"
          onPress={() => save('announcement', { active: true, id: String(Date.now()), level: 'info', text: ann, url: annUrl.trim() || null }, 'Announcement')} />
        {rc.announcement.active ? <Button title="Turn announcement off" kind="secondary"
          onPress={() => save('announcement', { ...rc.announcement, active: false }, 'Announcement off')} /> : null}
      </View>

      <Text variant="label">Maintenance mode {rc.maintenance.on ? '(ON — app is blocked)' : '(off)'}</Text>
      {langFields(maint, setMaint)}
      <Button title={rc.maintenance.on ? 'Turn maintenance OFF' : 'Turn maintenance ON'} kind={rc.maintenance.on ? 'secondary' : 'danger'}
        onPress={() => save('maintenance', { on: !rc.maintenance.on, text: maint }, 'Maintenance')} />

      <Text variant="label">Force update (minimum Android version)</Text>
      <Field label="Minimum version" value={minV} onChangeText={setMinV} autoCapitalize="none" hint="Users below this must update from Play. Example: 1.0.1" />
      <Button title="Save minimum version" kind="secondary" onPress={() => save('min_version', { android: minV.trim() || '0.0.0' }, 'Minimum version')} />

      <Text variant="label">Feature flags</Text>
      {(Object.keys(rc.flags) as (keyof typeof rc.flags)[]).map((k) => (
        <Button key={k} title={`${k}: ${rc.flags[k] ? 'ON' : 'OFF'} (tap to switch)`} kind={rc.flags[k] ? 'secondary' : 'danger'}
          onPress={() => save('flags', { ...rc.flags, [k]: !rc.flags[k] }, `Flag ${k}`)} />
      ))}
    </Card>
  );
}
