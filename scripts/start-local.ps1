$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$root = (Get-Location).Path
$local = "$root\.local"
$pg = "$root\.tools\pgsql\bin"
New-Item -ItemType Directory -Force $local | Out-Null
if (-not (Test-Path "$local\config.json")) {
  @{Password=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32));Jwt=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))} | ConvertTo-Json | Set-Content "$local\config.json"
}
$config = Get-Content "$local\config.json" -Raw | ConvertFrom-Json
if (-not (Test-Path "$local\postgres\PG_VERSION")) {
  try {
    [IO.File]::WriteAllText("$local\password.tmp", $config.Password)
    & "$pg\initdb.exe" -D "$local\postgres" -U hoopr "--pwfile=$local\password.tmp" --auth=scram-sha-256 --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
  } finally { Remove-Item -LiteralPath "$local\password.tmp" -ErrorAction SilentlyContinue }
}
& "$pg\pg_ctl.exe" -D "$local\postgres" status
if ($LASTEXITCODE -ne 0) {
  & "$pg\pg_ctl.exe" -D "$local\postgres" -l "$local\postgres.log" -o '-h 127.0.0.1 -p 5432' -w start
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start' }
}
$env:PGPASSWORD=$config.Password
foreach ($db in @('hoopr','hoopr_test')) {
  $exists = & "$pg\psql.exe" -h 127.0.0.1 -U hoopr -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
  if ($exists -ne '1') { & "$pg\createdb.exe" -h 127.0.0.1 -U hoopr $db }
}
Remove-Item Env:PGPASSWORD
$env:DB_URL='jdbc:postgresql://127.0.0.1:5432/hoopr'
$env:SERVER_PORT='8081'
$env:API_PROXY_TARGET='http://127.0.0.1:8081'
$env:DB_USERNAME='hoopr'
$env:DB_PASSWORD=$config.Password
$env:JWT_SECRET=$config.Jwt
$env:AUTH_COOKIE_SECURE='false'
$env:FRONTEND_ORIGINS='http://localhost:5173'
if (-not (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)) {
  $p = Start-Process 'C:\Program Files\Java\jdk-21\bin\java.exe' -ArgumentList '-jar','backend/target/hoopr-backend-0.1.0-SNAPSHOT-exec.jar' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$local\backend.log" -RedirectStandardError "$local\backend-error.log" -PassThru
  $p.Id | Set-Content "$local\backend.pid"
}
if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
  $p = Start-Process (Get-Command node.exe).Source -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory "$root\frontend" -WindowStyle Hidden -RedirectStandardOutput "$local\frontend.log" -RedirectStandardError "$local\frontend-error.log" -PassThru
  $p.Id | Set-Content "$local\frontend.pid"
}
Write-Host 'Frontend: http://localhost:5173 | Backend: http://localhost:8081'

