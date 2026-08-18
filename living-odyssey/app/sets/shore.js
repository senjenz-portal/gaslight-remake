/**
 * sets/shore.js — the goat island and the strait. Leaf 1, Beat I: THE TALE
 * BEGUN.
 *
 * ONE PLATE CARRIES TWO SHORES. The painting holds the whole of Beat I's
 * geography in a single 1408x768 diorama: the island camp on the near sand
 * (fire ring 405..475, the two beached galleys), the black strait with its
 * moonpath up the middle, and the mainland lobe upper-right — the laurel
 * mouth, the yard wall, and the three smoke columns of the lawless race.
 * Every number below is the scene ledger's (tools/ody/ledger.json, lane
 * ody-scene-ledger) or the layer lane's (tools/ody/layers-shore.json);
 * nothing here is re-measured.
 *
 * SCALE: 11.3 px/m, measured on ship-2 — the beached twenty-oarer, 15 m
 * tip-to-tip, sternpost curl (516,432) to prow curl (686,428) = 170 px. A
 * 1.75 m Ulysses is therefore 20 px tall, and the crew 19; small is the
 * truth of this plate, and the LENSES do the work of getting close.
 *
 * TWO PAINTED STATES, not filters (the room-dim law):
 *     shore.jpg        night-mist — fire lit, moonpath        i-00..i-04
 *     shore-day.jpg    day — goats out, fire dead              i-05 onward
 * The day state is an ACT (`shore-day`) and a crossfade; its emissive gains
 * are the layer lane's own stateLightMap (fire 0, moons 0.5).
 *
 * THE STACK (DOM order is z-order, layers-shore.json drawOrder + two honest
 * insertions, both documented where they are built):
 *     shore / shore-day        the painted masters, crossfading
 *     shore-fog (screen)       the waterline breath
 *     smoke breath x3          the far-lobe columns' life (O.1 carrier)
 *     dim scrim                see THE DIM below
 *     ACTORS (isolated)        Ulysses, the crew, the shouldered skin
 *     shore-bloom (screen)     the measured additive fire bloom
 *     EMIS x4                  fire + the moonpath's three anchors
 *
 * THE DIM — AN HONEST DEVIATION. Every sherlock set dimmed under an inset by
 * crossfading to a lane-painted relight plate. The shore lane shipped NO
 * relight master (layers-shore.json states: shore, shore-day — that is all),
 * so when the wineskin plate rises the world dims under a neutral-dark scrim
 * and the actors take an AUTHORED cool matrix, composed to the night
 * master's own palette rather than measured from a painting that does not
 * exist. Both numbers are exported and the snapshot flags `painted: false`,
 * so a lap can see the deviation instead of trusting it.
 *
 * THE CROSSING IS LENS TRAVEL, NOT A SHIP CUT. The G1 gate's `crossing` was
 * offered a painted-ship glide IF the ledger had registered a hull crop box.
 * It did not: ship-2 is registered as two curl POINTS and a hull centre
 * (sternCurl/prowCurl/hullCentre), which is a click law and a yardstick, not
 * a croppable box — and no ship cut ships in assets/actor/. So the strait is
 * performed the way the ledger's own lens table stages it: the camera cuts
 * to the hull, travels the moonpath (the glint anchors brighten under it —
 * oars in the water), and lands on the ledger's i-08 two-keyframe push,
 * cavemouth-push-from -> cavemouth-push-to, verbatim. The oars are heard
 * (gateSfx `oars`, cued by the engine) at the travel they are staged by.
 *
 * LAW: no wall-clock reads; everything below is a function of the `t` handed
 * to step(). A settled act leaves the world at its END (WIRING §2).
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, floorY,
         emissives, placeStrip, stripProof, stripPxPerFrame,
         walkToward2, gaitProfile, gaitAt, gaitBobY,
         gradedActor } from '../setkit.js';
import { STRIPS } from '../strips.js';
import { SHADOWS } from '../shadows.js';

/* ---- the ledger, transcribed ---------------------------------------- */
const SCALE = { pxPerM: 11.3, ulysses: 20, crew: 19 };

const FLOORS = {
  beach: [[300, 455], [438, 486], [540, 500], [610, 505]],       // band 18
  mainlandApron: [[950, 252], [1008, 268], [1040, 272]],         // band 8
  mainlandYard: [[940, 300], [1010, 318], [1090, 330]],          // band 10
};

/* the marks, ledger names verbatim — each serves the units it names.
   ROUND-7 PLACEMENT AUDIT (#11): council-ulysses moved off the stern curl's
   black mass (the old (510,492) stood ~6 px from its base, dark tunic on
   near-black hull) and the crew arc out of the day plate's 5 m painted goat
   (395..450 x 465..530 — c0 stood INSIDE its body box). */
const MARKS = {
  'fire-ulysses':   [390, 480],    // left of the fire ring, facing it (i-02/03)
  'council-ulysses': [563, 499],   // open sand right of the curl (>= 10 px of
                                   // every painted mass), back to the strait
  'council-crew':   [472, 507],    // the crew arc CENTROID facing Ulysses
  'twelve-at-ship': [560, 503],    // lined on the sand along ship-2's hull (i-10)
  'entry-mainland': [1008, 268],   // the grass apron between the laurels (i-08+)
  'climb-path':     [940, 325],    // below the yard wall, behind the plate (i-12)
};

/* THE FAR LOBE DRAWS AT ITS OWN SCALE (round-7 placement audit #4): the
   mainland apron/yard measures ~19.5 px/m off its own painted stock (four
   pen sheep 18.1-21.0 px/m, the apron sheep 19.0, fence rails 20.0, wall
   courses 20.0 — the audit's table) against the beach's ship-derived 11.3.
   The ledger's old ruling ("the ship wins") was honest at the ship and 40%
   wrong beside the pen sheep — the party stood eye-to-eye with the stock.
   An actor standing in the lobe now mounts at the lobe's own numbers; the
   ledger carries both scales. */
const LOBE = { x: 900, y: 380, pxPerM: 19.5, ulysses: 34, crew: 33 };
const inLobe = (x, y) => x >= LOBE.x && y <= LOBE.y;
const uH = (x, y) => (inLobe(x, y) ? LOBE.ulysses : SCALE.ulysses);
const cH = (x, y) => (inLobe(x, y) ? LOBE.crew : SCALE.crew);

/* ship-2, the beached crossing galley — the G1 gate's painted object */
const SHIP2 = { sternCurl: [516, 432], prowCurl: [686, 428], hullCentre: [600, 455] };
const TARGETS = {
  /* G1-ship: targetPlate is the ledger's own [600,455]. The hit surface is
     the hull the reader can see: the curls span x 516..686 and the sheer
     line sits at y ~428..432, so the rect runs from just past each curl down
     to the sand the keel is drawn on. The engine adds 48 screen px of slack. */
  ship: { at: SHIP2.hullCentre.slice(), hull: [506, 412, 696, 502], r: 52 },
};

/* the far-lobe smoke — fact O.1's carrier. The columns are PAINTED (ledger
   objects.smokeColumns; "the smoke of the lawless race is the far-lobe
   carrier of O.1a"); what the set adds is their breath, and what it PROVES
   (snapshot) is that the `smoke` lens actually holds them. */
const SMOKE = {
  columns: [[955, 0], [1030, 0], [1140, 60]],
  box: [940, 0, 230, 200],           // the columns' band, for lens containment
};

/* ---- layers-shore.json, transcribed --------------------------------- */
const EMIS = [
  { id: 'fire',        at: [438, 466],       r: 160, rgb: '255,153,111', a: 0.17, per: 3.4, amp: 0.50 },
  { id: 'moon-throat', at: [720.2, 316.2],   r: 69,  rgb: '247,251,255', a: 0.08, per: 9.7, amp: 0.22 },
  { id: 'moon-glint',  at: [715.6, 374.7],   r: 71,  rgb: '247,251,255', a: 0.10, per: 7.9, amp: 0.26 },
  { id: 'moon-wash',   at: [729.6, 450.4],   r: 84,  rgb: '247,251,255', a: 0.07, per: 8.6, amp: 0.30 },
];
/* the day state's gains, layers-shore.json stateLightMap verbatim: the fire
   is painted OUT (dead coals), the band is now the sun's so the cool anchors
   halve rather than recolour */
const DAY_GAINS = { fire: 0, 'moon-throat': 0.5, 'moon-glint': 0.5, 'moon-wash': 0.5 };
const LAYER = {
  bloom: { file: 'set/shore/shore-bloom.png', box: [243, 272, 388, 388], per: 3.4, amp: 0.35 },
  fog:   { file: 'set/shore/shore-fog.png', box: [380, 344, 800, 324],
           driftPxPerSec: 2.6, per: 12.0, baseOpacity: 0.5 },
};

/* ---- the lenses, ledger names + values VERBATIM ----------------------- *
 * THE CLOSE-UP LAW (owner round, 2026-08-17): a unit whose subject is a
 * CHARACTER's act or speech renders its principal >= 30% of panel height
 * (two-shots >= 22%); only headings/arrivals/establishing go wide, max 2
 * wide per beat after its heading. On this 11.3 px/m plate a 20 px Ulysses
 * needs k ~8.5-11.6 for those floors — the plate goes soft under the crisp
 * cut (the sources are 600+ px), which reads as depth of field, and the
 * dead band stays >= 0 both orientations (ledger margins recomputed). */
const FOCUS = {
  establishing:          [704, 384, 1.0],    // the black strait wide; day reuses it
  smoke:                 [980, 205, 1.9],    // the O.1a carrier frame (i-04)
  council:               [505, 470, 2.2],    // i-06: the crew gathers (composed mid)
  /* i-07's own close (COUNCIL SPLIT — the shared lens fought i-06's
     gathering vs i-07's speech): Ulysses at (563,499) before the crew arc
     (460..484), the ship's hull dot (600,455) alive in frame BOTH
     orientations — 20 px x 8.6 / 768 = 22.4%, the two-shot floor. */
  'council-close':       [545, 480, 8.6],
  /* i-02 + i-03 (the close-up law's one shore exemption): i-02's staging
     column stages the CAMEO CARD + the landfall tail — the card is the
     close, and the man is still WADING IN from the shallows (a k 11.6
     in-scene close framed empty sand and broke the anti-skate law: 2.76
     css px/frame of magnified plant glide vs the 2.5 law). */
  'camp-fire':           [430, 468, 2.4],
  /* i-10 recomposed (was [560,470,3.0] = Ulysses at 7.8%): the twelve in
     both flanks (484..566) + the shouldered skin, 22.4% two-shot floor. */
  'ship-mid':            [545, 488, 8.6],
  'skin-close':          [560, 470, 4.5],    // the skin close IN-WORLD (i-11)
  'cavemouth-push-from': [850, 345, 1.6],    // push start (ledger; i-08 keyframe 1)
  'cavemouth-push-to':   [1008, 290, 2.6],   // push end on the laurel mouth
  'crag-tilt':           [1050, 165, 2.4],   // bare cliff-top — Beat VI pre-echo
};

/* THE CROSSING CLOCK. gateAct `crossing` starts it; camOverride owns the
 * frame while it runs. Two legs:
 *   0.00..0.55  the travel: from the hull, along the moonpath to the ledger's
 *               push START (cavemouth-push-from) — the strait, performed
 *   0.55..1.00  the ledger's i-08 two-keyframe push, -from -> -to, verbatim
 * 7.0 s total; the glint anchors brighten under the first leg (the oars). */
const CROSS = { dur: 7.0, glideEnd: 0.55, from: [600, 452, 1.55] };

const DAY = { dur: 2.8 };            // the shore-day crossfade (under the hunt seg)

/* AUTHORED, NOT MEASURED — see THE DIM in the header. Cool-preserving, so a
   cut-out under the risen wineskin plate falls into the night instead of
   glowing over a darkened painting. */
const DIM_MATRIX = [0.60, 0.66, 0.78];
const DIM_SCRIM = 0.45;              // the scrim's ceiling at full plate

/* ---- the actors: tools/ody/actors.json pins, transcribed ------------ *
 * px is the cut's own size, pin is [foot-centre x, baseline y] measured off
 * the cut's alpha. A sprite hangs off its PIN, not its box centre — the only
 * anchor an isometric plate allows (WIRING §7). */
const ART = {
  ulyssesStand: { file: 'actor/ulysses-stand.png', px: [316, 682], pin: [125, 676] },
  crewA:        { file: 'actor/crew-a-stand.png',  px: [266, 620], pin: [132, 614] },
  crewB:        { file: 'actor/crew-b-stand.png',  px: [276, 635], pin: [140, 629] },
  skin:         { file: 'actor/prop-wineskin.png', px: [622, 497], pin: [347, 491] },
};
const CREW_N = 12;                   // the twelve best (i-10); three of them are
                                     // the camp/council party before that

/* ---- THE WALK STRIPS: the shipped registry, READ, not transcribed ------ *
 * strips.js is generated verbatim from tools/ody/strips.json (build-gated
 * cells: identity/scale/anchors/action; the lap asserts the registry sha
 * over the shipped bytes AND the shipped module against the registry), so
 * n / cell / srcH / anchors arrive here as the registry's own numbers — the
 * n=4 -> n=10 seedance recut changed all four and no set may hardcode them
 * again. While a pose is actually COVERING GROUND — the wade, the council
 * re-stage, the boarding line — the strip is the walk and the cut is the
 * stand, never both (the room.js swap law). Frame is driven by CUMULATIVE
 * DISTANCE, and pxPerFrame is the King law read off each strip
 * (setkit stripPxPerFrame: stride / (n/2)) at this plate's 11.3 px/m —
 * Ulysses' 0.75 m stride -> 8.5 px -> 1.70 px/frame over the 10 cells; the
 * crew's 19 px gait a touch shorter (0.71 m -> 8.0 px -> 1.60). */
const STRIP = {
  ulysses: STRIPS['ulysses-walk'],
  crew: STRIPS['crew-walk'],
  run: STRIPS['crew-run'],
};
const PX_PER_FRAME = {
  ulysses: stripPxPerFrame(STRIP.ulysses, 0.75 * SCALE.pxPerM),   // 1.70
  crew: stripPxPerFrame(STRIP.crew, 0.71 * SCALE.pxPerM),         // 1.60
  run: stripPxPerFrame(STRIP.run, 1.5 * SCALE.pxPerM),            // 3.39 (a sprint stride)
};
/* THE DASH ABOARD (crew-run, ody-video2 — PLAN i-07 'council', cut c-board):
 * the reader's click on the hull sends the three council men SPRINTING down
 * the sand to the galley at push-off, and they go aboard (fade at the hull)
 * as the crossing's first leg takes the frame up the moonpath. Distance
 * drives the frame exactly like the walks (the King law) — the run is just
 * a faster gait with its own strip and its own honest ground speed. hPx 19.8
 * is end-continuity off the cells' alpha (fig 513 px ~ the 19 px crewman). */
const RUN_V = 3.8 * SCALE.pxPerM;      // 42.9 px/s — a laden beach sprint
const RUN_H = 19.8;
const bY = (x) => floorY(FLOORS.beach, x);         // the boarding spots stand
const BOARD = [[544, bY(544)], [552, bY(552) + 2], [536, bY(536) - 1]];  // on the
                                                   // ledger's own beach line
/* a stride is MEASURED off the pose the frame actually moved (seg and damp
   alike), never named by its cause; a teleport (fade-through reland, a
   settled snap) is not a stride */
const STRIDE_MIN_SPEED = 6;          // plate px/s — under it the damp tail stands
const STRIDE_TELEPORT = 40;          // plate px in one step is a re-stage, not a step
/* HONEST GROUND SPEED (the anti-skate law's other half): the damp's first
   step opens at lambda x distance px/s — 1.8 x 120 px = 216 px/s, a 19 m/s
   sprint at 11.3 px/m — so every damped walk is capped at the actor's own
   walking speed. The planted foot glides at ground speed by construction
   (each frame's anchor is pinned on the moving mark), so ground speed IS
   the skate, and 1.5 m/s / 1.4 m/s is what a walk may spend. */
const WALK_V = { ulysses: 1.5 * SCALE.pxPerM, crew: 1.4 * SCALE.pxPerM };

/* LANE PHYSICS (Explorer D adopted — tools/ody/seamless/explore-physics.md):
 * the gait read off each strip's OWN anchors (the plant frames are the
 * anchor swap, the KING law's contacts), a mean-1 speed pulse that dips ON
 * the plant, and a step-synced bob at ~3% of body height (audit-motion.md:
 * measured box bob was 0.02-0.5% against a 3-4% real-walk band). */
const GAIT = { u: gaitProfile(STRIP.ulysses),
               crew: gaitProfile(STRIP.crew),
               run: gaitProfile(STRIP.run) };
const BOB_AMP = { u: 0.03 * SCALE.ulysses, crew: 0.03 * SCALE.crew,
                  run: 0.03 * RUN_H };
/* CADENCE ATTENUATION (shared law with setkit walkToward2): pulse depth
   scales with the gait cycle's own seconds — this plate's small strides
   (17/16 px a cycle) cycle FAST at speed, and a full-depth pulse above
   ~1.1 cycles/s reads as flicker (the one-frame speed law's > 25% pops) */
const gaitAtt = (gait, ppf, v) =>
  clamp01(gait.n * ppf / (Math.max(v, 1) * 0.9));

/* ---- EXPLORER C: CONTACT SHADOWS (the chase.js rig-shadow law) ---------- *
 * app/shadows.js is the registry (shadowgen.py, verbatim): anchor lands on
 * the actor's foot mark, scale by the actor's own k = drawnH / cutH,
 * opacity (0.42 + 0.30 * s) * actorOp — s the mark's depth share of this
 * plate's floors (the mainland apron's 252 to the beach line's 511). At
 * 19-20 px actors the shadow IS the grounding (the report's T4: occlusion
 * is a measured no-op at shore scale; the shadow still visibly seats). */
const SHADOW = SHADOWS.shore.shadows;
const SHADOW_BAND = [252, 511];
const shadowS = (y) =>
  clamp01((y - SHADOW_BAND[0]) / (SHADOW_BAND[1] - SHADOW_BAND[0]));

/* ---- EXPLORER C: THE FIREPIT OCCLUDER (the pews-front law) -------------- *
 * The camp ring's near stones + the two downstage logs, a pixel-exact
 * restore of the NIGHT master (cutocc.py firepit-front, occluders.json
 * verbatim), drawn LAST in the actor group: every camp settle stands
 * upstage of its ground (y 507), so the feet tuck behind the near stones.
 * Its opacity is the night plate's own share (1 - the day crossfade) — the
 * day fire is dead coals and the day tableaux never touch the ring. */
const OCC_FIREPIT = { file: 'set/shore/firepit-front.png',
                      origin: [347, 459], size: [125, 52], ground: 507 };
/* the shadowed cuts' own source heights (tools/ody/actors.json, verbatim) —
   the scale law is k = drawnH / cutH and the walk shadow's cut is not in
   this set's ART table (the walk is a strip here) */
const SHADOW_CUT_H = { 'ulysses-stand': 682, 'ulysses-walk': 664,
                       'crew-a-stand': 620, 'crew-b-stand': 635 };

/* place a cut by its measured pin. Returns the drawn box for the snapshot.
   MICRO-IDLE (the sherlock King law, room.js stepKing): a settled cut may
   also carry `rot` (the slow sway) and `sy` (the breath's scaleY), both
   about the PIN — the feet — so the idle cannot move a foot off its mark. */
function pinSprite(node, art, at, hPx, flip, bob, rot, sy) {
  const k = hPx / art.px[1];
  const w = art.px[0] * k, h = art.px[1] * k;
  box(node, at[0] - art.pin[0] * k, at[1] - art.pin[1] * k, w, h);
  node.style.transformOrigin = `${(art.pin[0] * k).toFixed(2)}px ${(art.pin[1] * k).toFixed(2)}px`;
  node.style.transform =
    (flip ? 'scaleX(-1) ' : '') + `translateY(${(bob || 0).toFixed(2)}px)` +
    (rot ? ` rotate(${rot.toFixed(3)}deg)` : '') +
    (sy && sy !== 1 ? ` scaleY(${sy.toFixed(5)})` : '');
  return { w, h };
}

/* ---- THE STAGINGS: each ledger mark, dressed ------------------------- *
 * An act names a mark; a staging is that mark plus the party around it. The
 * crew positions are authored ON the ledger's floors, so every foot below is
 * on a measured line (or a mark's own y, which outranks it).
 *
 *   camp      fire-ulysses (390,480): he faces the ring; three men across it
 *   council   council-ulysses (510,492), the crew arc CENTRED on the ledger's
 *             council-crew centroid (445,507) — authored (426,501)(445,507)
 *             (464,511), centroid (445.0, 506.3), facing him
 *   mainland  entry-mainland (1008,268): the party small on the grass apron
 *   twelve    twelve-at-ship (560,503): two flanks of six along the 170 px
 *             hull, Ulysses front-centre with the skin shouldered
 *   climb     climb-path (940,325): Ulysses leads, the file trails below the
 *             yard wall — behind the risen wineskin plate
 */
const beachY = (x) => floorY(FLOORS.beach, x);
function stagings() {
  const S = {};
  S.empty = { u: null, crew: [] };
  /* camp (round-7 audit #16): the three men now face the hero-scale ring
     from its LEFT — the old (456..492) arc stood them against the painted
     ring's own stones (registered as campfireRing now). The ring stays the
     ledger's declared hero-scale light source. */
  S.camp = {
    u: { at: MARKS['fire-ulysses'], flip: false },          // fire at 438, on his right
    crew: [{ at: [350, 471], flip: false }, { at: [366, 474], flip: false },
           { at: [382, 478], flip: false }],
  };
  /* council (round-7 audit #11): the arc stands in the open-sand pocket
     between the day goat (x <= 450) and the stern curl (x >= 495), every
     foot >= 10 px (half a body) from both; Ulysses right of the curl. */
  S.council = {
    u: { at: MARKS['council-ulysses'], flip: true },        // faces the arc on his left
    crew: [{ at: [460, 504], flip: false }, { at: [472, 507], flip: false },
           { at: [484, 509], flip: false }],
  };
  S.mainland = {
    u: { at: MARKS['entry-mainland'], flip: false },
    crew: [{ at: [988, 264], flip: false }, { at: [1024, 271], flip: false },
           { at: [972, 258], flip: false }],
  };
  /* the twelve (round-7 audit #15): the old right flank (x 574..639) stood
     across ship-1's painted oar blades AND rode beachY's flat clamp past
     the polyline's end — the line is two staggered ranks along the hull
     now, everything short of the oars (x <= 566) and off the camp ring. */
  const twelve = [];
  for (let i = 0; i < 6; i++) {                              // rank 1 of six
    const x = 484 + i * 13;
    twelve.push({ at: [x, beachY(x) - 2], flip: false });
  }
  for (let i = 0; i < 6; i++) {                              // rank 2 of six
    const x = 490 + i * 12;
    twelve.push({ at: [x, beachY(x) + 7], flip: false });
  }
  S.twelve = { u: { at: MARKS['twelve-at-ship'], flip: false }, crew: twelve };
  const climb = [];
  for (let i = 0; i < CREW_N; i++) {                         // the file, below the
    climb.push({ at: [946 + i * 11, 326 + i * 1.6], flip: false });   // wall — 11 px
  }                                    // spacing: 33 px lobe-scale men (audit #4)
  S.climb = { u: { at: MARKS['climb-path'], flip: false }, crew: climb };
  return S;
}
const STAGE = stagings();

/* the landfall pantomime's wade-in points (i-01): out of the shallows where
   the fog band breathes, walking up the apron into the camp staging */
const WADE = { u: [598, 504], crew: [[620, 506], [585, 502], [640, 508]] };
/* the hunt dash (i-05): two men out along the sand after the painted goats.
   ROUND 7 (placement audit #15's zone): the old far spots (600,503)/(632,506)
   parked the hunters ON ship-1's painted oar blades (574..639 x 488..512) —
   the dash now ends on the waterline sand BELOW the blades (y > 512, still
   inside the beach band), keeping the long home leg the smoke-unit gait
   law measures. */
const HUNT = [[600, 516], [632, 518]];

export class ShoreSet {
  static id = 'shore';
  /** The chapter's ONLY inset (inset law §6): the priest's gift, read as
   *  foresight. Raised by the `plate-wineskin` act on i-12 `misgave`. */
  static insets = { wineskin: 'inset/plate-wineskin.jpg' };
  static beds = ['shore'];

  constructor(root, st) {
    this.st = st;                    // the Stage shell: img/bitmap/cue/reduced
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);

    /* ---- the two painted states, crossfading (room-dim law) --------- */
    this.night = img('set/shore/shore.jpg', 'lyr plate');
    this.day = img('set/shore/shore-day.jpg', 'lyr plate');
    box(this.night, 0, 0, PLATE.w, PLATE.h);
    box(this.day, 0, 0, PLATE.w, PLATE.h);
    this.day.style.opacity = '0';

    /* ---- the waterline breath (screen; feather baked in, no mask) ---- */
    this.fog = img(LAYER.fog.file, 'lyr');
    box(this.fog, ...LAYER.fog.box);
    this.fog.style.mixBlendMode = 'screen';
    this.fog.style.opacity = String(LAYER.fog.baseOpacity);

    /* ---- the smoke columns' breath (O.1 carrier) --------------------- *
     * The columns are PAINTED; these three soft cards are only their life —
     * a slow vertical shimmer over each painted column, in both states (the
     * stubble fires are seen by day too, i-06). Kept inside the columns'
     * own band so the breath cannot wander off the carrier. */
    this.smoke = [];
    for (const [i, c] of SMOKE.columns.entries()) {
      const d = el('div', 'emis', root);
      box(d, c[0] - 16, c[1], 32, c[1] > 0 ? 150 : 170);
      d.style.background =
        'linear-gradient(180deg,rgba(205,210,220,.13) 0%,rgba(205,210,220,.06) 55%,' +
        'rgba(205,210,220,0) 100%)';
      d.dataset.col = String(i);
      this.smoke.push(d);
    }

    /* ---- THE DIM SCRIM (see header: no painted relight shipped) ------ *
     * UNDER the actor group, so the painting dims here and the cut-outs dim
     * by the matrix — the same split every sherlock set kept. */
    this.scrim = el('div', 'lyr', root);
    box(this.scrim, 0, 0, PLATE.w, PLATE.h);
    this.scrim.style.background = '#04060c';
    this.scrim.style.opacity = '0';

    /* ---- THE CONTACT SHADOWS, in their own group BEFORE the actors ---- *
     * (Explorer C, the chase.js law: a body is drawn over its own shadow;
     * a separate group means no z decision can lift a shadow above one.) */
    this.shadowG = el('div', 'actors shadows', root);
    const shN = (name) => {
      const e = img('actor/shadow/shore/' + SHADOW[name].file, 'lyr', this.shadowG);
      e.style.opacity = '0';
      return e;
    };
    this.uShN = { stand: shN('ulysses-stand'), walk: shN('ulysses-walk') };
    this.crewShN = [];
    for (let i = 0; i < CREW_N; i++) {
      this.crewShN.push(shN(i % 2 ? 'crew-b-stand' : 'crew-a-stand'));
    }
    this._shadows = [];

    /* ---- THE ACTORS (isolated, so the dim matrix is theirs alone) ---- */
    this.actors = el('div', 'actors', root);
    /* actor cuts load their BUILD-GRADED variant (regrade law, setkit) and
       fall back to the raw cut; strips stay raw — the grade is per-cut */
    const cut = (f, c, p) => gradedActor(st, 'shore', f, c, p || root);
    this.ulysses = cut(ART.ulyssesStand.file, 'lyr', this.actors);
    /* the WALK STRIP replaces the old single walk-pose cut: decoded at boot
       via st.bitmap (room.js: the first walk frame never flashes white) */
    this.uStripN = el('div', 'lyr walk', this.actors);
    this.uStripN.style.backgroundImage = st.bitmap(STRIP.ulysses.file);
    this.uStripN.style.opacity = '0';
    this.crew = [];
    this.crewStripN = [];
    for (let i = 0; i < CREW_N; i++) {
      const node = cut(i % 2 ? ART.crewB.file : ART.crewA.file, 'lyr', this.actors);
      node.style.opacity = '0';
      this.crew.push(node);
      const w = el('div', 'lyr walk', this.actors);
      w.style.backgroundImage = st.bitmap(STRIP.crew.file);
      w.style.opacity = '0';
      this.crewStripN.push(w);
    }
    /* the RUN strip nodes for the three boarding men (the dash aboard) */
    this.runStripN = [];
    for (let i = 0; i < 3; i++) {
      const w = el('div', 'lyr walk', this.actors);
      w.style.backgroundImage = st.bitmap(STRIP.run.file);
      w.style.opacity = '0';
      this.runStripN.push(w);
    }
    /* the skin rides Ulysses' shoulder from i-10 on — drawn after him so the
       strap sits over the shoulder it hangs from. ~0.62 m of goatskin = 7 px. */
    this.skinNode = cut(ART.skin.file, 'lyr', this.actors);
    this.skinNode.style.opacity = '0';

    /* ---- THE FIREPIT OCCLUDER, drawn LAST in the group (pews-front law):
     * every camp settle stands upstage of its ground (y 507), so the near
     * stones and the two logs restore OVER the settled feet. */
    this.occFirepit = img(OCC_FIREPIT.file, 'lyr occ', this.actors);
    box(this.occFirepit, OCC_FIREPIT.origin[0], OCC_FIREPIT.origin[1],
        OCC_FIREPIT.size[0], OCC_FIREPIT.size[1]);

    /* ---- the fire bloom (screen), over the actors per drawOrder ------ */
    this.bloom = img(LAYER.bloom.file, 'lyr');
    box(this.bloom, ...LAYER.bloom.box);
    this.bloom.style.mixBlendMode = 'screen';

    /* ---- the measured emissives, last ------------------------------- */
    this.emis = emissives(EMIS, root);

    this.reset();
  }

  /** The world as unit 0 finds it: night, the fire lit, NOBODY on the sand —
   *  the landfall seg is what ghosts the party in. A replay from the top must
   *  get back here first (the room.js lesson: nothing a later unit switched
   *  on may survive a reset). */
  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      staging: 'empty', stagedAt: -1e9, snap: true,
      seg: null,                       // { name, t0, dur } | null
      dayAt: -1e9,                     // shore-day crossfade start
      cross: -1e9,                     // the G1 crossing clock's zero
      skin: false,                     // the wineskin is shouldered (i-10 on)
      board: null,                     // { t0 } — the dash aboard, live
    };
    /* presentation pose per actor: where the cut IS, distinct from where the
       staging wants it. op 0 = off stage; an invisible actor snaps to its
       next mark instead of sliding to it. The stride fields (dist/lx/ly/
       walking/face/frame) are the strip driver's — trackStride owns them. */
    const pose = () => ({ x: 0, y: 0, op: 0, flip: false, walking: false,
                          running: false,
                          dist: 0, lx: null, ly: null, face: 1, frame: 0 });
    this.pose = { u: pose() };
    for (let i = 0; i < CREW_N; i++) this.pose['c' + i] = pose();
    if (this.skinNode) this.skinNode.style.opacity = '0';
  }

  /* ---- the camera ---------------------------------------------------- */
  focusPlate(name) {
    if (name === 'crossing') return this.crossingLens();
    return FOCUS[name] || FOCUS.establishing;
  }

  /**
   * THE CROSSING OWNS THE FRAME while its clock runs — the reader answered
   * the gate and the strait is the answer's pantomime (the street-ruse
   * pattern). The override releases exactly ON cavemouth-push-to, which is
   * i-08's own unit lens, so the hand-back is seamless.
   */
  camOverride() {
    const k = this.crossK();
    return (k !== null && k < 1) ? 'crossing' : null;
  }

  crossT() {
    const d = this.state.t - this.state.cross;
    return (this.state.cross > -1e8 && d >= 0) ? d : null;
  }

  crossK() {
    const d = this.crossT();
    return d === null ? null : clamp01(d / CROSS.dur);
  }

  crossingLens() {
    const k = this.crossK() == null ? 1 : this.crossK();
    const A = FOCUS['cavemouth-push-from'], B = FOCUS['cavemouth-push-to'];
    if (k < CROSS.glideEnd) {          // leg 1: the hull, along the moonpath
      const e = easeInOut(k / CROSS.glideEnd);
      return [lerp(CROSS.from[0], A[0], e), lerp(CROSS.from[1], A[1], e),
              lerp(CROSS.from[2], A[2], e)];
    }
    // leg 2: the ledger's i-08 two-keyframe push, -from -> -to, verbatim
    const e = easeInOut((k - CROSS.glideEnd) / (1 - CROSS.glideEnd));
    return [lerp(A[0], B[0], e), lerp(A[1], B[1], e), lerp(A[2], B[2], e)];
  }

  /** No `clock` unit rides this SET (Beat I is click-paced); the beat-local
   *  clock is the cave's and the sea's business. */
  ruseT() { return null; }

  /* ---- the gate ------------------------------------------------------- */
  targetPlate(name) { return TARGETS[name] ? TARGETS[name].at : null; }

  /** The hull is painted into both masters and stands in every lens the gate
   *  is asked from — a painted object is always live (the room door's law). */
  targetLive(name) { return name === 'ship'; }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const T = TARGETS.ship, H = T.hull;
    if (p.x >= H[0] && p.x <= H[2] && p.y >= H[1] && p.y <= H[3]) return true;
    return Math.hypot(p.x - T.at[0], p.y - T.at[1]) <= T.r;
  }

  /** ULYSSES is the one embodied speaker on this leaf (i-07). His head is
   *  ~92% of his 20 px up from the foot mark. */
  headPlate(who) {
    if (who !== 'ULYSSES') return null;
    const P = this.pose.u;
    if (P.op < 0.5) return null;
    return [P.x, P.y - uH(P.x, P.y) * 0.92];   // the lobe scale (audit #4)
  }

  holdAnchor() { return null; }        // no hold verb rides this SET
  waitDone() { return true; }          // no wait unit rides this SET

  /* ---- the verbs the units fire --------------------------------------- */
  /**
   * `settled` = replayed jump: leave the world at the act's END (WIRING §2).
   * A restaging act also ENDS any running pantomime — an act is the world
   * being re-stated, and a seg that kept writing positions over it would
   * fight the statement.
   */
  fire(act, settled = false) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':                // i-00: night, the strait wide, sand empty
        this.setStaging('empty', true);
        S.dayAt = -1e9; S.cross = -1e9; S.skin = false; S.board = null;
        break;
      case 'fire-ulysses':             // i-02: he stands to the fire's left
        this.setStaging('camp', settled);
        break;
      case 'shore-day':                // i-05: the day master crossfades up
        S.dayAt = settled ? t - DAY.dur : t;
        break;
      case 'council-ulysses':          // i-06: the council tableau marks
        this.setStaging('council', settled);
        break;
      case 'crossing':                 // G1 gateAct: the strait (lens travel)
        S.cross = settled ? t - CROSS.dur : t;
        /* the dash aboard (cut c-board): live only — a settled crossing has
           the party already over the water */
        S.board = settled ? null : { t0: t };
        break;
      case 'entry-mainland':           // i-08: the party small on the apron
        this.setStaging('mainland', settled);
        break;
      case 'twelve-at-ship':           // i-10: the line at the hull, skin up
        S.skin = true;
        this.setStaging('twelve', settled);
        break;
      case 'plate-wineskin':           // i-12: the inset rises; the climb behind it
        this.st.plate('wineskin', 1);
        this.setStaging('climb', settled);
        break;
      default: break;
    }
  }

  setStaging(name, snap) {
    const S = this.state;
    S.staging = name; S.stagedAt = S.t; S.seg = null;
    S.snap = !!snap || this.st.reduced;   // reduced motion: already there
  }

  /** The two pantomimes this SET performs (t0 already rewound when settled):
   *    landfall (i-01, 8 s)  the party wades out of the shallows into camp
   *    hunt     (i-05, 5 s)  two men dash up the apron after the goats     */
  startSeg(name, dur, t0) {
    const S = this.state;
    S.seg = { name, t0, dur };
    if (name === 'landfall') {
      /* the seg's END is the camp staging, so finishing the wade and firing
         i-02's `fire-ulysses` are the same world — the act is then a no-op */
      S.staging = 'camp'; S.stagedAt = t0; S.snap = false;
    }
  }

  /* ---- one fixed step ------------------------------------------------- */
  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    const dim = ctx.dim;
    const dayK = S.dayAt > -1e8 ? clamp01((t - S.dayAt) / DAY.dur) : 0;
    this.dayK = dayK;

    /* ---- the two masters crossfade; the scrim rides the inset -------- */
    this.day.style.opacity = easeInOut(dayK).toFixed(3);
    this.scrim.style.opacity = (dim * DIM_SCRIM).toFixed(3);

    /* ---- the waterline breath: drift + slow swell; day burns it back - */
    const F = LAYER.fog;
    const driftAmp = F.driftPxPerSec * F.per / (2 * Math.PI);   // 2.6 px/s at per 12
    this.fog.style.transform =
      `translateX(${(amb * driftAmp * Math.sin(2 * Math.PI * t / F.per)).toFixed(2)}px)`;
    this.fog.style.opacity =
      (F.baseOpacity * (1 - 0.5 * dayK) *
       (1 + amb * 0.16 * Math.sin(2 * Math.PI * t / 19.0)) * (1 - 0.55 * dim)).toFixed(3);

    /* ---- the smoke breathes over its painted columns (O.1) ----------- */
    for (const [i, d] of this.smoke.entries()) {
      d.style.transform =
        `translateY(${(amb * 3.0 * Math.sin(2 * Math.PI * t / 17.0 + i * 2.1)).toFixed(2)}px)`;
      d.style.opacity =
        ((0.55 + amb * 0.25 * Math.sin(2 * Math.PI * t / 13.0 + i)) * (1 - 0.55 * dim))
          .toFixed(3);
    }

    /* ---- the fire and the moonpath, per-state gains ------------------ *
     * night gains 1; day gains are the layer lane's stateLightMap. The
     * glints brighten under the crossing's first leg — the oars in the
     * moonpath, the one thing the travel disturbs. */
    const ck = this.crossK();
    const oar = ck !== null && ck < CROSS.glideEnd
      ? 0.35 * Math.sin(Math.PI * (ck / CROSS.glideEnd)) : 0;
    for (const e of EMIS) {
      const gain = lerp(1, DAY_GAINS[e.id], dayK);
      let a = gain * (1 + amb * e.amp * Math.sin(2 * Math.PI * t / e.per));
      if (e.id !== 'fire') a *= 1 + oar;
      this.emis[e.id].style.opacity = (a * (1 - 0.55 * dim)).toFixed(3);
    }
    /* the bloom is the fire's own screen layer: same period, same phase, and
       it dies with the fire's day gain (dead coals paint no bloom) */
    const fireGain = lerp(1, DAY_GAINS.fire, dayK);
    this.bloomOp = fireGain *
      (1 + amb * LAYER.bloom.amp * Math.sin(2 * Math.PI * t / LAYER.bloom.per)) *
      (1 - 0.55 * dim);
    this.bloom.style.opacity = this.bloomOp.toFixed(3);

    /* the firepit occluder is the NIGHT plate's own share: the day master
       fades over the night one, and the restore fades with its source */
    this.occFirepit.style.opacity = (1 - easeInOut(dayK)).toFixed(3);

    this.stepTroupe(t, dt, amb);
  }

  /* ---- the troupe: stagings, segs, and the motion between them ------- */
  stepTroupe(t, dt, amb) {
    const S = this.state;
    const lay = STAGE[S.staging] || STAGE.empty;
    const damp = this.st.damp;

    /* what the staging wants of each actor this frame */
    const want = { u: lay.u ? { ...lay.u, vis: 1 } : { at: [0, 0], flip: false, vis: 0 } };
    for (let i = 0; i < CREW_N; i++) {
      const c = lay.crew[i];
      want['c' + i] = c ? { ...c, vis: 1 } : { at: [0, 0], flip: false, vis: 0 };
    }

    /* THE MAINLAND WAITS FOR THE STRAIT: the party does not stand on the
       apron before the travelling lens has crossed the water. A settled
       crossing (or none at all — a harness firing acts out of order) gates
       nothing. */
    const ck = this.crossK();
    if (S.staging === 'mainland' && ck !== null && ck < 0.5) {
      for (const k of Object.keys(want)) want[k].vis = 0;
    }

    /* THE DASH ABOARD (crew-run): the gate's click IS the push-off — it
       sends the three council men sprinting for the hull at the run's own
       honest ground speed, and they go aboard (fade at the boarding spot)
       under the crossing's FIRST LEG. The dash rides the crossing's own
       clock, not the staging: the gate's advance enters i-08 (whose
       entry-mainland act re-stages at once, hidden until the lens has
       crossed the water anyway), so the crossing clock is the one owner
       that spans the whole dash. Distance drives the run strip's frames in
       paintTroupe, the same King law as every walk. */
    const ckb = this.crossK();
    if (S.board && (ckb === null || ckb >= CROSS.glideEnd)) S.board = null;
    if (S.board) {
      for (let i = 0; i < 3; i++) {
        const key = 'c' + i, P = this.pose[key], to = BOARD[i];
        const dx = to[0] - P.x, dy = to[1] - P.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 1.5 && P.op > 0.05) {
          /* LANE PHYSICS: the dash was `step = RUN_V*dt` verbatim — dead-flat
             42.9 px/s, on in one frame, off in one frame (audit-motion.md
             #4). walkToward2 gives it the ease-on/ease-off and the run
             strip's own per-step pulse; no settle — the boarding fade takes
             the arrival. */
          walkToward2(P, to[0], to[1], 3.2, RUN_V, dt,
                      { gait: GAIT.run, pxPerFrame: PX_PER_FRAME.run,
                        ease: 0.35, settlePx: 0 });
          P.running = true;
          P.op = 1;
          P.flip = dx < 0;
        } else {
          P.running = false;
          P.op = damp(P.op, 0, 3.2, dt);       // up the ladder and aboard
        }
        want[key].vis = -1;
      }
    } else {
      for (let i = 0; i < 3; i++) this.pose['c' + i].running = false;
    }

    /* the segs write positions DIRECTLY while they run — a pantomime is a
       pure function of its own clock, not a chase of damped targets */
    const seg = S.seg;
    let segK = null;
    if (seg) {
      segK = clamp01((t - seg.t0) / seg.dur);
      if (segK >= 1) { S.seg = null; }
      else if (seg.name === 'landfall') {
        /* LANE PHYSICS: the 8 s wade was one mathematically smooth glide
           (CV 19.6-19.9%, zero structure at cadence — audit-motion.md #1).
           The eased lerp is PULSE-WARPED at each walker's own strip cadence:
           the ease keeps the schedule (lambda-3 correction), the granted
           step dips on the plant and rises through the swing. */
        const e = easeInOut(segK), op = clamp01(segK / 0.18);
        const put = (key, from, to, phase) => {
          const P = this.pose[key];
          const D = Math.hypot(to[0] - from[0], to[1] - from[1]);
          if (P._wgT !== seg.t0) { P._wgT = seg.t0; P._wgs = 0; P._wgAsk = 0; }
          const gait = key === 'u' ? GAIT.u : GAIT.crew;
          const ppf = key === 'u' ? PX_PER_FRAME.ulysses : PX_PER_FRAME.crew;
          const sAsk = e * D;
          const vAsk = Math.max(0, sAsk - P._wgAsk) / Math.max(dt, 1e-6);
          const att = gaitAtt(gait, ppf, vAsk);
          const pulse = 1 + (gaitAt(gait, gait.pulse,
                                    (P.dist || 0) / ppf + phase) - 1) * att;
          P._wgs += Math.max(0, sAsk - P._wgAsk) * pulse +
                    (sAsk - P._wgs) * Math.min(1, 2 * dt);
          P._wgs = Math.min(D, Math.max(0, P._wgs));
          P._wgAsk = sAsk;
          const kw = D > 0 ? P._wgs / D : e;
          P.x = lerp(from[0], to[0], kw); P.y = lerp(from[1], to[1], kw);
          P.op = op; P.flip = want[key].flip;
        };
        put('u', WADE.u, want.u.at, 0);
        for (let i = 0; i < 3; i++) put('c' + i, WADE.crew[i], want['c' + i].at, i);
        for (let i = 3; i < CREW_N; i++) this.pose['c' + i].op = 0;
        this.paintTroupe(t, dt, amb);
        return;
      } else if (seg.name === 'hunt') {
        /* two men dash out after the goats; everyone else holds the camp.
           The seg ends with them at the far apron and the damp walks them
           home — the hunters come back to the fire with the meat.
           LANE PHYSICS: easeOut had derivative 3 at k=0 — the hunters went
           0 -> 7.5-8.2 m/s in ONE frame (audit-motion.md #2). The dash-out
           now rises through a real ease-in (easeInOut over the front 70% of
           the seg — still a sprint, still arriving early to stand), and the
           step is pulse-warped at the crew strip's cadence. */
        const e = easeInOut(clamp01(segK / 0.7));
        for (const [i, far] of HUNT.entries()) {
          const key = 'c' + i, P = this.pose[key];
          /* the dash leaves from where the man actually STANDS — lerping
             from the staging mark teleported a not-quite-settled hunter
             onto it in one frame (a mid-walk snap the jump law reads) */
          if (P._wgT !== seg.t0) {
            P._wgT = seg.t0; P._wgs = 0; P._wgAsk = 0;
            P._hFrom = [P.x, P.y];
          }
          const from = P._hFrom;
          const D = Math.hypot(far[0] - from[0], far[1] - from[1]);
          const sAsk = e * D;
          const vAsk = Math.max(0, sAsk - P._wgAsk) / Math.max(dt, 1e-6);
          const att = gaitAtt(GAIT.crew, PX_PER_FRAME.crew, vAsk);
          const pulse = 1 + (gaitAt(GAIT.crew, GAIT.crew.pulse,
                                    (P.dist || 0) / PX_PER_FRAME.crew + i) - 1) * att;
          P._wgs += Math.max(0, sAsk - P._wgAsk) * pulse +
                    (sAsk - P._wgs) * Math.min(1, 2 * dt);
          P._wgs = Math.min(D, Math.max(0, P._wgs));
          P._wgAsk = sAsk;
          const kw = D > 0 ? P._wgs / D : e;
          P.x = lerp(from[0], far[0], kw); P.y = lerp(from[1], far[1], kw);
          P.op = 1; P.flip = false;      // facing the run, up the apron
          want[key].vis = -1;            // seg owns them this frame
        }
      }
    }

    /* damped motion toward the staging, with two laws:
       FADE-THROUGH — a move longer than 250 px is not walked, it is a
       re-staging (nobody slides across the strait on foot): fade out, land
       on the mark, fade back in. SNAP — a settled act, or reduced motion,
       puts everyone straight on their marks. */
    for (const key of Object.keys(want)) {
      const W = want[key];
      if (W.vis === -1) continue;                    // a seg wrote this one
      const P = this.pose[key];
      if (S.snap) {
        if (W.vis) { P.x = W.at[0]; P.y = W.at[1]; P.flip = W.flip; }
        P.op = W.vis;
        P.away = false;
        continue;
      }
      if (!W.vis) { P.op = damp(P.op, 0, 5.0, dt); continue; }
      const rem = Math.hypot(P.x - W.at[0], P.y - W.at[1]);
      /* `away` = short of the staging mark (round-7 parking law: mid-walk is
         not a settle, and the stride flag flickers at the gait's plant dips) */
      P.away = rem > 3;
      let far = rem > 250;
      if (P.op < 0.06) {                             // off stage: land ON the mark
        P.x = W.at[0]; P.y = W.at[1]; P.flip = W.flip; far = false;
        P.away = false;
      }
      if (far) {
        P.op = damp(P.op, 0, 5.0, dt);               // fade out where he was…
      } else {
        /* …or WALK the last stretch — LANE PHYSICS: walkToward2 (eased
           on/off, per-step pulse at the actor's own strip cadence, a small
           arrival settle in place of the old 2-4 px / 1.5 s sub-6 px/s
           stand-cut terminal drift). The cap (WALK_V) is still the
           anti-skate law's own bound. */
        walkToward2(P, W.at[0], W.at[1], 1.8,
                    key === 'u' ? WALK_V.ulysses : WALK_V.crew, dt,
                    key === 'u'
                      ? { gait: GAIT.u, pxPerFrame: PX_PER_FRAME.ulysses }
                      : { gait: GAIT.crew, pxPerFrame: PX_PER_FRAME.crew });
        P.op = damp(P.op, 1, 4.0, dt);
        P.flip = W.flip;
      }
    }
    if (S.snap) S.snap = false;
    this.paintTroupe(t, dt, amb);
  }

  /** THE STRIDE, measured: the pose moved this frame at walking speed, or it
   *  stands. Distance accumulates while the stride runs (the frame source),
   *  the facing follows the travel, and a teleport resets the gait clock. */
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

  /** write every cut: pin-anchored, breathing, THE STRIP while striding —
   *  strip and cut are never both visible (the room.js swap law) */
  paintTroupe(t, dt, amb) {
    const S = this.state;
    const U = this.pose.u;
    this.trackStride(U, dt);
    for (let i = 0; i < CREW_N; i++) this.trackStride(this.pose['c' + i], dt);

    const moving = U.walking;
    /* MICRO-IDLE (the King law, ported VERBATIM from room.js stepKing):
       translateY(0.7*br) rotate(sway) scaleY(1+0.0035*br) on the settled
       stand; the walk strip owns him while he covers ground. */
    const brU = amb * Math.sin(2 * Math.PI * t / 4.6);
    const bobU = 0.7 * brU;
    const swayU = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0);
    const syU = 1 + 0.0035 * brU;
    /* THE LOBE SCALE (audit #4): a man standing past x 900 above y 380 is
       on the mainland's own 19.5 px/m floor — he draws at 34/33 px there */
    const hU = uH(U.x, U.y);
    pinSprite(this.ulysses, ART.ulyssesStand, [U.x, U.y], hU, U.flip,
              bobU, moving ? 0 : swayU, moving ? 1 : syU);
    this.ulysses.style.opacity = (moving ? 0 : U.op).toFixed(3);
    this._idleU = !moving && U.op > 0.5
      ? { dy: +bobU.toFixed(3), rot: +swayU.toFixed(3), sy: +syU.toFixed(5) }
      : null;
    if (moving) {
      U.frame = Math.floor(U.dist / PX_PER_FRAME.ulysses) % STRIP.ulysses.n;
      /* LANE PHYSICS: step-synced bob, the same gait clock as the frame —
         declared in the proof (U.gbob), so the anchor law holds */
      U.gbob = gaitBobY(GAIT.u, U.dist / PX_PER_FRAME.ulysses, BOB_AMP.u);
      placeStrip(this.uStripN, STRIP.ulysses, [U.x, U.y], hU,
                 U.frame, { flip: U.face < 0, bob: U.gbob });
      this.uStripN.style.opacity = U.op.toFixed(3);
    } else {
      U.gbob = 0;
      this.uStripN.style.opacity = '0';
    }
    this.uMoving = moving;

    this._idleC = [];
    for (let i = 0; i < CREW_N; i++) {
      const P = this.pose['c' + i];
      /* MICRO-IDLE, DESYNCED per actor index (i*1.3 on the bob, i*0.7 on
         the sway) — a row of synchronized breathers reads mechanical */
      const brC = amb * Math.sin(2 * Math.PI * t / 5.1 + i * 1.3);
      const bob = 0.35 * brC;
      const swayC = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0 + i * 0.7);
      const syC = 1 + 0.0035 * brC;
      const hC = cH(P.x, P.y);         // the lobe scale (audit #4)
      pinSprite(this.crew[i], i % 2 ? ART.crewB : ART.crewA,
                [P.x, P.y], hC, P.flip, bob, swayC, syC);
      this.crew[i].style.opacity = (P.walking ? 0 : P.op).toFixed(3);
      if (P.op > 0.5 && !P.walking) {
        this._idleC.push({ i, dy: +bob.toFixed(3), rot: +swayC.toFixed(3),
                           sy: +syC.toFixed(5) });
      }
      const runN = i < 3 ? this.runStripN[i] : null;
      if (P.walking) {
        /* variety law: per-man frame phase (+i), flip from his own travel.
           A RUNNING man rides the crew-run strip at the sprint's own
           px-per-frame; a walking man keeps the walk strip — never both. */
        const run = !!(P.running && runN);
        const strip = run ? STRIP.run : STRIP.crew;
        const ppf = run ? PX_PER_FRAME.run : PX_PER_FRAME.crew;
        P.frame = (Math.floor(P.dist / ppf) + i) % strip.n;
        /* LANE PHYSICS: step-synced bob on the walking box, same clock (+i
           phase) as the frame; declared in the proof (P.gbob) */
        P.gbob = gaitBobY(run ? GAIT.run : GAIT.crew, P.dist / ppf + i,
                          run ? BOB_AMP.run : BOB_AMP.crew);
        placeStrip(run ? runN : this.crewStripN[i], strip, [P.x, P.y],
                   run ? RUN_H : hC, P.frame,
                   { flip: P.face < 0, bob: P.gbob });
        (run ? runN : this.crewStripN[i]).style.opacity = P.op.toFixed(3);
        (run ? this.crewStripN[i] : runN || { style: {} }).style.opacity = '0';
      } else {
        P.gbob = 0;
        this.crewStripN[i].style.opacity = '0';
        if (runN) runN.style.opacity = '0';
      }
    }

    /* the skin on his shoulder: hangs off his own pose, so it cannot drift
       off the man carrying it (the mask-on-the-face law) */
    if (S.skin && U.op > 0.05) {
      const f = hU / SCALE.ulysses;    // the skin scales with its carrier
      const dx = (U.flip ? -4 : 4) * f;
      this.skinBox = pinSprite(this.skinNode, ART.skin,
                               [U.x + dx, U.y - hU * 0.42],
                               0.62 * SCALE.pxPerM * f, U.flip, bobU);
      this.skinNode.style.opacity = U.op.toFixed(3);
    } else {
      this.skinNode.style.opacity = '0';
      this.skinBox = null;
    }

    this.paintShadows();
  }

  /** THE SHADOW PASS (Explorer C — chase.js paintRigs, ported): the anchor
   *  lands on the actor's own foot mark, scaled by k = drawnH / cutH,
   *  opacity (0.42 + 0.30 * s) * actorOp; the stand shadow serves the walk
   *  strip too (the feet are the same feet), Ulysses' walk cut has its own. */
  shadowPut(node, name, at, hPx, op, id) {
    const rec = SHADOW[name];
    const k = hPx / SHADOW_CUT_H[name];
    box(node, at[0] - rec.anchor[0] * k, at[1] - rec.anchor[1] * k,
        rec.size[0] * k, rec.size[1] * k);
    const o = (0.42 + 0.30 * shadowS(at[1])) * op;
    node.style.opacity = o.toFixed(3);
    if (o > 0.005) {
      this._shadows.push({ id, name, at: [+at[0].toFixed(1), +at[1].toFixed(1)],
                           s: +shadowS(at[1]).toFixed(3), op: +o.toFixed(3),
                           box: this.drawnBox(node) });
    }
  }

  paintShadows() {
    const U = this.pose.u;
    this._shadows = [];
    const uKind = this.uMoving ? 'walk' : 'stand';
    for (const [kind, node] of Object.entries(this.uShN)) {
      if (kind !== uKind || !(U.op > 0.005)) { node.style.opacity = '0'; continue; }
      this.shadowPut(node, 'ulysses-' + kind, [U.x, U.y], uH(U.x, U.y),
                     U.op, 'ulysses');
    }
    for (let i = 0; i < CREW_N; i++) {
      const P = this.pose['c' + i];
      if (P.op > 0.005) {
        this.shadowPut(this.crewShN[i], i % 2 ? 'crew-b-stand' : 'crew-a-stand',
                       [P.x, P.y], cH(P.x, P.y), P.op, 'crew' + i);
      } else this.crewShN[i].style.opacity = '0';
    }
  }

  /* ---- harness -------------------------------------------------------- */
  /** the box a cut is DRAWN in, read back off the element (the chase `plate`
   *  pattern): a wrong transform cannot describe itself correctly */
  drawnBox(node) {
    const l = parseFloat(node.style.left), tp = parseFloat(node.style.top);
    const w = parseFloat(node.style.width), h = parseFloat(node.style.height);
    if (!(w > 0)) return null;
    return [+l.toFixed(1), +tp.toFixed(1), +w.toFixed(1), +h.toFixed(1)];
  }

  /** the window a lens opens after the camera's edge clamp (the lensLaw),
   *  for the smoke-containment proof: [x, y, w, h] in plate px */
  lensFrame(f, visW) {
    const fw = visW / f[2], fh = PLATE.h / f[2];
    const cx = Math.min(Math.max(f[0], fw / 2), PLATE.w - fw / 2);
    const cy = Math.min(Math.max(f[1], fh / 2), PLATE.h - fh / 2);
    return [cx - fw / 2, cy - fh / 2, fw, fh];
  }

  boxOverlap(a, b) {
    const w = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
    const h = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    return (w * h) / (a[2] * a[3]);
  }

  snapshot() {
    const S = this.state;
    const seg = S.seg;
    const ck = this.crossK();
    const dayK = this.dayK || 0;
    /* the smoke lens proof: how much of the columns' band the `smoke` lens
       actually shows, landscape AND portrait (1060 px visible, WIRING §7) */
    const smokeL = this.boxOverlap(SMOKE.box, this.lensFrame(FOCUS.smoke, PLATE.w));
    const smokeP = this.boxOverlap(SMOKE.box, this.lensFrame(FOCUS.smoke, 1060));
    /* the [idle] proof wants the RENDERED box — transform applied — where
       drawnBox is the parking law's arithmetic (transform-free) box */
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
        u: this._idleU ? { ...this._idleU, box: pbox(this.ulysses) } : null,
        crew: this._idleC || [],
      },
      /* the painted STATE, and the crossfade's own number */
      shoreState: { name: dayK > 0.5 ? 'shore-day' : 'shore', dayK: +dayK.toFixed(3) },
      staging: S.staging,
      seg: seg ? { name: seg.name,
                   k: +clamp01((S.t - seg.t0) / seg.dur).toFixed(3) } : null,
      /* the G1 crossing: its clock, its legs, and the lens it is holding */
      crossing: ck === null ? null : {
        k: +ck.toFixed(3), done: ck >= 1,
        leg: ck >= 1 ? 'done' : (ck < CROSS.glideEnd ? 'strait' : 'push'),
        cam: this.crossingLens().map((v) => +v.toFixed(1)),
      },
      camOverride: this.camOverride(),
      /* the gate's own geometry, so the lap measures the SET's numbers */
      gate: { ship: { at: TARGETS.ship.at.slice(), hull: TARGETS.ship.hull.slice(),
                      live: this.targetLive('ship') } },
      /* fact O.1's carrier: the columns, their band, and the containment the
         `lawless` unit's lens owes them — in both orientations */
      smoke: { columns: SMOKE.columns.map((c) => c.slice()), box: SMOKE.box.slice(),
               lens: FOCUS.smoke.slice(),
               inLandscape: +smokeL.toFixed(3), inPortrait: +smokeP.toFixed(3),
               visible: smokeL >= 0.8 && smokeP >= 0.8 },
      /* the fire and its bloom: gains are the layer lane's stateLightMap */
      fire: { gain: +lerp(1, DAY_GAINS.fire, dayK).toFixed(3),
              bloom: +(this.bloomOp || 0).toFixed(3),
              emis: +(+this.emis.fire.style.opacity || 0).toFixed(3) },
      /* THE CAST, per-actor drawn boxes (the parking-law pattern): mark is
         where the pose stands, box is where the cut is painted, both in
         plate px, read back off the elements */
      cast: {
        ulysses: { mark: [+this.pose.u.x.toFixed(1), +this.pose.u.y.toFixed(1)],
                   op: +this.pose.u.op.toFixed(3),
                   moving: !!(this.uMoving || this.pose.u.away),
                   box: this.drawnBox(this.uMoving ? this.uStripN : this.ulysses) },
        skin: { shouldered: S.skin,
                box: this.skinBox ? this.drawnBox(this.skinNode) : null },
        crew: this.crew.map((node, i) => ({
          mark: [+this.pose['c' + i].x.toFixed(1), +this.pose['c' + i].y.toFixed(1)],
          op: +this.pose['c' + i].op.toFixed(3),
          moving: !!(this.pose['c' + i].walking || this.pose['c' + i].away),
                                                 // mid-stride OR short of the
                                                 // mark: the parking +
                                                 // perspective laws want settles
          box: this.drawnBox(node),
        })),
        onStage: 1 * (this.pose.u.op > 0.5) +
                 this.crew.reduce((n, _, i) => n + (this.pose['c' + i].op > 0.5 ? 1 : 0), 0),
      },
      /* THE STRIP PROOF (the sherlock walk law): per walking actor, the frame
         and the foot measured off the RENDERED box vs the pose's own mark —
         the lap holds cycling (>= 2 frames) and |dx|,|dy| against these */
      strips: {
        /* LANE PHYSICS: the mark handed to each proof is shifted by the
           declared step-bob (translateY on the walking box), so the anchor
           law measures the transform's residual — the rowers' documented
           bench-bob precedent. */
        ulysses: this.pose.u.walking
          ? stripProof(this.st, this.uStripN, STRIP.ulysses, this.pose.u.frame,
                       [this.pose.u.x, this.pose.u.y + (this.pose.u.gbob || 0)],
                       this.pose.u.face < 0)
          : null,
        crew: this.crew.map((_, i) => {
          const P = this.pose['c' + i];
          return P.walking && !P.running
            ? stripProof(this.st, this.crewStripN[i], STRIP.crew, P.frame,
                         [P.x, P.y + (P.gbob || 0)], P.face < 0)
            : null;
        }),
        /* the dash aboard: the run strip's own proof, per sprinting man */
        run: this.runStripN.map((n, i) => {
          const P = this.pose['c' + i];
          return P.running && P.walking
            ? stripProof(this.st, n, STRIP.run, P.frame,
                         [P.x, P.y + (P.gbob || 0)], P.face < 0)
            : null;
        }),
      },
      board: !!S.board,
      /* the inset and THE DIM's honest deviation (see header) */
      inset: { wineskin: +((this.st.state.plate || {}).wineskin || 0).toFixed(3) },
      dim: { scrim: +(+this.scrim.style.opacity || 0).toFixed(3),
             matrix: DIM_MATRIX.slice(), painted: false },
      /* EXPLORER C's own proofs: the live shadows, the under-the-actors
         group order, and the firepit occluder's last-in-group paint order */
      grounding: {
        under: !!(this.shadowG.compareDocumentPosition(this.actors) &
                  Node.DOCUMENT_POSITION_FOLLOWING),
        shadows: this._shadows || [],
        occ: [{ id: 'firepit', ground: OCC_FIREPIT.ground,
                at: OCC_FIREPIT.origin.slice(),
                op: +(+this.occFirepit.style.opacity || 0).toFixed(3),
                dom: Array.prototype.indexOf.call(this.actors.children,
                                                  this.occFirepit),
                groupN: this.actors.children.length }],
      },
    };
  }
}

export { FOCUS, MARKS, TARGETS, EMIS, DIM_MATRIX, CROSS, SCALE, SHIP2, SMOKE,
         FLOORS, STAGE };
