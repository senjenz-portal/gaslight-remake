/**
 * main3d.js — THE BOOK, booted on the new stage.
 *
 * The story GRAMMAR is the shipped book's and is imported, never re-authored:
 *   app/units.js   the 81 units, six beats, six leaves, three sets
 *   app/margin.js  the margin's blocks, cue, progress, hint, cameo, leader
 *   app/clock.js   the fixed-step sim clock (determinism)
 *   app/voice.js   the mastered line manifest  (+ app3d/voice3d.js, its player)
 *   app/audio.js   beds and cues
 *   app/sigil.js   the closing card's seeded dedication
 *
 * What is NEW is only the stage under it: Stage3D (render3d's one pipeline,
 * world.js's scale authority, the three signed-off sets). This file is the
 * FOUNDATION's wiring — the leaf turns, the margin speaks, the set changes
 * with the page, the verbs resolve, the closing card lands. The per-unit
 * STAGING (who stands where on which beat, the gate anchors, the set-pieces)
 * is the story lane's work on top of this, and is deliberately absent.
 *
 * THE BOOT GATE: [scale]. Nothing renders to the reader until the mounted
 * set's instances have been measured against world.js's size table. Add
 * ?scalegate=all to mount all three sets in turn and print the whole book's
 * instance table in one pass (what the smoke does).
 */
import { UNITS, BEATS, beatOf, END_CARD, END_PAGE, SET_OF_PAGE,
         CUE_DEFAULT, FIRST_HINT, validateUnits, unitByKey } from '../../app/units.js';
import { Margin, Cameo, Leader } from '../../app/margin.js';
import { SimClock } from '../../app/clock.js';
import { AudioManager } from '../../app/audio.js';
import { VOICE, VOICE_BASE } from '../../app/voice.js';
import { drawSigil } from '../../app/sigil.js';
import { Stage3D } from './stage3d.js';
import { Voice3D } from './voice3d.js';
import { world, printScaleTable } from './world.js';

const Q = new URLSearchParams(location.search);
const HARNESS = Q.get('harness') === '1';
const DEBUG = Q.get('debug') === '1';
if (HARNESS) document.documentElement.classList.add('harness');
if (DEBUG) document.documentElement.classList.add('debug');

const errors = [];
const fail = (where, e) => {
  const msg = `${where}: ${(e && e.message) || e}`;
  errors.push(msg);
  console.error(msg, e && e.stack ? e.stack : '');
};

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
}
addEventListener('resize', layout);
layout();

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
const audio = new AudioManager('../assets/audio/');
const voice = new Voice3D(audio, VOICE, VOICE_BASE.replace('./assets/', '../assets/'));
voice.enabled = !HARNESS;

/* ---------------- the stage ---------------- */
const stage = new Stage3D(canvas);

/* ---------------- reader state ---------------- */
let idx = -1;                    /* index into UNITS */
let page = null;                 /* the leaf we are on */
let ended = false;
let armedAt = 0;                 /* sim time the current verb armed */
let lean = false;                /* lean-back: the narration turns click leaves */
let holdK = 0, holding = false, holdRest = 0;
let autoDue = 0;
const shown = [];                /* the lap's own record */

const unitAt = (i) => UNITS[i] || null;
const cur = () => unitAt(idx);

/* ---------------- the leaf turn ---------------- */
async function goToPage(p) {
  page = p;
  const set = SET_OF_PAGE[p];
  if (!set) return;              /* the closing card carries no picture */
  try { await stage.mount(set); } catch (e) { fail(`mount ${set}`, e); }
}

/* ---------------- units ---------------- */
async function enterUnit(i) {
  const u = unitAt(i);
  if (!u) return endBook();
  idx = i;
  /* the leaf decides the set — and so does a harness hand that mounted
     something else behind the book's back */
  if (u.page !== page || SET_OF_PAGE[u.page] !== stage.setName) await goToPage(u.page);

  margin.show(u);
  /* progress counts INSIDE the beat — the unit the reader is actually in */
  const b = beatOf(u);
  const inBeat = UNITS.filter((x) => x.beat === u.beat);
  margin.progress(b, inBeat.indexOf(u), inBeat.length);
  margin.cue(u.cue || CUE_DEFAULT[u.verb] || '');
  if (u.cameo) cameo.set(u.cameo, u.cap || '');
  else if (u.clear) cameo.hide();

  holdK = 0; holding = false; holdRest = u.rest ? holdRest : 0;
  armedAt = stage.simT;
  autoDue = (u.verb === 'auto' || u.verb === 'clock') ? stage.simT + (u.dur || u.segDur || 3.0) : 0;
  /* LEAN BACK (A8): the narration's own clock turns the CLICK leaves; every
     VERB gate still waits for the hand. */
  if (lean && u.verb === 'click')
    autoDue = stage.simT + ((VOICE[u.key] && VOICE[u.key].dur) || 3.0) + 0.8;
  setHoldRing(u.verb === 'hold' || u.verb === 'release');

  if (voice.enabled && VOICE[u.key]) voice.play(u.key, stage.simT).catch(() => {});
  shown.push({ i, id: u.id, set: u.set, verb: u.verb, simT: +stage.simT.toFixed(3) });
  window.__unitId = u.id;
}

/** Returns a promise so a harness hand can wait for the leaf (and its set). */
function advance() {
  if (ended) return Promise.resolve(false);
  const next = idx + 1;
  if (next >= UNITS.length) { endBook(); return Promise.resolve(true); }
  return enterUnit(next).then(() => true);
}

function endBook() {
  if (ended) return;
  ended = true;
  margin.clear();
  margin.progressEnd();
  margin.cue('');
  coverEl.style.transition = 'opacity .9s ease';
  coverEl.style.opacity = '1';
  endEl.querySelector('.kick').textContent = END_CARD.kicker;
  endEl.querySelector('.ttl').textContent = END_CARD.title;
  endEl.querySelector('.sub').textContent = END_CARD.sub;
  endEl.style.transition = 'opacity 1.1s ease .3s';
  endEl.style.opacity = '1';
  setTimeout(() => endEl.classList.add('settled'), HARNESS ? 0 : 900);
  const name = document.getElementById('dedname');
  name.placeholder = END_CARD.ask;
  name.addEventListener('input', () => {
    const v = name.value.trim();
    const ded = document.getElementById('dedicate');
    ded.classList.toggle('named', !!v);
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

function pressDown() {
  const u = cur();
  if (!u) return;
  audioUnlock();
  if (u.verb === 'hold' || u.verb === 'release') { holding = true; return; }
}
function pressUp() {
  const u = cur();
  if (!u || ended) return;
  if (u.verb === 'hold') { holding = false; return; }
  if (u.verb === 'release') {
    holding = false;
    if (holdK >= 1) advance();
    else if (u.rest) holdRest = holdK;               /* a rested hold keeps its ground */
    return;
  }
  if (u.verb === 'auto' || u.verb === 'clock') return;  /* the clock turns these */
  advance();                                            /* click + target */
}

function stepVerb(dt) {
  const u = cur();
  if (!u || ended) return;
  if (u.verb === 'hold' || u.verb === 'release') {
    const need = u.holdDur || (u.verb === 'release' ? 0.6 : 1.6);
    if (holding) holdK = Math.min(1, holdK + dt / need);
    else if (!u.rest) holdK = Math.max(0, holdK - dt / (need * 0.7));
    else holdK = Math.max(holdRest, holdK);
    paintHold(holdK);
    if (u.verb === 'hold' && holdK >= 1) advance();
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
  audio.setTime(stage.simT);
  stepVerb(dt);
  if (DEBUG) {
    const u = cur();
    const s = u && stage.resolve({ a: 'ulysses' });
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
  const gateOk = gateRows.every((r) => r.verdict === 'PASS');
  window.__scale = { rows: gateRows, ok: gateOk };
  for (const d of stage.dressing())
    console.log(`[scale] (advisory, set dressing — not gated) ${d.set}/${d.part} ` +
                `height ${d.measuredM} m · length ${d.lengthM} m`);

  await enterUnit(0);
  margin.hint(true, FIRST_HINT);

  const leanBtn = document.getElementById('lean');
  if (leanBtn) leanBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    lean = !lean;
    leanBtn.setAttribute('aria-pressed', lean ? 'true' : 'false');
    const u = cur();
    if (lean && u && u.verb === 'click')
      autoDue = stage.simT + ((VOICE[u.key] && VOICE[u.key].dur) || 3.0) + 0.8;
    if (!lean && u && u.verb === 'click') autoDue = 0;
  });
  addEventListener('pointerdown', pressDown, { passive: true });
  addEventListener('pointerup', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('#dedicate, #chrome')) return;
    margin.hint(false);
    pressUp();
  }, { passive: true });

  raf = requestAnimationFrame(frame);
  window.__sceneReady = true;
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
  advance,
  goto(id) {
    const u = unitByKey(id);
    if (!u) return Promise.resolve(false);
    return enterUnit(UNITS.indexOf(u)).then(() => true);
  },
  async mount(set) { return stage.mount(set); },
  setSim(t) { stage.setSim(t); },
  setOrbit(deg) { stage.setOrbit(deg); },
  scale() { return world.gate({ label: `THE INSTANCE TABLE · set ${stage.setName}` }); },
  describe() { return stage.describe(); },
  dressing() { return stage.dressing(); },
  actorPitch() {
    const out = {};
    for (const [id, a] of stage.actors) out[id] = a.pitchDeg();
    return out;
  },
  beats: BEATS.map((b) => b.num),
  stage,
};
window.__errors = () => errors.slice();

boot().catch((e) => fail('boot', e));
