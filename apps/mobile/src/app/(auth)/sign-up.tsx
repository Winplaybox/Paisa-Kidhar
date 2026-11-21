import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Field, OrDivider, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { STRONG } from '@/lib/password';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUp() {
  const t = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const errors = {
    name: name && name.trim().length < 2 ? 'Enter your name' : null,
    email: email && !EMAIL.test(email.trim()) ? 'Enter a valid email' : null,
    password: password && !STRONG(password) ? '8+ characters with uppercase, lowercase, a number and a symbol' : null,
  };
  const valid = name.trim().length >= 2 && EMAIL.test(email.trim()) && !errors.password && password.length >= 8;

  const submit = async () => {
    setErr(null);
    if (!valid) { setErr('Please fix the highlighted fields.'); return; }
    setBusy(true);
    try {
      const res = await signUp(name, email, password);
      if (res === 'confirm_email') setSent(true);
      else router.replace('/home');
    } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <Screen>
        <Text variant="title">Check your inbox</Text>
        <Banner tone="positive" title={`We sent a confirmation link to ${email.trim()}`}
          body="Open it on this phone to finish creating your account. Your username is created automatically — you can change it later in Settings." />
        <Button title="Back to sign in" kind="secondary" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Create your account</Text>
      <Text muted>We'll create a username for you automatically — you can use it or your email to sign in.</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <GoogleButton onError={setErr} />
      <OrDivider />
      <View style={{ gap: t.space.lg }}>
        <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Riya Sharma" error={errors.name} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          textContentType="emailAddress" placeholder="riya@gmail.com" error={errors.email} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword"
          placeholder="e.g. Shaadi@2027" error={errors.password} onSubmitEditing={submit} />
        <Button title="Create account" kind="accent" loading={busy} onPress={submit} />
      </View>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        By creating an account you agree to the <Link href="/legal/terms" style={{ color: t.colors.accent }}>Terms</Link> and{' '}
        <Link href="/legal/privacy" style={{ color: t.colors.accent }}>Privacy Policy</Link>.
      </Text>
    </Screen>
  );
}
