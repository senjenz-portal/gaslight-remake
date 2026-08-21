/**
 * cave3d.js — THE CAVE as a story SET: the demo3d full-3D diorama
 * (demo3d/full3d/createCaveScene.js) reused WHOLESALE, wrapped with the two
 * things the book's leaves need that a demo turntable never did:
 *
 *   THE BOULDER RIG — the ledger's shut boulder becomes a posable object:
 *     setBoulderK(k) rolls the one faceted ovoid between OPEN (rolled aside
 *     to the east jamb, spun through its own circumference) and SHUT (the
 *     demo's exact authored seat — k=1 is byte-identical to the demo pose).
 *     The stage animates k through a mover; the boom is the audio lane's.
 *
 *   THE STATE RIG — the cave is mounted on three leaves in STATE variants
 *     (cave-dawn / cave-shut / cave-embers / cave-predawn, units.js's own
 *     acts). States are LIGHT arithmetic only: a warm day shaft through the
 *     mouth, a grey pre-dawn fill, multipliers on the demo's own fire and
 *     night rig. Geometry untouched; still a pure function of sim time.
 *
 * Everything else (world frame, PATH_PTS corridor, OBSTACLES census,
 * tick/flick, triangles) is the demo module's own, re-exported.
 */
import * as THREE from 'three';
import { createCaveScene, createCaveIsoCamera, CAVE_WORLD }
  from '../../demo3d/full3d/createCaveScene.js';

export { createCaveIsoCamera, CAVE_WORLD };

/* the four states — multipliers on the demo rig + the two added lights */
export const CAVE_STATES = {
  'cave-dawn':    { fire: 0.22, hemi: 1.20, moon: 0.30, shaft: 1.7, predawn: 0.0, boulder: 0 },
  'cave-shut':    { fire: 1.00, hemi: 1.00, moon: 1.00, shaft: 0.0, predawn: 0.0, boulder: 1 },
  'cave-embers':  { fire: 0.30, hemi: 0.80, moon: 0.85, shaft: 0.0, predawn: 0.0, boulder: 1 },
  'cave-predawn': { fire: 0.12, hemi: 0.85, moon: 0.60, shaft: 0.0, predawn: 0.9, boulder: 1 },
};

export function createCave3D() {
  const api = createCaveScene();

  /* ---- the boulder rig ---- */
  const boulder = api.root.getObjectByName('boulder-shut');
  const SHUT = { x: 0, y: 2.2, z: 0.9, rz: 0.12 };
  /* rolled aside: clear of the 2.75 m arch to the east, spun ~1.9 rad, and
     settled a hand lower (it rests on the ground, not seated in the arch) */
  const OPEN = { x: 5.6, y: 2.0, z: 1.7, rz: 0.12 - 1.9 };
  const setBoulderK = (k) => {
    if (!boulder) return;
    const e = k < 0 ? 0 : k > 1 ? 1 : k;
    boulder.position.set(
      OPEN.x + (SHUT.x - OPEN.x) * e,
      OPEN.y + (SHUT.y - OPEN.y) * e,
      OPEN.z + (SHUT.z - OPEN.z) * e);
    boulder.rotation.z = OPEN.rz + (SHUT.rz - OPEN.rz) * e;
  };

  /* ---- the state lights ---- */
  const { X, Z } = CAVE_WORLD;
  /* day shaft: dawn spilling through the open mouth (the mouth group sits at
     X(347), Z(430)-1.6 facing south-east) */
  const shaft = new THREE.DirectionalLight('#ffd9a8', 0);
  shaft.position.set(X(347) - 14, 7.5, Z(430) + 8);
  shaft.target.position.set(X(560), 0, Z(470));
  api.root.add(shaft, shaft.target);
  /* pre-dawn: the grey light of the mouth-chinks */
  const predawn = new THREE.DirectionalLight('#9fb4d8', 0);
  predawn.position.set(X(347) - 10, 9, Z(430) + 5);
  predawn.target.position.set(X(700), 0, Z(480));
  api.root.add(predawn, predawn.target);

  const hemi = api.parts['night-rig'];              /* the demo's own fills */
  const hemiBase = hemi ? hemi.intensity : 1.2;
  let moonBase = 0.75, moonLight = null;
  api.root.traverse((o) => { if (o.isDirectionalLight && o !== shaft && o !== predawn && !moonLight) { moonLight = o; moonBase = o.intensity; } });

  /* the live state (the stage eases `cur` toward `want` through its mover) */
  const state = { name: 'cave-shut', cur: { ...CAVE_STATES['cave-shut'] } };
  const setState = (name, k = 1) => {
    const want = CAVE_STATES[name];
    if (!want) return state.name;
    if (k >= 1) { state.name = name; Object.assign(state.cur, want); }
    else {
      for (const key of Object.keys(want)) {
        if (key === 'boulder') continue;            /* the boulder has its own rig */
        state.cur[key] = state.cur[key] + (want[key] - state.cur[key]) * k;
      }
    }
    return state.name;
  };

  /* applyState is called AFTER api.tick(simT) each step — the demo's tick
     writes fireLight.intensity = 330·flick, so the multiplier lands on top */
  const applyState = (holdBoost = 0) => {
    api.fireLight.intensity *= Math.min(1.6, state.cur.fire + holdBoost);
    if (hemi) hemi.intensity = hemiBase * state.cur.hemi;
    if (moonLight) moonLight.intensity = moonBase * state.cur.moon;
    shaft.intensity = state.cur.shaft;
    predawn.intensity = state.cur.predawn;
  };

  setBoulderK(1);                                   /* the demo pose is SHUT */
  return { ...api, boulder, setBoulderK, setState, applyState, state,
           SHUT, OPEN };
}
