/**
 * figures.js — THE CAST, BUILT IN HOUSE.
 *
 * ROUND-8 mission, half one: the three Scenario image-to-3D casts (holmes.glb,
 * watson.glb, king.glb + king-unmasked.glb, 100k tris each, painterly, baked
 * PBR) were the style outliers in a diorama whose every other surface is
 * authored here as flat-shaded faceted geometry. They also could not move: one
 * unrigged mesh apiece, no bones, no clips — which is why round 3 had to bend
 * Watson into a chair with a vertex deformer and why "life" was a bob on the
 * slot. This module replaces all four with procedural RIGGED figures in the
 * diorama's own vocabulary:
 *
 *   · geometry: chunky beveled prisms + 20-facet welded ball joints, all of it
 *     non-indexed BufferGeometry, flat-shaded, PER-VERTEX COLOUR ONLY. No
 *     textures, no normal maps, no samplers. Facet-to-facet colour variation
 *     comes off mulberry32(seed), so two loads are the same figure.
 *   · rig: ~16 rigid segments as position-only joint Groups whose REST
 *     ROTATION IS IDENTITY and whose axes stay world-aligned (X = the figure's
 *     right, Y = up, Z = the way he faces). That is the whole reason a pose
 *     here is readable: `rotation.x = -0.4` pitches a limb forward by 0.4 rad
 *     from wherever it hangs, in every joint, with no rest offset to unpick.
 *   · animation: a joint-driven gait + gesture layer that is a PURE FUNCTION
 *     of the beat clock and the mover's state (clock.js law), so ?harness=1
 *     laps stay byte-identical.
 *
 * THE GAIT IS FOOT-LOCKED, NOT SINUSOIDAL.
 * A sine on the hip is what makes a figure skate: the foot's ground speed only
 * matches the body's at one instant per stride and slides either side of it. So
 * the legs are solved the other way round — the FOOT is the input and the joints
 * are the output:
 *   1. the FOOTFALL RATE comes from SPEED. `f = max(f0(v), v / stepMax)` in
 *      FOOTFALLS PER SECOND (one plant of one foot; a whole two-legged cycle is
 *      2/f seconds), so the STEP LENGTH `S = v/f` — the ground one footfall
 *      covers — is whatever keeps the feet honest, and a walk that is asked to
 *      cover 3.4 m in 2.1 s hurries instead of gliding. [8c-3] renamed both:
 *      `cad`/`stride` read as either the footfall or the cycle depending on who
 *      was reading, and the review's "0.40 m steps at 3.5 footfalls/s" had to be
 *      checked against the code to know which. `footfallHz` and `stepLen` cannot
 *      be misread, and they are the names the harness reports. [8d-1] and they are
 *      MEASURED off the plants themselves — the interval between two feet landing
 *      and the ground the body covered inside it — because the rate above is only
 *      what was ASKED FOR: step 5 may raise it, and for one whole round it did,
 *      on every walk in the beat, while the ledger reported the request.
 *   2. at heel strike a foot's PLANT POINT is recorded in ROOM space. Through
 *      the whole stance its joint target is that world point pulled back into
 *      figure space every frame, so the body's translation AND its damped turn
 *      are both cancelled: the foot does not move against the floor at all.
 *   3. the pelvis DROPS as far as the stance leg needs to reach that point
 *      (`sqrt(L² - z²)`), capped, which is where the walk's vertical bob comes
 *      from — two dips per cycle at double support, exactly like a real gait,
 *      instead of an amplitude someone typed.
 *   4. 2-bone IK with a +Z bend axis puts the knee in front, always, so the
 *      rear knee bends the way a knee bends.
 *   5. [R8-8] a GOVERNOR overrides the rate whenever the stance foot would run
 *      out of leg before its stance ended — the accelerations are ease.inOut, so
 *      a stance is always planted for less speed than it has to carry. This is
 *      the rate that actually advances the phase, which is why 1 is measured and
 *      not reported.
 * `scan()` measures all of it off the posed scene graph (world joint positions,
 * local joint angles) and lap.mjs gates on those numbers.
 *
 * Arms are forward-kinematic: counter-swing while walking, and a small library
 * of authored gesture poses (carry, lift-to-the-lamp, toss, reach, hand-to-face,
 * hurl) blended in over the top. The right hand carries a SOCKET — an empty
 * Group at the grip — and the note is parented to it, which is what retires
 * scene.js's hand-offset guesswork.
 *
 *   const fig = createFigure({ seed: 11, build: 'holmes' });
 *   slot.add(fig.root);
 *   fig.drive.speed = 1.4; fig.drive.walking = true;
 *   fig.step(dt, t);
 */
import * as THREE from 'three';
import { mulberry32, damp, ease } from './clock.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
const DOWN = new THREE.Vector3(0, -1, 0);

/* The ball a joint is welded with: an icosahedron at detail 0, 20 facets — the
 * same solid the rock, the hearth ember and the doorknob are cut from. A posed
 * elbow or knee opens a wedge between two prisms; this fills it, so a bent limb
 * never shows daylight through its own joint. */
const BALL_POS = (() => {
  let g = new THREE.IcosahedronGeometry(1, 0);
  if (g.index) g = g.toNonIndexed();
  const a = g.attributes.position.array.slice();
  g.dispose();
  return a;
})();

/* ------------------------------------------------------------------ *
 * Shell — one segment's geometry, accumulated then frozen.
 *
 * Everything is authored in the JOINT's own space (origin at the pivot, the
 * limb hanging down -Y), non-indexed, with a flat colour per triangle. The
 * colour carries the facet jitter: three shades a flat-shaded facet by its own
 * normal, and a 4% wobble on top of that is what stops a chunky prism reading
 * as a plastic block.
 * ------------------------------------------------------------------ */
class Shell {
  constructor(rng, jit = 0.045) {
    this.pos = []; this.col = []; this.rng = rng; this.jit = jit; this.tris = 0;
  }
  _tint(c) {
    const k = 1 + (this.rng() * 2 - 1) * this.jit;
    return [c.r * k, c.g * k, c.b * k];
  }
  tri(a, b, c, col) {
    const t = this._tint(col);
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(t[0], t[1], t[2]);
    this.tris++;
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }

  /**
   * A beveled prism through a stack of rectangular cross-sections. Each ring is
   * `{ y, hw, hd, bev, x, z }`: half-width on X, half-depth on Z, corner bevel
   * as a fraction of each (0.34 by default — enough chamfer to read as a cut
   * facet at diorama distance), and an optional centre offset so a segment can
   * lean or flare without a second mesh.
   */
  prism(rings, col, { capTop = true, capBot = true } = {}) {
    const P = rings.map((r) => {
      const bx = r.hw * (r.bev === undefined ? 0.34 : r.bev);
      const bz = r.hd * (r.bev === undefined ? 0.34 : r.bev);
      const cx = r.x || 0, cz = r.z || 0, y = r.y;
      return [
        [cx + r.hw - bx, y, cz + r.hd], [cx + r.hw, y, cz + r.hd - bz],
        [cx + r.hw, y, cz - r.hd + bz], [cx + r.hw - bx, y, cz - r.hd],
        [cx - r.hw + bx, y, cz - r.hd], [cx - r.hw, y, cz - r.hd + bz],
        [cx - r.hw, y, cz + r.hd - bz], [cx - r.hw + bx, y, cz + r.hd],
      ];
    });
    for (let i = 0; i < P.length - 1; i++) {
      const lo = P[i], up = P[i + 1];
      for (let k = 0; k < 8; k++) {
        const k2 = (k + 1) % 8;
        this.quad(lo[k], lo[k2], up[k2], up[k], col);
      }
    }
    if (capTop) {
      const r = rings[rings.length - 1], t = P[P.length - 1];
      const c = [r.x || 0, r.y, r.z || 0];
      for (let k = 0; k < 8; k++) this.tri(c, t[k], t[(k + 1) % 8], col);
    }
    if (capBot) {
      const r = rings[0], b = P[0];
      const c = [r.x || 0, r.y, r.z || 0];
      for (let k = 0; k < 8; k++) this.tri(c, b[(k + 1) % 8], b[k], col);
    }
    return this;
  }

  /** A slab: the two-ring prism most dressing is made of. */
  slab(x, y, z, hw, hh, hd, col, bev = 0.3) {
    return this.prism([{ y: y - hh, hw, hd, x, z, bev },
                       { y: y + hh, hw, hd, x, z, bev }], col);
  }

  /** A welded ball joint. `r` is sized to the limb it is closing. */
  ball(x, y, z, r, col) {
    for (let i = 0; i < BALL_POS.length; i += 9) {
      this.tri([x + BALL_POS[i] * r, y + BALL_POS[i + 1] * r, z + BALL_POS[i + 2] * r],
               [x + BALL_POS[i + 3] * r, y + BALL_POS[i + 4] * r, z + BALL_POS[i + 5] * r],
               [x + BALL_POS[i + 6] * r, y + BALL_POS[i + 7] * r, z + BALL_POS[i + 8] * r], col);
    }
    return this;
  }

  /**
   * An arc of shell — the King's cloak. Columns of facets swept between
   * `a0` and `a1` radians about +Z (0 = straight ahead), so the mantle can be
   * OPEN AT THE FRONT the way the cameo's is: deep blue outside, flame-orange
   * lining on the inside faces, and the lining is what the reader sees of the
   * opening. Two shells, opposite winding, welded at the hem and the edges.
   */
  /**
   * A cloak arc. `a0..a1` runs the LONG way round (through the back), so k = 0
   * and k = N are the two front edges of the opening and k = N/2 is the spine.
   *
   * ROUND-8b [8b-3] `rise` SWEEPS THE HEM. Round 8's cloak was a set of flat
   * rings, so the King's hem hung 0.068 of stature off the boards through 266
   * degrees of arc — a bell that covered both knees at every camera, and his
   * whole stride with them (the review: "the King's cloak hides every knee",
   * measured at i-11/i-15/i-37). Each ring may now carry a `rise` that is applied
   * as a function of the arc: ZERO at the spine, full at the two front edges,
   * `|2u-1|^0.85` in between. The back stays the floor-length cloak of fact I.4
   * and the cameo plate; the front sweeps up past the knee, which is what a
   * riding cloak does anyway and what shows the orange lining on the swept edge.
   */
  cloak(rings, a0, a1, cols, colIn) {
    const N = 9;
    const at = (ri, k, inner) => {
      const r = rings[ri];
      const u = k / N;
      const a = a0 + (a1 - a0) * u;
      const rad = inner ? r.r - r.t : r.r;
      const y = r.y + (r.rise || 0) * Math.pow(Math.abs(2 * u - 1), 0.85);
      return [Math.sin(a) * rad * r.sx, y, Math.cos(a) * rad];
    };
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < N; k++) {
        this.quad(at(i, k, false), at(i, k + 1, false),
                  at(i + 1, k + 1, false), at(i + 1, k, false), cols);
        this.quad(at(i, k + 1, true), at(i, k, true),
                  at(i + 1, k, true), at(i + 1, k + 1, true), colIn);
      }
    }
    // hem + the two front edges, so the shell is a solid with a thickness
    const last = rings.length - 1;
    for (let k = 0; k < N; k++) {
      this.quad(at(0, k, true), at(0, k + 1, true), at(0, k + 1, false), at(0, k, false), colIn);
    }
    for (const [k, flip] of [[0, false], [N, true]]) {
      const a = flip ? [at(0, k, true), at(0, k, false), at(last, k, false), at(last, k, true)]
                     : [at(0, k, false), at(0, k, true), at(last, k, true), at(last, k, false)];
      this.quad(a[0], a[1], a[2], a[3], colIn);
    }
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();          // flat shading takes its own, but the
    g.computeBoundingBox();            // bbox probes in main.js want real bounds
    g.computeBoundingSphere();
    return g;
  }
}

/* ------------------------------------------------------------------ *
 * Proportions. Every number is a fraction of STATURE, so one table drives a
 * 1.74 m doctor and a 2.24 m colossus and the height delta stays fact I.4's
 * carrier.
 *
 * ROUND-8b [8b-1] THE HEAD CAME DOWN, AND IT TURNED THE OTHER WAY ROUND.
 * Round 8 built this cast at 0.192 of stature per head — 5.2 heads tall — with
 * every head DEEPER than it was wide (holmes measured 0.873 w/d, the King
 * 0.929). Both of those are exactly wrong for this diorama, and the review named
 * the symptom precisely: under a 26-degree-DOWN camera a deep head presents its
 * CROWN, so the King's unmasked close-up read as a banded barrel with a lid on
 * it — brow stripe, cheek stripe, beard stripe — and no jaw silhouette anywhere,
 * because a chin that short never cleared the shirt collar above it.
 *   So: `headY` 0.808 -> 0.842, i.e. a head spanning 0.158 of stature, 6.3 heads
 * tall, inside the 6-6.5 the review asked for. Every head DEPTH came down about
 * a third while the widths went slightly up, so the skull is now a wide, shallow
 * mask-shape (w/d 1.20-1.34) whose broad front plane faces the key light and
 * whose small crown gives the down-camera very little lid to look at. And the
 * collar came down 0.022 of stature (below) so the chin has somewhere to be.
 * The whole figure's stature is untouched: the crown is still exactly H, so no
 * framing that was fitted to a 2.24 m man has moved under it.
 * ------------------------------------------------------------------ */
const P = {
  ankleY: 0.055, kneeY: 0.280, hipY: 0.505, chestY: 0.600,
  shoulderY: 0.775, neckY: 0.800, headY: 0.842,
  hipX: 0.062, armX: 0.116,
  pelvisHW: 0.086, pelvisHD: 0.062,
  waistHW: 0.079, waistHD: 0.056,
  chestHW: 0.110, chestHD: 0.071,
  shoulderHW: 0.131, shoulderHD: 0.069,
  neckHW: 0.031, neckHD: 0.028,
  /* the head, and every one of these is a HEAD-girth fraction (`wh`, not `w`).
   * WIDER THAN DEEP by construction — every HD is ~0.70 of its HW, so the w/d
   * ratio survives whatever `face.jaw`/`face.skull` do to a build — and TALLER
   * THAN WIDE, because the whole cage is 0.158 of stature high against a 0.056
   * half-width at the temples: 1.4-1.6 tall per wide across the three builds. */
  chinHW: 0.030, chinHD: 0.022,
  jawHW: 0.048, jawHD: 0.032,
  browHW: 0.0575, browHD: 0.036,
  upperHW: 0.051, upperHD: 0.034,
  crownHW: 0.031, crownHD: 0.021,
  thighHW: 0.049, thighHD: 0.054,
  shinHW: 0.039, shinHD: 0.043,
  footHW: 0.041, footHD: 0.075, footH: 0.055, footZ: 0.032,
  uArmHW: 0.038, uArmHD: 0.040,
  lArmHW: 0.031, lArmHD: 0.033,
  handHW: 0.036, handHD: 0.029, handL: 0.082,
  // where a seated figure's hip lands, as a fraction of his standing stature:
  // 0.329 x 1.74 m = 0.572 m, which is the cushion height round 3's vertex
  // deformer reported and the number the wingback's scale is still set from
  // (main.js reads it back as `assets.seat`).
  seatHipY: 0.329,
  // gait envelope
  duty: 0.58,            // fraction of the cycle a foot spends on the floor
  crouch: 0.058,         // the deepest the pelvis may drop (fraction of stature)
  flex: 0.009,           // ...and the bend it never gives up while walking
  lift: 0.098,           // how high the swing foot clears the boards
};

const HEX = (h) => new THREE.Color(h);

/* ------------------------------------------------------------------ *
 * THE FACE LAW (round 8, and the head builder below is only its arithmetic)
 *
 * Likeness lives in the CAMEO CARDS. The mesh's job is to be recognisably the
 * same man as the card — silhouette, hair shape, accent colour — and its
 * features are GEOMETRY. There is not one painted mark on any head: no eyes, no
 * mouth line, no black eye voids. What stood here through the stalled build was
 * two near-black slabs either side of the nose bridge, and at diorama distance
 * they merged into a slit across the face: three masked men on stage, and the
 * King's own gate prop indistinguishable from his colleagues' features.
 *
 * THE EYE BAND IS LIGHT, NOT PAINT. Every head carries a brow ledge standing
 * proud of the socket floor beneath it, so the strip between the two is an
 * UNDERCUT. scene.js's key light comes from up-and-forward (-7, 9, 6): a
 * forward-facing cheek takes it nearly square, an undercut tilted ~30 degrees
 * below horizontal takes almost none of it, and the band goes soft and dark on
 * its own while the ambient and the underlight keep it well off black. Tilt it
 * further and the band deepens — a heavy brow is a DEEPER EYE BAND, which is
 * the whole of the King's face and needs no pigment to say so.
 *
 * `face` per build, all multipliers on that arithmetic:
 *   jaw    jaw + chin width          (Holmes narrow, the King broad)
 *   skull  brow + crown width        (the colossal skull)
 *   brow   ridge protrusion          -> how deep the eye band reads
 *   nose   wedge: narrower AND more proud as it rises
 *   cheek  cheekbone-to-jaw pinch    (the gaunt hollow)
 *   tache  moustache mass, 0 = none
 *   beard  beard mass, 0 = none
 * ------------------------------------------------------------------ */
const FACE0 = { jaw: 1, skull: 1, brow: 1, nose: 1, cheek: 0, tache: 0, beard: 0 };

/* ------------------------------------------------------------------ *
 * The three builds. Silhouette + ONE accent colour each, read off the cameo
 * plates (assets/plates/cameo-*.png) so the card and the figure on stage are
 * the same man:
 *   holmes — grey-green dressing gown over a long coat skirt, dark swept hair,
 *            gaunt (girth 0.92), the tallest lean silhouette at 1.83 m
 *   watson — brown tweed, cream waistcoat, moustache block, stocky (1.10),
 *            1.74 m, and SEATED natively in the wingback
 *   king   — 2.24 m colossus, deep blue floor cloak open at the front over a
 *            FLAME-ORANGE lining, cream tunic, black boots, heavy bearded jaw,
 *            and a detachable domino mask node parented to his head
 * ------------------------------------------------------------------ */
export const BUILDS = {
  holmes: {
    height: 1.83, girth: 0.885, seated: false,
    col: {
      coat: HEX(0x4a6350), coatDark: HEX(0x35492f), trouser: HEX(0x2c3346),
      // his skin is lifted off the cameo's own value: the face is the brightest
      // patch on this head by 4x, which is the face-luma law and the reason a
      // dark-haired man in a dark room still reads as a face and not a mass.
      skin: HEX(0xc0a878), skinDark: HEX(0x8a7852), hair: HEX(0x22242c),
      /* ROUND-8b [8b-5] HANDS ARE NOT FACES. A hand is the same skin as a face
       * but it is never the thing a reader should look at, and at i-12 Watson's
       * out-lumaed his — a warm figure with two bright paddles in his lap. Every
       * build now carries its own `hand`, valued at ~0.82 of its `skin`, so the
       * brightest patch on a figure is his face at every framing by construction
       * rather than by luck of which way a mitten happened to face the key. */
      hand: HEX(0x9d8a63),
      shirt: HEX(0xd8cfae), shoe: HEX(0x1d1a22), accent: HEX(0x4a6350),
    },
    // gaunt: the narrowest jaw, the deepest cheek pinch, the sharpest nose
    face: { jaw: 0.90, skull: 0.96, brow: 1.00, nose: 1.30, cheek: 1.0 },
    gown: true, hairSweep: 1,
  },
  watson: {
    height: 1.74, girth: 1.10, seated: true,
    col: {
      coat: HEX(0x8a5c34), coatDark: HEX(0x5d3d22), trouser: HEX(0x39322c),
      skin: HEX(0xd6a683), skinDark: HEX(0x9c745a), hair: HEX(0x6b4527),
      hand: HEX(0xb08869),                      // [8b-5] 0.82 of his own face
      // the moustache is a shade UP from his hair, not down: a block of mass
      // whose own top facet catches the key, never a bar drawn under the nose
      tache: HEX(0x8a6136),
      /* [8b-5] THE BIB. 0xd9d3bb is a cool cream — blue 187 against red 217 —
       * and under this room's violet fill it came back as a PALE BLUE wedge on a
       * man dressed in brown tweed: the one cold shape on a warm figure, and it
       * read as a bib rather than as a waistcoat. Warmed to a buff whose blue is
       * 136, and dropped to luma 167 so it sits just UNDER his face (173.7) —
       * the same law the hands just took. */
      shirt: HEX(0xbfa478), shoe: HEX(0x241c18), accent: HEX(0x8a5c34),
    },
    // rounder: a broad soft jaw, no hollow, a blunt nose, the moustache block
    face: { jaw: 1.06, skull: 1.02, brow: 0.86, nose: 0.80, cheek: 0.05, tache: 1.0 },
    gown: false, hairSweep: 0.5, tie: HEX(0x2c4a44),
  },
  king: {
    height: 2.24, girth: 1.22, seated: false,
    col: {
      /* ROUND-8 [R8-5] THE CREAM CAME DOWN A STEP, AND THE STEP IS MEASURED.
       * 0xe6dcc0 stood his tunic front and his shoulder facets exactly on the
       * 8-bit clip line: the inbound crossing painted 45-55 px over luma 250 at
       * every one of lap.mjs's four clock phases (worst frame unit t=2.55 s of
       * kingEnter, all of it on `seg:chest`) — [R4-4] again, on a figure whose
       * predecessor's baked value happened to sit just under it. The light is
       * not the lever here: with the threshold lamp off his hottest pixel is
       * still 246.8, and the door's additive glow card contributes nothing at
       * that instant at all (measured, by hiding each). The VALUE is. At
       * 0xc9bfa0 the same frame measures 0 clipped px at all four phases with
       * his own hottest pixel at 247.3-249.2, and the one pixel still up there
       * is an MSAA silhouette edge against the lit landing behind him, which no
       * colour on this figure can move. `coatDark` comes down with it so the
       * lapel keeps the value step a coat reads its opening from. */
      /* ROUND-8b: and one more step down, for the same reason and at the same
       * kind of margin. [8b-2]'s slower exit puts him CLOSER to the door's
       * additive glow at the frame `standScan` catches a fast reader on: at
       * 0xc9bfa0 his hottest own pixel there measured 251.1 and 11 px clipped on
       * the walk-in-0.5s pass (6 portrait). 0xc2b89a is 3.5% down; the same frame
       * measures 0 clipped px with his hottest at 242, and every settled frame in
       * the lap was already 0. `coatDark` steps with it so the lapel keeps the
       * value break a coat reads its opening from. */
      /* ROUND-8c [8c-3 fallout] AND A THIRD STEP DOWN WAS TRIED AND REVERTED.
       * [8c-3]'s longer royal step changes his pelvis bob, so on the fast walk-in
       * (`standScan` at 0.5 s a beat) his shoulder passed the hall lamp at a new
       * phase and 9 of his own pixels clipped at luma 251.0 on `seg:chest`. The
       * reflex was this constant again. It does not work and the measurement says
       * why: 5% down in LINEAR moved that pixel 251.0 -> 250.9, because at 0.04 m
       * from a point light the red channel is saturated several times over and a
       * 5% albedo cut cannot bring it back under 1.0. The cause was a lamp INSIDE
       * the actor, and scene.js [8c-3 fallout] lifted it clear; this value stays
       * where [R8-5] and [8b] measured it, and the cream stays cream. */
      coat: HEX(0xc2b89a), coatDark: HEX(0xa59a7d), trouser: HEX(0x2a2f42),
      /* ROUND-8c [8c-1] THE SKIN IS WARMED TOWARD THE CAMEO AND LIFTED IN VALUE.
       * 0xd8a878 is hue 30 degrees, sat 0.44, value 0.85; the cameo plate's own
       * flesh is #c08765 — hue 22, sat 0.47. This is that hue and that saturation
       * (hue 25, sat 0.45) carried to value 0.94, because the diorama's light is a
       * fifth of daylight and the cameo's value was authored under a card's. It is
       * the FACE that moves this round, not the hair: three rounds of taking the
       * cap down bought the gate and spent the likeness, and [8c-1] rules that
       * lever closed. `skinDark` and `hand` step with it at their own fixed ratios
       * (0.69 and 0.82 of the face's luma), so the neck still reads as shadow and
       * [8b-5]'s "a hand is never the brightest patch on a man" survives. */
      skin: HEX(0xf0b184), skinDark: HEX(0xa57a56), hand: HEX(0xc59169),
      /* ROUND-8 face-luma: his hair was 0xc9b68f — a blond cap whose up-facing
       * facets took the key square and came back BRIGHTER than the face under
       * it, so the head read hair-first. Dulled to a grey-blond, then to 0x8a7550,
       * then 12% further to 0x6a5a3e — three rounds of paying for the face-luma
       * law out of the hair, on a cameo card that shows a blond-brown King.
       * ROUND-8c [8c-1] RESTORED to 0x8a7550. The law is a RATIO and it is now
       * satisfied from the other end: the face fill ([8c-1] in scene.js) puts real
       * light on the plane the cameo's likeness lives on, so the cap can go back
       * to the card's colour and still lose to the cheek under it. This is the
       * number the review asked for by name. */
      hair: HEX(0x8a7550),
      shirt: HEX(0xc2b89a), shoe: HEX(0x14141c), accent: HEX(0x39527a),
      cloak: HEX(0x39527a), cloakIn: HEX(0xd05a2c),
      /* ...and the other half of that fix, which the cameo plate wanted anyway:
       * the beard and moustache came UP 14% / 10% toward the blond the card
       * shows. The face-luma law is a ratio, so it can be satisfied from either
       * end; taking the cap down AND the whiskers up spends less of the
       * likeness than doing all of it with the hair. */
      beard: HEX(0xb29261), tache: HEX(0xb99765),
    },
    /* the colossus: the widest skull of the three, the heaviest brow (so the
     * deepest eye band — which is what the domino sits over and what is still
     * there when it comes off), and a full beard. The width multipliers are
     * MODEST on purpose: girth 1.22 has already widened every horizontal on
     * this figure, and stacking 1.10 on top of that turned his head into a
     * barrel with stripes on it. */
    face: { jaw: 1.02, skull: 1.00, brow: 1.42, nose: 1.00, cheek: 0.10,
            tache: 1.1, beard: 1.0 },
    gown: false, hairSweep: 0.4,
    /* [8b-2] the character cadence: 2.4 FOOTFALLS/s is his ceiling and his
     * baseline is 0.88 of the derived one. Slow, long-period, contained — weight,
     * not hurry, which is what the gait notes ask of a 2.24 m king.
     * ROUND-8c [8c-3] AND THE STEP IS LONG, NOT JUST SLOW.
     *   At 0.88 he cruised at 1.73 footfalls/s and 0.81 m a step, and on the walks
     * where the mover gave him more than 1.65 m/s the step length was PINNED at
     * `stepMax` 0.853 m and the rate ran up to 2.10 instead: a 2.24 m man
     * churning. The review's number for a man this size is 0.9-1.0 m at 1.4-1.5
     * footfalls/s, which at his 1.40 m/s cruise is arithmetic — 1.40/1.45 = 0.97 m.
     *   Two constants get him there and NEITHER touches the foot-lock, the
     * governor or the other two builds. `cadK` 0.747 puts his baseline rate at
     * 1.471 at cruise (f0 = (1.30 + 0.60 v/sizeK) * cadK), i.e. a 0.954 m step.
     * `crouch` is his own now because the step a leg can REACH is capped by how
     * far the pelvis may drop: at the shared 0.058 of stature his ceiling was
     * 0.853 m and 0.954 was simply unreachable. 0.082 of stature is 0.184 m of
     * drop, which buys reachMax 0.580 and stepMax 1.000 — so the cruise step
     * sits at 0.95 of the reach the leg has, with margin, instead of against the
     * stop. It is a CAP, not an amplitude: the pelvis only drops as far as the
     * planted foot makes it, and at cruise that measures 0.165 m at double
     * support against 0.116 m before. A colossus taking a metre-long step dips;
     * that is what a metre-long step is.
     *   ROUND-8d [8d-1] AND NONE OF THAT WAS IN THE PICTURE UNTIL NOW. Every
     * number in the paragraph above is `f`, the cadence arithmetic's answer, and
     * `f` was not what advanced the phase: the trailing-foot governor was
     * misreading a signed offset as a distance and firing on every stance, so the
     * King these constants describe planted his boots every 0.300 s — 3.33
     * footfalls/s, 0.42 m of ground a step. The constants were right and the walk
     * was a churn. With the governor reading the sign, the same two constants now
     * MEASURE, off his own feet on his entrance: 1.43 / 1.46 / 1.54 footfalls/s
     * (min/median/max of the plants) and 0.48 / 0.91 / 0.96 m of ground each, at
     * his 1.40 m/s cruise — the review's 0.9-1.0 m at 1.4-1.5, arrived at by
     * legs rather than by ledger. lap.mjs [8d-1] gates the median plant interval
     * so the two can never drift apart again. */
    cadMax: 2.4, cadK: 0.747, crouch: 0.082,
    cloak: true, mask: true,
  },
};

/* the discarded mask's two jobs, kept from round 3 [R4-5]: near-black while it
 * is worn over a lit face, repainted up to a satin navy as it falls so it still
 * reads as a prop lying on a dark red rug. scene.js drives `paint(k)`. */
const MASK_SHELL_WORN = HEX(0x15182c), MASK_SHELL_DROP = HEX(0x3c4270);
const MASK_TRIM_WORN = HEX(0x1e2136), MASK_TRIM_DROP = HEX(0x5a63a0);

function joint(parent, name, x, y, z) {
  const g = new THREE.Group();
  g.name = 'joint:' + name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function createFigure(opts = {}) {
  const build = BUILDS[opts.build] || BUILDS.holmes;
  const rng = mulberry32((opts.seed || 1) >>> 0);
  const H = opts.height || build.height;
  const C = Object.assign({}, build.col, opts.palette || {});
  const F = Object.assign({}, FACE0, build.face || {}, opts.face || {});
  const G = build.girth;
  const m = (frac) => frac * H;                 // stature fraction -> metres
  const w = (frac) => frac * H * G;             // ...and a horizontal mass
  /* ROUND-8b [8b-1] A HEAD IS NOT A BODY, AND IT MUST NOT TAKE THE WHOLE GIRTH.
   * `girth` is what makes the King a colossus and Holmes a rake — it scales every
   * horizontal on the figure. Applied at full strength to the skull it also made
   * the King's head 0.475 m WIDE against 0.354 m tall: wider than it was tall,
   * which is the barrel the review saw before any depth or camera argument. A
   * heavy man's head is a little broader than a lean man's and no more, so the
   * head and neck take 45% of the girth delta and the body keeps the rest. */
  const GH = 1 + (G - 1) * 0.45;
  const wh = (frac) => frac * H * GH;           // ...and a HEAD horizontal

  const yAnkle = m(P.ankleY), yKnee = m(P.kneeY), yHip = m(P.hipY);
  const yChest = m(P.chestY), yShoulder = m(P.shoulderY), yNeck = m(P.neckY);
  const yHead = m(P.headY);
  const thighLen = yHip - yKnee, shinLen = yKnee - yAnkle;
  const legLen = thighLen + shinLen;
  const uArmLen = m(0.190), lArmLen = m(0.165);
  const hipX = w(P.hipX), armX = w(P.armX);
  const headSpan = H - yHead;

  const root = new THREE.Group();
  root.name = 'figure:' + (opts.build || 'holmes');

  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff, vertexColors: true, flatShading: true });
  const meshes = [];
  const attach = (node, shell) => {
    const mesh = new THREE.Mesh(shell.build(), mat);
    mesh.name = node.name.replace('joint:', 'seg:');
    node.add(mesh);
    meshes.push(mesh);
    return mesh;
  };

  /* ---- the rig: 16 position-only joints, identity rest ---------------- */
  const pelvis = joint(root, 'pelvis', 0, yHip, 0);
  const chest = joint(pelvis, 'chest', 0, yChest - yHip, 0);
  const neck = joint(chest, 'neck', 0, yNeck - yChest, 0);
  const head = joint(neck, 'head', 0, yHead - yNeck, 0);
  const J = { pelvis, chest, neck, head };
  for (const s of [-1, 1]) {
    const sid = s < 0 ? 'L' : 'R';
    const ua = joint(chest, 'upperArm' + sid, s * armX, yShoulder - yChest, 0);
    const la = joint(ua, 'lowerArm' + sid, 0, -uArmLen, 0);
    const hd = joint(la, 'hand' + sid, 0, -lArmLen, 0);
    const ul = joint(pelvis, 'upperLeg' + sid, s * hipX, 0, 0);
    const ll = joint(ul, 'lowerLeg' + sid, 0, -thighLen, 0);
    const ft = joint(ll, 'foot' + sid, 0, -shinLen, 0);
    J['upperArm' + sid] = ua; J['lowerArm' + sid] = la; J['hand' + sid] = hd;
    J['upperLeg' + sid] = ul; J['lowerLeg' + sid] = ll; J['foot' + sid] = ft;
  }

  /* ---- pelvis: hips, and the coat skirt that hangs off them ---------- */
  {
    const s = new Shell(rng);
    s.prism([{ y: -w(0.052), hw: w(P.pelvisHW) * 0.92, hd: w(P.pelvisHD) * 0.94 },
             { y: 0, hw: w(P.pelvisHW), hd: w(P.pelvisHD) },
             { y: m(0.052), hw: w(P.waistHW), hd: w(P.waistHD) }], C.trouser);
    for (const sx of [-1, 1]) s.ball(sx * hipX, 0, 0, w(P.thighHW) * 1.16, C.trouser);
    if (build.gown) {
      // [gown] The skirt is SEGMENTED, front and back on the pelvis and a flap
      // per thigh (below), because one rigid tube round both legs is what
      // makes a striding figure poke through his own coat.
      for (const sz of [1, -1]) {
        s.prism([{ y: -m(0.300), hw: w(0.098), hd: w(0.020), z: sz * w(0.060) },
                 { y: -m(0.120), hw: w(0.094), hd: w(0.019), z: sz * w(0.057) },
                 { y: m(0.045), hw: w(0.080), hd: w(0.018), z: sz * w(0.050) }],
                sz > 0 ? C.coat : C.coatDark);
      }
      // the sash at his waist: the one horizontal in a very vertical figure
      s.prism([{ y: m(0.028), hw: w(P.waistHW) * 1.06, hd: w(P.waistHD) * 1.06 },
               { y: m(0.062), hw: w(P.waistHW) * 1.04, hd: w(P.waistHD) * 1.04 }],
              C.coatDark);
    } else {
      for (const sz of [1, -1]) {
        s.prism([{ y: -m(0.075), hw: w(0.098), hd: w(0.019), z: sz * w(0.060) },
                 { y: m(0.040), hw: w(0.086), hd: w(0.018), z: sz * w(0.052) }],
                sz > 0 ? C.coat : C.coatDark);
      }
    }
    attach(pelvis, s);
  }

  /* ---- chest: torso, shoulders, collar ------------------------------- */
  {
    const s = new Shell(rng);
    const top = yShoulder - yChest;
    s.prism([{ y: -m(0.078), hw: w(P.waistHW), hd: w(P.waistHD) },
             { y: -m(0.010), hw: w(P.chestHW) * 0.96, hd: w(P.chestHD) * 0.96 },
             { y: top - m(0.055), hw: w(P.chestHW), hd: w(P.chestHD) },
             { y: top + m(0.016), hw: w(P.shoulderHW), hd: w(P.shoulderHD) },
             { y: top + m(0.040), hw: w(P.shoulderHW) * 0.80, hd: w(P.shoulderHD) * 0.84 }],
            C.coat);
    // the shirt / waistcoat front: the value step that stops a torso reading as
    // one slab, and for the King it is fact I.5's cream tunic
    s.prism([{ y: -m(0.062), hw: w(0.038), hd: w(0.014), z: w(P.chestHD) * 0.94 },
             { y: top - m(0.020), hw: w(0.044), hd: w(0.014), z: w(P.chestHD) * 0.96 }],
            C.shirt);
    // lapels: two leaning slabs that meet at the sternum and open to the
    // shoulders. A coat reads from its opening more than from its colour.
    for (const sx of [-1, 1]) {
      s.prism([{ y: -m(0.030), hw: w(0.022), hd: w(0.012),
                 x: sx * w(0.026), z: w(P.chestHD) * 0.97 },
               { y: top - m(0.010), hw: w(0.030), hd: w(0.012),
                 x: sx * w(0.072), z: w(P.chestHD) * 0.97 }], C.coatDark);
    }
    if (build.tie) {
      s.slab(0, top - m(0.058), w(P.chestHD) * 1.02, w(0.016), m(0.052), w(0.010), build.tie);
    }
    for (const sx of [-1, 1]) s.ball(sx * armX, top, 0, w(P.uArmHW) * 1.30, C.coat);
    /* the collar. [8b-1] It used to stand to yShoulder + 0.062 of stature — ABOVE
     * the old chin at 0.812 — so every figure's jaw was inside his own shirt and
     * the head began at the mouth. It is a collar and not a chimney now: it tops
     * out at yShoulder + 0.040, which leaves 0.042 of stature of neck under a
     * chin that starts at 0.836. */
    s.prism([{ y: top + m(0.012), hw: w(0.055), hd: w(0.052) },
             { y: top + m(0.040), hw: w(0.046), hd: w(0.044) }], C.shirt);
    if (build.cloak) {
      /* THE CLOAK. Open at the front through ~104 degrees, exactly as the cameo
       * has it: the deep blue is the silhouette, the FLAME-ORANGE lining is what
       * the opening shows, and the cream tunic stands in the gap. It hangs off
       * the CHEST so it swings with his torso, and its hem stops 0.07 of stature
       * off the boards — clear of the deepest the walking pelvis dips. */
      /* [8b-3] the opening widened 0.82 -> 0.90 rad off the front (94 -> 103
       * degrees of clear front) and the hem SWEEPS: at the front edges it stands
       * 0.36 of stature higher than at the spine, so the lowest the cloak comes
       * anywhere abeam of him is 0.326 of stature — 0.73 m on this figure, a
       * clear 0.10 m above a knee at 0.627 m. Behind him it is still a floor
       * cloak. Measured cost: none to the silhouette from the wings; measured
       * gain: both knees on the plate at i-11, i-15 and i-37. */
      const a0 = 0.90, a1 = 2 * Math.PI - 0.90;
      s.cloak([
        { y: -(yChest - m(0.068)), r: w(0.205), t: w(0.022), sx: 1.04, rise: m(0.360) },
        { y: -(yChest - m(0.430)), r: w(0.186), t: w(0.021), sx: 1.04, rise: m(0.140) },
        { y: -m(0.040), r: w(0.160), t: w(0.019), sx: 1.06, rise: m(0.055) },
        { y: top - m(0.024), r: w(0.132), t: w(0.017), sx: 1.10 },
      ], a0, a1, C.cloak, C.cloakIn);
      // the standing collar behind his neck, lining outward
      s.cloak([
        { y: top - m(0.014), r: w(0.124), t: w(0.015), sx: 1.10 },
        { y: top + m(0.104), r: w(0.152), t: w(0.015), sx: 1.14 },
      ], a0 + 0.34, a1 - 0.34, C.cloak, C.cloakIn);
    }
    attach(chest, s);
  }

  /* ---- neck ---------------------------------------------------------
   * [8b-1] It is a real neck now: 0.042 of stature of it stands between the
   * lowered collar and the jaw, and it TAPERS (wide where it leaves the
   * shoulders, narrow under the ear) so the head sits on a column instead of
   * growing straight out of a shirt. That gap is what lets the chin cast the
   * one shadow a face wants and what lets the jaw silhouette read at all. */
  {
    const s = new Shell(rng);
    s.prism([{ y: -m(0.030), hw: wh(P.neckHW) * 1.14, hd: wh(P.neckHD) * 1.10 },
             { y: -m(0.006), hw: wh(P.neckHW), hd: wh(P.neckHD) },
             { y: yHead - yNeck + m(0.006), hw: wh(P.neckHW) * 0.88,
               hd: wh(P.neckHD) * 0.90 }],
            C.skinDark);
    attach(neck, s);
  }

  /* ---- head: ONE FACE CAGE, and the identity is in its numbers --------
   * See THE FACE LAW above. Every ring below is `(y, halfWidth, frontZ, backZ)`:
   * the front profile is authored SEPARATELY from the back, which is the whole
   * trick — it lets the brow stand proud of the socket beneath it inside a
   * single closed prism, and that overhang is the eye band. ~110 triangles for
   * the skull cage, ~40 for the nose wedge, and no pigment anywhere.
   * ------------------------------------------------------------------ */
  const hs = headSpan;
  /* the eye band: `bandY` tall, with `ledge` of overhang across it, so the
   * undercut's tilt below horizontal is atan(ledge / bandY) — a pure function
   * of face.brow at every stature, which is why a 2.24 m colossus and a 1.74 m
   * doctor get the same kind of band and not the same number of millimetres. */
  /* [8b-1] RETUNED TO THE NEW SKULL. The band is 0.086 of the span (was 0.078)
   * and the overhang across it went 0.30+0.28*brow -> 0.34+0.34*brow, i.e. the
   * undercut now tilts 32-39 degrees below horizontal across the cast instead of
   * 28-35. Two reasons, both consequences of the rework: the head is 18% shorter,
   * so a band cut to the old fraction was a 20 mm stripe on the King and read as
   * a line rather than as a socket; and the skull is 34% shallower, so the same
   * DEGREES of tilt buy fewer millimetres of shadow than they used to. Deeper
   * tilt is the face law's own lever for a heavier brow — it is what `face.brow`
   * has always moved — and it is still an undercut catching ambient, never paint. */
  const bandY = hs * 0.086;
  const ledge = bandY * (0.34 + 0.34 * F.brow);
  /* the front profile. `mouth` sits all but flush with `cheek` on purpose: the
   * mid-face is then a near-vertical plane that takes the key nearly square and
   * is the brightest thing on the head — the face-luma law is a NORMAL, not a
   * colour. (Slope it forward as it rises, as the first cut did, and the whole
   * lower face turns its back on the key and the man goes dark from the mouth
   * down.) The chin below it still falls away, which is the one shadow a face
   * wants. */
  const fz = {
    chin: wh(P.chinHD) * 0.88,
    mouth: wh(P.jawHD) * 0.99,
    cheek: wh(P.browHD) * 0.99,
  };
  fz.socket = fz.cheek - ledge * 0.34;      // the floor withdraws under the ridge
  fz.brow = fz.cheek + ledge * 0.66;        // ...and the ridge stands out over it
  /* ROUND-8c [8c-2] and the CAGE's floor withdraws two and a half times as far as
   * the nose's datum does. Round 8b could not do this: the cage ring is full width,
   * so a deeper floor was a deeper slot from ear to ear. With the bridge and the
   * temples lifting that floor back to face level everywhere but the two windows
   * ([8c-2], below), the only thing a deeper ring deepens IS the window — so the
   * undercut over it tilts 52 degrees below horizontal instead of 39, which takes
   * the diorama's own down-front `under` lamp off it (N·L 0.905 -> 0.827, and the
   * fill's 0.061 -> 0) and drops the socket from 0.62 of the lit cheek's luma to
   * 0.55. `fz.socket` itself does not move: it is the nose's and the bridge's
   * datum, and pulling those back with the floor would flatten the mid-face. */
  fz.eyeFloor = fz.cheek - ledge * 0.86;
  /* [8b-1] the band sits at 0.545 of the span, not 0.517. Chin-to-crown is
   * 0.015..0.985 now, so 0.545 is a hair above the mid-point of the head — an
   * eye line, where the old number landed low on a skull whose crown owned the
   * top third. It is also the split the below-band gate measures against: a
   * 26-degree-down camera has to find at least 45% of a head's painted pixels
   * UNDER this line, which is the arithmetic statement of "he has a jaw". */
  const bandMidY = hs * 0.545;              // where a domino would sit
  // the widths: jaw off face.jaw, brow/crown off face.skull, and the hollow
  // between them pinched by face.cheek — a gaunt man is a WAISTED silhouette
  const jawW = P.jawHW * F.jaw, chinW = P.chinHW * F.jaw;
  const browW = P.browHW * F.skull, upperW = P.upperHW * F.skull;
  const crownW = P.crownHW * F.skull;
  const hollowW = (jawW * 0.46 + browW * 0.54) * (1 - 0.105 * F.cheek);
  /** a ring from an explicit front and back face, both in metres */
  const R = (y, hwFrac, front, back, bev) =>
    ({ y: hs * y, hw: wh(hwFrac), hd: (front - back) / 2, z: (front + back) / 2, bev });
  /* THE SKULL, as data — because the hairline is then placed OFF the profile
   * instead of guessed against it. `skullFront(y)` interpolates the cage's own
   * front face, so the hair cap can be set a few millimetres proud of the
   * forehead at whatever height it wants and the hairline lands there for every
   * build, at every stature, however heavy the brow. Guessing it is what gave
   * the first cut a bowl-cut down to the eyebrows. */
  /* [8b-1] EIGHT rings, not seven, and the extra one is the JAW CORNER at 0.150.
   * A chin ring wired straight to the jaw ring gave a cone with a flat bottom —
   * the "barrel" the review saw, because from a down camera the only thing that
   * distinguishes a jaw from a neck is the corner where it turns. With the
   * corner in, the silhouette runs chin -> gonial angle -> cheek and the lower
   * face is a shape instead of a taper. */
  const SKULL = [
    [0.015, chinW, fz.chin, -wh(P.chinHD) * 0.86],
    [0.150, jawW * 0.93, fz.mouth * 0.99, -wh(P.jawHD) * 0.95],   // the jaw corner
    [0.290, jawW, fz.mouth, -wh(P.jawHD)],
    [0.430, hollowW, fz.cheek * 0.994, -wh(P.browHD) * 0.99],
    /* ROUND-8c [8c-2] these two rings are the eye band, and they carry a 0.22
     * bevel instead of the default 0.34. The bevel is what decides how much of a
     * ring is FLAT FRONT FACE and how much is chamfer running back toward the ear:
     * at 0.34 the front face is 0.66 of the half-width, so a socket cut to the
     * boss's width ran off the front of the face and the chamfer beyond it carried
     * the undercut on round the head — the "nearly full face width" the review
     * measured, and the reason the first cut of this fix still showed a bar. At
     * 0.22 the front face is 0.78 of the half-width, the two sockets and the
     * temple lifts fit inside it, and the strip that is still chamfer is 12% of the
     * head's width at the very edge of the plate. A brow ridge IS a flatter plate
     * than a cranium; this is the ring saying so. */
    [0.502, browW * 0.99, fz.eyeFloor, -wh(P.browHD), 0.22],   // the socket floor
    [0.588, browW, fz.brow, -wh(P.browHD) * 0.99, 0.22],       // the brow ledge
    [0.790, upperW, wh(P.upperHD) * 0.93, -wh(P.upperHD)],
    /* [8b-1] the DOME ring. Without it the cage went from a full-width temple at
     * 0.790 straight to the crown at 0.985 — one step, which from any camera
     * above the horizon is a lid on a drum, and it is most of what "barrel" meant.
     * With it the skull closes over two facets and the widest point of the whole
     * head is where a head's widest point belongs: the temples. */
    [0.905, upperW * 0.855, wh(P.upperHD) * 0.62, -wh(P.upperHD) * 0.80],
    [0.985, crownW, wh(P.crownHD) * 0.88, -wh(P.crownHD)],
  ];
  const skullAt = (y, i3) => {
    if (y <= SKULL[0][0]) return SKULL[0][i3];
    for (let i = 1; i < SKULL.length; i++) {
      if (y <= SKULL[i][0]) {
        const k = (y - SKULL[i - 1][0]) / (SKULL[i][0] - SKULL[i - 1][0]);
        return SKULL[i - 1][i3] + (SKULL[i][i3] - SKULL[i - 1][i3]) * k;
      }
    }
    return SKULL[SKULL.length - 1][i3];
  };
  const skullFront = (y) => skullAt(y, 2), skullBack = (y) => skullAt(y, 3);
  /* [8b-1] ...and the cage's own WIDTH at a height, for the same reason the
   * front profile is readable: the hair cap is set a fixed 3% proud of whatever
   * the skull is doing at the hairline instead of off `browW`, which on a head
   * that tapers above the brow is 12% proud and reads as a helmet over the
   * temples rather than as hair on a skull. */
  const skullW = (y) => skullAt(y, 1);
  {
    const s = new Shell(rng);
    s.prism(SKULL.map((r) => R(r[0], r[1], r[2], r[3], r[4])), C.skin);
    /* the nose: a wedge that gets NARROWER and MORE PROUD as it rises, so
     * face.nose 1.3 is a blade and 0.8 is a button. Its back rings are buried
     * inside the skull, which is what welds it on with no seam. */
    const nW = 0.018 * (1.16 - 0.16 * F.nose), nOut = wh(0.0095) * F.nose;
    const nBack = fz.cheek - wh(0.024);
    s.prism([
      R(0.335, nW * 1.00, fz.mouth + nOut * 0.34, nBack, 0.30),
      R(0.455, nW * 0.82, fz.cheek + nOut, nBack, 0.30),
      R(0.545, nW * 0.58, fz.socket + nOut * 0.34, nBack, 0.30),
    ], C.skin);
    /* [8b-1] THE BROW BOSSES — the last piece of the geometry-only face law, and
     * the one that makes the band read as EYES rather than as a stripe. Two
     * superciliary ridges straddling the brow ledge either side of the nose,
     * standing `ledge * 0.55` proud of it: their own top facets take the key
     * nearly square (they are the brightest thing on the head after the cheek)
     * and the strip between each boss and the socket floor beneath it is a
     * second, deeper undercut, INSIDE the first. Same skin, same material, no
     * pigment: two shapes, and the shadow they cast is the eye. `face.brow`
     * drives their projection exactly as it drives the ledge, so the King's
     * 1.42 gets caves and Watson's 0.86 gets a soft ridge. */
    /* ROUND-8c [8c-2] TWO SOCKETS, NOT A VISOR SLOT — and the whole fix is that
     * the boss and the hole under it are now cut from ONE pair of numbers.
     *   The undercut that makes the eye band is cut into the SKULL CAGE, and the
     * cage is a stack of full-width rings: the socket floor at 0.502 withdraws
     * `ledge * 0.34` behind the cheek plane and the brow ledge at 0.588 stands
     * `ledge * 0.66` proud of it ACROSS THE WHOLE FACE. On the King that was a
     * single 283 mm slot from temple to temple with two 76 mm bosses sitting on
     * top of it — one dark bar, which at diorama size is a visor.
     *   The cage cannot be cut into (the shell is additive), so the floor is
     * LIFTED back to face level everywhere the socket is not: the NASION-GLABELLA
     * between the pair, carrying the nose up to the brow ridge, and a TEMPLE
     * outboard of each. Both run from the cheek plane up to the brow ledge's own
     * front, so in those places the face is one continuous plane and there is no
     * overhang left to shade. What stays in shadow is exactly the two windows.
     *   THE WINDOW IS ALSO NARROWER. `eyeX`/`eyeHW` put each socket at 0.15-0.53
     * of the brow's half-width, i.e. a 54 mm window with its centre 48 mm off the
     * nose: 0.51 of the head's FRONT FACE apart, which is where a pair of eyes
     * belongs. (The front face is 0.66 of the cage's half-width — outside that the
     * ring's own 0.34 bevel is chamfering back toward the ear, so a socket cut to
     * the old 0.74 ran off the front of the face and any temple mass filling
     * beside it stood 33 mm proud of the chamfer and read as a tab.)
     *   No mass here touches the silhouette: every ring is inside the cage's own
     * width at its own height (`skullW`) and inside the band's own height, so the
     * below-band split, the chin fraction and the head's w/d are untouched. */
    const eyeX = wh(browW) * 0.34, eyeHW = wh(browW) * 0.19;
    const faceFrontW = (y) => wh(skullW(y)) * 0.78;   // the ring's un-bevelled front
    for (const sx of [-1, 1]) {
      const bx = eyeX, bw2 = eyeHW;
      s.prism([
        { y: hs * 0.548, hw: bw2 * 0.84, hd: wh(0.005), x: sx * bx,
          z: fz.brow + ledge * 0.16, bev: 0.34 },
        { y: hs * 0.584, hw: bw2, hd: wh(0.006), x: sx * bx * 0.98,
          z: fz.brow + ledge * 0.52, bev: 0.34 },
        { y: hs * 0.616, hw: bw2 * 0.88, hd: wh(0.005), x: sx * bx * 0.96,
          z: fz.brow + ledge * 0.06, bev: 0.34 },
      ], C.skin);
    }
    {
      /* the nasion and the glabella: the nose's own top ring continued up between
       * the two sockets to the brow. Its lowest ring is INSIDE the nose wedge, so
       * the two weld with no seam and the bridge is not a plate stuck on a face. */
      const brW = eyeX - eyeHW;
      s.prism([
        { y: hs * 0.505, hw: wh(nW * 0.62), hd: wh(0.020),
          z: fz.socket + nOut * 0.40 - wh(0.020), bev: 0.32 },
        { y: hs * 0.562, hw: brW * 0.92, hd: wh(0.021),
          z: fz.cheek + ledge * 0.22 - wh(0.021), bev: 0.32 },
        { y: hs * 0.614, hw: brW, hd: wh(0.022),
          z: fz.brow - ledge * 0.06 - wh(0.022), bev: 0.32 },
      ], C.skin);
      /* the temples: from each socket's outer edge to the edge of the head's own
       * front face at that height, so this mass can never reach the chamfer. */
      const tIn = eyeX + eyeHW;
      for (const sx of [-1, 1]) {
        s.prism([[0.470, fz.cheek - ledge * 0.04, 0.019],
                 [0.552, fz.cheek + ledge * 0.20, 0.020],
                 [0.618, fz.brow - ledge * 0.10, 0.021]].map(([y, front, hdF]) => {
          const out = faceFrontW(y), hd = wh(hdF);
          return { y: hs * y, hw: Math.max(wh(0.0015), (out - tIn) / 2),
                   x: sx * (out + tIn) / 2, hd, z: front - hd, bev: 0.32 };
        }), C.skin);
        /* the LOWER LID, and it is what turns a slot into a socket. Without it the
         * window's floor ran all the way down to the cheek ring and the eye was an
         * open-bottomed notch; with it the recess is closed on all four sides —
         * boss above, bridge inboard, temple outboard, lid below — and the lid's
         * own top facet catches the fill, so a lit edge sits under the shadow the
         * way a lower lid does. */
        s.prism([
          { y: hs * 0.455, hw: eyeHW * 0.90, hd: wh(0.019), x: sx * eyeX,
            z: fz.cheek - ledge * 0.10 - wh(0.019), bev: 0.32 },
          { y: hs * 0.512, hw: eyeHW * 0.98, hd: wh(0.020), x: sx * eyeX,
            z: fz.cheek + ledge * 0.06 - wh(0.020), bev: 0.32 },
        ], C.skin);
      }
    }
    if (F.beard > 0) {
      /* the King's full faceted beard: mass hung under the chin and up the jaw
       * to the temples. The top ring's front is INSIDE the cheek plane, so the
       * beard shows as jaw and sideburn and never as a bib across his face. */
      /* [8b-1] and it TAPERS to a point under the chin (the -0.060 ring is 0.62
       * of the chin's own width) instead of ending on a flat slab at -0.030.
       * That point is the reason the beard reads as a beard from above: it hangs
       * BELOW the head joint, into the neck gap the lowered collar opened, so
       * the down-camera gets jaw mass where it used to get shirt. */
      const bm = F.beard;
      s.prism([
        R(-0.048, chinW * 0.50, fz.chin * 0.70, -wh(P.chinHD) * 0.46, 0.4),
        R(0.055, chinW * 1.12, fz.chin * 1.06 + wh(0.006) * bm, -wh(P.jawHD) * 0.90, 0.3),
        R(0.190, jawW * 1.05, fz.mouth + wh(0.010) * bm, -wh(P.jawHD) * 1.02),
        R(0.330, (jawW * 0.62 + browW * 0.38) * 1.02, fz.cheek + wh(0.002) * bm,
          -wh(P.jawHD) * 1.04),
        /* the sideburn stops INSIDE the cheekbone (0.94 of the brow's width), so
         * the widest thing on the King's head is his temple and not his whiskers
         * — the beard reading as wide as the skull is the other half of "barrel" */
        R(0.440, browW * 0.94, fz.cheek - wh(0.012), -wh(P.browHD) * 0.99),
      ], C.beard || C.hair);
    }
    if (F.tache > 0) {
      /* the moustache BLOCK: wider and prouder at the top than at the bottom,
       * so its own top facet catches the key and its underside falls away. Two
       * rings, and the reason it is not a bar drawn under the nose. */
      const tm = F.tache;
      const tz = fz.mouth + wh(0.007) * tm;
      /* [8b-1] and it is 40% of the head's width now, not 63%: at the widths the
       * old table gave a head, the block spanned nearly cheek to cheek and read
       * as one more horizontal BAR on a head the review already called banded. */
      s.prism([
        { y: hs * 0.250, hw: wh(0.009 * tm + 0.006), hd: wh(0.008), z: tz - wh(0.004) },
        { y: hs * 0.302, hw: wh(0.013 * tm + 0.008), hd: wh(0.011), z: tz },
      ], C.tache || C.hair);
    }
    /* hair: a swept cap over the crown and the back of the skull. HAIRLINE is
     * where the cap's front face crosses the skull's, so it is set to cross at
     * `hl` — high enough that the forehead above the brow ledge stays a lit
     * plane, which is a third of the face's whole luma budget. */
    const sw = build.hairSweep;
    /* [8b-1] HAIRLINE 0.700 -> 0.735 and the cap shrank. The old cap topped out
     * at 1.035 of the span at 1.22x the crown's width, which on a head whose
     * crown owned the upper third was a LID: from the 26-degree-down camera it
     * was the largest single facet on the figure, and it is most of why the
     * below-band fraction sat at 0.38-0.46. It ends at 1.020 at 1.16x now, over
     * a smaller crown, and the hairline moved up to keep a forehead between the
     * brow ledge (0.584) and the cap. */
    const hl = 0.735;
    s.prism([R(hl, skullW(hl) * 1.030, skullFront(hl) + wh(0.0012),
               skullBack(hl) - wh(0.0035), 0.4),
             R(0.880, skullW(0.880) * 1.050, skullFront(0.880) + wh(0.005),
               skullBack(0.880) - wh(0.004 + 0.006 * sw), 0.4),
             /* ROUND-8c [8c-5] the cap's top ring came down 1.015 -> 1.006 of the
              * span. `hs` IS `H - headY`, so a ring at 1.000 puts the highest
              * vertex on this figure exactly at his stated stature: at 1.015 the
              * King's mesh stood 5.3 mm PROUD of the 2.24 m fact I.4 depends on
              * and Holmes' 4.3 mm proud of 1.83, which is a build lying to its own
              * dims by a hair. 1.006 is 2.1 mm and 1.7 mm, inside the review's
              * 5 mm, and it is three millimetres off a hair cap. */
             R(1.006, skullW(0.985) * 1.13, skullFront(1.0) + wh(0.007),
               skullBack(1.0) - wh(0.006 + 0.009 * sw), 0.4)], C.hair);
    /* [8b-1] THE NAPE. The cap's lowest ring is the hairline, so from behind
     * every head in this cast was bald from the crown down — visible on Holmes,
     * who stands with his back three-quarters to the lens for most of the beat.
     * This is a back-only mass: its FRONT face is buried inside the skull and it
     * is 0.80-1.02 of the cage's width, so it can only ever show as hair at the
     * back of the head and at the nape, and it never touches the face. */
    s.prism([R(0.315, skullW(0.315) * 0.80, skullBack(0.315) + wh(0.012),
               skullBack(0.315) - wh(0.0012), 0.4),
             R(0.560, skullW(0.560) * 0.92, skullBack(0.560) + wh(0.016),
               skullBack(0.560) - wh(0.0012), 0.4),
             R(hl, skullW(hl) * 1.02, skullBack(hl) + wh(0.018),
               skullBack(hl) - wh(0.0030), 0.4)], C.hair);
    // the fringe, swept to his left, over the temple — inside the cap's own
    // silhouette, so it reads as a sweep in the hair and not as a horn on it
    s.prism([{ y: hs * (hl - 0.018), hw: wh(0.021 * F.skull), hd: wh(0.013),
               x: -wh(0.009 * sw), z: skullFront(hl) - wh(0.011) },
             { y: hs * 0.874, hw: wh(0.025 * F.skull), hd: wh(0.016),
               x: -wh(0.015 * sw), z: skullFront(0.874) - wh(0.015) }], C.hair);
    attach(head, s);
  }

  /* ---- arms --------------------------------------------------------- */
  for (const s of [-1, 1]) {
    const sid = s < 0 ? 'L' : 'R';
    const up = new Shell(rng);
    up.prism([{ y: -uArmLen - m(0.006), hw: w(P.lArmHW) * 1.10, hd: w(P.lArmHD) * 1.10 },
              { y: -uArmLen * 0.45, hw: w(P.uArmHW), hd: w(P.uArmHD) },
              { y: m(0.020), hw: w(P.uArmHW) * 1.10, hd: w(P.uArmHD) * 1.08 }], C.coat);
    up.ball(0, -uArmLen, 0, w(P.lArmHW) * 1.24, C.coat);
    attach(J['upperArm' + sid], up);

    const lo = new Shell(rng);
    lo.prism([{ y: -lArmLen - m(0.004), hw: w(P.lArmHW) * 0.92, hd: w(P.lArmHD) * 0.94 },
              { y: -lArmLen * 0.35, hw: w(P.lArmHW), hd: w(P.lArmHD) },
              { y: m(0.008), hw: w(P.lArmHW) * 1.08, hd: w(P.lArmHD) * 1.06 }],
             build.gown ? C.coat : C.coatDark);
    // cuff
    lo.prism([{ y: -lArmLen - m(0.002), hw: w(P.lArmHW) * 1.08, hd: w(P.lArmHD) * 1.08 },
              { y: -lArmLen + m(0.026), hw: w(P.lArmHW) * 1.05, hd: w(P.lArmHD) * 1.05 }],
             C.coatDark);
    lo.ball(0, -lArmLen, 0, w(P.handHW) * 1.02, C.hand || C.skin);   // the wrist
    attach(J['lowerArm' + sid], lo);

    // hands: mitten blocks with a thumb nub, because a five-fingered hand at
    // this scale is 40 triangles that resolve to three pixels
    const hn = new Shell(rng);
    const skinH = C.hand || C.skin;
    hn.prism([{ y: -w(P.handL), hw: w(P.handHW) * 0.82, hd: w(P.handHD) * 0.86 },
              { y: -w(P.handL) * 0.45, hw: w(P.handHW), hd: w(P.handHD) },
              { y: 0, hw: w(P.handHW) * 0.94, hd: w(P.handHD) * 0.96 }], skinH);
    hn.prism([{ y: -w(P.handL) * 0.62, hw: w(0.012), hd: w(0.012),
                x: -s * w(P.handHW) * 0.86, z: w(P.handHD) * 0.5 },
              { y: -w(P.handL) * 0.18, hw: w(0.013), hd: w(0.013),
                x: -s * w(P.handHW) * 0.94, z: w(P.handHD) * 0.6 }], skinH);
    attach(J['hand' + sid], hn);
  }

  /* the carry socket: an empty Group at the grip of the right fist. The note is
   * parented HERE, which is what lets the arm carry it — scene.js no longer
   * guesses a hand position and drives the paper to it. */
  const socket = new THREE.Group();
  socket.name = 'socket:carryR';
  socket.position.set(0, -w(P.handL) * 0.58, w(P.handHD) * 1.05);
  J.handR.add(socket);

  /* ---- legs --------------------------------------------------------- */
  for (const s of [-1, 1]) {
    const sid = s < 0 ? 'L' : 'R';
    const th = new Shell(rng);
    const thighCol = build.gown ? C.coat : C.trouser;
    th.prism([{ y: -thighLen - m(0.006), hw: w(P.shinHW) * 1.16, hd: w(P.shinHD) * 1.16 },
              { y: -thighLen * 0.45, hw: w(P.thighHW), hd: w(P.thighHD) },
              { y: m(0.030), hw: w(P.thighHW) * 1.12, hd: w(P.thighHD) * 1.08 }], thighCol);
    if (build.gown) {
      // the gown's thigh flap — it swings WITH the leg, so the skirt reads long
      // and the leg never comes through it
      th.prism([{ y: -thighLen - m(0.098), hw: w(0.058), hd: w(P.thighHD) * 1.10,
                  x: s * w(0.014) },
                { y: -thighLen * 0.4, hw: w(0.068), hd: w(P.thighHD) * 1.20,
                  x: s * w(0.016) },
                { y: m(0.020), hw: w(0.066), hd: w(P.thighHD) * 1.16, x: s * w(0.012) }],
               C.coatDark);
    }
    th.ball(0, -thighLen, 0, w(P.shinHW) * 1.28, thighCol);
    attach(J['upperLeg' + sid], th);

    const sh = new Shell(rng);
    sh.prism([{ y: -shinLen - m(0.004), hw: w(P.footHW) * 0.94, hd: w(P.shinHD) * 0.96 },
              { y: -shinLen * 0.42, hw: w(P.shinHW), hd: w(P.shinHD) },
              { y: m(0.006), hw: w(P.shinHW) * 1.10, hd: w(P.shinHD) * 1.08 }], C.trouser);
    // the boot's top, in the shoe colour: the King's black boots read from here
    sh.prism([{ y: -shinLen - m(0.006), hw: w(P.footHW) * 1.00, hd: w(P.shinHD) * 1.02 },
              { y: -shinLen + m(0.075), hw: w(P.shinHW) * 1.06, hd: w(P.shinHD) * 1.04 }],
             C.shoe);
    sh.ball(0, -shinLen, 0, w(P.footHW) * 1.02, C.shoe);
    attach(J['lowerLeg' + sid], sh);

    const ft = new Shell(rng);
    ft.prism([{ y: -m(P.footH), hw: w(P.footHW) * 1.02, hd: w(P.footHD),
                z: w(P.footZ), bev: 0.28 },
              { y: -m(P.footH) * 0.35, hw: w(P.footHW) * 1.06, hd: w(P.footHD) * 1.02,
                z: w(P.footZ), bev: 0.28 },
              { y: m(0.004), hw: w(P.footHW), hd: w(P.footHD) * 0.80,
                z: w(P.footZ) * 0.7, bev: 0.28 }], C.shoe);
    attach(J['foot' + sid], ft);
  }

  /* ---- the mask node ------------------------------------------------ *
   * A thin black domino with a raked strap, parented to the HEAD — which is what
   * retires round 3's dual-GLB unmask (king.glb baked the vizard into the mesh,
   * so the gate had to swap a whole 100k-tri model to take it off). Now the gate
   * detaches a node. It carries its own two materials so the fall can repaint it
   * ([R4-5]) without touching the figure's single body material.
   * ------------------------------------------------------------------ */
  let mask = null;
  if (build.mask) {
    const node = new THREE.Group();
    node.name = 'maskNode';
    /* it sits ON THE EYE BAND, off the same two numbers the band is cut from
     * (`bandMidY`, `fz.brow`) rather than off a typed offset — so a heavier brow
     * moves the vizard with it and the domino can never float or sink into the
     * face it is covering. */
    node.position.set(0, bandMidY, fz.brow + wh(0.004));
    head.add(node);
    const shellMat = new THREE.MeshLambertMaterial({
      color: MASK_SHELL_WORN.getHex(), vertexColors: true, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({
      color: MASK_TRIM_WORN.getHex(), vertexColors: true, flatShading: true });
    const voidMat = new THREE.MeshLambertMaterial({
      color: 0x07080e, vertexColors: true, flatShading: true });
    const WHITE = HEX(0xffffff);
    /* [8b-1] the vizard is cut in HEAD girth too, and re-scaled to the smaller
     * skull: lobe + offset reach 0.055 of stature against a temple half-width of
     * 0.0554, so the domino still covers the eye band corner to corner and still
     * reads AS a domino at the gate's 3.55 m radius. */
    const lobeW = wh(0.027), lobeH = hs * 0.072, lobeX = wh(0.028);
    const sShell = new Shell(rng, 0.03), sTrim = new Shell(rng, 0.03),
          sVoid = new Shell(rng, 0.02);
    for (const sx of [-1, 1]) {
      sShell.slab(sx * lobeX, 0, wh(0.005), lobeW, lobeH, wh(0.005), WHITE, 0.26);
      sVoid.slab(sx * lobeX, hs * 0.004, wh(0.009), lobeW * 0.50, lobeH * 0.36,
                 wh(0.004), WHITE, 0.2);
    }
    sShell.slab(0, hs * 0.016, wh(0.005), wh(0.013), lobeH * 0.52, wh(0.005), WHITE, 0.26);
    sTrim.slab(0, hs * 0.042, wh(0.005), lobeX + lobeW, lobeH * 0.20, wh(0.005), WHITE, 0.2);
    for (const sx of [-1, 1]) {
      const st = new Shell(rng, 0.03);
      st.prism([{ y: hs * 0.016, hw: wh(0.004), hd: wh(0.020),
                  x: sx * (lobeX + lobeW * 0.92), z: -wh(0.020) },
                { y: hs * 0.028, hw: wh(0.004), hd: wh(0.020),
                  x: sx * (lobeX + lobeW * 1.35), z: -wh(0.023) }], WHITE);
      const mesh = new THREE.Mesh(st.build(), trimMat);
      mesh.name = 'maskStrap';
      node.add(mesh);
    }
    const shellMesh = new THREE.Mesh(sShell.build(), shellMat);
    shellMesh.name = 'maskShell';
    const trimMesh = new THREE.Mesh(sTrim.build(), trimMat);
    trimMesh.name = 'maskBrow';
    const voidMesh = new THREE.Mesh(sVoid.build(), voidMat);
    voidMesh.name = 'maskVoid';
    node.add(shellMesh, trimMesh, voidMesh);
    mask = {
      node, shellMat, trimMat, voidMat,
      hits: [shellMesh, trimMesh, voidMesh],
      rest: { pos: node.position.clone(), quat: node.quaternion.clone(), scale: 1 },
      paint(k) {
        shellMat.color.copy(MASK_SHELL_WORN).lerp(MASK_SHELL_DROP, k);
        trimMat.color.copy(MASK_TRIM_WORN).lerp(MASK_TRIM_DROP, k);
      },
    };
    // ...once each: node.children already holds the three added above plus the
    // two straps, and pushing the list twice made the style ledger claim 24
    // meshes on a King who has 21.
    for (const mm of node.children) if (mm.isMesh && !meshes.includes(mm)) meshes.push(mm);
  }

  /* ================================================================== *
   * ANIMATION
   * ================================================================== */
  const rest = {
    /* the "at ease" offsets the pose starts from. These are POSE values, not
     * rest rotations: every joint's rest rotation is identity, which is what
     * makes the numbers below mean what they say. */
    shX: -0.045, shZ: 0.055, elX: -0.130, wrX: 0.030,
  };

  const a = {
    // damped pose channels
    lift: 0, reach: 0, present: 0, seat: build.seated ? 1 : 0, w: 0,
    // gait: the COMMANDED rate/step (what the drive asks for)...
    phase: 0, ff: 0, stepLen: 0, speed: 0, walkPrev: false,
    /* ...and [8d-1] THE MEASURED ONE: the interval between two real plants of
     * ALTERNATING feet and the ground the body covered inside it. `ff` is what
     * the cadence arithmetic wants; `plantHz` is what the reader's eye counts,
     * and after [8d-1] they are the same number in a steady walk — but only the
     * second one is allowed to be reported as the footfall rate. */
    plantT: -1, plantSide: -1, plantX: 0, plantZ: 0, plantHz: 0, plantStep: 0,
    // [8c-3] the previous frame's body position, and the teleport flag it raises
    lastX: 0, lastZ: 0, hasLast: false, teleported: false,
    // scripted one-shots the scene owns (0..1)
    toss: 0, unmask: 0,
    /* per-leg foot bookkeeping, in ROOM space. [8d-1] `fwd`/`lat` are the plant's
     * offset from its OWN HIP SOCKET in figure space — fwd SIGNED (+ ahead of the
     * socket, - trailing it), lat the sideways part — because the room a stance
     * has left is a signed quantity and the governor read it as a distance. */
    leg: [null, null].map(() => ({ planted: false, px: 0, pz: 0,
                                   fromX: 0, fromZ: 0, lx: 0, lz: 0, ly: 0,
                                   fwd: 0, lat: 0 })),
  };

  const drive = {
    speed: 0, walking: false, pos: new THREE.Vector3(), yaw: 0,
    lift: 0, reach: 0, present: 0, look: 0,
    toss: 0, unmask: 0,
    seated: build.seated ? 1 : 0,
    breathW: 1.1, breathPhase: 0,
  };

  /* the walk envelope, derived from the skeleton rather than typed:
   * stepMax is the longest STEP (one footfall to the next) whose stance the leg
   * can still REACH with no more than `crouch` of pelvis drop, so the IK never
   * clamps and the planted foot never has to slide.
   * ROUND-8c [8c-3] `crouch` may now be a per-build override (the King's), because
   * it is the only thing standing between a 2.24 m man and a step his own legs are
   * long enough to take. Everyone else keeps the shared P.crouch. */
  const maxCrouch = m(build.crouch || P.crouch);
  const reachMax = Math.sqrt(Math.max(1e-6,
    legLen * legLen - Math.pow(legLen - maxCrouch, 2)));
  const stepMax = reachMax / P.duty;
  const sizeK = H / 1.78;
  /* ROUND-8c [8c-3] THE UNIT IS FOOTFALLS PER SECOND, everywhere, and it always
   * was: `a.phase` advances by PI * (a rate) * dt, so at a rate of f one full
   * two-legged CYCLE takes 2/f seconds and each leg plants once in it — f
   * footfalls a second, and the step length a footfall covers is v/f. "steps/s"
   * was ambiguous enough that a reader could read the cycle rate into it (which
   * would be f/2), so the name and every number reported off it say FOOTFALL now.
   * A stride, in the biomechanical sense of a whole cycle, is 2 x stepLen.
   *   ROUND-8d [8d-1] AND THE RATE IN THAT LINE IS `fg`, NOT `f`. The governor
   * below may raise the cadence above the one derived here, so `f` is what the
   * arithmetic ASKED FOR and only `fg` moved the feet. Naming them apart is the
   * whole of the round-8c stride bug: `f` was reported as the footfall rate for a
   * walk the governor was driving at 2.3x it. Nothing is reported off `f` now
   * except under the name `driveHz`. */
  const cadMax = build.cadMax || 5.6;      // footfalls/s this man will take at all
  const cadK = build.cadK || 1;            // ...and how brisk his baseline is

  /* scratch */
  const V = new THREE.Vector3(), U = new THREE.Vector3(), B = new THREE.Vector3();
  const K = new THREE.Vector3(), S2 = new THREE.Vector3(), KN = new THREE.Vector3();
  const HIP = new THREE.Vector3(), TGT = new THREE.Vector3();
  const Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
  const QP = new THREE.Quaternion(), QI = new THREE.Quaternion();
  const QT = new THREE.Quaternion(), QF = new THREE.Quaternion();
  const BEND = new THREE.Vector3();
  const _wp = new THREE.Vector3();

  /**
   * 2-bone IK. `bend` is the direction the middle joint is pushed toward, so a
   * knee goes FORWARD and an elbow goes back, always, whatever the target is.
   * Writes figure-space orientations for the two bones into Q1/Q2 and returns
   * the (possibly clamped) reach.
   */
  let _short = 0;
  function ik2(hip, target, L1, L2, bend) {
    V.subVectors(target, hip);
    let d = V.length();
    const dmax = (L1 + L2) - 1e-4, dmin = Math.abs(L1 - L2) + 1e-3;
    _short = Math.max(0, d - dmax);
    if (d > dmax) { V.multiplyScalar(dmax / d); d = dmax; }
    else if (d < dmin) { if (d < 1e-6) { V.set(0, -dmin, 0); } else V.multiplyScalar(dmin / d); d = dmin; }
    U.copy(V).divideScalar(d);
    B.copy(bend).addScaledVector(U, -bend.dot(U));
    if (B.lengthSq() < 1e-9) { B.set(0, 0, 1).addScaledVector(U, -U.z); }
    B.normalize();
    const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    K.copy(U).multiplyScalar(ca).addScaledVector(B, sa).normalize();
    KN.copy(hip).addScaledVector(K, L1);
    TGT.copy(hip).add(V);
    S2.subVectors(TGT, KN).normalize();
    Q1.setFromUnitVectors(DOWN, K);
    Q2.setFromUnitVectors(DOWN, S2);
    return d;
  }

  /** Where a foot goes this frame, in ROOM space -> figure space. */
  function footTarget(i, u, A, out) {
    const L = a.leg[i];
    const sx = i === 0 ? -1 : 1;
    const cy = Math.cos(drive.yaw), sy = Math.sin(drive.yaw);
    if (u < P.duty) {
      // STANCE. The plant point is a world point; every frame it is pulled back
      // into figure space, which cancels the body's translation AND its damped
      // turn. That is the whole no-slide argument, and it is two lines.
      if (!L.planted) {
        L.planted = true;
        L.px = drive.pos.x + (sx * hipX * cy + A * sy);
        L.pz = drive.pos.z + (-sx * hipX * sy + A * cy);
      }
      let wx = L.px - drive.pos.x, wz = L.pz - drive.pos.z;
      out.set(wx * cy - wz * sy, yAnkle, wx * sy + wz * cy);
      /* the safety valve: a figure can be TELEPORTED (kingEnter parks the mover
       * on its off-plate mark, __gotoUnit scrubs), and a plant point left three
       * metres behind him would drag the leg at full stretch for the rest of the
       * stance. If the mark has gone out of reach the foot re-plants where it
       * stands, which is what a man whose footing has just changed does. */
      if (Math.hypot(out.x - sx * hipX, out.z) > reachMax * 1.3) {
        L.px = drive.pos.x + (sx * hipX * cy + A * sy);
        L.pz = drive.pos.z + (-sx * hipX * sy + A * cy);
        wx = L.px - drive.pos.x; wz = L.pz - drive.pos.z;
        out.set(wx * cy - wz * sy, yAnkle, wx * sy + wz * cy);
      }
      L.fromX = out.x; L.fromZ = out.z;
      /* [R8-8]/[8d-1] where the plant now sits relative to its own hip socket, in
       * figure space: `fwd` SIGNED along the way he faces, `lat` across it. These
       * are the two numbers the governor above reads next frame. It used to be
       * handed `Math.hypot(...)` of the pair — a DISTANCE, which is the same
       * whether the foot is a stride ahead of the socket or a stride behind it —
       * and a foot planted A metres AHEAD therefore read as a stance with
       * `reachMax - A` of room left when it in fact had `reachMax + A`. */
      L.fwd = out.z; L.lat = Math.abs(out.x - sx * hipX);
    } else {
      /* SWING: an eased arc from where the foot left the floor to the next mark,
       * lifted enough that the knee has to bend to clear the boards.
       *   ROUND-8d [8d-1] AND THE CLEARANCE COMES OFF THE SWING'S OWN LENGTH, not
       * off the commanded amplitude `A`. They are the same number in a steady walk
       * (the foot leaves the floor a stride behind the hip and lands a stride in
       * front of it, so the swing covers 2A), and they part company at exactly one
       * moment: the END of a walk, where the mover's speed has gone to zero, so A
       * has gone to zero, while the trailing foot is still half a metre behind the
       * man and has to come home. Scaled by A that swing was flat — the foot slid
       * the whole way in contact with the boards, 0.059 m of it inside the walk
       * against a 0.05 m gate, and the reader watched a man skate his back foot
       * up to himself as he stopped. Scaled by the ground it actually has to
       * cover, it steps home. */
      if (L.planted) { L.planted = false; }
      const k = (u - P.duty) / (1 - P.duty);
      const s = smooth(k);
      const tx = sx * hipX, tz = A;
      const swing = Math.hypot(tx - L.fromX, tz - L.fromZ);
      const clear = clamp(swing / (2 * reachMax), 0, 1);
      out.set(L.fromX + (tx - L.fromX) * s,
              yAnkle + m(P.lift) * Math.sin(Math.PI * Math.pow(k, 0.86)) * clear,
              L.fromZ + (tz - L.fromZ) * s);
    }
    /* There is NO blend back to a standing pose here, deliberately. A blend is
     * what a planted foot cannot survive: it drags the world-locked stance
     * target toward the figure's own centre while the body walks away from it,
     * which measured 87 mm of slide on the King's entrance — the exact fault
     * this rig exists to remove. The gait relaxes on its own instead, because
     * the stride amplitude IS the speed: v -> 0 gives A -> 0 gives a foot
     * standing under its hip, with the swing lift scaled by the same A.
     */
    return out;
  }

  /** The foot's absolute pitch through the cycle: heel strike, roll, toe off. */
  function footPitch(u) {
    if (u < P.duty) {
      const k = u / P.duty;
      if (k < 0.22) return -0.10 + 0.10 * smooth(k / 0.22);
      if (k < 0.72) return 0;
      return 0.42 * smooth((k - 0.72) / 0.28);
    }
    const k = (u - P.duty) / (1 - P.duty);
    return 0.42 * (1 - smooth(k)) - 0.16 * Math.sin(Math.PI * k) - 0.10 * smooth(k);
  }

  /**
   * ROUND-8d [8d-1] A FOOTFALL, TIMED OFF THE FOOT.
   *
   * The rate this rig REPORTED was `a.ff`, the cadence arithmetic's answer — but
   * the phase is advanced by the GOVERNED rate `fg`, so on any frame the governor
   * was awake the two were different numbers and only the second one moved the
   * feet. Round 8c shipped a King whose ledger said 1.47 footfalls/s and 0.95 m
   * steps while his boots hit the boards every 0.300 s, 0.42 m apart.
   *
   * So the rate is MEASURED now, at the only place it exists: the frame a swing
   * foot lands. `plantHz` is one over the interval since the OTHER foot landed
   * and `plantStep` is the ground the body covered in that interval — the step
   * length by its own definition. Two guards, both of them about not measuring a
   * thing that is not a footfall: the same foot landing twice in a row is a
   * re-plant (a teleport, a flush, the first frame of a walk where both feet are
   * inside the duty window), and an interval under 20 ms is that re-plant seen
   * from the other side. Either one re-seeds the clock instead of reporting.
   */
  function plant(i, t) {
    const gap = t - a.plantT;
    if (a.plantT >= 0 && a.plantSide !== i && gap > 0.02 && a.w > 0.5) {
      a.plantHz = 1 / gap;
      a.plantStep = Math.hypot(drive.pos.x - a.plantX, drive.pos.z - a.plantZ);
      if (scanOn && acc) { acc.plantHz.push(a.plantHz); acc.plantStep.push(a.plantStep); }
    }
    a.plantT = t; a.plantSide = i;
    a.plantX = drive.pos.x; a.plantZ = drive.pos.z;
  }
  /** ...and everything that breaks the chain of footfalls says so here. A man who
   *  is not walking has no footfall rate, so the reported pair goes to zero too. */
  function plantsBreak() {
    a.plantT = -1; a.plantSide = -1; a.plantHz = 0; a.plantStep = 0;
  }

  const legTargets = [new THREE.Vector3(), new THREE.Vector3()];

  /* what the scan reads: local joint angles + world joint positions, taken off
   * the POSED graph so the numbers describe the geometry the reader sees */
  const metric = {
    /* [8d-1] `footfallHz`/`stepLen` are the MEASURED plant rate and the ground
     * between two plants; `driveHz`/`driveStep` are what the cadence arithmetic
     * asked for. Both are here so a reader can see when the governor is awake —
     * but only the measured pair is called the footfall rate. */
    w: 0, footfallHz: 0, stepLen: 0, driveHz: 0, driveStep: 0, speed: 0,
    pelvisY: 0, roll: 0, kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0,
    footYL: 0, footYR: 0,
  };
  let scanOn = false;
  let acc = null;
  const newAcc = () => ({
    frames: 0, walkFrames: 0,
    kneeL: [Infinity, -Infinity], kneeR: [Infinity, -Infinity],
    elbowL: [Infinity, -Infinity], elbowR: [Infinity, -Infinity],
    pelvisY: [Infinity, -Infinity], roll: [Infinity, -Infinity],
    driveHz: [Infinity, -Infinity], driveStep: [Infinity, -Infinity],
    // [8d-1] one entry per real footfall, pushed by `plant()` as it happens
    plantHz: [], plantStep: [],
    slide: [0, 0], slideNet: [0, 0], stances: [0, 0], short: [0, 0],
    _run: [null, null],
  });
  const span = (r) => (r[0] > r[1] ? 0 : +(r[1] - r[0]).toFixed(4));
  /** min / median / max of a sample list, or null if nothing was measured. */
  const stat = (list, dp) => {
    if (!list.length) return null;
    const s = list.slice().sort((x, y) => x - y);
    return [+s[0].toFixed(dp), +s[s.length >> 1].toFixed(dp), +s[s.length - 1].toFixed(dp)];
  };

  /** The angle a hinge joint is actually holding, in radians. */
  const hinge = (node) => 2 * Math.acos(clamp(Math.abs(node.quaternion.w), -1, 1));

  function scanStep() {
    if (!acc) acc = newAcc();
    acc.frames++;
    if (a.w > 0.5) acc.walkFrames++;
    root.updateWorldMatrix(true, true);
    const grow = (r, v) => { if (v < r[0]) r[0] = v; if (v > r[1]) r[1] = v; };
    grow(acc.kneeL, metric.kneeL); grow(acc.kneeR, metric.kneeR);
    grow(acc.elbowL, metric.elbowL); grow(acc.elbowR, metric.elbowR);
    grow(acc.roll, metric.roll);
    if (metric.shortL > acc.short[0]) acc.short[0] = metric.shortL;
    if (metric.shortR > acc.short[1]) acc.short[1] = metric.shortR;
    J.pelvis.getWorldPosition(_wp);
    grow(acc.pelvisY, _wp.y);
    // the COMMANDED pair (the measured one is pushed by `plant()`, per footfall)
    if (a.w > 0.5) { grow(acc.driveHz, a.ff); grow(acc.driveStep, a.stepLen); }
    // FOOT SLIDE, measured off world joint positions: while a foot is on the
    // floor (its ankle within 12 mm of standing height) accumulate the
    // horizontal PATH it travels. A gait that skates says so here.
    for (let i = 0; i < 2; i++) {
      const node = i === 0 ? J.footL : J.footR;
      node.getWorldPosition(_wp);
      /* STANCE is read off the trajectory (the target ankle height is exactly
       * `yAnkle` through the whole stance and strictly above it through the
       * swing), and the SLIDE is then measured off the world joint the IK
       * actually landed. Reading stance off world height instead let two frames
       * either side of toe-off in — the swing is only millimetres up there — and
       * charged their (correct, fast) motion to the planted foot. */
      const planted = (i === 0 ? metric.footYL : metric.footYR) - yAnkle < 1e-4
        && !a.teleported;             // [8c-3] a teleported frame ends the stance
      const run = acc._run[i];
      if (planted && a.w > 0.5) {
        if (!run) { acc._run[i] = { x: _wp.x, z: _wp.z, x0: _wp.x, z0: _wp.z, path: 0 }; acc.stances[i]++; }
        else {
          run.path += Math.hypot(_wp.x - run.x, _wp.z - run.z);
          run.x = _wp.x; run.z = _wp.z;
          if (run.path > acc.slide[i]) acc.slide[i] = run.path;
          const net = Math.hypot(_wp.x - run.x0, _wp.z - run.z0);
          if (net > acc.slideNet[i]) acc.slideNet[i] = net;
        }
      } else if (run) acc._run[i] = null;
    }
  }

  /* ------------------------------------------------------------------ *
   * step — one fixed sim quantum. Everything below is a pure function of the
   * clock and of `drive`, which is why two laps are the same pixels.
   * ------------------------------------------------------------------ */
  function pose(dt, t) {
    const d = drive;
    /* ROUND-8c [8c-3] A TELEPORT IS NOT A STEP, AND THE PLANT DOES NOT SURVIVE ONE.
     *   `kingEnter` moves the client's mover from his parking mark to the landing
     * mark in one assignment before it starts the walk, and `__gotoUnit` scrubs
     * every figure the same way. The plant point is a WORLD point, so after either
     * of those it is left metres behind the man standing on it. The only thing that
     * ever caught that was the out-of-reach valve inside `footTarget`, at
     * `reachMax * 1.3` — a threshold that scales with the leg, so [8c-3]'s longer
     * royal step (reachMax 0.495 -> 0.580) moved it 0.644 -> 0.754 m and let a
     * stale plant ride 110 mm further before anything noticed: measured on
     * kingEnter, the left leg spent seven frames at up to 89 mm of IK shortfall
     * (i.e. visibly over-stretched) and the re-plant when it finally came landed
     * inside the walk and read as 1.21 m of slide against a 0.05 m gate.
     *   A discontinuity in the body's position is not something a leg can walk
     * through, so it ends the stance: if the mover has moved further this frame
     * than its own speed can explain, both feet let go and re-plant where the man
     * now is. It is inert in every real walk (the test is 4x the frame's own
     * travel with a 50 mm floor) and it is what makes the foot-lock independent of
     * how long a given figure's legs are. */
    const moved = Math.hypot(d.pos.x - a.lastX, d.pos.z - a.lastZ);
    if (a.hasLast && moved > Math.max(0.05, Math.abs(d.speed) * dt * 4)) {
      for (const L of a.leg) { L.planted = false; L.fromX = 0; L.fromZ = 0; L.fwd = 0; L.lat = 0; }
      plantsBreak();                       // [8d-1] ...and the footfall clock with it
      a.teleported = true;                 // ...and the scan's stance run ends here
    }
    a.lastX = d.pos.x; a.lastZ = d.pos.z; a.hasLast = true;
    // ---- damped pose channels ---------------------------------------
    a.lift = damp(a.lift, d.lift, 6.5, dt);
    a.reach = damp(a.reach, d.reach, 5.0, dt);
    a.present = damp(a.present, d.present, 3.6, dt);
    a.seat = damp(a.seat, d.seated, 4.5, dt);
    a.toss = d.toss; a.unmask = d.unmask;

    // ---- cadence from speed ----------------------------------------
    const v = clamp(d.speed, 0, 6);
    a.speed = v;
    const seated = a.seat > 0.5;
    const wantW = (d.walking && v > 0.03 && !seated) ? 1 : 0;
    if (wantW && !a.walkPrev) a.phase = 0;      // every walk starts on the same
    a.walkPrev = !!wantW;                       // foot: a jumped lap == a walked one
    a.w = damp(a.w, wantW, 11, dt);
    if (a.w < 1e-3) { a.w = 0; plantsBreak(); }  // [8d-1] no walk, no footfall clock
    /* ROUND-8b [8b-2] A CHARACTER CADENCE CAP. Cadence has always been derived
     * from speed, which is right, but the only ceiling on it was the 5.6 Hz
     * physical one — so a colossus handed 4.1 m/s answered with 4.8 FOOTFALLS/s.
     * `cadMax` is what a given man's legs will do at all: the King's is 2.4 Hz
     * (weight, not hurry — the gait notes' character law), Holmes and Watson keep
     * the old 5.6. It is a cap on the DERIVED cadence, not on the governor below:
     * if the mover ever hands him a speed his cap cannot carry, the trailing-foot
     * governor still quickens the cycle rather than let a planted foot slide, so
     * the foot-lock outranks the cap.
     *   ROUND-8d [8d-1] AND THE CAP HAS TO BE ABOVE `v / stepMax`, OR IT IS A
     * CHURN INSTRUCTION. `f` below is the rate that carries `v` in steps the leg
     * can reach; capping it lower does not slow the man down, it plants his feet
     * further apart than they can reach and the governor then quickens the cycle
     * to save the stance. The King's 2.4 clears his 1.79 m/s worst moment with
     * margin, which is why it is inert — measured, not assumed. */
    const f0 = clamp((1.30 + 0.60 * v / sizeK) * cadK, 1.15, 3.0);
    const f = Math.min(cadMax, Math.max(f0, v / stepMax));
    a.ff = f;                                // footfalls per second
    a.stepLen = v / Math.max(f, 1e-6);       // metres one footfall covers
    const A = Math.min(reachMax, a.stepLen * P.duty);
    /* ROUND-8 [R8-8] THE TRAILING-FOOT GOVERNOR: A STANCE ENDS WHEN THE FOOT RUNS
     * OUT OF LEG, NOT WHEN THE CLOCK SAYS SO.
     *   The plant point is a WORLD point and the stance's length is a function of
     * the cadence, which is a function of the speed the body has NOW. A mover
     * accelerating out of a standstill (the King's two walks are cruise
     * trapezoids peaking at the measured 1.40 m/s entrance / 1.79 exit;
     * Holmes' two are still ease.inOut and peak at the measured 2.81 and
     * 3.32 m/s) therefore covers far more ground during its
     * first stance than the stride that stance was planted for: measured on
     * i-22-myphoto, the left foot planted at 57 mm of stride and was still planted
     * 33 frames later with the body 1.65 m/s and 0.55 m further on. The last three
     * frames of it dragged the leg past full stretch (IK shortfall 3.6 -> 19.9 ->
     * 37.3 mm) and then the out-of-reach valve below fired and TELEPORTED the plant
     * 0.9 m forward, two frames before the natural toe-off. lap.mjs's [R8-2] scan
     * measures that as what it is: 0.93 m of travel by a foot the rig says is
     * planted (1.20 m on the King's entrance), against a 0.05 m tolerance.
     *   So the cycle is allowed to QUICKEN when the trailing foot is running out of
     * room: given the reach it has left and the fraction of stance still to come,
     * this is the lowest cadence that can finish the stance inside the leg. It is a
     * pure function of the previous frame's posed geometry and it is bounded by the
     * same 5.6 Hz cap the cadence always had. What a man does when his footing runs
     * out is take the next step sooner, and that is what this does.
     *   ROUND-8d [8d-1] AND THE ROOM A STANCE HAS LEFT IS SIGNED. `L.back` was
     * `hypot(dx, dz)`, a DISTANCE, so a foot planted A metres AHEAD of its hip
     * socket — which is where every stance BEGINS — was read as a foot A metres
     * behind it. On the King, whose cruise plants at A = 0.552 m against a
     * reachMax of 0.580, that reported 28 mm of room at heel strike instead of
     * 1.132 m, `need` came out at 58 footfalls/s, and the clamp below pinned the
     * cycle at 5.6 for the first half of every stance. MEASURED off the rig: feet
     * planting every 0.300 s (3.33 footfalls/s) and 0.42 m of ground a step,
     * while the cadence arithmetic reported 1.47 and 0.95 m. The governor was
     * firing on every walk in the beat, on both other builds too, and what it was
     * saving the stance from was itself.
     *   `fwd + sqrt(reachMax² - lat²)` is the travel that stance can still absorb:
     * ahead of the socket it ADDS, behind it SUBTRACTS, and at the reach limit it
     * is zero. With it the governor is inert in a steady walk BY CONSTRUCTION —
     * substitute the plant (`fwd = A - 2uv/f`, `A = v*duty/f`) into `need` and it
     * comes out at exactly `f` when the step is the longest the leg can reach, and
     * under `f` by the margin the reach has to spare, which on the King's cruise
     * is 0.580 against a 0.552 m plant. And it still fires on the accelerations it
     * was built for: the mover is an ease.inOut, so the first stance of a walk is
     * always planted for less speed than it has to carry.
     */
    let fg = f;
    if (a.w > 0 && !seated) {
      const uPrev = ((a.phase / (2 * Math.PI)) % 1 + 1) % 1;
      for (let i = 0; i < 2; i++) {
        const L = a.leg[i];
        if (!L.planted) continue;
        const left = P.duty - ((i === 0 ? uPrev : uPrev + 0.5) % 1);
        if (!(left > 0)) continue;
        const room = L.fwd + Math.sqrt(Math.max(0, reachMax * reachMax - L.lat * L.lat));
        // travel still to come is v * (2 * left / f), so f must clear 2*v*left/room
        const need = 2 * v * left / Math.max(0.015, room);
        if (need > fg) fg = Math.min(5.6, need);
      }
    }
    if (a.w > 0) a.phase += Math.PI * fg * dt;
    const u0 = ((a.phase / (2 * Math.PI)) % 1 + 1) % 1;
    const uL = u0, uR = (u0 + 0.5) % 1;

    // ---- idle life: the breath, and a slow weight shift -------------
    const ph = t * d.breathW + d.breathPhase;
    const still = 1 - a.w;
    const breath = still * (0.5 + 0.5 * Math.sin(ph));
    const shift = still * Math.sin(ph * 0.41 + 0.7);

    /* ================= the legs ================= */
    if (seated) {
      // SEATED, natively. Round 3 had to fold Watson with a two-joint vertex
      // deformer because watson.glb had no rig; his hips and knees are joints
      // now, so the pose is four numbers and it BREATHES.
      const k = a.seat;
      const hipDrop = -(yHip - m(P.seatHipY)) * k;    // onto the wingback cushion
      J.pelvis.position.set(shift * w(0.004), yHip + hipDrop, -m(0.030) * k);
      J.pelvis.rotation.set(0.16 * k, 0, 0.010 * shift);
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? -1 : 1;
        legTargets[i].set(sx * hipX * 1.22, yAnkle, m(0.262) * k);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        // [8d-1] a swing that becomes a stance IS a footfall — the event the
        // reader counts — so it is timed here, on the frame the foot lands.
        const wasPlanted = a.leg[i].planted;
        footTarget(i, i === 0 ? uL : uR, A, legTargets[i]);
        if (!wasPlanted && a.leg[i].planted) plant(i, t);
      }
      /* THE PELVIS DROPS AS FAR AS THE STANCE LEG NEEDS. This is the walk's
       * vertical bob and it is not an amplitude anybody typed: it falls out of
       * `sqrt(L² - z²)` twice a cycle, at each double support, and comes back up
       * through mid-stance. It is also what keeps the IK inside its reach, which
       * is what keeps the planted foot still — so the pelvis ROTATION is solved
       * first and its own lift of the hip sockets is inside the reach sum. An
       * earlier version measured the reach off the un-rotated hip and the 7 mm
       * of error came straight back out as slide.
       */
      J.pelvis.rotation.set(0,
        -0.055 * a.w * Math.sin(2 * Math.PI * u0),                 // transverse
        0.048 * a.w * Math.sin(2 * Math.PI * u0) + 0.010 * shift);  // and the roll
      J.pelvis.updateMatrix();
      QP.copy(J.pelvis.quaternion);
      let dy = 0;
      for (let i = 0; i < 2; i++) {
        const tg = legTargets[i];
        HIP.set(i === 0 ? -hipX : hipX, 0, 0).applyQuaternion(QP);
        const z = Math.hypot(tg.x - HIP.x, tg.z - HIP.z);
        const need = tg.y + Math.sqrt(Math.max(0, legLen * legLen - z * z)) - yHip - HIP.y;
        if (need < dy) dy = need;
      }
      dy = Math.max(-maxCrouch, dy) - m(P.flex) * a.w;
      J.pelvis.position.set(shift * w(0.006) * (1 - a.w * 0.5), yHip + dy, 0);
    }
    J.pelvis.updateMatrix();
    QP.copy(J.pelvis.quaternion); QI.copy(QP).invert();
    BEND.set(0, 0, 1);
    for (let i = 0; i < 2; i++) {
      const sid = i === 0 ? 'L' : 'R';
      const sx = i === 0 ? -1 : 1;
      HIP.set(sx * hipX, 0, 0).applyQuaternion(QP).add(J.pelvis.position);
      ik2(HIP, legTargets[i], thighLen, shinLen, BEND);
      if (i === 0) metric.shortL = +_short.toFixed(5); else metric.shortR = +_short.toFixed(5);
      J['upperLeg' + sid].quaternion.copy(QI).multiply(Q1);
      QT.copy(Q1).invert().multiply(Q2);
      J['lowerLeg' + sid].quaternion.copy(QT);
      // the ankle keeps the sole level: absolute foot pitch, minus the shin's
      const fp = seated ? 0.10 : footPitch(i === 0 ? uL : uR) * a.w;
      QF.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -fp);
      J['foot' + sid].quaternion.copy(Q2).invert().multiply(QF);
    }

    /* ================= the spine ================= */
    const cRot = a.w * Math.sin(2 * Math.PI * u0);
    J.chest.position.set(0, yChest - yHip, 0);
    J.chest.rotation.set(
      (seated ? 0.085 * a.seat : 0) + 0.055 * a.w - 0.010 * breath,
      0.085 * cRot + d.look * 0.30 * (1 - a.w * 0.6) + a.present * 0.10,
      -0.030 * cRot);
    J.chest.scale.set(1 + 0.010 * breath, 1 + 0.014 * breath, 1 + 0.012 * breath);
    J.neck.rotation.set(-0.02 - 0.05 * a.w, 0, 0);
    /* THE SEATED HEAD IS PITCHED BACK, NOT FORWARD. The diorama camera sits 26
     * degrees ABOVE the horizon, so a seated man whose chest leans into the
     * chair and whose head follows it presents the reader with the CROWN OF HIS
     * HEAD — measured at the establishing framing: hair 524 px, of which 25%
     * near-black, and 67% of his eye band dark, because the eye band was behind
     * his own hair cap. Countering the lean (-0.155 against the chest's +0.085,
     * i.e. about 4 degrees of chin up in world terms) turns his face back to the
     * lens without moving his mark, his chair or his gaze.
     *
     * [8b-1] AND A STANDING MAN WHO IS PRESENTING HIMSELF LIFTS HIS CHIN. Same
     * 26-degree camera, same arithmetic, different beat: at the mask and unmask
     * framings the King is drawn up to his full height addressing the reader, so
     * `present` now carries -0.105 rad of pitch (6 degrees) of its own. It is the
     * cheapest 6 degrees in this build — it costs nothing in staging and it is
     * what turns the below-band fraction from 0.36 (a head seen over the top)
     * into a face — and it is dramatically the right shape for a monarch. It
     * rides the SAME damped `present` channel his turn does, so it is never a
     * snap and it is a pure function of the drive. */
    J.head.rotation.set(
      (seated ? -0.155 * a.seat : 0) + 0.030 * a.w * Math.cos(4 * Math.PI * u0)
        - 0.010 * breath + a.unmask * -0.10 + a.lift * -0.10
        + a.present * -0.105,
      d.look * 0.62 + a.present * 0.22 + 0.02 * shift, -0.020 * cRot);

    /* ================= the arms ================= */
    // walk counter-swing: the left arm goes forward with the RIGHT leg
    const swK = a.w * clamp(a.stepLen / Math.max(1e-4, stepMax * 0.62), 0.30, 1.25);
    const cw = Math.cos(2 * Math.PI * u0);
    const armW = [0.38 * swK * cw, -0.38 * swK * cw];
    const elbW = [-(0.58 * a.w) * Math.max(0, -cw), -(0.58 * a.w) * Math.max(0, cw)];

    for (let i = 0; i < 2; i++) {
      const sid = i === 0 ? 'L' : 'R';
      const sx = i === 0 ? -1 : 1;
      let shX = rest.shX + armW[i] - 0.04 * a.w;
      let shY = 0;
      let shZ = -sx * rest.shZ - sx * 0.03 * a.w;
      let elX = rest.elX + elbW[i];
      let elY = 0;
      let hnX = rest.wrX;
      if (seated) {
        // hands to the knees, elbows out: a man wedged in a wingback
        shX = -0.40 - 0.05 * breath; shZ = -sx * 0.22; elX = -1.34; hnX = 0.42;
      }
      if (i === 1) {
        /* the RIGHT arm is the acting arm. Every gesture below is a target pose
         * blended in by its own weight, so two gestures never fight and none of
         * them snaps: the note ride, the lift to the lamp, the toss, the desk
         * reach and the hand-to-face-then-hurl of the unmask. */
        const carry = Math.max(a.lift, a.toss > 0 ? 1 : 0);
        if (carry > 0) {
          // holding the letter out where the frame can see it
          const gX = -0.30, gZ = -0.20, gE = -2.10, gH = 0.18;
          // ...and raised toward the window lamp as the reader's hold fills
          const lX = -0.72, lZ = -0.30, lE = -2.05, lH = 0.02;
          const k = ease.inOut(clamp(a.lift, 0, 1));
          const tX = gX + (lX - gX) * k, tZ = gZ + (lZ - gZ) * k;
          const tE = gE + (lE - gE) * k, tH = gH + (lH - gH) * k;
          const bl = clamp(carry, 0, 1);
          shX += (tX - shX) * bl; shZ += (tZ - shZ) * bl;
          elX += (tE - elX) * bl; hnX += (tH - hnX) * bl;
        }
        if (a.toss > 0) {
          /* the TOSS: a raise, then a flick. `p` is the scene's 0..1 progress, so
           * the arm and the paper are the same event and the note needs no arc of
           * its own — it rides the socket. */
          const p = clamp(a.toss, 0, 1);
          const raise = Math.sin(Math.PI * Math.min(1, p * 1.35));
          const flick = Math.max(0, Math.sin(Math.PI * clamp((p - 0.42) / 0.42, 0, 1)));
          shX += -0.62 * raise - 0.30 * flick;
          elX += 0.72 * raise + 0.55 * flick;
          hnX += -0.30 * flick;
          shZ += -0.12 * raise;
        }
        if (a.reach > 0) {
          // the gazetteer / the index: he reaches down and forward to the desk
          const bl = clamp(a.reach, 0, 1);
          shX += (-0.86 - shX) * bl; shZ += (-0.24 - shZ) * bl;
          elX += (-0.92 - elX) * bl; hnX += (0.30 - hnX) * bl;
          elY += 0.24 * bl;
        }
        if (a.unmask > 0) {
          /* the UNMASK, in one channel: 0 -> 0.42 the hand goes to the face and
           * takes hold of the vizard; 0.42 -> 1 the arm hurls it away and comes
           * back down. The mask node detaches inside that window (scene.js), so
           * the tear is a hand on a prop and not a prop teleporting. */
          const p = clamp(a.unmask, 0, 1);
          const grab = smooth(p / 0.42);
          const hurl = smooth(clamp((p - 0.40) / 0.34, 0, 1));
          const back = smooth(clamp((p - 0.74) / 0.26, 0, 1));
          const g = grab * (1 - back);
          shX += (-0.80 - shX) * g; shZ += (-0.46 - shZ) * g;
          elX += (-2.42 - elX) * g;
          const hv = hurl * (1 - back);
          shX += -0.30 * hv; shZ += 0.95 * hv; elX += 1.55 * hv; shY += -0.55 * hv;
        }
      }
      J['upperArm' + sid].rotation.set(shX, shY, shZ);
      J['lowerArm' + sid].rotation.set(elX, elY, 0);
      J['hand' + sid].rotation.set(hnX, 0, 0);
    }

    // ---- what the review measures ----------------------------------
    metric.w = +a.w.toFixed(4); metric.ff = +a.ff.toFixed(3);
    // [8d-1] REPORTED = MEASURED. `driveHz` is kept beside it, named for what it is.
    metric.driveHz = metric.ff; metric.driveStep = +a.stepLen.toFixed(4);
    metric.footfallHz = +a.plantHz.toFixed(3); metric.stepLen = +a.plantStep.toFixed(4);
    metric.speed = +v.toFixed(4);
    metric.pelvisY = +(J.pelvis.position.y).toFixed(5);
    metric.roll = +(J.pelvis.rotation.z).toFixed(5);
    metric.kneeL = +hinge(J.lowerLegL).toFixed(4);
    metric.kneeR = +hinge(J.lowerLegR).toFixed(4);
    metric.elbowL = +Math.abs(J.lowerArmL.rotation.x).toFixed(4);
    metric.elbowR = +Math.abs(J.lowerArmR.rotation.x).toFixed(4);
    metric.footYL = +legTargets[0].y.toFixed(4);
    metric.footYR = +legTargets[1].y.toFixed(4);
    if (scanOn) scanStep();
    a.teleported = false;              // [8c-3] one frame only, and the scan saw it
  }

  const fig = {
    root, joints: J, socket, mask, drive, meshes, material: mat,
    dims: { H, girth: G, hipY: yHip, chestY: yChest, shoulderY: yShoulder,
            neckY: yNeck, headY: yHead, ankleY: yAnkle,
            // the seated hip: what the wingback's cushion has to come up to
            seatHipY: m(P.seatHipY),
            headTopY: H, headMidY: yHead + headSpan * 0.52,
            /* THE EYE BAND, in head-joint space, so "the brow shades the eyes"
             * is a measurement: `eyeY`/`eyeZ` are where the band sits (and where
             * the domino goes), `bandH` its height, `ledge` the overhang across
             * it, and `tilt` the resulting degrees below horizontal — the angle
             * that decides how much of the key light the band can take. */
            face: { eyeY: +bandMidY.toFixed(4), eyeZ: +fz.brow.toFixed(4),
                    bandH: +bandY.toFixed(4), ledge: +ledge.toFixed(4),
                    tilt: +(Math.atan2(ledge, bandY) * 180 / Math.PI).toFixed(1),
                    /* [8b-1] the chin and the gonial angle, in head-joint space,
                     * so "is his jaw presented to this camera?" is a projection
                     * of two points the builder actually cut rather than a guess
                     * off a bounding box. `chinY` is the bottom of the mass under
                     * the mouth — the beard's point on a bearded build. */
                    chinY: +(hs * (F.beard > 0 ? -0.048 : 0.015)).toFixed(4),
                    chinZ: +fz.chin.toFixed(4),
                    jawY: +(hs * 0.150).toFixed(4),
                    jawX: +wh(P.jawHW * F.jaw * 0.93).toFixed(4),
                    headW: +(2 * wh(P.browHW * F.skull)).toFixed(4),
                    headD: +(fz.brow + wh(P.browHD)).toFixed(4),
                    params: F },
            legLen, thighLen, shinLen, stepMax: +stepMax.toFixed(4),
            reachMax: +reachMax.toFixed(4), maxCrouch: +maxCrouch.toFixed(4) },
    tris: 0,
    metric,
    step(dt, t) { pose(dt, t); },
    /**
     * Snap every damped channel to its target and re-pose. This is the harness
     * contract: __gotoUnit replays acts and flushes after each, and the diorama
     * it lands on has to be the one a reader who WALKED there is looking at.
     * The gait resets to its canonical start rather than to wherever the phase
     * happened to be, so a flushed figure and a walked figure are the same
     * pixels once the walk is over.
     */
    flush() {
      a.lift = drive.lift; a.reach = drive.reach; a.present = drive.present;
      a.seat = drive.seated; a.toss = drive.toss; a.unmask = drive.unmask;
      a.w = 0; a.phase = 0; a.walkPrev = false;
      for (const L of a.leg) { L.planted = false; L.fromX = 0; L.fromZ = 0; L.fwd = 0; L.lat = 0; }
      plantsBreak();                       // [8d-1] ...and the footfall clock with it
      a.hasLast = false;                       // [8c-3] a flush IS a discontinuity
      pose(1 / 60, drive.tFlush || 0);
    },
    /** Back to the pose the beat starts on (harness scrubbing). */
    reset() {
      drive.speed = 0; drive.walking = false; drive.lift = 0; drive.reach = 0;
      drive.present = 0; drive.look = 0; drive.toss = 0; drive.unmask = 0;
      drive.seated = build.seated ? 1 : 0;
      a.lift = 0; a.reach = 0; a.present = 0; a.seat = drive.seated;
      a.toss = 0; a.unmask = 0; a.w = 0; a.phase = 0; a.walkPrev = false;
      for (const L of a.leg) { L.planted = false; L.fromX = 0; L.fromZ = 0; L.fwd = 0; L.lat = 0; }
      plantsBreak();                       // [8d-1] ...and the footfall clock with it
      a.hasLast = false;                       // [8c-3] ...and so is a scrub
      if (mask) {
        mask.node.position.copy(mask.rest.pos);
        mask.node.quaternion.copy(mask.rest.quat);
        mask.node.scale.setScalar(1);
        mask.node.visible = true;
        if (mask.node.parent !== head) head.add(mask.node);
        mask.paint(0);
      }
      pose(1 / 60, 0);
    },
    headWorld(out) { J.head.updateWorldMatrix(true, false);
                     return out.setFromMatrixPosition(J.head.matrixWorld); },
    /** Arm the per-frame joint scan (harness only: it costs a matrix walk). */
    scan(on) { scanOn = on !== false; if (scanOn) acc = newAcc(); return scanOn; },
    scanRead() {
      if (!acc) return null;
      return {
        frames: acc.frames, walkFrames: acc.walkFrames,
        kneeSwing: Math.min(span(acc.kneeL), span(acc.kneeR)),
        kneeSwingL: span(acc.kneeL), kneeSwingR: span(acc.kneeR),
        elbowSwing: Math.min(span(acc.elbowL), span(acc.elbowR)),
        elbowSwingL: span(acc.elbowL), elbowSwingR: span(acc.elbowR),
        bob: span(acc.pelvisY), roll: span(acc.roll),
        /* [8d-1] THE FEET, then the arithmetic. `footfallHz`/`stepLen` are
         * min/MEDIAN/max over the real plants of this walk — the median because a
         * walk is an ease.inOut and its first and last footfalls belong to the
         * acceleration, not to the man's stride. `driveHz`/`driveStep` are the
         * commanded ranges, kept so the two can be compared and the governor's
         * working hours can be seen. */
        footfallHz: stat(acc.plantHz, 2), stepLen: stat(acc.plantStep, 3),
        plants: acc.plantHz.length,
        driveHz: acc.driveHz[1] > -Infinity
          ? [+acc.driveHz[0].toFixed(2), +acc.driveHz[1].toFixed(2)] : null,
        driveStep: acc.driveStep[1] > -Infinity
          ? [+acc.driveStep[0].toFixed(3), +acc.driveStep[1].toFixed(3)] : null,
        footSlide: +Math.max(acc.slide[0], acc.slide[1]).toFixed(4),
        footSlideL: +acc.slide[0].toFixed(4), footSlideR: +acc.slide[1].toFixed(4),
        footSlideNet: +Math.max(acc.slideNet[0], acc.slideNet[1]).toFixed(4),
        stances: acc.stances.slice(),
        reachShort: +Math.max(acc.short[0], acc.short[1]).toFixed(5),
      };
    },
    /**
     * The style ledger the review gates on, read off the built graph.
     *
     * It walks THIS FIGURE'S OWN MESHES, not root.traverse(). Two reasons, both
     * of them measured: scene.js parents the note to Holmes' carry socket, so
     * traversing his root charged him the letter's texture map and its additive
     * glow card and reported him as "textured, not flat-shaded, no vertex
     * colours" — a false failure of the round's whole style claim. And the
     * King's mask node LEAVES his head at the unmask, so a traversal's triangle
     * count dropped by 256 halfway through the beat. The mesh list is the
     * figure's own inventory and it does not move.
     */
    style() {
      let tris = 0, textures = 0, mats = new Set(), flat = true, vcol = true;
      for (const o of meshes) {
        const g = o.geometry;
        tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        if (!g.attributes.color) vcol = false;
        for (const mm of (Array.isArray(o.material) ? o.material : [o.material])) {
          mats.add(mm);
          if (!mm.flatShading) flat = false;
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap',
                           'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap',
                           'displacementMap', 'specularMap', 'envMap', 'lightMap']) {
            if (mm[k]) textures++;
          }
        }
      }
      return { tris: Math.round(tris), meshes: meshes.length, materials: mats.size,
               textures, flatShaded: flat, vertexColors: vcol };
    },
  };
  fig.tris = fig.style().tris;
  fig.reset();
  return fig;
}
