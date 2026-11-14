# Google Play and AdMob release checklist

## Store listing
- App title, short description, full description, category, tags and contact details.
- Icon: 512×512 PNG.
- Feature graphic: 1024×500.
- Phone screenshots and tablet screenshots where supported.
- Optional promo video; splash/adaptive icon assets.
- English listing first; localization readiness for Hindi and regional languages.

## Policy and declarations
- Public privacy policy URL, terms, support URL/email.
- Data safety form aligned to actual SDKs and data flows.
- Content rating, target audience, ads declaration and app access instructions.
- Account creation/deletion disclosures and data retention details.

## Android release
- Confirm package ID and signing strategy.
- Configure Play App Signing and protect upload key.
- Version code/name, internal/closed testing, pre-launch report, staged rollout and rollback notes.
- Never commit signing credentials.

## AdMob
- Configure app ID and ad unit IDs only when supplied.
- Use test ads during development.
- Implement consent/privacy requirements and verify current policies.
- Keep ads away from authentication, payment, receipt and contribution confirmation.
- Enable production ads only behind a reviewed feature flag after policy and release checks.
