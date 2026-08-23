# Test longue durée (section 9) : charge modérée et stable pendant une
# période prolongée, pour détecter fuites mémoire, accumulation de
# connexions, dégradation progressive. Par défaut ici DURÉE COURTE (10 min)
# à usage de démonstration — un vrai soak test (plusieurs heures, ex.
# 10 000 VUs) doit être lancé en arrière-plan par vous, hors d'une session
# interactive, avec surveillance externe (Render/Supabase dashboards) en
# parallèle. Voir README section "Soak test".
param(
    [int]$Vus = 50,
    [string]$Duration = "10m",
    [string]$BaseUrl = "http://127.0.0.1:8159/api/v1",
    [string]$Scenario = "a_consultation"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== Soak test : $Scenario @ $Vus VUs pendant $Duration ===" -ForegroundColor Cyan
Write-Host "Surveillez en parallèle : mémoire/CPU du process backend local, taille du pool de connexions." -ForegroundColor Yellow

$env:BASE_URL = $BaseUrl
$env:TARGET_VUS = $Vus
$env:RAMP_UP = "30s"
$env:STEADY = $Duration
$env:RAMP_DOWN = "15s"

& k6 run "scenarios/$Scenario.js"
