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

/* ---------------- what a SUBJECT name means ---------------- *
 * The shot table asks for `{t:'cyclops'}` and `{p:'fire'}`; those are the
 * ledger's own names for things the stage keeps in three different registers
 * (a set part, a mounted actor, a story prop). One alias table, resolved in
 * that order, so the camera never has to know which register a name lives in. */
const SUBJECT_ALIAS = {
  cyclops: { a: 'poly-idle' },
  giant: { a: 'poly-idle' },
  fire: { t: 'fire-pit' },
  ship: { t: 'ship-2' },
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
    /* THE DIRECTOR'S SEAM. The story lane hands the stage an object with
       populate(setName) and tick(simT); the stage calls them and asks nothing
       else of it. With no director mounted the stage is the foundation's own
       empty theatre — which is what the set demos want. */
    this.director = null;
  }

  /* ---------- mounting ---------- */
  async mount(name) {
    if (!SETS[name]) throw new Error(`unknown set "${name}"`);
    if (this.setName === name) return this.mounted;
    this.unmount();

    const spec = SETS[name];
    const api = spec.build();
    this.scene.add(api.root);
    /* THE LENS SURVIVES THE LEAF TURN. Every set ships its own isometric
       camera — the demo's framing, and the default when nobody else wants the
       frame. But a lens handed over by setCamera() belongs to whoever took it
       (the storyteller), and a page turn is not a reason to take it back:
       clobbering it here put the cine camera on the first leaf only and every
       later beat back on the diorama's turntable view. */
    this.isoCamera = spec.camera(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.camera = this.lens || this.isoCamera;
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
    for (const a of this.actors.values()) {
      /* a decked body rides the SHIP's sway group, not the scene — detach it
         first or it is struck twice: once here and once with the set root */
      if (a.group.parent) a.group.parent.remove(a.group);
      disposeTree(a.group);
    }
    for (const g of this.props.values()) { this.scene.remove(g); disposeTree(g); }
    this.actors.clear();
    this.props.clear();
    this.scene.remove(this.set.root);
    disposeTree(this.set.root);
    world.clear(this.setName);
    this.set = null; this.setName = null; this.isoCamera = null;
    this.camera = this.lens || null;
  }

  /* ---------- the staging ---------- *
   * The stage does not know who stands where; the director does. What the
   * stage owns is the WAY a body arrives: the demo's build path (actor3d),
   * the scale authority's metre, and the registration that puts the instance
   * in front of the [scale] gate. Nothing reaches the scene except through
   * these two doors.                                                        */
  async _stage(name) {
    if (this.director) await this.director.populate(name);
  }

  /** Mount one body: the demo's rig path, the authority's metre, registered. */
  async addActor(id, rig, { pose = 'standing' } = {}) {
    if (this.actors.has(id)) return this.actors.get(id);
    const actor = await buildActor(rig, id);
    this.scene.add(actor.group);
    this.actors.set(id, actor);
    world.register({
      id: `${this.setName}/${id}`, kind: actor.kind, set: this.setName,
      object3d: actor.group, pose, note: `rig ${rig}`,
    });
    return actor;
  }

  /** Mount one prop: authored in unit dimensions, SIZED BY THE AUTHORITY. */
  async addProp(id, make, kind, spec = {}) {
    if (this.props.has(id)) return this.props.get(id);
    const g = make();
    const want = SIZE_TABLE[kind];
    if (!want) throw new Error(`[scale] prop "${id}" claims unknown kind "${kind}"`);
    const unit = measure(g, want.axis);
    if (isFinite(unit) && unit > 0) g.scale.setScalar(want.m / unit);
    const sockets = (this.set.root.userData.sculptRuntime || {}).sockets || {};
    const p = this._place(this.setName, spec, sockets);
    g.position.set(p.x, p.y, p.z);
    if (spec.rot) g.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    this.props.set(id, g);
    world.register({
      id: `${this.setName}/${id}`, kind, set: this.setName, object3d: g,
      note: 'pure-code prop',
    });
    return g;
  }

  /** A staging mark -> metres: the set's socket, or the ledger's plate px. */
  _place(name, spec, sockets) {
    if (spec.socket && sockets[spec.socket]) {
      const [x, y, z] = sockets[spec.socket];
      const o = spec.offset || [0, 0, 0];
      return { x: x + o[0], y: y + o[1], z: z + o[2] };
    }
    if (!spec.px) return { x: 0, y: spec.y || 0, z: 0 };
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
    /* THE SET FIRST, then the story on top of it: the director's cave-hour
       grade multiplies the blaze's own flicker rather than replacing it, and
       an actor's clip time is decided by what the story has him DOING. */
    this.set.tick(this.simT);
    if (this.director) this.director.tick(this.simT, dt);
    else for (const a of this.actors.values()) {
      if (!a.mixer) continue;
      /* deterministic: the clip is a pure function of sim-time */
      a.mixer.setTime(a.clipDur ? (this.simT % a.clipDur) : 0);
    }
    void dt;
  }

  /** the turntable is the SET's own iso camera — the storyteller does not orbit */
  setOrbit(deg) {
    this.orbit = deg;
    const iso = this.isoCamera;
    if (iso && iso.userData.setOrbit) iso.userData.setOrbit(deg);
  }

  /* ---------- the frame ---------- *
   * The default lens is the SET'S OWN isometric camera — the demo's framing,
   * the quality bar. Two seams let a later lane take the frame without
   * touching this file: setCamera() swaps the lens (the cinematography lane's
   * PerspectiveCamera), setRenderPass() swaps the draw (its DoF pass).       */
  setCamera(cam) { this.lens = cam; this.camera = cam || this.isoCamera; return this.camera; }
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
    const parts = (this.set && this.set.parts) || {};
    /* one name, three registers, resolved in the order the ledger uses them:
       the alias first, then the set's own part, then the cast, then the props */
    const byName = (n) => {
      const alias = SUBJECT_ALIAS[n];
      if (alias) {
        const a = alias.a ? this.actors.get(alias.a) : null;
        if (a && a.group.visible) return a.group;
        if (alias.t && parts[alias.t]) return parts[alias.t];
      }
      return parts[n] || this.actors.get(n)?.group || this.props.get(n) || null;
    };
    const obj = subject.a ? this.actors.get(subject.a)?.group
      : subject.p ? (this.props.get(subject.p) || byName(subject.p))
      : subject.t ? byName(subject.t)
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
