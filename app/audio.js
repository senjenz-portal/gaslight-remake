/**
 * audio.js — WebAudio manager. REAL assets first, synth as the safety net.
 *
 * Every bed and cue names a file under ../assets/audio/. The bytes are
 * prefetched at boot (same-origin, no gesture needed) and decoded into
 * AudioBuffers the moment a real gesture gives us a context. Anything that
 * fails to fetch or decode — including cues whose files the generation lane
 * has not delivered yet — silently falls back to the synthesised voice, so
 * the app is never silent and never breaks.
 *
 * Beds loop GAPLESSLY: the decoded buffer is rebuilt once with an 80 ms
 * seam crossfade (mp3 codec priming otherwise ticks at the loop point).
 *
 * Contract the rest of the app relies on:
 *   preload()       — fetch the bytes; resolves even when files are missing.
 *   unlock()        — MUST be called from a real user gesture; safe to call
 *                     repeatedly and safe to call when audio is unavailable.
 *   bed(id, fade?)  — cross-fade the ambience bed. id === null silences it.
 *   cue(id, gain?)  — fire a one-shot moment cue.
 *   hold(k)         — continuous 0..1 signal for the press-and-hold verb.
 *   log             — every call in order, for the review harness. Audio can
 *                     be muted or blocked and the log is still truthful.
 */
const BASE = '../assets/audio/';

/** id -> file + mix level. Levels are ASSETS.md §3 / manifest.json. */
export const BED_FILES = {
  hearth: { file: 'room-bed.mp3',   vol: 0.80 },
  street: { file: 'street-bed.mp3', vol: 0.55 },   // ducked under room-bed
};

export const CUE_FILES = {
  paper:       { file: 'paper-rustle.mp3', vol: 1.00 },
  door:        { file: 'door-knock.mp3',   vol: 0.85 },
  page:        { file: 'page-turn.mp3',    vol: 1.00 },
  hoofbeats:   { file: 'hoofbeats.mp3',    vol: 0.65 },  // caps at full scale
  click:       { file: 'click-soft.mp3',   vol: 0.40 },
  // gap-lane files, all landed. Levels are the ASSETS.md §3 CAPS, not tastes:
  // measured peaks are book -0.5, step -0.4, reveal -3.5, mask-drop -5.1 dBFS,
  // i.e. these four are the hottest files in the set. Never raise them.
  book:        { file: 'book.mp3',         vol: 0.70 },  // peak -0.5 dBFS, cap <=0.7
  step:        { file: 'step.mp3',         vol: 0.70 },  // peak -0.4 dBFS, must read beyond the door
  reveal:      { file: 'reveal.mp3',       vol: 0.45 },  // subtle by contract
  'mask-drop': { file: 'mask-drop.mp3',    vol: 0.85 },
};

/** Synthesised stand-ins — used whenever a file is missing or undecodable. */
const BEDS_SYNTH = {
  hearth: { color: 'brown', gain: 0.055, lp: 420,  wobble: 0.18 },
  street: { color: 'pink',  gain: 0.070, lp: 900,  wobble: 0.35 },
};

const CUES_SYNTH = {
  paper:       { type: 'noise', dur: 0.34, gain: 0.16, lp: 5200, hp: 1400, decay: 5.5 },
  book:        { type: 'noise', dur: 0.42, gain: 0.15, lp: 3400, hp: 700,  decay: 4.0 },
  door:        { type: 'thud',  dur: 0.55, gain: 0.24, freq: 92,  decay: 6.0 },
  step:        { type: 'thud',  dur: 0.40, gain: 0.18, freq: 128, decay: 8.0 },
  hoofbeats:   { type: 'hoof',  dur: 2.30, gain: 0.22, freq: 150, beats: 8 },
  page:        { type: 'noise', dur: 0.52, gain: 0.20, lp: 6000, hp: 900,  decay: 4.2 },
  reveal:      { type: 'tone',  dur: 1.10, gain: 0.12, freq: 528, decay: 3.2 },
  click:       { type: 'noise', dur: 0.06, gain: 0.10, lp: 7200, hp: 2200, decay: 3.0 },
  'mask-drop': { type: 'thud',  dur: 0.42, gain: 0.20, freq: 168, decay: 7.0 },
};

const SEAM = 0.080;    // seconds of loop-seam crossfade

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.ok = false;             // an AudioContext actually exists
    this.unlocked = false;       // ...and it is running
    this.available = typeof window !== 'undefined' &&
      !!(window.AudioContext || window.webkitAudioContext);
    this.log = [];               // {kind, id, gain, n}
    this.bedId = null;
    this._bedNodes = null;
    this._holdNodes = null;
    this._noise = { brown: null, pink: null, white: null };
    this._master = null;
    this.muted = false;
    this.bytes = {};             // id -> ArrayBuffer
    this.buffers = {};           // id -> AudioBuffer (post-decode)
    this.missing = [];           // ids with no usable file (synth fallback)
    this.preloaded = false;
  }

  /** Fetch every asset's bytes. Resolves even when files are missing. */
  async preload() {
    const jobs = [];
    const grab = (id, file) => jobs.push((async () => {
      try {
        const r = await fetch(BASE + file, { cache: 'force-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this.bytes[id] = await r.arrayBuffer();
      } catch (e) {
        this.missing.push(id);
        this._note('missing', id);
      }
    })());
    for (const [id, s] of Object.entries(BED_FILES)) grab('bed:' + id, s.file);
    for (const [id, s] of Object.entries(CUE_FILES)) grab('cue:' + id, s.file);
    await Promise.all(jobs);
    this.preloaded = true;
    return { missing: this.missing.slice(), got: Object.keys(this.bytes).length };
  }

  /** Called from the first real gesture. Never throws. */
  unlock() {
    if (!this.available) { this._note('unlock', 'unavailable'); return false; }
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this._master = this.ctx.createGain();
        this._master.gain.value = this.muted ? 0 : 1;
        this._master.connect(this.ctx.destination);
        this.ok = true;
        this._decodeAll();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = this.ctx.state !== 'suspended';
      this._note('unlock', this.ctx.state);
      if (this.bedId) { const id = this.bedId; this.bedId = null; this.bed(id, 0.9); }
      return true;
    } catch (e) { this.ok = false; this._note('unlock', 'failed:' + e.message); return false; }
  }

  /** Decode everything we fetched. Beds get their seam crossfaded. */
  _decodeAll() {
    for (const key of Object.keys(this.bytes)) {
      const raw = this.bytes[key];
      let done = false;
      try {
        const p = this.ctx.decodeAudioData(raw.slice(0));
        if (p && p.then) {
          done = true;
          p.then((buf) => {
            this.buffers[key] = key.startsWith('bed:') ? this._seamLoop(buf) : buf;
            if (this.bedId && key === 'bed:' + this.bedId && !this._bedIsFile) {
              const id = this.bedId; this.bedId = null; this.bed(id, 0.6);
            }
          }).catch(() => { this.missing.push(key); });
        }
      } catch (_) { /* fall through to the callback form */ }
      if (!done) {
        try {
          this.ctx.decodeAudioData(raw.slice(0),
            (buf) => { this.buffers[key] = key.startsWith('bed:') ? this._seamLoop(buf) : buf; },
            () => { this.missing.push(key); });
        } catch (_) { this.missing.push(key); }
      }
    }
  }

  /**
   * Rebuild a bed buffer so `loop = true` is seamless: the last SEAM seconds
   * are cross-faded onto the head and then trimmed off, which removes both
   * the mp3 priming gap and any level step at the seam.
   */
  _seamLoop(buf) {
    try {
      const sr = buf.sampleRate;
      const n = Math.min(Math.floor(SEAM * sr), Math.floor(buf.length / 4));
      if (n < 32) return buf;
      const len = buf.length - n;
      const out = this.ctx.createBuffer(buf.numberOfChannels, len, sr);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const src = buf.getChannelData(ch);
        const dst = out.getChannelData(ch);
        dst.set(src.subarray(0, len));
        for (let i = 0; i < n; i++) {
          const f = i / n;                       // 0 -> 1 across the seam
          dst[i] = dst[i] * f + src[len + i] * (1 - f);
        }
      }
      return out;
    } catch (_) { return buf; }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this._master) this._master.gain.value = this.muted ? 0 : 1;
  }

  bed(id, fade = 1.6) {
    if (id === this.bedId) return;
    this._note('bed', id);
    this.bedId = id;
    if (!this.ok || !this.ctx) return;                 // logged, deferred to unlock()
    try {
      const now = this.ctx.currentTime;
      if (this._bedNodes) {
        const old = this._bedNodes;
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setTargetAtTime(0, now, Math.max(0.05, fade / 3));
        setTimeout(() => { try { old.src.stop(); } catch (_) {} }, (fade + 0.5) * 1000);
        this._bedNodes = null;
      }
      if (!id) return;
      const buf = this.buffers['bed:' + id];
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        src.loopStart = 0; src.loopEnd = buf.duration;
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime((BED_FILES[id] || { vol: 0.8 }).vol, now, Math.max(0.05, fade / 3));
        src.connect(g).connect(this._master);
        src.start();
        this._bedNodes = { src, gain: g };
        this._bedIsFile = true;
        return;
      }
      this._bedIsFile = false;
      const spec = BEDS_SYNTH[id];
      if (!spec) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(spec.color);
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = spec.lp;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(spec.gain, now, Math.max(0.05, fade / 3));
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = spec.lp * spec.wobble;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      src.connect(lp).connect(g).connect(this._master);
      src.start();
      this._bedNodes = { src, gain: g, lfo };
    } catch (e) { this._note('bed', 'failed:' + e.message); }
  }

  cue(id, gain = 1) {
    if (!id) return;
    this._note('cue', id, gain);
    if (!this.ok || !this.ctx) return;
    const buf = this.buffers['cue:' + id];
    if (buf) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = (CUE_FILES[id] || { vol: 1 }).vol * gain;
        src.connect(g).connect(this._master);
        src.start();
        return;
      } catch (e) { this._note('cue', 'failed:' + e.message); }
    }
    this._synthCue(id, gain);
  }

  _synthCue(id, gain) {
    const s = CUES_SYNTH[id];
    if (!s) return;
    try {
      const now = this.ctx.currentTime, out = this._master;
      const mk = (at, freq, dur, amp, decay, kind) => {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(amp, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        let node;
        if (kind === 'noise') {
          node = this.ctx.createBufferSource();
          node.buffer = this._noiseBuffer('white');
          const hp = this.ctx.createBiquadFilter();
          hp.type = 'highpass'; hp.frequency.value = s.hp || 200;
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = s.lp || 6000;
          node.connect(hp).connect(lp).connect(g).connect(out);
          node.start(at); node.stop(at + dur + 0.05);
        } else {
          node = this.ctx.createOscillator();
          node.type = kind === 'thud' ? 'sine' : 'triangle';
          node.frequency.setValueAtTime(freq, at);
          node.frequency.exponentialRampToValueAtTime(Math.max(30, freq / (decay || 3)), at + dur);
          node.connect(g).connect(out);
          node.start(at); node.stop(at + dur + 0.05);
        }
      };
      if (s.type === 'hoof') {
        for (let i = 0; i < s.beats; i++) {
          const k = i / (s.beats - 1);
          const at = now + k * s.dur * (1 + 0.35 * k * k);
          mk(at, s.freq * (1 - 0.05 * k), 0.13, s.gain * gain * (0.65 + 0.35 * (1 - k)), 4, 'thud');
        }
      } else {
        mk(now, s.freq || 200, s.dur, s.gain * gain, s.decay, s.type);
      }
    } catch (e) { this._note('cue', 'failed:' + e.message); }
  }

  /** Continuous press-and-hold voice: 0 = silence, 1 = the reveal's peak. */
  hold(k) {
    k = k > 0 ? (k < 1 ? k : 1) : 0;
    this._holdK = k;
    if (!this.ok || !this.ctx) return;
    try {
      if (k <= 0.0005) {
        if (this._holdNodes) {
          const n = this._holdNodes; this._holdNodes = null;
          n.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
          setTimeout(() => { try { n.osc.stop(); } catch (_) {} }, 400);
        }
        return;
      }
      if (!this._holdNodes) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        const g = this.ctx.createGain(); g.gain.value = 0;
        osc.connect(g).connect(this._master);
        osc.start();
        this._holdNodes = { osc, gain: g };
      }
      const n = this._holdNodes, now = this.ctx.currentTime;
      n.osc.frequency.setTargetAtTime(320 + 420 * k, now, 0.05);
      n.gain.gain.setTargetAtTime(0.05 * k, now, 0.05);
    } catch (_) { /* audio is never load-bearing */ }
  }

  _noiseBuffer(color) {
    if (this._noise[color]) return this._noise[color];
    const sr = this.ctx.sampleRate, len = sr * 3;
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w * 0.6;
      else if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    const tp = Math.floor(sr * 0.05);
    for (let i = 0; i < tp; i++) { const f = i / tp; d[i] *= f; d[len - 1 - i] *= f; }
    this._noise[color] = buf;
    return buf;
  }

  _note(kind, id, gain) {
    this.log.push({ kind, id, gain: gain === undefined ? 1 : gain, n: this.log.length });
    if (this.log.length > 600) this.log.shift();
  }

  /** Harness view: what has been asked to sound, regardless of device state. */
  snapshot() {
    return {
      available: this.available, ok: this.ok, unlocked: this.unlocked,
      bed: this.bedId, holdK: this._holdK || 0, muted: this.muted,
      cues: this.log.filter(e => e.kind === 'cue').map(e => e.id),
      beds: this.log.filter(e => e.kind === 'bed').map(e => e.id),
      files: Object.keys(this.bytes).length,
      decoded: Object.keys(this.buffers).length,
      missing: this.missing.slice(),
      calls: this.log.length,
    };
  }
}
