import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { api, type Profile } from './api';
import { config } from './config';
import { signInWithGoogle, signOutGoogle } from './google';
import { supabase } from './supabase';

type AuthCtx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | undefined;
  profileLoading: boolean;
  signInWithPassword: (identifier: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<'signed_in' | 'confirm_email'>;
  signInWithGoogle: () => Promise<'ok' | 'cancelled'>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const profileQ = useQuery({ queryKey: ['me', session?.user.id], queryFn: api.me, enabled: !!session, staleTime: 60_000 });

  const value = useMemo<AuthCtx>(() => ({
    ready,
    session,
    profile: profileQ.data,
    profileLoading: profileQ.isLoading,
    async signInWithPassword(identifier, password) {
      const tokens = await api.login(identifier.trim(), password);
      const { error } = await supabase.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      if (error) throw error;
    },
    async signUp(name, email, password) {
      const emailRedirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/home` : `${config.webUrl}/welcome`;
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name.trim() }, emailRedirectTo } });
      if (error) throw error;
      api.track('signup_completed', { method: 'email' });
      return data.session ? 'signed_in' : 'confirm_email';
    },
    signInWithGoogle,
    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${config.webUrl}/reset-password` });
      if (error) throw error;
    },
    async signOut() {
      await signOutGoogle();
      await supabase.auth.signOut();
      qc.clear();
    },
  }), [ready, session, profileQ.data, profileQ.isLoading, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}

export function friendlyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/password should|weak/i.test(msg)) return 'Choose a stronger password: 8+ characters with uppercase, lowercase, a number and a symbol.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  return msg || 'Something went wrong. Please try again.';
}
