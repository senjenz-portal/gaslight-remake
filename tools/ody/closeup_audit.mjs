/**
 * closeup_audit.mjs — THE CLOSE-UP LAW's audit table (owner feedback
 * 2026-08-17: "scene large, character small = worse, hard to see").
 *
 * Classifies every unit by the CONTRACT's staging column (CONTENT-odyssey.md)
 * and measures the principal's drawn height against the panel at the unit's
 * own lens:   fraction = drawnH(plate px, incl. sea world scale) * k / 768.
 *
 * CLASS FLOORS (the law):
 *   C  character act/speech, dialogue/action close  >= 30% of panel height
 *   T  two-shot (two subjects share the frame)      >= 22%
 *   E  heading / arrival / establishing / object / environment — exempt,
 *      but a beat may spend at most 2 units WIDE (k < 1.7) after its heading.
 *
 * Usage: node tools/ody/closeup_audit.mjs [--proposed]
 */
import { UNITS } from '../../site-deploy/living-odyssey/app/units.js';

const PROPOSED = process.argv.includes('--proposed');

/* the sets' FOCUS tables — shipped values (transcribe of app/sets/*.js) */
const FOCUS_NOW = {
  shore: {
    establishing: [704, 384, 1.0], smoke: [980, 205, 1.9],
    council: [505, 470, 2.2], 'camp-fire': [430, 468, 2.4],
    'ship-mid': [560, 470, 3.0], 'skin-close': [560, 470, 4.5],
    'cavemouth-push-from': [850, 345, 1.6], 'cavemouth-push-to': [1008, 290, 2.6],
    'crag-tilt': [1050, 165, 2.4],
  },
  cave: {
    establishing: [704, 384, 1.0], 'racks-sweep': [700, 300, 2.0],
    'doorlight-hinge': [480, 400, 2.2], mouth: [345, 340, 2.4],
    'discovery-low': [900, 430, 1.8], 'eye-close': [745, 295, 3.6],
    twoshot: [700, 400, 2.6], 'meal-close': [780, 430, 2.8],
    sword: [740, 440, 3.2], 'scheme-push': [640, 470, 3.0],
    'club-wide': [880, 360, 1.6], 'lots-overhead': [600, 490, 3.0],
    'bowl-close': [690, 440, 3.4], 'face-flush': [710, 380, 4.0],
    'ember-close': [655, 450, 3.8], 'drive-tight': [644, 505, 3.4],
    'ram-close': [838, 425, 3.2], 'handpass-tight': [370, 400, 3.6],
    'doorway-twoshot': [370, 380, 3.0], 'freed-overshoulder': [430, 430, 2.0],
  },
  sea: {
    establishing: [704, 384, 1.0], 'gate-wide': [610, 325, 1.29],
    stern: [530, 430, 2.8], 'ship-deck': [575, 450, 2.6],
    clifftop: [870, 195, 2.8], curse: [870, 180, 2.2], strait: [585, 330, 2.0],
    homeward: [450, 570, 1.9], moonpath: [590, 340, 3.2],
  },
};

/* THE RECOMPOSE (what this audit proposes; --proposed re-runs against it) */
const FOCUS_NEW = {
  shore: {
    ...FOCUS_NOW.shore,
    'council-close': [545, 480, 8.6],    // i-07: the speech over the huddle
    'ship-mid':      [545, 488, 8.6],    // i-10: the twelve + the shouldered skin
  },
  cave: {
    ...FOCUS_NOW.cave,
    'racks-sweep':   [700, 315, 2.4],    // ii-01: sweep keeps racks, tableau reads
    'drive-tight':   [590, 490, 3.4],    // iv-03/04/05: the four bearing men +
                                          // the eye survive the portrait crop
    'scheme-push':   [770, 500, 3.2],    // iii-03: recentred ON the schemer
    collapse:        [770, 460, 2.2],    // iii-13: the fall composed, not wide
    'sprawl-groan':  [720, 480, 2.6],    // iv-08: the groaning bulk answers
    puzzling:        [638, 450, 1.75],   // v-01: the blocked mouth + the schemer
    'lash-close':    [950, 505, 3.2],    // v-02/03: hands, withies, fleece
    'freed-overshoulder': [430, 430, 2.35],
  },
  sea: {
    ...FOCUS_NOW.sea,
    stern:           [518, 415, 10.6],   // vi-02: the taunt thrown, full close
    'stern-rail':    [506, 400, 12.3],   // vi-07: the name given (world 0.86)
    'menbeg-close':  [545, 433, 14.1],   // vi-05: the rowers' faces up at him
    'defy-strait':   [640, 300, 2.25],   // vi-06: two-plane, giant at floor
    'hades-twoshot': [663, 315, 2.3],    // vi-10: contract's own two-shot
    clifftop:        [870, 195, 3.1],    // vi-08/09 at world 0.86
    curse:           [870, 180, 2.6],    // vi-11 at world 0.86
  },
};

/* per-unit focus overrides when --proposed (units.js focus field edits) */
const REFOCUS = {
  smoke: 'council', council: 'council-close',
  neck: 'collapse', nomankilling: 'sprawl-groan', puzzling: 'puzzling',
  withies: 'lash-close', threetoaman: 'lash-close',
  menbeg: 'menbeg-close', defy: 'defy-strait', hades: 'hades-twoshot',
  myname: 'stern-rail',
};

/* drawn principal heights, plate px (ledger actorHeightPx + set constants) */
const H = {
  shore: { ulysses: 20, crew: 19 },
  cave: { ulysses: 75, crew: 73, giantStand: 300, giantSeat: 165,
          giantClutch: 190, giantDrink: 175, giantSprawl: 104, giantGrope: 210,
          giantDoorway: 165, giantStroke: 190, ramGreat: 83, ramSlung: 84 },
  sea: { ulysses: 22, rower: 14, giant: 89, giantArms: 105, curse: 109 },
};
/* the sea's world stations at each unit's settle (sea.js WORLD) */
const SEA_WORLD = {
  jeer: 1.0, taunt: 1.0, rock1: 1.0, twiceasfar: 0.86, menbeg: 0.86,
  defy: 0.86, myname: 0.86, prophecy: 0.86, fatherson: 0.86, hades: 0.86,
  curse: 0.86, heard: 0.86, ram: 0.70, sailedon: 0.56,
};

/* THE CLASSIFICATION — read off the contract staging column, key -> class.
 * principal: which body carries the floor.  E rows name why they are exempt. */
const CLASS = {
  /* Beat I — shore */
  head1: ['E', 'heading'], bard: ['E', 'arrival — landfall wide (wide 1)'],
  iamulysses: ['E', 'the CAMEO CARD is this close (staging column); he wades in'],
  troy: ['E', 'camp embers bridge (composed)'],
  lawless: ['E', 'O.1 smoke establishing (composed)'],
  dawn1: ['E', 'day-state establishing (wide 2)'],
  smoke: ['E', 'feast/council gathering (composed)'],
  council: ['T', 'ulysses'], cave: ['E', 'arrival push (composed)'],
  monster: ['E', 'dread environment (composed)'],
  wineskin: ['T', 'ulysses'], twentyone: ['E', 'object close — the skin'],
  misgave: ['E', 'inset unit (O.2)'],
  /* Beat II — cave */
  head2: ['E', 'heading'], beg: ['T', 'crew'],
  present: ['E', 'doorway-light hinge (composed)'], return2: ['C', 'giantStand'],
  boulder: ['E', 'object — the stone (O.4)'], strangers: ['C', 'giantSeat'],
  plea: ['T', 'ulysses'], pitiless: ['T', 'giantSeat'],
  shipfast: ['T', 'giantSeat'], shiplie: ['T', 'ulysses'],
  firstmeal: ['C', 'giantClutch'], sword: ['C', 'ulysses'],
  shiftstone: ['E', 'the pan refuses — object (O.5)'],
  tillmorning: ['E', 'contract: widest of the beat (wide 1)'],
  /* Beat III — cave */
  head3: ['E', 'heading'], morningmeal: ['C', 'giantClutch'],
  quiverlid: ['E', 'the stone simile (composed)'], scheme: ['C', 'ulysses'],
  club: ['E', 'contract: figures tiny beside the club (wide 1)'],
  lots: ['T', 'crew'], return3: ['E', 'the overfull pens must read (wide 2)'],
  suppertwo: ['C', 'giantClutch'], lookhere: ['C', 'ulysses'],
  besokind: ['C', 'giantSeat'], thrice: ['C', 'ulysses'],
  noman: ['T', 'ulysses'], nomanlast: ['T', 'giantDrink'],
  neck: ['E', 'the collapse needs the fall (composed)'],
  /* Beat IV — cave */
  head4: ['E', 'heading'], embers: ['C', 'ulysses'], glowing: ['C', 'ulysses'],
  auger: ['C', 'crew'], bore: ['C', 'crew'], hiss: ['C', 'crew'],
  fright: ['E', 'scatter + lamplight gathers (composed)'],
  whatails: ['E', 'voice beyond the stone — no cyclops shown'],
  nomankilling: ['C', 'giantSprawl'],
  mustbeill: ['E', 'voice through the stone — seams'],
  wentaway: ['E', 'the receding lamps (O.10)'], stone: ['C', 'giantGrope'],
  doorway: ['C', 'giantDoorway'],
  /* Beat V — cave */
  head5: ['E', 'heading'], puzzling: ['T', 'giantDoorway'],
  withies: ['C', 'ulysses'],
  threetoaman: ['C', 'crew'], greatram: ['C', 'ramGreat'],
  dawn5: ['E', 'contract: lens wide, the light the goal (wide 1)'],
  feltbacks: ['C', 'giantStroke'], lastofall: ['T', 'giantDoorway'],
  ramspeech1: ['T', 'giantDoorway'], ramspeech2: ['T', 'giantDoorway'],
  ramspeech3: ['T', 'giantDoorway'], freed: ['T', 'ulysses'],
  aboard: ['E', 'run-to-ship seg rides the turn'],
  /* Beat VI — sea */
  jeer: ['E', 'heading rides it + G6 two-plane by contract'],
  taunt: ['C', 'ulysses'], rock1: ['E', 'the arc owns the frame (wide 1)'],
  twiceasfar: ['E', 'the doubled distance IS the subject'],
  menbeg: ['T', 'rower'], defy: ['T', 'giant'], myname: ['C', 'ulysses'],
  prophecy: ['C', 'giant'], fatherson: ['C', 'giant'], hades: ['T', 'giant'],
  curse: ['C', 'curse'], heard: ['E', 'rock 2 is the line\'s punctuation'],
  ram: ['E', 'the sacrifice tableau (composed)'],
  sailedon: ['E', 'departure — the moonpath frame (composed)'],
};

const FLOOR = { C: 0.30, T: 0.22 };
const FOCUS = PROPOSED ? FOCUS_NEW : FOCUS_NOW;
const rows = [];
const wides = {};   // beat -> [keys]
for (const u of UNITS) {
  const cls = CLASS[u.key];
  if (!cls) { console.log('NO CLASS: ' + u.key); continue; }
  const focusName = (PROPOSED && REFOCUS[u.key]) || u.focus;
  const f = FOCUS[u.set][focusName];
  if (!f) { console.log(`NO LENS ${u.set}/${focusName} (${u.key})`); continue; }
  const [, , k] = f;
  const world = u.set === 'sea' ? (SEA_WORLD[u.key] ?? 1) : 1;
  let row = { key: u.key, beat: u.beat, set: u.set, focus: focusName, k,
              cls: cls[0], who: cls[1] };
  if (cls[0] === 'E') {
    if (k < 1.7 && !u.head && !(u.key === 'jeer')) {
      (wides[u.beat] = wides[u.beat] || []).push(u.key + ` (k ${k})`);
      row.note = 'WIDE';
    }
  } else {
    const h = H[u.set][cls[1]] * world;
    row.frac = +(h * k / 768).toFixed(3);
    row.floor = FLOOR[cls[0]];
    row.needK = +(FLOOR[cls[0]] * 768 / h).toFixed(2);
    row.ok = row.frac >= FLOOR[cls[0]] - 1e-9;
  }
  rows.push(row);
}
let fails = 0;
for (const r of rows) {
  const s = r.frac !== undefined
    ? `${(r.frac * 100).toFixed(1)}% vs ${r.floor * 100}% ` +
      (r.ok ? 'ok' : `FAIL (k ${r.k} -> needs ${r.needK})`)
    : (r.note || 'exempt');
  if (r.ok === false) fails++;
  console.log(`${String(r.beat)}  ${r.key.padEnd(12)} ${r.cls}  ${r.focus.padEnd(18)} k=${String(r.k).padEnd(5)} ${r.who.slice(0, 40).padEnd(42)} ${s}`);
}
console.log('\nWIDE budget (max 2 after heading):');
let wideBad = 0;
for (const [b, list] of Object.entries(wides)) {
  const over = list.length > 2 ? '  OVER BUDGET' : '';
  if (over) wideBad++;
  console.log(`  beat ${b}: ${list.length} wide — ${list.join(', ')}${over}`);
}
console.log(`\n${fails} floor failures, ${wideBad} beats over wide budget ` +
            (PROPOSED ? '(PROPOSED tables)' : '(SHIPPED tables)'));
