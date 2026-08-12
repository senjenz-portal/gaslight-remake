/**
 * main.js — the reader's machine: 38 units, four gates, one page turn.
 *
 * This is the original app's grammar (site-deploy/app/main.js) ported onto a
 * 2D living plate. The pacing, the verbs, the page turn, the cameo rules and
 * the harness contract are the SAME MACHINE — a unit holds its freeze frame
 * until the reader clicks, a gate demands its verb instead, and the door click
 * turns the page out of the beat. What changed underneath is only where the
 * picture comes from: a painted plate with cut-outs laid over it in plate
 * pixels, instead of a WebGL diorama.
 *
 * LAW: nothing here reads a wall clock except `frame()`. Everything animated
 * is a pure function of clock.t, so two laps that step the same numbers paint
 * the same pixels.
 *
 * Dev hooks (foot of this file) are the harness's whole contract, and they are
 * only attached under ?harness=1.
 */
import { UNITS, BEAT, END_CARD, END_PAGE, PAGES, CUE_DEFAULT, FIRST_HINT,
         validateUnits, unitByKey } from './units.js';
import { Margin, Cameo, Leader } from './margin.js';
import { SimClock, FIXED_DT } from './clock.js';
import { AudioManager } from './audio.js';
import { Stage, PLATE } from './stage.js';

const TURN_IN = 0.55;      // cover fades up
const TURN_HOLD = 0.18;    // the leaf swaps under the cover
const TURN_OUT = 0.72;     // cover fades away on the new page
const END_CARD_IN = 0.55;
const HOLD_DECAY = 0.75;   // a released hold bleeds back at this fraction
const TARGET_RADIUS_PX = 48;   // screen-space slack on top of the plate radius

const errors = [];
window.addEventListener('error', (e) => errors.push({ kind: 'error', msg: String(e.message) }));
window.addEventListener('unhandledrejection', (e) =>
  errors.push({ kind: 'rejection', msg: String(e.reason && e.reason.message || e.reason) }));

const CAMEO_URLS = {
  holmes: './assets/cameo/holmes.jpg',
  watson: './assets/cameo/watson.jpg',
  irene: './assets/cameo/irene.jpg',
  'king-masked': './assets/cameo/king-masked.jpg',
  'king-unmasked': './assets/cameo/king-unmasked.jpg',
};

/* CONTENT.md asks for "door-knock then door" on unit 11, and the unit schema
   carries one sfx slot. The knock is the door; the step is the colossus. */
const EXTRA_SFX = { hadnote: [['knock', 0], ['step', 0.62]] };

const QS = new URLSearchParams(location.search);
const HARNESS_BOOT = QS.get('harness') === '1';

const clock = new SimClock();
if (HARNESS_BOOT) { clock.harness = true; document.documentElement.classList.add('harness'); }

const stageEl = document.getElementById('stage');
const stage = new Stage(stageEl, './assets/');
const audio = new AudioManager('./assets/audio/');
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
  turn: { active: false, t: 0, to: -1, swapped: false, k: 0 },
  end: { active: false, t: 0, k: 0, card: 0 },
  finished: false, advances: 0, nudges: 0, visited: new Set(),
  ready: false, renders: 0, hinted: true,
};

const unitErrors = validateUnits(UNITS);
if (unitErrors.length) errors.push({ kind: 'units', msg: unitErrors.join(' | ') });

const ease = {
  clamp01: (v) => (v < 0 ? 0 : v > 1 ? 1 : v),
  inOut: (k) => 0.5 - 0.5 * Math.cos(Math.PI * (k < 0 ? 0 : k > 1 ? 1 : k)),
};

/* ---- entering a unit ---------------------------------------------------- */
function enterUnit(n, { silent = false } = {}) {
  const idx = Math.max(0, Math.min(UNITS.length - 1, n | 0));
  const u = UNITS[idx];
  S.i = idx; S.unit = u; S.unitT = 0; S.page = u.page;
  S.visited.add(u.id);
  S.finished = false;

  S.hold.pressing = false; S.hold.k = 0; S.hold.resolved = false; S.hold.wasPress = false;
  S.gate.resolved = false; S.gate.lastHit = null; S.gate.missT = 99;
  stage.setHold(0);
  stage.setReveal(u.reveal || null, 0);
  audio.hold(0);

  margin.show(u);
  margin.cue(cueFor(u));
  margin.progress(BEAT, idx, UNITS.length);
  applyCameo(idx);
  wrapEl.style.opacity = '1';

  refreshFocus(true);

  if (u.act) stage.fire(u.act);
  if (!silent) {
    if (u.bed) audio.bed(u.bed);
    if (u.sfx) audio.cue(u.sfx);
    for (const [id, d] of (EXTRA_SFX[u.key] || [])) audio.cue(id, { delay: d });
  }
  document.body.dataset.unit = u.id;
  document.body.dataset.verb = u.verb;
  document.body.dataset.gate = u.target || '';
}

function refreshFocus(snap = false) {
  const u = S.unit;
  stage.setFocus((u && u.focus) || 'room', snap);
}

/** Cameos persist: on a jump, show the most recent one at or before `idx`. */
function applyCameo(idx) {
  for (let j = idx; j >= 0; j--) {
    if (UNITS[j].cameo) { cameo.set(UNITS[j].cameo, UNITS[j].cap); return; }
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
function canAdvance() {
  if (!S.unit || S.turn.active || S.end.active) return false;
  if (S.unit.verb === 'hold' && !S.hold.resolved) return false;
  if (S.unit.verb === 'target' && !S.gate.resolved) return false;
  return true;
}

function advance() {
  if (!canAdvance()) return false;
  const next = S.i + 1;
  audio.cue('click');
  if (next >= UNITS.length) { S.finished = true; return false; }
  S.advances++;
  if (S.hinted) { S.hinted = false; margin.hint(false); }
  if (UNITS[next].page !== S.unit.page) { startTurn(next); return true; }
  enterUnit(next);
  return true;
}

const END_LEAF = 'end';
function startTurn(to, { sfx = true } = {}) {
  S.turn.active = true; S.turn.t = 0; S.turn.to = to; S.turn.swapped = false; S.turn.k = 0;
  if (sfx) audio.cue('page');
  margin.cue('');
}

/**
 * The page turn, at PLATE SCALE: the cover takes the whole leaf, the picture
 * is swapped underneath it, and the cover lifts on what is now a different
 * page. The set does not dissolve into the card — the leaf turns and the card
 * is what is printed on the next one.
 */
function stepTurn(dt) {
  const T = S.turn;
  T.t += dt;
  const total = TURN_IN + TURN_HOLD + TURN_OUT;
  if (T.t < TURN_IN) T.k = ease.inOut(T.t / TURN_IN);
  else if (T.t < TURN_IN + TURN_HOLD) T.k = 1;
  else T.k = 1 - ease.inOut((T.t - TURN_IN - TURN_HOLD) / TURN_OUT);
  T.k = ease.clamp01(T.k);
  coverEl.style.opacity = String(T.k);
  // the leaf itself slides a little as it turns — a plate-scale page turn
  wrapEl.style.transform = `translateX(${(-T.k * view.w * 0.06).toFixed(2)}px)`;
  if (!T.swapped && T.t >= TURN_IN) {
    T.swapped = true;
    if (T.to === END_LEAF) enterEndLeaf(); else enterUnit(T.to);
  }
  if (T.t >= total) {
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
  endEl.querySelector('.sub').textContent = END_CARD.sub;
  startTurn(END_LEAF, { sfx: false });     // the gate already cued the page
}

/** The swap under a risen cover: page 2 is a leaf with no picture on it, and
 *  it is where the King goes — he stood at his mark through the door gate, the
 *  reader turned the page, he is not on the new one. */
function enterEndLeaf() {
  S.page = END_PAGE;
  S.finished = true;
  stage.fire('kingOffstage');
  margin.clear();
  margin.cue('');
  margin.progressEnd(BEAT);
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
}

const blankLeaf = () => S.page === END_PAGE;

/* ---- the press-and-hold verb -------------------------------------------- */
function stepHold(dt) {
  const u = S.unit, H = S.hold;
  if (!u || u.verb !== 'hold') {
    if (H.k > 0) { H.k = Math.max(0, H.k - dt * 2); stage.setHold(H.k); audio.hold(H.k); }
    holdEl.classList.remove('on');
    return;
  }
  const per = 1 / Math.max(0.15, u.hold);
  if (H.pressing && !H.resolved) H.k = Math.min(1, H.k + dt * per);
  else if (!H.resolved) H.k = Math.max(0, H.k - dt * per * HOLD_DECAY);

  if (!H.resolved && H.k >= 1) {
    H.resolved = true;
    stage.setReveal(u.reveal || null, 1);
    audio.cue('reveal');
    margin.cue(CUE_DEFAULT.click);
  }
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

/* ---- the target gates: the MASK / the INDEX / the DOOR ------------------- */
function stepTarget(t, dt) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved || S.turn.active || S.end.active) {
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
  if (stage.targetHit(name, px, py)) return true;
  const a = stage.targetPlate(name);
  const p = stage.toScreen(a[0], a[1]);
  return Math.hypot(p.x - px, p.y - py) <= TARGET_RADIUS_PX;
}

function resolveGate(u) {
  S.gate.resolved = true;
  if (u.gateAct) stage.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (u.endsBeat) { S.gate.lastHit = 'end'; audio.cue('click'); startEnding(); return true; }
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

/* ---- one fixed sim step -------------------------------------------------- */
function step(dt) {
  const t = clock.t;
  S.unitT += dt;
  audio.setTime(t);
  if (S.turn.active) stepTurn(dt);
  if (S.end.active) stepEnding(dt);
  stepHold(dt);
  stepTarget(t, dt);

  const u = S.unit;
  if (u && u.verb === 'auto' && !S.turn.active && !S.end.active && S.unitT >= (u.dwell || 2)) {
    advance();
  }

  refreshFocus();
  stage.step(t, dt);
  stepLeader();
  S.renders++;
}

/** The hairline from the live speech to the speaker's head. */
function stepLeader() {
  const u = S.unit;
  const who = u && u.speaker;
  if (!u || S.end.active || S.turn.active ||
      (who !== 'HOLMES' && who !== 'KING' && who !== 'CLIENT')) {
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

const ptr = { x: 0, y: 0 };

function pressDown(ev) {
  firstGesture();
  if (ev && ev.clientX !== undefined) { ptr.x = ev.clientX; ptr.y = ev.clientY; }
  if (S.turn.active || S.end.active) return;
  if (S.unit && S.unit.verb === 'hold' && !S.hold.resolved) {
    S.hold.pressing = true; S.hold.wasPress = true;
  } else {
    S.hold.wasPress = false;
  }
}

function pressUp() {
  const wasHoldPress = S.hold.wasPress;
  S.hold.pressing = false;
  S.hold.wasPress = false;
  if (S.end.active) return;
  if (wasHoldPress) return;
  if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) { tryGate(ptr.x, ptr.y); return; }
  advance();
}

document.addEventListener('pointerdown', pressDown);
window.addEventListener('pointerup', pressUp);
window.addEventListener('pointercancel', () => { S.hold.pressing = false; S.hold.wasPress = false; });
window.addEventListener('keydown', (e) => {
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
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault(); pressUp();
  }
});

/* ---- boot: every byte decoded before __ready ---------------------------- */
async function boot() {
  const [missing, snd, cameos] = await Promise.all([
    stage.preload(), audio.preload(), cameo.preload(),
  ]);
  if (missing.length) errors.push({ kind: 'assets', msg: 'undecodable: ' + missing.join(', ') });
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
  focus: u.focus, page: u.page, fact: u.fact || null,
  cameo: u.cameo || null, cap: u.cap || null, act: u.act || null,
  shown: margin.lastText, blocks: margin.text(),
});

window.__unit = () => unitView(S.unit, S.i);
window.__units = () => UNITS.map((u, i) => unitView(u, i));
window.__unitByKey = (k) => unitByKey(k);

harnessOnly.__gotoUnit = (n) => {
  const idx = typeof n === 'string' ? UNITS.findIndex((u) => u.key === n || u.id === n) : n;
  if (!(idx >= 0)) return null;
  // replay every unit's act so the world arrives in the state the story built.
  // The reset is what makes that true in BOTH directions: replaying forward
  // from unit 0 cannot undo what a later unit switched on, so the world has to
  // be put back to how unit 0 found it before the replay starts.
  stage.reset();
  margin.clear();
  S.turn.active = false; S.end.active = false; S.finished = false;
  endEl.style.opacity = '0'; coverEl.style.opacity = '0';
  for (let j = 0; j <= idx; j++) enterUnit(j, { silent: j !== idx });
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
  // a resolved gate ADVANCES, and entering the next unit clears gate.resolved —
  // so the proof that the gate fired is that the reader moved, not the flag
  return { ok: S.i !== before || S.end.active, from: before, to: S.i, target: u.target,
           endsBeat: !!u.endsBeat, at: { x: +p.x.toFixed(1), y: +p.y.toFixed(1) } };
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
harnessOnly.__refs = { stage, audio, margin, clock, S, UNITS };

window.__state = () => ({
  ready: S.ready, t: +clock.t.toFixed(4), frame: clock.frame, harness: clock.harness,
  i: S.i, total: UNITS.length, unit: window.__unit(), unitT: +S.unitT.toFixed(3),
  page: S.page, pages: PAGES.length, finished: S.finished, blankLeaf: blankLeaf(),
  advances: S.advances, nudges: S.nudges, visited: S.visited.size, renders: S.renders,
  hold: { pressing: S.hold.pressing, k: +S.hold.k.toFixed(3), resolved: S.hold.resolved,
          required: (S.unit && S.unit.hold) || null },
  gate: { target: (S.unit && S.unit.target) || null, resolved: S.gate.resolved,
          misses: S.gate.misses },
  turn: { active: S.turn.active, k: +S.turn.k.toFixed(3), to: S.turn.to },
  end: { active: S.end.active, k: +S.end.k.toFixed(3), card: +S.end.card.toFixed(3) },
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
