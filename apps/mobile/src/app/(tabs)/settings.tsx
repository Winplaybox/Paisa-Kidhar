import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/Toast';
import { Button, Card, Divider, Input, Row, Segmented, T, Tap, ToggleRow } from '@/components/ui';
import { fetchAllForExport, useDeleteAllData, useDeleteDemo, useProfile, useSaveProfile } from '@/data/queries';
import { baseDaily, type Profile } from '@/lib/budget';
import { cat } from '@/lib/categories';
import { env } from '@/lib/env';
import { inr } from '@/lib/format';
import { cancelAllPlanned, ensureNotificationPermission } from '@/lib/notifications';
import { useAds } from '@/providers/ads';
import { useAuth } from '@/providers/auth';
import { font, radius, space, useTheme } from '@/theme/tokens';

const HOURS = [19, 20, 21, 22, 23];
const MORNING = [6, 7, 8, 9, 10];
const hLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

export default function Settings() {
  const t = useTheme();
  const toast = useToast();
  const { session, signOut } = useAuth();
  const ads = useAds();
  const { data: p } = useProfile();
  const save = useSaveProfile();
  const delDemo = useDeleteDemo();
  const wipe = useDeleteAllData();

  if (!p) return null;
  return <SettingsBody key={`${p.monthly_income}|${p.fixed_costs}|${p.budget_mode}|${p.display_name}`} p={p} t={t} toast={toast} session={session} signOut={signOut} ads={ads} save={save} delDemo={delDemo} wipe={wipe} />;
}

type BodyProps = {
  p: Profile; t: ReturnType<typeof useTheme>; toast: (m: string) => void; session: ReturnType<typeof useAuth>['session'];
  signOut: () => Promise<void>; ads: ReturnType<typeof useAds>; save: ReturnType<typeof useSaveProfile>;
  delDemo: ReturnType<typeof useDeleteDemo>; wipe: ReturnType<typeof useDeleteAllData>;
};

function SettingsBody({ p, t, toast, session, signOut, ads, save, delDemo, wipe }: BodyProps) {
  const [name, setName] = useState(p.display_name ?? '');
  const [income, setIncome] = useState(String(p.monthly_income));
  const [fixed, setFixed] = useState(String(p.fixed_costs));
  const [mode, setMode] = useState<'full' | 'after_fixed'>(p.budget_mode);

  const inc = Number(income.replace(/[^\d.]/g, '')) || 0;
  const fx = Number(fixed.replace(/[^\d.]/g, '')) || 0;
  const preview = baseDaily({ monthly_income: inc, fixed_costs: fx, budget_mode: mode }, new Date());
  const dirty = inc !== p.monthly_income || fx !== p.fixed_costs || mode !== p.budget_mode || (name.trim() || null) !== (p.display_name || null);

  const patch = (x: Parameters<typeof save.mutate>[0], msg = 'Saved ✓') =>
    save.mutate(x, { onSuccess: () => toast(msg), onError: (e) => toast(e.message) });

  const saveBudget = () => {
    if (!(inc > 0)) return toast('Income daalo');
    patch({ display_name: name.trim().slice(0, 40) || null, monthly_income: inc, fixed_costs: fx, budget_mode: mode });
  };

  const exportCsv = async () => {
    try {
      const all = await fetchAllForExport();
      if (!all.length) return toast('Export karne ko kuch nahi');
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['Date,Time,Merchant,Category,Amount,Note,Source',
        ...all.map((x) => { const d = new Date(x.occurred_at); return [d.toLocaleDateString('en-CA'), d.toTimeString().slice(0, 5), x.merchant, cat(x.category).name, x.amount, x.note, x.source].map(esc).join(','); })].join('\n');
      await Share.share({ message: csv, title: 'Paisa Kidhar export' });
    } catch (e) { toast((e as Error).message); }
  };

  const confirmWipe = () => Alert.alert(
    'Saara data delete karein?',
    'Tumhare saare kharche aur settings hamesha ke liye delete ho jayenge. Ye undo nahi hoga.',
    [{ text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => wipe.mutate(undefined, {
        onSuccess: async () => { await cancelAllPlanned(); toast('Data delete ho gaya'); },
        onError: (e) => toast(e.message) }) }],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <T v="h1" style={{ marginBottom: space.lg }}>Settings</T>

        <Card>
          <T v="title" style={{ marginBottom: space.md }}>💰 Budget setup</T>
          <Input label="Naam" value={name} onChangeText={setName} maxLength={40} />
          <Input label="Monthly income (₹)" value={income} onChangeText={setIncome} keyboardType="number-pad" maxLength={12} />
          <Input label="Fixed kharche — rent, EMI, SIP (₹/month)" value={fixed} onChangeText={setFixed} keyboardType="number-pad" maxLength={12} />
          <Segmented value={mode} onChange={setMode} options={[{ key: 'full', label: 'Poori salary ÷ din' }, { key: 'after_fixed', label: 'Fixed ke baad' }]} />
          <View style={{ alignItems: 'center', marginVertical: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: t.cardAlt }}>
            <T v="caption" muted>Daily income budget</T>
            <T v="hero" color={t.accent}>{inr(preview)}</T>
          </View>
          <Button title="Save" onPress={saveBudget} disabled={!dirty} loading={save.isPending} />
          <Divider />
          <ToggleRow title="Carry forward" subtitle="Kal ka bacha (ya zyada) aaj ke budget mein judega" value={p.rollover} onChange={(v) => patch({ rollover: v })} />
        </Card>

        <Card style={{ marginTop: space.md }}>
          <T v="title" style={{ marginBottom: 4 }}>🔔 Notifications</T>
          <ToggleRow title="Morning budget + night report card" value={p.notifications}
            onChange={async (v) => {
              if (v && !(await ensureNotificationPermission(true))) {
                toast('Notification permission off hai — phone settings mein allow karo');
                Linking.openSettings().catch(() => undefined);
                return;
              }
              if (!v) await cancelAllPlanned();
              patch({ notifications: v });
            }} />
          {p.notifications ? (
            <>
              <T v="caption" muted style={{ marginBottom: 6 }}>Subah ka reminder</T>
              <HourPicker hours={MORNING} value={p.morning_hour} onChange={(h) => patch({ morning_hour: h }, `Subah ${hLabel(h)} ✓`)} />
              <T v="caption" muted style={{ marginTop: space.md, marginBottom: 6 }}>Raat ka report card</T>
              <HourPicker hours={HOURS} value={p.report_hour} onChange={(h) => patch({ report_hour: h }, `Report ${hLabel(h)} ✓`)} />
            </>
          ) : null}
        </Card>

        <Card style={{ marginTop: space.md, gap: space.sm }}>
          <T v="title" style={{ marginBottom: 4 }}>🗂️ Data</T>
          <Button kind="soft" title="Export (CSV share)" icon="📤" onPress={exportCsv} />
          <Button kind="soft" title="Demo data hatao" icon="🧹" loading={delDemo.isPending}
            onPress={() => delDemo.mutate(undefined, { onSuccess: (n) => toast(n ? `${n} demo entries hataye` : 'Koi demo data nahi'), onError: (e) => toast(e.message) })} />
          <T v="caption" muted>🔒 Tumhara data encrypted connection pe tumhare account mein save hota hai. Koi aur — hum bhi nahi — tumhari entries bech ya share nahi karte.</T>
        </Card>

        <Card style={{ marginTop: space.md }}>
          <T v="title" style={{ marginBottom: space.sm }}>👤 Account</T>
          <T v="caption" muted>{session?.user.email}</T>
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {ads.privacyOptionsRequired ? <Button kind="ghost" title="Ad privacy options" onPress={ads.showPrivacyOptions} /> : null}
            <Button kind="ghost" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(env.privacyUrl)} />
            <Button kind="ghost" title="Sign out" onPress={signOut} />
            <Button kind="danger" title="Saara data delete karo" onPress={confirmWipe} loading={wipe.isPending} />
          </View>
        </Card>

        <T v="caption" muted center style={{ marginTop: space.xl }}>
          Paisa Kidhar? v{Constants.expoConfig?.version ?? '1.0.0'} · Made with ❤️ by WinPlayBox
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

function HourPicker({ hours, value, onChange }: { hours: number[]; value: number; onChange: (h: number) => void }) {
  const t = useTheme();
  return (
    <Row gap={6}>
      {hours.map((h) => (
        <Tap key={h} onPress={() => onChange(h)}
          style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: h === value ? t.cardAlt : t.bgElevated, borderWidth: 1, borderColor: h === value ? t.accent : t.line }}>
          <T v="caption" style={{ fontFamily: h === value ? font.bodySemi : font.bodyMedium, fontSize: 12 }}>{hLabel(h)}</T>
        </Tap>
      ))}
    </Row>
  );
}
