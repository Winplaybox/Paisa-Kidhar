/* Guest-facing registry. No login. Gift flow: goal → amount → note → pay by UPI (direct to couple) → "I've paid". */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { Head } from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, BackHandler, Linking, Platform, ScrollView, Switch, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShagunCardUpsell } from '@/components/ShagunCardUpsell';
import { Anim, ConfettiBurst } from '@/design-system/Anim';
import { BackButton } from '@/design-system/BackButton';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, Field, LoadingList, ProgressBar, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, ApiError, type Pledge, type PublicRegistry } from '@/lib/api';
import { categoryIcon, categoryLabel, useCategories } from '@/lib/categories';
import { config } from '@/lib/config';
import { formatINR, formatINRCompact, parseRupeesToPaise } from '@/lib/money';
import { errorMessage } from '@/lib/queries';

type Step = 'browse' | 'amount' | 'pay' | 'done';
type Goal = PublicRegistry['goals'][number];

const isMobileWeb = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);

export default function PublicRegistryScreen() {
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const q = useQuery({ queryKey: ['public', slug], queryFn: () => api.publicRegistry(slug), retry: 1 });
  const t = useTheme(q.data?.theme);
  const cats = useCategories();
  const [step, setStep] = useState<Step>('browse');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [amountText, setAmountText] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [anon, setAnon] = useState(false);
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [launched, setLaunched] = useState(false); // user opened a UPI app
  const [confirming, setConfirming] = useState(false); // "I've paid" double-check
  const [status, setStatus] = useState<string>('pledged');
  const idem = useMemo(() => Crypto.randomUUID(), [goal?.id, amountText]); // new attempt → new key; retries reuse it

  useEffect(() => { if (q.data) api.track('public_view', { premium: q.data.premium }); }, [q.data]);

  const amount = parseRupeesToPaise(amountText);
  const amountErr = amountText && (amount === null || amount < 100 || amount > 50000000) ? 'Enter an amount between ₹1 and ₹5,00,000' : null;

  const startPledge = async () => {
    if (!goal || !amount || amountErr) { setErr('Choose an amount.'); return; }
    setErr(null); setBusy(true);
    try {
      const p = await api.createPledge(slug, { goal_id: goal.id, amount_paise: amount, guest_name: name.trim() || undefined, guest_message: message.trim() || undefined, is_anonymous: anon }, idem);
      setPledge(p); setStep('pay');
      api.track('pledge_started', { amount_bucket: amount >= 500000 ? 'high' : 'std' });
    } catch (e) { setErr(e instanceof ApiError && e.status === 429 ? 'Too many attempts — please wait a few minutes.' : errorMessage(e)); }
    finally { setBusy(false); }
  };

  const openUpi = async () => {
    if (!pledge) return;
    try { await Linking.openURL(pledge.upi_link); setLaunched(true); }
    catch { setErr('No UPI app found. Copy the UPI ID below and pay from any UPI app.'); }
  };

  const markPaid = async () => {
    if (!pledge) return;
    setBusy(true); setErr(null);
    try { await api.markPaid(pledge.reference, pledge.token); api.track('pledge_marked_paid'); setStatus('guest_marked_paid'); setConfirming(false); setStep('done'); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  const reset = () => { setLaunched(false); setConfirming(false); setStatus('pledged'); setStep('browse'); setGoal(null); setAmountText(''); setPledge(null); setErr(null); q.refetch(); };

  // Coming back from the UPI app: bring the confirm question forward (we cannot see the bank result ourselves).
  useEffect(() => {
    if (!launched || step !== 'pay') return;
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setConfirming(true); });
    return () => sub.remove();
  }, [launched, step]);

  // After "I've paid": watch for the couple's confirmation.
  useEffect(() => {
    if (step !== 'done' || !pledge || status === 'confirmed' || status === 'rejected') return;
    const id = setInterval(async () => {
      try { const s = await api.pledgeStatus(pledge.reference, pledge.token); setStatus(s.status); } catch { /* keep trying */ }
    }, 8000);
    return () => clearInterval(id);
  }, [step, pledge, status]);

  // Android hardware back walks the gift steps backwards before leaving the page.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'amount') { setStep('browse'); return true; }
      if (step === 'pay' || step === 'done') { reset(); return true; }
      return false;
    });
    return () => sub.remove();
  });

  if (q.isLoading) return <Wrap t={t}><LoadingList rows={3} /></Wrap>;
  if (q.error) {
    return <Wrap t={t}>{q.error instanceof ApiError && q.error.status === 404
      ? <EmptyState icon="search-outline" title="Registry not found" body={preview ? 'Publish your registry to preview it here.' : 'This link may be wrong, or the couple has paused their registry.'}
          action={preview ? <Button title="Back" kind="secondary" full={false} onPress={() => router.back()} /> : undefined} />
      : <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />}</Wrap>;
  }
  const r = q.data!;
  const couple = `${r.partner_one} & ${r.partner_two}`;
  const date = r.wedding_date ? new Date(r.wedding_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <Wrap t={t}>
      <Head>
        <title>{`${couple} — Wedding dreams | Paisa Kidhar`}</title>
        <meta name="description" content={`Help ${couple} fund their dreams instead of another gift.`} />
        <meta property="og:title" content={`${couple} are getting married 💍`} />
        <meta property="og:description" content="Skip the duplicate mixer — contribute to a dream they actually want." />
        <meta name="robots" content="noindex" />
      </Head>

      {step === 'browse' ? (
        <>
          <View style={{ alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.xl }}>
            <Text variant="caption" color={t.colors.accent} style={{ letterSpacing: 2 }}>WE'RE GETTING MARRIED</Text>
            <Text variant="display" style={{ textAlign: 'center' }}>{couple}</Text>
            {date || r.city ? <Text muted>{[date, r.city].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          {r.story ? <Card tone="accent"><Text>{r.story}</Text></Card> : null}
          <Text variant="heading">Choose a dream to support</Text>
          {r.goals.length === 0 ? <EmptyState icon="gift-outline" title="No goals yet" body="Check back soon!" /> : r.goals.map((g) => {
            const done = g.status === 'completed';
            return (
              <Card key={g.id} onPress={done ? undefined : () => { setGoal(g); setStep('amount'); }} accessibilityLabel={`Contribute to ${g.title}`}>
                <Row>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={categoryIcon(cats, g.category)} size={22} color={t.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{g.title}</Text>
                    <Text variant="caption" muted>{categoryLabel(cats, g.category, g.custom_category)} · {done ? 'Fully funded — thank you! 🎉' : `Goal ${formatINRCompact(g.target_paise)}`}</Text>
                  </View>
                  {!done ? <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} /> : null}
                </Row>
                {g.description ? <Text muted variant="caption">{g.description}</Text> : null}
                {r.show_progress && g.raised_paise !== undefined ? (
                  <>
                    <ProgressBar value={g.raised_paise / g.target_paise} label={`${g.title} progress`} />
                    <Text variant="caption" muted>{formatINR(g.raised_paise)} raised · {g.contributions_count} gift{g.contributions_count === 1 ? '' : 's'}</Text>
                  </>
                ) : null}
              </Card>
            );
          })}
          {r.wishes.length ? (
            <>
              <Text variant="heading">Blessings</Text>
              {r.wishes.map((w, i) => <Card key={i} tone={w.card ? 'accent' : 'alt'}><Text>“{w.message}”</Text><Text variant="caption" muted>— {w.name ?? 'A well-wisher'}{w.card ? '  ✦ Shagun Card' : ''}</Text></Card>)}
            </>
          ) : null}
        </>
      ) : null}

      {step === 'amount' && goal ? (
        <>
          <Button title="Back to goals" kind="ghost" icon="arrow-back" full={false} onPress={() => setStep('browse')} style={{ paddingHorizontal: 0 }} />
          <Text variant="title">{goal.title}</Text>
          <Text muted>Your gift goes straight to {couple}'s UPI.</Text>
          {err ? <Banner tone="negative" title={err} /> : null}
          <Card style={{ gap: t.space.lg }}>
            <Text variant="label">How much would you like to give?</Text>
            <Row wrap gap={t.space.sm}>
              {r.suggested_amounts_paise.map((p) => (
                <Chip key={p} label={formatINR(p)} selected={amount === p} onPress={() => setAmountText(String(p / 100))} />
              ))}
            </Row>
            <Field label="Or enter an amount (₹)" value={amountText} onChangeText={(v) => setAmountText(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" inputMode="numeric" maxLength={7} placeholder="1100" error={amountErr} />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Sunita Mausi" maxLength={60} autoComplete="name" />
            <Field label="A blessing for the couple (optional)" value={message} onChangeText={setMessage} multiline maxLength={280} placeholder="Wishing you a lifetime of adventures!" />
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}><Text variant="label">Give anonymously</Text><Text variant="caption" muted>Your name is hidden from other guests.</Text></View>
              <Switch thumbColor="#FFFFFF" value={anon} onValueChange={setAnon} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel="Give anonymously" />
            </Row>
          </Card>
          <Button title={amount && !amountErr ? `Continue · ${formatINR(amount)}` : 'Continue'} kind="accent" loading={busy} disabled={!amount || !!amountErr} onPress={startPledge} />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>No account needed. Paisa Kidhar never holds or touches your money.</Text>
        </>
      ) : null}

      {step === 'pay' && pledge ? (
        <>
          <Text variant="title">Pay {formatINR(pledge.amount_paise)}</Text>
          <Text muted>to {pledge.payee_name} · for “{pledge.goal_title}”</Text>
          {err ? <Banner tone="warning" title={err} /> : null}
          {Platform.OS !== 'web' || isMobileWeb() ? (
            <Button title="Pay with any UPI app" kind="accent" icon="phone-portrait-outline" onPress={openUpi} />
          ) : null}
          <Card style={{ alignItems: 'center', gap: t.space.md }}>
            {Platform.OS === 'web' && !isMobileWeb() ? <Text variant="label">Scan with GPay, PhonePe, Paytm or any UPI app</Text> : <Text variant="label">Or scan / pay manually</Text>}
            <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: t.radius.md }}>
              <QRCode value={pledge.upi_link} size={200} color="#0A0A0A" backgroundColor="#FFFFFF" />
            </View>
            <Row gap={t.space.sm}>
              <Text variant="label" selectable>{pledge.upi_vpa}</Text>
              <Button title={copied ? 'Copied' : 'Copy UPI ID'} kind="secondary" full={false} icon="copy-outline"
                onPress={async () => { await Clipboard.setStringAsync(pledge.upi_vpa); setCopied(true); }} />
            </Row>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>Add this reference in the payment note: <Text variant="label" selectable>{pledge.reference}</Text></Text>
          </Card>
          <PayProgress t={t} active={confirming ? 2 : 1} />
          {confirming ? (
            <Card tone="alt" style={{ gap: t.space.md }}>
              <Text variant="heading">Did {formatINR(pledge.amount_paise)} leave your account?</Text>
              <Text muted variant="caption">Tap “Yes” only after your UPI app shows a Success screen. If it failed or you backed out, choose “Not yet”.</Text>
              <Button title="Yes, payment successful" kind="primary" icon="checkmark-circle-outline" loading={busy} onPress={markPaid} />
              <Button title="Not yet" kind="secondary" onPress={() => setConfirming(false)} />
            </Card>
          ) : (
            <Button title="I've paid" kind="primary" icon="checkmark-circle-outline" disabled={busy} onPress={() => setConfirming(true)} />
          )}
          <Button title="Cancel" kind="ghost" onPress={reset} />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>The couple confirms gifts from their UPI app. Your gift shows on their goal once confirmed.</Text>
        </>
      ) : null}

      <ConfettiBurst show={step === 'done' || status === 'confirmed'} />
      {step === 'done' && pledge ? (
        <View style={{ alignItems: 'center', gap: t.space.lg, paddingVertical: t.space.xxl }}>
          <Anim name="heart" size={160} />
          <Text variant="title" style={{ textAlign: 'center' }}>Thank you!</Text>
          <Text muted style={{ textAlign: 'center' }}>{couple} will see your {formatINR(pledge.amount_paise)} gift towards “{pledge.goal_title}” once it reaches their UPI.</Text>
          <PayProgress t={t} active={status === 'confirmed' ? 4 : 3} />
          <Card tone="alt"><Text variant="caption" muted>Reference</Text><Text variant="heading" selectable>{pledge.reference}</Text></Card>
          <ShagunCardUpsell pledge={pledge} partnerOne={r.partner_one} partnerTwo={r.partner_two} guestName={anon ? undefined : name.trim() || undefined}
            message={message.trim() || undefined} weddingDate={r.wedding_date} />
          <Button title="Back to the registry" kind="secondary" full={false} onPress={reset} />
        </View>
      ) : null}

      <Text variant="caption" muted style={{ textAlign: 'center', marginTop: t.space.xl }}>
        Made with Paisa Kidhar · {config.webUrl.replace('https://', '')}
      </Text>
    </Wrap>
  );
}

function Wrap({ t, children }: { t: ReturnType<typeof useTheme>; children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {router.canGoBack() ? <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs }}><BackButton /></View> : null}
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxxl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const STEPS = ['Gift created', 'Pay in your UPI app', 'You confirm', 'Couple confirms'];
function PayProgress({ t, active }: { t: ReturnType<typeof useTheme>; active: number }) {
  // active = index of the step in progress; steps before it are done; active>=4 means everything is done.
  return (
    <Card style={{ gap: t.space.sm }} accessibilityLabel={`Progress: ${STEPS[Math.min(active, 3)]}`}>
      {STEPS.map((label, i) => {
        const done = i < active || (i === 0);
        const cur = i === active;
        return (
          <Row key={label} gap={t.space.sm}>
            <Ionicons name={done ? 'checkmark-circle' : cur ? 'time-outline' : 'ellipse-outline'} size={20}
              color={done ? t.colors.accent : cur ? t.colors.text : t.colors.textMuted} />
            <Text variant={cur ? 'label' : 'caption'} muted={!done && !cur}>{label}{cur && i === 3 ? ' — usually within a day' : ''}</Text>
          </Row>
        );
      })}
    </Card>
  );
}
