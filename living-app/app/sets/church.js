/**
 * sets/church.js — St Monica's, Edgware Road. Leaf 4, Beat IV.
 *
 * The plate paints its own REST STATE: the three in a knot in front of the
 * altar, which is fact M.1 and is why unit 2 needs no staging at all. What the
 * beat then has to do is take ONE of those three out of the painting and let
 * him run — Norton, who charges down the aisle at the witness and beckons.
 *
 * THE PAINTED GROOM IS NORTON, AND THE SPRITE ONLY EXISTS WHILE HE IS AWAY.
 *
 * Beat I's answer to a figure that must move is the hole-patch: inpaint him
 * out of the plate, lay the hole over him, drive a cut-out. That was tried
 * here first and REJECTED on the art: the shipped `knot-patch.png` is a
 * harmonic blur, not a clean inpaint, and clipped over the groom's box it puts
 * a grey smear in the middle of the chancel (proof: /tmp/gl-engine/knot-patch.png).
 *
 * So this set never lifts him. The painted groom carries units 0-3 and 8-16 —
 * he is exactly right there, and it is the plate's own rest state, which is
 * fact M.1. The SPRITE is shown only between them, while he is off his mark
 * running at the witness, and the aisle lens is composed so his painted self
 * is outside the frame for every one of those units. Nothing in the picture is
 * ever doubled, and no smear is ever shown.
 *
 * The bride and the clergyman never move, so they stay painted throughout; the
 * clergyman has no shipped cut (7.2 #6) and needs none.
 *
 * THE TWO CLOSE LENSES ARE CONTRACT FACTS, and they are the plate lane's
 * measurements, not choices: at the ring lens the three who perform the
 * marriage read 24.0 / 23.7 / 17.3 % of frame height at k=1.00, and k=1.13
 * lands the bride exactly on the reference's own 27.2.
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, placeSprite,
         emissives, breathe } from '../setkit.js';

/* the church lane's own handoff: where its painted figures stand */
const FIGURES = {
  bride:     [688, 344, 792, 528],
  groom:     [790, 372, 875, 505],
  clergyman: [848, 328, 925, 510],
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
   the bride's right hand meets the groom's, read off the plate between her box
   (688..792) and his (790..875). The ring lens is centred on it and the band is
   staged on it. */
const HANDS = [786, 440];

const FOCUS = {
  nave:  [704, 384, 1.00],
  /* THE AISLE LENS IS COMPOSED, NOT CROPPED, and it is solved rather than
     chosen. Two constraints, both hard:
       right edge < 790 — while Norton's sprite is running at the witness, his
                          own painted self (box x 790..875) must be OUT of the
                          frame, or the picture holds two of him.
       left edge  > 261 — the church shell starts there and the plate is a
                          diorama floating in navy; a lens that reaches past it
                          spends a third of the frame on empty void (measured:
                          k=2.20 on centre 440 did exactly that).
     c ± 704/k inside (261, 790) has no solution below k = 2.66, so the lens
     takes 43 px of void on the left instead — 7.6% of the frame — at k=2.50 on
     centre 500: plate x 218..782, y 346..654. The witness stands with his feet
     on the aisle line at x 424..560 and his head at y 407, inside it all the
     way up. */
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
     for six units. Composed here on the joined hands at k 2.20: plate
     x 466..1106, y 259..608 — inside the church's painted content (266..1134)
     on every side, all three figures whole, and the band 29 CSS px across. */
  ring:  [HANDS[0], HANDS[1] - 6, 2.20],
  /* THE COIN LENS, composed on the JOURNEY and not on the altar. The old lens
     sat 210 px right of the coin and spent a quarter of the panel on backdrop.
     The three holders span x 648..762, so the frame is centred on their middle
     at k 2.70 (521 px wide): the journey crosses 22% of it. */
  coin:  [705, 452, 2.70],
};

/* the church lane's shipped relight. Blue MEASURES 1.035 on this plate — the
   relight preserves blue while killing red — and is clamped to 1.0 before it
   is used as an actor matrix, or a coefficient above 1 tints every cut-out
   blue instead of dimming it. */
const DIM_MATRIX = [0.435, 0.746, 1.0];
const PX_PER_M = 104.5;

const ART = {
  holmes:      { file: 'actor/holmes-church.png', size: [218, 586], baseline: 583.1 },
  holmesAltar: { file: 'actor/holmes-church-altar.png', size: [218, 586], baseline: 583.1 },
  holmesWalk:  { file: 'actor/holmes-church-walk.png', size: [1192, 467],
                 cell: [298, 467], frames: 4, baseline: 461 },
  norton:      { file: 'actor/norton-groom.png', size: [195, 564], baseline: 561.1 },
  nortonBeck:  { file: 'actor/norton-beckon.png', size: [294, 564], baseline: 561.1 },
  nortonRun:   { file: 'actor/norton-run.png', size: [1412, 508],
                 cell: [353, 508], frames: 4, baseline: 502 },
};

/* THE AISLE FLOOR LINE. Not guessed: the reprise lane's own stage proof placed
   its cuts on this plate at (470, 590), (545, 568), (640, 548), (690, 532), and
   those four points are collinear to under a pixel. */
const AISLE = { x0: 470, y0: 590, slope: (532 - 590) / (690 - 470) };
const floorAt = (x) => AISLE.y0 + (x - AISLE.x0) * AISLE.slope;

const MARK = {
  back: 424,       // where the idler comes in at the foot of the side aisle
  lounged: 548,    // as far up the aisle as an idler goes
  /* AT THE ALTAR, AND CLEAR OF THE HANDS. 700 put the witness between the
     bride and the camera: his sprite spans 218 px * (195/586) = 72 px, so at
     700 he covered 664..736 — the left half of her box — and the cap he holds
     in both hands sat exactly over the joined hands the ring goes onto. At 640
     he stands 604..676, a man's width clear of her, on the same aisle line, and
     the ring lens has an unobstructed view of the fact it exists for. */
  altar: 640,
  nortonHome: 832, // his own painted box, centre
  nortonMet: 612,  // where he reaches the witness and beckons
  /* where Norton hauls the witness to before letting go of him: ahead of
     Holmes and still inside the aisle lens, so the hand-back to his painted
     self happens outside the frame (see fire('dragToAltar')) */
  nortonDrag: 672,
};

const SCRUB = 4.5;      // ringScrub / sovereignScrub, both 0->1 over 4.5 s
const GLASS_RUN = 11.0; // the three minutes on the altar's own hourglass

/* the props, in plate pixels. A wedding band is 2 cm and a sovereign 22 mm; at
   104.5 px/m that is two pixels, which is not an image of anything. Both are
   drawn at 13 px — the size at which the object is READABLE at its own lens
   (29 CSS px at the ring lens, 35 at the coin lens) and still small enough to
   sit in a hand. The chain is drawn at its true size: an albert's swag really
   is about 25 cm. */
const PROP = {
  ring:  { size: [128, 115], w: 13 },
  coin:  { size: [128, 114], w: 13 },
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

    /* ---- the actors ------------------------------------------------- */
    this.actors = el('div', 'actors', root);
    this.holmes = img(ART.holmes.file, 'lyr', this.actors);
    this.holmesAltar = img(ART.holmesAltar.file, 'lyr', this.actors);
    this.holmesWalk = el('div', 'lyr walk', this.actors);
    this.holmesWalk.style.backgroundImage = st.bitmap(ART.holmesWalk.file);
    this.norton = img(ART.norton.file, 'lyr', this.actors);
    this.nortonBeck = img(ART.nortonBeck.file, 'lyr', this.actors);
    this.nortonRun = el('div', 'lyr walk', this.actors);
    this.nortonRun.style.backgroundImage = st.bitmap(ART.nortonRun.file);
    for (const e of [this.holmesAltar, this.holmesWalk, this.nortonBeck, this.nortonRun]) {
      e.style.opacity = '0';
    }

    /* ---- the altar is a FOREGROUND cut: legs go behind it ------------ */
    this.altar = img('set/church/altar.png', 'lyr');
    box(this.altar, ALTAR.x, ALTAR.y, ALTAR.w, ALTAR.h);

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

    this.stepFigure(S.holmes, t, 1.87, {
      stand: this.holmes, altar: this.holmesAltar, walk: this.holmesWalk,
    }, ART.holmesWalk, ART.holmes, false);
    this.stepFigure(S.norton, t, 1.80, {
      stand: this.norton, beck: this.nortonBeck, run: this.nortonRun,
    }, ART.nortonRun, ART.norton, true);

    /* THE HAND-BACK, driven by arrival: the man who dragged the witness to the
       altar walks on to his own place, and his own place is the PAINTING. He
       crosses the aisle lens's right edge (782) while he is still a sprite and
       is put away at 832, where the plate has been holding him all along —
       so the swap happens outside the frame the reader is looking at. */
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
    /* NORTON HOME = NORTON PAINTED. The plate holds him at his own mark, so
       the sprite is put away the instant he is standing on it — there is never
       a frame with two of him in it. */
    const painted = isNorton && !moving && F.x >= MARK.nortonHome - 1;
    for (const [k, node] of Object.entries(nodes)) {
      const live = !painted && (moving ? (k === 'walk' || k === 'run') : (k === F.pose));
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
      bride:   [FIGURES.bride[0] + 74, FIGURES.bride[1] + 104],  // her own hand
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
        return { k, bride: pct(FIGURES.bride), clergyman: pct(FIGURES.clergyman),
                 groom: pct(FIGURES.groom),
                 ringPx: +(PROP.ring.w * k).toFixed(1),
                 ringIn: HANDS[0] > c[0] && HANDS[0] < c[2] &&
                         HANDS[1] > c[1] && HANDS[1] < c[3],
                 /* the void test the landscape lap does not have: how much of
                    the frame falls outside the church's painted content */
                 voidPct: +((Math.max(0, 266 - c[0]) + Math.max(0, c[2] - 1134))
                            * 100 / fw).toFixed(1) };
      })(),
      /* what the two facts' carriers are actually doing, so a lap can fail on
         a fact with no picture instead of on a missing file */
      props: {
        band: +(+this.band.style.opacity || 0).toFixed(2),
        coin: +(+this.coin.style.opacity || 0).toFixed(2),
        chain: +(+this.chain.style.opacity || 0).toFixed(2),
        coinTravel: +(this.coinMarks().bride[0] - this.coinMarks().chain[0]).toFixed(1),
      },
    };
  }
}

export { FIGURES, FOCUS, DIM_MATRIX, PX_PER_M, MARK, floorAt };
