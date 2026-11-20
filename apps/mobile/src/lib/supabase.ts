// The ONE Supabase client for this runtime. Used for auth only — app data goes through the API.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config } from './config';

const isServer = typeof window === 'undefined';

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    storage: Platform.OS === 'web' ? (isServer ? undefined : window.localStorage) : AsyncStorage,
    storageKey: 'pk.auth',
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: Platform.OS === 'web' && !isServer,
    flowType: 'pkce',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
