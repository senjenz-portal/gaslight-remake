#!/bin/zsh
set -u
RAW=/Users/samz/Documents/gaslight-remake/assets/raw/ody-poses
cd /tmp/ody-poses
for pair in "crew-a-stand:/tmp/ody-poses/crew-a-src.png" \
            "crew-b-stand:/tmp/ody-poses/crew-b-src.png" \
            "crew-row:$RAW/crew-row-cand1.png" \
            "crew-carry:$RAW/crew-carry-cand1.png" \
            "crew-plead:$RAW/crew-plead-cand2.png" \
            "crew-slung:$RAW/crew-slung-cand1.png" \
            "ram-great:/Users/samz/Documents/gaslight-remake/assets/plates/odyssey/actors/ram-great-canonical.png" \
            "ram-great-slung:$RAW/ram-great-slung-cand1.png" \
            "ram-walk:$RAW/ram-walk-cand1.png" \
            "ram-pair-slung:$RAW/ram-pair-slung-cand1.png"; do
  id=${pair%%:*}; src=${pair##*:}
  echo "== $id"
  python3 -W ignore matte_navy.py "$src" $id.key.png --json $id.matte.json | python3 -c "import json,sys; m=json.load(sys.stdin); print(json.dumps({k:m[k] for k in ('size','despill_ceiling','baseline_y')}))"
done
echo "REKEY DONE"
