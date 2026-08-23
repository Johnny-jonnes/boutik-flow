#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/../backend"
PREFIX="${1:-lt-}"

cd "$BACKEND"
python "$ROOT/data/cleanup_synthetic_data.py" "$PREFIX"
