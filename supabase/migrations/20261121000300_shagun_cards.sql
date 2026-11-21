-- Digital Shagun Card: a ₹49 digital greeting card a guest can buy (sold by the platform via Dodo).
-- It never touches the gift money, which still goes guest → couple by direct UPI.
create table paisa.card_orders (
  id                  uuid primary key default gen_random_uuid(),
  contribution_id     uuid not null references paisa.contributions(id) on delete cascade,
  registry_id         uuid not null references paisa.registries(id) on delete cascade,
  design              text not null default 'marigold' check (design in ('marigold','rose','royal','mehendi')),
  amount_paise        bigint not null check (amount_paise > 0),
  currency            char(3) not null default 'INR',
  buyer_email         text not null check (char_length(buyer_email) between 5 and 254),
  provider            text not null default 'dodo' check (provider = 'dodo'),
  provider_session_id text,
  provider_payment_id text,
  status              text not null default 'created' check (status in ('created','succeeded','failed','refunded','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index card_orders_session_uq on paisa.card_orders (provider_session_id) where provider_session_id is not null;
create unique index card_orders_payment_uq on paisa.card_orders (provider_payment_id) where provider_payment_id is not null;
create unique index card_orders_one_paid_per_gift on paisa.card_orders (contribution_id) where status = 'succeeded';
create index card_orders_registry_idx on paisa.card_orders (registry_id, created_at desc);
create trigger card_orders_touch before update on paisa.card_orders for each row execute function paisa.touch_updated_at();

alter table paisa.card_orders enable row level security;
alter table paisa.card_orders force row level security;
create policy card_orders_api_all on paisa.card_orders for all to paisa_api using (true) with check (true);
grant select, insert, update, delete on paisa.card_orders to paisa_api;
