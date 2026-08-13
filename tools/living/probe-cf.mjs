/**
 * probe-cf.mjs — the CHURCH + FINALE lane's own measuring device.
 *
 * Not a lap. A lap reads the book; this jumps to the units the review named,
 * paints them, and MEASURES the thing the review complained about at the unit's
 * own lens, in the unit's own pixels. Every number the fix round claims has to
 * come out of here first (before) and again after.
 *
 * What it measures, per defect:
 *   F4  the register ledger: is every participant in the marriage a CUT-OUT
 *   F5  every church mark probed against the SHIPPED PLATE's own floor classes
 *   F6  the sovereign's rendered width in device px + the journey's length
 *   F7  the ring's rendered width in device px + whether the push has ARRIVED
 *   F12 the reveal cut's magenta excess, and the fringe in the rendered frame
 *   F14 the finale portrait: is there a face in the frame
 *
 * Usage: node tools/living/probe-cf.mjs [--out DIR] [--tag before|after]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TAG = argv('--tag', 'after');
const OUT = path.resolve(argv('--out', path.join(ROOT, 'shots', 'probe-cf-' + TAG)));
const PORT = +argv('--port', 8831);

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

const CHURCH_UNITS = ['head4', 'notasoul', 'lounged', 'facedround', 'comeman',
                      'halfdragged', 'tyingup', 'preposterous', 'license',
                      'sovereigngift', 'unexpected', 'parkatfive'];

const out = { when: new Date().toISOString(), tag: TAG, probes: {} };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(SITE, PORT);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
                                       deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  await page.goto(`http://127.0.0.1:${PORT}/?harness=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__mute(true));

  const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
  const st = () => page.evaluate(() => window.__state());
  const go = (k) => page.evaluate((key) => window.__gotoUnit(key), k);
  const shot = async (n) => {
    await page.evaluate(() => window.__renderNow());
    await page.screenshot({ path: path.join(OUT, n + '.png') });
  };

  /* ---- the FLOOR PROBE: the shipped plate's own pixels ---------------- *
   * Decoded in the page (the plate is a JPEG, so a canvas is the decoder) and
   * classified with the same HSV boundaries tools/lanecf/church_geom.py uses. */
  const floorProbe = (marks) => page.evaluate(async (ms) => {
    const img = new Image();
    img.src = 'assets/set/church/church.jpg';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const cls = (r, gg, b) => {
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx;
      const s = mx === 0 ? 0 : (255 * (mx - mn)) / mx;
      let h = 0;
      if (mx !== mn) {
        const d = mx - mn;
        if (mx === r) h = ((gg - b) / d) % 6;
        else if (mx === gg) h = (b - r) / d + 2;
        else h = (r - gg) / d + 4;
        h = ((h * 60 + 360) % 360) * (255 / 360);
      }
      if (((h < 14) || (h > 242)) && s > 100 && v > 38 && v < 195) return 'carpet';
      if (s < 86 && v > 78 && v < 232) return 'stone';
      if (v < 78) return 'pew';
      return 'other';
    };
    const at = (x, y, r) => {
      const d = g.getImageData(Math.round(x) - r, Math.round(y) - r,
                              2 * r + 1, 2 * r + 1).data;
      let floor = 0, n = 0, mid = null;
      for (let i = 0; i < d.length; i += 4) {
        const k = cls(d[i], d[i + 1], d[i + 2]);
        if (k === 'carpet' || k === 'stone') floor++;
        n++;
      }
      const cd = g.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      mid = cls(cd[0], cd[1], cd[2]);
      return { at: mid, floorFrac: +(floor / n).toFixed(3) };
    };
    const res = {};
    for (const [name, xy] of Object.entries(ms)) res[name] = { xy, ...at(xy[0], xy[1], 5) };
    return res;
  }, marks);

  /* ---- CHURCH ------------------------------------------------------- */
  const rows = [];
  for (const key of CHURCH_UNITS) {
    await go(key);
    await T(0.85);                        // the lap's own settle
    /* and, exactly as the lap does now, a unit with a `wait` is not settled
       until its wait is — the reader cannot advance before then, so the frame
       the reader dwells on is the resolved one */
    for (let w = 0; w < 40; w++) {
      if (!(await st()).blocked) break;
      await T(0.25);
    }
    await shot('church-' + key);
    const s = await st();
    const sn = s.stage || {};
    const geo = await page.evaluate(() => {
      const g = window.__refs.stage;
      const a = g.active;
      const dpr = window.devicePixelRatio || 1;
      const wid = (n) => (n && +(n.style.opacity || 1) > 0.01
        ? +(n.getBoundingClientRect().width * dpr).toFixed(1) : 0);
      return { ringScreenPx: wid(a.band), coinScreenPx: wid(a.coin),
               chainScreenPx: wid(a.chain),
               brideScreenPx: wid(a.bride), clergyScreenPx: wid(a.clergy),
               camK: +g.cam3.k.toFixed(4), wantK: +g.cam3.wk.toFixed(4),
               dpr };
    });
    rows.push({ key, focus: s.unit && s.unit.focus, cam: sn.cam, geo,
                cast: sn.cast, ringLens: sn.ringLens, props: sn.props,
                floor: sn.floor });
  }
  out.probes.church = rows;
  console.log('CHURCH');
  for (const r of rows) {
    const c = r.cast || {};
    const cut = ['bride', 'clergyman', 'groom', 'witness']
      .map((k) => (c[k] && c[k].cutout ? k[0].toUpperCase() : k[0])).join('');
    console.log(`  ${r.key.padEnd(13)} focus=${String(r.focus).padEnd(6)} ` +
      `k=${r.cam && r.cam.k}/${r.cam && r.cam.wantK} cutouts=${cut} ` +
      `ring=${r.geo.ringScreenPx}px coin=${r.geo.coinScreenPx}px ` +
      `chain=${r.geo.chainScreenPx}px bride=${r.geo.brideScreenPx}px`);
  }

  /* the marks, probed against the plate */
  const marks = (rows.find((r) => r.floor) || {}).floor;
  if (marks) {
    const all = { ...marks.marks };
    for (const [k, v] of Object.entries(marks.feet)) all['feet.' + k] = v;
    out.probes.floor = await floorProbe(all);
    console.log('FLOOR (shipped church.jpg at every mark)');
    for (const [k, v] of Object.entries(out.probes.floor)) {
      console.log(`  ${k.padEnd(16)} (${v.xy[0]}, ${v.xy[1]}) -> ${v.at.padEnd(6)} ` +
                  `floorFrac=${v.floorFrac}`);
    }
  }

  /* ---- THE REVEAL (F12) --------------------------------------------- */
  await go('glimpse');
  await T(0.85);
  await shot('street-glimpse');
  const rev = await page.evaluate(async () => {
    const g = window.__refs.stage;
    const a = g.active;
    const r = a.irene.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    /* the cut's OWN spill, decoded here so the number is the shipped bytes' */
    const img = new Image();
    img.src = 'assets/actor/irene-street.png';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let hardMax = 0, hardOver = 0, hardN = 0, solidOver = 0;
    for (let i = 0; i < d.length; i += 4) {
      const al = d[i + 3] / 255;
      const ex = (d[i] + d[i + 2]) / 2 - d[i + 1];
      if (al >= 0.02 && al < 0.92) {           // the band matte.py's ceiling owns
        hardN++;
        if (ex > hardMax) hardMax = ex;
        if (ex > 20) hardOver++;
      } else if (al >= 0.98 && ex > 20) solidOver++;
    }
    return { box: { w: +(r.width * dpr).toFixed(1), h: +(r.height * dpr).toFixed(1) },
             rimOpacity: +(a.ireneRim.style.opacity || 0),
             rimBlur: a.ireneRim.style.filter,
             cut: { rimPx: hardN, rimMaxExcess: +hardMax.toFixed(1),
                    rimOverCeiling: hardOver, solidOverCeiling: solidOver } };
  });
  out.probes.reveal = rev;
  console.log('REVEAL  cut rim maxExcess=' + rev.cut.rimMaxExcess +
              ' overCeiling=' + rev.cut.rimOverCeiling +
              ' (solid, her crimson, left alone: ' + rev.cut.solidOverCeiling + ')' +
              '  rim opacity=' + rev.rimOpacity + ' ' + rev.rimBlur);

  /* ---- THE FINALE PORTRAIT (F14) ------------------------------------ */
  await go('thewoman');
  await T(0.85);
  await shot('room-thewoman');
  const fin = await page.evaluate(async () => {
    const img = new Image();
    img.src = 'assets/inset/photo-irene.jpg';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    /* THE FACE TEST: the sitter's head box, and how much of it is skin-pale
       against the sepia ground. A mannequin's head is one flat facet; a painted
       face is a spread of tones. Both numbers are reported. */
    const head = { x: 650, y: 150, w: 110, h: 110 };
    const d = g.getImageData(head.x, head.y, head.w, head.h).data;
    let n = 0, pale = 0, sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++; sum += l; sq += l * l;
      if (l > 120) pale++;
    }
    const mean = sum / n;
    return { head, paleFrac: +(pale / n).toFixed(3), meanLum: +mean.toFixed(1),
             sd: +Math.sqrt(sq / n - mean * mean).toFixed(1) };
  });
  out.probes.finale = fin;
  console.log('FINALE  head box paleFrac=' + fin.paleFrac + ' meanLum=' + fin.meanLum +
              ' sd=' + fin.sd);

  out.errors = errs;
  if (errs.length) console.log('ERRORS ' + JSON.stringify(errs.slice(0, 6)));
  fs.writeFileSync(path.join(OUT, 'probe-cf.json'), JSON.stringify(out, null, 1));
  console.log('wrote ' + path.join(OUT, 'probe-cf.json'));
  await browser.close();
  srv.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
