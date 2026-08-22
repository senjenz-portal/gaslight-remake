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
/* a thing thrown down does not ease out of the throw: it arrives and stops */
const easeOutCubic = (k) => 1 - Math.pow(1 - clamp01(k), 3);

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
  suppliant: [690, 512], giantSeat: [760, 452], sword: [490, 545],
  scheme: [800, 530], lots: [713, 527], stakeHide: [782, 496],
  bowlOffer: [700, 514], sprawlHead: [664, 546], ramStand: [838, 430],
  ramAtMouth: [395, 438], doorwaySeat: [345, 470], mouth: [355, 438],
  pens: [900, 545],
  /* ROUND 4 · the marks the RENDERED VERBS need.
     THE SWORD MARK MOVED, and it had to. It stood at (680,554): world
     (-0.56, 5.17), which is (a) two metres OUTSIDE the cave's camera volume,
     so no legal station can stand downstage of him, and (b) straddling the
     sprawl's own audited box — measured, every reverse the solver found on
     that mark looked THROUGH nine metres of sleeping giant, which is exactly
     what round 3's verdict saw ("total obstruction"). (490,545) puts him at
     the giant's CROWN, west of the head bone, on open floor a hand clear of
     the firewood box, with the door behind him: the blade can reach the
     throat, his face has a legal reverse, and his eyeline to the stone is the
     cut that follows it. */
  /* THE OBSTACLE LAW APPLIES TO A GIANT TOO. (600,468) is inside the hearth's
     own ledger box, so the walk that carries the load in crossed the fire —
     the audit caught it. He stops south of the blaze and throws the load past
     it, onto the wood that is already there. */
  woodCarry: [700, 520],      /* where the load comes off his shoulder */
  woodDrop: [604, 528],       /* …and where it hits the floor */
  seizeGrab: [860, 500],      /* the man is dragged to the edge of his reach */
  /* ROUND 5: lifted CLEAR OF HIS OWN SILHOUETTE. At (820,480) the man was
     held up dead in front of seven metres of the same-coloured giant and the
     finished frame could not tell them apart; from the impact station this
     mark is 23 degrees off him, against the racks. */
  seizeAloft: [870, 470],     /* …lifted here, clear of every body */
  /* ROUND 5: the landing moved off the CLAY BOWL. (855,512) is inside the
     ledger's own clayBowl footprint — measured on the finished frame, the
     body was dashed BEHIND a barrel and the impact went to the bottom edge. */
  seizeDash: [800, 530],      /* …and dashed down onto open stone */
  swordVitals: [546, 548],    /* the throat the point is held over */
  /* ROUND 5 · THE WAY TO THE SWORD, WRITTEN. Measured on the running book,
     the corridor's own answer to (734,500) -> (490,545) is 22.4 m: there is
     no path point on the south floor west of the fire, so it climbs over the
     hearth, runs the whole north wall and comes back down. He goes along the
     south wall instead — under the giant's feet before the giant is lying in
     them, south of the firewood box the whole way, 9.6 m — and is standing
     on his mark before the leaf that draws the blade opens. */
  swordVia: [[720, 558], [640, 566], [540, 570], [490, 560]],
  sobHuddle: [928, 536],      /* the survivors, at the end of the night */
  /* WHERE THE PLUCKED BEAM LANDS. It comes down among the men who are running
     from him, which is both the truer image and the only light that end of the
     cave has at this minute — the [read] law measured the flight at dark 0.56
     against a cap of 0.55 with the beam thrown into the far corner. */
  stakeFlung: [880, 528],
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
    this.fireFlicker = 1;        /* …and the hearth's own breathing, when an act asks */
    this.swordOut = false;       /* the blade is clear of its sheath */
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
    this._restArms(a);
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
  /**
   * `via` — AN AUTHORED ROUTE, still audited.
   *
   * corridorRoute walks the demo lane's own path polyline between the two
   * nearest points, which is the right default and is occasionally a
   * disaster: the crossing to the sword mark measured TWENTY-TWO METRES
   * because the path has no southern leg west of the fire, so a man six
   * metres from his sword walked north over the hearth, west past every
   * rack and back down — seven seconds, and round 4's hilt insert was cut
   * on the fourth of them. A DP may write the walk instead. The points go
   * through the same `_audit`, so the obstacle law is not being asked to
   * look away; only the pathfinder is being overruled.
   */
  _walkRoute(a, from, to, { speed = WALK_MPS, delay = 0, y = 0, silent = false,
                            via = null, label = '' } = {}) {
    if (!a) return;
    const set = this.stage.setName;
    const f = FRAMES[set];
    const pts = via ? [from, ...via, to] : corridorRoute(f.path, from, to);
    this._audit(pts, label || `${set}:${a.id}`);
    const world = pts.map(([px, py]) => new THREE.Vector3(f.X(px), y, f.Z(py)));
    if (silent) {
      const last = world[world.length - 1], prev = world[Math.max(0, world.length - 2)];
      this._stand(a, last, Math.atan2(last.x - prev.x, last.z - prev.z));
      return;
    }
    this._restArms(a);
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

  /* ================= ROUND 4 · THE POSE VOCABULARY =================
   * Sol's round-3 verdict on Beat II was not about the camera: "the rendered
   * verbs still do not land … visible nouns are not yet unmistakable
   * behaviour." A cut list cannot photograph an action that the scene graph
   * never performs, and up to here the book could only PARK a body at a mark
   * or WALK it to another one. Four verbs in this chapter are neither: a man
   * holds his arms open, a man is lifted off the floor, a giant spreads his
   * hands across a doorway, a giant throws a load down.
   *
   * The cast lane already proved the mechanism — the seated giant is a bind
   * pose plus AIMED bones (point a bone's own +Y down a world direction),
   * because this rig family's arm frames sit 45 deg off every world axis. All
   * that was missing was the same tool at STORY time. It is idempotent (the
   * aim is absolute, not incremental), it is silent-safe, and a rig without
   * the bone simply does not get the note.
   * ================================================================= */
  _bones(a) {
    if (!a.__bones) {
      const b = {};
      a.group.traverse((o) => { if (o.isBone) b[o.name] = o; });
      a.__bones = b;
    }
    return a.__bones;
  }
  /** swing one bone's own +Y onto a WORLD direction */
  _aim(a, name, dir) {
    if (!a) return false;
    const b = this._bones(a)[name];
    if (!b || !b.parent) return false;
    a.group.updateWorldMatrix(true, true);
    /* AN AIMED BONE IS PERMANENT. Measured: the suppliant's open arms were
       still open eleven leaves later — he crossed the cave, drew a sword and
       sobbed till morning with both hands held out, because nothing ever put
       the rig back. The bind value is kept the first time a bone is touched
       and `_restArms` is what a walk or a fresh mark calls to undo it. */
    if (!b.userData.__q0) b.userData.__q0 = b.quaternion.clone();
    a.__posedArms = true;
    const wq = new THREE.Quaternion();
    b.getWorldQuaternion(wq);
    const cur = new THREE.Vector3(0, 1, 0).applyQuaternion(wq).normalize();
    const tgt = dir.clone().normalize();
    const del = new THREE.Quaternion().setFromUnitVectors(cur, tgt);
    const pq = new THREE.Quaternion();
    b.parent.getWorldQuaternion(pq).invert();
    b.quaternion.copy(pq).multiply(del).multiply(wq);
    return true;
  }
  /** put every bone this director has aimed back the way the rig shipped */
  _restArms(a) {
    if (!a || !a.__posedArms) return;
    for (const b of Object.values(this._bones(a)))
      if (b.userData.__q0) { b.quaternion.copy(b.userData.__q0); b.userData.__q0 = null; }
    a.__posedArms = false;
  }
  /** a whole limb in one call, from the actor's own facing */
  _arms(a, spec) {
    let n = 0;
    for (const [bone, dir] of Object.entries(spec))
      if (this._aim(a, bone, new THREE.Vector3(...dir))) n++;
    return n;
  }
  /** THE SUPPLIANT: down on one knee, arms held open, palms up at the giant.
   *  Not a caption — the shape a man makes when he is begging, held for the
   *  whole of the plea so any lens on him photographs the plea. */
  _kneelOpen(a, faceDir, { silent = false, dur = 0.9 } = {}) {
    if (!a) return;
    /* the arms are aimed in WORLD directions, so they are built out of HIS
       axes — a plea aimed down +Z would be a man appealing to the wall */
    const fwd = faceDir.clone().setY(0).normalize();
    const rgt = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const up = new THREE.Vector3(0, 1, 0);
    const mix = (r, u, f) => rgt.clone().multiplyScalar(r)
      .addScaledVector(up, u).addScaledVector(fwd, f).toArray();
    const face = Math.atan2(fwd.x, fwd.z);
    const drop = 0.46, lean = 0.17;
    const at = a.group.position.clone();
    a.mode = 'pose'; a.walk = null; a.group.visible = true;
    const apply = (k) => {
      const e = easeInOut(k);
      a.group.position.set(at.x, -drop * e, at.z);
      a.group.rotation.set(lean * e, face, 0);
      /* the arms open as he goes down: upper arms out and forward, forearms
         lifted so the palms turn up — the classic supplication */
      const s = 0.35 + 0.65 * e;
      this._arms(a, {
        L_Upperarm: mix(0.80 * s, -0.30, 0.52), R_Upperarm: mix(-0.80 * s, -0.30, 0.52),
        L_Forearm: mix(0.62 * s, 0.62 * s, 0.48), R_Forearm: mix(-0.62 * s, 0.62 * s, 0.48),
      });
    };
    this._mover('kneel-' + a.id, dur, apply, { silent, owner: a.id });
    if (silent) apply(1);
  }
  /** THE SEAT'S OWN ARMS, restored. An aimed bone is a lasting edit to the
   *  rig, so any act that borrows the giant's arm (the reach, the spread
   *  hands at the door) has to be undone the next time he sits down to work —
   *  otherwise Beat III photographs a giant milking with his arm still out
   *  over a man who was eaten in Beat II. These are the cast lane's own
   *  numbers, turned into HIS frame by the yaw he is sitting at. */
  _seatArms(g, face) {
    if (!g) return;
    const R = new THREE.Matrix4().makeRotationY(face);
    const SEAT_ARMS = {
      L_Upperarm: [0.34, -0.72, 0.61], R_Upperarm: [-0.34, -0.72, 0.61],
      L_Forearm: [0.16, -0.30, -0.94], R_Forearm: [-0.16, -0.30, -0.94],
    };
    for (const [b, d] of Object.entries(SEAT_ARMS))
      this._aim(g, b, new THREE.Vector3(...d).applyMatrix4(R));
  }

  /* THE FIREWOOD. "He brought in with him a huge load of dry firewood" — the
   * line the reader hears over round 3's picture of an EMPTY DOORWAY. The load
   * is authored here rather than in PROP_PLAN because it is not a hand prop
   * with a ledger metre; it is set dressing that exists for nine seconds, is
   * carried in a giant's arms, and then is floor. */
  _wood() {
    if (!this._woodGrp) {
      const g = new THREE.Group();
      g.name = 'firewood-load';
      const bark = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95,
        metalness: 0, flatShading: true });
      const end = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9,
        metalness: 0, flatShading: true });
      const rnd = mulberry32(71071);
      for (let i = 0; i < 11; i++) {
        const L = 2.2 + rnd() * 1.5, r = 0.10 + rnd() * 0.07;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, L, 7),
          [bark, end, end]);
        m.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.5,
          (rnd() - 0.5) * 0.3);
        m.position.set((rnd() - 0.5) * 0.9, 0.14 + (i % 4) * 0.19, (rnd() - 0.5) * 0.7);
        m.castShadow = true; m.receiveShadow = true;
        m.userData.rest = m.position.clone();
        m.userData.spin = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
        g.add(m);
      }
      this._woodGrp = g;
    }
    if (this._woodGrp.parent !== this.stage.scene) this.stage.scene.add(this._woodGrp);
    return this._woodGrp;
  }
  _woodAt(p, y = 0, roll = 0) {
    const g = this._wood();
    g.visible = true;
    g.position.set(p.x, y, p.z);
    g.rotation.set(0, roll, 0);
    return g;
  }
  /** the load hits the floor and the sticks BURST apart — the crash */
  _woodCrash(silent = false, delay = 0) {
    const g = this._wood();
    const sticks = g.children;
    const rnd = mulberry32(71073);
    const scatter = sticks.map(() => ({
      dx: (rnd() - 0.5) * 2.6, dz: (rnd() - 0.5) * 1.9, ry: (rnd() - 0.5) * 2.4,
    }));
    const apply = (k) => {
      const e = easeOutCubic(clamp01(k));
      const fall = 1 - Math.pow(1 - clamp01(k * 1.7), 2);
      g.position.y = 1.85 * (1 - fall);
      sticks.forEach((m, i) => {
        const r = m.userData.rest, s = scatter[i];
        m.position.set(r.x + s.dx * e, r.y * (1 - e) + 0.09 * e, r.z + s.dz * e);
        m.rotation.z = (m.userData.spin.z) + s.ry * e;
        m.rotation.x = Math.PI / 2 + m.userData.spin.x * 0.2 * (1 - e);
      });
    };
    if (silent) { apply(1); return; }
    this._mover('wood-crash', 1.1, apply, { delay });
    if (this.audio) this.audio.cue('crash', { delay: delay + 0.06 });
  }
  _woodOff() { if (this._woodGrp) this._woodGrp.visible = false; }

  /* ================= ROUND 5 · THE IMPACT HAS CONSEQUENCE =================
   * Sol, r4, 61.5-62.3: "the victim transitions from held horizontally to
   * already down, without visible collision, recoil, or consequence." Three
   * things were missing and this is the third: nothing on the floor answered
   * the body. A man dashed on stone throws the floor up. Seven flat puffs,
   * seeded (determinism law), bursting outward and up from the point of
   * contact and gone inside a second.
   *
   * THE PUFFS DO NOT RAYCAST. Dust is not an obstruction, and every
   * instrument in this lane — the [hit] path the reader clicks through, the
   * framecheck's occlusion ray, the [read] law's separation probe — reads
   * the scene with a raycaster. A cloud that answers those rays would be
   * telling all of them that the frame is blocked. It is drawn, not hit. */
  _dust() {
    if (!this._dustGrp) {
      const g = new THREE.Group();
      g.name = 'impact-dust';
      const rnd = mulberry32(71091);
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.20, 7, 5),
          new THREE.MeshBasicMaterial({ color: 0xd9c6ad, transparent: true,
            opacity: 0, depthWrite: false, toneMapped: false }));
        const a = (i / 7) * Math.PI * 2 + rnd() * 0.7;
        m.userData.dir = new THREE.Vector3(Math.cos(a), 0.30 + rnd() * 0.55,
          Math.sin(a)).normalize();
        m.userData.reach = 0.42 + rnd() * 0.46;
        m.userData.grow = 0.55 + rnd() * 0.80;
        m.raycast = () => {};
        g.add(m);
      }
      this._dustGrp = g;
    }
    if (this._dustGrp.parent !== this.stage.scene) this.stage.scene.add(this._dustGrp);
    return this._dustGrp;
  }
  /** the floor answers the body: a burst at `at`, alive for `dur` seconds */
  _dustBurst(at, { silent = false, delay = 0, dur = 0.95, scale = 1 } = {}) {
    if (silent) return;
    const g = this._dust();
    g.position.copy(at);
    const apply = (k) => {
      const e = easeOutCubic(clamp01(k));
      g.visible = k < 1;
      for (const m of g.children) {
        const d = m.userData;
        m.position.copy(d.dir).multiplyScalar(d.reach * scale * e);
        m.scale.setScalar((0.28 + d.grow * e) * scale);
        /* IT IS A PUFF OFF A FLOOR, NOT A SMOKE BOMB. Measured on the finished
           frame twice: the first pass eased its own alpha away inside three
           frames and there was no cloud at all; the second whited out the
           whole picture for the better part of a second. This one is knee
           high, it is thin, and it is gone in three quarters of a second. */
        m.material.opacity = 0.34 * Math.min(1, k * 14) * Math.pow(1 - k, 1.5);
      }
      if (k >= 1) g.visible = false;
    };
    apply(0);
    this._mover('impact-dust', dur, apply, { delay });
  }
  _dustOff() { if (this._dustGrp) this._dustGrp.visible = false; }

  /* THE OPENED DOOR'S OWN LIGHT. Round 3's slit was "too dark and brief to
   * land": the boulder rolled off a hole that had nothing behind it. The
   * night outside is now a real source — a cold pre-dawn wedge standing in the
   * aperture, plus the lamp that throws it across the floor — so the opening
   * READS as an opening, and the giant who sits down in it reads as a door
   * being blocked. */
  _slit() {
    if (!this._slitGrp) {
      const g = new THREE.Group();
      g.name = 'door-slit';
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x9fc4e8, transparent: true, opacity: 0,
          depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      /* stood in the mouth's own aperture, facing into the room */
      m.position.set(-7.95, 2.35, -1.15);
      m.scale.set(2.4, 5.2, 1);
      m.rotation.y = Math.PI / 2 + 0.10;
      g.add(m);
      const L = new THREE.PointLight(0xbcd8f5, 0, 30, 2);
      L.position.set(-6.6, 2.6, -1.15);
      g.add(L);
      this._slitGrp = g; this._slitBar = m; this._slitLight = L;
    }
    if (this._slitGrp.parent !== this.stage.scene) this.stage.scene.add(this._slitGrp);
    return this._slitGrp;
  }
  _slitAt(k, w = 1) {
    this._slit();
    this._slitBar.material.opacity = clamp01(k) * 0.95;
    this._slitBar.scale.x = Math.max(0.25, w);
    this._slitBar.visible = this._slitBar.material.opacity > 0.005;
    this._slitLight.intensity = clamp01(k) * 62;
    this.slitK = clamp01(k);
  }
  _slitTo(k, w, dur, { silent = false, delay = 0 } = {}) {
    const k0 = this.slitK || 0, w0 = this._slitBar ? this._slitBar.scale.x : 0.25;
    this._mover('slit', dur, (x) => {
      const e = easeInOut(x);
      this._slitAt(k0 + (k - k0) * e, w0 + (w - w0) * e);
    }, { silent, delay });
    this.slitK = k;
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
    /* WHERE AN OPEN DOOR PARKS (round 3). The old aside offset put the stone
       down at world (-2.6, -3.0) — the middle of the floor, one metre from the
       cheese-rack mark, and it stood in front of the men for the whole of Beat
       II's opening: Sol saw "near-identical empty cave compositions" because
       the bodies were behind a boulder. A door leans against the wall BESIDE
       its doorway. This offset rolls it north-west to (-5.6, -5.4), between
       the mouth and the first rack, where it belongs and where it blocks no
       sight line into the room. */
    b.position.set(h.p.x + 3.40 * e, h.p.y - 0.55 * e, h.p.z - 1.49 * e);
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
    this._seatArms(g, face);       /* whatever the last act did with his arms */
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
    /* ROUND 5 · A SLEEPER'S ARMS ARE NOT A SITTER'S ARMS.
       Sol, r4: "the 'eyes' shot is obscured by Polyphemus's hand." It was,
       and so were the blade and the stone — and the flight in Beat IV. The
       cause was one line that was never written: `_seatArms` aims his upper
       arms forward-and-down and his forearms back, which is a giant leaning
       over his milking; when the same rig is then laid on its side those
       aimed bones do not lie down with it, they stand OUT of the body — a
       seven-metre forearm across whatever lens is downstage. Every reverse
       west of the sprawl was photographing it. An aimed bone is permanent
       until something puts it back, so lying down puts it back: the bind
       pose's arms run along the body, and under this euler that is toward
       his own feet, on the floor, out of every sight line in the room. */
    this._restArms(g);
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
  /** where a man's sword hangs, live: his own hip, on his own facing */
  _hipOf(a) {
    if (!a || !a.group.visible) return null;
    const f = a.group.rotation.y;
    return new THREE.Vector3(a.group.position.x + Math.cos(f) * 0.30,
      a.group.position.y + 0.95, a.group.position.z - Math.sin(f) * 0.30);
  }
  _swordToHip() {
    const sw = this._prop('sword');
    const p = this._hipOf(this.stage.actors.get('ulysses'));
    if (!sw || !p) return;
    sw.position.copy(p);
    sw.rotation.set(0, this.stage.actors.get('ulysses').group.rotation.y - 0.6, 0.1);
  }

  /* ================= ROUND 5 · THE SCABBARD, AND THE DRAW =================
   * Sol, r4: "the hilt is never clearly grasped/drawn — the blade is already
   * present." It was: the book had no scabbard, so a sword at a man's hip was
   * a bare blade floating beside him from the moment he picked it up, and the
   * shot list's "the decision becomes a grip" had nothing to photograph. A
   * draw needs something to be drawn OUT OF.
   *
   * The sheath is authored here, not in PROP_PLAN, for the same reason the
   * firewood is: it is not a ledger object with a metre of its own, it is the
   * thing the ledger's 0.78 m xiphos lives in. It is built around the blade's
   * own axis (+X, the way createSword authors it) so "sheathed" is simply the
   * sword sitting at the scabbard's own place, and "drawn" is the sword slid
   * along that axis until the point clears the mouth.
   */
  _scabbard() {
    if (!this._scabGrp) {
      const g = new THREE.Group();
      g.name = 'scabbard';
      const hide = new THREE.MeshStandardMaterial({ color: 0x241309, roughness: 0.96,
        metalness: 0, flatShading: true });
      const band = new THREE.MeshStandardMaterial({ color: 0x6b5c3a, roughness: 0.6,
        metalness: 0, flatShading: true });
      /* the body: a four-sided sheath tapering to the chape, a hand longer
         than the blade so a sheathed sword shows only its hilt. IT HAS TO
         READ AS LEATHER, NOT AS A SECOND BLADE — the first pass was thin and
         pale and the insert came back with two swords in it. */
      const L = 0.62, W = 0.115, T = 0.062;
      const pos = [], idx = [];
      const ring = (x, w, t) => {
        const b = pos.length / 3;
        pos.push(x, 0, -w / 2, x, t / 2, 0, x, 0, w / 2, x, -t / 2, 0);
        return b;
      };
      /* barely tapered, and banded twice: a tapering sheath photographs as a
         second blade, which is what the first hilt insert came back with */
      const a0 = ring(0.02, W, T), a1 = ring(L * 0.6, W * 0.95, T * 0.95),
            a2 = ring(L, W * 0.86, T * 0.86);
      for (const [p, q2] of [[a0, a1], [a1, a2]])
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          idx.push(p + i, q2 + i, q2 + j, p + i, q2 + j, p + j);
        }
      const body = new THREE.Mesh(new THREE.BufferGeometry(), hide);
      body.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      body.geometry.setIndex(idx);
      body.geometry.computeVertexNormals();
      body.castShadow = true;
      g.add(body);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, T * 1.12, W * 1.1), band);
      mouth.position.x = 0.03;
      g.add(mouth);
      const chape = new THREE.Mesh(new THREE.BoxGeometry(0.05, T * 0.95, W * 0.95), band);
      chape.position.x = L - 0.02;
      g.add(chape);
      const ring2 = new THREE.Mesh(new THREE.BoxGeometry(0.028, T * 1.08, W * 1.06), band);
      ring2.position.x = L * 0.42;
      g.add(ring2);
      this._scabGrp = g;
    }
    if (this._scabGrp.parent !== this.stage.scene) this.stage.scene.add(this._scabGrp);
    return this._scabGrp;
  }
  /** where the sheath hangs: exactly where the sheathed sword hangs */
  _scabToHip() {
    const u = this.stage.actors.get('ulysses');
    const p = this._hipOf(u);
    const sc = this._scabbard();
    if (!p || !u) { sc.visible = false; return null; }
    sc.visible = true;
    sc.position.copy(p);
    sc.rotation.set(0, u.group.rotation.y - 0.6, 0.1);
    return sc;
  }
  /** the sword rides the hip IN its sheath — both follow the man who walks */
  _sheatheAtHip(dur = 6.0) {
    const sw = this._prop('sword');
    if (sw) sw.visible = true;
    this.swordOut = false;
    this._scabToHip();
    this._swordToHip();
    this._mover('sword-ride', dur, () => {
      if (this.swordOut) return;
      this._scabToHip(); this._swordToHip();
    });
  }
  /** the sheath's own +X in world — the only direction a blade may leave it */
  _scabAxis() {
    const sc = this._scabbard();
    return new THREE.Vector3(1, 0, 0).applyQuaternion(sc.quaternion).normalize();
  }
  /** the fist that holds the hilt, live off the rig — so a drawn blade is in
   *  a HAND and not floating a foot from one */
  _handOf(a) {
    if (!a || !a.group.visible) return null;
    const b = this._bones(a);
    const k = Object.keys(b).find((n) => /^r[_.-]?hand$/i.test(n))
      || Object.keys(b).find((n) => /hand/i.test(n) && /^r/i.test(n));
    if (!k) return null;
    a.group.updateWorldMatrix(true, true);
    return b[k].getWorldPosition(new THREE.Vector3());
  }
  /** where the point hangs when the blade is up: over the measured throat */
  _vitalsPoint() {
    const f = FRAMES.cave;
    return new THREE.Vector3(f.X(CAVE_MARKS.swordVitals[0]), 1.95,
      f.Z(CAVE_MARKS.swordVitals[1]));
  }
  /** the blade's attitude when it hangs over him, edge down */
  _vitalsQuat() {
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-0.16, -0.97, 0.18).normalize());
  }
  /**
   * THE DRAW: the hand closes on the hilt at the hip, PULLS, and carries the
   * point up over the sleeping throat — one continuous act, because the three
   * things the line names ("seize my sword, draw it, and drive it into his
   * vitals") are one movement and round 4 had the last of them living in the
   * GATE, which fires whenever the reader's thumb happens to fall. The gate
   * still owns the ending: the story takes the stroke back.
   */
  _drawFromHip({ silent = false, delay = 0, dur = 2.05 } = {}) {
    const sw = this._prop('sword');
    const u = this.stage.actors.get('ulysses');
    if (!sw || !u) return;
    sw.visible = true;
    const CLEAR = 0.62;                      /* how far the point has to travel */
    const hi = this._vitalsPoint(), down = this._vitalsQuat();
    const settle = () => {
      this.swordOut = true;
      this._scabToHip();
      sw.position.copy(hi);
      sw.quaternion.copy(down);
      if (sw.userData.glint) sw.userData.glint.emissiveIntensity = 4.3;
    };
    if (silent) { settle(); return; }
    /* the sheath stops moving the instant the hand touches it: a man draws
       against a fixed hip, and a hilt that slides while the fist is on it is
       the tell that nothing was ever grasped */
    this.movers = this.movers.filter((m) => m.id !== 'sword-ride');
    const clear = new THREE.Vector3(), q1 = new THREE.Quaternion();
    const apply = (k) => {
      const sc = this._scabToHip();
      if (!sc) return;
      const ax = this._scabAxis();
      /* 0 → .26   the fist arrives on the hilt
         .26 → .62 the pull: the blade climbs out, the point last
         .62 → 1   clear of the mouth, and up over the sleeping throat */
      const out = k < 0.26 ? 0 : k < 0.62 ? CLEAR * easeInOut((k - 0.26) / 0.36) : CLEAR;
      const up = k < 0.62 ? 0 : easeInOut((k - 0.62) / 0.38);
      /* the drawn hilt sits IN THE FIST when the rig has one to read */
      clear.copy(sc.position).addScaledVector(ax, out);
      const fist = out > 0.05 ? this._handOf(u) : null;
      if (fist) clear.lerp(fist, Math.min(0.85, (out / CLEAR) * 0.85));
      sw.position.lerpVectors(clear, hi, up);
      q1.setFromEuler(new THREE.Euler(0, u.group.rotation.y - 0.6, 0.1));
      sw.quaternion.slerpQuaternions(q1, down, up);
      if (sw.userData.glint)
        sw.userData.glint.emissiveIntensity = 1.2 + 3.1 * clamp01(out / CLEAR * 0.6 + up * 0.4);
      /* THE HAND, built out of HIS axes — an arm aimed along world +X is a
         man reaching for whatever happens to be east of him, and this rig
         turns twice in this leaf. Down and across to his own hip, and it
         stays on the hilt while the blade climbs. */
      const f = u.group.rotation.y;
      const rgt = [Math.cos(f), 0, -Math.sin(f)];
      const fwd = [Math.sin(f), 0, Math.cos(f)];
      const mix = (r2, uy, f2) => [rgt[0] * r2 + fwd[0] * f2, uy, rgt[2] * r2 + fwd[2] * f2];
      const reach = clamp01(k / 0.26);
      const o = out / CLEAR;
      this._arms(u, {
        R_Upperarm: mix(0.20 * reach, -0.94 + 0.40 * o + 0.44 * up, 0.14 * reach + 0.30 * o + 0.36 * up),
        R_Forearm: mix(0.36 * reach, -0.80 + 0.86 * o + 0.62 * up, 0.30 * reach + 0.46 * o + 0.30 * up),
      });
    };
    this._mover('hilt-draw', dur, apply, { delay, onDone: settle });
  }
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

  /* ================= ROUND 3 · THE TWO THINGS THAT WERE NEVER STAGED =======
   * Sol's Beat II note is not about the camera: "0:00–0:16 cycles through
   * near-identical empty cave, fire and boulder compositions. NOTHING ACTS,
   * DISCOVERS OR REACTS." He is right, and the ledger was honest — the leaf
   * said `cheese-rack` and all that act did was PARK four bodies at a mark.
   * The text says the men stole the cheeses and were stopped; nothing in the
   * scene graph ever picked a cheese up. Same at Beat IV 23–41 s: the leaf
   * says the neighbours gather at the stone and go away again, and the set
   * had no light for them to carry, so five shots photographed a shut rock.
   * Behaviour has to EXIST before a lens can find it.
   * ====================================================================== */

  /** THE STOLEN CHEESE — a wheel off the rack, carried in a man's arms, and
   *  dropped where he drops it. Parented into the body, so it walks with him;
   *  the spill group is the director's, so a re-seek cannot leave two. */
  _cheese(a, on, { silent = false } = {}) {
    if (!a) return;
    if (on && !a.__cheese) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.185, 0.20, 0.135, 16),
        new THREE.MeshStandardMaterial({ color: 0xf6e6bc, roughness: 0.88, metalness: 0 }));
      m.rotation.set(Math.PI / 2, 0, 0);   /* the flat face out, to the lens */
      m.position.set(0.05, 1.14, 0.30);    /* held against the chest, arms round it */
      m.castShadow = true;
      m.name = 'stolen-cheese';
      a.group.add(m);
      a.__cheese = m;
    }
    if (a.__cheese) a.__cheese.visible = !!on;
    void silent;
  }
  /** the wheels hit the floor when the men bolt — the visible consequence of
   *  a man dropping what he was stealing */
  _dropCheeses(silent = false) {
    if (!this._spill) {
      this._spill = new THREE.Group();
      this._spill.name = 'dropped-cheeses';
    }
    if (this._spill.parent !== this.stage.scene) this.stage.scene.add(this._spill);
    for (const a of this._crew(CREW_POOL)) {
      const c = a && a.__cheese;
      if (!c || !c.visible) continue;
      const w = c.getWorldPosition(new THREE.Vector3());
      a.group.remove(c);
      a.__cheese = null;
      this._spill.add(c);
      c.rotation.set(Math.PI / 2, 0, 0.5 + this._spill.children.length * 0.4);
      c.position.copy(w);
      const y0 = w.y;
      this._mover('cheese-drop-' + a.id, 0.5, (k) => {
        c.position.y = y0 + (0.085 - y0) * easeInOut(k);
      }, { silent });
    }
  }
  _clearSpill() {
    if (!this._spill) return;
    for (const c of this._spill.children.slice()) this._spill.remove(c);
  }

  /** THE NEIGHBOURS' LAMPS. They are never seen — the reader is inside — so
   *  they exist as light in the cracks of the shut stone: a vertical arc of
   *  slivers round the boulder's rim that gathers, holds, and then RECEDES
   *  westward and dies, which is the only way "then they went away" can be a
   *  picture instead of a caption. */
  _seamRig() {
    if (!this._seams) {
      const g = new THREE.Group();
      g.name = 'neighbour-lamps';
      const geo = new THREE.PlaneGeometry(1, 1);
      /* the arc is measured off the shut stone: x just inside the rim, the
         slivers climbing its west shoulder from floor to crown */
      /* MEASURED OFF THE STONE, NOT GUESSED. The shut boulder's own mass runs
         x -10.9..-4.9: bars authored at x -8.5 were buried INSIDE it and the
         first render of this rig photographed a rock with nothing on it. They
         belong a hand's breadth proud of its EAST face, where a crack would
         actually show, in a line up its downstage shoulder. */
      const arc = [[-4.78, 0.45, -4.30, 0.17, 0.80], [-4.80, 1.35, -4.62, 0.14, 1.35],
        [-4.82, 2.35, -4.40, 0.19, 1.70], [-4.80, 3.35, -3.75, 0.15, 1.35],
        [-4.78, 4.05, -2.80, 0.13, 1.05], [-4.76, 3.40, -1.60, 0.15, 1.45],
        [-4.74, 2.20, -0.95, 0.14, 1.25], [-4.72, 1.05, -1.10, 0.17, 0.85]];
      for (const [x, y, z, w, h] of arc) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xffe0a8, transparent: true, opacity: 0, depthWrite: false,
          toneMapped: false, side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.scale.set(w, h, 1);
        m.rotation.y = Math.PI / 2 + 0.18;    /* facing into the room */
        g.add(m);
      }
      const L = new THREE.PointLight(0xffc477, 0, 9, 2);
      L.position.set(-5.6, 2.3, -2.8);
      g.add(L);
      this._seams = g;
      this._seamLight = L;
    }
    if (this._seams.parent !== this.stage.scene) this.stage.scene.add(this._seams);
    return this._seams;
  }
  /** k 0..1 how bright the crowd outside is · slide −1..1 where it stands */
  _seamsAt(k, slide = 0) {
    const g = this._seamRig();
    const bars = g.children.filter((c) => c.isMesh);
    bars.forEach((m, i) => {
      /* the crowd is a MOVING pool of lamps: each sliver answers the slide, so
         the light travels along the rim instead of just fading in place */
      const at = (i / (bars.length - 1)) * 2 - 1;
      const w = Math.max(0, 1 - Math.abs(at - slide) * 1.15);
      m.material.opacity = clamp01(k) * (0.30 + 0.70 * w);
      m.visible = m.material.opacity > 0.004;
    });
    if (this._seamLight) this._seamLight.intensity = clamp01(k) * 14;
    this.seamK = clamp01(k);
  }
  _seamsTo(k, slide, dur, { silent = false, delay = 0 } = {}) {
    const k0 = this.seamK || 0, s0 = this.seamSlide || 0;
    this._mover('seams', dur, (x) => {
      const e = easeInOut(x);
      this._seamsAt(k0 + (k - k0) * e, s0 + (slide - s0) * e);
    }, { silent, delay });
    this.seamK = k; this.seamSlide = slide;
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
      /* the leaf's own park puts the party in the mouth for the heading wide;
         this act owns the HOUR and clears what the last read left lying about */
      'cave-dawn': (silent) => {
        S._grade('cave-dawn', silent); S._clearSpill(); S._seamsAt(0);
        S._slitAt(0); S._woodOff(); S._dustOff();  /* the hour owns what the last read left */
      },
      'cave-shut': (silent) => S._grade('cave-shut', silent),
      'cave-embers': (silent) => { S._grade('cave-embers', silent); S._giantSprawl(silent); },
      /* ================= ROUND 4 · THE FIRST MEAL =================
         Sol: "the dramatic climax still fails as action: giant → isolated man
         → static reaction. There is no readable clutch, lift, impact, or
         consequence." He was right down to the scene graph: the leaf's act was
         `cave-embers`, which grades the hour and lays the giant down — the
         seize was a WORD. Measured at 1.0 s into the shot, round 3's frame had
         the giant ALREADY SPRAWLING while the line said he was killing a man.
         The verb is now performed, as one continuous arc on one man, so a
         single lens can hold all of it:
             reach · clutch · LIFT off the floor · aloft, kicking · dashed down
         and the sprawl is pushed to the far side of it, where the text puts
         it. The object of the verb — the man — is visible the whole way.   */
      'first-meal': (silent) => {
        S._grade('cave-embers', silent);
        const crew = S._aliveCrew();
        const victim = crew[crew.length - 1] || crew[0];
        const rest = crew.filter((c) => c !== victim);
        if (silent) {
          /* a replayed lap must land where a read lap left it: the man is
             taken, the giant is down — AND ULYSSES IS AT HIS SWORD, because
             on a read lap the crossing leaves under this leaf and lands
             inside it. Round 4 left him back at the lie mark on a replay, so
             every instrument that seeks (the marks probe, the frame check)
             was measuring a man walking while the film had him standing. */
          if (victim) S._off(victim);
          S.meals = Math.max(S.meals, 1);
          S._giantSprawl(true);
          S._stand(A('ulysses'), caveAt(...CAVE_MARKS.sword),
            Math.atan2(caveAt(...CAVE_MARKS.swordVitals).x - caveAt(...CAVE_MARKS.sword).x,
              caveAt(...CAVE_MARKS.swordVitals).z - caveAt(...CAVE_MARKS.sword).z));
          return;
        }
        const g = S._giantOn();
        const grab = caveAt(...CAVE_MARKS.seizeGrab);
        const aloft = caveAt(...CAVE_MARKS.seizeAloft);
        const dash = caveAt(...CAVE_MARKS.seizeDash);
        /* THE REACH — he turns on them and comes forward. AIMING THE ARM WAS
           TRIED AND MEASURED: a limb on a seven-metre rig fills any lens close
           enough to see the man it is reaching for, and every frame of round
           4's first pass came back as one white forearm. The lunge is carried
           by the WHOLE BODY instead — the yaw swings at them, the mass grows —
           and the verb is read off the man, which is where it belongs. */
        if (g) {
          const f0 = g.face, s0 = g.baseScale * g.local;
          const face = Math.atan2(grab.x - g.group.position.x, grab.z - g.group.position.z);
          S._mover('reach', 1.45, (k) => {
            const e = easeInOut(k);
            g.group.rotation.y = f0 + (face - f0) * 0.62 * e;
            g.model.scale.setScalar(s0 * (1 + 0.055 * Math.sin(Math.PI * clamp01(k))));
          }, { owner: g.id });
        }
        if (victim) {
          const from = victim.group.position.clone();
          victim.walk = null; victim.mode = 'pose'; victim.group.visible = true;
          const q0 = victim.group.quaternion.clone();
          const flail = new THREE.Quaternion();
          /* ============ ROUND 5 · THE COLLISION ============
             Sol, r4: "Clutch and lift read; impact does not. The victim
             transitions from held horizontally to already down, without
             visible collision, recoil, or consequence."
               The arc was there; three things hid it. The lens was anchored
             to the LIVE body, so it tilted down WITH the fall and cancelled
             it (that is the bake's business, and CV-GRIP is locked to a mark
             now). The drop was 0.45 s from 1.45 m — a lower fall than a man
             can take standing up. And the giant lay down 0.15 s after it, so
             the frame's whole content changed on the very frame the eye was
             asked to read a hit.
               So: he is carried HIGHER, there is a WIND-UP the eye can
             anticipate, the fall is a real parabola out of it, and the
             ground arrives on a frame this file names — T_HIT — which is
             also the frame the shake, the dust and the boom are written to.
             Then the body ANSWERS it: a small bounce, an overshoot in the
             roll, and a settle. The giant does not lie down for another
             second, and the man is not taken off the floor until the cut. */
          const T_HIT = 3.40, SEIZE = 3.98;
          const AL_Y = 2.30, WIND_Y = 2.66;
          S._mover('seize', SEIZE, (k) => {
            const t = k * SEIZE;
            let p, y, roll;
            if (t < 1.05) {                       /* DRAGGED to the hand */
              const e = easeInOut(t / 1.05);
              p = from.clone().lerp(grab, e); y = 0; roll = 0.10 * e;
            } else if (t < 1.45) {                /* CLUTCHED — held, jerked */
              p = grab.clone(); y = 0.16 * easeInOut((t - 1.05) / 0.40);
              roll = 0.10 + 0.22 * easeInOut((t - 1.05) / 0.40);
            } else if (t < 2.40) {                /* LIFTED clean off the floor */
              const e = easeInOut((t - 1.45) / 0.95);
              p = grab.clone().lerp(aloft, e); y = 0.16 + (AL_Y - 0.16) * e;
              roll = 0.32 + 0.62 * e;
            } else if (t < 2.78) {                /* ALOFT, kicking */
              p = aloft.clone(); y = AL_Y + 0.06 * Math.sin((t - 2.40) * 26);
              roll = 0.94 + 0.10 * Math.sin((t - 2.40) * 21);
            } else if (t < 2.98) {                /* THE WIND-UP — reared back */
              const e = easeInOut((t - 2.78) / 0.20);
              p = aloft.clone().lerp(grab, -0.18 * e);
              y = AL_Y + (WIND_Y - AL_Y) * e;
              roll = 0.94 - 0.30 * e;
            } else if (t < T_HIT) {               /* THE ARC DOWN — gravity */
              const e = (t - 2.98) / (T_HIT - 2.98);
              p = aloft.clone().lerp(grab, -0.18).lerp(dash, e);
              y = WIND_Y - (WIND_Y - 0.14) * e * e;      /* a true parabola */
              roll = 0.64 + (Math.PI / 2 - 0.64) * easeOutCubic(e);
            } else {                              /* THE RECOIL, then still */
              const b = (t - T_HIT) / (SEIZE - T_HIT);
              const bounce = Math.exp(-b * 7.5) * Math.abs(Math.sin(b * 9.2));
              p = dash.clone();
              y = 0.10 + 0.19 * bounce;
              roll = Math.PI / 2 + 0.26 * Math.exp(-b * 5.0) * Math.sin(b * 12.0);
            }
            victim.group.position.set(p.x, y, p.z);
            flail.setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
            victim.group.quaternion.copy(q0).multiply(flail);
          }, { owner: victim.id });
          /* THE FRAME THE HIT HAPPENS ON. The room jumps, the floor throws
             up, and the boom is asked for on this exact sim second — the
             mixer lays a cue by its TRANSIENT now, so picture and sound land
             together instead of the rumble arriving a second and a half
             late (which is what "the hit arrives after the victim is already
             down" was: a 1.15 s ramp on the head of boulder-boom). */
          S._mover('dash-hit', 0.01, () => {
            S.shake = { t0: S.t, amp: 0.34, dur: 0.85 };
            S._dustBurst(new THREE.Vector3(dash.x, 0.05, dash.z), { scale: 0.85, dur: 0.78 });
            if (S.audio) S.audio.cue('boulder-boom', { gain: 0.9 });
          }, { delay: T_HIT });
          /* he is not carried off until the cut leaves him: the body stays
             on the stone through the whole recoil, which is the consequence */
          S._mover('meal-done', 0.01, () => {
            S._off(victim); S.meals = Math.max(S.meals, 1);
          }, { delay: 5.05 });
        }
        /* the two who are left back away and TURN TO WATCH — the faces the
           reaction shot is cut to have to be facing the thing */
        rest.forEach((c, i) => {
          const p = c.group.position.clone();
          const away = p.clone().sub(grab).setY(0).normalize().multiplyScalar(0.85);
          const to = p.clone().add(away);
          const face = Math.atan2(grab.x - to.x, grab.z - to.z);
          c.walk = null;
          S._mover('recoil-' + c.id, 0.9, (k) => {
            const e = easeInOut(k);
            c.group.position.lerpVectors(p, to, e);
            c.group.rotation.set(0, face, 0);
          }, { delay: 1.35 + 0.12 * i, owner: c.id });
        });
        /* …and only THEN does he lie down — a full second past the impact,
           so the collision is not swamped by seven metres of body arriving
           in the same frame (round 4 put the sprawl 0.15 s after the hit and
           the eye read the sprawl, not the hit) */
        S._mover('meal-sprawl', 0.01, () => S._giantSprawl(false), { delay: 4.45 });
        /* AND ULYSSES BREAKS FOR HIS SWORD WHILE IT HAPPENS.
           THE CROSSING IS THIRTEEN METRES, NOT SIX. The corridor cannot go
           west along the south wall — the firewood box owns that floor — so
           the audited route to the sword mark climbs north around the racks
           and the fire and comes back down: 13.4 m of walking. Round 4
           launched it when the giant lay down and Ulysses was therefore
           STILL WALKING through the whole of the sword leaf, which is why
           the hilt insert photographed a man crossing a room. He leaves when
           the man is taken — which is also when a man would — and he is
           standing on the mark before the leaf that draws the blade. */
        S._mover('to-the-sword', 0.01, () => {
          const u2 = A('ulysses');
          /* a fast reader may already be on the sword leaf, which starts the
             same crossing: two of them would teleport him back to the fire */
          if (!u2 || u2.walk ||
              u2.group.position.distanceTo(caveAt(...CAVE_MARKS.sword)) < 1.2) return;
          S._walkRoute(u2, [734, 500], CAVE_MARKS.sword,
            { speed: 2.90, via: CAVE_MARKS.swordVia, label: 'cave:lie->sword' });
          S._sheatheAtHip(7.5);
        }, { delay: 1.35 });
      },
      /* ============= ROUND 5 · THE LINEUP, BROKEN =============
         Round 3 closed Beat II on CV-AFTER — 6 % of that frame had a body in
         it. Round 4 put the survivors in the frame and Sol, r4: "they hold
         neutral, nearly frozen poses. No flinch, clutch, sob, recoil, or
         exchanged horrified look; it reads as a lineup, not horror."

         He is describing a `_cluster` — a seeded RING at one radius round one
         mark, every man given the same two aimed arms and the same yaw at the
         same door. Four identical postures at one depth is a police lineup
         whatever the light is doing, and the cast has fixed faces, so horror
         here can only be POSE, BLOCKING and LIGHT.

         So the men are hand-placed at four different DEPTHS, given three
         different bodies —
             one down on his heels with his arms over his head,
             one with both hands on the man beside him, holding on,
             one backed off a step with his weight on his back foot,
         Ulysses apart and upright behind them — and then they MOVE: every
         head turns to the thing in the dark first, and then, one after
         another, to EACH OTHER. That sequence of turns is the exchanged look.
         Under all of it a small tremble, and the fire breathing. */
      'sob-till-morning': (silent) => {
        const men = S._aliveCrew();
        const u = A('ulysses');
        const sw = S._prop('sword');
        if (sw) sw.visible = false;
        if (S._scabGrp) S._scabGrp.visible = false;
        /* the flock is back in its pen for the night — and out of the reverse
           the exchanged look is cut on, which a ram was standing in front of */
        [[1004, 480], [1036, 490], [1066, 476], [1012, 500]].forEach(([px, py], i) => {
          const e = A('ewe-' + i);
          if (e) S._stand(e, caveAt(px, py), -1.9 + 0.2 * i);
        });
        S.swordLive = false; S.swordOut = false;
        S._dustOff();

        /* the four marks: a huddle in DEPTH, west to east, not a ring */
        const MARKS = [[900, 552], [936, 540], [957, 527]];   /* the three men */
        const U_MARK = [913, 521];                            /* and their captain */
        const giant = caveAt(786, 531);          /* the thing in the dark, off left */
        const yawTo = (p, t) => Math.atan2(t.x - p.x, t.z - p.z);

        const at = MARKS.map(([px, py]) => caveAt(px, py));
        const uAt = caveAt(...U_MARK);
        const faces = [...at, uAt];
        men.forEach((c, i) => S._stand(c, at[i % at.length], yawTo(at[i % at.length], giant)));
        if (u) S._stand(u, uAt, yawTo(uAt, giant));
        if (silent) return;                      /* a replay gets the blocking */

        /* ---- three different bodies ---- */
        const [a0, a1, a2] = men;
        /* 1 · DOWN ON HIS HEELS, arms over his head — the man who cannot look */
        if (a0) {
          const p = a0.group.position.clone();
          S._mover('sob-crouch', 0.75, (k) => {
            const e = easeInOut(k);
            a0.group.position.set(p.x, -0.52 * e, p.z);
            a0.group.rotation.x = 0.30 * e;
            S._arms(a0, { L_Upperarm: [0.52, 0.60, -0.34], R_Upperarm: [-0.52, 0.60, -0.34],
                          L_Forearm: [0.20, 0.86, -0.44], R_Forearm: [-0.20, 0.86, -0.44] });
          }, { owner: a0.id });
        }
        /* 2 · HOLDING ON to the man beside him */
        if (a1 && a2) {
          const to = a2.group.position.clone().sub(a1.group.position).setY(0).normalize();
          S._mover('sob-clutch', 0.85, (k) => {
            const e = easeInOut(k);
            a1.group.rotation.z = 0.10 * e;
            S._arms(a1, { L_Upperarm: [to.x * 0.86 * e, -0.42, to.z * 0.86 * e],
                          R_Upperarm: [to.x * 0.70 * e, -0.56, to.z * 0.70 * e],
                          L_Forearm: [to.x * 0.94 * e, -0.12, to.z * 0.94 * e],
                          R_Forearm: [to.x * 0.88 * e, -0.26, to.z * 0.88 * e] });
          }, { owner: a1.id });
        }
        /* 3 · THE BACK-STEP — he goes away from it, weight on the back foot */
        if (a2) {
          const p = a2.group.position.clone();
          const away = p.clone().sub(giant).setY(0).normalize().multiplyScalar(0.42);
          const to = p.clone().add(away);
          S._mover('sob-recoil', 0.70, (k) => {
            const e = easeOutCubic(k);
            a2.group.position.lerpVectors(p, to, e);
            a2.group.rotation.x = -0.16 * e;
            S._arms(a2, { L_Upperarm: [0.62 * e, -0.18, 0.44 * e],
                          R_Upperarm: [-0.62 * e, -0.18, 0.44 * e],
                          L_Forearm: [0.34 * e, 0.62 * e, 0.52 * e],
                          R_Forearm: [-0.34 * e, 0.62 * e, 0.52 * e] });
          }, { owner: a2.id });
        }
        /* ---- THE EXCHANGED LOOK: to the dark, then to each other, in turn.
           A head turn is the only expression a fixed face has, and four of
           them arriving one after another is the horror going round. ---- */
        const bodies = [...men, u].filter(Boolean);
        bodies.forEach((c, i) => {
          const p = c.group.position;
          const y0 = yawTo(p, giant);
          /* who each man looks to when he stops looking at it */
          const other = faces[(i + 1) % faces.length];
          const y1 = yawTo(p, other);
          const d = ((y1 - y0 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          const t0 = 0.34 + 0.30 * i;
          S._mover('sob-turn-' + c.id, 1.15, (k) => {
            const e = easeInOut(clamp01((k * 1.15 - 0.30) / 0.52));
            /* the tremble is not decoration: it is the only thing in the
               frame that says these bodies are not statues */
            const tr = Math.sin(S.t * 13.7 + i * 2.1) * 0.014
                     + Math.sin(S.t * 23.3 + i) * 0.008;
            c.group.rotation.y = y0 + d * e + tr;
            c.group.position.x = p.x + Math.sin(S.t * 17.3 + i * 1.7) * 0.010;
          }, { delay: t0, owner: c.id });
        });
        /* ---- and the fire breathes over all of it ---- */
        S._mover('sob-flicker', 2.6, () => {
          S.fireFlicker = 1 + 0.11 * Math.sin(S.t * 8.3) + 0.07 * Math.sin(S.t * 17.9 + 1.2);
        }, { onDone: () => { S.fireFlicker = 1; } });
      },
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
      /* THE THEFT (Sol II #1: "men stealing cheese"). They stand at the racks
         with a wheel each already in their arms, on the audited corridor, and
         Ulysses is planted between them and the daylight — the whole tragedy
         of the chapter is that tableau, and it was never staged. */
      'cheese-steal': (silent) => {
        S._clearSpill();
        const crew = S._aliveCrew();
        const spots = S._cluster(caveAt(716, 402), crew.length, 71041, 1.05);
        crew.forEach((c, i) => {
          S._stand(c, spots[i], i === 0 ? -3.0 : 0.12 + 0.10 * i);
          S._cheese(c, true, { silent });
        });
        S._crew(CREW_POOL).slice(crew.length).forEach((c) => { S._cheese(c, false); S._off(c); });
        S._stand(A('ulysses'), caveAt(586, 410), 1.62);   /* barring the way out */
      },
      /* THE STOP AT THE ENTRANCE (Sol II #1: "stopping at the entrance"). They
         start for the door with the cheeses and are halted a stride short of
         the man who will not listen to them. The walk is the corridor's own. */
      'cheese-halt': (silent) => {
        const crew = S._aliveCrew();
        crew.forEach((c, i) => S._walkRoute(c, [716 + (i - 1) * 16, 402],
          [648 + i * 15, 404], { silent, delay: 0.18 * i, label: 'cave:for-the-door' }));
        S._stand(A('ulysses'), caveAt(586, 410), 1.62);
      },
      /* ================= ROUND 4 · THE RETURN =================
         "When he came, he brought in with him a huge load of dry firewood…
         which he flung down with such a noise that we were frightened."
         Round 3 photographed that line as an EMPTY DOORWAY — measured: zero
         bodies on screen at 2.6 s and at 5.0 s of the shot. The act was called
         `huddle-far` and all it did was run the men into the dark, which is
         the REACTION to an event that never happened. Four things happen here
         now, in order, so that each of them can be a shot:
           the giant walks in under the load · the load is flung down and the
           sticks burst apart · the men bolt and their stolen cheeses hit the
           floor · the flock comes in behind him.                            */
      'giant-return': (silent) => {
        const g = S._giant('walk');
        if (g) {
          if (silent) {
            S._stand(g, caveAt(...CAVE_MARKS.woodCarry), -1.1);
          } else {
            S._stand(g, caveAt(...CAVE_MARKS.mouth), -1.25);
            S._walkRoute(g, CAVE_MARKS.mouth, CAVE_MARKS.woodCarry,
              { speed: GIANT_MPS * 0.62, label: 'cave:return' });
          }
        }
        /* THE LOAD RIDES HIM IN. It is carried on the shoulder while he walks
           (a mover that reads his own position each tick — no parenting, so a
           re-seek can never leave a bundle inside a body), and it comes off at
           the mark. */
        const drop = caveAt(...CAVE_MARKS.woodDrop);
        if (silent) {
          S._woodAt(drop, 0, 0.6); S._woodCrash(true);
        } else {
          S._woodAt(caveAt(...CAVE_MARKS.mouth), 3.05, 0.35);
          S._mover('wood-carry', 2.5, () => {
            const w = S._wood();
            if (g && g.group.visible) {
              w.position.set(g.group.position.x + 0.55, 3.05, g.group.position.z + 0.35);
              w.rotation.y = g.group.rotation.y + 0.4;
            }
          });
          /* …and then it is FLUNG DOWN: the group falls, the sticks burst */
          S._mover('wood-place', 0.01, () => {
            const w = S._wood();
            w.position.set(drop.x, 1.85, drop.z);
          }, { delay: 2.5 });
          S._woodCrash(false, 2.52);
        }
        /* THE MEN BOLT — and the wheels they stole hit the floor with them */
        S._dropCheeses(silent);
        const rnd = mulberry32(71051);
        S._aliveCrew().forEach((c, i) => {
          const tx = CAVE_MARKS.huddle[0] + (rnd() - 0.5) * 56;
          const ty = CAVE_MARKS.huddle[1] + (rnd() - 0.5) * 18;
          S._walkRoute(c, [604 + (i % 4) * 24, 396 + (i % 3) * 6], [tx, ty],
            { speed: SCURRY_MPS, silent, delay: silent ? 0 : 2.6 + 0.14 * i,
              label: 'cave:scatter' });
        });
        S._walkRoute(A('ulysses'), [610, 412], CAVE_MARKS.huddle,
          { speed: SCURRY_MPS, silent, delay: silent ? 0 : 2.7, label: 'cave:scatter-u' });
        /* THE FLOCK COMES IN BEHIND HIM — "he drove all the ewes inside" */
        [[985, 548], [1022, 556], [1058, 544], [948, 562]].forEach(([px, py], i) => {
          const e = A('ewe-' + i);
          if (!e) return;
          if (silent) { S._stand(e, caveAt(px, py), -1.9 + 0.2 * i); return; }
          S._stand(e, caveAt(372, 446 + i * 6), -1.5);
          S._walkRoute(e, [372, 446 + i * 6], [px, py],
            { speed: 1.35, delay: 3.1 + 0.5 * i, label: 'cave:flock-in' });
        });
      },
      'giant-seat': () => { S._woodOff(); S._seatGiant(); },
      suppliant: (silent) => {
        /* HE HAS TO ARRIVE INSIDE HIS OWN LINE. At walking pace the kneel took
           longer than the plea, so the reverse angle was cut on a man still
           four metres upstage of the mark it was framed for, and the giant ate
           the frame. A suppliant crosses a floor faster than that.
           ROUND 4: and then he DOES THE THING. Sol: "Ulysses never delivers a
           legible supplicant action — no held open arms or arrival at the
           knees." He now arrives, goes down, and holds his arms open for the
           whole of the plea, so any lens pointed at him photographs a man
           begging rather than a man standing. */
        const to = CAVE_MARKS.suppliant;
        S._walkRoute(A('ulysses'), CAVE_MARKS.huddle, to,
          { speed: 1.75, silent, label: 'cave:huddle->suppliant' });
        const u = A('ulysses');
        const at = caveAt(...to);
        const face = caveAt(...CAVE_MARKS.giantSeat).sub(at);
        if (silent) { S._stand(u, at, Math.atan2(face.x, face.z)); S._kneelOpen(u, face, { silent: true }); return; }
        /* the kneel is armed for the moment the walk lands, not for a guess:
           the route is ~2.0 m at 1.75 m/s, so it is his own arrival time */
        S._mover('suppliant-land', 0.01, () => {
          if (u) { u.walk = null; u.group.position.copy(at); }
          S._kneelOpen(u, face, { dur: 0.85 });
        }, { delay: 1.35 });
      },
      /* PHASE 2 OF THE STANDOFF (Sol II #2). A shot/reverse that never changes
         the distance between two bodies is coverage; the relation has to move.
         He kneels at four metres to beg, and then — to sell the wrecked-ship
         lie — he WALKS IN to under three, which is what makes the giant's own
         reach, one unit later, land on a man who came to him. */
      'advance-lie': (silent) => {
        S._walkRoute(A('ulysses'), CAVE_MARKS.suppliant, [734, 500],
          { silent, label: 'cave:suppliant->lie' });
      },
      /* ================= ROUND 4 · THE SWORD SENTENCE =================
         hilt → blade at the vitals → his eyes → the stone. Round 3 could not
         render it because the mark it was played on lay across the sprawl and
         outside the camera volume; the sentence existed only in the cut list.
         He now crosses to the giant's CROWN (CAVE_MARKS.sword), which is open
         floor with the door behind it, and the blade he draws is held over the
         measured throat — so the second image in the sentence is an object at
         a place on a body, not a torso.                                     */
      /* ================= ROUND 5 · THE DRAW IS THE VERB =================
         Sol, r4: "the hilt is never clearly grasped/drawn — the blade is
         already present." Two faults under one sentence. There was no
         scabbard, so nothing could be drawn from anything; and the leaf's
         own act only started a THIRTEEN-METRE crossing (the corridor cannot
         run west along the firewood), so the hilt insert was cut on a man
         still walking. The crossing now leaves under the meal — he goes when
         the man is taken — and this leaf performs the two verbs the line
         actually names: SEIZE the sword, and DRAW it. The reader's press
         performs the third, and the story refuses it.                     */
      'sword-ulysses': (silent) => {
        const u = A('ulysses');
        /* the crossing was launched by the meal; this leaf only guarantees
           the arrival (a silent replay takes it whole — a replay has no
           seconds to walk in) */
        const walking = u && u.walk;
        const near = u && u.group.position.distanceTo(caveAt(...CAVE_MARKS.sword)) < 1.2;
        if (silent || (!walking && !near))
          S._walkRoute(u, [734, 500], CAVE_MARKS.sword,
            { speed: 2.90, silent, via: CAVE_MARKS.swordVia, label: 'cave:lie->sword' });
        S.swordLive = true;
        /* AND HE TURNS TO THE THING HE MEANS TO KILL. The corridor leaves a
           man facing the way he was walking — south, at the wall — so round
           4's "his eyes" reverse could only be found behind his head. He
           faces the throat, which is where a man about to use a sword looks,
           and the reverse then has a face in it. */
        const at = caveAt(...CAVE_MARKS.sword);
        const vit = caveAt(...CAVE_MARKS.swordVitals);
        const face = Math.atan2(vit.x - at.x, vit.z - at.z);
        if (silent) {
          S._stand(u, at, face);
          S._sheatheAtHip(0.01); S._drawFromHip({ silent: true });
          return;
        }
        S._sheatheAtHip(1.4);
        S._mover('sword-face', 0.45, (k) => {
          if (!u || u.walk) return;              /* not while the walk owns him */
          if (u.__swordYaw0 === undefined) u.__swordYaw0 = u.group.rotation.y;
          const d = ((face - u.__swordYaw0 + Math.PI) % (Math.PI * 2) + Math.PI * 2)
            % (Math.PI * 2) - Math.PI;
          u.group.rotation.y = u.__swordYaw0 + d * easeInOut(k);
          if (k >= 1) u.face = face;
        }, { delay: 0.05, owner: u && u.id });
        /* THE WHOLE DRAW LIVES BETWEEN 0.55 s AND 1.85 s, which is exactly
           the window the shot list gives CV-HILT — and it is OVER before the
           leaf cuts back out to the frame the reader presses in. A gate whose
           target is still travelling is a gate whose ring lags its own
           target: the [hit] law measures the ring against the rendered pixel
           at two seconds, and it caught this at 11.5 px. */
        S._drawFromHip({ delay: 0.55, dur: 1.30 });
      },
      swordDraw: (silent) => {                     /* G2 resolves — and REFUSES */
        const sw = S._prop('sword');
        if (!sw) return;
        sw.visible = true;
        S.movers = S.movers.filter((m) => m.id !== 'sword-ride' && m.id !== 'hilt-draw');
        S.swordOut = true;
        /* THE ARC STARTS WHERE THE DRAWN BLADE IS, not at a frozen mark: the
           press may land early or late and a fixed start would fly the sword
           out of his fist. The bottom of the arc is read LIVE off the hand. */
        const q0 = sw.quaternion.clone();
        /* THE PLACE THE BLOW WOULD LAND, measured off the sprawl's own head
           mark — the point hangs over the throat, edge down, which is the only
           way "drive it into his vitals" can be a picture. */
        const vit = caveAt(...CAVE_MARKS.swordVitals);
        const hi = new THREE.Vector3(vit.x, 1.95, vit.z);
        const down = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.16, -0.97, 0.18).normalize());
        const held = new THREE.Vector3();
        /* AND WHERE HE LOOKS WHEN HE PUTS IT DOWN. "…but I reflected that we
           should never be able to shift the stone" — the reflection has a
           DIRECTION, and it is the door. He holds the point over the throat,
           and then turns off it to the west, which is both the reverse the
           eyes shot needs (round 4's was behind his head) and the eyeline the
           stone shot cuts to. */
        const door = caveAt(...CAVE_MARKS.mouth);
        const yawDoor = Math.atan2(door.x - caveAt(...CAVE_MARKS.sword).x,
          door.z - caveAt(...CAVE_MARKS.sword).z);
        const yaw0 = (A('ulysses') || { group: { rotation: { y: 0 } } }).group.rotation.y;
        const dYaw = ((yawDoor - yaw0 + Math.PI) % (Math.PI * 2) + Math.PI * 2)
          % (Math.PI * 2) - Math.PI;
        const apply = (k) => {
          /* THE POINT IS ALREADY OVER HIM when the press lands — the leaf's
             own act carried it there, so the picture never depends on WHEN a
             reader's thumb falls. What the press performs is the ending the
             text has: the blade is HELD, and then the story TAKES IT BACK
             (O.5) and the hand comes down. */
          const e = k < 0.60 ? 1 : 1 - easeInOut((k - 0.60) / 0.40);
          const sc = S._scabToHip();
          if (sc) {
            held.copy(S._handOf(A('ulysses')) ||
              sc.position.clone().addScaledVector(S._scabAxis(), 0.62));
          } else held.copy(sw.position);
          sw.position.lerpVectors(held, hi, e);
          sw.quaternion.slerpQuaternions(q0, down, e);
          if (sw.userData.glint) sw.userData.glint.emissiveIntensity = 1.2 + 3.1 * e;
          /* the arm goes with the blade — a sword over a sleeping throat is
             held by a man, not floating above him (his axes, not the world's) */
          const uu = A('ulysses');
          if (uu) {
            /* he turns off the throat and onto the door — the reflection,
               performed, inside the shot that is cut to his face */
            if (!uu.walk)
              uu.group.rotation.y = yaw0 + dYaw * easeInOut(clamp01((k - 0.55) / 0.28));
            const f = uu.group.rotation.y;
            const rgt = [Math.cos(f), 0, -Math.sin(f)];
            const fwd = [Math.sin(f), 0, Math.cos(f)];
            const mix = (r2, uy, f2) =>
              [rgt[0] * r2 + fwd[0] * f2, uy, rgt[2] * r2 + fwd[2] * f2];
            S._arms(uu, {
              R_Upperarm: mix(0.18, -0.64 + 0.70 * e, 0.40 + 0.34 * e),
              R_Forearm: mix(0.30, -0.08 + 0.82 * e, 0.62 - 0.20 * e),
            });
          }
        };
        if (silent) { apply(0); return; }
        S._mover('sword-draw', 3.6, apply);
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
        /* THE LINE, RE-SURVEYED (round 3). The beam ran from (612,596) to an
           "eye" at (706,556) — and the eye is not there. The sprawl's HEAD
           BONE measures at world (-3.30, 1.00, 5.19), which is plate (562,554):
           the old drive point was three and a half metres EAST of the face it
           was supposed to be going into, so the whole blinding was a beam being
           pushed into open air with the giant's shoulder in the way of every
           lens. It also parked the two men at z ≈ 6.8-7.2 m — two metres
           outside the cave's own camera volume — so no legal station could see
           their hands and his eye in one frame.
             The beam now runs WEST from the men's hands into the measured eye,
           along z ≈ 5.2, and both ends sit inside the pocket a camera can
           stand in. This is the geometry the three authored stations in
           shots3d_bake.mjs (STAKE / EYE / CONTACT) are cut against. */
        const butt = caveAt(710, 552, 1.55);
        const eye = caveAt(573, 557, 1.45);
        S._moveProp('stake', butt.clone().lerp(eye, 0.52),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
            eye.clone().sub(butt).normalize()), 2.4, { silent });
        if (!silent) S.driveSpin = { t0: S.t + 1.2 };
        S._walkRoute(A('ulysses'), [648, 517], [700, 548], { silent, label: 'cave:drive-u' });
        S._crew(1).forEach((c) => {
          S._walkRoute(c, [668, 521], [726, 556], { silent, label: 'cave:drive-crew' });
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
        S._mover('tip-cool', 3.0, (k) => { S.tipGlow = 1 - 0.62 * easeInOut(k); }, { silent });
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
        /* ROUND 4: the beam STAYS IN THE EYE. Round 3 dropped it to the floor
           half a second after contact, which spent the pluck off screen and
           left Sol's "abrupt ellipse" at 20.8-23.0 s: wounded giant, then a
           sealed stone, with the two verbs the text spends there — he plucks
           it out, he flings it from him — never happening. It comes out in
           `fright-pluck`, where the shot list can watch it. */
      },
      /* ================= ROUND 4 · THE PLUCK AND THE HURL ================= */
      'fright-pluck': (silent) => {
        const st = S._prop('stake');
        const eye = caveAt(573, 557, 1.45);
        const butt = caveAt(710, 552, 1.55);
        const away = caveAt(...CAVE_MARKS.stakeFlung, 0.14);
        const flat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(1, 0.05, 0.2).normalize());
        if (st && !silent) {
          const p0 = st.position.clone(), q0 = st.quaternion.clone();
          const out = butt.clone().lerp(eye, -0.18);     /* torn back out of him */
          S._mover('stake-pluck', 0.55, (k) => {
            st.position.lerpVectors(p0, out, easeOutCubic(k));
          });
          /* …and FLUNG: an arc across the room, and a clatter where it lands */
          S._mover('stake-hurl', 0.85, (k) => {
            const e = easeOutCubic(k);
            st.position.lerpVectors(out, away, e);
            st.position.y = out.y + Math.sin(Math.PI * clamp01(k)) * 1.35
              - (out.y - away.y) * e;
            st.quaternion.slerpQuaternions(q0, flat, e);
          }, { delay: 0.58 });
          if (S.audio) S.audio.cue('clatter', { delay: 1.36 });
        } else if (st) {
          st.position.copy(away); st.quaternion.copy(flat);
        }
        /* ============ ROUND 5 · THE FLIGHT, IN THE FRAME ============
           Sol, r4: "flight still does not read — the bright, static beam /
           barrel angle contains no legible fleeing men."  It contained none
           because they were never in it. Round 4 ran them from px 700 to px
           903 in 2.2 s starting on the leaf's first frame, so by the time the
           cut to CV-FLEE landed at 1.5 s they had all but arrived, and the
           angle itself was aimed past the giant's own feet at a beam that had
           only just left his eye.
             Now they BOLT WHEN THE BEAM DOES — half a second in, as he tears
           it out — and they run the length of the east floor, so the whole of
           the shot has men crossing it. The lens is north of the corridor
           looking south (see the bake), which is the one station in the room
           that makes east read as SCREEN RIGHT: they enter frame left and
           are still running when the leaf turns.
             MEASURED, NOT GUESSED: probed on the running book, the corridor's
           answer to a start at px 686 was to send them WEST to the (648,537)
           path point first and only then east — so the first second of the
           flight ran the wrong way across the very shot that is about which
           way they are going. Started at px 718-736 the same corridor picks
           up at (730,554) and runs straight down the south floor.
             AND THEY DO NOT RUN IN ONE FILE. The corridor gives every body the
           same polyline, so four men 20 px apart arrive as one silhouette —
           which is the other half of "no legible fleeing men". Each is given
           his own written lane down the south floor, a body's width apart, so
           three separate men cross the angle. */
        const FLEE_MPS = 2.55;
        const LANE = [[-4, 0], [4, 10], [-8, 16], [0, 6]];   /* dx, dy per body */
        const lane = (i, k) => [[760, 548], [850, 545], [930, 542]]
          .map(([x, y]) => [x + LANE[i % 4][0] * k, y + LANE[i % 4][1]]);
        S._walkRoute(A('ulysses'), [714, 550], [968, 546],
          { speed: FLEE_MPS, silent, delay: silent ? 0 : 0.62,
            via: lane(3, 1), label: 'cave:fright-u' });
        S._aliveCrew().forEach((c, i) => {
          S._walkRoute(c, [720 + i * 8, 552 + LANE[i % 4][1] * 0.6],
            [980 - (i % 3) * 16, 542 + LANE[i % 4][1]],
            { speed: FLEE_MPS, silent, delay: silent ? 0 : 0.50 + 0.13 * i,
              via: lane(i, 1), label: 'cave:fright-crew' });
        });
      },
      /* THE NEIGHBOURS, MADE VISIBLE (Sol IV #2). They cannot be photographed —
         the reader is inside the shut cave — so they are LIGHT: lamps that
         gather in the cracks of the stone, shift when a second voice speaks,
         and travel away west when the text says they went away. */
      'seams-gather': (silent) => S._seamsTo(0.42, -0.62, 1.3, { silent }),
      'seams-close': (silent) => S._seamsTo(1.0, 0.12, 1.4, { silent }),
      'seams-shift': (silent) => S._seamsTo(0.92, -0.30, 1.1, { silent }),
      /* the departure, and the grope UNDER it: the lamps slide off west and
         die while the blind giant is already feeling his way to the door, so
         the held door shot has two things changing inside it */
      'seams-go': (silent) => {
        S._seamsTo(0, 1.15, 3.4, { silent });
        const g = S._giant('idle');
        if (!g) return;
        /* a silent replay must leave him where a read lap would have left him:
           the grope is the whole point of this leaf, so it lands either way */
        if (silent) { S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1); return; }
        if (g.mode === 'walk') return;
        const gp = g.group.position.clone(), gq = g.group.quaternion.clone();
        const up = caveAt(806, 545);
        const uq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -1.4, 0));
        g.mode = 'pose'; g.group.visible = true; g.walk = null;
        S._mover('giant-rise', 1.5, (k) => {
          const e = easeInOut(k);
          g.group.position.lerpVectors(gp, up, e);
          g.group.quaternion.slerpQuaternions(gq, uq, e);
        }, { owner: g.id, onDone: () => {
          if (g.mode === 'off') return;
          S._walkRoute(g, [806, 545], CAVE_MARKS.doorwaySeat,
            { speed: GIANT_MPS * 1.35, label: 'cave:grope' });
        } });
      },
      boulderOpen: (silent) => {
        S._boulderTo(0, { silent });
        S._seamsAt(0);
        /* THE NIGHT COMES IN WITH THE STONE (Sol IV: "the opening slit is too
           dark and brief to land cleanly"). Round 3 rolled the boulder off a
           hole with nothing behind it, so the one image the escape depends on
           — that there IS a way out — was a slightly less black rectangle. The
           aperture is now a source: a cold pre-dawn wedge that widens with the
           stone and throws real light back down the floor. */
        if (silent) S._slitAt(1, 1.5);
        else { S._slitAt(0.05, 0.5); S._slitTo(1, 2.4, 1.6, { delay: 0.35 }); }
        /* the blind grope: he rolls to his feet among the sheep and feels his
           way down the audited lane to the door he can no longer see */
        if (silent) { S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1); return; }
        const g = S._giant('idle');
        if (!g) return;
        /* he left for the door while the neighbours were still talking — the
           stone comes away at the END of that walk, not at the start of one */
        if (g.mode === 'walk') return;
        if (g.group.position.distanceTo(caveAt(...CAVE_MARKS.doorwaySeat)) < 1.4) {
          S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1); return;   /* already arrived */
        }
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
        /* THE LAST GEOMETRY OF THE BEAT IS THE GIANT IN THE DOORWAY, and it is
           only a picture if he is THERE. He may still be walking his last two
           metres — that is drama — but if the grope has gone quiet anywhere
           short of the seat, the tableau is taken by hand. */
        /* THE MEN UNDERSTAND, AND THEY ARE FACING THE THING THEY UNDERSTAND.
           They ended the fright scatter running east, so the closing reaction
           photographed three backs. Escape is west; they are looking at it. */
        S._aliveCrew().forEach((c, i) => S._stand(c, c.group.position.clone(), -1.62 + 0.12 * i));
        const u = A('ulysses');
        if (u) S._stand(u, u.group.position.clone(), -1.55);
        /* if he is still two strides out he ARRIVES — the grope is drama, but
           the closing geometry is the point of the leaf and a reader who has
           turned to it is owed the picture */
        if (groping) { groping.walk = null; S.movers = S.movers.filter((m) => m.owner !== groping.id); }
        const g = S._seatGiant(CAVE_MARKS.doorwaySeat, 2.1);
        /* BOTH HANDS SPREAD ACROSS THE OPENING (Sol IV: "the giant reads as
           kneeling beside the boulder, not unmistakably seated across the only
           exit with both hands spread"). The seat pose folds his forearms back
           over his lap — correct at the hearth, wrong here, where the whole
           point of the image is that he has felt for the edges of the door and
           is holding them. The arms are re-aimed OUT along the aperture. */
        if (g) S._arms(g, {
          L_Upperarm: [0.30, -0.46, 0.84], R_Upperarm: [0.30, -0.46, -0.84],
          L_Forearm: [-0.16, -0.34, 0.93], R_Forearm: [-0.16, -0.34, -0.93],
        });
        /* he is a silhouette in it, so the opening has to still be lit */
        S._slitAt(1, 2.4);
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
      /* ROUND 4 · THE ACT OWNS THE RETURN NOW. This seg walked the giant
         straight to his seat, which ran AFTER the act (a unit fires act then
         seg) and so overwrote the walk that carries the firewood in — the load
         rode a man who was going somewhere else. `giant-return` performs the
         whole entrance; the seg stands down. */
      case 'return': break;
      case 'milking': break;
      /* ROUND 4 · AND THE ACT OWNS THE SEIZE. Measured on the live book: this
         seg faded crew-1 and crew-2 out over 1.4 s from the instant the leaf
         opened — so the man the clutch was built to lift was at 5 % opacity by
         the time the camera cut to him, and gone by 1.8 s. That is the whole
         reason round 3's climax had "no readable clutch, lift, impact". The
         men are taken by `first-meal`, in vision, one arc, one lens. */
      case 'seize': break;
      case 'seize-legacy': {
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
  /** THE ONE NAME TABLE: a gate's target -> the staged subject that IS it */
  targetSubject(name) {
    return { ship: { t: 'ship-2' }, sword: { p: 'sword' },
      'ram-great': { a: 'ram-great' }, cyclops: { a: 'poly-idle' } }[name] || null;
  }
  /** THE THING ITSELF. A gate is decided against the target's own geometry —
   *  a ray from the live lens goes into THIS, not at a projected box centre. */
  targetObject(name) {
    const s = this.targetSubject(name);
    return s ? this.stage.resolveObject(s) : null;
  }
  /** where the target's box centre sits in world space (measurement only —
   *  NOT where it renders: a long ship's centre can be off the frame while the
   *  ship is on it, which is what the reader's ring and reach must follow) */
  targetWorld(name) {
    const s = this.targetSubject(name);
    if (!s) return null;
    const hit = this.stage.resolve(s);
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
      /* the hour · the blinding's flare · and, when an act asks for it, the
         hearth's own breathing (round 5: the survivors' last frame is lit by
         a fire, and a fire that does not move is a lamp) */
      if (fl) fl.intensity *= this.caveGrade.fire * (1 + this.flareK) * this.fireFlicker;
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
  /**
   * @param {boolean} shotOwned  a storyteller shot is on this unit, so the
   *   FRAME IS THE SHOT TABLE'S. The director keeps only the two moments the
   *   story genuinely takes the camera back — the blinding shake and the
   *   under-fleece POV — and its own legacy set-back (`station`/`swing`, from
   *   the days of the one orthographic god-view) is not applied on top. Two
   *   authors on one camera is how the blinding ended up with the lens three
   *   and a half metres behind its authored station and a metre under the cave
   *   floor (measured: campos [0.4,1.45,4.6] -> [-0.86,-1.73,5.64], the giant
   *   at 2.9x frame height with 11% of him in shot).
   */
  driveCamera(cam, simT, aimLive = null, shotOwned = false) {
    let touched = false;
    if ((this.swing || this.station > 0) && !this.pov && !shotOwned) {
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
