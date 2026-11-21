-- In-app rating & feedback from the Settings screen. Written only by the API (paisa_api); never exposed to clients.
create table paisa.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  rating      smallint not null check (rating between 1 and 5),
  message     text check (message is null or char_length(message) <= 1000),
  email       text check (email is null or char_length(email) <= 254),
  app_version text check (app_version is null or char_length(app_version) <= 20),
  platform    text check (platform is null or platform in ('android','ios','web')),
  lang        text check (lang is null or lang in ('en','hi','gu','mr')),
  created_at  timestamptz not null default now()
);
create index app_feedback_created_idx on paisa.app_feedback (created_at desc);
alter table paisa.app_feedback enable row level security;
alter table paisa.app_feedback force row level security;
create policy app_feedback_api_all on paisa.app_feedback for all to paisa_api using (true) with check (true);
grant select, insert on paisa.app_feedback to paisa_api;
