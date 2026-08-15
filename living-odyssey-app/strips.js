/**
 * strips.js — THE STRIP REGISTRY, SHIPPED. Generated VERBATIM from
 * tools/ody/strips.json (the build-gated registry: cells gated by
 * strip_slice_gate.py, per-frame foot anchors measured off each cell's own
 * alpha, sha256 of the file as shipped). The SETS read n/cell/srcH/anchors
 * from HERE — no set may hardcode a frame count again (the n=4 -> n=10
 * retune is why). The lap asserts this module deep-equals the registry and
 * that the served strip bytes match each sha, so a drift in either direction
 * is a lap failure, not a quiet lie.
 *
 * Regenerate: node -e '…' (see tools/ody/lap-ody.mjs, the registry-shipped
 * gate) — or simply re-run the strip lane, which rewrites both.
 */
export const STRIPS =
{
 "ulysses-walk": {
  "file": "actor/ulysses-walk-strip.png",
  "cell": [
   305,
   607
  ],
  "n": 10,
  "srcH": 593.4,
  "anchors": [
   168.5,
   131.5,
   230.5,
   146.5,
   159.0,
   148.5,
   171.0,
   144.5,
   164.0,
   155.5
  ],
  "sha256": "75bb4eabb376ddae3ea590ec85696883267360fc4fbb33b41feca3a6ed78e23e",
  "source": "seedance",
  "action": "walk cycle (distance-driven; authored facing right, scaleX(-1) about foot origin for leftward; 10 frames from seedance clip job_jEq9GBGYin1tQNPkanYMMdjo, gated 2026-08-15: identity delta +1.7..+5.7 vs ulysses-walk cut (-18.5), scale drift 2.77%, bg contam 0%, loop closure f0-vs-f96 3.0%, adjacent XOR 50.1-86.9% median 57.0)"
 },
 "crew-walk": {
  "file": "actor/crew-walk-strip.png",
  "cell": [
   330,
   606
  ],
  "n": 10,
  "srcH": 593.1,
  "anchors": [
   176.0,
   121.0,
   176.5,
   178.0,
   108.0,
   177.5,
   170.5,
   161.5,
   160.5,
   169.0
  ],
  "sha256": "fa27c9ece5a0a8a9e00d198ca9068bfab58e436d6fd22428707081efaf48275f",
  "source": "seedance",
  "action": "walk cycle (distance-driven; ochre crew man, variety = flip + per-man frame phase; 10 frames from seedance clip job_pkkBua4iDm6HD7Y17EfEVUxN, gated 2026-08-15: identity delta -1.2..+5.3 vs crew-a-stand (54.2), scale drift 2.59%, bg contam <=0.002%, loop closure f0-vs-f96 1.8%, adjacent XOR 39.9-81.1% median 50.2)"
 },
 "crew-row": {
  "file": "actor/crew-row-strip.png",
  "cell": [
   256,
   413
  ],
  "n": 4,
  "srcH": 362.8,
  "anchors": [
   75.0,
   53.0,
   86.0,
   65.0
  ],
  "sha256": "9078f1c073a6d84d336855467ba09a6e609c393df390f0f71141ebc478b59a56",
  "action": "seated oar pull loop (time-driven on the row period x effort; catch/drive/finish/recovery, oar in every frame; anchors are the MAN's feet, not the sweeping blade)"
 },
 "stake-twist": {
  "file": "actor/stake-twist-strip.png",
  "cell": [
   556,
   590
  ],
  "n": 10,
  "srcH": 582.0,
  "anchors": [
   56.0,
   55.0,
   55.0,
   55.0,
   55.0,
   55.0,
   55.5,
   55.0,
   55.5,
   55.0
  ],
  "sha256": "2e835f45005174ef9803d3e50bc6e942ccc8a54786aa886dfff15c52fc565e7e",
  "action": "auger twist loop (verb-clock; braced stance, hands+shoulders roll the grip, beam constant: row-y band 8px, width 298-312)",
  "source": "seedance"
 },
 "polyphemus-walk": {
  "file": "actor/polyphemus-walk-strip.png",
  "cell": [
   364,
   593
  ],
  "n": 10,
  "srcH": 584.7,
  "anchors": [
   146.5,
   149.5,
   141.5,
   165.5,
   144.5,
   141.5,
   150.5,
   195.5,
   170.5,
   151.0
  ],
  "sha256": "aee45f8cb643c2d0acbaf38ae9ba3eaffc3b89d08ada7929325f5d2a98ecd01d",
  "action": "striding giant (distance-driven; authored facing right; gated 2026-08-15 on the sliced cells: identity delta +3.9..+7.5 vs polyphemus-stand, scale drift 0.19%, anchored XOR 24.1-27.6%)",
  "source": "seedance"
 },
 "ram-walk": {
  "file": "actor/ram-walk-strip.png",
  "cell": [
   731,
   609
  ],
  "n": 10,
  "srcH": 595.6,
  "anchors": [
   418.5,
   414.5,
   470.5,
   424.0,
   408.5,
   520.5,
   445.0,
   400.5,
   419.0,
   396.0
  ],
  "sha256": "4644017a87f898fcb09e8fa69b9dde2c312f18f0b443a89e077430830f3bb866",
  "action": "ovine trot (distance-driven; AUTHORED FACING LEFT \u2014 the flockOut stream's own way, no flip on the escape; palette stat-matched to the canonical ram-walk cut + measured R-4/B+4 rebalance 2026-08-15 because the raw slice failed identity at +85..+90 warm (cream fleece, gold horns) \u2014 after: delta +9.6..+14.7, scale drift 0.44%, anchored XOR 22.2-28.6%)",
  "source": "seedance"
 }
};
