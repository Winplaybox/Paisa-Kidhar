-- Paisa Kidhar — isolated schema inside the shared WinPlayBox Supabase project.
-- Nothing in `public` or any other existing schema is touched.
-- The schema is NOT exposed through PostgREST: only the FastAPI backend (role paisa_api) reads/writes it.
-- RLS is enabled on every table (default deny) with policies only for paisa_api.

create schema if not exists paisa;
revoke all on schema paisa from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'paisa_api') then
    create role paisa_api nologin;  -- owner enables login + password manually (see docs/DEPLOY.md)
  end if;
end $$;
grant usage on schema paisa to paisa_api;

-- ---------- helpers ----------
create or replace function paisa.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles ----------
create table paisa.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  email        text,
  display_name text not null default '' check (char_length(display_name) <= 80),
  locale       text not null default 'en-IN' check (char_length(locale) <= 10),
  deletion_requested_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);
create unique index profiles_username_uq on paisa.profiles (username);
create unique index profiles_email_uq on paisa.profiles (lower(email)) where email is not null;
create trigger profiles_touch before update on paisa.profiles for each row execute function paisa.touch_updated_at();

-- ---------- trusted roles ----------
create table paisa.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------- registries ----------
create table paisa.registries (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  slug           text not null,
  partner_one    text not null check (char_length(partner_one) between 1 and 60),
  partner_two    text not null check (char_length(partner_two) between 1 and 60),
  wedding_date   date,
  city           text check (char_length(city) <= 60),
  story          text not null default '' check (char_length(story) <= 1200),
  upi_vpa        text check (upi_vpa ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$'),
  upi_payee_name text check (char_length(upi_payee_name) <= 60),
  status         text not null default 'draft' check (status in ('draft','published','paused','archived')),
  plan           text not null default 'free' check (plan in ('free','premium')),
  premium_since  timestamptz,
  theme          text not null default 'rose' check (theme in ('rose','plum','marigold','emerald','ink')),
  show_progress  boolean not null default true,
  moderation     text not null default 'ok' check (moderation in ('ok','hidden')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  constraint publish_needs_upi check (status <> 'published' or upi_vpa is not null)
);
create unique index registries_slug_uq on paisa.registries (slug);
create index registries_owner_idx on paisa.registries (owner_id);
create trigger registries_touch before update on paisa.registries for each row execute function paisa.touch_updated_at();

-- ---------- goals ----------
create table paisa.goals (
  id           uuid primary key default gen_random_uuid(),
  registry_id  uuid not null references paisa.registries(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  description  text not null default '' check (char_length(description) <= 600),
  category     text not null default 'other' check (category in ('honeymoon','home','travel','experience','item','savings','other')),
  target_paise bigint not null check (target_paise between 10000 and 10000000000), -- ₹100 .. ₹10 crore
  position     int not null default 0,
  status       text not null default 'active' check (status in ('active','paused','archived','completed')),
  visibility   text not null default 'public' check (visibility in ('public','private')),
  target_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index goals_registry_idx on paisa.goals (registry_id, position);
create trigger goals_touch before update on paisa.goals for each row execute function paisa.touch_updated_at();

-- ---------- contributions (direct-UPI pledges; couple confirmation is authoritative) ----------
create table paisa.contributions (
  id               uuid primary key default gen_random_uuid(),
  registry_id      uuid not null references paisa.registries(id) on delete cascade,
  goal_id          uuid not null references paisa.goals(id) on delete cascade,
  reference        text not null check (reference ~ '^PK[A-Z0-9]{8}$'),
  amount_paise     bigint not null check (amount_paise between 100 and 50000000), -- ₹1 .. ₹5 lakh
  currency         char(3) not null default 'INR' check (currency = 'INR'),
  guest_name       text check (char_length(guest_name) <= 60),
  guest_message    text check (char_length(guest_message) <= 280),
  is_anonymous     boolean not null default false,
  status           text not null default 'pledged'
                   check (status in ('pledged','guest_marked_paid','confirmed','rejected','expired')),
  idempotency_key  text not null check (char_length(idempotency_key) between 8 and 80),
  client_ip_hash   text,
  created_at       timestamptz not null default now(),
  marked_paid_at   timestamptz,
  decided_at       timestamptz,
  decided_by       uuid references auth.users(id)
);
create unique index contributions_reference_uq on paisa.contributions (reference);
create unique index contributions_idem_uq on paisa.contributions (registry_id, idempotency_key);
create index contributions_registry_idx on paisa.contributions (registry_id, created_at desc);
create index contributions_goal_status_idx on paisa.contributions (goal_id, status);

-- ---------- premium orders (Dodo Payments — digital product sold by the platform to the couple) ----------
create table paisa.orders (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  registry_id         uuid not null references paisa.registries(id) on delete cascade,
  plan_code           text not null check (plan_code in ('premium_registry')),
  amount_paise        bigint not null check (amount_paise > 0),
  currency            char(3) not null default 'INR',
  provider            text not null default 'dodo' check (provider = 'dodo'),
  provider_session_id text,
  provider_payment_id text,
  status              text not null default 'created' check (status in ('created','succeeded','failed','refunded','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index orders_session_uq on paisa.orders (provider_session_id) where provider_session_id is not null;
create unique index orders_payment_uq on paisa.orders (provider_payment_id) where provider_payment_id is not null;
create index orders_owner_idx on paisa.orders (owner_id, created_at desc);
create trigger orders_touch before update on paisa.orders for each row execute function paisa.touch_updated_at();

create table paisa.payment_events (
  id             bigint generated always as identity primary key,
  provider       text not null,
  event_id       text not null,
  event_type     text not null,
  payload_sha256 text not null,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  unique (provider, event_id)
);

-- ---------- audit + analytics ----------
create table paisa.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on paisa.audit_logs (created_at desc);

create table paisa.app_events (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  name       text not null check (name ~ '^[a-z_]{2,40}$'),
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index app_events_created_idx on paisa.app_events (created_at desc);

-- audit log is append-only even for the API role
create or replace function paisa.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'append-only table'; end $$;
create trigger audit_logs_append_only before update or delete on paisa.audit_logs
  for each row execute function paisa.forbid_mutation();

-- ---------- RLS: default deny; only the backend role gets access ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','user_roles','registries','goals','contributions','orders',
                           'payment_events','audit_logs','app_events'] loop
    execute format('alter table paisa.%I enable row level security', t);
    execute format('alter table paisa.%I force row level security', t);
    execute format('create policy %I on paisa.%I for all to paisa_api using (true) with check (true)',
                   t || '_api_all', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema paisa to paisa_api;
revoke update, delete on paisa.audit_logs from paisa_api;
revoke insert, update, delete on paisa.user_roles from paisa_api;  -- admin roles granted only via SQL editor
grant usage on all sequences in schema paisa to paisa_api;
grant execute on all functions in schema paisa to paisa_api;
revoke execute on all functions in schema paisa from public, anon, authenticated;
