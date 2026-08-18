/**
 * main.js — the reader's machine: 81 units, six beats, six gates, five page
 * turns and one closing card.
 *
 * This is Beat I's machine, unchanged in its grammar and extended to the whole
 * chapter. A unit holds its freeze frame until the reader clicks; a gate
 * demands its verb instead; the completing action turns the page. What the
 * chapter adds to the beat:
 *
 *   SETS          one painted stage is mounted at a time, and the PAGE TURN is
 *                 what swaps them. The cover rises, the incoming set is decoded
 *                 UNDER it, the leaf swaps, the cover falls onto a new picture.
 *                 The turn will wait as long as the bytes take — a reader can
 *                 never outrun a leaf he has not turned to yet.
 *   wait:         three units may not be paged past until the thing they name
 *                 has happened on stage. A click inside that window is LATCHED,
 *                 not lost, and spends the moment the unit may turn (sec 2.3).
 *   seg           five units run a timed segment of pantomime; four of them are
 *                 paced by it, the same latching way.
 *   clock         Beat VI is the one stretch of the book that is not click-
 *                 paced: after the reader's throw the camera owns the frame and
 *                 five units arrive on the beat's own timeline (sec 6.6).
 *   release       AMENDMENT 2026-08-16 — the self-naming (VI.7) is paced by
 *                 the reader's LET-GO: press-and-hold draws the breath,
 *                 releasing past the 0.6 s threshold fires the shout and the
 *                 story advances ON the release frame. AMENDMENT A7
 *                 (2026-08-17): the first wine pour (III.8) is the book's
 *                 second release — the fill BANKS on the hold (rest kept),
 *                 the POUR fires on the pointerup, per the contract's own
 *                 "each release drained" (CONTENT-odyssey.md O.7).
 *   rest          AMENDMENT 2026-08-16 — the two big holds (G3 bowl, G4
 *                 embers) carry `rest: true`: a released hold keeps its
 *                 progress and resumes on re-press. Rest is allowed. (G3 is
 *                 a release verb now; its rest law is unchanged — an
 *                 under-threshold let-go banks the fill.)
 *   soft-fail     every gate self-satisfies after 30 s, and every click-paced
 *                 unit in beats II-VII advances itself (sec 2.6). No gate is a
 *                 wall. BEAT I IS EXCLUDED: it shipped without soft-fail and
 *                 stays byte-identical — EXCEPT its heading (AMENDMENT A6,
 *                 2026-08-17): the opening head unit is ours, it WAITS for
 *                 the reader's first click instead of pacing itself, and the
 *                 30 s soft-fail is what carries a reader who never clicks.
 *   ux honesty    2026-08-17 (external review): target rings neither show
 *                 nor accept hits before the SET reports the target live
 *                 (incl. the 48 px screen-slack fallback); a tap within
 *                 250 ms of the last advance is a double-tap slip and is
 *                 ignored; a pointerup that travelled > 24 px is a
 *                 drag/scroll, not a tap.
 *
 * LAW: nothing here reads a wall clock except `frame()`. Everything animated
 * is a pure function of STORY TIME — the sim clock minus the seconds the book
 * spent under a raised cover waiting for a leaf's bytes — so two laps that
 * step the same numbers paint the same pixels, on a fast line or a slow one.
 * (Beat I never needed the distinction: it has one SET and nothing to wait
 * for. The chapter has four, and the first turn that waited put 4% of THE
 * REVEAL's pixels somewhere else between two otherwise identical laps.)
 *
 * Dev hooks (foot of this file) are the harness's whole contract, and they are
 * only attached under ?harness=1.
 */
import { UNITS, BEATS, beatOf, END_CARD, END_PAGE, PAGES, SET_OF_PAGE,
         CUE_DEFAULT, FIRST_HINT, validateUnits, unitByKey } from './units.js';
import { Margin, Cameo, Leader } from './margin.js';
import { SimClock, FIXED_DT } from './clock.js';
import { AudioManager } from './audio.js';
import { Stage, PLATE } from './stage.js';
import { drawSigil } from './sigil.js';

const TURN_IN = 0.55;      // cover fades up
const TURN_HOLD = 0.18;    // the leaf swaps under the cover
const TURN_OUT = 0.72;     // cover fades away on the new page
const END_CARD_IN = 0.55;
const HOLD_DECAY = 0.75;   // a released hold bleeds back at this fraction —
                           // EXCEPT units marked `rest: true` (rest is allowed:
                           // the two big holds keep their progress on release)
const TARGET_RADIUS_PX = 48;   // screen-space slack on top of the plate radius
                               // — honoured ONLY while the SET reports the
                               // target LIVE (ux honesty, 2026-08-17): the
                               // slack forgives a near miss, it must never
                               // resolve a gate whose target is not armed yet
const SOFT_FAIL = 30;      // sec 2.6 — no gate is a wall
/* UX HONESTY (2026-08-17, external review): a second tap inside this window
   is the same tap twice (a double-tap slip would spend TWO units), and a
   pointerup that travelled further than this is a drag or a scroll attempt,
   not a read-on. Both are ignored; both are measured on the sim clock, so
   the laps stay deterministic. */
const TAP_DEBOUNCE_S = 0.25;
const DRAG_REJECT_PX = 24;
/* HESITATION MEMORY (AMENDMENT A2): at `defy` — the reader's SECOND click on
   the Cyclops, the contract's own "the reader chooses the hubris" — the book
   remembers how long the reader held the choice open: story seconds from the
   gate arming (the unit entered, the ring up) to the resolving click. Under
   this threshold the closing card reads him as eager; at or over it (and the
   30 s soft-fail is over it by definition) as reluctant. */
const HESIT_EAGER_S = 4;

const errors = [];
window.addEventListener('error', (e) => errors.push({ kind: 'error', msg: String(e.message) }));
window.addEventListener('unhandledrejection', (e) =>
  errors.push({ kind: 'rejection', msg: String(e.reason && e.reason.message || e.reason) }));

const CAMEO_URLS = {
  ulysses: './assets/cameo/ulysses.jpg',
  polyphemus: './assets/cameo/polyphemus.jpg',
  'a-cyclops': './assets/cameo/cyclops.jpg',
  'the-men': './assets/cameo/men.jpg',
};

/* A per-key table for any unit that needs a second cue in its one sfx slot
   (sherlock's `hadnote` knock-then-step). The odyssey has none — yet. */
const EXTRA_SFX = {};

const QS = new URLSearchParams(location.search);
const HARNESS_BOOT = QS.get('harness') === '1';

const clock = new SimClock();
if (HARNESS_BOOT) { clock.harness = true; document.documentElement.classList.add('harness'); }

const stageEl = document.getElementById('stage');
const stage = new Stage(stageEl, './assets/');
const audio = new AudioManager('./assets/audio/');
stage.audio = audio;
const margin = new Margin(document);
const cameo = new Cameo(document, CAMEO_URLS);
const leader = new Leader(document);
const coverEl = document.getElementById('cover');
const holdEl = document.getElementById('hold');
const holdArc = holdEl.querySelector('.arc');
const targetEl = document.getElementById('target');
const targetRing = targetEl.querySelector('.ring');
const endEl = document.getElementById('endcard');
const dedEl = document.getElementById('dedicate');
const dedInput = document.getElementById('dedname');
const dedLine = document.getElementById('dedline');
const sigilCanvas = document.getElementById('sigil');
const wrapEl = document.getElementById('stagewrap');
const ARC_LEN = 2 * Math.PI * 33;
stage.dimMatrix = document.getElementById('dimm');

/* ---- layout: the plate box, fitted, and the margin under it in portrait -- *
 * ONE source of truth for the orientation, and it is the stylesheet's own
 * query. When JS carried its own `w/h < 0.9` copy, the two could disagree for
 * a frame — the sheet had already moved the margin to the foot of the leaf
 * while the leader line was still drawing its landscape elbow across the
 * picture. Reading `.matches` costs no layout. */
const MQ_PORTRAIT = window.matchMedia('(max-aspect-ratio: 9/10)');
const view = { portrait: MQ_PORTRAIT.matches, w: 0, h: 0 };
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  view.portrait = MQ_PORTRAIT.matches;
  // portrait crops the plate's empty void margins rather than shrinking the room
  const vis = view.portrait ? { w: 1060, h: PLATE.h } : { w: PLATE.w, h: PLATE.h };
  stage.setView(vis.w, vis.h);
  const ar = vis.w / vis.h;
  let availW, availH;
  if (view.portrait) {
    availW = W * 0.95; availH = H * 0.56;
  } else {
    availW = (W - W * 0.32) * 0.90; availH = H * 0.80;
  }
  let w = Math.min(availW, availH * ar);
  let h = w / ar;
  stageEl.style.width = w.toFixed(1) + 'px';
  stageEl.style.height = h.toFixed(1) + 'px';
  view.w = w; view.h = h;
  if (view.portrait) {
    document.documentElement.style.setProperty('--stageh', (h + H * 0.03).toFixed(0) + 'px');
    document.documentElement.style.setProperty('--margintop', (h + H * 0.045).toFixed(0) + 'px');
  }
  stage.layout();
  stage.applyCam();
}
window.addEventListener('resize', () => { layout(); });
MQ_PORTRAIT.addEventListener('change', () => { layout(); });
layout();

/* ---- state (the same shape the original carried) ------------------------ */
const S = {
  i: -1, unit: null, unitT: 0, page: PAGES[0] || 1,
  hold: { pressing: false, k: 0, resolved: false, wasPress: false },
  gate: { resolved: false, misses: 0, lastHit: null, missT: 99 },
  turn: { active: false, t: 0, to: -1, swapped: false, k: 0, ready: true, waited: 0 },
  end: { active: false, t: 0, k: 0, card: 0 },
  finished: false, advances: 0, nudges: 0, visited: new Set(),
  ready: false, renders: 0, hinted: true,
  latch: false, latched: 0, softFails: 0, clockHeld: false, stall: 0,
  lastAdv: -1e9,   // sim time of the last advance — the tap debounce reads it
  ded: { shown: false, skipped: false, name: '', hash: 0 },
  hesit: null,   // AMENDMENT A2 — seconds the reader held the `defy` choice open
};

const unitErrors = validateUnits(UNITS);
if (unitErrors.length) errors.push({ kind: 'units', msg: unitErrors.join(' | ') });

const ease = {
  clamp01: (v) => (v < 0 ? 0 : v > 1 ? 1 : v),
  inOut: (k) => 0.5 - 0.5 * Math.cos(Math.PI * (k < 0 ? 0 : k > 1 ? 1 : k)),
};

const setOf = (u) => (u && u.set) || 'shore';

/* ---- THE HEROCLIP LAW ----------------------------------------------------
 * Four hero moments raise a LIVING CLOSE-UP: a muted video inset (the
 * wineskin-inset pattern, printed with motion) seeded from the staged tableau
 * itself, so lighting and register are baked. The law is the inset law's:
 * the clip rises ON ITS UNIT (through this table, on the same entry that
 * fires the unit's act — dawn5's row IS the G5 resolution, because resolving
 * `greatram` advances into dawn5 on the resolution's own frame) and the
 * completing click lowers it (entering any unit this table does not grant
 * takes every clip down). `after` delays the RAISE, never the world (the
 * wineskin's own plateAt pattern):
 *   firstmeal 3.6  — the card lands on the STATIC CLUTCH, after O.6's own
 *                    mid-seg instant (3.0 s) has been measured under open sky
 *   auger     1.2  — after the unit's settled frame; carried across the bore
 *                    tick (one twist, two clock units) and down on hiss
 *   rock1     3.6  — the unit enters on ROCK1.tear (jeer+7.0); +3.6 is the
 *                    land tick (10.8), the card rises WITH the plume
 * The world beneath stays deterministic: stage.clip drives want/at on the sim
 * clock, and the video is a card the sim asserts, not a fact the sim reads. */
const HEROCLIPS = {
  firstmeal: { id: 'clip-seize', after: 3.6 },
  auger:     { id: 'clip-twist', after: 1.2 },
  bore:      { id: 'clip-twist', after: 0 },
  dawn5:     { id: 'clip-underbelly', after: 0 },
  rock1:     { id: 'clip-splash', after: 3.6 },
};

/* ---- entering a unit ---------------------------------------------------- */
function enterUnit(n, { silent = false } = {}) {
  const idx = Math.max(0, Math.min(UNITS.length - 1, n | 0));
  const u = UNITS[idx];
  S.i = idx; S.unit = u; S.unitT = 0; S.page = u.page;
  S.visited.add(u.id);
  S.finished = false;
  S.latch = false;
  S.clockHeld = false;

  S.hold.pressing = false; S.hold.k = 0; S.hold.resolved = false; S.hold.wasPress = false;
  S.gate.resolved = false; S.gate.lastHit = null; S.gate.missT = 99;
  stage.setHold(0);
  stage.setReveal(u.reveal || null, 0);
  audio.hold(0);

  /* the SET this unit is played on must be the one that is mounted. In the
     read it always is — the page turn is what swaps them — but a harness jump
     lands anywhere, so this is the assertion that a wrong set cannot survive. */
  if (stage.activeName !== setOf(u) && stage.sets[setOf(u)]) stage.mount(setOf(u));

  margin.show(u);
  margin.cue(cueFor(u));
  progress(idx);
  applyCameo(idx);
  wrapEl.style.opacity = '1';

  refreshFocus(true);

  if (u.act) stage.fire(u.act, silent);
  /* the heroclip law (table above): granted units raise their clip AFTER the
     unit's own act has staged the world under it (cave-dawn's plate(null,0)
     must not swallow the card it shares an entry with); everyone else lowers */
  const hc = HEROCLIPS[u.key];
  if (hc) stage.clip(hc.id, 1, hc.after || 0);
  else stage.clip(null, 0);
  /* A REPLAYED GATE HAS ALREADY BEEN ANSWERED. `silent` means this unit is
     being replayed to rebuild the world on the way to a later one, and the
     reader's own verb is not coming: so its gateAct has to be fired here or the
     world arrives in a state the story never passes through. This is not
     theoretical — the shipped portrait proof `09-01-portrait-ring.png` was
     captured through this path and holds TWO Nortons, because `dragToAltar`
     never ran and the cut-out was left standing at the mark he beckons from
     while the plate went on painting him at the altar. */
  if (silent && u.gateAct) stage.fire(u.gateAct, true);
  if (u.seg) stage.startSeg(u.seg, u.segDur || 6.0, silent);
  if (!silent) {
    if (u.bed) audio.bed(u.bed);
    if (u.sfx) audio.cue(u.sfx);
    for (const [id, d] of (EXTRA_SFX[u.key] || [])) audio.cue(id, { delay: d });
  }
  document.body.dataset.unit = u.id;
  document.body.dataset.verb = u.verb;
  document.body.dataset.gate = u.target || '';
  document.body.dataset.set = setOf(u);
  document.body.dataset.beat = String(u.beat || 1);
}

/** The progress line names the BEAT the reader is in and counts inside it. */
function progress(idx) {
  const u = UNITS[idx];
  const b = beatOf(u);
  const first = UNITS.findIndex((v) => (v.beat || 1) === b.n);
  margin.progress(b, idx - first, b.units);
}

function refreshFocus(snap = false) {
  const u = S.unit;
  stage.setFocus((u && u.focus) || 'establishing', snap);
}

/**
 * Cameos persist — WITHIN THE LEAF THEY WERE RAISED ON.
 *
 * Beat I raised the King's card and never took it down, because Beat I is one
 * leaf and he never leaves it. Carried naively into the chapter that same rule
 * left "Wilhelm von Ormstein · King of Bohemia" pinned to the corner of
 * Serpentine Avenue, a street he is not in, for the whole of Beats II and III.
 * The card names who is on this page, so the page turn puts it away and the
 * next leaf raises its own. Beat I is 38 units on ONE leaf, so nothing about
 * its behaviour changes.
 *
 * An explicit `cameo: null` is the card being PUT AWAY mid-leaf (IV.13, where
 * the told story ends), not a unit with no opinion — so the scan stops there
 * rather than reaching past it.
 */
function applyCameo(idx) {
  const page = UNITS[idx].page;
  for (let j = idx; j >= 0 && UNITS[j].page === page; j--) {
    if (!Object.prototype.hasOwnProperty.call(UNITS[j], 'cameo')) continue;
    const c = UNITS[j].cameo;
    if (c) cameo.set(c, UNITS[j].cap); else cameo.hide();
    return;
  }
  cameo.hide();
}

function cueFor(u) {
  if (!u) return '';
  if (u.verb === 'hold' && S.hold.resolved) return CUE_DEFAULT.click;
  if (u.cue !== undefined) return u.cue;
  return CUE_DEFAULT[u.verb] || '';
}

/* ---- advancing ---------------------------------------------------------- */
/**
 * What is holding this unit on the page, if anything. A blocked unit is NOT a
 * refused unit: the click that arrives inside the window is latched and spends
 * itself the moment the block lifts, so a fast reader loses nothing and the
 * fact still performs.
 */
function blockedBy(u) {
  if (!u) return null;
  if (u.wait && !stage.waitDone(u.wait)) return 'wait:' + u.wait;
  if (u.seg && u.segHold && S.unitT < (u.segDur || 6.0)) return 'seg:' + u.seg;
  return null;
}

/** A clock unit arrives on the beat's clock and a click cannot hurry it. */
function clockDue(u) {
  if (!u || u.verb !== 'clock') return true;
  const t = stage.clockT();
  return t !== null && t >= u.at;
}

function canAdvance() {
  if (!S.unit || S.turn.active || S.end.active) return false;
  if (S.unit.verb === 'hold' && !S.hold.resolved) return false;
  if (S.unit.verb === 'release' && !S.hold.resolved) return false;
  if (S.unit.verb === 'target' && !S.gate.resolved) return false;
  if (blockedBy(S.unit)) return false;
  const next = UNITS[S.i + 1];
  if (next && next.verb === 'clock' && !clockDue(next)) return false;
  if (S.unit.verb === 'clock' && S.unit.turnAt !== undefined) {
    const t = stage.clockT();
    if (t === null || t < S.unit.turnAt) return false;
  }
  return true;
}

function advance() {
  if (!canAdvance()) {
    // the click is not lost: it is spent the moment the unit may turn
    if (S.unit && (blockedBy(S.unit) || (UNITS[S.i + 1] && UNITS[S.i + 1].verb === 'clock'))) {
      if (!S.latch) { S.latch = true; S.latched++; }
    }
    return false;
  }
  const next = S.i + 1;
  S.lastAdv = clock.t;   // the tap-debounce anchor (ux honesty, 2026-08-17)
  audio.cue('click');
  if (next >= UNITS.length || S.unit.endsBook) { startEnding(); return false; }
  S.advances++;
  if (S.hinted) { S.hinted = false; margin.hint(false); }
  if (UNITS[next].page !== S.unit.page) { startTurn(next); return true; }
  enterUnit(next);
  return true;
}

const END_LEAF = 'end';

/**
 * THE PAGE TURN, AT PLATE SCALE — and now it is also the SET SWAP.
 *
 * The cover takes the whole leaf, the picture is swapped underneath it, and
 * the cover lifts on what is now a different page. The set does not dissolve
 * into the next one: the leaf turns, and a different painting is what is
 * printed on the other side of it.
 *
 * The one thing the chapter adds is patience. The incoming SET is `ensure`d
 * the instant the turn begins and the cover HOLDS UP until its bytes are
 * decoded, however long that takes. A turn that lifted on a half-decoded plate
 * would be exactly Beat I's King-with-no-King bug, one leaf wider.
 */
function startTurn(to, { sfx = true } = {}) {
  S.turn.active = true; S.turn.t = 0; S.turn.to = to;
  S.turn.swapped = false; S.turn.k = 0; S.turn.waited = 0;
  const page = to === END_LEAF ? END_PAGE : UNITS[to].page;
  const want = SET_OF_PAGE[page];
  if (want && stage.activeName !== want && !stage.decoded(want)) {
    S.turn.ready = false;
    stage.ensure(want).then(() => { S.turn.ready = true; })
      .catch((e) => { errors.push({ kind: 'set', msg: String(e.message) }); S.turn.ready = true; });
  } else {
    // already decoded (or the same set): the cover has nothing to wait for, and
    // it must not wait on a microtask to be told so — see stage.decoded()
    S.turn.ready = true;
  }
  if (sfx) audio.cue('page');
  margin.cue('');
}

function stepTurn(dt) {
  const T = S.turn;
  /* A DECODE WAIT IS NOT STORY TIME.
   *
   * While the cover is up and the incoming SET is still decoding, the turn's
   * own clock stops and so does the world's (see `step`). Without that, how
   * long a leaf took to arrive off the wire leaked into the story: two laps of
   * the identical script diverged from the first turn that had to wait,
   * because the second one waited a different number of sim steps and every
   * ambient in the book is a function of the clock. Measured, that put 4.05%
   * of the pixels of THE REVEAL somewhere else. Nothing the reader can see
   * happens under a raised cover, so nothing under it ages. */
  if (!T.ready) {
    T.waited += dt;
    T.k = 1;
    coverEl.style.opacity = '1';
    wrapEl.style.transform = `translateX(${(-view.w * 0.06).toFixed(2)}px)`;
    return;
  }
  T.t += dt;
  const total = TURN_IN + TURN_HOLD + TURN_OUT;
  if (T.t < TURN_IN) T.k = ease.inOut(T.t / TURN_IN);
  else if (T.t < TURN_IN + TURN_HOLD) T.k = 1;
  else T.k = 1 - ease.inOut((T.t - TURN_IN - TURN_HOLD) / TURN_OUT);
  T.k = ease.clamp01(T.k);
  coverEl.style.opacity = String(T.k);
  // the leaf itself slides a little as it turns — a plate-scale page turn
  wrapEl.style.transform = `translateX(${(-T.k * view.w * 0.06).toFixed(2)}px)`;
  if (!T.swapped && T.t >= TURN_IN && T.ready) {
    T.swapped = true;
    if (T.to === END_LEAF) {
      enterEndLeaf();
    } else {
      const want = SET_OF_PAGE[UNITS[T.to].page];
      if (want && stage.activeName !== want) stage.mount(want);
      enterUnit(T.to);
    }
  }
  if (T.swapped && T.t >= total) {
    T.active = false; T.k = 0;
    coverEl.style.opacity = '0';
    wrapEl.style.transform = 'none';
  }
}

function startEnding() {
  if (S.end.active || S.turn.active) return;
  S.end.active = true; S.end.t = 0; S.end.k = 0; S.end.card = 0;
  S.finished = true;
  margin.hint(false);
  endEl.querySelector('.kick').textContent = END_CARD.kicker;
  endEl.querySelector('.ttl').textContent = END_CARD.title;
  /* HESITATION MEMORY (AMENDMENT A2): the sub gains one clause the reader
     wrote with his own pause at `defy` — under 4 s he gave the name at once,
     at or over it he held it as long as he could. A book that never passed
     through the gate's own resolution (a silent harness replay) appends
     nothing: the base sub is the contract's own line, untouched. */
  const clause = S.hesit == null ? ''
    : S.hesit < HESIT_EAGER_S ? END_CARD.subEager : END_CARD.subHeld;
  endEl.querySelector('.sub').textContent = END_CARD.sub + clause;
  dedInput.placeholder = END_CARD.ask;     // the authored ask (AMENDMENT A1)
  startTurn(END_LEAF, { sfx: false });     // the last unit already cued the page
}

/** The swap under a risen cover: the closing leaf is a leaf with no picture on
 *  it, and it is where the cast goes — they stood at their marks through the
 *  last unit, the reader turned the page, they are not on the new one. */
function enterEndLeaf() {
  S.page = END_PAGE;
  S.finished = true;
  /* a NEUTRAL engine act, fired at EVERY built set (not just the mounted one):
     the closing leaf has no picture, so whoever is standing on any stage goes
     off it. A set with no opinion simply ignores the verb. */
  stage.acts.push('bookOffstage');
  for (const rec of Object.values(stage.sets)) {
    try { rec.set.fire('bookOffstage', true); } catch (_) { /* sets may ignore */ }
  }
  margin.clear();
  margin.cue('');
  margin.progressEnd();
  leader.clear();
  cameo.hide();
  wrapEl.style.opacity = '0';
  document.body.dataset.unit = 'end-card';
  document.body.dataset.verb = '';
}

function stepEnding(dt) {
  const E = S.end;
  E.t += dt;
  E.k = S.turn.active ? S.turn.k : 0;
  E.card = ease.clamp01((E.t - TURN_IN) / END_CARD_IN);
  endEl.style.opacity = ease.inOut(E.card).toFixed(3);
  // the card has SETTLED: the dedication's ask rises (sim time, not wall time)
  if (E.card >= 1 && !S.ded.shown) {
    S.ded.shown = true;
    endEl.classList.add('settled');
  }
}

/* ---- THE SEEDED DEDICATION (byteab's identity-as-seed) -------------------- *
 * After the card settles an ask rises: END_CARD.ask ('Who read this?').
 * Typing regenerates, LIVE PER KEYSTROKE, a laurel-wreath sigil that is a
 * pure function of the name (app/sigil.js: FNV-1a -> mulberry32 -> every
 * leaf, berry and grain of jitter — no Date.now, no Math.random, by law).
 * Skippable: with nothing typed, a click anywhere else recedes the ask and
 * the card rests. NOTHING is stored — the name lives in the input and dies
 * with the page. The two strings are units.js's END_CARD.ask/.belonged
 * (AMENDMENT A1 in CONTENT-odyssey.md). */
function dedicate() {
  const name = dedInput.value.trim();
  S.ded.name = name;
  if (!name) {
    S.ded.hash = 0;
    dedEl.classList.remove('named');
    dedLine.textContent = '';
    sigilCanvas.getContext('2d').clearRect(0, 0, sigilCanvas.width, sigilCanvas.height);
    return;
  }
  S.ded.hash = drawSigil(sigilCanvas, name);
  dedEl.classList.add('named');
  dedLine.textContent = END_CARD.belonged + ' ' + name;
}
/** A harness jump off the end leaf puts the dedication back to rest. */
function dedicationReset() {
  S.ded.shown = false; S.ded.skipped = false;
  endEl.classList.remove('settled');
  dedEl.classList.remove('skipped');
  dedInput.value = '';
  dedicate();
}
dedInput.addEventListener('input', dedicate);
document.addEventListener('pointerdown', (ev) => {
  if (!S.ded.shown || S.ded.skipped) return;
  if (dedEl.contains(ev.target)) return;
  if (dedInput.value.trim()) return;              // a named reading stays up
  S.ded.skipped = true;
  dedEl.classList.add('skipped');
  dedInput.blur();
});

const blankLeaf = () => S.page === END_PAGE;

/* ---- the press-and-hold verb (and the RELEASE verb riding its machinery) - */
function stepHold(dt) {
  const u = S.unit, H = S.hold;
  if (!u || (u.verb !== 'hold' && u.verb !== 'release')) {
    if (H.k > 0) { H.k = Math.max(0, H.k - dt * 2); stage.setHold(H.k); audio.hold(H.k); }
    holdEl.classList.remove('on');
    return;
  }
  const per = 1 / Math.max(0.15, u.hold);
  if (H.pressing && !H.resolved) H.k = Math.min(1, H.k + dt * per);
  /* REST IS ALLOWED (`rest: true` — the two big holds): a released hold KEEPS
     the progress it earned — no decay, no reset — and resumes on re-press.
     Everything the k carries (the bowl's fill, the ember glow, the ring's
     arc) persists with it, because they are all functions of this k.
     A released RELEASE verb without `rest` (myname) is a stray click
     letting its drawn breath subside — that one decays; the bowl's release
     carries `rest: true` and BANKS its fill between presses (A7). */
  else if (!H.resolved && !u.rest) H.k = Math.max(0, H.k - dt * per * HOLD_DECAY);

  /* full k RESOLVES a hold; a RELEASE resolves on the pointerup instead —
     k >= 1 there means only "the threshold is banked, let go when ready" */
  if (u.verb === 'hold' && !H.resolved && H.k >= 1) resolveHold(u);
  const shown = H.resolved ? 1 : H.k;
  stage.setHold(shown);
  // "the watermark plate resolves IN PROPORTION to the reader's hold" — so the
  // reveal is driven every frame BY the hold, not switched on when it completes
  if (u.reveal) stage.setReveal(u.reveal, shown);
  audio.hold(H.resolved ? 0 : H.k);

  // the ring stands ON the note in his hand, which is the thing being held up
  const a = stage.holdAnchor();
  const p = stage.toScreen(a[0], a[1]);
  holdEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  holdEl.classList.toggle('on', !H.resolved || H.k > 0);
  holdArc.setAttribute('stroke-dashoffset', String(ARC_LEN * (1 - shown)));
}

/* ---- the target gates: eight of them, four per half of the book --------- */
function stepTarget(t, dt) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved || S.turn.active || S.end.active) {
    targetEl.classList.remove('on', 'miss');
    return;
  }
  /* THE RING ARMS WITH THE SET (ux honesty, 2026-08-17): a gate unit can
     enter before its target exists on stage — the sword's mark is a walk
     away when the unit arrives — and the shipped ring stood lit over the
     walk, promising a click the set would refuse. The SET owns liveness
     (targetLive), so the ring is dark until the set says the target is
     there to be clicked. */
  if (!stage.targetLive(u.target)) {
    targetEl.classList.remove('on', 'miss');
    return;
  }
  const a = stage.targetPlate(u.target);
  const p = stage.toScreen(a[0], a[1]);
  targetEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  targetEl.classList.add('on');
  S.gate.missT += dt;
  const breathe = 0.5 + 0.5 * Math.sin(t * 2.35);
  const kick = Math.max(0, 1 - S.gate.missT / 0.45);
  targetRing.setAttribute('r', (19 + 5.5 * breathe + 7 * kick).toFixed(2));
  targetRing.setAttribute('stroke-width', (2.0 + 0.9 * breathe + 1.4 * kick).toFixed(2));
  targetEl.classList.toggle('miss', kick > 0.02);
}

function hitsTarget(name, px, py) {
  /* NOT LIVE = NOT HITTABLE (ux honesty, 2026-08-17). The sets already
     refuse targetHit on a dead target, but the 48 px screen-slack fallback
     below did not ask — so a click on the anchor point resolved the sword
     gate while Ulysses was still walking to it. The liveness check guards
     BOTH paths now. */
  if (!stage.targetLive(name)) return false;
  if (stage.targetHit(name, px, py)) return true;
  const a = stage.targetPlate(name);
  const p = stage.toScreen(a[0], a[1]);
  return Math.hypot(p.x - px, p.y - py) <= TARGET_RADIUS_PX;
}

function resolveGate(u, { soft = false } = {}) {
  S.gate.resolved = true;
  S.lastAdv = clock.t;   // a resolution IS an advance for the tap debounce —
                         // the clock-held path below never reaches advance()
  /* HESITATION MEMORY (AMENDMENT A2): the defy gate armed when its unit was
     entered (S.unitT is that unit's own story clock, cover time excluded), and
     it resolves HERE — reader's click or the 30 s soft-fail alike. The number
     persists on the story state; only the closing card ever reads it. */
  if (u.key === 'defy') S.hesit = +S.unitT.toFixed(3);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (soft) S.softFails++;
  if (u.endsBook) { S.gate.lastHit = 'end'; audio.cue('click'); startEnding(); return true; }
  /* THE THROW HAS NO TEXT (sec 2.4). The window gate hands the frame to the
     beat's own clock: the margin is cleared and left empty, and the next unit
     arrives when the clock says so, not when the gate resolves. */
  const next = UNITS[S.i + 1];
  if (next && next.verb === 'clock') {
    margin.clear();
    margin.cue('');
    S.clockHeld = true;
    return true;
  }
  advance();
  return true;
}

function tryGate(px, py) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved) return false;
  if (hitsTarget(u.target, px, py)) return resolveGate(u);
  S.gate.misses++; S.nudges++; S.gate.missT = 0;
  margin.nudge();
  return false;
}

/* ---- THE RELEASE VERB (AMENDMENT 2026-08-16, ody-vi-07 'myname') ---------- *
 * The press is the BREATH, the release is the BEAT. Press-and-hold draws
 * breath (the set swells on the held k — sea.js's taunt cut); LETTING GO past
 * the unit's threshold (`hold` seconds of k) fires the shout — gateAct snaps
 * the pose, gateSfx rings the name — and the story advances ON the release
 * frame, from pressUp itself, never from a later sim step. A press shorter
 * than the threshold is a stray click: it still reads as a beat (the swell
 * subsides in stepHold) and the page holds. Soft-fail auto-releases at 30 s
 * (sec 2.6), like every other gate. */
/** THE HOLD VERB'S RESOLUTION, one path for both ways it can happen.
 *  The reader's press drives k to 1 in stepHold — that is the natural way —
 *  and the 30 s soft-fail (sec 2.6) is the other. The soft way was the
 *  DEADLOCK the review caught: the generic soft-fail branch called advance()
 *  every step, and advance() refuses a hold that has not resolved, so a
 *  reader who never pressed was walled forever on `lookhere`/`embers` while
 *  softFails counted up each sim step. No gate is a wall: the soft-fail
 *  RESOLVES the hold — fills k to 1 THROUGH stage.setHold (the carrier
 *  reaches full, so the embers' blinding clock latches exactly as a real
 *  press latches it — without that, `auger`'s verb:'clock' unit never
 *  arrives and the wall just moves one unit down; since A7 the bowl is a
 *  RELEASE verb and its soft path is resolveRelease -> the bowl-pour act),
 *  fires the whole resolution path (reveal, cue, gateAct/gateSfx if the unit
 *  carries them), exactly once — the resolved flag is the guard — and then
 *  advances. */
function resolveHold(u, { soft = false } = {}) {
  if (S.hold.resolved) return false;
  S.hold.resolved = true;
  if (soft) {
    S.hold.pressing = false;
    S.hold.k = 1;
    stage.setHold(1);            // the carrier reaches full: pour-1 / the drive
  }
  stage.setReveal(u.reveal || null, 1);
  audio.cue('reveal');
  margin.cue(CUE_DEFAULT.click);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (soft) { S.softFails++; advance(); }
  return true;
}

function resolveRelease(u, { soft = false } = {}) {
  if (S.hold.resolved) return false;
  S.hold.resolved = true;
  S.hold.pressing = false;
  S.hold.k = 0;
  stage.setHold(0);                 // the breath lets go: the swell SNAPS back
  audio.hold(0);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (soft) S.softFails++;
  advance();
  return true;
}

/* ---- one fixed sim step -------------------------------------------------- */
function step(dt) {
  /* STORY TIME, not wall time and not even sim time: the seconds the book has
     spent waiting for a leaf's bytes are subtracted out, so every ambient in
     every SET is a pure function of a clock that only runs while there is
     something to see. See stepTurn(). */
  if (S.turn.active && !S.turn.ready) { S.stall += dt; stepTurn(dt); return; }
  const t = clock.t - S.stall;
  /* A UNIT DOES NOT SPEND ITS DWELL UNDER THE COVER — [F10].
   *
   * The leaf swaps at TURN_IN and the cover then takes TURN_OUT (0.72 s) to
   * fade off the new page, so a unit entered under a raised cover was already
   * 0.9 s into its dwell by the time the reader could see it. On a 3.4 s chapter
   * heading that is a quarter of the frame, and on the Beat VII heading — which
   * the Beat VI clock hands over at t+19.8 and which the review therefore caught
   * at 2% luminance — it is why "The Woman" read as 3.4 s of nothing. Nothing
   * the reader can see happens under a raised cover, so nothing ages under one:
   * the same rule stall already applies to story time, applied to the unit's own
   * clock. (Beat I is unaffected: its single page turn is the last thing that
   * happens in the beat.) */
  if (!S.turn.active) S.unitT += dt;
  audio.setTime(t);
  if (S.turn.active) stepTurn(dt);
  if (S.end.active) stepEnding(dt);
  stepHold(dt);
  stepTarget(t, dt);

  const u = S.unit;
  const quiet = !S.turn.active && !S.end.active;

  if (u && u.verb === 'auto' && quiet && S.unitT >= (u.dwell || 2)) {
    advance();
  }

  /* THE BEAT VI CLOCK. Five units arrive on the beat's own timeline, and the
     page turns on it too — 19.8 s after the reader's throw. */
  if (quiet && u) {
    const next = UNITS[S.i + 1];
    if (next && next.verb === 'clock' && clockDue(next) &&
        (S.clockHeld || u.verb === 'clock')) {
      if (UNITS[S.i + 1].page !== u.page) startTurn(S.i + 1); else enterUnit(S.i + 1);
      S.clockHeld = u.verb !== 'clock' ? false : S.clockHeld;
    } else if (u.verb === 'clock' && u.turnAt !== undefined) {
      const ct = stage.clockT();
      if (ct !== null && ct >= u.turnAt && S.i + 1 < UNITS.length) {
        if (UNITS[S.i + 1].page !== u.page) startTurn(S.i + 1); else enterUnit(S.i + 1);
      }
    }
  }

  // a latched click spends itself the moment its block lifts
  if (S.latch && quiet && canAdvance()) { S.latch = false; advance(); }

  /* SOFT-FAIL (sec 2.6): no gate is a wall, and no line is either. Beat I is
     excluded — it shipped without this and stays byte-identical — EXCEPT its
     heading (AMENDMENT A6): headings are ours, the opening head now WAITS
     for the reader's first click, and this clause is what carries a reader
     who never gives one. `u.head` marks the five head units; only Beat I's
     gains anything here (beats 2+ were already covered). */
  if (quiet && u && ((u.beat || 1) >= 2 || u.head)) {
    const limit = u.verb === 'target' ? SOFT_FAIL : Math.min(SOFT_FAIL, u.dwell || SOFT_FAIL);
    if (S.unitT >= limit) {
      if (u.verb === 'target' && !S.gate.resolved) resolveGate(u, { soft: true });
      else if (u.verb === 'release' && !S.hold.resolved) resolveRelease(u, { soft: true });
      /* the HOLD verb resolves the same soft way the release does — through
         its own resolution path, never through the generic advance() below,
         which refuses an unresolved hold and would loop forever (the
         lookhere/embers deadlock). Both resolvers guard on hold.resolved, so
         the soft resolution fires exactly once. */
      else if (u.verb === 'hold' && !S.hold.resolved) resolveHold(u, { soft: true });
      else if (u.verb !== 'clock' && u.verb !== 'auto') { S.softFails++; advance(); }
    }
  }

  refreshFocus();
  stage.step(t, dt);
  stepLeader();
  S.renders++;
}

/** The hairline from the live speech to the speaker's head. */
const EMBODIED = new Set(['ULYSSES', 'POLYPHEMUS', 'A CYCLOPS', 'THE MEN']);
function stepLeader() {
  const u = S.unit;
  const who = u && u.speaker;
  if (!u || S.end.active || S.turn.active || !EMBODIED.has(who)) {
    leader.clear(); return;
  }
  if (stage.state.dim > 0.12) { leader.clear(); return; }   // a plate owns the frame
  const head = stage.headPlate(who);
  if (!head) { leader.clear(); return; }
  const p = stage.toScreen(head[0], head[1]);
  const r = stage.rect || stageEl.getBoundingClientRect();
  if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) { leader.clear(); return; }
  const portrait = MQ_PORTRAIT.matches;
  leader.draw(margin.anchorPoint(portrait), p, portrait);
}

/* ---- the live loop (wall clock ONLY enters here) ------------------------- */
function frame(nowMs) {
  requestAnimationFrame(frame);
  if (clock.harness) return;
  clock.pump(nowMs, step);
}

/* ---- input: every path funnels through the calls the hooks use ----------- */
let gestureSeen = false;
function firstGesture() {
  if (gestureSeen) return;
  gestureSeen = true;
  audio.unlock();
  if (S.unit && S.unit.bed) audio.bed(S.unit.bed);
}

const ptr = { x: 0, y: 0, dnX: null, dnY: null };

function pressDown(ev) {
  firstGesture();
  if (ev && ev.clientX !== undefined) {
    ptr.x = ev.clientX; ptr.y = ev.clientY;
    ptr.dnX = ev.clientX; ptr.dnY = ev.clientY;   // the swipe rejection's anchor
  } else {
    ptr.dnX = null; ptr.dnY = null;               // keyboard/harness: no travel
  }
  if (S.turn.active || S.end.active) return;
  if (S.unit && (S.unit.verb === 'hold' || S.unit.verb === 'release') && !S.hold.resolved) {
    S.hold.pressing = true; S.hold.wasPress = true;
  } else {
    S.hold.wasPress = false;
  }
}

function pressUp(ev) {
  const wasHoldPress = S.hold.wasPress;
  S.hold.pressing = false;
  S.hold.wasPress = false;
  if (S.end.active) return;
  if (wasHoldPress) {
    /* the release verb RESOLVES on the pointerup — this frame, not the next
       sim step — when the drawn breath crossed the threshold (k banked at 1).
       Under it, nothing: the stray click's swell subsides and the page holds
       (and on a `rest: true` release — the bowl — the banked k persists). */
    if (S.unit && S.unit.verb === 'release' && !S.hold.resolved && S.hold.k >= 1) {
      resolveRelease(S.unit);
    }
    return;
  }
  /* SWIPE REJECTION (ux honesty, 2026-08-17): a pointerup that travelled
     more than DRAG_REJECT_PX from its own pointerdown is a drag or a scroll
     attempt, not a tap — it neither advances nor counts a gate miss.
     Keyboard and harness paths carry no travel and are exempt. */
  if (ev && ev.clientX !== undefined && ptr.dnX !== null &&
      Math.hypot(ev.clientX - ptr.dnX, ev.clientY - ptr.dnY) > DRAG_REJECT_PX) {
    return;
  }
  /* TAP DEBOUNCE (ux honesty, 2026-08-17): a tap within TAP_DEBOUNCE_S of
     the last advance is the same tap arriving twice — a double-tap must
     spend ONE unit, and the sim clock (not the wall) is what measures it. */
  if (clock.t - S.lastAdv < TAP_DEBOUNCE_S) return;
  if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) { tryGate(ptr.x, ptr.y); return; }
  advance();
}

document.addEventListener('pointerdown', pressDown);
window.addEventListener('pointerup', pressUp);
window.addEventListener('pointercancel', () => { S.hold.pressing = false; S.hold.wasPress = false; });
window.addEventListener('keydown', (e) => {
  if (e.target === dedInput) return;   // the dedication's keys are its own
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault();
    if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) {
      const a = stage.targetPlate(S.unit.target);
      const p = stage.toScreen(a[0], a[1]);
      ptr.x = p.x; ptr.y = p.y;
    }
    pressDown();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.target === dedInput) return;   // the dedication's keys are its own
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault(); pressUp();
  }
});

/* ---- boot: leaf one's every byte decoded before __ready ----------------- *
 * The book does NOT decode four sets to open on one. What __ready promises is
 * what it always promised — that nothing the CURRENT leaf can reveal is still
 * on the wire — and the page turn keeps that promise for every later leaf by
 * holding its cover up until the incoming set is decoded.                    */
async function boot() {
  const first = SET_OF_PAGE[PAGES[0]] || 'shore';
  const [rec, snd, cameos] = await Promise.all([
    stage.ensure(first), audio.preload(), cameo.preload(),
  ]);
  stage.mount(first);
  if (rec.missing.length) errors.push({ kind: 'assets', msg: 'undecodable: ' + rec.missing.join(', ') });
  if (snd.missing.length) errors.push({ kind: 'audio', msg: 'undecodable: ' + snd.missing.join(', ') });
  layout();
  enterUnit(0, { silent: true });
  audio.bed(UNITS[0].bed || null, 0.01);
  margin.hint(true, FIRST_HINT);
  step(0);
  S.ready = true;
  window.__ready = true;
  document.body.dataset.ready = '1';
  requestAnimationFrame(frame);
}
boot();

/* ---------------------------------------------------------------- *
 * DEV HOOKS — the review harness's entire contract with the app.
 *   window.__x      READ-ONLY, always present.
 *   harnessOnly.__x MUTATING; attached under ?harness=1 only.
 * ---------------------------------------------------------------- */
const harnessOnly = {};

const unitView = (u, i) => (!u ? null : {
  i, id: u.id, key: u.key, verb: u.verb, target: u.target || null,
  speaker: u.speaker || '', text: u.text || '', cue: cueFor(u),
  focus: u.focus, page: u.page, beat: u.beat || 1, set: setOf(u),
  fact: u.fact || null, wait: u.wait || null, seg: u.seg || null,
  at: u.at === undefined ? null : u.at,
  endsBeat: !!u.endsBeat, endsBook: !!u.endsBook,
  cameo: u.cameo || null, cap: u.cap || null, act: u.act || null,
  shown: margin.lastText, blocks: margin.text(),
});

window.__unit = () => unitView(S.unit, S.i);
window.__units = () => UNITS.map((u, i) => unitView(u, i));
window.__unitByKey = (k) => unitByKey(k);
window.__beats = () => BEATS.map((b) => ({ ...b }));

/**
 * Jump. It is ASYNC now, because a jump can land on a leaf whose SET has never
 * been built — and a set that is not decoded cannot be painted, so the jump
 * has to wait for it exactly the way a page turn does.
 */
harnessOnly.__gotoUnit = async (n) => {
  const idx = typeof n === 'string' ? UNITS.findIndex((u) => u.key === n || u.id === n) : n;
  if (!(idx >= 0)) return null;
  const want = setOf(UNITS[idx]);
  await stage.ensure(want);
  // replay every unit's act so the world arrives in the state the story built.
  // The reset is what makes that true in BOTH directions: replaying forward
  // from unit 0 cannot undo what a later unit switched on, so the world has to
  // be put back to how unit 0 found it before the replay starts.
  stage.reset();
  stage.mount(want);
  margin.clear();
  S.turn.active = false; S.end.active = false; S.finished = false;
  S.latch = false; S.clockHeld = false;
  dedicationReset();
  endEl.style.opacity = '0'; coverEl.style.opacity = '0';
  wrapEl.style.transform = 'none';
  /* Only this leaf's own units are replayed: an act belonging to another SET
     would be fired at a set that has never heard of it. The page turn is the
     boundary the story itself draws, so it is the right one to replay from. */
  const from = UNITS.findIndex((u) => u.page === UNITS[idx].page);
  for (let j = from; j <= idx; j++) enterUnit(j, { silent: j !== idx });
  return window.__unit();
};

harnessOnly.__click = () => { pressDown(); pressUp(); return window.__unit(); };

harnessOnly.__gateClick = () => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a gate' };
  const a = stage.targetPlate(u.target);
  const p = stage.toScreen(a[0], a[1]);
  ptr.x = p.x; ptr.y = p.y;
  const before = S.i;
  pressDown(); pressUp();
  /* A resolved gate ADVANCES, and entering the next unit clears gate.resolved —
     so the proof that the gate fired is that the reader MOVED, not the flag.
     "Moved" has three shapes in this book and all three count:
       the index changed              — an ordinary gate inside a leaf
       a page turn began              — the door gate, which turns the leaf, and
                                        the index does not change until the swap
                                        happens under the risen cover
       the frame was handed to a clock — the window gate (sec 6.6), whose next
                                        unit arrives on the beat's own timeline */
  return { ok: S.i !== before || S.end.active || S.clockHeld || S.turn.active,
           from: before, to: S.i, target: u.target, endsBeat: !!u.endsBeat,
           held: S.clockHeld, turning: S.turn.active,
           at: { x: +p.x.toFixed(1), y: +p.y.toFixed(1) } };
};

/** A deliberate miss: the gate must NOT resolve and must NOT advance. */
harnessOnly.__gateMiss = (dx = 190, dy = 120) => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a gate' };
  const a = stage.targetPlate(u.target);
  const p = stage.toScreen(a[0], a[1]);
  ptr.x = p.x + dx; ptr.y = p.y + dy;
  const before = S.i, n = S.gate.misses;
  pressDown(); pressUp();
  return { advanced: S.i !== before, resolved: S.gate.resolved, misses: S.gate.misses - n };
};

/** Type a dedication the way the input event would deliver it. */
harnessOnly.__dedicate = (text) => {
  dedInput.value = String(text == null ? '' : text);
  dedInput.dispatchEvent(new Event('input', { bubbles: true }));
  return { ...S.ded, png: sigilCanvas.toDataURL('image/png') };
};

harnessOnly.__holdStart = () => { pressDown(); return S.hold.k; };
harnessOnly.__holdEnd = () => { pressUp(); return S.hold.k; };

harnessOnly.__setTime = (t) => {
  const first = !clock.harness;
  const n = clock.setTime(t, step);
  if (first) document.documentElement.classList.add('harness');
  return { t: clock.t, steps: n, frame: clock.frame };
};
harnessOnly.__advance = (dt) => harnessOnly.__setTime(clock.t + Math.max(0, dt || 0));
harnessOnly.__renderNow = () => { step(0); return S.renders; };
harnessOnly.__mute = (m) => { audio.setMuted(m !== false); return audio.snapshot(); };
harnessOnly.__audio = () => audio.snapshot();
harnessOnly.__ensureAll = () => stage.preloadAll();
harnessOnly.__refs = { stage, audio, margin, clock, S, UNITS };

window.__state = () => ({
  ready: S.ready, t: +(clock.t - S.stall).toFixed(4), wall: +clock.t.toFixed(4),
  stall: +S.stall.toFixed(4), frame: clock.frame, harness: clock.harness,
  i: S.i, total: UNITS.length, unit: window.__unit(), unitT: +S.unitT.toFixed(3),
  page: S.page, pages: PAGES.length, finished: S.finished, blankLeaf: blankLeaf(),
  beat: (S.unit && S.unit.beat) || 1, set: stage.activeName,
  advances: S.advances, nudges: S.nudges, visited: S.visited.size, renders: S.renders,
  blocked: blockedBy(S.unit), latch: S.latch, latched: S.latched, softFails: S.softFails,
  clock: { t: stage.clockT(), held: S.clockHeld },
  hold: { pressing: S.hold.pressing, k: +S.hold.k.toFixed(3), resolved: S.hold.resolved,
          required: (S.unit && S.unit.hold) || null },
  gate: { target: (S.unit && S.unit.target) || null, resolved: S.gate.resolved,
          misses: S.gate.misses, live: S.unit && S.unit.target
            ? stage.targetLive(S.unit.target) : null },
  turn: { active: S.turn.active, k: +S.turn.k.toFixed(3), to: S.turn.to,
          ready: S.turn.ready, waited: +S.turn.waited.toFixed(3),
          swapped: S.turn.swapped },
  end: { active: S.end.active, k: +S.end.k.toFixed(3), card: +S.end.card.toFixed(3) },
  hesit: S.hesit,   // AMENDMENT A2 — the defy hesitation, story seconds
  ded: { shown: S.ded.shown, skipped: S.ded.skipped, name: S.ded.name,
         hash: S.ded.hash, named: dedEl.classList.contains('named') },
  view: { w: +view.w.toFixed(1), h: +view.h.toFixed(1), portrait: view.portrait,
          fit: +stage.F.toFixed(4) },
  viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
  targetScreen: (() => {
    const name = S.unit && S.unit.target;
    if (!name) return null;
    const a = stage.targetPlate(name);
    const p = stage.toScreen(a[0], a[1]);
    return { name, plate: [Math.round(a[0]), Math.round(a[1])],
             x: +p.x.toFixed(1), y: +p.y.toFixed(1), live: stage.targetLive(name) };
  })(),
  stage: stage.snapshot(),
  cameo: cameo.snapshot(),
  audio: { bed: audio.bedId, cues: audio.log.length, muted: audio.muted },
  errors: errors.slice(),
});

window.__errors = () => errors.slice();
if (HARNESS_BOOT) Object.assign(window, harnessOnly);
