# Hoopr phase setup, completed scope and reusable prompts

Updated: 4 November 2026. Read [SETUP.md](SETUP.md) for applications, versions, permissions, database provisioning, environment variables and run commands.

These are complete reusable prompts aligned with the repository's implemented behavior. They consolidate the requirements and accepted follow-up changes; they are not presented as verbatim transcripts. Phase 1's prompt is reconstructed from its implementation. The Phase 4 prompt is a proposal only and has not been implemented or approved.

## 1. Current status

| Phase | Status | What is present |
| --- | --- | --- |
| Phase 1 — Foundation | COMPLETE | Spring Boot/React structure, PostgreSQL schema, Flyway, public health, API client, responsive layout and tests |
| Phase 2 — Authentication and authorization | COMPLETE | Registration/login, BCrypt, JWTs, refresh rotation/reuse detection, logout, roles, profile and protected frontend routes |
| Phase 2 follow-up — Travel preference | COMPLETE | Offer a seat / Find a seat / Both registration choice, persisted preference and profile display |
| Phase 3 — Ride management and search | COMPLETE | Offer/search/details/My Rides/edit/cancel, SQL filters/pagination, owner checks, optimistic locking, API collection and tests |
| Phase 4 — Bookings and seat allocation | NOT IMPLEMENTED | Proposed prompt below; schema foundation exists but booking APIs/UI do not |
| Later phases | NOT COMMITTED | Payments, notifications, advanced vehicle onboarding, maps, lifecycle completion and other features need separately agreed scope |

Do not rerun completed-phase prompts as instructions to overwrite the current application. Use them to reconstruct a missing earlier stage or audit its requirements. Use the resume prompt below for continuing this repository. A future agent must inspect the files, because the repository can change after this document was written.

## 2. Actual implementation reference

Stack: Java 21 compiler target, Spring Boot 3.5.16, Spring Security, Spring Data JPA, PostgreSQL and Flyway; React 19.3.1 locked, React Router 7.18.5 locked, TypeScript 5.9.3, Vite 8.3.5 and Vitest 5.0.5. Full dependency/tool details are in SETUP.md.

Backend modules: auth/, user/, security/, common/exception/, health/ and ride/ under backend/src/main/java/com/hoopr. Driver, vehicle and booking feature packages mostly remain reserved; Phase 3 creates driver_profiles records when someone first offers a ride.

Migrations, in order:

1. V1__initial_schema.sql — users, user_profiles, driver_profiles, vehicles, rides, bookings, constraints and indexes.
2. V2__authentication.sql — USER/ADMIN role, refresh_sessions and refresh_tokens with hash-only persistence.
3. V3__user_travel_preference.sql — user_profiles.travel_preference = DRIVER/PASSENGER/BOTH.
4. V4__ride_management.sql — optional vehicle linkage, descriptions/notes, SCHEDULED support, 1–6 seat rule and search indexes.

Current auth APIs:

```text
GET  /api/v1/auth/csrf
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
```

Current ride APIs:

```text
POST  /api/v1/rides
GET   /api/v1/rides
GET   /api/v1/rides/{id}
GET   /api/v1/rides/me
PATCH /api/v1/rides/{id}
POST  /api/v1/rides/{id}/cancel
```

Current frontend routes: /, /register, /login, /profile, /rides, /rides/new, /rides/mine, /rides/:id and /rides/:id/edit. Profile/create/manage/edit routes require authentication. Owner checks also run on the backend.

Important boundaries to preserve:

- USER/ADMIN are authorization roles. DRIVER/PASSENGER/BOTH is a separate preference, not a security role. New registrations are USER; preference does not block an authenticated active user from offering a ride.
- Access JWTs last 15 minutes and stay in frontend memory. Opaque refresh tokens use HttpOnly cookies; only SHA-256 hashes are stored. Rotation/replay handling is transactional.
- Cookie-auth POST requests require a trusted Origin plus CSRF cookie/header. Bearer ride mutations use existing authentication. CORS has explicit origins and allows GET/POST/PATCH/OPTIONS.
- Public ride results contain only driver UUID/display name from account data. Search uses case-insensitive SQL prefix matching, escaped wildcards, explicit date zones, bounded pagination and departureAt/UUID sorting.
- New rides are SCHEDULED. Legacy PUBLISHED is returned as SCHEDULED; legacy states remain in the database. There is no completion/start endpoint yet.
- PATCH/cancel require the latest version. Fractional seat counts/versions are rejected. Rides with reserved seats or confirmed bookings currently fail closed for update/cancellation until booking-aware workflows are built.
- Vehicle details are optional descriptive text. Existing saved-vehicle ownership/capacity linkage remains; a vehicle CRUD feature is not implemented.
- All integration tests require a database named hoopr_test. Do not use hoopr or the former development-schema workaround. No DROP/CLEAN/reset operations belong in tests.

## 3. Phase 1 complete prompt — Foundation

Use this for a fresh foundation or a missing-foundation recovery only. Preserve any already-present later phases.

```text
You are working on Hoopr, a carpooling application.

Implement or restore Phase 1: the project foundation. First inspect the entire
existing repository, any AGENTS.md instructions, build files, migrations and
existing frontend. Present a concise plan, conflicts, proposed files and schema
changes. Wait for my explicit approval before modifying files. If Phase 1 is
already complete, report the existing implementation and preserve all later work.

Stack:
- Backend: Java 21 target, Spring Boot 3.5.x, Maven, Spring Security,
  Spring Data JPA, PostgreSQL, Flyway and Jakarta Bean Validation.
- Frontend: React, TypeScript, Vite and React Router.
- Keep API configuration centralized and organize code by feature.

Backend foundation:
1. Use the existing package/build conventions; create missing structure only.
2. Configure PostgreSQL through environment variables. Never hardcode passwords.
3. Enable Flyway and Hibernate schema validation; never use schema auto-update
   as a substitute for migrations.
4. Preserve existing tables. For a new project create an initial migration with
   UUID keys for users/profiles, driver profiles, vehicles, rides and bookings.
   Reuse the current migrations if this project already has them.
5. Include normalized unique emails, FK ownership relationships, nonnegative
   prices, positive capacities, available-seat bounds and appropriate indexes.
6. Use TIMESTAMPTZ for event timestamps and retain departure timezone separately.
7. Expose public GET /api/v1/health and GET /actuator/health without internal
   database/password details in responses.
8. Establish a deny-by-default security boundary for unimplemented APIs.
   Preserve any explicit routes already authorized by later completed phases.
9. Return safe, consistent ProblemDetail errors and validation details without
   rejected secret values or stack traces.
10. Do not introduce authentication, booking, payments or seat-allocation business
    logic as speculative Phase 1 work.

Frontend foundation:
1. Reuse or establish responsive shared layout, navigation and styles.
2. Add home, login/register placeholders and ride-search preview only where these
   are missing. Never replace working later-phase forms/pages with placeholders.
3. Add React Router, a not-found page and a centralized typed fetch client.
4. Use VITE_API_BASE_URL and an API proxy configuration without browser secrets.
5. Provide meaningful placeholder states rather than collecting fake credentials
   or showing invented production rides.

Verification:
- Test public health, unavailable API security, request validation/error handling
  and centralized client behavior.
- Include explicit PostgreSQL migration/constraint tests using only hoopr_test.
- Run backend verification, frontend tests and the frontend production build.
- Do not claim PostgreSQL execution if a real test database was unavailable.

Deliver the file list, migration description, required environment variables,
prerequisite versions, setup/run commands, test results and remaining limitations.
Never delete unrelated code, drop/recreate application tables or commit secrets.
Implement incrementally only after approval.
```

## 4. Phase 2 complete prompt — Authentication and authorization

```text
Implement Phase 2 authentication and authorization in the existing Hoopr project.

Stack: Java 21 target, Spring Boot 3.5.x, Spring Security, Data JPA, PostgreSQL,
Flyway, React, Vite and TypeScript. Phase 1 health and foundation are working.
If Phase 2 already exists, audit/recover only missing behavior while preserving
later ride features.

Mandatory workflow:
1. Inspect project structure, migrations, user/profile model, security,
   exception handling, API client and frontend routes before making assumptions.
2. Present a concise implementation plan, conflicts, proposed files/migrations.
3. Wait for explicit approval before changing files, then implement incrementally.
4. Preserve all working features and existing data.

Backend:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET /api/v1/users/me
- Add/reuse GET /api/v1/auth/csrf for the frontend cookie-auth flow.

Requirements:
1. Reuse users and user_profiles in PostgreSQL. Use additive Flyway changes;
   never drop/recreate tables or edit an applied migration.
2. Hash passwords with BCrypt. Validate requests using Jakarta Bean Validation.
   Enforce unique normalized email addresses case-insensitively, including
   concurrent requests. Reject passwords that exceed BCrypt's 72 UTF-8 bytes.
3. Issue 15-minute signed JWT access tokens. Validate signature, issuer,
   audience, subject, role, issuance and expiry using Spring Security support.
4. Use a signing key supplied through environment configuration, with no insecure
   hardcoded fallback. Never put backend secrets in VITE_ variables.
5. Generate cryptographically secure opaque refresh tokens, store only hashes,
   rotate on refresh, and revoke on logout. Detect reuse and revoke the whole
   affected token family. Ensure revocation commits even when refresh returns 401.
6. Serialize concurrent family refreshes to prevent two successful rotations.
7. Send refresh tokens in host-only HttpOnly cookies with configurable Secure
   and SameSite values. Restrict cookie path appropriately. SameSite=None
   requires Secure. Document local HTTP versus production HTTPS settings.
8. Support USER and ADMIN. Registration assigns USER only. Expose no public
   API for assigning ADMIN privileges.
9. Protect authenticated endpoints and preserve both public health endpoints.
   Explicitly authorize implemented routes and deny other business APIs until
   their later phases; preserve routes already implemented in later phases.
10. Use explicit trusted CORS origins and consistent ProblemDetail responses.
11. Add bounded basic login throttling/brute-force protection and Retry-After.
12. Protect cookie-auth POSTs with CSRF and trusted-origin checks, including
    refresh and logout. Ensure bearer-token CSRF exemptions cannot bypass
    protections on cookie-auth routes.
13. Never log passwords, JWTs, refresh tokens or sensitive rejected values.
14. Keep authentication failures generic and disable server-session/form-login
    assumptions when using the stateless JWT flow.

Frontend:
1. Connect existing registration/login pages with client-side validation.
2. Use auth context or another lightweight state store.
3. Keep access tokens in memory, never localStorage or sessionStorage.
4. Restore sessions through the HttpOnly refresh cookie. Share concurrent refresh
   work, handle expiry, and retry an authenticated request at most once.
5. Keep raw auth requests separate from protected-request retry logic to prevent
   refresh loops. Reuse the centralized API configuration.
6. Add protected profile routes, safe return-after-login navigation and logout.
7. Show accessible loading, success/error states and preserve responsive styles.
8. If logout fails on the network, allow retry rather than falsely claiming that
   server-side revocation succeeded.

Tests:
- Successful registration/login and password hashing.
- Duplicate emails, invalid credentials and disabled accounts.
- JWT validation, invalid signatures, claims and expiry.
- Refresh rotation, reuse/family revocation and concurrent rotation.
- Logout/revocation, unauthenticated/forbidden access and role authorization.
- CSRF, origin checks, explicit CORS and cookie security flags.
- Both health routes remain public.
- Frontend validation, memory state and bounded refresh/retry behavior.

Run backend tests, configured frontend tests and the production build. PostgreSQL
integration tests must use hoopr_test and securely supplied test credentials.
Document files, migration/environment changes, run commands, Postman/Thunder
Client requests, actual results and limitations. Be explicit that logout revokes
refresh sessions while existing access JWTs can remain valid until expiry.
```

## 5. Completed follow-up prompt — Driver / Passenger / Both

```text
Extend Hoopr registration with a saved travel preference:
- Offer a seat (Driver) -> DRIVER
- Find a seat (Passenger) -> PASSENGER
- Both -> BOTH

Inspect existing auth/user/profile code first. Keep this separate from the
USER/ADMIN security role; all new accounts remain USER and no administrator
assignment is exposed. Reuse the current registration/profile pages and API.

Persist travelPreference in the profile with an additive migration. Accept the
three enum values, reject invalid/null values, and default existing profiles and
older requests omitting the field to BOTH. Show the saved preference on /profile
and include it in registration, login, refresh and profile DTOs.

Preserve existing users, authentication/session behavior and frontend styling.
Do not implement booking or vehicle onboarding as part of this change. Keep
preference informational rather than treating it as a new security permission.

Test all three choices through registration and persistence, subsequent login,
refresh and profile access. Test omitted/invalid/null API values and unchanged
USER authorization. Update API collection examples and documentation. Run backend
verification including hoopr_test integration checks, frontend tests and build.
If the change is already present, verify it rather than adding another column.
```

## 6. Phase 3 complete prompt — Ride management and search

```text
Implement Phase 3 in the existing Hoopr application without breaking Phases 1–2.
If Phase 3 is already implemented, inspect/audit it and address only an explicitly
requested gap; do not rewrite working modules or rerun old schema creation.

Stack: Java 21 target, Spring Boot 3.5.x, Spring Security, Data JPA, PostgreSQL,
Flyway, React + TypeScript + Vite. JWT, refresh rotation, secure cookies and the
centralized authenticated API client already exist.

Mandatory workflow:
1. Inspect relevant backend/frontend files, actual schema/migrations, security,
   auth/user model, exception handling, routes and API client.
2. Reuse existing rides, driver_profiles, vehicles, bookings and ride versioning.
3. Explain conflicts and present the plan, proposed files/migrations.
4. Wait for my explicit approval before modifying files.
5. Implement incrementally, then run tests/builds and report actual results.

APIs:
- POST /api/v1/rides: authenticated create.
- GET /api/v1/rides: public available-ride search.
- GET /api/v1/rides/{id}: safe details.
- GET /api/v1/rides/me: authenticated owner's rides.
- PATCH /api/v1/rides/{id}: owned partial update.
- POST /api/v1/rides/{id}/cancel: owned soft cancellation.

Ride data:
UUID id; driver derived from authenticated principal; origin/destination; optional
pickup/drop-off descriptions; exact departure instant and named display zone;
total/available seats; BigDecimal price and currency; optional vehicle details;
notes; SCHEDULED/CANCELLED/COMPLETED status; timestamps and concurrency version.
Preserve legacy database statuses/history. Do not accept a caller-selected driver,
available-seat count or arbitrary lifecycle fields.

Business rules:
1. Only authenticated active users create rides. Registration travel preferences
   stay separate from authorization, so DRIVER/PASSENGER/BOTH do not create new
   privileges. Establish the existing driver profile safely on first offer.
2. Departure must be future and timezone must be valid. Origin/destination must
   be present and distinct ignoring case.
3. Total seats must be an integer 1–6; availability must stay between zero and
   total. Reject fractional numeric coercion for seats and versions.
4. Prices must be nonnegative with appropriate precision (10 whole/2 fraction
   digits in the current numeric(12,2) schema).
5. Only owners can update/cancel. Owner cannot be changed. Required version
   values plus optimistic locking reject stale/concurrent updates with 409.
6. Completed/cancelled/departed rides cannot be edited. Cancellation preserves
   the record, reason and timestamp rather than deleting history.
7. Protect occupied seats. Until booking-aware workflows exist, reject changes
   for reserved seats or confirmed bookings; never reset booked availability.
8. Preserve saved-vehicle ownership and capacity checks. Optional descriptive
   vehicle text does not require adding a full vehicle CRUD module.
9. Use transactions, validated DTOs and safe consistent ProblemDetail errors.
10. Do not implement booking, payments, external maps, geocoding or routing.

Search:
- Filter by origin, destination, local departure date, minimum available seats
  and maximum price.
- Case-insensitive basic location text matching; prefix matching is the current
  contract. Escape SQL wildcard input, and filter/paginate in SQL through JPA
  specifications or an equivalent query.
- Exclude cancelled/completed/departed/full rides. Retain compatibility with
  published legacy offers while creating new offers as SCHEDULED.
- Date filters use explicit timezone calendar boundaries (UTC default).
- Bound page sizes and use deterministic departureAt then UUID ordering.
- Return DTOs, not entities; expose safe driver ID/display name without account
  email, phone, password or session data. Avoid N+1 driver-profile queries.

Database:
- Use the next additive migration only; current implementation uses V4.
- Never drop/recreate tables or change applied V1–V3 migrations.
- Make existing vehicle linkage optional without removing ownership protection.
- Add only missing descriptions/notes, status support, seat constraints and
  appropriate departure/status/location/driver indexes.
- Validate old data before tightening constraints; fail for explicit review
  rather than truncating or deleting incompatible history.
- Preserve all users/sessions/auth data; keep Hibernate schema validation.

Frontend:
- Public search at /rides: filters, URL state, pagination, real results,
  loading/error/empty states and currency/zone labels.
- Public details at /rides/:id with safe information and owner controls.
- Protected offer /rides/new, owner history /rides/mine and edit /rides/:id/edit.
- Accessible cancellation confirmation dialog with explicit confirm/keep actions.
- Reuse auth context, refresh-aware client and responsive styling.
- Accessible labels and validation; clear success/conflict messages.
- No invented rides and no booking/payment controls.

Tests:
- Authenticated creation and unauthenticated rejection; identity comes from JWT.
- Invalid dates/zones, prices and integer seat counts; unknown owner/availability
  fields cannot be injected.
- Ownership enforcement, update/cancel, stale versions and invalid lifecycles.
- Reserved-seat/confirmed-booking guards and existing vehicle capacity.
- Cancelled/full/completed/departed offers excluded from SQL search.
- Case-insensitive filters, pagination, deterministic ordering, wildcard escaping
  and date-zone boundaries.
- PostgreSQL constraints and simultaneous update protection.
- Existing auth/health and frontend flows remain working.

Use only the dedicated hoopr_test PostgreSQL database for integration tests.
Read TEST_DB_URL/USERNAME/PASSWORD securely; reject development database URLs.
Never print/commit credentials or run destructive tests on hoopr. Run backend
verification, frontend tests/build and the API collection when available.

Deliver implemented scope, file list, migration details, endpoints/sample bodies,
build/run commands, actual test results, manual checklist and limitations.
Document Phase 4 booking/seat-allocation work separately instead of claiming it
is already implemented. Do not claim an actual JDK 21/browser walkthrough unless
those checks were performed.
```

## 7. Resume prompt — Continue from the completed Phase 3 repository

This is the most useful prompt to paste into a fresh chat for the current project.

```text
You are continuing my existing Hoopr application at:
C:\Users\VIshal Java\Downloads\hoopr

Read SETUP.md, PHASE_SETUP.md, docs/phase-2-authentication.md and
docs/phase-3-rides.md, then inspect the source and any AGENTS.md instructions.
Treat documents as context to verify, not a substitute for inspecting actual code.

Phases 1–3 are implemented. Preserve foundation/health, auth/refresh security,
travel preferences and ride management/search. Do not rebuild them from scratch.
Current migrations are V1–V4. The next schema change must use the next available
migration version. No booking or payment APIs/UI exist yet, even though a bookings
table was created in the initial schema.

Use Java 21 target and the existing Spring Boot 3.5.16/React/Vite stack. Preserve
memory-only access tokens, HttpOnly hashed/rotating refresh sessions, exact CORS
origins, CSRF/origin checks on cookie-auth routes and existing owner/version checks.
Travel preferences DRIVER/PASSENGER/BOTH are not USER/ADMIN permissions.

Use hoopr_test exclusively for integration tests, with private process environment
TEST_DB_URL/TEST_DB_USERNAME/TEST_DB_PASSWORD. Do not use hoopr or reset tables.
Do not print/read secrets into output or commit local .env values. Spring Boot
does not automatically load .env. Preserve existing user/session/history data.

Last recorded verification on 3 November 2026:
- 62 backend tests including 12 PostgreSQL tests passed; executable JAR packaged.
- 32 frontend tests, TypeScript checking and production build passed.
- Phase 3 API collection: 18 requests / 30 assertions passed.
- JDK 25 was used with release 21; actual JDK 21 runtime/browser walkthrough
  remained unverified. These historical results must not be claimed as fresh runs.

Before implementing any new phase, inspect the relevant code, propose a concise
plan with schema changes/conflicts and wait for my explicit approval. Continue
approved work incrementally and test appropriately. Report limitations honestly.

First give a short current-state summary and the proposed next-phase plan.
Do not begin Phase 4 implementation until I approve its scope and plan.
```

## 8. Proposed Phase 4 complete prompt — Bookings and seat allocation

NOT IMPLEMENTED. This is a proposed next phase; copying this prompt authorizes analysis/planning first, not immediate code changes.

```text
Implement Phase 4: Bookings and transactional seat allocation for my existing
Hoopr application, after an approved plan. Phases 1–3 are complete.

First inspect actual source/schema/migrations, auth context/security, ride service,
ride version/availability rules, existing bookings table and its constraints,
error handling, API client and frontend routes. Read SETUP.md and phase docs.
List conflicts and proposed API/schema changes, then wait for explicit approval
before modifying files. Preserve all existing functionality and historical data.

Stack remains Java 21 target, Spring Boot 3.5.x, Data JPA, PostgreSQL, Flyway,
Spring Security JWT/refresh cookies and React/TypeScript/Vite.

Proposed APIs (adapt only after explaining existing conventions):
- POST /api/v1/rides/{rideId}/bookings: book seats as the authenticated passenger.
- GET /api/v1/bookings/me: authenticated passenger's booking history.
- GET /api/v1/bookings/{id}: booking details for its passenger or ride owner.
- POST /api/v1/bookings/{id}/cancel: passenger cancels their own active booking.
- GET /api/v1/rides/{rideId}/bookings: owner-only manifest with minimal safe data.
- Extend existing owner ride cancellation to cancel affected confirmed bookings
  atomically, preserving history and seat invariants.

Booking rules:
1. Derive passenger identity from JWT; never accept another passenger ID.
2. Only active authenticated users book. Do not treat travel preference as an
   authorization role, and do not allow booking one's own ride.
3. Only future scheduled rides with enough available seats accept bookings.
4. Validate an integer requested-seat count within the ride's capacity.
5. Use server-side ride price/currency snapshots; never trust client-supplied
   totals, prices, status, driver identity or availability.
6. Reuse bookings' existing UUID/FK/price snapshot/status fields and unique
   confirmed booking per passenger/ride constraint. Preserve existing records.
7. Allocate seats and create a confirmed booking in one database transaction.
   Prevent overselling, negative availability and partial success.
8. Define idempotency for creation/retries. A repeated successful request must not
   allocate seats twice; reuse of an idempotency key with a different body should
   produce a clear conflict. Plan any additional persistence additively.
9. Passenger cancellation restores held seats exactly once and records actor,
   reason and time. Repeated cancellation must not add seats repeatedly.
10. Driver ride cancellation must handle all confirmed bookings consistently in
    the same transaction, with correct CANCELLED_BY_DRIVER metadata. Maintain
    availableSeats = totalSeats minus confirmed reserved seats after mutations.
11. Establish a consistent lock/version protocol across booking creation,
    passenger cancellation, ride edits and driver cancellation. Explain lock
    order and retries; the existing ride @Version cannot be bypassed by unrelated
    seat updates that fail to participate in that protocol.
12. Adapt Phase 3's fail-closed booking guards only where a safe booking-aware
    replacement is implemented. Reject unsafe route/time/seat/price edits after
    bookings rather than silently altering passenger agreements.
13. A passenger may see only permitted booking details; driver manifests must
    expose minimal safe passenger data. ADMIN does not automatically bypass
    ownership unless an explicitly approved admin feature requires it.
14. Use validated DTOs, bounded pagination, efficient SQL queries, transactions
    and consistent 400/401/403/404/409 ProblemDetail errors.
15. Preserve authentication, role assignment, CSRF/cookies, CORS and health APIs.
    Never log credentials or tokens.

Database:
- Reuse existing bookings and ride availability/version columns.
- Inspect all applied migrations first; use V5 or the next available version.
- Add only needed constraints/indexes/idempotency/version metadata.
- Never drop/recreate tables, delete history, edit applied migrations or use
  Hibernate auto-update. No destructive tests against hoopr.

Frontend:
- Add booking controls on available ride details with seat selection, clear
  price/currency snapshot, loading/success/errors and confirmation.
- Add protected My Bookings, booking details and passenger cancellation.
- Add owner manifest/cancellation impact states where relevant.
- Reuse the existing auth context and centralized refresh-aware API client.
- Handle last-seat races/idempotent retries/conflicts by reloading current data.
- Use accessible forms/dialogs and preserve responsive styles.
- Do not introduce fake bookings or imply a payment was collected.

Out of scope unless separately approved:
payment processing/refunds, maps/routing, notifications/email/SMS, ratings,
password recovery, admin provisioning and new ride start/completion workflows.

Testing must include:
- Successful booking and server-derived passenger/price data.
- Unauthenticated/unauthorized access, self-booking and invalid seat counts.
- Departed/cancelled/completed rides and insufficient availability.
- Duplicate/idempotent requests and mismatched idempotency payloads.
- Concurrent passengers competing for the last seat: no overselling.
- Passenger cancellation, repeated cancellation and exact seat restoration.
- Driver ride cancellation with confirmed bookings and simultaneous cancellations.
- Ownership/privacy, database constraints and price/currency snapshot integrity.
- Existing ride editing/search, auth/refresh and public health regressions.
- Frontend validation/loading/error handling where configured.

Use only hoopr_test with securely supplied existing test credentials. Run all
backend tests/integration checks, frontend tests and production build. Update
API collections and manual checks. Report actual results; do not claim success
when required checks fail or were not run.

Deliver summary, complete file list, migrations, API examples, configuration,
run/test commands, results, manual checklist and remaining limitations.
```

## 9. Verification and handoff rule for every phase

A phase is complete only when its approved scope is implemented, required checks pass and unperformed checks are explicitly identified. Historical test results must be dated and kept distinct from new runs. A schema table's existence does not mean the corresponding feature/API is implemented.

Repeatable checks are in SETUP.md. Existing API collections are:

- docs/api/Hoopr-Phase-2.postman_collection.json
- docs/api/Hoopr-Phase-3.postman_collection.json
- docs/api/Hoopr-Local.postman_environment.json

Keep implementation guides, collection examples, required environment names and manual checklists updated with each approved phase. Ask for approval on a concrete plan before starting the next phase; do not infer approval to implement the proposed Phase 4 from this documentation task.
