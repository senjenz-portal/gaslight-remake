# full-book-audit.md — the shipped lap, read frame by frame

Scope: `site-deploy/living/` (live + lap-clean) against `CONTENT.md` +
`CONTENT-full.md`, evidence = `shots/living-full/` (74 frames + `lap.json`),
reference = `/tmp/thebook/books/sherlock/`.
Contact sheets and crops built for this audit live in `review/consistency/`.

**Headline.** `lap.json` says `ok: true`, `failures: []`, `gaps: []`. It is
wrong about the last one. The gap reporter only records *art the engine asked
for and did not get* (`stage.js:138`). Three sets deliberately **never ask** for
the art they are missing, so the biggest holes in the book are invisible to the
verifier: the three carriages of Beat III, the crowd of Beat VI, and the bride
and groom of Beat IV.

---

## 1. CARRIAGE LEDGER

### 1a. Every staging demand for a cab / landau / hansom / four-wheeler

Grepped `CONTENT.md`, `CONTENT-full.md`, and `main.js` (`script3()`, `CCAM`,
`scene-lab-chase/scenes/chase.js`).

| beat · unit | the law's demand | evidence frame | verdict |
|---|---|---|---|
| I · `comes2` (10) | CONTENT.md: "cam → door; **sfx hoofbeats** (street through window)"; asset list "hansom (window/street dressing)" | `01-10-carriage.png` | **MISSING.** The cue `hoofbeats@14.25` fires (lap.json audio). Nothing arrives in the window. The frame the harness itself named *carriage* contains no carriage. |
| III · `iii-01-hansom` (1) | "his hansom **at the lit door**, her landau not yet in the street"; ref measures **his hansom at 48.1 % of frame height** | `03-01-hansom.png` | **MISSING.** Lens is correct (measured k≈1.44 off the lamp spacing, matches `FOCUS.door` 1.46). Norton stands alone on the pavement beside a faint warm smear. 0 % of frame height. |
| III · `iii-03-watch` / `iii-04-devil` | "As he stepped up to **the cab**…"; "**Drive** like the devil" | `03-03-watch.png`, `03-04-devil.png` | **MISSING.** He steps up to nothing and orders a driver who is not drawn. |
| III · `iii-05-landau` (5) | seg `chase-intro` 6 s: "Norton away first; **the landau up the lane**; she shoots out of the hall door and **boards**; **a cab comes through the street**" | `03-05-landau-seg.png` | **MISSING — all four.** Empty street. Norton's figure is force-hidden during the seg (`chase.js:355`), so his departure has no carrier either. |
| III · `iii-06-shotout` (6) | focus `her`; ref: "**HER landau**… 44.2 % of frame height at u 0.593" | `03-06-shotout.png` | **MISSING, and the woman with it.** "she was a lovely woman, with a face that a man might die for" plays over bare cobbles. `S.irene` is nulled the instant boarding ends (`chase.js:309`). Fact **P.3 has no image**. |
| III · `iii-08-toogood` (8) | **GATE**, target `cab` — the following four-wheeler; cue "click the cab · follow her" | `03-08-cab-gate.png` | **MISSING — worst instance.** The cue names a thing that is not in the picture. The teal target ring sits on a bare glow on the pavement. The reader is asked to click a cab that does not exist. |
| III · `iii-09-shabby` (9) | "driver pose `look-twice`"; the pursuit is rolling under this unit | `03-09-pursuit-rolling.png` | **MISSING.** No driver, no cab, no landau. A single light smudge. |
| III · `iii-11-twentyfive` (11) | `wait: roll` — "**the arrival is what turns the page**" | `03-11-twentyfive.png` | **MISSING.** `lap.json.roll` proves the maths ran (19.45 → 13.99 m, band `shadow` throughout). Nothing arrived on screen. |
| IV · `iv-01-drovefast` | "My cabby drove fast… I paid the man" | `04-02-notasoul.png` | N/A — church interior; the law does not put a rig on this set. Correct. |
| IV · `iv-15/16` "he driving back to the Temple… I shall drive out in the park at five" | no staging demanded | — | OK. |

**Nine units demand a vehicle. Zero vehicles are drawn anywhere in the book.**

### 1b. Root cause — named, with the line

`app/sets/chase.js:24-30`, the file's own header:

> *ART GAP (CONTENT-full 7.2 #7). The three rigs are not shipped by any lane…
> what is missing is the picture. Each rig therefore runs as the two things
> about a night carriage that are not its body: its lamp and its contact
> shadow on the cobbles. Dropping `set/chase/rig-<id>.png` in gives them bodies
> with no other change.*

Three things are true and all three are defects:

1. **A rig is `contact-shadow.png` + a CSS radial-gradient div** (`chase.js:135-150`).
   No body, no wheels, no horse, no driver, no lamp housing. `assets/set/chase/`
   contains `chase.jpg, chase-dim.jpg, door-out.png, fog.png, lamp2-front.png,
   rail.json, rig-lamp.png` — and `rig-lamp.png` is not even used (the lamp is
   drawn as a gradient because the painted bloom "measured invisible").
2. **The promised drop-in does not exist.** `grep -rn "rig-" app/` returns one
   hit: the comment. Nothing in the code ever constructs an `<img>` for
   `set/chase/rig-<id>.png`. Shipping the art would change nothing.
3. **The verifier cannot see it.** `stage.gaps` is appended only on a failed
   image load. Because chase.js requests no rig art, `lap.json.gaps === []` and
   the lap passes green on a beat titled THE PURSUIT that contains no vehicle.

The reference *does* build them: `scene-lab-chase/scenes/chase.js:838-880`
constructs a four-wheeler procedurally (chamfered cabin, roof pinstripe, door
light, undercarriage, springs, shafts, footboard, driver's box) plus a horse in
harness, at authored metres so one group scale drives the whole rig, plus a
palette (`cab 0x010102, wheel 0x010102, horse 0x494f57, harness 0x0a0c0f`)
sampled off the approved art.

### 1c. Fix recipe (per PIPELINE — raw-first)

* **Generate three rig sprites** on the locked style template (§1.9) —
  `hansom` (two-wheel, high driver's seat), `landau` (low, half-hood down,
  coachman with coat half-buttoned and tie under his ear — the line names it),
  `four-wheeler` (growler) — each **with horse, driver, wheels and lamp**, as a
  side-on cut at the rail's u=0 scale (150 px shadow width ⇒ target body ≈
  4.4 m × 51.2 px/m ≈ 225 px wide at u 0). Land raw + manifest under
  `assets/raw/**` first. Alternative and cheaper: render them out of
  `assets/3d/hansom-cab.glb` on the same three-quarter axis as the plate, then
  repaint to the template.
* **Wire them.** In `chase.js` the rig group must gain
  `st.img('set/chase/rig-'+id+'.png', 'lyr body', g)` **inside** the group,
  drawn under `lamp` and over `shadow`, sized `225 * s` off the rail, baseline
  on `rail[2]`. Keep the lamp gradient — it is the only thing that currently
  works — but hang it on the rig's lamp bracket, not on air.
* **Make the gap real.** Register the three files in the manifest so a missing
  one lands in `stage.gaps`; add a lap assertion `gaps === [] && rigs.every(on
  ⇒ bodyDrawn)`. Today the beat can ship empty and stay green.
* **Beat III unit 6:** keep `irene-chase.png` on the landau after boarding
  (`chase.js:309` — don't null `S.irene`; switch it to a `riding` mark pinned to
  the lead rig) so `FOCUS.her` has its subject.
* **Beat I `comes2`:** put a hansom + horse in the street outside the window, or
  cut the `hoofbeats` cue. Sound without picture is worse than neither.

---

## 2. THE MARRIAGE SCENE (Beat IV, St Monica's) — unit-by-unit vs contract

The set reads well and the rest state (three in a knot at the altar) is right.
Everything the contract asks the beat to *perform* is broken.

| unit | contract | what the frame shows | defect |
|---|---|---|---|
| `iv-02-notasoul` | "the three-in-a-knot tableau is the SET's rest state" — **fact M.1** | `04-02-notasoul.png`: bride, groom, surpliced clergyman at the altar, Holmes at the back | **OK.** The one unit that works. |
| `iv-03-lounged` | seg `lounge`, focus `aisle` | `04-03-lounge-seg.png` | OK, though the aisle lens spends 7.6 % on void by its own admission. |
| `iv-04-facedround` | seg `run` — "Norton runs, **then beckons with both arms**"; "the three at the altar **faced round**" | `04-04-run-seg.png` | **Norton is airborne and clipped by the right edge**, drawn above the pew backs with his legs at a broken angle. Nobody "faces round" — the painted three never move. |
| `iv-05-thankgod` | cameo `norton` first appearance | `04-05-norton-cameo.png` | OK — cameo art matches the sprite. |
| `iv-07-comeman` | **GATE** target `norton`, "click Norton · answer him" | `04-07-norton-gate.png` | Target ring lands on him — OK. But **he floats**: `floorAt(612)=552.6` is the *side-aisle* floor line applied to a man standing in the chancel, so his boots are above the pew tops with clear air beneath. |
| `iv-08-halfdragged` | seg `drag`; act `glassStart`; canon l.663 "the drag itself" is cut *because the sub-beat performs it* | `04-08-drag-seg.png` | **Nobody drags anybody.** Norton has already teleported home (`fire('dragToAltar')` sets `S.norton.x = MARK.nortonHome` on the same frame). Holmes strolls up the aisle alone — and **walks through the pew**: his legs intersect the pew back with no occluder (the chase set has `lamp2-front.png`; the church ships none). |
| `iv-09-tyingup` | focus `ring` at **ref r 6.6 — the tightest frame in the book**, "the three figures read 27.2 / 20.5 / 16.7 % of frame height"; `ringScrub` 0→1; `wait: ring`; **fact M.4** | `04-09-ring.png` | **THE RING IS NOT IN THE PICTURE.** `FOCUS.ring = [782,446,**1.13**]` — a 13 % push off a wide nave lens, visually indistinguishable from `04-02`. Reference r 21 → r 6.6 is a **3.2× push**; 1.13 is not it. See §2a. |
| `iv-10-preposterous` | "holds the ring frame" | `04-10-ring-held.png` | Holds a frame with no ring in it. |
| `iv-11-license` | `clear` — fact M.5 | (no frame captured) | — |
| `iv-12-sovereigngift` | focus `coin`; `sovereignScrub` 0→1 — "**bride → witness → watch chain, three holders**"; `wait: sovereign`; **fact M.6** | `04-12-sovereign.png`, crop `review/consistency/sovereign-zoom.png` | **No coin.** See §2b. |
| `iv-13-unexpected` | `cameo: off`, pull back to `nave` | `04-13-unexpected.png` | OK. |
| `iv-16-parkatfive` | endsBeat — fact M.8 | `04-16-parkatfive.png` | OK. |

### 2a. The ring — three independent reasons fact M.4 has no carrier

1. **The lens never pushes.** `church.js:71` `ring: [782, 446, 1.13]`. The file
   defends it by measuring the painted bride's box (`184 px / (768/1.13) =
   27.1 %`) — arithmetically true and **the wrong quantity**. The contract's
   27.2 % is the reference at r 6.6, where the *ring* is a legible object. At
   k=1.13 the ring is sub-10-px.
2. **The "ring plate" is a relight, not a ring.** Diffing
   `church.jpg` vs `church-ring.jpg`: max Δ 288, **mean Δ 0.557**, pixels with
   Δ>90 confined to x 742-797 / y 418-471 (a 55×53 patch), Δ>40 spilling to
   x 732-1006 across the whole knot. Side-by-side at 2× (`review/consistency/
   ring-compare.png`) the visible change is that the bride's gown and Norton's
   coat get *brighter*. No gold band appears on any hand.
3. **Holmes stands in front of the hands.** `MARK.altar = 700` puts the witness
   between the bride and the camera, and `holmes-church-altar.png` is a pose
   holding a cap in both hands at chest height — exactly over the joined hands.
   `review/consistency/holmes-altar-zoom.png` (with/without) shows the bride
   occluded shoulder-to-hem and her hands behind his hat brim.

### 2b. The sovereign — fact M.6 fails on the maths, not just the art

`church.js:stepCoin` puts the coin at three points:

```
bride   = [FIGURES.bride[0]+54, FIGURES.bride[1]+108]        = [742, 452]
witness = [holmes.x+22, floorAt(700) - 1.87*104.5*0.52]      = [722, 428]
chain   = [holmes.x+6,  floorAt(700) - 1.87*104.5*0.44]      = [706, 443]
```

* leg 1 (bride → witness) travels **31 px**; leg 2 (witness → watch chain)
  travels **22 px**. The whole "journey of three holders", over 4.5 s, is
  **53 px on a 1408-px plate — 3.8 % of the plate width.** It reads as a static
  smudge, not a journey.
* the coin is `el('div','emis')` with a 26-px radial gradient — a soft yellow
  blur with no rim, no edge, no milling, no gold. In the crop it looks like a
  hole in the render on the bride's midriff.
* there is **no watch chain** anywhere on `holmes-church-altar.png`, so leg 2
  arrives nowhere.
* `FOCUS.coin = [934,402,1.55]` is centred **~210 px right of the coin**, on the
  altar. Result: the coin sits at 27 % from the left of the frame and the right
  **25.8 % of the panel is empty navy backdrop** (measured on the frame).

### 2c. The bride and the groom are faceless

`review/consistency/church-painted-vs-sprite.png`. The set's design decision
(`church.js:9-27`) is that the bride, clergyman and the resting groom stay
**painted into `church.jpg`**. The painted figures are untextured, unlit
low-poly heads with **no eyes, no nose, no mouth, and no moustache** — blank
mannequins. Meanwhile:

* `actor/norton-beckon.png` / `norton-run.png` are fully painted men with black
  hair, a black moustache and modelled eyes. So Norton is a character for 4
  units (`facedround` → `comeman`) and a faceless doll for the other 13.
* **`actor/irene-bride.png` is shipped (255×527, a finished face) and never
  drawn.** `ART` in `church.js:81-88` has no `irene` entry at all. The bride the
  reader watches get married is the plate's blank mannequin.

The clergyman is painted too and does have a face — proving the plate could
have carried faces and did not for the two principals.

### 2d. Other Beat IV defects

* **The hourglass sand is a hard pale rectangle.** `stepGlass` draws a
  `36 × 27 px` linear-gradient box over a hourglass sprite it does not match.
  Visible in `04-09` / `04-10` as a grey-white bar sitting across the altar
  ornament. It is an artifact, not sand.
* **No depth scale on the aisle.** `PX_PER_M = 104.5` is constant, so Holmes is
  the same 195 px at `MARK.back` (424) and at `MARK.altar` (700). In an
  isometric nave the difference over 276 px of aisle is real; he arrives at the
  altar looming over everyone.
* **Two Nortons on any non-linear entry.** `main.js:688-710 __gotoUnit` replays
  every unit's `act` on the leaf but **not** `gateAct`, so `dragToAltar` never
  runs and Norton is left in the beckon pose at `nortonMet` while the painted
  groom is also on stage. This is not hypothetical: the shipped portrait proof
  `09-01-portrait-ring.png` **shows both of them** — meaning the book's own
  mobile-layout evidence was captured against a corrupt world. (Soft-fail is
  safe — `resolveGate(u,{soft:true})` does fire the act, `main.js:471-475`.)
* **`snapshot().ringLens` is hardcoded** (`church.js`): it returns
  `{bride:24.0, clergyman:23.7, groom:17.3, k:FOCUS.ring[2]}` as literals. The
  lens contract certifies itself; no measurement is taken at run time.

### 2e. Fix recipe

1. `FOCUS.ring` → recompose at k ≈ **3.0-3.4** centred on the joined hands
   (~[770, 440]); reference r 6.6 vs nave r 21. Re-derive against the plate's
   content bbox (church content is x 266-1134) so the tight lens does not open a
   void band.
2. Repaint `church-ring.jpg` with an actual gold band on her hand, and verify by
   the Δ>90 bbox being **on the hand**, not on the gown.
3. Move `MARK.altar` to **the far side of the bride** (≈ 640, or place the
   witness behind the rail on the clergyman's side) so nothing occludes the
   hands; give `holmes-church-altar.png` a cap-in-one-hand pose with a free
   right hand and a **visible watch chain**.
4. Sovereign: generate a real coin sprite (§7.2 #13); rescale the journey so it
   crosses ≥ 25 % of the *visible frame* over 4.5 s (bride's hand → witness's
   palm → the chain at his waistcoat), and recentre `FOCUS.coin` on the coin.
5. Composite `irene-bride.png` and a `norton-groom` cut over the painted knot
   for the two close lenses (a hole-patch is not needed if the close lens is
   tight enough to hide the seam), or regenerate `church.jpg` with the figures
   rendered at actor fidelity.
6. Replace `stepGlass`'s box with a masked sand fill inside `hourglass.png`'s
   alpha.
7. Add a pew occluder cut (`church/pew-front.png`) so the walk does not pass
   through geometry, and a per-x depth scale on `AISLE`.
8. Make `enterUnit` replay `gateAct` for any already-passed gate unit, or have
   sets expose an idempotent `stateAt(unitIndex)`.

---

## 3. CONSISTENCY MATRIX

Contact sheets: `review/consistency/holmes.png`, `norton.png`, `irene.png`,
`king.png`, `cameos-big.png`, `church-painted-vs-sprite.png`.

| character | verdict | what drifts |
|---|---|---|
| **Holmes** | **DRIFTED — the worst in the book. Five different men.** | (1) `holmes-holmes.png` / `holmes-walk.png` — **magenta-purple belted frock coat**, blue trousers, dark hair, faceted low-poly (Beats I, VII). (2) `holmes-street.png` / `-signal.png` — **a Nonconformist clergyman**: black cassock, **white preaching bands**, wide-brim clerical hat, gaunt elderly face, smooth painterly rendering (Beats II, V, VI). (3) `holmes-chase.png` — **a tweed groom** with flat cap and neckerchief (shipped, **never drawn** — chase.js draws no Holmes by design). (4) `holmes-church*.png` — the groom again but **older, greyer, longer-faced, different scale** (Beat IV). (5) `cameo/holmes.jpg` — **a gaunt old man in a dark-green high-collared coat**, matching none of the four. Nothing in the script establishes a disguise: the reader meets the green-coated cameo, then a purple-coated man, then a clergyman, then a tweed labourer, all captioned HOLMES. Render styles also disagree (faceted flat-shaded vs painterly rim-lit). |
| **The King** | **Mostly consistent — one hard continuity break.** Blue cloak / orange lining / cream double-breasted waistcoat / blond-ginger beard hold across `king-masked`, `king-unmasked` and both cameos. **BUT `king-walk-enter.png` and `king-walk-exit.png` are BOTH masked art**, and `room.js:564` forces `kingUnmasked.opacity = 0` while walking. So the King **re-masks every time he moves**. `01-35-exit.png` shows the mask back on his face at unit 36 — twenty units after the unmasking — with the *unmasked* cameo "WILHELM VON ORMSTEIN · KING OF BOHEMIA" on screen in the same frame. Fact I.6's pantomime is silently undone. Secondary: the masked cameo wears a cream shirt and the unmasked cameo an **olive** one — the two halves of the same flip disagree on costume. |
| **Irene** | **Drifted at the bride.** `irene-chase / -board / -walk / -street` are one woman: grey-blue travelling dress, crimson collar and cuffs, near-black hair up, small hat, painted face. `irene-bride.png` is chestnut-haired in a cream gown — different hair colour, different build, lower detail — **and is never used**; the on-stage bride is the plate's **faceless mannequin**. `cameo/irene.jpg` is a third read (tiara + strapless crimson evening gown) — defensible as a prima-donna portrait, but the tiara appears nowhere else. The Beat VI reveal is crushed to a silhouette so it hides the drift; note the law asks for **crimson-edged, backlit** and it renders flat black. |
| **Norton** | **Best in the book, two drifts.** Crimson frock coat, grey trousers, black boots, black moustache, dark hair hold across `norton-chase`, `norton-street`, `norton-groom`, `norton-beckon`, `norton-run` and `cameo/norton.jpg`. Drifts: (a) the **top hat is on** in chase/street and in the run strip, and **gone** in `groom` and `beckon` — so his hat vanishes mid-beat; (b) the **painted groom in `church.jpg` is a different man**: brown hair, no moustache, no face. |
| **Holmes-disguise** | **Not a thing in this book.** There is no unit that says he is disguised, no disguise reveal, no cameo flip. The two disguise sprites (clergyman, groom) exist and are used as if they were the same visible man. Doyle's own reveal (l.700 "a drunken-looking groom") is not in the cut. |
| **Watson** | **Contract violation.** Law: "Watson (the reader) — POV — **never drawn**." `plate/room.jpg` has a **seated grey-haired man in a green waistcoat reading a paper** painted into the armchair (verified directly on the plate, `review/consistency/room-plate-right.png`). He is on stage for all 49 room units (Beats I and VII), including `01-12-three-shot` where Holmes says "This is my friend and colleague, Dr. Watson" and points at the reader while a Watson sits in shot. `cameo/watson.jpg` also ships. |
| **cameo vs stage** | Norton ✔ · King ~ (costume detail drifts across the flip) · Irene ~ (tiara/gown) · **Holmes ✘ (completely different character)**. |

**Fix recipe.** Pick ONE Holmes silhouette and derive all cuts from it (the
purple-coat room puppet is the only one the reader is given time to learn).
Either (a) drop the disguises and re-cut street/church Holmes as the same man in
a street coat, or (b) keep them and **earn them** with a disguise beat + a cameo
flip, the device the book already owns from the King's unmask. Repaint
`cameo/holmes.jpg` from the room actor. Re-render both King walk strips from
`king-unmasked.png` (or overlay `mask-prop.png` on the masked half only) and
gate the strip choice on `S.masked`. Inpaint the seated figure out of
`room.jpg` (the file already has the machinery: `holmes-patch.png` proves the
inpaint workflow) or re-render the plate without him. Wire `irene-bride.png`.

---

## 4. RANKED DEFECT LIST — everything the whole lap surfaced

Rank = story damage × how visible.

| # | beat · unit | defect | evidence | root cause | fix |
|---|---|---|---|---|---|
| 1 | III · all 12 | **No carriage anywhere in the book.** THE PURSUIT is an empty street with two light smudges. 9 units demand a rig. | `03-01/03-03/03-04/03-05/03-06/03-08/03-09/03-11` | `chase.js:24-30` — rigs are shadow + CSS glow; no rig art is ever *requested*, so `gaps` stays `[]` and the lap passes | §1c |
| 2 | III · `iii-08` | **A gate whose target does not exist.** "CLICK THE CAB · FOLLOW HER" over bare cobbles; ring on a glow. | `03-08-cab-gate.png` | same | draw the four-wheeler; keep `targetPlate` as is |
| 3 | IV · `iv-09` | **Fact M.4 (the ring) has no image.** k=1.13 is not a push; the "ring plate" is a knot relight (mean Δ 0.557); Holmes' body covers the hands. | `04-09`, `04-10`, `review/consistency/ring-compare.png` | `church.js:71` + `church-ring.jpg` + `MARK.altar` | §2e.1-3 |
| 4 | IV · `iv-12` | **Fact M.6 (the sovereign) has no image.** A 26-px gradient blur that travels 53 px total and never reaches the witness; no watch chain; lens centred 210 px off it. | `04-12`, `review/consistency/sovereign-zoom.png` | `church.js:stepCoin` + `FOCUS.coin` | §2e.4 |
| 5 | I · `briony` (35-37) | **The King re-masks after the reveal.** Both walk strips are masked art; the unmasked cameo is on screen in the same frame. | `01-35-exit.png` | `king-walk-*.png` art + `room.js:564` | re-render strips unmasked; branch on `S.masked` |
| 6 | all room units | **Watson is drawn** — a seated man in the armchair, in a book whose whole conceit is that the reader is Watson. | `room.jpg`, `01-12`, `07-05` | painted into the base plate | inpaint / re-render |
| 7 | I–VII | **Holmes is five different men** in three render styles, with no disguise beat to explain it. | `review/consistency/holmes.png` | four independent art lanes, no character sheet | §3 |
| 8 | VII · `vii-00-head` | **The Beat VII heading frame is black** (max luminance **19**; every other head peaks 246-254). The reader gets 3.4 s of nothing and never sees "VI · THE WOMAN". | `07-00-head.png` | leaf-6 mount does not raise the room before the head's dwell | raise the set on mount, or hold the turn cover until opacity lands |
| 9 | IV · 13 of 17 units | **The bride and groom are faceless mannequins**, while a finished `irene-bride.png` ships unused. | `review/consistency/church-painted-vs-sprite.png` | figures baked into `church.jpg` at low fidelity; `ART` has no `irene` | §2e.5 |
| 10 | VI · whole beat | **There is no crowd.** The law needs it to turn (t+1.50, staggered 0.22 s) and to scatter (t+8.6). No crowd sprite exists in `street.js ART`, and no crowd is painted in `street-smoke.jpg` or `street-empty.jpg`. `cue:disperse@134.4` fires over an already-empty street. | `06-02b`…`06-07`, `review/consistency/street-variants.png` | GAP 7.2 #12 never generated; not registered so not reported | generate a 5-8 silhouette strip + turn/scatter marks |
| 11 | V-VI | **The fire is in the wrong room.** Gate target and REVEAL box are the ground-floor **bay** (`[763,373]`, `[698,318,806,430]`); the plume/hot pane is the **first-floor** window (`[759,212]`). She is revealed rummaging in a room that is not burning, one storey below the fire the reader started. | `06-03`, `06-04`, `street.js:38-63` | the emissive was chosen because the plate had a dark window there | put the ruse in the bay, or move gate+reveal upstairs |
| 12 | V · `plan2`, `neutral` | **The "open window" never opens.** `street-window.jpg` only brightens the bay (Δ bbox x402-919); no sash moves. Holmes says "the sitting-room window will open… station yourself close to that open window" and nothing does. | `05-05b-window-open.png` | variant is a relight, not a state | repaint with the sash up; add the maid |
| 13 | IV · `iv-04`, `iv-07` | **Norton floats and clips.** `floorAt()` is fitted to the *side aisle* (4 collinear points, x 470-690) and applied to a man in the chancel; boots sit above the pew tops with air beneath. In `04-04` he is also clipped by the plate's right edge mid-run. | `04-04`, `04-07`, `09-01` | one floor line for two different depths | second floor line for the chancel; clamp the run's end mark inside the lens |
| 14 | IV · `iv-08` | **Nothing drags anybody.** Norton teleports home on the gate; Holmes walks up alone, **through a pew**. Canon l.663 was cut *because the sub-beat performs it* — it doesn't. | `04-08-drag-seg.png` | `fire('dragToAltar')` homes Norton on the same frame; no occluder ships | keep Norton on Holmes' arm for the seg; add `pew-front.png` |
| 15 | II, IV, V, VI | **21-30 % of the panel is dead backdrop** on many lenses: `02-01-lodge` 29.5 % right band, `04-12` 25.8 % right, `04-02/04-09` ~21 %, `03-08` 21.3 % left, `01-10` 44 % of pixels near-black. Painted content covers only 44 % of the street plate's width and 62 % of the church's. | measured over all 74 frames | lenses composed on story points, not on the plate's content bbox | recentre every FOCUS on `contentBBox` and re-derive k; the `aisle` lens already documents this method — apply it everywhere |
| 16 | I · `comes2` | **Hoofbeats with no carriage**, and the door lens spends ~29 % of frame on the plate's left margin. | `01-10-carriage.png` | FOCUS.door=[386,372,1.55] pinned by the edge clamp; no street dressing | dress the window; recentre `door` |
| 17 | IV · `iv-08`→ | **The hourglass "sand" is a hard pale rectangle** floating on the altar, not matched to the glass. | `04-09`, `04-10` | `stepGlass` draws a raw gradient box | mask to `hourglass.png` alpha |
| 18 | V · `signal`/`rocket` | **The `plate-rocket` inset is illegible** — an over-zoomed yellow-and-maroon lozenge cropped at both edges. It should read as "an ordinary plumber's smoke-rocket, a cap at either end". | `05-03`, `05-04` | inset composed too tight on a subject with no silhouette | re-shoot the inset three-quarter, whole object in frame |
| 19 | VII · `valuemore`→ | **`plate-irene` (and `both-photo`) put a ~90-px figure in a large empty sepia field.** "The only time in the book the reader SEES her" is a doll at 20 % of the plate height. | `07-06`, `07-08`, `01-24` | insets framed on the photo mount, not the sitter | reframe both to a bust/three-quarter crop |
| 20 | III · `iii-06` | **`FOCUS.her` frames nobody.** Irene is nulled the instant boarding ends. | `03-06-shotout.png` | `chase.js:309` | keep her riding |
| 21 | VI · `THE REVEAL` | The silhouette is **flat black**; the law asks for **crimson-edged, backlit**. The single most important image in the chapter has no accent. | `06-04-THE-REVEAL.png` | `street.js` crushes `irene-street.png` to black with no rim pass | add the crimson edge |
| 22 | portrait | **The mobile proof frames were captured against a corrupt world** — `09-01-portrait-ring.png` holds two Nortons. So portrait layout is unverified at the ring lens. | `09-01`, `main.js:688-710` | `__gotoUnit` replays `act` but not `gateAct` | replay gate acts; re-shoot |
| 23 | IV | **The lens contract certifies itself.** `snapshot().ringLens` returns hardcoded literals, so the verifier can never catch a wrong ring lens. | `church.js` | — | measure at run time from the sprite/figure boxes |
| 24 | assets | **Shipped but never drawn:** `actor/holmes-chase.png`, `actor/irene-bride.png`, `set/chase/rig-lamp.png`, `cameo/watson.jpg`. Dead weight in a 6 MB bundle, and two of them are the fix for defects #9 and #20. | asset grep vs `ART` tables | — | wire or drop |
| 25 | VII · `indebted` | Prefix renders **"the King"** where CONTENT.md sets **KING** for the King's lines; every other prefix is a flat small-caps name. | `07-05`, `01-35` | `WHO` table | align to CONTENT.md |

---

## 5. What the lap should have caught and didn't

* `gaps: []` while three sets are missing their principal art — because gaps
  only fire on a *failed fetch*. **Add a manifest-declared expectation per set**
  (`chase` expects 3 rigs, `street` expects a crowd + maid, `church` expects a
  bride + groom cut) and fail the lap when a declared actor is never drawn.
* `ok: true` with a gate whose target is invisible. **Add: for every `target`
  gate, assert the target's own art is on screen and ≥ N px at the gate's lens.**
* No brightness floor per unit — `07-00-head` at max L 19 passed. **Add a
  per-shot assertion that the mounted set reaches a minimum luminance before its
  dwell starts.**
* No void-band check on landscape (portrait has `deadBand`, landscape does not).
  **Port `DEAD_BAND_MAX` to landscape**; four lenses would fail it today.
* Self-reported contract metrics (`ringLens`) must be measured, not declared.
