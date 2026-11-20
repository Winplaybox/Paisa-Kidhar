import tokens from '../../../../packages/design-tokens/tokens.json';

export type Scheme = 'light' | 'dark';
export type RegistryTheme = keyof typeof tokens.registryThemes;

const brand = tokens.brands['paisa-kidhar'];

export function buildTheme(scheme: Scheme, registryTheme?: RegistryTheme) {
  const base = tokens.base[scheme];
  const b = brand[scheme] as Record<string, string>;
  const colors = { ...base, onAccent: '#FFFFFF', highlight: base.warning, highlightBg: base.warningBg, ...b };
  if (registryTheme) {
    const t = tokens.registryThemes[registryTheme];
    colors.accent = scheme === 'dark' ? t.accentDark : t.accent;
    colors.accentBg = scheme === 'dark' ? t.accentBgDark : t.accentBg;
    colors.onAccent = scheme === 'dark' ? '#0A0A0A' : '#FFFFFF';
  }
  return {
    scheme,
    colors,
    radius: tokens.base.radius,
    space: tokens.base.space,
    size: tokens.base.font.size,
    touch: tokens.base.touchTarget,
    motion: tokens.base.motion,
    chart: tokens.chart[scheme],
    font: {
      body: 'InstrumentSans_400Regular',
      medium: 'InstrumentSans_500Medium',
      semibold: 'InstrumentSans_600SemiBold',
      display: 'BricolageGrotesque_700Bold',
      displaySemi: 'BricolageGrotesque_600SemiBold',
    },
    elevation: (level: 1 | 2) =>
      scheme === 'dark'
        ? { shadowColor: '#000', shadowOpacity: level === 1 ? 0.4 : 0.7, shadowRadius: level === 1 ? 2 : 20, shadowOffset: { width: 0, height: level === 1 ? 1 : 14 }, elevation: level === 1 ? 1 : 6 }
        : { shadowColor: '#000', shadowOpacity: level === 1 ? 0.08 : 0.18, shadowRadius: level === 1 ? 10 : 24, shadowOffset: { width: 0, height: level === 1 ? 4 : 12 }, elevation: level === 1 ? 2 : 6 },
  };
}

export type Theme = ReturnType<typeof buildTheme>;
export const registryThemeNames = Object.keys(tokens.registryThemes) as RegistryTheme[];
export const registryThemeSwatch = (t: RegistryTheme) => tokens.registryThemes[t].accent;
