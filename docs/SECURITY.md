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
