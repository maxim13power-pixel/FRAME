<#
.SYNOPSIS
  Перенос базы FRAME: Railway PostgreSQL → Amvera PostgreSQL (№209).

.DESCRIPTION
  1) снимает счётчики ключевых таблиц на источнике (Railway),
  2) делает pg_dump (по умолчанию plain SQL),
  3) восстанавливает дамп в целевой кластер Amvera,
  4) сверяет счётчики,
  5) по флагу -RunMigrations применяет `npx prisma migrate deploy`.

  Почему plain SQL по умолчанию: локальный клиент PostgreSQL 18 добавляет в дамп
  `SET transaction_timeout = 0;`, которого нет в PostgreSQL <= 16, и pg_restore
  на таком сервере падает. Plain-дамп чистится от этой строки и заливается через psql
  (клиент 18 совместим с серверами 15–18).

  Пароли в URL с символами @ : / должны быть url-encoded (%40, %3A, %2F).

.EXAMPLE
  .\scripts\db-migrate-railway-to-amvera.ps1 `
    -RailwayUrl 'postgresql://postgres:PASS@containers-us-west-1.railway.app:7777/railway' `
    -AmveraUrl 'postgresql://frame_user:PASS@frame-pg-user.db-msk0.amvera.tech:5432/frame_db?sslmode=prefer'

.EXAMPLE
  # дамп уже снят ранее — только restore, сверка и миграции
  .\scripts\db-migrate-railway-to-amvera.ps1 -AmveraUrl $a -SkipDump -RunMigrations
#>
param(
  [string]$RailwayUrl,
  [Parameter(Mandatory = $true)][string]$AmveraUrl,

  [string]$DumpPath = (Join-Path $env:TEMP 'frame_railway.sql'),
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',

  [ValidateSet('plain', 'custom')]
  [string]$Format = 'plain',

  [switch]$SkipDump,
  [switch]$SkipRestore,
  [switch]$SkipCounts,
  [switch]$RunMigrations
)

$ErrorActionPreference = 'Stop'

$pgDump    = Join-Path $PgBin 'pg_dump.exe'
$pgRestore = Join-Path $PgBin 'pg_restore.exe'
$psql      = Join-Path $PgBin 'psql.exe'
foreach ($tool in @($pgDump, $pgRestore, $psql)) {
  if (-not (Test-Path $tool)) { throw "Не найден $tool — укажите -PgBin с путём до bin PostgreSQL" }
}

# Ключевые таблицы для сверки «до/после»
$countsSql = @'
select 'User' as table_name, count(*) from "User"
union all select 'Object', count(*) from "Object"
union all select 'Project', count(*) from "Project"
union all select 'object_access', count(*) from object_access
union all select 'access_snapshots', count(*) from access_snapshots
union all select 'import_batches', count(*) from import_batches
union all select 'materials', count(*) from materials
union all select 'price_catalogs', count(*) from price_catalogs
union all select 'price_items', count(*) from price_items
union all select 'estimate_templates', count(*) from estimate_templates
union all select 'audit_logs', count(*) from audit_logs
union all select 'warehouse_items', count(*) from warehouse_items
union all select 'reports', count(*) from reports
union all select '_prisma_migrations', count(*) from _prisma_migrations
order by 1;
'@

# psql берёт SQL из файла: PowerShell 5.1 ломает двойные кавычки при передаче через -c
$countsFile = Join-Path $env:TEMP 'frame-table-counts.sql'
[System.IO.File]::WriteAllText($countsFile, $countsSql, (New-Object System.Text.UTF8Encoding($false)))


function Get-Counts {
  param([string]$Url, [string]$Label)

  Write-Host "`n== $Label ==" -ForegroundColor Cyan
  $rows = & $psql $Url -At -F '|' -f $countsFile 2>&1
  $code = $LASTEXITCODE
  $rows | ForEach-Object { Write-Host "  $_" }
  if ($code -ne 0) { throw "psql не смог прочитать $Label (код $code)" }
}

# 1. Счётчики на источнике
if (-not $SkipCounts) {
  if (-not $RailwayUrl) { throw 'Нужен -RailwayUrl (или запускайте со -SkipCounts)' }
  Get-Counts -Url $RailwayUrl -Label 'Источник: Railway'
}

# 2. Дамп
# при -SkipDump берём уже очищенный дамп, если он есть рядом
$cleanDump = [System.IO.Path]::ChangeExtension($DumpPath, '.clean.sql')
if (-not (Test-Path $cleanDump)) { $cleanDump = $DumpPath }
if (-not $SkipDump) {
  if (-not $RailwayUrl) { throw 'Нужен -RailwayUrl (или запускайте со -SkipDump)' }

  Remove-Item -LiteralPath $DumpPath -ErrorAction SilentlyContinue
  Write-Host "`n== pg_dump ($Format) → $DumpPath ==" -ForegroundColor Cyan

  if ($Format -eq 'custom') {
    & $pgDump $RailwayUrl --no-owner --no-privileges --format=custom --file=$DumpPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump упал с кодом $LASTEXITCODE" }
  } else {
    & $pgDump $RailwayUrl --no-owner --no-privileges --format=plain --file=$DumpPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump упал с кодом $LASTEXITCODE" }

    # Чистим SET-ы, которых нет в PostgreSQL <= 16 (иначе restore упадёт)
    $cleanDump = [System.IO.Path]::ChangeExtension($DumpPath, '.clean.sql')
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $kept = New-Object System.Collections.Generic.List[string]
    $dropped = 0
    foreach ($line in [System.IO.File]::ReadLines($DumpPath)) {
      if ($line -match '^SET (transaction_timeout|idle_session_timeout)') { $dropped++; continue }
      $kept.Add($line) | Out-Null
    }
    [System.IO.File]::WriteAllLines($cleanDump, $kept, $utf8)
    Write-Host "вырезано несовместимых SET-ов: $dropped → $cleanDump" -ForegroundColor DarkGray
  }

  $sizeMb = [Math]::Round((Get-Item $DumpPath).Length / 1MB, 2)
  Write-Host "дамп готов: $DumpPath ($sizeMb МБ)" -ForegroundColor Green
}

# 3. Restore
if (-not $SkipRestore) {
  Write-Host "`n== restore → Amvera ==" -ForegroundColor Cyan
  if ($Format -eq 'custom') {
    & $pgRestore --no-owner --no-privileges --dbname=$AmveraUrl $DumpPath
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'pg_restore вернул ошибку. Если это "unrecognized configuration parameter transaction_timeout" —' -ForegroundColor Yellow
      Write-Host 'перезапустите скрипт с -Format plain (целевой сервер старее клиента 18).' -ForegroundColor Yellow
      throw "pg_restore код $LASTEXITCODE"
    }
  } else {
    if (-not (Test-Path $cleanDump)) { throw "Нет файла дампа $cleanDump (сначала без -SkipDump)" }
    # -q не глушит SELECT setval() из дампа, поэтому вывод гасим в Out-Null (код возврата сохраняется)
    & $psql $AmveraUrl -v ON_ERROR_STOP=1 -q -f $cleanDump | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "psql при заливке вернул код $LASTEXITCODE — проверьте, что целевая БД пустая"
    }
  }
  Write-Host 'данные залиты' -ForegroundColor Green
}

# 4. Сверка
if (-not $SkipCounts) { Get-Counts -Url $AmveraUrl -Label 'Цель: Amvera' }

# 5. Миграции
Write-Host "`n== Миграции ==" -ForegroundColor Cyan
Write-Host 'Ожидаемо: 17 применённых + 4 ожидающих (access_snapshots, import_batches,'
Write-Host 'owner_general_entities, can_create_projects) → после deploy 21.'

if ($RunMigrations) {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  Push-Location (Join-Path $repoRoot 'backend')
  try {
    $env:DATABASE_URL = $AmveraUrl
    & npx prisma migrate status
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate status упал — проверьте DATABASE_URL' }
    & npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy упал' }
    & npx prisma migrate status
  } finally {
    Pop-Location
  }
} else {
  Write-Host 'Дальше вручную:' -ForegroundColor Yellow
  Write-Host '  cd backend' -ForegroundColor Yellow
  Write-Host "  `$env:DATABASE_URL='<внешний URL Amvera>'" -ForegroundColor Yellow
  Write-Host '  npx prisma migrate status' -ForegroundColor Yellow
  Write-Host '  npx prisma migrate deploy' -ForegroundColor Yellow
}

