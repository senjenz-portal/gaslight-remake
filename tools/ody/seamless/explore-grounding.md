# EXPLORER C — CONTACT SHADOWS + FLOOR-PROP OCCLUSION

Hypothesis tested: **grounding is the cheapest big win** for the odyssey
actor cuts. Two mechanisms, both ports of proven sherlock patterns:

1. **Contact shadows** — the chase-set rig law (`living/app/sets/chase.js`
   `paintRigs`): shadow sized off the FOOT SPAN (`sw = span*1.55`, aspect
   0.42), opacity by depth (`0.42 + 0.30*s`). Ported into a deterministic
   generator: **`tools/ody/seamless/shadowgen.py`**.
2. **Floor-prop occluders** — the church-set `pews-front.png` pattern:
   pixel-exact restores of the plate's own props, alpha-cut and drawn last,
   so settled actors run behind them. Cutter + surveyed silhouettes:
   **`tools/ody/seamless/occluders/cutocc.py`**.

Sheet: `explore-grounding-sheet.jpg` (4 tableaux, BEFORE | AFTER).

---

## 1. shadowgen.py — what shipped

- Reads each cut's own alpha + the measured `tools/ody/actors.json`
  baseline/pin. The **foot band** (rows within max(6, 5%·h) px above the
  baseline) is projected column-wise into a soft floor ellipse — two planted
  feet come out two-lobed, `polyphemus-sprawl` comes out body-long (its
  ground contact IS the body), `crew-carry` comes out four-lobed.
- **Light-aware skew off the set's EMIS anchors** (`layers-<set>.json`):
  the strongest canonically-lit anchor casts the skew — cave = `fire`
  (638,427) on the shut family, shore = `fire` (438,466), sea = `moon`
  (474,242). Shear = 0.55·dx/|d| away from the light at the cut's default
  settle mark (ledger marks baked in; `--at X,Y` overrides).
- Pure function of (png, actors.json, layers json, mark): byte-identical
  reruns; no AI, no clock.
- Output: `shadows/<set>/<actor>-shadow.png` — **32 cave + 6 shore + 6 sea
  generated** — plus `shadowmap.json` per lane carrying the placement
  contract: `anchor` (the point that lands on the actor's PIN), scale by
  the actor's own `k = drawnH/cutH`, runtime opacity `0.42 + 0.30*s`
  (chase.js verbatim).

## 2. The five settles a floor-prop occluder seats best (measured)

Burial metric = occluder px drawn over the actor's silhouette at the ledger
mark (from `_work/compose_grounding.py`; `_work/burial-metrics.json`).

| # | settle (mark) | occluder cut | burial | verdict |
|---|---------------|--------------|--------|---------|
| 1 | **giant-seat (760,452)** — the meal clutch, x3 (ii-10/iii-01/iii-07) + drink/bowl | `firering-front.png` (ring's right lip, ground y503) | 417 px, rows y413–448 (left leg/foot behind the ring's right stones) | ADOPT — the most-repeated tableau in the book gets seated for one cut |
| 2 | **F.entry file (~y503–521)** — the laden crossing ii-00/01 (and every mid-floor walk x532–618) | `woodpile-front-{master,shut}.png` (pile crown, ground y550) | 289 px, rows y500–515 (feet+ankles tuck behind the logs) | ADOPT — reads as walking upstage of the pile, exactly the painting's depth |
| 3 | **milking (852,470)** — the seated giant at the tub cluster (K7/K8, c1, c9) | `tub-front.png` (milk tub, ground y546) | 208 px, rows y458–469 (tub rim crosses the lap) | ADOPT — modest but correct |
| 4 | **suppliant (690,495) + scheme (640,480)** (ii-06, iii-03) | `firering-front.png` front crown | **FAILURE FOUND**: 608 px of TORSO clip — the ledger marks sit ON the ring's painted stone band (y467–503), so "behind the lip" = inside the fire pit | RESTAGE, don't occlude: +12 px downstage sweep (parking-law spirit) + shadow — T2's AFTER shows it |
| 5 | **shore camp (i-02/03)** — fire-ulysses (390,480) + crew across the fire | `firepit-front.png` (near stones + logs, ground y507) | 1–5 px at 19–20 px actors | NO-OP — at shore scale the shadow does all the grounding; keep the cut only if a future close inset needs it |

**Tested and refused** (numbers, not vibes):

- **sea gunwale**: inner-gunwale top runs (495,447)→(667,500); every rower
  baseline sits 18–22 px UPSTAGE of it (rower-1n 444 vs 466, 2n 455 vs 475,
  3n 466 vs 484; far file 40+). Overlap **0 px** at all six marks, and the
  sternpost misses Ulysses' 10 px-wide cut by ~4 px. Not cut.
- **frontPen rails**: a rail fence is mostly gaps — a polygon cut carries
  pen-interior pixels (sheep) over the actor. Needs a silhouette-grade
  alpha (color-key the dark wood), and no settled actor overlaps it anyway
  (the stake work party at y538–549 is DOWNSTAGE of the fence ground
  ~y530). The tub (solid) is the pen cluster's real occluder — cut #3.

## 3. Occluder contract

`occluders/occluders.json`: per cut `{origin:[x,y], ground:y}` — paste at
origin, painter-sort by `ground` against actor baselines. Cave cuts are
**per plate state** (the room-dim law: the same stones are painted five
times) — `cutocc.py --all-states` cuts the full shut/embers/predawn/dawn
family; the tableaux states are cut. One law learned the hard way: an
occluder is only safe when its ground line is near-constant — the fire
ring's lip runs y503→y412 around the arc, so it must be used as the
crown+right-arc band it was cut as, against actors clearly upstage of the
LOCAL ground (T2's failure is what ignoring that looks like).

## 4. VERDICT

**Hypothesis holds — adopt, in this order:**

1. **Shadows first, everywhere: the big cheap win.** Every AFTER panel
   reads grounded from the shadow alone (T4 shore, where occlusion is a
   no-op, still visibly improves); cost is one ~1 KB PNG per cut per lane,
   already generated for all 44, deterministic, and the placement/opacity
   contract is the chase.js law the codebase already ships.
2. **Occluders second, cave only.** Three cuts pay: `firering-front`
   (seats the giant's 3-meal clutch), `woodpile-front` (seats every
   mid-floor crossing), `tub-front` (seats the milking giant). At shore/sea
   scale (15–22 px actors) occlusion is measurably a no-op — don't spend
   there.
3. **One restage, not an occluder:** plea/scheme marks want the +12 px
   downstage sweep off the ring band (T2) — file under the parking law.

Files: `shadowgen.py`, `shadows/{cave,shore,sea}/` (+ shadowmap.json),
`occluders/cutocc.py`, `occluders/*.png` + occluders.json,
`_work/compose_grounding.py` (repro), `explore-grounding-sheet.jpg`.
