# Analytics Dashboard - Windows Setup & Run Script
# Run in PowerShell: .\setup-and-run.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "`n=== Analytics Dashboard Setup ===" -ForegroundColor Cyan

# Fix SSL certificate issues on some Windows networks
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

Set-Location $ProjectRoot

# 1. Install dependencies
Write-Host "`n[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install --no-fund --no-audit --strict-ssl=false --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed!" -ForegroundColor Red; exit 1 }
Write-Host "Dependencies installed." -ForegroundColor Green

# 2. Check PostgreSQL
Write-Host "`n[2/5] Checking PostgreSQL on port 5432..." -ForegroundColor Yellow
$pgRunning = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue

if (-not $pgRunning) {
    Write-Host "PostgreSQL not detected on port 5432." -ForegroundColor Red
    Write-Host @"

OPTIONS:
  A) Install Docker Desktop, then run:  npm run db:up
  B) Install PostgreSQL 16:  winget install -e --id PostgreSQL.PostgreSQL.16 --source winget
     Then create database 'analytics_db' and update backend\.env DATABASE_URL

"@ -ForegroundColor Yellow

    $choice = Read-Host "Try winget install PostgreSQL now? (y/n)"
    if ($choice -eq "y") {
        winget install -e --id PostgreSQL.PostgreSQL.16 --source winget --accept-package-agreements --accept-source-agreements
        Write-Host "After install, create DB and update backend\.env, then re-run this script." -ForegroundColor Yellow
        exit 1
    } else {
        exit 1
    }
}
Write-Host "PostgreSQL is running." -ForegroundColor Green

# 3. Migrate database
Write-Host "`n[3/5] Running database migration..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\backend"
npm run migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration failed! Check DATABASE_URL in backend\.env" -ForegroundColor Red
    Write-Host "Default: postgresql://analytics:analytics_secret@localhost:5432/analytics_db" -ForegroundColor Yellow
    exit 1
}

# 4. Seed demo data
Write-Host "`n[4/5] Seeding demo data..." -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -ne 0) { Write-Host "Seed failed!" -ForegroundColor Red; exit 1 }

# 5. Start dev servers
Write-Host "`n[5/5] Starting application..." -ForegroundColor Yellow
Set-Location $ProjectRoot
Write-Host @"

  Frontend:  http://localhost:5173
  Backend:   http://localhost:3001

  Login:     admin@acme.com / password123

"@ -ForegroundColor Cyan

npm run dev
