import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

import { Banner, Button, Card, Chip, Divider, Field, Row, Screen, Text } from '@/design-system/components';
import { useThemeCtx } from '@/design-system/ThemeProvider';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { profile, signOut } = useAuth();
  const { pref, setPref, theme: t } = useThemeCtx();
  const qc = useQueryClient();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [name, setName] = useState(profile?.display_name ?? '');
  const [msg, setMsg] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setUsername(profile?.username ?? ''); setName(profile?.display_name ?? ''); }, [profile?.username, profile?.display_name]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.updateMe({ username: username.trim().toLowerCase(), display_name: name.trim() });
      await qc.invalidateQueries({ queryKey: ['me'] });
      setMsg({ tone: 'positive', text: 'Profile saved.' });
    } catch (e) { setMsg({ tone: 'negative', text: errorMessage(e) }); } finally { setSaving(false); }
  };

  const del = () => {
    const run = async () => {
      try { const r = await api.requestDeletion(); setMsg({ tone: 'positive', text: r.message }); await signOut(); router.replace('/welcome'); }
      catch (e) { setMsg({ tone: 'negative', text: errorMessage(e) }); }
    };
    if (Platform.OS === 'web') { if (window.confirm('Delete your account and all registry data?')) run(); return; }
    Alert.alert('Delete account?', 'Your registries are hidden immediately and all data is erased within 30 days. This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
  };

  return (
    <Screen edges={['top']}>
      <Text variant="title">Profile</Text>
      {msg ? <Banner tone={msg.tone} title={msg.text} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Field label="Your name" value={name} onChangeText={setName} />
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          hint="You can sign in with this or your email. 3–24 lowercase letters, numbers, _" />
        <Text variant="caption" muted>Email: {profile?.email ?? '—'}</Text>
        <Button title="Save" kind="primary" loading={saving} onPress={save} />
      </Card>

      <Card>
        <Text variant="heading">Appearance</Text>
        <Row gap={t.space.sm} wrap>
          {(['system', 'light', 'dark'] as const).map((p) => <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={pref === p} onPress={() => setPref(p)} />)}
        </Row>
      </Card>

      <Card>
        <Button title="Premium" kind="ghost" icon="diamond-outline" full={false} onPress={() => router.push('/premium')} />
        {profile?.is_admin ? <Button title="Admin console" kind="ghost" icon="shield-checkmark-outline" full={false} onPress={() => router.push('/admin')} /> : null}
        <Button title="Privacy Policy" kind="ghost" icon="lock-closed-outline" full={false} onPress={() => router.push('/legal/privacy')} />
        <Button title="Terms" kind="ghost" icon="document-text-outline" full={false} onPress={() => router.push('/legal/terms')} />
        <Button title="Help & support" kind="ghost" icon="help-circle-outline" full={false} onPress={() => Linking.openURL(`mailto:${config.supportEmail}?subject=Paisa%20Kidhar%20help`)} />
        <Divider />
        <Button title="Sign out" kind="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/welcome'); }} />
        <Button title="Delete my account" kind="danger" icon="trash-outline" onPress={del} />
      </Card>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>Paisa Kidhar v{Constants.expoConfig?.version} · by WinPlayBox</Text>
    </Screen>
  );
}
