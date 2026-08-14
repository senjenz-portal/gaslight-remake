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
 * THE RIGS HAVE BODIES (CONTENT-full 7.2 #7, closed 2026-08-12). For one round
 * they did not: each rig ran as the two things about a night carriage that are
 * not its body — its lamp and its contact shadow — and the beat titled THE
 * PURSUIT played over an empty street, with a GATE whose cue said "click the
 * cab" pointing at a glow on bare cobbles. `set/chase/rig-<id>.png` is now
 * generated (lanechase/refsheet_rigs.py -> jobs-rigs.json -> ship_rigs.py:
 * horse in harness, driver on the box, wheels, near-side lamp) and drawn.
 *
 * THE ART CARRIES THE ROAD'S PERSPECTIVE, so the pin is not the sprite's
 * middle. Each rig is painted from behind and slightly to its left — the way
 * this plate's road, which runs away to the upper right, actually presents a
 * carriage — and inside the picture the horse's hooves already stand HIGHER
 * than the back wheels. So a rig is pinned by its own measured FOOT CENTRE
 * (`RIG.pin`) to the rail point, its height comes from the rail scale, and the
 * rest of the rig lies up-road from there by construction. The lamp bloom hangs
 * on the measured lamp bracket (`RIG.lamp`), not on air.
 *
 * A rig that fails to load is a GAP the lap can see: `bodies` in the snapshot
 * reports, per rig, whether its picture is actually on screen.
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
/* WHERE A RIG MAY STOP. A rig CROSSING a lamp column reads as passing in
 * front of it, which it is; a rig PARKED on one reads as broken — round 3
 * exempted lamp2 because its front cut draws the post "correctly" in front
 * of a rig under it, and round 4's review (the user's eye) rejected that
 * too: a carriage merged with a standard at a DWELL reads wrong whichever
 * of them wins the paint order. The law, final form: at every settle, every
 * rig's body clears EVERY post column (true post pixels, not bloom) by
 * >= 10 plate px. Posts: lamp1 300..332, lamp2 727..776 (the cut box),
 * lamp3 950..990, lamp4 1125..1155. The front cut still earns its keep on
 * CROSSINGS, where passing behind the post is the read. History: the lead
 * parked at 0.620 (hood on lamp3), then 0.478 (rear tip on lamp2's edge);
 * the follow ended at 0.550 (on lamp3); Norton's cab dwelt at 0.36 (square
 * across lamp2, three units). */
const ROLL = { dur: 8.0, follow: [0.015, 0.509], lead: [0.492, 0.984] };

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
  /* THE COMPOSED DOOR SHOT: his cab at the lit door, and the man who sprang
     out of it. Composed on the two of them (cab body 523..707 since the
     round-4 re-park, Norton 612..648) and on the plate's painted content,
     which runs out at x 150 — at k 2.00 the frame is x 308..1012, every
     pixel of it painting. The old lens (k 1.46 on 676,402) spent its left
     quarter on the backdrop. */
  door:  [660, 430, 2.00],
  lane:  [800, 430, 1.12],
  /* HER LANDAU, at the rail position the intro leaves it on (ROLL.lead[0],
     now 0.492 — see the parking law at ROLL). The old lens sat at 700,452 —
     the pavement she had already driven away from; the 951-centred one was
     composed on the old park, on lamp3's column. This one is composed on the
     new park (u 0.492: body 787..933 measured by the lap's own gate, >= 10
     px of daylight to both posts, centre 860, ground 446) and its frame
     438..1257 still holds the hall door (663) and both gas standards. The
     follow's roll end (0.509) parks in the same clear block; the two never
     stand there at the same time. */
  her:   [848, 410, 1.72],
  /* THE GATE LENS. A gate's target must be reachable the MOMENT its cue asks
     for it, and the reference measured its own 2.8 s push leaving the cab
     off-frame for 16 of the first 20 samples. The follower sits at rail u
     0.015 with its body centre at 441,461, and the lens is composed on it:
     x 181..938, y 264..677, which is inside the painting on all four sides. */
  cab:   [560, 470, 1.86],
  away:  [1000, 420, 1.00],
};

const DIM_MATRIX = [0.4367, 0.5739, 0.7414];   // the chase lane's measured relight
const PX_PER_M = 51.2;                          // at rail u 0, scaled by rail.s

const ART = {
  norton: { file: 'actor/norton-chase.png', size: [112, 276], baseline: 274.6 },
  irene:  { file: 'actor/irene-chase.png',  size: [102, 258], baseline: 256.7 },
  /* shipped by the actor lane and drawn by nobody until the landau had a body
     to board: the boarding pose, one foot up, a hand on the carriage */
  ireneBoard: { file: 'actor/irene-board.png', size: [125, 249], baseline: 247.5 },
};

/* the landau's near seat, in the rig sprite's own pixels: [hip x, hip y, the
   body line she is clipped at]. Read off set/chase/rig-lead.png. */
const SEAT = [330, 186, 208];

/* THE THREE RIGS. Every number here was measured off the shipped sprite by
   tools/lanechase/ship_rigs.py and is in the sprite's own pixels:
     m     metres from the road to the top of the art (the driver's hat crown),
           which is what turns the rail scale into a height
     pin   the foot centre — the back wheels' road contact, the point that
           stands on the rail
     lamp  the painted carriage lamp, where the bloom hangs
     hit   the cab body's own centre, which is what the `cab` gate stands on
     foot  the wheels' ground span, which is what the contact shadow is */
const RIG = {
  norton: { file: 'set/chase/rig-norton.png', size: [607, 500], baseline: 500,
            m: 2.90, pin: [212, 500], lamp: [382, 160], hit: [295, 239],
            foot: [138, 286] },
  lead:   { file: 'set/chase/rig-lead.png',   size: [656, 500], baseline: 500,
            m: 2.75, pin: [198, 500], lamp: [494, 151], hit: [328, 249],
            foot: [62, 334] },
  follow: { file: 'set/chase/rig-follow.png', size: [554, 500], baseline: 500,
            m: 3.00, pin: [242, 500], lamp: [383, 149], hit: [269, 235],
            foot: [187, 298] },
};

/* WHERE NORTON'S CAB STANDS while he is at the door. Not the door's own rail
   position (0.29): a rig lies UP-ROAD of its pin, so a cab pinned at the door
   would be drawn over the man who has just stepped out of it. 0.36 puts the
   cab's back wheel just past him — he is between the reader and his own cab,
   which is also the only order in which the two read as one event. */
/* u 0.36 put the parked cab's body (664..829) square across lamp2's column
   (719..778) for a three-unit dwell. The front cut drew the post honestly in
   front of it, and round 3 called that "physically correct" — the user's eye
   called it the carriage still stuck behind the light, and the eye is the
   acceptance test. The parking law now covers EVERY lamp column at every
   settle: he pulls up just short of the standard (body 523..707, 12 px
   clear), with the lit door over the cab's right half — Norton still springs
   out at 612..648, in front of his own cab, which is what the text says. */
const CAB_AT_DOOR = 0.20;
const NORTON_AT_DOOR = 0.29;
/* how far below the near end of the rail a rig is still drawn (faded) */
const U_IN = -0.055;

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
      /* the picture: under the lamp, over its own shadow. It is requested by
         name, so a rig that never ships lands in `stage.gaps` instead of
         quietly rendering a beat with no vehicles in it. */
      const body = st.img(RIG[id].file, 'lyr rigbody', g);
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
      this.rigs[id] = { g, shadow, body, lamp, u: -1, on: false };
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
    this.ireneBoard = img(ART.ireneBoard.file, 'lyr', this.actors);
    for (const e of [this.norton, this.irene, this.ireneBoard]) e.style.opacity = '0';

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
    /* BELOW THE NEAR END the rail is EXTRAPOLATED off its own first segment,
       so a rig can drive INTO the picture instead of appearing on it. The road
       is straight and the plate's own samples are near-linear here, so the
       extension is the plate's geometry continued, not an invention. */
    if (u < RAIL[0][0]) {
      const a = RAIL[0], b = RAIL[1], k = (u - a[0]) / (b[0] - a[0]);
      return [u, lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
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
    /* the gate stands on the CAB ITSELF — the measured centre of the body the
       reader can see, not a guessed height above the wheels. */
    const B = this.rigBox('follow', this.followU()), A = RIG.follow;
    return [B.left + A.hit[0] * B.k, B.top + A.hit[1] * B.k];
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

  /** `settled` — a REPLAYED act leaves the world at its end (see stage.fire) */
  fire(act, settled = false) {
    const S = this.state, t = S.t;
    switch (act) {
      case 'establish':
        S.u = { norton: -1, lead: -1, follow: -1 }; S.norton = false;
        S.doorLit = true; S.irene = null; S.holmesIn = false;
        break;
      /* HIS HANSOM AT THE LIT DOOR, HER LANDAU NOT YET IN THE STREET. */
      case 'placeCanonOrder':
        S.norton = true;
        S.u.norton = CAB_AT_DOOR;       // his cab, pulled up past the lit door
        S.u.lead = -1; S.u.follow = -1;
        S.doorLit = true;
        break;
      case 'nortonAway': S.norton = false; S.u.norton = -1; S.doorLit = false; break;
      case 'startPursuit':
        /* replayed, the pursuit has already run the strip: the rigs stand at
           the far end of the roll and `wait: roll` is satisfied, which is where
           a reader who has passed this gate would have left them */
        S.roll = settled ? t - ROLL.dur : t; S.rolled = !!settled;
        S.u.follow = ROLL.follow[settled ? 1 : 0];
        S.u.lead = ROLL.lead[settled ? 1 : 0];
        S.holmesIn = true;
        // 12 s of rolling under an 8 s roll — but not for a roll that is over
        if (!settled) this.st.cue('wheels', 0.25);
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
    S.u.norton = away < 1 ? lerp(CAB_AT_DOOR, 1.06, easeIn(away)) : -1;
    S.norton = away < 1;
    // the landau up the lane, and up the road
    const li = seg(...INTRO.landauIn);
    S.u.lead = li > 0 ? lerp(U_IN, ROLL.lead[0], easeInOut(li)) : -1;
    /* she shoots out of the hall door, boards — AND THEN SHE IS IN IT. Nulling
       her here was the old bug: `FOCUS.her` is the very next unit's lens and it
       framed the pavement she had already left. She rides on the lead rig now,
       which is also what the line says she is doing. */
    const out = seg(...INTRO.ireneOut), board = seg(...INTRO.ireneBoard);
    S.irene = board >= 1 ? 'riding' : (out > 0 ? (board > 0 ? 'boarding' : 'door') : null);
    S.doorLit = board < 1;
    // a cab comes through the street
    const ci = seg(...INTRO.cabIn);
    S.u.follow = ci > 0 ? lerp(U_IN, ROLL.follow[0], easeInOut(ci)) : -1;
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

  /** where a rig's body, lamp and shadow land, given only its rail position */
  rigBox(id, u) {
    const A = RIG[id];
    const [, x, y, s] = this.rail(u);
    const h = A.m * PX_PER_M * s;              // the rail scale IS the size law
    const k = h / A.size[1];
    return { x, y, s, k, h, w: A.size[0] * k,
             left: x - A.pin[0] * k, top: y - A.pin[1] * k };
  }

  paintRigs(t, amb) {
    const S = this.state;
    for (const [id, key] of [['norton', 'norton'], ['lead', 'lead'], ['follow', 'follow']]) {
      const R = this.rigs[id];
      const A = RIG[id];
      const u = S.u[key];
      /* A rig ENTERS from below the near end of the rail rather than popping
         into existence on it: the intro drives the landau and the cab in from
         u<0, and the rail is extrapolated there (see rail()), so the entrance
         is a fade up out of the dark near corner over 0.07 of the strip. */
      if (!(u >= U_IN) || u > 1.01) { R.g.style.opacity = '0'; R.on = false; continue; }
      const B = this.rigBox(id, u);
      R.on = u >= 0;
      R.g.style.opacity = clamp01((u - U_IN) / (0.02 - U_IN)).toFixed(3);
      box(R.body, B.left, B.top, B.w, B.h);
      /* the shadow is the WHEELS' own span, not a fixed disc: a rig that is
         half the size up the road puts down half the shadow, and a landau
         standing on four wheels puts down a wider one than a two-wheel cab. */
      const sw = (A.foot[1] - A.foot[0]) * B.k * 1.55;
      box(R.shadow, B.x - sw / 2, B.y - sw * 0.20, sw, sw * 0.42);
      R.shadow.style.opacity = (0.42 + 0.30 * B.s).toFixed(3);
      /* the bloom hangs on the rig's OWN lamp, which the picture paints; it is
         the halo the paint cannot carry, so it is small and it breathes. */
      const lr = Math.max(13, 0.23 * B.h);
      box(R.lamp, B.left + A.lamp[0] * B.k - lr, B.top + A.lamp[1] * B.k - lr,
          lr * 2, lr * 2);
      R.lamp.style.opacity =
        ((0.78 + amb * 0.12 * Math.sin(2 * Math.PI * t / 3.1 + u * 9)) * (0.45 + 0.55 * B.s))
          .toFixed(3);
      R.u = u;
    }

    // the people: Norton at the door, Irene out of the hall door and away in it
    const dr = this.rail(NORTON_AT_DOOR);
    this.norton.style.opacity = (S.norton && S.seg !== 'chase-intro') ? '1' : '0';
    placeSprite(this.norton, ART.norton, [dr[1] - 34 * dr[3], dr[2] - 4],
                1.80 * PX_PER_M * dr[3]);

    this.ireneBoard.style.opacity = '0';
    this.irene.style.opacity = '0';
    this.irene.style.clipPath = 'none';
    if (S.irene === 'riding') {
      /* SHE IS IN THE LANDAU, which is what `FOCUS.her` is pointed at. Her cut
         is a standing figure, so she is pinned by the HIP to the near seat and
         clipped at the carriage's own body line: what shows above the panelling
         is what a passenger shows — head, hat and shoulders. */
      const u = S.u.lead;
      if (u >= 0) {
        const B = this.rigBox('lead', u);
        const seat = [B.left + SEAT[0] * B.k, B.top + SEAT[1] * B.k];
        const h = 1.62 * PX_PER_M * B.s;
        const r = placeSprite(this.irene, ART.irene, [seat[0], seat[1] + 0.52 * h], h);
        const cut = B.top + SEAT[2] * B.k;
        this.irene.style.clipPath =
          `inset(0 0 ${(clamp01((seat[1] + 0.52 * h - cut) / r.h) * 100).toFixed(1)}% 0)`;
        this.irene.style.opacity = '1';
      }
    } else if (S.irene === 'boarding') {
      /* the boarding cut, which is a pose and not a mirror of the standing one */
      placeSprite(this.ireneBoard, ART.ireneBoard, [dr[1] + 16 * dr[3], dr[2] - 6],
                  1.68 * PX_PER_M * dr[3]);
      this.ireneBoard.style.opacity = '1';
    } else if (S.irene === 'door') {
      placeSprite(this.irene, ART.irene, [dr[1] - 58 * dr[3], dr[2] - 6],
                  1.68 * PX_PER_M * dr[3]);
      this.irene.style.opacity = '1';
    }
  }

  snapshot() {
    const S = this.state;
    const gapM = +(this.gapU() * M_PER_U).toFixed(2);
    return {
      /* `on` is the rig's state; `body` is whether its PICTURE is actually on
         screen, measured off the element the browser is drawing. The lap can
         fail on a rig that is running with no carriage in it — which is exactly
         the hole the old `gaps: []` could not see. */
      rigs: Object.fromEntries(Object.entries(this.rigs).map(([k, r]) =>
        [k, { on: r.on, u: +(+r.u).toFixed(3),
              body: !!(r.on && r.body.naturalWidth > 0 && r.body.clientWidth > 0),
              /* the body's PLATE-SPACE box, for the parking law: a settled rig
                 may not stand on an uncut lamp column (see ROLL). */
              plate: r.on ? (() => { const B = this.rigBox(k, r.u);
                return [B.left, B.top, B.w, B.h].map((v) => +v.toFixed(1)); })() : null }])),
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
