/**
 * shots.js — THE ONE PATH REGISTRY for the full-frame SHOT plates
 * (SHOTS.md, PROTOTYPE C promoted: a unit may declare `shot:'<name>'` and
 * the stage crossfades — 250 ms, sim clock — to a NATIVE 1408x768 plate
 * instead of digitally magnifying the painting past k 2.5).
 *
 * The plates ship under assets/set/<set>/shot/ (owner-picked from the NB PRO
 * i2i lane, sha-recorded in tools/ody/shots.json — that file's `file` is
 * this same path with the 'assets/' base the stage already owns). Every
 * loader points HERE: a SET grants itself a shot by picking from this table
 * (`static shots`), stage.makeShot resolves `file` (and a clip shot's
 * `clip`) against its own base ('./assets/'), and units.js speaks only in
 * these ids. One table, one path, no drift — the heroclips.js pattern,
 * verbatim.
 *
 * Anchor tables (`targets`/`holds`/`heads`) are SHOT-SPACE plate px — while
 * the shot is up, the ring, the hold and the leader stand where the SHOT
 * paints their subject. The sets attach those where they declare the shot
 * (the anchors are staging, not paths).
 */
export const SHOT_FILES = {
  /* the first painted shot (owner pick 2026-08-17: A-noman-cand1) — the
     Noman pun as a native dialogue close, cover-cropped 1366x768 -> the
     1408x768 plate space (scale 1408/1366, centre crop) */
  'shot-noman': { file: 'set/cave/shot/noman.jpg' },

  /* SHOTGEN lane (2026-08-17): SHOTS.md §2a plates, seeded i2i off the REAL
     staged tableaux (_shotseed.mjs / the clip-twist inset seed), NB Pro
     repaint, gated by shotgate.py (identity ±20 vs the seed's own clusters,
     NCC >= the accepted prototype's numbers, register) — provenance
     tools/ody/shots.json + assets/raw/ody-shots/manifest-lane*.json.
     Clip shots loop under the makeShot ONE-LOAD law; reduced motion gets
     the poster still (the heroclip trade). */
  'shot-council': { file: 'set/shore/shot/council.jpg' },
  'shot-bowl': { file: 'set/cave/shot/bowl.jpg' },
  'shot-embers': { file: 'set/cave/shot/embers.jpg',
                   clip: 'set/cave/shot/embers.mp4' },
  'shot-drive': { file: 'set/cave/shot/drive.jpg',
                  clip: 'set/cave/shot/drive.mp4' },
  'shot-taunt': { file: 'set/sea/shot/taunt.jpg' },
  'shot-myname': { file: 'set/sea/shot/myname.jpg' },

  /* SHOTGEN lane 2 (even rows; same recipe + gate set — provenance
     tools/ody/work/shotgen-lane2-pending.json + manifest-lane2.json) */
  'shot-wineskin': { file: 'set/shore/shot/wineskin.jpg' },
  'shot-scheme': { file: 'set/cave/shot/scheme.jpg' },
  'shot-ram': { file: 'set/cave/shot/ram.jpg' },
};
