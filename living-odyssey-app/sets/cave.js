/**
 * sets/cave.js — the cave of Polyphemus. Leaves 2, 3 and 4: Beats II (THE
 * CAVE), III (NOBODY), IV (THE STAKE) and V (THE RAMS) — 50 units, half the
 * book, on one painted room.
 *
 * ONE ROOM, FIVE PAINTED STATES, not filters (the room-dim law). The lane
 * shipped the boulder in BOTH positions painted, so the shut pantomime is a
 * state swap under the grind-boom and never a sprite:
 *     cave.jpg          boulder-open night (moon mouth)     the reset master
 *     cave-dawn.jpg     boulder-open dawn shaft             act `cave-dawn`
 *     cave-shut.jpg     boulder-shut firelight (blaze)      act `cave-shut`
 *     cave-embers.jpg   low-fire night                      act `cave-embers`
 *     cave-predawn.jpg  pre-dawn dark                       act `cave-predawn`
 * plus act `boulderOpen` (iv-11), which is the stone drawn aside at night —
 * back to the open master. Emissive gains per state are the layer lane's own
 * stateLightMap, crossfaded with the plates.
 *
 * THE DARK-SWAP LAW (owner's proof review, item b). The boulder's silhouette
 * drifts a few pixels between the three SHUT masters (shut/embers/predawn) —
 * they are three paintings, not one painting relit. A crossfade between any
 * two of them therefore rides a DARK DIP: a brief veil swallows the frame
 * (sin π over the swap) so the drift never shows in a lit frame. Swaps where
 * the boulder MOVES (open<->shut) are the event itself and crossfade plainly
 * under their own sfx. A settled act skips both — it lands finished.
 *
 * SCALE: 43 px/m, measured on the penned ewes (three measured, mean 45 px /
 * 1.05 m). Ulysses 75 px, the crew 73, the giant 300 standing / 165 seated,
 * the stake 77 (6 ft), the great ram 100-110 px long — the painted 45 px
 * ewes stay normal so O.11's anomaly reads.
 *
 * THE SPRAWL MARK IS NUDGED, TWICE (owner's proof review item a; owner's
 * round-2 eye review E2 — the parking-law spirit both times). The ledger's
 * sprawl-head (795,450) stands the sprawled cut's box (~203x70 plate px at
 * its honest length) across BOTH painted pens. Round 1 swept it left-down
 * clear of everything — and buried the bulk behind the stake-five row,
 * where it read as grey stone and the drive line read as pointing at the
 * fire (E2). The round-2 restage keeps the ACCEPTED stage proof's
 * composition — the sprawl on the clear floor right of the fire, head
 * toward it, Ulysses' drive line INTO the eye — at the nearest spot the
 * parking law admits:
 *     head pin (664, 546)  ->  box [645.5, 476.9, 202.7, 70.0]
 *     mainPen  [775,290..1050,425]  clear by 51.9 px (y)
 *     frontPen [860,425..1090,525]  clear by 11.8 px (x)
 *     firewood [495,495..620,555]   clear by 25.5 px (x)
 *     embers anchor (662,456)       clear by 20.9 px (y) — G4's stake tip
 *                                   keeps its own air
 * What the box still overlaps is UPSTAGE of his baseline (the hearth's near
 * stones, the painted clay bowl at 832,520) — correct occlusion, a body in
 * front of dressing, which is the painting's own depth logic and not the
 * broken-fence read the review filed. The clearances are re-measured in the
 * snapshot every frame, off the drawn box; `sprawl.ok` now demands ALL
 * THREE (pens AND woodpile) >= 10, not the pens alone.
 *
 * TWO MORE PARKING SWEEPS (lap round 2, same spirit): the LOTS CIRCLE arcs
 * right-front of the fire — the ledger's own lots-circle mark sits inside
 * the woodpile box it also declares (FORM.lots, U_AT.lots) — and the GROPE
 * walk rises at the sprawl's foot end and takes the back wall instead of
 * the downstage diagonal through the woodpile (PATH.giantGrope). Every
 * settled foot and every point of the grope polyline is >= 10 px clear of
 * every registered obstacle; the marks stay ledger-verbatim for the record.
 *
 * THE THREE HOLD/CLOCK MACHINES this set runs (ledger G3/G4 + §6.6 pattern):
 *   G3 the bowl    iii-08 `hold`: the ivy bowl FILLS in proportion to the
 *                  hold (holdAnchor rides the raised bowl at 700,441). The
 *                  full bowl is pour 1; pours 2 and 3 are pantomimed on the
 *                  bowl's own clock under the two autos that follow
 *                  (ledger holds:3 — three fills, three heedless drains).
 *   G4 the embers  iv-01 `hold`: the stake tip glows IN PROPORTION to the
 *                  hold (watermark law), anchored on the measured embers
 *                  emissive (662,456). At full heat the drive fires itself:
 *                  the hold reaching 1 IS the blinding clock's zero.
 *   THE BLINDING   ruseT() — iv-03/04/05/06 arrive on it (auger 4.2, bore
 *                  7.4, hiss 10.4, fright 12.6). Stake-drive tableau at the
 *                  sprawl head, screen shake at the hiss, kept abstract; the
 *                  neighbours are LAMPLIGHT ONLY, gathering through the
 *                  boulder's rim seams after the yell and receding one by
 *                  one (O.10) — no giant art outside the stone.
 *
 * O.6'S CARRIER IS THE REPETITION: the two-at-a-clutch seg `seize` restages
 * IDENTICALLY at all three meals (ii-10, iii-01, iii-07) — same clutch pose
 * at the giant-seat mark, same 6 s curve, two fewer men each time (12 -> 10
 * -> 8 -> 6, the headcount law).
 *
 * ONE KNOWN AMBIGUITY, DECLARED: leaves 3 and 4 BOTH open on a bare
 * `cave-predawn` act (iii-00 and v-00 — the generated units carry no second
 * act), so a harness jump that resets the world cannot tell the two apart on
 * that act alone. A virgin `cave-predawn` stages leaf 3's truth (the giant
 * sprawled asleep, ten men); every LATER leaf-4 unit self-corrects (the
 * `lash-trios` seg and the ram acts all restate Beat V: blinded, doorway-
 * seated, six men). Jumps to v-00/v-01 alone land on the leaf-3 tableau —
 * flagged in the snapshot (`beatVAmbiguous`), and in the return note.
 *
 * LAW: no wall-clock reads; everything below is a function of the `t` handed
 * to step(). A settled act leaves the world at its END (WIRING §2).
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, floorY,
         emissives, placeStrip, stripProof, stripPxPerFrame, pathLen,
         alongPathArc, walkToward } from '../setkit.js';
import { STRIPS } from '../strips.js';

/* ---- the ledger, transcribed ---------------------------------------- */
const SCALE = { pxPerM: 43, ulysses: 75, crew: 73, giantStand: 300,
                giantSeated: 165, stake: 77 };

const FLOORS = {
  downstage: [[270, 455], [450, 520], [620, 555], [800, 565], [980, 550],
              [1120, 515], [1230, 475]],
  upstage:   [[450, 400], [530, 388], [700, 345], [880, 330], [1000, 390],
              [1020, 430]],
};
const downY = (x) => floorY(FLOORS.downstage, x);

/* the marks, ledger names verbatim — each serves the units it names */
const MARKS = {
  entry:          [360, 450],    // lit threshold inside the mouth (ii-00, K1)
  'cheese-rack':  [640, 405],    // O.3 tableau centre, laden men (ii-01)
  'huddle-far':   [1160, 465],   // far dark right of the bed, under lampR
  suppliant:      [690, 495],    // arms wide in the firelight (ii-06)
  'giant-seat':   [760, 452],    // the working seat by the fire — ALL 3 meals
  milking:        [852, 470],    // the tub + clay bowl cluster (K7/K8, c1, c9)
  'sprawl-head':  [795, 450],    // THE LEDGER'S mark — kept for the record;
                                 // the drawn mark is SPRAWL.at (see header)
  'sword-ulysses': [768, 462],   // at the sleeping throat; G2 rides this
  scheme:         [640, 480],    // alone among the pens (iii-03)
  'lots-circle':  [600, 505],    // THE LEDGER'S mark, kept for the record — it
                                 // sits inside the woodpile box it also declares;
                                 // the drawn circle is FORM.lots, swept to the
                                 // fire's other side (parking law, lap round 2)
  'stake-hide':   [790, 500],    // under the painted dung flecks
  'bowl-offer':   [700, 468],    // the walk-to-the-fire stand; G3's mark
  'ram-stand':    [838, 430],    // apart at the front pen's left rail (G5)
  'ram-at-mouth': [395, 438],    // halted under the palm in the doorway
  'doorway-seat': [345, 420],    // the blind giant filling the mouth
};

/* the painted objects the parking law is stated against (ledger objects) */
const OBJ = {
  mainPen:  [775, 290, 1050, 425],
  frontPen: [860, 425, 1090, 525],
  fireRing: [527, 418, 733, 500],
  firewood: [495, 495, 620, 555],
  mouth:    [290, 250, 405, 415],
  boulderOpen: [455, 330], boulderShut: [355, 325],
  club: { tip: [1097, 200], visibleButt: [1042, 398] },
  bed: [1025, 330, 1240, 500],
};

/* THE NUDGED SPRAWL (header, watch-item a). `at` is the head pin; the eye —
   the drive's target — sits at the head end, mid-bulk. */
const SPRAWL = { at: [664, 546], h: 70, ledger: MARKS['sprawl-head'] };
const EYE = [672, 512];

/* ---- layers-cave.json, transcribed ----------------------------------- */
const EMIS = [
  { id: 'lampL',  at: [248, 356],  r: 50,  rgb: '255,133,6',   a: 0.15, per: 5.7, amp: 0.30 },
  { id: 'lampR',  at: [1260, 371], r: 76,  rgb: '255,215,100', a: 0.15, per: 6.3, amp: 0.30 },
  { id: 'mouth',  at: [337, 312],  r: 80,  rgb: '160,226,255', a: 0.16, per: 9.7, amp: 0.22 },
  { id: 'fire',   at: [638, 427],  r: 238, rgb: '255,191,74',  a: 0.34, per: 3.1, amp: 0.55 },
  { id: 'embers', at: [662, 456],  r: 61,  rgb: '255,45,70',   a: 0.20, per: 4.6, amp: 0.50 },
];
/* per-state channel gains — stateLightMap verbatim, keyed by state name */
const LIGHT = {
  master:  { lampL: 1, lampR: 1, mouth: 1, fire: 0, embers: 0,   fog: 1 },
  dawn:    { lampL: 1, lampR: 1, mouth: 1, fire: 0, embers: 0,   fog: 0.5 },
  shut:    { lampL: 1, lampR: 1, mouth: 0, fire: 1, embers: 0,   fog: 0 },
  embers:  { lampL: 1, lampR: 1, mouth: 0, fire: 0, embers: 1,   fog: 0 },
  predawn: { lampL: 1, lampR: 1, mouth: 0, fire: 0, embers: 0.5, fog: 0 },
};
const PLATES = {
  master:  'set/cave/cave.jpg',
  dawn:    'set/cave/cave-dawn.jpg',
  shut:    'set/cave/cave-shut.jpg',
  embers:  'set/cave/cave-embers.jpg',
  predawn: 'set/cave/cave-predawn.jpg',
};
const SHUT_FAMILY = new Set(['shut', 'embers', 'predawn']);   // the drift set
const LAYER = {
  bloom:     { file: 'set/cave/cave-bloom.png', box: [186, 195, 1196, 298] },
  bloomFire: { file: 'set/cave/cave-bloom-fire.png', box: [371, 159, 536, 536] },
  fog:       { file: 'set/cave/cave-fog.png', box: [161, 156, 446, 390],
               driftPxPerSec: 2.4, per: 13.0, baseOpacity: 0.45 },
};
const SWAP = { lit: 1.6, dark: 1.1, veil: 0.62 };

/* the neighbours' lamplight: three seams on the shut boulder's rim — light
   only, no giant art (O.10). Gathering is on the blinding clock (the yell is
   what brings them); receding is on their own — half a minute of standing in
   the dark is all a "you must be ill" is worth — and `boulderOpen` snuffs
   whatever is left, so the opened mouth is never lit from outside. */
const SEAMS = [
  { at: [302, 368], r: 22, rise: 12.6, recede: 24.0 },
  { at: [352, 255], r: 18, rise: 13.3, recede: 25.6 },
  { at: [401, 330], r: 20, rise: 14.0, recede: 27.2 },
];

/* ---- the lenses, ledger names + values VERBATIM ---------------------- */
const FOCUS = {
  establishing:        [704, 384, 1.0],
  'racks-sweep':       [700, 300, 2.0],
  'doorlight-hinge':   [480, 400, 2.2],
  mouth:               [345, 340, 2.4],
  'discovery-low':     [900, 430, 1.8],
  'eye-close':         [745, 295, 3.6],    // O.1's visual half
  twoshot:             [700, 400, 2.6],
  'meal-close':        [780, 430, 2.8],    // the clutch IN SHADOW, x3
  sword:               [740, 440, 3.2],    // pan START — lands on `mouth`
  'scheme-push':       [640, 470, 3.0],
  'club-wide':         [880, 360, 1.6],    // mast-scale delivered visually
  'lots-overhead':     [600, 490, 3.0],
  'bowl-close':        [690, 440, 3.4],    // G3's hold frame
  'face-flush':        [710, 380, 4.0],
  'ember-close':       [655, 450, 3.8],    // G4's hold frame
  'drive-tight':       [644, 505, 3.4],  // RE-AIMED with the swept sprawl (E2):
                                          // the ledger's (780,430) framed the
                                          // pens, not the restaged tableau —
                                          // k stays the ledger's own 3.4
  'ram-close':         [838, 425, 3.2],    // G5
  'handpass-tight':    [370, 400, 3.6],    // O.11's core image
  'doorway-twoshot':   [370, 380, 3.0],
  'freed-overshoulder': [430, 430, 2.0],
};

/* ---- the gates (ledger §gates, cave) ---------------------------------- */
const GATES = {
  /* G2: the sword is an ACTOR PROP — the anchor rides the mounted Ulysses at
     his staged rest, mark (768,462) + 17 px of hip: the ledger's (768,445). */
  sword: { hipLift: 17, r: 38 },
  /* G5: the great-ram ACTOR's body centre at ram-stand — (838,430) - 15. */
  'ram-great': { bodyLift: 15, r: 60 },
};
/* G3/G4, the two hold anchors, ledger verbatim */
const HOLD_AT = { bowl: [700, 441], embers: [662, 456] };

/* ---- the sword pan (O.5) and the pours (O.7) -------------------------- */
const SWORD = { rise: 0.5, hang: 1.5, sheathe: 2.4, panFrom: 0.9, panTo: 7.5 };
/* pour 1 is the reader's own hold; 2 and 3 ride the bowl's clock under the
   9 s and 8 s autos that follow — refill, then a heedless drain */
const POURS = { drains: [[0.3, 2.1], [7.0, 8.8], [14.0, 15.8]],
                refills: [6.5, 13.5], swayFrom: 16.5, total: 20 };
/* the blinding clock's fixed points — units.js's own at-times */
const DRIVE = { auger: 4.2, bore: 7.4, hiss: 10.4, fright: 12.6 };

/* AUTHORED, NOT MEASURED: the lane shipped no cave relight master, and no
   inset ever rises over these leaves (the chapter's only inset is the
   shore's wineskin), so this matrix is never exercised today. Composed warm-
   dark to the night masters' palette; the snapshot flags `painted: false`. */
const DIM_MATRIX = [0.55, 0.63, 0.80];
const DIM_SCRIM = 0.45;

/* ---- the actors: tools/ody/actors.json pins, transcribed -------------- */
const ART = {
  ulyssesStand: { file: 'actor/ulysses-stand.png',  px: [316, 682],  pin: [125, 676] },
  ulyssesWalk:  { file: 'actor/ulysses-walk.png',   px: [304, 664],  pin: [208, 658] },
  ulyssesOffer: { file: 'actor/ulysses-offer.png',  px: [405, 684],  pin: [67, 678] },
  ulyssesSword: { file: 'actor/ulysses-sword.png',  px: [361, 666],  pin: [125, 660] },
  ulyssesDrive: { file: 'actor/ulysses-drive.png',  px: [880, 559],  pin: [451, 553] },
  crewA:        { file: 'actor/crew-a-stand.png',   px: [266, 620],  pin: [132, 614] },
  crewB:        { file: 'actor/crew-b-stand.png',   px: [276, 635],  pin: [140, 629] },
  crewCarry:    { file: 'actor/crew-carry.png',     px: [849, 628],  pin: [499, 622] },
  giantStand:   { file: 'actor/polyphemus-stand.png',  px: [674, 1244], pin: [473, 1238] },
  giantSeated:  { file: 'actor/polyphemus-seated.png', px: [694, 973],  pin: [187, 967] },
  giantClutch:  { file: 'actor/polyphemus-clutch.png', px: [665, 1208], pin: [509, 1202] },
  giantDrink:   { file: 'actor/polyphemus-drink.png',  px: [672, 1255], pin: [451, 1249] },
  giantSprawl:  { file: 'actor/polyphemus-sprawl.png', px: [1306, 451], pin: [119, 445] },
  giantGrope:   { file: 'actor/polyphemus-blinded-grope.png', px: [744, 609], pin: [361, 603] },
  giantStroke:  { file: 'actor/polyphemus-stroke.png', px: [712, 1208], pin: [428, 1202] },
  ramWalk:      { file: 'actor/ram-walk.png',       px: [815, 663],  pin: [343, 657] },
  ramGreat:     { file: 'actor/ram-great.png',      px: [867, 687],  pin: [376, 681] },
  ramGreatSlung: { file: 'actor/ram-great-slung.png', px: [867, 689], pin: [375, 683] },
  ramPairSlung: { file: 'actor/ram-pair-slung.png', px: [1213, 579], pin: [675, 573] },
  bowl:         { file: 'actor/prop-bowl.png',      px: [862, 449],  pin: [426, 443] },
  sword:        { file: 'actor/prop-sword.png',     px: [910, 499],  pin: [13, 493] },
  /* the stake ships pinned at its BUTT; the glowing variant at its TIP — so
     the heat and the drive both anchor the tip on the point that matters
     (the coals, then the eye) and the pin law does the geometry */
  stake:        { file: 'actor/prop-stake.png',     px: [1217, 592], pin: [56, 586] },
  stakeGlow:    { file: 'actor/prop-stake-glowing.png', px: [1143, 582], pin: [1000, 576] },
};
/* the plain stake and the glowing stake pinned by their VISIBLE TIPS, for
   the heat/drive frames where the tip is the anchored fact — both MEASURED
   off the cuts' own alpha (round-3, E2): the plain art RISES from its
   bottom-left butt (12,581) to its top-right point (1209,100); the glow art
   FALLS to its ember head at (1134,466). The lane's symmetry assumption
   (1161,586) and the shipped glow pin (1000,576) both sat in transparent
   air, which is what hung the round-2 drive as two crossed sticks with the
   glow off the eye. */
const STAKE_TIP = { file: ART.stake.file, px: ART.stake.px, pin: [1209, 100] };
const GLOW_TIP = { file: ART.stakeGlow.file, px: ART.stakeGlow.px,
                   pin: [1134, 466] };
/* per-pose drawn heights at 43 px/m: the giant's law is the ledger's own
   (300 standing, 165 seated fills the 160 px mouth); the in-between poses
   are read off their cuts' own stances against those two anchors */
const GIANT_H = { stand: 300, seat: 165, clutch: 190, drink: 175, sprawl: 70,
                  grope: 210, doorway: 165, stroke: 190 };
const RAM_H = { walk: 45, great: 83, greatSlung: 84, pair: 57 };
const PROP_H = { bowl: 16, sword: 12, stakeW: 84 };

const CREW_N = 12;                    // twelve enter; the meals do the counting

/* ---- THE STRIPS: the shipped registry, READ, not transcribed ----------- *
 * strips.js is generated verbatim from tools/ody/strips.json (build-gated
 * cells: identity/scale/anchors/action; the lap asserts the registry sha
 * over the shipped bytes AND the shipped module against the registry), so
 * n / cell / srcH / anchors are the registry's own numbers — the n=4 -> n=10
 * seedance recut changed all four and no set may hardcode them again. The
 * machinery is room.js KING.walk via setkit placeStrip; frame sources per
 * STRIPS.md: cumulative DISTANCE for the walks (an eased profile cannot
 * skate the feet), THE BLINDING CLOCK for the auger twist. pxPerFrame is
 * the King law read off each strip (setkit stripPxPerFrame: stride / (n/2))
 * at 43 px/m: the giant's 2.6 m stride -> 111.8 px -> 22.4 over 10 cells;
 * the crew's 0.75 m -> 32.3 px -> 6.45; the ovine 0.6 m -> 25.8 px -> 5.16.
 * The ram strip is AUTHORED FACING LEFT (the flockOut stream's own way — no
 * flip on the escape); every other strip is authored facing right. */
const STRIP = {
  giant: { ...STRIPS['polyphemus-walk'],
           pxPerFrame: stripPxPerFrame(STRIPS['polyphemus-walk'], 2.6 * SCALE.pxPerM) },
  crew:  { ...STRIPS['crew-walk'],
           pxPerFrame: stripPxPerFrame(STRIPS['crew-walk'], 0.75 * SCALE.pxPerM) },
  twist: { ...STRIPS['stake-twist'], period: 1.1 },   // the verb's own clock:
                                                      // n frames / 1.1 s, monotone
  ram:   { ...STRIPS['ram-walk'],
           pxPerFrame: stripPxPerFrame(STRIPS['ram-walk'], 0.6 * SCALE.pxPerM) },
};
/* the stride is MEASURED off the pose the frame actually moved (seg and
   damp alike); a teleport (fade-through reland, a settled snap) is not a
   stride, and a SEIZED man is dragged, not walking */
const STRIDE_MIN_SPEED = 6;           // plate px/s
const STRIDE_TELEPORT = 40;           // plate px in one step is a re-stage
/* HONEST GROUND SPEED (the anti-skate law's other half): the planted foot
   glides at ground speed by construction (each frame's anchor is pinned on
   the moving mark), so ground speed IS the skate and it is bounded like one:
   a man walks 2.0 m/s at most (86 px/s here — the damp's 2.2 x 250 px
   opening step is a 12.8 m/s sprint no feet perform), and the giant's
   2.6 m stride at his unhurried shepherd's cadence spends 1.8 m/s (78 px/s)
   — his strip walks are ARC-PARAMETERISED against this cap (stepGiant), so
   a short seg cannot make him sprint; the seg simply hands him the floor a
   beat longer. */
const WALK_V = { man: 2.0 * SCALE.pxPerM, giant: 1.8 * SCALE.pxPerM };

/* place a cut by its measured pin. Returns the drawn box for the snapshot. */
function pinCut(node, art, at, hPx, { flip = false, bob = 0, rot = 0 } = {}) {
  const k = hPx / art.px[1];
  const w = art.px[0] * k, h = art.px[1] * k;
  box(node, at[0] - art.pin[0] * k, at[1] - art.pin[1] * k, w, h);
  node.style.transformOrigin =
    `${(art.pin[0] * k).toFixed(2)}px ${(art.pin[1] * k).toFixed(2)}px`;
  node.style.transform = (flip ? 'scaleX(-1) ' : '') +
    `translateY(${bob.toFixed(2)}px)` + (rot ? ` rotate(${rot.toFixed(2)}deg)` : '');
  return { w, h };
}

/* walk a polyline path by eased fraction k; returns [x, y] */
function alongPath(pts, k) {
  const n = pts.length - 1;
  const f = clamp01(k) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)];
}

/* ---- THE STAGINGS: the crew formations, authored on the floors -------- *
 * Every foot below sits between the two ledger polylines and clears the
 * fire ring's box (527..418..733..500), the woodpile (495..495..620..555)
 * and the two pens by the parking law's >= 10 px — the same sweep the
 * sprawl mark got. The huddle is the ledger's huddle-far arc; the racks line
 * stops at rack C because rack D's feet stand inside mainPen's box. */
const FORM = (() => {
  const F = {};
  F.off = [];
  F.entry = [];
  for (let i = 0; i < CREW_N; i++) {
    const x = 418 + i * 19;
    F.entry.push([x, downY(x) - 32 + ((i % 3) - 1) * 4]);
  }
  F.racks = [];
  for (let i = 0; i < CREW_N; i++) {
    const x = 542 + i * 20;                       // 542..762, short of mainPen
    F.racks.push([x, 414 - (x - 542) * 0.05]);
  }
  F.huddle = [];
  for (let i = 0; i < CREW_N; i++) {
    F.huddle.push([1136 + (i % 4) * 17 + (i >> 2) * 3,
                   446 + (i >> 2) * 13 + (i % 2) * 2]);
  }
  /* THE LOTS CIRCLE IS SWEPT (lap round 2, the parking law): the ledger's
     lots-circle mark (600,505) stands inside its own woodpile box
     [495,495..620,555], so the drawn circle arcs on the FIRE'S OTHER SIDE —
     right-front of the pit, every foot >= 10 px clear of the woodpile's
     x 620 rail, the fire ring's y 500 rail (or its x 733 rail), and the two
     pens, still inside the lots-overhead lens (k 3.0 at 600,490 frames
     x 365..835). The hidden stake (748,498) now lies at the circle's edge. */
  F.lots = [[676, 524], [699, 518], [722, 517], [743, 522],
            [750, 531], [727, 537], [702, 538], [680, 532]];
  /* the four at the stake (round-2 eye review E2/E3): carry/drive cuts
     SCATTERED along the beam behind Ulysses — the shaft's own axis extended
     up-left past the butt (589,524) — never a standing row downstage of the
     sprawl. Every foot keeps x < 527 (clear of the fire ring's box) and
     y < 495 or x < 495 (clear of the woodpile), and stands between the
     ledger's two floor polylines. */
  F.stakefive = [[522, 459], [492, 441], [472, 481], [500, 491]];
  F.freed = [[444, 452], [468, 459], [492, 465], [516, 470],
             [452, 473], [500, 477]];
  return F;
})();
/* Ulysses' own mark per formation (the crew arrays never include him) */
const U_AT = {
  entry: [655, 514], racks: [600, 432], huddle: [1120, 478],
  suppliant: MARKS.suppliant, sword: MARKS['sword-ulysses'],
  scheme: MARKS.scheme, lots: [711, 542], bowl: MARKS['bowl-offer'],
  /* stakefive: at the sprawled head's shoulder, baseline 549 — 3 px NEARER
     than the sprawl's 546, so the painter's order keeps him and his drive
     cut IN FRONT of the head he is working on (E2) */
  stakefive: [624, 549], work: [1006, 538], freed: [432, 449],
  /* `under`: the men are beneath the fleeces but ULYSSES STAYS — his own
     gate (G5) is still to be clicked; he waits by the great ram's rail */
  under: [790, 468],
};
/* how many of a formation's spots are USED is the headcount law's business
   (crewN); `stakefive` shows four and parks the rest in the huddle */

/* the stake-make work party's two extra hands, at the island rim below the
   club (the floor before the club's butt is the front pen — men cannot
   stand in it, so they work from the rim and the montage stays abstract) */
const WORK_CREW = [[968, 545], [938, 549]];

/* ---- the giant's walk paths (all swept clear of the fire ring) -------- */
const PATH = {
  giantIn:   [[398, 436], [600, 412], [760, 452]],       // ii-03, under the load
  giantOut:  [[760, 452], [640, 412], [398, 436]],       // iii-02, with the flock
  /* iv-11, ALONG THE WALL — literally (lap round 2, the parking law): the
     old downstage diagonal crossed the woodpile box; he now rises at the
     sprawl's FOOT end (the bulk's own footprint), rounds the fire's right
     (x >= 743, ring rail 733 + 10), gropes along the back wall between the
     rack feet (bottoms 385/345 + 10) and the fire ring's top rail (418 - 10),
     and comes down on the mouth — every point of the polyline >= 10 px clear
     of every registered obstacle, so any mid-walk settle sample is legal */
  giantGrope: [[760, 540], [752, 468], [746, 404], [640, 400],
               [540, 398], [430, 432]],
  flockOut:  [[872, 512], [760, 524], [660, 536], [520, 488], [415, 442]],
  ramEscape: [[838, 430], [730, 500], [650, 532], [455, 448]],  // G5's ram, last
};
const FLOCK_N = 5;                    // walkers; the pens' painted ewes stay
/* NO PARKED RAMS: round-2 eye review E1 — ram ACTORS belong to Beat V only.
   iii-06's overfull pens are recorded in the snapshot (S.parked), never
   staged; the walkers mount for the dawn escape and nothing earlier. */
const TRIOS = [[930, 538], [1010, 534]];      // v-02: lashed on the open floor

export class CaveSet {
  static id = 'cave';
  /** No inset rises over the cave — the chapter's only inset is the shore's
   *  wineskin (inset law §6). */
  static insets = {};
  static beds = ['cave'];

  constructor(root, st) {
    this.st = st;                     // the Stage shell: img/bitmap/cue/reduced
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);

    /* ---- the five painted states --------------------------------------- *
     * The open master sits at the bottom at opacity 1 — the floor of every
     * crossfade. An incoming state is MOVED TO THE TOP of the plate group
     * and fades in over whatever held the frame; the holder is zeroed only
     * when the incoming has fully landed, so a swap is always one plate
     * fading over a finished picture, never two half-plates over a ghost. */
    this.plateWrap = el('div', 'plates', root);
    this.plates = {};
    for (const name of ['master', 'dawn', 'shut', 'embers', 'predawn']) {
      const e = img(PLATES[name], 'lyr plate', this.plateWrap);
      box(e, 0, 0, PLATE.w, PLATE.h);
      e.style.opacity = name === 'master' ? '1' : '0';
      this.plates[name] = e;
    }

    /* ---- the mouth's moon-mist (screen; open states only) -------------- */
    this.fog = img(LAYER.fog.file, 'lyr');
    box(this.fog, ...LAYER.fog.box);
    this.fog.style.mixBlendMode = 'screen';
    this.fog.style.opacity = '0';

    /* ---- THE DIM SCRIM — honoured, never exercised (see DIM_MATRIX) ---- */
    this.scrim = el('div', 'lyr', root);
    box(this.scrim, 0, 0, PLATE.w, PLATE.h);
    this.scrim.style.background = '#03050a';
    this.scrim.style.opacity = '0';

    /* ---- THE ACTORS (isolated, so the dim matrix is theirs alone) ------ *
     * DOM order inside the group is the painter's order and it is SORTED
     * every frame by baseline y (the church F5 law): the giant crosses the
     * whole depth range of this room — mouth threshold to the bed — and a
     * written-down order would be wrong for half his marks. */
    this.actors = el('div', 'actors', root);
    this.giantN = {};
    for (const [pose, art] of [['stand', ART.giantStand], ['seat', ART.giantSeated],
        ['clutch', ART.giantClutch], ['drink', ART.giantDrink],
        ['sprawl', ART.giantSprawl], ['grope', ART.giantGrope],
        ['stroke', ART.giantStroke]]) {
      const n = img(art.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.giantN[pose] = n;
    }
    /* THE WALK STRIPS (decoded at boot via st.bitmap — room.js: the first
       walk frame never flashes white). The strip is the walk, the cut is the
       stand/seat, and they are never both visible (the swap law). */
    this.giantStripN = el('div', 'lyr walk', this.actors);
    this.giantStripN.style.backgroundImage = st.bitmap(STRIP.giant.file);
    this.giantStripN.style.opacity = '0';
    this.twistN = el('div', 'lyr walk', this.actors);
    this.twistN.style.backgroundImage = st.bitmap(STRIP.twist.file);
    this.twistN.style.opacity = '0';
    this.uN = {};
    for (const [pose, art] of [['stand', ART.ulyssesStand], ['walk', ART.ulyssesWalk],
        ['offer', ART.ulyssesOffer], ['sword', ART.ulyssesSword],
        ['drive', ART.ulyssesDrive]]) {
      const n = img(art.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.uN[pose] = n;
    }
    this.crew = [];
    this.crewStripN = [];
    for (let i = 0; i < CREW_N; i++) {
      const n = img(i % 2 ? ART.crewB.file : ART.crewA.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.crew.push(n);
      const w = el('div', 'lyr walk', this.actors);
      w.style.backgroundImage = st.bitmap(STRIP.crew.file);
      w.style.opacity = '0';
      this.crewStripN.push(w);
    }
    this.carry = [];
    for (let i = 0; i < CREW_N; i++) {
      const n = img(ART.crewCarry.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.carry.push(n);
    }
    /* the dawn stream's walkers are STRIP-backed now (the herd of statues on
       casters is retired); the GREAT ram keeps his cuts — he is G5's gate
       target and his slung/halt beats are poses, not strides (STRIPS.md) */
    this.rams = [];
    for (let i = 0; i < FLOCK_N; i++) {
      const n = el('div', 'lyr walk', this.actors);
      n.style.backgroundImage = st.bitmap(STRIP.ram.file);
      n.style.opacity = '0';
      this.rams.push(n);
    }
    this.pairs = [];
    for (let i = 0; i < 2; i++) {
      const n = img(ART.ramPairSlung.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.pairs.push(n);
    }
    this.ramGreatN = img(ART.ramGreat.file, 'lyr', this.actors);
    this.ramSlungN = img(ART.ramGreatSlung.file, 'lyr', this.actors);
    this.ramGreatN.style.opacity = '0';
    this.ramSlungN.style.opacity = '0';

    /* the props ride inside the group so the depth sort owns them too */
    this.bowlN = img(ART.bowl.file, 'lyr prop', this.actors);
    this.bowlFill = el('div', 'emis', this.actors);       // the wine, ∝ hold
    this.bowlFill.style.background =
      'radial-gradient(ellipse at 50% 45%,rgba(122,20,34,.95) 0%,rgba(122,20,34,.55) 60%,rgba(122,20,34,0) 100%)';
    this.swordN = img(ART.sword.file, 'lyr prop', this.actors);
    this.stakeN = img(ART.stake.file, 'lyr prop', this.actors);
    this.stakeGlowN = img(ART.stakeGlow.file, 'lyr prop', this.actors);
    for (const n of [this.bowlN, this.bowlFill, this.swordN, this.stakeN,
                     this.stakeGlowN]) n.style.opacity = '0';
    /* the sword's breathing glint at the G2 anchor, in the low-fire state */
    this.swordGlint = el('div', 'emis', this.actors);
    this.swordGlint.style.background =
      'radial-gradient(circle at 50% 50%,rgba(220,232,255,.7) 0%,rgba(220,232,255,0) 70%)';
    this.swordGlint.style.opacity = '0';

    /* ---- the measured light, over the actors (layer-lane drawOrder) ---- */
    this.bloom = img(LAYER.bloom.file, 'lyr');
    box(this.bloom, ...LAYER.bloom.box);
    this.bloom.style.mixBlendMode = 'screen';
    this.bloomFire = img(LAYER.bloomFire.file, 'lyr');
    box(this.bloomFire, ...LAYER.bloomFire.box);
    this.bloomFire.style.mixBlendMode = 'screen';
    this.bloomFire.style.opacity = '0';
    this.emis = emissives(EMIS, root);
    /* the neighbours' lamplight seams (O.10) — light only, outside the stone */
    this.seamN = SEAMS.map((s) => {
      const d = el('div', 'emis', root);
      box(d, s.at[0] - s.r, s.at[1] - s.r, s.r * 2, s.r * 2);
      d.style.background =
        'radial-gradient(circle at 50% 50%,rgba(255,196,110,.55) 0%,' +
        'rgba(255,196,110,.22) 45%,rgba(255,196,110,0) 75%)';
      d.style.opacity = '0';
      return d;
    });
    /* the steam up the firelight shaft at the hiss — abstract, a pale rise */
    this.steam = el('div', 'emis', root);
    box(this.steam, EYE[0] - 26, EYE[1] - 150, 52, 150);
    this.steam.style.background =
      'linear-gradient(180deg,rgba(226,232,240,0) 0%,rgba(226,232,240,.30) 60%,rgba(226,232,240,.12) 100%)';
    this.steam.style.opacity = '0';

    /* ---- THE VEIL, last: the dark the shut-family swaps hide in -------- */
    this.veil = el('div', 'lyr', root);
    box(this.veil, 0, 0, PLATE.w, PLATE.h);
    this.veil.style.background = '#000';
    this.veil.style.opacity = '0';

    this.reset();
  }

  /** The world as leaf 2's unit 0 finds it: the open night master, the pens
   *  full of painted stock, NOBODY on the floor — the entry seg is what
   *  slips the men in, and the giant is away shepherding. A replay from the
   *  top must get back here first (the room.js lesson). */
  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      /* the painted state machine */
      stateName: 'master', swap: null,       // { to, t0, dur, dip } | null
      /* the troupe */
      form: 'off', snap: true, meals: 0,
      seg: null,                             // { name, t0, dur } | null
      /* the giant */
      giant: { pose: 'away', x: 0, y: 0, blinded: false,
               walk: null },                 // { path, t0, dur, endPose }
      /* the machines */
      holdMode: null, holdK: 0,              // 'bowl' | 'embers' | null
      pour: -1e9, pourPrev: -1,              // G3's clock (pour-1 fill instant)
      heatArmed: -1e9,                       // G4 tableau armed (first anchor poll)
      drive: -1e9,                           // THE BLINDING CLOCK's zero
      frightDone: false, seamsSnuffed: false,
      sword: -1e9, hide: -1e9,               // G2's draw; the stake-hide slide
      sling: -1e9,                           // G5's sling-under
      flock: null,                           // { mode:'out'|'in'|'escape', t0, dur }
      ramOn: false, ramAt: null,             // the great ram: staged; last drawn at
      ramPinned: null,                       // { from, t0 } — halted at the mouth
      ramHome: null,                         // clear of the cave (free-men's end)
      seizeBase: CREW_N, seizeLatched: true, // the meal's victims, per staging
      parked: false,                         // iii-06's overfull pens
      boomAt: -1e9,                          // the settling boom's cue latch
    };
    this.uMark = null;                       // an act's own mark outranks the form
    /* presentation pose per human: where the cut IS (damped), distinct from
       where the formation wants it — the shore troupe law. The stride fields
       (dist/lx/ly/walking/face/frame) are the strip driver's. */
    this.pose = { u: { x: 0, y: 0, op: 0, flip: false, kind: 'stand', frame: 0 } };
    for (let i = 0; i < CREW_N; i++) {
      this.pose['c' + i] = { x: 0, y: 0, op: 0, flip: false, carry: false,
                             walking: false, striding: false, dist: 0,
                             lx: null, ly: null, face: 1, frame: 0 };
    }
    /* the dawn stream's gait clocks (one per walker) + the twist/walk flags */
    this.ramGait = [];
    for (let i = 0; i < FLOCK_N; i++) {
      this.ramGait.push({ dist: 0, lx: null, ly: null, at: null, frame: 0 });
    }
    this.giantWalking = false;
    this.twisting = false;
  }

  /* ---- the camera ------------------------------------------------------ */
  focusPlate(name) {
    /* THE DRIVE-TIGHT LATCH: a harness jump can land ON a blinding-clock
       unit with the ember hold never performed (silent replays fire acts,
       not holds), and a clock unit with a null clock is a stranded lap. The
       drive lens serves ONLY iv-03/04/05, so the first frame that asks for
       it while the embers are armed and the clock is unlit lights the clock
       at zero — the settled-fireRuse analogue, declared here. */
    if (name === 'drive-tight' && this.state.holdMode === 'embers' &&
        this.state.drive < -1e8) {
      this.state.drive = this.state.t;
    }
    /* THE EMBER ARM: G4 belongs to the Beat IV embers unit (iv-01), which
       carries no act — its LENS is the announcement. The `cave-embers` state
       act fires at ii-10 and iii-13, units early of the gate, and may not
       arm the hold (the b2-25-sword defect: an early arm claims Ulysses to
       the stake-five mark and G2's target never comes LIVE). The ember-close
       lens serves ONLY iv-01/iv-02, so the first frame that asks for it arms
       the ember hold — the drive-tight latch's own pattern, one line up; a
       replay to any later Beat IV unit crosses iv-01 and arms here too. */
    if (name === 'ember-close' && this.state.holdMode !== 'embers') {
      this.state.holdMode = 'embers';
    }
    return FOCUS[name] || FOCUS.establishing;
  }

  /**
   * THE SHIFTSTONE PAN (O.5): the drawn blade stops mid-air and the camera
   * answers the reader's instinct with the boulder — the frame pans off the
   * sword lens onto the mouth and holds there while the reflection is read.
   * When the window lapses the camera eases home to the unit's own lens
   * (the sword lens again — steel going back in its sheath).
   */
  camOverride() {
    const d = this.swordT();
    if (d !== null && d >= SWORD.panFrom && d < SWORD.panTo) return 'mouth';
    return null;
  }

  swordT() {
    const d = this.state.t - this.state.sword;
    return (this.state.sword > -1e8 && d >= 0) ? d : null;
  }

  /** THE BLINDING CLOCK — iv-03..iv-06 arrive on it (`verb:'clock'`). Zero
   *  is the instant the ember hold reached full heat: the drive fires
   *  itself (ledger G4). */
  ruseT() {
    const d = this.state.t - this.state.drive;
    return (this.state.drive > -1e8 && d >= 0) ? d : null;
  }

  /* ---- the gates -------------------------------------------------------- */
  targetPlate(name) {
    if (name === 'sword') {
      const U = this.pose.u;
      return [U.x, U.y - GATES.sword.hipLift];      // rides the mounted actor
    }
    if (name === 'ram-great' && this.state.ramAt) {
      const a = this.state.ramAt;
      return [a[0], a[1] - GATES['ram-great'].bodyLift];
    }
    return null;
  }

  /** G2 is live only while Ulysses is mounted at sword-ulysses (ledger);
   *  G5 only once the ram-stand act has staged the great ram. */
  targetLive(name) {
    if (name === 'sword') {
      const U = this.pose.u, M = MARKS['sword-ulysses'];
      return U.op > 0.5 && Math.hypot(U.x - M[0], U.y - M[1]) < 8;
    }
    if (name === 'ram-great') return this.state.ramOn;
    return false;
  }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const at = this.targetPlate(name);
    if (!at) return false;
    if (name === 'ram-great' && this.ramBox) {
      const B = this.ramBox;
      if (p.x >= B[0] && p.x <= B[0] + B[2] && p.y >= B[1] && p.y <= B[1] + B[3]) {
        return true;
      }
    }
    const r = GATES[name] ? GATES[name].r : 40;     // engine adds 48 screen px
    return Math.hypot(p.x - at[0], p.y - at[1]) <= r;
  }

  /** the two embodied speakers on these leaves; A CYCLOPS is a voice beyond
   *  the stone and draws no leader line */
  headPlate(who) {
    if (who === 'ULYSSES') {
      const U = this.pose.u;
      if (U.op < 0.5) return null;
      return [U.x, U.y - SCALE.ulysses * 0.93];
    }
    if (who !== 'POLYPHEMUS') return null;
    const G = this.state.giant;
    if (G.pose === 'away') return null;
    const head = {
      stand: [0, -290], seat: [8, -158], clutch: [-4, -178], drink: [0, -168],
      sprawl: [8, -52], grope: [0, -195], doorway: [0, -150], stroke: [-6, -178],
    }[G.pose] || [0, -160];
    return [G.x + head[0], G.y + head[1]];
  }

  /** G3: the raised ivy bowl; G4: the measured embers centre — ledger
   *  verbatim. Pure — the snapshot reads it too. */
  holdAnchor() {
    const S = this.state;
    if (S.holdMode === 'embers') return HOLD_AT.embers.slice();
    if (S.holdMode === 'bowl') return HOLD_AT.bowl.slice();
    return null;
  }

  /** the continuous hold (the engine calls this every frame, hold unit or
   *  not — enterUnit zeroes it on every entry). It is therefore also the
   *  ember tableau's ARMING SIGNAL: iv-01 carries no act, so the first call
   *  that arrives in embers mode is Beat IV announcing itself to the set —
   *  the stake comes out of the dung and the five gather to the fire. Full
   *  heat fires the drive itself; a full bowl is pour 1. */
  setHold(k) {
    const S = this.state;
    S.holdK = clamp01(k);
    if (S.holdMode === 'embers' && S.heatArmed < -1e8) S.heatArmed = S.t;
    if (S.holdMode === 'bowl' && S.holdK >= 1 && S.pour < -1e8) S.pour = S.t;
    if (S.holdMode === 'embers' && S.holdK >= 1 && S.drive < -1e8) S.drive = S.t;
  }

  waitDone() { return true; }         // no `wait:` unit rides this SET

  /* ---- the verbs the units fire ------------------------------------------ */
  /**
   * `settled` = replayed jump: leave the world at the act's END (WIRING §2).
   * The five STATE acts swap plates (the room-dim law); the mark acts move
   * the troupe; the gateActs run the pantomimes the reader's clicks earn.
   */
  fire(act, settled = false) {
    const S = this.state, t = S.t;
    switch (act) {
      /* ---- the five painted states -------------------------------------- */
      case 'cave-dawn':                 // ii-00 (the empty morning) / v-05 (escape)
        /* ii-00 is the leaf misgave's completing click turns TO, so this act
           is where the wineskin plate comes DOWN (CONTENT §2/§6: "the
           completing click drops the plate and TURNS THE PAGE") — the same
           set-act path room.js walks in `gazetteerFetch`/`plateOff`. The
           drop lands under the risen cover; on v-05 it is a no-op. */
        this.st.plate(null, 0);
        this.stateGo('dawn', settled);
        if (S.giant.blinded) {
          /* Beat V: the dawn shaft breaks past the seated giant and the
             flock streams for it; his palm goes over their backs (O.11) */
          S.flock = { mode: 'escape', t0: settled ? t - 14 : t, dur: 14 };
          this.giantPose('stroke', MARKS['doorway-seat'], settled);
        }
        break;
      case 'cave-shut':                 // ii-04 / iii-07: the state swap IS the
        this.stateGo('shut', settled);  // boulder pantomime, under the grind
        if (!settled) S.boomAt = t + 1.15;   // …and the stone SETTLES
        break;
      case 'cave-embers':               // ii-10 / iii-13: fire down, giant down
        this.stateGo('embers', settled);
        /* the ember STATE is not the ember GATE (the b2-25-sword defect):
           ii-10 fires this act three units before Beat IV's hold, and an
           armed holdMode here has setHold arm the tableau at once — the
           stake-five claim takes Ulysses and he never stands sword-ulysses
           (768,462), so G2's target never comes LIVE. G4 arms at the Beat IV
           embers unit itself (iv-01 — the ember-close lens, in focusPlate);
           this act only ENDS a running hold gate: G3's bowl goes down. */
        S.holdMode = null;
        /* the sprawl: ii-10's comes AFTER the seize and iii-13's is the
           collapse seg's own business — the act states the destination and
           the unit's seg (started right after this fires) performs the way
           there; with no seg pending the first step lands it directly */
        if (settled) this.giantPose('sprawl', SPRAWL.at, true);
        else S.giant.next = 'sprawl';
        break;
      case 'cave-predawn':              // iii-00 AND v-00 open on this (header)
        this.stateGo('predawn', settled);
        if (S.giant.pose === 'away') {
          /* a virgin predawn is leaf 3's truth: the giant asleep among the
             flock, ten men in the far dark (the declared ambiguity) */
          this.giantPose('sprawl', SPRAWL.at, true);
          S.meals = Math.max(S.meals, 1);
          this.setForm('huddle', true);
        }
        break;
      case 'boulderOpen':               // iv-11: the stone drawn aside at night
        this.stateGo('master', settled);
        S.giant.blinded = true;
        S.seamsSnuffed = true;          // the neighbours are GONE (O.10 closed)
        if (S.drive < -1e8) S.drive = t - 40;   // a jump landed past the blinding
        this.giantWalk(PATH.giantGrope, 2.6, 'grope', settled);
        break;

      /* ---- the marks ----------------------------------------------------- */
      case 'cheese-rack':               // ii-01: the laden tableau (O.3)
        this.setForm('racks', settled);
        break;
      case 'huddle-far':                // ii-03: they scatter to the far dark
        this.setForm('huddle', settled);
        break;
      case 'giant-seat':                // ii-05: seated, working, the eye close
        this.giantPose('seat', MARKS['giant-seat'], settled);
        break;
      case 'suppliant':                 // ii-06: arms wide in the firelight
        this.uTo(MARKS.suppliant, 'stand', settled);
        break;
      case 'sword-ulysses':             // ii-11: the glint at the hip — G2 arms
        this.uTo(MARKS['sword-ulysses'], 'sword', settled);
        break;
      case 'swordDraw':                 // G2 gateAct: the draw STOPS mid-air,
        S.sword = settled ? t - 99 : t; // and the pan answers it (O.5)
        break;
      case 'milking':                   // iii-01: the dawn routine; he rises
        this.giantPose('seat', MARKS['giant-seat'], settled);
        break;
      case 'scheme':                    // iii-03: alone among the pens
        this.uTo(MARKS.scheme, 'stand', settled);
        break;
      case 'stake-hide':                // iii-05: under the dung; then the lots
        S.hide = settled ? t - 9 : t;
        this.setForm('lots', settled);
        break;
      case 'bowl-offer':                // iii-08: G3 arms; the bowl is the verb
        S.holdMode = 'bowl';
        S.pour = settled ? t - POURS.total : -1e9;  // settled: pours are history
        S.pourPrev = -1;
        this.uTo(MARKS['bowl-offer'], 'offer', settled);
        break;

      /* ---- Beat V (each of these RESTATES the beat — the jump correction) */
      case 'ram-stand':                 // v-04: the great ram apart at the rail
        this.beatV(settled);
        S.ramOn = true;
        S.ramAt = MARKS['ram-stand'].slice();
        break;
      case 'slingUnder':                // G5 gateAct: the reader's click IS the
        this.beatV(settled);            // sling-under (the no-text moment)
        S.ramOn = true;
        S.ramAt = S.ramAt || MARKS['ram-stand'].slice();
        S.sling = settled ? t - 9 : t;
        break;
      case 'ram-at-mouth':              // v-07: halted under the palm
        this.beatV(settled);
        S.ramOn = true;
        S.sling = S.sling > -1e8 ? S.sling : t - 9;
        S.ramPinned = { from: (S.ramAt || [455, 448]).slice(),
                        t0: settled ? t - 1.2 : t };
        this.giantPose('stroke', MARKS['doorway-seat'], settled);
        break;
      case 'doorway-seat':              // iv-12: seated in the mouth arch,
        S.giant.blinded = true;         // hands spread — the door open and
        S.seamsSnuffed = true;          // utterly barred
        if (S.drive < -1e8) S.drive = t - 45;
        this.giantPose('doorway', MARKS['doorway-seat'], settled);
        break;
      default: break;
    }
  }

  /** Beat V's restatement: blinded, doorway-seated, six men under fleeces —
   *  fired by every leaf-4 hook so a jump past v-01 self-corrects (header). */
  beatV(settled) {
    const S = this.state;
    S.giant.blinded = true;
    S.meals = 3;                                   // six men left
    S.holdMode = null; S.seamsSnuffed = true;
    if (S.drive < -1e8) S.drive = S.t - 60;
    if (S.giant.pose !== 'doorway' && S.giant.pose !== 'stroke') {
      this.giantPose('doorway', MARKS['doorway-seat'], true);
    }
    if (S.form !== 'under' && S.form !== 'freed') this.setForm('under', settled);
  }

  /** a formation OWNS everyone it places — including Ulysses, so a stale
   *  personal mark cannot pin him to a spot the story has left */
  setForm(name, snap) {
    const S = this.state;
    S.form = name;
    S.snap = !!snap || this.st.reduced;
    this.uMark = null;
  }

  uTo(at, kind, snap) {
    /* Ulysses off the formation grid: his own mark outranks the form */
    this.uMark = { at: at.slice(), kind };
    if (snap || this.st.reduced) this.state.snap = true;
  }

  giantPose(pose, at, snap) {
    const G = this.state.giant;
    G.walk = null; G.next = null;
    G.pose = pose;
    if (at) { G.x = at[0]; G.y = at[1]; }
    if (!snap && !this.st.reduced) {
      /* short slides are walked by the step's damp; long ones were all given
         explicit paths (giantWalk) — a 7 m giant does not glide */
    }
  }

  giantWalk(path, dur, endPose, settled) {
    const G = this.state.giant;
    if (settled || this.st.reduced) {
      const end = path[path.length - 1];
      G.pose = endPose; G.x = end[0]; G.y = end[1]; G.walk = null;
      return;
    }
    /* s is the STRIP's gait clock (frame = s / pxPerFrame), zeroed at the
       path head so a walk always starts on frame 0; len/vmax are the honest
       ground-speed law's (WALK_V.giant — the grope is a blind hand-over-hand
       shuffle on its own eased clock, not a stride: no cap, no strip) */
    const grope = path === PATH.giantGrope;
    G.walk = { path, t0: this.state.t, dur, endPose,
               s: 0, len: pathLen(path),
               vmax: grope ? Infinity : WALK_V.giant };
    G.x = path[0][0]; G.y = path[0][1];
    G.pose = grope ? 'grope' : 'stand';
  }

  /** The pantomimes the unit list names (t0 already rewound when settled):
   *    entry      ii-00, 5 s   the men slip in past the empty pens (K1)
   *    return     ii-03, 7 s   the giant in under the load; the men scatter
   *    milking    ii-05, 4 s   the working lean at the seat (K7/K8)
   *    seize      x3,    6 s   THE MEAL — identical at the giant-seat mark
   *    flock-out  iii-02, 5 s  stone ajar, the flock streams, he goes with it
   *    stake-make iii-04, 6 s  the montage at the club; the char pulse
   *    flock-in   iii-06, 6 s  ALL of them driven in; two parked outside
   *    collapse   iii-13, 6 s  the neck goes back; the sick-turn in shadow
   *    lash-trios v-02,  5 s   rams lashed in threes; the men go under
   *    free-men   v-11,  6 s   out from under; each man cut free            */
  startSeg(name, dur, t0) {
    const S = this.state;
    const settled = t0 <= S.t - dur;    // stage rewound t0 by dur (WIRING §2)
    S.seg = { name, t0, dur };
    if (name === 'entry') {
      this.setForm('entry', settled);
    } else if (name === 'return') {
      this.giantWalk(PATH.giantIn, dur * 0.8, 'seat', settled);
    } else if (name === 'seize') {
      /* THE MEAL: one decrement per staging, always at the same beat of the
         same curve; the victims are the two highest-numbered men alive when
         the clutch begins — fixed HERE so the count cannot shift mid-seg */
      S.seizeLatched = false;
      S.seizeBase = Math.max(0, CREW_N - 2 * S.meals);
    } else if (name === 'flock-out') {
      S.flock = { mode: 'out', t0, dur };
      this.giantWalk(PATH.giantOut, dur * 0.72, 'away', settled);
    } else if (name === 'flock-in') {
      S.flock = { mode: 'in', t0, dur };
      S.parked = true;                  // recorded for the snapshot; no ram
                                        // actor mounts before Beat V (E1)
      this.giantWalk(PATH.giantIn, dur * 0.8, 'seat', settled);
      this.setForm('huddle', settled);  // the men hide as the wretch comes back
    } else if (name === 'collapse') {
      /* the seg owns the drink -> sprawl transition; cave-embers (same unit)
         has already said where it ends */
      S.giant.next = 'sprawl';
    } else if (name === 'lash-trios') {
      this.beatV(settled);              // the leaf-4 correction rides the seg
    } else if (name === 'free-men') {
      this.beatV(true);
      this.setForm('freed', settled);
    }
  }

  /* ---- the painted-state machine ---------------------------------------- */
  stateGo(to, settled) {
    const S = this.state;
    if (S.stateName === to && !S.swap) return;
    const from = S.swap ? S.swap.to : S.stateName;
    if (from === to) return;
    const dip = SHUT_FAMILY.has(from) && SHUT_FAMILY.has(to);   // the drift law
    const dur = dip ? SWAP.dark : SWAP.lit;
    /* the incoming plate goes to the TOP of the plate group and fades in;
       stateName stays the OLD state until the swap lands (stepState) */
    this.plateWrap.appendChild(this.plates[to]);
    S.swap = { from, to, t0: settled ? S.t - dur : S.t, dur,
               dip: dip && !settled };
  }

  stepState(t) {
    const S = this.state;
    let k = 1, veil = 0;
    if (S.swap) {
      k = clamp01((t - S.swap.t0) / S.swap.dur);
      this.plates[S.swap.to].style.opacity = easeInOut(k).toFixed(3);
      if (S.swap.dip) veil = SWAP.veil * Math.sin(Math.PI * k);
      if (k >= 1) {
        for (const [name, e] of Object.entries(this.plates)) {
          e.style.opacity = name === S.swap.to || name === 'master' ? '1' : '0';
        }
        S.stateName = S.swap.to;
        S.swap = null;
      }
    }
    this.swapK = k;
    this.veilK = veil;
    /* the channel gains, crossfaded with the plates */
    const from = LIGHT[S.swap ? S.swap.from : S.stateName];
    const to = LIGHT[S.swap ? S.swap.to : S.stateName];
    const g = {};
    for (const ch of ['lampL', 'lampR', 'mouth', 'fire', 'embers', 'fog']) {
      g[ch] = lerp(from[ch], to[ch], easeInOut(k));
    }
    return g;
  }

  /* ---- one fixed step ----------------------------------------------------- */
  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    const dim = ctx.dim;
    const drive = this.ruseT();

    const g = this.stepState(t);
    this.gains = g;
    this.scrim.style.opacity = (dim * DIM_SCRIM).toFixed(3);

    /* the settling boom, cued once on the shut swap's own clock */
    if (S.boomAt > -1e8 && t >= S.boomAt) { this.st.cue('boom'); S.boomAt = -1e9; }

    /* ---- the light ------------------------------------------------------ *
     * G4's law rides the embers channel: the coals brighten with the hold
     * (watermark law) and stay lit once the drive has fired. The mouth
     * channel takes a brief lift while the stone stands ajar for the flock
     * (iii-02 / iii-06 — the light dies as the quiver-lid claps to). */
    const heat = this.heat();
    const flockAjar = this.flockAjarK(t);
    for (const e of EMIS) {
      let gain = g[e.id];
      if (e.id === 'embers') gain = Math.min(1.8, gain + heat * 1.4);
      if (e.id === 'mouth') gain = Math.max(gain, 0.55 * flockAjar);
      const a = gain * (1 + amb * e.amp * Math.sin(2 * Math.PI * t / e.per));
      this.emis[e.id].style.opacity = (a * (1 - 0.55 * dim)).toFixed(3);
    }
    /* the blaze's own screen card rides the fire channel; the lamp/mouth
       card carries all three cool sources in one bitmap, so its floor is
       the always-lit lanterns and only its mouth share dims (declared
       compromise — the card cannot split its sources) */
    this.bloomFire.style.opacity =
      (g.fire * (1 + amb * 0.4 * Math.sin(2 * Math.PI * t / 3.1)) * (1 - 0.55 * dim))
        .toFixed(3);
    this.bloom.style.opacity =
      ((0.55 + 0.45 * g.mouth) * (1 - 0.55 * dim)).toFixed(3);
    const F = LAYER.fog;
    const driftAmp = F.driftPxPerSec * F.per / (2 * Math.PI);
    this.fog.style.transform =
      `translateX(${(amb * driftAmp * Math.sin(2 * Math.PI * t / F.per)).toFixed(2)}px)`;
    this.fog.style.opacity =
      (g.fog * F.baseOpacity * (1 + amb * 0.14 * Math.sin(2 * Math.PI * t / 19.0)) *
       (1 - 0.55 * dim)).toFixed(3);

    /* ---- the neighbours (O.10): lamplight through the rim seams --------- */
    this.stepSeams(t, drive);

    /* ---- the machines ---------------------------------------------------- */
    this.stepBowl(t);
    this.stepDrive(t, drive, amb);
    this.stepSword(t);
    this.stepStake(t, drive, heat);

    /* ---- the troupe, the giant, the flock -------------------------------- */
    this.stepGiant(t, dt, amb);
    this.stepTroupe(t, dt, amb);
    this.stepFlock(t, amb);
    this.sortActors();

    /* the veil goes over EVERYTHING — the dark the shut swaps hide in */
    this.veil.style.opacity = this.veilK.toFixed(3);

    if (S.seg && t - S.seg.t0 >= S.seg.dur) S.seg = null;
  }

  /** the stake tip's heat: the live hold while G4 runs (watermark law), full
   *  while the eye is being put out, cooling once the point is flung */
  heat() {
    const d = this.ruseT();
    if (d !== null) {
      return d < DRIVE.fright ? 1
        : Math.max(0, 1 - (d - DRIVE.fright) / 2.5);
    }
    const S = this.state;
    return S.holdMode === 'embers' && S.heatArmed > -1e8 ? S.holdK : 0;
  }

  /** the mouth-ajar lift while a flock seg is crossing the threshold */
  flockAjarK(t) {
    const S = this.state;
    if (!S.flock || S.flock.mode === 'escape') return 0;
    const k = clamp01((t - S.flock.t0) / S.flock.dur);
    return k >= 1 ? 0 : Math.sin(Math.PI * k);
  }

  stepSeams(t, drive) {
    const S = this.state;
    for (const [i, s] of SEAMS.entries()) {
      let a = 0;
      if (!S.seamsSnuffed && drive !== null) {
        const up = clamp01((drive - s.rise) / 1.8);
        const down = clamp01((drive - s.recede) / 2.4);
        a = easeOut(up) * (1 - easeInOut(down));
      }
      this.seamN[i].style.opacity =
        (a * (0.8 + 0.2 * Math.sin(2 * Math.PI * t / 3.3 + i))).toFixed(3);
    }
  }

  /* ---- G3: the bowl, and the three pours (O.7) --------------------------- */
  stepBowl(t) {
    const S = this.state;
    const up = S.holdMode === 'bowl' && this.uMark && this.uMark.kind === 'offer';
    if (!up) {
      this.bowlN.style.opacity = '0';
      this.bowlFill.style.opacity = '0';
      return;
    }
    const at = HOLD_AT.bowl;
    pinCut(this.bowlN, ART.bowl, [at[0], at[1] + 6], PROP_H.bowl);
    this.bowlN.style.opacity = this.pose.u.op.toFixed(3);
    /* THE FILL, a pure piecewise function of the bowl's clock: pour 1 is the
       reader's own hold; each drain window empties it; each refill (the two
       pantomime pours, on the autos that follow) raises it again — three
       fills, three heedless drains (O.7). */
    const d = S.pour > -1e8 ? t - S.pour : -1;
    let fill;
    if (d < 0) fill = S.holdK;                              // pour 1 IS the hold
    else {
      const [d1, d2, d3] = POURS.drains, [r2, r3] = POURS.refills;
      const drain = ([a, b]) => 1 - clamp01((d - a) / (b - a));
      if (d < d1[1]) fill = drain(d1);
      else if (d < r2) fill = 0;
      else if (d < d2[1]) fill = Math.min(clamp01((d - r2) / 0.5), drain(d2));
      else if (d < r3) fill = 0;
      else if (d < d3[1]) fill = Math.min(clamp01((d - r3) / 0.5), drain(d3));
      else fill = 0;
    }
    const w = 15 * clamp01(fill);
    box(this.bowlFill, at[0] - w / 2, at[1] - 4, w, 6);
    this.bowlFill.style.opacity = (0.9 * clamp01(fill) * this.pose.u.op).toFixed(3);
    this.bowlFillK = clamp01(fill);
    /* the two pantomime pours are HEARD where they are staged (live only —
       a settled pour clock lands past both thresholds before any step) */
    if (S.pour > -1e8) {
      for (const r of POURS.refills) {
        if (S.pourPrev >= 0 && S.pourPrev < r && d >= r && d < r + 2) {
          this.st.cue('pour');
        }
      }
      S.pourPrev = d;
    }
  }

  /* ---- G4 + the blinding: shake, steam, the pluck ------------------------ */
  stepDrive(t, drive, amb) {
    /* screen shake at the hiss and the yell — story motion, small and decaying */
    let shake = 0;
    if (drive !== null) {
      const s1 = Math.max(0, 1 - (drive - DRIVE.hiss) / 1.3);
      const s2 = Math.max(0, 1 - (drive - DRIVE.fright) / 1.0);
      if (drive >= DRIVE.hiss) shake += 3.2 * s1;
      if (drive >= DRIVE.fright) shake += 2.0 * s2;
    }
    this.root.style.transform = shake > 0.02
      ? `translate(${(shake * Math.sin(t * 61)).toFixed(2)}px,` +
        `${(shake * 0.7 * Math.sin(t * 53 + 1.3)).toFixed(2)}px)`
      : 'none';
    const st = drive === null ? 0
      : clamp01((drive - DRIVE.hiss) / 0.7) * (1 - clamp01((drive - DRIVE.hiss - 2.6) / 1.6));
    this.steam.style.opacity = (st * (0.8 + 0.2 * amb * Math.sin(t * 9))).toFixed(3);
    /* the fright: they scatter — once, on the clock's own beat, and ONLY in
       its live window: a jump that lands with a long-finished drive (the
       Beat-V corrections date it 40-60 s back) latches the flag without
       re-scattering a formation a later act has already stated */
    const S = this.state;
    if (drive !== null && drive >= DRIVE.fright && !S.frightDone) {
      S.frightDone = true;
      if (drive < DRIVE.fright + 2.5) this.setForm('huddle', false);
    }
  }

  /* ---- G2: the drawn blade that stops (O.5) ------------------------------ */
  stepSword(t) {
    const S = this.state;
    const U = this.pose.u;
    const atMark = this.targetLive('sword') || (this.swordT() !== null);
    if (!atMark || U.op < 0.05) {
      this.swordN.style.opacity = '0';
      this.swordGlint.style.opacity = '0';
      return;
    }
    const hip = [U.x + (U.flip ? -3 : 3), U.y - GATES.sword.hipLift];
    const d = this.swordT();
    /* the glint breathes at the hip until the draw; the drawn blade rises,
       STOPS mid-air, and goes back unheard */
    let lift = 0, rot = 0, show = 0;
    if (d !== null) {
      const up = easeOut(clamp01(d / SWORD.rise));
      const back = easeInOut(clamp01((d - SWORD.hang) / (SWORD.sheathe - SWORD.hang)));
      lift = 26 * up * (1 - back);
      rot = -34 * up * (1 - back);
      show = d < SWORD.sheathe + 0.4 ? 1 : 0;
    }
    pinCut(this.swordN, ART.sword, [hip[0], hip[1] - lift], PROP_H.sword,
           { flip: U.flip, rot });
    this.swordN.style.opacity = (show * U.op).toFixed(3);
    const gr = 16;
    box(this.swordGlint, hip[0] - gr, hip[1] - lift - gr, gr * 2, gr * 2);
    this.swordGlint.style.opacity =
      (U.op * (d === null ? 0.35 + 0.3 * Math.max(0, Math.sin(2 * Math.PI * t / 2.3))
                          : 0.7 * show)).toFixed(3);
  }

  /* ---- the stake's seven lives ------------------------------------------- *
   * hidden (default) -> the hide slide (iii-05) -> gone under the dung ->
   * heating in the coals (G4, tip pinned on the embers anchor, glow ∝ hold)
   * -> the drive (tip pinned on the EYE, the auger twist) -> plucked and
   * flung at the fright -> lying spent by the sprawl. */
  stepStake(t, drive, heat) {
    const S = this.state;
    const plain = this.stakeN, glow = this.stakeGlowN;
    let pOp = 0, gOp = 0;
    if (S.hide > -1e8 && t - S.hide < 2.2 && S.heatArmed < -1e8) {
      /* the slide: in from the lots circle, under the painted dung flecks */
      const k = easeInOut(clamp01((t - S.hide) / 2.2));
      pinCut(plain, ART.stake, [lerp(676, 748, k), lerp(516, 498, k)],
             PROP_H.stakeW * (592 / 1217), { rot: 4 });
      pOp = 1 - clamp01((k - 0.75) / 0.25);       // it goes UNDER the litter
    } else if (S.heatArmed > -1e8 && (drive === null || drive < DRIVE.fright)) {
      /* heating: TIP pinned on the measured coals; driving: TIP pinned on
         the eye at the sprawl head, the shaft turning — the auger (O.9) */
      const at = drive === null ? HOLD_AT.embers : EYE;
      const twist = drive === null ? 0
        : 6 * Math.sin(2 * Math.PI * drive / 1.1) *
          (1 - clamp01((drive - DRIVE.hiss) / 2.0) * 0.6);
      /* both cuts pinned by their MEASURED tips on the point that matters;
         the glow rides the heat over the plain cut (watermark law) while it
         heats — but THE DRIVE DRAWS THE GLOWING CUT ALONE (E2): the two
         arts carry opposite diagonals, overlapped they read as crossed
         sticks, and at full heat the red-hot stake IS the glowing cut */
      pinCut(glow, GLOW_TIP, at, PROP_H.stakeW * (582 / 1143),
             { rot: -8 + twist });
      gOp = heat;
      if (drive === null) {
        pinCut(plain, STAKE_TIP, at, PROP_H.stakeW * (592 / 1217),
               { rot: -8 + twist });
        pOp = 1;
      }
    } else if (drive !== null && drive >= DRIVE.fright) {
      /* plucked and flung — it lands by the sprawl and lies there */
      const k = easeOut(clamp01((drive - DRIVE.fright) / 0.9));
      pinCut(plain, ART.stake,
             [lerp(EYE[0], 700, k), lerp(EYE[1], 548, k) - Math.sin(Math.PI * k) * 30],
             PROP_H.stakeW * (592 / 1217), { rot: -8 + 40 * k });
      pOp = 1;
    }
    plain.style.opacity = pOp.toFixed(3);
    glow.style.opacity = gOp.toFixed(3);      // its own life: the drive draws
    this.stakeGlowOp = gOp;                   // the glowing cut alone (E2)
  }

  /* ---- the giant ----------------------------------------------------------- */
  stepGiant(t, dt, amb) {
    const S = this.state, G = S.giant;
    const seg = S.seg;
    const segK = seg ? clamp01((t - seg.t0) / seg.dur) : null;

    /* the walks (paths swept clear of the hearth), ARC-PARAMETERISED against
       the honest ground speed: the eased profile ASKS for an arc length, the
       gait GRANTS at most vmax x dt of it — the planted foot glides at
       ground speed by construction, so the cap IS the anti-skate law, and a
       short seg cannot make a 7 m giant sprint. The arc `s` is the strip's
       own frame source (distance drives the frame, not time). The walk ends
       when the PATH is spent, not the clock: a capped walk hands back a beat
       late instead of popping to the end. */
    if (G.walk) {
      const W = G.walk;
      const k = clamp01((t - W.t0) / W.dur);
      W.s = Math.min(easeInOut(k) * W.len, W.s + W.vmax * dt);
      const p = alongPathArc(W.path, W.s);
      G.x = p[0]; G.y = p[1];
      if (k >= 1 && W.s >= W.len - 1e-6) {
        const end = W.endPose;
        G.walk = null;
        if (end === 'away') G.pose = 'away';
        else this.giantPose(end, null, true);
      }
    }

    /* THE MEAL, identical x3 (O.6): the clutch at the giant-seat mark. The
       curve below is the staging — the same lunge, the same held clutch, the
       same return, whichever meal this is. */
    if (seg && seg.name === 'seize') {
      const k = segK;
      const M = MARKS['giant-seat'];
      const lunge = easeInOut(clamp01(k / 0.18)) * (1 - easeInOut(clamp01((k - 0.55) / 0.3)));
      G.x = M[0] + 58 * lunge;
      G.y = M[1] + 8 * lunge;
      G.pose = k < 0.06 || k > 0.9 ? 'seat' : 'clutch';
      if (!S.seizeLatched && k >= 0.4) { S.seizeLatched = true; S.meals++; }
    }

    /* the collapse (iii-13): the neck goes back, then the slide to the mark */
    if (seg && seg.name === 'collapse') {
      const k = segK;
      const M = MARKS['giant-seat'];
      if (k < 0.5) { G.pose = 'drink'; G.x = M[0]; G.y = M[1]; }
      else {
        G.pose = 'sprawl';
        const e = easeInOut((k - 0.5) / 0.5);
        G.x = lerp(M[0], SPRAWL.at[0], e);
        G.y = lerp(M[1], SPRAWL.at[1], e);
      }
      if (k >= 1) { G.pose = 'sprawl'; G.x = SPRAWL.at[0]; G.y = SPRAWL.at[1]; }
    } else if (G.next === 'sprawl' && !seg && !G.walk) {
      /* ii-10: the sprawl follows the seize — he tips over where he sat and
         settles down among the sheep, a short eased slide in the ember dark */
      G.next = null;
      G.pose = 'sprawl';
      const slide = [[G.x, G.y], SPRAWL.at];      // a tip-over, not a stride:
      G.walk = { path: slide, t0: t, dur: 1.2,    // no cap, no strip
                 endPose: 'sprawl', s: 0, len: pathLen(slide), vmax: Infinity };
    }

    /* the pours' pantomime (O.7): each drain is the drink pose; the sway
       grows once the wine is in — all on the bowl's own clock */
    let rot = 0;
    if (S.pour > -1e8 && (G.pose === 'seat' || G.pose === 'drink')) {
      const d = t - S.pour;
      let drinking = false;
      for (const [a, b] of POURS.drains) if (d >= a && d <= b) drinking = true;
      G.pose = drinking ? 'drink' : 'seat';
      if (d >= POURS.swayFrom) {
        rot = 5.5 * clamp01((d - POURS.swayFrom) / 3.0) *
              Math.sin(2 * Math.PI * (d - POURS.swayFrom) / 3.4);
      }
    }
    /* the milking lean (ii-05, K7/K8): the working cycle at the seat */
    if (seg && seg.name === 'milking' && G.pose === 'seat') {
      rot = 3.5 * Math.sin(2 * Math.PI * segK * 2.5) * Math.sin(Math.PI * segK);
    }

    /* THE STRIDING GIANT (STRIPS.md #1): while a stand-pose walk runs, the
       strip IS the giant and every cut goes dark — the Beat II entrance, the
       flock-out exit, the flock-in return, all on the one gait clock. The
       swap to the arrival pose lands ON the landing frame (walk end above).
       Facing follows the path's own direction (authored facing right). */
    const walking = !!(G.walk && G.pose === 'stand');
    this.giantWalking = walking;
    if (walking) {
      const W = G.walk;
      G.frame = Math.floor(W.s / STRIP.giant.pxPerFrame) % STRIP.giant.n;
      G.flip = W.path[W.path.length - 1][0] < W.path[0][0];
      const b = placeStrip(this.giantStripN, STRIP.giant, [G.x, G.y],
                           GIANT_H.stand, G.frame, { flip: G.flip });
      this.giantStripN.style.opacity = '1';
      this.giantBox = [G.x - (G.flip ? b.w - b.ax : b.ax), G.y - GIANT_H.stand,
                       b.w, b.h].map((v) => +v.toFixed(1));
    } else {
      this.giantStripN.style.opacity = '0';
    }

    /* paint the one live pose; the rest go dark. `doorway` draws the GROPE
       cut seated in the mouth arch — hands spread to catch anyone going out
       with the sheep — at the seated height that fills the aperture. */
    const br = amb * Math.sin(2 * Math.PI * t / 6.2);
    const nodeKey = G.pose === 'doorway' ? 'grope' : G.pose;
    const ARTS = { stand: ART.giantStand, seat: ART.giantSeated,
                   clutch: ART.giantClutch, drink: ART.giantDrink,
                   sprawl: ART.giantSprawl, grope: ART.giantGrope,
                   stroke: ART.giantStroke };
    if (!walking) this.giantBox = null;
    for (const [pose, node] of Object.entries(this.giantN)) {
      if (G.pose === 'away' || pose !== nodeKey || walking) {
        node.style.opacity = '0';
        continue;
      }
      const art = ARTS[pose];
      const h = GIANT_H[G.pose];
      /* the sprawl breathes as a snore — a slow heave, no sway */
      const bob = G.pose === 'sprawl' ? 1.2 * br : 0.8 * br;
      const b = pinCut(node, art, [G.x, G.y], h,
                       { flip: G.pose === 'stroke', bob, rot });
      node.style.opacity = '1';
      this.giantBox = [G.x - (art.pin[0] * h / art.px[1]),
                       G.y - (art.pin[1] * h / art.px[1]), b.w, b.h]
        .map((v) => +v.toFixed(1));
    }
  }

  /* ---- the troupe: formations, segs, damped motion (the shore law) ------- */
  stepTroupe(t, dt, amb) {
    const S = this.state;
    const damp = this.st.damp;
    const crewN = Math.max(0, CREW_N - 2 * S.meals);
    const seg = S.seg;
    const segK = seg ? clamp01((t - seg.t0) / seg.dur) : null;

    /* what the formation wants of each man this frame */
    const spots = FORM[S.form] || FORM.off;
    const want = {};
    for (let i = 0; i < CREW_N; i++) {
      let at = null, carry = false;
      if (S.form === 'stakefive') {
        at = i < 4 ? FORM.stakefive[i] : FORM.huddle[i];   // four step forward
        carry = i < 4;               // carry/drive cuts at the beam, never A-pose (E3)
      } else if (S.form === 'under') {
        at = null;                                          // under the fleeces
      } else if (S.form === 'freed') {
        at = i < 6 ? FORM.freed[i] : null;
      } else {
        at = spots[i] || null;
        carry = S.form === 'racks';
      }
      if (i >= crewN) at = null;                            // the headcount law
      want['c' + i] = at ? { at, vis: 1, carry } : { at: [0, 0], vis: 0, carry };
    }
    /* Ulysses: his own mark outranks the formation. In `under` he STAYS —
       the sling fade below is the only thing that takes him off frame. */
    const uKind = this.uMark ? this.uMark.kind : 'stand';
    let uAt = this.uMark ? this.uMark.at : (U_AT[S.form] || null);
    let uVis = 1;
    if (S.form === 'off' && !this.uMark) uVis = 0;
    /* the ember/drive tableau claims him: the five at the stake */
    if (S.heatArmed > -1e8 && !S.frightDone &&
        (S.holdMode === 'embers' || this.ruseT() !== null)) {
      uAt = U_AT.stakefive; uVis = 1;
      if (S.form !== 'stakefive') this.setForm('stakefive', false);
    }
    /* the sling (G5): he goes under the ram and out of the picture */
    if (S.sling > -1e8 && S.form !== 'freed') {
      uVis = 1 - clamp01((t - S.sling) / 1.6);
    }
    want.u = uAt ? { at: uAt, vis: uVis } : { at: [0, 0], vis: 0 };

    /* the segs write positions DIRECTLY while they run */
    if (seg && segK < 1) {
      if (seg.name === 'entry') {
        /* the men slip in from the threshold, Ulysses at their head (K1) */
        const from = MARKS.entry;
        for (let i = 0; i < CREW_N; i++) {
          const ki = easeInOut(clamp01(segK * 1.5 - i * 0.035));
          const P = this.pose['c' + i], W = want['c' + i];
          if (!W.vis) continue;
          P.x = lerp(from[0] + 8, W.at[0], ki);
          P.y = lerp(from[1], W.at[1], ki);
          P.op = clamp01(segK * 6 - i * 0.1);
          W.vis = -1;
        }
        const ku = easeInOut(clamp01(segK * 1.5));
        this.pose.u.x = lerp(from[0], want.u.at[0], ku);
        this.pose.u.y = lerp(from[1], want.u.at[1], ku);
        this.pose.u.op = clamp01(segK * 6);
        want.u.vis = -1;
      } else if (seg.name === 'seize') {
        /* the two taken: the highest-numbered men alive when the clutch
           began (seizeBase, fixed at startSeg so the mid-seg decrement
           cannot shift them), from their huddle spots into the shadow of
           the clutch — the identical curve, all three meals */
        for (const i of [S.seizeBase - 1, S.seizeBase - 2]) {
          if (i < 0 || i >= CREW_N) continue;
          const P = this.pose['c' + i];
          const from = FORM.huddle[i];
          const k2 = easeInOut(clamp01((segK - 0.12) / 0.3));
          P.x = lerp(from[0], 824, k2);
          P.y = lerp(from[1], 468, k2);
          P.op = 1 - clamp01((segK - 0.3) / 0.16);   // into the shadow
          want['c' + i] = { at: from, vis: -1 };
        }
      } else if (seg.name === 'stake-make') {
        /* the work party at the rim below the club; the others hold the dark */
        for (const [j, at] of WORK_CREW.entries()) {
          const i = j;
          const P = this.pose['c' + i];
          P.x = at[0]; P.y = at[1];
          P.op = clamp01(segK * 5) * (1 - clamp01((segK - 0.92) / 0.08));
          want['c' + i] = { at, vis: -1 };
        }
        this.pose.u.x = U_AT.work[0]; this.pose.u.y = U_AT.work[1];
        this.pose.u.op = 1;
        want.u.vis = -1;
      } else if (seg.name === 'lash-trios') {
        /* they go under, one trio at a time; Ulysses stays for his own gate */
        for (let i = 0; i < CREW_N; i++) {
          const P = this.pose['c' + i];
          P.op = Math.min(P.op, 1 - clamp01((segK - 0.15 - i * 0.09) / 0.25));
          want['c' + i].vis = -1;
        }
      } else if (seg.name === 'free-men') {
        for (let i = 0; i < 6; i++) {
          const P = this.pose['c' + i], at = FORM.freed[i];
          P.x = at[0]; P.y = at[1];
          P.op = clamp01((segK - 0.45 - i * 0.07) / 0.2);
          want['c' + i] = { at, vis: -1 };
        }
        this.pose.u.x = U_AT.freed[0]; this.pose.u.y = U_AT.freed[1];
        this.pose.u.op = clamp01((segK - 0.35) / 0.2);
        want.u.vis = -1;
      }
    }

    /* damped motion toward the formation; SNAP for settled acts and reduced
       motion; FADE-THROUGH for moves too long to walk (the shore law) */
    for (const key of Object.keys(want)) {
      const W = want[key];
      if (W.vis === -1) continue;
      const P = this.pose[key];
      if (S.snap) {
        if (W.vis) { P.x = W.at[0]; P.y = W.at[1]; }
        P.op = W.vis;
        continue;
      }
      if (!W.vis) { P.op = damp(P.op, 0, 5.0, dt); continue; }
      const far = Math.hypot(P.x - W.at[0], P.y - W.at[1]) > 250;
      if (P.op < 0.06) { P.x = W.at[0]; P.y = W.at[1]; }
      if (far && P.op >= 0.06) P.op = damp(P.op, 0, 5.0, dt);
      else {
        /* the damp shapes the tail; the cap keeps the ground speed a
           WALKING speed (WALK_V.man — the anti-skate law's own bound) */
        walkToward(P, W.at[0], W.at[1], 2.2, WALK_V.man, dt);
        P.op = damp(P.op, W.vis, 4.0, dt);
      }
    }
    if (S.snap) S.snap = false;

    /* paint the men: THE STRIDE swaps stand cut -> walk strip while a man is
       actually covering ground (the room.js swap law) — the entry file, the
       scatter to the far dark, the freed men. A CARRIED load keeps the carry
       cut (STRIPS.md: the strip replaces STAND-cut travel only) and a SEIZED
       man is dragged, not walking. */
    const dragged = !!(seg && seg.name === 'seize');
    for (let i = 0; i < CREW_N; i++) {
      const P = this.pose['c' + i];
      this.trackStride(P, dt);
      const carry = (S.form === 'racks' ||
                     (S.form === 'stakefive' && i < 4)) && P.op > 0.05;
      const striding = P.walking && !carry && !dragged;
      const bob = amb * 0.5 * Math.sin(2 * Math.PI * t / 5.3 + i * 1.1);
      const stand = i % 2 ? ART.crewB : ART.crewA;
      pinCut(this.crew[i], stand, [P.x, P.y], SCALE.crew, { bob, flip: i % 3 === 1 });
      pinCut(this.carry[i], ART.crewCarry, [P.x, P.y], SCALE.crew * 0.96, { bob });
      this.crew[i].style.opacity = (carry || striding ? 0 : P.op).toFixed(3);
      this.carry[i].style.opacity = (carry ? P.op : 0).toFixed(3);
      if (striding) {
        /* variety law: per-man frame phase (+i), flip from his own travel */
        P.frame = (Math.floor(P.dist / STRIP.crew.pxPerFrame) + i) % STRIP.crew.n;
        placeStrip(this.crewStripN[i], STRIP.crew, [P.x, P.y], SCALE.crew,
                   P.frame, { flip: P.face < 0 });
        this.crewStripN[i].style.opacity = P.op.toFixed(3);
      } else {
        this.crewStripN[i].style.opacity = '0';
      }
      P.carry = carry;
      P.striding = striding;
    }
    /* Ulysses: the pose the moment asks for — offer at the bowl, the hip
       stance at the sword, the lean at the stake, the walk between marks */
    const U = this.pose.u;
    const goal = want.u.vis === -1 ? [U.x, U.y] : want.u.at;
    const moving = want.u.vis !== -1 && U.op > 0.5 &&
      Math.hypot(U.x - goal[0], U.y - goal[1]) > 3;
    let kind = uKind;
    if (S.heatArmed > -1e8 && !S.frightDone &&
        (S.holdMode === 'embers' || this.ruseT() !== null)) kind = 'drive';
    if (moving) kind = 'walk';
    U.kind = kind;
    /* THE AUGER (STRIPS.md #3, O.9's carrier): while the blinding clock runs
       and before the fright, the braced twist strip IS the driver — hands
       and shoulders rolling the grip on the verb's own clock, frame advance
       MONOTONE (one-way drill: 4 frames / 1.1 s, never ping-pong). The heat
       phase (drive null) holds today's static drive cut unchanged, and the
       pluck-and-hurl reverts to it at the fright. E2's law is untouched:
       the stake itself is still the glowing cut alone, pinned tip-on-eye. */
    const drive = this.ruseT();
    const twisting = kind === 'drive' && drive !== null && drive < DRIVE.fright;
    this.twisting = twisting;
    const bobU = amb * 0.4 * Math.sin(2 * Math.PI * t / 4.6);
    if (twisting) {
      U.frame = Math.floor(drive / (STRIP.twist.period / STRIP.twist.n))
                % STRIP.twist.n;
      const b = placeStrip(this.twistN, STRIP.twist, [U.x, U.y], 66, U.frame);
      this.twistN.style.opacity = U.op.toFixed(3);
      this.uBox = [U.x - b.ax, U.y - 66, b.w, b.h].map((v) => +v.toFixed(1));
    } else {
      this.twistN.style.opacity = '0';
    }
    for (const [pose, node] of Object.entries(this.uN)) {
      if (pose !== kind || twisting) { node.style.opacity = '0'; continue; }
      const art = { stand: ART.ulyssesStand, walk: ART.ulyssesWalk,
                    offer: ART.ulyssesOffer, sword: ART.ulyssesSword,
                    drive: ART.ulyssesDrive }[pose];
      const h = pose === 'drive' ? 66 : SCALE.ulysses;
      const b = pinCut(node, art, [U.x, U.y], h, { bob: bobU, flip: U.flip });
      node.style.opacity = U.op.toFixed(3);
      this.uBox = [U.x - art.pin[0] * h / art.px[1],
                   U.y - art.pin[1] * h / art.px[1], b.w, b.h]
        .map((v) => +v.toFixed(1));
    }
  }

  /** THE STRIDE, measured (the shore troupe law's own instrument): the pose
   *  moved this frame at walking speed, or it stands. Distance accumulates
   *  while the stride runs (the strip's frame source), facing follows the
   *  travel, and a teleport resets the gait clock. */
  trackStride(P, dt) {
    const dd = P.lx === null ? 0 : Math.hypot(P.x - P.lx, P.y - P.ly);
    const stride = P.op > 0.3 && dd < STRIDE_TELEPORT &&
                   dd / Math.max(dt, 1e-6) > STRIDE_MIN_SPEED;
    if (stride) {
      P.dist += dd;
      if (Math.abs(P.x - P.lx) > 0.01) P.face = P.x > P.lx ? 1 : -1;
    } else if (!(P.op > 0.3) || dd >= STRIDE_TELEPORT) {
      P.dist = 0;
    }
    P.walking = stride;
    P.lx = P.x; P.ly = P.y;
  }

  /* ---- the flock and the rams (O.11) -------------------------------------- */
  stepFlock(t, amb) {
    const S = this.state;
    const fl = S.flock;
    const k = fl ? clamp01((t - fl.t0) / fl.dur) : null;

    /* the walkers: RAM ACTORS MOUNT AT THE DAWN ESCAPE ONLY (round-2 eye
       review E1 — no ram cutout before Beat V). The Beat-III flock segs
       (iii-02 out, iii-06 in) keep their mouth-ajar light lift (flockAjarK)
       and the giant's own walk, but stage no cutouts; iii-06's overfull
       pens are a recorded fact (S.parked), never a parked actor. */
    /* THE TROT (STRIPS.md #5): the dawn stream's walkers ride the ram strip,
       frame from each walker's own travelled distance (+i phase from the
       existing stagger, so the herd is never in lockstep). The 1.7 s bob is
       REMOVED while the strip runs — gait and bob together is double motion.
       The strip is AUTHORED LEFT, the stream's own way: no flip. */
    for (const [i, node] of this.rams.entries()) {
      let at = null;
      const gait = this.ramGait[i];
      if (fl && k < 1 && fl.mode === 'escape') {
        const ki = clamp01((k - i * 0.07) / 0.6);
        if (ki > 0 && ki < 1) {
          at = alongPath(PATH.flockOut, easeInOut(ki));
          at[1] += (i % 3 - 1) * 6;
        }
      }
      if (!at) {
        node.style.opacity = '0';
        gait.dist = 0; gait.lx = null; gait.at = null;
        continue;
      }
      const dd = gait.lx === null ? 0 : Math.hypot(at[0] - gait.lx, at[1] - gait.ly);
      gait.dist = dd < STRIDE_TELEPORT ? gait.dist + dd : 0;
      gait.lx = at[0]; gait.ly = at[1]; gait.at = at.slice();
      gait.frame = (Math.floor(gait.dist / STRIP.ram.pxPerFrame) + i) % STRIP.ram.n;
      placeStrip(node, STRIP.ram, at, RAM_H.walk, gait.frame);
      node.style.opacity = '1';
    }

    /* the lashed trios: they appear at the lash, follow at the escape */
    for (const [i, node] of this.pairs.entries()) {
      let at = null, op = 0;
      const seg = S.seg;
      if (seg && seg.name === 'lash-trios') {
        const sk = clamp01((t - seg.t0) / seg.dur);
        at = TRIOS[i];
        op = clamp01((sk - 0.25 - i * 0.25) / 0.3);
      } else if (fl && fl.mode === 'escape') {
        const ki = clamp01((k - 0.32 - i * 0.12) / 0.5);
        if (ki > 0 && ki < 1) {
          at = alongPath(PATH.flockOut, easeInOut(ki));
          op = ki < 0.92 ? 1 : 1 - (ki - 0.92) / 0.08;
        }
      } else if (S.form === 'under' && S.giant.blinded && !fl) {
        at = TRIOS[i]; op = 1;                     // lashed, waiting for dawn
      }
      if (!at) { node.style.opacity = '0'; continue; }
      pinCut(node, ART.ramPairSlung, at, RAM_H.pair,
             { flip: !!(fl && fl.mode === 'escape') });
      node.style.opacity = op.toFixed(3);
    }

    /* THE GREAT RAM: staged at the rail (G5), slung under the reader's
       click, last of all across the floor, halted under the palm, and out.
       Position by PRIORITY, never by feedback from its own last frame:
       clear-of-the-cave > the free-men exit > pinned at the mouth > the
       escape path > the rail. */
    const great = this.ramGreatN, slung = this.ramSlungN;
    let gAt = null, slungK = 0;
    if (S.ramOn) {
      slungK = S.sling > -1e8 ? clamp01((t - S.sling) / 1.4) : 0;
      const seg = S.seg;
      if (S.ramHome) {
        gAt = S.ramHome.slice();
      } else if (seg && seg.name === 'free-men') {
        const sk = clamp01((t - seg.t0) / seg.dur);
        if (sk < 0.4) {
          const e = easeInOut(sk / 0.4);
          gAt = [lerp(MARKS['ram-at-mouth'][0], 466, e),
                 lerp(MARKS['ram-at-mouth'][1], 452, e)];
        } else {
          gAt = [466, 452];
          S.ramHome = [466, 452];        // he trots clear, and STAYS clear
          S.sling = -1e9;                // …with the man off him
          slungK = 0;
        }
      } else if (S.ramPinned) {
        const e = easeInOut(clamp01((t - S.ramPinned.t0) / 1.2));
        gAt = [lerp(S.ramPinned.from[0], MARKS['ram-at-mouth'][0], e),
               lerp(S.ramPinned.from[1], MARKS['ram-at-mouth'][1], e)];
      } else if (fl && fl.mode === 'escape') {
        const ki = clamp01((k - 0.55) / 0.4);
        gAt = ki <= 0 ? MARKS['ram-stand'].slice()
                      : alongPath(PATH.ramEscape, easeInOut(ki));
      } else {
        gAt = MARKS['ram-stand'].slice();
      }
    }
    if (!gAt) {
      great.style.opacity = '0'; slung.style.opacity = '0';
      this.ramBox = null;
    } else {
      const bob = amb * 0.4 * Math.sin(2 * Math.PI * t / 2.1);
      const b1 = pinCut(great, ART.ramGreat, gAt, RAM_H.great, { bob });
      pinCut(slung, ART.ramGreatSlung, gAt, RAM_H.greatSlung, { bob });
      great.style.opacity = (1 - easeInOut(slungK)).toFixed(3);
      slung.style.opacity = easeInOut(slungK).toFixed(3);
      this.ramBox = [gAt[0] - ART.ramGreat.pin[0] * RAM_H.great / ART.ramGreat.px[1],
                     gAt[1] - ART.ramGreat.pin[1] * RAM_H.great / ART.ramGreat.px[1],
                     b1.w, b1.h].map((v) => +v.toFixed(1));
      S.ramAt = gAt;                     // the gate anchor rides the actor
    }
  }

  /** THE PAINTER'S ORDER IS THE DEPTH ORDER (church F5), decided every frame
   *  off the baseline each figure is standing on: lower is nearer, nearer is
   *  painted later. Every pose node of a figure travels with its mark. */
  sortActors() {
    const S = this.state;
    const entries = [];
    const G = S.giant;
    entries.push({ y: G.pose === 'away' ? -1e9 : G.y,
                   nodes: [...Object.values(this.giantN), this.giantStripN] });
    entries.push({ y: this.pose.u.y + 0.01,
                   nodes: [...Object.values(this.uN), this.twistN, this.bowlN,
                           this.bowlFill, this.swordN, this.swordGlint] });
    for (let i = 0; i < CREW_N; i++) {
      entries.push({ y: this.pose['c' + i].y,
                     nodes: [this.crew[i], this.carry[i], this.crewStripN[i]] });
    }
    for (const [i, n] of this.rams.entries()) {
      entries.push({ y: parseFloat(n.style.top || '0') + parseFloat(n.style.height || '0'),
                     nodes: [n], live: +n.style.opacity > 0, i });
    }
    for (const n of this.pairs) {
      entries.push({ y: parseFloat(n.style.top || '0') + parseFloat(n.style.height || '0'),
                     nodes: [n] });
    }
    entries.push({ y: S.ramAt ? S.ramAt[1] : -1e9,
                   nodes: [this.ramGreatN, this.ramSlungN] });
    entries.push({ y: this.stakeY(), nodes: [this.stakeN, this.stakeGlowN] });
    const want = [];
    for (const e of entries.sort((a, b) => a.y - b.y)) want.push(...e.nodes);
    const kids = this.actors.children;
    let same = kids.length === want.length;
    for (let i = 0; same && i < want.length; i++) if (kids[i] !== want[i]) same = false;
    if (same) return;
    for (const n of want) this.actors.appendChild(n);
  }

  stakeY() {
    /* the stake sorts by its own moment: in the coals it lies over the
       hearth; at the drive it lies over the sprawled head (nearer) */
    const d = this.ruseT();
    if (d !== null && d < DRIVE.fright) return SPRAWL.at[1] + 12;
    if (d !== null) return 549;
    return HOLD_AT.embers[1] + 4;
  }

  /* ---- harness --------------------------------------------------------------- */
  drawnBox(node) {
    const l = parseFloat(node.style.left), tp = parseFloat(node.style.top);
    const w = parseFloat(node.style.width), h = parseFloat(node.style.height);
    if (!(w > 0)) return null;
    return [+l.toFixed(1), +tp.toFixed(1), +w.toFixed(1), +h.toFixed(1)];
  }

  /** signed clearance between a box [x,y,w,h] and a rect [x1,y1,x2,y2]:
   *  the smallest axis gap when disjoint, negative overlap depth when not —
   *  the parking law's own number */
  clearance(b, r) {
    if (!b) return null;
    const gx = Math.max(r[0] - (b[0] + b[2]), b[0] - r[2]);
    const gy = Math.max(r[1] - (b[1] + b[3]), b[1] - r[3]);
    return +Math.max(gx, gy).toFixed(1);
  }

  snapshot() {
    const S = this.state;
    const drive = this.ruseT();
    const swordD = this.swordT();
    const crewN = Math.max(0, CREW_N - 2 * S.meals);
    /* the parking law is a SETTLED law: the ii-10 tip-over slide is the
       giant's own pantomime mid-flight, the same exemption the lap's foot
       law gives a running seg — the box (and its clearances) is reported
       once the bulk has LANDED, and every settled frame measures in full */
    const sprawlBox = S.giant.pose === 'sprawl' && !S.giant.walk
      ? this.giantBox : null;
    return {
      /* THE PAINTED STATE and the dark-swap law's own numbers */
      caveState: {
        name: S.swap ? S.swap.to : S.stateName,
        from: S.swap ? S.swap.from : null,
        k: +(this.swapK == null ? 1 : this.swapK).toFixed(3),
        dip: !!(S.swap && S.swap.dip), veil: +(this.veilK || 0).toFixed(3),
        gains: Object.fromEntries(Object.entries(this.gains || {})
          .map(([k2, v]) => [k2, +v.toFixed(3)])),
      },
      seg: S.seg ? { name: S.seg.name,
                     k: +clamp01((S.t - S.seg.t0) / S.seg.dur).toFixed(3) } : null,
      /* THE CLOCKS the lap times against */
      drive: drive === null ? null : {
        t: +drive.toFixed(2),
        phase: drive < DRIVE.auger ? 'heat-drawn' : drive < DRIVE.bore ? 'auger'
             : drive < DRIVE.hiss ? 'bore' : drive < DRIVE.fright ? 'hiss' : 'fright',
      },
      hold: { mode: S.holdMode, k: +S.holdK.toFixed(3),
              anchor: this.holdAnchor(), heat: +this.heat().toFixed(3),
              stakeGlow: +(this.stakeGlowOp || 0).toFixed(3) },
      pours: S.pour < -1e8 ? { n: 0 } : (() => {
        const d = S.t - S.pour;
        const n = 1 + POURS.refills.filter((r) => d >= r).length;
        return { n, t: +d.toFixed(2), swaying: d >= POURS.swayFrom };
      })(),
      sword: { drawn: swordD !== null, t: swordD === null ? null : +swordD.toFixed(2),
               panning: this.camOverride() === 'mouth' },
      neighbours: {
        snuffed: S.seamsSnuffed,
        seams: this.seamN.map((n) => +(+n.style.opacity || 0).toFixed(3)),
      },
      /* THE GATES, the set's own geometry */
      gate: {
        sword: { at: this.targetPlate('sword'), live: this.targetLive('sword') },
        'ram-great': { at: this.targetPlate('ram-great'),
                       live: this.targetLive('ram-great'), box: this.ramBox },
      },
      /* THE GIANT — pose, mark, drawn box; and THE SPRAWL PARKING LAW:
         clearances re-measured every frame against the ledger's pen boxes
         (>= 10 px is the law; negative is the review's own defect) */
      giant: { pose: S.giant.pose, blinded: S.giant.blinded,
               mark: [+S.giant.x.toFixed(1), +S.giant.y.toFixed(1)],
               box: this.giantBox || null },
      sprawl: {
        mark: SPRAWL.at.slice(), ledgerMark: SPRAWL.ledger.slice(),
        eye: EYE.slice(),               // the drive's target — O.9's own law
        box: sprawlBox,
        clear: sprawlBox ? {
          mainPen: this.clearance(sprawlBox, OBJ.mainPen),
          frontPen: this.clearance(sprawlBox, OBJ.frontPen),
          firewood: this.clearance(sprawlBox, OBJ.firewood),
        } : null,
        /* the round-2 restage (E2) re-checked the clearances and put the
           WOODPILE under the same >= 10 law as the pens */
        ok: sprawlBox
          ? this.clearance(sprawlBox, OBJ.mainPen) >= 10 &&
            this.clearance(sprawlBox, OBJ.frontPen) >= 10 &&
            this.clearance(sprawlBox, OBJ.firewood) >= 10
          : null,
      },
      /* THE TROUPE: the headcount law and per-actor drawn boxes */
      cast: {
        formation: S.form, meals: S.meals, crewN,
        ulysses: { mark: [+this.pose.u.x.toFixed(1), +this.pose.u.y.toFixed(1)],
                   op: +this.pose.u.op.toFixed(3), kind: this.pose.u.kind,
                   box: this.uBox || null },
        crew: this.crew.map((node, i) => ({
          mark: [+this.pose['c' + i].x.toFixed(1), +this.pose['c' + i].y.toFixed(1)],
          op: +this.pose['c' + i].op.toFixed(3),
          box: this.drawnBox(this.pose['c' + i].carry ? this.carry[i] : node),
        })),
        onStage: (this.pose.u.op > 0.5 ? 1 : 0) +
                 this.crew.reduce((n, _, i) => n + (this.pose['c' + i].op > 0.5 ? 1 : 0), 0),
      },
      flock: {
        mode: S.flock ? S.flock.mode : null,
        k: S.flock ? +clamp01((S.t - S.flock.t0) / S.flock.dur).toFixed(3) : null,
        parked: S.parked,
        ram: { on: S.ramOn, at: S.ramAt ? S.ramAt.map((v) => +v.toFixed(1)) : null,
               slung: S.sling > -1e8, box: this.ramBox },
      },
      /* THE STRIP PROOF (the sherlock walk law): per live strip, the frame
         and the foot measured off the RENDERED box vs the mark the paint was
         asked for — the lap holds cycling (>= 2 distinct frames, the 'walk
         strip never cycled' gate) and |dx|,|dy| against these */
      strips: {
        giant: this.giantWalking
          ? stripProof(this.st, this.giantStripN, STRIP.giant,
                       S.giant.frame || 0, [S.giant.x, S.giant.y], !!S.giant.flip)
          : null,
        crew: this.crew.map((_, i) => {
          const P = this.pose['c' + i];
          return P.striding
            ? stripProof(this.st, this.crewStripN[i], STRIP.crew, P.frame,
                         [P.x, P.y], P.face < 0)
            : null;
        }),
        twist: this.twisting
          ? stripProof(this.st, this.twistN, STRIP.twist, this.pose.u.frame || 0,
                       [this.pose.u.x, this.pose.u.y], false)
          : null,
        rams: this.rams.map((n, i) => {
          const g = this.ramGait[i];
          return g.at && +n.style.opacity > 0
            ? stripProof(this.st, n, STRIP.ram, g.frame, g.at, false)
            : null;
        }),
      },
      /* the declared leaf-3/leaf-4 ambiguity (header): true while the world
         was staged by a VIRGIN cave-predawn and no Beat-V hook has spoken */
      beatVAmbiguous: (S.swap ? S.swap.to : S.stateName) === 'predawn' &&
                      !S.giant.blinded && S.giant.pose === 'sprawl' &&
                      S.meals === 1,
      dim: { scrim: +(+this.scrim.style.opacity || 0).toFixed(3),
             matrix: DIM_MATRIX.slice(), painted: false },
    };
  }
}

export { FOCUS, MARKS, OBJ, SPRAWL, EYE, EMIS, LIGHT, DIM_MATRIX, SCALE,
         GATES, HOLD_AT, POURS, DRIVE, SEAMS, FORM, PATH, FLOORS };
