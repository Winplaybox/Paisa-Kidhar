import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfettiBurst } from '@/design-system/Anim';
import { ShareCard } from '@/components/ShareCard';
import { Banner, Button, Card, EmptyState, ErrorState, IconButton, LoadingList, ProgressBar, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, type Goal } from '@/lib/api';
import { CATEGORY_ICON } from '@/lib/categories';
import { formatINR } from '@/lib/money';
import { errorMessage, usePublish } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';
import { useQueryClient } from '@tanstack/react-query';

export default function Goals() {
  const t = useTheme();
  const cur = useCurrentRegistry();
  const qc = useQueryClient();
  const publish = usePublish(cur.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  if (cur.isLoading) return <Screen edges={['top']}><LoadingList /></Screen>;
  if (cur.error) return <Screen edges={['top']}><ErrorState message={errorMessage(cur.error)} onRetry={cur.refetch} /></Screen>;
  if (!cur.registry) {
    return <Screen edges={['top']}><EmptyState icon="gift-outline" title="No registry yet" body="Create one in under two minutes."
      action={<Button title="Create my registry" kind="accent" full={false} onPress={() => router.push('/registry/setup')} />} /></Screen>;
  }
  const r = cur.registry;
  const goals = r.goals.filter((g) => g.status !== 'archived');
  const atLimit = goals.length >= r.goal_limit;

  const move = async (g: Goal, dir: -1 | 1) => {
    const ids = goals.map((x) => x.id);
    const i = ids.indexOf(g.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.reorderGoals(r.id, ids);
    qc.invalidateQueries({ queryKey: ['registry'] });
  };

  return (
    <Screen edges={['top']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">My Registry</Text>
          <Text muted>{r.status === 'published' ? 'Live — guests can see it' : r.status === 'paused' ? 'Paused' : 'Draft — only you can see it'}</Text>
        </View>
        <IconButton icon="create-outline" label="Edit registry details" onPress={() => router.push({ pathname: '/registry/setup', params: { id: r.id } })} />
      </Row>

      {!r.upi_vpa ? <Banner tone="warning" title="Add your UPI ID" body="Gifts go straight to your UPI. Add it in registry details before publishing." /> : null}
      {err ? <Banner tone="negative" title={err} /> : null}

      <Row gap={t.space.sm} wrap>
        {r.status === 'published' ? (
          <Button title="Pause registry" kind="secondary" icon="pause" full={false} loading={publish.isPending}
            onPress={() => publish.mutate(false, { onError: (e) => setErr(errorMessage(e)) })} />
        ) : (
          <Button title="Publish registry" kind="accent" icon="rocket-outline" full={false} loading={publish.isPending}
            onPress={() => { setErr(null); publish.mutate(true, { onSuccess: () => setCelebrate((n) => n + 1), onError: (e) => setErr(errorMessage(e)) }); }} />
        )}
        <Button title="Preview" kind="secondary" icon="eye-outline" full={false} onPress={() => router.push(`/r/${r.slug}?preview=1`)} />
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">Goals ({goals.length}/{r.goal_limit})</Text>
        <Button title="Add goal" kind={atLimit ? 'secondary' : 'primary'} icon="add" full={false}
          onPress={() => (atLimit && r.plan !== 'premium' ? router.push('/premium') : router.push({ pathname: '/goal/[id]', params: { id: 'new', registry: r.id } }))} />
      </Row>

      {goals.length === 0 ? (
        <EmptyState animated icon="airplane-outline" title="Add your first dream" body="Honeymoon in Bali, first-home savings, a new sofa… Guests love choosing what to fund." />
      ) : goals.map((g, idx) => {
        const p = g.target_paise ? g.raised_paise / g.target_paise : 0;
        return (
          <Card key={g.id} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id, registry: r.id } })} accessibilityLabel={`Edit ${g.title}`}>
            <Row>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={CATEGORY_ICON[g.category]} size={20} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>{g.title}</Text>
                <Text variant="caption" muted>
                  {g.visibility === 'private' ? 'Private · ' : ''}{g.status === 'completed' ? 'Fully funded 🎉 · ' : g.status === 'paused' ? 'Paused · ' : ''}
                  {g.contributions_count} gift{g.contributions_count === 1 ? '' : 's'}{g.pending_count ? ` · ${g.pending_count} to confirm` : ''}
                </Text>
              </View>
              <IconButton icon="chevron-up" label="Move up" onPress={() => move(g, -1)} color={idx === 0 ? t.colors.border : undefined} />
              <IconButton icon="chevron-down" label="Move down" onPress={() => move(g, 1)} color={idx === goals.length - 1 ? t.colors.border : undefined} />
            </Row>
            <ProgressBar value={p} label={`${g.title} progress`} />
            <Text variant="caption" muted>{formatINR(g.raised_paise)} of {formatINR(g.target_paise)}</Text>
          </Card>
        );
      })}

      {r.status === 'published' ? <ShareCard registry={r} /> : null}
      {celebrate ? <ConfettiBurst key={celebrate} show /> : null}
    </Screen>
  );
}
