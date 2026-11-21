import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { buildTheme, type RegistryTheme, type Scheme, type Theme } from './theme';

type Pref = 'system' | Scheme;
type Ctx = { theme: Theme; pref: Pref; setPref: (p: Pref) => void };

const ThemeCtx = createContext<Ctx | null>(null);
const KEY = 'pk.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [pref, setPrefState] = useState<Pref>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    }).catch(() => {});
  }, []);
  const scheme: Scheme = pref === 'system' ? system : pref;
  const value = useMemo<Ctx>(() => ({
    theme: buildTheme(scheme),
    pref,
    setPref: (p) => { setPrefState(p); AsyncStorage.setItem(KEY, p).catch(() => {}); },
  }), [scheme, pref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemeCtx() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('ThemeProvider missing');
  return ctx;
}

export function useTheme(registryTheme?: RegistryTheme): Theme {
  const { theme } = useThemeCtx();
  return useMemo(() => (registryTheme ? buildTheme(theme.scheme, registryTheme) : theme), [theme, registryTheme]);
}
