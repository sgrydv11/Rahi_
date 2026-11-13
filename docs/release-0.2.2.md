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

Pending at source commit: Git push, Render deployment and Expo signed Android
APK. Final identifiers and live checks will be recorded after completion.
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
