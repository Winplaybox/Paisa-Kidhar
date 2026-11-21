-- Digital Shagun Card v2: many occasions + templates, colour palettes, 4 languages and a fully personalised card.
-- Additive and backward compatible: `design` stays the template id (old clients keep working).
alter table paisa.card_orders drop constraint if exists card_orders_design_check;
alter table paisa.card_orders
  add column occasion    text     not null default 'wedding',
  add column palette     smallint not null default 0,
  add column lang        text     not null default 'en',
  add column recipient   text,
  add column event_date  date,
  add column sender_name text,
  add column blessing    text,
  add column edit_count  int      not null default 0;

alter table paisa.card_orders
  add constraint card_orders_template_chk  check (design ~ '^[a-z0-9-]{2,32}$'),
  add constraint card_orders_occasion_chk  check (occasion in ('wedding','engagement','anniversary','birthday','baby-shower','housewarming','festival','congratulations')),
  add constraint card_orders_palette_chk   check (palette between 0 and 3),
  add constraint card_orders_lang_chk      check (lang in ('en','hi','gu','mr')),
  add constraint card_orders_recipient_chk check (recipient is null or char_length(recipient) between 1 and 80),
  add constraint card_orders_sender_chk    check (sender_name is null or char_length(sender_name) between 1 and 60),
  add constraint card_orders_blessing_chk  check (blessing is null or char_length(blessing) between 1 and 280),
  add constraint card_orders_edits_chk     check (edit_count between 0 and 50);
