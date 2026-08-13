# CONTENT-full.md — Beats II–VII — the authoritative script + SCENE LEDGER

The companion to `CONTENT.md` (which covers **Beat I only**, and is LIVE at
`site-deploy/living/`). This file covers **Beats II, III, IV, V, VI and VII** —
the rest of Chapter 1, "A Scandal in Bohemia" — in the same format, and adds the
**SCENE LEDGER** (§6) that CONTENT.md never needed because Beat I plays on one
set.

Extracted from the reference repo:
`/tmp/thebook/books/sherlock/book/main.js` — `script2()` … `script7()` +
`fireRuse()` + the `LINES` / `WHO` / `CUES` tables — and
`/tmp/thebook/books/sherlock/book/story/COMPREHENSION.md`. Set behaviour is read
out of the reference's own scene modules (`scene-lab/scenes/street.js`,
`scene-lab-chase/scenes/chase.js`, `scene-lab-church/scenes/church.js`,
`scene-lab-221b/scene.js`) — **not assumed**. Every quoted string is Doyle
verbatim (Gutenberg #1661, public domain), trimmed only with ellipses, and every
one was re-verified against `sources/pg1661_2026-08-04.txt` (§3).

**The builder implements THIS script. Do not invent, paraphrase or reorder.**

---

## 0. The five things a reader of this file gets wrong

1. **The beat number is not the heading numeral.** Beats V, VI and VII show the
   reader *no heading*, **V**, and **VI**. See §6.1. Getting this wrong ships a
   book that counts to seven and prints to six.
2. **The fact prefixes do not track the beat numbers.** Beat III carries facts
   `P.*`; Beat IV carries `M.*`; Beat VI carries `III.*`; Beat VII carries
   `IV.*`. This is deliberate (COMPREHENSION.md: *"Fact ids did not move"*) so
   that the ids minted before the chapter was re-cut still mean what they meant.
3. **Beat II is split in half by the told story.** Beats III and IV are Holmes
   *telling* Watson about his afternoon; Beat V is Beat II resuming mid-scene,
   which is why it has no heading and no establishing beat.
4. **Beat V and Beat VI are the SAME LEAF.** There is no page turn between them.
   Every other beat boundary is a page turn.
5. **Beat VI is the one stretch of the book that is not click-paced.** After the
   reader's throw, the camera owns the frame for 19.8 s and five units arrive on
   the beat's own clock (§6.6).

---

## 1. Inherited law (from CONTENT.md — unchanged, restated so this file stands alone)

1. Prose sits as cream serif ink in the dark page margin beside the diorama —
   edgeless wash, no boxes. ≤3 lines visible; earlier lines recede (~34%).
2. One unit = ONE speech. Prefix in small caps. Watson's lines carry **no
   prefix** (the reader IS Watson). A hairline leader connects the active speech
   to the speaker's head while he is on stage.
3. **Never show text the scene performs.** The cut list for these beats is in
   §2.4 — six more sentences die here, and each one is named.
4. Click-paced: each unit holds its freeze frame until the reader clicks
   (breathing teal dot = the affordance). Gate units instead demand their verb.
5. Plates (insets) are earned: camera pushes first, world dims but stays.
6. Cameo card, lower-left, first appearance only; captions carry identity — and
   they FLIP when identity changes (the King at I.6; **Irene at M.4**).
7. The completing action turns the page.
8. Audio is diegetic only — beds + moment cues, no music.
9. **Style law:** the locked plate template (PIPELINE stage 1 /
   `tools/nbpro_prompts.json`) — *stylized low poly 3d game diorama, isometric
   view, floating on a faceted dark rock base, clean dark navy gradient backdrop,
   Prussian-blue night, amber window glow, gas-lamp halos, faceted Victorian
   figures with single accent colours, flat-shaded chunky low poly style, no
   text, no letters, blank weathered sign boards* + the subject clause. Every
   new SET plate in §7 is generated on that template, no exceptions.
10. Raw-first: every generation lands an immutable raw + full manifest under
    `assets/raw/**` before any curated copy exists.

## 2. New law these beats add

### 2.1 The told story, and who is speaking inside it (the narrator ruling)

Canon narrates Beats III and IV in Holmes' first person, and Watson is not
there. The standing ruling (orchestrator default 2026-08-06, the owner's to
overrule) is: **the reader stays Watson, and the dioramas perform Holmes'
account.** Consequences, all binding:

* Holmes' narration is set as `HOLMES`-prefixed units.
* Watson's own two lines still carry **no prefix** — `following` (l.610) opens
  the told story and `unexpected` (l.678) closes it. They are the hinge; without
  them the chase page arrives as a flashback bolted on.
* Speech Doyle quotes **inside** the account keeps Doyle's own nested
  attributions, as three new prefixes:
  * `THE GENTLEMAN` — Norton before he is named (l.624)
  * `IRENE ADLER` — l.636, l.683
  * `GODFREY NORTON` — l.657, l.661
* **House quote rule.** Doyle sets nested speech in single quotes (`‘The Church
  of St. Monica,’ said I`). The book sets every unit in its own double quotes
  and drops the attribution into the prefix. This is presentation, not text: the
  words between the quotes are byte-exact (§3).

### 2.2 The two new speaker registers

`LETTER` renders like `NOTE` — a document, ruled off at its edge, italic. Beat
VII's first four units are a letter, not a conversation.

### 2.3 A leaf may WAIT on a fact performing

Three units in these beats may not be paged past until the thing they name has
happened on stage, however fast the reader clicks. A click inside that window is
**latched, not lost**, and spends the moment the unit may turn:

| unit | waits on | why |
|---|---|---|
| `twentyfive` (III.11) | `roll` — the cab has run the strip | the arrival is what turns the page |
| `tyingup` (IV.9) | `ring` — the ring is on her hand | fact M.4 is the ring, not the sentence |
| `sovereigngift` (IV.12) | `sovereign` — the coin has reached the watch chain | fact M.6 is the coin's journey |

### 2.4 The cut list (sentences the diorama performs, so they are not text)

| canon | what performs it | where |
|---|---|---|
| l.565-567 the villa's front elevation | the street SET itself | Beat II |
| l.631-632 *"It hadn't pulled up before she shot out of the hall door and into it."* | the 6 s chase-intro vignette | Beat III unit 5 |
| l.663 the drag itself (partly) | the `drag` sub-beat | Beat IV unit 8 |
| l.880-883 *"A maid rushed across and threw open the window… I tossed my rocket into the room with a cry of 'Fire!'"* | **the reader's own throw** | Beat VI — **no text at all** |
| l.842-843 the crowd losing interest | the `disperse` staging | Beat VI |
| l.1048-1049 the photograph being handed over | the `plate-irene` inset rising | Beat VII unit 6 |

### 2.5 One gate, one goal line

No gate arms on a unit that does not explain it. Four gates across these beats
(§6.4), each on Doyle's own goal line where Doyle wrote one.

### 2.6 Soft-fail only

Every gate self-satisfies after 30 s of sim time; every click-paced unit
advances itself after 30 s. No gate is a wall.

---

## 3. Verbatim audit — method and result

**Method.** The `LINES` table was extracted from `main.js` by evaluating the
object literal (88 keys), and each unit's text was matched against
`sources/pg1661_2026-08-04.txt` **inside a ±16-line window around its own cited
line range** — so the audit proves both *"these words are Doyle's"* and *"the
citation is honest"*. Multi-fragment units (ellipsis-trimmed) are matched in
order with a monotonic cursor, which proves the fragments are **contiguous in
Doyle in the order the unit sets them**. Scripts: `/tmp/gl/extract.mjs`,
`/tmp/gl/verify2.py`, `/tmp/gl/verify3.py`.

**Result: 87 of 88 units are curly-quote-exact and contiguous inside their cited
window.** Every unit in Beats II–VII passes. The one exception is a **Beat I**
unit and is recorded here so no lane "fixes" it:

> `gaz1` (CONTENT.md #7). The book sets `…which is the German for ‘Company’…`
> where Doyle has `…which is the German for ‘Company.’ It is a customary
> contraction like our ‘Co.’ ‘P,’ of course…` (l.222-225). The ellipsis elides
> the full stop with the elided sentence. This is a legitimate ellipsis trim,
> not an error, and it is the **only** non-byte-exact string in the chapter.

**Two units to leave alone even though they look wrong:**

* `halfsov` (III.10) repeats `stmonica` (III.7) almost word for word. That is
  Doyle: Holmes echoes her bargain back to his own driver (l.642-644). The
  repetition IS the joke and the deadline is a contract fact. Keep both.
* `whatthen` (IV.6) is `“What then?”` — Holmes quoting **himself** inside his own
  account (l.659). Prefixed `HOLMES`, not un-prefixed: the reader is watching,
  not answering.

Where a unit carries `<em>…</em>` (`lodge`'s *bijou*, `thewoman`'s *the*), that
is Gutenberg's own italic (`_bijou_`) and must ship as italic, not as literal
underscores.

---

## 4. The comprehension contract, beats II–VII

A beat is not done when it looks good. A beat is done when a first-time reader
who knows nothing about the story can state these after playing it. **Every fact
names its carrier; a fact with no carrier means the beat is not done.**

### Beat II — facts II.1, II.5
| # | Fact | Carrier |
|---|---|---|
| II.1 | This street and this house are **hers** | `lodge` — the NAME and the window the plan needs; the elevation is deleted because the SET is it |
| II.5 | **The reader is being TOLD what follows** | `following` — Watson's own voice, no prefix. Its click is what turns the page into Holmes' account |

### Beat III — facts P.1 … P.5
| # | Fact | Carrier |
|---|---|---|
| P.1 | **A man came to her house** in a hurry, and he is the man Holmes had heard of | `hansom` over the composed DOOR shot; the beat PLACES the rigs (his cab at the door, her landau not yet in the street) |
| P.2 | He was **frantic**, and he left for **Gross & Hankey's then St Monica's, inside twenty minutes** | `halfhour` → `watch` → `devil` (prefix THE GENTLEMAN) |
| P.3 | **She followed him**, to the same church, on the same clock | the 6 s intro vignette under `landau` → `shotout` → `stmonica` (prefix IRENE ADLER) |
| P.4 | **Holmes went after her**, and going is the reader's own click | `toogood` is the goal line; the gate arms on it; the click on the following cab starts the pursuit rolling |
| P.5 | **The clock is running and he knows what it means** | `twentyfive` — and it declares `wait: roll`, so the arrival is what turns the page |

### Beat IV — facts M.1 … M.8
| # | Fact | Carrier |
|---|---|---|
| M.1 | He got there after them; the two he followed were already inside with a clergyman | `drovefast` → `notasoul` |
| M.2 | He went in **as a bystander** — which is why what follows is absurd | `lounged` over the `lounge` sub-beat |
| M.3 | **Norton ran at him and needed him** | `facedround` (where Doyle names him) over `run` → `thankgod` → `whatthen` → `comeman` = goal line + gate |
| M.4 | **THEY MARRIED**, and **the ring** | `halfdragged` → `tyingup` over the push to the ring, **cameo caption FLIPS to IRENE NORTON, NÉE ADLER**, ring scrubbed 0→1, `wait: ring` |
| M.5 | **Why a stranger was needed at all** | `preposterous` → `license` |
| M.6 | **The sovereign, and where he means to keep it** | `sovereigngift` over the push to the coin; bride → witness → watch chain; `wait: sovereign` |
| M.7 | The told story is over and the reader is Watson again | `unexpected` (his own voice, no prefix) over the pull back → `menaced` |
| M.8 | They separated, and **she will be OUT OF THE HOUSE AT FIVE** | `separated` → `parkatfive` (prefix IRENE ADLER). The plan depends on this |

### Beat V — facts II.2 … II.4
| # | Fact | Carrier |
|---|---|---|
| II.2 | Holmes has a **plan** and the reader has a **post in it** | `plan1` / `plan2` / `watchme` |
| II.3 | The reader knows **what he will be asked to do** and **with what** | `signal` + **INSET `plate-rocket`** → `rocket` |
| II.4 | **Taking the post is the reader's own act** | `neutral` — his own voice, no prefix — carrying the station cue; the chalk ring by the gas lamp is the station |

### Beat VI — facts III.1 … III.4
| # | Fact | Carrier |
|---|---|---|
| III.1 | **WHY the fire works** — stated BEFORE the throw is armed | `instinct1` and `instinct2`; the gate arms on the SECOND and on no earlier unit, so the whole reason is on the page before the match is in his hand |
| III.2 | What the reader is watching **for** | `instinct2`'s cue: *throw it, and raise the cry of fire — **then watch the window*** |
| III.3 | The throw happened, and it was the plan working | **the ruse itself** — the reader's own click, the rocket, the smoke, the cry, the crowd — then `knowwhere`. **The throw is the one moment in the book with no text at all** |
| III.4 | **She showed him the hiding place** | `panel` → `glimpse` → `knowwhere` / `howfind` / `showed` |

### Beat VII — facts IV.1 … IV.5
| # | Fact | Carrier |
|---|---|---|
| IV.1 | **She outplayed him** — in her own voice | `letter1` + cameo `irene` captioned IRENE NORTON, NÉE ADLER → `letter2`, both in the **document register** |
| IV.2 | She is **gone**, she **keeps** the photograph, and the King is safe anyway | `flight1` → `flight2` |
| IV.3 | The photograph Holmes keeps is **of HER**, asked for as his fee | `indebted` / `valuemore` + **INSET `plate-irene`** / `nameit` / `thisphoto` |
| IV.4 | **The inversion**, stated | `beaten`, narration with the drop cap, inset still up |
| IV.5 | Why the chapter is called what it is | `thewoman`, end card, inset still up |

**Plate law.** An inset is granted only to an object that carries a contract
fact. Beats II–VII add exactly two: `plate-rocket` (II.3) and `plate-irene`
(IV.3). `plate-irene` is **a different object** from Beat I's `both-photo`: the
compromising photograph is of the King AND Irene; the fee Holmes asks for is the
portrait of her alone. Do not reuse one for the other.

---

## 5. Unit lists

Verb column: `click` (advances on the reader's click) · `auto` (advances on
`dwell`) · `hold` · `target:<thing>` (a named thing in the diorama; a wrong-place
click nudges the cue and does **not** advance) · `clock` (Beat VI only — arrives
on the beat's own timeline, §6.6). `endsBeat` marks the unit whose completion
turns the page out of the beat.

### BEAT II — "SERPENTINE AVENUE" · SET `street` · leaf 2 · 3 units

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `ii-00-head` | — | auto (dwell 3.4) | chapter heading **II · SERPENTINE AVENUE** | arrival on the street SET, wide establishing; bed → `street`; heading leaves the page the moment unit 1 arrives |
| 1 | `ii-01-lodge` | HOLMES | click | “I soon found Briony Lodge. It is a *bijou* villa… with long windows almost to the floor…” | `clear`; focus `villa` (wide, the whole front: ref pose azim .92 elev .40 r 30 fov 26 → the establishing lens), 3.6 s push. **The house is NOT on fire** — smoke gate CLOSED. **fact II.1** |
| 2 | `ii-02-following` | — *(Watson — no prefix)* | click · **endsBeat** | “I am following you closely…” | focus `holmes-street` (ref azim 1.02 elev .30 r 23 fov 24), 3.0 s. **fact II.5.** Its click turns the page INTO the told story (→ chase SET) |

*Note the shape: three units and out. Beat II is a hinge, not a scene — the
street's own scene is Beat V. Do not pad it.*

### BEAT III — "THE PURSUIT" · SET `chase` · leaf 3 · 12 units

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `iii-00-head` | — | auto (dwell 3.4) | chapter heading **III · THE PURSUIT** | arrival on the chase SET; bed → `chase` |
| 1 | `iii-01-hansom` | HOLMES | click | “I was still balancing the matter in my mind when a hansom cab drove up to Briony Lodge, and a gentleman sprang out… evidently the man of whom I had heard.” | `clear`; act `placeCanonOrder` — **his hansom at the lit door, her landau not yet in the street** (ref: `norton(true)`, `pursuit({lead:-4.5, norton:19.0})`); focus `door` (ref azim 2.30 elev .24 r 18 fov 24 target x 17.5), 3.0 s. **fact P.1** |
| 2 | `iii-02-halfhour` | HOLMES | click | “He was in the house about half an hour… Presently he emerged, looking even more flurried than before.” | holds the door frame |
| 3 | `iii-03-watch` | HOLMES | click | “As he stepped up to the cab, he pulled a gold watch from his pocket and looked at it earnestly…” | the gold watch is the prop that reads; sfx `watch` (soft chain/click) |
| 4 | `iii-04-devil` | **THE GENTLEMAN** | click | “Drive like the devil… first to Gross & Hankey’s in Regent Street, and then to the Church of St. Monica in the Edgeware Road. Half a guinea if you do it in twenty minutes!” | Doyle's nested attribution becomes the prefix. **fact P.2** |
| 5 | `iii-05-landau` | HOLMES | click *(segment-paced)* | “Away they went… up the lane came a neat little landau, the coachman with his coat only half-buttoned, and his tie under his ear…” | `clear`; **seg `chase-intro`** (6.0 s): Norton away first; the landau up the lane; **she shoots out of the hall door and boards**; a cab comes through the street. Focus `lane` (ref azim 2.34 elev .40 r 46 fov 22). Canon l.631-632 is CUT — the segment performs it |
| 6 | `iii-06-shotout` | HOLMES | click | “I only caught a glimpse of her at the moment, but she was a lovely woman, with a face that a man might die for.” | act `nortonAway` — the strip stops dressing him (`norton(false)`); focus `her` (ref azim 2.28 elev .26 r 20 fov 24 target x 23), 2.6 s |
| 7 | `iii-07-stmonica` | **IRENE ADLER** | click | “The Church of St. Monica, John… and half a sovereign if you reach it in twenty minutes.” | **fact P.3** |
| 8 | `iii-08-toogood` | HOLMES | **target:`cab`** | “This was quite too good to lose, Watson. I was just balancing whether I should run for it, or whether I should perch behind her landau when a cab came through the street.” | `clear`; cue **“click the cab · follow her”**; focus `cab` (ref azim 2.26 elev .26 r 19 fov 22 target x 5.6), **push 1.6 s — deliberately short: a gate's target must be reachable the moment its cue asks for it** (measured: at 2.8 s the cab was off-frame for 16 of the first 20 samples). gateAct `startPursuit` (speed 9.0 m/s, roll 8.0 s); gateSfx `cab` — hooves and wheels, **pitched/panned at the gap the cab is drawn at**. **fact P.4** |
| 9 | `iii-09-shabby` | HOLMES | click | “The driver looked twice at such a shabby fare, but I jumped in before he could object.” | the pursuit is rolling under this unit; driver pose `look-twice` |
| 10 | `iii-10-halfsov` | HOLMES | click | “The Church of St. Monica… and half a sovereign if you reach it in twenty minutes.” | Doyle's own echo of unit 7 — **keep both** (§3) |
| 11 | `iii-11-twentyfive` | HOLMES | click · **wait:`roll`** · **endsBeat** | “It was twenty-five minutes to twelve, and of course it was clear enough what was in the wind.” | focus `away` (ref azim 2.34 elev .46 r 72 fov 22), 3.4 s. **Cannot turn before the cab has run the strip — the arrival is what turns the page.** **fact P.5** |

### BEAT IV — "ST. MONICA'S" · SET `church` · leaf 4 · 17 units

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `iv-00-head` | — | auto (dwell 3.4) | chapter heading **IV · ST. MONICA’S** | **the heading rides the arrival in** — it carries its own move to focus `nave` (ref azim .707 elev .34 r 21 fov 20), 2.6 s, or the page's first frame is a church still coming out of its own fold. sfx `bell`; bed → `church` |
| 1 | `iv-01-drovefast` | HOLMES | click | “My cabby drove fast. I don’t think I ever drove faster, but the others were there before us… I paid the man and hurried into the church.” | `clear` |
| 2 | `iv-02-notasoul` | HOLMES | click | “There was not a soul there save the two whom I had followed and a surpliced clergyman, who seemed to be expostulating with them. They were all three standing in a knot in front of the altar.” | **fact M.1** — the three-in-a-knot tableau is the SET's rest state |
| 3 | `iv-03-lounged` | HOLMES | click *(segment-paced)* | “I lounged up the side aisle like any other idler who has dropped into a church.” | `clear`; **seg `lounge`** (6.0 s) — the witness up the side aisle; focus `aisle` (ref azim .78 elev .28 r 12.6 fov 24). **fact M.2** |
| 4 | `iv-04-facedround` | HOLMES | click *(segment-paced)* | “Suddenly, to my surprise, the three at the altar faced round to me, and Godfrey Norton came running as hard as he could towards me.” | **seg `run`** (6.0 s) — Norton runs, then beckons with both arms; the witness's astonishment is the face beat. Doyle NAMES him here |
| 5 | `iv-05-thankgod` | **GODFREY NORTON** | click | “Thank God… You’ll do. Come! Come!” | `clear`; cameo `norton` cap **GODFREY NORTON** *(first appearance)* |
| 6 | `iv-06-whatthen` | HOLMES | click | “What then?” | Holmes quoting himself inside his own account — prefixed, not bare (§3) |
| 7 | `iv-07-comeman` | **GODFREY NORTON** | **target:`norton`** | “Come, man, come, only three minutes, or it won’t be legal.” | cue **“click Norton · answer him”**. The click ANSWERS him, and being answered is what drags Holmes to the altar. **fact M.3** |
| 8 | `iv-08-halfdragged` | HOLMES | click *(segment-paced)* | “I was half-dragged up to the altar, and before I knew where I was I found myself mumbling responses which were whispered in my ear…” | `clear`; **seg `drag`** (6.0 s); act `glassStart` — the three minutes run out on the altar's own hourglass, scrubbed 0→1 over 11.0 s |
| 9 | `iv-09-tyingup` | HOLMES | click · **wait:`ring`** | “…generally assisting in the secure tying up of Irene Adler, spinster, to Godfrey Norton, bachelor. It was all done in an instant…” | focus `ring` (ref azim .62 elev .24 **r 6.6** fov 24 — measured, not chosen: the three figures read 27.2 / 20.5 / 16.7 % of frame height, all clear of the type column), 2.8 s; act `ringScrub` 0→1 over 4.5 s; **cameo `irene` caption FLIPS to IRENE NORTON, NÉE ADLER** — the King's own reveal device, used for the chapter's one other change of identity. **fact M.4** |
| 10 | `iv-10-preposterous` | HOLMES | click | “It was the most preposterous position in which I ever found myself in my life…” | holds the ring frame |
| 11 | `iv-11-license` | HOLMES | click | “It seems that there had been some informality about their license, that the clergyman absolutely refused to marry them without a witness of some sort…” | `clear`. **fact M.5** |
| 12 | `iv-12-sovereigngift` | HOLMES | click · **wait:`sovereign`** | “The bride gave me a sovereign, and I mean to wear it on my watch chain in memory of the occasion.” | focus `coin` (ref azim .88 elev .24 r 7.0 fov 24), 2.6 s; act `sovereignScrub` 0→1 over 4.5 s — **bride → witness → watch chain**, three holders. **fact M.6** |
| 13 | `iv-13-unexpected` | — *(Watson — no prefix)* | click | “This is a very unexpected turn of affairs… and what then?” | `clear`; `cameo: off`; pull back to focus `nave`, 3.0 s. **The told story ends; the reader has his own voice back.** **fact M.7** |
| 14 | `iv-14-menaced` | HOLMES | click | “Well, I found my plans very seriously menaced. It looked as if the pair might take an immediate departure, and so necessitate very prompt and energetic measures on my part.” | |
| 15 | `iv-15-separated` | HOLMES | click | “At the church door, however, they separated, he driving back to the Temple, and she to her own house.” | `clear` |
| 16 | `iv-16-parkatfive` | **IRENE ADLER** | click · **endsBeat** | “I shall drive out in the park at five as usual…” | **fact M.8.** Its click turns the page BACK to Serpentine Avenue and Beat II resumes |

### BEAT V — *(no heading — Beat II resumes)* · SET `street` · leaf 5 · 6 units

**No chapter heading and no establishing beat.** The told story was an INSET; the
reader is standing in Serpentine Avenue exactly where he left off. A heading here
would read as a new scene and undo the whole split.

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `v-00-plan1` | HOLMES | click | “There will probably be some small unpleasantness. Do not join in it. It will end in my being conveyed into the house.” | `clear`; bed → `street`; focus `plan` (ref azim 1.00 elev .28 r 21 fov 24), 3.2 s. Smoke gate still CLOSED |
| 1 | `v-01-plan2` | HOLMES | click | “Four or five minutes afterwards the sitting-room window will open. You are to station yourself close to that open window.” | names the window the reader will be posted at — the SET must make that window findable |
| 2 | `v-02-watchme` | HOLMES | click | “You are to watch me, for I will be visible to you.” | **fact II.2** completes here |
| 3 | `v-03-signal` | HOLMES | click | “And when I raise my hand—so—you will throw into the room what I give you to throw, and will, at the same time, raise the cry of fire.” | `clear`; **INSET `plate-rocket` rises** (push, then plate; world dims to the painted relight) |
| 4 | `v-04-rocket` | HOLMES | click | “It is an ordinary plumber’s smoke-rocket, fitted with a cap at either end to make it self-lighting.” | inset holds. **fact II.3** |
| 5 | `v-05-neutral` | — *(Watson — no prefix)* | **target:`station`** | “I am to remain neutral, to get near the window, to watch you, and at the signal to throw in this object, then to raise the cry of fire…” | `clear`; **inset OFF** (the verb happens in the WORLD — Beat I's `noteLift` law); act `descendToStreet` — the frame comes down to street level and the **chalk ring by the gas lamp** lights (`mark: armed`); cue **“click the chalk ring · take your station at the open window”**; gateAct `takeStation` (frame settles at the window lens, `mark: locked`); gateSfx `step`. **fact II.4.** **NO page turn on this gate — Beat VI is the same leaf** |

> **RULING NEEDED (§8.1).** The reference gate here is a free WASD/tap walk in a
> 3D street. The Living Book is a painted plate with sprite actors and no free
> movement, so the walk is specified above as a **single target click on the
> chalk ring**, with the camera descent doing what the walk did. The cue wording
> is adapted from the reference's own touch line (*“TAP the street · take your
> station at the open window”*). If the owner wants the walk back it is a
> two-mark sprite traverse of Watson-POV, not a free walk.

### BEAT VI — "THE ALARM OF FIRE" · SET `street` · leaf 5 *(same leaf as V)* · 3 scripted + 5 clock units

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `vi-00-head` | — | auto (dwell 3.6) | chapter heading **V · THE ALARM OF FIRE** | **numeral V, beat 6.** Arrives with NO page turn — the heading lands on the leaf already mounted |
| 1 | `vi-01-instinct1` | HOLMES | click (dwell 8.0) | “When a woman thinks that her house is on fire, her instinct is at once to rush to the thing which she values most. It is a perfectly overpowering impulse…” | `clear`. **The gate does NOT arm here** — the whole reason must be on the page first. **fact III.1a** |
| 2 | `vi-02-instinct2` | HOLMES | **target:`window`** | “…our lady of to-day had nothing in the house more precious to her than what we are in quest of. She would rush to secure it.” | cue **“click the lit window · throw it, and raise the cry of fire — then watch the window”**; gateAct `fireRuse`. **facts III.1b, III.2** |
| — | **(the throw)** | — | — | **NO TEXT.** The margin is cleared and stays empty. | **fact III.3a.** Doyle's l.880-883 narrates what the reader has this instant done with his own hand. This is the rule at its most literal |
| 3 | `vi-03-panel` | HOLMES | clock ≈ t+3.2 | “The photograph is in a recess behind a sliding panel just above the right bell-pull.” | `clear`; arrives as the camera settles on the REVEAL lens |
| 4 | `vi-04-glimpse` | HOLMES | clock t+5.6 | “She was there in an instant, and I caught a glimpse of it as she half drew it out.” | lands **on the pause** — she is stopped at the panel with her hand up (§6.6) |
| 5 | `vi-05-knowwhere` | HOLMES | clock t+8.6 | “I know where it is.” | `clear`; act `disperse` — the crowd loses interest and scatters; sfx `disperse`; camera eases back 2.4 s |
| 6 | `vi-06-howfind` | — *(Watson — no prefix)* | clock t+11.0 | “And how did you find out?” | |
| 7 | `vi-07-showed` | HOLMES | clock t+13.2 | “She showed me, as I told you she would.” | **facts III.3b, III.4.** At t+16.6 the camera returns to the street's composed pose (2.8 s); at **t+19.8 the page turns** to the room |

### BEAT VII — "THE WOMAN" · SET `room` (221B) · leaf 6 · 11 units

| # | id | prefix | verb | text (verbatim) | staging / assets |
|---|----|--------|------|-----------------|------------------|
| 0 | `vii-00-head` | — | auto (dwell 3.4) | chapter heading **VI · THE WOMAN** | **numeral VI, beat 7.** Back on the 221B SET — the same plate Beat I used, re-dressed (§6.2) |
| 1 | `vii-01-letter1` | LETTER | click | “MY DEAR MR. SHERLOCK HOLMES,—You really did it very well. You took me in completely.” | `clear`; **document register** (ruled off at the edge — a thing READ, not a thing said); cameo `irene` cap **IRENE NORTON, NÉE ADLER**; sfx `letter`; seg `woman` (the establishing move belongs to the segment — do not also start a camera track, or the same move fires twice on one frame). bed → `hearth` |
| 2 | `vii-02-letter2` | LETTER | click | “Until after the alarm of fire, I had not a suspicion… Yet, with all this, you made me reveal what you wanted to know.” | **fact IV.1** |
| 3 | `vii-03-flight1` | LETTER | click | “We both thought the best resource was flight, when pursued by so formidable an antagonist; so you will find the nest empty when you call to-morrow.” | `clear` |
| 4 | `vii-04-flight2` | LETTER | click | “As to the photograph, your client may rest in peace… I keep it only to safeguard myself…” | **fact IV.2** |
| 5 | `vii-05-indebted` | KING | click | “I am immensely indebted to you. Pray tell me in what way I can reward you.” | `clear`; `cameo: off`. **The King is ON STAGE in this beat** — reuse the unmasked actor |
| 6 | `vii-06-valuemore` | HOLMES | click (dwell 7.0) | “Your Majesty has something which I should value even more highly…” | **INSET `plate-irene` rises** (plateAt 1.4 s, after the push); focus `photo-room` (ref azim .34 elev .28 r 10.2 fov 20), 2.6 s. **The only time in the book the reader SEES her** |
| 7 | `vii-07-nameit` | KING | click | “You have but to name it.” | inset holds |
| 8 | `vii-08-thisphoto` | HOLMES | click (dwell 5.0) | “This photograph!” | inset holds. **fact IV.3** |
| 9 | `vii-09-beaten` | — *(narration)* | click | And that was how a great scandal threatened to affect the kingdom of Bohemia, and how the best plans of Mr. Sherlock Holmes were beaten by a woman’s wit. | `clear`; **drop cap**; inset still up. **fact IV.4** |
| 10 | `vii-10-thewoman` | — *(narration)* | click (dwell 9.5) · **endsBeat** | He used to make merry over the cleverness of women, but I have not heard him do it of late. And when he speaks of Irene Adler, or when he refers to her photograph, it is always under the honourable title of *the* woman. | end card; inset still up. **fact IV.5.** Turns to leaf 7 (the closing card) |

**Unit totals.** II 3 · III 12 · IV 17 · V 6 · VI 8 (3 + 5) · VII 11 = **57**.
With Beat I's 38 the book is **95 units on 7 leaves**. (The reference's own
count of "90 leaves" excludes Beat VI's five clock-driven lines, which are
`voice()` calls rather than script leaves there; in this stack they are units.)

---

## 6. THE SCENE LEDGER

### 6.1 Beat → heading → SET → leaf → what turns the page

| beat | heading the reader sees | SET | leaf | units | facts | what turns the page out |
|---|---|---|---|---|---|---|
| I | **I** THE MASKED CLIENT | `room` | 1 | 38 | I.1–I.11 | **gate** `door` (target click) |
| II | **II** SERPENTINE AVENUE | `street` | 2 | 3 | II.1, II.5 | click on `following` |
| III | **III** THE PURSUIT | `chase` | 3 | 12 | P.1–P.5 | click on `twentyfive`, **held until `roll` completes** |
| IV | **IV** ST. MONICA’S | `church` | 4 | 17 | M.1–M.8 | click on `parkatfive` |
| V | *(none — Beat II resumes)* | `street` | 5 | 6 | II.2–II.4 | **nothing — chains straight into Beat VI on the same leaf** |
| VI | **V** THE ALARM OF FIRE | `street` | 5 | 3 + 5 | III.1–III.4 | **the beat's own clock**, t+19.8 s after the throw |
| VII | **VI** THE WOMAN | `room` | 6 | 11 | IV.1–IV.5 | click on `thewoman` → leaf 7, the closing card |

**Six page turns in the book** (1→2, 2→3, 3→4, 4→5, 5→6, 6→7). **Five beat
boundaries are page turns; V→VI is not.**

**SET reuse is the whole budget.** Seven leaves, **four SETS**: `room` is
mounted twice (leaves 1 and 6), `street` twice (leaves 2 and 5). Only three
SETS are new work.

### 6.2 The SETS and the STATE VARIANTS the staging demands

The Living Book's set model (proven on Beat I): one painted base plate at
1408×768 + a small number of **painted variants** of that same plate + free
layers cut out of it + isolated actor sprites. A variant is a repaint, not a
filter — Beat I's `room-dim.jpg` is the painted relight the insets dim to, and
the actors standing in it are put through the same relight as a measured colour
matrix (`0.448 / 0.588 / 0.754`). **Every SET below needs its own `-dim`
variant**, measured the same way, or a raised inset reads as a collage.

#### SET `room` — 221B Baker Street *(EXISTS)*
| variant | state | needed by |
|---|---|---|
| `room.jpg` | base, entrance door closed | I, VII |
| `room-open.jpg` | the door standing open | I.11, I.37 |
| `room-dim.jpg` | painted relight under a raised inset | I.2-4, I.6, I.24-26, **VII.6-10** |
| free layers | `chair.png` / `chair-dim.png` (Watson's armchair as a true foreground cut), `holmes-patch.png` / `-dim` (the inpainted hole Holmes was painted into) | all |
| emissives | hearth, candle, window, street lamp — breathe only | all |

**Beat VII needs no new room variant.** It is the same room, later the same
night, with the King present and Holmes at the mantel. If a lane proposes a
`room-night`/`room-late` repaint, that is scope, not need — reject unless the
owner asks.

#### SET `street` — Serpentine Avenue / Briony Lodge *(NEW — the biggest single asset)*
The one SET whose state machine actually matters. Read the reference street
module before generating: the villa's **ruse plume stands UP in its authored
rest state**, and the book explicitly closes that gate on arrival. *(Owner: "the
house on fire right after you enter the scene is not the right way.")*

| variant | state | needed by |
|---|---|---|
| `street.jpg` | **base: quiet night, NO smoke.** Bijou villa, long windows almost to the floor, the bay/sitting-room window, front door, area railings, gas lamp with the chalk ring at its foot, cobbles, damp | II.0-2, V.0-5 |
| `street-dim.jpg` | painted relight under the `plate-rocket` inset | V.3-4 |
| `street-window.jpg` | **the sitting-room window OPEN and lit** (canon: it opens four or five minutes after the unpleasantness) | V.5 → VI |
| `street-smoke.jpg` | **the ruse burning**: plume out of the first-floor window, the pane lit hot, crowd turned to it | VI, from t+1.35 |
| `street-empty.jpg` | **dispersed**: the crowd gone, the plume dying | VI, from t+8.6 |
| free layers | the crowd (so it can turn and then scatter), the gas lamp halo, the **chalk ring** (three states: off / armed / locked), the villa's bay glass (transparent, drawn last) | V, VI |
| actor layers | Holmes (street coat), **Irene behind the glass** (the reveal silhouette — crimson-edged, backlit, OPAQUE and drawn before the glass), the maid, the rocket + its trail + the flash | V, VI |

**The reveal is the single most important image in the chapter** and it is a
*silhouette behind glass*, not a figure on the pavement. Reference timings, to
be reproduced exactly (§6.6).

#### SET `chase` — the strip *(NEW)*
| variant | state | needed by |
|---|---|---|
| `chase.jpg` | base: a long street canyon on a faceted rock hull, Georgian terrace down one side with amber windows, cobbles running away to a fogged vanishing point, black gas lamps with amber halos | III |
| `chase-dim.jpg` | relight (no inset in Beat III today — generate anyway; the variant is the SET's contract) | — |
| free layers | fog bank at the far end (must sit INSIDE the diorama envelope from every angle), lamp halos, **Briony Lodge's lit door at the far end of the strip** | III |
| vehicle layers | **three** rigs: Norton's hansom, Irene's landau, the following four-wheeler — each with driver, horse, wheels, lamp halo. Each must translate along the strip independently | III |

**Frame convention (from the reference, keep it):** the road runs away from the
near end; the terrace stands on the far side; the lit door is UP the road. The
three rigs' story positions:
* unit 1 (`hansom`): **Norton's cab at the door, her landau not yet in the
  street** — canon has only his cab at l.612. The reference measures this: his
  hansom reads 48.1 % of frame height, the landau and the following cab are
  off-frame. This is a **placement**, not a shot dodge.
* unit 5 (`landau`): the intro vignette — Norton away first, the landau up the
  lane with its half-dressed coachman, **she shoots out of the hall door and
  boards**, a cab comes through the street.
* unit 6: Norton is gone (`norton(false)`) — the strip stops dressing him.
* units 8-11: the pursuit **rolls**: route 0→1 and the gap **19.5 → 14.0 m over
  8.0 s** at **9.0 m/s**, both ends inside the "shadow" band (canon bands: <12
  too-close, 12-25 shadow, 25-40 slack, >40 lost). The hooves are *heard* at the
  gap they are drawn at. `twentyfive` cannot turn until this roll completes.

#### SET `church` — St Monica's, Edgware Road *(NEW)*
| variant | state | needed by |
|---|---|---|
| `church.jpg` | base: the nave as a one-wall cutaway; the altar and its three-light gothic window at the far end; two lancet windows in the standing wall; the side aisle the witness walks up | IV |
| `church-dim.jpg` | relight | — |
| free layers | the altar rail, the altar itself (the ring and the sovereign are performed on it), the hourglass on the altar (its glass runs out under the drag) | IV |
| actor layers | **clergyman** (surpliced), **bride** (Irene), **groom** (Norton), **witness** (Holmes) — four figures that must move: the lounge up the aisle, Norton's run and beckon, the drag to the altar, the ring exchange, the sovereign | IV |

**Two close lenses on this SET are contract facts and must be composed for, not
cropped to:** the ring push and the coin push. The reference measured the ring
lens (r 6.6) as the tightest frame at which the three figures who perform the
marriage all read ≥16.7 % of frame height and all sit clear of the type column.
Compose the plate so those two close reads exist.

### 6.3 The cast — who appears where

| actor | I | II | III | IV | V | VI | VII | status |
|---|---|---|---|---|---|---|---|---|
| Holmes | ● | ● | *(narrator)* | ● *(as the witness)* | ● | ● | ● | **EXISTS** as a plate-cut sprite (room only) — needs a **street coat** cut and a **church/witness** cut |
| Watson (the reader) | POV | POV | POV | POV | POV | POV | POV | never drawn; the leader line points at whoever is speaking |
| The King | ● | | | | | | ● | **EXISTS** — `king-unmasked.png` reused in Beat VII |
| Godfrey Norton | | | ● *(in his cab, then away)* | ● *(runs, beckons, marries)* | | | | **GAP** — actor + cameo |
| Irene Adler | | | ● *(boarding the landau, in it)* | ● *(the bride)* | | ● *(the silhouette behind the glass)* | *(letter + inset only)* | **GAP** as an actor; cameo EXISTS |
| the clergyman | | | | ● | | | | **GAP** |
| the coachman (John) | | | ● | | | | | **GAP** — part of the landau rig |
| the cab drivers ×2 | | | ● | | | | | **GAP** — part of the rigs |
| the crowd | | | | | | ● | | **GAP** — must turn, then scatter |
| the maid | | | | | | ● *(throws the window open)* | | **GAP** — or fold into the window-open variant |

### 6.4 Gates and their targets

Four gates across beats II–VII (Beat I has four of its own: hold, mask, index,
door). Each is preceded by its own goal line; each soft-fails at 30 s.

| beat | unit | verb | target | cue | gateAct | gateSfx | turns the page? |
|---|---|---|---|---|---|---|---|
| III | `iii-08-toogood` | target | **`cab`** — the following four-wheeler | “click the cab · follow her” | `startPursuit` | `cab` | no (unit 11 does) |
| IV | `iv-07-comeman` | target | **`norton`** — the man himself | “click Norton · answer him” | `dragToAltar` | — | no (unit 16 does) |
| V | `v-05-neutral` | target | **`station`** — the chalk ring by the gas lamp | “click the chalk ring · take your station at the open window” | `takeStation` | `step` | **no — Beat VI is the same leaf** |
| VI | `vi-02-instinct2` | target | **`window`** — the lit sitting-room window | “click the lit window · throw it, and raise the cry of fire — then watch the window” | `fireRuse` | `rocket` | **yes, on the clock** (t+19.8) |

**Cue wording law** (kept from Beat I): the cue names the THING and then the ACT,
and the act is Doyle's own where Doyle gave one. Every cue must ship a keyboard
form and a touch form.

### 6.5 Insets, cameos, sfx, beds

**Insets (earned close-ups).** Two new, both fact-carriers:

| inset | raised on | held through | taken down on | fact |
|---|---|---|---|---|
| `plate-rocket` | `v-03-signal` | `v-04-rocket` | `v-05-neutral` (the verb is in the WORLD) | II.3 |
| `plate-irene` | `vii-06-valuemore` (plateAt 1.4 s, after the push) | 7, 8, 9, 10 — **to the end card** | never | IV.3 |

**Cameos.**

| cameo | first raised | caption | notes |
|---|---|---|---|
| `irene` | Beat I `letmesee` | IRENE ADLER | **EXISTS** |
| `irene` | `iv-09-tyingup` | **IRENE NORTON, NÉE ADLER** | *the caption flips — same art.* The chapter's second identity reveal |
| `irene` | `vii-01-letter1` | IRENE NORTON, NÉE ADLER | put away at `vii-05-indebted` |
| `norton` | `iv-05-thankgod` | GODFREY NORTON | **GAP** — new art |
| — | `iv-13-unexpected` | `cameo: off` | the told story ends |

**Sfx and beds.** Existing 11 clips cover Beat I. New named slots these beats
require: `bell` (church arrival), `letter` (Beat VII — can reuse `paper-rustle`),
`whip` / `wheels` / `hooves-roll` (the pursuit; the reference drives hoof rate
off the gap in metres), `watch` (the gold watch), `rocket` (the throw — and the
**cry of fire ~0.9 s behind it**, because the crowd has to see the smoke before
it shouts), `disperse` (the street emptying, and it must be *heard* to),
`window-open`, `glass` (the altar's hourglass, optional). New beds: `chase`
(night road, far wheels), `church` (stone room tone, empty). `street` bed EXISTS.

### 6.6 The Beat VI clock — the one non-click-paced stretch

t = 0 is the instant the reader's `window` gate resolves. Reproduce exactly; the
lines are timed to the camera work, not the other way round.

| t (s) | what happens |
|---|---|
| 0.00 | smoke gate OPENS (`ruseSmoke(true)`); the ruse fires; sfx `rocket`; **margin cleared and left empty** |
| 0.45–1.35 | the rocket is in the air, up into the first-floor window (trail + flash) |
| 1.35 | the flash — **the instant the house starts smoking**; the plume builds over 0.45 s |
| 1.50 | camera lifts out of the street rig onto the composed REVEAL pose over 1.7 s; Holmes shrinks away the way he grew in |
| 1.50+ | the crowd turns to look, staggered 0.22 s per figure |
| 2.05 | **THE REVEAL fires** (7.6 s long): +0.0-0.5 the room behind the glass brightens · +0.35-1.95 **she crosses to the panel side** · +1.95-2.45 her hand goes up to the panel · **+2.45-5.10 SHE PAUSES — this is the image** · +5.6-6.9 she withdraws · +6.6-7.6 the light goes down |
| ≈3.20 | `vi-03-panel` arrives as the camera settles |
| 4.20 | plumes at full rate |
| 5.60 | `vi-04-glimpse` — lands inside her pause |
| 6.00 | the ruse's own clock ends |
| 8.60 | `vi-05-knowwhere`; the crowd disperses; sfx `disperse`; camera eases back over 2.4 s |
| 11.00 | `vi-06-howfind` |
| 13.20 | `vi-07-showed` |
| 16.60 | camera returns to the street's composed pose over 2.8 s |
| **19.80** | **the page turns** to the room (leaf 5 → leaf 6) |

---

## 7. Inventory — what EXISTS vs what must be GENERATED

### 7.1 EXISTS (shipped in `site-deploy/living/assets/`, verified against `MANIFEST.json`)

| kind | files | reusable in II–VII |
|---|---|---|
| SET `room` | `plate/room.jpg`, `room-open.jpg`, `room-dim.jpg` (1408×768) | **Beat VII, whole** |
| room free layers | `plate/chair.png` + `chair-dim.png`, `plate/holmes-patch.png` + `-dim` | Beat VII |
| actor: King | `actor/king-masked.png`, `king-unmasked.png` (571×1159), `king-walk-enter.png` + `king-walk-exit.png` (4-frame strips) | **Beat VII — the unmasked plate and the walk cycles** |
| actor: Holmes | `actor/holmes-holmes.png` + head/torso/skirt/legs/pipe parts + `holmes-walk.png` (4 frames) | room only — **needs street + church cuts** |
| props | `actor/note-prop.png`, `actor/mask-prop.png`, `actor/contact-shadow.png` | `contact-shadow` reusable everywhere |
| insets | `inset/note-plate.jpg`, `watermark-plate.jpg`, `both-photo.jpg` | none reusable (both-photo is I.8's object, **not** IV.3's) |
| cameos | `cameo/holmes.jpg`, `king-masked.jpg`, `king-unmasked.jpg`, **`irene.jpg`**, `watson.jpg` | **`irene` reused three times with two different captions** |
| audio | 11 clips: `room-bed`, `street-bed`, `page-turn`, `paper-rustle`, `hoofbeats`, `door-knock`, `click-soft`, `step`, `reveal`, `book`, `mask-drop` | `street-bed`, `hoofbeats`, `page-turn`, `click-soft`, `step`, `paper-rustle` |
| page | `page-texture.jpg` | all |

**Candidate, not an asset:** `assets/plates/street-arrival.png` — 1024×1024,
"Baker Street terrace exterior at night, hansom under a gas lamp". **It is not
Serpentine Avenue** (no bijou villa, no long windows to the floor, no bay) and it
is the only square plate in the repo. Use it as a **composition/palette reference
for the `chase` SET** (terrace + cobbles + gas lamp + hansom is the closest
existing read) and regenerate at 1408×768. Do not ship it as a set.

**Also on disk, unshipped:** `assets/plates/backdrop.png` (the locked style
master — match everything to it), `assets/3d/*.glb` (8 models incl. `hansom-cab.glb`),
`assets/plates/king-v2/` (the King's 3D/paint pipeline). The 3D set is the *source*
for actor cuts, not a runtime dependency of the living stack.

### 7.2 GAP — must be generated, ranked by what blocks the most units

| # | asset | kind | blocks | notes |
|---|---|---|---|---|
| 1 | SET `street` base + 4 variants + free layers | plate ×5 | **II (3) + V (6) + VI (8) = 17 units** | the largest single item in the lane; the reveal-behind-glass is its hardest read |
| 2 | SET `church` base + dim + altar/hourglass layers | plate ×2+ | **IV (17 units)** | must support two close lenses (ring, coin) that carry facts |
| 3 | SET `chase` base + dim + fog + lit-door layers | plate ×2+ | **III (12 units)** | needs three independently-moving vehicle rigs |
| 4 | actor **Irene** — landau/boarding, bride, **reveal silhouette** | sprite ×3 | III, IV, VI | the silhouette is a different asset from the figure |
| 5 | actor **Norton** — in his cab, running, beckoning, at the altar | sprite ×3-4 | III, IV | plus a 4-frame run strip |
| 6 | actor **clergyman** (surpliced) | sprite | IV | |
| 7 | vehicle rigs: **hansom**, **landau**, **four-wheeler** (+ drivers, horses, wheels, lamp halos) | sprite ×3 | III | `assets/3d/hansom-cab.glb` is a start |
| 8 | actor **Holmes, street coat** + **Holmes, witness** cuts | sprite ×2 | II, IV, V, VI | the existing puppet is cut from the room plate and is lit for it |
| 9 | inset **`plate-rocket`** | inset | V (II.3) | "an ordinary plumber's smoke-rocket, a cap at either end" |
| 10 | inset **`plate-irene`** | inset | VII (IV.3) | **a portrait of her ALONE** — cut from the same raw as `both-photo` so it is the same face, the same sepia, the same frame |
| 11 | cameo **`norton`** | cameo | IV | one card |
| 12 | the **crowd** (turn, then scatter) and the **maid** | sprite | VI | crowd may be a strip of 5-8 silhouettes |
| 13 | props: **rocket + trail + flash**, **chalk ring** (3 states), **gold watch**, **ring**, **sovereign**, **hourglass** | sprite ×6 | III, IV, V, VI | the ring and the sovereign are contract facts and must read at the close lens |
| 14 | audio: `bell`, `whip`, `wheels`, `watch`, `rocket`+cry, `disperse`, `window-open`, beds `chase` + `church` | clip ×9 | III, IV, VI | `letter` can reuse `paper-rustle` |

**All plate generation runs the locked style template** (§1.9) and lands
raw-first with a full manifest under `assets/raw/**` before any curated copy.

---

## 8. Open rulings — where the reference cannot be copied verbatim

These are the only places this file departs from the reference, and each is
flagged rather than silently decided.

**8.1 The Beat V walk.** The reference gives the reader a free WASD/tap walk to a
chalk ring in a 3D street. The Living Book has no free movement. Specified here
as a single target click on the chalk ring plus a camera descent. **Owner's to
overrule.** (Fallback if the walk is wanted: a two-mark Watson-POV traverse, the
camera translating along a measured floor line the way Holmes' own walk does in
Beat I.)

**8.2 The narrator ruling.** Beats III and IV are Holmes' first-person account
and the reader stays Watson (§2.1). This is the orchestrator's standing default,
carried over unchanged, and it is the owner's to overrule. Overruling it changes
prefixes on 24 units and nothing else.

**8.3 Beat VI is not click-paced.** Five units arrive on a clock (§6.6). This is
the reference's own deliberate exception to the click-paced law — *"once the
rocket is in the air the camera owns the frame."* If the owner wants the whole
book click-paced, `panel` / `glimpse` / `knowwhere` / `howfind` / `showed` become
click units and the camera work has to be re-cut around them.

**8.4 The chapter's end.** The reference hands off to Chapter 2 at `thewoman`.
This book is Chapter 1 only, so leaf 7 is a **closing card** in the shape of Beat
I's (`END_CARD`: kicker / title / sub), and nothing follows it.

**8.5 Segment-paced units.** Five units (`landau`, `lounged`, `facedround`,
`halfdragged`, `letter1`) advance when their segment settles rather than on a
click. They are the units a click does not pace, and their segment lengths are
authored (6.0 s each for the chase intro's siblings; 15.0 s for `woman`). If a
lane makes them click-paced, the pantomime they carry is cut off mid-move.
