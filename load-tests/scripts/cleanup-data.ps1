param(
    [string]$Prefix = "lt-"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path (Split-Path -Parent $root) "backend"

Push-Location $backend
try {
    python "$root\data\cleanup_synthetic_data.py" $Prefix
} finally {
    Pop-Location
}
