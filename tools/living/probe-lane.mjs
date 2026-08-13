/**
 * probe-lane.mjs — the ROOM + STREET + HEADS lane's own measuring device.
 *
 * Not a lap. A lap reads the book; this jumps to the units the review named,
 * paints them, and MEASURES the thing the review complained about, at the
 * unit's own lens, in the unit's own pixels. Every number the fix round claims
 * has to come out of here first (before) and again after.
 *
 * Usage: node tools/living/probe-lane.mjs [--out DIR] [--only NAME,NAME]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../png.mjs';
import { edgeBands, LANDSCAPE_MAX, deadBands } from './lenslaw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(argv('--out', path.join(ROOT, 'shots', 'probe-lane')));
const ONLY = (argv('--only', '') || '').split(',').filter(Boolean);
const PORT = +argv('--port', 8823);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

function serve(dir, port) {
  const srv = createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(dir, u === '/' ? 'index.html' : u);
      if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
                           'cache-control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404).end(String(e.message)); }
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

/* ---- pixel helpers, on a decoded RGBA frame ---------------------------- */
const px = (f, x, y) => {
  const ch = f.channels || 4;
  const i = (y * f.width + x) * ch;
  return ch === 1 ? [f.data[i], f.data[i], f.data[i]]
                  : [f.data[i], f.data[i + 1], f.data[i + 2]];
};
function stats(f, r) {
  let n = 0, sum = 0, max = 0, min = 255;
  const x1 = Math.max(0, r.x | 0), y1 = Math.max(0, r.y | 0);
  const x2 = Math.min(f.width, (r.x + r.w) | 0), y2 = Math.min(f.height, (r.y + r.h) | 0);
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const [R, G, B] = px(f, x, y);
    const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    sum += l; n++; if (l > max) max = l; if (l < min) min = l;
  }
  return { mean: +(sum / Math.max(1, n)).toFixed(2), max: +max.toFixed(1), min: +min.toFixed(1), n };
}
/** WATSON'S SIGNATURE in a rendered rect: the only green in the room plate was
 *  the coat of the man in the armchair (measured: 494 px in the seat volume and
 *  494 px in the whole 1408x768 plate). */
function greenPx(f, r) {
  let n = 0, tot = 0;
  const x1 = Math.max(0, r.x | 0), y1 = Math.max(0, r.y | 0);
  const x2 = Math.min(f.width, (r.x + r.w) | 0), y2 = Math.min(f.height, (r.y + r.h) | 0);
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const [R, G, B] = px(f, x, y);
    tot++;
    if (G > R + 5 && G > B + 5 && R + G + B > 90) n++;
  }
  return { n, tot, pct: +(100 * n / Math.max(1, tot)).toFixed(3) };
}

/** how many pixels in r differ between two frames by more than `thr` */
function motion(a, b, r, thr = 10) {
  let n = 0, hit = 0, worst = 0;
  const x1 = Math.max(0, r.x | 0), y1 = Math.max(0, r.y | 0);
  const x2 = Math.min(a.width, (r.x + r.w) | 0), y2 = Math.min(a.height, (r.y + r.h) | 0);
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const p = px(a, x, y), q = px(b, x, y);
    const d = Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
    if (d > worst) worst = d;
    if (d > thr) hit++;
    n++;
  }
  return { pct: +(100 * hit / Math.max(1, n)).toFixed(2), worst, n };
}

const out = { when: new Date().toISOString(), probes: {} };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(SITE, PORT);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
                                       deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?harness=1`, { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 40000 });
  await page.evaluate(() => window.__mute(true));
  await page.evaluate(() => window.__ensureAll());

  const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
  const st = () => page.evaluate(() => window.__state());
  const go = (k) => page.evaluate((key) => window.__gotoUnit(key), k);
  const shot = async (name) => {
    await page.evaluate(() => window.__renderNow());
    const buf = await page.screenshot({ path: path.join(OUT, name + '.png') });
    return decodePng(buf);
  };
  /* plate px -> screenshot px, at the CURRENT camera. dpr 2.
     A step comes FIRST: setFocus snaps cam3, but camX/camY are only recomputed
     inside applyCam() during a step, so asking for a screen rect straight after
     a jump mixed the new k with the old translate and put the window band 100 px
     off the right edge of the frame. */
  const boxOf = async (rect) => (await page.evaluate(() => window.__renderNow()),
    page.evaluate((r) => {
    const s = window.__refs.stage;
    const a = s.toScreen(r[0], r[1]), b = s.toScreen(r[0] + r[2], r[1] + r[3]);
    return { x: a.x * 2, y: a.y * 2, w: (b.x - a.x) * 2, h: (b.y - a.y) * 2 };
  }, rect));
  const want = (n) => !ONLY.length || ONLY.includes(n);

  /* ================= HEADS: every heading's luminance ================= */
  if (want('heads')) {
    const heads = ['head', 'head2', 'head3', 'head4', 'head6', 'head7'];
    const rows = [];
    for (const k of heads) {
      await go(k);
      await T(1.1);
      const f = await shot('head-' + k);
      const s = await st();
      // the whole plate panel, in screenshot px
      const stagebox = await page.evaluate(() => {
        const r = document.getElementById('stage').getBoundingClientRect();
        return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
      });
      const headline = await page.evaluate(() => {
        const p = document.querySelector('.blk.head p');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
      });
      rows.push({ key: k, set: s.set, page: s.page, dim: s.stage.plate.dim,
                  cover: await page.evaluate(() => +getComputedStyle(document.getElementById('cover')).opacity),
                  plate: stats(f, stagebox),
                  heading: headline ? stats(f, headline) : null });
    }
    out.probes.heads = rows;
    console.log('HEADS'); for (const r of rows) {
      console.log(`  ${r.key.padEnd(6)} set=${String(r.set).padEnd(7)} dim=${r.dim} cover=${r.cover}` +
        ` plate mean=${r.plate.mean} max=${r.plate.max}` +
        ` heading mean=${r.heading && r.heading.mean} max=${r.heading && r.heading.max}`);
    }
  }

  /* ============ ROOM: the chair region, units 10-12 lenses ============ */
  if (want('watson')) {
    const rows = [];
    for (const k of ['comes2', 'hadnote', 'seat']) {
      await go(k);
      await T(1.2);
      const f = await shot('room-' + k);
      // the armchair box the set itself declares, plus the seat volume behind it
      const chair = await boxOf([718, 335, 176, 209]);
      const sitter = await boxOf([736, 330, 150, 170]);
      // Watson's own palette, sampled off the shipped plate: green coat, pale
      // face, grey paper. Counted INSIDE the seat volume.
      rows.push({ key: k, chair: stats(f, chair), sitter: stats(f, sitter),
                  green: greenPx(f, chair), cam: (await st()).stage.cam });
    }
    out.probes.watson = rows;
    console.log('WATSON (chair region luma at the unit lens)');
    for (const r of rows) console.log(`  ${r.key.padEnd(8)} chair mean=${r.chair.mean} max=${r.chair.max}` +
      `  GREEN(coat) ${r.green.n} px of ${r.green.tot} (${r.green.pct}%)  cam k=${r.cam.k}`);
  }

  /* ============ ROOM: the arrival, motion in the window band ========== */
  if (want('arrival')) {
    await go('comes2');
    const frames = [];
    const wb = (await st()).stage.winBand || [827, 137, 87, 258];
    const band = await boxOf(wb);
    const doorband = await boxOf([288, 440, 160, 90]);
    for (let i = 0; i < 12; i++) {
      await T(0.18);
      frames.push(await shot('arrival-' + String(i).padStart(2, '0')));
    }
    let worstWin = { pct: 0 }, worstDoor = { pct: 0 };
    for (let i = 1; i < frames.length; i++) {
      const m = motion(frames[i - 1], frames[i], band, 8);
      if (m.pct > worstWin.pct) worstWin = { ...m, at: i };
      const d = motion(frames[i - 1], frames[i], doorband, 8);
      if (d.pct > worstDoor.pct) worstDoor = { ...d, at: i };
    }
    // and across the whole unit, first vs last
    const span = motion(frames[0], frames[frames.length - 1], band, 8);
    const snap = (await st()).stage.arrive;
    out.probes.arrival = { band, doorband, worstWin, worstDoor, span, snap };
    console.log('  band rect ' + JSON.stringify(band) + ' snap ' + JSON.stringify(snap));
    console.log('ARRIVAL  window band: worst frame-to-frame ' + worstWin.pct + '% (worst delta ' +
      worstWin.worst + ') span ' + span.pct + '%  |  door band ' + worstDoor.pct + '%');
  }

  /* ================= STREET: the lodge, the figure ==================== */
  if (want('lodge')) {
    await go('lodge');
    await T(1.4);
    const f = await shot('street-lodge');
    const s = await st();
    const geo = await page.evaluate(() => {
      const st_ = window.__refs.stage;
      const el = st_.active.holmes;
      const r = el.getBoundingClientRect();
      const p0 = st_.toPlate(r.left, r.top), p1 = st_.toPlate(r.right, r.bottom);
      return { plate: { x: +p0.x.toFixed(1), y: +p0.y.toFixed(1),
                        w: +(p1.x - p0.x).toFixed(1), h: +(p1.y - p0.y).toFixed(1) },
               css: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
               floorDy: null };
    });
    // dead band: how much of the panel is empty page-navy
    const stagebox = await page.evaluate(() => {
      const r = document.getElementById('stage').getBoundingClientRect();
      return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
    });
    const cols = [];
    for (let i = 0; i < 40; i++) {
      const b = { x: stagebox.x + i * stagebox.w / 40, y: stagebox.y,
                  w: stagebox.w / 40, h: stagebox.h };
      cols.push(stats(f, b).mean);
    }
    out.probes.lodge = { figure: geo, cam: s.stage.cam, columns: cols };
    console.log('LODGE  figure plate h=' + geo.plate.h + ' css h=' + geo.css.h + ' headCss=' +
      (geo.css.h / 7.6).toFixed(1) +
      '  (door leaf is 107 plate px)  ratio=' + (geo.plate.h / 107).toFixed(3));
    console.log('  column means L->R: ' + cols.map((c) => c.toFixed(0)).join(' '));
  }

  /* ============ the dead-band law, on the RENDERED frame ============== */
  if (want('deadband')) {
    const rows = [];
    const UNITS = (argv('--units', 'head,undated,wmark,gaz2,comes2,hadnote,seat,briony,' +
      'goodnight,door,head2,lodge,following,head3,hansom,toogood,head4,notasoul,' +
      'plan1,neutral,head6,instinct1,head7,letter1,valuemore,thewoman')).split(',');
    for (const k of UNITS) {
      const u = await go(k);
      if (!u) { console.log('  (no such unit: ' + k + ')'); continue; }
      await T(1.4);
      const f = await shot('band-' + k);
      const stagebox = await page.evaluate(() => {
        const r = document.getElementById('stage').getBoundingClientRect();
        return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2 };
      });
      const s_ = await st();
      const b = edgeBands(f, stagebox);
      rows.push({ key: k, set: s_.set, dim: s_.stage.plate.dim, cam: s_.stage.cam,
                  band: { left: +b.left.toFixed(2), right: +b.right.toFixed(2),
                          top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2),
                          max: +b.max.toFixed(2) } });
    }
    out.probes.deadband = rows;
    console.log('DEAD BAND on the rendered frame (limit ' + LANDSCAPE_MAX + ')');
    for (const r of rows) {
      const flag = r.band.max > LANDSCAPE_MAX && r.dim <= 0.5 ? '   <== OVER' : '';
      console.log(`  ${r.key.padEnd(11)} ${String(r.set).padEnd(7)} dim=${String(r.dim).padEnd(5)}` +
        ` L${r.band.left} R${r.band.right} T${r.band.top} B${r.band.bottom}${flag}`);
    }
  }

  /* ============ CHASE: Norton's brightness against the scene ========== */
  if (want('norton')) {
    await go('hansom');
    await T(1.6);
    const f = await shot('chase-hansom');
    const geo = await page.evaluate(() => {
      const s = window.__refs.stage;
      const n = s.active.rigs && s.active.rigs.norton;
      const el = (n && (n.body || n.el)) || null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x * 2, y: r.y * 2, w: r.width * 2, h: r.height * 2,
               filter: getComputedStyle(el).filter };
    });
    out.probes.norton = { geo, box: geo ? stats(f, geo) : null };
    console.log('NORTON  ' + JSON.stringify(out.probes.norton));
  }

  out.errors = errs;
  fs.writeFileSync(path.join(OUT, 'probe-lane.json'), JSON.stringify(out, null, 1));
  console.log('\nerrors: ' + errs.length + '  ->  ' + OUT);
  await browser.close();
  srv.close();
}

const kill = setTimeout(() => { console.log('PROBE TIMEOUT'); process.exit(2); }, 300000);
kill.unref?.();
main().catch((e) => { console.error('PROBE CRASH', e); process.exit(3); });
