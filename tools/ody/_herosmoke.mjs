/* _herosmoke.mjs — quick live proof of the heroclip engine before the lap:
 * raise/lower at each granted unit, video progressing, reduced-motion poster.
 * Usage: node tools/ody/_herosmoke.mjs */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..', '..', 'site-deploy', 'living-odyssey');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((ok) => srv.listen(8821, ok));

const br = await chromium.launch();
let fails = 0;
const check = (name, cond, detail) => {
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (detail ? '  ' + detail : ''));
  if (!cond) fails++;
};

const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
pg.on('pageerror', (e) => { console.log('PAGEERR', e.message); fails++; });
pg.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await pg.goto('http://127.0.0.1:8821/?harness=1');
await pg.waitForFunction(() => window.__ready);
await pg.evaluate(() => window.__mute(true));

const clipState = (id) => pg.evaluate((c) => {
  const P = window.__refs.stage.insets[c];
  return P && P.vid ? { k: +P.k.toFixed(3), playing: P.playing, t: P.vid.currentTime,
                        ended: P.vid.ended, w: P.vid.videoWidth } : null;
}, id);

/* 1. firstmeal: not raised at 3.0 (the O.6 window), raised at 4.6, lowered at sword */
await pg.evaluate(async () => { await window.__gotoUnit('firstmeal'); });
await pg.evaluate(() => window.__advance(3.0));
let s = await clipState('clip-seize');
check('seize down at O.6 instant (3.0s)', s && s.k <= 0.1, JSON.stringify(s));
await pg.evaluate(() => window.__advance(1.6));
s = await clipState('clip-seize');
check('seize raised at 4.6s', s && s.k >= 0.85 && s.w === 1280, JSON.stringify(s));
await pg.waitForTimeout(450);
const s2 = await clipState('clip-seize');
check('seize LIVING', s2 && (s2.t > s.t + 0.03 || s2.ended), `t ${s && s.t} -> ${s2 && s2.t}`);
await pg.evaluate(() => { window.__advance(3.0); window.__click(); window.__advance(1.2); });
s = await clipState('clip-seize');
check('seize lowered at sword', s && s.k <= 0.1, JSON.stringify(s));

/* 2. auger -> bore carried, lowered at hiss */
await pg.evaluate(async () => { await window.__gotoUnit('auger'); });
await pg.evaluate(() => window.__advance(2.2));
s = await clipState('clip-twist');
check('twist raised on auger (+2.2)', s && s.k >= 0.85, JSON.stringify(s));
await pg.evaluate(() => window.__advance(6.0));   // clock walks through bore (7.4)
const u1 = await pg.evaluate(() => window.__unit().key);
s = await clipState('clip-twist');
check('twist carried across bore', u1 === 'bore' && s && s.k >= 0.85, u1 + ' ' + JSON.stringify(s));
await pg.evaluate(() => window.__advance(3.4));   // hiss at 10.4
const u2 = await pg.evaluate(() => window.__unit().key);
s = await clipState('clip-twist');
check('twist lowered at hiss', u2 === 'hiss' && s && s.k <= 0.35, u2 + ' ' + JSON.stringify(s));

/* 3. greatram resolution -> dawn5 raised, lowered at handpass */
await pg.evaluate(async () => { await window.__gotoUnit('greatram'); });
await pg.evaluate(() => window.__advance(2.5));
const hit = await pg.evaluate(() => window.__gateClick());
await pg.evaluate(() => window.__advance(1.0));
s = await clipState('clip-underbelly');
check('underbelly raised on G5 resolution', hit.ok && s && s.k >= 0.85, JSON.stringify(s));
await pg.waitForTimeout(450);
const s3 = await clipState('clip-underbelly');
check('underbelly looping', s3 && s3.t !== s.t, `t ${s && s.t} -> ${s3 && s3.t}`);
await pg.evaluate(() => { window.__click(); window.__advance(1.2); });
s = await clipState('clip-underbelly');
check('underbelly lowered after dawn5 click', s && s.k <= 0.1,
      (await pg.evaluate(() => window.__unit().key)) + ' ' + JSON.stringify(s));

/* 4. rock1: down at entry, raised on the land tick, lowered at twiceasfar */
await pg.evaluate(async () => { await window.__gotoUnit('jeer'); });
await pg.evaluate(() => window.__advance(1.5));
await pg.evaluate(() => window.__gateClick());
await pg.evaluate(() => window.__advance(8.5));   // jeer+8.5: rock1 entered at 7.0
let uk = await pg.evaluate(() => window.__unit().key);
s = await clipState('clip-splash');
check('splash still down before the land tick', uk === 'rock1' && s && s.k <= 0.1,
      uk + ' ' + JSON.stringify(s));
await pg.evaluate(() => window.__advance(3.2));   // ~jeer+11.7 > land 10.8 + rise
s = await clipState('clip-splash');
check('splash raised with the plume', s && s.k >= 0.85, JSON.stringify(s));
await pg.evaluate(() => window.__advance(8.0));   // waitDone at 18.8
await pg.evaluate(() => window.__click());
await pg.evaluate(() => window.__advance(1.2));
uk = await pg.evaluate(() => window.__unit().key);
s = await clipState('clip-splash');
check('splash lowered at twiceasfar', uk === 'twiceasfar' && s && s.k <= 0.1,
      uk + ' ' + JSON.stringify(s));

/* 5. determinism of the card: snapshot plate keys carry the clips */
const snap = await pg.evaluate(() => window.__state().stage.plate);
check('snapshot carries clip plates', 'clip-splash' in snap && 'dim' in snap,
      JSON.stringify(Object.keys(snap)));

/* 6. reduced motion: poster still, video never plays */
const pg2 = await br.newPage({ viewport: { width: 1280, height: 800 },
                               reducedMotion: 'reduce' });
pg2.on('pageerror', (e) => { console.log('PAGEERR2', e.message); fails++; });
await pg2.goto('http://127.0.0.1:8821/?harness=1');
await pg2.waitForFunction(() => window.__ready);
await pg2.evaluate(() => window.__mute(true));
await pg2.evaluate(async () => { await window.__gotoUnit('firstmeal'); });
await pg2.evaluate(() => window.__advance(5.0));
const r = await pg2.evaluate(() => {
  const P = window.__refs.stage.insets['clip-seize'];
  return { k: +P.k.toFixed(3), display: P.vid.style.display, t: P.vid.currentTime,
           posterVisible: !!P.im.complete };
});
check('reduced-motion: card up, poster still, video hidden+parked',
      r.k >= 0.85 && r.display === 'none' && r.t === 0 && r.posterVisible,
      JSON.stringify(r));

console.log(fails ? `SMOKE FAILED (${fails})` : 'SMOKE CLEAN');
await br.close();
srv.close();
process.exit(fails ? 1 : 0);
