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
 * Usage: node tools/living/beat1-identity.mjs [--tol 8]
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
const BASE = '/tmp/gl-beat1-base';

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

if (!fs.existsSync(BUNDLE)) { console.log('no bundle to compare against:', BUNDLE); process.exit(2); }
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(BASE, { recursive: true });
execFileSync('unzip', ['-q', '-o', BUNDLE, '-d', BASE]);

const A = await frames(path.join(BASE, 'living'), 8831);
const B = await frames(path.join(ROOT, 'site-deploy', 'living'), 8832);

let bad = 0;
for (const [key] of PINS) {
  const a = A[key], b = B[key];
  let n = 0, mx = 0;
  if (a.width !== b.width || a.height !== b.height) { n = -1; } else {
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]),
                         Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (d > mx) mx = d;
      if (d > TOL) n++;
    }
  }
  if (n) bad++;
  console.log(`  ${key.padEnd(12)} ${n === 0 ? 'identical' : n + ' px differ'}   maxdelta ${mx}`);
}
console.log(bad ? `BEAT I MOVED (${bad}/${PINS.length} frames)` : `BEAT I HELD — ${PINS.length}/${PINS.length} frames pixel-identical to the shipped build`);
process.exit(bad ? 1 : 0);
