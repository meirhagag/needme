# NeedMe – Runbook helper (Windows PowerShell)
# שים קובץ זה בתיקיית הפרויקט והרץ:  .\needme_runbook.ps1  (או קליק ימני → Run with PowerShell)

Write-Host "== NeedMe – Runbook ==" -ForegroundColor Cyan

function Ensure-Env {
  $envPath = Join-Path (Get-Location) ".env"
  if (-not (Test-Path $envPath)) {
    Write-Host "יוצר קובץ .env ראשוני..." -ForegroundColor Yellow
    @"
RESEND_API_KEY=re_XXXXXXXXXXXX
MAIL_FROM="NeedMe <onboarding@resend.dev>"
DATABASE_URL="file:./dev.db"
"@ | Set-Content -Encoding UTF8 $envPath
    Write-Host "נוצר .env – עדכן ערכים לפני המשך." -ForegroundColor Green
  } else {
    Write-Host ".env כבר קיים." -ForegroundColor Green
  }
}

function Install-And-Prisma {
  Write-Host "npm install ..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

  Write-Host "npx prisma generate ..." -ForegroundColor Cyan
  npx prisma generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }

  Write-Host "npx prisma db push ..." -ForegroundColor Cyan
  npx prisma db push
  if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }
}

function Run-Dev {
  Write-Host "Starting dev server (Ctrl+C לעצירה)..." -ForegroundColor Cyan
  npm run dev
}

function Build-Prod {
  Write-Host "Cleaning .next ..." -ForegroundColor Cyan
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  Write-Host "next build ..." -ForegroundColor Cyan
  npm run build
}

function Start-Prod3000 {
  Write-Host "next start -p 3000 ..." -ForegroundColor Cyan
  npm run start -- -p 3000
}

function Seed-Providers {
  $csv = @"
orgName,email,categories,tags,regions,minBudget,maxBudget,active
חשמלאי מומלץ,elec@example.com,service,חשמל|דחוף,מרכז|שפלה,,5000,true
ברוקר נדל""ן,broker@example.com,real_estate,office|rent,מרכז|ת""א,3000,,true
"@
  $path = ".\providers_sample.csv"
  $csv | Set-Content -Encoding UTF8 $path
  Write-Host "מעלה providers_sample.csv ..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "http://localhost:3000/api/providers/import" -Method POST -ContentType "text/csv" -Body (Get-Content $path -Raw) | % Content
}

function Create-Request {
  $Body = @{
    title="טכנאי מזגנים"; category="service"; subcategory="AC";
    budgetMin=""; budgetMax="1500"; region="מרכז"; contactWindow="today";
    requesterName="מאיר"; requesterEmail="hgmeir@gmail.com"; requesterPhone="0501234567";
    live="1"
  }
  Write-Host "יוצר בקשה לדוגמה..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "http://localhost:3000/api/requests" -Method POST -Body $Body -ContentType "application/x-www-form-urlencoded" | % Content
}

Write-Host "`nתפריט:" -ForegroundColor Yellow
Write-Host "1) Ensure .env" 
Write-Host "2) Install & Prisma (install/generate/db push)"
Write-Host "3) Run Dev"
Write-Host "4) Build (production)"
Write-Host "5) Start production on :3000"
Write-Host "6) Seed Providers (CSV)"
Write-Host "7) Create Request (form-urlencoded)"
Write-Host "0) Exit`n"

$choice = Read-Host "בחר פעולה"
switch ($choice) {
  "1" { Ensure-Env }
  "2" { Install-And-Prisma }
  "3" { Run-Dev }
  "4" { Build-Prod }
  "5" { Start-Prod3000 }
  "6" { Seed-Providers }
  "7" { Create-Request }
  default { Write-Host "Bye." }
}
