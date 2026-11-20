# Google Play release kit — Paisa Kidhar

Package: `com.winplaybox.paisakidhar` · Category: **Lifestyle** · Contains ads: **No** for v1.0 (ads flag off) · Price: Free (in-app purchase via Dodo web checkout — see policy note).

## Store listing (English)

**App name (≤30):** Paisa Kidhar — Wedding Registry

**Short description (≤80):** Skip duplicate gifts. Share your wedding dreams and receive shagun on UPI.

**Full description:**
```
Don't gift another mixer. Fund a dream.

Paisa Kidhar is a wedding dream registry for Indian couples. List what you truly want — a honeymoon in Bali, savings for your first home, a trip to Japan, a new sofa — and share one link or QR code with your guests. Guests pick a dream, choose an amount and send their shagun straight to your UPI ID from GPay, PhonePe, Paytm or any UPI app.

WHY COUPLES LOVE IT
• Goals you choose — honeymoon, home, travel, experiences or anything you need
• Direct UPI — gifts go straight from the guest to you. We never hold your money
• Live progress — watch every goal fill up with a beautiful dashboard and charts
• Blessings wall — guests leave wishes with their gift (or give anonymously)
• Share anywhere — WhatsApp link + printable QR code for your wedding card
• Easy tracking — confirm gifts in one tap, export everything to CSV
• Guests don't need the app or an account

PREMIUM REGISTRY (optional, one-time)
Up to 50 goals, premium themes, a custom link and no ads.

Sign in with Google, or with your email/username and password.
Made in Mumbai by WinPlayBox.
```

**Graphics (in `docs/store/`):** `play-icon-512.png`, `feature-graphic-1024x500.png`, phone screenshots `phone-*.png` (1080×1920). Retake screenshots on a production build before submitting (current ones are from the web build with fictional demo data).

**Contact:** support@winplaybox.in · Website: https://paisa.winplaybox.in · Privacy: https://paisa.winplaybox.in/legal/privacy

## App content declarations

| Item | Answer |
|---|---|
| Privacy policy | https://paisa.winplaybox.in/legal/privacy |
| App access | Login required for couples. Provide a reviewer account (email + password) of a test couple with a published registry. Guest flow: https://paisa.winplaybox.in/r/<demo-slug> |
| Ads | No (v1.0). Change to Yes before enabling `EXPO_PUBLIC_ADS_ENABLED`. |
| Content rating | IARC questionnaire: no violence/sexual content/gambling; users interact (guest messages are shown publicly after couple confirmation) → expect "Everyone"/3+. |
| Target audience | 18+ |
| Financial features | Declare: *None of the listed* (no loans, banking, wallet or money transfer by the app — guests use their own UPI app). Re-check wording at submission time. |
| Account deletion | In-app: Profile → Delete my account. Web URL for the Play form: https://paisa.winplaybox.in/legal/privacy (section "Your choices"). |

### Data safety form

| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name | Yes | No | Account management, app functionality | No (couples); optional for guests |
| Email address | Yes | No | Account management | No |
| User IDs (username) | Yes | No | Account management | No |
| Purchase history (Premium) | Yes | No | App functionality | Yes |
| Other user-generated content (story, goals, messages) | Yes | No | App functionality | Yes |
| App interactions (event names) | Yes | No | Analytics | No |
| Device or other IDs | **No** for v1.0 (becomes Yes, shared with Google AdMob, when ads are enabled) | | | |

Encrypted in transit: Yes. Users can request deletion: Yes. Payment info (cards/UPI) is handled by Dodo Payments' checkout and by the guest's own UPI app — not collected by the app.

## Policy notes (read before submitting)

1. **Guest gifts** are UPI deep links (`upi://pay`) into the guest's own UPI app — peer-to-peer transfers, not purchases inside the app. Not subject to Play Billing.
2. **Premium** is a digital feature unlock. Google Play's Payments policy generally requires Play Billing for digital goods sold in Android apps; India has a user-choice-billing programme. **Before shipping Premium inside the Android app, either (a) enrol in user-choice/alternative billing for India and keep Dodo, or (b) hide the Premium purchase button on Android and sell Premium only on the web.** The app already does (b) by default: the Android build hides the Premium buy button unless `EXPO_PUBLIC_ANDROID_EXTERNAL_BILLING=true` (set it only after enrolling in user-choice billing). v1.0 ships with `PAYMENTS_ENABLED=false` ("Premium coming soon"), which is compliant.
3. Never claim approval until Play Console shows the release as *Available*.

## Release steps
1. Internal testing → install from Play on 2–3 real devices; run `docs/QA_TEST_PLAN.md`.
2. Closed testing with ≥12 testers for 14 days (required for new personal developer accounts).
3. Production with staged rollout 20% → 50% → 100%, watching Play vitals (crash/ANR).
4. Rollback: halt rollout, ship previous build with higher `versionCode`.

## AdMob (later)
Create the AdMob app + one adaptive banner unit → set `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADS_ENABLED=true` in EAS env, configure the UMP consent message in AdMob → Privacy & messaging, update Data safety + "Contains ads", rebuild. Banners appear only on the couple dashboard, never on sign-in, gift/payment, receipt or guest pages, and never for Premium registries.
