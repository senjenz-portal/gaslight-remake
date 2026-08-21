/**
 * beats3d.js — THE DIRECTOR. Six beats, staged on the new foundation.
 *
 * The stage (stage3d.js) owns the world: one renderer (the demo's pipeline),
 * three signed-off sets, and the scale authority every mounted body answers
 * to. It knows nothing about the story. THIS module is the story's hand on
 * that world — the roster, the marks, the acts, the pantomime segs, the gates
 * — and it reaches the stage only through the seams the stage published
 * (addActor / addProp / resolve). It never touches a renderer flag, a set
 * light rig or a material: the demo render path is the law and it is applied
 * once, in render3d.js, for everybody.
 *
 * WHAT IS CARRIED OVER, AND FROM WHERE
 *   the marks       tools/ody/ledger.json, in plate pixels, run through
 *                   world.js — no mark is placed by eye
 *   the acts        the shipped book's act vocabulary (units.js names them:
 *                   establish, fire-ulysses, cave-shut, giant-seat, suppliant,
 *                   bowl-offer, boulderOpen, ram-stand, curse, sea-dawn…)
 *                   plus the stage's own pantomime rail (the stake's four
 *                   moves, the blinding, the flock stream, the two rocks)
 *   the laws        posture (the rigs arrive corrected, never re-posed by
 *                   hand), obstacle (every route audited against the set's
 *                   own ledger boxes), census (Ulysses + <= 3 crew on a leaf,
 *                   4 rowers, 4 chips at the lots), determinism (every mover
 *                   is a pure function of sim time)
 *
 * THE CENSUS LAW, precisely. `crew` counts the bodies the reader can see. The
 * cap is three; the LOTS is the one unit the text itself widens to four (four
 * chips are shaken), and the sea's oars carry four. The headcount arithmetic
 * (twelve, less two per meal) still runs underneath and still shortens the
 * roster — it just stopped being the number of bodies on the leaf.
 *
 * DETERMINISM. Nothing here reads Date.now(), Math.random() or a media
 * element. Movers are { t0, dur, apply(k) } evaluated from the stage's sim
 * clock every tick; scatter is mulberry32-seeded; the sea's rocks are the
 * set's own pure-f(simT) scheduler with the story writing only the offset.
 */
import * as THREE from 'three';
import { FRAMES, bounds } from './world.js';
import { createSword, createWine, createGreatBowl, createStake, createWineskin }
  from './props3d.js';

/* ---------------- paces, caps, seeds ---------------- */
export const WALK_MPS = 1.1;              /* cast.json processionSpeedMps */
export const SCURRY_MPS = 1.9;            /* the scatter-to-the-dark pace */
export const GIANT_MPS = 1.6;             /* seven metres of stride */
export const CREW_CAP = 3;                /* THE CROWD LAW — three besides Ulysses */
export const LOTS_CAP = 4;                /* …four chips are shaken (iii-05 only) */
export const ROWER_CAP = 4;               /* …four oars in the sea frame */
export const FLOCK_CAP = 3;               /* three rams stream out with men under */
const CREW_POOL = Math.max(CREW_CAP, LOTS_CAP, ROWER_CAP);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- THE OBSTACLE LAW ---------------- *
 * A route is a chain of plate-pixel points. No segment of it may cross a box
 * in the set's own ledger obstacle census. The audit runs at act-fire time —
 * before a foot moves — and files an error the smoke reads.                  */
function segHitsBox(ax, ay, bx, by, [[x0, y0], [x1, y1]]) {
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inside(ax, ay) || inside(bx, by)) return true;
  const hit = (px, py, qx, qy) => {
    const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const d2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    const d3 = (qx - px) * (ay - py) - (qy - py) * (ax - px);
    const d4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  return hit(x0, y0, x1, y0) || hit(x1, y0, x1, y1) ||
         hit(x1, y1, x0, y1) || hit(x0, y1, x0, y0);
}

/* THE CORRIDOR. A mark-to-mark straight line is a lie on a dressed set: the
 * cave's own audited walk path threads between the fire ring, the woodpile,
 * the pens and the bed, and a body that ignores it walks through the milk tub.
 * So a route is [from, the set's own corridor between the two nearest samples,
 * to] — the set lane's audited polyline doing the work, with short spurs at
 * each end. The audit then checks what the body will ACTUALLY walk.           */
function nearestIdx(corridor, px, py) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < corridor.length; i++) {
    const d = Math.hypot(corridor[i][0] - px, corridor[i][1] - py);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function corridorRoute(corridor, fromPx, toPx) {
  if (!corridor || corridor.length < 2) return [fromPx, toPx];
  const i = nearestIdx(corridor, fromPx[0], fromPx[1]);
  const j = nearestIdx(corridor, toPx[0], toPx[1]);
  const mids = [];
  if (i <= j) for (let k = i; k <= j; k++) mids.push(corridor[k]);
  else for (let k = i; k >= j; k--) mids.push(corridor[k]);
  const pts = [fromPx, ...mids, toPx];
  const out = [pts[0]];
  for (const p of pts.slice(1)) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 4) out.push(p);
  }
  return out;
}

/* the walk: a pure function of story time over a polyline in world metres */
class Walk {
  constructor(ptsWorld, t0, speed) {
    this.pts = ptsWorld;
    this.t0 = t0;
    this.speed = speed;
    this.seg = [0];
    let total = 0;
    for (let i = 1; i < ptsWorld.length; i++) {
      total += ptsWorld[i].distanceTo(ptsWorld[i - 1]);
      this.seg.push(total);
    }
    this.len = total;
    this.dur = total / Math.max(0.05, speed);
  }
  /** position + facing at story time t; writes into P/DIR, returns done */
  at(t, P, DIR) {
    const s = Math.max(0, Math.min(this.len, (t - this.t0) * this.speed));
    let i = 1;
    while (i < this.seg.length - 1 && this.seg[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const span = Math.max(1e-5, this.seg[i] - this.seg[i - 1]);
    const k = clamp01((s - this.seg[i - 1]) / span);
    P.lerpVectors(a, b, k);
    DIR.subVectors(b, a);
    return t >= this.t0 + this.dur;
  }
}

/* ---------------- the marks (ledger plate px) ---------------- */
const SHORE_MARKS = {
  fire: [390, 480], council: [563, 499], councilCrew: [479, 507],
  twelveAtShip: [560, 503],
};
const CAVE_MARKS = {
  entry: [360, 450], cheeseRack: [640, 405], huddle: [933, 541],
  suppliant: [690, 512], giantSeat: [760, 452], sword: [680, 554],
  scheme: [800, 530], lots: [713, 527], stakeHide: [782, 496],
  bowlOffer: [700, 514], sprawlHead: [664, 546], ramStand: [838, 430],
  ramAtMouth: [395, 438], doorwaySeat: [345, 470], mouth: [355, 438],
  pens: [900, 545],
};
/* the shore's mainland lobe is FORCED PERSPECTIVE — its own px/m (19.5 against
   the beach's 11.3). A body standing on it wears the lobe's scale, which is the
   set lane's own dual-scale ruling; the [scale] gate measures at BOOT, on the
   beach, where a man is a man. */
const MAINLAND_LANDING = new THREE.Vector3(45.5, 0, -20.5);
const MAINLAND_ENTRY = new THREE.Vector3(50.0, 1.35, -30.6);

/* THE CAVE'S FOUR HOURS. The demo cave ships one light story; the book needs
 * four, and the honest way to get them without touching a signed-off set is to
 * GRADE ITS OWN LIGHTS — a multiplier on the blaze and the night hemisphere,
 * applied after the set's own tick, plus the boulder. Nothing is added, no
 * material is rewritten, and setting the multipliers to 1 gives the demo back
 * exactly. */
const CAVE_STATES = {
  'cave-dawn':    { fire: 0.62, hemi: 1.55, boulder: 0 },
  'cave-shut':    { fire: 1.00, hemi: 0.52, boulder: 1 },
  'cave-embers':  { fire: 0.44, hemi: 0.38, boulder: 1 },
  'cave-predawn': { fire: 0.30, hemi: 0.80, boulder: 1 },
};

/* THE GIANT IS THREE RIGS OF ONE BODY: he comes and goes (walk), he stands and
 * sprawls (idle) and he WORKS AT HIS SEAT (the seat pose the cast lane
 * measured). Only one is ever on the leaf. */
const GIANT_RIGS = { walk: 'poly-walk', idle: 'poly-idle', seat: 'poly-seat' };
const GIANT_SEAT_FACE = 1.05;

/* the roster each set mounts — the [scale] gate prints every one of them */
export const ROSTER = {
  shore: [
    { id: 'ulysses', rig: 'ulysses' },
    ...Array.from({ length: CREW_POOL }, (_, i) => ({ id: 'crew-' + i, rig: 'crew' })),
  ],
  cave: [
    { id: 'ulysses', rig: 'ulysses' },
    ...Array.from({ length: CREW_POOL }, (_, i) => ({ id: 'crew-' + i, rig: 'crew' })),
    { id: 'poly-seat', rig: 'polyphemus-seat', pose: 'seated' },
    { id: 'poly-idle', rig: 'polyphemus-idle' },
    { id: 'poly-walk', rig: 'polyphemus' },
    { id: 'ram-great', rig: 'ram-great' },
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'ewe-' + i, rig: 'ewe' })),
    ...Array.from({ length: FLOCK_CAP }, (_, i) => ({ id: 'flock-' + i, rig: 'ewe' })),
  ],
  sea: [
    { id: 'ulysses', rig: 'ulysses' },
    ...Array.from({ length: ROWER_CAP }, (_, i) => ({ id: 'crew-' + i, rig: 'crew' })),
    { id: 'poly-idle', rig: 'polyphemus-idle' },
  ],
};

/* the props each set carries (the cave's four; the others none) */
export const PROP_PLAN = {
  shore: [],
  cave: [
    { id: 'stake', kind: 'stake', make: createStake, px: [782, 496], y: 0.14,
      rot: [Math.PI / 2, 0.35, 0], hidden: true },
    { id: 'bowl', kind: 'bowl', make: createGreatBowl, px: [700, 500], hidden: true },
    { id: 'wineskin', kind: 'wineskin', make: createWineskin, px: [333, 487],
      rot: [0, 0.5, 0] },
    { id: 'sword', kind: 'sword', make: createSword, px: [680, 549], y: 0.95,
      rot: [0, -0.6, 0.1], hidden: true },
  ],
  sea: [],
};

export class Director {
  constructor(stage, { errors = [], audio = null } = {}) {
    this.stage = stage;
    this.errors = errors;
    this.audio = audio;
    this.movers = [];
    this.acts = [];              /* the lap's record — the smoke reads it */
    this.audits = 0;             /* routes audited (the obstacle law's count) */
    this.routes = [];            /* every audited route, for the record */
    this.meals = 0;              /* O.6 — three identical meals */
    this.beat = 1;
    this.boulderK = 1;           /* 1 shut, 0 open */
    this.caveGrade = { fire: 1, hemi: 1 };
    this.flareK = 0;             /* the blinding's fire flare */
    this.tipGlow = 0;            /* the stake tip's heat (G4's watermark) */
    this.shake = null;
    this.pov = null;             /* the under-fleece eye */
    this.swordLive = false;
    this.clock0 = null;          /* the beat clock (jeer / shout / curse) */
    this.flockExit = null;
    this.jeers = 0;
    this.state = null;           /* the cave hour we are in */
    this.holdK = 0;
    this.station = 0;        /* the proscenium law's back-off for this cut */
    this.lift = 0;
    this.aim = null;
    this.swing = null;       /* …or its swing about the subject, same distance */
  }

  /* ================= mounting ================= *
   * The stage calls this once the set is built. Every body and prop the beats
   * will ever need on this leaf is mounted NOW, so the [scale] gate at boot
   * sees the whole cast, and an act is only ever a move — never a birth. */
  async populate(setName) {
    this.movers.length = 0;
    this.flockExit = null;
    this.pov = null;
    this.shake = null;
    const roster = ROSTER[setName] || [];
    for (const spec of roster) {
      const a = await this.stage.addActor(spec.id, spec.rig, { pose: spec.pose });
      a.baseScale = a.model.scale.x;
      a.local = 1;
      a.face = 0;
      a.mode = 'idle';
      a.opacity = 1;
      a.walk = null;
      a.fade = null;
      a.poseEuler = null;
      /* the idle rig BREATHES when it is still; a walk rig freezes to a stance
         (a man standing mid-stride is the tell of a clip left running) */
      a.loopWhenStill = spec.rig === 'polyphemus-idle';
      this._park(a, setName);
    }
    for (const spec of PROP_PLAN[setName] || []) {
      const g = await this.stage.addProp(spec.id, spec.make, spec.kind, spec);
      if (spec.id === 'bowl') {
        const wine = createWine(0.46);
        wine.position.y = 0.30;
        g.add(wine);
        this._wine = wine;
      }
      if (spec.hidden) g.visible = false;
      g.userData.home = { p: g.position.clone(), q: g.quaternion.clone() };
    }
    /* the boot tableau: the leaf's own opening, so the gate measures bodies
       standing where the story will find them */
    this.boulderK = setName === 'cave' ? 1 : 1;
    if (setName === 'cave') this._applyBoulder(1);
    this._openingTableau(setName);
  }

  /** every body parked ON its set at a lawful mark, upright, before act one */
  _park(a, setName) {
    const f = FRAMES[setName];
    const at = (px, py, y = 0) => new THREE.Vector3(f.X(px), y, f.Z(py));
    if (setName === 'shore') {
      const m = a.id === 'ulysses' ? SHORE_MARKS.fire
        : [SHORE_MARKS.councilCrew[0] + (+a.id.slice(5) - 1) * 12, SHORE_MARKS.councilCrew[1]];
      this._stand(a, at(...(a.id === 'ulysses' ? m : m)), 0.4);
      if (a.id !== 'ulysses') this._off(a);
      return;
    }
    if (setName === 'cave') {
      const spot = {
        ulysses: CAVE_MARKS.entry,
        'poly-seat': CAVE_MARKS.giantSeat, 'poly-idle': CAVE_MARKS.giantSeat,
        'poly-walk': CAVE_MARKS.mouth, 'ram-great': CAVE_MARKS.ramStand,
      }[a.id] || (a.id.startsWith('crew-') ? CAVE_MARKS.huddle : CAVE_MARKS.pens);
      this._stand(a, at(...spot), 1.4);
      if (a.id !== 'ulysses') this._off(a);
      return;
    }
    /* sea: the deck and the brow are sockets, not pixels */
    const sockets = (this.stage.set.root.userData.sculptRuntime || {}).sockets || {};
    const deck = sockets['root:deck-mount'] || [0, 0.58, 0];
    const brow = sockets['root:brow-giant'] || [12, 27, -18];
    if (a.id === 'poly-idle') this._stand(a, new THREE.Vector3(...brow), 2.6);
    else this._stand(a, new THREE.Vector3(deck[0], deck[1], deck[2]), 0);
    if (a.id !== 'ulysses') this._off(a);
  }

  /** the leaf as the reader first sees it (act one will move from here) */
  _openingTableau(setName) {
    if (setName === 'shore') {
      const f = FRAMES.shore;
      this._stand(this.stage.actors.get('ulysses'),
        new THREE.Vector3(f.X(SHORE_MARKS.fire[0]), 0, f.Z(SHORE_MARKS.fire[1])),
        Math.PI / 2.4);
    }
    if (setName === 'cave') this._grade('cave-shut', true);
    if (setName === 'sea') this._acts()['establish'](true);
  }

  /* ================= placement primitives ================= */
  /**
   * Strike a body from the leaf. THE RESURRECTION BUG this closes: an act's
   * mover can outlive the act (the blind grope's rise hands off to a walk
   * when it finishes), so a later beat that struck the same body would find
   * it standing up again three seconds after it left. A mover that OWNS an
   * actor dies with him.
   */
  _off(a) {
    if (!a) return;
    this.movers = this.movers.filter((m) => m.owner !== a.id);
    a.mode = 'off';
    a.group.visible = false;
    a.walk = null; a.fade = null;
    a.opacity = 1; a.setFade(1);
    a.poseEuler = null;
    if (a.group.parent && a.group.parent !== this.stage.scene)
      this.stage.scene.add(a.group);
  }
  _stand(a, world, face = 0, local = 1) {
    if (!a) return;
    a.mode = 'stand';
    a.group.visible = true;
    a.group.rotation.set(0, face, 0);
    a.group.position.copy(world);
    a.face = face; a.local = local;
    a.model.scale.setScalar(a.baseScale * local);
    a.walk = null; a.poseEuler = null;
    a.fade = null; a.opacity = 1; a.setFade(1);
  }
  _pose(a, world, euler) {
    if (!a) return;
    a.mode = 'pose';
    a.group.visible = true;
    a.group.position.copy(world);
    a.group.setRotationFromEuler(euler);
    a.poseEuler = euler;
    a.walk = null;
  }
  /** THE DECK: parented into the ship's sway group so a rower rides the swell */
  _deck(a, local, face = 0) {
    if (!a) return;
    const SHIP = this.stage.set.SHIP;
    if (!SHIP) return;
    a.mode = 'deck';
    SHIP.sway.add(a.group);
    a.group.position.set(local[0], local[1], local[2]);
    a.group.rotation.set(0, face, 0);
    a.face = face; a.local = 1;
    a.model.scale.setScalar(a.baseScale);
    a.group.visible = true;
    a.walk = null; a.poseEuler = null; a.fade = null; a.opacity = 1; a.setFade(1);
  }
  _appear(a, world, face, { delay = 0, dur = 1.0, silent = false } = {}) {
    this._stand(a, world, face);
    if (silent) return;
    a.opacity = 0; a.setFade(0);
    a.fade = { t0: this.t + delay, dur, from: 0, to: 1 };
  }
  _fade(a, to, dur = 1.2, silent = false) {
    if (!a) return;
    if (silent) { a.opacity = to; a.setFade(to); if (to <= 0) this._off(a); return; }
    a.fade = { t0: this.t, dur, from: a.opacity, to };
  }

  /** THE OBSTACLE LAW, applied: audit the plate-px route, then walk it. */
  _walkRoute(a, from, to, { speed = WALK_MPS, delay = 0, y = 0, silent = false,
                            label = '' } = {}) {
    if (!a) return;
    const set = this.stage.setName;
    const f = FRAMES[set];
    const pts = corridorRoute(f.path, from, to);
    this._audit(pts, label || `${set}:${a.id}`);
    const world = pts.map(([px, py]) => new THREE.Vector3(f.X(px), y, f.Z(py)));
    if (silent) {
      const last = world[world.length - 1], prev = world[Math.max(0, world.length - 2)];
      this._stand(a, last, Math.atan2(last.x - prev.x, last.z - prev.z));
      return;
    }
    a.mode = 'walk';
    a.group.visible = true;
    a.fade = null; a.opacity = 1; a.setFade(1);
    a.walk = new Walk(world, this.t + delay, speed);
  }

  _audit(ptsPx, label) {
    const boxes = FRAMES[this.stage.setName].obstacles || {};
    this.audits++;
    const hits = [];
    for (let i = 1; i < ptsPx.length; i++) {
      const [ax, ay] = ptsPx[i - 1], [bx, by] = ptsPx[i];
      for (const [name, box] of Object.entries(boxes)) {
        if (!Array.isArray(box) || !Array.isArray(box[0])) continue;
        if (segHitsBox(ax, ay, bx, by, box)) hits.push(name);
      }
    }
    this.routes.push({ label, pts: ptsPx, hits });
    if (hits.length) {
      const msg = `[obstacle] route "${label}" crosses ${[...new Set(hits)].join(', ')}`;
      this.errors.push(msg);
      console.error(msg);
    }
    return hits;
  }

  _cluster(world, n, seed, spread = 0.9) {
    const rnd = mulberry32(seed);
    return Array.from({ length: n }, () => {
      const a = rnd() * Math.PI * 2, r = spread * (0.35 + rnd() * 0.65);
      return new THREE.Vector3(world.x + Math.cos(a) * r, world.y, world.z + Math.sin(a) * r);
    });
  }

  /* ================= the roster ================= */
  _crew(n) {
    return Array.from({ length: CREW_POOL }, (_, i) => this.stage.actors.get('crew-' + i))
      .filter(Boolean).slice(0, Math.min(n, CREW_POOL));
  }
  crewCap() { return Math.max(1, Math.min(CREW_CAP, 12 - 2 * this.meals)); }
  _aliveCrew() { return this._crew(this.crewCap()); }
  _onStageCrew() {
    return this._crew(CREW_POOL)
      .filter((c) => c.mode !== 'off' && c.group.visible && c.opacity > 0.05);
  }
  _giantOn() {
    for (const id of ['poly-seat', 'poly-idle', 'poly-walk']) {
      const a = this.stage.actors.get(id);
      if (a && a.group.visible && a.mode !== 'off') return a;
    }
    return null;
  }
  _giant(mode) {
    const want = this.stage.actors.get(GIANT_RIGS[mode]);
    if (!want) return null;
    for (const [m, id] of Object.entries(GIANT_RIGS)) {
      if (m === mode) continue;
      const other = this.stage.actors.get(id);
      if (other && other.group.visible && other.mode !== 'off') this._off(other);
    }
    return want;
  }

  /** THE CENSUS. Ulysses and the giant are principals; sheep and rams are
   *  livestock; `crew` is the only number the crowd cap governs. */
  census() {
    const on = (a) => !!(a && a.group.visible && a.opacity > 0.05);
    let crew = 0, rams = 0, sheep = 0;
    for (const [id, a] of this.stage.actors) {
      if (!on(a)) continue;
      if (id.startsWith('crew-')) crew++;
      else if (id.startsWith('flock-') || id === 'ram-great') rams++;
      else if (id.startsWith('ewe-')) sheep++;
    }
    const ulysses = on(this.stage.actors.get('ulysses')) ? 1 : 0;
    const giant = ['poly-idle', 'poly-walk', 'poly-seat']
      .reduce((n, id) => n + (on(this.stage.actors.get(id)) ? 1 : 0), 0);
    return { crew, ulysses, giant, rams, sheep, humanoids: crew + ulysses + giant,
             cap: CREW_CAP, meals: this.meals, headcount: Math.max(0, 12 - 2 * this.meals) };
  }

  /* ================= movers (pure f(story time)) ================= */
  get t() { return this.stage.simT; }
  _mover(id, dur, apply, { silent = false, delay = 0, onDone = null, owner = null } = {}) {
    if (silent) { apply(1); if (onDone) onDone(true); return; }
    this.movers = this.movers.filter((m) => m.id !== id);
    this.movers.push({ id, owner, t0: this.t + delay, dur, apply, onDone, finished: false });
  }

  /** THE BEAT CLOCK. Beat IV's blinding and Beat VI's two rocks are the only
   *  places the book measures its own seconds; a `clock` unit turns when the
   *  clock passes its `at`. Arming is an act (jeer / shout / curse) or the
   *  ember hold resolving — never a wall-clock read. */
  armClock() { this.clock0 = this.t; return this.clock0; }

  /* ================= the cave's hours + its door ================= */
  _applyBoulder(k) {
    const grp = this.stage.set && this.stage.set.parts['mouth-and-boulder'];
    if (!grp) return;
    const b = grp.getObjectByName('boulder-shut');
    if (!b) return;
    if (!b.userData.home) b.userData.home = { p: b.position.clone(), rz: b.rotation.z };
    const h = b.userData.home;
    const e = 1 - clamp01(k);                    /* 0 shut … 1 rolled aside */
    b.position.set(h.p.x + 4.9 * e, h.p.y - 0.55 * e, h.p.z + 2.1 * e);
    b.rotation.z = h.rz - 1.25 * e;
    this.boulderK = k;
  }
  _boulderTo(k, { silent = false, delay = 0, dur = 2.3 } = {}) {
    const from = this.boulderK;
    if (Math.abs(from - k) < 1e-3) { this._applyBoulder(k); return; }
    this._mover('boulder', dur, (x) => this._applyBoulder(from + (k - from) * easeInOut(x)),
      { silent, delay });
    if (!silent && k === 1) {
      if (this.audio) this.audio.cue('boulder-boom', { delay: delay + dur * 0.7 });
      this.shake = { t0: this.t + delay + dur * 0.85, amp: 0.30, dur: 1.1 };
    }
    this.boulderK = k;
  }
  _grade(name, silent = false) {
    const want = CAVE_STATES[name];
    if (!want) return;
    this.state = name;
    const from = { ...this.caveGrade };
    if (silent) {
      this.caveGrade = { fire: want.fire, hemi: want.hemi };
      this._boulderTo(want.boulder, { silent: true });
      return;
    }
    this._mover('cave-hour', 1.8, (k) => {
      const e = easeInOut(k);
      this.caveGrade.fire = from.fire + (want.fire - from.fire) * e;
      this.caveGrade.hemi = from.hemi + (want.hemi - from.hemi) * e;
    });
    this._boulderTo(want.boulder, { delay: 0.2 });
  }

  _seatGiant(px = CAVE_MARKS.giantSeat, face = GIANT_SEAT_FACE) {
    const g = this._giant('seat');
    if (!g) return null;
    const f = FRAMES.cave;
    /* HE SITS IN THE FLOOR, not on it — a 0.12 m sink lets the floor cut the
       silhouette instead of leaving a lit edge all round his rump. */
    this._stand(g, new THREE.Vector3(f.X(px[0]), -0.12, f.Z(px[1])), face);
    return g;
  }

  _giantSprawl(silent) {
    const g = this._giant('idle');
    if (!g) return;
    if (g.mode === 'pose') return;                /* already down — idempotent */
    const f = FRAMES.cave;
    /* THE SPRAWL SITS ON ITS OWN LEDGER BOX: the audited sprawl runs plate
       x 636.6..937.8 along the hearth's south side, HEAD at the west end —
       which is why the stake's drive point (706,556) meets the eye it is
       driven into. The anchor is the box's CENTRE (786), not its foot end;
       anchoring at 930 laid seven metres of body straight across the auger
       shot's own camera station and the frame came back black.
         The -90 deg X euler maps the rig's depth axis to world up, so the lift
       that grounds a lying body is half its posed depth. (A station that still
       lands inside him is caught at the cut by the proscenium law below —
       staging does not get to bend to one lens.) */
    const lay = 0.78;
    const mid = new THREE.Vector3(f.X(786), lay, f.Z(531));
    const euler = new THREE.Euler(-Math.PI / 2, Math.PI / 2 + 0.25, 0, 'YXZ');
    if (silent) { this._pose(g, mid, euler); return; }
    const from = g.group.visible ? g.group.position.clone()
      : new THREE.Vector3(f.X(CAVE_MARKS.giantSeat[0]), 0, f.Z(CAVE_MARKS.giantSeat[1]));
    const fromQ = g.group.visible ? g.group.quaternion.clone() : new THREE.Quaternion();
    const toQ = new THREE.Quaternion().setFromEuler(euler);
    g.mode = 'pose'; g.group.visible = true; g.walk = null; g.poseEuler = euler;
    this._mover('giant-sprawl', 2.6, (k) => {
      const e = easeInOut(k);
      g.group.position.lerpVectors(from, mid, e);
      g.group.quaternion.slerpQuaternions(fromQ, toQ, e);
    }, { owner: g.id });
  }

  /* ================= props ================= */
  _prop(id) { return this.stage.props.get(id); }
  _propHome(id) {
    const g = this._prop(id);
    return g && g.userData.home;
  }
  _moveProp(id, toP, toQ, dur, { silent = false, delay = 0 } = {}) {
    const g = this._prop(id);
    if (!g) return;
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    this._mover('prop-' + id, dur, (k) => {
      const e = easeInOut(k);
      g.position.lerpVectors(p0, toP, e);
      if (toQ) g.quaternion.slerpQuaternions(q0, toQ, e);
    }, { silent, delay });
  }
  _pour(silent, delay = 0) {
    this._mover('pour-' + this.acts.length, 1.4, (k) => {
      const wine = this._wine;
      if (wine) wine.scale.setScalar(Math.max(0.01, 1 - easeInOut(k)));
      const bowl = this._prop('bowl');
      if (bowl) bowl.rotation.z = Math.sin(Math.PI * clamp01(k)) * 0.7;
    }, { silent, delay });
  }
  /** the pantomime rail's own hook — pours 2 and 3 ride the autos */
  fx(name, delay = 0) {
    if (name === 'pour') this._pour(false, delay);
  }

  /** arm ONE of the sea set's ballistic rocks. The scheduler stays pure
   *  f(simT); the story writes only the offset (and the near-miss target). */
  _seaThrow(idx, delay, target = null, silent = false) {
    const rocks = this.stage.set && this.stage.set.ROCKS;
    if (!rocks || !rocks[idx]) return;
    const r = rocks[idx];
    if (target) r.target.copy(target);
    r.offset = silent ? this.t - 60 : this.t + delay;
    if (!silent && this.audio) this.audio.cue('splash', { delay: delay + r.flight });
  }

  /* ================= ACTS ================= */
  fire(act, silent = false) {
    this.acts.push({ act, t: +this.t.toFixed(3), set: this.stage.setName, silent: !!silent });
    const fn = this._acts()[act];
    if (!fn) return false;
    try { fn(!!silent); } catch (e) {
      this.errors.push(`act ${act}: ${e && e.message}`);
      console.error(`act ${act}`, e);
    }
    return true;
  }

  _acts() {
    if (this.__acts) return this.__acts;
    const S = this;
    const A = (id) => S.stage.actors.get(id);
    const caveAt = (px, py, y = 0) =>
      new THREE.Vector3(FRAMES.cave.X(px), y, FRAMES.cave.Z(py));
    const shoreAt = (px, py, y = 0) =>
      new THREE.Vector3(FRAMES.shore.X(px), y, FRAMES.shore.Z(py));
    const MAINLAND_LOCAL = 19.5 / FRAMES.shore.pxPerM;

    this.__acts = {
      /* ---------- BEAT I · SHORE ---------- */
      establish: (silent) => {
        if (S.stage.setName !== 'sea') return;    /* Beat I's establish is the leaf */
        const g = A('poly-idle');
        const sockets = (S.stage.set.root.userData.sculptRuntime || {}).sockets || {};
        const brow = sockets['root:brow-giant'];
        if (g && brow) {
          const at = new THREE.Vector3(...brow);
          const ship = S.stage.set.SHIP.group.position;
          S._stand(g, at, Math.atan2(ship.x - at.x, ship.z - at.z));
        }
        const DECK = S.stage.set.SHIP.deckY;
        S._deck(A('ulysses'), [0, DECK, -4.6], 0);
        const rows = [-3.8, -1.3, 1.2];
        S._crew(ROWER_CAP).forEach((c, i) => {     /* FOUR oars in the frame */
          S._deck(c, [(i % 2 ? -0.78 : 0.78), DECK, rows[Math.floor(i / 2)] || 1.2], Math.PI);
        });
      },
      'fire-ulysses': () => {
        S._stand(A('ulysses'), shoreAt(...SHORE_MARKS.fire), Math.PI / 2.4);
      },
      'shore-day': (silent) => {
        if (S.stage.set.setState) S.stage.set.setState('day');
      },
      'council-ulysses': (silent) => {
        const u = A('ulysses');
        if (u.mode === 'off') S._stand(u, shoreAt(...SHORE_MARKS.fire), 0);
        S._walkRoute(u, SHORE_MARKS.fire, SHORE_MARKS.council,
          { silent, label: 'shore:fire->council' });
        /* THE ARC IS THE LEDGER'S ARC, NOT A DICE ROLL: three of the twelve in
           the audited sand pocket between the day goat and the stern curl. */
        const [cmx, cmy] = SHORE_MARKS.councilCrew;
        /* the arc is the ledger's sand pocket, opened to a READABLE spacing:
           at 11.3 px/m a 9 px step is 0.8 m and three men at 0.8 m centres are
           one silhouette. 16 px is a metre and a half — a council, not a queue
           — and the west man still clears the day-goat box (x >= 450). */
        const ARC = [[-14, -5], [0, 0], [16, 4], [32, 8]];
        const face = shoreAt(...SHORE_MARKS.council);
        S._aliveCrew().forEach((c, i) => {
          const [dx, dy] = ARC[i % ARC.length];
          const p = shoreAt(cmx + dx, cmy + dy);
          S._stand(c, p, Math.atan2(face.x - p.x, face.z - p.z));
        });
        S._crew(CREW_POOL).slice(S.crewCap()).forEach((c) => S._off(c));
      },
      crossing: (silent) => {                      /* G1 — the keel crosses */
        const ship = S.stage.set.parts['ship-2'];
        if (!ship) return;
        if (!ship.userData.home) ship.userData.home =
          { p: ship.position.clone(), ry: ship.rotation.y };
        const from = ship.userData.home.p.clone();
        const to = MAINLAND_LANDING.clone().setY(from.y);
        const r0 = ship.userData.home.ry, r1 = r0 + 0.55;
        S._off(A('ulysses'));                      /* the beach empties with it */
        for (const c of S._crew(CREW_POOL)) S._off(c);
        S._mover('crossing', 9.0, (k) => {
          const e = easeInOut(k);
          ship.position.lerpVectors(from, to, e);
          ship.rotation.y = r0 + (r1 - r0) * e;
        }, { silent });
      },
      'entry-mainland': () => {
        const crew = S._aliveCrew();
        const spots = S._cluster(MAINLAND_ENTRY, crew.length + 1, 71011, 1.6);
        S._stand(A('ulysses'), spots[0], -0.5, MAINLAND_LOCAL);
        crew.forEach((c, i) => S._stand(c, spots[i + 1], -0.6, MAINLAND_LOCAL));
      },
      'twelve-at-ship': () => {
        const crew = S._aliveCrew();
        const spots = S._cluster(MAINLAND_LANDING, crew.length, 71021, 2.2);
        crew.forEach((c, i) => S._stand(c, spots[i], 0.4, MAINLAND_LOCAL));
        S._stand(A('ulysses'),
          MAINLAND_LANDING.clone().add(new THREE.Vector3(1.6, 0, -1.6)), -0.4, MAINLAND_LOCAL);
      },
      'plate-wineskin': (silent) => {              /* the party climbs behind */
        const u = A('ulysses');
        const from = u.group.position.clone();
        const to = MAINLAND_ENTRY.clone();
        S._mover('climb', 6.0, (k) => u.group.position.lerpVectors(from, to, easeInOut(k)),
          { silent });
      },

      /* ---------- BEATS II–V · THE CAVE ---------- */
      'cave-dawn': (silent) => S._grade('cave-dawn', silent),
      'cave-shut': (silent) => S._grade('cave-shut', silent),
      'cave-embers': (silent) => { S._grade('cave-embers', silent); S._giantSprawl(silent); },
      'cave-predawn': (silent) => {
        S._grade('cave-predawn', silent);
        if (S.beat >= 5) {
          /* BEAT V's pre-dawn: the BLIND giant seated filling the mouth, the
             survivors by the pens, the ewes in the south lane, night cleared */
          S.meals = Math.max(S.meals, 3);
          for (const id of ['stake', 'bowl', 'sword']) {
            const g = S._prop(id); if (g) g.visible = false;
          }
          S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1);
          const survivors = S._aliveCrew();
          const spots = S._cluster(caveAt(890, 537), survivors.length, 71033, 1.2);
          survivors.forEach((c, i) => S._stand(c, spots[i], -2.3));
          S._crew(CREW_POOL).slice(survivors.length).forEach((c) => S._off(c));
          S._stand(A('ulysses'), caveAt(858, 542), -2.4);
          [[938, 538], [972, 545], [1002, 540], [915, 548]].forEach(([px, py], i) => {
            S._stand(A('ewe-' + i), caveAt(px, py), -1.9 + 0.2 * i);
          });
          return;
        }
        S.meals = Math.max(S.meals, 1);
        S._giantSprawl(true);                      /* asleep as the leaf mounts */
        const left = S._aliveCrew();
        const spots = S._cluster(caveAt(...CAVE_MARKS.huddle), left.length, 71031, 1.3);
        left.forEach((c, i) => S._stand(c, spots[i], -1.1));
        S._crew(CREW_POOL).slice(left.length).forEach((c) => S._off(c));
        S._stand(A('ulysses'), caveAt(933, 528), -1.2);
      },
      'cheese-rack': (silent) => {
        const crew = S._aliveCrew();
        const spots = S._cluster(caveAt(640, 398), crew.length, 71041, 1.0);
        crew.forEach((c, i) => S._stand(c, spots[i], -2.2));
        S._crew(CREW_POOL).slice(crew.length).forEach((c) => S._off(c));
        S._stand(A('ulysses'), caveAt(610, 412), -2.0);
      },
      'huddle-far': (silent) => {                  /* the scatter to the far dark */
        const rnd = mulberry32(71051);
        S._aliveCrew().forEach((c, i) => {
          const tx = CAVE_MARKS.huddle[0] + (rnd() - 0.5) * 56;
          const ty = CAVE_MARKS.huddle[1] + (rnd() - 0.5) * 18;
          S._walkRoute(c, [604 + (i % 4) * 24, 396 + (i % 3) * 6], [tx, ty],
            { speed: SCURRY_MPS, silent, delay: 0.15 * i, label: 'cave:scatter' });
        });
        S._walkRoute(A('ulysses'), [610, 412], CAVE_MARKS.huddle,
          { speed: SCURRY_MPS, silent, label: 'cave:scatter-u' });
      },
      'giant-seat': () => { S._seatGiant(); },
      suppliant: (silent) => {
        S._walkRoute(A('ulysses'), CAVE_MARKS.huddle, CAVE_MARKS.suppliant,
          { silent, label: 'cave:huddle->suppliant' });
      },
      'sword-ulysses': (silent) => {
        S._walkRoute(A('ulysses'), CAVE_MARKS.suppliant, CAVE_MARKS.sword,
          { silent, label: 'cave:suppliant->sword' });
        const sw = S._prop('sword');
        if (sw) sw.visible = true;
        S.swordLive = true;
      },
      swordDraw: (silent) => {                     /* G2 resolves — and REFUSES */
        const sw = S._prop('sword');
        if (!sw) return;
        sw.visible = true;
        const y0 = sw.position.y, rz0 = sw.rotation.z;
        S._mover('sword-draw', 1.6, (k) => {
          /* the draw STOPS mid-air and the story takes the blade back (O.5) */
          const lift = k < 0.45 ? easeInOut(k / 0.45) : 1 - easeInOut((k - 0.62) / 0.38) * (k > 0.62 ? 1 : 0);
          sw.position.y = y0 + Math.max(0, lift) * 0.52;
          sw.rotation.z = rz0 - Math.max(0, lift) * 0.9;
          if (sw.userData.glint) sw.userData.glint.emissiveIntensity = 1.2 + 2.4 * Math.max(0, lift);
        }, { silent });
      },
      milking: () => { S._seatGiant(); },
      scheme: (silent) => {
        S._walkRoute(A('ulysses'), CAVE_MARKS.huddle, CAVE_MARKS.scheme,
          { silent, label: 'cave:huddle->scheme' });
      },
      'stake-hide': (silent) => {
        /* THE HIDDEN STAKE IS HIDDEN: under the dung and off the leaf until
           Beat IV lifts it back into the embers. */
        const st = S._prop('stake');
        if (st) {
          st.visible = true;
          const y0 = st.position.y;
          S._mover('stake-hide', 1.4, (k) => {
            st.position.y = y0 - easeInOut(k) * 0.62;
            if (k >= 1) st.visible = false;
          }, { silent });
        }
        /* THE LOTS — the one unit the text itself widens to four: four chips
           are shaken, so FOUR bearers step to the circle (iii-05 only). */
        const centre = caveAt(...CAVE_MARKS.lots);
        const spots = S._cluster(centre, LOTS_CAP, 71061, 0.9);
        S._crew(LOTS_CAP).forEach((c, i) => S._stand(c, spots[i], 2.6));
        S._walkRoute(A('ulysses'), CAVE_MARKS.scheme, CAVE_MARKS.lots,
          { silent, label: 'cave:scheme->lots' });
      },
      'bowl-offer': (silent) => {
        S._walkRoute(A('ulysses'), CAVE_MARKS.lots, CAVE_MARKS.bowlOffer,
          { silent, label: 'cave:lots->bowl' });
        const bowl = S._prop('bowl');
        if (bowl) {
          bowl.visible = true;
          const h = bowl.userData.home;
          if (h) { bowl.position.copy(h.p); bowl.quaternion.copy(h.q); }
          if (S._wine) S._wine.scale.setScalar(1);
        }
        /* ONE READABLE ACTION: the wine beat is Ulysses ALONE at the giant's
           knee. The company is hiding in the dark; the flock is in its pens. */
        for (const c of S._crew(CREW_POOL)) if (c.mode !== 'off') S._fade(c, 0, 1.1, silent);
        for (const id of ['ram-great', 'ewe-0', 'ewe-1', 'ewe-2', 'ewe-3']) {
          const a = A(id);
          if (a && a.mode !== 'off') S._fade(a, 0, 1.3, silent);
        }
      },
      'bowl-pour': (silent) => S._pour(silent),    /* G3's release — pour one */

      /* ---------- BEAT IV · THE STAKE ---------- */
      'stake-to-embers': (silent) => {
        const bowl = S._prop('bowl');
        if (bowl) bowl.visible = false;            /* the night's bowl cleared */
        const st = S._prop('stake');
        if (st) {
          st.visible = true;
          const toP = caveAt(640, 488, 0.62);
          const dir = caveAt(632, 462, 0.30).sub(toP).normalize();
          const toQ = new THREE.Quaternion()
            .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          S._moveProp('stake', toP, toQ, 2.0, { silent });
        }
        S._walkRoute(A('ulysses'), CAVE_MARKS.bowlOffer, [648, 517],
          { silent, label: 'cave:bowl->embers' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, [713 + (i % 2) * 10, 527 + (i % 2) * 6],
            [668 + i * 9, 521 + (i % 3) * 5],
            { silent, delay: 0.2 * i, label: 'cave:bearers' });
        });
      },
      'stake-draw': (silent) => {                  /* drawn out, glowing */
        S.tipGlow = 1;
        const toP = caveAt(646, 505, 1.05);
        const dir = caveAt(640, 468, 1.75).sub(toP).normalize();
        S._moveProp('stake', toP,
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
          1.3, { silent });
      },
      'stake-drive': (silent) => {
        /* THE LINE: the beam runs from the men's hands at the lower left up
           into the eye at the upper right — one clean diagonal, with the two
           who lean on it DOWNSTAGE of the sprawl so the frame reads back to
           front. Nine hundred millimetres of honest air between beam and face. */
        const butt = caveAt(612, 596, 1.15);
        const eye = caveAt(706, 556, 2.35);
        S._moveProp('stake', butt.clone().lerp(eye, 0.52),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
            eye.clone().sub(butt).normalize()), 2.4, { silent });
        if (!silent) S.driveSpin = { t0: S.t + 1.2 };
        S._walkRoute(A('ulysses'), [648, 517], [604, 583], { silent, label: 'cave:drive-u' });
        S._crew(1).forEach((c) => {
          S._walkRoute(c, [668, 521], [650, 590], { silent, label: 'cave:drive-crew' });
        });
        /* a pile of four at one mark is what makes this frame unreadable */
        S._crew(CREW_POOL).slice(1).forEach((c) => S._fade(c, 0, 0.8, silent));
      },
      'blind-hiss': (silent) => {
        /* THE BLINDING, abstract: screen shake, the fire FLARING, the roar —
           nothing shown at the eye itself. */
        S.driveSpin = null;
        S.movers = S.movers.filter((m) => m.id !== 'prop-stake');
        if (!silent) {
          S.shake = { t0: S.t + 0.15, amp: 0.40, dur: 1.9 };
          if (S.audio) S.audio.cue('giant-roar', { delay: 0.3 });
        }
        S._mover('blind-flare', 2.8, (k) => {
          S.flareK = k < 0.22 ? (k / 0.22) * 1.15 : 1.15 * (1 - (k - 0.22) / 0.78);
        }, { silent });
        S._mover('tip-cool', 3.0, (k) => { S.tipGlow = 1 - 0.8 * easeInOut(k); }, { silent });
        const g = A('poly-idle');
        if (g && g.mode === 'pose' && !silent) {
          const gp = g.group.position.clone(), gq = g.group.quaternion.clone();
          const qz = new THREE.Quaternion();
          S._mover('convulse', 2.4, (k) => {
            const s = Math.sin(Math.PI * clamp01(k));
            g.group.position.y = gp.y + 0.55 * s;
            qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.16 * s);
            g.group.quaternion.copy(gq).multiply(qz);
          }, { owner: g.id });
        }
        S._moveProp('stake', caveAt(700, 541, 0.16),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(1, 0.06, 0.15).normalize()), 0.8, { silent, delay: 0.5 });
      },
      'fright-scatter': (silent) => {
        S._walkRoute(A('ulysses'), [684, 537], CAVE_MARKS.huddle,
          { speed: SCURRY_MPS, silent, label: 'cave:fright-u' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, [700 + i * 8, 539 + (i % 2) * 6],
            [903 + (i % 2) * 20, 535 + (i % 3) * 7],
            { speed: SCURRY_MPS, silent, delay: 0.12 * i, label: 'cave:fright-crew' });
        });
      },
      boulderOpen: (silent) => {
        S._boulderTo(0, { silent });
        /* the blind grope: he rolls to his feet among the sheep and feels his
           way down the audited lane to the door he can no longer see */
        if (silent) { S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1); return; }
        const g = S._giant('idle');
        if (!g) return;
        const gp = g.group.position.clone(), gq = g.group.quaternion.clone();
        const up = caveAt(806, 545);
        const uq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -1.4, 0));
        g.mode = 'pose'; g.group.visible = true; g.walk = null;
        S._mover('giant-rise', 1.6, (k) => {
          const e = easeInOut(k);
          g.group.position.lerpVectors(gp, up, e);
          g.group.quaternion.slerpQuaternions(gq, uq, e);
        }, { owner: g.id, onDone: () => {
          if (g.mode === 'off') return;              /* struck while he rose */
          S._walkRoute(g, [806, 545], CAVE_MARKS.doorwaySeat,
            { speed: GIANT_MPS * 0.55, label: 'cave:grope' });
        } });
      },
      'doorway-seat': (silent) => {
        const groping = A('poly-idle');
        if (!silent && groping && groping.mode === 'walk') return; /* already going */
        S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1);
      },

      /* ---------- BEAT V · THE RAMS ---------- */
      'trios-under': (silent) => {                 /* the men slide under the fleeces */
        S._onStageCrew().forEach((c, i) => S._fade(c, 0, 1.1 + 0.2 * i, silent));
      },
      'ram-stand': (silent) => {
        const r = A('ram-great');
        if (!r) return;
        if (silent || r.group.visible) { S._stand(r, caveAt(...CAVE_MARKS.ramStand), 2.2); return; }
        S._walkRoute(r, [900, 545], CAVE_MARKS.ramStand, { speed: 1.5, label: 'cave:ram-in' });
      },
      slingUnder: (silent) => {
        /* G5 — the no-text click IS the sling-under: the reader drops to the
           UNDER-FLEECE EYE for two seconds. The shot table keeps a POV class
           for exactly this and stages no row on it; the director owns the
           override and hands the frame straight back to the storyteller. */
        S._fade(A('ulysses'), 0, 0.8, silent);
        if (silent) return;
        const r = A('ram-great');
        if (!r || !r.group.visible) return;
        const V = r.group.getWorldPosition(new THREE.Vector3());
        S.pov = {
          t0: S.t, until: S.t + 2.0,
          pos: new THREE.Vector3(V.x + 0.25, 0.52, V.z + 0.95),
          look: new THREE.Vector3(V.x - 2.6, 0.75, V.z - 3.4),
          fov: 62,
        };
      },
      'flock-stream': (silent) => {
        /* dawn: THREE rams hurry out with men slung under them, down the
           audited lane and out the mouth; the ewes stay bleating by the pens */
        const walkers = Array.from({ length: FLOCK_CAP }, (_, i) => A('flock-' + i))
          .filter(Boolean);
        walkers.forEach((a, i) => {
          S._stand(a, caveAt(905 + i * 15, 543 + (i % 2) * 5), 2.4);
          S._walkRoute(a, [905 + i * 15, 543 + (i % 2) * 5], [332, 441],
            { speed: 1.7, silent, delay: 0.85 * i, label: 'cave:stream-out' });
          if (silent) S._off(a);
        });
        if (!silent) S.flockExit = { t0: S.t, walkers };
      },
      'ram-at-mouth': (silent) => {
        const r = A('ram-great');
        if (!r) return;
        if (silent) { S._stand(r, caveAt(...CAVE_MARKS.ramAtMouth), 2.4); return; }
        S._stand(r, caveAt(...CAVE_MARKS.ramStand), 2.2);
        S._walkRoute(r, CAVE_MARKS.ramStand, CAVE_MARKS.ramAtMouth,
          { speed: 1.1, label: 'cave:ram-last' });
      },
      'free-men': () => {},                        /* carried by the seg */

      /* ---------- BEAT VI · THE SEA ---------- */
      jeer: () => { S.clock0 = S.t; S.jeers++; },
      defy: () => { S.jeers++; },
      shout: () => { S.clock0 = S.t; },
      'stern-ulysses': () => {
        if (S.stage.setName !== 'sea') return;
        S._deck(A('ulysses'), [0, S.stage.set.SHIP.deckY, -5.5], 0);
      },
      'stern-rail': () => {
        if (S.stage.setName !== 'sea') return;
        S._deck(A('ulysses'), [0, S.stage.set.SHIP.deckY, -6.0], 0);
      },
      'rock-one': (silent) => {
        /* ROCK 1: the tear, the set's own 1.7 s ballistics, the splash ahead
           of the rudder — and the WASH drives the ship back before the oars
           bite (the pole-push, staged as the settle). */
        S._seaThrow(0, 0.9, null, silent);
        const ship = S.stage.set.SHIP.group;
        const from = ship.position.clone();
        const back = from.clone().add(new THREE.Vector3(2.6, 0, 0.5));
        const settle = from.clone().add(new THREE.Vector3(1.1, 0, 0.2));
        S._mover('wash-back', 3.2, (k) => {
          if (k < 0.5) ship.position.lerpVectors(from, back, easeInOut(k / 0.5));
          else ship.position.lerpVectors(back, settle, easeInOut((k - 0.5) / 0.5));
        }, { silent, delay: 2.6 });
      },
      'double-distance': (silent) => {             /* "twice as far as before" */
        const ship = S.stage.set.SHIP.group;
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-17.5, 0, 1.5));
        S._mover('double-distance', 6.5, (k) =>
          ship.position.lerpVectors(from, to, easeInOut(k)), { silent });
      },
      'rock-two': (silent) => {
        /* ROCK 2, the curse's punctuation: thrown at the ship's OWN stern
           wherever the escape has carried it — the near-miss whose wash drives
           them ONWARD. The taunt dial: the more he jeered, the closer it falls. */
        const ship = S.stage.set.SHIP.group;
        const h = ship.rotation.y;
        const near = Math.max(0.6, 2.4 - 0.5 * S.jeers);
        const stern = new THREE.Vector3(
          ship.position.x + Math.sin(h) * -7.1, 0,
          ship.position.z + Math.cos(h) * -7.1);
        S._seaThrow(1, 0.5,
          new THREE.Vector3(stern.x - near * 0.8, 0, stern.z + near * 0.55), silent);
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-4.6, 0, -0.6));
        S._mover('wash-onward', 3.4, (k) =>
          ship.position.lerpVectors(from, to, easeInOut(k)), { silent, delay: 2.2 });
      },
      curse: (silent) => {
        S.clock0 = S.t;
        const hemi = S.stage.set.parts['night-rig'], moon = S.stage.set.moonLight;
        if (hemi && moon) {
          const h0 = hemi.intensity, m0 = moon.intensity;
          S._mover('curse-dark', 2.2, (k) => {
            const e = easeInOut(k);
            hemi.intensity = h0 + (h0 * 0.72 - h0) * e;
            moon.intensity = m0 + (m0 * 0.80 - m0) * e;
          }, { silent });
        }
        const g = A('poly-idle');
        if (g && g.group.visible && !silent) {
          const s0 = g.model.scale.x;
          S._mover('curse-rise', 2.6, (k) =>
            g.model.scale.setScalar(s0 * (1 + 0.05 * Math.sin(Math.PI * clamp01(k)))),
            { owner: g.id });
        }
      },
      'sea-dawn': (silent) => {
        /* dawn lift + THE SAIL-OFF: the long glide toward the moonpath */
        const hemi = S.stage.set.parts['night-rig'], moon = S.stage.set.moonLight;
        if (hemi && moon) {
          const h0 = hemi.intensity, m0 = moon.intensity;
          S._mover('sea-dawn', 4.5, (k) => {
            const e = easeInOut(k);
            hemi.intensity = h0 + (h0 * 1.85 - h0) * e;
            moon.intensity = m0 + (m0 * 1.35 - m0) * e;
          }, { silent });
        }
        const ship = S.stage.set.SHIP.group;
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-9.5, 0, -5.5));
        S._mover('sail-off', 12.0, (k) =>
          ship.position.lerpVectors(from, to, easeInOut(k)), { silent });
      },

      /* the closing leaf */
      bookOffstage: () => { for (const a of S.stage.actors.values()) S._off(a); },
    };
    return this.__acts;
  }

  /* ================= SEGS (the pantomime between the lines) ================= */
  startSeg(name, dur = 6, silent = false) {
    const S = this;
    const set = this.stage.setName;
    const A = (id) => this.stage.actors.get(id);
    const caveAt = (px, py, y = 0) =>
      new THREE.Vector3(FRAMES.cave.X(px), y, FRAMES.cave.Z(py));
    this.acts.push({ seg: name, t: +this.t.toFixed(3), set, silent: !!silent });
    switch (name) {
      case 'landfall': {                           /* the ships ghost in */
        if (set !== 'shore') break;
        const s1 = this.stage.set.parts['ship-1'], s2 = this.stage.set.parts['ship-2'];
        if (!s1 || !s2) break;
        const h1 = s1.position.clone(), h2 = s2.position.clone();
        const o1 = h1.clone().add(new THREE.Vector3(10, 0, -14));
        const o2 = h2.clone().add(new THREE.Vector3(12, 0, -12));
        this._mover('landfall', dur, (k) => {
          const e = easeInOut(k);
          s1.position.lerpVectors(o1, h1, e);
          s2.position.lerpVectors(o2, h2, e);
        }, { silent });
        break;
      }
      case 'hunt': break;                          /* carried by the bed */
      case 'entry': {                              /* the men slip in past the pens */
        if (set !== 'cave') break;
        this._walkRoute(A('ulysses'), [330, 442], [610, 412],
          { silent, label: 'cave:entry-u' });
        /* they come in ABREAST, not down one another's spine: the mouth is
           3.7 m wide, so the entry marks fan across it and the delays stagger
           the file. Two bodies on one corridor at one speed from one pixel is
           one body wearing another. */
        this._aliveCrew().forEach((c, i) => {
          const from = [316 + i * 13, 446 - (i % 2) * 9];
          this._stand(c, caveAt(from[0], from[1]), -2.0);
          this._walkRoute(c, from, [604 + (i % 4) * 24, 396 + (i % 3) * 6],
            { silent, delay: 0.34 * i, label: 'cave:entry-crew' });
        });
        break;
      }
      case 'return': {                             /* POLYPHEMUS in under the load */
        if (set !== 'cave') break;
        const w = this._giant('walk');
        if (w) {
          this._stand(w, caveAt(340, 436), 1.2);
          this._walkRoute(w, [340, 436], CAVE_MARKS.giantSeat,
            { speed: GIANT_MPS, silent, label: 'cave:giant-enter' });
        }
        break;
      }
      case 'milking': break;
      case 'seize': {                              /* O.6 — identical, three times */
        this.meals = Math.min(3, this.meals + 1);
        const taken = this._onStageCrew().slice(-2);
        for (const c of taken) this._fade(c, 0, 1.4, silent);
        if (!silent) {
          const g = this._giantOn();
          if (g && g.mode !== 'off') {
            const s0 = g.baseScale * g.local, f0 = g.face;
            this._mover('clutch', Math.min(4, dur), (k) => {
              const s = Math.sin(Math.PI * clamp01(k));
              g.model.scale.setScalar(s0 * (1 + 0.05 * s));
              g.group.rotation.y = f0 + 0.35 * s;
            }, { owner: g.id });
          }
        }
        break;
      }
      case 'flock-out': {                          /* stone up, flock out, stone to */
        if (set !== 'cave') break;
        this._flockStream('out', dur, silent);
        /* HE GOES OUT WITH THEM — iii-03..05 give the leaf no giant: the men
           scheme because he is on the mountain. */
        const w = this._giant('walk');
        if (w) {
          if (silent) this._off(w);
          else {
            this._stand(w, caveAt(...CAVE_MARKS.giantSeat), 2.4);
            this._walkRoute(w, CAVE_MARKS.giantSeat, [330, 438],
              { speed: GIANT_MPS, delay: 0.4, label: 'cave:giant-out' });
            w.fade = { t0: this.t + Math.max(1.2, dur - 1.8), dur: 1.0, from: 1, to: 0 };
          }
        }
        break;
      }
      case 'flock-in': {
        if (set !== 'cave') break;
        this._flockStream('in', dur, silent);
        const left = this._aliveCrew();
        const spots = this._cluster(caveAt(...CAVE_MARKS.huddle), left.length, 71031, 1.3);
        left.forEach((c, j) => this._stand(c, spots[j], -1.1));
        this._crew(CREW_POOL).slice(left.length).forEach((c) => this._off(c));
        const w = this._giant('walk');
        if (w) {
          this._stand(w, caveAt(340, 436), 1.2);
          this._walkRoute(w, [340, 436], CAVE_MARKS.giantSeat,
            { speed: GIANT_MPS, silent, delay: 1.2, label: 'cave:giant-return' });
        }
        break;
      }
      case 'stake-make': {
        const st = this._prop('stake');
        if (!st) break;
        st.visible = true;
        const h = st.userData.home;
        if (h) { st.position.copy(h.p); st.quaternion.copy(h.q); }
        break;
      }
      case 'collapse': break;                      /* the unit's own act sprawls him */
      case 'lash-trios': {                         /* the flock edges west */
        if (set !== 'cave') break;
        const from = [[938, 538], [972, 545], [1002, 540], [915, 548]];
        const to = [[884, 540], [906, 546], [928, 542], [862, 548]];
        from.forEach((f, i) => {
          const e = A('ewe-' + i);
          if (e) this._walkRoute(e, f, to[i],
            { speed: 0.8, silent, delay: 0.4 * i, label: 'cave:lash' });
        });
        break;
      }
      case 'free-men': {                           /* out past the yards */
        if (set !== 'cave') break;
        const r = A('ram-great');
        if (r) {
          this._walkRoute(r, CAVE_MARKS.ramAtMouth, [318, 452],
            { speed: 1.1, silent, label: 'cave:ram-clear' });
          if (silent) this._off(r);
          else r.fade = { t0: this.t + 2.4, dur: 1.0, from: 1, to: 0 };
        }
        this._appear(A('ulysses'), caveAt(372, 486), 2.6, { delay: 1.4, silent });
        const freed = this._aliveCrew();
        const spots = this._cluster(caveAt(414, 498), freed.length, 71081, 1.5);
        freed.forEach((c, i) => this._appear(c, spots[i], 2.2 + 0.2 * i,
          { delay: 2.2 + 0.35 * i, silent }));
        break;
      }
      case 'return-beach': {                       /* dusk dip + the glide home */
        if (set !== 'sea') break;
        const hemi = this.stage.set.parts['night-rig'], moon = this.stage.set.moonLight;
        if (hemi && moon) {
          const h0 = hemi.intensity, m0 = moon.intensity;
          this._mover('dusk-dip', dur * 0.7, (k) => {
            const e = easeInOut(k);
            hemi.intensity = h0 + (h0 * 0.66 - h0) * e;
            moon.intensity = m0 + (m0 * 0.72 - m0) * e;
          }, { silent });
        }
        const ship = this.stage.set.SHIP.group;
        const from = ship.position.clone();
        const to = from.clone().add(new THREE.Vector3(-3.2, 0, 2.4));
        this._mover('return-glide', dur, (k) =>
          ship.position.lerpVectors(from, to, easeInOut(k)), { silent });
        break;
      }
      default: break;
    }
    void S;
  }

  _flockStream(dir, dur, silent) {
    const A = (id) => this.stage.actors.get(id);
    this._boulderTo(0, { silent, dur: 1.3 });      /* the stone comes up */
    const ram = A('ram-great');
    const ewes = [0, 1, 2, 3].map((i) => A('ewe-' + i)).filter(Boolean);
    const penPx = CAVE_MARKS.pens, mouthPx = [330, 440];
    const walkers = [ram, ...ewes].filter(Boolean);
    const f = FRAMES.cave;
    walkers.forEach((a, i) => {
      const from = dir === 'out' ? [penPx[0] - i * 14, penPx[1] - (i % 2) * 8] : mouthPx;
      const to = dir === 'out' ? mouthPx : [penPx[0] - i * 16, penPx[1] - (i % 2) * 9];
      this._stand(a, new THREE.Vector3(f.X(from[0]), 0, f.Z(from[1])), dir === 'out' ? 2.4 : 1.2);
      this._walkRoute(a, from, to,
        { speed: 1.6, silent, delay: 0.5 * i, label: 'cave:flock-' + dir });
    });
    if (dir === 'out') {
      if (silent) walkers.forEach((a) => this._off(a));
      else this.flockExit = { t0: this.t, walkers };
      this._boulderTo(1, { silent, delay: Math.max(1.6, dur - 1.4), dur: 1.3 });
    } else {
      walkers.forEach((a) => { a.opacity = 1; a.setFade(1); });
      this.flockExit = null;
    }
  }

  /* ================= the gates ================= */
  /** is the reader's target live on this leaf? (units.js `target`) */
  targetLive(name) {
    const set = this.stage.setName;
    if (name === 'ship') return set === 'shore';
    if (name === 'sword') return set === 'cave' && this.swordLive;
    if (name === 'ram-great') {
      const r = this.stage.actors.get('ram-great');
      return set === 'cave' && !!(r && r.group.visible);
    }
    if (name === 'cyclops') {
      const g = this.stage.actors.get('poly-idle');
      return set === 'sea' && !!(g && g.group.visible);
    }
    return false;
  }
  /** where the target sits in world space (the reader's ring is drawn there) */
  targetWorld(name) {
    const r = { ship: { t: 'ship-2' }, sword: { p: 'sword' },
      'ram-great': { a: 'ram-great' }, cyclops: { a: 'poly-idle' } }[name];
    if (!r) return null;
    const hit = this.stage.resolve(r);
    return hit ? hit.p : null;
  }
  /** the beat clock (jeer / shout / curse arm it; `clock` units read it) */
  clockT() { return this.clock0 === null ? null : +(this.t - this.clock0).toFixed(3); }
  setHold(k) { this.holdK = clamp01(k); }

  /* ================= THE TICK ================= *
   * Every frame, in this order: movers (pure f(simT)), walks, fades, the
   * flock's exit, the set grade. Nothing here reads wall time.               */
  tick(simT) {
    const P = new THREE.Vector3(), DIR = new THREE.Vector3();

    /* movers */
    const done = [];
    for (const m of this.movers) {
      const k = m.dur > 0 ? clamp01((simT - m.t0) / m.dur) : 1;
      if (simT < m.t0) continue;
      m.apply(k);
      if (k >= 1 && !m.finished) { m.finished = true; done.push(m); }
    }
    if (done.length) {
      this.movers = this.movers.filter((m) => !m.finished);
      for (const m of done) if (m.onDone) m.onDone(true);
    }

    /* walks + fades */
    for (const a of this.stage.actors.values()) {
      if (a.walk) {
        const fin = a.walk.at(simT, P, DIR);
        a.group.position.copy(P);
        if (DIR.lengthSq() > 1e-6) {
          a.face = Math.atan2(DIR.x, DIR.z);
          a.group.rotation.set(0, a.face, 0);
        }
        if (fin) { a.walk = null; a.mode = 'stand'; }
      }
      if (a.fade) {
        const k = clamp01((simT - a.fade.t0) / Math.max(0.01, a.fade.dur));
        if (simT >= a.fade.t0) {
          a.opacity = a.fade.from + (a.fade.to - a.fade.from) * easeInOut(k);
          a.setFade(a.opacity);
          if (k >= 1) {
            a.fade = null;
            if (a.opacity <= 0.02) this._off(a);
          }
        }
      }
      /* THE CLIP LAW: a walking body walks, an idle rig breathes, and a body
         standing still is STILL — not a walk cycle left running under it. */
      if (!a.mixer) continue;
      if (a.mode === 'walk') a.mixer.setTime(a.clipDur ? (simT % a.clipDur) : 0);
      else if (a.loopWhenStill) a.mixer.setTime(a.clipDur ? (simT % a.clipDur) : 0);
      else a.mixer.setTime(0);
    }

    /* the flock's exit: each walker leaves the leaf as it reaches the mouth */
    if (this.flockExit) {
      let live = 0;
      for (const a of this.flockExit.walkers) {
        if (!a || a.mode === 'off') continue;
        if (a.walk) { live++; continue; }
        if (!a.fade && a.opacity > 0.02) a.fade = { t0: simT, dur: 0.8, from: a.opacity, to: 0 };
        if (a.fade) live++;
      }
      if (!live) this.flockExit = null;
    }

    /* the stake's auger twist */
    if (this.driveSpin) {
      const st = this._prop('stake');
      if (st) st.rotateY((simT - this.driveSpin.t0) > 0 ? 0.06 : 0);
    }

    /* the cave's hour, graded onto the set's OWN lights (the set ticked first,
       so this multiplies its flicker rather than replacing it) */
    if (this.stage.setName === 'cave' && this.stage.set) {
      const fl = this.stage.set.fireLight;
      if (fl) fl.intensity *= this.caveGrade.fire * (1 + this.flareK);
      const hemi = this.stage.set.parts['night-rig'];
      if (hemi) {
        if (hemi.userData.base === undefined) hemi.userData.base = hemi.intensity;
        hemi.intensity = hemi.userData.base * this.caveGrade.hemi;
      }
    }

    /* the stake's tip heat, as material state (the watermark law) */
    if (this.tipGlow > 0) {
      const st = this._prop('stake');
      if (st) st.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          o.material.emissive.setRGB(0.9 * this.tipGlow, 0.34 * this.tipGlow, 0.06 * this.tipGlow);
          o.material.emissiveIntensity = 0.4 + 1.6 * this.tipGlow * (0.6 + 0.4 * this.holdK);
        }
      });
    }
    /* the sword's breathing glint at the G2 anchor */
    const sw = this._prop('sword');
    if (sw && sw.visible && sw.userData.glint && !this.movers.some((m) => m.id === 'sword-draw'))
      sw.userData.glint.emissiveIntensity = 1.2 + 0.55 * Math.sin(simT * 2.1);
  }

  /**
   * THE PROSCENIUM LAW, ENFORCED AT THE CUT.
   *
   * A camera station is solved from the set's own volume and the ledger's
   * obstacle boxes — but the CAST is in neither of those, and a body is a
   * solid thing. Two rows of the shot table put the lens exactly where a body
   * now stands: the plea's eye-level DIALOGUE station is where the seated
   * giant sits, and the auger's CLOCK station is in the sprawl. Baked over an
   * empty cave both are reasonable; played with the cast on the leaf, one is
   * the inside of his thigh and the other is the inside of his ribs.
   *
   * THE CORRECTION IS A SIDESTEP, NOT A REDESIGN. An operator who finds
   * himself behind a pillar walks AROUND it — he does not change lens, drop
   * the shot's height, or back away and shoot it wide. So the station is
   * swung about the SUBJECT: same distance (so the designed subject size
   * survives), same height, same aim, same move — just far enough around the
   * arc to be out of the body and to have a clear line to the subject.
   *
   * A body the subject is standing at is never an obstruction: the bowl is
   * held at the giant's knee and the ember close is at his feet, and craning
   * or swinging to "clear" those throws away the shot.
   *
   * Measured once per cut off skinned bounds in the pose the body is actually
   * IN (a Box3 on a SkinnedMesh hands back the bind pose and would rule on a
   * giant who is standing up), applied every frame as a fixed offset. No
   * per-frame vertex sweep, and deterministic.
   */
  clearStation(cam, aimIn = null) {
    /* THE PIVOT IS THE SHOT'S OWN DESIGNED ANCHOR, not the live subject. At
       the instant of a cut the subject of a walking unit is still at the mark
       he is leaving, so swinging about where he happens to BE puts the lens a
       metre from where he is GOING. The baked anchor is the point the shot was
       composed around; the live anchor is what the lens re-aims at once the
       station is settled. */
    const aim = Array.isArray(aimIn) ? new THREE.Vector3().fromArray(aimIn) : aimIn;
    this.station = 0;
    this.lift = 0;
    this.aim = null;
    this.swing = null;
    if (!cam || !cam.isPerspectiveCamera) return 0;

    const boxes = [];
    for (const a of this.stage.actors.values()) {
      if (!a.group.visible || a.opacity <= 0.05) continue;
      boxes.push(bounds(a.group).clone().expandByScalar(0.2));
    }
    if (!boxes.length) return 0;

    const p0 = cam.position.clone();
    const inside = (p) => boxes.some((b) => b.containsPoint(p));
    if (!inside(p0)) return 0;

    /* the bodies that may not sit on the sightline: big ones that are not the
       subject's own host */
    const probe = new THREE.Vector3();
    const seg = new THREE.Line3();
    const blockers = aim ? boxes.filter((b) =>
      b.getSize(new THREE.Vector3()).length() > 4 &&
      !b.clone().expandByScalar(0.6).containsPoint(aim)) : [];
    const lineClear = (from) => {
      if (!aim) return true;
      seg.set(from, aim);
      for (let k = 0.1; k <= 0.9; k += 0.08) {
        seg.at(k, probe);
        for (const b of blockers) if (b.containsPoint(probe)) return false;
      }
      return true;
    };

    /* A SWING ABOUT THE SUBJECT WAS TRIED AND WITHDRAWN — and the reason is
       worth keeping, because it is the one real seam left in this build. To
       swing the lens around a subject and hold its size you have to know
       where the subject IS, and the two candidates both lie: the LIVE anchor
       at the instant of a cut is the mark the body is still leaving (a walking
       unit has not arrived yet), and the BAKED anchor belongs to the shot
       table's own mark set, which was solved from 3d/lenses.json — not from
       the ledger marks this staging walks to. For the plea those two are 5.5 m
       apart, so every swing radius is wrong and the lens lands in the
       speaker's face.
         Until the shot table is re-baked against the assembled staging (the
       cinematography lane's tool, tools/ody/shots3d_bake.mjs, over these
       marks), the only correction this lane can make honestly is the one that
       needs no radius at all: step straight back along the lens's own axis.
       It keeps height, aim, lens and move, and it costs a little subject size
       — a known, bounded price, paid on the two rows that need it. */
    void aim; void lineClear; void seg;

    /* the fallback: no clear arc, so step straight back along the lens axis */
    const dir = cam.getWorldDirection(new THREE.Vector3());
    for (let d = 0.3; d <= 12; d += 0.3) {
      probe.copy(p0).addScaledVector(dir, -d);
      if (!inside(probe)) { this.station = d + 1.2; break; }
    }
    if (this.station > 0)
      console.log(`[proscenium] station was inside a body and the arc is solid — ` +
                  `lens backed off ${this.station.toFixed(1)} m along its own axis`);
    return this.station;
  }

  /** THE SHAKE + THE POV — the two moments the director takes the camera back
   *  from the storyteller. Applied after cine.step so the shot table still
   *  owns every other frame. Returns true if the camera was overridden. */
  driveCamera(cam, simT, aimLive = null) {
    let touched = false;
    if ((this.swing || this.station > 0) && !this.pov) {
      if (this.swing) {
        cam.position.add(this.swing.offset);
        /* re-aim at the storyteller's OWN LIVE ANCHOR, never at a point frozen
           at the cut: the subject of a walking unit is somewhere else two
           seconds later, and a pinned aim leaves him outside the frame. */
        if (aimLive) cam.lookAt(aimLive);
      } else {
        cam.position.addScaledVector(cam.getWorldDirection(this.__d ||
          (this.__d = new THREE.Vector3())), -this.station);
      }
      touched = true;
    }
    if (this.pov && simT < this.pov.until) {
      cam.position.copy(this.pov.pos);
      cam.lookAt(this.pov.look);
      if (cam.isPerspectiveCamera && this.pov.fov) {
        cam.fov = this.pov.fov; cam.updateProjectionMatrix();
      }
      touched = true;
    } else if (this.pov && simT >= this.pov.until) this.pov = null;
    if (this.shake) {
      const k = (simT - this.shake.t0) / this.shake.dur;
      if (k >= 0 && k <= 1) {
        const a = this.shake.amp * (1 - k) * (1 - k);
        cam.position.x += Math.sin(simT * 47.3) * a;
        cam.position.y += Math.sin(simT * 39.1 + 1.7) * a * 0.7;
        touched = true;
      } else if (k > 1) this.shake = null;
    }
    return touched;
  }

  /** what the gates and the smoke read */
  snapshot() {
    return {
      set: this.stage.setName, beat: this.beat, state: this.state,
      census: this.census(), meals: this.meals, boulderK: +this.boulderK.toFixed(3),
      movers: this.movers.map((m) => m.id),
      walking: [...this.stage.actors.values()].filter((a) => a.walk).map((a) => a.id),
      acts: this.acts.length, audits: this.audits,
      routeHits: this.routes.filter((r) => r.hits.length).map((r) => r.label),
      swordLive: this.swordLive, jeers: this.jeers, clockT: this.clockT(),
      pov: !!this.pov, shake: !!this.shake, station: +(this.station || 0).toFixed(2), swing: this.swing ? this.swing.deg : 0,
    };
  }
}
