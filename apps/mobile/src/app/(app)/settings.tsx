import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { openStoreListing, shareApp } from '@/lib/appShare';
import { UpdateRow } from '@/components/UpdateRow';
import { refreshUpdates } from '@/lib/updates';
import Constants from 'expo-constants';

import { Banner, Button, Card, Chip, Divider, Field, Row, Screen, Text } from '@/design-system/components';
import { useThemeCtx } from '@/design-system/ThemeProvider';
import { ThemeToggle } from '@/design-system/ThemeToggle';
import { LANGUAGES, useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useRemoteConfig } from '@/lib/remoteConfig';

export default function Settings() {
  const flags = useRemoteConfig().flags;
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

  const checkUpdates = async () => {
    if (Platform.OS !== 'android') { setMsg({ tone: 'positive', text: tx('up_latest') }); return; }
    setMsg({ tone: 'positive', text: tx('up_checking') });
    const r = await refreshUpdates(true);
    if (r.kind !== 'none') { setMsg(null); return; }
    setMsg({ tone: 'positive', text: tx('up_latest') });
  };
  const share = async () => { if ((await shareApp(profile?.username)) === 'copied') setMsg({ tone: 'positive', text: tx('share_copied') }); };

  return (
    <Screen edges={['top']}>
      <Text variant="title">{tx('st_title')}</Text>
      <UpdateRow />
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
        <ThemeToggle label={tx('th_toggle')} hint={tx('th_toggle_hint')} />
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
        <Text variant="heading">{tx('st_about')}</Text>
        <Button title={tx('st_rate')} kind="ghost" icon="star-outline" full={false} onPress={() => { void openStoreListing(); }} />
        <Button title={tx('st_share')} kind="ghost" icon="share-social-outline" full={false} onPress={share} />
        <Button title={tx('st_check_updates')} kind="ghost" icon="refresh-outline" full={false} onPress={checkUpdates} />
      </Card>

      <Card>
        {flags.premium ? <Button title={tx('st_premium')} kind="ghost" icon="diamond-outline" full={false} onPress={() => router.push('/premium')} /> : null}
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
