-- PostgREST upsert(on_conflict=user_id,dedupe_key) cannot target a partial index.
-- A plain UNIQUE constraint still allows many NULL dedupe_keys (NULLs are distinct).
drop index if exists public.pk_tx_dedupe_uidx;
alter table public.pk_transactions add constraint pk_tx_user_dedupe_key unique (user_id, dedupe_key);
