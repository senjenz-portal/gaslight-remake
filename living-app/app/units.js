/**
 * units.js — the reader's script for the WHOLE of Ch. 1, "A Scandal in
 * Bohemia": 95 units, seven beats, seven leaves, four SETS.
 *
 *   Beat I   (38 units) is CONTENT.md, transcribed — unchanged, and it must
 *            stay that way: the array below opens with the same 38 objects it
 *            shipped with, byte for byte.
 *   II–VII   (57 units) are CONTENT-full.md, lifted out of that file's own
 *            tables by tools/living/emit_units.py rather than retyped.
 *
 * Doyle's text is verbatim (Gutenberg #1661, public domain), trimmed only with
 * ellipses. Do not invent, paraphrase or reorder: the two CONTENT files are
 * the law.
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
 *   verb     enum     REQUIRED. 'click' | 'hold' | 'auto' | 'target' | 'clock'.
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
 *                       clock  -> Beat VI only: arrives on the BEAT's own
 *                                 timeline at `at` seconds past the throw, and
 *                                 a click cannot hurry it (CONTENT-full 6.6).
 *   target   string   REQUIRED when verb === 'target'. Key into the mounted
 *                     SET's targets — see TARGETS_BY_SET at the foot of this
 *                     file. A gate whose target its own SET does not carry is
 *                     a wedge, and validateUnits() refuses it.
 *   at       number   REQUIRED when verb === 'clock'. Seconds past t=0, where
 *                     t=0 is the instant the `window` gate resolved.
 *   wait     string   the unit may not be paged past until this thing has
 *                     happened on stage, however fast the reader clicks. A
 *                     click inside the window is LATCHED, not lost, and spends
 *                     the moment the unit may turn (sec 2.3):
 *                     'roll' | 'ring' | 'sovereign'.
 *   seg      string   a timed SEGMENT of pantomime the unit runs on entry.
 *   segDur   number   its length in sim seconds.
 *   segHold  bool     true = the segment paces the unit (a click inside it is
 *                     latched, exactly like `wait`); false = the segment is
 *                     only a camera move and the reader is never held.
 *   beat     number   1..7. NOT the heading numeral — see BEATS.
 *   set      string   'room' | 'street' | 'chase' | 'church'. One SET per
 *                     leaf; the page turn is what swaps them.
 *   endsBook bool     the last unit in the book; its click raises the card.
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
  /* [8c-4] its OWN focus, not focus.note: the watermark plate is a screen-space
     overlay, so this camera only frames the diorama around it — and on the note
     lens Holmes was cropped at the ankles there (inset 0.9112). */
  { id: 'i-06-wmark', key: 'wmark',
    text: '…a large “E” with a small “g,” a “P,” and a large “G” with a small “t” woven into the texture of the paper.',
    speaker: '', verb: 'click', focus: 'wmark', page: 1, clear: true,
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

  /* ================= BEATS II-VII (CONTENT-full.md) =================
   * Generated from CONTENT-full.md's own sec 5 tables by
   * /tmp/gl-engine/emit_units.py (kept at tools/living/emit_units.py):
   * the TEXT and the PREFIX are lifted out of the law, never retyped.
   * The staging fields are authored from the same tables' staging
   * column plus the SCENE LEDGER (sec 6).
   * ================================================================= */

  /* 2.0 — arrival on the street SET, wide. The heading leaves the page the moment unit 1
     arrives.
   */
  { id: 'ii-00-head', key: 'head2', head: true, num: 'II',
    text: 'Serpentine Avenue', speaker: '', verb: 'auto', dwell: 3.4,
    focus: 'street', page: 2, beat: 2, set: 'street', clear: true,
    bed: 'street', act: 'establish' },

  /* 2.1 — the whole front, the establishing lens. THE HOUSE IS NOT ON FIRE - the smoke
     gate is closed on arrival, which is the one thing the reference gets wrong for
     this book. fact II.1: this street and this house are HERS.
   */
  { id: 'ii-01-lodge', key: 'lodge',
    text: '“I soon found Briony Lodge. It is a *bijou* villa… with long windows almost to the floor…”',
    speaker: 'HOLMES', verb: 'click', focus: 'villa', page: 2, beat: 2,
    set: 'street', clear: true, act: 'smokeClosed', fact: 'II.1' },

  /* 2.2 — Watson's own voice, no prefix. Its click turns the page INTO the told story.
     fact II.5.
   */
  { id: 'ii-02-following', key: 'following',
    text: '“I am following you closely…”', speaker: '', verb: 'click',
    endsBeat: true, focus: 'holmes-street', page: 2, beat: 2, set: 'street',
    clear: true, fact: 'II.5' },

  /* 3.0 */
  { id: 'iii-00-head', key: 'head3', head: true, num: 'III',
    text: 'The Pursuit', speaker: '', verb: 'auto', dwell: 3.4, focus: 'strip',
    page: 3, beat: 3, set: 'chase', clear: true, bed: 'chase',
    act: 'establish' },

  /* 3.1 — act placeCanonOrder - HIS HANSOM AT THE LIT DOOR, HER LANDAU NOT YET IN THE
     STREET. Canon has only his cab at l.612, and the reference measures the
     placement rather than dodging the shot. fact P.1.
   */
  { id: 'iii-01-hansom', key: 'hansom',
    text: '“I was still balancing the matter in my mind when a hansom cab drove up to Briony Lodge, and a gentleman sprang out… evidently the man of whom I had heard.”',
    speaker: 'HOLMES', verb: 'click', focus: 'door', page: 3, beat: 3,
    set: 'chase', clear: true, sfx: 'hoofbeats', act: 'placeCanonOrder',
    fact: 'P.1' },

  /* 3.2 */
  { id: 'iii-02-halfhour', key: 'halfhour',
    text: '“He was in the house about half an hour… Presently he emerged, looking even more flurried than before.”',
    speaker: 'HOLMES', verb: 'click', focus: 'door', page: 3, beat: 3,
    set: 'chase' },

  /* 3.3 — the gold watch is the prop that reads; it is painted into norton-chase.png, so
     the sfx is what performs it.
   */
  { id: 'iii-03-watch', key: 'watch',
    text: '“As he stepped up to the cab, he pulled a gold watch from his pocket and looked at it earnestly…”',
    speaker: 'HOLMES', verb: 'click', focus: 'door', page: 3, beat: 3,
    set: 'chase', sfx: 'watch' },

  /* 3.4 — Doyle's nested attribution becomes the prefix (sec 2.1). fact P.2.
   */
  { id: 'iii-04-devil', key: 'devil',
    text: '“Drive like the devil… first to Gross & Hankey’s in Regent Street, and then to the Church of St. Monica in the Edgeware Road. Half a guinea if you do it in twenty minutes!”',
    speaker: 'THE GENTLEMAN', verb: 'click', focus: 'door', page: 3, beat: 3,
    set: 'chase', sfx: 'whip', fact: 'P.2' },

  /* 3.5 — seg chase-intro (6.0 s): Norton away first; the landau up the lane; SHE SHOOTS
     OUT OF THE HALL DOOR AND BOARDS; a cab comes through the street. Canon
     l.631-632 is CUT - the segment performs it (sec 2.4).
   */
  { id: 'iii-05-landau', key: 'landau',
    text: '“Away they went… up the lane came a neat little landau, the coachman with his coat only half-buttoned, and his tie under his ear…”',
    speaker: 'HOLMES', verb: 'click', seg: 'chase-intro', segDur: 6.0,
    segHold: true, focus: 'lane', page: 3, beat: 3, set: 'chase', clear: true,
    fact: 'P.3' },

  /* 3.6 — act nortonAway - the strip stops dressing him.
   */
  { id: 'iii-06-shotout', key: 'shotout',
    text: '“I only caught a glimpse of her at the moment, but she was a lovely woman, with a face that a man might die for.”',
    speaker: 'HOLMES', verb: 'click', focus: 'her', page: 3, beat: 3,
    set: 'chase', act: 'nortonAway' },

  /* 3.7 */
  { id: 'iii-07-stmonica', key: 'stmonica',
    text: '“The Church of St. Monica, John… and half a sovereign if you reach it in twenty minutes.”',
    speaker: 'IRENE ADLER', verb: 'click', focus: 'her', page: 3, beat: 3,
    set: 'chase', fact: 'P.3' },

  /* 3.8 — push 1.6 s - DELIBERATELY SHORT: a gate's target must be reachable the moment
     its cue asks for it (the reference measured the cab off-frame for 16 of the
     first 20 samples at 2.8 s). fact P.4.
   */
  { id: 'iii-08-toogood', key: 'toogood',
    text: '“This was quite too good to lose, Watson. I was just balancing whether I should run for it, or whether I should perch behind her landau when a cab came through the street.”',
    speaker: 'HOLMES', verb: 'target', target: 'cab', gateAct: 'startPursuit',
    gateSfx: 'cab', cue: 'click the cab · follow her', focus: 'cab', page: 3,
    beat: 3, set: 'chase', clear: true, fact: 'P.4' },

  /* 3.9 — the pursuit is rolling under this unit.
   */
  { id: 'iii-09-shabby', key: 'shabby',
    text: '“The driver looked twice at such a shabby fare, but I jumped in before he could object.”',
    speaker: 'HOLMES', verb: 'click', focus: 'cab', page: 3, beat: 3,
    set: 'chase' },

  /* 3.10 — Doyle's own echo of unit 7 - KEEP BOTH (sec 3).
   */
  { id: 'iii-10-halfsov', key: 'halfsov',
    text: '“The Church of St. Monica… and half a sovereign if you reach it in twenty minutes.”',
    speaker: 'HOLMES', verb: 'click', focus: 'cab', page: 3, beat: 3,
    set: 'chase' },

  /* 3.11 — wait: roll. Cannot turn before the cab has run the strip - the arrival is what
     turns the page. fact P.5.
   */
  { id: 'iii-11-twentyfive', key: 'twentyfive',
    text: '“It was twenty-five minutes to twelve, and of course it was clear enough what was in the wind.”',
    speaker: 'HOLMES', verb: 'click', wait: 'roll', endsBeat: true,
    focus: 'away', page: 3, beat: 3, set: 'chase', clear: true, fact: 'P.5' },

  /* 4.0 — THE HEADING RIDES THE ARRIVAL IN - it carries its own move to focus nave, or
     the page's first frame is a church still coming out of its own fold.
   */
  { id: 'iv-00-head', key: 'head4', head: true, num: 'IV',
    text: 'St. Monica’s', speaker: '', verb: 'auto', dwell: 3.4, focus: 'nave',
    page: 4, beat: 4, set: 'church', clear: true, sfx: 'bell', bed: 'church',
    act: 'establish' },

  /* 4.1 */
  { id: 'iv-01-drovefast', key: 'drovefast',
    text: '“My cabby drove fast. I don’t think I ever drove faster, but the others were there before us… I paid the man and hurried into the church.”',
    speaker: 'HOLMES', verb: 'click', focus: 'nave', page: 4, beat: 4,
    set: 'church', clear: true },

  /* 4.2 — the three-in-a-knot tableau is the SET's rest state. fact M.1.
   */
  { id: 'iv-02-notasoul', key: 'notasoul',
    text: '“There was not a soul there save the two whom I had followed and a surpliced clergyman, who seemed to be expostulating with them. They were all three standing in a knot in front of the altar.”',
    speaker: 'HOLMES', verb: 'click', focus: 'knot', page: 4, beat: 4,
    set: 'church', fact: 'M.1' },

  /* 4.3 — seg lounge (6.0 s) - the witness up the side aisle. fact M.2.
   */
  { id: 'iv-03-lounged', key: 'lounged',
    text: '“I lounged up the side aisle like any other idler who has dropped into a church.”',
    speaker: 'HOLMES', verb: 'click', seg: 'lounge', segDur: 6.0,
    segHold: true, focus: 'aisle', page: 4, beat: 4, set: 'church',
    clear: true, fact: 'M.2' },

  /* 4.4 — seg run (6.0 s) - Norton runs, then beckons with both arms. Doyle NAMES him
     here.
   */
  { id: 'iv-04-facedround', key: 'facedround',
    text: '“Suddenly, to my surprise, the three at the altar faced round to me, and Godfrey Norton came running as hard as he could towards me.”',
    speaker: 'HOLMES', verb: 'click', seg: 'run', segDur: 6.0, segHold: true,
    focus: 'aisle', page: 4, beat: 4, set: 'church' },

  /* 4.5 — cameo norton, first appearance.
   */
  { id: 'iv-05-thankgod', key: 'thankgod',
    text: '“Thank God… You’ll do. Come! Come!”', speaker: 'GODFREY NORTON',
    verb: 'click', focus: 'aisle', page: 4, beat: 4, set: 'church',
    clear: true, cameo: 'norton', cap: 'Godfrey Norton' },

  /* 4.6 — Holmes quoting HIMSELF inside his own account - prefixed, not bare (sec 3).
   */
  { id: 'iv-06-whatthen', key: 'whatthen', text: '“What then?”',
    speaker: 'HOLMES', verb: 'click', focus: 'aisle', page: 4, beat: 4,
    set: 'church' },

  /* 4.7 — the click ANSWERS him, and being answered is what drags Holmes to the altar.
     fact M.3.
   */
  { id: 'iv-07-comeman', key: 'comeman',
    text: '“Come, man, come, only three minutes, or it won’t be legal.”',
    speaker: 'GODFREY NORTON', verb: 'target', target: 'norton',
    gateAct: 'dragToAltar', cue: 'click Norton · answer him', focus: 'aisle',
    page: 4, beat: 4, set: 'church', fact: 'M.3' },

  /* 4.8 — act glassStart - the three minutes run out on the altar's own hourglass,
     scrubbed 0->1 over 11.0 s.
   */
  { id: 'iv-08-halfdragged', key: 'halfdragged',
    text: '“I was half-dragged up to the altar, and before I knew where I was I found myself mumbling responses which were whispered in my ear…”',
    speaker: 'HOLMES', verb: 'click', seg: 'drag', segDur: 6.0, segHold: true,
    /* the AISLE lens, not the knot: the drag is now performed (Norton hauls the
       witness up and then hands back to his own painted self), and the aisle
       lens is the one composed so his painted self is outside the frame while
       his cut-out is inside it. On `knot` the reader would see two of him. */
    focus: 'aisle', page: 4, beat: 4, set: 'church', clear: true, sfx: 'glass',
    act: 'glassStart' },

  /* 4.9 — THE CAMEO CAPTION FLIPS - the King's own reveal device, used for the chapter's
     one other change of identity. The ring lens is MEASURED, not chosen: the
     church lane reads bride 24.0 / clergyman 23.7 / groom 17.3 % of frame height
     at k=1.0, and k=1.13 lands the bride on the reference's own 27.2. fact M.4.
   */
  { id: 'iv-09-tyingup', key: 'tyingup',
    text: '“…generally assisting in the secure tying up of Irene Adler, spinster, to Godfrey Norton, bachelor. It was all done in an instant…”',
    speaker: 'HOLMES', verb: 'click', wait: 'ring', focus: 'ring', page: 4,
    beat: 4, set: 'church', act: 'ringScrub', cameo: 'irene',
    cap: 'Irene Norton, née Adler', fact: 'M.4' },

  /* 4.10 — holds the ring frame.
   */
  { id: 'iv-10-preposterous', key: 'preposterous',
    text: '“It was the most preposterous position in which I ever found myself in my life…”',
    speaker: 'HOLMES', verb: 'click', focus: 'ring', page: 4, beat: 4,
    set: 'church' },

  /* 4.11 */
  { id: 'iv-11-license', key: 'license',
    text: '“It seems that there had been some informality about their license, that the clergyman absolutely refused to marry them without a witness of some sort…”',
    speaker: 'HOLMES', verb: 'click', focus: 'knot', page: 4, beat: 4,
    set: 'church', clear: true, fact: 'M.5' },

  /* 4.12 — bride -> witness -> watch chain, three holders. fact M.6.
   */
  { id: 'iv-12-sovereigngift', key: 'sovereigngift',
    text: '“The bride gave me a sovereign, and I mean to wear it on my watch chain in memory of the occasion.”',
    speaker: 'HOLMES', verb: 'click', wait: 'sovereign', focus: 'coin',
    page: 4, beat: 4, set: 'church', act: 'sovereignScrub', fact: 'M.6' },

  /* 4.13 — the told story ends and the reader has his own voice back. fact M.7.
   */
  { id: 'iv-13-unexpected', key: 'unexpected',
    text: '“This is a very unexpected turn of affairs… and what then?”',
    speaker: '', verb: 'click', focus: 'nave', page: 4, beat: 4, set: 'church',
    clear: true, cameo: null, fact: 'M.7' },

  /* 4.14 */
  { id: 'iv-14-menaced', key: 'menaced',
    text: '“Well, I found my plans very seriously menaced. It looked as if the pair might take an immediate departure, and so necessitate very prompt and energetic measures on my part.”',
    speaker: 'HOLMES', verb: 'click', focus: 'nave', page: 4, beat: 4,
    set: 'church' },

  /* 4.15 */
  { id: 'iv-15-separated', key: 'separated',
    text: '“At the church door, however, they separated, he driving back to the Temple, and she to her own house.”',
    speaker: 'HOLMES', verb: 'click', focus: 'nave', page: 4, beat: 4,
    set: 'church', clear: true },

  /* 4.16 — its click turns the page BACK to Serpentine Avenue and Beat II resumes. fact
     M.8.
   */
  { id: 'iv-16-parkatfive', key: 'parkatfive',
    text: '“I shall drive out in the park at five as usual…”',
    speaker: 'IRENE ADLER', verb: 'click', endsBeat: true, focus: 'nave',
    page: 4, beat: 4, set: 'church', fact: 'M.8' },

  /* 5.0 — NO CHAPTER HEADING AND NO ESTABLISHING BEAT. The told story was an inset; the
     reader is standing in Serpentine Avenue exactly where he left off. Smoke gate
     still CLOSED.
   */
  { id: 'v-00-plan1', key: 'plan1',
    text: '“There will probably be some small unpleasantness. Do not join in it. It will end in my being conveyed into the house.”',
    speaker: 'HOLMES', verb: 'click', focus: 'plan', page: 5, beat: 5,
    set: 'street', clear: true, bed: 'street', act: 'resumeStreet' },

  /* 5.1 — names the window the reader will be posted at.
   */
  { id: 'v-01-plan2', key: 'plan2',
    text: '“Four or five minutes afterwards the sitting-room window will open. You are to station yourself close to that open window.”',
    speaker: 'HOLMES', verb: 'click', focus: 'plan', page: 5, beat: 5,
    set: 'street' },

  /* 5.2 */
  { id: 'v-02-watchme', key: 'watchme',
    text: '“You are to watch me, for I will be visible to you.”',
    speaker: 'HOLMES', verb: 'click', focus: 'plan', page: 5, beat: 5,
    set: 'street', fact: 'II.2' },

  /* 5.3 — INSET plate-rocket rises (push, then plate; the world dims to the painted
     relight).
   */
  { id: 'v-03-signal', key: 'signal',
    text: '“And when I raise my hand—so—you will throw into the room what I give you to throw, and will, at the same time, raise the cry of fire.”',
    speaker: 'HOLMES', verb: 'click', focus: 'plan', page: 5, beat: 5,
    set: 'street', clear: true, act: 'signalHand' },

  /* 5.4 — the inset holds. fact II.3.
   */
  { id: 'v-04-rocket', key: 'rocket',
    text: '“It is an ordinary plumber’s smoke-rocket, fitted with a cap at either end to make it self-lighting.”',
    speaker: 'HOLMES', verb: 'click', focus: 'plan', page: 5, beat: 5,
    set: 'street', fact: 'II.3' },

  /* 5.5 — INSET OFF - the verb happens in the WORLD (Beat I's noteLift law). act
     descendToStreet brings the frame down to street level and lights the chalk
     ring. NO PAGE TURN ON THIS GATE - Beat VI is the same leaf. fact II.4.
   */
  { id: 'v-05-neutral', key: 'neutral',
    text: '“I am to remain neutral, to get near the window, to watch you, and at the signal to throw in this object, then to raise the cry of fire…”',
    speaker: '', verb: 'target', target: 'station', gateAct: 'takeStation',
    gateSfx: 'step',
    cue: 'click the chalk ring · take your station at the open window',
    focus: 'station', page: 5, beat: 5, set: 'street', clear: true,
    act: 'descendToStreet', fact: 'II.4' },

  /* 6.0 — NUMERAL V, BEAT 6. Arrives with NO page turn - the heading lands on the leaf
     already mounted.
   */
  { id: 'vi-00-head', key: 'head6', head: true, num: 'V',
    text: 'The Alarm of Fire', speaker: '', verb: 'auto', dwell: 3.6,
    focus: 'window', page: 5, beat: 6, set: 'street', clear: true },

  /* 6.1 — THE GATE DOES NOT ARM HERE - the whole reason must be on the page first. fact
     III.1a.
   */
  { id: 'vi-01-instinct1', key: 'instinct1',
    text: '“When a woman thinks that her house is on fire, her instinct is at once to rush to the thing which she values most. It is a perfectly overpowering impulse…”',
    speaker: 'HOLMES', verb: 'click', dwell: 8.0, focus: 'window', page: 5,
    beat: 6, set: 'street', clear: true, fact: 'III.1a' },

  /* 6.2 — facts III.1b + III.2. The throw itself carries NO TEXT at all (sec 2.4):
     Doyle's l.880-883 narrates what the reader has this instant done with his own
     hand.
   */
  { id: 'vi-02-instinct2', key: 'instinct2',
    text: '“…our lady of to-day had nothing in the house more precious to her than what we are in quest of. She would rush to secure it.”',
    speaker: 'HOLMES', verb: 'target', target: 'window', gateAct: 'fireRuse',
    gateSfx: 'rocket',
    cue: 'click the lit window · throw it, and raise the cry of fire — then watch the window',
    focus: 'window', page: 5, beat: 6, set: 'street', fact: 'III.1b' },

  /* 6.3 — arrives as the camera settles on the REVEAL lens.
   */
  { id: 'vi-03-panel', key: 'panel',
    text: '“The photograph is in a recess behind a sliding panel just above the right bell-pull.”',
    speaker: 'HOLMES', verb: 'clock', at: 3.2, focus: 'reveal', page: 5,
    beat: 6, set: 'street', clear: true },

  /* 6.4 — LANDS ON THE PAUSE - she is stopped at the panel with her hand up (sec 6.6,
     +2.45..5.10).
   */
  { id: 'vi-04-glimpse', key: 'glimpse',
    text: '“She was there in an instant, and I caught a glimpse of it as she half drew it out.”',
    speaker: 'HOLMES', verb: 'clock', at: 5.6, focus: 'reveal', page: 5,
    beat: 6, set: 'street' },

  /* 6.5 — the crowd loses interest and scatters; the camera eases back over 2.4 s.
   */
  { id: 'vi-05-knowwhere', key: 'knowwhere', text: '“I know where it is.”',
    speaker: 'HOLMES', verb: 'clock', at: 8.6, focus: 'reveal', page: 5,
    beat: 6, set: 'street', clear: true, sfx: 'disperse', act: 'disperse' },

  /* 6.6 */
  { id: 'vi-06-howfind', key: 'howfind', text: '“And how did you find out?”',
    speaker: '', verb: 'clock', at: 11.0, focus: 'reveal', page: 5, beat: 6,
    set: 'street' },

  /* 6.7 — facts III.3b + III.4. At t+16.6 the camera returns to the street's composed
     pose; at t+19.8 THE PAGE TURNS.
   */
  { id: 'vi-07-showed', key: 'showed',
    text: '“She showed me, as I told you she would.”', speaker: 'HOLMES',
    verb: 'clock', at: 13.2, turnAt: 19.8, endsBeat: true, focus: 'street',
    page: 5, beat: 6, set: 'street', fact: 'III.4' },

  /* 7.0 — NUMERAL VI, BEAT 7. Back on the 221B SET - the same plate Beat I used,
     re-dressed. No new room variant (sec 6.2).
   */
  { id: 'vii-00-head', key: 'head7', head: true, num: 'VI', text: 'The Woman',
    speaker: '', verb: 'auto', dwell: 3.4, focus: 'room', page: 6, beat: 7,
    set: 'room', clear: true, bed: 'hearth', act: 'establishWoman' },

  /* 7.1 — DOCUMENT REGISTER - a thing READ, not a thing said. The establishing move
     belongs to the segment; do not also start a camera track or the same move
     fires twice on one frame (sec 5, BEAT VII).
   */
  { id: 'vii-01-letter1', key: 'letter1',
    text: '“MY DEAR MR. SHERLOCK HOLMES,—You really did it very well. You took me in completely.”',
    speaker: 'LETTER', verb: 'click', seg: 'woman', segDur: 15.0,
    segHold: false, focus: 'two', page: 6, beat: 7, set: 'room', clear: true,
    sfx: 'paper', cameo: 'irene', cap: 'Irene Norton, née Adler' },

  /* 7.2 */
  { id: 'vii-02-letter2', key: 'letter2',
    text: '“Until after the alarm of fire, I had not a suspicion… Yet, with all this, you made me reveal what you wanted to know.”',
    speaker: 'LETTER', verb: 'click', focus: 'two', page: 6, beat: 7,
    set: 'room', fact: 'IV.1' },

  /* 7.3 */
  { id: 'vii-03-flight1', key: 'flight1',
    text: '“We both thought the best resource was flight, when pursued by so formidable an antagonist; so you will find the nest empty when you call to-morrow.”',
    speaker: 'LETTER', verb: 'click', focus: 'two', page: 6, beat: 7,
    set: 'room', clear: true },

  /* 7.4 */
  { id: 'vii-04-flight2', key: 'flight2',
    text: '“As to the photograph, your client may rest in peace… I keep it only to safeguard myself…”',
    speaker: 'LETTER', verb: 'click', focus: 'two', page: 6, beat: 7,
    set: 'room', fact: 'IV.2' },

  /* 7.5 — THE KING IS ON STAGE in this beat - the unmasked actor, reused.
   */
  { id: 'vii-05-indebted', key: 'indebted',
    text: '“I am immensely indebted to you. Pray tell me in what way I can reward you.”',
    speaker: 'KING', verb: 'click', focus: 'client', page: 6, beat: 7,
    set: 'room', clear: true, cameo: null },

  /* 7.6 — INSET plate-irene rises (plateAt 1.4 s, AFTER the push). The only time in the
     book the reader SEES her.
   */
  { id: 'vii-06-valuemore', key: 'valuemore',
    text: '“Your Majesty has something which I should value even more highly…”',
    speaker: 'HOLMES', verb: 'click', dwell: 7.0, focus: 'photo-room', page: 6,
    beat: 7, set: 'room', act: 'irenePlateUp' },

  /* 7.7 — the inset holds.
   */
  { id: 'vii-07-nameit', key: 'nameit', text: '“You have but to name it.”',
    speaker: 'KING', verb: 'click', focus: 'photo-room', page: 6, beat: 7,
    set: 'room' },

  /* 7.8 */
  { id: 'vii-08-thisphoto', key: 'thisphoto', text: '“This photograph!”',
    speaker: 'HOLMES', verb: 'click', dwell: 5.0, focus: 'photo-room', page: 6,
    beat: 7, set: 'room', fact: 'IV.3' },

  /* 7.9 — drop cap; the inset is still up. fact IV.4.
   */
  { id: 'vii-09-beaten', key: 'beaten',
    text: 'And that was how a great scandal threatened to affect the kingdom of Bohemia, and how the best plans of Mr. Sherlock Holmes were beaten by a woman’s wit.',
    speaker: '', verb: 'click', focus: 'photo-room', page: 6, beat: 7,
    set: 'room', clear: true, drop: true, fact: 'IV.4' },

  /* 7.10 — end card; the inset is still up. Turns to leaf 7, the closing card (sec 8.4).
     fact IV.5.
   */
  { id: 'vii-10-thewoman', key: 'thewoman',
    text: 'He used to make merry over the cleverness of women, but I have not heard him do it of late. And when he speaks of Irene Adler, or when he refers to her photograph, it is always under the honourable title of *the* woman.',
    speaker: '', verb: 'click', dwell: 9.5, endsBeat: true, endsBook: true,
    focus: 'photo-room', page: 6, beat: 7, set: 'room', fact: 'IV.5' },
];

/* ------------------------------------------------------------------ *
 * THE BOOK: seven beats, six headings, seven leaves, four SETS.
 *
 * CONTENT-full.md sec 6.1 is this table, and its three traps are all in
 * here rather than in a lane's head:
 *   1. THE BEAT NUMBER IS NOT THE HEADING NUMERAL. Beat 6 prints V and
 *      beat 7 prints VI, because beat 5 shows the reader no heading at all.
 *   2. BEATS 5 AND 6 ARE THE SAME LEAF. Every other beat boundary is a
 *      page turn; V->VI is not, so `leaf` — not `n` — drives the turn.
 *   3. SET REUSE IS THE WHOLE BUDGET: `room` is mounted twice (leaves 1
 *      and 6) and `street` twice (leaves 2 and 5).
 * ------------------------------------------------------------------ */
export const BEATS = [
  { n: 1, num: 'I',   title: 'The Masked Client',  set: 'room',   leaf: 1, units: 38 },
  { n: 2, num: 'II',  title: 'Serpentine Avenue',  set: 'street', leaf: 2, units: 3 },
  { n: 3, num: 'III', title: 'The Pursuit',        set: 'chase',  leaf: 3, units: 12 },
  { n: 4, num: 'IV',  title: 'St. Monica’s',       set: 'church', leaf: 4, units: 17 },
  { n: 5, num: '',    title: 'Serpentine Avenue',  set: 'street', leaf: 5, units: 6,
    noHeading: true },
  { n: 6, num: 'V',   title: 'The Alarm of Fire',  set: 'street', leaf: 5, units: 8 },
  { n: 7, num: 'VI',  title: 'The Woman',          set: 'room',   leaf: 6, units: 11 },
];

/** Beat I is `BEAT`, still, because Beat I's own progress line is its law. */
export const beatOf = (u) => BEATS[((u && u.beat) || 1) - 1];

/**
 * The closing card the LAST unit turns the page into (sec 8.4: this book is
 * Chapter 1 only, so leaf 7 is a closing card in the shape of Beat I's, and
 * nothing follows it).
 *
 * [R6-6] It is a PAGE, not an overlay. Round 0 turned the leaf on the door gate
 * and round 1 left the machinery in place with nothing to fire it (every unit is
 * page 1, so `advance()`'s page test never tripped): the card came up under a
 * permanent 93% cover instead. The card is a page now — the gate runs the same
 * cover turn a page change always ran, the leaf swaps under it, and the cover
 * lifts on a page with no picture on it.
 */
export const END_PAGE = 7;
export const END_CARD = {
  page: END_PAGE,
  kicker: 'End of Chapter I',
  title: 'A Scandal in Bohemia',
  sub: 'the woman · Irene Norton, née Adler',
};

/** Verb default affordance labels (a unit's own `cue` wins). */
export const CUE_DEFAULT = {
  click:  'click to read on',
  hold:   'press and hold',
  auto:   '',
  target: 'click the highlighted thing',
  clock:  '',
};

/** The first-visit affordance hint, faded out after the reader's first click. */
export const FIRST_HINT = 'click anywhere to read on';

/** Every leaf the book turns through — the units' pages, then the card's. */
export const PAGES = [...new Set([...UNITS.map(u => u.page), END_PAGE])];

/** The SET a leaf is mounted on. Two leaves share `room`, two share `street`. */
export const SET_OF_PAGE = (() => {
  const m = {};
  for (const u of UNITS) m[u.page] = u.set || 'room';
  m[END_PAGE] = m[END_PAGE] || null;          // the closing card has no picture
  return m;
})();

/** Resolve a unit by CONTENT.md key or by full id. */
export function unitByKey(k) {
  return UNITS.find(u => u.key === k || u.id === k) || null;
}

/** The four gate targets Beat I owns, and the four beats II-VII add (sec 6.4). */
export const TARGETS_BY_SET = {
  room:   ['mask', 'index', 'door'],
  street: ['station', 'window'],
  chase:  ['cab'],
  church: ['norton'],
};

/** Cheap shape check — the harness asserts this returns []. */
export function validateUnits(units = UNITS) {
  const bad = [];
  const seen = new Set();
  const seenKeys = new Set();
  const VERBS = new Set(['click', 'hold', 'auto', 'target', 'clock']);
  const ALL_TARGETS = new Set(Object.values(TARGETS_BY_SET).flat());
  const SETS = new Set(Object.keys(TARGETS_BY_SET));
  units.forEach((u, i) => {
    const at = `#${i} ${u.id || '(no id)'}`;
    const set = u.set || 'room';
    if (!u.id) bad.push(`${at}: missing id`);
    if (seen.has(u.id)) bad.push(`${at}: duplicate id`);
    seen.add(u.id);
    if (!u.key) bad.push(`${at}: missing key (CONTENT.md id)`);
    if (seenKeys.has(u.key)) bad.push(`${at}: duplicate key`);
    seenKeys.add(u.key);
    if (typeof u.text !== 'string') bad.push(`${at}: text must be a string`);
    if (!VERBS.has(u.verb)) bad.push(`${at}: verb must be one of ${[...VERBS].join('|')}`);
    if (!u.focus) bad.push(`${at}: missing focus`);
    if (!(u.page >= 1)) bad.push(`${at}: page must be >= 1`);
    if (!SETS.has(set)) bad.push(`${at}: unknown set '${set}'`);
    if (u.verb === 'auto' && !(u.dwell > 0)) bad.push(`${at}: auto needs dwell`);
    if (u.verb === 'hold' && !(u.hold > 0)) bad.push(`${at}: hold needs hold seconds`);
    if (u.verb === 'clock' && !(u.at > 0)) bad.push(`${at}: clock needs its t+ offset`);
    if (u.verb === 'target' && !ALL_TARGETS.has(u.target)) {
      bad.push(`${at}: target verb needs target in {${[...ALL_TARGETS].join(',')}}`);
    }
    /* A gate must be reachable ON THE SET IT IS PLAYED ON. The one bug this
       catches is a gate whose target the mounted set has never heard of, which
       is a wedge: the ring paints at the plate's centre and no click can ever
       satisfy it. */
    if (u.verb === 'target' && u.target &&
        !(TARGETS_BY_SET[set] || []).includes(u.target)) {
      bad.push(`${at}: gate '${u.target}' is not a target of SET '${set}'`);
    }
    if (u.verb === 'target' && !u.cue) bad.push(`${at}: target gate needs an explicit cue`);
    if (u.cameo && !u.cap) bad.push(`${at}: cameo needs a caption`);
    if (i > 0 && u.page < units[i - 1].page) bad.push(`${at}: page went backwards`);
    if (i > 0 && u.page !== units[i - 1].page && (u.set || 'room') === units[i - 1].set &&
        u.beat === units[i - 1].beat) {
      bad.push(`${at}: a page turn inside one beat`);
    }
    // a leaf carries exactly one SET, or the turn has nothing to swap
    const first = units.find((v) => v.page === u.page);
    if ((first.set || 'room') !== set) {
      bad.push(`${at}: leaf ${u.page} carries two SETs (${first.set} and ${set})`);
    }
  });
  const WANT = 95;
  if (units.length !== WANT) {
    bad.push(`unit count is ${units.length}, the book is ${WANT} ` +
             `(CONTENT.md 38 + CONTENT-full.md 57)`);
  }
  for (const b of BEATS) {
    const n = units.filter((u) => ((u.beat || 1) === b.n)).length;
    if (n !== b.units) bad.push(`beat ${b.n} has ${n} units, the ledger says ${b.units}`);
  }
  return bad;
}
