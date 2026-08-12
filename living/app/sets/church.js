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
  /* MEASURED, not chosen — see the head of this file. */
  ring:  [782, 446, 1.13],
  coin:  [934, 402, 1.55],
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
  lounged: 560,    // as far up the aisle as an idler goes
  altar: 700,      // dragged to the altar
  nortonHome: 832, // his own painted box, centre
  nortonMet: 612,  // where he reaches the witness and beckons
};

const SCRUB = 4.5;      // ringScrub / sovereignScrub, both 0->1 over 4.5 s
const GLASS_RUN = 11.0; // the three minutes on the altar's own hourglass

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

    /* ---- the hourglass, and the sand that runs out of it ------------- */
    this.glass = img('set/church/hourglass.png', 'lyr');
    box(this.glass, GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    this.sand = el('div', 'emis', root);
    this.sand.style.opacity = '0';

    /* ---- the sovereign: three holders, and it is LIGHT -------------- *
     * 7.2 #13 ships no coin. What fact M.6 needs is the coin's JOURNEY —
     * bride, then witness, then watch chain — and a sovereign at a close lens
     * under candlelight is legible as its own catch of light. */
    this.coin = el('div', 'emis', root);
    this.coin.style.opacity = '0';

    this.reset();
  }

  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      holmes: { x: MARK.back, pose: 'stand', walking: null, from: 0, to: 0,
                t0: -1e9, dur: 1 },
      norton: { x: MARK.nortonHome, pose: 'stand', t0: -1e9, dur: 1,
                from: MARK.nortonHome, to: MARK.nortonHome },
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

  fire(act) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
        S.holmes.x = MARK.back; S.holmes.pose = 'stand'; S.holmes.walking = null;
        S.norton.x = MARK.nortonHome; S.norton.pose = 'stand';
        S.glass = -1e9; S.ringT = -1e9; S.coinT = -1e9;
        break;
      case 'glassStart': S.glass = t; break;
      case 'ringScrub': S.ringT = t; break;
      case 'sovereignScrub': S.coinT = t; break;
      case 'dragToAltar':
        /* the click ANSWERS him, and being answered is what drags Holmes to the
           altar — so the gate's own act starts the walk the next unit narrates */
        this.walk(S.holmes, S.holmes.x, MARK.altar, 2.6, t);
        S.holmes.pose = 'walk';
        /* Norton does NOT run back: he goes home to his own painted self, and
           the sprite is put away on the same frame. Walking him back would
           carry a cut-out across a frame that already contains him. */
        S.norton.x = MARK.nortonHome; S.norton.walking = null; S.norton.pose = 'stand';
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

    this.stepGlass(t, amb);
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

  /* the altar's own hourglass: the three minutes run out under the drag */
  stepGlass(t, amb) {
    const S = this.state;
    if (S.glass < -1e8) { this.sand.style.opacity = '0'; return; }
    const k = clamp01((t - S.glass) / GLASS_RUN);
    // the upper bulb empties into the lower one: a warm band that falls
    const top = GLASS.y + 6, half = GLASS.h * 0.42;
    box(this.sand, GLASS.x + 8, top + half * k, GLASS.w - 16, half * (1 - k) + 3);
    this.sand.style.background =
      'linear-gradient(180deg,rgba(255,214,140,.0) 0%,rgba(255,206,126,.85) 60%)';
    this.sand.style.opacity = (0.9 * (1 - 0.25 * k) *
      (1 + amb * 0.12 * Math.sin(2 * Math.PI * t / 1.7))).toFixed(3);
  }

  /* the sovereign: bride -> witness -> watch chain, three holders */
  stepCoin(t) {
    const S = this.state;
    if (S.coinT < -1e8) { this.coin.style.opacity = '0'; return; }
    const k = clamp01((t - S.coinT) / SCRUB);
    const bride = [FIGURES.bride[0] + 54, FIGURES.bride[1] + 108];
    const witness = [S.holmes.x + 22, floorAt(S.holmes.x) - 1.87 * PX_PER_M * 0.52];
    const chain = [S.holmes.x + 6, floorAt(S.holmes.x) - 1.87 * PX_PER_M * 0.44];
    const leg = k < 0.55 ? [bride, witness, k / 0.55] : [witness, chain, (k - 0.55) / 0.45];
    const e = easeInOut(clamp01(leg[2]));
    const x = lerp(leg[0][0], leg[1][0], e);
    const y = lerp(leg[0][1], leg[1][1], e) - Math.sin(Math.PI * clamp01(leg[2])) * 14;
    const r = 13;
    box(this.coin, x - r, y - r, r * 2, r * 2);
    this.coin.style.background =
      'radial-gradient(circle at 46% 42%,rgba(255,244,196,1) 0%,' +
      'rgba(246,196,88,.92) 42%,rgba(214,150,44,0) 74%)';
    this.coin.style.opacity = (0.35 + 0.65 * Math.min(1, k * 6)).toFixed(3);
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
      /* the ring lens contract, reported every frame it is asked for: the
         three who perform the marriage, as % of frame height (the plate lane's
         own measurement of its own painted figures). */
      ringLens: { bride: 24.0, clergyman: 23.7, groom: 17.3, k: FOCUS.ring[2] },
    };
  }
}

export { FIGURES, FOCUS, DIM_MATRIX, PX_PER_M, MARK, floorAt };
