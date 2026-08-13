# The Living Book pipeline

How a chapter of a public-domain book becomes a living-plates experience (the
`/living/` build). Each stage names its tool; all tools live in `tools/` on
this branch. Proven end to end on Chapter 1 of *A Scandal in Bohemia*: 95
units, 7 beats, 4 SETS, 8 gates, 6 leaves, ~13 MB static, lap-clean on the
deployed URL.

---

## 1. THE STAGES

**0. STORY CONTRACT** (authoring, $0). Source text -> unit script
(`CONTENT.md` + `CONTENT-full.md`): verbatim prose + speaker + verb
(click/hold/gate) + facts-with-carriers + the SCENE LEDGER. This file is law;
stage 6 verifies against it byte-for-byte. The full recipe is §2.

**1. THE PLATE** (`tools/nbpro.py`). One `gemini-3-pro-image` generation per
call with the locked style prompt (`tools/nbpro_prompts.json`) -> the painted
master set. Owner picks between candidates. One SET = one plate.

**2. LIVING LAYERS** (`tools/lanea/slice_plate.py`, $0). Deterministic depth
slicing — fitted void gradient, measured/subtracted lamp bloom (ships as its
own layer), silhouette diff cuts, harmonic inpaint headroom, ~700 KB packed.
Code-only life: feTurbulence fog, breathing emissives, parallax. No model
call touches this stage; it is arithmetic on the plate that already exists.

**3. STATE VARIANTS** (`nbpro_edit.py` + `tools/laneassets/platediff.py`).
Script-demanded changes (door open, lamps dim, ring-lit) as i2i edits accepted
ONLY if the diff mask is confined to the intended cells; drift auto-rejected.
A variant whose diff mean is ~0.5 over the whole plate is a **relight, not a
change** — reject it (§3.1 learned this the expensive way).

**4. ACTORS + STAGING OBJECTS** (`tools/laneactors/`, `tools/lanechase/`).
In-plate figures -> hinged puppet parts cut from the plate's own paint
(idle/gesture <=3 deg; hole inpainted, diff-confined). New characters ->
refsheet-locked i2i standing actor + pixel-aligned pose variants + 4-frame
walk strips (`laneactors/matte_actors.py` spill ceiling,
`laneassets/palettepull.py`, and a `stageproof_*.py` that composites onto the
real plate at the set's own px/m before acceptance — one per lane:
`laneactors/stageproof_actors.py`, `lanechase/stageproof_rigs.py`,
`laneconsist/stageproof.py`). Puppet on the mark; sprite only for crossings.
**Vehicles and set-pieces are actors too** — see §3.2.

**5. GRAMMAR** (reuse, $0). `units.js` is byte-identical across all product
versions; `living-app/app/{main,stage}.js` re-host the same state machine —
margin typography, cameos, the four gate verbs, Scenario SFX, the leaf/turn
model, the beat clock.

**6. VERIFICATION** (`tools/living/lap.mjs`). Full reader lap ON THE DEPLOYED
URL — every unit entered by its real verb with no `__gotoUnit` in the walk,
verbatim vs the contract, each gate proven by MISSING it first, lazy-load
proven (nothing fetched while a leaf is being read), zero console errors,
per-beat screenshots. Plus the on-screen carrier assertions of §3.4.

**7. DEPLOY** ($0). Self-contained static folder, any host, no build step.
Push the branch; GitHub Pages serves it. Median observed propagation: ~50 s.

---

## 2. NEW BOOK RUNBOOK — stage 0 from any public-domain text

This is what the contract lane actually did, generalized. It is the only
stage that is pure authoring, and it is the stage that decides whether the
other seven can be verified at all. **Do it completely before generating one
pixel.** Every downstream tool reads this file; a hole here ships as a hole
on screen.

### 2.0 Get the text and freeze it
Pull the source from Gutenberg (or any PD archive) and commit the fetched
file with its date under `sources/` — e.g. `sources/pg1661_2026-08-04.txt`.
Every quotation later gets re-verified against THIS byte string, not against
the web. A transcription typo is the one bug the rest of the stack cannot
see.

### 2.1 Cut the chapter into BEATS
A beat is a stretch that plays on ONE set with ONE dramatic job. Aim 3-20
units. Then record, in a table, four things that are NOT the same thing and
are routinely conflated:

| beat | the heading the reader SEES | the SET | the LEAF (page) |
|---|---|---|---|

The chapter that ships counted to seven beats and printed six numerals,
because two beats shared a leaf and one beat showed no heading at all. Write
the table or ship the bug.

### 2.2 The COMPREHENSION CONTRACT — facts before prose
Before any unit is written, list the facts a first-time reader must be able
to state after playing. Give each a stable id (`I.1`, `P.3`, `M.4`). Then
give each fact a **CARRIER** — the specific on-screen thing that delivers it.
A fact with no carrier is a fact the reader will not have.

Fact ids do not move when the chapter is re-cut. Beat III carrying `P.*` and
Beat VI carrying `III.*` is not a mistake; it is ids outliving a re-cut.

### 2.3 Emit the UNIT LIST
One row per unit, in order:

`# | id | prefix (speaker) | text (VERBATIM) | verb | staging / assets`

Rules that survived contact:
* **One unit = ONE speech.** The narrator's own lines carry no prefix (the
  reader IS the narrator).
* **Never show text the scene performs.** Keep a CUT LIST naming every
  sentence you deleted and the sub-beat that performs it instead. Six
  sentences died in this chapter and each one is named in `CONTENT-full.md`
  §2.4. An unnamed cut is indistinguishable from an omission.
* **Verbs:** `click` (default), `hold`, `target` (gate), `auto`, `clock`.
* **One gate, one goal line.** A gate that cannot be MISSED is not a gate.
* **Soft-fail:** a gate left alone must satisfy itself after a timeout.

### 2.4 The VERBATIM AUDIT
Machine-diff every quoted string against the frozen source, quote-normalised.
Record the method and the result in the contract itself. `emit_units.py`
lifts text and prefix out of the contract's own tables and never retypes
them — that is what makes stage 6's byte-for-byte check meaningful rather
than circular.

### 2.5 The SCENE LEDGER
The part that is easy to skip and expensive to skip. For each SET record:
its state variants, its marks (where an actor stands, in plate pixels), its
floor line, its px/m scale, its close lenses, its gates and targets, its
insets/cameos/sfx/beds, and any non-click-paced clock.

**Then the object ledger** (§3.2): every physical thing the script names.

### 2.6 The INVENTORY split
Two tables: **EXISTS** (already shipped, sha-verified) and **GAP** (must be
generated), the GAP ranked by *how many units it blocks*. Each GAP row gets
an owner lane and an acceptance test. A GAP row with no owner is the row that
does not get built.

---

## 3. THE THREE LAWS (learned by shipping the bugs)

### 3.1 A relight is not a change
A state variant is accepted on its **diff mask**, not on its look. The
"ring-lit" church variant had max delta 288 but mean delta 0.557, with the
above-threshold pixels confined to a 55x53 patch — arithmetically a change,
dramatically nothing: the gown got brighter and no gold band appeared on any
hand. If the thing the script names is not IN the diff, the variant did not
happen. Assert the object, not the delta.

### 3.2 THE STAGING-OBJECT LAW — the carriage lesson
**Vehicles and set-pieces the script demands are first-class staging objects,
with the same ledger row, owner lane and acceptance test as a character.**

What went wrong: Beat III is titled THE PURSUIT. Nine of its units demand a
cab, a landau or a four-wheeler on stage — "as he stepped up to the cab",
"drive like the devil", "up the lane came a neat little landau", and a GATE
whose cue reads *click the cab*. **Zero vehicles were drawn anywhere in the
book.** The gate's target ring sat on bare cobbles. A rig was a contact
shadow PNG plus a CSS radial gradient; the set module's own header documented
the hole and promised a drop-in that no code path could consume, because
nothing ever constructed an `<img>` for `rig-<id>.png`.

Three separate failures, and all three are structural:

1. **The ledger listed the rigs as art but never as STAGING.** They appeared
   in the GAP inventory (row 7 of 14) and nowhere in the SET ledger, so no
   mark, no scale, no pin, no acceptance test — nothing that would have made
   a missing rig an unfinished set rather than a pending sprite.
2. **The engine never asked for them.** A degrade-gracefully placeholder that
   requests nothing degrades silently and permanently.
3. **The verifier could not see it** (§3.4).

The law, in the order it gets applied:
* At **contract time**, grep the chapter for every physical noun the staging
  depends on — vehicles, doors, props a hand must hold, crowds, animals —
  and put each in the object ledger with the units it serves. "Nine units
  demand a vehicle" is a sentence the contract should be able to produce.
* Every staging object gets **measured geometry**, not a guessed offset: its
  pin is its own contact point (a carriage's pin is the wheels' foot centre,
  not the sprite's bottom edge), its height follows the set's px/m law, its
  contact shadow is sized off its own footprint, and any glow hangs on the
  painted lamp rather than on air.
* A rig **lies up-road of its pin** — an object pinned at a door is drawn
  over the man who just stepped out of it. Offset the pin, don't fight the
  art.
* Rails and paths **extrapolate past their endpoints** so objects drive INTO
  frame rather than popping onto it.
* A gate whose target is an object must call `targetPlate()` on the object's
  **measured body centre**. A gate cue that names a thing not in the picture
  is the worst defect in the book: it asks the reader to click something that
  does not exist.
* Lens numbers must measure **the thing the contract names**. `FOCUS.ring` at
  1.13 was defended by a correct measurement of the wrong quantity (the
  bride's box, not the ring). The reference frame was a 3.2x push; the ring
  needed k=2.20 to be an image of a ring at all.

### 3.3 THE CANONICAL SHEET LAW — consistency across beats
**One character has ONE canonical sheet. Every other cut of that character
inherits its head from the canonical, or it is a different person.**

What went wrong: the same three names rendered as different people across
sets. Holmes was three men in two render styles across the church cuts — a
grey-stubbled peasant at the pew, a shaggy blond-white old man at the altar,
and a soft 3D render with white sideburns in the walk strip — against a lean,
hawk-faced, clean-shaven, dark-haired canonical. The bride at St. Monica's
was an auburn-haired woman with unpainted closed eyes; Irene is near-black
cool-haired with painted open eyes. All four cells of the King's exit strip
still carried the domino mask, so the unit after his own unmasking put the
mask back on.

The law:
* Nominate ONE canonical PNG per character and record it machine-readably —
  `assets/plates/book/actors/MANIFEST-consist.json`. The canonical is the
  cut with the most face on it, not the most-used cut.
* **Never touch the canonical.** Every drifted pose keeps its accepted BODY
  and receives the canonical HEAD. Silhouette, costume and pose are the
  pose's own; identity is the canonical's.
* Drift is **measured, not eyeballed**. Cluster the darkest head pixels and
  compare warm/cool: the bride's failing cluster was `#300503` (R-B +45,
  warm) against canon's `#1B1928` (R-B -13, cool). A number decides.
* **Render style is part of identity.** A cut in a different rendering
  idiom reads as a different character even with the right face. Repaint
  into the book's own paint.
* **Walk strips are N characters, not one.** Check every cell. A 4-frame
  strip is four chances to ship a stranger.
* Accept on a **stage proof**, not on the sheet: composite the shipped cut at
  the set's real px/m onto the real plate on the character's own mark, and
  look at that. A cut that reads on a white sheet can be a stranger on the
  plate.
* Every fix lands with a **B/A contact sheet** under `review/consistency/`
  and sha-before/after in the lane's SHIP.json.

### 3.4 Corollary: make the gap REAL, or the lap lies
`stage.gaps` is appended only on a FAILED image fetch. A set that never asks
for its principal art passes green. The chapter ran twelve units of THE
PURSUIT with no vehicle in the picture and `lap.json` said `ok: true,
failures: [], gaps: []`.

Therefore stage 6 asserts **carriers on screen**, not fetches:
* every rig that is `on` the strip must have a drawn `body`;
* a gate's target must have a picture (`u.target === 'cab'` implies
  `rigs.follow.body`);
* a close lens must contain its object, at a legible pixel size, without
  spending its width off the painting (`ringIn`, `ringPx >= 18`,
  `voidPct <= 8`).

Generalize: **for every fact-with-a-carrier in the contract, stage 6 gets an
assertion that the carrier is on screen at the unit that needs it.** The
contract's fact list is the assertion list. Anything less and a green lap
means the code ran, not that the book is there.

---

## 4. COST TABLE (measured, this chapter)

Model calls counted out of `assets/raw/**/manifest.json` — every generated
artifact is raw-first with a sha256 manifest, so this is a count of what was
actually spent, retries and rejects included.

| stage | tool | model calls | notes |
|---|---|---|---|
| 0 contract | — (authoring) | 0 | the expensive stage is agent time, not tokens |
| 1 plates | `nbpro.py` (t2i) | 50 | every t2i call in the book: SETs, refsheets, candidates, rejects |
| 2 layers | `slice_plate.py` | 0 | deterministic — arithmetic on the plate |
| 3 variants + 4 actors | `nbpro_edit.py` (i2i) | 80 | state variants, actor poses, walk strips, props, rigs, the consistency re-graft |
| 5 grammar | — | 0 | reuse: `units.js` is byte-identical across versions |
| 6 verification | `living/lap.mjs` | 0 | Playwright |
| 7 deploy | — | 0 | static folder, no build step |
| audio (parallel) | `audiogen.py` | 47 | ElevenLabs SFX v2, beds + moment cues |
| **total** | | **130 image + 47 audio** | |

The t2i/i2i split (50/80) is measured off the `generator` field; the stage
split above it is not further divisible from the manifests, because one lane
issues both variant and actor edits. What IS measured per lane:

| lane | image calls | what it bought |
|---|---|---|
| `nbpro` | 32 | style lock, refsheets, the 3 rigs |
| `book` | 28 | the book's SETs and actors |
| `book-chase` | 17 | SET chase + layers |
| `beat1` | 14 | SET room (221B) + Beat I |
| `book-actors` | 11 | new characters |
| `book-consist` | 11 | the canonical-head re-graft pass |
| `book-street` | 9 | SET street + variants |
| `book-church` | 6 | SET church + props |
| `book-living` | 2 | living-build fixes |

At the ~$0.20/image-call figure this project budgets against, 130 calls is
**~$26 of generation for a 95-unit, 7-beat, 4-SET chapter** — roughly $0.27
per unit, or ~$6.50 per SET *including every reject*. Audio adds a few
dollars. Rerun the count after any lane; the manifests are the source of
truth, not this table:

```
python3 - <<'EOF'
import json,glob,collections
c=collections.Counter()
for f in glob.glob('assets/raw/**/manifest.json',recursive=True):
    try: d=json.load(open(f))
    except Exception: continue
    if not isinstance(d,dict): continue
    for e in (d.get('entries') or []):
        if not isinstance(e,dict): continue
        mid=str(e.get('model_id') or e.get('model') or '')
        if 'image' in mid: c['i2i' if 'edit' in str(e.get('generator','')) else 't2i']+=1
        elif 'eleven' in mid: c['audio']+=1
print(c)
EOF
```

**The real cost is agent time, not tokens.** A chapter is an afternoon; the
bug-fix pass documented above (three defect classes, 11 shipped files, 6 new
staging objects) was a second afternoon.

---

## 5. WHAT CARRIES OVER TO THE NEXT BOOK

Carries over unchanged: every tool in `tools/`, the grammar
(`units.js` + `main.js` + `stage.js`), the lap harness, the raw-first
manifest discipline, the four gate verbs, the leaf/turn model.

New per book: the frozen source text, the contract (`CONTENT*.md`) including
its object ledger and fact list, the plates, the actors, and the stage-6
carrier assertions that the new fact list implies.

Order of operations that does not double back: freeze text -> beats/leaf
table -> facts+carriers -> unit list -> verbatim audit -> scene ledger ->
object ledger -> inventory split -> generate -> slice -> stage-proof ->
wire -> assert carriers -> deploy -> lap the deployed URL.
