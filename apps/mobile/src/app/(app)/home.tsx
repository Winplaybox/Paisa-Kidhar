import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCard } from '@/components/ShareCard';
import { AreaChart, Donut, GoalBars, Histogram } from '@/design-system/charts';
import { Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingList, ProgressBar, Row, Stat, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { AdBanner } from '@/lib/ads';
import { useAuth } from '@/lib/auth';
import { formatINR, formatINRCompact } from '@/lib/money';
import { errorMessage, useInsights } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';

const RANGES = [{ k: '7', label: '7 days' }, { k: '30', label: '30 days' }, { k: '90', label: '90 days' }, { k: '365', label: '1 year' }];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Home() {
  const t = useTheme();
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
        <EmptyState animated icon="sparkles-outline" title="Let's create your registry"
          body="Add your names, wedding date and UPI ID. Then list a few dreams — guests will see them on your link."
          action={<Button title="Create my registry" kind="accent" full={false} icon="add" onPress={() => router.push('/registry/setup')} />} />
      );
    }
    const r = cur.registry;
    const k = ins.data?.kpis;
    const statusColors: Record<string, string> = { confirmed: t.colors.positive, guest_marked_paid: t.colors.warning, pledged: t.colors.textMuted, rejected: t.colors.negative, expired: t.colors.border };
    const statusLabels: Record<string, string> = { confirmed: 'Received', guest_marked_paid: 'To confirm', pledged: 'Started', rejected: 'Not received', expired: 'Expired' };
    return (
      <>
        <View style={{ gap: 4 }}>
          <Text muted>Namaste {profile?.display_name?.split(' ')[0] || profile?.username || ''} 👋</Text>
          <Text variant="title">{r.partner_one} & {r.partner_two}</Text>
        </View>

        {r.status !== 'published' ? (
          <Banner tone="warning" title={r.status === 'paused' ? 'Your registry is paused' : 'Your registry is a draft'}
            body={r.status === 'paused' ? 'Guests can’t see it right now.' : 'Add your UPI ID and at least one goal, then publish to share it.'}
            action={<Button title="Finish setup" kind="secondary" full={false} onPress={() => router.push('/goals')} style={{ marginTop: 8 }} />} />
        ) : null}

        {k && k.pending_count > 0 ? (
          <Card tone="accent" onPress={() => router.push('/gifts')} accessibilityLabel="Review gifts to confirm">
            <Text variant="label" color={t.colors.accent}>{k.pending_count} gift{k.pending_count > 1 ? 's' : ''} to confirm · {formatINR(k.pending_paise)}</Text>
            <Text variant="caption" muted>Check your UPI app, then mark them received.</Text>
          </Card>
        ) : null}

        <Card style={{ gap: t.space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" muted>Raised so far</Text>
            <Text variant="caption" muted>{Math.round((k?.overall_progress ?? 0) * 100)}% of all goals</Text>
          </Row>
          <Text variant="display">{formatINR(k?.raised_paise ?? 0)}</Text>
          <ProgressBar value={k?.overall_progress ?? 0} label="Overall progress" />
        </Card>

        <Row wrap gap={t.space.sm}>
          {RANGES.map((x) => <Chip key={x.k} label={x.label} selected={range === x.k} onPress={() => setRange(x.k)} />)}
        </Row>
        {r.goals.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.sm }}>
            <Chip label="All goals" selected={!goalId} onPress={() => setGoalId(undefined)} />
            {r.goals.map((g) => <Chip key={g.id} label={g.title} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />)}
          </ScrollView>
        ) : null}

        {ins.isLoading ? <LoadingList rows={2} /> : ins.error ? <ErrorState message={errorMessage(ins.error)} onRetry={ins.refetch} /> : k ? (
          <>
            <Row wrap gap={t.space.md}>
              <Stat label="Gifts received" value={String(k.confirmed_count)} />
              <Stat label="Average gift" value={formatINRCompact(k.avg_paise)} />
              <Stat label="Active goals" value={String(k.active_goals)} sub={`${k.completed_goals} completed`} />
            </Row>
            <Card>
              <Text variant="heading">Gifts over time</Text>
              <AreaChart label="Gifts received per day" data={ins.data!.daily.map((d) => ({ x: d.day, y: d.paise }))} />
            </Card>
            <Card>
              <Text variant="heading">Progress by goal</Text>
              <GoalBars goals={ins.data!.by_goal} />
            </Card>
            <Row wrap gap={t.space.md}>
              <Card style={{ flex: 1, minWidth: 280 }}>
                <Text variant="heading">Gift sizes</Text>
                <Histogram data={ins.data!.distribution} />
              </Card>
              <Card style={{ flex: 1, minWidth: 280 }}>
                <Text variant="heading">Status</Text>
                <Donut centerLabel={String(ins.data!.status_mix.reduce((s, x) => s + x.n, 0))}
                  slices={ins.data!.status_mix.map((s) => ({ label: statusLabels[s.status] ?? s.status, value: s.n, color: statusColors[s.status] ?? t.colors.border }))} />
              </Card>
            </Row>
          </>
        ) : null}

        {r.status === 'published' ? <ShareCard registry={r} /> : null}
        {r.plan !== 'premium' ? (
          <Card onPress={() => router.push('/premium')} accessibilityLabel="Upgrade to Premium">
            <Text variant="label" color={t.colors.highlight}>✦ Premium Registry</Text>
            <Text variant="caption" muted>Up to 50 goals, beautiful themes, no ads for you or your guests.</Text>
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
