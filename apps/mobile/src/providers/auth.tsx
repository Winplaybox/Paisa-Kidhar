import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { env } from '@/lib/env';
import { cancelAllPlanned } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

GoogleSignin.configure({
  webClientId: env.googleWebClientId,
  scopes: ['profile', 'email'],
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async signInWithGoogle() {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const res = await GoogleSignin.signIn();
          if (!isSuccessResponse(res)) return { error: 'cancelled' };
          const idToken = res.data.idToken;
          if (!idToken) return { error: 'Google ne ID token nahi diya. Web client ID check karo.' };
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
          if (error) return { error: error.message };
          return {};
        } catch (e) {
          if (isErrorWithCode(e)) {
            if (e.code === statusCodes.IN_PROGRESS) return { error: 'cancelled' };
            if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { error: 'Google Play Services available nahi hai.' };
          }
          return { error: e instanceof Error ? e.message : 'Sign in fail hua. Dobara try karo.' };
        }
      },
      async signOut() {
        try { await GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
        await cancelAllPlanned().catch(() => undefined);
        await supabase.auth.signOut();
        qc.clear();
      },
    }),
    [session, loading, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
