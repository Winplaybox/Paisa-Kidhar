import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { Anim, ConfettiBurst } from '@/design-system/Anim';
import { Banner, Button, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api } from '@/lib/api';

/** Premium is granted only by the verified webhook; this screen just polls the order status. */
export default function BillingReturn() {
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
      {!order ? <Banner tone="warning" title="No order to check." /> :
        status === 'succeeded' ? <><ConfettiBurst show /><Anim name="success" size={140} style={{ alignSelf: 'center' }} /><Text variant="title">You're Premium ✦</Text><Banner tone="positive" title="Payment received. Themes and extra goals are unlocked." /></> :
        status === 'failed' || status === 'cancelled' ? <Banner tone="negative" title="Payment didn't go through" body="You haven't been charged. You can try again any time." /> :
        status === 'created' && (q.data && q.dataUpdatedAt && q.isFetched) ? <><ActivityIndicator color={t.colors.accent} /><Text muted style={{ textAlign: 'center' }}>Confirming your payment… this can take up to a minute for UPI.</Text></> :
        <ActivityIndicator color={t.colors.accent} />}
      <Button title="Go to my registry" kind="secondary" onPress={() => router.replace('/home')} />
    </Screen>
  );
}
