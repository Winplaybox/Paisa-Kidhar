import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Field, OrDivider, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { ApiError } from '@/lib/api';
import { friendlyAuthError, useAuth } from '@/lib/auth';

export default function SignIn() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { signInWithPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (identifier.trim().length < 3 || password.length < 6) { setErr(tx('si_err')); return; }
    setBusy(true);
    try {
      await signInWithPassword(identifier, password);
      router.replace('/home');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : friendlyAuthError(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text variant="title">{tx('si_title')}</Text>
      <Text muted>{tx('si_sub')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <GoogleButton onError={setErr} />
      <OrDivider />
      <View style={{ gap: t.space.lg }}>
        <Field label={tx('si_id')} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false}
          autoComplete="username" textContentType="username" placeholder="riya@gmail.com or riya_sharma" returnKeyType="next" />
        <Field label={tx('common_password')} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password"
          textContentType="password" placeholder="••••••••" returnKeyType="go" onSubmitEditing={submit} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title={show ? tx('si_hide') : tx('si_show')} kind="ghost" full={false} onPress={() => setShow((s) => !s)} style={{ paddingHorizontal: 0 }} />
          <Link href="/forgot" style={{ color: t.colors.accent, fontFamily: t.font.semibold }}>{tx('si_forgot')}</Link>
        </Row>
        <Button title={tx('si_btn')} kind="accent" loading={busy} onPress={submit} />
      </View>
      <Text muted style={{ textAlign: 'center' }}>
        {tx('si_new')}<Link href="/sign-up" style={{ color: t.colors.accent, fontFamily: t.font.semibold }}>{tx('si_create')}</Link>
      </Text>
    </Screen>
  );
}
