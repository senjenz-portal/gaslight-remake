/**
 * sigil.js — THE SEEDED DEDICATION's laurel-wreath sigil.
 *
 * byteab's lesson, applied whole: the reader's NAME is the seed and the
 * drawing is a pure function of it. String -> FNV-1a -> leaf count (8..16),
 * leaf angles and lengths, berry count and positions, and every grain of
 * hand-drawn jitter — all drawn from one mulberry32 stream seeded by the
 * hash. NOTHING here reads Date.now or Math.random (the engine is
 * deterministic by law), so the same name is the same sigil, byte for byte,
 * on any two visits. Zero generation: 100% JS, no assets, no network.
 *
 * House palette: cream ink on the navy card, ONE crimson berry accent.
 */

export const INK = '#f4ecd7';          // the closing card's own cream
export const CRIMSON = '#a3272e';      // the single berry accent

/** FNV-1a (32-bit) over the name's UTF-8 bytes. */
export function fnv32(str) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(str)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — the seeded stream every jitter below is drawn from. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Draw the wreath for `name` onto `canvas` (square). Pure: clears and
 * redraws whole; returns the FNV-1a hash the drawing was seeded with.
 */
export function drawSigil(canvas, name) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  g.clearRect(0, 0, S, canvas.height);
  const h = fnv32(name);
  const rnd = mulberry32(h);
  const leaves = 8 + (h % 9);                   // 8..16 — the hash's own count
  const cx = S * 0.5, cy = S * 0.53, R = S * 0.34;
  const j = (amp) => (rnd() - 0.5) * amp;       // hand jitter, seeded

  g.lineCap = 'round';
  g.lineJoin = 'round';

  /* the two branches: foot of the wreath to upper-left / upper-right, open
     at the top (canvas angles: 90 is the foot, 180 left, 270 the crown) */
  const BRANCH = [
    { a0: 100, a1: 242 },                       // left
    { a0: 80, a1: -62 },                        // right, the mirror
  ];
  const arcPt = (deg, r) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

  /* stems first — a jittered polyline is what reads as hand-drawn */
  g.strokeStyle = INK;
  g.globalAlpha = 0.88;
  g.lineWidth = Math.max(1.2, S * 0.011);
  for (const br of BRANCH) {
    g.beginPath();
    const STEPS = 13;
    for (let i = 0; i <= STEPS; i++) {
      const a = br.a0 + (br.a1 - br.a0) * (i / STEPS);
      const [x, y] = arcPt(a, R + j(S * 0.02));
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }

  /* the leaves, split across the branches, alternating sides of the stem */
  const nLeft = Math.ceil(leaves / 2);
  const counts = [nLeft, leaves - nLeft];
  for (let b = 0; b < 2; b++) {
    const br = BRANCH[b], k = counts[b];
    for (let i = 0; i < k; i++) {
      const t = (i + 0.55) / (k + 0.4);
      const a = br.a0 + (br.a1 - br.a0) * t;
      const [bx, by] = arcPt(a, R);
      const tang = a - 90;                       // along the branch
      const side = i % 2 ? 1 : -1;
      const tilt = tang + side * (34 + j(20)) + j(8);
      const L = S * (0.085 + rnd() * 0.055);     // leaf length
      const W = L * (0.36 + rnd() * 0.12);       // leaf half-width
      const dir = rad(tilt);
      const tx = bx + L * Math.cos(dir), ty = by + L * Math.sin(dir);
      const nx = -Math.sin(dir), ny = Math.cos(dir);
      const mx = (bx + tx) / 2, my = (by + ty) / 2;
      g.beginPath();
      g.moveTo(bx + j(1.4), by + j(1.4));
      g.quadraticCurveTo(mx + nx * W + j(1.6), my + ny * W + j(1.6),
                         tx + j(1.2), ty + j(1.2));
      g.quadraticCurveTo(mx - nx * W + j(1.6), my - ny * W + j(1.6),
                         bx + j(1.4), by + j(1.4));
      g.closePath();
      g.globalAlpha = 0.82;
      g.fillStyle = INK;
      g.fill();
      g.globalAlpha = 0.55;
      g.stroke();
    }
  }

  /* the berries: 1..3 of them, the FIRST is the one crimson accent */
  const nB = 1 + ((h >>> 8) % 3);
  for (let i = 0; i < nB; i++) {
    const br = BRANCH[(h >>> (10 + i)) & 1];
    const t = 0.2 + rnd() * 0.6;
    const a = br.a0 + (br.a1 - br.a0) * t;
    const [x, y] = arcPt(a, R - S * 0.045 + j(S * 0.02));
    const r = S * (0.016 + rnd() * 0.01);
    g.beginPath();
    g.arc(x + j(1.2), y + j(1.2), r, 0, TAU);
    g.globalAlpha = i === 0 ? 0.95 : 0.85;
    g.fillStyle = i === 0 ? CRIMSON : INK;
    g.fill();
  }

  /* the tie at the foot — two short crossed strokes */
  g.strokeStyle = INK;
  g.globalAlpha = 0.8;
  g.lineWidth = Math.max(1.1, S * 0.009);
  const [fx, fy] = arcPt(90, R);
  g.beginPath();
  g.moveTo(fx - S * 0.03 + j(1.5), fy + S * 0.035 + j(1.5));
  g.lineTo(fx + S * 0.028 + j(1.5), fy - S * 0.02 + j(1.5));
  g.moveTo(fx + S * 0.03 + j(1.5), fy + S * 0.035 + j(1.5));
  g.lineTo(fx - S * 0.028 + j(1.5), fy - S * 0.02 + j(1.5));
  g.stroke();
  g.globalAlpha = 1;
  return h;
}
