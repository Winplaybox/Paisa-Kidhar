# Deploy runbook — Paisa Kidhar

Everything runs on free tiers: Supabase (existing `winplayboxsite` project, isolated `paisa` schema), Render (API + static web), EAS (Android builds), Google Play.

> Status on 21 Nov 2026: schema migrations `20261121000000_paisa_schema` and `20261121000100_fix_upi_vpa_check` are **applied** to `winplayboxsite` (`xatbfyiytcnogfbtfsym`). Nothing else is deployed yet.

## 1. Database role (one-time, Supabase SQL editor)

The API connects as the least-privileged role `paisa_api` (created by the migration as `NOLOGIN`). Enable login with a strong password:

```sql
alter role paisa_api with login password '<generate: openssl rand -base64 32>';
```

`DATABASE_URL` for Render (transaction pooler, port 6543):
`postgresql://paisa_api.xatbfyiytcnogfbtfsym:<password>@<pooler-host>:6543/postgres`
(Dashboard → Connect → Transaction pooler shows the exact host.)

Grant yourself admin (only way to become admin):
```sql
insert into paisa.user_roles(user_id, role)
select id, 'admin' from auth.users where email = '<your google email>';
```

## 2. Supabase Auth settings (Dashboard → Authentication)

- **Providers → Email**: enabled (already). Turn on *Confirm email* and *Leaked password protection* (advisor currently flags it off).
- **Providers → Google**: enabled (already). Under *Client IDs*, add the **Web** OAuth client ID used as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (native Android sign-in sends an ID token with that audience).
- **URL configuration → Redirect URLs**: add `https://paisa.winplaybox.in/**` and `http://localhost:8081/**`.
- **JWT**: if the project still uses the legacy HS256 secret, copy it to the API's `SUPABASE_JWT_SECRET`; with the newer asymmetric signing keys leave it empty (the API reads JWKS).

## 3. Google Cloud (OAuth for Android)

Google Cloud → APIs & Services → Credentials (same project as your existing WinPlayBox OAuth):
1. Keep/create an **OAuth client ID — Web application** → this is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. Create an **OAuth client ID — Android** with package `com.winplaybox.paisakidhar` and the SHA-1 of:
   - the EAS upload key (`npx eas-cli credentials` → Android → show), and
   - the Play **app signing** key (Play Console → Setup → App signing) once the app exists in Play.
   No client secret goes in the app.

## 4. Render

1. Render → New → Blueprint → connect `Winplaybox/Paisa-Kidhar` → it reads `render.yaml` (API in Singapore + static web).
2. Fill the `sync:false` env vars: `DATABASE_URL`, `SUPABASE_ANON_KEY` (publishable key), `SUPABASE_JWT_SECRET` (if HS256), `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Custom domain for the web service: `paisa.winplaybox.in` → add the CNAME Render shows in your DNS (cPanel zone editor).
4. Verify: `https://paisa-kidhar-registry-api.onrender.com/readyz` → `{"ok":true}`; open `https://paisa.winplaybox.in`.
5. Free-tier note: the API sleeps after 15 min idle (~50 s cold start). The app shows a friendly "server is waking up" retry message. A free uptime pinger on `/healthz` every 10 min avoids it.

## 5. Dodo Payments (Premium only — never guest gifts)

1. Dodo dashboard (**test mode** first) → Products → create one-time product *Premium Registry*, ₹499, digital.
2. Developer → API keys → `DODO_PAYMENTS_API_KEY`. Developer → Webhooks → endpoint `https://paisa-kidhar-registry-api.onrender.com/v1/webhooks/dodo`, events `payment.succeeded`, `payment.failed`, `payment.cancelled`, `refund.succeeded` → signing secret → `DODO_PAYMENTS_WEBHOOK_KEY`.
3. Set `DODO_PREMIUM_PRODUCT_ID`, then `PAYMENTS_ENABLED=true` on Render. Buy once with a test card/UPI, confirm the registry turns Premium.
4. Live: create the product again in live mode, swap keys/product ID, `DODO_PAYMENTS_ENVIRONMENT=live_mode`. The OVD app on the same Dodo account is unaffected (events are filtered by `metadata.app`).

## 6. Android build & Play (EAS)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                     # creates the EAS project; put the id in EAS_PROJECT_ID
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://paisa-kidhar-registry-api.onrender.com --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <web client id> --visibility plaintext
npx eas-cli@latest build --platform android --profile preview      # APK to test on your phone
npx eas-cli@latest build --platform android --profile production   # AAB for Play
```
First Play upload must be manual (Play Console → Create app → Internal testing → upload the AAB). After that:
`npx eas-cli@latest submit --platform android --profile production` (needs a Play service-account JSON at `apps/mobile/play-service-account.json`, git-ignored).

Then: copy the Play app-signing SHA-256 into `apps/mobile/public/.well-known/assetlinks.json` and redeploy web (makes `paisa.winplaybox.in/r/...` links open the app).

## 7. Rollback

- API/web: Render → service → Deploys → *Rollback* to the previous deploy.
- App: Play Console → halt staged rollout; ship the previous AAB with a higher versionCode.
- DB: migrations are additive. To remove Paisa Kidhar entirely: `drop schema paisa cascade; drop role paisa_api;` (destroys all Paisa data — owner approval required).
- Backups: Supabase free tier has no PITR; run `pg_dump --schema=paisa` weekly (GitHub Action with a secret DSN) if you need restorable backups.
