# Phase 3 — Ride management and search

Phase 3 adds authenticated ride offers, owner updates/cancellation, public search/details, and an authenticated My Rides list. Existing registration, login, refresh, logout, profile preferences and health routes remain. Booking and payments are outside this phase.

## API contract

All paths below use `/api/v1`. Public ride responses expose a driver UUID and first display-name component, never the account email, phone number, password hash, or session data. Pickup descriptions, notes, and vehicle descriptions are user-supplied public text; avoid putting private contact information in them.

| Method and path | Authentication | Behavior |
| --- | --- | --- |
| POST /rides | Bearer JWT | Create a SCHEDULED ride; driver comes from JWT; all offered seats start available |
| GET /rides | Public | Available future rides, filtered and paginated |
| GET /rides/{id} | Public | Safe ride details, including cancelled/completed history; legacy drafts/in-progress records require ownership |
| GET /rides/me | Bearer JWT | Only the current user's ride history, paginated |
| PATCH /rides/{id} | Owner's Bearer JWT | Partial update with required version |
| POST /rides/{id}/cancel | Owner's Bearer JWT | Soft cancellation with required version and optional reason |

Creation body:

```json
{
  "origin": "Mumbai",
  "destination": "Pune",
  "pickupDescription": "Station entrance",
  "dropoffDescription": "City centre",
  "departureAt": "2030-12-01T04:30:00Z",
  "timeZone": "Asia/Kolkata",
  "totalSeats": 3,
  "pricePerSeat": 250.00,
  "currency": "INR",
  "vehicleDetails": "Blue Suzuki Swift",
  "notes": "One small bag per passenger"
}
```

Use a future date when trying this example. Origin/destination are required, distinct ignoring case, and at most 200 characters. Seats must be an integer from 1 to 6. Price is nonnegative with at most 10 whole digits and 2 decimal places. Currency is a three-letter uppercase code. Pickup/drop-off descriptions allow 500 characters each, vehicle description 300, and notes 2000. The API rejects unexpected create/update fields, including driverId, availableSeats, vehicleId, status and timestamps.

Departure is an ISO-8601 instant (UTC Z or explicit offset). `timeZone` specifies the display/calendar zone and is validated through Java ZoneId. The frontend enters departure in the browser's named local zone, converts it to an exact UTC instant, and displays the saved zone. It detects local times normalized through a daylight-saving gap; ambiguous repeated local times use the browser's default occurrence. Advanced timezone selection is deferred.

Search example:

```text
GET /api/v1/rides?origin=mum&destination=pun&departureDate=2030-12-01&timeZone=Asia/Kolkata&minimumSeats=2&maximumPrice=300&page=0&size=10
```

Location filters use case-insensitive **prefix** matching, with SQL wildcard characters escaped. Date boundaries are the requested zone's local start of day to next start of day, so DST day lengths are handled. Default date zone is UTC. Search defaults: minimumSeats=1, page=0, size=20. Size is 1–50; page is 0–100000. Ordering is departureAt ascending then UUID ascending. Only future SCHEDULED/PUBLISHED rides with enough available seats appear. Search uses SQL predicates/pagination, not in-memory filtering.

Responses have `content`, `page`, `size`, `totalElements`, and `totalPages`. Each ride includes `id`, `driver: {id, displayName}`, locations/descriptions, departureAt/timeZone, totalSeats/availableSeats, pricePerSeat/currency, vehicleDetails/notes, status, version, and timestamps.

Update body (partial):

```json
{"version": 0, "totalSeats": 4, "notes": "Updated meeting point"}
```

Use the latest response's version; successful changes advance it. Null or omitted patch fields keep existing values. An empty optional text field clears it. Driver identity, status and availability cannot be patched. Cancellation:

```json
{"version": 1, "reason": "Plans changed"}
```

Only an active owner may manage a future scheduled ride. A different owner receives 403, a missing ride 404, invalid input 400, and a stale version or invalid lifecycle change 409. Cancelled/completed/departed rides cannot be edited or cancelled through this API. Optimistic locking also catches two requests that both initially read the same version. Errors use ProblemDetail.

## Schema and compatibility

`V4__ride_management.sql` is additive to the existing application model:

- Makes rides.vehicle_id optional; retains its composite ownership foreign key and separate driver foreign key.
- Adds pickup_description, dropoff_description, vehicle_details, and notes.
- Expands the status check to include SCHEDULED and makes it the default; preserves all legacy database status values.
- Adds a validated 1–6 seat constraint. Existing availability bounds, nonnegative numeric(12,2) pricing, timestamps, UUID keys and version column remain.
- Adds partial available-departure, status/departure, and lowercased location-prefix indexes; retains existing indexes.

No tables are dropped/recreated. Flyway remains enabled and Hibernate remains `validate`. V1–V3 are unchanged. If an existing ride has more than 6 seats, V4 fails for explicit review instead of changing that history. Legacy PUBLISHED rides are surfaced as SCHEDULED. Legacy DRAFT/IN_PROGRESS records retain their database state and are not publicly searchable/editable through Phase 3.

The service creates a driver's existing driver_profiles row on the first ride with an idempotent PostgreSQL upsert, inside the creation transaction. Driver/Passenger/Both registration choices remain preferences, not authorization roles: any authenticated active user can offer a ride as requested. Vehicle description is optional free text; this phase adds no vehicle-management API and does not expose registration numbers. Existing linked vehicles retain ownership and capacity checks.

The seat count cannot be edited or cancelled through Phase 3 when availability indicates reserved seats or confirmed bookings exist. This fails closed until Phase 4 supplies booking-aware changes/refunds. Future booking transactions must participate in ride row/version concurrency control. This phase introduces no booking mutations or payments.

## Frontend

| Route | Purpose |
| --- | --- |
| /rides | Public search with URL-backed filters, results, pagination and empty/loading/error states |
| /rides/:id | Safe ride details and owner actions |
| /rides/new | Protected offer form |
| /rides/mine | Protected current-user history |
| /rides/:id/edit | Protected owner-only edit form |

The shared navbar links to search and, after login, offer/My Rides. Forms reuse existing styles, native accessible labels/validation and the centralized API client. Protected requests use existing memory-only access tokens and bounded refresh/retry. Cancellation uses a native modal dialog with a separate confirmation button. A 409 tells the user to reload the ride instead of silently overwriting another update. No fake ride data or booking buttons are displayed.

## Build and run

No new secrets, frontend origins, or external services are needed. Configure the existing DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET and cookie/CORS settings in the backend process environment. Spring Boot does not automatically load `.env`.

```powershell
# Repository root, after setting existing backend environment variables:
Set-Location backend
mvn -B '-Dmaven.repo.local=../.maven-repository' verify
mvn spring-boot:run
# Or: java -jar target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar
```

In a separate terminal:

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm run dev
```

Production hosting must continue to serve frontend route fallbacks and reverse proxy /api. CORS now explicitly allows PATCH in addition to GET/POST/OPTIONS for configured trusted origins. Existing auth cookie CSRF/origin requirements are preserved; ride writes use bearer authentication rather than cookies.

## Dedicated PostgreSQL tests

All integration tests now guard TEST_DB_URL before migrations/fixtures and require a database named **hoopr_test**. The development database hoopr and its former test schema are refused. No destructive tests are run there.

Create the test database once as an administrator (existing hoopr role):

```powershell
& 'C:\Program Files\PostgreSQL\15\bin\psql.exe' -h localhost -p 5432 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -c 'CREATE DATABASE hoopr_test OWNER hoopr;'
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr_test'
$env:TEST_DB_USERNAME = 'hoopr'
$testCredential = Get-Credential -UserName hoopr -Message 'Dedicated test database password'
$env:TEST_DB_PASSWORD = $testCredential.GetNetworkCredential().Password
# From backend/: Flyway creates the tables; never execute migration SQL by hand.
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify
```

Tests never drop/clean schemas. RideIT creates UUID-scoped test accounts/rides and deletes only those fixtures afterwards, in foreign-key order. Constraint tests roll back their mutations. Default `mvn verify` runs database-independent tests; explicitly selecting *IT is required for PostgreSQL coverage.

## API collections

Import `docs/api/Hoopr-Phase-3.postman_collection.json` plus the existing optional Hoopr-Local environment. Run the entire Phase 3 folder once, in order. It generates an account and future ride, tests public search/details, owner listing/update, stale update protection, invalid input, cancellation/history and logout. The generated ride is cancelled; its account/history remain. Use a local/test backend.

The collection uses explicit auth cookies with the cookie jar disabled, and bearer headers for ride writes. Login/CSRF scripts are reused from Phase 2. Postman runs scripts automatically; Thunder Client requests can be imported but its scripts need adaptation/manual variable capture as described in docs/api/README.md.

A dependency-free Node runner can exercise the same collection:

```powershell
node docs/api/run-collection.mjs http://localhost:8080 docs/api/Hoopr-Phase-3.postman_collection.json
```

Phase 2's existing negative business-API check now targets /bookings because /rides is intentionally public.

## Manual checklist

1. Confirm both health routes return 200 before and after sign-in/out.
2. Register/login with Driver, Passenger and Both preferences; existing auth behavior should remain.
3. While signed out, search rides and open details. Visit /rides/new, /rides/mine and edit routes: expect login.
4. Offer a future Mumbai–Pune ride with 3 seats, INR 250.00 and optional descriptions. Check the success message and returned profile-safe details.
5. Search using mixed-case prefixes, date/zone, seats and maximum price. Change filters to produce an empty result. Verify pagination with several offers.
6. Reload, then open My Rides. Edit seats/notes and verify the new values and version.
7. Open the same ride in two edit tabs. Save the first, then submit the stale second: expect a conflict requiring reload.
8. Log in as another user. The first driver's ride must not appear in My Rides; edit/cancel attempts must fail.
9. Open Cancel ride. Keep ride should leave it unchanged; Confirm cancellation should retain history and remove it from search.
10. Try past departure, invalid zone, zero/7/fractional seats, negative or overprecision prices, and equal origin/destination. Expect clear validation.
11. At a narrow mobile viewport, check navigation, filters, cards, forms, details and dialog for overflow and keyboard access.
12. Log out; protected pages should redirect, public search should remain accessible. No booking or payment controls should exist.

## Limitations and Phase 4

- Booking, payments, seat reservation, completion/start controls, notifications and cancellation/refund workflows are deferred. Scheduled rides that depart are excluded from search; they are not automatically declared completed.
- Basic prefix text search has no maps, geocoding, route distance or fuzzy matching.
- Maximum price compares the numeric amount in each listed currency; there is no FX conversion or currency filter. Default offer currency in the UI is INR; each result labels its currency.
- Optional vehicle details are a description, not verified vehicle onboarding.
- Pagination uses bounded offset pages; cursor pagination may be useful at larger scale.
- Access-token logout/role snapshots, per-instance login throttling and cross-tab refresh limitations remain as documented in Phase 2.
- Recommended Phase 4: transactional bookings and seat allocation sharing the ride version/lock protocol, passenger/driver histories, booking-aware cancellations, and lifecycle completion.

## Files

New backend: ride/Ride.java, RideRepository.java, RideDtos.java, RideSpecifications.java, RideService.java, RideController.java, RideFailure.java; migration V4__ride_management.sql. New tests: RideServiceTest.java, RideWebTest.java, RideIT.java and database/TestDatabase.java.

Modified backend: security/SecurityConfig.java, common/exception/GlobalExceptionHandler.java, user/UserProfile.java (safe getter for proxy access), application.yml (reject fractional values for integer fields), and auth/health/database regression tests for the new public search and strict test-database guard.

Frontend additions: features/rides/api.ts, api.test.ts, RideComponents.tsx, RideForm.tsx, ManageRidePages.tsx, RideDetailsPage.tsx, MyRidesPage.tsx, CancelRideDialog.tsx and pages.test.tsx. Modified: RideSearchPage.tsx, app/router.tsx, app/layouts/AppLayout.tsx and styles/global.css.

Documentation/API artifacts: this guide, README.md, docs/api/README.md, Phase 3 collection, Phase 2 collection's obsolete rides-denied request, and run-collection.mjs for selecting either collection.

## Verification results

Verified on 3 November 2026:

- `mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify`: **62 tests passed**, no failures/errors/skips; executable JAR packaged. This includes 50 database-independent unit/security tests and 12 PostgreSQL tests.
- All integration tests ran against **hoopr_test**, PostgreSQL 15.13. Flyway validated V1–V4. Ride tests proved ownership, SQL filters/pagination/date zones, database constraints, and exactly one winner among concurrent updates. The existing authentication/health regression suite passed.
- Frontend: **32 tests passed**, TypeScript checks passed, Vite production build passed. The shell has no npm on PATH; the equivalent package scripts were executed using installed Node 24.22.1 against node_modules/vitest/vitest.mjs, typescript/bin/tsc and vite/bin/vite.js.
- The Phase 3 collection passed **18 HTTP requests / 30 assertions** against the packaged backend on temporary port 18081 connected to hoopr_test. It created one test account and one cancelled ride that remain as API test history. Runtime token/password variables were cleared by the runner. Postman/Thunder Client desktop import and a full interactive browser walkthrough were not executed; the manual checklist above covers those steps.
- Temporary test servers were stopped; the normal running application process was not restarted or migrated. It will apply pending V3/V4 when restarted with its normal environment.
- Builds used installed JDK 25.0.4.1 with Java compiler release 21. An actual JDK 21 runtime remains unverified.
- A sandboxed rerun could not connect to PostgreSQL (`Permission denied: getsockopt`); the approved external rerun passed all 62 tests. A test matcher overload was corrected during implementation. Fractional numeric coercion was explicitly disabled and regression-tested for seats/versions.
- The temporary packaged-JAR startup used `-Djdk.net.unixdomain.tmpdir=backend/target` from the repository root to work around the installed JDK's Windows temporary-socket issue. No global Java settings or security controls were changed.
