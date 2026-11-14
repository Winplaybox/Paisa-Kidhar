# Data model

| Table | Purpose | Key controls |
|---|---|---|
| profiles | Safe user profile/preferences | auth.users FK; owner-only update |
| couples | Couple/wedding profile | owner membership; public-safe projection |
| registries | Public/private registry | unique slug; owner write |
| goals | Registry funding goals | registry ownership; amounts in paise |
| contributions | Guest contributions | server-controlled status; idempotency |
| payment_events | Verified webhook event ledger | service-only access; unique provider event |
| user_roles | Trusted role assignments | admin-only mutation |
| fee_rules | Versioned fee policy | admin-only writes; immutable versions |
| audit_logs | Sensitive/admin actions | append-only; restricted reads |
| app_events | Privacy-minimized analytics | bounded retention; aggregate reporting |

## Money and derived values

Store INR as integer paise. Do not use floating point for money. Successful totals must be calculated from server-verified successful contributions. If cached aggregates are used, update them transactionally and reconcile against the ledger.

## Migration requirements

Every migration must include constraints, indexes, RLS enablement and policies. Add automated policy tests. Do not apply migrations to an existing unrelated Supabase project.
