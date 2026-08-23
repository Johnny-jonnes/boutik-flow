#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/../backend"

export LOADTEST_TENANT_COUNT="${LOADTEST_TENANT_COUNT:-25}"
export LOADTEST_USERS_PER_TENANT="${LOADTEST_USERS_PER_TENANT:-3}"
export LOADTEST_PRODUCTS_PER_TENANT="${LOADTEST_PRODUCTS_PER_TENANT:-30}"
export LOADTEST_CLIENTS_PER_TENANT="${LOADTEST_CLIENTS_PER_TENANT:-15}"

cd "$BACKEND"
python "$ROOT/data/generate_synthetic_data.py"
