import { router } from 'expo-router';
import { isLeakedPassword } from '@/lib/pwned';
import { useState } from 'react';

import { Banner, Button, Field, Screen, Text } from '@/design-system/components';
import { useI18n } from '@/i18n';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { STRONG } from '@/lib/password';

export default function ResetPassword() {
  const { t: tx } = useI18n();
  const { session } = useAuth();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!session) {
    return <Screen><Banner tone="warning" title={tx('rp_expired')} body={tx('rp_expired_b')} />
      <Button title={tx('rp_to_signin')} kind="secondary" onPress={() => router.replace('/sign-in')} /></Screen>;
  }
  return (
    <Screen>
      <Text variant="title">{tx('rp_choose')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Field label={tx('rp_new')} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" hint={tx('rp_rule')} />
      <Button title={tx('rp_save')} kind="accent" loading={busy} onPress={async () => {
        if (!STRONG(pw)) { setErr(tx('rp_rule_err')); return; }
        setBusy(true); setErr(null);
        if (await isLeakedPassword(pw)) { setBusy(false); setErr(tx('pw_leaked')); return; }
        const { error } = await supabase.auth.updateUser({ password: pw });
        setBusy(false);
        if (error) setErr(friendlyAuthError(error)); else router.replace('/home');
      }} />
    </Screen>
  );
}
