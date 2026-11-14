import { useColorScheme } from 'react-native';

const palette = {
  lime: '#B8F34A',
  limeDeep: '#7CC31F',
  coral: '#FF5C5C',
  amber: '#FFB547',
  sky: '#7DD3FC',
  violet: '#A78BFA',
};

export const dark = {
  mode: 'dark' as 'dark' | 'light',
  bg: '#0B0F1A',
  bgElevated: '#121829',
  card: '#161D31',
  cardAlt: '#1C2540',
  line: '#26304D',
  text: '#EEF2FF',
  textMuted: '#8A94B8',
  textFaint: '#5B6588',
  accent: palette.lime,
  accentText: '#0B0F1A',
  danger: palette.coral,
  warn: palette.amber,
  info: palette.sky,
  ringTrack: '#232C48',
  heroFrom: '#22305A',
  heroTo: '#161D31',
  overlay: 'rgba(0,0,0,0.55)',
  ...palette,
};

export const light: typeof dark = {
  ...dark,
  mode: 'light',
  bg: '#F5F7FB',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#EEF2F9',
  line: '#E2E7F2',
  text: '#0E1428',
  textMuted: '#5D6787',
  textFaint: '#99A2BF',
  accent: palette.limeDeep,
  accentText: '#0B0F1A',
  ringTrack: '#E6EBF5',
  heroFrom: '#E9F8D2',
  heroTo: '#FFFFFF',
  overlay: 'rgba(14,20,40,0.35)',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const font = {
  display: 'Sora_800ExtraBold',
  displayBold: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  num: 'Inter_800ExtraBold', // Sora has no ₹ glyph — all money uses Inter
} as const;
