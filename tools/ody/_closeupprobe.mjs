/* _closeupprobe.mjs — eyeball the recomposed lenses BEFORE shipping them:
 * serve the site, patch the live FOCUS tables in-page, jump to each unit,
 * snap landscape + portrait. Usage: node tools/ody/_closeupprobe.mjs */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living-odyssey');
const OUT = path.join(ROOT, 'shots', 'closeup-probe');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((ok) => srv.listen(8817, ok));

const PATCH = {
  shore: {
    'fire-close': [390, 472, 11.6], 'council-close': [545, 480, 8.6],
    'ship-mid': [545, 488, 8.6],
  },
  cave: {
    'racks-sweep': [700, 315, 2.4], 'scheme-push': [770, 500, 3.2],
    collapse: [770, 460, 2.2], 'sprawl-groan': [720, 480, 2.6],
    puzzling: [638, 450, 1.75], 'lash-close': [950, 505, 3.2],
    'freed-overshoulder': [430, 430, 2.35],
  },
  sea: {
    stern: [518, 415, 10.6], 'stern-rail': [506, 400, 12.3],
    'menbeg-close': [545, 437, 14.1], 'defy-strait': [640, 300, 2.25],
    'hades-twoshot': [663, 315, 2.3], clifftop: [870, 195, 3.1],
    curse: [870, 180, 2.6],
  },
};
const JUMPS = [
  ['iamulysses', 'fire-close'], ['council', 'council-close'],
  ['wineskin', 'ship-mid'], ['smoke', 'council'],
  ['beg', 'racks-sweep'], ['scheme', 'scheme-push'], ['neck', 'collapse'],
  ['nomankilling', 'sprawl-groan'], ['puzzling', 'puzzling'],
  ['withies', 'lash-close'], ['freed', 'freed-overshoulder'],
  ['taunt', 'stern'], ['menbeg', 'menbeg-close'], ['defy', 'defy-strait'],
  ['myname', 'stern-rail'], ['prophecy', 'clifftop'], ['hades', 'hades-twoshot'],
  ['curse', 'curse'],
];

const br = await chromium.launch();
for (const [w, h, tag] of [[1280, 800, 'land'], [430, 932, 'port']]) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await pg.goto('http://127.0.0.1:8817/?harness=1');
  await pg.waitForFunction(() => window.__ready);
  await pg.evaluate((P) => {
    window.__mute(true);
    window.__patchFocus = (set) => {
      const a = window.__refs.stage.active;
      if (a && a.FOCUS && P[set]) Object.assign(a.FOCUS, P[set]);
    };
  }, PATCH);
  for (const [key, focus] of JUMPS) {
    await pg.evaluate(async ({ key, focus }) => {
      const u = window.__unitByKey(key);
      await window.__gotoUnit(key);
      window.__patchFocus(u.set);
      window.__refs.stage.setFocus(focus, true);
      window.__advance(3.5);           // settle: walks land, glows breathe
      window.__refs.stage.setFocus(focus, true);
      window.__renderNow();
    }, { key, focus });
    await pg.screenshot({ path: path.join(OUT, `${key}-${tag}.png`) });
    console.log('shot', key, tag);
  }
  await pg.close();
}
await br.close();
srv.close();
console.log('DONE -> ' + OUT);
