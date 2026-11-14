# QA test plan

## Functional
- Google OAuth success, cancellation, expired/revoked session, logout and deletion request.
- Couple can create/edit/reorder/pause/publish registries and goals.
- Guest can view only public registry content and submit a demo contribution.
- Couple sees accurate totals and charts; CSV export respects privacy choices.
- Admin routes reject non-admin users.

## Security
- RLS owner/guest/admin matrix for every table.
- No client-side admin escalation.
- No service-role secret in bundles or logs.
- Invalid amount, currency, goal state and duplicate idempotency key rejected.
- Invalid webhook signature, replayed event and duplicate provider event rejected.

## Quality
- Unit, integration, contract and end-to-end tests.
- Type checks, lint, formatting, dependency scan and release build.
- Small-screen layout, tablets, accessibility, large text and reduced motion.
- Offline behavior, slow network, timeout and retry behavior.
- Backup/restore and migration rollback rehearsal.

## Release gates
No live payment, production AdMob or public release until all applicable tests and compliance/console reviews pass.
