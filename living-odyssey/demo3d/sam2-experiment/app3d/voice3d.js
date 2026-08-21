/**
 * voice3d.js — the spoken book, wired per unit (AMENDMENT A8's mastered
 * lines, app/voice.js's manifest). This app is new code, so the wiring is
 * native: enterUnit() asks for the unit's line, the line plays through the
 * book's own AudioContext, and the AMBIENT BED IS DUCKED −6 dB while any
 * word is sounding (the sidechain rides audio.js's own bedBus, so it never
 * fights a bed crossfade).
 *
 * Determinism: the voice is a card the sim asserts, not a fact the sim
 * reads — nothing downstream reads playback state; the log records what was
 * asked for, in sim time, and a muted lap still produces the full list.
 * Buffers are fetched lazily and cached; the NEXT unit's line is prefetched
 * so a click never waits on the wire.
 */
const DUCK_DB = -6;

export class Voice3D {
  constructor(audio, manifest, base) {
    this.audio = audio;            /* the AudioManager — ctx, master, bedBus */
    this.manifest = manifest;      /* key -> { file, dur, speaker } */
    this.base = base;
    this.buffers = {};
    this.pending = {};
    this.log = [];
    this.current = null;           /* { key, src, gain, until } */
    this.enabled = true;
  }

  async _buffer(key) {
    const row = this.manifest[key];
    if (!row || !this.audio.ok) return null;
    if (this.buffers[key]) return this.buffers[key];
    if (!this.pending[key]) {
      this.pending[key] = (async () => {
        try {
          const r = await fetch(this.base + row.file);
          if (!r.ok) throw new Error('http ' + r.status);
          const ab = await r.arrayBuffer();
          this.buffers[key] = await this.audio.ctx.decodeAudioData(ab);
        } catch (e) {
          console.warn('voice: ' + row.file + ' missing/undecodable — silent');
          this.buffers[key] = null;
        }
        this.pending[key] = null;
        return this.buffers[key];
      })();
    }
    return this.pending[key];
  }

  prefetch(key) { if (key && this.manifest[key]) this._buffer(key); }

  stop() {
    if (!this.current) return;
    const c = this.current;
    this.current = null;
    if (!this.audio.ok) return;
    try {
      const t = this.audio.ctx.currentTime;
      c.gain.gain.setTargetAtTime(0, t, 0.05);
      c.src.stop(t + 0.25);
      this._duck(1, t);                             /* the bed recovers */
    } catch (_) { /* already stopped */ }
  }

  _duck(to, t0) {
    if (!this.audio.ok || !this.audio.bedBus) return;
    const k = to === 1 ? 1 : Math.pow(10, DUCK_DB / 20);
    try { this.audio.bedBus.gain.setTargetAtTime(k, t0, to === 1 ? 0.45 : 0.06); }
    catch (_) { /* noop */ }
  }

  /** Speak the unit's line. Returns the mastered duration (the manifest's
   *  own number — determinism law: never the media element's). */
  async play(key, simT) {
    const row = this.manifest[key];
    this.stop();
    if (!row || !this.enabled) return 0;
    this.log.push({ t: +(+simT).toFixed(3), key, dur: row.dur });
    if (!this.audio.ok) return row.dur;
    const token = { key };
    this.current = token;                           /* claim before the await */
    const buf = await this._buffer(key);
    if (!buf || this.current !== token) return row.dur;
    try {
      const ctx = this.audio.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.95, t0 + 0.012);
      src.connect(g).connect(this.audio.master);
      src.start(t0);
      this._duck(0, t0);                            /* the −6 dB sidechain */
      src.onended = () => { if (this.current === token) { this.current = null; this._duck(1, ctx.currentTime); } };
      token.src = src; token.gain = g;
    } catch (_) { this.current = null; }
    return row.dur;
  }

  snapshot() {
    return { enabled: this.enabled, plays: this.log.length,
             playing: this.current ? this.current.key : null,
             cached: Object.keys(this.buffers).length, log: this.log.slice(-8) };
  }
}
