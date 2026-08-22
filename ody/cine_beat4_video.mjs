/**
 * cine_beat4_video.mjs — THE BLINDING, THIRTY SECONDS, AS A READER GETS IT.
 *
 * A frame sheet proves composition; it cannot prove CUTTING. Round 1's two
 * worst notes were both about time — "handheld has no motivated event" and
 * "the same neutral master repeated three times flattens time" — and neither
 * can be judged from stills. So Beat IV is recorded whole: the heading, the
 * ember hold the reader answers with a real press, the auger driven from the
 * floor, the giant filling the frame as the operator breaks loose at contact,
 * and the roar after.
 *
 * The recorder drives the book's OWN fixed-step clock (1/30 s per frame, the
 * same quanta the reader's rAF feeds it) and answers each unit with the verb
 * the unit declares, so nothing is skipped and nothing is faked: what the mp4
 * shows is what the page does.
 *
 *   node tools/ody/cine_beat4_video.mjs [--secs 30] [--fps 30] [--no-encode]
 */
import http from 'node:http';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const argOf = (k, d) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : d; };
const FPS = +argOf('--fps', 30);
const SECS = +argOf('--secs', 30);
const ENCODE = !ARGS.includes('--no-encode');
const START = argOf('--start', 'ody-iv-00-head');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO, 'site-deploy');
const OUTDIR = path.join(REPO, 'shots', 'book3d-r2');
const FRAMES = path.join(REPO, 'tools', 'ody', 'work', 'beat4frames');
const MP4 = path.join(OUTDIR, 'beat4-blinding.mp4');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

await rm(FRAMES, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });
await mkdir(OUTDIR, { recursive: true });

const errors = [];
const browser = await chromium.launch({ headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 },
  deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
console.log('scene ready');

/* the shutter sees the picture, never the reader's two controls */
await page.evaluate(() => document.documentElement.classList.add('noverlay'));
await page.evaluate((id) => window.__book.seek(id), START);
await page.evaluate(() => window.__book.run(0.5));

const clip = await page.evaluate(() => {
  const b = document.getElementById('stage3d').getBoundingClientRect();
  return { x: Math.round(b.left), y: Math.round(b.top),
           width: Math.round(b.width) - (Math.round(b.width) % 2),
           height: Math.round(b.height) - (Math.round(b.height) % 2) };
});
console.log('clip', JSON.stringify(clip));

/* THE VERB SCORE. Each unit is answered the way its own verb asks to be
 * answered — a hold is pressed and released, a click leaf is given a reader's
 * beat and then turned, a clock leaf is left alone because the beat clock owns
 * it. The caps are the only editorial decision in the file: a thirty-second
 * cut cannot wait out a full lean-back dwell. */
const DT = 1 / FPS;
const N = Math.round(SECS * FPS);
const HOLD_AT = 1.2, HOLD_FOR = 2.2, CLICK_AT = 2.6, AUTO_CAP = 5.0, CLOCK_CAP = 12.0;

let cur = await page.evaluate(() => window.__book.unit);
let tOnUnit = 0, holding = false;
const cuts = [{ f: 0, unit: cur }];
const track = [];

for (let n = 0; n < N; n++) {
  const st = await page.evaluate(async ({ dt, hold, holdAt, holdFor, clickAt, autoCap, clockCap, tOn, held }) => {
    const B = window.__book;
    const verb = document.body.dataset.verb;
    let act = null, nowHeld = held;
    if (verb === 'hold') {
      if (!nowHeld && tOn >= holdAt) { B.hold(true); nowHeld = true; act = 'hold-down'; }
      else if (nowHeld && tOn >= holdAt + holdFor) { B.hold(false); nowHeld = false; act = 'hold-up'; }
    } else if (verb === 'release') {
      if (!nowHeld && tOn >= holdAt) { B.hold(true); nowHeld = true; act = 'hold-down'; }
      else if (nowHeld && tOn >= holdAt + holdFor) {
        B.hold(false); nowHeld = false; act = 'release';
        const r = document.getElementById('stage').getBoundingClientRect();
        window.dispatchEvent(new PointerEvent('pointerup',
          { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      }
    } else if (verb === 'click' && tOn >= clickAt) { await B.advance(); act = 'click'; }
    else if (verb === 'auto' && tOn >= autoCap) { await B.advance(); act = 'auto-cap'; }
    else if (verb === 'clock' && tOn >= clockCap) { await B.advance(); act = 'clock-cap'; }
    B.run(dt);
    const c = window.__cine();
    return { unit: B.unit, verb, act, held: nowHeld, ended: B.ended,
             shake: c ? c.shake : 0, rack: c ? c.rack : 0, cls: c ? c.cls : null,
             size: c ? +Number(c.size).toFixed(3) : null };
  }, { dt: DT, hold: holding, holdAt: HOLD_AT, holdFor: HOLD_FOR, clickAt: CLICK_AT,
       autoCap: AUTO_CAP, clockCap: CLOCK_CAP, tOn: tOnUnit, held: holding });
  holding = st.held;
  if (st.unit !== cur) { cuts.push({ f: n, unit: st.unit }); cur = st.unit; tOnUnit = 0; }
  else tOnUnit += DT;
  track.push({ f: n, unit: st.unit, cls: st.cls, shake: st.shake, rack: st.rack, act: st.act });
  await page.screenshot({ path: path.join(FRAMES, `f${String(n).padStart(5, '0')}.png`), clip });
  if (n % 60 === 0) console.log(`frame ${n}/${N} · ${st.unit} · ${st.cls} · shake ${st.shake}`);
  if (st.ended) break;
}

console.log('cuts:', cuts.map((c) => `${(c.f / FPS).toFixed(1)}s ${c.unit}`).join(' | '));
await writeFile(path.join(OUTDIR, 'beat4-track.json'),
  JSON.stringify({ fps: FPS, secs: SECS, cuts, errors,
                   shakePeak: Math.max(...track.map((t) => t.shake || 0)),
                   track }, null, 1));
await browser.close();
server.close();

if (ENCODE) {
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS),
    '-i', path.join(FRAMES, 'f%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17',
    '-movflags', '+faststart', MP4], { stdio: 'inherit' });
  console.log('encoded', MP4);
}
console.log(errors.length ? `ERRORS: ${errors.slice(0, 5).join(' | ')}` : 'zero console errors');
console.log('BEAT4 VIDEO: done');
