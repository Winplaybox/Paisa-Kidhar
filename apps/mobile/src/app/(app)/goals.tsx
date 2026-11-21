import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfettiBurst } from '@/design-system/Anim';
import { showInterstitial } from '@/lib/ads';
import { ShareCard } from '@/components/ShareCard';
import { Banner, Button, Card, EmptyState, ErrorState, IconButton, LoadingList, ProgressBar, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api, type Goal } from '@/lib/api';
import { categoryIcon, useCategories } from '@/lib/categories';
import { formatINR } from '@/lib/money';
import { errorMessage, usePublish } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';
import { useQueryClient } from '@tanstack/react-query';

export default function Goals() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const cats = useCategories();
  const cur = useCurrentRegistry();
  const qc = useQueryClient();
  const publish = usePublish(cur.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  if (cur.isLoading) return <Screen edges={['top']}><LoadingList /></Screen>;
  if (cur.error) return <Screen edges={['top']}><ErrorState message={errorMessage(cur.error)} onRetry={cur.refetch} /></Screen>;
  if (!cur.registry) {
    return <Screen edges={['top']}><EmptyState icon="gift-outline" title={tx('gl_no_reg_t')} body={tx('gl_no_reg_b')}
      action={<Button title={tx('hm_create_btn')} kind="accent" full={false} onPress={() => router.push('/registry/setup')} />} /></Screen>;
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
    <View style={{ flex: 1 }}>
    <Screen edges={['top']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{tx('gl_title')}</Text>
          <Text muted>{r.status === 'published' ? tx('gl_live') : r.status === 'paused' ? tx('gl_paused') : tx('gl_draft')}</Text>
        </View>
        <IconButton icon="create-outline" label={tx('gl_edit_details')} onPress={() => router.push({ pathname: '/registry/setup', params: { id: r.id } })} />
      </Row>

      {!r.upi_vpa ? <Banner tone="warning" title={tx('gl_add_upi')} body={tx('gl_add_upi_b')} /> : null}
      {err ? <Banner tone="negative" title={err} /> : null}

      <Row gap={t.space.sm} wrap>
        {r.status === 'published' ? (
          <Button title={tx('gl_pause')} kind="secondary" icon="pause" full={false} loading={publish.isPending}
            onPress={() => publish.mutate(false, { onError: (e) => setErr(errorMessage(e)) })} />
        ) : (
          <Button title={tx('gl_publish')} kind="accent" icon="rocket-outline" full={false} loading={publish.isPending}
            onPress={() => { setErr(null); publish.mutate(true, { onSuccess: () => { setCelebrate((n) => n + 1); setTimeout(() => showInterstitial({ premium: r.plan === 'premium' }), 3500); }, onError: (e) => setErr(errorMessage(e)) }); }} />
        )}
        <Button title={tx('gl_preview')} kind="secondary" icon="eye-outline" full={false} onPress={() => router.push(`/r/${r.slug}?preview=1`)} />
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{tx('gl_goals', { n: goals.length, max: r.goal_limit })}</Text>
        <Button title={tx('gl_add_goal')} kind={atLimit ? 'secondary' : 'primary'} icon="add" full={false}
          onPress={() => (atLimit && r.plan !== 'premium' ? router.push('/premium') : router.push({ pathname: '/goal/[id]', params: { id: 'new', registry: r.id } }))} />
      </Row>

      {goals.length === 0 ? (
        <EmptyState animated icon="airplane-outline" title={tx('gl_none_t')} body={tx('gl_none_b')} />
      ) : goals.map((g, idx) => {
        const p = g.target_paise ? g.raised_paise / g.target_paise : 0;
        return (
          <Card key={g.id} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id, registry: r.id } })} accessibilityLabel={tx('gl_edit_g', { title: g.title })}>
            <Row>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={categoryIcon(cats, g.category)} size={20} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>{g.title}</Text>
                <Text variant="caption" muted>
                  {g.visibility === 'private' ? tx('gl_private') : ''}{g.status === 'completed' ? tx('gl_funded') : g.status === 'paused' ? `${tx('gl_paused')} · ` : ''}
                  {tx(g.contributions_count === 1 ? 'gl_gift_one' : 'gl_gift_many', { n: g.contributions_count })}{g.pending_count ? ` · ${tx('gl_to_confirm', { n: g.pending_count })}` : ''}
                </Text>
              </View>
              <IconButton icon="chevron-up" label={tx('gl_up')} onPress={() => move(g, -1)} color={idx === 0 ? t.colors.border : undefined} />
              <IconButton icon="chevron-down" label={tx('gl_down')} onPress={() => move(g, 1)} color={idx === goals.length - 1 ? t.colors.border : undefined} />
            </Row>
            <ProgressBar value={p} label={tx('gl_progress', { title: g.title })} />
            <Text variant="caption" muted>{tx('gl_of', { a: formatINR(g.raised_paise), b: formatINR(g.target_paise) })}</Text>
          </Card>
        );
      })}

      {r.status === 'published' ? <ShareCard registry={r} /> : null}
    </Screen>
    {celebrate ? <ConfettiBurst key={celebrate} show /> : null}
    </View>
  );
}
