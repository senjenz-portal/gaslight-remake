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
 * THE SETUP REGISTRY — THE DIRECTOR'S CUT (round 3, lens: SPIELBERG).
 *
 * THE DEFECT THIS ANSWERS (owner, 2026-08-21): "the full-3D book must PRESENT
 * like a film — consecutive units must cut like an edited scene from different,
 * story-motivated angles." Round 2 gave every unit a good shot; it did not give
 * any scene a CUT PATTERN. Thirteen units meant thirteen unrelated stations —
 * which is exactly Sol's round-1 note ("the sequence reads as set coverage, not
 * escalating cinema") restated one level up.
 *
 * A film scene is not a list of shots. It is a small vocabulary of CAMERA
 * SETUPS, established once and then ALTERNATED: master, single, reverse,
 * insert, reaction. A setup that returns is the same angle on the action, so
 * the reader re-enters a place they already know and the cut carries meaning
 * instead of novelty. That is what this registry is.
 *
 * A SETUP is a stable ANGLE ON THE ACTION — the direction the lens looks from,
 * the height it looks from, and the glass it looks through. Between takes of
 * one setup the lens may punch in (fov / frac) and the subject may be a
 * different body in the same relationship: that is coverage, not a new setup.
 *
 * THE COVERAGE LAW, gated below: NO TWO CONSECUTIVE UNITS MAY SHARE A SETUP
 * unless the row declares `hold: '<reason>'`, and a held row is the SAME shot
 * still running (same station, same lens, same move — the clock does not
 * restart), because that is what a hold is.
 *
 * THE CAVE HAS ONE VOCABULARY (`CV-*`) across Beats II-V: it is one room and a
 * reader who learns the door angle in Beat II must recognise it in Beat IV. The
 * four cave ESTABLISHING setups stay four, one per beat, because they are the
 * escalation ladder (each lower and tighter than the last, then the turn to the
 * mouth in Beat V) and each is used exactly ONCE.
 * ====================================================================== */
const SETUPS = {
  /* ---------------- BEAT I · the shore ---------------- */
  'SH-EST': { name: 'THE BLACK STRAIT', role: 'establishing',
    note: 'the night master, craning down out of the weather onto the fleet',
    from: [470, 740], camY: 15, fov: 36, comp: [0, 0.06], dof: { f: 8, near: 0.55 } },
  'SH-FLEET': { name: 'THE FLEET IN MIST', role: 'wide',
    note: 'ships ghosting in at four metres — the tale\'s voice has a place to come from',
    from: [455, 700], camY: 4.6, fov: 33, comp: [-0.08, 0.05], dof: { f: 5.6 } },
  'SH-TELLER': { name: 'THE TELLER', role: 'single',
    note: 'Ulysses at a man\'s eye from the west of the camp, look-room to the strait',
    from: [332, 588], camY: 1.62, fov: 28, comp: [-0.15, 0.05], dof: { f: 2.8 } },
  'SH-CAMP': { name: 'THE CAMP FIRE', role: 'reaction',
    note: 'the men at the embers from the seaward side — the faces that will turn',
    from: [575, 610], camY: 1.66, fov: 32, comp: [-0.13, 0.04], dof: { f: 3.5 } },
  'SH-STRAIT': { name: 'ACROSS THE STRAIT', role: 'reveal',
    note: 'the long lens on the far mainland: the smoke, then the mouth, then the climb',
    from: [600, 548], camY: 2.4, fov: 20, comp: [0.08, -0.05], dof: { f: 9, near: 0.45 } },
  'SH-ISLAND': { name: 'THE GOAT ISLAND', role: 'reestablish',
    note: 'the day state — a time cut, not a repeat of the night master',
    from: [372, 640], camY: 4.4, fov: 40, comp: [-0.10, 0.10], dof: { f: 8 } },
  'SH-COUNCIL': { name: 'THE COUNCIL, OVER THE SHOULDER', role: 'ots',
    note: 'a stride behind the listener; the speaker on the third, the ship in his look-room',
    over: 'crew-0', from: [455, 596], behind: 1.35, overSide: 2.5,
    camY: 1.62, fov: 32, comp: [0.20, -0.02], dof: { f: 2.5 } },
  'SH-CRAG': { name: 'THE CRAG', role: 'reveal',
    note: 'the empty mouth held, then the lens tilts the cliff up into the sky',
    from: [690, 520], camY: 2.2, fov: 27, comp: [0.05, -0.14], dof: { f: 11 } },
  'SH-SKIN': { name: 'THE WINESKIN', role: 'insert',
    note: 'the gift read as an object, close on a 35 mm and above the gunwale between',
    from: [1010, 600], camY: 1.68, fov: 40, comp: [0.16, 0.05], dof: { f: 2.2 } },

  /* ---------------- BEATS II-V · the cave, one vocabulary ---------------- */
  /* the four establishing rungs — each used ONCE, each lower and tighter */
  'CV-EST2': { name: 'THE ROOM, LOW AND EXPLORATORY', role: 'establishing',
    note: 'rung 1: the height of a man who has just walked in, drifting to find the room',
    bear: 58, camY: 1.55, fov: 56, dist: 7.6, comp: [0, 0.04], dof: { f: 8, near: 0.5 } },
  'CV-EST3': { name: 'THE FIRE, TIGHTER', role: 'establishing',
    note: 'rung 2: the conspiracy is hatched at the blaze, printed down so flame keeps detail',
    bear: -64, camY: 1.25, fov: 50, dist: 6.6, comp: [0.04, 0.03],
    dof: { f: 8, near: 0.5, expo: 0.88 } },
  'CV-EST4': { name: 'THE FLOOR', role: 'establishing',
    note: 'rung 3: the room has stopped being a room and become ground to work on',
    bear: -80, camY: 0.95, fov: 46, dist: 5.4, comp: [0.05, 0.05],
    dof: { f: 8, near: 0.5, expo: 0.9 } },
  'CV-EST5': { name: 'THE TURN — FACING THE MOUTH', role: 'establishing',
    note: 'rung 4: the ladder breaks and the camera turns round; the way out is the subject',
    station: [1.60, 1.80, 3.40], fov: 38, comp: [0.06, 0.02], seesOver: true,
    dof: { f: 8, near: 0.5 }, read: { fill: 0.35, rim: 0.75 } },
  /* the working angles */
  'CV-DOOR': { name: 'THE DOOR, FROM THE DARK', role: 'geography',
    note: 'the mouth seen from the men\'s hiding place — the shot the stone shuts',
    from: [580, 608], camY: 1.66, fov: 33, comp: [-0.10, 0.02], dof: { f: 4 } },
  'CV-RACKS': { name: 'THE CHEESE RACKS', role: 'geography',
    note: 'the wealth that walks them in, swept from the men\'s side',
    from: [660, 620], camY: 1.70, fov: 30, comp: [-0.12, 0.03], dof: { f: 3.5 } },
  'CV-GIANT-E': { name: 'THE GIANT, FROM HIS FEET (east)', role: 'giant',
    note: 'the scale angle: a waist-high lens east of the fire with a man at his feet',
    from: [960, 590], camY: 1.05, fov: 50, comp: [0.10, -0.04], dof: { f: 2.8 } },
  'CV-GIANT-W': { name: 'THE GIANT, FROM THE WEST', role: 'giant',
    note: 'the answering low angle from the mouth side — the eye unblinking',
    from: [612, 610], camY: 1.50, fov: 46, comp: [0.14, 0.03], dof: { f: 2.8 } },
  /* THE STANDOFF IS MEASURED AGAINST HIS MASS, NOT AGAINST HIS ORIGIN. At
     1.25 m behind a SEATED GIANT's placement the lens is inside his torso: the
     recorded scene showed five of the plea's six seconds as a wall of blurred
     flesh with the suppliant nowhere in it. A shoulder frames the near edge of
     an OTS; it does not BE the OTS. Standoff is now most of his seated radius
     and the swing is far enough round his side to see past the upper arm. */
  'CV-OVER': { name: 'OVER HIS SHOULDER, LOOKING DOWN', role: 'ots',
    note: 'the reverse the giant owns: his bulk on the near edge, the petitioner small below',
    over: 'poly-seat', from: [640, 640], behind: 2.8, overSide: 36,
    camY: 3.40, fov: 34, comp: [-0.19, -0.06], dof: { f: 2.5 } },
  'CV-ULY': { name: 'ULYSSES, A MAN\'S EYE', role: 'single',
    note: 'the clean reverse onto the man; from the lie on it carries the giant\'s shoulder',
    from: [612, 636], camY: 1.58, fov: 26, comp: [-0.17, 0.05], dof: { f: 2.2 } },
  'CV-FIRE': { name: 'THE FIRE — THE SEIZE IN SHADOW', role: 'action',
    note: 'the horror staged against the blaze and never printed; the same angle all three meals',
    from: [900, 596], camY: 1.45, fov: 44, comp: [-0.12, 0.00], dof: { f: 2.8 } },
  /* MOVED, round 2. Sol: "the intended reaction angle becomes a wall of the
     giant's torso." At 700 px the station was east of the men and the seated
     giant sat between the lens and the faces it exists to photograph. It now
     stands downstage and west of them, so the horror plays BEHIND the faces
     instead of in front of them, which is the whole point of the setup. */
  'CV-MEN': { name: 'THE MEN WATCHING', role: 'reaction',
    from: [634, 678], camY: 1.56, fov: 30, comp: [-0.14, 0.03], dof: { f: 2.5 },
    note: 'the faces that see it — by the second meal the reader knows what they are looking at' },
  'CV-OBJ': { name: 'THE HAND BENCH', role: 'insert',
    note: 'hand height, downstage centre: the sword at the hip, the beam in the coals',
    from: [640, 652], camY: 1.15, fov: 30, comp: [-0.15, 0.02], dof: { f: 2.2 } },
  'CV-BOWL': { name: 'THE BOWL, LOWER FOREGROUND', role: 'insert',
    note: 'the ivy-wood bowl held into the bottom of the frame, the rack doing the reveal',
    station: [0.80, 1.05, 5.00], fov: 46, comp: [-0.20, -0.30],
    dof: { f: 2.0, expo: 0.86 } },
  /* MOVED, round 2. Sol: "essentially the entire shot is occluded — the stake,
     the plot's critical object, is never established." The old station looked
     across the pens; it now stands downstage of them. */
  'CV-CLUB': { name: 'THE CLUB', role: 'reveal',
    note: 'the searching pan finds it; the mast-scale is delivered by figures beside it',
    from: [886, 692], camY: 1.64, fov: 34, comp: [0.10, -0.04], dof: { f: 4 } },
  'CV-LOTS': { name: 'THE CIRCLE, FROM ABOVE', role: 'action',
    note: 'the one overhead in the book — a lot is drawn in a ring and read from over it',
    from: [880, 668], camY: 2.35, fov: 36, comp: [0, 0.06], dof: { f: 3.5 } },
  /* MOVED, round 2. Sol: "the fall is visible briefly, but shelving covers
     half the frame." Downstage and west of the racks, and lower. */
  'CV-COLLAPSE': { name: 'THE COLLAPSE', role: 'aftermath',
    note: 'low, craning as the body settles; the shot the next beat is standing in',
    from: [688, 702], camY: 1.05, fov: 46, comp: [0.06, -0.06], dof: { f: 2.8 } },
  'CV-AFTER': { name: 'THE AFTERMATH', role: 'aftermath',
    note: 'not the establishing shot: a night station, small shapes against the stone',
    bear: 62, camY: 1.9, fov: 40, comp: [0, 0.04], dof: { f: 5.6 } },
  'CV-FIVEFACES': { name: 'FIVE FACES, LIT FROM BELOW', role: 'reaction',
    note: 'the drawn point is the lamp; the faces arrive before the weapon does',
    from: [636, 640], camY: 1.05, fov: 28, comp: [-0.13, 0.02], dof: { f: 2.0 } },
  'CV-AUGER': { name: 'ALONG THE BEAM, FROM THE FLOOR', role: 'action',
    note: 'the shaft enters the lower corner on the men\'s hands, the eye sits opposite',
    from: [760, 636], camY: 0.95, fov: 40, comp: [-0.15, 0.06], dof: { f: 2.2 } },
  'CV-BLIND': { name: 'AT ATTACKER HEIGHT — THE BLINDING', role: 'action',
    note: 'he fills the vertical frame; the operator is locked off until contact',
    from: [788, 624], camY: 1.45, fov: 52, comp: [0.11, -0.02], fill: true,
    dof: { f: 2.2 } },
  'CV-SEATED': { name: 'SEATED IN THE MOUTH', role: 'tableau',
    note: 'the door is open and utterly barred; a slow push out of the cave\'s dark',
    station: [0.26, 1.45, 4.72], fov: 52, comp: [0.12, -0.04], dof: { f: 2.8 } },
  'CV-WITHIES': { name: 'HANDS AND FLEECE', role: 'insert',
    note: 'the lashing, noiseless, kept under his breathing',
    from: [880, 630], camY: 1.20, fov: 32, comp: [0.12, 0.02], dof: { f: 2.5 } },
  'CV-DAWNMOUTH': { name: 'THE LIGHT PAST HIM', role: 'reestablish',
    note: 'dawn breaks through the mouth past the seated giant; the light is the goal',
    bear: 70, camY: 2.4, fov: 46, dist: 7.5, comp: [-0.06, 0.04], dof: { f: 5.6 } },
  'CV-HANDPASS': { name: 'THE HAND OVER THE WOOL', role: 'action',
    note: 'low and close on the flock\'s side: the palm strokes the fleece that hides a man',
    from: [600, 650], camY: 0.95, fov: 44, comp: [0.11, 0.02], dof: { f: 2.6 } },
  'CV-BELLY': { name: 'UNDER THE BELLY', role: 'pov',
    note: 'the belly line roofs the frame; the rack finds the man, not the obstruction',
    from: [430, 604], camY: 0.58, fov: 40, comp: [-0.14, -0.06], follow: true,
    dof: { f: 2.5 } },
  'CV-RAMSPEECH': { name: 'THE BLIND MAN SPEAKING DOWN', role: 'giant',
    note: 'gentle for the first time in the chapter, and talking to the wrong animal',
    from: [500, 592], camY: 1.28, fov: 47, comp: [0.12, 0.02], dof: { f: 2.8 } },
  'CV-TWOSHOT': { name: 'THE RUINED FACE AND THE WOOL', role: 'two-shot',
    note: 'profile: his face above, the fists in the fleece below, one arm\'s length apart',
    from: [420, 600], camY: 1.24, fov: 46, comp: [-0.11, 0.02], dof: { f: 2.8 } },
  /* MOVED, round 2: with the ram-speech two-shot re-lensed the solver put this
     station 1.16 m and 0.4 deg off the speech single — a punch-in wearing a
     new name, which is the exact defect Sol names at Beat VI 00:39.5. */
  'CV-OUT': { name: 'BACK AT THE MOUTH', role: 'aftermath',
    note: 'over the shoulder into open dawn, the giant still seated and small now',
    from: [404, 672], camY: 1.55, fov: 32, comp: [-0.14, 0.04], follow: true,
    dof: { f: 3.2 } },
  'SEA-EST': { name: 'THE TWO PLANES', role: 'establishing',
    note: 'ship frame left, island and its blinded figure frame right — the axis, declared once',
    over: 'ulysses', from: [470, 560], camY: 3.4, fov: 22, comp: [0.16, -0.08],
    dof: { f: 5.6 } },
  'SEA-STERN': { name: 'AT THE STERN', role: 'single',
    note: 'off the seaward quarter, so the island sits in the look-room he shouts into',
    from: [450, 483], camY: 2.60, fov: 30, comp: [0.30, 0.04], dof: { f: 2.5 } },
  'SEA-ROCK': { name: 'THE THROW', role: 'action',
    note: 'the eye rides the arc and the splash takes it; the settle is the operator\'s',
    from: [430, 600], camY: 3.0, fov: 34, dist: 22, comp: [-0.10, -0.06],
    dof: { f: 8 } },
  'SEA-DECK': { name: 'THE DECK', role: 'geography',
    note: 'the ship\'s three-quarter interior; oars trailing, the hush before the plea',
    from: [470, 590], camY: 2.6, fov: 32, comp: [-0.10, 0.02], dof: { f: 4 } },
  'SEA-MEN': { name: 'THE ROWERS', role: 'reaction',
    note: 'faces up at him, one hand on his arm — the plea the reader will click over',
    from: [520, 560], camY: 2.7, fov: 26, comp: [-0.16, 0.05], dof: { f: 2.2 } },
  'SEA-CLIFF': { name: 'THE CLIFF CLOSE', role: 'giant',
    note: 'the long lens past the ship: the prophecy, and the arms lifted to the firmament',
    from: [500, 520], camY: 3.2, fov: 17, comp: [0.14, -0.06], dof: { f: 4 } },
  'SEA-HAND': { name: 'THE BECKONING HAND', role: 'giant',
    note: 'a step round and a step lower as the tone turns wheedling: come here, then',
    from: [560, 540], camY: 3.0, fov: 16, comp: [-0.13, -0.06], dof: { f: 4 } },
  'SEA-ALTAR': { name: 'THE DRIFTWOOD ALTAR', role: 'aftermath',
    note: 'the thigh-fire smoke rising straight into a sky that gives no sign',
    from: [560, 620], camY: 2.4, fov: 36, comp: [-0.10, 0.03], dof: { f: 4 } },
  'SEA-OFF': { name: 'THE SAIL-OFF', role: 'aftermath',
    note: 'the ship frame left with open water ahead and the island shrinking behind',
    station: [-49.0, 9.0, 20.0], fov: 54, comp: [0.34, -0.30], side: -1,
    dof: { f: 11, near: 0.4 } },

  /* ================================================================== *
   * ROUND 2 · THE INSERT AND REACTION VOCABULARY.
   *
   * Sol's round-1 verdict names the same absence in all six scenes: "the
   * essential reaction and action inserts DO NOT EXIST ... this cannot be
   * solved by trimming alone." Round 1 had a setup for every ANGLE ON A
   * PERSON and almost none for a HAND, an OBJECT, or a FACE THAT IS ONLY
   * WATCHING — which is exactly the half of the vocabulary a cut list needs,
   * because those are the shots that fit inside a line of text.
   *
   * Every one of these is a real station solved by the same solver against
   * the same furniture; none is a crop of the shot beside it.
   * ================================================================== */

  /* ---- shore: the council triangle and the crossing ---- */
  /* STANDOFF 2.6 m AND 44 deg ROUND HIS SIDE — the CV-OVER lesson applied
     before it could cost another round: at 1.5 m behind a man the lens is
     inside his back and the frame reads 99 % dark. */
  'SH-CREW': { name: 'THE CREW, THE MATCHED REVERSE', role: 'reaction',
    note: 'over Ulysses onto the faces that answer him — the other half of the council',
    over: 'ulysses', from: [300, 636], behind: 2.6, overSide: 44,
    camY: 1.60, fov: 34, comp: [-0.18, 0.02], dof: { f: 2.5 } },
  'SH-SHIP': { name: 'THE SHIP ON THE SAND', role: 'insert',
    note: 'the thing he is pointing at and the thing the reader clicks, photographed once',
    from: [700, 668], camY: 1.35, fov: 30, comp: [0.14, 0.02], dof: { f: 4 } },
  'SH-KEEL': { name: 'AT THE WATERLINE', role: 'action',
    note: 'the crossing as travel: a low lens off the keel, the mainland coming up',
    from: [742, 558], camY: 0.92, fov: 34, comp: [-0.13, -0.02], follow: true,
    dof: { f: 4 } },

  /* ---- cave: the hands, the objects, the stone ---- */
  'CV-GRIP': { name: 'THE HAND THAT TAKES THEM', role: 'insert',
    note: 'the reach itself, low and close east of the blaze — the shot the seize never had',
    from: [858, 646], camY: 1.10, fov: 34, comp: [-0.13, 0.02], dof: { f: 2.2 } },
  'CV-HILT': { name: 'THE HAND ON THE HILT', role: 'insert',
    note: 'the decision as a grip: knuckles, guard, the fire behind them',
    from: [556, 672], camY: 0.90, fov: 34, comp: [0.14, 0.03], dof: { f: 2.0 } },
  'CV-VITALS': { name: 'PAST THE BLADE, UP AT HIM', role: 'giant',
    note: 'the place the blow would land, seen over the drawn sword — and how far up it is',
    from: [702, 692], camY: 0.85, fov: 44, comp: [0.12, -0.05], dof: { f: 2.5 } },
  'CV-STONE': { name: 'THE STONE AT CLOSE QUARTERS', role: 'insert',
    note: 'the door as a mass, not a doorway: the lid clapping to, the hand finding it',
    from: [470, 566], camY: 1.30, fov: 34, comp: [0.13, 0.02], dof: { f: 3.2 } },
  'CV-HANDS': { name: 'THE HANDS ON THE BEAM', role: 'insert',
    note: 'work: the cutting, and later the twisting — the same hands, the same angle',
    from: [792, 670], camY: 1.00, fov: 32, comp: [-0.14, 0.02], dof: { f: 2.2 } },
  'CV-POINT': { name: 'THE POINT', role: 'insert',
    note: 'the sharpened end — charred in Beat III, white-hot in Beat IV',
    from: [598, 692], camY: 0.95, fov: 30, comp: [0.13, 0.03], dof: { f: 2.0 } },
  'CV-POUR': { name: 'THE POUR', role: 'insert',
    note: 'the wine going in and the level going down; three takes, three different states',
    from: [762, 692], camY: 1.05, fov: 34, comp: [0.12, -0.02], dof: { f: 2.0 } },
  'CV-SEAM': { name: 'THE SEAMS', role: 'insert',
    note: 'the neighbours are never seen: they are lamplight moving in the cracks of a shut stone',
    from: [522, 646], camY: 1.85, fov: 26, comp: [-0.12, -0.04], dof: { f: 4 } },
  'CV-WOOL': { name: 'THE FISTS IN THE FLEECE', role: 'insert',
    note: 'from under the flank: the grip that is the only thing between a man and the floor',
    from: [706, 614], camY: 0.72, fov: 36, comp: [-0.12, 0.04], dof: { f: 2.4 } },
  'CV-GATEWAY': { name: 'THE WAY OUT, WITH HIM IN IT', role: 'geography',
    note: 'the one frame that holds the blind giant, the gate, and the direction the flock goes',
    from: [566, 694], camY: 1.70, fov: 44, comp: [0.12, 0.03], dof: { f: 5.6 } },

  /* ---- sea: the missing reverse and the throw ---- */
  'SEA-DOWN': { name: 'FROM THE HEADLAND, LOOKING DOWN', role: 'reverse',
    note: 'the answering half of the axis: the ship as he would see it, small and below',
    from: [640, 430], camY: 12.0, fov: 28, comp: [-0.16, -0.10], dof: { f: 8 } },
  'SEA-GRIP': { name: 'THE ROCK IN HIS HANDS', role: 'action',
    note: 'the wind-up: the mass leaves the clifftop before it crosses the water',
    from: [608, 474], camY: 14.0, fov: 30, comp: [0.13, -0.06], dof: { f: 5.6 } },
  'SEA-OAR': { name: 'THE OAR BITES', role: 'insert',
    note: 'consequence at the waterline — twenty men rowing because of one man\'s mouth',
    from: [524, 646], camY: 1.60, fov: 38, comp: [-0.14, 0.06], dof: { f: 3.5 } },
};

/* ====================================================================== *
 * THE SEQUENCES — one row per unit, in reading order, each naming the SETUP
 * it is shot on. A row carries only what makes it a TAKE of that setup: the
 * subject, the size (`frac` / `dist`), the lens if the take punches in, the
 * move, the focus. Everything else is the setup's.
 *
 *   hold:'<reason>'  the shot does not change — the row inherits the held
 *                    row's geometry, subject and move outright and the move
 *                    clock keeps running. Two in the book, both because the
 *                    reader must not be taken off the thing they are watching.
 *   into:'dissolve'  the ONE transition the lens allows besides the straight
 *                    cut, and only for a TIME ELLIPSIS (five in the book, all
 *                    of them a night that has become a morning).
 * ====================================================================== */
const SPEC = {
  /* ---------------- BEAT I · THE TALE BEGUN — shore ----------------
     COVERAGE: EST · FLEET · TELLER · CAMP · STRAIT · ISLAND · CAMP · COUNCIL ·
     STRAIT · CRAG · TELLER · SKIN · STRAIT — nine setups, twelve cuts. The
     strait is the recurring threat angle and it tightens every time it returns
     (64 m of telephoto, then 38, then 24); the camp fire is the recurring
     reaction angle. */
  'ody-i-00-head': { setup: 'SH-EST', cls: 'WIDE', sub: { m: [520, 470], h: 11, y: 2.5 },
    dist: 44, move: { k: 'crane', dy: 9, dz: 5, dur: 7 } },
  'ody-i-01-bard': { setup: 'SH-FLEET', cls: 'NARRATION', sub: { m: [500, 474], h: 6.2, y: 1.6 },
    move: { k: 'push', cms: 4.0 },
    cuts: [{ t: 4.2, setup: 'SH-CAMP', sub: { m: [479, 507], h: 1.7, y: 0.85 }, frac: 0.32,
      move: { k: 'push', cms: 3.0 },
      why: 'the tale has listeners: the faces it is being told to arrive before it is half a minute old' }] },
  'ody-i-02-iamulysses': { setup: 'SH-TELLER', cls: 'ACTION', sub: { a: 'ulysses' },
    frac: 0.40, move: { k: 'track', m: 1.1, dur: 9 }, follow: true },
  'ody-i-03-troy': { setup: 'SH-CAMP', cls: 'NARRATION', sub: { m: [479, 507], h: 1.7, y: 0.85 },
    frac: 0.30, move: { k: 'push', cms: 3.0 } },
  'ody-i-04-lawless': { setup: 'SH-STRAIT', cls: 'ACTION', sub: { m: [980, 205], h: 13, y: 6.5 },
    fov: 15, dist: 64, comp: [0.10, -0.05], move: { k: 'push', cms: 22 },
    dof: { f: 11, near: 0.4 },
    cuts: [{ t: 4.4, setup: 'SH-CRAG', sub: { m: [1050, 200], h: 22, y: 10 }, dist: 72, fov: 24,
      comp: [0.05, -0.12], move: { k: 'push', cms: 20 },
      why: 'the land the smoke belongs to, planted here so the crag pays off later' }] },
  'ody-i-05-dawn': { setup: 'SH-ISLAND', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.21,
    into: 'dissolve', move: { k: 'crane', dy: 3.6, dz: 2.4, dur: 8 } },
  /* THE COUNCIL TRIANGLE, first corner. Sol: "Ulysses' introduction has no
     teller/listener relationship, reaction, or meaningful point of view." The
     lens's own rule orders it — the face that sees, then the thing seen. */
  'ody-i-06-smoke': { setup: 'SH-CAMP', cls: 'NARRATION', sub: { m: [479, 507], h: 1.7, y: 0.85 },
    fov: 30, frac: 0.38, move: { k: 'push', cms: 3.5 },
    cuts: [
      { t: 3.0, setup: 'SH-CREW', sub: { a: 'crew-0' }, frac: 0.46, move: { k: 'push', cms: 2.8 },
        why: 'the eyes turning — the crew reverse the council never had' },
      { t: 5.2, setup: 'SH-STRAIT', cls: 'ACTION', sub: { m: [980, 205], h: 13, y: 6.5 },
        fov: 16, dist: 58, comp: [0.09, -0.05], move: { k: 'push', cms: 20 },
        dof: { f: 11, near: 0.4 },
        why: 'and only then the smoke they are looking at' }] },
  /* A GATE UNIT KEEPS ONE FRAME. The ship insert was first written INSIDE this
     unit and the [hit] probe killed it: the reader's ring and the click both
     ride an aim measured against the live shot, and a cut mid-gate leaves a
     finger reaching for a camera that has moved. (The aim cache is dropped on
     a sub-cut now — that part was a real bug — but the deeper point stands: a
     unit whose whole job is to be pressed does not get to change its mind.)
     The insert moved one unit down the reel, to the line that is ABOUT the
     ship, which is where it always belonged. */
  /* sepDeg 0: THE SEPARATION CONSTRAINT MAY NOT SWING A GATE OFF ITS TARGET.
     Adding one insert three units upstream re-solved the whole chain and put
     this station 20 deg round from the authored bearing — far enough that the
     ship left the look-room and the reader's own gate went DEAD on the lap.
     A row whose framing carries an affordance is authored, and says so. */
  'ody-i-07-council': { setup: 'SH-COUNCIL', cls: 'OTS', sub: { a: 'ulysses' },
    move: { k: 'push', cms: 2.6 }, gateTarget: 'ship', sepDeg: 0 },
  /* THE CROSSING IS AN ACTION CHAIN (Sol #2): "Ulysses is cut away mid-stride
     to a static cave ... no exit, oar, keel, water or directional movement
     carries us across the strait." The unit now travels before it arrives. */
  'ody-i-08-cave': { setup: 'SH-KEEL', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.48,
    move: { k: 'track', m: 1.4, dur: 7 }, follow: true, read: { fill: 3.0, rim: 3.6 },
    cuts: [{ t: 2.6, setup: 'SH-STRAIT', sub: { m: [1008, 290], h: 9, y: 3.6 },
      fov: 22, dist: 38, comp: [0.06, -0.04], move: { k: 'push', cms: 28 }, dof: { f: 8 },
      why: 'cut on the movement: the mainland arrives because the boat did' }] },
  'ody-i-09-monster': { setup: 'SH-CRAG', cls: 'NARRATION', sub: { m: [1050, 200], h: 22, y: 10 },
    dist: 56, move: { k: 'tilt', dy: 7.0, dur: 9 },
    cuts: [{ t: 4.2, setup: 'SH-STRAIT', cls: 'ACTION', sub: { m: [1008, 290], h: 9, y: 3.6 },
      fov: 20, dist: 30, comp: [0.05, -0.05], move: { k: 'push', cms: 22 }, dof: { f: 8 },
      why: 'the threat angle returns nearer every time it returns — third take, thirty metres' }] },
  'ody-i-10-wineskin': { setup: 'SH-TELLER', cls: 'NARRATION', sub: { m: [560, 503], h: 1.7, y: 0.85 },
    fov: 30, frac: 0.34, comp: [-0.13, 0.05], move: { k: 'push', cms: 3.2 }, dof: { f: 3.2 },
    cuts: [
      { t: 2.4, setup: 'SH-SHIP', cls: 'ACTION', sub: { t: 'ship', h: 6.0 }, frac: 0.44,
        move: { k: 'push', cms: 6 }, read: { fill: 2.4, rim: 2.8 },
        why: 'draw the ship ashore — the ship photographed once, as an object' },
      { t: 4.2, setup: 'SH-CAMP', sub: { m: [479, 507], h: 1.7, y: 0.85 }, fov: 30, frac: 0.44,
        move: { k: 'push', cms: 2.8 }, read: { fill: 2.4, rim: 2.8 },
        why: 'the twelve best men, chosen — the faces that are going in with him' }] },
  'ody-i-11-twentyone': { setup: 'SH-SKIN', cls: 'DIALOGUE', sub: { a: 'ulysses' }, frac: 0.62,
    move: { k: 'push', cms: 2.4 }, read: { fill: 1.8, rim: 1.7 } },
  /* END ON DREAD, NOT ON GEOGRAPHY (Sol #4). The beat's last unit is now
     three shots: the mouth, the thing he packs BECAUSE of it, and the face
     that has already decided. The scene ends on a man, not on a coastline. */
  'ody-i-12-misgave': { setup: 'SH-STRAIT', cls: 'NARRATION', sub: { m: [1008, 290], h: 9, y: 3.6 },
    fov: 24, dist: 24, comp: [0.04, -0.06], move: { k: 'push', cms: 5.0 }, dof: { f: 5.6 },
    cuts: [
      { t: 2.8, setup: 'SH-SKIN', cls: 'DIALOGUE', sub: { a: 'ulysses' }, fov: 36, frac: 0.46,
        move: { k: 'push', cms: 2.4 }, read: { fill: 1.8, rim: 1.7 },
        why: 'the wine goes in on purpose — the insert is the decision' },
      { t: 5.2, setup: 'SH-COUNCIL', cls: 'OTS', sub: { a: 'ulysses' }, frac: 0.54,
        move: { k: 'push', cms: 2.2 }, dof: { f: 2.2 },
        read: { fill: 2.6, rim: 3.0 }, sepDeg: 0,
        why: 'and the face, over the shoulder of a man he has just talked into it: my mind misgave me' }] },

  /* ---------------- BEAT II · THE CAVE — cave ----------------
     COVERAGE: EST2 · RACKS · ULY · DOOR · DOOR(hold) · GIANT-E · OVER ·
     GIANT-W · GIANT-E · ULY · FIRE · OBJ · DOOR · AFTER. The dialogue runs as
     true shot-reverse-shot on two answering angles (GIANT-E/GIANT-W up at him,
     OVER/ULY down and across at the men), and the door is the geography angle
     that returns three times — the last time to stop a sword. */
  'ody-ii-00-head': { setup: 'CV-EST2', cls: 'WIDE', sub: { m: [700, 455], h: 4.8, y: 2.7 },
    move: { k: 'track', m: 1.9, dur: 8 } },
  'ody-ii-01-beg': { setup: 'CV-RACKS', cls: 'NARRATION', sub: { m: [640, 405], h: 2.7, y: 1.35 },
    frac: 0.50, move: { k: 'push', cms: 3.4 },
    cuts: [{ t: 3.8, setup: 'CV-FIRE', sub: { m: [640, 458], h: 2.4, y: 1.2 }, frac: 0.44,
      move: { k: 'push', cms: 3.4 },
      why: 'the hearth the wealth is stacked around, planted on the angle all three meals will use' }] },
  'ody-ii-02-present': { setup: 'CV-ULY', cls: 'NARRATION', sub: { a: 'ulysses' },
    fov: 30, frac: 0.46, move: { k: 'push', cms: 3.0 }, dof: { f: 2.8 },
    cuts: [{ t: 4.2, setup: 'CV-MEN', sub: { a: 'crew-0' }, frac: 0.44, move: { k: 'push', cms: 3.0 },
      why: 'the men who told him to take the cheeses and go — "I would not listen to them" needs a them' }] },
  'ody-ii-03-return': { setup: 'CV-DOOR', cls: 'ACTION', sub: { m: [352, 430], h: 2.6, y: 1.3 },
    frac: 0.50, into: 'dissolve', move: { k: 'push', cms: 5.5 },
    read: { fill: 1.9, rim: 1.9 } },
  'ody-ii-04-boulder': { setup: 'CV-DOOR', holdOf: 'ody-ii-03-return',
    hold: 'the men never look away from the door: the frame that watched him come in is the frame the stone shuts' },
  'ody-ii-05-strangers': { setup: 'CV-GIANT-E', cls: 'GIANT', sub: { a: 'poly-seat' },
    frac: 0.66, move: { k: 'push', cms: 5.0 }, fg: 'ulysses', intro: true },
  'ody-ii-06-plea': { setup: 'CV-OVER', cls: 'DIALOGUE', sub: { a: 'ulysses' }, frac: 0.42,
    move: { k: 'push', cms: 2.8 },
    cuts: [{ t: 4.0, setup: 'CV-ULY', sub: { a: 'ulysses' }, fov: 28, frac: 0.52,
      move: { k: 'push', cms: 2.6 }, dof: { f: 2.5 }, follow: true,
      why: 'the clean reverse the over-shoulder is asking for: his own face, at his own height. ' +
           'IT FOLLOWS: the suppliant is still walking to his knees when this cuts, and a locked ' +
           'station four metres from a surveyed mark measured him at 2.9x the frame' }] },
  'ody-ii-07-pitiless': { setup: 'CV-GIANT-W', cls: 'GIANT', sub: { a: 'poly-seat' },
    frac: 0.66, move: { k: 'push', cms: 3.4 },
    cuts: [{ t: 4.2, setup: 'CV-MEN', cls: 'ACTION', sub: { a: 'crew-0' }, frac: 0.44,
      move: { k: 'push', cms: 3.0 },
      why: 'the men hearing that no god of theirs is coming' }] },
  'ody-ii-08-shipfast': { setup: 'CV-GIANT-E', cls: 'GIANT', sub: { a: 'poly-seat' },
    fov: 44, frac: 0.70, comp: [0.12, 0.03], move: { k: 'push', cms: 3.0 } },
  'ody-ii-09-shiplie': { setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' },
    over: 'poly-seat', frac: 0.62, move: { k: 'push', cms: 2.6 },
    cuts: [{ t: 3.8, setup: 'CV-OVER', cls: 'OTS', sub: { a: 'ulysses' }, frac: 0.38,
      move: { k: 'push', cms: 2.6 },
      why: 'from over his shoulder: the size of the man who is lying to him' }] },
  /* THE SEIZE IS AN ESCALATION, NOT A TABLEAU (Sol II #2): "the strongest
     action — the giant reaching toward the man — gets neither a hand insert
     nor an immediate facial reaction." Three shots, each shorter. */
  'ody-ii-10-firstmeal': { setup: 'CV-FIRE', cls: 'ACTION', sub: { a: 'poly-seat' },
    frac: 0.62, move: { k: 'handheld', amp: 0.010, dur: 6 },
    cuts: [
      { t: 2.2, setup: 'CV-GRIP', sub: { a: 'crew-0' }, frac: 0.74, move: { k: 'push', cms: 8 },
        read: { fill: 2.2, rim: 5.4 }, sepDeg: 0,
        why: 'the reach itself — the hand insert' },
      { t: 3.8, setup: 'CV-MEN', sub: { a: 'ulysses' }, frac: 0.46,
        move: { k: 'handheld', amp: 0.012, dur: 5 },
        why: 'and immediately the faces, which is where the horror actually lives' }] },
  /* THE SWORD BEAT AS A CINEMATIC SENTENCE (Sol II #3). It runs across two
     units: decision (the hilt at the hip) / grip / the place the blow would
     land / his eyes / the mass that answers them. Both shots of the GATE unit
     keep the sword in frame, because the reader has to be able to press it. */
  'ody-ii-11-sword': { setup: 'CV-OBJ', cls: 'GATE', sub: { t: 'sword', h: 1.0 },
    at: [680, 554], atY: 0.85, over: 'ulysses', frac: 0.30, move: { k: 'push', cms: 5.0 },
    cuts: [{ t: 2.4, setup: 'CV-HILT', sub: { t: 'sword', h: 0.7 }, at: [700, 556], atY: 0.90,
      frac: 0.34, move: { k: 'push', cms: 6 }, read: { fill: 1.8, rim: 5.6 }, sepDeg: 0,
      why: 'the decision becomes a grip — knuckles, guard, the blaze behind them' }] },
  'ody-ii-12-shiftstone': { setup: 'CV-VITALS', cls: 'GIANT', sub: { a: 'poly-idle' },
    frac: 0.74, move: { k: 'push', cms: 4.5 },
    cuts: [
      { t: 2.2, setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' }, fov: 26, frac: 0.60,
        move: { k: 'push', cms: 2.4 }, dof: { f: 2.2 },
        why: 'his eyes, doing the arithmetic that saves them' },
      { t: 4.0, setup: 'CV-STONE', cls: 'NARRATION', sub: { m: [352, 430], h: 4.6, y: 2.2 },
        frac: 0.52, move: { k: 'push', cms: 3.0 },
        why: 'and the mass that answers it: we should never be able to shift the stone' }] },
  'ody-ii-13-tillmorning': { setup: 'CV-AFTER', cls: 'NARRATION', sub: { m: [700, 470], h: 3.0, y: 1.3 },
    frac: 0.30, move: { k: 'push', cms: 4.0 } },

  /* ---------------- BEAT III · NOBODY — cave ----------------
     COVERAGE: EST3 · MEN · DOOR · SCHEME · CLUB · LOTS · FLOCK · FIRE · BOWL ·
     GIANT-W · BOWL · ULY · GIANT-W · COLLAPSE. The second meal is covered on
     the FACES (the reader already knows what they are looking at), the bowl is
     an A-B-A: offered, his face, offered again with the rack reversed. */
  'ody-iii-00-head': { setup: 'CV-EST3', cls: 'WIDE', sub: { m: [640, 468], h: 3.9, y: 2.2 },
    move: { k: 'push', cms: 9 } },
  'ody-iii-01-morningmeal': { setup: 'CV-MEN', cls: 'ACTION', sub: { a: 'crew-0' }, frac: 0.44,
    into: 'dissolve', move: { k: 'push', cms: 4.5 },
    cuts: [{ t: 2.8, setup: 'CV-GRIP', sub: { a: 'crew-0' }, frac: 0.62, move: { k: 'push', cms: 8 },
      why: 'the clutch — the second meal is the same hand, and now the reader knows the hand' }] },
  'ody-iii-02-quiverlid': { setup: 'CV-DOOR', cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 },
    frac: 0.40, move: { k: 'push', cms: 9 },
    cuts: [{ t: 2.4, setup: 'CV-STONE', sub: { m: [352, 430], h: 2.6, y: 1.3 }, frac: 0.50,
      move: { k: 'push', cms: 8 },
      why: 'the lid claps to — the stone as a mass, at the distance a man would flinch from' }] },
  'ody-iii-03-scheme': { setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' }, frac: 0.64,
    move: { k: 'push', cms: 2.4 } },
  /* THE STAKE IS MADE ON SCREEN (Sol III #2): club wide, cutting hand, charred
     point. Round 1 named the object and never photographed it. */
  'ody-iii-04-club': { setup: 'CV-CLUB', cls: 'NARRATION', sub: { m: [880, 380], h: 5.6, y: 2.6 },
    frac: 0.44, move: { k: 'push', cms: 3.6 },
    cuts: [
      { t: 3.0, setup: 'CV-HANDS', cls: 'ACTION', sub: { p: 'stake', h: 1.1 }, frac: 0.40,
        move: { k: 'push', cms: 5 }, why: 'a fathom of it cut off' },
      { t: 5.0, setup: 'CV-POINT', cls: 'ACTION', sub: { p: 'stake', h: 1.1 }, frac: 0.34,
        move: { k: 'push', cms: 4 }, why: 'and sharpened to a point, and charred' }] },
  'ody-iii-05-lots': { setup: 'CV-LOTS', cls: 'ACTION', sub: { m: [713, 527], h: 1.8, y: 0.9 },
    frac: 0.34, move: { k: 'orbit', deg: 9, dur: 9 },
    cuts: [{ t: 3.4, setup: 'CV-OBJ', sub: { m: [713, 527], h: 0.9, y: 0.95 }, frac: 0.34,
      move: { k: 'push', cms: 5 },
      why: 'the lots themselves, in the hands — the insert the passage names and never showed' }] },
  /* THE SUBJECT IS THE GAP THE FLOCK COMES THROUGH, NOT THE WHOLE ARCH. Asked
     for a 4.4 m subject at a third of frame height the framing law wanted the
     lens twenty-one metres back — outside the cave — so the solver shrank to
     the one arc the volume allows and landed on top of the shot before it. */
  'ody-iii-06-return': { setup: 'CV-DOOR', cls: 'NARRATION', sub: { m: [420, 434], h: 2.6, y: 1.3 },
    fov: 30, frac: 0.60, move: { k: 'push', cms: 4.0 }, read: { fill: 1.8, rim: 1.8 },
    cuts: [{ t: 3.4, setup: 'CV-STONE', cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 },
      frac: 0.55, move: { k: 'push', cms: 6 },
      why: 'and the stone comes back across it — the ominous sealing the scene was missing' }] },
  'ody-iii-07-suppertwo': { setup: 'CV-FIRE', cls: 'ACTION', sub: { a: 'poly-seat' },
    frac: 0.62, move: { k: 'handheld', amp: 0.010, dur: 6 },
    cuts: [{ t: 2.6, setup: 'CV-MEN', sub: { a: 'ulysses' }, frac: 0.46,
      move: { k: 'handheld', amp: 0.012, dur: 5 },
      why: 'the terrified men — third meal, and the reader is watching them, not it' }] },
  'ody-iii-08-lookhere': { setup: 'CV-BOWL', cls: 'GATE', sub: { p: 'bowl', h: 0.75 },
    over: 'ulysses', rack: { from: 'p:bowl', to: 'h:POLYPHEMUS', at: 2.6, dur: 1.0 },
    move: { k: 'push', cms: 4.0 },
    cuts: [{ t: 3.6, setup: 'CV-POUR', cls: 'ACTION', sub: { p: 'bowl', h: 0.75 }, frac: 0.42,
      move: { k: 'push', cms: 5 }, why: 'the first pour' }] },
  'ody-iii-09-besokind': { setup: 'CV-GIANT-W', cls: 'GIANT', sub: { a: 'poly-seat' },
    fov: 48, frac: 0.72, comp: [0.10, 0.02], move: { k: 'push', cms: 3.4 }, dof: { f: 2.5 },
    cuts: [{ t: 2.8, setup: 'CV-OBJ', cls: 'ACTION', sub: { p: 'bowl', h: 0.75 }, frac: 0.34,
      move: { k: 'push', cms: 5 }, why: 'the bowl he has already drained — the second state' }] },
  /* THREE POURS, THREE DRAINS (Sol III #4). The A-B-A is kept and the third
     fill is played inside the unit that says "three times did I fill it". */
  'ody-iii-10-thrice': { setup: 'CV-BOWL', cls: 'ACTION', sub: { p: 'bowl', h: 0.75 },
    over: 'ulysses', rack: { from: 'h:POLYPHEMUS', to: 'p:bowl', at: 1.6, dur: 0.9 },
    move: { k: 'push', cms: 3.0 },
    cuts: [
      { t: 2.0, setup: 'CV-POUR', sub: { p: 'bowl', h: 0.75 }, frac: 0.46,
        move: { k: 'push', cms: 5 }, why: 'the third pour' },
      { t: 3.8, setup: 'CV-OBJ', sub: { p: 'bowl', h: 0.75 }, frac: 0.36,
        move: { k: 'push', cms: 4 }, why: 'and the third empty bowl' }] },
  /* THE EXCHANGE ON ONE AXIS (Sol III #3): the man closer and screen-left,
     the giant's answer closer and lower and screen-right, and one two-shot in
     between as geographic insurance. */
  'ody-iii-11-noman': { setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' },
    over: 'poly-seat', fov: 22, frac: 0.74, move: { k: 'push', cms: 2.2 }, dof: { f: 2.0 },
    cuts: [{ t: 3.8, setup: 'CV-GIANT-E', cls: 'GIANT', sub: { a: 'poly-seat' }, frac: 0.60,
      fg: 'ulysses', move: { k: 'push', cms: 3.0 },
      why: 'both of them in one frame, on the axis, so the reverses cannot drift' }] },
  'ody-iii-12-nomanlast': { setup: 'CV-GIANT-W', cls: 'GIANT', sub: { a: 'poly-seat' },
    camY: 1.22, fov: 42, frac: 0.80, comp: [0.12, 0.02], move: { k: 'push', cms: 3.0 },
    dof: { f: 2.5 } },
  'ody-iii-13-neck': { setup: 'CV-COLLAPSE', cls: 'ACTION', sub: { a: 'poly-seat' }, frac: 0.38,
    move: { k: 'crane', dy: 1.5, dz: 0.5, dur: 5 }, read: { fill: 4.6, rim: 3.6 },
    cuts: [{ t: 1.8, setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' }, fov: 28, frac: 0.62,
      move: { k: 'push', cms: 2.4 }, read: { fill: 4.2, rim: 3.4 },
      why: 'and the face that has been waiting all night for exactly this' }] },

  /* ---------------- BEAT IV · THE STAKE — cave ----------------
     COVERAGE: EST4 · OBJ · FIVEFACES · AUGER · GIANT-W · BLIND · DARK · DOOR ·
     GIANT-E · DOOR · DOOR(hold) · GROPE · SEATED. The blinding is cut on the
     lens's own law — the faces that see it arrive before the weapon does — and
     the neighbours' scene is a three-cornered exchange across a shut stone. */
  'ody-iv-00-head': { setup: 'CV-EST4', cls: 'WIDE', sub: { m: [676, 474], h: 3.0, y: 1.65 },
    move: { k: 'push', cms: 7 } },
  'ody-iv-01-embers': { setup: 'CV-OBJ', cls: 'GATE', sub: { p: 'fire', h: 1.5 },
    fov: 32, frac: 0.34, comp: [-0.10, 0.00], move: { k: 'push', cms: 5.0 }, dof: { f: 2.5 },
    cuts: [{ t: 1.8, setup: 'CV-POINT', sub: { p: 'fire', h: 1.3 }, frac: 0.40,
      move: { k: 'push', cms: 6 }, read: { fill: 2.2, rim: 2.8 },
      why: 'the beam\'s end in the coals, changing state under the reader\'s own hold' }] },
  /* PHOTOGRAPHED, NOT ASSUMED. CV-FIVEFACES was written for this line and the
     frame it actually delivers here is two dark legs across the foreground —
     the staging at `glowing` puts bodies between the low lamp angle and the
     faces it is named after. The men's own reaction angle holds them, and the
     insert goes on the one station in the room that can see into the coals. */
  'ody-iv-02-glowing': { setup: 'CV-MEN', cls: 'ACTION', sub: { a: 'crew-0' },
    frac: 0.84, move: { k: 'push', cms: 4.0 }, read: { fill: 2.6, rim: 2.8 }, sepDeg: 0 },
  /* NO CUT LIST. The glowing point is shown at `embers`, on the one station in
     the room that can see into the coals; a second take of it a unit later
     photographs a black box, and a shot the reader cannot see is not a shot.
     The cut list is a tool, not a quota. */
  /* THE BLINDING IS FIVE SHOTS OF ACCELERATING PHYSICAL FACT, and round 1
     gave the decisive one 0.58 seconds because the beat clock had already run
     on without it. The clock offsets in emit_units_ody.py are amended so each
     leaf owns real screen time, and each leaf now carries its own cut. */
  'ody-iv-03-auger': { setup: 'CV-AUGER', cls: 'CLOCK', sub: { p: 'stake', h: 1.1 }, frac: 0.30,
    rack: { from: 'p:stake', to: 'h:POLYPHEMUS', at: 0.12, dur: 0.30 },
    move: { k: 'handheld', amp: 0.020, dur: 9, at: 0.30, pre: 0.16, decay: 1.1 },
    read: { fill: 1.15, rim: 1.25 },
    cuts: [{ t: 1.5, setup: 'CV-GIANT-W', sub: { a: 'poly-idle' }, fov: 44, frac: 0.86,
      comp: [0.10, -0.02], dof: { f: 2.5 }, read: { fill: 4.4, rim: 3.4 }, sepDeg: 0,
      move: { k: 'handheld', amp: 0.022, dur: 6, at: 0.2, pre: 0.2, decay: 1.0 },
      why: 'the eye it is going into — one travel direction, kept across every cut' }] },
  'ody-iv-04-bore': { setup: 'CV-HANDS', cls: 'CLOCK', sub: { p: 'stake', h: 1.1 }, frac: 0.42,
    move: { k: 'handheld', amp: 0.020, dur: 6 }, read: { fill: 1.15, rim: 1.25 },
    cuts: [{ t: 1.6, setup: 'CV-GIANT-W', sub: { a: 'poly-seat' }, fov: 48, frac: 0.62,
      comp: [0.10, -0.02], move: { k: 'handheld', amp: 0.022, dur: 6 }, dof: { f: 2.5 },
      why: 'the twisting hands, then what the twisting is doing to him' }] },
  'ody-iv-05-hiss': { setup: 'CV-BLIND', cls: 'CLOCK', sub: { a: 'poly-seat' }, frac: 0.86,
    comp: [0.11, 0.10],
    move: { k: 'handheld', amp: 0.040, dur: 11, at: 1.15, pre: 0.14, decay: 3.0 },
    blinding: true, read: { fill: 1.2, rim: 1.3 } },
  'ody-iv-06-fright': { setup: 'CV-FIVEFACES', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.34,
    move: { k: 'handheld', amp: 0.012, dur: 7 },
    cuts: [{ t: 1.4, setup: 'CV-STONE', sub: { m: [352, 430], h: 4.6, y: 2.2 }, frac: 0.46,
      move: { k: 'handheld', amp: 0.014, dur: 5 },
      why: 'and where running away actually gets them: a shut stone' }] },
  /* THE NEIGHBOURS ARE A TRIANGLE WITH ONE CORNER OFF-STAGE (Sol IV #2). The
     exterior cannot be shot — the reader is inside — so the third corner is
     the SEAM: lamplight moving in the cracks of the stone they are behind. */
  'ody-iv-07-whatails': { setup: 'CV-DOOR', cls: 'DIALOGUE', sub: { m: [352, 424], h: 3.2, y: 1.9 },
    fov: 28, frac: 0.46, comp: [-0.16, 0.02], move: { k: 'push', cms: 2.6 },
    dof: { f: 2.8 }, offstage: true,
    cuts: [{ t: 3.8, setup: 'CV-SEAM', sub: { m: [352, 424], h: 3.2, y: 1.9 }, frac: 0.40,
      move: { k: 'push', cms: 2.4 }, offstage: true,
      why: 'the only way the neighbours exist on screen: lamps crossing the cracks' }] },
  'ody-iv-08-nomankilling': { setup: 'CV-GIANT-E', cls: 'GIANT', sub: { a: 'poly-seat' },
    frac: 0.60, comp: [0.12, -0.04], move: { k: 'push', cms: 4.0 }, dof: { f: 2.5 },
    cuts: [{ t: 1.8, setup: 'CV-FIVEFACES', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.36,
      move: { k: 'push', cms: 3.0 },
      why: 'the silent reaction of the men who hear the joke land' }] },
  'ody-iv-09-mustbeill': { setup: 'CV-DOOR', cls: 'DIALOGUE', sub: { m: [352, 424], h: 3.2, y: 1.9 },
    fov: 28, frac: 0.46, comp: [-0.16, 0.02], move: { k: 'push', cms: 2.6 },
    dof: { f: 2.8 }, offstage: true },
  'ody-iv-10-wentaway': { setup: 'CV-DOOR', holdOf: 'ody-iv-09-mustbeill',
    hold: 'the lamps recede past the very seams the men have not stopped staring at — a cut here would take away the thing that is going away' },
  /* THE DOORWAY ACTION, COVERED (Sol IV #4): hand finds stone, boulder shifts,
     night slit widens. */
  'ody-iv-11-stone': { setup: 'CV-STONE', cls: 'ACTION', sub: { m: [352, 430], h: 4.6, y: 2.2 },
    frac: 0.52, move: { k: 'push', cms: 8 }, read: { fill: 1.8, rim: 1.8 },
    cuts: [
      { t: 2.0, setup: 'CV-GIANT-W', sub: { a: 'poly-seat' }, fov: 34, frac: 0.46,
        comp: [0.09, 0.02], move: { k: 'push', cms: 10 }, dof: { f: 4 },
        read: { fill: 1.8, rim: 1.8 }, liveAnchor: true,
        why: 'the boulder comes away in his hands' },
      { t: 3.8, setup: 'CV-DAWNMOUTH', sub: { m: [420, 420], h: 4.4, y: 2.2 }, frac: 0.44,
        move: { k: 'push', cms: 5 },
        why: 'and the night opens a slit exactly the width of a man' }] },
  'ody-iv-12-doorway': { setup: 'CV-SEATED', cls: 'GIANT', sub: { a: 'poly-idle' },
    move: { k: 'push', cms: 3.2 }, liveAnchor: true,
    cuts: [
      { t: 2.4, setup: 'CV-FIVEFACES', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.36,
        move: { k: 'push', cms: 3.0 },
        why: 'the captives doing the arithmetic of a doorway with a giant in it' },
      { t: 4.0, setup: 'CV-SEATED', cls: 'GIANT', sub: { a: 'poly-idle' }, fov: 46,
        comp: [0.10, -0.02], move: { k: 'push', cms: 2.0 }, liveAnchor: true,
        why: 'and back to the geometry: the beat ends on the shape of the problem, wider than it began' }] },

  /* ---------------- BEAT V · UNDER THE RAMS — cave ----------------
     COVERAGE: EST5 · ULY · WITHIES · UNDER · RAM · DAWNMOUTH · HANDPASS ·
     BELLY · RAMSPEECH · TWOSHOT · RAMSPEECH · OUT · RUN. Round 2 played all
     three ram-speech units from one station; the speech is now a real
     two-hander — his blind face, the wool with a man in it, his blind face. */
  'ody-v-00-head': { setup: 'CV-EST5', cls: 'WIDE', sub: { m: [348, 332], h: 9.0, y: 2.6 },
    move: { k: 'crane', dy: 1.1, dz: 0.8, dur: 8 } },
  'ody-v-01-puzzling': { setup: 'CV-ULY', cls: 'DIALOGUE', sub: { a: 'ulysses' },
    fov: 27, frac: 0.58, move: { k: 'push', cms: 2.8 }, dof: { f: 2.5 },
    cuts: [{ t: 3.8, setup: 'CV-HANDPASS', cls: 'ACTION', sub: { m: [900, 466], h: 1.6, y: 0.8 },
      fov: 38, frac: 0.40, comp: [-0.12, 0.02], move: { k: 'push', cms: 4 }, dof: { f: 2.5 },
      why: 'what a man planning an escape is actually looking at' }] },
  'ody-v-02-withies': { setup: 'CV-WITHIES', cls: 'ACTION', sub: { m: [900, 466], h: 1.6, y: 0.8 },
    frac: 0.42, move: { k: 'push', cms: 5.0 },
    cuts: [{ t: 3.8, setup: 'CV-WOOL', sub: { m: [900, 466], h: 1.2, y: 0.6 }, frac: 0.44,
      move: { k: 'push', cms: 5 },
      why: 'the lashing from under the flank — the suspense insert the scene never had' }] },
  'ody-v-03-threetoaman': { setup: 'CV-HANDPASS', cls: 'ACTION', sub: { m: [900, 466], h: 1.6, y: 0.8 },
    fov: 34, frac: 0.46, comp: [-0.12, 0.02], move: { k: 'track', m: 0.8, dur: 8 },
    dof: { f: 2.5 },
    cuts: [{ t: 2.8, setup: 'CV-BELLY', sub: { a: 'ewe-1' }, fov: 44, frac: 0.34,
      move: { k: 'push', cms: 5 }, read: { fill: 2.4, rim: 2.2 },
      why: 'and the geometry from underneath: exactly where the man will be' }] },
  'ody-v-04-greatram': { setup: 'CV-WITHIES', cls: 'GATE', sub: { t: 'ram-great', h: 1.15 },
    fov: 30, frac: 0.34, comp: [-0.15, 0.03], move: { k: 'push', cms: 5.0 } },
  'ody-v-05-dawn': { setup: 'CV-DAWNMOUTH', cls: 'ACTION', sub: { m: [520, 440], h: 4.4, y: 1.5 },
    into: 'dissolve', move: { k: 'crane', dy: 1.0, dz: 0.4, dur: 9 },
    cuts: [{ t: 4.0, setup: 'CV-GATEWAY', sub: { a: 'poly-seat' }, frac: 0.44,
      move: { k: 'push', cms: 4 },
      why: 'the geographic master this scene never had: him, the gate, and the way the flock will go' }] },
  /* THE NEAR-CAPTURE (Sol V #2). Hand on the wool, the eye under it tracking
     that hand, and the blind face that very nearly notices. */
  'ody-v-06-feltbacks': { setup: 'CV-HANDPASS', cls: 'GIANT', sub: { a: 'poly-idle' },
    frac: 0.82, move: { k: 'push', cms: 3.6 }, read: { fill: 1.8, rim: 5.4 },
    cuts: [
      { t: 2.6, setup: 'CV-BELLY', cls: 'ACTION', sub: { a: 'ram-great' }, frac: 0.55,
        move: { k: 'push', cms: 5 }, read: { fill: 2.4, rim: 2.2 },
        why: 'the hidden eye, tracking the palm crossing above it' },
      { t: 4.4, setup: 'CV-RAMSPEECH', sub: { a: 'poly-idle' }, frac: 0.46,
        move: { k: 'push', cms: 3.0 },
        why: 'and the blind face that very nearly notices' }] },
  /* ORDERED FOR THE PREFIX LAW: `feltbacks` may still be sitting on CV-BELLY
     when the reader turns the page, so this unit cannot OPEN on it. The fists
     come first and the POV under the belly is the payoff — which is the better
     order anyway: the grip, then what the grip is holding up. */
  'ody-v-07-lastofall': { setup: 'CV-WOOL', cls: 'ACTION', sub: { a: 'ram-great' }, frac: 0.68,
    move: { k: 'push', cms: 4.0 },
    cuts: [{ t: 2.6, setup: 'CV-BELLY', sub: { a: 'ram-great' }, frac: 0.60,
      rack: { from: 'a:poly-seat', to: 'a:ram-great', at: 0.9, dur: 0.9 },
      move: { k: 'push', cms: 5.0 }, read: { fill: 2.4, rim: 2.2 },
      why: 'and under the belly with him: the ram going out heavy with a man' }] },
  'ody-v-08-ramspeech1': { setup: 'CV-RAMSPEECH', cls: 'GIANT', sub: { a: 'poly-idle' },
    frac: 0.50, move: { k: 'push', cms: 3.0 } },
  /* THE TWO-SHOT IS A DIFFERENT LENS AS WELL AS A DIFFERENT PLACE. Round 1's
     lesson repeated itself here the moment the chain changed: at 46 deg the
     solver put this station within a degree of the ram-speech single, and a
     gate that reads the label would have passed it. A profile two-shot wants
     wide glass anyway — it has to hold a face and a fist a metre apart. */
  'ody-v-09-ramspeech2': { setup: 'CV-TWOSHOT', cls: 'GIANT', sub: { a: 'poly-idle' },
    camY: 1.10, fov: 56, frac: 0.74, move: { k: 'push', cms: 2.8 },
    cuts: [{ t: 2.6, setup: 'CV-BELLY', cls: 'ACTION', sub: { a: 'ram-great' }, frac: 0.90,
      move: { k: 'push', cms: 4 }, read: { fill: 3.0, rim: 5.4 },
      why: 'an arm\'s length under the hand that is stroking him, while he is asked where he is' }] },
  'ody-v-10-ramspeech3': { setup: 'CV-RAMSPEECH', cls: 'GIANT', sub: { a: 'poly-idle' },
    fov: 48, frac: 0.52, comp: [0.10, 0.01], move: { k: 'push', cms: 2.6 }, dof: { f: 2.5 } },
  'ody-v-11-freed': { setup: 'CV-OUT', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.44,
    move: { k: 'track', m: 0.9, dur: 8 },
    cuts: [{ t: 3.0, setup: 'CV-GATEWAY', sub: { a: 'poly-seat' }, frac: 0.42,
      move: { k: 'push', cms: 4 },
      why: 'the men clear the danger line and he does not know — consequence, not stopping' }] },
  'ody-v-12-aboard': { setup: 'CV-DAWNMOUTH', cls: 'NARRATION', sub: { m: [370, 452], h: 3.4, y: 1.6 },
    fov: 40, dist: 9.5, comp: [-0.12, 0.03], move: { k: 'push', cms: 4.0 }, dof: { f: 4 },
    cuts: [{ t: 3.4, setup: 'CV-AFTER', sub: { m: [700, 470], h: 3.0, y: 1.3 }, frac: 0.30,
      move: { k: 'push', cms: 4 },
      why: 'and one breath on the emptied room they got out of' }] },

  /* ---------------- BEAT VI · THE TAUNT — sea ----------------
     COVERAGE: EST · STERN · ROCK · DECK · MEN · EST · STERN · CLIFF · HAND ·
     STERN · CLIFF · ROCK · ALTAR · OFF. The two-plane master returns for the
     second gate, so the reader's defiance is committed in the same frame that
     holds the men who are begging him not to. */
  'ody-vi-01-jeer': { setup: 'SEA-EST', cls: 'GATE', sub: { t: 'cyclops', h: 6.4 }, frac: 0.30,
    move: { k: 'push', cms: 16 } },
  /* THE AXIS GETS ITS OTHER HALF (Sol VI #1): "there is no shared giant/boat
     composition or matched high/low POV defining the conversation axis." The
     master declares it; SEA-DOWN answers it from the headland, every time the
     scene needs to remember how small the mouth doing the shouting is. */
  'ody-vi-02-taunt': { setup: 'SEA-STERN', cls: 'DIALOGUE', sub: { a: 'ulysses' }, frac: 0.50,
    move: { k: 'push', cms: 2.8 },
    cuts: [{ t: 3.0, setup: 'SEA-DOWN', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.24,
      move: { k: 'push', cms: 8 },
      why: 'the matched reverse: the boat as the thing on the cliff sees it' }] },
  /* THE THROW, RECONSTRUCTED (Sol VI #2): hand grips rock, crew notices,
     release and trajectory, boat reaction — and the cut lands ON the throw
     rather than after it has disappeared. Four shots in one clock leaf, which
     is only possible because the cut no longer waits for a page turn. */
  'ody-vi-03-rock1': { setup: 'SEA-GRIP', cls: 'CLOCK', sub: { a: 'poly-idle' }, frac: 0.70,
    move: { k: 'push', cms: 12 },
    cuts: [
      { t: 1.4, setup: 'SEA-MEN', cls: 'ACTION', sub: { a: 'crew-0' }, frac: 0.52,
        move: { k: 'push', cms: 4 }, why: 'the crew see it leave his hands' },
      { t: 2.8, setup: 'SEA-ROCK', sub: { m: [520, 470], h: 6.0, y: 1.4 },
        move: { k: 'whip', toPx: [468, 505], toY: 1.2, at: 0.5, dur: 4.4, rise: 2.0 },
        why: 'the eye rides the arc and the splash takes it' },
      { t: 5.0, setup: 'SEA-DECK', cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 },
        frac: 0.46, move: { k: 'push', cms: 10 },
        why: 'and the boat is thrown — the physical consequence, on the same breath' }] },
  'ody-vi-04-twiceasfar': { setup: 'SEA-OAR', cls: 'ACTION', sub: { a: 'crew-1' }, frac: 0.42,
    move: { k: 'push', cms: 6 },
    cuts: [{ t: 3.0, setup: 'SEA-DECK', sub: { m: [575, 450], h: 4.2, y: 1.6 }, frac: 0.42,
      move: { k: 'push', cms: 8 },
      why: 'the oar bites, then the deck it is pulling — twice as far, and rowing for it' }] },
  'ody-vi-05-menbeg': { setup: 'SEA-MEN', cls: 'DIALOGUE', sub: { a: 'crew-0' }, frac: 0.58,
    move: { k: 'push', cms: 2.6 },
    cuts: [{ t: 4.0, setup: 'SEA-STERN', sub: { a: 'ulysses' }, fov: 28, frac: 0.54,
      comp: [0.28, 0.04], move: { k: 'push', cms: 2.4 },
      why: 'and the face they are begging, with the confidence starting to crack' }] },
  'ody-vi-06-defy': { setup: 'SEA-EST', cls: 'GATE', sub: { t: 'cyclops', h: 6.4 }, fov: 20,
    frac: 0.32, comp: [0.15, -0.08], move: { k: 'push', cms: 14 },
    reprise: 'the second gate is the master returning on purpose: the reader must commit the hubris inside the very frame that still holds the men begging him not to' },
  'ody-vi-07-myname': { setup: 'SEA-STERN', cls: 'DIALOGUE', sub: { a: 'ulysses' }, fov: 24,
    frac: 0.66, comp: [0.17, 0.05], move: { k: 'push', cms: 2.4 }, dof: { f: 2.0 },
    cuts: [{ t: 3.2, setup: 'SEA-DOWN', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.22,
      move: { k: 'push', cms: 9 },
      why: 'a name shouted at a mountain, seen from the mountain' }] },
  'ody-vi-08-prophecy': { setup: 'SEA-CLIFF', cls: 'GIANT', sub: { a: 'poly-idle' }, frac: 0.52,
    move: { k: 'push', cms: 5.5 },
    cuts: [{ t: 4.0, setup: 'SEA-MEN', cls: 'ACTION', sub: { a: 'crew-0' }, frac: 0.50,
      move: { k: 'push', cms: 3.0 },
      why: 'the men doing the arithmetic of a prophecy — and it breaks the two giant shots apart' }] },
  'ody-vi-09-fatherson': { setup: 'SEA-HAND', cls: 'GIANT', sub: { a: 'poly-idle' }, frac: 0.58,
    move: { k: 'push', cms: 5.0 },
    cuts: [{ t: 4.2, setup: 'SEA-DECK', cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 },
      frac: 0.44, move: { k: 'push', cms: 6 },
      why: 'the deck, while he wheedles — nobody on it is moving toward him' }] },
  'ody-vi-10-hades': { setup: 'SEA-STERN', cls: 'DIALOGUE', sub: { a: 'ulysses' }, fov: 25,
    frac: 0.62, comp: [0.17, 0.05], move: { k: 'push', cms: 2.6 }, dof: { f: 2.2 } },
  'ody-vi-11-curse': { setup: 'SEA-CLIFF', cls: 'GIANT', sub: { a: 'poly-idle' }, fov: 15,
    frac: 0.62, comp: [0.12, -0.05], move: { k: 'push', cms: 4.5 },
    cuts: [{ t: 4.0, setup: 'SEA-DOWN', cls: 'ACTION', sub: { a: 'ulysses' }, frac: 0.20,
      move: { k: 'push', cms: 7 },
      why: 'the curse lands on a boat too far off to hear it — which is the whole tragedy' }] },
  'ody-vi-12-heard': { setup: 'SEA-ROCK', cls: 'CLOCK', sub: { m: [540, 468], h: 6.0, y: 1.4 },
    dist: 24, camY: 3.2, move: { k: 'whip', toPx: [455, 540], toY: 1.2, at: 0.45, dur: 4, rise: 1.8 },
    cuts: [{ t: 1.2, setup: 'SEA-DECK', cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 },
      frac: 0.44, move: { k: 'push', cms: 12 },
      why: 'the wave takes them on — cut on the throw, not after it has vanished' }] },
  'ody-vi-13-ram': { setup: 'SEA-ALTAR', cls: 'ACTION', sub: { m: [575, 450], h: 4.2, y: 1.6 },
    frac: 0.40, move: { k: 'push', cms: 9 }, follow: true,
    cuts: [{ t: 4.0, setup: 'SEA-MEN', sub: { a: 'crew-0' }, frac: 0.48,
      move: { k: 'push', cms: 3.0 },
      why: 'the men at the sacrifice, and the sky that gives them no sign' }] },
  'ody-vi-14-sailedon': { setup: 'SEA-OFF', cls: 'WIDE', sub: { m: [205, 489], h: 8.0, y: 2.6 },
    into: 'dissolve', move: { k: 'crane', dy: 1.8, dz: 1.5, dur: 10 }, follow: true },
};

/* THE MERGE. A row is a TAKE of its setup: the setup's geometry first, the
   row's own decisions over it. A `holdOf` row is not a take at all — it is the
   held row still running, so it inherits that row outright and may differ only
   in the class it is read under. */
function resolveSpec(id, spec, resolved) {
  if (!spec) return null;
  const base = SETUPS[spec.setup];
  if (!base) throw new Error(`${id}: unknown setup ${spec.setup}`);
  if (spec.holdOf) {
    const held = resolved[spec.holdOf];
    if (!held) throw new Error(`${id}: holdOf ${spec.holdOf} is not resolved yet`);
    const { setup, holdOf, hold, cls, ...rest } = spec;
    return { ...held, setup, holdOf, hold, ...(cls ? { cls } : {}), ...rest,
             __held: true };
  }
  const { setup, ...row } = spec;
  const out = { ...base, ...row, setup };
  /* the dof block merges rather than replaces: a take may change the stop
     without re-declaring the near-field softening the setup signed off */
  if (base.dof || row.dof) out.dof = { ...(base.dof || {}), ...(row.dof || {}) };
  /* a setup's own `name`/`role`/`note` are documentation, never geometry */
  delete out.name; delete out.role; delete out.note;
  return out;
}

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
  /* ================= THE 30-DEGREE RULE, SOLVED ================= *
   * A declared setup is a promise about an ANGLE, and a search wide enough to
   * get round the furniture is wide enough to break that promise: Beat II's
   * two answering giant angles both swung west and landed 23 cm apart, and the
   * three ram-speech units came back within one degree of each other — the
   * very defect the round was called to fix, hiding behind a correct label.
   * So the separation is a CONSTRAINT the solver has to satisfy, not a number
   * the table reports afterwards. A candidate station is rejected when it sits
   * inside `sepDeg` of the previous shot's bearing on the same subject; if the
   * room genuinely has nowhere else to stand, the search runs again without it
   * and the row says so out loud. */
  const AV = spec.__prevPos;
  const sepDeg = spec.__sepDeg === undefined ? 26 : spec.__sepDeg;
  const sepOk = (p) => {
    if (!AV || spec.__sepOff) return true;
    const a1 = Math.atan2(AV[0] - A.x, AV[2] - A.z) / D2R;
    const a2 = Math.atan2(p.x - A.x, p.z - A.z) / D2R;
    let dd = Math.abs(a1 - a2) % 360;
    if (dd > 180) dd = 360 - dd;
    return dd >= sepDeg;
  };
  const ok = (p) => {
    if (!legal(p)) return false;
    if (!sepOk(p)) return false;
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
  const search = () => {
    for (const phase of phases) {
      for (const shrink of [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45]) {
        const got = placeAt(want * shrink, phase);
        if (!got) continue;
        return { got, why: (got.da === 0 && shrink === 1 && phase === 1) ? 'hint'
          : `${phase === 2 ? 'UPSTAGE ' : ''}swung ${got.da.toFixed(0)}deg x${shrink}` };
      }
    }
    return null;
  };
  let found = search();
  if (!found && AV && !spec.__sepOff) {
    /* the room has nowhere else to stand — take the near angle and declare it */
    spec.__sepOff = true;
    spec.__sepLost = true;
    found = search();
  }
  if (found) { best = found.got; why = found.why + (spec.__sepLost ? ' + NO SEPARATION LEFT' : ''); }
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
  words: String(u.text || '').trim().split(/\s+/).filter(Boolean).length,
}));

/* ====================================================================== *
 * THE READING CLOCK, MODELLED — and the reason it is in the BAKE.
 *
 * The cut list has to be designed against something. A shot scheduled five
 * seconds into a unit a reader leaves after three is not a shot: it is a line
 * of JSON nobody will ever see. So the bake carries the same model of a
 * reader the judgment recorder plays at — a line takes the time its WORDS
 * take, not a fixed six-nine seconds — and warns when a cut list overruns it.
 *
 * This is a DESIGN CONSTRAINT, not a coupling: nothing at runtime reads these
 * numbers, and a reader who lingers or races still gets whatever of the list
 * their own dwell reaches. It is the difference between an editor who knows
 * how long the reel is and one who does not.
 * ====================================================================== */
export const READ_RATE = 7.0;          /* words a second — a carried skim-read */
export const READ_BASE = 0.9;
export const READ_MIN = 2.2, READ_MAX = 7.0, READ_GATE_MIN = 5.4;
/* the four leaves the BEAT CLOCK owns are not read at all — their length is
   the clock's, measured off the amended offsets in emit_units_ody.py */
const CLOCK_DWELL = {
  'ody-iv-03-auger': 3.0, 'ody-iv-04-bore': 3.1, 'ody-iv-05-hiss': 2.8,
  'ody-iv-06-fright': 2.2, 'ody-vi-03-rock1': 6.0, 'ody-vi-12-heard': 2.2,
};
const READ_DWELL = {};
for (const u of units) {
  const d = READ_BASE + u.words / READ_RATE;
  const gate = u.verb === 'target' || u.verb === 'hold' || u.verb === 'release';
  const auto = UNITS_MOD.UNITS.find((x) => x.id === u.id);
  READ_DWELL[u.id] = CLOCK_DWELL[u.id] !== undefined ? CLOCK_DWELL[u.id]
    : u.verb === 'auto' ? (auto && auto.dwell) || 3.4
    : Math.max(gate ? READ_GATE_MIN : READ_MIN, Math.min(READ_MAX, d));
}
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
const resolvedSpecs = {};

/* ====================================================================== *
 * THE SHOT BAKE, as a function — because a UNIT IS NO LONGER ONE SHOT.
 *
 * Round 1's table had exactly one station per unit, so the bake could be a
 * loop over units. Sol's round-1 verdict killed that shape: "fourteen scene
 * shots ... almost exactly 6.96 seconds each — that is reading cadence
 * imposed on picture." A unit is a slot of the READER's time; the film's cut
 * has to be free of it. So a SPEC row may carry `cuts: [{t, ...}]` and every
 * entry is baked through this same function, against the same marks, the
 * same proscenium law and the same 26-degree separation constraint as any
 * other shot. The only thing a sub-shot has that a unit's opening shot does
 * not is a `t` — the offset, in the unit's own seconds, at which it cuts.
 * ====================================================================== */
function bakeShot(id, spec, u, prevShot) {
  const w = FRAME[u.set];
  const boxes = Object.fromEntries(Object.entries(OBSTACLES[u.set])
    .map(([k, b]) => [k, boxWorld(w, b)]));
  const bodies = (MARKS.units[u.id] || {}).bodies || null;
  if (!bodies) warn.push(`${u.id}: no measured staging — re-run shots3d_marks.mjs`);

  spec.__set = u.set;
  /* the shot this one cuts FROM, so the solver can be made to stand somewhere
     else; a hold is the same shot still running and is exempt by definition.
     THE CHAIN RUNS THROUGH THE CUT LIST: a unit's opening shot answers the
     LAST shot of the unit before it, not that unit's opening shot. */
  if (!spec.hold && prevShot) {
    spec.__prevPos = prevShot.pos;
    spec.__prevFrac = prevShot.frame.frac;
    if (spec.sepDeg !== undefined) spec.__sepDeg = spec.sepDeg;
  }
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

  return {
    unit: u.id, beat: u.beat, set: u.set, class: spec.cls,
    /* THE CUT PATTERN, carried by the row the runtime reads. `setup` is the
       angle on the action; a unit advance that changes it is a CUT, one that
       does not is a HOLD and must say why. `transition` is how the cut is
       played — a straight cut everywhere except the five time ellipses the
       lens allows a dissolve for. */
    setup: spec.setup,
    setupName: (SETUPS[spec.setup] || {}).name || null,
    setupRole: (SETUPS[spec.setup] || {}).role || null,
    transition: spec.hold ? 'hold' : (spec.into === 'dissolve' ? 'dissolve' : 'cut'),
    hold: spec.hold || null,
    reprise: spec.reprise || null,
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
      sepLost: !!spec.__sepLost,
    },
  };
}

/* ---- the walk over the contract: one opening shot per unit, then its list ---- */
let prevInBeat = null;
for (const u of units) {
  const spec = resolveSpec(u.id, SPEC[u.id], resolvedSpecs);
  if (!spec) { warn.push(`${u.id}: NO SPEC`); continue; }
  resolvedSpecs[u.id] = spec;
  const chainFrom = (!spec.hold && prevInBeat && prevInBeat.beat === u.beat) ? prevInBeat : null;
  const row = bakeShot(u.id, spec, u, chainFrom);
  rows[u.id] = row;
  if (!spec.hold) prevInBeat = row;

  /* THE CUT LIST. Every entry is a whole shot; `t` is when it cuts, measured
     in the unit's own seconds from the unit's cut. A held row may not carry
     one — a hold is the same shot still running, and a shot that cuts away
     inside it was never a hold. */
  const list = (SPEC[u.id] || {}).cuts;
  if (list && list.length) {
    if (spec.hold) warn.push(`${u.id}: a HELD row may not carry a cut list`);
    const baked = [];
    let prev = row, tPrev = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const sid = `${u.id}#${i + 1}`;
      if (!(c.t > 0.3)) warn.push(`${sid}: a sub-cut must land after the unit's own first frame (t ${c.t})`);
      if (!(c.t > tPrev + 0.6)) warn.push(`${sid}: sub-cut at ${c.t}s crowds the shot before it (${tPrev}s)`);
      tPrev = c.t;
      const { t, why, ...rest } = c;
      const ss = resolveSpec(sid, { cls: spec.cls, sub: spec.sub, ...rest }, resolvedSpecs);
      const srow = bakeShot(sid, ss, u, prev);
      srow.t = t;
      srow.sub = i + 1;
      srow.why = why || null;
      srow.transition = 'cut';           /* only a page turn may dissolve */
      if (srow.class === 'WIDE') warn.push(`${sid}: a sub-cut may not be the beat's WIDE`);
      if (prev.setup === srow.setup)
        warn.push(`COVERAGE: ${sid} repeats ${prev.setup} — the angle must change on every cut`);
      baked.push(srow);
      prev = srow;
    }
    row.cuts = baked;
    prevInBeat = prev;
    /* THE CUT LIST IS DESIGNED AGAINST THE READING CLOCK, not welded to it: a
       shot the reader will never reach is a shot that does not exist. */
    const dwell = READ_DWELL[u.id];
    if (dwell !== undefined && tPrev > dwell - 0.5)
      warn.push(`${u.id}: the last sub-cut at ${tPrev}s falls outside a reader's ` +
        `${dwell.toFixed(1)}s on this unit — it would never play`);
  }
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

/* ====================================================================== *
 * THE COVERAGE LAW (the director's cut).
 *
 * A scene is an EDITED SEQUENCE, not a list of shots. The gate is the one an
 * editor would apply on the bench:
 *
 *   1. ANGLES CHANGE. No two consecutive units may sit on the same setup
 *      unless the row declares a hold reason — and a declared hold must be
 *      the SAME SHOT STILL RUNNING (same station, same lens), or it is not a
 *      hold, it is a jump cut wearing an excuse.
 *   2. ESTABLISH ONCE. A setup whose role is `establishing` is used exactly
 *      once in its scene. Re-establishing a changed world (a night that has
 *      become a morning) is a different setup with the role `reestablish`.
 *   3. THE VOCABULARY IS SMALL AND IT RECURS. A scene whose setups are all
 *      used once has no coverage — it has thirteen postcards. At least a
 *      third of the cuts in a scene must be a RETURN to a setup the reader
 *      has already been given.
 * ====================================================================== */
const BEATS = [1, 2, 3, 4, 5, 6];
/* which take of its setup this row is — the number an editor writes on a slate */
const takeOf = (list, i) =>
  list.slice(0, i + 1).filter((r) => r.setup === list[i].setup).length;
const sequences = [];
for (const b of BEATS) {
  /* THE SCENE IS A LIST OF SHOTS, NOT A LIST OF UNITS. Every unit contributes
     its opening shot and then whatever its cut list owes, in order — which is
     the sequence an editor would actually splice, and the sequence every
     coverage law below is measured on. */
  const list = [];
  for (const u of units) {
    if (u.beat !== b) continue;
    const r = rows[u.id];
    if (!r) continue;
    list.push(r);
    for (const c of r.cuts || []) list.push(c);
  }
  if (!list.length) continue;
  const seen = new Set();
  const cut = [];
  let cuts = 0, holds = 0, returns = 0, dissolves = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i], p = i ? list[i - 1] : null;
    const isReturn = seen.has(r.setup);
    if (p && r.setup === p.setup) {
      if (!r.hold) warn.push(`COVERAGE: ${r.unit} repeats ${p.unit}'s setup ${r.setup} ` +
        'with no declared hold — the angle must change between consecutive units');
      else {
        const dp = Math.hypot(r.pos[0] - p.pos[0], r.pos[1] - p.pos[1], r.pos[2] - p.pos[2]);
        if (dp > 0.35 || Math.abs(r.fov - p.fov) > 2)
          warn.push(`COVERAGE: ${r.unit} declares a HOLD but the camera moves ` +
            `${dp.toFixed(2)} m / ${Math.abs(r.fov - p.fov).toFixed(1)} deg — a hold is the same shot still running`);
        holds++;
      }
    } else if (p) { cuts++; if (isReturn) returns++; }
    if (r.transition === 'dissolve') dissolves++;
    /* THE ANGLE IS MEASURED, NOT DECLARED. A label that says the angle changed
       is worth nothing if the solver put both stations in the same place. */
    if (p && !r.hold) {
      const s0 = r.frame.anchor;
      const v1 = [p.pos[0] - s0[0], p.pos[2] - s0[2]];
      const v2 = [r.pos[0] - s0[0], r.pos[2] - s0[2]];
      const n1 = Math.hypot(v1[0], v1[1]) || 1, n2 = Math.hypot(v2[0], v2[1]) || 1;
      const deg = Math.acos(Math.max(-1, Math.min(1,
        (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))) / D2R;
      const dp = Math.hypot(r.pos[0] - p.pos[0], r.pos[1] - p.pos[1], r.pos[2] - p.pos[2]);
      const near = r.set === 'cave' ? 1.6 : 4.8;
      r.cutAngle = +deg.toFixed(1);
      r.cutMove = +dp.toFixed(2);
      if (dp < near && Math.abs(r.fov - p.fov) < 8 && deg < 22)
        warn.push(`COVERAGE: ${r.unit} is the SAME CAMERA as ${p.unit} — ` +
          `${deg.toFixed(0)} deg apart, ${dp.toFixed(2)} m, same lens`);
    }
    seen.add(r.setup);
    cut.push({ unit: r.unit, setup: r.setup, name: r.setupName, role: r.setupRole,
               cls: r.class, transition: r.transition, take: takeOf(list, i),
               size: r.frame.frac, angle: r.cutAngle === undefined ? null : r.cutAngle,
               ...(r.sub ? { sub: r.sub, at: r.t, why: r.why } : {}),
               ...(r.hold ? { hold: r.hold } : {}),
               ...(r.reprise ? { reprise: r.reprise } : {}) });
  }
    /* ================================================================== *
   * THE PREFIX LAW — round 2's own new failure mode, found on the lap.
   *
   * A cut list is spent in the READER's time, and a reader may turn the page
   * at any moment. So the shot the next unit OPENS on has to be legal against
   * every shot the unit before it could still be sitting on: its base and each
   * of its sub-cuts. Round 2's first green bake shipped `feltbacks` cutting
   * BELLY -> RAMSPEECH and `lastofall` opening on BELLY, and the lap — which
   * turned the page before the second sub-cut — played BELLY straight into
   * BELLY. The bake could not see it because the table's own order was legal.
   * ================================================================== */
  for (let i = 1; i < list.length; i++) {
    const r = list[i];
    if (r.sub || r.hold) continue;              /* a unit's OPENING shot only */
    let j = i - 1;
    while (j >= 0 && list[j].sub) j--;          /* back to that unit's base */
    for (let k = j; k < i; k++)
      if (list[k] && list[k].setup === r.setup)
        warn.push(`COVERAGE: ${r.unit} opens on ${r.setup}, which ${list[k].unit}` +
          `${list[k].sub ? '#' + list[k].sub : ''} may still be on when the reader ` +
          'turns the page — a cut list must leave EVERY prefix legal');
  }
  const est = [...seen].filter((s) => (SETUPS[s] || {}).role === 'establishing');
  for (const s of est) {
    const takes = list.filter((r) => r.setup === s);
    /* a master may come back exactly once, and only when the row says why:
       a reprise is a dramatic decision, not a tired operator */
    const excused = takes.filter((r) => r.reprise).length;
    if (takes.length - excused !== 1)
      warn.push(`COVERAGE: beat ${b} uses the establishing setup ${s} ${takes.length} times ` +
        `(${excused} declared reprise) — the budget is one`);
  }
  if (cuts && returns / cuts < 0.25)
    warn.push(`COVERAGE: beat ${b} returns to a known angle on only ${returns}/${cuts} cuts — ` +
      'a scene whose setups are all used once is a slideshow, not coverage');
  sequences.push({ beat: b, set: list[0].set, units: list.length,
    setups: [...seen].map((s) => ({ id: s, ...SETUPS[s] && { name: SETUPS[s].name,
      role: SETUPS[s].role, note: SETUPS[s].note, takes: list.filter((r) => r.setup === s).length } })),
    stats: { setups: seen.size, cuts, holds, returns, dissolves,
             shots: list.length, subCuts: list.filter((r) => r.sub).length,
             /* THE AVERAGE SHOT LENGTH the scene will actually play at: the
                modelled reader's seconds for the beat, divided by the number
                of SHOTS rather than the number of page turns. This is the one
                number Sol's whole verdict was about. */
             secs: +[...new Set(list.map((r) => r.unit))]
                    .reduce((n, id) => n + (READ_DWELL[id] || 0), 0).toFixed(1),
             asl: +([...new Set(list.map((r) => r.unit))]
                    .reduce((n, id) => n + (READ_DWELL[id] || 0), 0) / list.length).toFixed(2),
             cutsPerSetup: +(cuts / seen.size).toFixed(2) },
    cut });
}
const coverage = {
  law: 'a scene is an edited sequence: establish once, then alternate; the angle changes between consecutive units unless a hold is declared, and a hold is the same shot still running.',
  lens: 'spielberg',
  ok: !warn.some((x) => x.startsWith('COVERAGE:')),
  totals: {
    shots: sequences.reduce((n, s) => n + s.stats.shots, 0),
    subCuts: sequences.reduce((n, s) => n + s.stats.subCuts, 0),
    setups: sequences.reduce((n, s) => n + s.stats.setups, 0),
    cuts: sequences.reduce((n, s) => n + s.stats.cuts, 0),
    holds: sequences.reduce((n, s) => n + s.stats.holds, 0),
    returns: sequences.reduce((n, s) => n + s.stats.returns, 0),
    dissolves: sequences.reduce((n, s) => n + s.stats.dissolves, 0),
  },
};

/* THE SCREEN-DIRECTION LEDGER — every pinned row, and the side it is pinned
   to, so the walk's own [side] gate has something to check the live frame
   against instead of re-deriving the axis from scratch. */
const sides = {};
for (const [id, r] of Object.entries(rows)) if (r.frame.side) sides[id] = r.frame.side;

const out = {
  lane: 'cine-r3-directors-cut',
  lens: {
    id: 'spielberg',
    why: 'the only lens in the reference set whose editing default IS classical coverage — master + reverse + reaction + insert, cut on the reaction rather than the reveal — which is the thing this book was missing; and its scale grammar (the threat shot from a child\'s eye height with a human in the near ground) and its firelit palette (amber key, grey-blue-green shadow, one visible hard shaft through haze) are already the cave\'s own light story.',
    defaults: { lensKitMm: [21, 35, 50, 135], keyRatio: '3:1 warm / 8:1 threat',
      aslSeconds: '3-7 action / 5-9 emotional',
      transitions: ['hard cut', 'match cut', 'dissolve'],
      avoid: ['dutch angle', 'unmotivated handheld', 'orbit around subject', 'snap zoom'] },
  },
  coverage,
  sequences,
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
