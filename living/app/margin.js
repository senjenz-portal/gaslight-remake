/**
 * margin.js — the HTML overlay that sets Doyle's type in the page's dark
 * margin, plus the two identity devices that hang off it: the CAMEO card
 * (lower-left, captioned, flips when the King unmasks) and the hairline
 * LEADER LINE that ties the active speech to the speaker's head.
 *
 * The margin owns NOTHING about pacing: main.js pushes units in, the margin
 * renders them. A unit with `clear: true` starts a fresh stack; without it
 * the unit is appended under the previous one (a continued paragraph).
 * Stacks are capped so the column never scrolls — the rubric's "<=3 lines"
 * pressure — and older blocks recede to ~34% so the eye lands on the newest.
 */
const WHO = {
  '':       { prefix: null },
  SELF:     { prefix: null, dash: true },
  HOLMES:   { prefix: 'Holmes' },
  WATSON:   { prefix: 'Watson' },
  CLIENT:   { prefix: 'the masked client' },
  KING:     { prefix: 'the King' },
  NOTE:     { prefix: 'the note', doc: true },
  /* LETTER renders like NOTE — a document, ruled off at its edge, italic.
     Beat VII's first four units are a letter, not a conversation (sec 2.2). */
  LETTER:   { prefix: 'the letter', doc: true },
  /* The three registers the told story adds (sec 2.1). Doyle sets this speech
     in single quotes INSIDE Holmes' account and attributes it himself; the
     book drops each attribution into the prefix, which is presentation and not
     text — the words between the quotes stay byte-exact. */
  'THE GENTLEMAN':  { prefix: 'the gentleman' },
  'IRENE ADLER':    { prefix: 'Irene Adler' },
  'GODFREY NORTON': { prefix: 'Godfrey Norton' },
};

const MAX_BLOCKS = 3;

/**
 * GUTENBERG'S OWN ITALIC, and only that.
 *
 * Two units in the chapter carry emphasis Doyle's text carries — `lodge`'s
 * *bijou* and `thewoman`'s *the* — and CONTENT-full.md sec 3 is explicit that
 * they "must ship as italic, not as literal underscores". The law writes them
 * as `*word*`, so that is what this reads, and nothing else: no markdown, no
 * bold, no links. Beat I's 38 units contain no asterisk at all, so this cannot
 * change a single glyph of what is already live.
 */
function emphasise(text) {
  const out = [];
  const re = /\*([^*]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    const em = document.createElement('em');
    em.textContent = m[1];
    out.push(em);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out.length ? out : [document.createTextNode(text)];
}

export class Margin {
  constructor(root = document) {
    this.doc = root;
    this.el = root.getElementById('blocks');
    this.cueEl = root.getElementById('cue');
    this.cueSpan = this.cueEl.querySelector('.beat');
    this.progEl = root.getElementById('prog');
    this.hintEl = root.getElementById('hint');
    this.blocks = [];
    this.lastText = '';
    this.nudges = 0;
    this.active = null;
  }

  /** Render one unit. Returns the DOM node it made (or null for empty text). */
  show(unit) {
    if (unit.clear) this.clear();
    this.lastText = unit.text || '';
    if (!unit.text && !unit.head) { this._trim(); this._mark(); return null; }

    const who = WHO[unit.speaker || ''] || { prefix: unit.speaker };
    const blk = document.createElement('div');
    blk.className = 'blk' + (who.doc ? ' doc' : '') + (unit.head ? ' head' : '');
    blk.dataset.unit = unit.id;
    blk.dataset.speaker = unit.speaker || '';

    if (unit.head) {
      const rule = document.createElement('div'); rule.className = 'rule';
      const num = document.createElement('div'); num.className = 'num';
      num.textContent = unit.num || '';
      blk.append(rule, num);
    } else if (who.prefix) {
      const w = document.createElement('span'); w.className = 'who';
      w.textContent = who.prefix;
      blk.append(w);
    }

    const p = document.createElement('p');
    let text = unit.text;
    if (who.dash) text = '—' + text;
    if (unit.drop && text) {
      const cap = document.createElement('span');
      cap.className = 'drop';
      cap.textContent = text[0];
      p.append(cap, ...emphasise(text.slice(1)));
    } else {
      p.append(...emphasise(text));
    }
    blk.append(p);
    this.el.append(blk);
    this.blocks.push(blk);
    void blk.offsetWidth;               // force layout so the fade actually runs
    blk.classList.add('in');
    this._trim();
    this._mark();
    return blk;
  }

  /** Newest block is the live one; the rest recede. */
  _mark() {
    this.blocks.forEach((b, i) => {
      const live = i === this.blocks.length - 1;
      b.classList.toggle('live', live);
      b.classList.toggle('past', !live);
    });
    this.active = this.blocks[this.blocks.length - 1] || null;
  }

  _trim() {
    while (this.blocks.length > MAX_BLOCKS) {
      const old = this.blocks.shift();
      old.remove();
    }
  }

  clear() {
    for (const b of this.blocks) b.remove();
    this.blocks = [];
    this.active = null;
  }

  /** The affordance, set as type in the same margin — never a button. */
  cue(label) {
    this.cueSpan.textContent = label || '';
    this.cueEl.classList.toggle('on', !!label);
  }

  /** A wrong-place click: the cue pulses, nothing advances. */
  nudge() {
    this.nudges++;
    this.cueEl.dataset.nudge = String(this.nudges);
    this.cueEl.classList.remove('nudge');
    void this.cueEl.offsetWidth;
    this.cueEl.classList.add('nudge');
  }

  /** Progress is always visible: no wedge states, no lost readers.
   *  It counts INSIDE the beat, because that is the unit the reader is in —
   *  and Beat V shows no numeral at all, exactly as the reader's page does. */
  progress(beat, i, total) {
    const head = beat.num ? `${beat.num} · ` : '';
    this.progEl.textContent = `${head}${beat.title.toUpperCase()} — unit ${i + 1}/${total}`;
  }

  /**
   * [R6-6] ...and on the closing leaf it names the leaf, not a unit. The page
   * turn takes the last unit off the page; a cue still counting units the reader
   * can no longer see is a cue out of alignment with the book.
   */
  progressEnd() {
    this.progEl.textContent = 'A SCANDAL IN BOHEMIA — end of chapter';
  }

  /** First-visit affordance hint; fades for good after the first advance. */
  hint(on, label) {
    if (label !== undefined) this.hintEl.textContent = label;
    this.hintEl.classList.toggle('on', !!on);
  }

  /** Where the leader line leaves the live speech block (viewport px). */
  anchorPoint(portrait) {
    const b = this.active;
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return portrait
      ? { x: r.left + r.width * 0.5, y: r.top - 4 }
      : { x: r.right + 6, y: r.top + Math.min(28, r.height * 0.5) };
  }

  /** Plain-text transcript of what is currently on the page (harness). */
  text() {
    return this.blocks.map(b => b.textContent.trim()).join('\n');
  }
}

/* ------------------------------------------------------------------ *
 * The cameo card: identity, lower-left, captioned in small caps.
 * The generated cameos are LANDSCAPE busts; the card masks them into a
 * rounded oval and pulls the bust to the top of its frame. A card whose
 * art has not been generated yet still reads — it falls back to a
 * monogram on the same dark ground.
 * ------------------------------------------------------------------ */
export class Cameo {
  constructor(root = document, urls = {}) {
    this.el = root.getElementById('cameo');
    this.imgEl = this.el.querySelector('img');
    this.monoEl = this.el.querySelector('.mono');
    this.capEl = this.el.querySelector('.cap');
    this.urls = urls;
    this.id = null;
    this.missing = [];
    this.imgEl.addEventListener('error', () => {
      this.el.classList.add('noart');
      if (this.id && !this.missing.includes(this.id)) this.missing.push(this.id);
    });
  }

  /**
   * DECODE every cameo before __ready.
   *
   * main.js `probeCameos()` only FETCHED them, which fills the HTTP cache and
   * leaves the decode for whenever the card first shows a face. A decode that
   * lands after the frame is a screenshot that differs between two identical
   * laps: measured, 7602 pixels of this card differed at 01-i-01-post (portrait)
   * between two consecutive round-6 laps, and nothing else in either frame did.
   * It is also a pop-in a reader sees. With the bitmaps decoded and held, setting
   * `src` paints from memory on the next frame.
   */
  async preload() {
    this.decoded = {};
    await Promise.all(Object.entries(this.urls).map(async ([id, url]) => {
      try {
        const im = new Image();
        im.src = url;
        await (im.decode ? im.decode()
          : new Promise((res, rej) => { im.onload = res; im.onerror = rej; }));
        this.decoded[id] = im;                     // held, so the cache keeps it
      } catch (_) { /* a cameo with no art already degrades to the monogram */ }
    }));
    return Object.keys(this.decoded);
  }

  /** Show `id` with `caption`. Same id twice is a no-op; a change FLIPS. */
  set(id, caption) {
    if (!id) { this.hide(); return; }
    if (id === this.id) return;
    const flip = !!this.id && this.id !== id;
    this.id = id;
    this.el.classList.remove('noart');
    const url = this.urls[id];
    if (url) { this.imgEl.src = url; } else { this.el.classList.add('noart'); }
    this.monoEl.textContent = (caption || id).replace(/[^A-Za-z]/g, '').slice(0, 1) || '?';
    this.capEl.textContent = caption || '';
    this.el.classList.add('on');
    if (flip) {
      this.el.classList.remove('flip');
      void this.el.offsetWidth;
      this.el.classList.add('flip');
    }
    this.el.dataset.cameo = id;
  }

  hide() { this.el.classList.remove('on'); this.id = null; }

  snapshot() {
    return { id: this.id, caption: this.capEl.textContent,
             on: this.el.classList.contains('on'),
             art: !this.el.classList.contains('noart'), missing: this.missing.slice() };
  }
}

/* ------------------------------------------------------------------ *
 * The leader line: a hairline from the live speech toward the speaker's
 * head. Screen-space SVG, recomputed whenever the camera moves. Skipped
 * for narration and for anything READ (the note is not a speaker).
 * ------------------------------------------------------------------ */
export class Leader {
  constructor(root = document) {
    this.svg = root.getElementById('leader');
    this.path = this.svg.querySelector('path');
    this.dot = this.svg.querySelector('circle');
    this.on = false;
  }

  clear() {
    if (!this.on) return;
    this.on = false;
    this.svg.classList.remove('on');
  }

  /** a = margin anchor {x,y}; b = head point {x,y}; both viewport px. */
  draw(a, b, portrait) {
    if (!a || !b) { this.clear(); return false; }
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 46) { this.clear(); return false; }
    // a short elbow that leaves the type horizontally (or vertically in
    // portrait) and then runs to the head: it reads as a pointer, not a wire.
    const mx = portrait ? a.x + dx * 0.18 : a.x + Math.max(26, dx * 0.36);
    const my = portrait ? a.y + dy * 0.42 : a.y;
    this.path.setAttribute('d',
      `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${mx.toFixed(1)} ${my.toFixed(1)} ` +
      `L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    this.dot.setAttribute('cx', b.x.toFixed(1));
    this.dot.setAttribute('cy', b.y.toFixed(1));
    if (!this.on) { this.on = true; this.svg.classList.add('on'); }
    return true;
  }
}
