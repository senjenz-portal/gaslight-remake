# The Living Book agent API

A Living Book is playable by an agent as a first-class reader, not as a test
subject. The same hooks the verification lap drives are a product surface: a
deterministic sim clock, a verb-for-verb input surface, and a full structured
read of the world at any instant. An agent that plays a chapter can come back
with more than "it ran" — it can come back with a **machine-checkable
certificate of what the book put in front of a reader** (§4).

This file documents that surface as shipped in `site-deploy/living-odyssey/`
(Book IX of the Odyssey, 81 units). The sherlock edition
(`site-deploy/living/`) carries the same contract minus the 2026-08-16
amendments (`release`, `rest`, the dedication). **Accuracy law: every claim
below is verified against `app/main.js`, `app/clock.js`, `app/stage.js`,
`app/units.js` and `tools/ody/lap-ody.mjs` as they stand. Nothing here is
aspirational.** The reference consumer is `tools/ody/lap-ody.mjs` — a complete
scripted read that composes every call in this file.

---

## 1. ACTIVATION AND DETERMINISM

### 1.1 Two tiers of hooks

* **READ-ONLY, always attached** (any visitor, no flag):
  `window.__ready`, `__state()`, `__unit()`, `__units()`, `__unitByKey(k)`,
  `__beats()`, `__errors()`.
* **MUTATING, attached only under `?harness=1`**:
  `__gotoUnit`, `__click`, `__gateClick`, `__gateMiss`, `__holdStart`,
  `__holdEnd`, `__setTime`, `__advance`, `__renderNow`, `__mute`, `__audio`,
  `__ensureAll`, `__dedicate`, `__refs`.

Boot handshake: navigate to `<book>/?harness=1`, then wait for
`window.__ready === true` (also mirrored as `document.body.dataset.ready`).
`__ready` promises that **nothing the current leaf can reveal is still on the
wire** — leaf 1 is fully decoded; later leaves decode under their own page
turns (the lazy-load law).

```js
await page.goto(url + '/?harness=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true);
await page.evaluate(() => window.__mute(true));   // optional; returns the audio snapshot
```

### 1.2 The clock is yours

With `?harness=1` the sim clock boots in harness mode: **the rAF loop never
feeds it**. The book stands at its first frame and moves only when you call
`__setTime` / `__advance`. Nothing drifts between a step and a screenshot.

* `__setTime(t)` — absolute, **forward-only**: steps the sim in fixed
  `1/60 s` quanta until `clock.t >= t`. Returns `{ t, steps, frame }`.
  A target in the past is a no-op (`steps: 0`).
* `__advance(dt)` — sugar for `__setTime(clock.t + max(0, dt))`.
* `__renderNow()` — one `step(0)`: re-runs this frame's DOM writes (ring
  positions, strip frames) without advancing time. Call it before a
  screenshot. Returns the render count.
* One call steps at most 20 000 fixed frames (~5.5 min of sim).

### 1.3 The determinism guarantees

* **LAW: no logic in the app reads a wall clock.** The only wall-clock entry
  point is the live rAF pump, and harness mode disconnects it. Every animation
  — camera, pantomime, hold progress, page-turn covers, audio cue scheduling —
  is a pure function of the sim clock (`app/clock.js` header, enforced
  throughout).
* **STORY TIME, not sim time.** `__state().t` is `clock.t` minus every second
  the book spent under a raised cover waiting for a leaf's bytes
  (`__state().stall`). Nothing the reader can see happens under a cover, so
  nothing ages under one — including the unit's own dwell clock (`unitT`).
  Provenance: before this law, two identical laps diverged from the first
  turn that had to wait, and 4.05% of THE REVEAL's pixels moved.
  **Consequence for agents: network speed cannot leak into pixels.** Two laps
  that step the same numbers and issue the same verbs paint the same frames.
* **No `Date.now`, no `Math.random`.** Anything that needs randomness is
  seeded (`mulberry32`); the dedication sigil is FNV-1a → mulberry32 off the
  typed name. The shipped lap proves the strong form: the same name draws the
  **byte-identical canvas across a full page reload** (dataURL byte-equal,
  screenshots sha256-equal).
* **Fixed-step arithmetic.** `clock.t` is recomputed as `frame * (1/60)` each
  step — no float accumulation — so step counts, not durations, are the
  ground truth.

### 1.4 Async edges (the two places you must yield)

* `__gotoUnit` and `__ensureAll` return **promises** (a jump may land on a
  leaf whose SET has never been decoded). `await` them.
* A page turn holds its cover up until the incoming SET's bytes decode, and
  that decode resolves on real microtasks — one giant `__advance(30)` inside
  a single evaluate cannot complete a turn that still needs bytes. Loop
  instead, exactly as the lap does:

```js
while ((await st()).turn.active) await page.evaluate(() => window.__advance(0.4));
```

---

## 2. THE VERB SURFACE

A unit's `verb` is the reader's contract with it: `click | auto | hold |
release | target | clock` (validated at boot by `validateUnits`). Two
modifiers block any unit from turning: `wait:` (the named thing must have
happened on stage) and `seg` + `segHold` (a timed pantomime must finish).
`__state().blocked` reports `'wait:<name>'` / `'seg:<name>'` or `null`.

**THE LATCH LAW** applies everywhere: a click that arrives while a unit is
blocked (or while the next unit's clock is not due) is **latched, not lost** —
it spends itself the instant the block lifts. `__state().latch` shows the
armed latch; `latched` counts them.

**SOFT-FAIL (beats II–VI only):** every gate self-satisfies after 30 s of the
unit's own story clock, and every click-paced unit advances itself at
`min(30, dwell)`. No gate is a wall. **Beat I is excluded by design** — it
shipped without soft-fail and stays byte-identical, so in Beat I the verbs
must actually be performed.

### 2.1 `click` — the default verb

```js
const view = await page.evaluate(() => window.__click());   // pressDown + pressUp; returns __unit()
```

On an unblocked click unit this advances (into a page turn if the next unit
is on a new leaf). On a blocked one it latches. `__click()` returns the
`__unit()` view **of whatever unit is current after the press** — compare
`i` before and after to know whether the page moved.

### 2.2 `auto` — the unit turns itself

No input. Advance time past `dwell`:

```js
await page.evaluate(() => window.__advance(0.5));   // repeat until __state().i moves on
```

### 2.3 `hold` — press-and-hold, and REST-ALLOWED holds

`hold: <seconds>` is the full-press time (`k` rises linearly to 1 over it).
A `hold` verb **resolves itself the moment k reaches 1 mid-press** (the
reveal snaps to full, the margin cue flips to the click affordance); the
resolved unit then advances **on a click**, like any other:

```js
await page.evaluate(() => window.__holdStart());        // returns S.hold.k
await page.evaluate(() => window.__advance(u.hold + 0.1));
await page.evaluate(() => window.__holdEnd());          // returns S.hold.k
await page.evaluate(() => window.__click());            // a resolved hold advances on the click
```

Everything the hold carries (the bowl's fill, the ember glow, the watermark)
is a per-frame function of `k` — the watermark law — so partial holds are
honest partial states, readable at `__state().hold.k` and in the set
snapshot.

**Released early:** an ordinary hold bleeds back at 0.75× the fill rate. But
the two big holds of Book IX (`lookhere` 1.6 s, `embers` 3.0 s) carry
`rest: true` — **a released hold keeps every bit of its progress and resumes
on re-press.** Rest is allowed; their cues say so. (`rest` is legal on the
`hold` verb only.) An agent proving the rest law: press to ~50%, `__holdEnd()`,
`__advance(2.0)`, and assert `hold.k` and the carrier it drives did not drop —
that is the lap's own `[rest]` gate.

### 2.4 `release` — the press is the breath, the release is the beat (AMENDMENT 2026-08-16)

One unit carries it: `ody-vi-07-myname`, the self-naming, `hold: 0.6`.
Press-and-hold draws the breath — the taunt cut swells on the held `k`, and
**nothing advances while held**. Holding past the 0.6 s threshold banks `k`
at 1, which means only "the shout is armed — let go when ready". The story
advances **on the release frame itself**: `pressUp` resolves it
synchronously, so the state read straight after `__holdEnd()`, with no sim
step in between, has already moved.

```js
await page.evaluate(() => window.__holdStart());
await page.evaluate(() => window.__advance(1.0));       // >= 0.6 s banks the shout
const before = (await st()).i;                          // still here: held, not advanced
await page.evaluate(() => window.__holdEnd());          // fires gateAct + gateSfx, advances NOW
const after = await st();                               // after.i !== before, same frame
```

A press under the threshold is a stray click: the swell subsides and the page
holds. Soft-fail auto-releases at 30 s like every other gate. The lap's
`[release]` gate proves all three halves (stray held / no advance while
pressed / moved on the release frame) plus the `shout` cue ringing in the
audio log.

### 2.5 `target` — the gates, and how to miss them

Five target units carry the book's pointed gates (`ship`, `sword`,
`ram-great`, `cyclops` ×2). Two purpose-built hooks aim for you in plate
space, so an agent never computes screen coordinates:

```js
const miss = await page.evaluate(() => window.__gateMiss());
// aims TARGET_PLATE + (190,120) by default; __gateMiss(dx, dy) to choose
// -> { advanced:false, resolved:false, misses:1 } on a healthy gate

const hit = await page.evaluate(() => window.__gateClick());
// aims the target's own plate anchor
// -> { ok, from, to, target, endsBeat, held, turning, at:{x,y} }
```

`ok` means **the reader moved**, which has three shapes and all three count:
the index changed (an ordinary in-leaf gate), a page turn began (`turning` —
the index changes under the cover), or the frame was handed to a beat clock
(`held` — Beat VI's throw). A gate can be armed before its target is staged:
poll `__state().gate.live === true` first the way a reader waits for the
sword to glint (the lap allows ~5 s). **A gate that cannot be MISSED is not a
gate** — prove the miss before the hit, as the lap does for every one.

### 2.6 `clock` — the beat owns the frame

After Beat VI's throw, five units arrive on the beat's own timeline
(`u.at` seconds on `__state().clock.t`) and the page turn rides it too.
A click cannot hurry a clock unit — it latches. The agent's verb is time:

```js
while ((await st()).unit.id === u.id) await page.evaluate(() => window.__advance(0.4));
```

### 2.7 Blocked units — `wait:` and held `seg`s

Same pattern: advance time in small steps until `__state()` shows a new unit
(or `turn.active` / `end.active`). To prove the latch law on the way through,
click once while `blocked` is non-null and assert the index held and
`latch === true`.

### 2.8 Jumping — `__gotoUnit` (async)

```js
await page.evaluate(async () => await window.__gotoUnit('defy'));  // key, id, or index
```

Ensures the destination leaf's SET is decoded, **resets the world**, mounts
the set, and silently replays every unit of that leaf up to the target — acts
*and* gateActs fire, so the world arrives in the state the story would have
built (a replayed gate has already been answered). Returns the `__unit()`
view, or `null` for an unknown key. Jumps land anywhere; the read itself
should never need one — the lap walks all 81 units with zero `__gotoUnit` in
the walk and uses it only for post-read probes (soft-fail, portrait,
hesitation's reluctant half).

### 2.9 The closing card — `__dedicate`

The last unit's completing click turns the page onto the closing leaf
(`__state().blankLeaf === true`, `end.card` rises to 1). Once the card
settles, the seeded dedication's ask rises:

```js
const d = await page.evaluate(() => window.__dedicate('Penelope of Ithaca'));
// -> { shown, skipped, name, hash, png } — png is the sigil canvas dataURL,
//    a pure function of the name (FNV-1a -> mulberry32; byte-stable across reloads)
```

Nothing is stored; empty input clears the sigil and the line.

---

## 3. READING THE WORLD

### 3.1 `__state()` — the full read, one call

Top-level fields (all cheap, all JSON):

| field | meaning |
|---|---|
| `ready` | boot handshake complete |
| `t` / `wall` / `stall` / `frame` | STORY time / sim time / cover-wait debt / fixed steps taken |
| `harness` | the clock is agent-driven |
| `i`, `total`, `unit`, `unitT` | index, 81, the `__unit()` view, the unit's own story clock |
| `page`, `pages`, `finished`, `blankLeaf`, `beat`, `set` | where the reader stands |
| `advances`, `nudges`, `visited`, `renders` | counters (nudges = gate misses margin-nudged) |
| `blocked`, `latch`, `latched`, `softFails` | the blocking state and the latch ledger |
| `clock` | `{ t, held }` — the Beat VI clock and the handoff flag |
| `hold` | `{ pressing, k, resolved, required }` |
| `gate` | `{ target, resolved, misses, live }` |
| `turn` | `{ active, k, to, ready, waited, swapped }` — `ready:false` = decoding under the cover |
| `end` | `{ active, k, card }` |
| `hesit` | AMENDMENT A2 — story seconds the reader held the `defy` choice open (null until resolved) |
| `ded` | `{ shown, skipped, name, hash, named }` |
| `view`, `viewport` | panel fit, portrait flag, dpr |
| `targetScreen` | the armed gate's plate anchor and screen position, with `live` |
| `stage` | the stage snapshot — §3.3 |
| `cameo` | the identity card currently raised |
| `audio` | `{ bed, cues, muted }` |
| `errors` | every window error/rejection/unit-validation failure since boot |

### 3.2 `__unit()` / `__units()` — the script, and the margin text

The unit view carries the authored contract row: `i, id, key, verb, target,
speaker, text, cue, focus, page, beat, set, fact, wait, seg, at, endsBeat,
endsBook, cameo, cap, act` — plus two live margin fields:

* `shown` — the last text the margin was given (the unit's own line);
* `blocks` — the **plain-text transcript of everything currently on the
  page**, one block per line. This is what "on screen" means for prose: the
  lap's verbatim gates assert the contract's text against `blocks`, not
  against the script.

`__units()` returns all 81 rows — the whole fact-and-carrier map is readable
before the first frame is stepped. `__beats()` returns the six-beat table
(num, title, set, leaf, unit count).

### 3.3 `stage` — the shell plus the mounted SET

`stage.snapshot()` composes the shell's fields with the active set's own:

* Shell: `set` (mounted name), `mounted` (every set built so far — the
  lazy-load proof: at `__ready` it is `['shore']` and nothing else),
  `plate` (`dim` + every inset's opacity by id), `cam`
  (`{ x, y, k, wantK }` in plate px), `acts` (every act fired since reset),
  `gaps` (**art the engine asked for and did not get** — the anti-silent-
  degrade ledger of PIPELINE-LIVING §3.4).
* Set: each SET publishes its own measured world, in plate pixels — the cave
  reports `cast` (marks, opacities, formation, `crewN`), `giant`
  (pose/mark/box/blinded), `sprawl` (box, eye, pen clearances + `ok`),
  `flock.ram` (at/slung/box), `caveState`, `drive` (the blinding clock),
  `neighbours.seams`, `pours`, `sword`, `gate` (per-gate liveness +
  `resolutions` + `myname`), `strips` (per-strip frame + rendered foot +
  anchor error); the shore reports `smoke` (containment + column geometry),
  `crossing`, its cast and strips; the sea reports `rowers`, `giantStrip`,
  `ulysses` (mark/pose/holdK), `world.k`, `veil`, `splash`, `rock1/rock2`,
  `hurlDone`, `idle`. These are the numbers every carrier assertion in the
  lap reads — the set snapshot is the world's own ledger, re-measured live.

### 3.4 The rest of the evidence

* `__audio()` — `{ available, ok, muted, unlocked, bed, decoded, cues, log }`;
  the log is every bed change and cue with its **sim-time** stamp, so "the
  shout rang on the release" is a countable fact.
* `__errors()` — must stay empty across a clean read.
* `document.body.dataset` — `unit`, `verb`, `gate`, `set`, `beat`, `ready`:
  the current state as DOM attributes, for selector-driven agents.
* `__refs` — `{ stage, audio, margin, clock, S, UNITS }`, the live objects,
  for probes the snapshot does not carry (the lap uses it for pixel-exact
  node geometry). Off the JSON path; use the snapshots first.
* `__ensureAll()` — decode every SET up front (returns the gaps list). The
  read itself never needs it; it exists for probes that jump.

---

## 4. THE COMPREHENSION CERTIFICATE

This is the point of the whole surface, so it is stated plainly.

**Stage 0 of the pipeline writes a comprehension contract: the facts a
first-time reader must be able to state after playing, each with a CARRIER —
the specific on-screen thing that delivers it** (PIPELINE-LIVING §2.2). Book
IX carries fourteen: O.1 (one-eyed giants, smoke across the strait) through
O.14 (the curse and the second rock). The carriers are wired into the script
itself — `__units()` shows the `fact` id on each carrier unit.

**§3.4's corollary makes the fact list the assertion list**: for every
fact-with-a-carrier, the lap holds an assertion that the carrier was ON
SCREEN at the unit that needs it — not that a file fetched, not that code
ran. Smoke is pale pixels brighter than their own sky in the smoke lens; the
boulder is the aperture's luma changing 1.5× between open and shut with the
mouth's light out; the pun is Butler's sentence verbatim in the margin's own
transcript; the name is armed only by the reader's second click on the
Cyclops, over the plea still standing on the page. Every floor is either the
ledger's own number or a measured constant with its provenance written next
to it — none is tuned to pass the working tree.

So a lap is not test scaffolding. **It is a machine-checkable proof that a
reading happened**: 81 units entered in order by the reader's own verbs (no
`__gotoUnit` in the walk), every gate proven by missing it first, every fact's
carrier measured on screen at its carrier unit, zero console errors, on the
deployed URL. The proof composes from exactly the calls in §2 and §3 — an
agent run *is* the certificate's collection pass:

```
node tools/ody/lap-ody.mjs                 # serves site-deploy/living-odyssey itself
node tools/ody/lap-ody.mjs --base https://…/living-odyssey   # or the deployed bytes
```

Output: `LAP CLEAN` (exit 0) or `LAP FAILED (n)` (exit 1), per-beat
screenshots, and `lap-ody.json` — whose `facts` object is the certificate's
body: one evidence line per fact id, each quoting the measured numbers
(`"O.4": "mouth luma 29.4 open -> 64.7 shut (ratio 2.2), mouth light out (gain …)"`),
alongside `failures`, the gate ledger, the rest/release proofs and every
tally. A fact with neither evidence nor a named failure fails the lap itself:
**a hole in the certificate is a defect, not an omission.**

The education pitch, stated without decoration: a comprehension quiz tests
the reader; this certifies the edition. Before a green lap, "the reader will
learn that the cave mouth was sealed by a stone twenty-two waggons could not
move" is a hope. After one, it is a recorded measurement — that sentence was
on the page verbatim, at its unit, while the painted boulder measurably
filled the aperture, in a read performed by the same verbs a child would use.
An agent that plays a Living Book and returns the facts it can attest is
doing what an examiner does, with the burden of proof moved where it belongs:
onto the book.

The pattern is portable. New book, new fact list, new carriers — the grammar,
the hooks and the lap architecture carry over unchanged (PIPELINE-LIVING §5).

---

## 5. A COMPLETE MINIMAL EXAMPLE

An agent reads Beat I (13 units, one gate, no soft-fail — the verbs are
real) and returns the facts it can attest with the carrier text proven on
the page. Serve the book first:
`python3 -m http.server 8811 -d site-deploy/living-odyssey`

```js
// read-beat-1.mjs — node read-beat-1.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8811/?harness=1');
await page.waitForFunction(() => window.__ready === true);
await page.evaluate(() => window.__mute(true));

const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
const st = () => page.evaluate(() => window.__state());
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const attested = [], seen = new Set();

for (let guard = 0; guard < 300; guard++) {
  const s = await st();
  if (s.turn.active) { await T(0.4); continue; }       // the leaf is turning
  if (s.beat > 1 || s.finished) break;                 // Beat I is read
  const u = s.unit;
  if (u.fact && !seen.has(u.key) && norm(u.blocks).includes(norm(u.text))) {
    seen.add(u.key);                                   // carrier text IS on the page
    attested.push({ fact: u.fact, carrier: u.key, storyT: s.t });
  }
  await T(0.9);                                        // dwell on the frame
  if (u.verb === 'auto') continue;                     // it turns itself
  if (u.verb === 'target') { await page.evaluate(() => window.__gateClick()); continue; }
  await page.evaluate(() => window.__click());         // the default verb
}

console.log(JSON.stringify(attested));
// -> [{"fact":"O.1","carrier":"lawless","storyT":…},{"fact":"O.2","carrier":"misgave","storyT":…}]
await browser.close();
```

Beat I carries two facts and this run attests both: O.1 (the lawless
Cyclopes, smoke across the strait) and O.2 (the strength of Maron's wine).
The full-strength version of the same loop — every verb, every gate missed
first, every carrier measured in pixels — is `tools/ody/lap-ody.mjs`.

---

## 6. WHERE THINGS LIVE

| thing | path |
|---|---|
| the engine + hooks | `site-deploy/living-odyssey/app/main.js` (hooks at the foot) |
| the clock law | `site-deploy/living-odyssey/app/clock.js` |
| the stage + snapshots | `site-deploy/living-odyssey/app/stage.js`, `app/sets/*.js` |
| the script + facts + verbs | `site-deploy/living-odyssey/app/units.js` (generated from `CONTENT-odyssey.md`) |
| the contract (the law) | `CONTENT-odyssey.md` |
| the world's numbers | `tools/ody/ledger.json` |
| the reference agent | `tools/ody/lap-ody.mjs` -> `shots/ody-lap/lap-ody.json` |
| the pipeline this serves | `PIPELINE-LIVING.md` (esp. §2.2 and §3.4) |
