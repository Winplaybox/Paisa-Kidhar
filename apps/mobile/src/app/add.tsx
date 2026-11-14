import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { useToast } from '@/components/Toast';
import { Button, Input, Row, T, Tap } from '@/components/ui';
import { useAddTxns, useDeleteTxn, useMonthTxns, useProfile, useSearchTxns, useUpdateTxn } from '@/data/queries';
import { addDays, dayBudget, dayKey, monthKey, spentOn, type Txn } from '@/lib/budget';
import type { CategoryKey } from '@/lib/categories';
import { inr } from '@/lib/format';
import { categorize } from '@/lib/parser';
import { font, radius, space, useTheme } from '@/theme/tokens';

type Params = { id?: string; amount?: string; merchant?: string; category?: string };

const WHEN = [
  { key: 0, label: 'Aaj' },
  { key: -1, label: 'Kal' },
  { key: -2, label: 'Parso' },
] as const;

export default function AddExpense() {
  const t = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<Params>();
  const now = new Date();
  const month = useMonthTxns(monthKey(now));
  const recent = useSearchTxns(''); // for edit lookup outside current month
  const existing: Txn | undefined = params.id
    ? [...(month.data ?? []), ...(recent.data ?? [])].find((x) => x.id === params.id)
    : undefined;
  const editing = !!params.id;

  const [amount, setAmount] = useState(existing ? String(existing.amount) : params.amount ?? '');
  const [merchant, setMerchant] = useState(existing?.merchant ?? params.merchant ?? '');
  const [category, setCategory] = useState<CategoryKey>((existing?.category ?? params.category ?? 'other') as CategoryKey);
  const [note, setNote] = useState(existing?.note ?? '');
  const [dayOffset, setDayOffset] = useState<number>(() => {
    if (!existing) return 0;
    const diff = Math.round((+new Date(dayKey(now)) - +new Date(dayKey(new Date(existing.occurred_at)))) / 86_400_000);
    return diff >= 0 && diff <= 2 ? -diff : 99;
  });
  const [touchedCat, setTouchedCat] = useState(!!existing || !!params.category);

  const add = useAddTxns();
  const upd = useUpdateTxn();
  const del = useDeleteTxn();
  const profile = useProfile();

  const amt = Number(amount.replace(/[^\d.]/g, ''));
  const valid = amt > 0 && amt < 1e9;

  const occurredAt = (): string => {
    if (dayOffset === 99 && existing) return existing.occurred_at;
    if (existing && dayOffset === -Math.round((+new Date(dayKey(now)) - +new Date(dayKey(new Date(existing.occurred_at)))) / 86_400_000))
      return existing.occurred_at;
    if (dayOffset === 0) return now.toISOString();
    const d = addDays(now, dayOffset); d.setHours(13, 0, 0, 0);
    return d.toISOString();
  };

  const save = async () => {
    if (!valid) { toast('Amount daalo'); return; }
    const row = {
      amount: Math.round(amt * 100) / 100,
      merchant: (merchant.trim() || 'Kharcha').slice(0, 60),
      category,
      note: note.trim().slice(0, 140) || null,
      occurred_at: occurredAt(),
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (editing && existing) {
      upd.mutate({ id: existing.id, patch: row }, { onError: (e) => toast(e.message) });
      router.back();
      toast('Update ho gaya ✓');
      return;
    }
    add.mutate([{ ...row, source: 'manual' }], { onError: (e) => toast(`Save fail: ${e.message}`) });
    router.back();
    if (dayOffset === 0 && profile.data) {
      const txns = [{ ...row, id: 'x', source: 'manual' } as Txn, ...(month.data ?? [])];
      const b = dayBudget(profile.data, txns, now).total;
      const s = spentOn(txns, now);
      toast(`${row.merchant}: −${inr(row.amount)} · ${s > b ? `budget se ${inr(s - b)} upar 😬` : `${inr(b - s)} bacha`}`);
    } else toast('Saved ✓');
  };

  const remove = () => {
    if (!existing) return;
    const go = () => {
      del.mutate(existing.id, { onError: (e) => toast(e.message) });
      router.back();
      toast('Delete ho gaya');
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete karein?', `${existing.merchant} · ${inr(existing.amount)}`, [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.card }} contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl }} keyboardShouldPersistTaps="handled">
      <T v="h2">{editing ? 'Edit kharcha' : 'Naya kharcha'}</T>
      <T v="caption" muted style={{ marginBottom: space.lg }}>{editing ? 'Galti sudhaar lo' : 'Kitna gaya? Sach bolna 😏'}</T>

      <Input value={amount} onChangeText={setAmount} placeholder="₹0" keyboardType="decimal-pad" big autoFocus={!editing && !params.amount} maxLength={10} accessibilityLabel="Amount" />
      <Input label="Kahan / kisko" value={merchant} placeholder="Blinkit, Starbucks, Rahul…" maxLength={60}
        onChangeText={(v) => {
          setMerchant(v);
          if (!touchedCat) { const c = categorize(v); if (c !== 'other') setCategory(c); }
        }} />

      <T v="caption" muted style={{ marginBottom: 6 }}>Category</T>
      <CategoryPicker value={category} onChange={(k) => { setTouchedCat(true); setCategory(k); }} />

      <T v="caption" muted style={{ marginTop: space.lg, marginBottom: 6 }}>Kab</T>
      <Row gap={6}>
        {WHEN.map((w) => (
          <Tap key={w.key} onPress={() => setDayOffset(w.key)}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: dayOffset === w.key ? t.cardAlt : t.bgElevated, borderWidth: 1, borderColor: dayOffset === w.key ? t.accent : t.line }}>
            <T v="caption" style={{ fontFamily: font.bodySemi }}>{w.label}</T>
          </Tap>
        ))}
        {dayOffset === 99 && existing ? (
          <View style={{ flex: 1.3, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: t.cardAlt, borderWidth: 1, borderColor: t.accent }}>
            <T v="caption" style={{ fontFamily: font.bodySemi }}>{new Date(existing.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</T>
          </View>
        ) : null}
      </Row>

      <View style={{ marginTop: space.lg }}>
        <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. office party" maxLength={140} />
      </View>

      <Button title={editing ? 'Update ✓' : `Minus karo ${valid ? inr(amt) : ''} ✓`} onPress={save} disabled={!valid} />
      {editing ? <Button title="Delete" kind="danger" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </ScrollView>
  );
}
