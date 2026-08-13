#!/bin/bash
# teeth-cf.sh — THE CHURCH + FINALE LANE'S SEVEN GATES, PROVED TO HAVE TEETH.
#
# teeth.sh does this for the room/street/heads lane (F1 F2 F3 F8 F9 F10 F11).
# This is the same proof for the other seven defects of the fable pass —
# F4 F5 F6 F7 F12 F13 F14 — because the review's own lesson was that a gate
# nobody has ever seen fail is indistinguishable from no gate at all.
#
# Every fix is reverted AT ONCE (the pre-fix bytes are kept raw-first under
# assets/raw/book-cf/<stamp>/pre, and the code reverts are the exact constants
# the fixes moved), the same lap is run against the broken tree, and each of the
# seven must NAME ITSELF in the failures. The tree is restored on exit.
#
# Usage: bash tools/living/teeth-cf.sh
set -u
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
PRE=$ROOT/assets/raw/book-cf/20260813T1100Z/pre
BK=/tmp/teeth-cf-backup
rm -rf "$BK"; mkdir -p "$BK"

save() { mkdir -p "$BK/$(dirname "$1")"; cp "$1" "$BK/$1"; }
save site-deploy/living/app/sets/church.js
for f in church.jpg church-dim.jpg church-ring.jpg altar.png; do
  save "site-deploy/living/assets/set/church/$f"
done
save site-deploy/living/assets/set/street/street-smoke.jpg
save site-deploy/living/assets/set/street/street-empty.jpg
save site-deploy/living/assets/actor/irene-street.png
save site-deploy/living/assets/inset/photo-irene.jpg

restore() {
  cd "$ROOT"
  for f in $(cd "$BK" && find . -type f | sed 's|^\./||'); do cp "$BK/$f" "$f"; done
  echo "-- tree restored"
}
trap restore EXIT

python3 - <<'PY'
p = 'site-deploy/living/app/sets/church.js'
s = open(p).read()
n = len(s)
# [F5] the chancel mark goes back to the top edge of the near pew backs
s = s.replace('const FLOOR = [[449, 604], [522, 601], [700, 501], [791, 527.5], [980, 534]];',
              'const FLOOR = [[449, 604], [522, 601], [700, 516], [791, 527.5], [980, 534]];')
# [F7] the ring lens goes back to the 13% "push" and the 13 px band
s = s.replace('  ring:  [HANDS[0], HANDS[1] - 4, 3.20],', '  ring:  [HANDS[0], HANDS[1] - 6, 2.20],')
s = s.replace('  ring:  { size: [128, 115], w: 16 },', '  ring:  { size: [128, 115], w: 13 },')
# [F6] the coin lens goes back off the journey
s = s.replace('  coin:  [734, 422, 3.20],', '  coin:  [705, 452, 2.70],')
s = s.replace('  coin:  { size: [128, 114], w: 16 },', '  coin:  { size: [128, 114], w: 13 },')
# [F4] the two who never move go back to being the PLATE's business
s = s.replace("    placeSprite(this.clergy, ART.clergyman, FEET.clergyman, 1.75 * PX_PER_M);",
              "    placeSprite(this.clergy, ART.clergyman, FEET.clergyman, 1.75 * PX_PER_M);\n"
              "    this.bride.style.opacity = '0'; this.clergy.style.opacity = '0';")
assert len(s) != n, 'no church.js revert applied — the anchors moved'
open(p, 'w').write(s)
print('code reverts applied')
PY

# [F4] the mannequins go back into the plate and its two variants and the cut
for f in church.jpg church-dim.jpg church-ring.jpg altar.png; do
  cp "$PRE/$f" "site-deploy/living/assets/set/church/$f"
done
# [F13] the fire goes back upstairs
cp "$PRE/street-smoke.jpg" site-deploy/living/assets/set/street/street-smoke.jpg
cp "$PRE/street-empty.jpg" site-deploy/living/assets/set/street/street-empty.jpg
# [F12] the reveal cut goes back to its keying spill
cp "$PRE/irene-street.png" site-deploy/living/assets/actor/irene-street.png
# [F14] the closing portrait goes back to the mannequin
cp "$PRE/photo-irene.jpg" site-deploy/living/assets/inset/photo-irene.jpg

echo "== running the lap against the reverted tree =="
node tools/living/lap.mjs --shots shots/lane-teeth-cf --port 8811 --timeout 700000 2>&1 \
  | grep -E "^(FAIL|LAP)" | tee /tmp/teeth-cf-out.txt

echo
echo "== which gates bit =="
# THE LAW IS THAT THE DEFECT NAMES ITSELF. A failure that fires under another
# defect's tag is not that defect's assertion, so every check below greps the
# TAG — and the two halves of F4 (the plate, and the register on screen) are
# checked separately because they are two different fixes.
for d in F4 F5 F6 F7 F12 F13 F14; do
  if grep -q "\[$d\]" /tmp/teeth-cf-out.txt; then
    echo "  BIT   $d  -> $(grep -o "\[$d\][^—]*" /tmp/teeth-cf-out.txt | head -1)"
  else echo "  MISS  $d  — the revert did not make its own gate fail"; fi
done
for half in "F4 the plate paints a participant:the plate still paints the" \
            "F4 the register on screen:is not a cut-out in this frame"; do
  n=${half%%:*}; p=${half#*:}
  if grep -q "$p" /tmp/teeth-cf-out.txt; then echo "  BIT   $n"; else echo "  MISS  $n"; fi
done
