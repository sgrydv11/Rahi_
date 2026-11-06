# app_v1 verification

Verified 6 November 2026. app_v1 keeps backend/, frontend/, and mobile/ together and includes both origin/codex/backend and origin/app-fe histories.

| Check | Result |
| --- | --- |
| Backend unit/MVC tests | 58 passed |
| PostgreSQL integration tests, including seed | 52 passed |
| Web frontend tests | 52 passed across 9 files |
| Native API contract tests | 10 passed |
| Backend executable packaging | Passed |
| Web TypeScript checking and production build | Passed |
| Post-fix primary HTTP checks | 83 passed |
| Normal-load reads through 256 concurrency | 1,408 returned HTTP 200 |
| Browser legacy-date rendering and cross-tab session reloads | Passed |

The complete Maven verify run executed 110 tests with zero failures, errors or skips. PostgreSQL tests used the dedicated hoopr_test database with currentSchema=fixes_regression, isolated from the development hoopr database and earlier audit fixtures. All 14 migrations validated successfully.

See [breakpoint-fixes.md](breakpoint-fixes.md) for the eight fixes, red/green regression evidence, lock-contention before/after measurements, configuration and limitations.

## Reproduce backend checks

From repository root in PowerShell 7 with PostgreSQL running and an existing dedicated test schema:

```powershell
$config = Get-Content .local/config.json -Raw | ConvertFrom-Json
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:5432/hoopr_test?currentSchema=fixes_regression'
$env:TEST_DB_USERNAME = 'hoopr'
$env:TEST_DB_PASSWORD = $config.Password
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:MAVEN_OPTS = '-Xmx256m'
./.tools/apache-maven-3.9.10/bin/mvn.cmd -B '-Dmaven.repo.local=.maven-repository' '-DargLine=-Xmx384m' '-Dtest=*Test,*IT' -f backend/pom.xml verify
```

Use your own dedicated test credentials if not using start-local.ps1. Never run the integration suites against hoopr. A fresh installation can use the default empty public schema of hoopr_test by omitting currentSchema.

From frontend/, run npm.cmd test -- --maxWorkers=1 and npm.cmd run build. From mobile/, run npm.cmd test.

Native dependency installation was previously interrupted due to memory pressure. Native TypeScript checking, Expo bundling, emulator/device tests and signed builds remain unverified. Payment gateways are mocked in the integration suites; no real provider checkout was performed.
