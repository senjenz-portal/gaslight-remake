/**
 * audio.js — diegetic sound only: the odyssey's beds and moment cues, all of
 * them the lane's own generated clips from assets/audio/. No music, no
 * synthesis, no library.
 *
 * The manager is deliberately dumb about pacing — main.js says WHEN, this says
 * HOW LOUD and keeps a log. The log is the harness's evidence: a screenshot
 * cannot show that door-knock fired on unit 11, so every cue is recorded with
 * the sim time it was asked for, and a muted lap still produces the full list.
 *
 *   unlock()          from a real gesture; browsers require it
 *   bed(id, fade)     cross-fade the ambience ('shore' | 'cave' | 'sea' | null)
 *   cue(id, opts)     one-shot ({gain, delay} in seconds of wall time)
 *   hold(k)           continuous 0..1 from the press-and-hold verb
 */
/* The odyssey ledger. Files are the AUDIO LANE's shipped names — flat kebab
 * copies in assets/audio/, beds carrying the -bed suffix, exactly the naming
 * tools/ody/audiogen_ody.py curates (see assets/raw/ody-audio/gen.log). A
 * file that has not landed yet decodes to nothing and every cue against it is
 * still logged — missing audio is never fatal (see preload()).
 *
 * Two kinds of key on purpose:
 *   - units.js's own bed/sfx/gateSfx ids (shore, keel, boulder, pour…), each
 *     mapped to the nearest lane clip;
 *   - the lane's canonical sound names (boulder-boom, wine-pour…) mapped to
 *     themselves, so a SET module can stage.cue() by the lane's own name.
 * click/page/reveal are ENGINE cues, shipped with the skeleton, not the lane. */
const FILES = {
  // beds — the lane's seamless loops
  shore: 'shore-night-bed.mp3',      // Beat I/VI: night surf + camp embers
  'shore-day': 'shore-day-bed.mp3',  // the daytime shore state
  cave: 'cave-bed.mp3',              // drips + flock murmur, no fire
  'cave-fire': 'cave-fire-bed.mp3',  // the cave with the fire lit
  sea: 'sea-bed.mp3',                // open water: swell + oars under way
  snore: 'giant-snore.mp3',          // the snore-bed under the sword and the stake
  // engine cues
  click: 'click-soft.mp3', page: 'page-turn.mp3', reveal: 'reveal.mp3',
  // units.js cue ids -> the lane's clips
  keel: 'oar-stroke.mp3', slosh: 'oar-stroke.mp3', oars: 'oar-stroke.mp3',
  withies: 'oar-stroke.mp3',
  goats: 'bleat-flock.mp3', bleats: 'bleat-flock.mp3', flock: 'bleat-flock.mp3',
  shoo: 'bleat-flock.mp3', wool: 'bleat-flock.mp3',
  wind: 'dawn-birds.mp3', dawn: 'dawn-birds.mp3',
  crash: 'boulder-boom.mp3', boulder: 'boulder-boom.mp3', boom: 'boulder-boom.mp3',
  fall: 'boulder-boom.mp3', clatter: 'boulder-boom.mp3', footfalls: 'boulder-boom.mp3',
  seize: 'giant-roar.mp3', groan: 'giant-roar.mp3', shout: 'giant-roar.mp3',
  sob: 'ember-hiss.mp3', lots: 'ember-hiss.mp3', embers: 'ember-hiss.mp3',
  chop: 'ember-hiss.mp3', sputter: 'ember-hiss.mp3',
  grind: 'stake-sizzle.mp3', hiss: 'stake-sizzle.mp3',
  sword: 'fire-roar.mp3', fire: 'fire-roar.mp3',
  pour: 'wine-pour.mp3', drain: 'bowl-drain.mp3',
  'rock-tear': 'rock-whoosh-splash.mp3', splash: 'rock-whoosh-splash.mp3',
  // the lane's canonical sound names, for the SET modules
  'boulder-boom': 'boulder-boom.mp3', 'fire-roar': 'fire-roar.mp3',
  'bleat-flock': 'bleat-flock.mp3', 'wine-pour': 'wine-pour.mp3',
  'bowl-drain': 'bowl-drain.mp3', 'ember-hiss': 'ember-hiss.mp3',
  'stake-sizzle': 'stake-sizzle.mp3', 'giant-roar': 'giant-roar.mp3',
  'giant-snore': 'giant-snore.mp3', 'rock-whoosh-splash': 'rock-whoosh-splash.mp3',
  'oar-stroke': 'oar-stroke.mp3', 'dawn-birds': 'dawn-birds.mp3',
};
/* THE MIX, trimmed against the 2026-08-17 remaster (audit-audio.md is the
 * spec; assets/audio/manifest.json carries each file's mastered LUFS/TP).
 * The lane's files are now normalized — beds ~-33 LUFS, cues -18 LUFS,
 * every true peak <= -1.3 dBTP — so this table is pure DRAMATURGY:
 * effective level = file LUFS + 20*log10(gain). Beds sit at ~-35.5
 * effective (sherlock's hearth sits -35.7); story cues land -18..-29 with
 * the climax (hiss/grind, rock-tear) at the top of the band; ember-hiss is
 * a sparse-pop texture (true-peak-capped master, quiet by nature). Every
 * gain <= 1.0, so no cue can clip the destination: file TP -1.3 is the
 * output ceiling. */
const GAIN = {
  shore: 0.79, 'shore-day': 0.85, cave: 0.75, 'cave-fire': 1.0, sea: 0.78,
  snore: 0.77,
  click: 0.32, page: 1.0, reveal: 0.8,
  keel: 0.63, slosh: 0.5, oars: 0.71, withies: 0.35,
  goats: 0.5, bleats: 0.63, flock: 0.71, shoo: 0.56, wool: 0.32,
  wind: 0.45, dawn: 0.56,
  crash: 0.9, boulder: 1.0, boom: 0.95, fall: 1.0, clatter: 0.6, footfalls: 0.45,
  seize: 0.8, groan: 0.63, shout: 0.85,
  sob: 0.71, lots: 0.63, embers: 1.0, chop: 0.8, sputter: 1.0,
  grind: 0.85, hiss: 1.0,
  sword: 0.7, fire: 0.85,
  pour: 0.71, drain: 0.63,
  'rock-tear': 1.0, splash: 1.0,
  'boulder-boom': 1.0, 'fire-roar': 0.85, 'bleat-flock': 0.71, 'wine-pour': 0.71,
  'bowl-drain': 0.63, 'ember-hiss': 1.0, 'stake-sizzle': 1.0, 'giant-roar': 0.8,
  'giant-snore': 0.77, 'rock-whoosh-splash': 1.0, 'oar-stroke': 0.71,
  'dawn-birds': 0.56,
};
const BEDS = new Set(['shore', 'shore-day', 'cave', 'cave-fire', 'sea', 'snore']);
/* sidechain: every story cue ducks the bed bus this deep while it plays;
 * engine chrome (the per-advance click, the page turn) must not pump the bed */
const DUCK_DB = -7;
const NO_DUCK = new Set(['click', 'page']);

export class AudioManager {
  constructor(base = './assets/audio/') {
    this.base = base;
    this.buffers = {};
    this.log = [];
    this.ducks = [];   // sidechain ledger: one entry per bed-duck a cue caused
    this.muted = false;
    this.bedId = null;
    this.bedNodes = {};
    this.holdK = 0;
    this.t = 0;
    this.available = typeof window !== 'undefined' &&
      !!(window.AudioContext || window.webkitAudioContext);
    this.ok = false;
    try {
      if (this.available) {
        const C = window.AudioContext || window.webkitAudioContext;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        /* the bed BUS: every bed voice plays through this one gain so a cue
         * can duck the ambience without touching a bed's own crossfade */
        this.bedBus = this.ctx.createGain();
        this.bedBus.gain.value = 1;
        this.bedBus.connect(this.master);
        this.ok = true;
      }
    } catch (e) { this.ok = false; this.err = String(e && e.message); }
  }

  /** Decode every clip before __ready: a lap must never race a decode.
   * A missing or undecodable file is NON-FATAL — sherlock's contract: warn
   * once per file on the console, play silence for its ids (every cue/bed is
   * still logged), and never surface it as an app error. preload() therefore
   * always resolves with missing: [], so nothing lands in the snapshot's
   * error list; the silent ids are kept on this.silent for inspection. */
  async preload() {
    this.silent = [];
    if (!this.ok) {
      console.warn('audio: WebAudio unavailable — all sounds play as silence');
      this.silent = Object.keys(FILES).sort();
      this.decoded = [];
      return { decoded: [], missing: [] };
    }
    const decoded = [], warned = new Set();
    await Promise.all(Object.entries(FILES).map(async ([id, file]) => {
      try {
        const r = await fetch(this.base + file);
        if (!r.ok) throw new Error('http ' + r.status);
        const ab = await r.arrayBuffer();
        this.buffers[id] = await this.ctx.decodeAudioData(ab);
        decoded.push(id);
      } catch (e) {
        this.silent.push(id);
        if (!warned.has(file)) {
          warned.add(file);
          console.warn('audio: ' + file + ' missing/undecodable ('
            + ((e && e.message) || e) + ') — playing silence');
        }
      }
    }));
    this.decoded = decoded.sort();
    this.silent.sort();
    return { decoded: this.decoded, missing: [] };
  }

  unlock() {
    if (!this.ok) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = this.ctx.state !== 'suspended';
    if (this.bedId && !this.bedNodes[this.bedId]) { const b = this.bedId; this.bedId = null; this.bed(b, 0.8); }
    return true;
  }

  setMuted(m) {
    this.muted = m !== false;
    if (this.ok) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  /** sim time, so the log reads in the same clock the picture is drawn in */
  setTime(t) { this.t = t; }

  bed(id, fade = 1.6) {
    if (id === this.bedId) return;
    this.log.push({ t: +this.t.toFixed(3), kind: 'bed', id: id || 'none' });
    const prev = this.bedId;
    this.bedId = id;
    if (!this.ok) return;
    if (prev && this.bedNodes[prev]) {
      const n = this.bedNodes[prev];
      delete this.bedNodes[prev];
      try {
        n.gain.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.05, fade / 3));
        n.src.stop(this.ctx.currentTime + fade + 0.2);
      } catch (_) { /* already stopped */ }
    }
    if (!id || !this.buffers[id]) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[id];
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.bedBus);
      src.start();
      g.gain.setTargetAtTime(GAIN[id] || 0.6, this.ctx.currentTime, Math.max(0.05, fade / 3));
      this.bedNodes[id] = { src, gain: g };
    } catch (_) { /* a bed that will not start is logged and dropped */ }
  }

  cue(id, opts = {}) {
    const delay = opts.delay || 0;
    this.log.push({ t: +(this.t + delay).toFixed(3), kind: 'cue', id });
    if (!this.ok || !this.buffers[id]) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[id];
      const v = (GAIN[id] || 0.8) * (opts.gain == null ? 1 : opts.gain);
      const g = this.ctx.createGain();
      const t0 = this.ctx.currentTime + delay;
      const dur = src.buffer.duration;
      /* declick envelope: an 8 ms attack ramp (kills the raw src.start()
       * edge / any DC step) and a short release into the clip's own tail */
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.008);
      if (dur > 0.2) g.gain.setTargetAtTime(0, t0 + dur - 0.06, 0.03);
      src.connect(g).connect(this.master);
      src.start(t0);
      this._duck(id, t0, dur);
      return true;
    } catch (_) { return false; }
  }

  /** Sidechain: any story cue ducks the bed bus by DUCK_DB while it plays,
   * then the bus recovers. Engine chrome (click/page) does not pump the bed.
   * The beds' own crossfades live on their per-voice gains, so ducking never
   * fights a bed transition. */
  _duck(id, t0, dur) {
    if (NO_DUCK.has(id) || !this.bedBus) return;
    this.ducks.push({ t: +this.t.toFixed(3), id, db: DUCK_DB });
    const g = this.bedBus.gain;
    const k = Math.pow(10, DUCK_DB / 20);
    try {
      g.setTargetAtTime(k, t0, 0.035);                       // fast dip
      g.setTargetAtTime(1, t0 + Math.min(dur, 6), 0.35);     // slow recover
    } catch (_) { /* noop */ }
  }

  /**
   * A bed's own continuous level, driven by the world rather than by a unit.
   * The pursuit is the case that needs it: the reference drives hoof rate off
   * the gap in metres, so the cab that is 14 m back has to SOUND nearer than
   * the one 19.5 m back, on the same clip.
   */
  setBedGain(id, k) {
    this.bedGain = this.bedGain || {};
    this.bedGain[id] = k;
    const n = this.bedNodes[id];
    if (!this.ok || !n) return;
    const base = GAIN[id] || 0.6;
    try { n.gain.gain.setTargetAtTime(base * k, this.ctx.currentTime, 0.12); }
    catch (_) { /* noop */ }
  }

  /** the hold verb's continuous signal: the bed leans in as the hold rises */
  hold(k) {
    this.holdK = k;
    if (!this.ok) return;
    const n = this.bedNodes[this.bedId];
    if (n) {
      const base = GAIN[this.bedId] || 0.6;
      try { n.gain.gain.setTargetAtTime(base * (1 + 0.5 * k), this.ctx.currentTime, 0.08); }
      catch (_) { /* noop */ }
    }
  }

  snapshot() {
    return {
      available: this.available, ok: this.ok, muted: this.muted,
      unlocked: !!this.unlocked, bed: this.bedId,
      decoded: (this.decoded || []).length, cues: this.log.length,
      duckDb: DUCK_DB, ducks: this.ducks.length,
      log: this.log.slice(),
    };
  }
}

/* GAIN and DUCK_DB are exported for ONE reason: the offline scene mixer
   (tools/ody/cine_scene_videos.mjs) re-plays this manager's own log into a
   file, and it has to use the book's mix, not a second one. */
export { FILES as AUDIO_FILES, BEDS, GAIN as AUDIO_GAIN, DUCK_DB as AUDIO_DUCK_DB };
