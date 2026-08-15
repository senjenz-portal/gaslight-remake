# LEDGER.md — living-odyssey MEASURED SCENE LEDGER (runbook §2.5 + §3.2)

Measured 2026-08-14 off the shipped masters in
`site-deploy/living-odyssey/assets/set/{shore,cave,sea}/` (all 1408×768, the
engine's PLATE space, WIRING §7 — isometric: actor height never changes with
depth, only the floor line moves). Machine-readable twin: `tools/ody/ledger.json`
(every lens carries its computed landscape+portrait margins; **37/37 pass** the
no-dead-band check — the sea gained `strait`/`homeward`/`moonpath` in round 3,
the F2 recompose for the receded world). Verification renders in `tools/ody/work/` (`v-shore.png`,
`v-cave.png`, `v-sea.png`, `v-entry.png`, `cave-states-mouth.png`).

Light anchors (emissives, blooms, fogs) are NOT re-measured here — they ship in
`layers-{shore,cave,sea}.json` and this ledger cites them where a mark or gate
rides one.

---

## 1. Scale — the yardsticks (state the arithmetic)

**The plates are toy-scale dioramas and are not metrically self-consistent.**
Each SET therefore declares ONE yardstick — the painted object the actors must
stand against at the closest lens — and ledgers the deviations honestly.

### shore — 11.3 px/m (yardstick: ship-2, the crossing galley)

The painted hull shows **8 rowlocks a side = a twenty-oarer** — Butler's own
hull class (the club simile, cut III-6) — call it **15 m** tip-to-tip.

    sternpost curl (516,432) → prow curl (686,428)
    √(170² + 4²) = 170 px
    170 px / 15 m = 11.3 px/m      → Ulysses (1.75 m) = 20 px

Cross-check: ship-1 mast, foot (508,392) → head (505,287) = 105 px = 9.3 m at
11.3 px/m — right for a 15 m hull. Deviations: campfire ring 70 px (= 6.2 m —
painted hero-scale; it is a light source, not a stand-to object); mainland pen
sheep ~19 px (far-lobe dressing). **Ruling: the ship wins — actors board it,
line along it, click it (G1).**

### cave — 43 px/m (yardstick: the penned ewes)

The one in-plate object with a fixed real size: a low-poly ewe ≈ **1.05 m**
nose-to-tail.

    three ewes measured: 45 px (960..1005, 302..325),
                         50 px (935..985, 455..480),
                         40 px (830..870, 330..350)   → mean 45 px
    45 px / 1.05 m = 42.9 ≈ 43 px/m   → Ulysses = 75 px

Cross-checks that CLOSE: wicker pen fence ~36 px = 0.84 m (true sheep-fence
height); the mouth aperture is 160 px tall = 3.7 m — it seats a **~7 m giant
(300 px standing, ~165 px seated) filling the doorway**, which is exactly Beat
V's tableau. Consequences: the stake (6 ft) = **77 px**; the great-ram ACTOR
must be authored **100–110 px** long to hide a slung 75 px Ulysses (O.11) while
the painted 45 px ewes stay normal — the anomaly is what makes the hand-pass
read. Deviations: club visible run 205 px = 4.8 m (butt hidden behind the bed;
the mast simile is performed by the wide lens — no metric fact rides it); the
bed = 4.8 m (dressing — he sleeps on the floor among the sheep).

### sea — 12.7 px/m (yardstick: the same twenty-oarer)

    sternpost waterline (495,462) → bow tip (678,516)
    √(183² + 54²) = 190.8 px
    190.8 px / 15 m = 12.7 px/m    → Ulysses = 22 px, rower seated ≈ 15 px

Cross-checks: mast (578,462)→(580,350) = 112 px = 8.8 m; the headland, water
(770,540) → brow (790,192) ≈ 350 px = **27.5 m cliff**, so the 7 m giant =
**89 px on the brow** — legible from the ship at the establishing lens.
Deviation: the strait is compressed vs fiction; the receding-shore state
(headland transform) performs the distance.

---

## 2. Floor lines (y as f(x), plate px — where feet stand)

| set | floor | polyline | note |
|---|---|---|---|
| shore | beach (camp sand) | (300,455) (438,486) (540,500) (610,505) | walk line mid-apron, band ±18 |
| shore | mainland apron | (950,252) (1008,268) (1040,272) | grass threshold before the laurel mouth, band ±8 |
| shore | mainland yard | (940,300) (1010,318) (1090,330) | along the stone wall + pens |
| cave | downstage edge | (270,455) (450,520) (620,555) (800,565) (980,550) (1120,515) (1230,475) | floor meets the island rim |
| cave | upstage limit | (450,400) (530,388) (700,345) (880,330) (1000,390) (1020,430) | rack/pen/wall feet — stand BETWEEN the two lines |
| sea | **n/a — open water**, except: | | |
| sea | ship deck | (515,420) → (660,490) | y = 420 + 0.483·(x−515) |
| sea | clifftop ledge | (790,195) (870,215) (955,238) (1120,230) | the seaward brow — the set's only land floor |

---

## 3. MARKS (30 — plate px, foot-baseline)

### shore (6)

| mark | at | serves |
|---|---|---|
| fire-ulysses | (390,480) | i-02/03 — left of the fire ring (405..475), facing it |
| council-ulysses | (510,492) | i-06/07 — faces the crew, back to the strait |
| council-crew | (445,507) | i-06/07 — arc centroid facing him |
| twelve-at-ship | (560,503) | i-10 — lined on the sand along ship-2 (20 px men, ~8 abreast on the 170 px hull) |
| entry-mainland | (1008,268) | i-08/09/12 — grass apron between the flanking laurels (verified `v-entry.png`) |
| climb-path | (940,325) | i-12 — the party climbing behind the risen wineskin plate |

### cave (15)

| mark | at | serves |
|---|---|---|
| entry | (360,450) | ii-00 — lit threshold inside the mouth (K1) |
| cheese-rack | (640,405) | ii-01 — O.3 tableau before rack B (racks A..D feet x 535..880) |
| huddle-far | (1160,465) | ii-03/05/13, iii-03 — far dark right of the bed, under lampR |
| suppliant | (690,495) | ii-06 — arms wide, firelight between him and the bulk |
| giant-seat | (760,452) | ii-05/07/08, iii-08/09 — his working seat by the fire, bowls at his knee |
| milking | (852,470) | K7/K8, c1, c9 — the tub (890,495) + clay bowl (832,520) cluster |
| sprawl-head | (795,450) | ii-10/11, iii-13, iv-* — sprawl axis head; **feet (975,470)**, full length among the sheep |
| sword-ulysses | (768,462) | ii-11/12 — at the sleeping throat; G2 rides this mark |
| scheme | (640,480) | iii-03 — alone among the pens, push-in pivot |
| lots-circle | (600,505) | iii-05 — open floor left-front of the fire, overhead lens |
| stake-hide | (790,500) | iii-05, iv-01 — under the painted dung fleck (770..800,485..495) |
| bowl-offer | (700,468) | iii-08/10/11 — walk-to-the-fire stand; G3 anchor = raised bowl at chest (700,441) |
| ram-stand | (838,430) | v-04 — apart at the front pen's left rail; G5 anchor = body centre (838,415) |
| ram-at-mouth | (395,438) | v-07..10 — halted under the palm in the doorway |
| doorway-seat | (345,420) | iv-12, v-00/05/06 — the blind giant seated FILLING the 160 px mouth, hands spread |

### sea (9)

| mark | at | serves |
|---|---|---|
| clifftop-giant | (860,210) | vi-01/03/08/09/11/12 — feet on the brow; the boulder pile (850..1100, 30..170) behind him is the ammunition |
| stern-ulysses | (518,426) | vi-02/04/06/10 — standing at the stern |
| stern-rail | (506,406) | vi-07 — steps ONTO the rail for the self-naming (O.12) |
| rower-1n/2n/3n | (556,444) (586,455) (616,466) | the six at the oars, near file |
| rower-1f/2f/3f | (573,430) (603,441) (633,452) | far file — menbeg turns them to Ulysses |

Object registrations (hull tips, mast, mouth aperture, boulder open (455,330)
vs shut (355,325), fire ring, racks, pens, club, bed, pails, splash points,
smoke columns…) are in `ledger.json → sets.*.objects`.

---

## 4. LENSES (34 — [x, y, k], composed INSIDE the painting)

Dead-band law (sherlock's F2 lesson): visible box = 1408/k × 768/k landscape,
1060/k × 768/k portrait; margins computed for **every** lens in `ledger.json`
— **34/34 ≥ 0 in both orientations**. k=1.0 forces [704,384] exactly.

### shore (9)

| lens | [x,y,k] | serves |
|---|---|---|
| establishing | [704,384,1.0] | i-00/01/05/06 — the black strait wide (day state reuses) |
| smoke | [980,205,1.9] | i-04 — lift to the mainland lobe + stubble-fire smoke (O.1a frame) |
| council | [505,470,2.2] | i-06/07 |
| camp-fire | [430,468,2.4] | i-02/03 |
| ship-mid | [560,470,3.0] | i-10 — Ulysses shouldering the skin at the hull |
| skin-close | [560,470,4.5] | i-11 — the skin in-world, not the inset |
| cavemouth-push-from | [850,345,1.6] | i-08 push start (a push is TWO ledgered keyframes — both must clear bounds) |
| cavemouth-push-to | [1008,290,2.6] | i-08/09/12 push end on the laurel mouth |
| crag-tilt | [1050,165,2.4] | i-09 — bare cliff-top against the sky (Beat VI pre-echo) |

### cave (20)

| lens | [x,y,k] | serves |
|---|---|---|
| establishing | [704,384,1.0] | ii-00, ii-13 (widest), iii-00, v-00/05 |
| racks-sweep | [700,300,2.0] | ii-01 (K2 sweep centre) |
| doorlight-hinge | [480,400,2.2] | ii-02 — holds on the doorway light |
| mouth | [345,340,2.4] | ii-04, iii-02, iv-07..11 — boulder / quiver-lid / seams / stone |
| discovery-low | [900,430,1.8] | ii-03 — low, from the men's hiding place |
| eye-close | [745,295,3.6] | ii-05 — **FIRST close lens on the single eye** (O.1's visual half; head of the seated 300 px giant) |
| twoshot | [700,400,2.6] | ii-07/08/09, iii-11/12 |
| meal-close | [780,430,2.8] | ii-10, iii-01, iii-07 — the seize in shadow, identical ×3 (O.6) |
| sword | [740,440,3.2] | ii-11/12 — glint; pan lands on `mouth` |
| scheme-push | [640,470,3.0] | iii-03 |
| club-wide | [880,360,1.6] | iii-04 — figures tiny beside the club |
| lots-overhead | [600,490,3.0] | iii-05 |
| bowl-close | [690,440,3.4] | iii-08/10 — G3 hold frame |
| face-flush | [710,380,4.0] | iii-09 — the one eye glittering |
| ember-close | [655,450,3.8] | iv-01/02 — G4 hold frame on the pit |
| drive-tight | [780,430,3.4] | iv-03/04/05 — at the sprawl head |
| ram-close | [838,425,3.2] | v-04 — push to the great ram (G5) |
| handpass-tight | [370,400,3.6] | v-06 — hand-over-wool, a face beneath (O.11) |
| doorway-twoshot | [370,380,3.0] | v-07..10 — ruined face above, Ulysses in the wool below |
| freed-overshoulder | [430,430,2.0] | v-11 — back at the mouth, the giant small now |

### sea (5)

| lens | [x,y,k] | serves |
|---|---|---|
| establishing | [704,384,1.0] | vi-01/03 — the two-plane wide; the FIRST gate and rock 1 keep it (world at rest) |
| stern | [530,430,2.8] | vi-02/07/10 |
| ship-deck | [575,450,2.6] | vi-04/05 — interior three-quarter |
| clifftop | [870,195,2.8] | vi-08/09 |
| curse | [870,180,2.2] | vi-11 — document-weight frame, sky darkened a stop |
| strait | [585,330,2.0] | vi-06/12 — F2 recompose (round 3): the two-plane frame tightened to the painted strait once the first wash has the world at 0.86; holds plea, target and splash (455,540) in one window |
| homeward | [575,380,2.6] | vi-13 — F2 recompose: the row home at world ~0.76, cave fire falling astern |
| moonpath | [590,340,3.2] | vi-14 — F2 recompose: follows the ship toward the painted moonpath/moon, composed for world ~0.69 under the closing cover |

---

## 5. GATES (6 gates, 7 resolutions)

Anchor law: the ring stands ON the measured thing. When the thing is an ACTOR
or an actor's PROP, the ledger anchors its **staged mark** and the live anchor
rides the mounted actor (sherlock's lit-window rule: anchor the VISIBLE thing).

| gate | unit(s) | verb | targetPlate / holdAnchor | anchored on |
|---|---|---|---|---|
| G1-ship | ody-i-07 | target `ship` | (600,455) | **ship-2 hull centre** — painted object, measured. gateAct `crossing` |
| G2-sword | ody-ii-11 | target `sword` | (768,445) | ACTOR PROP — hip of Ulysses at sword-ulysses (768,462) + 17 px; live only while the actor is mounted |
| G3-bowl | ody-iii-08 | hold ×3 | (700,441) | the raised ivy bowl at chest on bowl-offer (700,468); fill ∝ hold; iii-09 on pour-1, iii-10 on pour-3 |
| G4-embers | ody-iv-01 | hold | (662,456) | the **measured embers emissive centre** (layers-cave.json); glow ∝ hold — watermark law; full heat fires the ~14 s clock |
| G5-ram-great | ody-v-04 | target `ram-great` | (838,415) | the great-ram ACTOR body centre at ram-stand (838,430) — GAP asset, anchor rides it; gateAct `slingUnder`, the no-text moment |
| G6-cyclops | ody-vi-01 + ody-vi-06 | target `cyclops` ×2 | (860,168) | the VISIBLE giant on the clifftop (89 px figure at (860,210)) — GAP actor; click 2 resolves OVER the men's lit plea (O.12) |

Every gate self-satisfies after 30 s sim (contract §5; WIRING §8's beat-1
carve-out should drop for this book).

---

## 6. OBJECT LEDGER (§3.2) — every staged physical noun

Full rows in `ledger.json → objectLedger` (owner lane · acceptance test ·
units served). Summary:

| object | status | lane | units |
|---|---|---|---|
| ULYSSES actor (9 pose families) | **GAP** | ody-actors | ~74 |
| POLYPHEMUS giant (7 poses, sighted+blinded head) | **GAP** | ody-actors | ~60 |
| THE CREW (12→6; headcount law, seize ×3 identical) | **GAP** | ody-actors | ~60 |
| GREAT RAM (100–110 px) + three lashed trios | **GAP** | ody-actors | 12 |
| THE STAKE (7 states; 77 px) | **GAP** | ody-props | 9 |
| IVY BOWL (fill ∝ G3 hold) | **GAP** | ody-props | 6 |
| LAMPLIGHT SEAMS (neighbours' lamps beyond the boulder; O.10) | **GAP** | ody-layers | 5 |
| CAMEO art ×4 (POLYPHEMUS card = O.1's other half) | **GAP** | ody-cameo | 4 |
| WINESKIN prop + `plate-wineskin` inset (the chapter's only inset; O.2) | **GAP** | ody-insets | 3 |
| ROCKS 1+2 (arcs to splash (468,505)/(455,540)) | **GAP** | ody-props | 2 |
| ISLAND-BEACH return layer + sea dawn state | **GAP** | ody-layers | 2 |
| hunt/feast dressing; helmet + wallet | **GAP** | ody-props | 2+2 |
| shore/cave/sea sets, 8 state masters, 8 layer cards, 13 measured emissives | EXISTS | ody-set | all leaves |
| racks, cheeses, pails, club, bed, pens+flock, dung, wall, smoke, moonpath, boulder BOTH positions | EXISTS (painted) | ody-set | dressing |

## 7. INVENTORY split

**EXISTS:** 3 masters — shore (2 states), cave (5 states: open/shut/embers/
predawn/dawn — the boulder is painted in BOTH positions, so the shut is a
state swap under the grind-boom), sea (1 state); 8 screen-blend layer cards;
all light anchors measured in `layers-*.json`; engine skeleton copied
(WIRING.md); slice + gate-state tooling in `tools/ody/`.

**GAP (ranked by units blocked):**

1. **ULYSSES actor — ~74 units** (every beat; three set scales: 20/75/22 px)
2. **POLYPHEMUS actor — ~60 units** (carries O.1 visual, G6 anchor, the curse frame)
3. **THE CREW actors — ~60 units** (headcount law 12→6 is O.6's carrier)
4. **GREAT RAM + trios — 12 units** (G5 + O.11; the only oversized animal)
5. **THE STAKE — 9 units** (G4 rides it; O.9)

then: ivy bowl (6) · lamplight seams (5) · cameo art (4) · wineskin+inset (3)
· rocks (2) · island-beach layer + sea dawn (2) · dressing props (2+2).

Fact carriers at risk while GAPs stand: O.1 (cameo art), O.2 (inset), O.5
(sword), O.7 (bowl), O.9 (stake), O.11 (ram), O.12/O.14 (clifftop giant — G6
cannot anchor until it mounts).
