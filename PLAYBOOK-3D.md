# PLAYBOOK-3D — three weeks of interactive-book 3D, distilled

What this is: the operating manual mined from three weeks (2026-08-09..21) of
building interactive books — 2D painted plates and full-3D — with AI-generated
assets. Four mining passes over the manifests, passlogs, review rounds and
project memory produced `tools/ody/playbook-mine/*.md`; this file is their
distillation. Audience: a team member (or agent) who must produce GREAT 3D
assets TOMORROW without relearning our failures.

Every claim cites its incident. Numbers come from manifests and passlogs, not
memory. When this file and a miner disagree, the miner's number wins — then
file the correction here. The 2D living-book lane's companion of record is
`PIPELINE-LIVING.md`; this file is the 3D track.

Format inherited from the miners: **LAW** (never break), **RECIPE** (do
exactly this), **GOTCHA** (will bite you), **DEAD-END** (tried, measured,
rejected — catalogued in §6).

---

## 1. THE TEN LAWS

### LAW 1 — STYLIZE BEFORE RECONSTRUCT
Never feed a photo or photoreal portrait straight to 3D reconstruction. NB Pro
i2i the reference into a smooth game-avatar register FIRST; the mesh comes out
dramatically cleaner. INCIDENT: King photo-rig (2026-08-20) — the
stylize-first mesh was dramatically cleaner than the photo-direct Tripo mesh
from the original pipeline; the photo-direct lane was retired the same day.
COROLLARY: stylize-SKIP is legal when the source is already in the target
register — the crew/ram canonicals went straight to multiview and
reconstructed cleanly (tunic dRGB 13, fleece dRGB 7).

### LAW 2 — MULTIVIEW OVER SINGLE
Reconstruction eats a GATED TURNAROUND — front, left, back — with the left and
back generated FROM the accepted front as the ONLY reference. Never a single
image. This is what makes "same person" achievable and measurable: cross-view
garment dRGB ≤ 30 (measured: king coat 9.2, ulysses chiton 4.5, polyphemus
tunic 29.9 — that last one nearly failed; watch lighting drift). INCIDENT:
single-image photoreal Tripo WAS the original pipeline; stylize + multiview
superseded it on sight of the first King mesh. The profile eye took three
regenerations to earn (§2, S2) — a single image never even gets the chance.

### LAW 3 — ONE SCALE AUTHORITY
One module (`3d/app3d/world.js`) owns px→metres for every set — cave 43 px/m,
shore 11.3, sea 12.7, each derived from the ledger's own arithmetic — plus a
SIZE_TABLE with provenance and ±15% tolerance. The `[scale]` boot gate
measures the world-space bbox off the BUILT graph (after posture, fit,
grounding), never trusts a claimed scale factor, and PRINTS THE FULL INSTANCE
TABLE: expected, measured, delta, verdict, every instance. INCIDENT: a silent
scale error put a 0.56 m "ewe" and a 2.4 m "ram" in the same pen — hence the
printed table, so it cannot happen invisibly twice.

### LAW 4 — ONE RENDER PIPELINE (the demo IS the pipeline)
Every renderer value is lifted verbatim from the cave demo into ONE frozen
module (`render3d.js`): antialias, preserveDrawingBuffer, maxPixelRatio 2,
sRGB output, ACESFilmic @ exposure 1.38, PCFSoftShadowMap. No caller may set
a pipeline value itself; the smoke gate diffs the live renderer against
`RENDER_CONFIG` via `describeRenderer()`. INCIDENT: the plate-sandwich era
rendered with NoToneMapping (painted plates ship their own grade); once
nothing in the book was a painted plate, the filmic rolloff became the law
and the old pipeline was DELETED, not kept as an option.

### LAW 5 — LAWS DON'T PORT ACROSS MEDIUMS (the regrade incident)
A law proven on medium A is a hypothesis, not a law, on medium B. INCIDENT:
the regrade law was real and measured in its own medium — deterministic
Reinhard-lαβ transfer of a painted CUT toward the plate's ring palette closed
dE 20.3 → 6.7 mean (best case 20.6 → 4.9, dCCT 1050 → 20 K). Carried across
mediums — grading/softening 3D-RENDERED characters to "match the painting" —
it failed: the softening "frequently lowers opacity, producing translucent,
smoky figures rather than painted ones." The synthesis's phrasing:
**"regrade-after is exactly what reads as pasted."** Never let final character
pixels come from a different generation pass than the scene light.

### LAW 6 — NO COMPOSITE AT CLOSE RANGE
Close-ups are authored shots — the character rendered or painted INTO the
scene by the engine or the generator; composites survive only in wides, where
small characters hide the mismatch. INCIDENT: control case b3-36 matched the
plate to dE NOISE (dL −0.3, dW −4.2) **and still read pasted** — color was
never sufficient. Three external review rounds of the plate-sandwich ended:
"Bar verdict: No. The characters still read as softened 2D overlays placed
over a finished dimensional painting." The 7-lane research sweep: 5/6
independent lanes said close-up is the wrong ASSET CLASS. Shipped verdict:
hybrid by camera stop — authored shots for closes (~$2/chapter), composites
plus the $0 fixes (light wrap, shared grain, atmosphere sandwich) for wides.

### LAW 7 — PROMOTION, NOT ACCRETION
Prototype in a sandbox, prove with a probe, promote frozen signed-off
artifacts — and every promotion NAMES WHAT IT KILLS. INCIDENT (the palimpsest
diagnosis, verbatim): "The demo was crafted once, through gated passes, then
frozen — that's why it's great. The book was treated as a construction site…
when I ruled the SAM2 composite path dead, I closed the door but left the
product standing in the doorway." The rebuild (tasks 154–163) archived the
corpse honestly (`demo3d/sam2-experiment/`), extracted the one proven
pipeline, mounted one scale authority, and assembled the book from bar-passed
parts. The counter-example that worked: the SHOT mechanism, built on COPIES,
proven by `probe.mjs` (14 checks ALL GREEN), and only then promoted — with a
ratchet (`SHOT_PENDING`) retiring what it replaced.

### LAW 8 — GATES MEASURE THE RENDERED THING
Assert pixels and paint, never model state or anchors. INCIDENT 1: the stance
gate measured the sprite ANCHOR — reported 0.000 px drift while the rendered
pixel slid 12–13 px. Rebuilt optical. INCIDENT 2 (F17, the mask): the paint
layer ignored a CORRECT masked state for three review rounds — the King
rendered bare-faced four units before the gate. The 3D sibling:
`Box3.setFromObject` on a SkinnedMesh returns the BIND bounds (the skin
transform lives on the GPU) — a seated giant measures as a standing A-pose;
sweep `SkinnedMesh.getVertexPosition(i, v)` instead. And prove every gate
non-vacuous by deliberate regression: break the thing on purpose, watch the
gate go red, then trust its green.

### LAW 9 — EVERY FIX SHIPS WITH ITS GATE
A fix without its own lap assertion is a claim, not a fix. INCIDENT (Fable
full-book review round 1, 2026-08-13): 14 defects, 8 MAJOR — three of them
CLAIMED FIXED by a previous lane whose lap was clean, and never actually
fixed (F7 ring-push never wired, F9 Watson still painted, F10 heading at ~2%
luminance). The claims carried no assertions, so nothing had verified them.
Under the law, round 2 shipped all 14 per-fix assertions present AND green in
a 180.7 s lap, 95/95 units — ACCEPTED. Convergence went from claimed-fixed
regressions to one round.

### LAW 10 — THE EYE OUTRANKS THE INSTRUMENT
The authority ladder, codified in BAR-3D §6: **owner's eye > supervisor's eye
> every instrument.** "Lap clean" is not sign-off. INCIDENT (round 4): round 3
had exempted lamp2's column because the front cut drew a parked rig
"physically correctly" behind the post; the owner's eye rejected the
exemption — "a 'physically correct' defect is still a defect wearing an
explanation." A dwell that reads broken is broken, whichever layer wins the
paint order. The fix became a class law: no rig settles on ANY post column at
ANY dwell, gated at 11 settles.

---

## 2. CHARACTERS — THE FIVE-STAGE PHOTO-RIG

The chain: reference → stylized turnaround → Tripo multiview mesh → Tripo
rig → gated demo page. Zero manual DCC, zero Blender. Wall time under an hour
per character once the gates exist. Cost **~$1.50/character averaged across
the cast** (hero runs ~$3.00 including all rejects — Polyphemus: 215 Scenario
CU + 6 NB Pro images; crew pair $1.93; ram $1.69). Multiview mesh ~75 CU;
each rig/clip job ~70 CU. Three shipped characters (King 6c1267f, Polyphemus
6c1f791, cast 5ae846b) all smoke-PASS live with this exact chain.

### RECIPE S1 — Stylize the front view (identity + pose canonicalization)
- Tool `tools/nbpro_edit_mv.py` (multi-image i2i). Model chain, fallback
  order: **`gemini-3-pro-image`, `nano-banana-pro-preview`,
  `gemini-3.1-flash-image`**; endpoint `v1beta generateContent`,
  `responseModalities: ["TEXT","IMAGE"]`, contents `[inlineData x2, text]`.
- Inputs: TWO references of the SAME character — full-body look reference +
  face portrait. Both inline.
- The prompt template is load-bearing (evolved over three runs; reuse
  verbatim, swap identity/costume clauses):
  - "FULL BODY, strict FRONT orthographic view, standing in a symmetric
    **A-pose (arms straight and held out about 40 degrees from the body,
    palms toward thighs, legs straight and slightly apart)**, facing the
    camera directly, head level."
  - Register clause: "polished stylized 3D game avatar render — smooth
    rounded surfaces, soft gradient shading … **Absolutely NOT low-poly: no
    facets, no flat triangular planes, no paper-cut edges.**"
  - Identity clause from the portrait (explicit features); costume clause
    with COLOR NAMES IN CAPS (Prussian-blue / CRIMSON / OLIVE-GREEN — the
    caps survive drift).
  - Visibility clause: garments "must hang symmetrically so both arms and
    both legs stay fully visible and unobstructed."
  - Framing: centered, margin above head and below feet, **plain flat solid
    dark-navy studio background**, soft even lighting, no floor shadow, no
    text, no props.
- Generate **2 candidates**, gate `stylize-identity`, accept ONE as
  `front-accepted.png`.
- A non-human defining feature is "THE DEFINING FEATURE, NON-NEGOTIABLE" with
  negations: Polyphemus = "exactly ONE SINGLE ENORMOUS EYE centered in the
  middle of his forehead … NO second eye, NO pair of eyes, NO empty eye
  sockets." Held in both candidates (amberBlobs=1, midline −0.005/+0.014).

### RECIPE S2 — Turnaround with the accepted front as the ONLY reference
- Same tool, ONE input (`front-accepted.png`). "Render THE SAME character in
  the SAME polished smooth 3D game-avatar style: strict LEFT PROFILE / strict
  BACK view" — restating identity, costume, palette, framing PER VIEW (what
  is physically visible from that angle: "No face visible" on the back).
- Gate `same-person-turnaround`. Regenerate individual views on HONEST
  failure: Polyphemus needed 3 left-profile attempts before the amber iris
  read in profile. The winning profile prompt made the eye "glance slightly
  toward the camera so a bold amber-gold disc shows on the forward line of
  the face" and named the exact color ("bright and saturated like polished
  amber, NOT dark brown, NOT shadowed").

### RECIPE S3 — Reconstruct: Tripo P1 multiview via Scenario
- Tool `tools/tripo3d_mv.py`. Model **`model_tripo-p1-multiview-to-3d`**
  (catalog-verified 2026-08-20; newer than v3-1).
- Call: upload front/left/back(/right) as assets → `POST
  /v1/generate/custom/model_tripo-p1-multiview-to-3d` with `{frontImage,
  leftImage, backImage, texture: true, textureQuality: "standard",
  textureAlignment: "original_image", orientation: "align_image", pbr: false,
  autoSize: true, seed, textureSeed}` → poll `GET /v1/jobs/{id}` every 15 s
  (timeout 2400 s) → download IMMEDIATELY (vendor URLs die in ~5 min) →
  `verify_glb` → thumbnail.
- **Seeds are required args** (Polyphemus 77001/77002) — determinism lives in
  cached artifacts + manifests, not regeneration. faceLimit 48..20000,
  adaptive if unset. Shipped: king 16,937 tris; ulysses 17,032; polyphemus
  4,822. All: 1 mesh, 1 material, 1 texture.

### RECIPE S4 — Rig + retarget banked clips (the preset table)

| track | tool | model | presets | output |
|---|---|---|---|---|
| BIPED | `tools/triporig.py` | `model_tripo-rigging-v1` | `preset:biped:walk` (1.9–2.375 s, 126 channels), `preset:biped:idle` (15.375 s); run/jump/hurt also banked | 41 joints, 1 skin, twist bones, `L_`/`R_` naming |
| QUADRUPED+ | `tools/triporig25.py` | `model_tripo-rigging-v2-5` | rigType `quadruped \| hexapod \| octopod \| avian \| serpentine \| aquatic`; animations `quadruped:walk`, `hexapod:walk`, `octopod:walk`, `serpentine:march`, `aquatic:march` | great ram: 19 bones, 5,201 tris |

- **LAW: v2-5 is quadruped+ ONLY. Rigging V1 is the biped track.** (The
  triporig.py docstring says it plainly: "wrong for a humanoid.")
- **LAW: reuse the reconstruction job's OWN output asset id**
  (`--model-asset`) — 3d23d models accept it as `model`; no re-upload.
- Inputs to V1 are ONLY `{model, animation, includeRiggedModel}` — **no
  skeleton or pelvis hints exist.** This is why the posture fix (below) lives
  in the loader, not in re-rigging.
- Two retarget jobs in PARALLEL against the same mesh asset id work fine
  (70 CU each). Walk+idle on ONE model: load both retarget GLBs, play the
  idle clip's tracks on the walk model's mixer — same rig, node names bind.

### RECIPE S5 — Demo page + headless smoke + ship
Three.js page loads the rigged GLB, drives the banked clip through
AnimationMixer, staged on the book's plate (plate-space orthographic camera,
ledger scale: Ulysses 75 px = 1.75 m at 43 px/m; Polyphemus 301 px = 7 m,
read LIVE off the skinned bbox). Headless smoke, ALL must pass: zero console
errors; mesh+stats loaded; mixer time advances; a NAMED bone world-position
moves (king: L_Thigh delta 0.036); actor X advances; phase monotonic; scale
assert (301.0 vs 301); path audit — zero intersections with every ledger
object box, fire-ring clearance ≥ 10 px (measured min 10.67), actor passes
IN FRONT of the fire (occluder z-swap 85 → 5); idle-hold assert (clip == idle
at the seat, X frozen while mixer advances, resumes walk). Ship only on PASS.

### THE GATE THRESHOLDS (per stage)

- **S1 `stylize-identity`**: dominant garment fraction ≥ 0.20 over foreground
  px; accent present ≥ 0.02; skin present; bbox heights within 15%; TRUE 40°
  A-pose (arm-at-torso = reject — "reconstruction fuse risk" killed ulysses
  cand1 and polyphemus cand2); register check (anti-low-poly is a CRITERION);
  identity is the tiebreak vs the canonical portrait. Species features
  instrumented (`tools/polyeye_stats.py`: exactly ONE amber blob, midline
  |off| ≤ 0.05).
- **S2 `same-person-turnaround`**: garment DOMINANT front+back (≥ 0.20),
  PRESENT on profile (≥ 0.06) — never demand area-dominance of an edge-on
  garment; **cross-view dRGB max ≤ 30** (the real same-garment check); accent
  present only where physically visible (king back: orange 0.0001 is CORRECT
  — navy ≥ 0.8 instead); hair via crown band, lum<150 non-skin ≥ 0.6; skin
  ≥ 0.05 all views; bbox within 15%.
- **Identity ±20**: downstream cuts and strip cells gate their identity
  cluster within ±20 of the SEALED canonical (`strips.json` registry,
  `strip_slice_gate.py`) — a number decides, not an eyeball.
- **S3 `reconstruct-mesh`**: `verify_glb`; turntable front/left/back/right
  foreground-coverage ratio maxOverMin sane (observed 1.5/1.51/1.71 all
  PASS — a hole or collapsed side blows it up); species instrument re-run on
  turntable renders with `--gain 1.3` (turntable renders sit ~1.3× dimmer;
  gain documented, thresholds unchanged).
- **S4 posture** (`tools/rigpitch.py`): standing head pitch within **±5° of
  upright; walk-cycle max ≤ 12°**. Character-stance amendment: re-anchor to
  the canonical's own measured stance (`tools/polystance.py`; Polyphemus
  0.75°): |standing − stance| ≤ 8 (measured 3.56), |clip − stance| ≤ 12
  (walk 4.82, idle 5.32). Posture is character — the hunch lives in the MESH,
  not in a bowed head; the gate encodes the character sheet, not a generic
  upright ideal.
- **S5 scale** — the SIZE_TABLE with provenance, tolerance ±15%: human
  1.75 m, giant 7.00 (seated factor 165/300 off the ledger's silhouettes),
  goat 0.90, sheep 1.00, great ram 1.40, stake 1.79, bowl 1.40, wineskin
  0.98, sword 0.78. Axis per kind: bipeds/quadrupeds by HEIGHT, beams/hulls
  by LENGTH.

### RECIPE — the pelvis/posture fix (assume EVERY V1 rig needs it)
Tripo Rigging V1 sets the pelvis too low (0.485 of stature vs anatomical
0.50–0.55; polyphemus measured 0.382), so banked walks retarget onto a
too-long spine: Ulysses shipped with the head bowed 16.3–20.4° through the
walk. No API hint exists, so fix **in the loader, BEFORE the mixer**:
1. Bake a local-X counter-rotation into the clip's quaternion tracks per key
   — slerp is right-invariant, so per-key post-multiplication is EXACT.
   Shared `CLIP_CORR {Spine02: +4°, NeckTwist01: +5°, Head: +6°}`.
2. Zero the bind's back-lean on node rotations (NeckTwist01 −3°, Head −3°).
Result: standing −5.87° → +0.04°; walk 16.3–20.4° → 1.5–5.6°. The SAME
constants held for Polyphemus (16.4–20.5 → 1.4–5.6) and crew/ram — three
times. Commit c38ef93; instrument `tools/rigpitch.py`. SUB-GOTCHA:
`rigpitch --corr` applies corr to REST too — tune off the WALK numbers only.

### RECIPE — grounding (two escalations)
- v1: retargeted clips drive the skeleton BELOW the bind-pose ground (the
  King sank to mid-thigh). Ground by a **24-sample clip sweep of foot-bone
  world Y**; measure the bind sole BEFORE the mixer exists —
  `mixer.setTime(0)` already applies clip frame 0, not the bind pose.
- v2 (MESH-accurate): a quadruped's hoof MESH hangs below its last limb
  JOINT — the joint sweep left the ram FLOATING. Sweep the SKINNED VERTICES:
  `SkinnedMesh.getVertexPosition(i, v)` at 24 clip times, lift by the min.

### GOTCHAS (each cost a session)
- **THREE sanitizes `::` out of node names**: `tripo::Head_2` becomes
  `tripoHead_2` in PropertyBinding — bind the sanitized name or nothing
  animates.
- **Delivered mime ≠ requested**: gemini-3-pro-image returns `image/jpeg`
  even for `.png` filenames. Record `delivered_mime`; don't assume alpha.
- **Instrument artifact vs art artifact**: both king and ulysses S2 first
  runs FAILED on instrument artifacts (frontal metrics demanded of a
  profile; a top-18% hair band diluted by face skin). Refine the instrument
  and document why — don't condemn the asset. Polyphemus's sclera-only
  profile was an HONEST fail — regenerate. Decide which, in writing, every
  time.
- **A baked eyeball behaves physically**: the 2D profile showed an amber disc
  only because the artist glanced the eye toward camera; the 3D mesh's iris
  faces forward, so a strict profile shows a sclera bulge. Correct, not
  drift — detect the orb STRUCTURALLY (scleraOrbPx 71 at the brow cluster),
  not by hue.

### VARIANTS — quadruped, cheap cast, $0 multiplication
- **Quadruped (great ram)**: canonical art was a SIDE view → crop it AS the
  left view, generate the FRONT from it, same-person gate on fleece/horn
  dRGB (7/9) → Tripo P1 mv → `triporig25.py --rig-type quadruped --animation
  quadruped:walk`.
- **$0 tricks**: slate elder = HSL tint on the crew rig; flock = the ram rig
  at the ewes' 24 px stock height; props pure code (kylix bowl 492 tris,
  ember-stake 186 with material-state glow + PointLight 16 s cycle, wineskin
  348). Per-member `grade` albedo multiplier in the cast registry — INCIDENT:
  near-white fleece went BLUE under the night hemi fill; grade
  [1.30, 1.10, 0.82] fixed it, smoke asserts slate warm-mass → 0.
- **Manifest everything**: sha256 + bytes + model id + full prompt + params +
  jobId + assetId + gate stats + verdicts, in
  `assets/raw/<lane>/<UTC>/manifest.json`. Raw-first, always.

### DEAD ENDS (full evidence in §6)
- Single-image photoreal Tripo — superseded by stylize + multiview (F-1).
- SDF from noisy point clouds — ray-parity and point-normal signs both
  "foam"; even the working crust rebuild lost to a $3 photo-rig (F-3).
- Low-poly-register briefs on realistic targets — the code-King misread the
  reference's PAINTERLY facets as a geometry law (F-2).
- Sculpting likeness by eye, even instrument-armed (F-4). Hunyuan as base
  mesh (F-5). Manual rigging tiers (F-6).

---

## 3. SETS & WORLDS

### RECIPE — staged passes, each gated against the plate through the REAL page
The pipeline that produced every accepted set (img2threejs order; sea and
shore passlogs): **PASS 0 spec → 1 blockout → 2 structure → 3 form →
4 material → 5 lighting → 6 final gates.** Non-negotiables, learned by
shipping it twice:
- **Pass 0 is a numeric plate read, not a look.** Probe plate px→metres
  through the ledger's own frame BEFORE any code (sea pass 0: water diamond
  corners W(240,435)…E(1130,505) → 51 m side rotated 49°; brow plateau
  27.5 m cross-checked at 350 px; palette hex-sampled and authored to read
  through ACES 1.42). Spec of record = strict-quality-PASS sculpt spec
  (shore: 36 components / 22 materials).
- **Render every pass through the real page** — the book framing, the book's
  ACES exposure, never a private viewer. The grade IS part of the geometry
  judgment.
- **Each pass gate** = named similarity judgment vs the plate + console
  clean, ending in ONE decision: `continue | refine-code | refine-spec`.
  In-pass corrections counted and bounded: 3 per pass, 6 total — a hard
  stop, not a suggestion.
- **Name the debts you defer** (water placeholder until form; palette until
  material; blow-outs until lighting). A deferred debt with a name is a
  plan; an unnamed one is the blockout-survivor defect.
- **THE PASS LOG IS THE PROOF.** BAR-3D §2: "a set without its log is an
  automatic fail." INCIDENT that justifies the whole recipe: both shipped v1
  sets "stopped at blockout quality — the owner caught it on sight"
  (scattered white quads, unsculpted icosahedron blobs, sparse dressing).
  The rebuild logs exist because one-shotting failed.

### RECIPE — the final gate battery (what "done" means)
- **Smoke, ALL 12 CLEAN**: zero console/page errors; determinism
  byte-identical replay (`sample(7.31)` after `sample(20.77)`); posture law
  0.04° standing / 5.64° max walk; obstacle law (241 samples clear every
  ledger box +10 px); triangle budget (shore 19,732 / sea 8,859 of the
  60,000 page ceiling); day/night swap round-trips; frame avg ~16.5 ms.
- **Turntable 0/90/180/270 — no holes.** Catches inside-out winding and
  view-dependent fakes; one viewpoint is not evidence (a hole through a
  skull once survived eight front-only rounds).
- **Story battery**: the WHOLE chapter (81 units, 8 gates, 8 facts) walks on
  the rebuilt set with the public contract FROZEN (`SEA_WORLD`/`SHORE_WORLD`
  exports, marks, obstacles, sockets, `splashAt`). A set rebuild must never
  cost the story lane a line — carry the survey, not the craft.
- **compare.jpg**: plate | render, same 1408×768 framing, with an HONEST
  verdict — state what the painting still keeps ("hand-cut facets coarser
  and more considered… that gap is the medium's, stated — not a blockout
  gap"). Report the honest residual every round; over-claiming destroys the
  ability to debug the process.

### THE WATER LAW (the numbers)
- **One world-space plane**, swell displaced in the vertex shader
  (flatShading derivatives relight facets for free), per-face attributes for
  band/spark/foam/glow, and `totalEmissiveRadiance += diffuseColor.rgb *
  0.26` as the painted floor — **plate water is never true black**. Wine-dark
  base runs with −Z toward the moon's horizon, NOT with |x − moonX|
  (measured: #204571 at py 300 → #101f41 downstage).
- **The band is MEASURED, narrow, and dies early.** Sea plate, 6 px row
  scans: half-width 3.19 m at the head, 5.16 m amidships, 1.14 m at py 502,
  DEAD by Z +7. Round 1's authored law (15 m at the moon end, shards to
  17 m) WAS the confetti sprawl. Shore: band axis (0.0795, 0.9968) — nearly
  straight downstage where the build had guessed a diagonal; FWHM 100 px;
  luminance profile peak 0.598, floor 0.17. Encode the measured envelope as
  knots (`ramp()`), ONE source of truth shared by mesh and shader.
- **Sparkle is three parts, never a dither**: (1) shard gate on a coherent
  cell (`step(gate, 0.10 + 0.84·soft)`, off-shards 0.055); (2) per-facet
  twinkle `0.66 + 0.34·sin(t·(0.55..2.25) + seed)` — each sliver breathes,
  the band never blinks off (whole-quad 0→100% gating through ACES =
  confetti, the named failure); (3) isolated glints on a jittered seeded
  cell — 1.15 m cells, 32% occupancy, ~3 px specks, own periods.
- **The haze diagnosis** (why shore r3 failed): 0.1% of band pixels above
  L 0.88 vs the plate's 21.7%; band luminance sigma 0.111 vs plate 0.179 — a
  0.29 m speckle at 48% occupancy is a 3 px dither at 11.3 px/m. After the
  three-part law: 6.9% near-white, sigma 0.144, p95/p99 0.885/0.949.
- **Facet size matches the PLATE's shards, including anisotropy**: bold
  2–4 m facets (1.5 m cells read as sequins); the shore plate paints SLIVERS
  ~7.3 m across × 1.9 m deep → deliberately anisotropic grid
  (`PlaneGeometry(52, 96, 8, 44)` = 6.5 × 2.18 m cells), plan-jittered on
  the INDEXED grid so shared corners move together, crack-free. Moonpath =
  2.6 m QUANTISED-hash patches — per-face dither reads as sequins.
- **GOTCHA**: subdividing through the band dissolves the painted shards
  (shore r3's 0.5 m refinements = the haze). Dice at the facet grid's own
  size = per-facet confetti in the tail — ramp the gate OPEN continuously
  (`smoothstep(s, 0.42, 0.85)`), dim by `1 − 0.5·tail`, and cap `open` at
  0.72 or the core welds into one clipped white blob (stern-window blobs:
  plate 29, r3 52, r4 38).

### EXPOSURE — closed by HISTOGRAM, not by eye
- Measure BOTH compare halves resampled to the same 1408×768. The sea
  "several stops darker" round closed on: value mean 30.8 | 23.0 | 31.8
  (plate | before | after); median 18.1 | 12.5 | 18.0; population L 0–25:
  60.7% | 81.8% | 61.3%. Per-region mid-tones (cliff 49.8 | 37.7 | 52.1) AND
  what must NOT move (far-sky floor 11.6 | 10.7 | 10.7). "Not one knob": the
  fix was three separate causes. Three-column tables are the house evidence
  format.
- **Sample corners, never near the feature.** Round 2 read the far-sky floor
  as L~30 from inside the moon's wash; the corners are L 11.6. That one bad
  datum built the halo 2.5× too small and hid the largest exposure term for
  two rounds.
- **Probe plate pixels before judging tone.** The eye said "pale grey
  cliff"; the probe said RGB (68,59,64) — the render was 2× too bright and
  blue. Every material round starts with sampled plate modes written into
  the module header; under a colored night rig those are TARGETS, not
  albedos.
- Instruments made permanent with the round: `sea_expose.py`, `sea_band.py`,
  `shore_compare.py` — so a later round cannot silently regress an earlier
  one.

### LIGHT + MATERIAL recipes
- **The plate is a LIT RENDER: bake the painter's light, keep the live rig
  weak.** Per-facet lit/dark as VERTEX COLOR by facet-normal · painter-key
  direction (sea key almost due WEST and LOW: `litDir [−0.97, 0.22, 0.06]`,
  gamma 2.3) + `eastDark` + warm practical washes by lambert × range, never
  distance alone. Light the set from where the PAINTER lit it, not where the
  prop moon sits. Live rig: key 1.4–1.62, hemi 0.95–1.0.
- **ONE shadow caster (the blaze)**: 1024 cube, near 0.3, far 40, bias
  −0.004. A set DECLARES its caster via `configureShadowCaster()`; fills are
  unshadowed by design.
- **Hue, not intensity, under a colored key**: green-dominant albedo goes
  NAVY under a blue night key (every plate meadow mode is olive, R ≥ G);
  near-black `coolDark` + steep gamma leaves half-turned facets to a
  saturated navy hemi that repaints warm sandstone cold — lift the dark end
  AND desaturate the fill.
- **A destination needs a LOCAL key, not a global lift**: no-shadow
  PointLight at the destination (`#c8cfdc`, 430, range 92, decay 2) — 9×
  falloff does the discrimination (yard terrace L .098 → .240 vs plate
  .276) while the strait keeps its dark. Off in the dawn preset.
- **Fire blow-out**: reduce intensity + deepen the color, let ACES roll it
  off — 620 → 440 at deeper amber #ffad42, bounce 160 → 115. Smoke plumes:
  ring radius `0.6 + 1.2·rise + 2.2·rise²`, deterministic, not particle
  streaks.
- **Particles are pure GPU functions**: 3 ShaderMaterial Points systems (120
  embers / 50 smoke / 140 dust), ALL flight in the vertex shader as pure
  f(uTime=simT, baked mulberry32 seeds) — zero CPU per frame, one draw call
  each. Everything is pure f(seed, simT); the smoke gate proves determinism
  byte-identically. Day/dawn is a LIGHT-RIG SWAP, geometry untouched.
- **GOTCHA — additive billboard vs ORTHO depth**: a halo sprite big enough
  to carry a painted sky wash sits NEARER than upstage geometry (moon
  z −11.8 vs water z −30) and bleaches it — 3,436 blown px vs the plate's
  1,349. **renderOrder does not save it** (sprites draw in the transparent
  pass after every opaque solid). Put the wash on the SKY DOME as a
  per-fragment term; under ortho, screen distance = world distance
  perpendicular to the view axis — read the axis from the third row of
  `viewMatrix`, correct under orbit at any pixel scale.

### GEOMETRY craft
- **The hole-killer**: ONE closed sculpted mass — the island is one
  icosphere whose top hemisphere maps to a ZONED heightfield (camp flat
  EXACTLY y=0; strait channel −1.7; yard terrace exactly 1.35 — story
  terraces are exact, "the pen law") and whose bottom maps to the faceted
  keel; water is a facet plane CLIPPED inside the island outline, meeting
  terrain under the rim BY CONSTRUCTION. No skirts, no slabs, no seams.
- **Inside-out winding**: the "cliff" you see is the culled INTERIOR — black
  faces + mottling through the silhouette. Check winding FIRST when a
  custom-grid mass renders dark/hollow; the turntable catches it at 90/180.
- **Crack-free jitter**: hash the QUANTISED vertex position
  (`hash3(round(x·97), …)`), never the vertex index, so shared positions —
  even across duplicated non-indexed verts — move together.
- **The register kit** (createCaveScene.js IS the craft bar): painterly
  facets = per-FACE value jitter as vertex colors on non-indexed geometry
  (±10%); cutaways = face DELETION by centroid predicate, never a boolean;
  dressing density via instanced systems, counted against the plate's own
  census (27 olive bushes, 8 cluster trees, 15 boulders). Sculpt to the
  plate's defining silhouettes with numbers (stem/stern spirals 1.55π sweep;
  crag tufts solved onto the spire's own cone surface — coverage
  0.1% → 5.6%).

### THE SCALE-AUTHORITY BOOT GATE (LAW 3, operationalized)
Frame from the ledger's own arithmetic: cave 43 px/m (off the penned ewes),
shore 11.3, sea 12.7; elevation from the plate's own ellipse (fire-ring
paints 82/206 px → 25°; shore 28°; sea 30°); `X(px)=(px−704)/S`,
`Z(py)=(py−460)/(S·sinE)`. The floor plan is the ledger; the walkable floor
is y = 0 EXACTLY. Marks/paths/obstacles survive any rebuild verbatim. The
`[scale]` gate measures the BUILT graph's bbox (skinned vertices for
SkinnedMeshes — LAW 8) and prints every instance's expected/measured/delta/
verdict.

### THE BAR LOOP — convergence data
The reviewer names measured defects; the implementor fixes ONLY those,
against a FRESH measurement of the plate:
1. Measure the plate first, in plate pixels (sea W1: 6 px row scan at
   luma>95 → the band envelope; shore W1: PCA on the cool-water mask → the
   band axis).
2. Fix to the measured envelope, one source of truth shared by mesh and
   shader.
3. Add a PERMANENT instrument with the round (regression guard).
4. Report plate | before | after.
**Sea converged in 4 rounds; shore in 4** against BAR-3D. The sea's shore/sea
loop rounds: pass-1 sequins → measured band → sparkle law → global exposure
closed by histogram. If round 3 still fails the bar, question the
architecture, not the polish (§5).

---

## 4. ANIMATION & PRESENTATION

### RECIPE — banked clips + retarget, never runtime retargeting
All motion is banked clips retargeted INSIDE the Tripo rig job
(`preset:biped:walk/idle`, quadruped:walk, …) — runtime
`SkeletonUtils.retargetClip` was rejected as documented-fragile (three.js
#25288, #25751) and never needed across 5 rigged characters. Pose bridges
for video: Seedance conditioned on first=pose A, last=pose B — the video IS
the action between approved keyframes (endpoint match ≤ 15%, monotone
progress; 10/10 shipped). Loop variant: first+last-frame trick = closure by
construction; loop-closure gate ≤ 12%.

### THE MOTION LAWS (thresholds, each with its incident)

| law | threshold | incident |
|---|---|---|
| Posture | standing ±5° of upright; walk max ≤ 12°; stance-amended ±8 vs the canonical's measured lean | Ulysses head bowed 16.3–20.4° (pelvis defect, §2) |
| Anti-skate | planted foot ≤ 2.5 css px/frame (measured 0.45 on shipped loops) | King retune killed 216–550 px/s opening sprints |
| Gait | velocity std/mean ≥ 0.15; no single-frame speed change > 25%; plant dips 38%, cadence attenuation above ~1.1 cyc/s | seamless round: constant-velocity translation reads as ghost-glide |
| Teleport | per-tick centre ≤ 3.5 px + ZERO bare art swaps, at EVERY animation-state handoff | Sol found ONE 1-frame snap; the law covers all 8,844 tick-pairs — "every handoff is a defect site" |
| Strip-luma | adjacent-cell luma swing ≤ 4 | the falling giant FLASHED at 13.6 (Seedance exposure pumping); deflicker.py ramp-normalizes between gated endpoints |
| Grounding | clip-sweep min foot Y (joints), skinned-vertex sweep (meshes) | the King sank to mid-thigh; the ram floated |
| Honest failure | ship the honest asset, not the pretty liar | crew-row kept 4 frames because 10-frame cycles failed gates |

### RECIPE — the storyteller camera (the directors-cut)
- **A shot table without a cut pattern is postcards, not cinema.** INCIDENT
  (DIRECTORS-BOOK §0): "Beat 1 = 13 units at 13 distinct camera setups. A
  scene in which every angle is used exactly once has no coverage. It has
  postcards." The fix is a small setup vocabulary per scene, established
  then ALTERNATED.
- **The coverage grammar, gated in bake + lap**: (1) the angle CHANGES
  between consecutive units unless a hold is declared (a hold = the same
  shot still running); (2) establish ONCE per scene — a changed world
  re-establishes on a NEW setup, a returning master declares a `reprise`
  reason; (3) the vocabulary RECURS — ≥¼ of a scene's cuts return to a known
  setup. Final numbers across 6 scenes / 81 units: **56 setups · 73 cuts ·
  2 holds (both with written reasons) · 23 returns · 5 dissolves (all of
  them time passing)** — all machine-readable in `shots3d.json`.
- **Shot classes: distance is NEVER chosen by taste.**
  `d = h / (2·frac·tan(fov/2))` — frac is declared, the class floor is the
  minimum: DIALOGUE 0.30 · OTS 0.30 · GIANT floor 0.42, cap 0.96, crownPitch
  ≥ 21° ("the lens is below him") · NARRATION 0.20 · ACTION 0.17 · GATE 0.22
  · CLOCK 0.18 · WIDE 0.045 (one per beat, at the heading) · POV floor 0.
  Height is meaning: humans at 1.55–1.7 m; the cave's escalation rungs run
  camY 1.55 → 1.25 → 0.95 and dist 7.69 → 6.67 → 5.45 m — lower and nearer
  every beat. Axis law gated on 41 pinned rows: giant frames RIGHT, men
  LEFT; at sea, island RIGHT, ship LEFT.
- **THE READABILITY LAW**: a dramatic frame that hides the action is a
  defect, not a style. Measured on the drawn pixels inside the subject's
  projected box, all 81 shots: p90 ≥ 0.30, mean ≥ 0.10, separation ≥ 0.05
  from a ring around it, near-black cap. Threat ratio the lens's way: pull
  the FILL, never close the key. Shots dominated by blaze are printed down
  (dof.expo 0.86–0.90).
- **DP prescriptions worth stealing verbatim** (Sol's r1): shoot the face
  that sees before the thing that is seen; the same horror twice = cover the
  second as REACTION; scale is spatial evidence — the giant reads giant only
  with a known body at his feet (`fg: ulysses`, `scaleRefOk` ratio < 0.72);
  racks are reveals — name both depths and when focus travels; handheld is
  an EVENT (locked-with-breath until contact); departure needs screen
  direction + wake + shrinking island or the ship reads parked.
- **Choose ONE director lens and write down what the runners-up would have
  cost.** Spielberg won because "its editing default IS coverage"; the
  runners-up carry disqualifying quotes; the lens's forbidden list was
  reconciled item by item with declared exceptions.
- **GOTCHA — transitions must be invisible to measurement**: dissolves play
  on the composited frame from a history target and are FORCED OFF while
  any gate reads pixels — "a measurement must never be taken of a frame
  that is half of two shots."

### LAW — judge motion on VIDEO, never stills
Sampled-still review structurally misses continuous-motion defects. INCIDENT
(seamless round): the owner saw "drifting/floating, placement wrong, audio
just noise" — motion had shipped with still-frame review only, audio with
ZERO ear review. The meta-law: **instruments must cover what the review eye
cannot reach** — velocity profiles for motion, spectral gates for sound
(beds ~−33 LUFS, cues −18, TP ≤ −1 dBTP, SFM ≤ 0.3, duck ≥ 6 dB). Practical:
Sol takes mp4 via `-i`; RESOLVE THE GATES before capturing motion for review
(unresolved dwells read as static — 2 false positives cost a round-trip);
settle shots hide dwell and mid-travel bugs — step every travel at 4 fps
through the reader's own harness (`_crossingprobe.mjs`); review EVERY scene,
not just the evidence frames.

### PRESENTATION laws that survived every round
- Close-up floors by class: character close ≥ 30% of panel height, two-shot
  ≥ 22%, wides ≤ 2/beat (46 gated settles, worst margin 21.9/22). k 8–14
  closes on 11–13 px/m sets look GOOD — the plate blurs painterly while
  600+ px cuts stay crisp. Never close on a mid-walk principal (high k
  magnifies plant glide).
- Zoom cap where no authored shot exists: k ≤ 2.5; shot crossfade 250 ms on
  the sim clock, byte-equal laps.
- One art register per frame (F4, "two Nortons, two worlds") — register
  consistency is JUDGED, not mechanical: a low-poly gown under a painted
  face was accepted as the book's cameo-card iconography.
- The blob law: > 4 concurrent `<video>` elements = Chromium self-aborts one
  (net::ERR_ABORTED, no code at fault). ONE owner for all video bytes;
  `vid.src` + later `load()` = self-aborting fetch — one load, ready-promise
  at birth.
- Registries drift; re-audit them each round (ledger lenses HAD drifted from
  sets — re-recorded, 47 lenses). `units.js` is EMITTED — extend the
  emitter, never hand-edit the artifact.

---

## 5. THE PROCESS

### THE LOOP — Fable supervises/reviews, Opus implements, Sol external-eyes
- **Write THE BAR before the work**, as a document with named roles and
  named failure classes (`tools/ody/BAR-3D.md`, first line: "supervisor/
  reviewer: Fable 5; implementors: Opus 5"). "Square white confetti" is a
  named failure; "a set without its pass log is an automatic fail"; "lap
  clean is not sign-off." A bar that exists only in the reviewer's head
  cannot converge a multi-agent loop; a bar on disk makes every round
  adjudicable.
- **Named defects with stable IDs, carried across rounds as a ratchet**:
  F1–F17, E1–E5, W-series, O.1–O.14, Sol's #1–#8. A defect keeps its number
  until its gate exists and is green; the lap file ACCRETES the gates.
  SHOT_PENDING (26 rows) is the same mechanism as a forward ratchet.
- **Rounds until zero majors, every fix with its gate** (LAW 9). Fix the
  CLASS, not the instance (LAW 10's lamp; the teleport law over all 8,844
  tick-pairs). Every fix round can REGRESS an earlier fix — the arrival
  "polish" introduced a 64 px snap found only by re-review of the seam
  class. Waivers are logged, numbered, and carry written reasons (9 standing
  waivers in SIGNOFF.md) — a waiver without a reason is how "physically
  correct" defects survive.
- **Independent verification per round**: a second agent with its OWN
  instruments, never the implementor's probes; gates proved non-vacuous by
  deliberate regression.
- **Convergence, measured**: first build 7 rounds to SIGNOFF; 2 rounds once
  the fix-ships-with-gate law existed; 4+ when the medium itself is being
  learned (sea, shore); and if round 3 still fails the bar, **change the
  architecture, not the polish** — the composite path's round 4 was a 7-lane
  research sweep, not more fixes, and the sweep ranked consensus BY
  INDEPENDENT-LANE COUNT (light mismatch 6/6 lanes; wrong asset class 5).
- **Reproduce first, through the reader's own harness.** Offline pixel-walks
  misled TWICE before `_crossingprobe.mjs`.

### RECIPE — running Sol (the external eye)
Codex CLI 0.147+, auth in `~/.codex`; `codex exec`, read-only sandbox,
reasoning effort **xhigh**; `-i` attaches images AND mp4; with images
attached the prompt goes via **stdin**; `--skip-git-repo-check` at non-git
roots; clipped output lives in `~/.codex/sessions/`. Record session id +
token count in the round doc — reviews are evidence and get provenance like
any asset. The re-review prompt: list the claimed fixes, then **"Verify EACH
claim — fixed or not, with frame refs — then: is this at the bar. Top 3
remaining. No flattery."** Label frames in canonical order. Remove EVERY
debug overlay first ("these lines turn the image from an illustrated world
into a development viewport instantly"). What Sol caught that internal gates
structurally could not: a hold soft-fail deadlock stranding the reader; the
sacrifice tableau MISSING behind a green lap; the seam class including a
polish-round regression; "set coverage, not escalating cinema"; "3D pieces
placed over paintings, not inhabitants." **Arming an external BUILDER:**
instruments + numeric targets, or don't bother — Sol sculpting by eye failed
the owner (4 MISS, IoU 0.7546); the rerun contract: "every claim about the
face must be a number from an instrument, and every edit must state the
number it is trying to move."

### RECIPE — anti-stall + recovery
- **Work SURVIVES on disk; a "stalled" lane may be nearly complete.** Struck
  3× (round-8 build, 8c, church fix): long art lanes die at the 180 s
  no-progress detector even with anti-stall prompts. Recovery that works
  every time: (1) inventory the tree + journal, (2) RUN THE LAP to see which
  gates already pass, (3) finish the remainder inline yourself.
- **Distinguish infra stalls from failed iterations**: resume (cached agents
  replay); check the status page; back off 25–45 min; after ~5 identical
  failures switch builder model in the persisted script and DISCLOSE the
  deviation.
- Prevention: smaller-scoped continuation workflows; timeouts on generation;
  DETACHED generation polls (kick the job, poll from a fresh call);
  adjudications to disk immediately; large data in FILES, never giant inline
  JSON in prompts (stalled subagents 6/6); keep the dev server up — a lane
  that verifies against :PORT owns the server as part of its contract.

### THE SKILL ECOSYSTEM (what is installed where)
- **img2threejs** (`~/.claude/skills/img2threejs/`): staged gated passes
  where the pass log IS the proof (Baker Street 11 passes; sea/shore
  rebuilds). GOTCHA — read the skill's contract before authoring: **track ≠
  tier.** The code-King shipped Track A (primitive assembly) where the
  character contract makes Track B (implicit SDF → marching cubes) MANDATORY
  for L0 head/torso/limbs; nothing auto-promotes the track. Review verdicts
  are one of `continue | refine-spec | refine-code | request-input | stop`,
  bounded 3/pass, 6 total.
- **cinematic-director**: a reference library, not an oracle — the
  DIRECTORS-BOOK consumed `references/director_styles/` as DATA; the
  project's gates supply the enforcement.
- **video-shotcraft**: the trailer's stage 0–7; stage 7 is an INDEPENDENT
  review — don't skip it. Asset capture from the REAL served book, not
  mockups.
- **SKILL.md is a cross-agent standard**: a well-formed Claude skill copies
  from `~/.claude/skills/` into `~/.codex/skills/` without changes; Codex
  `/import` pulls whole Claude Code setups; AGENTS.md is the CLAUDE.md
  equivalent — used exactly that way for the ARMED-SOL workspace contract.
- **Research lanes as first-class process**: `tools/ody/research/` — 7 lanes
  swept in parallel, SYNTHESIS.md ranks consensus by independent-lane count
  and grades each factor FIXED / HALF / NOT against what's shipped. This is
  how "stop polishing, change class" got decided with evidence.

### COST TABLE (measured)

| thing | cost | evidence |
|---|---|---|
| Rigged character, photo-rig lane | ~$1.50 avg (crew pair $1.93, ram $1.69; hero ~$3.00 with all rejects) | manifests, 5 characters |
| Multiview mesh job | ~75 CU | tripo-p1 jobs |
| Rig / retarget clip job | ~70 CU each, parallel OK | tripo-rigging jobs |
| Props (bowl/stake/wineskin/flock/tints) | $0 (pure code / reuse) | cast registry |
| Authored fused close-up shots | ~$2/chapter (4 shots × 4 candidates) | SHOT verdict |
| SAM2 layer-separation clip | ~$0.01 (8.6 s) | bowl-offer spike |
| Hero on-plate motion (reserved) | ~$0.33/motion | conditional GO, 4 conditions |
| 2D chapter, full (reference) | ~$26 = 130 image + 47 audio calls | PIPELINE-LIVING §4 |

**The real cost is agent time, not tokens.** Budget rounds, not images.

### PROCESS GOTCHAS (cheap to read, expensive to relearn)
- **Never pipe the lap verdict** — `| tail` ate the exit code and shipped a
  RED build once. The exit code is the verdict; nothing sits between it and
  the shell.
- **Playwright headless is SwiftShader**: ~520 ms/frame on ANY page. Launch
  `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` → real GPU,
  16.7 ms. Never write a frame-time gate without them.
- **Blender MCP: ONE lane at a time** — concurrent socket commands during
  renders SEGFAULT Blender (:9876).
- **Keys parse IN-PYTHON** (story-orbit/.env breaks shell source at line
  82); never print values.
- **Stale views after deploy**: Pages caches ~10 min — check WHICH URL
  you're judging before filing a defect; poll for the new bytes before
  lapping the deployed URL.
- **Raw-first, always**: every generated asset under
  `assets/raw/<lane>/<ts>/` with sha256 manifests; registries carry sha
  twins; the page builds everything from the registry.

---

## 6. THE FAILURE CATALOG

Every dead end, with its evidence, so no one walks into them again. "Tried,
measured, rejected" — the measurement is the point.

**F-1 — Single-image photoreal reconstruction (the original Tripo lane).**
Feeding a photo/photoreal portrait straight to Tripo. Superseded on sight of
the first stylize-first mesh (King, 2026-08-20): "dramatically cleaner."
The replacement is LAW 1 + LAW 2. Do not revive for speed; the turnaround
costs three images.

**F-2 — Hand-authored primitive-assembly characters (code-King v1,
fc17a24).** 45-node spec, `assembled-solid` ×38, zero implicit/SDF, 3,624
tris that "looks nothing like the creator's ~66k demo." THREE compounding
errors (king-tier-diagnosis.md): wrong TRACK (primitive shells can never
converge to a smooth organic surface at any segment count — the character
contract mandates implicit SDF → marching cubes for L0 head/torso/limbs);
wrong TIER (low ≤6k where medium ≤60k was needed); and a mis-read REGISTER —
the reference's PAINTERLY facets encoded as a GEOMETRY law ("never smooth it
away"). A low-poly-register brief against a realistic target is a
mis-classification, not a style.

**F-3 — SDF from noisy point clouds (code-King v2, 4d2ff0c).** Dense-sampled
the rigged GLB (1.4M points); the source meshes are OPEN SOUPS, so
ray-parity and point-normal sign estimates both "foam." The working
construction — offset-surface (crust) signed field, border flood-fill for
sign, 3³ mode-filtered voxel attributes — produced 77,802 tris at fidelity
3 OK / 7 WATCH / 4 MISS: better than v1, and an order of magnitude more
effort than the photo-rig lane for a WORSE likeness. The photo-rig lane
superseded the whole track.

**F-4 — Sculpting likeness by eye — and even instrument-armed
micro-sculpting (headlab A/B/C, C2).** 8 unguided iterations barely moved
the needle (A: 8 OK/5 MISS → 5 OK/4 MISS; B REGRESSED 1→3 MISS in one
iteration; shape IoU stuck ~0.72–0.79 in every arm). Arm C's final was
owner-rejected with measured diseases: forehead 2× too tall (hairline_n
0.391 vs 0.194), face 20% too long, eyes a full eye-height low. The C2
"armed" rerun moved layout numbers reliably BUT the probe's own chin metric
was contaminated by skin-like collar px (chin_n stuck at 0.903 while the
visual jaw was fixed — KNOW YOUR INSTRUMENT'S MASK), and the loop still
couldn't buy likeness cheaply. Verdict: **instruments are necessary for
regression-proofing, not sufficient for likeness; generate, don't sculpt.**

**F-5 — Hunyuan as base-mesh generator.** Lane 8 head-to-head, same
input/harness: Tripo wins likeness, limb separation (fingers vs mittens),
glTF hygiene (normals present, 1.8 MB vs 4.3 MB). Hunyuan meshed a raw
backdrop into a 2×2 ground disc once — hence the flat-navy-background law.
Diversity fallback only.

**F-6 — Manual/third-party rigging tiers.** Mixamo/AccuRig GUI (3–10
min/char, ToS-gray automation) disqualified by the no-manual constraint;
RigAnything (Adobe noncommercial) dead; Anything World (post-insolvency)
rejected; runtime `SkeletonUtils.retargetClip` documented-fragile (three.js
#25288, #25751). The banked-clip retarget INSIDE the Tripo rig job made all
of it moot. Make-It-Animatable: kept researched and ready, never needed
across 5 characters.

**F-7 — The plate-sandwich composite at close range (the SAM2 path).**
SAM2-cut occluders over painted plates, 3D cast rendered between. Three
external rounds: R1 "3D pieces placed over the paintings, not inhabitants";
R2 3 of 6 claimed fixes verified, color/fire-light/grounding NOT fixed; R3
after calibrated tint + contact AO + register softening: **"Bar verdict:
No."** The clean plates made the separation MORE apparent. The composite
ceiling, named: material/value integration, physical contact and occlusion,
and ACTUAL SCENE RELIGHTING by source — exactly what only native rendering
gives for free. Archived to `demo3d/sam2-experiment/`; the native foundation
(render3d.js + world.js) replaced it. See LAW 6.

**F-8 — The regrade law carried across mediums.** Proven on painted cuts
(dE 20.3 → 6.7); applied to 3D renders it made "translucent, smoky figures."
The explorer itself had stated the ceiling: the residual is "true relighting
effects a color transfer cannot synthesize." See LAW 5.

**F-9 — The book as construction site (the palimpsest).** Experiments,
color rounds and staging fixes applied DIRECTLY to the shipped product; the
dead SAM2 architecture left rendering inside it after being ruled dead. The
rebuild assembled from frozen signed-off artifacts under one scale
authority. See LAW 7.

**F-10 — Iterating a doomed asset class instead of switching class.** Three
Sol rounds polished the composite and still "No" — the correct round 4 was
the research sweep (5/6 lanes: wrong asset class), which produced the hybrid
verdict in one round. When round N's fixes are "applied but unsuccessful as
integration," round N+1 is a research sweep, not more polish.

**F-11 — Literal port of the sea's travelling-wave glint into a wide band.**
Three incommensurate travelling waves in world metres quantised into a
visible ~10 px dot lattice on the shore's wider band (the sea's band is
narrow enough on screen to hide it). Domain-warping only bent the lattice
into zigzag chains. Keep the mechanism (isolated pinpoints), carry it on a
jittered seeded cell.

**F-12 — Whole-quad twinkle + fine dice + band subdivision (the confetti/
haze family).** Whole-quad 0→100% gating through ACES = "square white
confetti" (the bar's named failure); 1.9 m dice on a 1.9 m grid = per-facet
confetti in the tail; 0.5 m refinements through the band + a 0.84 luminance
cap = HAZE (0.1% near-white vs plate 21.7%). The three-part sparkle law
(§3) is the replacement; every number is in the passlogs.

**F-13 — A big additive halo sprite under an ortho camera.** 3,436 blown px
vs the plate's 1,349; renderOrder cannot fix draw-after-opaque. Sky-dome
per-fragment wash instead. See §3.

**F-14 — Film frames as motion seeds.** Nolan-Odyssey frames DECLINED (film
IP + actor likeness on a public site). All motion seeds come from our own
sealed canonicals.

**F-15 — SAM2 for matting video loops.** Never needed — navy-key on flat
#1a2038 held at 0.0% bg contamination. The on-plate generate-then-separate
variant is a CONDITIONAL GO reserved for hero insets (~$0.33/motion) with
four conditions: contact shadow lands OUTSIDE the binary matte (a binary
extraction re-floats the figure); identity-drift gate (Seedance restyles the
cut); test the 16 CU path before the 146 CU one; prompt SAM2 with ONE fg
click (3-fg + 3-bg near a 34 px figure returned 97 all-zero masks). Also:
Replicate 403s urllib's default User-Agent — send any UA.

**F-16 — 3D characters as the mainline reader (the biggest verdict of
all).** After every experiment — 3D track, Blender, living-plate, hd2d,
bento bake-off — the ART is the product: 3D characters LOST to painted
plates + sprite cutouts by the owner's eye, repeatedly. The Living Book
(2D-first) is the capstone; 3D is the demo3d/cast exploration lane, held to
the plate's look via BAR-3D. Build 3D to the bar, and know which product
you are building it for.

---

Sources of record: `tools/ody/playbook-mine/character-pipeline.md`,
`sets-and-render.md`, `memory-rounds.md`, `process-and-presentation.md` —
each carries its own evidence index (manifests, passlogs, commits,
instruments). Start there when a number here needs its receipt.
