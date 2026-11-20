# Data model

| Table | Purpose | Key controls |
|---|---|---|
| profiles | Safe user profile/preferences | auth.users FK; owner-only update |
| registries | Public/private registry | unique slug; owner write |
| goals | Registry funding goals | registry ownership; amounts in paise |
| contributions | Guest gift pledges (direct UPI) | status: pledged → guest_marked_paid → confirmed/rejected (owner only); unique reference + (registry, idempotency_key) |
| orders | Premium purchases via Dodo | succeeded only from verified webhook |
| payment_events | Verified webhook event ledger | service-only access; unique provider event |
| user_roles | Trusted role assignments | admin-only mutation |
| fee_rules | Versioned fee policy | admin-only writes; immutable versions |
| audit_logs | Sensitive/admin actions | append-only; restricted reads |
| app_events | Privacy-minimized analytics | bounded retention; aggregate reporting |

## Money and derived values

Store INR as integer paise. Do not use floating point for money. Successful totals must be calculated from server-verified successful contributions. If cached aggregates are used, update them transactionally and reconcile against the ledger.

## Migration requirements

Every migration must include constraints, indexes, RLS enablement and policies. Add automated policy tests. Do not apply migrations to an existing unrelated Supabase project.

Couple details live on `registries` (partner names, date, city, story, UPI ID) — a separate `couples` table was not needed. Source of truth: `supabase/migrations/`.
