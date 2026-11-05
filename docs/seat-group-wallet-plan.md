# Open Ride Group, wallet and ride discounts

Phase 1 was approved on 6 November 2026. The native frontend belongs on `app-fe`. Server code, migrations and backend tests belong on `codex/backend`. The starting commits were `f658afc` for the frontend and `017e69d` for the backend. Phase 1 ports the native authentication server files and tests to the backend branch and records the [versioned API contract](seat-group-wallet-api-v1.md). Keep the Expo and server work in separate worktrees where practical.

| Phase | Backend on codex/backend | Native frontend on app-fe | Completion checks |
| --- | --- | --- | --- |
| 1. Establish the contract | Port mobile login, registration and token rotation. Define versioned endpoints and error responses for group offers, holds, wallet and quotes. | Wire typed clients to the agreed API contract. | Test mobile auth and existing web auth. Run the baseline backend suite and native typecheck. |
| 2. Open Ride Group | Expose a paginated feed of eligible rides and authoritative seat counts. Implement expiring holds under the ride lock and reconcile provider payments before confirming seats. | Add a seat-only group feed, hold timer, checkout and clear pending, expired, sold-out and confirmed states. | Race two riders for one seat. Test replay, provider failure, expiry, late payment and both cancellation paths. Verify bundle exports. |
| 3. Wallet | Add an INR ledger in paise, verified top-ups, spend and refund entries, and test withdrawal requests with reserved funds. Keep live cash-out disabled until the payout provider and account requirements are confirmed. | Add balance, activity, top-up, wallet checkout and withdrawal status screens. | Test duplicate events, concurrent spending, insufficient funds, refunds, rejected withdrawals and recovery of reserved funds. |
| 4. Ride discounts | Apply a server-side 5%, 10%, 15% repeat cycle to eligible paid rides. Lock the fare and discount with the quote. Serialize competing discount quotes for a rider so simultaneous checkout cannot reuse the same step. | Show original fare, discount, total and the next discount. | Test the first six discounts, rounding to paise, duplicate confirmation, overlapping checkouts, expired holds and cancellation behavior. |
| 5. Integrate and release branches | Run the PostgreSQL regression suite and exercise provider test flows with credentials where available. Commit and push backend changes. | Run native checks and verify Android and iOS bundles. Run device checks where the toolchains are available. Commit and push frontend changes. | Record commits, test commands and results, sandbox or device gaps, and any remaining decisions. |

## Proposed rules

- An open group means signed-in users can browse seat offers in a chat-style feed. The group carries seat offers. Drivers publish availability using the existing ride offer screen.
- Group checkout holds seats for five minutes or until departure, whichever comes first. A hold becomes a confirmed booking only after verified full payment. An expired hold releases seats exactly once. A late payment enters refund reconciliation and never reclaims the seat.
- Top-ups credit the wallet only after provider verification. Wallet spending and seat confirmation commit atomically. Refunds return to the original payment source. Test cash-out uses a sandbox payout adapter, with explicit pending, successful and failed states. Live cash-out requires a supported payout provider and approved operating rules.
- The discount starts at 5% for each rider after launch, advances on confirmed paid rides, then repeats through 10% and 15%. Expired holds and failed payments do not advance it. A successful paid ride consumes its step even if refunded, and the same ride cannot advance the sequence twice. Discounts apply to fares, with no promotional value added to the withdrawable balance.

## Checkpoints and recovery

After each phase, run the phase-specific tests and the applicable regression checks, then commit and push verified changes to the owning branch. Record the branch SHA, commands, results, migration state and next incomplete task in this document. Use durable database state and idempotency keys for payments, holds and withdrawals so retries and restarts can reconcile operations. If the session ends, resume from the last recorded checkpoint.

### Phase 1 checkpoint — 6 November 2026

- Backend commit `4df25f0` ports native registration, login, refresh and logout. Maven `-Dtest=*Test,*IT verify` passed all 91 tests against `hoopr_test`, including cookie-free mobile login, token rotation and revocation, and existing web auth. Flyway validated V1–V8. Phase 1 adds no migration.
- On `app-fe`, `npm test` passed all three native contract cases. `npm run typecheck` and `npm run bundle:check` passed for Android and iOS. No device run was performed.
- The API contract is recorded on both branches. Phase 2 starts with the group feed and transactional seat hold endpoints, then connects the native screens.
