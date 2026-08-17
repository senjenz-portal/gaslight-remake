# PLACEMENT AUDIT — living-odyssey, round-7 lap (2026-08-16)

**Scope.** Every settled tableau shipped in `site-deploy/living-odyssey` (sets
`shore` / `cave` / `sea`), audited against the round-7 lap shots
(`shots/ody-round7/`) and the scene ledger (`tools/ody/ledger.json`), on three
laws: (a) **perspective honesty** — the plate's own local px/m at the actor's
floor point (measured off in-plate yardsticks: pen sheep, fence rails, wall
courses, ewes, tubs, hull, mast) vs the drawn actor height, flag >12%;
(b) **contact honesty** — the foot line on a plausible support vs across a
paint boundary; (c) **crowding** — an actor within half a body of a
similar-tone painted object (or another actor) so it reads as a merger.

**Method.** Plate→shot mapping calibrated off `b1-01-head1.png` (k=1):
`shot_px = (1020,420) + 1.252 · (plate_px · k + camXY(lens))`, lens per unit
from `app/units.js`, cam law from `app/stage.js applyCam()`; sea shots add the
world transform about deck (575,450) (`wk` = 0.86 verified on `b6-72-menbeg`).
Sea actors and paint live in one `world` group, so actor-vs-paint contact
there is transform-invariant. All evidence crops under
`tools/ody/seamless/crops/` (plate crops carry a 10 px plate grid with
labelled 50 px lines; shot crops carry mark crosses at the set's own numbers).
Marks/heights transcribed from `app/sets/{shore,cave,sea}.js`, which the audit
read directly — nothing re-derived from the ledger alone. **NO fixes applied.**

**Set scales (drawn law):** shore 11.3 px/m (U 20 px, crew 19), cave 43 px/m
(U 75, crew 73, giant 300/165, sprawl h70), sea 12.7 px/m (U 22, rower 15,
giant 89).

---

## RANKED DEFECT TABLE

| # | Sev | Class | Set | Defect | Plate coords (marks) | Units affected | Evidence crops |
|---|-----|-------|-----|--------|----------------------|----------------|----------------|
| 1 | SEVERE | contact + crowding | cave | **The huddle stands inside the giant's painted bed.** All 10–12 crew feet (grid 1136–1193, 446–488) + Ulysses (1120,478) land on the bed's log frame and bedding; the ledger's own `huddle-far` mark (1160,465) sits **inside its own bed box** [1025,330→1240,500] (35 px from the bottom rail, 80 px from the right). The men read standing ON the bed, front row on the `logsRight` pile [1105,480→1180,520]. | huddle-far (1160,465); FORM.huddle 1136..1193 × 446..488; U_AT.huddle (1120,478) | ody-ii-03, ii-05, ii-10/iii-01/iii-07 (meal huddles), ii-13, iii-03, iv-06 | `G-cave-huddle-bed.png` (plate), `G2-shot-return2-huddle.png`, `G3-shot-tillmorning-huddle.png` |
| 2 | SEVERE | contact | cave | **Ulysses walks through the burning hearth, and the `scheme` mark is on the hearth rim.** The mark (640,480) lands on the raised stone ring's front rim face (ring is a masonry hearth, not flat paint); the damp walk to it is a straight line with no obstacle law, so the b3-31 settle shows him mid-stride ON the ember bed inside the ring. Ledger note says "alone among the pens" — the mark is at the fire, not the pens. | scheme (640,480); fireRing box [527,418→733,500], pit (630,460) | ody-iii-03 | `F-cave-firering-marks.png` (plate), `F3-shot-scheme.png` |
| 3 | SEVERE | contact | cave | **The suppliant stands on top of a painted log bundle.** An unregistered second wood pile (~[645,462→745,497] — NOT the ledger's `firewood` [495,495→620,555]) lies right-front of the hearth; the `suppliant` mark (690,495) puts both sandals on its top log, elevated above the floor. Ulysses parks there from ii-06 onward, so the defect is in frame for the plea AND all three meal tableaus. | suppliant (690,495) | ody-ii-06, ii-07..ii-09 (twoshots), ii-10, iii-01, iii-07 | `F-cave-firering-marks.png`, `F2-shot-plea-suppliant.png`, `P-shot-firstmeal.png` |
| 4 | SEVERE | perspective | shore | **Far-lobe scale: the mainland party is ~40% too small.** Local px/m at the mainland apron/yard measured off five painted pen/apron sheep (19–22 px long, mean 20.2 → 19.2 px/m), pen fence 18 px (~20 px/m), yard-wall courses ~26 px (~20 px/m). Actors mount at 11.4 px/m (U 20 px): **Δ ≈ 40%** (>12% law). On camera the men stand beside sheep as tall as themselves; the ledger logged the deviation ("pen sheep ~19 px = 1.7 m") and ruled for the ship — the rule is honest at the ship, wrong at this mark. | entry-mainland (1008,268) + crew (988,264)(1024,271)(972,258); climb-path (940,325) + file (952..1024, 328..349) | ody-i-08, i-09, i-12 (climb behind the risen inset) | `A2-mainland-sheep-zoom.png`, `A3-mainland-apron-zoom.png`, `A4-shot-entry-mainland.png`, `A-shore-mainland-day.png`, `D-shore-climb.png` |
| 5 | SEVERE | perspective | cave | **The sprawled giant is drawn one-third short.** Sprawl cut drawn 202.7 px head-to-feet (h 70, box [645.5,477→848,547]) vs his own standing law 300 px (43 px/m × 7 m): **−32%**; vs the local downstage yardstick (front-pen ewe 50 px/1.05 m = 47.6 px/m → honest supine ≈ 333 px): **−39%**. Beside the 206 px-wide hearth he measures 1.0× a hearth he should overshoot 1.5×. Sprawl box also overlaps the unregistered log bundle (head end) and the painted clay bowl (832,520) at the feet. | SPRAWL.at (664,546), box [645.5,477→848,547] | ody-ii-11, ii-12, iii-13, iv-01..iv-05 | `F6-shot-sword.png`, `F7-shot-auger.png`, `F-cave-firering-marks.png` |
| 6 | MODERATE | contact + crowding | cave | **Bowl-offer stands on the hearth rim, with a duplicate bowl.** Mark (700,468) is inside the fireRing box; the drawn feet straddle the rim block's top face / floor seam. The G3 prop bowl (16 px, drawn at the hold anchor) floats at his waist while the `ulysses-offer` cut already paints its own raised bowl — two bowls in frame through the pour sequence. | bowl-offer (700,468); holdAnchor (700,441) | ody-iii-08, iii-09, iii-10, iii-11 | `F4-shot-lookhere-bowl.png`, `F8-shot-neck-sprawl.png`, `F-cave-firering-marks.png` |
| 7 | MODERATE | contact (tableau) | cave | **"At the sleeping throat" no longer reads.** The sprawl was nudged to head pin (664,546) but `sword-ulysses` stayed ledger-verbatim at (768,462): Ulysses now stands 134 px (3.1 m at 43 px/m) from the head pin, over the giant's belly/hip — the G2 ring circles his hip mid-torso of the body, and the sword-to-throat line of ii-11 is gone. Mechanically G2 anchors fine; the tableau is what broke. | sword-ulysses (768,462) vs sprawl head (664,546) | ody-ii-11, ii-12 | `F6-shot-sword.png` |
| 8 | MODERATE | crowding | cave | **The racks file is a solid wall of interpenetrating carry cuts.** `F.racks` spots are 20 px apart but the `crew-carry` cut draws 98.7 px wide at h 73 — each man overlaps his four neighbours; the walk to the line also crosses the hearth (same no-obstacle beeline as #2): the b2-15 settle catches five men striding over the rim and pit. | F.racks (542..762, 414..403); U (600,432) | ody-ii-01 | `H2-shot-beg-racks.png` |
| 9 | MODERATE | perspective | cave | **Ram actors are 1.8–2.3× the plate's own stock.** Painted ewes measure 20–25 px tall (ledger's own yardstick, 45 px long = 1.05 m); the `ram-walk` strip draws 45 px tall and the lashed `ram-pair-slung` 57 px tall — beside the pens they read as a different species. Only the GREAT ram (83 px tall, 104.8 px long) is licensed anomalous by the ledger (100–110 px long — compliant). | TRIOS (930,538)(1010,534); flock walkers on flockOut/ramEscape | ody-v-02..v-07 escape stream, dawn5 | `J-shot-greatram.png` (pairs vs penned ewes), `L-shot-feltbacks.png` |
| 10 | MODERATE | contact + crowding | cave | **Trio 1 is parked on the painted milk tub; trio 2 on the pen-fence corner.** Pair box at (930,538) spans x 863.6→983, y 481.6→538 — covering the milk tub [865,495→915,520+] face (wool over milk); at (1010,534) the pair stands across the front pen's painted corner rails, wool merging with the penned ewes behind. | TRIOS (930,538), (1010,534); milkTub (890,495); frontPen [860,425→1090,525] | ody-v-02, v-03, v-04, v-05 | `J-shot-greatram.png` (bottom), `K-shot-withies-trios.png`, `H-cave-ramstand.png` |
| 11 | MODERATE | crowding | shore | **Council: Ulysses merges with the black stern curl; the crew arc stands beside a 5 m painted goat.** U mark (510,492) is ~6 px from ship-2's stern-curl base (curl mass ~x 495–545 down to y ~500) — dark tunic on near-black hull, less than half a body. The day plate's goat (body 395–450 × 465–530, 61 px tall = 5.4 m at set scale) stands 0–10 px from c0 (426,501); crew 19 px vs goat 61 px: the yardstick 10 px from the settle implies ~50 px/m vs the drawn 10.9 px/m. | council-ulysses (510,492); crew (426,501)(445,507)(464,511) | ody-i-06, i-07 | `E-shot-council.png`, `E2-plate-council-day.png` |
| 12 | MODERATE | crowding | cave | **Lots circle: three neighbour gaps under 12 px for 27 px-wide bodies, and the stake floats at head height beside the arc.** Spot gaps 743→750 = 11.4 px, 680→676 = 8.9 px, U (711,542)→(702,538) = 9.8 px → deep interpenetration; the "hidden" stake prop (butt at 790,500, 41 px tall, rot 4°) draws at the right men's head line, touching the (743,522)/(750,531) men — it reads as a floating beam, not a thing hidden under dung flecks. | F.lots (676..750, 517..538); U_AT.lots (711,542); stake-hide (790,500) | ody-iii-05, iv-01 (stake at rest) | `F5-shot-lots.png` |
| 13 | MODERATE | contact | cave | **Stake-five spots sit on the hearth's upper-left rim stones.** (522,459) is 5 px outside the declared fireRing box but ON the painted rim (the paint is wider than the box at that corner); (492,441) likewise; the b4-45 frame shows a carry man standing on the rim's top face. | F.stakefive (522,459)(492,441)(472,481)(500,491) | ody-iv-01..iv-05 (drive party) | `F7-shot-auger.png` (top-left), `F-cave-firering-marks.png` |
| 14 | MINOR | contact | cave | **Doorway-seat giant reads floaty.** Mark (345,420) sits at the aperture bottom (415) while the downstage floor line at x 345 runs at y≈482; seated in the arch is plausible, but with no contact shadow and knees over the descending threshold rubble the 165 px giant reads levitating at k 2.4. Same read for the v-07..v-10 stroke pose. | doorway-seat (345,420); mouthAperture [290,250→405,415] | ody-iv-12, v-00, v-05..v-10 | `I2-shot-doorway.png`, `I-cave-mouth.png` |
| 15 | MINOR | contact | shore | **Twelve-at-ship right flank stands across the painted oar blades.** Marks x 574–639 (y 503–507) sit where ship-1's painted oars meet the sand; blades cross feet/heads. Left flank x 486–551 sits inside the generous hull CLICK box (y≤502) but on clean sand paint — fine visually. `beachY` clamps flat past the polyline's end (x>610), marks 613–639 ride the clamp. | twelve line (486..639, 492..507); U (560,503) | ody-i-10, i-11 | `C-shore-twelve-day.png`, `C2-shot-wineskin-twelve.png` |
| 16 | MINOR | perspective | shore | **Camp dressing is hero-scale around a 20 px man.** Fire ring 70 px (6.2 m), logs 55–60 px (~5 m) — declared in the ledger as a painted hero-scale light source, but at the camp settle Ulysses (390,480) and three crew stand directly against it, so the settle reads toy-figure-in-a-giant's-camp. Borderline-accepted (declared deviation), logged for completeness. | fire-ulysses (390,480); crew (456,492)(474,497)(492,502) | ody-i-02, i-03 | `B-shore-campfire.png`, `B3-shot-bard-wide.png` |

---

## Detail + arithmetic

### 1. Huddle in the bed (cave)
- Bed (ledger `objects.bed`): [1025,330]→[1240,500]. logsRight: [1105,480]→[1180,520].
- Formation: `F.huddle[i] = (1136 + (i%4)·17 + (i>>2)·3, 446 + (i>>2)·13 + (i%2)·2)`
  → all 12 spots inside the bed box. Ledger mark (1160,465) itself inside by
  (80 px right margin, 35 px bottom margin) — the ledger self-contradicts its
  "right of the bed" note.
- `G3-shot-tillmorning-huddle.png`: front-row sandals on the near log rail,
  back rows on the mattress; `G2-shot-return2-huddle.png` same with U on the
  rail log. Similar-tone merger: dark-tunic men against dark bedding in the
  embers state (ii-13/iii-03 play dark).

### 2 + 8 + 13. The hearth is a raised object no walk or mark respects (cave)
- The paint: a masonry ring, rim ~15–25 px wide, raised ~15 px, ember bed
  inside; box [527,418→733,500] under-covers the rim's upper-left corner.
- Marks ON it: scheme (640,480) — rim front face; bowl-offer (700,468) — rim
  top; stakefive (522,459)/(492,441) — rim upper-left.
- No walk law avoids it: `walkToward` is a straight damp with a speed cap
  (sets/cave.js) — b3-31 (`F3`) catches Ulysses striding across the embers;
  b2-15 (`H2`) catches five carry men on the rim and pit floor.

### 3. The unregistered log bundle (cave)
- Painted bundle ≈ [645,462→745,497] (visible in `F-cave-firering-marks.png`),
  absent from `OBJ`/ledger objects — the parking sweeps (round 2) cleared the
  OTHER pile (`firewood` [495,495→620,555]) and never saw this one.
- suppliant (690,495) puts both feet on its top log (`F2`, `P`); the sprawl's
  head end lies across it (#5); the lots circle's north edge grazes it.

### 4. Far-lobe numbers (shore)
| yardstick | px | real m | implied px/m |
|---|---|---|---|
| pen sheep ×4 (1037–1057, 1000–1022, 1043–1062, 1078–1098) | 19–22 long | 1.05 | 18.1–21.0 |
| apron sheep (905–925, 245–262) | 20 long | 1.05 | 19.0 |
| pen fence rails (x≈1015) | 18 tall | ~0.9 | 20.0 |
| yard wall courses (x≈960) | 26 tall | ~1.3 | 20.0 |
| **local mean** | | | **≈19.5** |
Drawn actors 11.4 px/m → **Δ ≈ 40%** at entry-mainland/climb. (The strait is
one plate: the ship yardstick 11.3 px/m holds only on the island half.)

### 5. Sprawl shortfall (cave)
- Drawn: h 70 → box 202.7 px long (cut 1306×451, k=0.1552).
- Standing law: 300 px. Supine ≈ standing → −32%.
- Local yardstick at y≈470–547: front-pen ewe 50 px/1.05 m → 47.6 px/m →
  honest ≈ 333 px → −39%.
- Cross-read in-frame: hearth 206 px wide; a 7 m body should overshoot it
  1.46×; he measures 0.98×. (`F6`)

### 7. Sword mark vs nudged sprawl (cave)
- head pin (664,546) ↔ mark (768,462): √(104² + 84²) = 133.7 px = 3.1 m.
- U stands at body-centre x (746 ± 20), i.e. over the belly/hip; the drawn
  box's head end is 123 px left of him. (`F6`)

### 9 + 10. Ram scale and trio contact (cave)
- Painted ewes (ledger's own three): y-spans 23 / 25 / 20 px (heights).
- ram-walk drawn 45 px tall (+80–125% vs stock); ram-pair-slung 57 px tall
  (+130–185%); great ram 83 px tall / 104.8 px long — licensed (100–110 spec).
- Trio 1 pair box (930,538): x 863.6→983.0, y 481.6→538 — overlaps milkTub
  face [865→915 × 495→520] fully in x, 38 px in y (`J` bottom). Trio 2
  (1010,534) stands across the front pen's corner rails.

### 11. Council merger + goat (shore, day)
- Stern curl painted mass ≈ x 495–545, base to y ≈ 500; U (510,492) inside
  its footprint's left edge; half-body = 10 px, distance ≈ 5–10 px. (`E`, `E2`)
- Day goat: 61 px tall / ~55 px long at (395–450, 465–530) → 5.4 m tall at set
  scale, 0–10 px from c0 (426,501). Same class as the declared hero-scale fire
  ring, but here it stands INSIDE a peopled settle.

### 12. Lots circle gaps (cave)
- Body width at h 73: ≈ 27 px (crew cuts 266–276 px wide at 620–635 tall).
- Gaps: 676↔680 = 8.9 px, 702↔U(711,542) = 9.8 px, 743↔750 = 11.4 px, rest
  21–25 px. Stake prop drawn 41 px tall × 84 px long at (790,500) rot 4° —
  its beam crosses the right arc's head line (heads at y ≈ 449–458). (`F5`)

---

## Observations — NOT filed as defects
- **Lap-timing artifacts, not placement:** b1-03 camp is empty (party still
  mid-walk from the wade line — `B3` shows them at the waterline on b1-02);
  b5-66 freed marks are empty (escape walk still running, `M`); b3-41 neck
  shows the giant mid-collapse-bridge (`F8`); b6-69 taunt draws BOTH stern
  cuts at ~half opacity (crossfade caught mid-swap, `N`).
- **Sea checks out.** Rowers (15 px) and U (22 px) are honest to the hull
  (190.8 px / 15 m); marks sit on the deck line; the clifftop mark (860,210)
  sits on the ledger's own brow polyline ((870,215) node) — `O3`, `N`, `N2`.
  Minor: actor oars sweep inside the hull while the painted oars stand in the
  water (double-oar read); no contact/scale breach.
- **Borderline (−12%, at the law's edge):** cave crew 73 px at downstage marks
  (lots, huddle, entry) vs the front-pen ewe's 47.6 px/m → honest ≈ 83 px.
  Logged, not flagged.
- **Declared deviations honoured:** ledger already logs the hero-scale fire
  ring (6.2 m) and the far-lobe sheep; the RULING ("the ship wins") is what
  #4 and #16 put in evidence at the specific marks it fails.
- b2-15 carry cuts read as men carrying TIMBER in the cheese tableau (O.3 is
  "laden with cheeses") — an art/asset note, out of placement scope.

## Method appendix
- Calibration residual: mean |Δ| 6.6 grey levels over the full plate at k=1
  (shore), 5.7 (cave) — sub-pixel fit; constants (1020,420)×1.252 hold for all
  landscape shots (portrait shots not used; same tableaus).
- Shot marks can sit a few px off drawn feet where the camera damp had not
  settled at capture (E, G2, O) — all contact verdicts above rest on
  plate-space geometry (`crop_plate` crops), with shots as the read test.
- Crop tool: `tools/ody/seamless/croptool.py` (mapping + annotation);
  crop inventory: 42 files under `tools/ody/seamless/crops/` keyed A–Q by
  defect area (A mainland, B camp, C twelve, D climb, E council, F hearth,
  G huddle, H racks/ram-stand, I mouth, J great ram, K trios, L feltbacks,
  M freed, N sea stern/deck, O clifftop, P firstmeal, Q crag).
