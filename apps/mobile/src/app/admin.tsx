import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Donut } from '@/design-system/charts';
import { Banner, Button, Card, ErrorState, Field, LoadingList, Row, Screen, Stat, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINRCompact } from '@/lib/money';
import { errorMessage } from '@/lib/queries';
import { AdminControls } from '@/components/AdminControls';

export default function Admin() {
  const t = useTheme();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const m = useQuery({ queryKey: ['admin', 'metrics'], queryFn: api.adminMetrics, enabled: !!profile?.is_admin });
  const regs = useQuery({ queryKey: ['admin', 'registries', search], queryFn: () => api.adminRegistries(search), enabled: !!profile?.is_admin });

  if (!profile?.is_admin) return <Screen><Banner tone="negative" title="Admins only." /></Screen>;
  if (m.isLoading) return <Screen><LoadingList /></Screen>;
  if (m.error) return <Screen><ErrorState message={errorMessage(m.error)} onRetry={m.refetch} /></Screen>;
  const x = m.data!.totals;
  return (
    <Screen>
      <Text variant="title">Platform</Text>
      <Row wrap gap={t.space.md}>
        <Stat label="Users" value={String(x.users)} sub={`+${x.new_users_7d} this week`} />
        <Stat label="Active couples" value={String(x.active_couples)} />
        <Stat label="Published" value={String(x.published_registries)} sub={`${x.premium_registries} premium`} />
        <Stat label="Gifts confirmed" value={String(x.confirmed_gifts)} sub={formatINRCompact(x.confirmed_paise)} />
        <Stat label="Premium revenue" value={formatINRCompact(x.premium_revenue_paise)} />
      </Row>
      <Card>
        <Text variant="heading">Gift states</Text>
        <Donut slices={m.data!.contribution_states.map((s, i) => ({ label: s.status, value: s.n, color: t.chart[i % t.chart.length] }))} />
      </Card>
      <Card>
        <Text variant="heading">Weekly sign-ups</Text>
        {m.data!.weekly_signups.map((w) => <Row key={w.week} style={{ justifyContent: 'space-between' }}><Text variant="caption">{w.week}</Text><Text variant="label">{w.n}</Text></Row>)}
      </Card>
      <AdminControls />
      <Field label="Search registries" value={search} onChangeText={setSearch} placeholder="slug, names or username" autoCapitalize="none" />
      {regs.data?.items.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{r.partner_one} & {r.partner_two}</Text>
              <Text variant="caption" muted>/{r.slug} · @{r.owner_username} · {r.status} · {r.plan}{r.moderation === 'hidden' ? ' · HIDDEN' : ''}</Text>
            </View>
            <Button title={r.moderation === 'hidden' ? 'Unhide' : 'Hide'} kind={r.moderation === 'hidden' ? 'secondary' : 'danger'} full={false}
              onPress={async () => { await api.moderate(r.id, r.moderation === 'hidden' ? 'unhide' : 'hide'); qc.invalidateQueries({ queryKey: ['admin'] }); }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
