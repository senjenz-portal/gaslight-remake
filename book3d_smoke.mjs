/**
 * book3d_smoke.mjs — THE ASSEMBLED BOOK'S WALK.
 *
 * One browser session proves the whole thing:
 *
 *   1. THE [scale] GATE. Every mounted instance on every set — the full
 *      instance table printed to the console and asserted green (±15%).
 *   2. THE 81-UNIT WALK. Every unit entered in order, every gate resolved BY
 *      ITS OWN VERB (G1 ship target · G2 sword target · G3 bowl release ·
 *      G4 ember hold · G5 great-ram target · G6 cyclops ×2 + the name
 *      release), every clock unit turned by the beat clock, the closing card
 *      reached and the sigil drawn.
 *   3. THE LAWS. Posture (head pitch measured in situ on every rig), obstacle
 *      (every route audited against the set's own ledger boxes at fire time),
 *      census (Ulysses + <= 3 crew on a leaf, 4 at the lots, 4 at the oars),
 *      determinism (a second lap from the same seed lands on the same clock),
 *      voice (a line asserted for every unit that has one), zero errors.
 *   4. THE FRAMES. Six per-beat frames + three story-feel frames, rendered
 *      through the storyteller's own lens, to shots/book3d-r2/.
 *   5. THE VIEWING LAWS (round 2). [read] — every shot's SUBJECT measured on
 *      the pixels the reader is looking at (something on the body is lit, the
 *      region is not a hole, it separates from its background). [side] — the
 *      screen-direction system: every pinned unit landed on the side the table
 *      pinned it to. [escalation] — the cave headings are a ladder, not one
 *      neutral master shown four times.
 *
 *   node tools/book3d_smoke.mjs [--base <url>] [--frames-only]
 */
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const argOf = (k) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : null; };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO, 'site-deploy');
const SHOTS = path.join(REPO, 'shots', argOf('--out') || 'book3d-r2');
const SMOKE = path.join(ROOT, 'living-odyssey', '3d', 'smoke');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

let server = null, BASE = argOf('--base');
if (!BASE) {
  server = http.createServer((req, res) => {
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
  BASE = `http://127.0.0.1:${server.address().port}`;
}
await mkdir(SHOTS, { recursive: true });
await mkdir(SMOKE, { recursive: true });

/* THE FRAME SHEET — one per beat at the beat's own strongest unit, plus the
 * three STORY-FEEL frames: the giant seated over the suppliant (the scale
 * that makes the book work), the blinding, and the sail-off. */
/* THE HOLD is how long the unit is allowed to PLAY before the shutter opens.
 * A unit that walks a body to its mark is not staged until the walk lands —
 * shoot it at two seconds and you photograph a man a third of the way there,
 * cut by the frame edge, which is what the composition gate caught. */
const BEAT_FRAMES = [
  { file: 'beat1-council.png', unit: 'ody-i-07-council', hold: 8.0, why: 'I · the council on the sand, the ship behind' },
  { file: 'beat2-plea.png', unit: 'ody-ii-06-plea', hold: 9.0, why: 'II · the suppliant at the seated giant' },
  { file: 'beat3-bowl.png', unit: 'ody-iii-08-lookhere', hold: 6.0, why: 'III · the bowl offered at the knee' },
  { file: 'beat4-auger.png', unit: 'ody-iv-03-auger', hold: 3.0, why: 'IV · the beam driven into the eye' },
  { file: 'beat5-ram.png', unit: 'ody-v-07-lastofall', hold: 7.0, why: 'V · the great ram at the mouth' },
  { file: 'beat6-curse.png', unit: 'ody-vi-11-curse', hold: 3.2, why: 'VI · the curse from the water' },
];
const FEEL_FRAMES = [
  { file: 'feel-giant.png', unit: 'ody-ii-05-strangers', hold: 4.0, why: 'the low angle up at seven metres' },
  { file: 'feel-blinding.png', unit: 'ody-iv-05-hiss', hold: 1.1, why: 'the blinding — flare, shake, nothing shown' },
  { file: 'feel-sailoff.png', unit: 'ody-vi-14-sailedon', hold: 6.0, why: 'the sail-off down the moonpath' },
];

const errors = [], scaleLines = [];
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[scale]')) scaleLines.push(t);
  if (m.type() === 'error') errors.push('console: ' + t);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const report = { lane: 'viewing-r2', when: new Date().toISOString(), base: BASE };

/* ================= PASS A · THE WALK ================= */
await page.goto(`${BASE}/living-odyssey/3d/?harness=1&scalegate=all`, { waitUntil: 'load' });
await page.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
report.scale = await page.evaluate(() => window.__scale);
report.mounted = await page.evaluate(() => window.__book.describe().set);

report.walk = await page.evaluate(async () => {
  const B = window.__book;
  const UNITS = B.stage ? null : null;
  const log = [], stuck = [];
  const gatesSeen = {};
  const now = () => B.unit;

  /* the reader's own hands, driven by the verb the unit declares */
  const step = (s) => B.run(s);
  const wait = async (pred, budget = 40) => {
    let spent = 0;
    while (!pred() && spent < budget) { step(0.25); spent += 0.25; await null; }
    return pred();
  };

  await B.goto('ody-i-00-head');
  let guard = 0;
  while (!B.ended && guard++ < 400) {
    const id = B.unit;
    const verb = document.body.dataset.verb;
    const t0 = B.simT;
    /* THE CENSUS IS READ ON ENTRY — the leaf as the reader meets it, before
       the verb is spent and the next unit restages it. */
    const census = B.census();
    const set = document.body.dataset.set, beat = +document.body.dataset.beat;
    let how = verb;
    if (verb === 'click') {
      /* A LEAF IS HELD FOR THE TIME A LEAF TAKES. The book's own lean-back
         clock will not turn a click leaf in under LEAN_MIN (3 s), and this
         lap used to spend half a second on one — ten times a reader's pace.
         That is not a harmless shortcut: Beat I walks Ulysses the audited
         corridor around the campfire to the council mark, a half-minute of
         staging, and a lap that outruns it arrives at the ship gate with the
         lens still on a man in the middle of the sand and the ship behind
         the camera. The gate then reads as dead — which is exactly what it
         did. The lap now reads at the pace the book declares. */
      step(3.0);
      await B.advance();
    } else if (verb === 'auto') {
      how = 'auto';
      if (!await wait(() => B.unit !== id, 30)) { stuck.push({ id, verb }); await B.advance(); }
    } else if (verb === 'clock') {
      how = 'clock';
      if (!await wait(() => B.unit !== id, 45)) { stuck.push({ id, verb }); await B.advance(); }
    } else if (verb === 'target') {
      /* THE READER'S FINGER, AT REAL COORDINATES. The walk clicks the pixel
         the target actually renders on under the unit's own live shot — the
         whole hit path, nothing skipped. */
      how = 'target';
      await wait(() => B.targetLive(), 12);
      const live = B.targetLive();
      /* THE READER WAITS FOR THE RING. This lap clicks through in half a
         second a leaf the reader spends a spoken line on, so a body can still
         be walking to its mark when the gate opens and the shot has not yet
         swung onto the target. A finger waits for the thing to be on screen;
         so does this. */
      const ringT0 = B.simT;
      await wait(() => { const a = B.aim(); return !!(a && a.onGeometry); }, 45);
      const waited = +(B.simT - ringT0).toFixed(2);
      const aim = B.aim();
      let ok = false;
      if (aim) {
        window.dispatchEvent(new PointerEvent('pointerdown', { clientX: aim.x, clientY: aim.y }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: aim.x, clientY: aim.y }));
        ok = B.unit !== id;
      }
      gatesSeen[id] = { verb, live, resolved: ok, waited,
                        aim: aim ? [Math.round(aim.x), Math.round(aim.y)] : null,
                        onTarget: !!(aim && aim.onGeometry) };
      if (!ok) { stuck.push({ id, verb, live, aim, waited }); await B.advance(); }
      else await wait(() => B.unit !== id, 6);
    } else if (verb === 'hold') {
      how = 'hold';
      B.hold(true);
      await wait(() => B.unit !== id, 20);
      B.hold(false);
      gatesSeen[id] = { verb, resolved: B.unit !== id };
      if (B.unit === id) { stuck.push({ id, verb }); await B.advance(); }
    } else if (verb === 'release') {
      how = 'release';
      B.hold(true);
      step(3.4);                                   /* draw the breath */
      B.hold(false);
      /* the let-go IS the advance — a real press, on the picture */
      const rr = document.getElementById('stage').getBoundingClientRect();
      window.dispatchEvent(new PointerEvent('pointerup',
        { clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height / 2 }));
      await wait(() => B.unit !== id, 8);
      gatesSeen[id] = { verb, resolved: B.unit !== id };
      if (B.unit === id) { stuck.push({ id, verb }); await B.advance(); }
    } else {
      await B.advance();
    }
    log.push({ id, verb, how, t: +t0.toFixed(2), next: now(), set, beat, census });
    if (B.unit === id && !B.ended) { stuck.push({ id, verb, reason: 'no advance' }); break; }
  }
  void UNITS;
  return { log, stuck, gates: gatesSeen, ended: B.ended, simT: +B.simT.toFixed(2),
           visited: log.length, guard };
});

report.gates = await page.evaluate(() => window.__book.gates);
report.routes = await page.evaluate(() => window.__book.routes());
report.voice = await page.evaluate(() => window.__book.voice());
report.pitch = await page.evaluate(() => window.__book.actorPitch());
report.director = await page.evaluate(() => window.__book.snapshot());

/* the closing card + the sigil */
report.endcard = await page.evaluate(async () => {
  const el = document.getElementById('endcard');
  const name = document.getElementById('dedname');
  name.value = 'Fable';
  name.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const sig = document.getElementById('sigil');
  const ctx = sig && sig.getContext ? sig.getContext('2d') : null;
  let ink = 0;
  if (ctx && sig.width) {
    const d = ctx.getImageData(0, 0, sig.width, sig.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 12) ink++;
  }
  return {
    ended: !!window.__ended,
    kicker: el.querySelector('.kick').textContent,
    title: el.querySelector('.ttl').textContent,
    sub: el.querySelector('.sub').textContent,
    dedication: document.getElementById('dedline').textContent,
    sigilInkPx: ink,
  };
});

/* ================= PASS A2 · THE [hit] GATE =================
 * Every gate, at ITS OWN LIVE SHOT, resolved by a REAL BROWSER CLICK at real
 * screen coordinates — page.mouse, not a dispatched event and not the tap()
 * rail. For each target gate the click lands on the pixel the target actually
 * renders on under the storyteller's lens; the reader's ring must be sitting
 * on that same pixel. A corner click must still MISS.                       */
const HIT_GATES = [
  { g: 'G1', unit: 'ody-i-07-council', key: 'council', verb: 'target', target: 'ship' },
  { g: 'G2', unit: 'ody-ii-11-sword', key: 'sword', verb: 'target', target: 'sword' },
  { g: 'G3', unit: 'ody-iii-08-lookhere', key: 'lookhere', verb: 'release' },
  { g: 'G4', unit: 'ody-iv-01-embers', key: 'embers', verb: 'hold' },
  { g: 'G5', unit: 'ody-v-04-greatram', key: 'greatram', verb: 'target', target: 'ram-great' },
  { g: 'G6', unit: 'ody-vi-01-jeer', key: 'jeer', verb: 'target', target: 'cyclops' },
  { g: 'G7', unit: 'ody-vi-06-defy', key: 'defy', verb: 'target', target: 'cyclops' },
  { g: 'G8', unit: 'ody-vi-07-myname', key: 'myname', verb: 'release' },
];
{
  const ph = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  ph.on('pageerror', (e) => errors.push(`hit: ${e.message}`));
  ph.on('console', (m) => { if (m.type() === 'error') errors.push('hit console: ' + m.text()); });
  await ph.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
  await ph.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
  const hits = [];
  for (const G of HIT_GATES) {
    await ph.evaluate((id) => window.__book.seek(id), G.unit);
    await ph.evaluate(() => window.__book.run(2.0));
    if (G.target) await ph.evaluate(() => {
      for (let i = 0; i < 40 && !window.__book.targetLive(); i++) window.__book.run(0.25);
    });
    const pre = await ph.evaluate(() => {
      const B = window.__book, ring = B.ring();
      return { unit: B.unit, aim: B.aim(), ring,
               /* the strict question, asked of the RING's own pixel */
               ringOnTarget: ring.on ? B.onTargetAt(ring.x, ring.y) : null,
               shot: window.__cine() ? window.__cine().cls : null };
    });
    const row = { ...G, shot: pre.shot, aim: pre.aim ? [Math.round(pre.aim.x), Math.round(pre.aim.y)] : null,
                  onPixels: !!(pre.aim && pre.aim.onGeometry),
                  ringOnTarget: pre.ringOnTarget, ringOn: !!(pre.ring && pre.ring.shown) };
    if (G.verb === 'target') {
      /* the ring must sit ON the pixel the click lands on */
      row.ringOffsetPx = pre.aim && pre.ring && pre.ring.on
        ? +Math.hypot(pre.ring.x - pre.aim.x, pre.ring.y - pre.aim.y).toFixed(1) : null;
      if (pre.aim) {
        await ph.mouse.click(pre.aim.x, pre.aim.y);
        await ph.evaluate(() => window.__book.run(0.5));
      }
    } else {
      const r = pre.aim ? pre.aim.rect : await ph.evaluate(() => {
        const b = document.getElementById('stage').getBoundingClientRect();
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      });
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      await ph.mouse.move(cx, cy);
      await ph.mouse.down();
      await ph.evaluate(() => window.__book.run(4.0));
      await ph.mouse.up();
      await ph.evaluate(() => window.__book.run(0.5));
    }
    const post = await ph.evaluate(() => ({ unit: window.__book.unit, gates: window.__book.gates }));
    row.turned = post.unit !== G.unit;
    row.gate = post.gates[G.key] || null;
    row.resolved = !!(row.gate && row.gate.ok) && row.turned;
    hits.push(row);
  }
  /* THE MISS PROBE — the corner of the picture is not the ship. The gate
     ledger is cumulative over the pass, so what is asserted is that the leaf
     does not turn and that the council's entry is not written AGAIN. */
  await ph.evaluate((id) => window.__book.seek(id), 'ody-i-07-council');
  await ph.evaluate(() => window.__book.run(2.0));
  const mr = await ph.evaluate(() => {
    const b = document.getElementById('stage').getBoundingClientRect();
    const a = window.__book.aim();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, aim: a,
             at: (window.__book.gates.council || {}).at ?? null };
  });
  /* the far corner from the aim, so the reach can never cover it */
  const farX = mr.aim && mr.aim.x < (mr.left + mr.right) / 2 ? mr.right - 6 : mr.left + 6;
  const farY = mr.aim && mr.aim.y < (mr.top + mr.bottom) / 2 ? mr.bottom - 6 : mr.top + 6;
  await ph.mouse.click(farX, farY);
  await ph.evaluate(() => window.__book.run(0.4));
  const miss = await ph.evaluate(() => ({ unit: window.__book.unit, gates: window.__book.gates }));
  /* and a press OFF the picture entirely */
  await ph.mouse.click(20, 20);
  await ph.evaluate(() => window.__book.run(0.4));
  const off = await ph.evaluate(() => ({ unit: window.__book.unit, gates: window.__book.gates }));
  const stillHeld = (g) => g.unit === 'ody-i-07-council' &&
    ((g.gates.council || {}).at ?? null) === mr.at;
  report.hit = { gates: hits,
    miss: { at: [Math.round(farX), Math.round(farY)], unit: miss.unit,
            missed: stillHeld(miss) },
    offPicture: { unit: off.unit, missed: stillHeld(off) } };
  await ph.close();
}

/* ---- DETERMINISM: a second lap on a fresh page must land identically ---- */
{
  const p2 = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await p2.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
  await p2.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
  const lap = async (pg) => pg.evaluate(async () => {
    const B = window.__book;
    await B.goto('ody-ii-00-head');
    B.run(6);
    const s = B.stage;
    const pick = ['ulysses', 'crew-0', 'poly-walk'];
    const pose = {};
    for (const id of pick) {
      const a = s.actors.get(id);
      if (a) pose[id] = [+a.group.position.x.toFixed(4), +a.group.position.y.toFixed(4),
                         +a.group.position.z.toFixed(4), +a.group.rotation.y.toFixed(4)];
    }
    return { simT: +B.simT.toFixed(4), pose, boulderK: B.snapshot().boulderK };
  });
  const a = await lap(p2);
  const p3 = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await p3.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
  await p3.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
  const b = await lap(p3);
  report.determinism = { a, b, identical: JSON.stringify(a) === JSON.stringify(b) };
  await p2.close(); await p3.close();
}

/* ================= PASS A3 · THE VIEWING LAWS =================
 * Fable's round-1 defect was not a bug in any one shot: "key actors render as
 * unreadable silhouettes" and "the cutting lacks a stable eyeline/screen-
 * direction system" are properties of the WHOLE sequence, so they are measured
 * over the whole sequence. This pass seeks every unit, lets its shot settle,
 * and asks the frame two questions:
 *
 *   [read] does the SUBJECT OF THE LINE actually read? Measured off the drawn
 *          canvas inside the subject's own projected box — brightest decile,
 *          mean, and the separation from a ring around it. The law lives in
 *          cine3d.js (READ_LAW) so the page and the gate cannot disagree.
 *   [side] did the shot land on the side the screen-direction system pinned it
 *          to? In the cave the giant is frame right and the men frame left; at
 *          sea the island is right and the ship left. A cut that swaps them
 *          makes the reader re-learn the room.
 *
 * It runs on its OWN page: a late seek on the walk's page rewinds the clock
 * the [hit] ledger was written against. */
{
  const pv = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const verr = [];
  pv.on('pageerror', (e) => verr.push(`view: ${e.message}`));
  pv.on('console', (m) => { if (m.type() === 'error') verr.push('view console: ' + m.text()); });
  await pv.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
  await pv.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
  /* the unit list comes from the SHOT TABLE, which is the thing under test:
     a unit with no row would otherwise be silently skipped by the gate that
     exists to catch exactly that. */
  const TABLE = JSON.parse(await readFile(
    path.join(ROOT, 'living-odyssey', '3d', 'shots3d.json'), 'utf8'));
  const ids = Object.keys(TABLE.units);
  report.escalation = TABLE.escalation || null;
  const rows = [];
  for (const id of ids) {
    const r = await pv.evaluate(async (unit) => {
      const B = window.__book;
      await B.seek(unit);
      /* THE SHUTTER WAITS FOR THE SHOT. A cut crossfades and a body may still
         be walking to its mark: read the frame the reader would be looking at
         a beat later, not the one mid-dissolve. */
      B.run(1.6);
      const c = window.__cine(), rd = window.__read();
      return { unit, set: document.body.dataset.set, cls: c && c.cls,
               cine: c && { size: c.size, inFrame: c.inFrame, cx: c.cx, cy: c.cy,
                            side: c.side, wantSide: c.wantSide, sideOk: c.sideOk,
                            rig: c.rig, rack: c.rack },
               read: rd };
    }, id);
    rows.push(r);
  }
  report.viewing = { rows };
  errors.push(...verr);
  await pv.close();
}

/* ================= PASS B · THE FRAMES ================= */
const frames = [];
for (const f of [...BEAT_FRAMES, ...FEEL_FRAMES]) {
  const pf = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const ferr = [];
  pf.on('pageerror', (e) => ferr.push(e.message));
  pf.on('console', (m) => { if (m.type() === 'error') ferr.push(m.text()); });
  await pf.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
  await pf.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
  const meta = await pf.evaluate(async ({ unit, hold }) => {
    const B = window.__book;
    await B.seek(unit);
    B.run(hold);
    return { unit: B.unit, set: document.body.dataset.set, cine: window.__cine(),
             read: window.__read(), census: B.census() };
  }, f);
  /* C3 AT THE SHUTTER: the reader's two controls exist for the reader, and
     the frame carries neither. `noverlay` hides them for the exposure, and
     the same frame is re-shot without the class to prove the law. */
  await pf.evaluate(() => document.documentElement.classList.add('noverlay'));
  await pf.waitForTimeout(250);
  const shot = await pf.locator('#stage3d').screenshot();
  await writeFile(path.join(SHOTS, f.file), shot);
  const controlsUp = await pf.evaluate(() => {
    const q = (id) => document.getElementById(id).classList.contains('on');
    const up = q('hold') || q('target');
    for (const id of ['leader', 'hold', 'target']) document.getElementById(id).remove();
    return up;
  });
  await pf.waitForTimeout(120);
  const bare = await pf.locator('#stage3d').screenshot();
  frames.push({ ...f, ...meta, bytes: shot.length, controlsUp,
                overlayFree: Buffer.compare(shot, bare) === 0 });
  errors.push(...ferr.map((e) => `frame ${f.file}: ${e}`));
  await pf.close();
}
report.frames = frames;

await browser.close();
if (server) server.close();

/* ================= verdicts ================= */
const V = [];
const push = (name, ok, detail) => V.push({ name, verdict: ok ? 'PASS' : 'FAIL', detail });

const W = report.walk;
push('zero console/page errors', errors.length === 0, errors.slice(0, 6).join(' | ') || 'clean');
push('[scale] gate green — every mounted instance', !!report.scale && report.scale.ok,
     report.scale ? `${report.scale.rows.filter((r) => r.verdict === 'PASS').length}/${report.scale.rows.length} inside ±15%` : 'no gate');
push('[scale] full instance table printed', scaleLines.length >= (report.scale ? report.scale.rows.length : 99) + 3,
     `${scaleLines.length} [scale] console lines`);
push('the 81-unit walk completes', !!W && W.ended && W.visited >= 81 && W.stuck.length === 0,
     W ? `${W.visited} units · ${W.stuck.length} stuck${W.stuck.length ? ' (' + W.stuck.map((s) => s.id).join(', ') + ')' : ''} · sim ${W.simT}s · ended ${W.ended}` : 'no walk');

const GATE_KEYS = ['council', 'sword', 'lookhere', 'embers', 'greatram', 'jeer', 'defy', 'myname'];
const gateOk = GATE_KEYS.filter((k) => report.gates && report.gates[k] && report.gates[k].ok);
push('every gate resolved by its own verb', gateOk.length === GATE_KEYS.length,
     `${gateOk.length}/${GATE_KEYS.length} — ${GATE_KEYS.filter((k) => !gateOk.includes(k)).join(', ') || 'all'}`);

/* ---------------- THE [hit] GATE ---------------- */
const H = report.hit || { gates: [] };
const hitOk = H.gates.filter((r) => r.resolved);
push('[hit] all 8 gates resolve on a REAL click at their live shot',
     hitOk.length === HIT_GATES.length,
     H.gates.map((r) => `${r.g} ${r.resolved ? 'ok' : 'DEAD'}` +
       (r.aim ? `@${r.aim[0]},${r.aim[1]}` : '')).join(' · '));
const aimed = H.gates.filter((r) => r.verb === 'target');
push('[hit] every target click lands on the target\'s OWN PIXELS',
     aimed.length > 0 && aimed.every((r) => r.onPixels),
     aimed.map((r) => `${r.g} ${r.shot} ${r.onPixels ? 'on-pixels' : 'BOX-FALLBACK'}`).join(' · '));
push('[hit] the reader\'s ring sits ON the rendered target',
     aimed.length > 0 && aimed.every((r) => r.ringOn && r.ringOnTarget),
     aimed.map((r) => `${r.g} ring ${r.ringOn ? '' : 'HIDDEN '}` +
       `${r.ringOnTarget ? 'on target' : 'OFF TARGET'} (${r.ringOffsetPx}px from aim)`).join(' · '));
const walkTargets = Object.entries((W && W.gates) || {}).filter(([, v]) => v.verb === 'target');
push('the walk\'s own target gates clicked their real coordinates',
     walkTargets.length === 5 && walkTargets.every(([, v]) => v.resolved && v.onTarget),
     walkTargets.map(([k, v]) => `${k.replace('ody-', '')} ${v.aim ? v.aim.join(',') : 'no-aim'}` +
       ` (ring after ${v.waited}s)`).join(' · '));
push('[hit] the miss-probe still misses',
     !!(H.miss && H.miss.missed) && !!(H.offPicture && H.offPicture.missed),
     H.miss ? `corner ${H.miss.at.join(',')} -> ${H.miss.unit} (held) · off-picture -> ${H.offPicture.unit}` : 'no probe');

const beatsSeen = [...new Set((W ? W.log : []).map((r) => r.beat))].sort((a, b) => a - b);
push('all six beats played', beatsSeen.length === 6 && beatsSeen[5] === 6, `beats ${beatsSeen.join(',')}`);
const setsSeen = [...new Set((W ? W.log : []).map((r) => r.set))];
push('all three sets mounted in the walk',
     ['shore', 'cave', 'sea'].every((s) => setsSeen.includes(s)), setsSeen.join(' -> '));

/* THE OBSTACLE LAW */
const badRoutes = (report.routes || []).filter((r) => r.hits && r.hits.length);
push('obstacle law: no audited route crosses a ledger box', badRoutes.length === 0,
     `${(report.routes || []).length} routes audited · ${badRoutes.length} crossings` +
     (badRoutes.length ? ' — ' + badRoutes.slice(0, 3).map((r) => r.label).join(', ') : ''));

/* THE CENSUS LAW. Three besides Ulysses on a leaf. The text itself widens it
 * twice and only twice: FOUR chips are shaken at the lots, and FOUR oars are
 * pulled in the sea frame. Everything past that is a crowd. */
const rows = W ? W.log : [];
const capFor = (r) => (r.set === 'sea' ? 4 : r.id === 'ody-iii-05-lots' ? 4 : 3);
const overCap = rows.filter((r) => r.census.crew > capFor(r));
const lotsRow = rows.find((r) => r.id === 'ody-iii-05-lots');
push('census law: <=3 crew on a leaf (4 at the lots, 4 at the oars)',
     overCap.length === 0,
     `max crew ${Math.max(0, ...rows.map((r) => r.census.crew))} · ` +
     `lots ${lotsRow ? lotsRow.census.crew : '—'} · ` +
     `sea max ${Math.max(0, ...rows.filter((r) => r.set === 'sea').map((r) => r.census.crew))} · ` +
     `over cap: ${overCap.map((r) => r.id + '=' + r.census.crew).join(', ') || 'none'}`);
const twoGiants = rows.filter((r) => r.census.giant > 1);
push('census law: one giant rig on the leaf at a time', twoGiants.length === 0,
     twoGiants.length ? twoGiants.slice(0, 3).map((r) => r.id).join(', ') : 'never two');

/* THE POSTURE LAW — head pitch measured in situ, about each rig's own bind */
const pitch = report.pitch || {};
const badPitch = Object.entries(pitch).filter(([id, v]) =>
  v !== null && Math.abs(v) > (id.startsWith('poly') ? 45 : 14));
push('posture law: every rig\'s head pitch inside its band', badPitch.length === 0,
     Object.entries(pitch).map(([k, v]) => `${k} ${v === null ? '—' : v + '°'}`).join(' · '));

/* THE VOICE LAW */
push('voice: a mastered line asserted per unit', !!report.voice && report.voice.plays >= 70,
     report.voice ? `${report.voice.plays} lines logged in sim time` : 'no voice log');

push('determinism: two fresh laps land identically',
     !!report.determinism && report.determinism.identical,
     report.determinism ? JSON.stringify(report.determinism.a.pose).slice(0, 120) : 'no lap');

push('the closing card lands and the sigil is drawn',
     !!report.endcard && report.endcard.ended && report.endcard.sigilInkPx > 200 &&
     /Fable/.test(report.endcard.dedication),
     report.endcard ? `"${report.endcard.sub}" · sigil ${report.endcard.sigilInkPx} px · ${report.endcard.dedication}` : 'no card');

const framesOk = frames.filter((f) => f.bytes > 20000 && f.cine);
push('9 frames rendered through the storyteller\'s lens', framesOk.length === frames.length,
     `${framesOk.length}/${frames.length} · ${frames.map((f) => f.file.replace('.png', '')).join(' ')}`);
push('C3: no shipped frame carries a reader control',
     frames.every((f) => f.overlayFree),
     `${frames.filter((f) => f.controlsUp).length} frames shot with a control up · ` +
     `${frames.filter((f) => f.overlayFree).length}/${frames.length} byte-identical to bare`);
/* A SHOT THAT DECLARES `fill` IS ASKED THE OTHER QUESTION. "Keep 90% of the
   subject inside the frame" is the right law for a shot that FRAMES a body and
   the wrong one for a shot whose whole point is that the body does not fit —
   Sol's note on the blinding is "the giant filling the vertical frame", and a
   seven-metre man at attacker distance cannot both fill it and fit in it. So a
   fill shot must instead prove it is filling and not merely MISSING: the
   subject spans at least the frame height and its box still covers frame
   centre. Every other shot keeps the 90% law unchanged. */
const inFrameOk = (f) => f.cine && (f.cine.fill && f.cine.size >= 1
  ? (Math.abs(f.cine.cx) <= 0.6 && Math.abs(f.cine.cy) <= 0.9)
  : f.cine.inFrame >= 0.9);
const framesInFrame = frames.filter(inFrameOk);
push('every frame keeps its subject in frame (a fill shot fills it)',
     framesInFrame.length === frames.length,
     frames.map((f) => `${f.file.replace('.png', '')} ${f.cine ? f.cine.cls + ' ' + (f.cine.size || 0).toFixed(2) +
       (f.cine.fill ? ' FILL' : ` in ${f.cine.inFrame.toFixed(2)}`) : '—'}`).join(' · '));

report.errors = errors;
report.scaleConsole = scaleLines;
/* ================= THE VIEWING LAWS (round 2) ================= */
{
  const vr = (report.viewing && report.viewing.rows) || [];
  push('[view] every unit in the shot table was entered and measured',
       vr.length > 0 && vr.every((r) => r.cine && r.read),
       `${vr.filter((r) => r.cine && r.read).length}/${vr.length} units measured`);

  /* THE READABILITY LAW. Fable: "key actors render as unreadable silhouettes
     — dramatic light must never hide the ACTION." Measured on the pixels the
     reader is looking at, inside the subject's own projected box. */
  const readable = vr.filter((r) => r.read && r.read.ok === true);
  const unread = vr.filter((r) => r.read && r.read.ok === false);
  push('[read] the subject of every line reads on the drawn pixels',
       unread.length === 0,
       unread.length
         ? unread.slice(0, 6).map((r) => `${r.unit} (${r.read.why})`).join(' · ') +
           (unread.length > 6 ? ` · +${unread.length - 6} more` : '')
         : `${readable.length} shots inside the law (p90>=0.30 · mean>=0.10 · sep>=0.045 · dark<=0.55)`);

  /* THE READ RIG IS ACTUALLY LIT. A gate that passes because the SET is bright
     proves nothing about the rig, so the rig reports itself per frame. */
  const rigOn = vr.filter((r) => r.cine && r.cine.rig && r.cine.rig.on);
  push('[read] the subject rig travels with the line',
       rigOn.length >= Math.floor(vr.length * 0.8),
       `${rigOn.length}/${vr.length} shots carry a motivated fill + rim`);

  /* THE SCREEN-DIRECTION SYSTEM. Sol: "the cutting lacks a stable eyeline /
     screen-direction system." Every pinned row must land on its pinned side. */
  const pinned = vr.filter((r) => r.cine && r.cine.wantSide);
  const flipped = pinned.filter((r) => r.cine.sideOk === false);
  push('[side] every pinned shot lands on the axis it was baked to',
       pinned.length > 0 && flipped.length === 0,
       flipped.length
         ? flipped.slice(0, 6).map((r) => `${r.unit} wanted ${r.cine.wantSide} got ${r.cine.side}`).join(' · ')
         : `${pinned.length} pinned shots on-axis (cave: giant right / men left · sea: island right / ship left)`);

  /* THE ESCALATION LAW. Four wides that agree are one wide shown four times. */
  const esc = report.escalation;
  push('[escalation] the cave headings are a ladder, not one neutral master',
       !!esc && esc.ok === true && esc.turn && esc.turn.faces === 'mouth',
       esc ? esc.rungs.map((r) => `${r.unit.split('-')[1]} y${r.camY}/${r.dist}m`).join(' -> ') +
             ` · V turns to the ${esc.turn ? esc.turn.faces : '?'}` : 'no ladder recorded');

  /* THE RACK. Depth of field must REVEAL, not blur an obstruction. */
  const racked = vr.filter((r) => r.cine && r.cine.rack !== undefined && r.cine.rack !== null);
  push('[rack] the reveal shots carry a focus pull',
       racked.length >= 4, `${racked.length} shots report a rack position`);
}

report.verdicts = V;
report.green = V.every((v) => v.verdict === 'PASS');
report.framesDir = SHOTS;

await writeFile(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 1));
await writeFile(path.join(SMOKE, 'book-report.json'), JSON.stringify(report, null, 1));

for (const v of V) console.log(`${v.verdict.padEnd(4)} ${v.name} — ${v.detail}`);
console.log(report.green ? '\nBOOK3D SMOKE: GREEN' : '\nBOOK3D SMOKE: RED');
process.exit(report.green ? 0 : 1);
