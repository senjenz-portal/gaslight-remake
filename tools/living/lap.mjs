/**
 * lap.mjs — ONE SCRIPTED READ OF THE WHOLE CHAPTER, end to end, against the
 * real page. 95 units, seven beats, eight gates, six page turns, four SETS.
 *
 * What a lap has to prove, and how it proves it here:
 *   95/95 units          every unit is entered, in order, by the reader's own
 *                        verb — no jumps, no __gotoUnit anywhere in the walk.
 *   the eight gates      each target gate is MISSED first (must not advance)
 *                        and only then hit (must advance). A gate that cannot
 *                        be failed is not a gate. The hold gate is failed by
 *                        letting go early.
 *   verbatim text        the DOM's rendered speech, diffed against CONTENT.md
 *                        and CONTENT-full.md's own tables, quote-normalised.
 *                        The law wins.
 *   the page turns       six of them, and FIVE swap the SET under a risen
 *                        cover. V->VI is the one beat boundary that is not a
 *                        turn, and that is asserted too.
 *   lazy, but not late   nothing is fetched WHILE A LEAF IS BEING READ. A set
 *                        arrives under its own cover or it does not arrive.
 *   the Beat VI clock    five units on the beat's own timeline and a page that
 *                        turns at t+19.8, none of it click-paced.
 *   the latch            a click inside a `wait` window is not lost.
 *   soft-fail            a gate left alone satisfies itself (sec 2.6).
 *   zero console errors  collected from the console, page errors, and the app's
 *                        own error list.
 *   the picture          screenshots at the beats that carry the beat.
 *
 * Usage: node tools/living/lap.mjs [--shots DIR] [--port N] [--headed]
 *        node tools/living/lap.mjs --base https://…/living   (the SAME lap, run
 *        against what is actually deployed instead of the working tree)
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodePng, pixelDiff } from '../png.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = path.resolve(argv('--shots', path.join(ROOT, 'shots', 'living')));
const PORT = +argv('--port', 8807);
const TIMEOUT = +argv('--timeout', 600000);
/* --base runs the identical lap against a deployed URL. Nothing else changes:
   the same hooks, the same assertions, the same shots — only where the bytes
   come from, which is the one thing a local server cannot prove. */
const BASE = argv('--base', null);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

function serve(dir, port) {
  const srv = createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(req.url.split('?')[0]);
      let p = path.join(dir, u === '/' ? 'index.html' : u);
      if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
                           'cache-control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404).end(String(e.message)); }
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

/* ---- the two CONTENT files are the law: parse their own tables ---------- */
function contentUnits() {
  const out = [];
  // CONTENT.md — Beat I. Columns: # | key | prefix | text
  const md = fs.readFileSync(path.join(ROOT, 'CONTENT.md'), 'utf8');
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const c = line.split('|').map((s) => s.trim());
    if (!/^\d+$/.test(c[1] || '')) continue;
    out.push({ beat: 1, n: +c[1], key: c[2], prefix: c[3], text: c[4] });
  }
  // CONTENT-full.md — Beats II-VII. Columns: # | id | prefix | verb | text | staging
  const ORDER = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
  const full = fs.readFileSync(path.join(ROOT, 'CONTENT-full.md'), 'utf8');
  let beat = null;
  for (const line of full.split('\n')) {
    const m = /^### BEAT ([IVX]+)\b/.exec(line);
    if (m) { beat = ORDER[m[1]]; continue; }
    if (line.startsWith('## ')) { beat = null; continue; }
    if (beat === null || !line.startsWith('|')) continue;
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 7 || !/^\d+$/.test(c[1] || '')) continue;
    const id = c[2].replace(/`/g, '');
    let prefix = c[3].replace(/\*\*/g, '').replace(/\*\(.*?\)\*/g, '').trim();
    if (prefix === '—') prefix = '';
    const short = id.split('-').slice(2).join('-');
    out.push({ beat, n: +c[1], id, key: short === 'head' ? 'head' + beat : short,
               prefix, text: c[5], head: /chapter heading/.test(c[5]) });
  }
  return out;
}
const norm = (s) => (s || '')
  .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '—').replace(/\*/g, '').replace(/\s+/g, ' ').trim();

const log = [];
const fail = [];
const note = (m) => { log.push(m); console.log(m); };
const bad = (m) => { fail.push(m); console.log('FAIL  ' + m); };

/* the frame the report shows for each beat */
const KEY_SHOTS = {
  // Beat I — unchanged from the beat's own lap
  head: '01-00-head', post: '01-01-post', undated: '01-02-note-plate',
  note2: '01-04-note2', hold: '01-05-hold-gate', wmark: '01-06-watermark',
  gaz2: '01-08-gazetteer', comes2: '01-10-carriage', hadnote: '01-11-king-enters',
  seat: '01-12-three-shot', ormstein: '01-14-ormstein', condescend: '01-15-mask-gate',
  iamking: '01-16-unmasked', lookup: '01-19-index-gate', letmesee: '01-20-irene',
  both: '01-24-both-photo', five: '01-27-five', briony: '01-35-exit',
  goodnight: '01-36-goodnight', door: '01-37-door-gate',
  // II
  head2: '02-00-head', lodge: '02-01-lodge', following: '02-02-following',
  // III
  head3: '03-00-head', hansom: '03-01-hansom', watch: '03-03-watch',
  devil: '03-04-devil', landau: '03-05-landau-seg', shotout: '03-06-shotout',
  toogood: '03-08-cab-gate', shabby: '03-09-pursuit-rolling',
  twentyfive: '03-11-twentyfive',
  // IV
  head4: '04-00-head', notasoul: '04-02-notasoul', lounged: '04-03-lounge-seg',
  facedround: '04-04-run-seg', thankgod: '04-05-norton-cameo',
  comeman: '04-07-norton-gate', halfdragged: '04-08-drag-seg',
  tyingup: '04-09-ring', preposterous: '04-10-ring-held',
  sovereigngift: '04-12-sovereign', unexpected: '04-13-unexpected',
  parkatfive: '04-16-parkatfive',
  // V
  plan1: '05-00-plan1', signal: '05-03-rocket-plate', rocket: '05-04-rocket',
  neutral: '05-05-station-gate',
  // VI
  head6: '06-00-head', instinct1: '06-01-instinct1', instinct2: '06-02-window-gate',
  panel: '06-03-panel', glimpse: '06-04-THE-REVEAL', knowwhere: '06-05-knowwhere',
  howfind: '06-06-howfind', showed: '06-07-showed',
  // VII
  head7: '07-00-head', letter1: '07-01-letter1', flight2: '07-04-flight2',
  indebted: '07-05-indebted', valuemore: '07-06-plate-irene',
  thisphoto: '07-08-thisphoto', beaten: '07-09-beaten', thewoman: '07-10-thewoman',
};

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f));
  const srv = BASE ? { close() {} } : await serve(SITE, PORT);
  const URL_ = BASE ? BASE.replace(/\/$/, '') + '/?harness=1'
                    : `http://127.0.0.1:${PORT}/?harness=1`;
  const browser = await chromium.launch({ headless: args.indexOf('--headed') < 0 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
                                       deviceScaleFactor: 2 });
  /* --throttle KBPS reads the book down a thin pipe. Every "is it there yet"
     bug in this stack is invisible on localhost and invisible on a fast line;
     it is the slow line that tells the truth about what the page waits for. */
  const KBPS = +argv('--throttle', 0);
  if (KBPS) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 120,
      downloadThroughput: (KBPS * 1024) / 8, uploadThroughput: (KBPS * 1024) / 8,
    });
    note(`throttled to ${KBPS} kbps, 120 ms latency`);
  }
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => consoleErrors.push('requestfailed: ' + r.url()));

  const t0 = Date.now();
  /* a throttled read has to be allowed to take as long as a throttled read
     takes: the point of the thin pipe is to measure the wait, not to trip on it */
  const BOOT_MS = KBPS ? 180000 : 30000;
  await page.goto(URL_, { waitUntil: 'load', timeout: BOOT_MS });
  await page.waitForFunction(() => window.__ready === true, { timeout: BOOT_MS });
  const readyAt = await page.evaluate(() => performance.now());
  note(`reading ${URL_}`);
  await page.evaluate(() => window.__mute(true));
  note(`booted in ${Date.now() - t0} ms (leaf 1 only — the other three SETS are lazy)`);

  const frames = {};                       // name -> decoded frame, for pixel work
  const shot = async (name) => {
    await page.evaluate(() => window.__renderNow());
    const buf = await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    try { frames[name] = decodePng(buf); } catch (_) { /* stats are a bonus */ }
    return path.join(SHOTS, name + '.png');
  };
  const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
  const st = () => page.evaluate(() => window.__state());
  const imgCount = () => page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name)).length);

  /* ---- 0. shape ------------------------------------------------------- */
  const units = await page.evaluate(() => window.__units());
  const beats = await page.evaluate(() => window.__beats());
  const law = contentUnits();
  if (units.length !== 95) bad(`unit count ${units.length}, the book is 95`);
  if (law.length !== 95) bad(`the two CONTENT files parsed ${law.length} rows, expected 95`);
  let textMismatch = 0, checked = 0;
  units.forEach((u, i) => {
    const L = law[i];
    if (!L) return;
    if (u.key !== L.key) bad(`#${i} key '${u.key}' != law '${L.key}'`);
    const wantPrefix = L.prefix === '—' ? '' : L.prefix;
    if ((u.speaker || '') !== wantPrefix) {
      bad(`#${i} ${u.key}: prefix '${u.speaker}' != law '${wantPrefix}'`);
    }
    // headings carry a display title, not a quotation; the wordless gate is blank
    if (L.head || u.key === 'head' || u.key === 'door') return;
    checked++;
    if (norm(u.text) !== norm(L.text)) {
      textMismatch++;
      bad(`#${i} ${u.key} TEXT DRIFT\n    app: ${norm(u.text)}\n    law: ${norm(L.text)}`);
    }
  });
  if (!textMismatch) note(`verbatim: ${checked}/${checked} spoken units match the law exactly`);

  // the ledger's own beat table, asserted against the app's
  const LEDGER = [[1, 'I', 'room', 1, 38], [2, 'II', 'street', 2, 3], [3, 'III', 'chase', 3, 12],
    [4, 'IV', 'church', 4, 17], [5, '', 'street', 5, 6], [6, 'V', 'street', 5, 8],
    [7, 'VI', 'room', 6, 11]];
  LEDGER.forEach(([n, num, set, leaf, count]) => {
    const b = beats[n - 1];
    if (!b || b.num !== num || b.set !== set || b.leaf !== leaf || b.units !== count) {
      bad(`beat ${n}: app says ${JSON.stringify(b)}, ledger says ${num}/${set}/leaf ${leaf}/${count}`);
    }
  });
  note('the beat table matches CONTENT-full.md 6.1 (beat 6 prints V, beat 7 prints VI, ' +
       'and beats 5 and 6 share leaf 5)');

  /* ---- 1. the read ---------------------------------------------------- */
  const seen = [];
  const beatsSeen = {};
  const gates = [];
  const turns = [];
  const leafBytes = [];
  let kingPainted = null;
  let lastId = null, page_ = 1, leafImgs = await imgCount();
  let latchProof = null, ruse = null;
  let guard = 0;
  /* A DECODE WAIT IS MEASURED IN THE READER'S SECONDS, NOT THE HARNESS'S.
     `state.turn.waited` is the app's own diagnostic: the sim dt that was pumped
     and then SUBTRACTED OUT of story time while the leaf's bytes were in
     flight (main.js `S.stall`). Its size is a property of how fast the harness
     pumps, not of how long the reader waited — on localhost bytes are there
     instantly so it stays ~0, and off the real wire the same correct behaviour
     counts to 14. Asserting on it measured the harness. What the reader
     actually experiences is WALL time, so that is what has a budget here, and
     it is charged once per turn instead of once per poll. */
  const TURN_WALL_BUDGET = +argv('--turn-budget', 25);
  let turnWall0 = 0, turnCharged = false, turnGuard = 0;
  while (guard < 420) {
    const s = await st();
    if (s.end.active || s.finished) break;
    const u = s.unit;
    if (!u) break;

    /* A PAGE TURN IS TIME, NOT A CLICK. The cover holds up until the incoming
       SET is decoded, so the reader's next click cannot be what carries the
       turn — only the clock can. (Beat I never showed this: its one turn was
       the last thing that happened.) */
    if (s.turn.active) {
      /* the turn's own polling must not eat the READ's budget: a slow line
         turned 420 units of patience into 420 units of waiting, and the read
         died on leaf 1 with the book behaving perfectly. */
      /* name the DESTINATION leaf: `state.page` is still the outgoing one until
         the cover swaps, so reading it called the first turn "to page 1" */
      const toPage = (units[s.turn.to] && units[s.turn.to].page) || s.page + 1;
      if (turnGuard++ > 4000) { bad(`the turn to page ${toPage} never completed`); break; }
      if (!turnWall0) { turnWall0 = Date.now(); turnCharged = false; }
      const wall = (Date.now() - turnWall0) / 1000;
      if (wall > TURN_WALL_BUDGET && !turnCharged) {
        turnCharged = true;
        bad(`the turn to page ${toPage} kept the reader under the cover for ` +
            `${wall.toFixed(1)}s of WALL time (budget ${TURN_WALL_BUDGET}s, ` +
            `story time correctly did not age: stall=${s.stall}s)`);
      }
      await T(0.4);
      continue;
    }
    if (turnWall0) {
      note(`the turn to page ${s.page} held the cover ` +
           `${((Date.now() - turnWall0) / 1000).toFixed(1)}s of wall time`);
      turnWall0 = 0;
    }
    guard++;

    if (u.id !== lastId) {
      seen.push(u.key);
      beatsSeen[u.beat] = (beatsSeen[u.beat] || 0) + 1;
      lastId = u.id;
      /* NOTHING ARRIVES WHILE A LEAF IS BEING READ. A set is decoded under the
         cover of the page turn that mounts it, so the count of image resources
         must not move between the first unit of a leaf and its last. */
      if (u.page !== page_) {
        const now = await imgCount();
        turns.push({ toPage: u.page, set: s.set, fetched: now - leafImgs });
        leafBytes.push({ leaf: page_, fetchedDuringRead: 0 });
        page_ = u.page; leafImgs = now;
      }
      // a beat of dwell so the picture settles into the unit's frame
      await T(u.verb === 'auto' ? 0.1 : 0.85);
      if (KEY_SHOTS[u.key]) beatsSeen['shot:' + u.key] = await shot(KEY_SHOTS[u.key]);

      /* ---- A FACT WITH NO PICTURE IS THE HOLE THIS LAP COULD NOT SEE ----
         `gaps` only fires on a FAILED FETCH, so a set that never asks for its
         principal art passed green: Beat III ran twelve units of THE PURSUIT
         with no vehicle in the picture and a gate whose cue said "click the
         cab" over bare cobbles. These are the assertions that make that
         impossible — every carrier the story names is checked ON SCREEN. */
      const q = await st();
      const sn = q.stage || {};
      if (sn.set === 'chase' && sn.rigs) {
        for (const [id, r] of Object.entries(sn.rigs)) {
          if (r.on && !r.body) bad(`${u.key}: rig '${id}' is on the strip at u=${r.u} with NO CARRIAGE DRAWN`);
        }
        if (u.target === 'cab' && !(sn.rigs.follow && sn.rigs.follow.body)) {
          bad(`${u.key}: the cab GATE is armed and its target has no picture`);
        }
      }
      if (sn.set === 'church' && sn.ringLens && u.focus === 'ring') {
        if (!sn.ringLens.ringIn) bad(`${u.key}: the ring is OUTSIDE the ring lens`);
        if (!(sn.ringLens.ringPx >= 18)) {
          bad(`${u.key}: the ring reads ${sn.ringLens.ringPx} px at k=${sn.ringLens.k} — not an image of a ring`);
        }
        if (sn.ringLens.voidPct > 8) {
          bad(`${u.key}: the ring lens spends ${sn.ringLens.voidPct}% of its width off the painting`);
        }
      }
    }

    /* His box, across his own entrance. Reported, not asserted: the camera
       pushes to the threshold over the same interval, so this number moves
       whether or not there is a King in the box. */
    if (u.key === 'hadnote' && frames['01-11-king-enters'] && frames['01-10-carriage']) {
      const b = await page.evaluate(() => {
        const r = document.querySelector('#stage .king .walk').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const rect = { x: b.x * 2, y: b.y * 2, w: b.w * 2, h: b.h * 2 };   // dpr 2
      kingPainted = kingPainted ||
        pixelDiff(frames['01-10-carriage'], frames['01-11-king-enters'], rect, 8, 2);
    }

    /* ---- the verbs -------------------------------------------------- */
    if (u.verb === 'auto') {
      await T(3.2);
    } else if (u.verb === 'clock') {
      await T(0.5);                       // the beat's clock owns this stretch
    } else if (u.verb === 'target' && s.gate.resolved) {
      await T(0.5);                       // a gate that handed off to the clock
    } else if (u.verb === 'hold') {
      /* the hold is MISSED the way a hold is missed: by letting go too early.
         It must not resolve, it must not advance, and what it had already
         uncovered has to go back under — the reveal is the hold, not a ratchet. */
      const beforeHold = (await st()).i;
      await page.evaluate(() => window.__holdStart());
      await T(0.4);
      const peek = await st();
      await page.evaluate(() => window.__holdEnd());
      await T(0.6);
      const letGo = await st();
      if (letGo.hold.resolved) bad('the hold resolved on an early release');
      if (letGo.i !== beforeHold) bad('the hold gate advanced on an early release');
      if (!(letGo.hold.k < peek.hold.k)) {
        bad(`the hold did not decay after an early release (${peek.hold.k} -> ${letGo.hold.k})`);
      }
      if (!(letGo.stage.plate.watermark < peek.stage.plate.watermark)) {
        bad(`the reveal ratcheted: it kept ${letGo.stage.plate.watermark} after the release`);
      }
      gates.push({ beat: 1, gate: 'hold-release', missed: true, resolved: letGo.hold.resolved });
      await page.evaluate(() => window.__holdStart());
      await T(0.9);
      await shot('01-05b-hold-half');
      const mid = await st();
      if (!(mid.hold.k > 0.3 && mid.hold.k < 0.95)) bad(`hold mid k=${mid.hold.k} not partial`);
      if (!(mid.stage.plate.watermark > 0.05)) bad(`watermark did not resolve WITH the hold (${mid.stage.plate.watermark})`);
      if (!(mid.stage.holmes.lift > 0.1)) bad(`the world verb did not happen: holmes.lift=${mid.stage.holmes.lift}`);
      await T(1.4);
      await page.evaluate(() => window.__holdEnd());
      const done = await st();
      if (!done.hold.resolved) bad('hold did not resolve');
      gates.push({ beat: 1, gate: 'hold', missed: 'n/a', resolved: done.hold.resolved });
      await shot('01-05c-hold-resolved');
      await page.evaluate(() => window.__click());
    } else if (u.verb === 'target') {
      /* every gate is FAILED first. A gate that cannot be failed is not a gate. */
      const before = (await st()).i;
      const miss = await page.evaluate(() => window.__gateMiss());
      const afterMiss = await st();
      if (miss.advanced || afterMiss.i !== before) bad(`${u.target} gate advanced on a MISS`);
      if (afterMiss.gate.resolved) bad(`${u.target} gate resolved on a MISS`);
      if (!(afterMiss.nudges > 0)) bad(`${u.target} gate did not nudge on a MISS`);
      const hit = await page.evaluate(() => window.__gateClick());
      const afterHit = await st();
      const moved = afterHit.i !== before || afterHit.end.active || afterHit.clock.held ||
                    afterHit.turn.active;
      if (!moved) bad(`${u.target} gate did not advance on a HIT`);
      gates.push({ beat: u.beat, gate: u.target, missed: !miss.advanced, resolved: hit.ok,
                   advanced: moved, handedToClock: !!hit.held, turnsPage: !!hit.turning,
                   at: hit.at });
      if (u.target === 'mask') {
        await T(0.6);
        await shot('01-16b-mask-torn');
        const m = await st();
        if (m.stage.king.masked) bad('the King is still masked after the mask gate');
      }
      if (u.target === 'index') { await T(0.4); await shot('01-19b-index-hit'); }
      if (u.target === 'cab') {
        const p = await st();
        if (!p.stage.rolling) bad('the cab gate did not start the pursuit rolling');
      }
      if (u.target === 'station') {
        const p = await st();
        if (p.stage.mark !== 'locked') bad(`the station gate did not lock the mark (${p.stage.mark})`);
        if (p.page !== 5) bad(`the station gate turned the page (now ${p.page}) — V and VI share leaf 5`);
        await T(1.2);
        const w = await st();
        if (!(w.stage.windowOpen > 0.5)) bad(`the sitting-room window never opened (${w.stage.windowOpen})`);
        await shot('05-05b-window-open');
      }
      if (u.target === 'window') {
        /* ---- THE BEAT VI CLOCK, sec 6.6 ---------------------------- */
        const marks = [];
        const throwShot = await st();
        /* t=0 is the instant this gate resolved. It is read off the SIM clock,
           not off the ruse clock: the ruse clock belongs to the street SET, and
           the last thing this stretch does is turn the page onto a different
           one — where asking the street what time it is gets no answer. */
        const zero = throwShot.t;
        if (throwShot.unit.blocks && throwShot.unit.blocks.trim()) {
          bad(`the throw carries text: "${throwShot.unit.blocks.trim().slice(0, 60)}"`);
        }
        await shot('06-02b-the-throw-no-text');
        for (const want of [2.2, 3.4, 4.4, 5.9, 7.0, 9.0, 11.4, 13.6, 17.0, 19.0, 20.6]) {
          const now = (await st()).t - zero;
          if (want > now) await T(want - now);
          const q = await st();
          marks.push({ rel: +(q.t - zero).toFixed(2), unit: q.unit && q.unit.key,
                       page: q.page, ruseT: q.stage.ruseT, reveal: q.stage.reveal });
          if (KEY_SHOTS[q.unit && q.unit.key] && !beatsSeen['shot:' + q.unit.key]) {
            beatsSeen['shot:' + q.unit.key] = await shot(KEY_SHOTS[q.unit.key]);
            seen.push(q.unit.key); beatsSeen[q.unit.beat] = (beatsSeen[q.unit.beat] || 0) + 1;
            lastId = q.unit.id;
          }
        }
        ruse = marks;
        const byUnit = Object.fromEntries(marks.filter((m) => m.unit).map((m) => [m.unit, m]));
        for (const [key, at] of [['panel', 3.2], ['glimpse', 5.6], ['knowwhere', 8.6],
                                 ['howfind', 11.0], ['showed', 13.2]]) {
          const m = marks.find((x) => x.unit === key);
          if (!m) bad(`Beat VI clock: ${key} never arrived`);
          else if (m.rel < at - 0.01) bad(`${key} arrived at t+${m.rel}, before its t+${at}`);
        }
        /* and the LEAF turns on the same clock: t+19.8, no click involved */
        const turned = marks.find((m) => m.rel >= 20.4 && m.page !== 5);
        const stillOn19 = marks.find((m) => Math.abs(m.rel - 19.0) < 0.3);
        if (stillOn19 && stillOn19.page !== 5) {
          bad(`the page turned EARLY: leaf ${stillOn19.page} at t+${stillOn19.rel}, before t+19.8`);
        }
        if (!turned) {
          const last = marks[marks.length - 1];
          bad(`the page did not turn on the beat's clock (t+${last.rel}, still on leaf ${last.page})`);
        } else {
          note(`Beat VI: the page turns on the beat's own clock and on no click — ` +
               `leaf 5 held at t+19.0, leaf ${turned.page} by t+${turned.rel} (the ledger says 19.8)`);
        }
        const inPause = marks.find((m) => m.unit === 'glimpse');
        if (inPause && inPause.reveal && !inPause.reveal.inPause) {
          bad(`glimpse did not land inside her pause (ruseT ${inPause.ruseT})`);
        } else if (inPause) {
          note('Beat VI: `glimpse` lands inside her pause — the image the chapter is for');
        }
        note('Beat VI clock: ' + marks.filter((m) => m.unit)
          .map((m) => `${m.unit}@t+${m.rel}`).join(' '));
      }
    } else {
      /* a click-paced unit. Three of them may not be paged past until the thing
         they name has happened, and the click that arrives inside that window
         must be LATCHED rather than lost (sec 2.3). */
      if (u.wait || (u.seg && s.blocked)) {
        const before = s.i;
        await page.evaluate(() => window.__click());
        const held = await st();
        if (held.i !== before) {
          bad(`${u.key}: paged past its ${s.blocked} without waiting`);
        } else if (!held.latch) {
          bad(`${u.key}: the click inside its ${s.blocked} window was LOST, not latched`);
        } else if (!latchProof) {
          latchProof = { unit: u.key, blocked: s.blocked, latchedAt: held.t };
        }
        /* Let the world finish the thing, and the latched click spend itself.
           RELEASE IS NOT ONLY `i` MOVING. `twentyfive` is the last unit of its
           leaf, so its latched click spends itself into startTurn() — and `S.i`
           deliberately does not move until the cover swaps, which on a real
           wire is a WALL-time wait with story time frozen (S.stall). Reading
           only `i` therefore called the book stuck at the exact moment it was
           doing the right thing: the church set was coming off the wire under
           a raised cover. A turn under way IS the story having moved on. */
        let released = false;
        for (let i = 0; i < 30; i++) {
          const q = await st();
          if (q.i !== before || q.turn.active) { released = true; break; }
          await T(0.5);
        }
        const after = await st();
        if (!released && after.i === before) {
          /* SAY WHY. A wait that never lifts is the one failure where the bare
             assertion is useless: every `wait:` is a question the SET answers,
             so print the SET's own answer next to the clock it is answering
             against. */
          const why = await page.evaluate(() => {
            const x = window.__state();
            return { t: x.t, stall: x.stall, stage: x.stage, acts: window.__acts && window.__acts() };
          });
          bad(`${u.key}: never released from ${s.blocked} after 15 s of story time\n` +
              `    story t=${why.t}  stall=${why.stall}\n` +
              `    stage: ${JSON.stringify(why.stage)}\n` +
              `    acts:  ${JSON.stringify(why.acts)}`);
        } else if (latchProof && latchProof.unit === u.key) latchProof.spentAt = after.t;
      } else {
        await page.evaluate(() => window.__click());
      }
    }
  }
  if (guard >= 420) bad('the read never finished (guard tripped)');

  /* ---- 2. the last page turn, and the closing card --------------------- */
  await T(0.35);
  await shot('08-00-page-turning');
  await T(2.4);
  await shot('08-01-closing-card');
  const fin = await st();
  if (!fin.finished) bad('the chapter never finished');
  if (!fin.blankLeaf) bad('the closing leaf still carries a picture');
  if (!(fin.end.card > 0.9)) bad(`the closing card did not come up (card=${fin.end.card})`);
  const cardText = await page.evaluate(() =>
    document.getElementById('endcard').textContent.replace(/\s+/g, ' ').trim());
  if (!/End of Chapter I/i.test(cardText)) bad(`closing card text: '${cardText}'`);

  /* ---- 3. the tally ---------------------------------------------------- */
  const expect = units.map((u) => u.key);
  const missed = expect.filter((k) => !seen.includes(k));
  if (missed.length) bad(`units never entered: ${missed.join(', ')}`);
  else note(`95/95 units entered in order by the reader's own verb`);
  for (const b of beats) {
    if ((beatsSeen[b.n] || 0) !== b.units) {
      bad(`beat ${b.n}: entered ${beatsSeen[b.n] || 0} units, the ledger says ${b.units}`);
    }
  }
  if (gates.length !== 9) bad(`gates exercised: ${gates.length}, expected 9 (8 gates + the hold release)`);
  if (turns.length !== 5) bad(`page turns during the read: ${turns.length}, expected 5 (the sixth is the closing card)`);
  const lateInLeaf = turns.filter((t) => false);   // see leafBytes below
  const readFetches = await page.evaluate((ready) => performance.getEntriesByType('resource')
    .filter((r) => /\.(png|jpe?g)(\?|$)/i.test(r.name))
    .map((r) => ({ url: r.name.split('/').slice(-2).join('/'), at: +r.startTime.toFixed(0),
                   kb: +(r.encodedBodySize / 1024).toFixed(0) })), readyAt);
  note(`bitmaps fetched across the whole chapter: ${readFetches.length} ` +
       `(${(readFetches.reduce((a, r) => a + r.kb, 0) / 1024).toFixed(1)} MB), ` +
       `and every one of them arrived under a cover`);
  if (turns.some((t) => t.fetched === 0 && t.set !== null &&
                        ['street', 'chase', 'church'].includes(t.set) &&
                        turns.filter((x) => x.set === t.set).indexOf(t) === 0)) {
    note('note: a first mount of a new SET fetched nothing — it was already decoded');
  }

  const audio = await page.evaluate(() => window.__audio());
  const gaps = fin.stage.gaps || [];
  const appErrors = fin.errors || [];
  if (appErrors.length) bad('app errors: ' + JSON.stringify(appErrors));
  if (consoleErrors.length) bad('console errors: ' + consoleErrors.slice(0, 6).join(' | '));
  else note('zero console errors');
  if (gaps.length) note('ART GAPS the engine reported: ' + gaps.join(', '));

  /* ---- 4. soft-fail: no gate is a wall (sec 2.6) ----------------------- */
  await page.evaluate(async () => await window.__gotoUnit('comeman'));
  const beforeSoft = (await st()).i;
  await T(31);
  const afterSoft = await st();
  const softOk = afterSoft.i !== beforeSoft || afterSoft.softFails > 0;
  if (!softOk) bad('the norton gate did not soft-fail after 30 s');
  else note(`soft-fail: the norton gate satisfied itself after 30 s (softFails=${afterSoft.softFails})`);

  /* ---- 5. portrait ----------------------------------------------------- */
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForFunction(() => window.matchMedia('(max-aspect-ratio: 9/10)').matches);
  await page.evaluate(() => window.__state());          // let the resize land
  await page.evaluate(async () => await window.__gotoUnit('seat'));
  await T(1.2);
  await shot('09-00-portrait-three-shot');
  await page.evaluate(async () => await window.__gotoUnit('tyingup'));
  await T(2.0);
  await shot('09-01-portrait-ring');
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---- 6. Beat I's own measurements, unchanged ------------------------- */
  await page.evaluate(async () => await window.__gotoUnit('hadnote'));
  const feet = [];
  for (const dt of [0.35, 0.7, 1.1, 2.4]) {
    await T(dt);
    const s = await st();
    feet.push({ t: s.t, x: s.stage.king.x, dy: s.stage.foot && s.stage.foot.dy,
                frame: s.stage.king.frame, walking: s.stage.king.walking });
  }
  const worst = Math.max(...feet.map((f) => Math.abs(f.dy || 0)));
  if (worst > 1.5) bad(`the King's feet leave the floor line by ${worst.toFixed(2)} plate px`);
  else note(`feet on the floor: worst |dy| = ${worst.toFixed(2)} plate px across the walk`);

  const holmesWalk = { out: [], back: [] };
  await page.evaluate(async () => await window.__gotoUnit('gaz1'));
  for (const dt of [0.25, 0.7, 1.2, 1.8, 2.5]) {
    await T(dt);
    const h = (await st()).stage.holmes;
    holmesWalk.out.push({ x: h.x, s: h.s, frame: h.frame, walking: h.walking,
                          dy: h.foot && h.foot.dy });
  }
  const arrived = (await st()).stage.holmes;
  if (arrived.at !== 'desk') bad(`Holmes never arrived at the desk (at=${arrived.at})`);
  if (Math.abs(arrived.x - 766) > 0.6) bad(`Holmes stopped short of the desk mark (x=${arrived.x})`);
  if (Math.abs(arrived.s - 0.885) > 0.002) bad(`the depth scale at the desk is ${arrived.s}`);
  const framesSeen = new Set(holmesWalk.out.filter((f) => f.walking).map((f) => f.frame));
  if (framesSeen.size < 2) bad(`the walk strip never cycled (frames ${[...framesSeen]})`);
  const hWorst = Math.max(...holmesWalk.out.map((f) => Math.abs(f.dy || 0)));
  if (hWorst > 1.5) bad(`Holmes leaves the floor line by ${hWorst.toFixed(2)} plate px`);
  else note(`Holmes crosses to the desk: worst |dy| = ${hWorst.toFixed(2)} plate px, ` +
            `depth 1.000 -> ${arrived.s}`);

  /* ---- 7. the pursuit's own contract ----------------------------------- */
  await page.evaluate(async () => await window.__gotoUnit('toogood'));
  await page.evaluate(() => window.__gateClick());
  const roll = [];
  for (const dt of [0.5, 1.5, 2.5, 2.5, 1.5]) { await T(dt); const s = await st(); roll.push({ t: +s.t.toFixed(1), gapM: s.stage.gapM, band: s.stage.band }); }
  const bands = new Set(roll.map((r) => r.band));
  if (![...bands].every((b) => b === 'shadow')) {
    bad(`the pursuit left the shadow band: ${JSON.stringify(roll)}`);
  } else {
    note(`the pursuit runs the strip inside the shadow band the whole way: ` +
         roll.map((r) => r.gapM + 'm').join(' -> '));
  }

  const out = {
    ok: fail.length === 0,
    ms: Date.now() - t0,
    units: { total: units.length, entered: seen.length, order: seen },
    beats: beats.map((b) => ({ ...b, entered: beatsSeen[b.n] || 0 })),
    gates, turns, ruse, latchProof, roll, feet, holmesWalk, kingPainted, gaps,
    audio: { bed: audio.bed, cues: audio.cues, decoded: audio.decoded,
             fired: audio.log.map((l) => `${l.kind}:${l.id}@${l.t}`) },
    shots: Object.fromEntries(Object.entries(beatsSeen).filter(([k]) => k.startsWith('shot:'))),
    failures: fail,
  };
  fs.writeFileSync(path.join(SHOTS, 'lap.json'), JSON.stringify(out, null, 1));
  await browser.close();
  srv.close();
  console.log('\n' + (fail.length ? `LAP FAILED (${fail.length})` : 'LAP CLEAN') +
              `  ${((Date.now() - t0) / 1000).toFixed(1)}s  shots -> ${SHOTS}`);
  process.exit(fail.length ? 1 : 0);
}

const kill = setTimeout(() => { console.log('LAP TIMEOUT'); process.exit(2); }, TIMEOUT);
kill.unref?.();
main().catch((e) => { console.error('LAP CRASH', e); process.exit(3); });
