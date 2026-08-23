# Monte la charge palier par palier (section 6/7/8 du cahier des charges) :
# ne passe au palier suivant que si le précédent n'a pas fait échouer de
# seuil k6 (thresholds) — sert à la fois de "montée progressive" ET de
# "test de breakpoint" (le premier palier en échec EST le point de rupture).
param(
    [Parameter(Mandatory = $true)][string]$Scenario,
    [int[]]$Levels = @(10, 50, 100, 250, 500, 1000),
    [string]$BaseUrl = "http://127.0.0.1:8159/api/v1",
    [string]$RampUp = "20s",
    [string]$Steady = "40s",
    [string]$RampDown = "10s",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$scenarioFile = "scenarios/$Scenario.js"
if (-not (Test-Path $scenarioFile)) {
    Write-Error "Scénario introuvable : $scenarioFile"
    exit 1
}

Write-Host "`n=== Montée progressive : $Scenario ===" -ForegroundColor Cyan
Write-Host "Paliers : $($Levels -join ', ') VUs`n"

foreach ($vus in $Levels) {
    Write-Host "--- $Scenario @ $vus VUs (ramp-up=$RampUp, steady=$Steady) ---" -ForegroundColor Yellow
    $env:BASE_URL = $BaseUrl
    $env:TARGET_VUS = $vus
    $env:RAMP_UP = $RampUp
    $env:STEADY = $Steady
    $env:RAMP_DOWN = $RampDown

    & k6 run $scenarioFile
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Host "`n>>> Seuils échoués à $vus VUs. Point de rupture probable atteint. <<<" -ForegroundColor Red
        if (-not $Force) {
            Write-Host "Arrêt (utiliser -Force pour continuer quand même vers les paliers suivants)." -ForegroundColor Red
            break
        }
    } else {
        Write-Host "OK à $vus VUs.`n" -ForegroundColor Green
    }

    Start-Sleep -Seconds 5
}

Write-Host "`nRapports écrits dans load-tests/reports/`n"
