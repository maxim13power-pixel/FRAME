<#
.SYNOPSIS
  Деплой FRAME на Amvera (№209, вариант B: два отдельных проекта Amvera).

.DESCRIPTION
  Amvera ищет amvera.yaml только в КОРНЕ репозитория, поэтому монорепозиторий
  деплоится как два независимых репозитория через git subtree:
    backend/  → проект Amvera «backend»  (remote amvera-be)
    frontend/ → проект Amvera «frontend» (remote amvera-fe)

  Первый раз remotes нужно добавить (адреса — на странице «Репозиторий» проекта):
    git remote add amvera-be https://git.amvera.ru/<login>/<be-slug>
    git remote add amvera-fe https://git.amvera.ru/<login>/<fe-slug>

.EXAMPLE
  .\scripts\deploy-amvera.ps1            # оба приложения
  .\scripts\deploy-amvera.ps1 -App be    # только бэкенд
#>
param(
  [ValidateSet('all', 'be', 'fe')]
  [string]$App = 'all',

  [string]$Branch = 'main',
  [string]$RemoteBe = 'amvera-be',
  [string]$RemoteFe = 'amvera-fe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "FRAME → Amvera, деплой: $App" -ForegroundColor Cyan
Write-Host "Репозиторий: $repoRoot (ветка $Branch)"

# 1. Amvera собирает только закоммиченное состояние
$dirty = git status --porcelain
if ($dirty) {
  Write-Warning 'В рабочем дереве есть незакоммиченные изменения — на Amvera уйдёт только закоммиченное:'
  $dirty | ForEach-Object { Write-Host "  $_" }
}

# 2. Проверяем remotes
$remotes = git remote
foreach ($r in @($RemoteBe, $RemoteFe)) {
  if ($remotes -notcontains $r) {
    Write-Warning "Remote '$r' не настроен. Добавьте: git remote add $r https://git.amvera.ru/<login>/<slug>"
  }
}

function Invoke-SubtreePush {
  param([string]$Prefix, [string]$Remote, [string]$Label)

  if ((git remote) -notcontains $Remote) {
    Write-Host "ПРОПУСК $Label — нет remote '$Remote'" -ForegroundColor Yellow
    return $false
  }

  Write-Host "→ ${Label}: git subtree push --prefix $Prefix $Remote ${Branch}:master" -ForegroundColor Green
  git subtree push --prefix $Prefix $Remote "${Branch}:master"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА $Label (код $LASTEXITCODE). Частая причина — расхождение истории:" -ForegroundColor Red
    Write-Host "  git subtree split --prefix $Prefix -b tmp-$Label ; git push $Remote tmp-$Label`:master ; git branch -D tmp-$Label" -ForegroundColor DarkYellow
    return $false
  }
  return $true
}

$ok = $true

if ($App -in @('all', 'be')) {
  if (-not (Invoke-SubtreePush -Prefix 'backend' -Remote $RemoteBe -Label 'backend')) { $ok = $false }
}

if ($App -in @('all', 'fe')) {
  if (-not (Invoke-SubtreePush -Prefix 'frontend' -Remote $RemoteFe -Label 'frontend')) { $ok = $false }
}

if ($ok) {
  Write-Host 'Готово. Сборка запустится автоматически — смотрите «Лог сборки» / «Лог приложения» в панели Amvera.' -ForegroundColor Cyan
  Write-Host 'Проверка: https://<be>.amvera.io/health → {"status":"ok"}'
} else {
  Write-Host 'Деплой завершился с ошибками — см. сообщения выше.' -ForegroundColor Red
  exit 1
}
