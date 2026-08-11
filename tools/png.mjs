/**
 * png.mjs — minimal dependency-free PNG reader, enough for the harness's
 * "is this frame actually a picture?" check. Handles what Playwright emits:
 * 8-bit, non-interlaced, colour type 2 (RGB) or 6 (RGBA).
 *
 * Returns per-image stats so lap.mjs can fail a black / flat / blown frame
 * without pulling in pngjs or sharp.
 */
import zlib from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error('unsupported bit depth ' + depth);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : -1;
  if (ch < 0) throw new Error('unsupported colour type ' + ctype);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let ri = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[ri++];
    const line = raw.subarray(ri, ri + stride); ri += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      const v = line[x];
      cur[x] = (filter === 0 ? v
        : filter === 1 ? v + a
        : filter === 2 ? v + b
        : filter === 3 ? v + ((a + b) >> 1)
        : v + paeth(a, b, c)) & 0xff;
    }
  }
  return { width: w, height: h, channels: ch, data: out };
}

/** Luma at pixel (x,y) of a decoded image. */
function lumaAt(img, x, y) {
  const { width: w, channels: ch, data } = img;
  const i = y * w * ch + x * ch;
  return ch === 1 ? data[i]
    : 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}

/**
 * The review's dark-frame metric. `NEAR_BLACK` is the luma below which a
 * surface has stopped carrying shape: at 26/255 (sRGB ~0.102) a faceted
 * silhouette is no longer separable from the page ground on a laptop panel,
 * which is exactly the round-1 "unlit void" finding. Kept as an exported
 * constant so the app-side retune and the harness agree on one number.
 */
export const NEAR_BLACK = 26;

/**
 * Round-3 [R3-3]: the luma above which a warm pane has stopped being a pane
 * and started being a hole cut in the plate. Anything over this reads as
 * clipped white on a laptop panel; the sign-off number is a ZERO fraction.
 */
export const HOT = 250;

/**
 * Luma stats on a subsampled grid (fast, and plenty for a liveness check).
 * `rect` (CSS px, top-left origin — the diorama INSET) restricts the window;
 * omit it for the whole frame. deviceScaleFactor is 1 in the lap, so the
 * app's own `view` rectangle indexes screenshot pixels directly.
 *
 *   mean       0..255 average luma
 *   stdev      0..~128 luma spread — a flat fill scores ~0
 *   nonBlack   fraction of samples above luma 12
 *   bright     fraction above luma 128 (catches a blown/white frame)
 *   nearBlack  fraction of samples BELOW NEAR_BLACK (the V1 metric)
 *   hot        fraction ABOVE HOT (the R3-3 clipped-pane metric)
 *   max        the brightest sample in the window
 */
export function statsOf(img, step = 4, rect = null) {
  const { width: w, height: h } = img;
  const x0 = rect ? Math.max(0, Math.round(rect.x)) : 0;
  const y0 = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const x1 = rect ? Math.min(w, Math.round(rect.x + rect.w)) : w;
  const y1 = rect ? Math.min(h, Math.round(rect.y + rect.h)) : h;
  let n = 0, sum = 0, sumSq = 0, nonBlack = 0, bright = 0, nearBlack = 0, hot = 0, mx = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const l = lumaAt(img, x, y);
      sum += l; sumSq += l * l; n++;
      if (l > 12) nonBlack++;
      if (l > 128) bright++;
      if (l < NEAR_BLACK) nearBlack++;
      if (l > HOT) hot++;
      if (l > mx) mx = l;
    }
  }
  if (!n) return { width: w, height: h, samples: 0, mean: 0, stdev: 0,
                   nonBlack: 0, bright: 0, nearBlack: 0, hot: 0, max: 0 };
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { width: w, height: h, samples: n,
           mean: +mean.toFixed(2), stdev: +Math.sqrt(variance).toFixed(2),
           nonBlack: +(nonBlack / n).toFixed(4), bright: +(bright / n).toFixed(4),
           nearBlack: +(nearBlack / n).toFixed(4), hot: +(hot / n).toFixed(4),
           max: +mx.toFixed(1) };
}

/**
 * Mean luma over small discs centred on a list of page-pixel points — the
 * round-3 surface-value probe ([R3-2] apron vs room floor). The app hands
 * over the points (it projects named WORLD samples through the same inset
 * rectangle the shot was taken with), so this measures the surface asked
 * for and not a rectangle that happens to sit near it.
 */
export function pointsStats(img, pts, r = 3) {
  const { width: w, height: h } = img;
  let n = 0, sum = 0, sumSq = 0, used = 0, hot = 0, mx = 0;
  for (const p of pts || []) {
    if (!p || p.onFrame === false) continue;
    const cx = Math.round(p.x), cy = Math.round(p.y);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    used++;
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        const l = lumaAt(img, x, y);
        sum += l; sumSq += l * l; n++;
        if (l > HOT) hot++;
        if (l > mx) mx = l;
      }
    }
  }
  if (!n) return { points: 0, samples: 0, mean: null, stdev: null, hot: null, max: null };
  const mean = sum / n;
  return { points: used, samples: n, mean: +mean.toFixed(2),
           stdev: +Math.sqrt(Math.max(0, sumSq / n - mean * mean)).toFixed(2),
           hot: +(hot / n).toFixed(4), max: +mx.toFixed(1) };
}

/** Decode once; measure a rect and a point set in the same pass. */
export function probeStats(buf, { rect = null, points = null, step = 2, r = 3 } = {}) {
  const img = decodePng(buf);
  return { rect: rect ? statsOf(img, step, rect) : null,
           points: points ? pointsStats(img, points, r) : null };
}

/** Decode + measure in one call (whole frame, or `rect` if given). */
export function imageStats(buf, step = 4, rect = null) {
  return statsOf(decodePng(buf), step, rect);
}

/**
 * ROUND-3 [R4-3]/[R4-4]: the exact number of CLIPPED pixels in a window —
 * every pixel over luma HOT, counted at step 1 rather than sampled. The
 * subsampled `hot` fraction is enough to spot a blown surface; this is what a
 * "nothing in this frame clips" claim has to be measured with, and it is cheap
 * because it only runs on the frames that make the claim.
 */
export function hotPixels(img, rect = null) {
  const { width: w, height: h } = img;
  const x0 = rect ? Math.max(0, Math.round(rect.x)) : 0;
  const y0 = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const x1 = rect ? Math.min(w, Math.round(rect.x + rect.w)) : w;
  const y1 = rect ? Math.min(h, Math.round(rect.y + rect.h)) : h;
  let n = 0, hot = 0, mx = 0, hx0 = Infinity, hy0 = Infinity, hx1 = -1, hy1 = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const l = lumaAt(img, x, y);
      n++;
      if (l > mx) mx = l;
      if (l > HOT) {
        hot++;
        if (x < hx0) hx0 = x;
        if (y < hy0) hy0 = y;
        if (x > hx1) hx1 = x;
        if (y > hy1) hy1 = y;
      }
    }
  }
  return { pixels: n, hot, max: +mx.toFixed(1),
           box: hot ? { x: hx0, y: hy0, w: hx1 - hx0 + 1, h: hy1 - hy0 + 1 } : null };
}

/**
 * ROUND-3 [R4-2]: how many pixels of `rect` differ between two frames by more
 * than `thresh` luma. Used as a LOWER BOUND on "something moved here" — the
 * hearth flicker and the window pulse live in these rectangles too, so the
 * figure-specific evidence is the screen-space drift of the figure's own box;
 * this number is the corroborating one.
 */
export function pixelDiff(a, b, rect = null, thresh = 3, step = 1) {
  const { width: w, height: h } = a;
  if (b.width !== w || b.height !== h) throw new Error('frame size mismatch');
  const x0 = rect ? Math.max(0, Math.round(rect.x)) : 0;
  const y0 = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const x1 = rect ? Math.min(w, Math.round(rect.x + rect.w)) : w;
  const y1 = rect ? Math.min(h, Math.round(rect.y + rect.h)) : h;
  let n = 0, changed = 0, mx = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const d = Math.abs(lumaAt(a, x, y) - lumaAt(b, x, y));
      n++;
      if (d > thresh) changed++;
      if (d > mx) mx = d;
    }
  }
  return { samples: n, changed, frac: +(changed / Math.max(1, n)).toFixed(4),
           maxDelta: +mx.toFixed(1) };
}

/** Decode once, measure the whole frame AND the inset. */
export function frameStats(buf, rect = null, step = 4) {
  const img = decodePng(buf);
  const full = statsOf(img, step, null);
  return { ...full, inset: rect ? statsOf(img, step, rect) : null };
}
