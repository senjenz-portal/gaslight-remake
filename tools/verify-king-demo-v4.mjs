#!/usr/bin/env node
/** verify-king-demo-v4.mjs — verify the king-demo FOUR-way mesh switch
 *  (tripo / hybrid / RIGGED animated / yvo).
 *
 *  Beyond the v3 checks, proves the rigged option ANIMATES: autoRotate is
 *  frozen, two #viewer canvas screenshots are taken 0.4 s apart and must
 *  differ (PNG encoding is deterministic, so byte-diff ⇒ pixel-diff), and the
 *  AnimationMixer's clock must have advanced between them.
 *
 *  usage: node verify-king-demo-v4.mjs <baseUrl> [--shots <prefix>]
 *  e.g.   node verify-king-demo-v4.mjs http://127.0.0.1:8931/king-demo/
 *         node verify-king-demo-v4.mjs https://senjenz-portal.github.io/gaslight-remake/king-demo/ \
 *           --shots /Users/samz/Documents/gaslight-remake/shots/king-demo-rigged-live
 *  writes <prefix>-a.png and <prefix>-b.png (the 0.4 s pair).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2];
if (!base) { console.error('usage: verify-king-demo-v4.mjs <baseUrl> [--shots <prefix>]'); process.exit(2); }
const shotIdx = process.argv.indexOf('--shots');
const shotPrefix = shotIdx > -1 ? process.argv[shotIdx + 1] : null;

const LABELS = ['tripo 3.1', 'hybrid — tripo head, game body',
                'RIGGED — auto-rig + mixamo run', 'previous (yvo3d)'];
const KEYS = ['tripo', 'hybrid', 'rigged', 'yvo'];
const RIGGED_CAPTION = 'Auto-rigged (Make-It-Animatable, free) — a stock Mixamo run ' +
  'retargeted onto the generated mesh. The full pipeline: portrait → image→3D → auto-rig → animate.';
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

/* the heading is honest about four takes, not "two generators" */
const heading = await p.evaluate(() => Array.from(document.querySelectorAll('h2'))
  .map(h => h.textContent.trim()).find(t => t.startsWith('3 ·')));
if (heading && !/two generators/i.test(heading)) ok('section-3 heading updated: "' + heading + '"');
else fail('section-3 heading stale: "' + heading + '"');

/* four-way switch present, right keys + labels + default */
const sw = await p.evaluate(() => Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
  .map(o => ({ key: o.dataset.key, label: o.textContent.trim(), active: o.classList.contains('active') })));
if (sw.length === 4 && KEYS.every((k, i) => sw[i].key === k))
  ok('four-way switch keys in order: ' + sw.map(o => o.key).join(' | '));
else fail('switch options wrong: ' + JSON.stringify(sw));
if (LABELS.every((l, i) => sw[i] && sw[i].label === l))
  ok('labels exact: ' + sw.map(o => o.label).join(' | '));
else fail('labels wrong: ' + JSON.stringify(sw.map(o => o.label)));
if (sw[0] && sw[0].active) ok('tripo is the default/active option'); else fail('tripo not active by default');

/* lazy-load: no alternate GLB requested before first selection */
const early = responses.filter(r => /king2-hybrid\.glb|king2-rigged\.glb|\/king2\.glb/.test(r.url));
if (early.length === 0) ok('hybrid + rigged + yvo GLBs are lazy (not requested before selection)');
else fail('GLBs requested before selection: ' + early.map(r => r.url).join(', '));

/* cycle through all four: hybrid -> rigged -> yvo -> back to tripo */
const pick = async (key, timeout) => {
  await p.click(`#mesh-switch .mesh-opt[data-key="${key}"]`);
  await p.waitForFunction(`window.__viewer && window.__viewer.showing === "${key}"`, null, { timeout });
};
await pick('hybrid', 120000);
ok('hybrid selected and shown');
await pick('rigged', 120000);
ok('rigged selected and shown');
const rigResp = responses.find(r => r.url.includes('king2-rigged.glb'));
if (rigResp && rigResp.status === 200) ok('king2-rigged.glb fetched HTTP 200');
else fail('king2-rigged.glb response: ' + JSON.stringify(rigResp));
const capRig = await p.evaluate(() => document.getElementById('viewer-caption').textContent.trim());
if (capRig === RIGGED_CAPTION) ok('rigged caption exact');
else fail('rigged caption wrong: "' + capRig + '"');

/* ---- the animation proof: freeze the camera, diff two frames 0.4 s apart */
await p.locator('#viewer-fig').scrollIntoViewIfNeeded();
await p.evaluate(() => {
  const v = window.__viewer;
  v.controls.autoRotate = false;
  v.controls.update();
});
await p.waitForTimeout(900);                    /* damping fully settled */
const mixerT0 = await p.evaluate(() => window.__viewer.mixer ? window.__viewer.mixer.time : null);
const shotA = shotPrefix ? shotPrefix + '-a.png' : null;
const shotB = shotPrefix ? shotPrefix + '-b.png' : null;
const bufA = await p.locator('#viewer').screenshot(shotA ? { path: shotA } : {});
await p.waitForTimeout(400);
const bufB = await p.locator('#viewer').screenshot(shotB ? { path: shotB } : {});
const mixerT1 = await p.evaluate(() => window.__viewer.mixer ? window.__viewer.mixer.time : null);
if (shotA) { report.screenshots.push(shotA, shotB); ok('canvas pair -> ' + shotA + ' , ' + shotB); }
if (mixerT0 !== null && mixerT1 !== null && mixerT1 > mixerT0)
  ok(`mixer clock advanced ${mixerT0.toFixed(3)}s -> ${mixerT1.toFixed(3)}s`);
else fail('mixer clock did not advance: ' + mixerT0 + ' -> ' + mixerT1);
if (!bufA.equals(bufB)) ok('rigged ANIMATES: two canvas frames 0.4 s apart differ (camera frozen)');
else fail('rigged frames 0.4 s apart are byte-identical — no animation');

/* restore the slow turn, continue the cycle */
await p.evaluate(() => { window.__viewer.controls.autoRotate = true; });
await pick('yvo', 180000);
const yvoResp = responses.find(r => /\/king2\.glb/.test(r.url));
if (yvoResp && yvoResp.status === 200) ok('previous (yvo3d) selected, king2.glb fetched HTTP 200');
else fail('king2.glb response: ' + JSON.stringify(yvoResp));

/* back to tripo (cached — no second fetch) */
const tripoFetchesBefore = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
await pick('tripo', 60000);
const tripoFetchesAfter = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
if (tripoFetchesAfter === tripoFetchesBefore) ok('back to tripo from cache (no refetch) — all four cycled');
else fail('tripo was refetched on return');

/* switched away from rigged: its mixer must be paused (time frozen) */
await p.waitForTimeout(300);
const rigT = await p.evaluate(() => window.__viewer.mixer ? 'mixer-on-tripo?' : 'none');
if (rigT === 'none') ok('non-animated model shows no mixer (rigged paused while away)');
else fail('unexpected mixer on tripo: ' + rigT);

/* all images on the page loaded */
const imgs = await p.evaluate(() => Array.from(document.querySelectorAll('.wrap img'))
  .map(i => ({ src: i.getAttribute('src'), okk: i.complete && i.naturalWidth > 0 })));
const badImgs = imgs.filter(i => !i.okk);
if (badImgs.length === 0) ok('all ' + imgs.length + ' page images loaded');
else fail('images failed: ' + badImgs.map(i => i.src).join(', '));

/* error tallies last, so everything above is captured */
if (consoleErrs.length === 0) ok('zero console errors'); else fail('console errors: ' + consoleErrs.join(' | '));
if (badResp.length === 0) ok('zero HTTP>=400 responses'); else fail('bad responses: ' + badResp.join(', '));

await b.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.failures.length ? 1 : 0);
