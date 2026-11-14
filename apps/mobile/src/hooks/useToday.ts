import { useEffect } from 'react';

import { useDailyTotals, useMonthTxns, useProfile } from '@/data/queries';
import { addDays, dayBudget, dayKey, monthKey, spentOn, streak, totalsByDay, type Txn } from '@/lib/budget';
import { planNotifications } from '@/lib/notifications';

const EMPTY: Txn[] = [];

/** Everything the Today screen + notifications need. (React Compiler memoizes the derivation.) */
export function useToday() {
  const now = new Date();
  const mk = monthKey(now);
  const profile = useProfile();
  const month = useMonthTxns(mk);
  const yesterday = addDays(now, -1);
  const prevMonth = useMonthTxns(monthKey(yesterday)); // same query as `month` except on the 1st
  const daily = useDailyTotals(120);

  const p = profile.data ?? null;
  const txns = month.data ?? EMPTY;

  const derived = (() => {
    if (!p) return null;
    const budget = dayBudget(p, txns, now);
    const spent = spentOn(txns, now);
    const today: Txn[] = txns.filter((t) => dayKey(new Date(t.occurred_at)) === dayKey(now));
    const monthSpent = txns.reduce((a, t) => a + t.amount, 0);
    const paceBudget = budget.base * now.getDate();
    const ySpent = spentOn(prevMonth.data ?? [], yesterday);
    const dmap = new Map(daily.data ?? []);
    // overlay fresh month data so streak reacts instantly to edits
    totalsByDay(txns).forEach((v, k) => dmap.set(k, v));
    return {
      budget, spent, left: budget.total - spent, over: spent > budget.total, today,
      monthSpent, pace: paceBudget - monthSpent, yesterdaySpent: ySpent,
      streak: streak(p, dmap, now),
    };
  })();

  // Keep tonight's report notification in sync with real numbers.
  useEffect(() => {
    if (p && month.isSuccess) planNotifications(p, txns).catch(() => undefined);
  }, [p, txns, month.isSuccess]);

  return {
    profile: p,
    loading: profile.isLoading || month.isLoading,
    error: month.error ?? profile.error,
    refetch: () => Promise.all([month.refetch(), daily.refetch(), prevMonth.refetch()]),
    refreshing: month.isRefetching,
    d: derived,
  };
}
