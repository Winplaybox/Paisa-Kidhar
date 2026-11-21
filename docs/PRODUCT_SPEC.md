# Product specification — Paisa-Kidhar

## Vision

Replace duplicate wedding gifts with contributions to meaningful goals chosen by the couple: honeymoon, first-home savings, travel, experiences or wanted items.

## Roles

- Couple/owner: creates and manages a registry and its goals.
- Guest: browses a published registry and can contribute without creating an account.
- Platform admin: manages moderation, reporting and configuration through trusted server-side permissions.

## Core MVP

1. Sign-in: email or auto-generated username + password, and Google (Supabase Auth).
2. Couple onboarding and wedding profile.
3. Registry and goal creation/editing/reordering/publishing.
4. Public shareable registry with QR code.
5. Guest contribution UX with custom INR amount and optional anonymous name/message.
6. Gifts by direct UPI (deep link + QR) to the couple's UPI ID; couple confirms receipt. Optional Premium Registry (₹499 one-time) via Dodo Payments.
7. Couple dashboard with totals, progress, recent activity and charts.
8. Admin aggregate user-base reporting and audit trail.
9. Privacy, account deletion request and user data controls.

## Analytics

- KPI: registered users, active couples, published registries, goals, successful contributions, total amount, average contribution, goal completion.
- Charts: contribution timeline, amount per goal, contribution distribution, monthly trend, goal progress and payment-state mix.
- Filters: time range, goal and payment state.
- Exports: privacy-safe CSV.

## UX direction

Mobile-first, calm premium Indian wedding visual language: warm ivory, deep plum/rose, subtle gold, legible typography, generous spacing and restrained motion. Fast, accessible, clear and fluid. Include complete loading/empty/error/offline states.

## Monetization

Optional transparent service fee and future partnerships. AdMob is a later feature behind a flag; no ads on auth/payment/receipt journeys.

## Launch constraints

Live payments require provider onboarding, signed webhook verification, legal/compliance review, refund/cancellation policy and accounting decisions. Play Store release requires accurate privacy/data-safety declarations, app assets, signing and testing. No claim of zero operating cost.
