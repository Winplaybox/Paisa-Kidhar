import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetRing } from '@/components/BudgetRing';
import { useToast } from '@/components/Toast';
import { TxRow } from '@/components/TxRow';
import { Button, Card, Empty, Pill, Row, SectionTitle, Skeleton, T, Tap } from '@/components/ui';
import { useAddTxns } from '@/data/queries';
import { useToday } from '@/hooks/useToday';
import { greeting } from '@/lib/budget';
import { QUICK_ADD } from '@/lib/categories';
import { inr } from '@/lib/format';
import { font, radius, space, useTheme } from '@/theme/tokens';

export default function Today() {
  const t = useTheme();
  const toast = useToast();
  const { profile, d, loading, refetch, refreshing, error } = useToday();
  const add = useAddTxns();
  const hour = new Date().getHours();

  const loadDemo = () => {
    const at = (h: number, m: number) => {
      const x = new Date(); x.setHours(h, m, 0, 0);
      return new Date(Math.min(x.getTime(), Date.now())).toISOString();
    };
    add.mutate([
      { amount: 250, merchant: 'Starbucks', category: 'food', occurred_at: at(9, 10), source: 'demo', note: 'Morning coffee' },
      { amount: 600, merchant: 'Blinkit', category: 'grocery', occurred_at: at(11, 30), source: 'demo' },
      { amount: 400, merchant: 'Zepto', category: 'grocery', occurred_at: at(13, 5), source: 'demo' },
      { amount: 500, merchant: 'Swiggy', category: 'food', occurred_at: at(14, 20), source: 'demo' },
      { amount: 2450, merchant: 'Amazon', category: 'shopping', occurred_at: at(16, 45), source: 'demo', note: 'because I deserve happiness' },
    ]);
    toast('Demo day loaded: ₹4,200 😅 (Settings se hata sakte ho)');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refetch(); }} tintColor={t.accent} colors={[t.accentText]} progressBackgroundColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Row style={{ justifyContent: 'space-between', marginBottom: space.lg }}>
          <View style={{ flex: 1 }}>
            <T v="caption" muted>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
            <T v="h2" numberOfLines={1}>{greeting(profile?.display_name)}</T>
          </View>
          <Tap onPress={() => router.push('/report')} accessibilityLabel="Aaj ka report card"
            style={{ backgroundColor: t.cardAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill }}>
            <T v="caption" style={{ fontFamily: font.bodySemi }}>🌙 Report</T>
          </Tap>
        </Row>

        {error ? (
          <Card style={{ marginBottom: space.md, borderColor: t.danger + '66' }}>
            <T v="bodyStrong">Data load nahi hua 😕</T>
            <T v="caption" muted>{(error as Error).message}</T>
            <Button title="Retry" kind="soft" onPress={() => { refetch(); }} style={{ marginTop: space.sm }} />
          </Card>
        ) : null}

        {/* Banner: tonight's / yesterday's report */}
        {d && hour >= 21 && d.today.length > 0 ? (
          <Animated.View entering={FadeInDown}>
            <Banner emoji="🌙" title="Aaj ka report card ready hai" body="Dekh le kitna bura behave kiya aaj 😅" onPress={() => router.push('/report')} />
          </Animated.View>
        ) : d && hour < 12 && d.yesterdaySpent > 0 ? (
          <Animated.View entering={FadeInDown}>
            <Banner emoji="📜" title="Kal ka report card" body={`${inr(d.yesterdaySpent)} kharch hua tha — grade dekho`}
              onPress={() => router.push({ pathname: '/report', params: { day: 'yesterday' } })} />
          </Animated.View>
        ) : null}

        {/* Hero */}
        <LinearGradient colors={[t.heroFrom, t.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ borderRadius: radius.xl, padding: space.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, alignItems: 'center' }}>
          {loading || !d ? (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
              <Skeleton h={200} w={200} r={100} />
              <Skeleton h={18} w={160} />
            </View>
          ) : (
            <>
              <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <T v="body" muted>Aaj ka daily income budget</T>
                <T v="num">{inr(d.budget.total)}</T>
                {d.budget.carry ? <Pill text={`${d.budget.carry > 0 ? '+' : '−'}${inr(d.budget.carry)} carry`} /> : null}
              </Row>
              <View style={{ marginVertical: space.lg }}>
                <BudgetRing progress={d.budget.total > 0 ? d.spent / d.budget.total : 1} over={d.over}>
                  <T v="label" muted>{d.over ? 'Budget se upar' : 'Bacha hai'}</T>
                  <Animated.View key={Math.round(d.left)} entering={FadeIn.duration(300)}>
                    <T v="hero" color={d.over ? t.danger : t.text} style={{ marginVertical: 2 }}>{d.over ? '−' : ''}{inr(d.left)}</T>
                  </Animated.View>
                  <T v="caption" muted>{inr(d.spent)} kharch hua</T>
                </BudgetRing>
              </View>
              <Row gap={8} style={{ alignSelf: 'stretch' }}>
                <Stat label="Is mahine" value={inr(d.monthSpent)} />
                <Stat label="Month pace" value={`${d.pace < 0 ? '−' : '+'}${inr(d.pace)}`} color={d.pace < 0 ? t.danger : t.accent} />
                <Stat label="Streak" value={`${d.streak} 🔥`} />
              </Row>
            </>
          )}
        </LinearGradient>

        {/* Quick add */}
        <Card style={{ marginTop: space.lg }}>
          <SectionTitle title="Quick add" right={<T v="caption" muted>tap = add · hold = turant</T>} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ADD.map((q) => (
              <Tap key={q.emoji + q.merchant}
                accessibilityLabel={`${q.merchant || 'UPI'} ${q.amount ? inr(q.amount) : ''}`}
                onPress={() => router.push({ pathname: '/add', params: { amount: q.amount ? String(q.amount) : '', merchant: q.merchant, category: q.category } })}
                onLongPress={() => {
                  if (!q.amount) return router.push({ pathname: '/add', params: { category: q.category } });
                  add.mutate([{ amount: q.amount, merchant: q.merchant, category: q.category, occurred_at: new Date().toISOString() }]);
                  toast(`${q.merchant} −${inr(q.amount)} ✓`);
                }}
                style={{ width: '23.3%', aspectRatio: 0.92, backgroundColor: t.bgElevated, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
                <T v="caption" numberOfLines={1} style={{ fontFamily: font.bodySemi }}>{(q.merchant || 'UPI').split(' ')[0]}</T>
                <T v="caption" muted style={{ fontSize: 11 }}>{q.amount ? inr(q.amount) : '₹?'}</T>
              </Tap>
            ))}
          </View>
          <Row gap={8} style={{ marginTop: space.md }}>
            <Button kind="soft" title="Bank SMS" icon="📩" onPress={() => router.push('/import-sms')} style={{ flex: 1, paddingVertical: 12 }} />
            <Button kind="soft" title="Statement" icon="📄" onPress={() => router.push('/import-statement')} style={{ flex: 1, paddingVertical: 12 }} />
          </Row>
        </Card>

        {/* Today's list */}
        <Animated.View layout={LinearTransition}>
          <Card style={{ marginTop: space.lg }}>
            <SectionTitle title="Aaj ka hisaab" right={d?.today.length ? <T v="caption" muted>{d.today.length} entries</T> : undefined} />
            {loading ? (
              <View style={{ gap: 12 }}><Skeleton h={42} /><Skeleton h={42} /></View>
            ) : d && d.today.length ? (
              d.today.map((tx) => (
                <Animated.View key={tx.id} entering={FadeInDown.duration(260)} layout={LinearTransition}>
                  <TxRow tx={tx} />
                </Animated.View>
              ))
            ) : (
              <Empty emoji="🙌" title="Aaj abhi tak ₹0 kharch" body="Legend behaviour. Ya entry bhool gaye? + dabao."
                action={<Tap onPress={loadDemo}><T v="caption" color={t.accent} style={{ fontFamily: font.bodySemi }}>Demo day try karo →</T></Tap>} />
            )}
          </Card>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.mode === 'dark' ? 'rgba(11,15,26,0.45)' : t.cardAlt, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
      <T v="num" color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T v="caption" muted style={{ fontSize: 11 }}>{label}</T>
    </View>
  );
}

function Banner({ emoji, title, body, onPress }: { emoji: string; title: string; body: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Tap onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.cardAlt, borderRadius: radius.lg, padding: 14, marginBottom: space.md, borderWidth: 1, borderColor: t.violet + '55' }}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        <T v="caption" muted>{body}</T>
      </View>
      <T v="title" muted>›</T>
    </Tap>
  );
}
