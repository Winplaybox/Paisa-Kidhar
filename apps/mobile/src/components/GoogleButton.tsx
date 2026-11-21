import { useState } from 'react';

import { Button } from '@/design-system/components';
import { useI18n } from '@/i18n';
import { friendlyAuthError, useAuth } from '@/lib/auth';

export function GoogleButton({ onError }: { onError: (msg: string | null) => void }) {
  const { signInWithGoogle } = useAuth();
  const { t: tx } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={tx('gb_continue')} kind="secondary" icon="logo-google" loading={busy}
      onPress={async () => {
        onError(null);
        setBusy(true);
        try { await signInWithGoogle(); } catch (e) { onError(friendlyAuthError(e)); } finally { setBusy(false); }
      }}
    />
  );
}
