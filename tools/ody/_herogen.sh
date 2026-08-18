#!/bin/zsh
# _herogen.sh — the four hero clips, SEQUENTIAL, Seedance 4 s, kill >300 s.
# Loops (twist, underbelly) ride vidgen2's default lastFrameImage = the seed
# (the seamless-loop trick); one-shots (seize, splash) land on their own
# staged end pose via --last-image. Raw-first into assets/raw/ody-heroclips/.
set -u
ROOT=/Users/samz/Documents/gaslight-remake
SEEDS=$ROOT/assets/raw/ody-heroclips/seeds
OUT=$ROOT/assets/raw/ody-heroclips
GEN="python3 $ROOT/tools/ody/vidgen2.py"
LOG=$OUT/gen.log
: > $LOG

run() {
  echo "==== $1 ====" >> $LOG
  eval "$2" >> $LOG 2>&1
  echo "---- $1 exit $? ----" >> $LOG
}

run seize "$GEN --name clip-seize --image $SEEDS/seize.png --last-image $SEEDS/seize-end.png \
  --outdir $OUT --duration 4 --res 720p --aspect 16:9 --poll-timeout 300 --prompt \
  'Locked camera, absolutely no camera movement or zoom. Painterly low-poly stylized game art. The huge one-eyed giant in a green tunic stands in a dim firelit cave holding two tiny struggling men in his fist; he lifts them to his mouth and gobbles them up like a lion of the wilderness, chewing hungrily, then lowers his arm and settles down to sit cross-legged on the cave floor. The small hero in a crimson tunic and the men on the right only watch in frozen horror, barely moving. Cheese racks, sheep pens and firelight stay exactly as they are. The seizing and devouring action only, nothing else changes.'"

run twist "$GEN --name clip-twist --image $SEEDS/twist.png \
  --outdir $OUT --duration 4 --res 720p --aspect 16:9 --poll-timeout 300 --prompt \
  'Locked camera, absolutely no camera movement or zoom. Painterly low-poly stylized game art. In a dim firelit cave, pairs of men carrying a great olive beam on their shoulders march slowly round and round like turning an auger with a wheel and strap, while the small hero in a crimson tunic keeps the glowing red-hot point of the stake pressed into the eye of the sleeping giant, twisting it; the ember tip flares and sparks, a thin curl of steam rises. Perfect seamless loop: the clip ends exactly on its first frame. Fire pit, woodpile and background stay exactly as they are. The turning action only.'"

run underbelly "$GEN --name clip-underbelly --image $SEEDS/underbelly.png \
  --outdir $OUT --duration 4 --res 720p --aspect 16:9 --poll-timeout 300 --prompt \
  'Locked camera, absolutely no camera movement or zoom. Painterly low-poly stylized game art. A great horned ram walks slowly, its thick white fleece swaying with each step, while a man clings underneath its belly gripping the wool, swinging gently with the sway; smaller rams walk alongside him toward the cave mouth light. Perfect seamless loop: the clip ends exactly on its first frame. Cave floor, fire ring, woodpile and background stay exactly as they are. The underbelly sway only.'"

run splash "$GEN --name clip-splash --image $SEEDS/splash.png --last-image $SEEDS/splash-end.png \
  --outdir $OUT --duration 4 --res 720p --aspect 16:9 --poll-timeout 300 --prompt \
  'Locked camera, absolutely no camera movement or zoom. Painterly low-poly stylized game art. A huge column of dark seawater erupts just ahead of the galley ship bow and collapses back into the sea, white spray falling, concentric wash rings spreading; the wave wash pushes the ship slightly backward as the rowers brace at their oars; the water then settles flat and calm again. Moonlit sea and cliffs stay exactly as they are. The splash and wash action only.'"

echo ALLDONE >> $LOG
