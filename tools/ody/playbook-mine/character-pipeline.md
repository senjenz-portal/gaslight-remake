# CHARACTER PIPELINE — the photo-rig playbook

Mined 2026-08-21 from three shipped character runs (king, ulysses, polyphemus photorig
manifests), the cast lanes (crew, ram), the code-character dead ends (king-tier-diagnosis,
armed-Sol headlab), and the original alternatives research (PIPELINE-RESEARCH.md).
Audience: someone who must produce a GREAT rigged 3D character TOMORROW.

Every entry is LAW (never break), RECIPE (do exactly this), GOTCHA (will bite you), or
DEAD-END (tried, failed, evidence attached). Numbers are from manifests, not memory.

---

## 0. THE WORKING 5-STAGE RECIPE (photo-rig lane)

Reference → stylized turnaround → Tripo multiview mesh → Tripo rig → gated demo page.
Cost per character: **~$2–3** (Polyphemus: 215 Scenario CU + 6 NB Pro images ≈ $3.00,
of which mv-mesh 75 CU, rig+walk 70 CU, idle 70 CU ≈ $2.15; images ≈ $0.85). Wall time
under an hour per character once the gates exist.

### RECIPE S1 — Stylize the front view (identity + pose canonicalization)
- Tool: `tools/nbpro_edit_mv.py` (multi-image i2i). Model chain (fallback order):
  `gemini-3-pro-image, nano-banana-pro-preview, gemini-3.1-flash-image`; endpoint
  `v1beta generateContent`, `responseModalities: ["TEXT","IMAGE"]`,
  contents `[inlineData x2, text]`.
- Inputs: TWO references of the SAME character — a full-body look reference + a face
  portrait (cameo). Both inline.
- The prompt template (load-bearing, evolved over three runs — reuse verbatim, swap the
  identity/costume clauses):
  - "These two reference images show the SAME character: a full-body look reference and
    a face portrait. Redraw him as ONE image: FULL BODY, strict FRONT orthographic view,
    standing in a symmetric **A-pose (arms straight and held out about 40 degrees from
    the body, palms toward thighs, legs straight and slightly apart)**, facing the camera
    directly, head level."
  - Register clause: "polished stylized 3D game avatar render — smooth rounded surfaces,
    soft gradient shading … **Absolutely NOT low-poly: no facets, no flat triangular
    planes, no paper-cut edges.**"
  - Identity clause from the portrait (explicit features), costume clause with COLOR
    NAMES IN CAPS (Prussian-blue / CRIMSON / OLIVE-GREEN — the caps survive drift).
  - Visibility clause: garments "must hang symmetrically so both arms and both legs stay
    fully visible and unobstructed."
  - Framing: "centered and whole in frame with margin above the head and below the
    boots/sandals/feet, plain flat solid dark-navy studio background, soft even lighting,
    no floor shadow, no text, no props."
- Generate **2 candidates**, gate `stylize-identity`, accept ONE as `front-accepted.png`.
- For a non-human defining feature, make it "THE DEFINING FEATURE, NON-NEGOTIABLE"
  with negations: Polyphemus prompt = "exactly ONE SINGLE ENORMOUS EYE centered in the
  middle of his forehead … NO second eye, NO pair of eyes, NO empty eye sockets."
  It held in both candidates (amberBlobs=1, midline offset −0.005 / +0.014).

### RECIPE S2 — Turnaround (left + back) with the accepted front as the ONLY reference
- Same tool, ONE input image (`front-accepted.png`), `[inlineData x1, text]`.
- Prompt opens: "This image is the accepted FRONT view of a stylized 3D game character.
  Render THE SAME character in the SAME polished smooth 3D game-avatar style: strict
  LEFT PROFILE view / strict BACK view …" then restates identity, costume, palette,
  framing, and background PER VIEW (what is visible from that angle: "No face visible"
  on the back, "the coat hangs down behind the legs in profile").
- Gate `same-person-turnaround` (instrumented, see §2). Regenerate individual views on
  honest failure — Polyphemus needed 3 left-profile attempts (view-left → view-left2 →
  view-left3) before the amber iris read in profile.

### RECIPE S3 — Reconstruct: Tripo P1 multiview via Scenario
- Tool: `tools/tripo3d_mv.py`. Model: **`model_tripo-p1-multiview-to-3d`** (catalog-
  verified 2026-08-20; newer than `model_tripo-v3-1-multiview-to-3d`, created 2026-03-13
  vs 2026-03-04).
- Call: upload front/left/back(/right) images as assets →
  `POST /v1/generate/custom/model_tripo-p1-multiview-to-3d` with body:
  `{frontImage, leftImage, backImage, texture: true, textureQuality: "standard",
  textureAlignment: "original_image", orientation: "align_image", pbr: false,
  autoSize: true, seed, textureSeed}` → poll `GET /v1/jobs/{id}` every 15 s
  (timeout 2400 s) → download → `verify_glb` → thumbnail.
- **Seeds are required args** (Polyphemus: seed 77001, textureSeed 77002) — determinism
  lives in cached artifacts + manifests, not regeneration.
- faceLimit range 48..20000, adaptive if unset. Shipped meshes: king 16,937 tris /
  19,176 verts; ulysses 17,032 tris; polyphemus 4,822 tris. All: 1 mesh, 1 material,
  1 texture. Cost ~75 CU.
- Gate: turntable coverage (see §2).

### RECIPE S4 — Rig + retarget banked clips: Tripo Rigging via Scenario
- BIPED: `tools/triporig.py`, model **`model_tripo-rigging-v1`** ("Tripo Rigging 1.0
  [Biped]", capability 3d23d). Inputs are ONLY `{model, animation, includeRiggedModel}`
  — no skeleton/pelvis hints exist (this matters for the posture fix, §3).
- NON-BIPED: `tools/triporig25.py`, model **`model_tripo-rigging-v2-5`** — rigType
  presets `quadruped | hexapod | octopod | avian | serpentine | aquatic`, animations
  `"" | quadruped:walk | hexapod:walk | octopod:walk | serpentine:march | aquatic:march`
  (costImpact true). Used for the great ram: `{rigType: "quadruped",
  animation: "quadruped:walk"}` → 19 bones, 5,201 tris, hasSkeleton true.
- **LAW: v2-5 is quadruped+ ONLY. Rigging V1 is the biped track.** (king manifest S4
  note; triporig.py docstring: "wrong for a humanoid.")
- **LAW: reuse the reconstruction job's own output asset id** (`--model-asset`) — no
  re-upload. Polyphemus rig reused `asset_NLL7GdSbqFGQzWEWiXrGX3Dz` directly.
- Output: Tripo biped skeleton, **41 joints, 1 skin** (Pelvis/Spine/limb chains + twist
  bones, `L_`/`R_` naming). Banked clips retarget in the same call:
  `preset:biped:walk` (1.9–2.375 s, 126 channels), `preset:biped:idle` (15.375 s).
  Each rig/clip job ~70 CU. Make-It-Animatable fallback was never needed.

### RECIPE S5 — Animate on a demo page + smoke gate + ship
- Three.js page loading the rigged GLB, driving the banked clip through AnimationMixer,
  staged on the book's plate (plate-space orthographic camera, ledger scale 43 px/m:
  Ulysses 75 px = 1.75 m; Polyphemus 301 px = 7 m, read LIVE off the skinned bbox).
- Headless smoke script per character (`tools/demo3d_smoke.mjs`,
  `tools/polyphemus_smoke.mjs`): zero console errors, mesh+stats loaded, mixer time
  advances, a named bone actually moves (king: L_Thigh delta 0.036), actor X advances,
  phase X monotonic, path/posture/scale asserts (§2). Ship only on PASS.

---

## 1. LAWS (upstream, learned the hard way)

- **LAW — A-pose at ~40° or the reconstruction fuses limbs.** The #1 controllable
  predictor of auto-rig success (PIPELINE-RESEARCH lanes 0/1/2/3). Enforced at the
  STYLIZE gate: ulysses cand1 rejected because "arms hang near the torso —
  reconstruction fuse risk"; polyphemus cand2 rejected for the same class. Fix pose in
  the PROMPT, never downstream in DCC.
- **LAW — anti-low-poly clause in every stylize prompt.** "Absolutely NOT low-poly" is
  a gate criterion: polyphemus cand2 "broke the anti-low-poly law" and was rejected
  even though its eye passed. (Exception: deliberately low-poly cast lanes — crew/ram —
  flip the clause to "SAME faceted flat-shaded low-poly style." Pick a register per
  character and state it in every prompt.)
- **LAW — plain flat solid dark-navy background, no floor shadow, no props.** Both a
  reconstruction hygiene rule (Hunyuan once meshed a raw backdrop into a 2×2 ground
  disc — Lane 8 empirical) and what makes the color-fraction instruments possible.
- **LAW — the front-accepted image is the single source of truth for S2.** Turnaround
  views are generated FROM it, not from the original references — this is what makes
  "same person" achievable and measurable (chiton dRGB max 4.5 across views).
- **LAW — manifest everything**: sha256 + bytes + model id + full prompt + params +
  jobId + assetId + gate stats + verdicts, in `assets/raw/<lane>/<UTC>/manifest.json`.
  Download outputs immediately (vendor result URLs die in ~5 min).
- **LAW — every gate is an instrument + thresholds + a written verdict.** No eyeballing.
  When a gate fails, decide honestly: artifact of the instrument (refine the instrument,
  document why, keep the fact) vs artifact of the art (regenerate). Both king and
  ulysses S2 first runs FAILED on instrument artifacts and were re-run with refined
  instruments; polyphemus view-left FAILED honestly and was regenerated.

---

## 2. THE GATES (exact checks + thresholds, per stage)

### Gate S1 `stylize-identity` (2 candidates → 1 accepted)
- Costume color fractions over foreground px: dominant garment ≥ 0.20 (crimson/olive),
  accent present ≥ 0.02 (bronze belt), skin present, bbox heights within 15%.
- Pose check: true 40° A-pose (arm-at-torso = reject).
- Register check: smooth non-faceted (or the lane's declared register).
- Identity is the tiebreak, judged against the canonical portrait (king cand2 won on
  "stronger straight brows, mature facial structure"; cand1 "drifted younger/rounder").
- Species features instrumented: `tools/polyeye_stats.py` — exactly ONE amber blob,
  midline offset |off| ≤ 0.05, no second blob in the head band.

### Gate S2 `same-person-turnaround` (front/left/back)
- Final refined check set (the one that works):
  - garment dominant on front+back (≥0.20 navy was ≥0.35), PRESENT on profile (≥0.06)
    — never demand area-dominance of an edge-on garment (see GOTCHA below);
  - **cross-view garment color distance dRGB max ≤ 30** (the real "same garment" check;
    measured: king coat 9.2, ulysses chiton 4.5, polyphemus tunic 29.9 — that last one
    nearly failed, watch lighting drift);
  - accent lining/belt present only on views where it is physically visible (king back:
    orange 0.0001 is CORRECT — outer shell navy ≥ 0.8 instead);
  - hair mass via **crown band, lum<150 non-skin fraction ≥ 0.6** (not a top-18% band);
  - skin present all views ≥ 0.05; bbox heights within 15%.
- Species features: eye present in front (amber blob) AND profile (structural
  `profileOrb`: compact brow-zone cluster of bright-orb + warm-gold px), ZERO in back.
- Cheap-lane variant (crew/ram, stylize-skip): per-view mean-RGB of tunic/skin/hair +
  presence masses; observed dRGB tunic 13, skin 14 (crew), fleece 7, horn 9 (ram) — all
  comfortably under the 30 line.

### Gate S3 `reconstruct-mesh`
- `verify_glb` (glb version, declared bytes, mesh/material/texture counts, bbox).
- **Turntable coverage gate**: render front/left/back/right; foreground coverage per
  view; require max/min ratio sane — observed maxOverMin 1.5 / 1.51 / 1.71 all PASS
  (a hole or a collapsed side blows this up).
- Species check ON THE MESH: re-run the eye instrument on turntable renders with
  `--gain 1.3` ("turntable renders sit ~1.3x dimmer than the studio frames; gain
  documented, thresholds unchanged"). Eye at midline front, sclera-orb bulge in strict
  profile (physically correct — see GOTCHA), zero from behind.

### Gate S4 `rig-joints-pose` + posture
- 41 joints, 1 skin, clip loads and has 126 channels.
- **Posture instrument `tools/rigpitch.py`**: standing head pitch within ±5° of upright;
  walk-cycle max ≤ 12°. Character-stance amendment (Polyphemus): re-anchor to the
  canonical's own measured stance (`tools/polystance.py`, hip-band→head-band forward
  lean; his = 0.75°): |standing − stance| ≤ 8 (measured 3.56), |clip pitch − stance|
  ≤ 12 (walk 4.82, idle 5.32). The hunch lives in the MESH, not in a bowed head.

### Gate S5 `demo-smoke` (headless, scripted, all must PASS)
- consoleErrors == 0; meshLoaded; statsLoaded; mixer time advances; named bone world
  position moves; actor X advances; phase X monotonic; loops OK.
- Scale assert: actor height px == ledger target (301.0 vs 301).
- Path audit (`tools/demo3d_pathaudit.mjs`): zero intersections with every object box,
  fire-ring clearance ≥ 10 px (measured min 10.67), floor polylines held, actor passes
  IN FRONT of the fire (occluder z-swap 85 → 5 on the near pass).
- Idle-hold assert: clip == idle at the seat, X frozen while mixer advances, resumes walk.

---

## 3. GOTCHAS (each cost a debugging session)

- **GOTCHA — the pelvis defect: auto-rig sets pelvis too low, the head bows.** Tripo
  Rigging V1 put the pelvis at 0.485 of stature (anatomical 0.50–0.55; polyphemus
  measured 0.382), so banked walk clips retarget onto a too-long spine: Ulysses shipped
  with the head bowed 16.3–20.4° through the walk (rest pose leaned back 5.9°). The API
  exposes NO skeleton/pelvis hint (schema: model/animation/includeRiggedModel only), so
  the fix is **corrective rest rotations in the loader, BEFORE the mixer**: local-X
  counter-rotation baked into the clip's quaternion tracks — Spine02 +4°, NeckTwist01
  +5°, Head +6° (slerp is right-invariant, so per-key post-multiplication is exact) +
  zero the bind's back-lean (NeckTwist01 −3°, Head −3°). Result: standing −5.87° →
  +0.04°, walk 16.3–20.4° → 1.5–5.6°. Same constants worked for Polyphemus (walk
  16.4–20.5 → 1.4–5.6). Commit c38ef93; instrument tools/rigpitch.py. ASSUME EVERY
  V1 RIG NEEDS THIS and gate it.
- **GOTCHA — walk clips drive the skeleton below the bind-pose ground.** King demo fix:
  ground by a **24-sample clip sweep of foot-bone world Y**, with the bind sole height
  measured BEFORE the mixer exists.
- **GOTCHA — don't demand frontal metrics of a profile.** Instrument-artifact class that
  failed both king and ulysses S2 first runs: (a) top-18% hair band diluted by face skin
  in front view → use crown band, lum<150 non-skin (stylized hair carries a warm gloss
  highlight ~117 lum vs skin ~190); (b) orange lining demanded on the back where it is
  physically hidden → require lining only where the coat edge faces camera, back must be
  navy-dominant ≥ 0.8; (c) crimson area-dominance demanded of a strict profile where the
  chiton is edge-on and the near arm covers the torso BY THE PROMPT'S OWN LAW → dominance
  front/back, presence (≥0.06) profile. Garment identity across views is carried by
  color distance (dRGB ≤ 30), not area.
- **GOTCHA — a baked eyeball behaves physically.** The 2D profile art showed an amber
  disc only because the artist glanced the eye toward camera; in the BAKED 3D mesh the
  iris faces forward, so a strict profile shows a sclera bulge under the brow. That is
  correct, not drift — the mesh-stage instrument detects the orb structurally
  (scleraOrbPx 71 at the brow cluster), not by amber hue.
- **GOTCHA — the profile eye is the hardest image to get.** First polyphemus left view
  rendered sclera-only (no amber) — honest FAIL, regenerate; second had the head off
  strict 90°. The winning prompt made the eye "glance slightly toward the camera so a
  bold amber-gold disc shows on the forward line of the face" and named the exact color
  ("bright and saturated like polished amber, NOT dark brown, NOT shadowed").
- **GOTCHA — delivered mime ≠ requested**: gemini-3-pro-image returns `image/jpeg` even
  for `.png` filenames. Record `delivered_mime`; don't assume alpha.
- **GOTCHA — path staging**: the first demo walked Ulysses THROUGH the fire pit (path
  distance 0 at the ring-box corner). Thread the walk between the ledger's object boxes
  and assert ≥ 10 px clearance in the smoke, forever (commit c38ef93 defect 2).
- **GOTCHA — scale from the ledger, verified live**: px/m comes from the book ledger
  (43 px/m); assert the SKINNED bbox height in-page (301.0 px measured) rather than
  trusting the GLB's declared size (autoSize normalizes to ~1.0 bbox units).

---

## 4. DEAD-ENDS (with the evidence)

- **DEAD-END — hand-authored primitive-assembly characters at a low budget (code-King
  v1).** 45-node spec, `assembled-solid` ×38, zero `implicit`/SDF components,
  targetTriangles 5800 → 3,624 tris that "looks nothing like the creator's ~66k demo."
  Three compounding errors (king-tier-diagnosis.md): wrong TRACK (primitive stack vs
  implicit SDF → marching cubes — primitive shells can never converge to a smooth organic
  surface at any segment count), wrong TIER (low ≤6k vs medium ≤60k), and a mis-read
  register (the reference's PAINTERLY facets encoded as a GEOMETRY law, "never smooth it
  away"). If you author code characters: character contract = L0 head/torso/limbs MUST
  be implicit SDF → marching cubes; only isolates (eyes, teeth, cuffs) stay primitives.
- **DEAD-END (partial) — SDF from noisy point clouds needs the offset-surface trick.**
  The v2 rebuild (commit 4d2ff0c) dense-sampled king2-rigged.glb (1.4M points): the
  source meshes are OPEN SOUPS, so **ray-parity and point-normal sign estimates both
  "foam"** — the working construction was an offset-surface (crust) signed field with
  border flood-fill for sign, + palette/part/skin-weight voxel attributes (3³ mode
  filter). Result 77,802 tris, fidelity 3 OK/7 WATCH/4 MISS (vs 1/4/9), 16.7 ms frames —
  better, but an order of magnitude more effort than the photo-rig lane for a worse
  likeness. The photo-rig lane superseded this whole track for characters.
- **DEAD-END — sculpting likeness "by eye," and even instrument-armed micro-sculpting.**
  Headlab blind A/B/C: 8 unguided iterations barely moved the fidelity needle (A: 8 OK/5
  MISS → 5 OK/4 MISS; B REGRESSED 1 MISS → 3 MISS in one iteration; C's wins came from
  camera/framing as much as art — shape IoU stayed ~0.72–0.79 in every arm). Arm C's
  final was still owner-rejected with measured diseases: forehead 2× too tall
  (hairline_n 0.391 vs 0.194), face 20% too long (chin_n 0.909 vs 0.706), eyes a full
  eye-height low. The C2 "armed" rerun (MediaPipe landmark targets + probe.py + numeric
  intent before every edit) moved layout numbers reliably BUT: the probe's own chin
  metric was contaminated by skin-like collar px (chin_n stuck at 0.903 while the visual
  jaw was fixed — know your instrument's mask), and the loop still couldn't buy likeness
  cheaply. Meanwhile the photo-rig lane produced a better character in ~$3 and an hour.
  **Vision-in-the-loop verdict: instruments are necessary for regression-proofing, not
  sufficient for likeness; generate, don't sculpt.**
- **DEAD-END — Hunyuan as base-mesh generator.** Lane 8 head-to-head, same input/harness:
  Tripo wins likeness, limb separation (fingers vs mittens, arms vs arm-cape fusion),
  glTF hygiene (normals present, 1.8 MB vs 4.3 MB). Hunyuan = diversity fallback only.
- **DEAD-END — manual rigging tiers.** Mixamo/AccuRig GUI (3–10 min/char, ToS-gray
  automation) disqualified by the no-manual constraint; RigAnything (Adobe noncommercial
  license) dead; Anything World (post-insolvency, no quality evidence) rejected;
  runtime `SkeletonUtils.retargetClip` rejected as documented-fragile (three.js #25288,
  #25751). The banked-clip retarget INSIDE the Tripo rig job made all of this moot.
- **DEAD-END avoided — Make-It-Animatable fallback**: kept researched and ready
  (HF Space, MIT, Mixamo skeletons) but never needed across 5 rigged characters.

---

## 5. NON-BIPED + CHEAP-CAST VARIANTS

- **Quadruped (great ram)**: canonical art was a SIDE view → crop it AS the left view,
  generate the FRONT from it (i2i, "This image is the LEFT SIDE profile view … render
  strict FRONT view, standing square on all four legs"), same-gate on fleece/horn dRGB
  (7/9) + horns present both views → Tripo P1 mv → `triporig25.py --rig-type quadruped
  --animation quadruped:walk` → 19 bones. Flocks: instance the one rigged ram; big props
  (bowl 492 tris, stake 186 + ember material cycle, wineskin 348) are $0 pure code.
- **Stylize-skip (crew)**: when the canonical is already in the target register, skip S1
  and go straight to the turnaround prompts against the canonical.
- **rigType menu for future creatures**: quadruped, hexapod, octopod, avian, serpentine,
  aquatic — each with a banked walk/march clip retargetable in the same job.

---

## Evidence index
- Manifests: `assets/raw/{king,ulysses,polyphemus}-photorig/*/manifest.json`,
  `assets/raw/{crew,ram}-photorig/*/manifest.json`
- Tools: `tools/tripo3d_mv.py`, `tools/triporig.py`, `tools/triporig25.py`,
  `tools/nbpro_edit_mv.py`, `tools/polyeye_stats.py`, `tools/rigpitch.py`,
  `tools/polystance.py`, `tools/demo3d_smoke.mjs`, `tools/demo3d_pathaudit.mjs`,
  `tools/polyphemus_smoke.mjs`
- Diagnoses: `tools/ody/work/king-tier-diagnosis.md`, headlab
  `tools/ody/work/headlab/{scores.json,mapping.json,C2/AGENTS.md,C2/CHANGELOG.md}`
- Research: `.src-worktree/review/PIPELINE-RESEARCH.md`
- Posture/path commits (site-deploy git): c38ef93 (posture law + fire-front path),
  3e418ef, 6c1f791, plus 4d2ff0c / fc17a24 (code-King v2/v1)
