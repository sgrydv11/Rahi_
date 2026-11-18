# Verified frontend/backend deployment — 18 November 2026

Live app: https://rahi-1-c3vn.onrender.com
Runtime commit: d0a2741d78ef63b99d667094a18feb66648ae344
Branch: app_v1
Render service: srv-dbmrvumgekts73earsag
Render deployment: dep-dbuq6s6i0phs73bcqtm0
Dashboard: https://dashboard.render.com/web/srv-dbmrvumgekts73earsag/deploys/dep-dbuq6s6i0phs73bcqtm0
CI: https://github.com/sgrydv11/Rahi_/actions/runs/44310785209 (success)

The existing Docker service builds the web frontend and bundles it into the Spring Boot backend container. Both are deployed together. Render reported Deploy succeeded / Live, duration 3m 31s. Runtime logs confirm schema public upgraded from V27 through V28 (chat membership) and V29 (pins, isolated demo wallet, consent).

Configuration changes: DEMO_WALLET_ENABLED=true; OTP_EMAIL_FROM_NAME=FlexiRides. Other credentials and security settings were preserved. Demo funds remain separate from provider wallets and ride payments.

Validation:
- Complete backend suite: 195 tests, zero failures/errors/skips; package successful.
- Frontend: 71 tests and production build passed. Native: 35 tests, TypeScript and Android JS export passed; no APK created.
- GitHub client and backend regression/smoke jobs all passed.
- Live API health UP, existing demo-account login successful, four chat groups expose membership/pin fields, demo-wallet endpoint enabled, anonymous wallet access denied, consent omission returns validation errors, Google client ID present, dated Indore–Ujjain search returns rides.
- Browser confirms FlexiRides branding, separate draft-policy checkboxes, named-route autofill, six rides for 19 November and compact chat group rows. No live chat messages, bookings or wallet transactions were created during verification. Only the temporary verification session was revoked; existing user sessions were kept.

Remaining limitations:
- Razorpay and Stripe merchant credentials are still unconfigured. Static demo card uses play money only; no real charge or bank payout.
- Terms & Privacy pages are explicitly drafts awaiting owner review.
- Mobile source is pushed, but the installed APK is unchanged. Build a new APK only when requested, then perform device verification.
- Local QA chat/phone seeds were not applied to production.

Local evidence (ignored by Git): .local/render-deployed-2026-11-18.png, .local/live-signup-2026-11-18.png, .local/live-rides-2026-11-18.png, .local/live-chat-2026-11-18.png, .local/live-deployment-verification.json.
