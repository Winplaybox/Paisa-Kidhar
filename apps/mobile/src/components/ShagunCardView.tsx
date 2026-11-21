/* The Digital Shagun Card artwork — drawn in code (SVG), so it is crisp on any screen and needs no image assets. */
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Text } from '@/design-system/components';
import type { CardDesign } from '@/lib/api';

export const CARD_DESIGNS: Record<CardDesign, { label: string; bg: [string, string]; ink: string; accent: string; soft: string }> = {
  marigold: { label: 'Marigold', bg: ['#FFF4DB', '#FDE3A7'], ink: '#5B2A00', accent: '#E07A00', soft: '#F5B94A' },
  rose: { label: 'Rose', bg: ['#FFF1F6', '#FBCFE0'], ink: '#5A0F2E', accent: '#9D174D', soft: '#F472B6' },
  royal: { label: 'Royal', bg: ['#1E1033', '#3B1F66'], ink: '#FFF4DB', accent: '#F5B94A', soft: '#C084FC' },
  mehendi: { label: 'Mehendi', bg: ['#F1F7EC', '#CFE5C0'], ink: '#1F3A12', accent: '#3F6E1F', soft: '#8DBA5A' },
};

function Petals({ color, cx, cy, r }: { color: string; cx: number; cy: number; r: number }) {
  return (
    <G>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <Circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={r * 0.55} fill={color} opacity={0.55} />;
      })}
      <Circle cx={cx} cy={cy} r={r * 0.6} fill={color} />
    </G>
  );
}

export function ShagunCardView({ design, from, message, partnerOne, partnerTwo, date, width = 340 }: {
  design: CardDesign; from?: string | null; message?: string | null; partnerOne: string; partnerTwo: string; date?: string | null; width?: number;
}) {
  const d = CARD_DESIGNS[design] ?? CARD_DESIGNS.marigold;
  const h = Math.round(width * 1.35);
  return (
    <View style={{ width, height: h, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}
      accessible accessibilityLabel={`Shagun card for ${partnerOne} and ${partnerTwo}${from ? ` from ${from}` : ''}. ${message ?? ''}`}>
      <Svg width={width} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="cardbg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={d.bg[0]} />
            <Stop offset="1" stopColor={d.bg[1]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={h} fill="url(#cardbg)" />
        <Rect x={12} y={12} width={width - 24} height={h - 24} rx={16} fill="none" stroke={d.accent} strokeWidth={1.5} strokeDasharray="2 6" />
        <Petals color={d.soft} cx={36} cy={36} r={16} />
        <Petals color={d.soft} cx={width - 36} cy={36} r={16} />
        <Petals color={d.soft} cx={36} cy={h - 36} r={16} />
        <Petals color={d.soft} cx={width - 36} cy={h - 36} r={16} />
        {/* toran (garland) */}
        <Path d={`M 60 30 Q ${width / 2} 80 ${width - 60} 30`} stroke={d.accent} strokeWidth={2} fill="none" />
        {Array.from({ length: 9 }).map((_, i) => {
          const t = (i + 1) / 10;
          const x = 60 + (width - 120) * t;
          const y = 30 + 50 * 4 * t * (1 - t) * 0.5;
          return <Circle key={i} cx={x} cy={y + 8} r={5} fill={i % 2 ? d.accent : d.soft} />;
        })}
      </Svg>
      <View style={{ flex: 1, paddingHorizontal: 34, paddingTop: 96, paddingBottom: 40, alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text variant="caption" color={d.accent} style={{ letterSpacing: 3 }}>SHUBH VIVAH</Text>
          <Text variant="title" color={d.ink} style={{ textAlign: 'center' }}>{partnerOne} & {partnerTwo}</Text>
          {date ? <Text variant="caption" color={d.ink}>{new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text> : null}
        </View>
        <Text variant="heading" color={d.ink} style={{ textAlign: 'center', fontStyle: 'italic' }} numberOfLines={7}>
          “{message?.trim() || 'Wishing you a lifetime of love, laughter and adventures together.'}”
        </Text>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="caption" color={d.accent}>with love & blessings</Text>
          <Text variant="heading" color={d.ink}>{from || 'A well-wisher'}</Text>
        </View>
      </View>
    </View>
  );
}
