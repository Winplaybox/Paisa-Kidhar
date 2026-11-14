---
name: idea-to-production-app
description: Turn a short application idea into a complete product specification, implementation plan, tested application, demo, deployment and app-store release package. Use whenever the user proposes a new app or asks to build an application end to end.
---

# Idea to production application workflow

## Conversation contract

- If no idea has been provided, ask one concise question: "What is the app idea?"
- If the user has already supplied an idea, do not ask them to repeat it.
- Treat repository-level `AGENTS.md` as the standing quality, architecture, singleton, security, free-first and release requirements.
- Do not make the user re-enter standard preferences such as production quality, clear fluid UI, modular architecture, documentation, tests, store assets and cost awareness.
- Ask only for decisions that cannot safely be inferred: product naming when it affects package IDs/branding, account/project ownership, credentials, regulated/payment decisions, or paid provisioning. Make reversible design decisions independently and document assumptions.

## Phase 1 — Understand and specify

Produce:
- Problem statement, value proposition and target market
- Personas, user journeys and role/permission matrix
- MVP, later phases and explicit non-goals
- Functional and non-functional requirements
- Data classification, privacy, threat model and compliance questions
- Success metrics and acceptance criteria
- Assumptions and unresolved decisions

## Phase 2 — Inspect before creating

- Inspect the current repository, branches, existing code, CI and deployment setup.
- Inspect connected GitHub/Supabase/hosting resources and account ownership.
- Reuse existing resources when suitable; never create duplicate repositories or databases.
- Do not reuse an unrelated production database.
- Before provisioning a project, identify the exact organization/account and disclose any cost or free-tier limitations. Obtain approval for non-zero costs.

## Phase 3 — Design and architecture

Create:
- System context and component architecture
- Frontend/backend boundaries and API contracts
- Database ERD/data dictionary and migration plan
- Authentication, authorization and RLS design
- Module-level singleton/client ownership plan
- Folder structure with clear module responsibilities
- Error, logging, observability and configuration strategy
- UX flows, design tokens, responsive layouts and accessibility plan
- Test strategy and release/deployment plan

Singleton rules:
- One reusable client per runtime/configuration, created in a dedicated module.
- Use FastAPI lifespan for connection pools and long-lived clients.
- Inject dependencies into request handlers.
- Never store per-request identity or mutable request data in a process-global singleton.
- Avoid import-time side effects and duplicate client construction.

## Phase 4 — Demo first

- Build an artifact/demo that can be run locally.
- Use fictional seed data and clear demo indicators.
- Mock external services and simulate payments until real credentials and approvals exist.
- Cover loading, empty, error, offline and success states.
- Never imply that simulated actions are real transactions.

## Phase 5 — Implement and verify

- Work in small coherent modules and reviewable commits/PRs.
- Add unit, integration, API contract, authorization, database/RLS and end-to-end tests.
- Run lint, formatting, type checks, tests and production builds; report exact outcomes.
- Validate accessibility, responsive behavior, performance and security.
- Add CI and environment templates without secrets.
- Document migrations, rollback and recovery.

## Phase 6 — Console and store deliverables

Prepare accurate:
- Google Play title, short/full description, category, tags, contact details and release notes
- 512x512 app icon, 1024x500 feature graphic, phone/tablet screenshots, splash/adaptive icon assets and optional promo video
- Privacy policy, terms, support URL, Data safety, content rating, target audience and ads declarations
- Package ID, signing and Play App Signing instructions, versioning, internal/closed testing and staged rollout
- AdMob app/ad unit configuration, consent and policy checklist

Do not fabricate console status, approvals, identifiers or asset delivery. State what is ready and what still requires owner credentials or manual review.

## Phase 7 — Cost and safety

- Prefer free/open-source tools and free tiers.
- Verify quotas, inactivity/pause policies, storage/build limits and third-party fees.
- Ask before any paid resource creation or non-zero-cost plan.
- Never expose secrets, bypass provider/platform policies, enable live payments/ads, or publish a production release without explicit approval.

## Final handoff

Provide repository/PR links, demo instructions, architecture summary, migration status, test evidence, deployment status, remaining credentials/manual steps, store assets checklist and known risks. Distinguish implemented, tested, configured, and merely planned work.
