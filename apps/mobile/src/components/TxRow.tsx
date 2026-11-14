import { router } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { T, Tap } from '@/components/ui';
import type { Txn } from '@/lib/budget';
import { cat } from '@/lib/categories';
import { fmtTime, inr } from '@/lib/format';
import { radius, space, useTheme } from '@/theme/tokens';

export const TxRow = memo(function TxRow({ tx, showDate }: { tx: Txn; showDate?: boolean }) {
  const t = useTheme();
  const c = cat(tx.category);
  const d = new Date(tx.occurred_at);
  const pending = tx.id.startsWith('tmp-');
  const when = showDate ? `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ` : '';
  return (
    <Tap
      scaleTo={0.98}
      disabled={pending}
      onPress={() => router.push({ pathname: '/add', params: { id: tx.id } })}
      accessibilityLabel={`${tx.merchant}, ${inr(tx.amount)}, ${c.name}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11, opacity: pending ? 0.6 : 1 }}
    >
      <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: c.color + '24', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 19 }}>{c.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyStrong" numberOfLines={1}>{tx.merchant}</T>
        <T v="caption" muted numberOfLines={1}>
          {when}{fmtTime(d)} · {c.name}{tx.note ? ` · ${tx.note}` : ''}
        </T>
      </View>
      <T v="num" color={t.danger}>−{inr(tx.amount)}</T>
    </Tap>
  );
});
