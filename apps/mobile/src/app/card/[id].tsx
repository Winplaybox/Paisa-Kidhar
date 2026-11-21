/* Shareable Digital Shagun Card page. Shown after the guest pays (Dodo return_url) and to anyone with the link. */
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Head } from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShagunCardView } from '@/components/ShagunCardView';
import { BackButton } from '@/design-system/BackButton';
import { ConfettiBurst } from '@/design-system/Anim';
import { Banner, Button, EmptyState, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, ApiError } from '@/lib/api';
import { config } from '@/lib/config';

export default function CardPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const q = useQuery({
    queryKey: ['card', id], queryFn: () => api.card(id), retry: 1,
    refetchInterval: (query) => (query.state.data && query.state.data.status === 'created' && query.state.dataUpdateCount < 40 ? 2500 : false),
  });
  const c = q.data;
  const url = `${config.webUrl}/card/${id}`;

  const share = async () => {
    const message = `💌 A Shagun Card for ${c?.partner_one} & ${c?.partner_two}: ${url}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'share' in navigator) { try { await navigator.share({ text: message, url }); return; } catch { /* cancelled */ } }
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
      return;
    }
    await Share.share({ message, url });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Head><title>Shagun Card | Paisa Kidhar</title><meta name="robots" content="noindex" /></Head>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs }}><BackButton fallback={c?.slug ? `/r/${c.slug}` : '/'} /></View>
      <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, alignItems: 'center', paddingBottom: t.space.xxxl }}>
        {q.isLoading ? <ActivityIndicator color={t.colors.accent} style={{ marginTop: 80 }} /> :
          q.error ? <EmptyState icon="mail-unread-outline" title="Card not found" body={q.error instanceof ApiError ? q.error.message : 'Please check the link.'} /> :
          c && c.status === 'succeeded' ? (
            <>
              <ConfettiBurst show />
              <ShagunCardView design={c.design!} from={c.from} message={c.message} partnerOne={c.partner_one!} partnerTwo={c.partner_two!}
                date={c.wedding_date} width={Math.min(380, width - 40)} />
              <Row gap={t.space.sm} wrap style={{ justifyContent: 'center' }}>
                <Button title="Share card" kind="accent" icon="logo-whatsapp" full={false} onPress={share} />
                <Button title={copied ? 'Link copied' : 'Copy link'} kind="secondary" icon="link-outline" full={false}
                  onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); }} />
              </Row>
              {c.slug ? <Button title="See their registry" kind="ghost" full={false} onPress={() => router.push(`/r/${c.slug}`)} /> : null}
            </>
          ) : c && (c.status === 'failed' || c.status === 'cancelled') ? (
            <Banner tone="negative" title="Payment didn't go through" body="You haven't been charged. Your UPI gift is unaffected." />
          ) : (
            <View style={{ alignItems: 'center', gap: t.space.md, marginTop: 60 }}>
              <ActivityIndicator color={t.colors.accent} />
              <Text muted style={{ textAlign: 'center' }}>Confirming your payment… your card appears here in a few seconds.</Text>
            </View>
          )}
        <Text variant="caption" muted>Made with Paisa Kidhar · {config.webUrl.replace('https://', '')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
