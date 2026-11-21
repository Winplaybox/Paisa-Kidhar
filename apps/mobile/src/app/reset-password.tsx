import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Field, Screen, Text } from '@/design-system/components';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { STRONG } from '@/lib/password';

export default function ResetPassword() {
  const { session } = useAuth();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!session) {
    return <Screen><Banner tone="warning" title="This reset link has expired or was already used." body="Request a new link from the sign-in screen." />
      <Button title="Go to sign in" kind="secondary" onPress={() => router.replace('/sign-in')} /></Screen>;
  }
  return (
    <Screen>
      <Text variant="title">Choose a new password</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" hint="8+ characters with uppercase, lowercase, a number and a symbol" />
      <Button title="Save password" kind="accent" loading={busy} onPress={async () => {
        if (!STRONG(pw)) { setErr('Use 8+ characters with uppercase, lowercase, a number and a symbol.'); return; }
        setBusy(true); setErr(null);
        const { error } = await supabase.auth.updateUser({ password: pw });
        setBusy(false);
        if (error) setErr(friendlyAuthError(error)); else router.replace('/home');
      }} />
    </Screen>
  );
}
