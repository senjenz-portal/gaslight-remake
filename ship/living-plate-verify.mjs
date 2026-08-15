#!/usr/bin/env node
/**
 * living-plate-verify.mjs — behavioural pass over the INTERACTIVE layered
 * stage on king-demo/living-plate/, against any origin (local or live).
 *
 * A screenshot cannot tell a live page from a frozen one and a class name
 * cannot tell you a light actually changed, so every claim below is either a
 * number read out of the page's own state or a MEASURED pixel delta between
 * two grabs of the same rectangle. Noise is established first (two grabs with
 * nothing touched) and each verb has to beat it by a margin.
 *
 *     node tools/ship/living-plate-verify.mjs <baseUrl> <outDir> [label]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from '../png.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const OUT = process.argv[3] || '/Users/samz/Documents/gaslight-remake/shots';
const LABEL = process.argv[4] || 'local';
const WORK = path.join(OUT, 'work-lp-' + LABEL);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const checks = [];
const failures = [];
const ok = (name, pass, detail) => {
  const line = `${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`;
  checks.push(line);
  if (!pass) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(line);
};

const URL_PAGE = `${BASE}/king-demo/living-plate/`;
const TIMEOUT = 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* mean |RGB delta| between two equally sized PNG buffers */
function meanDelta(bufA, bufB) {
  const a = decodePng(bufA), b = decodePng(bufB);
  if (a.width !== b.width || a.height !== b.height) return NaN;
  const ca = a.channels, cb = b.channels;
  let sum = 0, n = 0;
  for (let y = 0; y < a.height; y += 2) {
    for (let x = 0; x < a.width; x += 2) {
      const ia = (y * a.width + x) * ca, ib = (y * b.width + x) * cb;
      sum += Math.abs(a.data[ia] - b.data[ib]) +
             Math.abs(a.data[ia + 1] - b.data[ib + 1]) +
             Math.abs(a.data[ia + 2] - b.data[ib + 2]);
      n += 3;
    }
  }
  return n ? sum / n : NaN;
}

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required',
         '--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});

function watch(page, bag) {
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') bag.push('console: ' + m.text()); });
  page.on('requestfailed', (r) =>
    bag.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) bag.push(`http ${r.status()}: ${r.url()}`); });
}

const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
watch(page, errs);
page.setDefaultTimeout(TIMEOUT);

const resp = await page.goto(URL_PAGE, { waitUntil: 'load', timeout: 90000 });
ok('page · HTTP 200', resp.status() === 200, 'status ' + resp.status());
await page.waitForFunction(() => !!window.__lp, null, { timeout: 20000 }).catch(() => {});
ok('page · harness surface present', await page.evaluate(() => !!window.__lp));

/* every asset the interactions need really shipped alongside the page */
for (const f of ['click-soft.mp3', 'paper-rustle.mp3', 'reveal.mp3', 'book.mp3', 'room-bed.mp3']) {
  const r = await page.request.get(URL_PAGE + f);
  ok(`audio · ${f} served`, r.status() === 200, 'HTTP ' + r.status());
}

await page.$eval('#stage-layers', (el) => el.scrollIntoView({ block: 'center' }));
await sleep(1200);
const box = await (await page.$('#stage-layers')).boundingBox();
const clipOf = (px, py, pw, ph) => ({
  x: Math.round(box.x + box.width * (px / 1408)),
  y: Math.round(box.y + box.height * (py / 768)),
  width: Math.round(box.width * (pw / 1408)),
  height: Math.round(box.height * (ph / 768)),
});
const REGION = {
  lamp:   clipOf(860, 30, 300, 330),
  hearth: clipOf(390, 320, 260, 240),
  window: clipOf(770, 80, 220, 360),
};
const grab = (clip) => page.screenshot({ clip });

/* ================================================== 1 · POINTER PARALLAX */
{
  await page.evaluate(() => window.__lp.freezeDrift(true));   // isolate the bias
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await sleep(2200);

  const read = () => page.evaluate(() => ({
    bias: window.__lp.bias(),
    ptr: window.__lp.ptr(),
    tf: {
      room: getComputedStyle(document.getElementById('room')).transform,
      rock: getComputedStyle(document.getElementById('rock')).transform,
      lamp: getComputedStyle(document.getElementById('lamp')).transform,
    },
  }));
  const tx = (m) => { const p = /matrix\(([^)]+)\)/.exec(m); return p ? parseFloat(p[1].split(',')[4]) : NaN; };

  await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.5, { steps: 6 });
  await sleep(2400);
  const L = await read();
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.5, { steps: 6 });
  await sleep(2400);
  const R = await read();

  ok('parallax · bias reverses with the pointer',
     Math.sign(L.bias.x) === 1 && Math.sign(R.bias.x) === -1 &&
     Math.abs(L.bias.x) > 15 && Math.abs(R.bias.x) > 15,
     `left ${L.bias.x.toFixed(2)}px, right ${R.bias.x.toFixed(2)}px`);

  const dRoom = Math.abs(tx(L.tf.room) - tx(R.tf.room));
  const dRock = Math.abs(tx(L.tf.rock) - tx(R.tf.rock));
  const dLamp = Math.abs(tx(L.tf.lamp) - tx(R.tf.lamp));
  ok('parallax · layer transforms move with the pointer',
     dRoom > 1 && dRock > 1 && dLamp > 1,
     `Δx room ${dRoom.toFixed(2)}px · rock ${dRock.toFixed(2)}px · lamp ${dLamp.toFixed(2)}px`);
  ok('parallax · each layer answers at its own depth',
     dLamp > dRock && dRock > dRoom,
     `0.34 → ${dRoom.toFixed(2)} · 0.60 → ${dRock.toFixed(2)} · 1.00 → ${dLamp.toFixed(2)}`);

  /* the ~2 s ease: sampled from a settled state to the opposite edge */
  await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.5, { steps: 6 });
  const t0 = Date.now();
  const ramp = [];
  for (let i = 0; i < 26; i++) {
    ramp.push({ t: (Date.now() - t0) / 1000, x: (await page.evaluate(() => window.__lp.bias().x)) });
    await sleep(100);
  }
  /* the ramp starts from the OPPOSITE settled edge, so progress is the
     fraction of the span it has crossed, not the fraction of the target */
  const target = L.bias.x, from = ramp[0].x;
  const at = (s) => {
    const r = ramp.reduce((best, q) => Math.abs(q.t - s) < Math.abs(best.t - s) ? q : best);
    return (r.x - from) / (target - from);
  };
  const monotone = ramp.every((r, i) => i === 0 || r.x >= ramp[i - 1].x - 0.35);
  ok('parallax · eases rather than snaps (τ≈0.66 s, settles ≈2 s)',
     monotone && at(0.1) < 0.35 && at(0.7) > 0.5 && at(0.7) < 0.85 && at(2.0) > 0.9,
     `${(at(0.1) * 100).toFixed(0)}% at 0.1s · ${(at(0.7) * 100).toFixed(0)}% at 0.7s · ` +
     `${(at(2.0) * 100).toFixed(0)}% at 2.0s (exp: 14 / 65 / 95)`);

  /* idle drift resumes when the pointer leaves the stage */
  await page.mouse.move(box.x + box.width * 0.5, box.y - 140, { steps: 4 });
  await sleep(2600);
  const away = await page.evaluate(() => ({ bias: window.__lp.bias(), over: window.__lp.ptr().over }));
  ok('parallax · bias decays to zero when the pointer leaves',
     !away.over && Math.abs(away.bias.x) < 1.2 && Math.abs(away.bias.y) < 1.2,
     `over=${away.over} bias ${away.bias.x.toFixed(2)}, ${away.bias.y.toFixed(2)}px`);

  await page.evaluate(() => window.__lp.freezeDrift(false));
  await sleep(400);
  const d1 = await page.evaluate(() => getComputedStyle(document.getElementById('lamp')).transform);
  await sleep(1500);
  const d2 = await page.evaluate(() => getComputedStyle(document.getElementById('lamp')).transform);
  ok('parallax · the idle drift is still running underneath', d1 !== d2, `${d1} → ${d2}`);
}

/* Hold the idle drift still so the verb is the only thing moving in the
   rectangle being measured — and, crucially, PARK THE POINTER on the target
   before grabbing the reference. The pointer bias is real parallax: measuring
   a verb across a pointer move would be measuring the camera, not the light. */
await page.mouse.move(box.x + box.width * 0.5, box.y - 160);
await sleep(2400);
await page.evaluate(() => window.__lp.freezeDrift(true));
await sleep(600);

const idleShot = path.join(OUT, 'living-plate-interactive-idle.png');
await page.screenshot({ path: idleShot, clip: box });

/** hover a target and let the pointer bias settle, then measure how much the
    region moves on its own over `gap` ms with nothing touched. */
async function settleOn(sel, region, gap) {
  const b = await (await page.$(sel)).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await sleep(2600);
  const a = await grab(region);
  await sleep(gap);
  const c = await grab(region);
  return { box: b, noise: meanDelta(a, c), ref: c };
}

/* ============================================== 2a · CLICK THE LAMP → FLARE */
{
  const s = await settleOn('#tgt-lamp', REGION.lamp, 500);
  await page.mouse.down(); await page.mouse.up();
  await sleep(420);
  const after = await grab(REGION.lamp);
  const d = meanDelta(s.ref, after);
  const st = await page.evaluate(() => ({
    flare: window.__lp.flare(),
    pool: document.getElementById('pool').classList.contains('on'),
    dur: getComputedStyle(document.getElementById('halo')).animationDuration,
    audio: window.__lp.audio(),
  }));
  ok('lamp · flare state on', st.flare && st.pool, `flare=${st.flare} pool=${st.pool}`);
  ok('lamp · flicker quickens', /0\.62s/.test(st.dur) && /2\.5s/.test(st.dur), st.dur);
  ok('lamp · click-soft fired', st.audio.includes('click'), st.audio.join(','));
  ok('lamp · measured visual delta beats the region\'s own noise',
     d > Math.max(1.5, s.noise * 2.5),
     `Δ ${d.toFixed(2)} RGB vs noise ${s.noise.toFixed(2)}`);

  await page.screenshot({ path: path.join(OUT, 'living-plate-interactive-flare.png'), clip: box });

  await sleep(3000);
  const done = await page.evaluate(() => window.__lp.flare());
  ok('lamp · flare releases after 3 s', done === false, 'flare=' + done);
}

/* ============================================ 2b · CLICK THE HEARTH → STOKE */
{
  const s = await settleOn('#tgt-hearth', REGION.hearth, 500);
  await page.mouse.down(); await page.mouse.up();
  await sleep(500);
  const after = await grab(REGION.hearth);
  const d = meanDelta(s.ref, after);
  const st = await page.evaluate(() => ({
    stoked: window.__lp.stoked(),
    dur: getComputedStyle(document.getElementById('fire')).animationDuration,
    name: getComputedStyle(document.getElementById('fire')).animationName,
  }));
  ok('hearth · stoked state on', st.stoked === true && st.name === 'firestoke',
     `${st.name} ${st.dur}`);
  ok('hearth · measured visual delta beats the region\'s own noise',
     d > Math.max(1.5, s.noise * 2.5),
     `Δ ${d.toFixed(2)} RGB vs noise ${s.noise.toFixed(2)}`);
  await sleep(4000);
  ok('hearth · stoke releases after 4 s',
     (await page.evaluate(() => window.__lp.stoked())) === false);
}

/* ================================== 2c · PRESS AND HOLD THE WINDOW → REVEAL */
{
  /* the window emissives breathe on 7.3 / 9.1 / 11.7 s cycles, so the honest
     baseline here is over the SAME span the hold takes, not over 400 ms */
  const s = await settleOn('#tgt-window', REGION.window, 2200);
  const before = s.ref;
  await page.mouse.down();

  const ramp = [];
  for (let i = 0; i < 12; i++) {
    await sleep(200);
    ramp.push(await page.evaluate(() => window.__lp.hold()));
  }
  const early = ramp[1], late = ramp[4];
  ok('hold · progress ramps with the press',
     early.k > 0.05 && early.k < late.k && late.k > early.k + 0.1,
     `k ${ramp.slice(0, 9).map((r) => r.k.toFixed(2)).join(' → ')}`);
  const end = ramp[ramp.length - 1];
  ok('hold · completes and latches the lamplit state',
     end.resolved === true && end.lit > 0.99, `resolved=${end.resolved} lit=${end.lit}`);

  const ringOn = await page.evaluate(() => {
    const h = document.getElementById('lp-hold');
    return { on: h.classList.contains('on'), done: h.classList.contains('done'),
             off: +h.querySelector('.arc').getAttribute('stroke-dashoffset'),
             tf: h.style.transform };
  });
  ok('hold · the progress ring stands at the pointer and is full',
     ringOn.on && ringOn.done && ringOn.off < 1 && /translate\(/.test(ringOn.tf),
     `offset ${ringOn.off} ${ringOn.tf}`);
  ok('hold · reveal cue fired on completion',
     (await page.evaluate(() => window.__lp.audio())).includes('reveal'));

  const held = await grab(REGION.window);
  const d = meanDelta(before, held);
  ok('hold · the window really brightens (measured)',
     d > Math.max(2, s.noise * 2.5), `Δ ${d.toFixed(2)} RGB vs noise ${s.noise.toFixed(2)}`);

  await page.screenshot({ path: path.join(OUT, 'living-plate-interactive-hold.png'), clip: box });

  /* let go: the elastic fall-back must undershoot and settle, not cut */
  await page.mouse.up();
  const fall = [];
  for (let i = 0; i < 24; i++) { fall.push(await page.evaluate(() => window.__lp.hold().shown)); await sleep(60); }
  const min = Math.min(...fall);
  const settled = await page.evaluate(() => window.__lp.hold());
  ok('hold · elastic fall-back on release (undershoots, then settles)',
     min < -0.01 && Math.abs(settled.shown) < 0.02 && settled.resolved === false,
     `min ${min.toFixed(3)} · settled ${settled.shown.toFixed(4)}`);
  const overlays = await page.evaluate(() => ({
    win: getComputedStyle(document.getElementById('winglow')).opacity,
    vig: getComputedStyle(document.getElementById('vign')).opacity,
  }));
  const back = await grab(REGION.window);
  const dBack = meanDelta(before, back);
  ok('hold · the room returns to itself after release',
     +overlays.win < 0.02 && +overlays.vig < 0.02 && dBack < d * 0.5 &&
     dBack < Math.max(3, s.noise * 2.5),
     `winglow ${overlays.win} · vignette ${overlays.vig} · Δ ${dBack.toFixed(2)} vs held Δ ${d.toFixed(2)}`);
}

await page.evaluate(() => window.__lp.freezeDrift(false));

/* ============================================ 3 · THE BOOK GRAMMAR MINI-DEMO */
{
  const DOYLE = [
    '“It came by the last post… Read it aloud.”',
    'The note was undated, and without either signature or address.',
    '“There will call upon you to-night, at a quarter to eight o’clock… ' +
      'a gentleman who desires to consult you upon a matter of the very deepest moment.”',
  ];
  await page.$eval('#s-grammar', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(700);
  const start = await page.evaluate(() => window.__lp.unit());
  ok('grammar · opens on the chapter head', start.id === 'head' && start.blocks === 1,
     `${start.id} · ${start.blocks} block(s)`);

  const seen = [];
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(...await page.$eval('#grammar', (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width * 0.5, r.top + r.height * 0.5];
    }));
    await sleep(700);
    seen.push(await page.evaluate(() => window.__lp.unit()));
  }
  ok('grammar · three real clicks advance three units',
     seen.map((s) => s.id).join(',') === 'post,undated,note1',
     seen.map((s) => `${s.id}/${s.blocks}`).join(' → '));

  const dom = await page.evaluate(() => ({
    blocks: [...document.querySelectorAll('#blocks .blk')].map((b) => ({
      unit: b.dataset.unit, live: b.classList.contains('live'), past: b.classList.contains('past'),
      op: getComputedStyle(b).opacity, text: b.querySelector('p').textContent,
      doc: b.classList.contains('doc'), who: (b.querySelector('.who') || {}).textContent || null,
    })),
    cue: document.getElementById('cue').textContent.trim(),
    cueOn: document.getElementById('cue').classList.contains('on'),
    dot: getComputedStyle(document.getElementById('cue-dot')).animationName,
  }));
  ok('grammar · Doyle verbatim, units 1–3',
     dom.blocks.length === 3 && dom.blocks.every((b, i) => b.text === DOYLE[i]),
     dom.blocks.map((b) => b.unit).join(', '));
  ok('grammar · prior lines recede, newest is live',
     dom.blocks[0].past && dom.blocks[1].past && dom.blocks[2].live &&
     parseFloat(dom.blocks[0].op) < 0.8 && parseFloat(dom.blocks[2].op) > 0.95,
     `opacity ${dom.blocks.map((b) => b.op).join(' / ')}`);
  ok('grammar · a thing READ is not a thing SAID',
     dom.blocks[2].doc === true && dom.blocks[2].who === 'the note' &&
     dom.blocks[0].who === 'Holmes',
     `${dom.blocks[0].who} · ${dom.blocks[2].who} (doc=${dom.blocks[2].doc})`);
  ok('grammar · the breathing dot affordance is live',
     dom.cueOn && dom.dot === 'pipbreathe', `${dom.dot} · "${dom.cue}"`);

  const log = await page.evaluate(() => window.__lp.audio());
  ok('grammar · room-bed under it, paper-rustle on the note-throw, click on each advance',
     log.includes('bed:room') && log.includes('paper') &&
     log.filter((x) => x === 'click').length >= 3, log.join(','));

  /* a fourth click turns back to the head — the slice loops */
  await page.mouse.click(...await page.$eval('#grammar', (el) => {
    const r = el.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.5];
  }));
  await sleep(500);
  const wrapped = await page.evaluate(() => window.__lp.unit());
  ok('grammar · the slice turns back over', wrapped.id === 'head' && wrapped.blocks === 1,
     `${wrapped.id} · ${wrapped.blocks}`);
}

/* ================================================ 4 · THE REST OF THE PAGE */
{
  const st = await page.evaluate(() => ({
    cap: document.getElementById('cap-layers').textContent.trim(),
    videos: [...document.querySelectorAll('video')].map((v) => ({ id: v.id, paused: v.paused, t: v.currentTime })),
    verdict: document.querySelectorAll('table.verdict tbody tr').length,
    lightbox: !!document.getElementById('lightbox'),
    sections: [...document.querySelectorAll('section')].map((s) => s.id),
  }));
  ok('page · the layered caption names the interactions',
     /pointer parallax/.test(st.cap) && /lamp/.test(st.cap) && /hearth/.test(st.cap) && /hold the window/.test(st.cap),
     st.cap);
  ok('page · both videos still playing', st.videos.length === 2 && st.videos.every((v) => !v.paused),
     st.videos.map((v) => `${v.id} ${v.paused ? 'paused' : 'playing'}`).join(', '));
  ok('page · verdict table intact', st.verdict === 2, st.verdict + ' rows');
  ok('page · sections intact + grammar added',
     ['s-breathed', 's-layered', 's-grammar', 's-street', 's-verdict'].every((s) => st.sections.includes(s)),
     st.sections.join(', '));

  /* the lightbox still opens from the stage — and a target click does NOT open it */
  await page.click('#tgt-hearth');
  await sleep(250);
  ok('page · a target click is not a lightbox click',
     !(await page.evaluate(() => document.getElementById('lightbox').classList.contains('open'))));
  await page.click('#stage-layers', { position: { x: 40, y: 40 } });
  await sleep(400);
  ok('page · the lightbox still opens from the stage',
     await page.evaluate(() => document.getElementById('lightbox').classList.contains('open')));
  await page.keyboard.press('Escape');
  await sleep(200);
}

/* ============================================== 5 · REDUCED MOTION HONOURED */
{
  const rctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  const rerr = [];
  watch(rp, rerr);
  await rp.goto(URL_PAGE, { waitUntil: 'load', timeout: 90000 });
  await rp.waitForFunction(() => !!window.__lp, null, { timeout: 20000 }).catch(() => {});
  await rp.$eval('#stage-layers', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(700);
  const rbox = await (await rp.$('#stage-layers')).boundingBox();
  await rp.mouse.move(rbox.x + rbox.width * 0.1, rbox.y + rbox.height * 0.5, { steps: 5 });
  await sleep(2400);
  const r = await rp.evaluate(() => ({
    reduced: window.__lp.reduced(), bias: window.__lp.bias(),
    tf: getComputedStyle(document.getElementById('lamp')).transform,
  }));
  await sleep(1500);
  const tf2 = await rp.evaluate(() => getComputedStyle(document.getElementById('lamp')).transform);
  ok('reduced-motion · pointer parallax is withheld',
     r.reduced === true && Math.abs(r.bias.x) < 0.05 && r.tf === tf2,
     `bias ${r.bias.x.toFixed(3)} · transform stable=${r.tf === tf2}`);
  /* the verbs still WORK — they just arrive as a state change */
  await rp.click('#tgt-lamp');
  await sleep(200);
  ok('reduced-motion · the verbs still answer',
     await rp.evaluate(() => window.__lp.flare()));
  ok('reduced-motion · zero console errors', rerr.length === 0, rerr.slice(0, 4).join(' | ') || 'clean');
  await rctx.close();
}

ok('page · zero console errors', errs.length === 0, errs.slice(0, 6).join(' | ') || 'clean');
fs.writeFileSync(path.join(WORK, 'errors.json'), JSON.stringify(errs, null, 1));
fs.writeFileSync(path.join(WORK, 'checks.json'), JSON.stringify({ base: BASE, checks, failures }, null, 1));

await ctx.close();
await browser.close();

console.log(`\n${checks.filter((c) => c.startsWith('PASS')).length}/${checks.length} checks passed on ${BASE}`);
if (failures.length) { console.error('FAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('shots: ' + ['idle', 'flare', 'hold'].map((s) => path.join(OUT, `living-plate-interactive-${s}.png`)).join('\n       '));
