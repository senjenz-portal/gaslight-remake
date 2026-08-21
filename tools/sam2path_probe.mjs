/** one-layer diagnostic: dump depths and save the four probe frames */
import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const SET = ARGS[0] || 'cave';
const LAYER = ARGS[1] || 'rack-b';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO, 'site-deploy');
const OUT = path.join(REPO, 'shots', 'sam2path-r1', 'probe');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 940 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await page.goto(`${ORIGIN}/living-odyssey/3d/?harness=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await page.evaluate('window.__mute(true)');
await page.evaluate('window.__ensureAll()');
await page.evaluate((s) => window.__plate.mount(s), SET);

const info = await page.evaluate(([id]) => {
  const S = window.__refs.stage, rec = S.sets[S.activeName];
  const L = rec.plate.layers[id];
  const mats = [];
  const u = S.actors.ulysses;
  u.model.traverse((o) => { if (o.isMesh && o.material)
    mats.push({ transparent: o.material.transparent, depthWrite: o.material.depthWrite,
                depthTest: o.material.depthTest, renderOrder: o.renderOrder,
                opacity: o.material.opacity }); });
  return { ground: L.ground, box: L.box, cardZ: L.z, cardY: L.mesh.position.y,
           cardH: L.mesh.geometry.parameters.height,
           cardRenderOrder: L.mesh.renderOrder,
           cardTransparent: L.mat.transparent, cardDepthWrite: L.mat.depthWrite,
           actorMats: mats.slice(0, 4), actorGroupRO: u.group.renderOrder };
}, [LAYER]);
console.log('layer', LAYER, JSON.stringify(info, null, 1));

const cx = Math.round((info.box[0] + info.box[2]) / 2);
const hA = { cave: 75, shore: 20, sea: 22 }[SET];
const STEP = { cave: 15, shore: 4, sea: 5 }[SET];
const behindPy = Math.max(hA + 6, info.ground - STEP);
const frontPy = Math.min(762, info.ground + STEP);
const yMin = Math.max(0, Math.min(info.box[1], behindPy - hA) - 14);
const yMax = Math.min(768, frontPy + 18);
const xMin = Math.max(0, Math.min(info.box[0], cx - hA) - 20);
const xMax = Math.min(1408, Math.max(info.box[2], cx + hA) + 20);
const k = Math.max(1, Math.min(5, Math.min(1408 / Math.max(60, xMax - xMin),
                                           768 / Math.max(40, yMax - yMin))));
console.log('probe', { cx, behindPy, frontPy, camPy: (yMin + yMax) / 2, k: +k.toFixed(2) });

for (const [tag, py, occ] of [['behind-off', behindPy, false], ['behind-on', behindPy, true],
                              ['front-off', frontPy, false], ['front-on', frontPy, true]]) {
  const z = await page.evaluate(([cx, camPx, camPy, k, py, occ, LID]) => {
    const S = window.__refs.stage;
    window.__plate.cam(camPx, camPy, k);
    window.__plate.stand('ulysses', cx, py);
    window.__plate.occluders(false); if(occ) window.__plate.only(LID);
    window.__plate.draw();
    const L = S.sets[S.activeName].plate.layers[LID];
    return { actorZ: +S.actors.ulysses.group.position.z.toFixed(3),
             cardZ: +L.z.toFixed(3), cardVisible: L.mesh.visible,
             cardY: +L.mesh.position.y.toFixed(3) };
  }, [cx, Math.round((xMin + xMax) / 2), Math.round((yMin + yMax) / 2), k, py, occ, LAYER]);
  console.log(tag, 'py', py, JSON.stringify(z));
  await page.locator('#stage3d').screenshot({ path: path.join(OUT, `${SET}-${LAYER}-${tag}.png`) });
}
/* --- the same arithmetic the gate runs, but visualised --- */
await page.addScriptTag({ content: `
window.__vis = (id, cx, camPx, camPy, k, bPy, fPy, thr, coreThr) => {
  const c = document.getElementById('stage3d');
  const off = document.createElement('canvas');
  off.width = c.width; off.height = c.height;
  const g = off.getContext('2d', { willReadFrequently: true });
  const grab = () => { g.clearRect(0,0,off.width,off.height); g.drawImage(c,0,0);
                       return g.getImageData(0,0,off.width,off.height); };
  const d = (a,b,i) => Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])
                     + Math.abs(a.data[i+2]-b.data[i+2]);
  window.__plate.cam(camPx, camPy, k);
  window.__plate.clear(); window.__plate.occluders(true); window.__plate.draw();
  const P = grab();
  window.__plate.layerGain(id, 0); window.__plate.draw(); const M = grab();
  window.__plate.layerGain(id, 1);
  window.__plate.stand('ulysses', cx, fPy);
  window.__plate.occluders(false); window.__plate.draw(); const F0 = grab();
  window.__plate.occluders(true); window.__plate.draw(); const F1 = grab();
  let core=0, bodyF=0, both=0, shown=0;
  const out = g.createImageData(off.width, off.height);
  for (let i = 0; i < P.data.length; i += 4) {
    const isCore = d(P,M,i) > coreThr, bf = d(P,F0,i) > thr, vis = d(P,F1,i) > thr;
    if (isCore) core++;
    if (bf) bodyF++;
    if (isCore && bf) { both++; if (vis) shown++; }
    out.data[i]   = isCore ? 200 : 0;
    out.data[i+1] = bf ? 200 : 0;
    out.data[i+2] = vis ? 200 : 0;
    out.data[i+3] = 255;
  }
  g.putImageData(out, 0, 0);
  return { core, bodyF, both, shown, url: off.toDataURL('image/png') };
};` });
const iso = await page.evaluate(([camPx, camPy, k]) => {
  const c = document.getElementById('stage3d');
  const off = document.createElement('canvas'); off.width=c.width; off.height=c.height;
  const g = off.getContext('2d', { willReadFrequently: true });
  const grab = () => { g.clearRect(0,0,off.width,off.height); g.drawImage(c,0,0);
                       return g.getImageData(0,0,off.width,off.height); };
  window.__plate.cam(camPx, camPy, k);
  window.__plate.clear();
  window.__plate.occluders(true); window.__plate.draw(); const A = grab();
  window.__plate.occluders(false); window.__plate.draw(); const B = grab();
  window.__plate.occluders(true);
  let n=0, worst=0, hist={};
  for (let i=0;i<A.data.length;i+=4){
    const d = Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
    if (d>16) n++;
    worst = Math.max(worst,d);
  }
  return { differing: n, worst, total: A.data.length/4 };
}, [Math.round((xMin+xMax)/2), Math.round((yMin+yMax)/2), k]);
console.log('cards-on vs cards-off, NO actor:', JSON.stringify(iso));

const vis = await page.evaluate(([id, cx, camPx, camPy, k, bPy, fPy]) =>
  window.__vis(id, cx, camPx, camPy, k, bPy, fPy, 16, 24),
  [LAYER, cx, Math.round((xMin + xMax) / 2), Math.round((yMin + yMax) / 2), k, behindPy, frontPy]);
console.log('vis', { core: vis.core, bodyF: vis.bodyF, both: vis.both, shown: vis.shown,
                     frac: +(vis.shown / Math.max(1, vis.both)).toFixed(3) });
const { writeFile } = await import('node:fs/promises');
await writeFile(path.join(OUT, `${SET}-${LAYER}-masks.png`),
  Buffer.from(vis.url.split(',')[1], 'base64'));

await browser.close();
server.close();
console.log('-> ', OUT);
