# Breakpoint fixes

Verified 6 November 2026 on app_v1. All eight audit points were rechecked. The changes add no schema migrations and do not remove or rewrite existing ride or booking records.

| Audit point | Resulting behavior | Regression coverage |
| --- | --- | --- |
| Java-only time zones crash browser formatting | API accepts IANA region zones plus UTC/GMT, rejects the reported offset/legacy values with 400. Unsupported zones on existing records render in UTC with an explicit fallback label. | Backend zone validation; three failing-then-passing RideCard rendering cases; actual browser legacy search |
| Out-of-range departures crash JavaScript Date | New/updated departures must be future instants before year 10000. Existing invalid browser dates display Departure time unavailable. | Backend boundary test; failing-then-passing RideCard case; browser legacy record |
| Disabled accounts access notices/group feed | Both controllers check the current account status through AuthService before reading results. | Integration test using a real JWT, then disabling its account; live HTTP audit returns 401 |
| Fully held rides appear available | Search filtering and pagination counts subtract active, unexpired holds. Details and result cards show effective open seats. Listing inventory is loaded once per page rather than per card. | Integration test covering hold creation, search exclusion, detail availability, cancellation and restored seats |
| Extreme search dates yield 500/409 | Dates outside years 0001-9999 return a clear 400 before executing the search query. | Boundary unit tests and both original HTTP probes |
| Concurrent tab refresh revokes sessions | Same-origin cookie-auth operations acquire a browser Web Lock around CSRF acquisition and the request. Each locked operation gets a fresh CSRF token. Network waits are bounded to 15 seconds per request. | Two independent auth-module instances sharing a test lock; two actual browser tabs surviving two simultaneous reload rounds |
| Successful logins exhaust IP allowance | Successful authentication releases its reserved attempt. Failed and in-flight attempts still consume the bounded IP budget; a success does not reset failures from other requests. | More than 20 valid HTTP logins; unit test retaining the 20-failure ceiling |
| Locked ride starves database pool | PostgreSQL lock waits default to 1500 ms. Pool acquisition defaults to 3000 ms. Lock contention returns 409; unavailable database resources return 503 with Retry-After: 1. | 12-way lock-contention integration test; full 40-second HTTP fault-injection replay |

Refresh replay protection on the backend is deliberately unchanged: directly replaying an already-consumed refresh token still revokes its family. The legitimate browser race is prevented in the client, instead of weakening token-reuse detection. Web Locks are supported by the tested browser; browsers without that API retain the existing per-tab fallback and are not guaranteed cross-tab coordination.

## Validation

- Full Maven verify: **110 tests passed**, zero failures/errors/skips: 58 unit/MVC tests and 52 PostgreSQL integration tests, including the seed test. Executable JAR packaging passed.
- Web frontend: **52 tests passed** across nine files; TypeScript checking and Vite production build passed.
- Native API contract suite: **10 tests passed**. Native TypeScript/device builds remain unverified because the earlier native dependency installation was interrupted.
- The initial new regressions reproduced the crashes, validation gaps, disabled access, successful-login lockout, held-seat mismatch and missing cross-tab coordination before the fixes.
- Post-fix primary HTTP audit: **83 checks passed**, no reported findings. Test writes were confined to hoopr_test; the complete backend suite used its separate fixes_regression schema.
- Normal read bursts: **1,408 requests returned 200**, through 256 concurrent requests. At 256 concurrency, p95 was 4405 ms on this local machine. These are short-burst observations, not production throughput guarantees or proof of unlimited capacity.
- Repeated 40-second row-lock fault with 12 queued bookings: all 12 booking attempts returned 409. Unrelated search returned 200 in **29 ms**; actuator health returned 200/UP in **22 ms**. Before the fixes, that search failed with 500 after approximately 30 seconds.
- The running development backend was restarted with the rebuilt executable; frontend remains at http://localhost:5173 and backend health at http://localhost:8081/actuator/health.

## Configuration

`DB_LOCK_TIMEOUT` defaults to PostgreSQL duration `1500ms`. It applies to new pooled connections and requires an application restart to change existing connections. `DB_CONNECTION_TIMEOUT_MS` defaults to `3000`. These settings bound lock contention and connection acquisition; they cannot make an unavailable database or saturated deployment healthy.

PostgreSQL lock-timeout errors can appear in logs during intentional contention tests. The expected client response is a retryable conflict, rather than a server error or an indefinitely blocked request.

## Local evidence

Ignored .local/ files preserve pre-fix and post-fix evidence without committing credentials or database contents:

- fixes-red-tests.log and fixes-red-integration.log
- fixes-full-tests.log
- fixes-acceptance-results.json and fixes-extra-results.json
- fixes-legacy-rides.png and fixes-two-tab-session.png

Real external payment-provider checkout, mobile device acceptance and multi-host deployment load were not exercised by this verification.
