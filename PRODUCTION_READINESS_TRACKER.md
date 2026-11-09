# FlexirRides carpool readiness tracker

Last updated 7 November 2026, Asia/Kolkata.

## Purpose and working agreement

This file is the persistent plan, evidence record, and handoff for work across account usage resets. Update it after each completed task, significant discovery, or blocker. Read it at the start of every resumed session and verify the actual repository state before continuing.

- Current objective is a reliable, testable carpool pilot, followed by the remaining production readiness work.
- Active service is scheduled carpooling. Rentals will have a clearly labelled Coming soon card without booking actions. Rental implementation is excluded from this plan.
- Use FlexirRides as the customer-facing brand and blue as the primary theme.
- Create an APK only when the user explicitly commands an APK/app build. Do not submit EAS builds automatically after changes.
- Preserve existing uncommitted work. Do not reset, discard, or overwrite unrelated changes.
- Account limits are not visible to the agent. Do not promise that this backlog fits the remaining allowance. Record a handoff before stopping.
- The original tracker session was planning-only. Implementation progress is recorded below.

## Current baseline and evidence

Repository branch at inspection is `app_v1`. Backend, web frontend, and mobile app share this repository. Existing changes are uncommitted in frontend configuration and mobile source, configuration, dependencies, and assets.

The supplied Sarthi Phase 1 package is at `C:\Users\INDIA\Downloads\Rahi\Sarthi_Phase1_Complete_Project_Package`. Its 378 manifest entries matched their SHA256 hashes during the previous read-only review. Its carpool, safety, finance, and operations requirements inform this plan. The user's carpool-only scope overrides the package's rental implementation scope.

| Capability | Evidence currently available | Readiness |
| --- | --- | --- |
| Render backend | Previously returned health UP and live ride data | Needs fresh verification |
| Browser discovery | Previously searched Indore to Ujjain and opened ride details | Browser path previously verified |
| Mobile authentication | Email/password, refresh tokens, secure storage implemented | Installed-device flow unverified |
| Carpool | Search, details, publishing/editing, bookings, cancellation, trip controls implemented | End-to-end device flow unverified |
| Seat holds and wallet | Code and 10 existing mobile logic tests | Full integration unverified |
| Money movement | Test-mode gateways and sandbox withdrawals | Production gap |
| Mobile UI | Blue theme, brand, logo, menu, footer, calendar/time picker and keyboard changes implemented | Device behavior unverified |
| Build verification | TypeScript, 10 mobile tests, Android/iOS JS export passed in prior sessions | Does not establish device correctness |
| Latest delivered APK | Expo build `2af77503-e441-4101-a681-f6da09e0b66e` finished | User confirms it works but feels insufficiently smooth |
| Production controls | No complete verification, safety, support, finance or admin workflow identified | Missing or incomplete |

The earlier failed Expo build was repaired by deduplicating `expo-font` to SDK 54-compatible version `14.0.12`. This explained a build failure. The user clarified that the app works but feels insufficiently smooth. Performance and usability issues need targeted reproduction.

Backend base URL previously configured is `https://rahi-1-c3vn.onrender.com/api/v1`. Demo records contain dated departures, so a drop in available ride counts after departures pass does not alone establish an API fault. Use dedicated test data and avoid changing real bookings during verification.

## Status and completion rules

Statuses are TODO, ACTIVE, BLOCKED, IMPLEMENTED, and VERIFIED. IMPLEMENTED means code exists. VERIFIED requires the listed acceptance evidence. Record partial results explicitly and never turn a successful build or health request into a claim of complete application functionality.

Planning baseline contains 20 work packages. At tracker creation, 0 of these packages are verified complete. Existing implementation is credited in the baseline table. Package counts are not effort-weighted completion percentages.

## Stage A — diagnose and stabilize the existing app

Planning budget is approximately 4–8 engineering hours for diagnosis and selected priority fixes. Scope must follow observed failures rather than a fixed completion promise.

| ID | Status | Work and acceptance evidence |
| --- | --- | --- |
| A01 | ACTIVE | Reproduce the installed APK performance and usability problems. Record device/OEM, Android version, exact APK/build, install versus upgrade, failing steps, expected/actual outcome, crash logs and failing requests. Identify the root cause before broad changes. If no device access exists, record the specific limitation and continue static/API investigation. |
| A02 | ACTIVE | Verify backend and mobile contracts for public search, login, refresh, profile, vehicles, ride creation, booking and cancellation. Confirm embedded API configuration, demo flag, errors, authentication and startup behavior. Record endpoint results without secrets. |
| A03 | IMPLEMENTED | Fix confirmed startup/session/network defects. Inspect missing request timeout/cancellation, indefinitely waiting screens, refresh failures, transient network recovery and logout cleanup. Preserve secure token rotation and distinguish offline failure from invalid credentials. Regression-check each confirmed fix. |
| A04 | ACTIVE | Make keyboard, navigation and forms usable on supported devices. Test focused fields, long forms, back/menu/footer, safe areas, date/time editing, AM/PM, timezone conversion and validation. Record device evidence and remaining limitations. |
| A05 | IMPLEMENTED | Present Carpool as the active service and Rentals as Coming soon. Keep the rental placeholder informational and inaccessible to booking or payment actions. Verify branding and navigation consistency. |
| A06 | TODO | Prove the core journey using separate provider/passenger test accounts. Publish a future ride, search, inspect, book, verify both accounts, cancel and confirm seat restoration. Test restart and session expiry. Use sandbox payment where applicable. |

Stage A exit requires reproducible failure diagnosis, verified core journeys on an actual Android device, and no unresolved startup or core-flow blocker. If device access is unavailable, report the pilot as device-unverified.

## Stage B — dependable closed carpool pilot

Provisional estimate is 5–10 working days, subject to Stage A findings and available integration access.

| ID | Status | Work and acceptance evidence |
| --- | --- | --- |
| B01 | TODO | Define pilot acceptance and rollout boundaries. Default corridor is Indore–Ujjain in both directions, consistent with the package. Record whether existing Dewas/Pithampur functionality remains available before changing route eligibility. Establish supported Android/iOS versions and assign each blocking defect an owner. |
| B02 | ACTIVE | Establish critical automated regression coverage for public/authenticated API contracts, session recovery, inventory, cancellation and UI navigation. Run existing appropriate suites and investigate failures. Avoid tests that only mirror rendering details. |
| B03 | VERIFIED | Verify race and retry behavior with a real PostgreSQL test database. Cover two users competing for the last seat, duplicate booking/checkout, expired holds, cancellation races and interrupted requests. Require no overselling or duplicate charge. |
| B04 | TODO | Complete booking and trip recovery UX. Cover pending payment, expired holds, provider cancellation, stale data, app termination and reopening, refresh, actionable errors and empty/offline states. Server records remain authoritative. |
| B05 | TODO | Establish staging diagnostics and handoff evidence. Add actionable redacted error/crash reporting, request correlation, environment checks and a reproducible smoke checklist. Record device/network results and pilot approval. |

Stage B exit requires successful multi-account journeys, verified inventory/retry behavior and a closed-pilot defect review. This is not full production approval.

## Stage C — production carpool capabilities

These are substantial workstreams, provisionally 6–10 weeks for a small team with provider access. Re-estimate after the pilot backlog and provider decisions are known.

| ID | Status | Work and acceptance evidence |
| --- | --- | --- |
| C01 | TODO | Identity, consent and eligibility. Implement OTP/recovery, versioned consent, identity/licence/vehicle evidence, review/resubmission, expiry reminders and backend eligibility blocking. Verify unauthorized API attempts fail. |
| C02 | TODO | Discovery and recurring commute. Implement approved corridor/hub matching, map/address selection, route and time preferences, recurring occurrences, waitlist behavior and cancellation policies. Agree matching and contribution rules before implementation. |
| C03 | TODO | Active-trip safety. Implement pickup PIN, controlled trip states, location freshness, permission recovery, trip sharing, offline trip card and SOS/incident ownership. Complete a staffed safety exercise. |
| C04 | TODO | Production finance. Select approved payment/payout model, certify live integrations, signed webhooks, duplicate/out-of-order event handling, ledger, refunds, payouts, invoices and daily reconciliation. Replace sandbox withdrawal behavior for live operations. Require authoritative provider confirmation. |
| C05 | TODO | Support and operations. Build minimum role-based verification, support, safety, finance and administration workflows with privileged MFA, audit trails, restricted data, escalation and intervention limits. Complete support/payment dispute drills. |
| C06 | TODO | Privacy and security. Define retention, export/deletion, evidence access, secrets, rate limits, upload protection and threat model. Run dependency/security checks, penetration testing and remediation with evidence. |
| C07 | TODO | Localization and accessibility. Complete English/Hindi strings, screen-reader/focus behavior, large text, contrast, touch targets and non-map alternatives across the active carpool journeys. |
| C08 | ACTIVE | Reliability and release infrastructure. Isolate staging/production data and credentials, add monitoring/alerts, durable background work, CI checks, migration rehearsal, backup/restore and rollback evidence. Validate hosting capacity and region against approved requirements. |
| C09 | TODO | Production readiness and rollout. Agree load model and measure performance, crash-free sessions and availability targets. Complete provider/operations/legal/finance readiness, device field pilot and signed go/no-go. Stage rollout with monitoring and rollback ownership. |

Package targets include booking-core availability of 99.9%, search P95 below 1 second, quote P95 below 1.5 seconds, and crash-free sessions above 99.5%. Define measurement windows and load before evaluating them. Treat backup RPO/RTO proposals as pending approval.

## Dependencies and decision points

- Device access or usable crash/network logs are required to substantiate the reported APK defect and device fixes.
- Production OTP, maps, verification, push, payment and payout integrations require provider selection, credentials and sandbox/live certification.
- Pricing, cancellation, refund, waitlist, identity eligibility and recurring-commute rules must be recorded before their affected implementation starts.
- Qualified service, privacy, insurance and payment reviews plus staffed support/safety response are production launch dependencies described by the supplied package.
- Existing API and database compatibility must be preserved through staged migrations. Do not rewrite the app or backend solely to match document terminology.
- Ask for the user's explicit build command after code verification. Record build ID, source revision, environment and artifact only when a build is authorized.

## Evidence log

| Date | Task | Result | Evidence or limitation |
| --- | --- | --- | --- |
| 2026-11-07 | Planning | Completed | Created this tracker following read-only package/code assessment. No implementation or APK build performed in this session. |
| 2026-11-07 | Checkpoint push | Completed | Commit 5df2b63 pushed to origin/app_v1 with accumulated mobile changes and this tracker. |
| 2026-11-07 | A01 | Active | Requested failure symptoms and phone/Android version. Standard local Android SDK adb path is absent. Runtime cause remains unconfirmed. |
| 2026-11-07 | A05 | Implemented | Added informational Rentals Coming soon card with no booking/payment actions. Mobile TypeScript check passed. Device verification pending. |

For subsequent entries record commands/tests, relevant commit or files, device, outcome, remaining defects and links/log locations. Keep credentials, tokens and private identity data out of this file.

## Resume handoff

- Latest pushed checkpoint before this work is cb9729b on origin/app_v1. Current changes add request/session regressions, screen-request cancellation, navigation/reconnect UX and CI checks. Device verification remains pending.
- Next tasks are A01/A04 device smoothness verification and A06 multi-account device journey. Obtain the affected interaction and phone model, then profile that path. Continue B04 interrupted-booking recovery and B05 operational diagnostics. C01 live OTP/KYC waits for provider setup.
- No specific cause of the reported rough experience has been confirmed. Do not describe the application as crashing based on the earlier report.
- Existing uncommitted implementation must be reviewed and preserved.
- APK builds require an explicit user command. Current authorization covers implementation and testing.
- On resuming, inspect branch/status, read this file, mark one task ACTIVE, gather evidence, implement only authorized changes, then update status and this handoff before stopping.
- Suggested user resume message is `Continue from PRODUCTION_READINESS_TRACKER.md. Work on the next pending carpool task. Build an APK only when I explicitly ask.`

User clarification on 7 November 2026: the app works, but feels insufficiently smooth. Requested the worst affected interaction and phone model. A01 now focuses on performance/usability profiling.

A02 observation on 7 November 2026: health and public ride requests from this machine each exceeded 45 seconds. Cause is not yet isolated between service availability and network path. A03 partial implementation adds a 20-second mobile request timeout with cleanup and a refresh/status recovery message. TypeScript and an isolated successful-response/timeout/timer-cleanup regression check passed. Device and live API recovery verification remain pending.

## Implementation session on 7 November 2026

- User confirmed no production OTP or KYC provider accounts exist. C01 live integrations are blocked on provider setup. Other development continues.
- A02 live checks passed for public search, mobile login, profile, passenger bookings, own rides, token refresh and logout. Health took 0.85 seconds; search/login approximately 5–6 seconds; subsequent reads approximately 0.3–1.0 seconds. No ride or booking was modified in these live checks.
- A03 added malformed-response/offline errors, cancellation for ride/booking/notification reads when screens close, and session reconnection after temporary restoration failures. Transient failures preserve credentials; invalid refresh clears them.
- A04 added a passenger-bookings shortcut in My rides, clearer empty/loading states and root-based footer navigation to avoid stacking repeated tab visits. Device acceptance remains pending.
- B02 mobile tests now cover transport timeout, body timeout, cancellation, public access, malformed responses, network errors, concurrent refresh, invalid sessions and temporary server failures. All 20 mobile tests passed. TypeScript passed.
- C08 added .github/workflows/checks.yml with mobile/frontend checks and backend unit/integration tests on a dedicated PostgreSQL service. Hosted CI passed for mobile, frontend and backend in run 42371688074. The workflow performs regression checks only.
- Backend verification completed on Java 21 against isolated schema regression_20261107174202 in hoopr_test. All 110 backend tests passed, including inventory races, idempotency, hold expiry, cancellation/refunds and sandbox payments. Frontend passed 52 tests and its web build. B03 is verified for the existing supported backend flows; device end-to-end testing is separate.

- Frontend validation passed all 52 tests across 9 files and the production web bundle check.
- The initial backend run reported 107 passes and 3 failures against an already-seeded test database. Failures involved expired demo departures and global search assumptions. A fresh isolated schema under hoopr_test is being used for the verification rerun, preserving public-schema demo data. Java 21 matches the project target.
- Startup now allows home/search browsing during session restoration; account-dependent screens retain their session gate.

Final verification for this implementation batch: 20 mobile tests, mobile TypeScript, 52 frontend tests plus web build, and 110 backend unit/integration tests passed. Isolated schema was retained for diagnosis. Public demo data was preserved. Workflow YAML parsed successfully; hosted execution passed in GitHub run 42371688074.

GitHub checkpoint ad0d48f is pushed to app_v1. Hosted workflow run 42371688074 passed all three jobs (mobile, frontend and backend), including backend integration tests on PostgreSQL 16. Run URL https://github.com/sgrydv11/Rahi_/actions/runs/42371688074 . APK/device acceptance and production-provider-dependent work remain pending.

## Server and deployment verification on 7 November 2026

- Rebuilt backend executable JAR with Java 21 and all 110 unit/integration tests in an isolated releasecheck schema. All passed. Mobile 20 tests and TypeScript passed; frontend 52 tests and web build passed again.
- Started rebuilt local backend at http://localhost:8081 and frontend at http://localhost:5173. Backend health, frontend HTTP response and frontend API proxy health returned 200.
- Local public schema is at Flyway V14 and up to date. No new schema migration is required for this batch. Hibernate schema validation passed. Existing development and production business records were preserved.
- Added scripts/smoke-carpool.mjs and ran it against a separate local server/schema on port 8082. Registration, login, publishing, public discovery, last-seat race, idempotent replay, owner/passenger booking access, cancellation and seat restoration passed. Test sessions logged out and the test ride was cancelled.
- CI now packages the backend and runs the same smoke script against the actual executable server after unit/integration tests. Hosted run 42373391239 passed backend packaging plus the real HTTP smoke test, frontend checks and mobile checks.
- Live Render checks passed actuator database health, API health, Indore–Ujjain search, demo login, profile, bookings, wallet and logout. No live rides/bookings were modified.
- Remote redeployment remains unconfirmed. Computer-use ended because it could not verify the current Windows browser URL. No Render API credential/deploy hook is configured. User reports Chrome is signed in. Manual path is Render service Settings → confirm app_v1 branch, then Manual Deploy → Deploy latest commit. Verify logs reach V14/up-to-date and health succeeds. Do not paste credentials into chat.

Release verification checkpoint e1254b7 is pushed. GitHub CI https://github.com/sgrydv11/Rahi_/actions/runs/42373391239 passed all jobs, including the packaged-server smoke test. Local main servers remain running; the isolated smoke server has been stopped. Remote Render redeployment is awaiting the user-selected manual action because browser control was stopped. Existing live service health and read-only functionality passed; its running commit has not been verified.

## Google web sign-in implementation on 7 November 2026

- Added Google Identity Services to both web login and registration, sharing the existing CSRF-protected login/session flow. Backend verifies Google RS256 signatures, issuer, audience, expiry, subject and verified email.
- Added GOOGLE_CLIENT_ID backend configuration and public /api/v1/auth/google/config. Configuration is absent until the user creates a Google OAuth Web Client ID. The UI clearly marks sign-in as awaiting setup and keeps email/password available.
- Flyway V15 adds users.google_subject and a unique index. Gmail/Workspace linking uses verified authoritative identity; third-party email collisions require the existing sign-in method. First sign-ins are serialized to avoid duplicate accounts. Existing password hashes/preferences remain intact.
- User requested Google OAuth setup steps. Steps are documented in README.md. Real Google-account sign-in remains blocked on client ID, authorized JavaScript origins and user consent/testing configuration. This implementation covers the web frontend.
- Frontend 53 tests and web build passed. Backend signature/security/account-linking/session/migration regressions are running. Record final results and deployment state below.

Google verification results: backend regression reports total 123 tests with 0 failures and 0 errors. Full suite passed, then the final token-validator/web-security changes were retested and packaged. Frontend 53 tests and production web build passed. V15 was validated in an isolated schema. Local backend restart is applying V15 to the development database. Real Google sign-in is pending the user's public OAuth Web Client ID and origin configuration.

Google checkpoint cc4da23 is pushed to app_v1. Local backend restarted successfully and applied V15 to the development public schema. GET /api/v1/auth/google/config returns an empty clientId as expected before setup. A CSRF-protected Google sign-in attempt returned the intended 503 setup-required response. Real-account verification and Render configuration remain pending the OAuth Web Client ID.

User-authorized Android preview APK build completed successfully on 7 November 2026. Expo build c133660a-1edb-42a9-a8df-46485f57eb67. Install URL https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/c133660a-1edb-42a9-a8df-46485f57eb67 . Uses the configured Render API. Google sign-in remains a web-only implementation pending OAuth configuration. Device installation and runtime acceptance remain pending.

## Requested ride and OTP changes — 9 November 2026

Work in progress on app_v1. No deployment or APK has yet been produced for this batch.

- Implemented: email OTP signup/login (no name/password UI), mobile collection unverified, guest email verification; women-only rides; staged boarding/drop and passenger details; server-owned fares; city-gated search, date shortcuts/calendar, time/range, sort and preference filters; car/AC/route/flexible-stop offering; public reviews and completion rating; four footer tabs and hidden timezone UI.
- Added Flyway V16 (ride preferences, passenger snapshots and review text) and V17 (email challenges and unverified mobile). Existing records preserved with legacy compatibility.
- Verified: 53 frontend tests and production build; 20 mobile tests and TypeScript; focused backend OTP and ride integration/security tests. Full backend suite/package currently running in isolated hoopr_test schema.
- User confirmed email OTP first, SMS later, and Women means women-only rides. Real email sending requires Resend API key and sender domain in Render. Never commit or print these secrets. Setup guide is EMAIL_OTP_SETUP.md.
- Pending: full backend regression, new OTP client regressions, packaged-server smoke, browser/device acceptance, push, Render deployment/migrations and explicit-request Android preview build. Email delivery and real-account end-to-end verification await user provider setup.
- Mobile-number login is not enabled while SMS is unavailable. Do not claim the collected number is verified. Existing password APIs are retained for older installed APK compatibility; new UI uses email OTP.

### Consolidated request coverage

| Request | Implementation | Acceptance remaining |
| --- | --- | --- |
| BUG-001 / CR-001 / CR-002 / CR-017 | Input validation; name-free email OTP signup and login; mobile collected | Real email provider delivery; mobile login/SMS deferred |
| CR-003 | Guest verifies email and collects mobile before booking | Live sender/device journey |
| CR-004 / CR-016 / CR-018 | Server-owned fare, offered stop selection, passenger name/age/gender and recent passenger reuse | Device journey |
| BUG-005 / CR-005 / CR-006 / CR-007 | City-gated search; Today/Tomorrow/Calendar; exact time/ranges; women-only | Device usability |
| CR-008 / CR-009 / CR-010 / CR-015 | Separate results, six sorts, time/stop/AC/flexible filters | Device usability |
| CR-011 / CR-021 / CR-022 | Car declaration, stops, nearby-drop preference, transparent price message and route types | Driver acceptance |
| CR-013 / CR-014 | Four footer tabs; top account/settings removed; timezone hidden | Device layout |
| CR-019 / CR-020 | Reviews in results and completion-rating modal | Completion/device journey |

Final automated reports after affected-test rerun: 131 backend tests, zero failures/errors; 54 web tests and web build; 22 mobile tests and TypeScript; Android and iOS bundle exports passed. Initial full backend run found whitespace name validation regression and an obsolete search mock; both corrected, affected 36 tests passed. Packaged-server smoke is in progress on schema smoke_20261109003829, port 8082.

Expo Android preview build submitted: e766971b-f75a-4c3e-8b35-82bf6b02d6cc. Build source contains current mobile changes. Await final status before reporting a download.

Render browser access remains unavailable: broad inventory was rejected by automatic review because private Gmail was open; targeted Chrome Render access reported browser unavailable. No Render API/deploy hook is configured. Do not claim production deployment has succeeded. Browser acceptance verified local city/date results navigation and email/mobile-only registration form. Resend sender setup and real OTP delivery remain pending.

Packaged server smoke passed registration, legacy-compatible login, publish/search/details, last-seat concurrency, idempotent replay, private history, cancellation and inventory restoration on isolated schema. Unconfigured native email OTP correctly returned HTTP 503. Smoke account fixture names were updated to satisfy the newly enforced name validation. Existing local main server is being restarted with V16/V17; no production database was modified in local verification.

Checkpoint 6208577 is pushed to origin/app_v1. Local main API is healthy on 8081, frontend 5173, and public development schema is at V17. Expo Android APK build e766971b-f75a-4c3e-8b35-82bf6b02d6cc succeeded; install URL https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/e766971b-f75a-4c3e-8b35-82bf6b02d6cc . No physical-device acceptance yet.

Render access recovered by targeting the existing known Render tab in the in-app browser (Chrome is unavailable). Auto-deploy dep-dbocia2vcj2c73985240 for 6208577 is running. Production logs confirm V16/V17 were successfully applied to public schema, now V17. Wait for successful health and final deployment status before marking complete. GitHub workflow 42513701757 has passed mobile/frontend; backend is running. Live OTP delivery still awaits Resend setup.

### Release outcome — 9 November 2026

- Render deployment dep-dbocia2vcj2c73985240 for 6208577 succeeded and is Live. Production logs confirm both additive migrations applied, public schema now V17.
- Live checks passed: API health UP, missing-city search returns zero rides, Indore–Ujjain selected-date search returns rides with preferences, invalid OTP identifier returns HTTP 400. No live account/booking/ride was created by these checks.
- GitHub workflow https://github.com/sgrydv11/Rahi_/actions/runs/42513701757 completed successfully: mobile, frontend, backend including packaged-server HTTP smoke.
- Expo Android preview APK succeeded: https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/e766971b-f75a-4c3e-8b35-82bf6b02d6cc . Physical Android installation and acceptance remain pending. iOS bundle export passed; no signed iOS app was requested/built in this batch.
- Local frontend http://localhost:5173 and backend http://localhost:8081 are running, development DB V17. Temporary smoke server stopped.
- Still pending: user configures RESEND_API_KEY and OTP_EMAIL_FROM in Render following EMAIL_OTP_SETUP.md; then real signup/login/guest OTP delivery acceptance. Mobile number collection is unverified; SMS and mobile-number sign-in remain deferred. Google sign-in still needs its prior OAuth configuration.
- Do not describe this as full production acceptance: real provider delivery and physical-device end-to-end checks have not happened. No OTP or API key is stored in the tracker.

## OTP pause — 9 November 2026

User requested proceeding without an OTP service. Web and mobile now use email/password sign-in. Signup remains name-free and collects an unverified mobile number. Guests must sign in or create an account before booking; email and SMS verification are deferred. OTP delivery is off by default (`EMAIL_OTP_ENABLED=false`). Existing database schema V17 and ride features remain in place. No APK was requested for this follow-up; the prior APK still has the OTP UI. Web 54 tests/build and mobile 22 tests/TypeScript passed. Backend authentication verification and release rollout follow.

Backend authentication suite and executable package passed. No new migration required. Pushing this checkpoint triggers the existing Render auto-deploy.

## Full app regression audit — 9 November 2026

See docs/verification-2026-11-09.md for the test matrix and reproduction notes. Passed 131 backend tests, 54 web tests, 22 mobile tests, package/build checks, and the isolated HTTP smoke test. Browser testing passed the driver/passenger lifecycle and account screens. Fixed the booking screen missing a completion update when opened before departure; the new Playwright regression verifies the modal and public review without a manual reload. Added the web favicon and fixed home-page branding. Graphify code map is local. OTP remains paused. No APK, production deployment, or production database write was made during this audit. Device and real provider checks remain pending.

## Combined web and API release — 9 November 2026

Added the Vite production build to the Render Docker image and configured explicit browser page routes. The frontend uses the same host as the API, with the Render origin trusted for cookie authentication. Local packaged verification passed deep links, assets, health, protected API access, same-origin password sign-in, and rejection of an untrusted origin. Existing database schema and mobile API URL are unchanged. Render requires Docker context `.` and Dockerfile `backend/Dockerfile`.
