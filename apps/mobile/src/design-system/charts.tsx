/* Small dependency-free SVG charts (native + web). Each has an accessible text summary. */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { formatINRCompact } from '../lib/money';
import { Row, Text } from './components';
import { useTheme } from './ThemeProvider';

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  return { w, onLayout: (e: LayoutChangeEvent) => setW(Math.max(200, e.nativeEvent.layout.width)) };
}

export function AreaChart({ data, height = 160, label }: { data: { x: string; y: number }[]; height?: number; label: string }) {
  const t = useTheme();
  const { w, onLayout } = useWidth();
  const max = Math.max(1, ...data.map((d) => d.y));
  const pad = 8;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => [pad + i * step, height - pad - (d.y / max) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${height - pad} L${pts[0][0]},${height - pad} Z` : '';
  const total = data.reduce((s, d) => s + d.y, 0);
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`${label}. Total ${formatINRCompact(total)} over ${data.length} days, peak ${formatINRCompact(max)}.`}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="pkArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.accent} stopOpacity={0.28} />
            <Stop offset="1" stopColor={t.colors.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={pad} x2={w - pad} y1={pad + f * (height - pad * 2)} y2={pad + f * (height - pad * 2)} stroke={t.colors.border} strokeDasharray="3 5" />
        ))}
        {area ? <Path d={area} fill="url(#pkArea)" /> : null}
        {line ? <Path d={line} stroke={t.colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
      </Svg>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" muted>{data[0]?.x?.slice(5) ?? ''}</Text>
        <Text variant="caption" muted>{data[data.length - 1]?.x?.slice(5) ?? ''}</Text>
      </Row>
    </View>
  );
}

export function GoalBars({ goals }: { goals: { title: string; raised_paise: number; target_paise: number }[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.md }}>
      {goals.map((g, i) => {
        const p = g.target_paise ? Math.min(1, g.raised_paise / g.target_paise) : 0;
        const color = t.chart[i % t.chart.length];
        return (
          <View key={g.title + i} style={{ gap: 6 }} accessible
            accessibilityLabel={`${g.title}: ${formatINRCompact(g.raised_paise)} of ${formatINRCompact(g.target_paise)}, ${Math.round(p * 100)} percent`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>{g.title}</Text>
              <Text variant="caption" muted>{formatINRCompact(g.raised_paise)} / {formatINRCompact(g.target_paise)}</Text>
            </Row>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: t.colors.bgAlt, overflow: 'hidden' }}>
              <View style={{ width: `${p * 100}%`, height: 12, borderRadius: 6, backgroundColor: color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function Histogram({ data, height = 140 }: { data: { bucket: string; count: number }[]; height?: number }) {
  const t = useTheme();
  const { w, onLayout } = useWidth();
  const max = Math.max(1, ...data.map((d) => d.count));
  const gap = 8;
  const bw = (w - gap * (data.length - 1)) / Math.max(1, data.length);
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`Gift sizes: ${data.map((d) => `${d.bucket} ${d.count}`).join(', ')}`}>
      <Svg width={w} height={height}>
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 4);
          return <Rect key={d.bucket} x={i * (bw + gap)} y={height - h} width={bw} height={Math.max(h, 2)} rx={6} fill={d.count ? t.colors.accent : t.colors.bgAlt} />;
        })}
      </Svg>
      <Row style={{ justifyContent: 'space-between' }}>
        {data.map((d) => <Text key={d.bucket} variant="caption" muted style={{ width: bw, textAlign: 'center', fontSize: 10 }}>{d.bucket}</Text>)}
      </Row>
    </View>
  );
}

export function Donut({ slices, size = 140, centerLabel }: { slices: { label: string; value: number; color: string }[]; size?: number; centerLabel?: string }) {
  const t = useTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Row gap={t.space.lg} wrap>
      <View accessible accessibilityLabel={slices.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.colors.bgAlt} strokeWidth={18} fill="none" />
            {total > 0 && slices.map((s) => {
              const len = (s.value / total) * c;
              const el = <Circle key={s.label} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={18} fill="none"
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        {centerLabel ? (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <Text variant="heading">{centerLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 6, flex: 1, minWidth: 140 }}>
        {slices.map((s) => (
          <Row key={s.label} gap={8}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text variant="caption" style={{ flex: 1 }}>{s.label}</Text>
            <Text variant="label">{s.value}</Text>
          </Row>
        ))}
      </View>
    </Row>
  );
}
