# THE DIRECTOR'S BOOK — THE CYCLOPS, in six edited scenes

Round 3 of the 3D book's camera. **Lane** `cine-r3-directors-cut`.
**Script of record** `CONTENT-odyssey.md` (81 units, six beats, three sets).
**Shot table** `site-deploy/living-odyssey/3d/shots3d.json`, baked by
`tools/ody/shots3d_bake.mjs`. **DP notes answered** `tools/ody/cine-sol-r1.md`.

---

## 0 · The defect this book answers

Round 2 gave every unit a good shot. It did not give any scene a **cut
pattern**. Thirteen units meant thirteen unrelated camera stations, each one
solved on its own merits and none of them answering the one before it. That is
Sol's round-1 note ("the sequence reads as set coverage, not escalating
cinema") restated one level up: not *these frames are wrong* but *these frames
are not an edit*.

Measured on the round-2 table, before any of this: **beat 1 = 13 units at 13
distinct camera setups.** A scene in which every angle is used exactly once has
no coverage. It has postcards.

A film scene is a **small vocabulary of camera setups**, established once and
then **alternated**. A setup that returns is an angle the audience already
knows, so the cut carries meaning instead of novelty; the dialogue runs as
shot-reverse-shot on two answering angles; the objects get inserts; the horror
gets reaction shots. This book is that vocabulary, scene by scene.

### The three laws, and where they are gated

| Law | Gate |
|---|---|
| **The angle changes.** No two consecutive units share a setup unless the row declares a hold reason — and a hold is the *same shot still running* (same station, same lens, the move clock is not restarted). | bake: `COVERAGE:` warnings · lap: `[coverage] the angle changes between consecutive units` |
| **Establish once.** One `establishing` setup per scene, used once. A world that has *changed* (a night that has become a morning) is re-established on a different setup with the role `reestablish`. A master that comes back must declare a `reprise` reason. | bake + lap: `[coverage] one establishing setup per scene` |
| **The vocabulary recurs.** At least a quarter of a scene's cuts must be a RETURN to a setup the reader has already been given. | bake + lap: `[coverage] every scene RETURNS to angles the reader already knows` |
| **The angle change is MEASURED, not declared.** Consecutive stations must be ≥ 22° apart at the subject, or far enough apart / on a different enough lens to be a different camera. | solver constraint (26° minimum separation) · bake + lap: `[coverage] the angle change is MEASURED` |

### The lesson this round actually taught

The first pass of this book gated on the setup LABEL and passed, and the
recorded scenes then showed two of the very defects it was written to remove.
Measured on that pass: `pitiless` and `shipfast` were declared as the two
answering giant angles and the solver had put them **23 cm and 1° apart**; the
three ram-speech units, whose whole fix in this round was that they stop being
one station, came back **within one degree of each other.** The cause is that
the station solver may swing up to the set's cone (96° in the cave) to get
round the furniture, so two different hints converge on the one place the room
allows — and a gate that reads the label sees two different setups.

So the separation is now a **constraint the solver has to satisfy** rather than
a number reported afterwards: a candidate station is rejected if it sits within
26° of the previous shot's bearing on the same subject, and if the room
genuinely has nowhere else to stand the search runs again without it and the
row records `sepLost` out loud. Measured after: **the minimum cut angle in the
whole book is 26.6°, the median is 44°, and no two consecutive shots share a
camera.** One row reports `sepLost` — `sailedon`, whose station is authored.

The general lesson, worth more than the fix: *a gate that checks the intention
instead of the result will pass a broken frame with a correct label on it.*

---

## 1 · THE LENS — Spielberg, and why

Chosen from `references/director_styles/`, one lens and one only.

**The one-line lens.** *Shoot the face that sees before the thing that is seen;
spectacle always arrives second.*

Three reasons, in order of weight.

1. **It is the only lens in the set whose editing default IS coverage.** Its
   `coverage_style` is literally "master + reverse + reaction + insert, cut on
   the reaction rather than the reveal." Every other candidate would have had
   to be argued *around* the brief. This one *is* the brief.
2. **Its scale grammar is already this chapter's problem.** "低角度是复制孩子
   的视线高度 (1.0–1.3 m); 成人对话立刻回到眼平" — the threat is shot from a
   child's eye height with a human in the near ground; adult dialogue returns
   to eye level. That is Sol's sequence-level note word for word: *human scenes
   at human eye level; giant encounters from below.* The book's `GIANT` class
   (floor 0.42, crown pitch ≥ 21°, camera under his eyeline) was already
   half-way to this lens without knowing it.
3. **Its light is already the cave's light.** Amber + tungsten warm against
   grey-blue-green; one *named* practical; a visible hard shaft through thin
   haze; 3:1 warm, **8:1 threat by pulling the fill, not by closing the key —
   overall illuminance unchanged, so the audience never loses the space.** The
   book's own `READ_MOTIVATION` is `cave { fill #ff9a52, rim #8fa6d8 }`. The
   lens and the set lane arrived at the same palette independently, which is
   the strongest possible sign the lens fits the material.

**What the lens forbids, and what that costs us.** `avoid: dutch angle,
unmotivated handheld, orbit around subject, snap zoom, whip pan.`

- *Dutch* — free: the horizon is level by construction (`cam.up` is world up,
  so no move in the table can dutch a frame).
- *Unmotivated handheld* — free, and already law: Sol r1 #2 forced handheld to
  be an EVENT. The operator is locked off with a breath in it until `mv.at`,
  breaks loose at contact, then settles. That is precisely the lens's own rule
  ("晃动只在人物受到物理冲击的那几帧出现").
- *Orbit* — kept in exactly one place, `ody-iii-05-lots`, 9° over a ring of men
  drawing lots. A 9° drift over a circle is a **motivated pan** around a
  formation, not an orbit-for-mood; it is declared here so it is visible.
- *Whip pan* — the two rock throws (`rock1`, `heard`) keep `move.k = 'whip'`,
  and they are re-read as the lens's own **"motivated pan connecting person to
  threat"**: the eye rides the thrown rock up on a long rise and the splash
  takes it, with an operator's overshoot-and-settle. It is not a snap onto
  nothing; it is following an object that the audience is already looking at.

**What the runners-up would have given, so the choice is legible.**

- **Villeneuve** owns scale-dread outright and would have deepened the cave's
  monumentality — but his coverage default is *3–9 shots per scene at 8–18 s
  ASL, locked, no handheld, no whip*, and his own module says the lens is
  **不适合 … 群戏对白** (unsuited to ensemble dialogue). Six of our units are a
  two-hander across a fire and three more are a giant talking to a sheep. It
  would have flattened the exchanges into tableaux.
- **Kurosawa** owns the ensemble geometry and the low-angle mass — but his
  coverage rule is explicit: **剪辑在焦段压缩度之间切换，而不是在角度之间切换**
  (cut between focal compressions, not between angles). That is the direct
  negation of the owner's mandate. He also lists **室内心理剧、亲密两人对话**
  as out of scope.
- **Kubrick** owns firelit interiors and would have given the cave a terrifying
  symmetry — but his register is detachment, and this chapter's engine is a
  reader who is *inside* Ulysses' body.

**The lens's numbers, as applied.** Lens kit 21 / 35 / 50 / 135 mm-equivalent →
fov 62 / 38 / 27 / 10 on this book's 24 mm sensor height. ASL: the reader sets
it, so the target is expressed as the *shape* of the reading — 3–7 s of dwell
through the action beats, 5–9 s through the emotional ones. Transitions: hard
cut, match cut, dissolve.

---

## 2 · SCRIPT BREAKDOWN — what the whole thing is about

**Literal event.** A captain takes twelve men into a giant's cave to collect a
guest-gift, is trapped, loses six of them, blinds the giant with a heated
olive stake, escapes under the bellies of his sheep, and then shouts his own
name across the water.

**Dramatic question.** Not *will he escape* — the tale is being told aloud by
the man who escaped, and the reader knows it from unit 1. The question is
**what the escape costs**, and the answer is the thing he does after he is
already safe.

**Conflict.** External: a man against a creature twenty times his mass, in a
room the man cannot open. Internal: **cleverness against pride.** Every good
thing in the chapter comes from the first (the wine, the false name, the
fleece); the catastrophe comes from the second, and the reader's own hand
performs it.

**Subtext.** Hospitality. The chapter opens on a race with *no assemblies*, and
the whole disaster is a man walking into a stranger's house **to be given a
present**. The stake is not revenge for the eaten men; it is revenge for a
broken rule.

**Emotional movement.** Curiosity → greed → dread → the trap → cold method →
elation → hubris → the curse that outlives the story.

**Visual thesis — the one photographable rule.**
> **The men get smaller as the room gets more certain of them, and the camera
> gets lower as the men get more dangerous.**

Both halves are measured, not asserted. The cave's four establishing rungs run
camY 1.55 → 1.25 → 0.95 and 7.69 m → 6.67 m → 5.45 m — lower and nearer at
every beat — until Beat V breaks the ladder by **turning the camera round to
face the mouth**, because by then the subject of the room is the way out.

---

## 3 · BEAT SHEET — the six scenes as pressure

| # | scene | pressure in → out | the turn | shot families the beat needs |
|---|---|---|---|---|
| I | THE TALE BEGUN | idle curiosity → deliberate risk | `misgave` — he packs the wine **on purpose** | establishing · reveal · reaction · OTS · insert |
| II | THE CAVE | greed → the trap shut | `shiftstone` — the sword stops in mid-air | establishing · geography · giant-low · reverse · insert · aftermath |
| III | NOBODY | despair → a plan with a name on it | `noman` — the pun is bought | establishing · reaction · insert · giant-low · reverse |
| IV | THE STAKE | method → the trick works and the door opens onto nothing | `wentaway` — the lamps recede | establishing · insert · reaction · action · giant-low · tableau |
| V | THE RAMS | held breath → out | `feltbacks` — the hand strokes the fleece | establishing · insert · action · POV · two-shot · aftermath |
| VI | THE TAUNT | escape → the curse | `myname` — he hands the monster his name | establishing · single · reaction · giant · action · aftermath |

---

## 4 · THE COVERAGE, SCENE BY SCENE

Every scene below gives **intent**, the **coverage plan** (the setup
vocabulary), and the **cut pattern** as it is actually baked. `t1/t2/t3` is the
take number of that setup — the number an editor writes on a slate.

The cave (`CV-*`) has **one vocabulary across Beats II–V**, because it is one
room: a reader who learns the door angle in Beat II must recognise it in Beat
IV. Only the four establishing rungs are per-beat.

---

### BEAT I · THE TALE BEGUN — `shore`, 13 units

**Intent.** Plant the two facts the chapter is built on (a lawless one-eyed
race; the wine brought deliberately) while the reader is still comfortable, and
make the crossing feel like a decision rather than a plot move. This is the
only scene shot in daylight and the only one where the threat is at a distance;
the whole scene is therefore built on **one recurring threat angle that gets
closer every time it returns.**

**Coverage plan.**

| setup | name | role |
|---|---|---|
| `SH-EST` | THE BLACK STRAIT | establishing (once) |
| `SH-FLEET` | THE FLEET IN MIST | wide |
| `SH-TELLER` | THE TELLER | single on Ulysses |
| `SH-CAMP` | THE CAMP FIRE | reaction |
| `SH-STRAIT` | ACROSS THE STRAIT | reveal (the threat angle) |
| `SH-ISLAND` | THE GOAT ISLAND | reestablish (day) |
| `SH-COUNCIL` | THE COUNCIL, OVER THE SHOULDER | OTS |
| `SH-CRAG` | THE CRAG | reveal |
| `SH-SKIN` | THE WINESKIN | insert |

**Cut pattern** — 9 setups · 12 cuts · 4 returns · 1 dissolve.

```
EST → FLEET → TELLER → CAMP → STRAIT ⇢(diss) ISLAND → CAMP·t2 → COUNCIL
    → STRAIT·t2 → CRAG → TELLER·t2 → SKIN → STRAIT·t3
```

- **`SH-STRAIT` is the spine.** It returns three times and it tightens every
  time: 64 m of telephoto on the smoke, then 38 m on the cave mouth, then 24 m
  on the party climbing toward it. The threat does not get bigger; the camera
  gets closer to it, which is the same thing and is a decision the audience can
  feel.
- **The reaction is `SH-CAMP`, and it comes second.** Unit 4 is the *thing*
  (the smoke of a lawless race); unit 6 is the *faces* turning toward it, on
  the same angle as unit 3 but punched from fov 32 to 30 and from 0.35 to 0.46
  of frame height. The lens says shoot the face that sees; here the face is
  given the second, closer take.
- **The one dissolve** is at `dawn` — *"when the child of morning, rosy-fingered
  Dawn appeared."* Night to day is the only kind of transition this book
  dissolves for.
- **`SH-CRAG`** is a separate setup rather than a hold on `SH-STRAIT` because
  the shot *tilts* — the mouth holds empty and the lens climbs the cliff into
  the sky. A tilt off a held frame is a new shot, and calling it a hold would
  have been a jump cut wearing an excuse.

---

### BEAT II · THE CAVE — `cave`, 14 units

**Intent.** The trap. The scene has to do three things at once: establish a room
the reader can navigate, introduce a body whose scale is a *fact* rather than a
claim, and then run four exchanges of dialogue across a fire without ever
letting the audience forget which of the two speakers could end the other in a
second. It is the scene the whole coverage system is built for.

**Coverage plan.**

| setup | name | role |
|---|---|---|
| `CV-EST2` | THE ROOM, LOW AND EXPLORATORY | establishing (once) — ladder rung 1 |
| `CV-RACKS` | THE CHEESE RACKS | geography |
| `CV-DOOR` | THE DOOR, FROM THE DARK | geography |
| `CV-GIANT-E` | THE GIANT, FROM HIS FEET (east) | giant-low |
| `CV-GIANT-W` | THE GIANT, FROM THE WEST | giant-low |
| `CV-OVER` | OVER HIS SHOULDER, LOOKING DOWN | OTS |
| `CV-ULY` | ULYSSES, A MAN'S EYE | single / reverse |
| `CV-FIRE` | THE SEIZE IN SHADOW | action |
| `CV-OBJ` | THE HAND BENCH | insert |
| `CV-AFTER` | THE AFTERMATH | aftermath |

**Cut pattern** — 10 setups · 12 cuts · 1 hold · 3 returns · 1 dissolve.

```
EST2 → RACKS → ULY ⇢(diss) DOOR ═(hold)═ DOOR·t2 → GIANT-E → OVER → GIANT-W
     → GIANT-E·t2 → ULY·t2 → FIRE → OBJ → DOOR·t3 → AFTER
```

- **THE HOLD.** `return` → `boulder` is the one place in the first half of the
  book where the camera must not move. Declared reason: *"the men never look
  away from the door: the frame that watched him come in is the frame the stone
  shuts."* It is a true hold — same station, same 33° lens, same push still
  running — so the stone comes across a shot the reader has already been
  looking at for a full unit. Nothing else in the scene earns that.
- **SHOT-REVERSE-SHOT WITH A CONSISTENT EYELINE.** The exchange
  `strangers / plea / pitiless / shipfast / shiplie` is cut on four angles that
  obey one axis (the giant frame RIGHT, the men frame LEFT, gated at
  `[side]`): `GIANT-E` (from his feet, east, with Ulysses in the near ground as
  the scale reference) → `OVER` (his shoulder, looking sharply *down*) →
  `GIANT-W` (the answering low angle from the mouth side) → `GIANT-E·t2` (he
  leans toward the door and the return angle catches the lean going away, so
  his look stays screen-left) → `ULY·t2` (the clean reverse for the lie). The
  reader is never asked to re-learn who is where.
- **THE STANDOFF ON `CV-OVER` IS MEASURED AGAINST HIS MASS.** The first
  recording of this scene showed five of the plea's six seconds as a wall of
  blurred flesh: at 1.25 m behind a seated giant's *placement* the lens sits
  inside his torso, and a still taken after the shot had settled had hidden it.
  A shoulder frames the near edge of an over-shoulder; it does not BE the
  over-shoulder. Standoff is now 2.8 m with a 36° swing round his side.
- **THE SCALE REVEAL IS SHOT ONCE.** `GIANT-E·t1` carries `fg: ulysses` — the
  giant only reads as a giant because there is a known body at his feet. This
  is the only shot in the book that declares a foreground scale reference and
  the only one gated on it (`scaleRefOk`, ratio < 0.72).
- **The insert** is `CV-OBJ` at `sword` — hand height, downstage centre, the
  reader's own target.
- **`CV-AFTER` is not the master coming back.** It is a night station (bear 62,
  camY 1.9, fov 40) shot after the fire has sunk. The establishing setup
  `CV-EST2` is used exactly once, at the heading, and never again.

---

### BEAT III · NOBODY — `cave`, 14 units

**Intent.** Two more men eaten, the stake made, and the con. The scene's
problem is **repetition**: the third identical meal is the carrier of fact O.6
and must be staged identically — so the *coverage* has to carry the escalation
that the staging deliberately withholds. It does that by covering each meal
from a different place in the room.

**Coverage plan** — the cave vocabulary, plus `CV-EST3` (ladder rung 2, fire-
dominated, printed down so the flame keeps detail), `CV-MEN` (the faces),
`CV-CLUB` (the mast-scale reveal), `CV-LOTS` (the one overhead in the book,
moved east over the pens so it stops competing with the door angle for the one
piece of downstage floor the room allows), `CV-BOWL` (the authored
low-foreground bowl station), `CV-COLLAPSE`.

**Cut pattern** — 10 setups · 13 cuts · 4 returns · 1 dissolve.

```
EST3 ⇢(diss) MEN → DOOR → ULY → CLUB → LOTS → DOOR·t2 → FIRE → BOWL
     → GIANT-W → BOWL·t2 → ULY·t2 → GIANT-W·t2 → COLLAPSE
```

- **THE DOOR IS ONE ANGLE AND THE DOOR IS ONE EVENT.** The stone clapping to at
  `quiverlid` and the whole flock pouring back in at `return` are the same
  frame six units apart. Both aim at the GAP the flock comes through (2.6 m),
  not at the whole 4.6 m arch: asked for the arch at a third of frame height
  the framing law wants the lens twenty metres back, which is outside the cave,
  and the solver's only legal answer was to shrink onto the shot before it.
- **THE THREE MEALS, THREE ANGLES.** Beat II's `firstmeal` is `CV-FIRE` — the
  seize in silhouette against the blaze. Beat III's `morningmeal` is **`CV-MEN`
  — the reaction**: the faces of the men who are watching it, with the seize
  playing soft behind them. By the second meal the reader knows exactly what is
  happening off the faces, which is the lens's central claim, and it is the
  only way to stage the same horror twice without the second one being smaller
  than the first. `suppertwo` returns to `CV-FIRE`.
- **THE BOWL IS AN A-B-A.** `lookhere` (`BOWL·t1`) puts the ivy-wood bowl in the
  lower foreground with the reader's own hold filling it, and **racks from the
  bowl to the giant**. `besokind` cuts to `GIANT-W` for the flushed face
  leaning down. `thrice` (`BOWL·t2`) returns to the identical station **with the
  rack reversed — giant back to bowl.** Same setup, same glass, opposite focus
  travel: the reader is shown the offer, then the appetite, then the offer
  again, and the third shot is the second one turned inside out.
- **The pun and its price** run as reverse-shot: `noman` on `CV-ULY·t2` (the
  clean reverse onto the man, the giant's shoulder riding the near frame),
  `nomanlast` on `CV-GIANT-W·t2` (the price, tighter — frac 0.909).
- **`CV-CLUB`** delivers the club's mast-scale visually, per the contract: the
  lens pulls wide and the figures beside it are tiny. It is a reveal, and it is
  used once.

---

### BEAT IV · THE STAKE — `cave`, 13 units

**Intent.** The blinding, and then the joke that saves them. The two halves need
opposite grammars — the blinding is five shots of accelerating physical fact,
the neighbours' scene is a three-cornered conversation through a stone in which
**nothing is visible at all** and every cut has to carry the geography. Sol's
worst two round-1 frames were both in here (`beat4-auger`, "an unreadable black
occlusion"; `story-blinding-handheld`, "a static portrait, not a blinding").

**Coverage plan** — `CV-EST4` (rung 3: the floor), `CV-OBJ`, `CV-FIVEFACES`,
`CV-AUGER`, `CV-GIANT-W`, `CV-BLIND`, `CV-DOOR`, `CV-GIANT-E`, `CV-SEATED`.

**Cut pattern** — 9 setups · 11 cuts · 1 hold · 3 returns.

```
EST4 → OBJ → FIVEFACES → AUGER → GIANT-W → BLIND → FIVEFACES·t2
     → DOOR → GIANT-E → DOOR·t2 ═(hold)═ DOOR·t3 → GIANT-W·t2 → SEATED
```

- **THE FACE BEFORE THE WEAPON.** `embers` is the insert (the beam in the
  coals, glow ∝ the reader's own hold). `glowing` is **`CV-FIVEFACES`** — the
  drawn point is the lamp and it lights the men from below; "my men gathered
  round me, for heaven had filled their hearts with courage" is played on the
  faces that the courage arrived in. Only then does `auger` show the weapon.
  That ordering is the lens, stated as an edit.
- **`CV-FIVEFACES` RETURNS AT `fright`** — the same low lamp angle that showed
  the men find their courage now shows them running out of the light. One
  setup, two takes, opposite meanings. That is the cheapest and strongest thing
  coverage can do and round 2 had no mechanism for it.
- **The blinding itself** keeps Sol's two fixes and now sits inside a cut
  pattern that motivates them: `AUGER` (floor level, the shaft entering the
  lower corner on the men's hands, a decisive rack from the tip to the eye at
  0.12 s because the clock only holds this leaf for 0.6 s) → `GIANT-W` (the eye,
  handheld) → `BLIND` (attacker height, he fills the vertical frame, the
  operator controlled until `at: 1.15` and breaking loose exactly at contact).
  Three angles, three sizes, one axis.
- **THE HOLD.** `mustbeill` → `wentaway`. Declared: *"the lamps recede past the
  very seams the men have not stopped staring at — a cut here would take away
  the thing that is going away."* The neighbours' scene is cut
  `DOOR → GIANT-E → DOOR·t2`, an honest three-cornered exchange where one
  corner is off-stage, and then the answer to it is the **absence of a cut**.
- **`CV-SEATED`** closes the beat on the tableau the page turns out of: the
  blind giant in the mouth with his hands spread, night behind him, a slow push
  out of the cave's dark. It is the beat's one authored station.

---

### BEAT V · THE RAMS — `cave`, 13 units

**Intent.** Suspense, which is the one register in the book that is built
entirely out of what the audience knows and the character does not. Nothing in
this scene is a surprise: the reader watches a hand pass over a fleece with a
man under it. The coverage exists to keep both facts in the frame at once.

**Coverage plan** — `CV-EST5` (rung 4: the ladder breaks, the camera turns to
face the mouth), `CV-ULY`, `CV-WITHIES`, `CV-HANDPASS`, `CV-DAWNMOUTH`,
`CV-BELLY`, `CV-RAMSPEECH`, `CV-TWOSHOT`, `CV-OUT`.

**Cut pattern** — 9 setups · 12 cuts · 4 returns · 1 dissolve.

```
EST5 → ULY → WITHIES → HANDPASS → WITHIES·t2 ⇢(diss) DAWNMOUTH → HANDPASS·t2
     → BELLY → RAMSPEECH → TWOSHOT → RAMSPEECH·t2 → OUT → DAWNMOUTH·t2
```

- **THE RAM SPEECH IS A TWO-HANDER AGAIN.** Round 2 played all three
  `ramspeech` units from one station within 3° and 2 mm of each other — three
  units of a giant talking, from the same place, unmarked. It is now
  `RAMSPEECH → TWOSHOT → RAMSPEECH·t2`: his blind face, then the profile
  two-shot where his hand tightens in the wool an arm's length above the man he
  is looking for, then back to his face as he turns into the cave he thinks
  still holds them. The dramatic irony is *in the middle shot* and the two
  outer shots are what make it a middle.
- **`CV-HANDPASS` IS THE SCENE'S KEY ANGLE AND IT IS PLANTED FIRST.** At
  `threetoaman` it shows the flank rams closing over a man — the reader learns
  the geometry. At `feltbacks` (fact O.11's core image) the same low angle
  shows the giant's palm crossing the very wool it just taught us has a man
  under it. The plant and the payoff are the same setup.
- **`CV-WITHIES` returns for the gate.** The hands-and-fleece insert becomes the
  frame the reader clicks the great ram in — the target arrives on an angle
  they have already been given, so the affordance reads instantly.
- **`CV-BELLY`** is the one POV-family shot kept from round 2 and Sol's fix #3
  intact: under the flock at y 0.58, the belly line roofing the frame, the man
  in focus and the groping hand crossing above, the focus racking off the giant
  onto the ram.
- **`CV-DAWNMOUTH` bookends.** The dawn breaking past the seated giant is the
  scene's re-establish (a changed world, not a repeat); the run to the ship
  returns to it on wider glass, so the beat begins and ends on the light that
  was the goal.

---

### BEAT VI · THE TAUNT — `sea`, 14 units

**Intent.** He is already safe. Everything from here is chosen. The coverage has
to make the choosing visible, so the scene is built on **one two-plane master
that returns at the exact moment the reader commits the hubris**, and a stern
single that gets tighter every time he opens his mouth.

**Coverage plan.**

| setup | name | role |
|---|---|---|
| `SEA-EST` | THE TWO PLANES | establishing + one declared reprise |
| `SEA-STERN` | AT THE STERN | single (3 takes, tightening) |
| `SEA-ROCK` | THE THROW | action (2 takes) |
| `SEA-DECK` | THE DECK | geography |
| `SEA-MEN` | THE ROWERS | reaction |
| `SEA-CLIFF` | THE CLIFF CLOSE | giant (2 takes) |
| `SEA-HAND` | THE BECKONING HAND | giant |
| `SEA-ALTAR` | THE DRIFTWOOD ALTAR | aftermath |
| `SEA-OFF` | THE SAIL-OFF | aftermath |

**Cut pattern** — 9 setups · 13 cuts · 5 returns · 1 dissolve.

```
EST → STERN → ROCK → DECK → MEN → EST·t2(reprise) → STERN·t2 → CLIFF
    → HAND → STERN·t3 → CLIFF·t2 → ROCK·t2 → ALTAR ⇢(diss) OFF
```

- **THE REPRISE.** `SEA-EST` is the only establishing setup in the book used
  twice, and the row says why: *"the second gate is the master returning on
  purpose: the reader must commit the hubris inside the very frame that still
  holds the men begging him not to."* Both gates (`jeer`, `defy`) are shot on
  the two-plane so the target and the people who will pay for hitting it share
  one frame; the second take is punched from fov 22 to 20, which is the whole
  editorial comment.
- **THE STERN SINGLE TIGHTENS.** `taunt` 0.553 → `myname` 0.723 → `hades`
  0.679, on fov 30 → 24 → 25. The self-naming is the largest he is in the
  scene; the Hades line pulls back a hair and goes flat and cold.
- **THE AXIS HOLDS TO THE END.** Ship frame LEFT, island frame RIGHT, which is
  also the direction she is leaving in — declared once at the master and gated
  on 41 pinned rows. `SEA-OFF` is pinned `side: -1` explicitly so the sail-off
  reads as departure and not as a ship parked beside a cave (Sol #8b).
- **The two rocks are one setup.** `SEA-ROCK·t1` drives the ship *back* toward
  the mainland; `SEA-ROCK·t2` — the same angle, at 24 m instead of 22 — is the
  wave that drives them *onward*. The sea answers the prayer on the same lens
  it threatened them with.
- **`SEA-CLIFF` vs `SEA-HAND`.** The prophecy and the curse are the cliff close;
  between them, the wheedling ("come here, then, Ulysses") is a step round and a
  step lower so the beckoning hand comes toward the water. Tone turns get a cut,
  not a hold.

---

## 5 · BLOCKING AND STAGING — the rules that do not change

These are the invariants every shot in the table is written against.

- **THE PROSCENIUM.** All three sets are cutaways; the camera lives in the
  audience half-space and looks upstage. Every station is proved inside the
  set's camera volume and out of every ledger obstacle box, and a station that
  had to swing behind the action records the swing in its own row
  (`frame.solved`).
- **THE AXIS.** In the cave the giant is frame RIGHT and the men frame LEFT. At
  sea the island is RIGHT and the ship LEFT. 41 rows are pinned; the rest are
  geography and carry no side. Gated live at `[side]`.
- **HEIGHT IS MEANING.** Human scenes at human eye level (1.55–1.7 m). Giant
  encounters from 0.95–1.5 m with a crown pitch ≥ 21°. The one high station in
  the cave is `CV-OVER` at 3.4 m — the giant's own shoulder — and it looks
  sharply down, which is the only reason it is allowed to be up there.
- **DISTANCE IS NEVER CHOSEN.** `d = h / (2·frac·tan(fov/2))`. `frac` is the
  declared size; the class floor is the minimum share of frame height the
  subject may occupy. A shot cannot be "a bit closer" as a matter of taste.
- **THE SUBJECT IS THE BODY DOING THE THING**, never the furniture it does it
  to. Two round-2 shots aimed at a mark (the doorway stone, the mouth at
  `lastofall`) read as holes at mean 0.086 because a motivated rig has nothing
  to land on in bare rock.
- **ONE DOMINANT MOVE PER SHOT**, eased, and a pure function of
  `simT − the cut's simT`, so two laps of the same walk put the camera in
  byte-identical places.

## 6 · LIGHT — the lens's ratios on this book's rig

The sets' own light stories are untouched. On top of them the book carries a
**fill and a rim that belong to the subject of the line and travel with it**,
both motivated by something already in the room (the hearth's bounce off the
floor; the cold of the mouth; the moon on the water), both short-range so the
rest of the frame keeps the exposure the set lane signed off. Numbers are
illuminance at the subject, so a shot at 2 m and a shot at 9 m put the same
light on a face.

The lens's threat ratio is achieved the lens's way — **by pulling fill, not by
closing the key**: `WIDE` carries fill 0.3 / rim 0.4 and lets the room do the
work; a face carries 1.0 / 1.0; the blinding carries 1.2 / 1.3. Shots whose
frame is dominated by the blaze are **printed down** (`dof.expo` 0.86–0.90) so
the hottest thing in them still has detail instead of clipping to white — Sol
r1 #6.

**THE READABILITY LAW is the floor under all of it**, measured on the drawn
pixels inside the subject's own projected box: p90 ≥ 0.30 (something on the
body is lit), mean ≥ 0.10 (the region is not a hole), separation ≥ 0.05 from a
ring around it (the body stands off the background), and a cap on how much of
the box may be near-black. **A dramatic frame that hides the action is a
defect, not a style**, and it is gated on all 81 shots.

## 7 · PRESENTATION — transitions, focus, framing

- **STRAIGHT CUTS, everywhere but five places.** A unit advance is an instant
  cut: no tween, no fade, the way film has always changed shots.
- **FIVE DISSOLVES, 240 ms, all of them time.** `dawn` (I), `return` (II, the
  waiting segment's shadows creeping to dusk), `morningmeal` (III), `dawn` (V),
  `sailedon` (VI). Played on the composited frame out of a history target, so
  the scene graph never learns a transition happened, and forced off while any
  gate is reading pixels — **a measurement must never be taken of a frame that
  is half of two shots.**
- **TWO HOLDS, both declared, both because the reader must not be taken off the
  thing they are watching.** A hold does not restart the move clock; the shot
  simply keeps running.
- **DEPTH OF FIELD PER SHOT**, with a real thin-lens circle of confusion, so
  f/2 on a 50 mm two metres out throws the cave wall the way a lens would.
  Focus rides the subject, not the frame centre.
- **THE RACK IS A REVEAL, NOT A BLUR.** Where the story has two depths the row
  names both and when the focus travels between them: bowl → giant and back
  again, auger tip → eye (at 0.12 s, because that is inside the shot the reader
  is actually given), the giant's hand → the man under the fleece.
- **NO DEAD FRAMING.** Every shot is gated on size against its class floor,
  on edge-cut (the subject is wholly inside the frame or deliberately fills it),
  on look-room (the space in front of a speaking body exceeds the space behind),
  and on level (no accidental dutch).

## 8 · THE NUMBERS

| | setups | units | cuts | holds | returns | dissolves |
|---|---:|---:|---:|---:|---:|---:|
| I · THE TALE BEGUN | 9 | 13 | 12 | 0 | 4 | 1 |
| II · THE CAVE | 10 | 14 | 12 | 1 | 3 | 1 |
| III · NOBODY | 10 | 14 | 13 | 0 | 4 | 1 |
| IV · THE STAKE | 9 | 13 | 11 | 1 | 3 | 0 |
| V · THE RAMS | 9 | 13 | 12 | 0 | 4 | 1 |
| VI · THE TAUNT | 9 | 14 | 13 | 0 | 5 | 1 |
| **total** | **56** | **81** | **73** | **2** | **23** | **5** |

Measured cut angles at the subject, per scene (min / median / max degrees):
I 28 / 34 / 98 · II 27 / 89 / 160 · III 28 / 55 / 163 · IV 27 / 65 / 166 ·
V 27 / 40 / 117 · VI 27 / 30 / 106.

Before: beat 1 was 13 units at 13 setups and five consecutive pairs across the
book sat on the same station with nothing declared. After: no scene has more
setups than it has cuts-per-setup can justify, every scene returns to a known
angle on at least a quarter of its cuts, and the two repeats that remain are
holds with reasons written into the table.

## 9 · WHAT WOULD MAKE THIS BETTER NEXT ROUND

1. **Reaction coverage is still one-shot-per-unit.** The book's grammar is one
   unit = one shot, so a beat that wants *seize → faces → seize* has to spend
   three units on it. Two or three places (the first meal, the blinding's
   impact) would be stronger with a mid-unit cut on a clock, which the engine
   can already express and the table cannot yet.
2. **Two things were only visible in motion**, and both were found by watching
   the recorded scenes rather than the frame sheet: the plea shot blocked by
   the giant's own mass, and two setups the solver had collapsed onto one
   station. Stills cannot judge an edit and they cannot judge an occlusion that
   clears late. The scene recordings should run before the frame sheet, not
   after it.
3. **`ody-iv-12-doorway` still reports a size of 9.0** — it is `liveAnchor`, so
   the surveyed anchor is known-wrong and the live gates hold it instead. The
   marks tool is written against the 2D harness and cannot re-survey the 3D
   page; that is its own lane.
4. **The whip is the one lens exception in the book.** If a later round wants
   the lens clean, both rock throws become a constant-rate motivated pan with
   the impact handled by the four frames of break-loose the lens does allow.

## 10 · THE JUDGMENT ARTIFACTS

Six scenes, each played whole at one reading pace (6.9 s a line, a gate
answered in about four, a beat clock left alone because it is the beat's own
time), captured off the book's own fixed-step clock with every unit answered by
the verb the unit declares. Zero console errors on all six.

`/Users/samz/Documents/gaslight-remake/shots/directors-cut-r1/`

| scene | file | length | shots | setups | cuts | holds | dissolves |
|---|---|---:|---:|---:|---:|---:|---:|
| I · THE TALE BEGUN | `beat1-the-tale-begun.mp4` | 106 s | 14 | 10 | 12 | 0 | 1 |
| II · THE CAVE | `beat2-the-cave.mp4` | 94 s | 15 | 11 | 12 | 1 | 1 |
| III · NOBODY | `beat3-nobody.mp4` | 88 s | 15 | 11 | 13 | 0 | 1 |
| IV · THE STAKE | `beat4-the-stake.mp4` | 63 s | 14 | 10 | 12 | 1 | 0 |
| V · THE RAMS | `beat5-the-rams.mp4` | 83 s | 14 | 10 | 12 | 0 | 1 |
| VI · THE TAUNT | `beat6-the-taunt.mp4` | 77 s | 14 | 9 | 12 | 0 | 1 |

The per-scene cut ledger — every shot, its setup, its take and the transition
it arrived on — is `scenes.json` in the same directory. Each recording runs one
shot past its own scene, into the first frame of the next, so the page turn is
in shot too.

A note on why these exist and the frame sheet does not replace them: **both
defects found after the first pass shipped green were invisible in stills** —
two setups the solver had collapsed onto one station, and an over-shoulder
whose first five seconds were the giant's own body. A still is taken after the
shot settles. An edit is what happens before it does.

---

# ROUND 2 — THE CUT IS NOT THE READING CLOCK

Sol's round-1 verdict (`tools/ody/directors-cut-sol-r1.md`) returned **COVERAGE,
not CINEMA, on all six scenes**, and every scene's note opened on the same
sentence in different words:

> "Fourteen scene shots run 87.9 seconds; the first eight are almost exactly
> 6.96 seconds each. That is reading cadence imposed on picture, not
> escalation." — Beat III
>
> "Detach camera changes from the reading clock. Keep the narration at reading
> pace, but cut inside long lines when information, attention, or pressure
> changes. Right now the 6.9-second pulse exposes the interactive-book
> machinery." — Beat I, fix #5

Round 1 had answered *which angle* correctly and *when to cut* not at all,
because it could not: **one unit was one shot.** The page turn was the splice.
No passage could tighten, no action could be a sentence, and a hand insert had
nowhere to live because there was no room between two page turns to put it.

## R2.1 · THE ARCHITECTURAL FIX — a unit carries a CUT LIST

A row in `shots3d.json` may now carry

```json
"cuts": [ { "t": 2.2, "setup": "CV-GRIP",  ...a whole baked shot... },
          { "t": 3.8, "setup": "CV-MEN",   ...a whole baked shot... } ]
```

`t` is the offset, in the unit's own seconds, at which the picture cuts. Each
entry is a **full station** — solved by the same solver, against the same
marks, inside the same proscenium volume, under the same 26° separation
constraint as any other shot. It is not a crop and not a re-frame.

- **Runtime** (`cine3d.js`): `cutTo()` arms the list at the unit's cut;
  `_spendCuts()` spends it inside `step()`. The move clock restarts at each
  sub-cut, because a new shot starts at its own first frame.
- **Determinism is unharmed.** The offsets are constants and the trigger is the
  book's fixed-step sim clock — two laps cut on the same frames. A reader who
  turns the page early simply never spends the rest of the list, which is what
  an assembly does when the projector stops.
- **The separation chain runs THROUGH the list.** A unit's opening shot answers
  the *last* shot of the unit before it, not that unit's opening shot.
- **A held row may not carry one.** A hold is the same shot still running; a
  shot that cuts away inside it was never a hold.

### The second half of the same fix: the reading clock is not a constant either

The judgment recorder gave every click unit 6.9 s. A constant is not a reader:
*"The Cave"* is two words and was held as long as a fifty-word speech, which is
why Beat II's setup ran 34.7 s on four ideas. The modelled dwell is now

```
dwell = 0.9 + words / 7.0, floored at 2.2 s (5.4 s at a gate), capped at 7.0 s
```

and the **same three constants live in the bake**, so a cut list is designed
against the reel it will actually play on — the bake warns when a sub-cut falls
outside a reader's dwell on that unit. Nothing in the book reads them: the
reader's own thumb is still the clock.

### The blinding's starved leaves (a contract amendment)

Measured on the r1 recording, `ody-iv-03-auger` — the decisive event of the
chapter — **held the screen for 0.58 seconds**, because the beat clock is armed
by the ember hold and `glowing` had already spent most of the way to its 4.2 s
offset before the leaf was entered. `emit_units_ody.py`'s clock offsets are
re-cut (auger 4.2→6.6, bore 7.4→9.7, hiss 10.4→12.5, fright 12.6→14.7, rock1
7.0→12.0) so each leaf owns real time: 3.0 / 3.1 / 2.8 / 2.2 s, and the throw
6.0 s instead of 2.58. The pantomime is act-driven and rides the unit, so no
staging moved with them.

## R2.2 · THE MEASURED RESULT

| scene | r1 shots | r2 shots | of which inside a unit | r1 ASL | r2 ASL |
|---|---:|---:|---:|---:|---:|
| I · THE TALE BEGUN | 13 | **23** | 10 | 6.96 s | **3.27 s** |
| II · THE CAVE | 14 | **24** | 10 | 6.96 s | **3.21 s** |
| III · NOBODY | 14 | **27** | 13 | 6.96 s | **3.00 s** |
| IV · THE STAKE | 13 | **23** | 10 | ~4.5 s | **2.25 s** |
| V · THE RAMS | 13 | **23** | 10 | 6.96 s | **3.35 s** |
| VI · THE TAUNT | 14 | **26** | 12 | 6.96 s | **3.20 s** |
| **book** | **81** | **146** | **65** | | |

Setups 56 → 83. Cuts 73 → 138. Returns 23 → 61. Holds still 2, dissolves still
5. Median measured cut angle 36.4°. On the live lap the camera played **144
shots, 63 of them taken inside a unit** — the two it did not are the tail of a
cut list the reader turned the page out of, which is the mechanism working.

## R2.3 · THE NEW VOCABULARY — sixteen setups, and why they had to exist

Sol's verdict names the same absence in all six scenes: *"the essential
reaction and action inserts do not exist ... this cannot be solved by trimming
alone."* Round 1 had a setup for every ANGLE ON A PERSON and almost none for a
HAND, an OBJECT, or a FACE THAT IS ONLY WATCHING — which is exactly the half of
the vocabulary a cut list needs, because those are the shots short enough to
fit inside a line of text.

| set | new setups |
|---|---|
| shore | `SH-CREW` matched council reverse · `SH-SHIP` the ship insert · `SH-KEEL` the crossing at the waterline |
| cave | `CV-GRIP` the hand that takes them · `CV-HILT` the hand on the hilt · `CV-VITALS` past the blade, up at him · `CV-STONE` the stone at close quarters · `CV-HANDS` the hands on the beam · `CV-POINT` the point · `CV-POUR` the pour · `CV-SEAM` the seams · `CV-WOOL` the fists in the fleece · `CV-GATEWAY` the way out with him in it |
| sea | `SEA-DOWN` from the headland looking down · `SEA-GRIP` the rock in his hands · `SEA-OAR` the oar bites |

Four round-1 stations were **moved** because Sol photographed them blocked, not
badly chosen: `CV-MEN` (the giant's torso stood between the lens and the faces
the setup exists for), `CV-CLUB` (looked across the pens), `CV-COLLAPSE`
(shelving over half the frame), `CV-OUT` (the solver had put it 1.16 m and 0.4°
off the ram-speech single once the two-shot was re-lensed — a punch-in wearing
a new name).

## R2.4 · THE SIX PRESCRIPTIONS, EXECUTED

### BEAT I — triangle coverage, an action-chained crossing, and end on dread

```
EST · FLEET · CAMP* · TELLER · CAMP · STRAIT · CRAG* · ISLAND
  · CAMP · CREW* · STRAIT* · COUNCIL · KEEL · STRAIT* · CRAG · STRAIT*
  · TELLER · SHIP* · CREW* · SKIN · STRAIT · SKIN* · TELLER*
```
(`*` = a shot taken inside a unit, off its cut list)

- **The 22.6-second council hold is gone.** The triangle is CAMP (the feast) →
  `SH-CREW` (the eyes turning) → `SH-STRAIT` (the smoke they see) → `SH-COUNCIL`
  (the OTS he speaks across) → and the ship as an object at `wineskin`, the
  line that is actually about drawing her ashore.
- **A GATE UNIT KEEPS ONE FRAME.** The ship insert was first written inside the
  council itself and the `[hit]` probe killed it dead: the reader's ring and
  the click both ride an aim measured against the live shot, and a cut mid-gate
  leaves a finger reaching for a camera that has moved. The aim cache is now
  dropped on any sub-cut — that part was a real bug — but the rule stands, and
  it is a rule about interaction, not about pictures: **a unit whose whole job
  is to be pressed does not get to change its mind.**
- **The crossing is a chain.** `ody-i-08-cave` opens at the waterline on a
  moving keel and cuts on the movement to the mainland arriving. The location
  change reads as travel.
- **The scene ends on a man, not a coastline.** `misgave` is three shots: the
  mouth, the wineskin he packs *because* of it, and his face with the cave in
  its look-room.

### BEAT II — a 10–14 s setup, and the sword as a cinematic sentence

```
EST2 · RACKS · FIRE* · ULY · MEN* · DOOR ═hold═ DOOR · GIANT-E · OVER · ULY*
  · GIANT-W · MEN* · GIANT-E · ULY · OVER* · FIRE · GRIP* · MEN*
  · OBJ · HILT* · VITALS · ULY* · STONE* · AFTER
```

- **The setup passage** was 34.7 s over 4 shots. The heading is now 1.8 s
  instead of 6.9 (two words), and the three setup units carry inserts: it is
  **26.8 s over 7 shots, 3.8 s ASL.** The wall-clock cannot go to 10–14 s
  without deleting Butler's text; the redundancy Sol was actually objecting to
  is gone — no view repeats and none runs over four seconds.
- **The seize escalates**: `CV-FIRE` (2.2 s) → `CV-GRIP`, the reach itself
  (1.6 s) → `CV-MEN`, the faces (1.5 s).
- **The sword is a sentence across two units** — decision (`CV-OBJ`, the hilt at
  the hip) → grip (`CV-HILT`) → the place the blow would land (`CV-VITALS`) →
  his eyes (`CV-ULY`) → the mass that answers them (`CV-STONE`). Sol read the
  r1 frames as a thrown weapon; the text is Ulysses' own sword and the beat's
  turn is that he *does not use it*, so the consequence shot is the stone.

### BEAT III — one axis, working reverses, and the blocked setups replaced

```
EST3 · MEN · GRIP* · DOOR · STONE* · ULY · CLUB · HANDS* · POINT* · LOTS · OBJ*
  · DOOR · STONE* · FIRE · MEN* · BOWL · POUR* · GIANT-W · OBJ* · BOWL · POUR*
  · OBJ* · ULY · GIANT-E* · GIANT-W · COLLAPSE · ULY*
```

**27 shots** (Sol asked for 22–24), ASL 3.0 s.

- All four blocked setups replaced or re-stationed (`CV-MEN`, `CV-CLUB`,
  `CV-DOOR`'s return take, `CV-COLLAPSE`).
- **The stake gets made on screen**: club wide → `CV-HANDS` (a fathom cut off)
  → `CV-POINT` (sharpened and charred).
- **Three distinct pours and three drains**, including both inside `thrice`.
- **The exchange runs on one axis**: `noman` punched from fov 25/frac .66 to
  22/.74, a `CV-GIANT-E` two-shot as geographic insurance inside the same unit,
  and the giant's answer closer and lower (camY 1.50→1.22, fov 46→42,
  frac .72→.80).
- The doorway return gets the flock entrance *and* the ominous sealing.

### BEAT IV — the blinding as escalation, the neighbours as a triangle

```
EST4 · OBJ · POINT* · MEN · AUGER · GIANT-W* · HANDS · GIANT-W*
  · BLIND · FIVEFACES · STONE* · DOOR · SEAM* · GIANT-E · FIVEFACES*
  · DOOR ═hold═ DOOR · STONE · GIANT-W* · DAWNMOUTH* · SEATED · FIVEFACES* · SEATED*
```

- The blinding is now **9 shots over 11.4 s** where round 1 had 4 over 12.6 s
  with the decisive one at 0.58 s: the beam-end in the coals under the reader's
  own hold → the men who find their courage → the shaft along the floor →
  **the eye** → twisting hands → the eye again → the impact (`CV-BLIND`,
  deliberately un-cut: the operator breaks loose at contact and a cut there
  would throw the one moment the shake is for) → the men → the stone they run
  into.
- **`glowing` carries no cut list, and that is a finding.** The second take of
  the coals insert, one unit after the first, photographed a black frame: from
  the only station that can see into the fire the beam has already left it. A
  shot the reader cannot see is not a shot, and a cut list is a tool, not a
  quota. `CV-FIVEFACES` was also replaced here by `CV-MEN` for the same
  reason — the low lamp angle it is named for delivers, at this staging, two
  dark legs across the foreground.
- The neighbours' triangle: `CV-DOOR` (the men listening) · `CV-SEAM`
  (lamplight moving in the cracks — the only way an off-stage character can be
  photographed from inside a shut cave) · `CV-GIANT-E` (his face) · and the
  silent reaction of the hidden men *after* the "Noman" line.
- The doorway action is covered: hand finds stone → boulder shifts → the night
  opens a slit → captives react → **back to the geometry**, wider than it
  began, instead of pushing into his back until the cave disappears.

### BEAT V — the near-capture, a geographic master, and consequence

```
EST5 · ULY · HANDPASS* · WITHIES · WOOL* · HANDPASS · BELLY* · WITHIES
  · DAWNMOUTH · GATEWAY* · HANDPASS · BELLY* · RAMSPEECH* · WOOL · BELLY*
  · RAMSPEECH · TWOSHOT · BELLY* · RAMSPEECH · OUT · GATEWAY* · DAWNMOUTH · AFTER*
```

- **The missing suspense inserts all exist now**: the hand gripping wool
  (`CV-WOOL`), the palm feeling the ram (`CV-HANDPASS`), the hidden eye
  tracking that hand (`CV-BELLY`), and the blind face that very nearly notices
  (`CV-RAMSPEECH` inside `feltbacks`).
- **`CV-GATEWAY` is the geographic master Sol asked for** — the blind giant, the
  gate, and the direction the flock goes, in one frame, declared at `dawn` and
  returned to at `freed`.
- **The ending lands instead of stopping**: the men clear the line, he does not
  know, and the beat holds one breath on the emptied room (`CV-AFTER`).
- The two-shot is re-lensed to 56° — at 46° the solver had put it within a
  degree of the speech single, which is round 1's own lesson repeating itself
  the moment the separation chain changed.

### BEAT VI — a real reverse, and the rock as an action

```
EST · STERN · DOWN* · GRIP · MEN* · ROCK* · DECK* · OAR · DECK* · MEN · STERN*
  · EST · STERN · DOWN* · CLIFF · MEN* · HAND · DECK* · STERN · CLIFF · DOWN*
  · ROCK · DECK* · ALTAR · MEN* · OFF
```

- **`SEA-DOWN` is the axis's missing half** — the ship as the thing on the cliff
  sees it, high and small. It returns four times, each time the scene needs to
  remember how small the mouth doing the shouting is.
- **The throw is four shots in one clock leaf**: `SEA-GRIP` (the rock in his
  hands) → `SEA-MEN` (the crew see it leave) → `SEA-ROCK` (the arc, the whip
  re-timed from 11 s to 4.4 s so the splash lands inside the leaf) →
  `SEA-DECK` (the boat thrown). The second rock cuts on the throw at 1.2 s.
- **Consequence coverage**: `SEA-OAR` (the oar biting), the stern single inside
  `menbeg` with the confidence cracking, the rowers inside the prophecy — which
  also breaks the two consecutive giant shots Sol timed at fourteen seconds.

## R2.5 · THE GATES THIS ROUND GAINED

- **THE READ LAW GAINED TWO ROLE BANDS** (`READ_BY_ROLE` in `cine3d.js`), and
  the reason is worth stating because it is the only place this round moved a
  threshold. The law's numbers were calibrated on 81 readings of BODIES at
  reading distance. Round 2 introduced ELEVEN INSERTS — a hand on a hilt, a
  bowl at a knee, a beam in coals — and their `p90` and `dark` hold
  comfortably (the objects are lit and legible) while `sep` fails *by
  construction*: the ring the law samples around an insert is the same lit
  plane the object is lying on, so demanding a fifth of a stop across that
  boundary is demanding a rim light no room motivates. The `insert` band is
  p90 0.14 / mean 0.03 / sep 0.010 / dark 0.80. The `pov` band extends to the
  other three terms the carve-out the POV class had already won for `dark`: a
  shot from under a flock is a shot from inside an obstruction. Nine of the
  ten remaining failures were fixed by moving the CAMERA, not the threshold.
- `[coverage] the angle changes between consecutive SHOTS (holds declared)` —
  the ledger is a list of shots, not units, and the law is asked of every
  consecutive pair the camera actually took, sub-cuts included.
- `[pacing] the cut is not the reading clock` — the table must declare ≥55
  sub-cuts, the lap must PLAY ≥75 % of them, and no scene's average shot length
  may exceed 4.2 s.
- The `[read]` and `[side]` viewing pass now measures **every shot of every
  unit** (147 readings, not 81): it seeks the unit, reads the opening shot, then
  advances the sim clock past each declared sub-cut and reads that frame too.
  A viewing law that only measured opening shots would be blind to two thirds
  of round 2's picture.
- Bake-side: a sub-cut must land after the unit's first frame, may not crowd
  the shot before it (0.6 s), may not repeat the setup it cuts from, may not be
  the beat's WIDE, and must fall inside the modelled reader's dwell.
- **THE PREFIX LAW**, which is round 2's own new failure mode and the best
  thing it taught. A cut list is spent in the READER's time and a reader may
  turn the page at any moment, so the shot the next unit OPENS on must be legal
  against *every* shot the unit before it could still be sitting on — its base
  and each of its sub-cuts. The first green bake shipped `feltbacks` cutting
  BELLY → RAMSPEECH and `lastofall` opening on BELLY; the table's own order was
  legal and the lap, which turned the page before the second sub-cut, played
  BELLY straight into BELLY. Generalised: *when a mechanism can be interrupted,
  the law has to hold on every prefix, not on the intended whole.*

## R2.6 · THE OTHER THING ROUND 2 FOUND

Three defects that were invisible until a close shot was scheduled late inside
a unit, and are worth recording because none of them is about cutting.

1. **The staging survey is taken mid-walk.** `shots3d_marks.mjs` advances a
   flat 2.2 s before recording each unit's anchors, so a subject still walking
   to its mark is surveyed where it happens to be. It never mattered while
   every unit had one shot taken from a distance; the plea's clean reverse,
   scheduled at 4.0 s into the unit, found its man **2.9× frame height and 17 %
   in frame** because the surveyed anchor was four metres from where he kneels.
   The shot now declares `follow`, which is what an operator does with a man
   who is still moving; re-surveying the whole table at reading pace is the
   right fix and is the first thing round 3 should do.
2. **A hand at night is not lit by a room.** Every new insert on a small
   object — a hilt, a beam-end in coals, a crewman's face on a night shore —
   failed `[read]` on its first bake with `dark` up near 1.0. The readability
   rig is per-shot and had been tuned for bodies; the inserts each carry their
   own `read` multipliers now (2.0–3.2 against the set's motivation).
3. **A sub-cut is a cut and the PAGE has to be told.** The council's ship gate
   went dead on the hit probe because `dropAim()` was wired to unit entry only:
   the aim cache — the pixel the reader's finger and ring both ride — outlived
   the camera it was measured against. `cine.step()` now returns how many cuts
   it took and `main3d` drops the aim on any of them.
