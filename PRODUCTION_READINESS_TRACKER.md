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
- C08 added .github/workflows/checks.yml with mobile/frontend checks and backend unit/integration tests on a dedicated PostgreSQL service. Hosted CI execution still needs verification after push. The workflow performs regression checks only.
- Backend verification completed on Java 21 against isolated schema regression_20261107174202 in hoopr_test. All 110 backend tests passed, including inventory races, idempotency, hold expiry, cancellation/refunds and sandbox payments. Frontend passed 52 tests and its web build. B03 is verified for the existing supported backend flows; device end-to-end testing is separate.

- Frontend validation passed all 52 tests across 9 files and the production web bundle check.
- The initial backend run reported 107 passes and 3 failures against an already-seeded test database. Failures involved expired demo departures and global search assumptions. A fresh isolated schema under hoopr_test is being used for the verification rerun, preserving public-schema demo data. Java 21 matches the project target.
- Startup now allows home/search browsing during session restoration; account-dependent screens retain their session gate.

Final verification for this implementation batch: 20 mobile tests, mobile TypeScript, 52 frontend tests plus web build, and 110 backend unit/integration tests passed. Isolated schema was retained for diagnosis. Public demo data was preserved. Workflow YAML parsed successfully; hosted execution is still unverified until GitHub runs it.
