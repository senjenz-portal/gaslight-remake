#!/bin/bash
# teeth-sole.sh — AN ASSERTION THAT CANNOT FAIL IS NOT AN ASSERTION, for the gate
# this lane added: [F5]'s sole-span law — not one sole column stands on a pew.
#
# The state it has to bite is the state the tree was actually in before
# tools/lanecf/pew_end.py, and those bytes exist: the front pew's END STANDARD
# was outside the foreground layer, so the witness's altar mark passed the
# floorFrac patch at 0.893 (an 11x11 probe on chancel stone the plate really does
# paint) while his LEFT boot hung over furniture 15 px above its own top edge.
# Two gates asserting F5 both passed that frame. This restores the pre-fix cuts,
# runs the same lap, and requires it to name the floating boot; then the shipped
# cuts go back and the lap must come back clean.
#
# Usage: bash tools/living/teeth-sole.sh
set -u
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
CUTS=site-deploy/living/assets/set/church
PRE=assets/raw/book-cf/20260813T1100Z/pre-pewend
BK=/tmp/teeth-sole-backup
rm -rf "$BK"; mkdir -p "$BK"
cp "$CUTS/pews-front.png" "$CUTS/pews-front-ring.png" "$BK/"
restore() {
  cp "$BK/pews-front.png" "$BK/pews-front-ring.png" "$CUTS/"
  echo "-- cuts restored ($(md5 -q "$CUTS/pews-front.png"))"
}
trap restore EXIT

# THE REVERT ASSERTS THAT IT LANDED. pew_end.py recorded the md5 it wrote; if the
# shipped bytes are not that, this script is reverting something else and proves
# nothing about the gate.
SHIPPED=$(md5 -q "$CUTS/pews-front.png")
WANT=$(python3 -c "import json;print(json.load(open('$PRE/../pew_end.json'))['variants']['pews-front.png']['md5'])")
if [ "$SHIPPED" != "$WANT" ]; then
  echo "ABORT: shipped pews-front.png is $SHIPPED, pew_end.py wrote $WANT"; exit 2
fi
cp "$PRE/pews-front.png" "$PRE/pews-front-ring.png" "$CUTS/"
echo "reverted to the pre-pew_end cuts ($(md5 -q "$CUTS/pews-front.png"))"

echo
echo "== the raw measurement first: sole_span.py on the reverted cuts =="
python3 tools/lanecf/sole_span.py 2>&1 | grep -E "altar|NO SOLE|SOLES ON"

echo
echo "== running the lap against the reverted tree =="
node tools/living/lap.mjs --shots shots/teeth-sole --port 8833 2>&1 \
  | grep -E "^(FAIL|LAP)" | tee /tmp/teeth-sole.txt

echo
if grep -q "is standing on a pew" /tmp/teeth-sole.txt; then
  echo "  BIT   [F5] the sole-span law named the floating boot"
else
  echo "  MISS  [F5] the sole-span law did not bite — it is not an assertion"
fi
