/**
 * sets/sea.js — the strait under the Cyclops' cliff. Leaf 5, Beat VI, THE TAUNT.
 *
 * ONE MASTER (sea.jpg: night, moon, lit cave at the cliff base) and THE SHIP IS
 * PAINTED INTO IT — the ledger's own yardstick is measured off the master's hull
 * (sternpost waterline 495,462 -> bow tip 678,516). So the ship cannot translate
 * a pixel, and the two washes and the glide-out are performed the only way a
 * painted diorama can perform them: THE WHOLE WORLD MOVES. Everything this set
 * paints — master, fog, emissives, actors, blooms — lives in one `world` group
 * whose transform-origin is the ship's own deck centre (575,450), and distance
 * is what distance is in an isometric diorama: SIZE. Driven back toward land,
 * the world scales UP about the deck (the island looms); the oars bite and it
 * scales down past rest (the headland "scaled back" — the ledger's receding-
 * shore transform, "a transform, not an asset"); rock 2's wash shoves it
 * further; sailedon glides it out. The crew stand ON the painted hull, inside
 * the group, so they ride the transform and cannot slide off their marks. Every
 * plate-px answer this set gives the engine (targetPlate, headPlate, focus
 * centres, hit tests) is mapped through that same transform — worldMap() — so
 * the gate ring stands on the giant wherever the recede has put him.
 *
 * THE TWO CLOCKS (ruseT law). `clock` units are timed against ruseT() zero:
 *   zero 1  the JEER gate's resolution (gateAct `jeer`) — rock1's clock.
 *           taunt's 6.0 s dwell spends under it and ody-vi-03 arrives at t+7.0.
 *   zero 2  the CURSE act (ody-vi-11 entry) RE-ZEROES the clock — rock2's.
 *           ody-vi-12 `heard` is gated at t+1.2. NOTE THE ENGINE'S OWN SHAPE:
 *           curse is a CLICK unit, so `heard` enters on the reader's click (at
 *           1.2 s earliest), and the engine fires nothing at the set on a clock
 *           unit's entry. Rock 2 therefore rides the curse clock as a pure
 *           function — the tear at t+3.0 — and for a slow reader the near-miss
 *           punctuates the curse itself, which is what "the line's punctuation"
 *           already means; `wait: rock2` still holds the page for the fast one.
 *
 * THE GATE, TWICE (G6). One target, `cyclops`, anchored on the VISIBLE giant's
 * body centre (the sherlock lit-window rule): mark (860,210), body 89 px, so
 * (860,168) — the ledger's own number — mapped through the world. The first
 * click is the jeer; the second resolves OVER the men's still-lit plea and arms
 * `myname`, the reader's hubris (O.12) — the set counts both resolutions and
 * the snapshot says whether the name has been given.
 *
 * THE GIANT'S THREE POSES are acts of the clocks, crossfaded the way room-dim
 * crossfades its plate: hurl during the two rock windows, curse with both arms
 * to the firmament from the curse act until the second tear (the document-
 * weight frame: sky darkened a stop by an authored veil, bed to near-silence),
 * stand between and after.
 *
 * OPEN GAPS THIS SET DEGRADES ON, honestly (ledger objectLedger):
 *   - sea dawn state: NO dawn master ships. `sea-dawn` is performed as the
 *     night lights going out, the fog thinning, and one authored warm horizon
 *     glow — a stand-in, stated in the snapshot as state 'sea-dawn'.
 *   - island-beach return layer: SHIPPED 2026-08-17 (§3.4 — the sacrifice
 *     must SHOW). sea-beach.png rises on seg `return-beach` (c6), the
 *     comrades await on the sand, the flock streams ashore (c7), the great
 *     ram stands at the driftwood altar with the thigh-fire's straight
 *     smoke (u13), the dusk time-dip falls (c8) and the men board at dawn
 *     (c9). See THE RETURN TABLEAU below; the snapshot's `beach` block is
 *     the lap's §3.4 carrier evidence.
 *
 * Every mark, lens, splash point and emissive below is tools/ody/ledger.json /
 * layers-sea.json VERBATIM; actor pins are tools/ody/actors.json verbatim;
 * actor heights are the stage proof's (tools/ody/stageproof_sea.py).
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp,
         emissives, breathe, placeStrip, stripProof,
         bridgeFrame, loopFrame, gradedActor } from '../setkit.js';
import { STRIPS } from '../strips.js';
import { SHADOWS } from '../shadows.js';
import { HEROCLIP_FILES } from '../heroclips.js';
import { SHOT_FILES } from '../shots.js';

/* ---- the ledger, transcribed ---------------------------------------- */
const SHIP = {
  sternTip: [495, 462], bowTip: [678, 516],
  mastFoot: [578, 462], mastTop: [580, 350],
  deckCentre: [575, 450],                   // the world transform's origin
};
const SPLASH1 = [468, 505];   // rock 1: ahead of the rudder, off the sternpost
const SPLASH2 = [455, 540];   // rock 2: astern, nearer the camera — the near-miss
const BOULDERS = [[850, 30], [1100, 170]];  // the ammunition, painted behind him
const RELEASE = [852, 112];   // where the hurl lets go: the raised hands over the brow

const MARKS = {
  'clifftop-giant': [860, 210],
  'stern-ulysses':  [518, 426],
  'stern-rail':     [506, 406],
  'rower-1n': [556, 444], 'rower-2n': [586, 455], 'rower-3n': [616, 466],
  'rower-1f': [573, 430], 'rower-2f': [603, 441], 'rower-3f': [633, 452],
};
const ROWER_MARKS = ['rower-1f', 'rower-1n', 'rower-2f', 'rower-2n',
                     'rower-3f', 'rower-3n'];   // ascending mark y = painter order

/* the measured light (layers-sea.json emis, verbatim) */
const EMIS = [
  { id: 'moon',     at: [474, 242], r: 143, rgb: '223,240,255', a: 0.10, per: 9.5, amp: 0.18 },
  { id: 'moonpath', at: [475, 356], r: 74,  rgb: '223,241,255', a: 0.09, per: 7.3, amp: 0.35 },
  { id: 'cave',     at: [818, 457], r: 60,  rgb: '255,185,50',  a: 0.20, per: 3.2, amp: 0.55 },
  { id: 'crag',     at: [820, 339], r: 90,  rgb: '255,185,50',  a: 0.10, per: 3.2, amp: 0.45 },
];

/* the measured layers (layers-sea.json), boxes and opacity ranges verbatim */
const LAYER = {
  fog:       { box: [225, 215, 732, 407], op: [0.45, 0.70], drift: 90, per: 23.0 },
  bloomCave: { box: [634, 189, 265, 376], op: [0.20, 0.75], per: 3.2 },
  bloomMoon: { box: [301,  69, 344, 344], op: [0.10, 0.28], per: 9.5 },
};

/* THE SCALE LAW: 12.7 px/m off the painted hull (15 m, 190.8 px tip-to-tip).
 * ulysses 22 px, a seated rower 15 px, the giant's BODY 89 px on the brow —
 * the arms-up cuts (hurl, curse) run 105 px TOTAL so the body still reads 89
 * (the stage proof's own arithmetic). */
const PX_PER_M = 12.7;
const ULY_H = 22, ROWER_H = 15, GIANT_H = 89, GIANT_ARMS_H = 105;
const SPLASH_H = 76;                        // a 6 m plume at 12.7 px/m

/* the cuts, tools/ody/actors.json verbatim: [w,h], the foot PIN on the
 * baseline. A cut hangs off its PIN, not off its box centre — the pin is the
 * measured foot, and anchoring anywhere else lets a re-crop move the feet. */
const ART = {
  ulyStand:   { px: [316, 682],  pin: [125, 676] },
  ulyTaunt:   { px: [294, 680],  pin: [43, 674] },   // faces the wrong way raw;
                                                     // flipped at the stern (proof)
  giantStand: { px: [674, 1244], pin: [473, 1238] },
  giantHurl:  { px: [640, 1286], pin: [57, 1280] },
  giantCurse: { px: [719, 1287], pin: [440, 1281] },
  rock:       { px: [776, 568],  pin: [225, 562] },
  splash:     { px: [510, 1127], pin: [253, 1121] },
  /* the return tableau's cuts (tools/ody/actors.json verbatim; altar is the
     2026-08-17 nbpro generation, keyed + registered the same way) */
  crewA:      { px: [266, 620],  pin: [132, 614] },
  crewB:      { px: [276, 635],  pin: [140, 629] },
  crewPlead:  { px: [570, 931],  pin: [208, 925] },
  ramGreat:   { px: [867, 687],  pin: [376, 681] },
  ramWalk:    { px: [815, 663],  pin: [343, 657] },
  altar:      { px: [690, 544],  pin: [335, 532] },
};

/* ---- THE RETURN TABLEAU (§3.4 — the sacrifice must SHOW) ----------------- *
 * CONTENT-odyssey.md Beat VI tail: c6 the island beach layer RISES and the
 * comrades await on the sand with lifted arms; c7 the flock streams ashore
 * and is divided; u13 the GREAT RAM at a DRIFTWOOD ALTAR, thigh-fire smoke
 * straight up, NO sign; c8 the dusk time-dip; c9/u14 the dawn departure.
 * The band is set/sea/sea-beach.png — the sea master's own bottom rows,
 * regenerated with the beach painted in (nbpro edit, assets/raw/ody-return)
 * and feathered over the plate — and it lives OUTSIDE the world group: the
 * beach is the island the return lands on, the page's own foreground, so
 * the recede cannot scale the shore out from under the bodies standing on
 * it. Bodies ashore are the shipped cuts at measured sand marks; the
 * FOREGROUND scale is its own (the band is nearer than the painted ship):
 * 19 px/m, documented in the ledger with the layer. The thigh-fire and its
 * straight smoke are authored light — the dawn-glow precedent. */
const BEACH = { file: 'set/sea/sea-beach.png', box: [0, 460, 1408, 308],
                pxPerM: 19 };
const B_FIRE_AT = [330, 646];        // the flame stands on the altar's top bed
/* [id, ART key, sand mark, drawn h, flip] — painter order = ascending mark y */
const B_CAST = [
  ['crew-await',   'crewPlead', [180, 648], 32, true ],
  ['crew-b',       'crewB',     [472, 655], 32, false],
  ['uly-ashore',   'ulyStand',  [281, 662], 33, false],
  ['altar',        'altar',     [330, 668], 26, false],
  ['crew-plead-2', 'crewPlead', [521, 684], 32, false],
  ['crew-a',       'crewA',     [225, 690], 32, true ],
  ['ram-return',   'ramGreat',  [392, 700], 34, false],
  ['crew-a2',      'crewA',     [598, 700], 32, false],
  ['flock-2',      'ramWalk',   [560, 700], 24, true ],
  ['flock-3',      'ramWalk',   [455, 712], 24, false],
  ['flock-1',      'ramWalk',   [505, 720], 24, false],
];
const B_FILES = { crewA: 'actor/crew-a-stand.png', crewB: 'actor/crew-b-stand.png',
                  crewPlead: 'actor/crew-plead.png', ramGreat: 'actor/ram-great.png',
                  ramWalk: 'actor/ram-walk.png', altar: 'actor/prop-altar.png',
                  ulyStand: 'actor/ulysses-stand.png' };

/* ---- THE TWO ROCK CLOCKS, in seconds on their own ruseT zero ---------- *
 * ROCK1 zero = the jeer gate. The unit itself arrives at 7.0 (units.js `at`),
 * with the tear; done at 18.8 — the "~12 s clock" measured from the unit.
 * ROCK2 zero = the curse act. `heard` is gated at 1.2; the tear waits until
 * 3.0 so the curse's arms-up document frame holds a beat before the answer. */
const ROCK1 = { tear: 7.0, loose: 8.6, land: 10.8,
                wash: [10.8, 14.4], oars: [14.4, 18.2], done: 18.8 };
const ROCK2 = { tear: 3.0, loose: 4.6, land: 6.8,
                wash: [6.8, 11.4], done: 12.2 };
const DAWN_GLIDE = 8.0;       // sailedon's own dwell: the glide out under it

/* THE RELEASE FOLLOW-THROUGH (throw lane, 2026-08-17 — the external review's
 * catch: "it simply detaches while his pose remains fixed"). The hurl pose
 * now ends AT the throw tick (`loose`, when the rock is born), not at
 * land+0.8: the crossfade back to polyphemus-stand (damp 6.0 = ~300 ms to
 * read) IS step one of the two-step ease, and step two is the ROTATION LAG —
 * the stand cut arrives carrying FOLLOW_ROT deg of the throw's own lean
 * (toward the ship, screen-left = negative) and un-twists about the pinned
 * feet over FOLLOW_S. A pure function of the rock clocks, so a replayed lap
 * lands the same frames. */
const FOLLOW_S = 0.45;        // the un-twist's whole life; ~300 ms reads
const FOLLOW_ROT = -2.0;      // deg about the pin, toward the thrown rock

/* THE IMPACT ACCENT (same round): the splash's rise used to be the sine
 * bump's own tail — k = sin(pi*u) over 2 s put 0.026 one tick after the
 * land while the rock had already vanished: a 0.1-0.3 s hole where the sea
 * swallowed the rock silently. The envelope now ATTACKS: full plume inside
 * SPLASH_ATTACK of the 2 s window (easeOut, so one fixed tick past land
 * already reads k=0.42), decays on the old sine tail, and the first
 * ACCENT_S carry a +15% scale overshoot (the "first 3 ticks" accent). */
const SPLASH_ATTACK = 0.05;   // of the 2 s splash window = 0.1 s to full
const ACCENT_S = 0.05;        // 3 fixed 1/60 ticks of +15% scale

/* THE HULL PITCH (the boat's reaction beat): the ship is painted into the
 * master, so the hull pitches the only way a painted hull can — the WORLD
 * rotates about the deck centre (the same argument as the recede's scale).
 * Two damped swings over PITCH_S, peak PITCH deg, rock 2 harder (nearer)
 * and opposite (astern). worldMap carries the rotation exactly, so the
 * gate ring and every mapped anchor ride the lurch. */
const PITCH = { rock1: 1.4, rock2: -1.8 };   // deg, first swing's sign
const PITCH_S = 2.2;          // the rock dies out by land + 2.2 s

/* THE WORLD'S FOUR STATIONS, as scale about the deck. 1.0 is "as far out as my
 * voice would reach". The wash looms the island to 1.07 (driven BACK — "drove
 * us back again to the mainland"), the oars pull out to 0.86 (twice as far,
 * the headland scaled back), rock 2's wash drives on to 0.76, and the return
 * seg + the dawn glide take it to ~0.56 as the page turns to the card. */
const WORLD = { back: 0.07, out: 0.21, onward: 0.10, seg: 0.06, dawn: 0.14 };

const FOCUS = {
  /* the ledger's sea lenses, verbatim. The wide is the two-plane frame the
     FIRST gate keeps, so the pleading men and the target share it. Close-lens
     CENTRES are mapped through the world transform every frame (the subject
     cannot leave its own lens when the shore recedes); their k stays the
     ledger's, so the recede is allowed to read in every frame.

     THE RECEDE'S OWN LENSES (round 3, sherlock F2). The paint of this master
     is concentrated — cliff right, ship mid-left, open navy elsewhere — and
     once the washes have scaled the world down (0.86 by the second gate, 0.70
     by the ram, ~0.69 under the closing turn's cover) the k=1 wide frames
     more void and dead water than painting: measured 28-36% dead band on
     defy/heard/ram/sailedon against the 22% law. So every unit that plays
     AFTER the first wash composes INSIDE the painting at its own k:
       strait    the two-plane frame tightened to the painted strait — stern,
                 rowers, splash water and the whole cursing giant in one
                 window (x 233..937, y 138..522 at rest), so the second gate
                 still holds pleaders and target together, and rock 2's
                 splash point (455,540) stays in frame through the wash;
       homeward  the row home AND the return tableau (§3.4): recomposed
                 2026-08-17 for the shipped beach — the window holds the
                 grounded ship (mast top ~377 at the seg's world k), the
                 cave fire falling astern, and the whole tableau band —
                 comrades, flock, the great ram at the driftwood altar;
       moonpath  sailedon/the end: follows the ship toward the painted
                 moonpath and moon (475,356 / 474,242), not the open water —
                 it is the frame the closing cover rises over, composed for
                 the world at ~0.69 of its rest scale. */
  establishing: [704, 384, 1.00],
  /* THE FIRST-GATE WIDE (round 4, the same F2 law as the three recede lenses
     below): the k=1 wide's right band is the plate's own night — measured
     317 px of >= 94% near-black columns, 22.5% of the frame, so the dead-band
     verdict rode the fog/crag BREATH's phase (20% one lap, 24% the next).
     jeer/rock1 now compose INSIDE the painting: window x 64..1156 y 27..623
     holds both planes — the giant with his raised arms and the painted
     ammunition (850,30 / 1100,170), the release (852,112), rock 1's whole
     arc to the splash (468,505) with its 76 px plume, the ship, the six
     benches and the moon — and the static plate measures dead L4 R4 T0 B0
     (max 4% against the 22% law; the breath can only ADD light). */
  'gate-wide':  [610, 325, 1.29],
  /* THE CLOSE-UP LAW (owner round, 2026-08-17): character units render their
     principal >= 30% of panel height, two-shots >= 22%. On this 12.7 px/m
     plate the 22 px Ulysses needs k ~10.5-12.3 for the dialogue floor — the
     three speech lenses below are TRUE closes now (the plate goes soft under
     the crisp 600+ px cuts; it reads as depth of field), and the exchanges
     the CONTRACT stages as two-plane keep both subjects with the LARGER
     body carrying the 22% floor. Close-lens centres still map through the
     world transform every frame; drawn heights shrink with the recede, and
     the ks below are set at each unit's own world station. */
  stern:        [518, 415, 10.60],  // vi-02: the taunt — Ulysses 30.1% (was
                                    // [530,430,2.8] = an 8% speck)
  'stern-rail': [506, 400, 12.30],  // vi-07: the name given on the rail —
                                    // 30.3% at the out-station's world 0.86
  'menbeg-close': [545, 433, 14.10],// vi-05: the rowers' faces up at him, the
                                    // gripped arm — nearest rower 22% (T)
  'ship-deck':  [575, 450, 2.60],   // vi-04: the doubled distance (composed)
  clifftop:     [870, 195, 3.10],   // vi-08/09 — the giant 30.9% at world
                                    // 0.86 (was 2.8 = 27.9%, under the floor)
  curse:        [870, 180, 2.50],   // [shot] re-valued 2.6 -> KCAP   // vi-11 — the lifted arms 31.7% at world
                                    // 0.86 (was 2.2 = 26.9%); sky kept above
  strait:       [585, 330, 2.00],   // vi-12: rock 2's window (splash 455,540)
  'defy-strait': [640, 300, 2.25],  // vi-06 split off `strait` (which is
                                    // pinned by rock 2's splash): pleaders,
                                    // stern and the 22.4% giant in one frame
                                    // BOTH orientations — O.12's mechanism
  'hades-twoshot': [663, 315, 2.30],// vi-10: the contract's own two-shot —
                                    // stern foreground, the struck giant
                                    // (22.9%, the T floor) dark behind
  homeward:     [450, 570, 1.90],
  moonpath:     [590, 340, 3.20],
};

/* ---- THE ROW STRIP: the shipped registry, READ, not transcribed -------- *
 * strips.js is generated verbatim from tools/ody/strips.json (build-gated
 * cells; the lap asserts the registry sha over the shipped bytes AND the
 * shipped module against the registry), so n / cell / srcH / anchors are the
 * registry's own — crew-row is the KEPT 4-cell loop while the walks went to
 * 10, and this driver must not care either way. The oar stroke —
 * catch/drive/finish/recovery — rides setkit placeStrip; anchors are the
 * MAN's feet, not the sweeping blade (the stake-pin lesson transposed:
 * anchor the fact that must hold still). TIME-DRIVEN, not distance (the
 * ship is the world's origin — the rowers never travel): the stroke phase
 * advances ∝ rowEffort over the existing 1.9 s period, so at effort 0 the
 * loop stands and under reduced motion the STORY strokes still row (effort
 * was never amb-gated; the ambient bench bob still dies with amb).
 * Per-bench phase keeps the six from lockstep (the existing i x 0.9 rad
 * stagger, in cycles). */
const STRIP_ROW = { ...STRIPS['crew-row-retry'],
                    period: 1.9, phase: 0.9 / (2 * Math.PI) };
/* crew-row-retry SUPERSEDES the n=4 crew-row (registry `supersedes`): the
 * rower re-matted centred so the whole oar sweep lives in frame — same
 * driver, the registry's own n/anchors (the MAN's feet, never the blade).
 * hPx 14 re-derives the old strip's ~16.3 px drawn man through the retry
 * cells' own srcH (398 vs 362.8) and taller matting. */
const ROWER_STRIP_H = 14;

/* THE GIANT'S TWO MOTIONS (ody-video2, registry-read):
 *   hurl-windup   kind:'bridge', stand -> hurl, PLAY-ONCE per rock clock
 *                 (playCount 2): frame = bridgeFrame(strip, k) with k the
 *                 clock's own tear->loose progress — the windup plays forward
 *                 once and parks on its gated landing frame; the static hurl
 *                 cut (pose B) takes the frame from there, within one frame
 *                 by the build's endpoint gate.
 *   curse-sway    kind:'loop', verb-clock (loopFrame): the arms-to-firmament
 *                 prayer sway holds the document frame live until the tear.
 * hPx is end-pose continuity measured off the cells' alpha (2026-08-16):
 * the landing hurl figure at the engine's 105 px arms-up height (ws
 * 105/568 through srcH 635 -> 117); the curse figure likewise (573 -> 109). */
const STRIP_HURL = { ...STRIPS['hurl-windup'], hPx: 117 };
const STRIP_CURSE = { ...STRIPS['curse-sway'], hPx: 109, period: 2.6 };

/* the G6 anchor: the VISIBLE giant's body centre, the ledger's (860,168) —
 * mark y 210 minus half the 89 px body, kept as the ledger wrote it */
const TARGETS = { cyclops: { at: [860, 168], r: 52 } };

/* No relight plate ships for the sea and no inset ever rises on this leaf
 * (static insets = {}), so the matrix is never exercised — but the surface
 * requires one, and this one is DERIVED, not guessed: the void model's own
 * per-channel constants (layers-sea.json analysis.void: 54.93 / 68.18 / 95.36)
 * normalised to blue. A dim over this plate keeps the navy night's balance. */
const DIM_MATRIX = [0.576, 0.715, 1.0];

const bump = (k) => Math.sin(Math.PI * clamp01(k));

/* ---- EXPLORER C: CONTACT SHADOWS (the chase.js rig-shadow law) ---------- *
 * app/shadows.js is the registry (shadowgen.py, verbatim): the anchor lands
 * on the actor's foot mark, scaled by the actor's own k = drawnH / cutH,
 * opacity (0.42 + 0.30 * s) * actorOp — s the mark's depth share of this
 * diorama's floor (the clifftop brow 210 to the near rower bench 466). The
 * shadow nodes live INSIDE the world group, so the recede scales them with
 * the deck they sit on. (The sea GUNWALE occluder was measured and REFUSED:
 * every rower baseline sits 18-22 px upstage of it, overlap 0 px.) */
const SHADOW = SHADOWS.sea.shadows;
const SHADOW_BAND = [210, 466];
const shadowS = (y) =>
  clamp01((y - SHADOW_BAND[0]) / (SHADOW_BAND[1] - SHADOW_BAND[0]));
/* the shadowed cuts' own source heights (tools/ody/actors.json verbatim) */
const SHADOW_CUT_H = { 'polyphemus-stand': 1244, 'polyphemus-hurl': 1286,
                       'polyphemus-curse': 1287, 'ulysses-stand': 682,
                       'ulysses-taunt': 680, 'crew-row': 954 };

export class SeaSet {
  static id = 'sea';
  static insets = {};                 // Beat VI raises none — the inset was Beat I's
  /** ...but ONE hero clip does (heroclip law, main.js): rock 1's splash, the
   *  living close-up seeded from this very tableau (jeer+11.3, the plume). */
  static clips = {
    'clip-splash': HEROCLIP_FILES['clip-splash'],
  };
  /** [shot] SHOTGEN lane (2026-08-17) — native full-frame closes, anchors in
   *  SHOT space pinned on each shipped plate's own pixels:
   *  shot-taunt — vi-02's dialogue close (the taunt at the stern).
   *  shot-myname — vi-07's release close (the name on the rail): the hold
   *  ring stands on the man drawing breath. */
  static shots = {
    'shot-taunt': {
      ...SHOT_FILES['shot-taunt'],
      heads: { ULYSSES: [672, 330] },
    },
    'shot-myname': {
      ...SHOT_FILES['shot-myname'],
      holds: { breath: [672, 300] },
      heads: { ULYSSES: [672, 240] },
    },
  };
  static beds = ['sea'];

  constructor(root, st) {
    this.st = st;
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);
    /* actor cuts load their BUILD-GRADED variant (regrade law, setkit) and
       fall back to the raw cut; strips stay raw — the grade is per-cut */
    const cut = (f, c, p) => gradedActor(st, 'sea', f, c, p || root);

    /* ---- THE WORLD GROUP: everything the recede moves ---------------- *
     * One div, transform-origin at the painted deck centre. The master, the
     * fog, the measured lights, the actors and the blooms all ride it; the
     * curse veil and the dawn glow stand OUTSIDE it, because the sky is the
     * page's, not the diorama's. */
    this.world = el('div', 'lyr world', root);
    box(this.world, 0, 0, PLATE.w, PLATE.h);
    this.world.style.transformOrigin =
      `${SHIP.deckCentre[0]}px ${SHIP.deckCentre[1]}px`;

    /* ---- the one master (layers-sea.json drawOrder) ------------------- */
    this.base = img('set/sea/sea.jpg', 'lyr plate', this.world);
    box(this.base, 0, 0, PLATE.w, PLATE.h);

    /* the sea breath — screen-blended, drifting, feathered by its own alpha */
    this.fog = img('set/sea/sea-fog.png', 'lyr', this.world);
    box(this.fog, ...LAYER.fog.box);
    this.fog.style.mixBlendMode = 'screen';

    /* the measured lights breathe (moon + one fire: cave and crag share a clock) */
    this.emis = emissives(EMIS, this.world);

    /* ---- THE CONTACT SHADOWS, before the actors, INSIDE the world ----- *
     * (Explorer C, the chase.js law: a body over its own shadow; riding the
     * world group, the recede scales a shadow with the deck it sits on.) */
    this.shadowG = el('div', 'actors shadows', this.world);
    const shN = (name) => {
      const e = img('actor/shadow/sea/' + SHADOW[name].file, 'lyr', this.shadowG);
      e.style.opacity = '0';
      return e;
    };
    this.giantShN = { stand: shN('polyphemus-stand'), hurl: shN('polyphemus-hurl'),
                      curse: shN('polyphemus-curse') };
    this.uShN = { stand: shN('ulysses-stand'), taunt: shN('ulysses-taunt') };
    this.rowerShN = ROWER_MARKS.map(() => shN('crew-row'));
    this._shadows = [];

    /* ---- THE ACTORS (isolated; painter order is ascending mark y) ----- */
    this.actors = el('div', 'actors', this.world);

    // the blinded giant on the brow: three poses stacked, crossfaded like a
    // plate state — the mark never moves, only the picture over it
    this.giant = {
      stand: cut('actor/polyphemus-stand.png', 'lyr', this.actors),
      hurl:  cut('actor/polyphemus-hurl.png',  'lyr', this.actors),
      curse: cut('actor/polyphemus-curse.png', 'lyr', this.actors),
    };
    this.pinAt(this.giant.stand, ART.giantStand, MARKS['clifftop-giant'], GIANT_H);
    this.pinAt(this.giant.hurl,  ART.giantHurl,  MARKS['clifftop-giant'], GIANT_ARMS_H);
    this.pinAt(this.giant.curse, ART.giantCurse, MARKS['clifftop-giant'], GIANT_ARMS_H);
    for (const e of [this.giant.hurl, this.giant.curse]) e.style.opacity = '0';
    /* the windup bridge + the curse sway (ody-video2): strip nodes on the
       same mark, decoded at boot via st.bitmap (the room.js walk law) */
    this.gHurlN = el('div', 'lyr walk', this.actors);
    this.gHurlN.style.backgroundImage = st.bitmap(STRIP_HURL.file);
    this.gHurlN.style.opacity = '0';
    this.gCurseN = el('div', 'lyr walk', this.actors);
    this.gCurseN.style.backgroundImage = st.bitmap(STRIP_CURSE.file);
    this.gCurseN.style.opacity = '0';

    // ulysses at the stern: stand and taunt stacked on one moving mark. The
    // taunt cut is FLIPPED — mirrored about its own pin — so the flung arm
    // points at the cliff (the stage proof's own mount).
    this.uly = {
      stand: cut('actor/ulysses-stand.png', 'lyr', this.actors),
      taunt: cut('actor/ulysses-taunt.png', 'lyr', this.actors),
    };
    this.pinAt(this.uly.stand, ART.ulyStand, MARKS['stern-ulysses'], ULY_H);
    this.pinAt(this.uly.taunt, ART.ulyTaunt, MARKS['stern-ulysses'], ULY_H, true);
    this.uly.taunt.style.opacity = '0';

    /* the six survivors at the oars — ONE STRIP, DOUBLED across the two
       files (three marks near, three far), 15 px seated at the ledger's
       rower marks. Decoded at boot via st.bitmap (the room.js walk law);
       the static crew-row cut is retired — the strip's frame 0 is the rest. */
    this.rowers = ROWER_MARKS.map((m) => {
      const e = el('div', 'lyr walk', this.actors);
      e.style.backgroundImage = st.bitmap(STRIP_ROW.file);
      placeStrip(e, STRIP_ROW, MARKS[m], ROWER_STRIP_H, 0);
      return { mark: m, el: e };
    });

    // the two rocks are ONE prop (their windows never overlap), and so is the
    // splash; both born at fire time zero-opacity and driven by the clocks
    this.rock = cut('actor/prop-rock.png', 'lyr', this.actors);
    this.rock.style.opacity = '0';
    this.splash = cut('actor/prop-splash.png', 'lyr', this.actors);
    this.splash.style.opacity = '0';

    /* ---- the blooms go OVER the actors (drawOrder law), screen-blended,
     * OUTSIDE the isolated group or they composite to black rectangles ---- */
    this.bloomCave = img('set/sea/sea-bloom-cave.png', 'lyr', this.world);
    box(this.bloomCave, ...LAYER.bloomCave.box);
    this.bloomCave.style.mixBlendMode = 'screen';
    this.bloomMoon = img('set/sea/sea-bloom-moon.png', 'lyr', this.world);
    box(this.bloomMoon, ...LAYER.bloomMoon.box);
    this.bloomMoon.style.mixBlendMode = 'screen';

    /* ---- [atmo] R5 (SYNTHESIS): the ATMOSPHERE SANDWICH — the master's
       own extracted haze/bloom band (bake_atmo.py; gain baked in), OVER
       the actors, screen-blended, INSIDE the world so the recede scales
       the air with the deck it hangs over. */
    this.atmo = img('set/sea/atmo/master.png', 'lyr atmo', this.world);
    box(this.atmo, 0, 0, PLATE.w, PLATE.h);
    this.atmo.style.mixBlendMode = 'screen';

    /* ---- THE RETURN TABLEAU (§3.4): the island beach, OUTSIDE the world -- *
     * One group, one rise: the band and every body ashore ride beachG's
     * opacity (c6 "the island beach layer rises"), and each body carries its
     * own k on top for its own beat of the staging (comrades await, flock
     * streams, the ram is led to the altar, the men board at dawn). */
    this.beachG = el('div', 'lyr beach', root);
    box(this.beachG, 0, 0, PLATE.w, PLATE.h);
    this.beachG.style.opacity = '0';
    this.beachBand = img(BEACH.file, 'lyr', this.beachG);
    box(this.beachBand, ...BEACH.box);
    this.beach = {};
    for (const [id, art, at, h, flip] of B_CAST) {
      const n = cut(B_FILES[art], 'lyr', this.beachG);
      this.pinAt(n, ART[art], at, h, flip);
      n.style.opacity = '0';
      this.beach[id] = { el: n, id, at, h };
    }
    /* the thigh-fire: authored flame glow + the STRAIGHT smoke column (the
       contract's own image — "smoke rising straight, and NO sign") — the
       dawn-glow precedent: light the plate does not carry is authored */
    this.altarGlow = el('div', 'emis', this.beachG);
    box(this.altarGlow, B_FIRE_AT[0] - 46, B_FIRE_AT[1] - 40, 92, 76);
    this.altarGlow.style.background =
      'radial-gradient(ellipse at 50% 58%,rgba(255,192,98,.85) 0%,' +
      'rgba(255,150,60,.35) 38%,rgba(255,120,40,0) 72%)';
    this.altarGlow.style.opacity = '0';
    this.altarSmoke = el('div', 'lyr', this.beachG);
    box(this.altarSmoke, B_FIRE_AT[0] - 5, B_FIRE_AT[1] - 96, 10, 92);
    this.altarSmoke.style.background =
      'linear-gradient(to top,rgba(212,216,226,.44) 0%,' +
      'rgba(212,216,226,.22) 55%,rgba(212,216,226,0) 100%)';
    this.altarSmoke.style.opacity = '0';

    /* ---- the sky, which is the page's --------------------------------- *
     * The curse veil: "sky darkened a stop" for the document-weight frame.
     * The dawn glow: the missing dawn master's stated stand-in — one warm
     * authored light on the horizon while the night lights go out. */
    this.veil = el('div', 'lyr', root);
    box(this.veil, 0, 0, PLATE.w, PLATE.h);
    this.veil.style.background = 'rgba(4,6,14,1)';
    this.veil.style.opacity = '0';
    this.dawnGlow = el('div', 'emis', root);
    box(this.dawnGlow, 940, 100, 468, 520);
    this.dawnGlow.style.background =
      'radial-gradient(ellipse at 62% 45%,rgba(255,196,128,.34) 0%,' +
      'rgba(255,170,96,.14) 42%,rgba(255,150,80,0) 74%)';
    this.dawnGlow.style.opacity = '0';

    this.reset();
  }

  /** A cut hung off its actors.json PIN: left/top so the pin lands on the
   *  mark, transform-origin ON the pin so flip and sway cannot move the feet. */
  pinAt(node, a, at, h, flip = false) {
    const k = h / a.px[1];
    box(node, at[0] - a.pin[0] * k, at[1] - a.pin[1] * k, a.px[0] * k, a.px[1] * k);
    node.style.transformOrigin =
      `${(a.pin[0] * k).toFixed(2)}px ${(a.pin[1] * k).toFixed(2)}px`;
    if (flip) node.style.transform = 'scaleX(-1)';
    return k;
  }

  /** The world as ody-vi-01 finds it: ship at voice's reach, oars shipped,
   *  the giant standing dark on the brow, no clock running. */
  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      jeer0: -1e9, curse0: -1e9, dawn0: -1e9,       // the three timestamps
      seg: null, segT0: -1e9, segDur: 8.0,          // return-beach, once run
      resolutions: 0, myname: false,                // G6 x2; the hubris armed
      uly: { at: 'stern-ulysses', from: 'stern-ulysses',
             to: 'stern-ulysses', t0: -1e9, dur: 0.7, pose: 'stand' },
      giantPose: 'stand',
      k: { hurl: 0, curse: 0, taunt: 0, veil: 0, dawn: 0 },   // the crossfades
      rowPhase: 0,               // the stroke clock, in cycles — advances ∝ effort
      holdK: 0,                  // the RELEASE verb's drawn breath (myname)
    };
    this._wk = 1; this._wdx = 0; this._wdy = 0; this._wrot = 0;   // world at rest
    this._beach = null;                             // §3.4 tableau pose, per step
    this.rowerFrames = [0, 0, 0, 0, 0, 0];
    this.giantBridge = null;                        // the windup, mid-play
    this.curseLoop = null;                          // the sway, live
    this._bGate = null;                             // the bridge rate gate's memory
  }

  /* ---- the two clocks -------------------------------------------------- */
  jeerT()  { const d = this.state.t - this.state.jeer0;  return this.state.jeer0  > -1e8 && d >= 0 ? d : null; }
  curseT() { const d = this.state.t - this.state.curse0; return this.state.curse0 > -1e8 && d >= 0 ? d : null; }
  dawnT()  { const d = this.state.t - this.state.dawn0;  return this.state.dawn0  > -1e8 && d >= 0 ? d : null; }

  /** The beat-local clock `verb:'clock'` units are timed against. The curse
   *  RE-ZEROES it — ody-vi-12's `at: 1.2` is 1.2 s past the curse, not past
   *  the jeer — and until the jeer there is no clock at all. */
  ruseT() {
    const c = this.curseT();
    if (c !== null) return c;
    return this.jeerT();
  }

  /** Has the named thing happened ON STAGE yet (`wait:` units hold on this). */
  waitDone(name) {
    if (name === 'rock1') { const j = this.jeerT();  return j !== null && j >= ROCK1.done; }
    if (name === 'rock2') { const c = this.curseT(); return c !== null && c >= ROCK2.done; }
    return true;
  }

  /* ---- the world transform, and the map through it --------------------- *
   * Everything below is a pure function of the three timestamps and t, so a
   * replayed lap lands on the same pixels. Scale about the deck centre is the
   * ONLY transform under which two things painted into one plate can change
   * distance: nearer is bigger, and the ship — the origin — holds station. */
  worldPose(t, amb) {
    const j = this.jeerT(), c = this.curseT(), d = this.dawnT();
    /* the hull pitch: two damped swings about the deck on each impact */
    const pitch = (clock, R, A) => {
      if (clock === null) return 0;
      const u = clock - R.land;
      if (u <= 0 || u >= PITCH_S) return 0;
      return A * Math.sin(2 * Math.PI * u / 1.1) *
             (1 - easeInOut(clamp01(u / PITCH_S)));
    };
    let k = 1, dx = 0, rot = 0;
    if (j !== null) {
      const back = easeOut(clamp01((j - ROCK1.land) / 1.1));
      const out = easeInOut(clamp01(
        (j - ROCK1.oars[0]) / (ROCK1.oars[1] - ROCK1.oars[0])));
      k += WORLD.back * back - WORLD.out * out;   // 1 -> 1.07 -> 0.86
      dx += 30 * bump((j - ROCK1.land) / 3.4);    // the shove shoreward
      rot += pitch(j, ROCK1, PITCH.rock1);        // the hull answers rock 1
    }
    if (c !== null) {
      const on = easeInOut(clamp01(
        (c - ROCK2.wash[0]) / (ROCK2.wash[1] - ROCK2.wash[0])));
      k -= WORLD.onward * on;                     // -> 0.76, driven onward
      dx -= 24 * bump((c - ROCK2.land) / 3.0);    // the shove seaward
      rot += pitch(c, ROCK2, PITCH.rock2);        // rock 2: nearer, opposite
    }
    if (this.state.segT0 > -1e8) {                // the return home, kept for good
      k -= WORLD.seg * easeInOut(clamp01((t - this.state.segT0) / this.state.segDur));
    }
    if (d !== null) {                             // sailedon: the glide out
      const g = easeInOut(clamp01(d / DAWN_GLIDE));
      k -= WORLD.dawn * g;
      dx -= 46 * g;
    }
    // the swell: ambient only — a reader who asked for less motion keeps the
    // story's washes and loses the bob
    const dy = amb * 1.5 * Math.sin(2 * Math.PI * t / 6.1);
    dx += amb * 1.0 * Math.sin(2 * Math.PI * t / 9.7);
    return { k, dx, dy, rot };
  }

  /** ledger plate px -> where the world transform has put them (rotation
   *  included exactly, so the gate ring rides the hull pitch too) */
  worldMap(p) {
    const o = SHIP.deckCentre;
    const th = (this._wrot || 0) * Math.PI / 180;
    const cs = Math.cos(th), sn = Math.sin(th);
    const x = (p[0] - o[0]) * this._wk, y = (p[1] - o[1]) * this._wk;
    return [o[0] + x * cs - y * sn + this._wdx,
            o[1] + x * sn + y * cs + this._wdy];
  }

  /* ---- the camera ------------------------------------------------------ */
  focusPlate(name) {
    const f = FOCUS[name] || FOCUS.establishing;
    if (f[2] === 1.0) return f;         // the wide is the plate's own frame
    const m = this.worldMap([f[0], f[1]]);
    return [m[0], m[1], f[2]];
  }

  /* The camera stays the units': both rock flights play on the establishing
   * wide the clock units themselves ask for, so no override is needed. */
  camOverride() { return null; }

  /* ---- what the reader can point at ------------------------------------ */
  targetPlate(name) {
    const T = TARGETS[name];
    return T ? this.worldMap(T.at) : null;    // the anchor RIDES the actor's mark
  }

  /** The giant never leaves the brow on this leaf, so the gate's thing is on
   *  frame from establish to the card — both resolutions find him lit. */
  targetLive(name) { return name === 'cyclops'; }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const at = this.targetPlate(name);
    const r = Math.max(34, TARGETS[name].r * this._wk);  // the body shrinks with
    return Math.hypot(p.x - at[0], p.y - at[1]) <= r;    // the world; the ring too
  }

  headPlate(who) {
    if (who === 'ULYSSES') {
      const u = this.ulyAt();
      return this.worldMap([u[0], u[1] - ULY_H * 0.92]);
    }
    if (who === 'POLYPHEMUS') {
      const m = MARKS['clifftop-giant'];
      return this.worldMap([m[0], m[1] - GIANT_H * 0.90]);
    }
    if (who === 'THE MEN') {
      const m = MARKS['rower-2n'];                 // the near file's middle bench
      return this.worldMap([m[0], m[1] - ROWER_H * 0.85]);
    }
    return null;
  }

  /** The RELEASE verb's ring (ody-vi-07): it stands on the man drawing the
   *  breath — Ulysses' chest at the stern rail, through the world transform. */
  holdAnchor() {
    const u = this.ulyAt();
    return this.worldMap([u[0], u[1] - ULY_H * 0.55]);
  }

  /** The engine's continuous hold — on this leaf it is the DRAWN BREATH of
   *  the release verb (AMENDMENT 2026-08-16, myname): the taunt cut swells
   *  subtly on the held k (stepUlysses) and snaps back on the shout. */
  setHold(k) { this.state.holdK = clamp01(k); }

  /* ---- the verbs the units fire ----------------------------------------- *
   * `settled` = a replayed jump: leave the world at the act's END — clocks
   * dated past their own sequences so every wait answers and every wash has
   * already washed. */
  fire(act, settled = false) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
        /* the arrival state, stated as an act: no clock, no rock flown, the
           name not yet given. reset() and a fresh mount both land here. */
        S.jeer0 = -1e9; S.curse0 = -1e9; S.dawn0 = -1e9;
        S.seg = null; S.segT0 = -1e9;
        S.resolutions = 0; S.myname = false;
        S.holdK = 0;
        S.uly = { at: 'stern-ulysses', from: 'stern-ulysses',
                  to: 'stern-ulysses', t0: -1e9, dur: 0.7, pose: 'stand' };
        break;
      /* G6, FIRST RESOLUTION — the jeer starts rock1's clock. Settled, the
         whole ~12 s has already run: the splash risen, the wash washed, the
         oars bitten, the strait doubled. */
      /* settled clocks are dated HALF A SECOND past their own done mark, not
         onto it: `t - done` exactly is a float equality and waitDone lost it
         by 3e-15 in the smoke test — the world lands at rest, provably past. */
      case 'jeer':
        S.jeer0 = settled ? t - ROCK1.done - 0.5 : t;
        S.resolutions = Math.max(S.resolutions, 1);
        S.uly.pose = 'taunt';
        if (!settled) {
          this.st.cue('splash', ROCK1.land);      // scheduled on the clock's own
          this.st.cue('oars', ROCK1.oars[0]);     // numbers, at fire time
        }
        break;
      /* G6, SECOND RESOLUTION — the click OVER the men's still-lit plea.
         This one arms the name (O.12); the world consequence rides `curse`. */
      case 'defy':
        S.resolutions = 2; S.myname = true;
        S.uly.pose = 'taunt';
        break;
      case 'stern-ulysses':                        // the whip, and the flat answer
        this.ulyTo('stern-ulysses', settled);
        S.uly.pose = 'taunt';
        break;
      /* he steps ONTO the rail — O.12. A SNAP, not a walk: the hubris is one
         planted step, and the unit is an `auto` whose first visible frame
         must already have his pinned foot (actors.json ulysses-taunt, pin
         43,674) ON the ledger's mark — the eased walk left it measured at
         (516.7,423.8), 21 px off (506,406), a [feet] violation. */
      case 'stern-rail':
        this.ulyTo('stern-rail', true);
        S.uly.pose = 'taunt';
        break;
      /* THE SHOUT (AMENDMENT 2026-08-16 — the release verb's resolution,
         ody-vi-07): the drawn breath lets go. The pose SNAPS — the taunt
         crossfade jumps to full instead of damping there — and the swell the
         held k was carrying collapses with the k itself (main.js zeroes the
         hold on resolve; a settled replay lands the same way). */
      case 'shout':
        S.uly.pose = 'taunt';
        S.k.taunt = 1;
        S.holdK = 0;
        break;
      /* THE CURSE re-zeroes the beat clock and holds the document frame: arms
         to the firmament, sky down a stop, bed to near-silence. Rock 2 rides
         this clock — tear at 3.0, astern at 6.8, driven onward by 12.2. */
      case 'curse':
        S.curse0 = settled ? t - ROCK2.done - 0.5 : t;
        S.uly.pose = 'stand';                      // all eyes go up
        if (!settled) {
          this.st.cue('splash', ROCK2.land);
          this.st.cue('oars', ROCK2.wash[0]);
        }
        break;
      /* the dawn that has no master: night lights out, fog thinned, one warm
         horizon glow, and the glide out under sailedon's own dwell */
      case 'sea-dawn':
        S.dawn0 = settled ? t - DAWN_GLIDE : t;
        S.uly.pose = 'stand';
        break;
      /* the engine's enterEndLeaf still fires the sherlock name at whatever
         set is up (WIRING TODO). The card is already over the stage; nothing
         here needs to leave. */
      case 'kingOffstage': break;
      default: break;
    }
  }

  /** send ulysses between his two stern marks; settled = already there */
  ulyTo(mark, settled) {
    const U = this.state.uly;
    if (U.at === mark && !this.ulyWalking()) return;
    if (settled || this.st.reduced) {
      U.at = mark; U.from = mark; U.to = mark; U.t0 = -1e9;
      return;
    }
    U.from = U.at; U.to = mark; U.t0 = this.state.t; U.at = mark;
  }

  ulyWalking() {
    const U = this.state.uly;
    return U.t0 > -1e8 && this.state.t - U.t0 < U.dur;
  }

  /** his feet right now, in LEDGER plate px (worldMap is the caller's job) */
  ulyAt() {
    const U = this.state.uly;
    const a = MARKS[U.from], b = MARKS[U.to];
    const k = U.t0 > -1e8 ? easeInOut(clamp01((this.state.t - U.t0) / U.dur)) : 1;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  }

  /** the one segment this set performs: the row home to the island beach.
   *  Its timestamp is KEPT after it ends — the distance it bought stays. */
  startSeg(name, dur, t0) {
    if (name !== 'return-beach') return;
    this.state.seg = name;
    this.state.segT0 = t0;
    this.state.segDur = dur || 8.0;
  }

  /* ---- one fixed step --------------------------------------------------- */
  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    const j = this.jeerT(), c = this.curseT(), d = this.dawnT();
    const dawnK = d !== null ? easeInOut(clamp01(d / DAWN_GLIDE)) : 0;

    /* ---- the world moves ------------------------------------------------ */
    const W = this.worldPose(t, amb);
    this._wk = W.k; this._wdx = W.dx; this._wdy = W.dy; this._wrot = W.rot;
    this.world.style.transform =
      `translate(${W.dx.toFixed(2)}px,${W.dy.toFixed(2)}px) ` +
      `rotate(${W.rot.toFixed(3)}deg) scale(${W.k.toFixed(4)})`;

    /* ---- the light breathes, then the states take their share ----------- */
    breathe(this.emis, EMIS, t, amb);
    const nightK = 1 - dawnK;
    /* c8's dusk time-dip rides the veil the curse already owns: a stop of
       darkness between the tableau settling and the dawn (a fast reader
       barely meets it; the slow reader gets the livelong day's end) */
    const B = this.beachPose(t);
    this._beach = B;
    const veilWant = Math.max(this.curseVeilWant(c), B.duskK);
    S.k.veil = this.st.damp(S.k.veil, veilWant, 4.0, dt);
    S.k.dawn = dawnK;
    // one fire feeds cave and crag; the moon takes the veil; dawn takes it all
    this.emis.cave.style.opacity =
      (+this.emis.cave.style.opacity * nightK * this.fireLeftK(t)).toFixed(3);
    this.emis.crag.style.opacity =
      (+this.emis.crag.style.opacity * nightK * this.fireLeftK(t)).toFixed(3);
    this.emis.moon.style.opacity =
      (+this.emis.moon.style.opacity * nightK * (1 - 0.45 * S.k.veil)).toFixed(3);
    this.emis.moonpath.style.opacity =
      (+this.emis.moonpath.style.opacity * nightK * (1 - 0.45 * S.k.veil)).toFixed(3);

    /* the layers ride their measured ranges (layers-sea.json opacity) */
    const breath = (per) => 0.5 + 0.5 * Math.sin(2 * Math.PI * t / per) * amb;
    const F = LAYER.fog;
    this.fog.style.opacity =
      ((F.op[0] + (F.op[1] - F.op[0]) * breath(F.per)) * (1 - 0.5 * dawnK)).toFixed(3);
    this.fog.style.transform =
      `translateX(${(amb * F.drift * Math.sin(2 * Math.PI * t / F.per)).toFixed(1)}px)`;
    const BC = LAYER.bloomCave;
    this.bloomCave.style.opacity =
      ((BC.op[0] + (BC.op[1] - BC.op[0]) * breath(BC.per)) * nightK *
       this.fireLeftK(t)).toFixed(3);
    const BM = LAYER.bloomMoon;
    this.bloomMoon.style.opacity =
      ((BM.op[0] + (BM.op[1] - BM.op[0]) * breath(BM.per)) * nightK *
       (1 - 0.5 * S.k.veil)).toFixed(3);
    /* [atmo] R5: the master's band rides the night master's own weight —
       static (no breath): the air is the painting's, not a flicker's */
    this.atmo.style.opacity = (nightK * (1 - 0.5 * S.k.veil)).toFixed(3);

    /* the sky: the curse's stop of darkness, the dawn's stand-in glow */
    this.veil.style.opacity = (0.20 * S.k.veil).toFixed(3);
    this.dawnGlow.style.opacity = dawnK.toFixed(3);

    /* the bed leans with the oars and hushes under the curse (street idiom) */
    this.st.gain('sea', 0.8 + 0.5 * this.rowEffort(t) - 0.6 * S.k.veil);

    this.stepGiant(t, dt, c, j);
    this.stepUlysses(t, dt, amb);
    this.stepRowers(t, dt, amb);
    this.stepRocks(t);
    this.stepBeach(t, amb, B);
    this.paintShadows();
  }

  /* ---- THE RETURN TABLEAU: every k a pure function of segT0 / dawn0 ----- */
  beachPose(t) {
    const S = this.state;
    const seg = S.segT0 > -1e8 ? clamp01((t - S.segT0) / S.segDur) : 0;
    const d = this.dawnT();
    const dawnK = d !== null ? easeInOut(clamp01(d / DAWN_GLIDE)) : 0;
    const rise = easeInOut(clamp01(seg / 0.4));            // c6: the layer rises
    const boardK = d !== null ? easeInOut(clamp01(d / 2.5)) : 0;   // c9: aboard
    const crewK = easeInOut(clamp01((seg - 0.18) / 0.32)) * (1 - boardK);
    const flockK = easeInOut(clamp01((seg - 0.45) / 0.35));  // c7: flock ashore
    const altarK = easeInOut(clamp01((seg - 0.5) / 0.32));   // the driftwood pyre
    const ramK = easeInOut(clamp01((seg - 0.62) / 0.33));    // the great ram led up
    const ulyK = easeInOut(clamp01((seg - 0.58) / 0.3)) * (1 - boardK);
    const fireK = ramK * (d === null ? 1                          // embers at dawn,
      : (1 - 0.8 * easeInOut(clamp01(d / 2.0))));                 // on the fire's own
                                                                  // short clock
    const smokeK = ramK * (d === null ? 1 : Math.max(0, 1 - d / 1.6));
    /* c8's dusk rides the SEG'S TAIL (the engine's own shape: u13 is a click
       unit whose 8 s dwell is also its soft-fail, so there is no "between
       u13 and u14" to spend — the rock2-punctuation precedent): the light
       starts falling 1.5 s before the seg ends and the dawn releases it. */
    const duskK = S.segT0 > -1e8 && d === null
      ? easeInOut(clamp01((t - S.segT0 - (S.segDur - 1.5)) / 2.5)) : 0;
    return { seg, rise, crewK, flockK, altarK, ramK, ulyK, boardK,
             fireK, smokeK, duskK, dawnK };
  }

  stepBeach(t, amb, B) {
    this.beachG.style.opacity = B.rise.toFixed(3);
    const opOf = (id) =>
      id === 'altar' ? B.altarK
      : id === 'ram-return' ? B.ramK
      : id === 'uly-ashore' ? B.ulyK
      : id.startsWith('flock') ? B.flockK
      : B.crewK;
    for (const [id] of B_CAST) {
      this.beach[id].el.style.opacity = opOf(id).toFixed(3);
    }
    // the thigh-fire breathes on the cave fire's own clock (amb-gated flicker)
    const flick = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 3.2) * amb);
    this.altarGlow.style.opacity = (B.fireK * flick).toFixed(3);
    this.altarSmoke.style.opacity = (B.smokeK * 0.9).toFixed(3);
  }

  /** THE SHADOW PASS (Explorer C — chase.js paintRigs, ported): anchor on
   *  the foot mark, scale by the actor's k = drawnH / cutH, opacity
   *  (0.42 + 0.30 * s) * the picture's own opacity — the giant's three
   *  shadows crossfade exactly as his three cuts do. */
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
                           box: [+node.style.left.slice(0, -2), +node.style.top.slice(0, -2),
                                 +node.style.width.slice(0, -2), +node.style.height.slice(0, -2)] });
    }
  }

  paintShadows() {
    const S = this.state;
    this._shadows = [];
    const M = MARKS['clifftop-giant'];
    const stripLive = !!(this.giantBridge || this.curseLoop);
    const gOps = {
      stand: stripLive ? 0 : clamp01(1 - S.k.hurl - S.k.curse),
      hurl: this.giantBridge ? 1 : (stripLive ? 0 : S.k.hurl),
      curse: this.curseLoop ? 1 : (stripLive ? 0 : S.k.curse),
    };
    const gH = { stand: GIANT_H, hurl: GIANT_ARMS_H, curse: GIANT_ARMS_H };
    for (const [pose, node] of Object.entries(this.giantShN)) {
      if (!(gOps[pose] > 0.005)) { node.style.opacity = '0'; continue; }
      this.shadowPut(node, 'polyphemus-' + pose, M, gH[pose], gOps[pose], 'giant');
    }
    const at = this.ulyAt();
    const uAsh = 1 - (this._beach ? this._beach.ulyK : 0);   // ashore = no stern shadow
    const uOps = { stand: (1 - S.k.taunt) * uAsh, taunt: S.k.taunt * uAsh };
    for (const [pose, node] of Object.entries(this.uShN)) {
      if (!(uOps[pose] > 0.005)) { node.style.opacity = '0'; continue; }
      this.shadowPut(node, 'ulysses-' + pose, at, ULY_H, uOps[pose], 'ulysses');
    }
    for (const [i, node] of this.rowerShN.entries()) {
      this.shadowPut(node, 'crew-row', MARKS[ROWER_MARKS[i]], ROWER_H, 1,
                     ROWER_MARKS[i]);
    }
  }

  /** how hard the six are pulling: story motion, not ambience */
  rowEffort(t) {
    const j = this.jeerT(), c = this.curseT(), d = this.dawnT();
    let e = 0;
    if (j !== null) e = Math.max(e, easeInOut(clamp01((j - ROCK1.oars[0]) / 1.2)) *
                                    (1 - easeInOut(clamp01((j - ROCK1.done) / 3.0))));
    if (c !== null) e = Math.max(e, easeInOut(clamp01((c - ROCK2.wash[0]) / 1.2)) *
                                    (1 - easeInOut(clamp01((c - ROCK2.done) / 3.0))));
    if (this.state.segT0 > -1e8) {
      e = Math.max(e, bump((t - this.state.segT0) / this.state.segDur));
    }
    if (d !== null) e = Math.max(e, easeInOut(clamp01(d / 2.0)));
    return e;
  }

  /** the cave fire falls astern once the return seg rows them home */
  fireLeftK(t) {
    if (this.state.segT0 < -1e8) return 1;
    return 1 - 0.6 * easeInOut(clamp01((t - this.state.segT0) / this.state.segDur));
  }

  /** the sky is down a stop from the curse until rock 2 is in the air */
  curseVeilWant(c) {
    if (c === null) return 0;
    if (c < ROCK2.wash[0]) return 1;
    return clamp01(1 - (c - ROCK2.wash[0]) / 2.0);
  }

  /* ---- the giant: pose is a pure function of the two clocks ------------- *
   * THE THROW TICK ENDS THE HURL (release follow-through): the pose held
   * to land+0.8 was the review's frozen statue — the rock detached from a
   * fixed hurl and flew alone. The hurl now spends itself AT `loose`; the
   * ~300 ms crossfade back to stand + the rotation lag (stepGiant) are the
   * follow-through the release owes. */
  giantPoseAt(c, j) {
    if (c !== null) {
      if (c >= ROCK2.tear && c < ROCK2.loose) return 'hurl';
      if (c < ROCK2.tear) return 'curse';          // arms to the firmament
      return 'stand';
    }
    if (j !== null && j >= ROCK1.tear && j < ROCK1.loose) return 'hurl';
    return 'stand';
  }

  /** the follow-through's life: 1 at the throw tick, spent by loose+FOLLOW_S
   *  (whichever rock clock threw last owns it — their windows never overlap) */
  followK(c, j) {
    const of = (clock, R) => {
      if (clock === null) return 0;
      const u = clock - R.loose;
      return u >= 0 && u < FOLLOW_S ? 1 - easeInOut(u / FOLLOW_S) : 0;
    };
    return c !== null ? of(c, ROCK2) : of(j, ROCK1);
  }

  stepGiant(t, dt, c, j) {
    const S = this.state;
    S.giantPose = this.giantPoseAt(c, j);
    // the pose swap is a crossfade, exactly the room-dim law: pictures stacked
    // on one mark, opacities damped toward the state
    S.k.hurl = this.st.damp(S.k.hurl, S.giantPose === 'hurl' ? 1 : 0, 6.0, dt);
    S.k.curse = this.st.damp(S.k.curse, S.giantPose === 'curse' ? 1 : 0, 6.0, dt);

    /* THE WINDUP BRIDGE (hurl-windup, play-once x2): each rock clock's
       tear->loose window IS the windup — the clock's own progress drives the
       frame (bridgeFrame), the strip owns the picture, and it parks on its
       gated landing frame as the clock crosses `loose`; the static hurl cut
       (pose B, damped to full through the same window) takes the frame
       within one frame by the build's endpoint gate. THE CURSE SWAY
       (curse-sway, loop): the prayer sway holds the document frame live on
       the verb's own period until the tear. One live picture, never two. */
    this.giantBridge = null;
    if (c !== null && c >= ROCK2.tear && c < ROCK2.loose) {
      this.giantBridge = { play: 2, k: (c - ROCK2.tear) / (ROCK2.loose - ROCK2.tear) };
    } else if (c === null && j !== null && j >= ROCK1.tear && j < ROCK1.loose) {
      this.giantBridge = { play: 1, k: (j - ROCK1.tear) / (ROCK1.loose - ROCK1.tear) };
    }
    if (this.giantBridge) {
      this.giantBridge.k = +clamp01(this.giantBridge.k).toFixed(4);
      /* THE BRIDGE RATE GATE (weight lane, cave.js's own law): one cell per
         fixed step whatever the rock clock does — a jump can hurry the
         windup home a cell a tick, never teleport it. Fixed-step state:
         byte-equal laps. */
      const want = bridgeFrame(STRIP_HURL, this.giantBridge.k);
      const bg = this._bGate || (this._bGate = { id: null, frame: -1 });
      const id = 'hurl:' + this.giantBridge.play;
      const last = bg.id === id ? bg.frame : -1;
      this.giantBridge.frame = Math.min(want, last + 1);
      bg.id = id;
      bg.frame = this.giantBridge.frame;
    }
    this.curseLoop = !this.giantBridge && S.giantPose === 'curse'
      ? { frame: loopFrame(STRIP_CURSE, t, STRIP_CURSE.period) } : null;

    const M = MARKS['clifftop-giant'];
    if (this.giantBridge) {
      placeStrip(this.gHurlN, STRIP_HURL, M, STRIP_HURL.hPx, this.giantBridge.frame);
      this.gHurlN.style.opacity = '1';
    } else this.gHurlN.style.opacity = '0';
    if (this.curseLoop) {
      placeStrip(this.gCurseN, STRIP_CURSE, M, STRIP_CURSE.hPx, this.curseLoop.frame);
      this.gCurseN.style.opacity = '1';
    } else this.gCurseN.style.opacity = '0';

    const stripLive = !!(this.giantBridge || this.curseLoop);
    const standK = clamp01(1 - S.k.hurl - S.k.curse);
    this.giant.stand.style.opacity = (stripLive ? 0 : standK).toFixed(3);
    this.giant.hurl.style.opacity = (stripLive ? 0 : S.k.hurl).toFixed(3);
    this.giant.curse.style.opacity = (stripLive ? 0 : S.k.curse).toFixed(3);
    // a blinded giant listens with his whole body — breath on the pin, and
    // (MICRO-IDLE, the King law ported) the settled STAND adds the slow bob
    // and sway about the pinned feet; the hurl/curse action cuts keep the
    // breath alone (they are mid-verb, not settled)
    const amb = this.st.reduced ? 0 : 1;
    const br = amb * Math.sin(2 * Math.PI * t / 5.3);
    const swayG = amb * 0.2 * Math.sin(2 * Math.PI * t / 13.0);
    const syG = 1 + 0.006 * br;
    /* THE ROTATION LAG (release follow-through, step two): the stand cut
       fades in still carrying FOLLOW_ROT of the throw's lean and un-twists
       about the pinned feet — mass arrives late, exactly the cave torso-lag
       argument. NOT amb-gated: it is story motion, the release's own. */
    const fK = this.followK(this.curseT(), this.jeerT());
    const rotG = swayG + FOLLOW_ROT * fK;
    this.giant.stand.style.transform =
      `translateY(${(0.7 * br).toFixed(3)}px) rotate(${rotG.toFixed(3)}deg) ` +
      `scaleY(${syG.toFixed(5)})`;
    for (const e of [this.giant.hurl, this.giant.curse]) {
      e.style.transform = `scaleY(${syG.toFixed(5)})`;
    }
    this._followG = { k: +fK.toFixed(3), rot: +(FOLLOW_ROT * fK).toFixed(3) };
    this._idleG = !stripLive && standK > 0.5 && fK === 0
      ? { pose: S.giantPose, dy: +(0.7 * br).toFixed(3),
          rot: +swayG.toFixed(3), sy: +syG.toFixed(5) }
      : null;
  }

  stepUlysses(t, dt, amb) {
    const S = this.state;
    const at = this.ulyAt();
    /* MICRO-IDLE (the King law, ported VERBATIM from room.js stepKing): the
       old ±0.2 px mark-bob is retired for the full pattern — translateY,
       the slow sway, the scaleY breath — all about pinAt's PIN, so the
       planted foot never leaves its mark. */
    const br = amb * Math.sin(2 * Math.PI * t / 4.6);
    const bob = 0.7 * br;
    const sway = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0);
    const syI = 1 + 0.0035 * br;
    this.pinAt(this.uly.stand, ART.ulyStand, at, ULY_H);
    this.pinAt(this.uly.taunt, ART.ulyTaunt, at, ULY_H, true);    // flipped: the
    const taunt = S.uly.pose === 'taunt' ? 1 : 0;                 // arm at the cliff
    S.k.taunt = this.st.damp(S.k.taunt, taunt, 6.0, dt);
    /* §3.4: while the sacrifice is staged, ULYSSES IS ASHORE — the man at the
       altar and the man at the stern may never be up together (the two-Norton
       lesson). The beach instance's k is the same pure function, so the
       handoff replays identically. */
    const ashore = this._beach ? this._beach.ulyK : 0;
    this.uly.stand.style.opacity = ((1 - S.k.taunt) * (1 - ashore)).toFixed(3);
    this.uly.taunt.style.opacity = (S.k.taunt * (1 - ashore)).toFixed(3);
    const idle = `translateY(${bob.toFixed(3)}px) rotate(${sway.toFixed(3)}deg)`;
    this.uly.stand.style.transform = `${idle} scaleY(${syI.toFixed(5)})`;
    /* THE DRAWN BREATH (the release verb, myname): the taunt cut SWELLS
       subtly on the held k — scaleY about the pinned foot, so the chest
       rises and the planted foot never leaves its mark. pinAt just rewrote
       the transform to the bare flip, so the swell (and the idle breath it
       COMPOSES with, multiplicatively) lands after it. */
    const swell = (1 + 0.045 * S.holdK) * syI;
    this.uly.taunt.style.transform = `scaleX(-1) ${idle} scaleY(${swell.toFixed(4)})`;
    this._idleU = { pose: S.uly.pose, dy: +bob.toFixed(3), rot: +sway.toFixed(3),
                    sy: +syI.toFixed(5), swellK: +S.holdK.toFixed(3) };
  }

  /** THE OARS BITE (STRIPS.md #4): the strip's frame rides the stroke clock,
   *  which advances ∝ effort — story motion, so reduced motion keeps the
   *  pull and loses only the ambient bench bob. The old fake-stroke rotate
   *  is retired: the strip IS the stroke now, and rocking the whole bench on
   *  top of it would be double motion. Feet stay pinned: placeStrip anchors
   *  each frame on the MAN's own measured foot span. */
  stepRowers(t, dt, amb) {
    const S = this.state;
    const effort = this.rowEffort(t);
    S.rowPhase += dt * effort / STRIP_ROW.period;
    const amp = amb * 0.35 + effort;               // idle breath vs the pull
    this.rowers.forEach((r, i) => {
      const ph = S.rowPhase + i * STRIP_ROW.phase; // per-bench stagger, in cycles
      const frame = Math.floor((ph % 1) * STRIP_ROW.n) % STRIP_ROW.n;
      this.rowerFrames[i] = frame;
      placeStrip(r.el, STRIP_ROW, MARKS[r.mark], ROWER_STRIP_H, frame);
      r.el.style.transform =
        `translateY(${(-1.2 * amp * Math.sin(2 * Math.PI * (t / STRIP_ROW.period) + i * 0.9)).toFixed(2)}px)`;
    });
  }

  /* ---- the rocks: one prop, two flights, both pure functions ------------ *
   * Each flight is (clock - loose)/(land - loose) from the raised hands over
   * the brow to the LEDGER'S OWN splash point — rock 1 ahead of the rudder at
   * (468,505), rock 2 astern at (455,540) — and the splash stands its 76 px
   * (6 m) plume on that same point. The wind-up itself is the hurl pose's;
   * the rock is born at the release.
   * THE LAND-TICK GUARD (throw law): the clocks are DIFFERENCES of two
   * 1/60-grid floats, so the tick that should sit exactly ON `land` can
   * read land + 2e-15 — the rock vanishes one tick early while the splash's
   * raw k is still sub-visible, and the resynced arc-end==splash-rise law
   * sees dead water at the boundary. A half-quantum epsilon keeps the rock
   * through its own landing tick; the splash's first VISIBLE tick is the
   * next one either way. */
  rockFlight() {
    const j = this.jeerT(), c = this.curseT();
    const EPS = 1e-6;                        // << 1/60, >> the grid's float error
    if (c !== null && c >= ROCK2.loose && c <= ROCK2.land + EPS) {
      return { R: ROCK2, clock: c, to: SPLASH2, grow: 52, id: 'rock2' };
    }
    if (c === null && j !== null && j >= ROCK1.loose && j <= ROCK1.land + EPS) {
      return { R: ROCK1, clock: j, to: SPLASH1, grow: 48, id: 'rock1' };
    }
    return null;
  }

  splashLevel() {
    const j = this.jeerT(), c = this.curseT();
    /* THE ATTACK ENVELOPE (impact accent lane): the arc's end tick IS the
       rise's first tick — full plume inside SPLASH_ATTACK of the window
       (one fixed tick past land already reads 0.42), sine tail after. The
       old symmetric bump put 0.026 one tick after land: the reviewer's
       "disappears at the waterline with no convincing splash". */
    const at = (clock, R) => {
      if (clock === null) return 0;
      const u = (clock - R.land) / 2.0;
      if (u <= 0 || u > 1) return 0;
      return u < SPLASH_ATTACK
        ? easeOut(u / SPLASH_ATTACK)
        : Math.sin(Math.PI * (0.5 + 0.5 * (u - SPLASH_ATTACK) / (1 - SPLASH_ATTACK)));
    };
    /* the accent's own clock: seconds past the land, for the +15% overshoot */
    const uOf = (clock, R) => clock - R.land;
    const k2 = at(c, ROCK2);
    if (k2 > 0) return { k: k2, to: SPLASH2, id: 'rock2', u: uOf(c, ROCK2) };
    const k1 = c === null ? at(j, ROCK1) : 0;      // rock1's window is long past
    if (k1 > 0) return { k: k1, to: SPLASH1, id: 'rock1', u: uOf(j, ROCK1) };
    return { k: 0, to: SPLASH1, id: null, u: 0 };
  }

  stepRocks(t) {
    const f = this.rockFlight();
    if (f) {
      const k = clamp01((f.clock - f.R.loose) / (f.R.land - f.R.loose));
      const x = lerp(RELEASE[0], f.to[0], k);
      const y = lerp(RELEASE[1], f.to[1], k * k) - Math.sin(Math.PI * k) * 90;
      const h = lerp(34, f.grow, k);               // nearer is bigger, isometric law
      const w = h * (ART.rock.px[0] / ART.rock.px[1]);
      box(this.rock, x - w / 2, y - h / 2, w, h);
      this.rock.style.transform = `rotate(${(k * 240).toFixed(1)}deg)`;
      this.rock.style.opacity = '1';
      this._rockAt = [x, y];
    } else {
      this.rock.style.opacity = '0';
      this._rockAt = null;
    }

    const sp = this.splashLevel();
    if (sp.k > 0) {
      // the plume rises out of its own foot: pinned to the splash point,
      // scaled up from the water along the pin the transform-origin sits on.
      // THE IMPACT ACCENT: +15% scale through the first ACCENT_S (3 fixed
      // ticks) — the hit lands BIG and settles, about the same pinned foot.
      const acc = sp.u <= ACCENT_S
        ? 1.15
        : 1 + 0.15 * (1 - clamp01((sp.u - ACCENT_S) / 0.08));
      sp.accent = +acc.toFixed(3);
      this.pinAt(this.splash, ART.splash, sp.to, SPLASH_H);
      this.splash.style.transform =
        `scaleX(${acc.toFixed(3)}) scaleY(${(easeOut(sp.k) * acc).toFixed(3)})`;
      this.splash.style.opacity = (0.95 * sp.k).toFixed(3);
    } else {
      sp.accent = 1;
      this.splash.style.opacity = '0';
    }
    this._splash = sp;
  }

  /* ---- harness ----------------------------------------------------------- *
   * What the lap must be able to measure without re-deriving the set: the
   * state name, both clocks, both rocks, the world transform and its origin,
   * the gate's anchor and count, the waits, and EVERY actor's rendered box in
   * plate px — the parking-law pattern: boxes read off the elements the
   * browser is drawing (so they include the world transform), not off the
   * numbers that asked for them. */
  snapshot() {
    const S = this.state;
    const j = this.jeerT(), c = this.curseT(), d = this.dawnT();
    const pbox = (e) => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const a = this.st.toPlate(r.left, r.top);
      const b = this.st.toPlate(r.right, r.bottom);
      return [+a.x.toFixed(1), +a.y.toFixed(1),
              +(b.x - a.x).toFixed(1), +(b.y - a.y).toFixed(1)];
    };
    const phase = (clock, R, oars) => {
      if (clock === null) return 'idle';
      if (clock < R.tear) return 'idle';
      if (clock < R.loose) return 'tear';
      if (clock < R.land) return 'flight';
      if (clock < R.wash[1]) return 'wash';
      if (oars && clock < R.oars[1]) return 'oars';
      if (clock < R.done) return 'settling';
      return 'done';
    };
    const giantEl = this.giantBridge ? this.gHurlN
      : this.curseLoop ? this.gCurseN
      : S.k.curse > Math.max(S.k.hurl, 1 - S.k.hurl - S.k.curse)
      ? this.giant.curse
      : (S.k.hurl > 0.5 ? this.giant.hurl : this.giant.stand);
    const ulyEl = S.k.taunt > 0.5 ? this.uly.taunt : this.uly.stand;
    return {
      /* MICRO-IDLE (the King law): the settled principals' live breath —
         self-reported amplitudes plus the rendered (transform-applied) box
         the lap samples 3 s apart. NOTE the sea boxes ride the world
         transform: the lap subtracts world dx/dy between its samples. */
      idle: {
        uly: this._idleU ? { ...this._idleU, box: pbox(ulyEl) } : null,
        giant: this._idleG ? { ...this._idleG, box: pbox(this.giant.stand) } : null,
      },
      state: d !== null ? 'sea-dawn' : 'sea',
      world: { k: +this._wk.toFixed(4), dx: +this._wdx.toFixed(2),
               dy: +this._wdy.toFixed(2), rot: +(this._wrot || 0).toFixed(3),
               origin: SHIP.deckCentre },
      clock: { jeer: j === null ? null : +j.toFixed(2),
               curse: c === null ? null : +c.toFixed(2),
               ruse: this.ruseT() === null ? null : +this.ruseT().toFixed(2) },
      rock1: { phase: phase(j !== null && c !== null ? Math.max(j, ROCK1.done) : j,
                            ROCK1, true),
               splashAt: SPLASH1, done: this.waitDone('rock1') },
      rock2: { phase: phase(c, ROCK2, false),
               splashAt: SPLASH2, done: this.waitDone('rock2') },
      rockAt: this._rockAt ? this._rockAt.map((v) => +v.toFixed(1)) : null,
      splash: { k: +(this._splash ? this._splash.k : 0).toFixed(3),
                of: this._splash ? this._splash.id : null,
                u: +(this._splash ? this._splash.u : 0).toFixed(3),
                accent: +(this._splash && this._splash.accent
                          ? this._splash.accent : 1).toFixed(3) },
      gate: { target: 'cyclops', at: this.targetPlate('cyclops').map((v) => +v.toFixed(1)),
              live: this.targetLive('cyclops'),
              resolutions: S.resolutions, myname: S.myname },
      waits: { rock1: this.waitDone('rock1'), rock2: this.waitDone('rock2') },
      seg: S.segT0 > -1e8
        ? { name: 'return-beach',
            k: +clamp01((S.t - S.segT0) / S.segDur).toFixed(3) }
        : null,
      /* §3.4 THE RETURN TABLEAU — the declared staging objects and their
         DRAWN bodies, boxes off the rendered elements (the parking-law
         pattern). The lap's sacrifice carrier reads THIS block: a declared
         object with no box or no opacity is a silent gap, and silent gaps
         are what §3.4 exists to forbid. */
      beach: (() => {
        const B = this._beach;
        if (!B) return { on: false };
        const body = (id) => {
          const b = this.beach[id];
          return { id, at: b.at, h: b.h, op: +(+b.el.style.opacity).toFixed(3),
                   box: pbox(b.el) };
        };
        return {
          on: B.rise > 0.05, rise: +B.rise.toFixed(3), seg: +B.seg.toFixed(3),
          pxPerM: BEACH.pxPerM, band: { box: BEACH.box, op: +this.beachG.style.opacity },
          fire: +B.fireK.toFixed(3), smoke: +B.smokeK.toFixed(3),
          dusk: +B.duskK.toFixed(3), board: +B.boardK.toFixed(3),
          fireAt: B_FIRE_AT,
          altar: body('altar'), ram: body('ram-return'), uly: body('uly-ashore'),
          crew: B_CAST.filter((c) => c[0].startsWith('crew')).map((c) => body(c[0])),
          flock: B_CAST.filter((c) => c[0].startsWith('flock')).map((c) => body(c[0])),
        };
      })(),
      dawn: +S.k.dawn.toFixed(3),
      veil: +S.k.veil.toFixed(3),
      giant: { pose: S.giantPose, mark: MARKS['clifftop-giant'],
               box: pbox(giantEl),
               /* the release follow-through, declared: k spends 1 -> 0 over
                  FOLLOW_S past each loose; rot is the un-twisting lean */
               follow: this._followG || { k: 0, rot: 0 },
               hurlK: +S.k.hurl.toFixed(3) },
      /* the windup bridge / curse sway, same proof style as the rowers:
         frame + the foot off the RENDERED box vs the world-mapped mark;
         `done` flags say each rock's windup has parked on pose B */
      giantStrip: this.giantBridge ? {
        mode: 'bridge', key: 'hurl-windup', play: this.giantBridge.play,
        k: this.giantBridge.k, n: STRIP_HURL.n,
        ...stripProof(this.st, this.gHurlN, STRIP_HURL, this.giantBridge.frame,
                      this.worldMap(MARKS['clifftop-giant']), false),
      } : this.curseLoop ? {
        mode: 'loop', key: 'curse-sway', n: STRIP_CURSE.n,
        ...stripProof(this.st, this.gCurseN, STRIP_CURSE, this.curseLoop.frame,
                      this.worldMap(MARKS['clifftop-giant']), false),
      } : null,
      hurlDone: { rock1: j !== null && j >= ROCK1.loose,
                  rock2: c !== null && c >= ROCK2.loose },
      ulysses: { mark: S.uly.at, pose: S.uly.pose,
                 at: this.ulyAt().map((v) => +v.toFixed(1)),
                 box: pbox(ulyEl),
                 holdK: +S.holdK.toFixed(3) },   // the release verb's breath
      /* THE STRIP PROOF (the sherlock walk law): frame + the man's foot off
         the RENDERED box vs the mark THROUGH the world transform — the lap
         holds cycling, the bench stagger and |dx|,|dy| (± the bench bob) */
      rowers: this.rowers.map((r, i) => ({
        mark: r.mark, at: MARKS[r.mark], box: pbox(r.el),
        strip: stripProof(this.st, r.el, STRIP_ROW, this.rowerFrames[i],
                          this.worldMap(MARKS[r.mark]), false),
      })),
      rowPhase: +S.rowPhase.toFixed(4),
      /* EXPLORER C's own proofs: the live shadows (ledger plate px — they
         ride the world group, like every mark) and the under-the-actors
         group order; the gunwale occluder was measured and refused. */
      grounding: {
        under: !!(this.shadowG.compareDocumentPosition(this.actors) &
                  Node.DOCUMENT_POSITION_FOLLOWING),
        shadows: this._shadows || [],
        occ: [],
      },
      rowEffort: +this.rowEffort(S.t).toFixed(3),
      marks: MARKS,
    };
  }
}

export { FOCUS, MARKS, TARGETS, DIM_MATRIX, SHIP, SPLASH1, SPLASH2,
         ROCK1, ROCK2, WORLD, PX_PER_M };
