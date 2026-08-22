# PROCESS & PRESENTATION — mined playbook (gaslight-remake, 3 weeks, 2026-08-09..21)

Mined 2026-08-21 from: `tools/ody/BAR-3D.md`, `.src-worktree/review/` (rounds 1–8b,
`fable-pass/notes.md`, `SIGNOFF.md`), `tools/ody/{REVIEW-notes.md, cine-sol-r1.md,
DIRECTORS-BOOK.md, sam2path-sol-r{1,3}.md, research/SYNTHESIS.md,
research/codex-skills.md, shots-proto/SHOTS.md, WIRING.md, work/king-tier-diagnosis.md,
work/headlab/C2/AGENTS.md}`, `site-deploy/living-odyssey/3d/shots3d.json`, project
memory (`~/.claude/projects/-Users-samz-Documents/memory/gaslight-remake.md`), and the
session journal (palimpsest diagnosis, stall incidents).

Audience: a team member (or agent) who must produce GREAT 3D/interactive-book assets
tomorrow. Every finding is a LAW / RECIPE / GOTCHA / DEAD-END with its incident and
numbers.

---

## 1. THE SUPERVISOR / IMPLEMENTOR / REVIEWER LOOP

### LAW — Write THE BAR before the work, as a document with named failure classes
Incident: `tools/ody/BAR-3D.md` — sign-off criteria for the 3D sets, written before
review rounds began. Role split in its first line: *"supervisor/reviewer: Fable 5;
implementors: Opus 5."* Six criteria; failures are NAMED in advance ("square white
confetti is the named failure" for water; "a set without its [pass] log is an
automatic fail"). A bar that exists only in the reviewer's head cannot converge a
multi-agent loop; a bar on disk makes every round adjudicable.
Numbers: 6 criteria; sea3d converged in 4 rounds against it; shore3d in 4.

### LAW — The authority ladder: owner's eye > supervisor's eye > every instrument
Incident: BAR-3D.md §6 verbatim: "The owner's eye outranks Fable's; Fable's outranks
every instrument." Proven repeatedly: Round-4 (2026-08-14) the user's eye rejected a
"physically correct" lamp2 front-cut exemption the supervisor had accepted — *"a
'physically correct' defect is still a defect wearing an explanation."* And "Lap clean
is not sign-off" is the bar's own second sentence.

### LAW — Every fix ships WITH its own lap assertion, or it isn't a fix
Incident: Fable full-book review round 1 (2026-08-13, `review/fable-pass/notes.md`):
14 defects, 8 major — and THREE of them (F7 ring-push, F9 Watson-still-painted, F10
black heading leaf) had been *claimed fixed by a previous lane whose lap was clean*.
The claims had no assertions, so nothing had actually verified them. Law adopted at
round-1 verdict: "every fix lands WITH a lap assertion proving it (pixel/size/luma at
the unit's own lens)."
Numbers: Round 2 = ACCEPTED, all 8 majors dead, **all 14 per-fix assertions present
AND green** in a 180.7s lap, 95/95 units. Convergence went from "claimed-fixed
regressions" to one round.

### LAW — Named defects with stable IDs, carried across rounds as a ratchet
Incident: the whole trail uses defect registries: F1–F17 (gaslight book, four rounds),
E1–E5 (Odyssey eye review, `tools/ody/REVIEW-notes.md`), W-series (sea3d), O.1–O.14
(Odyssey facts as assertion list), Sol's #1–#8 (cine-r1). A defect keeps its number
until its gate exists and is green; the lap file accretes the gates (lap reached
F1–F17; lap-ody carries [closeup]/[teleport]/[shot]/[strip-luma] bands). SHOT_PENDING
in lap-ody (26 units) is the same mechanism used as a forward ratchet: a row retires
only when its shot lands or its lens falls to 2.5.

### LAW — Fix the CLASS, not the instance
Incident: Round 3→4 (2026-08-14). Round 3 fixed the parked-carriage-on-lamp instance
and *exempted* lamp2 ("front cut draws it correctly"). The user's eye rejected the
exemption in round 4 → the fix became a class law: "no rig settles on ANY post column
at ANY dwell," gated at 11 settles. Same pattern at the teleport round (2026-08-17):
Sol exposed one 1-frame seam; the fix was THE TELEPORT LAW over every animation-state
handoff — [teleport] gate = per-tick centre ≤3.5px, verified over **8,844 tick-pairs**.

### LAW — Gates must measure the RENDERED thing, not the model state
Incident 1: the stance gate measured the sprite ANCHOR and read 0.000px drift while
the rendered pixels moved 12–13px (flash+seams round, 2026-08-17) — rebuilt optical.
Incident 2 (Round 4, F17): the King's paint layer ignored masked STATE — state was
right, paint wasn't; three review rounds missed it. Law: "assert paint layers
directly, never infer from state."

### RECIPE — Rounds-to-convergence, measured
- Gaslight Beat I (first build): **7 rounds** to SIGNOFF (R1: 4 majors → R7 ledger
  closure), each round independently verified by a second Opus agent with its own
  instruments (`review/SIGNOFF.md`).
- Fable full-book pass: **2 rounds** once the fix-ships-with-gate law existed
  (round 1: 14 defects; round 2: accepted).
- User-eye rounds 3+4: 2 more rounds, 3 defects, each converting to a class law.
- Sea3d rebuild: **4 rounds** (blockout→…→lighting passes, then a global-exposure
  round closed by measuring both compare halves: plate median 18.1 vs before 12.5
  vs after 18.0).
- SAM2 composite path: **3 Sol rounds and still "No" at the bar** → the correct move
  was not round 4 but changing asset class (see §5, DEAD-END).
Rule of thumb this data supports: 2 rounds when every fix carries a gate; 4+ when the
medium itself is being learned; if round 3 still fails the bar, question the
architecture, not the polish.

### RECIPE — Independent verification per round
Incident: SIGNOFF.md — "Verified independently every round by a second Opus agent
with its own instruments." The verifier does not reuse the implementor's probes.
Round-7 evidence style: gates "proved non-vacuous by deliberate regression" — break
the thing on purpose and watch the gate go red before trusting its green.

### GOTCHA — Never pipe the lap verdict
Incident: SHOT architecture ship (2026-08-18): `lap … | tail` ate the exit code →
**shipped a red build once**. The lap's exit code is the verdict; nothing may sit
between it and the shell.

### GOTCHA — Waivers are logged, numbered, and carry reasons
Incident: SIGNOFF.md "Standing waivers" section — 9 waived items each with its reason
and the round doc that holds the rationale. A waiver without a written reason is how
"physically correct" defects survive.

---

## 2. EXTERNAL REVIEWER (Sol = GPT-5.6-sol via Codex CLI)

### RECIPE — How to run Sol
From memory + `sam2path-sol-r*.md` headers: Codex CLI 0.147+, auth in `~/.codex`;
`codex exec` read-only sandbox, reasoning effort **xhigh**; `-i` attaches images AND
mp4 video; when images are attached the prompt goes via **stdin**;
`--skip-git-repo-check` needed at non-git roots; if the terminal tail clips, the full
output is in `~/.codex/sessions/`. Record the session id + token count in the round
doc (r1: session 01a0252d…, 12,442 tokens) — reviews are evidence, so they get
provenance like any asset.

### RECIPE — The re-review prompt is "verify EACH claim, no flattery"
Incident: `sam2path-sol-r3.md` prompt, verbatim pattern: list the claimed fixes, then
"Verify EACH claim — fixed or not, with frame refs — then answer: is this now at the
bar … Top 3 remaining issues if any. No flattery." Sol returned a claim-by-claim
verdict table (Partially fixed / Not fixed / Rebuilt structurally, not solved
visually) — vastly more actionable than a fresh open-ended critique. Also: label the
frames in canonical order in the prompt; Sol coped with an accidentally duplicated
upload because the numbering was explicit.

### LAW — The external eye catches what internal gates structurally cannot
What Sol caught that lap/gates missed, with incidents:
1. **Hold soft-fail deadlock** — a reader could be stranded forever (Sol round
   2026-08-17); the lap never waits like a confused human does.
2. **The sacrifice tableau missing while the lap was green** — §3.4 recommitted as a
   staging-body assertion; the gate had never asserted the tableau's body.
3. **The seam CLASS** (1-frame pose/position substitutions at state handoffs),
   including a regression a polish round had introduced (a 64px snap at arrival
   settle) — internal review had signed the polish off.
4. **"Set coverage, not escalating cinema"** (cine-sol-r1.md) — a sequence-level
   defect no per-frame gate could express; it became the coverage grammar (§4).
5. **"3D pieces placed over paintings, not inhabitants"** (sam2path r1) — named the
   five causes (contact shadows, local light, register, guide overlays, scale cues)
   and ranked 8 fixes by reader impact.

### GOTCHA — Resolve the gates before capturing motion for review
Incident: Sol round 2026-08-17 — motion capture sent with unresolved gate dwells read
as "static" → **2 false positives** cost a round-trip. When exporting video for an
external reviewer, drive the interaction first so dwells are real dwells.

### GOTCHA — Debug overlays nuke external review validity
Incident: sam2path-sol-r1 fix #2: "Remove every path, control and guide overlay.
These lines turn the image from an illustrated world into a development viewport
instantly." Internal reviewers had tuned them out; the outside eye can't.

### RECIPE — Arming an external BUILDER: instruments + numeric targets, or don't bother
Incident: `tools/ody/work/headlab/C2/AGENTS.md` (ARMED-SOL head rebuild). Arm C —
Sol sculpting by eye — failed the owner's eye (10 OK / 0 WATCH / 4 MISS, shape IoU
0.7546). The rerun's workspace contract: "every claim about the face must be a number
from an instrument, and every edit must state the number it is trying to move," with
a measured disease table (hairline_n ref 0.194 vs 0.391 built; chin_n 0.706 vs 0.909;
eye→chin span 0.31 vs 0.42) and a MediaPipe facial map as targets. The pattern
generalizes: an external agent inherits none of your taste — hand it probes and
target numbers, not adjectives. (AGENTS.md is Codex's persistent-instruction file,
the CLAUDE.md equivalent — `research/codex-skills.md` §1c.)

---

## 3. STALL / RECOVERY PLAYBOOK

### LAW — Work SURVIVES on disk; a "stalled" lane may be nearly complete
Incident: workflow-agent stall pattern struck **3×** on this project (round-8 build,
8c, church fix lane): long art lanes die at the 180s no-progress detector even with
anti-stall prompts. Recovery that works every time: (1) inventory the tree + journal,
(2) **run the lap** to see which gates already pass, (3) finish the remainder inline
yourself. Corroborated cross-project (doodle-story lane-4: "stalled 6 attempts" agent
was nearly COMPLETE on disk; the actual blocker was the dev server being down during
its live-verify).

### RECIPE — Distinguish infra stalls from failed iterations (the Opus-outage playbook)
Incident: arena campaign 2026-08-18, blocked **5×** by Opus stream stalls ("no
progress 180s ×6 attempts"; status.claude.com confirmed degradation, stalls continued
past its "resolved" stamp). The playbook: infra stalls ≠ failed iterations → resume
(cached agents replay); check the status page; back off 25–45 min between attempts;
after ~5 identical failures **switch builder model** in the persisted script and
disclose the deviation from the owner's model mandate. Fable completed every request
throughout the incident.

### RECIPE — Anti-stall rules for long art lanes
From the recovery notes: relaunch as smaller-scoped continuation workflows; put
timeouts on generation; make generation polls DETACHED (kick off the render/video
job, poll from a fresh call) so no single tool call sits idle past the detector.
Adjudications and fix decisions go to disk immediately (arena: "Adjudication
CACHED+on disk") so a killed lane loses zero rulings.

### GOTCHA — Giant inline-JSON prompts stall subagents
Incident (doodle-story, same machine/period): Opus subagents stalled 6/6 attempts,
silent after 2 tool calls, when the prompt carried giant inline JSON. Put large data
in files and pass paths.

### GOTCHA — Keep the dependency (dev server) up during workflows
Incident: doodle-story lane-4 stall root cause was the live-verify target being down.
A lane that verifies against :PORT needs the server as part of the lane's contract.

---

## 4. THE CINEMATOGRAPHY ARC (round 1 → directors-cut)

The arc: cine-r1 frames → Sol's DP review (`cine-sol-r1.md`) → VIEW-R2 (readability
rig + Sol's 8 fixes + escalation/screen-direction gates) → round 3, THE DIRECTOR'S
BOOK (`tools/ody/DIRECTORS-BOOK.md`) + `shots3d.json` regenerated as SEQUENCES.

### LAW — A shot table without a cut pattern is postcards, not cinema
Incident: DIRECTORS-BOOK.md §0 — "Round 2 gave every unit a good shot. It did not
give any scene a cut pattern. **Beat 1 = 13 units at 13 distinct camera setups.** A
scene in which every angle is used exactly once has no coverage. It has postcards."
This is Sol's r1 verdict ("set coverage, not escalating cinema") restated one level
up. The fix is a small setup vocabulary per scene, established then ALTERNATED.

### RECIPE — The coverage grammar, gated (the three laws)
From DIRECTORS-BOOK.md §0, each with its bake warning + lap gate:
1. **The angle changes** between consecutive units unless a hold is declared — and a
   hold is the same shot still running (same station/lens, move clock not restarted).
2. **Establish once** per scene; a changed world re-establishes on a NEW setup
   (`reestablish`); a returning master declares a `reprise` reason.
3. **The vocabulary recurs** — ≥¼ of a scene's cuts must RETURN to a known setup.
Final numbers across 6 scenes / 81 units: **56 setups · 73 cuts · 2 holds (both with
written reasons) · 23 returns · 5 dissolves (all of them time passing)**.
`shots3d.json` carries it all machine-readable: `coverage.totals`, per-scene
`sequences` (setup id/name/role/takes), `escalation.rungs`, `axis.sides`.

### RECIPE — shots3d.json shot CLASSES: floors, caps, and meaning by height
Classes (shots3d.json): DIALOGUE floor 0.30 · OTS 0.30 · GIANT floor 0.42, cap 0.96,
crownPitch ≥21° ("the lens is below him") · NARRATION 0.20 · ACTION 0.17 · GATE 0.22
· CLOCK 0.18 · WIDE 0.045 (one per beat, at the heading) · POV floor 0.
Distance is NEVER chosen by taste: `d = h / (2·frac·tan(fov/2))` — frac is declared,
the class floor is the minimum. Height is meaning: humans at 1.55–1.7 m, giant
encounters from 0.95–1.5 m; the cave's escalation rungs run camY 1.55→1.25→0.95 and
dist 7.69→6.67→5.45 m — lower and nearer every beat until Beat V turns the camera to
face the mouth. Axis law gated on 41 pinned rows ([side]): giant frame RIGHT, men
LEFT; at sea island RIGHT, ship LEFT.

### RECIPE — Choose ONE director lens and write down what the runners-up would have cost
Incident: DIRECTORS-BOOK.md §1 — Spielberg chosen from the cinematic-director skill's
`references/director_styles/` because "its editing default IS coverage" and its scale
grammar (threat from a child's eye height) was Sol's sequence note word for word.
Runners-up documented with disqualifying quotes (Villeneuve "unsuited to ensemble
dialogue"; Kurosawa cuts "between focal compressions, not angles" = the direct
negation of the mandate; Kubrick's detachment vs a reader inside Ulysses' body).
The lens's forbidden list (dutch/unmotivated-handheld/orbit/snap-zoom/whip) was
reconciled item by item, and the surviving exceptions are DECLARED in the table.

### LAW — THE READABILITY LAW: a dramatic frame that hides the action is a defect, not a style
From DIRECTORS-BOOK.md §6, gated on all 81 shots, measured on the drawn pixels inside
the subject's projected box: p90 ≥ 0.30, mean ≥ 0.10, separation ≥ 0.05 from a ring
around it, plus a near-black cap. Born from Sol r1 #1 ("most of the frame is an
unreadable black occlusion") and #6 (expose for the flame; shots dominated by blaze
are printed down, dof.expo 0.86–0.90). Threat ratio the lens's way: pull the FILL,
never close the key — overall illuminance unchanged.

### RECIPE — DP prescriptions worth stealing verbatim (cine-sol-r1.md)
- Face before weapon: "shoot the face that sees before the thing that is seen" —
  courage plays on the faces the courage arrived in; only then show the auger.
- The same horror twice = cover the second one as REACTION (three meals, three
  angles: silhouette seize → the watching faces → return to the seize).
- Scale is spatial evidence, not size: the giant reads as giant only with a known
  body at his feet (`fg: ulysses`, the book's one `scaleRefOk` gate, ratio <0.72).
- Racks are reveals, not blurs: name both depths and when focus travels (bowl→giant
  and back reversed; auger tip→eye at 0.12s; hand→man under fleece).
- Handheld is an EVENT: locked-with-breath until `mv.at`, breaks loose at contact.
- Departure needs screen direction + wake + shrinking island, or the ship reads
  parked (Sol #8b → `SEA-OFF` pinned side −1).

### GOTCHA — Transitions must be invisible to measurement
DIRECTORS-BOOK.md §7: dissolves play on the composited frame from a history target —
the scene graph never learns a transition happened — and are FORCED OFF while any
gate reads pixels: "a measurement must never be taken of a frame that is half of two
shots."

---

## 5. PROMOTION, NOT ACCRETION (the palimpsest failure + the rebuild)

### DEAD-END — The book as construction site (the palimpsest diagnosis, verbatim)
Incident (session journal, 3D book): "The demo was crafted **once**, through gated
passes, then frozen — that's why it's great. The book was treated as a construction
site: the SAM2 plate-sandwich experiment, three rounds of color fixes, staging
rounds — all applied *directly to the shipped product*. Worst of all: when I ruled
the SAM2 composite path dead, **I closed the door but left the product standing in
the doorway** — the book's interior scenes still render characters through the very
architecture I rejected."

### RECIPE — The rebuild: assemble from frozen, signed-off artifacts under one authority
The FOUNDATION+ASSEMBLY lanes (tasks 154–163, all shipped): (1) **archive** the dead
experiment honestly (`demo3d/sam2-experiment/` — the corpse gets a grave, not a
squat); (2) **extract the demo's one proven pipeline** (`render3d.js`); (3) one
`world.js` scale authority with a `[scale]` boot gate — every visible instance
validated against the ledger at boot, goat included; (4) stage skeleton + set mounts
+ cast demo path; (5) re-wire the story grammar; only THEN mount the camera
(shots3d.json + cine3d.js) and run the green 81-unit walk. The book becomes an
assembly of bar-passed parts, not a palimpsest of fixes.

### RECIPE — Prototype in a sandbox, prove with a probe, then promote
Incident: the SHOT mechanism (`tools/ody/shots-proto/`): built on COPIES ("no shipped
set was edited"), proven by `probe.mjs` — **14 checks, ALL GREEN** (crossfade band,
byte-equal double lap, world-lives-beneath, zoom cap, shot-space anchors, fall,
reduced-motion still) — and only then promoted into stage.js/main.js/lap (memory:
"SHOT mechanism promoted 2026-08-17"). Same shape as img2threejs staged passes: the
promotion gate is the prototype's own falsifiability artifact.

### DEAD-END — Iterating a doomed asset class instead of switching class
Incident: the composite close-up. Three Sol rounds (sam2path r1→r3) improved it and
still: "Bar verdict: **No.** The characters still read as softened 2D overlays." The
load-bearing fact (research/SYNTHESIS.md): control case b3-36 matched the plate to
dE NOISE (dL −0.3, dW −4.2) **and still read pasted** — color was never sufficient.
The 7-lane research sweep found 5/6 independent lanes saying "close-up is the wrong
asset class." Verdict: HYBRID by camera stop — close-ups become AUTHORED SHOTS
(character painted INTO the plate, ~$2/chapter for 4 shots ×4 candidates), wides keep
composites + the $0 fixes (light wrap/edge decon, shared grain, atmosphere sandwich).
Lesson: when round N's fixes are "applied but unsuccessful as integration," the next
round is a research sweep, not round N+1.

### LAW — Retire the superseded mechanism when its replacement lands
Incidents: fused shots retire the digital zoom (SHOT_KCAP 2.5, per-unit ratchet
SHOT_PENDING 26 rows); the shot's clip supersedes the inset it replaces (grants
retire, seed reused); [shot] law REPLACES [closeup] floors at shot units — the floor
moves to the generation lane. The opposite of the palimpsest: every promotion names
what it kills.

---

## 6. THE SKILL ECOSYSTEM

### RECIPE — SKILL.md is a cross-agent standard; one skill body serves both agents
From `research/codex-skills.md` (researched 2026-08-19): Codex CLI supports SKILL.md
natively — `~/.codex/skills/<name>/` (personal) and `.codex/skills/<name>/`
(project); invocation `/skills`, `$<name>`, or auto-match; the format is an open
standard (agentskills.io, 30+ tools). "A well-formed Claude skill directory generally
works when copied from `~/.claude/skills/` into `~/.codex/skills/` without changes."
Codex 0.147.0's `/import` pulls Claude Code setups (instructions, settings, skills,
plugins) wholesale. AGENTS.md remains the persistent-instruction backbone (CLAUDE.md
equivalent) — used exactly that way for the ARMED-SOL workspace contract.

### RECIPE — img2threejs: staged gated passes where the pass log IS the proof
Usage on this project: Baker Street stage (11 gated passes), sea3d rebuild
(spec→blockout→structure→form→material→lighting, EACH pass rendered through the real
page and judged vs the plate, logged with renders in `3d/sea/passes/passlog.md`).
BAR-3D.md §2 makes the log load-bearing: "a set without its log is an automatic
fail." The skill's grimoire is also the diagnostic reference (see next).

### GOTCHA — Read the skill's contract before authoring; track ≠ tier
Incident: `work/king-tier-diagnosis.md` — the code-King shipped at 3,624 tris looking
nothing like the skill creator's ~66k demo. Root cause was NOT budget: the spec used
Track A (primitive assembly — `assembled-solid` ×38, `implicit` ×0) where the skill's
character contract makes Track B (implicit SDF → marching cubes) MANDATORY for L0
head/torso/limbs: "a character whose core is assembled-solid capsules is a
mis-classification against the character contract." Nothing auto-promotes the track;
the spec author selects it. The tier (low ≤6k / standard ≤60k / hero) only scales
density of the chosen track.

### RECIPE — video-shotcraft for the trailer: staged 0–7 with an independent review stage
Odyssey trailer (tasks 164–168, shipped): stage 0–3 brief/style/shot-map/storyboard →
stage 4 asset capture from the REAL served book (real page screenshots, not mockups)
→ stage 5 Remotion shots → stage 6 sound (book audio + VO) → stage 7 **independent
review + ship**. The skill's own pipeline embeds the reviewer gate; don't skip 7.

### RECIPE — cinematic-director as a reference library, not an oracle
The DIRECTORS-BOOK lens choice consumed `references/director_styles/` as DATA — the
lens's coverage_style, scale grammar, light ratios and avoid-list were quoted and
reconciled against the book's measured constraints (§4). The skill supplies the
vocabulary; the project's gates supply the enforcement.

### RECIPE — Research lanes as first-class process
`tools/ody/research/` (7 files): games/github/papers/x-posts/shaders/one-image swept
in parallel, then SYNTHESIS.md ranks consensus BY INDEPENDENT-LANE COUNT (light
mismatch 6/6 lanes; wrong asset class 5; contact shadows 5…) and grades each factor
against what's already shipped (FIXED / HALF / NOT). Recommendations carry cost,
pipeline slot, and the lap gate they'd add. This is how "stop polishing, change
class" got decided with evidence instead of taste.

---

## 7. PRESENTATION LAWS THAT SURVIVED EVERY ROUND (quick table)

| Law | Number | Incident |
|---|---|---|
| Close-up floors by class | close ≥30% panel height, two-shot ≥22%, wides ≤2/beat | CLOSE-UP LAW round, 46 gated settles, worst margin 21.9/22 |
| Zoom cap where no authored shot exists | k ≤ 2.5 | SHOTS.md prototype C; 19 lenses re-valued down |
| Shot crossfade | 250 ms, sim-clock, byte-equal laps | teleport-law band ceiling |
| Teleport law at state handoffs | per-tick centre ≤3.5px, zero bare art swaps | 8,844 tick-pairs green |
| Strip flicker | adjacent-cell luma swing ≤4 | falling-giant flash measured at 13.6 |
| Loop closure / anti-skate | ≤12% endpoint; planted foot ≤2.5 css px/frame (measured 0.45) | video-motion lane |
| Blob law | >4 concurrent `<video>` = Chromium self-aborts one | Stage.loadVideo owns all video bytes |
| One-load law | `vid.src` + later `load()` = self-aborting fetch | ready-promise at birth |
| Readability | p90 ≥0.30 / mean ≥0.10 / separation ≥0.05 in subject box | all 81 shots |
| Coverage totals | 56 setups · 73 cuts · 2 holds · 23 returns · 5 dissolves / 81 units | directors-cut bake |

---

# TOP 10 (ranked by how much failure each one retires)

1. **Every fix ships WITH its own lap assertion** — round 1 found three "fixed"
   defects that had never been fixed because the claims carried no assertions
   (F7/F9/F10); under the law, 14 majors → ACCEPTED in one round with all 14 per-fix
   gates green.
2. **Promotion, not accretion** — the demo was gated passes then frozen; the book was
   a construction site with a dead experiment left rendering inside it. Rebuild from
   frozen signed-off artifacts under one scale authority; every promotion names what
   it retires (SHOT_PENDING ratchet, [shot] replaces [closeup]).
3. **Write THE BAR before the work** (BAR-3D.md): named roles (Fable
   supervisor/reviewer, Opus implementors), named failure classes, "lap clean is not
   sign-off," pass-log-or-fail, and the authority ladder owner's eye > supervisor's
   eye > every instrument.
4. **Gates must measure the rendered thing** — the stance gate read 0.000px on the
   anchor while pixels moved 12–13px; the King's paint ignored a correct state for
   three rounds. Assert pixels/paint, and prove gates non-vacuous by deliberate
   regression.
5. **The external reviewer catches classes internal gates can't express** — Sol
   (GPT-5.6-sol via codex exec, xhigh, images/mp4 via `-i`, prompt via stdin) caught
   a reader-stranding deadlock, a missing tableau behind a green lap, the seam class,
   and "set coverage, not escalating cinema." Re-review prompt = "verify EACH claim,
   fixed or not, with refs; no flattery."
6. **Fix the class, not the instance** — "a 'physically correct' defect is still a
   defect wearing an explanation": parking law over all posts (11 settles), teleport
   law over all handoffs (8,844 tick-pairs), not the one lamp / one seam reported.
7. **Stall recovery: work survives on disk** — struck 3×: inventory the tree, RUN THE
   LAP to see which gates already pass, finish inline. Distinguish infra stalls from
   failed iterations (resume cached agents, back off 25–45 min, switch builder model
   after ~5 identical failures and disclose).
8. **Coverage grammar over per-shot beauty** — 13 units at 13 setups is postcards.
   Small setup vocabulary, establish once, alternate, ≥¼ returns, holds declared —
   gated in bake + lap (final: 56 setups, 73 cuts, 23 returns, 2 holds, 5 dissolves
   over 81 units).
9. **When round 3 still fails the bar, change asset class, not polish** — composite
   close-ups matched the plate to dE noise and still read pasted (b3-36); a 7-lane
   research sweep (5/6 lanes: light; 5: wrong asset class) produced the hybrid
   verdict: authored fused shots for closes (~$2/chapter), composites + $0 fixes for
   wides.
10. **Arm external builders with instruments and numeric targets** — Sol sculpting by
    eye failed the owner (4 MISS, IoU 0.7546); the rerun contract: "every claim must
    be a number from an instrument, and every edit must state the number it is trying
    to move," with a measured disease table and landmark targets. SKILL.md +
    AGENTS.md make one skill/instruction body serve both agent ecosystems
    (`~/.claude/skills` copies clean into `~/.codex/skills`).
