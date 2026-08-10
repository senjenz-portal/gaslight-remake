# Round 1 review — Fable max — NOT SIGNED OFF (4 majors)

Lap: exit 0, 38/38 units, deterministic (3 identical laps), 122 shots live,
gates enforce (0 false advances), p95 ≤ 5.7 ms @DPR2. The grammar is all
present and several frames are excellent. Verdict per lens:

## Visual — NO (2 major)
- **[V1 MAJOR] Dark-wall beats are unlit voids.** comes2 68.1% near-black,
  hadnote 58.2%, door 70.0%. The King's entrance (fact I.4) happens inside a
  black mass; his lower body dissolves. Classic dark-on-dark. FIX: doorway
  hall-light spilling around/under the door + rim light on the King's cloak;
  retarget those three framings to ≤40% near-black, measured in lap.json.
- **[V2 MAJOR] iPad-portrait is two islands.** ~24% of the viewport is dead
  page between inset bottom and first type line on every 1024x1366 frame.
  FIX: portrait layout pulls text up under the inset (or grows the inset);
  target ≤8% dead band.
- [v3] Window glow blown to clipped white at most framings; recover pane/
  mullion read (lower emissive or tone-map that quad).
- [v4] Stray cool-blue light wedge bottom-left in hadnote/seat frames — leak
  from the 'under' rock light; mask it from the room floor.
- [v5] At the mask/unmask camera Holmes reads as standing ON the desk.
  Nudge his mark or the camera line so his feet ground.
- [v6] Desk dressing reads as toy blocks; the index (a click target!) needs
  to read as a fat ledger (spine bands, paper edge, no text) + loose papers.
- [v7] Ghost of the hint text lingers as a dark band bottom-center of the
  inset in several frames — kill after fade.

## Engaging — NO (1 major)
- **[E1 MAJOR] Two dead beats.** (a) comes2: hoofbeats + street bed play over
  a shut, unlit door with nothing moving — stage the arrival: warm light
  pass across the window (carriage lamps), growing under-door light, the
  door trembling on the knock. (b) hold (pre-press): the note is a flat
  untextured rectangle floating mid-air; the cue says "hold the note to the
  light" while nobody holds it. FIX: parent the note to Holmes' hand
  (integrator option b), noteLift raises hand+note toward the lamp; give
  the note quad the note-plate texture (folded-paper read) instead of flat
  beige.
- [e2] The prop mask reads as a plank/visor edge-on at the gate camera —
  thin it to a domino silhouette with a strap hint.

## User/clarity — NO (1 major)
- **[C1 MAJOR] Fact I.6 fails.** king.glb bakes the domino mask; after the
  unmask gate he says "I am the King" still visibly masked (16-iamking).
  FIX (art): king-unmasked.glb — edit the ORIGINAL king concept image with
  NB Pro i2i (remove mask, keep identity/costume/pose) → image-to-3D →
  builder swaps the GLB inside kingUnmask (mask-drop moment covers the swap).
- [c2] Watson half-clipped at the inset edge in early frames — keep him on
  stage (canon: Holmes introduces him) but place him fully in frame.
- Strong: watermark hold-reveal (I.2) and both-photo plate (I.8) are the two
  best moments in the lap; closing card reinforcing I.10 is a real clarity
  win; stichomythia margin pacing reads beautifully.

## Sign-off condition for round 2
V1, V2, E1, C1 closed with measured evidence (near-black %, dead-band %,
new frames); minors fixed or explicitly waived with reason. Audio judged by
cue-log correctness only (already correct: 49 cues, beds swap at comes2 and
back after hadnote).
