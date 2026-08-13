/**
 * sets/church.js — St Monica's, Edgware Road. Leaf 4, Beat IV.
 *
 * ONE REGISTER. This set used to run the marriage in two art registers at once:
 * a painterly sprite-Holmes standing beside three faceless mannequins BAKED
 * into church.jpg, and a Norton who existed twice — a painted man in the aisle
 * and a maroon mannequin at the altar. The reader saw two worlds in one frame,
 * and it is the single worst thing in the book (review F4).
 *
 * The plate's answer used to be "never lift the painted groom, and compose the
 * aisle lens so his painted self is off-frame while his sprite runs". That kept
 * the doubling out of any single frame and left it in the book.
 *
 * So the three are LIFTED OFF THE PLATE instead. Beat I's hole-patch was tried
 * here first and rejected on the art (`knot-patch.png` is a harmonic blur), so
 * the chancel is REPAINTED by a confined i2i and pasted back through the
 * figures' own difference mask — tools/lanecf/chancel_patch.py, which proves
 * alignment before the paste and gates the paste to zero changed pixels outside
 * the figures' box. church.jpg, church-dim.jpg, church-ring.jpg and the altar
 * FOREGROUND cut all lose them together, so no variant can put one back.
 *
 * All four participants are painted cut-outs now, on the plate's own foot marks:
 *   the bride       actor/irene-bride.png       — shipped, has a face, never staged
 *   the groom       actor/norton-groom.png      — the aisle Norton, the only one
 *   the clergyman   actor/clergyman-altar.png   — generated to the canonical
 *                                                 sheet law off the plate's own
 *                                                 painted figure (6.3 GAP #6)
 *   the witness     actor/holmes-church*.png    — unchanged
 *
 * THE FLOOR IS MEASURED, NOT REMEMBERED (review F5). See FLOOR below.
 *
 * THE TWO CLOSE LENSES ARE CONTRACT FACTS. Both are pushes now, at k 3.20, and
 * both are set by their own frame's content — see FOCUS.
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, placeSprite,
         floorY, emissives, breathe } from '../setkit.js';

/* the church lane's own handoff: where its painted figures STOOD. The plate no
   longer paints them (church.jpg is the emptied chancel now — see
   tools/lanecf/chancel_patch.py), so these boxes are kept for one purpose only:
   they are the lens contract's own measuring sticks, and FEET below is the
   plate's own statement of where a person's feet go at that altar. */
const FIGURES = {
  bride:     [688, 344, 792, 528],
  groom:     [790, 372, 875, 505],
  clergyman: [848, 328, 925, 510],
};

/* THE FLOOR, AND THE PEWS IN FRONT OF IT (F5, round 2).
 *
 * Round 1 replaced a remembered line with a measured one and still floated the
 * marriage, because the thing it measured was the wrong thing. `church_geom.py`
 * called x 700..980 / y 502..520 "the chancel, VISIBLE", and it is not: it is
 * the TOP EDGE OF THE NEAR PEW BACKS. Standing four cut-outs on it put eight
 * boots and a gown hem on a pew rail, which is exactly what the review saw.
 *
 * THE PLATE HAD ALREADY ANSWERED THE QUESTION. Diff the pre-patch plate against
 * the patched one and the difference IS the painted three; every column's last
 * figure pixel lands on the top edge of the nearest pew rail to within a pixel
 * (tools/lanecf/pew_front.py: residual mean 0.62 px bride, 0.89 px groom over
 * 77 columns). The painting stood its people on a floor it could not see and let
 * the pew cut them off. So this set does the same two things:
 *
 *   1. `pews-front.png` — the plate's own pixels for y >= T(x), where T is that
 *      measured front contour, laid OVER the actors. Anything standing at the
 *      altar is cut by the pew exactly where the painting cut its own figures.
 *   2. every chancel mark is T(x) + hem, so a foot is BEHIND the pew instead of
 *      on top of it.
 *
 * AND HOW MUCH HEM IS NOT ONE NUMBER (F5, round 3). Round 2 gave every mark the
 * same 8 px and one figure still read wrong, because the amount that has to be
 * swallowed is a property of the CUT and not of the floor: the cut is made at
 * T(x), so what the reader judges is which part of the actor the cut passes
 * through. A GOWN cut anywhere reads as cloth going behind a pew — it is what
 * the plate's own painted bride did at this exact line. A BOOT cut through its
 * SOLE reads as a boot standing ON the rail, because the rail's own bright top
 * highlight then sits directly under the sole. The witness was the second case:
 * 8 px of his 20 px boot hidden, sole on the highlight, and the review's
 * "standing on pew tops" survived a fix that had moved him.
 *
 * So tools/lanecf/foot_sink.py measures each cut's FOOTWEAR BLOCK off its own
 * alpha (the toe flare and everything under the ankle; a hemmed cut scores 0,
 * and feet are told from cloth by the silhouette having two runs instead of
 * one) and then tests every mark by ONE law:
 *
 *      floorFrac >= 0.60   OR   sink >= footwear
 *      feet on painted floor, or feet hidden. No sole on a rail.
 *
 * Which is why the witness's altar mark is now the visible chancel STONE at
 * y 501 (probed 0.89 floor) instead of 516: the plate paints a floor strip at
 * x 690..750 between the pew rows, his boots stand on it, and the rail passes
 * 7 px below his soles as a foreground line. Norton (sink 33) and the bride
 * (a hem) were already legal and are untouched; the same law says so.
 *
 * FLOOR is only what it can honestly be: the path a WALKER's feet take, pinned
 * to the walkers' own stop marks — the aisle runner where it is visible
 * (449..522, probed carpet 1.00), then the chancel at 700 and 791. The 770 knee
 * is gone with it: interpolated, floorAt(770) = 521.4, which swallows Norton's
 * 18.7 px boot 31 px deep. The three who stand still do not use FLOOR at all:
 * they carry their own measured point, because three people standing at an
 * altar are at three DEPTHS and no single y(x) can put all of them on it. */
const FLOOR = [[449, 604], [522, 601], [700, 501], [791, 527.5], [980, 534]];
const floorAt = (x) => floorY(FLOOR, x);

/* the pew/rail FOREGROUND cut, and the box tools/lanecf/pew_front.py wrote it in */
const PEWS = { x: 504, y: 451, w: 442, h: 250 };

/* WHERE THE PLATE'S OWN THREE STOOD, as T(x) + HEM at the painted figure's own
   column centre (pew_front.json `marks`). The bride's own hem is the deepest
   correction: she was at y 504 and the pew rail crosses her column at 516.
   The groom keeps his SHIPPED OFFSET from the bride (+62.5 x, +3.4 y) because
   that offset is what makes their hands meet — fact M.4 is a ring going onto
   JOINED hands, and it was measured on the rendered frame. Moving the pair
   together therefore moves HANDS with them and the ring stays on them. */
const FEET = {
  bride:     [728.0, 524.0],
  groom:     [790.5, 527.4],
  clergyman: [886.0, 509.0],
};
const ALTAR = { x: 813, y: 339, w: 286, h: 206 };
const GLASS = { x: 981, y: 345, w: 52, h: 64 };

const EMIS = [
  { id: 'glo1', at: [867, 255],  r: 66, rgb: '249,227,149', a: 0.235, per: 2.6, amp: 0.42 },
  { id: 'win2', at: [580, 270],  r: 58, rgb: '233,252,254', a: 0.22,  per: 7.3, amp: 0.45 },
  { id: 'can3', at: [900, 298],  r: 38, rgb: '253,250,200', a: 0.188, per: 3.7, amp: 0.50 },
  { id: 'glo4', at: [1081, 314], r: 54, rgb: '249,226,152', a: 0.267, per: 2.6, amp: 0.42 },
  { id: 'can5', at: [939, 372],  r: 42, rgb: '248,208,138', a: 0.159, per: 3.7, amp: 0.50 },
];

/* THE JOINED HANDS. Fact M.4 happens here and nowhere else: the point where
   the bride's right hand meets the groom's. It is no longer read off a painting
   of two people — the two people are ACTORS now, so it is carried on their
   marks: the midpoint of the two foot marks, lifted to the height the two ACTORS
   actually join hands at. The plate's own painted couple joined at 90 px above
   their mean foot mark, and 90 put the band 20 plate px below the cut-outs' own
   hands (measured on the rendered ring-lens frame: hands at device y 830, band
   at 912, and 82 device px is 20.5 plate px at k 3.20). 110 puts it on them. */
const HANDS_LIFT = 110;
const HANDS = [(FEET.bride[0] + FEET.groom[0]) / 2,
               (FEET.bride[1] + FEET.groom[1]) / 2 - HANDS_LIFT];

const FOCUS = {
  nave:  [704, 384, 1.00],
  /* THE AISLE LENS. Its old first constraint — "right edge < 790, or Norton's
     painted self is in frame beside his sprite" — is gone: the plate paints
     nobody now, so there is only ONE Norton in the world and the lens is free to
     hold the whole side aisle. Composed on the witness's own marks (478..520 on
     the visible runner) at k 2.50: plate x 218..782, y 346..654. */
  aisle: [500, 500, 2.50],
  knot:  [820, 420, 1.20],
  /* THE RING LENS — the tightest frame in the book, and it has to be tight
     enough that the RING is a legible object, because the ring is the fact.
     k=1.13 was defended by the reference's "the bride reads 27.2% of frame
     height", and that number is arithmetically satisfied at 1.13 — but it is
     the wrong quantity: it measures the BRIDE. The reference's r 6.6 is a frame
     2.8 m tall at the subject, which on this plate (104.5 px/m, 768 px tall) is
     k = 7.35/2.8 = 2.63; at 1.13 the push is 13% and the frame is
     indistinguishable from the wide nave shot the reader has been looking at
     for six units.

     k 2.20 shipped and the review measured what it delivers: a ring 37 px
     across in the captured frame, which is a gold speck, and the fact the unit
     exists for did not read. So the push is TAKEN FURTHER, to k 3.20, and the
     limit that sets it is the frame's own content and nothing else: at 3.20 the
     frame is 440x240 plate px on the joined hands — x 539..979, y 292..532
     (measured off the lens actually in force by tools/lanecf/frame_feet.py; the
     centre is HANDS, which is 759.25, not the 786 an earlier note assumed) —
     which holds all four participants whole (the clergyman is the binding one at
     844..928), is inside the church's painted content (266..1134) on every side,
     and puts the band 64 px across in the captured frame. The 240 px of height
     is what sets the limit: the tallest
     head in the knot is Norton's at y 325 and the lowest foot mark is the
     bride's at 530, so 205 px of content, and past k 3.7 somebody's head leaves
     the frame. */
  ring:  [HANDS[0], HANDS[1] - 4, 3.20],
  /* THE COIN LENS, composed on the JOURNEY and not on the altar, and it is a
     PUSH: fact M.6 is a small gold object changing hands three times, so the
     lens has to be tight enough that the coin is an object. The three holders
     are the joined hands (759, 416), the witness's palm (730, 411) and his watch
     chain (708, 434) — x 708..759, y 411..434 — so the lens stands on their
     middle at k 3.20: a 440x240 frame on plate x 514..954, y 302..542, inside
     the painted content on every side, with the coin 64 px across in the
     captured frame. */
  coin:  [734, 422, 3.20],
};

/* the church lane's shipped relight. Blue MEASURES 1.035 on this plate — the
   relight preserves blue while killing red — and is clamped to 1.0 before it
   is used as an actor matrix, or a coefficient above 1 tints every cut-out
   blue instead of dimming it. */
const DIM_MATRIX = [0.435, 0.746, 1.0];
const PX_PER_M = 104.5;

/* THE FOOTWEAR BLOCK of each standing cut, in PLATE px at the height this set
   draws it — tools/lanecf/foot_sink.py, measured off the cut's own alpha. It is
   the number the F5 law is stated in: a mark is legal if the plate under it is
   floor OR the pew swallows at least this much of the actor. A HEMMED cut (the
   bride's gown, the clergyman's cassock: one run of alpha, not two) scores 0,
   because a hem cut by a rail is cloth going behind a rail. */
const FOOTWEAR = { witness: 20.0, groom: 18.7, bride: 0.0, clergyman: 0.0 };

const ART = {
  holmes:      { file: 'actor/holmes-church.png', size: [218, 586], baseline: 583.1 },
  holmesAltar: { file: 'actor/holmes-church-altar.png', size: [218, 586], baseline: 583.1 },
  holmesWalk:  { file: 'actor/holmes-church-walk.png', size: [1192, 467],
                 cell: [298, 467], frames: 4, baseline: 461 },
  norton:      { file: 'actor/norton-groom.png', size: [195, 564], baseline: 561.1 },
  nortonBeck:  { file: 'actor/norton-beckon.png', size: [294, 564], baseline: 561.1 },
  nortonRun:   { file: 'actor/norton-run.png', size: [1412, 508],
                 cell: [353, 508], frames: 4, baseline: 502 },
  /* THE BRIDE AND THE CLERGYMAN ARE ACTORS NOW. `irene-bride.png` already
     existed with a real face and was never staged; the clergyman had no cut at
     all (CONTENT-full 6.3 marks him GAP) and is generated to the canonical-sheet
     law off the plate's own painted figure — tools/lanecf/refsheet_cf.py. */
  bride:     { file: 'actor/irene-bride.png', size: [255, 527], baseline: 524 },
  clergyman: { file: 'actor/clergyman-altar.png', size: [254, 549], baseline: 545.8 },
};

const MARK = {
  /* THE WITNESS'S TWO AISLE MARKS ARE ON VISIBLE CARPET, and that is the whole
     correction: both are inside the runner's measured visible run, so the plate
     under his boots is the floor and not a pew. */
  back: 478,       // where the idler comes in at the foot of the side aisle
  lounged: 508,    // as far up the aisle as an idler goes
  /* AT THE ALTAR, on the bride's near side, and ON THE PLATE'S OWN STONE:
     floorAt(704) is 502.2, which foot_sink.py probes at 0.89 floor, and the pew's
     front contour crosses his column below his soles — so his boots stand on
     painted floor with the rail in front of them, instead of on the rail.

     THE LAST FOUR PIXELS ARE THE SWEEP'S (F5, round 4). At 700 his left boot's
     outermost silhouette column had no floor under it and no occluder over it:
     the front pew's end standard is nearer than his boot there, but its own lit
     edge drifts to hue 318 and falls out of the furniture mask pew_end.py cuts
     the layer on, so one column of sole hung over 2 px of dark edge. Sweeping the
     mark against the COMPOSITE (tools/lanecf/sole_composite.py) the honest window
     is 702..705 and 704 is its middle: 70 of his 80 sole columns hidden (pew, and
     the bride's own gown now that she is painted in front of him), 10 standing on
     visible painted stone, 0 over nothing, 0 on a person. Four plate px is
     invisible to the reader and it is the difference between a stance that can be
     asserted at zero and one that needs a tolerance. */
  altar: 704,
  /* HIS MARK IS WHERE HER HANDS ARE, and it moved with hers: the bride went from
     739.5 to 728 when her mark was measured off the pew contour, so the groom
     went from 802 to 790.5 and their hands are still joined. His sprite
     (758..823) overlaps hers (686..771) by the width of two hands. */
  nortonHome: 790.5,
  /* WHERE HE PULLS UP, AND IT IS NOT INSIDE THE WITNESS (F5, round 5). 520 put
     him on visible carpet and passed every gate that reads one bitmap at a time,
     because the defect is not in either figure — it is BETWEEN them. Their sole
     spans measured off their own alpha are 481.7..532.0 (the witness at lounged
     508, both boots) and 509.7..523.0 (Norton beckoning at 520): his boots stand
     inside the witness's boots, and on this nearly lateral floor line 12 px of
     aisle is 0.5 px of depth, so the two men occupy one square foot of church and
     whichever is painted second is standing on the other. In the captured frame
     it reads as one man wearing another.

     He is a MAN ARRIVING, so he arrives on the near side and pulls up in front of
     the witness, between him and the door — which is also what the line is doing
     ("Come! Come!" from a man blocking your way out). Swept against the composite
     (tools/lanecf/sole_composite.py, `aisle`), every mark from 474 down is clean
     on both counts and 474 is the first: his soles land 463.7..477.0, which is
     4.7 px clear of the witness's outermost sole column, all 41 of them on the
     runner's own measured carpet (tools/lanecf/sole_span.py: floor 41, onPew 0),
     and his mark y 603.0 is 1.4 px NEARER than the witness's 601.6 — so the sort
     paints him in front, and being in front is now true. */
  nortonMet: 474,
  /* where Norton hauls the witness to before letting go of him: ahead of the
     witness's altar mark, on the same pew contour + hem rule */
  nortonDrag: 770,
};

const SCRUB = 4.5;      // ringScrub / sovereignScrub, both 0->1 over 4.5 s
const GLASS_RUN = 11.0; // the three minutes on the altar's own hourglass

/* the props, in plate pixels. A wedding band is 2 cm and a sovereign 22 mm; at
   104.5 px/m that is two pixels, which is not an image of anything. Both are
   drawn at 16 px — 13 shipped, and at 13 the review measured a 37 px ring and a
   coin that "did not read" in the captured frame. 16 px is 15 cm at this scale,
   which is the same convention the book already uses for the gold watch, still
   sits inside a hand at the wide lens, and with the close lenses taken to k 3.20
   puts both objects 64 px across in the captured frame. The chain is drawn at its
   true size: an albert's swag really is about 25 cm. */
const PROP = {
  ring:  { size: [128, 115], w: 16 },
  coin:  { size: [128, 114], w: 16 },
  chain: { size: [192, 146], w: 26 },
};

export class ChurchSet {
  static id = 'church';
  static insets = {};
  static beds = ['church'];

  constructor(root, st) {
    this.st = st;
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);

    this.base = img('set/church/church.jpg', 'lyr plate');
    this.ring = img('set/church/church-ring.jpg', 'lyr plate');
    this.dim = img('set/church/church-dim.jpg', 'lyr plate');
    for (const e of [this.base, this.ring, this.dim]) box(e, 0, 0, PLATE.w, PLATE.h);
    this.ring.style.opacity = '0';
    this.dim.style.opacity = '0';

    this.emis = emissives(EMIS, root);

    /* ---- the actors ------------------------------------------------- *
     * ONE REGISTER. Every participant in the marriage is a painted cut-out in
     * this group: the bride, the groom, the clergyman and the witness. The
     * plate's baked mannequins are gone (tools/lanecf/chancel_patch.py), so
     * there is no second art register left in the frame and no second Norton.
     *
     * THE ORDER IS THE DEPTH ORDER, and it is the last piece of F5. This group
     * has no depth sort — within one group the DOM order IS the painter's order —
     * and it used to be "the two who never move first, so the pair that stays put
     * never covers the pair the reader is following". That rule put the BRIDE
     * behind the WITNESS, and on these marks she is 23 plate px in front of him:
     * her mark is y 524, his is 501, and lower on this plate is nearer. Her gown
     * therefore covered the chancel stone his boots stand on and he was painted
     * over it, so in the 3.2x ring lens 43 of his 80 sole columns were resting on
     * her SKIRT with the pew rail a few px below — a boot in mid-air, which is the
     * review's F5 exactly, surviving two gates that measured the PLATE under his
     * mark and found honest stone (tools/lanecf/sole_composite.py measures the
     * composite instead, and the lap asserts it per column).
     *
     * So the group is painted BACK TO FRONT BY MARK — and it is SORTED every
     * frame, not written down once. The static order was right for the altar
     * (witness 502, clergyman 509, bride 524, groom 527) and wrong for the AISLE,
     * which is the other staging this beat holds: there the two men stand at
     * lounged 508 and nortonMet, their marks are within a pixel of each other on
     * a nearly lateral floor line, and whichever is appended second owns the
     * other's boots. Shipped, that was the groom — 10 of his 41 sole columns
     * landed on the witness's cut while his own mark was the FURTHER of the two
     * (601.1 against 601.6), which is the review's F5 in a second frame nobody
     * had composited (tools/lanecf/sole_composite.py, `aisle` scene).
     *
     * `sortActors` orders the four by the y of the mark they are standing on this
     * frame, lowest first, so nearer is always painted later. It is the same law
     * the composite lap asserts, applied instead of restated, and it holds while
     * they move: a walker's depth changes with his x and the sort follows it. */
    this.actors = el('div', 'actors', root);
    this.holmes = img(ART.holmes.file, 'lyr', this.actors);
    this.holmesAltar = img(ART.holmesAltar.file, 'lyr', this.actors);
    this.holmesWalk = el('div', 'lyr walk', this.actors);
    this.holmesWalk.style.backgroundImage = st.bitmap(ART.holmesWalk.file);
    this.clergy = img(ART.clergyman.file, 'lyr', this.actors);
    this.bride = img(ART.bride.file, 'lyr', this.actors);
    this.norton = img(ART.norton.file, 'lyr', this.actors);
    this.nortonBeck = img(ART.nortonBeck.file, 'lyr', this.actors);
    this.nortonRun = el('div', 'lyr walk', this.actors);
    this.nortonRun.style.backgroundImage = st.bitmap(ART.nortonRun.file);
    for (const e of [this.holmesAltar, this.holmesWalk, this.nortonBeck, this.nortonRun]) {
      e.style.opacity = '0';
    }
    /* the four participants as the sort sees them: every pose a figure can be
       drawn in travels with it, because a figure's depth is a property of its
       MARK and not of which cut is showing */
    this.cast = [
      { who: 'witness', nodes: [this.holmes, this.holmesAltar, this.holmesWalk] },
      { who: 'clergyman', nodes: [this.clergy] },
      { who: 'bride', nodes: [this.bride] },
      { who: 'groom', nodes: [this.norton, this.nortonBeck, this.nortonRun] },
    ];

    /* ---- THE PEWS GO OVER THE ACTORS (F5) --------------------------- *
     * The only layer in this set that is in FRONT of a person. Its top edge is
     * the contour the plate's own painted figures were cut off on, so a witness
     * walking up the nave passes BEHIND the pews he passes, and the four at the
     * altar are cut at the hem instead of standing on a rail. It is a copy of
     * pixels the plate already paints, so where it covers no actor it changes
     * nothing — which is also why it can be asserted: the lap reads its alpha at
     * every mark and asks whether that foot is on floor or behind a pew.
     *
     * TWO COPIES, because there are two plates. `church-ring.jpg` is a
     * candlelight lift on the knot and it crossfades under the actors; a single
     * occluder cut from `church.jpg` would leave the pews unlit while the rest of
     * the picture warmed. The ring copy rides the ring plate's own opacity. */
    this.pews = img('set/church/pews-front.png', 'lyr', root);
    this.pewsRing = img('set/church/pews-front-ring.png', 'lyr', root);
    for (const e of [this.pews, this.pewsRing]) box(e, PEWS.x, PEWS.y, PEWS.w, PEWS.h);
    this.pewsRing.style.opacity = '0';

    /* ---- the altar cut goes UNDER the actors ------------------------- *
     * It shipped as a FOREGROUND cut so "legs go behind it", and that was right
     * when the only actor near the chancel was a witness who stopped mid-nave.
     * With the marriage staged, all four participants stand IN FRONT of the
     * altar rail — and the cut was drawing the altar's own front edge, its
     * frontal and a candlestick across the groom's shoulder and the clergyman's
     * sleeve, which is what put a translucent band over two painted faces. The
     * layer is a copy of pixels the PLATE already paints, so moving it under the
     * actor group loses nothing and occludes nobody. */
    this.altar = img('set/church/altar.png', 'lyr');
    box(this.altar, ALTAR.x, ALTAR.y, ALTAR.w, ALTAR.h);
    root.insertBefore(this.altar, this.actors);

    /* ---- the hourglass, and the sand that runs out of it ------------- *
     * The sand is a gradient MASKED INTO THE GLASS's own alpha, so what falls
     * is the shape of the vessel it falls in. Drawn as a bare box it was a pale
     * rectangle lying across the altar ornament — an artifact, not sand. */
    this.glass = img('set/church/hourglass.png', 'lyr');
    box(this.glass, GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    this.sand = el('div', 'emis', root);
    box(this.sand, GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    this.sand.style.opacity = '0';
    /* the two bulbs, clipped to the shape the sprite actually paints. The
       sprite's own alpha cannot do this: `hourglass.png` is a rectangular
       RESTORE of the plate (altar wood and all), so masking to it masks
       nothing, which is how the sand came to be a pale bar lying across the
       altar. The polygons are the glass's own outline read off the sprite:
       body x 22..40 of 52, waist at y 37, glass y 22..52 of 64. */
    this.bulbTop = el('div', 'lyr', this.sand);
    this.bulbBot = el('div', 'lyr', this.sand);
    box(this.bulbTop, 0, 0, GLASS.w, GLASS.h);
    box(this.bulbBot, 0, 0, GLASS.w, GLASS.h);
    this.bulbTop.style.clipPath = 'polygon(42.3% 34.4%, 76.9% 34.4%, 59.6% 57.8%)';
    this.bulbBot.style.clipPath = 'polygon(59.6% 57.8%, 76.9% 81.2%, 42.3% 81.2%)';

    /* ---- THE RING AND THE SOVEREIGN ARE PICTURES NOW ---------------- *
     * 7.2 #13 shipped neither, so fact M.4 had no carrier at all and fact M.6
     * had a 26 px radial gradient. Both are props on the locked template now
     * (lanechurch/jobs-props.json -> ship_props.py). The coin's third holder
     * needed a picture too: the witness's cut paints no watch chain, so leg 2
     * of the journey arrived nowhere. Each prop carries a small screen-blend
     * glint behind it — gold at a candle is a catch of light, and a flat cut-out
     * of gold on a dim plate is a sticker. */
    this.band = img('set/church/ring.png', 'lyr');
    this.bandGlint = el('div', 'emis', root);
    this.coin = img('set/church/sovereign.png', 'lyr');
    this.coinGlint = el('div', 'emis', root);
    this.chain = img('set/church/watch-chain.png', 'lyr');
    for (const e of [this.band, this.bandGlint, this.coin, this.coinGlint, this.chain]) {
      e.style.opacity = '0';
    }
    for (const g of [this.bandGlint, this.coinGlint]) {
      g.style.background =
        'radial-gradient(circle at 50% 50%,rgba(255,246,214,.85) 0%,' +
        'rgba(255,214,132,.42) 34%,rgba(255,190,96,0) 72%)';
    }

    this.reset();
  }

  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      holmes: { x: MARK.back, pose: 'stand', walking: null, from: 0, to: 0,
                t0: -1e9, dur: 1 },
      norton: { x: MARK.nortonHome, pose: 'stand', t0: -1e9, dur: 1,
                from: MARK.nortonHome, to: MARK.nortonHome, next: null },
      seg: null, segT0: 0, segDur: 0,
      glass: -1e9, ringT: -1e9, coinT: -1e9,
    };
  }

  focusPlate(name) { return FOCUS[name] || FOCUS.nave; }
  camOverride() { return null; }

  targetPlate(name) {
    if (name !== 'norton') return null;
    const N = this.state.norton;
    const h = 1.80 * PX_PER_M;
    return [N.x, floorAt(N.x) - h * 0.62];
  }

  /* the gate is on THE MAN HIMSELF, and he is only reachable once he has come
     down the aisle to the witness — which is the seg the unit before it ran */
  targetLive(name) {
    return name === 'norton' && this.state.norton.x < MARK.nortonHome - 60;
  }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const at = this.targetPlate(name);
    return Math.hypot(p.x - at[0], p.y - at[1]) <= 96;
  }

  headPlate(who) {
    const h = 1.87 * PX_PER_M;
    if (who === 'HOLMES') {
      const H = this.state.holmes;
      return [H.x, floorAt(H.x) - h * 0.88];
    }
    if (who === 'GODFREY NORTON') {
      const N = this.state.norton;
      return [N.x, floorAt(N.x) - 1.80 * PX_PER_M * 0.88];
    }
    return null;
  }

  holdAnchor() { return null; }

  /**
   * `settled` = this act is being REPLAYED, and the reader is not going to sit
   * through the 2.6 s it takes: leave the world at the END of the act. Every
   * pantomime on this leaf is a walk or a scrub, so settling means putting the
   * figures on their finished marks and dating the scrubs far enough back that
   * they have already run.
   */
  fire(act, settled = false) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
        S.holmes.x = MARK.back; S.holmes.pose = 'stand'; S.holmes.walking = null;
        S.norton.x = MARK.nortonHome; S.norton.pose = 'stand';
        S.norton.walking = null; S.norton.next = null;
        S.glass = -1e9; S.ringT = -1e9; S.coinT = -1e9;
        break;
      case 'glassStart': S.glass = settled ? t - GLASS_RUN : t; break;
      case 'ringScrub': S.ringT = settled ? t - SCRUB : t; break;
      case 'sovereignScrub': S.coinT = settled ? t - SCRUB : t; break;
      case 'dragToAltar':
        if (settled) {
          S.holmes.x = MARK.altar; S.holmes.pose = 'altar'; S.holmes.walking = null;
          S.norton.x = MARK.nortonHome; S.norton.pose = 'stand';
          S.norton.walking = null; S.norton.next = null;
          break;
        }
        /* the click ANSWERS him, and being answered is what drags Holmes to the
           altar — so the gate's own act starts the walk the next unit narrates */
        this.walk(S.holmes, S.holmes.x, MARK.altar, 2.6, t);
        S.holmes.pose = 'walk';
        /* AND NORTON DOES THE DRAGGING. He used to teleport home on this frame,
           which left canon l.663 — cut from the text because "the sub-beat
           performs it" — performed by nobody: the witness strolled up an empty
           aisle on his own. He goes ahead of Holmes to `nortonDrag` at the same
           speed, so the two move as one, and hands back to his painted self
           later, off-frame (see startSeg('drag')). */
        this.walk(S.norton, S.norton.x, MARK.nortonDrag, 2.6, t);
        S.norton.pose = 'run';
        S.norton.next = 'home';     // …and then back to his own painted self
        break;
      default: break;
    }
  }

  walk(who, from, to, dur, t) {
    who.from = from; who.to = to; who.t0 = t; who.dur = dur; who.walking = true;
  }

  /** the three segments this SET performs: lounge, run, drag */
  startSeg(name, dur, t) {
    const S = this.state;
    S.seg = name; S.segT0 = t; S.segDur = dur;
    if (name === 'lounge') {
      this.walk(S.holmes, MARK.back, MARK.lounged, dur * 0.82, t);
      S.holmes.pose = 'walk';
    } else if (name === 'run') {
      this.walk(S.norton, MARK.nortonHome, MARK.nortonMet, dur * 0.55, t);
      S.norton.pose = 'run';
    } else if (name === 'drag') {
      if (S.holmes.x < MARK.altar - 4) {
        this.walk(S.holmes, S.holmes.x, MARK.altar, dur * 0.7, t);
        S.holmes.pose = 'walk';
      }
      /* Norton is not touched here. His hand-back runs off his own ARRIVAL
         (see step()), not off this segment's clock, because the reader paces
         the gate that started him and a segment that re-issued his walk would
         cancel the drag the moment the page advanced. */
    }
  }

  waitDone(name) {
    const S = this.state;
    if (name === 'ring') return S.ringT > -1e8 && S.t - S.ringT >= SCRUB;
    if (name === 'sovereign') return S.coinT > -1e8 && S.t - S.coinT >= SCRUB;
    return true;
  }

  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    this.dim.style.opacity = ctx.dim.toFixed(3);

    breathe(this.emis, EMIS, t, amb);

    /* the RING: the painted gold catch on the joined hands, scrubbed up. This
       is a plate VARIANT, not a filter — the church lane painted the moment. */
    const rk = S.ringT > -1e8 ? clamp01((t - S.ringT) / SCRUB) : 0;
    this.ring.style.opacity = easeInOut(rk).toFixed(3);
    /* and the pews in front of the actors warm with it, or the one strip of the
       frame that is not the ring plate stays cold while the knot lifts */
    this.pewsRing.style.opacity = easeInOut(rk).toFixed(3);

    /* THE TWO WHO NEVER MOVE, on the plate's own foot marks. They are painted
       every frame and they are never hidden: the marriage has four participants
       and the reader can see all four, in one register, for the whole beat. */
    placeSprite(this.bride, ART.bride, FEET.bride, 1.68 * PX_PER_M);
    placeSprite(this.clergy, ART.clergyman, FEET.clergyman, 1.75 * PX_PER_M);

    this.stepFigure(S.holmes, t, 1.87, {
      stand: this.holmes, altar: this.holmesAltar, walk: this.holmesWalk,
    }, ART.holmesWalk, ART.holmes, false);
    this.stepFigure(S.norton, t, 1.80, {
      stand: this.norton, beck: this.nortonBeck, run: this.nortonRun,
    }, ART.nortonRun, ART.norton, true);

    /* and NOW the four are re-stacked on the marks they are actually standing on
       this frame, because a depth order written down in the constructor is only
       ever right for one of the two stagings this beat holds (F5) */
    this.sortActors();

    /* THE HAND-BACK, driven by arrival: the man who dragged the witness to the
       altar walks on to his own place — which is a MARK now, not a painting.
       The plate used to hold a second Norton at 832 and the sprite was hidden
       the instant he stood on it; there was only ever one of him in frame, but
       there were two of him in the book, and the review saw both. Now the mark
       is his and the walk simply ends on it. */
    if (S.norton.next === 'home' && !S.norton.walking) {
      S.norton.next = null;
      this.walk(S.norton, S.norton.x, MARK.nortonHome, 2.2, t);
      S.norton.pose = 'run';
    }

    this.stepGlass(t, amb);
    this.stepRing(t);
    this.stepCoin(t);
    if (S.seg && t - S.segT0 >= S.segDur) S.seg = null;
  }

  /** THE PAINTER'S ORDER IS THE DEPTH ORDER (F5), decided every frame off the
   *  marks the four are standing on right now: lower on the plate is nearer the
   *  camera, so the group is appended in ascending mark y and the nearest figure
   *  is painted last. The two who never move contribute their measured points;
   *  the two who walk contribute floorAt(x), so their depth follows their feet.
   *
   *  It only touches the DOM when the order actually changes — which on this leaf
   *  is twice: once as Norton runs down past the witness, and once as the witness
   *  is dragged up the chancel past the bride. The rest of the beat it is a
   *  four-element compare. Ties keep the cast's own order, because `sort` is
   *  stable, so two figures on the same mark cannot flicker against each other. */
  sortActors() {
    const S = this.state;
    const y = { witness: floorAt(S.holmes.x), groom: floorAt(S.norton.x),
                bride: FEET.bride[1], clergyman: FEET.clergyman[1] };
    const want = [];
    for (const c of this.cast.slice().sort((a, b) => y[a.who] - y[b.who])) {
      for (const n of c.nodes) want.push(n);
    }
    const kids = this.actors.children;
    let same = kids.length === want.length;
    for (let i = 0; same && i < want.length; i++) if (kids[i] !== want[i]) same = false;
    if (same) return;
    for (const n of want) this.actors.appendChild(n);
  }

  /** one figure: a mark on the aisle line, a pose, and a strip while it moves */
  stepFigure(F, t, heightM, nodes, strip, still, isNorton) {
    const h = heightM * PX_PER_M;
    if (F.walking) {
      const k = clamp01((t - F.t0) / F.dur);
      F.x = lerp(F.from, F.to, easeInOut(k));
      if (k >= 1) {
        F.walking = null; F.x = F.to;
        /* he arrives, and the pose the arrival earns is struck on the same
           frame: Norton beckons where he stops, Holmes bows his head at the
           altar and simply stands anywhere else. */
        F.pose = isNorton ? (F.to === MARK.nortonHome ? 'stand' : 'beck')
                          : (F.to === MARK.altar ? 'altar' : 'stand');
      }
    }
    const at = [F.x, floorAt(F.x)];
    const moving = !!F.walking;
    for (const [k, node] of Object.entries(nodes)) {
      const live = moving ? (k === 'walk' || k === 'run') : (k === F.pose);
      node.style.opacity = live ? '1' : '0';
      if (!live) continue;
      if (k === 'walk' || k === 'run') {
        const travelled = Math.abs(F.x - F.from);
        const frame = Math.floor(travelled / (isNorton ? 34 : 26)) % strip.frames;
        // the strips face the viewer's RIGHT; going the other way, mirror
        placeSprite(node, strip, at, h, { frame, flip: F.to < F.from });
      } else {
        placeSprite(node, still, at, h);
      }
    }
  }

  /* the altar's own hourglass: the three minutes run out under the drag.
     The sand is the element's gradient seen THROUGH the hourglass's own alpha
     mask, so the upper bulb's surface falls and the lower bulb's rises inside
     the glass instead of over it. */
  stepGlass(t, amb) {
    const S = this.state;
    if (S.glass < -1e8) { this.sand.style.opacity = '0'; return; }
    const k = clamp01((t - S.glass) / GLASS_RUN);
    const G = 'rgba(255,206,126,.90)', N = 'rgba(255,206,126,0)';
    /* the upper bulb's surface falls from its shoulder to the waist; the lower
       one fills from its floor up. Both are levels inside a clipped triangle,
       so what the reader sees is sand-shaped by the glass. */
    const top = 34.4 + 23.4 * k;
    const bot = 81.2 - 23.4 * k;
    this.bulbTop.style.background =
      `linear-gradient(180deg,${N} 0%,${N} ${top.toFixed(1)}%,${G} ${top.toFixed(1)}%,${G} 100%)`;
    this.bulbBot.style.background =
      `linear-gradient(180deg,${N} 0%,${N} ${bot.toFixed(1)}%,${G} ${bot.toFixed(1)}%,${G} 100%)`;
    this.sand.style.opacity =
      (0.92 * (1 + amb * 0.06 * Math.sin(2 * Math.PI * t / 1.7))).toFixed(3);
  }

  /** the coin's three holders, in plate px — the shape of fact M.6 */
  coinMarks() {
    const x = this.state.holmes.x, f = floorAt(x), h = 1.87 * PX_PER_M;
    return {
      /* HER OWN HAND, and it is her ACTOR's hand now. It used to be an offset
         into the painted bride's box; she is a cut-out standing on a mark, so
         the coin leaves the same point the ring goes onto — the joined hands. */
      bride:   [HANDS[0], HANDS[1]],
      witness: [x + 30, f - h * 0.53],                           // his open palm
      chain:   [x + 8, f - h * 0.42],                            // his waistcoat
    };
  }

  /* THE SOVEREIGN: bride -> witness -> watch chain, three holders, and now
     three PLACES. The old marks put leg 1 at 31 px and leg 2 at 22 px — a 53 px
     journey on a 1408 px plate, which reads as a smudge that never went
     anywhere. Off the witness's real mark the legs are 92 px and 24 px, the
     lens is composed on them, and the chain he means to wear it on comes up
     under it as it lands. */
  stepCoin(t) {
    const S = this.state;
    if (S.coinT < -1e8) {
      for (const e of [this.coin, this.coinGlint, this.chain]) e.style.opacity = '0';
      return;
    }
    const k = clamp01((t - S.coinT) / SCRUB);
    const M = this.coinMarks();
    const leg = k < 0.55 ? [M.bride, M.witness, k / 0.55, 16]
                         : [M.witness, M.chain, (k - 0.55) / 0.45, 7];
    const e = easeInOut(clamp01(leg[2]));
    const x = lerp(leg[0][0], leg[1][0], e);
    const y = lerp(leg[0][1], leg[1][1], e) - Math.sin(Math.PI * clamp01(leg[2])) * leg[3];

    const w = PROP.coin.w, h = w * (PROP.coin.size[1] / PROP.coin.size[0]);
    box(this.coin, x - w / 2, y - h / 2, w, h);
    this.coin.style.opacity = clamp01(k * 6).toFixed(3);
    const gr = w * 1.9;
    box(this.coinGlint, x - gr, y - gr, gr * 2, gr * 2);
    this.coinGlint.style.opacity = (clamp01(k * 6) * 0.85).toFixed(3);

    /* the chain arrives with the coin's last leg — it is where the coin is
       going, so it is on screen before the coin gets there */
    const cw = PROP.chain.w, ch = cw * (PROP.chain.size[1] / PROP.chain.size[0]);
    box(this.chain, M.chain[0] - cw * 0.5, M.chain[1] - ch * 0.42, cw, ch);
    this.chain.style.opacity = easeOut(clamp01((k - 0.42) / 0.28)).toFixed(3);
  }

  /* THE RING. The plate variant `church-ring.jpg` stays — it is a candlelight
     lift on the knot, which is a true thing for the moment — but it is not a
     ring, and fact M.4 is the ring. So the band is a picture, staged on the
     joined hands: it seats over the first half of the scrub and the catch of
     light peaks as it goes home. */
  stepRing(t) {
    const S = this.state;
    if (S.ringT < -1e8) {
      this.band.style.opacity = '0'; this.bandGlint.style.opacity = '0';
      return;
    }
    const k = clamp01((t - S.ringT) / SCRUB);
    const w = PROP.ring.w, h = w * (PROP.ring.size[1] / PROP.ring.size[0]);
    const rise = (1 - easeOut(clamp01(k / 0.55))) * 10;
    box(this.band, HANDS[0] - w / 2, HANDS[1] - h / 2 - rise, w, h);
    this.band.style.opacity = clamp01(k * 4).toFixed(3);
    const gr = w * 2.1;
    box(this.bandGlint, HANDS[0] - gr, HANDS[1] - rise - gr, gr * 2, gr * 2);
    this.bandGlint.style.opacity =
      (0.22 + 0.78 * Math.max(0, Math.sin(Math.PI * clamp01((k - 0.3) / 0.7)))).toFixed(3);
  }

  snapshot() {
    const S = this.state;
    const h = 1.87 * PX_PER_M;
    return {
      holmes: { x: +S.holmes.x.toFixed(1), pose: S.holmes.pose,
                walking: !!S.holmes.walking,
                footY: +floorAt(S.holmes.x).toFixed(1) },
      norton: { x: +S.norton.x.toFixed(1), pose: S.norton.pose,
                walking: !!S.norton.walking, reachable: this.targetLive('norton') },
      seg: S.seg,
      ring: S.ringT > -1e8 ? +clamp01((S.t - S.ringT) / SCRUB).toFixed(3) : 0,
      sovereign: S.coinT > -1e8 ? +clamp01((S.t - S.coinT) / SCRUB).toFixed(3) : 0,
      glass: S.glass > -1e8 ? +clamp01((S.t - S.glass) / GLASS_RUN).toFixed(3) : 0,
      /* THE RING LENS CONTRACT, MEASURED. These were three hardcoded literals,
         which meant the lens certified itself: the verifier could not catch a
         wrong ring lens because the set simply asserted the right answer. Now
         every number is computed from the plate lane's own figure boxes and the
         lens actually in force, plus the two things the contract is really
         about — is the RING inside the frame, and how big is it. */
      ringLens: (() => {
        const k = FOCUS.ring[2], fh = PLATE.h / k, fw = PLATE.w / k;
        const pct = (b) => +(((b[3] - b[1]) * 100) / fh).toFixed(1);
        const c = [FOCUS.ring[0] - fw / 2, FOCUS.ring[1] - fh / 2,
                   FOCUS.ring[0] + fw / 2, FOCUS.ring[1] + fh / 2];
        /* the three who perform the marriage are ACTORS now, so their share of
           the frame is their drawn height and not a box read off a painting */
        const drawn = { bride: 1.68, groom: 1.80, clergyman: 1.75 };
        const share = (m) => +((drawn[m] * PX_PER_M * 100) / fh).toFixed(1);
        return { k, bride: share('bride'), clergyman: share('clergyman'),
                 groom: share('groom'),
                 ringPx: +(PROP.ring.w * k).toFixed(1),
                 ringIn: HANDS[0] > c[0] && HANDS[0] < c[2] &&
                         HANDS[1] > c[1] && HANDS[1] < c[3],
                 /* the void test the landscape lap does not have: how much of
                    the frame falls outside the church's painted content */
                 voidPct: +((Math.max(0, 266 - c[0]) + Math.max(0, c[2] - 1134))
                            * 100 / fw).toFixed(1) };
      })(),
      /* THE REGISTER LEDGER (F4). Every participant in the marriage, whether it
         is a cut-out and where its feet are. A lap can now fail on "the bride is
         still in the plate" instead of only on a missing file: `cutout` is read
         off the live DOM, so a mannequin that came back in a plate variant shows
         up as a participant with no cut-out on its mark. */
      cast: (() => {
        const on = (n) => !!n && +(n.style.opacity || 1) > 0.01;
        const at = (n) => {
          const l = parseFloat(n.style.left), t = parseFloat(n.style.top);
          const w = parseFloat(n.style.width), hh = parseFloat(n.style.height);
          return [+(l + w / 2).toFixed(1), +(t + hh).toFixed(1),
                  +w.toFixed(1), +hh.toFixed(1)];
        };
        /* WHICH CUT IS ACTUALLY ON SCREEN, and the geometry a probe needs to
           check the BITMAP against the mark [F5]. `cutout: true` only says a
           node is painted; it cannot say the painted thing's feet are where the
           set thinks they are, because that depends on the file's own bottom
           padding. So every live participant reports the cut it is drawing, its
           cell, its DECLARED baseline row and its drawn box — and the lap
           decodes the file, finds the last row the cut really paints, and asks
           whether that row lands on the mark. A cut regenerated with 20 px of
           new transparent hem floats every actor in the marriage and leaves
           every mark legal; this is the only thing that sees it.

           `left`/`width` are the DRAWN box, not a re-derivation of it, because
           the sole-span law [F5] is asked per COLUMN of the cut: a mark is a
           point and a pair of boots is 54 plate px wide, so the probe has to
           know where the cut's own left edge landed to find the pixel each sole
           column is standing on.

           `z` is the live node's OWN INDEX in the actor group, read off the DOM
           and not restated from the constructor, so the painter's order cannot be
           described to the lap differently from the way it ships. It is what lets
           the composite law say WHICH layer a sole is standing on: front to back
           is descending z. */
        const kids = Array.prototype.slice.call(this.actors.children);
        const drawing = (pairs) => {
          for (const [node, art] of pairs) {
            if (!on(node)) continue;
            const t = parseFloat(node.style.top), hh = parseFloat(node.style.height);
            const l = parseFloat(node.style.left), w = parseFloat(node.style.width);
            return { file: art.file, cellH: art.cell ? art.cell[1] : art.size[1],
                     baseline: art.baseline, frames: art.frames || 1,
                     cellW: art.cell ? art.cell[0] : art.size[0],
                     top: +t.toFixed(2), height: +hh.toFixed(2),
                     left: +l.toFixed(2), width: +w.toFixed(2),
                     z: kids.indexOf(node) };
          }
          return null;
        };
        const hx = S.holmes.x;
        return {
          bride:     { cutout: on(this.bride), mark: FEET.bride, box: at(this.bride),
                       art: drawing([[this.bride, ART.bride]]) },
          clergyman: { cutout: on(this.clergy), mark: FEET.clergyman,
                       box: at(this.clergy),
                       art: drawing([[this.clergy, ART.clergyman]]) },
          groom:     { cutout: on(this.norton) || on(this.nortonBeck) ||
                               on(this.nortonRun),
                       mark: [+S.norton.x.toFixed(1), +floorAt(S.norton.x).toFixed(1)],
                       home: FEET.groom, walking: !!S.norton.walking,
                       art: drawing([[this.norton, ART.norton],
                                     [this.nortonBeck, ART.nortonBeck],
                                     [this.nortonRun, ART.nortonRun]]) },
          witness:   { cutout: on(this.holmes) || on(this.holmesAltar) ||
                               on(this.holmesWalk),
                       mark: [+hx.toFixed(1), +floorAt(hx).toFixed(1)],
                       walking: !!S.holmes.walking,
                       /* THE FRAME THE READER IS LOOKING AT IS A MARRIAGE the
                          moment he stands on the altar mark, whatever the lens
                          is called — the [F4] in-frame law keys on this and not
                          on the lens's name, or a wrong lens exempts itself. */
                       atAltar: Math.abs(hx - MARK.altar) < 4 && !S.holmes.walking,
                       art: drawing([[this.holmes, ART.holmes],
                                     [this.holmesAltar, ART.holmesAltar],
                                     [this.holmesWalk, ART.holmesWalk]]) },
        };
      })(),
      /* THE FLOOR, so a lap can probe the shipped plate at every mark instead of
         trusting a constant (F5). Marks are (x, floorAt(x)) — the y the set will
         actually stand a pair of boots on — and `pews` is the box of the layer
         that is allowed to be the answer instead: a foot is honest if the plate
         under it is floor OR the pew cut covers it. The lap reads both. */
      floor: {
        polyline: FLOOR,
        marks: Object.fromEntries(['back', 'lounged', 'altar', 'nortonMet',
                                   'nortonDrag', 'nortonHome']
          .map((m) => [m, [MARK[m], +floorAt(MARK[m]).toFixed(1)]])),
        feet: FEET,
        pews: { ...PEWS, on: +(this.pews.style.opacity || 1) > 0.01,
                ring: +(this.pewsRing.style.opacity || 0),
                /* the files the lap has to probe to answer the F5 law: the plate
                   under a foot, and the layers allowed to hide it. BOTH cuts are
                   named, because a foot is only honestly hidden if it is hidden
                   in the variant the reader is looking at too — the ring plate
                   carries the whole of fact M.4, and an occluder that lost the
                   pew end in the warm copy would float the marriage for exactly
                   the units the review filed. */
                plate: 'assets/set/church/church.jpg',
                cut: 'assets/set/church/pews-front.png',
                cutRing: 'assets/set/church/pews-front-ring.png' },
        /* how much of each cut MUST be hidden if its mark is not on floor —
           the F5 law's right-hand side, per actor (tools/lanecf/foot_sink.py) */
        footwear: FOOTWEAR,
        /* every live figure's own foot point this frame, so the probe does not
           have to re-derive the walk: [x, y] in plate px */
        live: { witness: [+S.holmes.x.toFixed(1), +floorAt(S.holmes.x).toFixed(1)],
                groom: [+S.norton.x.toFixed(1), +floorAt(S.norton.x).toFixed(1)],
                bride: FEET.bride, clergyman: FEET.clergyman },
      },
      /* what the two facts' carriers are actually doing, so a lap can fail on
         a fact with no picture instead of on a missing file. `*ScreenPx` is the
         object's own rendered width in device pixels at the lens in force — the
         number the review actually measured off the captured frame. */
      props: {
        band: +(+this.band.style.opacity || 0).toFixed(2),
        coin: +(+this.coin.style.opacity || 0).toFixed(2),
        chain: +(+this.chain.style.opacity || 0).toFixed(2),
        ringPlatePx: PROP.ring.w,
        coinPlatePx: PROP.coin.w,
        coinLensK: FOCUS.coin[2],
        coinTravel: +(Math.hypot(this.coinMarks().bride[0] - this.coinMarks().witness[0],
                                this.coinMarks().bride[1] - this.coinMarks().witness[1]) +
                      Math.hypot(this.coinMarks().witness[0] - this.coinMarks().chain[0],
                                 this.coinMarks().witness[1] - this.coinMarks().chain[1]))
                     .toFixed(1),
        coinMarks: this.coinMarks(),
      },
    };
  }
}

export { FIGURES, FEET, FLOOR, FOCUS, DIM_MATRIX, PX_PER_M, MARK, floorAt };
