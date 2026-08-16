/**
 * setkit.js — the four things every SET needs and none of them owns.
 *
 * A SET is a painted 1408x768 plate plus the cut-outs laid over it in PLATE
 * PIXELS. That space, and the small maths that works in it, is shared; the
 * marks, the actors and the pantomime are not, and live in sets/<name>.js.
 */
export const PLATE = { w: 1408, h: 768 };

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
export const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
export const lerp = (a, b, k) => a + (b - a) * k;
export const damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);

export function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.append(e);
  return e;
}

export function box(e, x, y, w, h) {
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if (w != null) e.style.width = w + 'px';
  if (h != null) e.style.height = h + 'px';
  return e;
}

/**
 * A SPRITE placed by its FOOT BASELINE, which is the only anchor an isometric
 * plate allows: an actor's height does not change with depth here, so a mark
 * is (x on the floor line, y of the floor line) and the picture hangs off it.
 *
 *   art     { file, size:[w,h], baseline, cell?:[w,h], frames? }
 *   at      [x, y] in plate px — where the FEET are
 *   h       rendered height in plate px (the scale law lives in the set)
 *   frame   which cell of a strip
 *   flip    mirror about the foot mark (a strip drawn facing one way only)
 */
export function placeSprite(node, art, at, h, { frame = 0, flip = false, scale = 1 } = {}) {
  const cw = art.cell ? art.cell[0] : art.size[0];
  const ch = art.cell ? art.cell[1] : art.size[1];
  const k = (h * scale) / ch;
  const w = cw * k, hh = ch * k;
  const footY = art.baseline * k;
  box(node, at[0] - w / 2, at[1] - footY, w, hh);
  if (art.cell) {
    node.style.backgroundSize = `${(cw * art.frames * k).toFixed(2)}px ${hh.toFixed(2)}px`;
    node.style.backgroundPosition = `${(-frame * w).toFixed(2)}px 0px`;
  }
  node.style.transformOrigin = `${(w / 2).toFixed(2)}px ${footY.toFixed(2)}px`;
  node.style.transform = flip ? 'scaleX(-1)' : 'none';
  return { w, h: hh, footY };
}

/**
 * A SPRITE STRIP placed by THE ANCHOR LAW (room.js KING.walk, the proven
 * machinery): `anchors[frame]` is the centre of the FOOT SPAN in each cell's
 * bottom 20 alpha rows, measured per frame off the cell's own alpha —
 * anchoring each frame on its own feet is what stops a cell-to-cell
 * difference in where the feet sit from reading as a lurch. `srcH` is the
 * foot-baseline height inside a cell, so `ws = hPx / srcH` is scale-free.
 * The transform-origin sits ON the foot anchor, so flip (a strip authored
 * facing one way) cannot move the feet by construction. The FRAME is the
 * caller's law: cumulative DISTANCE for a walk (an eased speed profile can
 * never skate the feet), the verb's own clock for a loop (oars, the auger).
 *
 *   strip  { cell:[w,h], n, srcH, anchors }   — tools/ody/strips.json verbatim
 *   at     [x, y] in plate px — where the FEET are
 *   hPx    drawn foot-baseline height in plate px
 */
export function placeStrip(node, strip, at, hPx, frame, { flip = false } = {}) {
  const ws = hPx / strip.srcH;
  const cw = strip.cell[0] * ws, ch = strip.cell[1] * ws;
  const ax = strip.anchors[frame] * ws;
  node.style.left = (at[0] - ax).toFixed(2) + 'px';
  node.style.top = (at[1] - hPx).toFixed(2) + 'px';
  node.style.width = cw.toFixed(2) + 'px';
  node.style.height = ch.toFixed(2) + 'px';
  node.style.backgroundSize = `${(cw * strip.n).toFixed(2)}px ${ch.toFixed(2)}px`;
  node.style.backgroundPosition = `${(-frame * cw).toFixed(2)}px 0px`;
  node.style.transformOrigin = `${ax.toFixed(2)}px ${hPx.toFixed(2)}px`;
  node.style.transform = flip ? 'scaleX(-1)' : 'none';
  return { w: cw, h: ch, ax };
}

/**
 * THE KING LAW, generalised off the registry (no hardcoded frame counts):
 * a walk cycle of `n` cells is TWO strides — each foot is the planted anchor
 * for n/2 frames (the anchors' own alternation: the foot-span centre the
 * registry measures in each cell's bottom 20 alpha rows swaps sides once per
 * half-cycle, so n_contact = n/2 is the strip's own number, read from it).
 * One stride therefore advances pxPerFrame x n_contact plate px, and the
 * ground the mark may cover per frame — the rate that keeps the feet honest
 * whatever the speed profile does — is
 *
 *     pxPerFrame = stridePx / n_contact = 2 * stridePx / n
 *
 * Distance drives the frame (frame = floor(travelled / pxPerFrame) % n), so
 * the per-strip FRAME RATE is the walk's own translation speed over this
 * number: v / pxPerFrame. A 4-cell strip at a 0.75 m stride and 11.3 px/m
 * gets the proven 4.2; the 10-cell seedance strips get 1/2.5 of it, and the
 * feet keep the same ground per stride either way.
 */
export function stripPxPerFrame(strip, stridePx) {
  return stridePx / (strip.n / 2);
}

/**
 * PLAY-ONCE MODE, for kind:'bridge' strips (registry `from` -> `to` pose
 * transitions): the frame index is CLAMPED PROGRESS — the act's own k drives
 * it exactly the way distance drives a walk's frames (the King law with the
 * act for ground), so the bridge can only ever play forward, once, and its
 * last cell — gated by the build to match pose B within the endpoint law —
 * is where it parks. On completion (k >= 1) the set swaps to the static
 * pose B cut it already uses; frame n-1 matches that cut by gate, so the
 * swap is within one frame by construction.
 */
export const bridgeFrame = (strip, k) =>
  Math.min(strip.n - 1, Math.floor(clamp01(k) * strip.n));

/** LOOP MODE, for kind:'loop' strips: the verb's own clock over the loop's
 *  period — a pure function of t, so a replayed lap lands on the same cell. */
export const loopFrame = (strip, t, period) =>
  Math.floor((((t / period) % 1) + 1) % 1 * strip.n) % strip.n;

/** polyline arc length, for the arc-parameterised walks below */
export function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

/** the point a given ARC LENGTH along a polyline — constant parameter speed
 *  IS constant ground speed, which alongPath's per-segment fractions are not */
export function alongPathArc(pts, s) {
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left <= d || i === pts.length - 1) {
      const u = d > 0 ? Math.min(1, left / d) : 1;
      return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
    }
    left -= d;
  }
  return pts[pts.length - 1].slice();
}

/**
 * A damped walk with an HONEST GROUND SPEED: the damp asks, the gait grants.
 * The exponential damp's first step is lambda x distance px/s — a 250 px
 * re-stage at lambda 2.2 opens at 550 px/s, which no pair of feet performs —
 * so the step toward the damp's own target is capped at vmax (the actor's
 * walking speed at the set's px/m). Under the cap the tail is the damp
 * verbatim; over it the walk is a walk. Mutates P.x / P.y.
 */
export function walkToward(P, tx, ty, lambda, vmax, dt) {
  const nx = damp(P.x, tx, lambda, dt), ny = damp(P.y, ty, lambda, dt);
  const dx = nx - P.x, dy = ny - P.y;
  const dd = Math.hypot(dx, dy), cap = vmax * dt;
  if (dd > cap) { P.x += dx * (cap / dd); P.y += dy * (cap / dd); }
  else { P.x = nx; P.y = ny; }
}

/**
 * The strip PROOF (the sherlock verifier's law: "a wrong transform cannot
 * describe itself correctly") — the foot measured off the RENDERED box
 * (getBoundingClientRect -> toPlate) against the mark the paint was asked
 * for. `anchor` is the registry's own per-frame foot anchor (source px), so
 * a lap can hold the anti-skate law without re-deriving the set: while the
 * frame — and with it the anchor, the planted foot — holds, the measured
 * foot may move only at the walk's own honest ground speed.
 * Returns { frame, anchor, foot, dx, dy } or null while the node is dark.
 */
export function stripProof(st, node, strip, frame, at, flip) {
  const r = node.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const a = st.toPlate(r.left, r.top), b = st.toPlate(r.right, r.bottom);
  const axk = strip.anchors[frame] / strip.cell[0];
  const fx = a.x + (b.x - a.x) * (flip ? 1 - axk : axk);
  const fy = a.y + (b.y - a.y) * (strip.srcH / strip.cell[1]);
  return { frame, anchor: strip.anchors[frame],
           foot: [+fx.toFixed(2), +fy.toFixed(2)],
           dx: +(fx - at[0]).toFixed(2), dy: +(fy - at[1]).toFixed(2) };
}

/** A polyline floor: y where a foot at plate-x lands. Sets carry their own. */
export function floorY(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (x <= b[0]) return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  }
  return points[points.length - 1][1];
}

/** Build the emissive divs a set's life pass measured. Returns id -> node. */
export function emissives(list, parent) {
  const out = {};
  for (const e of list) {
    const d = el('div', 'emis', parent);
    box(d, e.at[0] - e.r, e.at[1] - e.r, e.r * 2, e.r * 2);
    d.style.background = `radial-gradient(circle at 50% 50%,rgba(${e.rgb},${e.a}) 0%,` +
                         `rgba(${e.rgb},${e.a * 0.42}) 38%,rgba(${e.rgb},0) 72%)`;
    out[e.id] = d;
  }
  return out;
}

/** The breath every painted light in this book has: one sine, per its period. */
export function breathe(nodes, list, t, amb) {
  for (const e of list) {
    const d = nodes[e.id];
    if (!d) continue;
    const a = 1 + amb * e.amp * Math.sin(2 * Math.PI * t / e.per);
    d.style.opacity = (a * (e.gain == null ? 1 : e.gain)).toFixed(3);
  }
}
