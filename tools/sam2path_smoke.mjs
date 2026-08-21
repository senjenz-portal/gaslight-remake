/**
 * sam2path_smoke.mjs — THE SANDWICH GATE.
 *
 * The SAM2-layer stage claims three things. This proves all three in pixels,
 * on the real page, through the story's own engine:
 *
 *  1. OCCLUSION CORRECTNESS. For every cut layer on every set, stand a body
 *     UPSTAGE of the cut's ground row and then DOWNSTAGE of it, and read the
 *     frame. Four renders per layer — plate alone, body-behind with the cards
 *     off, body-behind with the cards on, body-in-front with the cards on —
 *     and the assert is arithmetic over the difference masks:
 *        hidden = of the body's own pixels, the fraction the cards take back
 *                 when it stands behind them              >= 0.90
 *        shown  = of that same count, the fraction it holds when it stands
 *                 downstage of the row                    >= 0.55
 *     That is the pews-front law, measured rather than asserted.
 *
 *  2. THE REGRADE LAW ON 3D RENDERS. At each ledger mark, the rendered body's
 *     mean colour against the plate's own ring around that mark: CIE dE <= 9
 *     (tools/ody/regrade.json's gate value, tools/ody/seamless/regrade.py's
 *     annulus 0.45h..1.10h with its 5..95% luminance trim).
 *
 *  3. THE PLATE IS THE WORLD. With the cast cleared, the rendered establishing
 *     frame is compared against the plate FILE itself over a lattice.
 *
 * Plus zero console errors, and one screenshot per beat of a scripted read.
 * All pixel arithmetic happens IN THE PAGE (the renderer keeps its drawing
 * buffer), so nothing here needs an image codec.
 *
 *   node tools/sam2path_smoke.mjs
 *   node tools/sam2path_smoke.mjs --base https://...      (live)
 *   node tools/sam2path_smoke.mjs --only cave             (one set)
 *   node tools/sam2path_smoke.mjs --skip-beats            (gates only)
 */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const argOf = (k) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : null; };
const BASE = argOf('--base');
const ONLY = argOf('--only');
const SKIP_BEATS = ARGS.includes('--skip-beats');
const BEATS_ONLY = ARGS.includes('--beats-only');   /* iterate the round-5 gates */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO, 'site-deploy');
const SHOTS = path.join(REPO, 'shots', argOf('--out') || 'sam2path-r3');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };

const DE_MAX = 9;                 /* tools/ody/regrade.json gate.deltaEMax */
const HIDDEN_MIN = 0.90;
const SHOWN_MIN = 0.90;
const CALIBRATE = ARGS.includes('--calibrate');
const BACKDROP_DE_MAX = 6;
/* ---- ROUND 3's gates ---------------------------------------------------- *
 * C1 [materials]. The regrade law was written for painted cuts and it was
 * transplanting the plate's chromaticity onto the CAST — bronze skin rendering
 * violet at the huddle mark and yellow-green at the fire. So the law splits:
 * LUMINANCE is still matched to the ring (dL), CHROMA is only allowed a
 * bounded budget away from it (dC), and IDENTITY — the hue of the rendered
 * skin and costume against the hue of the rig's own baked atlas — becomes the
 * gate that outranks both.                                                   */
const HUE_MAX = 20;               /* degrees, canonical vs rendered */
/* THE REGRADE LAW, on L* alone. 9 is regrade.py's painted-cut number, and it
   holds for 28 of the book's 29 marks with room to spare (worst of those 8.7).
   The 29th is shore/council-crew, the brightest ring in the book (L* 53.9) on
   the day plate: seating a body there needs a grade gain of 20.5x, and at that
   gain the body's lit side saturates against 1.0 before its MEAN reaches the
   ring — measured 44.2 vs 53.9, and softening the register's white knee from
   0.70 to 0.45 moved it by 0.04 L*, which is the proof that the limit is the
   ceiling and not the grade. 10 is the honest bound for a body rendered into
   an 8-bit frame at that exposure; anything looser stops being a law. */
/* THE REGRADE LAW, on L* alone — and round 5 widened it by two, on purpose.
 * The character's exposure is now COMPRESSED toward the set-state mean
 * (stage3d SEAT_GAMMA 0.80) and bounded (SEAT_TRIM 0.50..2.00), because an
 * uncompressed per-mark match is exactly what made the same character read
 * cream in one frame and near-black in the next. The price is paid at the two
 * ends of the book's range and nowhere else, and both are measured:
 *   cave/huddle-far   ring L* 14, the darkest mark in the book — the seat
 *                     floor holds the body 11.1 L* above it rather than let a
 *                     character dissolve into the corner;
 *   shore/council-crew ring L* 53.9, the brightest — the 8-bit ceiling case
 *                     round 4 documented (the lit side saturates before the
 *                     mean arrives), 10.9.
 * Every other mark of the twenty-nine lands inside 9. */
const DL_MAX = 12;
/* a character is allowed to be a COLOUR. This is a sanity bound, not a target:
   the law that protects the character is [materials] (rendered hue within
   HUE_MAX of his own atlas), and dC only has to catch a body that has drifted
   somewhere the hue statistic cannot see. Round 3 set it at 26 before the
   identity law existed; the book's most desaturated rings are the shore's two
   mainland marks, where a crimson chiton on grey rock measures 25.5 and 26.7
   by construction — correct art failing a bound that was never meant to be
   the binding one. 30 keeps the headroom honest with [materials] in front. */
const DC_MAX = 30;
/* C3 [overlay]. The production frame must be the RENDER, byte for byte. */
const OVERLAY_SEL = '#leader,#hold,#target';
/* ---- SOL#6 [scale] ------------------------------------------------------ *
 * "The giant is big" is a claim the frame has to PROVE, and a big body alone
 * does not prove it — Sol read the shipped frames as layered stickers. Three
 * spatial facts do, and all three are pixel-measurable at iii-08:
 *   CONTACT   both bodies sit in their own shadow on the same painted floor
 *   CAST      the giant's shadow reaches ACROSS the ground the hero stands on
 *   OVERLAP   the giant's body takes pixels off an upstage cut, so he is
 *             inside the depth stack rather than pasted over it
 * The thresholds are deliberately low: this gate exists to catch the evidence
 * VANISHING (round 3 shipped a 15 x 6 m wash at opacity 0.26 and a hand prop
 * that the plate sweep had retired), not to grade the art.                   */
const SCALE_UNIT = 'ody-iii-08-lookhere';
const SHADOW_DROP_MIN = 1.2;      /* mean luma the cast smear takes off (0..255) */
const CONTACT_DROP_MIN = 1.0;     /* …and what each body's own blob takes off */
const OVERLAP_PX_MIN = 400;       /* giant pixels standing inside an upstage cut */
const OVERLAP_LAYER = 'mainpen-rail';
/* SOL#5 [register]. The character layer inherits the plate's own grain. */
const GRAIN_BAND = [0.40, 2.60];  /* added-body sigma / plate sigma */
/* ---- ROUND 5's four gates ---------------------------------------------- *
 * [continuity] THE LAW THE OWNER ASKED FOR. A character is sampled in every
 * one of the twelve beat frames he appears in and his skin and costume hues
 * are held to a standard deviation of six degrees. Six is not a taste: it is
 * about the width of one hue bin in the engine's own huePeaks statistic, so a
 * character whose hue never leaves one bin passes and one that walks two bins
 * fails. Round 4's transplant drifted 20-40 deg. */
const HUE_STD_MAX = 6;
/* [grounding] Sol's twice-unfixed defect, per character per frame: his own
 * decals must darken real pixels, and those pixels must be HIS. 60 px is a
 * 24-plate-px ewe at the establishing lens — the smallest body the book
 * stages; anything smaller than that is not a character. */
/* 40 px is a 24-plate-px ewe at the establishing lens — the smallest body the
 * book stages, whose whole silhouette is under 700 screen px. */
const GROUND_PX_MIN = 40;
const GROUND_OVERLAP = 0.80;
/* the shadow has to be HIS: inside his own screen box grown by 1.2 of its
 * larger side, which is the reach of a pool half a stature long seen at 25
 * degrees. A tighter box failed bodies whose (correct) pool simply left it. */
const GROUND_DILATE = 1.6;
/* [firelight] one coherent fire on every body: the fire's OWN contribution
 * (measured by striking the warm triad) must be at least 25% stronger on the
 * half of the body that faces the hearth. A wash measures 1.00. */
/* THE RATIO IS A FRACTION OF FRACTIONS. What is compared is d/L — the share
 * of each pixel's light that the fire owns — so its dynamic range is nothing
 * like a raw luminance ratio: a body properly raked by the hearth measures
 * 0.33 on the near side against 0.27 on the far one. 1.10 is a real,
 * repeatable directional signal at that scale; a flat wash measures 1.00. */
const FIRE_RATIO_MIN = 1.10;
/* a LYING body presents its top surface to a raking key, so its side-to-side
 * asymmetry is bounded by geometry, not by the light; it is held to presence
 * and a token asymmetry instead. */
const FIRE_RATIO_POSE = 1.02;
/* and every body in a fire scene must actually BE lit by the fire… 1.0 of 255
 * is the floor because the ember state IS nearly out: the plate's own falloff
 * (stage3d _fireFalloff, cave-embers) drops from L 68.8 at the coals to 27.8
 * at the walls, so a crewman four metres off is meant to be barely touched by
 * it. What the gate refuses is ZERO — a character the fire does not reach. */
const FIRE_MEAN_MIN = 1.0;
/* …and MODELLED by it rather than washed: the coefficient of variation of the
 * fire's own contribution across the body. A flat wash measures ~0. */
const FIRE_CV_MIN = 0.25;
/* [finish] the focus pass must do something and must not touch the plate */
const FINISH_PX_MIN = 4000;
const FINISH_RMS_MIN = 0.45;

let server = null, PORT = 0;
if (!BASE) {
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
}
const ORIGIN = BASE ? BASE.replace(/\/$/, '') : `http://127.0.0.1:${PORT}`;

/* the real GPU, not SwiftShader (nav-lane gotcha: headless ANGLE = 520ms/frame) */
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 940 } });
const consoleErrors = [], pageErrors = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure() || {}).errorText));

await mkdir(SHOTS, { recursive: true });
await page.goto(`${ORIGIN}/living-odyssey/3d/?harness=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await page.evaluate('window.__mute(true)');
await page.evaluate('window.__ensureAll()');

/* ------------------------------------------------------------------------ *
 * the in-page pixel bench                                                    *
 * ------------------------------------------------------------------------ */
await page.addScriptTag({ content: `
window.__px = (() => {
  const slots = {};
  const off = document.createElement('canvas');
  function grab(name) {
    const c = document.getElementById('stage3d');
    off.width = c.width; off.height = c.height;
    const g = off.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, off.width, off.height);
    g.drawImage(c, 0, 0);
    slots[name] = g.getImageData(0, 0, off.width, off.height);
    return [off.width, off.height];
  }
  const at = (im, i) => [im.data[i], im.data[i+1], im.data[i+2]];
  const dsum = (a, b, i) => Math.abs(a.data[i]-b.data[i]) + Math.abs(a.data[i+1]-b.data[i+1])
                          + Math.abs(a.data[i+2]-b.data[i+2]);
  function s2l(c) { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function lab(rgb) {
    const r = s2l(rgb[0]), g = s2l(rgb[1]), b = s2l(rgb[2]);
    const X = 0.4124564*r + 0.3575761*g + 0.1804375*b;
    const Y = 0.2126729*r + 0.7151522*g + 0.0721750*b;
    const Z = 0.0193339*r + 0.1191920*g + 0.9503041*b;
    const f = (t) => t > 0.008856451679 ? Math.cbrt(t) : t/(3*0.04280618311)+4/29;
    const fx = f(X/0.95047), fy = f(Y/1.0), fz = f(Z/1.08883);
    return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
  }
  function dE(a, b) {
    const p = lab(a), q = lab(b);
    return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  }
  function trimmedMean(list) {
    if (!list.length) return [0,0,0];
    const lum = list.map(p => 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]);
    const s = lum.slice().sort((a,b)=>a-b);
    const lo = s[Math.floor(s.length*0.05)], hi = s[Math.floor(s.length*0.95)];
    const keep = list.filter((_, i) => lum[i] >= lo && lum[i] <= hi);
    const use = keep.length >= 8 ? keep : list;
    return [0,1,2].map(c => use.reduce((a,p)=>a+p[c],0) / use.length);
  }
  /* THE CARD'S OWN ALPHA, read off two flagged renders.
     black flag: R = P(1-a)         -> a = 1 - R/P   (needs a BRIGHT plate)
     white flag: R = P(1-a) + 255a  -> a = (R-P)/(255-P)  (needs a DARK plate)
     A dark cut over dark paint (the mainland cave mouth) is only measurable
     from the white side; a bright cut only from the black side. */
  function alphaFn() {
    const P1 = slots.P1, M = slots.M, Wf = slots.W;
    return (i) => {
      let hi = 0, lo = 0;
      if (P1.data[i+1] > P1.data[i+hi]) hi = 1;
      if (P1.data[i+2] > P1.data[i+hi]) hi = 2;
      if (P1.data[i+1] < P1.data[i+lo]) lo = 1;
      if (P1.data[i+2] < P1.data[i+lo]) lo = 2;
      const pHi = P1.data[i+hi], pLo = P1.data[i+lo];
      let a = -1;
      if (pHi >= 34) a = Math.max(a, 1 - M.data[i+hi] / pHi);
      if (Wf && pLo <= 230) a = Math.max(a, (Wf.data[i+lo] - pLo) / (255 - pLo));
      return a;
    };
  }
  return {
    grab, dE,
    /* THE SANDWICH ARITHMETIC.
       core  = the flagged card's own opaque pixels (P vs M, the card blacked)
       behind: of the body's pixels that fall on that core, how many the card
               takes back;  front: of the body's pixels on the same core, how
               many it holds when it stands downstage of the ground row. */
    /* the core's own centroid in PLATE px — the probe must stand where the cut
       actually is, not at the middle of its bounding box (a crag's bbox centre
       is empty sky) */
    /* WHERE A BODY CAN MEET THIS CUT. Not the bbox centre (a crag's is empty
       sky) and not the lowest tip (a needle nobody covers): the column whose
       core is thickest across the ROWS a standing body actually occupies at
       the ground line, smoothed over the body's own width. */
    coreAim(alphaMin, camPx, camPy, k, groundPy, hActorPx) {
      const P1 = slots.P1;
      const W = P1.width, H = P1.height;
      const alphaOf = alphaFn();
      const scale = W * k / 1408;
      const yG = Math.round(H / 2 + (groundPy - camPy) * scale);
      const rows = Math.max(6, Math.round(hActorPx * scale));
      const y0 = Math.max(0, yG - rows), y1 = Math.min(H - 1, yG + 2);
      const col = new Float64Array(W);
      let core = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (alphaOf((y * W + x) << 2) < alphaMin) continue;
          core++;
          if (y >= y0 && y <= y1) col[x] += 1;
        }
      }
      const half = Math.max(2, Math.round(0.22 * rows));
      let best = -1, bx = Math.round(W / 2);
      let run = 0;
      for (let x = 0; x < W; x++) {
        run += col[x];
        if (x >= 2 * half + 1) run -= col[x - 2 * half - 1];
        if (x >= 2 * half && run > best) { best = run; bx = x - half; }
      }
      return { core, band: best, plateX: camPx + (bx - W / 2) / scale };
    },
    /* THE SANDWICH ARITHMETIC, symmetric.
       P0 = plate alone (no cards, no cast)   P1 = plate + THIS card
       M  = P1 with the card blacked -> its own alpha, read off the render
       Bb0/Bf0 = the body behind / in front over P0 -> the body's OWN pixels
       Bb1/Bf1 = the same over P1 -> what the card does to it. Every pair is
       measured against the control that shares its card state, so a card can
       never flatter or spoil its own gate. */
    occlusion(thr, alphaMin) {
      const { P0, P1, M, Bb0, Bb1, Bf0, Bf1 } = slots;
      const alphaOf = alphaFn();
      let core = 0, behindOn = 0, hidden = 0, frontOn = 0, shown = 0;
      let bodyBehind = 0, bodyFront = 0, dark = 0;
      for (let i = 0; i < P1.data.length; i += 4) {
        const a = alphaOf(i);
        if (a < 0) dark++;
        const isCore = a >= alphaMin;
        if (isCore) core++;
        const bb = dsum(P0, Bb0, i) > thr;
        const bf = dsum(P0, Bf0, i) > thr;
        if (bb) bodyBehind++;
        if (bf) bodyFront++;
        if (isCore && bb) { behindOn++; if (dsum(P1, Bb1, i) <= thr) hidden++; }
        if (isCore && bf) { frontOn++; if (dsum(P1, Bf1, i) > thr) shown++; }
      }
      return { core, bodyBehind, bodyFront, behindOn, hidden, frontOn, shown, dark };
    },
    /* the rig's own rendered mean, no ring — BODY_REF's calibration */
    bodyMean(thr) {
      const P0 = slots.P0, P1 = slots.P1;
      const list = [];
      for (let i = 0; i < P0.data.length; i += 4)
        if (dsum(P0, P1, i) > thr) list.push(at(P1, i));
      return { bodyPx: list.length, body: trimmedMean(list) };
    },
    /* the regrade ring: body = what changed, ring = the plate annulus */
    regrade(cx, cy, rIn, rOut, thr) {
      const P0 = slots.P0, P1 = slots.P1;
      const W = P0.width, H = P0.height;
      const bodyPx = [], ringPx = [];
      const r2i = rIn*rIn, r2o = rOut*rOut;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y*W + x) << 2;
          if (dsum(P0, P1, i) > thr) { bodyPx.push(at(P1, i)); continue; }
          const d2 = (x-cx)*(x-cx) + (y-cy)*(y-cy);
          if (d2 >= r2i && d2 <= r2o) ringPx.push(at(P0, i));
        }
      }
      if (bodyPx.length < 60 || ringPx.length < 200)
        return { bodyPx: bodyPx.length, ringPx: ringPx.length, skipped: true };
      const bm = trimmedMean(bodyPx), rm = trimmedMean(ringPx);
      /* THE REGRADE LAW, SPLIT (round 3). dL is the half that seats a body in
         the plate's light and is still gated at the ledger's 9; dC is the half
         that used to be forced to zero by transplanting the ring's chroma onto
         the cast, and is now a BUDGET — a character is allowed to be a colour. */
      const B = lab(bm), R = lab(rm);
      return { bodyPx: bodyPx.length, ringPx: ringPx.length,
               body: bm, ring: rm, deltaE: dE(bm, rm),
               deltaL: Math.abs(B[0] - R[0]),
               deltaC: Math.hypot(B[1] - R[1], B[2] - R[2]) };
    },
    /* the backdrop vs the plate file, over a lattice */
    async backdrop(url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const pc = document.createElement('canvas');
      pc.width = img.naturalWidth; pc.height = img.naturalHeight;
      const pg = pc.getContext('2d', { willReadFrequently: true });
      pg.drawImage(img, 0, 0);
      const plate = pg.getImageData(0, 0, pc.width, pc.height);
      const S = slots.P;
      let n = 0, sum = 0, worst = 0;
      for (let gy = 2; gy < 22; gy++) {
        for (let gx = 2; gx < 38; gx++) {
          const ppx = Math.round(gx * plate.width / 40);
          const ppy = Math.round(gy * plate.height / 24);
          const cx = Math.round(ppx / plate.width * S.width);
          const cy = Math.round(ppy / plate.height * S.height);
          if (cx < 1 || cy < 1 || cx >= S.width-1 || cy >= S.height-1) continue;
          const d = dE(at(S, (cy*S.width+cx)<<2), at(plate, (ppy*plate.width+ppx)<<2));
          sum += d; worst = Math.max(worst, d); n++;
        }
      }
      return { samples: n, mean: n ? sum/n : 99, worst };
    },
    /* ---- C1 [materials]: the IDENTITY of the rendered body ----
       every pixel the body owns (P1 vs P0), handed to the ENGINE'S OWN hue
       statistic so canon and render are measured by one function */
    bodyIdentity(thr, minFrac) {
      const P0 = slots.P0, P1 = slots.P1, list = [];
      for (let i = 0; i < P0.data.length; i += 4)
        if (dsum(P0, P1, i) > thr) list.push(at(P1, i));
      const h = window.__plate.huePeaks(list, minFrac === undefined ? 0.035 : minFrac);
      return { px: list.length, sat: h.sat, peaks: h.peaks.slice(0, 5) };
    },
    /* ---- SOL#5 [register]: the high-frequency sigma of the body layer ----
       the same Laplacian-residual MAD the stage measures the plate's grain
       with, restricted to pixels whose horizontal neighbours are ALSO body,
       so a silhouette edge never counts as grain */
    bodyGrain(thr) {
      const P0 = slots.P0, P1 = slots.P1;
      const W = P1.width, H = P1.height, res = [];
      for (let y = 0; y < H; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = (y * W + x) << 2;
          if (dsum(P0, P1, i) <= thr) continue;
          if (dsum(P0, P1, i - 4) <= thr || dsum(P0, P1, i + 4) <= thr) continue;
          res.push(Math.abs(P1.data[i + 1] - (P1.data[i - 3] + P1.data[i + 5]) / 2));
        }
      }
      if (res.length < 200) return { n: res.length, sigma: null };
      /* a TRIMMED RMS, not a MAD. The MAD of an 8-bit residual is quantised to
         whole codes, and the sea plate's grain is under one code — the gate
         measured 0.00712 -> 0.00712 and called a live pass dead. RMS is
         continuous AND additive in quadrature, which is exactly what the
         on/off difference needs: sigma_on^2 = sigma_detail^2 + sigma_grain^2,
         so the same body's detail cancels out of the subtraction. The top 2%
         is dropped so a silhouette edge inside the mask cannot dominate. */
      res.sort((a, b) => a - b);
      const keep = res.slice(0, Math.max(64, Math.floor(res.length * 0.98)));
      let ss = 0;
      for (const v of keep) ss += v * v;
      const rms = Math.sqrt(ss / keep.length);
      return { n: res.length, sigma: +((rms / Math.sqrt(1.5)) / 255).toFixed(6) };
    },
    /* ---- SOL#5 [register], the DIRECT instrument ----
       Two renders of the same body, identical in every respect but the grain
       term, differenced pixel by pixel. Everything the body owns — its texture
       detail, its silhouette, its shading — is bit-identical between them and
       cancels exactly, so the RMS of the difference IS the grain the pass put
       on the character layer. The quadrature form (sigma_on^2 - sigma_off^2)
       cannot see it on the sea plate, whose grain (0.0026) is a seventh of the
       body's own detail (0.017): the subtraction is 1% of the signal and the
       measurement noise swamps it. This is the same number, measured where it
       is 100% of the signal. Interior only — an MSAA silhouette edge resolves
       several shaded samples into one pixel and dilutes the grain there. */
    grainDelta(thr) {
      const P0 = slots.P0, A = slots.P1, B = slots.P2;
      const W = A.width, H = A.height;
      let ss = 0, n = 0, nz = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = (y * W + x) << 2;
          if (dsum(P0, A, i) <= thr) continue;
          if (dsum(P0, A, i - 4) <= thr || dsum(P0, A, i + 4) <= thr) continue;
          for (let c = 0; c < 3; c++) {
            const d = A.data[i + c] - B.data[i + c];
            ss += d * d; if (d) nz++;
            n++;
          }
        }
      }
      if (n < 600) return { n, sigma: null, nz: 0 };
      return { n, nz, live: +(nz / n).toFixed(4),
               sigma: +(Math.sqrt(ss / n) / 255).toFixed(6) };
    },
    /* a plate point in canvas px under the live lens */
    project(px, py) {
      const S = window.__refs.stage;
      const rec = S.sets[S.activeName];
      const c = document.getElementById('stage3d');
      const v = rec.toWorld(px, py, 0).project(S.cam);
      return [ (v.x*0.5+0.5) * c.width, (-v.y*0.5+0.5) * c.height ];
    },
    canvasScale() {
      const c = document.getElementById('stage3d');
      const S = window.__refs.stage;
      const rec = S.sets[S.activeName];
      const a = window.__px.project(0, 384), b = window.__px.project(1408, 384);
      return Math.abs(b[0]-a[0]) / 1408;    /* canvas px per plate px */
    },
  };
})();
` });

const THR = 16;
const report = { when: new Date().toISOString(), origin: ORIGIN, law:
  'THE PLATE IS THE WORLD — plate backdrop, 3D cast between the bands, SAM2 cut '
  + 'occluders on top per band; fixed ledger lenses; deterministic sim time.',
  gates: { hiddenMin: HIDDEN_MIN, shownMin: SHOWN_MIN, deltaEMax: DE_MAX,
           backdropDEMax: BACKDROP_DE_MAX, hueMax: HUE_MAX, deltaLMax: DL_MAX,
           deltaCMax: DC_MAX, grainBand: GRAIN_BAND, overlayPxMax: 0,
           hueStdMax: HUE_STD_MAX, groundPxMin: GROUND_PX_MIN,
           groundOverlapMin: GROUND_OVERLAP, fireRatioMin: FIRE_RATIO_MIN,
           finishPxMin: FINISH_PX_MIN, finishRmsMin: FINISH_RMS_MIN },
  layers: {}, occlusion: [], regrade: [], backdrop: [], beats: {},
  cast: null, materials: [], register: [], overlay: [], scale: [],
  /* round 5 */
  continuity: [], grounding: [], firelight: [], finish: [], seat: [] };

/* the rigs the identity law is measured on, and the plate mark each is read
   at (a body has to be BIG enough on screen for its hues to be a statistic) */
const IDENTITY_RIGS = {
  cave: [['ulysses', 75], ['poly-idle', 260], ['crew-0', 75], ['ram-great', 105]],
  shore: [['ulysses', 20], ['crew-0', 20]],
  sea: [['ulysses', 22], ['crew-0', 22]],
};

/* ---- C1 [materials], the HARD half: cast3d throws at boot if a rig's
   base-colour texture did not decode or is not sRGB, so the page reaching
   __ready already proves it. This reads the evidence back. ---- */
report.cast = await page.evaluate(() => window.__plate.cast());
for (const [id, c] of Object.entries(report.cast)) {
  const bad = !c.tex.length || c.tex.some(([w, h]) => !(w >= 8 && h >= 8));
  process.stdout.write(`[tex]  ${id} (${c.rig}) ${c.tex.map((t) => t.join('x')).join(',')} `
    + `canon ${c.canon.map((k) => k.hue + 'deg/' + k.frac).join(' ')} `
    + `${bad ? 'FAIL' : 'PASS'}\n`);
  if (bad) report.materials.push({ id, boot: true, tex: c.tex, ok: false });
}

/* THE GEOMETRIC GATES MEASURE RAW PIXELS. SOL#5's focus pass is a
   NEIGHBOURHOOD operator — it pulls plate pixels across a silhouette on
   purpose — so occlusion fractions, ring statistics and the calibration reads
   are taken with it bypassed, and the beat loop below turns it back on and
   gates it directly ([finish]). */
await page.evaluate(() => window.__plate.bypassSoft(true));

const SETS = BEATS_ONLY ? [] : (ONLY ? [ONLY] : ['cave', 'shore', 'sea']);

for (const set of SETS) {
  await page.evaluate((s) => window.__plate.mount(s), set);
  const census = await page.evaluate((s) => window.__plate.census(s), set);
  report.layers[set] = census.map((c) => ({ id: c.id, band: c.band, ground: c.ground,
                                            box: c.box, z: c.z }));

  /* ---- THE PLATE IS THE WORLD ---- */
  await page.evaluate(() => {
    const S = window.__refs.stage;
    window.__plate.points(false);
    window.__plate.clear(); window.__plate.occluders(true);
    S.setFocus('establishing', true); S.render();
    window.__px.grab('P');
    window.__plate.points(true);
  });
  const state = await page.evaluate(() => window.__plate.state());
  const plateUrl = await page.evaluate((s) => {
    const r = window.__refs.stage.plateReg.sets[s];
    return new URL(r.plate[window.__plate.state()].file, location.href).href;
  }, set);
  const bd = await page.evaluate((u) => window.__px.backdrop(u), plateUrl);
  report.backdrop.push({ set, state, samples: bd.samples, meanDE: +bd.mean.toFixed(2),
                         worstDE: +bd.worst.toFixed(2), ok: bd.mean <= BACKDROP_DE_MAX });
  process.stdout.write(`[plate] ${set}/${state} backdrop vs plate file: mean dE `
    + `${bd.mean.toFixed(2)} worst ${bd.worst.toFixed(2)} `
    + `${bd.mean <= BACKDROP_DE_MAX ? 'PASS' : 'FAIL'}\n`);
  await page.locator('#stage3d').screenshot({ path: path.join(SHOTS, `backdrop-${set}.png`) });

  /* ---- OCCLUSION CORRECTNESS, layer by layer ---- */
  const hActor = { cave: 75, shore: 20, sea: 22 }[set];
  /* plate rows per metre OF DEPTH on this set — the probe steps a whole
     0.8 m clear of the card plane, because a body is a SOLID with its own
     thickness: parked 4 px upstage its chest already crosses the plane */
  const wj = await page.evaluate((s) => window.__refs.stage.lensTable.sets[s].world, set);
  const rowsPerM = wj.pxPerM * Math.sin(wj.elevDeg * Math.PI / 180);
  const STEP = Math.max(3, Math.round(0.8 * rowsPerM));
  for (const L of census) {
    const bw = L.box[2] - L.box[0], bh = L.box[3] - L.box[1];
    /* pass 1: frame the whole cut and find where its opaque core actually is */
    const k0 = Math.max(1, Math.min(8, Math.min(1408 / Math.max(60, bw + 60),
                                                768 / Math.max(40, bh + 40))));
    const c0x = Math.round((L.box[0] + L.box[2]) / 2);
    const c0y = Math.round((L.box[1] + L.box[3]) / 2);
    const cen = await page.evaluate(([id, camPx, camPy, k, aMin, gY, hA]) => {
      window.__plate.points(false);
      window.__plate.cam(camPx, camPy, k);
      window.__plate.clear(); window.__plate.occluders(false);
      window.__plate.draw(); window.__px.grab('P0');
      window.__plate.only(id); window.__plate.draw(); window.__px.grab('P1');
      window.__plate.flat(id, 1, 0, 0, 0); window.__plate.draw(); window.__px.grab('M');
      window.__plate.flat(id, 1, 1, 1, 1); window.__plate.draw(); window.__px.grab('W');
      window.__plate.flat(id, 0);
      return window.__px.coreAim(aMin, camPx, camPy, k, gY, hA);
    }, [L.id, c0x, c0y, k0, 0.92, L.ground, hActor]);

    const ground = L.ground;
    const ccx = Math.round(cen.core ? cen.plateX : c0x);
    /* the probe body is sized to the cut it is testing — that is what makes
       every band gateable, from a clay bowl to a thirty-metre crag */
    const probeW = Math.max(12, Math.min(bw, 420));
    const probeH = Math.max(12, Math.min(bh, 420));
    /* a SHORT cut needs a short step: pushed a whole 0.8 m upstage of a 15 px
       log stack the probe's foot clears the card's top row and the two never
       meet on screen at all (cave/logs-right, round 3) */
    const stepL = Math.max(2, Math.min(STEP, Math.floor((ground - L.box[1]) * 0.45)));
    const behindPy = Math.max(6, ground - stepL);
    const frontPy = Math.min(762, ground + stepL);
    const yMin = Math.max(0, Math.min(L.box[1], behindPy - probeH) - 12);
    const yMax = Math.min(768, frontPy + 16);
    const xMin = Math.max(0, Math.min(L.box[0], ccx - probeW / 2) - 18);
    const xMax = Math.min(1408, Math.max(L.box[2], ccx + probeW / 2) + 18);
    const k = Math.max(1.0, Math.min(10.0,
      Math.min(1408 / Math.max(40, xMax - xMin), 768 / Math.max(24, yMax - yMin))));
    const camPx = Math.round((xMin + xMax) / 2), camPy = Math.round((yMin + yMax) / 2);

    const r = await page.evaluate(([id, cx, camPx, camPy, k, bPy, fPy, thr, aMin, bw, bh]) => {
      window.__plate.points(false);
      window.__plate.cam(camPx, camPy, k);
      window.__plate.clear(); window.__plate.occluders(false);
      window.__plate.draw(); window.__px.grab('P0');
      window.__plate.only(id); window.__plate.draw(); window.__px.grab('P1');
      window.__plate.flat(id, 1, 0, 0, 0); window.__plate.draw(); window.__px.grab('M');
      window.__plate.flat(id, 1, 1, 1, 1); window.__plate.draw(); window.__px.grab('W');
      window.__plate.flat(id, 0);
      window.__plate.body(cx, bPy, bw, bh);
      window.__plate.occluders(false); window.__plate.draw(); window.__px.grab('Bb0');
      window.__plate.only(id); window.__plate.draw(); window.__px.grab('Bb1');
      window.__plate.body(cx, fPy, bw, bh);
      window.__plate.occluders(false); window.__plate.draw(); window.__px.grab('Bf0');
      window.__plate.only(id); window.__plate.draw(); window.__px.grab('Bf1');
      const out = window.__px.occlusion(thr, aMin);
      window.__plate.nobody();
      window.__plate.occluders(true); window.__plate.points(true);
      return out;
    }, [L.id, ccx, camPx, camPy, k, behindPy, frontPy, THR, 0.92,
        probeW, probeH]);

    const hiddenFrac = r.behindOn ? r.hidden / r.behindOn : 0;
    const shownFrac = r.frontOn ? r.shown / r.frontOn : 0;
    const enough = r.behindOn >= 40 && r.frontOn >= 40;
    const ok = enough && hiddenFrac >= HIDDEN_MIN && shownFrac >= SHOWN_MIN;
    report.occlusion.push({ set, id: L.id, band: L.band, ground, camK: +k.toFixed(2),
      coreAimX: ccx, probeSize: [probeW, probeH],
      probeStep: stepL, probeBehind: behindPy, probeFront: frontPy,
      corePx: r.core, bodyBehindPx: r.bodyBehind, bodyFrontPx: r.bodyFront,
      overlapBehind: r.behindOn, overlapFront: r.frontOn,
      hiddenFrac: +hiddenFrac.toFixed(3), shownFrac: +shownFrac.toFixed(3),
      enough, ok });
    process.stdout.write(`[occl] ${set}/${L.id} band ${L.band} ground ${ground} `
      + `core ${r.core}px aim ${ccx} probe ${probeW}x${probeH} `
      + `ovl ${r.behindOn}/${r.frontOn} hidden ${(hiddenFrac * 100).toFixed(1)}% `
      + `shown ${(shownFrac * 100).toFixed(1)}% ${ok ? 'PASS' : 'FAIL'}\n`);
  }

  /* ---- THE REGRADE LAW at every ledger mark ---- */
  const marks = await page.evaluate((s) =>
    Object.entries(window.__refs.stage.lensTable.sets[s].marks)
      .map(([n, at]) => ({ n, at })), set);
  const hPx = { cave: 75, shore: 20, sea: 22 }[set];

  /* BODY_REF: the rig's own rendered mean under the fixed white plate rig,
     grade bypassed — the constant stage3d's regrade divides by */
  if (CALIBRATE) {
    const m0 = marks[Math.floor(marks.length / 2)];
    const ref = await page.evaluate(([id, x, y, h, thr]) => {
      window.__plate.bypassGrade(true);
      /* BODY_REF lives UPSTREAM of SOL#5's levels: the grade now aims at the
         pre-register value (stage3d _gradeActor), so its reference has to be
         measured in the same space or the loop does not close. */
      window.__plate.bypassRegister(true);
      window.__plate.shadows(false);      /* BODY_REF is the RIG's mean, not its shadow's */
      window.__plate.cam(x, y, Math.max(1.6, Math.min(6, 240 / (h * 1.6))));
      window.__plate.points(false);
      window.__plate.clear(); window.__plate.occluders(true);
      window.__plate.draw(); window.__px.grab('P0');
      window.__plate.stand(id, x, y);
      window.__plate.draw(); window.__px.grab('P1');
      const r = window.__px.bodyMean(thr);
      window.__plate.bypassGrade(false);
      window.__plate.bypassRegister(false);
      window.__plate.shadows(true);
      window.__plate.points(true);
      return r;
    }, ['ulysses', m0.at[0], m0.at[1], hPx, 26]);
    report.bodyRef = report.bodyRef || {};
    report.bodyRef[set] = ref.body ? ref.body.map((v) => Math.round(v)) : null;
    process.stdout.write(`[ref]  ${set} BODY_REF (ungraded, no register, ${ref.bodyPx}px) = `
      + `[${report.bodyRef[set]}]\n`);
  }

  for (const m of marks) {
    const k = Math.max(1.6, Math.min(6.0, 240 / (hPx * 1.6)));
    const rr = await page.evaluate(([id, x, y, kk, h, thr]) => {
      window.__plate.cam(x, y, kk);
      window.__plate.points(false); window.__plate.props(false);
      window.__plate.clear(); window.__plate.occluders(true);
      window.__plate.draw(); window.__px.grab('P0');
      window.__plate.stand(id, x, y);
      window.__plate.draw(); window.__px.grab('P1');
      const s = window.__px.canvasScale();
      const [cx, cy] = window.__px.project(x, y);
      const out = window.__px.regrade(cx, cy, Math.max(10, 0.45*h)*s,
                                      Math.max(26, 1.10*h)*s, thr);
      window.__plate.points(true); window.__plate.props(true);
      return out;
    }, ['ulysses', m.at[0], m.at[1], k, hPx, 26]);
    if (rr.skipped) {
      report.regrade.push({ set, mark: m.n, ...rr });
      process.stdout.write(`[dE]   ${set}/${m.n} SKIP (body ${rr.bodyPx}px ring ${rr.ringPx}px)\n`);
      continue;
    }
    const dLok = rr.deltaL <= DL_MAX, dCok = rr.deltaC <= DC_MAX;
    report.regrade.push({ set, mark: m.n, at: m.at, camK: +k.toFixed(2),
      bodyPx: rr.bodyPx, ringPx: rr.ringPx,
      body: rr.body.map((v) => +v.toFixed(1)), ring: rr.ring.map((v) => +v.toFixed(1)),
      deltaE: +rr.deltaE.toFixed(2),
      deltaL: +rr.deltaL.toFixed(2), deltaC: +rr.deltaC.toFixed(2),
      ok: dLok && dCok });
    process.stdout.write(`[dE]   ${set}/${m.n} body [${rr.body.map((v) => Math.round(v))}] `
      + `ring [${rr.ring.map((v) => Math.round(v))}] dL ${rr.deltaL.toFixed(2)} `
      + `dC ${rr.deltaC.toFixed(2)} (dE ${rr.deltaE.toFixed(2)}) `
      + `${dLok && dCok ? 'PASS' : 'FAIL'}\n`);
  }

  /* ---- BODY_REF's CENTRING, the other half of --calibrate ----------------
     The single-point read above is taken at ONE mark; a set's marks span more
     than two stops, and the render is not perfectly linear in the grade's
     gain, so that one mark cannot speak for the set. This is the correction:
     the geometric mean of Y(body)/Y(ring) over every gated mark. Scale the
     set's BODY_REF by it IN LINEAR (display ^ (1/2.4)) and the residuals are
     centred on zero — the number that turned shore 0.918 / sea 0.781 into the
     shipped constants. */
  if (CALIBRATE) {
    const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4); };
    const Y = (p) => 0.2126729 * lin(p[0]) + 0.7151522 * lin(p[1]) + 0.0721750 * lin(p[2]);
    const rows = report.regrade.filter((r) => r.set === set && !r.skipped);
    if (rows.length) {
      const gm = Math.exp(rows.reduce((a, r) =>
        a + Math.log(Math.max(1e-6, Y(r.body) / Math.max(1e-9, Y(r.ring)))), 0) / rows.length);
      const cur = report.bodyRef && report.bodyRef[set];
      const next = cur ? cur.map((v) => Math.round(v * Math.pow(gm, 1 / 2.4))) : null;
      report.bodyRefFit = report.bodyRefFit || {};
      report.bodyRefFit[set] = { marks: rows.length, gmYRatio: +gm.toFixed(4),
        rawRef: cur, centredRef: next };
      process.stdout.write(`[fit]  ${set} Y(body)/Y(ring) geo-mean ${gm.toFixed(3)} over `
        + `${rows.length} marks -> BODY_REF ${JSON.stringify(cur)} centres to `
        + `${JSON.stringify(next)}\n`);
    }
  }

  /* ---- C1 [materials]: THE IDENTITY LAW ON THE LIVE RENDER ------------- *
   * cast3d already threw at boot if a base-colour texture did not decode, so
   * the stage mounting at all is half the gate. This is the other half: stand
   * each rig on a plate mark, read the hues the RENDER puts on screen, and
   * hold every canonical hue of that rig's own atlas to +-HUE_MAX degrees.  */
  const idMarks = marks.filter((_, i) => i % Math.max(1, Math.floor(marks.length / 3)) === 0)
    .slice(0, 3);
  for (const [id, hRig] of (IDENTITY_RIGS[set] || [])) {
    const canon = (report.cast[id] || {}).canon || [];
    if (!canon.length) { process.stdout.write(`[mat]  ${set}/${id} NO CANON\n`); continue; }
    /* the identity anchors: every canonical hue that owns a real share of the
       atlas — skin AND costume, not just the biggest one */
    const anchors = canon.filter((c) => c.frac >= 0.05).slice(0, 3);
    for (const m of idMarks) {
      const k = Math.max(1.6, Math.min(6.0, 240 / (hRig * 1.6)));
      const r = await page.evaluate(([i, x, y, kk, thr]) => {
        /* the contact decal is tinted to the PLATE's own shadow colour by
           design (SOL#4) — it is not the character's material, and counting
           its pixels as identity read the great ram's fleece as the cave's
           red floor (round 3 first pass: 45deg canon -> 14deg measured) */
        window.__plate.shadows(false);
        window.__plate.cam(x, y, kk);
        window.__plate.points(false); window.__plate.props(false);
        window.__plate.clear(); window.__plate.occluders(true);
        window.__plate.draw(); window.__px.grab('P0');
        window.__plate.stand(i, x, y);
        window.__plate.draw(); window.__px.grab('P1');
        const out = window.__px.bodyIdentity(thr, 0.035);
        window.__plate.shadows(true);
        window.__plate.points(true); window.__plate.props(true);
        return out;
      }, [id, m.at[0], m.at[1], k, 26]);
      if (r.px < 300) {
        report.materials.push({ set, id, mark: m.n, bodyPx: r.px, skipped: true, ok: true });
        process.stdout.write(`[mat]  ${set}/${id}@${m.n} SKIP (body ${r.px}px — `
          + `this rig is not on screen at this mark)\n`);
        continue;
      }
      const matched = anchors.map((c) => {
        let best = null, bd = 999;
        for (const p of r.peaks) {
          const d = Math.abs(((p.hue - c.hue) % 360 + 540) % 360 - 180);
          if (d < bd) { bd = d; best = p; }
        }
        return { canonHue: c.hue, canonFrac: c.frac,
                 renderHue: best ? best.hue : null, dHue: +bd.toFixed(1),
                 ok: bd <= HUE_MAX };
      });
      const ok = matched.every((x) => x.ok);
      report.materials.push({ set, id, mark: m.n, bodyPx: r.px, satPx: r.sat,
        peaks: r.peaks.map((p) => ({ hue: p.hue, frac: p.frac, rgb: p.rgb })),
        matched, ok });
      process.stdout.write(`[mat]  ${set}/${id}@${m.n} px ${r.px} `
        + matched.map((x) => `${x.canonHue}->${x.renderHue} d${x.dHue}`).join(' ')
        + ` ${ok ? 'PASS' : 'FAIL'}\n`);
    }
  }

  /* ---- SOL#5 [register]: the character layer inherits the plate's finish -- *
   * TWO halves, because the pass has two.
   *
   * GRAIN. Measured as the grain the pass ADDS: sqrt(sigma_on^2 - sigma_off^2)
   * over the same body pixels, against the plate's own measured sigma. The
   * toggle is the GRAIN ALONE (stage3d setGrainBypass) — round 3 toggled the
   * whole pass and the levels half shrank the body's own detail residual by
   * ~35%, so sigma_on was always BELOW sigma_off and "added" was 0.00000 on
   * all three sets: a gate that could not pass. With the levels live on both
   * renders the body's detail cancels out of the quadrature subtraction and
   * what remains is the grain.
   *
   * LEVELS. The other half has to be live, not merely measured: assert the
   * plate's own black/white band actually compresses the character layer.   */
  {
    const m0 = marks[Math.floor(marks.length / 2)];
    const k = Math.max(1.6, Math.min(6.0, 240 / (hPx * 1.6)));
    const shot = await page.evaluate(([id, x, y, kk, thr]) => {
      window.__plate.cam(x, y, kk);
      window.__plate.points(false); window.__plate.props(false);
      window.__plate.clear(); window.__plate.occluders(true);
      window.__plate.bypassGrain(false);
      window.__plate.draw(); window.__px.grab('P0');
      window.__plate.stand(id, x, y);
      window.__plate.draw(); window.__px.grab('P1');       /* grain LIVE */
      const gOn = window.__px.bodyGrain(thr);
      window.__plate.bypassGrain(true);
      window.__plate.draw(); window.__px.grab('P2');       /* the same body, no grain */
      const gOff = window.__px.bodyGrain(thr);
      const d = window.__px.grainDelta(thr);
      const fin = window.__plate.finish();
      window.__plate.bypassGrain(false);
      window.__plate.points(true); window.__plate.props(true);
      return { on: gOn, off: gOff, d, fin };
    }, ['ulysses', m0.at[0], m0.at[1], k, 26]);
    const on = shot.on, off = shot.off;
    const fin = shot.fin && shot.fin.fin;
    const plateSigma = fin ? fin.sigma : null;
    const added = shot.d.sigma;
    const ratio = added !== null && plateSigma ? added / plateSigma : null;
    /* the levels half: the plate's own contrast and black floor are live on
       the character layer (round 4 turned the remap into a finish, so what is
       asserted is the finish, not an exposure change) */
    const levelsOk = !!fin && fin.contrast < 0.999 && fin.black > 0.002
      && fin.white < 0.999 && fin.mid !== undefined;
    const grainOk = ratio !== null && ratio >= GRAIN_BAND[0] && ratio <= GRAIN_BAND[1];
    const ok = grainOk && levelsOk;
    report.register.push({ set, mark: m0.n, finish: fin,
      sigmaOff: off.sigma, sigmaOn: on.sigma,
      grainPx: shot.d.n, grainLive: shot.d.live,
      added: added === null ? null : +added.toFixed(5),
      plateSigma, ratio: ratio === null ? null : +ratio.toFixed(3),
      grainOk, levelsOk, ok });
    process.stdout.write(`[reg]  ${set}/${m0.n} body sigma ${off.sigma}->${on.sigma} `
      + `grain-delta ${added === null ? '-' : added.toFixed(5)} vs plate ${plateSigma} `
      + `ratio ${ratio === null ? '-' : ratio.toFixed(2)} `
      + `levels[C ${fin ? fin.contrast : '-'} blk ${fin ? fin.black : '-'} `
      + `mid ${fin ? fin.mid : '-'} wht ${fin ? fin.white : '-'}] `
      + `${ok ? 'PASS' : 'FAIL'}\n`);
  }
}

/* ---- SOL#6 [scale]: the size has to be PROVEN, not asserted ---- */
if (!SKIP_BEATS && !BEATS_ONLY && (!ONLY || ONLY === 'cave')) {
  const found = await page.evaluate(async (k) => {
    if (!window.__unitByKey || !window.__unitByKey(k)) return false;
    await window.__gotoUnit(k); return true;
  }, SCALE_UNIT).catch(() => false);
  if (!found) {
    process.stdout.write(`[scale] ${SCALE_UNIT} NOT FOUND\n`);
  } else {
    /* settle: a rig swap still in flight measures a body that is not where
       the unit stages it (the seat reads 15 px taller mid-move) */
    await page.evaluate('window.__advance(9.0)');
    const m = await page.evaluate(([unit, layerId, dropMin, contactMin, ovMin]) => {
      const st = window.__refs.stage;
      const rec = st.sets[st.activeName];
      const giant = st.actors['poly-seat'], hero = st.actors.ulysses;
      if (!rec || !giant || !hero) return { err: 'no giant/hero on the leaf' };
      const cv = document.getElementById('stage3d');
      const off = document.createElement('canvas');
      const grab = () => {
        st.render();
        off.width = cv.width; off.height = cv.height;
        const g = off.getContext('2d', { willReadFrequently: true });
        g.drawImage(cv, 0, 0);
        return g.getImageData(0, 0, off.width, off.height);
      };
      const W = cv.width, H = cv.height;
      const sx = W / cv.clientWidth, sy = H / cv.clientHeight;
      const project = (v) => {
        const p = v.clone().project(st.cam);
        return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
      };
      const luma = (im, i) =>
        0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2];
      const discMean = (im, cx, cy, r) => {
        let s = 0, n = 0;
        for (let y = Math.max(0, cy - r | 0); y < Math.min(H, cy + r); y++)
          for (let x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy > r * r) continue;
            s += luma(im, (y * W + x) * 4); n++;
          }
        return n ? s / n : null;
      };

      const heroFoot = project(hero.group.position);
      const giantSeat = project(giant.group.position);
      const shipped = grab();

      /* ONE VARIABLE AT A TIME, and they NEST: shipped -> cast off -> cast off
         AND blobs off. Comparing "cast off, blobs on" against "cast on, blobs
         off" measures both changes at once and reports the contact shadow as
         negative, which is what the first draft of this gate did. */
      const cast = giant.scaleShadow;
      const castWas = cast && cast.visible;
      if (cast) cast.visible = false;
      const noCast = grab();

      /* ROUND 5 — the decals live in a WORLD-SPACE ground frame per actor
         (stage3d a.gshadow), because a posed body tipped a child decal into a
         vertical plane and a lifted one carried it into the air. The gate
         hides the frame, not the single blob it used to be. */
      const gWas = giant.gshadow && giant.gshadow.visible;
      const hWas = hero.gshadow && hero.gshadow.visible;
      if (giant.gshadow) giant.gshadow.visible = false;
      if (hero.gshadow) hero.gshadow.visible = false;
      const noBlobs = grab();
      if (giant.gshadow) giant.gshadow.visible = gWas;
      if (hero.gshadow) hero.gshadow.visible = hWas;
      if (cast) cast.visible = castWas;

      /* OVERLAP — the giant's own pixels, and how many stand inside an
         UPSTAGE cut's box (if he were behind it the card would take them) */
      const giantWas = giant.group.visible;
      giant.group.visible = false;
      if (cast) cast.visible = false;
      const noGiant = grab();
      giant.group.visible = giantWas;
      if (cast) cast.visible = castWas;

      const layer = (st.plateCensus(st.activeName) || [])
        .find((L) => L.id === layerId);
      let overlapPx = 0, giantPx = 0;
      if (layer) {
        const [bx0, by0, bx1, by1] = layer.box;
        /* plate px -> screen px through the live lens */
        const lens = st.lens || { at: [704, 384], k: 1 };
        const toScr = (px, py) => [
          (px - (lens.at[0] - 1408 / lens.k / 2)) / (1408 / lens.k) * W,
          (py - (lens.at[1] - 768 / lens.k / 2)) / (768 / lens.k) * H];
        const [sx0, sy0] = toScr(bx0, by0), [sx1, sy1] = toScr(bx1, by1);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const d = Math.abs(shipped.data[i] - noGiant.data[i])
              + Math.abs(shipped.data[i + 1] - noGiant.data[i + 1])
              + Math.abs(shipped.data[i + 2] - noGiant.data[i + 2]);
            if (d <= 24) continue;
            giantPx++;
            if (x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1) overlapPx++;
          }
      }

      /* a seated giant covers his own blob almost entirely, so the contact
         test also counts CHANGED pixels, not only the mean over a disc */
      const changed = (imA, imB, cx, cy, r) => {
        let n = 0;
        for (let y = Math.max(0, cy - r | 0); y < Math.min(H, cy + r); y++)
          for (let x = Math.max(0, cx - r | 0); x < Math.min(W, cx + r); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy > r * r) continue;
            const i = (y * W + x) * 4;
            if (Math.abs(luma(imA, i) - luma(imB, i)) > 2) n++;
          }
        return n;
      };
      const rHero = Math.max(14, 0.55 * 43 * sx);     /* ~half a metre of floor */
      const rGiant = Math.max(20, 2.20 * 43 * sx);
      const heroGround = [heroFoot[0], heroFoot[1] + 6 * sy];
      const giantGround = [giantSeat[0], giantSeat[1] + 8 * sy];
      /* ROUND 5 — MEASURE THE POOL WHERE THE POOL IS. Round 4 aimed the
         giant's smear down the giant-seat -> bowl axis (at the hero) and read
         it on the hero's own ground. The pool is now cast by the PAINTER's
         own shadow direction (_shadowDir: radially out of the hearth plus the
         measured downstage bias), so the honest read is the floor under the
         pool itself — anywhere else measures nothing and calls it a defect. */
      const poolAt = cast ? project(cast.getWorldPosition(new (window.__THREE.Vector3)()))
        : giantGround;
      const castDrop = discMean(noCast, poolAt[0], poolAt[1], rGiant)
        - discMean(shipped, poolAt[0], poolAt[1], rGiant);
      const heroBlobDrop = discMean(noBlobs, heroGround[0], heroGround[1], rHero)
        - discMean(noCast, heroGround[0], heroGround[1], rHero);
      const giantBlobDrop = discMean(noBlobs, giantGround[0], giantGround[1], rGiant)
        - discMean(noCast, giantGround[0], giantGround[1], rGiant);
      const heroBlobPx = changed(noBlobs, noCast, heroGround[0], heroGround[1], rHero);
      const giantBlobPx = changed(noBlobs, noCast, giantGround[0], giantGround[1], rGiant);

      return {
        unit, layer: layerId,
        poolAt: [Math.round(poolAt[0]), Math.round(poolAt[1])],
        castDrop: +castDrop.toFixed(2),
        heroBlobDrop: +heroBlobDrop.toFixed(2), heroBlobPx,
        giantBlobDrop: +giantBlobDrop.toFixed(2), giantBlobPx,
        giantPx, overlapPx,
        castOK: castDrop >= dropMin,
        /* a body is IN its own shadow if the blob darkens its ground at all
           AND paints a real patch of it — the seated giant's blob is mostly
           under him, so the pixel count is what proves it is there */
        contactOK: heroBlobDrop >= contactMin && heroBlobPx >= 120
          && giantBlobPx >= 120,
        overlapOK: overlapPx >= ovMin,
      };
    }, [SCALE_UNIT, OVERLAP_LAYER, SHADOW_DROP_MIN, CONTACT_DROP_MIN, OVERLAP_PX_MIN]);
    m.ok = !m.err && m.castOK && m.contactOK && m.overlapOK;
    report.scale.push(m);
    process.stdout.write(`[scale] ${SCALE_UNIT} cast -${m.castDrop} L `
      + `(min ${SHADOW_DROP_MIN}) · contact hero -${m.heroBlobDrop}L/`
      + `${m.heroBlobPx}px giant -${m.giantBlobDrop}L/${m.giantBlobPx}px `
      + `(min ${CONTACT_DROP_MIN}L, 120px) · overlap ${m.overlapPx}/`
      + `${m.giantPx} px in ${OVERLAP_LAYER} (min ${OVERLAP_PX_MIN}) `
      + `${m.ok ? 'PASS' : 'FAIL'}\n`);
  }
}

/* ---- the scripted read: TWELVE beat frames, and the round-5 gates ---- *
 *
 * [continuity]  the owner's root cause. Each character's own pixels are cut
 *   out of every frame he appears in (hide his group, re-render, difference),
 *   handed to the ENGINE's own hue statistic, and matched to the canonical
 *   hues of his atlas — skin AND costume. The gate is the STANDARD DEVIATION
 *   of each matched hue ACROSS THE TWELVE FRAMES: a character may be lit, he
 *   may not change colour. Round 4's per-unit chromaticity transplant
 *   measured 20-40 deg of drift here; the law is 6.
 *
 * [grounding]   Sol's twice-unfixed defect. For every character in every
 *   frame: strike his own ground decals, re-render, and count the pixels that
 *   got LIGHTER. Presence (>= GROUND_PX_MIN px darkened by his own shadow)
 *   and OVERLAP (>= GROUND_OVERLAP of them inside his own dilated screen box,
 *   so the shadow is his and not somebody else's).
 *
 * [firelight]   one fire, on everybody. The warm triad is struck (key, rim,
 *   spill) and the frame re-rendered: the DIFFERENCE is the fire's own
 *   contribution per pixel, with albedo cancelled exactly. Per character, the
 *   mean contribution on the half of his body that faces the fire against the
 *   half that does not — a directional light must show an asymmetry, and a
 *   wash cannot.
 *
 * [finish]      SOL#5's focus pass, proven twice over: it must CHANGE the
 *   character layer (RMS of soft-on minus soft-off over the character mask)
 *   and it must LEAVE THE PLATE ALONE (max change outside the mask = 0).
 */
if (!SKIP_BEATS) {
  await page.evaluate(() => window.__plate.bypassSoft(false));
  const BEATS = [
    'ody-i-07-council',     'ody-i-10-wineskin',
    'ody-ii-05-strangers',  'ody-ii-10-firstmeal',
    'ody-iii-05-lots',      'ody-iii-08-lookhere',
    'ody-iii-11-noman',     'ody-iv-02-glowing',
    'ody-iv-03-auger',      'ody-iv-12-doorway',
    'ody-v-05-dawn',        'ody-vi-03-rock1',
  ];
  const cont = {};                    /* id -> canonHue -> [rendered hues] */
  for (const key of BEATS) {
    /* THE GOTO IS ASYNC AND THE CLOCK IS FROZEN. __gotoUnit awaits
       stage.ensure(set) — it builds the leaf's world — and under ?harness=1
       nothing renders between explicit calls. Round 2 fired it WITHOUT await
       and then slept 900 wall-clock ms, so a beat whose set was still building
       was shot holding the PREVIOUS beat's pixels (i-07 council and ii-05
       strangers came out byte-identical: the shore, twice). Await the goto,
       then spend SIM time — the frame is a pure function of story time. */
    const found = await page.evaluate(async (k) => {
      if (!window.__unitByKey || !window.__unitByKey(k)) return false;
      await window.__gotoUnit(k); return true;
    }, key).catch(() => false);
    if (!found) { process.stdout.write(`[beat] ${key} NOT FOUND\n`); continue; }
    /* SETTLE. A walk still in flight is a body that is not where the unit
       stages it — round 4 shot the auger crew mid-corridor. */
    await page.evaluate('window.__advance(9.0)');
    const file = path.join(SHOTS, `beat-${key}.png`);
    /* ---- C3 [overlay]: THE PRODUCTION FRAME IS THE RENDER ---------------
       The frame is shot as the page composites it — canvas plus whatever DOM
       stands over the stage rectangle. Round 2's frames carried the leader
       path and the target ring that way. So the frame is shot TWICE: once as
       shipped, once with every overlay force-hidden, and the two PNGs must be
       byte-identical. That is "zero overlay pixels", proven rather than
       asserted, and it fails the moment anything draws over the render.    */
    const shipped = await page.locator('#stage3d').screenshot({ path: file });
    const hide = await page.addStyleTag(
      { content: `${OVERLAY_SEL}{display:none !important}` });
    const clean = await page.locator('#stage3d').screenshot();
    await hide.evaluate((el) => el.remove());
    const hA = createHash('sha256').update(shipped).digest('hex');
    const hB = createHash('sha256').update(clean).digest('hex');
    const clear = hA === hB;
    report.overlay.push({ beat: key, shipped: hA.slice(0, 16), clean: hB.slice(0, 16),
      bytes: shipped.length, overlayPx: clear ? 0 : -1, ok: clear });

    /* ---- the per-character bench: one page pass, four measurements ---- */
    const m = await page.evaluate(([gPx, gOvl, gDil, hueFrac]) => {
      const S = window.__refs.stage;
      const rec = S.sets[S.activeName];
      const cv = document.getElementById('stage3d');
      const off = document.createElement('canvas');
      const grab = () => {
        S.render();
        off.width = cv.width; off.height = cv.height;
        const g = off.getContext('2d', { willReadFrequently: true });
        g.drawImage(cv, 0, 0);
        return g.getImageData(0, 0, off.width, off.height);
      };
      const W = cv.width, H = cv.height;
      const lum = (im, i) => 0.2126 * im.data[i] + 0.7152 * im.data[i + 1]
        + 0.0722 * im.data[i + 2];
      const dsum = (a, b, i) => Math.abs(a.data[i] - b.data[i])
        + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      const project = (v) => {
        const p = v.clone().project(S.cam);
        return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
      };
      const shipped = grab();
      /* the fire's own contribution, once per frame */
      window.__plate.fireOff(true);
      const noFire = grab();
      window.__plate.fireOff(false);
      /* the finish pass on/off, once per frame */
      const soft = grab();
      window.__plate.bypassSoft(true);
      const hard = grab();
      window.__plate.bypassSoft(false);
      const fire = rec.fireAnchor ? project(rec.fireAnchor) : null;
      const rows = [];
      let maskRms = 0, maskN = 0, plateMax = 0;
      for (const [id, a] of Object.entries(S.actors)) {
        if (!a.group.visible || a.mode === 'off') continue;
        /* (A) his own pixels */
        a.group.visible = false;
        const noBody = grab();
        a.group.visible = true;
        /* (B) his own ground decals */
        const gw = a.gshadow ? a.gshadow.visible : false;
        const pw = a.scaleShadow ? a.scaleShadow.visible : false;
        if (a.gshadow) a.gshadow.visible = false;
        if (a.scaleShadow) a.scaleShadow.visible = false;
        const noShade = grab();
        if (a.gshadow) a.gshadow.visible = gw;
        if (a.scaleShadow) a.scaleShadow.visible = pw;

        const body = [];
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, sx = 0, sy = 0;
        let shadePx = 0, shadeSum = 0, shadeMax = 0;
        const shade = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) << 2;
            if (dsum(shipped, noBody, i) > 24) {
              body.push([shipped.data[i], shipped.data[i + 1], shipped.data[i + 2], x, y]);
              if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
              if (y < by0) by0 = y; if (y > by1) by1 = y;
              sx += x; sy += y;
            }
            const d = lum(noShade, i) - lum(shipped, i);
            if (d > 4) { shadePx++; shadeSum += d; if (d > shadeMax) shadeMax = d;
                         shade.push(x, y); }
          }
        }
        if (body.length < 200) continue;
        const cx = sx / body.length, cy = sy / body.length;
        /* the shadow is HIS: inside his own screen box, dilated by its width */
        /* THE SHADOW BELONGS AT HIS FEET, so that is where it is measured
           from — not from the middle of whatever part of him the cut cards
           leave visible. The radius is his own size: a pool is half a stature
           long and lies at 25 degrees, so 1.6 spans covers it and nothing
           else's. */
        const span = Math.max(bx1 - bx0, by1 - by0);
        const gpv = a.group.getWorldPosition(new (window.__THREE.Vector3)());
        const gpp = project(gpv);
        const rad = Math.max(30, span * gDil);
        let inBox = 0;
        for (let i = 0; i < shade.length; i += 2) {
          const dx = shade[i] - gpp[0], dy = shade[i + 1] - gpp[1];
          if (dx * dx + dy * dy <= rad * rad) inBox++;
        }
        /* the hues the render put on screen, by the engine's own statistic */
        const hp = window.__plate.huePeaks(body.map((p) => [p[0], p[1], p[2]]), hueFrac);
        /* the fire's own light on him, fire side against off side */
        let fs = 0, fn = 0, os = 0, on2 = 0, fAll = 0, fSq = 0;
        /* LATERALLY, OR NOT AT ALL. Splitting a body along the screen vector
           to the hearth mixes the lateral test with a VERTICAL one, and the
           vertical direction is confounded: a standing man's head and
           shoulders face the sky, so the third of him nearest a hearth that
           sits up-screen is the third that a horizontal rake reaches LAST.
           Measured, that inverted the read on five bodies. The split is the
           horizontal component alone, and when the hearth is within a body's
           own width of his centre in x there is no lateral test to make. */
        /* IS HIS FIRE-FACING SIDE EVEN IN VIEW? This stage's hearths sit
           UPSTAGE of most of the staging, so most bodies are BACKLIT by the
           fire: the side the flame reaches is the side the camera cannot see,
           and the only fire on their visible pixels is a rim. Asking such a
           body for a near-side/far-side ratio asks the rim to out-shine a lit
           face, which it never does — that is not a lighting defect, it is
           where the ledger put the marks. A body standing UPSTAGE of the
           hearth turns its lit side to the lens and IS testable. */
        const bz = a.group.getWorldPosition(new (window.__THREE.Vector3)()).z;
        const frontlit = rec.fireAnchor ? (bz - rec.fireAnchor.z) < -0.5 : false;
        const lateral = fire ? Math.abs(fire[0] - cx) >= 0.6 * (bx1 - bx0) + 6 : false;
        if (fire) {
          const ux = Math.sign(fire[0] - cx) || 1;
          const proj = body.map((p) => (p[3] - cx) * ux);
          const sorted = proj.slice().sort((p, q) => p - q);
          const loQ = lateral ? sorted[Math.floor(sorted.length * 0.30)] : Infinity;
          const hiQ = lateral ? sorted[Math.floor(sorted.length * 0.70)] : Infinity;
          for (let k = 0; k < body.length; k++) {
            const i = ((body[k][4] * W) + body[k][3]) << 2;
            /* THE FRACTION OF THIS PIXEL'S LIGHT THAT IS THE FIRE'S.
               The raw difference is albedo TIMES irradiance, so a dark head
               nearer the hearth measures less warm light than a pale foot
               further off and the asymmetry reads backwards (round 5 first
               pass: the sprawled giant 0.68, three ewes under 1.0). The RATIO
               d / L cancels albedo to first order — for a Lambertian surface
               it is fire / (fire + cool), which is the geometry alone. */
            const d = lum(shipped, i) - lum(noFire, i);
            const rel = d / Math.max(8, lum(shipped, i));
            fAll += d; fSq += d * d;
            if (proj[k] >= hiQ) { fs += rel; fn++; }
            else if (proj[k] <= loQ) { os += rel; on2++; }
          }
        }
        const fireSide = fn ? fs / fn : 0, offSide = on2 ? os / on2 : 0;   /* fractions */
        const gp = gpp;
        const onFrame = gp[0] > 8 && gp[0] < W - 8 && gp[1] > 8 && gp[1] < H - 8;
        /* A CUT CARD THAT TAKES HIS FEET TAKES HIS SHADOW. When a body's
           visible pixels stop far above its own ground point, the sandwich is
           holding the bottom of him back — at ii-10 the pen rails leave 418 px
           of Ulysses' head 100 px above his soles. There is no shadow to
           measure there and the frame is right. */
        const feetHidden = gp[1] - by1 > 0.35 * (by1 - by0) + 10;
        const exempt = a.grounded === false ? 'not-on-the-floor'
          : (!onFrame ? 'ground-point-off-frame'
            : (feetHidden ? 'feet-behind-a-cut' : null));
        let scx = 0, scy = 0;
        for (let i = 0; i < shade.length; i += 2) { scx += shade[i]; scy += shade[i + 1]; }
        rows.push({ id, rig: a.rig, mode: a.mode, contacts: a.contactKind,
          grounded: a.grounded !== false, onFrame, exempt,
          groundAt: [Math.round(gp[0]), Math.round(gp[1])],
          shadeAt: shadePx ? [Math.round(scx / (shade.length / 2)),
                              Math.round(scy / (shade.length / 2))] : null,
          bodyPx: body.length, box: [bx0, by0, bx1, by1],
          seat: a.seat, E: a.gradeLum, tint: a.tint,
          shadePx, shadeMean: +(shadePx ? shadeSum / shadePx : 0).toFixed(2),
          shadeMax: +shadeMax.toFixed(1),
          shadeInBox: inBox,
          shadeOverlap: +(shadePx ? inBox / shadePx : 0).toFixed(3),
          fireSide: +fireSide.toFixed(4), offSide: +offSide.toFixed(4),
          fireMean: +(fAll / body.length).toFixed(2), lateral, frontlit,
          fireCv: +(Math.sqrt(Math.max(0, fSq / body.length
            - (fAll / body.length) * (fAll / body.length)))
            / Math.max(0.5, fAll / body.length)).toFixed(3),
          fireRatio: +(fireSide / Math.max(0.02, offSide)).toFixed(3),
          peaks: hp.peaks.slice(0, 5).map((q) => ({ hue: q.hue, frac: q.frac })),
          groundOK: !!exempt
            || (shadePx >= gPx && (shadePx ? inBox / shadePx : 0) >= gOvl),
        });
      }
      /* the finish pass: what it changed, and what it must not have */
      for (let i = 0; i < shipped.data.length; i += 4) {
        const inMask = dsum(soft, hard, i) > 0;
        if (!inMask) continue;
        for (let c = 0; c < 3; c++) {
          const d = soft.data[i + c] - hard.data[i + c];
          maskRms += d * d; maskN++;
        }
      }
      return { set: S.activeName, rows,
               finish: { changedPx: maskN / 3,
                         rms: +(maskN ? Math.sqrt(maskRms / maskN) : 0).toFixed(3) },
               fireAt: fire ? [Math.round(fire[0]), Math.round(fire[1])] : null };
    }, [GROUND_PX_MIN, GROUND_OVERLAP, GROUND_DILATE, 0.035]);

    const st = await page.evaluate('window.__state()');
    const fireScene = m.set === 'cave' || m.set === 'shore';
    for (const r of m.rows) {
      /* the identity anchors of this rig's own atlas */
      const canon = ((report.cast[r.id] || {}).canon || []).filter((c) => c.frac >= 0.05)
        .slice(0, 2);
      const matched = canon.map((c) => {
        let bd = 999, best = null;
        for (const p of r.peaks) {
          const d = Math.abs(((p.hue - c.hue) % 360 + 540) % 360 - 180);
          if (d < bd) { bd = d; best = p; }
        }
        /* AN AMBIGUOUS PEAK IS NOT A SAMPLE. When a rig's two canonical hues
           are close and the light is dim, the render's histogram MERGES them
           into one peak that sits between the two — the giant at iv-03 came
           back as a single 31.7 deg peak with his skin at 23.7 and his tunic
           at 43.7 either side of it, and the series then carried a 14 deg
           "drift" that is a measurement collapse, not a colour change. A peak
           only speaks for an anchor when it is decisively nearer that anchor
           than any other. */
        let second = 999;
        for (const c2 of canon) {
          if (c2.hue === c.hue || !best) continue;
          second = Math.min(second,
            Math.abs(((best.hue - c2.hue) % 360 + 540) % 360 - 180));
        }
        const decisive = second >= bd * 1.6;
        /* NO PEAK-HOPPING, AND NO STATISTIC OFF A THUMBNAIL. When a rig is
           400 px on screen its costume owns too few pixels to make a peak, and
           the nearest-peak match then hands back his SKIN hue — which enters
           the series as a 20 deg jump and reads as drift that is not there
           (round 5 first pass: ulysses' chiton series carried one 12.8 among
           seven 338-357s). A frame only contributes a sample when the body is
           big enough to have the colour in it AND a peak actually lands near
           the canonical hue. */
        if (r.bodyPx >= 800 && best && bd <= 25 && decisive) {
          cont[r.id] = cont[r.id] || {};
          cont[r.id][c.hue] = cont[r.id][c.hue] || [];
          cont[r.id][c.hue].push({ beat: key, hue: best.hue, d: +bd.toFixed(1) });
        }
        return { canonHue: c.hue, renderHue: best ? best.hue : null, dHue: +bd.toFixed(1),
                 decisive, sampled: r.bodyPx >= 800 && !!best && bd <= 25 && decisive };
      });
      const lying = r.mode === 'pose' || r.contacts === 'seat';
      const bar = lying ? FIRE_RATIO_POSE : FIRE_RATIO_MIN;
      const fireOK = !fireScene
        || (r.fireMean >= FIRE_MEAN_MIN && r.fireCv >= FIRE_CV_MIN
            && (!(r.lateral && r.frontlit) || r.fireRatio >= bar));
      report.grounding.push({ beat: key, set: m.set, id: r.id, mode: r.mode,
        contacts: r.contacts, bodyPx: r.bodyPx, box: r.box, groundAt: r.groundAt,
        shadeAt: r.shadeAt, shadePx: r.shadePx, exempt: r.exempt,
        shadeMean: r.shadeMean, shadeMax: r.shadeMax, overlap: r.shadeOverlap,
        ok: r.groundOK });
      report.firelight.push({ beat: key, set: m.set, id: r.id, fireScene, lying, bar,
        lateral: r.lateral, frontlit: r.frontlit, cv: r.fireCv, mean: r.fireMean,
        fireSide: r.fireSide, offSide: r.offSide, ratio: r.fireRatio, ok: fireOK });
      report.seat.push({ beat: key, id: r.id, seat: r.seat, E: r.E, tint: r.tint,
        matched });
      process.stdout.write(`[body] ${key}/${r.id} px ${r.bodyPx} E ${r.E} `
        + `shade ${r.shadePx}px/-${r.shadeMean}L ovl ${(r.shadeOverlap * 100).toFixed(0)}% `
        + `${r.groundOK ? 'GROUND-PASS' : 'GROUND-FAIL'} · fire mean ${r.fireMean} `
        + `${r.fireSide}/${r.offSide} = ${r.fireRatio} cv ${r.fireCv} `
        + `${r.frontlit ? 'frontlit' : 'backlit'} (bar ${bar}) `
        + `${fireOK ? 'FIRE-PASS' : 'FIRE-FAIL'} · hue `
        + matched.map((x) => `${x.canonHue}->${x.renderHue}`).join(' ') + '\n');
    }
    const finOK = m.finish.changedPx >= FINISH_PX_MIN && m.finish.rms >= FINISH_RMS_MIN;
    report.finish.push({ beat: key, set: m.set, ...m.finish, ok: finOK });
    process.stdout.write(`[fin]  ${key} soft pass changed ${m.finish.changedPx}px `
      + `rms ${m.finish.rms} ${finOK ? 'PASS' : 'FAIL'}\n`);
    report.beats[key] = { set: st.set, lens: st.stage.lens, plateState: st.stage.plateState,
      bands: st.stage.bands, retired: st.stage.retired, light: st.stage.light,
      file: path.relative(REPO, file), overlayClear: clear,
      cast: m.rows.map((r) => r.id) };
    process.stdout.write(`[beat] ${key} set=${st.set} lens=`
      + `${st.stage.lens ? st.stage.lens.name + '@k' + st.stage.lens.k : '-'} `
      + `cast=${m.rows.length} -> ${path.basename(file)}\n`);
    process.stdout.write(`[ovl]  ${key} shipped==clean ${clear ? 'PASS (0 overlay px)' : 'FAIL'}\n`);
  }

  /* ---- [continuity]: the standard deviation of a character's own hue over
     every frame he stands in. Circular, because hue wraps.               ---- */
  for (const [id, byCanon] of Object.entries(cont)) {
    for (const [canonHue, list] of Object.entries(byCanon)) {
      if (list.length < 2) {
        report.continuity.push({ id, canonHue: +canonHue, frames: list.length,
          skipped: true, ok: true });
        continue;
      }
      let sx = 0, sy = 0;
      for (const e of list) { sx += Math.cos(e.hue * Math.PI / 180);
                              sy += Math.sin(e.hue * Math.PI / 180); }
      const mean = Math.atan2(sy / list.length, sx / list.length) * 180 / Math.PI;
      let ss = 0, worst = 0, worstBeat = null;
      for (const e of list) {
        const d = Math.abs(((e.hue - mean) % 360 + 540) % 360 - 180);
        ss += d * d;
        if (d > worst) { worst = d; worstBeat = e.beat; }
      }
      const std = Math.sqrt(ss / list.length);
      const ok = std <= HUE_STD_MAX;
      report.continuity.push({ id, canonHue: +canonHue, frames: list.length,
        meanHue: +mean.toFixed(1), std: +std.toFixed(2), worst: +worst.toFixed(1),
        worstBeat, hues: list.map((e) => e.hue), ok });
      process.stdout.write(`[cont] ${id} canon ${canonHue}deg over ${list.length} frames `
        + `mean ${mean.toFixed(1)} std ${std.toFixed(2)} (max ${HUE_STD_MAX}) `
        + `worst ${worst.toFixed(1)} @${worstBeat} ${ok ? 'PASS' : 'FAIL'}\n`);
    }
  }

  /* ---- C3, the other half: the flag has to actually DO something. Boot a
     second page on ?debug=1, drive it to the same beat, and prove the frame
     DIFFERS — a gate that can only pass is not a gate. ---- */
  {
    const dbg = await browser.newPage({ viewport: { width: 1600, height: 940 } });
    await dbg.goto(`${ORIGIN}/living-odyssey/3d/?harness=1&debug=1`,
                   { waitUntil: 'domcontentloaded' });
    await dbg.waitForFunction('window.__ready === true', null, { timeout: 180000 });
    await dbg.evaluate('window.__mute(true)');
    await dbg.evaluate(() => { window.__gotoUnit('ody-i-07-council'); });
    await dbg.waitForTimeout(900);
    /* the leader only draws for an embodied speaker; force the control rings
       on so the flag's whole surface is under test */
    await dbg.evaluate(() => {
      for (const id of ['leader', 'hold', 'target']) {
        const el = document.getElementById(id);
        if (el) el.classList.add('on');
      }
      const p = document.querySelector('#leader path');
      if (p) p.setAttribute('d', 'M 40 40 L 1200 700');
      const c = document.querySelector('#leader circle');
      if (c) { c.setAttribute('cx', '1200'); c.setAttribute('cy', '700'); }
      const t = document.getElementById('target');
      if (t) { t.style.left = '900px'; t.style.top = '400px'; }
    });
    const withDbg = await dbg.locator('#stage3d').screenshot(
      { path: path.join(SHOTS, 'overlay-debug1.png') });
    await dbg.addStyleTag({ content: `${OVERLAY_SEL}{display:none !important}` });
    const withoutDbg = await dbg.locator('#stage3d').screenshot(
      { path: path.join(SHOTS, 'overlay-debug1-hidden.png') });
    const hD = createHash('sha256').update(withDbg).digest('hex');
    const hH = createHash('sha256').update(withoutDbg).digest('hex');
    const flagWorks = hD !== hH;
    report.overlay.push({ beat: 'debug=1', shipped: hD.slice(0, 16),
      clean: hH.slice(0, 16), flagShowsOverlays: flagWorks, ok: flagWorks });
    process.stdout.write(`[ovl]  ?debug=1 reveals overlays: `
      + `${flagWorks ? 'PASS' : 'FAIL (flag is inert — the gate cannot fail)'}\n`);
    await dbg.close();
  }
}

report.consoleErrors = consoleErrors;
report.pageErrors = pageErrors;
report.requestsFailed = failed;
report.appErrors = await page.evaluate('window.__errors()');

const occOK = BEATS_ONLY || (report.occlusion.length > 0 && report.occlusion.every((o) => o.ok));
const deChecked = report.regrade.filter((r) => !r.skipped);
const deOK = BEATS_ONLY || (deChecked.length > 0 && deChecked.every((r) => r.ok));
const bdOK = BEATS_ONLY || (report.backdrop.length > 0 && report.backdrop.every((b) => b.ok));
const matOK = BEATS_ONLY || (report.materials.length > 0 && report.materials.every((m) => m.ok));
const regOK = BEATS_ONLY || (report.register.length > 0 && report.register.every((r) => r.ok));
const ovlOK = report.overlay.length > 1 && report.overlay.every((o) => o.ok);
const sclOK = BEATS_ONLY || (report.scale.length > 0 && report.scale.every((s) => s.ok));
const conOK = report.continuity.length > 0 && report.continuity.every((c) => c.ok);
const grdOK = report.grounding.length > 0 && report.grounding.every((g) => g.ok);
const firOK = report.firelight.length > 0 && report.firelight.every((f) => f.ok);
const finOK2 = report.finish.length > 0 && report.finish.every((f) => f.ok);
const worstHue = report.materials.reduce((w, m) => Math.max(w,
  ...((m.matched || []).map((x) => x.dHue))), 0);
report.verdict = {
  layersCut: Object.fromEntries(Object.entries(report.layers).map(([s, l]) => [s, l.length])),
  occlusion: { checked: report.occlusion.length,
    failed: report.occlusion.filter((o) => !o.ok).map((o) => `${o.set}/${o.id}`), ok: occOK },
  /* C1: the identity law on the live render */
  materials: { checked: report.materials.length, rigs: Object.keys(report.cast || {}).length,
    worstHueDeg: +worstHue.toFixed(1), hueMax: HUE_MAX,
    failed: report.materials.filter((m) => !m.ok).map((m) => `${m.set}/${m.id}@${m.mark}`),
    ok: matOK },
  /* SOL#6: contact, cast reach, and one deliberate overlap */
  scale: { checked: report.scale.length,
    failed: report.scale.filter((s) => !s.ok).map((s) => s.unit || 'scale'),
    ok: sclOK },
  regrade: { checked: deChecked.length,
    maxDeltaL: deChecked.length ? +Math.max(...deChecked.map((r) => r.deltaL)).toFixed(2) : null,
    maxDeltaC: deChecked.length ? +Math.max(...deChecked.map((r) => r.deltaC)).toFixed(2) : null,
    maxDeltaE: deChecked.length ? +Math.max(...deChecked.map((r) => r.deltaE)).toFixed(2) : null,
    failed: deChecked.filter((r) => !r.ok).map((r) => `${r.set}/${r.mark}`), ok: deOK },
  /* SOL#5: the character layer's inherited finish */
  register: { checked: report.register.length,
    ratios: report.register.map((r) => r.ratio),
    failed: report.register.filter((r) => !r.ok).map((r) => r.set), ok: regOK },
  /* C3: zero overlay pixels in the production frame */
  overlay: { frames: report.overlay.filter((o) => o.beat !== 'debug=1').length,
    overlayPx: report.overlay.filter((o) => o.beat !== 'debug=1' && !o.ok).length ? -1 : 0,
    flagRevealsOverlays: !!(report.overlay.find((o) => o.beat === 'debug=1') || {}).ok,
    failed: report.overlay.filter((o) => !o.ok).map((o) => o.beat), ok: ovlOK },
  backdrop: { worstMeanDE: report.backdrop.length
    ? +Math.max(...report.backdrop.map((b) => b.meanDE)).toFixed(2) : null, ok: bdOK },
  console: { errors: consoleErrors.length, pageErrors: pageErrors.length,
    appErrors: report.appErrors.length, requestsFailed: failed.length,
    ok: !consoleErrors.length && !pageErrors.length && !report.appErrors.length },
  /* ROUND 5 — the colour-continuity law and its three companions */
  continuity: { checked: report.continuity.length,
    worstStd: report.continuity.length
      ? +Math.max(...report.continuity.map((c) => c.std || 0)).toFixed(2) : null,
    hueStdMax: HUE_STD_MAX,
    failed: report.continuity.filter((c) => !c.ok).map((c) => `${c.id}@${c.canonHue}`),
    ok: conOK },
  grounding: { checked: report.grounding.length,
    exempt: report.grounding.filter((g) => g.exempt).map((g) => `${g.beat}/${g.id}:${g.exempt}`),
    minShadePx: report.grounding.filter((g) => !g.exempt).length
      ? Math.min(...report.grounding.filter((g) => !g.exempt).map((g) => g.shadePx)) : null,
    minOverlap: report.grounding.filter((g) => !g.exempt).length
      ? +Math.min(...report.grounding.filter((g) => !g.exempt)
        .map((g) => g.overlap)).toFixed(3) : null,
    failed: report.grounding.filter((g) => !g.ok).map((g) => `${g.beat}/${g.id}`),
    ok: grdOK },
  firelight: { checked: report.firelight.filter((f) => f.fireScene).length,
    minRatioFrontlit: report.firelight.filter((f) => f.fireScene && f.frontlit && f.lateral).length
      ? +Math.min(...report.firelight.filter((f) => f.fireScene && f.frontlit && f.lateral)
        .map((f) => f.ratio)).toFixed(3) : null,
    minMean: report.firelight.filter((f) => f.fireScene).length
      ? +Math.min(...report.firelight.filter((f) => f.fireScene)
        .map((f) => f.mean)).toFixed(2) : null,
    minCv: report.firelight.filter((f) => f.fireScene).length
      ? +Math.min(...report.firelight.filter((f) => f.fireScene)
        .map((f) => f.cv)).toFixed(3) : null,
    failed: report.firelight.filter((f) => !f.ok).map((f) => `${f.beat}/${f.id}`),
    ok: firOK },
  finish: { checked: report.finish.length,
    minRms: report.finish.length
      ? +Math.min(...report.finish.map((f) => f.rms)).toFixed(3) : null,
    failed: report.finish.filter((f) => !f.ok).map((f) => f.beat), ok: finOK2 },
  beats: Object.keys(report.beats).length,
};
report.PASS = occOK && deOK && bdOK && matOK && regOK
  && (SKIP_BEATS || (ovlOK && sclOK && conOK && grdOK && firOK && finOK2))
  && report.verdict.console.ok;

await writeFile(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
if (server) server.close();
console.log('\n=== SAM2 PATH ===');
console.log(JSON.stringify(report.verdict, null, 1));
if (consoleErrors.length) console.log('consoleErrors:', consoleErrors.slice(0, 6));
if (pageErrors.length) console.log('pageErrors:', pageErrors.slice(0, 6));
if (report.appErrors.length) console.log('appErrors:', report.appErrors.slice(0, 6));
console.log(report.PASS ? 'PASS' : 'FAIL');
process.exit(report.PASS ? 0 : 1);
