# Round 8b review — Fable max — NOT SIGNED OFF (face read + stride; deploy prep)

CLOSED and verified: head proportions (6.33 heads, w/d ≥1.19 vertex-exact,
chin visible, jaw corner + dome, nape hair), King entrance pacing (1.55 m/s
peak, 3.23 s crossing, stands at the sill behind the closed leaf), foot-lock
intact (≤3.4 mm slide), knees read on all front walks, note-beat crown fix,
King grazing gone, Watson palette. First-lap wedges root-caused and closed.

## Round 8c (final polish before the round-8 deploy)
- **[8c-1 BLOCKING] The face must read WARM, not carved.** Verifier: cold
  grey-blue mid-face between warm bars = wooden mask. FIX by brightening the
  FACE, not darkening the hair (that lever has been pulled 3 rounds and cost
  the cameo likeness): warm the skin toward the cameo's #c08765 family,
  ensure the face plane actually catches light (check N·L at the two face
  cameras; add a soft front fill ONLY if needed and measure V1 impact), and
  RESTORE the hair toward 0x8a7550 (cameo is blond-brown). Face-luma gate
  must then pass on face brightness, not hair darkness.
- **[8c-2 BLOCKING] Separate the eyes.** The under-boss undercut runs nearly
  full face width = visor slot at diorama size. Narrow each socket to its
  boss width, lift the socket floor between them (nose bridge + temple at
  face level). Two eye shadows, not one bar. Verify at BOTH the close-up
  cams and a wide framing (i-13).
- **[8c-3] Royal stride semantics.** He churns: 0.40 m steps at 3.5
  footfalls/s. A 2.24 m man strides ~0.9-1.0 m at ~1.4-1.5 footfalls/s.
  Define cadence in FOOTFALLS/s everywhere (rename/comment), retune his
  stride/cadK so the same 1.40 m/s cruise comes from long slow steps;
  foot-lock + governor stay. Holmes untouched.
- [8c-4] i-06-wmark: give it its own focus (stop sharing focus.note) so
  Holmes isn't ankle-cropped; keep the watermark plate framing.
- [8c-5] Gates per verifier: replace spanFrac constant-assert with
  vertex-exact mesh w/d (tightest figure ≥1.15); gate crown-vs-stature
  (≤+5 mm); optional N·L face-illumination check at the face cams.
- [8c-6] RULED BY REVIEWER (no work): kingExit stays 2.55 s — the verifier
  proved the ≥3.2 s version collides with the door glow at fast reader
  cadence, and a dismissed King leaving brisker than he arrived is right
  dramatically. Waived. Cloak back staying floor-length at i-35/37 (knees
  unreadable from behind): waived — silhouette wins.
- [8c-7] DEPLOY PREP (blocking for the site update, not for the lap):
  site-deploy/app is round-7 — the copy list MUST include app/figures.js
  (85,682 B) and every changed app file; DELETE the four retired GLBs from
  site-deploy/assets/3d/ (33.3 MB); add assets/plates/king-v2/ and
  assets/raw/ to tools/deploy-exclude.txt. Do NOT push — the orchestrator
  deploys after review.
- [8c-8] Housekeeping: delete tools/_verify8b*.mjs + tools/facemouth.mjs;
  _facetest.html/_facetest2.html at repo root are the ORCHESTRATOR'S face
  diagnostics — move to shots/_archive/, don't ship them. scene.js:1137
  comment says r 3.55 vs code 2.95 — fix (comment-truth law).

## Sign-off condition (8c)
8c-1..8c-5 + 8c-7/8 closed with frames + numbers; the unmasked close-up
judged BY EYE (mine, both ratios) as a warm readable face that binds to the
cameo; laps green + deterministic. Then: deploy round 8 to the live site.
