# Hoopr

The Android and iOS app lives in `mobile/` and uses Expo and React Native. See the [native app setup guide](mobile/README.md).

Start with [SETUP.md](SETUP.md) for prerequisites, versions, permissions, database setup, run/test commands, and Capacitor Android/iOS builds. See [PHASE_SETUP.md](PHASE_SETUP.md) for completed phases, complete reusable prompts and the proposed next-phase prompt.

Hoopr is a carpooling application with authentication, ride search, transactional seat bookings and Stripe or Razorpay test checkout. It uses React, Vite, TypeScript, Java 21, Spring Boot and PostgreSQL. See [Phase 2 setup and API examples](docs/phase-2-authentication.md).

To test the APIs, import the [Postman collection](docs/api/Hoopr-Phase-2.postman_collection.json) and follow the [API testing guide](docs/api/README.md), including manual Thunder Client instructions.

Phase 3 adds ride offers, public search/details and owner management. See the [Phase 3 guide](docs/phase-3-rides.md) and [ride API collection](docs/api/Hoopr-Phase-3.postman_collection.json). PostgreSQL integration tests now require the dedicated `hoopr_test` database.

Phase 4 adds seat confirmation, My Bookings, passenger cancellation, owner manifests and atomic driver cancellation. See the [Phase 4 guide and file inventory](docs/phase-4-bookings.md) and [booking API collection](docs/api/Hoopr-Phase-4.postman_collection.json).

Phase 5 adds driver start and completion controls and passenger trip status. See the [ride lifecycle guide](docs/phase-5-ride-lifecycle.md) and [lifecycle API collection](docs/api/Hoopr-Phase-5.postman_collection.json).

Phase 6 adds post-trip driver ratings from confirmed passengers. See the [rating guide](docs/phase-6-ratings.md) and [regression test cases](docs/test-cases.md).

Phase 7 adds an in-app Notifications inbox. Phase 8 adds profile editing and private saved vehicles, with an optional vehicle selector on new ride offers. See the [regression test cases](docs/test-cases.md).

Phase 9 adds optional public pickup and drop-off pins, straight-line distance and a driving directions link. Phase 10 adds Stripe or Razorpay test checkout, receipts and refunds. See the [payment setup guide](docs/phase-10-razorpay.md).

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

## Deploy the web app and API to Render

The root `render.yaml` defines a single service for the web app and API. Set the Dockerfile path to `backend/Dockerfile` and the Docker build context to the repository root (`.`). The image builds the Vite frontend and packages it into the Java 21 server. The service listens on Render's `PORT` and checks `/actuator/health`.

Create a PostgreSQL database in Render (or use an existing PostgreSQL database), then set these service environment variables in the Render Dashboard:

| Variable | Value |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://<internal-host>:5432/<database>` using the database's internal host and name |
| `DB_USERNAME` | Database user |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Base64-encoded random secret with at least 32 bytes |
| `FRONTEND_ORIGINS` | Additional trusted web origins, if needed. The Render service URL is included automatically. |

Generate a JWT secret locally in PowerShell; enter the output in Render without saving it in the repository:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Keep `AUTH_COOKIE_SECURE=true`. `AUTH_COOKIE_SAME_SITE=Lax` works when the frontend and API are same-site; if they are on different sites, set it to `None` (which requires Secure). If enabling Stripe test checkout, also set `STRIPE_SECRET_KEY` and `STRIPE_FRONTEND_ORIGIN` to the frontend's deployed origin. Render's PostgreSQL connection string is not itself a JDBC URL: use its internal hostname/database with `jdbc:postgresql://` and provide the database credentials separately.

After deployment, verify `/`, a direct visit to `/login`, and `/api/v1/health` on the service URL. The web build uses the relative `/api/v1` path, so password auth and its cookies stay on the same origin. Flyway applies migrations at backend startup.

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

Phases 1–10 cover the application foundation through test checkout. Sandbox checkout requires test credentials for the selected provider. The ADMIN role exists, and an admin dashboard is outside these phases.

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
# Google sign-in for the web frontend

The login and registration pages use Google Identity Services. The backend verifies signed Google ID tokens and issues the existing app session. Flyway V15 adds a unique Google subject to users. Existing passwords remain usable.

1. In Google Cloud Console, create/select the FlexirRides project and open Google Auth Platform.
2. Configure Branding, Audience and the consent screen. For external testing, add the Google accounts that will test sign-in.
3. Create an OAuth client with application type Web application.
4. Add authorized JavaScript origins `http://localhost`, `http://localhost:5173`, and the exact HTTPS origin of the deployed frontend. Origins contain no route such as `/login`.
5. Set `GOOGLE_CLIENT_ID` on the backend to the public client ID ending in `.apps.googleusercontent.com`, then restart/redeploy the backend. For local startup, set it in the environment before running `scripts/start-local.ps1`.
6. Test both login and registration. The frontend reads the client ID from `/api/v1/auth/google/config`; no frontend OAuth secret is needed. This implementation uses the Google popup button callback.

Google sign-in remains unavailable until the client ID and authorized origins are configured. Existing accounts with authoritative Gmail/Workspace addresses can be linked after Google verification. Existing third-party email accounts require their original sign-in method. Production OAuth publication and consent requirements must be completed in Google Cloud before public rollout.
