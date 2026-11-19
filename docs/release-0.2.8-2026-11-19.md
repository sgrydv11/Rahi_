# FlexiRides 0.2.8 release — 19 November 2026

Branch: app_v1
Application/runtime commit: 2591f5f447d04baa6a73646e19164e9a60de04b2
CI-fixture-only follow-up: 47a974e1f297dd12ca71570df0feae7d90a80b8f (no application runtime changes)
Website and API: https://rahi-1-c3vn.onrender.com
Render deployment: dep-dbvc79brjlhs73ecgl2g — Deploy succeeded / Live (3m 28s)
Database migration: V30 applied successfully to live schema public.
CI: https://github.com/sgrydv11/Rahi_/actions/runs/44499487502 — all three jobs succeeded.

Includes top Choose a ride dropdown, 1–4 seat choices, city-specific boarding/drop dropdowns, explicit driver/vehicle detail panels, repaired Android reply icon and tap/focus behavior, private driving licence/RC/insurance submission, staff manual review and backend enforcement before new offers. Wallet remains Coming soon.

Verification:
- 201 backend tests passed in the corrected CI run; frontend 71 and native 37 tests passed.
- Packaged-server HTTP smoke passed both locally and in CI: fictional document submission and admin approval, verified publication, public search/details, simultaneous last-seat booking, idempotent retry, booking history, cancellation and seat restoration.
- Live API health UP; private verification owner/anonymous/passenger access enforced; ordinary-user admin access denied; unverified offer rejected; Google configured, four chat groups, dated search returns rides. Temporary verification sessions revoked. No real documents, live bookings or approval records created during live smoke checks.
- Deployed frontend assets include the new verification/review panels, dropdown/detail updates, reply tap-target change and Wallet Coming soon.

Android:
Version 0.2.8 / versionCode 10 / com.hoopr.app
Build: https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/52fca6fd-4e30-45e8-b7a8-80cdfdcb18be
APK: https://expo.dev/artifacts/eas/0un_zx8f3GjNw0K0UWaN_DGE2WBS-5YaoLzKzROmCPU.apk
Build FINISHED. Download verified: 91694698 bytes.
SHA-256: e6c3a15013f289fd9d12ce7280c1c6fc250f35430f87dec3ebe80b824d7a0334
APK v2 signature verified; existing signing certificate retained. Verified package/version, production API, Google/push/contacts/location native modules, document-picker native module, Firebase configuration, consent and first-open access setup, ride dropdown, driver verification and reply icon.

Remaining limitations:
- Android physical-device taps/swipes, document picking/upload and background push delivery need on-device verification. No iOS build was created.
- Document verification is manual staff review, not government-record validation or liveness checking. Existing users/demo vehicles were not automatically approved.
- Draft policies, identity-document retention/deletion procedures and independent staff review must be finalized before onboarding real identity documents. Private uploads must never be posted to chat.

Ignored evidence: .local/render-deployed-028.png, .local/release-028-live-api.json, .local/release-028-live-web.json, .local/release-028-apk-verification.json.
