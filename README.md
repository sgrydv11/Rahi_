# Hoopr

Start with [SETUP.md](SETUP.md) for prerequisites, versions, permissions, database setup and run/test commands. See [PHASE_SETUP.md](PHASE_SETUP.md) for completed phases, complete reusable prompts and the proposed next-phase prompt.

Hoopr carpooling application with authentication, ride management/search and transactional seat bookings: React + Vite + TypeScript, a Java 21 Spring Boot modular monolith, and PostgreSQL. Payments remain deferred. See [Phase 2 setup, API examples, tests and file inventory](docs/phase-2-authentication.md).

To test the APIs, import the [Postman collection](docs/api/Hoopr-Phase-2.postman_collection.json) and follow the [API testing guide](docs/api/README.md), including manual Thunder Client instructions.

Phase 3 adds ride offers, public search/details and owner management. See the [Phase 3 guide](docs/phase-3-rides.md) and [ride API collection](docs/api/Hoopr-Phase-3.postman_collection.json). PostgreSQL integration tests now require the dedicated `hoopr_test` database.

Phase 4 adds seat confirmation, My Bookings, passenger cancellation, owner manifests and atomic driver cancellation. See the [Phase 4 guide and file inventory](docs/phase-4-bookings.md) and [booking API collection](docs/api/Hoopr-Phase-4.postman_collection.json).

Phase 5 adds driver start and completion controls and passenger trip status. See the [ride lifecycle guide](docs/phase-5-ride-lifecycle.md) and [lifecycle API collection](docs/api/Hoopr-Phase-5.postman_collection.json).

## Prerequisites

- JDK 21 and Maven 3.6.3+; check `java -version` and `mvn -version`.
- Node.js 24 LTS and npm.
- PostgreSQL 15+ running locally, with its `bin` directory on PATH for the commands below.

The backend compiles with Java release 21. Spring Boot 3.5.16 manages Spring, Hibernate, Flyway, and JDBC dependency versions. Frontend exact resolutions are committed in `frontend/package-lock.json`; use `npm ci` for reproducible installs.

## PostgreSQL setup (PowerShell)

Run once using a PostgreSQL administrator. The role and database names below match the examples; change them together if needed.

```powershell
psql -U postgres -c "CREATE ROLE hoopr LOGIN;"
psql -U postgres -c '\password hoopr'
psql -U postgres -c "CREATE DATABASE hoopr OWNER hoopr;"
```

The password command prompts securely. No example password is provided or committed. The application runs Flyway automatically on startup. Do not manually execute migration files or edit a migration that has already been applied; add a new version instead.

## Backend (PowerShell, from repository root)

```powershell
Copy-Item backend/.env.example backend/.env
$env:DB_URL = 'jdbc:postgresql://localhost:5432/hoopr'
$env:DB_USERNAME = 'hoopr'
$dbCredential = Get-Credential -UserName hoopr -Message 'Enter the PostgreSQL application password'
$env:DB_PASSWORD = $dbCredential.GetNetworkCredential().Password
# Set JWT_SECRET and local cookie settings using docs/phase-2-authentication.md before starting.
Set-Location backend
mvn verify
mvn spring-boot:run
```

Spring Boot does **not** automatically load `.env`; the example documents configuration names. Set the environment variables in the same terminal as Maven or configure them through your IDE/deployment environment. Do not dot-source `.env` files as scripts. The backend requires valid database credentials and a reachable database to start.

From another terminal:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/health
Invoke-RestMethod http://localhost:8080/actuator/health
```

`/api/v1/health` is a process-level endpoint returning `{"status":"UP","application":"hoopr"}`. Actuator health includes the datasource check and returns no internal details. Both health routes remain public. Phase 2 adds explicit authentication endpoints and a bearer-protected profile; unfinished business APIs remain denied. CSRF protection remains enabled for cookie authentication.

## Frontend (a new PowerShell terminal, from repository root)

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173. Routes: `/`, `/login`, `/register`, and `/rides`. Login and registration connect to the backend; /profile requires authentication. Ride search and details are public. Offer, My Rides, and edit routes require authentication.

The development server proxies `/api` to `API_PROXY_TARGET` (default `http://localhost:8080`). The centralized client uses `VITE_API_BASE_URL` (default `/api/v1`). Every `VITE_` variable is public browser configuration and must never contain secrets. Restart Vite after configuration changes. Production hosting must serve `index.html` for frontend routes and reverse-proxy `/api` to the backend. `vite preview` only previews the static build; it is not a production server.

```powershell
npm run build
npm test
npm run preview
```

## Structure

```text
frontend/src/
  app/              Router and responsive application layout
  features/         Home, auth, profile, rides, bookings; reserved vehicles/history modules
  components/       Shared presentation
  lib/api/          Centralized fetch client and typed errors
  styles/           Responsive global styles
backend/src/main/
  java/com/hoopr/
    security/       Explicit auth routes and deny-by-default business boundary
    health/         Health REST endpoint
    common/         Global problem-detail exception handling
    auth/ user/       Authentication, sessions and current-user profile
    ride/ booking/  Ride management, search and transactional bookings
    driver/ vehicle/  Reserved feature packages
  resources/
    db/migration/   Versioned PostgreSQL schema
```

Feature modules will gain controller, service, repository, entity, and DTO packages as their functionality is implemented. Phase 2 adds auth/user entities, repositories, controllers, JWT support, and session services; the remaining feature modules stay reserved.

## Database model

`users` has one personal profile and an optional driver profile. Drivers own vehicles and rides; passengers own bookings against rides. All resource keys are UUIDs, with profile keys referencing the user's UUID. PostgreSQL native UUIDs require no extension; later application services will generate IDs. Event timestamps use `TIMESTAMPTZ`; departure time zones are retained separately.

The initial migration adds normalized unique emails, foreign keys, vehicle ownership linkage, capacities, availability bounds, price/currency/status checks, cancellation consistency, a unique confirmed booking per passenger/ride, and search/history indexes. Deletes are restricted to preserve history. Mutation services maintain timestamps, ownership, time zones and lifecycle rules. V2 adds authentication, V3 travel preferences, V4 ride management and V5 booking idempotency/version metadata. Phase 4 allocates seats atomically in application transactions. Applied migrations remain unchanged.

## Tests

`mvn verify` runs database-independent health, security, request-validation, and exception-response tests and packages the executable JAR. Frontend tests cover API URL construction, headers, problem responses, empty responses, and invalid paths.

An explicit PostgreSQL integration test is also supplied. Use a **dedicated empty test database** owned by the test role; Flyway will create tables and its schema-history table. Test rows are rolled back. The test never drops or cleans a database.

```powershell
# From backend/, after creating a separate hoopr_test database:
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr_test'
$env:TEST_DB_USERNAME = 'hoopr'
$testDbCredential = Get-Credential -UserName hoopr -Message 'Test database password'
$env:TEST_DB_PASSWORD = $testDbCredential.GetNetworkCredential().Password
mvn '-Dtest=DatabaseMigrationIT' test
```

This explicit integration test is excluded from the default unit-test naming pattern and requires the three test variables. Successful unit tests do not prove that PostgreSQL migrations have run. Never substitute H2 for PostgreSQL schema verification.

## Scope

Phases 1–4: foundation, authentication, profile reading, ride offers/search/details, owner management/history and transactional bookings/seat allocation. Payments, account/profile editing, notifications and ride start/completion remain deferred.

## Phase 1 verification in this workspace

- `npm ci`: passed; dependency audit reported zero vulnerabilities.
- `npm ls --depth=0`: passed with no invalid peer dependencies.
- `npm run build`: passed, including TypeScript checking.
- `npm test`: 8 tests passed (API client and page rendering).
- `mvn -B "-Dmaven.repo.local=../.maven-repository" verify`: passed; 6 tests passed and executable JAR packaged. This repository-local cache is ignored by Git.
- Builds ran on installed JDK 25 with compiler release 21; class-file major version 65 was confirmed. Running on an actual JDK 21 remains unverified because it is not installed here.
- PostgreSQL migration integration test, database-backed backend startup, and live health requests were not run: a PostgreSQL 15 service was discovered, but no dedicated database credentials were supplied. No database was modified.
- Initial sandboxed npm/Maven network requests and Vite execution were denied; approved reruns succeeded. An initial older Vitest dependency audit failed; patched tooling now passes. A response-reuse error in a test fixture was corrected before the final passing run.


# Rahi_
