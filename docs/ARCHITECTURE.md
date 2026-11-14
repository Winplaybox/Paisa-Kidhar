# Architecture

## Runtime topology

- Expo React Native mobile client
- Optional React web client for public registry/admin console
- FastAPI Python API
- Supabase Auth, Postgres, Storage and RLS
- External payment provider adapter (disabled/sandbox in MVP)
- GitHub Actions CI

## Boundaries

- UI components call feature hooks/use-cases, never raw database APIs.
- Feature/domain modules own registry, goals, contributions, payments, analytics and admin rules.
- API routers validate/authorize and delegate to services.
- Services implement use-cases; repositories own persistence; provider adapters isolate external systems.
- Contracts are versioned and typed.

## Singleton ownership

- Mobile: one Supabase client and typed API client per app runtime in infrastructure modules; one query/cache provider at app root.
- Backend: settings are immutable and loaded centrally; reusable async clients and DB connection pools are created/closed in FastAPI lifespan.
- Inject dependencies into request handlers and services.
- Do not store user identity, request context or mutable request state in global singletons.
- Avoid creating clients during component render, inside individual endpoint functions or as import-time side effects.

## Proposed tree

See root README and Jira Epic for the full monorepo tree. Main areas: apps/mobile, apps/web, apps/api, packages/contracts, packages/design-tokens, supabase/migrations, docs and .claude/skills.

## Reliability

Use structured logs, request IDs, bounded timeouts, retries only for safe/idempotent operations, explicit payment state transitions, webhook idempotency and health/readiness checks.
