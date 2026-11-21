# @paisa/design-tokens — OVD Base Design System adapter

`tokens.json` is the language-neutral contract (SCRUM-27). It mirrors the CSS custom properties in
OVD (`Winplaybox/anydownloader` → `src/index.css`) one-to-one:

| OVD CSS var | token |
|---|---|
| `--bg`, `--bg-alt`, `--surface` | `base.{light,dark}.bg / bgAlt / surface` |
| `--text`, `--text-muted` | `text / textMuted` |
| `--border`, `--border-strong` | `border / borderStrong` |
| `--primary`, `--on-primary` | `primary / onPrimary` |
| `--accent`, `--accent-bg` | `accent / accentBg` |
| `--positive*`, `--negative*`, `--warning*` | same names, camelCase |
| `--r-sm/md/lg/pill` | `radius.sm/md/lg/pill` (`xl` = OVD paste-bar 22px) |
| `--font`, `--font-display` | `font.body` (Instrument Sans), `font.display` (Bricolage Grotesque) |
| `--shadow-1/2`, `--glow` | `shadow.1/2` (native maps to elevation) |

## Product branding (no fork)

`brands["paisa-kidhar"]` overrides **only** `accent`, `onAccent`, `accentBg`, `highlight`, and a warm ivory `bg/bgAlt` in light mode
(Jira SCRUM-6 visual direction: ivory, rose/plum, subtle gold). Everything else — neutrals, typography, radii, spacing, motion,
state colours — is OVD. `registryThemes` are the per-registry accent presets guests see.

### Intentional deviations (need product-owner sign-off per SCRUM-27)
1. Light `bg` `#FFFCF7` (ivory) instead of OVD `#FFFFFF` — wedding warmth.
2. Accent is rose `#9D174D` instead of OVD monochrome black. Contrast on white: 7.9:1 (AA/AAA).

## Consumers
- `apps/mobile/src/design-system/theme.ts` — React Native + web (Expo) theme built from this file.
- Any React web surface can generate CSS variables from the same JSON.
