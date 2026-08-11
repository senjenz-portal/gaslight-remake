/**
 * scene.js — the 221B diorama: geometry, slots, click targets, pantomime.
 *
 * Every visible object is parented into a named SLOT (see `slots`). A slot is
 * an empty THREE.Group at the object's diorama transform; the placeholder
 * blocks are its children and carry `userData.placeholder = true`. Swapping in
 * a generated GLB is therefore: load -> `slot.replace(gltf.scene)` -> done.
 * Focus anchors, click targets and props that must SURVIVE the swap carry
 * `userData.anchor` and are kept by `replace()`.
 *
 * PANTOMIME LAW: nothing here reads wall-clock. Every act is a scripted
 * timeline on sim seconds (`state.now`), so a lap is reproducible.
 *
 * Style law this geometry stands in for:
 *   stylized low poly 3d game diorama, isometric view, floating on a faceted
 *   dark rock base, clean dark navy gradient backdrop, Prussian-blue night,
 *   amber window glow, gas-lamp halos, faceted Victorian figures with single
 *   accent colours, flat-shaded chunky low poly style.
 */
import * as THREE from 'three';
import { mulberry32, damp, ease } from './clock.js';
/* ROUND-8: the cast is built HERE now, not fetched. See app/figures.js — three
 * rigged, flat-shaded, vertex-coloured figures at ~1.8k triangles each in place
 * of four 100k-tri painterly GLBs that could not move. */
import { createFigure } from './figures.js';

/**
 * ROUND-1 [V1] palette lift. These hexes are ALBEDOS, and three converts
 * them sRGB -> linear before lighting, so 0x1a2138 (a "dark navy" to the
 * eye) is 0.010,0.015,0.041 of reflectance — the room floor resolved to
 * luma 8 under a key light doing everything right. The surfaces that carry
 * the room's area (floor, plaster, timber, rock face) are re-authored to
 * reflect enough of the gaslight to hold shape; the accents are untouched.
 */
export const PALETTE = {
  navyDeep:   0x050914,
  navy:       0x0d1730,
  prussian:   0x14224a,
  rockDark:   0x0a0f1e,
  rockFace:   0x2b3b68,
  rockLit:    0x22304f,
  plaster:    0x36406a,
  floor:      0x2e3862,
  timber:     0x392e48,
  mahogany:   0x4a2a1c,
  amber:      0xffb459,
  amberDeep:  0xd4762a,
  ember:      0xff7a33,
  cream:      0xeee4cc,
  paper:      0xf0d9b5,
  holmes:     0x3f6f8f,   // single accent colour: cold blue
  watson:     0x8f5a3f,   // single accent colour: warm brown
  client:     0x3a2f6b,   // single accent colour: royal blue cloak
  clientTrim: 0x6a3f7f,
  brass:      0xc79a4b,
};

const FLAT = (color, extra = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

/**
 * A gas-lamp halo: additive, with a real radial falloff. A flat additive
 * disc reads as a grey sticker on the wall (the scaffold's bug); this one
 * falls off to nothing at its rim, so it reads as light in air.
 */
function glowMat(color, strength = 1, power = 2.6, hollow = 0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: strength },
                uP: { value: power }, uH: { value: hollow } },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    // ROUND-2 [R3-3]: `uH` hollows the core out. A solid additive disc centred
    // on the window pane is what drove 14% of that pane past luma 250 — the
    // halo has to be an AUREOLE in the air AROUND the glass, zero on the glass
    // itself, or it just clips whatever it is pinned to.
    fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uK, uP, uH;
      void main(){
        float d = clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0);
        float a = pow(1.0 - d, uP);
        if (uH > 0.0) a *= smoothstep(uH * 0.45, uH, d);
        gl_FragColor = vec4(uC * a * uK, a * uK);
      }`,
  });
}

/**
 * three multiplies ONLY the diffuse term by the vertex colour; `emissive` is
 * a flat uniform. That is why the rock's up-facing apron stayed a bright blue
 * slab in round 2 even though its albedo was crushed 88% — all of its value
 * came from the un-crushed emissive. This hook makes emissive obey vColor too,
 * which is what turns "crush the plateau" from a wish into a measurement.
 */
function emissiveByVertexColor(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;');
  };
  mat.customProgramCacheKey = () => 'emissiveByVertexColor';
  return mat;
}

/** A slot: an addressable transform whose contents are swappable. */
function makeSlot(name, parent, pos = [0, 0, 0], rotY = 0) {
  const g = new THREE.Group();
  g.name = 'slot:' + name;
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.y = rotY;
  g.userData.slot = name;
  parent.add(g);
  /**
   * Replace placeholder contents with real art (a GLB scene, usually).
   * `dispose: false` keeps the geometry of what comes OUT — required when a
   * slot swaps between two models it will swap back and forth (the King's
   * masked/unmasked pair) rather than retiring a placeholder for good.
   */
  g.replace = (obj3d, { dispose = true } = {}) => {
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      if (c.userData && c.userData.anchor) continue;   // keep anchors + targets
      g.remove(c);
      if (dispose) c.traverse?.((m) => { m.geometry?.dispose?.(); });
    }
    if (obj3d) g.add(obj3d);
    g.userData.swapped = !!obj3d;
    return g;
  };
  return g;
}

/** A focus anchor rides inside a slot, so it survives `replace()`. */
function anchor(slot, name, pos = [0, 0, 0]) {
  const a = new THREE.Object3D();
  a.name = 'anchor:' + name;
  a.userData.anchor = name;
  a.position.set(pos[0], pos[1], pos[2]);
  slot.add(a);
  return a;
}

function box(w, h, d, color, extra) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color, extra));
}

/* ------------------------------------------------------------------ *
 * The faceted dark rock base the whole diorama floats on.
 * ------------------------------------------------------------------ */
function makeRock(seed = 1337) {
  const rng = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(5.2, 2).toNonIndexed();
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let d = cache.get(key);
    if (d === undefined) { d = 0.80 + rng() * 0.44; cache.set(key, d); }
    v.multiplyScalar(d);
    v.x *= 1.26; v.z *= 1.26;
    if (v.y > 0.1) v.y = 0.1 + (v.y - 0.1) * 0.10;
    else v.y = v.y * (1.35 + Math.max(0, -v.y) * 0.30);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // ROUND-1 [v4] / ROUND-2 [R3-2]: the plateau flattened by the loop above
  // faces straight UP, so the cold key light hits it square and it read as a
  // flat saturated blue slab (luma ~40) BRIGHTER than the room floor (~29) —
  // an apron that pulled the eye harder than the room standing on it. Round 2
  // crushed its ALBEDO 88%, but emissive is a flat uniform in three so the
  // slab kept all its value. Now the crush is per-channel (blue crushed
  // hardest, so the apron desaturates toward rock-in-night rather than just
  // dimming a blue) and `emissiveByVertexColor` makes the emissive obey it.
  // The carved outer/lower faces — what makes the rock read as an object —
  // keep their value untouched.
  const APRON = [0.235, 0.205, 0.135];       // R,G,B multipliers at up = 1
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, nrm.getY(i));                 // 0 = wall, 1 = plateau
    const t = Math.pow(up, 1.15);
    col[i * 3]     = 1 - (1 - APRON[0]) * t;
    col[i * 3 + 1] = 1 - (1 - APRON[1]) * t;
    col[i * 3 + 2] = 1 - (1 - APRON[2]) * t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const rock = new THREE.Mesh(geo, emissiveByVertexColor(FLAT(PALETTE.rockFace,
    { emissive: 0x232f5a, emissiveIntensity: 1.0, vertexColors: true })));
  rock.name = 'rockBase';
  rock.position.y = -0.62;
  return rock;
}

/* ------------------------------------------------------------------ *
 * A mover: the path, the duration and the heading. ROUND-8 took the GAIT out
 * of here — a mover no longer bobs or rolls its slot, because the figure it
 * carries has hips and knees now and the bob falls out of the stance leg's
 * own reach (figures.js). What is left is what a mover always was: where the
 * man is going, how fast he is getting there, and which way he is facing —
 * plus the idle breath/sway, which is a SLOT-level effect on purpose, so a
 * still figure's screen box drifts whatever is inside it ([R4-2]).
 *
 * `speed` is a finite difference on a FIXED_DT clock, so it is deterministic,
 * and it is the one number the figure's cadence is derived from.
 * ------------------------------------------------------------------ */
function makeMover(slot, home, yaw0 = 0, life = {}) {
  return {
    slot, fig: null,
    pos: home.clone(), from: home.clone(), to: home.clone(), prev: home.clone(),
    t: 0, dur: 0, ramp: 0, yaw: yaw0, yawWant: yaw0, walking: false, speed: 0,
    breathW: life.breathW ?? 1.15, breathPhase: life.breathPhase ?? 0,
    breath: life.breath ?? 0.0035,     // <= 0.5% of stature (a chest rise)
    sway: life.sway ?? 0.008,          // <= 0.01 rad (weight shifting)
    lifeY: 0, lifeR: 0,
  };
}

/* ROUND-8b [8b-2] THE CRUISE PROFILE, AND WHY A WALK NEEDED ONE.
 * Every mover in this beat has always been an `ease.inOut` — quadratic in,
 * quadratic out — whose peak speed is 2 x the average. That is a fine curve for
 * a camera and a bad one for a man: the King's 1.5 m step to the threshold ran
 * 0.72 s, so it PEAKED at 4.17 m/s, and the gait (which derives cadence from
 * speed, correctly) answered with 4.8 steps/s. A sprinting monarch, exactly as
 * the review says, produced by a curve and not by a number.
 *   `ramp` replaces it with a trapezoid: accelerate over the first `r` of the
 * duration on a smoothstep, CRUISE, decelerate over the last `r` on the mirror
 * of it. Peak is then 1/(1-r) x the average instead of 2x — at r = 0.26, 1.35x —
 * so the same distance in the same time is walked at 68% of the old top speed,
 * and the speed is CONSTANT through the middle, which is what lets the gait hold
 * one cadence and one stride instead of chirping up and back down. The ramp is
 * a smoothstep, so the velocity is still continuous at both ends and the gait's
 * own ease-in/out envelope has something sane to ride.
 *   It is opt-in per walk: with no `ramp` the curve is the ease.inOut it always
 * was, byte for byte, and Holmes' three walks are untouched.
 */
function cruise(k, r) {
  if (!(r > 0)) return ease.inOut(k);
  const S = (u) => u * u * u - u * u * u * u / 2;    // integral of smoothstep, S(1)=0.5
  const I = k <= r ? r * S(k / r)
          : k >= 1 - r ? 0.5 * r + (1 - 2 * r) + r * (0.5 - S((1 - k) / r))
          : 0.5 * r + (k - r);
  return I / (1 - r);
}

function walkTo(m, to, dur, { face = true, ramp = 0 } = {}) {
  m.from.copy(m.pos); m.to.copy(to); m.t = 0; m.dur = Math.max(0.05, dur);
  m.ramp = ramp;
  if (face) {
    const dx = to.x - m.pos.x, dz = to.z - m.pos.z;
    if (dx * dx + dz * dz > 1e-4) m.yawWant = Math.atan2(dx, dz);
  }
}

function faceYaw(m, yaw) { m.yawWant = yaw; }

/** Face a world point (turning, not snapping). */
function facePoint(m, x, z) {
  const dx = x - m.pos.x, dz = z - m.pos.z;
  if (dx * dx + dz * dz > 1e-5) m.yawWant = Math.atan2(dx, dz);
}

/**
 * One mover step: advance the path, damp the turn, measure the speed, write the
 * slot, and hand the figure the four things its gait needs (speed, walking,
 * where it stands and which way it faces — the last two because a foot-locked
 * stance target is a WORLD point and has to be pulled back into figure space
 * every frame; see figures.js).
 *
 * The bob and the roll used to be written here, as `|sin(phase)| * 0.055` on
 * the slot with a phase that ran at a constant 5.6 rad/s whatever the man's
 * speed. That is what "he glides" looked like from the inside: a fixed-rate
 * wobble on a translating box. Both now come out of the pose — the pelvis drops
 * as far as the stance leg needs to reach a foot that is nailed to the floor —
 * and `gait()` reports them off the posed skeleton instead of off the numbers
 * that produced them.
 *
 * The idle breath and sway stay HERE, at slot level, because they are the
 * effect [R4-2] gates: three still figures whose screen boxes must drift.
 * `t` is absolute sim seconds, so all of it is a pure function of the clock.
 */
function stepMover(m, dt, t) {
  m.prev.copy(m.pos);
  if (m.t < m.dur) {
    m.t = Math.min(m.dur, m.t + dt);
    m.pos.lerpVectors(m.from, m.to, cruise(m.t / m.dur, m.ramp || 0));
    m.walking = m.t < m.dur;
  } else if (m.walking) {
    m.walking = false;
  }
  // shortest-arc turn, exponentially damped (smooth, never a snap)
  let d = m.yawWant - m.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  m.yaw += d * (1 - Math.exp(-7.0 * dt));
  m.speed = dt > 0 ? m.pos.distanceTo(m.prev) / dt : 0;
  const w = m.walking ? 1 : 0;
  const ph = t * m.breathW + m.breathPhase;
  m.lifeY = (1 - w) * m.breath * (0.5 + 0.5 * Math.sin(ph));
  m.lifeR = (1 - w) * m.sway * Math.sin(ph * 0.62 + 1.1);
  m.slot.position.set(m.pos.x, m.pos.y, m.pos.z);
  m.slot.rotation.set(0, m.yaw, m.lifeR);
  m.slot.scale.y = 1 + m.lifeY;
  if (m.fig) {
    const dr = m.fig.drive;
    dr.speed = m.speed;
    dr.walking = m.walking;
    dr.pos.set(m.pos.x, m.pos.y, m.pos.z);
    dr.yaw = m.yaw;
    m.fig.step(dt, t);
  }
  return w;
}

/* ------------------------------------------------------------------ *
 * buildScene — returns the whole diorama plus its control surface.
 * ------------------------------------------------------------------ */
export function buildScene() {
  const root = new THREE.Group();
  root.name = 'diorama';

  const slots = {};
  const focus = {};
  const targets = {};

  // ---- rock base ---------------------------------------------------
  slots.rock = makeSlot('rock', root, [0, 0, 0]);
  const rockMesh = makeRock();
  slots.rock.add(rockMesh);

  // ---- the room shell (221B sitting room, cutaway) ------------------
  slots.room = makeSlot('room', root, [0, 0, 0]);
  const RW = 7.2, RD = 5.4, RH = 3.3;
  const floor = box(RW, 0.22, RD, PALETTE.floor);
  floor.position.set(0, 0.11, 0); slots.room.add(floor);
  const rug = box(3.4, 0.04, 2.4, 0x5f3138);
  rug.position.set(0.1, 0.24, 0.2); slots.room.add(rug);
  const wallBack = box(RW, RH, 0.22, PALETTE.plaster);
  wallBack.position.set(0, RH / 2 + 0.2, -RD / 2); slots.room.add(wallBack);
  // ROUND-1 [V1]: the left wall used to be one solid slab, so the "door" was
  // a dark plaque on a black wall with nothing behind it. It is now built
  // AROUND a real doorway (z 0.42..1.88, up to y 2.76) that the landing's
  // warm light comes through.
  const DOOR_Z0 = 0.42, DOOR_Z1 = 1.88, DOOR_TOP = 2.76;
  const wallLeftA = box(0.22, RH, DOOR_Z0 + RD / 2, PALETTE.plaster);
  wallLeftA.position.set(-RW / 2, RH / 2 + 0.2, (-RD / 2 + DOOR_Z0) / 2);
  slots.room.add(wallLeftA);
  const wallLeftB = box(0.22, RH, RD / 2 - DOOR_Z1, PALETTE.plaster);
  wallLeftB.position.set(-RW / 2, RH / 2 + 0.2, (DOOR_Z1 + RD / 2) / 2);
  slots.room.add(wallLeftB);
  const wallLeftC = box(0.22, RH + 0.2 - DOOR_TOP, DOOR_Z1 - DOOR_Z0, PALETTE.plaster);
  wallLeftC.position.set(-RW / 2, (DOOR_TOP + RH + 0.2) / 2, (DOOR_Z0 + DOOR_Z1) / 2);
  slots.room.add(wallLeftC);
  const skirt = box(RW, 0.26, 0.1, PALETTE.timber);
  skirt.position.set(0, 0.35, -RD / 2 + 0.16); slots.room.add(skirt);
  // [E1a] the carriage-lamp rake: a warm bump that travels down the left
  // wall as the cab passes the window. This is the motion the `comes2`
  // freeze reads even when the window itself is outside the frame.
  const roomSweepMat = glowMat(0xffc07a, 0, 1.8);
  const roomSweep = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.0), roomSweepMat);
  roomSweep.rotation.y = Math.PI / 2;
  roomSweep.position.set(-RW / 2 + 0.16, 1.55, -1.4);
  roomSweep.visible = false;
  slots.room.add(roomSweep);

  // ---- window with amber glow (the style law's signature) -----------
  // ROUND-2 [R3-3]. Two faults, one frame: the sash had doubled into a
  // ~16-light PRISON GRID (two 0.045 bars per axis PLUS a 0.075 meeting rail
  // on top of them), and the glass still clipped — 13.97% of the pane read
  // above luma 250 at the door camera. Both had the same root cause: the
  // pane was a LIT surface (a cream albedo with a 10-candela point light
  // sitting 0.9 m off its face) with an additive halo centred on it.
  //   · the glass is now UNLIT — a near-black albedo the point light cannot
  //     raise, carrying a vertex-coloured warm EMISSIVE gradient that falls
  //     to 42% toward the corners. Nothing pure white, and a real value
  //     gradient the glazing bars can sit on.
  //   · the sash is a true SIX-LIGHT sash: one vertical bar, two horizontals
  //     (the lower one the meeting rail), 0.028–0.034 thick instead of
  //     0.045 doubled with 0.075.
  //   · the halo is an AUREOLE (hollow core) in the air around the frame, so
  //     it never adds a single unit of value onto the glass itself.
  slots.window = makeSlot('window', root, [-1.9, 1.85, -RD / 2 + 0.02]);
  const frame = box(1.55, 2.05, 0.14, PALETTE.timber);
  slots.window.add(frame);
  const PANE_W = 1.28, PANE_H = 1.78;
  const paneGeo = new THREE.PlaneGeometry(PANE_W, PANE_H, 10, 14);
  {
    const p = paneGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (PANE_W / 2), v = p.getY(i) / (PANE_H / 2);
      // an elliptical falloff, slightly bottom-weighted: the lamp-lit street
      // is BELOW the sill, so the glass carries more value low than high
      const r = Math.min(1, Math.hypot(u * 0.90, (v - 0.10) * 0.80));
      const k = 0.42 + 0.58 * Math.pow(1 - r, 1.45);
      col[i * 3] = k; col[i * 3 + 1] = k * 0.985; col[i * 3 + 2] = k * 0.95;
    }
    paneGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const paneMat = emissiveByVertexColor(new THREE.MeshLambertMaterial({
    color: 0x140d06, vertexColors: true,                 // unlit: a dark glass
    emissive: 0xffc47e, emissiveIntensity: 0.52 }));      // ...that GLOWS
  const pane = new THREE.Mesh(paneGeo, paneMat);
  pane.position.z = 0.095; slots.window.add(pane);
  // six lights: 2 across x 3 up. Slim bars; the lower horizontal is the
  // meeting rail, so it is the only member allowed to read heavier.
  const sash = new THREE.Group(); sash.position.z = 0.122; slots.window.add(sash);
  const barV = box(0.028, PANE_H, 0.030, 0x241d2f); sash.add(barV);
  const barTop = box(PANE_W, 0.028, 0.030, 0x241d2f);
  barTop.position.y = 0.297; sash.add(barTop);
  const barRail = box(PANE_W, 0.034, 0.034, 0x241d2f);
  barRail.position.y = -0.297; sash.add(barRail);
  anchor(slots.window, 'window', [0, 0, 0.5]);
  // the point light that throws the window's warmth into the ROOM stands off
  // the glass now — on the pane's face it was worth ~3.7 linear of diffuse
  // all by itself, which is most of what clipped.
  const windowLight = new THREE.PointLight(0xffc06a, 10, 9, 2);
  windowLight.position.set(0, 0.2, 1.30); slots.window.add(windowLight);
  const haloMat = glowMat(0xffb459, 0.62, 2.15, 0.60);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.6), haloMat);
  halo.position.z = 0.34; slots.window.add(halo);
  // E1a / [R3-4]: the carriage lamps. A warm bar crosses the pane as the cab
  // passes — the one thing that makes `comes2` READ as an arrival rather than
  // a held frame. It is measured now (lamp-off vs lamp-peak captures), so its
  // amplitude is set to swing the pane's mean visibly without clipping it.
  // amplitude tuned against the measured lamp-off / lamp-peak pane means:
  // big enough for the pass to READ (>12 luma pp of swing), small enough that
  // the bar never pushes the glass to clipping.
  const PANE_SWEEP_K = 0.70;
  const paneSweepMat = glowMat(0xffd9a0, 0, 0.92);
  const paneSweep = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.95), paneSweepMat);
  paneSweep.position.z = 0.155; slots.window.add(paneSweep);

  // ---- hearth ------------------------------------------------------
  slots.hearth = makeSlot('hearth', root, [2.55, 0.22, -RD / 2 + 0.30]);
  const mantle = box(1.9, 1.5, 0.42, 0x3a2f3f);
  mantle.position.y = 0.75; slots.hearth.add(mantle);
  const mouth = box(1.0, 0.86, 0.22, 0x120c14);
  mouth.position.set(0, 0.46, 0.2); slots.hearth.add(mouth);
  /**
   * ROUND-3 [R4-3]. The fire was the last clipped element in the lap: a cream
   * card in the grate. Same root cause as the window pane in round 2 — it was a
   * LIT surface (an ember-orange albedo with a 9-candela point light 0.36 m off
   * its face) carrying an emissive on top, so its diffuse term alone ran ~20x
   * over white and ACES desaturated the overflow to cream.
   *
   * It is an UNLIT surface now: a near-black albedo the hearth light cannot
   * raise (it still catches just enough to separate the facets) plus a fixed
   * amber emissive ceiling.
   *   [R5-4]/[R6-3] The measured result, this lap, on the fire's OWN pixels
   * (__emberPixels, hide-and-diff) over every framing that holds it. Round 5's
   * version of this note had three wrong numbers — 11 framings, the hottest frame,
   * and the two ratios swapped — so here they are re-measured, straight off
   * shots/round-6/lap.json:
   *   12 framings hold the fire, and 0 of their pixels are over luma 250
   *   hottest ember pixel: (255,215,142) at luma 218.2 LANDSCAPE (1052 ember px
   *     on the plate) and (255,214,141) at luma 217.4 PORTRAIT (887 px) —
   *     at 30-i-30-buthow, not at i-12-seat--act (which measures 215.7 at both
   *     ratios and is not in the top three at either)
   * The red channel does sit at 255 in the flame heart — that is ACES rolling a
   * hot amber off, and the pixel still reads amber (measured hue 38.7 degrees
   * landscape / 38.4 portrait off those same hottest pixels, luma 32 under
   * the clip line), which is why the gate counts luma over 250 rather than any one
   * channel. Nothing about the light the fire throws INTO the room changed:
   * `hearthLight` is untouched, so the hearth is still the warm anchor.
   */
  const EMBER_E = 1.60;
  const fireMat = FLAT(0x1a0d04, { emissive: PALETTE.ember, emissiveIntensity: EMBER_E });
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), fireMat);
  fire.position.set(0, 0.34, 0.26);
  fire.userData.anchor = 'ember';          // survives the fireplace.glb swap
  slots.hearth.add(fire);
  const hearthLight = new THREE.PointLight(0xff7a33, 9, 7, 2);
  hearthLight.position.set(0, 0.5, 0.7);
  hearthLight.userData.anchor = 'hearthLight';
  slots.hearth.add(hearthLight);
  anchor(slots.hearth, 'hearth', [0, 0.6, 0.8]);

  // ---- door (the visitor's way in, and the beat's exit) --------------
  // ROUND-1 [V1]: this whole corner was an unlit void — the King's entrance
  // (fact I.4) happened inside a black mass. The doorway now has a HALL
  // behind it: a warm-lit landing wall, a spill under the leaf, a puddle of
  // light on the floorboards and one warm point light just inside the room.
  // Slot yaw is +PI/2, so local +Z points INTO the room and local -Z is the
  // landing — every "hall" child hangs at negative local Z.
  slots.door = makeSlot('door', root, [-RW / 2 + 0.13, 0.22, 1.15], Math.PI / 2);
  const hall = new THREE.Group();
  hall.userData.anchor = 'hall';
  slots.door.add(hall);
  // ROUND-2 [R3-6]. The landing used to be four FLATS, each 2.60 wide against
  // a 1.46 doorway — so at every wide door framing half a metre of hall wall
  // and hall floor stuck out past the opening on both sides and read as
  // separate panels hanging in the void, with daylight between them. It is a
  // closed BOX now: floor, back, two returns and a ceiling, sized just wider
  // than the opening so the camera sees a room and never an edge...
  const HALL_HW = 0.86;                 // half-width (opening is 0.73)
  const HALL_Z0 = -0.24, HALL_Z1 = -1.52, HALL_H = 2.78;
  const HALL_D = HALL_Z0 - HALL_Z1, HALL_MZ = (HALL_Z0 + HALL_Z1) / 2;
  const hallWall = box(HALL_HW * 2, HALL_H, 0.12, 0x4a4038,
    { emissive: 0x1d1409, emissiveIntensity: 1.0 });
  hallWall.position.set(0, HALL_H / 2, HALL_Z1); hall.add(hallWall);
  const hallFloor = box(HALL_HW * 2, 0.10, HALL_D, 0x2a2233,
    { emissive: 0x1d1408, emissiveIntensity: 1.0 });
  hallFloor.position.set(0, 0.05, HALL_MZ); hall.add(hallFloor);
  const hallCeil = box(HALL_HW * 2, 0.10, HALL_D, 0x2a2534,
    { emissive: 0x120c06, emissiveIntensity: 1.0 });
  hallCeil.position.set(0, HALL_H - 0.05, HALL_MZ); hall.add(hallCeil);
  for (const sx of [-1, 1]) {
    const side = box(0.12, HALL_H, HALL_D, 0x443a33,
      { emissive: 0x160f07, emissiveIntensity: 1.0 });
    side.position.set(sx * (HALL_HW - 0.06), HALL_H / 2, HALL_MZ); hall.add(side);
  }
  const hallSkirt = box(HALL_HW * 2, 0.22, 0.10, 0x2f2820,
    { emissive: 0x120c05, emissiveIntensity: 1.0 });
  hallSkirt.position.set(0, 0.21, HALL_Z1 + 0.10); hall.add(hallSkirt);
  const hallDado = box(HALL_HW * 2, 0.05, 0.08, 0x5c5040,
    { emissive: 0x1a1208, emissiveIntensity: 1.0 });
  hallDado.position.set(0, 1.02, HALL_Z1 + 0.09); hall.add(hallDado);
  const hallGlowMat = glowMat(0xffb469, 0.55, 2.0);
  const hallGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 2.7), hallGlowMat);
  hallGlow.position.set(0, 1.32, HALL_Z1 + 0.11); hall.add(hallGlow);
  // ...and the SHROUD: a dark shell one board proud of the landing box on
  // every outward face, so from the wings the doorway is a solid mass with a
  // lit hole in it and never two flats with sky between them.
  //   The establishing camera looks DOWN at 26 degrees, so it clears the room
  // wall's head and sees the top of this block. That surface is therefore not
  // a black lid but a pitched SLATE ROOF in the night palette, valued to sit
  // with the backdrop instead of punching a hole in it: what shows over the
  // wall reads as the rest of the house, which is exactly what it is.
  const SHR = 0.12, shrD = HALL_D + SHR * 2;
  // The shroud is NOT painted black. A black shell read as a second finding:
  // measured against the leaf's own night at the door camera it came out at
  // luma 3 beside a backdrop of luma 36 — a hole cut in the plate, which is
  // the round-2 complaint wearing a different coat. Valued to the backdrop
  // instead (measured: shroud 26,36,64 vs night 27,38,67) the whole block
  // reads as the outside of the house standing in the dark, and the only
  // line that survives is the lit ridge where its roof meets the parlour wall.
  const shroudMat = { emissive: 0x121a33, emissiveIntensity: 1.0 };
  const shroudBack = box(HALL_HW * 2 + SHR * 2, HALL_H + SHR, SHR, 0x223057, shroudMat);
  shroudBack.position.set(0, (HALL_H + SHR) / 2, HALL_Z1 - 0.06 - SHR / 2);
  hall.add(shroudBack);
  for (const sx of [-1, 1]) {
    const s = box(SHR, HALL_H + SHR, shrD, 0x223057, shroudMat);
    s.position.set(sx * (HALL_HW + SHR / 2), (HALL_H + SHR) / 2, HALL_MZ);
    hall.add(s);
  }
  const shroudBot = box(HALL_HW * 2 + SHR * 2, SHR, shrD, 0x223057, shroudMat);
  shroudBot.position.set(0, -SHR / 2, HALL_MZ); hall.add(shroudBot);
  // the roof: pitched away from the room, slate in the night palette
  const roof = box(HALL_HW * 2 + SHR * 2.4, 0.10, shrD * 1.06, 0x223057,
    { emissive: 0x121a33, emissiveIntensity: 1.0 });
  roof.position.set(0, HALL_H + SHR + 0.02, HALL_MZ);
  roof.rotation.x = 0.16;                     // falls away from the parlour
  hall.add(roof);
  const ridge = box(HALL_HW * 2 + SHR * 3, 0.07, 0.09, 0x2c3c68,
    { emissive: 0x1a2444, emissiveIntensity: 1.0 });
  ridge.position.set(0, HALL_H + SHR + 0.10, HALL_Z0 + 0.02); hall.add(ridge);

  // [R3-6] the reveal: the opening is cut through a 0.22 m wall, so line its
  // cheeks and head — otherwise the wide framings look straight at the sawn
  // edge of a flat where the jamb stops short of the plaster.
  const DOOR_LOCAL_TOP = DOOR_TOP - 0.22;
  for (const rx of [-1, 1]) {
    const cheek = box(0.06, DOOR_LOCAL_TOP + 0.06, 0.26, 0x3f3348);
    cheek.position.set(rx * 0.715, (DOOR_LOCAL_TOP + 0.06) / 2, -0.12);
    slots.door.add(cheek);
  }
  const revealHead = box(1.55, 0.06, 0.26, 0x3f3348);
  revealHead.position.set(0, DOOR_LOCAL_TOP + 0.03, -0.12); slots.door.add(revealHead);

  // architrave, not a slab: the opening must actually be open
  for (const jx of [-0.60, 0.60]) {
    const jamb = box(0.14, 2.44, 0.30, 0x4a3c50);
    jamb.position.set(jx, 1.22, 0.02); slots.door.add(jamb);
  }
  const lintel = box(1.48, 0.16, 0.30, 0x4a3c50);
  lintel.position.set(0, 2.40, 0.02); slots.door.add(lintel);
  // [R4-4] the sill was the BASE the two additive door tells stack on: the
  // threshold lamp lights it, the under-door strip adds to it and the floor
  // puddle adds again, and with the leaf open at a settled arrival the sum went
  // over white in a 81x33 px patch at the King's boots. The trim is a shade
  // deeper now, which is where the headroom for both tells comes from.
  const sill = box(1.34, 0.05, 0.30, 0x453343);
  sill.position.set(0, 0.025, 0.02); slots.door.add(sill);

  // the leaf swings on a hinge group so `doorOpen` is a real swing
  const doorHinge = new THREE.Group();
  doorHinge.position.set(-0.53, 0, 0.06);
  doorHinge.userData.anchor = 'doorHinge';
  slots.door.add(doorHinge);
  const doorLeaf = box(1.06, 2.3, 0.10, 0x53412f);
  doorLeaf.position.set(0.53, 1.15, 0);
  doorLeaf.name = 'doorLeaf';
  doorHinge.add(doorLeaf);
  for (const py of [0.62, 1.70]) {                    // two sunk panels
    const panel = box(0.72, 0.86, 0.06, 0x3f3124);
    panel.position.set(0.53, py, 0.055); doorHinge.add(panel);
    const bead = box(0.80, 0.94, 0.03, 0x69543c);
    bead.position.set(0.53, py, 0.045); doorHinge.add(bead);
  }
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), FLAT(PALETTE.brass));
  knob.position.set(0.91, 1.12, 0.09); doorHinge.add(knob);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 2.24),
    new THREE.MeshBasicMaterial({ color: 0xffc47a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  doorGlow.position.set(0, 1.15, -0.02);
  doorGlow.userData.anchor = 'doorGlow';
  slots.door.add(doorGlow);
  // [R5-1] The card stands IN the opening, and the door slot is turned a
  // quarter turn, so its local +Z is the room's +X: this is the ROOM-SPACE X of
  // the card's plane, and anyone whose mark is west of it is standing BEHIND an
  // additive flat. The step function needs the number to know when to yield.
  const DOORGLOW_X = slots.door.position.x + doorGlow.position.z;
  // the strip of hall light under the leaf — the arrival's first tell
  const underDoorMat = new THREE.MeshBasicMaterial({ color: 0xffc078, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const underDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.15), underDoorMat);
  underDoor.position.set(0, 0.075, 0.085); slots.door.add(underDoor);
  // and the puddle it throws across the floorboards
  const spillMat = glowMat(0xffab5e, 0, 1.9);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.006, 1.05); slots.door.add(spill);
  // one warm light INSIDE the room at the threshold: it is what actually
  // puts value on the left wall, the jambs and the King's boots.
  //
  // [R4-4] The King's tunic chest blew out to a white plate at i-11-hadnote
  // (2035 px over luma 250). It was not the material — his figure is flat-shaded
  // Lambert, there is no specular in this scene — it was the near field: at the
  // doorway mark his chest stands a third of a metre off this lamp and walks
  // THROUGH it, and on a square-law falloff that is worth ~30x what the same
  // lamp puts on the wall 2 m away. The answer was to FLATTEN the response
  // rather than dim it (decay 0.7, and the lamp lifted clear of chest height),
  // which keeps the mid-field value the doorway read depends on while the near
  // field comes down several-fold. Nothing here got darker: the current lap
  // measures V1 nearBlack at i-10-comes2 as 0.332 landscape / 0.363 portrait
  // (round 4: 0.339 / 0.368) against a limit of 0.40, and ZERO clipped pixels in
  // the i-11-hadnote inset at both ratios, hottest pixel 246.8 (round 4: 248.4).
  //
  // [R5-3] Round 4 left one flicker: a STANDING chest is clear of this lamp but a
  // WALKING one is not. On a stride that carries him past the jamb, one
  // flat-shaded chest facet swings into alignment and goes over luma 250 for a
  // few frames. The lamp was lifted 0.25 m for it (clear of a walking chest, not
  // merely a standing one), which also took i-11-hadnote's hottest SETTLED inset
  // pixel to 246.8 — still the measured number at both ratios, and the settled
  // census is still exactly 0 clipped px on all 38 reviewed frames.
  //
  // [R6-2] WHAT THE FLICKER ACTUALLY PEAKS AT, AND WHY IT IS NOT THIS LAMP'S FAULT.
  // Round 5 wrote "9 px" here from a scan that sampled the window every 0.01 s. The
  // sim moves in 1/60 s quanta, so that scan was reading between the app's own
  // frames; the review's frame-exact pass found 319 px. lap.mjs now steps the sim
  // one FIXED_DT at a time across the walk, at four clock phases, and counts
  // every clipped pixel in the inset on every one of those frames (walkScan;
  // [R7-1] the outbound walk it also used to cover no longer exists, and the beat
  // that replaced it is scanned the same way by standScan).
  // Measured that way the pre-fix build peaked at 223 px worst-of-four inbound,
  // with single-phase samples of the same window ranging 67 to 356 px.
  //   Hiding one light at a time on the peak frame settled the blame: this lamp
  // off -> his hottest pixel 226.8, the door's additive glow card off -> 236.2,
  // both on -> 253.1. It takes the pair, and the CARD was the half that could be
  // conceded (see the `cross` note in step()). With its ramp corrected the inbound
  // walk measures 10 px worst-of-four at both ratios and the King's last beat 0 px
  // on all 436 of its frames, so this lamp needs no further trim.
  //   Two trims of THIS lamp were measured against the pre-fix peak anyway, and
  // both were rejected:
  //   · HALL_GAIN 0.44 -> 0.42: peak 193 -> 158 px at the phase it was measured on
  //     (nowhere near closing), and it costs 0.0071 of V1 headroom at i-10-comes2
  //     (nearBlack 0.3323 -> 0.3394). The top of the ACES curve barely moves for a
  //     5% cut in one contributor.
  //   · this lamp another 0.25 m up (y 2.05): inbound peak 193 -> 114 px and V1
  //     gets slightly BETTER (0.3323 -> 0.3290) — but at 2.05 m the lamp arrives
  //     level with the shoulders of a 2.20 m man standing on the sill, and the
  //     outbound walk it was measured against went 37 -> 167 px for it. [R7-1] That
  //     walk is gone and the objection got worse, not better: the man now HOLDS the
  //     sill through i-11, i-36 and the whole door gate, so the frames it would put
  //     a lamp level with his shoulders on are gated settled frames at 0 px.
  /* ROUND-8c [8c-3 fallout] AND THE LAMP IS NOW ABOVE HIS CROWN, because 1.80 was
   * INSIDE HIM. [8c-3]'s longer royal step changes his pelvis bob, so on the fast
   * walk-in (`standScan` at 0.5 s a beat) his shoulder passed this lamp at a new
   * phase and clipped: 9 px at luma 251.0 on `seg:chest`, two frames of 109, both
   * ratios. Blame was isolated by hiding one contributor at a time ON THAT FRAME,
   * the way [R6-2] did: with every additive card hidden the 9 px are still there
   * at 251.0, and with the four point lights off the hottest pixel in the inset is
   * 246.8 and none clip — then one lamp at a time, and it is this one, alone.
   *   The reason is a SINGULARITY, not a value. His exit line runs to KING_SILL at
   * z 1.15, this lamp sat at world (-2.79, 2.02, 1.15) — the same z, at the
   * shoulder height of a 2.24 m man — and the measured distance from his chest
   * facet to the lamp on the clipping frame was 0.04 m. Three's punctual falloff
   * is `1 / max(d^decay, 0.01)`, so at 4 cm even this deliberately flat 0.7 decay
   * is a 9.2x multiplier: no colour can survive standing inside a lamp (measured —
   * taking the tunic down 5% in linear moved the pixel 251.0 -> 250.9, because R is
   * already saturated).
   *   0.62 m up puts it at world 2.64, clear of the 2.46 m crown of the tallest man
   * who walks under it, which is also where a hall bracket belongs in a 3.3 m
   * opening. The closest he now comes is 0.67 m and the multiplier is 1.33 instead
   * of 9.2. `HALL_GAIN` goes 0.44 -> 0.54 to hold the landing FLOOR at the value
   * the doorway read depends on: the lamp-to-floor distance goes 1.80 -> 2.42 m,
   * which on a 0.7 decay is 0.813 of the irradiance, and 1/0.813 is 1.23.
   *   Measured after: `standScan` is 0 clipped px on all 109 frames at BOTH walk-in
   * cadences and both ratios (hottest pixel in the inset 246.8), and [V1] got
   * BETTER at all three gated beats rather than worse — i-10-comes2 nearBlack
   * 0.3436 -> 0.3136 landscape and 0.3728 -> 0.3481 portrait, i-11-hadnote 0.2005
   * -> 0.1951 / 0.2495 -> 0.2330, i-37-door 0.2529 -> 0.2351 / 0.2958 -> 0.2805,
   * against the 0.40 limit. A lamp that stops being swallowed by a man lights more
   * of the room.
   *   (The round-5 note above rejected a 0.25 m lift because it put the lamp level
   * with a standing man's shoulders and hurt a walk-out that no longer exists.
   * This lift goes PAST the shoulders rather than up to them, which is the half of
   * that objection that mattered.) */
  const HALL_GAIN = 0.54;
  const hallLight = new THREE.PointLight(0xffab5e, 4 * HALL_GAIN, 7.5, 0.7);
  hallLight.position.set(0, 2.42, 0.68);
  hallLight.userData.anchor = 'hallLight';
  slots.door.add(hallLight);
  anchor(slots.door, 'door', [0.1, 1.25, 0.9]);
  // click target: the leaf itself
  targets.door = { obj: doorHinge, hits: [doorLeaf, knob], at: new THREE.Vector3(0.53, 1.30, 0.05) };

  // ---- desk + the index (a click target) ----------------------------
  slots.desk = makeSlot('desk', root, [-2.35, 0.22, -0.55]);
  const deskTop = box(1.7, 0.12, 0.9, PALETTE.timber);
  deskTop.position.y = 0.76; slots.desk.add(deskTop);
  for (const dx of [-0.72, 0.72]) for (const dz of [-0.34, 0.34]) {
    const leg = box(0.1, 0.76, 0.1, PALETTE.timber);
    leg.position.set(dx, 0.38, dz); slots.desk.add(leg);
  }
  // The index: a FAT LEDGER the reader is asked to click. Round-1 [v6] read
  // it as a toy block (a red slab with a yellow stripe); a commonplace book
  // is legible from its parts — raised spine bands on a rounded spine, a
  // cream page block whose fore-edge shows on three sides, and boards that
  // overhang the paper. No lettering anywhere (the no-text law).
  // The camera sees a slot's +X and +Z faces. The SPINE therefore lies on +Z
  // (its raised bands cross it as vertical ridges) and the page block's head
  // edge shows cream paper on +X — a book reads from those two things and
  // from boards that overhang the paper. No lettering (the no-text law).
  const INDEX_REST = 0.925;
  const indexRig = new THREE.Group();
  indexRig.position.set(0.34, INDEX_REST, 0.06);
  indexRig.rotation.y = 0.14;
  indexRig.userData.anchor = 'index';
  slots.desk.add(indexRig);
  const indexPages = box(0.300, 0.156, 0.300, 0xe6d6b2);    // the page block
  indexPages.position.z = -0.030;
  const indexBody = box(0.312, 0.198, 0.062, 0x5c2b22);     // the spine
  indexBody.name = 'indexBody';
  indexBody.position.z = 0.150;
  const boardTop = box(0.334, 0.019, 0.346, 0x6d3b2e);
  boardTop.position.set(0, 0.090, -0.018);
  const boardBot = box(0.334, 0.019, 0.346, 0x6d3b2e);
  boardBot.position.set(0, -0.090, -0.018);
  indexRig.add(indexPages, indexBody, boardTop, boardBot);
  for (const bx of [-0.093, 0, 0.093]) {                    // raised spine bands
    const b = box(0.028, 0.214, 0.076, 0x8a5330);
    b.position.set(bx, 0, 0.148); indexRig.add(b);
  }
  const clasp = box(0.085, 0.013, 0.030, PALETTE.brass);
  clasp.position.set(0.06, 0.036, -0.196); indexRig.add(clasp);
  // loose sheets, because a working desk is not a bare board
  const sheets = [[-0.42, 0.22, 0.42], [-0.31, 0.32, -0.18], [-0.56, -0.16, 0.12]];
  for (const [sx, sz, sr] of sheets) {
    const s = box(0.26, 0.006, 0.185, 0xdcccaa);
    s.position.set(sx, 0.827, sz); s.rotation.y = sr; slots.desk.add(s);
  }
  const shelfBook = box(0.20, 0.075, 0.27, 0x2e4a3b);
  shelfBook.position.set(-0.64, 0.858, -0.26); shelfBook.rotation.y = 0.12;
  slots.desk.add(shelfBook);
  anchor(slots.desk, 'desk', [0.30, 1.02, 0.20]);
  targets.index = { obj: indexRig, hits: [indexBody, indexPages, boardTop, boardBot],
                    at: new THREE.Vector3(0, 0.10, 0) };

  // ---- room dressing: armchair + side table (ASSETS.md TODO #4) -----
  // ROUND-2 [R3-1]: the wingback is Watson's MARK now, so it moves off the
  // downstage floor and up beside the hearth (1.0 m from the fireplace's
  // near face), turned into the room so the man in it is seen three-quarter
  // front rather than over his own shoulder.
  /* ROUND-8: this was -0.45, a number tuned to WHICH WAY watson.glb's mesh was
   * baked. A built figure faces its own +Z, and at -0.45 that put his facing 75
   * degrees off the locked camera azimuth: the establishing framing looked down
   * on the CROWN OF HIS HEAD (measured: 575 head pixels, 25% of them near-black
   * hair, his eye band behind his own cap) and his cameo card had nothing on
   * stage to bind to. At +0.24 his facing is 38 degrees off the lens — the
   * three-quarter front this mark was always described as. The chair turns with
   * him, because the man and the chair he is wedged in have to agree. */
  const WATSON_YAW = 0.24;
  slots.armchair = makeSlot('armchair', root, [3.05, 0.22, -1.53], WATSON_YAW);
  const chairSeat = box(0.86, 0.34, 0.86, 0x4a2027);
  chairSeat.position.y = 0.40; slots.armchair.add(chairSeat);
  const chairBack = box(0.86, 0.78, 0.20, 0x4a2027);
  chairBack.position.set(0, 0.86, -0.36); slots.armchair.add(chairBack);
  const chairArmL = box(0.16, 0.20, 0.86, 0x3d1a20);
  chairArmL.position.set(-0.36, 0.64, 0); slots.armchair.add(chairArmL);
  const chairArmR = chairArmL.clone(); chairArmR.position.x = 0.36;
  slots.armchair.add(chairArmR);
  anchor(slots.armchair, 'armchair', [0, 0.7, 0]);

  slots.sidetable = makeSlot('sidetable', root, [1.90, 0.22, 0.62], 0.3);
  const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 10),
    FLAT(PALETTE.mahogany));
  tTop.position.y = 0.68; slots.sidetable.add(tTop);
  const tStem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.62, 8),
    FLAT(PALETTE.mahogany));
  tStem.position.y = 0.34; slots.sidetable.add(tStem);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot = box(0.09, 0.06, 0.28, PALETTE.mahogany);
    foot.position.set(Math.sin(a) * 0.14, 0.04, Math.cos(a) * 0.14);
    foot.rotation.y = a; slots.sidetable.add(foot);
  }
  anchor(slots.sidetable, 'sidetable', [0, 0.7, 0]);

  // ---- figures ------------------------------------------------------
  const HOLMES_HOME = new THREE.Vector3(1.05, 0.22, -0.35);
  // ROUND-1 [v5]: his desk mark used to be BEHIND the desk (-3.05, -0.35), so
  // at the mask/unmask camera the desk top cut him off at the shin and he read
  // as standing ON it. Standing to the near side of the desk grounds his feet
  // on the floorboards in every framing that holds both of them.
  // ROUND-2 [R3-1] follow-on: at the new three-shot his old mark put him
  // directly behind the King in screen-x (1.45 m apart, and the King's cloak
  // alone is worth 1.08 m of that), so 58% of Holmes was occluded during his
  // OWN line introducing Watson. Standing 0.25 m further along the screen's
  // left axis clears him.
  const HOLMES_DESK = new THREE.Vector3(-2.71, 0.22, 0.31);
  const HOLMES_TWO  = new THREE.Vector3(0.95, 0.22, -0.05);
  // ROUND-3 [R4-1, second half]: holmes.glb bakes the letter into his raised
  // hand, and squared up to the index his hand crossed his own cheek, so at the
  // desk camera the letter read as a CARD STUCK TO HIS FACE. He is turned 0.55
  // rad off the index — still at the desk, index at his elbow — which brings
  // the sheet clear of his jaw and side-on to the window: it reads as a letter
  // held out to the light, which is what he is doing.
  const HOLMES_DESK_LOOK = [-1.56, -0.04];
  /* ROUND-8. The three cast slots hold PROCEDURAL RIGGED FIGURES. The slot
   * contract is unchanged — same slot names, same marks, same anchors, same
   * yaws — so every camera, framing gate and click target in this file still
   * addresses them the way it always did. What changed is what is inside: 16
   * joints instead of one 100k-tri mesh, and the height each one carries is
   * fact I.4's carrier (1.83 / 1.74 / 2.24 m).
   *   Seeds are fixed, so the facet jitter is the same figure every load. */
  slots.holmes = makeSlot('holmes', root, HOLMES_HOME.toArray(), -0.55);
  const holmes = createFigure({ seed: 0x48014, build: 'holmes' });
  slots.holmes.add(holmes.root);
  anchor(slots.holmes, 'holmes', [0, holmes.dims.headMidY, 0]);

  // ROUND-1 [c2] / ROUND-2 [R3-1]: round 1 found Watson sliced by the inset
  // edge; round 2 closed the slice by walking him off stage — which cost the
  // beat his own introduction ("This is my friend and colleague, Dr. Watson"
  // played to an empty room). He is back, and this time he has a STABLE MARK
  // he never leaves: seated in the wingback by the fire.
  //
  // The mark is solved, not guessed. The locked camera azimuth puts screen-
  // right along world (0.6525, 0, -0.7578), so a figure's screen-x is
  //     sx = 0.6525·x − 0.7578·z
  // and "wholly in or wholly out" is a one-dimensional problem. At sx = 3.15
  // he clears the right edge of the two TIGHTEST framings that do not want
  // him — `note` (sx limit 2.27) and `window` (2.57) — with margin, while
  // staying inside `room`, `holmes` and the new `present` three-shot. That is
  // what keeps the no-slice gate green at all 38 units with him on stage.
  const WATSON_HOME = new THREE.Vector3(3.05, 0.22, -1.53);
  slots.watson = makeSlot('watson', root, WATSON_HOME.toArray(), WATSON_YAW);
  /* [R3-1] follow-on, ROUND-8: Watson SITS, and he sits on his own joints. The
   * load-time two-joint vertex bend `seatFigure` existed only because
   * watson.glb had no rig to pose; the seated pose is four joint angles now,
   * it breathes, and his hip lands on the same cushion height the deformer
   * reported (0.572 m above his feet). */
  const watson = createFigure({ seed: 0x2b117, build: 'watson' });
  slots.watson.add(watson.root);
  anchor(slots.watson, 'watson', [0, watson.dims.headMidY, 0]);

  // the colossus comes through the door on the left wall and stops centre
  const KING_OUT   = new THREE.Vector3(-4.75, 0.22, 1.15);
  /* ROUND-8b [8b-2] THE LANDING MARK. `KING_OUT` is the PARKING mark: it is
   * 0.11 m behind the hall's own back wall, which is what makes it an off-stage
   * position rather than a place a man can stand. Starting his entrance there
   * meant walking 1.5 m in the 0.72 s between the leaf giving and the frame the
   * review settles on — 4.17 m/s, the finding. He waits on the landing now,
   * 0.80 m out, which is a step and a half at a king's pace; the closed leaf
   * covers the whole opening (measured on round 8's own i-11 act frame), so
   * nothing of him is on the plate until the door gives. */
  const KING_LAND  = new THREE.Vector3(-4.05, 0.22, 1.15);
  const KING_SILL  = new THREE.Vector3(-3.25, 0.22, 1.15);
  const KING_STAGE = new THREE.Vector3(0.05, 0.22, 0.45);
  slots.client = makeSlot('client', root, KING_OUT.toArray(), Math.PI / 2);
  /* the colossus: 2.24 m, deep blue floor cloak open at the front over a
   * flame-orange lining, cream tunic, black boots, heavy bearded jaw — the
   * cameo's man, in the diorama's own facets. The cloak is part of the figure
   * now (it hangs off his chest and swings with his torso) rather than a
   * separate cone hung on the slot. */
  const client = createFigure({ seed: 0x3c0d5, build: 'king' });
  slots.client.add(client.root);
  slots.client.visible = false;
  anchor(slots.client, 'client', [0, client.dims.headMidY, 0]);

  /* ---- the MASK ---------------------------------------------------- *
   * ROUND-8. THE UNMASK IS A NODE, NOT A MODEL SWAP.
   *
   * Rounds 1-7 carried the vizard twice: a click-target PROP hung on the slot,
   * and the vizard BAKED into king.glb's mesh — which is why fact I.6 needed a
   * second 100k-tri model (king-unmasked.glb) and a parent-pointer swap under
   * cover of the mask-drop to keep him from saying "I am the King" with his
   * face still covered. The procedural King wears ONE mask: a thin black domino
   * with a raked strap, parented to his HEAD joint, so it rides his face when he
   * turns and comes off when the gate resolves.
   *   `kingUnmask` reparents it from the head to the slot (world transform
   * preserved) and tumbles it to the same MASK_FLOOR mark round 3 solved, with
   * the same two-job repaint ([R4-5]). Nothing is swapped, nothing is baked, and
   * "masked" is now a question anyone can answer off the scene graph: is the node
   * attached to his head and visible?
   */
  const maskNode = client.mask.node;
  maskNode.userData.anchor = 'mask';
  const maskPaint = (k) => client.mask.paint(k);
  targets.mask = { obj: maskNode, hits: client.mask.hits,
                   at: new THREE.Vector3(0, 0, 0.02) };

  // where the mask lands when it is torn off.
  // ROUND-3 [R4-5]: it used to land FACE DOWN (rotation.x +1.45 turns the lobes'
  // +Z normal to point at the floorboards), which at any wide framing is a
  // 0.20 m black smear on a dark red rug — a scribble, not a prop. It lies face
  // UP now, half a pace off his boot, and the discarded prop is scaled for the
  // read it has to carry at diorama distance (1.0 -> 1.55, i.e. ~0.34 m): worn
  // on the face it must be a domino, dropped on the rug it must be legible.
  // MASK_FLOOR is in CLIENT-SLOT space, which is where the node is reparented
  // to when it comes off, so the mark is unchanged from round 3.
  const MASK_FLOOR = new THREE.Vector3(0.78, 0.045, 0.56);
  const MASK_LIE = { x: -1.42, y: 0.72, z: 0.18 };
  const MASK_WORN_S = 1.0, MASK_DROP_S = 1.55;
  const _mFrom = new THREE.Vector3();
  /** Take the vizard off his face and hand it to the slot, world pose intact. */
  function maskDetach() {
    if (maskNode.parent === slots.client) return;
    maskNode.updateWorldMatrix(true, false);
    const mw = maskNode.matrixWorld.clone();
    slots.client.updateWorldMatrix(true, false);
    mw.premultiply(new THREE.Matrix4().copy(slots.client.matrixWorld).invert());
    slots.client.add(maskNode);
    mw.decompose(maskNode.position, maskNode.quaternion, maskNode.scale);
    maskNode.scale.setScalar(MASK_WORN_S);
    _mFrom.copy(maskNode.position);
  }
  /** Put it back on him (harness scrubbing only). */
  function maskAttach() {
    client.mask.node.visible = true;
    if (maskNode.parent !== client.joints.head) client.joints.head.add(maskNode);
    maskNode.position.copy(client.mask.rest.pos);
    maskNode.quaternion.copy(client.mask.rest.quat);
    maskNode.scale.setScalar(MASK_WORN_S);
    maskPaint(0);
  }

  // ---- the note (the hold verb's object) ----------------------------
  // ROUND-1 [E1b]: the note was an untextured rectangle floating unsupported
  // mid-room while the cue read "hold the note to the light". It is a real sheet
  // in a real hand now — one letter, in a hand, that walks and turns with him,
  // and `noteLift` raises the ARM toward the window lamp in proportion to the
  // reader's hold.
  // The sheet's yaw is solved every step so it faces the locked diorama
  // azimuth: a letter shown to the reader, never edge-on. Must match
  // main.js ISO.azim (ASSETS.md §4: the camera azimuth is LOCKED).
  const READ_AZIM = 0.86;
  /* ROUND-8. THE NOTE RIDES HIS HAND. Rounds 1-7 made the note a child of the
   * HOLMES SLOT and drove it between three authored marks (NOTE_LOW ->
   * NOTE_HAND -> NOTE_LAMP), because holmes.glb had no hand to hang it off — the
   * paper and the arm were two animations that had to agree. It is parented to
   * the figure's right-hand CARRY SOCKET now: the arm carries the letter, the
   * toss is an arm, and the lift to the lamp is an arm. The three marks are
   * gone with the hack.
   *   Its ORIENTATION is still solved in world terms, because the one thing the
   * paper must never do is go edge-on to a locked camera: every step the sheet
   * is given a world quaternion (the locked azimuth plus the read's tilt) and
   * the local rotation needed to hold it inside the hand's frame is computed
   * from the socket's own matrix. Position from the hand, facing from the lens. */
  slots.note = makeSlot('note', holmes.socket, [0, 0, 0], 0);
  slots.note.userData.anchor = 'noteRig';
  // ROUND-2 [R3-5]: the letter was an infinitely thin, DOUBLE-SIDED plane —
  // a decal, not an object. Seen from the reader's side its back face was
  // shaded by the lights BEHIND it, which is why Holmes' knuckles and coat
  // buttons read through the paper. It is a real sheet now: a 1.2 mm solid
  // with a lit edge, single-sided shading, depth-writing, held in a visible
  // pinch.
  const SHEET_W = 0.340, SHEET_H = 0.245, SHEET_TILT = -0.35;
  /* The letter sits just clear of the mitten that holds it: the socket is at the
   * grip, and the sheet's centre is half a sheet-width up and 30 mm proud of the
   * knuckles, so the paper occludes the fist instead of intersecting it. Rounds
   * 1-7 needed 0.155 m of push here to clear a LETTER BAKED INTO THE GLB's fist
   * (measured then: knuckles and baked card 90 mm proud of the sheet, reading
   * straight through it). There is no baked card any more — one letter, in a
   * hand, and the hand is drawn where the frame can see it. */
  const noteRig = new THREE.Group();
  noteRig.position.set(0.020, 0.118, 0.036);
  slots.note.add(noteRig);
  const sheetMat = new THREE.MeshLambertMaterial({
    color: PALETTE.paper, flatShading: true, transparent: false, opacity: 1,
    depthWrite: true, side: THREE.FrontSide,
    emissive: 0x6d4f28, emissiveIntensity: 0.75 });
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(SHEET_W, SHEET_H, 0.0016), sheetMat);
  sheet.rotation.x = SHEET_TILT;
  // named, because this sheet hangs off HOLMES' carry socket and so turns up in
  // lap.mjs's [R8-3] census of what is parented under a figure but is not the figure
  sheet.name = 'noteSheet';
  noteRig.add(sheet);
  /* ROUND-2 [R3-5] drew a THUMB here, laid across the front of the paper, so the
   * sheet read as pinched rather than stuck to a fist — necessary while the hand
   * behind it was an unrigged 100k-tri blob whose fingers pointed somewhere else.
   * The mitten holding it is now posed by the same channel that lifts the paper,
   * so the pinch is the hand, and a second free-floating thumb 30 mm in front of
   * the real one is exactly the kind of prop this round exists to delete. */
  const wmarkMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const wmark = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.20), wmarkMat);
  wmark.position.set(-0.008, 0, 0.004);
  wmark.rotation.x = SHEET_TILT;
  wmark.name = 'noteWatermark';
  noteRig.add(wmark);
  const noteGlowMat = glowMat(0xffd489, 0, 2.0);
  const noteGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), noteGlowMat);
  noteGlow.position.set(0, 0, -0.03);
  noteGlow.name = 'noteGlow';
  noteGlow.rotation.x = SHEET_TILT;
  noteRig.add(noteGlow);
  anchor(slots.note, 'note', [0, 0, 0]);

  // ---- street / carriage (arrives on hoofbeats) ---------------------
  // ROUND-2 [R3-7] part 1: the street used to run at 12.6 degrees to the
  // building front, which put its own axis almost along the camera's view
  // axis — so "move the lamp along the street" moved it 0.47 m of screen for
  // every metre of world, and the far end of the street ran back UNDER the
  // parlour. It is parallel to the front now, and stood off far enough that
  // its kerb line is genuinely outside the room's footprint.
  slots.street = makeSlot('street', root, [0.6, -1.05, 4.90], 0);
  const cobbles = box(9.0, 0.16, 2.6, 0x121a2e);
  slots.street.add(cobbles);
  const kerb = box(9.0, 0.22, 0.3, 0x1a2440);
  kerb.position.set(0, 0.12, -1.3); slots.street.add(kerb);
  // [R3-7] part 2: the lamp read as a LOLLIPOP — a bare emissive bead on a
  // stub, apparently standing on the parlour floor, with a halo so weak
  // (2.0 m plane at uK 0.34) it never registered as light in air. Three
  // things fix that, and none of them is "move it out of shot":
  //   · it is a LANTERN — tapered gas lantern, cap and finial on a standard,
  //     so the silhouette itself says street furniture;
  //   · it is planted where the room's own downstage floor edge is ABOVE it
  //     on screen (lap.json asserts `belowFloorEdge`), so it can no longer be
  //     read as standing inside the room;
  //   · it carries a real halo and a ground pool on the rock it stands on,
  //     against an apron that [R3-2] has crushed to rock-in-night — a warm
  //     light out in the dark beyond the room, which is the whole job.
  const LAMP_X = -1.15, LAMP_Z = -1.15, LAMP_Y = 1.59;
  const lampPost = box(0.10, 1.44, 0.10, 0x1b2440);
  lampPost.position.set(LAMP_X, 0.70, LAMP_Z); slots.street.add(lampPost);
  const lampFoot = box(0.24, 0.34, 0.24, 0x1b2440);
  lampFoot.position.set(LAMP_X, 0.17, LAMP_Z); slots.street.add(lampFoot);
  const lampCollar = box(0.20, 0.06, 0.20, 0x2a3555);
  lampCollar.position.set(LAMP_X, 1.41, LAMP_Z); slots.street.add(lampCollar);
  const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.155, 0.34, 4),
    FLAT(PALETTE.amber, { emissive: PALETTE.amber, emissiveIntensity: 0.68 }));
  lampHead.position.set(LAMP_X, LAMP_Y, LAMP_Z);
  lampHead.rotation.y = Math.PI / 4; slots.street.add(lampHead);
  const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.15, 4), FLAT(0x2a3555));
  lampCap.position.set(LAMP_X, LAMP_Y + 0.24, LAMP_Z);
  lampCap.rotation.y = Math.PI / 4; slots.street.add(lampCap);
  const lampFinial = box(0.045, 0.15, 0.045, 0x2a3555);
  lampFinial.position.set(LAMP_X, LAMP_Y + 0.38, LAMP_Z); slots.street.add(lampFinial);
  // (no point light here: three point lights measured +2.4 ms/frame at DPR2
  // and the halo + emissive lantern carry the gas-lamp read on their own)
  const lampHalo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2),
    glowMat(0xffb865, 0.85, 2.8));
  lampHalo.position.set(LAMP_X, LAMP_Y, LAMP_Z);
  slots.street.add(lampHalo);
  // the pool the standard stands in. Without it the post's foot vanishes into
  // the dark apron and the lantern floats again; with it the lamp is planted.
  const lampPool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
    glowMat(0xffa757, 0.42, 2.4));
  lampPool.rotation.x = -Math.PI / 2;
  lampPool.position.set(LAMP_X, 0.63, LAMP_Z); slots.street.add(lampPool);
  anchor(slots.street, 'street', [0, 1.4, 0.4]);

  slots.carriage = makeSlot('carriage', slots.street, [-6.2, 0.14, 0]);
  const cab = box(1.35, 1.45, 2.0, 0x33283f);
  cab.position.y = 0.95; slots.carriage.add(cab);
  const cabRoof = box(1.45, 0.16, 2.1, 0x453a54);
  cabRoof.position.y = 1.72; slots.carriage.add(cabRoof);
  const cabLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.10, 0),
    FLAT(PALETTE.amber, { emissive: PALETTE.amber, emissiveIntensity: 1.2 }));
  cabLamp.position.set(0.72, 1.30, 0.95);
  cabLamp.userData.anchor = 'cabLamp';
  slots.carriage.add(cabLamp);
  const horse = box(0.62, 1.05, 1.7, 0x453a44);
  horse.position.set(0, 0.75, 1.95); slots.carriage.add(horse);
  const wheels = [];
  for (const [wx, wz] of [[0.74, -0.6], [-0.74, -0.6], [0.74, 0.7], [-0.74, 0.7]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 8), FLAT(0x120e18));
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.userData.wheel = true;
    slots.carriage.add(w); wheels.push(w);
  }
  slots.carriage.rotation.y = Math.PI / 2;
  slots.carriage.visible = false;
  /* [R7-3] WHERE THE CAB PULLS UP — AND WHY IT IS PAST THE PLATE.
   * The cab is a box: five flat facets and a wheel, dressing for a sound cue.
   * Round 6 parked it at street-local x = 1.15, which at PORTRAIT put its roof
   * corner just above the plate's bottom-left edge at the DOOR camera — 957 px at
   * i-10-comes2, 972 at i-36-goodnight, 1066 at i-37-door of pale untextured
   * wedge, cut by the inset edge, reading as nothing at all. (Landscape framed 0
   * px of it: its box overlaps that plate too, but everything of it that would have
   * painted is occluded there — which is how one ratio hid what the other showed.)
   * Its mark moved 1.45 m further down its own axis instead: the arrival is
   * carried by hoofbeats, the lamp rake across the pane ([R3-4]) and the landing
   * spill, none of which is the cab's own silhouette, and the cab now stops where
   * no framing in the beat holds it — measured 0 painted px at all 29 framings it is
   * on stage for, at BOTH ratios (lap.mjs `carriage`), with its box still overlapping
   * the plate at 11 landscape / 7 portrait of them and painting nothing on any. The
   * travel itself runs under the
   * WINDOW camera at i-09, which paints 0 px of it at all 11 positions sampled along
   * the path, at both ratios. */
  const CAB_FROM = -6.6, CAB_TO = 2.60;

  // ---- focus anchors registry --------------------------------------
  // ROUND-1 [V1]: `door` and `entrance` used to point the lens at the one
  // wall the key light cannot reach and framed nothing else, so 68–70% of
  // those insets were below luma 26. They now stand off a little further,
  // open up, and swing their look-at back toward the room so the hearth, the
  // rug and the window carry value into the frame with the doorway.
  focus.room       = { obj: root,           at: new THREE.Vector3(0.2, 1.5, 0.0),  radius: 15.5, fov: 26 };
  focus.holmes     = { obj: slots.holmes,   at: new THREE.Vector3(0, 1.30, 0),     radius: 11.5, fov: 27 };
  focus.watson     = { obj: slots.watson,   at: new THREE.Vector3(0, 1.40, 0),     radius: 8.2,  fov: 24 };
  /* ROUND-8b [8b-4a] REFIT. The note lives on Holmes' carry socket now (round 8
   * gave him a real hand to hold it in), i.e. at his chest instead of on a table,
   * and this framing was still fitted to the table: it targeted 0.16 m BELOW the
   * paper and came in to 5.4, so through i-02..i-06 the top of the plate ran
   * through Holmes' skull — 44 to 64 px of crown outside the inset, worst at i-05
   * where the reader HOLDS on the frame for a second and a half. Opened to 6.0
   * and the target lifted 0.18 m to just above the paper: the crown clears the
   * top edge by 41 px at the worst unit, Holmes' box is wholly inside at all five
   * (inset 0.866-0.932 -> 1.000), and the note itself sits on the plate's centre
   * line instead of 57 px above it, which is a better place for the subject of a
   * read anyway. It costs 10% of the note's plate size and none of its legibility
   * (the watermark target still measures at i-06). */
  focus.note       = { obj: slots.note,     at: new THREE.Vector3(0, 0.02, 0),     radius: 6.0,  fov: 24 };
  /* ROUND-8c [8c-4] i-06 GETS ITS OWN LENS. It had been borrowing `focus.note`,
   * which is fitted to the note in Holmes' hand — and at i-06 the note is not the
   * subject: the WATERMARK PLATE is, and main.js draws that as a screen-space
   * overlay, so it is the same rectangle whatever this camera does. What the
   * camera still owns is the strip of diorama around the plate, and there Holmes
   * measured inset 0.9112 — 9% of his box below the bottom edge, i.e. cropped at
   * the ankles behind the one plate a reader looks at longest. The plate framing
   * is untouched (it cannot move); the strip around it now holds a whole man. */
  focus.wmark      = { obj: slots.note,     at: new THREE.Vector3(0, -0.15, 0),    radius: 7.0,  fov: 24 };
  focus.hearth     = { obj: slots.hearth,   at: new THREE.Vector3(0, 0.7, 0.2),    radius: 7.6,  fov: 24 };
  focus.window     = { obj: slots.window,   at: new THREE.Vector3(0.15, -0.62, 1.35), radius: 9.6, fov: 27 };
  focus.door       = { obj: root,           at: new THREE.Vector3(-1.58, 1.22, 0.84), radius: 10.4, fov: 30 };
  focus.street     = { obj: slots.street,   at: new THREE.Vector3(0.4, 1.15, 0.1), radius: 11.0, fov: 26 };
  focus.desk       = { obj: slots.desk,     at: new THREE.Vector3(0.15, 1.00, 0.35), radius: 7.6, fov: 25 };
  /* ROUND-8b [8b-4b] THE GRAZE. At this framing the King's box hung 12 px past
   * the BOTTOM edge — his boots — at i-17, i-27, i-29, i-31, i-32 and i-33: not a
   * crop and not a clean frame, which is the one thing a composition may not be.
   * (The head rework already took the same graze off the two-shot: `two` went
   * 0.945-0.950 -> 1.000 with no camera change at all, because a 0.158-of-stature
   * head is 0.08 m shorter and that was the whole of the overhang there.) The
   * target drops 0.09 m and the radius opens 0.1: his heels come 10 px inside the
   * plate and his crown stays 200 px clear of the top. */
  focus.client     = { obj: slots.client,   at: new THREE.Vector3(0, 1.36, 0),     radius: 9.5,  fov: 25 };
  // ROUND-3 [R4-1 BLOCKING] the mask/unmask camera BISECTED Holmes. He stands
  // at the desk from unit 7, and this framing put the plate's left edge through
  // his coat (inset 0.49/0.44) — the round-1 [c2] finding at a new camera.
  //
  // Tightening cannot fix it: zoom in about the King's face and Holmes' box
  // grows as fast as it slides out, so his right edge sits at a fixed
  //     x_right = 940 - 938/(radius + 2.523) px
  // and never reaches the edge for any positive radius. The frame has to
  // TRANSLATE, so it pans 0.55 m along the camera's own screen-right axis (the
  // azimuth stays locked): that carries the whole of Holmes off the plate
  // (inset 0.0000 at both ratios, 15 and 16) and leaves the King's masked face
  // and the mask target left-of-centre with the lit window as counterweight.
  // The radius comes in so the domino still reads as a domino at the gate.
  /* ROUND-8b [8b-1] REFIT TO THE NEW SKULL. `at` was 1.95 — set when a head
   * spanned 0.192 of stature and its joint sat at 1.81 m, i.e. 0.33 of the way
   * up the head. The head is 0.158 of stature now with its joint at 1.886 m, so
   * the same 1.95 aimed at his JAW and hung the crown in the top of the plate.
   * ROUND-8c [8c-8] and this comment is now the numbers that are actually here,
   * which the round-8b pass left three ways wrong (comment-truth law): it aims
   * 2.06 in slot space — 19 mm under the eye band at headY + 0.545 of the span,
   * 2.079 — and comes in to a radius of 2.95, not the 3.55 the text claimed, with
   * a 0.46 m screen-right pan and not 0.55. Those are the values [8b-1] shipped
   * and the frames it measured; only the prose was stale. The pan is [R4-1]'s fix
   * and it is what keeps Holmes wholly off this plate (inset 0.0000, both
   * ratios); the radius is what makes the face the biggest thing in the frame,
   * which matters because this is the frame the round is judged by eye at. */
  focus.clientFace = { obj: slots.client,   at: new THREE.Vector3(0, 2.06, 0.06),  radius: 2.95, fov: 22,
                       pan: [0.46, 0] };
  focus.two        = { obj: root,           at: new THREE.Vector3(0.25, 1.55, 0.4), radius: 9.0, fov: 25 };
  focus.entrance   = { obj: root,           at: new THREE.Vector3(-1.45, 1.35, 0.85), radius: 10.2, fov: 28 };
  // [R3-1] the introduction three-shot: Holmes at the desk, the King centre,
  // Watson in the wingback. Centred on the screen-space midpoint of the three
  // marks (sx 0.72, sy 1.02) and opened until the widest pair — Holmes' far
  // shoulder to Watson's near arm, 5.56 m of screen-x — clears both edges.
  focus.present    = { obj: root,           at: new THREE.Vector3(0.82, 1.35, -0.28), radius: 12.8, fov: 26 };

  // ---- lighting -----------------------------------------------------
  // ROUND-1 [V1] retune. The ambient/hemisphere floor is what every surface
  // the key cannot see falls back to; at the old levels that floor landed
  // under luma 26 and the left wall, the doorway and the King's lower body
  // all dissolved into one black mass. Lifted, plus a dedicated warm rake
  // from screen-left that picks faceted silhouettes (the King's cloak above
  // all) off the dark plaster without touching the walls it grazes past.
  const lights = new THREE.Group(); lights.name = 'lights';
  lights.add(new THREE.AmbientLight(0x33477a, 1.22));
  lights.add(new THREE.HemisphereLight(0x3c609e, 0x131a2e, 1.02));
  const key = new THREE.DirectionalLight(0xa9c4ff, 1.25);
  key.position.set(-7, 9, 6); lights.add(key);
  const rim = new THREE.DirectionalLight(0xffb459, 0.62);
  rim.position.set(6, 4, -7); lights.add(rim);
  // the cloak rake: from behind-left, nearly opposite the locked camera, so
  // the faces that sit ON the silhouette are the ones that light up.
  const cloakRim = new THREE.DirectionalLight(0xffb478, 1.05);
  cloakRim.position.set(-8.5, 3.2, -3.0); lights.add(cloakRim);
  // the rock the diorama floats on faces DOWN-AND-OUT: without a light from
  // below-front it is the same value as the backdrop and the object stops
  // reading as an object. This is the light that carves it out. [v4] pulled
  // back — the rock's up-facing plateau is vertex-crushed now, so it no
  // longer needs to fight the key light to stay separate from the floor.
  const under = new THREE.DirectionalLight(0x6a8ecb, 0.72);
  under.position.set(5, -4, 8); lights.add(under);
  /* ROUND-8c [8c-1] THE FACE FILL — and it is here because the face plane was
   * MEASURED and found unlit.
   *   The client's head faces (0.65..0.81, 0.12..0.24, 0.58..0.73) at the three
   * framings that hold his face (i-13, i-15, i-16). Against that normal the KEY
   * measures N·L = 0.000 / 0.056 / 0.135 — it is behind his cheek at every one of
   * them — and the only directional with any purchase on it was `under`, at
   * N·L 0.79-0.85. So four fifths of the light on the King's face arrived from a
   * COLD BLUE lamp aimed up from below: irradiance on his mid-face summed to
   * linear RGB (0.224, 0.413, 0.996), i.e. four parts blue to one part red, and
   * the rendered cheek came back (63, 64, 69) — a grey. That is the review's
   * "cold grey-blue mid-face between warm bars", and it is arithmetic, not taste.
   *   It also explains why he had no EYES: a light from BELOW fills an undercut.
   * The socket band measured p50 83.6 against 63.6 on the cheek — the eye band was
   * the BRIGHTEST strip on his face, because `under` shines straight into it.
   *   This is the answer to both. It stands 47 degrees ABOVE his eye line on the
   * axis his face actually points down, so N·L is 0.75-0.84 on the face plane and
   * ~0 on a socket floor tilted 39 degrees the other way: the plane lights, the
   * sockets stay in shadow, and the light that does it is warm.
   *   THE RANGE IS THE SAFETY. `distance` 3.0 with decay 2 is not a look, it is
   * how a new lamp gets added to a diorama whose settled-frame gate is EXACTLY
   * ZERO clipped pixels (CLIP_MAX). Measured from this position, every surface
   * that currently sits near the clip line is OUTSIDE the cutoff and takes
   * literally none of it: the room floor's hot patch 3.66 m, the rug 3.09 m (and
   * the cutoff is 0 by 3.0), the back wall 4.10 m, the left wall 5.45 m, the
   * rock's plateau 6.45 m, the hearth ember 3.7 m, the window pane 3.9 m. What is
   * inside 3.0 m is the client at his mark (his head at 1.69 m), Holmes at his
   * own home mark (2.28 m, and his face takes 0.14 of it), and the side table. */
  const faceFill = new THREE.PointLight(0xffcc96, 2.7, 3.0, 2);
  faceFill.name = 'faceFill';
  faceFill.position.set(0.83, 3.35, 1.30); lights.add(faceFill);
  /* ROUND-8d [8d-2] THE SAME ARITHMETIC, FOR THE MAN IN THE CHAIR.
   *   [8c-1] measured the face plane and lit it, and the lamp it added covers the
   * two marks inside its 3.0 m cutoff: the King at centre stage and Holmes at his
   * home mark. Watson is 4.08 m from it, in the wingback at the hearth, and he was
   * left on the cold half of the room — irradiance (0.32, 0.52, 1.17) linear, R/B
   * 0.273 against the 0.55 the King is gated at. Two of the three faces warm and
   * the third grey-blue is worse than three cold ones, and i-00-head is the
   * ESTABLISHING frame: his is the second face the reader ever sees.
   *   Extending `faceFill` cannot do it. Its range is not a look, it is the safety
   * argument for adding a lamp to a diorama whose settled-frame gate is EXACTLY
   * zero clipped pixels, and opening it to 4.1 m would swallow the rug (3.09 m),
   * the hearth ember (3.7 m) and the back wall (4.10 m) at once. So this is a
   * SECOND lamp with its own arithmetic, and it is small: intensity 0.62 at 0.775 m
   * from his face, 1.5 m of cutoff, decay 2. MEASURED from this position, as box
   * distances to every visible mesh in the diorama —
   *   inside the cutoff: Watson himself (head 0.51 m, chest 0.60, hands 0.84,
   * knees 1.10, feet 1.48) and the wingback he is sitting in (0.47 m at its
   * nearest corner, and it is the surface that takes the most of this lamp); then
   * the fireplace mass at 1.33 m, where the falloff `(1-(d/1.5)^4)^2 / d^2` has
   * already cut it to 0.081, and the hearth stone at 1.43 m, at 0.017.
   *   outside it, taking literally none: the room floor at 1.60 m (the lamp stands
   * 1.60 m over the boards), the back wall 1.74 m, the rock 1.76 m, the side table
   * 1.61 m, Holmes 1.92 m at his chest and 2.24 m at his head, and everything
   * else — the rug, the window, the lamp, the desk — further still.
   *   And the receipt: with it in, all 38 settled units at BOTH ratios still
   * measure exactly 0 clipped pixels in the inset, hottest pixel 248.1 against the
   * 250 line, and V1 nearBlack is unmoved (median 0.229 / 0.273, worst gated beat
   * 0.339 against its 0.40 gate).
   *   It stands 35.7 degrees above his eye line on the axis his face points, the
   * same geometry [8c-1] uses: N·L 0.774 on the face plane, ~0 on a socket floor
   * tilted the other way, so it warms the face and leaves the eye band in shadow.
   * His mid-face irradiance goes (0.32, 0.52, 1.17) -> (1.03, 0.95, 1.39), R/B
   * 0.273 -> 0.740 at i-00 and 0.296 -> 0.751 at i-13, punctual share 0.73 ->
   * 0.86 — in family with the King's 0.72-0.88, not past it. */
  const faceFillW = new THREE.PointLight(0xffcc96, 0.62, 1.5, 2);
  faceFillW.name = 'faceFillW';
  faceFillW.position.set(3.23, 1.82, -0.85); lights.add(faceFillW);
  root.add(lights);

  /* ---- pantomime state ------------------------------------------- */
  const state = {
    now: 0,
    holdK: 0,             // 0..1 press-and-hold fill, owned by main.js
    revealK: 0,
    reveal: null,
    noteMode: 'hand',     // hand | toss | read | lift
    noteToss: 0,
    noteLift: 0, noteLiftWant: 0, noteByHold: false,
    carriage: 0, carriageTarget: 0,
    // E1a — the arrival is STAGED: `arriveOn` arms a repeating carriage-lamp
    // sweep and a growing hall spill so `comes2` is never a frozen frame.
    arriveOn: false, arriveT: 0, arrive: 0,
    // [R3-4] the repeating carriage-lamp PASS is a separate switch from the
    // settled hall glow: the cab has gone by the time the King is presented,
    // so the passes stop at `seat` while the landing stays lit behind him.
    passOn: false,
    knockT: 99,                     // sim seconds since the last knuckle tap
    doorK: 0, doorWant: 0,          // landing glow / knob tell
    doorSwing: 0, doorSwingWant: 0, // the leaf itself
    // [R7-1] the ONE piece of state his exit has. He is on stage from `kingEnter`
    // until `kingOffstage`, which main.js fires under a fully-risen page-turn cover
    // — there is no "leaving" state because there is no walk to be half-way
    // through, at any cadence.
    kingVisible: false,
    maskOff: 0, maskT: 0, masked: true,
    // ROUND-8 gesture drives: the arm channels the acts write to. `reachWant`
    // and `presentWant` are damped targets inside the figure; `unmaskT` is a
    // scripted 0..1 the step advances, like `noteToss`.
    reachWant: 0, presentWant: 0, unmaskT: 0, unmaskOn: false,
    indexLift: 0, indexWant: 0,
    plate: { note: 0, watermark: 0, both: 0 },
    plateWant: { note: 0, watermark: 0, both: 0 },
    dim: 0,
    acts: [],             // acts fired, in order (harness truth)
  };

  // [R4-2] every figure breathes on its own clock: three men idling in unison
  // reads as a mechanism, three men idling out of phase reads as a room.
  const holmesM = makeMover(slots.holmes, HOLMES_HOME, -0.55,
    { breathW: 1.15, breathPhase: 0.0, breath: 0.0038, sway: 0.0085 });
  const clientM = makeMover(slots.client, KING_OUT, Math.PI / 2,
    { breathW: 0.86, breathPhase: 2.1, breath: 0.0032, sway: 0.0062 });
  // Watson is SEATED: less sway (he is wedged in a wingback), and the breath
  // still reads because his chest is over his knees.
  const watsonM = makeMover(slots.watson, WATSON_HOME.clone(), WATSON_YAW,
    { breathW: 1.02, breathPhase: 4.3, breath: 0.0048, sway: 0.0088 });
  holmesM.fig = holmes; clientM.fig = client; watsonM.fig = watson;
  // per-figure phase offsets, so three men never breathe in unison
  holmes.drive.breathW = 1.15; holmes.drive.breathPhase = 0.0;
  client.drive.breathW = 0.86; client.drive.breathPhase = 2.1;
  watson.drive.breathW = 1.02; watson.drive.breathPhase = 4.3;

  /* ROUND-8 retires C1 — the two-King GLB pair. Rounds 3-7 held king.glb and
   * king-unmasked.glb resident simultaneously (200k tris) and flipped the slot's
   * parent pointer at the mask gate, because the vizard was baked into the mesh
   * and there was no other way to take it off. The procedural King wears a mask
   * NODE; `kingUnmask` detaches it. Nothing loads, nothing swaps, and the beat
   * cannot degrade to "a masked man saying I am the King" because the thing that
   * would have to fail is a reparent, not a fetch. */

  // sim-time timeline: every act is a script, never a wall-clock timer
  let timers = [];
  const after = (dt, fn) => timers.push({ at: state.now + dt, fn });
  // acts that need a diegetic sound of their own (a footfall on the stair,
  // the knock) call this; main.js points it at the AudioManager.
  const cueOut = { fn: null };
  const cue = (id) => { if (cueOut.fn) cueOut.fn(id); };

  /** Actions a unit can fire on entry (`unit.act`) or on a gate (`gateAct`). */
  const actions = {
    establish() {
      state.noteMode = 'hand';
      state.noteLiftWant = 0;
    },
    /** post — Holmes tosses the note across to the reader (Watson's POV). */
    noteToss() {
      state.noteMode = 'toss';
      state.noteToss = 0;
    },
    notePlateUp()      { state.plateWant.note = 1; state.plateWant.watermark = 0; },
    /** hold — the plate comes DOWN; the verb happens in the world. */
    noteLift() {
      state.plateWant.note = 0;
      state.noteByHold = true;
      state.noteMode = 'read';
    },
    watermarkPlateUp() {
      state.noteByHold = false;
      state.noteLiftWant = 1;
      state.plateWant.note = 0; state.plateWant.watermark = 1;
    },
    /** gaz1 — Holmes walks to the desk and takes the gazetteer down. The reach
     *  waits for him to ARRIVE: an arm reaching for a book he is 3.8 m from is
     *  the pantomime equivalent of a glide. */
    gazetteerFetch() {
      state.plateWant.note = 0; state.plateWant.watermark = 0;
      state.noteByHold = false; state.noteLiftWant = 0;
      state.noteMode = 'away';
      state.reachWant = 0;
      walkTo(holmesM, HOLMES_DESK, 2.7);
      after(2.7, () => { facePoint(holmesM, ...HOLMES_DESK_LOOK);
                         state.indexWant = 0.35; state.reachWant = 0.55; });
    },
    toIndex()  { facePoint(holmesM, ...HOLMES_DESK_LOOK); state.indexWant = 0.35;
                 state.reachWant = 0.55; },
    /** the index gate resolves: the book comes up and is thumbed open. */
    gazetteerLookup() { state.indexWant = 1; state.reachWant = 1; },
    carriageArrive()  { state.carriageTarget = 1; slots.carriage.visible = true; },
    /**
     * comes2 — ROUND-1 [E1a]. "And here he comes" used to play over a shut,
     * unlit door with nothing moving. The arrival is now STAGED: the cab's
     * lamps sweep the pane and rake the room on a repeating pass, the light
     * under the door swells, and the landing behind it comes up. All of it
     * runs off `state.arriveT`, so it keeps performing for as long as the
     * reader holds the freeze.
     */
    arrival() {
      state.arriveOn = true;
      state.passOn = true;
      state.arriveT = 0;
      state.carriageTarget = 1;
      slots.carriage.visible = true;
      state.doorWant = Math.max(state.doorWant, 0.62);
    },
    /** hadnote — knock, the door opens, the colossus walks in and stops centre. */
    kingEnter() {
      state.kingVisible = true;
      state.arriveOn = true;
      state.passOn = true;
      slots.client.visible = true;
      clientM.pos.copy(KING_LAND); clientM.from.copy(KING_LAND); clientM.to.copy(KING_LAND);
      clientM.t = 0; clientM.dur = 0; clientM.ramp = 0;
      clientM.yaw = Math.PI / 2; clientM.yawWant = Math.PI / 2;
      state.doorWant = 1;
      // CONTENT.md's order: a heavy step on the stair, then the knock, then
      // the door. ASSETS.md §3 durations: step ~0.5 s, knock 2.04 s (first
      // hit inside 0.1 s), so they never pile on each other. [E1a] the knock
      // is no longer sound-only: each knuckle physically taps the leaf.
      after(0.26, () => cue('step'));
      after(0.52, () => { cue('door'); state.knockT = 0; });     // the knock
      after(0.70, () => { state.knockT = 0; });                  // ...triple
      after(0.88, () => { state.knockT = 0; });
      after(0.96, () => { state.doorSwingWant = 1; });           // and the door gives
      /* [8b-2] THE ENTRANCE, RE-TIMED. Two legs, both on the cruise profile:
       *   0.86 -> 1.56  the step through the opening, 0.80 m, peak 1.54 m/s
       *   1.58 -> 4.83  the crossing, 3.373 m in 3.25 s, peak 1.40 m/s
       * so he still FILLS THE DOORWAY at t = 1.7 (he is 3 cm past the sill on
       * that frame, planted and just leaning into the crossing — the frame the
       * review settles on is the frame it was) and the crossing now takes 3.25 s
       * against the 2.1 s that produced 4.8 steps/s.
       *   And he TURNS WHILE HE ARRIVES (4.10, i.e. through the last 22% of the
       * walk) instead of after it. That is what a man does when he walks up to
       * someone, and it is also what keeps the beat readable at reader cadence:
       * the settled i-13 frame — the one framing in the act that holds all three
       * heads — lands 5.10 s in, and he is now stopped AND square to the room
       * before it, with the same margin the 2.1 s sprint used to buy. */
      after(0.86, () => { walkTo(clientM, KING_SILL, 0.70, { ramp: 0.26 }); });
      after(1.58, () => { walkTo(clientM, KING_STAGE, 3.25, { ramp: 0.26 }); });
      /* the turn is solved from the mark he is WALKING TO, not from wherever he
       * happens to be when it fires — `facePoint` reads his current position, so
       * firing it mid-walk would aim him 7 degrees off the room. */
      after(4.10, () => { faceYaw(clientM,
        Math.atan2(1.05 - KING_STAGE.x, -0.35 - KING_STAGE.z)); });
      after(4.95, () => { state.doorSwingWant = 0.28; });
    },
    /** seat — the King turns to face the reader (fact: the reader IS Watson). */
    kingPresent() { state.passOn = false; faceYaw(clientM, 0.62); state.presentWant = 1; },
    pushToMask()  { faceYaw(clientM, 0.42); state.presentWant = 1; },
    /**
     * The mask gate resolves: torn off and hurled to the floor — and, C1,
     * king.glb (which BAKES the vizard) is exchanged for king-unmasked.glb
     * in the same frame, under cover of the mask-drop. Fact I.6 fails
     * otherwise: he says "I am the King" still visibly masked.
     */
    kingUnmask() {
      if (!state.masked) return;
      state.masked = false;
      /* THE TEAR IS A HAND ON A PROP. `unmaskT` runs the arm: 0 -> 0.42 the hand
       * goes to his face and takes hold of the vizard, and the node only comes
       * OFF his head at 0.34 of that — under his own fingers, not a frame before
       * them. 0.42 -> 1 the arm hurls it away and comes back down. The scheduler
       * is the same sim-time `after` every other act uses, so a flush fires it
       * and lands on the finished pose. */
      state.unmaskT = 0;
      state.unmaskOn = true;
      after(0.34, () => { state.maskT = 0; state.maskOff = 1; maskDetach(); });
    },
    /**
     * briony — the King crosses to the threshold and STANDS there.
     *
     * [R5-1] The distance is not the constraint; the DOOR HEAD is. The door
     * camera looks down on the opening at a steep angle and the opening's clear
     * head is 2.54 m up, so a 2.20 m man more than about a third of a metre into
     * the hall has his skull cut off by it. Measured: at 0.53 m past the sill he
     * paints ZERO pixels in his own head band (__slotPixels().head). No lamp
     * fixes that and no architrave can — clearing his head at his final mark
     * would want an opening 3.5 m tall in a 3.3 m room. So the mark he holds is
     * the SILL: whole, breathing, back to the room, between the two lit jambs.
     *
     * [R6-1] Round 5 held that mark on a SIM TIMER (`after(3.7)` walked him out,
     * `after(4.7)` hid him), which made the whole exit a function of how long the
     * reader dwelled. This experience is click-paced, so that timer had three
     * faces, all of them found by walking round 5's build at reader cadences
     * (review/round-5.md): dwell 2.5 s at i-35 gave a HEADLESS goodnight, 3.5 s
     * gave a goodnight to an EMPTY DOORWAY, and 0.5–1.0 s left him standing in the
     * opening across the "click the door" gate.
     *   The stand is now a STATE with no end time: he walks to the sill and holds
     * it for as long as the reader looks, however long that is.
     *
     * [R7-1] AND HE IS NEVER SEEN LEAVING IT. Round 6 moved the walk-out off the
     * timer and onto the reader's advance out of i-36 (`kingWalkOut`, 1.0 s to
     * KING_OUT) — which fixed the pacing and kept the decapitation: the walk was
     * ON CAMERA, and the door head that cuts his skull off 0.53 m past the sill
     * ([R5-1], above) is exactly what the first stride of that walk crossed. At
     * READER cadence the reviewer measured his head band at 0 px from t=0.35 s of
     * the walk onward, never recovering — a headless cream garment stepping into
     * the hall, on the reader's own path, in the 0.98 s before the sweep's settled
     * shot ever looked.
     *   There is no walk now. He holds the sill THROUGH the door gate, whole, at
     * any dwell; the reader clicks the door; the leaf turns; and `kingOffstage`
     * takes him off under a page-turn cover that is FULLY UP, on page 2, a leaf
     * that carries no diorama at all ([R6-6]). The last frame of him is a whole
     * man standing between two lit jambs, and the frame after it is a closing card.
     * Nothing about his exit reads wall time, sim time or dwell, and lap.mjs proves
     * it three ways at both ratios:
     *   · `dwellSweep` re-walks i-35 -> i-36 -> i-37 at dwells of 0.5, 2.5, 5 and
     *     10 s and measures him AT READER CADENCE on the gate beat — the dwell
     *     alone, no settle. Head band 1133-2128 px across the three beats against a
     *     300 px gate (1133-1264 px of that at the gate beat itself), 0 clipped px
     *     of his own anywhere, his mover bound to the SILL at every sample, the door
     *     target ring painting 3274-3585 px with him standing on its mark, and the
     *     gate answering the real raycast into the closing card every time.
     *   · `standScan` steps all 109 frames from the advance out of the goodnight,
     *     through the gate click, to the top of the turn — twice, walked in at 1.7 s
     *     and at 0.5 s a beat, because a reader who clicks through arrives here with
     *     the 2.4 s walk to the sill still running. Of the 436 frames that makes at
     *     both ratios, 372 still have the plate showing; his head band never drops
     *     below 943 px on any of them (gate 300); and 0 of them are the frame round 6
     *     shipped, a body painting with a head band reading 0.
     *   · the page-turn cover reads k=1.000 — fully opaque — on the frame he goes, in
     *     all four passes, one 1/60 s frame after he was last measured whole at 0.998.
     * The measured cost of standing him there: the body in the opening occludes some
     * of the landing spill, so i-37's inset nearBlack goes 0.2144 -> 0.2435 landscape
     * and 0.2608 -> 0.2880 portrait, against a [V1] gate of 0.40.
     */
    kingExit() {
      state.doorSwingWant = 1;
      state.presentWant = 0;
      /* [8b-2] the same check at the sill: 3.373 m in 2.4 s peaked at 2.81 m/s
       * and 3.3 footfalls/s. On the cruise profile at 2.55 s it peaks at the
       * measured 1.79 m/s with plants at a measured median 1.76 footfalls/s
       * ([8d] figures — the man who came in slowly leaves only a little quicker.
       *   It is 2.55 s and not the entrance's 3.25 for a measured reason. The
       * door carries additive tells and the gate's own target ring; at 3.25 s a
       * reader who clicks through at 0.5 s a beat catches him mid-stride 0.6 m
       * INSIDE the room with the ring across his chest, and 5-11 of his pixels
       * clip there. It is not his value doing it — scaling every colour on that
       * mesh down 25% moves the hottest pixel 251.1 -> 249.2, i.e. the surface
       * contributes 2 luma of it and an additive card contributes the rest — so
       * the lever is the MARK, not the paint ([R4-4] with the terms swapped). At
       * 2.55 s he is 0.03 m off the sill on that frame, clear of the ring, and
       * the whole 109-frame stand scan reads 0 clipped px at both walk-in
       * cadences. He is still on his mark 0.85 s before i-36's settled frame. */
      walkTo(clientM, KING_SILL, 2.55, { ramp: 0.26 });   // ...and then he stands
    },
    /**
     * [R7-1] The King leaves the stage BEHIND THE PAGE. main.js calls this from
     * `enterEndLeaf`, i.e. at the top of the page turn, with the cover at full
     * opacity and the diorama pass already dropped for page 2 — so this is a state
     * change on an unwatched stage, not a performance. It is deliberately NOT a
     * unit act: `__gotoUnit` replays unit acts, and a King who vanished on a jump
     * to i-37 would be a different diorama from the one a reader walks to.
     */
    kingOffstage() {
      state.kingVisible = false;
      slots.client.visible = false;
      // park him on his off-plate mark so nothing is left mid-stride for a flush
      clientM.pos.copy(KING_OUT); clientM.from.copy(KING_OUT); clientM.to.copy(KING_OUT);
      clientM.t = clientM.dur; clientM.walking = false;
    },
    holmesReturn() { walkTo(holmesM, HOLMES_TWO, 2.2);
                     after(2.2, () => facePoint(holmesM, -0.55, 1.05)); },
    bothPlateUp()  { state.plateWant.both = 1; },
    plateOff()     { state.plateWant.note = 0; state.plateWant.watermark = 0;
                     state.plateWant.both = 0; },
    /** the finale: the door swings wide onto Serpentine Avenue. */
    doorOpen()     { state.doorSwingWant = 1; state.doorWant = 1; },
  };

  /** Fire an act by name; records it for the harness. Unknown names no-op. */
  function fireAct(name) {
    if (!name) return false;
    const fn = actions[name];
    if (!fn) return false;
    fn();
    state.acts.push({ name, t: +state.now.toFixed(3) });
    return true;
  }

  function setHold(k) { state.holdK = ease.clamp01(k); }
  function setReveal(id, k) { state.reveal = id; state.revealK = ease.clamp01(k); }

  /**
   * Run every scheduled beat NOW and snap every damped value to its target.
   * This is what makes a JUMP coherent: replay the acts of units 0..n-1 with
   * `fire()`, call `flush()` after each, and the diorama is in the state a
   * reader who walked there would see (King on stage, mask on the floor,
   * Holmes at the desk) instead of half-way through three walks at once.
   */
  function flush() {
    let guard = 0;
    while (timers.length && guard++ < 500) {
      timers.sort((a, b) => a.at - b.at);
      timers.shift().fn();
    }
    for (const m of [holmesM, clientM, watsonM]) {
      m.pos.copy(m.to); m.prev.copy(m.to); m.t = m.dur; m.walking = false;
      m.yaw = m.yawWant; m.speed = 0;
      m.slot.position.set(m.pos.x, m.pos.y, m.pos.z);
      m.slot.rotation.set(0, m.yaw, 0);
      if (m.fig) {
        // hand the figure the settled mover state, then snap its own damped
        // channels: a flushed pose has to be the pose a reader who WALKED here
        // is looking at, or __gotoUnit and the lap disagree by an arm
        m.fig.drive.speed = 0; m.fig.drive.walking = false;
        m.fig.drive.pos.set(m.pos.x, m.pos.y, m.pos.z); m.fig.drive.yaw = m.yaw;
        m.fig.drive.tFlush = state.now;
      }
    }
    if (state.unmaskOn) state.unmaskT = 1;
    holmes.drive.lift = state.noteLiftWant;
    holmes.drive.toss = state.noteMode === 'toss' ? 1 : 0;
    holmes.drive.reach = state.reachWant;
    client.drive.present = state.presentWant;
    client.drive.unmask = state.unmaskT;
    for (const f of [holmes, watson, client]) f.flush();
    state.noteLift = state.noteLiftWant;
    state.carriage = state.carriageTarget;
    state.doorK = state.doorWant;
    state.doorSwing = state.doorSwingWant;
    state.indexLift = state.indexWant;
    state.knockT = 99;
    if (state.arriveOn) state.arrive = 1;
    for (const k of ['note', 'watermark', 'both']) state.plate[k] = state.plateWant[k];
    if (state.maskOff > 0) {
      state.maskT = 1;
      maskDetach();
      maskNode.position.copy(MASK_FLOOR);
      maskNode.rotation.set(MASK_LIE.x, MASK_LIE.y, MASK_LIE.z);
      maskNode.scale.setScalar(MASK_DROP_S);
      maskPaint(1);
    }
    slots.client.visible = state.kingVisible;
    if (state.carriageTarget > 0) slots.carriage.visible = true;
  }

  /** Reset everything a replay must un-do (harness `__gotoUnit` scrubbing). */
  function resetPantomime() {
    state.acts.length = 0;
    timers = [];
    state.noteMode = 'hand'; state.noteToss = 0;
    state.noteLift = 0; state.noteLiftWant = 0; state.noteByHold = false;
    state.carriage = 0; state.carriageTarget = 0;
    state.arriveOn = false; state.passOn = false;
    state.arriveT = 0; state.arrive = 0; state.knockT = 99;
    state.doorWant = 0; state.doorSwingWant = 0;
    state.kingVisible = false;
    slots.client.visible = false;
    state.masked = true; state.maskOff = 0; state.maskT = 0;
    state.unmaskT = 0; state.unmaskOn = false;
    state.reachWant = 0; state.presentWant = 0;
    maskAttach();                                // scrubbing back re-masks him
    for (const f of [holmes, watson, client]) f.reset();
    state.indexWant = 0;
    state.plateWant.note = 0; state.plateWant.watermark = 0; state.plateWant.both = 0;
    // [8b-2] `ramp` is part of a mover's path state, so it resets with `t`/`dur`:
    // a replay must never inherit the previous walk's speed profile.
    clientM.pos.copy(KING_OUT); clientM.t = 0; clientM.dur = 0; clientM.ramp = 0;
    clientM.yaw = Math.PI / 2; clientM.yawWant = Math.PI / 2;
    holmesM.pos.copy(HOLMES_HOME); holmesM.t = 0; holmesM.dur = 0; holmesM.ramp = 0;
    holmesM.yaw = -0.55; holmesM.yawWant = -0.55;
    watsonM.pos.copy(WATSON_HOME); watsonM.t = 0; watsonM.dur = 0; watsonM.ramp = 0;
    watsonM.yaw = WATSON_YAW; watsonM.yawWant = WATSON_YAW;
    /* ROUND-8 [R8-7] ...AND A PARKED MOVER HAS NOWHERE TO GO.
     * This reset moved `pos` and left `from`/`to` holding the last mark the mover
     * had been sent to — and `flush()`, three lines up, does `pos.copy(to)`. So the
     * FIRST flush of a replay teleported every mover to a stale destination, and
     * the man who was supposed to walk there next was already standing on the spot:
     * `__gotoUnit(7)` a second time gave a Holmes AT the desk who never crossed the
     * room (measured by lap.mjs's [R8-2] joint scan — 0 of 204 frames walking, no
     * stances, cadence null, on the very walk scene.js says he takes). The King hid
     * it because `kingEnter` sets his from/to explicitly and Watson because he never
     * walks anywhere. It is exactly the [R6-3] contract — a scrubbed unit is the
     * diorama a reader who WALKED here is looking at — failing on the second jump
     * through the same unit, which is what a probe suite does all day. */
    for (const m of [holmesM, clientM, watsonM]) {
      m.from.copy(m.pos); m.to.copy(m.pos); m.prev.copy(m.pos);
    }
    slots.carriage.visible = false;
  }

  const _q = new THREE.Vector3();
  const _noteEuler = new THREE.Euler(), _noteQ = new THREE.Quaternion();
  const _sockP = new THREE.Vector3(), _sockQ = new THREE.Quaternion();
  const _sockS = new THREE.Vector3();

  /** One fixed sim step. `t` is absolute sim seconds — the beat clock. */
  function step(t, dt) {
    state.now = t;
    // scripted act timeline
    if (timers.length) {
      const due = timers.filter(x => x.at <= t);
      if (due.length) {
        timers = timers.filter(x => x.at > t);
        for (const d of due) d.fn();
      }
    }

    // movers: walk + turn + idle life, all of it on the SLOT ([R4-2]) -----
    stepMover(holmesM, dt, t);
    stepMover(clientM, dt, t);
    stepMover(watsonM, dt, t);
    /* [R7-1] There is no exit resolve here any more. Round 6 hid the King on the
     * frame his own 1.0 s walk-out landed, which is a state change the reader
     * WATCHES — and watched him lose his head to the door lintel on the way. His
     * last mark is the sill; `kingOffstage` (main.js enterEndLeaf) takes him off
     * behind the risen page cover, so nothing in step() has to end him. */
    /* ROUND-8: there is no `stepLegs` here any more, and no placeholder/GLB
     * fork. `stepMover` hands each figure its speed and mark and the figure
     * poses its own 16 joints — walking legs with knee flexion, arm
     * counter-swing, chest counter-rotation, breath — so the same code runs on
     * stage as ran before the art landed, because it IS the art. */

    // ---- the gesture channels the acts wrote to -------------------
    // Damping lives inside the figure; what happens here is the SCRIPTED part:
    // the two one-shot progressions (the toss, the unmask) advancing on sim
    // time, exactly like the mask's own tumble below.
    if (state.unmaskOn && state.unmaskT < 1) {
      state.unmaskT = Math.min(1, state.unmaskT + dt / 1.05);
    }
    holmes.drive.reach = state.reachWant;
    client.drive.present = state.presentWant;
    client.drive.unmask = state.unmaskT;

    // hearth flicker (deterministic, sim-time driven)
    const flick = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.7));
    hearthLight.intensity = 7.5 * flick;
    fire.scale.setScalar(0.9 + 0.18 * flick);
    // [R4-3] the fire's own VALUE flickers with it — but from a fixed emissive
    // ceiling, so the ember can never clip back to a cream card.
    fireMat.emissiveIntensity = EMBER_E * (0.80 + 0.20 * flick);
    windowLight.intensity = 11 + Math.sin(t * 1.9) * 1.2;
    haloMat.uniforms.uK.value = 0.52 + 0.06 * Math.sin(t * 1.9);

    // ---- the note ------------------------------------------------
    /* THE PAPER NO LONGER MOVES ITSELF. Rounds 1-7 tweened the note between
     * three marks in HOLMES-SLOT space and poked a placeholder arm alongside it
     * with `holmesArm()` — two animations of one event that had to be kept in
     * agreement by hand, and which went dead the moment holmes.glb landed and
     * the arm it posed was detached ([R4-2]'s dead code).
     *   The sheet is parented to the hand's carry socket, so its POSITION is
     * whatever the arm does. What is still solved here is the one thing the hand
     * must not be allowed to decide: the sheet's FACING. The locked camera
     * azimuth means a letter turned edge-on is a letter the reader cannot read,
     * so the note is given a WORLD orientation every step (the read azimuth, plus
     * the tilt that opens the page toward the lens as the hold fills) and the
     * local rotation that holds it there inside the socket's frame is solved from
     * the socket's own matrix.
     */
    if (state.noteByHold) state.noteLiftWant = state.holdK;
    slots.note.visible = (state.noteMode === 'toss' || state.noteMode === 'read');
    state.noteLift = damp(state.noteLift, state.noteLiftWant, 6.5, dt);
    if (state.noteMode === 'toss') {
      state.noteToss = Math.min(1, state.noteToss + dt / 0.85);
      if (state.noteToss >= 1) state.noteMode = 'read';
    }
    holmes.drive.toss = state.noteMode === 'toss' ? state.noteToss : 0;
    holmes.drive.lift = state.noteMode === 'read' ? state.noteLift : 0;
    if (slots.note.visible) {
      const lift = ease.inOut(state.noteLift);
      const tossK = state.noteMode === 'toss'
        ? Math.sin(Math.PI * Math.min(1, state.noteToss * 1.25)) : 0;
      _noteEuler.set(-0.30 - lift * 0.26 + tossK * 0.20, READ_AZIM, lift * 0.12 - tossK * 0.16);
      _noteQ.setFromEuler(_noteEuler);
      holmes.socket.updateWorldMatrix(true, false);
      holmes.socket.matrixWorld.decompose(_sockP, _sockQ, _sockS);
      slots.note.quaternion.copy(_sockQ).invert().multiply(_noteQ);
    }

    // reveal tracks the reader's own hand
    const rk = Math.max(state.revealK, state.holdK * 0.55);
    wmarkMat.opacity = 0.85 * rk;
    wmark.scale.setScalar(0.94 + 0.06 * rk);
    noteGlowMat.uniforms.uK.value = 0.85 * state.holdK + 0.35 * state.revealK;

    // ---- carriage -------------------------------------------------
    state.carriage = damp(state.carriage, state.carriageTarget, 1.5, dt);
    const c = ease.out(state.carriage);
    slots.carriage.position.x = CAB_FROM + c * (CAB_TO - CAB_FROM);
    const rollSpeed = (state.carriageTarget - state.carriage) * 9;
    for (const w of wheels) if (w.userData.wheel) w.rotation.x += rollSpeed * dt * 4;
    if (cabLamp.material) cabLamp.material.emissiveIntensity = 1.0 + 0.35 * Math.sin(t * 5.1);

    // ---- the arrival: carriage lamps sweep, the landing comes up ----
    // [E1a] A repeating pass, not a one-shot, so the beat performs for as
    // long as the reader holds `comes2` — and every value here is a pure
    // function of sim time, so two laps are the same pixels.
    if (state.arriveOn) state.arriveT += dt;
    state.arrive = state.arriveOn ? 1 - Math.exp(-state.arriveT / 1.15) : 0;
    const passT = state.passOn ? (state.arriveT % 2.8) / 2.8 : -1;
    // a lamp is a narrow travelling bump, dark between passes
    const passK = passT < 0 ? 0 : Math.exp(-Math.pow((passT - 0.44) / 0.27, 2));
    paneSweepMat.uniforms.uK.value = PANE_SWEEP_K * passK;
    paneSweep.position.x = -0.72 + passT * 1.44;
    roomSweepMat.uniforms.uK.value = 0.85 * passK;
    roomSweep.position.z = -2.30 + passT * 4.10;
    roomSweep.visible = passK > 0.01;
    paneSweep.visible = passK > 0.01;

    // ---- the door -------------------------------------------------
    slots.client.visible = state.kingVisible;
    state.doorK = damp(state.doorK, state.doorWant, 2.6, dt);
    state.doorSwing = damp(state.doorSwing, state.doorSwingWant, 3.0, dt);
    // the knock physically taps the leaf: a damped rattle on the hinge
    state.knockT += dt;
    const rattle = state.knockT < 0.55
      ? Math.sin(state.knockT * 44) * Math.exp(-state.knockT * 8.4) * 0.090 : 0;
    doorHinge.rotation.y = state.doorSwing * 1.40 + rattle;
    doorLeaf.position.z = rattle * 0.34;
    // the brass knob picks up the landing light as a tell that the hall is lit.
    // [R4-4] its emissive is down a stop: brass plus the threshold lamp put the
    // one specular facet within a luma of clipping at every door framing.
    if (knob.material) knob.material.emissive.setHex(state.doorK > 0.02 ? 0x452c0b : 0x000000);
    const hallK = Math.max(state.doorK, state.arrive * 0.85);
    /* [R5-1] THE CARD YIELDS TO A BODY IN THE DOORWAY.
     * doorGlow is an additive flat hung in the opening, and it is depth-TESTED,
     * not depth-sorted: it is nearer than anyone who has stepped through the
     * threshold, so it composites straight over him. At i-36-goodnight that cost
     * the departing King his head — measured, 76 clipped px on his own shoulders
     * and ZERO pixels painted in his head band: a headless cream garment
     * standing in a lit hole (see __slotPixels().head).
     *   A body in a doorway occludes the light behind it, so the card gives up
     * most of its strength while a figure is past its plane and comes back the
     * moment the opening is clear. MOST, not all — a full duck put the landing
     * out and his exit read as a man dissolving into a black hole.
     *   [R6-2] THE RAMP, AND WHY IT MOVED. Round 5 justified the 0.85 yield from a
     * scan that sampled his crossing every 0.1 s and reported ZERO clipped pixels at
     * every instant. That was the sampling reading between the app's own 1/60 s
     * frames. Measured frame-exact and at four clock phases (lap.mjs walkScan), that
     * build peaked at 223 px worst-of-four on the inbound crossing — single-phase
     * samples of the SAME window ranged 67 to 356 px, because a flat cream facet was
     * sitting on the clip line and a 3% swing in the light moved a lot of area across
     * it. Hiding one light at a time on the peak frame found the pair responsible:
     * with the threshold lamp off his hottest pixel is 226.8, with this card off it
     * is 236.2, and with both on it is 253.1. So the card was the half of it that
     * could be given back.
     *   It could be given back because the ramp was wrong about anatomy: `cross` was
     * 0.20 m of pre-roll and full 0.30 m PAST the plane, which concedes the occlusion
     * only after his mark has crossed — and a man's chest is a quarter-metre in front
     * of his mark, over the card and being composited over, well before that. The
     * ramp was moved to start 0.55 m in front of the plane and be full 0.10 m past
     * it, which is where his chest is when it starts blocking the landing — see
     * [R8-6] below for where the same argument lands once the man has a gait. MEASURED
     * result: the inbound crossing peaks at 10 px at both ratios (worst of four clock
     * phases; per-phase 1/4/0/10 landscape, 1/5/0/10 portrait) and his last beat at
     * 0 px on all 436 of its frames ([R7-1] standScan), with a hottest pixel of
     * 246.8 — under the clip line entirely — and the cost is 0.45 luma of inset mean
     * at i-36-goodnight and 0.0002 of V1 headroom at i-11-hadnote.
     *   Two other levers were measured against the same peak with the same
     * instrument and rejected; scene.js records them by the threshold lamp.
     *   `cross` is a pure function of the client's MARK, so two laps are the same
     * pixels. Measured at the settled frames, on round 6's pair: exactly 0 at
     * i-10-comes2 (he is not on stage) and at i-35-briony (his mark is 0.78 m in
     * front of the plane, clear of that 0.55 m pre-roll), and 0.689 — the card at
     * 41% of full — at i-11-hadnote,
     * i-36-goodnight and, [R7-1], i-37-door, the three framings where he STANDS in
     * the opening. i-37 joined that list when the walk-out was deleted: he fills the
     * opening across the whole gate beat, so the landing behind him should be down,
     * and the hall glow and the threshold lamp are what keep it warm behind him —
     * however long the reader looks at it.
     */
    /* ROUND-8 [R8-6] THE RAMP IS ABOUT ANATOMY, AND THE ANATOMY MOVES NOW.
     * Round 6 widened the pre-roll from 0.20 m to 0.55 m because a man's CHEST is
     * a quarter-metre in front of the mark this ramp is anchored on. The cast is
     * jointed this round, so the thing furthest in front of his mark is no longer
     * his chest: it is his SWINGING HAND. Measured on the walk to the sill, at the
     * fast reader cadence lap.mjs's standScan walks in at, his mark reads x
     * -2.882 while `seg:handR`'s leading edge is at x -3.640 — 0.76 m ahead of
     * him and 0.15 m PAST this card's plane (-3.490) — with `cross` reading 0,
     * i.e. the card at FULL strength, compositing over his knuckles: 9 of his own
     * pixels over luma 250 (hide the card and it is 0, hottest 223.1).
     *   So the pre-roll now covers the reach instead of the chest, and the SPAN
     * widens with it to hold the two numbers earlier rounds measured. The pair is
     * solved from both ends rather than picked: at the sill (x -3.250, the mark he
     * holds through i-11, i-36 and the whole door gate) cross reads 0.6905 against
     * round 6's 0.6889 — the card at 41% of full, the value [R5-1] and [R6-2]
     * argued the landing's read from, unchanged to three decimals — and where his
     * hand crosses the plane it reads 0.47, putting the card at 60%, which is the
     * strength that measured 0 clipped px on him with 10 luma of headroom.
     *   Full yield still only happens with his mark out in the hall (x <= -3.773)
     * and the card is back to full strength once he is 0.8 m into the room, so the
     * centre-stage framings (KING_STAGE is x 0.05) read exactly as they did. The one
     * framing that MOVES is i-35-briony, where he is mid-walk 0.78 m in front of the
     * plane: round 6's ramp read 0 there and this one reads 0.37, so the landing
     * behind him is at 69% instead of 100%. It costs a little glow on an artefact
     * beat and it can only ever reduce clipping on the man walking through it;
     * i-35 is not a [V1] beat and its own numbers are in the lap. */
    const cross = slots.client.visible
      ? ease.clamp01((DOORGLOW_X - clientM.pos.x + 1.40) / 1.68) : 0;
    doorGlow.material.opacity = (0.30 * hallK * (0.84 + 0.16 * Math.sin(t * 4.1))
      + 0.34 * state.doorSwing) * (1 - 0.85 * cross);
    // [R4-4] the strip of hall light under the leaf is ADDITIVE, and it sits on
    // the one surface the threshold lamp already lights hardest, so at full
    // arrival it was driving the sill over white in every framing that held the
    // doorway. Toned to a peak that still reads as light escaping under a shut
    // door (it is the arrival's first tell) and can no longer clip it.
    underDoorMat.opacity = (0.22 + 0.42 * state.arrive) * (0.86 + 0.14 * Math.sin(t * 2.7))
      * (1 - 0.5 * state.doorSwing);
    hallGlowMat.uniforms.uK.value = 0.26 + 0.44 * hallK + 0.16 * state.doorSwing
      + 0.05 * Math.sin(t * 1.7);
    // ...and so is the puddle it throws on the boards: with the leaf wide open
    // AND the arrival settled the two additive terms stacked, and the boards
    // right at the threshold went over white ([R4-4], 200 px at i-11-hadnote).
    spillMat.uniforms.uK.value = 0.10 + 0.25 * state.arrive + 0.37 * state.doorSwing
      + 0.04 * Math.sin(t * 2.3 + 1.1);
    hallLight.intensity = HALL_GAIN * (3.2 + 5.6 * hallK + 4.0 * state.doorSwing
      + 0.35 * Math.sin(t * 3.3));

    // ---- the mask: torn off and hurled to the floor ---------------
    if (state.maskOff > 0 && state.maskT < 1) {
      state.maskT = Math.min(1, state.maskT + dt / 0.95);
      const k = state.maskT;
      // it leaves from wherever his HAND took it off, not from a fixed mark:
      // `maskDetach` records that point in slot space at the moment of the tear
      _q.lerpVectors(_mFrom, MASK_FLOOR, ease.out(k));
      _q.y += Math.sin(Math.PI * k) * 0.34;
      maskNode.position.copy(_q);
      // [R4-5] the tumble ARRIVES at the lying pose instead of snapping to it:
      // one full turn about each axis, landing face up on the rug.
      maskNode.rotation.set(MASK_LIE.x - (1 - k) * 5.60,
                            MASK_LIE.y - (1 - k) * 2.20,
                            MASK_LIE.z - (1 - k) * 3.10);
      maskNode.scale.setScalar(MASK_WORN_S + (MASK_DROP_S - MASK_WORN_S) * ease.out(k));
      maskPaint(ease.out(k));
    }

    // ---- the index ------------------------------------------------
    state.indexLift = damp(state.indexLift, state.indexWant, 4.2, dt);
    indexRig.position.y = INDEX_REST + state.indexLift * 0.30;
    indexRig.rotation.x = -state.indexLift * 0.55;
    indexRig.rotation.z = state.indexLift * 0.12;

    // ---- plate levels (main.js renders the overlay) ---------------
    for (const k of ['note', 'watermark', 'both']) {
      state.plate[k] = damp(state.plate[k], state.plateWant[k], 5.0, dt);
    }
    // the hold crossfades note-plate -> watermark-plate in proportion
    if (state.noteByHold) {
      state.plate.watermark = Math.max(state.plate.watermark, state.holdK);
      state.plate.note = Math.min(state.plate.note, 1 - state.holdK);
    }
    state.dim = Math.min(0.72,
      0.72 * Math.max(state.plate.note, Math.max(state.plate.watermark, state.plate.both)));
  }

  /** Where the hold ring should be pinned, in world space. */
  const _v = new THREE.Vector3();
  function focusWorld(id, out = _v) {
    const f = focus[id] || focus.room;
    f.obj.updateWorldMatrix(true, false);
    out.copy(f.at).applyMatrix4(f.obj.matrixWorld);
    return out;
  }

  const _tv = new THREE.Vector3();
  /** World position of a named click target ('mask' | 'index' | 'door'). */
  function targetWorld(id, out = _tv) {
    const tg = targets[id];
    if (!tg) return out.set(0, 0, 0);
    tg.obj.updateWorldMatrix(true, false);
    out.copy(tg.at).applyMatrix4(tg.obj.matrixWorld);
    return out;
  }

  /** Meshes a raycast for target `id` should hit (subtree, so GLBs work). */
  function targetHits(id) {
    const tg = targets[id];
    if (!tg) return [];
    const out = [];
    tg.obj.traverse(o => { if (o.isMesh) out.push(o); });
    return out.length ? out : tg.hits.filter(Boolean);
  }

  /** Is the named target on stage at all right now? */
  function targetLive(id) {
    if (id === 'mask') return state.kingVisible && state.masked;
    return true;
  }

  const _hv = new THREE.Vector3();
  /** World position of a speaker's head — the leader line's far end. */
  function headWorld(who, out = _hv) {
    // ROUND-8: the leader line lands on the HEAD JOINT, so it tracks a turned,
    // walking, breathing head instead of a fixed height in slot space.
    if (who === 'HOLMES') return holmes.headWorld(out);
    if (who === 'KING' || who === 'CLIENT') return client.headWorld(out);
    return null;
  }

  /**
   * [E1b] Give the letter a folded-paper read. main.js hands over a CROP of
   * assets/plates/note-plate.png (the sheet on the side table, minus the
   * lamp and the table), so the quad in Holmes' hand is the same paper the
   * plate shows instead of a flat beige card. No texture -> the Lambert
   * cream stays, and nothing else changes.
   */
  function setNoteTexture(tex) {
    if (!tex) return false;
    sheetMat.map = tex;
    sheetMat.color.setHex(0xffffff);
    sheetMat.emissive.setHex(0x8f7048);
    sheetMat.needsUpdate = true;
    return true;
  }

  /* ---- round-3 review probes ---------------------------------------
   * Named WORLD samples the harness turns into page pixels and measures
   * luma at, so lap.json's numbers describe the surfaces they are named
   * after instead of a rectangle that happens to sit near them.
   *   apron  [R3-2] the rock plateau OUTSIDE the room footprint. Every
   *          sample is raycast down onto the real rock, and every one is
   *          chosen to be inside the establishing frame, clear of the room,
   *          and >1.9 m from the street lamp's pool.
   *   floor  [R3-2] the room's own floorboards, clear of the rug, the desk,
   *          the hearth, the side table and both chairs.
   *   pane   [R3-3]/[R3-4] the glass rectangle, as four world corners.
   *   lamp   [R3-7] the lantern's centre.
   */
  const APRON_XZ = [[4.10, -0.20], [3.95, -1.60], [3.90, 1.10],
                    [1.40, 3.20], [2.05, 2.90], [-2.60, 2.95]];
  const FLOOR_XZ = [[-3.05, -2.25], [-1.10, 2.30], [0.90, 2.30],
                    [2.90, 2.25], [-2.90, 1.90], [-0.60, -2.20]];
  const _rayD = new THREE.Raycaster();
  const _dn = new THREE.Vector3(0, -1, 0);
  let apronCache = null;
  const probes = {
    apron() {
      if (apronCache) return apronCache;
      root.updateWorldMatrix(true, true);
      apronCache = APRON_XZ.map(([x, z]) => {
        _rayD.set(new THREE.Vector3(x, 8, z), _dn);
        const hit = _rayD.intersectObject(rockMesh, false)[0];
        return hit ? hit.point.clone() : new THREE.Vector3(x, -0.5, z);
      });
      return apronCache;
    },
    floor: () => FLOOR_XZ.map(([x, z]) => new THREE.Vector3(x, 0.2225, z)),
    pane() {
      slots.window.updateWorldMatrix(true, false);
      const out = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        out.push(new THREE.Vector3(sx * PANE_W / 2, sy * PANE_H / 2, 0.095)
          .applyMatrix4(slots.window.matrixWorld));
      }
      return out;
    },
    /**
     * A grid ON THE GLASS. The pane is seen obliquely at the door camera, so
     * its screen bounding box is 40% wall — measuring the mean inside that box
     * diluted the carriage-lamp swing to a third of what the eye actually
     * sees. These are surface samples, and they dodge the glazing bars
     * (vertical at u=0, horizontals at v=+/-0.334 of the half-height) so the
     * number describes GLASS.
     */
    paneGrid() {
      slots.window.updateWorldMatrix(true, false);
      const us = [-0.72, -0.48, -0.24, 0.24, 0.48, 0.72];
      const vs = [-0.82, -0.62, -0.44, -0.20, 0.00, 0.20, 0.46, 0.64, 0.82];
      const out = [];
      for (const u of us) for (const v of vs) {
        out.push(new THREE.Vector3(u * PANE_W / 2, v * PANE_H / 2, 0.098)
          .applyMatrix4(slots.window.matrixWorld));
      }
      return out;
    },
    lamp() {
      slots.street.updateWorldMatrix(true, false);
      return new THREE.Vector3(LAMP_X, LAMP_Y, LAMP_Z)
        .applyMatrix4(slots.street.matrixWorld);
    },
    /**
     * [R4-3] the box the hearth fire could paint in: the eight corners of its
     * silhouette at the current flicker scale. It is only a SEARCH WINDOW —
     * Watson's chair and his book sit inside it at the establishing camera, so
     * the fire's own value is measured by hiding the fire and keeping the pixels
     * that change (main.js `__emberPixels`), never by averaging this rectangle.
     */
    ember() {
      fire.updateWorldMatrix(true, false);       // the flicker scale rides along
      const r = 0.34, out = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        out.push(new THREE.Vector3(sx * r, sy * r, sz * r).applyMatrix4(fire.matrixWorld));
      }
      return out;
    },
    // the room floor's downstage corners — [R3-7] wants the lantern measured
    // against the silhouette it used to sit inside
    floorFront: () => [new THREE.Vector3(-RW / 2, 0.22, RD / 2),
                       new THREE.Vector3(RW / 2, 0.22, RD / 2)],
  };

  /**
   * [R4-2], ROUND-8. WHAT THE FIGURES ARE ACTUALLY DOING THIS FRAME.
   *
   * Round 3 left the post-swap figures dead and round 4 answered it with a bob
   * and a roll written onto the SLOT, which this function then reported. Both
   * numbers were inputs: `|sin(phase)| * 0.055` at a fixed 5.6 rad/s, read back
   * out and called evidence of a walk.
   *   Everything here is now read off the POSED SKELETON after the step — the
   * pelvis's own height above its rest, the pelvis roll it is holding, the knee
   * and elbow angles, the FOOTFALL RATE the speed produced and the STEP LENGTH
   * that keeps the feet still ([8c-3]: footfalls/s, and the metres one covers).
   * `y`/`bobY`/`roll` keep their old names and their old
   * meaning (the gate that wants a walk to move vertically is the same gate);
   * they are just no longer describing a value nothing draws.
   */
  const gait = () => {
    const out = {};
    for (const [name, m] of Object.entries({ holmes: holmesM, client: clientM, watson: watsonM })) {
      const k = m.fig.metric, d = m.fig.dims;
      const bob = +(k.pelvisY - d.hipY).toFixed(5);
      out[name] = { walking: m.walking, speed: +m.speed.toFixed(4),
                    y: +(m.pos.y + bob).toFixed(5), bobY: bob, roll: k.roll,
                    breath: +m.lifeY.toFixed(5), sway: +m.lifeR.toFixed(5),
                    scaleY: +m.slot.scale.y.toFixed(5),
                    // the joint animation itself
                    knee: [k.kneeL, k.kneeR], elbow: [k.elbowL, k.elbowR],
                    /* [8c-3] FOOTFALLS per second, and the metres one covers.
                     * [8d-1] MEASURED off the plants themselves — one over the
                     * interval since the other foot landed — with the cadence
                     * arithmetic's own answer reported beside it as `driveHz`. */
                    footfallHz: k.footfallHz, stepLen: k.stepLen,
                    driveHz: k.driveHz, driveStep: k.driveStep, gaitW: k.w };
    }
    return out;
  };

  /**
   * The joint scan: arm it, walk something, read it. Ranges are accumulated on
   * EVERY fixed step (not sampled), and the foot slide is measured off world
   * joint positions, so "his knee bends and his feet do not skate" is a
   * measurement of the geometry the reader sees. Harness-only — it costs a
   * matrix walk per figure per frame.
   */
  const gaitScan = (on) => {
    for (const f of [holmes, watson, client]) f.scan(on);
    return !!on;
  };
  const gaitScanRead = () => ({
    holmes: holmes.scanRead(), watson: watson.scanRead(), client: client.scanRead(),
  });

  /**
   * ROUND-8 style ledger, read off the built scene graph rather than asserted:
   * the cast's whole triangle budget, its material count, and whether any of it
   * carries a texture sampler or lost flat shading. The three GLBs this replaced
   * were 100k triangles each with baked PBR maps.
   */
  const figureStyle = () => {
    const per = { holmes: holmes.style(), watson: watson.style(), client: client.style() };
    const sum = (k) => per.holmes[k] + per.watson[k] + per.client[k];
    return { per, tris: sum('tris'), meshes: sum('meshes'), materials: sum('materials'),
             textures: sum('textures'),
             flatShaded: per.holmes.flatShaded && per.watson.flatShaded && per.client.flatShaded,
             vertexColors: per.holmes.vertexColors && per.watson.vertexColors && per.client.vertexColors,
             heights: { holmes: holmes.dims.H, watson: watson.dims.H, client: client.dims.H } };
  };

  /** [R7-1]+ROUND-8: is the vizard on his face, or on the rug? Off the graph. */
  const maskState = () => ({
    attached: maskNode.parent === client.joints.head,
    visible: maskNode.visible,
    onFloor: maskNode.parent === slots.client && state.maskT >= 1,
    paintK: +state.maskT.toFixed(3),
  });

  return { root, slots, focus, targets, actions, fire: fireAct, state, step, setHold, setReveal, gait,
           focusWorld, targetWorld, targetHits, targetLive, headWorld, resetPantomime, flush, probes,
           setCueSink: (fn) => { cueOut.fn = fn; },
           setNoteTexture, gaitScan, gaitScanRead, figureStyle, maskState,
           movers: { holmes: holmesM, client: clientM, watson: watsonM },
           // [R7-1] the King's two marks by name, so "he is standing at the sill
           // and bound for nowhere else" is a measurement and not a claim
           marks: { kingSill: KING_SILL, kingOut: KING_OUT },
           figures: { holmes, watson, client },
           // the mask NODE and its two marks, so main.js/lap.mjs can ask the
           // graph "is he masked?" instead of "which model is loaded?"
           mask: { node: maskNode, floor: MASK_FLOOR, wornScale: MASK_WORN_S,
                   dropScale: MASK_DROP_S },
           // props the review measures BY HIDING THEM (see main.js paintProbe)
           props: { ember: fire } };
}

/* ------------------------------------------------------------------ *
 * The page ground + the diorama's inset panel.
 * Drawn as a fullscreen quad in its OWN scene with an ortho camera, so it
 * is exactly the same at every aspect ratio and never depends on the
 * diorama camera, CSS compositing, or clear-colour order.
 *
 * page-texture.png is STRETCHED (never tiled — it is not seamless) and
 * crushed dark, so it reads as aged paper seen by candle-light; the type
 * that sits on it keeps a >12:1 contrast ratio. The diorama's rectangle is
 * a darker inset panel with a hairline gold rule: a plate on a page.
 * ------------------------------------------------------------------ */
export function makeBackdrop() {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      // ROUND-1 [V1]: the inset's own night used to fall to luma 5 at the
      // corners — a hole in the middle of the leaf that was half the
      // near-black in the door framings. The plate now bottoms out at a
      // readable Prussian navy. NOTE the transfer fix below: these hexes
      // finally mean on screen what they say here.
      uInner: { value: new THREE.Color(0x293c68) },
      uMid:   { value: new THREE.Color(0x1e2a4d) },
      uOuter: { value: new THREE.Color(0x18223c) },
      // re-authored against the corrected transfer so the leaf keeps the
      // near-black candle-lit page it had. [R6-3] The cream-on-page contrast this
      // used to claim (9.6:1) was never measured and disagreed with index.html's
      // own guess (11.7:1); measured off the lap's screenshots at both ratios,
      // the live line reads 14.27–15.69:1 (tools/lap.mjs contrast probe).
      uPaper: { value: new THREE.Color(0x150f08) },
      uAspect: { value: 1 },
      uTex:   { value: null },
      uHasTex: { value: 0 },
      uRect:  { value: new THREE.Vector4(0.30, 0.05, 0.985, 0.95) },  // x0,y0,x1,y1 in UV
      // [R6-6] 0 on the closing leaf: page 2 carries no picture, so it carries no
      // lit panel and no hairline rule around one either — it is paper.
      uIns:   { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uInner, uMid, uOuter, uPaper;
      uniform float uAspect, uHasTex, uIns;
      uniform sampler2D uTex;
      uniform vec4 uRect;
      void main(){
        // ---- the page ground: stretched paper, crushed to near-black ----
        vec3 page = uPaper;
        if (uHasTex > 0.5) {
          vec3 t = texture2D(uTex, vUv).rgb;
          // crush: keep the grain, kill the luminance (type must stay AA-legible)
          page = uPaper * (0.52 + 0.92 * pow(t.r * 0.5 + t.g * 0.35 + t.b * 0.15, 1.7));
        }
        // the page darkens toward its edges like a bound leaf
        vec2 e = abs(vUv - 0.5) * 2.0;
        page *= 1.0 - 0.42 * pow(max(e.x, e.y), 3.0);

        // ---- the inset panel: the lit diorama's own night ----
        vec2 r0 = uRect.xy, r1 = uRect.zw;
        vec2 inRect = smoothstep(vec2(0.0), vec2(0.006), vUv - r0)
                    * smoothstep(vec2(0.0), vec2(0.006), r1 - vUv);
        float ins = inRect.x * inRect.y * uIns;
        vec2 q = (vUv - (r0 + r1) * 0.5) / max(vec2(1e-4), (r1 - r0));
        q.x *= uAspect * (r1.x - r0.x) / max(1e-4, (r1.y - r0.y));
        float rad = clamp(length(q) * 1.28, 0.0, 1.0);
        vec3 night = mix(uInner, uMid, smoothstep(0.0, 0.52, rad));
        night = mix(night, uOuter, smoothstep(0.46, 1.0, rad));
        night += vec3(0.004, 0.006, 0.011) * (1.0 - vUv.y);

        // hairline rule around the inset
        vec2 dr = min(vUv - r0, r1 - vUv);
        float edge = min(dr.x, dr.y);
        float rule = smoothstep(0.0045, 0.0018, abs(edge - 0.0022)) * uIns;

        vec3 c = mix(page, night, ins);
        c += vec3(0.28, 0.23, 0.14) * rule * 0.075;

        // ---- TRANSFER FIX (round-1 [V1] root cause) --------------------
        // three hands ShaderMaterial colour uniforms in the LINEAR working
        // space, and a hand-written pass gets no colorspace_fragment
        // chunk, so this shader was writing linear values straight into a
        // display-referred buffer: every colour authored here landed ~7x
        // too dark and the inset's night gradient was effectively black.
        // Encode sRGB ourselves and the hexes above mean what they read.
        vec3 lo = c * 12.92;
        vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
        gl_FragColor = vec4(mix(lo, hi, step(vec3(0.0031308), c)), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  return {
    scene, cam, mat,
    setTexture(tex) { mat.uniforms.uTex.value = tex; mat.uniforms.uHasTex.value = tex ? 1 : 0; },
    setRect(x0, y0, x1, y1) { mat.uniforms.uRect.value.set(x0, y0, x1, y1); },
    /** [R6-6] 1 = this leaf has a picture on it, 0 = it is bare paper. */
    setInset(k) { mat.uniforms.uIns.value = k; },
    resize(w, h) { mat.uniforms.uAspect.value = w / Math.max(1, h); },
    render(renderer) {
      const prev = renderer.autoClear;
      renderer.autoClear = true;
      renderer.render(scene, cam);
      renderer.autoClear = prev;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Plates — the earned close-ups. Textured quads that RISE into the inset
 * and dim (never replace) the world behind them.
 * ------------------------------------------------------------------ */
export function makePlates(urls) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const dimMat = new THREE.MeshBasicMaterial({ color: 0x02040a, transparent: true, opacity: 0,
    depthTest: false, depthWrite: false });
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat);
  dim.frustumCulled = false; dim.renderOrder = 0;
  scene.add(dim);

  const missing = [];
  const quads = {};
  const loader = new THREE.TextureLoader();
  const loads = [];

  for (const [id, url] of Object.entries(urls)) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xd9c9a6, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    // a hairline plate mount so a fallback (untextured) plate still reads
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x6a5a38, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), edgeMat);
    edge.frustumCulled = false; edge.renderOrder = 1; edge.visible = false;
    scene.add(edge);
    quads[id] = { mesh, mat, edge, edgeMat, aspect: 1.83, k: 0, url, loaded: false };
    loads.push(new Promise((res) => {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        mat.map = tex; mat.color.setHex(0xffffff); mat.needsUpdate = true;
        const img = tex.image;
        if (img && img.width) quads[id].aspect = img.width / img.height;
        quads[id].loaded = true;
        res(true);
      }, undefined, () => { missing.push(url); res(false); });
    }));
  }

  const ready = Promise.all(loads);
  let viewAspect = 1;

  return {
    scene, cam, quads, missing, ready,
    resize(w, h) { viewAspect = w / Math.max(1, h); },
    /** levels: { note, watermark, both } in 0..1; dimK dims the world behind. */
    set(levels, dimK) {
      dimMat.opacity = dimK;
      dim.visible = dimK > 0.002;
      for (const [id, q] of Object.entries(quads)) {
        const k = ease.clamp01(levels[id] || 0);
        q.k = k;
        const on = k > 0.004;
        q.mesh.visible = on; q.edge.visible = on;
        if (!on) continue;
        let h = 1.40, w = h * q.aspect / Math.max(0.0001, viewAspect);
        if (w > 1.86) { w = 1.86; h = w * viewAspect / Math.max(0.0001, q.aspect); }
        const s = 0.955 + 0.045 * k;          // it rises AND settles
        q.mesh.scale.set(w * s, h * s, 1);
        q.mesh.position.set(0, -0.30 * (1 - k), 0);
        q.mat.opacity = k;
        q.edge.scale.set(w * s + 0.028, h * s + 0.028 * viewAspect, 1);
        q.edge.position.copy(q.mesh.position);
        q.edgeMat.opacity = 0.55 * k;
      }
    },
    render(renderer) {
      const prev = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, cam);
      renderer.autoClear = prev;
    },
  };
}
