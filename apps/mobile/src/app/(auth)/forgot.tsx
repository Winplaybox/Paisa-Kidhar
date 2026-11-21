import { useState } from 'react';

import { Banner, Button, Field, Screen, Text } from '@/design-system/components';
import { useI18n } from '@/i18n';
import { friendlyAuthError, useAuth } from '@/lib/auth';

export default function Forgot() {
  const { resetPassword } = useAuth();
  const { t: tx } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen>
      <Text variant="title">{tx('fg_title')}</Text>
      <Text muted>{tx('fg_sub')}</Text>
      {done ? <Banner tone="positive" title={tx('fg_done')} /> : null}
      {err ? <Banner tone="negative" title={err} /> : null}
      <Field label={tx('common_email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Button title={tx('fg_btn')} kind="accent" loading={busy} onPress={async () => {
        setErr(null); setBusy(true);
        try { await resetPassword(email); setDone(true); } catch (e) { setErr(friendlyAuthError(e)); } finally { setBusy(false); }
      }} />
    </Screen>
  );
}
