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
import { useRemoteConfig } from '@/lib/remoteConfig';
import { Anim, ConfettiBurst } from '@/design-system/Anim';
import { FluidBackground } from '@/design-system/FluidBackground';
import { BackButton } from '@/design-system/BackButton';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, Field, LoadingList, ProgressBar, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { dateLocale, useI18n } from '@/i18n';
import { api, ApiError, type Pledge, type PublicRegistry } from '@/lib/api';
import { categoryIcon, categoryLabel, useCategories } from '@/lib/categories';
import { config } from '@/lib/config';
import { formatINR, formatINRCompact, parseRupeesToPaise } from '@/lib/money';
import { errorMessage } from '@/lib/queries';
import { payWithUpi } from '@/lib/upi';

type Step = 'browse' | 'amount' | 'pay' | 'done';
type Goal = PublicRegistry['goals'][number];

const isMobileWeb = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);

export default function PublicRegistryScreen() {
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const { t: tx } = useI18n();
  const flags = useRemoteConfig().flags;
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
  const amountErr = amountText && (amount === null || amount < 100 || amount > 50000000) ? tx('gp_amount_range') : null;

  const startPledge = async () => {
    if (!goal || !amount || amountErr) { setErr(tx('gp_choose_amount')); return; }
    setErr(null); setBusy(true);
    try {
      const p = await api.createPledge(slug, { goal_id: goal.id, amount_paise: amount, guest_name: name.trim() || undefined, guest_message: message.trim() || undefined, is_anonymous: anon }, idem);
      setPledge(p); setStep('pay');
      api.track('pledge_started', { amount_bucket: amount >= 500000 ? 'high' : 'std' });
    } catch (e) { setErr(e instanceof ApiError && e.status === 429 ? tx('gp_too_many') : errorMessage(e)); }
    finally { setBusy(false); }
  };

  const openUpi = async () => {
    if (!pledge) return;
    setErr(null);
    const outcome = await payWithUpi(pledge.upi_link);
    setLaunched(true);
    if (outcome === 'success') { await markPaid(); return; } // UPI app reported success → no button needed
    if (outcome === 'no_app') { setErr(tx('gp_no_upi')); return; }
    if (outcome === 'failure') { setErr(tx('gp_pay_incomplete')); return; }
    setConfirming(true); // pending / unknown: ask the guest once
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
    if (!launched || step !== 'pay' || Platform.OS === 'android') return;
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
      ? <EmptyState icon="search-outline" title={tx('gp_nf_title')} body={preview ? tx('gp_nf_preview') : tx('gp_nf_body')}
          action={preview ? <Button title={tx('cd_back')} kind="secondary" full={false} onPress={() => router.back()} /> : undefined} />
      : <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />}</Wrap>;
  }
  const r = q.data!;
  const couple = `${r.partner_one} & ${r.partner_two}`;
  const date = r.wedding_date ? new Date(r.wedding_date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null;

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
            <Text variant="caption" color={t.colors.accent} style={{ letterSpacing: 2 }}>{tx('gp_marrying')}</Text>
            <Text variant="display" style={{ textAlign: 'center' }}>{couple}</Text>
            {date || r.city ? <Text muted>{[date, r.city].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          {r.story ? <Card tone="accent"><Text>{r.story}</Text></Card> : null}
          <Text variant="heading">{tx('gp_choose_dream')}</Text>
          {r.goals.length === 0 ? <EmptyState icon="gift-outline" title={tx('gp_nogoals_t')} body={tx('gp_nogoals_b')} /> : r.goals.map((g) => {
            const done = g.status === 'completed';
            return (
              <Card key={g.id} onPress={done ? undefined : () => { setGoal(g); setStep('amount'); }} accessibilityLabel={tx('gp_contribute', { title: g.title })}>
                <Row>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={categoryIcon(cats, g.category)} size={22} color={t.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{g.title}</Text>
                    <Text variant="caption" muted>{categoryLabel(cats, g.category, g.custom_category)} · {done ? tx('gp_funded') : tx('gp_goal', { amt: formatINRCompact(g.target_paise) })}</Text>
                  </View>
                  {!done ? <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} /> : null}
                </Row>
                {g.description ? <Text muted variant="caption">{g.description}</Text> : null}
                {r.show_progress && g.raised_paise !== undefined ? (
                  <>
                    <ProgressBar value={g.raised_paise / g.target_paise} label={`${g.title} progress`} />
                    <Text variant="caption" muted>{tx('gp_raised', { amt: formatINR(g.raised_paise), n: g.contributions_count ?? 0 })}</Text>
                  </>
                ) : null}
              </Card>
            );
          })}
          {r.wishes.length ? (
            <>
              <Text variant="heading">{tx('gp_blessings')}</Text>
              {r.wishes.map((w, i) => <Card key={i} tone={w.card ? 'accent' : 'alt'}><Text>“{w.message}”</Text><Text variant="caption" muted>— {w.name ?? tx('gp_wellwisher')}{w.card ? `  ${tx('gp_shagun_tag')}` : ''}</Text></Card>)}
            </>
          ) : null}
        </>
      ) : null}

      {step === 'amount' && goal ? (
        <>
          <Button title={tx('gp_back_goals')} kind="ghost" icon="arrow-back" full={false} onPress={() => setStep('browse')} style={{ paddingHorizontal: 0 }} />
          <Text variant="title">{goal.title}</Text>
          <Text muted>{tx('gp_goes_to', { couple })}</Text>
          {err ? <Banner tone="negative" title={err} /> : null}
          <Card style={{ gap: t.space.lg }}>
            <Text variant="label">{tx('gp_how_much')}</Text>
            <Row wrap gap={t.space.sm}>
              {r.suggested_amounts_paise.map((p) => (
                <Chip key={p} label={formatINR(p)} selected={amount === p} onPress={() => setAmountText(String(p / 100))} />
              ))}
            </Row>
            <Field label={tx('gp_or_enter')} value={amountText} onChangeText={(v) => setAmountText(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" inputMode="numeric" maxLength={7} placeholder="1100" error={amountErr} />
            <Field label={tx('gp_your_name')} value={name} onChangeText={setName} placeholder="Sunita Mausi" maxLength={60} autoComplete="name" />
            <Field label={tx('gp_blessing_opt')} value={message} onChangeText={setMessage} multiline maxLength={280} placeholder="Wishing you a lifetime of adventures!" />
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}><Text variant="label">{tx('gp_anon')}</Text><Text variant="caption" muted>{tx('gp_anon_hint')}</Text></View>
              <Switch thumbColor="#FFFFFF" value={anon} onValueChange={setAnon} trackColor={{ true: t.colors.accent, false: t.colors.border }} accessibilityLabel={tx('gp_anon')} />
            </Row>
          </Card>
          <Button title={amount && !amountErr ? tx('gp_continue_amt', { amt: formatINR(amount) }) : tx('gp_continue')} kind="accent" loading={busy} disabled={!amount || !!amountErr} onPress={startPledge} />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>{tx('gp_no_account')}</Text>
        </>
      ) : null}

      {step === 'pay' && pledge ? (
        <>
          <Text variant="title">{tx('gp_pay_amt', { amt: formatINR(pledge.amount_paise) })}</Text>
          <Text muted>{tx('gp_to_for', { payee: pledge.payee_name, goal: pledge.goal_title })}</Text>
          {err ? <Banner tone="warning" title={err} /> : null}
          {Platform.OS !== 'web' || isMobileWeb() ? (
            <Button title={tx('gp_pay_any')} kind="accent" icon="phone-portrait-outline" onPress={openUpi} />
          ) : null}
          <Card style={{ alignItems: 'center', gap: t.space.md }}>
            {Platform.OS === 'web' && !isMobileWeb() ? <Text variant="label">{tx('gp_scan')}</Text> : <Text variant="label">{tx('gp_scan_manual')}</Text>}
            <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: t.radius.md }}>
              <QRCode value={pledge.upi_link} size={200} color="#0A0A0A" backgroundColor="#FFFFFF" />
            </View>
            <Row gap={t.space.sm}>
              <Text variant="label" selectable>{pledge.upi_vpa}</Text>
              <Button title={copied ? tx('gp_copied') : tx('gp_copy_upi')} kind="secondary" full={false} icon="copy-outline"
                onPress={async () => { await Clipboard.setStringAsync(pledge.upi_vpa); setCopied(true); }} />
            </Row>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>{tx('gp_ref_note')}<Text variant="label" selectable>{pledge.reference}</Text></Text>
          </Card>
          <PayProgress t={t} active={confirming ? 2 : 1} />
          {confirming ? (
            <Card tone="alt" style={{ gap: t.space.md }}>
              <Text variant="heading">{tx('gp_did_leave', { amt: formatINR(pledge.amount_paise) })}</Text>
              <Text muted variant="caption">{tx('gp_did_leave_hint')}</Text>
              <Button title={tx('gp_yes_paid')} kind="primary" icon="checkmark-circle-outline" loading={busy} onPress={markPaid} />
              <Button title={tx('gp_not_yet')} kind="secondary" onPress={() => setConfirming(false)} />
            </Card>
          ) : (
            <Button title={tx('gp_ive_paid')} kind="primary" icon="checkmark-circle-outline" disabled={busy} onPress={() => setConfirming(true)} />
          )}
          <Button title={tx('gp_cancel')} kind="ghost" onPress={reset} />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>{tx('gp_couple_confirms')}</Text>
        </>
      ) : null}

      <ConfettiBurst show={step === 'done' || status === 'confirmed'} />
      {step === 'done' && pledge ? (
        <View style={{ alignItems: 'center', gap: t.space.lg, paddingVertical: t.space.xxl }}>
          <Anim name="heart" size={160} />
          <Text variant="title" style={{ textAlign: 'center' }}>{tx('gp_thanks')}</Text>
          <Text muted style={{ textAlign: 'center' }}>{tx('gp_thanks_body', { couple, amt: formatINR(pledge.amount_paise), goal: pledge.goal_title })}</Text>
          <PayProgress t={t} active={status === 'confirmed' ? 4 : 3} />
          <Card tone="alt"><Text variant="caption" muted>{tx('gp_reference')}</Text><Text variant="heading" selectable>{pledge.reference}</Text></Card>
          {flags.shagun_cards ? <ShagunCardUpsell pledge={pledge} partnerOne={r.partner_one} partnerTwo={r.partner_two} guestName={anon ? undefined : name.trim() || undefined}
            message={message.trim() || undefined} weddingDate={r.wedding_date} slug={r.slug} /> : null}
          <Button title={tx('gp_back_registry')} kind="secondary" full={false} onPress={reset} />
          <Card tone="accent" style={{ gap: t.space.sm, alignItems: 'center' }}>
            <Text variant="heading" style={{ textAlign: 'center' }}>{tx('gp_viral_title')}</Text>
            <Text muted style={{ textAlign: 'center' }}>{tx('gp_viral_body')}</Text>
            <Button title={tx('gp_viral_btn')} kind="primary" icon="logo-google-playstore" full={false}
              onPress={() => { api.track('share_tapped', { via: 'guest_viral_cta' }); Linking.openURL(config.playUrl).catch(() => {}); }} />
          </Card>
        </View>
      ) : null}

      <Text variant="caption" muted style={{ textAlign: 'center', marginTop: t.space.xl }}>
        {tx('cd_made_with')} · {config.webUrl.replace('https://', '')}
      </Text>
    </Wrap>
  );
}

function Wrap({ t, children }: { t: ReturnType<typeof useTheme>; children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <FluidBackground intensity={0.8} />
      {router.canGoBack() ? <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs }}><BackButton /></View> : null}
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxxl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const STEP_KEYS = ['gp_step1', 'gp_step2', 'gp_step3', 'gp_step4'];
function PayProgress({ t, active }: { t: ReturnType<typeof useTheme>; active: number }) {
  const { t: tx } = useI18n();
  const STEPS = STEP_KEYS.map((k) => tx(k));
  // active = index of the step in progress; steps before it are done; active>=4 means everything is done.
  return (
    <Card style={{ gap: t.space.sm }} accessibilityLabel={tx('gp_progress', { step: STEPS[Math.min(active, 3)] })}>
      {STEPS.map((label, i) => {
        const done = i < active || (i === 0);
        const cur = i === active;
        return (
          <Row key={label} gap={t.space.sm}>
            <Ionicons name={done ? 'checkmark-circle' : cur ? 'time-outline' : 'ellipse-outline'} size={20}
              color={done ? t.colors.accent : cur ? t.colors.text : t.colors.textMuted} />
            <Text variant={cur ? 'label' : 'caption'} muted={!done && !cur}>{label}{cur && i === 3 ? tx('gp_usually_day') : ''}</Text>
          </Row>
        );
      })}
    </Card>
  );
}
