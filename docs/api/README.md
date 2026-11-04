# Test Hoopr Phase 2

Phase 4 is implemented. Use the [booking guide](../phase-4-bookings.md) and [26-request booking collection](Hoopr-Phase-4.postman_collection.json) for seat allocation, retries and both cancellation paths. It creates disposable local accounts and preserves their history. Existing collections remain useful regressions. The bare `/bookings` path remains denied; implemented routes are `/bookings/me`, `/bookings/{id}` and ride-scoped operations.

Phase 3 ride search and management now have a separate [testing guide](../phase-3-rides.md) and `Hoopr-Phase-3.postman_collection.json`. The Phase 2 collection's unfinished-API check now uses `/bookings`, since `/rides` is public. Integration tests now require the dedicated `hoopr_test` database; the former development-schema alternative below is historical and is rejected by the current test guard.

## What was built

| Feature | What you can observe |
| --- | --- |
| Registration | Creates an account and personal profile; trims/lowercases email; returns USER role |
| Login | Checks BCrypt password hash; returns a 15-minute access JWT and an HttpOnly refresh cookie |
| Refresh | Accepts the refresh cookie, consumes its token, issues a new access token and a replacement refresh cookie |
| Reuse detection | Replaying a consumed refresh token revokes its entire session family, including the replacement token |
| Logout | Revokes the current refresh family and expires its cookie |
| Current profile | `/users/me` returns the authenticated user's id, email, fullName, and role |
| Authorization | USER and ADMIN may read their profile; public registration always assigns USER; unfinished business endpoints remain denied |
| Browser security | Explicit trusted origins, CSRF tokens for cookie authentication, configurable Secure/SameSite cookies |
| Login throttling | More than 20 attempts from a socket IP during a 15-minute window returns 429 |
| Frontend | Working registration/login forms, validation, profile route, loading/errors, session restoration, and logout |
| Travel preference | Choose Offer a seat (Driver), Find a seat (Passenger), or Both during registration; profile shows the saved choice |

V2 only adds the role column and refresh-session/token tables. Password hashes and normalized email uniqueness reuse V1. Access tokens stay in frontend memory; refresh tokens stay in HttpOnly cookies, with only hashes in PostgreSQL. Later phases add ride search and booking APIs; no admin-assignment API or password-reset feature exists.

V3 adds `user_profiles.travel_preference`. Registration accepts `travelPreference` with `DRIVER`, `PASSENGER`, or `BOTH`; login, refresh, registration and `/users/me` return it in the user/profile object. Existing profiles and requests omitting this field default to `BOTH`. Invalid or explicit null values return 400. This describes how someone wants to use Hoopr; all three choices retain the USER security role. The collection registers its first account as BOTH and its second account as DRIVER. To test Passenger manually, use a fresh email and `"travelPreference": "PASSENGER"` in request 04.

## Files to import

- `Hoopr-Phase-2.postman_collection.json`: 23 requests with automatic assertions and token handling.
- `Hoopr-Local.postman_environment.json`: optional local URLs and cookie expectations. Contains no credentials.
- `run-collection.mjs`: optional dependency-free Node 22+ runner for these requests and their scripts.

The JSON files contain no real passwords, JWT signing keys, or populated tokens. A run generates throwaway credentials and creates **two test accounts**. There is no delete-account API, so those accounts remain. Use your local/test backend. Postman's runtime token variables are separate from the application's memory-only token storage.

## Start the updated backend

Stop your old backend yourself and start the updated code, or choose a different port. A still-running Phase 1 process will not gain these endpoints from a build alone.

Spring Boot does **not** automatically load `backend/.env`. Set its values in your IDE run configuration or the terminal running Maven. Required settings include your database connection/password and JWT_SECRET. JWT_SECRET must be base64 encoding of at least 32 random bytes; it is not your database password. See `../phase-2-authentication.md` for a generator and complete setup.

For local HTTP, set these before starting:

```powershell
$env:AUTH_COOKIE_SECURE = 'false'
$env:AUTH_COOKIE_SAME_SITE = 'Lax'
$env:FRONTEND_ORIGINS = 'http://localhost:5173'
# Set DB_URL, DB_USERNAME, DB_PASSWORD and JWT_SECRET privately.
Set-Location backend
mvn verify
mvn spring-boot:run
```

Flyway applies V2 and V3 additively to the configured application database on startup. Health should be UP before running the collection. For HTTPS use Secure=true in the backend and change `expectedCookieSecure` to `true` in the API-client environment. Do not weaken production cookie settings to run local examples.

## Postman: automated run

1. Import both JSON files through Postman's Import action.
2. Select the **Hoopr — Local HTTP** environment.
3. Check `serverUrl` is the backend origin, e.g. `http://localhost:8080` **without `/api/v1`**. Set `frontendOrigin` to an entry in backend FRONTEND_ORIGINS; default `http://localhost:5173`.
4. Run the entire **Hoopr — Phase 2 Authentication** collection, all three folders in order, **one iteration**. It generates its own email/password at request 03.
5. Check every request's test results. The expected 400/401/403/409 responses are successful negative tests, not failures.

This collection disables the automatic cookie jar for each request and sends explicit Cookie headers. This keeps old and replacement refresh cookies separate for replay/revocation checks and avoids interference from an existing browser/API-client login. It does not change how the frontend handles HttpOnly cookies.

For individual Send requests, begin with 01–03, then follow the request numbers. The scripts save values in collection variables so later requests work. Do not define competing environment/global variables named `csrfToken`, `testEmail`, `testPassword`, `accessToken`, or `refreshToken`: they could override script-generated values. Request 23 clears runtime passwords/tokens; email and userId remain to help identify test accounts. After an interrupted run, clear sensitive collection variable values before exporting or sharing.

Repeated full runs count against login throttling. A 429 means wait for the 15-minute window to expire; do not disable the limiter to make a test pass.

## Expected requests and results

| # | Request | Expected |
| --- | --- | --- |
| 01–02 | GET `/api/v1/health`, GET `/actuator/health` | 200, UP, no login |
| 03 | GET `/api/v1/auth/csrf` | 200, token and XSRF-TOKEN cookie |
| 04 | POST `/api/v1/auth/register` | 201, USER profile |
| 05 | POST `/api/v1/auth/login` | 200, access JWT and refresh cookie |
| 06 | GET `/api/v1/users/me` with Bearer | 200, registered user |
| 07 | POST `/api/v1/auth/refresh` | 200, replacement refresh token |
| 08 | GET profile with refreshed JWT | 200 |
| 09 | Register same email in uppercase | 409 |
| 10–11 | Invalid email / short password | 400 |
| 12 | Incorrect password | 401 |
| 13 | Profile without Bearer | 401 |
| 14–15 | Refresh without CSRF / from untrusted Origin | 403 |
| 16 | GET `/api/v1/bookings` with valid Bearer | 403, unfinished API still denied |
| 17 | Register another account requesting ADMIN | 201, role remains USER |
| 18 | Refresh with consumed token from 05 | 401, revokes family |
| 19 | Refresh with replacement from 07 | 401, proves family revocation |
| 20 | Login again | 200, fresh family |
| 21 | Logout | 204, Max-Age=0 cookie |
| 22 | Refresh with logged-out token | 401 |
| 23 | Profile without authentication | 401, clears runtime secret variables |

Logout does **not** invalidate an already-issued JWT immediately. An old JWT may still read the profile until its 15-minute expiry. Requests 21–22 test refresh-session revocation; request 23 deliberately sends no Bearer token.

## Thunder Client

Thunder Client supports importing Postman collections, but its scripting uses a different API. The request definitions can be imported; the automatic `pm.*` scripts and assertions are designed for Postman. Import/cookie/scripting availability can also depend on your installed edition. Use Postman or the Node runner for the automated suite.

For a manual Thunder Client run:

1. Import the Postman collection and configure the same URL/cookie expectation variables. Ensure each request's cookie jar is disabled when using its explicit Cookie header; do not send two different hoopr_refresh cookies.
2. Set `testEmail` to a new address such as `hoopr-manual-001@example.test`, `upperEmail` to its uppercase version, and `testPassword` to a throwaway password of at least 12 characters and at most 72 UTF-8 bytes.
3. Send 03 and manually copy the JSON `token` into `csrfToken`. Its initialization script may not run; keep your manually chosen credentials.
4. Send 04 then 05. Copy JSON `accessToken` into `accessToken`; copy the value of `hoopr_refresh` from the response's Set-Cookie header into `refreshToken` (only the value, no attributes).
5. Send 06. Before 07, copy `refreshToken` into `beforeRotationToken`. After 07, replace `accessToken` and `refreshToken` with the new response values. Send 08–19 and compare statuses with the table.
6. Send 20 and capture the new tokens again. Before 21 copy `refreshToken` into `loggedOutRefreshToken`. Send 21–23; remove saved token/password values after testing.

Native API clients can inspect HttpOnly Set-Cookie headers for testing. Browser JavaScript cannot read the frontend's HttpOnly refresh cookie.

Official references: [Thunder Client import](https://docs.thunderclient.com/features/import), [Thunder Client scripting](https://docs.thunderclient.com/scripting), [Postman variable scopes](https://learning.postman.com/latest-v-12/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-variables).

## Optional terminal run

With the backend already running, from the repository root:

```powershell
node docs/api/run-collection.mjs
# Or use an alternate backend origin:
node docs/api/run-collection.mjs http://localhost:18081
```

This executes the same 23 requests and the subset of Postman script APIs used by this collection. It requires no npm installation and prints statuses/assertion counts, never HTTP bodies, passwords, or tokens. It is not a full Postman emulator. This runner uses the checked-in local HTTP cookie expectations; use Postman and its environment overrides for HTTPS.

Verified on 3 November 2026: **23 requests and 49 assertions passed** through this runner against the packaged backend on port 18081, using PostgreSQL schema `hoopr.hoopr_phase2_test`. Two generated test accounts remain in that isolated schema. The temporary server was stopped after testing; the existing application process and application tables were not changed. JSON parsing and syntax checks for every Postman script also passed. Import and execution inside the Postman/Thunder Client desktop UI were not exercised here.

After the travel-preference update, the collection examples/assertions were updated and syntax-checked; that earlier HTTP run preceded the new field. The updated application passed 38 backend tests (including PostgreSQL checks of all three choices), 16 frontend tests, TypeScript checks and a production build.

The installed JDK 25 initially failed to create its listener's temporary Unix-domain socket. For this temporary run only, launching Java from the repository root with `-Djdk.net.unixdomain.tmpdir=backend/target` resolved it. No application code or global Java setting was changed. If you encounter the same `Unable to establish loopback connection` startup error, use a short writable temporary-socket directory or your supported JDK 21 installation.

## Test the frontend

```powershell
# A second terminal, from the repository root:
Set-Location frontend
npm run dev
```

Open `http://localhost:5173/register`, choose Driver, Passenger, or Both, create a fresh account, then log in. You should reach `/profile` and see your name/email and saved travel preference. Repeat with a new email for each choice. Reload the page: the refresh cookie should restore the session and the preference should remain. Click Log out, then visit `/profile`: you should be redirected to `/login`. Try invalid fields and a duplicate email and check the displayed errors. The home page and public ride preview should still render.

In browser developer tools, access tokens should not appear in Local Storage or Session Storage. The refresh cookie should be HttpOnly and match your configured Secure/SameSite attributes. Do not paste credentials or tokens into screenshots or shared logs.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | Backend started successfully and serverUrl has the correct port |
| Auth endpoint 403, health 200 | Old Phase 1 process still running, missing CSRF cookie/header, or Origin not trusted |
| Refresh returns 401 after login | Token captured correctly, no duplicate cookies, and the reuse tests haven't already revoked this family |
| Cookies missing in browser on HTTP | AUTH_COOKIE_SECURE=false explicitly for local HTTP; correct same-site hosting |
| 409 at first registration | You resent 04 with the same testEmail; send 03 once to generate a fresh account |
| Cookie-attribute assertion fails | Collection expectedCookieSecure/expectedSameSite match the backend |
| Backend fails at startup | DB credentials are in process environment, PostgreSQL reachable, JWT_SECRET valid; .env is not loaded automatically |
| Build runs on JDK 25 | Target remains Java 21; actual JDK 21 runtime verification is still outstanding |

The Java tests in `../phase-2-authentication.md` additionally cover password hashing, JWT expiry/signature validation, database constraints, disabled accounts, and concurrent rotation. A manual collection cannot prove password hashing or lock correctness by inspecting public JSON alone.
