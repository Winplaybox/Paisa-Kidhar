/* Shareable Digital Shagun Card page. Shown after the guest pays (Dodo return_url) and to anyone with the link:
   payment-success animation → envelope opens → card + ambient Lottie. Buyer (holds the edit key) can switch design for free. */
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Head } from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { whatsappUrl, saveCardPng, shareLink } from '@/cards/share';
import { CardStage } from '@/components/CardStage';
import { specFromCard, type CardHandle } from '@/components/ShagunCardView';
import { BackButton } from '@/design-system/BackButton';
import { Anim, ConfettiBurst } from '@/design-system/Anim';
import { Banner, Button, EmptyState, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { loadEditKey } from '@/lib/cardDraft';
import { config } from '@/lib/config';

export default function CardPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { t: tx } = useI18n();
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [paidNow, setPaidNow] = useState(false);
  const handle = useRef<CardHandle>(null);
  const wasPending = useRef(false);
  const q = useQuery({
    queryKey: ['card', id], queryFn: () => api.card(id), retry: 1,
    refetchInterval: (query) => (query.state.data && query.state.data.status === 'created' && query.state.dataUpdateCount < 40 ? 2500 : false),
  });
  const c = q.data;
  const url = `${config.webUrl}/card/${id}`;

  useEffect(() => { if (id) loadEditKey(id).then((k) => setCanEdit(!!k)); }, [id, c?.status]);
  useEffect(() => {
    if (c?.status === 'created') wasPending.current = true;
    if (c?.status === 'succeeded' && wasPending.current) { setPaidNow(true); wasPending.current = false; }
  }, [c?.status]);

  const spec = c && c.status === 'succeeded' ? specFromCard(c) : null;
  const shareText = tx('cd_msg_share', { name: spec?.recipient ?? '', url });

  const download = async () => {
    setBusy(true); setMsg(null);
    try { await saveCardPng(handle.current, `shagun-card-${id}`); } catch { setMsg(tx('cd_download_err')); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Head>
        <title>{tx('cd_title')} | Paisa Kidhar</title><meta name="robots" content="noindex" />
        <meta property="og:title" content="💌 You've received a Shagun Card" /><meta property="og:description" content="Open your digital Shagun Card — made with Paisa Kidhar." />
      </Head>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs }}><BackButton fallback={c?.slug ? `/r/${c.slug}` : '/'} /></View>
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, alignItems: 'center', paddingBottom: t.space.xxxl }}>
        {q.isLoading ? <ActivityIndicator color={t.colors.accent} style={{ marginTop: 80 }} /> :
          q.error ? <EmptyState icon="mail-unread-outline" title={tx('cd_not_found')} body={q.error instanceof ApiError ? q.error.message : tx('cd_check_link')} /> :
          spec ? (
            <>
              {paidNow ? (
                <View style={{ alignItems: 'center' }}>
                  <Anim name="success" size={110} />
                  <Text variant="heading">{tx('cd_ready')}</Text>
                </View>
              ) : null}
              <ConfettiBurst show={paidNow} />
              <CardStage ref={handle} spec={spec} width={Math.min(340, width - 40)} reveal autoOpenMs={paidNow ? 1400 : 900} celebrate hint={tx('cd_tap_open')} />
              {msg ? <Banner tone="negative" title={msg} /> : null}
              <Row gap={t.space.sm} wrap style={{ justifyContent: 'center' }}>
                <Button title={tx('cd_share')} kind="accent" icon="logo-whatsapp" full={false} onPress={() => Linking.openURL(whatsappUrl(shareText))} />
                <Button title={Platform.OS === 'web' ? tx('cd_download') : tx('cd_download_native')} kind="secondary" icon="download-outline" full={false} loading={busy} onPress={download} />
              </Row>
              <Row gap={t.space.sm} wrap style={{ justifyContent: 'center' }}>
                <Button title={copied ? tx('cd_copied') : tx('cd_copy')} kind="secondary" icon="link-outline" full={false}
                  onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); }} />
                <Button title="⋯" kind="ghost" full={false} onPress={() => shareLink(shareText, url)} accessibilityHint="More sharing options" />
              </Row>
              {canEdit ? <Button title={tx('cd_edit')} kind="primary" icon="color-palette-outline" full={false} onPress={() => router.push(`/card/new?edit=${id}`)} /> : null}
              {c?.slug ? <Button title={tx('cd_see_registry')} kind="ghost" full={false} onPress={() => router.push(`/r/${c.slug}`)} /> : null}
            </>
          ) : c && (c.status === 'failed' || c.status === 'cancelled') ? (
            <Banner tone="negative" title={tx('cd_pay_fail_t')} body={tx('cd_pay_fail_b')} />
          ) : (
            <View style={{ alignItems: 'center', gap: t.space.md, marginTop: 60 }}>
              <ActivityIndicator color={t.colors.accent} />
              <Text muted style={{ textAlign: 'center' }}>{tx('cd_confirming')}</Text>
            </View>
          )}
        <Text variant="caption" muted>{tx('cd_made_with')} · {config.webUrl.replace('https://', '')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
