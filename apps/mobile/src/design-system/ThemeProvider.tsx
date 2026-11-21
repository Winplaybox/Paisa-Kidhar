import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, useColorScheme } from 'react-native';

import { buildTheme, type RegistryTheme, type Scheme, type Theme } from './theme';

type Pref = 'system' | Scheme;
type Origin = { x: number; y: number };
type Ctx = { theme: Theme; pref: Pref; setPref: (p: Pref, origin?: Origin) => void };

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
  const commit = useCallback((p: Pref) => { setPrefState(p); AsyncStorage.setItem(KEY, p).catch(() => {}); }, []);

  // Circular colour-wash from the tap point, then the theme swaps underneath and the wash fades out.
  const grow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const [wash, setWash] = useState<{ x: number; y: number; d: number; color: string } | null>(null);

  const setPref = useCallback((p: Pref, origin?: Origin) => {
    const next: Scheme = p === 'system' ? system : p;
    if (next === scheme || busy.current) { commit(p); return; }
    const { width, height } = Dimensions.get('window');
    const x = origin?.x ?? width / 2;
    const y = origin?.y ?? height / 2;
    const d = 2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    busy.current = true;
    grow.setValue(0); fade.setValue(1);
    setWash({ x, y, d, color: buildTheme(next).colors.bg });
    Animated.timing(grow, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      commit(p);
      setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => { setWash(null); busy.current = false; });
      }, 60);
    });
  }, [system, scheme, commit, grow, fade]);

  const value = useMemo<Ctx>(() => ({ theme: buildTheme(scheme), pref, setPref }), [scheme, pref, setPref]);
  return (
    <ThemeCtx.Provider value={value}>
      {children}
      {wash ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade, overflow: 'hidden' }]}>
          <Animated.View style={{
            position: 'absolute', left: wash.x - wash.d / 2, top: wash.y - wash.d / 2, width: wash.d, height: wash.d,
            borderRadius: wash.d / 2, backgroundColor: wash.color,
            transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) }],
          }} />
        </Animated.View>
      ) : null}
    </ThemeCtx.Provider>
  );
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
