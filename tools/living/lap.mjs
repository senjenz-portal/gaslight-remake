/**
 * lap.mjs — ONE SCRIPTED READ OF THE WHOLE CHAPTER, end to end, against the
 * real page. 95 units, seven beats, eight gates, six page turns, four SETS.
 *
 * What a lap has to prove, and how it proves it here:
 *   95/95 units          every unit is entered, in order, by the reader's own
 *                        verb — no jumps, no __gotoUnit anywhere in the walk.
 *   the eight gates      each target gate is MISSED first (must not advance)
 *                        and only then hit (must advance). A gate that cannot
 *                        be failed is not a gate. The hold gate is failed by
 *                        letting go early.
 *   verbatim text        the DOM's rendered speech, diffed against CONTENT.md
 *                        and CONTENT-full.md's own tables, quote-normalised.
 *                        The law wins.
 *   the page turns       six of them, and FIVE swap the SET under a risen
 *                        cover. V->VI is the one beat boundary that is not a
 *                        turn, and that is asserted too.
 *   lazy, but not late   nothing is fetched WHILE A LEAF IS BEING READ. A set
 *                        arrives under its own cover or it does not arrive.
 *   the Beat VI clock    five units on the beat's own timeline and a page that
 *                        turns at t+19.8, none of it click-paced.
 *   the latch            a click inside a `wait` window is not lost.
 *   soft-fail            a gate left alone satisfies itself (sec 2.6).
 *   zero console errors  collected from the console, page errors, and the app's
 *                        own error list.
 *   the picture          screenshots at the beats that carry the beat.
 *
 * Usage: node tools/living/lap.mjs [--shots DIR] [--port N] [--headed]
 *        node tools/living/lap.mjs --base https://…/living   (the SAME lap, run
 *        against what is actually deployed instead of the working tree)
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodePng, pixelDiff, NEAR_BLACK } from '../png.mjs';
import { edgeBands, LANDSCAPE_MAX } from './lenslaw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = path.resolve(argv('--shots', path.join(ROOT, 'shots', 'living')));
const PORT = +argv('--port', 8807);
const TIMEOUT = +argv('--timeout', 600000);
/* --base runs the identical lap against a deployed URL. Nothing else changes:
   the same hooks, the same assertions, the same shots — only where the bytes
   come from, which is the one thing a local server cannot prove. */
const BASE = argv('--base', null);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

function serve(dir, port) {
  const srv = createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(req.url.split('?')[0]);
      let p = path.join(dir, u === '/' ? 'index.html' : u);
      if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
                           'cache-control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404).end(String(e.message)); }
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

/* ---- the two CONTENT files are the law: parse their own tables ---------- */
function contentUnits() {
  const out = [];
  // CONTENT.md — Beat I. Columns: # | key | prefix | text
  const md = fs.readFileSync(path.join(ROOT, 'CONTENT.md'), 'utf8');
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const c = line.split('|').map((s) => s.trim());
    if (!/^\d+$/.test(c[1] || '')) continue;
    out.push({ beat: 1, n: +c[1], key: c[2], prefix: c[3], text: c[4] });
  }
  // CONTENT-full.md — Beats II-VII. Columns: # | id | prefix | verb | text | staging
  const ORDER = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
  const full = fs.readFileSync(path.join(ROOT, 'CONTENT-full.md'), 'utf8');
  let beat = null;
  for (const line of full.split('\n')) {
    const m = /^### BEAT ([IVX]+)\b/.exec(line);
    if (m) { beat = ORDER[m[1]]; continue; }
    if (line.startsWith('## ')) { beat = null; continue; }
    if (beat === null || !line.startsWith('|')) continue;
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 7 || !/^\d+$/.test(c[1] || '')) continue;
    const id = c[2].replace(/`/g, '');
    let prefix = c[3].replace(/\*\*/g, '').replace(/\*\(.*?\)\*/g, '').trim();
    if (prefix === '—') prefix = '';
    const short = id.split('-').slice(2).join('-');
    out.push({ beat, n: +c[1], id, key: short === 'head' ? 'head' + beat : short,
               prefix, text: c[5], head: /chapter heading/.test(c[5]) });
  }
  return out;
}
const norm = (s) => (s || '')
  .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '—').replace(/\*/g, '').replace(/\s+/g, ' ').trim();

const log = [];
const fail = [];
const note = (m) => { log.push(m); console.log(m); };
const bad = (m) => { fail.push(m); console.log('FAIL  ' + m); };

/* ================= THE ROOM + STREET + HEADS LANE'S NUMBERS =============
 * Every one of these is a measurement, not a preference; the comment says what
 * was measured and what the shipped book scored before the fix.
 * ======================================================================= */
const HEAD_PLATE_MIN = NEAR_BLACK;  // 26. The six headings ran 28-50
                              // when they were shot properly; 07-00 shot 12.
const HEAD_DWELL_MAX = 0.7;   // s of a heading's dwell that may be gone before
                              // the reader can see it. With main.js's cover rule
                              // it measures 0.1-0.5; without it, 1.0-1.3.
const HEAD_TYPE_MIN = 120;    // the heading's own type peaks 236 on a good frame
                              // and 19 on the black one
const COAT_MAX = 12;          // green-leading px inside the armchair. The plate
                              // held 494 (and they were the ONLY green pixels in
                              // the whole painted room); 12 is jpeg wobble.
const ARRIVE_MOTION_MIN = 6;  // % of the window pane's pixels that must change
                              // between two frames of unit 10. Measured 83% with
                              // the rig crossing, 0% with the shipped still frame.
const DOOR_LEAF_PX = 107;     // the villa's front-door leaf, measured on
                              // street.jpg between y 361 and y 468 (2.03 m)
const FIGURE_MIN_PX = 112;    // 1.87 m at the pavement's 63.0 px/m is 117.8
const HEAD_CSS_MIN = 12;      // his head at the villa lens. It was 8.8.
const NORTON_HALO_MAX = 2.0;  // local luma excess around his cut: was +3.09
const NORTON_P95_MAX = 118;   // his highlights: were 130.4 on a 41.9 plate
const CAMEO = { gownMin: 4.0, hue: 298, hueTol: 15, skinMin: 2.0, greenMax: 0.5 };

/* ================= THE CHURCH + FINALE LANE'S NUMBERS ==================
 * F4 F5 F6 F7 F12 F13 F14. Every one is a measurement of the fixed thing at the
 * unit's own lens, and the comment carries what the shipped book scored before
 * the fix — because "lap clean" without these numbers is what let round 1 ship.
 * ======================================================================= */
/* [F4] the plate may not paint a participant. The three baked mannequins were
   cream cloth — gown, veil, shirt-front, surplice — and bright desaturated
   cloth is what no longer exists in the emptied chancel: the three figure boxes
   of church.jpg measured 3.37 / 7.86 / 7.03 % of their area as cloth before
   tools/lanecf/chancel_patch.py and 0.00 % after. */
const CLOTH_MAX = 0.40;        // % of a figure box that may be bright cloth
const CLOTH_BOXES = { bride: [688, 344, 792, 528], groom: [790, 372, 875, 505],
                      clergyman: [848, 328, 925, 510] };
/* and it is measured on EVERY bitmap that paints this chancel, because the law
   is "no faceless figure at the altar rail" and not "not in the base plate":
   church-dim rides ctx.dim on every unit of the beat, church-ring crossfades
   over the whole of fact M.4, and altar.png is a cut of the chancel itself. */
const CLOTH_PLATES = ['set/church/church.jpg', 'set/church/church-dim.jpg',
                      'set/church/church-ring.jpg', 'set/church/altar.png'];
/* where a cut that is not a full plate is placed, in plate px (sets/church.js
   ALTAR) — so a figure box can be intersected with it in one coordinate space */
const CLOTH_AT = { 'set/church/altar.png': [813, 339] };
/* [F5] feet on painted floor, or feet hidden: floorFrac >= 0.60 OR the pew cut
   swallows the actor's own FOOTWEAR block (tools/lanecf/foot_sink.py — witness
   20.0 px, groom 18.7 px, a hem 0). The witness's altar mark scored floorFrac
   0.07 with 8 px of a 20 px boot hidden, which is a sole on a rail. */
const FLOOR_FRAC_MIN = 0.60;
/* [F5] and the actor has to STAND on the mark the line above proved honest: the
   cut's own last painted row, against the baseline row the set declares, in
   plate px. The shipped six cuts and eight strip cells score 0.63 px worst
   (tools/lanecf/frame_feet.py), so 4 px is 6x the real error and still catches a
   regenerated cut with one part in thirty of new transparent hem. */
const FEET_LINE_MAX = 4.0;
/* [F5] AND NOT ONE SOLE COLUMN STANDS ON A PEW. The two gates above are a patch
   at a POINT: floorFrac reads 11x11 px centred on the mark, and a mark is a
   point while a pair of boots is 54 plate px wide. At the altar those are not
   the same question — the near pew's END STANDARD runs up to plate x 686 and the
   chancel stone the witness stands on starts at 692 — so the shipped mark
   (700, 501) probes floorFrac 0.893, PASSED the gate above, and put his left
   boot in mid-air over that standard with the rail's own highlight 7 px under
   the other one. That is the review's F5 surviving inside a lap asserting F5.
   So every column of every standing cut's own footwear block is classified at
   its own sole row (tools/lanecf/sole_span.py, and pew_end.py is the layer fix
   it forced):
     hidden  both pew cuts paint this pixel — the pew has the foot, which is what
             the plate's own painted figures did at this line
     onPew   the plate paints PEW FURNITURE under the sole and the cuts do not
             cover it: the boot is standing on a pew, or floating over one
     floor   anything else — the sole is over painted floor
   The test names the DEFECT and not the remedy, because floor here is three
   materials and only two are classifiable (the aisle's boards read value 140 and
   are neither carpet nor stone); pew furniture is the one unambiguous mass in
   this plate (value < 80, hue 200..310, against stone at 89..118). ZERO, not a
   fraction: one bare boot over a pew end in a 3.2x push is the filed defect. */
const SOLE_BAND = 20;          // art px above a cut's lowest row that is "ground"
const SOLE_ONPEW_MAX = 0;      // columns of sole allowed to stand on furniture
/* [F5] and the same question asked of the COMPOSITE, which is the only version of
   it the reader is in a position to answer. The gates above read the bitmaps one
   at a time and cannot see the layer BETWEEN a sole and the floor it measured: on
   the shipped staging that layer was the bride, painted behind the witness while
   standing 23 plate px nearer the camera, so 43 of his 80 sole columns rested on
   her gown over chancel stone that probed 0.893 floor. Zero on both counts — a
   sole is over the pew cut or over painted floor, never on another participant
   (tools/lanecf/sole_composite.py). */
const SOLE_ACTOR_MAX = 0;      // columns of sole allowed to stand on a PERSON
/* and the composite's third class NAMES THE DEFECT, exactly as the sibling gate
   above does, for the reason the sibling gate found. It was "void" — the plate
   under this visible sole is neither carpet nor stone — and that test fails boots
   standing on painted floor, because floor here is a third material the
   classifier does not know. Measured on the shipped plate at the two aisle marks:
   the witness's 9 outermost sole columns at `back` are on the aisle's WOODEN
   BOARDS (rgb 132,87,58 = hue 23.5, sat 56 %, value 132 — the carpet rule wants
   hue past 342 and the stone rule wants sat under 34 %) and 12 columns at
   `lounged` are on the runner's own SHADOWED EDGE (rgb 91,26,46 = hue 341.5,
   against a carpet rule that begins at 342.0). Both are floor, both were called
   void, and the lap failed six units for the plate's own paint. Pew furniture is
   the one unambiguous mass here (value < 80, hue 200..310), so the composite asks
   the same question the plate gate asks and no floor material can trip it. */
const SOLE_ONPEW_COMP_MAX = 0; // visible sole columns allowed over pew furniture
/* [F4] and the reader has to SEE all four once the witness is at the altar,
   measured in css px against #stage's own clipped rect. A cut carries a little
   transparent margin, so a few px of BOX outside the frame is not a clipped
   FIGURE — and the state this gate was written against was nowhere near the
   margin: `halfdragged` on the aisle lens left the clergyman 166 PLATE px
   outside the frame, the groom 48, and the witness's own head 40 above the top
   edge (tools/lanecf/frame_feet.py), all of which are multiples of this gate at
   any lens that unit can be composed at. */
const CAST_CLIP_MAX = 12;
/* [F6] [F7] the two close lenses are PUSHES and the two objects are OBJECTS.
   The review measured a ~10 px ring and a coin that "did not read" in the
   settled frames; at k 3.20 with a 16 px prop both land 64 device px across. */
const PUSH_K_MIN = 3.0;
const RING_SCREEN_MIN = 40;    // device px, in the frame the reader dwells on
/* the coin's floor is 40 for the SAME reason the ring's is, and it is a
   different NUMBER because the two lenses shipped differently broken: the ring
   shipped at 13 px on k 2.20 and renders 35.8 device px, under the 40 floor, so
   40 bites it. The coin shipped at 13 px on k 2.70 and renders 43.9 — over that
   floor while still being the thing the review filed as "no coin reads". The
   floor a gate is worth having is one the FILED state fails, so the coin's is
   measured between the two states it can be in (43.9 broken / 64.1 fixed, both
   read off the settled frame by tools/living/teeth-cf.sh). */
const COIN_SCREEN_MIN = 52;
/* the journey is measured WHERE THE READER SEES IT — the two legs in plate px
   times the lens in force, in device px. It shipped as 53 plate px at the wide
   nave lens = 106 device px, which is the "smudge that never went anywhere";
   the same three holders under the coin lens are 65.2 x 3.20 x 2 = 417. */
const COIN_TRAVEL_MIN = 300;   // device px, bride's hand -> palm -> watch chain
/* [F12] matte.py's spill ceiling, on the rim where keying spill lives. The
   shipped reveal cut carried 284 of 329 outer-rim px over the ceiling and a max
   excess of 149; tools/lanecf/respill.py brought the rim to 21. */
const SPILL_CEILING = 20;
const SPILL_RIM_MAX = 32;      // max (R+B)/2 - G allowed in the soft rim band
const SPILL_RIM_OVER_MAX = 40; // how many rim px may exceed the ceiling
/* [F13] one floor. The fire is street-smoke minus street-window; before
   tools/lanecf/plume_floor.py the first-floor sash held 1874 hot px and the
   reveal's own glass band 126. After: 0 and 1639. */
const SASH_BOX = [728, 178, 800, 272];      // the first-floor aperture
const BAY_BAND = [660, 318, 970, 435];      // the reveal's own glass band
const SASH_HOT_MAX = 60;       // px of pane still lit hot: 1874 before, 0 after
const BAY_FIRE_MIN = 500;      // px of plume in the reveal's band: 126 -> 1646
const PLUME_ROW_MIN = 300;     // the opaque plume's lowest row: 265 -> 330
/* [F14] the closing image is HER, painted, and legible. Both pairs below were
   measured by running THIS LAP against both states of the file — the mannequin
   sitter and the painted one — in the head box the assertion uses:
       bytes   pale 0.184 / sd 50.7   ->   0.376 / 70.1
       frame   pale 0.165 / sd 49.9   ->   0.345 / 69.4
   and the floors sit between the two pairs, so the assertion fails on the
   portrait the review filed. (It was checked: it does — see the lane's
   negative run, shots/lane-cf-negative.) */
const PORTRAIT_HEAD = [650, 140, 120, 130]; // in the inset's own 1408x768
const PORTRAIT_PALE_MIN = 0.28, PORTRAIT_SD_MIN = 62;    // on the bytes
const FRAME_PALE_MIN = 0.25, FRAME_SD_MIN = 58;          // in the frame

/* ---- pixel helpers, on a decoded frame -------------------------------- */
const pxAt = (f, x, y) => {
  const ch = f.channels || 4;
  const i = (y * f.width + x) * ch;
  return ch === 1 ? [f.data[i], f.data[i], f.data[i]]
                  : [f.data[i], f.data[i + 1], f.data[i + 2]];
};
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
function lumaStats(f, r) {
  let n = 0, sum = 0, max = 0;
  const x1 = Math.max(0, Math.round(r.x)), y1 = Math.max(0, Math.round(r.y));
  const x2 = Math.min(f.width, Math.round(r.x + r.w));
  const y2 = Math.min(f.height, Math.round(r.y + r.h));
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const l = lum(pxAt(f, x, y));
    sum += l; n++; if (l > max) max = l;
  }
  return { mean: +(sum / Math.max(1, n)).toFixed(2), max: +max.toFixed(1), n };
}
/** Watson's coat: the one green in the room plate. */
function coatPx(f, r) {
  if (!f) return { n: null, tot: 0 };
  let n = 0, tot = 0;
  const x1 = Math.max(0, Math.round(r.x)), y1 = Math.max(0, Math.round(r.y));
  const x2 = Math.min(f.width, Math.round(r.x + r.w));
  const y2 = Math.min(f.height, Math.round(r.y + r.h));
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const [R, G, B] = pxAt(f, x, y);
    tot++;
    if (G > R + 5 && G > B + 5 && R + G + B > 90) n++;
  }
  return { n, tot };
}
/** [F3] the halo around a cut-out, measured LOCALLY off the shipped PNG:
 *  how much brighter is each partial pixel than the body it touches. */
function haloOf(img) {
  const { width: w, height: h, channels: ch, data } = img;
  if (ch !== 4) return null;
  const A = (x, y) => data[(y * w + x) * 4 + 3];
  const L = (x, y) => lum(pxAt(img, x, y));
  let sum = 0, n = 0, hot = 0, core = 0;
  const lumas = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const a = A(x, y);
    if (a >= 250) { core++; const l = L(x, y); lumas.push(l); if (l > 200) hot++; continue; }
    if (a <= 16) continue;
    let acc = 0, k = 0;
    for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      if (A(x + dx, y + dy) >= 250) { acc += L(x + dx, y + dy); k++; }
    }
    if (!k) continue;
    sum += L(x, y) - acc / k; n++;
  }
  lumas.sort((a, b) => a - b);
  return { halo: +(sum / Math.max(1, n)).toFixed(2), haloPx: n, corePx: core, hot,
           p95: +(lumas[Math.floor(lumas.length * 0.95)] || 0).toFixed(1) };
}
/** [F11] the cameo card, measured inside the CIRCLE the reader sees of it. */
function cameoStats(img) {
  const { width: w, height: h } = img;
  const r = h / 2, cx = w / 2, cy = h / 2;
  let n = 0, gown = 0, hueSum = 0, green = 0, skin = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    n++;
    const [R, G, B] = pxAt(img, x, y);
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
    const s = mx ? d / mx : 0;
    let hh = 0;
    if (d > 0) {
      hh = mx === R ? (((G - B) / d) % 6 + 6) % 6
         : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
      hh *= 60;
    }
    if (hh >= 280 && hh <= 325 && s >= 0.22 && mx >= 26) { gown++; hueSum += hh; }
    if (G > R + 5 && G > B + 5 && R + G + B > 90) green++;
    if (R > G + 15 && Math.abs(G - B) < 16 && R >= 110 && R <= 235) skin++;
  }
  return { gownPct: +(100 * gown / n).toFixed(2),
           gownHue: gown ? +(hueSum / gown).toFixed(1) : null,
           greenPct: +(100 * green / n).toFixed(2),
           skinPct: +(100 * skin / n).toFixed(2) };
}

/* the frame the report shows for each beat */
const KEY_SHOTS = {
  // Beat I — unchanged from the beat's own lap
  head: '01-00-head', post: '01-01-post', undated: '01-02-note-plate',
  note2: '01-04-note2', hold: '01-05-hold-gate', wmark: '01-06-watermark',
  gaz2: '01-08-gazetteer', comes2: '01-10-carriage', hadnote: '01-11-king-enters',
  seat: '01-12-three-shot', ormstein: '01-14-ormstein', condescend: '01-15-mask-gate',
  iamking: '01-16-unmasked', lookup: '01-19-index-gate', letmesee: '01-20-irene',
  both: '01-24-both-photo', five: '01-27-five', briony: '01-35-exit',
  goodnight: '01-36-goodnight', door: '01-37-door-gate',
  // II
  head2: '02-00-head', lodge: '02-01-lodge', following: '02-02-following',
  // III
  head3: '03-00-head', hansom: '03-01-hansom', watch: '03-03-watch',
  devil: '03-04-devil', landau: '03-05-landau-seg', shotout: '03-06-shotout',
  toogood: '03-08-cab-gate', shabby: '03-09-pursuit-rolling',
  twentyfive: '03-11-twentyfive',
  // IV
  head4: '04-00-head', notasoul: '04-02-notasoul', lounged: '04-03-lounge-seg',
  facedround: '04-04-run-seg', thankgod: '04-05-norton-cameo',
  comeman: '04-07-norton-gate', halfdragged: '04-08-drag-seg',
  tyingup: '04-09-ring', preposterous: '04-10-ring-held',
  /* the knot lens with all four at rest and the ring plate down again — the
     frame [F4]'s one register and [F5]'s chancel marks are both plainest in,
     and the only Beat IV unit at rest that had no shot of its own */
  license: '04-11-license',
  sovereigngift: '04-12-sovereign', unexpected: '04-13-unexpected',
  parkatfive: '04-16-parkatfive',
  // V
  plan1: '05-00-plan1', signal: '05-03-rocket-plate', rocket: '05-04-rocket',
  neutral: '05-05-station-gate',
  // VI
  head6: '06-00-head', instinct1: '06-01-instinct1', instinct2: '06-02-window-gate',
  panel: '06-03-panel', glimpse: '06-04-THE-REVEAL', knowwhere: '06-05-knowwhere',
  howfind: '06-06-howfind', showed: '06-07-showed',
  // VII
  head7: '07-00-head', letter1: '07-01-letter1', flight2: '07-04-flight2',
  indebted: '07-05-indebted', valuemore: '07-06-plate-irene',
  thisphoto: '07-08-thisphoto', beaten: '07-09-beaten', thewoman: '07-10-thewoman',
};

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f));
  const srv = BASE ? { close() {} } : await serve(SITE, PORT);
  const URL_ = BASE ? BASE.replace(/\/$/, '') + '/?harness=1'
                    : `http://127.0.0.1:${PORT}/?harness=1`;
  const browser = await chromium.launch({ headless: args.indexOf('--headed') < 0 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
                                       deviceScaleFactor: 2 });
  /* --throttle KBPS reads the book down a thin pipe. Every "is it there yet"
     bug in this stack is invisible on localhost and invisible on a fast line;
     it is the slow line that tells the truth about what the page waits for. */
  const KBPS = +argv('--throttle', 0);
  if (KBPS) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 120,
      downloadThroughput: (KBPS * 1024) / 8, uploadThroughput: (KBPS * 1024) / 8,
    });
    note(`throttled to ${KBPS} kbps, 120 ms latency`);
  }
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => consoleErrors.push('requestfailed: ' + r.url()));

  const t0 = Date.now();
  /* a throttled read has to be allowed to take as long as a throttled read
     takes: the point of the thin pipe is to measure the wait, not to trip on it */
  const BOOT_MS = KBPS ? 180000 : 30000;
  await page.goto(URL_, { waitUntil: 'load', timeout: BOOT_MS });
  await page.waitForFunction(() => window.__ready === true, { timeout: BOOT_MS });
  const readyAt = await page.evaluate(() => performance.now());
  note(`reading ${URL_}`);
  await page.evaluate(() => window.__mute(true));
  note(`booted in ${Date.now() - t0} ms (leaf 1 only — the other three SETS are lazy)`);

  const frames = {};                       // name -> decoded frame, for pixel work
  const bandOf = {};                       // name -> the frame's dead-band metric
  const dwellAtShot = {};                  // unit key -> its unitT when shot
  const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
  const st = () => page.evaluate(() => window.__state());
  /** the plate panel, in SCREENSHOT px (dpr 2) */
  const stageBox = () => page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
  });
  /** a plate rect, in SCREENSHOT px, at the camera as it stands NOW */
  const plateBox = async (rect) => (await page.evaluate(() => window.__renderNow()),
    page.evaluate((r) => {
      const s = window.__refs.stage;
      const a = s.toScreen(r[0], r[1]), b = s.toScreen(r[0] + r[2], r[1] + r[3]);
      return { x: a.x * 2, y: a.y * 2, w: (b.x - a.x) * 2, h: (b.y - a.y) * 2 };
    }, rect));

  /* NOTHING IS SHOT UNDER A RAISED COVER — [F10].
   *
   * `07-00-head` came back BLACK (max luma 19 where every other heading peaks
   * 246-254) and was filed as a dead leaf-6 mount. It was not: the Beat VI clock
   * hands the page over at t+19.8 and the marks loop shot the new heading 0.8 s
   * later, which is 0.25 s before the cover finishes falling. The picture was
   * fine and the harness was photographing the cover. A shot is the reader's
   * frame or it is nothing, so shot() now waits the cover out — and the heading
   * gate below measures what it gets. */
  const shot = async (name, { waitCover = false } = {}) => {
    /* `waitCover` is opt-in and used by exactly one caller — the Beat VI clock,
       whose marks land at fixed times and which therefore photographed the Beat
       VII heading 0.25 s before the cover had finished falling. Waiting the cover
       out UNCONDITIONALLY was worse: on `twentyfive` the wait's latched click has
       already started the turn, so a shot that waits it out spends the next
       leaf's first heading's whole dwell and the read loop never sees the unit at
       all (three units went missing). */
    for (let i = 0; i < 24 && waitCover; i++) {
      const s = await st();
      if (!s.turn.active) break;
      await T(0.12);
    }
    await page.evaluate(() => window.__renderNow());
    const buf = await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    try {
      frames[name] = decodePng(buf);
      const box = await stageBox();
      const s = await st();
      const b = edgeBands(frames[name], box);
      bandOf[name] = { ...b, dim: s.stage.plate.dim, blank: s.blankLeaf,
                       unit: s.unit && s.unit.key, set: s.set };
      /* HOW MUCH OF THIS UNIT'S DWELL WAS ALREADY GONE when the reader could
         first see it — the other half of [F10]. */
      if (s.unit) dwellAtShot[s.unit.key] = s.unitT;
    } catch (_) { /* stats are a bonus */ }
    return path.join(SHOTS, name + '.png');
  };
  const imgCount = () => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name)).length);

  /* ---- THE CHURCH + FINALE LANE'S PIXEL PROBES ------------------------ *
   * All three read the SHIPPED bitmaps through the page, which means they read
   * whatever the reader was served: with --base they measure the deployed
   * bytes, not the working tree. Each caches its decodes on window. */
  /** [F5] the plate's floor classes under a mark, and how much of a figure the
   *  pew cut swallows above it. Same HSV boundaries as church_geom.py. */
  const churchFloor = (marks, files) => page.evaluate(async ({ ms, f }) => {
    const cv = async (src) => {
      window.__px = window.__px || {};
      if (window.__px[src]) return window.__px[src];
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      return (window.__px[src] = { w: c.width, h: c.height, d: d.data });
    };
    const P = await cv(f.plate), C = await cv(f.cut);
    const isFloor = (r, gg, b) => {
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx;
      const s = mx === 0 ? 0 : (255 * (mx - mn)) / mx;
      let h = 0;
      if (mx !== mn) {
        const dd = mx - mn;
        h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
        h = ((h * 60 + 360) % 360) * (255 / 360);
      }
      if (((h < 14) || (h > 242)) && s > 100 && v > 38 && v < 195) return true;   // carpet
      return s < 86 && v > 78 && v < 232;                                         // stone
    };
    const out = {};
    for (const [name, xy] of Object.entries(ms)) {
      const x = Math.round(xy[0]), y = Math.round(xy[1]);
      let n = 0, hit = 0;
      for (let yy = y - 5; yy <= y + 5; yy++) for (let xx = x - 5; xx <= x + 5; xx++) {
        if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h) continue;
        const i = (yy * P.w + xx) * 4;
        n++; if (isFloor(P.d[i], P.d[i + 1], P.d[i + 2])) hit++;
      }
      /* the occluder is placed at f.box in plate px and drawn at its own size,
         so plate -> layer is a straight translate */
      const lx = x - f.box[0], ly = y - f.box[1];
      let sink = 0;
      const A = (xx, yy) => C.d[(yy * C.w + xx) * 4 + 3];
      if (lx >= 0 && ly >= 0 && lx < C.w && ly < C.h && A(lx, ly) > 16) {
        let t = ly;
        while (t - 1 >= 0 && A(lx, t - 1) > 16) t--;
        sink = ly - t + 1;
      }
      out[name] = { xy: [x, y], floorFrac: +(hit / Math.max(1, n)).toFixed(3), sink };
    }
    return out;
  }, { ms: marks, f: files });

  /** [F5] EVERY SOLE COLUMN, at the box the DOM actually drew this cut in.
   *  `art` is the live participant's own drawn box (left/top/width/height in
   *  plate px, straight off node.style) plus the cell it is showing, so the
   *  probe never re-derives the staging it is auditing. For each column of the
   *  cut's footwear block it walks to that column's own last painted row, maps
   *  it into the plate, and classifies what is under it: hidden by BOTH pew cuts,
   *  standing on pew furniture, or over floor. `onPew` is the number the law is
   *  stated in. Mirrors tools/lanecf/sole_span.py exactly. */
  const soleSpan = (art, files) => page.evaluate(async ({ a, f, band }) => {
    const cv = async (src) => {
      window.__px = window.__px || {};
      if (window.__px[src]) return window.__px[src];
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      return (window.__px[src] = { w: c.width, h: c.height, d: d.data });
    };
    const P = await cv(f.plate), C = await cv(f.cut);
    /* the ring copy is optional only in the sense that a set without one is
       still testable; when it exists a foot must be hidden in BOTH or the
       marriage floats for the units the ring plate is up — which is fact M.4 */
    const R = f.cutRing ? await cv(f.cutRing) : null;
    /* PEW FURNITURE, on the plate's own pixels: the one dark violet mass here.
       Classified on the BASE plate for every variant on purpose — the ring plate
       is a candlelight lift, so the same furniture reads brighter there and a
       per-variant classifier would quietly stop finding it. */
    const isPew = (i) => {
      const r = P.d[i], g = P.d[i + 1], b = P.d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx >= 80) return false;
      if (mx === mn) return false;                    // hue 240 by convention, but
      const dd = mx - mn;                             // an achromatic near-black is
      let h = mx === r ? ((g - b) / dd) % 6           // shadow, not furniture
            : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h = (h * 60 + 360) % 360;
      return h > 200 && h < 310;
    };
    /* the cut's per-column last painted row, cached per file+cell */
    const key = a.file + '#' + a.cell;
    window.__ss = window.__ss || {};
    if (!window.__ss[key]) {
      const im = new Image(); im.src = 'assets/' + a.file; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const x0 = a.cell * a.cellW, bot = [];
      for (let x = 0; x < a.cellW; x++) {
        let b = -1;
        for (let y = a.cellH - 1; y >= 0 && b < 0; y--) {
          if (d[((y * c.width) + x0 + x) * 4 + 3] > 16) b = y;
        }
        bot.push(b);
      }
      window.__ss[key] = bot;
    }
    const bot = window.__ss[key];
    const lowest = Math.max(...bot);
    const ground = lowest - band;
    const k = a.height / a.cellH;
    const out = { n: 0, floor: 0, hidden: 0, onPew: 0, pewX: [], cell: a.cell };
    const alpha = (I, xx, yy) => (xx >= 0 && yy >= 0 && xx < I.w && yy < I.h
                                  ? I.d[((yy * I.w) + xx) * 4 + 3] : 0);
    for (let c = 0; c < a.cellW; c++) {
      if (bot[c] < ground) continue;                  // not a ground-contact column
      const px = Math.round(a.left + c * k);
      const py = Math.round(a.top + bot[c] * k);
      if (px < 0 || py < 0 || px >= P.w || py >= P.h) continue;
      out.n++;
      const lx = px - f.box[0], ly = py - f.box[1];
      const hid = alpha(C, lx, ly) > 16 && (!R || alpha(R, lx, ly) > 16);
      /* one row of slack: a sole's own antialiased edge is a row wide, so the
         pixel that carries the contact can be either of two rows */
      const onPew = isPew(((py * P.w) + px) * 4) &&
                    isPew((((py + 1) * P.w) + px) * 4);
      if (hid) out.hidden++;
      else if (onPew) { out.onPew++; out.pewX.push([px, py]); }
      else out.floor++;
    }
    out.supported = +((out.n - out.onPew) / Math.max(1, out.n)).toFixed(3);
    return out;
  }, { a: art, f: files, band: SOLE_BAND });

  /** [F5] WHAT IS UNDER THE SOLE IN THE FRAME THE READER GETS — the composite,
   *  not the plate. Every probe above reads the bitmaps ONE AT A TIME, and that
   *  is how a floating boot lived through two gates asserting F5: the witness's
   *  altar mark is honest chancel stone (floorFrac 0.893, every sole column over
   *  painted floor) and the BRIDE stands 23 plate px nearer the camera with her
   *  gown over that stone, so what his boots were actually resting on was her
   *  skirt — 43 of 80 columns, in the 3.2x lens the ring unit dwells on.
   *
   *  So the whole stack is composited the way the DOM paints it — plate, the
   *  actor group in its own `z` order, the pew cuts over the top — and for each
   *  sole column the TOPMOST layer at the pixel under the sole is named:
   *    pew    the foreground cut hides the sole. Legal: it is what the plate's own
   *           painted figures did at this line.
   *    floor  the plate, painting carpet or stone. Legal.
   *    actor  another participant's cut. A DEPTH ERROR — the figure with the lower
   *           mark is nearer and has to be painted in front — and to the reader it
   *           is a boot standing on a person.
   *    void   the plate, painting neither: pew face, step shadow, riser. The
   *           review's F5 in its original form.
   *  Raw counterpart: tools/lanecf/sole_composite.py. */
  const soleComposite = (cast, files) => page.evaluate(async ({ cs, f, band }) => {
    const cv = async (src) => {
      window.__px = window.__px || {};
      if (window.__px[src]) return window.__px[src];
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      return (window.__px[src] = { w: c.width, h: c.height, d: d.data });
    };
    const P = await cv(f.plate), C = await cv(f.cut);
    const R = f.cutRing ? await cv(f.cutRing) : null;
    /* THE VISIBLE SOLE IS TESTED AGAINST THE DEFECT, NOT THE REMEDY — the same
       decision tools/lanecf/sole_span.py made and for the same reason. Floor here
       is more materials than any classifier knows: the aisle's own boards read
       hue 23 / sat 143 / value 132 (neither carpet nor stone) and the runner's
       shadowed edge reads hue 341.5 where the carpet rule wants 342, so a test
       for "is this floor" rejects boots standing on painted floorboards. Pew
       furniture is the one unambiguous mass in this plate — the only dark violet
       (value < 80, hue 200..310) against stone at 89..118 and boards at 132. */
    const isPew = (i) => {
      const r = P.d[i], g = P.d[i + 1], b = P.d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx >= 80 || mx === mn) return false;
      const dd = mx - mn;
      let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h = (h * 60 + 360) % 360;
      return h > 200 && h < 310;
    };
    /* every participant's cut, decoded once, with the box the DOM drew it in */
    const L = [];
    for (const c of cs) {
      L.push({ who: c.who, z: c.art.z, a: c.art, im: await cv('assets/' + c.art.file) });
    }
    L.sort((x, y) => y.z - x.z);                       // front to back
    const alphaOf = (l, px, py) => {
      const k = l.a.height / l.a.cellH;
      const col = Math.round((px - l.a.left) / k), row = Math.round((py - l.a.top) / k);
      if (col < 0 || row < 0 || col >= l.a.cellW || row >= l.a.cellH) return 0;
      return l.im.d[((row * l.im.w) + col) * 4 + 3];
    };
    const alpha = (I, xx, yy) => (xx >= 0 && yy >= 0 && xx < I.w && yy < I.h
                                  ? I.d[((yy * I.w) + xx) * 4 + 3] : 0);
    const out = {};
    for (const me of L) {
      const a = me.a;
      /* the cut's own per-column last painted row, cached */
      const key = a.file + '#0';
      window.__ss = window.__ss || {};
      if (!window.__ss[key]) {
        const bot = [];
        for (let x = 0; x < a.cellW; x++) {
          let b = -1;
          for (let y = a.cellH - 1; y >= 0 && b < 0; y--) {
            if (me.im.d[((y * me.im.w) + x) * 4 + 3] > 16) b = y;
          }
          bot.push(b);
        }
        window.__ss[key] = bot;
      }
      const bot = window.__ss[key];
      const ground = Math.max(...bot) - band;
      const k = a.height / a.cellH;
      const t = { who: me.who, file: a.file, z: me.z, n: 0, pew: 0, behind: 0,
                  floor: 0, actor: 0, onPew: 0, on: null };
      for (let c = 0; c < a.cellW; c++) {
        if (bot[c] < ground) continue;
        const px = Math.round(a.left + c * k);
        const py = Math.round(a.top + bot[c] * k);       // the SOLE pixel itself
        if (px < 0 || py + 1 < 0 || px >= P.w || py + 1 >= P.h) continue;
        t.n++;
        /* A SOLE IS LEGAL TWO WAYS, and they are different tests. It is HIDDEN if
           something NEARER covers the sole itself — the pew cut, or a participant
           painted in front of him, which is what a near figure does to a far one's
           feet and reads as standing behind her. */
        const lx = px - f.box[0], ly = py - f.box[1];
        if (alpha(C, lx, ly) > 16 && (!R || alpha(R, lx, ly) > 16)) { t.pew++; continue; }
        let front = null;
        for (const l of L) {                             // L is front to back
          if (l.z <= me.z) break;
          if (alphaOf(l, px, py) > 16) { front = l.who; break; }
        }
        if (front) { t.behind++; continue; }
        /* otherwise the sole is VISIBLE, and what is under it has to be floor */
        let hit = null;
        for (const l of L) {
          if (l.who === me.who) continue;
          if (alphaOf(l, px, py + 1) > 16) { hit = l.who; break; }
        }
        if (hit) { t.actor++; t.on = hit; continue; }
        /* one row of slack, as the sibling gate has: a sole's own antialiased
           edge is a row wide, so the pixel carrying the contact is either row */
        if (isPew((((py + 1) * P.w) + px) * 4) && isPew((((py + 2) * P.w) + px) * 4)) {
          t.onPew++; t.on = t.on || 'pew furniture';
        } else t.floor++;
      }
      out[me.who] = t;
    }
    return out;
  }, { cs: cast, f: files, band: SOLE_BAND });

  /** [F5] WHERE A CUT'S FEET REALLY ARE. The set declares a baseline row and
   *  `placeSprite` stands that row on the mark; this decodes the shipped cut and
   *  finds the last row it actually paints. The difference, scaled by the cut's
   *  own drawn height, is how far the actor's feet are off the mark in plate px.
   *  Every cell of a walk strip is measured — a strip whose frames disagree
   *  bobs, which is the same defect moving. */
  const feetLine = (art) => page.evaluate(async (a) => {
    window.__fl = window.__fl || {};
    if (!window.__fl[a.file]) {
      const im = new Image(); im.src = 'assets/' + a.file; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const rows = [];
      for (let f = 0; f < (a.frames || 1); f++) {
        const x0 = f * a.cellW;
        let bot = -1;
        for (let y = a.cellH - 1; y >= 0 && bot < 0; y--) {
          for (let x = x0; x < x0 + a.cellW; x++) {
            if (d[(y * c.width + x) * 4 + 3] > 16) { bot = y; break; }
          }
        }
        rows.push(bot);
      }
      window.__fl[a.file] = rows;
    }
    const rows = window.__fl[a.file];
    /* the mark is `top + baseline * k`; the feet are `top + alphaBottom * k`,
       so the error is just the row difference at the cut's drawn scale. The
       WORST cell is the one that has to pass. */
    const k = a.height / a.cellH;
    let worst = 0;
    for (const r of rows) if (Math.abs((r - a.baseline) * k) > Math.abs(worst)) {
      worst = (r - a.baseline) * k;
    }
    return { alphaBottom: rows.length === 1 ? rows[0] : rows,
             plateErr: +worst.toFixed(2) };
  }, art);

  /** [F4] bright desaturated CLOTH inside the plate's own painted-figure boxes:
   *  the signature of a baked mannequin. Zero of it is the register test. */
  const clothProbe = (boxes, file) => page.evaluate(async ({ bs, src, at }) => {
    const im = new Image(); im.src = 'assets/' + src; await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const out = {};
    for (const [k, b] of Object.entries(bs)) {
      /* the figure boxes are in PLATE px; a cut like altar.png is a small bitmap
         placed at `at`, so intersect in plate space and read through its offset.
         Transparent pixels are not the plate's paint and do not count either
         way — a box a cut does not cover at all reports null, not zero, so a
         missing overlap can never read as a pass. */
      const x0 = Math.max(b[0], at[0]), x1 = Math.min(b[2], at[0] + c.width);
      const y0 = Math.max(b[1], at[1]), y1 = Math.min(b[3], at[1] + c.height);
      if (x1 <= x0 || y1 <= y0) { out[k] = null; continue; }
      let n = 0, cloth = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = ((y - at[1]) * c.width + (x - at[0])) * 4;
        if (d[i + 3] < 8) continue;
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const s = mx ? (mx - mn) / mx : 0;
        n++; if (l > 140 && s < 0.30) cloth++;
      }
      out[k] = n < 64 ? null : +((100 * cloth) / n).toFixed(2);
    }
    return out;
  }, { bs: boxes, src: file, at: CLOTH_AT[file] || [0, 0] });

  /** [F13] WHERE THE FIRE IS, on the shipped plates, with plume_floor.py's own
   *  two measures — because "differs" is not the test: the moved plume drifts
   *  ACROSS the first-floor window by design, so the question there is whether
   *  that pane is still LIT HOT (bright and warm, the plate's own signature of
   *  fire behind glass), and the question at the bay is whether the smoke plate
   *  gained signal in the reveal's own glass band at all. */
  const fireProbe = (sash, band) => page.evaluate(async ({ s, b }) => {
    const grab = async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
    };
    const A = await grab('assets/set/street/street-window.jpg');
    const B = await grab('assets/set/street/street-smoke.jpg');
    /* the biggest channel difference between the two states: the fire, and
       nothing else — the plates are the same painting everywhere else */
    const delta = (x, y) => {
      const i = (y * A.w + x) * 4;
      return Math.max(Math.abs(B.d[i] - A.d[i]), Math.abs(B.d[i + 1] - A.d[i + 1]),
                      Math.abs(B.d[i + 2] - A.d[i + 2]));
    };
    /* A PANE LIT HOT, in the smoke plate itself: bright and warm */
    let hot = 0;
    for (let y = s[1]; y < s[3]; y++) for (let x = s[0]; x < s[2]; x++) {
      const i = (y * B.w + x) * 4;
      const l = 0.2126 * B.d[i] + 0.7152 * B.d[i + 1] + 0.0722 * B.d[i + 2];
      if (l > 170 && B.d[i] > B.d[i + 2] + 30) hot++;
    }
    let bay = 0;
    for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
      if (delta(x, y) > 18) bay++;
    }
    /* and how far DOWN the opaque smoke reaches (delta 96 is plume_floor.py's
       own opacity threshold K) — the storey the plume issues from */
    let lowest = -1;
    for (let y = 0; y < Math.min(A.h, 520); y++) {
      for (let x = 620; x < 1010; x++) if (delta(x, y) > 96) { lowest = y; break; }
    }
    return { sashHot: hot, bayFire: bay, plumeLowestRow: lowest };
  }, { s: sash, b: band });

  /** [F14] the raised inset card, its sitter's HEAD BOX in device px, and the
   *  same box measured on the shipped bytes. It has to be asked while the plate
   *  is up: the finale portrait is raised by `valuemore`'s act four units
   *  earlier and simply stays up, so a jump straight to `thewoman` finds no
   *  card — which is the difference between measuring the carrier and measuring
   *  a shortcut. */
  const portraitProbe = (head) => page.evaluate(async (h) => {
    const card = [...document.querySelectorAll('#stage .inset')]
      .find((c) => +getComputedStyle(c).opacity > 0.5);
    const im = card && card.querySelector('img');
    if (!im) return null;
    const r = im.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    /* object-fit: contain letterboxes, so the content rect is DERIVED — getting
       this wrong measures the mount instead of the face */
    const nw = im.naturalWidth || 1408, nh = im.naturalHeight || 768;
    const sc = Math.min(r.width / nw, r.height / nh);
    const ox = r.x + (r.width - nw * sc) / 2, oy = r.y + (r.height - nh * sc) / 2;
    const box = { x: +((ox + h[0] * sc) * dpr).toFixed(1),
                  y: +((oy + h[1] * sc) * dpr).toFixed(1),
                  w: +(h[2] * sc * dpr).toFixed(1), h: +(h[3] * sc * dpr).toFixed(1) };
    const img = new Image(); img.src = im.getAttribute('src'); await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(h[0], h[1], h[2], h[3]).data;
    let n = 0, pale = 0, sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++; sum += l; sq += l * l; if (l > 120) pale++;
    }
    const mean = sum / n;
    return { src: im.getAttribute('src'), op: +getComputedStyle(card).opacity, box,
             bytes: { pale: +(pale / n).toFixed(3), mean: +mean.toFixed(1),
                      sd: +Math.sqrt(sq / n - mean * mean).toFixed(1) } };
  }, head);

  /** THE LATCH LAW (sec 2.3), probed while the unit is still blocked: the click
   *  must not page past the wait, and it must not be thrown away either. */
  const latchProbe = async (u) => {
    const s0 = await st();
    if (!s0.blocked) return;
    const before = s0.i;
    await page.evaluate(() => window.__click());
    const held = await st();
    if (held.i !== before) {
      bad(`${u.key}: paged past its ${s0.blocked} without waiting`);
    } else if (!held.latch) {
      bad(`${u.key}: the click inside its ${s0.blocked} window was LOST, not latched`);
    } else if (!latchProof) {
      latchProof = { unit: u.key, blocked: s0.blocked, latchedAt: held.t };
    }
  };

  /** [F10] the heading gate: the SET behind it is a painting, and its own type
   *  is legible. Called for every one of the six headings, from wherever the
   *  book happens to arrive at it. */
  const checkHeading = async (u, s, { newLeaf = true } = {}) => {
    const box = await stageBox();
    const hl = await page.evaluate(() => {
      const p = document.querySelector('.blk.head p');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
    });
    const cover = await page.evaluate(() =>
      +getComputedStyle(document.getElementById('cover')).opacity);
    const f = frames[KEY_SHOTS[u.key]];
    const plate = f ? lumaStats(f, box) : null;
    const type = f && hl ? lumaStats(f, hl) : null;
    heads.push({ key: u.key, set: s.set, cover, plate, type });
    if (cover > 0.02) {
      bad(`${u.key}: the heading was captured under a cover at opacity ${cover}`);
    }
    if (!plate || !(plate.mean >= HEAD_PLATE_MIN)) {
      bad(`${u.key}: the set behind the heading is unlit — plate mean luma ` +
          `${plate && plate.mean} (floor ${HEAD_PLATE_MIN}; the other heads run 27-52)`);
    }
    if (!type || !(type.max >= HEAD_TYPE_MIN)) {
      bad(`${u.key}: the heading itself is not legible — its brightest pixel is ` +
          `${type && type.max} (floor ${HEAD_TYPE_MIN})`);
    }
    /* AND IT GETS ITS WHOLE DWELL. A heading entered under a raised cover used to
       burn the cover's 0.72 s fade out of its own 3.4 s before the reader could
       see anything — a quarter of the frame, and on the Beat VII heading (handed
       over by the Beat VI clock at t+19.8) it is why the review saw 3.4 s of
       nothing. main.js now stops the unit's clock while the cover is up, and this
       is the number that says so: how much of the dwell was already spent at the
       first frame the reader could see. */
    const spent = dwellAtShot[u.key];
    heads[heads.length - 1].dwellSpent = spent;
    heads[heads.length - 1].newLeaf = newLeaf;
    if (newLeaf && !(spent <= HEAD_DWELL_MAX)) {
      bad(`${u.key}: ${spent}s of its dwell was already gone by the first frame ` +
          `the reader could see (limit ${HEAD_DWELL_MAX}s — a unit must not age ` +
          `under the cover)`);
    }
  };

  /* ---- 0. shape ------------------------------------------------------- */
  const units = await page.evaluate(() => window.__units());
  const beats = await page.evaluate(() => window.__beats());
  const law = contentUnits();
  if (units.length !== 95) bad(`unit count ${units.length}, the book is 95`);
  if (law.length !== 95) bad(`the two CONTENT files parsed ${law.length} rows, expected 95`);
  let textMismatch = 0, checked = 0;
  units.forEach((u, i) => {
    const L = law[i];
    if (!L) return;
    if (u.key !== L.key) bad(`#${i} key '${u.key}' != law '${L.key}'`);
    const wantPrefix = L.prefix === '—' ? '' : L.prefix;
    if ((u.speaker || '') !== wantPrefix) {
      bad(`#${i} ${u.key}: prefix '${u.speaker}' != law '${wantPrefix}'`);
    }
    // headings carry a display title, not a quotation; the wordless gate is blank
    if (L.head || u.key === 'head' || u.key === 'door') return;
    checked++;
    if (norm(u.text) !== norm(L.text)) {
      textMismatch++;
      bad(`#${i} ${u.key} TEXT DRIFT\n    app: ${norm(u.text)}\n    law: ${norm(L.text)}`);
    }
  });
  if (!textMismatch) note(`verbatim: ${checked}/${checked} spoken units match the law exactly`);

  // the ledger's own beat table, asserted against the app's
  const LEDGER = [[1, 'I', 'room', 1, 38], [2, 'II', 'street', 2, 3], [3, 'III', 'chase', 3, 12],
    [4, 'IV', 'church', 4, 17], [5, '', 'street', 5, 6], [6, 'V', 'street', 5, 8],
    [7, 'VI', 'room', 6, 11]];
  LEDGER.forEach(([n, num, set, leaf, count]) => {
    const b = beats[n - 1];
    if (!b || b.num !== num || b.set !== set || b.leaf !== leaf || b.units !== count) {
      bad(`beat ${n}: app says ${JSON.stringify(b)}, ledger says ${num}/${set}/leaf ${leaf}/${count}`);
    }
  });
  note('the beat table matches CONTENT-full.md 6.1 (beat 6 prints V, beat 7 prints VI, ' +
       'and beats 5 and 6 share leaf 5)');

  /* ---- 1. the read ---------------------------------------------------- */
  const seen = [];
  const beatsSeen = {};
  const gates = [];
  const turns = [];
  const leafBytes = [];
  let kingPainted = null;
  let lastId = null, page_ = 1, leafImgs = await imgCount();
  let latchProof = null, ruse = null;
  /* the ROOM + STREET + HEADS lane's evidence, collected as the read goes past */
  const heads = [], chairs = [];
  /* the CHURCH + FINALE lane's evidence, collected the same way */
  const churchFeet = [], churchLens = [], churchCast = {};
  /* the two ledgers this round added: where each cut's own alpha really ends
     relative to its mark [F5], and how much of the altar's cast the lens cuts
     off once the witness is standing on the altar mark [F4] */
  const churchFeetLine = [], churchFrame = [];
  /* and the two this round's F5 needed after both of those passed a floating
     boot: what every SOLE COLUMN of every standing cut is standing on, first
     against the plate and then against the whole composited stack */
  const churchSole = [], churchComposite = [];
  let sovereign = null, reveal = null, fire = null, portrait = null, cloth = null;
  const clothAll = {};        // per-plate cloth ledger, one entry per CLOTH_PLATES
  let arrival = null, lodge = null;
  let guard = 0;
  /* A DECODE WAIT IS MEASURED IN THE READER'S SECONDS, NOT THE HARNESS'S.
     `state.turn.waited` is the app's own diagnostic: the sim dt that was pumped
     and then SUBTRACTED OUT of story time while the leaf's bytes were in
     flight (main.js `S.stall`). Its size is a property of how fast the harness
     pumps, not of how long the reader waited — on localhost bytes are there
     instantly so it stays ~0, and off the real wire the same correct behaviour
     counts to 14. Asserting on it measured the harness. What the reader
     actually experiences is WALL time, so that is what has a budget here, and
     it is charged once per turn instead of once per poll. */
  const TURN_WALL_BUDGET = +argv('--turn-budget', 25);
  let turnWall0 = 0, turnCharged = false, turnGuard = 0;
  while (guard < 420) {
    const s = await st();
    if (s.end.active || s.finished) break;
    const u = s.unit;
    if (!u) break;

    /* A PAGE TURN IS TIME, NOT A CLICK. The cover holds up until the incoming
       SET is decoded, so the reader's next click cannot be what carries the
       turn — only the clock can. (Beat I never showed this: its one turn was
       the last thing that happened.) */
    if (s.turn.active) {
      /* the turn's own polling must not eat the READ's budget: a slow line
         turned 420 units of patience into 420 units of waiting, and the read
         died on leaf 1 with the book behaving perfectly. */
      /* name the DESTINATION leaf: `state.page` is still the outgoing one until
         the cover swaps, so reading it called the first turn "to page 1" */
      const toPage = (units[s.turn.to] && units[s.turn.to].page) || s.page + 1;
      if (turnGuard++ > 4000) { bad(`the turn to page ${toPage} never completed`); break; }
      if (!turnWall0) { turnWall0 = Date.now(); turnCharged = false; }
      const wall = (Date.now() - turnWall0) / 1000;
      if (wall > TURN_WALL_BUDGET && !turnCharged) {
        turnCharged = true;
        bad(`the turn to page ${toPage} kept the reader under the cover for ` +
            `${wall.toFixed(1)}s of WALL time (budget ${TURN_WALL_BUDGET}s, ` +
            `story time correctly did not age: stall=${s.stall}s)`);
      }
      await T(0.4);
      continue;
    }
    if (turnWall0) {
      note(`the turn to page ${s.page} held the cover ` +
           `${((Date.now() - turnWall0) / 1000).toFixed(1)}s of wall time`);
      turnWall0 = 0;
    }
    guard++;

    if (u.id !== lastId) {
      seen.push(u.key);
      beatsSeen[u.beat] = (beatsSeen[u.beat] || 0) + 1;
      lastId = u.id;
      /* NOTHING ARRIVES WHILE A LEAF IS BEING READ. A set is decoded under the
         cover of the page turn that mounts it, so the count of image resources
         must not move between the first unit of a leaf and its last. */
      if (u.page !== page_) {
        const now = await imgCount();
        turns.push({ toPage: u.page, set: s.set, fetched: now - leafImgs });
        leafBytes.push({ leaf: page_, fetchedDuringRead: 0 });
        page_ = u.page; leafImgs = now;
      }
      // a beat of dwell so the picture settles into the unit's frame
      await T(u.verb === 'auto' ? 0.1 : 0.85);
      /* A UNIT WITH A `wait` IS NOT SETTLED UNTIL ITS WAIT IS. The lap shot 0.85 s
         into every unit, which for `sovereigngift` sampled the coin 19% along a
         4.5 s journey — still in the bride's hand, with the watch chain not yet
         on screen — and then the review, looking at that frame, correctly
         reported that fact M.6 had no carrier. The reader cannot advance until
         the wait resolves, so the frame the reader dwells on is the resolved one,
         and that is the frame the lap has to look at. */
      /* THE LATCH LAW IS NOT TESTED ON THE `wait` UNITS ANY MORE, and it cannot
         be: a latched click spends itself the instant the wait resolves, so a
         unit whose wait the harness has settled in order to photograph it has
         already moved on, and probing it first (which I tried) both double-
         advances the read past two church units and photographs `twentyfive`
         under the cover its own latched click raised. The law is still exercised
         every lap by the FOUR `segHold` units — they are blocked by their segment,
         which nothing here settles — and `latchProof` below asserts that at least
         one of them proved it. */
      if (u.wait) {
        for (let w = 0; w < 40; w++) {
          if (!(await st()).blocked) break;
          await T(0.25);
        }
        await T(0.2);
      }
      if (KEY_SHOTS[u.key]) beatsSeen['shot:' + u.key] = await shot(KEY_SHOTS[u.key]);

      /* ---- A FACT WITH NO PICTURE IS THE HOLE THIS LAP COULD NOT SEE ----
         `gaps` only fires on a FAILED FETCH, so a set that never asks for its
         principal art passed green: Beat III ran twelve units of THE PURSUIT
         with no vehicle in the picture and a gate whose cue said "click the
         cab" over bare cobbles. These are the assertions that make that
         impossible — every carrier the story names is checked ON SCREEN. */
      const q = await st();
      const sn = q.stage || {};
      if (sn.set === 'chase' && sn.rigs) {
        for (const [id, r] of Object.entries(sn.rigs)) {
          if (r.on && !r.body) bad(`${u.key}: rig '${id}' is on the strip at u=${r.u} with NO CARRIAGE DRAWN`);
        }
        if (u.target === 'cab' && !(sn.rigs.follow && sn.rigs.follow.body)) {
          bad(`${u.key}: the cab GATE is armed and its target has no picture`);
        }
      }
      if (sn.set === 'church' && sn.ringLens && u.focus === 'ring') {
        if (!sn.ringLens.ringIn) bad(`${u.key}: the ring is OUTSIDE the ring lens`);
        if (!(sn.ringLens.ringPx >= 18)) {
          bad(`${u.key}: the ring reads ${sn.ringLens.ringPx} px at k=${sn.ringLens.k} — not an image of a ring`);
        }
        if (sn.ringLens.voidPct > 8) {
          bad(`${u.key}: the ring lens spends ${sn.ringLens.voidPct}% of its width off the painting`);
        }
      }

      /* ======== THE CHURCH + FINALE LANE'S OWN GATES =================== *
       * F4 F5 F6 F7 here, in the frame the reader dwells on; F12 F13 F14 need
       * the whole read and are in section 9. The church ones run on EVERY
       * church unit, because round 1's defects were not in one frame — the
       * marriage was wrong for eleven of them.
       * ================================================================ */
      if (sn.set === 'church') {
        /* ---- [F4] ONE REGISTER: every participant is a CUT-OUT --------- *
         * The review's worst finding was a painted sprite standing beside three
         * faceless mannequins BAKED into the plate, with Norton rendered twice.
         * `cast` is read off the live DOM, so this fails the moment a
         * participant is not a cut-out on a mark — and the plate half of the
         * same law (nobody is painted into the chancel any more) is measured on
         * church.jpg's own pixels in section 9. */
        const cast = sn.cast || {};
        for (const who of ['bride', 'groom', 'clergyman', 'witness']) {
          if (!(cast[who] && cast[who].cutout)) {
            bad(`${u.key}: [F4] the ${who} is not a cut-out in this frame — ` +
                `the marriage is being played in two art registers`);
          }
        }
        churchCast[u.key] = Object.fromEntries(Object.entries(cast)
          .map(([k, v]) => [k, !!v.cutout]));

        /* ---- [F5] FEET ON FLOOR, OR FEET HIDDEN ----------------------- *
         * Probed against the SHIPPED plate and the SHIPPED pew cut at the marks
         * the set is standing people on THIS FRAME. floorFrac >= 0.60 or the
         * cut swallows the actor's own footwear block. This is the assertion
         * that catches a sole resting on a rail, which a floor line cannot. */
        const fl = sn.floor || {};
        if (fl.live && fl.pews) {
          const probe = await churchFloor(fl.live,
            { plate: fl.pews.plate, cut: fl.pews.cut, box: [fl.pews.x, fl.pews.y] });
          /* A WALKER IS NOT A MARK. The law is about where the book STANDS
             somebody: mid-stride the figure is between two marks, on a floor
             line the plate cannot see under its own pews, and asserting there
             would measure the interpolation instead of the staging. The two who
             walk are skipped while they walk, and the frames the review filed
             (04-07, 04-09, 04-12) are all frames at rest. */
          const walking = { witness: !!(sn.holmes && sn.holmes.walking),
                            groom: !!(sn.norton && sn.norton.walking) };
          for (const [who, r] of Object.entries(probe)) {
            if (walking[who]) continue;
            const need = (fl.footwear || {})[who] || 0;
            const ok = r.floorFrac >= FLOOR_FRAC_MIN || r.sink >= need;
            churchFeet.push({ unit: u.key, who, ...r, footwear: need, ok });
            if (!ok) {
              bad(`${u.key}: [F5] the ${who}'s feet are on neither — the plate ` +
                  `under (${r.xy[0]}, ${r.xy[1]}) is ${(r.floorFrac * 100).toFixed(0)}% ` +
                  `floor (needs ${FLOOR_FRAC_MIN * 100}%) and the pew swallows ` +
                  `${r.sink} px of a ${need} px footwear block`);
            }
          }

          /* ---- [F5] AND NO SOLE COLUMN STANDS ON A PEW --------------- *
           * The block above is an 11x11 patch at a POINT and it passed the
           * altar mark at floorFrac 0.893 while the witness's LEFT boot hung
           * over the front pew's end standard — a mark is a point, a stance is
           * 54 plate px wide, and the plate changes material between them. So
           * every ground-contact column of every standing cut is classified at
           * its own sole row, in the box the DOM actually drew, and the law is
           * zero: not one bare sole over furniture. This is the gate that
           * forced tools/lanecf/pew_end.py — the occluder was missing the one
           * piece of furniture the reader could see a boot floating on. */
          for (const who of ['bride', 'clergyman', 'groom', 'witness']) {
            const c = cast[who];
            if (!c || !c.art || c.walking) continue;   // a walker is not a mark
            const s = await soleSpan({ ...c.art, cell: 0 },
              { plate: fl.pews.plate, cut: fl.pews.cut, cutRing: fl.pews.cutRing,
                box: [fl.pews.x, fl.pews.y] });
            churchSole.push({ unit: u.key, who, file: c.art.file, ...s });
            if (!s.n) {
              bad(`${u.key}: [F5] the ${who}'s sole span could not be measured — ` +
                  `${c.art.file} has no ground-contact column in its drawn box`);
            } else if (s.onPew > SOLE_ONPEW_MAX) {
              const xs = s.pewX.map((p) => p[0]);
              bad(`${u.key}: [F5] the ${who} is standing on a pew — ${s.onPew} of ` +
                  `${s.n} sole columns of ${c.art.file} land on pew furniture the ` +
                  `occluder does not cover, at plate x ${Math.min(...xs)}..` +
                  `${Math.max(...xs)} (limit ${SOLE_ONPEW_MAX}; ${s.floor} columns ` +
                  `on floor, ${s.hidden} hidden behind the pews)`);
            }
          }

          /* ---- [F5] AND THE COMPOSITE AGREES WITH THE PLATE ---------- *
           * The block above reads the plate under each sole and the block above
           * that reads a patch at the mark; NEITHER of them can see the layer
           * the reader actually has between the sole and that floor. On this
           * staging that layer was the bride: she stands 23 plate px nearer than
           * the witness and was painted BEHIND him, so his boots rested on her
           * skirt over stone that measured perfectly honest. The whole stack is
           * composited here, in the group's own `z` order, and the pixel under
           * every sole column has to be the pew cut or painted floor — never
           * another participant, never a void. */
          const stack = ['bride', 'clergyman', 'groom', 'witness']
            .filter((w) => cast[w] && cast[w].art && cast[w].art.z >= 0)
            .map((w) => ({ who: w, art: cast[w].art }));
          /* every layer in the stack has to be a STILL for this to be measured
             off cell 0: a walker is showing a strip cell this snapshot does not
             name, so its alpha here would be the wrong frame's. The units the
             review filed are all at rest, and the block asserts that it ran. */
          const anyWalking = ['bride', 'clergyman', 'groom', 'witness']
            .some((w) => cast[w] && cast[w].walking);
          if (stack.length === 4 && !anyWalking) {
            const comp = await soleComposite(stack,
              { plate: fl.pews.plate, cut: fl.pews.cut, cutRing: fl.pews.cutRing,
                box: [fl.pews.x, fl.pews.y] });
            for (const [who, t] of Object.entries(comp)) {
              churchComposite.push({ unit: u.key, ...t });
              if (!t.n) {
                bad(`${u.key}: [F5] the ${who}'s composite sole span is empty — ` +
                    `${t.file} was not measured against the frame`);
              } else if (t.actor > SOLE_ACTOR_MAX) {
                bad(`${u.key}: [F5] the ${who} is standing ON THE ${t.on} — ` +
                    `${t.actor} of ${t.n} sole columns of ${t.file} rest on a cut ` +
                    `that is painted BEHIND him while its mark is nearer the ` +
                    `camera (limit ${SOLE_ACTOR_MAX}); the actor group's paint ` +
                    `order is not its depth order`);
              } else if (t.onPew > SOLE_ONPEW_COMP_MAX) {
                bad(`${u.key}: [F5] the ${who} is standing on a pew IN THE FRAME ` +
                    `THE READER GETS — ${t.onPew} of ${t.n} sole columns of ` +
                    `${t.file} are visible in the composite with pew furniture ` +
                    `under them (limit ${SOLE_ONPEW_COMP_MAX})`);
              }
            }
          }
        }

        /* ---- [F5] AND THE FEET ARE WHERE THE MARK SAYS ---------------- *
         * The block above proves the MARK is honest. It cannot prove the actor
         * is standing on it: `placeSprite` puts the cut's DECLARED baseline row
         * on the mark, and the row the cut actually paints last is a property of
         * the FILE. Regenerate a cut with 20 px more transparent hem and every
         * mark above stays legal while every actor in the marriage floats — which
         * is the review's F5 with the marks already fixed. So the bitmap is
         * decoded and its last painted row is compared to the mark it was placed
         * on, in plate px. Measured on the shipped cuts: worst 0.63 px
         * (tools/lanecf/frame_feet.py), so a 4 px gate is 6x the real error and
         * still catches a hem of one part in thirty. */
        for (const who of ['bride', 'clergyman', 'groom', 'witness']) {
          const c = cast[who];
          if (!c || !c.art || c.walking) continue;   // a walker is not a mark
          const err = await feetLine(c.art);
          if (err === null) continue;
          churchFeetLine.push({ unit: u.key, who, ...err });
          if (Math.abs(err.plateErr) > FEET_LINE_MAX) {
            bad(`${u.key}: [F5] the ${who} does not stand on his mark — ` +
                `${c.art.file} paints its last row at ${err.alphaBottom} but ` +
                `declares baseline ${c.art.baseline}, which puts his feet ` +
                `${err.plateErr > 0 ? 'below' : 'ABOVE'} the mark by ` +
                `${Math.abs(err.plateErr).toFixed(2)} plate px ` +
                `(limit ${FEET_LINE_MAX})`);
          }
        }

        /* ---- [F4] AND THE READER CAN SEE ALL FOUR --------------------- *
         * The register test above reads `cutout` off DOM OPACITY, so an actor
         * that is painted, on an honest mark, and entirely OUTSIDE THE LENS
         * scores exactly the same as one the reader can see. That hole is not
         * hypothetical: `halfdragged` kept the aisle lens through a fix round on
         * the strength of a two-Norton constraint the plate patch had already
         * voided, and its settled frame — the witness AT THE ALTAR — put the
         * clergyman 166 px outside the frame, the groom 48 px outside and the
         * witness's own head 40 px above the top edge, while the ledger read all
         * four present.
         *
         * The condition is the STAGING and not the lens's name: once the witness
         * stands on the altar mark the frame is a frame of four people at an
         * altar, and all four belong in it whatever the lens is called. Keyed on
         * the lens name instead, a wrong lens exempts itself. Before he is
         * dragged he is an idler up the side aisle and `aisle` is right to hold
         * him alone, so those units are not under this law. */
        if (cast.witness && cast.witness.atAltar) {
          const clip = await page.evaluate(() => {
            const box = document.getElementById('stage').getBoundingClientRect();
            const a = window.__refs.stage.active;
            const live = (ns) => ns.find((n) => n && +(n.style.opacity || 1) > 0.01);
            const pick = { bride: [a.bride], clergyman: [a.clergy],
                           groom: [a.norton, a.nortonBeck, a.nortonRun],
                           witness: [a.holmes, a.holmesAltar, a.holmesWalk] };
            const out = {};
            for (const [who, ns] of Object.entries(pick)) {
              const n = live(ns);
              if (!n) { out[who] = null; continue; }
              const r = n.getBoundingClientRect();
              out[who] = {
                left: +Math.max(0, box.left - r.left).toFixed(1),
                right: +Math.max(0, r.right - box.right).toFixed(1),
                top: +Math.max(0, box.top - r.top).toFixed(1),
                bottom: +Math.max(0, r.bottom - box.bottom).toFixed(1),
              };
            }
            return out;
          });
          for (const [who, c] of Object.entries(clip)) {
            if (!c) continue;
            const off = Object.entries(c).filter(([, v]) => v > CAST_CLIP_MAX);
            churchFrame.push({ unit: u.key, who, ...c });
            if (off.length) {
              bad(`${u.key}: [F4] the reader cannot see the whole ${who} at the ` +
                  `altar — his cut is outside the frame by ` +
                  off.map(([k, v]) => `${v} css px ${k}`).join(', ') +
                  ` (limit ${CAST_CLIP_MAX}); the lens is on ${u.focus} while the ` +
                  `staging is the marriage`);
            }
          }
        }

        /* ---- [F7] THE PUSH HAS ARRIVED, AND THE RING IS AN OBJECT ----- *
         * The review shot the settled frame of `preposterous` and got the wide
         * nave shot with a ~10 px ring. Both halves are measured here: the
         * camera's k IN FORCE (not the lens table's wish) and the band's own
         * rendered width in device px. */
        if (u.focus === 'ring' || u.focus === 'coin') {
          const g = await page.evaluate(() => {
            const s_ = window.__refs.stage, a = s_.active;
            const dpr = window.devicePixelRatio || 1;
            const wid = (n) => (n && +(n.style.opacity || 1) > 0.01
              ? +(n.getBoundingClientRect().width * dpr).toFixed(1) : 0);
            const at = (n) => { const r = n.getBoundingClientRect();
              return [+((r.x + r.width / 2) * dpr).toFixed(1),
                      +((r.y + r.height / 2) * dpr).toFixed(1)]; };
            return { k: +s_.cam3.k.toFixed(3), wantK: +s_.cam3.wk.toFixed(3),
                     ring: wid(a.band), coin: wid(a.coin), chain: wid(a.chain),
                     coinAt: at(a.coin), chainAt: at(a.chain) };
          });
          churchLens.push({ unit: u.key, focus: u.focus, ...g });
          /* the push is tagged with the DEFECT ITS LENS BELONGS TO: the ring
             lens is F7's fact (M.4) and the coin lens is F6's (M.6). A gate that
             fires under another defect's name is a gate that defect does not
             have — which is the whole lesson of this round. */
          if (!(g.k >= PUSH_K_MIN)) {
            bad(`${u.key}: [${u.focus === 'coin' ? 'F6' : 'F7'}] the ${u.focus} PUSH ` +
                `never arrived — the camera is at k=${g.k} in the settled frame ` +
                `(wants ${g.wantK}, floor ${PUSH_K_MIN})`);
          }
          if (u.focus === 'ring' && !(g.ring >= RING_SCREEN_MIN)) {
            bad(`${u.key}: [F7] the ring reads ${g.ring} device px in the frame the ` +
                `reader dwells on (floor ${RING_SCREEN_MIN}; the review measured ~10)`);
          }
        }

        /* ---- [F6] THE SOVEREIGN IS A COIN, AND IT TRAVELS -------------- *
         * Fact M.6 is a small gold object changing hands three times. It shipped
         * as a 26 px gradient with no chain and no push, and the review saw
         * "ring-like glows at the couple's hands". */
        if (u.key === 'sovereigngift') {
          const p = sn.props || {};
          const g = churchLens[churchLens.length - 1] || {};
          sovereign = { ...p, ...g };
          if (!(g.coin >= COIN_SCREEN_MIN)) {
            bad(`${u.key}: [F6] the sovereign reads ${g.coin} device px at k=${g.k} ` +
                `— not an image of a coin (floor ${COIN_SCREEN_MIN})`);
          }
          if (!(p.chain > 0.5)) {
            bad(`${u.key}: [F6] the watch chain he means to wear it on is not on ` +
                `screen (opacity ${p.chain}) — leg 2 of the journey arrives nowhere`);
          }
          const travel = +(+p.coinTravel * g.k * 2).toFixed(0);   // dpr 2
          sovereign.travelDevicePx = travel;
          if (!(travel >= COIN_TRAVEL_MIN)) {
            bad(`${u.key}: [F6] the coin's journey is ${p.coinTravel} plate px, which ` +
                `at k=${g.k} is ${travel} device px on screen (floor ` +
                `${COIN_TRAVEL_MIN}) — a smudge that never went anywhere`);
          }
          /* and it ENDED on the chain: the resolved frame is the reader's frame */
          const d = Math.hypot(g.coinAt[0] - g.chainAt[0], g.coinAt[1] - g.chainAt[1]);
          if (!(d <= 60)) {
            bad(`${u.key}: [F6] the coin settled ${d.toFixed(0)} device px from the ` +
                `watch chain — the gift did not land where the fact says it lands`);
          }
        }
      }

      /* ---- [F14] THE CLOSING IMAGE IS HER, PAINTED, AND IT READS ------ *
       * The book's last picture was a faceless sitter in a sepia frame while the
       * painted Irene existed in the cameo and in the bride. Measured in the
       * frame the chapter ENDS on, and on the bytes behind it: the file can be
       * right and the carrier still fail if the plate is not up. */
      if (u.key === 'thewoman') {
        const p = await portraitProbe(PORTRAIT_HEAD);
        if (!p || !/photo-irene\.jpg/.test(p.src || '')) {
          bad(`[F14] the closing portrait is not raised on 'thewoman': ${JSON.stringify(p)}`);
        } else {
          const f = frames[KEY_SHOTS.thewoman];
          let pale = null, sd = null, mx = null;
          if (f) {
            const s0 = lumaStats(f, p.box);
            mx = s0.max;
            let n = 0, hit = 0, sum = 0, sq = 0;
            const x1 = Math.round(p.box.x), y1 = Math.round(p.box.y);
            for (let y = y1; y < y1 + p.box.h; y++) for (let x = x1; x < x1 + p.box.w; x++) {
              const l = lum(pxAt(f, x, y));
              n++; sum += l; sq += l * l; if (l > 0.62 * mx) hit++;
            }
            const mean = sum / n;
            pale = +(hit / n).toFixed(3); sd = +Math.sqrt(sq / n - mean * mean).toFixed(1);
          }
          portrait = { ...p, frame: { pale, sd, max: mx } };
          if (!(p.bytes.pale >= PORTRAIT_PALE_MIN && p.bytes.sd >= PORTRAIT_SD_MIN)) {
            bad(`[F14] the closing portrait's own bytes are not the painted sitter: ` +
                `head box pale ${p.bytes.pale} / sd ${p.bytes.sd} (floors ` +
                `${PORTRAIT_PALE_MIN} / ${PORTRAIT_SD_MIN}; the mannequin sitter measured ` +
                `0.184 / 50.7 in this same box and the painted Irene 0.376 / 70.1)`);
          }
          if (pale === null) bad('[F14] no closing frame to measure her face in');
          else if (!(pale >= FRAME_PALE_MIN && sd >= FRAME_SD_MIN)) {
            bad(`[F14] her face does not read in the closing frame: pale ${pale} / ` +
                `sd ${sd} in the head box at this lens (floors ${FRAME_PALE_MIN} / ` +
                `${FRAME_SD_MIN}; the same frame of the same read with the mannequin ` +
                `portrait measured 0.165 / 49.9)`);
          }
        }
      }

      /* ======== THE ROOM + STREET + HEADS LANE'S OWN GATES ============= *
       * Every one of these measures the fixed thing at the unit's own lens, in
       * the frame the reader dwells on. A fix without its assertion is not done.
       * ================================================================ */

      /* ---- [F10] A HEADING IS LIT, OR IT IS NOT A HEADING ------------- *
       * Six chapter headings, and one of them shipped at 2% luminance for its
       * whole 3.4 s dwell. Both halves are gated by checkHeading(), which is
       * called from HERE and from the Beat VI clock — because the Beat VII
       * heading is the one the clock hands over, which is exactly why it was the
       * one nobody was measuring. */
      if (/^head\d?$/.test(u.key)) {
        /* the dwell-under-cover half of the gate only applies to a heading that
           arrives ON A NEW LEAF. Beat VI's heading is the one that does not (the
           ledger: "arrives with NO page turn — the heading lands on the leaf
           already mounted"), so there is no cover for it to age under and what
           the number would measure there is the harness's own pacing. */
        const prev = units[u.i - 1];
        await checkHeading(u, s, { newLeaf: !prev || prev.page !== u.page });
      }

      /* ---- [F9] NOBODY IS SITTING IN WATSON'S CHAIR ------------------- *
       * The reader IS Watson, and a painted man with a newspaper sat in the
       * armchair through every room unit. He was in three plate states and in the
       * foreground cut, and the only green in the whole painted room was his
       * coat — so the assertion is the count of green-leading pixels inside the
       * chair, ON SCREEN, at the three lenses the review caught him at. */
      if (sn.set === 'room' && ['comes2', 'hadnote', 'seat', 'letter1'].includes(u.key)) {
        const box = await plateBox(sn.chairBox || [718, 335, 176, 209]);
        const g = coatPx(frames[KEY_SHOTS[u.key]] || null, box);
        chairs.push({ unit: u.key, ...g });
        if (g.n === null) bad(`${u.key}: no frame to measure the chair in`);
        else if (g.n > COAT_MAX) {
          bad(`${u.key}: WATSON IS STILL IN THE CHAIR — ${g.n} px of his coat ` +
              `inside the armchair at this lens (limit ${COAT_MAX})`);
        }
      }

      /* ---- [F8] THE ARRIVAL HAPPENS IN THE PICTURE -------------------- *
       * "And here he comes" was hoofbeats over a still frame with a warm smudge
       * under the door. The room's one exterior aperture is the window, so the
       * rig passes THERE — and this measures the pane, frame to frame, across the
       * unit the reader is looking at. */
      if (u.key === 'comes2') {
        const bandRect = await plateBox(sn.winBand || [827, 137, 87, 258]);
        const seq = [];
        let worst = 0, rigSeen = false;
        for (let i = 0; i < 10; i++) {
          await T(0.2);
          const fr = decodePng(await page.screenshot());
          const a = (await st()).stage.arrive || {};
          if (a.rigX != null) rigSeen = true;
          if (seq.length) {
            const d = pixelDiff(seq[seq.length - 1], fr, bandRect, 8, 1);
            worst = Math.max(worst, d.frac * 100);
          }
          seq.push(fr);
        }
        arrival = { band: bandRect, worstPct: +worst.toFixed(2), rigSeen };
        if (!rigSeen) bad('comes2: no rig ever crossed the window (arrive.rigX never set)');
        if (!(worst >= ARRIVE_MOTION_MIN)) {
          bad(`comes2: the arrival is not IN the picture — the window band changed ` +
              `at most ${worst.toFixed(2)}% of its pixels between frames ` +
              `(floor ${ARRIVE_MOTION_MIN}%)`);
        }
        await shot('01-10b-carriage-passing');
      }

      /* ---- [F1] THE MAN AT THE LODGE IS SCALED TO THE DOORWAY --------- *
       * He was drawn at the house face's 49.4 px/m while standing on the near
       * pavement, so a 1.87 m man read 92 px against a 2.03 m door leaf that this
       * plate draws 107 px tall — and his head was 9 CSS px. Measured off the
       * RENDERED box, and the floor line is measured with it: growing a sprite
       * must not lift its feet. */
      if (u.key === 'lodge') {
        lodge = await page.evaluate(() => {
          const s_ = window.__refs.stage, set = s_.active;
          const r = set.holmes.getBoundingClientRect();
          const p0 = s_.toPlate(r.left, r.top), p1 = s_.toPlate(r.right, r.bottom);
          const x = (p0.x + p1.x) / 2;
          const floor = set.state.holmesAt[1];
          return { plateH: +(p1.y - p0.y).toFixed(1), cssH: +r.height.toFixed(1),
                   footY: +p1.y.toFixed(1), floorY: +floor.toFixed(1),
                   dy: +(p1.y - floor).toFixed(2), x: +x.toFixed(1) };
        });
        lodge.doorRatio = +(lodge.plateH / DOOR_LEAF_PX).toFixed(3);
        lodge.headCss = +(lodge.cssH / 7.6).toFixed(1);
        if (!(lodge.plateH >= FIGURE_MIN_PX)) {
          bad(`lodge: the man is ${lodge.plateH} plate px tall — under the floor ` +
              `${FIGURE_MIN_PX} (1.87 m at the pavement's own 63.0 px/m)`);
        }
        if (lodge.doorRatio < 1.0 || lodge.doorRatio > 1.22) {
          bad(`lodge: he reads ${lodge.doorRatio}x the villa's ${DOOR_LEAF_PX} px door ` +
              `leaf — a 1.87 m man beside a 2.03 m door on the nearer pavement is 1.0-1.22`);
        }
        if (!(lodge.headCss >= HEAD_CSS_MIN)) {
          bad(`lodge: his head is ${lodge.headCss} CSS px at this lens — unreadable ` +
              `(floor ${HEAD_CSS_MIN})`);
        }
        if (Math.abs(lodge.dy) > 1.5) {
          bad(`lodge: FLOOR LINE BROKEN — his feet are ${lodge.dy} plate px off the ` +
              `pavement line after the rescale`);
        }
      }
    }

    /* His box, across his own entrance. Reported, not asserted: the camera
       pushes to the threshold over the same interval, so this number moves
       whether or not there is a King in the box. */
    if (u.key === 'hadnote' && frames['01-11-king-enters'] && frames['01-10-carriage']) {
      const b = await page.evaluate(() => {
        const r = document.querySelector('#stage .king .walk').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const rect = { x: b.x * 2, y: b.y * 2, w: b.w * 2, h: b.h * 2 };   // dpr 2
      kingPainted = kingPainted ||
        pixelDiff(frames['01-10-carriage'], frames['01-11-king-enters'], rect, 8, 2);
    }

    /* ---- the verbs -------------------------------------------------- */
    if (u.verb === 'auto') {
      await T(3.2);
    } else if (u.verb === 'clock') {
      await T(0.5);                       // the beat's clock owns this stretch
    } else if (u.verb === 'target' && s.gate.resolved) {
      await T(0.5);                       // a gate that handed off to the clock
    } else if (u.verb === 'hold') {
      /* the hold is MISSED the way a hold is missed: by letting go too early.
         It must not resolve, it must not advance, and what it had already
         uncovered has to go back under — the reveal is the hold, not a ratchet. */
      const beforeHold = (await st()).i;
      await page.evaluate(() => window.__holdStart());
      await T(0.4);
      const peek = await st();
      await page.evaluate(() => window.__holdEnd());
      await T(0.6);
      const letGo = await st();
      if (letGo.hold.resolved) bad('the hold resolved on an early release');
      if (letGo.i !== beforeHold) bad('the hold gate advanced on an early release');
      if (!(letGo.hold.k < peek.hold.k)) {
        bad(`the hold did not decay after an early release (${peek.hold.k} -> ${letGo.hold.k})`);
      }
      if (!(letGo.stage.plate.watermark < peek.stage.plate.watermark)) {
        bad(`the reveal ratcheted: it kept ${letGo.stage.plate.watermark} after the release`);
      }
      gates.push({ beat: 1, gate: 'hold-release', missed: true, resolved: letGo.hold.resolved });
      await page.evaluate(() => window.__holdStart());
      await T(0.9);
      await shot('01-05b-hold-half');
      const mid = await st();
      if (!(mid.hold.k > 0.3 && mid.hold.k < 0.95)) bad(`hold mid k=${mid.hold.k} not partial`);
      if (!(mid.stage.plate.watermark > 0.05)) bad(`watermark did not resolve WITH the hold (${mid.stage.plate.watermark})`);
      if (!(mid.stage.holmes.lift > 0.1)) bad(`the world verb did not happen: holmes.lift=${mid.stage.holmes.lift}`);
      await T(1.4);
      await page.evaluate(() => window.__holdEnd());
      const done = await st();
      if (!done.hold.resolved) bad('hold did not resolve');
      gates.push({ beat: 1, gate: 'hold', missed: 'n/a', resolved: done.hold.resolved });
      await shot('01-05c-hold-resolved');
      await page.evaluate(() => window.__click());
    } else if (u.verb === 'target') {
      /* every gate is FAILED first. A gate that cannot be failed is not a gate. */
      const before = (await st()).i;
      const miss = await page.evaluate(() => window.__gateMiss());
      const afterMiss = await st();
      if (miss.advanced || afterMiss.i !== before) bad(`${u.target} gate advanced on a MISS`);
      if (afterMiss.gate.resolved) bad(`${u.target} gate resolved on a MISS`);
      if (!(afterMiss.nudges > 0)) bad(`${u.target} gate did not nudge on a MISS`);
      const hit = await page.evaluate(() => window.__gateClick());
      const afterHit = await st();
      const moved = afterHit.i !== before || afterHit.end.active || afterHit.clock.held ||
                    afterHit.turn.active;
      if (!moved) bad(`${u.target} gate did not advance on a HIT`);
      gates.push({ beat: u.beat, gate: u.target, missed: !miss.advanced, resolved: hit.ok,
                   advanced: moved, handedToClock: !!hit.held, turnsPage: !!hit.turning,
                   at: hit.at });
      if (u.target === 'mask') {
        await T(0.6);
        await shot('01-16b-mask-torn');
        const m = await st();
        if (m.stage.king.masked) bad('the King is still masked after the mask gate');
      }
      if (u.target === 'index') { await T(0.4); await shot('01-19b-index-hit'); }
      if (u.target === 'cab') {
        const p = await st();
        if (!p.stage.rolling) bad('the cab gate did not start the pursuit rolling');
      }
      if (u.target === 'station') {
        const p = await st();
        if (p.stage.mark !== 'locked') bad(`the station gate did not lock the mark (${p.stage.mark})`);
        if (p.page !== 5) bad(`the station gate turned the page (now ${p.page}) — V and VI share leaf 5`);
        await T(1.2);
        const w = await st();
        if (!(w.stage.windowOpen > 0.5)) bad(`the sitting-room window never opened (${w.stage.windowOpen})`);
        await shot('05-05b-window-open');
      }
      if (u.target === 'window') {
        /* ---- THE BEAT VI CLOCK, sec 6.6 ---------------------------- */
        const marks = [];
        const throwShot = await st();
        /* t=0 is the instant this gate resolved. It is read off the SIM clock,
           not off the ruse clock: the ruse clock belongs to the street SET, and
           the last thing this stretch does is turn the page onto a different
           one — where asking the street what time it is gets no answer. */
        const zero = throwShot.t;
        if (throwShot.unit.blocks && throwShot.unit.blocks.trim()) {
          bad(`the throw carries text: "${throwShot.unit.blocks.trim().slice(0, 60)}"`);
        }
        await shot('06-02b-the-throw-no-text');
        for (const want of [2.2, 3.4, 4.4, 5.9, 7.0, 9.0, 11.4, 13.6, 17.0, 19.0, 20.6]) {
          const now = (await st()).t - zero;
          if (want > now) await T(want - now);
          const q = await st();
          marks.push({ rel: +(q.t - zero).toFixed(2), unit: q.unit && q.unit.key,
                       page: q.page, ruseT: q.stage.ruseT, reveal: q.stage.reveal });
          if (KEY_SHOTS[q.unit && q.unit.key] && !beatsSeen['shot:' + q.unit.key]) {
            beatsSeen['shot:' + q.unit.key] = await shot(KEY_SHOTS[q.unit.key],
                                                          { waitCover: true });
            seen.push(q.unit.key); beatsSeen[q.unit.beat] = (beatsSeen[q.unit.beat] || 0) + 1;
            lastId = q.unit.id;
            /* THE BEAT VII HEADING ARRIVES HERE, on the beat's clock and under a
               cover that is still falling — which is the whole of F10. It is
               gated on this path too, or the one heading that failed is the one
               heading nobody checks. */
            if (/^head\d?$/.test(q.unit.key)) {
              await checkHeading(q.unit, await st(), { newLeaf: true });
            }
          }
        }
        ruse = marks;
        const byUnit = Object.fromEntries(marks.filter((m) => m.unit).map((m) => [m.unit, m]));
        for (const [key, at] of [['panel', 3.2], ['glimpse', 5.6], ['knowwhere', 8.6],
                                 ['howfind', 11.0], ['showed', 13.2]]) {
          const m = marks.find((x) => x.unit === key);
          if (!m) bad(`Beat VI clock: ${key} never arrived`);
          else if (m.rel < at - 0.01) bad(`${key} arrived at t+${m.rel}, before its t+${at}`);
        }
        /* and the LEAF turns on the same clock: t+19.8, no click involved */
        const turned = marks.find((m) => m.rel >= 20.4 && m.page !== 5);
        const stillOn19 = marks.find((m) => Math.abs(m.rel - 19.0) < 0.3);
        if (stillOn19 && stillOn19.page !== 5) {
          bad(`the page turned EARLY: leaf ${stillOn19.page} at t+${stillOn19.rel}, before t+19.8`);
        }
        if (!turned) {
          const last = marks[marks.length - 1];
          bad(`the page did not turn on the beat's clock (t+${last.rel}, still on leaf ${last.page})`);
        } else {
          note(`Beat VI: the page turns on the beat's own clock and on no click — ` +
               `leaf 5 held at t+19.0, leaf ${turned.page} by t+${turned.rel} (the ledger says 19.8)`);
        }
        const inPause = marks.find((m) => m.unit === 'glimpse');
        if (inPause && inPause.reveal && !inPause.reveal.inPause) {
          bad(`glimpse did not land inside her pause (ruseT ${inPause.ruseT})`);
        } else if (inPause) {
          note('Beat VI: `glimpse` lands inside her pause — the image the chapter is for');
        }
        note('Beat VI clock: ' + marks.filter((m) => m.unit)
          .map((m) => `${m.unit}@t+${m.rel}`).join(' '));
      }
    } else {
      /* a click-paced unit. Three of them may not be paged past until the thing
         they name has happened, and the click that arrives inside that window
         must be LATCHED rather than lost (sec 2.3). */
      if (u.wait || (u.seg && s.blocked)) {
        const before = s.i;
        await latchProbe(u);
        await page.evaluate(() => window.__click());
        /* Let the world finish the thing, and the latched click spend itself.
           RELEASE IS NOT ONLY `i` MOVING. `twentyfive` is the last unit of its
           leaf, so its latched click spends itself into startTurn() — and `S.i`
           deliberately does not move until the cover swaps, which on a real
           wire is a WALL-time wait with story time frozen (S.stall). Reading
           only `i` therefore called the book stuck at the exact moment it was
           doing the right thing: the church set was coming off the wire under
           a raised cover. A turn under way IS the story having moved on. */
        let released = false;
        for (let i = 0; i < 30; i++) {
          const q = await st();
          if (q.i !== before || q.turn.active) { released = true; break; }
          await T(0.5);
        }
        const after = await st();
        if (!released && after.i === before) {
          /* SAY WHY. A wait that never lifts is the one failure where the bare
             assertion is useless: every `wait:` is a question the SET answers,
             so print the SET's own answer next to the clock it is answering
             against. */
          const why = await page.evaluate(() => {
            const x = window.__state();
            return { t: x.t, stall: x.stall, stage: x.stage, acts: window.__acts && window.__acts() };
          });
          bad(`${u.key}: never released from ${s.blocked} after 15 s of story time\n` +
              `    story t=${why.t}  stall=${why.stall}\n` +
              `    stage: ${JSON.stringify(why.stage)}\n` +
              `    acts:  ${JSON.stringify(why.acts)}`);
        } else if (latchProof && latchProof.unit === u.key) latchProof.spentAt = after.t;
      } else {
        await page.evaluate(() => window.__click());
      }
    }
  }
  if (guard >= 420) bad('the read never finished (guard tripped)');

  /* ---- 2. the last page turn, and the closing card --------------------- */
  await T(0.35);
  // these two ARE the cover and the blank leaf, so they are the exceptions
  await shot('08-00-page-turning');
  await T(2.4);
  await shot('08-01-closing-card');
  const fin = await st();
  if (!fin.finished) bad('the chapter never finished');
  if (!fin.blankLeaf) bad('the closing leaf still carries a picture');
  if (!(fin.end.card > 0.9)) bad(`the closing card did not come up (card=${fin.end.card})`);
  const cardText = await page.evaluate(() =>
    document.getElementById('endcard').textContent.replace(/\s+/g, ' ').trim());
  if (!/End of Chapter I/i.test(cardText)) bad(`closing card text: '${cardText}'`);

  /* ---- 3. the tally ---------------------------------------------------- */
  const expect = units.map((u) => u.key);
  const missed = expect.filter((k) => !seen.includes(k));
  if (missed.length) bad(`units never entered: ${missed.join(', ')}`);
  else note(`95/95 units entered in order by the reader's own verb`);
  for (const b of beats) {
    if ((beatsSeen[b.n] || 0) !== b.units) {
      bad(`beat ${b.n}: entered ${beatsSeen[b.n] || 0} units, the ledger says ${b.units}`);
    }
  }
  if (!latchProof) {
    bad('the latch law was never exercised: no unit was still blocked when the ' +
        'reader clicked, so "a click inside a wait window is latched" is untested');
  } else {
    note(`the latch: ${latchProof.unit}'s click inside its ${latchProof.blocked} ` +
         `window was latched at t=${latchProof.latchedAt} and spent at t=${latchProof.spentAt}`);
  }
  if (gates.length !== 9) bad(`gates exercised: ${gates.length}, expected 9 (8 gates + the hold release)`);
  if (turns.length !== 5) bad(`page turns during the read: ${turns.length}, expected 5 (the sixth is the closing card)`);
  const lateInLeaf = turns.filter((t) => false);   // see leafBytes below
  const readFetches = await page.evaluate((ready) => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name))
    .map((r) => ({ url: r.name.split('/').slice(-2).join('/'), at: +r.startTime.toFixed(0),
                   kb: +(r.encodedBodySize / 1024).toFixed(0) })), readyAt);
  note(`bitmaps fetched across the whole chapter: ${readFetches.length} ` +
       `(${(readFetches.reduce((a, r) => a + r.kb, 0) / 1024).toFixed(1)} MB), ` +
       `and every one of them arrived under a cover`);
  if (turns.some((t) => t.fetched === 0 && t.set !== null &&
                        ['street', 'chase', 'church'].includes(t.set) &&
                        turns.filter((x) => x.set === t.set).indexOf(t) === 0)) {
    note('note: a first mount of a new SET fetched nothing — it was already decoded');
  }

  const audio = await page.evaluate(() => window.__audio());
  const gaps = fin.stage.gaps || [];
  const appErrors = fin.errors || [];
  if (appErrors.length) bad('app errors: ' + JSON.stringify(appErrors));
  if (consoleErrors.length) bad('console errors: ' + consoleErrors.slice(0, 6).join(' | '));
  else note('zero console errors');
  if (gaps.length) note('ART GAPS the engine reported: ' + gaps.join(', '));

  /* ---- 4. soft-fail: no gate is a wall (sec 2.6) ----------------------- */
  await page.evaluate(async () => await window.__gotoUnit('comeman'));
  const beforeSoft = (await st()).i;
  await T(31);
  const afterSoft = await st();
  const softOk = afterSoft.i !== beforeSoft || afterSoft.softFails > 0;
  if (!softOk) bad('the norton gate did not soft-fail after 30 s');
  else note(`soft-fail: the norton gate satisfied itself after 30 s (softFails=${afterSoft.softFails})`);

  /* ---- 5. portrait ----------------------------------------------------- */
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForFunction(() => window.matchMedia('(max-aspect-ratio: 9/10)').matches);
  await page.evaluate(() => window.__state());          // let the resize land
  await page.evaluate(async () => await window.__gotoUnit('seat'));
  await T(1.2);
  await shot('09-00-portrait-three-shot');
  await page.evaluate(async () => await window.__gotoUnit('tyingup'));
  await T(2.0);
  await shot('09-01-portrait-ring');
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---- 6. Beat I's own measurements, unchanged ------------------------- */
  await page.evaluate(async () => await window.__gotoUnit('hadnote'));
  const feet = [];
  for (const dt of [0.35, 0.7, 1.1, 2.4]) {
    await T(dt);
    const s = await st();
    feet.push({ t: s.t, x: s.stage.king.x, dy: s.stage.foot && s.stage.foot.dy,
                frame: s.stage.king.frame, walking: s.stage.king.walking });
  }
  const worst = Math.max(...feet.map((f) => Math.abs(f.dy || 0)));
  if (worst > 1.5) bad(`the King's feet leave the floor line by ${worst.toFixed(2)} plate px`);
  else note(`feet on the floor: worst |dy| = ${worst.toFixed(2)} plate px across the walk`);

  const holmesWalk = { out: [], back: [] };
  await page.evaluate(async () => await window.__gotoUnit('gaz1'));
  for (const dt of [0.25, 0.7, 1.2, 1.8, 2.5]) {
    await T(dt);
    const h = (await st()).stage.holmes;
    holmesWalk.out.push({ x: h.x, s: h.s, frame: h.frame, walking: h.walking,
                          dy: h.foot && h.foot.dy });
  }
  const arrived = (await st()).stage.holmes;
  if (arrived.at !== 'desk') bad(`Holmes never arrived at the desk (at=${arrived.at})`);
  if (Math.abs(arrived.x - 766) > 0.6) bad(`Holmes stopped short of the desk mark (x=${arrived.x})`);
  if (Math.abs(arrived.s - 0.885) > 0.002) bad(`the depth scale at the desk is ${arrived.s}`);
  const framesSeen = new Set(holmesWalk.out.filter((f) => f.walking).map((f) => f.frame));
  if (framesSeen.size < 2) bad(`the walk strip never cycled (frames ${[...framesSeen]})`);
  const hWorst = Math.max(...holmesWalk.out.map((f) => Math.abs(f.dy || 0)));
  if (hWorst > 1.5) bad(`Holmes leaves the floor line by ${hWorst.toFixed(2)} plate px`);
  else note(`Holmes crosses to the desk: worst |dy| = ${hWorst.toFixed(2)} plate px, ` +
            `depth 1.000 -> ${arrived.s}`);

  /* ---- 7. the pursuit's own contract ----------------------------------- */
  await page.evaluate(async () => await window.__gotoUnit('toogood'));
  await page.evaluate(() => window.__gateClick());
  const roll = [];
  for (const dt of [0.5, 1.5, 2.5, 2.5, 1.5]) { await T(dt); const s = await st(); roll.push({ t: +s.t.toFixed(1), gapM: s.stage.gapM, band: s.stage.band }); }
  const bands = new Set(roll.map((r) => r.band));
  if (![...bands].every((b) => b === 'shadow')) {
    bad(`the pursuit left the shadow band: ${JSON.stringify(roll)}`);
  } else {
    note(`the pursuit runs the strip inside the shadow band the whole way: ` +
         roll.map((r) => r.gapM + 'm').join(' -> '));
  }

  /* ---- [F15] THE PARKING LAW ----------------------------------------- *
   * A rig CROSSING a lamp column reads as passing in front of it, which it
   * is. A rig PARKED on one reads as a gas standard growing out of the
   * carriage — the round-3 user bug: "the cart passed through the light"
   * (her landau settled at u 0.620, hood on lamp3; the follow's roll end
   * reached the same column). Lamp2 (719..778) is exempt: lamp2-front.png
   * restores its post IN FRONT, so a rig under it reads as parked behind a
   * lamp, plinth and all. Lamps 1, 3 and 4 have no front cut, so at every
   * settle a rig's body span must CLEAR their columns. Asserted at the
   * roll's own end (where the follow now lives for two units) and at every
   * chase settle the reader dwells on. */
  {
    const UNCUT = [[293, 320, 'lamp1'], [938, 997, 'lamp3'], [1110, 1169, 'lamp4']];
    const CLEAR = 10;                      // plate px of daylight required
    await T(8.5);                          // let the roll finish: the END is the dwell
    const parks = [];
    for (const unit of ['landau', 'shotout', 'shabby', 'twentyfive']) {
      await page.evaluate(async (u) => await window.__gotoUnit(u), unit);
      await T(9.0);                        // every travel/segment done; this IS the dwell
      const s = await st();
      for (const [id, r] of Object.entries(s.stage.rigs || {})) {
        if (!r.on || !r.plate) continue;
        const [bx, , bw] = r.plate;
        for (const [c0, c1, lname] of UNCUT) {
          const gap = bx > c1 ? bx - c1 : c0 - (bx + bw);
          if (bx + bw > c0 && bx < c1)
            bad(`[F15] ${id} settles ON ${lname}'s column at ${unit}: body x ` +
                `${bx.toFixed(0)}..${(bx + bw).toFixed(0)} vs post ${c0}..${c1}`);
          else if (gap < CLEAR && gap > -1e9)
            bad(`[F15] ${id} settles ${gap.toFixed(0)}px from ${lname}'s column at ` +
                `${unit} (law: >= ${CLEAR})`);
        }
        parks.push(`${unit}/${id}@u${r.u}`);
      }
    }
    note(`[F15] the parking law: every settled rig clears the uncut lamp columns ` +
         `by >= ${CLEAR} plate px (${parks.length} settles measured: ${parks.join(' ')})`);
  }

  /* ---- [F16] THE RING RINGS THE THING THE CUE NAMES ------------------- *
   * The door gate's cue says "click the door" while the King waits out the
   * gate standing at the sill (R7-1 keeps him there — walking him out
   * beheads him at the lintel). His body covers the leaf's right half, and
   * the old anchor (378,372) put the pulsing ring ON HIS CHEST. The law:
   * the ring's full circle must clear his body's near edge. His standing
   * half-width measured off the shipped king-masked sprite is 55 plate px
   * at the sill's depth; 10 more of daylight required. */
  {
    await page.evaluate(async () => await window.__gotoUnit('door'));
    await T(2.5);
    const d = await page.evaluate(() => {
      const a = window.__refs.stage.targetPlate('door');
      return { at: a, r: 62 };
    });
    const kx = (await st()).stage.king.x;
    const edge = kx - 55;
    const ringR = d.at[0] + d.r;
    if (ringR + 10 > edge)
      bad(`[F16] the door ring reaches ${ringR.toFixed(0)} but the King's body ` +
          `edge is at ${edge.toFixed(0)} (need 10 clear) — the ring is on HIM again`);
    else
      note(`[F16] the door ring: circle ends at plate x ${ringR.toFixed(0)}, ` +
           `${(edge - ringR).toFixed(0)} px clear of the waiting King (edge ${edge.toFixed(0)})`);
  }

  /* ==================================================================== *
   * 8. THE ROOM + STREET + HEADS LANE: the gates that need the whole read *
   * ==================================================================== */

  /* ---- [F2] THE LANDSCAPE DEAD BAND ---------------------------------- *
   * Portrait has had a dead-band gate since round 2 and landscape never had one,
   * so four lenses shipped with a fifth to a quarter of the panel spent on plate
   * that carries no painting: the `door` lens and the `villa` lens were both
   * PINNED BY THE CAMERA'S OWN EDGE CLAMP (asking for a centre the plate cannot
   * hold slides the window to the edge and leaves the margin in frame), and the
   * `station` lens hung off the painting's left. Measured over every key frame of
   * the read, as the longest run of near-black strips in from each edge.
   *   exempt: a frame with an inset raised (the card IS the picture and the world
   *   under it is deliberately dimmed) and the deliberately blank closing leaf. */
  const bandRows = Object.entries(bandOf)
    .map(([name, b]) => ({ name, ...b }))
    .sort((a, b) => b.max - a.max);
  const overBand = bandRows.filter((b) => b.max > LANDSCAPE_MAX && b.dim <= 0.5 && !b.blank);
  for (const b of overBand) {
    bad(`${b.name} (${b.unit}): ${(b.max * 100).toFixed(0)}% of the panel is a dead ` +
        `band — L${(b.left * 100).toFixed(0)} R${(b.right * 100).toFixed(0)} ` +
        `T${(b.top * 100).toFixed(0)} B${(b.bottom * 100).toFixed(0)} ` +
        `(limit ${(LANDSCAPE_MAX * 100).toFixed(0)}%, median frame runs 8%)`);
  }
  if (!overBand.length) {
    /* report the worst frame THE GATE APPLIES TO. Reporting the worst of all of
       them printed "worst frame is 08-01-closing-card at 100%" under a 22% limit
       on a clean lap, which reads as a passing violation: that frame is the
       deliberately blank closing leaf and the gate exempts it by design. */
    const judged = bandRows.filter((b) => b.dim <= 0.5 && !b.blank);
    const w = judged[0], ex = bandRows.length - judged.length;
    note(`landscape dead band: worst JUDGED frame is ${w && w.name} at ` +
         `${((w || {}).max * 100).toFixed(0)}% (limit ${LANDSCAPE_MAX * 100}%), ` +
         `${judged.length} frames judged, ${ex} exempt (inset raised / blank leaf)`);
  }

  /* ---- [F3] and [F11]: the two ASSETS, read off the wire -------------- *
   * These two defects live in the bytes, not in the staging, so they are
   * measured on the bytes THE READER GETS — fetched through the same origin the
   * page just read, which means --base measures the deployed files. */
  const getImg = async (rel) => {
    const res = await page.request.get(new URL(rel, URL_).toString());
    if (!res.ok()) { bad(`asset ${rel} did not load (${res.status()})`); return null; }
    try { return decodePng(await res.body()); }
    catch (e) {
      // jpeg: decode it in the page instead, and read the pixels back
      const px = await page.evaluate(async (u) => {
        const im = new Image();
        im.src = u; await im.decode();
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        return { width: c.width, height: c.height, data: Array.from(d.data) };
      }, new URL(rel, URL_).toString());
      return { width: px.width, height: px.height, channels: 4, data: Uint8Array.from(px.data) };
    }
  };

  const nortonImg = await getImg('./assets/actor/norton-chase.png');
  let nortonMatte = null;
  if (nortonImg) {
    nortonMatte = haloOf(nortonImg);
    if (!nortonMatte) bad('norton-chase.png has no alpha — it cannot be a cut-out');
    else {
      if (!(nortonMatte.halo <= NORTON_HALO_MAX)) {
        bad(`[F3] Norton's cut still has a halo: every partial pixel is ` +
            `+${nortonMatte.halo} luma brighter than the body it touches ` +
            `(limit +${NORTON_HALO_MAX}; the shipped cut measured +3.09)`);
      }
      if (!(nortonMatte.p95 <= NORTON_P95_MAX)) {
        bad(`[F3] Norton is hotter than his scene: core p95 luma ${nortonMatte.p95} ` +
            `(limit ${NORTON_P95_MAX}; the chase plate's own mean is 41.9)`);
      }
      if (nortonMatte.hot) {
        bad(`[F3] Norton carries ${nortonMatte.hot} blown pixels (luma > 200) on a night street`);
      }
      if (!fail.length || nortonMatte.halo <= NORTON_HALO_MAX) {
        note(`[F3] Norton's matte: halo +${nortonMatte.halo} luma, core p95 ` +
             `${nortonMatte.p95}, ${nortonMatte.hot} blown px`);
      }
    }
  }

  const cameoImg = await getImg('./assets/cameo/holmes.jpg');
  let cameoM = null;
  if (cameoImg) {
    cameoM = cameoStats(cameoImg);
    /* the card is drawn round with object-fit: cover, so the circle is the whole
       of what the reader sees of it — and that is where it is measured. The
       shipped card scored gown 0.00%, no purple hue at all, skin 0.00% and 15.2%
       green: a man in a green jacket with no skin on him, where the stage Holmes
       wears a purple-magenta gown at hue 298. */
    if (!(cameoM.gownPct >= CAMEO.gownMin)) {
      bad(`[F11] the Holmes cameo is not the stage Holmes: ${cameoM.gownPct}% of the ` +
          `card's circle is his gown's purple (floor ${CAMEO.gownMin}%)`);
    }
    if (cameoM.gownHue === null || Math.abs(cameoM.gownHue - CAMEO.hue) > CAMEO.hueTol) {
      bad(`[F11] the cameo's garment hue is ${cameoM.gownHue} — the room Holmes' ` +
          `gown is hue ${CAMEO.hue} +/- ${CAMEO.hueTol}`);
    }
    if (!(cameoM.skinPct >= CAMEO.skinMin)) {
      bad(`[F11] the cameo has no face: ${cameoM.skinPct}% skin inside the circle ` +
          `(floor ${CAMEO.skinMin}%)`);
    }
    if (cameoM.greenPct > CAMEO.greenMax) {
      bad(`[F11] the cameo still wears the wrong man's green jacket ` +
          `(${cameoM.greenPct}% green, limit ${CAMEO.greenMax}%)`);
    }
  }
  /* and the card is actually RAISED where the book says it is */
  await page.evaluate(async () => await window.__gotoUnit('post'));
  await T(0.6);
  const cameoUp = await page.evaluate(() => {
    const im = document.querySelector('#cameo img');
    const r = im && im.getBoundingClientRect();
    return im ? { src: im.getAttribute('src'), w: +r.width.toFixed(0),
                  op: +getComputedStyle(document.getElementById('cameo')).opacity } : null;
  });
  if (!cameoUp || !/holmes\.jpg/.test(cameoUp.src || '') || !(cameoUp.op > 0.5)) {
    bad(`[F11] the Holmes card is not raised on unit 1: ${JSON.stringify(cameoUp)}`);
  }

  /* ==================================================================== *
   * 9. THE CHURCH + FINALE LANE: the gates that need the whole read       *
   *    F4's plate half, F12 on the bytes, F13 on the two plates, F14 in   *
   *    the closing frame. Every one measures the fixed thing at the unit's *
   *    own lens, on what the reader was actually served.                  *
   * ==================================================================== */

  /* ---- [F4] NOBODY IS PAINTED INTO THE CHANCEL ----------------------- *
   * The DOM half of this law ran on every church unit above. This is the plate
   * half, and it is the one that cannot be satisfied by staging: the three
   * mannequins were bright desaturated CLOTH (gown, veil, shirt-front,
   * surplice) and their boxes measured 3.37 / 7.86 / 7.03 % cloth before
   * tools/lanecf/chancel_patch.py emptied them. A mannequin that comes back in
   * any plate variant shows up here. */
  await page.evaluate(async () => await window.__gotoUnit('notasoul'));
  await T(0.6);
  /* EVERY PLATE THE SET CAN SHOW, not just the base one. `church.jpg` is one of
     four bitmaps that paint this chancel — `church-dim.jpg` rides ctx.dim on
     every unit, `church-ring.jpg` crossfades over the whole ring scrub, and
     `altar.png` is a cut of the chancel itself — and the law is that no faceless
     figure survives at the altar rail in ANY of them. Probing only the base
     plate would let a mannequin ride back in on the variant the marriage is
     actually lit by, which is the one the reader dwells on longest. */
  for (const src of CLOTH_PLATES) {
    clothAll[src] = await clothProbe(CLOTH_BOXES, src);
    for (const [who, pct] of Object.entries(clothAll[src])) {
      if (pct === null) continue;                 // the cut does not cover the box
      if (pct > CLOTH_MAX) {
        bad(`[F4] the plate still paints the ${who}: ${pct}% of his figure box in ` +
            `${src} is bright cloth (limit ${CLOTH_MAX}%, before the patch ` +
            `3.37-7.86%) — that is a second art register in the frame`);
      }
    }
  }
  cloth = clothAll['set/church/church.jpg'];
  note(`[F4] the chancel is empty in all ${CLOTH_PLATES.length} plates the set ` +
       `can show: ` + Object.entries(clothAll).map(([f, v]) =>
         `${f.split('/').pop()} ` + Object.entries(v)
           .map(([k, p]) => `${k[0]}${p === null ? '-' : p}`).join('/')).join(', ') +
       ` %cloth (limit ${CLOTH_MAX}%); and every participant was a cut-out in all ` +
       `${Object.keys(churchCast).length} church units`);
  if (churchFrame.length) {
    const worst = churchFrame.filter((f) => Math.max(f.left, f.right, f.top, f.bottom)
                                            > CAST_CLIP_MAX);
    note(`[F4] and the lens holds them: ${churchFrame.length - worst.length}/` +
         `${churchFrame.length} cast-frames whole at the altar staging ` +
         `(worst clip ${Math.max(0, ...churchFrame.map((f) =>
           Math.max(f.left, f.right, f.top, f.bottom))).toFixed(1)} css px, ` +
         `limit ${CAST_CLIP_MAX})`);
  } else {
    bad('[F4] no altar-staging frame was measured — the in-frame law did not run');
  }
  if (churchFeetLine.length) {
    const worst = churchFeetLine.reduce((a, b) =>
      Math.abs(b.plateErr) > Math.abs(a.plateErr) ? b : a);
    note(`[F5] and they stand on their marks: ${churchFeetLine.length} cut-frames ` +
         `measured off their own alpha, worst ${worst.plateErr} plate px ` +
         `(${worst.who} in ${worst.unit}, limit ${FEET_LINE_MAX})`);
  } else {
    bad('[F5] no cut\'s feet line was measured — the baseline law did not run');
  }
  if (churchFeet.length) {
    const worst = churchFeet.filter((f) => !f.ok);
    note(`[F5] feet: ${churchFeet.length - worst.length}/${churchFeet.length} ` +
         `foot-frames legal (floor >= ${FLOOR_FRAC_MIN} or the pew swallows the ` +
         `footwear block) — witness at the altar ` +
         (churchFeet.find((f) => f.unit === 'license' && f.who === 'witness')
           ? `floorFrac ${churchFeet.find((f) => f.unit === 'license' && f.who === 'witness').floorFrac}`
           : 'n/a'));
  } else {
    bad('[F5] no church foot-frame was measured — the floor law did not run');
  }
  if (churchSole.length) {
    const worst = churchSole.filter((s) => s.onPew > SOLE_ONPEW_MAX);
    const cols = churchSole.reduce((a, s) => a + s.n, 0);
    note(`[F5] and not one sole stands on a pew: ${cols} sole columns over ` +
         `${churchSole.length} cut-frames, ${churchSole.reduce((a, s) => a + s.floor, 0)} ` +
         `on painted floor, ${churchSole.reduce((a, s) => a + s.hidden, 0)} hidden ` +
         `behind both pew cuts, ${worst.length ? worst.length + ' FLOATING' : '0 on furniture'} ` +
         `(limit ${SOLE_ONPEW_MAX} per frame) — the witness's altar stance ` +
         (churchSole.find((s) => s.unit === 'license' && s.who === 'witness')
           ? `${churchSole.find((s) => s.unit === 'license' && s.who === 'witness').floor} floor / ` +
             `${churchSole.find((s) => s.unit === 'license' && s.who === 'witness').hidden} hidden`
           : 'n/a'));
  } else {
    bad('[F5] no sole span was measured — the per-column floor law did not run');
  }
  if (churchComposite.length) {
    const badC = churchComposite.filter((c) => !c.n || c.actor > SOLE_ACTOR_MAX ||
                                               c.onPew > SOLE_ONPEW_COMP_MAX);
    const sum = (k) => churchComposite.reduce((a, c) => a + c[k], 0);
    const w = churchComposite.find((c) => c.unit === 'preposterous' &&
                                          c.who === 'witness');
    note(`[F5] and the COMPOSITE agrees: ${sum('n')} sole columns over ` +
         `${churchComposite.length} participant-frames, ${sum('floor')} on painted ` +
         `floor, ${sum('pew')} behind the pew cuts, ${sum('behind')} behind a nearer ` +
         `participant, ${sum('actor')} ON another actor, ${sum('onPew')} on pew ` +
         `furniture (limits ${SOLE_ACTOR_MAX}/${SOLE_ONPEW_COMP_MAX}) — ` +
         `the witness in the ring lens ` +
         (w ? `${w.floor} floor / ${w.pew} pew / ${w.behind} behind the bride / ` +
              `${w.actor} on her (was 43 ON her gown)` : 'n/a') +
         `; paint order back-to-front z ` +
         [...new Set(churchComposite.map((c) => `${c.who}:${c.z}`))].join(' '));
    if (badC.length) {
      bad(`[F5] ${badC.length} participant-frames float in the composite`);
    }
  } else {
    bad('[F5] the composite sole law never ran — no at-rest church frame had all ' +
        'four participants drawn, which is itself the F4 staging failing');
  }
  if (churchLens.length) {
    note(`[F7] the close lenses, as the reader gets them: ` + churchLens
      .map((l) => `${l.unit} k=${l.k} ring=${l.ring}px coin=${l.coin}px`).join(' | '));
  } else {
    bad('[F7] the ring and coin lenses were never measured');
  }
  /* [F6] the numbers its four gates ran on, printed. Its gates are up in the
     read at `sovereigngift`; this is the report half, because a round whose law
     is "every fix ships with its measurement" has to PRINT the measurement. */
  if (sovereign) {
    const d = Math.hypot(sovereign.coinAt[0] - sovereign.chainAt[0],
                         sovereign.coinAt[1] - sovereign.chainAt[1]);
    note(`[F6] the sovereign: ${sovereign.coin} device px at k=${sovereign.k} ` +
         `(floor ${COIN_SCREEN_MIN}), the watch chain drawn ${sovereign.chain} ` +
         `device px wide, the journey ` +
         `${sovereign.coinTravel} plate px = ${sovereign.travelDevicePx} device px ` +
         `(floor ${COIN_TRAVEL_MIN}), and it settled ${d.toFixed(0)} px from the chain`);
  } else {
    bad('[F6] the sovereign was never measured — the read did not reach `sovereigngift`');
  }

  /* ---- [F12] THE REVEAL CUT'S SPILL CEILING -------------------------- *
   * matte.py finishes every keyed actor with clamp_spill(ceiling 20) and the
   * ceiling never reached this cut: 284 of its 329 outer-rim px carried a
   * magenta excess up to 149, which is the hard fringe the review saw around
   * the silhouette. tools/lanecf/respill.py applies the ceiling on the RIM
   * only — her crimson costume facing is inside the silhouette and is hers —
   * so the rim is what is measured, on the bytes the reader was served.
   *
   * AND IT IS DECODED IN NODE, not in the page. A canvas stores premultiplied
   * alpha, so getImageData un-premultiplies and at alpha 0.05 that round trip
   * invents up to ~16 of channel error — which reads as magenta excess and
   * scored this same cut 37/129 in the page against 21/5 in its own bytes. A
   * spill measurement has to be made on the file. */
  const revealCut = await getImg('./assets/actor/irene-street.png');
  if (revealCut) {
    const { data: d, channels } = revealCut;
    let rimN = 0, rimOver = 0, rimMax = 0, solidOver = 0;
    if (channels !== 4) bad('[F12] irene-street.png has no alpha — it cannot be a cut-out');
    else {
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255;
        const ex = (d[i] + d[i + 2]) / 2 - d[i + 1];
        if (a >= 0.02 && a < 0.92) { rimN++; if (ex > rimMax) rimMax = ex; if (ex > SPILL_CEILING) rimOver++; }
        else if (a >= 0.98 && ex > SPILL_CEILING) solidOver++;
      }
      reveal = { rimPx: rimN, rimMaxExcess: +rimMax.toFixed(1), rimOverCeiling: rimOver,
                 solidOverCeiling: solidOver };
      if (!(rimMax <= SPILL_RIM_MAX)) {
        bad(`[F12] the reveal silhouette still has a keying fringe: the softest rim ` +
            `pixel runs ${rimMax.toFixed(1)} of magenta excess (ceiling ` +
            `${SPILL_CEILING}, limit ${SPILL_RIM_MAX}; the shipped cut measured 149)`);
      }
      if (!(rimOver <= SPILL_RIM_OVER_MAX)) {
        bad(`[F12] ${rimOver} rim pixels of the reveal cut are over the spill ceiling ` +
            `(limit ${SPILL_RIM_OVER_MAX}; the shipped cut had 343)`);
      }
      note(`[F12] the reveal cut's rim: max magenta excess ${reveal.rimMaxExcess}, ` +
           `${rimOver} px over the ${SPILL_CEILING} ceiling (was 149 / 343). Her ` +
           `crimson costume inside the silhouette is untouched by design ` +
           `(${solidOver} px, and it is her one accent colour)`);
    }
  }

  /* ---- [F13] THE FIRE IS ON THE REVEAL'S OWN FLOOR ------------------- *
   * The reader is told to stand at the sitting-room window, clicks THAT window,
   * throws the rocket into it — and the smoke used to come out of the storey
   * above. The fire is a difference (street-smoke minus street-window), so the
   * assertion is where that difference LIVES: none of it in the first-floor
   * sash, and a plume in the bay's own glass band. */
  fire = await fireProbe(SASH_BOX, BAY_BAND);
  if (!(fire.sashHot <= SASH_HOT_MAX)) {
    bad(`[F13] the fire is still upstairs: ${fire.sashHot} px of the first-floor ` +
        `sash change between street-window and street-smoke (limit ${SASH_HOT_MAX}; ` +
        `before tools/lanecf/plume_floor.py it was 1874)`);
  }
  if (!(fire.bayFire >= BAY_FIRE_MIN)) {
    bad(`[F13] no fire on the reveal's own floor: only ${fire.bayFire} px of the ` +
        `bay's glass band carry the plume (floor ${BAY_FIRE_MIN}; before, 126)`);
  }
  if (!(fire.plumeLowestRow >= PLUME_ROW_MIN)) {
    bad(`[F13] the plume still starts upstairs: its opaque smoke reaches no ` +
        `lower than row ${fire.plumeLowestRow} (floor ${PLUME_ROW_MIN}; the bay's ` +
        `glass band starts at 318, and before the move it stopped at 265)`);
  }
  note(`[F13] one floor: the first-floor sash carries ${fire.sashHot} px of hot ` +
       `pane (was 1874), the bay's band ${fire.bayFire} px of plume (was 126), and ` +
       `the opaque smoke reaches row ${fire.plumeLowestRow} (was 265) — the bay ` +
       `glass is 318..435`);

  /* ---- [F14] reported here, MEASURED IN THE READ ------------------- *
   * The assertion itself is up in the read loop, at `thewoman`, because the
   * finale plate is raised four units earlier by `valuemore`'s act and stays up:
   * a jump straight to the last unit finds no card, so the only honest place to
   * measure the closing image is the closing frame of an actual read. */
  if (!portrait) {
    bad('[F14] the closing portrait was never measured — the read did not reach ' +
        "`thewoman` with a plate up");
  } else {
    note(`[F14] the closing image is the painted Irene: head box pale ` +
         `${portrait.bytes.pale} / sd ${portrait.bytes.sd} in the file ` +
         `(the mannequin sitter measured 0.184 / 50.7), ${portrait.frame.pale} / ` +
         `${portrait.frame.sd} in the reader's own last frame (the review's ` +
         `measured 0.165 / 49.9), raised at opacity ${portrait.op}`);
  }

  /* [F11] the cameo's four numbers, printed. Its gates are above, on the bytes
     the reader was served; this is the report half. The shipped card scored
     gown 0.00% / hue null / skin 0.00% / green 15.2% — a man in a green jacket
     with no skin on him. */
  if (cameoM) {
    note(`[F11] the Holmes card: ${cameoM.gownPct}% of its circle is the gown's ` +
         `purple at hue ${cameoM.gownHue} (floor ${CAMEO.gownMin}%, hue ` +
         `${CAMEO.hue}+/-${CAMEO.hueTol}), ${cameoM.skinPct}% skin (floor ` +
         `${CAMEO.skinMin}%), ${cameoM.greenPct}% of the wrong man's green ` +
         `(limit ${CAMEO.greenMax}%), raised ${cameoUp && cameoUp.w} px on unit 1`);
  } else {
    bad('[F11] the Holmes cameo card was never measured — its bytes did not load');
  }

  note(`[F9] the armchair at every room lens: ` +
       chairs.map((c) => `${c.unit} ${c.n}px`).join(', ') + ' of coat (limit ' + COAT_MAX + ')');
  if (heads.length !== 6) bad(`only ${heads.length} of the six chapter headings were measured`);
  note(`[F10] headings: ` + heads.map((h) =>
    `${h.key} plate ${h.plate && h.plate.mean} type ${h.type && h.type.max}`).join(' | '));
  if (arrival) {
    note(`[F8] the arrival: the window pane changes ${arrival.worstPct}% of its pixels ` +
         `between frames of unit 10, and the rig crosses it`);
  }
  if (lodge) {
    note(`[F1] the man at the lodge: ${lodge.plateH} plate px (${lodge.doorRatio}x the ` +
         `door leaf), head ${lodge.headCss} CSS px, feet ${lodge.dy} px off the floor line`);
  }

  const out = {
    ok: fail.length === 0,
    ms: Date.now() - t0,
    units: { total: units.length, entered: seen.length, order: seen },
    beats: beats.map((b) => ({ ...b, entered: beatsSeen[b.n] || 0 })),
    lane: { heads, chairs, arrival, lodge, nortonMatte, cameo: cameoM, cameoUp,
            deadBands: bandRows.slice(0, 12), limit: LANDSCAPE_MAX },
    /* the CHURCH + FINALE lane's own evidence, one entry per defect */
    laneCF: { cast: churchCast, cloth, clothAll, feet: churchFeet,
              feetLine: churchFeetLine, frame: churchFrame, sole: churchSole,
              composite: churchComposite, lens: churchLens,
              sovereign, reveal, fire, portrait },
    gates, turns, ruse, latchProof, roll, feet, holmesWalk, kingPainted, gaps,
    audio: { bed: audio.bed, cues: audio.cues, decoded: audio.decoded,
             fired: audio.log.map((l) => `${l.kind}:${l.id}@${l.t}`) },
    shots: Object.fromEntries(Object.entries(beatsSeen).filter(([k]) => k.startsWith('shot:'))),
    failures: fail,
  };
  fs.writeFileSync(path.join(SHOTS, 'lap.json'), JSON.stringify(out, null, 1));
  await browser.close();
  srv.close();
  console.log('\n' + (fail.length ? `LAP FAILED (${fail.length})` : 'LAP CLEAN') +
              `  ${((Date.now() - t0) / 1000).toFixed(1)}s  shots -> ${SHOTS}`);
  process.exit(fail.length ? 1 : 0);
}

const kill = setTimeout(() => { console.log('LAP TIMEOUT'); process.exit(2); }, TIMEOUT);
kill.unref?.();
main().catch((e) => { console.error('LAP CRASH', e); process.exit(3); });
