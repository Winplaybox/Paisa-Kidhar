// Native Google sign-in → Supabase signInWithIdToken (no browser redirect, no secrets in the app).
import { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { config } from './config';
import { supabase } from './supabase';

let configured = false;

export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  if (!config.googleWebClientId) throw new Error('Google sign-in is not configured yet.');
  if (!configured) {
    GoogleSignin.configure({ webClientId: config.googleWebClientId, scopes: ['email', 'profile'] });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return 'cancelled';
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('Google did not return a sign-in token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return 'cancelled';
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services is unavailable on this device.');
    }
    throw e;
  }
}

export async function signOutGoogle() {
  try { await GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
}
