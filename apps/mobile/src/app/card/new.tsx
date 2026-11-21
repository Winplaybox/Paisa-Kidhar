/* Create (or, with ?edit=<id>, re-style) a Digital Shagun Card:
   1 occasion → 2 design gallery → 3 personalise → 4 animated preview → pay ₹49 (unlocks every design). */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Head } from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CARD_LANGS, OCCASIONS, OCCASION_ICON, OCCASION_LABEL, PALETTE_COUNT, PALETTE_LABEL, TEMPLATES, TEMPLATE_LABEL, paletteFor, pick, templateById,
  type CardLang, type Occasion, type TemplateId,
} from '@/cards/catalog';
import { defaultBlessing } from '@/cards/copy';
import { CardStage } from '@/components/CardStage';
import { ShagunCardView, specFromCard, type CardSpec } from '@/components/ShagunCardView';
import { BackButton, goBackOr } from '@/design-system/BackButton';
import { Banner, Button, Card, Chip, EmptyState, Field, Row, Text } from '@/design-system/components';
import { DateField } from '@/design-system/DateField';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { loadCardContext, loadEditKey, saveEditKey, type CardContext } from '@/lib/cardDraft';
import { formatINR } from '@/lib/money';
import { errorMessage, usePlans } from '@/lib/queries';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function NewCard() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const t = useTheme();
  const { t: tx, lang: appLang } = useI18n();
  const { width } = useWindowDimensions();
  const plans = usePlans();
  const offer = plans.data?.shagun_card;
  const price = offer ? formatINR(offer.price_paise) : '₹49';

  const [ctx, setCtx] = useState<CardContext | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(edit ? 1 : 0);
  const [occasion, setOccasion] = useState<Occasion>('wedding');
  const [template, setTemplate] = useState<TemplateId>('marigold');
  const [palette, setPalette] = useState(0);
  const [lang, setLang] = useState<CardLang>(['en', 'hi', 'gu', 'mr'].includes(appLang) ? (appLang as CardLang) : 'en');
  const [recipient, setRecipient] = useState('');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [blessing, setBlessing] = useState('');
  const [email, setEmail] = useState('');
  const [filter, setFilter] = useState<'all' | Occasion>('all');
  const [previewing, setPreviewing] = useState<TemplateId | null>(null);
  const [replay, setReplay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await loadCardContext();
      if (edit) {
        const [card, key] = await Promise.all([api.card(edit).catch(() => null), loadEditKey(edit)]);
        if (card && card.status === 'succeeded' && key) {
          const s = specFromCard(card);
          setEditKey(key); setTemplate(s.template); setOccasion(s.occasion); setPalette(s.palette); setLang(s.lang);
          setRecipient(s.recipient); setDate(s.date ?? ''); setFrom(s.from ?? ''); setBlessing(card.message ?? '');
        }
      } else if (c) {
        setRecipient(`${c.partnerOne} & ${c.partnerTwo}`); setDate(c.weddingDate ?? ''); setFrom(c.guestName ?? ''); setBlessing(c.message ?? '');
      }
      setCtx(c); setReady(true);
    })();
  }, [edit]);

  const spec: CardSpec = useMemo(() => ({
    template, occasion, palette, lang, recipient: recipient.trim() || (ctx ? `${ctx.partnerOne} & ${ctx.partnerTwo}` : ''), date: date || null,
    blessing: blessing.trim() || null, from: from.trim() || null,
  }), [template, occasion, palette, lang, recipient, date, blessing, from, ctx]);

  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = 12;
  const inner = Math.min(width, 900) - t.space.lg * 2;
  const tileW = Math.floor((inner - gap * (cols - 1)) / cols);

  const body = () => ({
    template, occasion, palette, lang, recipient: recipient.trim() || null, event_date: date || null, sender: from.trim() || null, blessing: blessing.trim() || null,
  });

  const pay = async () => {
    if (!ctx) return;
    if (!EMAIL.test(email.trim())) { setErr(tx('cd_email_err')); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.cardCheckout(ctx.reference, ctx.token, email.trim(), body());
      await saveEditKey(r.card_id, r.edit_key);
      api.track('premium_checkout', { item: 'shagun_card' });
      if (Platform.OS === 'web') { window.location.href = r.checkout_url; return; }
      await WebBrowser.openBrowserAsync(r.checkout_url);
      router.replace(`/card/${r.card_id}`);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!edit || !editKey) return;
    setBusy(true); setErr(null);
    try { await api.cardEdit(edit, editKey, body()); setSaved(true); router.replace(`/card/${edit}`); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  if (!ready) return <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}><ActivityIndicator color={t.colors.accent} style={{ marginTop: 100 }} /></SafeAreaView>;
  if ((edit && !editKey) || (!edit && !ctx)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <View style={{ padding: t.space.md }}><BackButton fallback="/" /></View>
        <EmptyState icon="mail-unread-outline" title={tx('cd_not_found')} body={tx('cd_no_session')} />
      </SafeAreaView>
    );
  }

  const steps = [tx('cd_step1'), tx('cd_step2'), tx('cd_step3'), tx('cd_step4')];
  const first = edit ? 1 : 0;
  const ordered = [...TEMPLATES].sort((a, b) => Number(b.occasion === occasion) - Number(a.occasion === occasion));
  const shown = filter === 'all' ? ordered : ordered.filter((x) => x.occasion === filter);
  const next = () => { setErr(null); setStep((s) => Math.min(3, s + 1)); };
  const back = () => { if (step <= first) goBackOr('/'); else setStep((s) => s - 1); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Head><title>{tx('cd_title')} | Paisa Kidhar</title><meta name="robots" content="noindex" /></Head>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs, flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <BackButton fallback="/" />
        <Text variant="heading" style={{ flex: 1 }}>{tx('cd_title')}</Text>
      </View>
      <Row gap={6} style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.sm }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 4 }} accessibilityLabel={`${i + 1}/4 ${s}`}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? t.colors.accent : t.colors.border }} />
            <Text variant="caption" muted={i !== step} numberOfLines={1}>{s}</Text>
          </View>
        ))}
      </Row>

      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: 120, width: '100%', maxWidth: 900, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {err ? <Banner tone="negative" title={err} /> : null}

        {step === 0 ? (
          <>
            <Text variant="title">{tx('cd_pick_occasion')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
              {OCCASIONS.map((o) => {
                const on = o === occasion;
                return (
                  <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: on }}
                    onPress={() => { setOccasion(o); setTemplate((cur) => (templateById(cur).occasion === o ? cur : (TEMPLATES.find((x) => x.occasion === o)?.id ?? cur))); setFilter('all'); setStep(1); }}
                    style={{ width: tileW, minHeight: 104, borderRadius: t.radius.lg, borderWidth: 1.5, borderColor: on ? t.colors.accent : t.colors.border,
                      backgroundColor: on ? t.colors.accentBg : t.colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8, padding: t.space.md }}>
                    <Ionicons name={OCCASION_ICON[o] as never} size={30} color={on ? t.colors.accent : t.colors.textMuted} />
                    <Text variant="label" style={{ textAlign: 'center' }}>{pick(OCCASION_LABEL[o], appLang as CardLang)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text variant="title">{tx('cd_pick_design')}</Text>
            <Text muted variant="caption">{tx('cd_unlock', { price })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.sm }}>
              <Chip label={tx('cd_all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
              {OCCASIONS.map((o) => <Chip key={o} label={pick(OCCASION_LABEL[o], appLang as CardLang)} selected={filter === o} onPress={() => setFilter(o)} />)}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
              {shown.map((x) => {
                const on = x.id === template;
                return (
                  <View key={x.id} style={{ width: tileW, gap: 6 }}>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={pick(TEMPLATE_LABEL[x.id], appLang as CardLang)}
                      onPress={() => setTemplate(x.id)}
                      style={{ borderRadius: 18, padding: 3, borderWidth: 2.5, borderColor: on ? t.colors.accent : 'transparent' }}>
                      <ShagunCardView spec={{ ...spec, template: x.id, palette }} width={tileW - 12} />
                      {on ? <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: t.colors.accent, borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={18} color={t.colors.onAccent} /></View> : null}
                    </Pressable>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="label" numberOfLines={1}>{pick(TEMPLATE_LABEL[x.id], appLang as CardLang)}</Text>
                        <Text variant="caption" muted numberOfLines={1}>{pick(OCCASION_LABEL[x.occasion], appLang as CardLang)}</Text>
                      </View>
                      <Pressable onPress={() => { setReplay((n) => n + 1); setPreviewing(x.id); }} accessibilityRole="button" accessibilityLabel={`${tx('cd_preview')} ${pick(TEMPLATE_LABEL[x.id], appLang as CardLang)}`}
                        hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
                        <Ionicons name="play-circle" size={22} color={t.colors.accent} /><Text variant="caption" color={t.colors.accent}>{tx('cd_preview')}</Text>
                      </Pressable>
                    </Row>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={{ alignItems: 'center' }}><ShagunCardView spec={spec} width={Math.min(250, inner)} /></View>
            <Card style={{ gap: t.space.md }}>
              <Field label={tx('cd_recipient')} value={recipient} onChangeText={setRecipient} maxLength={80} placeholder="Rahul & Priya" />
              <DateField label={tx('cd_date')} value={date} onChange={setDate} />
              <Field label={tx('cd_sender')} value={from} onChangeText={setFrom} maxLength={60} placeholder="Sunita Mausi" />
              <Field label={`${tx('cd_blessing')} (${blessing.length}/280)`} value={blessing} onChangeText={(v) => setBlessing(v.slice(0, 280))} multiline maxLength={280}
                placeholder={defaultBlessing(occasion, lang)} />
              {blessing ? <Button title={tx('cd_use_default')} kind="ghost" full={false} onPress={() => setBlessing('')} style={{ paddingHorizontal: 0 }} /> : null}
            </Card>
            <Card style={{ gap: t.space.md }}>
              <Text variant="label">{tx('cd_lang')}</Text>
              <Row wrap gap={t.space.sm}>{CARD_LANGS.map((l) => <Chip key={l.code} label={l.native} selected={lang === l.code} onPress={() => setLang(l.code)} />)}</Row>
              <Text variant="label">{tx('cd_colors')}</Text>
              <Row wrap gap={t.space.md}>
                {Array.from({ length: PALETTE_COUNT }).map((_, i) => {
                  const p = paletteFor(template, i); const on = palette === i;
                  return (
                    <Pressable key={i} onPress={() => setPalette(i)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={pick(PALETTE_LABEL[i], appLang as CardLang)} style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: on ? 3 : 1, borderColor: on ? t.colors.accent : t.colors.border, overflow: 'hidden', flexDirection: 'row' }}>
                        <View style={{ flex: 1, backgroundColor: p.bg[0] }} /><View style={{ flex: 1, backgroundColor: p.accent }} />
                      </View>
                      <Text variant="caption" muted={!on}>{pick(PALETTE_LABEL[i], appLang as CardLang)}</Text>
                    </Pressable>
                  );
                })}
              </Row>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <CardStage key={replay} spec={spec} width={Math.min(300, inner)} reveal autoOpenMs={edit ? 600 : 900} celebrate={false} hint={tx('cd_tap_open')} />
            </View>
            <Row style={{ justifyContent: 'center' }}><Button title="↻" kind="ghost" full={false} onPress={() => setReplay((n) => n + 1)} accessibilityHint={tx('cd_replay')} /></Row>
            {!edit ? (
              <>
                <Card style={{ gap: 6 }}>
                  <Text variant="label">{tx('cd_includes')}</Text>
                  {['cd_inc1', 'cd_inc2', 'cd_inc3', 'cd_inc4', 'cd_inc5'].map((k) => (
                    <Row key={k} gap={t.space.sm}><Ionicons name="checkmark-circle" size={18} color={t.colors.accent} /><Text variant="caption" style={{ flex: 1 }}>{tx(k)}</Text></Row>
                  ))}
                </Card>
                <Field label={tx('cd_email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@gmail.com" />
                <Button title={tx('cd_send', { price })} kind="accent" icon="lock-closed-outline" loading={busy} onPress={pay} />
                <Text variant="caption" muted style={{ textAlign: 'center' }}>{tx('cd_secure')}</Text>
              </>
            ) : <Button title={saved ? tx('cd_saved') : tx('cd_save')} kind="accent" icon="checkmark" loading={busy} onPress={saveEdit} />}
          </>
        ) : null}
      </ScrollView>

      {step < 3 && step !== 0 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: t.space.md, backgroundColor: t.colors.bg, borderTopWidth: 1, borderTopColor: t.colors.border, flexDirection: 'row', gap: t.space.sm }}>
          <Button title={tx('cd_back')} kind="secondary" full={false} onPress={back} />
          <View style={{ flex: 1 }}><Button title={tx('cd_next')} kind="primary" onPress={next} /></View>
        </View>
      ) : step === 3 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: t.space.md, backgroundColor: t.colors.bg, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Button title={tx('cd_back')} kind="secondary" onPress={back} />
        </View>
      ) : null}

      <Modal visible={!!previewing} transparent animationType="fade" onRequestClose={() => setPreviewing(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setPreviewing(null)} accessibilityLabel={tx('cd_close_prev')}>
          {previewing ? (
            <View style={{ alignItems: 'center', gap: t.space.md }}>
              <CardStage key={`${previewing}-${replay}`} spec={{ ...spec, template: previewing, palette }} width={Math.min(300, width - 48)} reveal autoOpenMs={500} hint={tx('cd_tap_open')} />
              <Button title={tx('cd_selected')} kind="accent" icon="checkmark" full={false}
                onPress={() => { setTemplate(previewing); setPreviewing(null); }} />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
