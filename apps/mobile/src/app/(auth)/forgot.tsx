import { useState } from 'react';

import { Banner, Button, Field, Screen, Text } from '@/design-system/components';
import { friendlyAuthError, useAuth } from '@/lib/auth';

export default function Forgot() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen>
      <Text variant="title">Reset password</Text>
      <Text muted>Enter the email on your account. We'll send a secure reset link.</Text>
      {done ? <Banner tone="positive" title="If that email has an account, a reset link is on its way." /> : null}
      {err ? <Banner tone="negative" title={err} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Button title="Send reset link" kind="accent" loading={busy} onPress={async () => {
        setErr(null); setBusy(true);
        try { await resetPassword(email); setDone(true); } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); }
      }} />
    </Screen>
  );
}
