# Paisa-Kidhar project instructions

## Shared agent contract

Before substantial work, follow the universal Winplaybox agent operating contract:
https://github.com/Winplaybox/emergentagent/blob/main/AGENTS.md

For new app/product workflows, also follow:
https://github.com/Winplaybox/emergentagent/blob/main/skills/idea-to-production/SKILL.md

The shared repository is the source of truth for common agent behavior. This file contains only Paisa-Kidhar-specific constraints.

## Product constraints

- India-first wedding dream registry for couples and their guests.
- Mobile-first experience; planned stack: React Native + Expo + TypeScript, Python FastAPI, Supabase.
- Use fictional seed data in demos.
- Guest gifts are direct UPI transfers (deep link/QR) to the couple; the platform never receives gift money. Dodo Payments is used ONLY for the Premium Registry digital product (owner decision 2026-11-21).
- Auth: email or auto-generated username + password, and Google (owner decision 2026-11-21).
- Data lives in the isolated `paisa` schema of the shared `winplayboxsite` Supabase project (owner decision 2026-11-21). Never touch other schemas. Never reuse the separate wedding website database.
- Live Dodo mode and production ads stay disabled until keys, Play billing policy and release reviews are complete.
- Inspect existing Supabase projects and Auth provider settings before any schema changes or project provisioning.
- No schema changes or paid infrastructure without explicit approval.

## Domain and security rules

- Store monetary values as integer paise with explicit currency.
- Only server-verified payment events may mark contributions successful.
- Enforce authorization server-side and test Supabase RLS policies.
- Never grant admin role through user-editable profile metadata.
- Never commit secrets, service-role keys, OAuth client secrets, signing keys or payment credentials.
- Keep guest contribution privacy and couple financial information protected.
