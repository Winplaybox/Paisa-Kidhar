import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Row, T } from '@/components/ui';
import { useMonthTxns, useProfile } from '@/data/queries';
import { addDays, dayBudget, dayKey, gradeFor, monthKey, spentOn } from '@/lib/budget';
import { cat } from '@/lib/categories';
import { inr } from '@/lib/format';
import { useAds } from '@/providers/ads';
import { radius, space, useTheme } from '@/theme/tokens';

export default function Report() {
  const t = useTheme();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const day = dayParam === 'yesterday' ? addDays(new Date(), -1) : dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? new Date(`${dayParam}T12:00:00`) : new Date();
  const isToday = dayKey(day) === dayKey(new Date());
  const profile = useProfile();
  const month = useMonthTxns(monthKey(day));
  const { maybeShowInterstitial } = useAds();

  const p = profile.data;
  const txns = month.data ?? [];
  const list = txns.filter((x) => dayKey(new Date(x.occurred_at)) === dayKey(day));
  const budget = p ? dayBudget(p, txns, day).total : 0;
  const spent = spentOn(txns, day);
  const g = gradeFor(spent, budget);
  const diff = budget - spent;
  const toneColor = { good: t.accent, ok: t.info, warn: t.warn, bad: t.danger }[g.tone];

  const byCat = new Map<string, number>();
  list.forEach((x) => byCat.set(x.category, (byCat.get(x.category) ?? 0) + x.amount));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const biggest = [...list].sort((a, b) => b.amount - a.amount)[0];

  const close = () => { router.back(); setTimeout(() => { maybeShowInterstitial(); }, 400); };

  const share = () => Share.share({
    message: `Mera Paisa Kidhar? report card (${day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})\n` +
      `Daily income budget: ${inr(budget)}\nKharcha: ${inr(spent)}\nGrade: ${g.grade} ${g.emoji}\n"${g.line}"\n\nTum bhi try karo — Paisa Kidhar? on Play Store`,
  }).catch(() => undefined);

  return (
    <LinearGradient colors={[toneColor + '33', t.bg, t.bg]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 40 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label" muted>{isToday ? 'Aaj' : dayKey(day) === dayKey(addDays(new Date(), -1)) ? 'Kal' : ''} ka report card</T>
            <Button title="✕" kind="ghost" onPress={close} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
          </Row>
          <T v="caption" muted>{day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</T>

          <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center', marginTop: space.xl }}>
            <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: toneColor, alignItems: 'center', justifyContent: 'center', backgroundColor: toneColor + '14' }}>
              <Text style={{ fontFamily: 'Sora_800ExtraBold', fontSize: 72, color: toneColor, lineHeight: 82 }}>{g.grade}</Text>
            </View>
            <Text style={{ fontSize: 34, marginTop: -18 }}>{g.emoji}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)}>
            <T v="body" center style={{ marginTop: space.lg, fontSize: 16, lineHeight: 24 }}>
              {diff >= 0 ? 'Congratulations 🎉 ' : 'Congratulations… I guess 🙃 '}
              Tumhara daily income budget <T v="bodyStrong">{inr(budget)}</T> tha, aur tumne{' '}
              <T v="bodyStrong" color={diff < 0 ? t.danger : t.accent}>{inr(spent)}</T> kharch kiye.
            </T>
            <T v="title" center style={{ marginTop: space.md, fontSize: 17, lineHeight: 24 }}>“{g.line}”</T>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)}>
            <Row gap={10} style={{ marginTop: space.xl }}>
              <Card style={{ flex: 1, alignItems: 'center' }}>
                <T v="numLg" color={diff < 0 ? t.danger : t.accent}>{diff < 0 ? '−' : '+'}{inr(diff)}</T>
                <T v="caption" muted>{diff < 0 ? 'Budget se zyada' : 'Bacha'}</T>
              </Card>
              <Card style={{ flex: 1, alignItems: 'center' }}>
                <T v="numLg">{list.length}</T>
                <T v="caption" muted>Transactions</T>
              </Card>
            </Row>
          </Animated.View>

          {cats.length ? (
            <Animated.View entering={FadeInDown.delay(400)}>
              <Card style={{ marginTop: space.md, gap: 10 }}>
                <T v="title">Paisa kidhar gaya?</T>
                {cats.map(([k, v]) => (
                  <View key={k}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <T v="caption">{cat(k).emoji} {cat(k).name}</T>
                      <T v="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>{inr(v)}</T>
                    </Row>
                    <View style={{ height: 8, backgroundColor: t.bgElevated, borderRadius: radius.pill, overflow: 'hidden' }}>
                      <View style={{ width: `${(v / cats[0][1]) * 100}%`, height: '100%', backgroundColor: cat(k).color, borderRadius: radius.pill }} />
                    </View>
                  </View>
                ))}
                {biggest ? <T v="caption" muted style={{ marginTop: 4 }}>Sabse bada kharcha: {biggest.merchant} ({inr(biggest.amount)})</T> : null}
              </Card>
            </Animated.View>
          ) : null}

          <Row gap={10} style={{ marginTop: space.xl }}>
            <Button title="Theek hai" kind="ghost" onPress={close} style={{ flex: 1 }} />
            <Button title="Share karo" icon="📤" onPress={share} style={{ flex: 1.3 }} />
          </Row>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
