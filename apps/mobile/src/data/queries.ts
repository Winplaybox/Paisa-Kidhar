import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, addMonths, dayKey, fromMonthKey, monthKey, startOfDay, type Profile, type Txn } from '@/lib/budget';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

const TX_COLS = 'id,amount,category,merchant,note,occurred_at,source';

export const qk = {
  profile: (uid?: string) => ['profile', uid] as const,
  month: (uid: string | undefined, mk: string) => ['tx', uid, 'month', mk] as const,
  daily: (uid: string | undefined, from: string, to: string) => ['tx', uid, 'daily', from, to] as const,
  monthlyCats: (uid: string | undefined, n: number) => ['tx', uid, 'mcat', n] as const,
  search: (uid: string | undefined, q: string) => ['tx', uid, 'search', q] as const,
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const normTx = (r: Record<string, unknown>): Txn => ({ ...(r as Txn), amount: Number(r.amount) });

/* ---------------- profile ---------------- */
export function useProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.profile(uid),
    enabled: !!uid,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('pk_profiles').select('*').eq('id', uid!).maybeSingle();
      fail(error);
      if (!data) return null;
      return { ...data, monthly_income: Number(data.monthly_income), fixed_costs: Number(data.fixed_costs) } as Profile;
    },
    staleTime: 5 * 60_000,
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const uid = session!.user.id;
      const { data, error } = await supabase
        .from('pk_profiles')
        .upsert({ id: uid, ...patch }, { onConflict: 'id' })
        .select('*')
        .single();
      fail(error);
      return { ...data, monthly_income: Number(data!.monthly_income), fixed_costs: Number(data!.fixed_costs) } as Profile;
    },
    onSuccess: (p) => qc.setQueryData(qk.profile(p.id), p),
  });
}

/* ---------------- transactions ---------------- */
export function useMonthTxns(mk: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.month(uid, mk),
    enabled: !!uid,
    queryFn: async (): Promise<Txn[]> => {
      const from = fromMonthKey(mk);
      const to = addMonths(from, 1);
      const { data, error } = await supabase
        .from('pk_transactions')
        .select(TX_COLS)
        .gte('occurred_at', from.toISOString())
        .lt('occurred_at', to.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(5000);
      fail(error);
      return (data ?? []).map(normTx);
    },
  });
}

/** Per-day totals for a date range (server aggregated) — streaks, weekday charts. */
export function useDailyTotals(days: number) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const to = startOfDay(new Date());
  const from = addDays(to, -days);
  const f = dayKey(from), t = dayKey(to);
  return useQuery({
    queryKey: qk.daily(uid, f, t),
    enabled: !!uid,
    queryFn: async (): Promise<Map<string, number>> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const { data, error } = await supabase.rpc('pk_daily_totals', { p_from: f, p_to: t, p_tz: tz });
      fail(error);
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { day: string; total: number }[]) m.set(r.day, Number(r.total));
      return m;
    },
  });
}

export function useMonthlyCategoryTotals(months = 6) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.monthlyCats(uid, months),
    enabled: !!uid,
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const { data, error } = await supabase.rpc('pk_monthly_category_totals', { p_months: months, p_tz: tz });
      fail(error);
      return ((data ?? []) as { month: string; category: string; total: number }[]).map((r) => ({
        month: r.month.slice(0, 7), category: r.category, total: Number(r.total),
      }));
    },
  });
}

export function useSearchTxns(q: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const term = q.trim();
  return useQuery({
    queryKey: qk.search(uid, term),
    enabled: !!uid,
    queryFn: async (): Promise<Txn[]> => {
      let req = supabase.from('pk_transactions').select(TX_COLS).order('occurred_at', { ascending: false }).limit(300);
      if (term) {
        const safe = term.replace(/[%_,()]/g, ' ');
        req = req.or(`merchant.ilike.%${safe}%,note.ilike.%${safe}%`);
      }
      const { data, error } = await req;
      fail(error);
      return (data ?? []).map(normTx);
    },
    placeholderData: (prev) => prev,
  });
}

export type NewTxn = {
  amount: number;
  category: string;
  merchant: string;
  note?: string | null;
  occurred_at: string;
  source?: 'manual' | 'sms' | 'csv' | 'pdf' | 'demo';
  dedupe_key?: string | null;
};

function invalidateTx(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['tx'] });
}

/** Optimistic insert into the month cache so the ring animates instantly. */
export function useAddTxns() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (rows: NewTxn[]) => {
      if (!rows.length) return { inserted: 0 };
      const withKeys = rows.filter((r) => r.dedupe_key);
      const plain = rows.filter((r) => !r.dedupe_key);
      let inserted = 0;
      if (plain.length) {
        const { error, count } = await supabase.from('pk_transactions').insert(plain, { count: 'exact' });
        fail(error);
        inserted += count ?? plain.length;
      }
      if (withKeys.length) {
        const { data, error } = await supabase
          .from('pk_transactions')
          .upsert(withKeys, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
          .select('id');
        if (error?.code === '42P10') {
          // DB missing the (user_id, dedupe_key) constraint — degrade to plain insert rather than fail the import.
          const r = await supabase.from('pk_transactions').insert(withKeys.map(({ dedupe_key: _k, ...x }) => x), { count: 'exact' });
          fail(r.error);
          inserted += r.count ?? withKeys.length;
        } else {
          fail(error);
          inserted += data?.length ?? 0;
        }
      }
      return { inserted };
    },
    onMutate: async (rows) => {
      const touched = new Map<string, Txn[]>();
      for (const r of rows) {
        const mk = monthKey(new Date(r.occurred_at));
        const key = qk.month(uid, mk);
        await qc.cancelQueries({ queryKey: key });
        const prev = qc.getQueryData<Txn[]>(key);
        if (!prev) continue;
        if (!touched.has(mk)) touched.set(mk, prev);
        const optimistic: Txn = {
          id: `tmp-${Math.random().toString(36).slice(2)}`, amount: r.amount, category: r.category,
          merchant: r.merchant, note: r.note ?? null, occurred_at: r.occurred_at, source: r.source ?? 'manual',
        };
        qc.setQueryData<Txn[]>(key, (old) =>
          [optimistic, ...(old ?? [])].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)));
      }
      return { touched };
    },
    onError: (_e, _v, ctx) => {
      ctx?.touched.forEach((prev, mk) => qc.setQueryData(qk.month(uid, mk), prev));
    },
    onSettled: () => invalidateTx(qc),
  });
}

export function useUpdateTxn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewTxn> }) => {
      const { error } = await supabase.from('pk_transactions').update(patch).eq('id', id);
      fail(error);
    },
    onSettled: () => invalidateTx(qc),
  });
}

export function useDeleteTxn() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pk_transactions').delete().eq('id', id);
      fail(error);
    },
    onMutate: async (id) => {
      const snaps = qc.getQueriesData<Txn[]>({ queryKey: ['tx', uid, 'month'] });
      snaps.forEach(([key, data]) => data && qc.setQueryData(key, data.filter((t) => t.id !== id)));
      return { snaps };
    },
    onError: (_e, _v, ctx) => ctx?.snaps.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => invalidateTx(qc),
  });
}

export function useDeleteDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase.from('pk_transactions').delete({ count: 'exact' }).eq('source', 'demo');
      fail(error);
      return count ?? 0;
    },
    onSettled: () => invalidateTx(qc),
  });
}

export function useDeleteAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pk_delete_my_data');
      fail(error);
    },
    onSuccess: () => qc.clear(),
  });
}

export async function fetchAllForExport(): Promise<Txn[]> {
  const out: Txn[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from('pk_transactions').select(TX_COLS).order('occurred_at', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    fail(error);
    out.push(...(data ?? []).map(normTx));
    if (!data || data.length < 1000) break;
  }
  return out;
}
