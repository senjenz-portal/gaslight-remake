/**
 * stage.js — THE STAGE SHELL: the space, the camera, the insets, and the SET
 * that is mounted in it.
 *
 * Beat I had one set and stage.js WAS that set. The chapter has four, on seven
 * leaves, and the thing they share is not their contents — it is the space:
 *
 *   PLATE PIXELS, 1408x768, the space every asset manifest is written in.
 *   `#cam` is literally 1408x768 px wide, so a layer's box is the manifest's
 *   own numbers with no conversion, and two nested transforms do the rest:
 *       #fit   scale(F)                — the plate box into whatever panel it got
 *       #cam   translate(...) scale(k) — the CAMERA, a push in plate space
 *   The projection is isometric, which the asset lane measured and wrote down:
 *   an actor's height does NOT change with depth, only his floor line moves.
 *
 * ONE SET IS MOUNTED AT A TIME, and a set is not mounted until its bytes are
 * decoded. That is the whole lazy-load rule and it is enforced by the page
 * turn: the cover rises, `ensure()` is awaited UNDER it, and the cover does
 * not fall until the incoming set can paint. A reader cannot outrun a leaf he
 * has not turned to yet — which is the multi-set form of Beat I's own law that
 * nothing the story reveals is still on the wire.
 *
 * THE LIGHT. When a plate rises, the world does not get a grey veil thrown
 * over it — it crossfades to the LANE'S PAINTED RELIGHT, and the cut-outs
 * standing in it are put through the same relight as a colour matrix. Each SET
 * carries its own measured matrix (the room's 0.448/0.588/0.754, the street's
 * 0.725/0.868/0.962, the church's 0.435/0.746/1.0), because each relight is a
 * different painting. A dimmed painting and an undimmed actor standing in it
 * is the single loudest way this stack can look like a collage.
 *
 * TIME. Nothing here reads a wall clock. Every animation is (t - t0)/dur
 * against the sim clock, so two laps that step the same numbers paint the same
 * pixels.
 */
import { PLATE, el, box, clamp01, easeInOut, damp } from './setkit.js';
import { ShoreSet } from './sets/shore.js';
import { CaveSet } from './sets/cave.js';
import { SeaSet } from './sets/sea.js';

const SETS = { shore: ShoreSet, cave: CaveSet, sea: SeaSet };
export { SETS };

/* [shot] THE ZOOM CAP — the law that replaces the [closeup] floors: digital
 * zoom is capped at k <= 2.5 anywhere no shot exists. A unit whose floor
 * needs more DECLARES A SHOT (shot:'<name>') and the stage crossfades to a
 * full-frame NATIVE plate instead of magnifying the painting. THE CAP
 * BECOMES LAW PER-UNIT AS SHOTS ARRIVE: main.js arms `capLens` on the units
 * that declare a shot; a unit still AWAITING its shot keeps its close-up
 * lens (its [closeup] floor is still the law for it), and the lap's [shot]
 * gate is the ratchet that refuses an above-cap lens anywhere else. */
export const SHOT_KCAP = 2.5;
/* [shot] the crossfade takes the CEILING of the teleport-law band (150-250
 * ms): a full-frame handoff is the heaviest cut the stage makes. */
export const SHOT_FADE = 0.25;

export class Stage {
  constructor(root, base = './assets/') {
    this.base = base;
    /* A reader who has asked the OS for less motion still gets the whole story:
       the walks, the plates and the page turn are the story. What goes is the
       ambient loop nobody asked for — the breath, the sway, the flicker. */
    this.reduced = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.root = root;                       // #stage, the aspect-locked panel
    this.fit = el('div', 'fit', root);
    this.cam = el('div', 'cam', this.fit);
    this.F = 1;
    this.building = [];                     // the pending list of the set being built
    this.sets = {};                         // name -> { set, wrap, ready, missing }
    this.active = null;
    this.activeName = null;
    this.audio = null;                      // main.js hands the mixer over
    this.gaps = [];                         // art the engine asked for and did not get

    /* ---- the inset plates: screen-space, OUTSIDE the camera --------- */
    this.insetWrap = el('div', 'insets', root);
    this.insets = {};

    /* [shot] THE SHOT RAIL: full-frame native plates, INSIDE #fit (they are
       plate-space pictures and take the fit scale F) but OUTSIDE #cam (a shot
       is its own composed frame — the camera push must not move it, and the
       zoom cap does not apply to it: its k is identically 1). It sits over
       the cam and under the insets: an inset plate may still rise over a
       shot, because a risen inset owns the whole frame (the plate law). */
    this.shotWrap = el('div', 'shotrail', this.fit);
    this.shotWrap.style.cssText =
      'position:absolute;left:0;top:0;width:1408px;height:768px;pointer-events:none;';
    this.shots = {};
    /* [shot] the zoom-cap arm — set per unit by main.js (true on shot units) */
    this.capLens = false;

    this.cam3 = { x: 704, y: 384, k: 1, wx: 704, wy: 384, wk: 1 };
    this.state = { dim: 0, reveal: 0, hold: 0, t: 0, plate: {} };
    this.acts = [];
    this.damp = damp;

    /* ---- [post] R3 (SYNTHESIS): ONE SHARED GRAIN over the composed stack.
       A single BAKED tile (tools/ody/seamless/bake_grain.py, seeded numpy —
       registry tools/ody/grain.json) blended `overlay` over plate + actors +
       insets + shots, LAST child of the isolated #stage, under the one
       stage-level feComponentTransfer grade (index.html #gradef). STATIC on
       purpose: no wall clock, no jitter — two laps that step the same
       numbers paint byte-identical frames. Styling lives in index.html
       (#stage .fxgrain); here only the element and its preload: the tile is
       a byte the very first frame reveals, so it joins the FIRST set's
       decode set (the lazy-load law). */
    this.grain = el('div', 'fxgrain', root);
    const gimg = new Image();
    gimg.decoding = 'sync';
    gimg.src = this.base + 'fx/grain.png';
    this._fxPending = [{ src: gimg.src, decode: () => gimg.decode() }];
    this.layout();
  }

  /* ---- asset plumbing the sets call ---------------------------------- */
  img(file, cls, parent) {
    const e = el('img', cls, parent || this.cam);
    e.decoding = 'sync';
    e.alt = '';
    e.setAttribute('aria-hidden', 'true');
    e.src = this.base + file;
    this.building.push(e);
    return e;
  }

  /**
   * A bitmap painted as a CSS background instead of as an <img>. It goes in the
   * SAME preload set, and it has to: a background is only fetched when a rule
   * first needs it, and the rule that needs a walk strip is written on the frame
   * the walk begins. On localhost that read as instant. On the deployed site the
   * King's entrance played with no King in it — his 736 KB strip was still on
   * the wire while the sim walked an invisible man across the floor. Anything
   * the story can reveal has to be decoded before its leaf is mounted, whatever
   * paints it.
   */
  bitmap(file) {
    const e = new Image();
    e.decoding = 'sync';
    e.src = this.base + file;
    this.building.push(e);
    return `url(${this.base}${file})`;
  }

  /** audio hooks a SET may pull (the ruse's delayed cry, the pursuit's gain) */
  cue(id, delay) { if (this.audio) this.audio.cue(id, { delay: delay || 0 }); }
  gain(id, v) { if (this.audio && this.audio.setBedGain) this.audio.setBedGain(id, v); }

  /**
   * THE ONE LOAD, made literal — every video element (hero-clip inset, shot
   * clip) gets its bytes through HERE and nowhere else.
   *
   * The old law assigned `vid.src = url` and trusted the media engine to
   * fetch once. But the media engine is NOT a one-shot fetcher: Chromium's
   * media resource loader runs its own budget, and with the SHOT rail the
   * cave ensure() went from 3 mp4s to 5 — past that budget it SUSPENDS a
   * request mid-flight and later cancels it ITSELF: net::ERR_ABORTED for
   * bytes that were arriving fine, seconds after ensure() resolved, with no
   * navigation and no reset anywhere near (the lap watched shot/drive.mp4
   * hang 15 s after its four siblings landed, then die). And every play()
   * or rewind reopened range requests the next teardown could abort — the
   * band probe already routed around one such ghost on a fresh page.
   *
   * So the network is taken OUT of the media element's hands: the bytes are
   * fetched ONCE with fetch() — a request that COMPLETES and closes — and
   * the element is handed an in-memory blob: URL. From a blob src the media
   * engine never touches the wire again: play, seek, rewind, loop are all
   * memory reads. No request is ever left open, so none can be aborted.
   *
   * The laws hold unchanged: the fetch joins the SAME decode set (lazy-load
   * — nothing the story can reveal is still on the wire when the cover
   * falls), `ready` still settles only when the element can PLAY the bytes
   * (canplaythrough), a fetch that fails feeds ensure()'s gap path exactly
   * as a broken src did, and a reduced-motion reader keeps the poster still
   * and is owed no video bytes at all. The blob URL is never revoked: the
   * element re-plays it for the life of the page.
   */
  loadVideo(vid, file) {
    const src = this.base + file;
    const ready = this.reduced ? Promise.resolve()   // still page: bytes not owed
      : fetch(src)
        .then((r) => { if (!r.ok) throw new Error('video ' + file); return r.blob(); })
        .then((b) => new Promise((ok, err) => {
          vid.addEventListener('canplaythrough', () => ok(), { once: true });
          vid.addEventListener('error', () => err(new Error('video ' + file)), { once: true });
          vid.src = URL.createObjectURL(b);
          if (vid.readyState >= 3) ok();
        }));
    ready.catch(() => {});   // settled early is fine; ensure()'s gap path reads it
    this.building.push({ src, decode: () => ready });
  }

  /* ---- SETS: build once, decode once, mount one ---------------------- */
  /**
   * Build `name` if it has never been built, and resolve when every byte it
   * can reveal is DECODED. Safe to call twice — the second call gets the same
   * promise, so a page turn that races a preflight cannot build two sets.
   */
  ensure(name) {
    const have = this.sets[name];
    if (have) return have.ready;
    const Cls = SETS[name];
    if (!Cls) return Promise.reject(new Error('no such SET: ' + name));

    const wrap = el('div', 'set', this.cam);
    wrap.dataset.set = name;
    wrap.style.display = 'none';
    const prev = this.building;
    this.building = [];
    const set = new Cls(wrap, this);
    // the insets this SET may raise are its bytes too, and they decode with it
    for (const [id, file] of Object.entries(Cls.insets || {})) this.makeInset(id, file);
    // ... and so are its HERO CLIPS (video insets): poster AND mp4 decode with it
    for (const [id, spec] of Object.entries(Cls.clips || {})) this.makeClip(id, spec);
    // [shot] ... and so are its SHOTS: a full-frame plate a unit may declare
    // is a byte the story can reveal, so it decodes WITH its set (lazy-load law)
    for (const [id, spec] of Object.entries(Cls.shots || {})) this.makeShot(id, spec);
    const pending = this.building;
    this.building = prev;
    /* [post] the grain tile decodes with the FIRST set built — it is on the
       very first composed frame, so it may not still be on the wire */
    if (this._fxPending) { pending.push(...this._fxPending); this._fxPending = null; }

    const rec = { set, wrap, missing: [], ready: null };
    rec.ready = Promise.all(pending.map(async (im) => {
      try { await (im.decode ? im.decode() : Promise.resolve()); }
      catch (_) { rec.missing.push(im.getAttribute ? im.getAttribute('src') : im.src); }
    })).then(() => {
      rec.decoded = true;
      for (const src of rec.missing) {
        const id = Object.entries(this.insets).find(([, v]) =>
          (v.file && (this.base + v.file) === src) ||
          (v.poster && (this.base + v.poster) === src));
        if (id) { this.insets[id[0]].art = false; this.gaps.push('inset:' + id[0]); }
        else this.gaps.push('bitmap:' + String(src).split('/').slice(-2).join('/'));
      }
      return rec;
    });
    this.sets[name] = rec;
    return rec.ready;
  }

  /**
   * Show one SET and hide the rest. The SET must already be `ensure`d.
   *
   * A SET ONLY STEPS WHILE IT IS MOUNTED, so an unmounted one's clock stands
   * still while the book's does not — and every act in this stack timestamps
   * itself off that clock (`S.roll = t`, `S.ruse = t`). Mounting a set that has
   * been off stage for 200 s and firing an act on it therefore starts an
   * 8-second pursuit 200 seconds in the past, and it is over before it is
   * drawn. So the shell hands the set the current time on the way in. (Found by
   * the lap: the pursuit's gap read its finished value, 13.99 m, on the very
   * first sample after the gate.)
   */
  mount(name) {
    const rec = this.sets[name];
    if (!rec) throw new Error('SET not ensured before mount: ' + name);
    for (const [n, r] of Object.entries(this.sets)) {
      r.wrap.style.display = n === name ? '' : 'none';
    }
    rec.set.state.t = this.state.t;
    this.active = rec.set;
    this.activeName = name;
    this.applyDimMatrix();
    return rec.set;
  }

  /**
   * Is this SET already decoded, ANSWERED SYNCHRONOUSLY?
   *
   * `ensure()` returns a promise even when there is nothing left to wait for,
   * and a promise resolves on a microtask — which does not run until the call
   * stack yields. Live, the stack yields every frame and nobody notices. Under
   * the harness one `__advance(1.6)` steps the whole 1.6 s inside a single
   * call, so a turn that asked a resolved promise "are you ready" got its
   * answer only AFTER the advance was over, and the cover sat up for the rest
   * of it. Beat VI's page turn is timed to 19.8 s by the beat's own clock, so
   * that stall was visible as a page that turned late. A set that is already
   * decoded has to be able to say so without yielding.
   */
  decoded(name) { return !!(this.sets[name] && this.sets[name].decoded); }

  /** Every SET the book touches, decoded. Used by the harness, not by boot. */
  async preloadAll() {
    await Promise.all(Object.keys(SETS).map((n) => this.ensure(n)));
    return this.gaps.slice();
  }

  /* ---- the inset plates ---------------------------------------------- */
  makeInset(id, file) {
    if (this.insets[id]) return this.insets[id];
    const card = el('div', 'inset', this.insetWrap);
    const im = this.img(file, 'insetimg', card);
    const glow = el('div', 'wglow', card);
    if (id === 'watermark') glow.style.display = 'block';
    const rec = { card, im, glow, k: 0, want: 0, file, art: true, delay: 0, at: -1e9 };
    this.insets[id] = rec;
    return rec;
  }

  /**
   * A VIDEO inset — the HERO CLIP card. Same card, same rise, same dim, same
   * law as the image plates; what is printed on it is a muted close-up clip
   * seeded from the staged tableau itself. The DETERMINISM law holds because
   * the card is treated exactly like an inset: the sim drives raised/lowered
   * (k, want, at), the world beneath is untouched, and the clip's first frame
   * IS the poster the registry shas — the video element merely plays that
   * same picture forward on the wall clock while the card is up.
   *
   * A reader who asked the OS for less motion gets the POSTER STILL: the
   * close-up fact still lands (the card, the frame, the dim), only the loop
   * nobody asked for is gone — the same trade every ambient makes.
   *
   * The clip's bytes decode WITH ITS SET (the lazy-load law): the poster
   * rides the normal img path and the mp4 joins the same preload set through
   * a decode shim, so nothing the story can reveal is still on the wire.
   */
  makeClip(id, spec) {
    if (this.insets[id]) return this.insets[id];
    const card = el('div', 'inset', this.insetWrap);
    const im = this.img(spec.poster, 'insetimg', card);
    const vid = document.createElement('video');
    vid.className = 'insetimg';
    vid.muted = true; vid.defaultMuted = true;
    vid.loop = !!spec.loop;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('muted', '');
    vid.setAttribute('aria-hidden', 'true');
    vid.preload = 'auto';
    if (this.reduced) vid.style.display = 'none';   // the poster carries the frame
    card.appendChild(vid);                          // over the poster while playing
    this.loadVideo(vid, spec.file);                 // THE ONE LOAD (blob law, above)
    const rec = { card, im, vid, k: 0, want: 0, file: spec.file, poster: spec.poster,
                  loop: !!spec.loop, art: true, playing: false, delay: 0, at: -1e9 };
    this.insets[id] = rec;
    return rec;
  }

  /**
   * Raise one inset plate (and dim the world under it), or take them all down.
   * `after` delays the RAISE without delaying the push, which is Beat VII's
   * `plateAt 1.4 s`: the camera gets there first and the plate lands on a frame
   * that is already composed.
   *
   * An inset whose art never decoded is NOT raised. Beat V's `plate-rocket` is
   * an open art gap (7.2 #9); raising an empty card over a dimmed street would
   * put a hole where a fact-carrier belongs, so the engine leaves the world up
   * and records the gap instead.
   */
  plate(id, k, after = 0) {
    for (const name of Object.keys(this.insets)) {
      const it = this.insets[name];
      const want = (name === id) ? k : 0;
      if (want && !it.art) {
        if (!this.gaps.includes('raise:' + name)) this.gaps.push('raise:' + name);
        continue;
      }
      it.want = want;
      it.at = want ? this.state.t + (after || 0) : -1e9;
    }
  }

  /**
   * Raise one HERO CLIP card (or take them all down) — the video-inset half
   * of plate()'s law, scoped so the two kinds cannot fight: clip() never
   * touches an image plate (the wineskin keeps its own §6 grant) and plate()
   * lowering everything still lowers clips, because a risen image plate owns
   * the whole frame. `after` delays the RAISE without delaying the world —
   * the seize card lands on a clutch already composed, the splash card on
   * the land tick itself.
   */
  clip(id, k, after = 0) {
    for (const name of Object.keys(this.insets)) {
      const it = this.insets[name];
      if (!it.vid) continue;
      const want = (name === id) ? k : 0;
      if (want && !it.art) {
        if (!this.gaps.includes('raise:' + name)) this.gaps.push('raise:' + name);
        continue;
      }
      it.want = want;
      it.at = want ? this.state.t + (after || 0) : -1e9;
    }
  }

  /* ---- [shot] the SHOT rail ------------------------------------------ */
  /**
   * [shot] Register one SHOT — a full-frame NATIVE plate (1408x768, the
   * plate space) a unit may declare with `shot:'<name>'`. Image or looping
   * clip; a clip's first frame IS its poster (the heroclip law), and a
   * reader who asked the OS for less motion gets the POSTER STILL — the
   * close-up fact still lands, only the loop nobody asked for is gone.
   *
   * spec: { file, [clip, loop], targets: {name:[x,y]}, holds: {name:[x,y]},
   *         heads: {who:[x,y]} } — anchors are SHOT-SPACE plate px: while
   * the shot is up, the gate ring, the hold ring and the leader line stand
   * where the SHOT paints their subject, not where the world beneath does.
   */
  makeShot(id, spec) {
    if (this.shots[id]) return this.shots[id];
    const card = el('div', 'shotcard', this.shotWrap);
    card.style.cssText =
      'position:absolute;left:0;top:0;width:1408px;height:768px;opacity:0;';
    const im = this.img(spec.file, 'shotimg', card);
    im.style.cssText = 'position:absolute;left:0;top:0;width:1408px;height:768px;';
    let vid = null;
    if (spec.clip) {
      vid = document.createElement('video');
      vid.className = 'shotimg';
      vid.style.cssText = im.style.cssText;
      vid.muted = true; vid.defaultMuted = true;
      vid.loop = spec.loop !== false;             // a shot clip loops by default
      vid.playsInline = true;
      vid.setAttribute('playsinline', '');
      vid.setAttribute('muted', '');
      vid.setAttribute('aria-hidden', 'true');
      vid.preload = 'auto';
      if (this.reduced) vid.style.display = 'none';   // the poster carries the frame
      card.appendChild(vid);
      this.loadVideo(vid, spec.clip);             // THE ONE LOAD (blob law)
    }
    const rec = { card, im, vid, k: 0, want: 0, at: -1e9, art: true,
                  playing: false, file: spec.file,
                  targets: spec.targets || {}, holds: spec.holds || {},
                  heads: spec.heads || {} };
    this.shots[id] = rec;
    return rec;
  }

  /**
   * [shot] Raise one SHOT (or take them all down) — plate()'s want/at law,
   * scoped to the shot rail. The RAISE and the FALL are each a fixed 250 ms
   * eased crossfade driven off the SIM clock (see step()), so a lap that
   * steps the same numbers paints the same frames (determinism law) and the
   * lap's [shot] gate can measure the band. The world beneath is untouched:
   * a shot is a card the sim asserts, not a fact the sim reads — the set
   * keeps stepping, its clocks keep counting, and the crossfade off the
   * shot lands on a world that kept living (its lens capped at SHOT_KCAP).
   */
  shot(id, after = 0) {
    for (const name of Object.keys(this.shots)) {
      const it = this.shots[name];
      const want = (name === id) ? 1 : 0;
      if (want && !it.art) {
        if (!this.gaps.includes('shot:' + name)) this.gaps.push('shot:' + name);
        continue;
      }
      if (it.want !== want) it.at = want ? this.state.t + (after || 0) : this.state.t;
      it.want = want;
    }
    if (id && !this.shots[id]) this.gaps.push('shot-unknown:' + id);
  }

  /** [shot] the shot that owns the frame right now (k past half), or null */
  shotUp() {
    let best = null;
    for (const [id, it] of Object.entries(this.shots)) {
      if (it.k >= 0.5 && (!best || it.k > this.shots[best].k)) best = id;
    }
    return best;
  }

  /** [shot] shot-space plate px -> viewport px. A shot is never camera-
   *  pushed: k = 1 identically, only the fit scale and the portrait crop
   *  translate apply (the same vis crop the world gets — shot plates are
   *  authored with the subject inside the portrait-safe band). */
  shotToScreen(px, py) {
    const r = this.rect || this.root.getBoundingClientRect();
    const V = this.vis || { w: PLATE.w, h: PLATE.h };
    const X = (V.w - PLATE.w) / 2;               // centre crop, 0 in landscape
    return { x: r.left + (px + X) * this.F, y: r.top + py * this.F };
  }

  /** [shot] viewport px -> shot-space plate px */
  shotToPlate(sx, sy) {
    const r = this.rect || this.root.getBoundingClientRect();
    const V = this.vis || { w: PLATE.w, h: PLATE.h };
    const X = (V.w - PLATE.w) / 2;
    return { x: (sx - r.left) / this.F - X, y: (sy - r.top) / this.F };
  }

  setHold(k) {
    this.state.hold = clamp01(k);
    if (this.active && this.active.setHold) this.active.setHold(k);
  }

  setReveal(id, k) {
    this.state.reveal = clamp01(k);
    if (id === 'watermark' && this.insets.watermark) {
      this.insets.watermark.want = clamp01(k);
      this.insets.watermark.at = this.state.t;
    }
  }

  /* ---- the camera ---------------------------------------------------- */
  focusPlate(name) {
    if (!this.active) return [704, 384, 1];
    return this.active.focusPlate(name);
  }

  setFocus(name, snap) {
    /* A SET may take the camera off the unit — Beat VI is the one stretch of
       the book the reader does not pace, and once the rocket is in the air the
       camera owns the frame (sec 8.3). */
    const over = this.active && this.active.camOverride && this.active.camOverride();
    const f = this.focusPlate(over || name);
    /* [shot] THE ZOOM CAP: on a unit whose close arrives as a SHOT — a native
       plate — no lens digitally magnifies the painting past SHOT_KCAP; the
       world beneath the shot settles at the capped lens so the fade off the
       shot lands on a composed frame. main.js arms `capLens` per unit — the
       cap becomes law per-unit as shots arrive (a unit still AWAITING its
       shot keeps its close-up lens and its [closeup] floor). */
    const k = this.capLens ? Math.min(f[2], SHOT_KCAP) : f[2];
    this.cam3.wx = f[0]; this.cam3.wy = f[1]; this.cam3.wk = k;
    if (snap) { this.cam3.x = f[0]; this.cam3.y = f[1]; this.cam3.k = k; }
  }

  applyCam() {
    const c = this.cam3;
    const V = this.vis || { w: PLATE.w, h: PLATE.h };
    let X = V.w / 2 - c.x * c.k;
    let Y = V.h / 2 - c.y * c.k;
    // never show past the edge of the painting
    X = Math.min(0, Math.max(V.w - PLATE.w * c.k, X));
    Y = Math.min(0, Math.max(V.h - PLATE.h * c.k, Y));
    this.camX = X; this.camY = Y;
    this.cam.style.transform = `translate(${X.toFixed(2)}px,${Y.toFixed(2)}px) scale(${c.k.toFixed(4)})`;
  }

  /**
   * How much of the painting the panel shows. Landscape shows the whole plate,
   * void margins and all — the diorama floating on a dark page IS the plate's
   * own composition. A portrait screen cannot afford them: at 1.83:1 the
   * picture collapses to a third of the leaf and the prose is left stranded
   * under a strip. So portrait CROPS to the painted subject instead of
   * shrinking it — same painting, framed for the screen.
   */
  setView(w, h) { this.vis = { w, h }; }

  /** Fit the visible plate box into the panel it was given. */
  layout() {
    const r = this.root.getBoundingClientRect();
    if (!this.vis) this.vis = { w: PLATE.w, h: PLATE.h };
    this.F = r.width / this.vis.w;
    this.fit.style.transform = `scale(${this.F})`;
    this.rect = r;
  }

  /** plate px -> viewport px (for the rings, the leader, hit tests). */
  toScreen(px, py) {
    const r = this.rect || this.root.getBoundingClientRect();
    return { x: r.left + (px * this.cam3.k + this.camX) * this.F,
             y: r.top + (py * this.cam3.k + this.camY) * this.F };
  }

  /** viewport px -> plate px */
  toPlate(sx, sy) {
    const r = this.rect || this.root.getBoundingClientRect();
    return { x: ((sx - r.left) / this.F - this.camX) / this.cam3.k,
             y: ((sy - r.top) / this.F - this.camY) / this.cam3.k };
  }

  /* ---- what the reader can point at ---------------------------------- */
  /* [shot] ANCHORS FOLLOW THE FRAME THE READER SEES. While a shot owns the
     frame, a target/hold/leader anchor the shot declares stands where the
     SHOT paints its subject (shot-space plate px, mapped by shotToScreen);
     anything the shot does not declare falls through to the world beneath.
     main.js asks `anchorScreen`/`targetHit` and never needs to know which
     space answered — the pair is the WHOLE main.js mapping delta. */
  targetPlate(name) {
    const s = this.shotUp();
    if (s && this.shots[s].targets[name]) return this.shots[s].targets[name];
    const p = this.active && this.active.targetPlate(name);
    return p || [704, 384];
  }

  targetLive(name) {
    const s = this.shotUp();
    if (s && this.shots[s].targets[name]) return true;   // the shot stages it
    return !!(this.active && this.active.targetLive(name));
  }

  targetHit(name, sx, sy) {
    const s = this.shotUp();
    if (s && this.shots[s].targets[name]) {
      const a = this.shots[s].targets[name];
      const p = this.shotToPlate(sx, sy);
      return Math.hypot(p.x - a[0], p.y - a[1]) <= 64;   // native-close subject
    }
    if (!this.active) return false;
    return this.active.targetHit(name, this.toPlate(sx, sy));
  }

  headPlate(who) {
    const s = this.shotUp();
    if (s && this.shots[s].heads[who]) return this.shots[s].heads[who];
    return this.active ? this.active.headPlate(who) : null;
  }

  holdAnchor() {
    const s = this.shotUp();
    if (s) {
      const h = Object.values(this.shots[s].holds);
      if (h.length) return h[0];
    }
    const a = this.active && this.active.holdAnchor && this.active.holdAnchor();
    return a || [this.cam3.x, this.cam3.y];
  }

  /** [shot] anchor -> viewport px through WHICHEVER space staged it */
  anchorScreen(kind, name) {
    const s = this.shotUp();
    const table = s && (kind === 'target' ? this.shots[s].targets
                : kind === 'head' ? this.shots[s].heads : this.shots[s].holds);
    if (table && (name ? table[name] : Object.values(table)[0])) {
      const a = name ? table[name] : Object.values(table)[0];
      return this.shotToScreen(a[0], a[1]);
    }
    const a = kind === 'target' ? this.targetPlate(name)
      : kind === 'head' ? this.headPlate(name) : this.holdAnchor();
    return a ? this.toScreen(a[0], a[1]) : null;
  }

  /* ---- the verbs ------------------------------------------------------ */
  /**
   * A verb the story fires at the SET.
   *
   * `settled` is the same promise `startSeg` already makes and for the same
   * reason: a REPLAYED act (a harness jump, or any non-linear entry) must leave
   * the world where the story would have left it, not at the first frame of a
   * 2.6 s walk. Without it the book's own portrait proof was captured with
   * Norton caught mid-drag beside the groom the plate was still painting.
   */
  fire(act, settled = false) {
    this.acts.push(act);
    if (this.active) this.active.fire(act, settled);
  }

  /**
   * A timed SEGMENT of pantomime; the unit list says which and how long.
   *
   * `settled` runs it to its END instead of its start, and it is what a
   * harness jump needs: a replayed unit must leave the world where the STORY
   * would have left it, not three tenths of a second into a six-second
   * vignette. (Found by eye: jumping to `toogood` landed mid `chase-intro`,
   * so Irene was still standing at the hall door she had already left.)
   */
  startSeg(name, dur, settled = false) {
    this.acts.push('seg:' + name);
    if (this.active && this.active.startSeg) {
      this.active.startSeg(name, dur, this.state.t - (settled ? dur : 0));
    }
  }

  /** has the thing a `wait:` unit named actually happened on stage yet? */
  waitDone(name) {
    if (!name) return true;
    if (this.active && this.active.waitDone) return this.active.waitDone(name);
    return true;
  }

  /** the clock a `clock` unit is timed against (Beat VI's throw) */
  clockT() {
    if (this.active && this.active.ruseT) return this.active.ruseT();
    return null;
  }

  reset() {
    this.acts = [];
    for (const name of Object.keys(this.insets)) {
      const it = this.insets[name];
      it.k = 0; it.want = 0; it.at = -1e9;
      if (it.vid && it.playing) {
        it.playing = false;
        it.vid.pause();
        try { it.vid.currentTime = 0; } catch (_) { /* poster on next raise */ }
      }
    }
    /* [shot] shots fall with everything else */
    for (const name of Object.keys(this.shots)) {
      const it = this.shots[name];
      it.k = 0; it.want = 0; it.at = -1e9;
      it.card.style.opacity = '0';
      if (it.vid && it.playing) {
        it.playing = false;
        it.vid.pause();
        try { it.vid.currentTime = 0; } catch (_) { /* poster on next raise */ }
      }
    }
    this.state.dim = 0; this.state.reveal = 0; this.state.hold = 0;
    for (const rec of Object.values(this.sets)) {
      rec.set.reset();
      rec.set.state.t = this.state.t;      // see mount(): a stale clock is a bug
    }
    this.cam3 = { x: 704, y: 384, k: 1, wx: 704, wy: 384, wk: 1 };
  }

  applyDimMatrix() {
    if (!this.dimMatrix || !this.active) return;
    const m = this.active.dimMatrix;
    const v = m.map((c) => (1 - (1 - c) * this.state.dim));
    this.dimMatrix.setAttribute('values',
      `${v[0]} 0 0 0 0  0 ${v[1]} 0 0 0  0 0 ${v[2]} 0 0  0 0 0 1 0`);
  }

  /* ---- one fixed step ------------------------------------------------- */
  step(t, dt) {
    this.state.t = t;
    /* The panel's box is re-read at the TOP of every step, before this frame's
       writes. Caching it in layout() alone was wrong: the wrap slides during a
       page turn and a viewport change lands a frame before its resize event,
       and a stale box silently moves every screen mapping — the ring, the hit
       test, the leader — with nothing on screen to show it. */
    this.rect = this.root.getBoundingClientRect();

    this.cam3.x = damp(this.cam3.x, this.cam3.wx, 3.2, dt);
    this.cam3.y = damp(this.cam3.y, this.cam3.wy, 3.2, dt);
    this.cam3.k = damp(this.cam3.k, this.cam3.wk, 3.2, dt);
    this.applyCam();

    /* ---- the insets, and the dim they rise over -------------------- */
    let dim = 0;
    for (const id of Object.keys(this.insets)) {
      const P = this.insets[id];
      const want = (P.want && t >= P.at) ? P.want : 0;
      P.k = damp(P.k, want, 5.0, dt);
      if (P.k < 1e-3) P.k = want > 0 ? P.k : 0;
      this.state.plate[id] = P.k;
      dim = Math.max(dim, P.k);
      const e = easeInOut(P.k);
      P.card.style.opacity = e.toFixed(3);
      P.card.style.transform =
        `translateY(${((1 - e) * 26).toFixed(2)}px) scale(${(0.965 + 0.035 * e).toFixed(4)})`;
      P.card.style.pointerEvents = 'none';
      /* a HERO CLIP plays while its card is up. The sim decides WHEN (want/at,
         deterministic); the wall clock merely advances the frames of a card
         the sim has already asserted. Rewound on the way down so a re-raise
         (a jump, a re-read) always starts from the poster frame — the card's
         contents are a pure function of "how long has this card been up". */
      if (P.vid) {
        if (want > 0 && !P.playing) {
          P.playing = true;
          if (!this.reduced) {
            try { P.vid.currentTime = 0; } catch (_) { /* not yet seekable */ }
            const pr = P.vid.play();
            if (pr && pr.catch) pr.catch(() => {});
          }
        } else if (!want && P.playing && P.k <= 0) {
          P.playing = false;
          if (!this.reduced) {
            P.vid.pause();
            try { P.vid.currentTime = 0; } catch (_) { /* unseekable: poster next raise */ }
          }
        }
      }
    }
    // the watermark RESOLVES with the hold: the monogram comes up out of the
    // paper in proportion, which is the whole point of the verb
    const wm = this.insets.watermark;
    if (wm) {
      const rv = Math.max(this.state.reveal, this.state.hold);
      wm.im.style.filter =
        `brightness(${(0.62 + 0.38 * rv).toFixed(3)}) contrast(${(0.9 + 0.22 * rv).toFixed(3)})`;
      wm.glow.style.opacity = (0.85 * rv).toFixed(3);
      wm.glow.style.transform = `scale(${(0.72 + 0.28 * rv).toFixed(3)})`;
    }

    this.state.dim = dim = clamp01(dim);
    this.applyDimMatrix();

    /* ---- [shot] the shot rail: a FIXED 250 ms eased crossfade ---------- */
    /* k ramps linearly on the SIM clock (dt/SHOT_FADE per step — a pure
       function of the stepped time, byte-equal across laps) and the painted
       opacity is easeInOut(k): the teleport-law shape at the band's ceiling.
       Shots do NOT feed the dim — a shot COVERS the world, it does not put a
       plate up over a dimmed one. The video half is the makeClip law: the
       sim asserts the card, the wall clock merely advances its frames, and
       the fall rewinds it so a re-raise starts from the poster. */
    for (const id of Object.keys(this.shots)) {
      const P = this.shots[id];
      const want = (P.want && t >= P.at) ? 1 : 0;
      P.k = clamp01(P.k + (want ? 1 : -1) * (dt / SHOT_FADE));
      P.card.style.opacity = easeInOut(P.k).toFixed(3);
      if (P.vid) {
        if (want > 0 && !P.playing) {
          P.playing = true;
          if (!this.reduced) {
            try { P.vid.currentTime = 0; } catch (_) { /* not yet seekable */ }
            const pr = P.vid.play();
            if (pr && pr.catch) pr.catch(() => {});
          }
        } else if (!want && P.playing && P.k <= 0) {
          P.playing = false;
          if (!this.reduced) {
            P.vid.pause();
            try { P.vid.currentTime = 0; } catch (_) { /* poster next raise */ }
          }
        }
      }
    }
    /* [shot] the shot layer rides the same portrait crop the world gets */
    const Vs = this.vis || { w: PLATE.w, h: PLATE.h };
    this.shotWrap.style.transform = `translate(${((Vs.w - PLATE.w) / 2).toFixed(1)}px,0px)`;

    if (this.active) this.active.step(t, dt, { dim });
  }

  /* ---- harness -------------------------------------------------------- */
  snapshot() {
    const p = this.state.plate;
    /* every inset any built SET has registered, by its own id — no book names */
    const plate = { dim: +this.state.dim.toFixed(3) };
    for (const id of Object.keys(this.insets)) plate[id] = +(p[id] || 0).toFixed(3);
    /* [shot] the lap's [shot] gate reads these: which shot, how far up */
    const shot = { up: this.shotUp() };
    for (const id of Object.keys(this.shots)) shot[id] = +this.shots[id].k.toFixed(3);
    return {
      set: this.activeName,
      mounted: Object.keys(this.sets),
      plate,
      shot,
      cam: { x: +this.cam3.x.toFixed(1), y: +this.cam3.y.toFixed(1),
             k: +this.cam3.k.toFixed(3), wantK: +this.cam3.wk.toFixed(3) },
      acts: this.acts.slice(),
      gaps: this.gaps.slice(),
      ...(this.active ? this.active.snapshot() : {}),
    };
  }
}

export { PLATE };
