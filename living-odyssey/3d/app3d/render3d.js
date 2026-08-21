/**
 * render3d.js — THE BOOK'S ONE RENDER PIPELINE.
 *
 * Every value here is LIFTED VERBATIM from the quality bar, the full-3D cave
 * demo (demo3d/full3d/index.html + createCaveScene.js). The demo is the
 * reference, not the inspiration: the renderer flags, the tone map and its
 * exposure, the shadow policy of the one shadow-casting light, the actor's
 * material treatment and its grounding law all come across unchanged. The
 * book now renders through THIS module and nothing else, so there is exactly
 * one place a pipeline value can be read or changed, and the smoke gate diffs
 * the live renderer against the live demo renderer to prove they still agree.
 *
 * PROVENANCE (demo3d/full3d/index.html, lines 124-130):
 *   new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
 *   renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
 *   renderer.outputColorSpace  = THREE.SRGBColorSpace
 *   renderer.toneMapping       = THREE.ACESFilmicToneMapping
 *   renderer.toneMappingExposure = 1.38
 *   renderer.shadowMap.enabled = true
 *   renderer.shadowMap.type    = THREE.PCFSoftShadowMap
 *
 * SHADOW LAW (createCaveScene.js, lines 586-594): ONE caster in the scene —
 * the blaze — at a 1024 cube, near 0.3, far 40, bias -0.004. A set declares
 * its caster; the stage hands it to configureShadowCaster() so every set
 * throws the demo's shadow, not its own.
 *
 * THE PLATE PIPELINE IS GONE. The sandwich rendered with NoToneMapping
 * because a painted plate ships its own grade; nothing in the book is a
 * painted plate any more, so the filmic rolloff the blaze needs is the law.
 */
import * as THREE from 'three';

/* the pipeline, as data — the diff gate reads this and the live renderer */
export const RENDER_CONFIG = Object.freeze({
  antialias: true,
  preserveDrawingBuffer: true,
  maxPixelRatio: 2,
  outputColorSpace: 'srgb',
  toneMapping: 'ACESFilmicToneMapping',
  toneMappingExposure: 1.38,
  shadowMapEnabled: true,
  shadowMapType: 'PCFSoftShadowMap',
});

export const SHADOW_LAW = Object.freeze({
  mapSize: 1024, near: 0.3, far: 40, bias: -0.004,
});

/* the demo's actor material treatment (full3d/index.html lines 190-199) */
export const ACTOR_MATERIAL_LAW = Object.freeze({
  metalness: 0, roughnessMax: 0.9, transparent: true, castShadow: true,
});

const TONE = { NoToneMapping: THREE.NoToneMapping,
  LinearToneMapping: THREE.LinearToneMapping,
  ReinhardToneMapping: THREE.ReinhardToneMapping,
  CineonToneMapping: THREE.CineonToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping };
const SHADOW = { BasicShadowMap: THREE.BasicShadowMap, PCFShadowMap: THREE.PCFShadowMap,
  PCFSoftShadowMap: THREE.PCFSoftShadowMap, VSMShadowMap: THREE.VSMShadowMap };
const nameOf = (table, v) => Object.keys(table).find((k) => table[k] === v) || String(v);

/** The book's renderer. No caller may set a pipeline value itself. */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: RENDER_CONFIG.antialias,
    preserveDrawingBuffer: RENDER_CONFIG.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_CONFIG.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = TONE[RENDER_CONFIG.toneMapping];
  renderer.toneMappingExposure = RENDER_CONFIG.toneMappingExposure;
  renderer.shadowMap.enabled = RENDER_CONFIG.shadowMapEnabled;
  renderer.shadowMap.type = SHADOW[RENDER_CONFIG.shadowMapType];
  return renderer;
}

/** What the live renderer actually is — the shape the diff gate compares. */
export function describeRenderer(renderer) {
  return {
    antialias: !!renderer.getContextAttributes?.().antialias,
    preserveDrawingBuffer: !!renderer.getContextAttributes?.().preserveDrawingBuffer,
    maxPixelRatio: Math.min(window.devicePixelRatio, RENDER_CONFIG.maxPixelRatio),
    outputColorSpace: renderer.outputColorSpace === THREE.SRGBColorSpace ? 'srgb' : String(renderer.outputColorSpace),
    toneMapping: nameOf(TONE, renderer.toneMapping),
    toneMappingExposure: renderer.toneMappingExposure,
    shadowMapEnabled: renderer.shadowMap.enabled,
    shadowMapType: nameOf(SHADOW, renderer.shadowMap.type),
  };
}

/** The demo's shadow policy, applied to whichever light a set declares. */
export function configureShadowCaster(light) {
  if (!light) return null;
  light.castShadow = true;
  light.shadow.mapSize.set(SHADOW_LAW.mapSize, SHADOW_LAW.mapSize);
  light.shadow.camera.near = SHADOW_LAW.near;
  light.shadow.camera.far = SHADOW_LAW.far;
  light.shadow.bias = SHADOW_LAW.bias;
  return light;
}

/**
 * The demo's resize (full3d/index.html lines 265-273): the drawing buffer
 * follows the canvas, and the set is told how many canvas PIXELS a world
 * METRE is worth, because particle sizes are world metres under an ortho cam.
 */
export function resizeToCanvas(renderer, canvas, camera, setPixelScale) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const pr = renderer.getPixelRatio();
  if (canvas.width === Math.floor(w * pr) && canvas.height === Math.floor(h * pr)) return false;
  renderer.setSize(w, h, false);
  if (camera && camera.isOrthographicCamera && typeof setPixelScale === 'function')
    setPixelScale((h * pr) / (camera.top - camera.bottom));
  return true;
}

/**
 * The demo's actor material pass (full3d/index.html lines 190-199): skinned
 * meshes cast into the blaze's shadow and never frustum-cull; every standard
 * material goes matte and transparent so the walk can fade at the ends.
 * Returns the fade material list the walk law drives.
 */
export function dressActorMaterials(model) {
  const fadeMats = [];
  model.traverse((o) => {
    if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = ACTOR_MATERIAL_LAW.castShadow; }
    if (!o.isMesh) return;
    o.castShadow = ACTOR_MATERIAL_LAW.castShadow;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.isMeshStandardMaterial) continue;
      m.metalness = ACTOR_MATERIAL_LAW.metalness;
      m.roughness = Math.min(m.roughness, ACTOR_MATERIAL_LAW.roughnessMax);
      m.transparent = ACTOR_MATERIAL_LAW.transparent;
      m.needsUpdate = true;
      fadeMats.push(m);
    }
  });
  return fadeMats;
}
