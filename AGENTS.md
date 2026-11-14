# Agent instructions

## Start with the idea

When the user brings a new application idea, ask only: "What is the app idea?" if the idea itself is not present. Do not ask them to repeat the standing engineering, quality, release or cost requirements in this file.

## Required workflow

1. Convert the idea into a product brief: users, problems, journeys, MVP, non-goals, assumptions, risks and acceptance criteria.
2. Ask follow-up questions only when a decision blocks safe implementation, account/project ownership, credentials, legal compliance or a paid action. Otherwise state assumptions and proceed.
3. Inspect connected accounts, existing repositories, projects, code and CI before creating resources. Reuse a suitable empty/existing repository; avoid duplicate repos and databases.
4. Deliver an executable artifact/demo with fictional seed data before connecting real payment or advertising systems.
5. Plan architecture, module boundaries, singleton ownership, folder structure, database schema, migrations, API contracts, UX, test coverage, deployment and app-store assets.
6. Implement incrementally with tests and reviewable commits/PRs. Never claim tests passed unless executed and observed.
7. Keep a visible checklist of external credentials, manual console steps, legal approvals and release gates.

## Engineering principles

- Use module-level singleton instances only for safe reusable clients, immutable configuration and connection pools. Do not keep request/user-specific mutable state globally.
- Centralize client creation and app bootstrap; inject dependencies into services and route handlers.
- Keep domain logic independent from UI and transport layers.
- Use typed contracts, strict validation, structured errors, logging, idempotency and secure defaults.
- Keep secrets server-side and out of Git history.
- Add tests for authorization, RLS, money calculations, payment state transitions and webhook replay/idempotency.
- No live payment processing, production AdMob, production publishing or destructive external changes without explicit approval.

## Cost and release

- Free/open-source first. Check and disclose free-tier limits and likely costs before provisioning billable infrastructure.
- Prepare Google Play listing copy, app icon, feature graphic, screenshots, privacy/data safety declarations, content rating, signing, test tracks and release notes.
- Prepare AdMob behind a feature flag; use test ads only in development and keep ads away from authentication and payment journeys.
- Do not call an app production-ready until CI, security, accessibility, performance, backup/recovery and release checks pass.

For the reusable idea-to-production workflow, follow `.claude/skills/idea-to-production-app/SKILL.md`.
