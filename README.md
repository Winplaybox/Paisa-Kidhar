# Paisa-Kidhar

India-first wedding dream registry: help couples receive contributions toward goals they actually care about instead of duplicate physical gifts.

> Working codename. Final consumer brand name is still to be confirmed.

## Product status

This repository starts with the product/engineering blueprint. The demo must use fictional seed data and simulated payments. Live payment processing and production ads remain disabled until credentials, policy, legal/compliance and release reviews are complete.

## Planned stack

- Mobile: React Native + Expo + TypeScript
- API: Python 3.12+ + FastAPI + Pydantic
- Data/Auth/Storage: Supabase Postgres, Supabase Auth, Storage and RLS
- CI: GitHub Actions
- Future monetization: optional transparent service fee and AdMob behind feature flags

## Repository map

See [Product specification](docs/PRODUCT_SPEC.md), [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Data model](docs/DATA_MODEL.md), [UX flows](docs/UX_FLOWS.md), [QA plan](docs/QA_TEST_PLAN.md), and [Play Store release checklist](docs/PLAY_STORE_RELEASE.md).

```text
apps/mobile/        Expo app
apps/web/           Public registry and admin web surfaces (planned)
apps/api/           FastAPI backend
packages/           Shared contracts, design tokens and config
supabase/           SQL migrations and demo seed data
docs/               Product, architecture, security and release documentation
.claude/skills/     Reusable AI-agent skills
```

## Local development

Implementation setup commands will be added with the initial app scaffold. Do not invent credentials: copy `.env.example` and supply project-specific values through local environment variables or secret management.

## Security

- Never commit secrets, service-role keys, OAuth client secrets, signing keys or payment credentials.
- Use integer paise for money.
- Only server-verified payment events can mark contributions successful.
- All user-facing tables must have tested RLS policies.
- Never grant admin role through user-editable profile metadata.

## Free-first policy

Prefer free/open-source tools and free tiers. Verify quotas and inactivity limits. Payment gateway charges, domains, storage/hosting overages and some build services may cost money; no paid service may be enabled without explicit approval.
