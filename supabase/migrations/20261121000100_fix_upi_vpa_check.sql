-- Postgres caps regex repetition at 255; the original {2,256} errored on every non-null upi_vpa.
alter table paisa.registries drop constraint if exists registries_upi_vpa_check;
alter table paisa.registries add constraint registries_upi_vpa_check
  check (upi_vpa ~ '^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z][a-zA-Z0-9]{1,64}$');
