# Motion-continuity audit — living-odyssey (measured between frames)

Owner report: characters "drifting and floating on the background". Sampled
stills passed all gates, so every key crossing/walk was recorded CONTINUOUSLY
at 30 fps (`__advance(1/30)` per sample, full duration each) and the actors'
screen positions were extracted per frame from the RENDERED boxes
(`getBoundingClientRect -> toPlate`, transforms included) plus the pose marks
and strip frames. Probe: `tools/ody/seamless/_motionaudit.mjs`; stats:
`tools/ody/seamless/_motionstats.py`; raw NDJSON: `/tmp/motion/*.ndjson`.
NO fixes applied — numbers only.

## Measurement hazard found on the way (why the stills lied)

`__renderNow()` is `step(0)`: a dt=0 step. In a dt=0 step every stride
detector reads speed `dd/dt = 0`, so `P.walking` flips FALSE, the walk strip
is hidden and the STAND cut is repainted at the moving mark — in the first
recording pass (advance → renderNow → sample) every walker in the book showed
as a standing cut mid-walk (`strip op 0, stand op 1` while covering ground).
Any still captured with the `_motionprobe.mjs` pattern (advance, renderNow,
screenshot) photographs that corrupted world: walkers stripped of their gait.
The data below was re-recorded WITHOUT `__renderNow` (the `__advance` substeps
already paint), and jump-contaminated walks (a `__gotoUnit` replay zeroes pose
opacities, which degenerates a staging walk into land-on-mark + fade) were
re-driven reader-style with `__click`/`__gateClick` from an earlier unit.

## Metrics

- **v** — px/s off the pose mark between consecutive 30 fps samples.
- **CV(mid)** — std/mean of v over the middle 70% of the move; a real walk
  pulses per step (per-step CV typically 30–60% with structure at cadence);
  a smooth authored ease reads ~20% with ZERO frame-to-frame structure; a
  clamped glide reads ~0%.
- **max-jump** — largest single-frame |Δv| mid-path, % of mid mean.
- **onset/offset** — frames from rest to ≥80% of peak, and ≥80% back to rest.
- **bob** — std of the rendered box-bottom (feet) residual vs a 0.5 s moving
  average, measured over walking frames. Note `placeStrip` pins the box top at
  `y − hPx` rigidly (transform = flip only), so measured feet-bob == top-bob to
  3 decimals everywhere: the sprite BOX translates rigidly; whatever bob the
  cell art contains never moves the box. Real-walk expectation ≈ 3–4% of body
  height.
- **steps / slip** — strip cell advances (mod 10) counted over walked px vs the
  registry `pxPerFrame` (King law). "0 steps over D px" = a cut sliding.

## Per-motion numbers

### 1. shore-landfall (i-01 `bard`, seg 8 s) — the wade into camp
| actor | dist px | peak px/s | CV mid | max-jump | onset→80% | 80%→stop | bob px | steps | slip |
|---|---|---|---|---|---|---|---|---|---|
| ulysses | 209 | 41.1 | 19.6% | 3% | 68f (2.3 s) | 69f | 0.024 | 122 | +0.1% |
| crew0 | 164 | 32.5 | 19.8% | 2% | 69f | 69f | 0.016 | 100 | +0.7% |
| crew1 | 111 | 21.9 | 19.8% | 3% | 68f | 68f | 0.009 | 66 | +0.8% |
| crew2 | 148 | 29.1 | 19.9% | 3% | 68f | 68f | 0.009 | 90 | +0.3% |

Ease-in/out present and smooth; strips cycle honestly. Defects: bob ≈ 0
(expect ~0.6–0.8 px at 19–20 px body height); the profile is one 8 s
mathematically smooth glide — zero per-step pulse; each walk ends with a
2.1–4.1 px / 0.6–1.3 s sub-6 px/s drift on the STAND cut (the
`STRIDE_MIN_SPEED` swap fires at 6 px/s and the ease tail keeps sliding).
Translation speed itself is a march: Ulysses mid 33.6 px/s = 3.0 m/s at
11.3 px/m, cadence 16.9 cells/s ≈ 3.4 steps/s.

### 2. shore-hunt (i-05 `dawn1`, seg 5 s + damp home)
| actor | dist px | peak px/s | CV mid | onset→80% | bob px | steps | slip |
|---|---|---|---|---|---|---|---|
| crew0 | 221 | 84.9 | 59.3% | **0f — v(f1)=84.9** | 0.081 | 134 | +1.5% |
| crew1 | 234 | 93.2 | 62.0% | **0f — v(f1)=93.2** | 0.063 | 143 | +1.1% |

`easeOut` has derivative 3 at k=0: the hunters go 0 → 84.9/93.2 px/s
(7.5–8.2 m/s) in ONE frame from a standing start. Outbound decays to a full
stop at f147–148 (v = 0.0), then the damp RESTARTS them home instantly
(0 → 7.8 → 16.0 px/s across two frames, with a direction reversal) — a
stop-and-jerk at the seg→damp handover. The walk home is then 8+ s of
asymptotic crawl ≤16 px/s with a 2.3–2.5 px / ~1 s terminal stand-cut drift.
They ride the WALK strip at sprint speeds (momentary cadence ≈ 50 cells/s at
onset).

### 3. shore-council (i-06 `smoke`, live walkToward re-stage; recorded reader-style)
| actor | dist px | peak px/s | CV mid | onset→80% | 80%→stop | stand-glide | bob px | slip |
|---|---|---|---|---|---|---|---|---|
| ulysses | 119 | 17.2 | 7.8% | **0f — v(f1)=16.9** | 44f | 3.2 px / 1.60 s | 0.026 | −0.2% |
| crew0 | 141 | 15.9 | **1.4%** | 0f | 44f | 3.1 px / 1.50 s | 0.004 | +0.2% |
| crew1 | 154 | 15.9 | **0.8%** | 0f | 43f | 2.9 px / 1.20 s | 0.008 | +0.4% |
| crew2 | 28 | 16.0 | 49.8% | 0f | 42f | 3.3 px / 1.77 s | 0.148 | −0.7% |

The `walkToward` cap (WALK_V) clamps the damp's opening step: v jumps 0 → the
full walking speed in ONE frame and then holds ruler-constant (crew0 v range
over 140 mid frames: 13.6–17.2 px/s) — a constant-velocity glide with no
ease-in whatever. Offset is a 1.4–1.5 s exponential tail, whose last 3 px are
slid on the STAND cut below the 6 px/s stride threshold.

### 4. shore-crossing (G1 `council` gate) — dash aboard + strait
| actor | dist px | peak px/s | CV mid | onset | offset | bob px | steps | slip |
|---|---|---|---|---|---|---|---|---|
| crew0 run | 115 | 43.2 | **0.2%** | **0f — v(f1)=42.9** | **1f** | 0.013 | 33 | +2.4% |
| crew1 run | 104 | 43.2 | **0.1%** | 0f | 1f | 0.055 | 29 | +4.8% |
| crew2 run | 71 | 43.0 | **0.1%** | 0f | 1f | 0.294 | 20 | +3.4% |

The dash is `step = RUN_V·dt` verbatim: dead-constant 42.9 px/s from the first
frame to the last (v(f79)=42.9, v(f81)=21.6, then stop) — instant on, instant
off, zero bob. The ship crossing itself is a camera/lens travel (two eased
legs, `CROSS`), not an actor walk; its k advanced 0 → 1 smoothly over 7.0 s.

### 5. cave-entry (ii-00 `head2`, seg 5 s) — the men slip in
| actor | dist px | peak px/s | mid px/s | CV mid | onset→80% | bob px | steps | slip |
|---|---|---|---|---|---|---|---|---|
| **ulysses** | **302** | **142.2** | 115.2 | 20.5% | 28f | — | **0 — STRIP NEVER ENGAGED** | — |
| crew0 | 55 | 25.9 | 21.1 | 19.7% | 27f | 0.136 | 8 | +3.3% |
| crew5 | 155 | 73.2 | 58.8 | 21.0% | 29f | 0.234 | 23 | +4.2% |
| crew11 | 270 | 127.5 | 102.6 | 21.1% | 29f | 0.308 | 41 | +2.1% |

Verified live: during the whole seg Ulysses' visible node is
`uN.stand op 1, walk 0` (no strip exists for him in this set's seg path — the
entry seg sets `want.u.vis = -1`, so the `moving` test that swaps him to a
walk kind never fires). The lead figure of the file SLIDES 302 px = 7.0 m at
up to 3.3 m/s on the standing cut while the twelve men behind him stride
honestly. Crew speeds ramp to 102.6 px/s mid (2.4 m/s — the seg writes are
uncapped, over WALK_V.man 86 px/s), cadence up to 12.7 cells/s ≈ 2.5 cycles/s.
Bob 0.14–0.31 px on 73 px bodies (expect ~2.5 px).

### 6/7/8. THE GIANT's three walks (ii-03 `return2`, iii-02 `quiverlid`, iii-06 `return3`)
| walk | dist px | mid px/s | CV mid | max-jump | onset→80% | **80%→stop** | bob px | steps | slip |
|---|---|---|---|---|---|---|---|---|---|
| entry (giantIn) | 368 | 74.9 | 8.9% | 2% | 34f | **4f** | 0.328 | 16 | +2.9% |
| flock-out (giantOut) | 370 | 77.4 | **0.3%** | 2% | 13f | **1f** | 0.362 | 16 | +2.8% |
| flock-in (giantIn) | 368 | 76.8 | 3.3% | 3% | 24f | **1f** | 0.384 | 16 | +2.9% |

The authored ease peaks above the WALK_V.giant cap (103–161 px/s asked vs
77.4 granted), so the cap clamps the whole middle: flock-out holds
75.9–77.5 px/s for 110 straight frames (3.7 s ruler-flat, CV 0.3%). The walk
ends "when the path is spent": v goes 77.5 → 54.6 → 0 in TWO frames and the
pose snaps to seat/away — a 7 m, 300-px-tall giant stopping dead from full
stride with no deceleration. Bob 0.33–0.38 px ≈ 0.11% of body height (a real
walk is 3–4% — 30x more); the box glides rigidly. Feet are honest (slip
+2.9%, 23.0 px/cell vs 22.36 registry; cadence 2.9–3.2 cells/s), so the gait
cycles correctly UNDER a body that translates like a float.

### 9. cave-ram-stream (v-05 `dawn5`, flock escape 14 s) — THE RAM STREAM
| actor | dist px | peak px/s | CV mid | **max-jump** | bob px | steps | slip |
|---|---|---|---|---|---|---|---|
| ram0 | 476 | 110.7 | 28.8% | **49% @f126 (75.2→110.7 in 1 frame)** | 0.318 | 92 | +0.3% |
| ram1 | 476 | 110.7 | 28.5% | 26% @f155 | 0.315 | 92 | +0.2% |
| ram2 | 476 | 110.7 | 28.7% | 41% @f185 | 0.315 | 92 | +0.2% |
| ram3 | 476 | 110.7 | 28.7% | 37% @f214 | 0.315 | 92 | +0.3% |
| ram4 | 476 | 110.7 | 28.7% | 32% @f244 | 0.314 | 92 | +0.2% |
| **trio-pair0** | **476** | **132.9** | 28.5% | 26% @f239 | 0.415 | **0 — static cut** | — |
| **trio-pair1** | **476** | **132.9** | 28.6% | 41% @f290 | 0.418 | **0 — static cut** | — |
| **GREAT-RAM** | **427** | **166.9** | 33.5% | **83% @f333 (68.5→147.5→166.9 in 2 frames)** | 0.835 | **0 — static cut** | — |

Three sliding cutouts inside the chapter's hero moment: the two lashed
trio-pairs (men underneath!) cover 476 px = 11.1 m at up to 3.1 m/s, and the
GREAT RAM — Ulysses under it — covers 427 px = 9.9 m at up to **3.9 m/s**,
all with ZERO leg motion (`pinCut` static art; the great ram's only vertical
life is a 2.1 s sinusoidal hover, amplitude 0.4 px, unrelated to any stride).
They slide alongside five walkers whose strips cycle perfectly (slip ≤0.3%),
which makes the contrast maximally visible. On top of that, every glide uses
`alongPath` (per-SEGMENT parameterisation, not arc length): each polyline
vertex is an instantaneous speed step — ram0 pops +47% in one frame at the
flockOut seg2→seg3 vertex (100.7 px vs 148.1 px legs over equal param time,
ratio 1.47 = measured 110.7/75.2), and the great ram pops 2.2x at the
ramEscape seg2→seg3 vertex (86.2 px vs 212.9 px legs). The staggered starts
spread these pops into a rolling ripple of lurches from t≈4.2 s to t≈11.1 s.

### 10. cave-free-men (v-11 `freed`) — the ram trots clear
| actor | dist px | peak px/s | CV mid | onset | offset | steps |
|---|---|---|---|---|---|---|
| GREAT-RAM | 72 | 47.4 | 20.0% | 20f | 20f | **0 — static cut** |

Eased both ends, but again a static cut sliding 1.7 m ("the ram TROTS clear"
per the unit note — zero visual trot). The freed men fade in on their marks
(no walk to audit). The sea set's `return-beach` (vi-13) was inspected and
excluded: it is a world-scale layer glide (no actor walkers exist in that
set), so no character can float against it.

## Diagnosis rollup

- **(a) constant-velocity glide** — CONFIRMED, three mechanisms: the
  `walkToward`/dash caps clamp to exactly vmax (council CV 0.8–1.4%, dash CV
  0.1–0.2%, giant flock-out CV 0.3% for 3.7 s); the seg eases are smooth
  authored curves with zero per-step structure (CV ≈ 20% is the ease shape,
  max mid-path jump ≤5% — no pulse at cadence anywhere in the book).
- **(b) missing step-bob** — CONFIRMED UNIVERSALLY: rendered-box bob is
  0.004–0.42 px across every walker (0.02–0.5% of body height vs 3–4% real);
  `placeStrip`/`pinCut` pin the box rigidly, so no walker's body rises or
  falls with its stride. Feet-bob == top-bob to 3 decimals: the boxes
  translate as rigid floats.
- **(c) missing start/stop easing** — CONFIRMED at: hunt onset (0→84.9 px/s
  in 1 frame), council onset (0→16.9 px/s in 1 frame), dash onset AND offset
  (0→42.9→0, one frame each side), giant offsets (77.5→0 in 1–2 frames, pose
  snap), hunt seg→damp handover (dead stop then instant 16 px/s reversal).
  Plus the systemic terminal drift: every damped walk ends with 2–4 px of
  sub-6 px/s slide on the STAND cut (1.2–1.8 s of feet planted while the body
  creeps).
- **(d) stride slip (strip fps vs translation)** — PASSES wherever a strip is
  actually engaged: observed px-per-cell within +0.1…+6.4% of the registry
  (King law holds; hunt's apparent +12–16% was a sampling artifact, gone with
  modular cell counting). The failures of (d) are TOTAL, not fractional: the
  no-strip glides (great ram 427 px, trio-pairs 476 px each, Ulysses'
  cave-entry 302 px, great-ram trot-clear 72 px) advance infinite ground per
  visual step.

## The 3 worst offenders

1. **The ram stream's three sliding cutouts (v-05 `dawn5`)** — the great ram
   (Ulysses under it) glides 9.9 m at up to 3.9 m/s and the two lashed
   trio-pairs (men under them) glide 11.1 m at 3.1 m/s with zero leg motion,
   in formation with five strip-walkers whose feet are perfect — plus
   one-frame speed pops of +47% (walkers, every path vertex, rolling ripple
   t≈4.2–11.1 s) and +120% (great ram, f333). The chapter's climax is carried
   by its three most floating actors.
2. **Ulysses' cave entry (ii-00 `head2`)** — the lead figure slides 302 px =
   7.0 m in 3.3 s (peak 3.3 m/s) on the STANDING cut, strip never engaged
   (`want.u.vis = -1` starves the `moving` test), while all twelve men behind
   him stride honestly. First seconds of the cave leaf, dead centre of the
   establishing frame.
3. **The giant's three crossings (ii-03 / iii-02 / iii-06)** — 300-px-tall
   body clamped to a ruler-flat 77.4 px/s for ~4 s per crossing (CV 0.3%),
   vertical bob 0.33–0.38 px = 0.11% of height (~30x too small), and a dead
   stop from full stride in 1–2 frames with an instant pose snap. His gait
   cycles correctly beneath him, which is exactly what makes the rigid,
   never-decelerating body read as a float against the plate.

Honourable mentions: the council re-stage (instant 0→vmax onset + 3 px/1.6 s
stand-cut terminal drift — the pattern every damped walk in the book shares);
the boarding dash (CV 0.1%, instant on/off); the hunt (one-frame 7.5 m/s
onset, stop-and-jerk handover at f147–150).
