# Verified signup and reference layouts (0.2.1)

Web and native signup now request an email verification challenge with the
selected password and mobile number. An account and session are created only
after the six-digit code is verified. V20 stores a BCrypt password hash on the
pending challenge; raw passwords and codes are not persisted. Wrong, expired,
reused or locked codes cannot create an account. Signup cannot replace an
existing account's password. Resend retains the existing 60-second and hourly
limits. When EMAIL_OTP_ENABLED is true, legacy password-registration endpoints
reject requests with an instruction to use verified signup. Existing accounts
can still sign in with their current password.

Both clients have an eye button inside the password field, stacked From/To
fields, Today/Tomorrow date choices, calendar-icon date selection, a women-only
switch, compact ride cards and a messenger-style community chat. The results
toolbar has Filter & sort plus AC shortcuts. Ride cards show stored departure
times and fares; no estimated arrival time or promotion is fabricated. Chat
keeps the existing shared-room and booking behavior with a pinned composer.
Call buttons, media upload and read receipts are intentionally absent because
those features are not implemented.

Verification on 13 November 2026:
- Backend test reports: 140 tests passing, including database signup tests,
  authentication/security, chat and earlier booking/ride regression checks.
- Web: 54 tests and production build passed. Legacy timezone safety is retained.
- Mobile: 22 existing tests passed; TypeScript and Android/iOS exports passed.
- Browser: simulated email-provider UI test covers the inline eye, code stage,
  resend guard, wrong-code recovery, successful verification, calendar changes,
  women-only toggle and result cards. Actual challenge/account/password behavior
  is tested separately against PostgreSQL in EmailOtpIT.
- The two-user local browser test passed ride sharing, booking from chat,
  availability refresh, replies, reload persistence and phone-width footer access.

Run scripts/browser-signup-ui-smoke.cjs and scripts/browser-chat-smoke.cjs only
with the isolated local API on 8083 and frontend on 5174. Production email OTP
delivery was previously confirmed by the user after Brevo/Render configuration.
A physical-device test is still needed for keyboard, native picker and install UX.

Release 0.2.0 finished before the user supplied these references. It is superseded
by 0.2.1 (Android version code 3). Do not send the older drafted release email.
Publish and verify the replacement backend/frontend and signed Android artifact
before sending the requested release announcement.
