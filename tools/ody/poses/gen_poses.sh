#!/bin/zsh
# gen_poses.sh -- CREW + RAMS pose raws, sequential, journaled.
set -u
ROOT=/Users/samz/Documents/gaslight-remake
RAW=$ROOT/assets/raw/ody-poses
MAN=$RAW/manifest.json
J=/tmp/ody-poses/journal.log
mkdir -p $RAW
STYLE="flat-shaded chunky low poly 3d game style, faceted geometric figure, clean silhouette, isolated on a plain solid #1a2038 dark navy background, no text, no ground, no cast shadow"

gen() {
  local out=$1 img=$2 prompt=$3
  echo "== $(date +%H:%M:%S) GEN $out" >> $J
  python3 $ROOT/tools/nbpro_edit.py --image "$img" --prompt "$prompt" \
    --out $RAW/$out --manifest $MAN >> $J 2>&1
  echo "rc=$?" >> $J
}

gen crew-row-cand1.png /tmp/ody-poses/crew-a-src.png \
"EDIT this character into a NEW POSE, same identity: the young clean-shaven bronze-age Greek sailor in his faded OCHRE tunic, rope belt, sandals, same face and colours. New pose: A ROWER MID-PULL. Strict side profile facing the VIEWER'S LEFT, seated on a low invisible bench, knees bent, torso leaning back into the stroke, both arms straight out in front gripping one long plain wooden oar; the oar shaft runs diagonally from his fists down toward the lower left corner, blade cropped is NOT allowed - keep the whole oar inside frame. No boat, no water, figure and oar only. $STYLE"

gen crew-carry-cand1.png $ROOT/assets/plates/odyssey/actors/crew-canonical.png \
"EDIT these two characters into a NEW POSE, same identities: the young clean-shaven sailor in the faded OCHRE tunic and the older grey-bearded sailor in the worn SLATE-BLUE tunic, same faces and colours. New pose: THE TWO MEN CARRY ONE HUGE WOODEN BEAM TOGETHER, walking in single file in strict side profile facing the VIEWER'S LEFT, the ochre young man in front, the slate elder behind, one long heavy rough-hewn olive-wood beam resting horizontally across both men's near shoulders, each steadying it with both hands, knees bent under the weight. The beam is thick as a mast section and spans past both figures. $STYLE"

gen crew-plead-cand1.png /tmp/ody-poses/crew-b-src.png \
"EDIT this character into a NEW POSE, same identity: the older grey-bearded bronze-age Greek sailor in his worn SLATE-BLUE tunic, sandals, same face and colours. New pose: PLEADING AND RESTRAINING. Three-quarter view facing the VIEWER'S LEFT, leaning forward urgently, both arms reaching out to the left at chest height, the near hand open and grasping as if to seize a comrade's arm and hold him back, the far hand open palm-up in entreaty, mouth slightly open, brows knotted in fear. $STYLE"

gen crew-slung-cand1.png /tmp/ody-poses/crew-a-src.png \
"EDIT this character into a NEW POSE, same identity: the young clean-shaven bronze-age Greek sailor in his faded OCHRE tunic, sandals, same face and colours. New pose: LYING HORIZONTAL FACE-UP, stiff and straight as a plank, strict side profile with his head at the VIEWER'S LEFT and feet at the right, ankles together, both arms reaching straight UP above his chest with fists clenched as if gripping thick wool overhead, chin tucked, holding on for his life. The whole horizontal figure floats alone on the background. $STYLE"

gen ram-great-slung-cand1.png $ROOT/assets/plates/odyssey/actors/ram-great-canonical.png \
"EDIT this exact great ram, keeping EVERYTHING about it identical: same standing pose facing left, same magnificent gold-ochre spiral horns, same floor-deep cream fleece, same lighting. ADD ONE THING: a lean man in a DEEP CRIMSON short chiton lashed horizontally UNDER the ram's belly, up inside the thick belly fleece, face-up with his chest against the ram's belly, fists buried in the wool, ankles crossed. He is PARTIALLY HIDDEN: long locks of fleece hang over him so only parts read - his head and one shoulder near the ram's chest, a crimson stretch of torso at mid-belly, his shins near the hind legs. The crimson must clearly show through the gaps in the wool. Do not change the ram. $STYLE"

gen ram-walk-cand1.png $ROOT/assets/plates/odyssey/actors/ram-great-canonical.png \
"EDIT this ram into a DIFFERENT, PLAINER ANIMAL in the exact same art style: a GENERIC FLOCK RAM, slightly smaller and leaner than this great one, with much smaller plainer half-curl horns in dull grey-brown (NOT gold), ordinary cream fleece that stops above the knees so all four legs show, plain dark hooves. Pose: MID-STEP WALKING, strict side profile facing the VIEWER'S LEFT, near foreleg lifted mid-stride, head level. $STYLE"

gen ram-pair-slung-cand1.png $ROOT/assets/plates/odyssey/actors/ram-great-canonical.png \
"EDIT this image into a NEW GROUP in the exact same art style: TWO generic plainer flock rams walking side by side abreast, both in strict side profile facing the VIEWER'S LEFT, slightly smaller and leaner than this great ram, with small plain half-curl grey-brown horns (NOT gold) and ordinary cream fleece; the nearer ram overlaps the farther one. Slung horizontally UNDER their bellies between them: ONE lean man in a faded OCHRE tunic, face-up, fists gripping the wool above him, ankles together, partially hidden behind the near ram's fleece so only his head at the left, a strip of ochre torso, and his sandalled shins at the right show beneath the near ram's belly line. Reads as a man riding hidden under the middle of three sheep abreast. $STYLE"

echo "== $(date +%H:%M:%S) ALL DONE" >> $J
