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
         walkToward } from '../setkit.js';
import { STRIPS } from '../strips.js';

/* ---- the ledger, transcribed ---------------------------------------- */
const SCALE = { pxPerM: 11.3, ulysses: 20, crew: 19 };

const FLOORS = {
  beach: [[300, 455], [438, 486], [540, 500], [610, 505]],       // band 18
  mainlandApron: [[950, 252], [1008, 268], [1040, 272]],         // band 8
  mainlandYard: [[940, 300], [1010, 318], [1090, 330]],          // band 10
};

/* the marks, ledger names verbatim — each serves the units it names */
const MARKS = {
  'fire-ulysses':   [390, 480],    // left of the fire ring, facing it (i-02/03)
  'council-ulysses': [510, 492],   // open sand, back to the strait (i-06/07)
  'council-crew':   [445, 507],    // the crew arc CENTROID facing Ulysses
  'twelve-at-ship': [560, 503],    // lined on the sand along ship-2's hull (i-10)
  'entry-mainland': [1008, 268],   // the grass apron between the laurels (i-08+)
  'climb-path':     [940, 325],    // below the yard wall, behind the plate (i-12)
};

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

/* ---- the lenses, ledger names + values VERBATIM --------------------- */
const FOCUS = {
  establishing:          [704, 384, 1.0],    // the black strait wide; day reuses it
  smoke:                 [980, 205, 1.9],    // the O.1a carrier frame (i-04)
  council:               [505, 470, 2.2],
  'camp-fire':           [430, 468, 2.4],
  'ship-mid':            [560, 470, 3.0],    // Ulysses shouldering the skin (i-10)
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
  S.camp = {
    u: { at: MARKS['fire-ulysses'], flip: false },          // fire at 438, on his right
    crew: [{ at: [456, 492], flip: true }, { at: [474, 497], flip: true },
           { at: [492, 502], flip: true }],
  };
  S.council = {
    u: { at: MARKS['council-ulysses'], flip: true },        // faces the arc on his left
    crew: [{ at: [426, 501], flip: false }, { at: [445, 507], flip: false },
           { at: [464, 511], flip: false }],
  };
  S.mainland = {
    u: { at: MARKS['entry-mainland'], flip: false },
    crew: [{ at: [988, 264], flip: false }, { at: [1024, 271], flip: false },
           { at: [972, 258], flip: false }],
  };
  const twelve = [];
  for (let i = 0; i < 6; i++) {                              // left flank of six
    const x = 486 + i * 13;
    twelve.push({ at: [x, beachY(x) + (i % 2 ? 2 : -1)], flip: false });
  }
  for (let i = 0; i < 6; i++) {                              // right flank of six
    const x = 574 + i * 13;
    twelve.push({ at: [x, beachY(x) + (i % 2 ? 2 : -1)], flip: true });
  }
  S.twelve = { u: { at: MARKS['twelve-at-ship'], flip: false }, crew: twelve };
  const climb = [];
  for (let i = 0; i < CREW_N; i++) {                         // the file, below the wall
    climb.push({ at: [952 + i * 6.5, 328 + i * 1.9], flip: false });
  }
  S.climb = { u: { at: MARKS['climb-path'], flip: false }, crew: climb };
  return S;
}
const STAGE = stagings();

/* the landfall pantomime's wade-in points (i-01): out of the shallows where
   the fog band breathes, walking up the apron into the camp staging */
const WADE = { u: [598, 504], crew: [[620, 506], [585, 502], [640, 508]] };
/* the hunt dash (i-05): two men out along the apron after the painted goats */
const HUNT = [[600, beachY(600) - 1], [632, beachY(632) + 1]];

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

    /* ---- THE ACTORS (isolated, so the dim matrix is theirs alone) ---- */
    this.actors = el('div', 'actors', root);
    this.ulysses = img(ART.ulyssesStand.file, 'lyr', this.actors);
    /* the WALK STRIP replaces the old single walk-pose cut: decoded at boot
       via st.bitmap (room.js: the first walk frame never flashes white) */
    this.uStripN = el('div', 'lyr walk', this.actors);
    this.uStripN.style.backgroundImage = st.bitmap(STRIP.ulysses.file);
    this.uStripN.style.opacity = '0';
    this.crew = [];
    this.crewStripN = [];
    for (let i = 0; i < CREW_N; i++) {
      const node = img(i % 2 ? ART.crewB.file : ART.crewA.file, 'lyr', this.actors);
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
    this.skinNode = img(ART.skin.file, 'lyr', this.actors);
    this.skinNode.style.opacity = '0';

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
    return [P.x, P.y - SCALE.ulysses * 0.92];
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
        const dd = Math.hypot(dx, dy), step = RUN_V * dt;
        if (dd > 1.5 && P.op > 0.05) {
          const u = Math.min(1, step / dd);
          P.x += dx * u; P.y += dy * u;
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
        const e = easeInOut(segK), op = clamp01(segK / 0.18);
        const put = (key, from, to) => {
          const P = this.pose[key];
          P.x = lerp(from[0], to[0], e); P.y = lerp(from[1], to[1], e);
          P.op = op; P.flip = want[key].flip;
        };
        put('u', WADE.u, want.u.at);
        for (let i = 0; i < 3; i++) put('c' + i, WADE.crew[i], want['c' + i].at);
        for (let i = 3; i < CREW_N; i++) this.pose['c' + i].op = 0;
        this.paintTroupe(t, dt, amb);
        return;
      } else if (seg.name === 'hunt') {
        /* two men dash out after the goats; everyone else holds the camp.
           The seg ends with them at the far apron and the damp walks them
           home — the hunters come back to the fire with the meat. */
        const e = easeOut(segK);
        for (const [i, far] of HUNT.entries()) {
          const key = 'c' + i, P = this.pose[key], from = want[key].at;
          P.x = lerp(from[0], far[0], e); P.y = lerp(from[1], far[1], e);
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
        continue;
      }
      if (!W.vis) { P.op = damp(P.op, 0, 5.0, dt); continue; }
      let far = Math.hypot(P.x - W.at[0], P.y - W.at[1]) > 250;
      if (P.op < 0.06) {                             // off stage: land ON the mark
        P.x = W.at[0]; P.y = W.at[1]; P.flip = W.flip; far = false;
      }
      if (far) {
        P.op = damp(P.op, 0, 5.0, dt);               // fade out where he was…
      } else {
        /* …or WALK the last stretch: the damp shapes the tail, the cap keeps
           the ground speed a walking speed (see WALK_V — the skate law) */
        walkToward(P, W.at[0], W.at[1], 1.8,
                   key === 'u' ? WALK_V.ulysses : WALK_V.crew, dt);
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
    pinSprite(this.ulysses, ART.ulyssesStand, [U.x, U.y], SCALE.ulysses, U.flip,
              bobU, moving ? 0 : swayU, moving ? 1 : syU);
    this.ulysses.style.opacity = (moving ? 0 : U.op).toFixed(3);
    this._idleU = !moving && U.op > 0.5
      ? { dy: +bobU.toFixed(3), rot: +swayU.toFixed(3), sy: +syU.toFixed(5) }
      : null;
    if (moving) {
      U.frame = Math.floor(U.dist / PX_PER_FRAME.ulysses) % STRIP.ulysses.n;
      placeStrip(this.uStripN, STRIP.ulysses, [U.x, U.y], SCALE.ulysses,
                 U.frame, { flip: U.face < 0 });
      this.uStripN.style.opacity = U.op.toFixed(3);
    } else {
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
      pinSprite(this.crew[i], i % 2 ? ART.crewB : ART.crewA,
                [P.x, P.y], SCALE.crew, P.flip, bob, swayC, syC);
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
        P.frame = (Math.floor(P.dist / (run ? PX_PER_FRAME.run : PX_PER_FRAME.crew)) + i)
                  % strip.n;
        placeStrip(run ? runN : this.crewStripN[i], strip, [P.x, P.y],
                   run ? RUN_H : SCALE.crew, P.frame, { flip: P.face < 0 });
        (run ? runN : this.crewStripN[i]).style.opacity = P.op.toFixed(3);
        (run ? this.crewStripN[i] : runN || { style: {} }).style.opacity = '0';
      } else {
        this.crewStripN[i].style.opacity = '0';
        if (runN) runN.style.opacity = '0';
      }
    }

    /* the skin on his shoulder: hangs off his own pose, so it cannot drift
       off the man carrying it (the mask-on-the-face law) */
    if (S.skin && U.op > 0.05) {
      const dx = U.flip ? -4 : 4;
      this.skinBox = pinSprite(this.skinNode, ART.skin,
                               [U.x + dx, U.y - SCALE.ulysses * 0.42],
                               0.62 * SCALE.pxPerM, U.flip, bobU);
      this.skinNode.style.opacity = U.op.toFixed(3);
    } else {
      this.skinNode.style.opacity = '0';
      this.skinBox = null;
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
                   op: +this.pose.u.op.toFixed(3), moving: !!this.uMoving,
                   box: this.drawnBox(this.uMoving ? this.uStripN : this.ulysses) },
        skin: { shouldered: S.skin,
                box: this.skinBox ? this.drawnBox(this.skinNode) : null },
        crew: this.crew.map((node, i) => ({
          mark: [+this.pose['c' + i].x.toFixed(1), +this.pose['c' + i].y.toFixed(1)],
          op: +this.pose['c' + i].op.toFixed(3),
          box: this.drawnBox(node),
        })),
        onStage: 1 * (this.pose.u.op > 0.5) +
                 this.crew.reduce((n, _, i) => n + (this.pose['c' + i].op > 0.5 ? 1 : 0), 0),
      },
      /* THE STRIP PROOF (the sherlock walk law): per walking actor, the frame
         and the foot measured off the RENDERED box vs the pose's own mark —
         the lap holds cycling (>= 2 frames) and |dx|,|dy| against these */
      strips: {
        ulysses: this.pose.u.walking
          ? stripProof(this.st, this.uStripN, STRIP.ulysses, this.pose.u.frame,
                       [this.pose.u.x, this.pose.u.y], this.pose.u.face < 0)
          : null,
        crew: this.crew.map((_, i) => {
          const P = this.pose['c' + i];
          return P.walking && !P.running
            ? stripProof(this.st, this.crewStripN[i], STRIP.crew, P.frame,
                         [P.x, P.y], P.face < 0)
            : null;
        }),
        /* the dash aboard: the run strip's own proof, per sprinting man */
        run: this.runStripN.map((n, i) => {
          const P = this.pose['c' + i];
          return P.running && P.walking
            ? stripProof(this.st, n, STRIP.run, P.frame, [P.x, P.y], P.face < 0)
            : null;
        }),
      },
      board: !!S.board,
      /* the inset and THE DIM's honest deviation (see header) */
      inset: { wineskin: +((this.st.state.plate || {}).wineskin || 0).toFixed(3) },
      dim: { scrim: +(+this.scrim.style.opacity || 0).toFixed(3),
             matrix: DIM_MATRIX.slice(), painted: false },
    };
  }
}

export { FOCUS, MARKS, TARGETS, EMIS, DIM_MATRIX, CROSS, SCALE, SHIP2, SMOKE,
         FLOORS, STAGE };
