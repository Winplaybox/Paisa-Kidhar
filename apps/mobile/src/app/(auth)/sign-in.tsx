import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Field, OrDivider, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { ApiError } from '@/lib/api';
import { friendlyAuthError, useAuth } from '@/lib/auth';

export default function SignIn() {
  const t = useTheme();
  const { signInWithPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (identifier.trim().length < 3 || password.length < 6) { setErr('Enter your email or username and password.'); return; }
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
      <Text variant="title">Welcome back</Text>
      <Text muted>Sign in with your email or your Paisa Kidhar username.</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <GoogleButton onError={setErr} />
      <OrDivider />
      <View style={{ gap: t.space.lg }}>
        <Field label="Email or username" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false}
          autoComplete="username" textContentType="username" placeholder="riya@gmail.com or riya_sharma" returnKeyType="next" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password"
          textContentType="password" placeholder="••••••••" returnKeyType="go" onSubmitEditing={submit} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title={show ? 'Hide password' : 'Show password'} kind="ghost" full={false} onPress={() => setShow((s) => !s)} style={{ paddingHorizontal: 0 }} />
          <Link href="/forgot" style={{ color: t.colors.accent, fontFamily: t.font.semibold }}>Forgot password?</Link>
        </Row>
        <Button title="Sign in" kind="accent" loading={busy} onPress={submit} />
      </View>
      <Text muted style={{ textAlign: 'center' }}>
        New here? <Link href="/sign-up" style={{ color: t.colors.accent, fontFamily: t.font.semibold }}>Create an account</Link>
      </Text>
    </Screen>
  );
}
