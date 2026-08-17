# EXPLORER-D — motion physics (code-only)

> **ADOPTED 2026-08-16 (LANE PHYSICS).** `gaitProfile`/`gaitAt`/`gaitBobY`/
> `walkToward2` + the `placeStrip` bob option are shipped in
> `site-deploy/living-odyssey/app/setkit.js`, and EVERY walk/crossing call
> site in the three sets runs on them (cave: giant entry + both flock
> crossings, the entry file, the crew re-stages, the ram-stream walkers;
> shore: the wade, the hunt, the council re-stages, the dash aboard). The
> audit's two extra defects are fixed: (a) `alongPath` per-segment vertex
> pops — retired, every path walk is arc-length parameterised
> (`alongPathArc`); (b) THE RAM-STREAM SLIDERS — **option chosen: bob+sway
> gait on the static cuts** (the registry ships no slung strips, and
> compositing static slung men over ram-walk cells would scissor the baked
> lashings), driven by `glideStep`: burdened vmax 1.2 m/s, ease both ends,
> the ram strip's own pulse table, and the cell cadence applied as
> translateY bob (~2.5% body) + 0.55 deg weight-shift sway about the pin;
> stream stagger retimed (pairs k 0.24/0.30, great ram 0.38 of the 14 s
> seg) so every slider finishes its walk inside the seg at the burdened
> cap. The great ram's mouth-pin leg walks the same gait; the v-11
> trot-clear runs it at the verb's own 1.4 m/s. Tuning vs this prototype
> (every number lap-derived): `walkToward2` ease 0.25 s with the settle
> scaled to the walk (peak overshoot 0.35 x vmax — slow shore walkers do
> not lurch); the giant's dip is 0.28 (pulse peak 1.19x keeps his planted
> foot under the 2.5 css px/frame anti-skate budget at the flock zooms;
> CV still 16.8%) and his ease-in 0.45 s; CADENCE ATTENUATION everywhere
> (pulse depth scales down once the gait cycle beats ~1.1 Hz — a
> full-depth pulse at sprint cadence aliases into >25% one-frame pops at
> 30 fps; the hunt sprints at 0.17 s/cycle); the sliders gather over
> 0.5 s and their pulse fades with the ease-out (checking steps into the
> stop). The parking law then caught what no lap had ever sampled: the
> ENTRY FORMATION's back half stood inside the woodpile once the file was
> allowed to settle — swept to two files of six west of the hearth.
> Lap gates: `[gait]` in `tools/ody/lap-ody.mjs` — per adopted walk (16
> walks over 10 units), CV(mid70) >= 0.15, no one-frame speed change
> > 25% of cruise (absolute floor max(6 px/s, 18% of peak)), first/last
> 200 ms mean < 60% of cruise where the lap can hold the onset/stop,
> recorded at 30 fps by the same single-stepped probe that holds
> `[anti-skate]` — probes placed at each walk's own t0 (unit entry, the
> G5 hit for the stream, post-shot for head2 whose onset the page turn's
> cover owns).
> Residue (out of this lane's scope, still open): Ulysses' 302 px
> stand-cut slide at cave entry now carries the pulse warp but still has
> no walk strip engaged (`want.u.vis = -1` starves the `moving` test).

**Hypothesis tested:** the "drifting/floating" read is driven by the MOTION, not
the art — constant-velocity translation with no step pulse, no ease, no settle.

**Verdict: CONFIRMED, and fixable with ~120 lines against data the registry
already ships.** A `walkToward2` prototype (per-step velocity pulse locked to
the strips' own contact frames, 150–250 ms ease-in/out, a 2-frame arrival
settle, and step-synced bob derived from the anchor deltas in
`tools/ody/strips.json`) turns the giant entry and the crew crossing from
mathematically smooth glides into walks with per-step structure — while the
King anti-skate law holds to the pixel (23.0 px/cell before AND after, registry
22.36). The strips were never the problem; the driver was.

## Where the prototype lives (shipped sets untouched)

- `tools/ody/seamless/physics-proto/site/` — full copy of
  `site-deploy/living-odyssey` (assets symlinked), modified:
  - `app/setkit.js` — `gaitProfile()` (reads plant frames off a strip's
    anchors), `gaitAt()`, `gaitBobY()`, `walkToward2()`, and `placeStrip()`
    grows a `bob` option (translateY about the foot origin).
  - `app/sets/cave.js` — giant walk integrator swapped from
    `min(ease·len, s + vmax·dt)` to a velocity-integrated gait; entry-seg crew
    lerp pulse-warped; `walkToward` → `walkToward2` for crew re-stages;
    step-bob on the giant and crew strips.
- `tools/ody/seamless/physics-proto/probe.mjs` — headless 30 fps recorder
  (`__advance` substeps, rendered boxes via `getBoundingClientRect → toPlate`,
  the `_motionaudit.mjs` pattern — no `__renderNow`).
- Data/plots: `physics-proto/out/{old,new}-{giant,crew}-entry.ndjson`,
  `out/velocity-profiles.png`. Sheet: `explore-physics-sheet.jpg` (this dir).

## The four mechanisms, and where each came from

**(a) Per-step velocity pulse.** The anchors already encode the contacts: the
KING law's planted foot swaps once per half-cycle, and the swap is the largest
|anchor delta| in each half. Read off `strips.json`: polyphemus-walk plants at
cells **3 and 7**, crew-walk at **1 and 4**. `gaitProfile()` builds a mean-1
speed table (dip 0.68× at the plant, rise 1.32× mid-swing); phase is the SAME
gait clock that picks the cell (`distance / pxPerFrame`), so the dip lands ON
the plant by construction and average speed is preserved.

**(b) Ease-in/out.** 250 ms ease-in from rest (giant; 200 ms crew); ease-out
over the last `vmax × 0.18 s` of path.

**(c) 2-frame settle.** At arrival: ~3 px past the mark along the travel and
back over ~4 frames at 30 fps (giant); `walkToward2` does the same (1.6 px)
for any re-stage whose peak speed reached half of `vmax`.

**(d) Step-synced bob.** `translateY` on the strip box: ±2.4% of the giant's
300 px height, ±1.5% of a crew man's 73 px, phase-locked to the plant table —
body low at the plant, high mid-swing.

## Profiles, before → after (30 fps, mark ground speed, rendered boxes)

| walk | dist px | peak | mid px/s | CV mid | rise→80% | fall-from-80% | box bob range | settle |
|---|---|---|---|---|---|---|---|---|
| giant entry, shipped | 368 | 77.7 | 74.9 | **8.9%** (ruler-flat clamp) | 32f | **4f dead stop** | **0.02 px** | none |
| giant entry, proto | 368+6 overshoot | 102.4 | 71.6 | **23.9%, structured at cadence** | 3f | 17f eased | **7.2 px** (2.4% body) | 4f |
| crew11 crossing, shipped | 270 | 127.5 | 102.6 | 21.1% (pure ease shape) | 22f | 22f | **0.02 px** | none |
| crew11 crossing, proto | 270 | 170.9 | 93.6 | **42.4%** | 20f | 33f | **2.2 px** | via ease |
| anti-skate (both) | — | — | — | — | — | — | — | **23.0 px/cell** vs registry 22.36 (+2.9%), 16 cells/368 px, unchanged |

The cell-binned speeds prove the lock: proto giant mean speed dips to 56/57
px/s exactly at cells 3 and 7 (the plants) and peaks 88–100 px/s mid-swing;
shipped is 77 px/s at every cell (see `out/velocity-profiles.png`, panel 4).

## What the side-by-side sheet shows (`explore-physics-sheet.jpg`)

Rows 1–2 (giant, same wall-times): the proto giant leads early (real ease-in
vs the authored ease's 1.1 s crawl under the clamp), visibly rises/sinks
through the stride, decelerates into the seat and settles; shipped translates
rigidly and stops dead. Rows 3–4 (crew): same file, same marks — the proto
file breathes at cadence (men bunch slightly at plants, stretch at swing) and
carries step-bob; feet honest in both.

## Caveats / tuning knobs

- Pulse depth (`dip: 0.38`), bob amps (`BOB_AMP`), ease windows and the 3 px
  settle are first-pass values — tune on sight. CV 42% for crew is at the top
  of the real-walk band (30–60%); `dip 0.3` would soften it.
- The velocity model arrives when the PATH is spent, so the giant lands
  ~0.2 s off the authored `dur` (earlier here); segs already tolerate that
  ("a capped walk hands back a beat late").
- The pulse raises PEAK speed (mean preserved) — crew11's 171 px/s momentary
  peak rides an entry seg that already asks 103 px/s mid (over WALK_V.man 86);
  the seg's asked speeds are a pre-existing issue, not introduced here.
- Not addressed (separate defects the audit already itemises): Ulysses'
  302 px stand-cut slide in cave-entry (his strip never engages there), the
  ram-stream static cuts and `alongPath` per-segment vertex pops, and the
  grope/tip-over glides (intentionally left on their authored clocks).
- `walkToward2` currently replaces the damp with a bounded ease-out (kills the
  1.5 s sub-6 px/s terminal stand-drift); if the damp's long-tail feel is
  wanted elsewhere, keep `walkToward` for sub-walking nudges.

## Reproduce

```
node tools/ody/seamless/physics-proto/probe.mjs site-deploy/living-odyssey old
node tools/ody/seamless/physics-proto/probe.mjs tools/ody/seamless/physics-proto/site new
```
