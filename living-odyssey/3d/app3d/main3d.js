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
import * as THREE from 'three';
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
  dropAim();                          /* a cut invalidates every screen fact */
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
/* ------------------------------------------------------------------ *
 * THE AIM — ONE MECHANISM, and every gate and the reader's ring use it.
 *
 * The storyteller gave every unit its own lens, and a shot is composed on the
 * SPEAKER, not on the reader's target: at G1 the council is an OTS on Ulysses
 * and the ship lies at the left edge of the frame. A gate hit-tested against
 * the projection of the target's BOUNDING-BOX CENTRE therefore aimed at a
 * point 340 px OUTSIDE the picture — the ship was on screen and unclickable,
 * and the ring sat in the margin.
 *
 * So nothing here projects a mark. The question a gate asks is the only
 * honest one — DOES THIS PIXEL SHOW THE THING? — and it is answered by a ray
 * cast from the ACTIVE camera through the pointer into the target's own
 * geometry. The reader's press gets that answer exactly, every time.
 *
 * The RING asks the same question, but it asks it eight times a second, and a
 * ray into a skinned giant costs about two milliseconds. So the ring is aimed
 * in two stages. STAGE ONE is free and proposes candidate pixels: a rigged
 * body offers its BONES (they are inside it by construction), anything else
 * is swept ray-versus-part-BOX. STAGE TWO puts those candidates to the
 * GEOMETRY, nearest the silhouette's middle first, within a budget set by
 * what the target IS — and the first pixel the geometry answers for is where
 * the ring goes. On the rendered target, at a cost the frame can pay.
 * ------------------------------------------------------------------ */
const AIM_GRID = 9;                 /* samples across the target's screen box */
const AIM_PERIOD = 1 / 8;           /* sim-seconds between ring repaints */
const AIM_PARTS = 192;              /* per-mesh boxes before the sweep coarsens */
/* what one ring repaint may spend on GEOMETRY. A ray into static set geometry
 * costs about 20 µs and a ray into a skinned rig about two milliseconds, so
 * the budget is set by what the target IS — deterministically, never by a
 * clock, or two laps would not land on the same pixel. A rig also fills far
 * more of the frame than a distant ship, so it needs far fewer tries. */
const AIM_RAYS_STATIC = AIM_GRID * AIM_GRID + 1;
const AIM_RAYS_SKINNED = 2;
const ray = new THREE.Raycaster();
const ndc2 = new THREE.Vector2();
const boxTmp = new THREE.Box3();
const vTmp = new THREE.Vector3();
let aimCache = { name: '', t: -1e9, hit: null };
let targetRing = false;

const rectOf = () => stageEl.getBoundingClientRect();
const toNdc = (clientX, clientY, r) => ({
  x: ((clientX - r.left) / r.width) * 2 - 1,
  y: -((((clientY - r.top) / r.height) * 2) - 1),
});
const toClient = (nx, ny, r) => ({
  x: r.left + (nx * 0.5 + 0.5) * r.width,
  y: r.top + (-ny * 0.5 + 0.5) * r.height,
});
const inRect = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/** THE TARGET'S SILHOUETTE, cheaply: one world box per drawn mesh under it.
 *  A ship is a hull, a mast and a sail with sky between them; sweeping those
 *  boxes puts the ring on the vessel instead of the air beside it, and a
 *  ray/box test costs nothing — the reader's own press is still answered by
 *  the geometry itself (pixelIsTarget). */
function targetBoxes(obj) {
  const out = [];
  let skinned = false;
  obj.updateWorldMatrix(true, true);
  obj.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.isSkinnedMesh) skinned = true;
    /* AN INSTANCED MESH IS NOT ITS GEOMETRY. A ship's twenty oars are one
       InstancedMesh whose geometry box is a single oar at the origin; only
       the mesh's own box knows where the instances went. Reading the wrong
       one put the ship's silhouette in the water beside it. */
    let local = null;
    if (o.isInstancedMesh) {
      if (!o.boundingBox) o.computeBoundingBox();
      local = o.boundingBox;
    }
    if (!local) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      local = o.geometry.boundingBox;
    }
    if (local) out.push(local.clone().applyMatrix4(o.matrixWorld));
  });
  if (!out.length || out.length > AIM_PARTS)
    return { boxes: [new THREE.Box3().setFromObject(obj)], skinned };
  return { boxes: out, skinned };
}

/** the NDC box the target's world AABB covers, clipped to the frame */
function screenBox(obj, cam) {
  boxTmp.setFromObject(obj);
  if (!isFinite(boxTmp.min.x)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = 0;
  for (let i = 0; i < 8; i++) {
    vTmp.set(i & 1 ? boxTmp.max.x : boxTmp.min.x,
             i & 2 ? boxTmp.max.y : boxTmp.min.y,
             i & 4 ? boxTmp.max.z : boxTmp.min.z);
    /* a corner behind the lens has no honest NDC — project() mirrors it */
    if (vTmp.clone().applyMatrix4(cam.matrixWorldInverse).z >= -cam.near) { behind++; continue; }
    vTmp.project(cam);
    x0 = Math.min(x0, vTmp.x); x1 = Math.max(x1, vTmp.x);
    y0 = Math.min(y0, vTmp.y); y1 = Math.max(y1, vTmp.y);
  }
  if (behind === 8) return null;                       /* wholly behind the lens */
  if (behind) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }    /* straddles it: sweep the frame */
  x0 = Math.max(-1, x0); y0 = Math.max(-1, y0);
  x1 = Math.min(1, x1); y1 = Math.min(1, y1);
  if (x1 < x0 || y1 < y0) return null;                 /* wholly off the frame */
  return { x0, y0, x1, y1 };
}

/** WHERE THE TARGET RENDERS: {x,y} client px on the pixels it actually covers,
 *  or null when the live shot does not show it at all. */
function computeAim(name) {
  const cam = stage.camera;
  const obj = director.targetObject(name);
  if (!cam || !obj || !obj.visible) return null;
  cam.updateMatrixWorld();
  const b = screenBox(obj, cam);
  if (!b) return null;
  /* STAGE ONE — free: which samples fall on the thing's silhouette.
     A RIGGED BODY IS ASKED ITS SKELETON. A giant's bind-pose box stands
     taller than he does and holds the air between his arm and his side, so
     its middle is his crown or the sky beside it; his BONES are inside him by
     construction, and they cost a matrix read each. */
  const { boxes, skinned } = targetBoxes(obj);
  const cands = [];
  let sx = 0, sy = 0;
  const offer = (nx, ny) => { cands.push([nx, ny]); sx += nx; sy += ny; };
  if (skinned) {
    obj.traverseVisible((o) => {
      if (!o.isSkinnedMesh || !o.skeleton) return;
      for (const bone of o.skeleton.bones) {
        vTmp.setFromMatrixPosition(bone.matrixWorld);
        if (vTmp.clone().applyMatrix4(cam.matrixWorldInverse).z >= -cam.near) continue;
        vTmp.project(cam);
        if (Math.abs(vTmp.x) > 1 || Math.abs(vTmp.y) > 1) continue;
        offer(vTmp.x, vTmp.y);
      }
    });
  }
  if (!cands.length) {
    for (let j = 0; j < AIM_GRID; j++) {
      for (let i = 0; i < AIM_GRID; i++) {
        /* cell CENTRES, not corners: a target clipped by the frame edge is
           aimed at just inside the picture rather than exactly on its rim */
        const nx = b.x0 + (b.x1 - b.x0) * ((i + 0.5) / AIM_GRID);
        const ny = b.y0 + (b.y1 - b.y0) * ((j + 0.5) / AIM_GRID);
        ray.setFromCamera(ndc2.set(nx, ny), cam);
        let on = false;
        for (let k = 0; k < boxes.length && !on; k++) on = ray.ray.intersectsBox(boxes[k]);
        if (on) offer(nx, ny);
      }
    }
  }
  /* the middle of the silhouette — and the fallback when a target is thinner
     than the sample spacing (a drawn sword at six metres is). It is still ON
     the frame, which the projected world centre is not required to be. */
  const mid = cands.length ? [sx / cands.length, sy / cands.length]
                           : [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  /* STAGE TWO — bounded: put the middle, then its nearest neighbours, to the
     GEOMETRY, and take the first pixel the geometry answers for */
  const order = cands.slice().sort((p, q) =>
    ((p[0] - mid[0]) ** 2 + (p[1] - mid[1]) ** 2) - ((q[0] - mid[0]) ** 2 + (q[1] - mid[1]) ** 2));
  order.unshift(mid);
  const budget = skinned ? AIM_RAYS_SKINNED : AIM_RAYS_STATIC;
  /* a bone-picked middle is inside the body already — one ray confirms it */
  let pick = mid, onGeometry = false;
  for (let i = 0; i < order.length && i < budget; i++) {
    ray.setFromCamera(ndc2.set(order[i][0], order[i][1]), cam);
    if (ray.intersectObject(obj, true).length) { pick = order[i]; onGeometry = true; break; }
  }
  /* NO FICTION. If nothing proposed the target and the geometry did not
     answer either, the live shot does not show it — and a gate must not be
     resolvable at a pixel that shows sky. */
  if (!cands.length && !onGeometry) return null;
  const r = rectOf();
  const c = toClient(pick[0], pick[1], r);
  if (!inRect(c.x, c.y, r)) return null;
  return { x: c.x, y: c.y, nx: +pick[0].toFixed(4), ny: +pick[1].toFixed(4),
           covered: cands.length, swept: cands.length > 0, onGeometry };
}

/** the cached aim. One repaint per AIM_PERIOD of SIM time — a pure function
 *  of the clock, so a lap is deterministic — and the ring the reader sees and
 *  the reach his press is measured against are always the same number. */
function aimAt(name) {
  if (!name) return null;
  if (aimCache.name !== name || Math.abs(stage.simT - aimCache.t) >= AIM_PERIOD)
    aimCache = { name, t: stage.simT, hit: computeAim(name) };
  return aimCache.hit;
}
const dropAim = () => { aimCache = { name: '', t: -1e9, hit: null }; };

function setTargetRing(on) {
  targetRing = !!on;
  if (!targetRing) { targetEl.classList.remove('on', 'miss'); return; }
  paintTarget();
}
/** the reader's ring rides the PIXELS OF THE TARGET under the live lens */
function paintTarget() {
  if (!targetRing) return;
  const u = cur();
  if (!u || !u.target) return;
  const a = aimAt(u.target);
  targetEl.classList.toggle('on', !!a);
  if (!a) return;
  targetEl.style.left = a.x + 'px';
  targetEl.style.top = a.y + 'px';
}

/** DOES THIS PIXEL SHOW THE THING? — the strict question, no reach, no slop */
function pixelIsTarget(clientX, clientY, name) {
  const cam = stage.camera;
  const obj = name ? director.targetObject(name) : null;
  if (!cam || !obj || !obj.visible) return false;
  const r = rectOf();
  if (!inRect(clientX, clientY, r)) return false;
  cam.updateMatrixWorld();
  const p = toNdc(clientX, clientY, r);
  ray.setFromCamera(ndc2.set(p.x, p.y), cam);
  return ray.intersectObject(obj, true).length > 0;
}

/** THE GATE'S QUESTION: is the reader's finger on the thing itself? */
function hitTarget(clientX, clientY) {
  const u = cur();
  if (!u || u.verb !== 'target' || !u.target) return false;
  if (!director.targetLive(u.target)) return false;
  const r = rectOf();
  /* THE FRAME IS THE BOARD — a press off the picture is a press on nothing */
  if (!inRect(clientX, clientY, r)) return false;
  if (pixelIsTarget(clientX, clientY, u.target)) return true;   /* dead on it */
  /* THE READER'S REACH — a finger is not a pixel, and a sword at six metres
     is thinner than one. The slop is measured from where the target RENDERS. */
  const a = aimAt(u.target);
  if (!a) return false;
  return Math.hypot(clientX - a.x, clientY - a.y) <= Math.max(44, r.width * 0.09);
}

/** a miss is answered, not swallowed — the ring says "not there" */
function flashMiss() {
  if (!targetRing) return;
  targetEl.classList.add('miss');
  setTimeout(() => targetEl.classList.remove('miss'), 260);
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
    else { gateMisses++; flashMiss(); }
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
  /** WHERE THE LIVE TARGET RENDERS — client px on the target's own pixels,
   *  null when the live shot does not show it. This is what a scripted hand
   *  clicks and what the reader's ring rides: one number, one mechanism. */
  aim(name) {
    const u = cur();
    const n = name || (u && u.target);
    if (!n) return null;
    dropAim();
    const a = computeAim(n);
    if (!a) return null;
    const r = rectOf();
    return { ...a, rect: { left: r.left, top: r.top, width: r.width, height: r.height },
             live: director.targetLive(n) };
  },
  /** the reader's ring as the page has it right now (the [hit] gate reads it) */
  ring() {
    const on = targetEl.classList.contains('on');
    return { on, x: parseFloat(targetEl.style.left), y: parseFloat(targetEl.style.top),
             shown: getComputedStyle(targetEl).display !== 'none' && on };
  },
  /** a press at REAL client coordinates — the whole hit path, nothing skipped */
  clickAt(x, y) {
    pressDown();
    pressUp({ clientX: x, clientY: y });
    return { unit: cur() ? cur().id : null, misses: gateMisses };
  },
  hitAt(x, y) { return hitTarget(x, y); },
  /** the strict question the ring must answer yes to: does THIS PIXEL show
   *  the target? (no reach, no slop — geometry under the live lens) */
  onTargetAt(x, y, name) {
    const u = cur();
    return pixelIsTarget(x, y, name || (u && u.target));
  },
  /** what one ring repaint costs, measured in situ */
  aimCostMs(n = 20) {
    const u = cur();
    if (!u || !u.target) return null;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { dropAim(); computeAim(u.target); }
    return +((performance.now() - t0) / n).toFixed(3);
  },
  /** resolve the live target gate the way a reader's finger would */
  tap() {
    const u = cur();
    if (!u || u.verb !== 'target') return false;
    if (!director.targetLive(u.target)) return false;
    const a = aimAt(u.target);
    if (!a || !hitTarget(a.x, a.y)) return false;   /* no fiction: it must be hittable */
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
