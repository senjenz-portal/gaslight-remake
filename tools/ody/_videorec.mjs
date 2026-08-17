/* HONEST review clips: five units screen-captured at 30 fps through the
 * harness, WITH their gates and clocks resolved mid-recording — a clip that
 * never answers its own gate shows a frozen freeze-frame and calls it the
 * action (the 2026-08-17 external review's catch: dawn5 without the G5 hit
 * has no ram stream, jeer without the throw has no rock arc).
 *
 * Each RUN is a tiny score: goto the unit that OWNS the staging, roll
 * frames, and fire the listed harness acts at their ticks (gateClick /
 * click / hold-release), so the clip carries the reader's own verbs at the
 * moments a reader would give them. Frames land in /tmp/vid2/frames/<name>/
 * and ffmpeg (run by hand or via --encode) bakes /tmp/vid2/<name>.mp4.
 *
 *   node tools/ody/_videorec.mjs [--encode]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
function serve(dir, port) {
  const s = createServer(async (q, r) => {
    try {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const b = await readFile(path.join(dir, u === '/' ? 'index.html' : u));
      r.writeHead(200, { 'content-type': MIME[path.extname(u === '/' ? 'index.html' : u)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404).end(''); }
  });
  return new Promise((ok) => s.listen(port, () => ok(s)));
}

const FPS = 30, DT = 1 / FPS;

/* Each act fires ONCE, at the first tick >= at.
 *   gateClick — the reader's answer to the armed target gate
 *   click     — a plain advance (a click unit standing between stagings)   */
const RUNS = [
  /* the giant's entry walk — seg `return` is 7.0 s, recorded whole + settle */
  { name: 'return2', goto: 'return2', span: 8.0, acts: [] },

  /* the seize bridge — seg 6.0 s + the sprawl settle */
  { name: 'firstmeal', goto: 'firstmeal', span: 7.0, acts: [] },

  /* THE RAM STREAM: dawn5's escape t0 IS the G5 hit. Land on the greatram
   * gate, let the ram-stand staging breathe 2 s, HIT the gate — slingUnder
   * plays, the story advances to dawn5, cave-dawn fires and the flock
   * streams for the shaft ~14 s. The old clip jumped straight to dawn5,
   * where a settled replay had already dated the stream as history. */
  { name: 'dawn5', goto: 'greatram', span: 17.5,
    acts: [{ at: 2.0, do: 'gateClick' }] },

  /* the drunken collapse — auto 6.5 s riding the 6 s collapse seg */
  { name: 'neck', goto: 'neck', span: 7.5, acts: [] },

  /* THE SEA BEAT, WHOLE: rowing (2.5 s), the reader's jeer (G6 hit), the
   * whip to the stern (taunt, 6 s auto), then ROCK 1's clock at t+7 — tear,
   * arc, splash, the wash driving the ship back (~12 s). The old clip held
   * the un-answered gate for 6 s of rowing loop and no rock ever flew. */
  { name: 'jeer', goto: 'jeer', span: 22.0,
    acts: [{ at: 2.5, do: 'gateClick' }] },
];

const OUT = '/tmp/vid2';
const args = process.argv.slice(2);
const ENCODE = args.includes('--encode');

for (const r of RUNS) fs.mkdirSync(path.join(OUT, 'frames', r.name), { recursive: true });
const srv = await serve('/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey', 8873);
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await pg.goto('http://127.0.0.1:8873/?harness=1', { waitUntil: 'load' });
await pg.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await pg.evaluate(() => window.__mute(true));

for (const run of RUNS) {
  const landed = await pg.evaluate(async (u) => await window.__gotoUnit(u), run.goto);
  if (!landed) { console.log(run.name, 'NOT FOUND at', run.goto); continue; }
  const acts = run.acts.map((a) => ({ ...a, done: false }));
  const dir = path.join(OUT, 'frames', run.name);
  let n = 0;
  const log = [];
  for (let t = 0; t <= run.span + 1e-9; t += DT) {
    for (const a of acts) {
      if (!a.done && t >= a.at - 1e-9) {
        a.done = true;
        if (a.do === 'gateClick') {
          const hit = await pg.evaluate(() => window.__gateClick());
          log.push(`${run.name} @${t.toFixed(2)} gateClick ok=${hit && hit.ok} ` +
                   `${hit && hit.target} ${hit && hit.from}->${hit && hit.to}`);
        } else if (a.do === 'click') {
          await pg.evaluate(() => window.__click());
          log.push(`${run.name} @${t.toFixed(2)} click`);
        }
      }
    }
    await pg.evaluate((d) => window.__advance(d), DT);
    await pg.evaluate(() => window.__renderNow());
    await pg.screenshot({ path: path.join(dir, `f${String(n).padStart(5, '0')}.png`) });
    n++;
  }
  const q = await pg.evaluate(() => {
    const s = window.__state();
    return { unit: s.unit && s.unit.key, set: s.set,
             flock: s.stage.flock ? (s.stage.flock.mode || null) : null,
             clock: s.clock && s.clock.t };
  });
  console.log(run.name, `${n} frames @${FPS}fps`, JSON.stringify(q), ...log.map((l) => '\n  ' + l));
}
await br.close(); srv.close();

if (ENCODE) {
  for (const run of RUNS) {
    const mp4 = path.join(OUT, run.name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-framerate', String(FPS),
      '-i', path.join(OUT, 'frames', run.name, 'f%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4],
      { stdio: 'ignore' });
    console.log('encoded', mp4);
  }
}
