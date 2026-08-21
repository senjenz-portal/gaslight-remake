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
import { createShoreScene, createShoreIsoCamera, SHORE_WORLD } from '../../../3d/sets/shore3d.js';
import { createSeaScene, SEA_WORLD } from '../../../3d/sets/sea3d.js';
import { createCave3D, CAVE_WORLD, CAVE_STATES } from '../../../3d/sets/cave3d.js';
import { buildActor } from './cast3d.js';
import { loadPlateSet, samplePlateLight, makeContactShadow, PLATE_W, PLATE_H }
  from './plate3d.js';

const WALK_MPS = 1.1;                 /* cast.json processionSpeedMps */
const SCURRY_MPS = 1.9;               /* the scatter-to-the-dark pace */
const GIANT_MPS = 1.6;                /* seven metres of stride */
/* the seated giant's yaw at the giant-seat mark: knees downstage toward the
   fire, face turned west-downstage to the huddled strangers */
const GIANT_SEAT_FACE = 1.05;
/* the ledger's giant-seat mark (tools/ody/ledger.json cave.marks) */
const GIANT_SEAT_PX = [760, 452];
/* the seated crown height (metres) — where the leader line lands on his head;
   measured off the posed rig by tools/ody/_stageprobe.mjs */
const GIANT_SEAT_CROWN_M = 4.15;
const EASE_RATE = 3.2;                /* camera pursuit, s^-1 */

/* ---------------------------------------------------------------------- *
 * OKLab — the colour space the ROUND-5 tint law lives in.
 *
 * Round 4 graded each body with a per-channel RGB gain read off the plate
 * ring AT ITS MARK. Two frames of the same character therefore carried two
 * different chromaticities, and the owner saw exactly that: the giant pale
 * cream at ii-05, near-black brown at iv-03, pink at v-05. A per-channel
 * gain cannot be bounded in a way a person perceives — a "20% chroma
 * breath" on a bronze skin is a different hue shift at every luminance.
 *
 * OKLab is perceptually uniform in hue and chroma, so a tint expressed as
 * (exposure, hue-rotation, chroma-scale) IS the thing the eye judges, and
 * clamping the hue rotation to +-TINT_HUE_MAX degrees clamps what the eye
 * sees. Exposure is a SCALAR on linear RGB: it cannot move hue at all.
 * ---------------------------------------------------------------------- */
function linToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToLin(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
/** rotate hue by dh (radians) and scale chroma by cS, in OKLab */
function oklabTint(rgbLin, dh, cS) {
  const [L, A, B] = linToOklab(rgbLin[0], rgbLin[1], rgbLin[2]);
  const cs = Math.cos(dh), sn = Math.sin(dh);
  const a2 = (A * cs - B * sn) * cS, b2 = (A * sn + B * cs) * cS;
  const out = oklabToLin(L, a2, b2);
  return [Math.max(0, out[0]), Math.max(0, out[1]), Math.max(0, out[2])];
}
const sRGBtoLin = (v) => { const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LUMLIN = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];

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

if (typeof window !== 'undefined') window.__THREE = THREE;

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
  /* SOL#3's triad. The total irradiance is held at the old rig's (key+fill+rim
     = 2.27) so BODY_REF stays the constant it was measured as; what changed is
     WHERE the light comes from and WHAT COLOUR it is. */
  /* ROUND 5 — THE FIRE IS A POINT, NOT A DIRECTION. A single directional key
     has ONE direction for the whole frame, and this stage aims it from the
     fire anchor at the LENS CENTRE: correct for a body between the two, and
     exactly backwards for a body on the far side of the hearth. Measured by
     [firelight] at iii-05, where the crew stand east of the fire and the lens
     looks west of it, the fire's own contribution came out THREE TIMES
     stronger on each man's off side (0.034 vs 0.094) — a light travelling the
     wrong way across every body in the shot. So the modelling moves to the
     SPILL (a point light at the anchor, radially right for everyone) and the
     directional pair keeps only the coherent warm bounce. */
  static PLATE_RIG = { key: 0.40, fill: 0.52, rim: 0.18, cool: 0.36 };
  /* the hearth's own warm. Desaturated a step in round 5: a saturated key is
     a second tint by the back door — it moved a crimson chiton's rendered hue
     by up to 9 deg between a fire-lit frame and a moon-lit one. */
  static FIRE_KEY = '#ffd8b0';
  static FIRE_RIM = '#ff8a3c';        /* the rake off the ember side */
  static COOL_KEY = '#8fa4d6';        /* the counter, opposite the fire */
  static COOL_SKY = '#9fb0d4';
  static COOL_GROUND = '#4a4640';
  /* how far the plate-sampled fire signal may push the key/cool balance */
  static FIRE_SPLIT = [0.35, 1.85];
  /* the reference rig's rendered mean under THIS rig, grade bypassed, contact
     decal hidden, and the REGISTER BYPASSED — the grade now aims at the value
     the register will carry onto the plate (see _gradeActor), so its reference
     has to live upstream of the register too, or the loop does not close.
     (tools/sam2path_smoke.mjs --calibrate, shots/sam2path-cal)
     The single-point read is then CENTRED on the whole mark set: the smoke's
     --calibrate reports the geometric mean of Y(body)/Y(ring) over every mark
     of a set, and BODY_REF is scaled by that ratio in linear (cave came back
     1.005 and was left alone; shore 0.918 and sea 0.781 were centred). One
     mark cannot speak for a set whose targets span 2.3 stops. */
  /* re-measured for round 5's rig (the fire's modelling moved from the
     directional key to the anchor spill, so the rendered constant moved with
     it): tools/sam2path_smoke.mjs --calibrate, single-point read then centred
     on every mark of the set by the geometric mean of Y(body)/Y(ring) —
     cave 0.918, shore 0.763, sea 0.674 against the room-coloured ambient. */
  static BODY_REF = {
    cave: [51, 20, 17], shore: [50, 21, 16], sea: [53, 24, 22],
  };
  /* the plate rig is deliberately weak (BODY_REF is L* ~13) and the grade does
     the lifting, so the bright cheese-rack marks legitimately want ~15x. The
     old ceiling of 14 was BINDING there — the grade saturated and the body
     rendered short of its ring no matter what else was fixed. */
  static GRADE_CLAMP = [0.06, 40.0];
  /* ================= ROUND 5 — THE COLOUR-CONTINUITY LAW =================
     ROOT CAUSE (owner, round 5): the per-unit plate-ring chromaticity
     transplant. Round 4 still computed a PER-CHANNEL gain per body per mark
     (luminance-matched with a +-20% "chroma breath"), so the same character
     carried a different chromaticity in every frame — cream at ii-05, brown
     at iv-03, pink at v-05. A per-channel gain is not a tint; it is a
     white-balance transplant, and it cannot be bounded in anything the eye
     measures.

     THE LAW NOW, in three parts:

     (1) THE CHARACTER'S BASE MATERIAL IS CONSTANT. m.userData.plateBase is
         the atlas colour and nothing in the frame loop rewrites its hue.

     (2) ONE CALIBRATED SCENE TINT PER SET-STATE — not per unit. Computed
         once per (set, plate state) from the plate's OWN ring colour averaged
         over every ledger mark of that set (_sceneTint), expressed in OKLab
         as a hue rotation and a chroma scale, both CLAMPED. Every character
         on that leaf gets the same tint at every mark, so nothing about a
         character's colour can change between two frames of one set-state,
         and the largest change ACROSS set-states is TINT_HUE_MAX degrees.

     (3) LUMINANCE IS A SCALAR. Seating a body in the light the painter put
         where he stands is an EXPOSURE, and a scalar on linear RGB cannot
         move chromaticity at all. It is the ring's luminance over the rig's
         own measured reference, compressed toward the set-state mean by
         SEAT_GAMMA and clamped to SEAT_TRIM, so a dark corner cannot drag a
         body to near-black the way iv-03 did.                              */
  static TINT_HUE_MAX = 8;            /* degrees of OKLab hue rotation, hard */
  static TINT_CHROMA = [0.90, 1.14];  /* the tint is LOW-CHROMA by construction */
  /* HOW FAR THE TINT PULLS. 0.35 clamped the shore to +8 deg and the cave's
     ember state to -8, a 16 deg swing on one character between two adjacent
     frames — measured through [continuity], Ulysses' chiton drifted 24 deg
     over the twelve frames (std 8.1 against a law of 6). The tint's job is to
     marry the character to the room, not to repaint him: at 0.18 the same
     states come out +4.1 and -4.1 and the whole book's spread is inside the
     law. */
  static TINT_PULL = 0.18;
  static SEAT_GAMMA = 0.80;           /* per-mark luminance seat, compressed */
  static SEAT_TRIM = [0.50, 2.00];    /* …and bounded about the set-state mean */
  /* the spill's strength at the anchor; its DISTANCE is the plate's own
     half-falloff (_fireFalloff) and its intensity rides the same split and
     flicker as the key, so the whole triad is one fire */
  static SPILL_GAIN = 5.5;
  /* HOW MUCH OF THE ROOM'S OWN COLOUR THE AMBIENT CARRIES (_ambient). Round 4
     rejected plate-sampling the LIGHT because the albedo was already carrying
     a full chromaticity transplant and the colour landed twice. Round 5's
     albedo carries a bounded +-8 deg tint instead, so the room's colour has
     to come from somewhere or a warm day plate lights its cast with a blue
     sky: the shore's council crew rendered grey-green ghosts on salmon sand,
     and the exposure the luminance match then demanded (about 20x) clipped
     what colour they had left. Half the plate's own cast, per SET (not per
     state, so nothing here can move a character's hue between two frames of
     one scene), is a light — the rest of the way would be a transplant. */
  /* 0.55 was too far: measured through [materials], the giant's olive tunic
     (canon 43.7 deg) and his skin (23.7) both walked warm until the render's
     hue histogram MERGED them into one peak at 18 deg, and an identity the
     statistic cannot see is an identity the render has lost. 0.35 keeps the
     two colours two colours and still puts the room's cast in the light. */
  static AMBIENT_PULL = 0.35;
  /* the painter's downstage bias on every cast shadow (see _shadowDir) */
  static SHADOW_DOWNSTAGE = 1.0;

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

    /* SOL#5's shared register uniforms — ONE object graph, referenced by every
       actor material's compiled shader, so the whole character layer moves
       together and a set change is four assignments, not a recompile. */
    this.reg = {
      grain: { value: 0 }, contrast: { value: 1 }, mid: { value: 0.5 },
      black: { value: new THREE.Color(0, 0, 0) },
      white: { value: new THREE.Color(1, 1, 1) },
      seed: { value: new THREE.Vector2(17.31, 5.77) },   /* fixed = deterministic */
    };
    this.registerBypass = false;
    this.shadowsOn = true;            /* the ground-frame decals' master switch */
    this.softBypass = false;          /* SOL#5's focus pass (gates switch it off) */
    this.fireOff = false;             /* the [firelight] gate's control render */
    this.softK = 1;
    this.grainBypass = false;         /* the [register] gate's grain-only switch */

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
        await this._ensureActors(['ulysses', 'crew', 'polyphemus', 'polyphemus-idle',
                                  'polyphemus-seat', 'ram', 'ewe', 'flock']);
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
      'polyphemus-seat': ['poly-seat'],
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
        /* SOL#5 — the register post-pass rides on the actor's OWN materials,
           so the plate's grain and the plate's levels reach the character
           layer and nothing else. Installed once, per material. */
        for (const m of a.mats) this._installRegister(m);
        /* SOL#4 — THE CONTACT SHADOW, sized to this body's own footprint.
           A blob scaled off stature alone gives a 2.1 m disc to a 7 m giant
           who is LYING DOWN across the hearth; the posed bounding box is the
           honest footprint, and the stage tints and fades it per frame. */
        /* off the POSED skinned sweep (cast3d's skinSize) — Box3.setFromObject
           reads a SkinnedMesh's BIND box, which gave the seated giant a
           standing A-pose footprint 1.5 m deep instead of his real 3.4 m. */
        const bb = a.skinSize
          ? { max: { x: a.skinSize[0] / 2, z: a.skinSize[2] / 2 },
              min: { x: -a.skinSize[0] / 2, z: -a.skinSize[2] / 2 } }
          : new THREE.Box3().setFromObject(a.model);
        /* ROUND 5 — a contact shadow is an AO POOL, not a footprint stamp.
           0.56 x 0.62 of the posed box put a 0.3 m disc under a man whose own
           legs then covered every pixel of it: measured at ii-05, hiding the
           whole decal changed TEN pixels of the frame. The pool is the body's
           own width and a little more, so it reaches out past the silhouette
           where a reader can see the ground take it. */
        const fx = Math.max(0.24, (bb.max.x - bb.min.x) * 0.82);
        const fz = Math.max(0.18, (bb.max.z - bb.min.z) * 0.88);
        a.footprint = [+fx.toFixed(3), +fz.toFixed(3)];
        /* ROUND 5 — THE GROUND FRAME. The decals used to be CHILDREN of the
           actor group, which is wrong twice: a posed body (the sprawl carries
           a -90 deg X euler) tipped its own contact shadow up into a vertical
           plane, and a body lifted off the floor (the sprawl sits at y 1.05)
           carried its shadow into the air with it. Every decal now lives in a
           world-space ground group that is re-seated each frame at the body's
           plan position, on the floor, yawed to the body's own axis. */
        a.gshadow = new THREE.Group();
        a.gshadow.name = 'ground-' + id;
        a.shadow = makeContactShadow(fx, fz);
        a.gshadow.add(a.shadow);
        a.contacts = [];                /* the extra contacts of a posed body */
        a.contactSpec = null;           /* set by the pose that needs one */
        this.actorLayer.add(a.gshadow);
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
    /* THE HAND PROPS ARE THE STORY, NOT SCENERY. The sword, the bowl and the
       stake are built into rec.api.root by _buildProps, so this sweep retired
       them with the painted dressing: iii-08's whole readable action is "take
       this and drink some wine" and there was NO BOWL in the frame (SOL#1),
       G2's glint had no sword and Beat IV's stake was an invisible drive.
       Keep every prop the reader is asked to look at. */
    if (rec.propsGroup) tree(keepAll, rec.propsGroup);
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
    /* SOL#3 — THE FIRE LIGHTS THE CAST. Every plate on this book has one
       dominant practical: the hearth (cave), the blaze (shore), the cave-glow
       across the water (sea). A white key from a fixed up-left-front made the
       cast read as a separate render dropped on the painting. So the key now
       stands AT THE FIRE ANCHOR and is warm, an orange rim rakes the same
       side, and the fill is cool and comes from opposite — the classic
       firelight triad, aimed by the set's own anchor rather than by taste.
       The intensities are PLATE-SAMPLED each frame (_plateLightStep): the
       fire's ring colour against the body's ring colour is what says how much
       of this body's light is fire and how much is ambient. */
    const key = new THREE.DirectionalLight(Stage3D.FIRE_KEY, R.key);
    key.position.copy(rec.fireAnchor).add(new THREE.Vector3(0, 1.8, 0));
    key.target.position.set(0, 0, 0);
    const fill = new THREE.HemisphereLight(Stage3D.COOL_SKY, Stage3D.COOL_GROUND, R.fill);
    const rim = new THREE.DirectionalLight(Stage3D.FIRE_RIM, R.rim);
    rim.position.copy(rec.fireAnchor).add(new THREE.Vector3(0, 3, -4));
    rim.target.position.set(0, 0, 0);
    /* the cool counter-key, opposite the fire: it is what keeps a body from
       going monochrome orange, and it is the plate's own shadow colour */
    const cool = new THREE.DirectionalLight(Stage3D.COOL_KEY, R.cool);
    cool.position.set(0, 7, 0);
    cool.target.position.set(0, 0, 0);
    /* ROUND 5 — THE SPILL. A directional key is the same on every body in the
       frame, which is exactly what "one coherent fire" requires of DIRECTION
       and exactly wrong for INTENSITY: Sol read iii-08 and iv-03 as "the giant
       gets an amber wash, the man beside him gets nothing convincing", because
       the split was sampled at the LENS TARGET and every body then shared it.
       The spill is a point light AT the fire anchor, so proximity is physics
       instead of taste, and its falloff distance is measured off the PLATE's
       own ring luminance profile (_fireFalloff), not chosen. */
    const spill = new THREE.PointLight(Stage3D.FIRE_KEY, 0, 20, 2);
    spill.position.copy(rec.fireAnchor).add(new THREE.Vector3(0, 0.8, 0));
    spill.name = 'plate-spill';
    key.name = 'plate-key'; fill.name = 'plate-fill';
    rim.name = 'plate-rim'; cool.name = 'plate-cool';
    rec.scene.add(key, key.target, fill, rim, rim.target, cool, cool.target, spill);
    rec.rig = { key, fill, rim, cool, spill };
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

  /**
   * THE ROOM'S OWN COLOUR, as a LIGHT. Per SET, from the plate's mean ring
   * chromaticity at unit luminance, pulled AMBIENT_PULL of the way from white
   * and normalised so no channel exceeds one. It is deliberately not per
   * state: [continuity] holds a character's hue across the whole book, and a
   * light that changes colour with the state is a tint by another name.
   */
  _ambient(rec) {
    if (rec.ambientCol) return rec.ambientCol;
    const st = (rec.plate && rec.plate.states && rec.plate.states[0]) || null;
    const T = this._sceneTint(rec, st);
    const y = Math.max(1e-6, T.ringY);
    const c = T.ring.map((v) => v / y);
    const pull = Stage3D.AMBIENT_PULL;
    const mix = c.map((v) => Math.max(0.05, 1 + pull * (v - 1)));
    const k = 1 / Math.max(1e-6, Math.max(mix[0], mix[1], mix[2]));
    rec.ambientCol = mix.map((v) => v * k);
    return rec.ambientCol;
  }

  /**
   * THE FIRE'S OWN FALLOFF, read off the painting. Ring luminance is sampled
   * on rings of increasing radius about the fire anchor (twelve bearings, so
   * a wall on one side cannot decide it) and the HALF-DISTANCE — where the
   * painted glow has fallen half of the way from the hearth to the far dark —
   * is the spill's distance. The painter's own light law, in metres.
   */
  _fireFalloff(rec, state) {
    rec.fallBy = rec.fallBy || {};
    const key = state || 'default';
    if (rec.fallBy[key]) return rec.fallBy[key];
    const w = rec.world, fa = rec.fireAnchor;
    const fpx = fa.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const fpy = fa.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const L0 = samplePlateLight(this.lightTable, rec.name, state, fpx, fpy).lum;
    const prof = [];
    for (let r = 1; r <= 14; r++) {
      let sum = 0, n = 0;
      for (let a = 0; a < 12; a++) {
        const th = a * Math.PI / 6;
        const px = fpx + Math.cos(th) * r * w.S;
        const py = fpy + Math.sin(th) * r * w.S * w.SIN_E;
        if (px < 0 || px > PLATE_W || py < 0 || py > PLATE_H) continue;
        sum += samplePlateLight(this.lightTable, rec.name, state, px, py).lum;
        n++;
      }
      if (n >= 4) prof.push([r, sum / n]);
    }
    const far = prof.length ? prof[prof.length - 1][1] : L0 * 0.5;
    const half = far + 0.5 * (L0 - far);
    let D = 6;
    for (const [r, L] of prof) { if (L <= half) { D = r; break; } D = r; }
    const out = { L0: +L0.toFixed(1), far: +far.toFixed(1), halfM: D,
                  profile: prof.map(([r, L]) => [r, +L.toFixed(1)]) };
    rec.fallBy[key] = out;
    return out;
  }

  /**
   * THE SCENE TINT — one per (set, plate state), cached forever.
   *
   * The plate's own ring colour is read at EVERY ledger mark of the set and
   * averaged in linear light: that mean is what this painting's light does to
   * a body standing anywhere in it. Two numbers come out of it —
   *
   *   E0   the exposure that puts the reference rig's rendered luminance on
   *        that mean ring's luminance (a SCALAR: no chromaticity is moved),
   *   dh/cS the OKLab hue rotation and chroma scale that lean the character
   *        layer TINT_PULL of the way toward the painting's own cast, both
   *        clamped — TINT_HUE_MAX degrees and TINT_CHROMA.
   *
   * Everything downstream is per-body EXPOSURE only, so a character's hue is
   * a constant of the set-state. This is the whole of round 5's fix.
   */
  _sceneTint(rec, state) {
    rec.tintBy = rec.tintBy || {};
    const key = state || 'default';
    if (rec.tintBy[key]) return rec.tintBy[key];
    const table = (this.lensTable.sets[rec.name] || {}).marks || {};
    const fin = this._plateFinish(rec, state);
    /* the grade aims at the PRE-REGISTER value the finish will then carry onto
       the plate (round 4's root cause) — undo the toe and the compression */
    const preReg = (v255) => {
      let x = Math.max(2, v255) / 255;
      if (fin) {
        const mid = fin.mid === undefined ? 0.5 : fin.mid;
        x = (x - fin.black) / Math.max(1e-4, 1 - fin.black);
        x = (x - mid) / Math.max(1e-4, fin.contrast) + mid;
      }
      return Math.min(1, Math.max(0.008, x)) * 255;
    };
    const acc = [0, 0, 0];
    let n = 0;
    const perMark = {};
    for (const [name, at] of Object.entries(table)) {
      const s = samplePlateLight(this.lightTable, rec.name, state, at[0], at[1]);
      const lin = [0, 1, 2].map((i) => sRGBtoLin(preReg(s.rgb[i])));
      perMark[name] = LUMLIN(lin);
      for (let i = 0; i < 3; i++) acc[i] += lin[i];
      n++;
    }
    if (!n) { acc[0] = acc[1] = acc[2] = 0.02; n = 1; }
    const ring = acc.map((v) => v / n);
    const ringY = Math.max(1e-6, LUMLIN(ring));
    /* the reference rig's own rendered mean under the fixed plate rig, in the
       same pre-register space (BODY_REF is measured with --calibrate) */
    const ref0 = Stage3D.BODY_REF[rec.name] || Stage3D.BODY_REF.cave;
    const refLin = ref0.map((v) => sRGBtoLin(Math.max(2, v)));
    const refY = Math.max(1e-6, LUMLIN(refLin));
    /* the tint: where the ring's chroma sits against the rig's own, in OKLab */
    const rl = linToOklab(ring[0] / ringY, ring[1] / ringY, ring[2] / ringY);
    const bl = linToOklab(refLin[0] / refY, refLin[1] / refY, refLin[2] / refY);
    const hR = Math.atan2(rl[2], rl[1]), hB = Math.atan2(bl[2], bl[1]);
    const cR = Math.hypot(rl[1], rl[2]), cB = Math.hypot(bl[1], bl[2]);
    let dh = ((hR - hB + Math.PI * 3) % (Math.PI * 2)) - Math.PI;   /* signed */
    const cap = Stage3D.TINT_HUE_MAX * Math.PI / 180;
    dh = Math.max(-cap, Math.min(cap, dh * Stage3D.TINT_PULL));
    const cRaw = 1 + Stage3D.TINT_PULL * (cR / Math.max(1e-4, cB) - 1);
    const cS = Math.max(Stage3D.TINT_CHROMA[0], Math.min(Stage3D.TINT_CHROMA[1], cRaw));
    const tint = { state: key, marks: n, ring, ringY, refY, perMark,
                   E0: ringY / refY, dh, cS,
                   hueDeg: +(dh * 180 / Math.PI).toFixed(2), chroma: +cS.toFixed(4) };
    rec.tintBy[key] = tint;
    return tint;
  }

  /**
   * THE ACTOR GRADE, round 5: EXPOSURE ONLY, plus the set-state's own tint.
   *
   * What used to be a per-channel gain read at the body's mark is now:
   *   base albedo (constant)  x  scalar exposure  ->  OKLab scene tint
   * The exposure is the ring luminance where he stands over this rig's own
   * measured reference, compressed toward the set-state mean by SEAT_GAMMA
   * and clamped by SEAT_TRIM; the tint is the set-state's, identical for every
   * body at every mark. Chromaticity therefore cannot change between frames of
   * one set-state, and across set-states it can move at most TINT_HUE_MAX deg.
   */
  _gradeActor(rec, a, apply = true) {
    if (!a.group.visible || a.mode === 'off') return;
    const w = rec.world;
    const p = a.group.getWorldPosition(this.__gv || (this.__gv = new THREE.Vector3()));
    /* THE LIGHT A BODY IS IN IS THE LIGHT AT ITS MIDDLE. An upright body's
       origin is between its feet, which is also where the regrade ring is
       measured, so it samples there. A LYING body's origin is at the FOOT END
       of a seven-metre span: the sprawled giant was reading the plate out by
       the pen, four metres from the hearth his torso lies across, and came
       back 3.5 stops darker at iv-03 than at ii-05 — the owner's "near-black
       brown". Sample his own centroid. */
    if (a.mode === 'pose') {
      const d = (this.__pd || (this.__pd = new THREE.Vector3()))
        .set(0, 1, 0).applyQuaternion(a.group.quaternion);
      const half = 0.5 * ((a.skinSize && a.skinSize[1]) || 1.7);
      p.x += d.x * half; p.z += d.z * half;
    }
    const px = p.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const py = p.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const state = this.plateState(rec);
    const s = samplePlateLight(this.lightTable, rec.name, state, px, py);
    /* the contact decals are seated from the SAME sample whether or not the
       grade runs — they are shadows, not a grade */
    if (!apply) return s;
    if (!a.mats) return s;
    const T = this._sceneTint(rec, state);
    const fin = this.registerBypass ? null : this._plateFinish(rec, state);
    const preReg = (v255) => {
      let x = Math.max(2, v255) / 255;
      if (fin) {
        const mid = fin.mid === undefined ? 0.5 : fin.mid;
        x = (x - fin.black) / Math.max(1e-4, 1 - fin.black);
        x = (x - mid) / Math.max(1e-4, fin.contrast) + mid;
      }
      return Math.min(1, Math.max(0.008, x)) * 255;
    };
    /* (1) THE SEAT — a scalar. The ring's luminance HERE against the set-state
           mean, compressed and bounded: the painting still says how lit this
           corner is, but a dark corner can no longer drag a character to
           near-black (iv-03, round 4) and a hot one cannot bleach him. */
    const here = LUMLIN([0, 1, 2].map((i) => sRGBtoLin(preReg(s.rgb[i]))));
    const rel = Math.pow(Math.max(1e-6, here) / Math.max(1e-6, T.ringY),
                         Stage3D.SEAT_GAMMA);
    const seat = Math.max(Stage3D.SEAT_TRIM[0], Math.min(Stage3D.SEAT_TRIM[1], rel));
    /* (2) THIS RIG's own reference. BODY_REF is the REFERENCE rig's rendered
           mean; another rig with another albedo needs the ratio of the two, or
           its own colour rides the reference's correction (the green giant).
           This is a LUMINANCE ratio — a scalar — never a per-channel gain. */
    const refA = this.__refAlbedo || (this.__refAlbedo =
      (this.actors.ulysses && this.actors.ulysses.albedo) || [1, 1, 1]);
    const own = a.albedo || refA;
    const albY = Math.max(1e-4, LUMLIN(own)) / Math.max(1e-4, LUMLIN(refA));
    const [lo, hi] = Stage3D.GRADE_CLAMP;
    const E = Math.max(lo, Math.min(hi, T.E0 * seat / albY));
    /* (3) THE SET-STATE TINT, in OKLab, applied to the CONSTANT base albedo */
    for (const m of a.mats) {
      if (!m.color) continue;
      if (!m.userData.plateBase) m.userData.plateBase = m.color.clone();
      const b = m.userData.plateBase;
      if (!m.userData.tintKey || m.userData.tintKey !== T.state) {
        m.userData.tintKey = T.state;
        m.userData.tinted = oklabTint([b.r, b.g, b.b], T.dh, T.cS);
      }
      const t = m.userData.tinted;
      m.color.setRGB(t[0] * E, t[1] * E, t[2] * E);
    }
    a.grade = [+E.toFixed(3), +E.toFixed(3), +E.toFixed(3)];
    a.gradeLum = +E.toFixed(3);
    a.seat = +seat.toFixed(3);
    a.tint = { hue: T.hueDeg, chroma: T.chroma };
    return s;
  }


  /**
   * ROUND 5 — THE CONTACT SET. Sol twice reported "no grounding": a blob under
   * a standing man is not grounding for a body with FOUR contacts on the floor.
   * A pose declares its contacts (rump, haunches, knees, feet, the length of a
   * lying torso) and each one gets its own soft decal, sized to what actually
   * touches. Offsets are in the body's own ground frame, metres, +Z forward,
   * +X to his left; a spec entry is [ox, oz, halfX, halfZ, weight].
   */
  _contactSet(a, kind) {
    const S = a.skinSize || [1, 1.7, 0.6];
    const w = S[0], h = S[1], d = S[2];
    let spec;
    if (kind === 'seat') {
      /* cross-legged on the floor: the rump takes the weight, the crossed
         shins and both knees touch, and the whole set is his own width */
      spec = [[0, -0.22 * d, 0.30 * w, 0.24 * d, 1.00],
              [0.30 * w, 0.10 * d, 0.19 * w, 0.17 * d, 0.85],
              [-0.30 * w, 0.10 * d, 0.19 * w, 0.17 * d, 0.85],
              [0, 0.26 * d, 0.26 * w, 0.15 * d, 0.80]];
    } else if (kind === 'sprawl') {
      /* laid out along +Z of the ground frame from his soles: legs, torso,
         head — three decals so the smear has a body's shape, not a disc */
      const L = h;
      spec = [[0, 0.20 * L, 0.30 * w, 0.13 * L, 0.85],
              [0, 0.52 * L, 0.36 * w, 0.16 * L, 1.00],
              [0, 0.84 * L, 0.26 * w, 0.10 * L, 0.90]];
    } else {
      spec = null;                       /* the default single-footprint blob */
    }
    a.contactKind = kind;
    a.contactSpec = spec;
    /* grow/shrink the decal pool to the spec */
    const want = spec ? spec.length : 0;
    while (a.contacts.length < want) {
      const b = makeContactShadow(0.5, 0.3);
      b.name = 'contact-' + a.id + '-' + a.contacts.length;
      a.gshadow.add(b);
      a.contacts.push(b);
    }
    for (let i = 0; i < a.contacts.length; i++) {
      const c = a.contacts[i];
      c.visible = i < want;
      if (i >= want) continue;
      const [ox, oz, hx, hz] = spec[i];
      c.position.set(ox, 0.015 + i * 0.002, oz);
      c.userData.o = [ox, oz];
      c.scale.set(hx / 0.5, hz / 0.3, 1);
    }
    /* the primary footprint blob stands down when a pose declares its own */
    a.shadow.visible = !spec;
    return spec ? spec.length : 1;
  }

  /**
   * SOL#4 / ROUND 5 — seat a body's contact set in the plate's own shadow.
   * Colour: the ring the body stands in, darkened — the painting's shadow
   * colour, never black. Opacity: the light that is actually there. The whole
   * set rides a WORLD-SPACE ground group re-seated here every frame, so a
   * posed or lifted body cannot carry its own shadow off the floor.
   */
  _seatShadow(a, s) {
    const g = a.gshadow;
    if (!g) return;
    const rec = this.sets[this.activeName];
    const p = a.group.getWorldPosition(this.__sv || (this.__sv = new THREE.Vector3()));
    /* A BODY THAT IS NOT ON THE FLOOR HAS NO FLOOR SHADOW. The sea's giant
       stands on a clifftop and the rowers ride a deck: their ground plane is
       not y=0, and a decal laid there lands in the water. Own the fact rather
       than draw a lie — the [grounding] gate reads a.grounded and exempts
       them by name. */
    /* a POSED body's origin is lifted by half its own depth on purpose (the
       lay grounding), so the height test is only meaningful for upright ones */
    a.grounded = (a.mode === 'pose' || p.y <= 0.6) && a.mode !== 'deck';
    const live = a.group.visible && a.mode !== 'off' && a.grounded;
    g.visible = live && this.shadowsOn !== false;
    if (!g.visible || !rec) {
      if (a.scaleShadow) a.scaleShadow.visible = false;
      return;
    }
    /* (1) SEAT THE FRAME on the floor under the body, yawed to its own axis */
    g.position.set(p.x, 0.02, p.z);
    let yaw = a.face || 0;
    if (a.mode === 'pose') {
      /* a lying body's axis is its own +Y in world (head direction) */
      const d = (this.__sd || (this.__sd = new THREE.Vector3()))
        .set(0, 1, 0).applyQuaternion(a.group.quaternion);
      if (Math.hypot(d.x, d.z) > 1e-3) yaw = Math.atan2(d.x, d.z);
    }
    g.rotation.set(0, yaw, 0);
    /* (2) THE POSE DECIDES THE CONTACTS */
    const want = a.mode === 'pose' ? 'sprawl'
      : (a.rig === 'polyphemus-seat' ? 'seat' : 'feet');
    if (a.contactKind !== want) this._contactSet(a, want);
    /* (3) the plate's own shadow colour and the light that is actually there */
    const k = Math.min(1, Math.max(0, s.lum / 150));
    const base = (0.42 + 0.38 * k) * (a.opacity === undefined ? 1 : a.opacity);
    const col = [s.rgb[0] / 255 * 0.22, s.rgb[1] / 255 * 0.20, s.rgb[2] / 255 * 0.21];
    /* the whole set slides a little the way the PAINTER's shadows fall (see
       _shadowDir), in the ground frame, so it survives the yaw */
    let ox = 0, oz = 0;
    {
      const d = this._shadowDir(rec, p);
      const cs = Math.cos(-yaw), sn = Math.sin(-yaw);
      ox = d.x * cs - d.z * sn;
      oz = d.x * sn + d.z * cs;
    }
    const paint = (mesh, weight, hx, hz) => {
      const m = mesh.material;
      m.color.setRGB(col[0], col[1], col[2]);
      m.opacity = base * weight;
      const d = 0.26 * Math.min(hx, hz);
      const o = mesh.userData.o || [0, 0];
      mesh.position.x = o[0] + ox * d;
      mesh.position.z = o[1] + oz * d;
    };
    if (a.contactSpec) {
      for (let i = 0; i < a.contactSpec.length; i++) {
        const [, , hx, hz, wgt] = a.contactSpec[i];
        paint(a.contacts[i], wgt, hx, hz);
      }
    } else {
      const half = a.shadow.userData.half || [0.3, 0.2];
      paint(a.shadow, 1, half[0], half[1]);
    }
    /* (4) THE CAST POOL. A decal that lives entirely UNDER a body proves
       nothing to an eye: at ii-05 every one of the seated giant's four
       contacts landed inside his own silhouette and the frame still read as a
       floating crouch. The pool is the shadow that LEAVES him — one soft
       ellipse aimed away from the fire, its near end under his own mass, its
       far end out on lit floor where the reader can see it. Same light, same
       reading of the plate, so it can never disagree with the contacts. */
    this._castPool(a, rec, col, base, p);
  }

  /**
   * WHERE THE PAINTER PUTS THE SHADOW. Radially away from the fire is only
   * half of it: the practical is also ABOVE the floor, so every painted
   * shadow on these plates also runs DOWNSTAGE, toward the reader. Measured
   * on cave-shut around the two freestanding vessels (the only objects with
   * open floor on all sides): the darkest azimuth about the milk tub is 45 deg
   * and about the clay bowl 60 deg (screen, 0 = right, 90 = down), where the
   * pure radial would be 4 deg and 20 deg. A unit downstage bias on top of the
   * radial reproduces 47 and 55. Without it a body sitting upstage of the
   * hearth throws its whole pool BEHIND itself, which is physically true of a
   * point source at floor level and useless to a reader — ii-05's seated
   * giant hid every shadow pixel he owned under his own bulk.
   */
  _shadowDir(rec, p) {
    const fa = rec.fireAnchor;
    let x = 0, z = 1;
    if (fa) {
      const wx = p.x - fa.x, wz = p.z - fa.z;
      const L = Math.hypot(wx, wz);
      if (L > 1e-3) { x = wx / L; z = wz / L + Stage3D.SHADOW_DOWNSTAGE; }
      else { x = 0; z = 1; }
    }
    const n = Math.hypot(x, z) || 1;
    return { x: x / n, z: z / n, ok: true };
  }

  /**
   * ROUND 5 — one cast pool per upright body, aimed by the fire.
   * Length is the body's own: half its footprint depth plus 0.8 of its
   * stature, which is what a low warm practical throws; width is its own
   * width. A LYING body gets none — its shadow is a fringe around it, and its
   * three sprawl contacts already carry that.
   */
  _castPool(a, rec, col, base, p) {
    const upright = a.mode === 'stand' || a.mode === 'walk';
    if (!upright || !rec.fireAnchor || a.poolOff) {
      if (a.scaleShadow) a.scaleShadow.visible = false;
      return null;
    }
    if (!a.scaleShadow) {
      /* world-space, NOT a child of the actor: a cast shadow does not turn
         when the body turns, it turns when the LIGHT moves */
      a.scaleShadow = makeContactShadow(1, 0.62);
      a.scaleShadow.name = 'cast-pool-' + a.id;
      a.scaleShadow.rotation.order = 'YXZ';
      this.actorLayer.add(a.scaleShadow);
    }
    const sh = a.scaleShadow;
    const d = this._shadowDir(rec, p);
    if (!d.ok) { sh.visible = false; return null; }
    const wx = d.x, wz = d.z;
    const S = a.skinSize || [0.6, 1.7, 0.5];
    const bodyW = Math.max(0.3, S[0]);
    const bodyD = Math.max(0.25, S[2]);
    const stature = Math.max(0.4, S[1]);
    /* SHORT AND DEFINITE, not long and hazy: round 5's first pool ran a whole
       stature (5.9 m under the seated giant) and read as ambience. A shadow
       the reader can name is about half a stature long and dark enough to see
       its edge. */
    const len = bodyD * 0.5 + Math.max(0.55, 0.55 * stature);
    sh.visible = this.shadowsOn !== false;
    /* the near end under the body, the rest out along the away-from-fire axis */
    const mid = len * 0.5 - bodyD * 0.30;
    sh.position.set(p.x + wx * mid, 0.012, p.z + wz * mid);
    sh.rotation.set(-Math.PI / 2, Math.atan2(-wz, wx), 0);
    /* the decal is 2 m x 1.24 m at scale 1 (makeContactShadow(1, 0.62)) */
    sh.scale.set(len / 2, (bodyW * 0.95) / 1.24, 1);
    sh.material.color.setRGB(col[0], col[1], col[2]);
    sh.material.opacity = Math.min(0.92, base * 0.95);
    return sh;
  }

  /* ---------------- SOL#5: THE REGISTER POST-PASS ---------------- *
   * A clean three.js render composited onto a painted plate is legible as
   * SEPARATE for two reasons that have nothing to do with lighting: the plate
   * carries film grain and the character layer carries none, and the plate
   * lives inside its own black/white levels while the character layer runs the
   * full 0..1 range. So after compositing, the CHARACTER LAYER ONLY — the pass
   * rides on the actor materials' own fragment shaders, so it can touch
   * nothing else — is compressed into the plate's measured levels and given
   * the plate's measured grain.
   *
   * The grain is a pure function of gl_FragCoord, so it is deterministic: the
   * same frame renders the same bytes, which is what the harness requires.  */
  _installRegister(m) {
    if (!m || m.userData.__register) return;
    m.userData.__register = true;
    const R = this.reg;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      if (prev) prev(shader, renderer);
      shader.uniforms.uRegGrain = R.grain;
      shader.uniforms.uRegBlack = R.black;
      shader.uniforms.uRegWhite = R.white;
      shader.uniforms.uRegContrast = R.contrast;
      shader.uniforms.uRegMid = R.mid;
      shader.uniforms.uRegSeed = R.seed;
      /* THE LEVELS ARE A FINISH, NOT A REMAP (round 4).
         Round 3 mapped the character layer's whole 0..1 range into the plate's
         [black, white] band — for the cave a x0.659 squeeze. That is not a
         finish, it is an exposure change, and it collided head-on with the
         regrade law: the grade would raise a body to the plate's sampled
         colour and the register would then squash it back, so the grade had to
         aim ~2x higher, ran into GRADE_CLAMP, and clipped the body's lit side
         against 1.0 before its MEAN ever reached the target. Measured: all 29
         marks rendered dark, worst -18.2 L*.
         The level is the GRADE's job. This pass owns only the finish:
           - contrast compressed about the PLATE's own mid-tone (mean-preserving
             at that mid, so it does not move the body's exposure),
           - the plate's black as a TOE, so the character has no blacker black
             than the painting does,
           - the plate's white as a soft CEILING knee, so the character is never
             the brightest thing in a frame the painter did not blow out,
           - the plate's grain. */
      shader.fragmentShader = 'uniform float uRegGrain;\nuniform vec3 uRegBlack;\n'
        + 'uniform vec3 uRegWhite;\nuniform float uRegContrast;\nuniform float uRegMid;\n'
        + 'uniform vec2 uRegSeed;\n'
        + shader.fragmentShader.replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
  {
    vec3 rc = gl_FragColor.rgb;
    rc = clamp(uRegMid + (rc - uRegMid) * uRegContrast, 0.0, 1.0);
    rc = uRegBlack + rc * (1.0 - uRegBlack);
    rc -= max(rc - uRegWhite, vec3(0.0)) * 0.70;
    float rn = fract(sin(dot(gl_FragCoord.xy + uRegSeed,
                             vec2(12.9898, 78.233))) * 43758.5453);
    rc += (rn - 0.5) * uRegGrain;
    gl_FragColor.rgb = clamp(rc, 0.0, 1.0);
  }`);
    };
    m.needsUpdate = true;
  }

  /**
   * The plate's own finish, measured off the painting FILE at native
   * resolution and cached per (set, state):
   *   grain    — the sigma of the plate's high-frequency residual, converted
   *              to the shader's uniform-noise amplitude (sigma * sqrt(12))
   *   black /  — the plate's own 2nd / 98th luminance percentiles per channel,
   *   white      i.e. the range the painting actually occupies
   *   contrast — bounded by the range the plate has: a flat, hazy painting
   *              compresses the character layer, a full-range one leaves it
   */
  _plateFinish(rec, state) {
    rec.finishBy = rec.finishBy || {};
    if (rec.finishBy[state]) return rec.finishBy[state];
    const t = rec.plate && rec.plate.tex.plate[state];
    const img = t && t.image;
    if (!img || !img.width) return null;
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    const TS = 192, TILES = [[0.18, 0.22], [0.52, 0.34], [0.78, 0.66], [0.34, 0.74]];
    c.width = c.height = TS;
    const g = c.getContext('2d', { willReadFrequently: true });
    const res = [], lum = [];
    for (const [fx, fy] of TILES) {
      const sx = Math.min(W - TS, Math.max(0, Math.round(fx * W - TS / 2)));
      const sy = Math.min(H - TS, Math.max(0, Math.round(fy * H - TS / 2)));
      g.clearRect(0, 0, TS, TS);
      g.drawImage(img, sx, sy, TS, TS, 0, 0, TS, TS);   /* NATIVE scale: grain survives */
      const d = g.getImageData(0, 0, TS, TS).data;
      for (let y = 0; y < TS; y++) {
        for (let x = 1; x < TS - 1; x++) {
          const i = (y * TS + x) << 2;
          lum.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255);
          /* the horizontal Laplacian residual of white noise has variance
             1.5 sigma^2 — divide it back out */
          res.push(Math.abs(d[i + 1] - (d[i - 3] + d[i + 5]) / 2));
        }
      }
    }
    if (!res.length) return null;
    /* THE GRAIN FLOOR. A median-absolute-deviation of an 8-bit residual is
       quantised to whole codes, and the sea plate's grain is under one — the
       statistic reported 0.5 codes for two very different paintings. So the
       floor is the RMS of the residuals that are SMALL (<= 4 codes): a
       painting's brush edges are excluded by the cut, the grain is not, and
       the result is continuous instead of a staircase. */
    let ss = 0, n = 0;
    for (const v of res) { if (v <= 4) { ss += v * v; n++; } }
    const sigma = n >= 64 ? Math.sqrt(ss / n) / Math.sqrt(1.5) / 255 : 0;
    lum.sort((a, b) => a - b);
    const p = (q) => lum[Math.min(lum.length - 1, Math.floor(lum.length * q))];
    const blk = Math.min(0.14, Math.max(0, p(0.02)));
    const wht = Math.min(1, Math.max(0.55, p(0.98)));
    const fin = {
      grain: +Math.min(0.10, sigma * Math.sqrt(12)).toFixed(5),
      sigma: +sigma.toFixed(6),
      black: +blk.toFixed(4), white: +wht.toFixed(4),
      /* the plate's own mid-tone — the pivot the contrast compresses about, so
         the finish cannot move the character layer's exposure */
      mid: +p(0.5).toFixed(4),
      contrast: +Math.min(1, Math.max(0.86, 0.86 + 0.14 * (wht - blk))).toFixed(4),
    };
    rec.finishBy[state] = fin;
    return fin;
  }

  /** push the mounted set's measured finish into the shared register uniforms */
  _registerPass(rec, s) {
    if (this.registerBypass) {
      this.reg.grain.value = 0;
      this.reg.contrast.value = 1;
      this.reg.mid.value = 0.5;
      this.reg.black.value.setRGB(0, 0, 0);
      this.reg.white.value.setRGB(1, 1, 1);
      rec.finish = null;
      return null;
    }
    const fin = this._plateFinish(rec, this.plateState(rec));
    if (!fin) return null;
    rec.finish = fin;
    /* THE GRAIN IS ITS OWN SWITCH. The [register] gate has to measure what the
       grain adds, and the levels half of this pass SHRINKS the body's own
       detail residual (x (white-black) x contrast ~ 0.66) — far more than the
       grain adds back. Toggling the whole pass therefore measured sigma_on <
       sigma_off and reported "added 0.00000" on all three sets, a gate that
       could only ever fail. Toggling the grain ALONE leaves the levels live on
       both renders, so the body's own detail cancels in the quadrature
       subtraction and what is left is the grain, exactly. */
    this.reg.grain.value = this.grainBypass ? 0 : fin.grain;
    this.reg.contrast.value = fin.contrast;
    this.reg.mid.value = fin.mid === undefined ? 0.5 : fin.mid;
    this.reg.black.value.setRGB(fin.black, fin.black, fin.black);
    this.reg.white.value.setRGB(fin.white, fin.white, fin.white);
    return fin;
  }

  /**
   * THE MATERIALS GATE's boot evidence: for every rig on the stage, the
   * DECODED dimensions of its base-colour texture and the canonical hues that
   * texture carries. cast3d already throws if a texture did not decode, so a
   * stage that mounts at all has passed the hard half; this is what the smoke
   * measures the LIVE RENDER against.
   */
  castIdentity() {
    const out = {};
    for (const [id, a] of Object.entries(this.actors)) {
      if (!a.identity) continue;
      out[id] = { rig: a.rig, tex: a.identity.tex, satPx: a.identity.satPx,
                  canon: a.identity.canon,
                  albedo: (a.albedo || []).map((v) => +v.toFixed(4)),
                  footprint: a.footprint || null };
    }
    return out;
  }

  /** the gate hides the contact decals — BODY_REF is the RIG's own mean, and
      a shadow under its feet is not part of the rig */
  setShadows(on) {
    this.shadowsOn = on !== false;
    let n = 0;
    for (const a of Object.values(this.actors)) {
      if (!a.gshadow) continue;
      a.gshadow.visible = this.shadowsOn && a.group.visible && a.mode !== 'off'
        && a.mode !== 'deck';
      n++;
    }
    return n;
  }

  /** the gate turns the register pass off, to measure what it added */
  setRegisterBypass(on) {
    this.registerBypass = !!on;
    const rec = this.sets[this.activeName];
    if (rec && rec.built) this._registerPass(rec, null);
    return this.registerBypass;
  }

  /** the gate turns the GRAIN off with the levels still live (see _registerPass) */
  setGrainBypass(on) {
    this.grainBypass = !!on;
    const rec = this.sets[this.activeName];
    if (rec && rec.built) this._registerPass(rec, null);
    return this.grainBypass;
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
    const w = rec.world;
    const c = this.camState || rec.camBase.target;
    const px = c.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const py = c.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const s = samplePlateLight(this.lightTable, rec.name, this.plateState(rec), px, py);

    /* (2) SOL#3 — THE FIRE SPLIT, plate-sampled. How much of the light at this
       lens is the fire's is not a taste knob: it is the ratio of the plate's
       own ring luminance AT THE FIRE ANCHOR to the ring luminance where the
       lens is looking. A body standing in the hearth's pool gets a hot key and
       a hard orange rake; a body out at the pen gets the cool counter and very
       little fire. The hearth's live flicker rides on top of it. */
    const fa = rec.fireAnchor;
    const fpx = fa.x * w.S + PLATE_W / 2 - w.X(PLATE_W / 2) * w.S;
    const fpy = fa.z * w.S * w.SIN_E + PLATE_H / 2 - w.Z(PLATE_H / 2) * w.S * w.SIN_E;
    const fs = samplePlateLight(this.lightTable, rec.name, this.plateState(rec), fpx, fpy);
    const [sLo, sHi] = Stage3D.FIRE_SPLIT;
    const split = Math.min(sHi, Math.max(sLo, fs.lum / Math.max(6, s.lum)));
    const flick = 1 + 0.16 * (this.__fireK || 0) + 0.9 * this.flareK;
    const R = Stage3D.PLATE_RIG;
    rec.rig.key.intensity = R.key * split * flick;
    rec.rig.rim.intensity = R.rim * split * flick;
    rec.rig.cool.intensity = R.cool * (2.2 - split);
    rec.rig.fill.intensity = R.fill;
    /* the fill and the counter carry the ROOM's own colour (see _ambient):
       warm on the day shore, cold on the sea, ember-brown in the cave */
    {
      const amb = this._ambient(rec);
      rec.rig.fill.color.setRGB(amb[0], amb[1], amb[2]);
      rec.rig.fill.groundColor.setRGB(amb[0] * 0.42, amb[1] * 0.40, amb[2] * 0.44);
      const ck = new THREE.Color(Stage3D.COOL_KEY);
      rec.rig.cool.color.setRGB((ck.r + amb[0]) * 0.5, (ck.g + amb[1]) * 0.5,
                                (ck.b + amb[2]) * 0.5);
    }
    /* ROUND 5 — THE SPILL, from the plate's own falloff. Proximity to the
       hearth is now physics: a body at the fire takes several times the warm
       irradiance of a body at the pen, from the SAME anchor and therefore the
       same direction, which is what makes the fire read as one light on every
       character instead of a wash on whoever the lens is nearest. */
    if (rec.rig.spill) {
      const fo = this._fireFalloff(rec, this.plateState(rec));
      rec.rig.spill.distance = Math.max(4, Math.min(48, fo.halfM * 2.6));
      rec.rig.spill.intensity = Stage3D.SPILL_GAIN * split * flick
        * Math.max(0.35, Math.min(2.0, fo.L0 / 60));
      rec.rig.spill.position.set(fa.x, fa.y + 0.8, fa.z);
    }
    /* THE [firelight] GATE's switch: kill the warm triad and leave the cool
       counter, so the DIFFERENCE between two renders is the fire's own
       contribution per pixel — albedo cancels exactly, which is the only
       honest way to measure a light on bodies whose own colours differ. */
    if (this.fireOff) {
      rec.rig.key.intensity = 0; rec.rig.rim.intensity = 0;
      if (rec.rig.spill) rec.rig.spill.intensity = 0;
    }
    /* TRIED AND REJECTED (round 4): plate-sampling the triad's COLOUR as well
       as its intensity. It is the obvious next step from SOL#3 and it is
       wrong here, because the plate's colour is ALREADY applied per actor by
       the regrade — tinting the light too applies it twice. Measured: the
       cave's fire sample is warm enough that the giant's olive tunic fell from
       43.7 deg to 23.6 and the great ram's fleece from 45.3 to 23.5, both past
       the identity law's 20 deg (shots/sam2path-cal, /tmp cal2). The authored
       constants stay; the per-actor grade owns the plate's colour. */
    /* the triad AIMS at where the lens is looking, from the fire's own side */
    const look = this.__lookAt || (this.__lookAt = new THREE.Vector3());
    look.set(c.x, 0.9, c.z);
    rec.rig.key.target.position.copy(look);
    /* ROUND 5 — THE KEY RAKES, IT DOES NOT HANG. Sitting the warm key 5.5 m
       ABOVE the hearth aimed down at the floor made it a top light: measured
       through the [firelight] gate, the fire's own contribution on a body was
       within 4% between the half that faces the hearth and the half that does
       not (poly-seat 46.2 vs 46.8) — the "loose amber wash" Sol read at ii-05
       and iii-08. A hearth is a LOW source. At 1.8 m the same light rakes
       across a standing man from the fire's own side and the asymmetry is
       geometry, not grading. */
    rec.rig.key.position.set(fa.x, fa.y + 1.8, fa.z);
    rec.rig.rim.target.position.copy(look);
    /* the rake sits on the fire side but UPSTAGE of the body, so its light
       skims the silhouette edge the fire is on */
    const dx = look.x - fa.x, dz = look.z - fa.z;
    const dl = Math.hypot(dx, dz) || 1;
    rec.rig.rim.position.set(fa.x - dz / dl * 3.2, fa.y + 3.4, fa.z + dx / dl * 3.2 - 3.0);
    rec.rig.cool.target.position.copy(look);
    rec.rig.cool.position.set(look.x + (look.x - fa.x) * 0.9 + 2.0,
                              look.y + 6.5, look.z + (look.z - fa.z) * 0.9 + 4.0);
    rec.rig.key.target.updateMatrixWorld();
    rec.rig.rim.target.updateMatrixWorld();
    rec.rig.cool.target.updateMatrixWorld();

    /* (3) grade each body to the ring it stands in, and seat its contact
           shadow in the plate's own shadow colour (SOL#4) */
    for (const a of Object.values(this.actors)) {
      const at = this._gradeActor(rec, a, !this.gradeBypass);
      if (at) this._seatShadow(a, at);
    }
    /* (4) SOL#5 — the register post-pass follows the plate's own finish */
    this._registerPass(rec, s);

    const u = this.actors.ulysses;
    this.lightSample = { px: Math.round(px), py: Math.round(py),
                         rgb: s.rgb.map((v) => Math.round(v)), lum: +s.lum.toFixed(1),
                         fireK: +(this.__fireK || 0).toFixed(3),
                         fireAt: [Math.round(fpx), Math.round(fpy)],
                         fireLum: +fs.lum.toFixed(1), split: +split.toFixed(3),
                         key: +rec.rig.key.intensity.toFixed(3),
                         rim: +rec.rig.rim.intensity.toFixed(3),
                         cool: +rec.rig.cool.intensity.toFixed(3),
                         register: rec.finish || null,
                         grade: u && u.grade ? u.grade : null,
                         gradeLum: u && u.gradeLum !== undefined ? u.gradeLum : null };
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
    /* ROUND 5 — THE SCALE OF THE THING. Butler's stake is "as long and thick
       as the mast of a twenty-oared ship" and it is driven into a SEVEN-METRE
       eye; the 1.97 m prop read as a dark drinking-straw laid over the giant's
       head at iv-03. 2.2x puts it at 4.3 m — a beam five men carry. */
    stake.scale.setScalar(2.2);
    stake.rotation.z = Math.PI / 2 - 0.18;
    stake.visible = false;
    grp.add(stake);
    rec.api.root.add(grp);
    /* named so _retireScenery can spare it: these are the story's hand props,
       built into the set's root and therefore in the sweep's path */
    grp.name = 'story-props';
    rec.propsGroup = grp;
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
    /* SOL#1 — THE BOWL IS OFFERED, not carried. Round 3 put it on the hero's
       own mark at chest height, which is INSIDE his torso from this camera:
       the one readable action of iii-08 ("take this and drink some wine") had
       no visible object in it. Step it off the mark along the bowl-offer ->
       giant-seat axis, at the height of a lifted arm, so the hero's silhouette
       carries a held bowl pointed at the giant. */
    this.props.bowlAt = toWorld(700, 514);
    {
      const seat = toWorld(...GIANT_SEAT_PX);
      const dx = seat.x - this.props.bowlAt.x, dz = seat.z - this.props.bowlAt.z;
      const L = Math.max(1e-3, Math.hypot(dx, dz));
      /* ACROSS, barely UPSTAGE, and the step is measured in PLAN. The giant
         sits up-and-back, so a straight 0.6 m down that axis is only 0.23 m
         across (it reads as still inside the hero's torso) and 0.55 m upstage
         — past the firering-front cut at z 2.45, which swallowed it whole.
         Fix the lateral step in PLAN and take a fifth of the depth.
         ROUND 4 — A BOWL THAT DOES NOT TOUCH HIM IS NOT OFFERED. 0.55 m is
         23.6 plate px on a hero whose drawn half-width is ~16 px, so the cup
         cleared his silhouette entirely and read as a dark disc floating at
         his shoulder — the one readable action of iii-08 with no hand in it.
         0.34 m puts the cup's near half OVER his body edge and its far half
         out on the lit ground toward the giant: held, and still legible. */
      const step = 0.34 / Math.max(0.2, Math.abs(dx / L));
      this.props.bowlAt.x += (dx / L) * step;
      this.props.bowlAt.z += (dz / L) * step * 0.22;
    }
    /* AT HIS HANDS, and clear of the logbundle cut. 1.15 m floated the cup at
       his chin; 1.02 m is where a man carries a bowl he means to hand over,
       and it still draws at plate row ~473 — below the logbundle card's own
       ground (497), so the card cannot take it back. */
    this.props.bowlAt.y = 1.02;
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

  /**
   * SOL #6's switch, round 5. The cast pool is now UNIVERSAL (_castPool runs
   * for every upright body every frame off the same plate reading), so this
   * is only the per-actor veto the acts still hold — the doorway seat, where
   * the giant fills a 160 px mouth and a five-metre smear would run out of
   * the cave.
   */
  _scaleShadow(a, on) {
    a.poolOff = !on;
    if (!on && a.scaleShadow) a.scaleShadow.visible = false;
    return a.scaleShadow || null;
  }

  _off(a) {
    a.mode = 'off'; a.group.visible = false; a.walk = null; a.fade = null;
    a.opacity = 1; a.poseEuler = null;
    if (a.scaleShadow) a.scaleShadow.visible = false;
    if (a.gshadow) a.gshadow.visible = false;
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
                  (on(this.actors['poly-walk']) ? 1 : 0) +
                  (on(this.actors['poly-seat']) ? 1 : 0);
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
      /* councilCrew: the ledger's arc centroid, moved 472 -> 479 by the C2 lens
         audit — 472 put the arc's west man outside council-close's own window
         (west edge 463.2); 479 keeps all three in the audited sand pocket
         (450..495) AND inside the lens. */
      fire: [390, 480], council: [563, 499], councilCrew: [479, 507],
      twelveAtShip: [560, 503],
    };
    const caveMarks = {
      entry: [360, 450], cheeseRack: [640, 405], huddle: [933, 541],
      suppliant: [690, 512], giantSeat: GIANT_SEAT_PX, sword: [680, 554],
      scheme: [800, 530], lots: [713, 527], stakeHide: [782, 496],
      bowlOffer: [700, 514], sprawlHead: [664, 546], ramStand: [838, 430],
      ramAtMouth: [395, 438], doorwaySeat: [345, 470], mouth: [355, 438],
    };
    const mainlandLanding = new THREE.Vector3(45.5, 0, -20.5);
    const mainlandEntry = new THREE.Vector3(50.0, 1.35, -30.6);
    const MAINLAND_LOCAL = SHORE_WORLD.MAINLAND_S / SHORE_WORLD.S; /* the dual-scale ruling */

    /* THE GIANT IS THREE RIGS OF ONE BODY: the walk (he comes and goes), the
     * idle (he stands, he sprawls) and the SEAT (the ledger's ~165 px seated
     * silhouette). Only one is ever on the leaf, and the swap between them is
     * a 180 ms crossfade at a shared mark — the TELEPORT LAW's no-bare-swap
     * clause, applied to a rig change instead of a position change. */
    const GIANT_RIGS = { walk: 'poly-walk', idle: 'poly-idle', seat: 'poly-seat' };
    const giant = (mode) => {                    /* 'walk' | 'idle' | 'seat' */
      const want = S.actors[GIANT_RIGS[mode]];
      if (!want) return null;
      for (const [m, id] of Object.entries(GIANT_RIGS)) {
        if (m === mode) continue;
        const other = S.actors[id];
        if (other && other.group.visible && other.mode !== 'off') S._off(other);
      }
      return want;
    };
    /** whichever giant rig is standing on the leaf right now */
    S._giantOn = () => {
      for (const id of ['poly-seat', 'poly-idle', 'poly-walk']) {
        const a = S.actors[id];
        if (a && a.group.visible && a.mode !== 'off') return a;
      }
      return null;
    };
    /* THE SEAT ITSELF (C2). He works at the ledger's giant-seat mark, SEATED,
     * whole in the lens, his knees downstage toward the fire and his face
     * turned to the strangers. Sol #6 rides here too: the seated bulk gets a
     * long soft floor shadow thrown DOWNSTAGE-WEST — across the ground the
     * small hero stands on — so the size reads as space, not as layering. */
    const seatGiant = (rec, px = caveMarks.giantSeat, face = GIANT_SEAT_FACE,
                       shadow = true) => {
      const g = giant('seat');
      if (!g) return null;
      /* ROUND 5 — HE SITS IN THE FLOOR, not on it. The grounding law puts his
         lowest vertex exactly at y=0, which leaves a hard lit edge all round
         his rump and reads as a crouch hovering a finger above the ground
         (the owner's "his crouch floats"). A 0.12 m sink — 5 plate px on a
         7 m body — lets the floor cut the silhouette, and the contact set
         then has an edge to sit in. */
      const seatAt = rec.toWorld(...px);
      seatAt.y -= 0.12;
      S._stand(g, seatAt, face);
      S._scaleShadow(g, shadow);
      return g;
    };
    const giantSprawl = (rec, silent) => {
      const g = giant('idle');
      if (!g) return;
      if (g.mode === 'pose') return;             /* already down — idempotent */
      /* C2 — THE SPRAWL SITS ON ITS OWN LEDGER BOX. The anchor is the rig's
         ORIGIN (his soles), and laying a 7 m body down puts that origin at the
         FOOT end: measured through the stage (tools/ody/_stageprobe.mjs), the
         rendered plate box starts 293.4 px WEST of the anchor px. Anchored at
         814 the body drew [520.6..820.8] — 116 px west of the ledger's audited
         sprawl box [636.6..937.8] (round-7 placement audit #5), which laid his
         torso straight across the fire ring [531..735]. That is the frame Sol
         read as "the fire grows out of his torso", and it also stranded every
         thing staged AT the ledger: the auger drives to (668,528)->(702,533)
         and the bearers walk to 700..735, all of which were landing 100+ px
         off the body they act on. 930 - 293.4 = 636.6, the ledger's head end,
         so the eye comes back to the drive-tight lens's own aim point
         (676,495) and the stake meets the head it is driven into.
         The 2 px lift clears the meal-close bottom edge (571.6): the sprawl
         drew to 572.5 and ii-10's leaf ended on a foot crop. */
      /* ROUND 5 — THE LYING BODY TOUCHES THE FLOOR. The -90 deg X euler maps
         the rig's own DEPTH axis to world up (Rx(-90): local +Z -> world +Y),
         so a body centred in plan lies from -d/2 to +d/2 about its group
         origin and the lift that grounds it is exactly half its posed depth.
         The authored 1.05 m was a guess and floated him ~0.25 m (10 plate px)
         off the hearth — the "pile has no grounding" read. */
      const lay = (g.skinSize ? g.skinSize[2] : 1.6) * 0.5 - 0.03;
      const mid = rec.toWorld(930, 531, lay);
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
           of the twelve stand IN the frame, the rest are off it).
           C2 — THE ARC IS THE LEDGER'S ARC, NOT A DICE ROLL. A 2.6 m cluster
           on an 11.3 px/m set scatters bodies ±29 plate px, and i-07's lens is
           council-close (545,480) k8.6 — a 163.7 px window whose west edge is
           463.2. Measured, round 3: the three stood at plate x 452..462, ALL
           THREE ENTIRELY OUTSIDE the frame, so the "two-shot close over the
           huddle" the ledger records played as one man alone on empty sand
           (Sol: "he feels stranded"). The ledger names the arc itself —
           (460,504)(472,507)(484,509) in the sand pocket between the day goat
           (x<=450) and the stern curl (x>=495) — so stand them ON it, at the
           mark ±9 px, which is the widest arc that keeps every body inside
           both the pocket and the lens. */
        const crew = S._aliveCrew();
        const [cmx, cmy] = shoreMarks.councilCrew;
        const ARC = [[-9, -3], [0, 0], [9, 2], [18, 4]];
        const face = rec.toWorld(...shoreMarks.council);
        crew.forEach((c, i) => {
          const [dx, dy] = ARC[i % ARC.length];
          const p = rec.toWorld(cmx + dx, cmy + dy);
          S._stand(c, p, Math.atan2(face.x - p.x, face.z - p.z));
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
          /* the ledger's doorway-seat: "the blind giant SEATED filling the
             160 px mouth" — the mouth is 3.7 m, so only the seated silhouette
             fits it; standing he was twice the aperture */
          seatGiant(rec, caveMarks.doorwaySeat, 2.1, false);
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
        /* SEATED, working by the fire, head turned to the huddled strangers
           downstage-east — the face (and the one eye) plays to the lens. The
           ledger's law for this mark is a pixel law: ~165 px seated against
           300 px standing, so the seat is the pose, not a scale. */
        seatGiant(rec);
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
      milking: (rec, silent) => {                 /* dawn routine: back at his seat */
        seatGiant(rec);
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
        /* SOL#1 — THE HIDDEN STAKE IS HIDDEN. The act is "we hid it under the
           dung": a 0.22 m sink left the beam lying in plain sight for the rest
           of Beat III, and at iii-08 it drew as a dark bar across the giant's
           forearm — a second object competing with the one readable action.
           It goes under the floor and off the leaf; iv-01's stake-to-embers
           lifts it back (st.visible = true is the first thing that act does). */
        S._mover('stake-hide', 1.4, (k) => {
          st.position.y = y0 - easeInOut(k) * 0.62;
          if (k >= 1) st.visible = false;
        }, { silent });
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
        /* SOL #1 — ONE READABLE ACTION at III-08. The wine beat is Ulysses
           ALONE at the giant's knee ("I took a bowl of wine and offered it to
           him"); everything else on the leaf was competing with him at the
           frame edge — a cropped crew man, the great ram, four ewes, all at
           incompatible scales in the same corner. The company is hiding in the
           dark and the flock is in its painted pens, so the 3D clutter leaves
           the leaf here and the frame carries the hero, the giant and the
           ground between them. Beat V restages every one of them (cave-predawn
           for the ewes, ram-stand for the great ram, free-men for the crew). */
        for (const c of S._crew(CREW_POOL)) if (c.mode !== 'off') S._fade(c, 0, 1.1, silent);
        for (const id of ['ram-great', 'ewe-0', 'ewe-1', 'ewe-2', 'ewe-3']) {
          const a = S.actors[id];
          if (a && a.mode !== 'off') S._fade(a, 0, 1.3, silent);
        }
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
        /* ================= SOL#1 — THE AUGER SHOT, REBUILT =================
           Round 4's iv-03 was the frame Sol ranked worst: the giant cropped to
           a head in the corner, the stake crossing his face from nowhere, four
           bodies piled into one unreadable clump. The recompose is four rulings
           and every one of them is geometry, not taste:

             DEPTH ORDER   upstage the hearth, mid the lying giant, downstage
                           the two men — three separated plate bands (fire ring
                           bottom 507 · sprawl baseline 571 · men at 583/590),
                           so the frame reads back to front without a cue.
             GIANT WHOLE   the drive-tight lens re-valued to [790,500] k 2.6:
                           541 x 295 plate px, and the sprawl's own box
                           [636..930] sits inside it with margin (round 4's
                           [590,490] k 3.4 framed 383..797 and cut him in half).
             THE LINE      the beam runs from the men's hands at the LOWER LEFT
                           up into the eye at the upper right — one clean
                           diagonal across the empty floor, not over his hair.
             TWO ACTORS    Ulysses and ONE crewman flank the head instead of
                           standing on it (the crowd amendment's cap already
                           allows three; this shot takes two).                */
        const st = S.props.stake;
        const p0 = st.position.clone(), q0 = st.quaternion.clone();
        /* butt end low and downstage-west, tip in the eye: the group's origin
           is near the beam's middle, so aim it along butt -> eye */
        /* HEIGHTS ARE THE SHOT. The head lying on the hearth puts the eye at
           ~0.95 m; the men who lean on the beam carry it at chest height. Aim
           1.55 m into a face on the floor and the beam sails over his brow
           into the fire, which is the round-4 frame. */
        /* THE BEAM READS IN FRONT OF HIM OR IT DOES NOT READ. Depth on this
           stage is the plate ROW of a thing's own floor point, and the
           sprawled head's floor row is 531: a tip aimed at his eye's DRAWN
           position (701, 462) but seated at row 509 stands UPSTAGE of the
           head and the card stack swallows the whole beam — which is what the
           first recompose shipped. So the tip is placed DOWNSTAGE of him
           (row 556) and lifted to 2.35 m, which under this 25 deg ortho
           (39 px of drawn rise per metre) draws it exactly on his eye. Nine
           hundred millimetres of honest air between beam and face, invisible
           from the only camera this book has. */
        const butt = rec.toWorld(612, 596, 1.15);
        const eye = rec.toWorld(706, 556, 2.35);
        const toP = butt.clone().lerp(eye, 0.52);
        const toQ = new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0),
                              eye.clone().sub(butt).normalize());
        S._mover('stake-drive', 2.4, (k) => {
          const e = easeInOut(k);
          st.position.lerpVectors(p0, toP, e);
          st.quaternion.slerpQuaternions(q0, toQ, e);
        }, { silent });
        if (!silent) S.driveSpin = { t0: S.t + 1.2 };
        /* the two who lean on it: downstage of the sprawl's baseline (571) and
           of the woodpile card (ground 555), so they read in FRONT of the head
           and the beam passes over them into the eye */
        S._walkRoute(S.actors.ulysses, rec, [648, 517], [604, 583],
          { silent, label: 'cave:drive-u' });
        S._crew(1).forEach((c, i) => {
          S._walkRoute(c, rec, [668 + i * 9, 521 + (i % 3) * 5], [650, 590],
            { silent, delay: 0.15 * i, label: 'cave:drive-crew' });
        });
        /* the crew not in the shot stand off the leaf — a pile of four at one
           mark is what made round 4's frame unreadable */
        S._crew(CREW_CAP).slice(1).forEach((c) => S._fade(c, 0, 0.8, silent));
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
        if (silent) { seatGiant(rec, caveMarks.doorwaySeat, 2.1, false); return; }
        const g = giant('idle');
        if (!g) return;
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
        const seat = rec.toWorld(...caveMarks.doorwaySeat);
        const groping = S.actors['poly-idle'];
        if (!silent && groping && groping.mode === 'walk' && groping.walk) {
          const end = groping.walk.pts[groping.walk.pts.length - 1];
          if (end.distanceTo(seat) < 1.5) return;  /* the grope already ends there */
        }
        seatGiant(rec, caveMarks.doorwaySeat, 2.1, false);
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
        const w = this.actors['poly-walk'];
        for (const id of ['poly-idle', 'poly-seat'])
          if (this.actors[id]) this._off(this.actors[id]);
        if (w) this._walkRoute(w, rec, [340, 436], GIANT_SEAT_PX,
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
          const g = this._giantOn ? this._giantOn() : this.actors['poly-idle'];
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
        /* HE GOES OUT WITH THEM. The ledger gives iii-03..iii-05 (scheme,
           club, lots) no giant on the leaf — the men scheme because he is on
           the mountain. He drove the flock out; the seat empties with it. */
        {
          const seated = this.actors['poly-seat'], idle = this.actors['poly-idle'];
          for (const a of [seated, idle]) if (a && a.mode !== 'off') this._off(a);
          const w = this.actors['poly-walk'];
          if (w) {
            if (silent) { this._off(w); }
            else {
              this._walkRoute(w, rec, GIANT_SEAT_PX, [330, 438],
                { speed: GIANT_MPS, delay: 0.4, label: 'cave:giant-out' });
              this._fade(w, 0, 1.0, false);
              w.fade = { t0: this.t + Math.max(1.2, dur - 1.8), dur: 1.0, from: 1, to: 0 };
            }
          }
        }
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
        const w = this.actors['poly-walk'];
        for (const id of ['poly-idle', 'poly-seat'])
          if (this.actors[id]) this._off(this.actors[id]);
        if (w) this._walkRoute(w, rec, [340, 436], GIANT_SEAT_PX,
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
      for (const id of ['poly-seat', 'poly-idle', 'poly-walk']) {
        const g = this.actors[id];
        if (g && g.group.visible) {
          if (g.mode === 'pose')
            return g.group.getWorldPosition(V).add(new THREE.Vector3(-2.6, 0.6, 0));
          /* the seated head rides at the SEATED crown, not the standing one */
          const crown = id === 'poly-seat' ? GIANT_SEAT_CROWN_M : 6.4;
          return g.group.getWorldPosition(V).add(new THREE.Vector3(0, crown, 0));
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

  /* ================= SOL#5 round 5 — THE SOFT FINISH =================
   * The last thing that gives the composite away is FOCUS. The plates are
   * painted at 1408x768 and drawn up to a 1600-wide canvas, so every edge in
   * the world is a soft, slightly-scaled brush edge; a three.js render is
   * pixel-crisp with an MSAA silhouette. Sol's round-2 note #5 is exactly
   * this: "sharp 3D actors over soft enlarged plates".
   *
   * The levels and the grain already ride the actor materials' own shaders
   * (_installRegister). Focus cannot: a blur is a NEIGHBOURHOOD operator and a
   * fragment shader has no neighbours. So the frame is composited twice —
   * once whole, once with the character layer struck — and a fullscreen pass
   * blurs the frame WHERE THE TWO DIFFER. The mask is the character layer by
   * construction (nothing else can differ), it dilates by the tap radius so
   * the softening crosses the silhouette into the paint, and the plate itself
   * is untouched everywhere the mask is zero (the [plate] gate still measures
   * the painting byte-for-byte).
   */
  _soft() {
    if (this.__soft) return this.__soft;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const mat = new THREE.RawShaderMaterial({
      uniforms: { tScene: { value: null }, tPlate: { value: null },
                  uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 940) },
                  uSoft: { value: 1 }, uRadius: { value: 1.35 },
                  uGrain: { value: 0 }, uSeed: { value: new THREE.Vector2(17.31, 5.77) } },
      vertexShader: `precision highp float;
        attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
      /* THE RENDER TARGET IS LINEAR. three.js only honours outputColorSpace on
         the DEFAULT framebuffer — every non-XR render target is written in the
         working (linear-sRGB) space — and a RawShaderMaterial gets no
         colour-management chunk on the way out either. So this pass decodes
         each tap to display sRGB, does the softening THERE (a comp blur is a
         perceptual operation, and it is the space the plate's own grain and
         the register's levels already live in), and writes the encoded result
         to the canvas itself. Miss this and the whole book renders two stops
         dark — which is exactly what the first build of this pass shipped. */
      fragmentShader: `precision highp float;
        uniform sampler2D tScene; uniform sampler2D tPlate;
        uniform vec2 uTexel; uniform float uSoft; uniform float uRadius;
        uniform float uGrain; uniform vec2 uSeed;
        varying vec2 vUv;
        vec3 enc(vec3 c){
          c = max(c, vec3(0.0));
          return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055,
                     step(vec3(0.0031308), c));
        }
        void main(){
          vec3 sharp = enc(texture2D(tScene, vUv).rgb);
          vec3 acc = vec3(0.0); float wsum = 0.0; float m = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 off = vec2(float(i), float(j)) * uTexel * uRadius;
              vec3 a = enc(texture2D(tScene, vUv + off).rgb);
              vec3 b = enc(texture2D(tPlate, vUv + off).rgb);
              float w = (i == 0 && j == 0) ? 4.0 : ((i == 0 || j == 0) ? 2.0 : 1.0);
              acc += a * w; wsum += w;
              m = max(m, smoothstep(0.012, 0.075, length(a - b)));
            }
          }
          vec3 soft = acc / wsum;
          vec3 rc = mix(sharp, soft, m * uSoft);
          /* THE GRAIN RIDES THE FINISH, not the material. A 3x3 blur divides a
             per-fragment noise sigma by ~2.7, so grain added upstream of this
             pass is gone by the time the frame lands — the character layer
             would lose the one thing that ties it to the painting's own
             surface. It is added HERE, after the softening, at the plate's
             own measured amplitude, and masked so the painting keeps its own. */
          float rn = fract(sin(dot(gl_FragCoord.xy + uSeed,
                                   vec2(12.9898, 78.233))) * 43758.5453);
          rc += (rn - 0.5) * uGrain * m;
          gl_FragColor = vec4(clamp(rc, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(geo, mat);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    this.__soft = { scene, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
                    rtA: null, rtB: null, w: 0, h: 0 };
    return this.__soft;
  }

  /** the geometric gates measure raw pixels — they turn the finish off */
  setSoftBypass(on) { this.softBypass = !!on; return this.softBypass; }

  /** the [firelight] gate strikes the warm triad and re-renders */
  setFireOff(on) { this.fireOff = !!on; this._plateLightStep(); return this.fireOff; }

  render() {
    const rec = this.sets[this.activeName];
    if (!rec || !rec.built) return;
    const sz = this.renderer.getDrawingBufferSize(
      this.__sz || (this.__sz = new THREE.Vector2()));
    if (this.softBypass || sz.x < 8 || sz.y < 8) {
      this.renderer.render(rec.scene, this.cam);
      this.renders++;
      return;
    }
    const S = this._soft();
    if (S.w !== sz.x || S.h !== sz.y) {
      if (S.rtA) { S.rtA.dispose(); S.rtB.dispose(); }
      /* HALF FLOAT, not bytes: the target holds LINEAR light and eight linear
         bits band visibly through a cave lit to L* 14 — the darks are where
         this whole book lives. */
      const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
                    samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      S.rtA = new THREE.WebGLRenderTarget(sz.x, sz.y, opt);
      S.rtB = new THREE.WebGLRenderTarget(sz.x, sz.y, opt);
      S.w = sz.x; S.h = sz.y;
      S.mat.uniforms.uTexel.value.set(1 / sz.x, 1 / sz.y);
    }
    /* (1) the whole frame */
    this.renderer.setRenderTarget(S.rtA);
    this.renderer.render(rec.scene, this.cam);
    /* (2) the same frame with the 3D layer struck — the mask's other half */
    const layerWas = this.actorLayer.visible;
    const propsWas = rec.propsGroup ? rec.propsGroup.visible : null;
    this.actorLayer.visible = false;
    if (rec.propsGroup) rec.propsGroup.visible = false;
    this.renderer.setRenderTarget(S.rtB);
    this.renderer.render(rec.scene, this.cam);
    this.actorLayer.visible = layerWas;
    if (rec.propsGroup) rec.propsGroup.visible = propsWas;
    /* (3) blur what differs */
    S.mat.uniforms.tScene.value = S.rtA.texture;
    S.mat.uniforms.tPlate.value = S.rtB.texture;
    S.mat.uniforms.uSoft.value = this.softK === undefined ? 1 : this.softK;
    S.mat.uniforms.uGrain.value = this.grainBypass ? 0 : (this.reg.grain.value || 0);
    this.renderer.setRenderTarget(null);
    this.renderer.render(S.scene, S.cam);
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
