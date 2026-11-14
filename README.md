# Paisa Kidhar? 💸

> **Branch note:** this branch implements the *daily budget tracker* concept. `main`'s docs (`docs/PRODUCT_SPEC.md`, `AGENTS.md`) currently describe a *wedding dream registry* under the same codename — decide which product this repo is for before merging.

> Salary aati hai, gayab ho jaati hai. Ab pata chalega **kidhar**.

Android app that turns your monthly income into a **daily budget**, minuses every kharcha live, and sends a **nightly report card** — "Your daily income budget was ₹3,333 and you spent ₹4,200. Grade D 💸".

| | |
|---|---|
| **Mobile** | Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · Reanimated 4 · React Query |
| **Auth + DB** | Supabase (Google sign-in, Postgres, Row Level Security) — tables prefixed `pk_` |
| **Backend** | Python 3.13 · FastAPI — statement (CSV/Excel/PDF) parsing + insights engine |
| **Ads** | AdMob via `react-native-google-mobile-ads` with Google UMP consent |
| **Cost** | ₹0 — Supabase free, Render free, EAS free tier, GitHub Actions |

## Features

- **Daily income budget** — `monthly income ÷ days in month` (or after fixed costs like rent/EMI/SIP), optional carry-forward
- **Live budget ring** — animated, turns amber at 80%, red when you cross it
- **Quick add** — Coffee / Blinkit / Zepto / Swiggy / Amazon… tap to edit, long-press to log instantly
- **Bank SMS import** — paste one or many debit SMS; amount, merchant, date, category auto-extracted on-device (HDFC, SBI, ICICI, Axis, Kotak, UPI VPAs). Credits skipped, duplicates blocked
- **Statement import** — CSV parsed on-device; PDF/Excel parsed by the Python API (never stored)
- **Morning + night notifications** — local, offline, re-planned on every change so tonight's numbers are real
- **Report card** — A+ → F grade with a Hinglish roast, category split, biggest kharcha, share
- **Insights** — donut / bars by category, daily bars vs budget line, cumulative month-pace line, weekday heat, 6-month stacked trend, top merchants, Python "smart insights" (subscriptions, leaks, spikes, MoM trends, pace warnings)
- **History** — FlashList, grouped by day, search
- **Privacy** — RLS-isolated per user, CSV export, one-tap delete-all-data (Play requirement)

## Repo layout

```
apps/mobile/          Expo app (src/app = screens, src/lib = pure logic, src/data = Supabase queries)
backend/              FastAPI service (app/parsing.py, app/insights.py) + pytest
supabase/migrations/  SQL schema, RLS policies, RPCs
store/                Play Store graphics + listing copy
docs/                 SETUP guide, privacy policy, account-deletion page
.github/workflows/    CI (typecheck, lint, tests, bundle) + manual EAS build/submit
render.yaml           One-click Render deploy for the API
```

## Quick start

```bash
# Mobile
cd apps/mobile
cp .env.example .env          # fill EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID + EXPO_PUBLIC_API_URL
npm install
npx expo run:android          # needs a dev build (Google Sign-In + AdMob are native) — or: npm run build:preview

# Backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
uvicorn app.main:app --reload
```

Full production checklist (Google OAuth, AdMob, Render, EAS, Play Console): **[docs/SETUP.md](docs/SETUP.md)**.

## Quality gates

| Check | Command |
|---|---|
| Typecheck | `cd apps/mobile && npm run typecheck` |
| Lint | `cd apps/mobile && npx expo lint` |
| Parser/budget unit tests | `cd apps/mobile && npm test` |
| Android bundle | `cd apps/mobile && npx expo export --platform android` |
| API tests + lint | `cd backend && pytest -q && ruff check .` |

All run in CI on every push.

---
Made with ❤️ by [WinPlayBox](https://winplaybox.in)
