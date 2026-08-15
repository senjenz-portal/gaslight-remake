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
  'rock-tear': 'rock-whoosh-splash.mp3',
  // the lane's canonical sound names, for the SET modules
  'boulder-boom': 'boulder-boom.mp3', 'fire-roar': 'fire-roar.mp3',
  'bleat-flock': 'bleat-flock.mp3', 'wine-pour': 'wine-pour.mp3',
  'bowl-drain': 'bowl-drain.mp3', 'ember-hiss': 'ember-hiss.mp3',
  'stake-sizzle': 'stake-sizzle.mp3', 'giant-roar': 'giant-roar.mp3',
  'giant-snore': 'giant-snore.mp3', 'rock-whoosh-splash': 'rock-whoosh-splash.mp3',
  'oar-stroke': 'oar-stroke.mp3', 'dawn-birds': 'dawn-birds.mp3',
};
// provisional mix, to be trimmed against assets/audio/manifest.json's
// suggested_volume once the lane's curation lands
const GAIN = {
  shore: 0.55, 'shore-day': 0.55, cave: 0.6, 'cave-fire': 0.6, sea: 0.65,
  snore: 0.5,
  click: 0.32, page: 1.0, reveal: 0.8,
  keel: 0.7, slosh: 0.5, oars: 0.75, withies: 0.4,
  goats: 0.6, bleats: 0.7, flock: 0.75, shoo: 0.65, wool: 0.35,
  wind: 0.5, dawn: 0.6,
  crash: 0.8, boulder: 0.9, boom: 0.85, fall: 0.9, clatter: 0.55, footfalls: 0.4,
  seize: 0.75, groan: 0.6, shout: 0.7,
  sob: 0.35, lots: 0.3, embers: 0.6, chop: 0.5, sputter: 0.7,
  grind: 0.8, hiss: 0.9,
  sword: 0.45, fire: 0.7,
  pour: 0.9, drain: 0.85,
  'rock-tear': 0.9,
  'boulder-boom': 0.9, 'fire-roar': 0.7, 'bleat-flock': 0.7, 'wine-pour': 0.9,
  'bowl-drain': 0.85, 'ember-hiss': 0.6, 'stake-sizzle': 0.9, 'giant-roar': 0.8,
  'giant-snore': 0.5, 'rock-whoosh-splash': 0.9, 'oar-stroke': 0.7,
  'dawn-birds': 0.6,
};
const BEDS = new Set(['shore', 'shore-day', 'cave', 'cave-fire', 'sea', 'snore']);

export class AudioManager {
  constructor(base = './assets/audio/') {
    this.base = base;
    this.buffers = {};
    this.log = [];
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
      src.connect(g).connect(this.master);
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
      const g = this.ctx.createGain();
      g.gain.value = (GAIN[id] || 0.8) * (opts.gain == null ? 1 : opts.gain);
      src.connect(g).connect(this.master);
      src.start(this.ctx.currentTime + delay);
      return true;
    } catch (_) { return false; }
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
      log: this.log.slice(),
    };
  }
}

export { FILES as AUDIO_FILES, BEDS };
