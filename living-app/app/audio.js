/**
 * audio.js — diegetic sound only: two beds and eight moment cues, all of them
 * the lane's own generated clips from assets/audio/. No music, no synthesis,
 * no library.
 *
 * The manager is deliberately dumb about pacing — main.js says WHEN, this says
 * HOW LOUD and keeps a log. The log is the harness's evidence: a screenshot
 * cannot show that door-knock fired on unit 11, so every cue is recorded with
 * the sim time it was asked for, and a muted lap still produces the full list.
 *
 *   unlock()          from a real gesture; browsers require it
 *   bed(id, fade)     cross-fade the ambience ('hearth' | 'street' | null)
 *   cue(id, opts)     one-shot ({gain, delay} in seconds of wall time)
 *   hold(k)           continuous 0..1 from the press-and-hold verb
 */
const FILES = {
  // beds
  hearth: 'room-bed.mp3', street: 'street-bed.mp3',
  chase: 'chase-bed.mp3', church: 'church-bed.mp3',
  // Beat I's cues
  paper: 'paper-rustle.mp3', page: 'page-turn.mp3', book: 'book.mp3',
  hoofbeats: 'hoofbeats.mp3', knock: 'door-knock.mp3', click: 'click-soft.mp3',
  step: 'step.mp3', reveal: 'reveal.mp3', 'mask-drop': 'mask-drop.mp3',
  /* the named slots beats II-VII require (CONTENT-full.md 6.5 + 7.2 #14).
     `letter` is deliberately absent: the ledger says reuse paper-rustle. */
  bell: 'bell.mp3', watch: 'watch.mp3', whip: 'whip.mp3', wheels: 'wheels.mp3',
  cab: 'hoofbeats.mp3', rocket: 'rocket.mp3', 'cry-fire': 'cry-fire.mp3',
  disperse: 'disperse.mp3', 'window-open': 'window-open.mp3', glass: 'glass.mp3',
};
// suggested_volume out of assets/audio/manifest.json, trimmed for the mix
const GAIN = {
  hearth: 0.55, street: 0.75, chase: 0.62, church: 0.5,
  paper: 0.9, page: 1.0, book: 0.8, hoofbeats: 0.7,
  knock: 0.85, click: 0.32, step: 0.6, reveal: 0.8, 'mask-drop': 0.9,
  bell: 0.8, watch: 0.9, whip: 0.75, wheels: 0.55, cab: 0.8, rocket: 0.85,
  'cry-fire': 0.7, disperse: 0.65, 'window-open': 0.8, glass: 0.7,
};
const BEDS = new Set(['hearth', 'street', 'chase', 'church']);

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

  /** Decode every clip before __ready: a lap must never race a decode. */
  async preload() {
    if (!this.ok) return { decoded: [], missing: Object.keys(FILES) };
    const decoded = [], missing = [];
    await Promise.all(Object.entries(FILES).map(async ([id, file]) => {
      try {
        const r = await fetch(this.base + file);
        if (!r.ok) throw new Error('http ' + r.status);
        const ab = await r.arrayBuffer();
        this.buffers[id] = await this.ctx.decodeAudioData(ab);
        decoded.push(id);
      } catch (e) { missing.push(id); }
    }));
    this.decoded = decoded.sort();
    return { decoded: this.decoded, missing };
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

  /** the hold verb's continuous signal: the hearth leans in as the note rises */
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
