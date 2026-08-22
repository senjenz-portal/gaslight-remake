/**
 * _station.mjs — the DP's tape measure.
 *
 * Answers, for a candidate camera station, the two questions the shot spec
 * cannot be authored without: IS IT LEGAL (inside the set's camera volume,
 * out of every ledger obstacle box) and WHAT LANDS WHERE (the NDC position of
 * any world point, on the declared lens).
 *
 *   node tools/ody/_station.mjs cave 1.4 0.55 5.0  --look 0.168 2.417 5.16 \
 *        --fov 42 --pt eye 2.656 1.909 3.907 --pt hands -1.13 1.3 6.477
 */
const D2R = Math.PI / 180, ASPECT = 1600 / 940;
const FRAME = { shore: { S: 11.3, CX: 438, CY: 466, elev: 28 },
  cave: { S: 43.0, CX: 704, CY: 460, elev: 25 },
  sea: { S: 12.7, CX: 704, CY: 470, elev: 30 } };
const VOL = {
  shore: { cx: 4, cz: 8, rx: 62, rz: 40, ry: 1e4, ymin: 1.0, ymax: 30 },
  cave: { cx: 0.8, cy: 0, cz: -2.0, rx: 13.4, ry: 8.6, rz: 8.2, k: 0.78, ymin: 0.55, ymax: 6.6 },
  sea: { cx: -8, cz: 2, rx: 52, rz: 38, ry: 1e4, ymin: 1.2, ymax: 34 },
};
const OBST = {
  shore: { campfireRing: [[403, 431], [473, 501]], dayGoat: [[395, 465], [450, 530]],
    sternCurlMass: [[495, 430], [545, 488]], ship1Oars: [[574, 488], [639, 512]] },
  cave: { mouthAperture: [[290, 250], [405, 415]], rackA: [[535, 195], [625, 385]],
    rackB: [[638, 160], [712, 345]], rackC: [[716, 135], [792, 340]],
    rackD: [[800, 130], [880, 330]], floorCheeses: [[600, 342], [665, 390]],
    fireRingOuter: [[527, 418], [733, 500]], fireRingRimNW: [[485, 425], [527, 485]],
    firewood: [[495, 495], [620, 555]], logBundle: [[645, 462], [745, 497]],
    mainPen: [[775, 290], [1050, 425]], frontPen: [[860, 425], [1090, 525]],
    bed: [[1025, 330], [1240, 500]], milkTub: [[865, 470], [915, 520]],
    clayBowl: [[805, 505], [860, 535]], logsRight: [[1105, 480], [1180, 520]] },
  sea: { cliffMass: [[690, 150], [1270, 600]], splashImpact1: [[448, 485], [488, 525]],
    splashImpact2: [[435, 520], [475, 560]] },
};
const worldOf = (w, px, py, y = 0) =>
  ({ x: (px - w.CX) / w.S, y, z: (py - w.CY) / (w.S * Math.sin(w.elev * D2R)) });
const boxWorld = (w, [[x0, y0], [x1, y1]]) => {
  const a = worldOf(w, x0, y0), b = worldOf(w, x1, y1);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
           z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
};

const A = process.argv.slice(2);
const set = A[0];
const P = { x: +A[1], y: +A[2], z: +A[3] };
const arg = (k, n) => { const i = A.indexOf(k); return i < 0 ? null : A.slice(i + 1, i + 1 + n).map(Number); };
const many = (k, n = 4) => { const o = []; for (let i = 0; i < A.length; i++) if (A[i] === k) o.push([A[i + 1], ...A.slice(i + 2, i + 1 + n).map(Number)]); return o; };
const L = arg('--look', 3) || [0, 1, 0];
const fov = (arg('--fov', 1) || [40])[0];
const w = FRAME[set], v = VOL[set];

const e = ((P.x - v.cx) / v.rx) ** 2 + ((P.y - (v.cy || 0)) / (v.ry || 1e4)) ** 2 +
          ((P.z - v.cz) / v.rz) ** 2;
const inShell = e <= (v.k || 1) && P.y >= v.ymin && P.y <= v.ymax;
const hits = Object.entries(OBST[set]).map(([k, b]) => [k, boxWorld(w, b)])
  .filter(([, b]) => P.x > b.x0 - 0.35 && P.x < b.x1 + 0.35 && P.z > b.z0 - 0.35 && P.z < b.z1 + 0.35)
  .map(([k]) => k);
console.log(`station ${set} [${P.x}, ${P.y}, ${P.z}]  shell ${e.toFixed(3)}/${v.k || 1} ` +
  `${inShell ? 'IN' : 'OUT'}  y-band ${v.ymin}..${v.ymax}  obstacles: ${hits.join(', ') || 'none'}`);
console.log(`LEGAL: ${inShell && !hits.length}`);

/* the frame: every named point in NDC on this lens */
const f = { x: L[0] - P.x, y: L[1] - P.y, z: L[2] - P.z };
const fl = Math.hypot(f.x, f.y, f.z) || 1;
f.x /= fl; f.y /= fl; f.z /= fl;
const r = { x: -f.z, y: 0, z: f.x };
const rl = Math.hypot(r.x, r.z) || 1; r.x /= rl; r.z /= rl;
const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
const t = Math.tan(fov * D2R / 2);
const ndc = (Q) => {
  const d = { x: Q[0] - P.x, y: Q[1] - P.y, z: Q[2] - P.z };
  const z = d.x * f.x + d.y * f.y + d.z * f.z;
  if (z <= 0.02) return { behind: true, z: +z.toFixed(2) };
  return { x: +((d.x * r.x + d.y * r.y + d.z * r.z) / z / (t * ASPECT)).toFixed(3),
           y: +((d.x * u.x + d.y * u.y + d.z * u.z) / z / t).toFixed(3), z: +z.toFixed(2) };
};
console.log(`lens fov ${fov}  look [${L.join(', ')}]  fwd pitch ` +
  `${(Math.asin(f.y) / D2R).toFixed(1)}deg`);
for (const [name, x, y, z] of many('--pt'))
  console.log(`  ${String(name).padEnd(10)} ${JSON.stringify(ndc([x, y, z]))}`);
for (const [name, x, y, z, h] of many('--body', 5)) {
  const top = ndc([x, y + h, z]), bot = ndc([x, y, z]);
  console.log(`  ${String(name).padEnd(10)} foot ${JSON.stringify(bot)} crown ${JSON.stringify(top)}` +
    (top.behind || bot.behind ? '' : `  frame-height ${(Math.abs(top.y - bot.y) / 2).toFixed(3)}`));
}
