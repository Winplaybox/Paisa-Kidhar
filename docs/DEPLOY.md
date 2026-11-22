# Deploy runbook — Paisa Kidhar

Everything runs on free tiers: Supabase (existing `winplayboxsite` project, isolated `paisa` schema), Render (API + static web), EAS (Android builds), Google Play.

> **LIVE status (21 Nov 2026)**
> - DB: migrations applied to `winplayboxsite`; `paisa_api` login enabled (password only in Render env).
> - API: Render `paisa-kidhar-registry-api` (Singapore, free) → https://paisa-kidhar-registry-api.onrender.com — deploys branch `feat/production-app` (switch to `main` in Render → Settings after merging PR #1).
> - Web: Hostinger website `paisa.winplaybox.in` (static, `.htaccess` SPA rewrite). DNS ALIAS auto-created.
> - Dodo LIVE: product `pdt_0NsPPvAZmY1qMyoo5799p` (₹499 incl. GST), API key `paisa-kidhar-api` (least privilege), webhook `ep_3MP8yBKaSh8kO0i1DoXqQuOFiWK` (signature verified in prod). `PAYMENTS_ENABLED=true`.
> - Verified in production: email sign-up → confirm → login by username, create/publish registry, guest gift → UPI screen → "I've paid" → couple confirms → totals/charts, Premium checkout opens Dodo LIVE (₹499).
> - Google sign-in (web) uses Supabase's Google client `239411206040-1rj5…`; Android native sign-in needs an Android OAuth client in that same GCP project (package + SHA-1) after the first EAS build.

## Re-deploying the web app (Hostinger)
```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://paisa-kidhar-registry-api.onrender.com EXPO_PUBLIC_WEB_URL=https://paisa.winplaybox.in \
  npx expo export --platform web --output-dir ../../dist-web
cp ../../docs/hostinger.htaccess ../../dist-web/.htaccess && (cd ../../dist-web && zip -qr ../site.zip .)
```
Upload `site.zip` to the website root (hPanel → File manager, or the Hostinger API upload URL), then run *Deploy static site archive* (hPanel or `hosting_websites_deploy-static-site-archive`). Once GitHub Actions billing is fixed, this can be automated.

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

## 4. Render (API) — already done; for a fresh setup:

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

## Updates after release (OTA + Play in-app update)

- **OTA (expo-updates)** — JS/asset-only fixes reach installed apps of the *same version* with no Play review:
  `cd apps/mobile && npx eas update --channel production --message "<what changed>"`.
  Builds made with the `production` profile listen on the `production` channel (see eas.json). Anything that changes native code,
  permissions, app.config plugins or the SDK needs a new AAB instead. The app downloads the bundle silently and shows a localized
  "Restart now / Later" dialog (`src/components/UpdateGate.tsx`).
- **Play in-app update** — after publishing a new versionCode, the app shows a localized "Update available" dialog and Google's
  download UI. In Play Console → Release → *Update priority* (set when creating the release): **0–3 = dismissible prompt,
  4–5 = blocking immediate update** (use 5 when an old build would break against the API). Works only for Play-installed builds.
- Settings → *Check for updates* runs both checks on demand. Rate/feedback (`/feedback`) posts to `POST /v1/public/feedback`
  (table `paisa.app_feedback`, read it in the Supabase dashboard).

## Change the app from the backend (no Play release)

Everything below is live for all users within ~1 minute (the app refetches `/v1/public/config` on open and on resume):

| What | How |
|---|---|
| Announcement banner (4 languages, optional link) | In the app: Profile → Admin → **App controls (live)** → Publish announcement |
| Maintenance mode (blocks the app with a message) | Same card → Maintenance ON/OFF |
| Force update (minimum Android version) | Same card → Minimum version (e.g. `1.0.1`); older apps see a blocking "Update" screen linking to Play |
| Feature flags (`shagun_cards`, `premium`, `feedback`, `ads`) | Same card → tap a flag |
| Legal text (privacy/terms/delete-account, per language) | `PUT /v1/admin/config/legal` with `{"value": {"updated": "22 November 2026", "privacy": {"en": "...", "hi": "..."}}}` (admin bearer token); omit a key to fall back to the bundled text |

JS/UI changes that are not config: publish an OTA update with the **Publish production OTA update** EAS workflow
(`apps/mobile/.eas/workflows/publish-update.yml`, run it on `main`). Native changes (new permissions, new native modules, SDK bump) always need a new AAB.

### Web deploy (Hostinger static) — what works from the sandbox
1. `npx expo export --platform web --output-dir ../../dist-web`, copy `docs/hostinger.htaccess` to `dist-web/.htaccess`, zip, push the zip to the `web-dist-archive` branch.
2. Get upload credentials with `hosting_files_generate-upload-url` (Hostinger connector).
3. Upload from a browser tab on `https://hpanel.hostinger.com/` (TUS endpoint only allows that CORS origin): fetch the zip from raw.githubusercontent.com, `POST` then `PATCH` to `<url>/site.zip?override=true` with `X-Auth`, `X-Auth-Rest`, `Tus-Resumable: 1.0.0`.
4. `hosting_websites_deploy-static-site-archive` with `archive_path: <zip>`.
