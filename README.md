# Paisa Kidhar

India-first **wedding dream registry**. Couples list goals they actually want (honeymoon, first home, travel…), share one link/QR, and guests send their shagun **directly to the couple's UPI ID**. Couples confirm gifts in the app and watch every goal fill up.

Android app + responsive web (same Expo codebase) · FastAPI · Supabase · OVD Base Design System.

| Surface | Where |
|---|---|
| Android app | `apps/mobile` (Expo SDK 58, Expo Router) → Google Play `com.winplaybox.paisakidhar` |
| Web (guest registry pages + couple dashboard) | same app exported for web → `https://paisa.winplaybox.in` |
| API | `apps/api` (FastAPI, Python 3.12) → Render free tier |
| Database / Auth | Supabase project `winplayboxsite`, isolated `paisa` schema (`supabase/migrations`) |
| Design tokens | `packages/design-tokens/tokens.json` — copied 1:1 from OVD + Paisa Kidhar accent layer |

## Key product decisions
- **Login:** email *or* auto-generated username + password, and Google. Username is created automatically on first sign-in and can be changed in Profile.
- **Guest gifts never touch our servers' money:** a UPI deep link/QR (`upi://pay`) opens the guest's own UPI app → couple's UPI ID. The couple marks a gift *Received*; only received gifts count toward goals. This keeps us out of payment-aggregator/escrow licensing and is why Dodo Payments is **not** used for gifts (Dodo prohibits personal fundraising/donations).
- **Dodo Payments** sells the optional *Premium Registry* (₹499 one-time, digital). Premium activates only after a signature-verified webhook **and** a server re-fetch of the payment.
- **Ads:** AdMob module behind `EXPO_PUBLIC_ADS_ENABLED`, off by default, never on auth/gift/receipt/guest screens or Premium registries.

## Run locally
```bash
# API (needs a Postgres; tests spin up the schema themselves)
cd apps/api && pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres pytest -q
cp .env.example .env   # fill values, then:
uvicorn app.main:create_app --factory --reload

# App
cd apps/mobile && npm ci && cp .env.example .env
npx expo start --web            # web
npx expo run:android            # dev build (Google Sign-In & AdMob need a dev build, not Expo Go)
```

## Docs
[Deploy runbook](docs/DEPLOY.md) · [Play Store kit](docs/PLAY_STORE_RELEASE.md) · [QA plan](docs/QA_TEST_PLAN.md) · [Security](docs/SECURITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Product spec](docs/PRODUCT_SPEC.md) · [UX flows](docs/UX_FLOWS.md) · [Design tokens](packages/design-tokens/README.md)

## Security
No secrets in the repo or the app bundle. The app only knows the Supabase *publishable* key and uses Supabase for auth; all data goes through the API, which connects as the least-privileged `paisa_api` role. The `paisa` schema is not exposed through PostgREST. Money is integer paise. Admin = row in `paisa.user_roles`, granted only from the SQL editor.

Shared agent workflow: [Winplaybox/emergentagent](https://github.com/Winplaybox/emergentagent).
