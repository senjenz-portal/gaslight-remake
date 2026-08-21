/**
 * main3d.js — the reader's machine over the THREE.JS STAGE: the same 81
 * units, the same text, the same verbs (app/units.js IS the law, imported
 * unchanged), the same margin/cue/cameo presentation (app/margin.js reused
 * wholesale), the same unit walk main.js runs over the painted plates —
 * with the stage swapped for a full-3D canvas that mounts one procedural
 * SET per leaf: shore3d (Beat I) · cave3d (Beats II-V, the demo3d diorama)
 * · sea3d (Beat VI).
 *
 * WHAT IS THE 2D APP'S, UNCHANGED IN GRAMMAR:
 *   units/beats/verbs/gates/page-turn/soft-fail/latch/tap-honesty — the unit
 *   walk below is main.js's own machine with the painted-stage-only rails
 *   (shots, heroclips, reveals, dedication) removed, because this stage has
 *   none of those plates.
 *
 * WHAT IS NEW CODE (so no amendment conflicts):
 *   THE SPOKEN BOOK — the 76 mastered lines (assets/voice/, app/voice.js's
 *   manifest) play per unit through voice3d.js and duck the ambient bed
 *   −6 dB while sounding.
 *
 * LAWS: deterministic (SimClock fixed steps; the stage is a pure function of
 * story time), posture law and obstacle law live in cast3d/stage3d, and the
 * harness hooks at the foot are the smoke's whole contract (?harness=1).
 */
import { UNITS, BEATS, beatOf, END_CARD, END_PAGE, PAGES, SET_OF_PAGE,
         CUE_DEFAULT, FIRST_HINT, validateUnits, unitByKey } from '../../app/units.js';
import { Margin, Cameo, Leader } from '../../app/margin.js';
import { SimClock } from '../../app/clock.js';
import { AudioManager } from '../../app/audio.js';
import { VOICE, VOICE_BASE } from '../../app/voice.js';
import { drawSigil } from '../../app/sigil.js';
import { Stage3D } from './stage3d.js';
import { Voice3D } from './voice3d.js';
import { huePeaks, hueDist } from './cast3d.js';

const TURN_IN = 0.55;
const TURN_HOLD = 0.18;
const TURN_OUT = 0.72;
const END_CARD_IN = 0.55;
const HOLD_DECAY = 0.75;
const TARGET_RADIUS_PX = 48;
const SOFT_FAIL = 30;
const TAP_DEBOUNCE_S = 0.25;
const DRAG_REJECT_PX = 24;
const HESIT_EAGER_S = 4;

/* LEAN-BACK (AMENDMENT A8's second half): the narration's own clock spends
 * the reader's CLICK for them. It never spends a VERB — a target, a hold, a
 * release and a clock unit all still wait for the hand, so "all gates by
 * verbs" survives the mode. The wait is the MASTERED duration out of
 * app/voice.js plus a breath; the media element's currentTime is never read
 * (determinism law), and an unvoiced leaf (our headings) gets LEAN_MIN. */
const LEAN_TAIL = 0.9;
const LEAN_MIN = 2.6;

const errors = [];
window.addEventListener('error', (e) => errors.push({ kind: 'error', msg: String(e.message) }));
window.addEventListener('unhandledrejection', (e) =>
  errors.push({ kind: 'rejection', msg: String(e.reason && e.reason.message || e.reason) }));

const CAMEO_URLS = {
  ulysses: '../assets/cameo/ulysses.jpg',
  polyphemus: '../assets/cameo/polyphemus.jpg',
  'a-cyclops': '../assets/cameo/cyclops.jpg',
  'the-men': '../assets/cameo/men.jpg',
};

/* the wine pantomime rides the two autos after G3 (ledger holds:3) */
const EXTRA_FX = {
  besokind: [['pour', 1.6]],
  thrice: [['pour', 1.2]],
};

/* THE 3D STAGE'S OWN PANTOMIME RAIL — units.js is the law and stays
 * byte-identical, so the staging this canvas needs beyond the book's own
 * act/seg tokens is keyed here by unit key and fired exactly like an act
 * (silent on replay). Beat IV's stake, Beat V's stream, Beat VI's throws. */
const EXTRA_ACTS = {
  /* C2 — THE SEATED GIANT. The ledger's cave mark table gives `giant-seat` to
   * ii-05/07/08 and iii-08/09; the meal units (ii-10, iii-01, iii-07) play at
   * his knee. units.js only names the act where the STAGING column changed, so
   * the rail re-asserts the seat on every unit the ledger puts him at the mark
   * — the call is idempotent (same rig, same mark, same yaw). */
  pitiless: ['giant-seat'],
  shipfast: ['giant-seat'],
  suppertwo: ['giant-seat'],
  lookhere: ['giant-seat'],
  besokind: ['giant-seat'],
  thrice: ['giant-seat'],
  embers: ['stake-to-embers'],
  glowing: ['stake-draw'],
  auger: ['stake-drive'],
  hiss: ['blind-hiss'],
  fright: ['fright-scatter'],
  threetoaman: ['trios-under'],
  dawn5: ['flock-stream'],
  rock1: ['rock-one'],
  twiceasfar: ['double-distance'],
  heard: ['rock-two'],
};

const QS = new URLSearchParams(location.search);
const HARNESS_BOOT = QS.get('harness') === '1';
/* C3 — the path / guide / control overlays are DEBUG ONLY. The production
   render carries none of them; ?debug=1 puts them back. */
const DEBUG_OVERLAYS = QS.get('debug') === '1';
if (DEBUG_OVERLAYS) document.documentElement.classList.add('debug');

const clock = new SimClock();
if (HARNESS_BOOT) { clock.harness = true; document.documentElement.classList.add('harness'); }

const stageEl = document.getElementById('stage');
const canvas = document.getElementById('stage3d');
const audio = new AudioManager('../assets/audio/');
const stage = new Stage3D(canvas, { errors, audio });
stage.audio = audio;
const voice = new Voice3D(audio, VOICE, VOICE_BASE.replace('./assets/', '../assets/'));
const margin = new Margin(document);
const cameo = new Cameo(document, CAMEO_URLS);
const leader = new Leader(document);
const coverEl = document.getElementById('cover');
const holdEl = document.getElementById('hold');
const holdArc = holdEl.querySelector('.arc');
const targetEl = document.getElementById('target');
const targetRing = targetEl.querySelector('.ring');
const endEl = document.getElementById('endcard');
const wrapEl = document.getElementById('stagewrap');
const leanBtn = document.getElementById('lean');
const ARC_LEN = 2 * Math.PI * 33;

/* ---- layout: the 1408:768 canvas fitted, margin under it in portrait ---- */
const MQ_PORTRAIT = window.matchMedia('(max-aspect-ratio: 9/10)');
const view = { portrait: MQ_PORTRAIT.matches, w: 0, h: 0 };
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  view.portrait = MQ_PORTRAIT.matches;
  const ar = 1408 / 768;
  let availW, availH;
  if (view.portrait) { availW = W * 0.95; availH = H * 0.56; }
  else { availW = (W - W * 0.32) * 0.90; availH = H * 0.80; }
  let w = Math.min(availW, availH * ar);
  let h = w / ar;
  stageEl.style.width = w.toFixed(1) + 'px';
  stageEl.style.height = h.toFixed(1) + 'px';
  view.w = w; view.h = h;
  if (view.portrait) {
    document.documentElement.style.setProperty('--stageh', (h + H * 0.03).toFixed(0) + 'px');
    document.documentElement.style.setProperty('--margintop', (h + H * 0.045).toFixed(0) + 'px');
  }
  stage.setView(1408, 768);
  stage.layout();
  stage.applyCam();
}
window.addEventListener('resize', () => { layout(); });
MQ_PORTRAIT.addEventListener('change', () => { layout(); });
layout();

/* ---- state (main.js's own shape) ---- */
const S = {
  i: -1, unit: null, unitT: 0, page: PAGES[0] || 1,
  hold: { pressing: false, k: 0, resolved: false, wasPress: false },
  gate: { resolved: false, misses: 0, lastHit: null, missT: 99 },
  turn: { active: false, t: 0, to: -1, swapped: false, k: 0, ready: true, waited: 0 },
  end: { active: false, t: 0, k: 0, card: 0 },
  finished: false, advances: 0, nudges: 0, visited: new Set(),
  ready: false, renders: 0, hinted: true,
  latch: false, latched: 0, softFails: 0, clockHeld: false, stall: 0,
  lastAdv: -1e9,
  hesit: null,
  ded: { shown: false, skipped: false, name: '', hash: 0 },
  lean: QS.get('lean') === '1',      /* lean-back: the narration advances */
  narr: 0,                           /* this unit's mastered line length */
  leanAdvances: 0,
};

const unitErrors = validateUnits(UNITS);
if (unitErrors.length) errors.push({ kind: 'units', msg: unitErrors.join(' | ') });

const ease = {
  clamp01: (v) => (v < 0 ? 0 : v > 1 ? 1 : v),
  inOut: (k) => 0.5 - 0.5 * Math.cos(Math.PI * (k < 0 ? 0 : k > 1 ? 1 : k)),
};
const setOf = (u) => (u && u.set) || 'shore';

/* ---- entering a unit ---- */
function enterUnit(n, { silent = false } = {}) {
  const idx = Math.max(0, Math.min(UNITS.length - 1, n | 0));
  const u = UNITS[idx];
  S.i = idx; S.unit = u; S.unitT = 0; S.page = u.page;
  S.narr = (VOICE[u.key] && VOICE[u.key].dur) || 0;
  S.visited.add(u.id);
  S.finished = false;
  S.latch = false;
  S.clockHeld = false;

  S.hold.pressing = false; S.hold.k = 0; S.hold.resolved = false; S.hold.wasPress = false;
  S.gate.resolved = false; S.gate.lastHit = null; S.gate.missT = 99;
  stage.setHold(0);
  audio.hold(0);

  if (stage.activeName !== setOf(u) && stage.decoded(setOf(u))) stage.mount(setOf(u));

  margin.show(u);
  margin.cue(cueFor(u));
  progress(idx);
  applyCameo(idx);
  wrapEl.style.opacity = '1';
  refreshFocus(false);

  stage.beat = u.beat || 1;          /* cave-predawn is beat-aware (leaf 3 vs 4) */
  if (u.act) stage.fire(u.act, silent);
  for (const act of EXTRA_ACTS[u.key] || []) stage.fire(act, silent);
  if (silent && u.gateAct) stage.fire(u.gateAct, true);
  if (u.seg) stage.startSeg(u.seg, u.segDur || 6.0, silent);
  if (!silent) {
    if (u.bed) audio.bed(u.bed);
    if (u.sfx) audio.cue(u.sfx);
    /* THE SPOKEN BOOK: the unit's mastered line, ducking the bed */
    voice.play(u.key, clock.t - S.stall);
    const next = UNITS[idx + 1];
    if (next) voice.prefetch(next.key);
    for (const [id, d] of (EXTRA_FX[u.key] || [])) stage.fx(id, d);
  }
  document.body.dataset.unit = u.id;
  document.body.dataset.verb = u.verb;
  document.body.dataset.gate = u.target || '';
  document.body.dataset.set = setOf(u);
  document.body.dataset.beat = String(u.beat || 1);
}

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

/** when a lean-back leaf is due to turn itself (sim seconds into the unit) */
function leanDue(u) {
  const dur = (VOICE[u.key] && VOICE[u.key].dur) || 0;
  return Math.max(u.dwell || 0, dur > 0 ? dur + LEAN_TAIL : LEAN_MIN);
}

function setLean(on) {
  S.lean = !!on;
  document.body.classList.toggle('lean', S.lean);
  if (leanBtn) {
    leanBtn.setAttribute('aria-pressed', S.lean ? 'true' : 'false');
    leanBtn.textContent = S.lean ? 'Lean back · on' : 'Lean back';
  }
  return S.lean;
}

function cueFor(u) {
  if (!u) return '';
  if (u.verb === 'hold' && S.hold.resolved) return CUE_DEFAULT.click;
  if (u.cue !== undefined) return u.cue;
  return CUE_DEFAULT[u.verb] || '';
}

/* ---- advancing (main.js's own rails) ---- */
function blockedBy(u) {
  if (!u) return null;
  if (u.wait && !stage.waitDone(u.wait)) return 'wait:' + u.wait;
  if (u.seg && u.segHold && S.unitT < (u.segDur || 6.0)) return 'seg:' + u.seg;
  return null;
}

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
    if (S.unit && (blockedBy(S.unit) || (UNITS[S.i + 1] && UNITS[S.i + 1].verb === 'clock'))) {
      if (!S.latch) { S.latch = true; S.latched++; }
    }
    return false;
  }
  const next = S.i + 1;
  S.lastAdv = clock.t;
  audio.cue('click');
  if (next >= UNITS.length || S.unit.endsBook) { startEnding(); return false; }
  S.advances++;
  if (S.hinted) { S.hinted = false; margin.hint(false); }
  if (UNITS[next].page !== S.unit.page) { startTurn(next); return true; }
  enterUnit(next);
  return true;
}

const END_LEAF = 'end';

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
    S.turn.ready = true;
  }
  if (sfx) audio.cue('page');
  margin.cue('');
}

function stepTurn(dt) {
  const T = S.turn;
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
  wrapEl.style.transform = `translateX(${(-T.k * view.w * 0.06).toFixed(2)}px)`;
  if (!T.swapped && T.t >= TURN_IN && T.ready) {
    T.swapped = true;
    if (T.to === END_LEAF) {
      enterEndLeaf();
    } else {
      const want = SET_OF_PAGE[UNITS[T.to].page];
      if (want && stage.activeName !== want) stage.mount(want);
      enterUnit(T.to);
      refreshFocus(true);              /* a fresh leaf opens on its own frame */
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
  const clause = S.hesit == null ? ''
    : S.hesit < HESIT_EAGER_S ? END_CARD.subEager : END_CARD.subHeld;
  endEl.querySelector('.sub').textContent = END_CARD.sub + clause;
  dedInput.placeholder = END_CARD.ask;     /* the authored ask (AMENDMENT A1) */
  startTurn(END_LEAF, { sfx: false });
}

function enterEndLeaf() {
  S.page = END_PAGE;
  S.finished = true;
  voice.stop();
  stage.acts.push('bookOffstage');
  for (const name of Object.keys(stage.sets)) stage.fireAt(name, 'bookOffstage');
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
  /* the card has SETTLED: the dedication's ask rises (sim time, the book's) */
  if (E.card >= 1 && !S.ded.shown) {
    S.ded.shown = true;
    endEl.classList.add('settled');
  }
}

/* ---- THE SEEDED DEDICATION (the book's own sigil, app/sigil.js) ---- */
const dedEl = document.getElementById('dedicate');
const dedInput = document.getElementById('dedname');
const dedLine = document.getElementById('dedline');
const sigilCanvas = document.getElementById('sigil');
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
dedInput.addEventListener('input', dedicate);
document.addEventListener('pointerdown', (ev) => {
  if (!S.ded.shown || S.ded.skipped) return;
  if (dedEl.contains(ev.target)) return;
  if (dedInput.value.trim()) return;              /* a named reading stays up */
  S.ded.skipped = true;
  dedEl.classList.add('skipped');
});

const blankLeaf = () => S.page === END_PAGE;

/* ---- the press-and-hold verb (and the RELEASE verb riding it) ---- */
function stepHold(dt) {
  const u = S.unit, H = S.hold;
  if (!u || (u.verb !== 'hold' && u.verb !== 'release')) {
    if (H.k > 0) { H.k = Math.max(0, H.k - dt * 2); stage.setHold(H.k); audio.hold(H.k); }
    holdEl.classList.remove('on');
    return;
  }
  const per = 1 / Math.max(0.15, u.hold);
  if (H.pressing && !H.resolved) H.k = Math.min(1, H.k + dt * per);
  else if (!H.resolved && !u.rest) H.k = Math.max(0, H.k - dt * per * HOLD_DECAY);

  if (u.verb === 'hold' && !H.resolved && H.k >= 1) resolveHold(u);
  const shown = H.resolved ? 1 : H.k;
  stage.setHold(shown);
  audio.hold(H.resolved ? 0 : H.k);

  const p = stage.anchorScreen('hold');
  holdEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  holdEl.classList.toggle('on', !H.resolved || H.k > 0);
  holdArc.setAttribute('stroke-dashoffset', String(ARC_LEN * (1 - shown)));
}

/* ---- the target gates on canvas hotspots at 3D marks ---- */
function stepTarget(t, dt) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved || S.turn.active || S.end.active) {
    targetEl.classList.remove('on', 'miss');
    return;
  }
  if (!stage.targetLive(u.target)) {
    targetEl.classList.remove('on', 'miss');
    return;
  }
  const p = stage.anchorScreen('target', u.target);
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
  if (!stage.targetLive(name)) return false;
  if (stage.targetHit(name, px, py)) return true;
  const p = stage.anchorScreen('target', name);
  return Math.hypot(p.x - px, p.y - py) <= TARGET_RADIUS_PX;
}

function resolveGate(u, { soft = false } = {}) {
  S.gate.resolved = true;
  S.lastAdv = clock.t;
  if (u.key === 'defy') S.hesit = +S.unitT.toFixed(3);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (soft) S.softFails++;
  if (u.endsBook) { S.gate.lastHit = 'end'; audio.cue('click'); startEnding(); return true; }
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

function resolveHold(u, { soft = false } = {}) {
  if (S.hold.resolved) return false;
  S.hold.resolved = true;
  if (soft) {
    S.hold.pressing = false;
    S.hold.k = 1;
    stage.setHold(1);
  }
  audio.cue('reveal');
  margin.cue(CUE_DEFAULT.click);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (u.key === 'embers') stage.startClock();     /* the blinding clock (IV) */
  if (soft) { S.softFails++; advance(); }
  return true;
}

function resolveRelease(u, { soft = false } = {}) {
  if (S.hold.resolved) return false;
  S.hold.resolved = true;
  S.hold.pressing = false;
  S.hold.k = 0;
  stage.setHold(0);
  audio.hold(0);
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (soft) S.softFails++;
  advance();
  return true;
}

/* ---- one fixed sim step (story time — stalls under the cover subtracted) -- */
function step(dt) {
  if (S.turn.active && !S.turn.ready) { S.stall += dt; stepTurn(dt); return; }
  const t = clock.t - S.stall;
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

  /* LEAN-BACK: the line ends, the leaf turns itself. Only the CLICK verb is
     spent this way — target/hold/release/clock stay the reader's. */
  if (S.lean && quiet && u && u.verb === 'click' && S.unitT >= leanDue(u)) {
    S.leanAdvances++;
    advance();
  }

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

  if (S.latch && quiet && canAdvance()) { S.latch = false; advance(); }

  /* soft-fail (sec 2.6): no gate is a wall, no line either; Beat I's heading
     included (A6) */
  if (quiet && u && ((u.beat || 1) >= 2 || u.head)) {
    const limit = u.verb === 'target' ? SOFT_FAIL : Math.min(SOFT_FAIL, u.dwell || SOFT_FAIL);
    if (S.unitT >= limit) {
      if (u.verb === 'target' && !S.gate.resolved) resolveGate(u, { soft: true });
      else if (u.verb === 'release' && !S.hold.resolved) resolveRelease(u, { soft: true });
      else if (u.verb === 'hold' && !S.hold.resolved) resolveHold(u, { soft: true });
      else if (u.verb !== 'clock' && u.verb !== 'auto') { S.softFails++; advance(); }
    }
  }

  refreshFocus();
  stage.step(t, dt);
  stepLeader();
  S.renders++;
}

/* ---- the leader line: type -> the speaker's head (3D projected) ---- */
const EMBODIED = new Set(['ULYSSES', 'POLYPHEMUS', 'A CYCLOPS', 'THE MEN']);
function stepLeader() {
  /* C3: the leader is a GUIDE drawn over the render — debug only, and not
     even computed otherwise (a cleared path can never contribute a pixel) */
  if (!DEBUG_OVERLAYS) { leader.clear(); return; }
  const u = S.unit;
  const who = u && u.speaker;
  if (!u || S.end.active || S.turn.active || !EMBODIED.has(who)) {
    leader.clear(); return;
  }
  if (!stage.headPlate(who)) { leader.clear(); return; }
  const p = stage.anchorScreen('head', who);
  const r = stage.rect || stageEl.getBoundingClientRect();
  if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) { leader.clear(); return; }
  const portrait = MQ_PORTRAIT.matches;
  leader.draw(margin.anchorPoint(portrait), p, portrait);
}

/* ---- the live loop (wall clock ONLY enters here) ---- */
function frame(nowMs) {
  requestAnimationFrame(frame);
  if (clock.harness) return;
  clock.pump(nowMs, step);
  stage.render();
}

/* ---- input ---- */
let gestureSeen = false;
function firstGesture() {
  if (gestureSeen) return;
  gestureSeen = true;
  audio.unlock();
  if (S.unit && S.unit.bed) audio.bed(S.unit.bed);
}

const ptr = { x: 0, y: 0, dnX: null, dnY: null };

/* the leaf's own chrome (the lean-back toggle) is not the stage: a press on
   it is never a page-turn */
const onChrome = (ev) => !!(ev && ev.target && ev.target.closest &&
                            ev.target.closest('#chrome'));
let chromePress = false;

function pressDown(ev) {
  firstGesture();
  if (onChrome(ev)) { chromePress = true; return; }
  chromePress = false;
  if (ev && ev.clientX !== undefined) {
    ptr.x = ev.clientX; ptr.y = ev.clientY;
    ptr.dnX = ev.clientX; ptr.dnY = ev.clientY;
  } else {
    ptr.dnX = null; ptr.dnY = null;
  }
  if (S.turn.active || S.end.active) return;
  if (S.unit && (S.unit.verb === 'hold' || S.unit.verb === 'release') && !S.hold.resolved) {
    S.hold.pressing = true; S.hold.wasPress = true;
  } else {
    S.hold.wasPress = false;
  }
}

function pressUp(ev) {
  if (chromePress || onChrome(ev)) { chromePress = false; return; }
  const wasHoldPress = S.hold.wasPress;
  S.hold.pressing = false;
  S.hold.wasPress = false;
  if (S.end.active) return;
  if (wasHoldPress) {
    if (S.unit && S.unit.verb === 'release' && !S.hold.resolved && S.hold.k >= 1) {
      resolveRelease(S.unit);
    }
    return;
  }
  if (ev && ev.clientX !== undefined && ptr.dnX !== null &&
      Math.hypot(ev.clientX - ptr.dnX, ev.clientY - ptr.dnY) > DRAG_REJECT_PX) {
    return;
  }
  if (clock.t - S.lastAdv < TAP_DEBOUNCE_S) return;
  if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) { tryGate(ptr.x, ptr.y); return; }
  advance();
}

document.addEventListener('pointerdown', pressDown);
window.addEventListener('pointerup', pressUp);
window.addEventListener('pointercancel', () => { S.hold.pressing = false; S.hold.wasPress = false; });
if (leanBtn) leanBtn.addEventListener('click', () => { firstGesture(); setLean(!S.lean); });
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyL') { e.preventDefault(); firstGesture(); setLean(!S.lean); return; }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault();
    if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) {
      const p = stage.anchorScreen('target', S.unit.target);
      ptr.x = p.x; ptr.y = p.y;
    }
    pressDown();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault(); pressUp();
  }
});

/* ---- boot: the first leaf's SET built before __ready ---- */
async function boot() {
  const first = SET_OF_PAGE[PAGES[0]] || 'shore';
  const [, snd] = await Promise.all([
    stage.ensure(first), audio.preload(), cameo.preload(),
  ]);
  stage.mount(first);
  if (snd.missing.length) errors.push({ kind: 'audio', msg: 'undecodable: ' + snd.missing.join(', ') });
  layout();
  setLean(S.lean);
  enterUnit(0, { silent: true });
  refreshFocus(true);
  audio.bed(UNITS[0].bed || null, 0.01);
  margin.hint(true, FIRST_HINT);
  step(0);
  stage.render();
  S.ready = true;
  window.__ready = true;
  document.body.dataset.ready = '1';
  requestAnimationFrame(frame);
}
boot();

/* ---------------------------------------------------------------- *
 * DEV HOOKS — the smoke harness's entire contract (?harness=1).
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

harnessOnly.__gotoUnit = async (n) => {
  const idx = typeof n === 'string' ? UNITS.findIndex((u) => u.key === n || u.id === n) : n;
  if (!(idx >= 0)) return null;
  const want = setOf(UNITS[idx]);
  await stage.ensure(want);
  stage.reset();
  stage.mount(want);
  margin.clear();
  S.turn.active = false; S.end.active = false; S.finished = false;
  S.latch = false; S.clockHeld = false;
  endEl.style.opacity = '0'; coverEl.style.opacity = '0';
  wrapEl.style.transform = 'none';
  const from = UNITS.findIndex((u) => u.page === UNITS[idx].page);
  for (let j = from; j <= idx; j++) enterUnit(j, { silent: j !== idx });
  refreshFocus(true);
  step(0);
  stage.render();
  return window.__unit();
};

harnessOnly.__click = () => { pressDown(); pressUp(); return window.__unit(); };

harnessOnly.__gateClick = () => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a gate' };
  const p = stage.anchorScreen('target', u.target);
  ptr.x = p.x; ptr.y = p.y;
  const before = S.i;
  pressDown(); pressUp();
  return { ok: S.i !== before || S.end.active || S.clockHeld || S.turn.active,
           from: before, to: S.i, target: u.target, endsBeat: !!u.endsBeat,
           held: S.clockHeld, turning: S.turn.active,
           at: { x: +p.x.toFixed(1), y: +p.y.toFixed(1) } };
};

harnessOnly.__gateMiss = (dx = 190, dy = 120) => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a gate' };
  const p = stage.anchorScreen('target', u.target);
  ptr.x = p.x + dx; ptr.y = p.y + dy;
  const before = S.i, n = S.gate.misses;
  pressDown(); pressUp();
  return { advanced: S.i !== before, resolved: S.gate.resolved, misses: S.gate.misses - n };
};

harnessOnly.__holdStart = () => { pressDown(); return S.hold.k; };
harnessOnly.__holdEnd = () => { pressUp(); return S.hold.k; };

harnessOnly.__setTime = (t) => {
  const first = !clock.harness;
  const n = clock.setTime(t, step);
  if (first) document.documentElement.classList.add('harness');
  stage.render();
  return { t: clock.t, steps: n, frame: clock.frame };
};
harnessOnly.__advance = (dt) => harnessOnly.__setTime(clock.t + Math.max(0, dt || 0));
harnessOnly.__renderNow = () => { step(0); stage.render(); return S.renders; };
harnessOnly.__mute = (m) => { audio.setMuted(m !== false); return audio.snapshot(); };
harnessOnly.__audio = () => audio.snapshot();
harnessOnly.__voice = () => voice.snapshot();
harnessOnly.__voiceLog = () => voice.log.slice();
harnessOnly.__lean = (on) => setLean(on !== false);
harnessOnly.__census = () => stage.census();
harnessOnly.__ensureAll = () => stage.preloadAll();
harnessOnly.__refs = { stage, audio, voice, margin, clock, S, UNITS };

/* ---- THE SAM2 PATH's instrument: the sandwich has to be proven in pixels ---- */
harnessOnly.__plate = {
  census: (set) => stage.plateCensus(set),
  state: () => { const r = stage.sets[stage.activeName]; return r && r.plate ? r.plate.stateB : null; },
  occluders: (on) => stage.setOccluders(on !== false),
  layerGain: (id, g) => stage.setLayerGain(id, g),
  flat: (id, k, r, g, b) => stage.setLayerFlat(id, k, r, g, b),
  points: (on) => stage.setLivePoints(on !== false),
  props: (on) => stage.setKeptProps(on !== false),
  only: (id) => stage.setOnlyLayer(id),
  body: (px, py, w, h) => stage.probeBody(px, py, w, h),
  nobody: () => stage.hideProbeBody(),
  bypassGrade: (on) => stage.setGradeBypass(on !== false),
  /* the [materials] + [register] gates' own instruments */
  bypassRegister: (on) => stage.setRegisterBypass(on !== false),
  bypassGrain: (on) => stage.setGrainBypass(on !== false),
  /* ROUND 5 — the focus pass is a NEIGHBOURHOOD operator: the geometric gates
     (occlusion fractions, byte-equality) measure raw pixels and switch it off,
     the [finish] gate toggles it to measure what it did. */
  bypassSoft: (on) => stage.setSoftBypass(on !== false),
  fireOff: (on) => stage.setFireOff(on !== false),
  /* the colour-continuity law's own evidence: the ONE tint of this set-state */
  tint: () => { const r = stage.sets[stage.activeName];
    if (!r || !r.built) return null;
    const st = stage.plateState(r);
    const T = stage._sceneTint(r, st);
    return { set: r.name, state: st, marks: T.marks, E0: +T.E0.toFixed(4),
             hueDeg: T.hueDeg, chroma: T.chroma,
             fire: stage._fireFalloff(r, st) }; },
  actorGrade: () => Object.fromEntries(Object.entries(stage.actors)
    .filter(([, a]) => a.group.visible && a.mode !== 'off')
    .map(([id, a]) => [id, { seat: a.seat, E: a.gradeLum, tint: a.tint,
                             mode: a.mode, contacts: a.contactKind }])),
  shadows: (on) => stage.setShadows(on !== false),
  cast: () => stage.castIdentity(),
  /* the SAME statistic the canon was measured with — the identity gate has to
     compare like with like, so the gate borrows the engine's own function */
  huePeaks: (list, minFrac) => huePeaks(list, minFrac),
  hueDist: (a, b) => hueDist(a, b),
  finish: () => { const r = stage.sets[stage.activeName];
    return r ? { state: stage.plateState(r), fin: r.finish || null } : null; },
  stand: (id, px, py, yaw) => stage.probeStand(id, px, py, yaw || 0),
  cam: (px, py, k) => stage.probeCam(px, py, k),
  clear: () => { for (const a of Object.values(stage.actors)) stage._off(a); return true; },
  mount: async (set) => { await stage.ensure(set); stage.reset(); stage.mount(set); return set; },
  draw: () => { stage.render(); return stage.renders; },
  lightAt: (px, py) => { const r = stage.sets[stage.activeName]; if (!r) return null;
    const v = r.toWorld(px, py, 0); stage.camState = { x: v.x, y: 0, z: v.z,
      k: stage.camState ? stage.camState.k : 1, e: r.camBase.elev };
    stage._plateLightStep(); return stage.lightSample; },
};

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
  ded: { ...S.ded },
  hesit: S.hesit,
  lean: { on: S.lean, narr: S.narr, due: S.unit ? +leanDue(S.unit).toFixed(2) : null,
          advances: S.leanAdvances },
  census: stage.census(),
  view: { w: +view.w.toFixed(1), h: +view.h.toFixed(1), portrait: view.portrait,
          fit: +stage.F.toFixed(4) },
  viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
  targetScreen: (() => {
    const name = S.unit && S.unit.target;
    if (!name) return null;
    const a = stage.targetPlate(name);
    const p = stage.anchorScreen('target', name);
    return { name, plate: [Math.round(a[0]), Math.round(a[1])],
             x: +p.x.toFixed(1), y: +p.y.toFixed(1), live: stage.targetLive(name) };
  })(),
  stage: stage.snapshot(),
  cameo: cameo.snapshot(),
  audio: { bed: audio.bedId, cues: audio.log.length, muted: audio.muted },
  voice: voice.snapshot(),
  errors: errors.slice(),
});

window.__errors = () => errors.slice();
if (HARNESS_BOOT) Object.assign(window, harnessOnly);
