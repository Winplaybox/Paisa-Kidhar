-- Paisa Kidhar: core schema. All tables prefixed pk_ (shared Supabase project).
create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.pk_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 40),
  monthly_income numeric(12,2) not null check (monthly_income > 0 and monthly_income < 1e10),
  fixed_costs   numeric(12,2) not null default 0 check (fixed_costs >= 0 and fixed_costs < 1e10),
  budget_mode   text not null default 'full' check (budget_mode in ('full','after_fixed')),
  rollover      boolean not null default false,
  report_hour   smallint not null default 21 check (report_hour between 0 and 23),
  morning_hour  smallint not null default 8  check (morning_hour between 0 and 23),
  notifications boolean not null default true,
  timezone      text not null default 'Asia/Kolkata' check (char_length(timezone) <= 64),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- transactions ----------
create table if not exists public.pk_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0 and amount < 1e10),
  category     text not null default 'other'
               check (category in ('food','grocery','shopping','subs','travel','bills','health','fun','upi','other')),
  merchant     text not null check (char_length(merchant) between 1 and 60),
  note         text check (char_length(note) <= 140),
  occurred_at  timestamptz not null default now(),
  source       text not null default 'manual' check (source in ('manual','sms','csv','pdf','demo')),
  dedupe_key   text check (char_length(dedupe_key) <= 128),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists pk_tx_user_time_idx on public.pk_transactions (user_id, occurred_at desc);
create unique index if not exists pk_tx_dedupe_uidx on public.pk_transactions (user_id, dedupe_key) where dedupe_key is not null;

-- ---------- updated_at trigger ----------
create or replace function public.pk_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists pk_profiles_touch on public.pk_profiles;
create trigger pk_profiles_touch before update on public.pk_profiles
  for each row execute function public.pk_touch_updated_at();
drop trigger if exists pk_tx_touch on public.pk_transactions;
create trigger pk_tx_touch before update on public.pk_transactions
  for each row execute function public.pk_touch_updated_at();

-- ---------- RLS ----------
alter table public.pk_profiles enable row level security;
alter table public.pk_transactions enable row level security;

drop policy if exists pk_profiles_select on public.pk_profiles;
drop policy if exists pk_profiles_insert on public.pk_profiles;
drop policy if exists pk_profiles_update on public.pk_profiles;
drop policy if exists pk_profiles_delete on public.pk_profiles;
create policy pk_profiles_select on public.pk_profiles for select to authenticated using ((select auth.uid()) = id);
create policy pk_profiles_insert on public.pk_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy pk_profiles_update on public.pk_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy pk_profiles_delete on public.pk_profiles for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists pk_tx_select on public.pk_transactions;
drop policy if exists pk_tx_insert on public.pk_transactions;
drop policy if exists pk_tx_update on public.pk_transactions;
drop policy if exists pk_tx_delete on public.pk_transactions;
create policy pk_tx_select on public.pk_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy pk_tx_insert on public.pk_transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pk_tx_update on public.pk_transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pk_tx_delete on public.pk_transactions for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.pk_profiles, public.pk_transactions from anon;
grant select, insert, update, delete on public.pk_profiles, public.pk_transactions to authenticated;

-- ---------- RPC: daily totals (server-side aggregation for long ranges) ----------
create or replace function public.pk_daily_totals(p_from date, p_to date, p_tz text default 'Asia/Kolkata')
returns table(day date, total numeric, txn_count bigint)
language sql stable security invoker set search_path = '' as $$
  select (t.occurred_at at time zone p_tz)::date as day, sum(t.amount), count(*)
  from public.pk_transactions t
  where t.user_id = (select auth.uid())
    and (t.occurred_at at time zone p_tz)::date between p_from and p_to
  group by 1 order by 1;
$$;

-- ---------- RPC: monthly totals by category (last N months) ----------
create or replace function public.pk_monthly_category_totals(p_months int default 6, p_tz text default 'Asia/Kolkata')
returns table(month date, category text, total numeric)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', t.occurred_at at time zone p_tz)::date, t.category, sum(t.amount)
  from public.pk_transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_at >= (date_trunc('month', now() at time zone p_tz) - make_interval(months => greatest(1, least(p_months, 24)) - 1)) at time zone p_tz
  group by 1, 2 order by 1, 2;
$$;

-- ---------- RPC: delete all my Paisa Kidhar data (Play Store data-deletion requirement) ----------
create or replace function public.pk_delete_my_data()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.pk_transactions where user_id = (select auth.uid());
  delete from public.pk_profiles where id = (select auth.uid());
end $$;

revoke execute on function public.pk_daily_totals(date, date, text) from anon, public;
revoke execute on function public.pk_monthly_category_totals(int, text) from anon, public;
revoke execute on function public.pk_delete_my_data() from anon, public;
grant execute on function public.pk_daily_totals(date, date, text) to authenticated;
grant execute on function public.pk_monthly_category_totals(int, text) to authenticated;
grant execute on function public.pk_delete_my_data() to authenticated;
