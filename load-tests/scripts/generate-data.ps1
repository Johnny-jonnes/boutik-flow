param(
    [int]$TenantCount = 25,
    [int]$UsersPerTenant = 3,
    [int]$ProductsPerTenant = 30,
    [int]$ClientsPerTenant = 15
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path (Split-Path -Parent $root) "backend"

$env:LOADTEST_TENANT_COUNT = $TenantCount
$env:LOADTEST_USERS_PER_TENANT = $UsersPerTenant
$env:LOADTEST_PRODUCTS_PER_TENANT = $ProductsPerTenant
$env:LOADTEST_CLIENTS_PER_TENANT = $ClientsPerTenant

Push-Location $backend
try {
    python "$root\data\generate_synthetic_data.py"
} finally {
    Pop-Location
}
