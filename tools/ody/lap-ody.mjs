/**
 * lap-ody.mjs — ONE SCRIPTED READ OF THE WHOLE OF BOOK IX, end to end, against
 * the real page. 81 units, six beats, six gates (G6 twice), four page turns
 * plus the closing-card turn, three SETS. Adapted from tools/living/lap.mjs —
 * the same architecture: serve-or---base, the full read walked by each unit's
 * REAL verb, every gate proven by MISSING it first, soft-fail tolerance,
 * verbatim margin text against the contract's own tables, the lazy-load law,
 * zero console errors, per-beat screenshots, LAP CLEAN / LAP FAILED.
 *
 * THE FACT LIST IS THE ASSERTION LIST (PIPELINE-LIVING.md §3.4): every fact
 * O.1–O.14 of CONTENT-odyssey.md's comprehension contract gets a gate that
 * measures its carrier ON SCREEN at the unit that carries it:
 *   O.1   smoke pixels in the `smoke` lens + the POLYPHEMUS cameo's SINGLE eye
 *   O.2   the wineskin inset raised on `misgave` + dark goatskin in its bytes
 *   O.3   the cheese-rack lens actually contains loaded racks (pixel class)
 *   O.4   boulder pixels fill the mouth at `boulder` (open-vs-shut luma)
 *   O.5   the sword DRAWN at the gate + the pan reaching the stone
 *   O.6   the clutch tableau IDENTICAL at the three meals (box + masked diff)
 *   O.7   the bowl fills ∝ hold + three pour beats (fill, pours.n, drink pose)
 *   O.8   `noman` margin text verbatim (+ the price adjacent)
 *   O.9   ember glow ∝ hold + the stake TIP inside the eye box on the clock
 *   O.10  the neighbour lamplight rises then RECEDES (two samples)
 *   O.11  ram-great-slung CROSSES the mouth band + the stroke hand over him
 *   O.12  the defy gate resolves only on the SECOND cyclops click, over the plea
 *   O.13  'Neptune' verbatim in both carrier units' margin
 *   O.14  the curse pose's raised-arms box + rock 2's splash + `heard` entered
 * PLUS the generalized sherlock laws: the landscape+portrait dead band, feet
 * on the ledger's floor lines for every standing actor, THE PARKING LAW
 * against the ledger's painted obstacles (racks / pens / boulder-shut /
 * woodpile / lamps — the cave sprawl-vs-pens clearance is the ledger's own
 * number), heading luma on every head unit, and the cameo raised at the right
 * units.
 *
 * Usage: node tools/ody/lap-ody.mjs [--shots DIR] [--port N] [--headed]
 *        node tools/ody/lap-ody.mjs --base https://…/living-odyssey
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodePng, pixelDiff } from '../png.mjs';
import { edgeBands, LANDSCAPE_MAX } from '../living/lenslaw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living-odyssey');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = path.resolve(argv('--shots', path.join(ROOT, 'shots', 'ody-lap')));
const PORT = +argv('--port', 8811);
const TIMEOUT = +argv('--timeout', 600000);
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

/* ---- THE TWO LAWS THIS LAP READS FROM DISK ---------------------------- *
 * CONTENT-odyssey.md is the text's law (the six beat tables), and
 * tools/ody/ledger.json is the world's (floors, painted obstacles, marks,
 * scales). Nothing below re-measures either. */
const LEDGER = JSON.parse(fs.readFileSync(path.join(HERE, 'ledger.json'), 'utf8'));
/* tools/ody/strips.json — the strip REGISTRY: cells build-gated by
 * strip_slice_gate.py, per-frame foot anchors measured off each cell's own
 * alpha, and the sha256 of the file as shipped. The lap asserts the served
 * bytes ARE the registry's (the identity gate). */
const STRIPS = JSON.parse(fs.readFileSync(path.join(HERE, 'strips.json'), 'utf8'));

function contentUnits() {
  const md = fs.readFileSync(path.join(ROOT, 'CONTENT-odyssey.md'), 'utf8');
  const BEAT = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  const out = [];
  let beat = null;
  for (const line of md.split('\n')) {
    const m = /^## Beat ([IVX]+) ·/.exec(line);
    if (m) { beat = BEAT[m[1]]; continue; }
    if (/^## /.test(line) && !m) { if (!/^## Beat/.test(line)) beat = null; }
    if (beat === null || !line.startsWith('|')) continue;
    const c = line.split('|').map((s) => s.trim());
    if (!/^\d+$/.test(c[1] || '')) continue;
    const id = (c[2] || '').replace(/`/g, '');
    if (!/^ody-/.test(id)) continue;
    let prefix = (c[3] || '').replace(/\*\*/g, '').trim();
    if (prefix === '—') prefix = '';
    const text = c[4] || '';
    const head = /-00-head$/.test(id) || /^(chapter|beat) heading/.test(text);
    out.push({ beat, n: +c[1], id, prefix, text, head });
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

/* ======================= THE NUMBERS, AND WHY ==========================
 * Every one is either the ledger's own number, the sherlock lap's measured
 * constant carried over with its provenance, or a floor set to fail the
 * DEFECT the gate exists for. None is tuned to pass the working tree.
 * ===================================================================== */

/* [heads] the sherlock F10 pair, restated for a book whose cave states are
 * honestly dark: the broken frame (a heading shot under the raised cover)
 * measured mean 12 / max 19 in the shipped review, and every honest heading
 * peaked over 230. A dark predawn painting can run a low MEAN and still be a
 * painting, so the gate is mean AND max: a covered frame fails both. */
const HEAD_PLATE_MEAN_MIN = 14;
const HEAD_PLATE_MAX_MIN = 100;
const HEAD_TYPE_MIN = 120;   // the heading's own type peaks 236 on a good frame
const HEAD_DWELL_MAX = 0.7;  // s of a heading's dwell gone before it is visible
                             // (the shot lands ~0.15 s in by this lap's pacing)

/* [O.1] the smoke: the set's own containment number (snapshot smoke.visible
 * is >= 0.8 in BOTH orientations), plus pixels — the columns must be pale
 * against their own sky. Column strips vs the gaps between them. */
const SMOKE_CONTAIN_MIN = 0.8;
const SMOKE_EXCESS_MIN = 2.0;      // mean luma, column band minus gap band
const SMOKE_PALE_MIN = 300;        // desaturated-pale device px in the band
/* [O.1] the cameo's single eye, calibrated ON THE SHIPPED CARD's own palette
 * (tools/ody/work probes, 2026-08-15): the giant's skin is warm tan
 * (hue 5-48, sat >= 0.25, luma 55-210 — 30.1% of the circle), and the EYE is
 * the card's one AMBER patch (hue 18-40, sat >= 0.55, luma 80-170) — it
 * clusters at x 700-840, y 240-320 with 718 samples against stray specks of
 * <= 6. A two-eyed face clusters twice; a faceless card clusters zero; the
 * sherlock human-skin rule read 0.07% here and was the wrong palette. */
const CAMEO_SKIN_MIN = 8.0;        // % of the circle (measured 30.1)
const EYE_CLUSTERS = 1;
const EYE_MAIN_MIN = 200;          // samples in the one iris cluster (measured 718)
const EYE_SPECK_FRAC = 0.15;       // a second cluster under this is jpeg speckle
/* [O.2] the inset's bytes: a dark goatskin is dark paint with structure. A
 * blank/washed card fails both floors. */
const INSET_UP_MIN = 0.9;
const INSET_DARK_MIN = 0.10;       // fraction of the card's core, luma < 70
const INSET_SD_MIN = 22;
/* [O.3] the racks: pale cheese pixels inside the ledger's rack boxes, at the
 * racks-sweep lens. An empty rack (or a lens off the racks) fails. */
const CHEESE_PX_MIN = 400;         // device px, dpr 2, across racks A..C
/* [O.4] the mouth: the boulder is a PAINTED STATE SWAP (the lane shipped it
 * in both positions), so the aperture's own pixels must CHANGE hard between
 * open and shut — measured 29.4 open vs 64.7 shut on the shipped plates (the
 * shut stone catches the firelight, so the direction is the art's, not the
 * gate's) — and the mouth's light channel must go out with it. A missing
 * boulder leaves the ratio near 1. */
const MOUTH_CHANGE_MIN = 1.5;      // luma ratio, either direction
const MOUTH_GAIN_MAX = 0.05;       // the shut state's mouth emissive channel
/* [O.5] the pan: the camera has to REACH the stone (mouth lens centre 345)
 * inside the pan window, from the sword lens at 740. */
const PAN_NEAR_MAX = 60;           // plate px, closest approach to x=345
/* [O.6] the meals: same pose, same mark (bob is ±1.2 px), and the masked,
 * mean-normalised pixel diff of the clutch cut between meals. The mean is
 * removed because the three meals are lit by three painted states (embers /
 * predawn / shut) by design; what may NOT differ is the staging. */
const MEAL_SEG_T = 3.0;            // sample the identical curve at segK 0.5
const MEAL_BOX_TOL = 4.0;          // plate px of drift allowed between meals
const MEAL_DIFF_MAX = 0.30;        // fraction of masked px changed > 26 luma
/* [O.7]/[O.9] the two holds: fill/glow ride the hold (watermark law), so at
 * a partial hold the fill must TRACK k, and only a full hold resolves.
 * AMENDMENT 2026-08-16 (rest is allowed): both big holds carry `rest: true`
 * now — a release PERSISTS the progress (no decay, no reset) and the hold
 * resumes on re-press. The old decay assertion is inverted: the [rest] gate
 * fills to ~50%, lets go for 2 s, and holds that NOTHING dropped. */
const HOLD_TRACK_TOL = 0.22;
const REST_K_TOL = 0.01;           // k after a 2 s rest, vs k at release
const REST_CARRIER_TOL = 0.05;     // the fill/glow the k carries, same law
/* [release] the RELEASE verb (myname, AMENDMENT 2026-08-16): press >= this
 * threshold arms the shout; the advance must land ON the release frame. */
const RELEASE_THRESHOLD = 0.6;     // units.js ody-vi-07-myname hold, verbatim
/* [memory] HESITATION MEMORY (defy, AMENDMENT A2): main.js times the pause
 * from the defy gate arming to its resolving click and the closing card's
 * sub gains ONE clause by the 4 s threshold — under it the eager clause,
 * at/over it the reluctant one. The two strings are units.js END_CARD's own
 * (subEager/subHeld); the lap asserts each clause at a lap that earned it. */
const HESIT_EAGER_S = 4;                                   // main.js, verbatim
const HESIT_EAGER_RE = /he gave the monster his name at once/;
const HESIT_HELD_RE = /he held his name as long as he could/;
const POUR_CUES_MIN = 3;           // entry pour + two pantomime refills
/* [O.9] the stake tip during the blinding clock: pinned on the measured EYE
 * (cave.js's own drive anchor, restaged per the round-2 eye review E2 — the
 * sprawl right of the fire, head toward it), and asserted at BOTH the auger
 * AND the bore CLOCK TICKS: the round-2 gate sampled once and missed the
 * auger-tick miss. */
const EYE = [672, 512];            // cave.js's own drive anchor (E2 restage)
const TIP_TOL = 5;                 // px of pin error allowed
const EYE_BOX = 20;                // "inside the eye box" half-size
const DRIVE_TICKS = { auger: 4.2, bore: 7.4 };   // cave.js DRIVE, verbatim
/* [O.10] the seams: three lamplight seams, sum of opacities. Risen by drive
 * ~16 (rises 12.6/13.3/14.0), gone after the recede (24/25.6/27.2 + 2.4). */
const SEAM_PEAK_MIN = 0.9;
const SEAM_GONE_MAX = 0.15;
/* [O.11] the ram at the mouth: the ledger's mark (395,438), the mouth band's
 * x span 290..405 (ledger objects.mouthAperture), and the stroke cut over him. */
const MOUTH_X = [290, 405];
const RAM_CROSS_MIN = 20;          // plate px of the ram box inside the band
/* [O.14] the curse: the arms-up cut is 105 px against the 89 px stand (the
 * stage proof's own arithmetic), so the box must grow AND its top must rise. */
const CURSE_H_RATIO_MIN = 1.10;
const CURSE_TOP_RISE_MIN = 6;      // plate px, world-scaled comparison
const CURSE_VEIL_MIN = 0.15;       // "sky darkened a stop"
const SPLASH_PALE_MIN = 200;       // device px of plume at rock 2's wash
/* [feet] the ledger's floors. Cave is a REGION between two polylines; shore
 * is per-line vertical bands (the ledger's own band numbers + jitter slack);
 * sea is the ledger's marks verbatim (the whole world scales together). */
const FEET_SLACK = 8;
/* [parking] foot strictly inside a registered painted obstacle = violation;
 * the sprawl's own clearance law is the ledger's >= 10 px, read off the
 * snapshot the set re-measures every frame. */
const SPRAWL_CLEAR_MIN = 10;
/* [idle] MICRO-IDLE (the sherlock King law, room.js stepKing, ported): a
 * SETTLED principal breathes — translateY(0.7*br for a man / 0.8 for the
 * giant), rotate(<= 0.3 deg), scaleY(1 +/- 0.0035; the sea giant 0.006; the
 * sprawl's chest-rise 0.010) — all about the pinned FEET. The gate samples
 * the set's rendered (transform-applied) idle box 3 s apart, twice, and
 * holds: (a) the box MOVES (a dead cut fails), (b) never past the law's own
 * amplitudes (caps below are peak-to-peak + the rotation's AABB inflation +
 * measurement slack), (c) the FOOT (box bottom) stays put within the bob's
 * own reach, and the mark stays put exactly (feet on the floor line — the
 * [feet] law already proved the mark IS the floor). The sprawl's amplitude
 * was verified against the ledger: the frontPen's tight 11.8 px clearance
 * is an X gap the chest's scaleY cannot touch; its y-clearance is 52 px
 * against a <= 0.7 px rise. Sea boxes ride the world transform's ambient
 * drift, so the sea caps carry its measured <= 2 px allowance. */
const IDLE_DY = { man: 0.7, giant: 0.8, sprawl: 0 };       // the bobs, verbatim
const IDLE_SY = { man: 0.0035, giant: 0.0035, seaGiant: 0.006, sprawl: 0.010 };
const IDLE_ROT_SIN = 0.0105;       // 2*sin(0.3 deg) — the sway's AABB inflation
const IDLE_MOVE_MIN = 0.04;        // plate px: below this the cut is DEAD
const IDLE_SLACK = 0.6;            // plate px of measurement slack
const IDLE_SEA_DRIFT = 2.0;        // the sea world's ambient drift allowance
/* [strips] the sprite-strip laws (sherlock stepKing/stepHolmesWalk carried
 * over): every wired strip must (a) CYCLE while its motion runs — >= 2
 * distinct frames seen, the sherlock 'walk strip never cycled' gate; (b)
 * keep its per-frame FOOT on the mark it was painted at — |dx| and |dy|
 * measured off the RENDERED box (getBoundingClientRect -> toPlate, the
 * verifier that a wrong transform cannot fool) against the set's own pose,
 * the anchor law's proof; (c) BE the registry's build-gated bytes (sha256).
 * Holmes' verifier held worst |dy| 0.45 px; the tolerance is the sherlock
 * lap's 1.5. The rowers alone carry a documented ±1.6 px bench-bob
 * translateY on top (sea.js stepRowers), so their law is 1.5 + 1.7. */
const STRIP_DY_MAX = 1.5;
const STRIP_ROWER_DY_MAX = 3.2;
/* [anti-skate] THE PLANTED FOOT'S OWN LAW (the King law's proof, on top of
 * the anchor law above): placeStrip pins each frame's registry anchor — the
 * planted foot — ON the moving mark, so the foot GLIDES at ground speed by
 * construction and ground speed is the skate. The gate single-steps the sim
 * (FIXED_DT = 1/60) through each walk and holds: while the strip frame (and
 * with it the anchor / the planted foot) is UNCHANGED between consecutive
 * steps, the foot's screen x moves <= 2.5 css px per step — 150 css px/s;
 * the walk that spends more is a slide whatever its frames are doing. Every
 * walk family must be caught MID-MOTION at least 4 times or the gate never
 * ran (a lap hole, not a pass). Frame-swap steps are the anchor law's
 * business (worst |dx|/|dy| at the strip tally), not this gate's. */
const SKATE_MAX = 2.5;                // css px per fixed 1/60 s step
const SKATE_MIN_SAMPLES = 4;          // mid-motion samples per walk family
const SKATE_FAMS = ['shore-ulysses', 'shore-crew', 'crew-cave', 'giant', 'ram'];

/* ---- the ledger's floors + obstacles, transcribed once ---------------- */
const FL = {
  cave: LEDGER.sets.cave.floors,
  shore: LEDGER.sets.shore.floors,
  sea: LEDGER.sets.sea.floors,
};
const CAVE_OBJ = LEDGER.sets.cave.objects;
const OBSTACLES = (() => {
  const o = { cave: [], shore: [], sea: [] };
  for (const [k, b] of Object.entries(CAVE_OBJ.racks)) {
    o.cave.push({ name: 'rack' + k, box: [b[0][0], b[0][1], b[1][0], b[1][1]] });
  }
  const box2 = (b) => [b[0][0], b[0][1], b[1][0], b[1][1]];
  o.cave.push({ name: 'mainPen', box: box2(CAVE_OBJ.mainPen) });
  o.cave.push({ name: 'frontPen', box: box2(CAVE_OBJ.frontPen) });
  o.cave.push({ name: 'woodpile', box: box2(CAVE_OBJ.firewood) });
  /* the two wall lamps, as thin columns (the chase-lamp pattern) */
  o.cave.push({ name: 'lampL', box: [238, 320, 258, 396] });
  o.cave.push({ name: 'lampR', box: [1250, 335, 1270, 411] });
  /* boulder-shut: the mouth aperture IS the stone while a shut-family state
     is up — a foot inside it is a man standing in the boulder */
  o.cave.push({ name: 'boulder-shut', box: box2(CAVE_OBJ.mouthAperture), whenShut: true });
  o.sea.push({ name: 'clifftopBoulders',
               box: box2(LEDGER.sets.sea.objects.clifftopBoulders) });
  return o;
})();

const polyY = (poly, x) => {
  if (x <= poly[0][0]) return poly[0][1];
  for (let i = 1; i < poly.length; i++) {
    if (x <= poly[i][0]) {
      const [x0, y0] = poly[i - 1], [x1, y1] = poly[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return poly[poly.length - 1][1];
};

/* ---- pixel helpers on a decoded frame --------------------------------- */
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
/** pale, desaturated pixels (smoke, splash plume, cheese rounds share the
 *  signature; each caller sets its own luma floor) */
function paleCount(f, r, lmin, satMax = 0.30) {
  let n = 0;
  const x1 = Math.max(0, Math.round(r.x)), y1 = Math.max(0, Math.round(r.y));
  const x2 = Math.min(f.width, Math.round(r.x + r.w));
  const y2 = Math.min(f.height, Math.round(r.y + r.h));
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const [R, G, B] = pxAt(f, x, y);
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const s = mx ? (mx - mn) / mx : 0;
    if (lum([R, G, B]) >= lmin && s <= satMax) n++;
  }
  return n;
}
const inBox = (p, b) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];
const rectI = (a, b) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
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
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => consoleErrors.push('requestfailed: ' + r.url()));

  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
  note(`reading ${URL_}`);
  await page.evaluate(() => window.__mute(true));
  note(`booted in ${Date.now() - t0} ms (leaf 1 only — cave and sea are lazy)`);

  const frames = {};                 // shot name -> decoded frame
  const bandOf = {};                 // shot name -> dead-band metric + context
  const dwellAtShot = {};
  const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
  const st = () => page.evaluate(() => window.__state());
  const click = () => page.evaluate(() => window.__click());
  const stageBox = () => page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
  });
  /** a plate rect -> SCREENSHOT px (dpr 2) at the camera as it stands NOW.
   *  (Camera only — the sea's world transform is measured off live DOM rects
   *  instead, because plate space is not screen space there.) */
  const plateBox = async (rect) => (await page.evaluate(() => window.__renderNow()),
    page.evaluate((r) => {
      const s = window.__refs.stage;
      const a = s.toScreen(r[0], r[1]), b = s.toScreen(r[0] + r[2], r[1] + r[3]);
      return { x: a.x * 2, y: a.y * 2, w: (b.x - a.x) * 2, h: (b.y - a.y) * 2 };
    }, rect));
  const shot = async (name) => {
    await page.evaluate(() => window.__renderNow());
    const buf = await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    try {
      frames[name] = decodePng(buf);
      const box = await stageBox();
      const s = await st();
      const b = edgeBands(frames[name], box);
      bandOf[name] = { ...b, dim: s.stage.plate.dim, blank: s.blankLeaf,
                       unit: s.unit && s.unit.key, set: s.set,
                       portrait: s.view.portrait };
      if (s.unit) dwellAtShot[s.unit.key] = s.unitT;
    } catch (_) { /* stats are a bonus */ }
    return name;
  };
  const imgCount = () => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name)).length);
  /** decode any served bitmap's pixels — through the page for jpegs, so with
   *  --base every probe below measures the deployed bytes */
  const getImg = async (rel) => {
    const res = await page.request.get(new URL(rel, URL_).toString());
    if (!res.ok()) { bad(`asset ${rel} did not load (${res.status()})`); return null; }
    try { return decodePng(await res.body()); }
    catch (e) {
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

  /* ---- 0. shape: the app against the two laws --------------------------- */
  const units = await page.evaluate(() => window.__units());
  const beats = await page.evaluate(() => window.__beats());
  const law = contentUnits();
  if (units.length !== 81) bad(`unit count ${units.length}, the book is 81`);
  if (law.length !== 81) bad(`CONTENT-odyssey.md parsed ${law.length} rows, expected 81`);
  const lawById = Object.fromEntries(law.map((L) => [L.id, L]));
  let textMismatch = 0, checked = 0;
  units.forEach((u, i) => {
    const L = law[i];
    if (!L) return;
    if (u.id !== L.id) bad(`#${i} id '${u.id}' != law '${L.id}'`);
    if ((u.speaker || '') !== L.prefix) {
      bad(`#${i} ${u.key}: prefix '${u.speaker}' != law '${L.prefix}'`);
    }
    if (L.head) return;               // heads carry display titles, not Butler
    checked++;
    if (norm(u.text) !== norm(L.text)) {
      textMismatch++;
      bad(`#${i} ${u.key} TEXT DRIFT\n    app: ${norm(u.text).slice(0, 120)}\n    law: ${norm(L.text).slice(0, 120)}`);
    }
  });
  if (!textMismatch) note(`verbatim: ${checked}/${checked} spoken units match CONTENT-odyssey.md exactly`);

  /* the beat table: heading/SET/leaf/counts, CONTENT-odyssey.md §"The beats"
   * (beats III and IV share leaf 3; beat VI's heading rides its first unit) */
  const BEAT_LAW = [[1, 'I', 'shore', 1, 13], [2, 'II', 'cave', 2, 14],
    [3, 'III', 'cave', 3, 14], [4, 'IV', 'cave', 3, 13],
    [5, 'V', 'cave', 4, 13], [6, 'VI', 'sea', 5, 14]];
  BEAT_LAW.forEach(([n, num, set, leaf, count]) => {
    const b = beats[n - 1];
    if (!b || b.num !== num || b.set !== set || b.leaf !== leaf || b.units !== count) {
      bad(`beat ${n}: app says ${JSON.stringify(b)}, law says ${num}/${set}/leaf ${leaf}/${count}`);
    }
  });
  note('the beat table matches the contract (III and IV share leaf 3; VI has no head unit)');
  const boot = await st();
  if (!boot.stage.mounted || boot.stage.mounted.length !== 1 || boot.stage.mounted[0] !== 'shore') {
    bad(`lazy law: boot built ${JSON.stringify(boot.stage.mounted)} — only 'shore' may exist at __ready`);
  }

  /* ---- [strips] identity: every wired strip FILE is the registry's ------- *
   * The cells were gated at build (strip_slice_gate.py: identity/scale/
   * anchors/action); what the page serves must be those bytes and no others,
   * or every anchor the sets transcribed is a number about a different file. */
  {
    let shaOK = 0;
    for (const [name, s] of Object.entries(STRIPS)) {
      const res = await page.request.get(new URL('./assets/' + s.file, URL_).toString());
      if (!res.ok()) { bad(`[strips] ${name}: ${s.file} did not load (${res.status()})`); continue; }
      const sha = createHash('sha256').update(await res.body()).digest('hex');
      if (sha !== s.sha256) {
        bad(`[strips] ${name}: the served ${s.file} is NOT the registered build-gated ` +
            `file (sha ${sha.slice(0, 12)}… != registry ${String(s.sha256).slice(0, 12)}…)`);
      } else shaOK++;
    }
    if (shaOK === Object.keys(STRIPS).length) {
      note(`[strips] identity: ${shaOK}/${shaOK} served strip files match their build-gated registry sha`);
    }
  }

  /* ---- [strips] the registry is SHIPPED, and shipped VERBATIM ------------ *
   * The sets read n / cell / srcH / anchors from app/strips.js (the n=4 ->
   * n=10 seedance recut is why no set may hardcode a frame count again); that
   * module must deep-equal tools/ody/strips.json, or every driver on the page
   * is tuned to a registry other than the one the cells were gated against. */
  {
    const res = await page.request.get(new URL('./app/strips.js', URL_).toString());
    if (!res.ok()) {
      bad(`[strips] app/strips.js (the shipped registry) did not load (${res.status()})`);
    } else {
      const m = /export const STRIPS =\n([\s\S]*?);\s*$/.exec(await res.text());
      let shipped = null;
      try { shipped = m && JSON.parse(m[1]); } catch (_) { /* falls to bad below */ }
      if (!shipped) {
        bad('[strips] app/strips.js does not carry a parseable STRIPS registry');
      } else if (JSON.stringify(shipped) !== JSON.stringify(STRIPS)) {
        bad('[strips] the SHIPPED registry (app/strips.js) has drifted off ' +
            'tools/ody/strips.json — the drivers are reading different numbers ' +
            'than the cells were gated against');
      } else {
        note('[strips] the shipped registry deep-equals tools/ody/strips.json (' +
             Object.entries(shipped).map(([k, s]) => `${k} n=${s.n}`).join(', ') + ')');
      }
    }
  }

  /* ---- the evidence the read collects ----------------------------------- */
  const seen = [];
  const beatsSeen = {};
  const gates = [];
  const gatesDone = new Set();       // one dispatch per gate unit, whatever happens
  const turns = [];
  const heads = [];
  const feetBad = [];
  const parkBad = [];
  let feetSamples = 0, parkSamples = 0;
  /* THE INSET LAW (CONTENT §2/§6): the chapter mints exactly ONE inset, it
     rises on `misgave`, and "the completing click drops the plate". A plate
     that is still up on any later unit owns a frame it was never granted —
     and it also silently exempts that frame from every dim-gated law below,
     which is why it is asserted BY NAME and not left to the side effects. */
  const insetStuck = [];
  const sprawlLedger = [];
  const cameoLog = [];
  const meals = [];                  // {key, box, crewN, pose, rect, frame}
  const facts = {};                  // fact id -> the evidence line
  let latchProof = null;
  const restProof = {};              // [rest] per big hold: k across the 2 s rest
  let releaseProof = null;           // [release] myname's held/released evidence
  let mouthOpenLuma = null;
  let seaStandBox = null;
  let lastId = null, page_ = 1, leafImgs = await imgCount();
  let turnWall0 = 0, turnCharged = false, turnGuard = 0;
  const TURN_WALL_BUDGET = +argv('--turn-budget', 25);

  const latchProbe = async (u) => {
    const s0 = await st();
    if (!s0.blocked) return;
    const before = s0.i;
    await click();
    const held = await st();
    if (held.i !== before) bad(`${u.key}: paged past its ${s0.blocked} without waiting`);
    else if (!held.latch) bad(`${u.key}: the click inside its ${s0.blocked} window was LOST, not latched`);
    else if (!latchProof) latchProof = { unit: u.key, blocked: s0.blocked, latchedAt: held.t };
  };

  /** wait out a blocked unit (the latch spends itself into the advance) */
  const waitRelease = async (u, perSample) => {
    for (let i = 0; i < 120; i++) {
      const q = await st();
      if (!q.unit || q.unit.id !== u.id || q.turn.active || q.end.active) return true;
      if (perSample) await perSample(q);
      await T(0.4);
    }
    const why = await st();
    bad(`${u.key}: never released (blocked=${why.blocked}, t=${why.t})`);
    return false;
  };

  /* ---- [heads] a heading is lit, or it is not a heading ---------------- */
  const checkHeading = async (u, shotName, newLeaf) => {
    const box = await stageBox();
    const hl = await page.evaluate(() => {
      const p = document.querySelector('.blk.head p');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
    });
    const cover = await page.evaluate(() =>
      +getComputedStyle(document.getElementById('cover')).opacity);
    const f = frames[shotName];
    const plate = f ? lumaStats(f, box) : null;
    const type = f && hl ? lumaStats(f, hl) : null;
    heads.push({ key: u.key, cover, plate, type, dwellSpent: dwellAtShot[u.key], newLeaf });
    if (cover > 0.02) bad(`${u.key}: the heading was captured under a cover at opacity ${cover}`);
    if (!plate || !(plate.mean >= HEAD_PLATE_MEAN_MIN && plate.max >= HEAD_PLATE_MAX_MIN)) {
      bad(`${u.key}: the set behind the heading is unlit — plate mean ${plate && plate.mean} ` +
          `/ max ${plate && plate.max} (floors ${HEAD_PLATE_MEAN_MIN}/${HEAD_PLATE_MAX_MIN}; ` +
          `the covered frame the law exists for measured 12/19)`);
    }
    if (!type || !(type.max >= HEAD_TYPE_MIN)) {
      bad(`${u.key}: the heading's own type is not legible — brightest pixel ` +
          `${type && type.max} (floor ${HEAD_TYPE_MIN})`);
    }
    const spent = dwellAtShot[u.key];
    if (newLeaf && !(spent <= HEAD_DWELL_MAX)) {
      bad(`${u.key}: ${spent}s of its dwell was already gone at the first visible ` +
          `frame (limit ${HEAD_DWELL_MAX}s — a unit must not age under the cover)`);
    }
  };

  /* ---- [feet]+[parking], sampled at every settled unit ------------------ */
  const footLaw = async (u, q) => {
    const sn = q.stage || {};
    if (sn.plate && sn.plate.dim > 0.5) return;    // the frame is the card's —
                                                    // legal ONLY under the inset
                                                    // law asserted above
    if (sn.seg) return;                             // pantomime mid-flight is not a settle
    feetSamples++;
    const feet = [];                                // { who, x, y }
    if (sn.set === 'cave' && sn.cast) {
      const U = sn.cast.ulysses;
      if (U && U.op > 0.5 && U.kind !== 'walk') feet.push({ who: 'ulysses', x: U.mark[0], y: U.mark[1] });
      (sn.cast.crew || []).forEach((c, i) => {
        if (c.op > 0.5) feet.push({ who: 'crew' + i, x: c.mark[0], y: c.mark[1] });
      });
      const G = sn.giant;
      if (G && G.pose && !['away', 'sprawl'].includes(G.pose)) {
        feet.push({ who: 'giant:' + G.pose, x: G.mark[0], y: G.mark[1], tol: 14 });
      }
      if (sn.flock && sn.flock.ram && sn.flock.ram.on && sn.flock.ram.at) {
        feet.push({ who: 'great-ram', x: sn.flock.ram.at[0], y: sn.flock.ram.at[1], tol: 12 });
      }
      for (const f of feet) {
        const down = polyY(FL.cave.downstageEdge.polyline, f.x);
        const upOK = f.x >= 450 && f.x <= 1020;
        const up = upOK ? polyY(FL.cave.upstageLimit.polyline, f.x) : null;
        const slack = (f.tol || 0) + FEET_SLACK;
        if (f.y > down + slack || (up !== null && f.y < up - slack)) {
          feetBad.push(`${u.key}: ${f.who} foot (${f.x.toFixed(0)},${f.y.toFixed(0)}) is off ` +
                       `the cave floor region [${up === null ? '—' : up.toFixed(0)}..${down.toFixed(0)}]`);
        }
      }
      /* THE PARKING LAW, cave: no settled foot inside a registered obstacle */
      parkSamples++;
      const shut = sn.caveState && ['shut', 'embers', 'predawn'].includes(sn.caveState.name);
      for (const f of feet) {
        for (const o of OBSTACLES.cave) {
          if (o.whenShut && !shut) continue;
          if (inBox([f.x, f.y], o.box)) {
            parkBad.push(`${u.key}: ${f.who} SETTLES inside ${o.name} ` +
                         `(foot ${f.x.toFixed(0)},${f.y.toFixed(0)} in [${o.box.join(',')}])`);
          }
        }
      }
      /* the sprawl's own clearance is the ledger's law, re-measured live */
      if (sn.sprawl && sn.sprawl.box) {
        sprawlLedger.push({ unit: u.key, ...sn.sprawl.clear, ok: sn.sprawl.ok });
        if (sn.sprawl.ok !== true) {
          bad(`${u.key}: [parking] the sprawl violates the pen clearances — ` +
              `${JSON.stringify(sn.sprawl.clear)} (law >= ${SPRAWL_CLEAR_MIN})`);
        }
      }
    }
    if (sn.set === 'shore' && sn.cast) {
      const lines = [
        { poly: FL.shore.beach.polyline, band: FL.shore.beach.band, dom: [270, 640] },
        { poly: FL.shore.mainlandApron.polyline, band: FL.shore.mainlandApron.band, dom: [920, 1070] },
        { poly: FL.shore.mainlandYard.polyline, band: FL.shore.mainlandYard.band, dom: [910, 1120] },
      ];
      const all = [];
      const U = sn.cast.ulysses;
      if (U && U.op > 0.5 && !U.moving) all.push({ who: 'ulysses', x: U.mark[0], y: U.mark[1] });
      (sn.cast.crew || []).forEach((c, i) => {
        if (c.op > 0.5) all.push({ who: 'crew' + i, x: c.mark[0], y: c.mark[1] });
      });
      for (const f of all) {
        let ok = false, nearest = null;
        for (const L of lines) {
          if (f.x < L.dom[0] || f.x > L.dom[1]) continue;
          const dy = Math.abs(f.y - polyY(L.poly, f.x));
          if (nearest === null || dy < nearest) nearest = dy;
          if (dy <= L.band + FEET_SLACK) { ok = true; break; }
        }
        if (nearest !== null && !ok) {
          feetBad.push(`${u.key}: ${f.who} foot (${f.x.toFixed(0)},${f.y.toFixed(0)}) is ` +
                       `${nearest.toFixed(1)} px off every shore floor line (bands+${FEET_SLACK})`);
        }
      }
    }
    if (sn.set === 'sea') {
      /* the world scales as one; the LAW is the ledger's marks verbatim */
      const M = LEDGER.sets.sea.marks;
      (sn.rowers || []).forEach((r) => {
        const want = M[r.mark] && M[r.mark].at;
        if (want && (r.at[0] !== want[0] || r.at[1] !== want[1])) {
          feetBad.push(`${u.key}: rower ${r.mark} at ${r.at} != ledger ${want}`);
        }
      });
      if (sn.giant && sn.giant.mark) {
        const ledge = polyY(FL.sea.clifftopLedge.polyline, sn.giant.mark[0]);
        if (Math.abs(sn.giant.mark[1] - ledge) > 12) {
          feetBad.push(`${u.key}: the giant's mark ${sn.giant.mark} is off the clifftop ledge (${ledge.toFixed(0)})`);
        }
        for (const o of OBSTACLES.sea) {
          if (inBox(sn.giant.mark, o.box)) {
            parkBad.push(`${u.key}: the giant SETTLES inside ${o.name}`);
          }
        }
      }
      if (sn.ulysses && sn.ulysses.at && sn.ulysses.mark) {
        const want = M[sn.ulysses.mark] && M[sn.ulysses.mark].at;
        if (want && Math.hypot(sn.ulysses.at[0] - want[0], sn.ulysses.at[1] - want[1]) > 9) {
          feetBad.push(`${u.key}: ulysses at ${sn.ulysses.at} is off his ledger mark ` +
                       `'${sn.ulysses.mark}' ${want}`);
        }
      }
    }
  };

  /* ---- [strips] the cycling + foot evidence, sampled in clean windows ---- *
   * (never during the hiss/fright screen shake — the root transform would
   * contaminate the rendered-box proof with the shake's own pixels). Each
   * family accumulates the frames seen and the worst |dx|/|dy| off the
   * rendered box vs the set's own mark; the tally holds the three laws. */
  const stripEv = {};
  for (const k of ['giant', 'crew-cave', 'twist', 'ram', 'rower',
                   'shore-ulysses', 'shore-crew',
                   'milk', 'stroke', 'grope', 'curse', 'run']) {
    stripEv[k] = { frames: new Set(), n: 0, worst: 0, worstAt: null };
  }
  let rowerLockstep = null;
  const sSample = (key, p, unit) => {
    const ev = stripEv[key];
    ev.n++;
    ev.frames.add(p.frame);
    const err = Math.max(Math.abs(p.dx || 0), Math.abs(p.dy || 0));
    if (err > ev.worst) { ev.worst = err; ev.worstAt = unit; }
  };
  /* [bridges] PLAY-ONCE evidence (ody-video2): per bridge PLAY, the frames
   * sampled while the act drove them (bridgeFrame = clamped progress), the
   * anchor-law worst foot error, and the play's own n. The tally holds the
   * play-once law: frames MONOTONE nondecreasing (a bridge can only play
   * forward), the landing frame REACHED (pose B within one frame, by the
   * build's endpoint gate), and each pose-B swap asserted at its own unit. */
  const bridgeEv = {};                // '<key>:<play>' -> { n, frames, worst, at }
  const bSample = (key, tag, b, unit) => {
    const id = key + ':' + tag;
    const ev = bridgeEv[id] = bridgeEv[id] || { n: b.n, frames: [], worst: 0, at: unit };
    ev.frames.push(b.frame);
    const err = Math.max(Math.abs(b.dx || 0), Math.abs(b.dy || 0));
    if (err > ev.worst) ev.worst = err;
  };
  let drinkPlaysSeen = 0;
  const hurlDoneSeen = { rock1: false, rock2: false };
  const CAVE_LOOP_FAM = { milk: 'milk', stroke: 'stroke', grope: 'grope' };
  const stripPoll = (q) => {
    const sn = (q && q.stage) || {};
    const S = sn.strips;
    const unit = q && q.unit && q.unit.key;
    if (sn.set === 'shore' && S) {
      if (S.ulysses) sSample('shore-ulysses', S.ulysses, unit);
      (S.crew || []).forEach((p) => p && sSample('shore-crew', p, unit));
      (S.run || []).forEach((p) => p && sSample('run', p, unit));
    }
    if (sn.set === 'cave' && S) {
      if (S.giant) sSample('giant', S.giant, unit);
      (S.crew || []).forEach((p) => p && sSample('crew-cave', p, unit));
      if (S.twist) sSample('twist', S.twist, unit);
      (S.rams || []).forEach((p) => p && sSample('ram', p, unit));
      if (S.loop && CAVE_LOOP_FAM[S.loop.key]) {
        sSample(CAVE_LOOP_FAM[S.loop.key], S.loop, unit);
      }
      if (S.bridge) {
        const tag = S.bridge.key === 'seize' ? unit
                  : S.bridge.key === 'drink' ? 'play' + S.bridge.play : 'play1';
        bSample(S.bridge.key, tag, S.bridge, unit);
      }
      if (typeof sn.drinkPlays === 'number') {
        drinkPlaysSeen = Math.max(drinkPlaysSeen, sn.drinkPlays);
      }
    }
    if (sn.set === 'sea') {
      const G = sn.giantStrip;
      if (G && G.mode === 'loop') sSample('curse', G, unit);
      if (G && G.mode === 'bridge') bSample('hurl-windup', 'play' + G.play, G, unit);
      if (sn.hurlDone) {
        if (sn.hurlDone.rock1) hurlDoneSeen.rock1 = true;
        if (sn.hurlDone.rock2) hurlDoneSeen.rock2 = true;
      }
      if (sn.rowers) {
        sn.rowers.forEach((r) => r.strip && sSample('rower', r.strip, unit));
        /* the six benches must never stroke in phase-lock while pulling */
        if ((sn.rowEffort || 0) > 0.5 && !rowerLockstep) {
          const fr = sn.rowers.map((r) => r.strip && r.strip.frame);
          if (fr.length === 6 && fr.every((f) => f === fr[0])) {
            rowerLockstep = `frames ${JSON.stringify(fr)} at ${unit}`;
          }
        }
      }
    }
  };
  /* the held segs whose walks the strips now perform: sampled while they run
   * ('strangers' is the milking seg — the giant-milk loop's own window) */
  const STRIP_SEG_KEYS = new Set(['return2', 'return3', 'quiverlid', 'strangers']);

  /* ---- [anti-skate] the single-stepped walk probe ------------------------ *
   * Advances the sim ONE FIXED FRAME (1/60 s) at a time and reads, at every
   * step, each live walk strip's proof (frame + rendered foot + the registry
   * anchor the snapshot now carries) and the live magnification (stage F x
   * cam k — plate px to css px). Consecutive steps that HOLD the frame hold
   * the anchor — the planted foot — and the foot's css drift between them is
   * the skate the tally gates. Every probed proof also feeds the cycling /
   * anchor-law tally, so the two laws measure the same walks. */
  const skateEv = {};
  for (const k of SKATE_FAMS) skateEv[k] = { samples: 0, pairs: 0, worst: 0, worstAt: null };
  const skateProbe = async (unitKey, nFrames = 90) => {
    const rows = await page.evaluate((n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        window.__advance(1 / 60);
        const q = window.__state();
        const sg = window.__refs.stage;
        const sn = (q && q.stage) || {};
        const S = sn.strips || {};
        const w = [];
        if (sn.set === 'shore') {
          if (S.ulysses) w.push(['shore-ulysses', 'u', S.ulysses]);
          (S.crew || []).forEach((p, j) => p && w.push(['shore-crew', 'c' + j, p]));
        } else if (sn.set === 'cave') {
          if (S.giant) w.push(['giant', 'g', S.giant]);
          (S.crew || []).forEach((p, j) => p && w.push(['crew-cave', 'c' + j, p]));
          (S.rams || []).forEach((p, j) => p && w.push(['ram', 'r' + j, p]));
        }
        out.push({ css: sg.F * sg.cam3.k, w });
      }
      return out;
    }, nFrames);
    const held = {};
    for (const row of rows) {
      for (const [fam, id, p] of row.w) {
        const ev = skateEv[fam];
        if (!ev) continue;
        ev.samples++;
        sSample(fam, p, unitKey);
        const prev = held[fam + ':' + id];
        if (prev && p.frame === prev.frame) {   // the anchor held: same planted foot
          ev.pairs++;
          const slide = Math.abs(p.foot[0] - prev.x) * row.css;
          if (slide > ev.worst) { ev.worst = slide; ev.worstAt = unitKey; }
        }
        held[fam + ':' + id] = { frame: p.frame, x: p.foot[0] };
      }
    }
  };

  const marginHas = (q, text, tag) => {
    if (!norm(q.unit.blocks).includes(norm(text))) {
      bad(`${tag}: the margin does not carry the law's text verbatim —\n` +
          `    margin: ${norm(q.unit.blocks).slice(0, 160)}\n    law:    ${norm(text).slice(0, 160)}`);
      return false;
    }
    return true;
  };

  /* ---- the two hold gates, each RESTED FIRST by letting go halfway ------- *
   * AMENDMENT 2026-08-16 (rest is allowed): the early let-go still must not
   * resolve and must not advance, but the progress now PERSISTS — fill to
   * ~50%, rest 2 s, and neither the k nor the carrier it drives may drop. */
  const doHold = async (u) => {
    const isBowl = u.key === 'lookhere';
    const tag = isBowl ? '[O.7]' : '[O.9]';
    const before = (await st()).i;
    /* the rest: press to ~50% of the hold, let go for 2 s. It must not
       resolve, must not advance, and what the hold raised has to STAY UP. */
    await page.evaluate(() => window.__holdStart());
    await T(isBowl ? 0.8 : 1.5);            // ~k 0.5 of 1.6 s / 3.0 s
    const peek = await st();
    const peekFill = await page.evaluate(() => {
      const a = window.__refs.stage.active;
      return { fill: a.bowlFillK == null ? null : +a.bowlFillK.toFixed(3),
               glow: a.stakeGlowOp == null ? null : +a.stakeGlowOp.toFixed(3) };
    });
    await page.evaluate(() => window.__holdEnd());
    await T(2.0);                           // the rest itself
    const letGo = await st();
    const goFill = await page.evaluate(() => {
      const a = window.__refs.stage.active;
      return { fill: a.bowlFillK == null ? null : +a.bowlFillK.toFixed(3),
               glow: a.stakeGlowOp == null ? null : +a.stakeGlowOp.toFixed(3) };
    });
    if (letGo.hold.resolved) bad(`${u.key}: ${tag} the hold resolved on an early release`);
    if (letGo.i !== before) bad(`${u.key}: ${tag} the hold gate advanced on an early release`);
    if (!(peek.hold.k > 0.3 && peek.hold.k < 0.7)) {
      bad(`${u.key}: [rest] the probe missed the ~50% window (k=${peek.hold.k})`);
    }
    if (letGo.hold.k < peek.hold.k - REST_K_TOL) {
      bad(`${u.key}: [rest] the hold DROPPED across a 2 s rest — k ${peek.hold.k} -> ` +
          `${letGo.hold.k} (rest is allowed: progress persists, tol ${REST_K_TOL})`);
    }
    if (isBowl && goFill.fill < peekFill.fill - REST_CARRIER_TOL) {
      bad(`${u.key}: [rest][O.7] the bowl's fill drained across the rest — ` +
          `${peekFill.fill} -> ${goFill.fill} (tol ${REST_CARRIER_TOL})`);
    }
    if (!isBowl && goFill.glow < peekFill.glow - REST_CARRIER_TOL) {
      bad(`${u.key}: [rest][O.9] the ember glow cooled across the rest — ` +
          `${peekFill.glow} -> ${goFill.glow} (tol ${REST_CARRIER_TOL})`);
    }
    restProof[u.key] = { kAtRelease: peek.hold.k, kAfter2s: letGo.hold.k,
                         carrierAtRelease: isBowl ? peekFill.fill : peekFill.glow,
                         carrierAfter2s: isBowl ? goFill.fill : goFill.glow };
    gates.push({ beat: u.beat, gate: (isBowl ? 'bowl' : 'embers') + '-rest',
                 missed: true, resolved: letGo.hold.resolved });
    /* the hold RESUMED from the rested k: the fill/glow must TRACK k (the
       watermark law), at two partial samples, monotone, and complete */
    await page.evaluate(() => window.__holdStart());
    await T(isBowl ? 0.35 : 0.7);
    const m1 = await st();
    const f1 = await page.evaluate(() => {
      const a = window.__refs.stage.active;
      return { fill: a.bowlFillK, glow: a.stakeGlowOp, heat: a.heat ? a.heat() : null };
    });
    await shot(`b${u.beat}-hold-${u.key}-mid`);
    await T(isBowl ? 0.4 : 1.0);
    const m2 = await st();
    const f2 = await page.evaluate(() => {
      const a = window.__refs.stage.active;
      return { fill: a.bowlFillK, glow: a.stakeGlowOp };
    });
    const v1 = isBowl ? f1.fill : f1.glow;
    const v2 = isBowl ? f2.fill : f2.glow;
    if (!(m1.hold.k > 0.15 && m1.hold.k < 0.98)) {
      bad(`${u.key}: ${tag} mid-hold sample missed the window (k=${m1.hold.k})`);
    }
    if (!(Math.abs(v1 - m1.hold.k) <= HOLD_TRACK_TOL)) {
      bad(`${u.key}: ${tag} the ${isBowl ? 'fill' : 'glow'} does not ride the hold — ` +
          `k=${m1.hold.k} but carrier=${v1} (tol ${HOLD_TRACK_TOL}; the watermark law)`);
    }
    if (!(v2 > v1) && m2.hold.k > m1.hold.k) {
      bad(`${u.key}: ${tag} the ${isBowl ? 'fill' : 'glow'} is not monotone with the hold ` +
          `(${v1} -> ${v2} while k ${m1.hold.k} -> ${m2.hold.k})`);
    }
    /* the bowl finishes on a SHORT walk-out: from the rested-and-resumed k the
       full fill is ~0.05 s away, and pour 1's drink bridge (the drain's first
       0.9 s, from pour age 0.3) has to still be YOUNG when the sampling loop
       below reads it — the old 1.2 s spend-down left the bridge half over. */
    await T(isBowl ? 0.35 : 1.6);
    await page.evaluate(() => window.__holdEnd());
    const done = await st();
    if (!done.hold.resolved) bad(`${u.key}: ${tag} the hold never resolved at full`);
    gates.push({ beat: u.beat, gate: isBowl ? 'bowl' : 'embers', missed: 'n/a',
                 resolved: done.hold.resolved });
    if (isBowl) {
      if (!(done.stage.pours && done.stage.pours.n >= 1)) {
        bad(`lookhere: [O.7] pour 1 did not start on the full bowl (${JSON.stringify(done.stage.pours)})`);
      }
      facts['O.7-hold'] = `bowl fill rode the hold (k ${m1.hold.k} -> fill ${v1}), pour 1 on resolve`;
      /* [bridges] pour 1's drink bridge plays on the fresh pour clock —
         sampled here, before the resolved shot, while the drain is young */
      for (let i = 0; i < 7; i++) {
        stripPoll(await st());
        await T(0.2);
      }
    } else {
      if (!(done.stage.drive !== null && done.stage.drive !== undefined && done.stage.drive)) {
        bad(`embers: [O.9] full heat did not fire the blinding clock (drive=${JSON.stringify(done.stage.drive)})`);
      }
      facts['O.9-hold'] = `ember glow rode the hold (k ${m1.hold.k} -> glow ${v1}), drive fired at full`;
    }
    await shot(`b${u.beat}-hold-${u.key}-resolved`);
    await click();                    // a resolved hold advances on the click
  };

  /* ---- the target gates: every one MISSED first -------------------------- */
  const doTarget = async (u) => {
    /* the target must be LIVE before the reader can honestly answer it — the
       sword's glint only breathes once the actor's fade-through walk lands on
       the mark (~1.5 s), so the probe waits the staging out the way a reader
       does, and only a target that NEVER arms is the failure. */
    let pre = await st();
    for (let i = 0; i < 12 && pre.gate.live !== true; i++) { await T(0.4); pre = await st(); }
    if (!(pre.gate.live === true)) {
      bad(`${u.key}: the '${u.target}' gate is armed but its target never came LIVE on stage`);
    }
    /* [G2, per-fix assertion — b2-25-sword.png] the ember hold (G4) belongs
       to Beat IV's own unit; armed early it claims Ulysses to the stake-five
       mark and the sword gate's target can never come LIVE (the shipped ring
       over crew legs). So G2 is proven BY NAME: no ember arm at the sword
       unit, no stake-five claim, and the gate anchor riding the actor
       STANDING the ledger's targetPlate. */
    if (u.key === 'sword') {
      const holdMode = pre.stage.hold && pre.stage.hold.mode;
      if (holdMode === 'embers') {
        bad(`sword: [G2] the ember hold (G4) is armed at the sword unit — ` +
            `Beat IV's arm leaked into Beat II (the b2-25-sword defect)`);
      }
      const form = pre.stage.cast && pre.stage.cast.formation;
      if (form === 'stakefive') {
        bad(`sword: [G2] the stake-five claim holds Ulysses off the sword-ulysses mark`);
      }
      const g2 = pre.stage.gate && pre.stage.gate.sword;
      const GP = (LEDGER.sets.cave.gates.find((g) => g.id === 'G2-sword') || {})
        .targetPlate || [768, 445];
      const off = g2 && g2.at ? Math.hypot(g2.at[0] - GP[0], g2.at[1] - GP[1]) : Infinity;
      if (!(g2 && g2.live === true && off <= 9)) {
        bad(`sword: [G2] targetLive unproven at the mark — live=${g2 && g2.live}, ` +
            `anchor ${JSON.stringify(g2 && g2.at)} vs ledger ${JSON.stringify(GP)} ` +
            `(off ${off.toFixed(1)} px, tol 9; hold.mode=${holdMode}, form=${form})`);
      } else {
        facts['G2-live'] = `sword target LIVE with the anchor ${off.toFixed(1)} px off the ` +
                           `ledger's (${GP}) — Ulysses stands sword-ulysses`;
      }
    }
    const before = pre.i;
    const preRes = (pre.stage.gate && pre.stage.gate.resolutions) || 0;
    const miss = await page.evaluate(() => window.__gateMiss());
    const afterMiss = await st();
    if (miss.advanced || afterMiss.i !== before) bad(`${u.target} gate advanced on a MISS (${u.key})`);
    if (afterMiss.gate.resolved) bad(`${u.target} gate resolved on a MISS (${u.key})`);
    if (!(afterMiss.nudges > 0)) bad(`${u.target} gate did not nudge on a MISS (${u.key})`);
    if (u.key === 'defy') {
      /* [O.12] the miss half: the FIRST resolution must not already have armed
         the name, and the men's plea must still stand under the second gate */
      if (afterMiss.stage.gate && afterMiss.stage.gate.myname) {
        bad(`defy: [O.12] 'myname' was armed BEFORE the second cyclops click`);
      }
      if (!((afterMiss.stage.gate && afterMiss.stage.gate.resolutions) === 1)) {
        bad(`defy: [O.12] expected exactly 1 prior resolution at the second gate, ` +
            `got ${afterMiss.stage.gate && afterMiss.stage.gate.resolutions}`);
      }
    }
    const hit = await page.evaluate(() => window.__gateClick());
    const afterHit = await st();
    const moved = afterHit.i !== before || afterHit.end.active || afterHit.clock.held ||
                  afterHit.turn.active;
    if (!moved) bad(`${u.target} gate did not advance on a HIT (${u.key})`);
    gates.push({ beat: u.beat, gate: `${u.target}@${u.key}`, missed: !miss.advanced,
                 resolved: hit.ok, advanced: moved });
    /* per-gate consequences, measured where the story stages them */
    if (u.key === 'council') {
      // G1: the crossing pantomime owns the frame for 7 s — proven at 'cave'
    }
    if (u.key === 'sword') {
      await T(0.4);
      const q = await st();
      if (!(q.stage.sword && q.stage.sword.drawn)) {
        bad(`sword: [O.5] the reader clicked the sword and no blade was DRAWN (${JSON.stringify(q.stage.sword)})`);
      }
      await shot('b2-gate-sword-drawn');
    }
    if (u.key === 'greatram') {
      await T(2.2);
      const q = await st();
      const ram = q.stage.flock && q.stage.flock.ram;
      if (!(ram && ram.slung)) bad(`greatram: [O.11] the click did not SLING Ulysses under the ram`);
      const slungOp = await page.evaluate(() =>
        +window.__refs.stage.active.ramSlungN.style.opacity);
      if (!(slungOp >= 0.9)) {
        bad(`greatram: [O.11] the slung cut is not up after the gate (opacity ${slungOp})`);
      }
      const uOp = q.stage.cast && q.stage.cast.ulysses && q.stage.cast.ulysses.op;
      if (!(uOp <= 0.2)) {
        bad(`greatram: [O.11] Ulysses is still standing beside the ram he is under (op ${uOp})`);
      }
      await shot('b5-gate-ram-slung');
    }
    if (u.key === 'jeer') {
      const q = await st();
      const g = q.stage.gate || {};
      if (!(g.resolutions === 1 && preRes === 0)) {
        bad(`jeer: [O.12] first cyclops resolution count is ${g.resolutions} (want 1)`);
      }
      if (g.myname) bad(`jeer: [O.12] the FIRST click armed the name — the hubris is the SECOND`);
    }
    if (u.key === 'defy') {
      const q = await st();
      const g = q.stage.gate || {};
      if (!(g.resolutions === 2 && g.myname === true)) {
        bad(`defy: [O.12] the second click did not arm the name (resolutions=${g.resolutions}, myname=${g.myname})`);
      } else {
        facts['O.12'] = 'the name is given only by the reader\'s second click on the Cyclops, over the plea';
      }
    }
  };

  /* ---- the RELEASE verb (myname), FAILED FIRST by a stray click ----------- *
   * AMENDMENT 2026-08-16: press-and-hold is the drawn breath (NO advance while
   * held, the taunt cut swelling on the k), and the story advances ON the
   * frame of the release itself — pressUp resolves it synchronously, so the
   * state read straight after __holdEnd, with no sim step in between, must
   * already have moved. A press under the 0.6 s threshold is a stray click:
   * a beat, not a turn. */
  const doRelease = async (u) => {
    const s0 = await st();
    const before = s0.i;
    const shoutsBefore = ((await page.evaluate(() => window.__audio())).log || [])
      .filter((l) => l.kind === 'cue' && l.id === 'shout').length;
    /* the stray click: under the threshold, the page holds */
    await page.evaluate(() => window.__holdStart());
    await T(0.2);
    await page.evaluate(() => window.__holdEnd());
    await T(0.5);
    const stray = await st();
    if (stray.i !== before || stray.turn.active || stray.end.active) {
      bad(`myname: [release] a 0.2 s stray click turned the page ` +
          `(threshold ${RELEASE_THRESHOLD} s)`);
    }
    /* the breath: press and hold a full second — NO advance while held */
    await page.evaluate(() => window.__holdStart());
    await T(1.0);
    const held = await st();
    if (held.i !== before || held.turn.active || held.end.active) {
      bad(`myname: [release] the story advanced WHILE HELD (i ${before} -> ${held.i})`);
    }
    if (!(held.hold.pressing && held.hold.k >= 1)) {
      bad(`myname: [release] 1 s of hold left k at ${held.hold.k} ` +
          `(threshold ${RELEASE_THRESHOLD} s banks k at 1)`);
    }
    const swell = held.stage.ulysses && held.stage.ulysses.holdK;
    if (!(swell >= 0.9)) {
      bad(`myname: [release] the taunt cut is not swelling on the held k ` +
          `(set holdK ${swell})`);
    }
    await shot('b6-release-myname-held');
    /* the release: the advance lands ON the release frame — the state is read
       with NO sim step after __holdEnd */
    await page.evaluate(() => window.__holdEnd());
    const after = await st();
    const moved = after.i !== before || after.turn.active || after.end.active;
    if (!moved) bad('myname: [release] the shout did not advance ON the release frame');
    const shoutsAfter = ((await page.evaluate(() => window.__audio())).log || [])
      .filter((l) => l.kind === 'cue' && l.id === 'shout').length;
    if (!(shoutsAfter > shoutsBefore)) {
      bad(`myname: [release] the name never RANG — no new 'shout' cue on the release ` +
          `(${shoutsBefore} -> ${shoutsAfter})`);
    }
    gates.push({ beat: u.beat, gate: 'release@myname', missed: true,
                 resolved: moved, advanced: moved });
    releaseProof = { from: before, to: after.i, heldK: held.hold.k, swell,
                     strayHeld: stray.i === before,
                     rangOnRelease: shoutsAfter > shoutsBefore };
    await shot('b6-release-myname-shouted');
  };

  /* ======================= 1. THE READ ================================== */
  let guard = 0;
  let seq = 0;
  while (guard < 700) {
    const s = await st();
    if (s.end.active || s.finished) break;
    const u = s.unit;
    if (!u) break;
    if (s.turn.active) {
      const toPage = (units[s.turn.to] && units[s.turn.to].page) || s.page + 1;
      if (turnGuard++ > 4000) { bad(`the turn to page ${toPage} never completed`); break; }
      if (!turnWall0) { turnWall0 = Date.now(); turnCharged = false; }
      const wall = (Date.now() - turnWall0) / 1000;
      if (wall > TURN_WALL_BUDGET && !turnCharged) {
        turnCharged = true;
        bad(`the turn to page ${toPage} held the cover ${wall.toFixed(1)}s of WALL time`);
      }
      await T(0.4);
      continue;
    }
    if (turnWall0) {
      note(`the turn to page ${s.page} held the cover ${((Date.now() - turnWall0) / 1000).toFixed(1)}s of wall time`);
      turnWall0 = 0;
    }
    guard++;

    if (u.id !== lastId) {
      seen.push(u.key);
      beatsSeen[u.beat] = (beatsSeen[u.beat] || 0) + 1;
      lastId = u.id;
      seq++;

      /* NOTHING ARRIVES WHILE A LEAF IS BEING READ (the lazy-load law). */
      if (u.page !== page_) {
        const now = await imgCount();
        turns.push({ toPage: u.page, set: s.set, fetched: now - leafImgs });
        page_ = u.page; leafImgs = now;
      } else {
        const now = await imgCount();
        if (now !== leafImgs) {
          bad(`${u.key}: ${now - leafImgs} bitmap(s) fetched MID-LEAF — a set arrives ` +
              `under its own cover or it does not arrive`);
          leafImgs = now;
        }
      }

      /* settle into the unit's frame. Heads are shot EARLY so the dwell
         number measures the COVER's theft, not this harness's pacing.
         (unitView carries no `head` flag — the key names them.) */
      const isHead = /^head\d$/.test(u.key || '');
      await T(isHead || u.verb === 'auto' ? 0.15 : 0.85);
      const shotName = `b${u.beat}-${String(seq).padStart(2, '0')}-${u.key}`;
      await shot(shotName);

      const q0 = await st();
      await footLaw(u, q0);
      if (q0.cameo) cameoLog.push({ unit: u.key, ...q0.cameo });
      /* the inset law: no plate may still be up on a unit it was not minted
         for (misgave is the chapter's one grant) */
      if (u.key !== 'misgave' && q0.stage.plate &&
          (q0.stage.plate.wineskin || 0) > 0.1) {
        insetStuck.push({ unit: u.key, op: q0.stage.plate.wineskin });
      }

      /* ---- headings ----------------------------------------------------- */
      if (u.key && /^head\d$/.test(u.key)) {
        const prev = units[u.i - 1];
        await checkHeading(u, shotName, !!prev && prev.page !== u.page);
      }

      /* ---- the per-fact gates, at the unit that carries each ------------ */
      switch (u.key) {
        case 'troy': {
          /* [anti-skate]/[strips] THE WADE WALK: this lap's own pacing cuts
             the landfall seg at iamulysses (fire-ulysses re-states the camp),
             which hands the party to the DAMPED walk — Ulysses covers the
             ~200 px from the shallows to the fire at his honest 1.5 m/s
             across troy/lawless/dawn1, and by `smoke` he has a stride left.
             So HIS walk is single-stepped here, mid-crossing; the council
             re-stage at `smoke` still probes the camp men's own walks. */
          await skateProbe('troy', 90);
          break;
        }
        case 'iamulysses': {
          const c = q0.cameo || {};
          if (!(c.on && c.id === 'ulysses' && /Ithaca/i.test(c.caption || ''))) {
            bad(`iamulysses: the ULYSSES cameo is not raised with the Ithaca caption ` +
                `(O.12's plant): ${JSON.stringify(c)}`);
          }
          break;
        }
        case 'lawless': {
          /* [O.1a] the smoke: the set's own containment proof + pixels */
          const sm = q0.stage.smoke || {};
          if (!(sm.inLandscape >= SMOKE_CONTAIN_MIN && sm.inPortrait >= SMOKE_CONTAIN_MIN)) {
            bad(`lawless: [O.1] the smoke lens does not hold the columns — ` +
                `containment ${sm.inLandscape}/${sm.inPortrait} (floor ${SMOKE_CONTAIN_MIN})`);
          }
          await T(1.6);                       // let the lens land on the lobe
          await shot('b1-O1-smoke-lens');
          const f = frames['b1-O1-smoke-lens'];
          const bandR = await plateBox(sm.box || [940, 0, 230, 200]);
          const sb = await stageBox();
          const R = rectI(bandR, sb);
          let pale = 0, excess = null;
          if (f && R) {
            pale = paleCount(f, R, 60, 0.30);
            /* columns vs the gaps between them, at the same rows */
            const cols = (sm.columns || [[955, 0], [1030, 0], [1140, 60]]);
            let cSum = 0, cN = 0, gSum = 0, gN = 0;
            for (const [cx] of cols) {
              const cR = rectI(await plateBox([cx - 13, 20, 26, 150]), sb);
              const gR = rectI(await plateBox([cx + 25, 20, 22, 150]), sb);
              if (cR) { const s1 = lumaStats(f, cR); cSum += s1.mean * s1.n; cN += s1.n; }
              if (gR) { const s2 = lumaStats(f, gR); gSum += s2.mean * s2.n; gN += s2.n; }
            }
            excess = cN && gN ? +((cSum / cN) - (gSum / gN)).toFixed(2) : null;
          }
          if (!(pale >= SMOKE_PALE_MIN)) {
            bad(`lawless: [O.1] no smoke reads in the columns' band — ${pale} pale px ` +
                `(floor ${SMOKE_PALE_MIN})`);
          }
          if (!(excess !== null && excess >= SMOKE_EXCESS_MIN)) {
            bad(`lawless: [O.1] the smoke columns are not brighter than their own sky — ` +
                `excess ${excess} luma (floor ${SMOKE_EXCESS_MIN})`);
          }
          facts['O.1a'] = `smoke: containment ${sm.inLandscape}/${sm.inPortrait}, ` +
                          `${pale} pale px, column excess ${excess} luma`;
          break;
        }
        case 'smoke': case 'twentyone': {
          /* [strips] the shore crossings: the council re-stage (i-06) and the
             boarding line (i-10) are strip-driven WALKS now — sample while
             the troupe covers the ground (cycled + feet held at the tally).
             [anti-skate] the re-stage is single-stepped first: Ulysses' 120 px
             crossing and the three camp men's short walks, planted feet held
             frame by frame. */
          if (u.key === 'smoke') await skateProbe('smoke', 96);
          for (let i = 0; i < 8; i++) {
            const q = await st();
            if (!q.unit || q.unit.key !== u.key) break;
            stripPoll(q);
            await T(0.22);
          }
          break;
        }
        case 'misgave': {
          /* [O.2] the chapter's ONLY inset, raised, and its bytes a dark skin */
          await T(1.2);
          const q = await st();
          const up = q.stage.plate && q.stage.plate.wineskin;
          if (!(up >= INSET_UP_MIN)) {
            bad(`misgave: [O.2] the wineskin inset is not raised (opacity ${up}, floor ${INSET_UP_MIN})`);
          }
          if ((q.stage.gaps || []).some((g) => /wineskin/.test(g))) {
            bad(`misgave: [O.2] the engine reports the wineskin art as a GAP: ${q.stage.gaps}`);
          }
          await shot('b1-O2-wineskin-inset');
          facts['O.2'] = `inset wineskin at opacity ${up}`;
          break;
        }
        case 'beg': {
          /* [O.3] the cheese-rack lens actually contains racks */
          await T(1.6);                        // the sweep lens lands
          await shot('b2-O3-racks');
          const f = frames['b2-O3-racks'];
          const sb = await stageBox();
          const q = await st();
          const win = { x: sb.x, y: sb.y, w: sb.w, h: sb.h };
          let cheese = 0, inLens = 0;
          for (const k of ['A', 'B', 'C']) {
            const b = CAVE_OBJ.racks[k];
            const dev = await plateBox([b[0][0], b[0][1], b[1][0] - b[0][0], b[1][1] - b[0][1]]);
            const R = rectI(dev, win);
            if (R) {
              inLens++;
              if (f) cheese += paleCount(f, R, 90, 0.35);
            }
          }
          if (inLens < 3) {
            bad(`beg: [O.3] only ${inLens}/3 rack boxes are inside the racks-sweep lens`);
          }
          if (!(cheese >= CHEESE_PX_MIN)) {
            bad(`beg: [O.3] the racks do not read as LOADED — ${cheese} pale px across ` +
                `racks A..C (floor ${CHEESE_PX_MIN})`);
          }
          facts['O.3'] = `racks in lens ${inLens}/3, ${cheese} cheese px`;
          break;
        }
        case 'present': break;                // O.3b is the verbatim law's line
        case 'return2': {
          const c = q0.cameo || {};
          if (!(c.on && c.id === 'polyphemus')) {
            bad(`return2: the POLYPHEMUS cameo (O.1's visual half) is not raised: ${JSON.stringify(c)}`);
          }
          break;
        }
        case 'boulder': {
          /* [O.4] boulder pixels fill the mouth: the same aperture, open vs shut */
          await T(2.2);                        // the shut swap lands (1.6 s)
          const q = await st();
          if (!(q.stage.caveState && q.stage.caveState.name === 'shut')) {
            bad(`boulder: [O.4] the shut state is not up (${JSON.stringify(q.stage.caveState)})`);
          }
          await shot('b2-O4-boulder-shut');
          const f = frames['b2-O4-boulder-shut'];
          const m = CAVE_OBJ.mouthAperture;
          const dev = await plateBox([m[0][0], m[0][1], m[1][0] - m[0][0], m[1][1] - m[0][1]]);
          const R = rectI(dev, await stageBox());
          const shutL = f && R ? lumaStats(f, R).mean : null;
          const gains = (q.stage.caveState && q.stage.caveState.gains) || {};
          if (!(gains.mouth <= MOUTH_GAIN_MAX)) {
            bad(`boulder: [O.4] the mouth's own light is still on through the stone ` +
                `(gain ${gains.mouth}, limit ${MOUTH_GAIN_MAX})`);
          }
          if (mouthOpenLuma === null) {
            bad('boulder: [O.4] no open-mouth baseline was captured at head2 — the gate cannot compare');
          } else {
            const ratio = shutL === null ? null
              : +(Math.max(shutL, 0.01) / Math.max(mouthOpenLuma, 0.01)).toFixed(3);
            if (!(ratio !== null && (ratio >= MOUTH_CHANGE_MIN || ratio <= 1 / MOUTH_CHANGE_MIN))) {
              bad(`boulder: [O.4] the aperture's pixels barely changed — luma ` +
                  `${mouthOpenLuma} open -> ${shutL} shut (ratio ${ratio}; the painted ` +
                  `boulder moves it ${MOUTH_CHANGE_MIN}x either way, measured 2.2x)`);
            } else {
              facts['O.4'] = `mouth luma ${mouthOpenLuma} open -> ${shutL} shut ` +
                             `(ratio ${ratio}), mouth light out (gain ${gains.mouth})`;
            }
          }
          break;
        }
        case 'strangers': {
          /* O.1's visual half, in-world: the first close lens on the eye */
          const q = await st();
          if (!(q.stage.cam && Math.abs(q.stage.cam.wantK - 3.6) < 0.01)) {
            bad(`strangers: the eye-close lens is not asked for (wantK=${q.stage.cam && q.stage.cam.wantK})`);
          }
          if (!(q.stage.giant && ['seat', 'clutch'].includes(q.stage.giant.pose))) {
            bad(`strangers: the giant is not seated under the eye lens (pose=${q.stage.giant && q.stage.giant.pose})`);
          }
          break;
        }
        case 'firstmeal': case 'morningmeal': case 'suppertwo': {
          /* [bridges] THE SEIZE, walked to mid-clutch in 0.15 s steps so the
             play-once law has dense frames: the bridge (seat -> clutch) rides
             segK 0.02..0.42 and must be monotone, land on its last cell, and
             hand the frame to the static clutch the O.6 gate then measures. */
          let qm = q0;
          for (let i = 0; i < 40; i++) {
            if (!qm.unit || qm.unit.key !== u.key || (qm.unitT || 0) >= MEAL_SEG_T) break;
            stripPoll(qm);
            await T(0.15);
            qm = await st();
          }
          /* [O.6] THE MEAL, sampled at the identical instant of the identical
             curve: segK 0.5 — mid-clutch. */
          await T(Math.max(0, MEAL_SEG_T - qm.unitT));
          await page.evaluate(() => window.__renderNow());
          const q = await st();
          const name = `b${u.beat}-O6-meal-${u.key}`;
          await shot(name);
          const g = q.stage.giant || {};
          const dev = g.box ? rectI(await plateBox(g.box), await stageBox()) : null;
          meals.push({ key: u.key, pose: g.pose, box: g.box,
                       crewN: q.stage.cast && q.stage.cast.crewN,
                       meals: q.stage.cast && q.stage.cast.meals,
                       segK: q.stage.seg && q.stage.seg.k, rect: dev, shot: name });
          if (g.pose !== 'clutch') {
            bad(`${u.key}: [O.6] mid-seg the giant is '${g.pose}', not the clutch`);
          }
          break;
        }
        case 'sword':
          /* G2's liveness is asserted by doTarget below, AFTER polling the
             actor's walk to the mark out — asserting it at entry (0.85 s in)
             double-reported the same defect before he could have arrived. */
          break;
        case 'shiftstone': {
          /* [O.5] the pan answers the instinct with the boulder */
          const samples = [];
          for (let i = 0; i < 14; i++) {
            const q = await st();
            if (!q.unit || q.unit.key !== 'shiftstone') break;
            samples.push({ x: q.stage.cam.x, panning: q.stage.sword && q.stage.sword.panning });
            await T(0.45);
          }
          const panned = samples.some((x) => x.panning);
          const nearest = Math.min(...samples.map((x) => Math.abs(x.x - 345)));
          if (!panned) bad('shiftstone: [O.5] the camera never panned off the blade');
          if (!(nearest <= PAN_NEAR_MAX)) {
            bad(`shiftstone: [O.5] the pan never REACHED the stone — closest cam x ` +
                `${nearest.toFixed(0)} px from the mouth (limit ${PAN_NEAR_MAX})`);
          } else {
            facts['O.5'] = `sword drawn, pan reached within ${nearest.toFixed(0)} px of the mouth lens`;
          }
          await shot('b2-O5-pan-at-stone');
          break;
        }
        case 'neck': {
          /* [bridges] THE COLLAPSE, densely from the top of its own seg: the
             drink -> sprawl bridge rides segK 0..0.85 of the 6 s neck, so
             the play-once law gets the whole chain, frame 0 up (the unit is
             blocked by its segHold, which never samples on its own) */
          for (let i = 0; i < 36; i++) {
            const q = await st();
            if (!q.unit || q.unit.key !== 'neck') break;
            stripPoll(q);
            const b = (q.stage.strips || {}).bridge;
            if (i > 2 && !(b && b.key === 'collapse')) break;
            await T(0.2);
          }
          break;
        }
        case 'noman': {
          /* [O.8a] the pun, verbatim in the margin the reader reads */
          const q = await st();
          if (marginHas(q, lawById['ody-iii-11-noman'].text, 'noman: [O.8]')) {
            facts['O.8a'] = 'the noman line is on the page verbatim';
          }
          if (!/Ulysses/.test(q.unit.blocks)) {
            bad('noman: [O.8] the pun carries no ULYSSES prefix in the margin');
          }
          break;
        }
        case 'nomanlast': {
          const q = await st();
          if (marginHas(q, lawById['ody-iii-12-nomanlast'].text, 'nomanlast: [O.8]')) {
            facts['O.8b'] = 'the price is adjacent and verbatim';
          }
          break;
        }
        case 'auger': case 'bore': {
          /* [O.9] the stake TIP inside the eye box, asserted AT THIS UNIT'S
             OWN CLOCK TICK — auger 4.2 AND bore 7.4 (round-2 review E2: one
             sample missed the auger-tick miss, so BOTH ticks now carry the
             full assertion). The probe walks the clock onto the tick before
             measuring, so the number is the tick's, not the entry pacing's;
             the sample must also stand in the tick's own phase, over a
             sprawled giant, with the set's live eye ON the lap's law. */
          const tick = DRIVE_TICKS[u.key];
          let q = await st();
          stripPoll(q);                    // [strips] the auger twist, en route
          for (let i = 0; i < 40 && (!q.stage.drive || q.stage.drive.t < tick); i++) {
            await T(0.2);
            q = await st();
            stripPoll(q);                  // …and at every clock step to the tick
          }
          const d = q.stage.drive;
          if (!d) bad(`${u.key}: [O.9] the blinding clock is not running`);
          else if (!(d.t >= tick && d.phase === u.key)) {
            bad(`${u.key}: [O.9] the probe never stood on the ${u.key} tick — ` +
                `drive t=${d.t}, phase=${d.phase} (tick ${tick})`);
          }
          if (!(q.stage.giant && q.stage.giant.pose === 'sprawl')) {
            bad(`${u.key}: [O.9] no sprawled giant under the drive ` +
                `(pose=${q.stage.giant && q.stage.giant.pose})`);
          }
          const eyeSet = q.stage.sprawl && q.stage.sprawl.eye;
          if (!(eyeSet && eyeSet[0] === EYE[0] && eyeSet[1] === EYE[1])) {
            bad(`${u.key}: [O.9] the set's live eye ${JSON.stringify(eyeSet)} drifted ` +
                `off the lap's law ${JSON.stringify(EYE)}`);
          }
          await page.evaluate(() => window.__renderNow());
          /* the tip is the cut's VISIBLE ember head — (1134,466) of the
             1143x582 art, measured off its own alpha (round 3). The shipped
             pin (1000,576) sat in transparent air, which is how a drive
             pointing at the fire could still measure "on the eye". */
          const tip = await page.evaluate(() => {
            const a = window.__refs.stage.active;
            const n = a.stakeGlowN;
            const L = parseFloat(n.style.left), Tp = parseFloat(n.style.top);
            const W = parseFloat(n.style.width), H = parseFloat(n.style.height);
            return { x: L + W * (1134 / 1143), y: Tp + H * (466 / 582),
                     op: +n.style.opacity };
          });
          const err = Math.hypot(tip.x - EYE[0], tip.y - EYE[1]);
          if (!(err <= TIP_TOL &&
                Math.abs(tip.x - EYE[0]) <= EYE_BOX && Math.abs(tip.y - EYE[1]) <= EYE_BOX)) {
            bad(`${u.key}: [O.9] at the ${u.key} tick the stake tip is ${err.toFixed(1)} px ` +
                `off the EYE (${tip.x.toFixed(0)},${tip.y.toFixed(0)} vs ${EYE}; ` +
                `tol ${TIP_TOL}, eye box ±${EYE_BOX})`);
          }
          if (!(tip.op >= 0.8)) {
            bad(`${u.key}: [O.9] the tip is not glowing at the ${u.key} tick (opacity ${tip.op})`);
          }
          facts['O.9-' + u.key] = `tick ${tick} (drive t=${d && d.t}): tip ` +
            `(${tip.x.toFixed(1)},${tip.y.toFixed(1)}), ${err.toFixed(1)} px off the eye ` +
            `(${EYE}), glow ${tip.op}`;
          if (u.key === 'bore' && facts['O.9-auger']) {
            facts['O.9'] = `tip inside the eye box at BOTH ticks — auger ` +
              `${facts['O.9-auger']}; bore ${facts['O.9-bore']}`;
          }
          await shot(`b4-O9-tip-${u.key}-tick`);
          break;
        }
        case 'whatails': {
          const c = q0.cameo || {};
          if (!(c.on && c.id === 'a-cyclops')) {
            bad(`whatails: the A CYCLOPS voice-card is not raised: ${JSON.stringify(c)}`);
          }
          /* [O.10] the lamplight at its peak: sample at drive ~16 */
          for (let i = 0; i < 20; i++) {
            const q = await st();
            if (!q.stage.drive || q.stage.drive.t >= 16) break;
            await T(0.5);
          }
          const q = await st();
          const sum = (q.stage.neighbours.seams || []).reduce((a, b) => a + b, 0);
          facts['O.10-peak'] = +sum.toFixed(3);
          if (!(sum >= SEAM_PEAK_MIN)) {
            bad(`whatails: [O.10] the neighbours never gathered — seam light sums ` +
                `${sum.toFixed(2)} at drive ${q.stage.drive && q.stage.drive.t} (floor ${SEAM_PEAK_MIN})`);
          }
          await shot('b4-O10-lamplight-peak');
          break;
        }
        case 'mustbeill': {
          const q = await st();
          if (marginHas(q, 'you had better pray to your father Neptune', 'mustbeill: [O.13a]')) {
            facts['O.13a'] = "'pray to your father Neptune' on the page";
          }
          break;
        }
        case 'wentaway': {
          /* [O.10] ...and they GO: run the clock past the recede */
          for (let i = 0; i < 40; i++) {
            const q = await st();
            if (!q.stage.drive || q.stage.drive.t >= 31) break;
            await T(0.6);
          }
          const q = await st();
          const sum = (q.stage.neighbours.seams || []).reduce((a, b) => a + b, 0);
          if (!(sum <= SEAM_GONE_MAX)) {
            bad(`wentaway: [O.10] the lamps did not RECEDE — seam light still sums ` +
                `${sum.toFixed(2)} at drive ${q.stage.drive && q.stage.drive.t} (limit ${SEAM_GONE_MAX})`);
          } else if (facts['O.10-peak'] !== undefined && facts['O.10-peak'] >= SEAM_PEAK_MIN) {
            facts['O.10'] = `lamplight rose to ${facts['O.10-peak']} then receded to ${sum.toFixed(3)}`;
          }
          if ((q0.cameo || {}).on) {
            bad('wentaway: the voice-card was not PUT AWAY when the neighbours left');
          }
          await shot('b4-O10-lamplight-gone');
          break;
        }
        case 'stone': {
          await T(2.4);                        // the grope walk + the open swap
          const q = await st();
          if (!(q.stage.caveState && q.stage.caveState.name === 'master')) {
            bad(`stone: the boulder was not drawn aside (state ${q.stage.caveState && q.stage.caveState.name})`);
          }
          if (!(q.stage.neighbours && q.stage.neighbours.snuffed)) {
            bad('stone: the opened mouth is still lit from outside (seams not snuffed)');
          }
          break;
        }
        case 'doorway': {
          await T(1.0);
          const q = await st();
          const g = q.stage.giant || {};
          if (!(g.pose === 'doorway' && g.blinded)) {
            bad(`doorway: the blind giant is not seated in the mouth (pose=${g.pose}, blinded=${g.blinded})`);
          }
          /* [strips] the grope-sway loop holds the doorway bulk live */
          for (let i = 0; i < 6; i++) {
            stripPoll(await st());
            await T(0.3);
          }
          break;
        }
        case 'dawn5': {
          /* [strips] the dawn stream (v-05): the escape's walkers ride the
             ram strip — sample the trot while the flock crosses the floor.
             [anti-skate] single-step the stream first, planted hooves held. */
          await skateProbe('dawn5', 90);
          for (let i = 0; i < 8; i++) {
            const q = await st();
            if (!q.unit || q.unit.key !== 'dawn5') break;
            stripPoll(q);
            await T(0.35);
          }
          break;
        }
        case 'feltbacks': {
          const q = await st();
          if (!(q.stage.giant && q.stage.giant.pose === 'stroke')) {
            bad(`feltbacks: [O.11] the hand-pass has no stroking giant (pose=${q.stage.giant && q.stage.giant.pose})`);
          }
          if (!(Math.abs(q.stage.cam.wantK - 3.6) < 0.01)) {
            bad(`feltbacks: [O.11] the handpass-tight lens is not asked for (wantK=${q.stage.cam.wantK})`);
          }
          break;
        }
        case 'lastofall': {
          /* [O.11] the great ram HALTED in the mouth, the man under him, the
             palm over him */
          await T(1.8);                        // the pin ease is 1.2 s
          await page.evaluate(() => window.__renderNow());
          const q = await st();
          const ram = q.stage.flock && q.stage.flock.ram;
          if (!(ram && ram.on && ram.slung)) {
            bad(`lastofall: [O.11] the ram is not staged slung at the mouth (${JSON.stringify(ram)})`);
          } else {
            const b = ram.box;
            const cross = Math.min(b[0] + b[2], MOUTH_X[1]) - Math.max(b[0], MOUTH_X[0]);
            if (!(cross >= RAM_CROSS_MIN)) {
              bad(`lastofall: [O.11] the ram's box x ${b[0].toFixed(0)}..${(b[0] + b[2]).toFixed(0)} ` +
                  `does not CROSS the mouth band ${MOUTH_X[0]}..${MOUTH_X[1]} ` +
                  `(overlap ${cross.toFixed(0)}, floor ${RAM_CROSS_MIN})`);
            }
            const geo = await page.evaluate(() => {
              const a = window.__refs.stage.active;
              const s = window.__refs.stage;
              const box = (n) => {
                const r = n.getBoundingClientRect();
                const p0 = s.toPlate(r.left, r.top), p1 = s.toPlate(r.right, r.bottom);
                return [p0.x, p0.y, p1.x - p0.x, p1.y - p0.y];
              };
              /* the stroke is a LOOP STRIP now (giant-stroke): measure the
                 node the set is actually painting the hand-pass on */
              const sN = a.strokeVisN ? a.strokeVisN() : a.giantN.stroke;
              return { stroke: box(sN), ram: box(a.ramSlungN),
                       strokeOp: +sN.style.opacity };
            });
            if (!(geo.strokeOp > 0.5)) {
              bad('lastofall: [O.11] the stroke cut is not the pose over the halted ram');
            }
            /* the HAND: the stroke cut's lower half is the reaching palm; it
               has to overlap the ram it is stroking */
            const hand = { x: geo.stroke[0], y: geo.stroke[1] + geo.stroke[3] * 0.5,
                           w: geo.stroke[2], h: geo.stroke[3] * 0.5 };
            const ramR = { x: geo.ram[0], y: geo.ram[1], w: geo.ram[2], h: geo.ram[3] };
            if (!rectI(hand, ramR)) {
              bad(`lastofall: [O.11] the stroking hand never reaches the ram — stroke ` +
                  `lower-half ${JSON.stringify(hand)} vs ram ${JSON.stringify(ramR)}`);
            } else {
              facts['O.11'] = `ram slung at (${ram.at}), crosses the mouth by ${cross.toFixed(0)} px, ` +
                              `the stroke cut's palm band overlaps him`;
            }
          }
          await shot('b5-O11-ram-under-the-palm');
          break;
        }
        case 'jeer': {
          /* the no-head-unit trap: heading VI rides this unit's own leaf */
          const prog = await page.evaluate(() =>
            document.getElementById('prog').textContent);
          if (!/VI\s*·\s*THE TAUNT/i.test(prog)) {
            bad(`jeer: the Beat VI heading is not on the page — progress reads '${prog}'`);
          }
          break;
        }
        case 'taunt': {
          const q = await st();
          if (!(q.stage.ulysses && q.stage.ulysses.pose === 'taunt')) {
            bad(`taunt: the whip to the stern has no taunting Ulysses (pose=${q.stage.ulysses && q.stage.ulysses.pose})`);
          }
          break;
        }
        case 'twiceasfar': {
          const q = await st();
          if (!(q.stage.world && q.stage.world.k <= 0.90)) {
            bad(`twiceasfar: the headland was never scaled back — world k=${q.stage.world && q.stage.world.k} (want <= 0.90)`);
          }
          if (seaStandBox === null && q.stage.giant && q.stage.giant.pose === 'stand') {
            seaStandBox = q.stage.giant.box;
          }
          break;
        }
        case 'menbeg': {
          const c = q0.cameo || {};
          if (!(c.on && c.id === 'the-men')) {
            bad(`menbeg: THE MEN's card is not raised: ${JSON.stringify(c)}`);
          }
          break;
        }
        case 'defy': {
          /* [O.12] the plea still stands in the margin the reader clicks over */
          const q = await st();
          if (!norm(q.unit.blocks).includes(norm('he has thrown one rock at us already'))) {
            bad(`defy: [O.12] the men's plea is not still on the page under the second gate`);
          }
          break;
        }
        case 'myname': {
          const q = await st();
          marginHas(q, 'say it was the valiant warrior Ulysses, son of Laertes, who lives in Ithaca',
                    'myname: [O.12]');
          if (!(q.stage.ulysses && q.stage.ulysses.mark === 'stern-rail')) {
            bad(`myname: he never stepped onto the rail (mark=${q.stage.ulysses && q.stage.ulysses.mark})`);
          }
          break;
        }
        case 'prophecy': {
          if ((q0.cameo || {}).on) bad('prophecy: the cameo card was not put away at the cliff close');
          break;
        }
        case 'fatherson': {
          const q = await st();
          if (marginHas(q, 'Neptune and I are father and son', 'fatherson: [O.13b]')) {
            facts['O.13b'] = "'Neptune and I are father and son' on the page";
          }
          break;
        }
        case 'curse': {
          /* [O.14a] both hands to the firmament: the arms-up cut, measured */
          await T(1.2);
          await page.evaluate(() => window.__renderNow());
          const q = await st();
          const g = q.stage.giant || {};
          if (!(g.pose === 'curse')) bad(`curse: [O.14] the pose is '${g.pose}', not the curse`);
          if (seaStandBox && g.box) {
            const ratio = g.box[3] / seaStandBox[3];
            const rise = seaStandBox[1] - g.box[1];
            if (!(ratio >= CURSE_H_RATIO_MIN && rise >= CURSE_TOP_RISE_MIN)) {
              bad(`curse: [O.14] the arms never rose — box h ratio ${ratio.toFixed(3)} ` +
                  `(floor ${CURSE_H_RATIO_MIN}), top rise ${rise.toFixed(1)} px (floor ${CURSE_TOP_RISE_MIN})`);
            } else {
              facts['O.14a'] = `curse cut ${ratio.toFixed(2)}x the stand, top ${rise.toFixed(0)} px higher`;
            }
          } else if (!g.box) bad('curse: [O.14] no giant box to measure');
          if (!(q.stage.veil >= CURSE_VEIL_MIN)) {
            bad(`curse: [O.14] the sky never darkened — veil ${q.stage.veil} (floor ${CURSE_VEIL_MIN})`);
          }
          await shot('b6-O14-curse');
          /* [strips] the curse-sway loop holds the document frame live */
          for (let i = 0; i < 5; i++) {
            stripPoll(await st());
            await T(0.3);
          }
          break;
        }
        default: break;
      }

      /* ---- units held by a wait/seg: sample, latch, wait out ------------ */
      const qb = await st();
      if (qb.unit && qb.unit.id === u.id && qb.blocked) {
        /* head2 doubles as O.4's OPEN baseline: sample the lit aperture while
           the entry seg holds the frame on the dawn state */
        if (u.key === 'head2') {
          await T(2.2);                         // the dawn swap lands
          await page.evaluate(() => window.__renderNow());
          await shot('b2-O4-mouth-open');
          const f = frames['b2-O4-mouth-open'];
          const m = CAVE_OBJ.mouthAperture;
          const dev = await plateBox([m[0][0], m[0][1], m[1][0] - m[0][0], m[1][1] - m[0][1]]);
          const R = rectI(dev, await stageBox());
          mouthOpenLuma = f && R ? lumaStats(f, R).mean : null;
          /* [strips] the entry file (K1): the twelve walk in on the crew
             strip while the entry seg still runs — sample the stride.
             [anti-skate] single-step the file first, planted feet held. */
          await skateProbe('head2', 90);
          for (let i = 0; i < 6; i++) {
            const q2 = await st();
            if (!q2.unit || q2.unit.key !== 'head2') break;
            stripPoll(q2);
            await T(0.3);
          }
        }
        if (u.key === 'rock1' || u.key === 'heard') {
          /* [O.14b]/rock clocks: watch the rock fly and the splash land */
          const which = u.key === 'rock1' ? 'rock1' : 'rock2';
          let sawFlight = false, sawSplash = 0, palePx = 0;
          await latchProbe(u);
          /* [bridges] the WINDUP first, densely: the tear->loose window is
             1.6 s and the entry settle has already spent part of it, so the
             play-once law's frames are sampled at 0.15 s while the bridge
             is live (two grace polls in case the tear is still ahead) */
          for (let i = 0; i < 14; i++) {
            const qd = await st();
            if (!qd.unit || qd.unit.id !== u.id) break;
            stripPoll(qd);
            const gs = qd.stage.giantStrip;
            if (i > 1 && !(gs && gs.mode === 'bridge')) break;
            await T(0.15);
          }
          for (let i = 0; i < 80; i++) {
            const q = await st();
            if (!q.unit || q.unit.id !== u.id || q.turn.active) break;
            stripPoll(q);                  // [strips] the crew-row loop + stagger
            const rk = q.stage[which] || {};
            if (['tear', 'flight'].includes(rk.phase)) sawFlight = true;
            const sp = q.stage.splash || {};
            if (sp.of === which && sp.k > sawSplash) {
              sawSplash = sp.k;
              if (sp.k > 0.4 && !frames[`b6-${which}-splash`]) {
                await page.evaluate(() => window.__renderNow());
                await shot(`b6-${which}-splash`);
                const r = await page.evaluate(() => {
                  const n = window.__refs.stage.active.splash;
                  const b = n.getBoundingClientRect();
                  return { x: b.x * 2, y: b.y * 2, w: b.width * 2, h: b.height * 2 };
                });
                const f = frames[`b6-${which}-splash`];
                const R = rectI(r, await stageBox());
                if (f && R) palePx = paleCount(f, R, 78, 0.35);
              }
            }
            await T(0.4);
          }
          if (!sawFlight) bad(`${u.key}: ${which}'s tear/flight never played on the clock`);
          if (!(sawSplash > 0.25)) bad(`${u.key}: ${which}'s splash never rose (max k ${sawSplash})`);
          if (u.key === 'heard') {
            if (!(palePx >= SPLASH_PALE_MIN)) {
              bad(`heard: [O.14] rock 2's splash does not read — ${palePx} plume px ` +
                  `(floor ${SPLASH_PALE_MIN})`);
            } else {
              facts['O.14b'] = `'heard' entered on the curse clock; splash2 k ${sawSplash}, ` +
                               `${palePx} plume px`;
            }
          }
          await waitRelease(u);
          continue;
        }
        await latchProbe(u);
        /* [strips] the held segs whose walks are strip-driven (the giant's
           entrance and both flock crossings) are sampled as they play out;
           [anti-skate] each is single-stepped first, mid-walk, planted feet
           held frame by frame */
        if (STRIP_SEG_KEYS.has(u.key)) await skateProbe(u.key, 90);
        await waitRelease(u, STRIP_SEG_KEYS.has(u.key) ? stripPoll : undefined);
        continue;
      }
    }

    /* ---- the verbs ------------------------------------------------------ */
    const sv = await st();
    if (!sv.unit || sv.unit.id !== u.id || sv.turn.active || sv.end.active) continue;
    if (u.verb === 'auto') {
      /* poll it out, sampling the pour machine where O.7 rides the autos —
         and the BRIDGES where they play: the drink bridge opens each drain
         (besokind/thrice) and the collapse bridge is neck's whole seg, so
         those three poll at 0.25 s for the play-once law's frames */
      const dense = ['besokind', 'thrice', 'neck'].includes(u.key);
      for (let i = 0; i < (dense ? 100 : 60); i++) {
        const q = await st();
        /* sample BEFORE the break: the frame that ends an auto is the NEXT
           unit's first — taunt's last poll is rock1's tear, the windup
           bridge's own frame 0 (play-once needs the start of the chain) */
        stripPoll(q);
        if (!q.unit || q.unit.id !== u.id || q.turn.active || q.end.active) break;
        if (u.key === 'besokind' || u.key === 'thrice') {
          const p = q.stage.pours || {};
          facts['O.7-pours'] = Math.max(facts['O.7-pours'] || 0, p.n || 0);
          if (q.stage.giant && q.stage.giant.pose === 'drink') facts['O.7-drink'] = true;
          if (p.swaying) facts['O.7-sway'] = true;
        }
        await T(dense ? 0.25 : 0.45);
      }
      if (u.key === 'thrice') {
        const q = await st();
        const audio = await page.evaluate(() => window.__audio());
        const pourCues = (audio.log || []).filter((l) => l.id === 'pour').length;
        if (!(facts['O.7-pours'] >= 3)) {
          bad(`thrice: [O.7] only ${facts['O.7-pours']} pours by the end of the line (law: THREE)`);
        }
        if (!facts['O.7-drink']) bad('thrice: [O.7] no heedless drain was ever staged (drink pose never seen)');
        if (!(pourCues >= POUR_CUES_MIN)) {
          bad(`thrice: [O.7] ${pourCues} pour beats heard (floor ${POUR_CUES_MIN})`);
        }
        if (facts['O.7-pours'] >= 3 && facts['O.7-drink']) {
          facts['O.7'] = `three pours (${pourCues} pour beats), drains staged, sway ${!!facts['O.7-sway']}`;
        }
      }
    } else if (u.verb === 'clock') {
      const next = units[u.i + 1];
      if (next && next.verb === 'clock') {
        for (let i = 0; i < 60; i++) {
          const q = await st();
          if (!q.unit || q.unit.id !== u.id || q.turn.active) break;
          await T(0.4);
        }
      } else {
        await click();                 // may latch against the next unit's clock
        for (let i = 0; i < 60; i++) {
          const q = await st();
          if (!q.unit || q.unit.id !== u.id || q.turn.active || q.end.active) break;
          await T(0.4);
        }
      }
    } else if (u.verb === 'hold') {
      if (gatesDone.has(u.id)) { await T(0.5); continue; }
      gatesDone.add(u.id);
      await doHold(u);
    } else if (u.verb === 'release') {
      if (gatesDone.has(u.id)) { await T(0.5); continue; }
      gatesDone.add(u.id);
      await doRelease(u);
    } else if (u.verb === 'target') {
      /* one dispatch per gate: a gate that failed to advance has already been
         charged, and re-missing it forever would double-book the ledger — the
         soft-fail law is what carries a truly broken gate off the page. */
      if (gatesDone.has(u.id)) { await T(0.5); continue; }
      gatesDone.add(u.id);
      await doTarget(u);
      if (u.key === 'council') {
        /* [G1] the crossing owns the frame: prove it on the unit it lands in.
           [strips] the DASH ABOARD (crew-run, cut c-board) sprints under the
           crossing's first leg — sampled here for the cycle + anchor laws. */
        let done = false;
        for (let i = 0; i < 50; i++) {
          const q = await st();
          stripPoll(q);
          const c = q.stage.crossing;
          if (c && c.done) { done = true; break; }
          await T(0.3);
        }
        if (!done) bad('council: the G1 crossing never completed its two legs');
        else {
          const q = await st();
          if (!(Math.abs(q.stage.cam.wantK - 2.6) < 0.05)) {
            bad(`council: the crossing did not land on cavemouth-push-to (wantK ${q.stage.cam.wantK})`);
          }
          await shot('b1-G1-crossing-landed');
        }
      }
    } else {
      const q = await st();
      if (q.unit && q.unit.id === u.id && q.blocked) {
        await latchProbe(u);
        await waitRelease(u);
      } else if (q.unit && q.unit.id === u.id) {
        await click();
      }
    }
  }
  if (guard >= 700) bad('the read never finished (guard tripped)');

  /* ---- 2. the closing card ---------------------------------------------- */
  await T(0.35);
  await shot('end-0-page-turning');
  await T(2.4);
  await shot('end-1-closing-card');
  const fin = await st();
  if (!fin.finished) bad('the chapter never finished');
  if (!fin.blankLeaf) bad('the closing leaf still carries a picture');
  if (!(fin.end.card > 0.9)) bad(`the closing card did not come up (card=${fin.end.card})`);
  const cardText = await page.evaluate(() =>
    document.getElementById('endcard').textContent.replace(/\s+/g, ' ').trim());
  if (!/END OF BOOK IX/i.test(cardText) || !/The Cyclops/i.test(cardText)) {
    bad(`closing card text: '${cardText}'`);
  }
  /* [memory] the EAGER half: this read answered the defy gate on the lap's
     own quick cadence (< ${HESIT_EAGER_S} s from the gate arming), so the
     card's sub must carry the eager clause — and never the reluctant one. */
  if (!(fin.hesit !== null && fin.hesit >= 0)) {
    bad(`[memory] no hesitation was recorded at defy (hesit=${fin.hesit})`);
  } else if (!(fin.hesit < HESIT_EAGER_S)) {
    bad(`[memory] this lap dawdled ${fin.hesit}s at defy — the eager half of the ` +
        `gate needs a fast resolve (< ${HESIT_EAGER_S}s); fix the lap's pacing`);
  } else if (!HESIT_EAGER_RE.test(cardText) || HESIT_HELD_RE.test(cardText)) {
    bad(`[memory] hesit=${fin.hesit}s (< ${HESIT_EAGER_S}) but the card's sub is not ` +
        `the eager clause: '${cardText}'`);
  } else {
    note(`[memory] defy answered in ${fin.hesit}s -> the card reads ` +
         `'…his name at once' (the eager clause)`);
  }

  /* ---- 3. the tally ------------------------------------------------------ */
  const missed = units.map((x) => x.key).filter((k) => !seen.includes(k));
  if (missed.length) bad(`units never entered: ${missed.join(', ')}`);
  else note('81/81 units entered in order by the reader\'s own verb');
  for (const b of beats) {
    if ((beatsSeen[b.n] || 0) !== b.units) {
      bad(`beat ${b.n}: entered ${beatsSeen[b.n] || 0} units, the ledger says ${b.units}`);
    }
  }
  if (!latchProof) {
    bad('the latch law was never exercised: no unit was still blocked when the reader clicked');
  } else {
    note(`the latch: ${latchProof.unit}'s click inside its ${latchProof.blocked} window was latched`);
  }
  if (gates.length !== 10) {
    bad(`gates exercised: ${gates.length}, expected 10 (5 targets + 2 hold rests ` +
        `+ 2 holds + 1 release)`);
  }
  /* [rest] + [release]: the two amendments' own gates, tallied by name */
  for (const k of ['lookhere', 'embers']) {
    const r = restProof[k];
    if (!r) bad(`[rest] the ${k} rest was never exercised — the gate did not run`);
    else note(`[rest] ${k}: k ${r.kAtRelease} at release -> ${r.kAfter2s} after a 2 s rest; ` +
              `carrier ${r.carrierAtRelease} -> ${r.carrierAfter2s} (nothing dropped)`);
  }
  if (!releaseProof) {
    bad('[release] the myname release verb was never exercised — the gate did not run');
  } else {
    note(`[release] myname: stray click held the page, 1 s hold banked k ${releaseProof.heldK} ` +
         `(swell ${releaseProof.swell}) with no advance, the shout rang and the story ` +
         `moved ${releaseProof.from} -> ${releaseProof.to} ON the release frame`);
  }
  if (turns.length !== 4) {
    bad(`page turns during the read: ${turns.length}, expected 4 (III->IV shares leaf 3; ` +
        `the fifth turn is the closing card)`);
  }
  const readFetches = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name)).length);
  note(`bitmaps fetched across the read: ${readFetches}, every one under a cover or at boot`);

  const audio = await page.evaluate(() => window.__audio());
  const gaps = fin.stage.gaps || [];
  const appErrors = fin.errors || [];
  if (appErrors.length) bad('app errors: ' + JSON.stringify(appErrors).slice(0, 500));
  if (consoleErrors.length) bad('console errors: ' + consoleErrors.slice(0, 6).join(' | '));
  else note('zero console errors');
  if (gaps.length) note('ART GAPS the engine reported: ' + gaps.join(', '));

  /* ---- 4. [O.6] the three meals, diffed --------------------------------- */
  if (meals.length !== 3) {
    bad(`[O.6] only ${meals.length}/3 meals were sampled mid-clutch`);
  } else {
    const want = [10, 8, 6];
    meals.forEach((m, i) => {
      if (m.crewN !== want[i]) {
        bad(`[O.6] the headcount law broke at ${m.key}: crewN ${m.crewN}, the meals say ${want[i]}`);
      }
    });
    const b0 = meals[0].box;
    for (const m of meals.slice(1)) {
      if (!m.box || !b0) { bad(`[O.6] ${m.key} has no giant box to compare`); continue; }
      const d = Math.max(Math.abs(m.box[0] - b0[0]), Math.abs(m.box[1] - b0[1]),
                         Math.abs(m.box[2] - b0[2]), Math.abs(m.box[3] - b0[3]));
      if (d > MEAL_BOX_TOL) {
        bad(`[O.6] the clutch is NOT identically staged: ${m.key}'s box drifts ` +
            `${d.toFixed(1)} px from ${meals[0].key}'s (limit ${MEAL_BOX_TOL})`);
      }
    }
    /* the masked, mean-normalised diff of the clutch cut between the meals */
    const cut = await getImg('./assets/actor/polyphemus-clutch.png');
    if (cut && meals.every((m) => m.rect && frames[m.shot])) {
      const R = meals.map((m) => m.rect).reduce((a, r) => rectI(a, r) || a);
      const diffPair = (fa, fb) => {
        /* device -> cut pixel, via the shot-time mapping (same lens, same box
           all three meals — the geometry gate above is what makes this legal) */
        const rectDev = meals[0].rect;             // the giant box in device px
        const kx = cut.width / rectDev.w, ky = cut.height / rectDev.h;
        let n = 0, changed = 0, sa = 0, sb = 0;
        const samples = [];
        for (let y = Math.ceil(R.y); y < R.y + R.h; y += 2) {
          for (let x = Math.ceil(R.x); x < R.x + R.w; x += 2) {
            const cx = Math.round((x - rectDev.x) * kx), cy = Math.round((y - rectDev.y) * ky);
            if (cx < 0 || cy < 0 || cx >= cut.width || cy >= cut.height) continue;
            const a = (cut.channels || 4) === 4 ? cut.data[(cy * cut.width + cx) * 4 + 3] : 255;
            if (a < 128) continue;
            const la = lum(pxAt(fa, x, y)), lb = lum(pxAt(fb, x, y));
            samples.push([la, lb]); sa += la; sb += lb; n++;
          }
        }
        const ma = sa / Math.max(1, n), mb = sb / Math.max(1, n);
        for (const [la, lb] of samples) if (Math.abs((la - ma) - (lb - mb)) > 26) changed++;
        return { n, frac: +(changed / Math.max(1, n)).toFixed(4) };
      };
      const d12 = diffPair(frames[meals[0].shot], frames[meals[1].shot]);
      const d13 = diffPair(frames[meals[0].shot], frames[meals[2].shot]);
      note(`[O.6] the clutch, diffed inside its own cut (mean-normalised): ` +
           `meal1-2 ${(d12.frac * 100).toFixed(1)}% of ${d12.n} px, ` +
           `meal1-3 ${(d13.frac * 100).toFixed(1)}% of ${d13.n} px (limit ${MEAL_DIFF_MAX * 100}%)`);
      if (!(d12.n > 500 && d13.n > 500)) {
        bad('[O.6] the masked diff had too little of the cut in frame to judge');
      } else if (d12.frac > MEAL_DIFF_MAX || d13.frac > MEAL_DIFF_MAX) {
        bad(`[O.6] the three meals are NOT the same staging on screen — masked diff ` +
            `${(Math.max(d12.frac, d13.frac) * 100).toFixed(1)}% (limit ${MEAL_DIFF_MAX * 100}%)`);
      } else {
        facts['O.6'] = `identical clutch: boxes within ${MEAL_BOX_TOL}px, masked diffs ` +
                       `${(d12.frac * 100).toFixed(1)}%/${(d13.frac * 100).toFixed(1)}%, crew 10/8/6`;
      }
    } else bad('[O.6] the clutch cut could not be decoded for the masked diff');
  }

  /* ---- 5. the bytes: the cameo's single eye, the inset's skin ----------- */
  const eye = await page.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const w = c.width, h = c.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    let n = 0, skin = 0;
    const iris = [];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = (y * w + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), dd = mx - mn;
      let hh = 0;
      if (dd > 0) {
        hh = mx === R ? (((G - B) / dd) % 6 + 6) % 6
           : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4;
        hh *= 60;
      }
      const s = mx ? dd / mx : 0, l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      n++;
      if (hh >= 5 && hh <= 48 && s >= 0.25 && l >= 55 && l <= 210) skin++;
      if (hh >= 18 && hh <= 40 && s >= 0.55 && l >= 80 && l <= 170) iris.push([x, y]);
    }
    /* grid-cluster the amber pixels (cell 20, 8-neighbour union) */
    const cell = 20, map = new Map();
    for (const [x, y] of iris) { const k = `${x / cell | 0},${y / cell | 0}`; map.set(k, (map.get(k) || 0) + 1); }
    const keys = [...map.keys()]; const seenK = new Set(); const clusters = [];
    const nb = (a, b) => { const [x1, y1] = a.split(',').map(Number), [x2, y2] = b.split(',').map(Number);
      return Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1; };
    for (const k of keys) {
      if (seenK.has(k)) continue;
      const q = [k]; seenK.add(k); let count = 0, xs = [], ys = [];
      while (q.length) {
        const cur = q.pop(); count += map.get(cur);
        const [gx, gy] = cur.split(',').map(Number); xs.push(gx * cell); ys.push(gy * cell);
        for (const o of keys) if (!seenK.has(o) && nb(cur, o)) { seenK.add(o); q.push(o); }
      }
      clusters.push({ count, x0: Math.min(...xs), x1: Math.max(...xs) + cell,
                      y0: Math.min(...ys), y1: Math.max(...ys) + cell });
    }
    clusters.sort((a, b) => b.count - a.count);
    return { w, h, skinPct: +(100 * skin / n).toFixed(2), irisN: iris.length,
             clusters: clusters.slice(0, 5)
               .map((cl) => ({ ...cl, cx: +(((cl.x0 + cl.x1) / 2) / w).toFixed(3) })) };
  }, new URL('./assets/cameo/polyphemus.jpg', URL_).toString()).catch((e) => {
    bad('[O.1] the POLYPHEMUS cameo bytes did not decode: ' + e.message); return null;
  });
  if (eye) {
    const main = eye.clusters[0];
    const eyes = eye.clusters.filter((cl) =>
      cl.count >= Math.max(40, EYE_SPECK_FRAC * ((main && main.count) || 1)));
    note(`[O.1] the cameo card: ${eye.skinPct}% skin in the circle, amber-iris ` +
         `clusters ${JSON.stringify(eyes.map((cl) => [cl.count, cl.cx]))}`);
    if (!(eye.skinPct >= CAMEO_SKIN_MIN)) {
      bad(`[O.1] the cameo has no face: ${eye.skinPct}% skin (floor ${CAMEO_SKIN_MIN}%; ` +
          `the shipped card measures 30.1%)`);
    }
    if (eyes.length !== EYE_CLUSTERS || !main || main.count < EYE_MAIN_MIN) {
      bad(`[O.1] the cameo does not read ONE-EYED: ${eyes.length} amber iris ` +
          `cluster(s), largest ${main ? main.count : 0} samples (want exactly ` +
          `${EYE_CLUSTERS} of >= ${EYE_MAIN_MIN}; a two-eyed face clusters twice, ` +
          `a faceless card zero)`);
    } else if (!(main.cx >= 0.30 && main.cx <= 0.72)) {
      bad(`[O.1] the single eye is not where a face carries it (centre ${main.cx})`);
    } else if (facts['O.1a']) {
      facts['O.1'] = facts['O.1a'] + `; cameo one-eyed (${main.count} iris samples ` +
                     `at cx ${main.cx}), skin ${eye.skinPct}%`;
    }
  }
  const skinCard = await page.evaluate(async (url) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const x0 = Math.round(c.width * 0.15), y0 = Math.round(c.height * 0.15);
    const w = Math.round(c.width * 0.7), h = Math.round(c.height * 0.7);
    const d = g.getImageData(x0, y0, w, h).data;
    let n = 0, dark = 0, sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++; sum += l; sq += l * l;
      if (l < 70 && d[i] >= d[i + 2] - 6) dark++;
    }
    const mean = sum / n;
    return { dark: +(dark / n).toFixed(3), mean: +mean.toFixed(1),
             sd: +Math.sqrt(sq / n - mean * mean).toFixed(1) };
  }, new URL('./assets/inset/plate-wineskin.jpg', URL_).toString()).catch((e) => {
    bad('[O.2] the wineskin inset bytes did not decode: ' + e.message); return null;
  });
  if (skinCard) {
    note(`[O.2] the inset's bytes: dark-skin fraction ${skinCard.dark}, mean ${skinCard.mean}, sd ${skinCard.sd}`);
    if (!(skinCard.dark >= INSET_DARK_MIN && skinCard.sd >= INSET_SD_MIN)) {
      bad(`[O.2] the inset does not read as the dark goatskin — dark ${skinCard.dark} ` +
          `(floor ${INSET_DARK_MIN}), sd ${skinCard.sd} (floor ${INSET_SD_MIN})`);
    } else if (facts['O.2']) {
      facts['O.2'] += `; bytes dark ${skinCard.dark} / sd ${skinCard.sd}`;
    }
  }

  /* ---- 5.5 THE SEEDED DEDICATION (identity-as-seed, zero generation) ------ *
   * The closing card's ask: a name typed onto the settled card regenerates,
   * LIVE PER KEYSTROKE, a laurel sigil that is a PURE FUNCTION of the name —
   * FNV-1a seeds every leaf angle, length, berry and grain of jitter
   * (app/sigil.js; no Date.now, no Math.random, by the engine's own law).
   * Five teeth: (a) the ask rises only after the card settles and reads the
   * amendment's own string; (b) empty input = NO sigil and no line; (c) the
   * sigil is byte-deterministic — the same name draws the SAME canvas across
   * a FULL RELOAD, asserted byte-equal on the canvas's own dataURL AND
   * pixel-identical on the decoded element screenshots; (d) it regenerates
   * per keystroke (every distinct trimmed prefix draws a distinct canvas);
   * (e) it is skippable — a click anywhere else recedes the ask and the
   * card rests undisturbed. NOTE: this section runs after every probe that
   * reads this page's performance/audio ledgers, because it RELOADS. */
  {
    const DED_NAME = 'Penelope of Ithaca';       // spaces on purpose: the
                                                 // space key must TYPE, not page
    const sigilURL = () => page.evaluate(() =>
      document.getElementById('sigil').toDataURL('image/png'));
    const dedState = () => page.evaluate(() => ({
      ...window.__state().ded,
      op: getComputedStyle(document.getElementById('dedicate')).opacity,
      ask: document.getElementById('dedname').placeholder,
      line: document.getElementById('dedline').textContent.replace(/\s+/g, ' ').trim(),
    }));
    const typeName = async (perKey) => {
      await page.focus('#dedname');
      for (const ch of DED_NAME) {
        await page.keyboard.type(ch);
        if (perKey) perKey.push(await sigilURL());
      }
    };

    /* (a) the ask rose when the card settled, and it is the amendment's ask */
    const d0 = await dedState();
    if (!d0.shown || +d0.op < 0.99) {
      bad(`[dedication] the ask never rose after the card settled ` +
          `(shown=${d0.shown}, opacity=${d0.op})`);
    }
    if (d0.ask !== 'Who read this?') {
      bad(`[dedication] the ask reads '${d0.ask}', AMENDMENT A1 says 'Who read this?'`);
    }
    /* (b) before any key: no sigil, no line, a blank canvas */
    const blankPng = await sigilURL();
    if (d0.named || d0.line) {
      bad(`[dedication] a sigil/line is up before any name was typed ` +
          `(named=${d0.named}, line='${d0.line}')`);
    }

    /* (d) live per keystroke: every distinct trimmed prefix, a distinct sigil */
    const perKey = [];
    await typeName(perKey);
    const wantDistinct = new Set(
      [...DED_NAME].map((_, i) => DED_NAME.slice(0, i + 1).trim())).size;
    const gotDistinct = new Set(perKey).size;
    if (gotDistinct !== wantDistinct) {
      bad(`[dedication] the sigil did not regenerate LIVE per keystroke — ` +
          `${gotDistinct} distinct drawings over ${DED_NAME.length} keys ` +
          `(law: ${wantDistinct}, one per distinct trimmed prefix)`);
    }
    if (perKey.includes(blankPng)) {
      bad('[dedication] a typed name drew a BLANK canvas');
    }
    const d1 = await dedState();
    if (!d1.named) bad('[dedication] the typed name raised no sigil');
    if (!new RegExp(`^this reading belonged to ${DED_NAME}$`, 'i').test(d1.line)) {
      bad(`[dedication] the belonged line reads '${d1.line}' ` +
          `(law: 'This reading belonged to ${DED_NAME}')`);
    }
    const hashA = d1.hash, urlA = perKey[perKey.length - 1];
    await page.evaluate(() => window.__renderNow());
    const shotA = await page.locator('#sigil').screenshot(
      { path: path.join(SHOTS, 'end-2-sigil-a.png') });
    await shot('end-3-dedication');

    /* (c) the reload: same name, same sigil, byte for byte */
    await page.goto(URL_, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
    await page.evaluate(() => window.__mute(true));
    await page.evaluate(async () => await window.__gotoUnit('sailedon'));
    await click();                        // sailedon endsBook -> the card's turn
    await T(3.0);
    const q2 = await st();
    if (!(q2.end.card > 0.9 && q2.ded.shown)) {
      bad(`[dedication] after the reload the card/ask did not rise ` +
          `(card=${q2.end.card}, shown=${q2.ded && q2.ded.shown})`);
    }
    await typeName(null);
    const urlB = await sigilURL();
    const d2 = await dedState();
    await page.evaluate(() => window.__renderNow());
    const shotB = await page.locator('#sigil').screenshot(
      { path: path.join(SHOTS, 'end-4-sigil-b-reload.png') });
    if (d2.hash !== hashA) {
      bad(`[dedication] the hash is not a pure function of the name ` +
          `(${hashA} before the reload, ${d2.hash} after)`);
    }
    if (urlB !== urlA) {
      bad('[dedication] the canvas bytes DIFFER across a reload — the sigil ' +
          'is not fully seeded (dataURL mismatch)');
    }
    try {
      const A = decodePng(shotA), B = decodePng(shotB);
      if (A.width !== B.width || A.height !== B.height) {
        bad(`[dedication] the two sigil screenshots differ in size ` +
            `(${A.width}x${A.height} vs ${B.width}x${B.height})`);
      } else {
        const shaA = createHash('sha256').update(A.data).digest('hex');
        const shaB = createHash('sha256').update(B.data).digest('hex');
        const dd = pixelDiff(A, B, null, 0, 1);
        if (shaA !== shaB || dd.changed !== 0) {
          bad(`[dedication] the sigil is NOT pixel-identical across a reload — ` +
              `${dd.changed}/${dd.samples} px differ (maxΔ ${dd.maxDelta}, ` +
              `sha ${shaA.slice(0, 12)}… vs ${shaB.slice(0, 12)}…)`);
        } else {
          note(`[dedication] '${DED_NAME}' -> fnv 0x${(hashA >>> 0).toString(16)}: ` +
               `${gotDistinct} live redraws, the SAME sigil across a reload ` +
               `(dataURL byte-equal; screenshots sha-equal over ${dd.samples} px)`);
        }
      }
    } catch (e) {
      bad('[dedication] the sigil screenshots did not decode: ' + e.message);
    }

    /* (b again, on the live page) empty input = no sigil, canvas back to blank */
    await page.fill('#dedname', '');
    const d3 = await dedState();
    const blank2 = await sigilURL();
    if (d3.named || d3.line || blank2 !== blankPng) {
      bad(`[dedication] an emptied input still shows a sigil/line ` +
          `(named=${d3.named}, line='${d3.line}', canvasBlank=${blank2 === blankPng})`);
    } else {
      note('[dedication] empty input = no sigil, no line, the canvas back to its blank bytes');
    }

    /* (e) the skip: a click anywhere else recedes the ask; the card rests */
    await page.mouse.click(24, 24);
    const d4 = await dedState();
    const q4 = await st();
    if (!d4.skipped || +d4.op > 0.01) {
      bad(`[dedication] the skip click did not recede the ask ` +
          `(skipped=${d4.skipped}, opacity=${d4.op})`);
    }
    if (!q4.finished || !q4.blankLeaf || q4.errors.length) {
      bad(`[dedication] skipping disturbed the rest state (finished=${q4.finished}, ` +
          `blankLeaf=${q4.blankLeaf}, errors=${q4.errors.length})`);
    }
    if (d4.skipped && +d4.op <= 0.01 && q4.finished && q4.blankLeaf) {
      note('[dedication] the skip: a click elsewhere receded the ask; the card rests');
    }
  }

  /* ---- 6. soft-fail: no gate is a wall (Beat I excluded by design) ------- */
  await page.evaluate(async () => await window.__gotoUnit('sword'));
  const beforeSoft = (await st()).i;
  await T(31);
  const afterSoft = await st();
  if (!(afterSoft.i !== beforeSoft || afterSoft.softFails > 0)) {
    bad('the sword gate did not soft-fail after 30 s');
  } else {
    note(`soft-fail: the sword gate satisfied itself after 30 s (softFails=${afterSoft.softFails})`);
  }

  /* ---- 6b. [memory] the RELUCTANT half: a forced >= 4 s hesitation -------- *
   * The read above answered defy fast and got the eager clause (section 2).
   * Here the same gate is re-armed and the resolve is HELD past the
   * threshold: jump to defy (the jump replays jeer's resolution silently, so
   * O.12's second-click law still stands), dwell 4.6 s of story time, click,
   * then walk the card up again off sailedon and hold the sub reads the
   * RELUCTANT clause. This is the gate-miss pass's dwell made a law. */
  {
    await page.evaluate(async () => await window.__gotoUnit('defy'));
    await T(4.6);                       // the forced hesitation, story seconds
    const hit = await page.evaluate(() => window.__gateClick());
    const qh = await st();
    if (!hit.ok) bad('[memory] the defy gate did not resolve on the dwelled click');
    if (!(qh.hesit >= HESIT_EAGER_S)) {
      bad(`[memory] a ${4.6}s dwell recorded hesit=${qh.hesit} ` +
          `(law: >= ${HESIT_EAGER_S} — the memory is not measuring the pause)`);
    }
    await page.evaluate(async () => await window.__gotoUnit('sailedon'));
    await T(0.6);
    await click();                      // sailedon endsBook -> the card's turn
    await T(3.0);
    const qc = await st();
    const cardText2 = await page.evaluate(() =>
      document.getElementById('endcard').textContent.replace(/\s+/g, ' ').trim());
    if (!(qc.end.card > 0.9)) {
      bad(`[memory] the closing card did not rise on the reluctant lap (card=${qc.end.card})`);
    } else if (!HESIT_HELD_RE.test(cardText2) || HESIT_EAGER_RE.test(cardText2)) {
      bad(`[memory] hesit=${qc.hesit}s (>= ${HESIT_EAGER_S}) but the card's sub is not ` +
          `the reluctant clause: '${cardText2}'`);
    } else {
      note(`[memory] defy held ${qc.hesit}s -> the card reads ` +
           `'…as long as he could' (the reluctant clause)`);
    }
  }

  /* ---- 6c. [idle] the micro-idle law: settled principals breathe ---------- *
   * Three stages, four principals, the crew's desync — each sampled at a
   * unit the read already proved settled ([feet]/[parking] ran there):
   *   shiplie   cave: Ulysses standing + the giant SEATED by the fire
   *   embers    cave: the sprawl's chest-rise (scaleY, period ~5 s)
   *   fatherson sea:  Ulysses at the stern + the blinded giant on the brow
   *   smoke     shore: Ulysses + the camp crew (and the desync law)
   * Two samples 3 s apart per principal; see the IDLE_* provenance block. */
  {
    const idleAt = async (key) => {
      await page.evaluate(async (k) => await window.__gotoUnit(k), key);
      await T(1.3);                     // the damped walks settle
      const out = [];
      for (let s = 0; s < 3; s++) {     // THREE samples: the bob and the breath
        const q = await st();           // share one phase, and two samples can
        out.push({ idle: (q.stage && q.stage.idle) || null, stage: q.stage });
        if (s < 2) await T(3.0);        // land symmetric about its peak — three
      }                                 // 3 s apart cannot all coincide
      return out;
    };
    const judge = (who, samples, { dy, sy, drift = 0, markY = null }) => {
      if (samples.some((s) => !s || !s.box)) {
        bad(`[idle] ${who}: no settled idle box to sample (${JSON.stringify(samples[0])})`);
        return;
      }
      let breathes = 0, worstTop = 0, worstBot = 0, capTop = 0, capBot = 0;
      for (let i = 1; i < samples.length; i++) {
        const [ax, ay, aw, ah] = samples[i - 1].box, [bx, by, bw, bh] = samples[i].box;
        const dTop = Math.abs(by - ay), dBot = Math.abs((by + bh) - (ay + ah));
        const moved = dTop + dBot + Math.abs(bw - aw) + Math.abs(bx - ax);
        if (moved > IDLE_MOVE_MIN) breathes++;
        /* peak-to-peak caps: bob + the breath's h share + sway inflation */
        capTop = 2 * dy + 2 * sy * ah + IDLE_ROT_SIN * aw + IDLE_SLACK + drift;
        capBot = 2 * dy + IDLE_ROT_SIN * aw + IDLE_SLACK + drift;
        worstTop = Math.max(worstTop, dTop); worstBot = Math.max(worstBot, dBot);
      }
      const [fy, fh] = [samples[0].box[1], samples[0].box[3]];
      if (!breathes) {
        bad(`[idle] ${who} is DEAD — three samples 3 s apart never moved ` +
            `> ${IDLE_MOVE_MIN} px (law: a settled principal breathes)`);
      } else if (worstTop > capTop || worstBot > capBot) {
        bad(`[idle] ${who} moves PAST the law — top ${worstTop.toFixed(2)} (cap ` +
            `${capTop.toFixed(2)}), foot ${worstBot.toFixed(2)} (cap ${capBot.toFixed(2)})`);
      } else if (markY !== null && !(Math.abs((fy + fh) - markY) <= FEET_SLACK)) {
        bad(`[idle] ${who}'s foot is off its floor mark — box bottom ` +
            `${(fy + fh).toFixed(1)} vs mark y ${markY} (slack ${FEET_SLACK})`);
      } else {
        note(`[idle] ${who}: breathes ${worstTop.toFixed(2)}/${worstBot.toFixed(2)} px ` +
             `(top/foot, caps ${capTop.toFixed(1)}/${capBot.toFixed(1)}), foot on its mark`);
      }
      /* the self-reported amplitudes are the law's own numbers */
      for (const s of samples) {
        if (!(Math.abs(s.dy) <= dy + 0.02 && Math.abs(s.sy - 1) <= sy + 0.0002)) {
          bad(`[idle] ${who} reports an over-law amplitude: dy=${s.dy} (law ${dy}), ` +
              `sy=${s.sy} (law 1±${sy})`);
        }
      }
    };
    /* cave: Ulysses standing + the SEATED giant, one visit */
    const cv = await idleAt('shiplie');
    const pick = (arr, f) => arr.map((s) => (s.idle && f(s.idle)) || null);
    judge('cave ulysses (shiplie)', pick(cv, (i) => i.u),
          { dy: IDLE_DY.man, sy: IDLE_SY.man,
            markY: cv[0].stage.cast ? cv[0].stage.cast.ulysses.mark[1] : null });
    judge('cave giant seated (shiplie)',
          pick(cv, (i) => i.giant && i.giant.pose === 'seat' ? i.giant : null),
          { dy: IDLE_DY.giant, sy: IDLE_SY.giant,
            markY: cv[0].stage.giant ? cv[0].stage.giant.mark[1] : null });
    /* cave: the sprawl's chest-rise — scaleY only, the foot end pinned */
    const sp = await idleAt('embers');
    judge('cave sprawl chest-rise (embers)',
          pick(sp, (i) => i.giant && i.giant.pose === 'sprawl' ? i.giant : null),
          { dy: IDLE_DY.sprawl, sy: IDLE_SY.sprawl,
            markY: sp[0].stage.giant ? sp[0].stage.giant.mark[1] : null });
    /* shore: Ulysses + the crew's DESYNC (per-index phase offsets) */
    const sh = await idleAt('smoke');
    judge('shore ulysses (smoke)', pick(sh, (i) => i.u),
          { dy: IDLE_DY.man, sy: IDLE_SY.man,
            markY: sh[0].stage.cast ? sh[0].stage.cast.ulysses.mark[1] : null });
    for (const [where, snap] of [['shore (smoke)', sh[0]], ['cave (shiplie)', cv[0]]]) {
      const crew = (snap.idle && snap.idle.crew) || [];
      if (crew.length < 2) {
        bad(`[idle] ${where}: fewer than 2 settled crewmen to judge the desync`);
      } else {
        const dys = crew.map((c) => c.dy);
        const spread = Math.max(...dys) - Math.min(...dys);
        if (!(spread > IDLE_MOVE_MIN)) {
          bad(`[idle] ${where}: the crew breathe in LOCKSTEP (dy spread ` +
              `${spread.toFixed(3)} over ${crew.length} men — the phase offsets are gone)`);
        } else {
          note(`[idle] ${where}: ${crew.length} settled crew desynced, ` +
               `dy spread ${spread.toFixed(2)} px`);
        }
      }
    }
    /* sea: Ulysses at the stern + the blinded giant — the world's ambient
       drift rides the boxes, so these carry IDLE_SEA_DRIFT */
    const se = await idleAt('fatherson');
    judge('sea ulysses (fatherson)', pick(se, (i) => i.uly),
          { dy: IDLE_DY.man, sy: IDLE_SY.man, drift: IDLE_SEA_DRIFT });
    judge('sea giant clifftop (fatherson)', pick(se, (i) => i.giant),
          { dy: IDLE_DY.giant, sy: IDLE_SY.seaGiant, drift: IDLE_SEA_DRIFT });
  }

  /* ---- 7. portrait: the same dead-band law, the cropped frame ------------ */
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForFunction(() => window.matchMedia('(max-aspect-ratio: 9/10)').matches);
  await page.evaluate(async () => await window.__gotoUnit('beg'));
  await T(1.6);
  await shot('portrait-0-racks');
  await page.evaluate(async () => await window.__gotoUnit('lastofall'));
  await T(2.0);
  await shot('portrait-1-doorway-twoshot');
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---- 8. the dead-band law over every judged frame ---------------------- */
  const bandRows = Object.entries(bandOf).map(([name, b]) => ({ name, ...b }))
    .sort((a, b) => b.max - a.max);
  const judged = bandRows.filter((b) => b.dim <= 0.5 && !b.blank);
  const overBand = judged.filter((b) => b.max > LANDSCAPE_MAX);
  for (const b of overBand) {
    bad(`${b.name} (${b.unit}${b.portrait ? ', portrait' : ''}): ${(b.max * 100).toFixed(0)}% ` +
        `of the panel is a dead band — L${(b.left * 100).toFixed(0)} R${(b.right * 100).toFixed(0)} ` +
        `T${(b.top * 100).toFixed(0)} B${(b.bottom * 100).toFixed(0)} (limit ${LANDSCAPE_MAX * 100}%)`);
  }
  if (!overBand.length) {
    const w = judged[0];
    note(`dead band: worst JUDGED frame is ${w && w.name} at ${((w || {}).max * 100).toFixed(0)}% ` +
         `(limit ${LANDSCAPE_MAX * 100}%), ${judged.length} judged, ` +
         `${bandRows.length - judged.length} exempt (inset/blank)`);
  }

  /* ---- 9. the inset law, feet + parking, tallied -------------------------- */
  if (insetStuck.length) {
    bad(`[inset law] the wineskin plate is STILL RAISED over ${insetStuck.length} units ` +
        `after misgave (first: ${insetStuck[0].unit} at opacity ${insetStuck[0].op}, ` +
        `last: ${insetStuck[insetStuck.length - 1].unit}) — CONTENT-odyssey.md §2/§6: ` +
        `"the completing click drops the plate and TURNS THE PAGE". The reader plays ` +
        `the rest of the book dimmed under a card, and every dim-exempt law below is ` +
        `exempting frames this defect dimmed.`);
  } else {
    note('the inset law: the wineskin rises on misgave and is down on every later unit');
  }
  const dedupe = (a) => [...new Set(a)];
  for (const m of dedupe(feetBad)) bad('[feet] ' + m);
  if (!feetBad.length) {
    note(`feet on the floor: every settled actor stood on the ledger's own lines ` +
         `(${feetSamples} settled frames sampled)`);
  }
  if (!feetSamples && !insetStuck.length) {
    bad('[feet] no settled frame was ever sampled — the floor law did not run');
  }
  for (const m of dedupe(parkBad)) bad('[parking] ' + m);
  if (!parkBad.length) {
    note(`[parking] no settled foot inside a registered obstacle across ${parkSamples} ` +
         `sampled frames; the sprawl's clearances held >= ${SPRAWL_CLEAR_MIN} px across ` +
         `${sprawlLedger.length} sprawl frames`);
  }
  if (!parkSamples && !insetStuck.length) {
    bad('[parking] no settled frame was ever sampled — the parking law did not run');
  }

  /* ---- 9.5 THE STRIPS, tallied: cycled + feet anchored (sha was gate 0) --- *
   * The sherlock pair, per wired strip: 'the walk strip never cycled'
   * (>= 2 distinct frames over the samples), and the foot off the RENDERED
   * box within the anchor law's tolerance of the set's own mark. A family
   * with NO samples means the wiring never ran — that is a lap hole, not a
   * pass. */
  const STRIP_LAW = [
    ['giant', 'polyphemus-walk (cave, the Beat II entrance + flock crossings)', STRIP_DY_MAX],
    ['crew-cave', 'crew-walk (cave, the entry file / scatter)', STRIP_DY_MAX],
    ['twist', 'stake-twist (cave, the auger on the blinding clock)', STRIP_DY_MAX],
    ['ram', 'ram-walk (cave, the dawn stream)', STRIP_DY_MAX],
    ['rower', 'crew-row-retry (sea, the six benches — supersedes the n=4 loop)', STRIP_ROWER_DY_MAX],
    ['shore-ulysses', 'ulysses-walk (shore, the council/boarding crossings)', STRIP_DY_MAX],
    ['shore-crew', 'crew-walk (shore, the council/boarding crossings)', STRIP_DY_MAX],
    /* the ody-video2 LOOPS: same pair of laws (cycled + anchored feet) */
    ['milk', 'giant-milk (cave, the milking routine at the seat)', STRIP_DY_MAX],
    ['stroke', 'giant-stroke (cave, the ram-back hand-pass)', STRIP_DY_MAX],
    ['grope', 'giant-grope-sway (cave, the blinded doorway bulk)', STRIP_DY_MAX],
    ['curse', 'curse-sway (sea, the O.14a document frame)', STRIP_DY_MAX],
    ['run', 'crew-run (shore, the dash aboard at push-off)', STRIP_DY_MAX],
  ];
  for (const [key, name, tol] of STRIP_LAW) {
    const ev = stripEv[key];
    if (!ev.n) {
      bad(`[strips] ${name} was never seen live — the wiring (or this lap's sampling) did not run`);
      continue;
    }
    if (ev.frames.size < 2) {
      bad(`[strips] the ${key} walk strip never cycled (frames ${JSON.stringify([...ev.frames])} ` +
          `over ${ev.n} samples)`);
    }
    if (ev.worst > tol) {
      bad(`[strips] the ${key} strip's foot leaves its mark by ${ev.worst.toFixed(2)} plate px ` +
          `at ${ev.worstAt} (law <= ${tol}; rendered box vs the set's own pose — the anchor law)`);
    }
    if (ev.frames.size >= 2 && ev.worst <= tol) {
      note(`[strips] ${key}: ${ev.frames.size} frames over ${ev.n} samples, ` +
           `worst foot error ${ev.worst.toFixed(2)} px (<= ${tol})`);
    }
  }
  if (rowerLockstep) {
    bad(`[strips] the six benches rowed in LOCKSTEP under effort — ${rowerLockstep} ` +
        `(the per-bench phase stagger is gone)`);
  }

  /* ---- 9.6 THE ANTI-SKATE LAW, tallied (the King law's proof) ------------- *
   * Per walk family, single-stepped mid-motion evidence: while the strip
   * frame — the registry anchor, the planted foot — HELD between consecutive
   * fixed 1/60 s steps, the rendered foot's screen x moved <= SKATE_MAX css
   * px. Too few mid-motion samples means the probe never caught the walk:
   * a lap hole, not a pass. */
  for (const fam of SKATE_FAMS) {
    const ev = skateEv[fam];
    if (ev.samples < SKATE_MIN_SAMPLES) {
      bad(`[anti-skate] ${fam}: only ${ev.samples} mid-motion samples ` +
          `(law >= ${SKATE_MIN_SAMPLES}) — the walk was never single-stepped`);
      continue;
    }
    if (!ev.pairs) {
      bad(`[anti-skate] ${fam}: no frame ever HELD across consecutive steps — ` +
          `nothing anchored to measure`);
      continue;
    }
    if (ev.worst > SKATE_MAX) {
      bad(`[anti-skate] ${fam}: the planted foot slides ${ev.worst.toFixed(2)} css px/frame ` +
          `at ${ev.worstAt} (law <= ${SKATE_MAX} while the anchor holds)`);
    } else {
      note(`[anti-skate] ${fam}: ${ev.samples} mid-motion samples, ${ev.pairs} held-anchor ` +
           `pairs, worst planted-foot slide ${ev.worst.toFixed(3)} css px/frame (<= ${SKATE_MAX})`);
    }
  }

  /* ---- 9.7 THE BRIDGES, tallied: PLAY-ONCE (the ody-video2 law) ----------- *
   * A bridge (kind:'bridge') is a pose transition whose frame is the act's
   * own clamped progress (setkit bridgeFrame), so on stage it must have been
   * seen to (a) play FORWARD ONLY — sampled frames monotone nondecreasing,
   * with >= minSamples mid-play samples or the wiring never ran; (b) START
   * near its pose-A cell and (c) REACH its landing cell (endMin — n-1 where
   * the sampling is dense, n-3 where the play is short against the poll),
   * whose pixels the build gate proved against pose B (endpoint XOR law) —
   * the set swaps to the static pose B cut it already uses from there, and
   * the pose-B swap itself is asserted at its own unit (clutch at the O.6
   * sample, drink at O.7, sprawl under the drive, hurl on the rock clocks);
   * (d) keep its FEET on the mark (the anchor law, same tolerance as every
   * walk). The drink bridge additionally owes its playCount (3 — the set's
   * own drinkPlays, a pure function of the bowl clock) and the windup its
   * two parked plays (the set's hurlDone flags). */
  {
    const N10 = 10;
    const BRIDGE_LAW = [
      /* key:play                          what                minS firstMax endMin */
      ['seize:firstmeal', 'seize (seat->clutch, meal 1 of the O.6 triple)', 4, 4, N10 - 1],
      ['seize:morningmeal', 'seize (meal 2 — staged identically)', 4, 4, N10 - 1],
      ['seize:suppertwo', 'seize (meal 3 — staged identically)', 4, 4, N10 - 1],
      ['drink:play1', 'drink (pour 1, the reader\'s own hold)', 2, 5, N10 - 4],
      ['drink:play2', 'drink (pour 2, the pantomime refill)', 2, 5, N10 - 4],
      ['drink:play3', 'drink (pour 3 — O.7\'s three heedless drains)', 2, 5, N10 - 4],
      ['collapse:play1', 'collapse (drink->sprawl, the ~6 s neck)', 6, 1, N10 - 1],
      ['hurl-windup:play1', 'hurl-windup (rock 1\'s clock)', 2, 6, N10 - 3],
      ['hurl-windup:play2', 'hurl-windup (rock 2, O.14b)', 2, 6, N10 - 3],
    ];
    for (const [id, name, minS, firstMax, endMin] of BRIDGE_LAW) {
      const ev = bridgeEv[id];
      if (!ev || ev.frames.length < minS) {
        bad(`[bridges] ${name} was never seen mid-play (${ev ? ev.frames.length : 0} ` +
            `samples, law >= ${minS}) — the play-once wiring (or its sampling) did not run`);
        continue;
      }
      const f = ev.frames;
      const backstep = f.findIndex((v, i) => i > 0 && v < f[i - 1]);
      if (backstep >= 0) {
        bad(`[bridges] ${name} PLAYED BACKWARD — frames ${JSON.stringify(f)} ` +
            `(a bridge is play-once: clamped progress can never ping-pong)`);
      }
      if (!(f[0] <= firstMax)) {
        bad(`[bridges] ${name} was first seen at frame ${f[0]} (law <= ${firstMax}) — ` +
            `the play did not start from pose A's end of the chain`);
      }
      if (!(Math.max(...f) >= endMin)) {
        bad(`[bridges] ${name} never REACHED its landing cell — max frame ` +
            `${Math.max(...f)} of ${N10 - 1} (law >= ${endMin}; the landing cell is ` +
            `the build-gated pose B match, so short of it the swap is a pop)`);
      }
      if (ev.worst > STRIP_DY_MAX) {
        bad(`[bridges] ${name}: the foot leaves its mark by ${ev.worst.toFixed(2)} ` +
            `plate px at ${ev.at} (the anchor law, <= ${STRIP_DY_MAX})`);
      }
      if (backstep < 0 && f[0] <= firstMax && Math.max(...f) >= endMin &&
          ev.worst <= STRIP_DY_MAX) {
        note(`[bridges] ${id}: ${f.length} samples ${f[0]}..${Math.max(...f)}, ` +
             `monotone, worst foot ${ev.worst.toFixed(2)} px`);
      }
    }
    if (drinkPlaysSeen !== 3) {
      bad(`[bridges] the drink bridge's playCount is ${drinkPlaysSeen}, the plan's ` +
          `law is 3 (three fills, three heedless drains — O.7's carrier)`);
    }
    if (!hurlDoneSeen.rock1 || !hurlDoneSeen.rock2) {
      bad(`[bridges] the windup never PARKED on pose B — hurlDone ` +
          `${JSON.stringify(hurlDoneSeen)} (both rock clocks must cross 'loose')`);
    }
  }

  /* ---- 10. the fact ledger, printed --------------------------------------- */
  for (const id of ['O.1', 'O.2', 'O.3', 'O.4', 'O.5', 'O.6', 'O.7', 'O.8a', 'O.8b',
                    'O.9', 'O.10', 'O.11', 'O.12', 'O.13a', 'O.13b', 'O.14a', 'O.14b']) {
    const family = id.replace(/[ab]$/, '');       // a failure names the fact OR its family
    if (facts[id]) note(`[${id}] ${facts[id]}`);
    else if (!fail.some((f) => f.includes(id) || f.includes(family + ']'))) {
      // a fact with neither evidence nor a named failure is a hole in the lap itself
      if (['O.7', 'O.9'].includes(id) && facts[id + '-hold']) note(`[${id}] ${facts[id + '-hold']}`);
      else bad(`[${id}] the fact was never proven on screen and never failed by name — the lap has a hole`);
    }
  }

  const out = {
    ok: fail.length === 0,
    ms: Date.now() - t0,
    units: { total: units.length, entered: seen.length, order: seen },
    beats: beats.map((b) => ({ ...b, entered: beatsSeen[b.n] || 0 })),
    gates, turns, latchProof, restProof, releaseProof,
    heads, meals: meals.map(({ frame, ...m }) => m),
    facts, cameoLog, sprawl: sprawlLedger, insetStuck,
    deadBands: bandRows.slice(0, 14), limit: LANDSCAPE_MAX,
    feetSamples, parkSamples,
    strips: Object.fromEntries(STRIP_LAW.map(([k]) => [k, {
      frames: [...stripEv[k].frames].sort(), n: stripEv[k].n,
      worst: +stripEv[k].worst.toFixed(2), worstAt: stripEv[k].worstAt,
    }])),
    rowerLockstep,
    bridges: Object.fromEntries(Object.entries(bridgeEv).map(([k, e]) => [k, {
      frames: e.frames, worst: +e.worst.toFixed(2), at: e.at,
    }])),
    drinkPlays: drinkPlaysSeen, hurlDone: hurlDoneSeen,
    skate: Object.fromEntries(SKATE_FAMS.map((k) => [k, {
      samples: skateEv[k].samples, pairs: skateEv[k].pairs,
      worst: +skateEv[k].worst.toFixed(3), worstAt: skateEv[k].worstAt,
      max: SKATE_MAX,
    }])),
    feetViolations: dedupe(feetBad), parkingViolations: dedupe(parkBad),
    eye, inset: skinCard, gaps,
    audio: { bed: audio.bedId, cues: audio.log.length },
    failures: fail,
  };
  fs.writeFileSync(path.join(SHOTS, 'lap-ody.json'), JSON.stringify(out, null, 1));
  await browser.close();
  srv.close();
  console.log('\n' + (fail.length ? `LAP FAILED (${fail.length})` : 'LAP CLEAN') +
              `  ${((Date.now() - t0) / 1000).toFixed(1)}s  shots -> ${SHOTS}`);
  process.exit(fail.length ? 1 : 0);
}

const kill = setTimeout(() => { console.log('LAP TIMEOUT'); process.exit(2); }, TIMEOUT);
kill.unref?.();
main().catch((e) => { console.error('LAP CRASH', e); process.exit(3); });
