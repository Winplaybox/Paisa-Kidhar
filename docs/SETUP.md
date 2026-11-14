# Production setup — step by step

Order matters: **Supabase → Google OAuth → Backend → AdMob → EAS build → Play Console**.
Everything below is on free tiers.

---

## 1. Supabase (done ✅)

Project: `winplayboxsite` (`xatbfyiytcnogfbtfsym`). Migrations in `supabase/migrations/` are applied:

- `pk_profiles`, `pk_transactions` — RLS on, each user sees only their own rows (verified with a cross-user test)
- RPCs: `pk_daily_totals`, `pk_monthly_category_totals`, `pk_delete_my_data`
- Unique `(user_id, dedupe_key)` so re-importing the same SMS/statement never duplicates

> Note: this project already has an `auth.users` trigger from another product (`ap_new_user`). New Paisa Kidhar
> users will also get a row there — harmless, but worth knowing.

## 2. Google Sign-In

You already have the Google provider enabled in Supabase. The app uses **native** Google Sign-In
(`@react-native-google-signin/google-signin`) → ID token → `supabase.auth.signInWithIdToken`.

1. **Google Cloud Console → APIs & Services → Credentials** (same project as your existing Supabase Google OAuth):
   - Keep your existing **Web application** OAuth client. Copy its **Client ID** →
     `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - Create **OAuth client ID → Android** ×2:
     - Package: `com.winplaybox.paisakidhar`
     - SHA-1 #1: from EAS → `npx eas-cli credentials -p android` (upload keystore)
     - SHA-1 #2: Play Console → *Test and release → App integrity → App signing key certificate*
2. **Supabase → Authentication → Providers → Google** → *Client IDs* (authorized client IDs): add the **Web client ID**
   (comma-separated with what's already there). Save.
3. The OAuth consent screen must be **In production** (or add testers) or sign-in fails for other users.

Common error: `DEVELOPER_ERROR` = SHA-1 / package mismatch on the Android client.

## 3. Python backend on Render (free)

1. render.com → **New → Blueprint** → select `Winplaybox/paisa-kidhar` → it reads `render.yaml`.
2. After deploy, copy the URL (e.g. `https://paisa-kidhar-api.onrender.com`) → `EXPO_PUBLIC_API_URL`.
3. Check: `curl https://…/health` → `{"ok":true}`.

Free instances sleep after ~15 min idle; the app pings `/health` on launch and the core app never depends on the
API (only PDF/Excel import + smart insights do). No secrets on the server — it reads data **as the user** via
their JWT, so RLS still applies.

## 4. AdMob

1. AdMob → **Apps → Add app → Android → not yet published** → name *Paisa Kidhar?* → copy **App ID**
   (`ca-app-pub-…~…`) → `ADMOB_ANDROID_APP_ID` (build-time, native manifest).
2. **Ad units**: create *Banner* and *Interstitial* → `EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`.
3. **Privacy & messaging → GDPR / US state** messages: create & publish (UMP consent form is already wired).
4. After Play listing is live, link the app in AdMob and add `app-ads.txt` to winplaybox.in.

Placements (kept light on purpose): adaptive banner at the bottom of **Insights** and **History**; one interstitial
after closing the report card — max once per 8h and never in the first 2 days. Debug builds always use Google
test IDs, so you can't accidentally click your own live ads.

## 5. Build with EAS (Expo)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli init                      # links project, prints projectId
# Put the public values into EAS environment (or keep them in eas.json "env"):
npx eas-cli env:create --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<web client id>" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://paisa-kidhar-api.onrender.com" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_BANNER_ID --value "ca-app-pub-…/…" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID --value "ca-app-pub-…/…" --visibility plaintext
npx eas-cli env:create --environment production --name ADMOB_ANDROID_APP_ID --value "ca-app-pub-…~…" --visibility plaintext
# repeat for --environment preview

npm run build:preview     # APK to install on your phone and test
npm run build:prod        # AAB for Play Store
```

Or from GitHub: add repo secret `EXPO_TOKEN` → Actions → **Android build** → Run workflow.

## 6. Google Play Console

1. **Create app** → *Paisa Kidhar?* · App · Free · Contains ads ✅
2. **Store listing** → copy from `store/listing.md`; icon `store/icon-512.png`; feature graphic `store/feature-graphic.png`;
   screenshots: take 4–8 from the preview APK.
3. **App content**
   - Privacy policy URL → host `docs/privacy.html` (e.g. winplaybox.in/paisa-kidhar/privacy) and set `EXPO_PUBLIC_PRIVACY_URL`
   - Ads → *Yes*
   - **Data safety** → collected: *Email* (account), *Name* (optional), *Financial info → purchase history* (user-entered
     expenses). Encrypted in transit ✅. Users can request deletion ✅. Not shared with third parties except ad SDK
     (Advertising ID, App interactions — AdMob).
   - **Account deletion** URL → host `docs/delete-account.html`
   - Target audience 18+, not a news app, no government app
   - Financial features declaration → *personal budgeting / expense tracking*, no loans
4. **Testing → Internal testing** → upload AAB (`eas submit` does this) → add yourself → test → promote to Closed
   testing (new personal developer accounts need 12 testers × 14 days before Production).

## 7. Things deliberately *not* in v1

- **Auto-reading SMS** — needs READ_SMS, which Play grants only via a case-by-case permissions declaration. v1 blocks
  the permission entirely (`blockedPermissions`) so review is smooth; paste-import covers the use case.
- **Direct bank sync** — needs RBI Account Aggregator access as a regulated FIU or via a licensed partner.
