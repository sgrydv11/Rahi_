# Phase 4 — Bookings and seat allocation

Implemented on 4 November 2026 after approval. Foundation, authentication, travel preferences and ride search/management remain in place.

## What changed

Passengers can select seats on a future ride, review the total and confirm a booking. My Bookings shows confirmed and cancelled history, with details and passenger cancellation. Drivers can open their ride's passenger booking list and cancel a ride together with all its active bookings. Hoopr collects no payment in this phase.

The passenger comes from the authenticated JWT. Travel preference does not restrict booking/offering. USER and ADMIN can use the feature, but ADMIN has no ownership bypass. Public ride details do not expose passenger data. Booking details are limited to the passenger and ride owner; the manifest is owner-only. Responses contain first display names and UUIDs, not emails, phone numbers or tokens.

## Database and concurrency

V5__booking_idempotency.sql extends the existing bookings table:

- Nullable UUID idempotency_key, preserving historical rows without keys.
- BIGINT version, default 0, nonnegative, used by JPA optimistic locking.
- Unique partial index on passenger_id/idempotency_key.
- Booking seat-count constraint of 1–6 and a ride/history index.

V1–V4 remain unchanged. Flyway applies V5 at startup; Hibernate validates the schema. No new database, extension, administrator privilege or environment variable is required. Existing application-role ownership permissions suffice. If historical data violates a new constraint, investigate it rather than deleting history or editing an applied migration.

All booking creation, passenger cancellation, ride editing and driver cancellation acquire a PostgreSQL write lock on the ride first. They then read/change bookings. Seat allocation and booking insertion commit together. The invariant is:

```text
available seats + seats in CONFIRMED bookings = total seats
```

Inconsistent historical availability fails closed with 409. Passenger cancellation restores seats exactly once. Driver cancellation changes confirmed bookings to CANCELLED_BY_DRIVER and restores the ride's availability in the same transaction. Cancellation preserves records and metadata. Rides with active bookings cannot be edited; after every active booking is cancelled, normal future-ride editing can resume. Ride mutations still require the latest version, which also changes when availability changes.

## API contract

All paths below use the /api/v1 prefix and require `Authorization: Bearer <accessToken>`. JSON failures follow existing ProblemDetail conventions: 400 invalid input/self-booking, 401 unauthenticated/unavailable account, 403 ownership/role denial, 404 missing record, 409 lifecycle/availability/stale-version/duplicate conflict.

| Method and path | Behavior |
| --- | --- |
| POST /rides/{rideId}/bookings | Create with required UUID Idempotency-Key header; 201 new, 200 replay |
| GET /bookings/me?page=0&size=10 | Passenger history |
| GET /bookings/{id} | Passenger or owner details |
| POST /bookings/{id}/cancel | Passenger cancellation; repeated cancellation returns current state |
| GET /rides/{rideId}/bookings?page=0&size=10 | Owner manifest, all booking statuses |
| POST /rides/{rideId}/cancel | Existing versioned endpoint, now atomically cancels active bookings |

History endpoints bound page to 0–100000 and size to 1–50. Ordering is creation time descending, then UUID ascending. Booking responses contain a journey summary, safe passenger, seats, immutable price/currency snapshots, totalPrice, status, version, canCancel, timestamps and cancellation reason. `canCancel` describes lifecycle eligibility; only the passenger can invoke passenger cancellation. Drivers cancel through the ride endpoint.

Create body:

```json
{ "seats": 2, "rideVersion": 3 }
```

`rideVersion` is optional for API clients; the browser always sends the version the passenger reviewed. If it changed before a new booking, the server returns 409 so the passenger can review current price/availability. Omission accepts the current server quote. Prices, totals, passenger IDs and statuses are not accepted as input. Integer seats must be 1–6, within ride capacity and current availability; fractional values and unknown fields are rejected.

Creation retries must retain the same passenger, ride, seat count and UUID Idempotency-Key. Replaying a successful key returns its existing booking's current state, even if it was later cancelled; it never silently rebooks. Changing ride or seats under the same passenger/key returns 409. The optional quote version is checked only for the first allocation, so a committed booking can be recovered after the ride version changes. A new intentional booking after cancellation needs a new key. Concurrent cross-ride key reuse is also constrained by the database and can return 409. Keys are retained with booking history.

Cancellation bodies:

```json
{ "reason": "My plans changed" }
```

```json
{ "version": 4, "reason": "Driver plans changed" }
```

Reason is optional and at most 500 characters. Cancellation is allowed only before departure on scheduled rides. Repeating an already completed passenger cancellation returns its state without changing seats, including after departure/driver cancellation. Driver requests with stale ride versions must reload before retrying.

## Postman and Thunder Client

Import [Hoopr-Phase-4.postman_collection.json](api/Hoopr-Phase-4.postman_collection.json) into Postman. Optionally import [the local environment](api/Hoopr-Local.postman_environment.json). Run all 26 requests in order, one iteration. The collection generates two throwaway accounts and a future ride, checks replay/conflict/privacy and both cancellation paths, then logs out both sessions. Historical accounts, ride and bookings remain; no delete API is introduced. Do not export populated runtime secrets after an interrupted run. The final request clears generated credentials and tokens.

The dependency-free runner executes the same request scripts:

```powershell
# Repository root, with backend already running
node docs/api/run-collection.mjs http://localhost:8080 docs/api/Hoopr-Phase-4.postman_collection.json
```

For Thunder Client, import the collection if your installed edition supports Postman imports/scripts. If scripts are unavailable, create requests manually:

1. GET `http://localhost:8080/api/v1/auth/csrf`; keep the returned token and matching XSRF-TOKEN cookie.
2. Register two accounts using the existing auth endpoint. Log in as the driver, sending trusted `Origin: http://localhost:5173`, matching `X-XSRF-TOKEN` header and cookie. Keep the access token private.
3. POST `/api/v1/rides` with the driver Bearer token and a future departure, for example:

```json
{
  "origin": "Mumbai", "destination": "Pune",
  "departureAt": "2030-01-01T10:00:00Z", "timeZone": "Asia/Kolkata",
  "totalSeats": 3, "pricePerSeat": 250, "currency": "INR"
}
```

4. Log in as the passenger. POST `/api/v1/rides/<ride-id>/bookings`, with passenger Bearer token, `Content-Type: application/json`, a new UUID `Idempotency-Key` and `{ "seats": 2, "rideVersion": 0 }`. Use the actual current version from GET ride details.
5. Repeat the exact request/key: expect 200 and the same booking ID. Change seats with the same key: expect 409. Check passenger history, details and reduced public ride availability.
6. POST `/api/v1/bookings/<booking-id>/cancel` with `{ "reason": "Changed plans" }`. Repeat it and confirm availability does not increase twice.
7. Book again using a new UUID key/current ride version. As driver, GET `/api/v1/rides/<ride-id>/bookings`, then GET the current ride version and cancel the ride using that version. Passenger booking details must say CANCELLED_BY_DRIVER.

Business mutations require Bearer authentication; refresh cookies alone do not authorize them. Existing cookie-auth CSRF/Origin checks remain. Trusted CORS now also allows Idempotency-Key. Health endpoints remain public. Repeated full collection runs count toward the existing login limiter; wait out 429 rather than disabling protection.

## Build and run

Full prerequisites, ignored .env loading and database provisioning remain in [SETUP.md](../SETUP.md). No new secrets or environment variables are introduced. Keep DB_URL/DB_USERNAME/DB_PASSWORD/JWT_SECRET and existing cookie/origin settings configured privately.

```powershell
# Backend terminal; privately configure existing application env vars first
cd backend
mvn verify
mvn spring-boot:run

# Frontend terminal
cd frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Production artifacts: backend/target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar and frontend/dist. Java compiler target is 21; this machine's verification uses JDK 25.0.4.1, not an actual JDK 21 runtime.

```powershell
# Backend full regression suite; use only the dedicated test database
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr_test'
# Set TEST_DB_USERNAME and TEST_DB_PASSWORD privately.
cd backend
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify

# Frontend
cd frontend
npm.cmd test
npm.cmd run build
```

The default Maven test pattern excludes *IT. Use the explicit pattern above for PostgreSQL/concurrency coverage. TestDatabase rejects application database URLs; never substitute hoopr or run Flyway clean/reset commands.

## Manual browser checklist

1. As driver, offer a future ride with 3 seats. Log out.
2. As a different passenger, find the ride, select 2 seats, review and confirm. Verify total/currency and My Bookings. Reload and verify the session restores.
3. Confirm public availability is 1. Try booking the same ride again; expect an active-booking conflict.
4. Cancel the booking after confirmation; verify its history and all 3 seats restored.
5. Book again with a new request. As driver, inspect passenger bookings and cancel the ride. Verify the passenger sees driver cancellation.
6. Check unavailable/departed rides, forbidden other-user details, stale availability and narrow/mobile layouts. Existing registration/login/logout/search/edit and health must still work.

The browser automation bridge was unavailable during this phase, so a fresh interactive walkthrough and screenshot are not claimed. The API collection and automated component/server tests cover the verified behavior; perform this checklist for visual acceptance.

## Verification results — 4 November 2026

- Backend full suite: **73 passed**, 0 failures/errors/skips, including **23 PostgreSQL integration tests**. Executable JAR packaging passed.
- Frontend: **36 passed** across 6 files; TypeScript checking and Vite production build passed.
- Phase 4 HTTP collection: **26 requests / 42 assertions passed** against the final running backend.
- Existing Phase 3 HTTP collection: **18 requests / 30 assertions passed**.
- Existing Phase 2 HTTP collection: **23 requests / 50 assertions passed**.
- API health, actuator health and frontend each returned HTTP 200 after the final restart.
- V5 applied successfully to both the dedicated test database and normal application database. Earlier migration files were preserved.

Backend tests include concurrent last-seat competition, same-key retries, simultaneous passenger cancellation and passenger/driver cancellation races. They also verify stale quote rejection, server price snapshots, invalid/duplicate requests, ownership, ADMIN restrictions, CORS, cookie-only rejection and prior auth/health/ride behavior. This machine used JDK 25.0.4.1 with Java release 21. Interactive Phase 4 browser verification remains the explicit limitation above.

## File inventory for this phase

Created:

- backend/src/main/java/com/hoopr/booking/Booking.java
- backend/src/main/java/com/hoopr/booking/BookingRepository.java
- backend/src/main/java/com/hoopr/booking/BookingDtos.java
- backend/src/main/java/com/hoopr/booking/BookingFailure.java
- backend/src/main/java/com/hoopr/booking/BookingService.java
- backend/src/main/java/com/hoopr/booking/BookingController.java
- backend/src/main/resources/db/migration/V5__booking_idempotency.sql
- backend/src/test/java/com/hoopr/booking/BookingIT.java
- frontend/src/features/bookings/api.ts
- frontend/src/features/bookings/BookSeats.tsx
- frontend/src/features/bookings/BookingPages.tsx
- frontend/src/features/bookings/bookings.test.tsx
- docs/api/Hoopr-Phase-4.postman_collection.json
- docs/phase-4-bookings.md

Modified:

- backend/src/main/java/com/hoopr/ride/Ride.java
- backend/src/main/java/com/hoopr/ride/RideRepository.java
- backend/src/main/java/com/hoopr/ride/RideService.java
- backend/src/main/java/com/hoopr/security/SecurityConfig.java
- backend/src/main/java/com/hoopr/common/exception/GlobalExceptionHandler.java
- backend/src/test/java/com/hoopr/ride/RideServiceTest.java
- backend/src/test/java/com/hoopr/auth/AuthWebTest.java
- frontend/src/app/router.tsx
- frontend/src/app/layouts/AppLayout.tsx
- frontend/src/features/rides/RideDetailsPage.tsx
- frontend/src/features/rides/CancelRideDialog.tsx
- frontend/src/features/bookings/README.md
- README.md, SETUP.md, PHASE_SETUP.md, docs/api/README.md

Generated target/dist/log/PID files are build artifacts, not source deliverables. Existing applied migrations and unrelated modules were preserved.

## Limits

Payments/refunds, notifications, maps/routing, vehicle CRUD, ratings, password recovery, admin provisioning and ride start/completion remain outside this phase. Bookings are confirmed immediately, with no pending/approval workflow. Cancellation releases the entire booking rather than a partial seat count. All bookings use the ride's currency; there is no currency conversion. Consistency guards protect application mutations; direct SQL/manual changes must preserve the same invariant. The lock serializes mutations per ride; this is intentional and not a distributed load benchmark.
