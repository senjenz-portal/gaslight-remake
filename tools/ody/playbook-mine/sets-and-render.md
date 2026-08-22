# SETS & RENDER — mined playbook (the world/set track)

Mined 2026-08-21 from three weeks of interactive-book 3D set work. Sources:
`site-deploy/living-odyssey/demo3d/full3d/createCaveScene.js` (the bar),
`tools/shore-forge/rebuild/PASSLOG.md` (shore, rounds 1–4),
`site-deploy/living-odyssey/3d/sea/passes/passlog.md` (sea, rounds 1–4),
`~/.claude/skills/img2threejs/SKILL.md`, `3d/app3d/render3d.js`, `3d/app3d/world.js`,
`tools/ody/sam2path-sol-r{1,2,3}.md`, `tools/ody/seamless/explore-{regrade,onplate-sam2}.md`,
`tools/ody/BAR-3D.md`.

Format: **LAW** (never break), **RECIPE** (do it this way), **GOTCHA** (cost a round once),
**DEAD-END** (tried, measured, rejected). Every entry names its incident and its numbers.

---

## A. THE SET-BUILDING RECIPE

### RECIPE A1 — Staged passes, each gated against the plate through the REAL page
The pipeline that produced every accepted set (img2threejs order, sea/shore passlogs):
**PASS 0 spec → 1 blockout → 2 structure → 3 form → 4 material → 5 lighting → 6 final gates.**
Non-negotiables learned by shipping it twice:
- **Pass 0 is a numeric plate read, not a look.** Probe the plate px→metres through the
  ledger's own frame BEFORE any code (sea pass 0: water diamond corners W(240,435)…E(1130,505)
  → 51 m side rotated 49°; brow plateau 27.5 m cross-checked at 350 px; palette hex-sampled
  and authored to read through ACES 1.42). The spec of record is a strict-quality-PASS
  sculpt spec (shore: 36 components / 22 materials).
- **Render every pass through the real page** (the book framing, the book's ACES exposure),
  never a private viewer — the grade IS part of the geometry judgment.
- **Each pass gate = named similarity judgment vs the plate + console clean**, ending in one
  decision: `continue | refine-code | refine-spec`. In-pass corrections are counted
  (refine-code ×1 notations) and bounded (img2threejs default: 3 per pass, 6 total —
  a hard stop, not a suggestion).
- **Name the debts you defer.** Every passlog pass lists "still deferred by design" (water
  placeholder until form; palette until material; blow-outs until lighting). A deferred debt
  with a name is a plan; an unnamed one is the blockout-survivor defect (BAR-3D §2).
- Incident that justifies the whole recipe: both shipped v1 sets "stopped at blockout
  quality — the owner caught it on sight" (scattered white quads, unsculpted icosahedron
  blobs, sparse dressing). The rebuild logs exist because one-shotting failed.

### RECIPE A2 — The final gate battery (what "done" means)
From shore round 4 / sea round 4, the battery a set must pass every round:
- **Smoke (ALL 12 CLEAN)**: zero console/page errors; determinism byte-identical replay
  (`sample(7.31)` after `sample(20.77)`; fireSample 11.7, flick 0.78666); posture law
  0.04° standing / 5.64° max walk; obstacle law (241 samples clear every ledger box +10 px);
  triangle budget (shore 19,732 / sea 8,859 of the 60,000 page ceiling); day/night swap
  round-trips; frame avg ~16.5 ms.
- **Turntable 0/90/180/270 — no holes.** This is what catches inside-out winding and
  view-dependent fakes; one review viewpoint is not evidence (img2threejs: a hole through a
  skull survived eight front-only rounds).
- **Story battery**: the WHOLE chapter (81 units, 8 gates, 8 facts) walks on the rebuilt set
  with the public contract frozen (`SEA_WORLD`/`SHORE_WORLD` exports, marks, obstacles,
  sockets, `splashAt`) — a set rebuild must never cost the story lane a line.
- **compare.jpg**: plate | render, same 1408×768 framing, overwritten in place, with an
  **honest verdict** — state what the painting still keeps ("hand-cut facets coarser and
  more considered… that gap is the medium's, stated — not a blockout gap").

### RECIPE A3 — The review loop that converges: measured defects, per-round instruments
Rounds 2/4 pattern (reviewer names defects; implementor fixes ONLY those, against a fresh
measurement of the plate, nothing else touched):
1. **Measure the plate first, in plate pixels**, before touching code (sea W1: 6 px row scan
   at luma>95, masked, largest contiguous run per row → the band is 3.2–5.2 m half-width and
   DEAD by Z +7; shore W1: PCA on the cool-water mask → band axis (0.0795, 0.9968), FWHM 100 px,
   only 6.3% of band pixels near-white).
2. **Fix to the measured envelope**, one source of truth shared by mesh and shader
  (`MOON_O/MOON_D/W_TIP/W_FAR`).
3. **Add a permanent instrument with the round** so a later round cannot silently regress an
   earlier one: `sea_expose.py` (histogram + region mid-tones + moon radial profile +
   MOONPATH-BRIGHTEST check), `sea_band.py` (round-2 water regression guard),
   `shore_compare.py`. Every table in the logs is reproducible because of this.
4. Report before/after AGAINST the plate column (plate | before | after) — three-column
   tables are the house evidence format.

### LAW A4 — The bar is a shipped artifact, not a rubric (BAR-3D.md)
The cave set (createCaveScene.js) IS the bar: prop count, silhouette richness, material
variety per m² judged by eye on the compare sheet. Sign-off requires: same place/same mood,
no blockout survivors (a set without its passlog is an automatic fail), the water law,
craft density at the cave's level, story integrity, and a personal-eye review each round.
"Lap clean" is not sign-off. The owner's eye outranks the reviewer's; the reviewer's
outranks every instrument.

---

## B. RENDER + SCALE LAWS (the one-pipeline architecture)

### LAW B1 — ONE render pipeline, lifted verbatim from the bar, diffed live (render3d.js)
Every renderer value comes from the cave demo unchanged and lives in ONE frozen module:
`antialias, preserveDrawingBuffer, maxPixelRatio 2, sRGB output, ACESFilmic @ exposure 1.38,
PCFSoftShadowMap`. No caller may set a pipeline value itself; the smoke gate diffs the live
renderer against `RENDER_CONFIG` via `describeRenderer()`. Incident: the plate-sandwich era
rendered with NoToneMapping (painted plates ship their own grade) — once nothing in the book
was a painted plate, the filmic rolloff became the law and the old pipeline was deleted, not
kept as an option.

### LAW B2 — ONE shadow caster (the blaze): 1024 cube, near 0.3, far 40, bias −0.004
A set *declares* its caster; the stage passes it to `configureShadowCaster()` so every set
throws the demo's shadow, not its own. Fills are unshadowed by design (the mainland key in
shore r4 is explicitly `no-shadow`; "the campfire remains THE one shadow caster, unchanged").

### LAW B3 — THE SCALE AUTHORITY (world.js): one module owns px→metres, and the gate MEASURES
- Each set's frame is the ledger's own arithmetic: **cave 43 px/m (off the penned ewes),
  shore 11.3, sea 12.7**, elevation from the plate's own ellipse (cave: the fire-ring paints
  82/206 px → 25°; shore 28°; sea 30°). `X(px)=(px−704)/S`, `Z(py)=(py−460)/(S·sinE)`.
- **SIZE_TABLE with provenance**: human 1.75 m, giant 7.00 (seated pose factor 165/300 from
  the ledger's own silhouettes), goat 0.90, sheep 1.00, great ram 1.40, stake 1.79,
  bowl 1.40, wineskin 0.98, sword 0.78. Tolerance ±15%.
- **The [scale] boot gate measures the world-space bbox off the BUILT graph** (after posture,
  fit, grounding), never trusts a claimed scale factor, and PRINTS THE FULL INSTANCE TABLE
  (every instance: expected, measured, delta, verdict). Incident: a silent scale error put a
  0.56 m "ewe" and a 2.4 m "ram" in the same pen — hence the printed table, so it cannot
  happen invisibly twice.
- **Axis per kind**: bipeds/quadrupeds by HEIGHT (bbox Y), beams/hulls by LENGTH (longest
  horizontal edge).

### GOTCHA B4 — Box3.setFromObject on a SkinnedMesh returns the BIND bounds
The skin transform lives on the GPU, so a seated giant measured that way reports a standing
A-pose box — the gate would be marking its own homework. Sweep the skinned vertices instead:
`SkinnedMesh.getVertexPosition(i, v)` (strided ~900 samples), expand the box with those.
Same class as the grounding law: measure what the reader actually sees.

### LAW B5 — The floor plan is the ledger; the walkable floor is y = 0 EXACTLY
Every transform derives from ledger plate px through the shared frame; the path law needs a
true plane, so the camp flat is exactly y=0 and story-load-bearing terraces are exact
(shore yard terrace exactly 1.35 m — "the pen law"). Marks/paths/obstacles survive any
rebuild verbatim: "carry the survey, not the craft."

### LAW B6 — Determinism: everything is pure f(seed, simT)
mulberry32 seeds for every scatter/jitter; particle flight in the vertex shader as pure
f(uTime, baked seed attributes) — zero CPU per frame; no state, no wall clock. The smoke
gate proves it byte-identically (replay after a far-future sample). Day/dawn is a LIGHT-RIG
SWAP (sky vertex colors, fire hidden, sun on, water uDay) — geometry untouched, deterministic.

---

## C. THE WATER LAW (the numbers)

### LAW C1 — Water is ONE world-space plane with vertex-shader swell and a painted floor
Pattern (sea3d `buildWater`, adopted by shore): one subdivided plane, swell displaced in the
vertex shader (flatShading derivatives relight facets for free), per-face attributes for
band/spark/foam/glow, and `totalEmissiveRadiance += diffuseColor.rgb * 0.26` as the painted
floor — **plate water is never true black**. Wine-dark base runs with −Z (toward the moon's
horizon), NOT with |x − moonX| (measured off the plate: #204571 at py 300 → #101f41 downstage).

### LAW C2 — The moonpath band is MEASURED, narrow, and dies early
Sea plate, 6 px row scans: half-width 3.19 m at the head (py 292), widest 5.16 m amidships
(py 376), 1.14 m at py 502, **dead by Z +7**. Round 1's authored law (`halfW = 7.5 − 5.2·t`,
15 m at the moon end, stray shards to 17 m) was the confetti sprawl. Shore plate: band axis
(0.0795, 0.9968) through centroid (720, 388) — nearly straight downstage where the build had
used a diagonal; FWHM 100 px; perpendicular luminance profile peaks 0.598 with floor 0.17.
Encode the measured envelope as knots (`ramp()`), shared by mesh and shader.

### LAW C3 — Sparkle: gated whole-facet shards + per-facet twinkle + isolated glints; never a dither
The three-part law that finally matched the plate (shore r4, ported from sea r2):
1. **Shard gate** on a coherent cell (`step(gate, 0.10 + 0.84·soft)`, off-shards 0.055) —
   the path breaks into shards with dark water between, dissolving to flecks at margins.
2. **Per-facet twinkle** `tw = 0.66 + 0.34·sin(t·(0.55..2.25) + seed)` — each sliver breathes;
   the band never blinks off. (The original defect class: whole-quad twinkle gating facets
   0→100% through ACES = confetti.)
3. **Sub-facet glints** on a jittered seeded cell: 1.15 m cells, one glint per cell at a
   hashed offset, 32% occupancy, ~3 px specks, each on its own period.
**The sparkle diagnosis numbers** (shore r4, why r3 read as HAZE): r3 had 0.1% of band pixels
above L 0.88 vs the plate's 21.7%, band luminance sigma 0.111 vs plate 0.179 — because a
0.29 m cell speckle at ~48% occupancy + a 0.125 m grain octave is a 3 px dither at 11.3 px/m,
laid over a smooth wash. After: 6.9% near-white, sigma 0.144, p95/p99 0.885/0.949 vs plate
0.988/0.999.

### LAW C4 — Facet size must match the PLATE's shards, including anisotropy
Plate facets are bold (~2–4 m; pass-1 defect "cell ≈1.5 m = sequins"; shore final correction
26×48→15×27 grid = ~4 m facets). Shore's plate paints SLIVERS, not diamonds: a typical white
crest ~83×10 plate px = **7.3 m across × 1.9 m deep** (11.3 px/m across, 5.31 px/m into
depth) → the grid went deliberately anisotropic, `PlaneGeometry(52, 96, 8, 44)` = 6.5 × 2.18 m
cells, plan-jittered on the INDEXED grid (shared corners move together, crack-free).

### GOTCHA C5 — Subdividing through the band dissolves the painted shards
Shore r3's two midpoint refinements (2 m → ~0.5 m at the core) + a whole-facet luminance cap
at 0.84 produced the haze (numbers in C3). Delete refinements inside the band; keep one only
where a crisp line is needed (the foam/waterline strip). Lift the cap when the risk it
guarded is gone (FACET_CAP 0.84→0.94 once the whole-quad twinkle was deleted).

### GOTCHA C6 — Shard-gap dice at the facet grid's own size = per-facet confetti in the tail
Sea round 4: 1.9 m dice on a ~1.9 m grid read as dice wherever the band is narrower than a
few cells. Fix: a `tail` term (`smoothstep(s, 0.42, 0.85)`) OPENS the gate to continuous and
DIMS by `1 − 0.5·tail` over the last third; cap `open` at 0.72 so gaps cut the spine too —
uncapped, the core welds into one clipped white blob. Stern-window blob count: plate 29,
round 3 52 (47 loose), round 4 38.

### DEAD-END C7 — Literal port of the sea's travelling-wave glint into a wide band
The sea's three incommensurate travelling waves in world metres, `pow(…, high)`, ported
literally into the shore band, quantised into a visible **~10 px dot lattice** (rendered and
rejected — the sea's band is narrow enough on screen to hide it; the shore's is not).
Domain-warping the waves only bent the lattice into zigzag chains (also rejected). Keep the
mechanism (isolated pinpoints), carry it on a jittered seeded cell (C3.3).

---

## D. EXPOSURE, LIGHT, MATERIAL

### LAW D1 — Exposure is closed by HISTOGRAM, not by eye (sea round 4, "several stops darker")
Measure both compare halves resampled to the SAME 1408×768. The gap that mattered was the
whole midtone range: value mean 30.8 (plate) vs 23.0 (r3) → 31.8 (r4); median 18.1|12.5|18.0;
population L 0–25: 60.7%|81.8%|61.3%; L 26–51: 22.3%|8.1%|20.2%. Also sample per-region
mid-tones (cliff mass 49.8|37.7|52.1; east face 20.5|10.6|20.7) and verify what must NOT
move (far-sky floor 11.6|10.7|10.7; off-path water 17.6|17.7|19.2). "Not one knob": the fix
was three separate causes (moon fill, cliff pairs, moon disc).

### GOTCHA D2 — Measure the floor OUTSIDE the glow
Sea round 2 read the "far-sky floor" as L~30 from a convenient pixel that was inside the
moon's wash; the frame corners are L 11.6. That one bad datum built the halo 2.5× too small
and hid the largest exposure term for two rounds. Sample corners, never near the feature.

### GOTCHA D3 — Additive billboard vs ORTHO depth: a big halo sprite bleaches the world
The plate's moon wash reaches ~480 px = 37 m — wider than the headland. A sprite that size at
the moon's z (−11.8) sits NEARER than the upstage water (z −30): 3,436 blown px in the water
window vs the plate's 1,349 (182 with it off). **renderOrder does not save it** — sprites are
in the transparent pass and draw after every opaque solid. Fix: put the wash on the SKY DOME
as a per-fragment term; under an orthographic camera, screen distance from the moon = world
distance perpendicular to the view axis (read the axis from the third row of `viewMatrix`,
correct under orbit at any pixel scale). Keep only a small rim bloom (16 units) at the disc.

### LAW D4 — The plate is a LIT RENDER: bake the painter's light into vertex color, keep the rig weak
`gradeFacets`/`twoToneFacets`: per-facet lit/dark by facet-normal · painter-key direction
(sea plate key is almost due WEST and LOW: `litDir [−0.97, 0.22, 0.06]`, gamma 2.3 — its brow
plateau is darker than its lit vertical faces) + `eastDark` for away-from-key faces + warm
practical washes by **lambert × range**, never distance alone (distance-alone painted east
faces too and flattened everything). Light the set from where the PAINTER lit it
(up-left-front), not where the prop moon sits. Then keep the live rig weak (key 1.4–1.62,
hemi ~0.95–1.0) so the baked albedo carries.

### LAW D5 — Probe plate pixels numerically before judging tone
The eye said "pale grey cliff"; the probe said RGB (68,59,64) — the render was 2× too bright
and blue (103,117,159). Every material round in both logs starts with sampled plate modes
written into the module header (shore W2: meadow #3e3d17…#5c593f; sand #4c4320…#a58469).
Under a colored night rig those are TARGETS, not albedos — the paint carries the plate's
tonal RELATIONSHIPS.

### GOTCHA D6 — Green-dominant albedo goes NAVY under a blue night key
Every plate meadow mode has R ≥ G (olive), every canopy sample is olive; the shipped
green-dominant family (G ≫ R) was pushed to navy blobs by the blue key. Fix hue, not
intensity: canopy → `#6a6a35…#948f57`, meadow ramp → `#5b5c33…#b2a866`. Related cause of the
sea's cold cliffs: a near-black `coolDark` under steep gamma leaves half-turned facets to the
hemi ALONE, and a saturated navy hemi repaints warm sandstone cold — lift the dark end of the
pair AND desaturate the fill; don't just raise intensity. Same class: near-white fleece goes
blue under night fill → per-member albedo grade multiplier.

### RECIPE D7 — A destination needs a LOCAL key, not a global lift (shore r4 W5)
One flat hemisphere cannot make both the crags dark and the mainland readable (r3: crags
L 0.197 vs plate 0.157 while the mainland sat 0.157 vs plate 0.195). Fix: a no-shadow
PointLight at the destination (`#c8cfdc`, 430, range 92, decay 2) whose falloff does the
discrimination — 1/350 intensity at the yard vs 1/3150 at the camp (9× falloff), so the
beach and strait keep their dark; hemisphere DOWN (1.05→0.84) and warmed. Off in the dawn
preset (the sun takes over). Feature table proof: yard terrace L .098→.240 (plate .276),
mainland aggregate L .157→.245 (plate .203).

### RECIPE D8 — Fire/camp blow-out: reduce intensity + deepen the color, let ACES roll it off
Shore pass 5: fire 620→440 at deeper amber #ffad42, bounce 160→115 — the plate's warm pool
with edges rolling off through ACES instead of clipping. Smoke columns: not particle streaks
— `smokePlume()` 130 particles, ring radius `0.6 + 1.2·rise + 2.2·rise²` (wider with height),
sprite 0.45→2.85×, clock slowed 0.32→0.20, deterministic.

---

## E. GEOMETRY CRAFT

### RECIPE E1 — The hole-killer: ONE closed sculpted mass, water clipped inside it
Shore architecture change that ended a whole defect class: the island is one icosphere whose
top hemisphere maps to a ZONED heightfield (camp flat exactly y=0; strait channel −1.7
between the audited waterline chains; yard terrace exactly 1.35) and whose bottom maps to the
faceted keel; water is a facet plane clipped inside the island outline, meeting terrain under
the rim BY CONSTRUCTION. No skirts, no slabs, no seams — the old three-blob gaps are gone
before any sculpting happens.

### GOTCHA E2 — Inside-out winding: the "cliff" you see is the culled interior
Sea pass 2 root cause: hand-built wall quads wound inside-out → every normal pointed inward,
the render showed black faces + mottling through the silhouette. **Check winding FIRST when a
custom-grid mass renders dark/hollow**; the turntable catches it at 90/180.

### LAW E3 — Crack-free jitter: hash the QUANTISED vertex position, never the vertex index
`hash3(round(x·97), …)` so shared positions — even across duplicated non-indexed verts —
move together: no holes. Same law for refinement (midpoint children sit on the parent plane)
and for plan-jitter (jitter the INDEXED grid so shared corners move together).

### RECIPE E4 — The cave bar's register kit (createCaveScene.js)
Painterly facets = per-FACE value jitter as vertex colors on non-indexed geometry
(`facetColors`, ±10%), flat by construction; cutaways = face DELETION by centroid predicate
(`dropFaces`), never a boolean; ridged crags = radial-column builder (lobes + notch +
terrace + plateau); dressing density via instanced systems (shore: 27 olive bushes in two
instanced systems, 8 cluster trees, 15 boulders — the plate's census, counted in pass 2).

### RECIPE E5 — Sculpt to the plate's defining silhouettes, with numbers
Ship stem/stern: BOLD spiral curls, 1.55π sweep, decaying radius + tip knob. Cliff: vertical
ridge lobes (3.5φ + 7.7φ, dying toward the crown). Crag foliage: the plate drapes olive
masses ACROSS the flanks — solve each tuft onto the spire's own cone surface
(r·(1−y/h), seated at ~0.85), not pebble-bushes at the feet (coverage 0.1%→5.6%).

---

## F. THE COMPOSITE CEILING (SAM2 path) — the verdict evidence

### DEAD-END F1 — The plate-sandwich composite path: 3 external review rounds, never reached the bar
The path: SAM2-cut occluder layers over painted plates, 3D cast rendered between backdrop and
occluders, per-unit book lenses. Reviewed by an external critic (GPT-5.6-sol, xhigh) on real
frames, three rounds:
- **R1**: "characters read as 3D pieces placed over the paintings, not inhabitants." Causes
  named: mismatched sharpness, weak contact shadows, absent local light, exposed guide lines,
  inconsistent scale cues. Wides integrate best because small characters hide the mismatch.
- **R2**: 3 of 6 claimed fixes verified fixed (head, overlays, registration); color
  continuity, fire light on characters, and grounding all **Not fixed** despite a round of
  work.
- **R3** (after calibrated scene tint, contact AO, rebuilt auger shot, register softening):
  **"Bar verdict: No. The characters still read as softened 2D overlays placed over a
  finished dimensional painting."** The clean character-free plates made the separation
  MORE apparent.
The composite ceiling, named: what remains after palette and shadows are "character material/
value integration, physical contact and occlusion, and ACTUAL SCENE RELIGHTING by source" —
exactly the things only native rendering gives for free. Consequence: the sandwich was
archived (`demo3d/sam2-experiment/`) and the native foundation built (render3d.js one
pipeline, world.js scale authority, stage + set mounts). In the native sets, fire light,
contact shadows, occlusion and scale are properties of the scene graph, not per-frame fixes.

### DEAD-END F2 — The regrade-law-across-mediums incident
The regrade law was real and measured **in its own medium**: deterministic Reinhard-lαβ
transfer of a painted CUT toward the plate's local ring palette closed dE 20.3 → 6.7 mean
(−67%; best case shore council 20.6 → 4.9, dCCT 1050 → 20 K), with accent-hue chroma
preserved. Carried across mediums — grading/softening 3D-rendered characters to "match the
painting" — it failed: R3's register softening "frequently lowers opacity, producing
translucent, smoky figures rather than painted ones." The regrade explorer itself had stated
the ceiling: the residual is "true relighting effects a color transfer cannot synthesize"
(no light wrap, no motivated rim, no directional gradient). The research synthesis's phrasing
of the same law: **"regrade-after is exactly what reads as pasted"** — never let final
character pixels come from a different generation pass than the scene light. A grade law
proven on medium A is a hypothesis, not a law, on medium B.

### DEAD-END F3 (conditional GO, reserved) — generate ON the plate, SAM2 pulls the layer back out
The one composite variant that measured well (bowl-offer spike): Seedance motion generated on
the real plate → real light bakes into the pixels (extracted layer R−B +5.2 mean, +8.8 peak;
a real underfoot contact shadow appears) → SAM2 video separates it (temporal IoU 0.969, ~11 px
halo, 8.6 s / ~$0.01 per clip). GO only with its four conditions:
(a) **the contact shadow lands OUTSIDE the binary matte** — 0 shadow px inside the mask
across all 97 frames; a binary extraction re-floats the figure — carry a shadow band or
dilate/soften at the feet; (b) identity drift gate (Seedance restyles the cut volumetrically);
(c) cost — 146 CU/motion vs ~16 CU on seedance-1-5-pro, test the cheap path first;
(d) **prompt SAM2 with ONE fg click** — a 3-fg + 3-bg prompt near a 34 px figure returned
97 all-zero masks. Also: Replicate 403s urllib's default User-Agent — send any UA.
Final placement: reserved for hero-moment insets only (~$0.33/motion), never the spine.

---

## G. PROCESS GOTCHAS (cheap to read, expensive to relearn)

- **GOTCHA G1 — Playwright headless is SwiftShader**: ~520 ms/frame on ANY of these pages.
  Frame-time gates need `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` → real GPU,
  16.7 ms. Without this every performance gate lies.
- **GOTCHA G2 — Never pipe the lap/gate verdict**: `| tail` eats the exit code — shipped a
  red build once.
- **GOTCHA G3 — Gates must measure the RENDERED thing**: a stance gate that measured the
  anchor reported 0.000 px while the pixel drifted 12–13 px. Same family as B4 (bind-pose
  bbox) and img2threejs's "the 2D gate passed but the blade reads as toy."
- **GOTCHA G4 — Small features are invisible to global scores**: Divine Eye's SSIM/edge run
  on 64×64/96×96 grids — a few-px identity detail is absent before comparison happens.
  Measure fidelity on a component's **visible footprint** (full frame minus component-hidden
  frame), never an isolation render; never colour-gate a CONCAVE feature (dark ratio captures
  cavity shading, not material).
- **LAW G5 — One next-action per review**: `continue | refine-spec | refine-code |
  request-input | stop`. refine-spec fixes a wrong spec (never patch code around it);
  refine-code fixes geometry/material against a sound spec. Bounded: 3 per pass, 6 total.
- **LAW G6 — Report the honest residual every round**: both passlogs end each round with
  "honest residuals (stated)" — moonpath mean 150 vs 171, brow 50.5 vs 61.6, recess 99.4 vs
  80.8. Over-claiming destroys the ability to debug the process; "improved" is not "done."
