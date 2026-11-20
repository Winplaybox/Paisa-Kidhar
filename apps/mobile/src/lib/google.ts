// Web: Supabase OAuth redirect (PKCE). The session is picked up on return by detectSessionInUrl.
import { supabase } from './supabase';

export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/home` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
  return 'ok';
}

export async function signOutGoogle() {}
