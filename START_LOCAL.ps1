#!/usr/bin/env pwsh
# TalentOS Local Development Startup Script
# Run this in PowerShell to start all services

Write-Host "================================" -ForegroundColor Cyan
Write-Host "TalentOS Local Development Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/5] Checking Docker installation..." -ForegroundColor Green
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Step 2: Check .env file
Write-Host "[2/5] Checking .env configuration..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    Write-Host "✓ Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env created with default values" -ForegroundColor Green
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}

# Step 3: Install dependencies
Write-Host "[3/5] Installing npm dependencies..." -ForegroundColor Green
npm.cmd install 2>&1 | Select-Object -Last 5
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Step 4: Start Docker Compose
Write-Host "[4/5] Starting Docker Compose services..." -ForegroundColor Green
Write-Host "       This may take 2-3 minutes on first run..." -ForegroundColor Yellow
docker-compose up -d

# Step 5: Wait for services
Write-Host "[5/5] Waiting for services to be healthy..." -ForegroundColor Green
$maxAttempts = 30
$attempt = 0
$allHealthy = $false

while ($attempt -lt $maxAttempts -and -not $allHealthy) {
    $attempt++
    Write-Host "   Checking services... (attempt $attempt/$maxAttempts)" -NoNewline
    
    $postgresHealth = docker exec talentos-postgres pg_isready -U talentos -d talentos 2>&1
    $keycloakStatus = docker ps --filter "name=talentos-keycloak" --filter "status=running" -q
    $minioHealth = docker exec talentos-minio mc ready local 2>&1
    
    if ($postgresHealth -match "accepting" -and $keycloakStatus -and $minioHealth -match "ready") {
        $allHealthy = $true
        Write-Host " ✓" -ForegroundColor Green
    } else {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 5
    }
}

Write-Host ""
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✓ TalentOS Stack Started!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 ACCESS THESE PORTALS IN CHROME:" -ForegroundColor Cyan
Write-Host ""
Write-Host "APPLICANT PORTAL:" -ForegroundColor Yellow
Write-Host "  Main:        http://lvh.me:3100" -ForegroundColor White
Write-Host "  Demo Tenant: http://demo.lvh.me:3100" -ForegroundColor White
Write-Host ""
Write-Host "ADMIN PORTAL:" -ForegroundColor Yellow
Write-Host "  Main:        http://lvh.me:3200" -ForegroundColor White
Write-Host "  Demo Tenant: http://demo.lvh.me:3200" -ForegroundColor White
Write-Host ""
Write-Host "KEYCLOAK (IAM):" -ForegroundColor Yellow
Write-Host "  Admin Console: http://keycloak.lvh.me:8080/admin" -ForegroundColor White
Write-Host "  Login: admin / admin" -ForegroundColor White
Write-Host ""
Write-Host "MinIO (File Storage):" -ForegroundColor Yellow
Write-Host "  Console: http://localhost:9001" -ForegroundColor White
Write-Host "  Login: talentos / talentos_dev_password" -ForegroundColor White
Write-Host ""

Write-Host "🔑 TEST USER ACCOUNTS (Demo Tenant):" -ForegroundColor Cyan
Write-Host ""
Write-Host "SUPER ADMIN:" -ForegroundColor Yellow
Write-Host "  Email:    superadmin@talentos.local" -ForegroundColor White
Write-Host "  Password: ChangeMeSuper#1" -ForegroundColor White
Write-Host "  Access:   http://lvh.me:3200 (main portal)" -ForegroundColor White
Write-Host ""
Write-Host "ORG ADMIN (Demo):" -ForegroundColor Yellow
Write-Host "  Email:    orgadmin@demo.talentos.local" -ForegroundColor White
Write-Host "  Password: ChangeMe123!" -ForegroundColor White
Write-Host "  Access:   http://demo.lvh.me:3200 (admin portal)" -ForegroundColor White
Write-Host ""
Write-Host "APPLICANT:" -ForegroundColor Yellow
Write-Host "  Email:    applicant@demo.talentos.local" -ForegroundColor White
Write-Host "  Password: ChangeMe123!" -ForegroundColor White
Write-Host "  Access:   http://demo.lvh.me:3100 (applicant portal)" -ForegroundColor White
Write-Host ""
Write-Host "ACCEPTED APPLICANT (with dashboard):" -ForegroundColor Yellow
Write-Host "  Email:    accepted@demo.talentos.local" -ForegroundColor White
Write-Host "  Password: ChangeMe123!" -ForegroundColor White
Write-Host "  Access:   http://demo.lvh.me:3100 (dashboard + missions)" -ForegroundColor White
Write-Host ""

Write-Host "📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open TESTING_GUIDE.md for detailed testing checklist" -ForegroundColor White
Write-Host "2. Open Google Chrome and bookmark the portals above" -ForegroundColor White
Write-Host "3. Start testing each portal with the credentials provided" -ForegroundColor White
Write-Host "4. Monitor logs with: docker-compose logs -f" -ForegroundColor White
Write-Host ""

Write-Host "📊 MONITOR SERVICES:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  docker-compose logs -f              # All services" -ForegroundColor Gray
Write-Host "  docker-compose logs -f applicant    # Applicant portal" -ForegroundColor Gray
Write-Host "  docker-compose logs -f admin        # Admin portal" -ForegroundColor Gray
Write-Host "  docker-compose logs -f keycloak     # Keycloak" -ForegroundColor Gray
Write-Host "  docker-compose logs -f postgres     # Database" -ForegroundColor Gray
Write-Host "  docker-compose logs -f minio        # File storage" -ForegroundColor Gray
Write-Host ""

Write-Host "🧪 RUN REGRESSION TESTS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  npm.cmd run regression:applicant    # Test applicant workflows" -ForegroundColor Gray
Write-Host "  npm.cmd run regression:admin        # Test admin workflows" -ForegroundColor Gray
Write-Host "  npm.cmd run regression:auth         # Test authentication" -ForegroundColor Gray
Write-Host "  npm.cmd run regression:all          # Run all tests" -ForegroundColor Gray
Write-Host ""

Write-Host "🛑 STOP ALL SERVICES:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  docker-compose down                 # Stop services" -ForegroundColor Gray
Write-Host "  docker-compose down -v              # Stop + remove volumes" -ForegroundColor Gray
Write-Host ""

