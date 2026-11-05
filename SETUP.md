# Hoopr setup guide

Updated 5 November 2026. This guide covers local setup and verification through Phase 10.

## 1. Required applications and versions

| Component | Version for this project | How it is used |
| --- | --- | --- |
| Java Development Kit (JDK) | **21** target; use a JDK, not only a JRE | Compile and run the backend. `<java.version>21</java.version>` is set in backend/pom.xml. |
| Apache Maven | **3.6.3+**; a 3.9.x installation is suitable | Resolve backend dependencies, test, package, and run Spring Boot. No Maven wrapper is included. |
| Node.js | **24.x LTS** baseline | Run Vite, TypeScript, frontend tests and npm. Previous successful checks used 24.22.1. |
| npm | The version bundled with your Node.js installation | Use npm ci with the existing lockfile. No separate global React/Vite installation is needed. |
| PostgreSQL server | **15+** project baseline; **15.13** was verified | Persistent application database and dedicated integration-test database. Newer major versions have not been verified here. |
| PostgreSQL command-line client | psql matching your installed server package | Create roles/databases and inspect migration state. |
| PowerShell | Windows PowerShell 5.1 or PowerShell 7 for these examples | Run setup, environment-variable and build commands. |
| Browser | A browser supporting ES2022 and native HTML dialog | Use the React app. |
| Editor/IDE | Optional; Java 21 and TypeScript support | Any suitable Java/React editor can be used. |
| Postman or Thunder Client | Optional; no project-pinned client version | Import the API collections under docs/api. Automatic collection scripts are written for Postman. |
| Git | Optional for running an existing download; needed for source control | Clone/pull/review changes if the project is managed in Git. |

Frameworks/libraries are installed by Maven/npm, not as separate desktop applications:

| Dependency | Actual repository version | Source |
| --- | --- | --- |
| Spring Boot | **3.5.16** | backend/pom.xml |
| Spring Security, Data JPA, Hibernate, Flyway, PostgreSQL JDBC | Managed by Spring Boot 3.5.16 | backend/pom.xml; avoid choosing unrelated versions manually |
| React / React DOM | **19.3.1** locked; declared range ^19.2.0 | frontend/package-lock.json / package.json |
| React Router | **7.18.5** locked; declared range ^7.9.0 | frontend/package-lock.json |
| TypeScript | **5.9.3** | frontend/package-lock.json |
| Vite | **8.3.5** | frontend/package-lock.json |
| React Vite plugin | **6.2.1** | frontend/package-lock.json |
| Vitest | **5.0.5** | frontend/package-lock.json |

The locked Vitest requires Node ^22.12.0, ^24.0.0 or >=26.0.0; therefore Node 20 is not sufficient for the full test suite even though Vite's own minimum is lower. Use Node 24.x for the documented baseline. npm ci reproduces the locked versions; npm install may change resolutions. This table is a repository snapshot, not a claim that these are the latest releases.

Previous backend verification used installed JDK 25.0.4.1 with compiler release 21. Execution on an actual JDK 21 was not verified in that run. Installing JDK 21 aligns your local runtime with the intended target.

Official installation references: [JDK 21](https://adoptium.net/temurin/releases/?version=21), [Maven installation](https://maven.apache.org/install.html), [Node.js downloads](https://nodejs.org/en/download), [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/). Select the intended major version rather than changing the project to whatever the download page currently highlights. Spring Boot's Maven minimum is documented in its [3.5 system requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html).

## 2. Permissions and local ports

| Action | Permission needed |
| --- | --- |
| Install software for all users or install/start the PostgreSQL Windows service | Windows administrator approval may be required by the installer/service manager |
| Extract Maven/JDK into a user-owned directory and configure your user PATH | Write access to that directory and your user environment settings |
| Run backend/frontend, compile, test, edit source | Normal user access; write permission in the workspace and dependency-cache directories |
| Create PostgreSQL roles/databases | A PostgreSQL administrator, or a role with the specific required privilege |
| Run Flyway migrations as hoopr | Ownership/DDL permission for application tables and the intended schema; the examples make hoopr the database owner |
| Run the application | Ability to connect to PostgreSQL and read/write its application tables |
| Download dependencies on the first build | Network access to Maven Central and the configured npm registry, including any approved company proxy |
| Use the local web app | Loopback connections to backend/frontend ports |

Windows administrator access and PostgreSQL administrator access are different. Running PowerShell as Administrator does not automatically give the hoopr database role permission to create databases. The application role does not need PostgreSQL SUPERUSER or CREATEDB after the databases have been provisioned.

Default local connections:

| Service | Address/port |
| --- | --- |
| PostgreSQL | localhost:5432 |
| Spring Boot backend | http://localhost:8080 |
| Vite frontend | http://localhost:5173 |

Keep the local setup on your own machine. No public inbound firewall opening is needed for normal loopback development. Stop the process occupying a port or configure another port consistently; do not start duplicate backend processes on 8080. Changing frontend origin requires updating FRONTEND_ORIGINS; changing backend port requires updating API_PROXY_TARGET.

## 3. Install tools and check PATH

Install JDK 21, Maven, Node 24 with npm, and PostgreSQL with psql. Select your PostgreSQL administrator password during installation and keep it private. pgAdmin is an optional graphical alternative to psql.

Configure JAVA_HOME to your JDK installation directory and add its bin directory to your user PATH. Add Maven's bin directory, Node/npm, and PostgreSQL's bin directory to PATH. Reopen terminals and your IDE after changing environment settings. Configure the IDE's project SDK and Maven runner JDK consistently.

Verify from a new PowerShell terminal:

```powershell
java -version
javac -version
mvn -version
node --version
npm.cmd --version
psql --version
Get-Command java, javac, mvn, node, npm.cmd, psql
```

Check the Java home/version printed by Maven; Maven can use a different JDK from the one you expected. If PowerShell blocks npm.ps1, use npm.cmd instead of changing execution policy. If psql is not on PATH, invoke its installed executable directly, for example `& 'C:\Program Files\PostgreSQL\15\bin\psql.exe' --version`. Change 15 in that path to your actual installation directory.

## 4. Open the project

Examples use the current workspace. On another machine, replace this path with the location of your copy:

```powershell
Set-Location 'C:\Users\VIshal Java\Downloads\hoopr'
```

The repository contains backend/, frontend/, docs/, and the migration files. Keep frontend/package-lock.json. Do not copy node_modules, target, real .env files, or credentials into source-control commits.

## 5. Provision the databases once

On this machine hoopr and hoopr_test have already been provisioned. Check before creating existing objects. On a fresh installation, use these commands as a PostgreSQL administrator; each -W prompts for the administrator's password:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -c 'CREATE ROLE hoopr LOGIN;'
# Opens psql's secure password prompt for the new application role:
psql -h localhost -p 5432 -U postgres -d postgres -W -c '\password hoopr'
psql -h localhost -p 5432 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -c 'CREATE DATABASE hoopr OWNER hoopr;'
psql -h localhost -p 5432 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -c 'CREATE DATABASE hoopr_test OWNER hoopr;'
```

If the hoopr role already exists, keep its current password and skip role creation/password setup. If a database already exists, keep it; do not drop it to rerun setup. If your DBA uses another administrator username, replace postgres. The existing hoopr role normally cannot create databases; use the administrator connection for this one-time step.

Inspect databases and the application role:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -W -c '\l'
psql -h localhost -p 5432 -U postgres -d postgres -W -c '\du hoopr'
```

hoopr is for normal development. **hoopr_test is for integration tests.** Current integration tests reject a TEST_DB_URL pointing at hoopr, including its old hoopr_phase2_test schema.

Do not run separate CREATE TABLE scripts. Flyway creates and upgrades tables using these existing migrations:

| Migration | Purpose |
| --- | --- |
| V1__initial_schema.sql | Users/profiles, driver profiles, vehicles, rides, bookings, constraints and indexes |
| V2__authentication.sql | USER/ADMIN roles, refresh-session families and hashed refresh tokens |
| V3__user_travel_preference.sql | DRIVER / PASSENGER / BOTH profile preference; existing profiles default to BOTH |
| V4__ride_management.sql | Optional saved vehicle, ride descriptions/notes, SCHEDULED status, seat limit and search indexes |
| V5__booking_idempotency.sql | Booking keys, unique passenger/request index, version, seat limit and ride/history index |
| V6__booking_ratings.sql | Optional driver score and rating timestamp with a booking constraint |
| V7__booking_payments.sql | Razorpay test orders, verified captures and refunds tied to bookings |
| V8__payment_provider.sql | Stripe session IDs and the provider associated with each order |

Applied migration files must stay unchanged. Add the next version for future schema changes. Hibernate remains in validate mode. V4 intentionally fails if existing rides exceed six seats; investigate those records instead of deleting history or changing applied migrations.

## 6. Configure and run the backend

The backend needs process environment variables or matching IDE run configuration. **Spring Boot does not automatically read backend/.env.** Copying a template alone does not configure a Maven terminal.

For a new checkout, you may create the ignored examples without overwriting existing files:

```powershell
if (-not (Test-Path 'backend/.env')) { Copy-Item 'backend/.env.example' 'backend/.env' }
if (-not (Test-Path 'frontend/.env')) { Copy-Item 'frontend/.env.example' 'frontend/.env' }
```

Set backend environment variables in the same terminal that will run Maven. This example prompts for the application role's password and generates a random signing secret without printing either:

```powershell
# From the repository root:
$env:DB_URL = 'jdbc:postgresql://localhost:5432/hoopr'
$env:DB_USERNAME = 'hoopr'
$hooprDbCredential = Get-Credential -UserName hoopr -Message 'Hoopr application database password'
$env:DB_PASSWORD = $hooprDbCredential.GetNetworkCredential().Password

$hooprSigningBytes = New-Object byte[] 32
$hooprRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$hooprRandom.GetBytes($hooprSigningBytes)
$hooprRandom.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($hooprSigningBytes)

$env:JWT_ISSUER = 'hoopr'
$env:SERVER_PORT = '8080'
$env:FRONTEND_ORIGINS = 'http://localhost:5173'
$env:AUTH_COOKIE_SECURE = 'false'
$env:AUTH_COOKIE_SAME_SITE = 'Lax'
$env:AUTH_REFRESH_LIFETIME = '30d'

Set-Location backend
mvn -B '-Dmaven.repo.local=../.maven-repository' verify
mvn '-Dmaven.repo.local=../.maven-repository' spring-boot:run
```

The first backend startup runs Flyway against hoopr. Later startups validate and apply only new migrations. The first build downloads dependencies; later builds can reuse .maven-repository. You can omit the Maven cache option to use your normal user Maven cache instead.

Generating JWT_SECRET again invalidates old access JWT signatures. For stable local sessions, keep the same privately stored key in your IDE/environment across restarts; refresh-session records are still governed by their database state. Use the same signing key across backend replicas. Do not print the key or put it in frontend variables. The local generator is a setup example, not an instruction to rotate your current key on every run.

Environment reference:

| Variable | Required/default | Meaning |
| --- | --- | --- |
| DB_URL | Default localhost hoopr JDBC URL | Actual application datasource |
| DB_USERNAME | Required | Database application role |
| DB_PASSWORD | Required for the configured database authentication | Application role password |
| JWT_SECRET | Required, no fallback | Base64 secret containing at least 32 random bytes |
| JWT_ISSUER | hoopr | JWT issuer |
| SERVER_PORT | 8080 | Backend port |
| FRONTEND_ORIGINS | http://localhost:5173 | Comma-separated exact trusted origins, without path/trailing slash/wildcards |
| AUTH_COOKIE_SECURE | true in application defaults | Set false explicitly for local HTTP only; true for production HTTPS |
| AUTH_COOKIE_SAME_SITE | Lax | Strict, Lax or None; None requires Secure=true |
| AUTH_REFRESH_LIFETIME | 30d | Absolute refresh-family lifetime, positive and no longer than 90 days |

Keep database passwords and JWT_SECRET private. All VITE_ variables are browser-visible. The application's local use does not require running your IDE/backend as a Windows administrator.

### Optional: load your own ignored backend/.env

If you already keep the documented KEY=value settings in backend/.env, this non-executing parser can load the supported backend keys. Run it from the repository root instead of the environment-setting example above. It does not support shell expressions, export syntax, interpolation, or inline comments, and it never executes file contents:

```powershell
$hooprAllowedKeys = @(
  'DB_URL', 'DB_USERNAME', 'DB_PASSWORD', 'JWT_SECRET', 'JWT_ISSUER',
  'SERVER_PORT', 'FRONTEND_ORIGINS', 'AUTH_COOKIE_SECURE',
  'AUTH_COOKIE_SAME_SITE', 'AUTH_REFRESH_LIFETIME'
)
Get-Content -LiteralPath 'backend/.env' | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') {
    $hooprConfigKey = $matches[1]
    $hooprConfigValue = $matches[2].Trim()
    if ($hooprConfigValue.Length -ge 2 -and (
      ($hooprConfigValue.StartsWith('"') -and $hooprConfigValue.EndsWith('"')) -or
      ($hooprConfigValue.StartsWith("'") -and $hooprConfigValue.EndsWith("'"))
    )) { $hooprConfigValue = $hooprConfigValue.Substring(1, $hooprConfigValue.Length - 2) }
    if ($hooprAllowedKeys -contains $hooprConfigKey) {
      [Environment]::SetEnvironmentVariable($hooprConfigKey, $hooprConfigValue, 'Process')
    }
  }
}
# Then build/run from backend/ as above.
```

Do not dot-source .env as PowerShell code. Use either the parser, explicit variables, or your IDE's environment configuration. Blank DB_PASSWORD/JWT_SECRET entries still need real private values.

## 7. Run the frontend in a second terminal

```powershell
Set-Location 'C:\Users\VIshal Java\Downloads\hoopr\frontend'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
npm.cmd ci
npm.cmd run dev
```

The supported frontend settings in frontend/.env are:

```dotenv
VITE_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:8080
```

Open http://localhost:5173. Vite reads its own .env and proxies /api requests to the backend; restart Vite after changing these values. React, Vite and TypeScript are local npm dependencies. npm ci installs them without a separate global installation. Strict port 5173 means Vite fails rather than silently choosing a different port when occupied.

Current pages:

| Route | Access/purpose |
| --- | --- |
| / | Public home |
| /register, /login | Public account forms |
| /profile | Authenticated profile and travel preference |
| /rides | Public search and filters |
| /rides/:id | Safe public ride details; legacy draft/in-progress details are owner-only |
| /rides/new | Authenticated offer form |
| /rides/mine | Authenticated owner history |
| /rides/:id/edit | Authenticated owner edit form |
| /bookings/mine | Authenticated passenger booking history |
| /bookings/:id | Passenger or ride owner booking details |
| /rides/:id/bookings | Owner passenger manifest |

## 8. Health and first manual check

In another terminal:

```powershell
Invoke-RestMethod 'http://localhost:8080/api/v1/health'
Invoke-RestMethod 'http://localhost:8080/actuator/health'
```

Both should return status UP and HTTP 200. Actuator includes database health without internal details. Register a fresh account, log in, offer a future ride, find it through search and edit it. As a second passenger, review/book seats and cancel a booking; as driver, inspect passenger bookings and cancel the ride. See [Phase 4's testing guide](docs/phase-4-bookings.md). No new environment variables are required for bookings.

The travel preference is informational. All new accounts have USER security role; preference does not assign ADMIN or restrict offering a ride. Log in with the password you registered. Registration requires 12 characters minimum and at most 72 UTF-8 password bytes. Access JWTs last 15 minutes and stay in frontend memory. Refresh cookies restore sessions after reload.

For authentication POST requests in API clients, fetch /api/v1/auth/csrf first, then send its matching cookie/header plus a trusted Origin. Ride mutations use Bearer access tokens. The collections automate these details.

## 9. Build and automated tests

Frontend, from frontend/:

```powershell
npm.cmd test
npm.cmd run build
```

Backend without PostgreSQL integration tests, from backend/:

```powershell
mvn -B '-Dmaven.repo.local=../.maven-repository' verify
```

Backend with all PostgreSQL integration tests, from backend/:

```powershell
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/hoopr_test'
$env:TEST_DB_USERNAME = 'hoopr'
$hooprTestCredential = Get-Credential -UserName hoopr -Message 'Hoopr test database password'
$env:TEST_DB_PASSWORD = $hooprTestCredential.GetNetworkCredential().Password
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=*Test,*IT' verify
```

All three TEST_DB_ variables are passed through the process environment; a backend .env containing them is not auto-loaded. TEST_DB_HOST/PORT/NAME are not read directly by the Java tests: construct TEST_DB_URL as shown. TEST_DB_ADMIN_USERNAME/PASSWORD, if kept privately for one-time provisioning, are not application settings and are not needed to run tests.

To create tables in a fresh hoopr_test without starting the application, run its migration check after setting test credentials:

```powershell
mvn -B '-Dmaven.repo.local=../.maven-repository' '-Dtest=DatabaseMigrationIT' test
```

That test invokes Flyway and rolls back its own sample row. Other integration tests create UUID-scoped fixtures and remove only those fixtures; they never clean/drop the database. Avoid running multiple integration-test processes concurrently or using hoopr_test for unrelated data while a suite runs.

Phase 4 checks on 4 November 2026: **73 backend tests**, **36 frontend tests**, executable packaging, TypeScript checking and frontend build passed. HTTP collections passed: Phase 4 **26 requests / 42 assertions**, Phase 3 **18 / 30**, Phase 2 **23 / 50**. See [the results and limitations](docs/phase-4-bookings.md). JDK 25 compiled release 21; actual JDK 21 runtime and a fresh Phase 4 interactive browser walkthrough remain unverified because the browser bridge was unavailable.

## 10. Postman / Thunder Client

Import these files:

- docs/api/Hoopr-Local.postman_environment.json
- docs/api/Hoopr-Phase-2.postman_collection.json
- docs/api/Hoopr-Phase-3.postman_collection.json

Select the local environment; serverUrl is http://localhost:8080 without /api/v1, frontendOrigin is http://localhost:5173, and expectedCookieSecure=false for local HTTP. Run a collection once in its numbered order. Collections create throwaway users and, in Phase 3, a ride that is cancelled at the end; that manual test history remains.

The collections manage explicit cookies and token variables. Do not mix their explicit cookies with another automatic cookie jar. Clear populated secrets before sharing client exports. Thunder Client imports request definitions, but Postman pm.* scripts need conversion/manual capture; see [API instructions](docs/api/README.md).

Optional dependency-free terminal collection run, from the repository root with the backend running:

```powershell
node docs/api/run-collection.mjs http://localhost:8080 docs/api/Hoopr-Phase-3.postman_collection.json
```

## 11. Verify database tables and migrations

```powershell
psql -h localhost -p 5432 -U hoopr -d hoopr -W -c '\dt'
psql -h localhost -p 5432 -U hoopr -d hoopr -W -c 'SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;'
psql -h localhost -p 5432 -U hoopr -d hoopr_test -W -c '\dt'
psql -h localhost -p 5432 -U hoopr -d hoopr_test -W -c 'SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;'
```

After startup, Flyway versions 1–8 should be successful. Application tables are users, user_profiles, driver_profiles, vehicles, rides, bookings, booking_payments, refresh_sessions and refresh_tokens, plus flyway_schema_history. See the [payment setup guide](docs/phase-10-razorpay.md) to select Stripe or Razorpay test checkout.

## 12. Running packaged output

Backend, with the same backend environment configured, from backend/:

```powershell
java -jar target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar
```

Use the **-exec.jar**, not the thin JAR. frontend/dist is the production frontend build. Production hosting needs frontend route fallback to index.html and an /api reverse proxy to the backend. npm run preview only previews build output; it is not production hosting and does not inherit the development server's API proxy setup.

For production, use HTTPS, AUTH_COOKIE_SECURE=true, exact production FRONTEND_ORIGINS, privately managed secrets and appropriate database roles. A deployment can use a separate migration role rather than granting its runtime role DDL; the current local examples intentionally use one database owner for Flyway and runtime access. Cross-site SameSite=None requires Secure=true and may encounter browser third-party-cookie restrictions.

## 13. Troubleshooting and stopping

| Symptom | Action |
| --- | --- |
| java/javac/mvn not found | Fix JDK/Maven installation and PATH; reopen terminal; compare mvn -version Java home |
| npm not found / npm.ps1 blocked | Install Node with npm, reopen terminal, use npm.cmd |
| psql not found | Add PostgreSQL bin to PATH or use the explicit installed executable path |
| Database role cannot create hoopr_test | Run the CREATE DATABASE command as a PostgreSQL administrator; Windows elevation alone does not grant database permissions |
| Password authentication failed | Use the password for the selected role; check the correct server/port; keep administrator and hoopr credentials distinct |
| Missing DB_USERNAME/JWT_SECRET at startup | Configure the backend process environment; copying .env alone is not enough |
| Invalid JWT_SECRET | Use base64 encoding of at least 32 random bytes; do not use an example password as the signing key |
| Port 8080 or 5173 occupied | Stop the known old server in its terminal with Ctrl+C, or change port/origin/proxy settings consistently |
| Health 200 but ride APIs unavailable | Restart the updated backend; a build does not update an already-running old process |
| Auth POST 403 | Check trusted Origin, matching CSRF cookie/header and local cookie security setting |
| Ride update/cancel 409 | Reload and use the latest version; only future scheduled owner rides without reserved seats can currently change |
| Migration checksum mismatch | Restore the applied file from source control and investigate; do not repair checksums or reset tables blindly |
| More-than-six-seat historical ride blocks V4 | Review the incompatible data explicitly; migration intentionally preserves history rather than truncating it |
| JAR locked during packaging | Stop the known process using that artifact; the executable is attached with classifier exec |
| Installed JDK 25: Unable to establish loopback connection | Prefer intended JDK 21, or use the documented temporary-socket workaround below |

For the workspace-specific JDK 25 Windows socket problem, this was successful from the repository root, with backend environment already configured:

```powershell
java '-Djdk.net.unixdomain.tmpdir=backend/target' -jar backend/target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar
```

This flag is a local workaround, not a required application setting. Keep the referenced directory writable. If you use it from backend/, the directory value would be target instead.

Stop each foreground server with Ctrl+C in its own terminal. Closing a terminal clears process-only environment variables. To resume tomorrow, reload your private backend environment, start Maven/the executable, and run npm.cmd run dev in the frontend terminal. Do not regenerate the signing key unnecessarily.

For phase status and copyable implementation/resume prompts, see [PHASE_SETUP.md](PHASE_SETUP.md). Detailed implementation notes remain in [Phase 2](docs/phase-2-authentication.md) and [Phase 3](docs/phase-3-rides.md).
