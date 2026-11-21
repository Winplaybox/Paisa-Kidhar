import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCard } from '@/components/ShareCard';
import { AreaChart, Donut, GoalBars, Histogram } from '@/design-system/charts';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingList, ProgressBar, Row, Stat, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { AdBanner } from '@/lib/ads';
import { useAuth } from '@/lib/auth';
import { formatINR, formatINRCompact } from '@/lib/money';
import { errorMessage, useInsights } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';

const RANGES = [{ k: '7', key: 'hm_r7' }, { k: '30', key: 'hm_r30' }, { k: '90', key: 'hm_r90' }, { k: '365', key: 'hm_r365' }];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Home() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { profile } = useAuth();
  const cur = useCurrentRegistry();
  const [range, setRange] = useState('30');
  const [goalId, setGoalId] = useState<string | undefined>();
  const from = iso(new Date(Date.now() - (Number(range) - 1) * 86400000));
  const ins = useInsights(cur.id, { from, to: iso(new Date()), goal_id: goalId });

  const body = () => {
    if (cur.isLoading) return <LoadingList rows={3} />;
    if (cur.error) return <ErrorState message={errorMessage(cur.error)} onRetry={cur.refetch} />;
    if (cur.hasNone || !cur.registry) {
      return (
        <EmptyState animated icon="sparkles-outline" title={tx('hm_create_t')}
          body={tx('hm_create_b')}
          action={<Button title={tx('hm_create_btn')} kind="accent" full={false} icon="add" onPress={() => router.push('/registry/setup')} />} />
      );
    }
    const r = cur.registry;
    const k = ins.data?.kpis;
    const statusColors: Record<string, string> = { confirmed: t.colors.positive, guest_marked_paid: t.colors.warning, pledged: t.colors.textMuted, rejected: t.colors.negative, expired: t.colors.border };
    const statusLabels: Record<string, string> = { confirmed: tx('stat_confirmed'), guest_marked_paid: tx('stat_guest'), pledged: tx('stat_pledged'), rejected: tx('stat_rejected'), expired: tx('stat_expired') };
    return (
      <>
        <View style={{ gap: 4 }}>
          <Text muted>{tx('hm_hello', { name: profile?.display_name?.split(' ')[0] || profile?.username || '' })}</Text>
          <Text variant="title">{r.partner_one} & {r.partner_two}</Text>
        </View>

        {r.status !== 'published' ? (
          <Banner tone="warning" title={r.status === 'paused' ? tx('hm_paused') : tx('hm_draft')}
            body={r.status === 'paused' ? tx('hm_paused_b') : tx('hm_draft_b')}
            action={<Button title={tx('hm_finish')} kind="secondary" full={false} onPress={() => router.push('/goals')} style={{ marginTop: 8 }} />} />
        ) : null}

        {k && k.pending_count > 0 ? (
          <Card tone="accent" onPress={() => router.push('/gifts')} accessibilityLabel={tx('hm_review_gifts')}>
            <Text variant="label" color={t.colors.accent}>{tx('hm_pending', { n: k.pending_count, amt: formatINR(k.pending_paise) })}</Text>
            <Text variant="caption" muted>{tx('hm_pending_b')}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: t.space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" muted>{tx('hm_raised')}</Text>
            <Text variant="caption" muted>{tx('hm_of_all', { p: Math.round((k?.overall_progress ?? 0) * 100) })}</Text>
          </Row>
          <Text variant="display">{formatINR(k?.raised_paise ?? 0)}</Text>
          <ProgressBar value={k?.overall_progress ?? 0} label={tx('hm_overall')} />
        </Card>

        <Row wrap gap={t.space.sm}>
          {RANGES.map((x) => <Chip key={x.k} label={tx(x.key)} selected={range === x.k} onPress={() => setRange(x.k)} />)}
        </Row>
        {r.goals.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.sm }}>
            <Chip label={tx('hm_all_goals')} selected={!goalId} onPress={() => setGoalId(undefined)} />
            {r.goals.map((g) => <Chip key={g.id} label={g.title} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />)}
          </ScrollView>
        ) : null}

        {ins.isLoading ? <LoadingList rows={2} /> : ins.error ? <ErrorState message={errorMessage(ins.error)} onRetry={ins.refetch} /> : k ? (
          <>
            <Row wrap gap={t.space.md}>
              <Stat label={tx('hm_s_gifts')} value={String(k.confirmed_count)} />
              <Stat label={tx('hm_s_avg')} value={formatINRCompact(k.avg_paise)} />
              <Stat label={tx('hm_s_active')} value={String(k.active_goals)} sub={tx('hm_s_done', { n: k.completed_goals })} />
            </Row>
            <Card>
              <Text variant="heading">{tx('hm_over_time')}</Text>
              <AreaChart label={tx('hm_per_day')} data={ins.data!.daily.map((d) => ({ x: d.day, y: d.paise }))} />
            </Card>
            <Card>
              <Text variant="heading">{tx('hm_by_goal')}</Text>
              <GoalBars goals={ins.data!.by_goal} />
            </Card>
            <Row wrap gap={t.space.md}>
              <Card style={{ flex: 1, minWidth: 280 }}>
                <Text variant="heading">{tx('hm_sizes')}</Text>
                <Histogram data={ins.data!.distribution} />
              </Card>
              <Card style={{ flex: 1, minWidth: 280 }}>
                <Text variant="heading">{tx('hm_status')}</Text>
                <Donut centerLabel={String(ins.data!.status_mix.reduce((s, x) => s + x.n, 0))}
                  slices={ins.data!.status_mix.map((s) => ({ label: statusLabels[s.status] ?? s.status, value: s.n, color: statusColors[s.status] ?? t.colors.border }))} />
              </Card>
            </Row>
          </>
        ) : null}

        {r.status === 'published' ? <ShareCard registry={r} /> : null}
        {r.plan !== 'premium' ? (
          <Card onPress={() => router.push('/premium')} accessibilityLabel={tx('hm_upgrade')}>
            <Text variant="label" color={t.colors.highlight}>{tx('hm_prem_t')}</Text>
            <Text variant="caption" muted>{tx('hm_prem_b')}</Text>
          </Card>
        ) : null}
        <AdBanner hidden={r.plan === 'premium'} />
      </>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxxl, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { cur.refetch(); ins.refetch(); }} tintColor={t.colors.accent} />}
      >
        {body()}
      </ScrollView>
    </SafeAreaView>
  );
}
