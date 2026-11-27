# Google Play release kit — Paisa Kidhar

Package: `com.winplaybox.paisakidhar` · Category: **Lifestyle** · Contains ads: **Yes** for the current ads-enabled build profile · Price: Free. Digital checkout is disabled on Android by default.

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
| Ads | Yes for the current ads-enabled profile. Verify against the AAB being submitted. |
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
| Device or other IDs | Yes for an AdMob-enabled build | Review the current [Google Mobile Ads SDK disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure) | Advertising, analytics | Verify against the consent and SDK configuration |

Encrypted in transit: Yes. Users can request deletion: Yes. Payment info (cards/UPI) is handled by Dodo Payments' checkout and by the guest's own UPI app — not collected by the app.

## Policy notes (read before submitting)

1. **Guest gifts** are UPI deep links (`upi://pay`) into the guest's own UPI app — peer-to-peer transfers, not purchases inside the app. Not subject to Play Billing.
2. **Premium and paid Shagun Cards** are digital feature unlocks. The current Android profile keeps `EXPO_PUBLIC_ANDROID_EXTERNAL_BILLING=false`, even when web checkout is enabled. Keep it false for Play releases unless the distribution and billing integration have been approved under [Google Play's Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738).
3. Never claim approval until Play Console shows the release as *Available*.

## Release steps
1. Build a signed AAB using the existing EAS `production` profile. The EAS submit profile targets **internal testing as a draft**; it does not publish the app.
2. In Play Console, finish the listing and declarations and provide reviewer access. Install from Play on 2–3 real devices; run `docs/QA_TEST_PLAN.md`, including sign-in with the Play signing key and Android App Links.
3. Complete any account-specific [closed testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465) shown in Play Console, then submit for production review. Use a staged rollout for updates where Play offers it and watch Play vitals.
4. Rollback: halt a staged rollout; if needed, ship the previous code with a higher `versionCode`.

## AdMob (enabled in the Android build profile)
`EXPO_PUBLIC_ADS_ENABLED=true` is enabled in `apps/mobile/eas.json` with banner, interstitial (3-minute cap, shown at natural pauses after publishing or confirming a gift), and app-open (2-hour cap, never on cold start) units.
- Ensure Play Console **App content → Ads** is set to **Yes, my app contains ads** and **Data safety** includes Device or other IDs (shared with Google AdMob).
- Banners appear only on the couple dashboard (`home`, `goals`, `gifts`), never on sign-in, guest gift/payment, receipt or card screens, and never for Premium registries.

## ASO & Play Store Listing Optimization
- **Primary keywords:** `indian wedding registry`, `shagun upi`, `wedding cash gift`, `honeymoon fund india`, `digital shagun`, `shaadi gift list`
- **Title (≤30 chars):** `Paisa Kidhar: Wedding Registry` (30 chars)
- **Short description (≤80 chars):** `Skip duplicate gifts. Share wedding goals & get shagun directly via UPI.` (72 chars)
- **Screenshot captions:**
  1. `Create your wedding dream list in 2 minutes`
  2. `Receive shagun straight to your UPI ID — 0% fee`
  3. `Share QR & link on WhatsApp and Instagram`
  4. `Track every gift & blessing in one dashboard`
- **Localization:** Add Hindi (`hi-IN`), Gujarati (`gu-IN`), and Marathi (`mr-IN`) store listings in Play Console matching `apps/mobile/src/i18n/locales/`.

<!-- old note: -->
Create the AdMob app + one adaptive banner unit → set `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADS_ENABLED=true` in EAS env, configure the UMP consent message in AdMob → Privacy & messaging, update Data safety + "Contains ads", rebuild. Banners appear only on the couple dashboard, never on sign-in, gift/payment, receipt or guest pages, and never for Premium registries.
