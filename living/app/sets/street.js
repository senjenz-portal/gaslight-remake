/**
 * sets/street.js — Serpentine Avenue at Briony Lodge. Leaves 2 and 5.
 *
 * The one SET whose state machine actually matters: it carries 17 of the
 * book's units across three beats (II, V, VI) and the chapter's single most
 * important image — THE REVEAL, which is a silhouette BEHIND GLASS and not a
 * figure on the pavement.
 *
 * FIVE PAINTED STATES, not filters (CONTENT-full.md 6.2). Each is a repaint
 * shipped by the street lane and they cross-fade over one another:
 *     street          quiet night, NO smoke      II.0-2, V.0-5
 *     street-dim      the relight under an inset V.3-4
 *     street-window   the sitting-room window OPEN and lit   V.5 -> VI
 *     street-smoke    the ruse burning                       VI, from t+1.35
 *     street-empty    dispersed, the plume dying             VI, from t+8.6
 *
 * THE SMOKE GATE IS CLOSED ON ARRIVAL. The reference street module stands its
 * ruse plume UP in its authored rest state; this book does not ("the house on
 * fire right after you enter the scene is not the right way"), so `smokeClosed`
 * is a real act that a unit fires and the harness can see.
 *
 * Every mark below is the street lane's own life.json, transcribed: the gate
 * targets, the glass polygon, the chalk ring's two states, the floor polyline,
 * the emissive table, and the reveal box with the crossing the reference
 * measured (plate x 721 -> 786).
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, placeSprite,
         floorY, emissives, breathe } from '../setkit.js';

/* ---- life.json, transcribed -------------------------------------------- */
const FLOOR = [[400, 498], [478, 458], [560, 470], [640, 486], [700, 496],
               [760, 506], [830, 516], [900, 524]];

const EMIS = [
  { id: 'lamp',     at: [479, 318], r: 118, rgb: '255,196,96',  a: 0.155, per: 6.4, amp: 0.30 },
  { id: 'bay',      at: [753, 372], r: 92,  rgb: '255,186,96',  a: 0.13,  per: 5.2, amp: 0.28 },
  { id: 'fanlight', at: [880, 349], r: 28,  rgb: '255,206,126', a: 0.17,  per: 4.4, amp: 0.42 },
  { id: 'spill',    at: [745, 539], r: 96,  rgb: '255,178,104', a: 0.085, per: 7.1, amp: 0.34 },
  { id: 'wet',      at: [757, 588], r: 58,  rgb: '255,168,96',  a: 0.07,  per: 8.3, amp: 0.40 },
  /* the first-floor window: DARK in the base and dim states, and the channel
     the smoke state drives hot. It exists so the ruse has a light to turn ON
     rather than a light to invent. */
  { id: 'upper',    at: [759, 212], r: 44,  rgb: '255,150,80',  a: 0.34,  per: 3.1, amp: 0.55,
    gain: 0 },
];

const CHALK = {
  armed:  { file: 'chalk-armed.png',  x: 466, y: 406, w: 154, h: 180 },
  locked: { file: 'chalk-locked.png', x: 483, y: 426, w: 120, h: 140 },
};

const TARGETS = {
  /* the reference anchors this target on `story-irene` herself — she stands
     behind that glass — so THE TARGET IS THE REVEAL SURFACE. */
  window:  { at: [763, 373], r: 60,
             poly: [[696, 326], [722, 316], [766, 312], [808, 322],
                    [808, 430], [766, 436], [722, 430], [696, 422]] },
  station: { at: [543, 497], r: 46 },
};

const REVEAL = { box: [698, 318, 806, 430], crossX: [721, 786], pxPerMetre: 53.3,
                 feetY: 424 };
const PLUME = { at: [759, 212], box: [727, 168, 790, 262] };

const FOCUS = {
  street:         [704, 384, 1.00],
  /* "the whole front" — the establishing lens. The villa band is x630..1035,
     so its centre is 832; k is the widest push that still crops nothing of the
     roofline the plate lane composed sky above. */
  villa:          [842, 372, 1.16],
  'holmes-street': [590, 452, 1.52],
  plan:           [648, 440, 1.34],
  station:        [560, 470, 1.46],
  window:         [763, 373, 1.62],
  /* THE REVEAL. The tightest frame that still holds the whole bay: the glass
     is 108 px wide and 112 tall, and a 1.68 m woman inside it reads 90 px. */
  reveal:         [757, 366, 1.92],
};

/* the street lane's shipped relight, measured the way Beat I's was. Applied to
   the ACTORS too when the world dims, or a cut-out reads as a collage. */
const DIM_MATRIX = [0.725, 0.868, 0.962];

/* the scale law: 49.4 px/m, from the front door (100 px for 2.03 m) and the
   area railings (55 px for 1.11 m), which is the reprise lane's cross-checked
   number. tools/living/prep_book.py carries the same table. */
const PX_PER_M = 49.4;
const ART = {
  holmes:  { file: 'actor/holmes-street.png', size: [110, 277], baseline: 274.4 },
  signal:  { file: 'actor/holmes-street-signal.png', size: [110, 277], baseline: 274.4 },
  irene:   { file: 'actor/irene-street.png', size: [98, 249], baseline: 247.8 },
};

/* THE BEAT VI CLOCK (sec 6.6). t is seconds past the instant the reader's
   `window` gate resolved. Reproduced exactly; the lines are timed to the
   camera work, not the other way round. */
const RUSE = {
  fly: [0.45, 1.35],       // the rocket is in the air
  flash: 1.35,             // the instant the house starts smoking
  plumeIn: 0.45,           // the plume builds over this
  camReveal: 1.50,         // the camera lifts onto the composed REVEAL pose
  camDur: 1.70,
  reveal: 2.05,            // THE REVEAL fires, 7.6 s long
  bright: [0.0, 0.5],      //   the room behind the glass brightens
  cross: [0.35, 1.95],     //   she crosses to the panel side
  hand: [1.95, 2.45],      //   her hand goes up to the panel
  pause: [2.45, 5.10],     //   SHE PAUSES — this is the image
  withdraw: [5.6, 6.9],
  lightDown: [6.6, 7.6],
  full: 4.20,              // plumes at full rate
  disperse: 8.60,
  camBack: 16.60,          // the camera returns to the street's composed pose
  camBackDur: 2.80,
  turn: 19.80,             // the page turns
};

export class StreetSet {
  static id = 'street';
  static insets = { rocket: 'inset/rocket-plate.jpg' };
  static beds = ['street'];

  constructor(root, st) {
    this.st = st;
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);

    /* ---- the five painted states ---------------------------------- */
    this.base = img('set/street/street.jpg', 'lyr plate');
    this.win = img('set/street/street-window.jpg', 'lyr plate');
    this.smoke = img('set/street/street-smoke.jpg', 'lyr plate');
    this.empty = img('set/street/street-empty.jpg', 'lyr plate');
    this.dim = img('set/street/street-dim.jpg', 'lyr plate');
    for (const e of [this.base, this.win, this.smoke, this.empty, this.dim]) {
      box(e, 0, 0, PLATE.w, PLATE.h);
      if (e !== this.base) e.style.opacity = '0';
    }

    /* ---- the light the plate already paints, breathing ------------- */
    this.emis = emissives(EMIS, root);

    /* ---- the chalk ring: three states, and the absence IS the third - */
    this.chalk = {};
    for (const k of ['armed', 'locked']) {
      const c = CHALK[k];
      const e = img('set/street/' + c.file, 'lyr');
      box(e, c.x, c.y, c.w, c.h);
      e.style.opacity = '0';
      this.chalk[k] = e;
    }

    /* ---- THE REVEAL, in three layers ------------------------------- *
     * The stack behind that pane is exactly: room light, HER, glass. Anything
     * else and she reads as a sticker on a window.
     *
     * The backlight is drawn OUTSIDE the actor group even though it belongs to
     * the same moment: `.actors` is `isolation: isolate` so the relight matrix
     * lands on the cut-outs alone, and a screen blend inside an isolated group
     * composites against that group's transparent backdrop rather than against
     * the painting — which turns a pane of light into a black rectangle. */
    this.revealBack = img('set/street/reveal-back.png', 'lyr', root);
    const rb = [REVEAL.box[0] + 2, REVEAL.box[1] + 2];
    box(this.revealBack, rb[0], rb[1], 108, 112);
    this.revealBack.style.opacity = '0';
    this.revealBack.style.mixBlendMode = 'screen';
    /* CLIPPED TO THE PANE, because its own alpha is not. The lane's note says
       "alpha is the pane mask, so it brightens glass only" — measured, its
       bottom and left edges are alpha 249-255, so screened it laid a lit
       RECTANGLE across the villa's face on the chapter's most important frame.
       The clip is the street lane's own measured glass polygon, so the light
       stops exactly where the glass does. */
    this.revealBack.style.clipPath = 'polygon(' + TARGETS.window.poly
      .map(([x, y]) => `${(x - rb[0]).toFixed(1)}px ${(y - rb[1]).toFixed(1)}px`)
      .join(',') + ')';
    this.actors = el('div', 'actors', root);
    this.irene = img(ART.irene.file, 'lyr', this.actors);
    this.irene.style.opacity = '0';
    this.holmes = img(ART.holmes.file, 'lyr', this.actors);
    this.holmesSignal = img(ART.signal.file, 'lyr', this.actors);
    this.holmesShadow = img('actor/contact-shadow.png', 'lyr shadow', this.actors);
    this.holmesSignal.style.opacity = '0';

    /* ---- the rocket: a light, not a sprite ------------------------- *
     * 7.2 #13 does not ship a rocket cut. What the reader has to see is a
     * thing thrown INTO the first-floor window, and that is legible as its
     * own trail and flash — which is what a smoke-rocket at night IS. */
    this.rocket = el('div', 'emis', root);
    this.rocket.style.opacity = '0';
    this.flash = el('div', 'emis', root);
    box(this.flash, PLUME.at[0] - 120, PLUME.at[1] - 120, 240, 240);
    this.flash.style.background =
      'radial-gradient(circle at 50% 50%,rgba(255,236,190,.95) 0%,' +
      'rgba(255,176,88,.45) 34%,rgba(255,150,60,0) 70%)';
    this.flash.style.opacity = '0';

    /* ---- the glass goes LAST: the bay is drawn over its own room ---- */
    this.glass = img('set/street/bayglass.png', 'lyr');
    box(this.glass, 691, 308, 123, 133);

    /* ---- the damp ---------------------------------------------------- *
     * Feathered top and bottom. The shipped card is a full-alpha rectangle of
     * dark blue-grey; screened over the plate that is a uniform lift, and a
     * uniform lift with a straight edge is a visible horizontal seam across
     * the whole street. Fog does not have edges, so the card is masked into
     * one. (The mask is presentation — the painted pixels are untouched.) */
    this.mist = img('set/street/mist.png', 'lyr');
    box(this.mist, 0, 470, PLATE.w, 190);
    this.mist.style.mixBlendMode = 'screen';
    const feather = 'linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,1) 34%,' +
                    'rgba(0,0,0,1) 66%,rgba(0,0,0,0) 100%)';
    this.mist.style.webkitMaskImage = feather;
    this.mist.style.maskImage = feather;
    this.mist.style.opacity = '0.55';

    this.reset();
  }

  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      smoke: false,            // THE SMOKE GATE, closed on arrival
      windowOpen: 0, mark: 'off', signal: false,
      ruse: -1e9, dispersed: 0,
      k: { win: 0, smoke: 0, empty: 0 },
      holmesAt: [590, 0], holmesVisible: true,
    };
    this.state.holmesAt[1] = floorY(FLOOR, 590);
    if (this.chalk) { this.chalk.armed.style.opacity = '0'; this.chalk.locked.style.opacity = '0'; }
  }

  focusPlate(name) { return FOCUS[name] || FOCUS.street; }

  /**
   * THE CAMERA OVERRIDE. Beat VI is the one stretch of the book the reader
   * does not pace (sec 8.3): once the rocket is in the air the camera owns the
   * frame, and its two moves are on the beat's clock rather than on a unit's
   * focus. Returning a name here takes the camera off the unit for as long as
   * the ruse is running.
   */
  camOverride() {
    const r = this.ruseT();
    if (r === null) return null;
    if (r < RUSE.camReveal) return null;
    if (r < RUSE.camBack) return 'reveal';
    return 'street';
  }

  ruseT() {
    const d = this.state.t - this.state.ruse;
    return (this.state.ruse > -1e8 && d >= 0) ? d : null;
  }

  targetPlate(name) { return TARGETS[name] ? TARGETS[name].at : null; }

  targetLive(name) {
    if (name === 'station') return this.state.mark !== 'off';
    /* the window gate is only alive once the window is OPEN and lit — which is
       what the reader was told to station himself at. Arming it earlier would
       let him throw the rocket at a shut pane. */
    if (name === 'window') return this.state.windowOpen > 0.35 && this.ruseT() === null;
    return false;
  }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const T = TARGETS[name];
    if (T.poly && pointInPoly(p, T.poly)) return true;
    return Math.hypot(p.x - T.at[0], p.y - T.at[1]) <= T.r;
  }

  headPlate(who) {
    if (who !== 'HOLMES') return null;
    if (!this.state.holmesVisible) return null;
    const h = 1.87 * PX_PER_M;
    return [this.state.holmesAt[0], this.state.holmesAt[1] - h * 0.86];
  }

  holdAnchor() { return null; }

  fire(act) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
      case 'smokeClosed':
      case 'resumeStreet':
        /* the arrival state, stated as an act so the harness can SEE that the
           book closed the reference's own open smoke gate. */
        S.smoke = false; S.ruse = -1e9; S.dispersed = 0;
        if (act === 'resumeStreet') { S.mark = 'off'; S.signal = false; }
        break;
      case 'signalHand': S.signal = true; this.st.plate('rocket', 1); break;
      case 'descendToStreet': this.st.plate(null, 0); S.mark = 'armed'; break;
      case 'takeStation':
        S.mark = 'locked';
        /* canon: "Four or five minutes afterwards the sitting-room window will
           open." Taking the station is what that wait resolves into. */
        S.windowOpen = 1;
        this.st.cue('window-open', 0.35);
        break;
      case 'fireRuse':
        S.ruse = t; S.smoke = true;
        this.st.cue('cry-fire', 0.9);   // the crowd has to SEE the smoke first
        break;
      case 'disperse': S.dispersed = 1; break;
      default: break;
    }
  }

  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    const r = this.ruseT();

    /* ---- the five painted states cross-fade ------------------------ */
    const wantWin = S.windowOpen;
    const wantSmoke = (r !== null && r >= RUSE.flash) ? 1 : 0;
    const wantEmpty = (r !== null && r >= RUSE.disperse) ? 1 : 0;
    S.k.win = this.st.damp(S.k.win, wantWin, 5.0, dt);
    S.k.smoke = r !== null && r >= RUSE.flash
      ? clamp01((r - RUSE.flash) / RUSE.plumeIn) : this.st.damp(S.k.smoke, wantSmoke, 5.0, dt);
    S.k.empty = this.st.damp(S.k.empty, wantEmpty, 0.9, dt);
    this.win.style.opacity = S.k.win.toFixed(3);
    this.smoke.style.opacity = S.k.smoke.toFixed(3);
    this.empty.style.opacity = S.k.empty.toFixed(3);
    this.dim.style.opacity = ctx.dim.toFixed(3);

    /* ---- the painted lights breathe -------------------------------- */
    breathe(this.emis, EMIS, t, amb);
    // the bay warms as the window opens; the upper window is the ruse's own
    const bayGain = 1 + 0.35 * S.k.win;
    this.emis.bay.style.opacity =
      ((1 + amb * 0.28 * Math.sin(2 * Math.PI * t / 5.2)) * bayGain).toFixed(3);
    const upper = r === null ? 0
      : clamp01((r - RUSE.flash) / 0.6) * (1 - 0.55 * clamp01((r - RUSE.disperse) / 3.0));
    this.emis.upper.style.opacity =
      (upper * (1 + amb * 0.55 * Math.sin(2 * Math.PI * t / 3.1))).toFixed(3);

    /* ---- the chalk ring -------------------------------------------- */
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 1.9));
    this.chalk.armed.style.opacity = (S.mark === 'armed' ? pulse : 0).toFixed(3);
    this.chalk.locked.style.opacity = (S.mark === 'locked' ? 0.85 : 0).toFixed(3);

    /* ---- the damp drifts ------------------------------------------- */
    this.mist.style.transform =
      `translateX(${(amb * ((t * 3.2) % 220) - 110).toFixed(1)}px)`;
    this.mist.style.opacity = (0.42 + amb * 0.13 *
      Math.sin(2 * Math.PI * t / 11.0)).toFixed(3);

    /* ---- Holmes, on the pavement ----------------------------------- */
    const hh = 1.87 * PX_PER_M;
    const sway = amb * 0.5 * Math.sin(2 * Math.PI * t / 7.3);
    const at = [S.holmesAt[0], S.holmesAt[1] + sway];
    placeSprite(this.holmes, ART.holmes, at, hh);
    placeSprite(this.holmesSignal, ART.signal, at, hh);
    this.holmes.style.opacity = S.holmesVisible && !S.signal ? '1' : '0';
    this.holmesSignal.style.opacity = S.holmesVisible && S.signal ? '1' : '0';
    const sw = hh * 0.52;
    box(this.holmesShadow, at[0] - sw / 2, at[1] - sw * 0.31, sw, sw * 0.5);
    this.holmesShadow.style.opacity = S.holmesVisible ? '0.55' : '0';

    this.stepRuse(t, r, amb);
  }

  /* ---- THE RUSE, on the beat's own clock (sec 6.6) ------------------- */
  stepRuse(t, r, amb) {
    if (r === null) {
      this.rocket.style.opacity = '0';
      this.flash.style.opacity = '0';
      this.irene.style.opacity = '0';
      this.revealBack.style.opacity = '0';
      return;
    }

    /* 0.45-1.35 the rocket is in the air, up into the first-floor window.
       It leaves the reader's own hand — the station he took — and it is drawn
       as its trail, because a smoke-rocket at night IS its trail. */
    const fly = clamp01((r - RUSE.fly[0]) / (RUSE.fly[1] - RUSE.fly[0]));
    if (r >= RUSE.fly[0] && fly < 1) {
      const from = TARGETS.station.at, to = PLUME.at;
      const x = lerp(from[0], to[0], fly);
      const y = lerp(from[1], to[1], fly) - Math.sin(Math.PI * fly) * 96;
      const rr = 26 + 10 * Math.sin(Math.PI * fly);
      box(this.rocket, x - rr, y - rr, rr * 2, rr * 2);
      this.rocket.style.background =
        'radial-gradient(circle at 50% 50%,rgba(255,244,214,.95) 0%,' +
        'rgba(255,186,96,.5) 38%,rgba(255,150,60,0) 72%)';
      this.rocket.style.opacity = '1';
    } else {
      this.rocket.style.opacity = '0';
    }

    /* 1.35 the flash — the instant the house starts smoking */
    const fl = clamp01((r - RUSE.flash) / 0.55);
    this.flash.style.opacity = (r >= RUSE.flash ? (1 - fl) * 0.9 : 0).toFixed(3);

    /* 2.05 THE REVEAL, 7.6 s long. She is a SILHOUETTE: the backlight is a
       screen-blended card whose alpha is the pane mask, she is the shipped cut
       crushed to a backlit shape, and the bay glass is drawn over both. */
    const d = r - RUSE.reveal;
    if (d < 0) { this.irene.style.opacity = '0'; this.revealBack.style.opacity = '0'; return; }
    const bright = clamp01((d - RUSE.bright[0]) / (RUSE.bright[1] - RUSE.bright[0]));
    const down = clamp01((d - RUSE.lightDown[0]) / (RUSE.lightDown[1] - RUSE.lightDown[0]));
    this.revealBack.style.opacity = (bright * (1 - down)).toFixed(3);

    const cross = clamp01((d - RUSE.cross[0]) / (RUSE.cross[1] - RUSE.cross[0]));
    const wd = clamp01((d - RUSE.withdraw[0]) / (RUSE.withdraw[1] - RUSE.withdraw[0]));
    const hand = clamp01((d - RUSE.hand[0]) / (RUSE.hand[1] - RUSE.hand[0]));
    const x = lerp(REVEAL.crossX[0], REVEAL.crossX[1], easeInOut(cross)) -
              (REVEAL.crossX[1] - REVEAL.crossX[0]) * 0.42 * easeInOut(wd);
    const h = 1.68 * REVEAL.pxPerMetre;
    placeSprite(this.irene, ART.irene, [x, REVEAL.feetY], h * (1 + 0.03 * hand));
    // a silhouette, not a figure: crushed to a backlit shape, and she is drawn
    // BEFORE the glass so the pane's own paint sits over her
    this.irene.style.filter =
      `brightness(${(0.10 + 0.06 * hand).toFixed(3)}) contrast(1.35) saturate(.5)`;
    this.irene.style.opacity = (clamp01(d / 0.4) * (1 - down)).toFixed(3);
  }

  snapshot() {
    const S = this.state, r = this.ruseT();
    return {
      smokeGate: S.smoke, mark: S.mark, signal: S.signal,
      windowOpen: +S.k.win.toFixed(3),
      plates: { smoke: +S.k.smoke.toFixed(3), empty: +S.k.empty.toFixed(3) },
      ruseT: r === null ? null : +r.toFixed(2),
      reveal: r === null ? null : {
        firing: r >= RUSE.reveal && r < RUSE.reveal + 7.6,
        inPause: r >= RUSE.reveal + RUSE.pause[0] && r <= RUSE.reveal + RUSE.pause[1],
        x: +(parseFloat(this.irene.style.left || '0') +
             parseFloat(this.irene.style.width || '0') / 2).toFixed(1),
        op: +(this.irene.style.opacity || 0),
      },
      holmes: { x: +S.holmesAt[0].toFixed(1), y: +S.holmesAt[1].toFixed(1),
                visible: S.holmesVisible },
      camOverride: this.camOverride(),
    };
  }
}

/** even-odd point-in-polygon, in plate px. The bay is not a disc. */
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p.y) !== (yj > p.y) &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export { RUSE, TARGETS, FOCUS, DIM_MATRIX, PX_PER_M };
