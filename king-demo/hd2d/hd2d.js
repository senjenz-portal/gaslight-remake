/**
 * hd2d.js — LANE B: the Octopath Traveler II "HD-2D" treatment of the King.
 *
 * The diorama is the img2threejs Baker Street stage, unchanged (copied verbatim
 * from ../createBakerStreetStage.js). The King is NOT 3D: he is a pixel-art
 * sprite sheet cut by build_sprites.py from an NB Pro generation, drawn on a
 * yaw-only billboard quad with NearestFilter, walking a slow patrol.
 *
 * The look is the point. Four things carry it, in this order of importance:
 *   1. depth of field   — the diorama defocuses away from the King's plane, so
 *                         the stage reads as a miniature under a macro lens.
 *   2. bloom            — gas lamps and windows bleed, which is what sells the
 *                         "lit diorama at night" read.
 *   3. a warm key shaft — one dramatic raking beam plus visible light shafts,
 *                         against deep blue shadow.
 *   4. vignette + grain — the photographic frame around it all.
 *
 * Tunables are all in CFG and every one of them is overridable from the query
 * string (?bloom=0.9&aperture=0.004...), which is how the look was dialled in
 * against the style reference without editing this file between shots.
 */
import * as THREE from 'three';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { ShaderPass } from './vendor/postprocessing/ShaderPass.js';
import { BokehPass } from './vendor/postprocessing/BokehPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';
import {
  createBakerStreetStage,
  createBakerStreetStageNightRig,
  configureBakerStreetNightDioramaRenderer,
} from './createBakerStreetStage.js';

/* ------------------------------------------------------------------ config */

/**
 * The stage's walkable geometry, measured by dropping rays onto it
 * (window.__hd2d.groundGrid): the cobbled street is a clear corridor at
 * x in [-1, 1], z in [-5, 5], y = 0.14. The building facade walls the corridor
 * at x ~ -3.5, the hansom cab and its horse sit against it at x ~ +1.5..2, and
 * the island falls away to open sky outside x in [-3, 5]. The patrol runs down
 * that corridor, which is also why the camera looks along +Z.
 */
const CFG = {
  // camera — a long lens looking down the street; the low FOV keeps the
  // near-orthographic diorama read while still giving real perspective DoF.
  fov: 17,
  camDist: 28,
  camAzimuth: 21,      // degrees around Y from +Z
  camElevation: 33,    // degrees above the horizon
  camTargetX: 0.7,     // offsets from the patrol centre, in world units
  camTargetY: 1.7,
  camTargetZ: -0.2,

  // the King
  kingHeight: 2.0,         // world units, head to boot
  kingScaleFudge: 1.0,
  patrolCenterX: -2.0,
  patrolCenterZ: 0.0,
  patrolAxis: 0,           // degrees; direction he paces along, in XZ (+Z)
  patrolHalf: 2.6,         // world units either side of centre
  walkSpeed: 0.62,         // world units / second
  walkFps: 7,              // sprite frames / second
  pauseAtEnds: 1.2,        // seconds

  // look
  bloom: 0.55,
  bloomRadius: 0.55,
  bloomThreshold: 0.75,
  aperture: 0.0028,
  maxblur: 0.022,
  // the stage's own night rig is a lookdev rig: it lights everything evenly.
  // Octopath's diorama is mostly deep shadow with a few warm pools, so the
  // ambient terms get pulled right down and the warm key does the work.
  ambient: 0.92,
  moon: 0.80,
  emissive: 0.5,   // the stage's window/lamp emissives, which blow out under bloom
  lamps: 0.62,     // the stage's warm point lights
  focusOffset: 0.0,        // world units of focus bias off the King
  vignette: 0.62,
  grain: 0.045,
  saturation: 0.70,
  lift: 0.045,
  exposure: 1.10,
  sky: 1.25,        // scene.backgroundIntensity for the night gradient
  shafts: 1.0,
  keyLight: 1.0,
  fog: 0.008,
};

const params = new URLSearchParams(location.search);
for (const k of Object.keys(CFG)) {
  if (params.has(k)) CFG[k] = parseFloat(params.get(k));
}
const PAUSED = params.get('paused') === '1';
const FRAME = params.has('frame') ? parseInt(params.get('frame'), 10) : null;
const SHOW_CARD = params.get('card') === '1';

const SHEET = { url: './sprites/king-walk.png', cells: 5, cellW: 90, cellH: 140 };
const WALK_FRAMES = [1, 2, 3, 4];   // cell 0 is the idle stance

/* ---------------------------------------------------------------- renderer */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
configureBakerStreetNightDioramaRenderer(renderer);
// ACES (what the stage ships with) desaturates anything that clips, so the warm
// shopfront windows turned into flat white holes under bloom. Khronos PBR
// Neutral rolls the highlight off while keeping its hue, which is the whole
// point here: the lamps have to stay amber at their core.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = CFG.exposure;

const scene = new THREE.Scene();

/**
 * A night-sky gradient rather than a flat black clear colour.
 *
 * This stage is a floating island, so a quarter of the frame is whatever sits
 * behind it. Against black that quarter measured as pure crushed shadow and
 * dragged the whole picture's histogram far below the reference's (31% of the
 * reference is below 0.12 luminance; ours was 71%). A graded sky with a warm
 * lift near the horizon puts that region back into readable low mid-tone and
 * gives the diorama something to be lit against.
 */
function nightSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#070c1a');
  grad.addColorStop(0.42, '#132140');
  grad.addColorStop(0.72, '#26355a');
  grad.addColorStop(0.90, '#3d3f5c');
  grad.addColorStop(1.00, '#4a3c46');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
scene.background = nightSkyTexture();
scene.backgroundIntensity = CFG.sky;
scene.fog = new THREE.FogExp2(new THREE.Color('#131f39'), CFG.fog);

const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 1, 120);

/* ------------------------------------------------------------------- stage */

const stage = createBakerStreetStage();
scene.add(stage);

const nightRig = createBakerStreetStageNightRig();
nightRig.traverse((o) => {
  if (o.isHemisphereLight) o.intensity *= CFG.ambient;
  else if (o.isDirectionalLight) o.intensity *= (o.name === 'moon-key' ? CFG.moon : CFG.ambient);
});
scene.add(nightRig);

// Pull the stage's emissives and warm points down before they meet the bloom:
// at their lookdev values the shopfront windows clip to flat white and the
// whole left third of the frame becomes one glowing blob.
{
  const seen = new Set();
  stage.traverse((o) => {
    if (o.isLight && o.isPointLight) o.intensity *= CFG.lamps;
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || seen.has(m.uuid) || !m.emissive) continue;
      seen.add(m.uuid);
      if (m.emissiveIntensity !== undefined) m.emissiveIntensity *= CFG.emissive;
      else m.emissive.multiplyScalar(CFG.emissive);
    }
  });
}

const stageBox = new THREE.Box3().setFromObject(stage);
const stageSize = stageBox.getSize(new THREE.Vector3());
const stageCenter = stageBox.getCenter(new THREE.Vector3());

// The pavement height under the patrol, found by dropping a ray onto the stage.
// Raycast the MESHES only: the diorama carries THREE.Sprite lamp halos, and
// Sprite.raycast dereferences raycaster.camera, which is null here. Results are
// cached on a coarse grid because this runs every frame and the stage is 100+
// meshes deep.
const stageMeshes = [];
stage.traverse((o) => { if (o.isMesh) stageMeshes.push(o); });

const groundRay = new THREE.Raycaster();
const groundCache = new Map();
function groundYAt(x, z) {
  const key = (Math.round(x * 4) / 4) + ':' + (Math.round(z * 4) / 4);
  let y = groundCache.get(key);
  if (y !== undefined) return y;
  groundRay.set(new THREE.Vector3(x, stageBox.max.y + 5, z), new THREE.Vector3(0, -1, 0));
  const hits = groundRay.intersectObjects(stageMeshes, false)
    .filter((h) => h.face && h.face.normal.y > 0.5);
  y = hits.length ? hits[0].point.y : stageCenter.y;
  groundCache.set(key, y);
  return y;
}

/* --------------------------------------------------------------- the King */

const texLoader = new THREE.TextureLoader();
const sheetTex = texLoader.load(SHEET.url);
sheetTex.magFilter = THREE.NearestFilter;
sheetTex.minFilter = THREE.NearestFilter;
sheetTex.generateMipmaps = false;
sheetTex.colorSpace = THREE.SRGBColorSpace;
sheetTex.wrapS = THREE.ClampToEdgeWrapping;
sheetTex.wrapT = THREE.ClampToEdgeWrapping;
sheetTex.repeat.set(1 / SHEET.cells, 1);

const kingAspect = SHEET.cellW / SHEET.cellH;
const kingH = CFG.kingHeight * CFG.kingScaleFudge * (SHEET.cellH / 132);  // cell has headroom
const kingGeo = new THREE.PlaneGeometry(kingH * kingAspect, kingH);
kingGeo.translate(0, kingH / 2, 0);   // pivot at the feet

const kingMat = new THREE.MeshBasicMaterial({
  map: sheetTex,
  transparent: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
  toneMapped: true,
  color: new THREE.Color('#ffd9b4'),  // warm lamp tint, multiplied over the art
});
const king = new THREE.Mesh(kingGeo, kingMat);
king.name = 'king-billboard';
king.renderOrder = 2;
// The DoF pass swaps in per-object depth materials; the King needs one that
// alpha-tests against the same sheet, or his transparent corners punch a
// sharp rectangle of background through the blur.
king.userData.hd2dDepthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  map: sheetTex,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
  blending: THREE.NoBlending,
});
scene.add(king);

// contact shadow: a soft blob, because a billboard cannot cast a shaped one
function radialAlphaTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.72)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const blobTex = radialAlphaTexture();
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(kingH * 0.62, kingH * 0.30),
  new THREE.MeshBasicMaterial({
    map: blobTex, transparent: true, opacity: 0.82,
    color: new THREE.Color('#04070f'), depthWrite: false,
    blending: THREE.NormalBlending, toneMapped: false,
  })
);
blob.rotation.x = -Math.PI / 2;
blob.renderOrder = 1;
scene.add(blob);

/* --------------------------------------------------------- the cameo card */

const cameoMasked = texLoader.load('./sprites/cameo-masked.png');
const cameoUnmasked = texLoader.load('./sprites/cameo-unmasked.png');
for (const t of [cameoMasked, cameoUnmasked]) {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
}

/**
 * The cameo card: masked portrait on one face, unmasked on the other, and the
 * reveal is a 180-degree turn.
 *
 * Everything here is built SYMMETRICALLY about z = 0 and the two portraits sit
 * PROUD of the frame on their own sides. The first version stacked the backing
 * plate behind the front portrait, which is fine until the card turns over --
 * then the backing is nearest the camera and the reverse face renders as a
 * blank dark rectangle. A card that flips has no "back".
 */
const CARD_H = kingH * 0.86;
const CARD_W = CARD_H * (96 / 132);
const card = new THREE.Group();
card.visible = false;
{
  const border = CARD_H * 0.055;
  const FACE_Z = 0.009;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W + border * 2, CARD_H + border * 2, FACE_Z * 1.7),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8b45c'), toneMapped: true }));
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W + border * 3.4, CARD_H + border * 3.4, FACE_Z * 1.1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c1730'), toneMapped: true }));

  const faceGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const front = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({
    map: cameoMasked, toneMapped: true, side: THREE.FrontSide,
  }));
  const back = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({
    map: cameoUnmasked, toneMapped: true, side: THREE.FrontSide,
  }));
  front.position.z = FACE_Z;
  back.position.z = -FACE_Z;
  back.rotation.y = Math.PI;

  card.add(backing, frame, front, back);
  card.traverse((o) => { if (o.isMesh) o.renderOrder = 3; });
}
scene.add(card);

/* -------------------------------------------------- warm key + light shafts */

/**
 * The warm key is STATIC, aimed at the middle of the patrol. An earlier version
 * followed the King, which lit him identically everywhere and read as a stage
 * follow-spot. Fixed, he walks into the pool and back out of it, which is both
 * what the reference does and the only thing that makes the patrol feel lit
 * rather than animated.
 */
const keyLight = new THREE.SpotLight(new THREE.Color('#ffc98d'), 62 * CFG.keyLight, 32, 0.30, 0.72, 1.45);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -4e-4;
keyLight.shadow.normalBias = 0.03;
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 40;
{
  const g = groundYAt(CFG.patrolCenterX, CFG.patrolCenterZ);
  keyLight.position.set(CFG.patrolCenterX - 5.4, g + 10.6, CFG.patrolCenterZ + 4.4);
  keyLight.target.position.set(CFG.patrolCenterX + 0.5, g, CFG.patrolCenterZ + 0.6);
}
scene.add(keyLight, keyLight.target);
keyLight.target.updateMatrixWorld();

const shaftGroup = new THREE.Group();
shaftGroup.name = 'light-shafts';
{
  /**
   * A textured cone is not enough: the frustum's own silhouette shows up as a
   * hard band because the alpha does not know where the silhouette is. This
   * material fades the beam out exactly there — alpha falls off with
   * |dot(normal, view)|, so the geometry's edge is always the beam's softest
   * part — and tapers along the beam's length from source to ground.
   */
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffd49a') },
      uStrength: { value: 0.26 * CFG.shafts },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec2 vUvL;
      void main(){
        vUvL = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uStrength;
      varying vec3 vN; varying vec3 vV; varying vec2 vUvL;
      void main(){
        // soft at the silhouette, densest through the middle of the volume
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        // v = 0 at the source end, 1 where the beam meets the ground
        float along = pow(1.0 - vUvL.y, 1.25) * smoothstep(0.0, 0.10, vUvL.y);
        gl_FragColor = vec4(uColor * uStrength * facing * along, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Open-ended cone frusta, not planes. A plane shaft only reads as a beam from
  // the one angle it was authored for; from anywhere else it is a flat
  // rectangle hanging in the air (it read as a column of smoke). A frustum
  // oriented along the light direction reads volumetric from every angle.
  // They start just under the roofline (the facade tops out at y ~ 8.4) so each
  // beam emerges from behind the building and lands on the pavement the King
  // walks. Started higher they hung in open sky, where nothing occludes them
  // and they read as pale streaks rather than light.
  const SHAFTS = [
    { from: [-4.6, 7.1, 3.6], to: [-1.4, 0.2, 2.2], r0: 0.26, r1: 1.05 },
    { from: [-4.4, 7.6, 0.2], to: [-1.9, 0.2, -0.8], r0: 0.20, r1: 0.80 },
    { from: [-4.8, 6.9, -2.6], to: [-1.2, 0.2, -3.0], r0: 0.24, r1: 0.95 },
  ];
  const up = new THREE.Vector3(0, 1, 0);
  for (const s of SHAFTS) {
    const a = new THREE.Vector3(...s.from);
    const b = new THREE.Vector3(...s.to);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(s.r0, s.r1, len, 18, 1, true), shaftMat);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    m.renderOrder = 4;
    shaftGroup.add(m);
  }
}
scene.add(shaftGroup);

/* -------------------------------------------------------------- the passes */

/**
 * BokehPass renders its depth prepass with `scene.overrideMaterial`, which is
 * global — it would flatten the King's alpha-tested quad into a solid
 * rectangle, and every transparent thing in the stage (lamp halos, the shafts)
 * into an opaque wall. Both punch visible artefacts through the blur.
 *
 * So: same pass, but the depth prepass swaps materials PER OBJECT — honouring
 * a per-mesh `userData.hd2dDepthMaterial` — and hides anything that does not
 * belong in a depth buffer (sprites, and materials that opt out of depthWrite).
 */
class SpriteAwareBokehPass extends BokehPass {
  render(renderer, writeBuffer, readBuffer) {
    const swapped = [];
    const hidden = [];
    this.scene.traverse((o) => {
      if (o.isSprite || o.isPoints || o.isLine) {
        if (o.visible) { hidden.push(o); o.visible = false; }
        return;
      }
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || mat.depthWrite === false || o.userData.hd2dNoDepth) {
        if (o.visible) { hidden.push(o); o.visible = false; }
        return;
      }
      swapped.push([o, o.material]);
      o.material = o.userData.hd2dDepthMaterial || this._materialDepth;
    });

    const oldClearColor = new THREE.Color();
    renderer.getClearColor(oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(1.0);
    renderer.setRenderTarget(this._renderTargetDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    for (const [o, m] of swapped) o.material = m;
    for (const o of hidden) o.visible = true;

    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.nearClip.value = this.camera.near;
    this.uniforms.farClip.value = this.camera.far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this._fsQuad.render(renderer);
    }

    renderer.setClearColor(oldClearColor);
    renderer.setClearAlpha(oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: CFG.vignette },
    uGrain: { value: CFG.grain },
    uSat: { value: CFG.saturation },
    uLift: { value: CFG.lift },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uSat, uLift;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec4 c = texture2D(tDiffuse, vUv);

      // split tone: the stage keeps its cold blue shadow, the lamps stay warm
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb * vec3(0.94, 0.98, 1.09), c.rgb * vec3(1.05, 1.00, 0.92),
                  smoothstep(0.12, 0.72, l));

      // Measured against the reference: the low-poly stage's albedos are far
      // more saturated than Octopath's textures, and the shadows there sit in
      // readable mid-tone rather than crushed black. So: pull saturation down
      // and lift the toe.
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += uLift * (1.0 - smoothstep(0.0, 0.35, l)) * vec3(0.72, 0.82, 1.0);

      // gentle S-curve for diorama contrast
      vec3 s = clamp(c.rgb, 0.0, 1.0);
      c.rgb = mix(c.rgb, s * s * (3.0 - 2.0 * s), 0.22);

      // vignette, aspect-corrected so it stays round
      vec2 d = vUv - 0.5;
      d.x *= uResolution.x / max(uResolution.y, 1.0);
      float v = smoothstep(1.02, 0.30, length(d));
      c.rgb *= mix(1.0, v, uVignette);

      // film grain, strongest in the shadows
      float g = hash(vUv * uResolution + fract(uTime * 0.97) * vec2(37.0, 17.0)) - 0.5;
      c.rgb += g * uGrain * (1.0 - 0.55 * l);

      gl_FragColor = vec4(c.rgb, 1.0);
    }
  `,
};

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bokehPass = new SpriteAwareBokehPass(scene, camera, {
  focus: 10, aperture: CFG.aperture, maxblur: CFG.maxblur,
});
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), CFG.bloom, CFG.bloomRadius, CFG.bloomThreshold);
const outputPass = new OutputPass();
const gradePass = new ShaderPass(GradeShader);
composer.addPass(renderPass);
composer.addPass(bokehPass);
composer.addPass(bloomPass);
composer.addPass(outputPass);
composer.addPass(gradePass);

/* -------------------------------------------------------------- the patrol */

const axis = THREE.MathUtils.degToRad(CFG.patrolAxis);
const patrolDir = new THREE.Vector3(Math.sin(axis), 0, Math.cos(axis));
const patrolCenter = new THREE.Vector3(CFG.patrolCenterX, 0, CFG.patrolCenterZ);

const state = {
  t: 0,             // signed distance along the patrol axis
  dir: 1,
  pause: 0,
  frame: 0,
  frameClock: 0,
  stopped: false,
  card: 0,          // 0..1 reveal
  cardFlip: 0,      // 0 = masked, 1 = unmasked
  cardSince: 0,
};

function kingPosition() {
  const p = patrolCenter.clone().addScaledVector(patrolDir, state.t);
  p.y = groundYAt(p.x, p.z);
  return p;
}

function setFrame(cell) {
  sheetTex.offset.x = cell / SHEET.cells;
}

/* ------------------------------------------------------------------ camera */

function placeCamera() {
  const az = THREE.MathUtils.degToRad(CFG.camAzimuth);
  const el = THREE.MathUtils.degToRad(CFG.camElevation);
  // Aim at the patrol, not at the diorama's centroid: the centroid sits inside
  // the floating rock, which framed the King off the bottom of the picture.
  const ground = groundYAt(CFG.patrolCenterX, CFG.patrolCenterZ);
  const target = new THREE.Vector3(
    CFG.patrolCenterX + CFG.camTargetX,
    ground + CFG.camTargetY,
    CFG.patrolCenterZ + CFG.camTargetZ
  );
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * CFG.camDist,
    target.y + Math.sin(el) * CFG.camDist,
    target.z + Math.cos(az) * Math.cos(el) * CFG.camDist
  );
  camera.lookAt(target);
  camera.fov = CFG.fov;
  camera.near = Math.max(0.5, CFG.camDist - stageSize.length());
  camera.far = CFG.camDist + stageSize.length() * 2;
  camera.updateProjectionMatrix();
  camera.userData.target = target;
}

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  placeCamera();
  bokehPass.uniforms.aspect.value = camera.aspect;
  bloomPass.setSize(w, h);
  gradePass.uniforms.uResolution.value.set(w, h);
}
addEventListener('resize', resize);

/* --------------------------------------------------------------- interaction */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hitProxy = new THREE.Mesh(
  new THREE.BoxGeometry(kingH * 0.8, kingH, kingH * 0.8),
  new THREE.MeshBasicMaterial({ visible: false })
);
hitProxy.userData.hd2dNoDepth = true;
hitProxy.visible = true;
hitProxy.material.depthWrite = false;
scene.add(hitProxy);

function onClick(ev) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(hitProxy, false).length > 0;
  if (hit || state.stopped) toggle();
}
function toggle() {
  state.stopped = !state.stopped;
  if (state.stopped) { state.cardSince = 0; state.cardFlip = 0; }
  hint.textContent = state.stopped ? 'click again to send him on his way'
                                   : 'click the King';
}
canvas.addEventListener('pointerdown', onClick);

const hint = document.getElementById('hint');

/* ------------------------------------------------------------------- loop */

const clock = new THREE.Clock();
let fpsAccum = 0, fpsFrames = 0, fps = 0;

function update(dt) {
  // --- patrol
  if (!state.stopped) {
    if (state.pause > 0) {
      state.pause -= dt;
      state.frame = 0;                 // idle stance while he pauses
    } else {
      state.t += CFG.walkSpeed * state.dir * dt;
      if (Math.abs(state.t) >= CFG.patrolHalf) {
        state.t = Math.sign(state.t) * CFG.patrolHalf;
        state.dir *= -1;
        state.pause = CFG.pauseAtEnds;
      }
      state.frameClock += dt * CFG.walkFps;
      state.frame = WALK_FRAMES[Math.floor(state.frameClock) % WALK_FRAMES.length];
    }
  } else {
    state.frame = 0;
  }
  setFrame(FRAME === null ? state.frame : FRAME);

  // --- place him, billboard yaw-only, flip for travel direction
  const pos = kingPosition();
  king.position.copy(pos);
  const yaw = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
  king.rotation.set(0, yaw, 0);
  // The sheet is drawn facing screen-left; mirror the quad when he walks the
  // other way. Negative scale flips winding, which is why the material is
  // DoubleSide. He keeps his last heading while stopped.
  king.scale.x = state.dir > 0 ? -1 : 1;

  blob.position.set(pos.x, pos.y + 0.012, pos.z);
  hitProxy.position.set(pos.x, pos.y + kingH * 0.5, pos.z);

  // --- focus tracks the King so the diorama falls away around him
  let focusDist = camera.position.distanceTo(
    new THREE.Vector3(pos.x, pos.y + kingH * 0.5, pos.z)) + CFG.focusOffset;

  // --- cameo card
  const targetCard = state.stopped ? 1 : 0;
  state.card += (targetCard - state.card) * Math.min(1, dt * 7);
  if (state.stopped) {
    state.cardSince += dt;
    if (state.cardSince > 1.15) state.cardFlip = Math.min(1, state.cardFlip + dt * 1.6);
  }
  card.visible = state.card > 0.01;
  if (card.visible) {
    const rise = kingH * (1.30 + 0.22 * state.card);
    card.position.set(pos.x, pos.y + rise + Math.sin(clock.elapsedTime * 1.6) * 0.03, pos.z);
    const s = THREE.MathUtils.smoothstep(state.card, 0, 1);
    card.scale.setScalar(0.08 + s * 0.92);
    const flip = THREE.MathUtils.smoothstep(state.cardFlip, 0, 1) * Math.PI;
    card.rotation.set(0, yaw + flip, 0);
    // The card floats above his head, which at this camera elevation puts it
    // over a unit nearer the lens than he is — enough for the DoF to soften the
    // portrait to mush. Pull focus onto it as it rises.
    focusDist = THREE.MathUtils.lerp(
      focusDist, camera.position.distanceTo(card.position), s);
  }
  bokehPass.uniforms.focus.value = focusDist;

  if (stage.userData.tick) stage.userData.tick(dt);
  gradePass.uniforms.uTime.value = clock.elapsedTime;
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (!PAUSED) update(dt); else update(0);
  composer.render();
  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { fps = fpsFrames / fpsAccum; fpsAccum = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}

resize();
if (SHOW_CARD) { state.stopped = true; state.card = 1; state.cardFlip = 1; }
update(0);
frame();

/* ------------------------------------------------------- probe for tooling */

window.__hd2d = {
  THREE, scene, camera, renderer, composer, king, card, CFG, state, stage,
  groundYAt,
  groundGrid: (x0, x1, z0, z1, step = 0.5) => {
    const rows = [];
    for (let z = z0; z <= z1 + 1e-6; z += step) {
      const row = [];
      for (let x = x0; x <= x1 + 1e-6; x += step) {
        row.push(Math.round(groundYAt(x, z) * 100) / 100);
      }
      rows.push({ z: Math.round(z * 100) / 100, y: row });
    }
    return { x0, x1, step, rows };
  },
  fps: () => fps,
  report: () => ({
    stageBox: { min: stageBox.min.toArray(), max: stageBox.max.toArray() },
    stageSize: stageSize.toArray(),
    stageCenter: stageCenter.toArray(),
    camera: { pos: camera.position.toArray(), target: camera.userData.target.toArray(), fov: camera.fov },
    king: { pos: king.position.toArray(), height: kingH, screen: toScreen(king.position) },
    kingHead: toScreen(new THREE.Vector3(king.position.x, king.position.y + kingH, king.position.z)),
    focus: bokehPass.uniforms.focus.value,
    groundY: groundYAt(CFG.patrolCenterX, CFG.patrolCenterZ),
    fps,
  }),
  setState: (k, v) => { state[k] = v; },
};
function toScreen(v) {
  const p = v.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * canvas.clientWidth, (-p.y * 0.5 + 0.5) * canvas.clientHeight];
}
