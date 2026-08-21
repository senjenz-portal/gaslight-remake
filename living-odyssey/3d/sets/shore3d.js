/**
 * shore3d.js — procedural Three.js FULL-3D SET
 * THE SHORE (Book IX landfall): the goat-island beach camp facing the mainland
 * of the Cyclopes across the black strait — night state, fire lit, moonpath on.
 *
 * Built exactly the way the cave was built (demo3d/full3d/createCaveScene.js is
 * the worked example): img2threejs staged passes blockout -> structural -> form
 * -> material -> lighting against the reference plate ../../assets/set/shore/shore.jpg,
 * each pass screenshot-reviewed. The reconstruction record is
 * tools/shore-forge/object-sculpt-spec.json (36 components, 22 materials,
 * 10 repetition systems, strict-quality PASS) on the project-source side; this
 * file is the hand-carried factory. The particle fire is the cave's own system,
 * now the SHARED module ../lib/fire3d.js.
 *
 * THE FLOOR PLAN IS THE LEDGER. Every transform derives from tools/ody/ledger.json
 * (sets.shore, plate px, 11.3 px/m off ship-2 — the beached twenty-oarer, 15 m
 * tip-to-tip, Butler's own hull class) through the shore's own world frame:
 *   X(px)     = (px - 438) / 11.3              metres, +east (origin = the campfire)
 *   Z(py)     = (py - 466) / (11.3·sin 28°)    metres, +downstage (campfire row = 0)
 *   ZH(py,h)  = Z(py + h·cos 28°·11.3)         plan depth of a point painted at height h
 *   Y up, camp sand = 0 exactly (the path law needs a true plane).
 * The 28° comes from the camp-ring ellipse the plate itself paints (24/51 px).
 * LEDGER SCALE HONEST PER SET: the shore derives its OWN 11.3 (the cave's 43 was
 * the cave's ewes). The dual-scale ruling is carried: the mainland lobe is painted
 * at 19.5 px/m local truth; the build reproduces the PAINTING through the one
 * 11.3 frame and exports MAINLAND_S + bounds so actor mounting stays honest.
 *
 * DETERMINISM LAW: every scatter/jitter is mulberry32-seeded; fire + the three
 * mainland smoke columns are the shared seeded GPU systems (position = pure
 * f(seed attrs, uTime)); the water's moonpath shimmer is a seeded per-facet hash
 * twinkle, pure f(uTime). tick(simT) writes uniforms + flicker only. setSim-safe.
 * DAY STATE = LIGHT RIG SWAP (dawn preset): setState('day') swaps hemisphere/sun,
 * sky vertex colors, kills the fire, hides the stars, warms the water path —
 * geometry untouched, still deterministic.
 *
 * Exports
 *   createShoreScene()               -> { root, tick(simT), setState(s), fireLight,
 *                                         flick, parts, triangles, FIRE, setPixelScale }
 *   createShoreIsoCamera(aspect)     -> OrthographicCamera + .userData.setOrbit(azimuthDeg)
 *   SHORE_WORLD                      -> { S, SIN_E, ELEV, X, Z, ZH, MAINLAND_S,
 *                                         MAINLAND_BOUNDS, PATH_PTS, OBSTACLES, MARKS }
 */
import * as THREE from 'three';
import {
  mulberry32, jitterByPos, facetColors, dropFaces, flatMat, glowTexture,
  fireSystem, flickCurve, PX_UNIFORM,
} from '../lib/fire3d.js';

/* ---------------- world frame (the ledger's plan) ---------------- */
const S = 11.3;                            /* px per metre — ship-2, the 15 m twenty-oarer */
const ELEV = THREE.MathUtils.degToRad(28); /* the camp-ring ellipse's own angle (24/51) */
const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);
const X = (px) => (px - 438) / S;
const Z = (py) => (py - 466) / (S * SIN_E);
const ZH = (py, h) => Z(py + h * COS_E * S); /* painted-at-height h -> plan depth */
const M = (px) => px / S;

/* the audited beach walk — plate px; swings BELOW the camp ring and the day-goat
   box, clears the stern-curl mass and stops short of ship-1's oar blades
   (>=10 px of every census box, the round-7 parking law) */
const PATH_PTS = [
  [300, 455], [335, 465], [370, 483], [368, 516], [378, 542], [415, 549],
  [462, 543], [492, 528], [520, 514], [548, 506], [563, 499],
];
/* the ledger's shore obstacle census, plate px — the 3D obstacle law reads these */
const OBSTACLES = {
  campfireRing: [[403, 431], [473, 501]],
  dayGoat: [[395, 465], [450, 530]],          /* day plate only; the path clears it anyway */
  sternCurlMass: [[495, 430], [545, 488]],
  ship1Oars: [[574, 488], [639, 512]],
};
const MARKS = {
  fireUlysses: [390, 480], councilUlysses: [563, 499], councilCrew: [472, 507],
  twelveAtShip: [560, 503], entryMainland: [1008, 268], climbPath: [940, 325],
};
export const SHORE_WORLD = {
  S, SIN_E, COS_E, ELEV, X, Z, ZH, PATH_PTS, OBSTACLES, MARKS,
  MAINLAND_S: 19.5, MAINLAND_BOUNDS: { xMin: 900, yMax: 380 },
};

/* ---------------- zone-colored grid slab (the lobes' walkable tops) ----------------
   Low-poly ground the register's way: a world-XZ cell grid clipped to the lobe
   polygon, corner heights hash-jittered, one facet color per face by zone rule,
   plus a perimeter skirt so the turntable shows no holes. Deterministic. */
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function slabGrid({ poly, cell, y0, skirt, seed, colorFor, jitterY = 0.14 }) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const inside = (i, k) => pointInPoly(x0 + (i + 0.5) * cell, z0 + (k + 0.5) * cell, poly);
  const H = (x, z) => y0 + (((Math.imul(Math.round(x * 7) + 31, 2654435761) ^
    Math.imul(Math.round(z * 7) + seed, 2246822519)) >>> 16) / 65536 - 0.5) * 2 * jitterY;
  const pos = [], col = [];
  const c = new THREE.Color();
  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz, hex) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    c.set(hex);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (!inside(i, k)) continue;
    const xa = x0 + i * cell, xb = xa + cell, za = z0 + k * cell, zb = za + cell;
    const y00 = H(xa, za), y10 = H(xb, za), y01 = H(xa, zb), y11 = H(xb, zb);
    const cx = (xa + xb) / 2, cz = (za + zb) / 2;
    pushTri(xa, y00, za, xa, y01, zb, xb, y11, zb, colorFor(cx, cz, seed + i * 131 + k));
    pushTri(xa, y00, za, xb, y11, zb, xb, y10, za, colorFor(cx, cz, seed + i * 131 + k + 7));
    /* skirt quads where a neighbour cell is missing (the lobe's cut edge) */
    const edge = (miss, ax, az, bx, bz, ya, yb) => {
      if (!miss) return;
      const hex = colorFor(cx, cz, seed + i * 17 + k * 29, true);
      pushTri(ax, ya, az, bx, yb, bz, bx, yb - skirt, bz, hex);
      pushTri(ax, ya, az, bx, yb - skirt, bz, ax, ya - skirt, az, hex);
    };
    edge(i === 0 || !inside(i - 1, k), xa, zb, xa, za, y01, y00);
    edge(i === nx - 1 || !inside(i + 1, k), xb, za, xb, zb, y10, y11);
    edge(k === 0 || !inside(i, k - 1), xa, za, xb, za, y00, y10);
    edge(k === nz - 1 || !inside(i, k + 1), xb, zb, xa, zb, y11, y01);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}
/* seeded facet value jitter for the zone colors */
function tone(hex, seedInt, amount = 0.09) {
  const h = ((Math.imul(seedInt | 0, 2654435761) >>> 16) / 65536 - 0.5) * 2 * amount;
  const c = new THREE.Color(hex);
  c.r = Math.min(1, Math.max(0, c.r * (1 + h)));
  c.g = Math.min(1, Math.max(0, c.g * (1 + h)));
  c.b = Math.min(1, Math.max(0, c.b * (1 + h)));
  return '#' + c.getHexString();
}

/* ---------------- the factory ---------------- */
export function createShoreScene() {
  const root = new THREE.Group();
  root.name = 'goat-island-shore-diorama';
  const parts = {};
  const track = (name, obj) => { obj.name = name; parts[name] = obj; root.add(obj); return obj; };
  const tickers = [];
  const nightOnly = [], fireParts = [];

  /* ===== MACRO: sky dome (night gradient + dawn swap) + stars ===== */
  let skyGeo, skyNight, skyDawn, stars;
  {
    const g = new THREE.SphereGeometry(260, 24, 16);
    const posA = g.attributes.position;
    const mk = (topHex, horHex) => {
      const top = new THREE.Color(topHex), hor = new THREE.Color(horHex);
      const col = new Float32Array(posA.count * 3);
      for (let i = 0; i < posA.count; i++) {
        const t = THREE.MathUtils.clamp(posA.getY(i) / 260 * 0.5 + 0.5, 0, 1);
        const c = hor.clone().lerp(top, t);
        col.set([c.r, c.g, c.b], i * 3);
      }
      return new THREE.BufferAttribute(col, 3);
    };
    skyNight = mk('#161f3a', '#252e4a');
    skyDawn = mk('#b989a2', '#efc0ac');
    skyGeo = g;
    g.setAttribute('color', skyNight);
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10;
    track('sky', sky);

    const rnd = mulberry32(70904);
    const N = 220, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = rnd() * Math.PI * 2, el = Math.asin(0.06 + rnd() * 0.9);
      sp[i * 3] = 240 * Math.cos(el) * Math.sin(az);
      sp[i * 3 + 1] = 240 * Math.sin(el);
      sp[i * 3 + 2] = 240 * Math.cos(el) * Math.cos(az);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: '#e8eeff', size: 1.4, sizeAttenuation: true,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, depthWrite: false }));
    track('star-points', stars);
    nightOnly.push(stars);
  }

  /* ===== MACRO: island under-rocks (two lobes + the strait slab) ===== */
  {
    const mk = (name, cx, cy, cz, rx, ry, rz, seed) => {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y >= 0) { y *= 0.05; }                 /* flat top just under the floor */
        else { const d = -y; x *= (1 - 0.6 * d); z *= (1 - 0.6 * d); y *= 1.05; }
        p.setXYZ(i, x * rx, y * ry, z * rz);
      }
      jitterByPos(g, seed, 0.8);
      const rock = new THREE.Mesh(facetColors(g, '#3a4258', seed, 0.16), flatMat({ vertexColors: true }));
      rock.position.set(cx, cy, cz);
      track(name, rock);
    };
    mk('island-under-west', 2, -1.0, 2, 27, 15, 26, 70901);
    mk('island-under-east', 54, -1.5, -24, 25, 19, 27, 70902);
    mk('island-under-mid', 30, -1.6, -12, 26, 11, 28, 70903);
  }

  /* ===== MACRO: beach lobe slab (sand camp + green crown, zone-colored) ===== */
  const SHORELINE = [
    [9.5, -32.8], [15.2, -25.6], [19.6, -16.2], [23.2, -6.8], [26.7, 0.75],
    [32.0, 10.2], [38.2, 17.3]];
  {
    const poly = [
      [-23.9, 0.75], [-21.9, -6.8], [-18.4, -13.9], [-12.2, -21.5], [-5.1, -27.9],
      [2.8, -31.3], [9.5, -32.8],
      [15.2, -25.6], [19.6, -16.2], [23.2, -6.8], [26.7, 0.75], [32.0, 10.2], [38.2, 17.3],
      [32.0, 23.4], [18.8, 26.8], [3.7, 25.3], [-9.6, 19.6], [-18.4, 12.1], [-23.3, 7.35],
    ];
    const distShore = (x, z) => {
      let d = 1e9;
      for (let i = 0; i < SHORELINE.length - 1; i++) {
        const [ax, az] = SHORELINE[i], [bx, bz] = SHORELINE[i + 1];
        const t = Math.max(0, Math.min(1,
          ((x - ax) * (bx - ax) + (z - az) * (bz - az)) /
          ((bx - ax) ** 2 + (bz - az) ** 2)));
        d = Math.min(d, Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)));
      }
      return d;
    };
    const colorFor = (x, z, si, isSkirt) => {
      if (isSkirt) return tone('#4a5268', si, 0.12);
      const dS = distShore(x, z), dF = Math.hypot(x, z);
      if (dS < 2.2) return tone('#e8d9b8', si, 0.06);          /* waterline pale strip */
      if (dS < 9.5 || dF < 15 || (z > 2 && dF < 21)) {
        /* camp sand, warmed toward the fire */
        const warm = Math.max(0, 1 - dF / 15);
        const c = new THREE.Color('#e0cda6').lerp(new THREE.Color('#eccf96'), warm * 0.55);
        return tone('#' + c.getHexString(), si, 0.07);
      }
      return tone(Math.hypot(x + 16, z - 2) < 11 ? '#6a7050' : '#6a7c4a', si, 0.11);
    };
    const geo = slabGrid({ poly, cell: 2.3, y0: 0, skirt: 1.7, seed: 70911, colorFor, jitterY: 0.1 });
    /* the camp apron must be a TRUE plane for the path law: flatten near the walk */
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      if (y > -0.5 && Math.hypot(x - 4, z - 3) < 15) p.setY(i, y * 0.15);
    }
    geo.computeVertexNormals();
    const slab = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 1 }));
    slab.receiveShadow = true;
    track('beach-lobe', slab);
  }

  /* ===== MACRO: the strait water plane — moonpath shimmer, pure f(uTime) ===== */
  let waterMat;
  {
    let g = new THREE.PlaneGeometry(52, 92, 15, 26);
    g.rotateX(-Math.PI / 2);
    g.rotateY(THREE.MathUtils.degToRad(29.4));    /* the beach shoreline's own axis */
    g.translate(34, -0.26, -13);
    g = g.toNonIndexed();
    /* clip the strait to the island: NE rim line, the lobes' meeting line
       downstage-east, and the beach tongue line upstage-west — the water exists
       only BETWEEN the lobes, exactly as painted */
    g = dropFaces(g, (c) =>
      ((c.x - 16.1) * 23.5 + (c.z + 39.8) * 26.6) > -170 &&
      ((c.x - 36.0) * 38.0 + (c.z - 24.0) * 24.0) < 40 &&
      ((c.x - 2.8) * 8.5 + (c.z + 31.3) * 13.3) > -30);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = (((Math.imul(Math.round(x * 5) + 11, 2654435761) ^
        Math.imul(Math.round(z * 5) + 70921, 2246822519)) >>> 16) / 65536 - 0.5);
      p.setY(i, -0.26 + h * 0.22);
    }
    /* bake per-FACET attributes (centroid, flat normal, seeded hash) so the
       moonpath mask + twinkle are exactly facet-quantised — the plate paints
       whole triangles bright, never a per-pixel gradient */
    {
      const n = p.count;
      const cent = new Float32Array(n * 2), nrm = new Float32Array(n * 3),
            hsh = new Float32Array(n);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(),
            NN = new THREE.Vector3();
      const frnd = mulberry32(70922);
      for (let f = 0; f < n / 3; f++) {
        A.fromBufferAttribute(p, f * 3); B.fromBufferAttribute(p, f * 3 + 1);
        C.fromBufferAttribute(p, f * 3 + 2);
        NN.copy(B).sub(A).cross(C.clone().sub(A)).normalize();
        if (NN.y < 0) NN.multiplyScalar(-1);
        const cx = (A.x + B.x + C.x) / 3, cz = (A.z + B.z + C.z) / 3;
        const h = frnd();
        for (let k = 0; k < 3; k++) {
          cent[(f * 3 + k) * 2] = cx; cent[(f * 3 + k) * 2 + 1] = cz;
          nrm.set([NN.x, NN.y, NN.z], (f * 3 + k) * 3);
          hsh[f * 3 + k] = h;
        }
      }
      g.setAttribute('aCent', new THREE.BufferAttribute(cent, 2));
      g.setAttribute('aNrm', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('aHash', new THREE.BufferAttribute(hsh, 1));
    }
    waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uDay: { value: 0 },
        uMoonDir: { value: new THREE.Vector3(-0.18, 0.62, -0.76).normalize() },
      },
      vertexShader: `
        uniform float uTime; uniform float uDay; uniform vec3 uMoonDir;
        attribute vec2 aCent; attribute vec3 aNrm; attribute float aHash;
        varying vec3 vCol;
        void main(){
          float tw = 0.5 + 0.5 * sin(uTime * (0.55 + aHash * 2.3) + aHash * 107.0);
          /* the moonpath: line through (19.6,-36) dir (0.22,0.975), widening downstage */
          vec2 rel = aCent - vec2(19.6, -36.0);
          vec2 dir = normalize(vec2(0.22, 0.975));
          float along = dot(rel, dir);
          float lat = abs(rel.x * dir.y - rel.y * dir.x);
          float w = mix(2.4, 7.0, clamp((along + 6.0) / 58.0, 0.0, 1.0));
          float path = smoothstep(w * 1.1, w * 0.5, lat);
          float glint = pow(max(dot(aNrm, normalize(uMoonDir + vec3(0.0, 1.0, 0.9))), 0.0), 5.0);
          /* authored AS the plate's own sRGB values (ShaderMaterial writes raw) */
          vec3 deep  = mix(vec3(0.168, 0.22, 0.315), vec3(0.23, 0.26, 0.30), uDay);
          vec3 silver= mix(vec3(0.87, 0.91, 0.96), vec3(0.98, 0.88, 0.70), uDay);
          vec3 steel = mix(vec3(0.29, 0.35, 0.45), vec3(0.42, 0.40, 0.38), uDay);
          vec3 col = deep * (0.74 + 0.62 * glint);
          col = mix(col, steel, path * 0.22);
          /* the path lights WHOLE facets, twinkling with sim-time */
          float lit = path * (0.25 + 0.75 * tw) * (0.3 + 0.7 * glint);
          col = mix(col, silver, clamp(lit * 1.2, 0.0, 1.0));
          /* scattered off-path glints — the plate's silver flecks across the strait */
          float fleck = step(0.9, aHash) * tw * glint;
          col = mix(col, silver * 0.85, clamp(fleck * 0.8, 0.0, 1.0));
          vCol = col;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vCol;
        void main(){ gl_FragColor = vec4(vCol, 1.0); }`,
    });
    const water = new THREE.Mesh(g, waterMat);
    water.receiveShadow = false;
    track('strait-water', water);
    tickers.push((t) => { waterMat.uniforms.uTime.value = t; });
  }

  /* ===== MACRO: mainland base slab (apron sand + lower grass) ===== */
  {
    const poly = [
      [39.1, -43.0], [43.5, -27.5], [48.0, -17.2], [53.3, -12.8], [57.7, -13.9],
      [62.1, -18.5], [67.4, -25.6], [71.0, -35.1], [69.0, -48.0], [60.0, -56.0],
      [48.0, -55.0], [41.0, -49.0],
    ];
    const colorFor = (x, z, si, isSkirt) => {
      if (isSkirt) return tone('#4a5268', si, 0.12);
      /* sand along the waterline edge, grass behind */
      const dEdge = Math.min(
        Math.hypot(x - 43.5, z + 27.5), Math.hypot(x - 48, z + 17.2),
        Math.hypot(x - 53.3, z + 12.8), Math.hypot(x - 57.7, z + 13.9),
        Math.hypot(x - 62.1, z + 18.5));
      if (dEdge < 6.0) return tone('#e6d6b2', si, 0.06);
      return tone('#66784a', si, 0.1);
    };
    const geo = slabGrid({ poly, cell: 2.4, y0: 0, skirt: 1.7, seed: 70912, colorFor, jitterY: 0.1 });
    const slab = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 1 }));
    slab.receiveShadow = true;
    track('mainland-apron', slab);
  }

  /* ===== MACRO: mainland cliff mass + plateau crown ===== */
  const CLIFF = { cx: 55.5, cz: -49, rx: 19, ry: 15.5, rz: 16.5 };
  {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0.55) { const o = y; y = 0.55 + (o - 0.55) * 0.16; x *= 1.04; z *= 1.04; } /* plateau top */
      if (y < 0) y *= 0.12;                                     /* seat into the base slab */
      p.setXYZ(i, x * CLIFF.rx, y * CLIFF.ry + 0.4, z * CLIFF.rz);
    }
    jitterByPos(g, 70931, 0.85);
    const geo = facetColors(g, '#8d8d95', 70931, 0.15);
    /* the cliff's flattened top lands at y ≈ (0.55 + 0.45·0.16)·ry + 0.4 ≈ 10.0 */
    /* grass tint on up-facing crown facets */
    {
      const pos = geo.attributes.position, col = geo.attributes.color;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3(), n = new THREE.Vector3();
      const grass = new THREE.Color('#6a7c4a');
      const rnd = mulberry32(70932);
      for (let f = 0; f < pos.count / 3; f++) {
        a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
        c3.fromBufferAttribute(pos, f * 3 + 2);
        n.copy(b).sub(a).cross(c3.clone().sub(a));
        const cy = (a.y + b.y + c3.y) / 3;
        if (n.y > 0.55 * n.length() && cy > 6.5) {
          const v = 0.85 + rnd() * 0.3;
          for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, grass.r * v, grass.g * v, grass.b * v);
        }
      }
      col.needsUpdate = true;
    }
    const cliff = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
    cliff.position.set(CLIFF.cx, 0, CLIFF.cz);
    cliff.castShadow = false;
    cliff.receiveShadow = true;
    track('cliff-mass', cliff);
    /* the green plateau crown cap — a real part, seated ON the flattened top */
    const cg = new THREE.CircleGeometry(1, 26);
    cg.rotateX(-Math.PI / 2);
    jitterByPos(cg, 70934, 0.05);
    const crownGeo = facetColors(cg, '#6a7c4a', 70934, 0.12);
    crownGeo.scale(12.8, 1, 10.2);
    const crown = new THREE.Mesh(crownGeo, flatMat({ vertexColors: true, roughness: 1 }));
    crown.position.set(CLIFF.cx, 10.05, CLIFF.cz - 1);
    crown.receiveShadow = true;
    track('plateau-crown', crown);
    /* east shoulder — the lower ledge that carries the third smoke fire */
    const sg = new THREE.IcosahedronGeometry(1, 2);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      let x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      if (y > 0.55) y = 0.55 + (y - 0.55) * 0.25;
      if (y < 0) y *= 0.1;
      sp.setXYZ(i, x * 9.5, y * 13.5 + 0.3, z * 10);
    }
    jitterByPos(sg, 70933, 0.7);
    const sh = new THREE.Mesh(facetColors(sg, '#84848c', 70933, 0.14), flatMat({ vertexColors: true }));
    sh.position.set(66, 0, -33);
    sh.scale.set(0.8, 0.75, 0.8);
    track('cliff-shoulder-east', sh);
  }

  /* ===== MESO: the cave mouth (black aperture + jambs + laurels) ===== */
  {
    const grp = new THREE.Group();
    const MW = M(1055 - 945) / 2;                 /* aperture half-width, as painted */
    /* the aperture: a flat BLACK arch panel flush to the cliff face — from the
       iso frame a black arch IS the depth read (the plate's own trick) */
    const shape = new THREE.Shape();
    shape.moveTo(-MW, 0);
    shape.lineTo(MW, 0);
    shape.lineTo(MW, 3.0);
    shape.absarc(0, 3.0, MW, 0, Math.PI, false);
    shape.lineTo(-MW, 0);
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10),
      new THREE.MeshBasicMaterial({ color: '#0b0907' }));
    panel.position.set(0, 0.05, 0);
    grp.add(panel);
    /* jamb rocks framing the arch, tucked INTO the cliff behind the panel */
    const rnd = mulberry32(70941);
    for (let i = 0; i < 7; i++) {
      const t = 0.1 + (i / 6) * 0.8, ang = Math.PI * t;
      const rg = jitterByPos(new THREE.IcosahedronGeometry(1.3, 1), 70941 + i, 0.34);
      const rock = new THREE.Mesh(facetColors(rg, '#8d8d95', 70951 + i, 0.13),
        flatMat({ vertexColors: true }));
      rock.position.set(Math.cos(ang) * (MW + 0.9), Math.max(0.6, Math.sin(ang) * (3.0 + MW) + 0.2), -1.3);
      rock.scale.set(1.1 + rnd() * 0.5, 0.75 + rnd() * 0.45, 1.4);
      rock.castShadow = true;
      grp.add(rock);
    }
    grp.position.set(X(1000), 1.4, -33.6);        /* flush to the cliff's front face */
    grp.rotation.y = -0.14;                       /* faces downstage-west, as painted */
    track('mainland-mouth', grp);
  }

  /* ===== MESO: yard terrace + stone wall + pens + the flock ===== */
  {
    const grp = new THREE.Group();
    /* terrace slab (grass at +1.35, stone skirt to the apron) */
    const poly = [[42, -34], [60.5, -34], [61.5, -19.5], [52, -16.5], [43.5, -22]];
    const colorFor = (x, z, si, isSkirt) =>
      isSkirt ? tone('#7e7e84', si, 0.1) : tone('#6a7c4a', si, 0.1);
    const tg = slabGrid({ poly, cell: 2.1, y0: 1.35, skirt: 1.45, seed: 70913, colorFor, jitterY: 0.07 });
    const terrace = new THREE.Mesh(tg, flatMat({ vertexColors: true, roughness: 1 }));
    terrace.receiveShadow = true;
    terrace.name = 'yard-terrace'; parts['yard-terrace'] = terrace;
    grp.add(terrace);

    /* the stone wall along the ledger diagonal (942,287)->(1062,345) at yard height */
    const A = [X(942), ZH(287, 1.4)], B = [X(1062), ZH(345, 1.4)];
    const wallLen = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const wallYaw = Math.atan2(B[0] - A[0], B[1] - A[1]);
    const stoneG = new THREE.BoxGeometry(1, 1, 1);
    const nPer = Math.round(wallLen / 1.0);
    const wallIM = new THREE.InstancedMesh(stoneG, flatMat({ color: '#ffffff' }), nPer * 2 + (nPer - 1));
    const rnd = mulberry32(70961);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let wi = 0;
    for (let course = 0; course < 3; course++) {
      const n = course === 2 ? nPer - 1 : nPer;
      for (let k = 0; k < n; k++) {
        const t = (k + (course === 2 ? 1 : 0.5)) / nPer;
        e.set(0, wallYaw + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.06); q.setFromEuler(e);
        m4.compose(
          new THREE.Vector3(A[0] + (B[0] - A[0]) * t, 1.35 + 0.26 + course * 0.42, A[1] + (B[1] - A[1]) * t),
          q, new THREE.Vector3(0.55 + rnd() * 0.2, 0.42 + rnd() * 0.1, 0.95 + rnd() * 0.25));
        wallIM.setMatrixAt(wi, m4);
        wallIM.setColorAt(wi, col.set('#93939b').multiplyScalar(0.82 + rnd() * 0.34));
        wi++;
      }
    }
    wallIM.count = wi;
    wallIM.castShadow = true;
    wallIM.name = 'yard-wall'; parts['yard-wall'] = wallIM;
    grp.add(wallIM);

    /* timber pens: rotated rect behind the wall, posts + 3 rails + a divider */
    const PEN = { cx: 53.8, cz: -23.2, w: 10.6, d: 6.2, yaw: wallYaw };
    const postG = new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6);
    const railG = new THREE.CylinderGeometry(0.045, 0.045, 1, 5);
    railG.rotateZ(Math.PI / 2);
    const posts = [], rails = [];
    const cos = Math.cos(PEN.yaw), sin = Math.sin(PEN.yaw);
    const toW = (u, v) => [PEN.cx + u * sin + v * cos, PEN.cz + u * cos - v * sin];
    const sides = [
      [[-PEN.w / 2, -PEN.d / 2], [PEN.w / 2, -PEN.d / 2]],
      [[PEN.w / 2, -PEN.d / 2], [PEN.w / 2, PEN.d / 2]],
      [[PEN.w / 2, PEN.d / 2], [-PEN.w / 2, PEN.d / 2]],
      [[-PEN.w / 2, PEN.d / 2], [-PEN.w / 2, -PEN.d / 2]],
      [[0, -PEN.d / 2], [0, PEN.d / 2]],          /* divider — two pens as painted */
    ];
    for (const [[au, av], [bu, bv]] of sides) {
      const len = Math.hypot(bu - au, bv - av);
      const n = Math.max(2, Math.round(len / 1.3));
      for (let k = 0; k <= n; k++) {
        const t = k / n, [x, z] = toW(au + (bu - au) * t, av + (bv - av) * t);
        posts.push({ x, z, lean: (rnd() - 0.5) * 0.1, s: 0.9 + rnd() * 0.25 });
      }
      for (let k = 0; k < n; k++) {
        const tm = (k + 0.5) / n;
        const [x, z] = toW(au + (bu - au) * tm, av + (bv - av) * tm);
        const ang = Math.atan2((bu - au) * sin + (bv - av) * cos, (bu - au) * cos - (bv - av) * sin);
        for (let course = 0; course < 3; course++) {
          rails.push({ x, z, y: 1.35 + 0.3 + course * 0.28 + (rnd() - 0.5) * 0.03,
            ang, len: len / n * 1.06, bow: (rnd() - 0.5) * 0.06 });
        }
      }
    }
    const postIM = new THREE.InstancedMesh(postG, flatMat({ color: '#6e4a2a' }), posts.length);
    const railIM = new THREE.InstancedMesh(railG, flatMat({ color: '#7a5c36' }), rails.length);
    posts.forEach((pp, i) => {
      e.set(pp.lean, 0, pp.lean * 0.7); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(pp.x, 1.35 + 0.5, pp.z), q, new THREE.Vector3(1, pp.s, 1));
      postIM.setMatrixAt(i, m4);
      postIM.setColorAt(i, col.set('#6e4a2a').multiplyScalar(0.85 + rnd() * 0.3));
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
    const penGrp = new THREE.Group();
    penGrp.name = 'pens'; parts['pens'] = penGrp;
    penGrp.add(postIM, railIM);
    grp.add(penGrp);

    /* the flock: 6 sheep, painted 1.8 m at the world frame (local truth 1.05 m
       at the lobe's 19.5 px/m — the dual-scale ruling, stated, not hidden) */
    const bodyG = new THREE.IcosahedronGeometry(0.62, 1);
    bodyG.scale(1.3, 0.72, 0.62);
    const headG = new THREE.BoxGeometry(0.22, 0.22, 0.34);
    const srnd = mulberry32(70971);
    const spots = [];
    let guard = 0;
    while (spots.length < 6 && guard++ < 200) {
      const u = -PEN.w / 2 + 0.8 + srnd() * (PEN.w - 1.6);
      const v = -PEN.d / 2 + 0.8 + srnd() * (PEN.d - 1.6);
      const [x, z] = toW(u, v);
      if (spots.some((s0) => Math.hypot(s0.x - x, s0.z - z) < 1.5)) continue;
      spots.push({ x, z, a: srnd() * Math.PI * 2 });
    }
    const wool = new THREE.InstancedMesh(bodyG, flatMat({ color: '#e8e2d4', roughness: 1 }), spots.length);
    const face = new THREE.InstancedMesh(headG, flatMat({ color: '#4a3a2c' }), spots.length);
    spots.forEach((s0, i) => {
      e.set(0, s0.a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s0.x, 1.35 + 0.5, s0.z), q, new THREE.Vector3(1, 1, 1));
      wool.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(s0.x + Math.sin(s0.a) * 0.78, 1.35 + 0.62, s0.z + Math.cos(s0.a) * 0.78),
        q, new THREE.Vector3(1, 1, 1));
      face.setMatrixAt(i, m4);
      wool.setColorAt(i, col.setScalar(0.9 + srnd() * 0.14));
    });
    wool.castShadow = true;
    wool.name = 'sheep-flock'; face.name = 'sheep-face';
    parts['sheep-flock'] = wool;
    penGrp.add(wool, face);            /* the flock lives in the pens (spec parent) */
    track('yard-and-pens', grp);
  }

  /* ===== MESO: trees — laurels at the mouth + yard + crown bushes ===== */
  {
    const grp = new THREE.Group();
    const laurels = new THREE.Group(); laurels.name = 'laurels'; parts['laurels'] = laurels;
    const yardTrees = new THREE.Group(); yardTrees.name = 'yard-trees'; parts['yard-trees'] = yardTrees;
    grp.add(laurels, yardTrees);
    const tree = (into, x, y, z, s, seed, tones = ['#5f7a44', '#6e8c50', '#93a86a']) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.4, 6), flatMat({ color: '#4a3226' }));
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      g.add(trunk);
      const R = mulberry32(seed);
      for (let i = 0; i < 4; i++) {
        const cg = jitterByPos(new THREE.IcosahedronGeometry(1.15 - i * 0.18, 0), seed + i, 0.16);
        const c = new THREE.Mesh(facetColors(cg, tones[i % 3], seed + i, 0.12),
          flatMat({ vertexColors: true }));
        c.position.set((R() - 0.5) * 1.1, 2.1 + i * 0.85, (R() - 0.5) * 1.1);
        c.castShadow = true;
        g.add(c);
      }
      g.scale.setScalar(s);
      g.position.set(x, y, z);
      into.add(g);
    };
    tree(laurels, X(912), 1.3, ZH(230, 1.4), 1.5, 72001);   /* laurel left of the mouth */
    tree(laurels, X(1085), 1.3, ZH(285, 1.4), 1.35, 72002); /* laurel right of the mouth */
    tree(yardTrees, X(955), 1.35, ZH(310, 1.4), 0.95, 72003); /* yard tree by the wall */
    tree(yardTrees, X(1120), 0.4, ZH(350, 0.5), 0.85, 72004); /* apron-edge tree east */
    /* olive scrub — TWO systems as specified: the crag bushes and the rim bushes */
    const rnd = mulberry32(72010);
    const bushG = jitterByPos(new THREE.IcosahedronGeometry(1, 0), 72010, 0.18);
    const bushGeo = facetColors(bushG, '#8a8c4e', 72010, 0.14);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    const fill = (im, spots) => {
      spots.forEach((s0, i) => {
        e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e);
        const sc = 0.9 + rnd() * 0.9;
        m4.compose(new THREE.Vector3(s0[0], s0[1], s0[2]), q, new THREE.Vector3(sc, sc * 0.75, sc));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, col.set(rnd() < 0.4 ? '#6e7440' : '#8a8c4e').multiplyScalar(0.85 + rnd() * 0.3));
      });
      im.count = spots.length;
      im.castShadow = true;
      grp.add(im);
    };
    /* the crag bushes: at the spire feet AND on the ledges (the plate's own read) */
    const CRAG_SPOTS = [
      [-16.2, 0.5, -4.2], [-11.5, 0.4, 1.2], [-19.5, 0.5, 0.5], [-9.0, 0.4, 6.0],
      [-17.2, 5.6, -6.2], [-13.0, 4.2, -0.8], [-20.0, 3.0, 2.0], [-15.0, 8.2, -6.8],
      [-22.3, 1.4, 4.8], [-12.4, 2.3, 3.4],
    ];
    const BEACH_SPOTS = [
      [48, 10.5, -42], [52.5, 10.6, -47], [59, 10.2, -44], [45, 10.0, -48], [56, 10.6, -52],
      [44.5, 1.9, -25], [59.5, 1.9, -21],
      [-1.6, 0.35, 16.8], [-9.6, 0.35, 14.9], [3.3, 0.35, 19.6], [9.5, 0.35, 13.9],
      [-15.5, 0.35, 9.5], [14.5, 0.35, 16.5],
      [-12.2, 0.35, -18.1], [-7.8, 0.35, -23.7], [-2.5, 0.35, -26.5], [4.5, 0.35, -28.0],
    ];
    const cragIM = new THREE.InstancedMesh(bushGeo, flatMat({ vertexColors: true }), CRAG_SPOTS.length);
    cragIM.name = 'crag-bushes'; parts['crag-bushes'] = cragIM;
    fill(cragIM, CRAG_SPOTS);
    const beachIM = new THREE.InstancedMesh(bushGeo, flatMat({ vertexColors: true }), BEACH_SPOTS.length);
    beachIM.name = 'beach-bushes'; parts['beach-bushes'] = beachIM;
    fill(beachIM, BEACH_SPOTS);
    track('trees-and-bushes', grp);
  }

  /* ===== MESO: goat-island crags (pale spires, west) ===== */
  {
    const grp = new THREE.Group();
    const spire = (x, z, h, r, seed, leanX = -0.05, leanZ = 0.03) => {
      const g = new THREE.ConeGeometry(r, h, 7, 4);
      g.translate(0, h / 2, 0);
      jitterByPos(g, seed, r * 0.34);
      const m = new THREE.Mesh(facetColors(g, '#aaa6a0', seed, 0.15), flatMat({ vertexColors: true }));
      m.position.set(x, 0, z);
      m.rotation.set(leanX, 0, leanZ);
      m.castShadow = true;
      grp.add(m);
    };
    spire(-18.5, -7, 21, 3.6, 73001, -0.07, 0.05);   /* the tall crag */
    spire(-13.2, -1, 14.5, 3.1, 73002, -0.05, -0.04);
    spire(-20.8, 2.5, 9.5, 2.5, 73003, -0.03, 0.06);
    spire(-10.5, 4.5, 6.2, 2.1, 73004, 0.02, -0.02);
    /* grey boulders at the feet + along the sand */
    const rnd = mulberry32(73010);
    const bG = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 73010, 0.2);
    const bIM = new THREE.InstancedMesh(facetColors(bG, '#9a9aa0', 73010, 0.14),
      flatMat({ vertexColors: true }), 12);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    const B = [[-15.5, 2.8], [-9.0, 7.5], [-22.5, 6.5], [10.8, 12.2], [14.3, 13.8],
      [16.2, 10.5], [-6.2, 10.8], [12.8, 15.6], [-24.5, 2.0], [8.3, 15.2], [17.5, 14.6], [-18.0, 8.8]];
    B.forEach((s0, i) => {
      e.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4); q.setFromEuler(e);
      const sc = 0.5 + rnd() * 0.9;
      m4.compose(new THREE.Vector3(s0[0], 0.25 * sc, s0[1]), q, new THREE.Vector3(sc, sc * 0.8, sc));
      bIM.setMatrixAt(i, m4);
      bIM.setColorAt(i, col.set('#9a9aa0').multiplyScalar(0.8 + rnd() * 0.36));
    });
    bIM.castShadow = true;
    bIM.name = 'beach-boulders'; parts['beach-boulders'] = bIM;
    grp.add(bIM);
    track('crag-spires', grp);
  }

  /* ===== MESO: THE TWO BLACK SHIPS (hulls, masts, shipped oars) ===== */
  const makeShip = ({ id, seed, oarSide, oarPitch = -0.62, mastRake = 0.03 }) => {
    const grp = new THREE.Group();
    const L = 15, BEAM = 2.7, DEPTH = 1.05, SHEER = 0.65, TOP = 1.35;
    /* hull: box lattice sculpted — width tapers to the posts, sheer rises at the
       ends, keel rounds under; the closed top face IS the deck (painted timber) */
    const hg = new THREE.BoxGeometry(1, 1, 1, 16, 3, 4).toNonIndexed();
    const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const t = hp.getX(i);                         /* -0.5..0.5 along the keel */
      const half = Math.pow(Math.max(0.001, Math.cos(Math.PI * t)), 0.62);
      const yTop = TOP + SHEER * Math.pow(Math.abs(t * 2), 3.2);
      const yBot = -DEPTH * Math.pow(half, 0.85);
      const v = hp.getY(i) + 0.5;                   /* 0 bottom .. 1 top */
      hp.setXYZ(i, t * L, yBot + (yTop - yBot) * v, hp.getZ(i) * BEAM * half);
    }
    jitterByPos(hg, seed, 0.06);
    const geo = facetColors(hg, '#1d1a18', seed, 0.16);
    /* deck read: top faces get the warm timber */
    {
      const pos = geo.attributes.position, col = geo.attributes.color;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3(), n = new THREE.Vector3();
      const deck = new THREE.Color('#5a4028');
      const rnd = mulberry32(seed + 3);
      for (let f = 0; f < pos.count / 3; f++) {
        a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
        c3.fromBufferAttribute(pos, f * 3 + 2);
        n.copy(b).sub(a).cross(c3.clone().sub(a));
        if (n.y > 0.72 * n.length()) {
          const v = 0.8 + rnd() * 0.35;
          for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, deck.r * v, deck.g * v, deck.b * v);
        }
      }
      col.needsUpdate = true;
    }
    const hull = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 0.9 }));
    hull.castShadow = true;
    grp.add(hull);
    /* stem + stern posts: black curled tubes */
    for (const end of [-1, 1]) {
      const x0 = end * (L / 2 - 0.35);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, TOP - 0.5, 0),
        new THREE.Vector3(x0 + end * 0.55, TOP + 0.9, 0),
        new THREE.Vector3(x0 + end * 0.65, TOP + 2.0, 0),
        new THREE.Vector3(x0 - end * 0.25, TOP + 2.6, 0),
        new THREE.Vector3(x0 - end * 0.75, TOP + 2.45, 0),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.16, 5),
        flatMat({ color: '#191614', roughness: 0.9 }));
      tube.castShadow = true;
      grp.add(tube);
    }
    /* thwarts: 5 benches across the deck */
    for (let i = 0; i < 5; i++) {
      const t = -0.3 + i * 0.15;
      const half = Math.pow(Math.cos(Math.PI * t), 0.62);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, BEAM * half * 0.92),
        flatMat({ color: '#6b4a2e' }));
      bench.position.set(t * L, TOP + 0.06, 0);
      grp.add(bench);
    }
    /* the bare mast (ledger: 105 px = 9.3 m), slight rake + masthead knob */
    const mast = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 9.3, 6),
      flatMat({ color: '#5a4530' }));
    pole.position.y = 9.3 / 2;
    pole.castShadow = true;
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), flatMat({ color: '#3a2c1e' }));
    knob.position.y = 9.35;
    mast.add(pole, knob);
    mast.position.set(-L * 0.03, TOP - 0.4, 0);
    mast.rotation.z = mastRake;
    mast.name = id + '-mast'; parts[id + '-mast'] = mast;
    grp.add(mast);
    /* SHIPPED OARS: fanned from the gunwale down to the sand on the painted side */
    const N = 8;
    const shaftG = new THREE.CylinderGeometry(0.05, 0.05, 5.0, 5);
    const bladeG = new THREE.BoxGeometry(0.06, 1.0, 0.26);
    const shaftIM = new THREE.InstancedMesh(shaftG, flatMat({ color: '#8a6a42' }), N);
    const bladeIM = new THREE.InstancedMesh(bladeG, flatMat({ color: '#7a5c38' }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    const rnd = mulberry32(seed + 7);
    for (let i = 0; i < N; i++) {
      const t = -0.3 + (i / (N - 1)) * 0.62;
      const half = Math.pow(Math.cos(Math.PI * t), 0.62);
      const gx = t * L, gz = oarSide * BEAM * half * 0.5;
      const pitch = oarPitch + (rnd() - 0.5) * 0.1;
      const yawJ = (rnd() - 0.5) * 0.16;
      e.set(pitch, yawJ, 0, 'YXZ'); q.setFromEuler(e);
      /* shaft centre 2.5 m out from the gunwale pivot along the oar direction */
      const dir = new THREE.Vector3(0, Math.sin(pitch), oarSide * Math.cos(pitch)).normalize();
      e.set(oarSide * (Math.PI / 2 + pitch * -oarSide * 0), 0, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        dir.clone().multiplyScalar(-1).normalize());
      m4.compose(
        new THREE.Vector3(gx + yawJ * 2, TOP - 0.1 + dir.y * 2.5, gz + dir.z * 2.5),
        quat, new THREE.Vector3(1, 1, 1));
      shaftIM.setMatrixAt(i, m4);
      shaftIM.setColorAt(i, col.set('#8a6a42').multiplyScalar(0.82 + rnd() * 0.3));
      m4.compose(
        new THREE.Vector3(gx + yawJ * 2, TOP - 0.1 + dir.y * 4.6, gz + dir.z * 4.6),
        quat, new THREE.Vector3(1, 1, 1));
      bladeIM.setMatrixAt(i, m4);
      bladeIM.setColorAt(i, col.set('#7a5c38').multiplyScalar(0.82 + rnd() * 0.3));
    }
    shaftIM.castShadow = bladeIM.castShadow = true;
    shaftIM.name = id + '-oars'; parts[id + '-oars'] = shaftIM;
    bladeIM.name = id + '-oar-blades';
    grp.add(shaftIM, bladeIM);
    return grp;
  };
  {
    /* ship-1: bow (440,400) -> sternCurl (598,345), painted heights subtracted */
    const A = [X(440), ZH(400, 1.6)], B = [X(598), ZH(345, 2.4)];
    const ship1 = makeShip({ id: 'ship-1', seed: 74001, oarSide: 1, mastRake: 0.04 });
    ship1.position.set((A[0] + B[0]) / 2, 0.18, (A[1] + B[1]) / 2);
    ship1.rotation.y = Math.atan2(B[0] - A[0], B[1] - A[1]) + Math.PI / 2;
    track('ship-1', ship1);
    /* ship-2: sternCurl (516,432) -> prowCurl (686,428) — THE YARDSTICK */
    const C = [X(516), ZH(432, 2.0)], D = [X(686), ZH(428, 2.0)];
    const ship2 = makeShip({ id: 'ship-2', seed: 74002, oarSide: -1, mastRake: -0.02 });
    ship2.position.set((C[0] + D[0]) / 2, 0.18, (C[1] + D[1]) / 2);
    ship2.rotation.y = Math.atan2(D[0] - C[0], D[1] - C[1]) + Math.PI / 2;
    track('ship-2', ship2);
  }

  /* ===== MESO: THE CAMPFIRE — hero ring + the shared blaze ===== */
  const FIRE = { x: 0, z: 0 };
  {
    const grp = new THREE.Group();
    const rnd = mulberry32(71002);
    const stoneG = jitterByPos(new THREE.IcosahedronGeometry(0.4, 1), 71002, 0.1);
    stoneG.computeVertexNormals();
    const N = 13;
    const ringIM = new THREE.InstancedMesh(stoneG, flatMat({ color: '#ffffff' }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 2.0 + (rnd() - 0.5) * 0.3;
      e.set(rnd() * 0.5, rnd() * Math.PI, rnd() * 0.5); q.setFromEuler(e);
      m4.compose(
        new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r),
        q, new THREE.Vector3(1 + rnd() * 0.7, 0.75 + rnd() * 0.5, 0.9 + rnd() * 0.5));
      ringIM.setMatrixAt(i, m4);
      ringIM.setColorAt(i, col.set('#6a655e').multiplyScalar(0.85 + rnd() * 0.3));
    }
    ringIM.castShadow = true;
    ringIM.name = 'ring-stones'; parts['ring-stones'] = ringIM;
    grp.add(ringIM);
    /* pit + ember bed */
    const pg = new THREE.CircleGeometry(1.7, 16);
    pg.rotateX(-Math.PI / 2);
    const pit = new THREE.Mesh(pg, flatMat({ color: '#4a382a' }));
    pit.position.y = 0.03;
    grp.add(pit);
    const eg = new THREE.CircleGeometry(1.35, 14).toNonIndexed();
    eg.rotateX(-Math.PI / 2);
    const ep = eg.attributes.position, ec = new Float32Array(ep.count * 3);
    const hot = new THREE.Color('#ff9a3a'), cool = new THREE.Color('#7a2408');
    for (let i = 0; i < ep.count; i++) {
      const d = Math.hypot(ep.getX(i), ep.getZ(i)) / 1.35;
      const c = hot.clone().lerp(cool, d);
      ec.set([c.r, c.g, c.b], i * 3);
    }
    eg.setAttribute('color', new THREE.BufferAttribute(ec, 3));
    const emberMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const ember = new THREE.Mesh(eg, emberMat);
    ember.position.y = 0.06;
    grp.add(ember);
    tickers.push((t, f, day) => { emberMat.color.setScalar(day ? 0.16 : 0.7 + 0.5 * f); });
    /* crossed burning logs */
    const logG = new THREE.CylinderGeometry(0.15, 0.19, 2.0, 7);
    const fireLogMats = [];
    const fireLogs = new THREE.Group();
    fireLogs.name = 'fire-logs'; parts['fire-logs'] = fireLogs;
    for (let i = 0; i < 4; i++) {
      const lm = flatMat({ color: '#3a281e', emissive: '#7a2408', emissiveIntensity: 1.2 });
      const log = new THREE.Mesh(logG, lm);
      log.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2 + 0.3, 0, 'YXZ');
      log.position.y = 0.4;
      log.castShadow = true;
      fireLogMats.push(lm);
      fireLogs.add(log);
    }
    grp.add(fireLogs);
    tickers.push((t, f, day) => {
      for (const lm of fireLogMats) lm.emissiveIntensity = day ? 0 : 1.2 * f;
    });
    /* THE BLAZE — the cave's fire, from the shared module (pure f(uTime)) */
    const flames = fireSystem({ count: 260, seed: 70906, radius: 0.85, height: 3.6, size: 1.05, mode: 'flame' });
    const embers = fireSystem({ count: 80, seed: 70956, radius: 0.7, height: 4.6, size: 0.2, mode: 'ember' });
    const smoke = fireSystem({ count: 40, seed: 70976, radius: 0.8, height: 6.2, size: 2.0, mode: 'smoke' });
    smoke.position.y = 1.6;
    flames.name = 'blaze'; parts['blaze'] = flames;
    embers.name = 'blaze-embers'; smoke.name = 'blaze-smoke';
    grp.add(flames, embers, smoke);
    fireParts.push(flames, embers, smoke);
    tickers.push((t) => {
      flames.material.uniforms.uTime.value = t;
      embers.material.uniforms.uTime.value = t;
      smoke.material.uniforms.uTime.value = t * 0.5;
    });
    /* bloom halo (the plate's own shore-bloom layer) */
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,190,90,0.55)', 'rgba(255,120,30,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(10);
    halo.position.y = 1.6;
    grp.add(halo);
    fireParts.push(halo);
    tickers.push((t, f) => { halo.material.opacity = 0.5 + 0.45 * (f - 0.84); });
    grp.position.set(FIRE.x, 0, FIRE.z);
    track('campfire', grp);
  }

  /* ===== MESO: driftwood + camp pebbles ===== */
  {
    const grp = new THREE.Group();
    const LOGS = [
      [-5.6, 4.0, 0.45, 2.7, '#a89070'],   /* the pale log NW */
      [-3.1, 7.9, 1.25, 3.2, '#3a2c20'],
      [2.7, 7.1, 0.5, 2.4, '#42301f'],
      [-6.4, -2.2, 1.9, 2.2, '#38291c'],
    ];
    LOGS.forEach(([x, z, yaw, len, hex], i) => {
      const g = new THREE.CylinderGeometry(0.17, 0.21, len, 7);
      g.rotateZ(Math.PI / 2);
      jitterByPos(g, 71011 + i, 0.05);
      const log = new THREE.Mesh(facetColors(g, hex, 71011 + i, 0.12), flatMat({ vertexColors: true }));
      log.position.set(x, 0.19, z);
      log.rotation.y = yaw;
      log.castShadow = true;
      grp.add(log);
    });
    const rnd = mulberry32(71021);
    const pg = new THREE.IcosahedronGeometry(0.16, 0);
    const pIM = new THREE.InstancedMesh(pg, flatMat({ color: '#241f1c' }), 3);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    [[3.2, 0.4], [4.1, 1.1], [3.7, -0.5]].forEach((s0, i) => {
      e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s0[0], 0.08, s0[1]), q,
        new THREE.Vector3(0.9 + rnd() * 0.5, 0.7, 0.9 + rnd() * 0.5));
      pIM.setMatrixAt(i, m4);
    });
    pIM.name = 'fire-pebbles'; parts['fire-pebbles'] = pIM;
    grp.add(pIM);
    track('driftwood', grp);
  }

  /* ===== MESO: the three highland smoke fires + SMOKE COLUMNS ===== */
  {
    const grp = new THREE.Group();
    const fires = new THREE.Group();
    fires.name = 'smoke-fires'; parts['smoke-fires'] = fires;
    grp.add(fires);
    /* seated ON the crown cap (y ≈ 10.05) and the east ledge shoulder (y ≈ 5.9) */
    const SMOKES = [
      { x: X(955), y: 10.1, z: -43.5, seed: 75001 },
      { x: X(1030), y: 10.15, z: -46.5, seed: 75002 },
      { x: 63.5, y: 5.9, z: -30.5, seed: 75003 },      /* the east-ledge fire (ledger x 1140) */
    ];
    const rnd = mulberry32(75000);
    for (const s0 of SMOKES) {
      const fg = new THREE.Group();
      /* the log pile */
      for (let i = 0; i < 5; i++) {
        const lg = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5);
        const log = new THREE.Mesh(lg, flatMat({ color: '#3a2c20', emissive: '#5a2008', emissiveIntensity: 0.5 }));
        log.rotation.set(Math.PI / 2 - 0.4, rnd() * Math.PI * 2, 0, 'YXZ');
        log.position.y = 0.2;
        fg.add(log);
      }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10),
        new THREE.MeshBasicMaterial({ color: '#b84a18' }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.07;
      fg.add(glow);
      /* the column — the shared smoke system, tall + slow */
      const column = fireSystem({ count: 52, seed: s0.seed, radius: 0.55, height: 15, size: 2.6, mode: 'smoke' });
      column.position.y = 0.5;
      fg.add(column);
      tickers.push((t) => { column.material.uniforms.uTime.value = t * 0.32; });
      fg.position.set(s0.x, s0.y, s0.z);
      fires.add(fg);
    }
    track('smoke-columns', grp);
  }

  /* ===== the flickering fire light — THE one shadow caster ===== */
  const fireLight = new THREE.PointLight('#ffbf4a', 620, 0, 2);
  fireLight.position.set(FIRE.x, 2.2, FIRE.z + 0.4);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(1024, 1024);
  fireLight.shadow.camera.near = 0.3;
  fireLight.shadow.camera.far = 60;
  fireLight.shadow.bias = -0.004;
  root.add(fireLight);
  const bounce = new THREE.PointLight('#ff9a4a', 160, 0, 1.7);
  bounce.position.set(FIRE.x, 4.6, FIRE.z + 0.6);
  root.add(bounce);
  const flick = flickCurve;
  let dayState = 0;
  tickers.push((t, f, day) => {
    fireLight.intensity = day ? 0 : 620 * f;
    bounce.intensity = day ? 0 : 160 * (0.7 + 0.3 * f);
  });

  /* ===== the light rigs: night (the book's frame) / dawn preset ===== */
  const hemi = new THREE.HemisphereLight('#44598c', '#4a3524', 1.15);
  const moon = new THREE.DirectionalLight('#9db8ff', 0.65);
  moon.position.set(-35, 58, 62);                  /* high front-left — the plate's pale faces
                                                      (the path's own moon stays in the shader) */
  const sun = new THREE.DirectionalLight('#ffc9a0', 0);
  sun.position.set(95, 32, 18);                    /* dawn, low from the east */
  root.add(hemi, moon, sun);
  parts['light-rig'] = hemi;

  const setState = (state) => {
    const day = state === 'day' ? 1 : 0;
    dayState = day;
    skyGeo.setAttribute('color', day ? skyDawn : skyNight);
    for (const o of nightOnly) o.visible = !day;
    for (const o of fireParts) o.visible = !day;
    waterMat.uniforms.uDay.value = day;
    hemi.color.set(day ? '#e0a9a0' : '#44598c');
    hemi.groundColor.set(day ? '#6a5a48' : '#4a3524');
    hemi.intensity = day ? 1.3 : 1.15;
    moon.intensity = day ? 0 : 0.85;
    sun.intensity = day ? 1.7 : 0;
    return state;
  };
  setState('night');

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
    for (const fn of tickers) fn(simT, f, dayState);
  };
  root.userData.sculptRuntime = {
    nodes: Object.keys(parts).length,
    triangles,
    sockets: {
      'root:fire-anchor': [FIRE.x, 0, FIRE.z],
      'root:council-mark': [X(563), 0, Z(499)],
      'root:crossing-gate': [X(600), 0, ZH(455, 0.8)],   /* G1-ship, hull centre */
      'root:entry-mainland': [X(1008), 0, Z(268)],
    },
    colliders: OBSTACLES,
  };
  const setPixelScale = (pxPerMetre) => { PX_UNIFORM.value = pxPerMetre; };
  return { root, tick, setState, fireLight, flick, parts, triangles, FIRE, setPixelScale };
}

/* ---------------- the book's isometric camera + orbit ---------------- */
export function createShoreIsoCamera(aspect = 1408 / 768) {
  const HALF_W = 62.3;                             /* 1408 px / (2 · 11.3 px/m) */
  const cam = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_W / aspect, -HALF_W / aspect, 0.1, 900);
  const target = new THREE.Vector3(23.5, 2.6, -13.5);
  const R = 380;
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
