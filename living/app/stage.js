/**
 * stage.js — 221B as a LIVING PLATE: the painted plate is the set, and every
 * moving thing on it is a painted cut-out laid over it in plate-pixel space.
 *
 * THE SPACE. One coordinate system for the whole file: PLATE PIXELS, 1408x768,
 * the space every asset manifest is written in. `#cam` is literally 1408x768 px
 * wide, so a layer's box is the manifest's own numbers with no conversion, and
 * two nested transforms do the rest:
 *     #fit   scale(F)              — the plate box into whatever panel it got
 *     #cam   translate(...) scale(k) — the CAMERA, a push in plate space
 * The projection is isometric, which the asset lane measured and wrote down:
 * an actor's height does NOT change with depth, only his floor line moves. So
 * there is no perspective divide anywhere here, and a walk is a straight lerp
 * between two marks with the sprite's own foot baseline pinned to the floor.
 *
 * THE STACK (DOM order is z-order, no z-index anywhere in the plate):
 *     room / room-open / room-dim   the painted plate and its two variants
 *     holmes-patch                  the inpainted hole where Holmes was painted
 *     emissives                     hearth, candle, window, street lamp
 *     ACTORS (isolated)             King, Holmes puppet, note, mask
 *     chair                         Watson's armchair, a genuine foreground cut
 *     desk highlight                the index gate's affordance
 * Holmes is drawn ABOVE the King because his own shoe base (519) is 30 px
 * nearer the camera than the King's mark (489): the King passes BEHIND him.
 *
 * THE LIGHT. When a plate rises, the room does not get a grey veil thrown over
 * it — it crossfades to the lane's PAINTED relight (room-dim.jpg), and the
 * cut-outs standing in it are put through the same relight as a colour matrix
 * (RGB x 0.448/0.588/0.754), which is that relight measured out of the two
 * plates rather than guessed. A dimmed painting and an undimmed actor standing
 * in it is the single loudest way this stack can look like a collage.
 *
 * TIME. Nothing here reads a wall clock. Every animation is (t - t0)/dur
 * against the sim clock, so two laps that step the same numbers paint the same
 * pixels.
 */

export const PLATE = { w: 1408, h: 768 };

/* ---- the marks, all measured, all sourced ------------------------------ *
 * king_height_px 274 = 124.3 px/m x 2.2 m, and the actor bbox/baseline come
 * out of assets/plates/beat1/MANIFEST.json. The walk anchors are the CENTRE OF
 * THE FOOT SPAN in each cell's bottom 20 rows, measured per frame: anchoring
 * each frame on its own feet is what stops a 22 px cell-to-cell difference in
 * where the boots sit from reading as a lurch.
 */
const KING = {
  h: 274, srcH: 1147, foot: [432.6, 1153],
  stand: [700, 489],          // the lane's standing_mark_x, on Holmes' floor line
  sill: [452, 534],           // the threshold: first boards inside the door
  walk: {
    enter: { file: 'king-walk-enter.png', cell: [448, 473], n: 4, srcH: 458.5,
             anchors: [276.5, 275.0, 276.5, 254.5] },
    exit:  { file: 'king-walk-exit.png', cell: [378, 481], n: 4, srcH: 466.0,
             anchors: [227.5, 209.5, 227.0, 232.5] },
  },
  // the mask on his face, in ACTOR-IMAGE px; mapped to the plate every frame
  maskAt: [245, 75],
  headAt: [250, 120],
  pxPerFrame: 56,             // one 0.9 m stride of a 2.2 m man = 112 px / 2 frames
  walkDur: 2.0,
};

/* Holmes: the sibling lane's puppet. Boxes and hinges are ITS numbers
 * (site-deploy/king-demo/living-plate/index.html ACT.parts / ACT.hinge), which
 * are the padded export boxes — the matte manifest's w/h are coverage bounds
 * and would squash the parts by up to 25%. */
const HOLMES = {
  parts: {
    legs:  [572, 469, 63, 54],
    skirt: [578, 395, 56, 86],
    torso: [558, 297, 89, 110],
    head:  [577, 293, 43, 61],
    pipe:  [558, 325, 43, 81],
  },
  hinge: { root: [602, 523], hip: [601, 400], chest: [601, 402],
           neck: [601, 338], arm: [590, 345] },
  patch: [536, 271],
  hand: [566, 352],           // where the note sits in his pipe hand
  head3: [598, 316],          // head centre, for the leader line
  /* THE FLOOR LINE, and the sibling lane's own walk. Its two marks are read off
   * the plate — his shoe base at the hearth, and a spot at the desk by the
   * window — and because the room's floor is planar the line between them IS
   * the floor line. Unlike the King's crossing (which stays at one depth), this
   * one goes INTO the room, so the lane measured a depth ease as well: 1.00 at
   * the hearth to 0.885 at the desk. Both numbers are its verifier's, which
   * checks the RENDERED box against the line (worst |dy| 0.45 px over a walk).
   * The root hinge is already the hearth mark, so a walk is translate+scale on
   * that one element and the feet cannot drift off the mark by construction. */
  mark: { hearth: [602, 523], desk: [766, 472] },
  deskScale: 0.885,
  walk: { file: 'holmes-walk.png', cell: [110, 234], n: 4, foot: 232, pxPerFrame: 19 },
  walkDur: 2.2,
};

const CHAIR = [718, 335, 176, 209];
const CANDLE = [601, 288];    // the light he holds the note up to

/* the emissives the plate already paints — these only ever BREATHE */
const EMIS = [
  { id: 'fire',   at: [516, 432], r: 92,  rgb: '255,168,58',  a: 0.30, per: 2.6, amp: 0.42 },
  { id: 'candle', at: [601, 288], r: 22,  rgb: '255,206,126', a: 0.34, per: 3.7, amp: 0.5 },
  { id: 'win',    at: [876, 258], r: 104, rgb: '255,210,126', a: 0.11, per: 7.3, amp: 0.45 },
  { id: 'lamp',   at: [1012, 182], r: 150, rgb: '255,196,96',  a: 0.13, per: 6.4, amp: 0.3 },
];

/* the four gate targets + the camera's marks, in plate px */
const TARGETS = {
  mask:  { r: 34 },                       // follows the King's face
  index: { at: [736, 404], r: 44 },       // the index volume on the desk
  door:  { at: [378, 372], r: 62 },       // the leaf; knob measured at (405,393)
};

const FOCUS = {
  room:       [704, 384, 1.00],
  holmes:     [612, 402, 1.62],
  note:       [640, 400, 1.22],
  wmark:      [620, 392, 1.18],
  desk:       [744, 416, 1.62],
  window:     [860, 300, 1.50],
  door:       [386, 372, 1.55],
  entrance:   [572, 452, 1.20],
  present:    [664, 402, 1.16],
  client:     [686, 366, 1.38],
  clientFace: 'kingFace',
  two:        [652, 384, 1.34],
};

const DIM_MATRIX = [0.448, 0.588, 0.754];   // measured: blur(room-dim)/blur(room)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.append(e);
  return e;
}
function box(e, x, y, w, h) {
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if (w != null) e.style.width = w + 'px';
  if (h != null) e.style.height = h + 'px';
  return e;
}

export class Stage {
  constructor(root, base = './assets/') {
    this.base = base;
    /* A reader who has asked the OS for less motion still gets the whole story:
       the walks, the plates and the page turn are the story. What goes is the
       ambient loop nobody asked for — the breath, the sway, the flicker. */
    this.reduced = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.root = root;                       // #stage, the aspect-locked panel
    this.fit = el('div', 'fit', root);
    this.cam = el('div', 'cam', this.fit);
    this.F = 1;
    this.pending = [];

    /* ---- the plate and its variants ------------------------------- */
    this.room = this.img('plate/room.jpg', 'lyr plate');
    this.roomOpen = this.img('plate/room-open.jpg', 'lyr plate');
    this.roomDim = this.img('plate/room-dim.jpg', 'lyr plate');
    this.roomOpen.style.opacity = '0';
    this.roomDim.style.opacity = '0';
    for (const e of [this.room, this.roomOpen, this.roomDim]) box(e, 0, 0, PLATE.w, PLATE.h);

    /* ---- the hole where Holmes was painted into the plate ---------- */
    this.patch = this.img('plate/holmes-patch.png', 'lyr');
    this.patchDim = this.img('plate/holmes-patch-dim.png', 'lyr');
    box(this.patch, HOLMES.patch[0], HOLMES.patch[1], 136, 278);
    box(this.patchDim, HOLMES.patch[0], HOLMES.patch[1], 136, 278);
    this.patchDim.style.opacity = '0';

    /* ---- the light the plate already paints, breathing ------------- */
    this.emis = {};
    for (const e of EMIS) {
      const d = el('div', 'emis', this.cam);
      box(d, e.at[0] - e.r, e.at[1] - e.r, e.r * 2, e.r * 2);
      d.style.background = `radial-gradient(circle at 50% 50%,rgba(${e.rgb},${e.a}) 0%,` +
                           `rgba(${e.rgb},${e.a * 0.42}) 38%,rgba(${e.rgb},0) 72%)`;
      this.emis[e.id] = d;
    }
    // the warm spill under the door when the carriage arrives (unit 10)
    this.doorGlow = el('div', 'emis', this.cam);
    box(this.doorGlow, 300, 470, 132, 46);
    this.doorGlow.style.background =
      'radial-gradient(ellipse at 50% 40%,rgba(255,196,110,.5) 0%,rgba(255,196,110,0) 70%)';
    this.doorGlow.style.opacity = '0';

    /* ---- THE ACTORS (isolated, so the dim matrix is theirs alone) --- */
    this.actors = el('div', 'actors', this.cam);

    this.kingWrap = el('div', 'king', this.actors);
    this.kingShadow = this.img('actor/contact-shadow.png', 'lyr shadow', this.kingWrap);
    this.kingMasked = this.img('actor/king-masked.png', 'lyr', this.kingWrap);
    this.kingUnmasked = this.img('actor/king-unmasked.png', 'lyr', this.kingWrap);
    this.kingWalk = el('div', 'lyr walk', this.kingWrap);
    this.kingWalkBg = { enter: this.bitmap('actor/' + KING.walk.enter.file),
                        exit: this.bitmap('actor/' + KING.walk.exit.file) };
    this.kingUnmasked.style.opacity = '0';
    this.kingWalk.style.opacity = '0';
    this.kingS = KING.h / KING.srcH;
    for (const im of [this.kingMasked, this.kingUnmasked]) {
      im.style.width = (571 * this.kingS) + 'px';
      im.style.height = (1159 * this.kingS) + 'px';
    }

    // the Holmes puppet: nested hinges, each one a full-stage box whose
    // transform-origin IS the joint, so the skeleton composes by nesting
    this.h = {};
    const mk = (name, parent) => {
      const d = el('div', 'hinge', parent);
      const p = HOLMES.hinge[name];
      d.style.transformOrigin = `${p[0]}px ${p[1]}px`;
      this.h[name] = d;
      return d;
    };
    const hRoot = mk('root', this.actors);
    this.holmesRoot = hRoot;
    const part = (k, parent) => {
      const b = HOLMES.parts[k];
      const im = this.img('actor/holmes-' + k + '.png', 'lyr', parent);
      box(im, b[0], b[1], b[2], b[3]);
      return im;
    };
    part('legs', hRoot);
    part('skirt', mk('hip', hRoot));
    const chest = mk('chest', hRoot);
    part('torso', chest);
    part('head', mk('neck', chest));
    const arm = mk('arm', chest);
    part('pipe', arm);

    /* the same painted Holmes as a four-frame walk. It stands in for the puppet
       (they are never both visible) and sits in the puppet's own z-slot, so a
       crossing passes behind the armchair exactly as the standing figure would */
    this.holmesWalk = el('div', 'lyr walk', this.actors);
    this.holmesWalk.style.backgroundImage = this.bitmap('actor/' + HOLMES.walk.file);
    this.holmesWalk.style.opacity = '0';   // size + cell are written per frame

    // the props the lanes flagged as gaps, cut out of the painted art
    this.note = this.img('actor/note-prop.png', 'lyr prop', this.actors);
    this.mask = this.img('actor/mask-prop.png', 'lyr prop', this.actors);
    this.note.style.opacity = '0';
    this.mask.style.opacity = '0';

    /* ---- foreground: the armchair is genuinely in front ------------- */
    this.chair = this.img('plate/chair.png', 'lyr');
    this.chairDim = this.img('plate/chair-dim.png', 'lyr');
    box(this.chair, CHAIR[0], CHAIR[1], CHAIR[2], CHAIR[3]);
    box(this.chairDim, CHAIR[0], CHAIR[1], CHAIR[2], CHAIR[3]);
    this.chairDim.style.opacity = '0';

    /* ---- the index gate's affordance: a ledger highlight ------------ */
    this.ledger = el('div', 'ledger', this.cam);
    box(this.ledger, TARGETS.index.at[0] - 78, TARGETS.index.at[1] - 44, 156, 88);
    this.ledger.style.opacity = '0';

    /* ---- the inset plates: screen-space, OUTSIDE the camera --------- */
    this.insetWrap = el('div', 'insets', root);
    this.insets = {};
    for (const [id, file] of [['note', 'inset/note-plate.jpg'],
                              ['watermark', 'inset/watermark-plate.jpg'],
                              ['both', 'inset/both-photo.jpg']]) {
      const card = el('div', 'inset', this.insetWrap);
      const im = this.img(file, 'insetimg', card);
      const glow = el('div', 'wglow', card);
      this.insets[id] = { card, im, glow, k: 0, want: 0 };
    }
    this.insets.watermark.glow.style.display = 'block';

    /* ---- state ------------------------------------------------------ */
    this.reset();
    this.layout();
  }

  /** The world as unit 0 finds it. A replay from the top has to be able to get
   *  back HERE first: replaying the acts forward from unit 0 without this left
   *  everything a later unit had switched on still switched on — jump back to
   *  the Gazetteer after the King has entered and the King was still standing
   *  in the room, because nothing had ever told him to leave. */
  reset() {
    this.state = {
      plate: { note: 0, watermark: 0, both: 0 }, dim: 0, reveal: 0, hold: 0,
      kingVisible: false, masked: true, doorOpen: 0, ledger: 0,
      king: { x: KING.sill[0], y: KING.sill[1], walking: null, wt: 0, frame: 0, op: 0 },
      holmes: { at: 'hearth', from: 'hearth', to: 'hearth', walking: null, wt: 0,
                x: HOLMES.mark.hearth[0], y: HOLMES.mark.hearth[1], s: 1, frame: 0 },
      unmask: -1e9, maskFly: -1e9, present: -1e9, gesture: -1e9, arrival: -1e9,
      noteToss: -1e9, noteHeld: false, t: this.state ? this.state.t : 0,
    };
    this.cam3 = { x: 704, y: 384, k: 1, wx: 704, wy: 384, wk: 1 };
    this.acts = [];
    for (const name of Object.keys(this.insets || {})) {
      const it = this.insets[name];
      it.k = 0; it.want = 0;
    }
    if (this.mask) this.mask.style.opacity = '0';
    if (this.note) this.note.style.opacity = '0';
  }

  img(file, cls, parent) {
    const e = el('img', cls, parent || this.cam);
    e.decoding = 'sync';
    e.alt = '';
    e.setAttribute('aria-hidden', 'true');
    e.src = this.base + file;
    this.pending.push(e);
    return e;
  }

  /**
   * A bitmap painted as a CSS background instead of as an <img>. It goes in the
   * SAME preload set, and it has to: a background is only fetched when a rule
   * first needs it, and the rule that needs a walk strip is written on the frame
   * the walk begins. On localhost that read as instant. On the deployed site the
   * King's entrance played with no King in it — his 736 KB strip was still on
   * the wire while the sim walked an invisible man across the floor. Anything
   * the story can reveal has to be decoded before __ready, whatever paints it.
   */
  bitmap(file) {
    const e = new Image();
    e.decoding = 'sync';
    e.src = this.base + file;
    this.pending.push(e);
    return `url(${this.base}${file})`;
  }

  /** Every bitmap decoded before the first frame — a lap must not race a decode. */
  async preload() {
    const missing = [];
    await Promise.all(this.pending.map(async (im) => {
      try { await (im.decode ? im.decode() : Promise.resolve()); }
      catch (_) { missing.push(im.getAttribute('src')); }
    }));
    return missing;
  }

  /**
   * How much of the painting the panel shows. Landscape shows the whole plate,
   * void margins and all — the diorama floating on a dark page IS the plate's
   * own composition. A portrait screen cannot afford them: at 1.83:1 the
   * picture collapses to a third of the leaf and the prose is left stranded
   * under a strip. So portrait CROPS to the painted room instead of shrinking
   * it — same painting, framed for the screen. Nothing the story needs (the
   * door at 303, the street lamp at 1105) leaves the crop.
   */
  setView(w, h) { this.vis = { w, h }; }

  /** Fit the visible plate box into the panel it was given. */
  layout() {
    const r = this.root.getBoundingClientRect();
    if (!this.vis) this.vis = { w: PLATE.w, h: PLATE.h };
    this.F = r.width / this.vis.w;
    this.fit.style.transform = `scale(${this.F})`;
    this.rect = r;
  }

  /* ---- the camera ---------------------------------------------------- */
  focusPlate(name) {
    const f = FOCUS[name] || FOCUS.room;
    if (f === 'kingFace') {
      const p = this.maskPlate();
      return [p[0], p[1], 2.15];
    }
    return f;
  }

  setFocus(name, snap) {
    const f = this.focusPlate(name);
    this.cam3.wx = f[0]; this.cam3.wy = f[1]; this.cam3.wk = f[2];
    if (snap) { this.cam3.x = f[0]; this.cam3.y = f[1]; this.cam3.k = f[2]; }
  }

  applyCam() {
    const c = this.cam3;
    const V = this.vis || { w: PLATE.w, h: PLATE.h };
    let X = V.w / 2 - c.x * c.k;
    let Y = V.h / 2 - c.y * c.k;
    // never show past the edge of the painting
    X = Math.min(0, Math.max(V.w - PLATE.w * c.k, X));
    Y = Math.min(0, Math.max(V.h - PLATE.h * c.k, Y));
    this.camX = X; this.camY = Y;
    this.cam.style.transform = `translate(${X.toFixed(2)}px,${Y.toFixed(2)}px) scale(${c.k.toFixed(4)})`;
  }

  /** plate px -> viewport px (for the rings, the leader, hit tests). */
  toScreen(px, py) {
    const r = this.rect || this.root.getBoundingClientRect();
    return { x: r.left + (px * this.cam3.k + this.camX) * this.F,
             y: r.top + (py * this.cam3.k + this.camY) * this.F };
  }

  /** viewport px -> plate px */
  toPlate(sx, sy) {
    const r = this.rect || this.root.getBoundingClientRect();
    return { x: ((sx - r.left) / this.F - this.camX) / this.cam3.k,
             y: ((sy - r.top) / this.F - this.camY) / this.cam3.k };
  }

  /* ---- where things are, in plate px --------------------------------- */
  kingFoot() { const k = this.state.king; return [k.x, k.y]; }

  maskPlate() {
    const k = this.state.king, s = this.kingS;
    return [k.x + (KING.maskAt[0] - KING.foot[0]) * s,
            k.y + (KING.maskAt[1] - KING.foot[1]) * s];
  }

  headPlate(who) {
    if (who === 'HOLMES') return HOLMES.head3;
    if (!this.state.kingVisible) return null;
    const k = this.state.king, s = this.kingS;
    return [k.x + (KING.headAt[0] - KING.foot[0]) * s,
            k.y + (KING.headAt[1] - KING.foot[1]) * s];
  }

  targetPlate(name) {
    if (name === 'mask') return this.maskPlate();
    return TARGETS[name] ? TARGETS[name].at : [704, 384];
  }

  /** The hold ring stands ON the thing being held: the note in Holmes' hand. */
  holdAnchor() {
    if (this.state.noteHeld && this.notePos) return this.notePos;
    return [this.cam3.x, this.cam3.y];
  }

  targetLive(name) {
    if (name === 'mask') return this.state.kingVisible && this.state.masked;
    if (name === 'index') return true;
    if (name === 'door') return true;
    return false;
  }

  /** Did a viewport-space click land on the target? Plate-space radius + slack. */
  targetHit(name, sx, sy) {
    if (!this.targetLive(name)) return false;
    const p = this.toPlate(sx, sy);
    const at = this.targetPlate(name);
    const r = (TARGETS[name] && TARGETS[name].r) || 40;
    // the door is a leaf, not a disc: measured rect 303,217 -> 420,505
    if (name === 'door') {
      if (p.x >= 288 && p.x <= 436 && p.y >= 202 && p.y <= 520) return true;
    }
    if (name === 'index') {
      if (p.x >= 660 && p.x <= 812 && p.y >= 356 && p.y <= 452) return true;
    }
    return Math.hypot(p.x - at[0], p.y - at[1]) <= r;
  }

  /* ---- the verbs the units fire --------------------------------------- */
  fire(act) {
    const S = this.state, t = S.t;
    this.acts.push(act);
    switch (act) {
      case 'establish': break;
      case 'noteToss': S.noteToss = t; S.noteHeld = false; break;
      case 'notePlateUp': this.plate('note', 1); break;
      case 'noteLift':                          // unit 5: the plate comes DOWN,
        this.plate(null, 0);                    // the verb happens in the WORLD
        S.noteHeld = true;
        break;
      // the plate is up and the monogram is already resolved: the hold is what
      // resolved it, and unit 6 is the reader reading what he uncovered
      case 'watermarkPlateUp': this.plate('watermark', 1); S.reveal = 1; S.noteHeld = true; break;
      /* unit 7: "let us glance at our Continental Gazetteer" — the gazetteer is
         ON THE DESK, and the camera goes there for units 7-8. He used to lean
         at the hearth while the frame held an empty desk; now he crosses to it,
         behind Watson's armchair, and gestures when he arrives. */
      case 'gazetteerFetch': this.plate(null, 0); S.noteHeld = false;
        this.holmesTo('desk'); break;
      case 'carriageArrive': this.holmesTo('hearth'); break;   // unit 9: back to the fire
      case 'arrival': S.arrival = t; break;
      case 'kingEnter':
        S.doorOpen = 1; S.kingVisible = true; S.masked = true;
        S.king.walking = 'enter'; S.king.wt = 0;
        S.king.x = KING.sill[0]; S.king.y = KING.sill[1];
        break;
      case 'kingPresent': S.present = t; S.doorOpen = 0; break;
      case 'pushToMask': break;
      case 'kingUnmask': S.masked = false; S.unmask = t; S.maskFly = t; break;
      case 'toIndex': S.ledger = 1; break;
      case 'gazetteerLookup': S.ledger = 0; S.gesture = t; break;
      case 'bothPlateUp': this.plate('both', 1); break;
      case 'plateOff': this.plate(null, 0); break;
      case 'holmesReturn': S.gesture = t; break;
      case 'kingExit': S.king.walking = 'exit'; S.king.wt = 0; break;
      case 'doorOpen': S.doorOpen = 1; break;
      case 'kingOffstage': S.kingVisible = false; break;
      default: break;
    }
  }

  /** Send Holmes to one of his two marks. A reader who asked for less motion
   *  still gets the answer — he is simply already there. */
  holmesTo(mark) {
    const H = this.state.holmes;
    if (H.at === mark && !H.walking) return;
    if (this.reduced) {
      H.at = mark; H.walking = null; H.wt = 0;
      this.state.gesture = this.state.t;
      return;
    }
    H.from = H.walking ? H.to : H.at;   // interrupting mid-stride: honour the goal
    H.to = mark; H.walking = mark; H.wt = 0; H.frame = 0;
  }

  /** The floor line: the two marks are on it, and the room's floor is planar. */
  holmesFloorY(x) {
    const a = HOLMES.mark.hearth, b = HOLMES.mark.desk;
    return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  }

  /** Raise one inset plate (and dim the world under it), or take them all down. */
  plate(id, k) {
    for (const name of Object.keys(this.insets)) {
      this.insets[name].want = (name === id) ? k : 0;
    }
  }

  setHold(k) { this.state.hold = clamp01(k); }
  setReveal(id, k) {
    this.state.reveal = clamp01(k);
    if (id === 'watermark') this.insets.watermark.want = clamp01(k);
  }

  /* ---- one fixed step ------------------------------------------------- */
  step(t, dt) {
    const S = this.state;
    S.t = t;
    /* The panel's box is re-read at the TOP of every step, before this frame's
       writes. Caching it in layout() alone was wrong: the wrap slides during a
       page turn and a viewport change lands a frame before its resize event,
       and a stale box silently moves every screen mapping — the ring, the hit
       test, the leader — with nothing on screen to show it. */
    this.rect = this.root.getBoundingClientRect();

    /* the camera eases; a plate up pulls it back a touch so the picture
       behind the plate is a room and not a wallpaper */
    this.cam3.x = damp(this.cam3.x, this.cam3.wx, 3.2, dt);
    this.cam3.y = damp(this.cam3.y, this.cam3.wy, 3.2, dt);
    this.cam3.k = damp(this.cam3.k, this.cam3.wk, 3.2, dt);
    this.applyCam();

    /* ---- the insets, and the dim they rise over -------------------- */
    let dim = 0;
    for (const id of Object.keys(this.insets)) {
      const P = this.insets[id];
      P.k = damp(P.k, P.want, 5.0, dt);
      if (P.k < 1e-3) P.k = P.want > 0 ? P.k : 0;
      S.plate[id] = P.k;
      dim = Math.max(dim, P.k);
      const e = easeInOut(P.k);
      P.card.style.opacity = e.toFixed(3);
      P.card.style.transform = `translateY(${((1 - e) * 26).toFixed(2)}px) scale(${(0.965 + 0.035 * e).toFixed(4)})`;
      P.card.style.pointerEvents = 'none';
    }
    // the watermark RESOLVES with the hold: the monogram comes up out of the
    // paper in proportion, which is the whole point of the verb
    const wm = this.insets.watermark;
    const rv = Math.max(S.reveal, S.hold);
    wm.im.style.filter = `brightness(${(0.62 + 0.38 * rv).toFixed(3)}) contrast(${(0.9 + 0.22 * rv).toFixed(3)})`;
    wm.glow.style.opacity = (0.85 * rv).toFixed(3);
    wm.glow.style.transform = `scale(${(0.72 + 0.28 * rv).toFixed(3)})`;

    S.dim = dim = clamp01(dim);
    this.roomDim.style.opacity = dim.toFixed(3);
    this.patchDim.style.opacity = dim.toFixed(3);
    this.chairDim.style.opacity = dim.toFixed(3);
    if (this.dimMatrix) {
      const v = DIM_MATRIX.map((c) => (1 - (1 - c) * dim));
      this.dimMatrix.setAttribute('values',
        `${v[0]} 0 0 0 0  0 ${v[1]} 0 0 0  0 0 ${v[2]} 0 0  0 0 0 1 0`);
    }

    /* ---- the door ---------------------------------------------------- */
    const wantOpen = S.doorOpen;
    S.doorK = damp(S.doorK || 0, wantOpen, 6.0, dt);
    this.roomOpen.style.opacity = S.doorK.toFixed(3);

    /* ---- the plate breathes ------------------------------------------ */
    const arr = clamp01((t - S.arrival) / 2.2);
    const amb = this.reduced ? 0 : 1;
    for (const e of EMIS) {
      const d = this.emis[e.id];
      let a = 1 + amb * e.amp * Math.sin(2 * Math.PI * t / e.per);
      if (e.id === 'lamp' && S.arrival > -1e8) a *= 1 + 0.55 * Math.sin(Math.PI * arr);
      if (e.id === 'candle') a *= 1 + 0.5 * S.hold;   // he holds the note to it
      d.style.opacity = a.toFixed(3);
    }
    this.doorGlow.style.opacity = (S.arrival > -1e8 ? Math.sin(Math.PI * arr) * 0.9
                                   + (S.doorK * 0.35) : S.doorK * 0.35).toFixed(3);
    this.ledger.style.opacity =
      (S.ledger * (0.42 + 0.32 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 1.9)))).toFixed(3);

    this.stepHolmes(t, dt);
    this.stepKing(t, dt);
    this.stepProps(t, dt);
  }

  /* ---- Holmes: the sibling lane's idle, and one new verb ------------- */
  stepHolmes(t, dt) {
    const S = this.state;
    this.stepHolmesWalk(t, dt);
    const g = this.gestureAt(t - S.gesture);
    // the hold verb: he raises the note toward the candle on the mantel
    const lift = easeOut(S.hold);
    const amb = this.reduced ? 0 : 1;
    const breath = amb * Math.sin(2 * Math.PI * t / 4.1);
    const chest = amb * 0.70 * Math.sin(2 * Math.PI * t / 9.3);
    const hip = amb * 1.15 * Math.sin(2 * Math.PI * t / 7.7 + 1.1);
    const armIdle = amb * 1.40 * Math.sin(2 * Math.PI * t / 5.9 + 0.6);
    const look = amb * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 13.0));
    const arm = armIdle + 10.0 * g + 26.0 * lift;

    /* the root carries BOTH the breath and the mark he is standing on. Its
       transform-origin is the hearth mark itself, so translate+scale puts his
       feet exactly on the destination mark whatever the depth scale is. */
    const H = S.holmes;
    this.h.root.style.transform =
      `translate(${(H.x - HOLMES.mark.hearth[0]).toFixed(2)}px,` +
      `${(H.y - HOLMES.mark.hearth[1] + 0.55 * breath).toFixed(3)}px) scale(${H.s.toFixed(4)})`;
    this.h.hip.style.transform = `rotate(${hip.toFixed(3)}deg)`;
    this.h.chest.style.transform =
      `rotate(${chest.toFixed(3)}deg) scaleY(${(1 + 0.006 * breath).toFixed(5)})`;
    this.h.neck.style.transform =
      `rotate(${(2.2 * look + 2.2 * g + 3.0 * lift).toFixed(3)}deg) translate(${(0.9 * look).toFixed(2)}px,0)`;
    this.h.arm.style.transform =
      `rotate(${arm.toFixed(3)}deg) translate(0px,${(-1.6 * g - 12.0 * lift).toFixed(2)}px)`;
    this.holmesPose = { arm, lift, g };
  }

  /** The crossing. The puppet and the sprite are never both visible: the strip
   *  is the walk, the hinged cut-out is the stand, and the swap happens on the
   *  frame he arrives — which is also when the gesture that motivated the walk
   *  fires, so "he goes to the desk" and "he reaches for the book" are one act. */
  stepHolmesWalk(t, dt) {
    const S = this.state, H = S.holmes, W = HOLMES.walk;
    const a = HOLMES.mark[H.from], b = HOLMES.mark[H.to];
    if (H.walking) {
      H.wt = clamp01(H.wt + dt / HOLMES.walkDur);
      H.x = lerp(a[0], b[0], easeInOut(H.wt));
      H.y = this.holmesFloorY(H.x);
      H.frame = Math.floor(Math.abs(H.x - a[0]) / W.pxPerFrame) % W.n;
      if (H.wt >= 1) {
        H.walking = null; H.at = H.to;
        H.x = b[0]; H.y = b[1];
        S.gesture = t;                 // he arrives and reaches for the book
      }
    } else {
      const m = HOLMES.mark[H.at];
      H.x = m[0]; H.y = m[1];
    }
    // depth: 1.00 on the hearth mark, 0.885 on the desk mark, eased by x
    H.s = 1 + (H.x - HOLMES.mark.hearth[0]) /
          (HOLMES.mark.desk[0] - HOLMES.mark.hearth[0]) * (HOLMES.deskScale - 1);

    const w = this.holmesWalk;
    if (!H.walking) {
      w.style.opacity = '0';
      this.holmesRoot.style.opacity = '1';
      return;
    }
    this.holmesRoot.style.opacity = '0';
    w.style.opacity = '1';
    const cw = W.cell[0] * H.s, ch = W.cell[1] * H.s;
    box(w, H.x - cw / 2, H.y - W.foot * H.s, cw, ch);
    w.style.backgroundSize = `${(cw * W.n).toFixed(2)}px ${ch.toFixed(2)}px`;
    w.style.backgroundPosition = `${(-H.frame * cw).toFixed(2)}px 0px`;
    // the strip faces RIGHT; going back to the fire he is mirrored
    w.style.transformOrigin = `${(cw / 2).toFixed(2)}px ${(W.foot * H.s).toFixed(2)}px`;
    w.style.transform = H.to === 'hearth' ? 'scaleX(-1)' : 'none';
  }

  gestureAt(dt) {
    if (!(dt >= 0)) return 0;
    if (dt < 0.32) return easeOut(dt / 0.32);
    if (dt < 0.84) return 1;
    if (dt < 1.6) return 1 - easeInOut((dt - 0.84) / 0.76);
    return 0;
  }

  /* ---- the King: walk strip in, cut-out standing, walk strip out ----- */
  stepKing(t, dt) {
    const S = this.state, K = S.king;

    if (K.walking) {
      K.wt = clamp01(K.wt + dt / KING.walkDur);
      const from = K.walking === 'enter' ? KING.sill : KING.stand;
      const to = K.walking === 'enter' ? KING.stand : KING.sill;
      const e = easeInOut(K.wt);
      K.x = lerp(from[0], to[0], e);
      K.y = lerp(from[1], to[1], e);
      const travelled = Math.abs(K.x - from[0]);
      K.frame = Math.floor(travelled / KING.pxPerFrame) % 4;
      // he fades ON at the threshold coming in; going out he STAYS at the sill
      // (the page turn is what takes him off stage — a colossus walked through
      // a 117 px doorway in plain view is a head through a lintel)
      K.op = K.walking === 'enter' ? clamp01(K.wt / 0.16) : 1;
      if (K.wt >= 1) { K.walking = null; K.x = to[0]; K.y = to[1]; }
    } else if (S.kingVisible) {
      K.op = 1;
    }

    const vis = S.kingVisible;
    this.kingWrap.style.opacity = vis ? K.op.toFixed(3) : '0';
    if (!vis) return;

    const walking = !!K.walking;
    const s = this.kingS;
    // the idle: a cut-out forgives a breath and nothing more
    const amb = this.reduced ? 0 : 1;
    const br = amb * Math.sin(2 * Math.PI * t / 4.6);
    const pres = this.gestureAt(t - S.present);
    const sway = amb * 0.30 * Math.sin(2 * Math.PI * t / 11.0);

    if (walking) {
      const W = KING.walk[K.walking];
      const ws = KING.h / W.srcH;
      const cw = W.cell[0] * ws, ch = W.cell[1] * ws;
      const e = this.kingWalk;
      e.style.opacity = '1';
      e.style.width = cw + 'px'; e.style.height = ch + 'px';
      e.style.backgroundImage = this.kingWalkBg[K.walking];   // decoded at boot
      e.style.backgroundSize = `${(W.cell[0] * W.n * ws)}px ${ch}px`;
      e.style.backgroundPosition = `${(-K.frame * cw).toFixed(2)}px 0px`;
      e.style.left = (K.x - W.anchors[K.frame] * ws).toFixed(2) + 'px';
      e.style.top = (K.y - (W.cell[1] - 6) * ws).toFixed(2) + 'px';
      this.kingMasked.style.opacity = '0';
      this.kingUnmasked.style.opacity = '0';
    } else {
      this.kingWalk.style.opacity = '0';
      const x = K.x - KING.foot[0] * s, y = K.y - KING.foot[1] * s;
      const un = clamp01((t - S.unmask) / 0.5);
      for (const [im, o] of [[this.kingMasked, 1 - un], [this.kingUnmasked, un]]) {
        im.style.opacity = o.toFixed(3);
        im.style.left = x.toFixed(2) + 'px';
        im.style.top = y.toFixed(2) + 'px';
        im.style.transformOrigin = `${(KING.foot[0] * s).toFixed(1)}px ${(KING.foot[1] * s).toFixed(1)}px`;
        im.style.transform =
          `translateY(${(0.7 * br).toFixed(3)}px) rotate(${sway.toFixed(3)}deg) ` +
          `scaleY(${(1 + 0.0035 * br).toFixed(5)}) scaleX(${(1 - 0.055 * pres).toFixed(4)})`;
      }
    }
    const sw = KING.h * 0.52;
    box(this.kingShadow, K.x - sw / 2, K.y - sw * 0.5 * 0.62, sw, sw * (160 / 512) * 1.6);
    this.kingShadow.style.opacity = walking ? '0.55' : '0.7';
  }

  /* ---- the two props ------------------------------------------------- */
  stepProps(t, dt) {
    const S = this.state;

    /* the note. Three lives: tossed to the reader (unit 1), held in the hand
       (unit 5), raised to the candle as the hold fills. */
    const toss = clamp01((t - S.noteToss) / 1.1);
    let nx, ny, nw, nop, nrot;
    if (S.noteToss > -1e8 && toss < 1) {
      const e = easeOut(toss);
      nx = lerp(HOLMES.hand[0], 700, e);
      ny = lerp(HOLMES.hand[1], 610, e);
      nw = lerp(34, 190, e);
      nop = 1 - clamp01((toss - 0.62) / 0.38);
      nrot = -18 + 60 * e;
    } else if (S.noteHeld) {
      const lift = easeOut(S.hold);
      nx = lerp(HOLMES.hand[0], CANDLE[0] - 16, lift);
      ny = lerp(HOLMES.hand[1], CANDLE[1] + 22, lift);
      nw = 34; nop = 1; nrot = -14 - 26 * lift;
    } else { nop = 0; nx = HOLMES.hand[0]; ny = HOLMES.hand[1]; nw = 34; nrot = 0; }
    const nh = nw * (123 / 160);
    this.notePos = [nx, ny];
    box(this.note, nx - nw / 2, ny - nh / 2, nw, nh);
    this.note.style.opacity = nop.toFixed(3);
    this.note.style.transform = `rotate(${nrot.toFixed(2)}deg)`;

    /* the mask. Torn off at the gate and hurled down: a parabola from his face
       to the boards, then it lies there for the rest of the beat. */
    const fly = clamp01((t - S.maskFly) / 0.85);
    if (S.maskFly > -1e8) {
      const face = this.maskPlate();
      // it lands on the open boards just in FRONT of him — not at his own foot
      // mark, where Holmes' legs stand and the thing would never be seen again
      const land = [S.king.x - 32, S.king.y + 39];
      const e = easeOut(fly);
      const mx = lerp(face[0], land[0], e);
      const my = lerp(face[1], land[1], fly * fly) - Math.sin(Math.PI * fly) * 26;
      const mw = lerp(32, 44, fly);
      box(this.mask, mx - mw / 2, my - mw * 0.25, mw, mw * (46 / 74));
      this.mask.style.opacity = '1';
      // it comes to rest LYING on the boards: a small turn and the foreshorten
      // an isometric floor gives a flat thing, not an end-on spin
      this.mask.style.transform =
        `rotate(${(fly * 26).toFixed(1)}deg) scaleY(${(1 - 0.36 * fly).toFixed(3)})`;
    }
  }

  /* ---- harness ------------------------------------------------------- */
  snapshot() {
    const S = this.state;
    return {
      plate: { note: +S.plate.note.toFixed(3), watermark: +S.plate.watermark.toFixed(3),
               both: +S.plate.both.toFixed(3), dim: +S.dim.toFixed(3) },
      cam: { x: +this.cam3.x.toFixed(1), y: +this.cam3.y.toFixed(1), k: +this.cam3.k.toFixed(3),
             wantK: +this.cam3.wk.toFixed(3) },
      king: { visible: S.kingVisible, masked: S.masked, x: +S.king.x.toFixed(1),
              y: +S.king.y.toFixed(1), walking: S.king.walking, wt: +S.king.wt.toFixed(3),
              frame: S.king.frame, op: +S.king.op.toFixed(3),
              atStand: Math.abs(S.king.x - KING.stand[0]) < 0.6,
              atSill: Math.abs(S.king.x - KING.sill[0]) < 0.6,
              maskFlown: S.maskFly > -1e8 ? +clamp01((S.t - S.maskFly) / 0.85).toFixed(3) : 0 },
      holmes: { arm: +(this.holmesPose ? this.holmesPose.arm : 0).toFixed(2),
                lift: +(this.holmesPose ? this.holmesPose.lift : 0).toFixed(3),
                noteHeld: S.noteHeld,
                at: S.holmes.at, walking: S.holmes.walking,
                x: +S.holmes.x.toFixed(1), s: +S.holmes.s.toFixed(4),
                frame: S.holmes.frame,
                /* his feet against the floor line, measured off the RENDERED
                   box — the sprite while he crosses, his own legs while he
                   stands, so a wrong transform on either cannot pass */
                foot: (() => {
                  const wk = !!S.holmes.walking;
                  const e = wk ? this.holmesWalk
                               : this.holmesRoot.querySelector('img[src*="holmes-legs"]');
                  if (!e) return null;
                  const r = e.getBoundingClientRect();
                  if (!r.height) return null;
                  const frac = wk ? HOLMES.walk.foot / HOLMES.walk.cell[1] : 1;
                  const p = this.toPlate(r.left + r.width / 2, r.top + r.height * frac);
                  return { footY: +p.y.toFixed(1), floorY: +this.holmesFloorY(p.x).toFixed(1),
                           dy: +(p.y - this.holmesFloorY(p.x)).toFixed(2) };
                })() },
      door: { open: +(S.doorK || 0).toFixed(3) },
      ledger: S.ledger,
      acts: this.acts.slice(),
      /* feet on the floor, measured off the RENDERED box rather than off the
         numbers that drew it, so a wrong transform cannot pass */
      foot: (() => {
        const e = S.king.walking ? this.kingWalk : this.kingMasked;
        const r = e.getBoundingClientRect();
        if (!r.height) return null;
        const frac = S.king.walking
          ? (KING.walk[S.king.walking].cell[1] - 6) / KING.walk[S.king.walking].cell[1]
          : 1153 / 1159;
        const p = this.toPlate(r.left + r.width / 2, r.top + r.height * frac);
        return { footY: +p.y.toFixed(1), markY: +S.king.y.toFixed(1),
                 dy: +(p.y - S.king.y).toFixed(2) };
      })(),
    };
  }
}

export { KING, HOLMES, TARGETS, FOCUS, DIM_MATRIX };
