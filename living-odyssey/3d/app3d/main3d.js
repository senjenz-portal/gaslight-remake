/**
 * main3d.js — THE BOOK, assembled.
 *
 * The story GRAMMAR is the shipped book's and is imported, never re-authored:
 *   app/units.js   the 81 units, six beats, six leaves, three sets
 *   app/margin.js  the margin's blocks, cue, progress, hint, cameo, leader
 *   app/clock.js   the fixed-step sim clock (determinism)
 *   app/voice.js   the mastered line manifest  (+ app3d/voice3d.js, its player)
 *   app/audio.js   beds and cues
 *   app/sigil.js   the closing card's seeded dedication
 *
 * THE LAYERS UNDER IT, each owning exactly one thing:
 *   render3d.js  the demo's one pipeline (tone map, exposure, shadow, matter)
 *   world.js     ledger -> metres, and the [scale] gate every body faces
 *   stage3d.js   the three signed-off sets, mounted untouched
 *   beats3d.js   THE DIRECTOR — the roster, the marks, the six beats' acts
 *   cine3d.js    THE STORYTELLER — the shot table, the moves, the focus
 *
 * This file is the wiring between them and nothing else. It turns leaves, it
 * fires the unit's act, it opens the verb's gate, it cuts the camera, and it
 * asks the margin to speak. Every decision about WHERE A BODY STANDS lives in
 * beats3d.js; every decision about WHERE THE LENS STANDS lives in shots3d.json.
 *
 * THE PANTOMIME RAIL. units.js is the law and stays byte-identical, so the
 * staging this canvas needs beyond the book's own act/seg tokens is keyed by
 * unit key in EXTRA_ACTS and fired exactly like an act (silent on replay).
 *
 * THE BOOT GATE: [scale]. Nothing renders to the reader until the mounted
 * set's instances have been measured against world.js's size table.
 */
import { UNITS, BEATS, beatOf, END_CARD, SET_OF_PAGE,
         CUE_DEFAULT, FIRST_HINT, validateUnits, unitByKey } from '../../app/units.js';
import { Margin, Cameo, Leader } from '../../app/margin.js';
import { SimClock } from '../../app/clock.js';
import { AudioManager } from '../../app/audio.js';
import { VOICE, VOICE_BASE } from '../../app/voice.js';
import { drawSigil } from '../../app/sigil.js';
import { Stage3D } from './stage3d.js';
import { Director } from './beats3d.js';
import { Voice3D } from './voice3d.js';
import { mountCine } from './cine-mount.js';
import { world, printScaleTable } from './world.js';

const Q = new URLSearchParams(location.search);
const HARNESS = Q.get('harness') === '1';
const DEBUG = Q.get('debug') === '1';
const NOCINE = Q.get('cine') === '0';       /* the set demos' own iso lens */
if (HARNESS) document.documentElement.classList.add('harness');
if (DEBUG) document.documentElement.classList.add('debug');

const errors = [];
const fail = (where, e) => {
  const msg = `${where}: ${(e && e.message) || e}`;
  errors.push(msg);
  console.error(msg, e && e.stack ? e.stack : '');
};
addEventListener('error', (e) => errors.push(`window: ${e.message}`));
addEventListener('unhandledrejection', (e) =>
  errors.push(`rejection: ${(e.reason && e.reason.message) || e.reason}`));

/* THE PANTOMIME RAIL — keyed by unit key, fired exactly like an act.
 * The ledger gives `giant-seat` to ii-05/07/08 and iii-08/09 and plays the
 * meals at his knee; units.js only names the act where the STAGING COLUMN
 * changed, so the rail re-asserts the seat on every unit the ledger puts him
 * at the mark (the call is idempotent — same rig, same mark, same yaw). */
const EXTRA_ACTS = {
  pitiless: ['giant-seat'], shipfast: ['giant-seat'], suppertwo: ['giant-seat'],
  lookhere: ['giant-seat'], besokind: ['giant-seat'], thrice: ['giant-seat'],
  embers: ['stake-to-embers'],       /* BEAT IV — the stake's four moves */
  glowing: ['stake-draw'],
  auger: ['stake-drive'],
  hiss: ['blind-hiss'],
  fright: ['fright-scatter'],
  threetoaman: ['trios-under'],      /* BEAT V — under the fleeces */
  dawn5: ['flock-stream'],
  rock1: ['rock-one'],               /* BEAT VI — the two rocks */
  twiceasfar: ['double-distance'],
  heard: ['rock-two'],
};
/* the wine pantomime rides the two autos after G3 (ledger holds: 3) */
const EXTRA_FX = { besokind: [['pour', 1.6]], thrice: [['pour', 1.2]] };

const LEAN_TAIL = 0.8, LEAN_MIN = 3.0;

/* ---------------- the leaf ---------------- */
const canvas = document.getElementById('stage3d');
const stageEl = document.getElementById('stage');
const wrapEl = document.getElementById('stagewrap');
const coverEl = document.getElementById('cover');
const endEl = document.getElementById('endcard');
const holdEl = document.getElementById('hold');
const targetEl = document.getElementById('target');
const ASPECT = 1408 / 768;

function layout() {
  const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
  const portrait = window.matchMedia('(max-aspect-ratio: 9/10)').matches;
  const pad = portrait ? 0 : 34;
  let sw = Math.max(160, w - pad), sh = sw / ASPECT;
  if (sh > h - pad) { sh = Math.max(120, h - pad); sw = sh * ASPECT; }
  stageEl.style.width = Math.round(sw) + 'px';
  stageEl.style.height = Math.round(sh) + 'px';
  if (cine) cine.setAspect(sw / sh);
}
addEventListener('resize', layout);

/* ---------------- grammar ---------------- */
const margin = new Margin(document);
const cameo = new Cameo(document, {
  ulysses: '../assets/cameo/ulysses.jpg',
  polyphemus: '../assets/cameo/polyphemus.jpg',
  'a-cyclops': '../assets/cameo/cyclops.jpg',
  'the-men': '../assets/cameo/men.jpg',
});
const leader = new Leader(document);
const clock = new SimClock();
if (HARNESS) clock.harness = true;
const audio = new AudioManager('../assets/audio/');
const voice = new Voice3D(audio, VOICE, VOICE_BASE.replace('./assets/', '../assets/'));
voice.enabled = !HARNESS;

/* ---------------- the stage, the director, the storyteller ---------------- */
const stage = new Stage3D(canvas);
const director = new Director(stage, { errors, audio });
stage.director = director;
let cine = null;
layout();

/* ---------------- reader state ---------------- */
let idx = -1, page = null, ended = false;
let lean = Q.get('lean') === '1';
let holdK = 0, holding = false, holdRest = 0, holdResolved = false;
let gateResolved = false, gateMisses = 0;
let autoDue = 0, unitT0 = 0;
const shown = [];
const gates = {};
let hesitation = null;                /* the defy gate's held breath */

const unitAt = (i) => UNITS[i] || null;
const cur = () => unitAt(idx);

/* ---------------- the leaf turn ---------------- */
async function goToPage(p) {
  page = p;
  const set = SET_OF_PAGE[p];
  if (!set) return;                   /* the closing card carries no picture */
  try { await stage.mount(set); } catch (e) { fail(`mount ${set}`, e); }
}

/* ---------------- units ---------------- */
async function enterUnit(i, { silent = false } = {}) {
  const u = unitAt(i);
  if (!u) return endBook();
  idx = i;
  unitT0 = stage.simT;
  director.beat = u.beat || 1;        /* cave-predawn is beat-aware (leaf 3 vs 4) */
  if (u.page !== page || SET_OF_PAGE[u.page] !== stage.setName) await goToPage(u.page);

  /* THE STAGING: the unit's own act, the rail's, the gate's replay, the seg */
  if (u.act) director.fire(u.act, silent);
  for (const act of EXTRA_ACTS[u.key] || []) director.fire(act, silent);
  if (silent && u.gateAct) director.fire(u.gateAct, true);
  if (u.seg) director.startSeg(u.seg, u.segDur || 6.0, silent);

  /* THE CUT: a unit advance is a cut, and the camera takes it on ENTER.
     The station is settled first (one zero-length step installs it), then the
     PROSCENIUM LAW measures it against the bodies now on the leaf — the shot
     table was baked over an empty set, and a body is a solid thing. */
  if (cine) {
    try {
      cine.enter(u.id);
      cine.step(stage.simT, 0);
      const row = cine.cam.shot;
      director.clearStation(stage.camera, row && row.frame && row.frame.anchor);
    } catch (e) { fail('cine.enter', e); }
  }

  margin.show(u);
  const b = beatOf(u);
  const first = UNITS.findIndex((x) => (x.beat || 1) === b.n);
  margin.progress(b, i - first, b.units);
  margin.cue(cueFor(u));
  applyCameo(i);

  holdK = 0; holding = false; holdResolved = false;
  holdRest = u.rest ? holdRest : 0;
  gateResolved = false;
  director.setHold(0);
  paintHold(0);
  setHoldRing(u.verb === 'hold' || u.verb === 'release');
  setTargetRing(u.verb === 'target');
  if (u.verb === 'target' && u.target === 'cyclops')
    hesitation = { armed: stage.simT, spent: null };

  autoDue = 0;
  if (u.verb === 'auto') autoDue = stage.simT + (u.dwell || u.segDur || 3.0);
  if (lean && u.verb === 'click') autoDue = stage.simT + leanDue(u);

  if (!silent) {
    if (u.bed) { try { audio.bed(u.bed); } catch (e) { fail('audio.bed', e); } }
    if (u.sfx) { try { audio.cue(u.sfx); } catch (e) { fail('audio.cue', e); } }
    if (voice.enabled) {
      voice.play(u.key, stage.simT).catch(() => {});
      const next = UNITS[i + 1];
      if (next) voice.prefetch(next.key);
    } else if (VOICE[u.key]) {
      /* the muted lap still produces the full list — the voice is a card the
         sim asserts, not a fact it reads (the determinism law) */
      voice.log.push({ t: +stage.simT.toFixed(3), key: u.key, dur: VOICE[u.key].dur });
    }
    for (const [id, d] of (EXTRA_FX[u.key] || [])) director.fx(id, d);
  }

  shown.push({ i, id: u.id, set: u.set, verb: u.verb, simT: +stage.simT.toFixed(3),
               census: director.census() });
  window.__unitId = u.id;
  document.body.dataset.unit = u.id;
  document.body.dataset.verb = u.verb;
  document.body.dataset.gate = u.target || '';
  document.body.dataset.set = u.set || '';
  document.body.dataset.beat = String(u.beat || 1);
}

function cueFor(u) {
  if (!u) return '';
  if (u.verb === 'hold' && holdResolved) return CUE_DEFAULT.click;
  if (u.cue !== undefined) return u.cue;
  return CUE_DEFAULT[u.verb] || '';
}
function applyCameo(i) {
  const p = UNITS[i].page;
  for (let j = i; j >= 0 && UNITS[j].page === p; j--) {
    if (!Object.prototype.hasOwnProperty.call(UNITS[j], 'cameo')) continue;
    if (UNITS[j].cameo) cameo.set(UNITS[j].cameo, UNITS[j].cap || '');
    else cameo.hide();
    return;
  }
  cameo.hide();
}
function leanDue(u) {
  const d = (VOICE[u.key] && VOICE[u.key].dur) || 0;
  return Math.max(u.dwell || 0, d > 0 ? d + LEAN_TAIL : LEAN_MIN);
}

/** Returns a promise so a harness hand can wait for the leaf (and its set). */
function advance() {
  if (ended) return Promise.resolve(false);
  const u = cur();
  if (u && u.endsBook) { endBook(); return Promise.resolve(true); }
  const next = idx + 1;
  if (next >= UNITS.length) { endBook(); return Promise.resolve(true); }
  return enterUnit(next).then(() => true);
}

function endBook() {
  if (ended) return;
  ended = true;
  director.fire('bookOffstage');
  margin.clear();
  margin.progressEnd();
  margin.cue('');
  setHoldRing(false); setTargetRing(false);
  coverEl.style.transition = 'opacity .9s ease';
  coverEl.style.opacity = '1';
  endEl.querySelector('.kick').textContent = END_CARD.kicker;
  endEl.querySelector('.ttl').textContent = END_CARD.title;
  /* THE MEMORY AMENDMENT: the closing card's sub gains ONE clause from how
     long the reader held his name at the defy gate. */
  const held = !!(hesitation && hesitation.spent !== null && hesitation.spent >= 4);
  endEl.querySelector('.sub').textContent =
    END_CARD.sub + (held ? END_CARD.subHeld : END_CARD.subEager);
  endEl.style.transition = 'opacity 1.1s ease .3s';
  endEl.style.opacity = '1';
  setTimeout(() => endEl.classList.add('settled'), HARNESS ? 0 : 900);
  const name = document.getElementById('dedname');
  name.placeholder = END_CARD.ask;
  name.addEventListener('input', () => {
    const v = name.value.trim();
    document.getElementById('dedicate').classList.toggle('named', !!v);
    document.getElementById('dedline').textContent = v ? `${END_CARD.belonged} ${v}` : '';
    if (v) { try { drawSigil(document.getElementById('sigil'), v); } catch (e) { fail('sigil', e); } }
  });
  window.__ended = true;
}

/* ---------------- the verbs ---------------- */
function setHoldRing(on) {
  holdEl.classList.toggle('on', !!on);
  if (!on) return;
  const r = stageEl.getBoundingClientRect();
  holdEl.style.left = (r.left + r.width * 0.5) + 'px';
  holdEl.style.top = (r.top + r.height * 0.72) + 'px';
}
function paintHold(k) {
  const arc = holdEl.querySelector('.arc');
  if (arc) arc.setAttribute('stroke-dashoffset', String(207.35 * (1 - k)));
}
function setTargetRing(on) {
  targetEl.classList.toggle('on', !!on);
  if (on) paintTarget();
}
/** the reader's ring rides the TARGET ITSELF, projected through the live lens */
function paintTarget() {
  const u = cur();
  if (!u || !u.target || !stage.camera) return;
  const p = director.targetWorld(u.target);
  if (!p) return;
  const s = projectToScreen(p);
  targetEl.style.left = s.x + 'px';
  targetEl.style.top = s.y + 'px';
}

function hitTarget(clientX, clientY) {
  const u = cur();
  if (!u || u.verb !== 'target' || !u.target) return false;
  if (!director.targetLive(u.target)) return false;
  const p = director.targetWorld(u.target);
  if (!p) return false;
  const s = projectToScreen(p);
  const r = stageEl.getBoundingClientRect();
  const reach = Math.max(44, r.width * 0.09);
  return Math.hypot(clientX - s.x, clientY - s.y) <= reach;
}

function resolveGate(u) {
  if (gateResolved) return;
  gateResolved = true;
  if (hesitation && hesitation.spent === null && u.target === 'cyclops')
    hesitation.spent = +(stage.simT - hesitation.armed).toFixed(2);
  if (u.gateAct) director.fire(u.gateAct);
  if (u.gateSfx) { try { audio.cue(u.gateSfx); } catch (_) { /* silent */ } }
  gates[u.key] = { ok: true, verb: 'target', target: u.target,
                   misses: gateMisses, at: +stage.simT.toFixed(3) };
  setTargetRing(false);
  advance();
}

function pressDown() {
  const u = cur();
  if (!u) return;
  audioUnlock();
  if (u.verb === 'hold' || u.verb === 'release') holding = true;
}
function pressUp(ev) {
  const u = cur();
  if (!u || ended) return;
  if (u.verb === 'target') {
    if (ev && hitTarget(ev.clientX, ev.clientY)) resolveGate(u);
    else gateMisses++;
    return;
  }
  if (u.verb === 'hold') { holding = false; return; }
  if (u.verb === 'release') {
    holding = false;
    if (holdK >= 1) {
      holdResolved = true;
      if (u.gateAct) director.fire(u.gateAct);
      gates[u.key] = { ok: true, verb: 'release', at: +stage.simT.toFixed(3) };
      advance();
    } else if (u.rest) holdRest = holdK;      /* a rested hold keeps its ground */
    return;
  }
  if (u.verb === 'auto' || u.verb === 'clock') return;   /* the clock turns these */
  advance();                                             /* click */
}

/** the wait law: a unit may declare it waits on a thing the stage is doing */
function waitDone(name) {
  const rocks = stage.set && stage.set.ROCKS;
  if (!rocks) return true;
  const i = name === 'rock1' ? 0 : name === 'rock2' ? 1 : -1;
  if (i < 0) return true;
  return stage.simT >= rocks[i].offset + rocks[i].flight;
}

function stepVerb(dt) {
  const u = cur();
  if (!u || ended) return;
  if (u.verb === 'target') { paintTarget(); return; }
  if (u.verb === 'hold' || u.verb === 'release') {
    const need = u.hold || (u.verb === 'release' ? 0.6 : 1.6);
    if (holding) holdK = Math.min(1, holdK + dt / need);
    else if (!u.rest) holdK = Math.max(0, holdK - dt / (need * 0.7));
    else holdK = Math.max(holdRest, holdK);
    paintHold(holdK);
    director.setHold(holdK);
    if (u.verb === 'hold' && holdK >= 1 && !holdResolved) {
      holdResolved = true;
      gates[u.key] = { ok: true, verb: 'hold', at: +stage.simT.toFixed(3) };
      /* G4 IS THE BLINDING'S STARTING PISTOL. The stake goes into the embers
         on the reader's own hold, and Beat IV's four `clock` units are all
         measured from that instant (auger 4.2 s · bore 7.4 · hiss 10.4 ·
         fright 12.6). Nothing else in the beat reads a clock. */
      if (u.key === 'embers') director.armClock();
      margin.cue(CUE_DEFAULT.click);
      advance();
    }
    return;
  }
  /* THE SEG HOLD: a unit that carries a pantomime does not turn under it */
  if (u.seg && u.segHold && stage.simT - unitT0 < (u.segDur || 6.0)) return;
  if (u.verb === 'clock') {
    const t = director.clockT();
    if (t !== null && t >= (u.at || 0) && (!u.wait || waitDone(u.wait))) advance();
    return;
  }
  if (autoDue && stage.simT >= autoDue) advance();
}

/* ---------------- audio (first gesture) ---------------- */
let unlocked = false;
function audioUnlock() {
  if (unlocked || HARNESS) return;
  unlocked = true;
  try { audio.unlock(); } catch (e) { fail('audio.unlock', e); }
}

/* ---------------- the loop ---------------- */
function step(dt) {
  stage.step(dt);
  try { audio.setTime(stage.simT); } catch (_) { /* the bed is optional */ }
  if (cine) {
    try { cine.step(stage.simT, dt); } catch (e) { fail('cine.step', e); }
    /* the two moments the DIRECTOR takes the frame back: the blinding shake
       and the under-fleece eye. Everything else is the shot table's. */
    director.driveCamera(stage.camera, stage.simT, cine.cam.anchor);
  }
  stepVerb(dt);
  if (DEBUG) {
    const s = stage.resolve({ a: 'ulysses' });
    if (s) leader.draw(margin.anchorPoint(false), projectToScreen(s.p), false);
  }
}
function projectToScreen(p) {
  const v = p.clone().project(stage.camera);
  const r = stageEl.getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
}

let raf = 0;
function frame(nowMs) {
  raf = requestAnimationFrame(frame);
  clock.pump(nowMs, step);
  stage.render();
}

/* ---------------- boot ---------------- */
async function boot() {
  const bad = validateUnits();
  if (bad.length) fail('validateUnits', new Error(bad.slice(0, 3).join(' | ')));

  await goToPage(UNITS[0].page);

  /* THE [scale] BOOT GATE */
  let gateRows = [];
  if (Q.get('scalegate') === 'all') gateRows = await gateEverySet();
  else gateRows = world.gate({ label: `THE INSTANCE TABLE · set ${stage.setName}` }).rows;
  window.__scale = { rows: gateRows, ok: gateRows.every((r) => r.verdict === 'PASS') };
  for (const d of stage.dressing())
    console.log(`[scale] (advisory, set dressing — not gated) ${d.set}/${d.part} ` +
                `height ${d.measuredM} m · length ${d.lengthM} m`);

  /* THE STORYTELLER takes the lens (unless a set demo asked for its own iso) */
  if (!NOCINE) {
    try {
      cine = await mountCine(stage, './shots3d.json');
      const r = stageEl.getBoundingClientRect();
      cine.setAspect((r.width || 1408) / (r.height || 768));
    } catch (e) { fail('mountCine', e); }
  }

  await enterUnit(0);
  margin.hint(true, FIRST_HINT);

  const leanBtn = document.getElementById('lean');
  if (leanBtn) leanBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setLean(!lean);
  });
  addEventListener('pointerdown', pressDown, { passive: true });
  addEventListener('pointerup', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('#dedicate, #chrome')) return;
    margin.hint(false);
    pressUp(ev);
  }, { passive: true });

  raf = requestAnimationFrame(frame);
  window.__sceneReady = true;
}

function setLean(on) {
  lean = !!on;
  document.body.classList.toggle('lean', lean);
  const b = document.getElementById('lean');
  if (b) {
    b.setAttribute('aria-pressed', lean ? 'true' : 'false');
    b.textContent = lean ? 'Lean back · on' : 'Lean back';
  }
  const u = cur();
  if (u && u.verb === 'click') autoDue = lean ? stage.simT + leanDue(u) : 0;
  return lean;
}

/** Mount all three sets in turn and print ONE table for the whole book. */
async function gateEverySet() {
  const rows = [];
  for (const set of ['shore', 'cave', 'sea']) {
    await stage.mount(set);
    rows.push(...world.audit().rows);
    for (const d of stage.dressing())
      console.log(`[scale] (advisory, set dressing — not gated) ${d.set}/${d.part} ` +
                  `height ${d.measuredM} m · length ${d.lengthM} m`);
  }
  printScaleTable(rows, { label: 'THE INSTANCE TABLE · every set' });
  await stage.mount(SET_OF_PAGE[UNITS[0].page]);
  return rows;
}

/* ---------------- the harness's hands ---------------- */
window.__book = {
  get simT() { return stage.simT; },
  get unit() { const u = cur(); return u ? u.id : null; },
  get index() { return idx; },
  get ended() { return ended; },
  get shown() { return shown; },
  get gates() { return gates; },
  get lean() { return lean; },
  advance,
  goto(id) {
    const u = unitByKey(id);
    if (!u) return Promise.resolve(false);
    return enterUnit(UNITS.indexOf(u)).then(() => true);
  },
  /** replay every unit up to `id` SILENTLY, then enter it live — the harness's
   *  way of landing on a beat with the leaf staged as the story left it */
  async seek(id) {
    const target = unitByKey(id);
    if (!target) return false;
    const n = UNITS.indexOf(target);
    for (let i = 0; i <= n; i++) await enterUnit(i, { silent: i < n });
    return true;
  },
  /** FIXED-STEP sim time — the only honest way to drive the book from outside:
   *  the same 1/60 quanta the reader's rAF feeds it, so a harness lap and a
   *  read lap take the identical path through every mover. */
  run(seconds) { clock.harness = true; return clock.advance(seconds, step); },
  step(dt) { step(dt); },
  /** an absolute JUMP of the stage clock (set-parity screenshots only — this
   *  skips the story's steps and is not a lap) */
  setSim(t) { stage.setSim(t); },
  setOrbit(deg) { stage.setOrbit(deg); },
  setLean,
  hold(on) { holding = !!on; if (on) audioUnlock(); },
  /** resolve the live target gate the way a reader's finger would */
  tap() {
    const u = cur();
    if (!u || u.verb !== 'target') return false;
    if (!director.targetLive(u.target)) return false;
    resolveGate(u);
    return true;
  },
  targetLive() { const u = cur(); return !!(u && u.target && director.targetLive(u.target)); },
  clockT() { return director.clockT(); },
  scale() { return world.gate({ label: `THE INSTANCE TABLE · set ${stage.setName}` }); },
  describe() { return stage.describe(); },
  dressing() { return stage.dressing(); },
  census() { return director.census(); },
  snapshot() { return director.snapshot(); },
  routes() { return director.routes.map((r) => ({ label: r.label, hits: r.hits })); },
  voice() { return voice.snapshot(); },
  actorPitch() {
    const out = {};
    for (const [id, a] of stage.actors) out[id] = a.pitchDeg();
    return out;
  },
  beats: BEATS.map((b) => b.num),
  stage, director,
};
window.__cine = () => (cine ? cine.metrics() : null);
window.__errors = () => errors.slice();

boot().catch((e) => fail('boot', e));
