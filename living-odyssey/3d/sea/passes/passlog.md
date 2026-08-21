# sea3d.js REBUILD — pass log

Rebuild of `3d/sets/sea3d.js` to the cave's bar (`demo3d/full3d/createCaveScene.js`),
via the img2threejs staged pipeline: **spec → blockout → structure → form → material →
lighting**, each pass rendered through the real page (`3d/sea/index.html`, the book
framing, ACES 1.42) and gated against the painted plate
`assets/set/sea/sea.jpg` (1408×768) before the next pass may begin.

The shipped set stopped at blockout quality — the owner caught it on sight. The named
owner-visible defects this rebuild must kill:

1. **The water** — was an elliptical disc with scattered white quads. Must become a real
   water surface: subdivided plane with seeded vertex swell, deep wine-dark base,
   fresnel-style brightening toward the moon line, the moonpath as a coherent emissive
   band with animated sparkle, shore foam at the cliff base, the ship's wake line.
2. **The terrain** — was two unsculpted icosahedron blobs. Must become ridged,
   painterly-faceted crags like the plate's: near-vertical column facets, the glowing
   recess, a true flat brow plateau at 27.5 m, the crag buttress, the stepped apron.
3. **Vegetation + props** — must reach the cave set's density and craft: succulent
   rosettes on real ledges, the mouth arch with its light, the brow boulder pile,
   waterline rocks, the ship's hull/oar craft (lofted hull, 8+8 oars, steering oar,
   raked yard + furled sail, rigging, thole pins, the pale bow ram).

Everything stays **pure f(simT)** (mulberry32 seeds, shader time uniforms), and the
public contract is frozen: `createSeaScene()` exports, `SEA_WORLD` (S=12.7, ELEV=30°,
X/Z/ZH, FLOORS, OBSTACLES, MARKS, SHIP_PX), `splashAt(x,z)`, ROCKS with story-mutable
offsets, `parts['night-rig']`, sockets `root:brow-giant`, SHIP.{group,sway,deckY,
deckPathLocal} — the story app walks its beats on the rebuilt set unchanged.

---

## PASS 0 — SPEC (the plate read, before any code)

**Plate anatomy** (probed on the gridded plate, plate px → plan metres via
X=(px−704)/12.7, Z=(py−470)/6.35, ZH for elevated points):

- **Water slab**: a rotated square (diamond) — corners ≈ W(240,435), N(690,208),
  S(698,672), E(1130,505) → plan side ≈ 51 m, rotated ≈ 49°, centred ≈ (−1.3, −2.5).
  The top is NOT flat-toned: gentle large-facet swell everywhere (facets 1.5–4 m),
  brightening toward the moonpath. Dark skirt sides (~2.2 m), inverted faceted
  under-rock deepest ≈ 14 m under plan (−9, +8).
- **Moonpath**: coherent near-white band, plan X ≈ −17 ± drift, from Z −28 (below the
  moon, widest ~11 m, blown white) downstage past the stern to Z +36 (sparse shards).
  It is the lit faces of the swell: shard triangles, dense→scattered, twinkling.
- **The ship** (SHIP_PX anchors kept): stern tip (495,462) → bow (678,516), 15 m
  tip-to-tip. Open boat: dark walnut outer strakes, light-tan interior, raised curled
  sternpost (~2.2 m), low bow with a pale ram at the cutwater, mast (8.8 m) with the
  yard at ~86% height raked up toward the bow carrying a two-lobed furled tan sail,
  8 oars a side (near side dipped, far side lifted — the port oars catch the cave-glow
  amber), steering oar on the stern quarter, thwarts, thole pins, fore/back stays.
- **Headland**: flat brow plateau at 27.5 m (the ledger cross-check 350 px) whose brow
  edge runs plan (7.2, 3.5) → (33, 9.8) — the screen "descent" of the brow is plan-Z
  sweep, not height loss. Near-vertical column facets on the moon side with a glowing
  recess above the mouth; one tall pale buttress column (~20 m) left of the recess;
  a low apron (~7 m) hosting the cave mouth; amber-lit stepped rocks falling to the
  water in front of the mouth; giant smooth dark facets on the right face; angular
  waterline rocks at the base.
- **Cave-glow**: mouth arch of stones at the waterline with a bright amber interior,
  two spark motes above it, amber wash climbing the recess ~half the cliff height,
  gold light pool on the water in front of the mouth.
- **Brow boulders**: 5 large (2–4 m) rounded-faceted boulders clustered on the top
  rear + ~10 small stones scattered on the brow front.
- **Succulents**: rosettes of flat pointed lobes, sage green with pale tips, on real
  ledge shelves: buttress top (757,208), mid-face (905,290) + (940,320), low shelf
  (875,412), brow (810,120).
- **Moon**: faceted geodesic ball ≈ 7.5 m at (474,242), pale grey-blue, lit up-left,
  soft bloom. The plate sky has no stars (house register keeps a faint field).

**Palette (plate-sampled, authored to read through ACES 1.42)**: water base
#1c2f63→#16244d away from path; moonpath white #eef3fa / pale #9fb6dd; skirt #1a2c55;
under-rock #131c38; cliff lit column #c9c4c4/#8b8894, shadow #5f5e6e, right face
#565866→#3f4353; brow top #a9a7ad warm-tinted #b5a9a4; warm wash #e8a34f→#a97747;
boulders #9fa0a8/#6c6e7c; succulent #7f9464/#55704b; hull walnut #6b4c33/#4b3527,
interior #9c7f5d, sail #c3a984, oar blade #a98a5f; moon #dfe3e8/#8b95a8.

**Identity features gated every pass** (critical): the moonpath band's coherence +
aim at the stern; the brow plateau at 27.5 m with boulder pile; the glowing recess +
mouth + water pool; the ship's silhouette (sheer, sternpost curl, raked yard, oar
fan); the diamond slab. Important: succulent placement, foam edge, wake, skirt +
under-rock, facet grain scale.

**Budget**: ≤ 60,000 triangles (ceiling from the page). Expected ≈ 12–16 k.

---
## PASS 1 — BLOCKOUT (render: pass1-blockout.png · gate sheet: cmp-pass1.jpg)

**What was built**: the diamond slab (rotated square, side 52.4 m, rotY 35°, skirt +
under-rock), the water plane with swell shader + band/foam/glow/wake attributes,
the crag builder (massif/buttress/apron as ridged radial columns, flat plateau at
27.5 m), brow boulder pile, mouth + glow, lofted hull (13 stations × 9 ring points,
real sheer/keel curves), 8+8 oars + thole pins + steering oar, yard + furled lobes,
moon + halo, sky, splash pool + rocks carried over verbatim. Zero console errors.

**Gate — named similarity judgment vs the plate**:
- MATCH (blockout level): diamond slab silhouette + skirt + under-rock; moonpath
  band aimed moon→stern; cliff mass position + flat brow + boulder pile; ship on
  the ledger marks with mast/yard; glow at the base; the book framing is the
  plate's own (marks project to the same px).
- FAIL (must fix in structure/material/lighting passes, named):
  1. cliff reads near-black — plate's rock is pale grey on lit faces (needs baked
     lit-face grade + lighter base hexes, not just lights);
  2. moonpath too wide + sequin-dense — plate shards are larger patches, band
     narrower, tail fades before the south corner;
  3. shore foam too eager/white around the whole base;
  4. moon blown white by its halo — plate moon is faceted grey;
  5. hull/oars too dark to read; sail lobes blobby;
  6. under-rock too large, spills west of the slab;
  7. glowing recess + amber wash barely visible (warm paint under-scaled vs plate's
     half-height climb);
  8. water facets slightly too fine (sequins) — cell ≈1.5 m vs plate ≈2–3.5 m.

**Decision**: `continue` to PASS 2 (structure) carrying the 8 named corrections.

## PASS 2 — STRUCTURE (render: pass2-structure.png · gate sheet: cmp-pass2.jpg)

**What changed** (with the in-pass correction loop):
- crag lit-face bake (`gradeFacets`), the recess notch, mouth arch stones + glowing
  doorway + spark motes, stepped rocks to the water, succulent rosettes on shelf
  slabs at the plate's five anchors, boulder pile re-clustered, base rocks graded;
- ship: lofted strakes graded, thole pins, steering oar, fatter furled lobes,
  8+8 oars thickened, pale bow ram;
- water: shard PATCHES (2.6 m quantised hash) instead of per-face sequins, band
  tail fade, stray outboard shards, foam tamed, wine-dark desaturated;
- **root-caused defect**: cragGeo wall winding was inside-out — every wall normal
  pointed inward, so the "cliff" was the culled interior seen through the front
  (the pass-2 first render's black faces + mottled right side). Fixed by rewinding
  the wall quads; also moved the key light up-left-FRONT (the painter's moon — the
  plate lights the front-left columns pale) and lifted the water's painted floor
  (`+ diffuseColor.rgb * 0.30` emissive — the plate's water is never true black).

**Gate — named similarity judgment vs the plate**:
- MATCH: solid painterly crag mass with big facets; flat brow + boulder crown;
  buttress column; coherent moonpath aimed moon→stern; diamond slab + skirt +
  under-rock; ship craft silhouette (sheer, posts, yard, oar fan) on the marks.
- FAIL (queued for form/material/lighting): cliff too uniformly pale — the plate's
  right face is markedly darker and the amber recess wash is missing (chimney
  confinement over-killed it); boulder pile reads fused-pale; hull still too dark;
  succulent clusters under-scaled; mouth glow a candle where the plate has a
  furnace + gold pool; water a touch too saturated; skirt too dark.

**Decision**: `continue` to PASS 3 (form) with those corrections.

## PASS 3 — FORM (render: pass3-form.png · gate sheet: cmp-pass3.jpg)

**What changed**: succulent clusters doubled + scaled to the plate's mass; mouth
doorway enlarged + practical raised (60→95·flick); glow pool widened; band widened
(halfW 7.5→2.3 m, blown core to t<0.34, stray outboard shards); `eastDark` facet
term (faces turned from the moon drop); hull/inner/skirt tones lifted; wine base
desaturated to the plate's muted navy.

**Gate — named similarity judgment vs the plate**:
- MATCH: succulent clusters read at the plate's five anchors; the mouth is now a
  hot practical with a gold pool; the band's mass and aim rhyme with the plate.
- FAIL (queued for material/lighting): the massif is too uniformly pale-lavender —
  the plate's lit faces are mid-grey and its right face far darker (hemi fill too
  strong, eastDark too shy); the AMBER RECESS WASH is still missing above the mouth
  (warmPaint falloff too weak at face distance — needs a gain + a second recess
  paint); water contrast too even (painted floor too high); hull interior reads
  black where the plate shows lit tan; mouth halo fuzzes over the arch craft.

**Decision**: `continue` to PASS 4 (material).

## PASS 4 — MATERIAL (render: pass4-material.png · gate sheet: cmp-pass4.jpg)

**What changed** (two correction iterations, pixel-probed against the plate):
- probed the plate numerically: its cliff is far darker than the eye assumed
  (front columns ≈ RGB 68,59,64; right face ≈ 16..45; recess ≈ 125,79,63 WARM) —
  the pass-3 render was double that brightness and blue (103,117,159);
- cut the rig (key 2.0→1.4, hemi 1.6→0.95) so the BAKED albedo carries; darkened +
  warmed all crag hexes; `eastDark` 0.8 (the away-from-moon faces drop hard);
- warmPaint gained a `gain` and the recess got a second climbing wash (r 10.5,
  gain 2.0) — the plate's amber chimney now reads to half height;
- shelves sunk into the face as pockets (they read as bolted-on boxes before);
  boulder crown enlarged to the plate's mass; succulent greens lightened;
- water floor 0.26, band patch wobble (width varies down the band), hull tones up.
- post-fix probe: front-face (75,80,106) vs plate (68,59,64) — close, night-cool
  bias accepted; right-face (24,27,43) vs (16,16,28) ✓; recess warm arriving.

**Gate — named similarity judgment**: the HEADLAND now holds against the plate —
ridged pale-topped crag, dark east face, climbing amber recess, boulder crown,
succulent ledges, hot mouth with gold pool. Named remaining gaps: the SHIP reads
as a dark silhouette (the plate's hero is a warm lit hull with readable oar fan);
the moon's facets are flatter than the plate's; the under-rock is near-black where
the plate shows facet planes; the wake is baked but sub-visible.

**Decision**: `continue` to PASS 5 (lighting + final grade) carrying those four.

## PASS 5 — LIGHTING + FINAL GRADE (render: pass5-lighting.png · sheet: cmp-pass5.jpg)

**What changed**: the ship made the hero — hull regraded (#b8875a lit strakes,
faint painted-floor emissive like the water), interior/deck/oars given the plate's
readable tan (blades #c2a166), furled lobes dropped 0.52 below the yard and
darkened to #b89a72 so the yard stops reading as one pale plank; moon facet
contrast raised (#dde1e8/#76829c); under-rock lifted to show facet planes
(#182242 @ 0.26); wake gain raised to just-visible; rig locked (key 1.4 @ #c8d6f2,
hemi 0.95, caveGlow 95·flick).

**Gate — named similarity judgment vs the plate (final pass)**:
- The register holds side by side: same floor plan, same light logic (moon key up-
  left-front, amber practical at the mouth), the moonpath a coherent twinkling
  band moon→stern, the wine-dark swell readable everywhere, the ridged crag with
  its climbing amber recess, boulder crown, succulent ledges, and a warm, fully
  crafted twenty-oarer on the ledger marks.
- Honest residuals (stated, accepted): the plate's hand-cut facets are coarser and
  more considered; its ledge silhouettes crisper; its grade richer; the band in
  the render brushes the hull where the plate keeps a darker gap.

**Decision**: `continue` — staged passes complete; on to the harness gates
(smoke, turntable, compare.jpg, story beats).

---

## HARNESS GATES (after the five passes)

- **sea3d smoke (tools/sea3d_smoke.mjs): PASS** — zero console/page/request errors;
  determinism byte-equal (sample(7.31) replays after sample(20.77)); posture law
  verbatim (standing 0.04°, walk max 5.64°, pelvis 0.4884); obstacle law 0 hits
  (deck + clifftop ledge vs every ledger box, giant mark clear); ledger scale
  measured from built geometry (hull 15.056 m, mast 8.800 m, actor 1.750 m,
  S = 12.7); row cycle sweeps 1.335 m per half period; splashAt(x,z) births live
  (t0 = 40, unit visible); walk advances + respawns; budget 8,859 tris of 60,000;
  frame 16.7 ms avg.
- **Turntable 0/90/180/270 (turn-*.png): no holes** — the crag reads as a solid
  mass from every azimuth (the inside-out winding class of defect is dead), water
  swell + band render from all sides, skirt closed.
- **Story app (tools/story3d_smoke.mjs): PASS** — the whole chapter walks its 81
  units on the rebuilt sets: all 8 gates resolved, all 8 facts held including BOTH
  Beat VI rock throws + hull hits + the sail-off displacement on THIS set; the
  giant stands the brow socket (root:brow-giant); zero app/console/page errors;
  postures PASS for all five rigs.
- **compare.jpg** — plate | render at the book framing, one sheet; verdict in
  stats.json (honest residuals stated: the plate keeps its hand-cut grain and
  richer grade).

---

## ROUND 2 — Fable's named defects (reviewer: Fable 5, implementor: Opus 5)

Round 1 shipped and was reviewed against the bar. Three defects named; each fixed
against a fresh measurement of the plate, nothing else touched.

### W1 THE WATER — "the moonpath sprawls hot white confetti across half the sea"

The plate was re-measured properly: a 6 px row scan of `sea.jpg` at luma > 95 (the
soft skirt, not just the blown cores), moon disc / cliff / ship masked, taking the
largest contiguous run per row. **The plate's band is narrow.**

| plate py | Z (m) | s | run (px) | half-width | centre offset from the moon line |
|---|---|---|---|---|---|
| 292 | −28.0 | .058 | 482–563 | **3.19 m** | +3.82 |
| 304 | −26.1 | .109 | 460–551 | 3.58 m | +2.48 |
| 316 | −24.3 | .160 | 435–547 | 4.41 m | +1.34 |
| 334 | −21.4 | .236 | 401–526 | 4.92 m | −0.83 |
| 352 | −18.6 | .312 | 433–537 | 4.09 m | +0.87 |
| 376 | −14.8 | .414 | 422–553 | **5.16 m** (widest) | +1.06 |
| 388 | −12.9 | .465 | 414–488 | 2.91 m | −1.81 |
| 502 | + 5.0 | .947 | 440–469 | 1.14 m | −1.54 |
| 514 | + 6.6 | — | — | **dead** | — |

Round 1 ran `halfW = 7.5 − 5.2·t` (15 m wide **at the moon end**, where the plate is
6 m) with a stray-shard zone out to `2.3·halfW` = 17 m and a tail fading only past
Z +26. That is the sprawl. Replaced by the measured envelope
(`BAND_Z0/BAND_Z1`, `BAND_HALF`, `BAND_MID`, smoothstepped between knots by `ramp()`),
so the band is narrow at the head, plateaus at 4–5 m amidships and is **gone by Z +7**.

- **soft-edged** — `soft = pow(1 − dx/halfW, 0.6)`; the round-1 hard patch gate is
  replaced by coherent 1.9 m shard gaps whose probability rises with `soft`, so the
  spine is near-solid and the flanks feather.
- **capped luminance** — `b` is clamped to 1 and the emissive gain is a flat
  `bandE · tw · 0.95`; the round-1 `b × 1.9 → 1.35` blown-core multiplier is gone.
- **sub-facet twinkle** — three incommensurate travelling waves in world plan metres
  (`vWPos.xz`), `pow(…, 8)`, gain 0.42: isolated pinpoint glints *inside* each facet,
  no lattice, still pure f(position, uTime).
- **gentle swell elsewhere** — base lift re-read off the plate: it runs with **−Z**
  (upstage, toward the moon's horizon: #204571 at py 300 → #101f41 downstage), not
  with |x − moonX|; `deep #0f2546` → `wine #456a8a`, per-facet tone jitter ±0.22.
  Moonpath glints re-seeded onto the measured band instead of the old law.

**Result** (water window x < 660, py ≥ 290, plate | round 1 | round 2):
bright px (L>120) 1850 | 2099 | 1388 · median band width 62 px | 42 px | 40 px ·
max width 131 px | 122 px | 111 px · pixels above L 235 (the blown white)
1438 | 554 | 589. Round 1's rows ran to py 526 with 38 lit rows; the plate stops at
508 with 33; round 2 stops at 508 with 34. Water base now matches the plate within a
few counts per channel (e.g. py 330 x 560: plate `#26517e`, render `#29517d`).

### W4 CLIFF MATERIAL — "the flat mid-gray goes"

New `twoToneFacets()` replaces `gradeFacets()` + `warmPaint()` on the three headland
masses. Two axes per face: the moon's lambert (COOL) and each practical's
**lambert × range** (WARM) — round 1 washed warmth on by *distance alone*, which
painted the east faces too and flattened everything toward one value.

Plate tones sampled for the pairs: moonlit sea-side `#7c7d7f`–`#818387`; warm bounce
`#563a37` → `#7b564a` → `#976e5d`, hot `#c47935` at the mouth; east / away-from-moon
`#0e0f1a`–`#12131f`. Two further reads changed the law:

- the plate's key is **almost due west and low** (`litDir [-0.97, 0.22, 0.06]`,
  `gamma 2.3`): its brow plateau `#47454c` is darker than its lit vertical faces and
  its downstage faces darker again, so no half-turned face can reach mid-gray.
- the recess wash must stand **downstage of the face it lights** — a practical
  upstage of a downstage-facing facet has negative lambert and paints nothing, which
  is why round 1's amber chimney never appeared.
- the buttress is the plate's **pale** rock (`#7a7a7c` even on its downstage face):
  its own lighter pair + shallower gamma 1.35, not the massif's.
- the brow boulders were the palest thing in frame (`#7b87a9` vs the plate's
  `#48454c`); their instance tint drops to `#6f6a63 × 0.80–1.14`.

**Result** (plate | round 2): east mass py 320 x 980 `#11141e` | `#0c0e13`;
py 380 x 1060 `#0f0f19` | `#08090e`; warm recess py 380 x 820 `#81513d` | `#654536`,
x 860 `#976e5d` | `#764727`; buttress py 300 x 740 `#7a7a7c` | pale. Round 1 read
`#3b4354`/`#5e606c` across that whole span — one blue-gray value.

### MINOR — the moon's soft halo

Round 1 had a single 10.5-unit sprite: a 5.25 m radius on a 3.8 m moon, i.e.
invisible. The plate's sky, measured radially from the disc (centre 476,248,
r 48.5 px): L 70 just outside the rim, 63 at r 100 px, 47 at r 196 px against a
far-sky floor of ~30 — a steep shoulder over a long tail out to ~250 px (19.7 m).
Two additive billboards now carry it: a 15.5-unit bloom for the shoulder and a
42-unit halo for the tail, both on multi-stop gradients (`glowTexture(…, stops,
size)`), breathing together on the existing 9.1 s cycle.

### GATES (round 2)

- **sea3d smoke: PASS** — zero console/page/request errors; determinism byte-equal;
  posture, obstacle, scale, row (1.335 m), splash, walk/loop all green;
  8,859 tris of 60,000; 16.55 ms avg.
- **Turntable 0/90/180/270: no holes**; the band stays coherent from every azimuth.
- **Story app (tools/story3d_smoke.mjs): PASS** — the 81-unit walk, all 8 gates,
  all 8 facts (both Beat VI throws, both hull hits, sail-off, sigil); zero errors.
- **compare.jpg** re-rendered in place at the book framing (orbit 0, sim 4.2, u 0.45).
