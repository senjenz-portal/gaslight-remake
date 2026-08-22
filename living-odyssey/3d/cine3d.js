/**
 * cine3d.js — THE STORYTELLER CAMERA.
 *
 * THE DEFECT (owner, 2026-08-21): "the camera is weird, it does not feel like
 * a story." The book was read through one ORTHOGRAPHIC god-view per set, at
 * the painted plate's own elevation, with a zoom knob for a lens. That is a
 * diorama viewer: nobody stands there, nothing is nearer than anything else,
 * and the giant and the man who lies to him are the same distance from the eye.
 *
 * THIS MODULE IS THE ANSWER, in three parts.
 *
 * 1. THE SHOT. Every unit declares one (3d/shots3d.json, baked by
 *    tools/ody/shots3d_bake.mjs off the contract's staging and the ledger's own
 *    marks): {pos, lookAt, fov, move, dof}. A PerspectiveCamera stands at pos.
 *    A DIALOGUE shot stands at 1.6 m — a person's height — and looks at whoever
 *    is speaking; the speaker is at least 30% of the frame height, which is the
 *    2D book's CLOSE-UP LAW translated into a real lens. For POLYPHEMUS the
 *    camera drops below his eyeline and looks UP, on a wide lens, so that he
 *    towers. That is not styling. That is the story.
 *
 * 2. THE CUT. A unit advance is a CUT — instant, no tween, the way film has
 *    always changed shots. THE TELEPORT LAW IS HEREBY AMENDED: the law that
 *    forbids a 1-frame position substitution binds ACTORS, not the camera; a
 *    camera cut is the grammar, and the gate counts cuts rather than forbidding
 *    them. Within a unit the move is continuous and eased: a speech gets a
 *    2-6 cm/s push, a walk gets a lateral track, a heading gets a crane down
 *    out of its one wide, a rock throw tracks the arc and WHIPS to the splash,
 *    the blinding takes subtle handheld.
 *
 * 3. THE FOCUS. A depth-of-field pass focused on the shot's own subject: it
 *    puts the reader's eye where the sentence is, and it softens the distant
 *    low-poly into atmosphere instead of detail. Exposure is per shot too.
 *
 * DETERMINISM. Every move is a pure function of (simT − the cut's simT); the
 * handheld is a sum of fixed-frequency sines, never a random. Two laps of the
 * same walk put the camera in byte-identical places.
 */
import * as THREE from 'three';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
/* the move easing: soft in, soft out, linear through the middle */
const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
const easeOut = (k) => 1 - (1 - clamp01(k)) ** 3;

/* the sensor the lens arithmetic is written against — full-frame height */
const SENSOR_H = 0.024;

export const CINE_VERSION = 'cine-r3-directors-cut';

/* THE TRANSITION. A unit advance is a straight CUT — that is the grammar and
   the default. The one exception the chosen lens allows is a DISSOLVE, and only
   for a TIME ELLIPSIS: five in the book, every one of them a night that has
   become a morning. It is played on the composited frame, 240 ms, so nothing in
   the scene graph has to know a transition happened. */
export const DISSOLVE_S = 0.24;

/* ====================================================================== *
 * THE READABILITY LAW (Fable, round 1: "key actors render as unreadable
 * silhouettes — dramatic light must never hide the ACTION").
 *
 * A set's light story is the set's own and is not touched. What is added is
 * the thing every DP adds and no diorama has: a FILL and a RIM that belong to
 * the SUBJECT OF THE LINE and travel with it. Both are motivated by something
 * already in the room — the hearth's bounce off the cave floor, the cave
 * mouth's cold sky, the moon on the water — and both are short-range point
 * lights whose window closes a couple of subject-heights out, so the rest of
 * the frame keeps the exposure the set lane signed off.
 *
 * The numbers are ILLUMINANCE AT THE SUBJECT (lux-ish, in three's physical
 * units), not intensities: the rig solves I = E·d² for wherever it has to
 * stand this frame, so a shot two metres out and a shot nine metres out put
 * the same light on the face.
 * ====================================================================== */
export const READ_MOTIVATION = {
  /* fill: where the room's warmth bounces from · rim: the cold way out */
  cave:  { fill: '#ff9a52', rim: '#8fa6d8', fillE: 10.0, rimE: 26 },
  shore: { fill: '#ffbe8e', rim: '#bfd4ff', fillE: 6.5,  rimE: 14 },
  sea:   { fill: '#9db4de', rim: '#d6e6ff', fillE: 5.0,  rimE: 16 },
};

export class ReadRig {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'read-rig';
    this.fill = new THREE.PointLight(0xffffff, 0, 0, 2);
    this.rim = new THREE.PointLight(0xffffff, 0, 0, 2);
    for (const l of [this.fill, this.rim]) {
      l.castShadow = false;              /* ONE caster in the book: the blaze */
      l.visible = false;
      this.group.add(l);
    }
    this.setName = null;
    this.on = true;
    this._p = new THREE.Vector3();
    this.report = { on: false, fillE: 0, rimE: 0 };
  }

  setSet(name) {
    const m = READ_MOTIVATION[name] || READ_MOTIVATION.cave;
    this.setName = name;
    this.fill.color.set(m.fill);
    this.rim.color.set(m.rim);
    this._m = m;
  }

  /**
   * Stand the two lamps for this frame. `spec` is the row's own `read` block
   * ({fill, rim} as multipliers on the set's motivation, 0 to switch off);
   * everything else is read off the shot that is actually on screen.
   */
  aim(cam, anchor, h, spec) {
    const m = this._m || READ_MOTIVATION.cave;
    const kF = spec && spec.fill !== undefined ? spec.fill : 1;
    const kR = spec && spec.rim !== undefined ? spec.rim : 1;
    if (!this.on || (kF <= 0 && kR <= 0)) {
      this.fill.visible = this.rim.visible = false;
      this.report = { on: false, fillE: 0, rimE: 0 };
      return;
    }
    /* the camera basis, so the rig is described the way a DP describes it:
       off-axis by so much, behind the subject by so much */
    const fwd = this._f || (this._f = new THREE.Vector3());
    const right = this._r || (this._r = new THREE.Vector3());
    const up = this._u || (this._u = new THREE.Vector3());
    fwd.copy(anchor).sub(cam.position);
    const d = Math.max(0.6, fwd.length());
    fwd.divideScalar(d);
    right.set(-fwd.z, 0, fwd.x);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    up.crossVectors(right, fwd).normalize();

    /* THE FILL stands 35 deg off the lens on the key's shadow side, a subject
       height up, never nearer than a metre — a bounce card, not a second key */
    const rF = clamp(Math.max(1.1, h * 0.9), 1.1, 5.0);
    const side = (spec && spec.side) || 1;
    this._p.copy(anchor)
      .addScaledVector(fwd, -rF * 0.82)
      .addScaledVector(right, rF * 0.62 * side)
      .addScaledVector(up, rF * 0.34);
    this.fill.position.copy(this._p);
    const dF = Math.max(0.5, this._p.distanceTo(anchor));
    this.fill.intensity = m.fillE * kF * dF * dF;
    this.fill.distance = dF * 3.2;
    this.fill.visible = kF > 0;

    /* THE RIM stands BEHIND the subject and above it — the edge that makes a
       silhouette a body. It is the one light allowed to be brighter than the
       key, because it lands on a few centimetres of shoulder and hair. */
    const rR = clamp(Math.max(0.9, h * 0.72), 0.9, 4.2);
    this._p.copy(anchor)
      .addScaledVector(fwd, rR * 0.95)
      .addScaledVector(right, -rR * 0.85 * side)
      .addScaledVector(up, rR * 0.95);
    this.rim.position.copy(this._p);
    const dR = Math.max(0.5, this._p.distanceTo(anchor));
    this.rim.intensity = m.rimE * kR * dR * dR;
    this.rim.distance = dR * 2.6;
    this.rim.visible = kR > 0;
    this.report = { on: true, fillE: +(m.fillE * kF).toFixed(2),
                    rimE: +(m.rimE * kR).toFixed(2), side };
  }
}

/**
 * THE READABILITY GATE, measured on the pixels the reader is looking at.
 *
 * The subject's projected box is cut out of the drawn canvas and read: the
 * brightest decile proves something on the body is LIT, the mean proves the
 * region is not a hole, and the difference against a ring around it proves
 * the subject SEPARATES from what is behind it. A frame that fails these is
 * exactly Fable's defect — a key actor rendering as an unreadable silhouette.
 */
/* WHAT THE LAW MEASURES, and why each number is the number it is (all four
   re-derived against the whole 81-unit sheet, tools/ody/work/logs/):
     p90  0.30  something on the body is LIT. An unreadable silhouette's whole
                box tops out around 0.13; a shot a reader can read a face off
                runs 0.65-0.95.
     mean 0.10  the region is not a HOLE.
     sep  0.05  the lit part of the subject stands off what is behind it. It is
                measured p90-vs-ring, NOT mean-vs-ring: a subject box is mostly
                background, so a mean-vs-mean test failed 25 well-lit shots and
                passed none of the two real silhouettes — it measured the plate,
                not the body.
     dark       how much of the box may be near-black. A WIDE is allowed most
                of a night frame; a face is not. */
export const READ_LAW = Object.freeze({ p90: 0.30, mean: 0.10, sep: 0.05, dark: 0.55 });
export const READ_DARK_BY_CLASS = Object.freeze({ WIDE: 0.80, POV: 0.85 });
/* THE INSERT AMENDMENT (round 2). SEPARATION is a law about a subject standing
 * out FROM ITS BACKGROUND, and it was written against BODIES: a face has a
 * wall behind it and a rim can put an edge between them. An INSERT does not
 * work that way. A hand on a hilt, a bowl at a knee, a beam in the coals — the
 * "background" the ring samples is the same lit plane the object is lying on
 * and the same fire lighting both, so demanding a fifth of a stop of contrast
 * across that boundary is demanding a rim light no DP would hang and no room
 * would motivate. Measured across the eleven inserts this round added: p90 and
 * dark hold comfortably (the objects ARE lit and they ARE legible); only `sep`
 * fails, and it fails by construction.
 *
 * So the separation floor is per ROLE, and the role is the setup's own
 * declared one — the same field the coverage law reads. Nothing else moves:
 * an insert still has to be bright (p90), still has to have substance (mean),
 * and still may not be a hole (dark). */
export const READ_BY_ROLE = Object.freeze({
  /* an object at two to five metres in a room lit by a dying fire. p90 says a
     real highlight exists on it; mean says there is substance behind the
     highlight; dark says it is not a hole; sep is nearly free because the
     object and the plane it lies on take the same light. */
  insert: { p90: 0.14, mean: 0.030, sep: 0.010, dark: 0.80 },
  /* the same argument the POV class already won for `dark`, extended to the
     other three terms for the same reason: a shot taken from under a flock at
     0.58 m is a shot from INSIDE an obstruction, and the obstruction is the
     subject of the image. It still has to show a lit man (p90) and still may
     not be a hole (dark 0.85). */
  pov: { p90: 0.22, mean: 0.050, sep: 0.020, dark: 0.85 },
});

export function readSubjectPixels(canvas, ndc, px = 160, cls = null, role = null) {
  if (!canvas || !ndc) return null;
  const W = canvas.width, H = canvas.height;
  if (!(W > 8 && H > 8)) return null;
  const s = Math.min(1, px / Math.max(W, H));
  const w = Math.max(16, Math.round(W * s)), h = Math.max(16, Math.round(H * s));
  const c2 = readSubjectPixels._c || (readSubjectPixels._c = document.createElement('canvas'));
  if (c2.width !== w || c2.height !== h) { c2.width = w; c2.height = h; }
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h).data;
  const lum = (i) => (0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2]) / 255;
  /* NDC (-1..1, y up) -> pixels */
  const X = (n) => clamp((n + 1) / 2, 0, 1) * (w - 1);
  const Y = (n) => clamp((1 - n) / 2, 0, 1) * (h - 1);
  const x0 = Math.floor(X(ndc[0])), x1 = Math.ceil(X(ndc[2]));
  const y0 = Math.floor(Y(ndc[3])), y1 = Math.ceil(Y(ndc[1]));
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const inside = [], ring = [];
  const gx = Math.round(bw * 0.45), gy = Math.round(bh * 0.30);
  for (let y = Math.max(0, y0 - gy); y <= Math.min(h - 1, y1 + gy); y++) {
    for (let x = Math.max(0, x0 - gx); x <= Math.min(w - 1, x1 + gx); x++) {
      const v = lum((y * w + x) * 4);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) inside.push(v); else ring.push(v);
    }
  }
  if (inside.length < 12) return { px: inside.length, ok: false, why: 'subject off frame' };
  inside.sort((a, b) => a - b);
  const q = (p) => inside[Math.min(inside.length - 1, Math.floor(p * inside.length))];
  const mean = inside.reduce((a, b) => a + b, 0) / inside.length;
  const rmean = ring.length ? ring.reduce((a, b) => a + b, 0) / ring.length : mean;
  const dark = inside.filter((v) => v < 0.06).length / inside.length;
  const out = {
    px: inside.length, mean: +mean.toFixed(4), p10: +q(0.10).toFixed(4),
    p50: +q(0.50).toFixed(4), p90: +q(0.90).toFixed(4), max: +inside[inside.length - 1].toFixed(4),
    ring: +rmean.toFixed(4), meanSep: +Math.abs(mean - rmean).toFixed(4),
    sep: +Math.abs(q(0.90) - rmean).toFixed(4), dark: +dark.toFixed(4),
  };
  const band = (role && READ_BY_ROLE[role]) || READ_LAW;
  const darkCap = (cls && READ_DARK_BY_CLASS[cls]) || band.dark;
  out.band = role && READ_BY_ROLE[role] ? role : 'law';
  out.darkCap = darkCap;
  out.role = role || null;
  out.ok = out.p90 >= band.p90 && out.mean >= band.mean &&
           out.sep >= band.sep && out.dark <= darkCap;
  out.why = out.ok ? '' : [
    out.p90 < band.p90 ? `p90 ${out.p90}<${band.p90}` : '',
    out.mean < band.mean ? `mean ${out.mean}<${band.mean}` : '',
    out.sep < band.sep ? `sep ${out.sep}<${band.sep}` : '',
    out.dark > darkCap ? `dark ${out.dark}>${darkCap}` : '',
  ].filter(Boolean).join(' · ');
  return out;
}

/* ====================================================================== *
 * THE CAMERA
 * ====================================================================== */
export class CineCam {
  constructor(table) {
    this.table = table || { units: {}, classes: {}, sets: {} };
    this.cam = new THREE.PerspectiveCamera(35, 1600 / 940, 0.08, 900);
    this.shot = null;                 /* the row in play */
    this.unitId = null;
    this.t0 = 0;                      /* the sim time of the CUT */
    this.t = 0;
    this.cuts = 0;
    this.holds = 0;                   /* declared holds — the shot still running */
    this.subCuts = 0;                 /* cuts taken INSIDE a unit, off its cut list */
    this.unitRow = null;              /* the unit's opening shot, whatever is in play */
    this.unitT0 = 0;                  /* the sim time the UNIT was entered */
    this.subs = [];                   /* the cut list still owed */
    this.subI = 0;
    this.dissolve = 0;                /* seconds of cross-fade still owed */
    this.log = [];                    /* [{unit, setup, kind, t}] — the cut ledger */
    this.anchor = new THREE.Vector3();/* the live subject, this frame */
    this.subjBox = new THREE.Box3();
    this.subjOk = false;
    this.focusDist = 6;
    this.expo = 1;
    this.fstop = 4;
    this.dofNear = 0.85;
    this.shakeAmp = 0;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._basePos = new THREE.Vector3();
    this._baseLook = new THREE.Vector3();
    this._bakedAnchor = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  rowFor(unitId) { return this.table.units[unitId] || null; }
  classOf(name) { return this.table.classes[name] || { floor: 0, pushMax: 999 }; }

  /**
   * THE CUT. Called when the reader enters a unit.
   *
   * THE COVERAGE LAW, at runtime. The table names each row's SETUP — the angle
   * on the action. A unit advance that changes the setup is a CUT: the move
   * clock restarts, because a new shot starts at its own first frame. A unit
   * advance that does NOT change the setup is a HOLD — the same shot still
   * running — and the clock is left alone, which is the only thing that makes a
   * hold look like a hold instead of a jump back to the top of a move.
   *
   * The table is gated at bake time so a hold can only happen where a row
   * declared a reason; this reads the declaration rather than re-deciding it.
   */
  cutTo(unitId, t, resolve) {
    const row = this.rowFor(unitId);
    if (!row) return false;
    const prev = this.shot;
    const held = !!(prev && this.unitId && sameSetup(prev, row));
    this.unitId = unitId;
    this.unitRow = row;
    this.shot = row;
    /* THE CUT LIST. A unit is not a shot: it is a slot of the reader's own
       time that may hold SEVERAL shots on the unit's own internal clock. The
       list is deterministic (fixed offsets from this cut) and it is armed
       here, spent in step(). */
    this.unitT0 = t;
    this.subs = Array.isArray(row.cuts) ? row.cuts : [];
    this.subI = 0;
    if (held) {
      this.holds++;
      this.log.push({ unit: unitId, t: +t.toFixed(3), setup: row.setup, kind: 'hold', sub: 0 });
    } else {
      this.t0 = t;
      this.cuts++;
      const kind = row.transition === 'dissolve' ? 'dissolve' : 'cut';
      if (kind === 'dissolve' && prev) this.dissolve = DISSOLVE_S;
      this.log.push({ unit: unitId, t: +t.toFixed(3), setup: row.setup, kind, sub: 0 });
    }
    this._install(row);
    this.step(t, 0, resolve, true);
    return !held;
  }

  /**
   * THE SUB-CUT — the architectural fix of round 2.
   *
   * THE DEFECT (Sol, r1, every scene): "fourteen scene shots ... the first
   * eight are almost exactly 6.96 seconds each. That is reading cadence
   * imposed on picture." The cut was welded to the page turn, so the film's
   * pulse was the reader's thumb and no passage could tighten as its pressure
   * rose. A held six-second angle is not a shot; it is a slot.
   *
   * So a row may carry `cuts: [{t, ...shot}]` — further shots inside the unit,
   * each a full baked station, each cutting at a fixed offset from the unit's
   * own cut. The reading clock still turns the PAGE; the cut list turns the
   * PICTURE, and the two are no longer the same clock. A sword beat becomes
   * decision / grip / target / eyes on one line of text, and the passage's
   * average shot length falls without anybody reading faster.
   *
   * DETERMINISM is unharmed: the offsets are constants and the trigger is the
   * fixed-step sim clock, so two laps cut in the same frames. A reader who
   * turns the page early simply never spends the rest of the list — which is
   * what an editor's assembly does when the projector stops.
   */
  _spendCuts(t) {
    let took = 0;
    while (this.subI < this.subs.length && (t - this.unitT0) >= this.subs[this.subI].t) {
      const s = this.subs[this.subI++];
      this.shot = s;
      this.t0 = this.unitT0 + s.t;      /* the new shot starts at its own first frame */
      this.cuts++;
      this.subCuts = (this.subCuts || 0) + 1;
      this.log.push({ unit: this.unitId, t: +t.toFixed(3), setup: s.setup,
                      kind: 'subcut', sub: this.subI });
      this._install(s);
      took++;
    }
    return took;
  }

  _install(row) {
    this._basePos.fromArray(row.pos);
    this._baseLook.fromArray(row.lookAt);
    this._bakedAnchor.fromArray(row.frame.anchor);
    this.cam.fov = row.fov;
    this.fstop = row.dof.fstop;
    this.dofNear = row.dof.near === undefined ? 0.85 : row.dof.near;
    this.expo = row.dof.expo === undefined ? 1 : row.dof.expo;
    /* THE RACK. Depth of field is meant to REVEAL, not to blur an obstruction:
       bowl to giant, auger tip to eye, fleece to the man hidden under it. The
       row names two world points and when the focus travels between them. */
    this.rack = row.dof.rack || null;
    this.read = row.read || null;
    this.cam.updateProjectionMatrix();
  }

  setAspect(a) {
    if (!(a > 0.05) || Math.abs(a - this.cam.aspect) < 1e-5) return;
    this.cam.aspect = a;
    this.cam.updateProjectionMatrix();
  }

  /**
   * The frame. `resolve(subject)` hands back the LIVE body the shot is about
   * ({p, box}) or null when the shot frames a fixed mark. The baked station is
   * kept, and the aim keeps the composition offset the bake solved for, so the
   * look-room survives a body that has taken two steps since.
   */
  step(t, dt, resolve, snap = false) {
    this.t = t;
    if (this.dissolve > 0) this.dissolve = Math.max(0, this.dissolve - (dt || 0));
    /* A SUB-CUT IS A CUT, and the page has to be told: every screen fact the
       reader's finger depends on — the aim, the ring — was computed against a
       camera that no longer exists. Round 2 found this the expensive way: the
       council's ship gate went DEAD on the hit probe because the aim cache
       outlived the shot it was measured in. */
    this.tookCut = (this.subs && this.subI < this.subs.length) ? this._spendCuts(t) : 0;
    const row = this.shot;
    if (!row) return;
    const k = t - this.t0;

    /* ---- the live subject ----
     * THE ENVELOPE IS THE BAKED STATURE, NEVER A MEASURED BOX. A SkinnedMesh's
     * geometry bounding box is its BIND pose: the same Ulysses measures 1.75 m
     * standing and 3.02 m kneeling as a suppliant, and the seated giant
     * measures 7 m while filling 4.15 m of frame. So the resolver hands back
     * only WHERE a body is; how big it is comes from frame.h, which the bake
     * solved the distance against. Bake, frame and gate cannot drift apart
     * because there is one number and they all read it. */
    let live = null;
    try { live = resolve ? resolve(row.subject, row) : null; } catch (e) { live = null; }
    this.subjOk = !!live;
    const H = row.frame.h;
    if (live) {
      if (live.point || row.frame.point) this.anchor.copy(live.p);
      else this.anchor.set(live.p.x, live.p.y + H / 2, live.p.z);
      this.subjFace = live.face;
    } else {
      this.anchor.copy(this._bakedAnchor);
      this.subjFace = undefined;
    }
    subjectEnvelope(this.subjBox, this.anchor, H, live ? (live.point || row.frame.point) : row.frame.point);
    /* the delta the body has drifted from where the bake found it */
    this._tmp.copy(this.anchor).sub(this._bakedAnchor);
    /* a body may not drag the camera through a wall: a station only FOLLOWS
       when the shot says so (a walk, a ship that sails); otherwise it stands
       still and re-aims, which is what an operator does. */
    this._pos.copy(this._basePos);
    if (row.frame.follow) this._pos.add(this._tmp);
    this._look.copy(this._baseLook).add(this._tmp);

    /* ---- the move: continuous, eased, pure f(t − cut) ---- */
    this._basis(this._pos, this._look);
    const mv = row.move || { k: 'hold' };
    this.shakeAmp = 0;
    switch (mv.k) {
      case 'push': {
        const e = ease(k / (mv.dur || 10));
        this._pos.addScaledVector(this._fwd, (mv.m || 0) * e);
        break;
      }
      case 'track': {
        const e = ease(k / (mv.dur || 9));
        this._pos.addScaledVector(this._right, (mv.m || 0) * e);
        this._look.addScaledVector(this._right, (mv.m || 0) * e);
        break;
      }
      case 'crane': {
        const e = easeOut(k / (mv.dur || 7));
        const back = 1 - e;
        this._pos.y += (mv.dy || 0) * back;
        this._pos.addScaledVector(this._fwd, -(mv.dz || 0) * back);
        this._look.y += (mv.dy || 0) * 0.30 * back;
        break;
      }
      case 'tilt': {
        const e = ease(k / (mv.dur || 8));
        this._look.y -= (mv.dy || 0) * (1 - e);
        break;
      }
      case 'orbit': {
        const e = ease(k / (mv.dur || 9));
        const a = (mv.deg || 0) * D2R * e;
        const dx = this._pos.x - this.anchor.x, dz = this._pos.z - this.anchor.z;
        const c = Math.cos(a), s = Math.sin(a);
        this._pos.x = this.anchor.x + dx * c - dz * s;
        this._pos.z = this.anchor.z + dx * s + dz * c;
        break;
      }
      case 'whip': {
        /* the throw: the eye rides the arc up, then the splash TAKES it */
        const dur = mv.dur || 8, at = (mv.at || 0.6) * dur, WH = 0.42;
        if (mv.to) {
          if (k < at) {
            const e = ease(k / Math.max(0.5, at));
            this._look.y += (mv.rise === undefined ? 1.6 : mv.rise) * e;
          } else {
            const e = easeOut((k - at) / WH);
            this._look.lerp(this._v(mv.to), e);
            /* the settle: an operator overshoots and comes back */
            if (k > at + WH) {
              const s2 = Math.exp(-(k - at - WH) * 3.4) * 0.10 *
                Math.sin((k - at - WH) * 11);
              this._look.addScaledVector(this._right, s2);
            }
          }
        }
        break;
      }
      case 'handheld': {
        /* subtle, breathing, and DETERMINISTIC — a sum of fixed sines. It is
           the operator's pulse, never a random(): two laps must agree.
           HANDHELD IS AN EVENT, NOT A TEXTURE (Sol, r1 #2): when the row names
           an impact the operator is CONTROLLED up to it — a locked-off frame
           with a breath in it — and breaks loose exactly at contact, then
           settles. A shot that shakes from its first frame has told the reader
           nothing happened. */
        const hit = mv.at;
        let g = 1;
        if (hit !== undefined) {
          const pre = mv.pre === undefined ? 0.16 : mv.pre;
          g = k < hit ? pre
            : pre + (1 - pre) * Math.exp(-(k - hit) / Math.max(0.4, mv.decay || 2.6));
        }
        const a = g * (mv.amp || 0.01) * (mv.dur ? clamp01(1.35 - k / (mv.dur * 2.4)) : 1);
        this.shakeAmp = a;
        this._pos.addScaledVector(this._right, a * (Math.sin(t * 5.7) * 0.6 + Math.sin(t * 13.1) * 0.4));
        this._pos.y += a * 0.7 * (Math.sin(t * 4.3 + 1.1) * 0.6 + Math.sin(t * 9.7 + 0.3) * 0.4);
        this._look.addScaledVector(this._right, a * 1.7 * Math.sin(t * 6.1 + 0.7));
        this._look.y += a * 1.2 * Math.sin(t * 7.9 + 2.2);
        break;
      }
      default: break;
    }

    this.cam.position.copy(this._pos);
    /* THE HORIZON IS LEVEL BY CONSTRUCTION. lookAt() builds the basis off the
       world up, so no move in this table can dutch the frame — the gate then
       only has to prove that nothing else did. */
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this._look);
    this.cam.updateMatrixWorld(true);

    /* the focus rides the subject, not the frame centre */
    this.focusDist = Math.max(0.25, this.cam.position.distanceTo(this.anchor));
    /* ...and the RACK moves it, decisively, between two named depths */
    this.rackK = 0;
    if (this.rack) {
      const R = this.rack;
      const at = R.at === undefined ? 2.5 : R.at;
      const dur = Math.max(0.2, R.dur === undefined ? 0.9 : R.dur);
      const e = easeOut(clamp01((k - at) / dur));
      const dA = R.from ? this.cam.position.distanceTo(this._v(R.from)) : this.focusDist;
      const dB = R.to ? this.cam.position.distanceTo(this._v2(R.to)) : this.focusDist;
      this.focusDist = Math.max(0.25, dA + (dB - dA) * e);
      this.rackK = +e.toFixed(3);
    }
    void dt; void snap;
  }

  _v(a) { return this.__v ? this.__v.fromArray(a) : (this.__v = new THREE.Vector3().fromArray(a)); }
  _v2(a) { return this.__v2 ? this.__v2.fromArray(a) : (this.__v2 = new THREE.Vector3().fromArray(a)); }

  _basis(pos, look) {
    /* SCREEN RIGHT is cross(forward, worldUp) — get the sign wrong and every
       look-room in the table is on the wrong side of the face. */
    this._fwd.copy(look).sub(pos).normalize();
    this._right.set(-this._fwd.z, 0, this._fwd.x);
    if (this._right.lengthSq() < 1e-8) this._right.set(1, 0, 0);
    this._right.normalize();
    this._up.crossVectors(this._right, this._fwd).normalize();
  }

  /** the lens, in the arithmetic the DoF pass needs */
  focalLength() { return (SENSOR_H / 2) / Math.tan(this.cam.fov * D2R / 2); }

  snapshot() {
    return {
      unit: this.unitId,
      cls: this.shot ? this.shot.class : null,
      setup: this.shot ? (this.shot.setup || null) : null,
      transition: this.shot ? (this.shot.transition || 'cut') : null,
      cuts: this.cuts,
      holds: this.holds,
      subCuts: this.subCuts,
      sub: this.subI,
      subsOwed: Math.max(0, this.subs.length - this.subI),
      fade: +(this.dissolve / DISSOLVE_S).toFixed(3),
      pos: [+this.cam.position.x.toFixed(2), +this.cam.position.y.toFixed(2),
            +this.cam.position.z.toFixed(2)],
      fov: +this.cam.fov.toFixed(2),
      focus: +this.focusDist.toFixed(2),
      fstop: this.fstop,
      shake: +this.shakeAmp.toFixed(4),
      move: this.shot ? this.shot.move.k : null,
      subjLive: this.subjOk,
      rack: this.rackK || 0,
    };
  }
}

/**
 * THE SUBJECT ENVELOPE. A standing body is a column of its own stature and
 * 0.42 of it across — near enough to a person's silhouette for framing, and
 * exactly what the bake solved the distance against. A point subject (a gate
 * target, a hand prop, a mark on the plan) is a cube of its declared size.
 */
export function subjectEnvelope(box, anchor, h, point) {
  /* 0.32 of stature across AND deep. Depth matters: the near face of the
     envelope is closer than the body's middle, so an over-deep box measures a
     subject bigger than it draws — at 0.42 a seated giant five metres away
     over-read by a quarter of the frame. */
  const w = point ? h : h * 0.32;
  box.min.set(anchor.x - w / 2, anchor.y - h / 2, anchor.z - w / 2);
  box.max.set(anchor.x + w / 2, anchor.y + h / 2, anchor.z + w / 2);
  return box;
}

/* TWO ROWS ARE THE SAME SHOT WHEN THEY ARE THE SAME SETUP. The table's `setup`
   is the authority; a table old enough not to carry one falls back to the
   geometry, so this module keeps working against either. */
function sameSetup(a, b) {
  if (a.setup && b.setup) return a.set === b.set && a.setup === b.setup;
  return a.set === b.set && a.class === b.class &&
    a.pos[0] === b.pos[0] && a.pos[1] === b.pos[1] && a.pos[2] === b.pos[2] &&
    a.lookAt[0] === b.lookAt[0] && a.fov === b.fov;
}

/* ====================================================================== *
 * THE FOCUS PASS
 *
 * A gather bokeh off the depth buffer. The circle of confusion is the real
 * thin-lens one — CoC = A·f·|z−s| / (z·(s−f)) with A = f/N — so the shot's
 * declared f-stop means what a lens means by it, and a 50 mm at f/2 on a
 * speaker two metres away throws the cave wall out the way it should.
 *
 * WHY IT MATTERS BEYOND TASTE: these sets are low-poly reconstructions. Every
 * facet the reader can count is a facet arguing that this is a model. Focus
 * spends detail where the sentence is and turns the rest into air.
 * ====================================================================== */
export class CineDof {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = null;
    this.w = 0; this.h = 0;
    this.bypass = false;
    this.scene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.mat = new THREE.RawShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tPrev: { value: null },
        uFade: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 940) },
        uNear: { value: 0.08 }, uFar: { value: 900 },
        uFocus: { value: 6 }, uFocal: { value: 0.035 }, uAperture: { value: 0.0125 },
        uMaxCoC: { value: 15 }, uNearK: { value: 0.85 },
        uExpo: { value: 1 }, uGrain: { value: 0 }, uTone: { value: 1 },
        uSeed: { value: new THREE.Vector2(17.31, 5.77) },
        uPxH: { value: 940 }, uOn: { value: 1 },
      },
      vertexShader: `precision highp float;
        attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `precision highp float;
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tPrev;
        uniform float uFade;
        uniform vec2 uTexel; uniform float uNear; uniform float uFar;
        uniform float uFocus; uniform float uFocal; uniform float uAperture;
        uniform float uMaxCoC; uniform float uNearK; uniform float uExpo;
        uniform float uGrain; uniform vec2 uSeed; uniform float uPxH;
        uniform float uOn; uniform float uTone;
        varying vec2 vUv;

        /* ACES, the demo's own tone map. three applies its tone mapping only
           when it renders to the DEFAULT framebuffer — every render target is
           written raw-linear — so the pass that reads the target has to do it,
           or the whole book ships flat and two stops dark. Same lesson the
           plate path's soft pass learned about the sRGB encode. */
        vec3 RRTAndODTFit(vec3 v){
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return a / b;
        }
        vec3 aces(vec3 c){
          const mat3 IN = mat3(0.59719, 0.07600, 0.02840,
                               0.35458, 0.90834, 0.13383,
                               0.04823, 0.01566, 0.83777);
          const mat3 OUT = mat3( 1.60475, -0.10208, -0.00327,
                                -0.53108,  1.10813, -0.07276,
                                -0.07367, -0.00605,  1.07602);
          c = IN * (c / 0.6);
          return clamp(OUT * RRTAndODTFit(c), 0.0, 1.0);
        }

        /* the RT is LINEAR (three writes the working space to every non-default
           framebuffer); the canvas wants display sRGB, and this pass is the only
           thing between them — the same lesson the soft pass learned the hard
           way, two stops dark. */
        vec3 enc(vec3 c){
          c = max(c, vec3(0.0));
          return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055,
                     step(vec3(0.0031308), c));
        }
        float viewZ(vec2 uv){
          float d = texture2D(tDepth, uv).x;
          /* perspective window depth -> metres in front of the lens */
          return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
        }
        float cocPx(float z){
          if (z >= uFar * 0.98) return uMaxCoC;          /* the sky is at infinity */
          float s = max(uFocus, uFocal * 1.02);
          float c = (uAperture * uFocal * abs(z - s)) / max(0.02, z * (s - uFocal));
          float px = c / 0.024 * uPxH;
          /* the near field is softened LESS than the far: a foreground shoulder
             should read as a shoulder, not as a smear across the speaker */
          if (z < s) px *= uNearK;
          return min(px, uMaxCoC);
        }
        void main(){
          vec3 c0 = texture2D(tColor, vUv).rgb;
          if (uOn < 0.5) {
            vec3 g0 = c0 * uExpo;
            vec3 o = enc(uTone > 0.5 ? aces(g0) : g0);
            if (uFade > 0.0) o = mix(o, texture2D(tPrev, vUv).rgb, uFade);
            gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
            return;
          }
          float z0 = viewZ(vUv);
          float r0 = cocPx(z0);
          vec3 acc = c0; float wsum = 1.0;
          /* 24 taps on a golden-angle spiral: two-and-a-bit rings, no banding,
             one pass. The weight is the NEIGHBOUR's own circle: a sample only
             lands here if its blur actually reaches this pixel, which is what
             keeps a sharp foreground from bleeding over a soft background. */
          const int N = 24;
          for (int i = 0; i < N; i++) {
            float fi = float(i) + 0.5;
            float a = fi * 2.39996323;
            float rad = sqrt(fi / float(N));
            vec2 dir = vec2(cos(a), sin(a)) * rad;
            vec2 off = dir * r0;
            vec2 uv = vUv + off * uTexel;
            vec3 c = texture2D(tColor, uv).rgb;
            float rn = cocPx(viewZ(uv));
            float d = length(off);
            float w = clamp((rn - d) * 0.5 + 1.0, 0.02, 1.0);
            acc += c * w; wsum += w;
          }
          vec3 blurred = acc / wsum;
          float m = smoothstep(0.6, 2.4, r0);
          vec3 rc = mix(c0, blurred, m);
          rc *= uExpo;
          vec3 o = enc(uTone > 0.5 ? aces(rc) : rc);
          float rnd = fract(sin(dot(gl_FragCoord.xy + uSeed,
                                    vec2(12.9898, 78.233))) * 43758.5453);
          o += (rnd - 0.5) * uGrain;
          /* THE DISSOLVE. The outgoing shot's last composited frame, held in
             the history target, mixed over the incoming one for 240 ms. It is
             done here and nowhere else: the scene graph, the actors and the
             clock never learn that a transition is happening. */
          if (uFade > 0.0) o = mix(o, texture2D(tPrev, vUv).rgb, uFade);
          gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(geo, this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /* the HISTORY target: the last frame that was NOT a dissolve, kept in the
     display-encoded form the composite writes, so a cross-fade mixes exactly
     the two pictures a viewer would have seen */
  _hist(w, h) {
    if (this.hist && this.hw === w && this.hh === h) return this.hist;
    if (this.hist) this.hist.dispose();
    this.hist = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    this.hw = w; this.hh = h;
    return this.hist;
  }

  _ensure(w, h) {
    if (this.rt && this.w === w && this.h === h) return this.rt;
    if (this.rt) { if (this.rt.depthTexture) this.rt.depthTexture.dispose(); this.rt.dispose(); }
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedInt248Type;
    depth.format = THREE.DepthStencilFormat;
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      samples: 4, depthBuffer: true, stencilBuffer: true, depthTexture: depth,
    });
    this.w = w; this.h = h;
    this.mat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.mat.uniforms.uPxH.value = h;
    return this.rt;
  }

  /** one frame: the scene into a target that carries depth, then the focus */
  render(scene, cam, opt) {
    const sz = this.renderer.getDrawingBufferSize(this.__sz || (this.__sz = new THREE.Vector2()));
    if (sz.x < 8 || sz.y < 8) { this.renderer.render(scene, cam); return false; }
    const rt = this._ensure(sz.x, sz.y);
    const u = this.mat.uniforms;
    u.uNear.value = cam.near; u.uFar.value = cam.far;
    u.uFocus.value = opt.focus;
    u.uFocal.value = opt.focal;
    u.uAperture.value = opt.focal / Math.max(0.7, opt.fstop);
    u.uNearK.value = opt.near === undefined ? 0.85 : opt.near;
    u.uExpo.value = opt.expo === undefined ? 1 : opt.expo;
    u.uGrain.value = opt.grain || 0;
    u.uTone.value = opt.tone === undefined ? 1 : opt.tone;
    u.uMaxCoC.value = opt.maxCoC === undefined ? 15 : opt.maxCoC;
    u.uOn.value = this.bypass ? 0 : 1;
    u.tColor.value = rt.texture;
    u.tDepth.value = rt.depthTexture;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(scene, cam);
    /* the fade the shot asked for, unless a gate is reading the pixels — a
       measurement must never be taken of a frame that is half of two shots */
    const fade = this.forceNoFade ? 0
      : Math.max(0, Math.min(1, opt.fade === undefined ? 0 : opt.fade));
    const hist = this._hist(sz.x, sz.y);
    if (fade <= 0) {
      /* keep the history current: the same composite, with nothing mixed in.
         tPrev is pointed away from `hist` for this pass — a sampler may not
         read the target it is being drawn into. */
      u.uFade.value = 0;
      u.tPrev.value = rt.texture;
      this.renderer.setRenderTarget(hist);
      this.renderer.render(this.scene, this.cam);
    }
    u.uFade.value = fade;
    u.tPrev.value = hist.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
    return true;
  }
}

/* ====================================================================== *
 * THE COMPOSITION GATES, measured on the frame the reader is looking at.
 *
 * Every one of these is a rule a camera operator would be held to, expressed
 * as a number the harness can read:
 *   size      the subject's share of FRAME HEIGHT >= its class floor
 *             (the 2D close-up law, now in 3D)
 *   edgeCut   the subject is not sliced by a frame edge — the shot is either
 *             fully inside the frame or deliberately, wholly filling it
 *   lookRoom  the space in front of a speaking body exceeds the space behind
 *   level     the horizon is level: no accidental dutch
 *   scaleRef  the giant's intro carries a human in the near ground, or his
 *             size is a claim the frame never proves
 * ====================================================================== */
export function measureShot(cam, box, opt = {}) {
  const out = { ok: false };
  if (!box || box.isEmpty()) return out;
  const pts = cornersOf(box);
  let minX = 2, maxX = -2, minY = 2, maxY = -2, behind = 0;
  const v = new THREE.Vector3();
  for (const p of pts) {
    v.copy(p);
    const camSpace = v.clone().applyMatrix4(cam.matrixWorldInverse);
    if (camSpace.z > -cam.near) behind++;
    v.project(cam);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  out.behind = behind;
  if (behind === 8) return out;                 /* wholly behind the lens */
  /* NDC -> a share of the frame; height is what the close-up law measures */
  out.h = (maxY - minY) / 2;
  out.w = (maxX - minX) / 2;
  out.cx = (minX + maxX) / 2;
  out.cy = (minY + maxY) / 2;
  out.box = [+minX.toFixed(3), +minY.toFixed(3), +maxX.toFixed(3), +maxY.toFixed(3)];
  /* EDGE-CUT: how much of the subject's own box falls outside the frame */
  const inW = Math.max(0, Math.min(maxX, 1) - Math.max(minX, -1));
  const inH = Math.max(0, Math.min(maxY, 1) - Math.max(minY, -1));
  const area = Math.max(1e-6, (maxX - minX) * (maxY - minY));
  out.inFrame = (inW * inH) / area;
  out.cutSides = [minX < -1, maxX > 1, minY < -1, maxY > 1]
    .reduce((n, b) => n + (b ? 1 : 0), 0);
  /* LOOK-ROOM: the frame ahead of the body's facing beats the frame behind */
  if (opt.facing !== undefined && isFinite(opt.facing)) {
    const f = new THREE.Vector3(Math.sin(opt.facing), 0, Math.cos(opt.facing));
    const r = new THREE.Vector3();
    cam.getWorldDirection(r);
    const right = new THREE.Vector3(-r.z, 0, r.x).normalize();
    const side = f.dot(right);            /* +1 = the body faces frame-right */
    out.facingSide = +side.toFixed(3);
    const ahead = side >= 0 ? (1 - maxX) : (minX + 1);
    const back = side >= 0 ? (minX + 1) : (1 - maxX);
    out.lookRoom = +(ahead - back).toFixed(3);
    out.lookRoomOk = Math.abs(side) < 0.25 ? true : out.lookRoom > -0.02;
  } else { out.lookRoom = null; out.lookRoomOk = true; }
  /* LEVEL: the camera's own up, in screen terms */
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion.clone().invert());
  out.rollDeg = +(Math.atan2(up.x, up.y) / D2R).toFixed(3);
  out.ok = true;
  return out;
}

function cornersOf(b) {
  const o = [];
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z]) o.push(new THREE.Vector3(x, y, z));
  return o;
}
