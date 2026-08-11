# Round 2 review — Fable max — NOT SIGNED OFF (0 majors left; 1 clarity item + 6 residuals)

All four round-1 majors CLOSED, verified by eye + measured evidence:
- V1 closed: nearBlack comes2 0.277 / hadnote 0.228 / door 0.216 (gate ≤0.40,
  now ENFORCED by lap.mjs). The King enters through a real lit doorway —
  architrave, hall glow, floor puddle, rim-lit cloak. The frame carries I.4.
- V2 closed: portrait deadBand 0.267 → 0.0102 max, overflow 0. Verified on
  the deepest text stack.
- E1 closed: note lives in Holmes' hand and lifts with the hold; comes2 is
  staged (door rattle on knock impulses, hall swell, lamp pass) — liveness
  is measurable but the lamp pass is not yet LEGIBLE (see R3-7).
- C1 closed: king-unmasked.glb swaps at the mask-drop. A/B at face zoom:
  hard domino band pre-gate, skin/brow/beard post-gate, cameo flips. I.6 lands.
- Root-cause quality note: the builder found the backdrop shader was writing
  linear values to a display buffer (~7× dark) — fixed at the transfer
  function, not by boosting lights. The right kind of fix.
- Plate-unit nearBlack 0.54–0.74 WAIVED: grammar rule 5 (plates dim the world).

## Round 3 items (sign-off round)
- **[R3-1 clarity] Watson.** Round 2 fixed the slice by removing him: off-frame
  in 33/38 units including his own introduction (i-12-seat, "This is my friend
  and colleague, Dr. Watson") and i-13 (the King's "…uncertain which to
  address" context). Canon and the reference stage Watson IN the room while
  the reader-is-Watson device lives in the margin prefixes only. FIX: seat
  Watson in the wingback armchair by the fire as his stable mark; he must be
  fully in frame at i-00/01 (establishing), i-12-seat, i-13-delicacy, and any
  two-shot that includes the fireplace side; no slicing anywhere (gate stays).
- [R3-2 visual] Exterior apron: flat saturated blue slab (luma ~40) reads
  BRIGHTER than the room floor (~29) and pulls the eye. Darken/desaturate
  toward rock-in-night (below floor luma); it should read as pedestal, not sea.
- [R3-3 visual] Window: glazing bars doubled into a ~12-light prison grid —
  return to the intended six-light sash with slimmer bars; pane must not clip
  to 255 (13.97% >250 at door): dim warm gradient, faint falloff toward the
  corners, nothing pure white.
- [R3-4 engaging] comes2 legibility (with R3-3): the carriage-lamp pass must
  be READABLE in the glass — a warm bar crossing the pane over ~1.2 s with a
  moving floor streak; measured evidence: the pane region's mean luma should
  swing visibly (>12 luma pp) across the pass within one settled capture pair.
- [R3-5 visual] Note quad: opaque (no fingers/buttons reading through paper),
  pinched by the hand (small offset/rotation so the grip overlaps the sheet edge).
- [R3-6 visual] Backstage seams at wide door framings: outer wall face and
  hall flat read as separate floating panels with a visible gap — close or
  shroud (gusset/dark fascia) so the set reads solid from the wings.
- [R3-7 visual, minor] Street gas lamp projects over the parlour floor at the
  head camera as a lollipop behind the hint — move it along the street axis or
  restore its halo so it reads as exterior.
- WAIVED: King GLB grey hair vs cameo's warmer hair (stylization tolerance);
  perf max 19.4 ms outlier at DPR2 (p95 healthy; watch only); plate nearBlack.

## Sign-off condition (round 3)
R3-1..R3-6 closed (R3-7 fix-or-waive with reason), lap green with the enforced
gates (nearBlack, deadBand, no-slice incl. Watson-on-frame at his named units),
determinism intact, no new findings on my frame pass → SIGNED OFF.
