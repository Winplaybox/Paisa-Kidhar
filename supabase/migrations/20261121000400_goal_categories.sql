-- Goal categories become data, not a hard-coded CHECK list:
--   * paisa.categories: catalog that admins can extend (no deploy needed)
--   * goals.custom_category: couple's own label when none fits (category = 'other')
create table if not exists paisa.categories (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label      text not null check (char_length(label) between 2 and 40),
  icon       text not null default 'heart-outline' check (char_length(icon) <= 60),
  position   int  not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table paisa.categories enable row level security;
alter table paisa.categories force row level security;
drop policy if exists categories_api_read on paisa.categories;
create policy categories_api_read on paisa.categories for select to paisa_api using (true);
grant select on paisa.categories to paisa_api;

insert into paisa.categories(key, label, icon, position) values
  ('honeymoon','Honeymoon','airplane-outline',10),
  ('home','First home','home-outline',20),
  ('furniture','Furniture & decor','bed-outline',30),
  ('kitchen','Kitchen & appliances','restaurant-outline',40),
  ('electronics','Electronics','tv-outline',50),
  ('vehicle','Car / bike','car-outline',60),
  ('travel','Travel','map-outline',70),
  ('experience','Experience','sparkles-outline',80),
  ('jewellery','Jewellery','diamond-outline',90),
  ('wedding_costs','Wedding expenses','flower-outline',100),
  ('pilgrimage','Pilgrimage / teerth yatra','compass-outline',110),
  ('education','Education & courses','school-outline',120),
  ('business','Start a business','briefcase-outline',130),
  ('pets','Pets','paw-outline',140),
  ('charity','Charity / daan','hand-left-outline',150),
  ('item','Something we need','gift-outline',160),
  ('savings','Savings','wallet-outline',170),
  ('other','Other','heart-outline',999)
on conflict (key) do nothing;

alter table paisa.goals drop constraint if exists goals_category_check;
alter table paisa.goals add column if not exists custom_category text
  check (custom_category is null or char_length(btrim(custom_category)) between 2 and 40);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'goals_category_fk') then
    alter table paisa.goals add constraint goals_category_fk foreign key (category) references paisa.categories(key) on update cascade;
  end if;
end $$;
