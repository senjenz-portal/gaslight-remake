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
   159,
   148.5,
   171,
   144.5,
   164,
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
   176,
   121,
   176.5,
   178,
   108,
   177.5,
   170.5,
   161.5,
   160.5,
   169
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
   75,
   53,
   86,
   65
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
  "srcH": 582,
  "anchors": [
   56,
   55,
   55,
   55,
   55,
   55,
   55.5,
   55,
   55.5,
   55
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
   151
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
   424,
   408.5,
   520.5,
   445,
   400.5,
   419,
   396
  ],
  "sha256": "4644017a87f898fcb09e8fa69b9dde2c312f18f0b443a89e077430830f3bb866",
  "action": "ovine trot (distance-driven; AUTHORED FACING LEFT — the flockOut stream's own way, no flip on the escape; palette stat-matched to the canonical ram-walk cut + measured R-4/B+4 rebalance 2026-08-15 because the raw slice failed identity at +85..+90 warm (cream fleece, gold horns) — after: delta +9.6..+14.7, scale drift 0.44%, anchored XOR 22.2-28.6%)",
  "source": "seedance"
 },
 "seize": {
  "file": "actor/seize-strip.png",
  "cell": [
   593,
   598
  ],
  "n": 10,
  "srcH": 576.7,
  "anchors": [
   372.5,
   371,
   351,
   253,
   252.5,
   252.5,
   252.5,
   252.5,
   252.5,
   253.5
  ],
  "source": "seedance",
  "kind": "bridge",
  "from": "polyphemus-seated",
  "to": "polyphemus-clutch",
  "action": "pose bridge seated -> clutch (K13 two-at-a-clutch seize, plays identically for ody-iii morningmeal/suppertwo; 10 frames picked as the monotone arrival chain from seedance clip job_zAHAEdiXAv8eLTzsJ3B6PSVW srcs [1,38,41,62,63,64,65,66,67,97] of 97, gated 2026-08-16 by gate10b: identity delta -3.5..+7.5 vs polyphemus-stand (-12.1, crown band), endpoint XOR frame0-vs-A 2.09% / frame9-vs-B 2.29% (law <=15%), endpoint scale 0.0%/0.18% (law <=8%), bg contam <=0.106%, progress-to-B monotone 53.9 -> 2.3 with no ping-pong step; the snatch-down anticipation (away-phase d 61-99, srcs 42-58) is compressed into the c2->c3 snap)",
  "sha256": "25d57c999b3708c8da58f0dcb251f762af8af3eaf5e905199e2bfa7e77c7befc"
 },
 "drink": {
  "file": "actor/drink-strip.png",
  "cell": [
   550,
   602
  ],
  "n": 10,
  "srcH": 591.8,
  "anchors": [
   354.5,
   257.5,
   257.5,
   257.5,
   259,
   259,
   258.5,
   258.5,
   258.5,
   258.5
  ],
  "source": "seedance",
  "kind": "bridge",
  "from": "polyphemus-seated",
  "to": "polyphemus-drink",
  "action": "pose bridge seated -> drink (the three pour releases, ody-iii lookhere/besokind/thrice, playCount 3; 10 frames = monotone arrival chain from seedance clip job_Vz25f8rhjCdr7NCFsqh3FJhj srcs [1,66,67,68,70,72,74,75,79,97] of 97, gated 2026-08-16 by gate10b: identity delta +2.4..+4.6 vs polyphemus-stand measured at the 25% BEARD band (-12.9) -- the drink crown is the held bowl, and the top-10% band read bowl shadow +25/+28 while the authored drink canvas itself reads +14.2 through the same path; endpoint XOR A 1.63% / B 2.41%, endpoint scale 0.0%/0.53%, bg contam <=0.128%, progress-to-B monotone 55.4 -> 2.4; the bowl is taken from the off-frame offer inside the c0->c1 snap)",
  "sha256": "5677533c4ec13347e07fe3e46bec74591c801d608e81f1e71cae6efa014160ea"
 },
 "collapse": {
  "file": "actor/collapse-strip.png",
  "cell": [
   785,
   553
  ],
  "n": 10,
  "srcH": 535.7,
  "anchors": [
   211.5,
   210.5,
   210,
   253,
   469.5,
   424,
   491.5,
   456.5,
   470,
   470
  ],
  "source": "seedance",
  "kind": "bridge",
  "from": "polyphemus-drink",
  "to": "polyphemus-sprawl",
  "action": "pose bridge drink -> sprawl (the ~6s collapse, ody-iii-13-neck, hinge into Beat IV's opening tableau; 10 frames = monotone arrival chain from seedance clip job_Bdaa1PKq1PHt7bZXsF4LJb9K srcs [1,13,25,48,71,73,74,75,96,97] of 97, gated 2026-08-16 by gate10b: identity delta +1.4..+17.6 vs polyphemus-stand at the WHOLE-FIGURE darkest-cluster band (-14.3) -- mid-tumble the crown band is the legs; the identity fact is the black beard, the darkest material on this character (one blur frame src69 read +32.5 and was swapped for src71); endpoint XOR A 2.39% / B 3.52%, endpoint scale 0.0%/0.0%, bg contam <=0.102%, progress-to-B monotone 86.9 -> 3.5; BOTH stills matted at IDENTICAL scale (sprawl length 562px = the 540px standing giant lying down) deviating from the plan entry's landscape-loop ~80%-frame-width note, which would grow the giant 82% mid-fall; the dropped bowl rides c4-c9 in flight (~3 pts of the endpoint XOR) and pops out on the engine's swap to the sprawl still)",
  "sha256": "e623d4a169f22229d11cc83c20e9697001bfa9e2f520d8352ce6fbb4126feef2"
 },
 "hurl-windup": {
  "file": "actor/hurl-windup-strip.png",
  "cell": [
   338,
   647
  ],
  "n": 10,
  "srcH": 635,
  "anchors": [
   163.5,
   163.5,
   137.5,
   139,
   139.5,
   140,
   140,
   140,
   140,
   140
  ],
  "source": "seedance",
  "kind": "bridge",
  "from": "polyphemus-stand",
  "to": "polyphemus-hurl",
  "action": "pose bridge stand -> hurl (rock clocks ody-vi rock1 + heard, playCount 2; 10 frames = monotone arrival chain from seedance clip job_GhqBE1qu1M2tAQhvPMYefxPF srcs [1,13,80,81,83,84,85,89,90,97] of 97, gated 2026-08-16 by gate10b: identity delta +1.5..+7.4 vs polyphemus-stand (-12.1, crown band), endpoint XOR A 2.73% / B 4.78%, endpoint scale 0.36%/0.53%, bg contam <=0.111%, progress-to-B monotone 48.1 -> 4.8; the HURL still was aligned by its measured trailing-foot cluster (native x=515.5), not pin-to-pin, so the lunge lands frame-left per plan; the twist-back anticipation (away-phase d 80-88, srcs 16-28) is compressed into the c1->c2 snap where the crook leaves the hands and the rock arrives overhead)",
  "sha256": "39f63f7a7ad5353e990ac10ffa433cb57f34ce4584a6843c35aa553c816dede6"
 },
 "giant-milk": {
  "file": "actor/giant-milk-strip.png",
  "cell": [
   434,
   589
  ],
  "n": 10,
  "srcH": 581,
  "anchors": [
   174.5,
   174.5,
   174.5,
   174.5,
   174.5,
   174.5,
   173.5,
   174.5,
   173.5,
   174.5
  ],
  "sha256": "516dd1c4e37079576814121ed4db08e83579cce7f8b7b5a5245f5add61206fa3",
  "source": "seedance",
  "kind": "loop",
  "action": "seated milking loop (verb-clock; hands alternate pull-and-squeeze, shoulder rock; serves II-04/III-01/III-07; 10 frames from seedance clip job_uuDDcTkmPEmtUxbpXg2EWRvL, gated 2026-08-16: identity delta -0.2..+3.0 vs polyphemus-seated (-14.5), scale drift 0.17%, bg contam <=0.091%, loop closure 0.78%, adjacent XOR 0.9-8.5% median 3.6)"
 },
 "giant-grope-sway": {
  "file": "actor/giant-grope-sway-strip.png",
  "cell": [
   792,
   619
  ],
  "n": 10,
  "srcH": 610.9,
  "anchors": [
   371.5,
   371.5,
   371.5,
   372,
   372,
   370.5,
   371,
   371,
   371.5,
   371.5
  ],
  "sha256": "dceb9957a1d6c6dd86a702767fb475c9b51c2726bc3b78fad43756853c519fec",
  "source": "seedance",
  "kind": "loop",
  "action": "blinded doorway grope-sway loop (verb-clock; palms pat the air, head weaving; serves IV-11/IV-12/V-00..07 doorway bulk; 10 frames from seedance clip job_CtejK6XQq4sdGNc7yKkaYuAw, gated 2026-08-16: identity delta +2.3..+13.6 vs polyphemus-blinded-grope (-14.1), scale drift 0.33%, bg contam <=0.237%, loop closure 1.34%, adjacent XOR 1.8-10.3% median 5.1)"
 },
 "giant-stroke": {
  "file": "actor/giant-stroke-strip.png",
  "cell": [
   352,
   589
  ],
  "n": 10,
  "srcH": 581,
  "anchors": [
   204.5,
   204.5,
   204.5,
   204.5,
   204.5,
   204.5,
   204.5,
   204.5,
   204.5,
   205.5
  ],
  "sha256": "c0f22825cd674ad9508244d601ab7a1dded3a2e5964431435ce5e6a4fd004e55",
  "source": "seedance",
  "kind": "loop",
  "action": "ram-back hand-pass loop (verb-clock; canonical stroke cut includes the great ram under the palm; serves V-06..10; 10 frames from seedance clip job_nZd7BLxsquycoaceHL54EJRe, gated 2026-08-16: identity delta +2.9..+5.0 vs polyphemus-stroke (-11.6), scale drift 0.17%, bg contam <=0.126%, loop closure 1.59%, adjacent XOR 0.3-2.2% median 0.9)"
 },
 "crew-run": {
  "file": "actor/crew-run-strip.png",
  "cell": [
   410,
   564
  ],
  "n": 10,
  "srcH": 534.4,
  "anchors": [
   66.5,
   112.5,
   235.5,
   285,
   195.5,
   66.5,
   240.5,
   295.5,
   368.5,
   66.5
  ],
  "sha256": "abe99ba4f703c71e63a870042eaa497c678c1688f4e831d8b8c26ed2ded68b3a",
  "source": "seedance",
  "kind": "loop",
  "action": "sprint run cycle (distance-driven; authored facing right in full profile like the gated crew-walk strip, engine flips + per-man phase; grounded stride, frames 52-65 of the clip = one closing cycle; serves V-12/I-07/VI-13; 10 frames from seedance clip job_Pb7wChzWyeXLh8b8odKQR4md, gated 2026-08-16: identity delta +6.9..+9.4 vs crew-a-stand (54.2), scale drift 5.80%, bg contam <=0.106%, loop closure 3.03%, adjacent XOR 56.5-95.6% median 81.5)"
 },
 "crew-row-retry": {
  "file": "actor/crew-row-retry-strip.png",
  "cell": [
   576,
   530
  ],
  "n": 10,
  "srcH": 398,
  "anchors": [
   465.5,
   464,
   461.5,
   463,
   466.5,
   466.5,
   466.5,
   466,
   466,
   466
  ],
  "sha256": "de06047116834a1b63ff19ba7501c55007085f76437c5678ceeb9cfacddf2999",
  "source": "seedance",
  "kind": "loop",
  "action": "seated oar pull loop, RETRY of the n=4 crew-row strip (time-driven on row period x effort; rower centered so the full oar sweep stays in frame every cell; anchors are the MAN's feet via the eroded man-component measure, never the sweeping blade; clip is one full stroke, slots [0,10,27,37,47,57,67,76,86,96] jittered off the lean apices; serves I-07/V-12/VI oars; 10 frames from seedance clip job_isVL2X2Ub6oACbq9tFJQWpRU, gated 2026-08-16: identity delta -2.7..+6.5 vs crew-row (52.4), scale drift 7.46%, bg contam <=0.158%, loop closure 2.70%, adjacent XOR 13.3-71.1% median 65.9)",
  "supersedes": "crew-row",
  "anchorNote": "anchors/srcH are the MAN's feet (rower man-component measure), never the blade"
 },
 "curse-sway": {
  "file": "actor/curse-sway-strip.png",
  "cell": [
   390,
   602
  ],
  "n": 10,
  "srcH": 592.9,
  "anchors": [
   177.5,
   177.5,
   176.5,
   177.5,
   177.5,
   178,
   178.5,
   177.5,
   177.5,
   177.5
  ],
  "sha256": "48dfc7d2db23bae1a4fe93232ca69a26f144e83c32ec67eef722cfcca9399662",
  "source": "seedance",
  "kind": "loop",
  "action": "arms-to-firmament prayer sway loop (verb-clock; arms never lower; serves VI-11 curse tableau; 10 frames from seedance clip job_hRT39Xe23U7TdsQgt9rYv75j, gated 2026-08-16: identity delta +0.2..+6.3 vs polyphemus-curse (13.6), scale drift 2.60%, bg contam <=0.118%, loop closure 2.32%, adjacent XOR 4.9-25.7% median 15.7)"
 }
};
