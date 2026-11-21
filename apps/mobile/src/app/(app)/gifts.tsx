import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingList, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, type Contribution, type ContributionStatus } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { errorMessage, useContributions, useDecide } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';

const FILTERS: { k?: ContributionStatus; label: string }[] = [
  { k: 'guest_marked_paid', label: 'To confirm' }, { k: 'confirmed', label: 'Received' }, { k: 'pledged', label: 'Started' },
  { k: 'rejected', label: 'Not received' }, { label: 'All' },
];

export default function Gifts() {
  const t = useTheme();
  const cur = useCurrentRegistry();
  const [filter, setFilter] = useState<ContributionStatus | undefined>('guest_marked_paid');
  const q = useContributions(cur.id, { status: filter });
  const decide = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const act = (c: Contribution, decision: 'confirmed' | 'rejected') => {
    const run = () => decide.mutate({ id: c.id, decision }, { onError: (e) => setErr(errorMessage(e)) });
    if (decision === 'rejected' && Platform.OS !== 'web') {
      Alert.alert('Mark as not received?', `Only do this if ${formatINR(c.amount_paise)} with reference ${c.reference} never reached your UPI.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Not received', style: 'destructive', onPress: run }]);
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
  if (!cur.registry) return <Screen edges={['top']}><EmptyState icon="wallet-outline" title="No gifts yet" body="Create and publish your registry to start receiving gifts." /></Screen>;

  return (
    <Screen edges={['top']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">Gifts</Text>
        <Button title="Export CSV" kind="secondary" icon="download-outline" full={false} loading={exporting} onPress={exportCsv} />
      </Row>
      <Banner tone="info" title="How confirmation works"
        body="Guests pay you directly by UPI with a reference like PK7X3M9Q2A. Check your UPI app or bank SMS, then tap Received. Only received gifts count towards your goals." />
      {err ? <Banner tone="negative" title={err} /> : null}
      <Row wrap gap={t.space.sm}>
        {FILTERS.map((f) => <Chip key={f.label} label={f.label} selected={filter === f.k} onPress={() => setFilter(f.k)} />)}
      </Row>
      {q.isLoading ? <LoadingList /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /> :
        q.data!.items.length === 0 ? <EmptyState icon="mail-open-outline" title="Nothing here" body="New gifts will appear here as guests send them." /> :
        q.data!.items.map((c) => (
          <Card key={c.id}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{formatINR(c.amount_paise)}</Text>
                <Text variant="caption" muted>{c.goal_title} · {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="label" selectable>{c.reference}</Text>
                <StatusPill status={c.status} />
              </View>
            </Row>
            <Text variant="label">{c.is_anonymous ? `Anonymous${c.guest_name ? ` (${c.guest_name})` : ''}` : c.guest_name || 'A guest'}</Text>
            {c.guest_message ? <Text muted>“{c.guest_message}”</Text> : null}
            {c.card ? <Text variant="label" color={t.colors.highlight}>✦ Sent you a Digital Shagun Card</Text> : null}
            {c.status === 'pledged' || c.status === 'guest_marked_paid' ? (
              <Row gap={t.space.sm}>
                <Button title="Received" kind="accent" icon="checkmark" style={{ flex: 1 }} onPress={() => act(c, 'confirmed')} loading={decide.isPending && decide.variables?.id === c.id} />
                <Button title="Not received" kind="danger" style={{ flex: 1 }} onPress={() => act(c, 'rejected')} />
              </Row>
            ) : c.status === 'confirmed' ? (
              <Button title="Undo — mark not received" kind="ghost" full={false} onPress={() => act(c, 'rejected')} style={{ paddingHorizontal: 0 }} />
            ) : c.status === 'rejected' ? (
              <Button title="Mark as received" kind="ghost" full={false} onPress={() => act(c, 'confirmed')} style={{ paddingHorizontal: 0 }} />
            ) : null}
          </Card>
        ))}
    </Screen>
  );
}

function StatusPill({ status }: { status: ContributionStatus }) {
  const t = useTheme();
  const m: Record<ContributionStatus, [string, string, string]> = {
    confirmed: ['Received', t.colors.positive, t.colors.positiveBg],
    guest_marked_paid: ['Guest says paid', t.colors.warning, t.colors.warningBg],
    pledged: ['Started', t.colors.textMuted, t.colors.bgAlt],
    rejected: ['Not received', t.colors.negative, t.colors.negativeBg],
    expired: ['Expired', t.colors.textMuted, t.colors.bgAlt],
  };
  const [label, fg, bg] = m[status];
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}><Text variant="caption" color={fg}>{label}</Text></View>;
}
