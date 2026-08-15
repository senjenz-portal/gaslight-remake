# STRIPS.md — the animation upgrade: pose glides -> sprite-strip motion

The Odyssey sets move cut-outs by easing them (`damp`, `alongPath`, `lerp`)
and the biggest figures read as SLIDES: a static stand cut gliding a metre a
second. The sherlock room already solved this and its machinery is proven —
this file names the six strips worth cutting, in reader-impact order, against
that machinery.

## The proven machinery (site-deploy/living/app/sets/room.js)

A strip is `{ file, cell: [w,h], n: 4, srcH, anchors: [x0,x1,x2,x3] }`:

- **srcH** — the figure's foot-baseline height inside a cell; draw scale is
  `ws = drawnH / srcH` (scale-free: author at source resolution, the code
  does the rest). King precedent: cells ship at ~1.6–2x drawn height.
- **THE ANCHOR LAW** — `anchors` is the centre of the FOOT SPAN in each
  cell's bottom 20 rows, **measured per frame off the cell's own alpha**:
  "anchoring each frame on its own feet is what stops a 22 px cell-to-cell
  difference in where the boots sit from reading as a lurch." Never assume
  symmetry — the stake-pin lesson (cave.js round 3): assumed pins sat in
  transparent air and hung the drive as crossed sticks.
- **Distance drives the frame, not time**: `frame = floor(travelled /
  pxPerFrame) % n`, where `pxPerFrame` = half a stride in plate px — so an
  eased/damped speed profile can never skate the feet. (Loops with no travel
  — oars, the auger — run on their verb's own clock instead.)
- **Paint**: `backgroundPosition = -frame*cw`, `backgroundSize = cw*n x ch`,
  `left = x - anchors[frame]*ws`, `top = y - (cell.h - footPad)*ws`.
- **The swap law**: strip and cut-out are never both visible — the strip IS
  the walk, the cut IS the stand, and the swap lands ON the arrival frame
  (Holmes: arrival also fires the gesture that motivated the walk).
- **Facing**: author facing the dominant travel direction; mirror the other
  leg with `scaleX(-1)` about the foot transform-origin (feet cannot drift
  by construction).
- **The proof**: the snapshot measures the foot off the RENDERED box
  (`getBoundingClientRect` -> `toPlate`) against the floor/path — Holmes'
  verifier held worst |dy| 0.45 px over a walk. A wrong transform cannot
  describe itself correctly.

## The six strips, by reader impact

| # | strip (canonical) | character | frames | the action | set + units it serves | cell guidance (from actors.json) | acceptance gates |
|---|---|---|---|---|---|---|---|
| 1 | `polyphemus-walk` | POLYPHEMUS | 4 | the striding giant — Beat II's entry currently glides a static `polyphemus-stand` cut (674x1244) 360+ px along `PATH.giantIn` then POPS to `seat` at k>=1 (cave.js stepGiant); the same slide runs `giantOut` (iii-02) and the iii-06 re-entry | `cave` — ii-03 `return` seg (K5, the dread entrance), iii-02 `flock-out`, iii-06 `flock-in`; drawn 300 px (43 px/m) | author off the stand cut's lane: cell ~740x1250, srcH ~1238 (or 2x-drawn: ~640 h); pxPerFrame ~56 (a ~2.6 m giant stride = 112 px / 2); per-frame foot anchors MANDATORY — at 300 px drawn, a 20 px source anchor error is a visible 5 px lurch under the 1.8x discovery lens | (a) rendered-box foot vs `alongPath` point \|dy\| <= 1 px every frame; (b) constant path speed => drawn foot-centre shift between frame swaps < 2 px (the anchor law's own number); (c) arrival swap strip->`seat` on the landing frame, opacities strictly XOR; (d) baseline-y depth sort (`sortActors`) keys off the strip's box while walking; (e) settled/reduced lands finished (existing `giantWalk` path) |
| 2 | `ulysses-walk` | ULYSSES | 4 | the protagonist's crossings — cave walks are damped glides of the single `ulysses-walk` pose cut, and any move > 250 px is FADED-THROUGH, which today ERASES the scripted, lens-tracked walk of iii-07 ("lens tracks his walk toward the fire", huddle -> bowl-offer ~420 px) | `cave` — ii-00 entry (he leads the twelve in), ii-06 suppliant step-out, ii-11 sword mark, iii-03 scheme, iii-05 lots, iii-07/08 the bowl walk, v-11 freed; drawn 75 px. NOT the shore: at 20 px the cell is 9 px wide — shore.js's own ruling stands ("no strip at this scale, the pose swap IS the stride") | source `ulysses-walk` 304x664, pin (208,658): cell ~360x670, srcH ~658 (or 2.5x-drawn: ~190 h for a small file); pxPerFrame ~16 (0.75 m stride at 43 px/m / 2); frame from CUMULATIVE damped distance, not t | (a) foot \|dy\| <= 1 px off rendered box vs mark/floor; (b) strip XOR stand/offer/sword cut; (c) raise the fade-through budget to ~450 px in cave ONLY so iii-07 is walked, not teleported — shore keeps 250; (d) flip about foot origin leftward; (e) `uMark`/formation claims unchanged (the b2-25-sword defect must not regress: G2 live check still passes at (768,462)) |
| 3 | `stake-twist` | the olive stake (prop) | **3** (loop) | the auger — O.9's CARRIER ("the simile lands ON the twist"): today the drive is `rot: -8 + 6*sin(...)`, a wobble that reads as a wiggle, not a drill. 3 frames of the glowing shaft's grain/highlight advancing one-third turn sell "two men with a wheel and strap" | `cave` — iv-03 `auger` / iv-04 `bore` / iv-05 `hiss`, riding the blinding clock (`ruseT`, 0..DRIVE.fright); tip pinned on EYE (672,512) | source `prop-stake-glowing` 1143x582: cell ~1150x590, drawn h ~43 (PROP_H.stakeW 84 x 582/1143); **per-frame TIP anchors** — the anchor law transposed: the anchored fact is the ember head on the eye, and each frame's tip is measured off its own alpha (the round-3 lesson: the shipped pin (1000,576) sat in transparent air) | (a) tip stays on EYE within 1 px across all 3 frames; (b) frame advance MONOTONE at 3 frames / 1.1 s (the current twist period) — one-way drill, never ping-pong; keep only a damped +/-2 deg grind on top; (c) E2's law holds: the drive draws the glowing cut ALONE; (d) at `DRIVE.fright` the loop freezes and the pluck-and-hurl uses the plain cut unchanged; (e) heat phase (drive null) holds frame 0 = today's art, so the hold gate is byte-identical |
| 4 | `crew-row` (loop) | THE MEN | 4 (loop) | the oar stroke — catch / drive / finish / recover. Beat VI's whole leaf lives on this ship and every wash is answered by "the oars bite", yet stepRowers only bobs+rotates one static `crew-row` cut | `sea` — vi-03 rock-1 oars, vi-12 rock-2 wash-onward, `return-beach` seg (vi-13), vi-14 sailedon glide; six rowers, drawn 15 px (lenses run 2.0–3.2x, ~30–48 screen px) | source `crew-row` 781x954, pin (75,948): cell ~800x960, srcH ~948; **time-driven loop, not distance** (the ship is the world's origin — the rowers never travel): reuse the existing 1.9 s period + per-rower phase i*0.9 rad; stroke rate/depth ∝ `rowEffort` | (a) frame 0 = the shipped crew-row pose, so effort 0 is pixel-identical to today; (b) all six pins hold the ledger rower marks THROUGH the world transform (snapshot pbox already reads rendered boxes); (c) phase stagger preserved — six benches never in lockstep; (d) loop runs on STORY effort even under reduced motion (effort is not amb-gated today; keep that law), ambient bob dies with amb; (e) painter order = ascending mark y unchanged |
| 5 | `ram-walk` | the flock | 4 | the trot — v-05's dawn stream sends FLOCK_N=5 static `ram-walk` cuts bobbing (per 1.7 s) down `PATH.flockOut`: a herd of statues on casters. The strip is the escape's pulse — the beat O.11 lives in | `cave` leaf 4 — v-05 `cave-dawn` escape stream (walkers + the trios' exit windows), the free-men tail (v-11). The Beat-III flock segs stay light-only (E1: no ram actors before Beat V) | source `ram-walk` 815x663, pin (343,657): cell ~830x670, srcH ~657; drawn 45 px (cell draws ~56x46); pxPerFrame ~13 (0.6 m ovine stride at 43 px/m / 2); per-walker frame offset from the existing i*0.07 stagger | (a) foot \|dy\| <= 1 px on `flockOut`; (b) the 1.7 s bob is REMOVED while the strip runs — gait and bob together is double motion; (c) flip = the existing `flip: true` leftward stream; (d) **adjustment to the brief**: the GREAT ram keeps his cuts — he is G5's gate target and his slung/halt beats are poses, not strides; the strip may drive him at 83 px only on the free-men trot-clear leg; (e) the pens' painted 45 px ewes untouched |
| 6 | `crew-walk` | THE MEN | 4 | the crew's crossings — the entry seg (K1, leaf 2's opening image: twelve slipping past the empty pens) is a staggered lerp of stand cuts; the ii-03 scatter to the far dark and v-11's freed men are damp glides | `cave` — ii-00 `entry`, ii-03 `huddle-far` scatter, v-11 `free-men`; drawn 73 px. Shore stays pose-glide (19 px, same ruling as Ulysses) | one strip serves both crew bodies (variety = flip + phase): source crew-a/b 266x620 / 276x635: cell ~320x640, srcH ~630; pxPerFrame ~16; per-man frame offset from the entry's i*0.035 stagger | (a) foot \|dy\| <= 1 px; (b) strip replaces STAND-cut travel only — the racks' `crew-carry` walk keeps the carry cut until a carry-walk strip exists, and the seize victims' drag into shadow stays a glide (being dragged is not a walk); (c) twelve men never stride in phase-lock; (d) headcount law untouched (`i >= crewN` still parks the dead) |

## Wiring notes (one pattern, six users)

1. Add a `strips` block per set mirroring `KING.walk` verbatim — same field
   names, same paint path — and decode via `st.bitmap()` at boot (room.js
   decodes at boot so the first walk frame never flashes white).
2. Frame source: **distance** for travel strips (1, 2, 5, 6 — cumulative px
   moved this walk, so damp/ease profiles cannot skate), **the verb's clock**
   for loops (3: the blinding clock; 4: the row period x effort).
3. Every strip inherits the set's existing proof style: the snapshot reports
   `frame`, and the foot/tip measured off the RENDERED box vs the
   mark/path/anchor (`dy`), so a lap can hold the gates above without
   re-deriving the set.
4. Bench (not in the six): `polyphemus-grope-walk` — iv-11's grope cut glides
   `PATH.giantGrope`, but a blind hand-over-hand shuffle reads as intent, not
   error; revisit only if strip 1 lands and the grope then looks cheap beside
   it.

Sources of record: room.js KING.walk / stepKing / HOLMES.walk (the machinery
and the anchor law), CONTENT-odyssey.md staging columns (the scripted walks),
sets/{shore,cave,sea}.js (every slide named above, line-verified 2026-08-15),
tools/ody/actors.json (all source px/pins).
