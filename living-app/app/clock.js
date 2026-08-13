/**
 * clock.js — sim-time beat clock.
 *
 * LAW: no logic in this app may read wall-clock time. Everything animated —
 * camera easing, pantomime, hold progress, page-turn covers, audio cue
 * scheduling — is a pure function of `clock.t`, which only ever moves in
 * FIXED_DT quanta. That makes a lap reproducible: two runs that call
 * __setTime() with the same numbers render the same pixels.
 *
 * Two drive modes:
 *   live    — the rAF loop feeds real elapsed ms into advance(); the
 *             accumulator still quantises them to FIXED_DT steps.
 *   harness — set the moment __setTime() is first called. rAF stops feeding
 *             the clock entirely, so the sim is driven ONLY by the harness
 *             and nothing drifts between a step and a screenshot.
 */
export const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_ADVANCE = 20000;   // ~5.5 min of sim in one call
const MAX_REAL_DELTA = 0.25;           // clamp tab-stall catch-up

export class SimClock {
  constructor() {
    this.t = 0;          // sim seconds elapsed, quantised to FIXED_DT
    this.frame = 0;      // fixed steps taken
    this.acc = 0;        // sub-step remainder
    this.harness = false;
    this._last = null;   // last rAF timestamp (ms), live mode only
  }

  /** Live-mode pump. `nowMs` is a rAF timestamp; ignored in harness mode. */
  pump(nowMs, stepFn) {
    if (this.harness) return 0;
    if (this._last === null) { this._last = nowMs; return 0; }
    let real = (nowMs - this._last) / 1000;
    this._last = nowMs;
    if (!(real > 0)) return 0;
    if (real > MAX_REAL_DELTA) real = MAX_REAL_DELTA;
    return this.advance(real, stepFn);
  }

  /** Advance the sim by `seconds` of sim time in FIXED_DT quanta. */
  advance(seconds, stepFn) {
    if (!(seconds > 0)) return 0;
    this.acc += seconds;
    let n = 0;
    while (this.acc >= FIXED_DT - 1e-9 && n < MAX_STEPS_PER_ADVANCE) {
      this.acc -= FIXED_DT;
      this.t = (this.frame + 1) * FIXED_DT;   // recompute, never accumulate float error
      this.frame++;
      n++;
      stepFn(FIXED_DT);
    }
    return n;
  }

  /**
   * Harness entry point. Absolute, forward-only: steps the sim until
   * `clock.t >= target`. Latches harness mode so rAF stops touching it.
   * Returns the number of fixed steps taken (0 if the target is in the past).
   */
  setTime(target, stepFn) {
    this.harness = true;
    this._last = null;
    if (!Number.isFinite(target) || target <= this.t) return 0;
    let n = 0;
    while (this.t < target - 1e-9 && n < MAX_STEPS_PER_ADVANCE) {
      this.t = (this.frame + 1) * FIXED_DT;
      this.frame++;
      n++;
      stepFn(FIXED_DT);
    }
    this.acc = 0;
    return n;
  }
}

/** Frame-rate-independent exponential damp, safe for fixed dt. */
export function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Deterministic PRNG — the diorama's facets must be identical every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ease = {
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  out:   (k) => 1 - Math.pow(1 - k, 3),
  clamp01: (k) => (k < 0 ? 0 : k > 1 ? 1 : k),
};
