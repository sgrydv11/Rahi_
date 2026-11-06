# app_v1 verification

Verified on 6 November 2026 using JDK 21.0.7, Maven 3.9.10, PostgreSQL 15.13 and Node 22.23.2.

`app_v1` contains both `origin/codex/backend` and `origin/app-fe`; Git ancestry checks passed for both. Backend, frontend, and mobile remain together in this branch.

| Check | Result |
| --- | --- |
| Backend unit and MVC tests | 54 passed |
| Existing PostgreSQL integration tests | 47 passed |
| New demo seed integration test | 1 passed |
| Web frontend tests | 47 passed across 9 files |
| Native API contract tests | 10 passed |
| Backend executable packaging | Passed |
| Web TypeScript checking and production build | Passed |
| Live frontend/API proxy and datasource health | Passed |

The baseline Maven verify run executed 101 tests with no failures, errors or skips. After adding DemoSeedIT, its targeted run compiled all 14 test source files and passed the additional test. Total coverage executed: 54 backend unit tests and 48 database integration tests. The database integration suites use only hoopr_test, which migrated successfully through V14.

Integration coverage includes authentication/session rotation, booking concurrency and idempotency, cancellation, payment-provider contracts, wallet operations, group holds, discount flows, ride lifecycle, ownership, vehicle privacy, route pins, filters and migration constraints. External payment gateways are mocked in the integration suite; no real provider checkout was performed.

DemoSeedIT runs the actual SQL seed inside a rollback-only transaction. It checks 100 demo users, 30 vehicles, 180 future rides, 360 bookings, six route directions, valid demo password hashes, no driver self-booking, and seat inventory consistency. It cancels a booking and reruns the seed to verify the cancellation and released seat remain intact. Its generated records are rolled back.

Live checks through http://127.0.0.1:5173/api/v1 passed for all six demo route searches, demo001 driver login and six offered rides, and demo031 passenger login and six bookings. Datasource health returned UP. The applied development demo records remain available.

## Reproduce

From the repository root in PowerShell 7, with the local database started:

```powershell
$config = Get-Content .local/config.json -Raw | ConvertFrom-Json
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:5432/hoopr_test'
$env:TEST_DB_USERNAME = 'hoopr'
$env:TEST_DB_PASSWORD = $config.Password
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:MAVEN_OPTS = '-Xmx256m'
./.tools/apache-maven-3.9.10/bin/mvn.cmd -B '-Dmaven.repo.local=.maven-repository' '-DargLine=-Xmx384m' '-Dtest=*Test,*IT' -f backend/pom.xml verify
```

Use your own dedicated test database credentials if you did not use start-local.ps1. Never point integration tests at the development hoopr database.

From frontend/, run `npm.cmd test -- --maxWorkers=1` and `npm.cmd run build`. From mobile/, run `npm.cmd test`.

## Test-driven fixes and limits

The baseline application tests were green. The new seed regression test also passed; no application defect required an implementation fix, so no red/green TDD cycle is claimed. A sandbox dependency-access error during recompilation was resolved by running the same check outside the sandbox, without altering dependencies or application code.

Native dependency installation was previously interrupted due to severe system memory pressure. Native TypeScript checking, Expo bundles, emulator/device tests, and signed platform builds remain unverified. The native contract test results above do not imply those checks passed.
