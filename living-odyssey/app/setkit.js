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
 * The strip PROOF (the sherlock verifier's law: "a wrong transform cannot
 * describe itself correctly") — the foot measured off the RENDERED box
 * (getBoundingClientRect -> toPlate) against the mark the paint was asked
 * for. Returns { frame, foot, dx, dy } or null while the node is dark.
 */
export function stripProof(st, node, strip, frame, at, flip) {
  const r = node.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const a = st.toPlate(r.left, r.top), b = st.toPlate(r.right, r.bottom);
  const axk = strip.anchors[frame] / strip.cell[0];
  const fx = a.x + (b.x - a.x) * (flip ? 1 - axk : axk);
  const fy = a.y + (b.y - a.y) * (strip.srcH / strip.cell[1]);
  return { frame,
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
