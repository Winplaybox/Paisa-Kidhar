import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/Toast';
import { Button, Card, Input, Segmented, T } from '@/components/ui';
import { useSaveProfile } from '@/data/queries';
import { daysInMonth } from '@/lib/budget';
import { inr } from '@/lib/format';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useAuth } from '@/providers/auth';
import { space, useTheme } from '@/theme/tokens';

export default function Onboarding() {
  const t = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const save = useSaveProfile();
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const [name, setName] = useState((meta?.full_name || meta?.name || '').split(' ')[0] ?? '');
  const [income, setIncome] = useState('');
  const [fixed, setFixed] = useState('');
  const [mode, setMode] = useState<'full' | 'after_fixed'>('full');

  const inc = Number(income.replace(/[^\d.]/g, '')) || 0;
  const fx = Number(fixed.replace(/[^\d.]/g, '')) || 0;
  const days = daysInMonth(new Date());
  const spendable = mode === 'after_fixed' ? Math.max(0, inc - fx) : inc;
  const daily = spendable / days;

  const submit = async () => {
    if (!(inc > 0)) return toast('Monthly income daalo');
    if (inc > 1e9) return toast('Itni salary? 😳 Number check karo');
    try {
      await save.mutateAsync({
        display_name: name.trim().slice(0, 40) || null,
        monthly_income: inc,
        fixed_costs: fx,
        budget_mode: mode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      });
      await ensureNotificationPermission(true).catch(() => false);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(450)}>
            <Text style={{ fontSize: 44 }}>👋</Text>
            <T v="h1" style={{ marginTop: space.md }}>Chalo setup karte hain</T>
            <T muted style={{ marginTop: 6, marginBottom: space.xl }}>30 second. Bas income batao, baaki hum sambhal lenge.</T>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(450)}>
            <Input label="Tumhara naam" value={name} onChangeText={setName} placeholder="Sagar" maxLength={40} autoCapitalize="words" />
            <Input label="Monthly income (in-hand ₹)" value={income} onChangeText={setIncome} placeholder="1,00,000" keyboardType="number-pad" big maxLength={12} />
            <Input label="Fixed kharche — rent, EMI, SIP (optional)" value={fixed} onChangeText={setFixed} placeholder="0" keyboardType="number-pad" maxLength={12} />
            <T v="caption" muted style={{ marginBottom: 6 }}>Daily budget kaise nikale?</T>
            <Segmented value={mode} onChange={setMode} options={[{ key: 'full', label: 'Poori salary ÷ din' }, { key: 'after_fixed', label: 'Fixed ke baad' }]} />
          </Animated.View>

          <Animated.View layout={LinearTransition} style={{ marginTop: space.xl }}>
            <Card style={{ alignItems: 'center', backgroundColor: t.cardAlt }}>
              <T v="label" muted>Tumhara daily income budget</T>
              <Animated.View key={Math.round(daily)} entering={FadeIn.duration(250)}>
                <T v="hero" color={t.accent} style={{ marginTop: 6 }}>{inr(daily)}</T>
              </Animated.View>
              <T v="caption" muted>{inc ? `${inr(spendable)} ÷ ${days} din` : 'Income daalte hi dikh jayega'}</T>
            </Card>
          </Animated.View>

          <View style={{ marginTop: space.xl }}>
            <Button title="Shuru karo 🚀" onPress={submit} loading={save.isPending} disabled={!inc} />
            <T v="caption" muted center style={{ marginTop: space.md }}>Ye sab baad mein Settings se badal sakte ho.</T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
