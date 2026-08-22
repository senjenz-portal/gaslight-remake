/**
 * shots3d_bake.mjs — THE SHOT TABLE, baked.
 *
 * THE DEFECT (owner, 2026-08-21): "the camera is weird, it does not feel like
 * a story". The 3D book was read through ONE orthographic god-view at each
 * set's painted elevation — a diorama viewer with a zoom knob. Every unit got
 * the same eye: nobody's, hovering twenty metres up, tilted 25 degrees down.
 * A story is told by a camera that STANDS SOMEWHERE, at the height of a person,
 * and looks at whoever is speaking.
 *
 * THE LAW THIS BAKES. The 2D book's CLOSE-UP LAW (a character close is >= 30%
 * of the panel height) translated to true 3D cameras, plus the shot grammar the
 * contract's staging column already implies:
 *
 *   DIALOGUE  eye-level (1.6 m — human height) close or over-shoulder on the
 *             SPEAKER; the speaker >= 30% of FRAME HEIGHT. For POLYPHEMUS's
 *             lines the camera drops to a man's eye and looks UP so that he
 *             towers — that is not a camera choice, that is the story.
 *   NARRATION motivated moves: a slow push-in through a speech (2-6 cm/s).
 *   ACTION    the camera goes WITH the bodies: a lateral track on a walk, a
 *             crane down from the establishing wide at each heading.
 *   WIDE      one per beat, at the heading, and then we are INSIDE.
 *   GATE      the reader's target framed DOMINANT, with look-room.
 *   CLOCK     the blinding takes subtle handheld; a rock throw tracks the arc
 *             and WHIPS to the splash.
 *   POV       the under-fleece moment is kept exactly as it was.
 *
 * THE FRAMING LAW (how a distance is chosen, never by taste):
 *   a subject of stature h metres fills a fraction f of the frame height at
 *       d = h / (2 f tan(fov/2))
 *   so `frac` is the shot's declared size and `d` follows. The class floor is
 *   then a property of the table itself, not a hope about it.
 *
 * THE PROSCENIUM LAW. Every set in this book is a CUTAWAY: the shore, the sea
 * and the cave are modelled as rooms with the fourth wall removed (the cave is
 * literally a bowl sliced open on its downstage face). So the camera lives in
 * the audience half-space and looks upstage — exactly the rule a film set
 * follows. Each set declares a CAMERA VOLUME (an ellipse in the ground plane
 * plus a height band) and the ledger's own obstacle boxes; the solver searches
 * bearings inside the set's cone for a station that is inside the volume and
 * out of the furniture, shrinking the distance only if nothing fits (a shorter
 * distance makes the subject BIGGER, so the class floor can never be lost to
 * the search).
 *
 * Output: site-deploy/living-odyssey/3d/shots3d.json — one row per unit, each
 * carrying {pos, lookAt, fov, move, dof} as the task requires, plus the frame
 * law that produced it so the runtime can re-solve against the LIVE body.
 *
 *   node tools/ody/shots3d_bake.mjs [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'site-deploy', 'living-odyssey', '3d', 'shots3d.json');
const MARKS_FILE = path.join(REPO, 'tools', 'ody', 'shots3d_marks.json');
const UNITS_JS = path.join(REPO, 'site-deploy', 'living-odyssey', 'app', 'units.js');

/* THE FRAMES — the ledger's own survey, and the same numbers 3d/app3d/world.js
   holds as the book's scale authority. X(px) = (px−CX)/S ·
   Z(py) = (py−CY)/(S·sin e). Nothing here may disagree with world.js. */
const FRAME = {
  shore: { S: 11.3, CX: 438, CY: 466, elev: 28 },
  cave: { S: 43.0, CX: 704, CY: 460, elev: 25 },
  sea: { S: 12.7, CX: 704, CY: 470, elev: 30 },
};

const D2R = Math.PI / 180;

/* ====================================================================== *
 * THE SETS: world frame, camera volume, the furniture the camera may not
 * stand in. All of it is the ledger's own arithmetic — nothing new is
 * invented here, the plan is read out of lenses.json at bake time.
 * ====================================================================== */
const SETS = {
  shore: {
    /* the beach is open ground; the camera may stand well downstage of the
       camp and anywhere along the strand, but never out past the surf line */
    vol: { cx: 4, cz: 8, rx: 62, rz: 40, ry: 1e4, ymin: 1.0, ymax: 30 },
    cone: 88,                       /* how far off the hint the solver may swing */
    wide: { camY: 15, dist: 46, fov: 36 },
  },
  cave: {
    /* the bowl. DOME is centred (0.8, -2.2) with rx 14.8 / rz 9.4; the camera
       volume is a hand inside that so a station never sits in the shell, and
       the height band stops under the crown lip. */
    /* the inner shell is rx 14.25 / ry 9.2 / rz 8.85 about (0.8, 0, -2.2);
       0.78 of it keeps a hand of rock between the lens and the outside */
    vol: { cx: 0.8, cy: 0, cz: -2.0, rx: 13.4, ry: 8.6, rz: 8.2, k: 0.78,
           ymin: 0.55, ymax: 6.6 },
    cone: 96,
    wide: { camY: 6.2, dist: 11.5, fov: 44 },
  },
  sea: {
    /* open water: the camera is a second boat. It may not climb the headland
       (the cliff mass is an obstacle) and it stays off the splash columns. */
    vol: { cx: -8, cz: 2, rx: 52, rz: 38, ry: 1e4, ymin: 1.2, ymax: 34 },
    cone: 92,
    wide: { camY: 9.5, dist: 42, fov: 40 },
  },
};

/* the ledger obstacle boxes, plate px — the camera obeys the parking law too */
const OBSTACLES = {
  shore: {
    campfireRing: [[403, 431], [473, 501]], dayGoat: [[395, 465], [450, 530]],
    sternCurlMass: [[495, 430], [545, 488]], ship1Oars: [[574, 488], [639, 512]],
  },
  cave: {
    mouthAperture: [[290, 250], [405, 415]],
    rackA: [[535, 195], [625, 385]], rackB: [[638, 160], [712, 345]],
    rackC: [[716, 135], [792, 340]], rackD: [[800, 130], [880, 330]],
    floorCheeses: [[600, 342], [665, 390]],
    fireRingOuter: [[527, 418], [733, 500]], fireRingRimNW: [[485, 425], [527, 485]],
    firewood: [[495, 495], [620, 555]], logBundle: [[645, 462], [745, 497]],
    mainPen: [[775, 290], [1050, 425]], frontPen: [[860, 425], [1090, 525]],
    bed: [[1025, 330], [1240, 500]], milkTub: [[865, 470], [915, 520]],
    clayBowl: [[805, 505], [860, 535]], logsRight: [[1105, 480], [1180, 520]],
  },
  sea: {
    cliffMass: [[690, 150], [1270, 600]],
    splashImpact1: [[448, 485], [488, 525]], splashImpact2: [[435, 520], [475, 560]],
  },
};


/* ====================================================================== *
 * THE CLASS TABLE. floor = the minimum share of FRAME HEIGHT the subject
 * may occupy in that class (the close-up law's floor, now in 3D); pushMax =
 * the fastest a motivated push may travel in that class, cm/s.
 * ====================================================================== */
const SPEAKING = new Set(['DIALOGUE', 'OTS', 'GIANT']);
const CLASSES = {
  DIALOGUE:  { floor: 0.30, pushMax: 6,  note: 'eye-level close on the speaker' },
  OTS:       { floor: 0.30, pushMax: 6,  note: 'over the listener onto the speaker' },
  GIANT:     { floor: 0.42, cap: 0.96, pushMax: 8, crownPitch: 21,
               note: 'LOW ANGLE up at Polyphemus — the lens is below him and near enough that his crown climbs the frame' },
  NARRATION: { floor: 0.20, pushMax: 6,  note: 'the teller\'s voice over a motivated move' },
  ACTION:    { floor: 0.17, pushMax: 45, note: 'the camera goes with the bodies' },
  GATE:      { floor: 0.22, cap: 0.92, pushMax: 20, note: 'the reader\'s target, dominant, with look-room' },
  CLOCK:     { floor: 0.18, cap: 0.94, pushMax: 60, note: 'the beat clock owns the move' },
  WIDE:      { floor: 0.045, pushMax: 60, note: 'one per beat, at the heading' },
  POV:       { floor: 0.00, pushMax: 999, note: 'kept: the under-fleece eye' },
};

/* ====================================================================== *
 * THE SCREEN-DIRECTION SYSTEM (round 2).
 *
 * "The cutting lacks a stable eyeline/screen-direction system." So the book
 * picks one and HOLDS it: IN THE CAVE, THE GIANT IS ALWAYS FRAME RIGHT AND
 * THE MEN ARE ALWAYS FRAME LEFT. Every cut between them therefore answers the
 * cut before it — his look goes left, theirs goes right, and a reader never
 * has to re-learn who is where. The things the men carry and act on (the
 * bowl, the stake, the sword, the great ram) belong to the men's side; the
 * room's own geography (the mouth, the boulder, the club on the wall) is not
 * an actor and is left unpinned. Out at sea the axis is the same one the cave
 * ended on: the island and its giant are frame RIGHT, the ship frame LEFT,
 * which is also the direction she is sailing away in.
 * ====================================================================== */
const AXIS_RIGHT = new Set(['poly-seat', 'poly-idle', 'poly-walk', 'cyclops', 'giant']);
const AXIS_LEFT = new Set(['ulysses', 'crew-0', 'crew-1', 'crew-2', 'crew-3',
  'bowl', 'stake', 'sword', 'fire', 'ram-great']);
function axisSide(spec) {
  if (spec.side !== undefined) return spec.side;         /* an authored override */
  /* THE AXIS EXISTS BECAUSE OF THE GIANT. On the shore there is no counter-
     party to answer across a cut, and the crew restage around the fire between
     units, so pinning a side there is not a system — it is a coin toss the
     live staging then loses (measured: the council's Ulysses walks to +x while
     the bake found him at -x). Beat I keeps the look-room heuristic. */
  if (spec.__set === 'shore') return 0;
  if (spec.cls === 'WIDE') return 0;                     /* a wide has no side */
  const name = spec.sub.a || spec.sub.t || spec.sub.p || null;
  if (!name) return 0;                                   /* a plate mark: geography */
  if (AXIS_RIGHT.has(name)) return 1;
  if (AXIS_LEFT.has(name)) return -1;
  return 0;
}
/* THE PIN, and only the pin. Where an UNPINNED shot happened to land is not a
   law and must never be gated as one — a gate that asserts the observed value
   asserts nothing. 0 means "this row is not on the axis". */
function sideOf(spec) { return axisSide(spec) || 0; }
const sideLandedOf = (r) => (Math.abs(r.projCx) < 0.04 ? 0 : (r.projCx > 0 ? 1 : -1));

/* THE READABILITY LAW, per class. How much motivated fill and rim the SUBJECT
 * OF THE LINE carries, as a multiple of the set's own motivation. A wide is
 * lit by the room; a face, a hand and an action are not left to the room. */
const READ_BY_CLASS = {
  DIALOGUE: { fill: 1.0, rim: 1.0 }, OTS: { fill: 1.0, rim: 0.95 },
  GIANT: { fill: 1.05, rim: 1.15 }, NARRATION: { fill: 0.8, rim: 0.85 },
  ACTION: { fill: 0.95, rim: 1.05 }, GATE: { fill: 1.0, rim: 1.1 },
  CLOCK: { fill: 1.0, rim: 1.15 }, WIDE: { fill: 0.3, rim: 0.4 },
  POV: { fill: 0.5, rim: 0.6 },
};
function readOf(spec) {
  const base = READ_BY_CLASS[spec.cls] || { fill: 1, rim: 1 };
  const r = { ...base, ...(spec.read || {}) };
  /* the fill comes from the side the subject is composed AWAY from, so it
     lands on the shadow cheek and the rim draws the frame-edge shoulder */
  r.side = r.side !== undefined ? r.side : (axisSide(spec) || 1);
  return { fill: +r.fill.toFixed(2), rim: +r.rim.toFixed(2), side: r.side };
}

/* ====================================================================== *
 * THE AUTHORED SPEC — one row per unit, off the contract's staging column
 * and the ledger's own marks. Shorthand:
 *   sub  {a:'<actor>'} live actor · {m:[px,py],h,y} a ledger mark ·
 *        {t:'<gate target>',h} the reader's target · {p:'<prop>',h} a hand prop
 *   from [px,py] where the camera stands (direction hint; the framing law
 *        sets the distance) — or bear: degrees off downstage (+Z), +east
 *   comp [x,y] where the subject sits in the frame, NDC — the look-room
 *   move  push | track | crane | tilt | whip | handheld | orbit | hold
 * ====================================================================== */
const SPEC = {
  /* ---------------- BEAT I · THE TALE BEGUN — shore ---------------- */
  'ody-i-00-head': { cls: 'WIDE', sub: { m: [520, 470], h: 11, y: 2.5 }, from: [470, 740],
    camY: 15, fov: 36, dist: 44, comp: [0, 0.06],
    move: { k: 'crane', dy: 9, dz: 5, dur: 7 }, dof: { f: 8, near: 0.55 } },
  'ody-i-01-bard': { cls: 'NARRATION', sub: { m: [500, 474], h: 6.2, y: 1.6 }, from: [455, 700],
    camY: 4.6, fov: 33, comp: [-0.08, 0.05], move: { k: 'push', cms: 4.0 }, dof: { f: 5.6 } },
  'ody-i-02-iamulysses': { cls: 'ACTION', sub: { a: 'ulysses' }, from: [300, 596],
    camY: 1.72, fov: 34, frac: 0.36, comp: [-0.15, 0.04],
    move: { k: 'track', m: 1.1, dur: 9 }, follow: true, dof: { f: 4 } },
  'ody-i-03-troy': { cls: 'NARRATION', sub: { a: 'ulysses' }, from: [332, 588],
    camY: 1.62, fov: 27, frac: 0.55, comp: [-0.16, 0.06],
    move: { k: 'push', cms: 3.0 }, dof: { f: 2.8 } },
  'ody-i-04-lawless': { cls: 'ACTION', sub: { m: [980, 205], h: 13, y: 6.5 }, from: [520, 560],
    camY: 2.4, fov: 15, dist: 64, comp: [0.10, -0.05],
    move: { k: 'push', cms: 22 }, dof: { f: 11, near: 0.4 } },
  'ody-i-05-dawn': { cls: 'ACTION', sub: { a: 'ulysses' }, from: [372, 640],
    camY: 4.4, fov: 40, frac: 0.21, comp: [-0.10, 0.10],
    move: { k: 'crane', dy: 3.6, dz: 2.4, dur: 8 }, dof: { f: 8 } },
  'ody-i-06-smoke': { cls: 'NARRATION', sub: { m: [479, 507], h: 1.7, y: 0.85 }, from: [575, 610],
    camY: 1.66, fov: 32, frac: 0.31, comp: [-0.13, 0.04],
    move: { k: 'push', cms: 3.5 }, dof: { f: 3.5 } },
  /* SOL #5 — THE COUNCIL IS A COUNCIL, NOT A CENTRED SINGLE. Round 1 read as
     "excessive headroom, no council geometry, no eyeline, a rock dominating
     the right". The operator now stands A STRIDE BEHIND THE LISTENER'S
     SHOULDER (`behind`, so the distance is the geometry's, not a wish), two
     crew shoulders soft in the near foreground (`over` + `fg`), the speaker on
     the left third with the look-room he is speaking INTO carrying the ship —
     the axis every reaction in Beat I then obeys. */
  'ody-i-07-council': { cls: 'OTS', sub: { a: 'ulysses' }, over: 'crew-0',
    from: [455, 596], behind: 1.35, overSide: 2.5,
    camY: 1.62, fov: 32, comp: [0.20, -0.02],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.5 }, gateTarget: 'ship' },
  'ody-i-08-cave': { cls: 'ACTION', sub: { m: [1008, 290], h: 9, y: 3.6 }, from: [700, 530],
    camY: 3.0, fov: 22, dist: 38, comp: [0.06, -0.04],
    move: { k: 'push', cms: 28 }, dof: { f: 8 } },
  'ody-i-09-monster': { cls: 'NARRATION', sub: { m: [1050, 200], h: 22, y: 10 }, from: [690, 520],
    camY: 2.2, fov: 27, dist: 56, comp: [0.05, -0.14],
    move: { k: 'tilt', dy: 7.0, dur: 9 }, dof: { f: 11 } },
  'ody-i-10-wineskin': { cls: 'NARRATION', sub: { m: [560, 503], h: 1.7, y: 0.85 }, from: [470, 606],
    camY: 1.66, fov: 30, frac: 0.34, comp: [-0.13, 0.05],
    move: { k: 'push', cms: 3.2 }, dof: { f: 3.2 } },
  'ody-i-11-twentyone': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [498, 588],
    camY: 1.56, fov: 24, frac: 0.66, comp: [0.16, 0.05],
    move: { k: 'push', cms: 2.4 }, dof: { f: 2.2 } },
  'ody-i-12-misgave': { cls: 'NARRATION', sub: { m: [1008, 290], h: 9, y: 3.6 }, from: [780, 540],
    camY: 2.4, fov: 24, dist: 24, comp: [0.04, -0.06],
    move: { k: 'push', cms: 5.0 }, dof: { f: 5.6 } },

  /* ---------------- BEAT II · THE CAVE — cave ---------------- */
  /* SOL #7 — THE CAVE ESCALATION LADDER (see ESCALATION below). Beat II is the
     one true master and it is the LOW, EXPLORATORY one: the height of a man
     who has just walked in, a lateral drift that finds the room rather than
     presenting it. */
  'ody-ii-00-head': { cls: 'WIDE', sub: { m: [700, 455], h: 4.8, y: 2.7 }, bear: 58,
    camY: 1.55, fov: 56, dist: 7.6, comp: [0, 0.04],
    move: { k: 'track', m: 1.9, dur: 8 }, dof: { f: 8, near: 0.5 } },
  'ody-ii-01-beg': { cls: 'NARRATION', sub: { m: [640, 405], h: 2.7, y: 1.35 }, from: [660, 620],
    camY: 1.70, fov: 30, frac: 0.50, comp: [-0.12, 0.03],
    move: { k: 'push', cms: 3.4 }, dof: { f: 3.5 } },
  'ody-ii-02-present': { cls: 'NARRATION', sub: { m: [430, 432], h: 3.0, y: 1.5 }, from: [560, 600],
    camY: 1.66, fov: 32, frac: 0.44, comp: [-0.14, 0.02],
    move: { k: 'push', cms: 3.0 }, dof: { f: 4 } },
  'ody-ii-03-return': { cls: 'ACTION', sub: { m: [933, 541], h: 1.8, y: 0.9 }, from: [860, 640],
    camY: 1.35, fov: 34, frac: 0.30, comp: [0.12, 0.04],
    move: { k: 'push', cms: 5.5 }, dof: { f: 2.8 } },
  'ody-ii-04-boulder': { cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 }, from: [560, 600],
    camY: 1.70, fov: 34, frac: 0.55, comp: [-0.08, 0.02],
    move: { k: 'push', cms: 12 }, dof: { f: 4 } },
  /* SOL #4a — THE REVEAL NEEDS A MAN IN IT. An isolated upright shape is not
     a giant; a giant is a thing with a person at its feet. The hero himself
     (not a spare crewman) is the foreground scale reference, the lens is a
     25 mm-equivalent (fov 50 on a 24 mm sensor height) and the camera is at a
     man's WAIST, so the crown climbs the frame instead of sitting in it. */
  'ody-ii-05-strangers': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [960, 590],
    camY: 1.05, fov: 50, frac: 0.66, comp: [0.10, -0.04],
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.8 }, fg: 'ulysses', intro: true },
  /* SOL #4b — THE PLEA IS SHOT OVER THE GIANT, NOT BESIDE HIM. Round 1 put two
     similarly sized figures in a flat lineup and destroyed the scale the
     reveal had just built. The camera now rides the seated giant's shoulder
     (camY 3.4 — where that shoulder actually is) and looks sharply DOWN at the
     suppliant, so his smallness is the composition, not a caption. */
  'ody-ii-06-plea': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, over: 'poly-seat', from: [640, 640],
    behind: 1.25, overSide: 24,
    camY: 3.40, fov: 34, frac: 0.42, comp: [-0.19, -0.06],
    move: { k: 'push', cms: 2.8 }, dof: { f: 2.5 } },
  'ody-ii-07-pitiless': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [612, 610],
    camY: 1.52, fov: 46, frac: 0.66, comp: [0.14, 0.03],
    move: { k: 'push', cms: 3.4 }, dof: { f: 2.8 } },
  'ody-ii-08-shipfast': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [880, 600],
    camY: 1.50, fov: 44, frac: 0.70, comp: [-0.13, 0.03],
    move: { k: 'push', cms: 3.0 }, dof: { f: 2.8 } },
  'ody-ii-09-shiplie': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, over: 'poly-seat', from: [612, 636],
    camY: 1.58, fov: 26, frac: 0.62, comp: [-0.17, 0.05],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.2 } },
  'ody-ii-10-firstmeal': { cls: 'ACTION', sub: { a: 'poly-seat' }, from: [900, 596],
    camY: 1.45, fov: 44, frac: 0.62, comp: [-0.12, 0.00],
    move: { k: 'handheld', amp: 0.010, dur: 6 }, dof: { f: 2.8 } },
  'ody-ii-11-sword': { cls: 'GATE', sub: { t: 'sword', h: 1.0 }, at: [680, 554], atY: 0.85,
    over: 'ulysses', from: [640, 660],
    camY: 1.35, fov: 30, frac: 0.30, comp: [-0.16, 0.03],
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.2 } },
  'ody-ii-12-shiftstone': { cls: 'NARRATION', sub: { m: [352, 430], h: 4.6, y: 2.2 }, from: [600, 620],
    camY: 1.62, fov: 32, frac: 0.42, comp: [-0.10, 0.02],
    move: { k: 'push', cms: 3.0 }, dof: { f: 4 } },
  'ody-ii-13-tillmorning': { cls: 'NARRATION', sub: { m: [700, 470], h: 3.0, y: 1.3 }, bear: 62,
    camY: 1.9, fov: 40, frac: 0.30, comp: [0, 0.04],
    move: { k: 'push', cms: 4.0 }, dof: { f: 5.6 } },

  /* ---------------- BEAT III · NOBODY — cave ---------------- */
  /* SOL #7 — rung 2: TIGHTER AND FIRE-DOMINATED. The conspiracy is hatched at
     the blaze, so the heading is anchored on the fire, a step closer and a
     step lower than Beat II's master, and printed down so the flame keeps its
     detail instead of clipping to white. */
  'ody-iii-00-head': { cls: 'WIDE', sub: { m: [640, 468], h: 3.9, y: 2.2 }, bear: -64,
    camY: 1.25, fov: 50, dist: 6.6, comp: [0.04, 0.03],
    move: { k: 'push', cms: 9 }, dof: { f: 8, near: 0.5, expo: 0.88 } },
  'ody-iii-01-morningmeal': { cls: 'ACTION', sub: { m: [852, 470], h: 2.0, y: 1.0 }, from: [800, 640],
    camY: 1.40, fov: 34, frac: 0.40, comp: [0.12, 0.02],
    move: { k: 'push', cms: 4.5 }, dof: { f: 2.8 } },
  'ody-iii-02-quiverlid': { cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 }, from: [620, 610],
    camY: 1.62, fov: 33, frac: 0.48, comp: [-0.10, 0.02],
    move: { k: 'push', cms: 9 }, dof: { f: 4 } },
  'ody-iii-03-scheme': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [880, 618],
    camY: 1.56, fov: 26, frac: 0.64, comp: [0.16, 0.05],
    move: { k: 'push', cms: 2.4 }, dof: { f: 2.2 } },
  'ody-iii-04-club': { cls: 'NARRATION', sub: { m: [880, 380], h: 5.6, y: 2.6 }, from: [820, 620],
    camY: 1.70, fov: 36, frac: 0.44, comp: [0.10, -0.04],
    move: { k: 'push', cms: 3.6 }, dof: { f: 4 } },
  'ody-iii-05-lots': { cls: 'ACTION', sub: { m: [713, 527], h: 1.8, y: 0.9 }, from: [700, 660],
    camY: 2.35, fov: 36, frac: 0.34, comp: [0, 0.06],
    move: { k: 'orbit', deg: 9, dur: 9 }, dof: { f: 3.5 } },
  'ody-iii-06-return': { cls: 'NARRATION', sub: { m: [420, 434], h: 4.4, y: 2.1 }, from: [660, 606],
    camY: 1.64, fov: 33, frac: 0.40, comp: [-0.12, 0.02],
    move: { k: 'push', cms: 4.0 }, dof: { f: 4.5 } },
  'ody-iii-07-suppertwo': { cls: 'ACTION', sub: { a: 'poly-seat' }, from: [905, 600],
    camY: 1.45, fov: 44, frac: 0.62, comp: [-0.12, 0.00],
    move: { k: 'handheld', amp: 0.010, dur: 6 }, dof: { f: 2.8 } },
  /* SOL #6 — THE BOWL BEAT MUST FEATURE THE BOWL. Round 1 crushed the man to
     silhouette, clipped the fire to white and let the logs cut the frame. The
     bowl now sits in the LOWER FOREGROUND (comp y well under the centre) with
     the hand that offers it, the frame is printed down for the blaze (expo)
     so the flame keeps detail instead of blooming, and the focus RACKS from
     the bowl to the giant — the reveal is the rack, not a blur. */
  'ody-iii-08-lookhere': { cls: 'GATE', sub: { p: 'bowl', h: 0.75 }, over: 'ulysses',
    station: [0.80, 1.05, 5.00], fov: 46, comp: [-0.20, -0.30],
    rack: { from: 'p:bowl', to: 'h:POLYPHEMUS', at: 2.6, dur: 1.0 },
    move: { k: 'push', cms: 4.0 }, dof: { f: 2.0, expo: 0.86 } },
  'ody-iii-09-besokind': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [700, 620],
    camY: 1.48, fov: 48, frac: 0.72, comp: [0.10, 0.02],
    move: { k: 'push', cms: 3.4 }, dof: { f: 2.5 } },
  'ody-iii-10-thrice': { cls: 'ACTION', sub: { a: 'poly-seat' }, from: [860, 606],
    camY: 1.44, fov: 46, frac: 0.68, comp: [-0.11, 0.01],
    move: { k: 'handheld', amp: 0.012, dur: 8 }, dof: { f: 2.8 } },
  'ody-iii-11-noman': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, over: 'poly-seat', from: [636, 646],
    camY: 1.58, fov: 25, frac: 0.66, comp: [-0.17, 0.05],
    move: { k: 'push', cms: 2.2 }, dof: { f: 2.0 } },
  'ody-iii-12-nomanlast': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [790, 616],
    camY: 1.48, fov: 46, frac: 0.72, comp: [0.12, 0.02],
    move: { k: 'push', cms: 3.0 }, dof: { f: 2.5 } },
  'ody-iii-13-neck': { cls: 'ACTION', sub: { a: 'poly-seat' }, from: [700, 650],
    camY: 1.15, fov: 48, frac: 0.60, comp: [0.06, -0.06],
    move: { k: 'crane', dy: 1.5, dz: 0.5, dur: 5 }, dof: { f: 2.8 } },

  /* ---------------- BEAT IV · THE STAKE — cave ---------------- */
  /* SOL #7 — rung 3: THE FLOOR. The blinding's heading is the lowest and
     tightest of the ladder — the room has stopped being a room and become the
     ground the men are about to work on. */
  'ody-iv-00-head': { cls: 'WIDE', sub: { m: [676, 474], h: 3.0, y: 1.65 }, bear: -80,
    camY: 0.95, fov: 46, dist: 5.4, comp: [0.05, 0.05],
    move: { k: 'push', cms: 7 }, dof: { f: 8, near: 0.5, expo: 0.9 } },
  'ody-iv-01-embers': { cls: 'GATE', sub: { p: 'fire', h: 1.5 }, from: [640, 646],
    camY: 1.10, fov: 32, frac: 0.34, comp: [-0.10, 0.00],
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.5 } },
  'ody-iv-02-glowing': { cls: 'GATE', sub: { p: 'stake', h: 1.1 }, from: [636, 640],
    camY: 1.05, fov: 28, frac: 0.30, comp: [-0.13, 0.02],
    move: { k: 'push', cms: 4.0 }, dof: { f: 2.0 } },
  /* SOL #1 — THE AUGER SHOT, FROM THE FLOOR, ALONG THE BEAM. Round 1's worst
     frame: "most of the frame is an unreadable black occlusion; the auger, its
     target and the attackers' effort are invisible." The camera is now on the
     cave floor (y 0.60, the lowest the volume allows) out on the men's side of
     the shaft, so the beam ENTERS THE LOWER-LEFT CORNER on the four men's
     hands, runs up across the frame, and POLYPHEMUS's eye sits on the opposite
     third. Depth carries tip AND eye at f/2.2, then RACKS decisively between
     them. The screen-direction system does the rest: the beam is the men's, so
     it is frame left; the giant is frame right, as he is in every cave cut. */
  /* THE STATION IS THE SOLVER'S, THE HEIGHT AND THE DEPTH ARE THE DP'S. Three
     authored stations were tried and photographed through tools/ody/
     _stationsheet.mjs; every one of them was legal, and every one of them shot
     into the woodpile, into the cave's own bowl floor, or into the fallen
     giant's hand at arm's length. Beat IV's floor is a four-metre box with a
     seven-metre body in the middle of it — there is no clear downstage station
     to author. So the proscenium solver, which searches bearings and proves
     what it finds, keeps the placement; what Sol asked for and what this row
     now carries is the HEIGHT (the cave floor, not a diorama hover), the DEPTH
     (a rack that travels from the beam to the eye instead of blurring an
     obstruction) and the TIME (an operator who is locked off until contact). */
  'ody-iv-03-auger': { cls: 'CLOCK', sub: { p: 'stake', h: 1.1 }, from: [760, 636],
    camY: 0.95, fov: 40, frac: 0.30, comp: [-0.15, 0.06],
    /* MEASURED AGAINST THE BEAT CLOCK, NOT AGAINST TASTE: the clock holds this
       leaf for 0.6 s (tools/ody/work/logs/beat4vid.log — the cut ledger of the
       recorded thirty seconds), so a rack at 2.4 s and a break at 4.2 s never
       fired at all. Both now land inside the shot the reader is given. */
    rack: { from: 'p:stake', to: 'h:POLYPHEMUS', at: 0.12, dur: 0.30 },
    move: { k: 'handheld', amp: 0.020, dur: 9, at: 0.30, pre: 0.16, decay: 1.1 },
    dof: { f: 2.2 }, read: { fill: 1.15, rim: 1.25 } },
  'ody-iv-04-bore': { cls: 'CLOCK', sub: { a: 'poly-seat' }, from: [640, 630],
    camY: 1.38, fov: 48, frac: 0.62, comp: [0.10, -0.02],
    move: { k: 'handheld', amp: 0.020, dur: 10 }, dof: { f: 2.5 } },
  /* SOL #2 — THE BLINDING IS AN EVENT, NOT A PORTRAIT. Round 1: "a static
     portrait of the giant; the weapon and the point of contact are absent;
     handheld has no motivated event." The camera stands where the attackers
     stand (y 1.45 — a braced man's eye, on the men's side of the beam so the
     auger crosses the frame on the SAME diagonal it had in the shot before),
     the giant FILLS the vertical frame, and the operator is CONTROLLED right
     up to contact and breaks loose exactly at it (`at`, in seconds from the
     cut) before settling. */
  'ody-iv-05-hiss': { cls: 'CLOCK', sub: { a: 'poly-seat' }, from: [788, 624],
    camY: 1.45, fov: 52, frac: 0.86, comp: [0.11, -0.02], fill: true,
    move: { k: 'handheld', amp: 0.040, dur: 11, at: 1.15, pre: 0.14, decay: 3.0 },
    dof: { f: 2.2 }, blinding: true, read: { fill: 1.2, rim: 1.3 } },
  'ody-iv-06-fright': { cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 }, from: [640, 610],
    camY: 1.60, fov: 34, frac: 0.46, comp: [-0.10, 0.02],
    move: { k: 'handheld', amp: 0.012, dur: 7 }, dof: { f: 4 } },
  'ody-iv-07-whatails': { cls: 'DIALOGUE', sub: { m: [352, 424], h: 3.2, y: 1.9 }, from: [560, 590],
    camY: 1.62, fov: 28, frac: 0.44, comp: [-0.16, 0.02],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.8 }, offstage: true },
  'ody-iv-08-nomankilling': { cls: 'GIANT', sub: { a: 'poly-seat' }, from: [560, 626],
    camY: 1.20, fov: 50, frac: 0.60, comp: [0.12, -0.04],
    move: { k: 'push', cms: 4.0 }, dof: { f: 2.5 } },
  'ody-iv-09-mustbeill': { cls: 'DIALOGUE', sub: { m: [352, 424], h: 3.2, y: 1.9 }, from: [520, 584],
    camY: 1.62, fov: 28, frac: 0.46, comp: [-0.16, 0.02],
    move: { k: 'push', cms: 2.4 }, dof: { f: 2.8 }, offstage: true },
  'ody-iv-10-wentaway': { cls: 'NARRATION', sub: { m: [352, 430], h: 4.6, y: 2.2 }, from: [640, 604],
    camY: 1.60, fov: 32, frac: 0.40, comp: [-0.12, 0.02],
    move: { k: 'push', cms: 3.0 }, dof: { f: 4 } },
  /* THE READABILITY LAW, applied where it caught something. The blinded giant
     groping the doorway stone read at mean 0.086 with 89% of the subject box
     near-black — Fable's "unreadable silhouette", exactly, and the one shot in
     Beat IV where the room's own light story leaves nothing on the subject.
     The motivated rig is doubled here: the fill is the hearth behind us, the
     rim is the cold of the doorway itself. */
  /* THE SUBJECT IS THE BODY DOING THE THING, NOT THE FURNITURE IT DOES IT TO.
     Aimed at the doorway MARK this shot read at mean 0.086 with 89% of the box
     near-black — a hole, because the mark is bare rock in an unlit mouth and a
     motivated rig has nothing there to land on. The blinded giant is the one
     hauling the stone; frame HIM, and the doorway is in shot behind him. */
  'ody-iv-11-stone': { cls: 'ACTION', sub: { a: 'poly-seat' }, from: [620, 600],
    camY: 1.58, fov: 34, frac: 0.46, comp: [-0.09, 0.02],
    move: { k: 'push', cms: 10 }, dof: { f: 4 },
    read: { fill: 1.8, rim: 1.8 }, liveAnchor: true },
  /* THE STATION IS CHOSEN AGAINST THE LIVE BODY, NOT THE MARKS FILE. By this
     unit the blinded giant has left the seat mark the survey recorded and is
     groping the doorway eight metres upstage-left of it, so the surveyed anchor
     put the lens INSIDE his 7 m envelope: the gate read him at 51x frame height
     with 0.1% of him in shot. Measured live with tools/ody/_liveprobe.mjs and
     stood off at ten metres, downstage of the mouth, still below him.
     (tools/ody/shots3d_marks.mjs cannot re-survey this: it is written against
     the 2D book's harness — window.__ready / __refs / __state — and the 3D page
     exposes window.__sceneReady / __book. Re-surveying is its own lane.) */
  'ody-iv-12-doorway': { cls: 'GIANT', sub: { a: 'poly-idle' },
    station: [0.26, 1.45, 4.72], fov: 52, comp: [0.12, -0.04],
    move: { k: 'push', cms: 3.2 }, dof: { f: 2.8 }, liveAnchor: true },

  /* ---------------- BEAT V · UNDER THE RAMS — cave ---------------- */
  /* SOL #7 — rung 4: THE LADDER BREAKS AND TURNS AROUND. Beat V's heading is
     the only cave wide that faces the MOUTH: the camera stands inside and
     looks out at the shut doorway with the cold way out behind it, escape
     space open on the frame's far side. Three neutral repeats become one
     master and three answers to it. */
  'ody-v-00-head': { cls: 'WIDE', sub: { m: [348, 332], h: 9.0, y: 2.6 },
    station: [1.60, 1.80, 3.40], fov: 38, comp: [0.06, 0.02], seesOver: true,
    move: { k: 'crane', dy: 1.1, dz: 0.8, dur: 8 }, dof: { f: 8, near: 0.5 },
    read: { fill: 0.35, rim: 0.75 } },
  'ody-v-01-puzzling': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [560, 616],
    camY: 1.58, fov: 27, frac: 0.58, comp: [-0.16, 0.05],
    move: { k: 'push', cms: 2.8 }, dof: { f: 2.5 } },
  'ody-v-02-withies': { cls: 'ACTION', sub: { m: [900, 466], h: 1.6, y: 0.8 }, from: [880, 630],
    camY: 1.20, fov: 32, frac: 0.42, comp: [0.12, 0.02],
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.5 } },
  'ody-v-03-threetoaman': { cls: 'ACTION', sub: { m: [900, 466], h: 1.6, y: 0.8 }, from: [820, 636],
    camY: 1.15, fov: 30, frac: 0.46, comp: [-0.12, 0.02],
    move: { k: 'track', m: 0.8, dur: 8 }, dof: { f: 2.5 } },
  'ody-v-04-greatram': { cls: 'GATE', sub: { t: 'ram-great', h: 1.15 }, from: [860, 620],
    camY: 1.05, fov: 30, frac: 0.34, comp: [-0.15, 0.03],
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.5 } },
  'ody-v-05-dawn': { cls: 'ACTION', sub: { m: [520, 440], h: 4.4, y: 1.5 }, bear: 70,
    camY: 2.4, fov: 46, dist: 7.5, comp: [-0.06, 0.04],
    move: { k: 'crane', dy: 1.0, dz: 0.4, dur: 9 }, dof: { f: 5.6 } },
  'ody-v-06-feltbacks': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [520, 596],
    camY: 1.30, fov: 48, frac: 0.50, comp: [0.11, 0.02],
    move: { k: 'push', cms: 3.6 }, dof: { f: 2.8 } },
  /* SOL #3 — THROUGH THE FLEECE, NOT BEHIND IT. Round 1: "foreground rams
     obscure virtually all story information; the shallow focus creates
     blockage rather than suspense." The camera is now UNDER the flock at the
     lowest station the volume allows (y 0.58), close, on a 40 mm-equivalent,
     so the belly line of the great ram roofs the frame and the man strapped
     beneath it is the thing in focus with the giant's groping hand crossing
     above. The focus RACKS from the fleece to his face. The station also puts
     the competing bowl behind the camera, which is where Sol wanted it. */
  /* SOL #3 — THROUGH THE FLEECE, NOT BEHIND IT. Round 1: "foreground rams
     obscure virtually all story information; the shallow focus creates
     blockage rather than suspense." Round 2 first aimed this at the mouth MARK
     and measured a hole (mean 0.096, p90 0.126): at the moment the reader
     enters the unit the great ram is still three quarters of the way back
     across the floor, so the frame held bare rock while the action was
     elsewhere. THE SUBJECT IS THE RAM, live, and the camera FOLLOWS him out —
     the belly line roofs the frame, the man strapped under it is what is in
     focus, and the focus racks off the giant's groping hand onto him. */
  'ody-v-07-lastofall': { cls: 'ACTION', sub: { a: 'ram-great' }, from: [430, 604],
    camY: 0.58, fov: 40, frac: 0.60, comp: [-0.14, -0.06], follow: true,
    rack: { from: 'a:poly-seat', to: 'a:ram-great', at: 2.2, dur: 0.9 },
    move: { k: 'push', cms: 5.0 }, dof: { f: 2.5 }, read: { fill: 2.4, rim: 2.2 } },
  'ody-v-08-ramspeech1': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [500, 592],
    camY: 1.28, fov: 47, frac: 0.50, comp: [0.12, 0.02],
    move: { k: 'push', cms: 3.0 }, dof: { f: 2.8 } },
  'ody-v-09-ramspeech2': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [420, 600],
    camY: 1.24, fov: 46, frac: 0.50, comp: [-0.11, 0.02],
    move: { k: 'push', cms: 2.8 }, dof: { f: 2.8 } },
  'ody-v-10-ramspeech3': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [540, 588],
    camY: 1.20, fov: 48, frac: 0.52, comp: [0.10, 0.01],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.5 } },
  'ody-v-11-freed': { cls: 'ACTION', sub: { a: 'ulysses' }, from: [470, 630],
    camY: 1.55, fov: 32, frac: 0.44, comp: [-0.14, 0.04],
    move: { k: 'track', m: 0.9, dur: 8 }, follow: true, dof: { f: 3.2 } },
  'ody-v-12-aboard': { cls: 'NARRATION', sub: { m: [370, 452], h: 3.4, y: 1.6 }, from: [560, 604],
    camY: 1.62, fov: 34, frac: 0.36, comp: [-0.12, 0.03],
    move: { k: 'push', cms: 4.0 }, dof: { f: 4 } },

  /* ---------------- BEAT VI · THE SEA — sea ---------------- */
  'ody-vi-01-jeer': { cls: 'GATE', sub: { t: 'cyclops', h: 6.4 }, over: 'ulysses', from: [470, 560],
    camY: 3.4, fov: 22, frac: 0.30, comp: [0.16, -0.08],
    move: { k: 'push', cms: 16 }, dof: { f: 5.6 } },
  /* SOL #8a — A TAUNT NEEDS ITS TARGET IN THE FRAME. Round 1 made the speaker
     look like he was addressing his own shipmates, because the Cyclops was
     absent. The camera now stands OFF THE SHIP'S SEAWARD QUARTER, west of
     Ulysses looking east, so the island and its giant sit in the very
     look-room he is shouting into — the sea axis (ship frame LEFT, island
     frame RIGHT) declared once and held through the sail-off. */
  'ody-vi-02-taunt': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [450, 483],
    camY: 2.60, fov: 30, frac: 0.50, comp: [0.30, 0.04],
    move: { k: 'push', cms: 2.8 }, dof: { f: 2.5 } },
  'ody-vi-03-rock1': { cls: 'CLOCK', sub: { m: [520, 470], h: 6.0, y: 1.4 }, from: [430, 600],
    camY: 3.0, fov: 34, dist: 22, comp: [-0.10, -0.06],
    move: { k: 'whip', toPx: [468, 505], toY: 1.2, at: 0.62, dur: 11, rise: 2.2 }, dof: { f: 8 } },
  'ody-vi-04-twiceasfar': { cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 }, from: [470, 590],
    camY: 2.6, fov: 32, frac: 0.42, comp: [-0.10, 0.02],
    move: { k: 'push', cms: 8 }, dof: { f: 4 } },
  'ody-vi-05-menbeg': { cls: 'DIALOGUE', sub: { a: 'crew-0' }, from: [520, 560],
    camY: 2.7, fov: 26, frac: 0.58, comp: [-0.16, 0.05],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.2 } },
  'ody-vi-06-defy': { cls: 'GATE', sub: { t: 'cyclops', h: 6.4 }, over: 'ulysses', from: [455, 545],
    camY: 3.2, fov: 20, frac: 0.32, comp: [0.15, -0.08],
    move: { k: 'push', cms: 14 }, dof: { f: 5.6 } },
  'ody-vi-07-myname': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [418, 512],
    camY: 2.9, fov: 24, frac: 0.66, comp: [0.17, 0.05],
    move: { k: 'push', cms: 2.4 }, dof: { f: 2.0 } },
  'ody-vi-08-prophecy': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [500, 520],
    camY: 3.2, fov: 17, frac: 0.52, comp: [0.14, -0.06],
    move: { k: 'push', cms: 5.5 }, dof: { f: 4 } },
  'ody-vi-09-fatherson': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [560, 540],
    camY: 3.0, fov: 16, frac: 0.58, comp: [-0.13, -0.06],
    move: { k: 'push', cms: 5.0 }, dof: { f: 4 } },
  'ody-vi-10-hades': { cls: 'DIALOGUE', sub: { a: 'ulysses' }, from: [440, 530],
    camY: 2.9, fov: 25, frac: 0.62, comp: [0.17, 0.05],
    move: { k: 'push', cms: 2.6 }, dof: { f: 2.2 } },
  'ody-vi-11-curse': { cls: 'GIANT', sub: { a: 'poly-idle' }, from: [520, 500],
    camY: 3.4, fov: 15, frac: 0.62, comp: [0.12, -0.05],
    move: { k: 'push', cms: 4.5 }, dof: { f: 4 } },
  'ody-vi-12-heard': { cls: 'CLOCK', sub: { m: [540, 468], h: 6.0, y: 1.4 }, from: [420, 606],
    camY: 3.2, fov: 34, dist: 24, comp: [-0.10, -0.06],
    move: { k: 'whip', toPx: [455, 540], toY: 1.2, at: 0.55, dur: 6, rise: 1.8 }, dof: { f: 8 } },
  'ody-vi-13-ram': { cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 }, from: [455, 596],
    camY: 2.8, fov: 32, frac: 0.40, comp: [-0.10, 0.03],
    move: { k: 'push', cms: 9 }, follow: true, dof: { f: 4 } },
  /* SOL #8b — THE SAIL-OFF MUST SAY DEPARTURE. Round 1 showed the ship
     apparently parked beside the cave. The subject is now the SHIP HERSELF, at
     the mark she has actually reached by this unit, pinned by an authored
     `side` to frame LEFT with open water ahead of her, while the island she is
     leaving rises on the right — the same screen direction as the taunt, so
     the cut answers it. The crane rises off her as she goes. */
  'ody-vi-14-sailedon': { cls: 'WIDE', sub: { m: [205, 489], h: 8.0, y: 2.6 },
    station: [-49.0, 9.0, 20.0], fov: 54, comp: [0.34, -0.30], side: -1,
    move: { k: 'crane', dy: 1.8, dz: 1.5, dur: 10 }, follow: true, dof: { f: 11, near: 0.4 } },
};

/* ====================================================================== *
 * the solver
 * ====================================================================== */
function worldOf(w, px, py, y = 0) {
  return { x: (px - w.CX) / w.S, y, z: (py - w.CY) / (w.S * Math.sin(w.elev * D2R)) };
}
function boxWorld(w, [[x0, y0], [x1, y1]]) {
  const a = worldOf(w, x0, y0), b = worldOf(w, x1, y1);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
           z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
}
/* THE CAMERA VOLUME IS A SHELL, NOT A FLOOR PLAN. The cave is a dome: a
   station that is legal at a man's height is buried in the rock at five
   metres, which is exactly how a crane-down establishing shot came back as a
   frame of pure black. So the test is the ELLIPSOID, height included. Open-air
   sets pass a huge ry and are governed by their height band alone. */
const inVol = (v, p) =>
  ((p.x - v.cx) / v.rx) ** 2 + ((p.y - (v.cy || 0)) / (v.ry || 1e4)) ** 2 +
  ((p.z - v.cz) / v.rz) ** 2 <= (v.k || 1) &&
  p.y >= v.ymin && p.y <= v.ymax;
/* a WIDE's subject is a block of the ROOM, not a body: it is meant to run past
   the frame edges, so the edge-cut law does not bind it */
const fill = (spec) => spec.cls === 'WIDE' || !!spec.fill;
const inBox = (b, p, m = 0.35) =>
  p.x > b.x0 - m && p.x < b.x1 + m && p.z > b.z0 - m && p.z < b.z1 + m;

/** the framing law: a stature h fills a fraction f of the frame at distance d */
const frameDist = (h, f, fovDeg) => h / (2 * Math.max(1e-3, f) * Math.tan(fovDeg * D2R / 2));

/**
 * THE ANCHOR IS MEASURED, NEVER GUESSED. A ledger mark is a GROUND row, and
 * half this book's subjects are not on the ground — the giant on the clifftop
 * is 27.5 m up, the men stand on a swaying deck, the bowl rides a hand. So a
 * live subject's anchor and stature come from tools/ody/shots3d_marks.json,
 * which is the running book reporting where it actually put everybody.
 */
/* THE STATURE TABLE — the one authority, and the reason the table can promise
   a subject size at all.
   A SkinnedMesh's geometry bounding box is the BIND pose: it does not know the
   character is kneeling or sitting down, so the same Ulysses measured 1.75 m
   standing and 3.02 m as a suppliant, and the seated giant measured 7 m while
   filling 4.15 m of screen. Measured boxes are therefore NOT trusted for the
   cast. These numbers are 3d/app3d/world.js's SIZE_TABLE (human 1.75, giant 7,
   great ram 1.4, sheep 1.0) with ONE addition the scale gate cannot express:
   the giant SEATED is 4.3 m, because stage3d's own head anchor puts his seated
   crown at GIANT_SEAT_CROWN_M = 4.15.
   Whatever lands here is written into every row as frame.h, and the runtime
   and the composition gate build the subject envelope from THAT — so the bake,
   the frame and the gate cannot drift apart. */
const CROWN = {
  ulysses: 1.75, 'crew-0': 1.75, 'crew-1': 1.75, 'crew-2': 1.75, 'crew-3': 1.75,
  'poly-seat': 4.30, 'poly-idle': 7.00, 'poly-walk': 7.00,
  'ram-great': 1.40, 'ewe-0': 1.00, 'ewe-1': 1.00, 'ewe-2': 1.00, 'ewe-3': 1.00,
  'flock-0': 1.00, 'flock-1': 1.00, 'flock-2': 1.00, 'flock-3': 1.00,
};

function anchorOf(spec, w, bodies, warn, id) {
  const sub = spec.sub;
  const pick = (keys) => { for (const k of keys) if (bodies && bodies[k]) return bodies[k]; return null; };
  if (sub.a) {
    const keys = /^poly/.test(sub.a)
      ? [`actor:${sub.a}`, 'actor:poly-seat', 'actor:poly-idle', 'actor:poly-walk']
      : [`actor:${sub.a}`];
    let key = null;
    for (const k of keys) if (bodies && bodies[k]) { key = k; break; }
    const b = key ? bodies[key] : null;
    if (b) {
      const who = key.slice(6);
      const h = CROWN[who] !== undefined ? CROWN[who]
        : Math.max(0.3, b.hi[1] - b.lo[1]);
      /* the body stands ON its placement, whatever the bind box claims */
      return { A: { x: b.p[0], y: b.p[1] + h / 2, z: b.p[2] }, h, live: true,
               face: b.face, who };
    }
    warn.push(`${id}: subject actor ${sub.a} not staged — falling back to the plate mark`);
  }
  if (sub.t) {
    const b = pick([`target:${sub.t}`]);
    if (b) return { A: { x: b.p[0], y: b.p[1], z: b.p[2] }, h: sub.h || 1.6, live: true, point: true };
    warn.push(`${id}: gate target ${sub.t} not live at bake time`);
  }
  if (sub.p) {
    const b = pick([`prop:${sub.p}`, `anchor:${sub.p}`]);
    if (b) return { A: { x: b.p[0], y: b.p[1], z: b.p[2] }, h: sub.h || 0.8, live: true, point: true };
    warn.push(`${id}: prop ${sub.p} has no anchor`);
  }
  if (sub.m) {
    const h = sub.h !== undefined ? sub.h : 1.7;
    return { A: worldOf(w, sub.m[0], sub.m[1], sub.y !== undefined ? sub.y : h / 2), h,
             live: false, point: true };
  }
  if (spec.at) {
    const h = sub.h !== undefined ? sub.h : (sub.a ? (CROWN[sub.a] || 1.75) : 1.75);
    const y = spec.atY !== undefined ? spec.atY : h / 2;
    return { A: worldOf(w, spec.at[0], spec.at[1], y), h, live: false, point: true };
  }
  warn.push(`${id}: NO ANCHOR — shot parked at the set origin`);
  return { A: { x: 0, y: 1, z: 0 }, h: 1.7, live: false };
}

function solve(spec, set, w, boxes, anch, over) {
  if (spec.station && spec.camY === undefined) spec.camY = spec.station[1];
  const S = SETS[set];
  const h = anch.h;
  const A = anch.A;

  const frac = spec.frac !== undefined ? spec.frac : CLASSES[spec.cls].floor * 1.4;
  let want = spec.dist !== undefined ? spec.dist : frameDist(h, frac, spec.fov);
  /* A TRUE OTS IS MEASURED FROM THE SHOULDER, NOT FROM THE SPEAKER (Sol r1 #5:
     "this is not an OTS ... no council geometry, no eyeline"). The operator
     stands a stride BEHIND the listener; how big the speaker then reads is
     whatever the room makes it, not a number the framing law wished for. */
  if (spec.behind !== undefined && over) {
    const dx = over.x - A.x, dz = over.z - A.z;
    want = Math.hypot(dx, dz) + spec.behind;
  }

  /* THE BEARING. An OVER-THE-SHOULDER is not a direction anyone chooses: it is
     the line between the two people, taken from behind the LISTENER's shoulder
     and swung a few degrees off so the frame sees past it. Everything else
     names a station in plate px (a direction hint) or a bearing outright. */
  let hint;
  if (over) {
    hint = Math.atan2(over.x - A.x, over.z - A.z) / D2R + (spec.overSide || 20);
  } else if (spec.bear !== undefined) hint = spec.bear;
  else if (spec.station) {
    /* AN AUTHORED STATION IS ITS OWN HINT. The search below still runs (it is
       what proves the row would have been legal without the authored place to
       stand), but it must not be handed a `from` the DP never wrote. */
    hint = Math.atan2(spec.station[0] - A.x, spec.station[2] - A.z) / D2R;
  } else {
    const F = worldOf(w, spec.from[0], spec.from[1], 0);
    hint = Math.atan2(F.x - A.x, F.z - A.z) / D2R;
  }
  /* an OTS already fills its own frame edge with a body: the proscenium
     cap does not bind it, or the shoulder ends up behind the camera */
  const phases = over ? [2] : [1, 2];

  const station = (bear, dist) => ({
    x: A.x + dist * Math.sin(bear * D2R),
    y: spec.camY,
    z: A.z + dist * Math.cos(bear * D2R),
  });
  /* A STATION IS LEGAL FOR THE WHOLE MOVE, not just its last frame. A crane
     begins dy above and dz behind where it ends, and that opening frame is as
     much a shot as the closing one — the cave's first establishing crane came
     down out of solid rock because only the end was ever checked. */
  const mv0 = spec.move || {};
  const legal = (p) => inVol(S.vol, p) && !Object.values(boxes).some((b) => inBox(b, p));
  const ok = (p) => {
    if (!legal(p)) return false;
    if (mv0.k !== 'crane') return true;
    const d = { x: p.x - A.x, z: p.z - A.z };
    const l = Math.hypot(d.x, d.z) || 1;
    return legal({ x: p.x + d.x / l * (mv0.dz || 0), y: p.y + (mv0.dy || 0),
                   z: p.z + d.z / l * (mv0.dz || 0) });
  };

  /* THE AUDIENCE HALF-SPACE FIRST. Phase 1 only accepts stations that keep the
     camera downstage of the subject (|bearing| <= 92 deg off +Z) — the
     proscenium. Only if the furniture and the bowl leave nothing there does
     phase 2 allow the camera round behind, and that swing is recorded in the
     row so it can be read back rather than discovered in a frame. */
  /** the nearest valid bearing to the hint AT one distance — the fit re-places
      with this too, because backing straight off a wall finds nothing while
      swinging four metres east along the same wall finds the shot */
  const placeAt = (d, phase, cone = S.cone) => {
    for (let da = 0; da <= cone; da += 4) {
      for (const s of (da === 0 ? [0] : [1, -1])) {
        const b = hint + s * da;
        if (phase === 1 && Math.abs(((b % 360) + 540) % 360 - 180) > 92) continue;
        const p = station(b, d);
        if (ok(p)) return { p, bear: b, dist: d, phase, da: s * da };
      }
    }
    return null;
  };
  let best = null, why = 'hint';
  outer:
  for (const phase of phases) {
    for (const shrink of [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45]) {
      const got = placeAt(want * shrink, phase);
      if (!got) continue;
      best = got;
      why = (got.da === 0 && shrink === 1 && phase === 1) ? 'hint'
        : `${phase === 2 ? 'UPSTAGE ' : ''}swung ${got.da.toFixed(0)}deg x${shrink}`;
      break outer;
    }
  }
  /* ================= THE SIGHT LINE =================
   * A station is legal when the LENS is out of the furniture; a station is
   * SHOOTABLE when the lens's view of its subject is too. The cave's woodpile
   * taught this the expensive way: the auger shot's first authored station was
   * a legal 1.3 m clear of the pile and pointed straight through it, and the
   * frame came back as an unreadable cream blur with three logs in it — the
   * same defect Sol filed against round 1, rebuilt from the other side. */
  const clearLine = (p, target) => {
    const steps = 24;
    for (let i = 1; i < steps; i++) {
      const q = { x: p.x + (target.x - p.x) * (i / steps), y: 0,
                  z: p.z + (target.z - p.z) * (i / steps) };
      /* the last fifth of the ray is the subject's own body: not an occluder */
      if (i / steps > 0.8) break;
      for (const b of Object.values(boxes)) if (inBox(b, q, 0.15)) return false;
    }
    return true;
  };

  /* ================= THE AUTHORED STATION =================
   * Eight of Sol's fixes are not "swing a bit"; they name a place to stand —
   * floor level along the auger, at attacker height, under the fleece, over
   * the giant's shoulder. A DP who has decided where the camera goes does not
   * hand that back to a search. `station:[x,y,z]` is that decision. It is
   * still MEASURED against the set's volume and furniture, and the row records
   * whether it is legal, so an authored station cannot quietly sit in rock. */
  if (spec.station) {
    const p = { x: spec.station[0], y: spec.station[1], z: spec.station[2] };
    best = { p, bear: Math.atan2(p.x - A.x, p.z - A.z) / D2R,
             dist: Math.hypot(p.x - A.x, p.z - A.z), authored: true };
    const sees = clearLine(p, A);
    why = legal(p) ? (sees ? 'AUTHORED' : 'AUTHORED (sight line blocked)')
                   : 'AUTHORED (outside the volume)';
    spec.__stationLegal = legal(p);
    spec.__stationSees = sees;
  }
  if (!best) {
    /* the volume boundary, on the hint bearing — the honest fallback */
    const p = station(hint, want);
    const t = 1 / Math.max(1e-6, Math.hypot((p.x - S.vol.cx) / S.vol.rx, (p.z - S.vol.cz) / S.vol.rz));
    const q = { x: S.vol.cx + (p.x - S.vol.cx) * t * 0.96, y: spec.camY,
                z: S.vol.cz + (p.z - S.vol.cz) * t * 0.96 };
    best = { p: q, bear: hint, dist: Math.hypot(q.x - A.x, q.z - A.z), clamped: true };
    why = 'CLAMPED to volume';
  }

  /* the realised size, from the realised distance */
  const dEff = Math.hypot(best.p.x - A.x, best.p.y - A.y, best.p.z - A.z);
  const realFrac = h / (2 * dEff * Math.tan(spec.fov * D2R / 2));

  /* THE COMPOSITION: the lookAt is the world point that lands at frame
     centre, so putting the subject at NDC (cx,cy) means aiming AWAY from it
     by that much of the half-frame at the subject's own distance. */
  const halfH = dEff * Math.tan(spec.fov * D2R / 2);
  const halfW = halfH * (1600 / 940);
  let comp = (spec.comp || [0, 0]).slice();
  /* THE LOOK-ROOM IS NOT A TASTE. A body that speaks sits on the side of the
     frame OPPOSITE the way it faces, so the space it is talking into is in
     shot. The magnitude is authored; the SIGN is read off the body. */
  /* THE SCREEN-DIRECTION SYSTEM OUTRANKS THE LOOK-ROOM HEURISTIC. In the cave
     the giant is ALWAYS frame right and the men ALWAYS frame left; that axis is
     what makes a cut answer the cut before it, and a body's own facing (which
     changes every time an act turns him) may not be allowed to flip it. When a
     row is pinned to a side the sign is the SYSTEM's; only an unpinned speaker
     falls back to reading the face. */
  const pinned = axisSide(spec);
  if (pinned) {
    comp[0] = pinned * Math.abs(comp[0] || 0.15);
  } else if (SPEAKING.has(spec.cls) && anch.face !== undefined && anch.face !== null) {
    const fw = { x: Math.sin(anch.face), z: Math.cos(anch.face) };
    const fx = { x: A.x - best.p.x, z: A.z - best.p.z };
    const fl2 = Math.hypot(fx.x, fx.z) || 1;
    const rr = { x: -fx.z / fl2, z: fx.x / fl2 };
    const side = fw.x * rr.x + fw.z * rr.z;
    if (Math.abs(side) > 0.18) comp[0] = -Math.sign(side) * Math.abs(comp[0] || 0.15);
  }
  /* camera basis */
  const fwd = { x: A.x - best.p.x, y: A.y - best.p.y, z: A.z - best.p.z };
  const fl = Math.hypot(fwd.x, fwd.y, fwd.z);
  fwd.x /= fl; fwd.y /= fl; fwd.z /= fl;
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  const rl = Math.hypot(right.x, right.z) || 1;
  right.x /= rl; right.z /= rl;
  const up = { x: right.z * fwd.y - 0 * fwd.z, y: 0 * fwd.x - right.x * fwd.z + right.z * 0,
               z: right.x * fwd.y - right.y * fwd.x };
  /* up = right x fwd (right has y=0) */
  const upv = { x: right.y * fwd.z - right.z * fwd.y,
                y: right.z * fwd.x - right.x * fwd.z,
                z: right.x * fwd.y - right.y * fwd.x };
  const ul = Math.hypot(upv.x, upv.y, upv.z) || 1;
  upv.x /= ul; upv.y /= ul; upv.z /= ul;
  void up;

  const look = {
    x: A.x - right.x * comp[0] * halfW - upv.x * comp[1] * halfH,
    y: A.y - right.y * comp[0] * halfW - upv.y * comp[1] * halfH,
    z: A.z - right.z * comp[0] * halfW - upv.z * comp[1] * halfH,
  };
  const dummyFit = 0; void dummyFit;

  /* THE SIZE IS THE PROJECTED ONE. The framing law picks the distance off the
     subject's CENTRE plane, but what a reader (and the composition gate) sees
     is the whole envelope projected — the near face of a body is closer than
     its middle and therefore bigger, and on a 7 m giant at five metres that is
     a 60% difference. So the row reports the share of frame height the envelope
     actually covers, measured exactly the way the gate measures it, and
     `fracDesign` keeps the law's own number beside it.
     THE FIT. The edge-cut gate is a LAW, so the solver satisfies it rather than
     reporting it: back the station off along its own bearing while the set's
     volume allows, then widen the lens (which is what an operator does in a
     room with no floor left behind them), until the whole subject is inside the
     frame with a margin — and never past the point where it drops through its
     own class floor. A push-in ends CLOSER than it starts, so the fit is
     measured at the END of the move, where the constraint actually bites. */
  let fov = spec.fov, fit = '';
  const pushEnd = (P, LK) => {
    if (!spec.move || spec.move.k !== 'push') return P;
    const m = (spec.move.cms / 100) * (spec.move.dur || 10);
    const d = { x: LK.x - P.x, y: LK.y - P.y, z: LK.z - P.z };
    const l = Math.hypot(d.x, d.y, d.z) || 1;
    return { x: P.x + d.x / l * m, y: P.y + d.y / l * m, z: P.z + d.z / l * m };
  };
  if (!fill(spec) && !spec.station) {
    for (let i = 0; i < 14; i++) {
      const e = projectEnvelope(pushEnd(best.p, look), look, fov, A, h, !!anch.point);
      if (e.inFrame >= 0.985 && e.h <= (CLASSES[spec.cls].cap || 0.90)) break;
      const nd = Math.hypot(best.p.x - A.x, best.p.y - A.y, best.p.z - A.z) * 1.09;
      const nextFrac = h / (2 * nd * Math.tan(fov * D2R / 2));
      const grown = nextFrac >= CLASSES[spec.cls].floor
        ? (placeAt(nd, 1) || placeAt(nd, 2) || placeAt(nd, 2, 170)) : null;
      if (grown) { best = grown; fit = 'backed off'; }
      else if (fov < spec.fov + 10) { fov = Math.min(spec.fov + 10, fov + 2.5); fit = 'widened'; }
      else { fit = 'at the wall'; break; }
    }
  }
  /* ================= THE LOW ANGLE =================
   * "For POLYPHEMUS lines, LOW ANGLE looking up so he towers — that is the
   * story." A giant does not tower because he is tall; he towers because the
   * lens is BELOW him and near enough that his crown climbs the frame. So the
   * shot declares an angle and the solver delivers it: drop the station toward
   * the floor and pull it in until the pitch from the lens to his CROWN clears
   * the class minimum, stopping the moment his size hits the class cap. A
   * seated giant framed politely from seven metres measured 19 degrees and
   * read as a man on a stool. */
  if (CLASSES[spec.cls].crownPitch && !spec.station) {
    const wantPitch = CLASSES[spec.cls].crownPitch;
    const crownY = A.y + h / 2;
    const pitchAt = (P) => Math.atan2(crownY - P.y,
      Math.max(0.2, Math.hypot(P.x - A.x, P.z - A.z))) / D2R;
    for (let i = 0; i < 12 && pitchAt(best.p) < wantPitch; i++) {
      /* first the floor: a low angle is a low camera before it is a near one */
      const lower = { ...best.p, y: Math.max(S.vol.ymin + 0.1, best.p.y - 0.14) };
      if (lower.y < best.p.y && ok(lower)) { best.p = lower; fit = fit || 'dropped'; continue; }
      const nd = Math.hypot(best.p.x - A.x, best.p.z - A.z) * 0.93;
      const e2 = projectEnvelope(pushEnd({ ...best.p }, look), look, fov, A, h, !!anch.point);
      if (e2.h > (CLASSES[spec.cls].cap || 0.9) * 0.97) break;
      const nearer = placeAt(nd, 1) || placeAt(nd, 2);
      if (!nearer) break;
      nearer.p.y = best.p.y;
      best = nearer;
      fit = 'low-angled';
    }
    spec.__pitch = pitchAt(best.p);
  }

  /* the aim is re-solved on the fitted station, or the composition drifts */
  {
    const dEff2 = Math.hypot(best.p.x - A.x, best.p.y - A.y, best.p.z - A.z);
    const hh = dEff2 * Math.tan(fov * D2R / 2), hw = hh * (1600 / 940);
    const f2 = { x: A.x - best.p.x, y: A.y - best.p.y, z: A.z - best.p.z };
    const l2 = Math.hypot(f2.x, f2.y, f2.z) || 1;
    f2.x /= l2; f2.y /= l2; f2.z /= l2;
    const r2 = { x: -f2.z, y: 0, z: f2.x };
    const rl2 = Math.hypot(r2.x, r2.z) || 1;
    r2.x /= rl2; r2.z /= rl2;
    const u2 = { x: r2.y * f2.z - r2.z * f2.y, y: r2.z * f2.x - r2.x * f2.z,
                 z: r2.x * f2.y - r2.y * f2.x };
    look.x = A.x - r2.x * comp[0] * hw - u2.x * comp[1] * hh;
    look.y = A.y - r2.y * comp[0] * hw - u2.y * comp[1] * hh;
    look.z = A.z - r2.z * comp[0] * hw - u2.z * comp[1] * hh;
  }
  if (fit) why += ' + ' + fit;
  spec.__fov = fov;
  const env = projectEnvelope(pushEnd(best.p, look), look, fov, A, h, !!anch.point);
  const dFin = Math.hypot(best.p.x - A.x, best.p.y - A.y, best.p.z - A.z);
  const crownPitch = Math.atan2(A.y + h / 2 - best.p.y,
    Math.max(0.2, Math.hypot(best.p.x - A.x, best.p.z - A.z))) / D2R;
  return { A, h, pos: best.p, look, dEff: dFin, realFrac, fov, crownPitch, comp,
           projFrac: env.h, projIn: env.inFrame,
           projCx: env.cx, projCy: env.cy, bear: best.bear, why,
           clamped: !!best.clamped, halfH, halfW };
}

const ASPECT = 1600 / 940;      /* the harness viewport, and the book's own */

function projectEnvelope(C, L, fovDeg, A, h, point) {
  const f = { x: L.x - C.x, y: L.y - C.y, z: L.z - C.z };
  const fl = Math.hypot(f.x, f.y, f.z) || 1;
  f.x /= fl; f.y /= fl; f.z /= fl;
  const r = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r.x, r.z) || 1;
  r.x /= rl; r.z /= rl;
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const t = Math.tan(fovDeg * D2R / 2);
  const w = point ? h : h * 0.42;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const P = { x: A.x + sx * w / 2, y: A.y + sy * h / 2, z: A.z + sz * w / 2 };
    const d = { x: P.x - C.x, y: P.y - C.y, z: P.z - C.z };
    const z = d.x * f.x + d.y * f.y + d.z * f.z;
    if (z <= 0.02) return { h: 9, inFrame: 0, cx: 0, cy: 0 };
    const nx = (d.x * r.x + d.y * r.y + d.z * r.z) / z / (t * ASPECT);
    const ny = (d.x * u.x + d.y * u.y + d.z * u.z) / z / t;
    minX = Math.min(minX, nx); maxX = Math.max(maxX, nx);
    minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
  }
  const inW = Math.max(0, Math.min(maxX, 1) - Math.max(minX, -1));
  const inH = Math.max(0, Math.min(maxY, 1) - Math.max(minY, -1));
  const area = Math.max(1e-9, (maxX - minX) * (maxY - minY));
  return { h: (maxY - minY) / 2, inFrame: (inW * inH) / area,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/* ====================================================================== */
/* THE CONTRACT IS THE SOURCE. units.js is imported, never parsed: the shot
   table must break loudly if a unit is renamed, not silently miss it. */
const UNITS_MOD = await import(pathToFileURL(UNITS_JS).href);
const units = UNITS_MOD.UNITS.map((u) => ({
  id: u.id, set: u.set, speaker: u.speaker || '', verb: u.verb || '',
  focus: u.focus || '', head: !!u.head, beat: u.beat || 1,
}));
/* a unit inherits its leaf's set when it does not name one */
{
  let last = 'shore';
  for (const u of units) { if (u.set) last = u.set; else u.set = last; }
}
if (units.length !== 81) { console.error('units:', units.length, 'expected 81'); process.exit(2); }
const seen = new Set(units.map((u) => u.id));
for (const k of Object.keys(SPEC)) if (!seen.has(k)) { console.error('SPEC row for a unit that does not exist:', k); process.exit(2); }

const MARKS = JSON.parse(await readFile(MARKS_FILE, 'utf8'));

const rows = {};
const warn = [];
const wideByBeat = {};
for (const u of units) {
  const spec = SPEC[u.id];
  if (!spec) { warn.push(`${u.id}: NO SPEC`); continue; }
  const w = FRAME[u.set];
  const boxes = Object.fromEntries(Object.entries(OBSTACLES[u.set])
    .map(([k, b]) => [k, boxWorld(w, b)]));
  const bodies = (MARKS.units[u.id] || {}).bodies || null;
  if (!bodies) warn.push(`${u.id}: no measured staging — re-run shots3d_marks.mjs`);

  spec.__set = u.set;
  const anch = anchorOf(spec, w, bodies, warn, u.id);
  let over = null;
  if (spec.over && bodies) {
    const ob = bodies['actor:' + spec.over] ||
      (/^poly/.test(spec.over) ? (bodies['actor:poly-seat'] || bodies['actor:poly-idle']) : null);
    if (ob) over = { x: ob.p[0], y: ob.p[1], z: ob.p[2] };
    else warn.push(`${u.id}: over-shoulder body ${spec.over} is not staged`);
  }
  /* THE RACK's two depths, in world metres. `a:` an actor, `h:` a head anchor,
     `p:` a prop, `t:` a gate target, or a plate mark [px,py,y]. Depth of field
     is meant to REVEAL — bowl to giant, auger tip to eye, fleece to the man. */
  const refPoint = (ref) => {
    if (!ref) return null;
    if (Array.isArray(ref)) {
      const p = worldOf(w, ref[0], ref[1], ref[2] === undefined ? 1 : ref[2]);
      return [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)];
    }
    const [kind, name] = String(ref).split(':');
    const key = kind === 'a' ? 'actor:' + name : kind === 'h' ? 'head:' + name
      : kind === 'p' ? 'prop:' + name : kind === 't' ? 'target:' + name : null;
    let b = key && bodies && bodies[key];
    if (!b && kind === 'a' && /^poly/.test(name) && bodies)
      b = bodies['actor:poly-seat'] || bodies['actor:poly-idle'] || bodies['actor:poly-walk'];
    if (!b) { warn.push(`${u.id}: rack reference ${ref} is not staged`); return null; }
    return [+b.p[0].toFixed(3), +b.p[1].toFixed(3), +b.p[2].toFixed(3)];
  };

  const r = solve(spec, u.set, w, boxes, anch, over);
  const cls = CLASSES[spec.cls];
  if (r.projFrac < cls.floor - 1e-6 && spec.cls !== 'POV' && !spec.liveAnchor)
    warn.push(`${u.id}: size ${r.projFrac.toFixed(3)} < ${spec.cls} floor ${cls.floor}`);
  /* A ROW MARKED `liveAnchor` IS NOT MEASURED AGAINST THE SURVEY. Its subject
     has left the mark the survey recorded (the blinded giant walks to the
     doorway), so the surveyed anchor would report a frame nobody will ever
     see; the station was chosen against the running book instead, and the LIVE
     [read]/[view] gates in the walk are what hold it. The row still declares
     the exemption in the table, so it is visible rather than silent. */
  if (!fill(spec) && !spec.liveAnchor && r.projIn < 0.96)
    warn.push(`${u.id}: EDGE-CUT — only ${(r.projIn * 100).toFixed(0)}% of the subject is in frame (size ${r.projFrac.toFixed(2)})`);
  if (r.clamped) warn.push(`${u.id}: camera CLAMPED to the ${u.set} volume`);
  /* `seesOver` is the DP's judgement that the thing on the ray is BELOW it —
     the fire is a knee-high ring of stones and the cave mouth is nine metres
     tall, so the master that looks out over the blaze is not blocked by it.
     The ledger's boxes are plate FOOTPRINTS and carry no height, which is why
     this has to be a declaration rather than an arithmetic. */
  if (spec.station && !spec.seesOver && spec.__stationSees === false)
    warn.push(`${u.id}: SIGHT LINE BLOCKED — the authored station looks at its ` +
      `subject through the ${u.set}'s own furniture`);
  if (cls.crownPitch && !spec.liveAnchor && r.crownPitch < cls.crownPitch - 0.5)
    warn.push(`${u.id}: LOW-ANGLE ${r.crownPitch.toFixed(1)} deg < ${cls.crownPitch} — ` +
      `he does not tower (size ${r.projFrac.toFixed(2)} / cap ${cls.cap})`);
  /* A CRANE STARTS SOMEWHERE TOO. The move lifts the station by dy and pulls
     it back by dz at t=0, and that opening frame has to be inside the set as
     much as the closing one does — the first cave establishing shot craned
     down out of solid rock. */
  if (spec.move && spec.move.k === 'crane') {
    const S2 = SETS[u.set];
    const f0 = { x: r.pos.x - r.A.x, y: r.pos.y - r.A.y, z: r.pos.z - r.A.z };
    const l0 = Math.hypot(f0.x, f0.y, f0.z) || 1;
    const p0 = { x: r.pos.x + f0.x / l0 * (spec.move.dz || 0),
                 y: r.pos.y + (spec.move.dy || 0),
                 z: r.pos.z + f0.z / l0 * (spec.move.dz || 0) };
    if (!inVol(S2.vol, p0))
      warn.push(`${u.id}: the CRANE STARTS outside the ${u.set} volume ` +
        `(y ${p0.y.toFixed(1)}) — lower dy or move the station in`);
  }
  if (spec.cls === 'WIDE') wideByBeat[u.beat] = (wideByBeat[u.beat] || 0) + 1;

  const mv = { ...spec.move };
  if (mv.k === 'push') {
    mv.dur = mv.dur || 10;
    mv.m = +((mv.cms / 100) * mv.dur).toFixed(3);       /* metres travelled */
    if (mv.cms > cls.pushMax + 1e-6)
      warn.push(`${u.id}: push ${mv.cms} cm/s > ${spec.cls} max ${cls.pushMax}`);
  }
  if (mv.k === 'track') mv.dur = mv.dur || 9;
  if (mv.k === 'crane') mv.dur = mv.dur || 7;
  if (mv.k === 'tilt') mv.dur = mv.dur || 8;
  if (mv.k === 'handheld') mv.dur = mv.dur || 8;
  if (mv.k === 'orbit') mv.dur = mv.dur || 9;
  if (mv.k === 'whip') {
    mv.dur = mv.dur || 8;
    /* the splash the throw ends on, in world metres — the ledger's own
       impact box, so the whip lands where the water actually breaks */
    if (mv.toPx) {
      const p = worldOf(w, mv.toPx[0], mv.toPx[1], mv.toY === undefined ? 0.8 : mv.toY);
      mv.to = [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)];
    }
  }

  rows[u.id] = {
    unit: u.id, beat: u.beat, set: u.set, class: spec.cls,
    speaker: u.speaker || null,
    subject: spec.sub, over: spec.over || null, fg: spec.fg || null,
    pos: [+r.pos.x.toFixed(3), +r.pos.y.toFixed(3), +r.pos.z.toFixed(3)],
    lookAt: [+r.look.x.toFixed(3), +r.look.y.toFixed(3), +r.look.z.toFixed(3)],
    fov: r.fov,
    move: mv,
    dof: { fstop: spec.dof.f, focus: 'subject',
           near: spec.dof.near !== undefined ? spec.dof.near : 0.85,
           /* EXPOSE FOR THE FLAME (Sol r1 #6: "the fire clips to white"). A
              shot whose frame is dominated by the blaze is printed down so the
              hottest thing in it still has detail; every other shot keeps the
              exposure the set lane signed off. */
           ...(spec.dof.expo !== undefined ? { expo: spec.dof.expo } : {}),
           ...(spec.rack ? { rack: {
             from: refPoint(spec.rack.from), to: refPoint(spec.rack.to),
             at: spec.rack.at === undefined ? 2.4 : spec.rack.at,
             dur: spec.rack.dur === undefined ? 0.9 : spec.rack.dur } } : {}) },
    /* THE READABILITY LAW, per shot: how much motivated fill and rim the
       SUBJECT OF THE LINE carries. A wide is lit by the room; everything a
       reader is meant to read a face or an action off is not. */
    read: readOf(spec),
    frame: { h: r.h, point: !!anch.point, fill: fill(spec),
             side: sideOf(spec), sideLanded: sideLandedOf(r),
             stationLegal: spec.station ? !!spec.__stationLegal : null,
             stationSees: spec.station ? !!spec.__stationSees : null,
             liveAnchor: !!spec.liveAnchor,
             frac: +r.projFrac.toFixed(3), fracDesign: +r.realFrac.toFixed(3),
             inFrame: +r.projIn.toFixed(3),
             cx: +r.projCx.toFixed(3), cy: +r.projCy.toFixed(3), floor: cls.floor,
             crownPitch: +r.crownPitch.toFixed(1),
             crownPitchMin: cls.crownPitch || null,
             dist: +r.dEff.toFixed(2), bearing: +r.bear.toFixed(1),
             comp: [+r.comp[0].toFixed(3), +(r.comp[1] || 0).toFixed(3)],
             camY: spec.camY, follow: !!spec.follow,
             anchor: [+r.A.x.toFixed(3), +r.A.y.toFixed(3), +r.A.z.toFixed(3)],
             solved: r.why },
    flags: {
      intro: !!spec.intro, blinding: !!spec.blinding, offstage: !!spec.offstage,
      gateTarget: spec.gateTarget || null,
    },
  };
}

/* the wide budget: ONE per beat, and it is the heading's */
for (const [b, n] of Object.entries(wideByBeat))
  if (n > 1) warn.push(`beat ${b}: ${n} WIDE shots — the budget is one`);

/* ====================================================================== *
 * THE ESCALATION LAW (Sol r1 #7: "these are essentially the same high,
 * neutral master repeated three times — they flatten time and make the cave
 * feel safe").
 *
 * A budget of one wide per beat is not enough on its own: four wides that
 * agree ARE one wide shown four times. So the cave headings are a LADDER —
 * each one lower and tighter than the one before it, until Beat V breaks the
 * pattern by turning the camera around to face the way out. The rungs are
 * asserted here, in the table's own provenance, so a later edit cannot
 * quietly flatten them back.
 * ====================================================================== */
const LADDER = ['ody-ii-00-head', 'ody-iii-00-head', 'ody-iv-00-head'];
const escalation = { rungs: [], ok: true, turn: null };
for (const id of LADDER) {
  const r = rows[id];
  if (!r) { warn.push(`escalation: ${id} has no row`); escalation.ok = false; continue; }
  escalation.rungs.push({ unit: id, camY: r.pos[1], fov: r.fov, dist: r.frame.dist });
}
for (let i = 1; i < escalation.rungs.length; i++) {
  const a = escalation.rungs[i - 1], b = escalation.rungs[i];
  if (!(b.camY < a.camY - 0.05)) {
    warn.push(`escalation: ${b.unit} camY ${b.camY} is not below ${a.unit} ${a.camY}`);
    escalation.ok = false;
  }
  if (!(b.dist < a.dist - 0.2)) {
    warn.push(`escalation: ${b.unit} stands ${b.dist} m out — no closer than ${a.unit} ${a.dist} m`);
    escalation.ok = false;
  }
}
{
  /* the turn: Beat V's heading faces the MOUTH, upstage of every other cave
     wide, which is the whole point of it — the way out is now the subject */
  const v = rows['ody-v-00-head'];
  if (v) {
    escalation.turn = { unit: 'ody-v-00-head', anchorX: v.frame.anchor[0], camX: v.pos[0],
                        faces: v.frame.anchor[0] < v.pos[0] ? 'mouth' : 'room' };
    if (escalation.turn.faces !== 'mouth') {
      warn.push('escalation: ody-v-00-head does not face the cave mouth');
      escalation.ok = false;
    }
  }
}

/* THE SCREEN-DIRECTION LEDGER — every pinned row, and the side it is pinned
   to, so the walk's own [side] gate has something to check the live frame
   against instead of re-deriving the axis from scratch. */
const sides = {};
for (const [id, r] of Object.entries(rows)) if (r.frame.side) sides[id] = r.frame.side;

const out = {
  lane: 'cine-r2',
  escalation,
  axis: { law: 'IN THE CAVE THE GIANT IS FRAME RIGHT AND THE MEN ARE FRAME LEFT; at sea the island is frame RIGHT and the ship frame LEFT — the direction she is leaving in.', sides },
  created: new Date().toISOString().slice(0, 10),
  law: 'shot = {pos, lookAt, fov, move, dof}. Distance is never chosen: d = h / (2 f tan(fov/2)) — `frac` is the declared size and the class floor is the minimum share of FRAME HEIGHT the subject may occupy. Camera stations obey the PROSCENIUM LAW (inside the set camera volume, out of every ledger obstacle box). A unit advance is a CUT; within-unit moves are continuous and eased.',
  source: 'tools/ody/shots3d_bake.mjs (this table\'s provenance) over 3d/lenses.json marks + app/units.js',
  classes: CLASSES,
  sets: Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, { vol: v.vol, cone: v.cone }])),
  units: rows,
  warnings: warn,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');

console.log(`shots3d.json: ${Object.keys(rows).length} units`);
const byCls = {};
for (const r of Object.values(rows)) byCls[r.class] = (byCls[r.class] || 0) + 1;
console.log('classes:', JSON.stringify(byCls));
if (warn.length) { console.log('WARNINGS:'); for (const x of warn) console.log('  -', x); }
else console.log('no warnings');
