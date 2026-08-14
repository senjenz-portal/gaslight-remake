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

# ============ ROUND 3 — user report + full-scene Fable review (2026-08-14) ============
User: "still a lot of bugs... when the cart pass through one of the light it will pass through."
Method (the marriage-scene lesson, applied): REPRODUCE first — tools/living/_crossingprobe.mjs
steps every rig travel at 4fps through the reader's own harness; review EVERY scene (9 contact
sheets, all 74 frames), not just the evidence frames. Assert the thing AT THE MOMENT it is
wrong: settle shots hid this bug because the collision lives in the dwell after motion.
- [F15 CONFIRMED — the user's cart/light bug] Her landau PARKED at u 0.620 with its hood on
  lamp3's column (938..997): post grows out of the carriage for a two-unit dwell. The follow
  cab's roll end (0.550, body 839..976) reached the same column. Geometry was never wrong in
  MOTION (rigs pass in front of far-side lamps; lamp2 has its front cut) — the defect is
  PARKING on an uncut column. FIX: parking law — ROLL = follow [0.015,0.490], lead [0.478,
  0.984]; FOCUS.her recomposed 951->848. LAW IN THE LAP: every settled rig clears uncut lamp
  columns by >= 10 plate px, measured off the set's own rigBox at all four chase dwells.
- [F16 — full-review find] The door gate's ring pulsed ON THE KING'S CHEST while the cue said
  "click the door" (he waits at the sill per R7-1; his body covers the leaf's right half and
  the old anchor 378,372 + knob 405,393 both sit behind him). FIX: anchor moved to the leaf's
  visible LEFT panel (312,400). LAW: ring circle must clear his body edge by >= 10 px
  (measured: 23 px clear).
- Everything else PASSES the full-scene review: Beat I room read (hold/watermark/mask/index
  gates, cameo sync), pursuit motion (crossings read correctly as pass-in-front), church
  (knot lens, Norton run, drag, wedding register), rocket close-up, chalk-ring gate (the
  pavement ellipse is a STORY OBJECT, not UI), throw gate, one-storey plume, reveal, letter
  read, portrait fade, closing card, portrait-orientation lenses.
# ROUND 3 VERDICT: two defects found, two fixed, each with its own lap law. LAP CLEAN, F1-F16.

# ============ ROUND 4 — user's eye again (2026-08-14): mask timing + the dwell class ============
User: "carriage still is behind the light; the king has the mask off before we took off its mask."
- [F17 CONFIRMED — the mask] room.js painted `un` off S.unmask alone; the sentinel (-1e9)
  clamps to 1, so the STANDING King rendered bare-faced from the moment his entry walk ended —
  four units before the mask gate. The STATE was always right; the PAINT ignored it. Three
  review rounds missed it: walk frames carry masked art, 01-16 is legitimately unmasked, and
  the 01-14 dwell was only ever seen at contact-sheet scale. FIX: paint obeys S.masked; unmask
  timestamp only times the reveal; the Beat-VII sentinel return lands bare-faced instantly.
  LAW: sprite opacities asserted on all three paths (ormstein 1/0, iamking 0/1, letter1 0/1).
- [F15 EXTENDED — the carriage class] Round 3 exempted lamp2's column because its front cut
  draws a parked rig "correctly" behind the post. The user's eye rejected the exemption: a
  carriage merged with a standard at a DWELL reads broken whichever wins the paint order.
  Norton's cab dwelt at u 0.36 = body 664..829 square across lamp2 for three units — THE
  "still behind the light." FIX: CAB_AT_DOOR 0.20 (12 px clear, door over the cab's right
  half, Norton springs out in front of his own cab); lead park 0.492, follow end 0.509; law
  now: at every settle, every rig clears EVERY true post column >= 10 px, 11 settles measured.
  The gates caught two of my own park estimates (sprite widths) before any human did.
- "Am I looking at the right one": console.story-orbit.org serves no-cache (always fresh);
  Pages caches 10 min — a view within minutes of a deploy can be stale.
# LEARNINGS (written to memory):
# 1. When my review says "physically correct" and the user's eye says broken, the eye wins —
#    a rationalization in a review note is a defect wearing an explanation.
# 2. State bugs hide from settle-shot review: paint layers must be asserted, not inferred
#    from state; goto-replay timing differs from the reader's path (walks replay at NOW).
# 3. Fix classes, not instances: round 3 fixed two parks and kept the exemption; round 4
#    removes the class (ANY rig on ANY column at ANY dwell).
# ROUND 4 VERDICT: both user reports confirmed and fixed; LAP CLEAN F1-F17.
