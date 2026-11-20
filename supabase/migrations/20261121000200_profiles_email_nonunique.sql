-- Two auth users can share an email (e.g. unlinked Google + password identities); don't fail profile creation.
drop index if exists paisa.profiles_email_uq;
create index if not exists profiles_email_idx on paisa.profiles (lower(email));
