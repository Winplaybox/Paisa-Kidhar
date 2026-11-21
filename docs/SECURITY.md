# Security baseline

- Default-deny RLS on all exposed tables.
- Public registry reads use a restricted public projection; never expose private couple or guest fields.
- Ownership checks on every mutation.
- Admin role assigned only through trusted server-side process.
- Verify Supabase JWTs server-side on privileged FastAPI endpoints.
- Keep service-role, OAuth, payment and signing secrets out of client bundles and Git.
- Payment success only after signature-verified provider webhook/authoritative verification.
- Use integer paise, strict amount bounds, idempotency keys, replay protection and immutable event IDs.
- Rate-limit public reads, contribution initiation, guest messages and webhook processing.
- Minimize analytics and retention; provide account deletion request and privacy controls.
- Test RLS and authorization with owner, unrelated user, anonymous guest and admin identities.
- Maintain dependency scanning, backup/restore and incident response documentation.

## Implementation (Nov 2026)
- `paisa` schema: no grants to `anon`/`authenticated`; not exposed via PostgREST. RLS enabled + forced on every table; the only policies are for `paisa_api`.
- `paisa_api` cannot write `user_roles` and cannot update/delete `audit_logs` (also blocked by trigger).
- JWTs verified server-side (JWKS RS256/ES256 or legacy HS256), `aud=authenticated`, issuer pinned.
- Login proxy resolves username→email server-side so emails are never exposed; identical error for unknown user and wrong password; 10 attempts / 5 min / IP.
- Guest pledge mark-paid requires an HMAC token returned only to the pledging browser. Guests can never set `confirmed`.
- Public projection excludes owner id, UPI ID (revealed only in the pledge response), private goals, unconfirmed gifts, and names of anonymous givers.
- Dodo webhook: Standard Webhooks HMAC, 5-min replay window, unique `(provider,event_id)`, authoritative payment re-fetch, amount/currency/order match, events from other WinPlayBox apps ignored.
- CSV export neutralises spreadsheet formulas. Rate limits are per-process (single Render instance); move to Redis if scaled out.
- Pre-existing advisor warnings in other schemas of `winplayboxsite` (public `tm_*`/`ap_*` SECURITY DEFINER functions executable by anon) are outside this product and were not changed.
