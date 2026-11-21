import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

import { Banner, Button, Card, Chip, Divider, Field, Row, Screen, Text } from '@/design-system/components';
import { useThemeCtx } from '@/design-system/ThemeProvider';
import { LANGUAGES, useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { profile, signOut } = useAuth();
  const { pref, setPref, theme: t } = useThemeCtx();
  const { t: tx, lang, setLang } = useI18n();
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
      setMsg({ tone: 'positive', text: tx('st_saved') });
    } catch (e) { setMsg({ tone: 'negative', text: errorMessage(e) }); } finally { setSaving(false); }
  };

  const del = () => {
    const run = async () => {
      try { const r = await api.requestDeletion(); setMsg({ tone: 'positive', text: r.message }); await signOut(); router.replace('/welcome'); }
      catch (e) { setMsg({ tone: 'negative', text: errorMessage(e) }); }
    };
    if (Platform.OS === 'web') { if (window.confirm(tx('st_del_q'))) run(); return; }
    Alert.alert(tx('st_del_title'), tx('st_del_body'),
      [{ text: tx('common_cancel'), style: 'cancel' }, { text: tx('common_delete'), style: 'destructive', onPress: run }]);
  };

  return (
    <Screen edges={['top']}>
      <Text variant="title">{tx('st_title')}</Text>
      {msg ? <Banner tone={msg.tone} title={msg.text} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Field label={tx('common_name')} value={name} onChangeText={setName} />
        <Field label={tx('st_username')} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          hint={tx('st_username_hint')} />
        <Text variant="caption" muted>{tx('st_email_line', { email: profile?.email ?? '—' })}</Text>
        <Button title={tx('common_save')} kind="primary" loading={saving} onPress={save} />
      </Card>

      <Card>
        <Text variant="heading">{tx('st_appearance')}</Text>
        <Row gap={t.space.sm} wrap>
          {(['system', 'light', 'dark'] as const).map((p) => <Chip key={p} label={tx('th_' + p)} selected={pref === p} onPress={(e) => setPref(p, e ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : undefined)} />)}
        </Row>
      </Card>

      <Card>
        <Text variant="heading">{tx('st_language')}</Text>
        <Row gap={t.space.sm} wrap>
          {LANGUAGES.map((l) => <Chip key={l.code} label={l.native} selected={lang === l.code} onPress={() => setLang(l.code)} />)}
        </Row>
      </Card>

      <Card>
        <Button title={tx('st_premium')} kind="ghost" icon="diamond-outline" full={false} onPress={() => router.push('/premium')} />
        {profile?.is_admin ? <Button title={tx('st_admin')} kind="ghost" icon="shield-checkmark-outline" full={false} onPress={() => router.push('/admin')} /> : null}
        <Button title={tx('legal_privacy')} kind="ghost" icon="lock-closed-outline" full={false} onPress={() => router.push('/legal/privacy')} />
        <Button title={tx('legal_terms')} kind="ghost" icon="document-text-outline" full={false} onPress={() => router.push('/legal/terms')} />
        <Button title={tx('st_help')} kind="ghost" icon="help-circle-outline" full={false} onPress={() => Linking.openURL(`mailto:${config.supportEmail}?subject=Paisa%20Kidhar%20help`)} />
        <Divider />
        <Button title={tx('st_signout')} kind="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/welcome'); }} />
        <Button title={tx('st_delete')} kind="danger" icon="trash-outline" onPress={del} />
      </Card>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>{tx('st_footer', { v: Constants.expoConfig?.version ?? '' })}</Text>
    </Screen>
  );
}
