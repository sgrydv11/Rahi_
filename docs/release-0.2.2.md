# FlexirRides 0.2.2 release verification

Release prepared 14 November 2026 from app_v1. Android versionCode 4.
This document records the release requested after the combined UI/security audit.

## Tested before release

- Fresh isolated PostgreSQL schema: all 157 backend unit/integration tests pass
  in one full run, executable package succeeds.
- Web: 57 tests and production build pass.
- Mobile: 24 tests, TypeScript, Android and iOS bundle exports pass.
- Browser: 72 route/viewport checks, 25 internal links, no horizontal overflow
  or page errors. Menu, metadata, favicon, logo, contact links, profile
  success/error and logout feedback pass.
- Two-user chat: published ride share, contact opt-in/member card, quoted reply,
  cancel reply, reload persistence and footer pass. Booking from the chat card
  reduces live seat availability. Backend tests cover invalid reply/ride targets,
  idempotency, inactive accounts and message limits.
- Signup verification UI, incorrect-code recovery, resend cooldown, password
  eye, calendar, women-only control and email-code login UI pass. UI email
  transport is mocked; service tests cover OTP persistence and verification.
- Packaged HTTP: password lockout across email/mobile, immediate access/refresh
  logout revocation, booking race/replay/cancellation/seat restoration pass.

## Deployment and build

Source commit `d168d0b96a2e01c7b8f202e43d00c9e5087a3d68` is pushed to app_v1.
Render deployment `dep-dbrmblh42hec73cc370g` succeeded and is Live. Logs confirm
V21, V22 and V23 applied successfully to the live public schema. Live health,
17 read-only API/asset checks and 24 responsive public-UI checks passed. Release
asset hashes match the local production build. City/date search returned rides;
protected chat correctly requires sign-in. No community messages were posted.
GitHub run 43493200825 completed successfully (both clients and backend).

Expo build `abbcb267-192a-4770-96e2-bff8747936fc` is submitted for version 0.2.2,
versionCode 4, from the same source commit. The signed APK finished successfully and its direct download was verified.
ZIP CRC integrity passed, Android manifest contains version 0.2.2 and
com.hoopr.app, native Google Sign-In is present in DEX, and the APK v2 signing
certificate matches the previous APK. Build page:
https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/abbcb267-192a-4770-96e2-bff8747936fc
The existing combined Render service deploys frontend and backend together;
Flyway applies additive V21–V23 (chat contacts/replies and login security).
No destructive migration or demo data reset is included.

## Known acceptance limits

Google native integration is included but cannot authenticate until the user
configures Google Cloud clients and GOOGLE_CLIENT_ID. Password/email-code login
remain available. See google-android-setup.md.

No Android SDK, emulator or connected-device test environment is available on
this computer. Cloud build/export checks do not replace installed-device
acceptance. iOS export passes, but no signed iOS build was requested or created.
No live community test messages, real payment or release email is sent.

Password-reset/email-change product flows, admin MFA, production key/default
administrator verification and real-provider/device acceptance remain as listed
in combined-ui-security-audit-2026-11-14.md.


## Final release outcome

- Web: https://rahi-1-c3vn.onrender.com/
- Android APK: https://expo.dev/artifacts/eas/gFhleznoBetWLxSb9xPa3pI9FNtKBq3aQMkgt9Jp0As.apk
- Expo: https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/abbcb267-192a-4770-96e2-bff8747936fc
- APK bytes: 90575140
- APK SHA-256: `7de27a75238c0a9d0ba752e6c243a09fa83374cec8730bbb0a0c0e9647dd3fab`
- Confirmed signing certificate SHA-1: `2E:E9:73:F7:5E:B9:68:C0:8E:F7:BD:0E:4E:81:81:00:E3:0E:82:F7`
- Render deploy: dep-dbrmblh42hec73cc370g (Live); public schema V23.
- Hosted CI: https://github.com/sgrydv11/Rahi_/actions/runs/43493200825 (success).
- Release code: d168d0b96a2e01c7b8f202e43d00c9e5087a3d68 on app_v1.
- Live selected-day search rendered 15 ride cards at phone width, detail link
  and Book Seat control verified. Additional local ambiguous-delivery test
  confirmed draft retention and same-key retry without duplicate chat messages.
- This verification-only documentation update uses [skip render] [skip ci];
  deployed code and APK source remain the release commit above.
- Physical Android acceptance and real Google OAuth configuration are still
  pending. No signed iOS app, live community message or release email was sent.
