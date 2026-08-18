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
 * THE SPRAWL IS HONEST-LENGTH NOW (round-7 placement audit #5, 2026-08-16).
 * The round-2 restage kept the accepted composition (head toward the fire,
 * drive line INTO the eye) but drew the body 202.7 px long against his own
 * standing law of 300 px (43 px/m x 7 m) — one third short, 0.98x a hearth
 * a 7 m body should overshoot 1.46x. The head pin stays (664,546); the cut
 * now draws h 104 -> box [636.6, 443.4, 301.2, 104] — 301 px, -0.06% off
 * the drawn law and -9.5% off the local downstage yardstick (front-pen ewe
 * 47.6 px/m), inside the 12% perspective law. A 301 px body cannot keep the
 * old 10 px X-clearance from every pen on this floor, so the parking law is
 * AMENDED to what it always meant: SUPPORT + OCCLUSION — the BASELINE (the
 * support line, the box bottom at y~547) must lie on open floor (no
 * registered obstacle's box reaches within 8 px of it where they share x),
 * and whatever the box overlaps ABOVE that line (the front pen's corner,
 * the hearth's near stones, the tub, the clay bowl) is a body drawn in
 * front of dressing — the painting's own depth logic, previously argued as
 * the hearth exception, now stated as the law. `sprawl.ok` measures it in
 * the snapshot every frame off the drawn box. The eye — the drive's target
 * — is the same cut point (170.5, 225.9 in cut px) at the new scale:
 * (676, 495).
 *
 * TWO MORE PARKING SWEEPS (lap round 2) + THE ROUND-7 RE-SWEEP: the LOTS
 * CIRCLE arcs right-front of the fire (FORM.lots — respaced round 7 so no
 * neighbour gap is under 14 px against the 27 px bodies, audit #12), and
 * the GROPE walk rises at the sprawl's foot end and takes the back wall
 * (PATH.giantGrope). Round 7 also swept the HUDDLE off the painted bed
 * (audit #1 — the old huddle-far (1160,465) sat INSIDE the bed box), the
 * scheme/suppliant/bowl/sword marks off the hearth rim, the log bundle and
 * the sprawl's belly (audits #2/#3/#6/#7), and gave every damped walk the
 * HEARTH DETOUR (parkedGoal) so no stride crosses the fire ring (#2/#8).
 *
 * THE THREE HOLD/CLOCK MACHINES this set runs (ledger G3/G4 + §6.6 pattern):
 *   G3 the bowl    iii-08 `release` (A7, was `hold`): the ivy bowl FILLS in
 *                  proportion to the hold (holdAnchor rides the raised bowl
 *                  at 700,441) and BANKS on a let-go (rest is allowed). The
 *                  reader's RELEASE past the threshold fires the 'bowl-pour'
 *                  gateAct — THAT is pour 1; pours 2 and 3 are pantomimed on
 *                  the bowl's own clock under the two autos that follow
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
         alongPathArc, walkToward2, gaitProfile, gaitLockProfile, gaitAt,
         gaitBobY, bridgeFrame, bridgeWarp, loopFrame, gradedActor, swapActor }
  from '../setkit.js';
import { STRIPS } from '../strips.js';
import { SHADOWS } from '../shadows.js';
import { HEROCLIP_FILES } from '../heroclips.js';

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

/* the marks, ledger names verbatim — each serves the units it names.
   ROUND-7 PLACEMENT AUDIT (2026-08-16): the marks below ARE the ledger's
   (updated in sync — the ledger is law, no more "kept for the record"
   doubles): huddle-far off the painted bed (#1), scheme off the hearth and
   truly among the pens (#2), suppliant off the log bundle (#3), sword at
   the sleeping THROAT of the honest-length sprawl (#7), lots-circle at the
   drawn circle's own centre (#12), stake-hide at the beam's landed butt
   under the flecks, bowl-offer off the rim (#6), doorway-seat down on the
   threshold floor (#14). */
const MARKS = {
  entry:          [360, 450],    // lit threshold inside the mouth (ii-00, K1)
  'cheese-rack':  [640, 405],    // O.3 tableau centre, laden men (ii-01)
  'huddle-far':   [933, 541],    // the dark floor downstage of the front pen,
                                 // clear of the bed + logsRight (audit #1)
  suppliant:      [690, 512],    // arms wide in the firelight, off the log
                                 // bundle's top (audit #3) and the ring band
  'giant-seat':   [760, 452],    // the working seat by the fire — ALL 3 meals
  milking:        [852, 470],    // the tub + clay bowl cluster (K7/K8, c1, c9)
  'sprawl-head':  [664, 546],    // the head pin of the honest-length sprawl
                                 // (audit #5) — SPRAWL.at rides this
  'sword-ulysses': [680, 554],   // at the sleeping THROAT — 18 px from the
                                 // head pin (audit #7); G2 rides this
  scheme:         [800, 530],    // alone among the pens — downstage of the
                                 // dung flecks, clear of the hearth (audit #2)
  'lots-circle':  [713, 527],    // the drawn circle's centre, right-front of
                                 // the fire (FORM.lots; audit #12)
  'stake-hide':   [782, 496],    // the beam's butt under the painted dung
                                 // flecks (770..800, 485..495)
  'bowl-offer':   [700, 514],    // the walk-to-the-fire stand, downstage of
                                 // the rim (audit #6); G3's mark
  'ram-stand':    [838, 430],    // apart at the front pen's left rail (G5)
  'ram-at-mouth': [395, 438],    // halted under the palm in the doorway
  'doorway-seat': [345, 470],    // seated ON the threshold floor slope, the
                                 // bulk filling the mouth (audit #14)
};

/* the painted objects the parking law is stated against (ledger objects).
   ROUND 7 registers the paint the audit caught unregistered: the second log
   bundle right-front of the hearth (#3), the rim's NW stone spill (#13),
   the bed's logsRight pile (#1), and the tub/bowl as BOXES (#10). */
const OBJ = {
  mainPen:  [775, 290, 1050, 425],
  frontPen: [860, 425, 1090, 525],
  fireRing: [527, 418, 733, 500],
  fireRimNW: [485, 425, 527, 485],   // the rim paint past the box's NW corner
  firewood: [495, 495, 620, 555],
  logBundle: [645, 462, 745, 497],   // the unregistered pile (audit #3)
  mouth:    [290, 250, 405, 415],
  boulderOpen: [455, 330], boulderShut: [355, 325],
  club: { tip: [1097, 200], visibleButt: [1042, 398] },
  bed: [1025, 330, 1240, 500],
  logsRight: [1105, 480, 1180, 520],
  milkTub: [865, 470, 915, 520],
  clayBowl: [805, 505, 860, 535],
};

/* THE HONEST-LENGTH SPRAWL (header; audit #5). `at` is the head pin; h 104
   draws the cut 301.2 px long — the giant's own 7 m at 43 px/m. The eye —
   the drive's target — is the cut's own point (170.5, 225.9) at this scale. */
const SPRAWL = { at: [664, 546], h: 104, ledger: MARKS['sprawl-head'] };
const EYE = [676, 495];

/* THE ROUND-7 SWEEP SUPERSEDES THE +12 px SWEEP (grounding report T2): the
   ledger marks THEMSELVES moved off the ring band / the log bundle, so the
   drawn marks and the ledger marks are one number again. SWEPT is kept as
   the [restage] gate's read surface — identical to MARKS now. */
const SWEPT = { suppliant: MARKS.suppliant, scheme: MARKS.scheme };

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

/* ---- the lenses, ledger names + values VERBATIM ----------------------- *
 * THE CLOSE-UP LAW (owner round, 2026-08-17): character units render their
 * principal >= 30% of panel height (two-shots >= 22%); only headings/
 * arrivals/establishing go wide, max 2 wide per beat after its heading. At
 * 43 px/m the floors bind near k 3.07 (75 px Ulysses) / 2.25 (two-shot) —
 * the failing lenses below are raised/recentred, and four units left the
 * wide they shared for lenses of their own (the split law: a shared lens
 * may not fight two subjects). Dead band >= 0 both orientations. */
const FOCUS = {
  establishing:        [704, 384, 1.0],
  'racks-sweep':       [700, 315, 2.4],  // CLOSE-UP LAW: was k 2.0 (crew 19%)
                                          // — racks A..D stay in the sweep,
                                          // the laden-men tableau now 22.8%
  'doorlight-hinge':   [480, 400, 2.2],
  mouth:               [345, 340, 2.4],
  'discovery-low':     [900, 430, 1.8],
  'eye-close':         [745, 295, 3.6],    // O.1's visual half
  twoshot:             [700, 400, 2.6],
  'meal-close':        [780, 430, 2.8],    // the clutch IN SHADOW, x3
  sword:               [740, 440, 3.2],    // pan START — lands on `mouth`
  'scheme-push':       [770, 500, 3.2],  // CLOSE-UP LAW: was [640,470,3.0] —
                                          // recentred ON the swept scheme mark
                                          // (800,530); Ulysses 29.3% -> 31.3%
  'club-wide':         [880, 360, 1.6],    // mast-scale delivered visually
  'lots-overhead':     [600, 490, 3.0],
  'bowl-close':        [690, 440, 3.4],    // G3's hold frame
  'face-flush':        [710, 380, 4.0],
  'ember-close':       [655, 450, 3.8],    // G4's hold frame
  'drive-tight':       [590, 490, 3.4],  // RE-AIMED with the swept sprawl (E2:
                                          // the ledger's (780,430) framed the
                                          // pens), then recentred for the
                                          // CLOSE-UP LAW: the four bearing men
                                          // (F.stakefive, x 452..482), the
                                          // shaft and the eye (676,495) all
                                          // survive the PORTRAIT crop too —
                                          // (644,505) cut every crewman out
                                          // of the portrait window; k stays
                                          // the ledger's own 3.4
  'ram-close':         [838, 425, 3.2],    // G5
  'handpass-tight':    [370, 400, 3.6],    // O.11's core image
  'doorway-twoshot':   [370, 380, 3.0],
  'freed-overshoulder': [430, 430, 2.35], // CLOSE-UP LAW: was k 2.0 (19.5%) —
                                          // Ulysses at the cutting 22.9%, the
                                          // small seated giant kept in frame
  /* THE CLOSE-UP LAW's four new lenses (each split off a shared lens that
     fought two subjects): */
  collapse:            [770, 460, 2.2],  // iii-13 (was establishing): the whole
                                          // fall — seat (760,452) to the sprawl
                                          // box [636..938] — composed, not wide
  'sprawl-groan':      [720, 480, 2.6],  // iv-08 (was mouth, which CROPPED the
                                          // shouter): the groaning bulk against
                                          // his own fire-glow, sprawl at 35.2%
  puzzling:            [638, 450, 1.75], // v-01 (was establishing 9.8%): the
                                          // blocked mouth + Ulysses by the pens
                                          // in BOTH orientations; the seated
                                          // giant is the two-shot's anchor
  'lash-close':        [950, 505, 3.2],  // v-02/03 (was meal-close, aimed at
                                          // the hearth): the trios (968/1022),
                                          // the working hands — Ulysses 31.3%
};

/* ---- the gates (ledger §gates, cave) ---------------------------------- */
const GATES = {
  /* G2: the sword is an ACTOR PROP — the anchor rides the mounted Ulysses at
     his staged rest, mark (680,554) + 17 px of hip: the ledger's (680,537). */
  sword: { hipLift: 17, r: 38 },
  /* G5: the great-ram ACTOR's body centre at ram-stand — (838,430) - 15. */
  'ram-great': { bodyLift: 15, r: 60 },
};
/* G3/G4, the two hold anchors, ledger verbatim. THE BOWL ANCHOR IS THE
   OFFER CUT'S OWN PAINTED BOWL (audit #6 — the separate prop doubled it):
   cut px (345, 218) at h 75 -> mark (700,514) + (30.5, -50.4). */
const HOLD_AT = { bowl: [730, 464], embers: [662, 456] };

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
const GIANT_H = { stand: 300, seat: 165, clutch: 190, drink: 175, sprawl: 104,
                  grope: 210, doorway: 165, stroke: 190 };
/* RAM SCALE (audit #9): the painted ewes are the stock law (20-25 px tall,
   ledger yardstick) — the walkers and the lashed pairs draw AT stock height
   now (24 / 25 px vs the old 45 / 57, which read as another species beside
   the pens). Only the GREAT ram is licensed anomalous (ledger: 100-110 px
   long — he must hide a slung 75 px Ulysses, O.11). */
const RAM_H = { walk: 24, great: 83, greatSlung: 84, pair: 25 };
const PROP_H = { bowl: 16, sword: 12, stakeW: 84 };

/* ---- EXPLORER C: CONTACT SHADOWS (the chase.js rig-shadow law) ---------- *
 * The registry is app/shadows.js, generated VERBATIM from the grounding
 * lane's shadowmap.json (tools/ody/seamless/shadowgen.py): per cut, the PNG
 * carries the FEET'S own span as a light-skewed floor ellipse at peak alpha
 * 0.62; the set places its `anchor` ON the actor's foot mark, scaled by the
 * actor's own k = drawnH / cutH, and applies the chase depth-opacity law
 *     opacity = (0.42 + 0.30 * s) * actorOp        (chase.js paintRigs)
 * with s the mark's own depth share of this floor's y range (the ledger's
 * upstage rack line 330 to the downstage edge's deepest 565). */
const SHADOW = SHADOWS.cave.shadows;
const SHADOW_BAND = [330, 565];
const shadowS = (y) =>
  clamp01((y - SHADOW_BAND[0]) / (SHADOW_BAND[1] - SHADOW_BAND[0]));
/* which shadow serves which live picture: the giant's poses by name (the
   doorway draws the grope cut and takes its shadow), the bridges/loops by
   the pose the strip is performing at its mark */
const GIANT_SHADOW = {
  stand: 'polyphemus-stand', seat: 'polyphemus-seated',
  clutch: 'polyphemus-clutch', drink: 'polyphemus-drink',
  sprawl: 'polyphemus-sprawl', grope: 'polyphemus-blinded-grope',
  stroke: 'polyphemus-stroke',
};
const BRIDGE_SHADOW = { seize: 'clutch', drink: 'drink', collapse: 'sprawl',
                        milk: 'seat', stroke: 'stroke', grope: 'grope' };

/* ---- EXPLORER C: FLOOR-PROP OCCLUDERS (the church pews-front law) ------- *
 * Pixel-exact restores of the plate's OWN props (cutocc.py; occluders.json
 * origins/grounds verbatim), cut PER PAINTED STATE — the room-dim law: the
 * same stones are painted five times. Each occluder is ONE wrapper in the
 * actor group, painter-sorted by its GROUND line like any baseline, whose
 * five state layers mirror the plate stack's order and opacities every
 * frame — so the wrapper's composite IS the plate stack's own composite
 * restricted to the cut, and a swap can never show a stale state's stones.
 * Adopted per the grounding report (explore-grounding.md §2/§4): the fire
 * ring's lip seats the giant's three-meal clutch (417 px of measured
 * burial), the woodpile's crown seats every mid-floor crossing (289 px),
 * the milk tub seats the milking giant; the frontPen RAILS and the sea
 * GUNWALE were measured there and REFUSED (0 px / rail-gap alpha). */
const OCC = [
  { id: 'firering', base: 'set/cave/firering-front-', origin: [523, 409],
    size: [214, 98], ground: 503 },
  { id: 'woodpile', base: 'set/cave/woodpile-front-', origin: [483, 497],
    size: [140, 57], ground: 550 },
  { id: 'tub', base: 'set/cave/tub-front-', origin: [845, 455],
    size: [94, 95], ground: 546 },
];

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
/* THE GIANT'S OWN MOTIONS (ody-video2 wave, registry-read like the walks).
 * BRIDGES (kind:'bridge') are PLAY-ONCE: frame = bridgeFrame(strip, k) — the
 * act's own progress drives the index the way distance drives a walk, so the
 * transition plays forward exactly once and parks on its last cell, which the
 * build gate proved against pose B (endpoint XOR law); the set then swaps to
 * the static pose B cut it already uses. LOOPS (kind:'loop') ride loopFrame
 * on the verb's own period. `hPx` per strip is END-POSE CONTINUITY, measured
 * off the cells' own alpha (2026-08-16): the landing frame's figure drawn at
 * the same height the engine draws that pose's cut (clutch 190 / drink 175 /
 * sprawl 202.7-long / seat 165 / stroke 190 / doorway-grope 165), scaled
 * through each cell's srcH. */
const GSTRIP = {
  seize:    { ...STRIPS['seize'],            hPx: 194 },   // seat -> clutch (x3 meals)
  drink:    { ...STRIPS['drink'],            hPx: 182 },   // seat -> drink (x3 pours)
  collapse: { ...STRIPS['collapse'],         hPx: 196 },   // drink -> sprawl (neck)
  milk:     { ...STRIPS['giant-milk'],       hPx: 168, period: 1.6 },
  stroke:   { ...STRIPS['giant-stroke'],     hPx: 193, period: 1.8 },
  grope:    { ...STRIPS['giant-grope-sway'], hPx: 168, period: 2.2 },
};
/* the seize bridge's window inside the 6 s meal seg: play over k 0.02..0.45
 * (the same beat the old static pop landed clutch); past the window's end
 * the bridge PARKS on its landing cell for SEIZE_PARK of the window before
 * the static clutch takes the frame, so the swap is a held frame, not a
 * flicker — the O.6 sample at segK 0.5 reads the parked landing cell,
 * identical all three meals (the endpoint gate proved it against the cut).
 * THE RETIME (animation-weight lane): the ten cells are weighted — the
 * reach closes slowly onto the CONTACT cell (c3, where the hands close on
 * the victims where they stand), the lift ACCELERATES away with the pair,
 * and the landing cell holds a beat. The strip's own c2->c3 seam carries
 * the compressed anticipation, so the contact beat is the retime's pivot. */
const SEIZE_WIN = [0.02, 0.45];
const SEIZE_PARK = 0.25;              // of the window, parked on the landing cell
const SEIZE_W = [0.09, 0.10, 0.13, 0.18, 0.13, 0.10, 0.08, 0.06, 0.05, 0.08];
const SEIZE_WARP = bridgeWarp(SEIZE_W);
const SEIZE_CONTACT = SEIZE_W[0] + SEIZE_W[1] + SEIZE_W[2];   // bk at c3 = the beat
                                      // the victims are HANDED OFF to the strip art
/* the drink bridge's own window: the first 0.9 s of each drain (the reach and
 * the head-back), then the static drink cut holds the drain out */
const DRINK_BRIDGE = 0.9;
/* the collapse bridge spends k 0..0.85 of the 6 s seg; the landing frame's
 * lying body centres 7.9 drawn px (at hPx 196) right of its measured anchor,
 * so the end mark below parks that centre on the honest sprawl's own
 * (787.2, 547.4) — the offset scales with the ramp to 11.7. THE HPX RAMP
 * (audit #5): the bridge opens at its measured drink-continuity 196 and
 * eases to 291.2 (196 x 104/70) across the fall, so the landing frame draws
 * the same length the honest static sprawl then holds — he goes down AND
 * stretches out full length in the one motion. */
const COLLAPSE_END = [775, 547];
const COLLAPSE_WIN = 0.85;
const COLLAPSE_HPX_END = 291.2;
/* THE COLLAPSE RETIME (animation-weight lane): the chain's own seconds are
 * nothing like uniform — srcs 1/13/25 are the slow FOLD, src 48 the drop,
 * 71..75 the landing tumble, 96/97 the stillness — so the cells are
 * weighted to read that way: a long fold (c0-c2, 48% of the play), the
 * fall ACCELERATING through c3 into the c4 IMPACT, then a decelerating
 * tumble-settle (c5-c9). The mark and the hPx stretch ride the SAME warped
 * phase, so the body travels when the art travels. THE ELASTIC IMPACT
 * (teleport-law re-review, 2026-08-17): the impact squash is a CURVE the
 * ticks ride THROUGH, never a keyed substitution — the old two keyed sy
 * swaps (1 -> 0.965 in one tick at impact, 0.965 -> 1.006 -> 1 at the
 * recoil) read as one-frame pose substitutions at 30 fps. Now sy eases
 * 1 -> 0.965 across the impact head's first ~3 ticks, recoils through
 * 1.006 and settles back to 1 on the same cosine curve, so no two adjacent
 * ticks differ by more than ~0.018 of scaleY (the lap's [collapse-squash]
 * continuity clause holds <= 0.02/tick) — declared to the proof like the
 * bob, about the feet as ever. */
const COLLAPSE_W = [0.17, 0.16, 0.15, 0.07, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09];
const COLLAPSE_WARP = bridgeWarp(COLLAPSE_W);
const COLLAPSE_IMPACT = COLLAPSE_W[0] + COLLAPSE_W[1] + COLLAPSE_W[2] +
                        COLLAPSE_W[3];             // bk at c4's head — the landing
const IMPACT_SQUASH = { sy: 0.965, in: 0.05,       // 1 -> 0.965 over ~3 ticks
                        recoil: 1.006, recoilT: 0.117,   // through the rebound
                        settleT: 0.2 };            // back to exactly 1
/** sy at `s` seconds past the impact head — continuous, eased, parks at 1 */
const impactSy = (s) => {
  const Q = IMPACT_SQUASH;
  if (!(s >= 0) || s >= Q.settleT) return 1;
  if (s < Q.in) return lerp(1, Q.sy, easeInOut(s / Q.in));
  if (s < Q.recoilT) {
    return lerp(Q.sy, Q.recoil, easeInOut((s - Q.in) / (Q.recoilT - Q.in)));
  }
  return lerp(Q.recoil, 1, easeInOut((s - Q.recoilT) / (Q.settleT - Q.recoilT)));
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
   2.6 m stride at his unhurried shepherd's cadence spends 1.45 m/s
   (62 px/s — the weight lane's number: with the stance-lock profile the
   whole stride's ground rides the SWING cells at 1.52x the cruise, and
   62 x 1.52 at the flock crossings' measured 1.51 css/plate zoom is
   2.38 css px a step, inside the 2.5 anti-skate budget; at the old 78 the
   surge read 2.79 and skated) — his strip walks are ARC-PARAMETERISED
   against this cap (stepGiant), so a short seg cannot make him sprint;
   the seg simply hands him the floor a beat longer.
   THE GIANT'S CAP IS HIS SWEEP SPEED (stance lane, 2026-08-17): with the
   plant dwells freezing him DWELL.s per step, 2.4 m/s between dwells puts
   the whole-walk mean at ~1.25 m/s — slower than the old 1.45 cruise, and
   the step-through of a 7 m biped IS brisk while the support is long. */
const WALK_V = { man: 2.0 * SCALE.pxPerM, giant: 2.4 * SCALE.pxPerM };
/* THE FLOCK-OUT SWEEP (anti-skate, 2026-08-17): quiverlid's mouth lens
   magnifies ~1.52 css/plate at the walk's fastest sweep, and the 2.4 m/s
   cap reads 2.61 css px/frame there — over the 2.5 anti-skate law. That
   crossing is STAGED a shade slower (2.2 m/s -> 2.40 css px/frame at the
   same lens; the path is spent ~0.5 s later, well inside the held seg);
   the law itself stands at 2.5. */
const FLOCK_OUT_V = 2.2 * SCALE.pxPerM;

/* LANE PHYSICS (Explorer D adopted — tools/ody/seamless/explore-physics.md):
 * the gait read off each strip's OWN anchors (the plant frames are the anchor
 * swap, the KING law's contacts: polyphemus-walk plants at cells 3/7,
 * crew-walk at 1/4 — read, not transcribed), a mean-1 speed pulse that dips
 * ON the plant and rises through the swing, and a step-synced bob. Bob
 * amplitudes ~2.4-3% of body height (the audit's real-walk band is 3-4%;
 * the burdened sliders carry a shade less). */
/* THE GIANT'S WEIGHT (animation-weight lane; supersedes the dip-0.28 tune):
   his profile is the STANCE-LOCK table (gaitLockProfile) — ground speed
   ZERO through each plant cell (3 and 7, the anchors' own strikes), linear
   0.7-cell ramps, a 1.51x swing surge, mean 1. Driven by stepGiant's twin
   clocks the planted foot now stands STILL through the plant (the lap's
   stance-lock gate, <= 1.0 css px drift) and the mark's velocity CV reads
   ~0.6 (the giant-weight gate wants >= 0.25) while the swing surge at the
   1.7 m/s cruise stays inside the 2.5 css px anti-skate budget at the
   flock crossings' zoom. */
const GAIT = { giant: gaitLockProfile(STRIPS['polyphemus-walk'], { ramp: 0.7 }),
               crew:  gaitProfile(STRIPS['crew-walk']),
               ram:   gaitProfile(STRIPS['ram-walk']) };
/* THE PLANT DWELL (stance lane, 2026-08-17): the giant's walk no longer
 * rides the lock profile's PULSE (the split clocks let every grounded cell
 * around the plant skate at swing speed — the reviewer's 12-21 px creep);
 * stepGiant freezes mark AND cell together for DWELL.s at each settled
 * plant (plants are the anchors' strikes 3/7; the dwell stands one cell
 * later, 4/8, weight fully on the fresh foot), eased over DWELL.ramp with
 * a DWELL.floor approach so the landing cannot stall. The profile's
 * plants/bob tables still serve; only its pulse is retired here. */
/* tuned by simulation against the lap's own thresholds (2026-08-17):
 * 365 px entrance -> 6.92 s, 3 dwells of 0.40 s, worst 30 fps dv 15.1 px/s
 * (abs law 18.6), ease-in 0.50 / ease-out 0.47 (max 0.6), CV 0.75,
 * peak-sweep skate 1.94 css px/step at the k=1.8 lens (law 2.5) */
const DWELL = { s: 0.40, up: 0.40, dn: 0.25, floor: 0.16,
                cells: gaitProfile(STRIPS['polyphemus-walk'])
                  .plants.map((p) => (p + 1) % STRIPS['polyphemus-walk'].n) };
/* the torso lag (weight lane): a shade of lean about the pinned feet, its
   phase the BOB table read 0.4 cells (~120 ms at cruise) behind the hip —
   mass arrives late. Declared to the proof; the foot cannot move (origin). */
const TORSO_LAG = { deg: 1.3, phi: 0.4 };
/* CADENCE ATTENUATION (shared law with setkit walkToward2): pulse depth
   scales with the gait cycle's own seconds — full below ~1.1 cycles/s,
   fading toward flat at sprint rates, where a full-depth pulse at 30 fps
   reads as flicker and breaks the one-frame speed law */
const gaitAtt = (gait, ppf, v) =>
  clamp01(gait.n * ppf / (Math.max(v, 1) * 0.9));
/* the giant's bob is HEAVIER than the stock 2.4% (weight lane: pelvis
   compression scaled for mass — 3.2% of his 300 px stand, ±4.8 px, sunk
   INTO each locked plant because bob and pulse share the phase clock) */
const BOB_AMP = { giant: 0.032 * SCALE.giantStand, crew: 0.03 * SCALE.crew,
                  ram: 0.03 * RAM_H.walk, pair: 0.025 * RAM_H.pair,
                  gram: 0.024 * RAM_H.great };
/* THE RAM-STREAM SLIDERS (audit-motion.md #1, the chapter's worst offender):
 * the lashed trio-pairs and the great ram are single measured CUTS (the men
 * slung beneath are baked into the art — the registry ships no slung strip,
 * and compositing static men over ram-walk cells would scissor the lashings),
 * so they cannot ride placeStrip. Instead they WALK: arc-length integration
 * at a burdened vmax (1.2 m/s — they carry men), the ram strip's own pulse
 * table for per-step speed structure, and the cell cadence applied to the
 * static cut as a bob + sway gait about the pin (body low at the plant, high
 * mid-swing, weight rocking once per cycle). Zero-leg-motion is the art's
 * fact; the burdened plod at stride cadence is what reads honest over it. */
const SLUNG_V = 1.2 * SCALE.pxPerM;    // 51.6 px/s — a burdened animal's walk
const TROT_V = 1.4 * SCALE.pxPerM;     // 60.2 px/s — v-11's own verb: he
                                       // TROTS clear once the mouth is his
const SLUNG_SWAY = 0.8;                // deg, once per gait cycle, about the pin
/* THE BURDEN (weight lane): a ram with a man lashed under him walks SHORTER
   (stride x0.82 — the cadence clock ticks faster over the same ground),
   CARRIES LOW (a constant 1.3 px sink under the step bob), and his load
   SWINGS LATE — the sway phase reads 150 ms behind the gait clock, the
   pendulum answering the step instead of riding it. */
const BURDEN = { stride: 0.82, sink: 1.3, lag: 0.15 };
/* THE DEPARTURE JITTER (weight lane): the dawn stream's walkers used to
   leave on an even 0.07 lattice with one shared window — a conveyor. Start
   beats and window speeds are now index-seeded per ram (deterministic,
   byte-identical laps) — the ram-stream gate wants >= 3 distinct departure
   beats; these five give five (0 / 1.2 / 1.8 / 3.2 / 3.7 s of the 14 s
   escape), all landed before the seg spends itself. */
const RAM_DEP = [0, 0.088, 0.128, 0.225, 0.264];   // of fl.dur
const RAM_WIN = [0.60, 0.55, 0.63, 0.56, 0.60];    // eased window, per ram
/* the slung walks' own integrator: ease-in from rest, ease-out as the path
   runs out, per-step pulse on the ram strip's plant table — phase is the
   SAME clock (arc s / pxPerFrame) that a strip walk would use */
function glideStep(g, len, vmax, dt, phase) {
  g.run += dt;
  /* a burdened animal gathers itself: 0.5 s to cruise, and the last
     ~0.35 s of path eases toward a 0.15 floor. The step pulse FADES WITH
     the ease-out (short checking steps into the stop) so the decel knee
     never compounds a pulse peak with the envelope's own fall. */
  const envIn = easeInOut(Math.min(1, g.run / 0.5));
  const envOut = Math.max(0.15, easeInOut(clamp01((len - g.s) / (vmax * 0.35))));
  const v0 = vmax * envIn * envOut;
  const att = gaitAtt(GAIT.ram, STRIP.ram.pxPerFrame, v0) * envOut;
  const pulse = 1 + (gaitAt(GAIT.ram, GAIT.ram.pulse,
                            g.s / STRIP.ram.pxPerFrame + (phase || 0)) - 1) * att;
  g.s = Math.min(len, g.s + v0 * pulse * dt);
  return g.s;
}
/* the slider's gait clock -> bob + sway for its static cut. THE BURDEN
   (weight lane): the clock ticks at the shortened stride, the carriage
   rides `sink` px low, and the sway — the slung man's pendulum — lags the
   step by BURDEN.lag seconds at the leg's own cruise. */
function slungGait(s, phase, bobAmp, v = SLUNG_V) {
  const ppf = STRIP.ram.pxPerFrame * BURDEN.stride;
  const phi = s / ppf + (phase || 0);
  const lagPhi = phi - BURDEN.lag * (v / ppf);
  return { bob: gaitBobY(GAIT.ram, phi, bobAmp) + BURDEN.sink,
           rot: SLUNG_SWAY * Math.sin(2 * Math.PI * lagPhi / GAIT.ram.n) };
}

/* place a cut by its measured pin. Returns the drawn box for the snapshot.
   MICRO-IDLE (the sherlock King law, room.js stepKing): a settled cut may
   also carry `rot` (the slow sway) and `sy` (the breath's scaleY) — both
   turn about the PIN, which is the feet, so the idle cannot move a foot
   off its mark. Amplitude bounds are the lap's [idle] law. */
function pinCut(node, art, at, hPx, { flip = false, bob = 0, rot = 0, sy = 1 } = {}) {
  const k = hPx / art.px[1];
  const w = art.px[0] * k, h = art.px[1] * k;
  box(node, at[0] - art.pin[0] * k, at[1] - art.pin[1] * k, w, h);
  node.style.transformOrigin =
    `${(art.pin[0] * k).toFixed(2)}px ${(art.pin[1] * k).toFixed(2)}px`;
  node.style.transform = (flip ? 'scaleX(-1) ' : '') +
    `translateY(${bob.toFixed(2)}px)` + (rot ? ` rotate(${rot.toFixed(3)}deg)` : '') +
    (sy !== 1 ? ` scaleY(${sy.toFixed(5)})` : '');
  return { w, h };
}

/* alongPath (per-SEGMENT fractions) is RETIRED (LANE PHYSICS): equal param
   time across unequal polyline legs made every vertex an instantaneous speed
   step — ram0 popped +47% in one frame at the flockOut seg2->seg3 vertex.
   Every path walk below is arc-length parameterised (setkit alongPathArc). */

/* THE HEARTH DETOUR (round-7 placement audit #2/#8): walkToward is a
   straight damp, and a straight leg from the far dark to any fire-side mark
   STRODE THROUGH the painted hearth (b3-31 caught Ulysses on the embers,
   b2-15 five carry men on the rim). Every damped walk now asks for a legal
   goal first: while the straight leg to the true goal crosses the fire
   ring's box, the walk is handed the cheapest inflated corner it can reach
   in the clear — re-chosen every frame, so greedy corner routing walks the
   man AROUND the convex box and hands the true goal back the moment the
   way is open. Segs and settled snaps bypass it (a pantomime writes
   positions; a snap is a re-stage, not a walk). The waypoints stay between
   the ledger's two floor polylines. */
/* the detour region is the UNION bounding box of the ring and its NW rim
   spill (audit #13) — a route that clears the pit but strides the painted
   corner stones solved nothing */
const HEARTH = [485, 418, 733, 500];
const HEARTH_WAY = [[473, 406], [745, 406], [473, 512], [745, 512]];
function segCrossesBox(x1, y1, x2, y2, b) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, x1 - b[0]) && clip(dx, b[2] - x1) &&
         clip(-dy, y1 - b[1]) && clip(dy, b[3] - y1) && t1 > t0;
}
function parkedGoal(px, py, gx, gy) {
  if (!segCrossesBox(px, py, gx, gy, HEARTH)) return [gx, gy];
  let best = null, cost = Infinity;
  for (const [wx, wy] of HEARTH_WAY) {
    /* never re-choose the corner underfoot (a zero first leg made the
       occupied corner the argmin forever — the round-7 lap caught six men
       parked on it), and price a corner whose ONWARD leg still crosses at
       a second hop's worth so the router prefers the corner that opens
       the way */
    const leg1 = Math.hypot(px - wx, py - wy);
    if (leg1 < 4) continue;
    if (segCrossesBox(px, py, wx, wy, HEARTH)) continue;
    let c = leg1 + Math.hypot(wx - gx, wy - gy);
    if (segCrossesBox(wx, wy, gx, gy, HEARTH)) c += 240;
    if (c < cost) { cost = c; best = [wx, wy]; }
  }
  return best || [gx, gy];
}

/* ---- THE STAGINGS: the crew formations, authored on the floors -------- *
 * ROUND-7 RE-SWEEP (placement audit): every foot below sits between the two
 * ledger polylines, OUTSIDE every registered obstacle box (the pens, the
 * hearth + its NW rim spill, both wood piles, the BED and its log pile, the
 * tub and the clay bowl), and no two neighbours stand closer than ~13 px
 * centre-to-centre (the crowding law — 27 px bodies at <12 px gaps read as
 * one interpenetrating mass, audit #12). */
const FORM = (() => {
  const F = {};
  F.off = [];
  /* THE ENTRY FILE IS SWEPT (LANE PHYSICS lap, the parking law): the old
     single file x 418..627 marched its back half INTO the woodpile box
     [495,495..620,555] — never sampled settled before, because no lap held
     ii-00 to the file's stop; the fire ring (x >= 527) and the floor band
     leave NO legal ground at x 517..630, so the twelve now stand as TWO
     files of six west of the hearth, every foot's x <= 481 (>= 10 px clear
     of the woodpile's 495 rail), 15 px along each file, between the two
     ledger polylines. */
  F.entry = [];
  for (let i = 0; i < CREW_N; i++) {
    const row = i % 2, j = (i - row) / 2;         // two files of six
    const x = 398 + j * 15 + row * 8;
    F.entry.push([x, downY(x) - (row ? 46 : 24)]);
  }
  /* THE RACKS FILE IS RE-LAID (audit #8): the old 20 px single-file spacing
     drew 94 px-wide carry cuts four deep into each other — a solid wall
     ACROSS the racks' own cheese shelves (O.3's carrier). Now: a left party
     of four heading seaward before the mouth, and a working cluster of
     eight before racks B and C — every foot above the hearth's top rail,
     clear of the rim's NW spill, no neighbour gap under 13 px, and rack A's
     painted shelves left open to the lens (bodies clear of x 535..625, so
     the racks READ as loaded). */
  F.racks = [[446, 412], [470, 409], [458, 420], [482, 417],
             [654, 410], [678, 408], [702, 406], [726, 404], [750, 402],
             [666, 415], [690, 413], [714, 411]];
  /* THE HUDDLE IS OFF THE BED (audit #1 — the old arc stood all twelve men
     INSIDE the painted bed box [1025,330..1240,500], front row on the
     logsRight pile): the far dark is now the open floor downstage of the
     front pen — y >= 529 clears the pen's bottom rail, x >= 890 clears the
     clay bowl, the bed stays 30+ px upstage-right. Rows 12 px apart,
     columns 24, nearest neighbours >= 12.8 px. */
  F.huddle = [[892, 529], [916, 530], [940, 531], [964, 532],
              [902, 540], [926, 541], [950, 542], [974, 543],
              [890, 552], [914, 553], [938, 552], [962, 550]];
  /* THE LOTS CIRCLE (lap round 2, respaced round 7 — audit #12): the drawn
     circle arcs right-front of the pit around the ledger's own lots-circle
     mark (713,527); every foot clears the woodpile's x 620 rail, the fire
     ring's rails, the log bundle's y 497 rail, and NO neighbour gap is
     under 14 px (the old 8.9/9.8/11.4 px gaps interpenetrated the 27 px
     bodies). Still inside the lots-overhead lens (x 365..835). */
  F.lots = [[671, 524], [694, 517], [719, 515], [741, 520],
            [752, 530], [731, 538], [706, 540], [683, 533]];
  /* the four at the stake (round-2 eye review E2/E3, re-swept round 7 —
     audit #13: (522,459)/(492,441) stood ON the rim's painted NW stone
     spill, now registered as fireRimNW [485,425..527,485]): carry/drive
     cuts scattered along the beam's axis behind Ulysses, every foot clear
     of the ring box AND the rim spill AND the woodpile. */
  F.stakefive = [[480, 466], [462, 448], [452, 486], [482, 499]];
  /* freed (v-11), re-swept clear of the fireRimNW spill the old spots
     (492,465)/(516,470)/(500,477) stood inside */
  F.freed = [[430, 455], [452, 462], [420, 472], [444, 478],
             [468, 470], [462, 486]];
  return F;
})();
/* Ulysses' own mark per formation (the crew arrays never include him) */
const U_AT = {
  entry: [655, 514], racks: [470, 428], huddle: [876, 547],
  suppliant: SWEPT.suppliant, sword: MARKS['sword-ulysses'],
  scheme: SWEPT.scheme, lots: [715, 551], bowl: MARKS['bowl-offer'],
  /* stakefive: at the sprawled head's shoulder, baseline 549 — 3 px NEARER
     than the sprawl's 546, so the painter's order keeps him and his drive
     cut IN FRONT of the head he is working on (E2) */
  stakefive: [624, 549], work: [1006, 538], freed: [418, 443],
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
  /* the entry/exit legs ride 10 px LOWER than the first sweep (412 -> 422,
     the weight lane's unhide): at 412 the striding feet crossed the ring's
     far-crown band edge-on and read as part of the stones (return2 clip
     3.10-4.10); at 422 a band of dark floor separates foot from crown. */
  giantIn:   [[398, 436], [600, 422], [760, 452]],       // ii-03, under the load
  giantOut:  [[760, 452], [640, 422], [398, 436]],       // iii-02, with the flock
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
/* the stream's arc lengths, read once (the sliders' walks spend these), and
   the v-11 trot-clear leg: mouth -> the grass, 72 px = 1.7 m */
const FLOCK_LEN = pathLen(PATH.flockOut);
const ESC_LEN = pathLen(PATH.ramEscape);
const TROT_PATH = [MARKS['ram-at-mouth'], [466, 452]];
const TROT_LEN = pathLen(TROT_PATH);
const FLOCK_N = 5;                    // walkers; the pens' painted ewes stay
/* NO PARKED RAMS: round-2 eye review E1 — ram ACTORS belong to Beat V only.
   iii-06's overfull pens are recorded in the snapshot (S.parked), never
   staged; the walkers mount for the dawn escape and nothing earlier.
   THE TRIOS ARE OFF THE TUB AND THE PEN CORNER (audit #10): the old
   (930,538)/(1010,534) pair boxes covered the milk tub's face and stood
   across the front pen's painted corner rails — the lash spots now sit on
   the open floor downstage of the pen, clear of the tub/bowl boxes. */
const TRIOS = [[968, 543], [1022, 537]];      // v-02: lashed on the open floor

export class CaveSet {
  static id = 'cave';
  /** No IMAGE inset rises over the cave — the chapter's only image plate is
   *  the shore's wineskin (inset law §6). */
  static insets = {};
  /** The cave's three HERO CLIPS (heroclip law, main.js): living close-ups
   *  seeded from this set's own staged tableaux (tools/ody/_heroseed.mjs),
   *  generated and gated by tools/ody/heroclip_gate.py — identity, bg-drift,
   *  luma (the deflicker law applied to video), loop closure. The registry of
   *  record is tools/ody/heroclips.json; the lap asserts the served bytes ARE
   *  the registry's. Raised/lowered by main.js's HEROCLIPS table, never here. */
  static clips = {
    'clip-seize':      HEROCLIP_FILES['clip-seize'],
    'clip-twist':      HEROCLIP_FILES['clip-twist'],
    'clip-underbelly': HEROCLIP_FILES['clip-underbelly'],
  };
  static beds = ['cave'];

  constructor(root, st) {
    this.st = st;                     // the Stage shell: img/bitmap/cue/reduced
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);
    /* actor cuts load their BUILD-GRADED variant (regrade law, setkit) and
       fall back to the raw cut; strips stay raw — the grade is per-cut */
    const cut = (f, c, p) => gradedActor(st, 'cave', f, c, p || root);

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
    /* ---- THE CONTACT SHADOWS, in their own group BEFORE the actors ----- *
     * (Explorer C, the chase.js law: a body is drawn over its own shadow.)
     * A separate group means no depth sort can ever lift a shadow above an
     * actor — the shadow pass paints first, always. */
    this.shadowG = el('div', 'actors shadows', root);
    const shN = (name) => {
      const e = img('actor/shadow/cave/' + SHADOW[name].file, 'lyr', this.shadowG);
      e.style.opacity = '0';
      return e;
    };
    this.giantShN = {};
    for (const pose of Object.keys(GIANT_SHADOW)) {
      this.giantShN[pose] = shN(GIANT_SHADOW[pose]);
    }
    this.uShN = {};
    for (const kind of ['stand', 'walk', 'offer', 'sword', 'drive']) {
      this.uShN[kind] = shN('ulysses-' + kind);
    }
    this.crewShN = [];
    this.carryShN = [];
    for (let i = 0; i < CREW_N; i++) {
      this.crewShN.push(shN(i % 2 ? 'crew-b-stand' : 'crew-a-stand'));
      this.carryShN.push(shN('crew-carry'));
    }
    this.ramShN = {
      great: shN('ram-great'), slung: shN('ram-great-slung'),
      pairs: [shN('ram-pair-slung'), shN('ram-pair-slung')],
      walk: [],
    };
    for (let i = 0; i < FLOCK_N; i++) this.ramShN.walk.push(shN('ram-walk'));

    this.actors = el('div', 'actors', root);
    this.giantN = {};
    for (const [pose, art] of [['stand', ART.giantStand], ['seat', ART.giantSeated],
        ['clutch', ART.giantClutch], ['drink', ART.giantDrink],
        ['sprawl', ART.giantSprawl], ['grope', ART.giantGrope],
        ['stroke', ART.giantStroke]]) {
      const n = cut(art.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.giantN[pose] = n;
    }
    /* THE WALK STRIPS (decoded at boot via st.bitmap — room.js: the first
       walk frame never flashes white). The strip is the walk, the cut is the
       stand/seat, and they are never both visible (the swap law). */
    this.giantStripN = el('div', 'lyr walk', this.actors);
    this.giantStripN.style.backgroundImage = st.bitmap(STRIP.giant.file);
    this.giantStripN.style.opacity = '0';
    /* the giant's bridge/loop strips (ody-video2): one node per registry
       file, decoded at boot like every strip (room.js: no white flash) */
    this.gMotionN = {};
    for (const key of Object.keys(GSTRIP)) {
      const n = el('div', 'lyr walk', this.actors);
      n.style.backgroundImage = st.bitmap(GSTRIP[key].file);
      n.style.opacity = '0';
      this.gMotionN[key] = n;
    }
    this.twistN = el('div', 'lyr walk', this.actors);
    this.twistN.style.backgroundImage = st.bitmap(STRIP.twist.file);
    this.twistN.style.opacity = '0';
    this.uN = {};
    for (const [pose, art] of [['stand', ART.ulyssesStand], ['walk', ART.ulyssesWalk],
        ['offer', ART.ulyssesOffer], ['sword', ART.ulyssesSword],
        ['drive', ART.ulyssesDrive]]) {
      const n = cut(art.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.uN[pose] = n;
    }
    this.crew = [];
    this.crewStripN = [];
    for (let i = 0; i < CREW_N; i++) {
      const n = cut(i % 2 ? ART.crewB.file : ART.crewA.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.crew.push(n);
      const w = el('div', 'lyr walk', this.actors);
      w.style.backgroundImage = st.bitmap(STRIP.crew.file);
      w.style.opacity = '0';
      this.crewStripN.push(w);
    }
    this.carry = [];
    for (let i = 0; i < CREW_N; i++) {
      const n = cut(ART.crewCarry.file, 'lyr', this.actors);
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
      const n = cut(ART.ramPairSlung.file, 'lyr', this.actors);
      n.style.opacity = '0';
      this.pairs.push(n);
    }
    this.ramGreatN = cut(ART.ramGreat.file, 'lyr', this.actors);
    this.ramSlungN = cut(ART.ramGreatSlung.file, 'lyr', this.actors);
    this.ramGreatN.style.opacity = '0';
    this.ramSlungN.style.opacity = '0';

    /* the props ride inside the group so the depth sort owns them too */
    this.bowlN = cut(ART.bowl.file, 'lyr prop', this.actors);
    this.bowlFill = el('div', 'emis', this.actors);       // the wine, ∝ hold
    this.bowlFill.style.background =
      'radial-gradient(ellipse at 50% 45%,rgba(122,20,34,.95) 0%,rgba(122,20,34,.55) 60%,rgba(122,20,34,0) 100%)';
    this.swordN = cut(ART.sword.file, 'lyr prop', this.actors);
    this.stakeN = cut(ART.stake.file, 'lyr prop', this.actors);
    this.stakeGlowN = cut(ART.stakeGlow.file, 'lyr prop', this.actors);
    for (const n of [this.bowlN, this.bowlFill, this.swordN, this.stakeN,
                     this.stakeGlowN]) n.style.opacity = '0';
    /* the sword's breathing glint at the G2 anchor, in the low-fire state */
    this.swordGlint = el('div', 'emis', this.actors);
    this.swordGlint.style.background =
      'radial-gradient(circle at 50% 50%,rgba(220,232,255,.7) 0%,rgba(220,232,255,0) 70%)';
    this.swordGlint.style.opacity = '0';

    /* ---- THE FLOOR-PROP OCCLUDERS (Explorer C, the pews-front law) ------ *
     * One wrapper per cut, inside the actor group so the depth sort owns it
     * at its GROUND line; inside each wrapper the five state layers mirror
     * the plate stack (stepOccluders). */
    this.occN = OCC.map((o) => {
      const wrap = el('div', 'lyr occ', this.actors);
      box(wrap, o.origin[0], o.origin[1], o.size[0], o.size[1]);
      const layers = {};
      for (const name of ['master', 'dawn', 'shut', 'embers', 'predawn']) {
        const e = img(o.base + (name === 'dawn' ? 'dawn' : name) + '.png',
                      'lyr', wrap);
        box(e, 0, 0, o.size[0], o.size[1]);
        e.style.opacity = name === 'master' ? '1' : '0';
        layers[name] = e;
      }
      return { ...o, wrap, layers };
    });
    this._occOrder = '';

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
      pour: -1e9, pourPrev: -1,              // G3's clock — armed by the reader's
                                             // RELEASE (the 'bowl-pour' gateAct,
                                             // A7), never by the press itself
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
      milkUntil: -1e9,                       // the milking loop's window (act/seg)
    };
    this.giantBridge = null;                 // { key, frame, k, at, hPx, flip }
    this._gGuard = {};                       // swapActor state (teleport law)
    this.gSwap = null;                       // the active handoff tween | null
    this.giantLoop = null;                   // { key, frame, at, hPx, flip }
    this._bGate = null;                      // the bridge rate gate's memory
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
      this.ramGait.push({ dist: 0, lx: null, ly: null, at: null, frame: 0,
                          wT: null, sW: 0, ask: 0, bob: 0 });
    }
    /* LANE PHYSICS: the sliders' burdened walk states (glideStep) — the two
       lashed trios, the great ram's escape leg and his v-11 trot clear */
    this.pairGait = [{ t0: null, s: 0, run: 0, at: null },
                     { t0: null, s: 0, run: 0, at: null }];
    this.gramEsc = { t0: null, s: 0, run: 0 };
    this.gramTrot = { t0: null, s: 0, run: 0 };
    this.giantWalking = false;
    this.twisting = false;
    this._pairAt = [null, null];             // the trios' marks, for the shadows
    this._shadows = [];                      // the shadow pass's own ledger
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
      /* sprawl: the head end at the honest length (audit #5) — the eye's own
         cut point at h 104 sits (12, -51) off the head pin */
      sprawl: [12, -51], grope: [0, -195], doorway: [0, -150], stroke: [-6, -178],
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
   *  heat fires the drive itself; a full bowl only BANKS (AMENDMENT A7:
   *  pour 1 is the reader's RELEASE — the 'bowl-pour' gateAct below — so
   *  the drain can never begin under a still-pressed finger). */
  setHold(k) {
    const S = this.state;
    S.holdK = clamp01(k);
    if (S.holdMode === 'embers' && S.heatArmed < -1e8) S.heatArmed = S.t;
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
      case 'suppliant':                 // ii-06: arms wide in the firelight —
        this.uTo(SWEPT.suppliant, 'stand', settled);   // swept off the ring band
        break;
      case 'sword-ulysses':             // ii-11: the glint at the hip — G2 arms
        this.uTo(MARKS['sword-ulysses'], 'sword', settled);
        break;
      case 'swordDraw':                 // G2 gateAct: the draw STOPS mid-air,
        S.sword = settled ? t - 99 : t; // and the pan answers it (O.5)
        break;
      case 'milking':                   // iii-01: the dawn routine; he rises
        this.giantPose('seat', MARKS['giant-seat'], settled);
        /* the milking LOOP (giant-milk, ody-video2): the dawn routine plays
           the working pull at the seat — live only; a settled jump lands on
           the routine already done */
        if (!settled) S.milkUntil = t + 4.0;
        break;
      case 'scheme':                    // iii-03: alone among the pens —
        this.uTo(SWEPT.scheme, 'stand', settled);      // swept off the ring band
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
      case 'bowl-pour':                 // iii-08's gateAct — the reader's LET-GO
        /* THE POUR IS THE RELEASE (AMENDMENT A7): the fill banked on the
           hold, and this act — fired from pressUp itself, or by the 30 s
           soft-fail — is what starts the bowl's clock. A settled replay has
           already dated the pours as history at bowl-offer above, so the
           guard keeps that truth; live, the release instant is pour 1. */
        if (S.pour < -1e8) S.pour = settled ? t - POURS.total : t;
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
    if (at) { G.x = at[0]; G.y = at[1]; G.settle = null; }
    if (!snap && !this.st.reduced) {
      /* short slides are walked by the step's damp; long ones were all given
         explicit paths (giantWalk) — a 7 m giant does not glide */
    }
  }

  giantWalk(path, dur, endPose, settled, vmax = WALK_V.giant) {
    const G = this.state.giant;
    if (settled || this.st.reduced) {
      const end = path[path.length - 1];
      G.pose = endPose; G.x = end[0]; G.y = end[1]; G.walk = null;
      return;
    }
    /* s is the STRIP's gait clock (frame = s / pxPerFrame), zeroed at the
       path head so a walk always starts on frame 0; len/vmax are the honest
       ground-speed law's (WALK_V.giant, or the caller's slower stage — the
       grope is a blind hand-over-hand shuffle on its own eased clock, not
       a stride: no cap, no strip) */
    const grope = path === PATH.giantGrope;
    G.walk = { path, t0: this.state.t, dur, endPose,
               s: 0, run: 0, len: pathLen(path),
               dwell: 0, go: 0, sT: null,        // the plant dwell's state
               vmax: grope ? Infinity : vmax };
    G.settle = null;                    // LANE PHYSICS: a new walk cancels it
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
      this.giantWalk(PATH.giantOut, dur * 0.72, 'away', settled, FLOCK_OUT_V);
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
    this.stepFlock(t, dt, amb);
    this.sortActors();
    this.stepOccluders();
    this.paintShadows();

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
    /* ONE BOWL (audit #6): the ulysses-offer cut PAINTS its own raised bowl
       (measured off the cut's pixels: (345,218) at h 75 = the anchor), so
       the separate prop cut is retired from this staging — drawing both put
       two bowls in frame through the whole pour sequence. The FILL alone
       rides the painted bowl at the hold anchor. */
    this.bowlN.style.opacity = '0';
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
       a settled pour clock lands past both thresholds before any step);
       and every drain window opens with ITS sound — "three times did he
       drain it without thought or heed" is three audible drains (O.7) */
    if (S.pour > -1e8) {
      for (const r of POURS.refills) {
        if (S.pourPrev >= 0 && S.pourPrev < r && d >= r && d < r + 2) {
          this.st.cue('pour');
        }
      }
      for (const [a] of POURS.drains) {
        if (S.pourPrev >= 0 && S.pourPrev < a && d >= a && d < a + 2) {
          this.st.cue('drain');
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
      /* the slide: in from the lots circle, under the painted dung flecks.
         ROT 23 LAYS THE BEAM FLAT (audit #12): the art's own diagonal rises
         22.8 deg butt-to-tip, so at rot 4 the sliding spar drew 41 px TALL —
         a beam floating at the circle's head line. Rotated flat about the
         butt pin it lies ON the floor as it is dragged under the litter,
         landing butt-first on the ledger's stake-hide mark. */
      const k = easeInOut(clamp01((t - S.hide) / 2.2));
      const HB = MARKS['stake-hide'];
      pinCut(plain, ART.stake, [lerp(671, HB[0], k), lerp(524, HB[1], k)],
             PROP_H.stakeW * (592 / 1217), { rot: 23 });
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

  /** THE BRIDGE RATE GATE (weight lane): a bridge may advance at most ONE
   *  cell per fixed 1/60 step, whatever its clock does — a reader's advance
   *  that yanks an act's k can hurry the pose home a cell a tick, never
   *  teleport it. Keyed per performance (`tag` = the seg's own t0 / the
   *  drain index), so a fresh play starts on its clock's own first cell and
   *  the clamp only ever holds a jump DOWN to +1. Fixed-step state: the
   *  same tick count always plays the same frames — laps stay byte-equal. */
  bridgeGate(key, tag, frame) {
    const g = this._bGate || (this._bGate = { id: null, frame: -1 });
    const id = key + ':' + tag;
    const last = g.id === id ? g.frame : -1;
    const f = Math.min(frame, last + 1);
    g.id = id; g.frame = f;
    return f;
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
    /* LANE PHYSICS: the arrival settle plays out over ~5 frames (a small
       overshoot along the travel and back) before the parked pose goes
       still — a 7 m giant does not stop dead from full stride */
    if (G.settle) {
      const s = G.settle; s.t += dt;
      const u = s.t / s.dur;
      if (u >= 1) { G.x = s.at[0]; G.y = s.at[1]; G.settle = null; }
      else {
        const o = Math.sin(Math.PI * u);
        G.x = s.at[0] + s.dx * o; G.y = s.at[1] + s.dy * o;
      }
    }
    if (G.walk) {
      const W = G.walk;
      const k = clamp01((t - W.t0) / W.dur);
      if (!isFinite(W.vmax)) {
        /* the grope shuffle / tip-over keep their authored eased clocks */
        W.s = easeInOut(k) * W.len;
      } else {
        /* THE PLANT DWELL (stance lane, 2026-08-17; supersedes the two-clock
           stance-lock pulse). The external review's optical track proved the
           old split-clock profile a tautology: the mark stood still ONLY
           inside the 1.0-cell plant window while the phase clock kept the
           cells turning, so every visually-grounded cell around the plant
           skated at swing speed (12-21 px of foot creep at return2
           2.80-3.23 / 3.57-3.97) — the gate measured the pinned anchor,
           which the pulse froze by construction, and reported 0.000.
           The honest lock is ONE clock again (the King law restored:
           distance picks the cell, W.phi = s / pxPerFrame) with a TIMED
           DWELL: when the ground clock lands on a settled plant cell's head
           (plant+1 — weight fully on the fresh foot, the anchors' own
           strikes are 3/7, so the dwells stand on 4/8), mark AND cell
           freeze together for DWELL.s — zero ground speed, zero cell turn,
           nothing for the eye's tracked foot to do but stand. The sweep
           between dwells runs at the cap (WALK_V.giant is the SWEEP speed;
           the mean over a cycle, dwells included, is ~1.2 m/s — slower
           than the old 1.45 cruise), eased over DWELL.ramp both out of and
           into each dwell so the 30 fps velocity series keeps the one-frame
           speed law. All state lives in W: byte-identical laps. */
        W.run = (W.run || 0) + dt;
        const ppf = STRIP.giant.pxPerFrame;
        if ((W.dwell || 0) > 0) {
          W.dwell = Math.max(0, W.dwell - dt);   // the plant: really stand
          W.go = 0;
        } else {
          W.go = (W.go || 0) + dt;
          const envIn = easeInOut(Math.min(1, W.run / 0.85));
          const envOut = Math.max(0.25,
            easeInOut(clamp01((W.len - W.s) / (W.vmax * 0.35))));
          const upK = easeInOut(Math.min(1, W.go / DWELL.up));
          /* the ARMED TARGET: the next dwell head, chosen once and held
             (re-choosing per tick let a head slip past on a float tolerance
             and the speed snapped to full — the simulated 93 px/s pop) */
          if (W.sT == null || W.sT <= W.s + 1e-6) {
            const n = STRIP.giant.n;
            const cphi = ((W.s / ppf) % n + n) % n;
            let gap = n;
            for (const c of DWELL.cells) {
              const g = ((c - cphi) % n + n) % n;
              if (g > 0.5 && g < gap) gap = g;   // half a cell clear of the
            }                                    // head we may stand on
            W.sT = W.s + gap * ppf;
          }
          /* sqrt braking: a LINEAR dnK is an exponential stall (~1.5 s per
             approach, simulated); the sqrt profile brakes in finite time
             with a gentle 30 fps-sampled dv, and the floor lands the last
             few px so the step-down cannot creep forever */
          const dnK = Math.max(DWELL.floor,
            Math.min(1, Math.sqrt((W.sT - W.s) / (W.vmax * DWELL.dn))));
          W.s = Math.min(W.len, W.s + W.vmax * envIn * envOut *
                                       Math.min(upK, dnK) * dt);
          if (W.sT <= W.s + 1e-6 && W.sT < W.len - 1) {
            W.s = W.sT;                  // land EXACTLY on the dwell cell head
            W.dwell = DWELL.s;
          }
        }
        W.phi = W.s / ppf;               // one clock: distance picks the cell
        /* THE DWELL'S OWN CELL (stance lane): the armed head is an integer
           in phase space, but s = s0 + gap*ppf rebuilds it through floats
           and can land a hair BELOW the head (13.999.. floors to cell 3 —
           OFF the settled plant). While the dwell holds, the phase IS the
           head: snap it, so the freeze stands on the plant cell (4/8) —
           the walk-ends-on-the-mark handoff's rule at every arrival. */
        if ((W.dwell || 0) > 0) W.phi = Math.round(W.phi);
      }
      const p = alongPathArc(W.path, W.s);
      G.x = p[0]; G.y = p[1];
      const done = isFinite(W.vmax) ? W.s >= W.len - 1e-6
                                    : (k >= 1 && W.s >= W.len - 1e-6);
      if (done) {
        const end = W.endPose;
        /* the EXPLICIT PLANTED SETTLE (weight lane, was 2.5 px / 0.18 s):
           3.5 px past the mark along the travel and back over 0.28 s — a
           giant's mass does not stop dead from full stride */
        if (isFinite(W.vmax)) {
          const pts = W.path, a = pts[pts.length - 2], b = pts[pts.length - 1];
          const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          G.settle = { at: [b[0], b[1]], dx: (b[0] - a[0]) / dl * 3.5,
                       dy: (b[1] - a[1]) / dl * 3.5, t: 0, dur: 0.28 };
        }
        G.walk = null;
        if (end === 'away') G.pose = 'away';
        else this.giantPose(end, null, true);
      }
    }

    /* THE MEAL, identical x3 (O.6): the clutch at the giant-seat mark. The
       curve below is the staging — the same lunge, the same held clutch, the
       same return, whichever meal this is. THE SEIZE BRIDGE (play-once,
       ody-video2) performs the seat -> clutch transition over SEIZE_WIN of
       the same curve — the old static pop's own beat — and parks on its
       gated landing frame; the static clutch cut takes the frame from there,
       so the O.6 sample at segK 0.5 measures the identical clutch x3. */
    this.giantBridge = null;
    if (seg && seg.name === 'seize') {
      const k = segK;
      const M = MARKS['giant-seat'];
      const lunge = easeInOut(clamp01(k / 0.18)) * (1 - easeInOut(clamp01((k - 0.55) / 0.3)));
      G.x = M[0] + 58 * lunge;
      G.y = M[1] + 8 * lunge;
      G.pose = k < 0.06 || k > 0.9 ? 'seat' : 'clutch';
      /* the RETIMED play (weight lane): bk warped through the cell weights,
         then rate-gated to one cell per fixed step; past the window's end
         the LANDING CELL PARKS for SEIZE_PARK of the window (the swap to
         the static clutch is a held frame), with the 2-frame overshoot ->
         settle riding the parked mark (the lift checks 2 px high and sits) */
      const bk = (k - SEIZE_WIN[0]) / (SEIZE_WIN[1] - SEIZE_WIN[0]);
      if (bk >= 0 && bk < 1 + SEIZE_PARK && k <= 0.9) {
        const ot = (k - SEIZE_WIN[1]) * seg.dur;       // s past the landing
        const over = ot >= 0 && ot < 0.067 ? -2 : ot < 0.1 ? -1 : 0;
        this.giantBridge = { key: 'seize', k: +clamp01(bk).toFixed(4),
                             frame: this.bridgeGate('seize', seg.t0,
                               bridgeFrame(GSTRIP.seize, SEIZE_WARP(bk))),
                             at: [G.x, G.y + over],
                             hPx: GSTRIP.seize.hPx, flip: false };
      }
      if (!S.seizeLatched && k >= 0.4) { S.seizeLatched = true; S.meals++; }
    }

    /* the collapse (iii-13): THE COLLAPSE BRIDGE (play-once, ody-video2)
       performs the whole reel-buckle-fall over k 0..COLLAPSE_WIN of the seg
       — drink -> sprawl in the strip's own tumble, the mark easing from the
       seat to COLLAPSE_END (where the landing frame's lying body centres on
       the sprawl cut's own footprint) — and parks on its gated last cell;
       the static sprawl at SPRAWL.at takes the frame from there. */
    if (seg && seg.name === 'collapse') {
      const k = segK;
      const M = MARKS['giant-seat'];
      const bk = k / COLLAPSE_WIN;
      if (bk < 1) {
        G.pose = k < 0.5 ? 'drink' : 'sprawl';
        /* the RETIME (weight lane): the warped phase u drives frame, mark
           and hPx alike — slow fold, accelerating fall, decelerating
           tumble-settle — so the body travels when the art travels; the
           IMPACT (first c4 beat) rides the ELASTIC curve (impactSy: ease
           into the squash, recoil, settle — continuous every tick),
           declared to the proof like the bob */
        const u = COLLAPSE_WARP(bk);
        const e = easeInOut(u);
        G.x = lerp(M[0], COLLAPSE_END[0], e);
        G.y = lerp(M[1], COLLAPSE_END[1], e);
        const st2 = (bk - COLLAPSE_IMPACT) * COLLAPSE_WIN * seg.dur;
        const sy = impactSy(st2);      // the elastic curve, never a keyed swap
        this.giantBridge = { key: 'collapse', k: +clamp01(bk).toFixed(4),
                             frame: this.bridgeGate('collapse', seg.t0,
                               bridgeFrame(GSTRIP.collapse, u)),
                             at: [G.x, G.y], sy,
                             /* the hPx ramp (audit #5): drink-continuity 196
                                at the top, the honest sprawl's 291.2 at the
                                landing — he stretches out as he goes down */
                             hPx: lerp(GSTRIP.collapse.hPx, COLLAPSE_HPX_END, e),
                             flip: false };
      } else {
        G.pose = 'sprawl'; G.x = SPRAWL.at[0]; G.y = SPRAWL.at[1];
      }
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
      for (const [j, [a, b]] of POURS.drains.entries()) {
        if (d < a || d > b) continue;
        drinking = true;
        /* THE DRINK BRIDGE (play-once x3, ody-video2): each drain opens with
           the reach-and-head-back — the strip over the drain's first
           DRINK_BRIDGE seconds, frame clamped to the drain's own progress —
           then parks on its gated landing frame and the static drink cut
           (pose B) holds the rest of the drain, exactly as before. */
        const bk = (d - a) / DRINK_BRIDGE;
        if (bk < 1) {
          this.giantBridge = { key: 'drink', k: +clamp01(bk).toFixed(4),
                               frame: this.bridgeGate('drink', j + 1,
                                 bridgeFrame(GSTRIP.drink, bk)),
                               play: j + 1,
                               at: [G.x, G.y], hPx: GSTRIP.drink.hPx, flip: false };
        }
      }
      G.pose = drinking ? 'drink' : 'seat';
      if (d >= POURS.swayFrom) {
        rot = 5.5 * clamp01((d - POURS.swayFrom) / 3.0) *
              Math.sin(2 * Math.PI * (d - POURS.swayFrom) / 3.4);
      }
    }
    /* THE LOOPS (ody-video2, verb-clock via loopFrame — pure functions of t):
       the MILKING routine at the seat (ii-05's seg + iii-01's act window),
       the ram-back HAND-PASS wherever the stroke pose stands (v-05..v-10),
       the blinded doorway GROPE-SWAY while he fills the mouth (iv-12 on).
       The strip replaces the static cut — never both (the swap law) — and
       the old authored wiggles (the milking lean rot, the cut's bob) go
       with the cut: gait and bob together is double motion. The grope WALK
       (iv-11) keeps its cut glide — a blind hand-over-hand shuffle reads as
       intent (STRIPS.md bench note), and the sway loop is a seated verb. */
    this.giantLoop = null;
    const milking = (seg && seg.name === 'milking') || t < S.milkUntil;
    if (!this.giantBridge && !G.walk) {
      if (G.pose === 'seat' && milking) {
        this.giantLoop = { key: 'milk', frame: loopFrame(GSTRIP.milk, t, GSTRIP.milk.period),
                           at: [G.x, G.y], hPx: GSTRIP.milk.hPx, flip: false };
      } else if (G.pose === 'stroke') {
        this.giantLoop = { key: 'stroke', frame: loopFrame(GSTRIP.stroke, t, GSTRIP.stroke.period),
                           at: [G.x, G.y], hPx: GSTRIP.stroke.hPx, flip: true };
      } else if (G.pose === 'doorway') {
        this.giantLoop = { key: 'grope', frame: loopFrame(GSTRIP.grope, t, GSTRIP.grope.period),
                           at: [G.x, G.y], hPx: GSTRIP.grope.hPx, flip: false };
      }
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
      /* the PHASE clock picks the cell (weight lane: frame = the stance-
         lock's own beat; the ground stands still while a plant cell holds) */
      G.frame = Math.floor(W.phi || 0) % STRIP.giant.n;
      G.flip = W.path[W.path.length - 1][0] < W.path[0][0];
      /* LANE PHYSICS: step-synced bob off the same gait clock as the frame —
         the body sinks into each plant and rises through the swing (the
         heavier giant amp = the pelvis compression). TORSO LAG: a shade of
         lean about the pinned feet, the bob table read TORSO_LAG.phi cells
         behind — mass arrives late. The proof below declares both, so the
         anchor law measures residuals only. */
      /* + a half-px time-based breath so a plant DWELL never reads static
         (the Sol lesson: resolve the gates or dwells read as freeze-frames);
         it rides the declared bob, so the anchor law sees residuals only */
      this._gBob = gaitBobY(GAIT.giant, W.phi || 0, BOB_AMP.giant) +
                   amb * 0.5 * Math.sin(2 * Math.PI * t / 4.4);
      this._gRot = (G.flip ? -1 : 1) * TORSO_LAG.deg *
        (2 * gaitAt(GAIT.giant, GAIT.giant.bob,
                    (W.phi || 0) - TORSO_LAG.phi) - 1);
      const b = placeStrip(this.giantStripN, STRIP.giant, [G.x, G.y],
                           GIANT_H.stand, G.frame,
                           { flip: G.flip, bob: this._gBob, rot: this._gRot });
      this.giantStripN.style.opacity = '1';
      this.giantBox = [G.x - (G.flip ? b.w - b.ax : b.ax), G.y - GIANT_H.stand,
                       b.w, b.h].map((v) => +v.toFixed(1));
    } else {
      this._gBob = 0;
      this._gRot = 0;
      this.giantStripN.style.opacity = '0';
    }

    /* THE BRIDGE/LOOP STRIP takes the frame from the cuts while it plays —
       one live picture, never two (the swap law). placeStrip pins each cell's
       measured foot anchor ON the mark, so the transitions cannot skate. */
    const BL = walking ? null : (this.giantBridge || this.giantLoop);
    if (walking) { this.giantBridge = null; this.giantLoop = null; }
    for (const [key, node] of Object.entries(this.gMotionN)) {
      if (BL && BL.key === key && G.pose !== 'away') {
        const b = placeStrip(node, GSTRIP[key], BL.at, BL.hPx, BL.frame,
                             { flip: BL.flip, sy: BL.sy || 1 });
        node.style.opacity = '1';
        this.giantBox = [BL.at[0] - (BL.flip ? b.w - b.ax : b.ax),
                         BL.at[1] - BL.hPx, b.w, b.h].map((v) => +v.toFixed(1));
      } else {
        node.style.opacity = '0';
      }
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
    if (!walking && !BL) this.giantBox = null;
    this._idleG = null; this._gLiveN = null;
    for (const [pose, node] of Object.entries(this.giantN)) {
      if (G.pose === 'away' || pose !== nodeKey || walking || BL) {
        node.style.opacity = '0';
        continue;
      }
      const art = ARTS[pose];
      const h = GIANT_H[G.pose];
      /* MICRO-IDLE (the King law, ported): the settled SEAT and STAND get
         the full breathe/sway pattern — translateY + a slow rotate + a
         scaleY breath, all about the pinned feet. The SPRAWL's snore is now
         a CHEST-RISE: scaleY about the head pin (period ~5 s, amplitude
         0.010 -> the outline's high edge rises <= 0.7 px against the pens'
         52 px y-clearance; the frontPen's tight 11.8 px gap is an X gap a
         scaleY cannot touch — verified against the ledger). The action
         tableaux (clutch/drink/stroke/grope) keep their bob alone: O.6
         holds the three meals pixel-comparable. */
      const settled = G.pose === 'seat' || G.pose === 'stand';
      const chest = G.pose === 'sprawl';
      const bob = chest ? 0 : 0.8 * br;
      const sway = settled ? amb * 0.25 * Math.sin(2 * Math.PI * t / 13.0) : 0;
      const sy = chest ? 1 + 0.010 * amb * Math.sin(2 * Math.PI * t / 5.0)
               : settled ? 1 + 0.0035 * br : 1;
      const b = pinCut(node, art, [G.x, G.y], h,
                       { flip: G.pose === 'stroke', bob, rot: rot + sway, sy });
      node.style.opacity = '1';
      /* mid-glide (the grope shuffle, the tip-over) is not a settle */
      if (!G.walk) {
        this._idleG = { pose: G.pose, dy: +bob.toFixed(3),
                        rot: +sway.toFixed(3), sy: +sy.toFixed(5) };
        this._gLiveN = node;
      }
      this.giantBox = [G.x - (art.pin[0] * h / art.px[1]),
                       G.y - (art.pin[1] * h / art.px[1]), b.w, b.h]
        .map((v) => +v.toFixed(1));
    }

    /* THE TELEPORT LAW (setkit swapActor): the giant's one live art node,
       tracked across ticks — every handoff between pictures (walk strip ->
       seat cut at the return arrivals, bridge end -> static clutch, clutch
       -> seat and seat -> sprawl in the meal chain, cut -> loop strip)
       crossfades ~120 ms while the outgoing picture slides to the incoming
       picture's drawn centre over ~180 ms, instead of substituting in one
       frame. The incoming node keeps its honest paint (every proof intact);
       the tween is DECLARED to the snapshot so the lap's [teleport] gate
       can tell a tween from a teleport. The walk already ENDS ON the seat
       mark (PATH.giantIn's last point IS MARKS['giant-seat']), so the
       arrival settle plays where the walk stops and the crossfade carries
       only the art's own box change. */
    const liveN = walking ? this.giantStripN
                : BL && G.pose !== 'away' ? this.gMotionN[BL.key]
                : G.pose !== 'away' ? this.giantN[nodeKey] : null;
    this.gSwap = swapActor(this._gGuard, liveN, t, [G.x, G.y],
                           { snap: this.st.reduced });
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
        /* the men slip in from the threshold, Ulysses at their head (K1).
           LANE PHYSICS: the eased arcs are PULSE-WARPED — the authored ease
           keeps the schedule, the granted step breathes at the crew strip's
           own cadence (dips at the plant frames, rises through the swing).
           Mean pulse is 1 and a lambda-3 correction keeps the accumulated
           lead/lag within a couple of px, so each file still arrives on the
           ease's own beat. */
        const from = MARKS.entry;
        const warp = (P, ease, from2, to, phase) => {
          const D = Math.hypot(to[0] - from2[0], to[1] - from2[1]);
          if (P._egT !== seg.t0) { P._egT = seg.t0; P._egs = 0; P._egAsk = 0; }
          const sAsk = ease * D;
          /* the gait clock: the strip's own (P.dist, trackStride) where a
             strip rides the man; the warped arc itself for Ulysses, whose
             entry has no strip node. Pulse depth rides the cadence law
             (gaitAtt) off the ask's own speed. */
          const clk = P.dist != null ? P.dist : (P._egs || 0);
          const vAsk = Math.max(0, sAsk - P._egAsk) / Math.max(dt, 1e-6);
          const att = gaitAtt(GAIT.crew, STRIP.crew.pxPerFrame, vAsk);
          const pulse = 1 + (gaitAt(GAIT.crew, GAIT.crew.pulse,
                                    clk / STRIP.crew.pxPerFrame + phase) - 1) * att;
          P._egs += Math.max(0, sAsk - P._egAsk) * pulse +
                    (sAsk - P._egs) * Math.min(1, 2 * dt);
          P._egs = Math.min(D, Math.max(0, P._egs));
          P._egAsk = sAsk;
          const kw = D > 0 ? P._egs / D : ease;
          P.x = lerp(from2[0], to[0], kw);
          P.y = lerp(from2[1], to[1], kw);
        };
        for (let i = 0; i < CREW_N; i++) {
          const ki = easeInOut(clamp01(segK * 1.5 - i * 0.035));
          const P = this.pose['c' + i], W = want['c' + i];
          if (!W.vis) continue;
          warp(P, ki, [from[0] + 8, from[1]], W.at, i);
          P.op = clamp01(segK * 6 - i * 0.1);
          W.vis = -1;
        }
        const ku = easeInOut(clamp01(segK * 1.5));
        warp(this.pose.u, ku, from, want.u.at, 0);
        this.pose.u.op = clamp01(segK * 6);
        want.u.vis = -1;
      } else if (seg.name === 'seize') {
        /* the two taken: the highest-numbered men alive when the clutch
           began (seizeBase, fixed at startSeg so the mid-seg decrement
           cannot shift them). THE HANDOFF LAW (weight lane): they STAND on
           their huddle spots — the old glide toward the clutch raced the
           strip and had them teleporting into it — and are handed off to
           the strip art AT THE CONTACT BEAT (the seize bridge's own c3,
           where the hands close ON their layer position), a 0.18 s cut
           into the closing fist. The identical staging, all three meals. */
        const kc = SEIZE_WIN[0] + SEIZE_CONTACT * (SEIZE_WIN[1] - SEIZE_WIN[0]);
        for (const i of [S.seizeBase - 1, S.seizeBase - 2]) {
          if (i < 0 || i >= CREW_N) continue;
          const P = this.pose['c' + i];
          const from = FORM.huddle[i];
          P.x = from[0];
          P.y = from[1];
          P.op = 1 - clamp01((segK - kc) / 0.03);    // into the closing hands
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
        P.away = false;
        continue;
      }
      if (!W.vis) { P.op = damp(P.op, 0, 5.0, dt); continue; }
      const rem = Math.hypot(P.x - W.at[0], P.y - W.at[1]);
      /* `away` = not yet ON the formation's mark: the parking/perspective
         laws sample SETTLED feet, and the stride flag alone flickers at the
         gait pulse's plant dips (round-7 lap: mid-walk men read "settled"
         inside boxes their route crosses) */
      P.away = rem > 3;
      const far = rem > 250;
      if (P.op < 0.06) { P.x = W.at[0]; P.y = W.at[1]; P.away = false; }
      if (far && P.op >= 0.06) P.op = damp(P.op, 0, 5.0, dt);
      else {
        /* LANE PHYSICS: walkToward2 — eased on/off, per-step pulse at the
           crew strip's own cadence, and a small arrival settle in place of
           the damp's terminal stand-cut drift. The cap (WALK_V.man) is
           still the anti-skate law's own bound. THE HEARTH DETOUR (audit
           #2/#8) hands the walk a legal goal — around the ring, never
           through it. */
        const g = parkedGoal(P.x, P.y, W.at[0], W.at[1]);
        walkToward2(P, g[0], g[1], 2.2, WALK_V.man, dt,
                    { gait: GAIT.crew, pxPerFrame: STRIP.crew.pxPerFrame });
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
    this._idleC = [];
    for (let i = 0; i < CREW_N; i++) {
      const P = this.pose['c' + i];
      this.trackStride(P, dt);
      const carry = (S.form === 'racks' ||
                     (S.form === 'stakefive' && i < 4)) && P.op > 0.05;
      const striding = P.walking && !carry && !dragged;
      /* MICRO-IDLE (the King law, ported): the standing man breathes the
         full pattern, DESYNCED per actor index — a row of synchronized
         breathers reads mechanical, so the bob keeps its i*1.1 phase and
         the sway takes its own i*0.7. A carried load keeps the bob alone
         (braced men do not sway). */
      const brC = amb * Math.sin(2 * Math.PI * t / 5.3 + i * 1.1);
      const bob = 0.5 * brC;
      const swayC = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0 + i * 0.7);
      const syC = 1 + 0.0035 * brC;
      const stand = i % 2 ? ART.crewB : ART.crewA;
      pinCut(this.crew[i], stand, [P.x, P.y], SCALE.crew,
             { bob, flip: i % 3 === 1, rot: swayC, sy: syC });
      pinCut(this.carry[i], ART.crewCarry, [P.x, P.y], SCALE.crew * 0.96, { bob });
      if (P.op > 0.5 && !striding && !carry) {
        this._idleC.push({ i, dy: +bob.toFixed(3), rot: +swayC.toFixed(3),
                           sy: +syC.toFixed(5) });
      }
      this.crew[i].style.opacity = (carry || striding ? 0 : P.op).toFixed(3);
      this.carry[i].style.opacity = (carry ? P.op : 0).toFixed(3);
      if (striding) {
        /* variety law: per-man frame phase (+i), flip from his own travel.
           LANE PHYSICS: step-synced bob, same gait clock (+i phase) as the
           frame — declared in the proof (P.gbob), so the anchor law holds. */
        P.frame = (Math.floor(P.dist / STRIP.crew.pxPerFrame) + i) % STRIP.crew.n;
        P.gbob = gaitBobY(GAIT.crew, P.dist / STRIP.crew.pxPerFrame + i,
                          BOB_AMP.crew);
        placeStrip(this.crewStripN[i], STRIP.crew, [P.x, P.y], SCALE.crew,
                   P.frame, { flip: P.face < 0, bob: P.gbob });
        this.crewStripN[i].style.opacity = P.op.toFixed(3);
      } else {
        P.gbob = 0;
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
    /* MICRO-IDLE (the King law, ported VERBATIM from room.js stepKing):
       translateY(0.7*br) rotate(sway) scaleY(1+0.0035*br) about the pinned
       feet — on the SETTLED poses (stand/offer/sword). The walk cut keeps
       the bob alone (the stride owns his motion) and the braced drive holds
       still but for the breath. */
    const brU = amb * Math.sin(2 * Math.PI * t / 4.6);
    const bobU = 0.7 * brU;
    const swayU = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0);
    const syU = 1 + 0.0035 * brU;
    if (twisting) {
      U.frame = Math.floor(drive / (STRIP.twist.period / STRIP.twist.n))
                % STRIP.twist.n;
      const b = placeStrip(this.twistN, STRIP.twist, [U.x, U.y], 66, U.frame);
      this.twistN.style.opacity = U.op.toFixed(3);
      this.uBox = [U.x - b.ax, U.y - 66, b.w, b.h].map((v) => +v.toFixed(1));
    } else {
      this.twistN.style.opacity = '0';
    }
    this._idleU = null; this._uLiveN = null;
    for (const [pose, node] of Object.entries(this.uN)) {
      if (pose !== kind || twisting) { node.style.opacity = '0'; continue; }
      const art = { stand: ART.ulyssesStand, walk: ART.ulyssesWalk,
                    offer: ART.ulyssesOffer, sword: ART.ulyssesSword,
                    drive: ART.ulyssesDrive }[pose];
      const h = pose === 'drive' ? 66 : SCALE.ulysses;
      const settledU = !moving && (pose === 'stand' || pose === 'offer' || pose === 'sword');
      const b = pinCut(node, art, [U.x, U.y], h,
                       { bob: bobU, flip: U.flip,
                         rot: settledU ? swayU : 0, sy: settledU ? syU : 1 });
      node.style.opacity = U.op.toFixed(3);
      if (settledU && U.op > 0.5) {
        this._idleU = { dy: +bobU.toFixed(3), rot: +swayU.toFixed(3),
                        sy: +syU.toFixed(5) };
        this._uLiveN = node;
      }
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
  stepFlock(t, dt, amb) {
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
       REMOVED while the strip runs — the STEP-SYNCED bob below rides the
       gait clock instead. The strip is AUTHORED LEFT, the stream's own way:
       no flip. LANE PHYSICS: the eased ask now spends ARC LENGTH
       (alongPathArc — alongPath's per-segment fractions made every polyline
       vertex a +47% one-frame speed pop, audit-motion.md #9) and is
       PULSE-WARPED at the strip's own plant cadence, lambda-3 corrected so
       the schedule keeps the ease's own beat. */
    for (const [i, node] of this.rams.entries()) {
      let at = null;
      const gait = this.ramGait[i];
      if (fl && k < 1 && fl.mode === 'escape') {
        /* DEPARTURE JITTER (weight lane): index-seeded start beats and
           window speeds in place of the even 0.07 lattice — the stream
           leaves in its own broken order, never as a conveyor */
        const ki = clamp01((k - RAM_DEP[i % RAM_DEP.length]) /
                           RAM_WIN[i % RAM_WIN.length]);
        if (ki > 0 && ki < 1) {
          if (gait.wT !== fl.t0) { gait.wT = fl.t0; gait.sW = 0; gait.ask = 0; }
          const sAsk = easeInOut(ki) * FLOCK_LEN;
          const vAsk = Math.max(0, sAsk - gait.ask) / Math.max(dt, 1e-6);
          const att = gaitAtt(GAIT.ram, STRIP.ram.pxPerFrame, vAsk);
          const pulse = 1 + (gaitAt(GAIT.ram, GAIT.ram.pulse,
                                    gait.dist / STRIP.ram.pxPerFrame + i) - 1) * att;
          gait.sW += Math.max(0, sAsk - gait.ask) * pulse +
                     (sAsk - gait.sW) * Math.min(1, 2 * dt);
          gait.sW = Math.min(FLOCK_LEN, Math.max(0, gait.sW));
          gait.ask = sAsk;
          at = alongPathArc(PATH.flockOut, gait.sW);
          at[1] += (i % 3 - 1) * 6;
        }
      }
      if (!at) {
        node.style.opacity = '0';
        gait.dist = 0; gait.lx = null; gait.at = null; gait.wT = null;
        continue;
      }
      const dd = gait.lx === null ? 0 : Math.hypot(at[0] - gait.lx, at[1] - gait.ly);
      gait.dist = dd < STRIDE_TELEPORT ? gait.dist + dd : 0;
      gait.lx = at[0]; gait.ly = at[1]; gait.at = at.slice();
      gait.frame = (Math.floor(gait.dist / STRIP.ram.pxPerFrame) + i) % STRIP.ram.n;
      /* step-synced bob, the same gait clock (+i) as the frame; declared in
         the strip proof so the anchor law measures the residual */
      gait.bob = gaitBobY(GAIT.ram, gait.dist / STRIP.ram.pxPerFrame + i,
                          BOB_AMP.ram);
      placeStrip(node, STRIP.ram, at, RAM_H.walk, gait.frame,
                 { bob: gait.bob });
      node.style.opacity = '1';
    }

    /* THE LASHED TRIOS (LANE PHYSICS — audit-motion.md worst offender #1):
       they appear at the lash and WALK at the escape — the burdened glide
       integrator (glideStep: SLUNG_V cap, ease both ends, the ram strip's
       own pulse) on the arc-length path, with the cell cadence applied to
       the static cut as bob + sway about the pin. They start on the walkers'
       heels and arrive before the seg spends itself. */
    for (const [i, node] of this.pairs.entries()) {
      let at = null, op = 0, bob = 0, rot = 0;
      const seg = S.seg;
      const G2 = this.pairGait[i];
      if (seg && seg.name === 'lash-trios') {
        const sk = clamp01((t - seg.t0) / seg.dur);
        at = TRIOS[i];
        op = clamp01((sk - 0.25 - i * 0.25) / 0.3);
      } else if (fl && fl.mode === 'escape') {
        if (k >= 0.24 + i * 0.06) {
          if (G2.t0 !== fl.t0) {
            G2.t0 = fl.t0; G2.run = 0;
            G2.s = k > 0.95 ? FLOCK_LEN : 0;    // a settled jump lands parked
          }
          glideStep(G2, FLOCK_LEN, SLUNG_V, dt, i * 3);
          at = alongPathArc(PATH.flockOut, G2.s);
          const g = slungGait(G2.s, i * 3, BOB_AMP.pair);
          bob = g.bob; rot = g.rot;
          const fout = G2.s / FLOCK_LEN;
          op = Math.min(clamp01(G2.run / 0.4),
                        fout < 0.92 ? 1 : clamp01((1 - fout) / 0.08));
        }
      } else if (S.form === 'under' && S.giant.blinded && !fl) {
        at = TRIOS[i]; op = 1;                     // lashed, waiting for dawn
      }
      if (!at) {
        node.style.opacity = '0'; G2.at = null; this._pairAt[i] = null;
        continue;
      }
      pinCut(node, ART.ramPairSlung, at, RAM_H.pair,
             { flip: !!(fl && fl.mode === 'escape'), bob, rot });
      node.style.opacity = op.toFixed(3);
      G2.at = at.slice();                    // the gait probe reads the mark
      this._pairAt[i] = at.slice();          // the shadow pass reads the mark
    }

    /* THE GREAT RAM: staged at the rail (G5), slung under the reader's
       click, last of all across the floor, halted under the palm, and out.
       Position by PRIORITY, never by feedback from its own last frame:
       clear-of-the-cave > the free-men exit > pinned at the mouth > the
       escape path > the rail. LANE PHYSICS: every leg he covers is the same
       burdened gait walk the trios get (glideStep + bob/sway at the ram
       strip's cadence) — 9.9 m of zero-leg glide was the audit's single
       worst number. While he STANDS the old 2.1 s hover breath returns. */
    const great = this.ramGreatN, slung = this.ramSlungN;
    let gAt = null, slungK = 0, gMoving = false, gPhi = 0;
    if (S.ramOn) {
      slungK = S.sling > -1e8 ? clamp01((t - S.sling) / 1.4) : 0;
      const seg = S.seg;
      if (S.ramHome) {
        gAt = S.ramHome.slice();
      } else if (seg && seg.name === 'free-men') {
        /* v-11: he trots clear — walked now, not slid */
        const sk = clamp01((t - seg.t0) / seg.dur);
        const G2 = this.gramTrot;
        if (G2.t0 !== seg.t0) {
          G2.t0 = seg.t0; G2.run = 0;
          G2.s = sk > 0.9 ? TROT_LEN : 0;         // a settled jump lands home
        }
        glideStep(G2, TROT_LEN, TROT_V, dt, 0);
        gAt = alongPathArc(TROT_PATH, G2.s);
        gMoving = G2.s < TROT_LEN - 1e-3; gPhi = G2.s;
        if (!gMoving) {
          S.ramHome = [466, 452];        // he trots clear, and STAYS clear
          S.sling = -1e9;                // …with the man off him
          slungK = 0;
        }
      } else if (S.ramPinned) {
        const RP = S.ramPinned;
        if (!RP.g) {
          const len = Math.hypot(MARKS['ram-at-mouth'][0] - RP.from[0],
                                 MARKS['ram-at-mouth'][1] - RP.from[1]);
          RP.g = { s: t - RP.t0 > 1.1 ? len : 0, run: 0, len };
        }
        glideStep(RP.g, RP.g.len, SLUNG_V, dt, 0);
        gAt = alongPathArc([RP.from, MARKS['ram-at-mouth']], RP.g.s);
        gMoving = RP.g.s < RP.g.len - 1e-3; gPhi = RP.g.s;
      } else if (fl && fl.mode === 'escape') {
        if (k >= 0.38) {
          const G2 = this.gramEsc;
          if (G2.t0 !== fl.t0) {
            G2.t0 = fl.t0; G2.run = 0;
            G2.s = k > 0.95 ? ESC_LEN : 0;        // a settled jump lands parked
          }
          glideStep(G2, ESC_LEN, SLUNG_V, dt, 0);
          gAt = alongPathArc(PATH.ramEscape, G2.s);
          gMoving = G2.s < ESC_LEN - 1e-3; gPhi = G2.s;
        } else {
          gAt = MARKS['ram-stand'].slice();
        }
      } else {
        gAt = MARKS['ram-stand'].slice();
      }
    }
    if (!gAt) {
      great.style.opacity = '0'; slung.style.opacity = '0';
      this.ramBox = null;
    } else {
      let bob = amb * 0.4 * Math.sin(2 * Math.PI * t / 2.1), rot = 0;
      if (gMoving) {
        const g = slungGait(gPhi, 0, BOB_AMP.gram);
        bob = g.bob; rot = g.rot;
      }
      this._gramMoving = gMoving;      // mid-glide is not a settle (parking)
      const b1 = pinCut(great, ART.ramGreat, gAt, RAM_H.great, { bob, rot });
      pinCut(slung, ART.ramGreatSlung, gAt, RAM_H.greatSlung, { bob, rot });
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
                   nodes: [...Object.values(this.giantN), this.giantStripN,
                           ...Object.values(this.gMotionN)] });
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
    /* THE OCCLUDERS sort at their GROUND lines (the pews-front law): a
       settled actor upstage of an occluder's ground runs behind its stones,
       a nearer actor is painted over them — the same baseline arithmetic
       as every figure. */
    for (const o of this.occN) entries.push({ y: o.ground, nodes: [o.wrap] });
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
       hearth; at the drive it lies over the sprawled head (nearer). While
       it HEATS it sorts just past the fire ring occluder's ground (503):
       the shaft enters the pit OVER the near lip — the report's own law
       ("an occluder is only safe against actors clearly upstage of the
       LOCAL ground", explore-grounding.md §3), and the shaft's butt end is
       not clearly upstage of the front crown's base. */
    const d = this.ruseT();
    if (d !== null && d < DRIVE.fright) return SPRAWL.at[1] + 12;
    if (d !== null) return 549;
    return 504;
  }

  /** THE OCCLUDER MIRROR (the room-dim law's own composite): each wrapper's
   *  five state layers copy the plate stack's ORDER and OPACITIES, so the
   *  wrapper always shows exactly the pixels the plates are showing inside
   *  the cut — through every crossfade and dark dip. */
  stepOccluders() {
    const order = [];
    for (const child of this.plateWrap.children) {
      for (const [name, node] of Object.entries(this.plates)) {
        if (node === child) { order.push(name); break; }
      }
    }
    const sig = order.join(',');
    for (const o of this.occN) {
      if (sig !== this._occOrder) {
        for (const name of order) o.wrap.appendChild(o.layers[name]);
      }
      for (const name of order) {
        o.layers[name].style.opacity = this.plates[name].style.opacity;
      }
    }
    this._occOrder = sig;
  }

  /** THE SHADOW PASS (Explorer C — chase.js paintRigs, ported): one shadow
   *  per live picture, placed by the registry anchor on the actor's own
   *  foot mark, scaled by the actor's k = drawnH / cutH, opacity
   *  (0.42 + 0.30 * s) * actorOp. Runs after every position is written;
   *  paints into the group BEFORE the actors, so it can never cover one. */
  shadowPut(node, name, at, k, op) {
    const S = SHADOW[name];
    box(node, at[0] - S.anchor[0] * k, at[1] - S.anchor[1] * k,
        S.size[0] * k, S.size[1] * k);
    const o = (0.42 + 0.30 * shadowS(at[1])) * op;
    node.style.opacity = o.toFixed(3);
    if (o > 0.005) {
      this._shadows.push({ id: this._shadowId, name, at: [+at[0].toFixed(1),
        +at[1].toFixed(1)], s: +shadowS(at[1]).toFixed(3), op: +o.toFixed(3),
        box: this.drawnBox(node) });
    }
  }

  paintShadows() {
    const S = this.state, G = S.giant, U = this.pose.u;
    this._shadows = [];
    /* the giant: the pose cut's shadow; the walk strip stands on the stand
       shadow, a bridge/loop on the pose the strip is performing */
    const BL = this.giantBridge || this.giantLoop;
    const gKey = G.pose === 'away' ? null
      : this.giantWalking ? 'stand'
      : BL ? BRIDGE_SHADOW[BL.key]
      : (G.pose === 'doorway' ? 'grope' : G.pose);
    const gAt = BL && !this.giantWalking ? BL.at : [G.x, G.y];
    /* the drawn height is the LIVE picture's (the doorway draws the grope
       cut at the seated 165, not the grope walk's 210) */
    const gHpx = this.giantWalking ? GIANT_H.stand
      : BL ? GIANT_H[gKey] : GIANT_H[G.pose];
    const GART = { stand: ART.giantStand, seat: ART.giantSeated,
                   clutch: ART.giantClutch, drink: ART.giantDrink,
                   sprawl: ART.giantSprawl, grope: ART.giantGrope,
                   stroke: ART.giantStroke };
    for (const [pose, node] of Object.entries(this.giantShN)) {
      if (pose !== gKey) { node.style.opacity = '0'; continue; }
      this._shadowId = 'giant';
      this.shadowPut(node, GIANT_SHADOW[pose], gAt,
                     gHpx / GART[pose].px[1], 1);
    }
    /* ulysses: the kind's own shadow (the twist strip is the drive stance) */
    const uKind = this.twisting ? 'drive' : U.kind;
    const UART = { stand: ART.ulyssesStand, walk: ART.ulyssesWalk,
                   offer: ART.ulyssesOffer, sword: ART.ulyssesSword,
                   drive: ART.ulyssesDrive };
    for (const [kind, node] of Object.entries(this.uShN)) {
      if (kind !== uKind || !(U.op > 0.005)) { node.style.opacity = '0'; continue; }
      const h = kind === 'drive' ? 66 : SCALE.ulysses;
      this._shadowId = 'ulysses';
      this.shadowPut(node, 'ulysses-' + kind, [U.x, U.y],
                     h / UART[kind].px[1], U.op);
    }
    /* the crew: the stand shadow serves the stand cut AND the walk strip
       (the feet are the same feet); a carried load takes the carry shadow */
    for (let i = 0; i < CREW_N; i++) {
      const P = this.pose['c' + i];
      const carry = P.carry;
      this._shadowId = 'crew' + i;
      if (P.op > 0.005 && !carry) {
        this.shadowPut(this.crewShN[i], i % 2 ? 'crew-b-stand' : 'crew-a-stand',
                       [P.x, P.y], SCALE.crew / (i % 2 ? ART.crewB : ART.crewA).px[1],
                       P.op);
      } else this.crewShN[i].style.opacity = '0';
      if (P.op > 0.005 && carry) {
        this.shadowPut(this.carryShN[i], 'crew-carry', [P.x, P.y],
                       SCALE.crew * 0.96 / ART.crewCarry.px[1], P.op);
      } else this.carryShN[i].style.opacity = '0';
    }
    /* the great ram (and his slung double), the lashed trios, the walkers */
    const gOp = +this.ramGreatN.style.opacity || 0;
    const sOp = +this.ramSlungN.style.opacity || 0;
    this._shadowId = 'great-ram';
    if (S.ramAt && gOp > 0.005) {
      this.shadowPut(this.ramShN.great, 'ram-great', S.ramAt,
                     RAM_H.great / ART.ramGreat.px[1], gOp);
    } else this.ramShN.great.style.opacity = '0';
    if (S.ramAt && sOp > 0.005) {
      this.shadowPut(this.ramShN.slung, 'ram-great-slung', S.ramAt,
                     RAM_H.greatSlung / ART.ramGreatSlung.px[1], sOp);
    } else this.ramShN.slung.style.opacity = '0';
    for (const [i, node] of this.ramShN.pairs.entries()) {
      const at = this._pairAt && this._pairAt[i];
      const op = +this.pairs[i].style.opacity || 0;
      this._shadowId = 'pair' + i;
      if (at && op > 0.005) {
        this.shadowPut(node, 'ram-pair-slung', at,
                       RAM_H.pair / ART.ramPairSlung.px[1], op);
      } else node.style.opacity = '0';
    }
    for (const [i, node] of this.ramShN.walk.entries()) {
      const g = this.ramGait[i];
      const op = +this.rams[i].style.opacity || 0;
      this._shadowId = 'ram' + i;
      if (g.at && op > 0.005) {
        this.shadowPut(node, 'ram-walk', g.at,
                       RAM_H.walk / ART.ramWalk.px[1], op);
      } else node.style.opacity = '0';
    }
  }

  /* ---- harness --------------------------------------------------------------- */
  /** the node the STROKE is being drawn on right now (the O.11 gate measures
   *  the palm off the rendered picture, whichever machinery is painting it) */
  strokeVisN() {
    return this.giantLoop && this.giantLoop.key === 'stroke'
      ? this.gMotionN.stroke : this.giantN.stroke;
  }

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
    /* the [idle] proof wants the RENDERED box — transform applied — where
       giantBox/uBox are the parking law's arithmetic (transform-free) boxes */
    const pbox = (e) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const a = this.st.toPlate(r.left, r.top);
      const b = this.st.toPlate(r.right, r.bottom);
      return [+a.x.toFixed(2), +a.y.toFixed(2),
              +(b.x - a.x).toFixed(2), +(b.y - a.y).toFixed(2)];
    };
    return {
      /* MICRO-IDLE (the King law): the settled principals' live breath —
         self-reported amplitudes plus the rendered (transform-applied) box
         the lap samples 3 s apart */
      idle: {
        u: this._idleU ? { ...this._idleU, box: pbox(this._uLiveN) } : null,
        giant: this._idleG ? { ...this._idleG, box: pbox(this._gLiveN) } : null,
        crew: this._idleC || [],
      },
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
               walking: !!S.giant.walk,   // mid-walk is not a settle (the
                                          // parking law samples landings)
               mark: [+S.giant.x.toFixed(1), +S.giant.y.toFixed(1)],
               box: this.giantBox || null,
               /* the teleport law's declaration: the active handoff tween */
               tween: this.gSwap ? this.gSwap.k : null },
      sprawl: (() => {
        /* THE AMENDED SPRAWL PARKING LAW (round-7 placement audit #5 —
           SUPPORT + OCCLUSION, see header): the honest-length body may
           OVERLAP dressing it lies in front of, but its BASELINE (the
           support line, the box bottom) must rest on open floor — every
           obstacle box that shares x with the body must bottom out >= 8 px
           UPSTAGE of the baseline. Violations are named. */
        const b = sprawlBox;
        const baseline = b ? b[1] + b[3] : null;
        const OBS = { mainPen: OBJ.mainPen, frontPen: OBJ.frontPen,
                      firewood: OBJ.firewood, bed: OBJ.bed,
                      logsRight: OBJ.logsRight, logBundle: OBJ.logBundle,
                      milkTub: OBJ.milkTub, clayBowl: OBJ.clayBowl };
        const violations = b ? Object.entries(OBS)
          .filter(([, r]) => b[0] < r[2] && b[0] + b[2] > r[0] &&
                             r[3] > baseline - 8)
          .map(([name]) => name) : null;
        return {
          mark: SPRAWL.at.slice(), ledgerMark: SPRAWL.ledger.slice(),
          eye: EYE.slice(),             // the drive's target — O.9's own law
          box: sprawlBox,
          clear: sprawlBox ? {
            mainPen: this.clearance(sprawlBox, OBJ.mainPen),
            frontPen: this.clearance(sprawlBox, OBJ.frontPen),
            firewood: this.clearance(sprawlBox, OBJ.firewood),
          } : null,
          support: b ? { baseline: +baseline.toFixed(1), violations } : null,
          ok: b ? violations.length === 0 : null,
        };
      })(),
      /* THE TROUPE: the headcount law and per-actor drawn boxes */
      cast: {
        formation: S.form, meals: S.meals, crewN,
        ulysses: { mark: [+this.pose.u.x.toFixed(1), +this.pose.u.y.toFixed(1)],
                   op: +this.pose.u.op.toFixed(3), kind: this.pose.u.kind,
                   box: this.uBox || null },
        crew: this.crew.map((node, i) => ({
          mark: [+this.pose['c' + i].x.toFixed(1), +this.pose['c' + i].y.toFixed(1)],
          op: +this.pose['c' + i].op.toFixed(3),
          walking: !!(this.pose['c' + i].walking || this.pose['c' + i].away),
                                                   // mid-stride OR short of the
                                                   // mark: the parking +
                                                   // perspective laws sample
                                                   // SETTLED feet only
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
               moving: !!this._gramMoving,
               slung: S.sling > -1e8, box: this.ramBox },
        /* the lashed trios' drawn boxes — the [perspective]/[parking] gates
           measure the pair cuts at stock scale (audit #9/#10) */
        pairs: this.pairs.map((n, i) => ({
          op: +(+n.style.opacity || 0).toFixed(3),
          at: this._pairAt[i] ? this._pairAt[i].map((v) => +v.toFixed(1)) : null,
          box: this.drawnBox(n),
        })),
      },
      /* THE STRIP PROOF (the sherlock walk law): per live strip, the frame
         and the foot measured off the RENDERED box vs the mark the paint was
         asked for — the lap holds cycling (>= 2 distinct frames, the 'walk
         strip never cycled' gate) and |dx|,|dy| against these. LANE PHYSICS:
         a walking box also carries the declared step-bob (translateY about
         the foot origin), so the mark handed to the proof is bob-shifted —
         the anchor law measures the transform's RESIDUAL, exactly the
         rowers' documented bench-bob precedent. */
      strips: {
        giant: (() => {
          if (!this.giantWalking) return null;
          const gp = stripProof(this.st, this.giantStripN, STRIP.giant,
                                S.giant.frame || 0,
                                [S.giant.x, S.giant.y + (this._gBob || 0)],
                                !!S.giant.flip, { rot: this._gRot || 0 });
          /* the plant dwell, DECLARED: the honest optical stance gate
             tracks the rendered foot pixels across exactly this window */
          return gp ? { ...gp, dwell: S.giant.walk && S.giant.walk.dwell > 0
                                        ? 1 : 0 } : null;
        })(),
        crew: this.crew.map((_, i) => {
          const P = this.pose['c' + i];
          return P.striding
            ? stripProof(this.st, this.crewStripN[i], STRIP.crew, P.frame,
                         [P.x, P.y + (P.gbob || 0)], P.face < 0)
            : null;
        }),
        twist: this.twisting
          ? stripProof(this.st, this.twistN, STRIP.twist, this.pose.u.frame || 0,
                       [this.pose.u.x, this.pose.u.y], false)
          : null,
        rams: this.rams.map((n, i) => {
          const g = this.ramGait[i];
          return g.at && +n.style.opacity > 0
            ? stripProof(this.st, n, STRIP.ram, g.frame,
                         [g.at[0], g.at[1] + (g.bob || 0)], false)
            : null;
        }),
        /* THE BRIDGES (play-once) and LOOPS (verb-clock), same proof style:
           frame + the foot off the RENDERED box vs the mark it was pinned on.
           `k` is the act's own progress (the frame's driver); `play` numbers
           the drink bridge's three performances. */
        bridge: this.giantBridge ? {
          key: this.giantBridge.key, k: this.giantBridge.k,
          play: this.giantBridge.play || 1, n: GSTRIP[this.giantBridge.key].n,
          sy: this.giantBridge.sy || 1,          // the impact squash, declared
          ...stripProof(this.st, this.gMotionN[this.giantBridge.key],
                        GSTRIP[this.giantBridge.key], this.giantBridge.frame,
                        this.giantBridge.at, this.giantBridge.flip,
                        { sy: this.giantBridge.sy || 1 }),
        } : null,
        loop: this.giantLoop ? {
          key: this.giantLoop.key, n: GSTRIP[this.giantLoop.key].n,
          ...stripProof(this.st, this.gMotionN[this.giantLoop.key],
                        GSTRIP[this.giantLoop.key], this.giantLoop.frame,
                        this.giantLoop.at, this.giantLoop.flip),
        } : null,
      },
      /* the drink bridge's completed performances — a pure function of the
         bowl's own clock (a play is complete once its drain has run
         DRINK_BRIDGE seconds), so the lap can hold playCount 3 */
      drinkPlays: S.pour < -1e8 ? 0
        : POURS.drains.filter(([a]) => S.t - S.pour >= a + DRINK_BRIDGE).length,
      /* the declared leaf-3/leaf-4 ambiguity (header): true while the world
         was staged by a VIRGIN cave-predawn and no Beat-V hook has spoken */
      beatVAmbiguous: (S.swap ? S.swap.to : S.stateName) === 'predawn' &&
                      !S.giant.blinded && S.giant.pose === 'sprawl' &&
                      S.meals === 1,
      dim: { scrim: +(+this.scrim.style.opacity || 0).toFixed(3),
             matrix: DIM_MATRIX.slice(), painted: false },
      /* EXPLORER C's own proofs: the live shadows (per settled principal:
         the mark, the depth share, the applied opacity, the drawn box), the
         under-the-actors group order, the occluders' paint order (DOM
         indices inside the sorted actor group) and the swept marks. */
      grounding: this.groundingSnap(),
    };
  }

  groundingSnap() {
    const idx = (n) => (n ? Array.prototype.indexOf.call(this.actors.children, n) : -1);
    const liveOf = (nodes) => nodes.find((n) => (+n.style.opacity || 0) > 0.05) || null;
    const gLive = liveOf([...Object.values(this.giantN), this.giantStripN,
                          ...Object.values(this.gMotionN)]);
    const uLive = liveOf([...Object.values(this.uN), this.twistN]);
    return {
      under: !!(this.shadowG.compareDocumentPosition(this.actors) &
                Node.DOCUMENT_POSITION_FOLLOWING),
      shadows: this._shadows || [],
      occ: this.occN.map((o) => ({ id: o.id, ground: o.ground,
        at: o.origin.slice(), dom: idx(o.wrap),
        op: +(o.layers[this.state.swap ? this.state.swap.to
                                       : this.state.stateName].style.opacity || 0) })),
      dom: {
        giant: idx(gLive), ulysses: idx(uLive),
        crew: this.crew.map((n, i) => {
          const P = this.pose['c' + i];
          if (!(P.op > 0.05)) return -1;
          return idx(P.striding ? this.crewStripN[i] : P.carry ? this.carry[i] : n);
        }),
      },
      swept: { suppliant: SWEPT.suppliant.slice(), scheme: SWEPT.scheme.slice(),
               ledger: { suppliant: MARKS.suppliant.slice(),
                         scheme: MARKS.scheme.slice() } },
    };
  }
}

export { FOCUS, MARKS, OBJ, SPRAWL, EYE, EMIS, LIGHT, DIM_MATRIX, SCALE,
         GATES, HOLD_AT, POURS, DRIVE, SEAMS, FORM, PATH, FLOORS, SWEPT, OCC };
