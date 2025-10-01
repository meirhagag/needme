param(
  [ValidateSet("dev","build","start","studio")]
  [string]$Mode = "dev"
)

function Ensure-Env {
  if (-not (Test-Path ".env")) { Write-Host "??  ??? ???? .env" -ForegroundColor Yellow }
  if (-not (Test-Path "package.json")) { throw "package.json ?? ????. ??? ??????? ???????" }
}

function Ensure-Install {
  if (-not (Test-Path "node_modules")) {
    Write-Host "?? npm install..." -ForegroundColor Cyan
    npm install | Out-Host
  }
}

function Prisma-Sync {
  Write-Host "?? Prisma generate..." -ForegroundColor Cyan
  npx prisma generate | Out-Host
  Write-Host "???  Prisma db push..." -ForegroundColor Cyan
  npx prisma db push | Out-Host
}

Ensure-Env
Ensure-Install
Prisma-Sync

switch ($Mode) {
  "dev" {
    Write-Host "??  Running: npm run dev" -ForegroundColor Green
    npm run dev
  }
  "build" {
    Write-Host "???  Building production..." -ForegroundColor Green
    npm run build
    Write-Host "? Build done. ?????? ???????: npm run start -p 3000" -ForegroundColor Green
  }
  "start" {
    Write-Host "?? Starting production on port 3000..." -ForegroundColor Green
    npm run start -- -p 3000
  }
  "studio" {
    Write-Host "?? Opening Prisma Studio (http://localhost:5555)..." -ForegroundColor Green
    npx prisma studio
  }
}
