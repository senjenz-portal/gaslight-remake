# Round 6 review — Fable max — NOT SIGNED OFF (1 micro-blocking + 3 hygiene)

R6-2, R6-4, R6-5, R6-6, R6-7 CLOSED and independently proved (verifier used
its own instruments: 8-phase frame-exact scan, own glyph-core AA rule, hook
enumeration on a shipped page, full walked reader paths). R6-1 closed on its
letter — and its consequence moved: the decapitation now lives in the i-37
walk-out (head band under gate from t=0.35 s, never recovers), in plain view
on the reader's own path, unmeasured by the sweep (which settles 2.2 s+, after
the 0.98 s walk ends). Also still open: lap.mjs's [R5-3] comment block asserts
the exact falsehood this project's comment-truth rule exists for.

## Round 7 (micro-final)
- **[R7-1 BLOCKING] The King exits BEHIND the page turn, never on camera.**
  Page 2 (the end card) carries no diorama — so move kingWalkOut from i-37
  ENTRY to the DOOR-GATE RESOLVE (inside/after startEnding's cover rise), or
  simply hide him in enterEndLeaf and delete the visible walk entirely. He
  stands WHOLE at the sill through i-37 at any dwell. Requirements, measured
  at READER cadence (short settle, not SETTLE+dwell): head band ≥300 px and
  0 clipped px at i-37 for dwells {0.5, 2.5, 5, 10 s}; the door gate target
  ring visible and the gate resolving through the real raycast with him on
  stage; no frame between the reader's i-36 advance and cover-peak in which
  his head band reads 0 while his body paints. Re-point the dwell sweep's
  i-37 leg to reader cadence so it CAN see this class; remove or re-purpose
  the headless 37--act frame.
- [R7-2] Comment truth, last pass: rewrite tools/lap.mjs lines ~158-168 (the
  [R5-3] block) to the measured present (walk-out 0 px at 8 phases × 2
  ratios; inbound peak 8 px); fix scene.js kingExit "1152-2138" (dwell rows
  measure 1154-2138; 1152 is the settled portrait frame — different class)
  and ember hue "~34°" (measured 38.7°/38.4°).
- [R7-3] Portrait-only: the hansom cab paints a ~950 px pale untextured wedge
  cut by the plate's bottom-left edge at the door camera (comes2/goodnight/
  door portrait). Smallest lever: keep the cab wholly outside those portrait
  framings (nudge street slot along its axis at portrait pad, or clip), or
  make it read as a cab. Measured proof either way.
- [R7-4] Hygiene one-liners: add __THREE__ to the read-only hook ledger (it
  is three.js's own, page has 19 not 18 '__' keys); serve.py's stray
  app/.port noted or cleaned at lap start.

## Accepted as-is (noted for the record)
- AA label pass is definition-sensitive (4.66:1 worst under the verifier's
  stricter rule vs 4.5 line) — both definitions pass; accepted with the
  headroom noted.
- R6-2's lever cost (i-36 mean −0.45 luma, i-11 nearBlack +0.0002): trivial.
- The dwell-sweep i-35/i-36 legs, GL-vs-PNG cross-check, deliberate-regression
  gate test, and cameo-decode determinism fix are all accepted good work.

## Sign-off condition (round 7)
R7-1 closed with reader-cadence proofs; R7-2/3/4 done; all gates green both
ratios; determinism intact. Then SIGNED OFF — no further rounds.
