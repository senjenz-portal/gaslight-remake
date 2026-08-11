#!/usr/bin/env node
/** live-verify.mjs — verify the live GitHub Pages deployment. One-off, not part of the gate. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://senjenz-portal.github.io/gaslight-remake/';
const SHOTS = '/Users/samz/Documents/gaslight-remake/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const report = { landing: {}, app: {}, harness: {}, failures: [] };
const fail = (m) => { report.failures.push(m); console.error('FAIL: ' + m); };

const b = await chromium.launch();
const ONLY3 = process.argv.includes('--part3');

/* ---------------- 1. Landing page ---------------- */
if (!ONLY3) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const badResp = [];
  p.on('response', r => { if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url()); });
  const resp = await p.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  report.landing.status = resp.status();
  if (resp.status() !== 200) fail('landing HTTP ' + resp.status());
  // preview images
  const imgs = await p.evaluate(() => Array.from(document.querySelectorAll('figure img'))
    .map(i => ({ src: i.getAttribute('src'), complete: i.complete, w: i.naturalWidth })));
  report.landing.previews = imgs;
  if (imgs.length !== 3) fail('landing expected 3 preview images, saw ' + imgs.length);
  for (const i of imgs) if (!(i.complete && i.w > 0)) fail('preview image did not load: ' + i.src);
  // Read Beat I link
  const link = await p.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find(x => /Read Beat I/i.test(x.textContent));
    return a ? a.href : null;
  });
  report.landing.readBeatILink = link;
  if (!link) fail('no "Read Beat I" link found');
  else {
    const r = await p.request.get(link);
    report.landing.readBeatIStatus = r.status();
    if (r.status() !== 200) fail('"Read Beat I" link ' + link + ' -> HTTP ' + r.status());
  }
  if (badResp.length) fail('landing bad responses: ' + badResp.join(', '));
  report.landing.badResponses = badResp;
  await ctx.close();
}

/* ---------------- 2. App as a real visitor (no harness) ---------------- */
if (!ONLY3) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const consoleErrs = [], failedReqs = [], badResp = [];
  p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => consoleErrs.push('PAGEERR ' + String(e.message).slice(0, 300)));
  p.on('requestfailed', r => failedReqs.push({ url: r.url(), err: r.failure() && r.failure().errorText }));
  p.on('response', r => { if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url()); });

  const t0 = Date.now();
  await p.goto(BASE + 'app/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction('window.__ready === true', null, { timeout: 300000 });
  report.app.msToReady = Date.now() - t0;

  const assets = await p.evaluate(() => window.__assets());
  const st = await p.evaluate(() => window.__state());
  report.app.glbResident = Object.keys(assets.glb);
  report.app.assetsMissing = assets.missing;
  report.app.stateReady = st.ready;
  report.app.audio = { files: st.audio.files, decoded: st.audio.decoded, missing: st.audio.missing };
  if (assets.missing.length) fail('app __assets().missing: ' + assets.missing.join(', '));
  if (Object.keys(assets.glb).length !== 8) fail('app expected 8 GLBs resident, saw ' + Object.keys(assets.glb).length + ': ' + Object.keys(assets.glb).join(','));
  if (st.ready !== true) fail('app __state().ready !== true');

  // failed requests: exclude ERR_ABORTED whose URL later succeeded (transport noise)
  const trulyFailed = failedReqs.filter(f => !(f.err === 'net::ERR_ABORTED'));
  const aborted = failedReqs.filter(f => f.err === 'net::ERR_ABORTED');
  const abortedUnrecovered = [];
  for (const a of aborted) {
    const ok = await p.evaluate(async (u) => { try { const r = await fetch(u, { method: 'GET' }); return r.ok; } catch { return false; } }, a.url);
    if (!ok) abortedUnrecovered.push(a.url);
  }
  report.app.consoleErrors = consoleErrs;
  report.app.failedRequests = trulyFailed;
  report.app.abortedUnrecovered = abortedUnrecovered;
  report.app.abortedRecoveredCount = aborted.length - abortedUnrecovered.length;
  report.app.badResponses = badResp;
  if (consoleErrs.length) fail('app console errors: ' + consoleErrs.join(' | '));
  if (trulyFailed.length) fail('app failed requests: ' + trulyFailed.map(f => f.err + ' ' + f.url).join(', '));
  if (abortedUnrecovered.length) fail('app aborted requests that never succeeded: ' + abortedUnrecovered.join(', '));
  if (badResp.length) fail('app HTTP>=400: ' + badResp.join(', '));

  // 3 s of live running, then screenshot
  await p.waitForTimeout(3000);
  const shot1 = SHOTS + '/live-deploy-title.png';
  await p.screenshot({ path: shot1 });
  report.app.screenshot = shot1;
  await ctx.close();
}

/* ---------------- 3. Interaction smoke with ?harness=1 ---------------- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const consoleErrs = [], badResp = [];
  p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => consoleErrs.push('PAGEERR ' + String(e.message).slice(0, 300)));
  p.on('response', r => { if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url()); });

  const t0 = Date.now();
  await p.goto(BASE + 'app/index.html?harness=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction('window.__ready === true', null, { timeout: 300000 });
  report.harness.msToReady = Date.now() - t0;

  await p.evaluate(() => { window.__mute(true); window.__advance(0.5); });
  // advance a few units: 0(head) -> 1 -> 2 -> 3 -> 4 -> 5 (i-05-hold)
  const path = [];
  for (let k = 0; k < 5; k++) {
    const u = await p.evaluate(() => { const v = window.__click(); window.__advance(0.6); return v.id; });
    path.push(u);
  }
  report.harness.clickPath = path;
  let st = await p.evaluate(() => window.__state());
  if (st.unit.id !== 'i-05-hold') fail('expected to land on i-05-hold after 5 clicks, got ' + st.unit.id);

  // the hold: press, drive 2.2 s of sim time, release
  const holdK = await p.evaluate(() => { window.__holdStart(); window.__advance(2.2); return window.__state().hold; });
  await p.evaluate(() => window.__holdEnd());
  st = await p.evaluate(() => window.__state());
  report.harness.hold = { kAtRelease: holdK.k, resolved: st.hold.resolved };
  if (!st.hold.resolved) fail('hold did not resolve (k=' + holdK.k + ')');

  // advance to the watermark unit and let its plate rise
  const wm = await p.evaluate(() => { const v = window.__click(); window.__advance(1.7); window.__renderNow(); return { id: v.id, st: window.__state() }; });
  report.harness.watermarkUnit = wm.id;
  if (wm.id !== 'i-06-wmark') fail('expected i-06-wmark after the hold, got ' + wm.id);
  const shot2 = SHOTS + '/live-deploy-wmark.png';
  await p.screenshot({ path: shot2 });
  report.harness.screenshot = shot2;

  // audio decode tally — decodeAudioData is async (beds also get seam-rebuilt),
  // so poll until the count settles instead of sampling the instant after the click
  await p.waitForFunction(() => {
    const a = window.__state().audio;
    return a.decoded === a.files;
  }, null, { timeout: 20000 }).catch(() => {});
  const audio = await p.evaluate(() => window.__state().audio);
  report.harness.audio = { files: audio.files, decoded: audio.decoded, missing: audio.missing };
  if (!(audio.decoded === 11 && audio.files === 11 && audio.missing.length === 0)) {
    fail('audio expected 11/11 decoded, got decoded=' + audio.decoded + ' files=' + audio.files + ' missing=[' + audio.missing.join(',') + ']');
  }
  report.harness.consoleErrors = consoleErrs;
  report.harness.badResponses = badResp;
  if (consoleErrs.length) fail('harness console errors: ' + consoleErrs.join(' | '));
  if (badResp.length) fail('harness HTTP>=400: ' + badResp.join(', '));
  await ctx.close();
}

await b.close();
console.log(JSON.stringify(report, null, 2));
