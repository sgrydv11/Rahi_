# Phase 2: authentication and authorization

## Configuration

Existing DB_URL, DB_USERNAME, DB_PASSWORD, SERVER_PORT, VITE_API_BASE_URL and API_PROXY_TARGET remain supported. Spring Boot does not automatically load .env files.

New backend variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| JWT_SECRET | Required, no default | Base64 encoding of at least 32 cryptographically random bytes; keep private |
| JWT_ISSUER | hoopr | Exact JWT issuer |
| FRONTEND_ORIGINS | http://localhost:5173 | Comma-separated exact trusted origins, no wildcard, path, or trailing slash |
| AUTH_COOKIE_SECURE | true | Set false explicitly for local HTTP only |
| AUTH_COOKIE_SAME_SITE | Lax | Strict, Lax, or None; None requires Secure |
| AUTH_REFRESH_LIFETIME | 30d | Absolute session-family lifetime; positive, maximum 90d |

Access tokens expire in 900 seconds. JWT verification checks HS256 signature, issuer, audience, subject, role, issuance and expiry. JWT_SECRET must be the same across backend instances. Generate it locally and supply it through your deployment secret manager. For a local PowerShell session:

```powershell
$jwtBytes = New-Object byte[] 32
$jwtGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$jwtGenerator.GetBytes($jwtBytes)
$jwtGenerator.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($jwtBytes)
$env:AUTH_COOKIE_SECURE = 'false'
$env:FRONTEND_ORIGINS = 'http://localhost:5173'
# Set DB_URL, DB_USERNAME and DB_PASSWORD as in the root README.
Set-Location backend
mvn verify
mvn spring-boot:run
```

The attached executable JAR is `backend/target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar`; with the same environment configured you can also run `java -jar target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar` from backend/. The `exec` classifier avoids Spring Boot renaming an artifact that an existing Java process may have open. The original Maven artifact remains a thin JAR.

Frontend, in another terminal:

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm run dev
```

Use HTTPS and AUTH_COOKIE_SECURE=true in production. Same-site deployment through a reverse proxy is preferred. Cross-site deployment requires SameSite=None and Secure; browsers can still block third-party cookies. Keep trusted origins limited to hosts you control. The Vite proxy preserves the browser's Origin, which must be in FRONTEND_ORIGINS. Never put JWT_SECRET in a VITE_ variable.

## Migration

V1__initial_schema.sql is unchanged. V2__authentication.sql only:

- Adds users.role, default USER, constrained to USER or ADMIN (existing accounts receive USER).
- Creates refresh_sessions (user, absolute expiry, revoked flag).
- Creates refresh_tokens (SHA-256 hash, family reference, consumed flag) and lookup indexes.

Existing email normalization and UNIQUE constraints remain authoritative, including concurrent registrations. Registration inserts users and user_profiles in one transaction. No existing tables are dropped or recreated. Hibernate stays in validate mode; Flyway runs migrations on startup.

V3__user_travel_preference.sql adds `user_profiles.travel_preference`, constrained to DRIVER, PASSENGER or BOTH. Existing profiles default to BOTH. The registration form asks whether someone wants to offer a seat, find a seat, or both. The API field is `travelPreference`; omitted fields default to BOTH for older clients, while invalid or null values return 400. Registration, login, refresh and current-profile responses include the preference. This is independent of USER/ADMIN authorization and does not implement ride publishing or booking.

Refresh tokens have 256 random bits, travel only in a host-only HttpOnly cookie scoped to /api/v1/auth, and never appear in JSON. PostgreSQL stores only hashes. Rotation locks the family before reading token state. A consumed token revokes the entire family in a transaction that commits even when returning 401. Family expiry is absolute, so rotation cannot prolong it. Logout revokes the family, including when an older consumed cookie is supplied, and clears the cookie. Invalid or missing logout cookies are handled idempotently.

## Thunder Client examples

For a ready-to-import Postman collection with 23 requests, automatic assertions, manual Thunder Client instructions, and a frontend walkthrough, see [API testing guide](api/README.md). Import `docs/api/Hoopr-Phase-2.postman_collection.json` and optionally `docs/api/Hoopr-Local.postman_environment.json`.

Set baseUrl to http://localhost:8080/api/v1. Enable the cookie jar. For local HTTP, set AUTH_COOKIE_SECURE=false before starting the server.

1. GET {{baseUrl}}/auth/csrf. Keep the XSRF-TOKEN cookie and copy the response token into a temporary csrfToken variable. This cookie is HttpOnly; use the JSON token, not browser cookie access.
2. On **every auth POST**, set Origin: http://localhost:5173 and X-XSRF-TOKEN: {{csrfToken}}. Keep cookies enabled. Use Content-Type: application/json for JSON bodies. Missing/untrusted origins or missing/mismatched CSRF return 403, including for native API clients.

Registration: POST {{baseUrl}}/auth/register

```json
{"email":"alice@example.com","password":"choose-a-long-private-password","fullName":"Alice Rider","travelPreference":"BOTH"}
```

Returns 201 with profile (USER role). Registration does not automatically log in. Duplicate email returns 409. Passwords require at least 12 characters and at most 72 UTF-8 bytes; email is trimmed and lowercased. Names are required, up to 120 characters; email up to 254.

Login: POST {{baseUrl}}/auth/login

```json
{"email":"alice@example.com","password":"choose-a-long-private-password"}
```

Returns 200 with accessToken, tokenType, expiresIn, user; sets hoopr_refresh cookie. Copy accessToken into a temporary accessToken variable. Invalid credentials return 401; throttled login returns 429 with Retry-After.

Profile: GET {{baseUrl}}/users/me with Authorization: Bearer {{accessToken}}. No CSRF header or cookie is needed for this bearer request.

Refresh: POST {{baseUrl}}/auth/refresh with the Origin, CSRF header and cookie jar, no body. Save the new accessToken; the cookie jar replaces the refresh cookie. Replaying an old refresh cookie returns 401 and revokes the family, including its newly rotated token.

Logout: POST {{baseUrl}}/auth/logout with the Origin, CSRF header and cookie jar, no body. Returns 204 and expires the refresh cookie.

Health: GET http://localhost:8080/api/v1/health and GET http://localhost:8080/actuator/health need no authentication. Other unfinished business APIs remain denied.

Never export/share Thunder Client environments containing real tokens or passwords.

## Frontend behavior

The existing pages now submit validated forms. Successful registration links to login. Login redirects to the protected profile or the originally requested protected path. The shared navigation exposes profile and logout when authenticated. Loading and errors have status/alert semantics. Existing home and public ride-search preview remain available.

AuthProvider restores the session once through refresh, including under React StrictMode. Tokens remain in module memory only. The client refreshes within 30 seconds of expiry before a protected request, shares concurrent refresh work, and retries a 401 exactly once. It does not poll or refresh when idle. Reloading restores the session through HttpOnly cookies. Failed logout keeps the session visible for retry rather than claiming revocation succeeded.

## Verification

Default checks:

```powershell
# backend/
mvn verify
# frontend/
npm test
npm run build
```

PostgreSQL checks require a dedicated test database and never clean/drop schemas:

```powershell
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr_test'
$env:TEST_DB_USERNAME = 'hoopr'
$testCredential = Get-Credential -UserName hoopr -Message 'Dedicated test database password'
$env:TEST_DB_PASSWORD = $testCredential.GetNetworkCredential().Password
# backend/
mvn '-Dtest=DatabaseMigrationIT,AuthenticationIT' test
```

AuthenticationIT tests actual JPA mappings, migrations, uniqueness, transaction commit on replay, concurrent rotation, logout, disabled accounts, real cookie/CSRF login, bearer profile and both health endpoints. It creates random test accounts and deletes only its own refresh-token/session/profile/user fixtures afterwards. DatabaseMigrationIT uses rollback for test rows. Do not point these tests at production.

Historical Phase 2 command only: Phase 3 now requires the dedicated hoopr_test database and rejects the development-database schema alternative below. Previously, a local isolated schema was supported. Create `hoopr_phase2_test` once as its owner, then keep the current-schema parameter and both Flyway options together:

```powershell
# Run once through psql, using your local development role:
# CREATE SCHEMA IF NOT EXISTS hoopr_phase2_test AUTHORIZATION hoopr;
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr?currentSchema=hoopr_phase2_test'
# Set TEST_DB_USERNAME and TEST_DB_PASSWORD as above.
mvn '-Dtest=DatabaseMigrationIT,AuthenticationIT' '-Dspring.flyway.default-schema=hoopr_phase2_test' '-Dspring.flyway.schemas=hoopr_phase2_test' test
```

### Results in this workspace (3 November 2026)

Travel-preference update: **38 backend tests passed** (32 unit/security and 6 PostgreSQL integration tests), and executable packaging passed. Tests cover all three preferences through registration, persistence, login, refresh and profile, plus omitted/invalid/null API values and unchanged USER authorization. V3 was applied and validated in `hoopr.hoopr_phase2_test`; the normal application schema receives it on backend restart. **16 frontend tests**, TypeScript checking and the production build passed. Postman request bodies and preference assertions were updated and their JSON/script syntax validated.

- Backend `mvn -B '-Dmaven.repo.local=../.maven-repository' verify`: **passed**, 25 unit/security tests, executable JAR attached.
- PostgreSQL integration command above, with the repository-local Maven cache: **passed**, 5 tests against PostgreSQL 15.13 in `hoopr.hoopr_phase2_test`.
- Flyway applied V1 and V2 in that isolated schema; subsequent migration validation passed. The working application's existing schema was not migrated by these tests. V2 will apply there when the updated application starts with its normal datasource.
- Frontend: **13 tests passed**, TypeScript checking passed, Vite production build passed. This execution shell had no npm on PATH; checks used the installed Node 24.22.1 executable to run `node_modules/vitest/vitest.mjs run`, `node_modules/typescript/bin/tsc --noEmit`, and `node_modules/vite/bin/vite.js build`, equivalent to the test/build package scripts.
- Backend checks used installed JDK 25.0.4.1 with compiler release 21. An actual JDK 21 runtime was not available for verification.
- Earlier checks exposed missing test configuration, mock cookie serialization differences, the resource-server CSRF exemption, a locked generated JAR, and a nonexistent test database. The final passing commands above include the corrections and isolated-schema setup.
- No running application process was stopped. The isolated test schema and its migrated tables remain; test-created accounts/session rows were removed. No schemas or tables were dropped.

## Operational limitations

- Logout revokes refresh tokens. Existing access JWTs remain usable until their 15-minute expiry; there is no access-token denylist. A disabled user's profile is rejected immediately and refresh/login is blocked.
- Login throttling allows 20 attempts per socket IP per 15-minute fixed window, bounded to 10,000 active IP entries per process. All attempts count, including successful ones. It does not trust forwarded IP headers. Behind a proxy this groups clients by proxy address; production replicas should use shared edge/Redis throttling with a trusted proxy configuration.
- Separate tabs have separate memory/refresh coordination. Concurrent refresh of the same cookie across tabs can trigger conservative family revocation and require login again. Reuse detection is deliberately strict.
- Consumed hashes must be retained until family expiry for replay detection. Automated expired-family cleanup is not included; operators can delete tokens for expired families before deleting those families. Retain active and unexpired revoked families.
- ADMIN provisioning is an offline database/operations task. There is no public assignment endpoint or admin business screen in this phase. Method security is enabled for future role-restricted services, while /users/me accepts USER and ADMIN. Tokens carry a role snapshot until expiry.
- Email verification, password recovery, MFA and account-management operations are outside this phase.

## File inventory

Modified:

- README.md
- backend/pom.xml
- backend/.env.example
- backend/src/main/resources/application.yml
- backend/src/main/java/com/hoopr/security/SecurityConfig.java
- backend/src/main/java/com/hoopr/common/exception/GlobalExceptionHandler.java
- backend/src/test/java/com/hoopr/health/HealthControllerTest.java
- frontend/src/main.tsx
- frontend/src/app/router.tsx
- frontend/src/app/layouts/AppLayout.tsx
- frontend/src/app/pages.test.tsx
- frontend/src/features/auth/AuthPages.tsx
- frontend/src/styles/global.css

Created:

- docs/phase-2-authentication.md
- backend/src/main/resources/db/migration/V2__authentication.sql
- backend/src/main/resources/db/migration/V3__user_travel_preference.sql
- backend/src/main/java/com/hoopr/user/TravelPreference.java
- backend/src/main/java/com/hoopr/auth/AuthSettings.java
- backend/src/main/java/com/hoopr/auth/AuthFailure.java
- backend/src/main/java/com/hoopr/auth/AuthController.java
- backend/src/main/java/com/hoopr/auth/AuthService.java
- backend/src/main/java/com/hoopr/auth/LoginLimiter.java
- backend/src/main/java/com/hoopr/auth/RefreshSession.java
- backend/src/main/java/com/hoopr/auth/RefreshToken.java
- backend/src/main/java/com/hoopr/auth/SessionRepository.java
- backend/src/main/java/com/hoopr/auth/TokenRepository.java
- backend/src/main/java/com/hoopr/user/UserAccount.java
- backend/src/main/java/com/hoopr/user/UserProfile.java
- backend/src/main/java/com/hoopr/user/UserRepository.java
- backend/src/main/java/com/hoopr/user/ProfileRepository.java
- backend/src/main/java/com/hoopr/user/UserController.java
- backend/src/test/java/com/hoopr/auth/AuthServiceTest.java
- backend/src/test/java/com/hoopr/auth/AuthWebTest.java
- backend/src/test/java/com/hoopr/auth/AuthenticationIT.java
- frontend/src/features/auth/auth.ts
- frontend/src/features/auth/auth.test.ts
- frontend/src/features/auth/AuthContext.tsx
- frontend/src/features/profile/ProfilePage.tsx

