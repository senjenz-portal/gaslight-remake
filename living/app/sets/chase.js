/**
 * sets/chase.js — the strip. Leaf 3, Beat III, THE PURSUIT.
 *
 * The chase plate paints NO vehicles and NO figures: the three rigs are things
 * that travel, so they are laid over it and driven along the RAIL the plate
 * lane fitted to its own roadway. That rail is the whole set — a table of
 * (u, x, y, scale) sampled off the painted road band, so a rig's position, its
 * size, and the ground it sits on all come from one number.
 *
 * FRAME CONVENTION (from the reference, kept): the road runs AWAY from the
 * near end, the terrace stands on the far side, and the lit door is UP the
 * road. So travelling = u increasing = smaller and higher in the frame.
 *
 * THE THREE STORY POSITIONS, which are placements and not shot dodges:
 *   unit 1  `hansom`  Norton's cab AT THE LIT DOOR, her landau NOT YET IN THE
 *                     STREET — canon has only his cab at l.612.
 *   unit 5  `landau`  the intro vignette: Norton away first; the landau up the
 *                     lane; she shoots out of the hall door and boards; a cab
 *                     comes through the street.
 *   units 8-11        the pursuit ROLLS: the gap 19.5 -> 14.0 m over 8.0 s,
 *                     both ends inside the reference's "shadow" band, and the
 *                     hooves are heard at the gap they are drawn at.
 *
 * ART GAP (CONTENT-full 7.2 #7). The three rigs are not shipped by any lane.
 * Everything about them that the STORY needs — where each one is, how big, on
 * what ground, how far apart, and which one the gate is on — is computed here
 * off the rail and is already correct; what is missing is the picture. Each rig
 * therefore runs as the two things about a night carriage that are not its
 * body: its lamp and its contact shadow on the cobbles. Dropping
 * set/chase/rig-<id>.png in gives them bodies with no other change.
 */
import { PLATE, el, box, clamp01, easeInOut, easeOut, lerp, placeSprite,
         emissives, breathe } from '../setkit.js';

/* the rail, sampled off the painted roadway by the plate lane (every other
   sample of its 41; the curve is smooth enough that 21 reads identically) */
const RAIL = [[0.000, 420.0, 545.1, 1.0000], [0.050, 461.9, 536.2, 1.0072],
  [0.100, 503.8, 525.5, 0.9756], [0.150, 545.7, 517.6, 1.0025],
  [0.200, 587.6, 509.1, 1.0189], [0.250, 629.5, 498.3, 0.9905],
  [0.300, 671.4, 487.6, 0.9684], [0.350, 713.3, 476.4, 0.9300],
  [0.400, 755.2, 464.2, 0.8568], [0.450, 797.1, 454.3, 0.8322],
  [0.500, 839.0, 444.6, 0.8129], [0.550, 880.9, 435.2, 0.8001],
  [0.600, 922.8, 425.4, 0.7776], [0.650, 964.7, 415.1, 0.7471],
  [0.700, 1006.6, 404.8, 0.7110], [0.750, 1048.5, 394.9, 0.6622],
  [0.800, 1090.4, 386.0, 0.6148], [0.850, 1132.3, 378.3, 0.5318],
  [0.900, 1174.2, 371.2, 0.4285], [0.950, 1216.1, 363.9, 0.3095],
  [1.000, 1258.0, 358.3, 0.2163]];

const M_PER_U = 32.23;         // least squares of the plate's own lamp columns
const GAP = { start: 0.605, end: 0.434 };   // 19.5 -> 14.0 m, the reference's
const ROLL = { dur: 8.0, follow: [0.015, 0.550], lead: [0.620, 0.984] };

const DOOR = [663, 356];       // Briony Lodge's lit door, up the road
const LAMPS = [[307, 327], [749, 288], [968, 271], [1140, 241]];

const EMIS = [
  { id: 'l1', at: LAMPS[0], r: 150, rgb: '255,196,96', a: 0.130, per: 6.4, amp: 0.30 },
  { id: 'l2', at: LAMPS[1], r: 132, rgb: '255,196,96', a: 0.115, per: 5.7, amp: 0.28 },
  { id: 'l3', at: LAMPS[2], r: 104, rgb: '255,196,96', a: 0.100, per: 7.1, amp: 0.26 },
  { id: 'l4', at: LAMPS[3], r: 92,  rgb: '255,196,96', a: 0.085, per: 6.9, amp: 0.24 },
  { id: 'door', at: DOOR,   r: 118, rgb: '255,206,126', a: 0.155, per: 4.4, amp: 0.34 },
];

const FOCUS = {
  strip: [704, 384, 1.00],
  /* the composed DOOR shot: his hansom at the lit door. */
  door:  [676, 402, 1.46],
  lane:  [800, 430, 1.12],
  her:   [700, 452, 1.54],
  /* THE GATE LENS. Deliberately short and deliberately wide: a gate's target
     must be reachable the MOMENT its cue asks for it, and the reference
     measured its own 2.8 s push leaving the cab off-frame for 16 of the first
     20 samples. The follower sits at rail u 0.015, so the lens is on him. */
  cab:   [470, 500, 1.58],
  away:  [1000, 420, 1.00],
};

const DIM_MATRIX = [0.4367, 0.5739, 0.7414];   // the chase lane's measured relight
const PX_PER_M = 51.2;                          // at rail u 0, scaled by rail.s

const ART = {
  norton: { file: 'actor/norton-chase.png', size: [112, 276], baseline: 274.6 },
  irene:  { file: 'actor/irene-chase.png',  size: [102, 258], baseline: 256.7 },
};

/* the 6.0 s intro vignette, unit 5. Every number is a fraction of the segment,
   and the segment is what performs canon l.631-632 (which is CUT as text). */
const INTRO = {
  nortonAway: [0.00, 0.42],    // he goes first
  landauIn:   [0.18, 0.72],    // up the lane, coat half-buttoned
  ireneOut:   [0.22, 0.55],    // she shoots out of the hall door
  ireneBoard: [0.48, 0.62],    // ...and into it
  cabIn:      [0.62, 1.00],    // a cab comes through the street
};

export class ChaseSet {
  static id = 'chase';
  static insets = {};                 // Beat III raises none
  static beds = ['chase'];

  constructor(root, st) {
    this.st = st;
    this.root = root;
    this.FOCUS = FOCUS;
    this.dimMatrix = DIM_MATRIX;
    const img = (f, c, p) => st.img(f, c, p || root);

    this.base = img('set/chase/chase.jpg', 'lyr plate');
    this.dim = img('set/chase/chase-dim.jpg', 'lyr plate');
    box(this.base, 0, 0, PLATE.w, PLATE.h);
    box(this.dim, 0, 0, PLATE.w, PLATE.h);
    this.dim.style.opacity = '0';

    /* Briony Lodge's light goes OUT once she is away — the plate paints it lit,
       and this is the same door with its light out, derived by the plate lane
       off this terrace's own three unlit doors. */
    this.doorOut = img('set/chase/door-out.png', 'lyr');
    box(this.doorOut, 596, 278, 168, 194);
    this.doorOut.style.opacity = '0';

    this.emis = emissives(EMIS, root);

    /* ---- the fog bank, drifting inside the diorama envelope --------- */
    this.fog = img('set/chase/fog.png', 'lyr');
    box(this.fog, 934, 52, 410, 473);

    /* ---- THE RIGS -------------------------------------------------- *
     * OUTSIDE the actor group, and that is not a detail. `.actors` is
     * `isolation: isolate` so the relight matrix can be applied to the cut-outs
     * alone — which also means a screen blend inside it composites against the
     * group's own transparent backdrop instead of against the painting. A rig's
     * lamp is LIGHT: screened over the plate it is a bloom on the cobbles, and
     * screened inside the isolated group it is an opaque black rectangle. */
    this.rigs = {};
    for (const id of ['norton', 'lead', 'follow']) {
      const g = el('div', 'rig', root);
      const shadow = st.img('actor/contact-shadow.png', 'lyr shadow', g);
      /* The lamp is drawn, not blitted. The chase lane's own painted bloom was
         tried first and measured invisible on this plate — it is the FOURTH
         lamp of the terrace, painted for a source 30 m up the road, and at rig
         scale over warm cobbles it added nothing an eye could find. A carriage
         lamp is the only thing on the strip the reader can track, so it is
         drawn at the intensity a carriage lamp has. */
      const lamp = el('div', 'emis riglamp', g);
      lamp.style.background =
        'radial-gradient(circle at 50% 50%,rgba(255,238,196,.95) 0%,' +
        'rgba(255,196,104,.52) 26%,rgba(255,168,72,.16) 52%,rgba(255,150,60,0) 76%)';
      g.style.opacity = '0';
      this.rigs[id] = { g, shadow, lamp, u: -1, on: false };
    }

    /* ---- the people the rigs carry --------------------------------- *
     * HOLMES IS NOT DRAWN ON THIS SET. Beats III and IV are Holmes TELLING
     * Watson about his afternoon (sec 2.1), and the ledger's own cast table
     * (6.3) lists him for Beat III as "(narrator)" — the one beat of the seven
     * where he is not a figure. He was drawn here for one round, standing at
     * the following cab's rail position; with no cab around him he read as a
     * man walking up the middle of the road, and the leader line pointed at
     * him. He is a voice on this leaf. */
    this.actors = el('div', 'actors', root);
    this.norton = img(ART.norton.file, 'lyr', this.actors);
    this.irene = img(ART.irene.file, 'lyr', this.actors);
    for (const e of [this.norton, this.irene]) e.style.opacity = '0';

    /* ---- THE ONE FOREGROUND OCCLUDER ------------------------------- *
     * The plate paints this gas standard STANDING IN THE ROADWAY, so the
     * pursuit has to pass behind it. Pixel-exact restore of the plate, so no
     * inpaint is needed — it is drawn last and the rigs run under it. */
    this.lampFront = img('set/chase/lamp2-front.png', 'lyr');
    box(this.lampFront, 727, 270, 49, 222);

    this.reset();
  }

  reset() {
    this.state = {
      t: this.state ? this.state.t : 0,
      norton: false, doorLit: true,
      seg: null, segT0: 0, segDur: 0,
      roll: -1e9, rolled: false,
      u: { norton: -1, lead: -1, follow: -1 },
      irene: null,                      // null | 'door' | 'boarding'
      holmesIn: false,
    };
  }

  focusPlate(name) { return FOCUS[name] || FOCUS.strip; }
  camOverride() { return null; }

  /* ---- the rail: one number gives position, ground and size --------- */
  rail(u) {
    if (u <= RAIL[0][0]) return RAIL[0];
    for (let i = 1; i < RAIL.length; i++) {
      if (u <= RAIL[i][0]) {
        const a = RAIL[i - 1], b = RAIL[i];
        const k = (u - a[0]) / (b[0] - a[0]);
        return [u, lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
      }
    }
    return RAIL[RAIL.length - 1];
  }

  /** the follower's rail position right now — the `cab` gate stands on it */
  followU() {
    const S = this.state;
    if (S.u.follow >= 0) return S.u.follow;
    return ROLL.follow[0];
  }

  targetPlate(name) {
    if (name !== 'cab') return null;
    const r = this.rail(this.followU());
    // the gate stands on the CAB, which is a body above its own wheels
    return [r[1], r[2] - 42 * r[3]];
  }

  targetLive(name) { return name === 'cab' && this.state.u.follow >= 0; }

  targetHit(name, p) {
    if (!this.targetLive(name)) return false;
    const at = this.targetPlate(name);
    const r = this.rail(this.followU())[3];
    return Math.hypot(p.x - at[0], p.y - at[1]) <= 78 * r;
  }

  /* A leader line needs a head IN THE PICTURE. On this leaf Holmes is the
     narrator and nobody else speaks except in his account, so the line simply
     does not draw here — which is what "the hairline connects the active
     speech to the speaker's head WHILE HE IS ON STAGE" already says. */
  headPlate() { return null; }

  holdAnchor() { return null; }

  fire(act) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
        S.u = { norton: -1, lead: -1, follow: -1 }; S.norton = false;
        S.doorLit = true; S.irene = null; S.holmesIn = false;
        break;
      /* HIS HANSOM AT THE LIT DOOR, HER LANDAU NOT YET IN THE STREET. */
      case 'placeCanonOrder':
        S.norton = true;
        S.u.norton = 0.29;              // the rail position of the lit door
        S.u.lead = -1; S.u.follow = -1;
        S.doorLit = true;
        break;
      case 'nortonAway': S.norton = false; S.u.norton = -1; S.doorLit = false; break;
      case 'startPursuit':
        S.roll = t; S.rolled = false;
        S.u.follow = ROLL.follow[0]; S.u.lead = ROLL.lead[0];
        S.holmesIn = true;
        this.st.cue('wheels', 0.25);   // 12 s of rolling under an 8 s roll
        break;
      default: break;
    }
  }

  /** the SEGMENT the unit list calls `chase-intro`, run by the Stage shell */
  startSeg(name, dur, t) {
    const S = this.state;
    S.seg = name; S.segT0 = t; S.segDur = dur;
    if (name === 'chase-intro') { S.doorLit = true; S.irene = 'door'; }
  }

  /** true while the pursuit is still running the strip — `wait: roll` reads it */
  waitDone(name) {
    if (name !== 'roll') return true;
    return this.state.rolled;
  }

  step(t, dt, ctx) {
    const S = this.state;
    S.t = t;
    const amb = this.st.reduced ? 0 : 1;
    this.dim.style.opacity = ctx.dim.toFixed(3);

    breathe(this.emis, EMIS, t, amb);
    this.emis.door.style.opacity =
      (S.doorLit ? (1 + amb * 0.34 * Math.sin(2 * Math.PI * t / 4.4)) : 0).toFixed(3);
    this.doorOut.style.opacity = S.doorLit ? '0' : '1';

    // the fog bank drifts, and stays inside the diorama envelope
    this.fog.style.transform =
      `translateX(${(amb * 7 * Math.sin(2 * Math.PI * t / 17.0)).toFixed(2)}px)`;
    this.fog.style.opacity = (0.78 + amb * 0.1 * Math.sin(2 * Math.PI * t / 13.0)).toFixed(3);

    this.stepSeg(t);
    this.stepRoll(t);
    this.paintRigs(t, amb);
  }

  /* ---- unit 5: the 6.0 s intro vignette ----------------------------- */
  stepSeg(t) {
    const S = this.state;
    if (S.seg !== 'chase-intro') return;
    const k = clamp01((t - S.segT0) / S.segDur);

    const seg = (a, b) => clamp01((k - a) / (b - a));
    // Norton away first
    const away = seg(...INTRO.nortonAway);
    S.u.norton = away < 1 ? lerp(0.29, 1.02, easeIn(away)) : -1;
    S.norton = away < 1;
    // the landau up the lane, and up the road
    const li = seg(...INTRO.landauIn);
    S.u.lead = li > 0 ? lerp(-0.08, ROLL.lead[0], easeInOut(li)) : -1;
    // she shoots out of the hall door and into it
    const out = seg(...INTRO.ireneOut), board = seg(...INTRO.ireneBoard);
    S.irene = board >= 1 ? null : (out > 0 ? (board > 0 ? 'boarding' : 'door') : null);
    S.doorLit = board < 1;
    // a cab comes through the street
    const ci = seg(...INTRO.cabIn);
    S.u.follow = ci > 0 ? lerp(-0.06, ROLL.follow[0], easeInOut(ci)) : -1;
    if (k >= 1) { S.seg = null; S.u.follow = ROLL.follow[0]; S.u.lead = ROLL.lead[0]; }
  }

  /* ---- units 8-11: the pursuit rolls -------------------------------- */
  stepRoll(t) {
    const S = this.state;
    if (S.roll < -1e8) return;
    const k = clamp01((t - S.roll) / ROLL.dur);
    S.u.follow = lerp(ROLL.follow[0], ROLL.follow[1], easeInOut(k));
    S.u.lead = lerp(ROLL.lead[0], ROLL.lead[1], easeInOut(k));
    if (k >= 1 && !S.rolled) S.rolled = true;
    /* THE HOOVES ARE HEARD AT THE GAP THEY ARE DRAWN AT. The reference drives
       hoof rate off the gap in metres; here the road bed's own level does, so a
       cab that has closed to 14 m sounds nearer than one 19.5 m back. */
    this.st.gain('chase', 0.75 + 0.45 * (1 - this.gapU() / GAP.start));
  }

  gapU() { return Math.max(0, this.state.u.lead - this.state.u.follow); }

  paintRigs(t, amb) {
    const S = this.state;
    for (const [id, key] of [['norton', 'norton'], ['lead', 'lead'], ['follow', 'follow']]) {
      const R = this.rigs[id];
      const u = S.u[key];
      if (!(u >= 0) || u > 1.01) { R.g.style.opacity = '0'; R.on = false; continue; }
      const [, x, y, s] = this.rail(u);
      R.on = true;
      R.g.style.opacity = '1';
      const sw = 150 * s;
      box(R.shadow, x - sw / 2, y - sw * 0.30, sw, sw * 0.5);
      R.shadow.style.opacity = (0.5 + 0.34 * s).toFixed(3);
      const lr = 96 * s;
      box(R.lamp, x - lr, y - 58 * s - lr, lr * 2, lr * 2);
      R.lamp.style.opacity =
        ((0.82 + amb * 0.12 * Math.sin(2 * Math.PI * t / 3.1 + u * 9)) * (0.45 + 0.55 * s))
          .toFixed(3);
      R.u = u;
    }

    // the people: Norton at the door, Irene out of the hall door, Holmes in the cab
    const dr = this.rail(0.29);
    this.norton.style.opacity = (S.norton && S.seg !== 'chase-intro') ? '1' : '0';
    placeSprite(this.norton, ART.norton, [dr[1] - 34 * dr[3], dr[2] - 4],
                1.80 * PX_PER_M * dr[3]);

    if (S.irene) {
      const bx = S.irene === 'boarding' ? dr[1] - 4 : dr[1] - 58 * dr[3];
      placeSprite(this.irene, ART.irene, [bx, dr[2] - 6], 1.68 * PX_PER_M * dr[3]);
      this.irene.style.opacity = '1';
    } else {
      this.irene.style.opacity = '0';
    }

  }

  snapshot() {
    const S = this.state;
    const gapM = +(this.gapU() * M_PER_U).toFixed(2);
    return {
      rigs: Object.fromEntries(Object.entries(this.rigs).map(([k, r]) =>
        [k, { on: r.on, u: +(+r.u).toFixed(3) }])),
      norton: S.norton, doorLit: S.doorLit, irene: S.irene, holmesIn: S.holmesIn,
      seg: S.seg, rolling: S.roll > -1e8 && !S.rolled, rolled: S.rolled,
      gapM,
      /* the reference's own bands: <12 too close, 12-25 shadow, 25-40 slack,
         >40 lost. The pursuit has to live in `shadow` at both ends. */
      band: gapM < 12 ? 'too-close' : gapM <= 25 ? 'shadow' : gapM <= 40 ? 'slack' : 'lost',
      target: this.targetPlate('cab'),
    };
  }
}

const easeIn = (k) => clamp01(k) * clamp01(k);

export { RAIL, ROLL, GAP, FOCUS, DIM_MATRIX, M_PER_U };
