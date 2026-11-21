# QA test plan

## Automated (CI: `.github/workflows/ci.yml`)
- `apps/api`: 23 pytest tests against real Postgres with the production migration, connecting as `paisa_api`:
  auth (JWT, username auto-generation/uniqueness/change, email-or-username login, no user enumeration), owner isolation,
  publish rules, free-plan goal limit, guest pledge idempotency, private-goal protection, pledge-token check, guest can never confirm,
  totals only from confirmed gifts, anonymity on the public page, CSV formula-injection guard, Dodo webhook signature/replay/stale/duplicate,
  forged-webhook rejection via authoritative re-fetch, cross-product event filtering, admin role only via `user_roles`,
  `paisa_api` cannot self-grant admin or rewrite the audit log, `anon`/`authenticated` have no schema access, deletion hides registries.
- `apps/mobile`: TypeScript strict typecheck + production web export.

## Manual — before each Play release (on a real Android phone, production build)
| # | Flow | Expected |
|---|---|---|
| 1 | Sign up with email → confirm link → open app | Signed in; Profile shows an auto username |
| 2 | Sign out → sign in with **username** + password, then with **email** | Both work; wrong password shows one generic error |
| 3 | Continue with Google; cancel the Google sheet | Success signs in; cancel shows nothing scary |
| 4 | Forgot password → email link → new password | Can sign in with new password |
| 5 | Create registry without UPI → Publish | Blocked: "Add your UPI ID…" |
| 6 | Add 3 goals → try 4th (free) | Premium screen |
| 7 | Publish → Share → open link on another phone (not logged in) | Public page shows goals, no private goals, no UPI ID until gifting |
| 8 | Guest: ₹1 gift → "Pay with any UPI app" | UPI app opens with payee, ₹1.00 and reference prefilled |
| 9 | Guest taps "I've paid" | Thank-you + reference; couple's Gifts → "To confirm" shows it |
| 10 | Couple taps Received | Goal progress + public page update; blessing appears |
| 11 | Export CSV | Share sheet with CSV; anonymous rows say "Anonymous" |
| 12 | Delete account | Signed out; public link shows "not available" |
| 13 | Airplane mode on any screen | Friendly offline message + retry, no crash |
| 14 | Font size max, dark mode, small phone (360dp) | No clipped text, all buttons ≥44dp |
| 15 | Admin (after SQL grant) → Profile → Admin console → hide a registry | Public link 404s; audit log entry |

## Release gates
No `PAYMENTS_ENABLED=true` in live mode, no production AdMob, no Play production rollout until the rows above pass on a production build and the Play policy notes in `PLAY_STORE_RELEASE.md` are resolved.
