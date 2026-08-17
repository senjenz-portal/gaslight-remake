# EXPLORER A — SAM 2 + on-plate generation (bowl-offer spike)

Hypothesis: generate motion ON the real plate so true lighting/contact/shadow
bake into the pixels, then SAM 2 pulls the character layer back out for the
engine. One test built end-to-end, 2026-08-16. All artifacts in
`tools/ody/seamless/onplate/`.

## What was built

1. **Seed** — `ulysses-stand` cut (316x682 RGBA, flat-navy matte from
   `assets/raw/ody-actors/poses-20260814T2200/matte/`) composited with the
   `stageproof_sea.py place()` math (foot-baseline, U_CAVE = 75 px, flip=True)
   at the **bowl-offer mark (700,468)** on `cave-shut.jpg`, cropped 1280x720 at
   offset (104,36) → mark at crop (596,432). `seed-composite.png` +
   ground-truth alpha `seed-truthmask.png` (1331 px figure).
2. **Motion** — `vidgen2.py`, `model_bytedance-seedance-2-0`, 4 s 720p,
   lastFrameImage = seed (loop trick), prompt: locked camera, the man shifts
   weight and breathes, firelight flickers. Job
   `job_Xy43PMMFeb8J3zSww2Awmx3P`, success in 148 s → `onplate-bowloffer.mp4`
   (97 frames @ 24 fps).
3. **Separation** — **real SAM 2, `meta/sam-2-video` on Replicate** (token from
   story-orbit/.env, works; NOTE Replicate 403s urllib's default User-Agent —
   send any UA). Runner: `onplate/sam2video.py`. One fg click (596,400),
   frame 0, propagated → 97 binary masks in **8.6 s predict time**.
   *Trap:* a 3-fg + 3-bg click prompt returned **97 all-zero masks** — the bg
   clicks (flame 25 px away) collapse the tiny object. Single click works.

## The numbers

| metric | value | read |
|---|---|---|
| camera lock | best global shift f001↔seed = (0,0); bg mean abs Δ 3.7 flat across all frames | locked; the 3.7 is a one-time whole-plate re-render softening (adjacent-frame bg noise floor is 0.24) |
| SAM 2 IoU vs eroded truth (ref = seed alpha eroded 1 px) | 0.643 / **0.665** / 0.679 (min/mean/max, 97 f) | low-ish, but the miss is Seedance *redrawing* the figure (truth bbox x579–613 vs f049 mask x581–608), not matte slop — see next row |
| temporal IoU (mask k ↔ k−1) | 0.912 / **0.969** / 0.999 | matte is very stable; e3 shows the red SAM edge hugging the drawn figure |
| halo | **11.2 px mean** (11–13) beyond a 2-px dilation of truth; max outward reach ≤ ~4 px | thin warm fringe on the fire side (visible over navy in e2-left) |
| baked warmth (temperature) | char R−B: flat-navy cut on seed = **59.9** → extracted layer = 63.2/**65.1**/68.7 | **+5.2 mean, +8.8 peak — firelight IS baked into the layer** (flicker modulates it frame to frame) |
| fire-side luminance asym (f049) | seed L/R Δ −3.3 → gen Δ −5.8 | no clean left-bright gradient; warmth shows as color shift + rim fringe, not a broad lum gradient at 34 px width |
| contact shadow | underfoot band (y424–440, x582–615, outside mask): 64–84 px darkened > 8 lum, min −145; band mean −2 | **a real contact shadow appears under the feet** (blue blob in e4)… |
| …where the shadow lives | **0 shadow px inside the SAM mask** (all 97 f) | the shadow bakes into the *background* pixels — a binary-matte extraction LOSES it; needs a dilated/soft matte or a separately carried shadow band |
| bg reconstruction | outside fig+fire: mean abs Δ vs clean plate 3.66/3.71/3.89; recomposite (clean plate + extracted layer) vs generated frame, figure nbhd: 3.36/3.85/4.74 | clean plate + layer ≈ the generated frame; e2-right looks grounded. Fire region Δ 4.7–5.8 (flame re-rendered + flickers — engine's own fire card diverges from the baked flicker) |
| loop seam | f097↔f001 figure region mean abs Δ **3.81** (vs ~7 against seed) | loop trick closes the cycle acceptably |

**Identity drift (unmeasured but visible, e1):** Seedance re-renders the flat
pixel-art cut as a volumetric low-poly figurine — *more* scene-consistent than
the pasted cut, but off-model vs the canonical actor face. At 75 px this is
mild; it is the thing to gate on before scaling.

## Evidence frames (tools/ody/seamless/onplate/)

- `e1-seed-vs-f049.png` — pasted flat cut (L) vs generated frame 49 (R): re-lit, grounded, restyled.
- `e2-layer-navy-and-recomposite.png` — extracted layer over navy (warm fringe = baked firelight) and recomposited on the clean plate.
- `e3-matte-edges.png` — SAM boundary (red) vs seed-truth boundary (green) on f049.
- `e4-change-heat-f049.png` — signed change vs clean plate: flame flicker (L), contact-shadow blob at the feet (blue, below mask), bg = noise only.
- plus `check-figure-strip.jpg` — seed + 5 frames, 3x zoom.

## Cost per motion

- Seedance 2.0 via Scenario: **146 CU** billed (`billing.cuCost`, queried live)
  = **$1.75–2.34** at $0.012–0.016/CU, 148 s wall. (Lever: arena's survey has
  `seedance-1-5-pro` with the same image+lastFrameImage pair at **16 CU ≈
  $0.19–0.26** @4 s/720p — untested here, try it before scaling.)
- SAM 2 video: 8.6 s A100 predict ≈ **$0.01–0.02**/clip, 97 mattes.
- **Total this spike: ~$1.9** (one motion + two SAM runs incl. the failed multi-click).

## GO / NO-GO

**GO — the hypothesis holds**, with three conditions:

1. **Lighting bakes (proved):** +5.2 R−B warming and per-frame flicker in the
   extracted layer, a real underfoot contact shadow, all impossible in the
   flat-navy pipeline at the same mark.
2. **SAM 2 separates it (proved):** temporally stable mattes (0.969), ~11 px
   halo, 9 s / ~$0.01 per clip, and the bg reconstructs behind the cut
   (recomposite Δ ≈ bg floor).
3. **Conditions:** (a) carry the contact shadow — it lands OUTSIDE the binary
   matte; either dilate/soften the matte at the feet or composite a shadow band
   with the layer, else the extracted layer floats exactly like today;
   (b) gate identity drift — Seedance restyles the cut; run the canonical-face
   check before promoting any on-plate motion to an actor;
   (c) cost — 146 CU/motion is 9x the seedance-1-5-pro path; re-run this exact
   test on 1-5-pro before committing the lane budget;
   (d) prompt SAM 2 with ONE fg click — bg clicks near a 34-px figure return
   empty masks.
