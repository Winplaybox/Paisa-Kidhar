alter table paisa.card_orders
  drop constraint card_orders_amount_paise_check,
  drop constraint card_orders_provider_check,
  alter column buyer_email drop not null,
  add constraint card_orders_source_details_check check (
    (provider = 'dodo' and amount_paise > 0 and buyer_email is not null) or
    (provider = 'admob_reward' and amount_paise = 0 and buyer_email is null
      and provider_session_id is null and provider_payment_id is null)
  );

create unique index card_orders_reward_per_gift
  on paisa.card_orders (contribution_id) where provider = 'admob_reward';
