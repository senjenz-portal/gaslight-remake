# Round 8 review — Fable max — NOT SIGNED OFF (proportion/face rework + pacing + framing)

VERIFIED CLOSED this round: style family (cast now reads as the diorama's own
faceted language — the round's first mission); gait mechanics (stance/swing
asymmetry, foot-plant lock 0.0003 m during contact, zero skate, knee span
~1.5 rad, counter-swing both arms); unmask via mask node (tear → floor →
cameo flip, verified off the graph); note on a real carry socket; Watson
joint-seated; cast 5,564 tris / 0 textures (was ~400k); determinism 3-way
byte-identical; all round-7 gates green.

## Round 8b (polish — the "why faces still read odd" round)
- **[8b-1 BLOCKING] Head proportion rework.** Heads are 0.192 of stature and
  DEEPER than wide (holmes 0.393w×0.417d), so the 26°-down camera presents
  the crown; the King's unmasked face reads as a banded barrel. FIX in
  figures.js: headSpan → 0.15–0.165 of stature (≈6–6.5 heads tall), head
  WIDER than deep (w/d ≥ 1.15), chin/jaw silhouette must project inside the
  plate at the down-camera (the verifier's suggested gate: fraction of head
  pixels BELOW the eye band ≥ 0.45 at the mask/unmask cams, or gate the
  chin point on-frame). Re-tune the brow ledge/eye band to the new skull;
  keep the geometry-only face law. Re-check all face-luma numbers after.
- **[8b-2] King's pacing.** Entrance peaks 4.1 m/s at 4.8 steps/s — a
  sprinting monarch. Slow kingEnter's mover profile (≥3.2 s crossing),
  cadence cap ~2.4 Hz for him, stride correspondingly longer; keep the
  foot-lock. Same check on kingExit at the sill.
- **[8b-3] King's cloak hides every knee.** Split or raise the cloak front
  panels so the stride reads at i-11/i-15/i-37 (the orange lining flashing
  through the split is a bonus, not a requirement); if a full fix fights
  the silhouette, report the trade with frames.
- **[8b-4] Camera refits (two regressions).** (a) The note-focus units
  (i-02..i-06): the note now lives at chest height on the carry socket and
  the camera cuts Holmes' crown (i-05 = 118 px out) — refit the note focus
  (target/radius) so Holmes' head stays in frame through the hold. (b) The
  King grazes the inset at 12 more landscape units (0.92–0.95 inside) —
  nudge the two-shot/desk framings or his marks so he is either wholly in
  or intentionally cropped (subject-crop rule), not grazing.
- [8b-5] Watson palette: the pale-blue chest wedge reads as a bib on a warm
  figure; his hands out-luma his face at i-12. Warm the wedge, dull the
  hands below face luma.
- [8b-6] Housekeeping for deploy (do NOT deploy yet): note that
  shots/gait-seq-*.png are the ORCHESTRATOR'S review captures (not stray);
  clean shots/{round-8-pre,round-8-smoke,round-8-faces,figtest} into an
  _archive dir or delete; retirement list for deploy: assets/3d/{holmes,
  watson,king,king-unmasked}.glb (33 MB) leave on disk here, EXCLUDE from
  the next site bundle.

## Sign-off condition (round 8b)
8b-1..8b-4 closed with measured proofs + frames (the King's unmasked
close-up at both ratios is the acid test I will judge by eye); 8b-5/6 done
or waived with reason; all gates green incl. the new below-band/chin gate;
determinism intact. Then: my review → deploy round 8 to the site.
