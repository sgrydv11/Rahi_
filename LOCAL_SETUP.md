# Local Windows setup

The current integration branch contains origin/codex/backend and origin/app-fe.

Local tools are installed under `.tools/` (Maven 3.9.10 and PostgreSQL 15.13).
Use the installed JDK at `C:\Program Files\Java\jdk-21`.
Node 22.23.2 satisfies the installed web tooling requirements; the repository baseline is Node 24.

Start the database, backend and web frontend from PowerShell 7:

```powershell
./scripts/start-local.ps1
```

Open http://localhost:5173. Backend health: http://localhost:8081/actuator/health.
Private generated database credentials, database files, process IDs and logs live in ignored `.local/`.
The script creates only its own local database cluster and the hoopr and hoopr_test databases.

Build backend:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
./.tools/apache-maven-3.9.10/bin/mvn.cmd -B '-Dmaven.repo.local=.maven-repository' -f backend/pom.xml verify
```

Build/test web: run `npm.cmd ci`, `npm.cmd run build`, and `npm.cmd test` in frontend/.
Native Android/iOS app setup is in mobile/README.md. Native builds need Android SDK or macOS/Xcode, plus a reachable HTTPS backend and payment provider test keys for checkout.

To stop only the app processes started by the script:

```powershell
Get-Content .local/backend.pid,.local/frontend.pid | ForEach-Object { Stop-Process -Id ([int]$_) -ErrorAction SilentlyContinue }
./.tools/pgsql/bin/pg_ctl.exe -D .local/postgres -w stop
```


Verified: 54 backend unit tests, 47 web tests, and 10 native contract tests passed. Backend and web builds passed; live database health and frontend API proxy returned UP, with 14 successful migrations. Port 8081 is used because 8080 is occupied. Native npm installation and the extra dedicated-database test were stopped due to severe system memory pressure; native typecheck and device build remain unverified. Retry npm ci in mobile/ after freeing memory.
