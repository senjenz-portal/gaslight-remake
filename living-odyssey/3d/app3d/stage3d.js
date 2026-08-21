/**
 * stage3d.js — the LIVING STAGE as a three.js canvas: one full-3D SET mounted
 * at a time (shore3d · cave3d · sea3d), the book's own acts/segs/gates staged
 * as world movement, and the margin machinery's whole stage contract
 * (mount/ensure, fire, startSeg, setFocus, anchorScreen, targetLive/-Hit,
 * waitDone, clockT, step) implemented over it — main3d.js drives this exactly
 * the way main.js drives the painted stage.
 *
 * LAWS CARRIED:
 *   determinism — nothing here reads a wall clock. step(t, dt) receives STORY
 *     time; every mover, walk, mixer and light is a pure function of the
 *     times acts were fired at. All scatter is mulberry32-seeded upstream.
 *   obstacle law — every walked route rides each set's AUDITED corridor
 *     (PATH_PTS) with short spurs to the ledger marks; auditRoute() checks
 *     every authored segment against the ledger's obstacle census at fire
 *     time and pushes an error (the smoke's zero-error gate is the teeth).
 *   ledger scale honest per set — the worlds are METRIC (each divides plate
 *     px by its own measured px/m), actors are built at their real heights,
 *     so the ledger's pixel law holds on every set; the shore's dual-scale
 *     mainland ruling is applied as the exported MAINLAND_S/S factor.
 *   posture law — cast3d.js bakes the measured corrections (±5° standing,
 *     ≤12° walk) into rest + clip before any mixer exists.
 */
import * as THREE from 'three';
import { createShoreScene, createShoreIsoCamera, SHORE_WORLD } from '../sets/shore3d.js';
import { createSeaScene, SEA_WORLD } from '../sets/sea3d.js';
import { createCave3D, CAVE_WORLD, CAVE_STATES } from '../sets/cave3d.js';
import { buildActor } from './cast3d.js';
import { loadPlateSet, samplePlateLight, makeContactShadow, PLATE_W, PLATE_H }
  from './plate3d.js';

const WALK_MPS = 1.1;                 /* cast.json processionSpeedMps */
const SCURRY_MPS = 1.9;               /* the scatter-to-the-dark pace */
const GIANT_MPS = 1.6;                /* seven metres of stride */
const EASE_RATE = 3.2;                /* camera pursuit, s^-1 */

/* ---------------------------------------------------------------------- *
 * THE CROWD AMENDMENT (owner ruling, 2026-08-21: "it just needs a few of
 * them"). Butler's text says TWELVE and the text is untouched — what
 * changes is the STAGING: a leaf shows a few bodies and IMPLIES the rest
 * off-frame, which is the 2D book's own convention carried over unchanged
 * (its plates never drew twelve either). Ulysses and the giant are
 * principals, never crowd; sheep and rams are not men.
 *
 *   CREW_CAP   3   the default: three crew besides Ulysses
 *   LOTS_CAP   4   iii-05 shakes FOUR chips — the four bearers materialise
 *   ROWER_CAP  4   Beat VI's deck: four oars visible
 *   FLOCK_CAP  3   Beat V's escape: three rams with slung men + the great ram
 *   CREW_POOL  4   so only four crew rigs are ever built (was twelve)
 * ---------------------------------------------------------------------- */
const CREW_CAP = 3;
const LOTS_CAP = 4;
const ROWER_CAP = 4;
const FLOCK_CAP = 3;
const CREW_POOL = Math.max(CREW_CAP, LOTS_CAP, ROWER_CAP);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));

/* ---- segment vs ledger-box intersection (plate px) — the obstacle law ---- */
function segHitsBox(ax, ay, bx, by, [[x0, y0], [x1, y1]]) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) &&
         clip(-dy, ay - y0) && clip(dy, y1 - ay) && t0 <= t1;
}
function auditRoute(ptsPx, obstacles, label, errors) {
  for (let i = 0; i < ptsPx.length - 1; i++) {
    const [ax, ay] = ptsPx[i], [bx, by] = ptsPx[i + 1];
    for (const [name, box] of Object.entries(obstacles)) {
      if (segHitsBox(ax, ay, bx, by, box)) {
        errors.push({ kind: 'path-law',
          msg: `route ${label} crosses ledger box ${name} at seg ${i}` });
      }
    }
  }
}

/* nearest corridor sample index to a plate-px point */
function nearestIdx(corridor, px, py) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < corridor.length; i++) {
    const d = Math.hypot(corridor[i][0] - px, corridor[i][1] - py);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/* corridor route with spurs: [from, corridor[i..j], to] in plate px */
function corridorRoute(corridor, fromPx, toPx) {
  const i = nearestIdx(corridor, fromPx[0], fromPx[1]);
  const j = nearestIdx(corridor, toPx[0], toPx[1]);
  const mids = [];
  if (i <= j) for (let k = i; k <= j; k++) mids.push(corridor[k]);
  else for (let k = i; k >= j; k--) mids.push(corridor[k]);
  const pts = [fromPx, ...mids, toPx];
  /* dedupe near-identical consecutive points */
  const out = [pts[0]];
  for (const p of pts.slice(1)) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 4) out.push(p);
  }
  return out;
}

/* a polyline walk in world space: pure f(story time) */
class Walk {
  constructor(ptsWorld, t0, speed) {
    this.pts = ptsWorld;
    this.t0 = t0;
    this.speed = speed;
    this.lens = [];
    this.len = 0;
    for (let i = 0; i < ptsWorld.length - 1; i++) {
      const l = ptsWorld[i].distanceTo(ptsWorld[i + 1]);
      this.lens.push(l);
      this.len += l;
    }
    this.dur = this.len / speed;
  }
  /** position+heading at story time t -> { p, dir, done, moving } */
  at(t, P, DIR) {
    let d = Math.max(0, (t - this.t0)) * this.speed;
    const done = d >= this.len;
    if (done) d = this.len;
    let i = 0;
    while (i < this.lens.length - 1 && d > this.lens[i]) { d -= this.lens[i]; i++; }
    const a = this.pts[i], b = this.pts[i + 1] || a;
    const l = this.lens[i] || 1;
    const k = clamp01(d / l);
    P.lerpVectors(a, b, k);
    DIR.subVectors(b, a);
    if (DIR.lengthSq() < 1e-8) DIR.set(0, 0, 1);
    DIR.normalize();
    return { done, moving: t >= this.t0 && !done };
  }
}

export class Stage3D {
  /* THE REGRADE LAW ON 3D LIGHTING, in two halves.
     (1) the RIG is fixed and white — one key, one hemisphere fill, one rim, the
         same on every set and at every mark, so a rig's rendered mean under it
         is a CONSTANT and can be measured once;
     (2) BODY_REF is that measured constant (the rendered mean of a body under
         this rig, sRGB, from tools/sam2path_smoke.mjs's own body statistic),
     so the per-actor grade is target/ref in LINEAR — exactly regrade.py's
     "grade the cut to the plate ring at its mark", applied to an albedo
     instead of to a painted cut. Re-measure with --calibrate. */
  static PLATE_RIG = { key: 1.35, fill: 0.62, rim: 0.30 };
  static BODY_REF = {
    cave: [77, 34, 33], shore: [64, 28, 30], sea: [73, 40, 46],
  };
  static GRADE_CLAMP = [0.06, 14.0];   /* the fire-lit marks need 9x green */

  /** sea lenses anchored to the hull, not the mooring (Beat VI's travel) */
  static SHIP_LENSES = new Set(['stern', 'ship-deck', 'menbeg-close',
    'stern-rail', 'hades-twoshot', 'strait', 'homeward', 'moonpath']);

  constructor(canvas, { errors, audio } = {}) {
    this.canvas = canvas;
    this.errors = errors || [];
    this.audio = audio || null;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sets = {};                   /* name -> record */
    this.activeName = null;
    this.actors = {};                 /* id -> cast3d actor (+ stage fields) */
    this.actorLayer = new THREE.Group();
    this.actorLayer.name = 'actors';
    this.props = {};                  /* per-set story props */
    this.movers = [];                 /* { id, t0, dur, apply(k), done } */
    this.acts = [];                   /* fired-act log (harness evidence) */
    this.t = 0;
    this.holdK = 0;
    this.capLens = false;             /* 2D contract compat — unused here */
    this.state = { dim: 0 };          /* 2D contract compat (leader law) */

    this.meals = 0;                   /* the headcount law: crew = 12 - 2·meals */
    this.swordLive = false;
    this.followShip = false;
    this.clock0 = null;               /* the beat clock (Beat IV drive / VI throws) */
    this.holdAnchorName = 'fire';
    this.shake = null;                /* { t0, amp, dur } */
    this.beat = 1;                    /* main3d tells the stage the unit's beat */
    this.pov = null;                  /* { until, follow } — the sling-under drop */
    this.flareK = 0;                  /* the blinding's fire flare (mover-driven) */
    this.tipLock = 0;                 /* the stake tip's held glow past the hold */
    this.driveSpin = null;            /* { t0 } — the auger's own rotation */
    this.seaHits = [];                /* rock-impact times -> hull pitch impulses */
    this.audits = 0;                  /* obstacle-law route audits performed */

    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1200);
    this.camState = null;             /* {x,y,z,k} eased */
    this.camWant = null;
    this.view = { w: 1408, h: 768 };
    this.rect = null;
    this.renders = 0;
  }

  /* ================= sets: ensure / mount ================= */
  decoded(name) { return !!(this.sets[name] && this.sets[name].built); }

  async ensure(name) {
    if (this.sets[name] && this.sets[name].built) return this.sets[name];
    if (this.sets[name] && this.sets[name].building) return this.sets[name].building;
    const rec = { name, built: false, missing: [] };
    this.sets[name] = rec;
    rec.building = (async () => {
      if (name === 'shore') {
        rec.api = createShoreScene();
        rec.world = SHORE_WORLD;
        rec.camBase = { target: new THREE.Vector3(23.5, 2.6, -13.5), R: 380,
                        elev: SHORE_WORLD.ELEV, halfW: 62.3 };
        rec.corridor = SHORE_WORLD.PATH_PTS;
        rec.obstacles = SHORE_WORLD.OBSTACLES;
        rec.toWorld = (px, py, y = 0) =>
          new THREE.Vector3(SHORE_WORLD.X(px), y, SHORE_WORLD.Z(py));
        rec.fireAnchor = new THREE.Vector3(0, 0.9, 0);
        const ship2 = rec.api.parts['ship-2'];
        rec.ship2Home = { pos: ship2.position.clone(), rotY: ship2.rotation.y };
        await this._ensureActors(['ulysses', 'crew']);
      } else if (name === 'cave') {
        rec.api = createCave3D();
        rec.world = CAVE_WORLD;
        rec.camBase = { target: new THREE.Vector3(0.6, 1.15, -0.9), R: 110,
                        elev: CAVE_WORLD.ELEV, halfW: 16.6 };
        rec.corridor = CAVE_WORLD.PATH_PTS;
        rec.obstacles = CAVE_WORLD.OBSTACLES;
        rec.toWorld = (px, py, y = 0) =>
          new THREE.Vector3(CAVE_WORLD.X(px), y, CAVE_WORLD.Z(py));
        rec.fireAnchor = new THREE.Vector3(rec.api.FIRE.x, 0.7, rec.api.FIRE.z);
        this._buildCaveProps(rec);
        /* the fire's flame points — Beat IV scales the blaze down to embers */
        {
          const pts = [];
          rec.api.parts['fire-pit'].traverse((o) => { if (o.isPoints) pts.push(o); });
          rec.flames = pts[0] || null;
        }
        await this._ensureActors(['ulysses', 'crew', 'polyphemus', 'polyphemus-idle', 'ram', 'ewe', 'flock']);
      } else if (name === 'sea') {
        rec.api = createSeaScene();
        rec.world = SEA_WORLD;
        rec.camBase = { target: new THREE.Vector3(0, 7.8, 0), R: 190,
                        elev: SEA_WORLD.ELEV, halfW: 55.4 };
        rec.corridor = [];
        rec.obstacles = SEA_WORLD.OBSTACLES;
        rec.toWorld = (px, py, y = 0) =>
          new THREE.Vector3(SEA_WORLD.X(px), y, SEA_WORLD.Z(py));
        rec.fireAnchor = new THREE.Vector3(0, 2, 0);
        /* the story owns the throws: park the demo's periodic scheduler
           far in the past; acts re-arm each rock at its own story moment */
        for (const r of rec.api.ROCKS) { r.period = 1e9; r.offset = -5e8; }
        rec.shipHome = { pos: rec.api.SHIP.group.position.clone(),
                         rotY: rec.api.SHIP.group.rotation.y };
        rec.hemiBase = rec.api.parts['night-rig'].intensity;
        rec.moonBase = rec.api.moonLight.intensity;
        rec.browGiant = new THREE.Vector3(
          ...rec.api.root.userData.sculptRuntime.sockets['root:brow-giant']);
        await this._ensureActors(['ulysses', 'crew', 'polyphemus-idle']);
      } else {
        throw new Error('unknown set ' + name);
      }
      rec.scene = new THREE.Scene();
      rec.scene.add(rec.api.root);
      /* ---- THE SAM2 PATH: the plate becomes the world ---------------- *
       * The diorama's scenery retires; the painting takes its place as the
       * backdrop, its SAM2-cut foreground layers stand at their own ground
       * rows, and only the things that MOVE stay in three dimensions. */
      await this._plateTables();
      rec.plate = await loadPlateSet(name, rec.world, this.plateReg, './');
      rec.scene.add(rec.plate.group);
      this._retireScenery(rec);
      this._plateFrame(rec);
      this._plateRig(rec);
      /* the corridor itself is re-audited at build — the law, not a hope */
      if (rec.corridor.length) { auditRoute(rec.corridor, rec.obstacles, name + ':corridor', this.errors); this.audits++; }
      rec.built = true;
      rec.building = null;
      return rec;
    })();
    return rec.building;
  }

  async _ensureActors(names) {
    const WANT = {
      ulysses: ['ulysses'],
      crew: Array.from({ length: CREW_POOL }, (_, i) => 'crew-' + i),
      polyphemus: ['poly-walk'],
      'polyphemus-idle': ['poly-idle'],
      ram: ['ram-great'],
      ewe: Array.from({ length: 4 }, (_, i) => 'ewe-' + i),
      flock: Array.from({ length: FLOCK_CAP }, (_, i) => 'flock-' + i),
    };
    for (const rig of names) {
      for (const id of WANT[rig]) {
        if (this.actors[id]) continue;
        const a = await buildActor(rig, id);
        a.mode = 'off';                 /* off | stand | walk | pose */
        a.walk = null;
        a.face = 0;                     /* standing yaw */
        a.baseScale = a.model.scale.x;  /* honest metric scale */
        a.local = 1;                    /* shore mainland dual-scale factor */
        a.fade = null;                  /* { t0, dur, from, to } */
        a.opacity = 1;
        a.poseEuler = null;
        /* THE RIG'S OWN ALBEDO. BODY_REF is one rig's rendered mean under the
           fixed white plate rig; every OTHER rig has a different albedo, so
           grading them all by the same reference paints the giant green (owner
           eye, round 3). Measure each rig's effective albedo — material colour
           times the mean of its map — and normalise the grade by the ratio. */
        a.albedo = this._rigAlbedo(a);
        this.actors[id] = a;
        /* THE CONTACT SHADOW: the plate is a painted render with its own
           shadows — ours only has to seat the body on the floor, so it is a
           soft blob decal scaled off the rig's own stature, never a map. */
        const stature = a.heightM || a.lengthM || 1.7;
        a.shadow = makeContactShadow(Math.max(0.22, 0.30 * stature));
        a.group.add(a.shadow);
        this.actorLayer.add(a.group);
      }
    }
  }

  /** effective albedo of a rig: mean over materials of colour x mean(map) */
  _rigAlbedo(a) {
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const texMean = (t) => {
      if (!t || !t.image || !t.image.width) return [1, 1, 1];
      if (t.userData.__mean) return t.userData.__mean;
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const g = c.getContext('2d', { willReadFrequently: true });
      try { g.drawImage(t.image, 0, 0, 8, 8); } catch (e) { return [1, 1, 1]; }
      const d = g.getImageData(0, 0, 8, 8).data;
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      t.userData.__mean = [lin(r / n / 255), lin(gg / n / 255), lin(b / n / 255)];
      return t.userData.__mean;
    };
    const acc = [0, 0, 0];
    let n = 0;
    for (const m of a.mats || []) {
      if (!m.color) continue;
      const t = texMean(m.map);
      acc[0] += m.color.r * t[0];
      acc[1] += m.color.g * t[1];
      acc[2] += m.color.b * t[2];
      n++;
    }
    if (!n) return [1, 1, 1];
    return acc.map((v) => Math.max(1e-4, v / n));
  }

  /* ================= THE SAM2 PATH: plate, frame, light ================= */

  /** the three baked tables: the cut registry, the ledger lenses, the light */
  async _plateTables() {
    if (this.__tables) return this.__tables;
    this.__tables = (async () => {
      const grab = async (u) => {
        const r = await fetch(u, { cache: 'force-cache' });
        if (!r.ok) throw new Error('plate table ' + u + ' -> ' + r.status);
        return r.json();
      };
      const [reg, lenses, light] = await Promise.all([
        grab('./layers.json'), grab('./lenses.json'), grab('./platelight.json')]);
      this.plateReg = reg;
      this.lensTable = lenses;
      this.lightTable = light;
      return true;
    })();
    return this.__tables;
  }

  /**
   * THE PLATE IS THE WORLD. Everything the painting already draws stops being
   * geometry: meshes and sprites retire, LIGHTS and POINT SYSTEMS stay (the
   * fire, the embers, the spray are the plate's own life, animated), and so do
   * the few props the story physically MOVES — a ship that sails, the rocks
   * that fall. Nothing is deleted: the rigs, the parts registry and every act
   * that drives them are untouched, so the story's 81 units run unchanged.
   */
  _retireScenery(rec) {
    const keepAll = new Set();      /* props the story physically moves */
    const keepPts = new Set();      /* the plate's own life, animated */
    const tree = (set, o) => { if (o) o.traverse((c) => set.add(c)); };
    if (rec.name === 'cave') tree(keepPts, rec.api.parts['fire-pit']);
    if (rec.name === 'shore') tree(keepPts, rec.api.parts['blaze']);
    if (rec.name === 'sea') {
      tree(keepAll, rec.api.SHIP && rec.api.SHIP.group);
      tree(keepAll, rec.api.parts['thrown-rocks']);
      tree(keepPts, rec.api.parts['splash-pool']);
    }
    let hidden = 0, kept = 0, points = 0;
    rec.api.root.traverse((o) => {
      const drawable = o.isMesh || o.isSprite || o.isLine || o.isInstancedMesh || o.isPoints;
      if (!drawable) return;
      if (keepAll.has(o)) { kept++; return; }
      /* THE VEIL LESSON: the diorama's drifting haze reads as atmosphere over
         a dim diorama and as a GREY WASH over a painting (measured: it lifted
         the cave's blue from 27 to 63). Only the hearth's own flame survives —
         Beat IV needs the blaze to visibly sink — and everything else that was
         weather goes back to being paint. */
      if (o.isPoints && keepPts.has(o)) { points++; kept++; return; }
      o.visible = false;
      o.userData.retiredByPlate = true;
      hidden++;
    });
    rec.keptRoots = [...keepAll].filter((o) => o.parent === rec.api.root ||
      (o.parent && o.parent.parent === rec.api.root));
    rec.livePoints = [];
    rec.api.root.traverse((o) => { if (o.isPoints && o.visible) rec.livePoints.push(o); });
    rec.retired = { hidden, kept, points };
    return rec.retired;
  }

  /** the gate hides the kept 3D props (the hull, the falling rocks) so the
      regrade ring measures a body against PAINT, not against another solid */
  setKeptProps(on) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.keptRoots) return 0;
    for (const o of rec.keptRoots) o.visible = !!on;
    return rec.keptRoots.length;
  }

  /** the gate silences the live particles so it measures the sandwich alone */
  setLivePoints(on) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.livePoints) return 0;
    for (const p of rec.livePoints) p.visible = !!on;
    return rec.livePoints.length;
  }

  /**
   * THE BOOK'S FIXED FRAMING. The ledger's lensLaw says a lens is a centre in
   * plate px at a zoom k, and the visible box is 1408/k x 768/k px. Under the
   * set's own orthographic plan a ground point at plate (px,py) lands at screen
   * ((px-CX)/S, -(py-CY)/S) — one uniform scale S — so that law becomes exactly
   * halfWidth = (704/S)/k about the target toWorld(px,py). No free camera: the
   * elevation is the set's own and never moves.
   */
  _plateFrame(rec) {
    const w = rec.world;
    rec.camBase = {
      target: rec.toWorld(PLATE_W / 2, PLATE_H / 2, 0),
      R: rec.camBase.R, elev: w.ELEV, halfW: (PLATE_W / 2) / w.S,
    };
    const table = (this.lensTable.sets[rec.name] || {}).lenses || {};
    rec.lenses = {};
    for (const [name, L] of Object.entries(table)) {
      rec.lenses[name] = { at: L.at, k: L.k,
                           v: rec.toWorld(L.at[0], L.at[1], 0) };
    }
    rec.toPlate = (v) => [v.x * w.S + (PLATE_W / 2 - w.X(PLATE_W / 2) * w.S),
                          v.z * w.S * w.SIN_E + (PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E)];
    return rec.lenses;
  }

  /**
   * THE REGRADE LAW ON 3D LIGHTING. One key + one fill per set, both driven by
   * the plate's own ring colour where the focused body stands (platelight.json,
   * regrade.py's annulus statistic). The painting lights the actor.
   */
  _plateRig(rec) {
    const R = Stage3D.PLATE_RIG;
    const key = new THREE.DirectionalLight('#ffffff', R.key);
    key.position.set(-6, 9, 7);            /* the painter's own up-left-front */
    key.target.position.set(0, 0, 0);
    const fill = new THREE.HemisphereLight('#ffffff', '#5a5a66', R.fill);
    const rim = new THREE.DirectionalLight('#ffffff', R.rim);
    rim.position.set(7, 5, -6);
    key.name = 'plate-key'; fill.name = 'plate-fill'; rim.name = 'plate-rim';
    rec.scene.add(key, key.target, fill, rim);
    rec.rig = { key, fill, rim };
    /* THE PAINTED LIGHT IS ALREADY IN THE PLATE. Every diorama lamp, blaze and
       moon is paint now, so its three.js twin must stop shining or it lights
       the cast twice. The rigs stay (the acts drive them, and the fire's
       flicker is read back as a SIGNAL for the key), they simply stop
       contributing radiance. */
    rec.dioramaLights = [];
    rec.api.root.traverse((o) => { if (o.isLight) rec.dioramaLights.push(o); });
    rec.fireBase = rec.api.fireLight ? (rec.api.fireLight.intensity || 330) : 0;
    return rec.rig;
  }

  /** the actor grade: the plate ring where a body stands, over its measured ref */
  _gradeActor(rec, a) {
    if (!a.group.visible || a.mode === 'off') return;
    const w = rec.world;
    const p = a.group.getWorldPosition(this.__gv || (this.__gv = new THREE.Vector3()));
    const px = p.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const py = p.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const s = samplePlateLight(this.lightTable, rec.name, this.plateState(rec), px, py);
    const ref = Stage3D.BODY_REF[rec.name] || Stage3D.BODY_REF.cave;
    const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4); };
    const [lo, hi] = Stage3D.GRADE_CLAMP;
    /* BODY_REF is the REFERENCE RIG's rendered mean; another rig with another
       albedo needs the ratio of the two albedos, or its own colour rides the
       reference's correction (the green giant) */
    const refA = this.__refAlbedo || (this.__refAlbedo =
      (this.actors.ulysses && this.actors.ulysses.albedo) || [1, 1, 1]);
    const own = a.albedo || refA;
    const g = [0, 1, 2].map((i) => Math.min(hi, Math.max(lo,
      lin(Math.max(2, s.rgb[i])) / Math.max(1e-4, lin(ref[i])) * (refA[i] / own[i]))));
    /* the fire's own flicker survives as a warm breath on the key side */
    const fk = 1 + 0.10 * (this.__fireK || 0) + 0.55 * this.flareK;
    if (!a.mats) return;
    for (const m of a.mats) {
      if (!m.color) continue;
      if (!m.userData.plateBase) m.userData.plateBase = m.color.clone();
      const b = m.userData.plateBase;
      m.color.setRGB(b.r * g[0] * fk, b.g * g[1] * fk, b.b * g[2] * fk);
    }
    a.grade = g.map((v) => +v.toFixed(3));
  }

  /** the plate state a set is currently painted in */
  plateState(rec) {
    return rec.plate ? rec.plate.stateB : null;
  }

  /**
   * One pass a frame: retire the painted light, then grade every body on the
   * leaf to the plate ring it stands in. The rig stays fixed and white — all
   * the matching happens in the albedo, where the regrade law puts it.
   */
  _plateLightStep() {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.rig || !this.lightTable) return;
    /* (1) read the fire's flicker as a SIGNAL, then take the painted lamps out */
    if (rec.dioramaLights) {
      const fl = rec.api.fireLight;
      this.__fireK = fl && rec.fireBase ? fl.intensity / rec.fireBase : 0;
      for (const L of rec.dioramaLights) L.intensity = 0;
    }
    const R = Stage3D.PLATE_RIG;
    rec.rig.key.intensity = R.key;
    rec.rig.fill.intensity = R.fill;
    rec.rig.rim.intensity = R.rim;
    /* (2) grade each body to the ring it stands in */
    if (!this.gradeBypass) {
      for (const a of Object.values(this.actors)) this._gradeActor(rec, a);
    }
    const w = rec.world;
    const c = this.camState || rec.camBase.target;
    const px = c.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const py = c.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const s = samplePlateLight(this.lightTable, rec.name, this.plateState(rec), px, py);
    const u = this.actors.ulysses;
    this.lightSample = { px: Math.round(px), py: Math.round(py),
                         rgb: s.rgb.map((v) => Math.round(v)), lum: +s.lum.toFixed(1),
                         fireK: +(this.__fireK || 0).toFixed(3),
                         grade: u && u.grade ? u.grade : null };
  }

  mount(name) {
    const rec = this.sets[name];
    if (!rec || !rec.built) return false;
    this.activeName = name;
    /* actors travel with the stage, one scene at a time */
    rec.scene.add(this.actorLayer);
    /* a fresh leaf starts with everyone off it — acts place the cast */
    for (const a of Object.values(this.actors)) this._off(a);
    this._hideProps();
    this.followShip = false;
    this.holdAnchorName = 'fire';
    this.swordLive = false;
    this.pov = null;
    this.flareK = 0;
    this.seaHits = [];
    const cb = rec.camBase;
    this.camState = { x: cb.target.x, y: cb.target.y, z: cb.target.z, k: 1, e: cb.elev };
    this.camWant = { ...this.camState };
    this.applyCam();
    return true;
  }

  async preloadAll() {
    await this.ensure('shore'); await this.ensure('cave'); await this.ensure('sea');
    return Object.keys(this.sets);
  }

  reset() {
    this.movers = [];
    this.meals = 0;
    this.swordLive = false;
    this.followShip = false;
    this.clock0 = null;
    this.holdK = 0;
    this.shake = null;
    this.pov = null;
    this.flareK = 0;
    this.tipLock = 0;
    this.driveSpin = null;
    this.seaHits = [];
    this._flockExit = null;
    for (const a of Object.values(this.actors)) this._off(a);
    const shore = this.sets.shore;
    if (shore && shore.built) {
      shore.api.setState('night');
      const ship2 = shore.api.parts['ship-2'];
      ship2.position.copy(shore.ship2Home.pos);
      ship2.rotation.y = shore.ship2Home.rotY;
      if (shore.plate) shore.plate.setState('shore', 1);
    }
    const cave = this.sets.cave;
    if (cave && cave.built) {
      cave.api.setState('cave-shut', 1);
      cave.api.setBoulderK(1);
      if (cave.plate) cave.plate.setState('cave-shut', 1);
    }
    const sea = this.sets.sea;
    if (sea && sea.built) {
      sea.api.SHIP.group.position.copy(sea.shipHome.pos);
      sea.api.SHIP.group.rotation.y = sea.shipHome.rotY;
      sea.api.parts['night-rig'].intensity = sea.hemiBase;
      sea.api.moonLight.intensity = sea.moonBase;
      for (const r of sea.api.ROCKS) { r.period = 1e9; r.offset = -5e8; }
      if (sea.plate) { sea.plate.setState('sea', 1); sea.plate.setPatch('ship-hole', 0); }
    }
    this._hideProps();
  }

  /* ================= story props (cave) ================= */
  _buildCaveProps(rec) {
    const grp = new THREE.Group();
    grp.name = 'story-props';
    const { toWorld } = rec;
    /* the sword: a glint at the hip — G2's target */
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.012),
      new THREE.MeshStandardMaterial({ color: '#cfd6e0', metalness: 0.1, roughness: 0.25,
        emissive: '#aab4c8', emissiveIntensity: 0.55 }));
    blade.position.y = 0.3;
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03),
      new THREE.MeshStandardMaterial({ color: '#7a5c36' }));
    sword.add(blade, hilt);
    sword.visible = false;
    grp.add(sword);
    /* the ivy bowl + its pour glow — G3's carrier */
    const bowl = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: '#4a3a22', roughness: 0.9 }));
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10),
      new THREE.MeshStandardMaterial({ color: '#4a1020', emissive: '#5a1428',
        emissiveIntensity: 0.7 }));
    wine.position.y = 0.02;
    wine.scale.setScalar(0.01);
    bowl.add(cup, wine);
    bowl.visible = false;
    grp.add(bowl);
    /* the stake: six feet of green olive, charred — with THE GLOWING TIP
       (poly-props' ember-tip pattern: emissive MATERIAL STATE + PointLight).
       Local +Y is the tip end; an inner spin group carries the auger turn. */
    const stake = new THREE.Group();
    const stakeSpin = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 1 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.10, 1.55, 7), shaftMat);
    shaft.position.y = -0.175;
    const tipMat = new THREE.MeshStandardMaterial({ color: '#2a1a10',
      emissive: '#ff7a22', emissiveIntensity: 0.0, roughness: 0.85 });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 7), tipMat);
    tip.position.y = 0.81;
    const tipLight = new THREE.PointLight('#ff8c33', 0, 9, 2);
    tipLight.position.copy(tip.position);
    stakeSpin.add(shaft, tip, tipLight);
    stake.add(stakeSpin);
    stake.rotation.z = Math.PI / 2 - 0.18;
    stake.visible = false;
    grp.add(stake);
    rec.api.root.add(grp);
    this.props.sword = sword;
    this.props.bowl = bowl;
    this.props.wine = wine;
    this.props.stake = stake;
    this.props.stakeSpin = stakeSpin;
    this.props.stakeMats = [shaftMat, tipMat];
    this.props.stakeTipMat = tipMat;
    this.props.stakeTipLight = tipLight;
    /* prop marks (ledger px -> world) */
    this.props.swordAt = toWorld(680, 554); this.props.swordAt.y = 0.85;
    this.props.bowlAt = toWorld(700, 514); this.props.bowlAt.y = 1.05;
    this.props.stakeAt = toWorld(782, 496); this.props.stakeAt.y = 0.35;
    sword.position.copy(this.props.swordAt);
    bowl.position.copy(this.props.bowlAt);
    stake.position.copy(this.props.stakeAt);
  }

  _hideProps() {
    for (const k of ['sword', 'bowl', 'stake']) {
      if (this.props[k]) this.props[k].visible = false;
    }
    if (this.props.wine) this.props.wine.scale.setScalar(0.01);
    if (this.props.stake) {
      this.props.stake.position.copy(this.props.stakeAt);
      this.props.stake.rotation.set(0, 0, Math.PI / 2 - 0.18);
      this.props.stakeSpin.rotation.set(0, 0, 0);
      this.props.stakeTipMat.emissiveIntensity = 0;
      this.props.stakeTipLight.intensity = 0;
      this.tipLock = 0;
      this.driveSpin = null;
    }
  }

  /* ================= actors: placement + walks ================= */
  _off(a) {
    a.mode = 'off'; a.group.visible = false; a.walk = null; a.fade = null;
    a.opacity = 1; a.poseEuler = null;
    /* deck actors ride the ship's sway group — restore the stage layer */
    if (a.group.parent && a.group.parent !== this.actorLayer) this.actorLayer.add(a.group);
  }

  /** Put an actor ON THE SHIP: parented into the sway group so he rides the
   *  swell, the wash push-back and the sail-off with the hull (Beat VI). */
  _deck(a, rec, local, face = 0) {
    a.mode = 'deck';
    rec.api.SHIP.sway.add(a.group);
    a.group.position.set(local[0], local[1], local[2]);
    a.group.rotation.set(0, face, 0);
    a.face = face;
    a.local = 1;
    a.model.scale.setScalar(a.baseScale);
    a.group.visible = true;
    a.walk = null;
    a.poseEuler = null;
    a.fade = null; a.opacity = 1;      /* a placed body is a solid body */
  }

  /** Fade an actor IN at a mark (Beat V's freed men). */
  _appear(a, world, face, { delay = 0, dur = 1.0, silent = false } = {}) {
    this._stand(a, world, face);
    if (silent) { a.opacity = 1; return; }
    a.opacity = 0;
    a.fade = { t0: this.t + delay, dur, from: 0, to: 1 };
  }

  _stand(a, world, face = 0, local = 1) {
    a.mode = 'stand';
    a.group.visible = true;
    a.group.position.copy(world);
    a.group.rotation.set(0, face, 0);
    a.face = face;
    a.local = local;
    a.model.scale.setScalar(a.baseScale * local);
    a.walk = null;
    a.poseEuler = null;
    a.fade = null; a.opacity = 1;      /* a placed body is a solid body */
  }

  _pose(a, world, euler) {
    a.mode = 'pose';
    a.group.visible = true;
    a.group.position.copy(world);
    a.group.setRotationFromEuler(euler);
    a.poseEuler = euler;
    a.walk = null;
  }

  /** Walk an actor along a plate-px route (corridor + spurs), audited. */
  _walkRoute(a, rec, fromPx, toPx, { speed = WALK_MPS, delay = 0, y = 0,
                                     silent = false, label = '' } = {}) {
    const ptsPx = corridorRoute(rec.corridor.length ? rec.corridor : [fromPx, toPx], fromPx, toPx);
    auditRoute(ptsPx, rec.obstacles, label || (a.id + '-walk'), this.errors);
    this.audits++;
    const pts = ptsPx.map(([px, py]) => rec.toWorld(px, py, y));
    if (silent) {
      this._stand(a, pts[pts.length - 1],
        Math.atan2(pts[pts.length - 1].x - pts[Math.max(0, pts.length - 2)].x,
                   pts[pts.length - 1].z - pts[Math.max(0, pts.length - 2)].z));
      return;
    }
    a.mode = 'walk';
    a.group.visible = true;
    a.fade = null; a.opacity = 1;      /* a walking body is a solid body */
    a.walk = new Walk(pts, this.t + delay, speed);
  }

  _fade(a, to, dur = 1.2, silent = false) {
    if (silent) { a.opacity = to; if (to <= 0) this._off(a); return; }
    a.fade = { t0: this.t, dur, from: a.opacity, to };
  }

  /* ---- the crowd amendment's roster ---- */
  _crew(n) {
    return Array.from({ length: CREW_POOL }, (_, i) => this.actors['crew-' + i])
      .filter(Boolean).slice(0, Math.min(n, CREW_POOL));
  }
  /** the STAGED company: capped at three, and never more than the twelve
   *  the giant has left alive (the headcount law survives the amendment —
   *  it just stops being the number of bodies on the leaf). */
  crewCap() { return Math.max(1, Math.min(CREW_CAP, 12 - 2 * this.meals)); }
  _aliveCrew() { return this._crew(this.crewCap()); }
  /** every crew rig currently ON the leaf (whatever act put it there) */
  _onStageCrew() {
    return this._crew(CREW_POOL)
      .filter((c) => c.mode !== 'off' && c.group.visible && c.opacity > 0.05);
  }

  /** THE CROWD CENSUS — the amendment's gate reads this. Ulysses and the
   *  giant are principals, sheep and rams are livestock; `crew` is the only
   *  number the cap governs. */
  census() {
    const on = (a) => !!(a && a.group.visible && a.opacity > 0.05);
    let crew = 0, rams = 0, sheep = 0;
    for (const [id, a] of Object.entries(this.actors)) {
      if (!on(a)) continue;
      if (id.startsWith('crew-')) crew++;
      else if (id.startsWith('flock-') || id === 'ram-great') rams++;
      else if (id.startsWith('ewe-')) sheep++;
    }
    const ulysses = on(this.actors.ulysses) ? 1 : 0;
    const giant = (on(this.actors['poly-idle']) ? 1 : 0) +
                  (on(this.actors['poly-walk']) ? 1 : 0);
    return { crew, ulysses, giant, rams, sheep, humanoids: crew + ulysses + giant };
  }

  /* seeded cluster offsets around a world point */
  _cluster(world, n, seed, spread = 0.9) {
    const rnd = mulberry32(seed);
    return Array.from({ length: n }, () => {
      const a = rnd() * Math.PI * 2, r = spread * (0.35 + rnd() * 0.65);
      return new THREE.Vector3(world.x + Math.cos(a) * r, world.y, world.z + Math.sin(a) * r);
    });
  }

  /* ================= movers (pure f(story time)) ================= */
  _mover(id, dur, apply, { silent = false, delay = 0, onDone = null } = {}) {
    if (silent) { apply(1); if (onDone) onDone(true); return; }
    this.movers = this.movers.filter((m) => m.id !== id);
    this.movers.push({ id, t0: this.t + delay, dur, apply, onDone, finished: false });
  }

  /* ================= ACTS ================= */
  fire(act, silent = false) {
    this.acts.push(act);
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;
    const fn = this._acts()[act];
    if (fn) fn(rec, !!silent);
  }

  /** fire an act at a specific (built) set — the closing leaf's bookOffstage */
  fireAt(name, act) {
    const rec = this.sets[name];
    if (!rec || !rec.built) return;
    if (act === 'bookOffstage') for (const a of Object.values(this.actors)) this._off(a);
  }

  _acts() {
    if (this.__acts) return this.__acts;
    const S = this;
    const shoreMarks = {
      fire: [390, 480], council: [563, 499], councilCrew: [472, 507],
      twelveAtShip: [560, 503],
    };
    const caveMarks = {
      entry: [360, 450], cheeseRack: [640, 405], huddle: [933, 541],
      suppliant: [690, 512], giantSeat: [760, 452], sword: [680, 554],
      scheme: [800, 530], lots: [713, 527], stakeHide: [782, 496],
      bowlOffer: [700, 514], sprawlHead: [664, 546], ramStand: [838, 430],
      ramAtMouth: [395, 438], doorwaySeat: [345, 470], mouth: [355, 438],
    };
    const mainlandLanding = new THREE.Vector3(45.5, 0, -20.5);
    const mainlandEntry = new THREE.Vector3(50.0, 1.35, -30.6);
    const MAINLAND_LOCAL = SHORE_WORLD.MAINLAND_S / SHORE_WORLD.S; /* the dual-scale ruling */

    const giant = (mode) => {                    /* 'walk' | 'idle' */
      const w = S.actors['poly-walk'], i = S.actors['poly-idle'];
      if (!w || !i) return null;
      if (mode === 'walk') { S._off(i); return w; }
      S._off(w); return i;
    };
    const giantSprawl = (rec, silent) => {
      const g = giant('idle');
      if (!g) return;
      if (g.mode === 'pose') return;             /* already down — idempotent */
      const mid = rec.toWorld(814, 533, 1.05);
      const euler = new THREE.Euler(-Math.PI / 2, Math.PI / 2 + 0.25, 0, 'YXZ');
      if (silent) { S._pose(g, mid, euler); return; }
      const from = g.group.visible ? g.group.position.clone()
        : rec.toWorld(caveMarks.giantSeat[0], caveMarks.giantSeat[1]);
      const fromQ = g.group.visible ? g.group.quaternion.clone() : new THREE.Quaternion();
      const toQ = new THREE.Quaternion().setFromEuler(euler);
      g.mode = 'pose'; g.group.visible = true; g.walk = null; g.poseEuler = euler;
      S._mover('giant-sprawl', 2.6, (k) => {
        const e = easeInOut(k);
        g.group.position.lerpVectors(from, mid, e);
        g.group.quaternion.slerpQuaternions(fromQ, toQ, e);
      });
    };
    const caveState = (name) => (rec, silent) => {
      const want = CAVE_STATES[name];
      const bFrom = S._boulderK !== undefined ? S._boulderK : 1;
      const bTo = want.boulder;
      if (silent) {
        rec.api.setState(name, 1);
        rec.api.setBoulderK(bTo);
        if (rec.plate) rec.plate.setState(name, 1);
        S._boulderK = bTo;
        return;
      }
      const cur = { ...rec.api.state.cur };
      /* THE STATE IS A DISSOLVE BETWEEN TWO PAINTINGS. The plate carries the
         boulder shut in three states and open at dawn, so the door opening is
         the crossfade itself — no ghost, no inpainting, the painter's own
         pixels on both sides of it. */
      if (rec.plate) rec.plate.setState(name, 0);
      S._mover('cave-state', 1.8, (k) => {
        const e = easeInOut(k);
        for (const key of Object.keys(want)) {
          if (key === 'boulder') continue;
          rec.api.state.cur[key] = cur[key] + (want[key] - cur[key]) * e;
        }
        if (rec.plate) rec.plate.setState(name, e);
        if (k >= 1) rec.api.state.name = name;
      });
      if (bTo !== bFrom) {
        S._mover('boulder', 2.3, (k) => {
          const e = easeInOut(k);
          const v = bFrom + (bTo - bFrom) * e;
          rec.api.setBoulderK(v);
          S._boulderK = v;
        });
        if (bTo === 1) {                          /* the ROLL shut: boom + shake */
          if (S.audio) S.audio.cue('boulder-boom', { delay: 1.6 });
          S.shake = { t0: S.t + 2.0, amp: 0.34, dur: 1.1 };
        }
        S._boulderK = bTo;
      }
    };

    this.__acts = {
      /* ---------- SHORE (Beat I) ---------- */
      establish: () => {},
      'fire-ulysses': (rec, silent) => {
        const u = S.actors.ulysses;
        S._stand(u, rec.toWorld(...shoreMarks.fire), Math.PI / 2.4);
      },
      'shore-day': (rec, silent) => {
        rec.api.setState('day');
        if (!rec.plate) return;
        if (silent) { rec.plate.setState('shore-day', 1); return; }
        rec.plate.setState('shore-day', 0);
        S._mover('shore-plate', 1.4, (k) => rec.plate.setState('shore-day', easeInOut(k)));
      },
      'council-ulysses': (rec, silent) => {
        const u = S.actors.ulysses;
        if (u.mode === 'off') S._stand(u, rec.toWorld(...shoreMarks.fire), 0);
        S._walkRoute(u, rec, shoreMarks.fire, shoreMarks.council,
          { silent, label: 'shore:fire->council' });
        /* the crew arc, gathered to the council marks (the amendment: three
           of the twelve stand IN the frame, the rest are off it) */
        const centre = rec.toWorld(...shoreMarks.councilCrew);
        const crew = S._aliveCrew();
        const spots = S._cluster(centre, crew.length, 70999, 2.6);
        crew.forEach((c, i) => {
          S._stand(c, spots[i],
            Math.atan2(rec.toWorld(...shoreMarks.council).x - spots[i].x,
                       rec.toWorld(...shoreMarks.council).z - spots[i].z));
        });
      },
      crossing: (rec, silent) => {               /* G1 — camera + ship glide */
        const ship = rec.api.parts['ship-2'];
        const from = rec.ship2Home.pos.clone();
        const to = mainlandLanding.clone().setY(from.y);
        const rot0 = rec.ship2Home.rotY;
        const rot1 = rot0 + 0.55;
        /* the twelve board: the beach empties with the keel */
        S._off(S.actors.ulysses);
        for (const c of S._crew(CREW_POOL)) S._off(c);
        S._mover('crossing', 9.0, (k) => {
          const e = easeInOut(k);
          ship.position.lerpVectors(from, to, e);
          ship.rotation.y = rot0 + (rot1 - rot0) * e;
          S.followShip = k < 1;
        }, { silent, onDone: () => { S.followShip = false; } });
        if (silent) { ship.position.copy(to); ship.rotation.y = rot1; S.followShip = false; }
      },
      'entry-mainland': (rec, silent) => {
        /* landfall: Ulysses + his few at the laurel mouth (dual-scale lobe) */
        const crew = S._aliveCrew();
        const spots = S._cluster(mainlandEntry, crew.length + 1, 71011, 1.6);
        const u = S.actors.ulysses;
        S._stand(u, spots[0], -0.5, MAINLAND_LOCAL);
        crew.forEach((c, i) => S._stand(c, spots[i + 1], -0.6, MAINLAND_LOCAL));
      },
      'twelve-at-ship': (rec, silent) => {
        const base = mainlandLanding.clone();
        const crew = S._aliveCrew();
        const spots = S._cluster(base, crew.length, 71021, 2.2);
        crew.forEach((c, i) => S._stand(c, spots[i], 0.4, MAINLAND_LOCAL));
        S._stand(S.actors.ulysses, base.clone().add(new THREE.Vector3(1.6, 0, -1.6)),
          -0.4, MAINLAND_LOCAL);
      },
      'plate-wineskin': (rec, silent) => {
        /* the party climbs behind: drift toward the mouth */
        const u = S.actors.ulysses;
        const from = u.group.position.clone();
        const to = mainlandEntry.clone();
        S._mover('climb', 6.0, (k) => {
          const e = easeInOut(k);
          u.group.position.lerpVectors(from, to, e);
          u.group.position.y = from.y + (to.y - from.y) * e;
        }, { silent });
        if (silent) u.group.position.copy(to);
      },

      /* ---------- CAVE (Beats II-V) ---------- */
      'cave-dawn': caveState('cave-dawn'),
      'cave-shut': caveState('cave-shut'),
      'cave-embers': (rec, silent) => {
        caveState('cave-embers')(rec, silent);
        giantSprawl(rec, silent);                 /* the sprawl among the sheep */
      },
      'cave-predawn': (rec, silent) => {
        caveState('cave-predawn')(rec, silent);
        if (S.beat >= 5) {
          /* BEAT V's pre-dawn: the blinded giant SEATED FILLING THE DOORWAY,
             six survivors by the pens, the ewes in the south lane, the
             night's props cleared with the leaf */
          S.meals = Math.max(S.meals, 3);
          S._hideProps();
          const g = giant('idle');
          if (g) S._stand(g, rec.toWorld(...caveMarks.doorwaySeat), 2.1);
          const survivors = S._aliveCrew();
          const spots = S._cluster(rec.toWorld(890, 537), survivors.length, 71033, 1.2);
          survivors.forEach((c, i) => S._stand(c, spots[i], -2.3));
          for (const c of S._crew(CREW_POOL).slice(survivors.length)) S._off(c);
          S._stand(S.actors.ulysses, rec.toWorld(858, 542), -2.4);
          const ewePx = [[938, 538], [972, 545], [1002, 540], [915, 548]];
          ewePx.forEach(([px, py], i) => {
            const e = S.actors['ewe-' + i];
            if (e) S._stand(e, rec.toWorld(px, py), -1.9 + 0.2 * i);
          });
          return;
        }
        S.meals = Math.max(S.meals, 1);           /* leaf 3 opens after meal one */
        giantSprawl(rec, true);                   /* asleep as the leaf mounts */
        const left = S._aliveCrew();
        const spots = S._cluster(rec.toWorld(...caveMarks.huddle), left.length, 71031, 1.3);
        left.forEach((c, i) => S._stand(c, spots[i], -1.1));
        for (const c of S._crew(CREW_POOL).slice(left.length)) S._off(c);
        S._stand(S.actors.ulysses, rec.toWorld(933, 528), -1.2);
      },
      'cheese-rack': (rec, silent) => {
        /* the laden tableau before rack B, heads jerked seaward — the stand
           row keeps NORTH of the fire ring's box (y <= 415 in plate px) */
        const crew = S._aliveCrew();
        const spots = S._cluster(rec.toWorld(640, 398), crew.length, 71041, 1.0);
        crew.forEach((c, i) => {
          if (c.mode === 'off' || silent) S._stand(c, spots[i], -2.2);
        });
        const u = S.actors.ulysses;
        if (u.mode === 'off' || silent) S._stand(u, rec.toWorld(610, 412), -2.0);
      },
      'huddle-far': (rec, silent) => {
        /* the scatter to the far dark (with seg `return`) */
        const rnd = mulberry32(71051);
        S._aliveCrew().forEach((c, i) => {
          const tx = caveMarks.huddle[0] + (rnd() - 0.5) * 56;
          const ty = caveMarks.huddle[1] + (rnd() - 0.5) * 18;
          S._walkRoute(c, rec, [604 + (i % 4) * 24, 396 + (i % 3) * 6], [tx, ty],
            { speed: SCURRY_MPS, silent, delay: 0.15 * i, label: 'cave:scatter' });
        });
        S._walkRoute(S.actors.ulysses, rec, [610, 412], [933, 528],
          { speed: SCURRY_MPS, silent, label: 'cave:scatter-u' });
      },
      'giant-seat': (rec, silent) => {
        /* seated working by the fire, head turned to the huddled strangers
           downstage-east — the face (and the one eye) plays to the lens */
        const g = giant('idle');
        if (g) S._stand(g, rec.toWorld(...caveMarks.giantSeat), 1.05);
      },
      suppliant: (rec, silent) => {
        S._walkRoute(S.actors.ulysses, rec, caveMarks.huddle, caveMarks.suppliant,
          { silent, label: 'cave:huddle->suppliant' });
      },
      'sword-ulysses': (rec, silent) => {
        S._walkRoute(S.actors.ulysses, rec, caveMarks.suppliant, caveMarks.sword,
          { silent, label: 'cave:suppliant->sword' });
        if (silent) { S.swordLive = true; S.props.sword.visible = true; }
      },
      swordDraw: (rec, silent) => {               /* G2 resolves — the glint lifts */
        const sw = S.props.sword;
        sw.visible = true;
        const y0 = S.props.swordAt.y;
        S._mover('sword-draw', 0.9, (k) => {
          sw.position.y = y0 + easeInOut(k > 0.5 ? 2 - 2 * k : 2 * k) * 0.5;
          sw.rotation.z = easeInOut(k) * -0.9;
        }, { silent });
      },
      milking: (rec, silent) => {                 /* dawn routine: the giant is up */
        const g = giant('idle');
        if (g) S._stand(g, rec.toWorld(...caveMarks.giantSeat), 1.05);
      },
      scheme: (rec, silent) => {
        S._walkRoute(S.actors.ulysses, rec, caveMarks.huddle, caveMarks.scheme,
          { silent, label: 'cave:huddle->scheme' });
      },
      'stake-hide': (rec, silent) => {
        /* shaken helmet: four step to the circle, Ulysses the fifth */
        const st = S.props.stake;
        st.visible = true;
        const y0 = S.props.stakeAt.y;
        S._mover('stake-hide', 1.4, (k) => { st.position.y = y0 - easeInOut(k) * 0.22; },
          { silent });
        /* THE LOTS is the one unit the amendment lets past three: the text
           shakes FOUR chips, so the FOUR bearers materialise (iii-05 only —
           the flock-in seg scatters them back to the huddle) */
        const centre = rec.toWorld(...caveMarks.lots);
        const spots = S._cluster(centre, LOTS_CAP, 71061, 0.9);
        S._crew(LOTS_CAP).forEach((c, i) => S._stand(c, spots[i], 2.6));
        S._walkRoute(S.actors.ulysses, rec, caveMarks.scheme, caveMarks.lots,
          { silent, label: 'cave:scheme->lots' });
      },
      'bowl-offer': (rec, silent) => {
        S._walkRoute(S.actors.ulysses, rec, caveMarks.lots, caveMarks.bowlOffer,
          { silent, label: 'cave:lots->bowl' });
        S.props.bowl.visible = true;
        S.holdAnchorName = 'bowl';
      },
      'bowl-pour': (rec, silent) => {             /* G3's release — pour one */
        S._pour(rec, silent);
      },

      /* ---------- BEAT IV · THE STAKE ---------- */
      'stake-to-embers': (rec, silent) => {
        /* the beam carried to the pit, tip-first into the embers; four
           bearers and Ulysses gather on the south rim (G4's hold rides the
           tip's own glow — the watermark law, staged as material state) */
        S.holdAnchorName = 'stake';
        S.props.bowl.visible = false;             /* the night's bowl cleared */
        const st = S.props.stake;
        st.visible = true;
        for (const m of S.props.stakeMats) m.opacity = 1;
        const p0 = st.position.clone(), q0 = st.quaternion.clone();
        const toP = rec.toWorld(640, 488, 0.62);
        const dir = rec.toWorld(632, 462, 0.30).sub(toP).normalize();
        const toQ = new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        S._mover('stake-carry', 2.0, (k) => {
          const e = easeInOut(k);
          st.position.lerpVectors(p0, toP, e);
          st.quaternion.slerpQuaternions(q0, toQ, e);
        }, { silent });
        S._walkRoute(S.actors.ulysses, rec, caveMarks.bowlOffer, [648, 517],
          { silent, label: 'cave:bowl->embers' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, rec, [713 + (i % 2) * 10, 527 + (i % 2) * 6],
            [668 + i * 9, 521 + (i % 3) * 5],
            { silent, delay: 0.2 * i, label: 'cave:bearers' });
        });
      },
      'stake-draw': (rec, silent) => {            /* drawn out, glowing with heat */
        S.tipLock = 1;
        const st = S.props.stake;
        const p0 = st.position.clone(), q0 = st.quaternion.clone();
        const toP = rec.toWorld(646, 505, 1.05);
        const dir = rec.toWorld(640, 468, 1.75).sub(toP).normalize();
        const toQ = new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        S._mover('stake-draw', 1.3, (k) => {
          const e = easeInOut(k);
          st.position.lerpVectors(p0, toP, e);
          st.quaternion.slerpQuaternions(q0, toQ, e);
        }, { silent });
      },
      'stake-drive': (rec, silent) => {
        /* the auger: five carry the point to the sprawled head and TURN it —
           horror staged in silhouette; the clock (not the tip) is the teeth */
        const st = S.props.stake;
        const p0 = st.position.clone(), q0 = st.quaternion.clone();
        /* the shaft rides ABOVE the sprawled bulk so the glowing point reads
           against the fire, angled down into the brow (silhouette law) */
        const toP = rec.toWorld(668, 528, 1.95);
        const head = rec.toWorld(702, 533, 1.70);
        const toQ = new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(toP).normalize());
        S._mover('stake-drive', 2.4, (k) => {
          const e = easeInOut(k);
          st.position.lerpVectors(p0, toP, e);
          st.quaternion.slerpQuaternions(q0, toQ, e);
        }, { silent });
        if (!silent) S.driveSpin = { t0: S.t + 1.2 };
        S._walkRoute(S.actors.ulysses, rec, [648, 517], [684, 537],
          { silent, label: 'cave:drive-u' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, rec, [668 + i * 9, 521 + (i % 3) * 5],
            [700 + i * 8, 539 + (i % 2) * 6],
            { silent, delay: 0.15 * i, label: 'cave:drive-crew' });
        });
      },
      'blind-hiss': (rec, silent) => {
        /* THE BLINDING, abstract: screen shake + the fire FLARING + the
           giant's roar — nothing shown at the eye itself (tasteful law) */
        S.driveSpin = null;
        S.movers = S.movers.filter((m) => m.id !== 'stake-drive');
        if (!silent) {
          S.shake = { t0: S.t + 0.15, amp: 0.4, dur: 1.9 };
          if (S.audio) S.audio.cue('giant-roar', { delay: 0.3 });
        }
        S._mover('blind-flare', 2.8, (k) => {
          S.flareK = k < 0.22 ? (k / 0.22) * 1.15 : 1.15 * (1 - (k - 0.22) / 0.78);
        }, { silent });
        S._mover('tip-cool', 3.0, (k) => { S.tipLock = 1 - 0.8 * easeInOut(k); },
          { silent });
        const g = S.actors['poly-idle'];
        if (g && g.mode === 'pose' && !silent) {
          const gp = g.group.position.clone(), gq = g.group.quaternion.clone();
          const qz = new THREE.Quaternion();
          S._mover('convulse', 2.4, (k) => {
            const s = Math.sin(Math.PI * clamp01(k));
            g.group.position.y = gp.y + 0.55 * s;
            qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.16 * s);
            g.group.quaternion.copy(gq).multiply(qz);
          });
        }
        const st = S.props.stake;
        const sp = st.position.clone(), sq = st.quaternion.clone();
        const dropP = rec.toWorld(700, 541, 0.16);
        const dropQ = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0.06, 0.15).normalize());
        S._mover('stake-drop', 0.8, (k) => {
          const e = easeInOut(k);
          st.position.lerpVectors(sp, dropP, e);
          st.quaternion.slerpQuaternions(sq, dropQ, e);
        }, { silent, delay: 0.5 });
      },
      'fright-scatter': (rec, silent) => {        /* "we ran away in a fright" */
        S._walkRoute(S.actors.ulysses, rec, [684, 537], [933, 528],
          { speed: SCURRY_MPS, silent, label: 'cave:fright-u' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, rec, [700 + i * 8, 539 + (i % 2) * 6],
            [903 + (i % 2) * 20, 535 + (i % 3) * 7],
            { speed: SCURRY_MPS, silent, delay: 0.12 * i, label: 'cave:fright-crew' });
        });
      },
      boulderOpen: (rec, silent) => {
        const from = S._boulderK !== undefined ? S._boulderK : 1;
        S._mover('boulder', 2.3, (k) => {
          const v = from + (0 - from) * easeInOut(k);
          rec.api.setBoulderK(v); S._boulderK = v;
        }, { silent });
        S._boulderK = 0;
        if (silent) rec.api.setBoulderK(0);
        /* the blind grope: he rolls to his feet among the sheep and feels
           his way down the audited lane to the door he can no longer see */
        const g = giant('idle');
        if (!g) return;
        if (silent) { S._stand(g, rec.toWorld(...caveMarks.doorwaySeat), 2.1); return; }
        const gp = g.group.position.clone(), gq = g.group.quaternion.clone();
        const up = rec.toWorld(806, 545);
        const uq = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(0, -1.4, 0));
        g.mode = 'pose'; g.group.visible = true; g.walk = null;
        S._mover('giant-rise', 1.6, (k) => {
          const e = easeInOut(k);
          g.group.position.lerpVectors(gp, up, e);
          g.group.quaternion.slerpQuaternions(gq, uq, e);
        }, { onDone: () => {
          S._walkRoute(g, rec, [806, 545], caveMarks.doorwaySeat,
            { speed: GIANT_MPS * 0.55, label: 'cave:grope' });
        } });
      },
      'doorway-seat': (rec, silent) => {
        const g = giant('idle');
        if (!g) return;
        const seat = rec.toWorld(...caveMarks.doorwaySeat);
        if (!silent && g.mode === 'walk' && g.walk) {
          const end = g.walk.pts[g.walk.pts.length - 1];
          if (end.distanceTo(seat) < 1.5) return;  /* the grope already ends there */
        }
        S._stand(g, seat, 2.1);
      },

      /* ---------- BEAT V · THE RAMS ---------- */
      'trios-under': (rec, silent) => {           /* the men slide under the fleeces */
        S._onStageCrew().forEach((c, i) => S._fade(c, 0, 1.1 + 0.2 * i, silent));
      },
      'ram-stand': (rec, silent) => {
        const r = S.actors['ram-great'];
        if (!r) return;
        if (silent || r.group.visible) {
          S._stand(r, rec.toWorld(...caveMarks.ramStand), 2.2);
          return;
        }
        S._walkRoute(r, rec, [900, 545], caveMarks.ramStand,
          { speed: 1.5, label: 'cave:ram-in' });
      },
      slingUnder: (rec, silent) => {
        /* G5 — the no-text click IS the sling-under: the reader drops to the
           under-fleece POV for two seconds (the 3D stage's own delight) */
        S._fade(S.actors.ulysses, 0, 0.8, silent);
        if (silent) return;
        S.pov = { until: S.t + 2.0, follow: 'ram-great' };
        const r = S.actors['ram-great'];
        if (r && r.group.visible) {
          const V = r.group.getWorldPosition(new THREE.Vector3());
          const want = { x: V.x, y: 0.55, z: V.z + 0.35, k: 5.6,
                         e: THREE.MathUtils.degToRad(4) };
          S.camWant = { ...want };
          Object.assign(S.camState, want);        /* a CUT, not a glide */
        }
      },
      'flock-stream': (rec, silent) => {
        /* dawn: the males hurry out to feed — the stream down the audited
           lane and out the mouth; the ewes stay bleating by the pens */
        /* THREE rams stream out with men slung under them (the amendment) */
        const walkers = Array.from({ length: FLOCK_CAP }, (_, i) => S.actors['flock-' + i])
          .filter(Boolean);
        walkers.forEach((a, i) => {
          S._walkRoute(a, rec, [905 + i * 15, 543 + (i % 2) * 5], [332, 441],
            { speed: 1.7, silent, delay: 0.85 * i, label: 'cave:stream-out' });
          if (silent) S._off(a);
        });
        if (!silent) S._flockExit = { t0: S.t, walkers };
      },
      'ram-at-mouth': (rec, silent) => {
        const r = S.actors['ram-great'];
        if (!r) return;
        if (silent) { S._stand(r, rec.toWorld(...caveMarks.ramAtMouth), 2.4); return; }
        S._walkRoute(r, rec, caveMarks.ramStand, caveMarks.ramAtMouth,
          { speed: 1.1, label: 'cave:ram-last' });
      },
      'free-men': (rec, silent) => {},            /* carried by the seg */

      /* ---------- SEA (Beat VI) ---------- */
      establish: (rec, silent) => {
        if (S.activeName !== 'sea') return;       /* Beat I's establish is a no-op */
        const g = S.actors['poly-idle'];
        if (g) {
          const face = Math.atan2(rec.shipHome.pos.x - rec.browGiant.x,
                                  rec.shipHome.pos.z - rec.browGiant.z);
          S._stand(g, rec.browGiant, face);
        }
        const DECK = rec.api.SHIP.deckY;
        S._deck(S.actors.ulysses, rec, [0, DECK, -4.6], 0);
        const rows = [-3.8, -1.3, 1.2];
        S._crew(ROWER_CAP).forEach((c, i) => {     /* four oars in the frame */
          S._deck(c, rec, [(i % 2 ? -0.78 : 0.78), DECK, rows[Math.floor(i / 2)]],
            Math.PI);
        });
      },
      jeer: (rec, silent) => { S.clock0 = S.t; },
      defy: (rec, silent) => {},
      shout: (rec, silent) => { S.clock0 = S.t; },
      'stern-ulysses': (rec, silent) => {
        if (S.activeName !== 'sea') return;
        S._deck(S.actors.ulysses, rec, [0, rec.api.SHIP.deckY, -5.5], 0);
      },
      'stern-rail': (rec, silent) => {
        if (S.activeName !== 'sea') return;
        S._deck(S.actors.ulysses, rec, [0, rec.api.SHIP.deckY, -6.0], 0);
      },
      'rock-one': (rec, silent) => {
        /* ROCK 1: tear (0.9 s), the parabolic arc (the set's own 1.7 s
           ballistics), splash AHEAD OF THE RUDDER on the ledger's
           splashImpact1 — and the wash drives the ship BACK before the
           oars bite (pole-push staged as the settle) */
        S._seaThrow(rec, 0, 0.9, null, silent);
        const ship = rec.api.SHIP.group;
        const from = ship.position.clone();
        const back = from.clone().add(new THREE.Vector3(2.6, 0, 0.5));
        const settle = from.clone().add(new THREE.Vector3(1.1, 0, 0.2));
        S._mover('wash-back', 3.2, (k) => {
          if (k < 0.5) ship.position.lerpVectors(from, back, easeInOut(k / 0.5));
          else ship.position.lerpVectors(back, settle, easeInOut((k - 0.5) / 0.5));
        }, { silent, delay: 2.6 });
      },
      'double-distance': (rec, silent) => {       /* "twice as far as before" */
        const ship = rec.api.SHIP.group;
        const from = ship.position.clone();
        const to = rec.shipHome.pos.clone().add(new THREE.Vector3(-17.5, 0, 1.5));
        S._mover('double-distance', 6.5, (k) => {
          ship.position.lerpVectors(from, to, easeInOut(k));
        }, { silent });
      },
      'rock-two': (rec, silent) => {
        /* ROCK 2, the curse's punctuation: thrown at the ship's OWN stern
           wherever the escape has carried it — the near-miss astern whose
           wash drives them ONWARD */
        const ship = rec.api.SHIP.group;
        const h = ship.rotation.y;
        const stern = new THREE.Vector3(
          ship.position.x + Math.sin(h) * -7.1, 0,
          ship.position.z + Math.cos(h) * -7.1);
        S._seaThrow(rec, 1, 0.5,
          new THREE.Vector3(stern.x - 1.9, 0, stern.z + 1.3), silent);
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-4.6, 0, -0.6));
        S._mover('wash-onward', 3.4, (k) => {
          ship.position.lerpVectors(from, to, easeInOut(k));
        }, { silent, delay: 2.2 });
      },
      curse: (rec, silent) => {
        S.clock0 = S.t;
        /* the sky darkens a stop under the prayer */
        const hemi = rec.api.parts['night-rig'], moon = rec.api.moonLight;
        const h0 = hemi.intensity, m0 = moon.intensity;
        S._mover('curse-dark', 2.2, (k) => {
          hemi.intensity = h0 + (rec.hemiBase * 0.72 - h0) * easeInOut(k);
          moon.intensity = m0 + (rec.moonBase * 0.8 - m0) * easeInOut(k);
        }, { silent });
        const g = S.actors['poly-idle'];
        if (g && g.group.visible && !silent) {
          const s0 = g.model.scale.x;
          S._mover('curse-rise', 2.6, (k) => {
            g.model.scale.setScalar(s0 * (1 + 0.05 * Math.sin(Math.PI * clamp01(k))));
          });
        }
      },
      'sea-dawn': (rec, silent) => {
        /* dawn lift + THE SAIL-OFF: the long glide toward the moonpath */
        const hemi = rec.api.parts['night-rig'], moon = rec.api.moonLight;
        const h0 = hemi.intensity, m0 = moon.intensity;
        S._mover('sea-dawn', 4.5, (k) => {
          hemi.intensity = h0 + (rec.hemiBase * 1.35 - h0) * easeInOut(k);
          moon.intensity = m0 + (rec.moonBase * 1.15 - m0) * easeInOut(k);
        }, { silent });
        const ship = rec.api.SHIP.group;
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-9.5, 0, -5.5));
        S._mover('sail-off', 12.0, (k) => {
          ship.position.lerpVectors(from, to, easeInOut(k));
          /* THE HOLE-PATCH LAW. The 3D hull rides ON the painted hull until it
             leaves; the plate's own pixels can't move with it, so a DERIVED
             water bed (cut from the plate's own rows above and below, never
             written back into it) fades in under the departing ship exactly as
             fast as it departs. No inpainting, no ghost. */
          if (rec.plate) rec.plate.setPatch('ship-hole', Math.min(1, easeInOut(k) * 3.2));
        }, { silent });
      },

      /* the closing leaf */
      bookOffstage: () => { for (const a of Object.values(S.actors)) S._off(a); },
    };
    return this.__acts;
  }

  /** pours 2-3 ride the autos — main3d asks for the same pantomime again */
  fx(name, delay = 0) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;
    if (name === 'pour') {
      const S = this;
      this._mover('pour-fx-' + this.acts.length, 1.4, (k) => S._applyPour(k),
        { delay });
    }
  }

  _pour(rec, silent) {
    const S = this;
    this._mover('pour', 1.4, (k) => S._applyPour(k), { silent });
  }
  _applyPour(k) {
    const wine = this.props.wine;
    if (!wine) return;
    /* fill sinks as the bowl empties toward the giant, then refills with holdK */
    const drain = easeInOut(k);
    wine.scale.setScalar(Math.max(0.01, 1 - drain));
    if (this.props.bowl) this.props.bowl.rotation.z = Math.sin(Math.PI * k) * 0.7;
  }

  /** Arm ONE of the sea set's ballistic rocks at a story moment. The set's
   *  scheduler stays pure f(simT) — the story only writes the offset (and,
   *  for the near-miss, the target) at act-fire time. The impact time joins
   *  seaHits so the hull pitches on the wash. */
  _seaThrow(rec, idx, delay, target = null, silent = false) {
    const r = rec.api.ROCKS[idx];
    if (target) r.target.copy(target);
    r.offset = silent ? this.t - 60 : this.t + delay;
    if (!silent) {
      this.seaHits.push(r.offset + r.flight);
      if (this.audio) this.audio.cue('splash', { delay: delay + r.flight });
    }
  }

  /* ================= segs (pantomime) ================= */
  startSeg(name, dur = 6, silent = false) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;
    const S = this;
    const caveEntryPts = { from: [330, 442], to: [640, 405] };
    switch (name) {
      case 'landfall': {                           /* the ships ghost in */
        if (this.activeName !== 'shore') break;
        const s1 = rec.api.parts['ship-1'], s2 = rec.api.parts['ship-2'];
        const h1 = s1.position.clone(), h2 = rec.ship2Home.pos.clone();
        const o1 = h1.clone().add(new THREE.Vector3(10, 0, -14));
        const o2 = h2.clone().add(new THREE.Vector3(12, 0, -12));
        this._mover('landfall', dur, (k) => {
          const e = easeInOut(k);
          s1.position.lerpVectors(o1, h1, e);
          s2.position.lerpVectors(o2, h2, e);
        }, { silent });
        break;
      }
      case 'hunt': break;                          /* pantomime carried by the bed */
      case 'entry': {                              /* the men slip in past the pens */
        if (this.activeName !== 'cave') break;
        const u = this.actors.ulysses;
        this._walkRoute(u, rec, caveEntryPts.from, [610, 412],
          { silent, label: 'cave:entry-u' });
        this._aliveCrew().forEach((c, i) => {
          this._walkRoute(c, rec, caveEntryPts.from,
            [604 + (i % 4) * 24, 396 + (i % 3) * 6],
            { silent, delay: 0.28 * i, label: 'cave:entry-crew' });
        });
        break;
      }
      case 'return': {                             /* POLYPHEMUS in under the load */
        if (this.activeName !== 'cave') break;
        const w = this.actors['poly-walk'], i = this.actors['poly-idle'];
        if (i) this._off(i);
        if (w) this._walkRoute(w, rec, [340, 436], [760, 452],
          { speed: GIANT_MPS, silent, label: 'cave:giant-enter' });
        break;
      }
      case 'milking': break;
      case 'seize': {                              /* O.6 — identical, three times */
        this.meals = Math.min(3, this.meals + 1);
        /* the headcount law is arithmetic (12 − 2·meals); the STAGE shows
           two of the few on the leaf go, and the next act restages the
           capped roster out of the company still off-frame */
        const taken = this._onStageCrew().slice(-2);
        for (const c of taken) this._fade(c, 0, 1.4, silent);
        if (!silent) {
          /* the clutch: a scale/pose beat on the seated bulk — kept abstract */
          const g = this.actors['poly-idle'];
          if (g && g.mode !== 'off') {
            this._mover('clutch', Math.min(4, dur), (k) => {
              const s = 1 + 0.05 * Math.sin(Math.PI * clamp01(k));
              g.model.scale.setScalar(g.baseScale * g.local * s);
              g.group.rotation.y = g.face + 0.35 * Math.sin(Math.PI * clamp01(k));
            });
          }
        }
        for (const c of taken) { if (silent) this._off(c); }
        break;
      }
      case 'flock-out': {                          /* stone up, flock out, stone to */
        if (this.activeName !== 'cave') break;
        this._flockStream(rec, 'out', dur, silent);
        break;
      }
      case 'flock-in': {
        if (this.activeName !== 'cave') break;
        this._flockStream(rec, 'in', dur, silent);
        /* the stone rolls up and the four leave the chip circle for the dark
           corner — the leaf drops back to the capped roster (crowd amendment) */
        {
          const left = this._aliveCrew();
          const spots = this._cluster(rec.toWorld(933, 541), left.length, 71031, 1.3);
          left.forEach((c, j) => this._stand(c, spots[j], -1.1));
          for (const c of this._crew(CREW_POOL).slice(left.length)) this._off(c);
        }
        const w = this.actors['poly-walk'], i = this.actors['poly-idle'];
        if (i) this._off(i);
        if (w) this._walkRoute(w, rec, [340, 436], [760, 452],
          { speed: GIANT_MPS, silent, delay: 1.2, label: 'cave:giant-return' });
        break;
      }
      case 'stake-make': {
        if (this.props.stake) {
          const st = this.props.stake, mats = this.props.stakeMats;
          st.visible = true;
          st.position.copy(this.props.stakeAt);
          if (!silent) {
            for (const m of mats) { m.transparent = true; m.opacity = 0; }
            this._mover('stake-make', dur * 0.6, (k) => {
              for (const m of mats) m.opacity = easeInOut(k);
            });
          }
        }
        break;
      }
      case 'collapse':                             /* the wine takes him — the
                                                      unit's own cave-embers act
                                                      animates the sprawl */
        break;
      case 'lash-trios': {                         /* the withies: the flock edges
                                                      west along the south lane */
        if (this.activeName !== 'cave') break;
        const eweFrom = [[938, 538], [972, 545], [1002, 540], [915, 548]];
        const eweTo = [[884, 540], [906, 546], [928, 542], [862, 548]];
        eweFrom.forEach((from, i) => {
          const e = this.actors['ewe-' + i];
          if (e) this._walkRoute(e, rec, from, eweTo[i],
            { speed: 0.8, silent, delay: 0.4 * i, label: 'cave:lash' });
        });
        break;
      }
      case 'free-men': {                           /* out past the yards: the ram
                                                      trots clear, the men appear */
        if (this.activeName !== 'cave') break;
        const r = this.actors['ram-great'];
        if (r) {
          this._walkRoute(r, rec, [395, 438], [318, 452],
            { speed: 1.1, silent, label: 'cave:ram-clear' });
          if (silent) this._off(r);
          else r.fade = { t0: this.t + 2.4, dur: 1.0, from: 1, to: 0 };
        }
        this._appear(this.actors.ulysses, rec.toWorld(372, 486), 2.6,
          { delay: 1.4, silent });
        /* the men who rode out under the three rams stand up on the grass */
        const freed = this._aliveCrew();
        const spots = this._cluster(rec.toWorld(414, 498), freed.length, 71081, 1.5);
        freed.forEach((c, i) => this._appear(c, spots[i], 2.2 + 0.2 * i,
          { delay: 2.2 + 0.35 * i, silent }));
        break;
      }
      case 'return-beach': {                       /* dusk time-dip + the glide home */
        if (this.activeName !== 'sea') break;
        const hemi = rec.api.parts['night-rig'], moon = rec.api.moonLight;
        const h0 = hemi.intensity, m0 = moon.intensity;
        this._mover('dusk-dip', dur * 0.7, (k) => {
          hemi.intensity = h0 + (rec.hemiBase * 0.66 - h0) * easeInOut(k);
          moon.intensity = m0 + (rec.moonBase * 0.72 - m0) * easeInOut(k);
        }, { silent });
        const ship = rec.api.SHIP.group;
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-3.2, 0, 2.4));
        this._mover('return-glide', dur, (k) => {
          ship.position.lerpVectors(from, to, easeInOut(k));
        }, { silent });
        break;
      }
      default: break;                              /* other pantomimes: bed-carried */
    }
  }

  _flockStream(rec, dir, dur, silent) {
    const boulderMove = (toK, delay) => {
      const from = this._boulderK !== undefined ? this._boulderK : 1;
      this._mover('boulder', 1.3, (k) => {
        const v = from + (toK - from) * easeInOut(k);
        rec.api.setBoulderK(v); this._boulderK = v;
      }, { silent, delay });
      this._boulderK = toK;
      if (silent) rec.api.setBoulderK(toK);
    };
    boulderMove(0, 0);                             /* the stone comes up */
    const ram = this.actors['ram-great'];
    const ewes = [0, 1, 2, 3].map((i) => this.actors['ewe-' + i]).filter(Boolean);
    const penPx = [900, 545], mouthPx = [330, 440];
    const walkers = [ram, ...ewes].filter(Boolean);
    walkers.forEach((a, i) => {
      const from = dir === 'out' ? [penPx[0] - i * 14, penPx[1] - (i % 2) * 8] : mouthPx;
      const to = dir === 'out' ? mouthPx : [penPx[0] - i * 16, penPx[1] - (i % 2) * 9];
      this._walkRoute(a, rec, from, to,
        { speed: 1.6, silent, delay: 0.5 * i, label: 'cave:flock-' + dir });
      if (dir === 'out' && !silent) this._fade(a, 0, 0.8, false);
    });
    if (dir === 'out') {
      walkers.forEach((a) => { if (silent) this._off(a); else { a.fade = null; } });
      /* fade each walker as it reaches the mouth: handled in step by route end */
      this._flockExit = { t0: this.t, walkers };
      boulderMove(1, Math.max(1.6, dur - 1.4));    /* ...claps to */
      if (this.audio && !silent) this.audio.cue('boulder-boom', { delay: Math.max(1.6, dur - 1.4) + 1.0 });
    } else {
      walkers.forEach((a) => { a.opacity = 1; });
      this._flockExit = null;
    }
  }

  /* ================= gates: targets + holds ================= */
  targetLive(name) {
    if (!this.activeName) return false;
    if (name === 'ship') return this.activeName === 'shore';
    if (name === 'sword') return this.activeName === 'cave' && this.swordLive;
    if (name === 'ram-great') {
      const r = this.actors['ram-great'];
      return this.activeName === 'cave' && !!(r && r.group.visible);
    }
    if (name === 'cyclops') {
      const g = this.actors['poly-idle'];
      return this.activeName === 'sea' && !!(g && g.group.visible);
    }
    return false;
  }

  _targetWorld(name, V) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return V.set(0, 0, 0);
    if (name === 'ship') {
      const s = rec.api.parts['ship-2'];
      return V.copy(s.position).add(new THREE.Vector3(0, 1.6, 0));
    }
    if (name === 'sword') return V.copy(this.props.swordAt);
    if (name === 'ram-great') {
      const r = this.actors['ram-great'];
      return V.copy(r ? r.group.position : new THREE.Vector3()).setY(0.8);
    }
    if (name === 'cyclops') {
      const g = this.actors['poly-idle'];
      if (g && g.group.visible)
        return g.group.getWorldPosition(V).add(new THREE.Vector3(0, 4.2, 0));
      return V.copy(rec.browGiant || new THREE.Vector3()).add(new THREE.Vector3(0, 4.2, 0));
    }
    return V.set(0, 0, 0);
  }

  _holdWorld(V) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return V.set(0, 0, 0);
    if (this.holdAnchorName === 'bowl' && this.props.bowlAt) return V.copy(this.props.bowlAt);
    if (this.holdAnchorName === 'stake' && this.props.stake) {
      /* the ring rides THE TIP in the embers (G4's watermark) */
      this.props.stake.updateWorldMatrix(true, false);
      return this.props.stake.localToWorld(V.set(0, 0.81, 0));
    }
    return V.copy(rec.fireAnchor);
  }

  _headWorld(who, V) {
    /* WORLD positions — a deck actor's group is local to the ship's sway */
    if (who === 'ULYSSES') {
      const u = this.actors.ulysses;
      if (u && u.group.visible)
        return u.group.getWorldPosition(V).add(new THREE.Vector3(0, 1.62 * u.local, 0));
    }
    if (who === 'POLYPHEMUS') {
      for (const id of ['poly-idle', 'poly-walk']) {
        const g = this.actors[id];
        if (g && g.group.visible) {
          return g.mode === 'pose'
            ? g.group.getWorldPosition(V).add(new THREE.Vector3(-2.6, 0.6, 0))
            : g.group.getWorldPosition(V).add(new THREE.Vector3(0, 6.4, 0));
        }
      }
    }
    return null;
  }
  headPlate(who) { return !!this._headWorld(who, new THREE.Vector3()); }

  _project(V) {                        /* world -> viewport px */
    const r = this.rect || this.canvas.getBoundingClientRect();
    const p = V.clone().project(this.cam);
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width,
             y: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }

  anchorScreen(kind, name) {
    const V = new THREE.Vector3();
    if (kind === 'target') this._targetWorld(name, V);
    else if (kind === 'head') { if (!this._headWorld(name, V)) return { x: -999, y: -999 }; }
    else this._holdWorld(V);
    return this._project(V);
  }

  targetPlate(name) {
    const p = this.anchorScreen('target', name);
    const r = this.rect || this.canvas.getBoundingClientRect();
    return [p.x - r.left, p.y - r.top];
  }

  targetHit(name, px, py) {
    if (!this.targetLive(name)) return false;
    const RADII = { ship: 5.0, sword: 0.9, 'ram-great': 1.6, cyclops: 8.0 };
    const V = new THREE.Vector3();
    this._targetWorld(name, V);
    const a = this._project(V);
    const b = this._project(V.clone().add(new THREE.Vector3(RADII[name] || 1, 0, 0)));
    const rad = Math.max(20, Math.hypot(b.x - a.x, b.y - a.y));
    return Math.hypot(a.x - px, a.y - py) <= rad;
  }

  setHold(k) { this.holdK = k; }
  setReveal() {}
  clip() {}
  shot() {}

  /* ================= the beat clock + waits (Beat IV/VI) ================= */
  clockT() { return this.clock0 === null ? null : +(this.t - this.clock0).toFixed(3); }
  startClock() { this.clock0 = this.t; }
  waitDone(name) {
    const ct = this.clockT();
    if (name === 'rock1') return ct !== null && ct >= 11.0;
    if (name === 'rock2') return ct !== null && ct >= 5.2;
    return true;
  }

  /* ================= camera / focus ================= */
  _focusTable() {
    if (this.__focus) return this.__focus;
    const sw = SHORE_WORLD, cw = CAVE_WORLD;
    const S = (px, py, k, y = 0.9) => ({ x: sw.X(px), y, z: sw.Z(py), k });
    const C = (px, py, k, y = 1.0) => ({ x: cw.X(px), y, z: cw.Z(py), k });
    this.__focus = {
      shore: {
        establishing: { x: 23.5, y: 2.6, z: -13.5, k: 1 },
        'camp-fire': S(438, 466, 2.3, 1.1),
        smoke: { x: 40, y: 4.5, z: -28, k: 1.35 },
        council: S(540, 500, 2.0, 1.0),
        'council-close': S(555, 500, 3.1, 1.0),
        'cavemouth-push-from': { x: 40, y: 3.0, z: -24, k: 1.5 },
        'cavemouth-push-to': { x: 49.5, y: 3.2, z: -30.5, k: 2.6 },
        'crag-tilt': { x: -16, y: 9, z: -6, k: 1.6 },
        'ship-mid': S(600, 460, 2.0, 1.1),
        'skin-close': S(575, 495, 3.3, 1.0),
      },
      cave: {
        establishing: { x: 0.6, y: 1.15, z: -0.9, k: 1 },
        'racks-sweep': C(700, 300, 2.0, 1.7),
        'doorlight-hinge': C(420, 430, 2.0, 1.2),
        'discovery-low': { ...C(900, 520, 1.8, 0.9), e: 15 },
        mouth: C(360, 435, 1.7, 1.6),
        'eye-close': { ...C(775, 465, 2.9, 5.8), e: 6, roofless: true },
        twoshot: { ...C(715, 488, 1.8, 2.6), e: 12 },
        'meal-close': C(830, 505, 2.5, 1.1),
        sword: C(690, 545, 3.0, 0.8),
        'scheme-push': C(800, 528, 2.6, 1.0),
        'club-wide': C(720, 480, 1.3, 1.2),
        'lots-overhead': C(713, 527, 2.3, 0.9),
        'bowl-close': C(705, 505, 3.1, 1.1),
        'face-flush': { ...C(775, 465, 2.7, 5.5), e: 6, roofless: true },
        collapse: C(780, 535, 2.0, 1.0),
        'ember-close': C(630, 430, 3.0, 0.8),
        'drive-tight': C(700, 470, 3.0, 2.2),
        'sprawl-groan': C(814, 533, 2.4, 1.2),
        puzzling: C(500, 480, 1.9, 1.2),
        'lash-close': C(880, 470, 2.8, 0.9),
        'ram-close': C(838, 430, 3.0, 0.9),
        'handpass-tight': C(400, 440, 3.0, 1.6),
        'doorway-twoshot': C(370, 450, 2.4, 1.6),
        'freed-overshoulder': C(360, 445, 1.8, 1.4),
      },
      sea: {
        establishing: { x: 0, y: 7.8, z: 0, k: 1 },
        'gate-wide': { x: 0, y: 7.8, z: 0, k: 1 },
        stern: { x: SEA_WORLD.X(518), y: 2.4, z: SEA_WORLD.Z(430), k: 2.6 },
        'ship-deck': { x: SEA_WORLD.X(575), y: 2.0, z: SEA_WORLD.Z(455), k: 2.0 },
        'menbeg-close': { x: SEA_WORLD.X(590), y: 1.8, z: SEA_WORLD.Z(465), k: 2.8 },
        'defy-strait': { x: 6, y: 6.0, z: -4, k: 1.3 },
        'stern-rail': { x: SEA_WORLD.X(510), y: 2.6, z: SEA_WORLD.Z(428), k: 3.2 },
        clifftop: { x: SEA_WORLD.X(860), y: 18, z: SEA_WORLD.Z(215), k: 2.4 },
        'hades-twoshot': { x: SEA_WORLD.X(560), y: 3.0, z: SEA_WORLD.Z(440), k: 2.2 },
        curse: { x: SEA_WORLD.X(860), y: 19, z: SEA_WORLD.Z(210), k: 2.0 },
        strait: { x: 0, y: 6, z: 0, k: 1.15 },
        homeward: { x: -8, y: 5, z: 4, k: 1.2 },
        moonpath: { x: -4, y: 6, z: 0, k: 1.05 },
      },
    };
    return this.__focus;
  }

  setFocus(name, snap = false) {
    if (!this.activeName || !this.camState) return;
    /* the sling-under POV owns the camera while it lasts (G5's 2 s drop) */
    if (this.pov && this.t < this.pov.until) return;
    const rec = this.sets[this.activeName];
    /* THE BOOK'S OWN LENS TABLE (tools/ody/ledger.json -> 3d/lenses.json): a
       centre in plate px and a zoom k, nothing else. The camera IS the plate's
       framing — same elevation always, no free camera, and k means exactly
       what the ledger's lensLaw says (visible box 1408/k x 768/k px). */
    const L = (rec.lenses || {})[name] || (rec.lenses || {}).establishing;
    if (!L) return;
    const f = { x: L.v.x, y: 0, z: L.v.z, k: L.k };
    const e = rec.camBase.elev;
    this.lens = { name, at: L.at, k: L.k };
    this.camWant = { x: f.x, y: f.y, z: f.z, k: f.k, e };
    /* the ship lenses FOLLOW the escape: driven back, doubled, sailed off —
       each lens keeps its authored offset from the painted mooring */
    if (this.activeName === 'sea' && Stage3D.SHIP_LENSES.has(name)) {
      const ship = rec.api.SHIP.group;
      this.camWant.x += ship.position.x - rec.shipHome.pos.x;
      this.camWant.z += ship.position.z - rec.shipHome.pos.z;
    }
    /* the roofless-close-up hack is retired with the shell: on the SAM2 path
       the cave's roof is PAINT, and paint never stood between a lens and a
       head — the plate frames what the plate frames. */
    if (snap) {
      Object.assign(this.camState, this.camWant);
      this.applyCam();
    }
  }

  setView(w, h) { this.view.w = w; this.view.h = h; }
  layout() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    const pr = this.renderer.getPixelRatio();
    if (this.canvas.width !== Math.floor(w * pr) || this.canvas.height !== Math.floor(h * pr)) {
      this.renderer.setSize(w, h, false);
    }
    this.rect = this.canvas.getBoundingClientRect();
  }
  get F() { return (this.rect ? this.rect.width : 1) / 1408; }

  applyCam() {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built || !this.camState) return;
    const cb = rec.camBase;
    const s = this.camState;
    const aspect = (this.rect && this.rect.height > 0)
      ? this.rect.width / this.rect.height : 1408 / 768;
    const halfW = cb.halfW / Math.max(0.2, s.k);
    let sx = 0, sy = 0;
    if (this.shake) {
      const st = (this.t - this.shake.t0) / this.shake.dur;
      if (st >= 0 && st <= 1) {
        const decay = (1 - st) * this.shake.amp;
        sx = Math.sin(this.t * 31) * decay;
        sy = Math.sin(this.t * 41 + 1.3) * decay * 0.6;
      }
    }
    this.cam.left = -halfW; this.cam.right = halfW;
    this.cam.top = halfW / aspect; this.cam.bottom = -halfW / aspect;
    this.cam.near = 0.1; this.cam.far = 1200;
    const elev = s.e !== undefined ? s.e : cb.elev;
    const tgt = new THREE.Vector3(s.x + sx, s.y + sy, s.z);
    this.cam.position.set(
      tgt.x, tgt.y + cb.R * Math.sin(elev), tgt.z + cb.R * Math.cos(elev));
    this.cam.lookAt(tgt);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld(true);   /* anchorScreen projects before render */
    /* the shared GPU point systems draw in canvas px per metre */
    if (rec.api.setPixelScale && this.rect) {
      rec.api.setPixelScale(this.rect.width / (2 * halfW));
    }
  }

  /* ================= the fixed step ================= */
  step(t, dt) {
    this.t = t;
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;

    /* movers */
    for (const m of this.movers) {
      if (t < m.t0) continue;
      const k = m.dur <= 0 ? 1 : clamp01((t - m.t0) / m.dur);
      m.apply(k);
      if (k >= 1 && !m.finished) { m.finished = true; if (m.onDone) m.onDone(); }
    }
    this.movers = this.movers.filter((m) => !m.finished);

    /* actors: walks + mixers + fades */
    const P = new THREE.Vector3(), DIR = new THREE.Vector3();
    for (const a of Object.values(this.actors)) {
      if (a.mode === 'off') continue;
      if (a.mode === 'walk' && a.walk) {
        const { done, moving } = a.walk.at(t, P, DIR);
        a.group.position.copy(P);
        if (moving || done) a.group.rotation.set(0, Math.atan2(DIR.x, DIR.z), 0);
        if (a.mixer && a.clip) {
          const wt = moving ? ((t - a.walk.t0) % a.clipDur + a.clipDur) % a.clipDur : 0;
          a.mixer.setTime(wt);
        }
        if (done) {
          a.mode = 'stand';
          a.face = Math.atan2(DIR.x, DIR.z);
          /* the sword arms when Ulysses reaches its mark */
          if (a.id === 'ulysses' && this.activeName === 'cave' &&
              this.holdAnchorName !== 'bowl' && this.props.sword &&
              a.group.position.distanceTo(this.props.swordAt) < 1.4) {
            this.swordLive = true;
            this.props.sword.visible = true;
          }
          a.walk = null;
        }
      } else if ((a.mode === 'stand' || a.mode === 'deck') && a.mixer) {
        a.mixer.setTime(0);
      }
      if (a.fade) {
        const k = clamp01((t - a.fade.t0) / a.fade.dur);
        a.opacity = a.fade.from + (a.fade.to - a.fade.from) * k;
        if (k >= 1) {
          const gone = a.fade.to <= 0;
          a.fade = null;
          if (gone) this._off(a);
        }
      }
      for (const m of a.mats) m.opacity = a.opacity;
    }
    /* flock-out exits: a walker that reaches the mouth leaves the leaf */
    if (this._flockExit) {
      for (const a of this._flockExit.walkers) {
        if (a.mode === 'stand' && a.group.visible &&
            a.group.position.x < CAVE_WORLD.X(400)) this._off(a);
      }
    }

    /* the sling-under POV: follow the great ram's belly while it lasts */
    if (this.pov) {
      if (t >= this.pov.until) this.pov = null;
      else {
        const f = this.actors[this.pov.follow];
        if (f && f.group.visible) {
          const V = f.group.getWorldPosition(new THREE.Vector3());
          this.camWant = { x: V.x, y: 0.55, z: V.z + 0.35, k: 5.6,
                           e: THREE.MathUtils.degToRad(4) };
        }
      }
    }

    /* camera pursuit (critically damped, fixed-step deterministic) */
    if (this.camState && this.camWant) {
      const e = 1 - Math.exp(-EASE_RATE * dt);
      if (this.followShip && this.activeName === 'shore') {
        const ship = rec.api.parts['ship-2'];
        this.camWant.x = ship.position.x;
        this.camWant.z = ship.position.z;
        this.camWant.y = 2.2;
        this.camWant.k = Math.max(1.5, this.camWant.k);
      }
      this.camState.x += (this.camWant.x - this.camState.x) * e;
      this.camState.y += (this.camWant.y - this.camState.y) * e;
      this.camState.z += (this.camWant.z - this.camState.z) * e;
      this.camState.k += (this.camWant.k - this.camState.k) * e;
      if (this.camWant.e !== undefined) {
        this.camState.e += (this.camWant.e - this.camState.e) * e;
      }
    }

    /* the set's own life + state arithmetic */
    rec.api.tick(t);
    if (this.activeName === 'cave' && rec.api.applyState) {
      /* the embers hold glows; the blinding FLARES (both ride the same knob) */
      rec.api.applyState(this.holdK * 0.9 + this.flareK);
      /* the blaze's own flame points dim to embers with the state (IV's law:
         the particle fire visibly sinks, not just its light) */
      if (rec.flames) {
        const fk = Math.max(0, Math.min(1.25,
          rec.api.state.cur.fire + this.holdK * 0.9 + this.flareK));
        const w = 0.45 + 0.55 * Math.min(1, fk);
        rec.flames.scale.set(w, 0.22 + 0.78 * fk, w);
      }
      /* THE GLOWING TIP: material state + its own light, holdK-driven under
         G4, locked by the draw, cooled by the hiss */
      if (this.props.stakeTipMat) {
        const glow = Math.max(this.tipLock,
          this.holdAnchorName === 'stake' ? this.holdK : 0);
        this.props.stakeTipMat.emissiveIntensity = 3.2 * glow;
        this.props.stakeTipLight.intensity = 30 * glow;
        if (this.driveSpin && t >= this.driveSpin.t0) {
          this.props.stakeSpin.rotation.y = (t - this.driveSpin.t0) * 5.5;
        }
      }
    }
    if (this.activeName === 'sea') {
      /* rock-wash: the hull PITCHES on each impact (added after the set's
         own sway tick — still pure f(story time)) */
      const sway = rec.api.SHIP.sway;
      for (const ti of this.seaHits) {
        const tau = t - ti;
        if (tau > 0 && tau < 2.6) {
          const env = Math.exp(-tau * 1.7) * 0.055;
          sway.rotation.x += env * Math.sin(tau * 7.0);
          sway.rotation.z += env * 0.6 * Math.sin(tau * 5.2 + 0.7);
        }
      }
    }
    if (this.props.wine && this.holdAnchorName === 'bowl') {
      /* the bowl FILLS with the hold (rest kept — k banks upstream) */
      const filling = Math.max(this.props.wine.scale.x, this.holdK);
      if (this.holdK > 0.02) this.props.wine.scale.setScalar(Math.min(1, filling));
    }
    this.applyCam();
    /* the painting lights the cast — sampled after the camera settles, so the
       key follows the lens the way the plate's own light does */
    this._plateLightStep();
  }

  render() {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;
    this.renderer.render(rec.scene, this.cam);
    this.renders++;
  }

  snapshot() {
    const rec = this.sets[this.activeName];
    return {
      set: this.activeName,
      cam: this.camState ? { x: +this.camState.x.toFixed(2), z: +this.camState.z.toFixed(2),
                             k: +this.camState.k.toFixed(2) } : null,
      dim: 0,
      meals: this.meals,
      census: this.census(),          /* the crowd amendment's own gate */
      crewCap: this.crewCap(),
      boulderK: this._boulderK === undefined ? 1 : +(+this._boulderK).toFixed(2),
      caveState: this.sets.cave && this.sets.cave.built ? this.sets.cave.api.state.name : null,
      movers: this.movers.map((m) => m.id),
      actors: Object.fromEntries(Object.entries(this.actors).map(([id, a]) =>
        [id, { on: a.group.visible, mode: a.mode,
               x: +a.group.position.x.toFixed(2), z: +a.group.position.z.toFixed(2) }])),
      triangles: rec && rec.built ? rec.api.triangles : 0,
      acts: this.acts.length,
      audits: this.audits,
      pov: !!(this.pov && this.t < this.pov.until),
      tipGlow: +Math.max(this.tipLock,
        this.holdAnchorName === 'stake' ? this.holdK : 0).toFixed(3),
      flareK: +this.flareK.toFixed(3),
      seaHits: this.seaHits.map((v) => +v.toFixed(2)),
      rocks: this.sets.sea && this.sets.sea.built
        ? this.sets.sea.api.ROCKS.map((r) => (r.offset > -1e8 ? +r.offset.toFixed(2) : null))
        : null,
      shipDx: this.sets.sea && this.sets.sea.built
        ? +(this.sets.sea.api.SHIP.group.position.x - this.sets.sea.shipHome.pos.x).toFixed(2)
        : null,
      /* ---- the SAM2 path's own evidence ---- */
      lens: this.lens || null,
      plateState: rec && rec.plate ? rec.plate.stateB : null,
      plateMix: rec && rec.plate ? +rec.plate.mixK.toFixed(3) : null,
      bands: rec && rec.plate ? rec.plate.census().length : 0,
      retired: rec ? rec.retired || null : null,
      light: this.lightSample || null,
    };
  }

  /** the occluder census of the mounted set — the harness's occlusion gate */
  plateCensus(name) {
    const rec = this.sets[name || this.activeName];
    return rec && rec.plate ? rec.plate.census() : [];
  }

  /** plate px of a world point on the mounted set (harness + gates) */
  plateOf(v) {
    const rec = this.sets[this.activeName];
    return rec && rec.toPlate ? rec.toPlate(v) : null;
  }

  /* ---------------- the occlusion instrument (harness only) ---------------- *
   * The sandwich has to be PROVEN, not asserted: the gate walks a body from
   * upstage of a cut to downstage of it and reads the pixels. These three
   * hooks are the only things it needs — nothing here is used by the story. */

  /** every occluder card on/off (the gate's control render) */
  setOccluders(on) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.plate) return 0;
    let n = 0;
    for (const id of Object.keys(rec.plate.layers)) {
      const L = rec.plate.layers[id];
      if (on) {
        L.mesh.visible = L.mat.uniforms.uOpacity.value > 0.004;
      } else if (L.mesh.visible) { L.mesh.visible = false; n++; }
    }
    return on ? Object.keys(rec.plate.layers).length : n;
  }

  /** show ONE cut card alone — cards legitimately hide each other (the milk tub
      stands behind the pen rail), so each layer's contract is gated in isolation */
  setOnlyLayer(id) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.plate) return false;
    for (const k of Object.keys(rec.plate.layers)) {
      const L = rec.plate.layers[k];
      L.mesh.visible = (k === id) && L.mat.uniforms.uOpacity.value > 0.004;
    }
    return true;
  }

  /** FLAG one cut card (gain 0 = black): its opaque pixels become measurable */
  setLayerGain(id, gain) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.plate) return false;
    const L = rec.plate.layers[id];
    if (!L) return false;
    L.mat.uniforms.uGain.value = gain;
    return true;
  }

  /** paint one cut card a flat known colour (alpha kept) — the alpha probe.
      A dark cut over dark paint cannot be read from a GAIN (0 x anything is
      still 0): it takes a colour the card does not own. */
  setLayerFlat(id, k, r, g, b) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.plate) return false;
    const L = rec.plate.layers[id];
    if (!L) return false;
    L.mat.uniforms.uFlatK.value = k;
    if (r !== undefined) L.mat.uniforms.uFlat.value.set(r, g, b);
    return true;
  }

  /** turn the actor grade off, so a rig's own rendered mean can be measured */
  setGradeBypass(on) {
    this.gradeBypass = !!on;
    if (on) {
      for (const a of Object.values(this.actors)) {
        if (!a.mats) continue;
        for (const m of a.mats) {
          if (!m.color) continue;
          if (!m.userData.plateBase) m.userData.plateBase = m.color.clone();
          m.color.copy(m.userData.plateBase);
        }
      }
    }
    return this.gradeBypass;
  }

  /** park one body on a plate mark, everyone else off the leaf */
  probeStand(id, px, py, faceYaw = 0) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return null;
    for (const a of Object.values(this.actors)) this._off(a);
    const a = this.actors[id];
    if (!a) return null;
    this._stand(a, rec.toWorld(px, py, 0), faceYaw);
    a.mode = 'stand';
    this._plateLightStep();          /* grade to where he now stands */
    return { id, at: [px, py], world: a.group.position.toArray().map((v) => +v.toFixed(3)),
             grade: a.grade || null };
  }

  /**
   * THE PROBE BODY. A rigged man is 20 plate px on the shore and the west crag
   * is 300: no walk of his can ever test that cut's boundary. So the gate gets
   * a body it can SIZE — a plain standing card, built by exactly the same
   * arithmetic as an occluder (bottom edge on a plate row, height compensated
   * by 1/cos e), stood at a plate row like any actor. It is an instrument: it
   * never exists during the story.
   */
  probeBody(px, py, wPx, hPx) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return null;
    const w = rec.world;
    const COS = w.COS_E !== undefined ? w.COS_E : Math.cos(w.ELEV);
    if (!rec.probe) {
      rec.probe = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xff2fd0, side: THREE.DoubleSide,
                                      toneMapped: false, depthWrite: true }));
      rec.probe.name = 'gate-probe-body';
      rec.scene.add(rec.probe);
    }
    const m = rec.probe;
    m.visible = true;
    const W = wPx / w.S, H = hPx / (w.S * COS);
    m.geometry.dispose();
    m.geometry = new THREE.PlaneGeometry(W, H);
    const z = w.Z(py);
    m.position.set(w.X(px), H / 2, z);
    m.updateMatrixWorld(true);
    return { at: [px, py], size: [wPx, hPx], z: +z.toFixed(3) };
  }

  hideProbeBody() {
    const rec = this.sets[this.activeName];
    if (rec && rec.probe) rec.probe.visible = false;
    return true;
  }

  /** an instrument framing (plate px + k) — the gate's own eye, not a shot */
  probeCam(px, py, k) {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return null;
    const v = rec.toWorld(px, py, 0);
    this.camWant = { x: v.x, y: 0, z: v.z, k, e: rec.camBase.elev };
    this.camState = { ...this.camWant };
    this.lens = { name: '(probe)', at: [px, py], k };
    this.applyCam();
    this._plateLightStep();
    return { at: [px, py], k };
  }
}
