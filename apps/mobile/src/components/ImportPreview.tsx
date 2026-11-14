import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Row, T, Tap } from '@/components/ui';
import { CATEGORIES, cat, type CategoryKey } from '@/lib/categories';
import { inr } from '@/lib/format';
import type { ParsedTxn } from '@/lib/parser';
import { font, radius, space, useTheme } from '@/theme/tokens';

export type PreviewItem = ParsedTxn & { use: boolean };

export function ImportPreview({ items, onChange, onImport, busy }: {
  items: PreviewItem[]; onChange: (next: PreviewItem[]) => void; onImport: () => void; busy?: boolean;
}) {
  const t = useTheme();
  const [openCat, setOpenCat] = useState<number | null>(null);
  const good = items.filter((i) => i.ok);
  const selected = good.filter((i) => i.use);
  const total = selected.reduce((a, i) => a + i.amount, 0);
  const set = (idx: number, patch: Partial<PreviewItem>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <View style={{ marginTop: space.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <T v="title">{good.length} kharche mile</T>
        <T v="caption" muted>{items.length - good.length} skip</T>
      </Row>
      {items.map((it, i) => (
        <Animated.View key={`${i}-${it.raw.slice(0, 20)}`} entering={FadeInDown.delay(Math.min(i, 12) * 30)}>
          {it.ok ? (
            <View style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
              <Row gap={10}>
                <Tap onPress={() => set(i, { use: !it.use })} accessibilityRole="checkbox" accessibilityState={{ checked: it.use }}
                  style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: it.use ? t.accent : t.line, backgroundColor: it.use ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {it.use ? <Text style={{ color: t.accentText, fontWeight: '800', fontSize: 13 }}>✓</Text> : null}
                </Tap>
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" numberOfLines={1}>{it.merchant}</T>
                  <T v="caption" muted>{new Date(it.occurredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</T>
                </View>
                <Tap onPress={() => setOpenCat(openCat === i ? null : i)}
                  style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: cat(it.category).color + '26' }}>
                  <T v="caption" style={{ fontSize: 11.5 }}>{cat(it.category).emoji} {cat(it.category).short} ▾</T>
                </Tap>
                <T v="num" color={t.danger}>−{inr(it.amount)}</T>
              </Row>
              {openCat === i ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 34 }}>
                  {CATEGORIES.map((c) => (
                    <Tap key={c.key} onPress={() => { set(i, { category: c.key as CategoryKey }); setOpenCat(null); }}
                      style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.key === it.category ? c.color + '40' : t.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
                      <T v="caption" style={{ fontSize: 11.5 }}>{c.emoji} {c.short}</T>
                    </Tap>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line, opacity: 0.5 }}>
              <T v="caption" numberOfLines={1}>{it.raw.slice(0, 70)}</T>
              <T v="caption" muted>{it.reason}</T>
            </View>
          )}
        </Animated.View>
      ))}
      <Button title={selected.length ? `${selected.length} add karo · ${inr(total)}` : 'Kuch select nahi'} onPress={onImport} disabled={!selected.length} loading={busy} style={{ marginTop: space.lg }} />
      <T v="caption" muted center style={{ marginTop: 8, fontFamily: font.body }}>Same kharcha dobara import karne pe duplicate nahi banega.</T>
    </View>
  );
}
