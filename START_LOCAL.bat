@echo off
REM TalentOS Local Development - Quick Start Batch Script

echo.
echo ================================
echo TalentOS - Quick Start
echo ================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Desktop is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Docker is running ✓
echo.

REM Check if .env exists
if not exist ".env" (
    echo [2/4] Creating .env file from template...
    copy .env.example .env
    echo [2/4] .env created ✓
) else (
    echo [2/4] .env already exists ✓
)
echo.

REM Install dependencies
echo [3/4] Installing npm dependencies...
call npm.cmd install
echo [3/4] Dependencies installed ✓
echo.

REM Start Docker Compose
echo [4/4] Starting Docker Compose (this may take 2-3 minutes)...
echo.
call docker-compose up -d
echo.

if errorlevel 0 (
    echo.
    echo ================================
    echo ✓ SUCCESS - TalentOS is starting!
    echo ================================
    echo.
    echo IMPORTANT: Docker images are downloading in the background.
    echo This may take 2-3 minutes on first run.
    echo.
    echo NEXT STEPS:
    echo.
    echo 1. Open TESTING_PORTAL_DASHBOARD.html in Chrome:
    echo    (Double-click the file or open in browser)
    echo.
    echo 2. Click the portal links to access:
    echo    - Applicant Portal: http://demo.lvh.me:3100
    echo    - Admin Portal: http://demo.lvh.me:3200
    echo    - Keycloak: http://keycloak.lvh.me:8080
    echo    - MinIO: http://localhost:9001
    echo.
    echo 3. Use the test credentials provided in the dashboard
    echo.
    echo MONITOR PROGRESS:
    echo    Open PowerShell and run:
    echo    docker-compose logs -f
    echo.
    echo WAIT FOR SERVICES TO BE READY:
    echo    Services may still be starting. Wait until all containers show:
    echo    "healthy" or "running" status in:
    echo    docker-compose ps
    echo.
    echo DETAILED TESTING GUIDE:
    echo    See TESTING_GUIDE.md for complete testing checklist
    echo.
) else (
    echo.
    echo ERROR: Failed to start Docker Compose!
    echo Check that Docker Desktop is running and try again.
    echo.
)

pause
