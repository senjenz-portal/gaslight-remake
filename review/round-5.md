# Round 5 review — Fable max — NOT SIGNED OFF (1 blocking + 6 required + waivers)

R5-2/R5-5 closed clean (clip census on 66/67 frames; canonical timeline
restored byte-for-byte to round-3 phases). R5-1 closed AT THE CAPTURED
FRAMES only. Collateral: round-0 lap.json destroyed (original PNGs intact) —
accepted as an archive gap; do not attempt to regenerate.

## Round 6 (FINAL)
- **[R6-1 BLOCKING] The King's exit is timer-coupled to the harness cadence.**
  Reader-paced reality: dwell 2.5 s at i-35 → headless goodnight; 3.5 s →
  goodnight to an empty doorway; 0.5–1.0 s → he blocks "click the door".
  FIX state-driven: on briony he walks to the threshold and STANDS AT THE
  SILL indefinitely (reader-paced hold), turns out only on the advance out
  of i-36 / the door-gate resolve, exiting behind the turn. PROVE with a
  dwell sweep in lap.mjs: dwell {0.5, 2.5, 5, 10 s} at i-35 and i-36 →
  head band paints ≥ HEAD_PX_MIN at every dwell, 0 clipped px, and he is
  NOT in the doorway blocking the i-37 gate at any dwell.
- [R6-2] Transient clipping honesty: add a frame-exact (FIXED_DT) scan over
  the two walk windows (kingEnter crossing, exit walk-out) to the lap.
  Then either close the peak below 40 px with a small lever, or set
  CLIP_TRANSIENT_MAX to the MEASURED envelope with a truthful comment.
  Reviewer pre-approves a declared envelope ≤ 350 px for ≤ 0.2 s on moving
  figures (reads as a glint) — but the number written must be the number
  measured.
- [R6-3] Comment truth, three named falsehoods: scene.js R5-3 block ("9 px"
  vs measured 319), ember block (12 not 11 framings; hottest at
  i-30-buthow not i-12-seat--act; landscape/portrait swapped), lap.mjs
  R5-5 block (__gotoUnit claim). Re-measure every number you write.
- [R6-4] HEAD_PX_MIN 1 → 300 (or 15% of the head-band box) so the head gate
  gates.
- [R6-5] WCAG AA on receded margin lines: .blk.past 0.34 → measured ≥4.5:1
  for body AND speaker label (try 0.55–0.62), keeping clear hierarchy under
  the active line (15.15:1). Re-measure at 24-i-24-both and portrait
  04-i-04-note2.
- [R6-6] Restore the diegetic page turn (dead code since round 1; round 0
  had it): the door gate fires the REAL cover turn into the end card (end
  card = page 2), `--turn` frame returns to the lap, page cue stays aligned.
- [R6-7] Ship hygiene: expose mutating dev hooks + __refs only under
  ?harness=1 (read-only state/progress hooks may stay).

## Waived by reviewer (final, with reasons)
- Watermark is an interlaced knot, not the E/g/P/G letterforms: the prose
  carries the fact verbatim; regenerating the plate risks its excellent
  hold-reveal read. Waived for this slice.
- King GLB hair (grey-blue dome) vs cameo (red-brown): stylization
  tolerance, both read as the same man in context.
- Leader line crosses the King/desk at i-36/i-13 landscape: hairline,
  legible, acceptable.
- Plate-run freezes (02→04, 24→25 diorama static): held-document grammar —
  beats freeze their last frame by design; margin + breathing dot carry life.
- Portrait plate framings letterbox dark (0.75 nearBlack outside V1 gate):
  reads as a spotlit plate, intentional.
- Brass doorknob 247.7 peak (2.3 luma headroom): documented at the emissive;
  any future lighting lift must re-check.
- i-22 "My photograph." with the plate arriving at i-24: canon stichomythia
  pacing; the two-unit anticipation is the point.
- Sliced-figure box artefacts at i-02..i-06 (visibly whole): reported not
  gated; measurement box vs paint known difference.

## Sign-off condition (round 6)
R6-1..R6-7 closed with proofs; all gates green both ratios; determinism
intact; dwell sweep green; no new findings. Then SIGNED OFF — final report
+ SIGNOFF.md follow.
