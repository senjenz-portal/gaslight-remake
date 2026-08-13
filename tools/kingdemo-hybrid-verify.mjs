#!/usr/bin/env node
/** kingdemo-hybrid-verify.mjs — verify the king-demo three-way mesh switch (tripo/hybrid/yvo).
 *  usage: node kingdemo-hybrid-verify.mjs <baseUrl> [--shots <prefix>]
 *  e.g.   node kingdemo-hybrid-verify.mjs http://localhost:8931/king-demo/
 *         node kingdemo-hybrid-verify.mjs https://senjenz-portal.github.io/gaslight-remake/king-demo/ --shots /Users/samz/Documents/gaslight-remake/shots/king-demo-hybrid
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2];
if (!base) { console.error('usage: kingdemo-hybrid-verify.mjs <baseUrl> [--shots <prefix>]'); process.exit(2); }
const shotIdx = process.argv.indexOf('--shots');
const shotPrefix = shotIdx > -1 ? process.argv[shotIdx + 1] : null;

const HYBRID_CAPTION = 'Tripo head on the animated game body — the grafting experiment';
const report = { base, checks: [], failures: [], screenshots: [] };
const ok   = (m) => { report.checks.push(m); console.error('ok:   ' + m); };
const fail = (m) => { report.failures.push(m); console.error('FAIL: ' + m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

const consoleErrs = [], badResp = [], responses = [];
p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
p.on('pageerror', e => consoleErrs.push('PAGEERR ' + String(e.message).slice(0, 300)));
p.on('response', r => {
  responses.push({ url: r.url(), status: r.status() });
  if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url());
});

const resp = await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
if (resp.status() === 200) ok('page HTTP 200'); else fail('page HTTP ' + resp.status());

/* default mesh (tripo) loads */
await p.waitForFunction('window.__meshLoaded === true', null, { timeout: 120000 });
ok('default tripo mesh loaded (__meshLoaded)');

/* three-way switch present with the right labels */
const sw = await p.evaluate(() => Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
  .map(o => ({ key: o.dataset.key, label: o.textContent.trim(), active: o.classList.contains('active') })));
if (sw.length === 3 && sw[0].key === 'tripo' && sw[1].key === 'hybrid' && sw[2].key === 'yvo')
  ok('three-way switch present: ' + sw.map(o => o.label).join(' | '));
else fail('switch options wrong: ' + JSON.stringify(sw));
if (sw[0] && sw[0].active) ok('tripo is the default/active option'); else fail('tripo not active by default');

/* lazy-load: neither alternate GLB requested before first selection */
const early = responses.filter(r => /king2-hybrid\.glb|\/king2\.glb/.test(r.url));
if (early.length === 0) ok('hybrid + yvo GLBs are lazy (not requested before selection)');
else fail('GLBs requested before selection: ' + early.map(r => r.url).join(', '));

/* select hybrid */
await p.click('#mesh-switch .mesh-opt[data-key="hybrid"]');
await p.waitForFunction('window.__viewer && window.__viewer.showing === "hybrid"', null, { timeout: 120000 });
ok('hybrid selected and shown');
const hybResp = responses.find(r => r.url.includes('king2-hybrid.glb'));
if (hybResp && hybResp.status === 200) ok('king2-hybrid.glb fetched HTTP 200');
else fail('king2-hybrid.glb response: ' + JSON.stringify(hybResp));
const capHyb = await p.evaluate(() => document.getElementById('viewer-caption').textContent.trim());
if (capHyb === HYBRID_CAPTION) ok('hybrid caption exact: "' + capHyb + '"');
else fail('hybrid caption wrong: "' + capHyb + '"');

/* select previous (yvo3d) */
await p.click('#mesh-switch .mesh-opt[data-key="yvo"]');
await p.waitForFunction('window.__viewer && window.__viewer.showing === "yvo"', null, { timeout: 180000 });
const yvoResp = responses.find(r => /\/king2\.glb/.test(r.url));
if (yvoResp && yvoResp.status === 200) ok('previous (yvo3d) selected, king2.glb fetched HTTP 200');
else fail('king2.glb response: ' + JSON.stringify(yvoResp));

/* back to tripo (cached — no second fetch) */
const tripoFetchesBefore = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
await p.click('#mesh-switch .mesh-opt[data-key="tripo"]');
await p.waitForFunction('window.__viewer && window.__viewer.showing === "tripo"', null, { timeout: 60000 });
const tripoFetchesAfter = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
if (tripoFetchesAfter === tripoFetchesBefore) ok('back to tripo from cache (no refetch)');
else fail('tripo was refetched on return');

/* the comparison thumb */
const thumb = await p.evaluate(() => {
  const img = document.querySelector('img[src="king2-hybrid.face.png"]');
  if (!img) return null;
  const cap = img.closest('figure').querySelector('figcaption');
  return { complete: img.complete, w: img.naturalWidth, caption: cap ? cap.textContent.trim() : null };
});
if (thumb && thumb.complete && thumb.w > 0 && thumb.caption === 'the graft, close')
  ok('comparison thumb loaded with caption "the graft, close"');
else fail('comparison thumb: ' + JSON.stringify(thumb));

/* all images on the page loaded */
const imgs = await p.evaluate(() => Array.from(document.querySelectorAll('.wrap img'))
  .map(i => ({ src: i.getAttribute('src'), okk: i.complete && i.naturalWidth > 0 })));
const badImgs = imgs.filter(i => !i.okk);
if (badImgs.length === 0) ok('all ' + imgs.length + ' page images loaded');
else fail('images failed: ' + badImgs.map(i => i.src).join(', '));

/* page screenshot (hybrid selected, framed on the viewer) */
if (shotPrefix) {
  await p.click('#mesh-switch .mesh-opt[data-key="hybrid"]');
  await p.waitForFunction('window.__viewer && window.__viewer.showing === "hybrid"', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await p.locator('#viewer-fig').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  const shot1 = shotPrefix + '-live.png';
  await p.screenshot({ path: shot1, fullPage: false });
  report.screenshots.push(shot1);
  ok('page screenshot -> ' + shot1);

  /* face close-up of the HYBRID via the __viewer hook */
  await p.evaluate(() => {
    const v = window.__viewer;
    v.controls.autoRotate = false;
    v.controls.minDistance = 0.3;
    v.controls.target.set(0, 1.68, 0);       /* face height on the 1.9 m normalised figure */
    v.camera.position.set(0.28, 1.72, 0.78); /* slight three-quarter, just off axis */
    v.controls.update();
  });
  await p.waitForTimeout(600);               /* let damping settle + a few frames render */
  const shot2 = shotPrefix + '-face.png';
  await p.locator('#viewer').screenshot({ path: shot2 });
  report.screenshots.push(shot2);
  ok('hybrid face close-up -> ' + shot2);
}

/* error tallies last, so everything above is captured */
if (consoleErrs.length === 0) ok('zero console errors'); else fail('console errors: ' + consoleErrs.join(' | '));
if (badResp.length === 0) ok('zero HTTP>=400 responses'); else fail('bad responses: ' + badResp.join(', '));

await b.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.failures.length ? 1 : 0);
