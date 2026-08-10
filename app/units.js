/**
 * units.js — the reader's script for Ch. 1 Beat I ("The Masked Client",
 * 221B Baker Street). This is CONTENT.md, transcribed. Doyle's text is
 * verbatim (Gutenberg #1661, public domain), trimmed only with ellipses.
 * Do not invent, paraphrase or reorder: CONTENT.md is the law.
 *
 * IDS: CONTENT.md's short id is carried in `key`; `id` is `i-NN-<key>` where
 * NN is CONTENT.md's own `#` column. The id is the screenshot filename and
 * the harness's addressing key, so it stays sortable; `key` is the law's name
 * and `unitByKey()` resolves either form.
 *
 * ============================ UNITS SCHEMA ============================
 * A UNIT is one thing the reader reads and one thing the reader does.
 *
 *   id       string   REQUIRED. Stable, kebab-case, unique.
 *   key      string   REQUIRED. CONTENT.md's short id.
 *   text     string   REQUIRED (may be '' for a pure beat). What the margin
 *                     shows. <= 3 rendered lines is the rubric's law.
 *   speaker  string   OPTIONAL. '' = narration (Watson's prose, no prefix —
 *                     the reader IS Watson). 'HOLMES' | 'CLIENT' | 'KING'
 *                     -> small-caps prefix. 'NOTE' | 'LETTER' -> doc styling
 *                     (ruled off, italic): a thing READ is not a thing SAID.
 *   verb     enum     REQUIRED. 'click' | 'hold' | 'auto' | 'target'.
 *                       click  -> advances on the reader's click/tap/space.
 *                       hold   -> press-and-hold to fill `hold` seconds; the
 *                                 reveal resolves WITH the hold, then one more
 *                                 click turns the page ("one click the verb,
 *                                 one click the page").
 *                       auto   -> advances itself after `dwell` sim seconds.
 *                       target -> the reader must click a NAMED THING in the
 *                                 diorama (`target`), resolved by raycast with
 *                                 a generous screen-space radius. A correct
 *                                 click fires `gateAct`/`gateSfx` and advances;
 *                                 a wrong-place click nudges the cue and does
 *                                 NOT advance.
 *   target   string   REQUIRED when verb === 'target'. Key into world.targets
 *                     ('mask' | 'index' | 'door').
 *   gateAct  string   act fired when a target gate resolves.
 *   gateSfx  string   audio cue fired when a target gate resolves.
 *   endsBeat bool     the gate that turns the page out of the beat.
 *   focus    string   REQUIRED. Key into scene.focus — where the camera
 *                     stands and what the hold ring is pinned to.
 *   page     number   REQUIRED. Leaf number.
 *   dwell    number   sim seconds; required when verb === 'auto'.
 *   hold     number   sim seconds of press required; required for verb 'hold'.
 *   reveal   string   id of a scene reveal raised BY the hold ('watermark').
 *   cue      string   affordance label set as type in the margin. Omit and
 *                     the verb's default label is used.
 *   clear    bool     true starts a fresh margin block stack; false appends
 *                     under the previous block (a continued paragraph).
 *   drop     bool     true renders a drop cap on the first letter.
 *   sfx      string   audio cue slot fired once on unit entry.
 *   bed      string   ambience bed to cross-fade to on entry.
 *   act      string   name of a scene action fired once on entry (see
 *                     scene.actions) — the pantomime this unit performs.
 *   cameo    string   cameo-card art id ('holmes' | 'king-masked' |
 *                     'king-unmasked' | 'irene'); persists until replaced.
 *   cap      string   cameo caption (identity — set in small caps).
 *   fact     string   which of CONTENT.md's 11 facts lands here (review aid).
 *   head     bool     chapter-head styling (rule + numeral + display size).
 *   num      string   the numeral shown when head === true.
 * ======================================================================
 */

export const BEAT = { num: 'I', title: 'The Masked Client' };

export const UNITS = [
  /* 0 */
  { id: 'i-00-head', key: 'head', head: true, num: 'I', text: 'The Masked Client',
    speaker: '', verb: 'auto', dwell: 3.0, focus: 'room', page: 1, clear: true,
    bed: 'hearth', act: 'establish' },

  /* 1 — pantomime: Holmes tosses the note to Watson-POV */
  { id: 'i-01-post', key: 'post',
    text: '“It came by the last post… Read it aloud.”',
    speaker: 'HOLMES', verb: 'click', focus: 'holmes', page: 1, clear: true,
    sfx: 'paper', act: 'noteToss', cameo: 'holmes', cap: 'Sherlock Holmes' },

  /* 2 — the note plate rises */
  { id: 'i-02-undated', key: 'undated',
    text: 'The note was undated, and without either signature or address.',
    speaker: '', verb: 'click', focus: 'note', page: 1, clear: true, drop: true,
    act: 'notePlateUp' },

  /* 3 */
  { id: 'i-03-note1', key: 'note1',
    text: '“There will call upon you to-night, at a quarter to eight o’clock… a gentleman who desires to consult you upon a matter of the very deepest moment.”',
    speaker: 'NOTE', verb: 'click', focus: 'note', page: 1 },

  /* 4 — fact I.1 lands here */
  { id: 'i-04-note2', key: 'note2',
    text: '“Be in your chamber then, at that hour, and do not take it amiss if your visitor wear a mask.”',
    speaker: 'NOTE', verb: 'click', focus: 'note', page: 1, fact: 'I.1' },

  /* 5 — GATE: press-and-hold. Plate comes down, the verb happens in the WORLD */
  { id: 'i-05-hold', key: 'hold',
    text: '“Peculiar—that is the very word… It is not an English paper at all. Hold it up to the light.”',
    speaker: 'HOLMES', verb: 'hold', hold: 1.8, reveal: 'watermark',
    cue: 'press and hold the note to the light', focus: 'note', page: 1,
    clear: true, sfx: 'paper', act: 'noteLift' },

  /* 6 */
  { id: 'i-06-wmark', key: 'wmark',
    text: '…a large “E” with a small “g,” a “P,” and a large “G” with a small “t” woven into the texture of the paper.',
    speaker: '', verb: 'click', focus: 'note', page: 1, clear: true,
    act: 'watermarkPlateUp' },

  /* 7 — plate off; Holmes fetches the gazetteer */
  { id: 'i-07-gaz1', key: 'gaz1',
    text: '“The ‘G’ with the small ‘t’ stands for ‘Gesellschaft,’ which is the German for ‘Company’… ‘P,’ of course, stands for ‘Papier.’”',
    speaker: 'HOLMES', verb: 'click', focus: 'desk', page: 1, clear: true,
    sfx: 'book', act: 'gazetteerFetch' },

  /* 8 — fact I.2 */
  { id: 'i-08-gaz2', key: 'gaz2',
    text: '“Now for the ‘Eg.’ Let us glance at our Continental Gazetteer… Eglow, Eglonitz—here we are, Egria. It is in a German-speaking country—in Bohemia, not far from Carlsbad.”',
    speaker: 'HOLMES', verb: 'click', focus: 'desk', page: 1, fact: 'I.2' },

  /* 9 */
  { id: 'i-09-comes1', key: 'comes1',
    text: '“It only remains, therefore, to discover what is wanted by this German who writes upon Bohemian paper and prefers wearing a mask to showing his face.”',
    speaker: 'HOLMES', verb: 'click', focus: 'window', page: 1, clear: true,
    act: 'carriageArrive' },

  /* 10 — cam -> door; hoofbeats in the street; fact I.3.
     `arrival` stages the beat (round-1 [E1a]): carriage lamps sweep the pane
     and rake the wall, the light under the door swells, the landing comes up. */
  { id: 'i-10-comes2', key: 'comes2',
    text: '“And here he comes, if I am not mistaken, to resolve all our doubts.”',
    speaker: 'HOLMES', verb: 'click', focus: 'door', page: 1, clear: true,
    sfx: 'hoofbeats', bed: 'street', act: 'arrival', fact: 'I.3' },

  /* 11 — the King ENTERS the diorama; fact I.4 */
  { id: 'i-11-hadnote', key: 'hadnote',
    text: '“You had my note?… I told you that I would call.”',
    speaker: 'CLIENT', verb: 'click', focus: 'entrance', page: 1, clear: true,
    sfx: 'step', act: 'kingEnter', cameo: 'king-masked', cap: 'The Masked Client',
    fact: 'I.4' },

  /* 12 — the King turns to face the reader (the reader is Watson).
     [R3-1] focus `present`: the introduction names Watson, so the frame has
     to CONTAIN Watson. This is the three-shot — Holmes at the desk, the King
     centre, Watson in the wingback by the fire. */
  { id: 'i-12-seat', key: 'seat',
    text: '“Pray take a seat… This is my friend and colleague, Dr. Watson, who is occasionally good enough to help me in my cases.”',
    speaker: 'HOLMES', verb: 'click', focus: 'present', page: 1, clear: true,
    bed: 'hearth', act: 'kingPresent' },

  /* 13 — held on the three-shot: the King's "which of you to address" beat
     only reads if both men he might address are on stage. */
  { id: 'i-13-delicacy', key: 'delicacy',
    text: '“The circumstances are of great delicacy, and every precaution has to be taken to quench what might grow to be an immense scandal…”',
    speaker: 'CLIENT', verb: 'click', focus: 'present', page: 1, clear: true },

  /* 14 — fact I.5 */
  { id: 'i-14-ormstein', key: 'ormstein',
    text: '“To speak plainly, the matter implicates the great House of Ormstein, hereditary kings of Bohemia.”',
    speaker: 'CLIENT', verb: 'click', focus: 'client', page: 1, clear: true,
    fact: 'I.5' },

  /* 15 — GATE: click the mask */
  { id: 'i-15-condescend', key: 'condescend',
    text: '“If your Majesty would condescend to state your case… I should be better able to advise you.”',
    speaker: 'HOLMES', verb: 'target', target: 'mask', gateAct: 'kingUnmask',
    gateSfx: 'mask-drop', cue: 'click the mask', focus: 'clientFace', page: 1,
    clear: true, act: 'pushToMask' },

  /* 16 — fact I.6; the cameo FLIPS */
  { id: 'i-16-iamking', key: 'iamking',
    text: '“You are right… I am the King. Why should I attempt to conceal it?”',
    speaker: 'KING', verb: 'click', focus: 'clientFace', page: 1, clear: true,
    cameo: 'king-unmasked', cap: 'Wilhelm von Ormstein · King of Bohemia',
    fact: 'I.6' },

  /* 17 */
  { id: 'i-17-wilhelm', key: 'wilhelm',
    text: '“Why, indeed?… Your Majesty had not spoken before I was aware that I was addressing Wilhelm Gottsreich Sigismond von Ormstein… hereditary King of Bohemia.”',
    speaker: 'HOLMES', verb: 'click', focus: 'client', page: 1, clear: true },

  /* 18 — cam -> desk: the index is the next click target */
  { id: 'i-18-warsaw', key: 'warsaw',
    text: '“Some five years ago, during a lengthy visit to Warsaw, I made the acquaintance of the well-known adventuress, Irene Adler.”',
    speaker: 'KING', verb: 'click', focus: 'desk', page: 1, clear: true,
    act: 'toIndex' },

  /* 19 — GATE: click the index book */
  { id: 'i-19-lookup', key: 'lookup',
    text: '“Kindly look her up in my index, Doctor…”',
    speaker: 'HOLMES', verb: 'target', target: 'index', gateAct: 'gazetteerLookup',
    gateSfx: 'book', cue: 'click the index', focus: 'desk', page: 1, clear: true },

  /* 20 */
  { id: 'i-20-letmesee', key: 'letmesee',
    text: '“Let me see!… Hum! Born in New Jersey in the year 1858. Contralto—hum! La Scala, hum! Prima donna Imperial Opera of Warsaw—yes!”',
    speaker: 'HOLMES', verb: 'click', focus: 'desk', page: 1, clear: true,
    cameo: 'irene', cap: 'Irene Adler' },

  /* 21 — fact I.7 */
  { id: 'i-21-london', key: 'london',
    text: '“Retired from operatic stage—ha! Living in London—quite so!”',
    speaker: 'HOLMES', verb: 'click', focus: 'desk', page: 1, fact: 'I.7' },

  /* 22 — stichomythia begins: two-shot, rapid pacing */
  { id: 'i-22-myphoto', key: 'myphoto', text: '“My photograph.”',
    speaker: 'KING', verb: 'click', focus: 'two', page: 1, clear: true,
    act: 'holmesReturn',
    cameo: 'king-unmasked', cap: 'Wilhelm von Ormstein · King of Bohemia' },

  /* 23 */
  { id: 'i-23-bought', key: 'bought', text: '“Bought.”',
    speaker: 'HOLMES', verb: 'click', focus: 'two', page: 1 },

  /* 24 — the plate rises on the line that names the object */
  { id: 'i-24-both', key: 'both', text: '“We were both in the photograph.”',
    speaker: 'KING', verb: 'click', focus: 'two', page: 1, act: 'bothPlateUp' },

  /* 25 — plate holds */
  { id: 'i-25-verybad', key: 'verybad',
    text: '“Oh, dear! That is very bad! Your Majesty has indeed committed an indiscretion.”',
    speaker: 'HOLMES', verb: 'click', focus: 'two', page: 1, clear: true },

  /* 26 — plate off */
  { id: 'i-26-recovered', key: 'recovered', text: '“It must be recovered.”',
    speaker: 'HOLMES', verb: 'click', focus: 'two', page: 1, act: 'plateOff' },

  /* 27 — fact I.8 */
  { id: 'i-27-five', key: 'five',
    text: '“Five attempts have been made. Twice burglars in my pay ransacked her house… There has been no result.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1, clear: true,
    fact: 'I.8' },

  /* 28 */
  { id: 'i-28-propose', key: 'propose',
    text: '“And what does she propose to do with the photograph?”',
    speaker: 'HOLMES', verb: 'click', focus: 'holmes', page: 1, clear: true },

  /* 29 */
  { id: 'i-29-toruin', key: 'toruin', text: '“To ruin me.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1 },

  /* 30 */
  { id: 'i-30-buthow', key: 'buthow', text: '“But how?”',
    speaker: 'HOLMES', verb: 'click', focus: 'holmes', page: 1, clear: true },

  /* 31 */
  { id: 'i-31-married', key: 'married', text: '“I am about to be married.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1 },

  /* 32 — fact I.9 */
  { id: 'i-32-steel', key: 'steel',
    text: '“Threatens to send them the photograph. And she will do it. I know that she will do it… she has a soul of steel.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1, clear: true,
    fact: 'I.9' },

  /* 33 — fact I.10a, the deadline */
  { id: 'i-33-monday', key: 'monday',
    text: '“Because she has said that she would send it on the day when the betrothal was publicly proclaimed. That will be next Monday.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1, fact: 'I.10a' },

  /* 34 */
  { id: 'i-34-address', key: 'address', text: '“And Mademoiselle’s address?”',
    speaker: 'HOLMES', verb: 'click', focus: 'holmes', page: 1, clear: true },

  /* 35 — fact I.10b; the King begins his exit walk */
  { id: 'i-35-briony', key: 'briony',
    text: '“Is Briony Lodge, Serpentine Avenue, St. John’s Wood.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 1, act: 'kingExit',
    fact: 'I.10b' },

  /* 36 — cam holds on the door */
  { id: 'i-36-goodnight', key: 'goodnight',
    text: '“Then, good-night, your Majesty, and I trust that we shall soon have some good news for you.”',
    speaker: 'HOLMES', verb: 'click', focus: 'door', page: 1, clear: true,
    cue: 'click the door · to Serpentine Avenue' },

  /* 37 — GATE: click the door -> the page TURNS. fact I.11
   * [R7-1] This unit has NO act. Round 6 fired `kingWalkOut` on entry here, so the
   * reader's advance out of the goodnight walked him through the opening in plain
   * view — under a lintel that takes his head off half a metre past the sill. The
   * King simply stands at his mark across this gate, at any dwell; the page turn
   * the gate fires is what takes him off stage (main.js enterEndLeaf). */
  { id: 'i-37-door', key: 'door', text: '',
    speaker: '', verb: 'target', target: 'door', gateAct: 'doorOpen',
    gateSfx: 'page', endsBeat: true, cue: 'click the door · to Serpentine Avenue',
    focus: 'door', page: 1, fact: 'I.11' },
];

/**
 * The closing card the door gate turns the page into.
 *
 * [R6-6] It is a PAGE, not an overlay. Round 0 turned the leaf on the door gate
 * and round 1 left the machinery in place with nothing to fire it (every unit is
 * page 1, so `advance()`'s page test never tripped): the card came up under a
 * permanent 93% cover instead. The card is page 2 now — the gate runs the same
 * cover turn a page change always ran, the leaf swaps under it, and the cover
 * lifts on a page with no picture on it.
 */
export const END_PAGE = 2;
export const END_CARD = {
  page: END_PAGE,
  kicker: 'End of Beat I',
  title: 'to Serpentine Avenue',
  sub: 'Briony Lodge · St. John’s Wood · Monday',
};

/** Verb default affordance labels (a unit's own `cue` wins). */
export const CUE_DEFAULT = {
  click:  'click to read on',
  hold:   'press and hold',
  auto:   '',
  target: 'click the highlighted thing',
};

/** The first-visit affordance hint, faded out after the reader's first click. */
export const FIRST_HINT = 'click anywhere to read on';

/** Every leaf the beat turns through — the units' pages, then the card's. */
export const PAGES = [...new Set([...UNITS.map(u => u.page), END_PAGE])];

/** Resolve a unit by CONTENT.md key or by full id. */
export function unitByKey(k) {
  return UNITS.find(u => u.key === k || u.id === k) || null;
}

/** Cheap shape check — the harness asserts this returns []. */
export function validateUnits(units = UNITS) {
  const bad = [];
  const seen = new Set();
  const seenKeys = new Set();
  const VERBS = new Set(['click', 'hold', 'auto', 'target']);
  const TARGETS = new Set(['mask', 'index', 'door']);
  units.forEach((u, i) => {
    const at = `#${i} ${u.id || '(no id)'}`;
    if (!u.id) bad.push(`${at}: missing id`);
    if (seen.has(u.id)) bad.push(`${at}: duplicate id`);
    seen.add(u.id);
    if (!u.key) bad.push(`${at}: missing key (CONTENT.md id)`);
    if (seenKeys.has(u.key)) bad.push(`${at}: duplicate key`);
    seenKeys.add(u.key);
    if (typeof u.text !== 'string') bad.push(`${at}: text must be a string`);
    if (!VERBS.has(u.verb)) bad.push(`${at}: verb must be click|hold|auto|target`);
    if (!u.focus) bad.push(`${at}: missing focus`);
    if (!(u.page >= 1)) bad.push(`${at}: page must be >= 1`);
    if (u.verb === 'auto' && !(u.dwell > 0)) bad.push(`${at}: auto needs dwell`);
    if (u.verb === 'hold' && !(u.hold > 0)) bad.push(`${at}: hold needs hold seconds`);
    if (u.verb === 'target' && !TARGETS.has(u.target)) {
      bad.push(`${at}: target verb needs target in {${[...TARGETS].join(',')}}`);
    }
    if (u.verb === 'target' && !u.cue) bad.push(`${at}: target gate needs an explicit cue`);
    if (u.cameo && !u.cap) bad.push(`${at}: cameo needs a caption`);
    if (i > 0 && u.page < units[i - 1].page) bad.push(`${at}: page went backwards`);
  });
  if (units.length !== 38) bad.push(`unit count is ${units.length}, CONTENT.md specifies 38`);
  return bad;
}
