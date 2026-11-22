import { Link, router } from 'expo-router';
import { isLeakedPassword } from '@/lib/pwned';
import { useState } from 'react';
import { View } from 'react-native';

import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Field, OrDivider, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { STRONG } from '@/lib/password';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUp() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const errors = {
    name: name && name.trim().length < 2 ? tx('su_err_name') : null,
    email: email && !EMAIL.test(email.trim()) ? tx('su_err_email') : null,
    password: password && !STRONG(password) ? tx('su_err_pw') : null,
  };
  const valid = name.trim().length >= 2 && EMAIL.test(email.trim()) && !errors.password && password.length >= 8;

  const submit = async () => {
    setErr(null);
    if (!valid) { setErr(tx('su_fix')); return; }
    setBusy(true);
    try {
      if (await isLeakedPassword(password)) { setErr(tx('pw_leaked')); return; }
      const res = await signUp(name, email, password);
      if (res === 'confirm_email') setSent(true);
      else router.replace('/home');
    } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <Screen>
        <Text variant="title">{tx('su_check')}</Text>
        <Banner tone="positive" title={tx('su_sent', { email: email.trim() })}
          body={tx('su_sent_body')} />
        <Button title={tx('su_back')} kind="secondary" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{tx('su_title')}</Text>
      <Text muted>{tx('su_sub')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <GoogleButton onError={setErr} />
      <OrDivider />
      <View style={{ gap: t.space.lg }}>
        <Field label={tx('common_name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Riya Sharma" error={errors.name} />
        <Field label={tx('common_email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          textContentType="emailAddress" placeholder="riya@gmail.com" error={errors.email} />
        <Field label={tx('common_password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword"
          placeholder="e.g. Shaadi@2027" error={errors.password} onSubmitEditing={submit} />
        <Button title={tx('su_btn')} kind="accent" loading={busy} onPress={submit} />
      </View>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        {tx('su_agree')}<Link href="/legal/terms" style={{ color: t.colors.accent }}>{tx('legal_terms')}</Link>{tx('and_word')}<Link href="/legal/privacy" style={{ color: t.colors.accent }}>{tx('legal_privacy')}</Link>{tx('su_agree_end')}
      </Text>
    </Screen>
  );
}
