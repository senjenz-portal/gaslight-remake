#!/bin/bash
# teeth.sh — AN ASSERTION THAT CANNOT FAIL IS NOT AN ASSERTION.
#
# The review's own lesson for this round was that "lap clean" had been claimed
# over five defects with no assertion behind them. So each of this lane's seven
# gates is proved to have teeth: every fix is reverted AT ONCE, the same lap is
# run against the broken tree, and every one of the seven must name itself in
# the failures. Then the tree is restored and the lap must come back clean.
#
# Usage: bash tools/living/teeth.sh
set -u
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
BK=/tmp/teeth-backup
rm -rf "$BK"; mkdir -p "$BK"

save() { mkdir -p "$BK/$(dirname "$1")"; cp "$1" "$BK/$1"; }
save site-deploy/living/app/main.js
save site-deploy/living/app/sets/room.js
save site-deploy/living/app/sets/street.js
save site-deploy/living/assets/plate/room.jpg
save site-deploy/living/assets/plate/chair.png
save site-deploy/living/assets/actor/norton-chase.png
save site-deploy/living/assets/cameo/holmes.jpg

restore() {
  cd "$ROOT"
  for f in $(cd "$BK" && find . -type f | sed 's|^\./||'); do cp "$BK/$f" "$f"; done
  echo "-- tree restored"
}
trap restore EXIT

python3 - <<'PY'
# EVERY REVERT ASSERTS THAT IT LANDED. The [F2] revert below silently did
# nothing for one run of this script: it named the door lens as [612,356,1.90]
# and the lens had since been recomposed to [567,356,1.90], so str.replace was a
# no-op, the lap saw the FIXED tree, and the gate was reported as toothless when
# what was toothless was the revert. A revert that cannot fail loudly proves
# nothing about the gate it is aiming at.
def sub(path, old, new):
    s = open(path).read()
    assert old in s, f'{path}: revert anchor moved -> {old!r}'
    open(path, 'w').write(s.replace(old, new, 1))

# [F10] a unit ages under the cover again
sub('site-deploy/living/app/main.js',
    '  if (!S.turn.active) S.unitT += dt;', '  S.unitT += dt;')
# [F8] the arrival stops happening in the window
sub('site-deploy/living/app/sets/room.js',
    '    this.stepArrival(t);', '    /* teeth: */ if (false) this.stepArrival(t);')
# [F2] all three recomposed lenses go back to the ones the camera clamped
sub('site-deploy/living/app/sets/room.js',
    '  door:       [567, 356, 1.90],', '  door:       [386, 372, 1.55],')
sub('site-deploy/living/app/sets/street.js',
    '  villa:          [700, 372, 1.45],', '  villa:          [842, 372, 1.16],')
sub('site-deploy/living/app/sets/street.js',
    '  station:        [660, 468, 1.70],', '  station:        [560, 470, 1.46],')
# [F1] the street figure goes back to the house-face scale
sub('site-deploy/living/app/sets/street.js',
    'const PAVEMENT_PX_PER_M = 63.0;', 'const PAVEMENT_PX_PER_M = 49.4;')
print('regressions applied')
PY
# [F9] Watson back in the plate and in the foreground cut
cp assets/raw/watsonectomy/orig/room.jpg site-deploy/living/assets/plate/room.jpg
cp assets/raw/watsonectomy/orig/chair.png site-deploy/living/assets/plate/chair.png
# [F3] the un-matted cut
cp assets/raw/nortonmatte/norton-chase-orig.png site-deploy/living/assets/actor/norton-chase.png
# [F11] the wrong man's cameo
cp assets/raw/holmescameo/holmes-cameo-orig.jpg site-deploy/living/assets/cameo/holmes.jpg

echo "== running the lap against the reverted tree =="
node tools/living/lap.mjs --shots shots/lane-teeth 2>&1 | grep -E "^(FAIL|LAP)" | tee /tmp/teeth-out.txt

echo
echo "== which gates bit =="
for pat in "dead band" "WATSON IS STILL IN THE CHAIR" "the arrival is not IN the picture" \
           "under the floor|reads .*x the villa|head is .* CSS px" "dwell was already gone" \
           "Norton's cut still has a halo|hotter than his scene|blown pixels" \
           "not the stage Holmes|no face|green jacket|garment hue"; do
  if grep -Eq "$pat" /tmp/teeth-out.txt; then echo "  BIT   $pat"; else echo "  MISS  $pat"; fi
done
