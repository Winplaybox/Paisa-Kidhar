import { FlashList } from '@shopify/flash-list';
import { useDeferredValue, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TxRow } from '@/components/TxRow';
import { Empty, Input, Row, Skeleton, T } from '@/components/ui';
import { useSearchTxns } from '@/data/queries';
import { dayKey, type Txn } from '@/lib/budget';
import { fmtDay, inr } from '@/lib/format';
import { AdBanner } from '@/providers/ads';
import { space, useTheme } from '@/theme/tokens';

type Item = { type: 'header'; key: string; label: string; total: number } | { type: 'tx'; key: string; tx: Txn };

export default function History() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const res = useSearchTxns(dq);

  const items: Item[] = (() => {
    const list = res.data ?? [];
    const totals = new Map<string, number>();
    list.forEach((x) => { const k = dayKey(new Date(x.occurred_at)); totals.set(k, (totals.get(k) ?? 0) + x.amount); });
    const out: Item[] = [];
    let last = '';
    for (const x of list) {
      const k = dayKey(new Date(x.occurred_at));
      if (k !== last) { last = k; out.push({ type: 'header', key: `h-${k}`, label: fmtDay(new Date(x.occurred_at)), total: totals.get(k) ?? 0 }); }
      out.push({ type: 'tx', key: x.id, tx: x });
    }
    return out;
  })();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <T v="h1" style={{ marginBottom: space.md }}>History</T>
        <Input value={q} onChangeText={setQ} placeholder="🔍  Merchant ya note search karo…" returnKeyType="search" autoCorrect={false} />
      </View>
      {res.isLoading ? (
        <View style={{ padding: space.lg, gap: 12 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={44} />)}</View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.type}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={res.isRefetching} onRefresh={() => { res.refetch(); }} tintColor={t.accent} />}
          ListEmptyComponent={<Empty emoji="🧾" title={q ? 'Kuch nahi mila' : 'Abhi tak koi kharcha nahi'} body={q ? 'Doosra word try karo' : '+ dabake pehla kharcha add karo'} />}
          ListFooterComponent={items.length ? <><T v="caption" muted center style={{ marginTop: space.lg }}>Latest 300 entries · purane ke liye search karo</T><AdBanner /></> : null}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: 2 }}>
                <T v="label" muted>{item.label}</T>
                <T v="caption" muted style={{ fontFamily: 'Inter_600SemiBold' }}>{inr(item.total)}</T>
              </Row>
            ) : (
              <TxRow tx={item.tx} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
