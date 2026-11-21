import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { Anim, ConfettiBurst } from '@/design-system/Anim';
import { Banner, Button, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';

/** Premium is granted only by the verified webhook; this screen just polls the order status. */
export default function BillingReturn() {
  const { t: tx } = useI18n();
  const t = useTheme();
  const qc = useQueryClient();
  const { order } = useLocalSearchParams<{ order?: string }>();
  const q = useQuery({
    queryKey: ['order', order], queryFn: () => api.order(order!), enabled: !!order,
    refetchInterval: (query) => (query.state.data?.status === 'created' && query.state.dataUpdateCount < 30 ? 2000 : false),
  });
  const status = q.data?.status;
  useEffect(() => { if (status === 'succeeded') qc.invalidateQueries({ queryKey: ['registry'] }); }, [status, qc]);

  return (
    <Screen>
      {!order ? <Banner tone="warning" title={tx('br_none')} /> :
        status === 'succeeded' ? <><ConfettiBurst show /><Anim name="success" size={140} style={{ alignSelf: 'center' }} /><Text variant="title">{tx('br_ok_t')}</Text><Banner tone="positive" title={tx('br_ok_b')} /></> :
        status === 'failed' || status === 'cancelled' ? <Banner tone="negative" title={tx('br_fail_t')} body={tx('br_fail_b')} /> :
        status === 'created' && (q.data && q.dataUpdatedAt && q.isFetched) ? <><ActivityIndicator color={t.colors.accent} /><Text muted style={{ textAlign: 'center' }}>{tx('br_wait')}</Text></> :
        <ActivityIndicator color={t.colors.accent} />}
      <Button title={tx('br_go')} kind="secondary" onPress={() => router.replace('/home')} />
    </Screen>
  );
}
