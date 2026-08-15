/**
 * lenslaw.mjs — THE CONTENT-BBOX LAW, computed for every lens in the book.
 *
 * A lens is [cx, cy, k] in plate px. What the reader is shown is the plate
 * window that lens opens, AFTER the camera's own edge clamp (stage.applyCam:
 * the camera may never show past the edge of the painting). A lens fails the law
 * when that window includes plate that carries NO PAINTING — the audit's
 * "21-30% of the panel is dead backdrop", which portrait has had a gate for
 * (DEAD_BAND_MAX) since round 2 and landscape has never had.
 *
 * Content bboxes are measured off the plates themselves (see the printout at the
 * foot of this file); they are the same numbers the sets export as CONTENT.
 *
 * Usage: node tools/living/lenslaw.mjs
 */
import { PLATE } from '../../site-deploy/living/app/setkit.js';

export const CONTENT = {
  // measured: per-column/row fraction of pixels that differ from the plate's
  // own corner backdrop by more than 18/255, at 0.5% of the column
  room: [266, 15, 1123, 767],
  street: [231, 0, 1168, 767],
  chase: [137, 0, 1407, 743],
  church: [0, 0, 1407, 767],
};

export const DEAD_BAND_MAX = 0.08;      // the same number portrait has used

/**
 * THE LANDSCAPE DEAD BAND, measured on the RENDERED frame.
 *
 * The bbox law above is what a lens SHOULD be composed against, and it is the
 * right thing to author with. It is not the right thing to assert, because a
 * plate's own painted margin can be as dead as unpainted plate — the audit's
 * numbers came from counting near-black pixels, not from the bbox. So the gate
 * is this: split the panel into N strips a side, and measure the longest run of
 * strips from each edge that is at least `frac` near-black. That is exactly "how
 * much of the panel is a dead band", and it caught every frame the review named:
 *
 *     07-00-head   1.00   the Beat VII heading, shot under a raised cover
 *     01-10        0.28   the door lens, pinned by the camera's edge clamp
 *     01-36/37     0.28   the same lens
 *     02-01        0.24   the villa lens, pinned by the clamp at the other edge
 *     05-05        0.24   the station lens, hanging off the painting's left
 *
 * against a median of 0.08 over all 74 review frames. LANDSCAPE_MAX is set above
 * that median band and below every named failure.
 *
 * Two exemptions, both principled: a frame with an INSET raised is deliberately
 * a dimmed world under a card (the card is the picture, and dimming the plate
 * pushes its margins under near-black), and the closing leaf is deliberately
 * blank.
 */
export const NEAR_BLACK = 26;           // png.mjs's own constant
export const LANDSCAPE_MAX = 0.22;
export const BAND_N = 25;
export const BAND_FRAC = 0.94;

export function edgeBands(frame, rect, { n = BAND_N, thr = NEAR_BLACK,
                                         frac = BAND_FRAC } = {}) {
  const ch = frame.channels || 4;
  const x0 = Math.max(0, Math.round(rect.x)), y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(frame.width, Math.round(rect.x + rect.w));
  const y1 = Math.min(frame.height, Math.round(rect.y + rect.h));
  const W = x1 - x0, H = y1 - y0;
  if (W < n || H < n) return { left: 0, right: 0, top: 0, bottom: 0, max: 0 };
  const dark = (x, y) => {
    const i = (y * frame.width + x) * ch;
    const l = ch === 1 ? frame.data[i]
      : 0.2126 * frame.data[i] + 0.7152 * frame.data[i + 1] + 0.0722 * frame.data[i + 2];
    return l < thr ? 1 : 0;
  };
  const col = [], row = [];
  for (let i = 0; i < n; i++) {
    let d = 0, t = 0;
    for (let x = x0 + Math.floor(i * W / n); x < x0 + Math.floor((i + 1) * W / n); x++) {
      for (let y = y0; y < y1; y += 2) { d += dark(x, y); t++; }
    }
    col.push(d / Math.max(1, t));
    d = 0; t = 0;
    for (let y = y0 + Math.floor(i * H / n); y < y0 + Math.floor((i + 1) * H / n); y++) {
      for (let x = x0; x < x1; x += 2) { d += dark(x, y); t++; }
    }
    row.push(d / Math.max(1, t));
  }
  const run = (v) => { let k = 0; for (const x of v) { if (x >= frac) k++; else break; } return k / v.length; };
  const out = { left: run(col), right: run([...col].reverse()),
                top: run(row), bottom: run([...row].reverse()) };
  out.max = Math.max(out.left, out.right, out.top, out.bottom);
  return out;
}

/** The plate window a lens opens, with the camera's own clamp applied. */
export function windowOf([cx, cy, k], vis = { w: PLATE.w, h: PLATE.h }) {
  let X = vis.w / 2 - cx * k;
  let Y = vis.h / 2 - cy * k;
  X = Math.min(0, Math.max(vis.w - PLATE.w * k, X));
  Y = Math.min(0, Math.max(vis.h - PLATE.h * k, Y));
  return { x0: -X / k, y0: -Y / k, x1: (-X + vis.w) / k, y1: (-Y + vis.h) / k,
           w: vis.w / k, h: vis.h / k, clampedX: X !== vis.w / 2 - cx * k,
           clampedY: Y !== vis.h / 2 - cy * k };
}

/** Dead band per side, as a fraction of the visible window. */
export function deadBands(lens, set, vis) {
  const w = windowOf(lens, vis);
  const c = CONTENT[set];
  return {
    left: Math.max(0, c[0] - w.x0) / w.w,
    right: Math.max(0, w.x1 - c[2]) / w.w,
    top: Math.max(0, c[1] - w.y0) / w.h,
    bottom: Math.max(0, w.y1 - c[3]) / w.h,
    win: w,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mods = {
    room: await import('../../site-deploy/living/app/sets/room.js'),
    street: await import('../../site-deploy/living/app/sets/street.js'),
    chase: await import('../../site-deploy/living/app/sets/chase.js'),
    church: await import('../../site-deploy/living/app/sets/church.js'),
  };
  for (const [set, m] of Object.entries(mods)) {
    console.log(`\n${set.toUpperCase()}  content x ${CONTENT[set][0]}..${CONTENT[set][2]}` +
                `  y ${CONTENT[set][1]}..${CONTENT[set][3]}`);
    for (const [name, f] of Object.entries(m.FOCUS)) {
      if (!Array.isArray(f)) { console.log(`  ${name.padEnd(14)} (dynamic)`); continue; }
      const d = deadBands(f, set);
      const worst = Math.max(d.left, d.right, d.top, d.bottom);
      const flag = worst > DEAD_BAND_MAX ? '  <== FAILS' : '';
      console.log(`  ${name.padEnd(14)} k=${String(f[2]).padEnd(5)} ` +
        `win x ${d.win.x0.toFixed(0)}..${d.win.x1.toFixed(0)} y ${d.win.y0.toFixed(0)}..${d.win.y1.toFixed(0)}` +
        `  dead L${(d.left * 100).toFixed(1)} R${(d.right * 100).toFixed(1)}` +
        ` T${(d.top * 100).toFixed(1)} B${(d.bottom * 100).toFixed(1)}` +
        `${d.win.clampedX ? ' [clampX]' : ''}${d.win.clampedY ? ' [clampY]' : ''}${flag}`);
    }
  }
}
