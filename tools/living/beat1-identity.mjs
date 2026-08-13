/**
 * beat1-identity.mjs — BEAT I MUST NOT MOVE.
 *
 * Beat I is LIVE. Extending the app to the whole chapter re-homed its stage
 * (stage.js -> sets/room.js), gave it a SET shell, a story clock, five more
 * page turns and four more gates — and none of that is allowed to change a
 * pixel of it.
 *
 * This is that, measured. It runs the SHIPPED build (unzipped out of
 * living-book-bundle.zip) and the working tree side by side, jumps both to the
 * same Beat I units, pins both to the SAME ABSOLUTE STORY TIME with
 * __setTime — every ambient in this stack is a pure function of it, so an
 * unpinned comparison measures the harness, not the app — and diffs the
 * frames.
 *
 * WHICH BASELINE. `living-book-bundle.zip` is whatever was last packed, and it
 * is NOT necessarily what is deployed: on the fable-pass fix round it was two
 * commits old, so "BEAT I MOVED 16/16" was reporting the previous round's
 * accepted changes as well as this round's. A regression check has to run
 * against the state it claims not to regress from, so `--base DIR` takes any
 * unpacked build — e.g. HEAD, which is what the live URL serves:
 *
 *   rm -rf /tmp/gl-b1-head && mkdir -p /tmp/gl-b1-head
 *   git -C site-deploy archive HEAD living | tar -x -C /tmp/gl-b1-head
 *   node tools/living/beat1-identity.mjs --base /tmp/gl-b1-head/living
 *
 * Usage: node tools/living/beat1-identity.mjs [--tol 8] [--base DIR]
 * Exit 0 only if every frame is identical.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { decodePng } from '../png.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const TOL = +((args.indexOf('--tol') >= 0 && args[args.indexOf('--tol') + 1]) || 8);
const BUNDLE = path.join(ROOT, 'living-book-bundle.zip');
const UNZIP_TO = '/tmp/gl-beat1-base';
/* --base takes an ALREADY-UNPACKED build and uses it verbatim. This flag was
   documented in the header from the start and was never wired up: every run
   silently unzipped living-book-bundle.zip instead, which is whatever was last
   packed and NOT necessarily what is deployed. That is the bug the header itself
   warns about ("BEAT I MOVED 16/16 was reporting the previous round's accepted
   changes as well as this round's") — the flag that was supposed to be the cure
   was the thing that was broken. */
const BASE_ARG = args.indexOf('--base') >= 0 ? args[args.indexOf('--base') + 1] : null;

/* the frames: one per device the beat owns — the toss, the note plate, the
   hold's reveal, the crossing, the arrival, the entrance, the three-shot, the
   unmask, the index, the photograph, the exit. */
const PINS = [['head', 3.0], ['post', 1.4], ['undated', 1.4], ['note2', 1.2],
  ['wmark', 1.6], ['gaz2', 2.6], ['comes2', 1.8], ['hadnote', 2.6], ['seat', 1.6],
  ['ormstein', 1.2], ['iamking', 1.4], ['letmesee', 1.2], ['both', 1.6],
  ['five', 1.2], ['briony', 1.4], ['goodnight', 1.2]];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
function serve(dir, port) {
  const s = createServer(async (q, r) => {
    try {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const fp = path.join(dir, u === '/' ? 'index.html' : u);
      const b = await readFile(fp);
      r.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404).end(''); }
  });
  return new Promise((ok) => s.listen(port, () => ok(s)));
}

async function frames(dir, port) {
  const srv = await serve(dir, port);
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await pg.goto(`http://127.0.0.1:${port}/?harness=1`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__ready === true, { timeout: 30000 });
  await pg.evaluate(() => window.__mute(true));
  const out = {};
  for (const [key, t] of PINS) {
    await pg.evaluate(async (k) => await window.__gotoUnit(k), key);
    await pg.evaluate((d) => window.__setTime(d), t);      // absolute, pinned
    await pg.evaluate(() => window.__renderNow());
    out[key] = decodePng(await pg.screenshot());
  }
  await br.close(); srv.close();
  return out;
}

let baseDir;
if (BASE_ARG) {
  baseDir = path.resolve(BASE_ARG);
  if (!fs.existsSync(path.join(baseDir, 'index.html'))) {
    console.log('--base is not an unpacked living build (no index.html):', baseDir);
    process.exit(2);
  }
  console.log('baseline: ' + baseDir + '  (unpacked build, used verbatim)');
} else {
  if (!fs.existsSync(BUNDLE)) { console.log('no bundle to compare against:', BUNDLE); process.exit(2); }
  fs.rmSync(UNZIP_TO, { recursive: true, force: true });
  fs.mkdirSync(UNZIP_TO, { recursive: true });
  execFileSync('unzip', ['-q', '-o', BUNDLE, '-d', UNZIP_TO]);
  baseDir = path.join(UNZIP_TO, 'living');
  console.log('baseline: ' + BUNDLE + '  (last packed bundle — NOT necessarily what is ' +
              'deployed; pass --base for a build you can name)');
}

const A = await frames(baseDir, 8831);
const B = await frames(path.join(ROOT, 'site-deploy', 'living'), 8832);

/* WHERE it moved, not just how much. "Beat I is pixel-identical where it was not
   touched" is a claim about a REGION, so the diff reports the bounding box of the
   changed pixels in device px. A fix's own box (Watson's armchair, the window
   band, the heading's type) is a small named rectangle; a regression is a box
   somewhere nobody worked. Without this the tool can only say 16/16 MOVED, which
   is what let the last round argue about it instead of reading it. */
let bad = 0;
const moved = [];
for (const [key] of PINS) {
  const a = A[key], b = B[key];
  let n = 0, mx = 0, x1 = Infinity, y1 = Infinity, x2 = -1, y2 = -1;
  if (a.width !== b.width || a.height !== b.height) { n = -1; } else {
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]),
                         Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (d > mx) mx = d;
      if (d > TOL) {
        n++;
        const p = i / 4, x = p % a.width, y = (p - x) / a.width;
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
    }
  }
  if (n) bad++;
  const box = n > 0 ? `  box [${x1},${y1} ${x2 - x1 + 1}x${y2 - y1 + 1}]` : '';
  const pct = n > 0 ? ` (${(100 * n / (a.width * a.height)).toFixed(2)}% of frame)` : '';
  if (n > 0) moved.push({ key, n, mx, box: [x1, y1, x2 - x1 + 1, y2 - y1 + 1] });
  console.log(`  ${key.padEnd(12)} ${n === 0 ? 'identical' : n + ' px differ'}${pct}` +
              `   maxdelta ${mx}${box}`);
}
console.log(bad ? `BEAT I MOVED (${bad}/${PINS.length} frames)` : `BEAT I HELD — ${PINS.length}/${PINS.length} frames pixel-identical to the shipped build`);
process.exit(bad ? 1 : 0);
