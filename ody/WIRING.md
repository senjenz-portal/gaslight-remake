# WIRING.md — living-odyssey: the engine's integration contract

Engine skeleton copied 2026-08-14 from `site-deploy/living/` into
`site-deploy/living-odyssey/`:

    COPIED      index.html, app/{main,stage,margin,clock,audio,setkit}.js
    NOT COPIED  app/units.js (book content), app/sets/*.js (book stages),
                assets/ (book art + audio)

The grammar (PIPELINE-LIVING.md stage 5) carries over unchanged. A new book
supplies exactly three things: `app/units.js`, `app/sets/<name>.js` per SET,
and `assets/` — plus the small list of engine-file edits in TODO below.

---

## 1. How SETS register

- `stage.js` head is the ONE registration point:

      import { RoomSet } from './sets/room.js';   // …street, chase, church
      const SETS = { room: RoomSet, street: StreetSet, chase: ChaseSet, church: ChurchSet };

  Static imports, so every set module must exist even if never mounted.
  Odyssey: replace with `{ shore, cave, sea }`.
- `units.js` binds content to sets three ways:
  - each unit's `set` field (defaults to `'room'` via `setOf()` in main.js);
  - `SET_OF_PAGE` (derived: first unit of each page wins; `END_PAGE → null`);
  - `TARGETS_BY_SET` — `validateUnits()` refuses a gate whose `target` its
    own set does not carry.
- Lifecycle: `stage.ensure(name)` builds the set once and resolves when every
  byte it can paint is DECODED (images registered via `stage.img()`/
  `stage.bitmap()` during the set's constructor land in `stage.building`).
  `stage.mount(name)` shows one and hides the rest, hands the set the current
  sim time (`rec.set.state.t = this.state.t` — a stale clock is a bug), and
  applies its dim matrix. `stage.decoded(name)` must answer synchronously
  (harness `__advance` steps the whole span in one call stack).
- ONE SET MOUNTED AT A TIME; the PAGE TURN is what swaps them. `startTurn()`
  ensures the incoming `SET_OF_PAGE[page]` and the cover HOLDS UP until it is
  decoded; decode-wait seconds are subtracted from story time (`S.stall`), so
  laps are byte-reproducible on any line speed.
- Boot decodes ONLY the first leaf's set (plus all audio and all cameos)
  before `window.__ready = true`. Harness `__ensureAll()` decodes the rest.

## 2. What a SET module must export

One class (e.g. `export class ShoreSet`), constructed `new Cls(wrapEl, stage)`
where `wrapEl` is a 1408x768 plate-space div inside `#cam`. Surface consumed
by stage.js/main.js (from RoomSet/StreetSet, the proven shapes):

    static insets = { id: 'inset/file.jpg', … }   // plates this set may raise;
                                                  // decoded WITH the set
    dimMatrix     [r,g,b]  measured relight multipliers at full dim
    state         at least { t }  (stage stamps it on mount/reset)
    reset()                back to how unit 0 of its leaf finds the world
    step(t, dt, {dim})     one fixed 1/60 step; pure function of sim time
    fire(act, settled)     a named verb from a unit's act/gateAct; `settled`
                           = replayed jump: leave the world at the act's END
    startSeg(name, dur, t0)  optional; timed pantomime (t0 already rewound
                           by `dur` when settled)
    waitDone(name) -> bool optional; has the thing a `wait:` unit named
                           happened on stage yet
    ruseT() -> t|null      optional; the beat-local clock `verb:'clock'`
                           units are timed against (null = not started)
    focusPlate(name) -> [x, y, k]      camera target for unit.focus
    camOverride() -> name|null         optional; set takes the camera
    targetPlate(name) -> [x, y]|null   where the gate ring stands (plate px)
    targetLive(name) -> bool           is the gate's thing on frame now
    targetHit(name, {x,y}) -> bool     raycast in PLATE px (engine adds a
                                       48 screen-px slack radius on top)
    headPlate(who) -> [x, y]|null      leader-line endpoint per SPEAKER
    holdAnchor() -> [x, y]|null        where the hold ring pins
    setHold(k)             optional; continuous 0..1 from the hold verb
    snapshot() -> {}       merged into stage.snapshot() for the harness

Helpers a set builds with: `setkit.js` (`PLATE`, `el`, `box`, `placeSprite`
— foot-baseline anchoring, the only anchor an isometric plate allows —
`floorY`, `emissives`, `breathe`, easings) and stage plumbing `stage.img()`,
`stage.bitmap()` (CSS backgrounds MUST go through this or they decode late),
`stage.cue(id, delay)`, `stage.gain(id, k)`. Honour `stage.reduced`
(prefers-reduced-motion: kill ambient loops, keep story motion). LAW: no
wall-clock reads; everything is a function of the `t` handed to `step`.

## 3. What units.js must export (the engine's imports)

main.js imports, byname — all REQUIRED:

    UNITS            the ordered array (the whole book)
    BEATS            [{ n, num, title, set, leaf, units, noHeading? }]
    beatOf(u)        -> BEATS[(u.beat||1) - 1]
    END_PAGE         the closing card's leaf number (last leaf + 1)
    END_CARD         { page, kicker, title, sub }  — fills #endcard
    PAGES            [...new Set(units' pages, END_PAGE)]
    SET_OF_PAGE      { page -> set name, END_PAGE -> null }
    CUE_DEFAULT      { click, hold, auto, target, clock } affordance labels
    FIRST_HINT       first-visit hint string
    validateUnits(u) -> [] of error strings (harness asserts empty)
    unitByKey(k)     resolve by `key` OR `id`

## 4. Unit fields the engine consumes

    id        REQUIRED unique kebab id — the screenshot filename and harness
              address ('ody-i-01-bard' style sorts)
    key       REQUIRED short content-file id; unitByKey resolves either
    text      REQUIRED string ('' = pure beat); `*word*` renders italic
              (Gutenberg's own emphasis; nothing else is markup)
    speaker   '' = narration (no prefix; the reader IS the narrator);
              else a key into margin.js WHO (unknown keys fall back to the
              raw string as prefix); doc:true entries (NOTE/LETTER) rule off
              + italicise — a thing READ is not a thing SAID
    verb      'click' | 'hold' | 'auto' | 'target' | 'clock'
    target    REQUIRED for target verb; must be in TARGETS_BY_SET[set]
    at        REQUIRED for clock verb; seconds past the set's ruseT() zero
    turnAt    clock verb only: the beat clock time at which the page turns
    wait      unit may not be paged past until set.waitDone(name); clicks
              inside the window are LATCHED and spend on unblock
    seg/segDur/segHold   timed pantomime on entry; segHold paces the unit
    focus     REQUIRED — key into set.focusPlate
    page      REQUIRED leaf number; a page change IS a turn IS a set swap
    beat      1..7 (index into BEATS, NOT the printed numeral)
    set       set name; one per leaf; default 'room' (change for odyssey)
    dwell     auto verb's seconds (also caps soft-fail for other verbs)
    hold      hold verb's required press seconds
    reveal    id of the inset the hold resolves ('watermark' is special-cased
              in stage.js: glow + brightness ride the hold level)
    gateAct/gateSfx   fired when a target gate resolves (gateAct is ALSO
              fired on silent replay — a replayed gate was already answered)
    endsBeat  the gate/click that turns the page out of the beat
    endsBook  last unit; its completing click raises the closing card
    cue       affordance label (else CUE_DEFAULT[verb])
    clear     true = fresh margin stack; else appends (max 3 blocks shown)
    drop      drop cap
    sfx       audio cue id on entry (must exist in audio.js FILES)
    bed       ambience bed id to cross-fade to on entry (ditto)
    act       set act fired on entry
    cameo/cap cameo art id + caption — see §5
    fact      comprehension-contract fact id (review aid only)
    head/num  chapter-head styling + printed numeral
    hadnote-style EXTRA_SFX: main.js carries a per-key extra-sfx table for
              units needing two cues in one slot

## 5. Cameos + captions

- `CAMEO_URLS` in main.js maps art id -> `./assets/cameo/<name>.jpg`.
  ALL of them are decoded in `cameo.preload()` before `__ready` (a late
  decode is a lap-diffing pixel pop). Missing art degrades to a monogram
  (`.noart`), never breaks.
- `unit.cameo` raises the card, `unit.cap` captions it; same id twice is a
  no-op, a CHANGED id flips the card (the identity-reveal device).
- Cameos persist WITHIN THE LEAF ONLY: `applyCameo` scans back through units
  of the same page for the nearest own-property `cameo`. An explicit
  `cameo: null` is the card being PUT AWAY mid-leaf (emit_units writes
  `cameo: 'off'` as `cameo: null` — the property must EXIST on the unit,
  hasOwnProperty semantics). Page turn hides it; the next leaf raises its own.

## 6. The closing card

- It is a PAGE, not an overlay. The `endsBook` unit's completing click calls
  `startEnding()` -> fills `#endcard` (`.kick/.ttl/.sub`) from `END_CARD`
  -> `startTurn(END_LEAF)` (no page sfx; the last unit already cued it).
- Under the risen cover `enterEndLeaf()` runs: `stage.fire('kingOffstage')`
  (a SHERLOCK act name — see TODO), margin cleared, `margin.progressEnd()`
  (HARDCODED sherlock line — see TODO), leader + cameo cleared, `#stagewrap`
  opacity 0, `body.dataset.unit = 'end-card'`. `END_PAGE` maps to set `null`.

## 7. PLATE size

`PLATE = { w: 1408, h: 768 }` (setkit.js, re-exported by stage.js). `#cam`
and every `.set`/`.actors`/`.hinge` box in index.html is literally 1408x768
CSS px — asset manifests are written in plate px with no conversion. The
projection is isometric: actor height does not change with depth, only the
floor line moves. Portrait crops the visible box to 1060x768 (`main.js
layout()`); landscape shows the full plate. All new plates/strips/cameos must
be authored to this space.

## 8. How the harness finds units

- Always attached: `window.__ready`, `__state()`, `__unit()`, `__units()`,
  `__unitByKey(k)`, `__beats()`, `__errors()`; plus `body.dataset.{ready,
  unit,verb,gate,set,beat}`.
- Under `?harness=1` only: `__gotoUnit(n)` (ASYNC — accepts index, `key` or
  `id` via `UNITS.findIndex(u => u.key === n || u.id === n)`; ensures the
  target's set, `stage.reset()`, mounts, then replays THIS LEAF's units from
  the first unit of the same page, silent except the last — silent replay
  fires `act` AND `gateAct` and runs `seg`s settled), `__click()`,
  `__gateClick()` (proof of firing = the reader MOVED: index change, turn
  started, or clock-held), `__gateMiss(dx,dy)`, `__holdStart/__holdEnd`,
  `__setTime(t)` / `__advance(dt)` (latches harness mode; rAF stops driving
  the clock), `__renderNow()`, `__mute()`, `__audio()`, `__ensureAll()`,
  `__refs` ({stage, audio, margin, clock, S, UNITS}).
- Soft-fail (30 s, gates and lines both) applies only to `(u.beat||1) >= 2`
  — Beat I of SHERLOCK shipped without it. DECISION NEEDED: odyssey's spec
  says "every gate … self-satisfies after 30 s" with no beat-1 carve-out, so
  the `>= 2` guard should likely drop for this book.

## 9. Audio contract

`audio.js` owns the id -> file map (`FILES`), per-clip `GAIN`, and the `BEDS`
set (currently hearth/street/chase/church). Every `bed`, `sfx`, `gateSfx`
in units.js must be a key of FILES; all clips decode in `preload()` before
`__ready`; every cue/bed change is logged with sim time (the harness's
evidence). Base path `./assets/audio/`, manifest gains from
`assets/audio/manifest.json`.

---

## TODO — every sherlock-specific string left in the copied engine files

DO NOT EDIT YET — recorded for the odyssey adaptation pass.

- **index.html**
  - [ ] `<title>Gaslight — The Living Book · A Scandal in Bohemia</title>`
  - [ ] `./assets/page-texture.jpg` (leaf texture — asset must exist here)
  - [ ] comment citing `room-dim.jpg` matrix values (cosmetic)
- **app/main.js**
  - [ ] `CAMEO_URLS` — holmes/watson/irene/norton/king-masked/king-unmasked
        -> `./assets/cameo/*.jpg`; replace with ULYSSES/POLYPHEMUS set
  - [ ] `EXTRA_SFX = { hadnote: [['knock', 0], ['step', 0.62]] }`
  - [ ] `enterEndLeaf()` fires `stage.fire('kingOffstage')`
  - [ ] `EMBODIED = new Set(['HOLMES', 'KING', 'CLIENT', 'GODFREY NORTON'])`
        (leader-line speakers; odyssey: ULYSSES/POLYPHEMUS/THE MEN…)
  - [ ] `setOf()` default `'room'` and boot fallback `SET_OF_PAGE[...] || 'room'`
        (odyssey default set is `shore`)
  - [ ] header comment "95 units, seven beats, eight gates…" (cosmetic)
  - [ ] soft-fail beat-1 exclusion `(u.beat || 1) >= 2` (see §8 decision)
- **app/stage.js**
  - [ ] `import { RoomSet } … ChurchSet` + `SETS = { room, street, chase,
        church }` -> `{ shore, cave, sea }` (the registration point)
  - [ ] `snapshot()` hardcodes plate ids `note/watermark/both/rocket/irene`
  - [ ] `'watermark'` special-casing (makeInset glow, setReveal, step glow)
        — odyssey's hold-reveals need their own id or a rename
  - [ ] doc comments citing room/street/church matrices + King bug (cosmetic)
- **app/margin.js**
  - [ ] `WHO` map — HOLMES/WATSON/CLIENT/KING/NOTE/LETTER/THE GENTLEMAN/
        IRENE ADLER/GODFREY NORTON -> ULYSSES/POLYPHEMUS/A CYCLOPS/THE MEN
        (unknown speakers fall back to raw-string prefix, so it RUNS, but
        doc-register and prettified prefixes need the map)
  - [ ] `progressEnd()`: `'A SCANDAL IN BOHEMIA — end of chapter'`
- **app/audio.js**
  - [ ] `FILES`/`GAIN`/`BEDS` — beds hearth/street/chase/church + sherlock
        cues (knock, mask-drop, hoofbeats, cry-fire, rocket, window-open…)
        -> odyssey's bed + cue ledger
- **app/clock.js, app/setkit.js** — clean; no book-specific strings.

(Also note: `END_CARD`, `BEATS`, `TARGETS_BY_SET`, `FIRST_HINT`,
`CUE_DEFAULT` are sherlock too, but they live in units.js which was NOT
copied — they are the new book's content, not engine edits.)

---

## emit_units.py — table format, output, and odyssey fitness

`tools/living/emit_units.py`:

- **Expects** (hardcoded `MD = …/CONTENT-full.md`): beat sections opened by
  `^### BEAT <ROMAN>` (ROMAN in `ORDER = {II..VII}`), closed by any `^## `
  line; markdown table rows split on `|` where `c[1]` = digit row number,
  `c[2]` = unit id (backticks stripped), `c[3]` = prefix (bold and `*(…)*`
  annotations stripped; `—` -> ''), **`c[5]` = verbatim text**. The staging
  column is IGNORED: verbs, gates, focus, acts, sfx, page/set all come from
  the authored in-file dicts `S` (per unit id) and `BEAT_META` (per beat) —
  the table supplies ONLY id/prefix/text, so Doyle is never retyped.
- **Emits**: JS unit object literals (fields in `ORDER_KEYS` order, wrapped,
  with `/* beat.n — comment */` headers) to **stdout** — a block to paste
  into units.js after the hand-written Beat I. `head` rows get
  `key: 'head<beat>'`; `cameo: 'off'` becomes `cameo: null` (cap dropped).
  Refuses unconsumed staging keys (`SystemExit`). Non-destructive by design.
- **Can it consume CONTENT-odyssey.md as-is? NO.** Verified by dry run
  (`/tmp/ody_emit_probe.py`, prints only): the verbatim parser finds ZERO
  beats. Required column-mapping tweaks:
  1. `MD` path -> `CONTENT-odyssey.md`.
  2. Header regex -> `^## Beat ([IVX]+)\b` (odyssey beats are LEVEL-2,
     mixed-case `## Beat I · …`; the `startswith('## ')` reset still works
     because the match runs first).
  3. `ORDER` needs `'I': 1` and the emit loop `(2..7)` -> `(1..6)`:
     odyssey's Beat I IS in the tables (sherlock's was hand-authored).
  4. **Columns are swapped**: odyssey is `| # | id | prefix | text | verb |
     staging |` — text is `c[4]`, verb `c[5]`. The sherlock mapping reads
     the verb column as text (probe: "auto", "click", "click").
  5. Key derivation `uid.split('-', 2)[2]` yields `'01-bard'` for 4-segment
     `ody-i-01-bard`; needs `split('-', 3)[3]` (`'bard'`).
  6. A NEW authored `S` staging dict + `BEAT_META` for the odyssey (pages
     1-5, sets shore/cave/cave/cave/sea; leaf 3 shared by Beats III+IV, leaf
     5 -> 6 closing card). The table's verb column (`target:`ship``,
     `clock ≈12 s`) can seed it, but `S` stays the source of truth.
  7. Beat VI has NO row-0 head unit (its heading rides `ody-vi-01-jeer`'s
     staging) — head emission must not assume one per beat. Odyssey ids are
     sometimes backticked, sometimes bare; `strip('`')` handles both.
  - With fixes 1-5 the parser reads **81 rows** (76 text units + 5 heads):
    beats 13/14/14/13/13/14, `ody-i-00-head` … `ody-vi-14-sailedon`.
