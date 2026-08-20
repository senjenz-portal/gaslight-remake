/**
 * createCaveScene.js — procedural Three.js FULL-3D SET
 * The Polyphemus cave diorama (cave-shut state) as native geometry.
 *
 * Built with the img2threejs skill (~/.claude/skills/img2threejs) from the reference plate
 *   ../../assets/set/cave/cave-shut.jpg
 * through the staged pipeline blockout -> structural -> form -> material -> lighting,
 * each pass screenshot-reviewed against the plate. The authoritative reconstruction record
 * is tools/full3d-forge/object-sculpt-spec.json (38 components, 21 materials, 9 repetition
 * systems, reviewHistory) on the project-source side; the generated blockout skeleton is
 * tools/full3d-forge/src/createObjectModel.ts. This file is the hand-carried factory:
 * the register-specific systems (crack-free hash-jitter facets, cutaway face deletion,
 * the seeded GPU particle fire, instanced dressing) cannot come from the generator.
 *
 * THE FLOOR PLAN IS THE LEDGER. Every transform derives from tools/ody/ledger.json
 * (sets.cave, plate px, 43 px/m off the penned ewes) through the shared world frame:
 *   X(px) = (px - 704) / 43            metres, +east
 *   Z(py) = (py - 460) / (43·sin 25°)  metres, +downstage (fire-pit row = 0)
 *   Y up, walkable floor = 0 exactly (the path law needs a true plane).
 * The 25° comes from the fire-ring ellipse the plate itself paints (82/206 px).
 *
 * DETERMINISM LAW: every scatter/jitter is mulberry32-seeded; the fire is three GPU
 * point systems whose positions are PURE functions of (seed attributes, uTime) — no
 * state, no wall clock. tick(simT) drives uniforms + flicker only. setSim-safe.
 *
 * Exports
 *   createCaveScene()                -> { root, tick(simT), fireLight, parts, triangles }
 *   createCaveIsoCamera(aspect)      -> OrthographicCamera + .userData.setOrbit(azimuthDeg)
 *   CAVE_WORLD                       -> { S, SIN_E, X(), Z(), PATH_PTS, OBSTACLES }
 */
import * as THREE from 'three';

/* ---------------- world frame (the ledger's plan) ---------------- */
const S = 43;                              /* px per metre — the penned ewes */
const ELEV = THREE.MathUtils.degToRad(25); /* the fire-ring ellipse's own angle */
const SIN_E = Math.sin(ELEV);
const X = (px) => (px - 704) / S;
const Z = (py) => (py - 460) / (S * SIN_E);
const M = (px) => px / S;

/* the audited demo3d walk path — same plate px, same tension (parking law holds) */
const PATH_PTS = [
  [250, 452], [360, 450], [450, 425], [500, 409], [600, 402], [705, 401],
  [762, 419], [774, 458], [782, 505], [762, 528], [700, 534], [648, 537],
  [668, 549], [730, 554], [820, 557], [900, 551], [962, 546], [1015, 538],
];
/* every ledger obstacle box, plate px — the 3D obstacle law reads these */
const OBSTACLES = {
  mouthAperture: [[290, 250], [405, 415]],
  rackA: [[535, 195], [625, 385]], rackB: [[638, 160], [712, 345]],
  rackC: [[716, 135], [792, 340]], rackD: [[800, 130], [880, 330]],
  floorCheeses: [[600, 342], [665, 390]],
  fireRingOuter: [[527, 418], [733, 500]], fireRingRimNW: [[485, 425], [527, 485]],
  firewood: [[495, 495], [620, 555]], logBundle: [[645, 462], [745, 497]],
  mainPen: [[775, 290], [1050, 425]], frontPen: [[860, 425], [1090, 525]],
  bed: [[1025, 330], [1240, 500]], milkTub: [[865, 470], [915, 520]],
  clayBowl: [[805, 505], [860, 535]], logsRight: [[1105, 480], [1180, 520]],
};
export const CAVE_WORLD = { S, SIN_E, ELEV, X, Z, PATH_PTS, OBSTACLES };

/* ---------------- deterministic RNG + facet helpers ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* crack-free jitter: offset is a hash of the QUANTISED vertex position, so shared
   positions (even across duplicated non-indexed verts) move together — no holes */
function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (Math.round(x * 97) & 0xffff), 2654435761);
  h = Math.imul(h ^ (Math.round(y * 97) & 0xffff), 2246822519);
  h = Math.imul(h ^ (Math.round(z * 97) & 0xffff), 3266489917);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function jitterByPos(geo, seed, amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (hash3(x, y, z, seed) - 0.5) * 2 * amp,
      y + (hash3(x, y, z, seed + 1) - 0.5) * 2 * amp,
      z + (hash3(x, y, z, seed + 2) - 0.5) * 2 * amp);
  }
  p.needsUpdate = true;
  return geo;
}
/* per-face value jitter -> painterly facets (vertex colors, flat by construction) */
function facetColors(geo, baseHex, seed, amount = 0.10) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const base = new THREE.Color(baseHex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const rnd = mulberry32(seed);
  for (let f = 0; f < n / 3; f++) {
    const v = 1 + (rnd() - 0.5) * 2 * amount;
    for (let k = 0; k < 3; k++) {
      col[(f * 3 + k) * 3 + 0] = base.r * v;
      col[(f * 3 + k) * 3 + 1] = base.g * v;
      col[(f * 3 + k) * 3 + 2] = base.b * v;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/* delete triangles by centroid predicate (the cutaway — face deletion, never a boolean) */
function dropFaces(geo, keep) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const kept = [];
  const c = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++)
      c.add(new THREE.Vector3(p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)));
    c.multiplyScalar(1 / 3);
    if (keep(c)) kept.push(f);
  }
  const out = new Float32Array(kept.length * 9);
  kept.forEach((f, i) => {
    for (let k = 0; k < 3; k++) {
      out[(i * 3 + k) * 3 + 0] = p.getX(f * 3 + k);
      out[(i * 3 + k) * 3 + 1] = p.getY(f * 3 + k);
      out[(i * 3 + k) * 3 + 2] = p.getZ(f * 3 + k);
    }
  });
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return ng;
}
const flatMat = (opts = {}) => new THREE.MeshStandardMaterial({
  flatShading: true, metalness: 0, roughness: 0.95, ...opts });

/* radial-gradient sprite canvas (halos, particle discs) */
function glowTexture(inner = 'rgba(255,220,140,1)', outer = 'rgba(255,150,40,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- the seeded GPU particle fire ---------------- */
/* position/size/colour are computed IN THE VERTEX SHADER from per-particle seed
   attributes + uTime: pure f(t), deterministic, zero per-frame CPU work. */
const PX_UNIFORM = { value: 34 };          /* canvas px per world metre (ortho) — page-driven */
function fireSystem({ count, seed, radius, height, size, mode }) {
  const rnd = mulberry32(seed);
  const a0 = new Float32Array(count), r0 = new Float32Array(count),
        ph = new Float32Array(count), sp = new Float32Array(count),
        lf = new Float32Array(count), hm = new Float32Array(count),
        sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    a0[i] = rnd() * Math.PI * 2;
    r0[i] = Math.sqrt(rnd()) * radius;
    ph[i] = rnd() * 10;
    sp[i] = 0.75 + rnd() * 0.6;
    lf[i] = 0.9 + rnd() * 0.7;
    hm[i] = height * (0.7 + rnd() * 0.6);
    sz[i] = size * (0.6 + rnd() * 0.8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('a0', new THREE.BufferAttribute(a0, 1));
  g.setAttribute('r0', new THREE.BufferAttribute(r0, 1));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('sp', new THREE.BufferAttribute(sp, 1));
  g.setAttribute('lf', new THREE.BufferAttribute(lf, 1));
  g.setAttribute('hm', new THREE.BufferAttribute(hm, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.6, 0), height * 1.6 + radius);
  const MODE = { flame: 0, ember: 1, smoke: 2 }[mode];
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTexture() }, uPx: PX_UNIFORM },
    transparent: true, depthWrite: false,
    blending: MODE === 2 ? THREE.NormalBlending : THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPx;
      attribute float a0, r0, ph, sp, lf, hm, sz;
      varying float vU; varying float vTw;
      void main(){
        float u = mod(uTime * sp + ph, lf) / lf;      /* life fraction, pure f(t) */
        vU = u;
        float ang = a0 + u * (1.8 + sp);              /* swirl */
        float r = r0 * (1.0 - u * ${MODE === 2 ? '0.15' : '0.75'});
        vec3 p = vec3(cos(ang) * r, u * hm, sin(ang) * r * 0.92);
        ${MODE === 1 ? 'p.x += sin(u*9.0+ph)*0.12; p.z += cos(u*7.0+ph)*0.12;' : ''}
        ${MODE === 2 ? 'p.x += u*u*0.9; p.z -= u*0.15;' : ''}
        vTw = sin(uTime * (6.0 + sp * 4.0) + ph * 7.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        /* sz is a WORLD diameter in metres; uPx converts to pixels (ortho: no z term) */
        float s = sz * ${MODE === 0 ? '(1.0 - u * 0.72)' : MODE === 1 ? '(1.0 - u * 0.5)' : '(0.5 + u * 1.7)'};
        gl_PointSize = max(1.0, s * uPx);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vU; varying float vTw;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        ${MODE === 0 ? `
        vec3 col = mix(vec3(1.0,0.88,0.45), vec3(1.0,0.45,0.12), smoothstep(0.15,0.75,vU));
        col = mix(col, vec3(0.75,0.16,0.05), smoothstep(0.75,1.0,vU));
        float a = tex.a * (1.0 - vU) * 0.9;` : MODE === 1 ? `
        vec3 col = mix(vec3(1.0,0.75,0.3), vec3(1.0,0.4,0.1), vU);
        float a = tex.a * (0.55 + 0.45 * vTw) * (1.0 - vU * vU);` : `
        vec3 col = vec3(0.42,0.44,0.52);
        float a = tex.a * 0.14 * (1.0 - abs(vU * 2.0 - 1.0));`}
        gl_FragColor = vec4(col, a);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = true;
  return pts;
}

/* ---------------- the factory ---------------- */
export function createCaveScene() {
  const root = new THREE.Group();
  root.name = 'polyphemus-cave-diorama';
  const parts = {};
  const track = (name, obj) => { obj.name = name; parts[name] = obj; root.add(obj); return obj; };
  const tickers = [];

  /* ===== MACRO: sky dome (gradient + stars) ===== */
  {
    const g = new THREE.SphereGeometry(90, 24, 16);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#141f38'), hor = new THREE.Color('#0c1e2c');
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 90 * 0.5 + 0.5, 0, 1);
      const c = hor.clone().lerp(top, t);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10;
    track('sky', sky);

    const rnd = mulberry32(90904);
    const N = 220, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = rnd() * Math.PI * 2, el = Math.asin(0.08 + rnd() * 0.9);
      sp[i * 3] = 82 * Math.cos(el) * Math.sin(az);
      sp[i * 3 + 1] = 82 * Math.sin(el);
      sp[i * 3 + 2] = 82 * Math.cos(el) * Math.cos(az);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: '#e8eeff', size: 0.55, sizeAttenuation: true, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, depthWrite: false }));
    track('star-points', stars);
  }

  /* ===== MACRO: floating island under-rock ===== */
  {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y >= 0) { y *= 0.045; }                    /* flat top JUST under the floor */
      else { const d = -y; x *= (1 - 0.62 * d); z *= (1 - 0.62 * d); y *= 1.05; }
      p.setXYZ(i, x * 16.8, y * 9.0, z * 11.2);
    }
    jitterByPos(g, 90901, 0.55);
    const geo = facetColors(g, '#46506a', 90901, 0.16);
    const rock = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
    rock.position.set(0.6, -0.42, -1.2);
    track('island-rock', rock);
  }

  /* ===== MACRO: floor disc + apron (flat walkable sand at y=0) ===== */
  {
    const g = new THREE.RingGeometry(0.02, 1, 44, 5);
    g.rotateX(-Math.PI / 2);
    const geo = facetColors(g, '#8a6a4a', 90911, 0.09);
    geo.scale(14.6, 1, 9.6);
    const sand = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 1 }));
    sand.position.set(0.6, 0, -0.9);
    sand.receiveShadow = true;
    track('island-top', sand);
    /* mossy apron ring, a hand under the sand rim */
    const ag = new THREE.RingGeometry(0.78, 1.12, 40, 2);
    ag.rotateX(-Math.PI / 2);
    const ageo = facetColors(ag, '#4c5a44', 90912, 0.14);
    ageo.scale(15.4, 1, 10.4);
    const apron = new THREE.Mesh(ageo, flatMat({ vertexColors: true }));
    apron.position.set(0.6, -0.12, -0.9);
    track('moss-apron', apron);
  }

  /* ===== MACRO: cave dome shells (outer cool / inner warm), cutaway by face drop ===== */
  const DOME = { cx: 0.8, cz: -2.2, rx: 14.8, ry: 9.6, rz: 9.4 };
  {
    const keepDome = (lipY, flankX) => (c) => {
      /* c in unit-sphere space. The cutaway: the whole front face opens to the
         viewer; only the high crown lip (the overhang) and the curving flank
         walls survive in front of the mid-plane — the plate's arch read.
         THE COVERAGE LAW: the OUTER shell is cut harder than the inner, so any
         surviving outer face has warm inner shell lining the sightline behind
         it — no cool backfaces read as ceiling. */
      if (c.y < -0.02) return false;                     /* below ground */
      if (c.z <= 0.02) return true;                      /* back half intact */
      if (c.y > lipY + 0.10 * c.z) return true;          /* crown overhang */
      /* asymmetric flanks: the west side opens WIDE on BOTH shells (identical cut
         = no seam band to leak) so the ledger's shut boulder reads at the book
         framing; a solid rock stack plugs the west gap from every azimuth. The
         east stays sealed (the 90-deg hole fix). */
      const fx = c.x < 0 ? 0.93 : flankX;
      if (Math.abs(c.x) > fx - 0.18 * c.z) return true;  /* flank walls */
      return false;
    };
    const mk = (rx, ry, rz, seed, hex, side, warmUnderside, lipY = 0.60, flankX = 0.74) => {
      let g = new THREE.IcosahedronGeometry(1, 3);
      g = dropFaces(g, keepDome(lipY, flankX));
      g.scale(rx, ry, rz);
      jitterByPos(g, seed, 0.42);
      const geo = facetColors(g, hex, seed, 0.13);
      if (warmUnderside) {
        /* the whole front lip band + any down-facing facet is the visible arch rim:
           paint it the fire-warmed interior brown so its backfaces never read navy
           (the plate's own warm rim above the opening) */
        const pos = geo.attributes.position, col = geo.attributes.color;
        const warm = new THREE.Color('#6b4a33'), a = new THREE.Vector3(),
              b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        for (let f = 0; f < pos.count / 3; f++) {
          a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
          c.fromBufferAttribute(pos, f * 3 + 2);
          const cy = (a.y + b.y + c.y) / (3 * ry), cz = (a.z + b.z + c.z) / (3 * rz);
          n.copy(b).sub(a).cross(new THREE.Vector3().copy(c).sub(a));
          const down = n.y < -0.05 * n.length();
          const lipBand = cz > 0.02 && cy < 0.86;
          if (down || lipBand) {
            const v = 0.8 + hash3(a.x, a.y, a.z, seed + 7) * 0.35;
            for (let k = 0; k < 3; k++)
              col.setXYZ(f * 3 + k, warm.r * v, warm.g * v, warm.b * v);
          }
        }
        col.needsUpdate = true;
      }
      const m = new THREE.Mesh(geo, flatMat({ vertexColors: true, side }));
      m.position.set(DOME.cx, 0, DOME.cz);
      return m;
    };
    const outer = mk(DOME.rx, DOME.ry, DOME.rz, 90902, '#4e5870', THREE.DoubleSide, true, 0.70, 0.84);
    outer.castShadow = false;
    track('cave-shell-outer', outer);
    const inner = mk(DOME.rx - 0.55, DOME.ry - 0.4, DOME.rz - 0.55, 90903, '#7d5a3e', THREE.DoubleSide, false, 0.62, 0.58);
    inner.receiveShadow = true;
    track('cave-shell-inner', inner);
  }

  /* ===== MESO: mouth arch + THE BOULDER, SHUT ===== */
  {
    const grp = new THREE.Group();
    const rnd = mulberry32(90905);
    /* jamb rocks on a half-ring facing the camera, proud of the west interior wall */
    const arch = new THREE.Group();
    const AR = 2.75;
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, ang = Math.PI * t;
      const g = jitterByPos(new THREE.IcosahedronGeometry(0.9, 1), 90905 + i, 0.22);
      const geo = facetColors(g, '#43331f', 90920 + i, 0.15);
      const rockM = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
      rockM.position.set(Math.cos(ang) * AR, Math.sin(ang) * AR * 0.85 + 0.2, (rnd() - 0.5) * 0.5);
      rockM.scale.set(0.72 + rnd() * 0.4, 0.65 + rnd() * 0.4, 0.65);
      rockM.castShadow = true;
      arch.add(rockM);
    }
    grp.add(arch);
    /* the boulder: one faceted ovoid seated INTO the arch */
    const bg = jitterByPos(new THREE.IcosahedronGeometry(1, 2), 90906, 0.13);
    const bgeo = facetColors(bg, '#8a7a66', 90906, 0.12);
    const boulder = new THREE.Mesh(bgeo, flatMat({ vertexColors: true }));
    boulder.scale.set(2.6, 2.45, 1.35);
    boulder.position.set(0, 2.2, 0.9);
    boulder.rotation.z = 0.12;
    boulder.castShadow = true;
    boulder.name = 'boulder-shut';
    grp.add(boulder);
    grp.position.set(X(347), 0, Z(430) - 1.6);
    grp.rotation.y = 0.5;               /* the mouth faces south-east, as painted */
    /* the west rock stack: solid boulders plugging the widened west cut — the
       plate's own left rock mass; solid geometry cannot leak sightlines */
    const stackR = mulberry32(90955);
    [[-2.4, 0.0, 1.6, 2.6], [-3.4, 1.8, 2.2, 2.3], [-1.9, 3.3, 2.8, 2.0],
     [-4.3, 0.2, 3.4, 2.2], [-3.0, 4.6, 3.4, 1.7], [-4.6, 2.6, 4.2, 1.9],
     [-1.2, 5.4, 3.2, 1.5]].forEach(([dx, dy, dz, sc], i) => {
      const rg = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 90955 + i, 0.14);
      const rgeo = facetColors(rg, i % 2 ? '#4e5870' : '#5a4a3a', 90955 + i, 0.14);
      const rock = new THREE.Mesh(rgeo, flatMat({ vertexColors: true }));
      rock.scale.set(sc, sc * (0.75 + stackR() * 0.3), sc * 0.85);
      rock.position.set(dx - 1.2, dy, dz - 0.4);
      rock.castShadow = true;
      grp.add(rock);
    });
    track('mouth-and-boulder', grp);
    /* exterior plug rocks (world space) — the plate's mouth-side stones; they
       close the last 270-deg sightline past the stack */
    const plugs = new THREE.Group();
    [[-9.8, 0.6, 1.9, 2.4], [-10.9, 0.3, -0.3, 2.1], [-9.0, 2.7, 1.1, 1.9],
     [-11.6, 0.2, 1.4, 1.6]].forEach(([px, py, pz, sc], i) => {
      const rg = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 90985 + i, 0.13);
      const rgeo = facetColors(rg, i % 2 ? '#56607a' : '#5a4a3a', 90985 + i, 0.14);
      const rock = new THREE.Mesh(rgeo, flatMat({ vertexColors: true }));
      rock.scale.set(sc, sc * 0.85, sc * 0.8);
      rock.position.set(px, py, pz);
      rock.castShadow = true;
      plugs.add(rock);
    });
    track('mouth-plug-rocks', plugs);
  }

  /* ===== MESO: cheese racks A..D + wheels (instanced) ===== */
  {
    const racks = new THREE.Group();
    const timber = flatMat({ color: '#6e4a2a' });
    const timberDark = flatMat({ color: '#4e3420' });
    const RACKS = [
      { x: X(580), z: Z(392), w: M(90), h: 4.4 },
      { x: X(675), z: Z(355), w: M(74), h: 4.3 },
      { x: X(754), z: Z(350), w: M(76), h: 4.75 },
      { x: X(840), z: Z(342), w: M(80), h: 4.65 },
    ];
    const postG = new THREE.BoxGeometry(0.14, 1, 0.14);
    const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10);
    const wheels = [];
    const rnd = mulberry32(91001);
    const TONES = ['#e8a820', '#cc7d14', '#f0c452'].map((h) => new THREE.Color(h));
    for (const r of RACKS) {
      const g = new THREE.Group();
      for (const dx of [-r.w / 2, r.w / 2]) for (const dz of [-0.42, 0.42]) {
        const post = new THREE.Mesh(postG, timber);
        post.scale.y = r.h;
        post.position.set(dx, r.h / 2, dz);
        post.castShadow = true;
        g.add(post);
      }
      const SHELVES = 5;
      for (let s = 0; s < SHELVES; s++) {
        const y = 0.5 + (s / (SHELVES - 1)) * (r.h - 0.9);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.22, 0.08, 0.95), timberDark);
        shelf.position.set(0, y, 0);
        shelf.castShadow = true;
        g.add(shelf);
        const n = 2 + ((s + RACKS.indexOf(r)) % 2);
        for (let k = 0; k < n; k++) {
          wheels.push({
            x: r.x + (-r.w / 2 + 0.45 + k * ((r.w - 0.9) / Math.max(1, n - 1))) + (rnd() - 0.5) * 0.1,
            y: y + 0.12, z: r.z + (rnd() - 0.5) * 0.3,
            s: 0.85 + rnd() * 0.5, tone: TONES[(rnd() * 3) | 0],
          });
        }
      }
      /* loose wheels on top */
      wheels.push({ x: r.x - r.w * 0.2, y: r.h + 0.1, z: r.z, s: 1.1, tone: TONES[0] });
      g.position.set(r.x, 0, r.z);
      g.castShadow = true;
      racks.add(g);
    }
    const wheelIM = new THREE.InstancedMesh(wheelG, flatMat({ color: '#ffffff', roughness: 0.7 }), wheels.length);
    const m4 = new THREE.Matrix4();
    wheels.forEach((w, i) => {
      m4.makeScale(w.s, w.s, w.s).setPosition(w.x, w.y, w.z);
      wheelIM.setMatrixAt(i, m4);
      wheelIM.setColorAt(i, w.tone);
    });
    wheelIM.castShadow = true;
    racks.add(wheelIM);
    wheelIM.name = 'cheese-wheels';
    parts['cheese-wheels'] = wheelIM;
    track('cheese-racks', racks);

    /* floor cheeses at rack A's foot */
    const st = new THREE.Group();
    const fcRnd = mulberry32(91011);
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(wheelG, flatMat({ color: ['#e8b83a', '#d99027', '#f4d372'][i % 3], roughness: 0.7 }));
      w.position.set(X(632) + (fcRnd() - 0.5) * 0.8, 0.09 + (i > 2 ? 0.17 : 0), Z(384) + (fcRnd() - 0.5) * 0.5);
      w.rotation.y = fcRnd() * Math.PI;
      w.castShadow = true;
      st.add(w);
    }
    track('floor-cheese-stack', st);
  }

  /* ===== MESO: fire pit — ring stones, embers, logs, THE BLAZE ===== */
  const FIRE = { x: X(630), z: Z(460) };
  {
    const grp = new THREE.Group();
    /* stone ring (instanced) + NW spill pair (ledger rimNW) */
    const rnd = mulberry32(91002);
    const stoneG = jitterByPos(new THREE.IcosahedronGeometry(0.3, 1), 91002, 0.07);
    stoneG.computeVertexNormals();
    const N = 18;
    const ringIM = new THREE.InstancedMesh(stoneG, flatMat({ color: '#9a9aa2' }), N + 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 2.05 + (rnd() - 0.5) * 0.16;
      e.set(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.6);
      q.setFromEuler(e);
      m4.compose(
        new THREE.Vector3(Math.cos(a) * r * 1.12, 0.16, Math.sin(a) * r * 0.88),
        q, new THREE.Vector3(1 + rnd() * 0.7, 0.8 + rnd() * 0.5, 0.9 + rnd() * 0.5));
      ringIM.setMatrixAt(i, m4);
      ringIM.setColorAt(i, col.set('#8a8a92').multiplyScalar(0.85 + rnd() * 0.3));
    }
    /* the NW spill (plate px ~500,455 relative to pit centre 630,460) */
    [[X(505) - FIRE.x, Z(452) - FIRE.z], [X(516) - FIRE.x, Z(472) - FIRE.z]].forEach((p, k) => {
      e.set(0.3, rnd() * Math.PI, 0.2); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p[0], 0.14, p[1]), q, new THREE.Vector3(1.2, 0.8, 1));
      ringIM.setMatrixAt(N + k, m4);
      ringIM.setColorAt(N + k, col.set('#7e7e88'));
    });
    ringIM.castShadow = true;
    ringIM.name = 'ring-stones';
    parts['ring-stones'] = ringIM;
    grp.add(ringIM);
    /* pit floor + ember bed (radial emissive gradient by vertex colour) */
    const pg = new THREE.CircleGeometry(1.75, 20);
    pg.rotateX(-Math.PI / 2);
    const pit = new THREE.Mesh(pg, flatMat({ color: '#4a382a' }));
    pit.position.y = 0.02;
    grp.add(pit);
    const eg = new THREE.CircleGeometry(1.45, 18).toNonIndexed();
    eg.rotateX(-Math.PI / 2);
    const ep = eg.attributes.position, ec = new Float32Array(ep.count * 3);
    const hot = new THREE.Color('#ff9a3a'), cool = new THREE.Color('#7a2408');
    for (let i = 0; i < ep.count; i++) {
      const d = Math.hypot(ep.getX(i), ep.getZ(i)) / 1.45;
      const c = hot.clone().lerp(cool, d);
      ec.set([c.r, c.g, c.b], i * 3);
    }
    eg.setAttribute('color', new THREE.BufferAttribute(ec, 3));
    const emberMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const embed = new THREE.Mesh(eg, emberMat);
    embed.position.y = 0.05;
    grp.add(embed);
    tickers.push((t, f) => { emberMat.color.setScalar(0.7 + 0.5 * f); });
    /* three crossed burning logs */
    const logG = new THREE.CylinderGeometry(0.13, 0.16, 1.5, 7);
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(logG, flatMat({ color: '#3a281e', emissive: '#7a2408', emissiveIntensity: 1.25 }));
      log.rotation.set(Math.PI / 2 - 0.5, (i / 3) * Math.PI * 2, 0, 'YXZ');
      log.position.y = 0.32;
      log.castShadow = true;
      grp.add(log);
    }
    /* THE BLAZE: flames + embers + smoke, all pure f(uTime) */
    const flames = fireSystem({ count: 220, seed: 90906, radius: 0.5, height: 2.6, size: 0.62, mode: 'flame' });
    const embers = fireSystem({ count: 70, seed: 90956, radius: 0.45, height: 3.5, size: 0.11, mode: 'ember' });
    const smoke = fireSystem({ count: 36, seed: 90976, radius: 0.5, height: 4.4, size: 1.25, mode: 'smoke' });
    smoke.position.y = 1.2;
    grp.add(flames, embers, smoke);
    tickers.push((t) => {
      flames.material.uniforms.uTime.value = t;
      embers.material.uniforms.uTime.value = t;
      smoke.material.uniforms.uTime.value = t * 0.5;
    });
    /* blaze halo sprite (the plate's bloom read) */
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,190,90,0.55)', 'rgba(255,120,30,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(6.0);
    halo.position.y = 1.3;
    grp.add(halo);
    tickers.push((t, f) => { halo.material.opacity = 0.5 + 0.45 * (f - 0.84); });
    grp.position.set(FIRE.x, 0, FIRE.z);
    track('fire-pit', grp);
  }

  /* ===== the flickering fire light — THE one shadow caster ===== */
  const fireLight = new THREE.PointLight('#ffbf4a', 330, 0, 2);
  fireLight.position.set(FIRE.x, 1.8, FIRE.z + 0.4);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(1024, 1024);
  fireLight.shadow.camera.near = 0.3;
  fireLight.shadow.camera.far = 40;
  fireLight.shadow.bias = -0.004;
  root.add(fireLight);
  /* the fire's ceiling bounce — unshadowed, broad falloff; what makes the vault read */
  const bounce = new THREE.PointLight('#ff9a4a', 115, 0, 1.6);
  bounce.position.set(FIRE.x, 5.4, FIRE.z + 0.6);
  root.add(bounce);
  tickers.push((t, f) => { bounce.intensity = 115 * (0.7 + 0.3 * f); });
  const flick = (t) =>
    0.84 + 0.11 * Math.sin(2 * Math.PI * t / 3.1)
         + 0.05 * Math.sin(2 * Math.PI * t / 0.47 + 1.7)
         + 0.04 * Math.sin(2 * Math.PI * t / 1.13 + 0.6);
  tickers.push((t, f) => { fireLight.intensity = 330 * f; });

  /* ===== MESO: wood piles (instanced logs) ===== */
  {
    const logG = new THREE.CylinderGeometry(0.12, 0.135, 1, 7);
    logG.rotateZ(Math.PI / 2);
    const PILES = [
      { id: 'firewood-pile', cx: X(558), cz: Z(545), rows: [7, 6, 5], len: 1.5, ry: 0.5 },
      { id: 'log-bundle', cx: X(695), cz: Z(492), rows: [6, 4], len: 1.35, ry: 0.15 },
      { id: 'logs-right', cx: X(1142), cz: Z(512), rows: [4, 2], len: 1.4, ry: 0.3 },
    ];
    const total = PILES.reduce((n, p) => n + p.rows.reduce((a, b) => a + b, 0), 0);
    const im = new THREE.InstancedMesh(logG, flatMat({ color: '#6b4a35' }), total);
    const rnd = mulberry32(91006);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let i = 0;
    for (const p of PILES) {
      p.rows.forEach((n, row) => {
        for (let k = 0; k < n; k++) {
          e.set(0, p.ry + (rnd() - 0.5) * 0.18, 0);
          q.setFromEuler(e);
          m4.compose(
            new THREE.Vector3(
              p.cx + (k - (n - 1) / 2) * 0.30 + (rnd() - 0.5) * 0.05,
              0.13 + row * 0.23,
              p.cz + (rnd() - 0.5) * 0.12 - row * 0.02),
            q, new THREE.Vector3(p.len * (0.9 + rnd() * 0.25), 1, 1));
          im.setMatrixAt(i, m4);
          im.setColorAt(i, col.set('#6b4a35').multiplyScalar(0.82 + rnd() * 0.36));
          i++;
        }
      });
    }
    im.castShadow = true;
    track('wood-piles', im);
  }

  /* ===== MESO: wattle pens + the flock ===== */
  {
    const grp = new THREE.Group();
    const rnd = mulberry32(91003);
    /* pen rectangles in world m, footprint depths reduced from the screen boxes
       (the ledger boxes include drawn fence height; obstacle law still audits
        the FULL plate boxes via PATH audit in plate px) */
    const PENS = [
      { x0: X(775), z0: Z(345), x1: X(1050), z1: Z(425), gate: 'S' },
      { x0: X(860), z0: Z(425), x1: X(1090), z1: Z(512), gate: 'W' },
    ];
    const postG = new THREE.CylinderGeometry(0.05, 0.065, 0.95, 6);
    const railG = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
    railG.rotateZ(Math.PI / 2);
    const posts = [], rails = [];
    for (const pen of PENS) {
      const sides = [
        [[pen.x0, pen.z0], [pen.x1, pen.z0]],
        [[pen.x1, pen.z0], [pen.x1, pen.z1]],
        [[pen.x1, pen.z1], [pen.x0, pen.z1]],
        [[pen.x0, pen.z1], [pen.x0, pen.z0]],
      ];
      for (const [[ax, az], [bx, bz]] of sides) {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(2, Math.round(len / 0.82));
        const ang = Math.atan2(bx - ax, bz - az);
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          posts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t,
            lean: (rnd() - 0.5) * 0.1, s: 0.9 + rnd() * 0.25 });
        }
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2;
          for (let course = 0; course < 3; course++) {
            rails.push({
              x: ax + (bx - ax) * tm, z: az + (bz - az) * tm,
              y: 0.22 + course * 0.26 + (rnd() - 0.5) * 0.03,
              ang, len: len / n * 1.06, bow: (rnd() - 0.5) * 0.06 });
          }
        }
      }
    }
    const postIM = new THREE.InstancedMesh(postG, flatMat({ color: '#8a6a3e' }), posts.length);
    const railIM = new THREE.InstancedMesh(railG, flatMat({ color: '#7a5c36' }), rails.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    posts.forEach((p, i) => {
      e.set(p.lean, 0, p.lean * 0.7); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p.x, 0.45, p.z), q, new THREE.Vector3(1, p.s, 1));
      postIM.setMatrixAt(i, m4);
      postIM.setColorAt(i, col.set('#8a6a3e').multiplyScalar(0.85 + rnd() * 0.3));
    });
    rails.forEach((r, i) => {
      e.set(0, r.ang - Math.PI / 2, r.bow); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.len, 1, 1));
      railIM.setMatrixAt(i, m4);
      railIM.setColorAt(i, col.set('#7a5c36').multiplyScalar(0.85 + rnd() * 0.3));
    });
    postIM.castShadow = railIM.castShadow = true;
    postIM.name = 'pen-posts'; railIM.name = 'pen-rails';
    parts['pen-posts'] = postIM; parts['pen-rails'] = railIM;
    grp.add(postIM, railIM);

    /* the flock: body + head instanced pairs, seeded, min-separation */
    const bodyG = new THREE.IcosahedronGeometry(0.42, 1);
    bodyG.scale(1.25, 0.72, 0.62);
    const headG = new THREE.BoxGeometry(0.16, 0.16, 0.24);
    const srnd = mulberry32(91005);
    const spots = [];
    const IN = [
      { x0: X(795), z0: Z(352), x1: X(1035), z1: Z(418), n: 14 },
      { x0: X(880), z0: Z(432), x1: X(1075), z1: Z(505), n: 5 },
    ];
    for (const pen of IN) {
      let placed = 0, guard = 0;
      while (placed < pen.n && guard++ < 400) {
        const x = pen.x0 + 0.5 + srnd() * (pen.x1 - pen.x0 - 1);
        const z = pen.z0 + 0.5 + srnd() * (pen.z1 - pen.z0 - 1);
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 0.85)) continue;
        spots.push({ x, z, a: srnd() * Math.PI * 2, lie: srnd() < 0.25 });
        placed++;
      }
    }
    const wool = new THREE.InstancedMesh(bodyG, flatMat({ color: '#e8e2d4', roughness: 1 }), spots.length);
    const face = new THREE.InstancedMesh(headG, flatMat({ color: '#4a3a2c' }), spots.length);
    spots.forEach((s, i) => {
      const lieS = s.lie ? 0.72 : 1;
      e.set(0, s.a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s.x, 0.34 * lieS, s.z), q, new THREE.Vector3(1, lieS, 1));
      wool.setMatrixAt(i, m4);
      const hx = s.x + Math.sin(s.a) * 0.52, hz = s.z + Math.cos(s.a) * 0.52;
      m4.compose(new THREE.Vector3(hx, (0.4 + (s.lie ? -0.08 : 0.06)), hz), q, new THREE.Vector3(1, 1, 1));
      face.setMatrixAt(i, m4);
      wool.setColorAt(i, col.setScalar(0.9 + srnd() * 0.14));
    });
    wool.castShadow = true;
    wool.name = 'sheep-wool'; face.name = 'sheep-face';
    parts['sheep-flock'] = wool;
    grp.add(wool, face);
    track('pens-and-flock', grp);
  }

  /* ===== MESO: the giant's bed + club ===== */
  {
    const grp = new THREE.Group();
    /* frame: two side logs + two end logs */
    const side = new THREE.CylinderGeometry(0.16, 0.16, 5.0, 7);
    side.rotateZ(Math.PI / 2);
    const end = new THREE.CylinderGeometry(0.14, 0.14, 2.5, 7);
    end.rotateX(Math.PI / 2);
    const bark = flatMat({ color: '#4a3226' });
    for (const dz of [-1.15, 1.15]) {
      const m = new THREE.Mesh(side, bark);
      m.position.set(0, 0.22, dz);
      m.castShadow = true;
      grp.add(m);
    }
    for (const dx of [-2.4, 2.4]) {
      const m = new THREE.Mesh(end, bark);
      m.position.set(dx, 0.22, 0);
      m.castShadow = true;
      grp.add(m);
    }
    /* bough mattress: jittered green slab */
    const bgm = jitterByPos(new THREE.BoxGeometry(4.7, 0.55, 2.2, 8, 2, 4), 91021, 0.1);
    const boughs = new THREE.Mesh(facetColors(bgm, '#4a6b35', 91021, 0.16), flatMat({ vertexColors: true }));
    boughs.position.y = 0.5;
    boughs.castShadow = true;
    grp.add(boughs);
    /* pale blanket + bolster */
    const blg = jitterByPos(new THREE.BoxGeometry(2.9, 0.18, 1.9, 6, 1, 4), 91022, 0.05);
    const blanket = new THREE.Mesh(facetColors(blg, '#d8cfc0', 91022, 0.07), flatMat({ vertexColors: true, roughness: 1 }));
    blanket.position.set(0.55, 0.86, 0);
    grp.add(blanket);
    const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 8),
      flatMat({ color: '#e4dccb', roughness: 1 }));
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-1.9, 0.95, 0);
    grp.add(bolster);
    grp.position.set(X(1128), 0, Z(452) - 1.4);
    grp.rotation.y = THREE.MathUtils.degToRad(24);
    track('giants-bed', grp);

    /* the club, leaning tip-up against the east wall (butt 1042,398 -> tip 1097,200) */
    const pts = [[0.14, 0], [0.2, 0.8], [0.3, 2.6], [0.37, 4.2], [0.3, 4.7], [0.1, 4.85]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const clubG = new THREE.LatheGeometry(pts, 8);
    const club = new THREE.Mesh(facetColors(clubG, '#4a3226', 91023, 0.12),
      flatMat({ vertexColors: true }));
    club.position.set(X(1082), 0, Z(372) - 0.6);
    club.rotation.set(-0.38, 0, -0.22);
    club.castShadow = true;
    track('club', club);
  }

  /* ===== MESO: vessels (tubs / bowls) ===== */
  {
    const grp = new THREE.Group();
    const lathe = (profile, hex, seed) => new THREE.Mesh(
      facetColors(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 12), hex, seed, 0.1),
      flatMat({ vertexColors: true, side: THREE.DoubleSide }));
    /* stave barrels */
    const barrel = (x, z, s, seed) => {
      const b = lathe([[0.42, 0], [0.54, 0.28], [0.58, 0.5], [0.54, 0.75], [0.46, 0.98]], '#6e4a2a', seed);
      b.scale.setScalar(s);
      b.position.set(x, 0, z);
      b.castShadow = true;
      grp.add(b);
      const milk = new THREE.Mesh(new THREE.CircleGeometry(0.43 * s, 12), flatMat({ color: '#efe8d8', roughness: 1 }));
      milk.rotation.x = -Math.PI / 2;
      milk.position.set(x, 0.9 * s, z);
      grp.add(milk);
      for (const hy of [0.22, 0.72]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.565 * s, 0.022 * s, 5, 14), flatMat({ color: '#3a342e', roughness: 0.6 }));
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(x, hy * s, z);
        grp.add(hoop);
      }
    };
    barrel(X(890), Z(505), 1.05, 91031);      /* milkTub */
    barrel(X(742), Z(382), 0.95, 91032);      /* wheyTub by rack D */
    /* clay bowls */
    const bowl = (x, z, s, seed) => {
      const b = lathe([[0.12, 0], [0.5, 0.08], [0.62, 0.3], [0.55, 0.36]], '#9a6a4a', seed);
      b.scale.setScalar(s);
      b.position.set(x, 0, z);
      b.castShadow = true;
      grp.add(b);
    };
    bowl(X(832), Z(524), 1.05, 91033);        /* clayBowl */
    bowl(X(800), Z(414), 0.6, 91034);         /* creamBowl */
    track('vessels', grp);
  }

  /* ===== MESO: lanterns + halos + practical lights ===== */
  const lampTickers = [];
  {
    const mkLamp = (name, x, y, z, period) => {
      const g = new THREE.Group();
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.34),
        flatMat({ color: '#2e2a26', roughness: 0.6 }));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 4),
        flatMat({ color: '#242020', roughness: 0.6 }));
      cap.position.y = 0.32;
      const glass = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
        new THREE.MeshBasicMaterial({ color: '#ffc76a' }));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), flatMat({ color: '#2e2a26' }));
      arm.position.y = 0.55;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,190,100,0.7)', 'rgba(255,140,40,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.setScalar(2.4);
      const light = new THREE.PointLight('#ffb347', 15, 0, 2);
      g.add(cage, cap, glass, arm, halo, light);
      g.position.set(x, y, z);
      lampTickers.push((t) => {
        const f = 0.82 + 0.18 * Math.sin(2 * Math.PI * t / period);
        light.intensity = 15 * f;
        halo.material.opacity = 0.4 + 0.25 * f;
      });
      track(name, g);
    };
    mkLamp('lamp-l', X(258), 2.4, Z(452) + 1.0, 5.7);
    mkLamp('lamp-r', X(1218), 2.7, Z(430) - 0.8, 6.3);
  }

  /* ===== MESO: crown trees + tufts + exterior boulders ===== */
  {
    const grp = new THREE.Group();
    const rnd = mulberry32(90908);
    const domeY = (x, z) => {
      const dx = (x - DOME.cx) / (DOME.rx - 0.4), dz = (z - DOME.cz) / (DOME.rz - 0.4);
      const t = 1 - dx * dx - dz * dz;
      return t > 0 ? Math.sqrt(t) * (DOME.ry - 0.4) : 0;
    };
    const tree = (x, z, s, seed) => {
      const y = domeY(x, z);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.3, 6), flatMat({ color: '#4a3226' }));
      trunk.position.y = 0.6;
      g.add(trunk);
      const R = mulberry32(seed);
      for (let i = 0; i < 3; i++) {
        const cg = jitterByPos(new THREE.IcosahedronGeometry(0.62 - i * 0.13, 0), seed + i, 0.1);
        const c = new THREE.Mesh(facetColors(cg, ['#5f7a44', '#6e8c50', '#93a86a'][i % 3], seed + i, 0.12),
          flatMat({ vertexColors: true }));
        c.position.set((R() - 0.5) * 0.5, 1.15 + i * 0.5, (R() - 0.5) * 0.5);
        g.add(c);
      }
      g.scale.setScalar(s);
      g.position.set(x, y - 0.25, z);
      grp.add(g);
    };
    tree(-4.6, -5.6, 1.6, 92001);   /* left crown, tall */
    tree(-7.6, -3.4, 1.1, 92002);
    tree(9.4, -5.4, 1.5, 92003);    /* right crown */
    tree(12.4, -2.2, 1.0, 92004);
    for (let i = 0; i < 10; i++) {
      const x = -12 + rnd() * 25, z = DOME.cz - DOME.rz * 0.7 + rnd() * DOME.rz * 1.1;
      const y = domeY(x, z);
      if (y < 1.5) continue;
      const tg = jitterByPos(new THREE.IcosahedronGeometry(0.22 + rnd() * 0.2, 0), 92010 + i, 0.06);
      const tuft = new THREE.Mesh(facetColors(tg, '#4a5c3e', 92010 + i, 0.15), flatMat({ vertexColors: true }));
      tuft.position.set(x, y - 0.08, z);
      grp.add(tuft);
    }
    /* exterior boulders at the island edges (the plate's mouth-side stones) */
    for (let i = 0; i < 5; i++) {
      const bg = jitterByPos(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.5, 1), 92020 + i, 0.12);
      const b = new THREE.Mesh(facetColors(bg, '#56607a', 92020 + i, 0.14), flatMat({ vertexColors: true }));
      const px = [-11.5, -10.2, 12.8, 13.6, -12.6][i];
      const pz = [2.2, 3.4, 1.4, -0.6, -0.4][i];
      b.position.set(px, 0.2, pz);
      b.castShadow = true;
      grp.add(b);
    }
    track('crown-and-edges', grp);
  }

  /* ===== MESO: floor litter (seeded, path-respecting) ===== */
  {
    const rnd = mulberry32(90909);
    const curvePts = PATH_PTS.map(([px, py]) => new THREE.Vector3(X(px), 0, Z(py)));
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.35);
    const samples = curve.getPoints(160);
    const world = Object.values(OBSTACLES).map(([[x0, y0], [x1, y1]]) =>
      [X(x0), Z(y0), X(x1), Z(y1)]);
    const ok = (x, z) => {
      if (samples.some((p) => Math.hypot(p.x - x, p.z - z) < 0.8)) return false;
      if (world.some(([a, b, c, d]) => x > a - 0.2 && x < c + 0.2 && z > b - 0.2 && z < d + 0.2)) return false;
      return Math.hypot((x - 0.6) / 13.6, (z + 0.9) / 8.6) < 1;
    };
    const pebG = new THREE.IcosahedronGeometry(0.14, 0);
    const im = new THREE.InstancedMesh(pebG, flatMat({ color: '#6a5138' }), 42);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < 42 && guard++ < 900) {
      const x = -12 + rnd() * 26, z = -8 + rnd() * 13.5;
      if (!ok(x, z)) continue;
      e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.03, z), q,
        new THREE.Vector3(0.7 + rnd(), 0.35 + rnd() * 0.3, 0.6 + rnd()));
      im.setMatrixAt(placed, m4);
      im.setColorAt(placed, col.set(rnd() < 0.4 ? '#4e3c2a' : '#77613f').multiplyScalar(0.85 + rnd() * 0.3));
      placed++;
    }
    im.count = placed;
    track('floor-litter', im);
  }

  /* ===== the night rig (unshadowed fills) ===== */
  {
    const hemi = new THREE.HemisphereLight('#44598c', '#4a3524', 1.2);
    const moon = new THREE.DirectionalLight('#9db8ff', 0.75);
    moon.position.set(-18, 26, 20);
    root.add(hemi, moon);
    parts['night-rig'] = hemi;
  }

  /* ---- budget: count triangles once, from the built graph ---- */
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    const g = o.geometry;
    if (!g || !g.attributes.position) return;
    const n = g.index ? g.index.count : g.attributes.position.count;
    const t = o.isPoints ? 0 : Math.floor(n / 3) * (o.isInstancedMesh ? o.count : 1);
    triangles += t;
  });

  const tick = (simT) => {
    const f = flick(simT);
    for (const fn of tickers) fn(simT, f);
    for (const fn of lampTickers) fn(simT);
  };
  root.userData.sculptRuntime = {
    nodes: Object.keys(parts).length,
    triangles,
    sockets: { 'root:fire-anchor': [FIRE.x, 0, FIRE.z], 'root:character-stage': [X(360), 0, Z(450)] },
    colliders: OBSTACLES,
  };
  const setPixelScale = (pxPerMetre) => { PX_UNIFORM.value = pxPerMetre; };
  return { root, tick, fireLight, flick, parts, triangles, FIRE, setPixelScale };
}

/* ---------------- the book's isometric camera + orbit ---------------- */
export function createCaveIsoCamera(aspect = 1408 / 768) {
  const HALF_W = 16.6;
  const cam = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_W / aspect, -HALF_W / aspect, 0.1, 260);
  const target = new THREE.Vector3(0.6, 1.15, -0.9);
  const R = 110;
  const setOrbit = (azimuthDeg) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    cam.position.set(
      target.x + R * Math.sin(az) * Math.cos(ELEV),
      target.y + R * Math.sin(ELEV),
      target.z + R * Math.cos(az) * Math.cos(ELEV));
    cam.lookAt(target);
  };
  setOrbit(0);
  cam.userData.setOrbit = setOrbit;
  cam.userData.target = target;
  return cam;
}
