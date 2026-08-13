# scripts/ci-preflight.ps1
# Runs the same checks as GitHub Actions CI, locally, in the same order.
# Usage: .\scripts\ci-preflight.ps1
# Exits with code 1 if any check fails.

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

$steps = @(
    @{ Name = "db:generate"; Command = "npm run db:generate" },
    @{ Name = "typecheck";   Command = "npm run typecheck" },
    @{ Name = "lint";        Command = "npm run lint" },
    @{ Name = "test";        Command = "npm test" },
    @{ Name = "build";       Command = "npm run build" }
)

$totalStart = Get-Date

foreach ($step in $steps) {
    $name = $step.Name
    $cmd  = $step.Command
    $start = Get-Date

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  CI PREFLIGHT: $name" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "> $cmd" -ForegroundColor DarkGray
    Write-Host ""

    & Invoke-Expression $cmd 2>&1 | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE

    $elapsed = ((Get-Date) - $start).TotalSeconds

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "FAIL: $name failed (exit code $exitCode, ${elapsed}s)" -ForegroundColor Red
        Write-Host ""
        Write-Host "DO NOT COMMIT. DO NOT PUSH." -ForegroundColor Red
        Write-Host "Fix the failure, then re-run this script." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "PASS: $name (${elapsed}s)" -ForegroundColor Green
}

$totalElapsed = ((Get-Date) - $totalStart).TotalSeconds

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ALL CI-EQUIVALENT CHECKS PASSED" -ForegroundColor Green
Write-Host "  Total: ${totalElapsed}s" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You may now commit and push." -ForegroundColor Green
