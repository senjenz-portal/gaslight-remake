/**
 * main.js — the reader loop.
 *
 * Grammar:
 *   UNITS[]  a script of read-one-thing / do-one-thing units (units.js)
 *   verbs    click | hold | auto | target — the reader's hand is the pacing
 *            device; `target` is a diegetic gate: click the MASK, the INDEX,
 *            the DOOR. A wrong-place click nudges the cue and never advances.
 *   focus    every unit names where the camera stands (and it TRACKS, so a
 *            walking figure stays framed)
 *   page     the door gate turns the page out of the beat, into the card
 *   clock    fixed-dt sim time; NOTHING in logic reads wall-clock
 *
 * The picture is a LEAF: the whole viewport is the page ground (the crushed
 * page-texture), and the diorama is rendered into an INSET rectangle with the
 * GL scissor. Every screen-space overlay (hold ring, target ring, leader
 * line) projects through that same rectangle — see `project()`.
 *
 * Dev hooks (see the bottom of this file) are the harness's whole contract.
 */
import * as THREE from 'three';
import { UNITS, CUE_DEFAULT, PAGES, BEAT, END_CARD, END_PAGE, FIRST_HINT,
         validateUnits, unitByKey } from './units.js';
import { buildScene, makeBackdrop, makePlates, PALETTE } from './scene.js';
import { AudioManager } from './audio.js';
import { Margin, Cameo, Leader } from './margin.js';
import { SimClock, FIXED_DT, damp, ease } from './clock.js';

/* ---------------------------------------------------------------- *
 * Timing constants — all in SIM seconds.
 * ---------------------------------------------------------------- */
const TURN_IN = 0.55;      // cover fades up
const TURN_HOLD = 0.18;    // the leaf swaps under the cover
const TURN_OUT = 0.72;     // cover fades away on the new page
const END_CARD_IN = 0.55;  // ...and the card rises on the new leaf as it lifts
const HOLD_DECAY = 0.75;   // a released hold bleeds back at this fraction
const CAM_LAMBDA = 3.2;
const CAM_SNAP_LAMBDA = 26;
const TARGET_RADIUS_PX = 48;   // generous screen-space hit radius on gates
// the inset aspect every scene.focus radius/fov pair is authored against
const REF_ASPECT = 1.175;

// [R6-7] the live array is a harness hook (attached at the foot of this file,
// under ?harness=1 only); every reader-facing path reads it through __state().
const errors = [];
window.addEventListener('error', (e) => errors.push({ kind: 'error', msg: String(e.message), src: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => errors.push({ kind: 'rejection', msg: String(e.reason && e.reason.message || e.reason) }));

/* ---------------------------------------------------------------- *
 * Asset paths — wired by path NOW; every one degrades gracefully if the
 * generation lane has not delivered it yet (see `assets.missing`).
 * ---------------------------------------------------------------- */
const PLATE_URLS = {
  note:      '../assets/plates/note-plate.png',
  watermark: '../assets/plates/watermark-plate.png',
  both:      '../assets/plates/both-photo.png',
};
const CAMEO_URLS = {
  'holmes':        '../assets/plates/cameo-holmes.png',
  'watson':        '../assets/plates/cameo-watson.png',
  'king-masked':   '../assets/plates/cameo-king-masked.png',
  'king-unmasked': '../assets/plates/cameo-king-unmasked.png',
  'irene':         '../assets/plates/cameo-irene.png',
};
const PAGE_TEXTURE = '../assets/plates/page-texture.png';

/**
 * ASSETS.md §2 scale table. `height`/`depth` are metres; scale is derived.
 *
 * ROUND-8: THE CAST IS NOT IN THIS LIST ANY MORE. holmes.glb, watson.glb,
 * king.glb and king-unmasked.glb (100k tris apiece, baked painterly PBR, no
 * rig) are retired — the three figures are BUILT, rigged and posed in
 * app/figures.js and stand in their slots from the first frame. So the cast
 * costs no network at all, cannot half-load, and `assets.missing` can no
 * longer contain a man. The PROPS still load exactly as they did: fireplace,
 * armchair, side table, hansom cab.
 */
const GLB_PLAN = [
  { slot: 'hearth',    url: '../assets/3d/fireplace.glb',  opts: { height: 1.50, lift: true, flat: true } },
  // scaled so the wingback's cushion meets Watson's hip: the seated figure
  // reports the seat height it needs (`world.figures.watson.dims`, carried into
  // lap.json as `assets.seat`) and this scale is set from it
  { slot: 'armchair',  url: '../assets/3d/armchair.glb',   opts: { height: 1.18, lift: true, flat: true } },
  // ASSETS.md TODO #6: the texture drifted washed-out grey — tint to mahogany
  { slot: 'sidetable', url: '../assets/3d/side-table.glb', opts: { height: 0.70, lift: true, flat: true, tint: 0x9a6038 } },
  { slot: 'carriage',  url: '../assets/3d/hansom-cab.glb', opts: { depth: 4.00, lift: true, flat: true } },
];

/**
 * C1, ROUND-8 — THE KING IS ONE FIGURE AND THE MASK IS A NODE.
 *
 * Rounds 3-7 kept TWO 100k-tri Kings resident (king.glb bakes the vizard into
 * the mesh, so "I am the King" played with his face still covered until a
 * second model, king-unmasked.glb, was swapped in under cover of the mask-drop)
 * and fact I.6 rested on which model was parented to the slot. The built King
 * wears a mask NODE on his head joint; `kingUnmask` tears it off and throws it
 * on the rug. Nothing loads, nothing swaps, and "is he masked?" is answered off
 * the scene graph by `world.maskState()` — see __state().king below.
 */

const assets = { glb: {}, tris: 0, missing: [], plates: [], cameos: {}, cameosDecoded: [],
                 page: false, noteTexture: false, seat: null, notes: [] };

/* ---------------------------------------------------------------- *
 * Renderer / camera / the inset view rectangle
 * ---------------------------------------------------------------- */
const canvas = document.getElementById('gl');
// MSAA on a 2x buffer is pure cost: at DPR>=1.75 the sample grid already
// resolves the faceted silhouettes, and dropping it is the single cheapest
// frame-time win available (measured below in __perf).
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const WANT_AA = new URLSearchParams(location.search).get('aa') !== '0' && DPR < 1.75;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: WANT_AA, alpha: false,
  powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// ROUND-1 [V1]: ACES compresses hard below 0.05 linear, which is precisely
// where every ambient-only surface in this night interior sat — the shadow
// side of the room fell under luma 26 and stopped carrying shape. The lift
// is paid for on the other end by the window pane's emissive coming down
// (v3), so nothing clips white.
renderer.toneMappingExposure = 1.28;
renderer.setClearColor(0x03050d, 1);
renderer.autoClear = false;                 // the backdrop pass owns the clear

const scene = new THREE.Scene();
const world = buildScene();
// acts own their own diegetic sound (the stair step, the knock) — but the
// scene knows nothing about audio, so it is handed a sink.

scene.add(world.root);
const backdrop = makeBackdrop();
const plates = makePlates(PLATE_URLS);

const ISO = { azim: 0.86, elev: 0.46 };
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
const camState = {
  target: new THREE.Vector3(0.2, 1.5, 0),
  want: new THREE.Vector3(0.2, 1.5, 0),
  radius: 15.5, wantRadius: 15.5,
  fov: 26, wantFov: 26,
  lambda: CAM_LAMBDA, aspectPad: 1,
};

/** The diorama's rectangle on the page, in CSS pixels (top-left origin). */
const view = { x: 0, y: 0, w: 1, h: 1, portrait: false, W: 1, H: 1 };

function applyCamera() {
  const az = ISO.azim, el = ISO.elev;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  camera.position.copy(camState.target).addScaledVector(dir, camState.radius);
  camera.lookAt(camState.target);
  if (Math.abs(camera.fov - camState.fov) > 1e-4) {
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }
}

function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  view.W = W; view.H = H;
  const portrait = (W / H) < 0.9;
  view.portrait = portrait;
  if (portrait) {
    // ROUND-1 [V2]: the leaf read as two islands — a 24%-of-viewport dead
    // band between the inset's bottom edge and the first line of type. The
    // plate now grows to 60% of the leaf AND the prose column is pinned to
    // the plate's own bottom edge in px (not a vh guess), so the type sits
    // directly under the picture at every portrait size.
    // 0.670 is the largest plate that still leaves the deepest three-block
    // stack (unit i-04-note2, measured) ~145 px of clear leaf under it, and
    // it keeps the inset's aspect just above 1 so the portrait camera pad
    // does not kick in and re-frame every shot away from the landscape one.
    view.x = Math.round(W * 0.035);
    view.y = Math.round(H * 0.022);
    view.w = Math.round(W * 0.930);
    view.h = Math.round(H * 0.670);
    document.documentElement.style.setProperty('--marginw', '100vw');
    document.documentElement.style.setProperty('--margintop', (view.y + view.h) + 'px');
  } else {
    const mw = Math.round(Math.min(470, Math.max(302, W * 0.305)));
    const gap = Math.round(W * 0.014);
    view.x = mw + gap;
    view.y = Math.round(H * 0.045);
    view.w = W - view.x - gap;
    view.h = H - view.y * 2;
    document.documentElement.style.setProperty('--marginw', mw + 'px');
  }
  backdrop.setRect(view.x / W, 1 - (view.y + view.h) / H, (view.x + view.w) / W, 1 - view.y / H);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  layout();
  camera.aspect = view.w / Math.max(1, view.h);
  // Every framing in scene.focus is authored against the laptop inset's
  // aspect. A narrower plate (the grown portrait one) would crop the same
  // radius horizontally and slice whoever stands at the edge — round-1 [c2]
  // all over again at one ratio only. Standing off by the aspect ratio keeps
  // HORIZONTAL coverage identical, so a framing composes the same at both.
  camState.aspectPad = Math.min(1.6,
    Math.max(1, REF_ASPECT / Math.max(0.2, camera.aspect)));
  camera.updateProjectionMatrix();
  backdrop.resize(w, h);
  plates.resize(view.w, view.h);
  applyCamera();
}
window.addEventListener('resize', resize);

/** World point -> page pixels, through the inset rectangle. */
const _p = new THREE.Vector3();
function project(v3) {
  _p.copy(v3).project(camera);
  return {
    x: view.x + (_p.x * 0.5 + 0.5) * view.w,
    y: view.y + (-_p.y * 0.5 + 0.5) * view.h,
    onFrame: _p.x > -1 && _p.x < 1 && _p.y > -1 && _p.y < 1 && _p.z < 1,
  };
}

/** Page pixels -> NDC inside the inset rectangle (for the raycaster). */
const _ndc = new THREE.Vector2();
function toNDC(px, py) {
  _ndc.set(((px - view.x) / view.w) * 2 - 1, -(((py - view.y) / view.h) * 2 - 1));
  return _ndc;
}

/* ---------------------------------------------------------------- *
 * App state
 * ---------------------------------------------------------------- */
const clock = new SimClock();
const QS = new URLSearchParams(location.search);
const HARNESS_BOOT = QS.get('harness') === '1';
if (HARNESS_BOOT) {
  clock.harness = true;
  document.documentElement.classList.add('harness');
}
const audio = new AudioManager();
world.setCueSink((id) => audio.cue(id));
const margin = new Margin(document);
const cameo = new Cameo(document, CAMEO_URLS);
const leader = new Leader(document);
const coverEl = document.getElementById('cover');
const holdEl = document.getElementById('hold');
const holdArc = holdEl.querySelector('.arc');
const targetEl = document.getElementById('target');
const targetRing = targetEl.querySelector('.ring');
const endEl = document.getElementById('endcard');
const ARC_LEN = 2 * Math.PI * 33;
const raycaster = new THREE.Raycaster();

const S = {
  i: -1,
  unit: null,
  unitT: 0,
  page: PAGES[0] || 1,
  hold: { pressing: false, k: 0, resolved: false, wasPress: false },
  gate: { resolved: false, misses: 0, lastHit: null, missT: 99 },
  turn: { active: false, t: 0, to: -1, swapped: false, k: 0 },
  end: { active: false, t: 0, k: 0, card: 0 },
  finished: false,
  advances: 0,
  nudges: 0,
  visited: new Set(),
  ready: false,
  renders: 0,
  hinted: true,
};

const unitErrors = validateUnits(UNITS);
if (unitErrors.length) errors.push({ kind: 'units', msg: unitErrors.join(' | ') });

/* ---- entering a unit -------------------------------------------- */
function enterUnit(n, { silent = false } = {}) {
  const idx = Math.max(0, Math.min(UNITS.length - 1, n | 0));
  const u = UNITS[idx];
  S.i = idx;
  S.unit = u;
  S.unitT = 0;
  S.page = u.page;
  S.visited.add(u.id);
  S.finished = false;

  // the verbs reset with the leaf
  S.hold.pressing = false; S.hold.k = 0; S.hold.resolved = false; S.hold.wasPress = false;
  S.gate.resolved = false; S.gate.lastHit = null; S.gate.missT = 99;
  world.setHold(0);
  world.setReveal(u.reveal || null, 0);
  audio.hold(0);

  margin.show(u);
  margin.cue(cueFor(u));
  margin.progress(BEAT, idx, UNITS.length);
  applyCameo(idx);
  backdrop.setInset(1);        // [R6-6] ...and a unit's leaf always has its picture

  refreshFocus(true);

  if (u.act) world.fire(u.act);
  if (!silent) {
    if (u.bed) audio.bed(u.bed);
    if (u.sfx) audio.cue(u.sfx);
  }
  document.body.dataset.unit = u.id;
  document.body.dataset.verb = u.verb;
  document.body.dataset.gate = u.target || '';
}

/**
 * The camera's wanted frame, recomputed every step so it TRACKS movers.
 *
 * ROUND-3 [R4-1]: a framing may also PAN — `focus.pan = [right, up]` in metres
 * along the camera's own screen axes, applied after the world transform. The
 * azimuth/elevation stay locked (the diorama has one light direction and one
 * read), so a pan is the only way to slide a subject off the middle of the
 * plate without re-staging the room or moving anybody's mark. It is measured in
 * METRES rather than pixels so it composes identically at both review ratios.
 */
const CAM_RIGHT = new THREE.Vector3(Math.cos(ISO.azim), 0, -Math.sin(ISO.azim));
const CAM_UP = new THREE.Vector3(-Math.sin(ISO.azim) * Math.sin(ISO.elev), Math.cos(ISO.elev),
                                -Math.cos(ISO.azim) * Math.sin(ISO.elev));
function refreshFocus(snap = false) {
  const u = S.unit;
  const f = world.focus[(u && u.focus) || 'room'] || world.focus.room;
  f.obj.updateWorldMatrix(true, false);
  camState.want.copy(f.at).applyMatrix4(f.obj.matrixWorld);
  if (f.pan) {
    camState.want.addScaledVector(CAM_RIGHT, f.pan[0]).addScaledVector(CAM_UP, f.pan[1] || 0);
  }
  camState.wantRadius = f.radius * camState.aspectPad;
  camState.wantFov = f.fov;
  if (snap) { /* the damp closes the rest */ }
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

/* ---- advancing --------------------------------------------------- */
function canAdvance() {
  if (!S.unit || S.turn.active || S.end.active) return false;
  if (S.unit.verb === 'hold' && !S.hold.resolved) return false;
  if (S.unit.verb === 'target' && !S.gate.resolved) return false;
  return true;
}

function advance() {
  if (!canAdvance()) return false;
  const next = S.i + 1;
  audio.cue('click');                       // click-soft on every text advance
  if (next >= UNITS.length) { S.finished = true; return false; }
  S.advances++;
  if (S.hinted) { S.hinted = false; margin.hint(false); }
  if (UNITS[next].page !== S.unit.page) { startTurn(next); return true; }
  enterUnit(next);
  return true;
}

/**
 * The page turn. `to` is the index of the unit on the new leaf, or END_LEAF for
 * the closing card. `sfx:false` for a turn whose sound the caller already cued
 * (the door gate's own `gateSfx` IS the page).
 */
const END_LEAF = 'end';
function startTurn(to, { sfx = true } = {}) {
  S.turn.active = true; S.turn.t = 0; S.turn.to = to; S.turn.swapped = false; S.turn.k = 0;
  if (sfx) audio.cue('page');
  margin.cue('');
}

function stepTurn(dt) {
  const T = S.turn;
  T.t += dt;
  const total = TURN_IN + TURN_HOLD + TURN_OUT;
  if (T.t < TURN_IN) T.k = ease.inOut(T.t / TURN_IN);
  else if (T.t < TURN_IN + TURN_HOLD) T.k = 1;
  else T.k = 1 - ease.inOut((T.t - TURN_IN - TURN_HOLD) / TURN_OUT);
  T.k = ease.clamp01(T.k);
  coverEl.style.opacity = String(T.k);
  if (!T.swapped && T.t >= TURN_IN) {
    T.swapped = true;
    if (T.to === END_LEAF) enterEndLeaf(); else enterUnit(T.to);
    camState.lambda = CAM_SNAP_LAMBDA;
  }
  if (T.t >= total) {
    T.active = false; T.k = 0;
    coverEl.style.opacity = '0';
    camState.lambda = CAM_LAMBDA;
  }
}

/**
 * [R6-6] The completing action turns the page OUT of the beat, onto the card —
 * with the REAL cover turn, the one every page change uses. Round 1 replaced it
 * with a bespoke 93% cover that never lifted, so the beat ended by dimming the
 * lights on a still-standing diorama instead of turning a leaf.
 */
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

/**
 * The swap, under the cover, at the top of the turn: page 2 is a leaf with NO
 * picture on it (`blankLeaf()` drops the diorama pass and the backdrop's inset
 * panel with it), the beat's prose belongs to page 1, and the progress cue moves
 * off "unit 38 of 38" onto the card so it cannot claim a unit that is not on
 * screen. The cover then lifts on the card, which is what a page turn IS.
 *
 * [R7-1] ...which makes this the one moment in the beat where taking a figure off
 * stage cannot be seen: the cover is at full opacity (stepTurn only swaps once
 * T.k has reached 1) and the leaf being swapped in has no picture on it. So this
 * is where the King goes. He stood whole at the sill through the door gate; the
 * reader turned the page; he is not on the new one.
 */
function enterEndLeaf() {
  S.page = END_PAGE;
  S.finished = true;
  world.fire('kingOffstage');
  margin.clear();
  margin.cue('');
  margin.progressEnd(BEAT);
  leader.clear();
  cameo.hide();
  backdrop.setInset(0);
  document.body.dataset.unit = 'end-card';
  document.body.dataset.verb = '';
}

function stepEnding(dt) {
  const E = S.end;
  E.t += dt;
  // the COVER is the turn's (stepTurn ran first, this frame); the CARD is ours,
  // and it comes up as the cover goes down — the leaf is revealed already turned.
  E.k = S.turn.active ? S.turn.k : 0;
  E.card = ease.clamp01((E.t - TURN_IN) / END_CARD_IN);
  endEl.style.opacity = ease.inOut(E.card).toFixed(3);
}

/** Page 2 carries no diorama: the leaf is paper, the card and nothing else. */
const blankLeaf = () => S.page === END_PAGE;

/* ---- the press-and-hold verb ------------------------------------- */
function stepHold(dt) {
  const u = S.unit;
  const H = S.hold;
  if (!u || u.verb !== 'hold') {
    if (H.k > 0) { H.k = Math.max(0, H.k - dt * 2); world.setHold(H.k); audio.hold(H.k); }
    holdEl.classList.remove('on');
    return;
  }
  const per = 1 / Math.max(0.15, u.hold);
  if (H.pressing && !H.resolved) H.k = Math.min(1, H.k + dt * per);
  else if (!H.resolved) H.k = Math.max(0, H.k - dt * per * HOLD_DECAY);

  if (!H.resolved && H.k >= 1) {
    H.resolved = true;
    world.setReveal(u.reveal || null, 1);
    audio.cue('reveal');
    margin.cue(CUE_DEFAULT.click);
  }
  const shown = H.resolved ? 1 : H.k;
  world.setHold(shown);
  audio.hold(H.resolved ? 0 : H.k);

  const p = project(world.focusWorld(u.focus));
  holdEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  holdEl.classList.toggle('on', !H.resolved || H.k > 0);
  holdArc.setAttribute('stroke-dashoffset', String(ARC_LEN * (1 - shown)));
}

/* ---- the target gates: click the MASK / the INDEX / the DOOR ------ */
function stepTarget(t, dt) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved || S.turn.active || S.end.active) {
    targetEl.classList.remove('on', 'miss');
    return;
  }
  const p = project(world.targetWorld(u.target));
  targetEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  targetEl.classList.add('on');
  // the breathing cue ring is SIM-driven, so a harness frame is reproducible
  S.gate.missT += dt;
  const breathe = 0.5 + 0.5 * Math.sin(t * 2.35);
  const kick = Math.max(0, 1 - S.gate.missT / 0.45);
  targetRing.setAttribute('r', (19 + 5.5 * breathe + 7 * kick).toFixed(2));
  targetRing.setAttribute('stroke-width', (2.0 + 0.9 * breathe + 1.4 * kick).toFixed(2));
  targetEl.classList.toggle('miss', kick > 0.02);
}

/** Did a click at (px,py) land on the unit's target? Raycast + 48px slack. */
function hitsTarget(name, px, py) {
  if (!world.targetLive(name)) return false;
  const hits = world.targetHits(name);
  if (hits.length) {
    raycaster.setFromCamera(toNDC(px, py), camera);
    const ix = raycaster.intersectObjects(hits, false);
    if (ix.length) return true;
  }
  const p = project(world.targetWorld(name));
  if (!p.onFrame) return false;
  return Math.hypot(p.x - px, p.y - py) <= TARGET_RADIUS_PX;
}

/** Resolve the gate: fire its act + cue, then advance (the click IS the beat). */
function resolveGate(u) {
  S.gate.resolved = true;
  if (u.gateAct) world.fire(u.gateAct);
  if (u.gateSfx) audio.cue(u.gateSfx);
  if (u.endsBeat) { S.gate.lastHit = 'end'; audio.cue('click'); startEnding(); return true; }
  advance();
  return true;
}

function tryGate(px, py) {
  const u = S.unit;
  if (!u || u.verb !== 'target' || S.gate.resolved) return false;
  if (hitsTarget(u.target, px, py)) return resolveGate(u);
  // wrong place: nudge the cue, pulse the ring, never advance
  S.gate.misses++; S.nudges++; S.gate.missT = 0;
  margin.nudge();
  return false;
}

/* ---- one fixed sim step ------------------------------------------ */
function step(dt) {
  const t = clock.t;
  S.unitT += dt;
  if (S.turn.active) stepTurn(dt);
  if (S.end.active) stepEnding(dt);
  stepHold(dt);
  stepTarget(t, dt);

  const u = S.unit;
  if (u && u.verb === 'auto' && !S.turn.active && !S.end.active && S.unitT >= (u.dwell || 2)) advance();

  // camera easing — the focus is re-read every step so it tracks a walker
  refreshFocus();
  camState.target.x = damp(camState.target.x, camState.want.x, camState.lambda, dt);
  camState.target.y = damp(camState.target.y, camState.want.y, camState.lambda, dt);
  camState.target.z = damp(camState.target.z, camState.want.z, camState.lambda, dt);
  camState.radius = damp(camState.radius, camState.wantRadius, camState.lambda, dt);
  camState.fov = damp(camState.fov, camState.wantFov, camState.lambda, dt);
  applyCamera();

  world.step(t, dt);
  plates.set(world.state.plate, world.state.dim);
  stepLeader();
}

/** The hairline from the live speech to the speaker's head. */
function stepLeader() {
  const u = S.unit;
  const who = u && u.speaker;
  if (!u || S.end.active || S.turn.active || (who !== 'HOLMES' && who !== 'KING' && who !== 'CLIENT')) {
    leader.clear(); return;
  }
  if (world.state.dim > 0.12) { leader.clear(); return; }   // a plate owns the frame
  const head = world.headWorld(who);
  if (!head) { leader.clear(); return; }
  if (who !== 'HOLMES' && !world.state.kingVisible) { leader.clear(); return; }
  const p = project(head);
  if (!p.onFrame) { leader.clear(); return; }
  leader.draw(margin.anchorPoint(view.portrait), p, view.portrait);
}

function render() {
  const W = view.W, H = view.H;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  backdrop.render(renderer);
  if (blankLeaf()) { S.renders++; return; }      // [R6-6] page 2 holds no picture
  const gy = H - (view.y + view.h);
  renderer.setViewport(view.x, gy, view.w, view.h);
  renderer.setScissor(view.x, gy, view.w, view.h);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);
  plates.render(renderer);
  renderer.setScissorTest(false);
  S.renders++;
}

/* ---- the live loop (wall clock ONLY enters here) ------------------ */
function frame(nowMs) {
  requestAnimationFrame(frame);
  if (clock.harness) return;              // the harness drives; rAF stands down
  clock.pump(nowMs, step);
  render();
}

/* ---------------------------------------------------------------- *
 * Input — every path funnels through the same calls the hooks use.
 * ---------------------------------------------------------------- */
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
  if (wasHoldPress) return;               // that press belonged to the verb
  if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) { tryGate(ptr.x, ptr.y); return; }
  advance();
}

canvas.addEventListener('pointerdown', pressDown);
document.getElementById('margin').addEventListener('pointerdown', pressDown);
window.addEventListener('pointerup', pressUp);
window.addEventListener('pointercancel', () => { S.hold.pressing = false; S.hold.wasPress = false; });
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
    e.preventDefault();
    // the keyboard aims itself at the gate's target — never a wedge
    if (S.unit && S.unit.verb === 'target' && !S.gate.resolved) {
      const p = project(world.targetWorld(S.unit.target));
      ptr.x = p.x; ptr.y = p.y;
    }
    pressDown();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); pressUp(); }
});

/* ---------------------------------------------------------------- *
 * Boot — assets first, so a harness lap is deterministic from frame 0.
 * ---------------------------------------------------------------- */
async function loadPageTexture() {
  return new Promise((res) => {
    new THREE.TextureLoader().load(PAGE_TEXTURE, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;   // stretched, NEVER tiled
      backdrop.setTexture(tex);
      assets.page = true;
      res(true);
    }, undefined, () => { assets.missing.push(PAGE_TEXTURE); res(false); });
  });
}

/** Probe the cameo art once, so no 404 can land mid-lap. */
async function probeCameos() {
  const ok = {};
  await Promise.all(Object.entries(CAMEO_URLS).map(async ([id, url]) => {
    try {
      const r = await fetch(url, { method: 'GET', cache: 'force-cache' });
      ok[id] = r.ok;
      if (!r.ok) assets.missing.push(url);
    } catch (_) { ok[id] = false; assets.missing.push(url); }
  }));
  assets.cameos = ok;
  for (const [id, good] of Object.entries(ok)) if (!good) delete cameo.urls[id];
}

async function loadModels() {
  const m = await import('./gltf.js');
  for (const plan of GLB_PLAN) {
    const slot = world.slots[plan.slot];
    if (!slot) { assets.missing.push(plan.url + ' (no slot ' + plan.slot + ')'); continue; }
    try {
      const r = await m.swapSlot(slot, plan.url, plan.opts);
      assets.glb[plan.slot] = { url: plan.url, tris: r.tris, scale: +r.scale.toFixed(4), size: r.size };
      if (r.seat) { assets.glb[plan.slot].seat = r.seat; assets.seat = r.seat; }
      assets.tris += r.tris;
    } catch (e) {
      assets.missing.push(plan.url);       // placeholder geometry stays — no wedge
    }
  }
  /* The cast needs no network. What the armchair's scale used to be set from —
   * how high a cushion the seated doctor's hip wants — comes off the SEATED
   * FIGURE now (his hip is a joint, so the number is the pose's own), which is
   * what keeps `assets.seat` in lap.json honest with no GLB behind it. */
  const wd = world.figures.watson.dims;
  assets.seat = { hip: +wd.seatHipY.toFixed(4), stature: wd.H, jointDriven: true };
}

/**
 * [E1b] The note quad's folded-paper read: the letter region of
 * assets/plates/note-plate.png, cropped with texture offset/repeat. The
 * plate's own texture object is shared with the 2D plate pass, so this
 * takes a clone — same GPU image, its own UV transform.
 */
function wireNoteTexture() {
  const src = plates.quads.note && plates.quads.note.mat.map;
  if (!src) { assets.notes.push('note-plate.png absent — the note keeps its flat cream'); return; }
  const tex = src.clone();
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // measured crop of the sheet on the side table (1408x768 plate, px
  // 478..986 x 200..564), flipY on, so v runs from the bottom of the image
  tex.offset.set(478 / 1408, 1 - 564 / 768);
  tex.repeat.set(508 / 1408, 364 / 768);
  assets.noteTexture = world.setNoteTexture(tex);
}

async function boot() {
  resize();
  enterUnit(0, { silent: true });
  audio.bed(UNITS[0].bed || 'hearth');      // logged now, sounded at first gesture
  margin.hint(true, FIRST_HINT);
  camState.target.copy(camState.want);
  camState.radius = camState.wantRadius;
  camState.fov = camState.wantFov;
  applyCamera();
  world.step(0, FIXED_DT);
  render();

  // every network fetch the app will ever make happens HERE, before ready.
  // The 8 MB prop GLBs go first and alone: seven of them racing the plate/audio
  // fetches is what made the dev server drop connections. ROUND-8 took four of
  // the seven off this queue for good — the cast is built, not fetched.
  await loadModels();
  await Promise.allSettled([
    loadPageTexture(), probeCameos(), plates.ready, audio.preload(),
  ]);
  // ...and the cameos are DECODED here too, not merely fetched: see Cameo.preload.
  // This is what makes "every network fetch happens before __ready" true of the
  // identity card as well, instead of true of everything except the identity card.
  assets.cameosDecoded = await cameo.preload();
  for (const u of plates.missing) if (!assets.missing.includes(u)) assets.missing.push(u);
  assets.plates = plates.missing.slice();
  wireNoteTexture();
  applyCameo(S.i);

  resize();
  world.step(0, FIXED_DT);
  render();
  requestAnimationFrame(frame);
  S.ready = true;
  window.__ready = true;
}
boot();

/* ---------------------------------------------------------------- *
 * DEV HOOKS — the review harness's entire contract with the app.
 *
 * [R6-7] SHIP HYGIENE. Two classes, and only one of them ships:
 *   window.__x        READ-ONLY. State, layout, the unit schema, the asset
 *                     manifest, a slot's screen box, the margin's ink. Nothing
 *                     here can move the beat, so a shipped page may carry it.
 *   harnessOnly.__x   MUTATING. Jumps the reader, clicks for him, drives the sim
 *                     clock, renders, swaps a GLB, mutes the audio, toggles a
 *                     slot's visibility for a pixel readback — plus `__refs`,
 *                     a live handle on the renderer, the scene and UNITS.
 * The mutating set is attached at the FOOT of this file and only under
 * ?harness=1: without the flag it is never on `window` at any point in the
 * page's life, rather than being attached and deleted a tick later.
 * ---------------------------------------------------------------- */
const harnessOnly = {};

function unitView(u, i) {
  if (!u) return null;
  return { i, id: u.id, key: u.key, verb: u.verb, focus: u.focus, page: u.page,
           speaker: u.speaker || '', text: u.text || '', cue: cueFor(u),
           dwell: u.dwell || null, hold: u.hold || null, reveal: u.reveal || null,
           act: u.act || null, gateAct: u.gateAct || null, target: u.target || null,
           sfx: u.sfx || null, cameo: u.cameo || null, fact: u.fact || null,
           head: !!u.head };
}

/** Current unit (shape above), or null before boot. */
window.__unit = () => unitView(S.unit, S.i);

/** Jump straight to unit n. Applies the unit's entry effects; no transition. */
harnessOnly.__gotoUnit = (n) => {
  if (!(n >= 0) || n >= UNITS.length) return null;
  S.turn.active = false; S.turn.k = 0; coverEl.style.opacity = '0';
  S.end.active = false; endEl.style.opacity = '0';
  camState.lambda = CAM_LAMBDA;
  // a jump REPLAYS the pantomime it skipped, then snaps it, so the diorama
  // matches what a reader who walked here would be looking at
  world.resetPantomime();
  for (let j = 0; j < n; j++) {
    if (UNITS[j].act) world.fire(UNITS[j].act);
    if (UNITS[j].gateAct) world.fire(UNITS[j].gateAct);
    world.flush();
  }
  // a jump is not a first visit past the opening frame: the hint belongs to
  // unit 0 only, and leaving it up put type over the picture in every shot
  if (n === 0) { S.hinted = true; margin.hint(true, FIRST_HINT); }
  else { S.hinted = false; margin.hint(false); }
  enterUnit(n);
  world.step(clock.t, FIXED_DT);
  return window.__unit();
};

/** One reader click: down + up through the real input path. */
harnessOnly.__click = () => { pressDown(); pressUp(); return window.__unit(); };

/**
 * Click the CORRECT target of the current gate, through the real raycast
 * path (same hit test a reader's finger takes). Returns what happened.
 */
harnessOnly.__gateClick = () => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a target gate' };
  const p = project(world.targetWorld(u.target));
  firstGesture();
  ptr.x = p.x; ptr.y = p.y;
  const before = S.i;
  const hit = tryGate(p.x, p.y);
  return { ok: !!hit, target: u.target, at: { x: +p.x.toFixed(1), y: +p.y.toFixed(1) },
           onFrame: p.onFrame, from: before, to: S.i, ended: S.end.active,
           misses: S.gate.misses };
};

/** Click somewhere that is NOT the target (nudge path), for the review. */
harnessOnly.__gateMiss = (dx = 190, dy = 120) => {
  const u = S.unit;
  if (!u || u.verb !== 'target') return { ok: false, why: 'not a target gate' };
  const p = project(world.targetWorld(u.target));
  firstGesture();
  const x = Math.min(view.x + view.w - 4, Math.max(view.x + 4, p.x + dx));
  const y = Math.min(view.y + view.h - 4, Math.max(view.y + 4, p.y + dy));
  ptr.x = x; ptr.y = y;
  const before = S.i;
  tryGate(x, y);
  return { advanced: S.i !== before, nudges: S.nudges, misses: S.gate.misses };
};

/** Press-and-hold, split so the harness can screenshot mid-progress. */
harnessOnly.__holdStart = () => { pressDown(); return S.hold.k; };
harnessOnly.__holdEnd = () => { pressUp(); return S.hold.k; };

/**
 * Advance the SIM to absolute time `t` (forward only) in fixed dt steps.
 * Latches harness mode: after the first call rAF no longer advances the
 * clock or renders, so state and pixels only change when you say so.
 */
harnessOnly.__setTime = (t) => {
  const first = !clock.harness;
  const n = clock.setTime(t, step);
  if (first) document.documentElement.classList.add('harness');
  return { t: clock.t, steps: n, frame: clock.frame };
};

/** Advance the sim by `dt` seconds (convenience over __setTime). */
harnessOnly.__advance = (dt) => harnessOnly.__setTime(clock.t + Math.max(0, dt || 0));

/** Draw one frame right now. Returns the cumulative render count. */
harnessOnly.__renderNow = () => { render(); return S.renders; };

/** Everything the harness needs to judge a frame. */
window.__state = () => ({
  ready: S.ready,
  t: clock.t, frame: clock.frame, harness: clock.harness,
  i: S.i, total: UNITS.length, unit: window.__unit(), unitT: S.unitT,
  page: S.page, pages: PAGES.length, finished: S.finished,
  advances: S.advances, nudges: S.nudges, visited: S.visited.size, renders: S.renders,
  hold: { pressing: S.hold.pressing, k: S.hold.k, resolved: S.hold.resolved,
          required: S.unit && S.unit.hold || null },
  gate: { target: (S.unit && S.unit.target) || null, resolved: S.gate.resolved,
          misses: S.gate.misses },
  turn: { active: S.turn.active, k: +S.turn.k.toFixed(3), to: S.turn.to },
  end: { active: S.end.active, k: +S.end.k.toFixed(3), card: +S.end.card.toFixed(3) },
  camera: { pos: camera.position.toArray().map(v => +v.toFixed(3)),
            target: camState.target.toArray().map(v => +v.toFixed(3)),
            fov: +camera.fov.toFixed(2), radius: +camState.radius.toFixed(3) },
  focusScreen: (() => {
    const p = project(world.focusWorld((S.unit && S.unit.focus) || 'room'));
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), onFrame: p.onFrame };
  })(),
  targetScreen: (() => {
    const name = S.unit && S.unit.target;
    if (!name) return null;
    const p = project(world.targetWorld(name));
    return { name, x: +p.x.toFixed(1), y: +p.y.toFixed(1), onFrame: p.onFrame,
             live: world.targetLive(name) };
  })(),
  view: { x: view.x, y: view.y, w: view.w, h: view.h, portrait: view.portrait },
  viewport: { w: window.innerWidth, h: window.innerHeight, dpr: renderer.getPixelRatio() },
  plates: { note: +world.state.plate.note.toFixed(3),
            watermark: +world.state.plate.watermark.toFixed(3),
            both: +world.state.plate.both.toFixed(3),
            dim: +world.state.dim.toFixed(3) },
  cameo: cameo.snapshot(),
  /* C1, ROUND-8 — IS THE VIZARD ON HIS FACE, OR ON THE RUG?
   * The answer used to be "which of two models is parented to the slot"
   * (`hasPair`, retired with the GLBs). It is read off the SCENE GRAPH now:
   * `mask.attached` is the node still on his head joint, `mask.onFloor` is the
   * node handed to the slot and landed on its mark, `mask.paintK` the fall's
   * repaint. `unmasked` is fact I.6's own bit and it cannot disagree with the
   * picture, because the picture is what it is measured from.
   * [R7-1] ...and WHERE HE IS STANDING, because his exit is a question about a
   * mark rather than about a timer. `mark` is the mark his mover is bound to by
   * name, `sillOff` the metres between him and the sill, `walking` whether anything
   * is moving him at all: through i-35, i-36 and the door gate the answer is
   * 'sill' / 0 / false at every dwell, and he is taken off stage — not walked off —
   * by enterEndLeaf, behind a risen cover on a leaf with no diorama. */
  king: (() => {
    const cm = world.movers.client, M = world.marks;
    const ms = world.maskState();
    const nameOf = (v) => (v.distanceTo(M.kingSill) < 0.01 ? 'sill'
                        : v.distanceTo(M.kingOut) < 0.01 ? 'out' : 'other');
    return { visible: world.state.kingVisible, masked: world.state.masked,
             unmasked: !world.state.masked && !ms.attached, mask: ms,
             // the pair of 100k-tri models is gone; nothing to be half-resident
             hasPair: false, procedural: true,
             mark: nameOf(cm.to), walking: !!cm.walking,
             sillOff: +cm.pos.distanceTo(M.kingSill).toFixed(3) };
  })(),
  // [c2] a figure sliced by the inset edge is the finding; 1 or 0 is fine
  figures: { watson: window.__slotFrame('watson'), holmes: window.__slotFrame('holmes'),
             client: window.__slotFrame('client') },
  // [R4-2] the diorama's pulse: what the slot-level life is doing right now,
  // so "the King's entrance does not glide" is a number and not a claim
  gait: world.gait(),
  layout: window.__layout(),
  leader: leader.on,
  acts: world.state.acts.map(a => a.name),
  assets: { tris: assets.tris, glb: Object.keys(assets.glb), missing: assets.missing.slice(),
            audioMissing: audio.snapshot().missing, notes: assets.notes.slice(),
            noteTexture: assets.noteTexture,
            // [R3-1] what the seated pose actually produced: his stature, and
            // how high a chair his hip now needs — the number the armchair's
            // scale is set from
            seat: assets.seat,
            /* ROUND-8 — the cast's own ledger, read off the built graph rather
             * than off a manifest: three rigged figures at ~2k triangles each,
             * flat-shaded, vertex-coloured, ZERO texture samplers, in place of
             * four 100k-tri baked-PBR meshes that could not move. */
            cast: world.figureStyle() },
  audio: audio.snapshot(),
  marginText: margin.text(),
  unitErrors,
  errors: errors.slice(-20),
});

/**
 * Page-layout truth for the review's DEAD-BAND metric (round-1 [V2]).
 * `deadBand` is the fraction of viewport height between the bottom edge of
 * the diorama inset and the top of the first line of type — the "two
 * islands" gap. Landscape stacks type BESIDE the inset, so the measure is
 * portrait-only and reports 0 there. `overflow` catches the opposite
 * failure: type pushed off the foot of the leaf by an inset grown too tall.
 */
window.__layout = () => {
  const H = Math.max(1, window.innerHeight);
  const blocks = [...document.querySelectorAll('#blocks .blk')];
  const first = blocks.find(b => b.getBoundingClientRect().height > 1) || null;
  const last = blocks.length ? blocks[blocks.length - 1] : null;
  const cueR = document.getElementById('cue').getBoundingClientRect();
  const insetBottom = view.y + view.h;
  const firstTop = first ? first.getBoundingClientRect().top : null;
  const lastBottom = last ? last.getBoundingClientRect().bottom : null;
  const foot = Math.max(lastBottom || 0, cueR.height > 1 ? cueR.bottom : 0);
  return {
    portrait: view.portrait, viewportH: H,
    inset: { x: view.x, y: view.y, w: view.w, h: view.h, bottom: insetBottom },
    firstBlockTop: firstTop === null ? null : +firstTop.toFixed(1),
    lastBlockBottom: lastBottom === null ? null : +lastBottom.toFixed(1),
    cueBottom: +cueR.bottom.toFixed(1), blocks: blocks.length,
    hasText: !!first,
    deadBand: (view.portrait && firstTop !== null)
      ? +(Math.max(0, firstTop - insetBottom) / H).toFixed(4) : 0,
    overflow: +(Math.max(0, foot - H) / H).toFixed(4),
  };
};

/**
 * Screen-space box of a slot's geometry, in page pixels, plus how much of it
 * the inset actually contains. Round-1 [c2] was "Watson half-clipped at the
 * inset edge": `inset < 1` is that finding, measurable.
 */
const _bb = new THREE.Box3();
const _mb = new THREE.Box3();
const _bp = new THREE.Vector3();
/**
 * Box3.setFromObject ignores `visible` and counts every child, so a slot's
 * box came back inflated by hidden props and by the additive glow quads that
 * ride with them (the note's 1.5 m halo alone doubled Holmes). Bodies only:
 * visible meshes, no additive light cards.
 */
function expandBody(obj, box) {
  if (!obj.visible) return;
  if (obj.isMesh && obj.geometry &&
      !(obj.material && obj.material.blending === THREE.AdditiveBlending)) {
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    _mb.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
    box.union(_mb);
  }
  for (const c of obj.children) expandBody(c, box);
}
window.__slotFrame = (name) => {
  const slot = world.slots[name];
  if (!slot || !slot.visible) return null;
  slot.updateWorldMatrix(true, true);
  _bb.makeEmpty();
  expandBody(slot, _bb);
  if (!isFinite(_bb.min.x) || _bb.isEmpty()) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = 0;
  for (const x of [_bb.min.x, _bb.max.x]) for (const y of [_bb.min.y, _bb.max.y]) {
    for (const z of [_bb.min.z, _bb.max.z]) {
      const p = project(_bp.set(x, y, z));
      if (!p.onFrame && _p.z >= 1) behind++;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  const cx0 = Math.max(x0, view.x), cy0 = Math.max(y0, view.y);
  const cx1 = Math.min(x1, view.x + view.w), cy1 = Math.min(y1, view.y + view.h);
  const area = Math.max(1e-6, (x1 - x0) * (y1 - y0));
  const shown = Math.max(0, cx1 - cx0) * Math.max(0, cy1 - cy0);
  return { x0: +x0.toFixed(1), y0: +y0.toFixed(1), x1: +x1.toFixed(1), y1: +y1.toFixed(1),
           inset: +(shown / area).toFixed(4), behind };
};

/**
 * ROUND-3 [R4-3]/[R4-6] — WHICH PIXELS IS THIS THING ACTUALLY PAINTING?
 *
 * Two round-4 findings needed the same answer and neither could get it from a
 * screen rectangle:
 *   · the slice list called a figure "half in frame" when the half in frame was
 *     entirely behind the King's cloak (holmes at i-35-briony: box 7.7% inside
 *     landscape / 10.6% portrait, 0 pixels visible at either — still the measured
 *     numbers this lap), and
 *   · the hearth ember's own bounding box contains Watson's book at the
 *     establishing camera, so measuring the rectangle would have reported the
 *     book's value as the fire's.
 *
 * So: render the frame, hide the object, render again, and keep the pixels that
 * CHANGED. Those pixels are the object, whatever is in front of it and whatever
 * shares its box. Returns how many there are and the brightest one, which is
 * exactly what "does the fire clip?" and "is this figure visible at all?" ask.
 *
 * Costs two extra draws and one readback of the object's box, so it is a review
 * hook and not a per-frame path. State and pixels are restored before it
 * returns: the next screenshot is byte-identical to one taken without asking.
 */
function paintProbe(obj, box) {
  const x0 = Math.max(Math.floor(Math.max(box.x0, view.x)), 0);
  const y0 = Math.max(Math.floor(Math.max(box.y0, view.y)), 0);
  const x1 = Math.min(Math.ceil(Math.min(box.x1, view.x + view.w)), view.W);
  const y1 = Math.min(Math.ceil(Math.min(box.y1, view.y + view.h)), view.H);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) {
    return { box: { x: x0, y: y0, w: 0, h: 0 }, total: 0, visible: 0, frac: 0,
             max: null, hot: 0, maxRGB: null, offPlate: true };
  }
  const dpr = renderer.getPixelRatio();
  const gl = renderer.getContext();
  const rx = Math.round(x0 * dpr), rw = Math.round(w * dpr), rh = Math.round(h * dpr);
  const ry = Math.round((view.H - y1) * dpr);          // GL origin is bottom-left
  const on = new Uint8Array(rw * rh * 4), off = new Uint8Array(rw * rh * 4);
  const was = obj.visible;
  render();
  gl.readPixels(rx, ry, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, on);
  obj.visible = false;
  render();
  gl.readPixels(rx, ry, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, off);
  obj.visible = was;
  render();
  let vis = 0, max = -1, maxRGB = null, hot = 0;
  for (let i = 0; i < on.length; i += 4) {
    if (!(Math.abs(on[i] - off[i]) > 2 || Math.abs(on[i + 1] - off[i + 1]) > 2 ||
          Math.abs(on[i + 2] - off[i + 2]) > 2)) continue;
    vis++;
    const l = 0.2126 * on[i] + 0.7152 * on[i + 1] + 0.0722 * on[i + 2];
    if (l > 250) hot++;
    if (l > max) { max = l; maxRGB = [on[i], on[i + 1], on[i + 2]]; }
  }
  const total = rw * rh;
  return { box: { x: x0, y: y0, w, h }, total, visible: vis,
           frac: +(vis / Math.max(1, total)).toFixed(4),
           max: max < 0 ? null : +max.toFixed(1), hot, maxRGB, offPlate: false };
}

/**
 * [R4-6] the pixels a FIGURE is painting, and how many of them there are.
 *
 * [R5-1] ...and separately for his HEAD BAND — the top HEAD_BAND of his own
 * screen box. This is the measurement that catches a figure who is present,
 * correctly framed and still unreadable: at i-36 the door's additive glow card
 * washed the departing King's skull to a cream card, and because the wash sat
 * over the SAME pixels with him hidden, his head painted 0 of them. "Reads
 * whole" is therefore head.visible > 0 with head.hot == 0, not box coverage.
 */
const HEAD_BAND = 0.16;             // fraction of the figure's box height
harnessOnly.__slotPixels = (name) => {
  const slot = world.slots[name];
  if (!slot || !slot.visible) return null;
  const fr = window.__slotFrame(name);
  if (!fr) return null;
  const whole = paintProbe(slot, fr);
  whole.head = paintProbe(slot, { x0: fr.x0, y0: fr.y0, x1: fr.x1,
                                  y1: fr.y0 + (fr.y1 - fr.y0) * HEAD_BAND });
  return whole;
};

/**
 * [R4-3] the pixels the HEARTH FIRE is painting, and the brightest of them.
 * `maxRGB` is the evidence for "ambers preserved": round 3's clipped ember read
 * (255,253,244) — a cream card — where this reports the fire's own hottest
 * pixel in full.
 */
harnessOnly.__emberPixels = () => {
  const fire = world.props.ember;
  if (!fire || !fire.visible) return null;
  fire.updateWorldMatrix(true, false);
  const pts = world.probes.ember();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of pts) {
    const p = project(v);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  return paintProbe(fire, { x0, y0, x1, y1 });
};

/**
 * ROUND-3 review probe. Turns the scene's named world samples into PAGE
 * PIXELS through the very inset rectangle the screenshot was taken with, so
 * the harness can measure luma on the surface a finding is ABOUT:
 *   apron / floor   [R3-2] the two lumas the apron has to sit below
 *   pane            [R3-3] the glass rect (fraction over luma 250) and
 *                   [R3-4] the region the carriage-lamp pass swings
 *   lamp            [R3-7] the lantern against the room floor's front edge
 *   ember           [R4-3] the hearth fire's own box (it must not clip)
 * Rects are clipped to the inset, so a measurement can never wander onto the
 * page margin. `frac` reports how much of the pane survived that clip — a
 * pane measurement on 3% of the pane is not evidence, and lap.mjs says so.
 */
window.__regions = () => {
  const P = world.probes;
  const pt = (v) => { const p = project(v); return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), onFrame: p.onFrame }; };
  const rectOf = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of pts) {
      const p = project(v);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const cx0 = Math.max(x0, view.x), cy0 = Math.max(y0, view.y);
    const cx1 = Math.min(x1, view.x + view.w), cy1 = Math.min(y1, view.y + view.h);
    const full = Math.max(1e-6, (x1 - x0) * (y1 - y0));
    const w = Math.max(0, cx1 - cx0), h = Math.max(0, cy1 - cy0);
    return { x: +cx0.toFixed(1), y: +cy0.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1),
             frac: +((w * h) / full).toFixed(4) };
  };
  const lamp = pt(P.lamp());
  // where the room floor's downstage edge crosses the lantern's screen-x:
  // the lamp must sit BELOW that line or it is standing in the parlour
  const [fl, fr] = P.floorFront().map(v => project(v));
  const t = Math.abs(fr.x - fl.x) < 1e-3 ? 0 : (lamp.x - fl.x) / (fr.x - fl.x);
  const edgeY = fl.y + (fr.y - fl.y) * Math.max(0, Math.min(1, t));
  return {
    inset: { x: view.x, y: view.y, w: view.w, h: view.h },
    apron: P.apron().map(pt),
    floor: P.floor().map(pt),
    pane: rectOf(P.pane()),
    paneGrid: P.paneGrid().map(pt),
    // [R4-3] the fire itself: the one element in the lap that was still
    // clipping, measured on its own screen box instead of frame-wide
    ember: rectOf(P.ember()),
    lamp: { ...lamp, floorEdgeY: +edgeY.toFixed(1), belowFloorEdge: lamp.y > edgeY },
  };
};

/** Live references, for ad-hoc probing from the harness. */
harnessOnly.__refs = { THREE, renderer, scene, camera, world, audio, margin, clock, S, UNITS, PALETTE };
window.__units = () => UNITS.map((u, i) => unitView(u, i));
window.__unitByKey = (k) => unitByKey(k);
window.__validate = () => validateUnits(UNITS);
harnessOnly.__mute = (m) => { audio.setMuted(m !== false); return audio.snapshot(); };
window.__assets = () => JSON.parse(JSON.stringify(assets));

/** Is the VENDORED GLTFLoader reachable through the importmap? Loads no art. */
window.__gltfReady = async () => {
  const m = await import('./gltf.js');
  return m.loaderAvailable();
};

/** Swap a placeholder slot for a generated GLB. See app/gltf.js. */
harnessOnly.__swapSlot = async (slotName, url, opts) => {
  const slot = world.slots[slotName];
  if (!slot) throw new Error('no slot ' + slotName);
  const m = await import('./gltf.js');
  const r = await m.swapSlot(slot, url, opts || {});
  render();
  return r;
};
window.__slots = () => Object.keys(world.slots);

/* ---------------------------------------------------------------- *
 * ROUND-8 cast hooks. The cast is geometry this app builds, so what it is and
 * what it is DOING are both measurable without a screenshot:
 *   __figureStyle()  triangles / materials / texture samplers / flat+vcol, off
 *                    the built graph — the style claim, gateable.
 *   __gaitScan(on)   arm the per-frame joint scan on all three figures, then
 *   __gaitScanRead() read the accumulated ranges: knee flexion and elbow
 *                    counter-swing spans, the pelvis bob, cadence and stride
 *                    ranges, and the FOOT SLIDE measured off world joint
 *                    positions. Costs a matrix walk per figure per frame, so it
 *                    is armed by the harness and never by the reader loop.
 *   __maskState()    the vizard, off the graph: on his head, or on the rug.
 * ---------------------------------------------------------------- */
window.__figureStyle = () => world.figureStyle();
harnessOnly.__gaitScan = (on) => world.gaitScan(on !== false);
window.__gaitScanRead = () => world.gaitScanRead();
window.__maskState = () => world.maskState();

/**
 * Frame-time probe. Renders `frames` frames at pixel ratio `dpr` and returns
 * ms percentiles with a gl.finish() inside the timer, so the number is a real
 * frame cost and not just the CPU submit. Restores the ratio it found.
 */
harnessOnly.__perf = (frames = 90, dpr = 2) => {
  const prev = renderer.getPixelRatio();
  const gl = renderer.getContext();
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const px = new Uint8Array(4);
  const sync = () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  render(); sync();
  const ts = [];
  for (let i = 0; i < frames; i++) {
    const a = performance.now();
    render();
    sync();                       // forces the pipeline to drain before we stop
    ts.push(performance.now() - a);
  }
  renderer.setPixelRatio(prev);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  render();
  ts.sort((a, b) => a - b);
  const at = (q) => +ts[Math.min(ts.length - 1, Math.floor(q * ts.length))].toFixed(3);
  return { dpr, frames, aa: WANT_AA, drawW: Math.round(view.w * dpr), drawH: Math.round(view.h * dpr),
           p50: at(0.5), p95: at(0.95), max: +ts[ts.length - 1].toFixed(3),
           mean: +(ts.reduce((s, v) => s + v, 0) / ts.length).toFixed(3),
           tris: assets.tris };
};

/**
 * [R6-2] EVERY CLIPPED PIXEL IN THE INSET, THIS FRAME, off the GL colour buffer.
 *
 * The PNG census in lap.mjs can only run on frames that are worth a file on
 * disk, and round 5's answer to "what does the walk peak at?" was a 0.01 s
 * SAMPLE of a 1/60 s performance — a number nobody could stand behind. This is
 * the same count (luma > 250, every pixel, the same inset rectangle) taken
 * without a screenshot, so the harness can step the sim one FIXED_DT at a time
 * across a walk and report the true envelope. lap.mjs cross-checks it against
 * the PNG count on every frame it shoots, and the two agree.
 */
const HOT_LUMA = 250;
harnessOnly.__insetHot = () => {
  const dpr = renderer.getPixelRatio();
  const gl = renderer.getContext();
  render();
  const rx = Math.round(view.x * dpr), rw = Math.round(view.w * dpr);
  const rh = Math.round(view.h * dpr);
  const ry = Math.round((view.H - (view.y + view.h)) * dpr);   // GL origin, bottom-left
  const buf = new Uint8Array(rw * rh * 4);
  gl.readPixels(rx, ry, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let hot = 0, max = -1, maxRGB = null;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0, n = rw * rh; i < n; i++) {
    const o = i * 4;
    const l = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
    if (l > max) { max = l; maxRGB = [buf[o], buf[o + 1], buf[o + 2]]; }
    if (l > HOT_LUMA) {
      hot++;
      const px = i % rw, py = (i / rw) | 0;
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
  }
  // report the box in PAGE pixels, the way hotPixels() does, so the two
  // measurements of one frame can be laid side by side
  const box = hot ? {
    x: Math.round(view.x + x0 / dpr),
    y: Math.round(view.y + view.h - (y1 + 1) / dpr),
    w: Math.round((x1 - x0 + 1) / dpr), h: Math.round((y1 - y0 + 1) / dpr),
  } : null;
  return { hot, max: +max.toFixed(1), maxRGB, box, pixels: rw * rh, dpr };
};

/**
 * [R6-5] WHERE THE MARGIN'S TYPE IS, AND WHAT COLOUR IT IS SUPPOSED TO BE.
 *
 * Read-only: the rectangles of the live block and the RECEDED ones, split into
 * the body <p> and the small-caps speaker label, plus the CSS colour and the
 * cumulative opacity each is composited at. lap.mjs measures the contrast of
 * these rectangles off the screenshot; these numbers are what the measurement is
 * checked against (authored intent vs what landed on the page).
 */
window.__marginInk = () => {
  const rect = (el, blk) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const cs = getComputedStyle(el);
    return { x: +r.left.toFixed(1), y: +r.top.toFixed(1),
             w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             color: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
             opacity: +(+getComputedStyle(blk).opacity).toFixed(3) };
  };
  const blocks = [...document.querySelectorAll('#blocks .blk')];
  return {
    portrait: view.portrait,
    blocks: blocks.map((b, i) => ({
      unit: b.dataset.unit || '', speaker: b.dataset.speaker || '',
      live: b.classList.contains('live'), past: b.classList.contains('past'),
      opacity: +(+getComputedStyle(b).opacity).toFixed(3),
      body: rect(b.querySelector('p'), b),
      who: rect(b.querySelector('.who'), b),
    })),
  };
};

/**
 * [R6-5] Hide the type without moving it — `visibility` keeps the layout, so the
 * frame taken with it on differs from the frame taken with it off in EXACTLY the
 * pixels the type paints (glyphs and their shadow). That difference is what makes
 * "this line reads at N:1" a measurement of the ink and the ground under it
 * instead of a guess about what is behind a letter.
 */
harnessOnly.__inkHide = (on) => {
  document.getElementById('blocks').style.visibility = on ? 'hidden' : '';
  return { hidden: !!on };
};

/* [R6-7] ...and this is the only place the mutating set reaches the page. */
if (HARNESS_BOOT) {
  harnessOnly.__errors = errors;
  Object.assign(window, harnessOnly);
}
