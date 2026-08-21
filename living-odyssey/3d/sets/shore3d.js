/**
 * shore3d.js — procedural Three.js FULL-3D SET (REBUILD)
 * THE SHORE (Book IX landfall): the goat-island beach camp facing the mainland
 * of the Cyclopes across the black strait — night state, fire lit, moonpath on.
 *
 * REBUILT to the cave's bar (demo3d/full3d/createCaveScene.js) after the first
 * shipped version stopped at blockout quality: img2threejs staged passes
 * blockout -> structure -> form -> material -> lighting against the plate
 * ../../assets/set/shore/shore.jpg, each pass render-gated. The rebuild's
 * review record is tools/shore-forge/rebuild/PASSLOG.md; the spec of record
 * stays tools/shore-forge/object-sculpt-spec.json (placements unchanged).
 *
 * THE FLOOR PLAN IS THE LEDGER (carried verbatim from the survey):
 *   X(px)     = (px - 438) / 11.3              metres, +east (origin = the campfire)
 *   Z(py)     = (py - 466) / (11.3·sin 28°)    metres, +downstage (campfire row = 0)
 *   ZH(py,h)  = Z(py + h·cos 28°·11.3)         plan depth of a point painted at height h
 *   Y up, camp sand = 0 exactly (the path law needs a true plane).
 * 11.3 px/m off ship-2 (the beached twenty-oarer, 15 m tip-to-tip); the 28°
 * comes from the camp-ring ellipse the plate itself paints (24/51 px).
 * The dual-scale ruling is carried: the mainland lobe is painted at 19.5 px/m
 * local truth; the build reproduces the PAINTING through the one 11.3 frame
 * and exports MAINLAND_S + bounds so actor mounting stays honest.
 *
 * THE HOLE-KILLER (what the rebuild changes): the island is ONE closed sculpted
 * mass — an icosphere whose top hemisphere maps onto a zoned heightfield (camp
 * sand exactly y=0; the strait a −1.9 m channel between the two audited
 * waterline chains; the yard terrace exactly +1.35) and whose bottom hemisphere
 * maps onto the faceted keel. The water is a facet plane clipped INSIDE the
 * island outline: it meets terrain below the rim by construction. No slabs,
 * no skirts, no seams — the turntable cannot find a hole.
 *
 * DETERMINISM LAW: every scatter/jitter is mulberry32-seeded; fire + the three
 * mainland smoke columns are the shared seeded GPU systems (position = pure
 * f(seed attrs, uTime)); the water is a facet-quantised shader, pure f(uTime).
 * tick(simT) writes uniforms + flicker only. setSim-safe.
 * DAY STATE = LIGHT RIG SWAP (dawn preset): geometry untouched.
 *
 * Exports (unchanged contract)
 *   createShoreScene()               -> { root, tick(simT), setState(s), fireLight,
 *                                         flick, parts, triangles, FIRE, setPixelScale }
 *   createShoreIsoCamera(aspect)     -> OrthographicCamera + .userData.setOrbit(azimuthDeg)
 *   SHORE_WORLD                      -> { S, SIN_E, ELEV, X, Z, ZH, MAINLAND_S,
 *                                         MAINLAND_BOUNDS, PATH_PTS, OBSTACLES, MARKS }
 */
import * as THREE from 'three';
import {
  mulberry32, hash3, jitterByPos, facetColors, dropFaces, flatMat, glowTexture,
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

/* ================= the island survey (world metres) =================
   ONE closed outline (star-shaped about ISLE_C) enclosing both lobes; the
   strait is a depressed channel between the two audited waterline chains. */
const ISLE_C = [22, -8];
const OUTLINE = [
  /* beach lobe: east tip downstage -> south rim -> west -> north */
  [38.2, 17.3], [32.0, 23.4], [18.8, 26.8], [3.7, 25.3], [-9.6, 19.6],
  [-18.4, 12.1], [-23.3, 7.35], [-23.9, 0.75], [-21.9, -6.8], [-18.4, -13.9],
  [-12.2, -21.5], [-5.1, -27.9], [2.8, -31.3], [9.5, -32.8],
  /* channel entrance (upper water-rim gap) */
  [39.1, -43.0],
  /* mainland lobe, upstage around east */
  [41.0, -49.0], [48.0, -55.0], [60.0, -56.0], [69.0, -48.0], [71.0, -35.1],
  [67.4, -25.6], [62.1, -18.5], [57.7, -13.9], [53.3, -12.8],
  /* channel exit gap closes back to the beach east tip */
];
const SHORE_CHAIN = [ /* the beach waterline (audited) — sand side +, water side − */
  [9.5, -32.8], [15.2, -25.6], [19.6, -16.2], [23.2, -6.8], [26.7, 0.75],
  [32.0, 10.2], [38.2, 17.3]];
const MAIN_CHAIN = [ /* the mainland waterline — water side +, land side − */
  [39.1, -43.0], [43.5, -27.5], [48.0, -17.2], [53.3, -12.8]];
const TERRACE_POLY = [ /* the yard terrace: pens/wall law needs exactly +1.35 */
  [41, -43], [62, -38], [61.5, -19.5], [52, -16.5], [43.5, -22], [42, -34]];
const WATER_Y = -0.26;

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function chainDist(chain, x, z) {       /* signed: sign of nearest segment's cross */
  let best = 1e9, sign = 1;
  for (let i = 0; i < chain.length - 1; i++) {
    const [ax, az] = chain[i], [bx, bz] = chain[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; sign = (dx * (z - az) - dz * (x - ax)) >= 0 ? 1 : -1; }
  }
  return best * sign;
}
function rayR(dx, dz) {                 /* outline distance from ISLE_C along (dx,dz) */
  let best = 6;
  for (let i = 0; i < OUTLINE.length; i++) {
    const [ax, az] = OUTLINE[i], [bx, bz] = OUTLINE[(i + 1) % OUTLINE.length];
    const ex = bx - ax, ez = bz - az;
    const det = ex * dz - ez * dx;
    if (Math.abs(det) < 1e-9) continue;
    const rx = ax - ISLE_C[0], rz = az - ISLE_C[1];
    const s = (ex * rz - ez * rx) / det;      /* along the ray */
    const u = (dx * rz - dz * rx) / det;      /* along the segment */
    if (s > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, s);
  }
  return best;
}
const ss = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/* THE TERRAIN LAW — every walkable height in one function (colliders + mounts read it) */
function terrainH(x, z) {
  const dS = chainDist(SHORE_CHAIN, x, z);
  const dM = chainDist(MAIN_CHAIN, x, z);
  if (dS < 0 && dM > 0) {                       /* THE STRAIT basin */
    const wet = Math.min(-dS, dM);
    return 0.05 - 1.95 * ss(0, 5.5, wet);
  }
  if (dM <= 0) {                                /* mainland lobe */
    if (pointInPoly(x, z, TERRACE_POLY)) return 1.35;
    return Math.min(1.35, 0.12 + 1.23 * ss(0, 9, -dM));
  }
  /* beach lobe */
  const dF = Math.hypot(x, z);                  /* the campfire is the origin */
  let h = dS < 2.6 ? 0.13 * (1 - dS / 2.6) * 0 + 0 : 0;  /* beach stays low to the water */
  const west = ss(9, 20, -(x + 4));
  const south = ss(4, 10, z) * ss(11, 22, dF);
  const north = ss(14, 20, -z) * ss(16, 26, dF);
  const crown = 0.9 * Math.max(west, Math.max(south * 0.8, north * 0.3));
  h += crown * ss(15.5, 21, dF);                /* the camp apron is a TRUE plane */
  return h;
}

/* ================= THE PLATE'S OWN MEASUREMENTS (round-2 defects) =================
   Every number below was measured off assets/set/shore/shore.jpg, not guessed.

   THE MOONPATH (W1). Band pixels isolated by a cool-water mask, then a PCA on the
   lit facets: image axis (0.0795, 0.9968) through the band centroid px (720,388)
   — i.e. the painted path runs almost straight downstage, not on the diagonal the
   first build used. Converting the image axis through the ledger's own scales
   (11.3 px/m across, 11.3·sin28 = 5.31 px/m into depth) gives the world direction
   (0.037, 0.999); the survey's audited chains push the near tail onto sand, so the
   build splits the difference at (0.169, 0.9856) and keeps the tail in the water.
   PERPENDICULAR PROFILE (mean luminance per 10 px lateral bin, plate px):
     u  -100  -60  -40  -20    0   20   40   60   80  100
     L   .32  .37  .53  .58  .598 .563 .482 .364 .256 .190     (dark water .17)
   -> FWHM 107-115 px ~ 10.5 m at the ledger's 11.3 px/m; 64-88 px at the far tip.
   BRIGHTNESS: band-body facet modes #8f95a0 (.58) .. #b5bcc6 (.74); only 6.3% of
   band pixels are near-white sparkle. So: facet bodies CAPPED at .84 luminance,
   near-white left to sub-facet sparkle at ~.87 — no blown quads.
   DARK WATER: modes #2c3037 (.19), #363b45 (.23), #434852 (.28) — it swells
   between those three, it is never one flat navy.

   THE TERRAIN (W2). Region colour modes off the plate:
     meadow olives  #3e3d17 (.23) · #514b25 (.29) · #59502e (.32) · #5c593f (.35)
     beach sand     #4c4320 (.26) · #6a592f (.35) · #947551 (.48) · #a58469 (.54)
     mainland sand  #856c4f (.44) dominant, shadowed #5b512d (.32)
     under-canopy   #141506 (.08) · #232314 (.14)  (the plate's darkest land tone)
   The night rig is blue-keyed, so these are TARGETS not albedos: the vertex paint
   below carries the plate's tonal RELATIONSHIPS (patchy olive meadow, a trodden
   sand path to the camp, canopy shade) into albedo the rig can render.

   THE HULLS (minor). Hull colour modes #45372d (.23) · #534438 (.28) · #503b2c
   (.25) — warm dark brown, not the near-black the first build shipped. */

/* THE MOONPATH FRAME — one source of truth for the mesh refinement and the shader */
const MOON_O = [24.2, -36.0];             /* the band's far origin, world metres */
const MOON_D = [0.036, 0.9994];           /* its axis, straight off the plate */
const W_TIP = 7.4, W_FAR = 10.0;          /* half-widths: FWHM 1.3w = 9.6 m .. 13.0 m */
/* Round 2 clamped every facet to 0.84 to kill whole-quad twinkle confetti. Round 4
   replaces the twinkle gate with a STABLE shard mosaic, so the ceiling can go back
   to where the plate actually sits: its band measures p95 0.981 / max 1.000, and
   its brightest crest slivers ARE near-white. 0.94 keeps the roll-off honest. */
const FACET_CAP = 0.94;
const moonAlong = (x, z) => (x - MOON_O[0]) * MOON_D[0] + (z - MOON_O[1]) * MOON_D[1];
const moonLat = (x, z) =>
  Math.abs((x - MOON_O[0]) * MOON_D[1] - (z - MOON_O[1]) * MOON_D[0]);
const moonWidth = (along) =>
  W_TIP + (W_FAR - W_TIP) * Math.min(1, Math.max(0, (along + 6) / 38));

/* one level of midpoint refinement on the triangles a predicate selects. The
   children sit ON the parent plane, so a refined patch can neighbour an
   unrefined one without a crack or a T-junction gap. */
function subdivideNear(geo, want) {
  const p = geo.attributes.position;
  const out = [];
  const push = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let f = 0; f < p.count / 3; f++) {
    const v = [0, 1, 2].map((k) => [p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)]);
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3;
    if (!want(cx, cz)) { push(v[0], v[1], v[2]); continue; }
    const m01 = mid(v[0], v[1]), m12 = mid(v[1], v[2]), m20 = mid(v[2], v[0]);
    push(v[0], m01, m20); push(m01, v[1], m12); push(m20, m12, v[2]); push(m01, m12, m20);
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  return ng;
}

/* the audited beach walk in WORLD metres — the trodden sand path the plate paints */
const PATH_W = PATH_PTS.map(([px, py]) => [X(px), Z(py)]);

/* trees + bushes hoisted to module scope: the island's vertex paint needs their
   footprints (the plate keeps a darker patch under every canopy) */
const LAUREL_TREES = [           /* [x, y, z, scale, seed] — the mouth laurels */
  [X(912), 1.5, ZH(230, 1.4), 1.55, 82001],
  [X(1085), 1.45, ZH(285, 1.4), 1.4, 82002],
];
const YARD_TREES = [
  [48.0, 11.0, -48.0, 0.95, 82003],
  [60.0, 11.0, -50.0, 0.85, 82004],
  [51.0, 11.0, -39.5, 0.8, 82005],
  [X(955), 1.35, ZH(310, 1.4), 0.95, 82006],
  [X(1120), 1.3, ZH(350, 0.5), 0.8, 82007],
  [66.0, 6.2, -29.5, 0.7, 82008],
];
/* THE CRAG TUFTS (round-4 minor). The plate does not scatter a few pebble-sized
   bushes at the spire feet: it drapes BIG olive tufts across the crag flanks —
   one broad mass halfway up the tall spire, another spilling off the second, and
   a continuous olive skirt round all four feet. Count goes 10 -> 22 and the fill
   scales them up (the [3] entry is a per-spot size multiplier). */
const CRAG_SPOTS = [             /* [x, y, z, sizeMul] — spire feet + climbing the ledges */
  [-16.2, 0.7, -4.2, 1.5], [-11.5, 0.5, 1.2, 1.3], [-19.5, 0.8, 0.5, 1.4],
  [-9.0, 0.45, 6.0, 1.2], [-14.0, 0.7, 4.0, 1.45], [-17.6, 5.4, -6.0, 1.7],
  [-13.4, 4.0, -0.6, 1.5], [-15.2, 8.0, -6.6, 1.8], [-19.8, 3.2, 2.2, 1.3],
  [-12.4, 2.3, 3.4, 1.35],
  /* the flank draperies the plate paints ACROSS the faces. Each one is solved onto
     its spire's own downstage surface: cone radius at height y is r*(1 - y/h), and
     the tuft is seated at ~0.85 of it so it bites into the rock instead of floating
     in front of it. Spires: (-18.5,-7) h21 r3.6 · (-13.2,-1) h14.5 r3.1 ·
     (-20.8,2.5) h9.5 r2.5 · (-10.5,4.5) h6.2 r2.1. */
  [-18.0, 9.5, -5.3, 1.55], [-19.9, 5.2, -4.7, 1.4], [-18.9, 13.0, -5.9, 1.15],
  [-12.6, 6.2, 0.55, 1.35], [-14.3, 2.8, 1.15, 1.45],
  [-21.4, 3.8, 3.85, 1.2], [-10.1, 2.6, 5.55, 1.2],
  /* the olive skirt round the feet */
  [-22.4, 0.5, 3.6, 1.5], [-21.0, 0.6, -2.4, 1.35], [-8.2, 0.4, 3.0, 1.25],
  [-13.0, 0.5, -7.6, 1.4], [-17.2, 0.6, 7.0, 1.45], [-9.6, 0.5, 9.0, 1.2],
];
const BEACH_SPOTS = [
  /* beach SW cluster + south rim + north rim */
  [1.5, 0.45, 18.5], [4.8, 0.5, 20.5], [-1.8, 0.55, 20.0], [7.5, 0.45, 17.5], [3.0, 0.55, 23.0],
  [13.0, 0.6, 14.5], [17.0, 0.6, 12.8], [10.3, 0.5, 15.8],
  [-3.0, 0.2, -24.5], [2.0, 0.15, -27.0], [-8.0, 0.25, -21.5],
  /* mainland crown rim + apron + yard */
  [47.5, 11.15, -39.0], [63.0, 11.1, -42.0], [56.0, 11.15, -51.5],
  [43.5, 0.55, -24.5], [60.5, 1.45, -17.5], [51.0, 1.45, -30.0],
];
/* [x, z, radius] shade footprints — canopies read wider than their trunks */
const CANOPY = [
  ...LAUREL_TREES.map(([x, , z, s]) => [x, z, 2.5 * s + 0.9]),
  ...YARD_TREES.map(([x, , z, s]) => [x, z, 2.5 * s + 0.9]),
  ...CRAG_SPOTS.map(([x, , z, m = 1]) => [x, z, 1.9 * m]),
  ...BEACH_SPOTS.map(([x, , z]) => [x, z, 1.9]),
];

/* smooth seeded lattice noise — the meadow's patch field (deterministic, crack-free:
   it is a pure function of world position, so shared verts always agree) */
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const n00 = hash3(xi, 0, zi, seed), n10 = hash3(xi + 1, 0, zi, seed);
  const n01 = hash3(xi, 0, zi + 1, seed), n11 = hash3(xi + 1, 0, zi + 1, seed);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sz) + (n01 * (1 - sx) + n11 * sx) * sz;
}
/* two octaves: broad zones the eye reads as terrain, plus facet-scale break-up */
const patchField = (x, z) =>
  0.64 * vnoise(x / 11.0, z / 11.0, 80981) + 0.36 * vnoise(x / 3.8, z / 3.8, 80982);
/* how deep in a canopy's shade a point sits, 0..1 */
function canopyShade(x, z) {
  let s = 0;
  for (const [cx, cz, r] of CANOPY) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) s = Math.max(s, 1 - (d / r) * (d / r));
  }
  return s;
}
/* distance to the camp walk, metres (the plate's trodden sand track) */
const pathDist = (x, z) => Math.abs(chainDist(PATH_W, x, z));

/* seeded facet value jitter for zone colors */
function tone(hex, seedInt, amount = 0.09) {
  const h = ((Math.imul(seedInt | 0, 2654435761) >>> 16) / 65536 - 0.5) * 2 * amount;
  const c = new THREE.Color(hex);
  c.r = Math.min(1, Math.max(0, c.r * (1 + h)));
  c.g = Math.min(1, Math.max(0, c.g * (1 + h)));
  c.b = Math.min(1, Math.max(0, c.b * (1 + h)));
  return c;
}

/* THE MEADOW RAMP — the plate's olive ladder (#3e3d17 .23 · #514b25 .29 ·
   #59502e .32 · #5c593f .35) carried into albedo: R≈G, B low, a real 2x value
   spread so the greens VARY instead of reading as one flat green disc. */
/* W5 warms the ladder toward the plate's own readings — every plate meadow mode
   has R >= G (#3e3d17, #514b25, #59502e, #5c593f); the shipped ramp had G > R,
   which the blue key turned to navy. */
const MEADOW_RAMP = ['#5b5c33', '#777543', '#959051', '#b2a866'].map((h) => new THREE.Color(h));
/* THE SAND RAMP — the plate's #4c4320 / #6a592f / #947551 / #a58469 ladder */
const SAND_RAMP = ['#a89876', '#c1b087', '#d5c59c'].map((h) => new THREE.Color(h));
const SAND_FIRELIT = new THREE.Color('#dfc78e');
const TRODDEN = new THREE.Color('#cdbd97');   /* the scuffed camp track */
function ramp(list, t) {
  const u = Math.min(1, Math.max(0, t)) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(u));
  return list[i].clone().lerp(list[i + 1], u - i);
}
const meadow = (patch, si, amount = 0.10) => {
  const c = ramp(MEADOW_RAMP, patch);
  const j = ((Math.imul(si | 0, 2654435761) >>> 16) / 65536 - 0.5) * 2 * amount;
  return c.multiplyScalar(1 + j);
};
const sandTone = (patch, si, warm = 0) => {
  const c = ramp(SAND_RAMP, patch).lerp(SAND_FIRELIT, Math.min(1, Math.max(0, warm)) * 0.55);
  const j = ((Math.imul(si | 0, 2654435761) >>> 16) / 65536 - 0.5) * 2 * 0.07;
  return c.multiplyScalar(1 + j);
};

/* THE MAINLAND PLUMES (W3) — the cave fire's smoke system (fire3d `mode:'smoke'`)
   re-cut as a billowing column: the ring RADIUS spreads with height instead of
   holding a pencil line, each particle carries a seeded billow wobble, the sprite
   grows ~5x over its life, and alpha fades in off the embers and out at the top.
   Position/size/alpha are pure f(seed attributes, uTime) — no state, setSim-safe. */
function smokePlume({ count, seed, radius, height, size }) {
  const rnd = mulberry32(seed);
  const a0 = new Float32Array(count), r0 = new Float32Array(count),
        ph = new Float32Array(count), sp = new Float32Array(count),
        lf = new Float32Array(count), hm = new Float32Array(count),
        sz = new Float32Array(count), wb = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    a0[i] = rnd() * Math.PI * 2;
    r0[i] = Math.sqrt(rnd()) * radius;
    ph[i] = rnd() * 10;
    sp[i] = 0.5 + rnd() * 0.38;                 /* slower than the hearth's smoke */
    lf[i] = 1.15 + rnd() * 0.5;
    hm[i] = height * (0.7 + rnd() * 0.6);
    sz[i] = size * (0.6 + rnd() * 0.85);
    wb[i] = 0.7 + rnd() * 1.6;                  /* billow wobble rate */
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  for (const [k, v] of Object.entries({ a0, r0, ph, sp, lf, hm, sz, wb }))
    g.setAttribute(k, new THREE.BufferAttribute(v, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.6, 0), height * 1.4 + 6);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)') }, uPx: PX_UNIFORM },
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime; uniform float uPx;
      attribute float a0, r0, ph, sp, lf, hm, sz, wb;
      varying float vU;
      void main(){
        float u = mod(uTime * sp + ph, lf) / lf;       /* life fraction, pure f(t) */
        vU = u;
        float rise = pow(u, 0.85);
        float spread = 0.6 + 1.2 * rise + 2.2 * rise * rise;   /* WIDER WITH HEIGHT */
        float ang = a0 + rise * (0.6 + sp);
        float r = r0 * spread;
        vec3 p = vec3(cos(ang) * r, rise * hm, sin(ang) * r * 0.95);
        p.x += sin(rise * 3.1 * wb + ph * 2.0) * 0.7 * rise + rise * rise * 0.9;
        p.z += cos(rise * 2.4 * wb + ph * 1.6) * 0.55 * rise - rise * 0.25;
        gl_PointSize = max(1.0, sz * (0.45 + 2.4 * rise) * uPx);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vU;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        vec3 col = mix(vec3(0.60, 0.62, 0.66), vec3(0.50, 0.52, 0.58), vU);
        float a = tex.a * 0.115 * smoothstep(0.0, 0.10, vU) * (1.0 - smoothstep(0.42, 1.0, vU));
        gl_FragColor = vec4(col, a);
        if (gl_FragColor.a < 0.004) discard;
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = true;
  return pts;
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
    skyNight = mk('#1c2542', '#242d4c');
    skyDawn = mk('#b989a2', '#efc0ac');
    skyGeo = g;
    g.setAttribute('color', skyNight);
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10;
    track('sky', sky);

    const rnd = mulberry32(80904);
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

  /* ===== MACRO: THE ISLAND — one closed mass, heightfield top + faceted keel ===== */
  {
    const g = new THREE.IcosahedronGeometry(1, 4);
    const p = g.attributes.position;
    const n = p.count;
    const bottomFlag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      const len = Math.hypot(ux, uz);
      const dx = len > 1e-6 ? ux / len : 1, dz = len > 1e-6 ? uz / len : 0;
      const R = rayR(dx, dz);
      if (uy >= 0) {
        const px = ISLE_C[0] + dx * len * R, pz = ISLE_C[1] + dz * len * R;
        p.setXYZ(i, px, terrainH(px, pz), pz);
      } else {
        bottomFlag[i] = 1;
        const d = -uy;
        const shrink = 1 - 0.55 * Math.pow(d, 1.2);
        const px = ISLE_C[0] + dx * len * R * shrink, pz = ISLE_C[1] + dz * len * R * shrink;
        p.setXYZ(i, px, -Math.pow(d, 0.6) * 14, pz);
      }
    }
    /* crack-free painterly jitter — SKIP the walkable flats (path law) */
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const dF = Math.hypot(x, z);
      const flat = (bottomFlag[i] === 0) &&
        ((dF < 17 && Math.abs(y) < 0.3) || (pointInPoly(x, z, TERRACE_POLY) && Math.abs(y - 1.35) < 0.3));
      const amp = bottomFlag[i] ? 0.85 : (flat ? 0.0 : 0.3);
      if (amp === 0) continue;
      p.setXYZ(i,
        x + (hash3(x, y, z, 80901) - 0.5) * 2 * amp,
        y + (hash3(x, y, z, 80902) - 0.5) * 2 * amp * 0.6,
        z + (hash3(x, y, z, 80903) - 0.5) * 2 * amp);
    }
    /* per-face ZONE colors (the register's painterly facets) */
    const col = new Float32Array(n * 3);
    for (let f = 0; f < n / 3; f++) {
      const i0 = f * 3;
      const cx = (p.getX(i0) + p.getX(i0 + 1) + p.getX(i0 + 2)) / 3;
      const cy = (p.getY(i0) + p.getY(i0 + 1) + p.getY(i0 + 2)) / 3;
      const cz = (p.getZ(i0) + p.getZ(i0 + 1) + p.getZ(i0 + 2)) / 3;
      const bAvg = (bottomFlag[i0] + bottomFlag[i0 + 1] + bottomFlag[i0 + 2]) / 3;
      const si = 80905 + f * 131;
      let c;
      if (bAvg > 0.45 || cy < -2.1) {
        /* the keel: navy-charcoal, darker with depth */
        c = tone('#3d4560', si, 0.15).lerp(new THREE.Color('#242a3e'),
          Math.min(1, Math.max(0, -cy / 12)));
      } else {
        const dS = chainDist(SHORE_CHAIN, cx, cz);
        const dM = chainDist(MAIN_CHAIN, cx, cz);
        /* THE TONAL ZONES (W2): every land facet gets the plate's own patch field,
           the trodden path, and canopy shade on top of its zone colour */
        const patch = patchField(cx, cz);        /* 0..1 broad zones + facet break-up */
        const shade = canopyShade(cx, cz);       /* 0..1 under-canopy darkening */
        if (dS < 0 && dM > 0) {
          /* strait basin: pale wet strip near the beach chain, dark rock below */
          c = cy > -0.35 ? tone('#dcc697', si, 0.07) : tone('#2c3348', si, 0.12);
        } else if (dM <= 0) {
          /* MAINLAND: yard terrace + apron sand + the crown's meadow.
             W5 — the destination has to READ. The plate keeps this lobe clearly
             lit (meadow L .308, terrace L .276) where the shipped build fell to
             L .144 / L .098; the mainland key restores most of that, and this
             lift carries the rest at the albedo, so the yard is legible even in
             the cliff's own shadow. */
          const LIFT = 1.30;
          if (pointInPoly(cx, cz, TERRACE_POLY)) c = meadow(patch * 1.05, si, 0.09).multiplyScalar(LIFT);
          else if (-dM < 5.5) c = sandTone(patch, si, 0.0).multiplyScalar(LIFT);
          else c = meadow(patch, si, 0.11).multiplyScalar(LIFT);
        } else {
          const dF = Math.hypot(cx, cz);
          const dP = pathDist(cx, cz);           /* the camp walk, metres */
          if (dS < 2.4) c = tone('#e4d3ae', si, 0.06);          /* wet sand at the chain */
          else if (cy > 0.42 && (cz > 4 || cx < -8)) c = meadow(patch, si, 0.11);
          else if (cx < -8 && cy > 0.2) c = tone('#8f8b7f', si, 0.1);
          else {
            /* camp apron: firelit warm sand, with the plate's trodden track paler */
            const warm = Math.max(0, 1 - dF / 15);
            c = sandTone(patch, si, warm);
          }
          /* THE PATH: the walk from the ships to the fire is scuffed pale sand */
          if (dP < 2.9 && cy < 0.55) {
            const t = 0.45 * (1 - ss(1.5, 2.9, dP));
            c.lerp(TRODDEN, t);
          }
        }
        if (shade > 0.001) c.multiplyScalar(1 - 0.42 * shade);  /* canopy shade */
      }
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i0 + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const isle = new THREE.Mesh(g, flatMat({ vertexColors: true, roughness: 1 }));
    isle.receiveShadow = true;
    track('island-mass', isle);
  }

  /* ===== MACRO: the strait water — clipped INSIDE the outline, seeded swell ===== */
  let waterMat;
  {
    /* THE CREST SLIVERS (W1). Measured off the plate at 4x: the band is not built
       of chunky diamonds, it is built of LONG THIN shards lying across the path —
       a typical white sliver runs ~83 plate px across by ~10 px deep, which through
       the ledger's own scales (11.3 px/m across, 5.31 px/m into depth) is ~7.3 m by
       ~1.9 m. So the water grid is deliberately ANISOTROPIC: few segments across
       (6.5 m), many into depth (2.2 m). Every triangle is then a crest sliver, and
       the shard mosaic does most of the work the old speckle was failing to do. */
    let g = new THREE.PlaneGeometry(52, 96, 8, 44);
    g.rotateX(-Math.PI / 2);
    /* IRREGULAR TRIANGULATION (the sea lane's trick, buildWater): plan-jitter the
       grid in the plane's own frame before it is placed, so the slivers STAGGER
       instead of tiling as a brick wall with visible column seams. Done on the
       INDEXED grid and keyed off position, so shared corners always move together
       and the sheet stays crack-free. y is untouched — the water law owns it. */
    {
      const p0 = g.attributes.position;
      for (let i = 0; i < p0.count; i++) {
        const x = p0.getX(i), z = p0.getZ(i);
        p0.setX(i, x + (hash3(x, 0, z, 80925) - 0.5) * 2 * 2.55);
        p0.setZ(i, z + (hash3(x, 0, z, 80926) - 0.5) * 2 * 0.82);
      }
    }
    g.rotateY(THREE.MathUtils.degToRad(29.4));    /* the beach shoreline's own axis */
    g.translate(34, WATER_Y, -13);
    g = g.toNonIndexed();
    /* keep water strictly between the chains (tucked 1.2 m under each shore)
       and inside the island rim (inset 0.4 m) */
    g = dropFaces(g, (c) => {
      const dS = chainDist(SHORE_CHAIN, c.x, c.z);
      const dM = chainDist(MAIN_CHAIN, c.x, c.z);
      if (dS > 1.2 || dM < -1.2) return false;
      const dx = c.x - ISLE_C[0], dz = c.z - ISLE_C[1];
      const r = Math.hypot(dx, dz);
      return r < rayR(dx / r, dz / r) - 0.4;
    });
    /* seeded coherent swell — STATIC verts (animation lives in the shader). Four
       octaves now: the dark water has to read as a swelling surface, not flat navy.
       Total amplitude is held under |WATER_Y| so no crest pokes through the sand. */
    {
      const p0 = g.attributes.position;
      for (let i = 0; i < p0.count; i++) {
        const x = p0.getX(i), z = p0.getZ(i);
        const sw =
          0.105 * Math.sin(0.16 * x + 0.23 * z + 1.7) +
          0.070 * Math.sin(0.31 * x - 0.11 * z + 4.2) +
          0.050 * Math.sin(0.09 * x + 0.38 * z + 2.6) +
          0.032 * Math.sin(0.62 * x - 0.48 * z + 0.9);
        p0.setY(i, WATER_Y + sw);
      }
    }
    /* ROUND-4 W1 — THE BAND IS NOT REFINED. Round 3 pushed two midpoint levels
       through the moonpath (~2 m facets down to ~0.5 m) chasing a soft falloff;
       measured against the plate that was the mistake: it dissolved the painted
       SHARDS into a smooth wash, and the fine speckle laid over it then read as
       haze. The plate's band is built of bold ~3-4 m facets at hard contrast to
       each other. So the band keeps the base facets, and the ONE refinement left
       is the shore strip, where the foam line has to stay a crisp waterline (the
       children sit on the parent plane, so it is still crack-free). */
    g = subdivideNear(g, (x, z) => Math.abs(chainDist(SHORE_CHAIN, x, z)) < 2.4);
    const p = g.attributes.position;
    /* per-facet attributes: centroid, flat normal, seeded hash, shore distance */
    {
      const n = p.count;
      const cent = new Float32Array(n * 2), nrm = new Float32Array(n * 3),
            hsh = new Float32Array(n), shd = new Float32Array(n);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(),
            NN = new THREE.Vector3();
      const frnd = mulberry32(80921);
      for (let f = 0; f < n / 3; f++) {
        A.fromBufferAttribute(p, f * 3); B.fromBufferAttribute(p, f * 3 + 1);
        C.fromBufferAttribute(p, f * 3 + 2);
        NN.copy(B).sub(A).cross(C.clone().sub(A)).normalize();
        if (NN.y < 0) NN.multiplyScalar(-1);
        const cx = (A.x + B.x + C.x) / 3, cz = (A.z + B.z + C.z) / 3;
        const h = frnd();
        const dShore = Math.abs(chainDist(SHORE_CHAIN, cx, cz));
        for (let k = 0; k < 3; k++) {
          cent[(f * 3 + k) * 2] = cx; cent[(f * 3 + k) * 2 + 1] = cz;
          nrm.set([NN.x, NN.y, NN.z], (f * 3 + k) * 3);
          hsh[f * 3 + k] = h;
          shd[f * 3 + k] = dShore;
        }
      }
      g.setAttribute('aCent', new THREE.BufferAttribute(cent, 2));
      g.setAttribute('aNrm', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('aHash', new THREE.BufferAttribute(hsh, 1));
      g.setAttribute('aShore', new THREE.BufferAttribute(shd, 1));
    }
    /* THE WATER LAW — facet-quantised body, sub-facet sparkle, pure f(pos, uTime):
       the plate's swelling wine-dark base · THE MOONPATH as ONE band on the plate's
       own axis and width (FWHM 10.5 m ~ 115 plate px, 7 m at the far tip) · every
       facet's luminance CAPPED at 0.84 so no quad ever blows out · shore foam along
       the beach chain.
       Authored AS the plate's own sRGB values (ShaderMaterial writes raw).

       ROUND 4 (W1) — THE GLITTER, PORTED FROM THE SEA LANE. The sea's round-2
       water (3d/sets/sea3d.js `buildWater`) solved this and the shore did not, so
       the shore takes the sea's two mechanisms verbatim in spirit:
         1. THE SHARD GATE. The sea gates whole facets on a coherent ~1.9 m cell
            (`gate < 0.10 + 0.90*soft ? 1 : 0.07`) so the path breaks into painted
            SHARDS and dissolves into scattered flecks at the margins, instead of
            being a solid wash. The shore gates on its own 2.9 m facet scale.
         2. THE SUB-FACET TWINKLE. The sea adds three incommensurate travelling
            sine waves read in WORLD PLAN METRES and raises the sum to a high
            power, so what survives is isolated pinpoint glints inside a facet —
            no cell lattice and no dither field. The shore's round-3 fragment
            shader used a 0.29 m cell grid at ~48% occupancy plus a 0.125 m grain
            octave; at the book's 11.3 px/m that is a 3 px speckle at half
            coverage, which is exactly the HAZE Fable named. Both are deleted. */
    waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uDay: { value: 0 },
        uMoon: { value: new THREE.Vector3(-0.18, 0.66, -0.73).normalize() },
      },
      vertexShader: `
        uniform float uTime; uniform float uDay; uniform vec3 uMoon;
        attribute vec2 aCent; attribute vec3 aNrm; attribute float aHash;
        attribute float aShore;
        varying vec3 vCol; varying float vLit; varying vec2 vW;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main(){
          /* THE PLATE'S OWN AXIS: origin (${MOON_O[0]}, ${MOON_O[1]}), dir (${MOON_D[0]}, ${MOON_D[1]}) */
          vec2 rel = aCent - vec2(${MOON_O[0].toFixed(3)}, ${MOON_O[1].toFixed(3)});
          vec2 dir = vec2(${MOON_D[0].toFixed(4)}, ${MOON_D[1].toFixed(4)});
          float along = dot(rel, dir);
          float lat = abs(rel.x * dir.y - rel.y * dir.x);
          lat += (aHash - 0.5) * 2.4;        /* facet-ragged edge, as painted */
          /* the measured half-width: 5.8 m at the far tip -> 8.3 m downstage
             (smoothstep half-point 0.65w -> FWHM 1.3w = 7.5 m .. 10.8 m) */
          float wOut = mix(${W_TIP.toFixed(2)}, ${W_FAR.toFixed(2)},
                           clamp((along + 6.0) / 38.0, 0.0, 1.0));
          float soft = smoothstep(wOut, wOut * 0.30, lat);      /* the band ENVELOPE */
          /* THE SHARD GATE (W1, the sea lane's mechanism). The plate's path is not
             a wash: it is a mosaic of lit shards with dark water showing between
             them, and at the margins only scattered shards survive. Coherent on a
             6.5 x 2.2 m cell — one crest sliver, one shard — so the break-up reads
             as water faceting, never as per-pixel noise. */
          float gate = h21(floor(aCent / vec2(6.5, 2.2)));
          float on = step(gate, 0.10 + 0.84 * soft);
          float band = soft * mix(0.055, 1.0, on);
          /* the plate's along-axis taper: dead by the far tip, ~0.90 peak just
             downstage of it, decaying to ~0.5 by the near shore */
          float amp = smoothstep(-6.0, 1.5, along) *
                      clamp(1.0 - (along - 6.0) * 0.0122, 0.5, 1.0);
          /* THE FACET TWINKLE (the sea's own tw): each shard breathes on its own
             seeded period — the band never blinks off, it shimmers. */
          float tw = 0.66 + 0.34 * sin(uTime * (0.55 + fract(aHash * 7.3) * 1.7)
                                       + aHash * 39.7);
          /* THE SWELL: the same four octaves the vertices carry, read at the facet
             centroid, so the tone bands follow the actual crests and troughs */
          float sw = 0.105 * sin(0.16 * aCent.x + 0.23 * aCent.y + 1.7)
                   + 0.070 * sin(0.31 * aCent.x - 0.11 * aCent.y + 4.2)
                   + 0.050 * sin(0.09 * aCent.x + 0.38 * aCent.y + 2.6)
                   + 0.032 * sin(0.62 * aCent.x - 0.48 * aCent.y + 0.9);
          float crest = clamp(sw * 1.92 + 0.5, 0.0, 1.0);
          float tilt = clamp((dot(aNrm, uMoon) - 0.58) * 3.0, 0.0, 1.0);
          /* THE DARK WATER: the plate's #2c3037 .. #434852, swelling — never flat */
          vec3 deepLo = mix(vec3(0.120, 0.135, 0.164), vec3(0.20, 0.22, 0.24), uDay);
          vec3 deepHi = mix(vec3(0.256, 0.280, 0.322), vec3(0.36, 0.36, 0.35), uDay);
          vec3 col = mix(deepLo, deepHi, clamp(0.58 * crest + 0.27 * aHash + 0.15 * tilt, 0.0, 1.0));
          /* THE BAND BODY: the plate's #8f95a0 .. #b5bcc6 silver, never brighter.
             Round 4 widens the low end (#5c6068) and swings the shard tone on the
             facet hash AND the crest, so neighbouring shards sit at real contrast
             — the plate's band has a 0.27 luminance sigma, a smooth wash has none. */
          vec3 silverLo = mix(vec3(0.300, 0.318, 0.352), vec3(0.66, 0.58, 0.46), uDay);
          vec3 silverHi = mix(vec3(0.828, 0.852, 0.888), vec3(0.99, 0.90, 0.72), uDay);
          vec3 silver = mix(silverLo, silverHi,
                            clamp(0.06 + 1.00 * aHash + 0.34 * crest, 0.0, 1.0));
          silver *= 0.84 + 0.24 * tw;               /* each shard breathes */
          float lit = clamp(band * amp, 0.0, 1.0);
          col = mix(col, silver, lit);
          /* the hot centre — still a grey, not a white */
          vec3 hot = mix(vec3(0.960, 0.972, 0.992), vec3(1.0, 0.95, 0.82), uDay);
          /* the hot core is itself shard-wise: only the brighter-hashed facets in
             the core take it, so the centre stays a mosaic and not a white slab */
          float core = smoothstep(wOut * 0.88, wOut * 0.22, lat) * amp * amp * on * tw
                     * smoothstep(0.22, 0.78, aHash);
          col = mix(col, hot, clamp(core * 0.88, 0.0, 0.88));
          /* rare off-band glints (the plate's scattered flecks) — dim, never white */
          col = mix(col, silverLo, clamp(step(0.972, aHash) * tilt * 0.35, 0.0, 0.35));
          /* shore foam: pale edge hugging the beach chain, slow ripple */
          float foam = (1.0 - smoothstep(0.25, 1.9, aShore)) *
            (0.55 + 0.2 * sin(uTime * 0.9 + aCent.x * 0.7 + aCent.y * 0.4));
          col = mix(col, mix(vec3(0.58, 0.60, 0.60), vec3(0.90, 0.88, 0.82), uDay),
                    clamp(foam, 0.0, 0.45));
          /* THE CAP: no facet blows out. The plate's band bodies top out at 0.74
             luminance and its hottest facet at ~0.84 — hold that ceiling. */
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col *= min(1.0, ${FACET_CAP.toFixed(2)} / max(lum, 1e-4));
          vCol = col; vLit = lit; vW = position.xz;
          /* continuous swell bob (position-phased -> crack-free), deterministic */
          vec3 p = position;
          p.y += 0.050 * sin(uTime * 0.60 + position.x * 0.33 + position.z * 0.21)
               + 0.032 * sin(uTime * 0.41 - position.x * 0.19 + position.z * 0.37);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vCol; varying float vLit; varying vec2 vW;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main(){
          vec3 col = vCol;
          /* SUB-FACET SPARKLE — the sea lane's mechanism (sea3d buildWater), ported
             and then hardened for this set's much bigger band.
             The sea adds three incommensurate travelling waves raised to a high
             power, which leaves isolated pinpoint glints INSIDE each facet. Ported
             straight, the shore's wider band showed that trio for what it is: a
             quasi-periodic DOT LATTICE, ~10 px on a side at the book's 11.3 px/m
             (rendered and rejected this round; the sea's band is narrow enough to
             hide it). Domain-warping the waves only bent the lattice into zigzag
             chains. So the same idea is carried on a JITTERED SEEDED CELL instead:
             1.15 m cells, one seeded glint per cell placed at a hashed offset
             inside it, ~32% of cells occupied, each breathing on its own seeded
             period. Irregular by construction — no lattice, no dither field.
             Coverage works out at ~4% of band area against the plate's measured
             6.3% near-white, and each speck is ~3 px, so it reads as glitter on
             water rather than the milky haze round 3 shipped.
             Pure f(surface position, uTime): setSim replays it byte-identically. */
          vec2 g = vW / 1.15;
          vec2 ci = floor(g), cf = g - ci;
          float spark = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 o = vec2(float(i), float(j));
              vec2 id = ci + o;
              float r3 = h21(id + 7.13);
              if (r3 >= 0.32) continue;                 /* most cells stay dark */
              float r1 = h21(id), r2 = h21(id + 31.7);
              vec2 c = o + vec2(0.18 + 0.64 * r1, 0.18 + 0.64 * r2);
              float tw = 0.5 + 0.5 * sin(uTime * (0.8 + r2 * 2.6) + r1 * 57.3);
              spark = max(spark, smoothstep(0.24, 0.02, length(cf - c)) * tw);
            }
          }
          col += vec3(0.90, 0.93, 0.99) * vLit * spark * 0.85;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }`,
    });
    const water = new THREE.Mesh(g, waterMat);
    track('strait-water', water);
    tickers.push((t) => { waterMat.uniforms.uTime.value = t; });
  }

  /* ===== MACRO: mainland cliff mass + THE CAVE MOUTH (a real recess) ===== */
  const CLIFF = { cx: 55.5, cz: -44.5, rx: 15.5, rz: 12.0, h: 10.0, base: 1.0 };
  const MOUTH = { x: 49.8, z: -33.9, yaw: -0.494, hw: M(1055 - 945) / 2 }; /* aperture, as painted */
  {
    let g = new THREE.CylinderGeometry(0.72, 1.0, 1, 22, 7);
    const p0 = g.attributes.position;
    for (let i = 0; i < p0.count; i++) {
      const x = p0.getX(i), y = p0.getY(i) + 0.5, z = p0.getZ(i);
      /* ridged painterly sculpt: vertical ridge lobes, stronger low, dying at the crown */
      const phi = Math.atan2(x, z);
      const ridge =
        0.62 * Math.abs(Math.sin(phi * 3.5 + 1.3)) +
        0.38 * Math.abs(Math.sin(phi * 7.7 + 0.4));
      const f = 1 + 0.15 * ridge * (1 - 0.6 * Math.min(1, Math.max(0, y))) - 0.05;
      p0.setXYZ(i, x * CLIFF.rx * f, y * CLIFF.h, z * CLIFF.rz * f);
    }
    /* the mouth cut: drop faces inside the painted arch (local sector) */
    const PHI0 = Math.atan2((MOUTH.x - CLIFF.cx) / CLIFF.rx, (MOUTH.z - CLIFF.cz) / CLIFF.rz);
    const HA = 0.40;                       /* half-angle: 4.87 m at the face radius */
    g = dropFaces(g, (c) => {
      const phi = Math.atan2(c.x / CLIFF.rx, c.z / CLIFF.rz);
      let d = phi - PHI0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const ax = Math.abs(d) / HA;
      if (ax >= 1) return true;
      const archY = 7.4 * Math.sqrt(1 - ax * ax);
      return !(c.y < archY && c.y > -0.5);
    });
    jitterByPos(g, 80931, 0.7);
    const geo = facetColors(g, '#a79079', 80931, 0.14);
    /* grass wrap on the up-facing crown facets (the plate's green cap edge) */
    {
      const pos = geo.attributes.position, col = geo.attributes.color;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3(), nn = new THREE.Vector3();
      const grass = new THREE.Color('#a5a962');
      const rnd = mulberry32(80936);
      for (let f = 0; f < pos.count / 3; f++) {
        a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
        c3.fromBufferAttribute(pos, f * 3 + 2);
        nn.copy(b).sub(a).cross(c3.clone().sub(a));
        const cy = (a.y + b.y + c3.y) / 3;
        if (nn.y > 0.55 * nn.length() && cy > 8.2) {
          const v = 0.85 + rnd() * 0.3;
          for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, grass.r * v, grass.g * v, grass.b * v);
        }
      }
      col.needsUpdate = true;
    }
    const cliff = new THREE.Mesh(geo, flatMat({ vertexColors: true, side: THREE.DoubleSide }));
    cliff.position.set(CLIFF.cx, CLIFF.base, CLIFF.cz);
    cliff.receiveShadow = true;
    track('cliff-mass', cliff);
    /* plateau crown cap (grass) */
    const cg = new THREE.CircleGeometry(1, 24);
    cg.rotateX(-Math.PI / 2);
    jitterByPos(cg, 80934, 0.05);
    const crownGeo = facetColors(cg, '#a3a860', 80934, 0.12);
    crownGeo.scale(CLIFF.rx * 0.74, 1, CLIFF.rz * 0.74);
    /* W2: the crown is the plate's biggest meadow — give it the same patch field
       and canopy shade the island mass carries, or it reads as one flat disc */
    {
      const pos = crownGeo.attributes.position, col = crownGeo.attributes.color;
      for (let f = 0; f < pos.count / 3; f++) {
        const wx = CLIFF.cx + (pos.getX(f * 3) + pos.getX(f * 3 + 1) + pos.getX(f * 3 + 2)) / 3;
        const wz = CLIFF.cz + (pos.getZ(f * 3) + pos.getZ(f * 3 + 1) + pos.getZ(f * 3 + 2)) / 3;
        const c = meadow(patchField(wx, wz), 80934 + f * 197, 0.1)
          .multiplyScalar(1 - 0.42 * canopyShade(wx, wz));
        for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
    const crown = new THREE.Mesh(crownGeo, flatMat({ vertexColors: true, roughness: 1 }));
    crown.position.set(CLIFF.cx, CLIFF.base + CLIFF.h + 0.03, CLIFF.cz);
    crown.receiveShadow = true;
    track('plateau-crown', crown);
    /* east shoulder ledge (carries the third smoke fire) */
    const sg = new THREE.CylinderGeometry(0.68, 1.0, 1, 12, 4);
    const sp2 = sg.attributes.position;
    for (let i = 0; i < sp2.count; i++) {
      const x = sp2.getX(i), y = sp2.getY(i) + 0.5, z = sp2.getZ(i);
      sp2.setXYZ(i, x * 8.0, y * 5.4, z * 8.6);
    }
    jitterByPos(sg, 80933, 0.55);
    const sh = new THREE.Mesh(facetColors(sg, '#8f8b84', 80933, 0.13), flatMat({ vertexColors: true }));
    sh.position.set(66.5, 0.8, -31.5);
    track('cliff-shoulder-east', sh);
  }

  /* ===== MESO: the mouth throat + jamb rocks (the recess the cut opened) ===== */
  {
    const grp = new THREE.Group();
    const MW = MOUTH.hw;
    const throatMat = new THREE.MeshBasicMaterial({ color: '#0a0806' });
    const shape = new THREE.Shape();
    shape.moveTo(-MW * 1.15, 0);
    shape.lineTo(MW * 1.15, 0);
    shape.lineTo(MW * 1.15, 2.9);
    shape.absarc(0, 2.9, MW * 1.15, 0, Math.PI, false);
    shape.lineTo(-MW * 1.15, 0);
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), throatMat);
    panel.position.set(0, 0.02, -3.4);
    grp.add(panel);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MW * 2.5, 4.4), throatMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.03, -1.4);
    grp.add(floor);
    for (const sd of [-1, 1]) {           /* cheeks seal the sightline past the cut */
      const cheek = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 8.2), throatMat);
      cheek.rotation.y = -sd * Math.PI / 2;
      cheek.position.set(sd * MW * 1.12, 3.6, -1.3);
      grp.add(cheek);
    }
    /* jamb rocks riding the arch edge */
    const rnd = mulberry32(80941);
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, ang = Math.PI * t;
      const rg = jitterByPos(new THREE.IcosahedronGeometry(1.15, 1), 80941 + i, 0.3);
      const rock = new THREE.Mesh(facetColors(rg, '#8a867e', 80951 + i, 0.13),
        flatMat({ vertexColors: true }));
      rock.position.set(Math.cos(ang) * (MW + 0.7),
        Math.max(0.7, 2.9 + Math.sin(ang) * (MW + 0.4)), 0.35 + (rnd() - 0.5) * 0.5);
      rock.scale.set(1.0 + rnd() * 0.5, 0.7 + rnd() * 0.45, 1.15);
      rock.castShadow = true;
      grp.add(rock);
    }
    grp.position.set(MOUTH.x, 1.35, MOUTH.z);
    grp.rotation.y = MOUTH.yaw;
    track('mainland-mouth', grp);
  }

  /* ===== MESO: yard terrace walls + pens + the flock ===== */
  {
    const grp = new THREE.Group();
    const TER = 1.35;
    /* stacked-stone walls: mouth-side return + the ledger diagonal */
    const WALL_PTS = [
      [X(905), ZH(262, 1.4)], [X(942), ZH(287, 1.4)], [X(1062), ZH(345, 1.4)]];
    const stoneG = new THREE.BoxGeometry(1, 1, 1);
    const rnd = mulberry32(80961);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let nWall = 0;
    for (let s = 0; s < WALL_PTS.length - 1; s++)
      nWall += Math.round(Math.hypot(WALL_PTS[s + 1][0] - WALL_PTS[s][0],
        WALL_PTS[s + 1][1] - WALL_PTS[s][1]) / 1.0) * 3;
    const wallIM = new THREE.InstancedMesh(stoneG, flatMat({ color: '#ffffff' }), nWall);
    let wi = 0;
    for (let s = 0; s < WALL_PTS.length - 1; s++) {
      const [ax, az] = WALL_PTS[s], [bx, bz] = WALL_PTS[s + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      const nPer = Math.round(len / 1.0);
      for (let course = 0; course < 3; course++) {
        const nn = course === 2 ? nPer - 1 : nPer;
        for (let k = 0; k < nn; k++) {
          const t = (k + (course === 2 ? 1 : 0.5)) / nPer;
          e.set(0, yaw + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.06); q.setFromEuler(e);
          m4.compose(
            new THREE.Vector3(ax + (bx - ax) * t, TER + 0.22 + course * 0.42, az + (bz - az) * t),
            q, new THREE.Vector3(0.55 + rnd() * 0.2, 0.42 + rnd() * 0.1, 0.95 + rnd() * 0.25));
          wallIM.setMatrixAt(wi, m4);
          wallIM.setColorAt(wi, col.set('#b3a893').multiplyScalar(0.82 + rnd() * 0.34));
          wi++;
        }
      }
    }
    wallIM.count = wi;
    wallIM.castShadow = true;
    wallIM.name = 'yard-wall'; parts['yard-wall'] = wallIM;
    grp.add(wallIM);

    /* timber pens: rotated rect behind the wall, posts + 3 rails + a divider */
    const wallYaw = Math.atan2(WALL_PTS[2][0] - WALL_PTS[1][0], WALL_PTS[2][1] - WALL_PTS[1][1]);
    const PEN = { cx: 53.8, cz: -23.2, w: 10.6, d: 6.2, yaw: wallYaw };
    const postG = new THREE.CylinderGeometry(0.095, 0.118, 1.1, 6);
    const railG = new THREE.CylinderGeometry(0.064, 0.064, 1, 5);
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
          rails.push({ x, z, y: TER + 0.3 + course * 0.28 + (rnd() - 0.5) * 0.03,
            ang, len: len / n * 1.06, bow: (rnd() - 0.5) * 0.06 });
        }
      }
    }
    const postIM = new THREE.InstancedMesh(postG, flatMat({ color: '#825c34' }), posts.length);
    const railIM = new THREE.InstancedMesh(railG, flatMat({ color: '#8e6c3e' }), rails.length);
    posts.forEach((pp, i) => {
      e.set(pp.lean, 0, pp.lean * 0.7); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(pp.x, TER + 0.5, pp.z), q, new THREE.Vector3(1, pp.s, 1));
      postIM.setMatrixAt(i, m4);
      postIM.setColorAt(i, col.set('#825c34').multiplyScalar(0.85 + rnd() * 0.3));
    });
    rails.forEach((r, i) => {
      e.set(0, r.ang - Math.PI / 2, r.bow); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.len, 1, 1));
      railIM.setMatrixAt(i, m4);
      railIM.setColorAt(i, col.set('#8e6c3e').multiplyScalar(0.85 + rnd() * 0.3));
    });
    postIM.castShadow = railIM.castShadow = true;
    postIM.name = 'pen-posts'; railIM.name = 'pen-rails';
    parts['pen-posts'] = postIM; parts['pen-rails'] = railIM;
    const penGrp = new THREE.Group();
    penGrp.name = 'pens'; parts['pens'] = penGrp;
    penGrp.add(postIM, railIM);
    grp.add(penGrp);

    /* the flock: 7 sheep (painted 1.8 m at the world frame — the dual-scale ruling) */
    const bodyG = new THREE.IcosahedronGeometry(0.62, 1);
    bodyG.scale(1.3, 0.72, 0.62);
    const headG = new THREE.BoxGeometry(0.22, 0.22, 0.34);
    const srnd = mulberry32(80971);
    const spots = [];
    let guard = 0;
    while (spots.length < 7 && guard++ < 220) {
      const u = -PEN.w / 2 + 0.8 + srnd() * (PEN.w - 1.6);
      const v = -PEN.d / 2 + 0.8 + srnd() * (PEN.d - 1.6);
      const [x, z] = toW(u, v);
      if (spots.some((s0) => Math.hypot(s0.x - x, s0.z - z) < 1.4)) continue;
      spots.push({ x, z, a: srnd() * Math.PI * 2 });
    }
    const wool = new THREE.InstancedMesh(bodyG, flatMat({ color: '#e8e2d4', roughness: 1 }), spots.length);
    const face = new THREE.InstancedMesh(headG, flatMat({ color: '#4a3a2c' }), spots.length);
    spots.forEach((s0, i) => {
      e.set(0, s0.a, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s0.x, TER + 0.5, s0.z), q, new THREE.Vector3(1, 1, 1));
      wool.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(s0.x + Math.sin(s0.a) * 0.78, TER + 0.62, s0.z + Math.cos(s0.a) * 0.78),
        q, new THREE.Vector3(1, 1, 1));
      face.setMatrixAt(i, m4);
      wool.setColorAt(i, col.setScalar(0.9 + srnd() * 0.14));
    });
    wool.castShadow = true;
    wool.name = 'sheep-flock'; face.name = 'sheep-face';
    parts['sheep-flock'] = wool;
    penGrp.add(wool, face);
    track('yard-and-pens', grp);
  }

  /* ===== MESO: trees (cluster laurels) + bushes (two olive systems) ===== */
  {
    const grp = new THREE.Group();
    const laurels = new THREE.Group(); laurels.name = 'laurels'; parts['laurels'] = laurels;
    const yardTrees = new THREE.Group(); yardTrees.name = 'yard-trees'; parts['yard-trees'] = yardTrees;
    grp.add(laurels, yardTrees);
    /* W5 — CANOPY TONES. Sampled off the plate's mainland trees: mean #474219,
       lit tenth #585325, second cluster #36311c / #5c552c. That is an OLIVE with
       R >= G and B at roughly 0.4 of R, not the green-dominant leaf the shipped
       build used (#5f7a44 family, G >> R), which the blue night key then pushed
       to the navy blobs Fable named (render canopy read #23321e / #1d1c1f).
       These are albedos under a blue-keyed rig, so they sit above the plate's
       rendered values by design. */
    const TON = ['#6a6a35', '#77763e', '#848147', '#948f57'];
    const tree = (into, x, y, z, s, seed) => {
      const g = new THREE.Group();
      const R = mulberry32(seed);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.8, 6),
        flatMat({ color: '#4a3226' }));
      trunk.position.y = 1.3;
      trunk.castShadow = true;
      g.add(trunk);
      const lump = (lx, ly, lz, lr, i) => {
        const cg = jitterByPos(new THREE.IcosahedronGeometry(lr, 1), seed + i * 7, lr * 0.2);
        const c = new THREE.Mesh(facetColors(cg, TON[(R() * 4) | 0], seed + i, 0.13),
          flatMat({ vertexColors: true }));
        c.position.set(lx, ly, lz);
        c.castShadow = true;
        g.add(c);
      };
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + R() * 1.3;
        lump(Math.cos(a) * 0.95, 2.6 + (R() - 0.5) * 0.5, Math.sin(a) * 0.95, 1.05 + R() * 0.4, i);
      }
      lump((R() - 0.5) * 0.5, 3.75 + R() * 0.4, (R() - 0.5) * 0.5, 1.15 + R() * 0.3, 9);
      g.scale.setScalar(s);
      g.position.set(x, y, z);
      into.add(g);
    };
    /* the mouth laurels (big, overhanging the jambs) + crown/yard/east apron —
       the SAME tables the island's vertex paint reads for canopy shade */
    for (const [x, y, z, s, seed] of LAUREL_TREES) tree(laurels, x, y, z, s, seed);
    for (const [x, y, z, s, seed] of YARD_TREES) tree(yardTrees, x, y, z, s, seed);
    /* olive bushes — TWO instanced systems, plate density */
    const rnd = mulberry32(82010);
    const bushG = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 82010, 0.2);
    const bushGeo = facetColors(bushG, '#9d9c58', 82010, 0.14);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    const fill = (im, spots, key = 1) => {
      spots.forEach((s0, i) => {
        e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e);
        const sc = (0.85 + rnd() * 0.85) * (s0[3] || 1);   /* [3] = per-spot size mult */
        m4.compose(new THREE.Vector3(s0[0], s0[1], s0[2]), q, new THREE.Vector3(sc, sc * 0.72, sc));
        im.setMatrixAt(i, m4);
        /* `key` lifts a whole system's albedo: the crag tufts sit on the diorama's
           dark west flank, away from both the moon and the fire, and the plate
           still paints them a clear olive rather than a silhouette. */
        im.setColorAt(i, col.set(rnd() < 0.4 ? '#84864a' : '#9d9c58')
          .multiplyScalar((0.85 + rnd() * 0.3) * key));
      });
      im.count = spots.length;
      im.castShadow = true;
      grp.add(im);
    };
    const cragIM = new THREE.InstancedMesh(bushGeo, flatMat({ vertexColors: true }), CRAG_SPOTS.length);
    cragIM.name = 'crag-bushes'; parts['crag-bushes'] = cragIM;
    fill(cragIM, CRAG_SPOTS, 1.5);
    const beachIM = new THREE.InstancedMesh(bushGeo, flatMat({ vertexColors: true }), BEACH_SPOTS.length);
    beachIM.name = 'beach-bushes'; parts['beach-bushes'] = beachIM;
    fill(beachIM, BEACH_SPOTS);
    track('trees-and-bushes', grp);
  }

  /* ===== MESO: goat-island crags (blockout volumes) ===== */
  {
    const grp = new THREE.Group();
    const spire = (x, z, h, r, seed, leanX = -0.05, leanZ = 0.03) => {
      const g = new THREE.ConeGeometry(r, h, 7, 6);
      g.translate(0, h / 2, 0);
      /* ridged monolith sculpt: per-flank ridges + ring bulges + slight twist */
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const rr = Math.hypot(px, pz);
        if (rr < 1e-5) continue;
        const phi = Math.atan2(px, pz);
        const yn = py / h;
        const ridge = 1 +
          0.24 * Math.abs(Math.sin(phi * 2.5 + seed)) * (1 - yn) +
          0.14 * Math.sin(yn * 5.2 + seed * 0.7);
        const twist = 0.16 * yn;
        const nx = Math.sin(phi + twist) * rr * ridge;
        const nz = Math.cos(phi + twist) * rr * ridge;
        p.setXYZ(i, nx, py, nz);
      }
      jitterByPos(g, seed, r * 0.24);
      const m = new THREE.Mesh(facetColors(g, '#bdad95', seed, 0.16), flatMat({ vertexColors: true }));
      m.position.set(x, 0, z);
      m.rotation.set(leanX, 0, leanZ);
      m.castShadow = true;
      grp.add(m);
    };
    spire(-18.5, -7, 21, 3.6, 83001, -0.07, 0.05);   /* the tall crag */
    spire(-13.2, -1, 14.5, 3.1, 83002, -0.05, -0.04);
    spire(-20.8, 2.5, 9.5, 2.5, 83003, -0.03, 0.06);
    spire(-10.5, 4.5, 6.2, 2.1, 83004, 0.02, -0.02);
    /* grey boulders at the feet + along the sand + mainland waterline */
    const rnd = mulberry32(83010);
    const bG = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 83010, 0.2);
    const B = [[-15.5, 2.8], [-9.0, 7.5], [-22.5, 6.5], [10.8, 12.2], [14.3, 13.8],
      [16.2, 10.5], [-6.2, 10.8], [12.8, 15.6], [-24.5, 2.0], [8.3, 15.2], [17.5, 14.6],
      [-18.0, 8.8], [44.5, -25.5], [58.0, -16.0], [50.5, -15.2]];
    const bIM = new THREE.InstancedMesh(facetColors(bG, '#a89c8c', 83010, 0.14),
      flatMat({ vertexColors: true }), B.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    B.forEach((s0, i) => {
      e.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4); q.setFromEuler(e);
      const sc = 0.5 + rnd() * 0.9;
      m4.compose(new THREE.Vector3(s0[0], terrainH(s0[0], s0[1]) + 0.22 * sc, s0[1]),
        q, new THREE.Vector3(sc, sc * 0.8, sc));
      bIM.setMatrixAt(i, m4);
      bIM.setColorAt(i, col.set('#a89c8c').multiplyScalar(0.8 + rnd() * 0.36));
    });
    bIM.castShadow = true;
    bIM.name = 'beach-boulders'; parts['beach-boulders'] = bIM;
    grp.add(bIM);
    track('crag-spires', grp);
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
      jitterByPos(g, 81011 + i, 0.05);
      const log = new THREE.Mesh(facetColors(g, hex, 81011 + i, 0.12), flatMat({ vertexColors: true }));
      log.position.set(x, 0.19, z);
      log.rotation.y = yaw;
      log.castShadow = true;
      grp.add(log);
    });
    const rnd = mulberry32(81021);
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
    const SMOKES = [
      { x: X(955), y: 11.05, z: -43.5, seed: 85001 },   /* plateau crown, west fire */
      { x: X(1030), y: 11.05, z: -46.5, seed: 85002 },  /* plateau crown, east fire */
      { x: 66.5, y: 6.25, z: -31.5, seed: 85003 },      /* the east-ledge fire */
    ];
    const rnd = mulberry32(85000);
    for (const s0 of SMOKES) {
      const fg = new THREE.Group();
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
      /* W3: a BILLOWING PLUME, not a streak — the cave fire's smoke system with a
         spreading radius, a size that grows with height and a top-end alpha fade */
      const column = smokePlume({ count: 130, seed: s0.seed, radius: 0.42, height: 14.5, size: 1.15 });
      column.position.y = 0.35;
      fg.add(column);
      tickers.push((t) => { column.material.uniforms.uTime.value = t * 0.20; });
      fg.position.set(s0.x, s0.y, s0.z);
      fires.add(fg);
    }
    track('smoke-columns', grp);
  }

  /* ===== MESO: THE TWO BLACK SHIPS (blockout hulls + posts + bare masts) ===== */
  const makeShip = ({ id, seed, oarSide, mastRake = 0.03 }) => {
    const grp = new THREE.Group();
    const L = 15, BEAM = 2.7, DEPTH = 1.05, SHEER = 0.65, TOP = 1.35;
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
    jitterByPos(hg, seed, 0.05);
    /* MINOR (round 2): the plate's hulls are warm dark BROWN — colour modes
       #45372d (.23) · #503b2c (.25) · #534438 (.28) — not the near-black the
       first build shipped. Lifted to that brown, jitter unchanged. */
    const geo = facetColors(hg, '#3f3227', seed, 0.16);
    /* deck read: top faces get the warm timber */
    {
      const pos = geo.attributes.position, col = geo.attributes.color;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3(), nn = new THREE.Vector3();
      const deck = new THREE.Color('#5a4028');
      const rnd = mulberry32(seed + 3);
      for (let f = 0; f < pos.count / 3; f++) {
        a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
        c3.fromBufferAttribute(pos, f * 3 + 2);
        nn.copy(b).sub(a).cross(c3.clone().sub(a));
        if (nn.y > 0.72 * nn.length()) {
          const v = 0.8 + rnd() * 0.35;
          for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, deck.r * v, deck.g * v, deck.b * v);
        }
      }
      col.needsUpdate = true;
    }
    const hull = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 0.9 }));
    hull.castShadow = true;
    grp.add(hull);
    /* stem + stern posts: BOLD spiral curls, the plate's own silhouette */
    for (const end of [-1, 1]) {
      const x0 = end * (L / 2 - 0.35);
      const pts = [new THREE.Vector3(x0 - end * 0.2, TOP - 0.7, 0)];
      const cx = x0 + end * 0.35, cy = TOP + 2.45;   /* curl centre */
      for (let k = 0; k <= 9; k++) {
        const a = k / 9;
        const th = -Math.PI / 2 + a * Math.PI * 1.55;
        const rr = 1.05 - 0.62 * a;
        pts.push(new THREE.Vector3(
          cx + end * Math.cos(th) * rr * -1, cy + Math.sin(th) * rr, 0));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.15, 5),
        flatMat({ color: '#392c22', roughness: 0.9 }));
      tube.castShadow = true;
      grp.add(tube);
      const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
        flatMat({ color: '#33281f' }));
      tip.position.copy(pts[pts.length - 1]);
      grp.add(tip);
    }
    /* the bare mast (ledger: 105 px = 9.3 m) */
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
    /* thwarts: 5 benches across the deck */
    const half = (t) => Math.pow(Math.max(0.001, Math.cos(Math.PI * t)), 0.62);
    for (let i = 0; i < 5; i++) {
      const t = -0.3 + i * 0.15;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, BEAM * half(t) * 0.92),
        flatMat({ color: '#6b4a2e' }));
      bench.position.set(t * L, TOP + 0.06, 0);
      grp.add(bench);
    }
    /* gunwale rails: pale-catching caps along both sheers (the plate's moonlit rims) */
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = -0.47 + (k / 12) * 0.94;
        pts.push(new THREE.Vector3(t * L, TOP + SHEER * Math.pow(Math.abs(t * 2), 3.2) + 0.05,
          sd * BEAM * half(t) * 0.5 * 2 * 0.98));
      }
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 5),
        flatMat({ color: '#4a3c2e', roughness: 0.85 }));
      rail.castShadow = true;
      grp.add(rail);
    }
    /* rigging: forestay + backstay + two shrouds (thin rods to the masthead) */
    const mastTop = new THREE.Vector3(-L * 0.03 - Math.sin(mastRake) * 9.3,
      TOP - 0.4 + Math.cos(mastRake) * 9.3, 0);
    const rig = (bx, by, bz) => {
      const a = mastTop, b = new THREE.Vector3(bx, by, bz);
      const d = b.clone().sub(a);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, d.length(), 4),
        flatMat({ color: '#221c16', roughness: 1 }));
      line.position.copy(a).add(b).multiplyScalar(0.5);
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      grp.add(line);
    };
    rig(L / 2 - 0.6, TOP + 1.4, 0);          /* forestay to the stem */
    rig(-L / 2 + 0.6, TOP + 1.4, 0);         /* backstay to the stern */
    rig(-L * 0.03 + 2.6, TOP + 0.1, oarSide * -BEAM * 0.36);
    rig(-L * 0.03 - 2.6, TOP + 0.1, oarSide * -BEAM * 0.36);
    /* SHIPPED OARS: fanned from the gunwale down to the sand on the painted side */
    const NOARS = 9;
    const shaftG = new THREE.CylinderGeometry(0.045, 0.045, 1, 5);
    const bladeG = new THREE.BoxGeometry(0.05, 1.05, 0.28);
    const shaftIM = new THREE.InstancedMesh(shaftG, flatMat({ color: '#8a6a42' }), NOARS);
    const bladeIM = new THREE.InstancedMesh(bladeG, flatMat({ color: '#7a5c38' }), NOARS);
    const m4o = new THREE.Matrix4(), qo = new THREE.Quaternion(), colo = new THREE.Color();
    const rndO = mulberry32(seed + 7);
    for (let i = 0; i < NOARS; i++) {
      const t = -0.34 + i * 0.075;
      const gx = t * L, gy = TOP + SHEER * Math.pow(Math.abs(t * 2), 3.2) * 0.5;
      const gz = oarSide * BEAM * half(t) * 0.49;
      const ground = new THREE.Vector3(
        gx + (i - (NOARS - 1) / 2) * 0.22 + (rndO() - 0.5) * 0.2,
        -0.16,
        gz + oarSide * (2.2 + rndO() * 0.7));
      const pivot = new THREE.Vector3(gx, gy, gz);
      const dir = ground.clone().sub(pivot);
      const len = dir.length() + 1.1;
      dir.normalize();
      qo.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const centre = pivot.clone().add(dir.clone().multiplyScalar(len / 2 - 0.55));
      m4o.compose(centre, qo, new THREE.Vector3(1, len, 1));
      shaftIM.setMatrixAt(i, m4o);
      shaftIM.setColorAt(i, colo.set('#8a6a42').multiplyScalar(0.82 + rndO() * 0.3));
      const bladeAt = pivot.clone().add(dir.clone().multiplyScalar(len - 0.95));
      m4o.compose(bladeAt, qo, new THREE.Vector3(1, 1, 1));
      bladeIM.setMatrixAt(i, m4o);
      bladeIM.setColorAt(i, colo.set('#7a5c38').multiplyScalar(0.82 + rndO() * 0.3));
    }
    shaftIM.castShadow = bladeIM.castShadow = true;
    shaftIM.name = id + '-oars'; parts[id + '-oars'] = shaftIM;
    bladeIM.name = id + '-oar-blades';
    grp.add(shaftIM, bladeIM);
    grp.userData.dims = { L, BEAM, TOP, oarSide };
    return grp;
  };
  {
    /* ship-1: bow (440,400) -> sternCurl (598,345), painted heights subtracted */
    const A = [X(440), ZH(400, 1.6)], B = [X(598), ZH(345, 2.4)];
    const ship1 = makeShip({ id: 'ship-1', seed: 84001, oarSide: -1, mastRake: 0.04 });
    ship1.position.set((A[0] + B[0]) / 2, 0.18, (A[1] + B[1]) / 2);
    ship1.rotation.y = Math.atan2(B[0] - A[0], B[1] - A[1]) + Math.PI / 2;
    track('ship-1', ship1);
    /* ship-2: sternCurl (516,432) -> prowCurl (686,428) — THE YARDSTICK */
    const C = [X(516), ZH(432, 2.0)], D = [X(686), ZH(428, 2.0)];
    const ship2 = makeShip({ id: 'ship-2', seed: 84002, oarSide: -1, mastRake: -0.02 });
    ship2.position.set((C[0] + D[0]) / 2, 0.18, (C[1] + D[1]) / 2);
    ship2.rotation.y = Math.atan2(D[0] - C[0], D[1] - C[1]) + Math.PI / 2;
    track('ship-2', ship2);
  }

  /* ===== MESO: THE CAMPFIRE — hero ring + the shared blaze ===== */
  const FIRE = { x: 0, z: 0 };
  {
    const grp = new THREE.Group();
    const rnd = mulberry32(81002);
    const stoneG = jitterByPos(new THREE.IcosahedronGeometry(0.4, 1), 81002, 0.1);
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
    const flames = fireSystem({ count: 260, seed: 80906, radius: 0.85, height: 3.6, size: 1.05, mode: 'flame' });
    const embers = fireSystem({ count: 80, seed: 80956, radius: 0.7, height: 4.6, size: 0.2, mode: 'ember' });
    const smoke = fireSystem({ count: 40, seed: 80976, radius: 0.8, height: 6.2, size: 2.0, mode: 'smoke' });
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

  /* ===== the flickering fire light — THE one shadow caster ===== */
  const fireLight = new THREE.PointLight('#ffad42', 440, 0, 2);
  fireLight.position.set(FIRE.x, 2.2, FIRE.z + 0.4);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(1024, 1024);
  fireLight.shadow.camera.near = 0.3;
  fireLight.shadow.camera.far = 60;
  fireLight.shadow.bias = -0.004;
  root.add(fireLight);
  const bounce = new THREE.PointLight('#ff9a4a', 115, 0, 1.7);
  bounce.position.set(FIRE.x, 4.6, FIRE.z + 0.6);
  root.add(bounce);
  const flick = flickCurve;
  let dayState = 0;
  tickers.push((t, f, day) => {
    fireLight.intensity = day ? 0 : 440 * f;
    bounce.intensity = day ? 0 : 115 * (0.7 + 0.3 * f);
  });

  /* ===== the light rigs: night (the book's frame) / dawn preset ===== */
  /* W5 — the ambient key comes DOWN (1.05 -> 0.84) and warms off the blue. Measured
     against the plate, the shipped rig was lifting the wrong things: the left crags
     came out at L 0.197 against the plate's 0.157 and strongly blue (mean B 0.309 vs
     R 0.187), while the mainland sat at 0.157 against the plate's 0.195. One flat
     hemisphere cannot hold both, so the ambient drops and the mainland gets its own
     key below. */
  const hemi = new THREE.HemisphereLight('#4a5a84', '#57452f', 0.84);
  const moon = new THREE.DirectionalLight('#c0cce8', 0.75);
  moon.position.set(-35, 58, 62);                  /* high front-left — the plate's pale faces */
  const sun = new THREE.DirectionalLight('#ffc9a0', 0);
  sun.position.set(95, 32, 18);                    /* dawn, low from the east */
  /* THE MAINLAND KEY (W5). The far shore is the story's destination — the cave the
     crew will walk into — and the plate keeps it CLEARLY lit while the strait stays
     black. A directional light cannot do that (it lights the whole diorama), so the
     mainland gets a local point key: parked downstage-above the yard, inverse-square,
     no shadow (the campfire remains THE one shadow caster, unchanged). At the yard
     it lands 1/350 of intensity; back at the camp 22 m further off it is 1/3150 —
     a 9x falloff, so the beach and the strait keep their dark. */
  const mainKey = new THREE.PointLight('#c8cfdc', 430, 92, 2);
  mainKey.position.set(46, 18, -26);
  root.add(hemi, moon, sun, mainKey);
  parts['light-rig'] = hemi;

  const setState = (state) => {
    const day = state === 'day' ? 1 : 0;
    dayState = day;
    skyGeo.setAttribute('color', day ? skyDawn : skyNight);
    for (const o of nightOnly) o.visible = !day;
    for (const o of fireParts) o.visible = !day;
    waterMat.uniforms.uDay.value = day;
    hemi.color.set(day ? '#e0a9a0' : '#4a5a84');
    hemi.groundColor.set(day ? '#6a5a48' : '#57452f');
    hemi.intensity = day ? 1.3 : 0.84;
    moon.intensity = day ? 0 : 0.75;
    sun.intensity = day ? 1.7 : 0;
    mainKey.intensity = day ? 0 : 430;      /* dawn's sun lights the mainland itself */
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
