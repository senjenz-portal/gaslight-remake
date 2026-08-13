// SHIP lane verification for the two 2D-first exploration pages.
// usage: node tools/ship-verify.mjs <baseUrl> <shotsDir> [suffix]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8791';
const shotsDir = process.argv[3] || '/Users/samz/Documents/gaslight-remake/shots';
const suffix = process.argv[4] || 'local';
fs.mkdirSync(shotsDir, { recursive: true });

const out = { base, pages: {} };

function collect(page, bucket) {
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      bucket.console.push(`[${m.type()}] ${m.text()}`);
    }
  });
  page.on('pageerror', e => bucket.pageerrors.push(String(e && e.message || e)));
  page.on('requestfailed', r => bucket.netfail.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', r => {
    if (r.status() >= 400) bucket.http4xx.push(`${r.status()} ${r.url()}`);
  });
}

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--enable-unsafe-swiftshader']
});

/* ------------------------------------------------------------------ *
 * 1 · living plate                                                     *
 * ------------------------------------------------------------------ */
{
  const bucket = { console: [], pageerrors: [], netfail: [], http4xx: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  collect(page, bucket);
  const url = `${base}/king-demo/living-plate/`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  // videos: playing + looping + advancing
  const vidT0 = await page.$$eval('video', vs => vs.map(v => ({ id: v.id, t: v.currentTime, paused: v.paused, loop: v.loop, rs: v.readyState, dur: v.duration, w: v.videoWidth, h: v.videoHeight })));
  await page.waitForTimeout(2500);
  const vidT1 = await page.$$eval('video', vs => vs.map(v => ({ id: v.id, t: v.currentTime, paused: v.paused })));

  // loop check: seek near the end and confirm it wraps rather than stalling
  await page.evaluate(() => { const v = document.getElementById('vidA'); if (v && v.duration) v.currentTime = Math.max(0, v.duration - 0.35); });
  await page.waitForTimeout(1600);
  const afterWrap = await page.evaluate(() => { const v = document.getElementById('vidA'); return { t: v.currentTime, paused: v.paused, ended: v.ended }; });

  // svg/parallax layers: transform must change between frames
  const tr0 = await page.$$eval('#plate-layers .lyr', els => els.map(e => e.id + ':' + getComputedStyle(e).transform));
  await page.waitForTimeout(900);
  const tr1 = await page.$$eval('#plate-layers .lyr', els => els.map(e => e.id + ':' + getComputedStyle(e).transform));
  const movedLayers = tr0.filter((v, i) => v !== tr1[i]).map(s => s.split(':')[0]);

  // images all decoded
  const imgs = await page.$$eval('img', is => is.map(i => ({ src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight })).filter(i => i.src));
  const brokenImgs = imgs.filter(i => i.nw === 0);

  // css animations actually running (fog/halo/motes)
  const anims = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  const motes = await page.$$eval('.mote', e => e.length);

  // pixel motion inside the layered stage (real visual change, not just style strings)
  const stage = await page.$('#stage-layers');
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const a = await stage.screenshot();
  await page.waitForTimeout(1400);
  const b = await stage.screenshot();
  const layerPixelDelta = a.length !== b.length || !a.equals(b);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shotsDir, `living-plate-${suffix}.png`), fullPage: false });

  out.pages['living-plate'] = {
    url, vidT0, vidT1, afterWrap, movedLayers, layerPixelDelta, anims, motes,
    brokenImgs, imgCount: imgs.length, ...bucket
  };
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 2 · hd2d                                                             *
 * ------------------------------------------------------------------ */
{
  const bucket = { console: [], pageerrors: [], netfail: [], http4xx: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  collect(page, bucket);
  const url = `${base}/king-demo/hd2d/`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);

  const probe = await page.evaluate(() => {
    const p = window.__hd2d || null;
    const c = document.getElementById('view');
    const gl = c && (c.getContext('webgl2', { preserveDrawingBuffer: true }) || c.getContext('webgl'));
    return {
      probeKeys: p ? Object.keys(p) : null,
      canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
      hasGL: !!gl
    };
  });

  // sprite walks: sample the King's world position over time via the probe if exposed
  const walk = await page.evaluate(async () => {
    const p = window.__hd2d;
    if (!p) return null;
    const snap = () => {
      const k = p.king || p.getKing?.();
      const f = (p.frame ?? p.getFrame?.());
      return { x: k?.position?.x ?? null, z: k?.position?.z ?? null, frame: f ?? null };
    };
    const s0 = snap();
    await new Promise(r => setTimeout(r, 2500));
    const s1 = snap();
    return { s0, s1 };
  });

  // pixel-level: whole canvas must change between frames (sprite motion + grain)
  const c0 = await page.locator('#view').screenshot();
  await page.waitForTimeout(1600);
  const c1 = await page.locator('#view').screenshot();
  const canvasPixelDelta = c0.length !== c1.length || !c0.equals(c1);

  // post chain present?
  const post = await page.evaluate(() => {
    const p = window.__hd2d;
    if (!p) return null;
    const comp = p.composer || p.getComposer?.();
    return comp ? { passes: comp.passes.map(x => x.constructor.name), enabled: comp.passes.map(x => x.enabled) } : null;
  });

  // click the King -> cameo should appear
  let cameo = null;
  try {
    const box = await page.locator('#view').boundingBox();
    const p = window;
    const target = await page.evaluate(() => {
      const h = window.__hd2d;
      if (!h || !h.king || !h.camera) return null;
      const v = h.king.position.clone();
      v.y += (h.kingHeight ?? 1.0) * 0.5;
      v.project(h.camera);
      return { x: (v.x * 0.5 + 0.5), y: (-v.y * 0.5 + 0.5) };
    });
    if (target && box) {
      await page.mouse.click(box.x + target.x * box.width, box.y + target.y * box.height);
      await page.waitForTimeout(2600);
      cameo = await page.evaluate(() => {
        const h = window.__hd2d;
        return h ? { cameoVisible: !!(h.cameo?.visible ?? h.cardVisible), state: h.state ?? null, focus: h.bokeh?.uniforms?.focus?.value ?? null } : null;
      });
    } else {
      // fall back to clicking centre-ish where the King patrols
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
      await page.waitForTimeout(2600);
      cameo = { fallbackClick: true };
    }
  } catch (e) { cameo = { error: String(e.message) }; }

  const c2 = await page.locator('#view').screenshot();

  // fps
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
    requestAnimationFrame(tick);
  }));

  await page.screenshot({ path: path.join(shotsDir, `hd2d-${suffix}.png`) });

  out.pages['hd2d'] = { url, probe, walk, post, canvasPixelDelta, cameo, cameoPixelDelta: !c2.equals(c1), fps, ...bucket };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
