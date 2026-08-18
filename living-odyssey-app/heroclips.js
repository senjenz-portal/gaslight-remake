/**
 * heroclips.js — THE ONE PATH REGISTRY for the four hero-clip video insets.
 *
 * The clips ship under assets/inset/ (poster PNG + mp4, build-gated by
 * tools/ody/heroclip_gate.py and sha-recorded in tools/ody/heroclips.json —
 * that file's `file`/`poster` are these same paths with the 'assets/' base
 * the stage already owns). Every loader points HERE: a SET grants itself a
 * card by picking from this table (sea.js, cave.js), stage.makeClip resolves
 * `file`/`poster` against its own base ('./assets/'), and main.js's HEROCLIPS
 * unit table speaks only in these ids. One table, one path, no drift.
 */
export const HEROCLIP_FILES = {
  'clip-seize':      { file: 'inset/clip-seize.mp4',      poster: 'inset/clip-seize.png',      loop: false },
  'clip-twist':      { file: 'inset/clip-twist.mp4',      poster: 'inset/clip-twist.png',      loop: true  },
  'clip-underbelly': { file: 'inset/clip-underbelly.mp4', poster: 'inset/clip-underbelly.png', loop: true  },
  'clip-splash':     { file: 'inset/clip-splash.mp4',     poster: 'inset/clip-splash.png',     loop: false },
};
