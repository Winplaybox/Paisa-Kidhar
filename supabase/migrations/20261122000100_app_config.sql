-- Server-driven app config: lets the owner change announcements, flags, legal text, force-update and
-- maintenance mode from the backend, with no Play Store release. One row per key; value is JSON.
create table if not exists paisa.app_config (
  key        text primary key check (key ~ '^[a-z_]{1,40}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table paisa.app_config enable row level security;
alter table paisa.app_config force row level security;
drop policy if exists app_config_api_all on paisa.app_config;
create policy app_config_api_all on paisa.app_config for all to paisa_api using (true) with check (true);
grant select, insert, update on paisa.app_config to paisa_api;

insert into paisa.app_config (key, value) values
  ('announcement', '{"active": false, "id": "none", "level": "info", "text": {"en": ""}, "url": null}'),
  ('maintenance',  '{"on": false, "text": {"en": "We are making Paisa Kidhar better. Please try again shortly."}}'),
  ('min_version',  '{"android": "1.0.0"}'),
  ('flags',        '{"shagun_cards": true, "premium": true, "feedback": true, "ads": true}'),
  ('legal',        '{}')
on conflict (key) do nothing;
