import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Pop } from '@/design-system/Anim';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingList, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { dateLocale, useI18n } from '@/i18n';
import { AdBanner, showInterstitial } from '@/lib/ads';
import { api, type Contribution, type ContributionStatus } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { errorMessage, useContributions, useDecide } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';

const FILTERS: { k?: ContributionStatus; key: string }[] = [
  { k: 'guest_marked_paid', key: 'stat_guest' }, { k: 'confirmed', key: 'stat_confirmed' }, { k: 'pledged', key: 'stat_pledged' },
  { k: 'rejected', key: 'stat_rejected' }, { key: 'gf_all' },
];

export default function Gifts() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const cur = useCurrentRegistry();
  const [filter, setFilter] = useState<ContributionStatus | undefined>('guest_marked_paid');
  const q = useContributions(cur.id, { status: filter });
  const decide = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hearts, setHearts] = useState(0);

  const act = (c: Contribution, decision: 'confirmed' | 'rejected') => {
    const run = () => decide.mutate({ id: c.id, decision }, {
      onSuccess: () => {
        if (decision === 'confirmed') {
          setHearts((n) => n + 1);
          setTimeout(() => showInterstitial({ premium: cur.registry?.plan === 'premium' }), 2000);
        }
      },
      onError: (e) => setErr(errorMessage(e)),
    });
    if (decision === 'rejected' && Platform.OS !== 'web') {
      Alert.alert(tx('gf_alert_t'), tx('gf_alert_b', { amt: formatINR(c.amount_paise), ref: c.reference }),
        [{ text: tx('common_cancel'), style: 'cancel' }, { text: tx('stat_rejected'), style: 'destructive', onPress: run }]);
    } else run();
  };

  const exportCsv = async () => {
    if (!cur.id) return;
    setExporting(true); setErr(null);
    try {
      const res = await api.exportCsv(cur.id);
      if (!res.ok) throw new Error('Export failed');
      const csv = await res.text();
      const name = `${cur.registry?.slug ?? 'gifts'}-gifts.csv`;
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = name; a.click();
      } else {
        const file = new File(Paths.cache, name);
        if (file.exists) file.delete();
        file.create();
        file.write(csv);
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export gifts' });
      }
    } catch (e) { setErr(errorMessage(e)); } finally { setExporting(false); }
  };

  if (cur.isLoading) return <Screen edges={['top']}><LoadingList /></Screen>;
  if (cur.error) return <Screen edges={['top']}><ErrorState message={errorMessage(cur.error)} onRetry={cur.refetch} /></Screen>;
  if (!cur.registry) return <Screen edges={['top']}><EmptyState animated icon="wallet-outline" title={tx('gf_no_t')} body={tx('gf_no_b')} /></Screen>;

  return (
    <View style={{ flex: 1 }}>
    <Screen edges={['top']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">{tx('gf_title')}</Text>
        <Button title={tx('gf_export')} kind="secondary" icon="download-outline" full={false} loading={exporting} onPress={exportCsv} />
      </Row>
      <Banner tone="info" title={tx('gf_how_t')}
        body={tx('gf_how_b')} />
      {err ? <Banner tone="negative" title={err} /> : null}
      <Row wrap gap={t.space.sm}>
        {FILTERS.map((f) => <Chip key={f.key} label={tx(f.key)} selected={filter === f.k} onPress={() => setFilter(f.k)} />)}
      </Row>
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /> :
        q.data!.items.length === 0 ? (
          <EmptyState animated icon="mail-open-outline" title={tx('gf_none_t')} body={tx('gf_none_b')}
            action={<Button title={tx('gf_share_cta')} kind="secondary" icon="share-social-outline" full={false} onPress={() => router.push('/home')} />} />
        ) :
        q.data!.items.map((c) => (
          <Card key={c.id}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{formatINR(c.amount_paise)}</Text>
                <Text variant="caption" muted>{c.goal_title} · {new Date(c.created_at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="label" selectable>{c.reference}</Text>
                <StatusPill status={c.status} />
              </View>
            </Row>
            <Text variant="label">{c.is_anonymous ? `${tx('gf_anon')}${c.guest_name ? ` (${c.guest_name})` : ''}` : c.guest_name || tx('gf_guest')}</Text>
            {c.guest_message ? <Text muted>“{c.guest_message}”</Text> : null}
            {c.card ? <Row gap={t.space.sm}><Text variant="label" color={t.colors.highlight}>{tx('gf_card')}</Text>{c.card_id ? <Button title={tx('gf_view_card')} kind="ghost" full={false} onPress={() => router.push(`/card/${c.card_id}`)} style={{ minHeight: 36, paddingHorizontal: 8 }} /> : null}</Row> : null}
            {c.status === 'pledged' || c.status === 'guest_marked_paid' ? (
              <Row gap={t.space.sm}>
                <Button title={tx('gf_recv')} kind="accent" icon="checkmark" style={{ flex: 1 }} onPress={() => act(c, 'confirmed')} loading={decide.isPending && decide.variables?.id === c.id} />
                <Button title={tx('gf_notrecv')} kind="danger" style={{ flex: 1 }} onPress={() => act(c, 'rejected')} />
              </Row>
            ) : c.status === 'confirmed' ? (
              <Button title={tx('gf_undo')} kind="ghost" full={false} onPress={() => act(c, 'rejected')} style={{ paddingHorizontal: 0 }} />
            ) : c.status === 'rejected' ? (
              <Button title={tx('gf_mark_recv')} kind="ghost" full={false} onPress={() => act(c, 'confirmed')} style={{ paddingHorizontal: 0 }} />
            ) : null}
          </Card>
        ))}
      <AdBanner hidden={cur.registry.plan === 'premium'} />
    </Screen>
    <Pop trigger={hearts} />
    </View>
  );
}

function StatusPill({ status }: { status: ContributionStatus }) {
  const t = useTheme();
  const { t: tx } = useI18n();
  const m: Record<ContributionStatus, [string, string, string]> = {
    confirmed: [tx('stat_confirmed'), t.colors.positive, t.colors.positiveBg],
    guest_marked_paid: [tx('stat_guest_says'), t.colors.warning, t.colors.warningBg],
    pledged: [tx('stat_pledged'), t.colors.textMuted, t.colors.bgAlt],
    rejected: [tx('stat_rejected'), t.colors.negative, t.colors.negativeBg],
    expired: [tx('stat_expired'), t.colors.textMuted, t.colors.bgAlt],
  };
  const [label, fg, bg] = m[status];
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}><Text variant="caption" color={fg}>{label}</Text></View>;
}
