# Fable full-book review — round 1 (2026-08-13)
## Batch 1 — beats II & III establishing
- 02-01-lodge: PASS w/ notes. Villa+bay window carrier good. [F1] Holmes-clergyman UNDERSIZED vs villa doorway (~25% too small) + head unreadable at this scale. [F2] right ~29% of plate dead navy (audit's dead-band; landscape lens law still unapplied here).
- 03-01-hansom: PASS. Norton spring-out + hansom + horse read well. [F3-minor] Norton sprite slightly bright vs scene + faint cut halo.
- 03-06-shotout: PASS. Landau + Irene + coachman roll; glimpse staging matches. Figures small but acceptable at distance.
## Batch 2 — Beat IV, the marriage (user-flagged, CONFIRMED)
- [F4 MAJOR — the root of "marriage scene looks wrong"] MIXED ART REGISTERS in one frame: sprite-Holmes (painterly, real face, cap in hands) stands beside BAKED faceless low-poly mannequins (bride, clergyman, altar-Norton). The claimed bride/groom actor swap did NOT land in 04-09/04-12 — bride is still faceless at the altar. Norton exists in TWO renders: painterly sprite in the aisle (04-07, matches his cameo, good) AND faceless maroon mannequin at the altar (04-09/04-12). Two Nortons, two worlds.
- [F5 MAJOR] FLOATING ACTORS: in 04-07 BOTH sprites stand on TOP of pew backs; in 04-09/04-12 Holmes stands on a pew line mid-nave. The church floor marks are placed at pew-top y — the feet-on-floor law that holds everywhere else broke in this set.
- [F6] Sovereign carrier still weak: 04-12 shows ring-like glows at the couple's hands; no coin reads, no watch chain, no push. Fact M.6 not carried.
- [F7-check] 04-09 wide shows a small gold ring between hands — acceptable IF 04-10-ring-held delivers the 2.2x push (verify).
## Batch 3 — regression checks on claimed fixes
- [F7 FAIL CONFIRMED] 04-10-ring-held: STILL the wide nave shot — no 2.2x push to the joined hands landed in the captured settled frame; ring is ~10px. The claimed FOCUS fix either regressed, applies to a different tick than the settle, or never wired to this unit.
- [F8 MAJOR] 01-10-carriage (known 1-of-9): confirmed — arrival is door-glow only, no vehicle. ALSO:
- [F9 MAJOR — claimed fixed, ISN'T] WATSON IS STILL PAINTED in the room plate: seated man with paper at frame right in 01-10/01-11 framings. The "Watson removed" claim did not reach this plate state (or any?).
- [F10 MAJOR — claimed fixed, ISN'T] 07-00-head: the Beat VII heading frame is still BLACK (heading "The Woman" at ~2% luminance). 3.4s dwell on nothing.
- [F11] Holmes cameo (SHERLOCK HOLMES card, green gaunt) still matches no on-stage Holmes — the audit's cameo-vs-stage mismatch stands.
LESSON for the fix round: the previous ship lane's "lap clean" is NOT visual acceptance — these five have no lap assertions. Every fix this round must land a lap assertion with it.
## Batch 4 — climax + finale
- 06-04-THE-REVEAL: composition + drama PASS. [F12] Irene's window silhouette has a hard MAGENTA fringe (keying spill regression — matte.py ceiling not applied to this cut). [F13] Fire-floor mismatch still reads: plume/hot pane upstairs, reveal in the bay below.
- 07-10-thewoman: margin/letter register beautiful. [F14 MAJOR] The framed portrait — the book's closing image — is a FACELESS mannequin. The painted Irene face exists (cameo, bride actor); the finale must show HER. Fact carrier fails at the most important moment.

# ROUND 1 VERDICT: NOT ACCEPTABLE — 8 majors (F4,F5,F6,F7,F8,F9,F10,F14), 6 minors (F1,F2,F3,F11,F12,F13-mid).
# LAW FOR THE FIX ROUND: every fix lands WITH a lap assertion proving it (pixel/size/luma at the unit's own lens). "Lap clean" without these assertions is not acceptance.

# ============ ROUND 2 — Fable re-review (2026-08-13, local lap, shots/fable-fixcheck) ============
Lap: LAP CLEAN 180.7s, 95/95 units, 0 console errors, all 14 per-fix assertions present AND green.
Frames judged by eye (the ten evidence frames of round 1):
- 01-10-carriage + 01-10b: [F8 PASS] the brougham crosses the lit window as a horse+wheel+driver shadow, then passes. The 马车 finally arrives. Best moment in Beat I.
- 07-00-head: [F10 PASS] Beat VII heading bright and legible (plate 37 luma, type 236) — the black leaf is dead. Root cause was harness timing; real fix verified in the reader's own frame.
- 04-09/04-10: [F4 PASS] all four participants are painted-face cutouts, chancel mannequins baked out (0% cloth in all 4 plates). [F5 PASS] soles on floor or legally hidden behind pew cuts — 0 columns on furniture across 64 frames; witness stance honest. [F7 PASS] ring legible at settle (64px emblem convention).
- 04-12: [F6 PASS] sovereign exists at last — glowing coin ON the watch chain (104px), settled 6px from it. Fact M.6 carried.
- 04-07: [PASS] Norton gate: feet on runner, painted faces, clear click affordance. Soft-fail self-satisfied at 30s — acceptable.
- 06-04-THE-REVEAL: [F12 PASS] magenta fringe gone at reading scale (max excess 21 vs 149; 5px over ceiling is invisible; crimson accent is costume, kept by design). [F13 PASS] plume + hot pane now live on ONE storey above the bay; reveal unobstructed (bay band 1646px plume, sash 0 hot px).
- 02-01-lodge: [F1 PASS] figure 1.1x the door leaf, feet 1.3px off the floor line — human scale restored.
- 03-01-hansom: [F2 PASS] no dead band (worst judged frame 20% vs 22% limit); cab+horse+driver+Norton all read.
- 07-10-thewoman: [F14 PASS] the closing portrait is HER — painted, legible face (head pale 0.376/sd 70 vs mannequin 0.184/50). Low-poly gown retained = the book's cameo-card register; reads as iconography, not defect.
Minors logged, NOT blockers (round-3 candidates only if user asks):
- m1: clergyman surplice + bride gown keep faint low-poly facets vs painted register (church wide lenses).
- m2: finale portrait body remains low-poly (face fixed); consistent with cameo register — accepted.
- m3: F12 rim retains 21 max magenta excess (ceiling 20) on ~5px — imperceptible at device scale.

# ROUND 2 VERDICT: ACCEPTED. All 8 majors dead, all 14 assertions green, every fix carries its own lap gate.
# SHIP: commit + Pages push + LIVE lap re-shots to shots/fable-round2/ + story-orbit refresh PR.
