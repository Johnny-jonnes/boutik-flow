#!/usr/bin/env bash
# Monte la charge palier par palier — ne passe au palier suivant que si le
# précédent n'a pas fait échouer de seuil k6. Sert à la fois de "montée
# progressive" et de "test de breakpoint" (le premier palier en échec EST
# le point de rupture). Équivalent Bash/CI de run-progressive.ps1.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCENARIO="${1:?Usage: run-progressive.sh <scenario> [levels csv] [base_url]}"
LEVELS="${2:-10,50,100,250,500,1000}"
export BASE_URL="${3:-http://127.0.0.1:8159/api/v1}"
export RAMP_UP="${RAMP_UP:-20s}"
export STEADY="${STEADY:-40s}"
export RAMP_DOWN="${RAMP_DOWN:-10s}"
FORCE="${FORCE:-0}"

SCENARIO_FILE="scenarios/${SCENARIO}.js"
if [ ! -f "$SCENARIO_FILE" ]; then
  echo "Scénario introuvable : $SCENARIO_FILE" >&2
  exit 1
fi

echo ""
echo "=== Montée progressive : $SCENARIO ==="
echo "Paliers : $LEVELS VUs"
echo ""

IFS=',' read -ra LEVEL_ARR <<< "$LEVELS"
for vus in "${LEVEL_ARR[@]}"; do
  echo "--- $SCENARIO @ ${vus} VUs (ramp-up=$RAMP_UP, steady=$STEADY) ---"
  export TARGET_VUS="$vus"
  k6 run "$SCENARIO_FILE"
  code=$?
  if [ $code -ne 0 ]; then
    echo ""
    echo ">>> Seuils échoués à ${vus} VUs. Point de rupture probable atteint. <<<"
    if [ "$FORCE" != "1" ]; then
      echo "Arrêt (FORCE=1 pour continuer quand même vers les paliers suivants)."
      break
    fi
  else
    echo "OK à ${vus} VUs."
    echo ""
  fi
  sleep 5
done

echo ""
echo "Rapports écrits dans load-tests/reports/"
