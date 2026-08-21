/**
 * props3d.js — THE STORY'S HAND PROPS.
 *
 * The three signed-off props (the great bowl, the stake, the wineskin) come
 * straight out of the Polyphemus demo's own prop module — promotion law: only
 * signed-off artifacts get mounted. Two more the STORY needs and the demo page
 * never had are authored here in the same idiom (pure code, flat-shaded facet
 * material, unit-authored and sized by world.js):
 *
 *   THE SWORD   ledger objectLedger — "SWORD prop (hip-rest / drawn-over-throat
 *               / sheathed), breathing glint at the G2 anchor". Beat II's gate
 *               target: the reader clicks it, the blade lifts, and the story
 *               refuses the stroke (O.5).
 *   THE WINE    the dark disc inside the ivy-wood bowl whose level IS the G3
 *               hold — three pours, drained on each release.
 *
 * Everything is authored around its own origin in metres-of-intent; the stage
 * re-fits each one against world.js's SIZE_TABLE at mount, so a prop's authored
 * dimension is a suggestion and the ledger's metre is the law.
 */
import * as THREE from 'three';
export { createGreatBowl, createStake, createWineskin } from '../../demo3d/polyphemus/poly-props.js';

/* the demo's material idiom: matte, flat-shaded, no metal */
const matte = (color, rough = 0.82) => new THREE.MeshStandardMaterial({
  color, roughness: rough, metalness: 0, flatShading: true,
});

/**
 * THE SWORD — hilt, guard, tapered blade. Authored along +X so the group's
 * LENGTH axis is the blade (world.js measures a sword by length).
 */
export function createSword() {
  const g = new THREE.Group();
  g.name = 'sword';

  const blade = new THREE.Mesh(new THREE.BufferGeometry(), matte('#b9c2cc', 0.34));
  {
    /* a leaf blade: six-sided section tapering to the point */
    const L = 0.56, W = 0.052, T = 0.012;
    const pos = [], idx = [];
    const ring = (x, w, t) => {
      const base = pos.length / 3;
      pos.push(x, 0, -w, x, t, 0, x, 0, w, x, -t, 0);
      return base;
    };
    const a = ring(0, W * 0.85, T), b = ring(L * 0.55, W, T),
          c = ring(L * 0.88, W * 0.62, T * 0.8), d = ring(L, 0.001, 0.001);
    for (const [p, q] of [[a, b], [b, c], [c, d]])
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        idx.push(p + i, q + i, q + j, p + i, q + j, p + j);
      }
    blade.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.geometry.setIndex(idx);
    blade.geometry.computeVertexNormals();
  }
  blade.castShadow = true;
  g.add(blade);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.030, 0.15), matte('#8a7a4e', 0.55));
  guard.position.x = -0.012;
  guard.castShadow = true;
  g.add(guard);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.13, 8), matte('#5a3b28'));
  grip.rotation.z = Math.PI / 2;
  grip.position.x = -0.085;
  grip.castShadow = true;
  g.add(grip);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), matte('#8a7a4e', 0.5));
  pommel.position.x = -0.163;
  pommel.castShadow = true;
  g.add(pommel);

  /* THE BREATHING GLINT (ledger): an emissive sliver up the fuller. The story
     drives its intensity; at rest it idles low so the target reads as live. */
  const glintMat = new THREE.MeshStandardMaterial({
    color: '#fff0c4', emissive: '#ffd27a', emissiveIntensity: 1.2,
    roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85,
  });
  const glint = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.010), glintMat);
  glint.position.set(0.30, 0.010, 0);
  glint.name = 'sword-glint';
  g.add(glint);
  g.userData.glint = glintMat;
  return g;
}

/**
 * THE WINE — the disc of dark drink in the bowl. Its own child of the bowl:
 * scaling it to zero is the pour. Authored at unit radius; the stage seats it.
 */
export function createWine(radius = 0.5) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshStandardMaterial({
      color: '#3b0d18', roughness: 0.22, metalness: 0,
      emissive: '#2a0710', emissiveIntensity: 0.35,
    }));
  m.rotation.x = -Math.PI / 2;
  m.name = 'wine';
  return m;
}
