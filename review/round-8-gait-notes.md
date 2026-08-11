# Round-8 gait diagnosis — reviewer notes (user: "walking still awkward")

Judged on shots/round-8-smoke/11-hadnote-midwalk.png: the King mid-stride is
a deep lunge — rear leg overextended, torso pitched. Root causes and the
prescription for the fix pass (these go BEYOND the swing/slide gates):

1. STANCE/SWING ASYMMETRY (the big one). Replace symmetric sine legs with a
   two-phase cycle per leg: STANCE — foot planted, leg near-straight,
   rotating over the ankle as the body passes (hip extends −, knee ≤0.15 rad
   flex); SWING — knee flexes (~0.7–0.9 rad peak at mid-swing), hip flexes +,
   foot clears floor by 4–8 cm, then reaches and plants with a small heel-
   first settle. Duty factor ~60% stance / 40% swing.
2. STRIDE = SPEED × PERIOD. Solve step length from the mover's actual speed
   and the leg length (stride ≤ 0.85 × legLen for Holmes/Watson, ≤ 0.7 for
   the King); cadence = speed / stride. Never let amplitude exceed what the
   planted foot can cover without sliding.
3. FOOT-PLANT LOCK. During stance the foot's WORLD position stays fixed
   (compute hip/knee from the fixed foot + moving pelvis — 2-bone IK on the
   leg, the same law-of-cosines as the arm reach). This kills slide exactly,
   not approximately.
4. BOB PHASE: pelvis peaks at mid-stance (passing over the planted leg),
   dips at double support. Amplitude ~1.5–2.5 cm scaled by stride, NOT a
   free sine. Slight pelvis roll toward the swing side, chest counter-roll.
5. CHARACTER CADENCE: King — slow, upright (torso pitch ≤0.05 rad), long
   period, contained amplitude: weight, not hurry. Holmes — brisk, slight
   forward energy. Watson — only walks if ever staged; keep default.
6. EASE-IN/OUT: first and last half-stride ramp amplitude 0→1→0 with the
   mover's own speed ramp; never full-amplitude on frame one. Arms follow
   the same envelope (counter-phase to legs, elbow slightly bent, ~0.25 rad
   swing for the King, ~0.4 for Holmes).
7. GATES to add on top of the stage-2 set: knee flexion ASYMMETRY between
   stance and swing legs (stance knee <0.2 rad while swing knee >0.5 rad at
   mid-cycle); torso pitch bound (≤0.08 rad at constant speed); foot
   clearance 2–10 cm during swing; the existing slide gate stays.

Deployed-site note: the live site still runs the round-7 cast (no limbs) —
do not confuse user reports against it with the new rig.
