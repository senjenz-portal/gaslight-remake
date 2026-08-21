/**
 * stage3d.js — THE STAGE SKELETON.
 *
 * One canvas, one renderer (render3d — the demo's pipeline), one world
 * (world.js — the scale authority), and three signed-off SETS mounted
 * UNTOUCHED:
 *
 *   cave   demo3d/full3d/createCaveScene.js   — the demo's own cave, as-is
 *   shore  3d/sets/shore3d.js                 — bar-passed geometry
 *   sea    3d/sets/sea3d.js                   — bar-passed geometry
 *
 * A set is a black box with a known shape: { root, tick(simT), parts,
 * triangles, setPixelScale } plus its own isometric camera. The stage never
 * reaches inside one to change a light, a material or a transform. The only
 * thing it applies is the SHADOW POLICY, and only to the caster the set
 * itself declares — with the set's own reach, so the signed-off render is
 * bit-for-bit what the set lane shipped.
 *
 * Everything the stage ADDS — cast, props — goes through the scale authority.
 * Nothing is placed by eye: marks are the ledger's plate pixels run through
 * world.js, or the set's own declared sockets.
 *
 * DETERMINISM: sim-time only. step(dt) advances it, setSim(t) sets it
 * absolutely, and every tick (set particles, fire flicker, mixers) is a pure
 * function of that number.
 */
import * as THREE from 'three';
import { createRenderer, resizeToCanvas, configureShadowCaster, describeRenderer,
         RENDER_CONFIG, SHADOW_LAW } from './render3d.js';
import { world, FRAMES, measure, SIZE_TABLE } from './world.js';
import { buildActor } from './actor3d.js';
import { createCaveScene, createCaveIsoCamera } from '../../demo3d/full3d/createCaveScene.js';
import { createShoreScene, createShoreIsoCamera } from '../sets/shore3d.js';
import { createSeaScene, createSeaIsoCamera } from '../sets/sea3d.js';
import { createGreatBowl, createStake, createWineskin } from '../../demo3d/polyphemus/poly-props.js';

/* ---------------- the three sets ---------------- */
const SETS = {
  cave: {
    build: createCaveScene, camera: createCaveIsoCamera,
    caster: (api) => api.fireLight, casterFar: 40,   /* the demo's own reach */
  },
  shore: {
    build: createShoreScene, camera: createShoreIsoCamera,
    caster: (api) => api.fireLight, casterFar: 60,   /* the beach's own reach */
  },
  sea: {
    build: createSeaScene, camera: createSeaIsoCamera,
    caster: () => null,                              /* moonlit: no caster shipped */
  },
};

/* ---------------- the foundation's staging (ledger marks, plate px) ----------
 * A boot staging, not the story's: enough of the cast on each set to prove the
 * mount, the render and the scale gate. The story lane replaces this table
 * with the units' own marks.                                                  */
const STAGING = {
  shore: {
    cast: [
      { id: 'ulysses',  rig: 'ulysses', px: [390, 480], yaw: 0.4 },
      { id: 'crew-1',   rig: 'crew',    px: [472, 507], yaw: -0.8 },
      { id: 'crew-2',   rig: 'crew',    px: [560, 503], yaw: 2.1 },
    ],
    props: [],
  },
  cave: {
    cast: [
      { id: 'ulysses',    rig: 'ulysses',    px: [648, 537], yaw: 2.55 },
      { id: 'crew-1',     rig: 'crew',       px: [933, 541], yaw: -1.9 },
      { id: 'crew-2',     rig: 'crew',       px: [900, 551], yaw: -2.3 },
      /* the ledger's giant-seat mark is a SEATED mark — the vault is 5.4 m */
      { id: 'polyphemus', rig: 'polyphemus-seat', px: [774, 458], yaw: -1.55, pose: 'seated' },
      { id: 'ram-great',  rig: 'ram-great',  px: [430, 530], yaw: 1.4 },
      { id: 'ewe-1',      rig: 'ewe',        px: [370, 520], yaw: 1.1 },
    ],
    props: [
      /* the stake LIES on the firewood (its local +Y is its length — tip it
         onto the floor plane instead of standing a beam on end) */
      { id: 'stake',    make: createStake,     kind: 'stake',    px: [560, 530],
        y: 0.14, rot: [Math.PI / 2, 0.35, 0] },
      { id: 'bowl',     make: createGreatBowl, kind: 'bowl',     px: [800, 489], rot: [0, 0, 0] },
      { id: 'wineskin', make: createWineskin,  kind: 'wineskin', px: [333, 487], rot: [0, 0.5, 0] },
    ],
  },
  sea: {
    cast: [
      { id: 'ulysses',    rig: 'ulysses',         socket: 'root:deck-mount', yaw: 2.6 },
      { id: 'crew-1',     rig: 'crew',            socket: 'root:deck-mount', offset: [-1.8, 0, 1.1], yaw: 2.6 },
      { id: 'polyphemus', rig: 'polyphemus-idle', socket: 'root:brow-giant', yaw: 3.3 },
    ],
    props: [],
  },
};

export class Stage3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = null;
    this.setName = null;
    this.set = null;                 /* the live set api */
    this.actors = new Map();
    this.props = new Map();
    this.simT = 0;
    this.orbit = 0;
    this.mounted = null;             /* the mount report the smoke reads */
  }

  /* ---------- mounting ---------- */
  async mount(name) {
    if (!SETS[name]) throw new Error(`unknown set "${name}"`);
    if (this.setName === name) return this.mounted;
    this.unmount();

    const spec = SETS[name];
    const api = spec.build();
    this.scene.add(api.root);
    this.camera = spec.camera(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.set = api;
    this.setName = name;

    /* the shadow policy — the demo's, on the caster the SET declares */
    const caster = spec.caster(api);
    const shadow = caster
      ? (configureShadowCaster(caster),
         caster.shadow.camera.far = spec.casterFar ?? SHADOW_LAW.far,
         { caster: caster.type, mapSize: SHADOW_LAW.mapSize, near: SHADOW_LAW.near,
           far: caster.shadow.camera.far, bias: SHADOW_LAW.bias })
      : { caster: null };

    await this._stage(name);

    this.mounted = {
      set: name,
      triangles: api.triangles,
      parts: Object.keys(api.parts || {}).length,
      shadow,
      actors: [...this.actors.keys()],
      props: [...this.props.keys()],
    };
    this.setSim(this.simT);
    return this.mounted;
  }

  /**
   * A leaf turn takes the WHOLE set away — its geometry AND everything the
   * stage staged into it. The cast and props live in the scene beside the set
   * root (they are not the set's), so they must be struck by name here: an
   * actor left behind after a mount is a giant standing in someone else's
   * campfire.
   */
  unmount() {
    if (!this.set) return;
    for (const a of this.actors.values()) { this.scene.remove(a.group); disposeTree(a.group); }
    for (const g of this.props.values()) { this.scene.remove(g); disposeTree(g); }
    this.actors.clear();
    this.props.clear();
    this.scene.remove(this.set.root);
    disposeTree(this.set.root);
    world.clear(this.setName);
    this.set = null; this.setName = null; this.camera = null;
  }

  /* ---------- the staging ---------- */
  async _stage(name) {
    const plan = STAGING[name] || { cast: [], props: [] };
    const sockets = (this.set.root.userData.sculptRuntime || {}).sockets || {};

    for (const spec of plan.cast) {
      const actor = await buildActor(spec.rig, spec.id);
      const p = this._place(name, spec, sockets);
      actor.group.position.set(p.x, p.y, p.z);
      actor.group.rotation.y = spec.yaw || 0;
      this.scene.add(actor.group);
      this.actors.set(spec.id, actor);
      world.register({
        id: `${name}/${spec.id}`, kind: actor.kind, set: name,
        object3d: actor.group, pose: spec.pose || 'standing', note: `rig ${spec.rig}`,
      });
    }

    for (const spec of plan.props) {
      const g = spec.make();
      /* props are authored in UNIT dimensions — the authority sizes them */
      const want = SIZE_TABLE[spec.kind].m;
      const axis = SIZE_TABLE[spec.kind].axis;
      const unit = measure(g, axis);
      if (isFinite(unit) && unit > 0) g.scale.setScalar(want / unit);
      const p = this._place(name, spec, sockets);
      g.position.set(p.x, p.y, p.z);
      if (spec.rot) g.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(g);
      this.props.set(spec.id, g);
      world.register({
        id: `${name}/${spec.id}`, kind: spec.kind, set: name,
        object3d: g, note: 'pure-code prop (poly-props)',
      });
    }
  }

  /** A staging mark -> metres: the set's socket, or the ledger's plate px. */
  _place(name, spec, sockets) {
    if (spec.socket && sockets[spec.socket]) {
      const [x, y, z] = sockets[spec.socket];
      const o = spec.offset || [0, 0, 0];
      return { x: x + o[0], y: y + o[1], z: z + o[2] };
    }
    const f = FRAMES[name];
    return { x: f.X(spec.px[0]), y: spec.y || 0, z: f.Z(spec.px[1]) };
  }

  /* ---------- time ---------- */
  step(dt) {
    this.simT += dt;
    this._tick(dt);
  }

  /** Absolute, deterministic — the harness's own hand on the clock. */
  setSim(t) {
    const dt = t - this.simT;
    this.simT = t;
    this._tick(dt);
  }

  _tick(dt) {
    if (!this.set) return;
    this.set.tick(this.simT);
    for (const a of this.actors.values()) {
      if (!a.mixer) continue;
      /* deterministic: the clip is a pure function of sim-time */
      a.mixer.setTime(a.clipDur ? (this.simT % a.clipDur) : 0);
    }
    void dt;
  }

  setOrbit(deg) {
    this.orbit = deg;
    if (this.camera && this.camera.userData.setOrbit) this.camera.userData.setOrbit(deg);
  }

  /* ---------- the frame ---------- *
   * The default lens is the SET'S OWN isometric camera — the demo's framing,
   * the quality bar. Two seams let a later lane take the frame without
   * touching this file: setCamera() swaps the lens (the cinematography lane's
   * PerspectiveCamera), setRenderPass() swaps the draw (its DoF pass).       */
  setCamera(cam) { this.camera = cam; return cam; }
  setRenderPass(fn) { this.renderPass = fn || null; }

  render() {
    if (!this.set || !this.camera) return;
    resizeToCanvas(this.renderer, this.canvas, this.camera, this.set.setPixelScale);
    if (this.renderPass) this.renderPass(this.scene, this.camera, this.renderer);
    else this.renderer.render(this.scene, this.camera);
  }

  /**
   * A staged SUBJECT in world space — {a:actorId} | {p:propId} | {t:partName}.
   * Returns { p, box, face } or null for a mark the stage does not own.
   */
  resolve(subject = {}) {
    const obj = subject.a ? this.actors.get(subject.a)?.group
      : subject.p ? this.props.get(subject.p)
      : subject.t ? (this.set && this.set.parts ? this.set.parts[subject.t] : null)
      : null;
    if (!obj) return null;
    const box = new THREE.Box3().setFromObject(obj);
    const p = box.getCenter(new THREE.Vector3());
    return { p, box, face: obj.rotation ? obj.rotation.y : 0 };
  }

  /* ---------- what the gates read ---------- */
  describe() {
    return {
      renderer: describeRenderer(this.renderer),
      config: RENDER_CONFIG,
      set: this.mounted,
      simT: this.simT,
    };
  }

  /** Set dressing measured for the record — advisory, NOT gated (the sets are
   *  signed off; this is how their own dressing measures under the table). */
  dressing() {
    if (!this.set) return [];
    const out = [];
    const named = { 'sheep-flock': 'sheep', 'ship-2': 'ship', 'ship-1': 'ship' };
    for (const [part, kind] of Object.entries(named)) {
      const o = (this.set.parts || {})[part];
      if (!o) continue;
      out.push({ part, kind, set: this.setName, measuredM: +measure(o, 'height').toFixed(3),
                 lengthM: +measure(o, 'length').toFixed(3) });
    }
    return out;
  }
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    }
  });
}
