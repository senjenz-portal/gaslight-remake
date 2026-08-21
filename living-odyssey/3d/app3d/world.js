/**
 * world.js — THE SCALE AUTHORITY.
 *
 * ONE module owns ledger -> metres. Nothing else in the book is allowed to
 * turn a plate pixel into a world unit, and nothing else is allowed to decide
 * how tall a man is. Two jobs:
 *
 *   1. THE FRAME. Each set was surveyed on its own plate at its own px/m
 *      (cave 43, shore 11.3, sea 12.7) and its own ellipse elevation. The
 *      arithmetic lives in the signed-off set modules; this module re-exports
 *      it as the single lookup the stage and the story lane read, so a mark in
 *      plate px lands at the same metre coordinate for everyone.
 *
 *   2. THE SIZE TABLE + THE [scale] GATE. Every instance the stage mounts
 *      registers here with the kind it claims to be. At boot the gate MEASURES
 *      each one from its built graph (world-space bounding box, after posture,
 *      fit and grounding) and compares it against the table:
 *
 *          human 1.75 m · giant 7 m · goat 0.9 m · sheep 1.0 m ·
 *          great ram 1.4 m · props per the ledger
 *
 *      Tolerance ±15%. The gate PRINTS THE FULL INSTANCE TABLE — every
 *      instance, its set, its expected size, its measured size, its delta —
 *      and FAILS on any violation. A silent scale error is what put a 0.56 m
 *      "ewe" and a 2.4 m "ram" in the same pen; it cannot happen twice.
 *
 * The measured axis is per kind: bipeds and quadrupeds by HEIGHT (bbox Y),
 * beams and hulls by LENGTH (the longest horizontal bbox edge). Both are read
 * off the object as mounted, in metres, with no scale factor trusted.
 */
import * as THREE from 'three';
import { CAVE_WORLD } from '../../demo3d/full3d/createCaveScene.js';
import { SHORE_WORLD } from '../sets/shore3d.js';
import { SEA_WORLD } from '../sets/sea3d.js';

/* ---------------- the frames (the ledger's own arithmetic) ---------------- */
export const FRAMES = {
  cave: {
    pxPerM: CAVE_WORLD.S, elevDeg: 25,
    X: CAVE_WORLD.X, Z: CAVE_WORLD.Z,
    M: (px) => px / CAVE_WORLD.S,
    obstacles: CAVE_WORLD.OBSTACLES,
  },
  shore: {
    pxPerM: SHORE_WORLD.S, elevDeg: 28,
    X: SHORE_WORLD.X, Z: SHORE_WORLD.Z, ZH: SHORE_WORLD.ZH,
    M: (px) => px / SHORE_WORLD.S,
    obstacles: SHORE_WORLD.OBSTACLES, marks: SHORE_WORLD.MARKS,
  },
  sea: {
    pxPerM: SEA_WORLD.S, elevDeg: 30,
    X: SEA_WORLD.X, Z: SEA_WORLD.Z, ZH: SEA_WORLD.ZH,
    M: (px) => px / SEA_WORLD.S,
    obstacles: SEA_WORLD.OBSTACLES, marks: SEA_WORLD.MARKS,
  },
};
export const SET_NAMES = Object.freeze(['shore', 'cave', 'sea']);

/* ---------------- THE SIZE TABLE ---------------- *
 * `m` is the true-world size in metres; `axis` is what to measure.
 * Props carry their ledger provenance in `from`.                            */
export const SIZE_TABLE = Object.freeze({
  human:      { m: 1.75, axis: 'height', from: 'the mandate — a man, 1.75 m (cave ledger 75 px @ 43 px/m = 1.74)' },
  /* POSES. A size is the size of a STANDING thing; a seated giant is honestly
   * shorter and the gate must know the difference or it measures nothing. The
   * factors are the ledger's own silhouettes, not a fudge (L.50-51: the giant
   * is 300 px standing, ~165 px seated at 43 px/m).                          */
  giant:      { m: 7.00, axis: 'height', poses: { standing: 1, seated: 165 / 300 },
                from: 'the mandate — Polyphemus, 7 m (ledger L.50 300 px @ 43 px/m = 6.98)' },
  goat:       { m: 0.90, axis: 'height', from: 'the mandate — a goat at the withers' },
  sheep:      { m: 1.00, axis: 'height', from: 'the mandate — a ewe of the flock' },
  'ram-great':{ m: 1.40, axis: 'height', from: 'the mandate — THE GREAT RAM (ledger O.11: 100-110 px long, hides a slung man)' },
  stake:      { m: 1.79, axis: 'length', from: 'ledger objectLedger — 77 px = 6 ft @ 43 px/m' },
  bowl:       { m: 1.40, axis: 'length', from: 'ledger — the giant’s ivy-wood bowl, 60 px across @ 43 px/m' },
  wineskin:   { m: 0.98, axis: 'length', from: 'ledger — the shouldered skin, 42 px @ 43 px/m' },
});
export const TOLERANCE = 0.15;          /* ±15%, the mandate's band */

/* ---------------- measurement ---------------- */
const _box = new THREE.Box3(), _size = new THREE.Vector3(), _v = new THREE.Vector3();

/**
 * The world-space bounds of a mounted thing, IN THE POSE IT IS MOUNTED IN.
 *
 * Box3.setFromObject on a SkinnedMesh hands back the BIND bounds — the skin
 * transform lives on the GPU — so a seated giant measured that way reports a
 * standing A-pose box and the gate would be marking its own homework. Where a
 * rig is present the skinned vertices are swept instead, which is what the
 * reader actually sees.
 */
export function bounds(object3d) {
  object3d.updateMatrixWorld(true);
  const skins = [];
  object3d.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
  if (!skins.length) { _box.setFromObject(object3d); return _box; }
  _box.makeEmpty();
  for (const sm of skins) {
    const n = sm.geometry.attributes.position.count;
    const stride = Math.max(1, Math.floor(n / 900));
    for (let i = 0; i < n; i += stride) {
      sm.getVertexPosition(i, _v);
      _box.expandByPoint(_v.applyMatrix4(sm.matrixWorld));
    }
  }
  return _box;
}

/** Metres, measured off the built graph — never off a claimed scale factor. */
export function measure(object3d, axis = 'height') {
  const box = bounds(object3d);
  if (box.isEmpty() || !isFinite(box.min.x)) return NaN;
  box.getSize(_size);
  return axis === 'length' ? Math.max(_size.x, _size.z) : _size.y;
}

/**
 * THE LEDGER. The stage registers every mounted instance; the gate reads it.
 */
export class World {
  constructor() { this.instances = []; }

  /** px -> metres inside a set's own frame. */
  frame(set) {
    const f = FRAMES[set];
    if (!f) throw new Error(`[scale] unknown set "${set}"`);
    return f;
  }
  X(set, px) { return this.frame(set).X(px); }
  Z(set, py) { return this.frame(set).Z(py); }
  metres(set, px) { return this.frame(set).M(px); }

  /** Every mounted thing declares itself here. `kind` must be in SIZE_TABLE. */
  register({ id, kind, set, object3d, pose = 'standing', note = '' }) {
    const spec = SIZE_TABLE[kind];
    if (!spec) throw new Error(`[scale] instance "${id}" claims unknown kind "${kind}"`);
    const f = (spec.poses && spec.poses[pose]) ?? 1;
    if (spec.poses && !(pose in spec.poses))
      throw new Error(`[scale] instance "${id}" claims unknown pose "${pose}" for kind "${kind}"`);
    const rec = { id, kind, set, object3d, note, pose,
                  expectedM: spec.m * f, axis: spec.axis };
    this.instances.push(rec);
    return rec;
  }

  clear(set = null) {
    this.instances = set ? this.instances.filter((i) => i.set !== set) : [];
  }

  /** Re-measure everything and rule on it. */
  audit() {
    const rows = this.instances.map((i) => {
      const measured = measure(i.object3d, i.axis);
      const delta = (measured - i.expectedM) / i.expectedM;
      const ok = isFinite(measured) && Math.abs(delta) <= TOLERANCE;
      return {
        id: i.id, kind: i.kind, set: i.set, axis: i.axis, pose: i.pose,
        expectedM: +i.expectedM.toFixed(3),
        measuredM: isFinite(measured) ? +measured.toFixed(3) : null,
        deltaPct: isFinite(measured) ? +(delta * 100).toFixed(1) : null,
        verdict: ok ? 'PASS' : 'FAIL',
        note: i.note,
      };
    });
    const failed = rows.filter((r) => r.verdict === 'FAIL');
    return { ok: failed.length === 0, count: rows.length, failed: failed.length, rows,
             tolerancePct: TOLERANCE * 100 };
  }

  /**
   * THE [scale] BOOT GATE. Prints the FULL instance table — one line per
   * mounted instance — then the verdict. Returns the audit so the harness can
   * read the same rows the console shows.
   */
  gate({ throwOnFail = false, label = 'THE INSTANCE TABLE' } = {}) {
    const a = this.audit();
    printScaleTable(a.rows, { label, tolerancePct: a.tolerancePct });
    if (!a.ok && throwOnFail)
      throw new Error(`[scale] gate RED: ${a.failed} instance(s) outside ±${a.tolerancePct}%`);
    return a;
  }
}

/** The gate's console face — every instance, one line, then the verdict. */
export function printScaleTable(rows, { label = 'THE INSTANCE TABLE',
                                        tolerancePct = TOLERANCE * 100 } = {}) {
  const pad = (s, n) => String(s).padEnd(n);
  const num = (v, n) => String(v === null ? '—' : v).padStart(n);
  const failed = rows.filter((r) => r.verdict === 'FAIL').length;
  console.log(`[scale] ${label} — ${rows.length} mounted, tolerance ±${tolerancePct}%`);
  console.log('[scale] ' + pad('instance', 26) + pad('kind', 11) + pad('set', 7) +
              pad('pose', 10) + pad('axis', 8) + num('expect', 7) + num('measured', 10) +
              num('delta', 8) + '  verdict');
  for (const r of rows) {
    console.log('[scale] ' + pad(r.id, 26) + pad(r.kind, 11) + pad(r.set, 7) +
      pad(r.pose || 'standing', 10) + pad(r.axis, 8) + num(r.expectedM.toFixed(2), 7) +
      num(r.measuredM === null ? '—' : r.measuredM.toFixed(2), 10) +
      num(r.deltaPct === null ? '—' : (r.deltaPct > 0 ? '+' : '') + r.deltaPct + '%', 8) +
      '  ' + r.verdict + (r.verdict === 'FAIL' ? '  <<<' : ''));
  }
  console.log(`[scale] ${failed === 0 ? 'GREEN' : 'RED'} — ${rows.length - failed}/${rows.length} inside ±${tolerancePct}%`);
  return { ok: failed === 0, failed, count: rows.length };
}

/** The book has one world. */
export const world = new World();
