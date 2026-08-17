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
export function placeStrip(node, strip, at, hPx, frame,
                           { flip = false, bob = 0, rot = 0, sy = 1 } = {}) {
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
  /* LANE PHYSICS (explore-physics.md, Explorer D): step-synced bob rides the
     strip box — translateY about the foot origin, so flip still cannot move
     the feet by construction. The set declares the same bob in its strip
     proof (the mark it hands the lap is bob-shifted), so the anchor law
     measures the residual, not the intended breath. THE WEIGHT LANE adds
     `rot` (torso lag, a degree or so of lean about the foot origin) and
     `sy` (impact squash) — both turn/scale about the SAME origin, so like
     flip they cannot move the foot by construction, and both are DECLARED
     to stripProof, which unwinds them from the rendered AABB exactly. */
  const tf = (bob ? `translateY(${bob.toFixed(2)}px)` : '') +
             (rot ? ` rotate(${rot.toFixed(3)}deg)` : '') +
             (flip || sy !== 1 ? ` scale(${flip ? -1 : 1}, ${sy.toFixed(5)})` : '');
  node.style.transform = tf.trim() || 'none';
  return { w: cw, h: ch, ax };
}

/* ==== LANE PHYSICS (Explorer D, adopted) — gait off the strips' anchors ====
 *
 * The motion audit's finding (tools/ody/seamless/audit-motion.md): the book's
 * translation was a constant-velocity glide (the caps clamp to exactly vmax;
 * the authored eases have zero structure at cadence), the boxes carried no
 * step-bob, and walks started/stopped in one frame. The gait data to fix all
 * three is ALREADY in the registry: `anchors[frame]` is the measured
 * foot-span centre per cell, and the KING law says the planted foot swaps
 * once per half-cycle — the swap IS the plant (foot strike), and it reads as
 * the largest |anchor delta| in each half of the cycle.                     */

/** Read a strip's gait off its anchors: the two PLANT frames (largest anchor
 *  jump in each half-cycle), a mean-1 speed-pulse table (dips at the plants,
 *  rises through the swing) and a 0..1 bob table (0 = plant = body low,
 *  1 = mid-swing = body high), both over continuous frame-phase [0, n). */
export function gaitProfile(strip, { dip = 0.38, res = 8 } = {}) {
  const n = strip.n, a = strip.anchors;
  const d = [];
  for (let i = 0; i < n; i++) d.push(Math.abs(a[i] - a[(i - 1 + n) % n]));
  let p0 = 0;
  for (let i = 1; i < n; i++) if (d[i] > d[p0]) p0 = i;
  let p1 = -1;
  for (let i = 0; i < n; i++) {
    const dd = Math.min((i - p0 + n) % n, (p0 - i + n) % n);
    if (dd >= 3 && (p1 < 0 || d[i] > d[p1])) p1 = i;
  }
  const plants = [p0, p1];
  const N = n * res, pulse = new Float32Array(N), bob = new Float32Array(N);
  let mean = 0;
  for (let k = 0; k < N; k++) {
    const phi = k / res;
    let dm = n;
    for (const p of plants) {
      const dd = Math.abs(phi - p);
      dm = Math.min(dm, dd, n - dd);
    }
    /* cosine-smoothed 0 at the plant -> 1 mid-swing over a quarter cycle */
    const s = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, dm / (n / 4)));
    pulse[k] = (1 - dip) + (dip + 0.55 * dip) * s;  // dip at plant, rise past 1
    bob[k] = s;
    mean += pulse[k];
  }
  mean /= N;
  for (let k = 0; k < N; k++) pulse[k] /= mean;     // average speed preserved
  return { n, res, plants, pulse, bob };
}

/**
 * THE STANCE-LOCK PROFILE (the weight lane, gaitProfile's heavier sibling):
 * a speed table that is ZERO through each PLANT CELL — the whole cell the
 * registry's anchors call a foot strike — with LINEAR ramps of `ramp` cells
 * either side and a flat swing between, normalised to mean 1. Driven by a
 * phase clock (cells advance with time), the mark then stands STILL while a
 * plant cell holds the picture — the planted foot cannot skate because the
 * ground does not move under it — and the stride's ground is banked into
 * the swing cells. Linear ramps on purpose: a cosine knee's peak slope is
 * pi/2 of the mean and breaks the one-frame speed law at 30 fps sampling.
 * Mean 1 keeps the phase clock and the ground clock in step every cycle.
 */
export function gaitLockProfile(strip, { ramp = 0.7, res = 8 } = {}) {
  const base = gaitProfile(strip, { res });        // plants + bob, unchanged
  const { n, plants } = base;
  const N = n * res, pulse = new Float32Array(N);
  let mean = 0;
  for (let k = 0; k < N; k++) {
    const phi = k / res;
    let d = n;                     // distance OUTSIDE the nearest plant cell
    for (const p of plants) {
      const rel = (((phi - p) % n) + n) % n;       // 0..n past the cell head
      d = Math.min(d, rel < 1 ? 0 : Math.min(rel - 1, n - rel));
    }
    pulse[k] = Math.min(1, d / ramp);
    mean += pulse[k];
  }
  mean /= N;
  for (let k = 0; k < N; k++) pulse[k] /= mean;
  return { ...base, pulse, lock: 1, ramp };
}

/** table lookup at continuous frame-phase phi (wraps) */
export const gaitAt = (G, table, phi) => {
  const k = Math.floor((((phi % G.n) + G.n) % G.n) * G.res);
  return table[Math.min(table.length - 1, Math.max(0, k))];
};

/** step-synced bob in px, +down: the body sinks amp/2 into each plant and
 *  rises amp/2 through the swing — phase off the SAME gait clock (distance /
 *  pxPerFrame) that drives the frames, so bob and cells cannot drift apart */
export const gaitBobY = (G, phi, amp) =>
  amp * (0.5 - gaitAt(G, G.bob, phi));

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

/**
 * A BRIDGE RETIME (the weight lane): a bridge's ten cells are rarely ten
 * equal beats — the seedance chains compress anticipation into one cell
 * seam and spread the settle across three — so a bridge may declare per-cell
 * WEIGHTS and drive bridgeFrame through this warp: k in [0,1] spends
 * weights[i] of itself inside cell i and returns the continuous warped
 * phase u in [0,1] (monotone by construction — a warp cannot ping-pong).
 */
export function bridgeWarp(weights) {
  const cum = [0];
  for (const w of weights) cum.push(cum[cum.length - 1] + w);
  const total = cum[cum.length - 1], n = weights.length;
  return (k) => {
    const t = clamp01(k) * total;
    let i = 0;
    while (i < n - 1 && t > cum[i + 1]) i++;
    return (i + (weights[i] > 0 ? clamp01((t - cum[i]) / weights[i]) : 1)) / n;
  };
}

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
 * walkToward2 — walkToward with the physics the motion audit found missing
 * (LANE PHYSICS, Explorer D adopted):
 *   (a) per-step velocity pulse locked to the strip's plant frames
 *       (phase = the actor's own gait clock, P.dist / pxPerFrame — the same
 *        clock that picks the cell, so the dip lands ON the plant)
 *   (b) ~250 ms ease-in from rest and a bounded ease-out into the mark
 *       (replacing the damp's 0 -> vmax first frame and its 1.5 s sub-6 px/s
 *        terminal stand-cut drift)
 *   (c) a small arrival settle: overshoot along the travel and back — a body
 *       does not stop dead from full stride (settlePx <= 0 turns it off)
 * State lives on P._w2; `lambda` is kept in the signature for drop-in
 * compatibility with walkToward but the tail is now the bounded ease-out.
 * Mutates P.x / P.y.
 */
export function walkToward2(P, tx, ty, lambda, vmax, dt,
                            { gait = null, pxPerFrame = 1, ease = 0.25,
                              settlePx = null, settleT = 0.15 } = {}) {
  /* the settle scales with the walk: peak overshoot speed = 0.35 x vmax
     (a half-sine of amplitude A over T peaks at A*pi/T), so a 16 px/s
     shore walker checks by ~0.27 px and an 86 px/s cave man by ~1.4 px —
     never a lurch against the walk's own cruise */
  if (settlePx == null) settlePx = 0.35 * vmax * settleT / Math.PI;
  const W = P._w2 || (P._w2 = { run: 0, peakV: 0, settle: null });
  if (W.settle) {                       // the settle plays itself out
    const s = W.settle; s.t += dt;
    const u = s.t / s.dur;
    if (u >= 1) { P.x = s.at[0]; P.y = s.at[1]; W.settle = null; }
    else {
      const o = Math.sin(Math.PI * u) * s.amp;
      P.x = s.at[0] + s.dir[0] * o; P.y = s.at[1] + s.dir[1] * o;
    }
    return;
  }
  const rx = tx - P.x, ry = ty - P.y;
  const rem = Math.hypot(rx, ry);
  if (rem < 1e-3) { W.run = 0; W.peakV = 0; return; }
  W.run += dt;
  const envIn = easeInOut(Math.min(1, W.run / ease));
  const envOut = Math.max(0.15, easeInOut(clamp01(rem / (vmax * ease))));
  const v0 = vmax * envIn * envOut;
  /* CADENCE ATTENUATION: at high stride rates the gait cycle shortens
     (cycleT = n*pxPerFrame / v); a full-depth pulse faster than ~0.9 s a
     cycle reads as flicker and breaks the one-frame speed law (<= 25%),
     so the pulse depth scales down with the cycle — a sprint smooths out,
     a walk keeps its full step structure. */
  let pulse = 1;
  if (gait) {
    const att = clamp01(gait.n * pxPerFrame / (Math.max(v0, 1) * 0.9));
    pulse = 1 + (gaitAt(gait, gait.pulse, (P.dist || 0) / pxPerFrame) - 1) * att;
  }
  const v = v0 * pulse;
  const step = Math.min(rem, v * dt);
  P.x += (rx / rem) * step; P.y += (ry / rem) * step;
  W.peakV = Math.max(W.peakV, step / Math.max(dt, 1e-6));
  if (step >= rem - 1e-6) {             // arrived
    if (W.peakV > vmax * 0.5 && settlePx > 0) {   // a real walk settles;
      W.settle = { at: [tx, ty], dir: [rx / rem, ry / rem],  // a nudge parks
                   amp: settlePx, t: 0, dur: settleT };
    }
    W.run = 0; W.peakV = 0;
  }
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
export function stripProof(st, node, strip, frame, at, flip, dec = {}) {
  const r = node.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const a = st.toPlate(r.left, r.top), b = st.toPlate(r.right, r.bottom);
  /* the foot origin's fraction of the drawn AABB under the transform the
     set DECLARED (flip / torso-lag rot / squash sy, all about the foot
     origin — placeStrip's own order). At rot 0 / sy 1 this is byte-for-byte
     the old anchors fraction; under them it is EXACT, so the proof still
     measures the transform's residual, never its declared intent. */
  const rot = dec.rot || 0, sy = dec.sy == null ? 1 : dec.sy;
  const ax = strip.anchors[frame], ay = strip.srcH;
  const th = rot * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [cx, cy] of [[0, 0], [strip.cell[0], 0],
                          [0, strip.cell[1]], [strip.cell[0], strip.cell[1]]]) {
    let x = cx - ax;
    const y = (cy - ay) * sy;
    if (flip) x = -x;
    const xr = x * c - y * s, yr = x * s + y * c;
    if (xr < x0) x0 = xr;
    if (xr > x1) x1 = xr;
    if (yr < y0) y0 = yr;
    if (yr > y1) y1 = yr;
  }
  const fx = a.x + (b.x - a.x) * (-x0 / (x1 - x0));
  const fy = a.y + (b.y - a.y) * (-y0 / (y1 - y0));
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

/**
 * A GRADED ACTOR CUT (Explorer B adopted — tools/ody/seamless/explore-regrade
 * .md, baked by tools/ody/seamless/bake_regrade.py into tools/ody/regrade
 * .json): every actor cut a set uses ships a per-set variant colour-graded at
 * BUILD time against the plate ring at the mark it mostly plays on, under
 * assets/actor/graded/<set>/<cut>.png. A set loads THAT, and falls back to
 * the raw cut if the variant is absent — the swap is src-only, so pins,
 * alpha, boxes and every proof drawn off them are untouched by construction.
 */
export function gradedActor(st, setId, file, cls, parent) {
  const e = st.img(file.replace(/^actor\//, 'actor/graded/' + setId + '/'),
                   cls, parent);
  e.addEventListener('error', () => { e.src = st.base + file; }, { once: true });
  return e;
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
