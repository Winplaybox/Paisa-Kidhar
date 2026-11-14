import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { Txn } from '@/lib/budget';
import { RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Empty, Row, SectionTitle, Segmented, Skeleton, T, Tap } from '@/components/ui';
import { useDailyTotals, useMonthlyCategoryTotals, useMonthTxns, useProfile } from '@/data/queries';
import { fetchInsights } from '@/lib/api';
import { addDays, addMonths, baseDaily, daysInMonth, fromMonthKey, monthKey, monthlySpendable, startOfDay } from '@/lib/budget';
import { CATEGORIES, cat } from '@/lib/categories';
import { fmtMonth, inr, inrCompact } from '@/lib/format';
import { AdBanner } from '@/providers/ads';
import { useAuth } from '@/providers/auth';
import { font, radius, space, useTheme } from '@/theme/tokens';

const EMPTY_TX: Txn[] = [];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BRAND_WORDS = ['swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'amazon', 'flipkart', 'myntra', 'uber', 'ola', 'rapido', 'starbucks', 'netflix', 'spotify', 'bigbasket'];
const brand = (m: string) => {
  const l = m.toLowerCase();
  const w = BRAND_WORDS.find((b) => l.includes(b));
  return w ? w[0].toUpperCase() + w.slice(1) : m;
};

export default function Insights() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 520) - space.lg * 2 - space.lg * 2 - 34;
  const [mk, setMk] = useState(monthKey(new Date()));
  const [catView, setCatView] = useState<'donut' | 'bars'>('donut');
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const [focusCat, setFocusCat] = useState<string | null>(null);

  const profile = useProfile();
  const month = useMonthTxns(mk);
  const daily = useDailyTotals(120);
  const trend = useMonthlyCategoryTotals(6);
  const { session } = useAuth();
  const smart = useQuery({
    queryKey: ['insights', session?.user.id, mk, (month.data ?? []).length],
    queryFn: () => fetchInsights(mk),
    enabled: !!session && (month.data?.length ?? 0) > 0,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const p = profile.data;
  const txns = month.data ?? EMPTY_TX;
  const first = fromMonthKey(mk);
  const now = new Date();
  const isCur = mk === monthKey(now);
  const dim = daysInMonth(first);
  const passed = isCur ? now.getDate() : dim;
  const createdAt = p ? new Date(p.created_at) : first;
  const startD = monthKey(createdAt) === mk ? createdAt.getDate() : 1;
  const active = Math.max(1, passed - startD + 1);

  const s = (() => {
    if (!p) return null;
    const base = baseDaily(p, first);
    const budget = monthlySpendable(p);
    const total = txns.reduce((a, x) => a + x.amount, 0);
    const days = Array.from({ length: dim }, () => 0);
    const byCat = new Map<string, number>();
    const byM = new Map<string, { v: number; n: number; cat: string }>();
    for (const x of txns) {
      const d = new Date(x.occurred_at);
      days[d.getDate() - 1] += x.amount;
      byCat.set(x.category, (byCat.get(x.category) ?? 0) + x.amount);
      const b = brand(x.merchant);
      const cur = byM.get(b) ?? { v: 0, n: 0, cat: x.category };
      cur.v += x.amount; cur.n += 1; byM.set(b, cur);
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const avg = total / active;
    const projection = isCur ? total + avg * (dim - passed) : total;
    let cum = 0;
    const cumulative = days.slice(0, passed).map((v) => (cum += v));
    const underDays = days.slice(startD - 1, passed).filter((v) => v <= base).length;
    const top = [...byM.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 6);
    const small = txns.filter((x) => x.amount <= 300);
    return { base, budget, total, days, cats, avg, projection, cumulative, underDays, top, smallCount: small.length, smallSum: small.reduce((a, x) => a + x.amount, 0) };
  })();

  const weekday = (() => {
    if (!daily.data || !p) return null;
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    const created = startOfDay(new Date(p.created_at));
    for (let d = addDays(startOfDay(now), -119); d <= now; d = addDays(d, 1)) {
      if (d < created) continue;
      const k = `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
      const w = (d.getDay() + 6) % 7;
      sums[w] += daily.data.get(k) ?? 0; counts[w] += 1;
    }
    const avgs = sums.map((v, i) => (counts[i] ? v / counts[i] : 0));
    const max = Math.max(...avgs);
    return { avgs, worst: max > 0 ? avgs.indexOf(max) : -1 };
  })();

  const trendData = (() => {
    if (!trend.data) return [];
    const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonths(new Date(), i - 5)));
    return months.map((m) => ({
      label: fromMonthKey(m).toLocaleDateString('en-IN', { month: 'short' }),
      stacks: CATEGORIES.map((c) => ({ value: trend.data!.filter((r) => r.month === m && r.category === c.key).reduce((a, r) => a + r.total, 0), color: c.color }))
        .filter((x) => x.value > 0),
    })).map((x) => (x.stacks.length ? x : { ...x, stacks: [{ value: 0, color: 'transparent' }] }));
  })();

  const axis = { yAxisTextStyle: { color: t.textMuted, fontSize: 10, fontFamily: font.body }, xAxisLabelTextStyle: { color: t.textMuted, fontSize: 10, fontFamily: font.body } };
  const loading = profile.isLoading || month.isLoading;
  const canNext = mk < monthKey(now);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 130 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={month.isRefetching} onRefresh={() => { month.refetch(); trend.refetch(); daily.refetch(); smart.refetch(); }} tintColor={t.accent} />}>
        {/* Month nav */}
        <Row style={{ justifyContent: 'space-between', marginBottom: space.lg }}>
          <Tap onPress={() => setMk(monthKey(addMonths(first, -1)))} style={navBtn(t)} accessibilityLabel="Pichla mahina"><T v="title">‹</T></Tap>
          <T v="h2">{fmtMonth(first)}</T>
          <Tap onPress={() => canNext && setMk(monthKey(addMonths(first, 1)))} disabled={!canNext} style={navBtn(t)} accessibilityLabel="Agla mahina"><T v="title">›</T></Tap>
        </Row>

        {loading || !s ? (
          <View style={{ gap: 12 }}><Skeleton h={110} r={20} /><Skeleton h={260} r={20} /><Skeleton h={200} r={20} /></View>
        ) : !txns.length ? (
          <Card><Empty emoji="📭" title="Is mahine ka koi data nahi" body="Kharcha add karo, ya bank SMS / statement import karo — charts yahin dikhenge." /></Card>
        ) : (
          <>
            {/* Summary */}
            <Animated.View entering={FadeInDown.duration(350)}>
              <Card>
                <Row gap={8}>
                  <Mini label="Total kharcha" value={inr(s.total)} />
                  <Mini label="Salary ka" value={`${Math.round((s.total / Math.max(1, s.budget)) * 100)}%`} color={s.total > s.budget ? t.danger : t.accent} />
                  <Mini label="Avg / din" value={inr(s.avg)} color={s.avg > s.base ? t.danger : undefined} />
                </Row>
                {isCur ? (
                  <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: (s.projection > s.budget ? t.danger : t.accent) + '18' }}>
                    <T v="caption" center>
                      Is speed se month end tak <T v="caption" style={{ fontFamily: font.bodyBold }} color={s.projection > s.budget ? t.danger : t.accent}>{inr(s.projection)}</T> kharch hoga
                      {s.projection > s.budget ? ` — salary se ${inr(s.projection - s.budget)} zyada 😱` : ` — ${inr(s.budget - s.projection)} bachenge 💰`}
                    </T>
                  </View>
                ) : null}
              </Card>
            </Animated.View>

            {/* Category split */}
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <Card style={{ marginTop: space.md }}>
                <SectionTitle title="Paisa kidhar gaya?" right={<View style={{ width: 150 }}><Segmented value={catView} onChange={setCatView} options={[{ key: 'donut', label: 'Donut' }, { key: 'bars', label: 'Bars' }]} /></View>} />
                {catView === 'donut' ? (
                  <View style={{ alignItems: 'center' }}>
                    <PieChart
                      data={s.cats.map(([k, v]) => ({ value: v, color: cat(k).color, focused: focusCat === k, onPress: () => setFocusCat(focusCat === k ? null : k) }))}
                      donut radius={95} innerRadius={64} innerCircleColor={t.card} focusOnPress sectionAutoFocus isAnimated animationDuration={700}
                      centerLabelComponent={() => {
                        const f = focusCat ? s.cats.find(([k]) => k === focusCat) : null;
                        return (
                          <View style={{ alignItems: 'center' }}>
                            <T v="caption" muted>{f ? cat(f[0]).name : 'Total'}</T>
                            <T v="numLg">{inrCompact(f ? f[1] : s.total)}</T>
                            {f ? <T v="caption" muted>{Math.round((f[1] / s.total) * 100)}%</T> : null}
                          </View>
                        );
                      }}
                    />
                    <View style={{ alignSelf: 'stretch', marginTop: space.lg, gap: 8 }}>
                      {s.cats.map(([k, v]) => (
                        <Tap key={k} onPress={() => setFocusCat(focusCat === k ? null : k)} haptic={false}>
                          <Row gap={10} style={{ opacity: focusCat && focusCat !== k ? 0.45 : 1 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cat(k).color }} />
                            <T v="caption" style={{ flex: 1 }}>{cat(k).emoji} {cat(k).name}</T>
                            <T v="caption" muted>{Math.round((v / s.total) * 100)}%</T>
                            <T v="caption" style={{ fontFamily: font.bodySemi, width: 74, textAlign: 'right' }}>{inr(v)}</T>
                          </Row>
                        </Tap>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {s.cats.map(([k, v]) => (
                      <View key={k}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                          <T v="caption">{cat(k).emoji} {cat(k).name}</T>
                          <T v="caption" style={{ fontFamily: font.bodySemi }}>{inr(v)}</T>
                        </Row>
                        <View style={{ height: 10, backgroundColor: t.bgElevated, borderRadius: radius.pill, overflow: 'hidden' }}>
                          <View style={{ width: `${(v / s.cats[0][1]) * 100}%`, height: '100%', backgroundColor: cat(k).color, borderRadius: radius.pill }} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Animated.View>

            {/* Daily bars vs budget */}
            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <Card style={{ marginTop: space.md }}>
                <SectionTitle title="Roz ka kharcha" right={<T v="caption" muted>{s.underDays}/{active} din budget mein</T>} />
                <BarChart
                  data={s.days.map((v, i) => ({
                    value: v, frontColor: v > s.base ? t.danger : v ? t.accent : t.ringTrack,
                    label: (i + 1) % 5 === 1 ? String(i + 1) : '',
                    onPress: () => setFocusDay(i + 1),
                  }))}
                  width={chartW} height={150} barWidth={Math.max(3, chartW / dim - 3)} spacing={2.5} initialSpacing={4} endSpacing={4}
                  barBorderRadius={3} noOfSections={3} maxValue={Math.max(s.base * 1.4, ...s.days) * 1.05}
                  showReferenceLine1 referenceLine1Position={s.base}
                  referenceLine1Config={{ color: t.warn, dashWidth: 4, dashGap: 4, thickness: 1.5 }}
                  rulesColor={t.line} xAxisColor={t.line} yAxisThickness={0} yAxisLabelWidth={34}
                  formatYLabel={(l: string) => inrCompact(Number(l))} disableScroll isAnimated animationDuration={600}
                  {...axis}
                />
                <T v="caption" muted style={{ marginTop: 8 }}>
                  {focusDay
                    ? `${focusDay} ${first.toLocaleDateString('en-IN', { month: 'short' })}: ${inr(s.days[focusDay - 1])} · ${s.days[focusDay - 1] > s.base ? `${inr(s.days[focusDay - 1] - s.base)} zyada` : `${inr(s.base - s.days[focusDay - 1])} bacha`}`
                    : `Peeli line = daily budget ${inr(s.base)}. Bar tap karo details ke liye.`}
                </T>
              </Card>
            </Animated.View>

            {/* Cumulative pace */}
            <Animated.View entering={FadeInDown.delay(180).duration(350)}>
              <Card style={{ marginTop: space.md }}>
                <SectionTitle title="Month pace" right={<Row gap={10}><Legend color={t.danger} label="Asli" /><Legend color={t.accent} label="Ideal" /></Row>} />
                <LineChart
                  data={s.cumulative.map((v, i) => ({ value: v, label: (i + 1) % 7 === 1 ? String(i + 1) : '' }))}
                  data2={Array.from({ length: dim }, (_, i) => ({ value: s.base * (i + 1) }))}
                  width={chartW} height={150} spacing={chartW / dim} initialSpacing={2} endSpacing={0}
                  color1={t.danger} color2={t.accent} thickness1={3} thickness2={2} strokeDashArray2={[5, 4]}
                  areaChart startFillColor1={t.danger} endFillColor1={t.danger} startOpacity1={0.25} endOpacity1={0.02}
                  startFillColor2={t.accent} endFillColor2={t.accent} startOpacity2={0.0} endOpacity2={0.0}
                  hideDataPoints curved noOfSections={3} rulesColor={t.line} xAxisColor={t.line} yAxisThickness={0} yAxisLabelWidth={34}
                  formatYLabel={(l: string) => inrCompact(Number(l))} disableScroll isAnimated
                  {...axis}
                />
                <T v="caption" muted style={{ marginTop: 8 }}>Laal line hari line ke upar = salary jaldi khatam hogi.</T>
              </Card>
            </Animated.View>

            {/* Weekday pattern */}
            {weekday ? (
              <Animated.View entering={FadeInDown.delay(240).duration(350)}>
                <Card style={{ marginTop: space.md }}>
                  <SectionTitle title="Kaunse din sabse zyada?" right={weekday.worst >= 0 ? <T v="caption" muted>{WEEKDAYS[weekday.worst]} danger day 😬</T> : undefined} />
                  <BarChart
                    data={weekday.avgs.map((v, i) => ({ value: v, label: WEEKDAYS[i], frontColor: i === weekday.worst ? t.danger : t.violet }))}
                    width={chartW} height={130} barWidth={chartW / 7 - 14} spacing={12} initialSpacing={6} barBorderRadius={6}
                    noOfSections={3} rulesColor={t.line} xAxisColor={t.line} yAxisThickness={0} yAxisLabelWidth={34}
                    formatYLabel={(l: string) => inrCompact(Number(l))} disableScroll isAnimated
                    {...axis}
                  />
                  <T v="caption" muted style={{ marginTop: 8 }}>Pichle 4 mahine ka average per weekday.</T>
                </Card>
              </Animated.View>
            ) : null}

            {/* 6-month trend */}
            {trendData.length ? (
              <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                <Card style={{ marginTop: space.md }}>
                  <SectionTitle title="6 mahine ka trend" />
                  <BarChart
                    stackData={trendData} width={chartW} height={160} barWidth={chartW / 6 - 16} spacing={14} initialSpacing={8}
                    barBorderRadius={6} noOfSections={3} rulesColor={t.line} xAxisColor={t.line} yAxisThickness={0} yAxisLabelWidth={34}
                    formatYLabel={(l: string) => inrCompact(Number(l))} disableScroll isAnimated
                    {...axis}
                  />
                </Card>
              </Animated.View>
            ) : null}

            {/* Top merchants */}
            <Animated.View entering={FadeInDown.delay(360).duration(350)}>
              <Card style={{ marginTop: space.md }}>
                <SectionTitle title="Top merchants" />
                {s.top.map(([m, o], i) => (
                  <Row key={m} gap={12} style={{ paddingVertical: 8 }}>
                    <T v="caption" muted style={{ width: 16 }}>{i + 1}</T>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: cat(o.cat).color + '24', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 17 }}>{cat(o.cat).emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong" numberOfLines={1}>{m}</T>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: t.bgElevated, marginTop: 5, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${(o.v / s.top[0][1].v) * 100}%`, backgroundColor: cat(o.cat).color }} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T v="num" style={{ fontSize: 14 }}>{inr(o.v)}</T>
                      <T v="caption" muted style={{ fontSize: 11 }}>{o.n} baar</T>
                    </View>
                  </Row>
                ))}
              </Card>
            </Animated.View>

            {/* Smart insights (Python engine) */}
            <Animated.View entering={FadeInDown.delay(420).duration(350)}>
              <Card style={{ marginTop: space.md }}>
                <SectionTitle title="Smart insights 🧠" right={smart.isFetching ? <T v="caption" muted>soch raha hoon…</T> : undefined} />
                {smart.data?.insights.length ? (
                  smart.data.insights.map((ins) => (
                    <Row key={ins.id} gap={12} style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
                      <Text style={{ fontSize: 20 }}>{ins.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong">{ins.title}</T>
                        <T v="caption" muted>{ins.body}</T>
                      </View>
                    </Row>
                  ))
                ) : (
                  <View style={{ gap: 8 }}>
                    <T v="caption">🛒 Quick commerce: <T v="caption" style={{ fontFamily: font.bodyBold }}>{inr(s.cats.find(([k]) => k === 'grocery')?.[1] ?? 0)}</T> — saal bhar mein ~{inr(((s.cats.find(([k]) => k === 'grocery')?.[1] ?? 0) / active) * 365)}</T>
                    <T v="caption">🪙 Chhote kharche (≤₹300): {s.smallCount} baar = <T v="caption" style={{ fontFamily: font.bodyBold }}>{inr(s.smallSum)}</T>. Boond boond se sagar khaali hota hai.</T>
                    {smart.isError ? <T v="caption" muted>Detailed insights abhi load nahi hue — thodi der mein pull-to-refresh karo.</T> : null}
                  </View>
                )}
              </Card>
            </Animated.View>
          </>
        )}
        <AdBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const navBtn = (t: ReturnType<typeof useTheme>) => ({ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center' as const, justifyContent: 'center' as const });

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bgElevated, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' }}>
      <T v="num" color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T v="caption" muted style={{ fontSize: 11 }}>{label}</T>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={5}>
      <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: color }} />
      <T v="caption" muted style={{ fontSize: 11 }}>{label}</T>
    </Row>
  );
}
