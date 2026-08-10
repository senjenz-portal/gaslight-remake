# Round 4 review — Fable max — NOT SIGNED OFF (1 blocking micro-fix + hygiene)

R4-1..R4-6 all CLOSED, verified independently (3-way byte-identical laps,
no regressions, MORE gate headroom than round 3: comes2 0.339/0.368,
hadnote 0.288/0.324 improved, clipping strictly better everywhere).
The unmask sequence, figure life, ember, tunic, mask prop and slice honesty
are all where the rubric wants them.

## Round 5 (FINAL — smallest possible pass)
- **[R5-1 BLOCKING] i-36-goodnight: the door's additive glow card composites
  OVER the departing King** — his last frame in the beat is a headless cream
  garment (71/68 px clipped, max 253.6). Fix with the smallest lever: make
  the glow depth-aware while a figure crosses the threshold, or duck the
  glow during kingExit's doorway crossing and restore after. The King must
  read whole (head visible) through his exit; i-36 clipped px → 0.
- [R5-2] Clip-gate coverage: extend the exact hot-pixel gate to ALL settled
  unit frames (CLIP_UNITS currently 2 units; `--` artefact frames skipped
  silently). Settled frames: gate hot=0. Act/transition artefacts: report,
  don't gate.
- [R5-3] Transient tunic clip mid-crossing (one flicker phase, 38 px @251.0):
  trim HALL_GAIN 0.44 → ~0.42 if V1 gates keep ≥0.03 headroom, else declare
  a transient tolerance (≤40 px on non-settled instants) in lap.mjs with a
  comment. Either close it or codify it — no silent brittleness.
- [R5-4] Comment drift: scene.js:628-632 (decay/gain + stale comes2 numbers)
  and scene.js:463 (stale ember measurement) — align text with measured
  reality. This project's comments read as claims; keep them true.
- [R5-5] Harness hygiene: R4-2's life-sampling advances the lap's sim clock
  (+4.8 s), shifting every post-i-11 unit's captured beat phase off the
  canonical timeline. Move the life probes to a dedicated post-lap re-walk
  (or restore-phase capture) so unit frames return to canonical phases;
  keep the gates identical.

## Waived by reviewer (with reason)
- Portrait i-15/i-16 composition (King 38–41% box inside, right of plate =
  wall + lit sash): reads as an intentional close-up on a man refusing his
  name; the mask ring is clear and clickable at both ratios. Subject crop
  by the lap's own rule. No change.
- The discarded mask leaves with the King at i-35 (parented to his slot):
  below the read threshold at those framings; anchor contract stands.
- Fire's red channel saturating at flame heart (luma 214, amber hue): ACES
  behavior, reads correctly as fire.

## Sign-off condition (round 5)
R5-1 closed with frames + 0 clipped px at i-36; R5-2/3/4/5 done; all gates
green both ratios; determinism intact; canonical-phase frames re-verified at
the spot-check set. Then: SIGNED OFF.
