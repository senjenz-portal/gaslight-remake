#!/usr/bin/env node
/**
 * lap.mjs — the review harness.
 *
 * Walks a FULL reader lap of the app through the dev hooks, at every review
 * ratio, and drops one screenshot per unit into
 *   shots/round-<N>/<ratio>/<NN>-<unit-id>.png
 * plus mid-progress frames for the hold verb and a cover-peak frame for the
 * page turn. Every frame is checked for liveness (a black or flat frame is a
 * failure, not a screenshot). Exits nonzero on page errors, console errors,
 * dead frames, or a wedged unit.
 *
 *   node tools/lap.mjs 0                 # round 0, both ratios, auto-serve
 *   node tools/lap.mjs 3 --port 8151     # use a server already running
 *   node tools/lap.mjs 1 --ratio 1440x900 --headed
 *
 * Determinism: the lap latches the app into harness mode on its first
 * __setTime() call, after which nothing in the app moves on wall clock —
 * not the sim, not a CSS transition. Same round, same pixels.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { statsOf, pointsStats, decodePng, hotPixels, pixelDiff, NEAR_BLACK, HOT }
  from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const RATIOS = [
  { name: '1440x900', width: 1440, height: 900 },     // laptop
  { name: '1024x1366', width: 1024, height: 1366 },   // iPad portrait
];

const SETTLE = 1.7;        // sim seconds to let a unit compose before the shot
const ACT_PEEK = 0.6;      // sim seconds after entry: the pantomime mid-frame
const TURN_SETTLE = 1.8;   // sim seconds for the page turn to complete
const MAX_UNITS = 200;     // runaway guard

/**
 * Assets the GENERATION lanes still owe this round. The app wires them by
 * path and degrades gracefully, so their 404s are reported as `pending`
 * (informational) instead of failing the lap. Delete a name from this list
 * the moment its file lands.
 */
const PENDING = new Set([
  // (empty as of round 1: king.glb, both-photo.png, the three king/Irene
  // cameos and book/step/reveal/mask-drop.mp3 all landed. Re-add a name here
  // if a lane's asset goes missing again.)
]);
const isPending = (u) => PENDING.has(u.split('?')[0].split('/').pop());

// a frame must be a picture, not a fill
const MIN_STDEV = 2.0;
const MIN_NONBLACK = 0.05;
const MAX_BRIGHT = 0.985;

/* ---------------- round-2 review metrics ----------------
 * [V1] nearBlack — fraction of the DIORAMA INSET below luma NEAR_BLACK
 *      (26/255). Round 1 failed on three framings that were unlit voids;
 *      the sign-off number is 0.40 and it is enforced, not just reported.
 * [V2] deadBand — fraction of viewport height between the inset's bottom
 *      edge and the top of the first line of type, at PORTRAIT. Round 1
 *      measured ~24% ("two islands"); the sign-off number is 0.08.
 * [c2] a figure must be wholly inside the inset or wholly outside it —
 *      a slice at the edge is the finding.
 */
const NEAR_BLACK_MAX = 0.40;
const NEAR_BLACK_BEATS = new Set(['i-10-comes2', 'i-11-hadnote', 'i-37-door']);
const DEAD_BAND_MAX = 0.08;
const FIGURE_SLICE = [0.02, 0.98];   // inset fraction outside this band = sliced

/* ---------------- round-3 review metrics ----------------
 * [R3-1] Watson is back on stage with a stable mark (the wingback by the
 *        fire). Round 2 "closed" his slice by deleting him from 33 of 38
 *        units INCLUDING his own introduction, so the gate is no longer
 *        "never sliced" — it is "never sliced, AND wholly on frame at the
 *        four units that are ABOUT him".
 * [R3-2] the exterior apron must sit BELOW the room floor in luma. Both are
 *        measured on real surfaces: the app raycasts the sample points onto
 *        the rock and projects them through the same inset the shot used.
 * [R3-3] no part of the window pane may clip. The sign-off number is a ZERO
 *        fraction over luma 250, at the framings that used to blow it.
 * [R3-4] the carriage-lamp pass must be READABLE in the glass: the pane's
 *        mean luma has to swing across one pass of the sweep.
 * [R3-7] the street lantern must read as exterior — measured as sitting
 *        BELOW the room floor's own downstage edge in screen space.
 */
const WATSON_UNITS = new Set(['i-00-head', 'i-01-post', 'i-12-seat', 'i-13-delicacy']);
const WATSON_ON_FRAME_MIN = 0.98;
const PANE_UNITS = new Set(['i-00-head', 'i-10-comes2', 'i-11-hadnote', 'i-37-door']);
const PANE_HOT_MAX = 0;             // fraction of the pane above luma HOT
const APRON_UNIT = 'i-00-head';     // the establishing frame holds the whole base
const LAMP_SWING_MIN = 12;          // luma percentage points across one pass
const LAMP_PASS = 2.8;              // scene.js: the sweep's repeat period, sim s
const LAMP_PEAK_AT = 0.44;          // ...and where inside it the bar peaks
const MIN_REGION_PX = 240;          // a region smaller than this is not evidence

/* ---------------- round-4 review metrics ----------------
 * [R4-1] The mask/unmask camera bisected Holmes (inset 0.49/0.44). A figure at
 *        the edge is either wholly in or wholly out — that was already the rule
 *        for Watson; these three units make it the rule for Holmes too, at the
 *        cameras where he was cut.
 * [R4-2] The post-swap figures had no life left: the only idle animation was on
 *        the placeholder blocks, which `slot.replace()` drops. Life is on the
 *        SLOT now, so it is measurable — the King's entrance must BOB and ROLL,
 *        and a held idle beat must still move the figures' boxes.
 * [R4-3]/[R4-4] The ember and the King's tunic chest were the last two clipped
 *        elements in the lap. Both are gated as an EXACT clipped-pixel count
 *        (luma > 250, every pixel, not sampled): the ember on its own screen box
 *        at every framing that holds it, and the inset — [R5-2] — on EVERY
 *        settled unit frame in the lap rather than the two the findings were
 *        raised on.
 * [R4-6] The slice list used to record figures with no visible pixels at all
 *        (holmes at i-35-briony: box 8% inside, entirely behind the King). Every
 *        slice entry now carries a RENDERED-PIXEL visibility count.
 */
const HOLMES_FRAME_UNITS = new Set(['i-15-condescend', 'i-16-iamking', 'i-17-wilhelm']);
const CLIP_MAX = 0;                 // clipped pixels allowed in a settled inset
const EMBER_HOT_MAX = 0;            // ...and on the fire's own pixels, anywhere
const MIN_EMBER_PX = 120;           // fewer visible ember pixels than this is not evidence
const LIFE_WALK_ACT = 'kingEnter';  // the entrance that must not glide
const LIFE_WALK_STEP = 0.12;        // sim seconds between gait samples
const LIFE_WALK_N = 10;
const LIFE_BOB_MIN = 0.020;         // m of vertical bob across the walk
const LIFE_ROLL_MIN = 0.020;        // rad of body roll across the walk
const LIFE_IDLE_UNIT = 'i-13-delicacy';   // three figures, all of them idle
// long enough to cover most of the slowest breath cycle (the King's, 7.3 s):
// sampling a fifth of a cycle understates the amplitude it is looking for.
const LIFE_IDLE_STEP = 0.42;
const LIFE_IDLE_N = 8;
const LIFE_IDLE_MIN = 0.4;          // px of box drift across a held idle beat

/* ---------------- round-5 review metrics ----------------
 * [R5-1] The King must leave WHOLE. The door's additive glow card is hung in the
 *        opening and depth-tested, so a figure past its plane is composited over:
 *        at i-36-goodnight that gave the departing King 76 clipped px on his own
 *        shoulders and ZERO painted pixels in his head band — a headless cream
 *        garment. The evidence is the app's own head probe (__slotPixels().head,
 *        hide-and-diff over the top sixth of his box), gated at the two units
 *        that ARE his exit: he has to paint head pixels, and none of them may
 *        clip. A figure can be present, on-frame and still unreadable; box
 *        coverage cannot tell you that and this can.
 * [R5-2] The exact clipped-pixel gate covered TWO units in round 4 and skipped
 *        every `--` artefact frame in silence — which is precisely where the
 *        headless King was hiding, one frame either side of a gated one. The
 *        census now runs on EVERY frame that carries a unit id:
 *          settled frame  -> GATE, hot must be exactly 0
 *          artefact frame -> REPORT, and flag anything over CLIP_TRANSIENT_MAX
 *        (The page-turn cover and the closing card are shot allowDark with no
 *        unit id, and stay outside the census: the cover is a DOM cover over the
 *        plate rather than a composition, and — [R6-6] — the card is page 2, a
 *        leaf with no picture on it at all. There is no inset there to census, and
 *        a bare dark leaf would trip the liveness check that a picture must pass.)
 * [R5-3] An artefact frame is an INSTANT inside a performance, not a composition
 *        a reader ever holds, so it is reported and not gated. It is not, however,
 *        UNMEASURED: `walkScan` and `standScan` step the two windows this project
 *        ever found clipping in one FIXED_DT frame at a time.
 *        [R7-2] What those instruments actually measure, this build, is written
 *        here in the numbers they print rather than in the numbers the fix was
 *        argued from. Round 5's version of this note claimed a 9 px peak on the
 *        King's walk-out "sampled every 0.01 s" — a sample between the app's own
 *        1/60 s frames, of a walk that [R7-1] has since deleted. This build, worst
 *        of 4 clock phases, 1008 frames per window per ratio:
 *          · the inbound crossing (kingEnter, i-11) peaks at 10 px over luma 250 at
 *            BOTH ratios (per-phase 1/4/0/10 landscape, 1/5/0/10 portrait), clipping
 *            at all for 0.17 s landscape / 0.15 s portrait, hottest pixel 254.8
 *          · the King's last beat (standScan, i-37 -> the top of the turn) holds
 *            0 clipped px in the whole inset on every one of its 436 frames — two
 *            walk-in cadences at each ratio — and 0 on his own pixels; the hottest
 *            pixel anywhere on any of them is the threshold lamp's 246.8, under the
 *            line
 *        So the 40 px tolerance below is a line nothing in the lap is near, and
 *        both instruments would report it if anything were.
 * [R5-5] The life probes below advance the sim clock, so in round 4 they pushed
 *        every post-i-11 unit's captured beat phase off the canonical timeline.
 *        They run as a post-lap RE-WALK now (see lifeProbes): the reader's lap
 *        keeps its own clock, and `simSeconds` is the length of that lap alone.
 */
/* [R7-1] The gate beat joins his exit beats: he STANDS at the sill across the door
 * gate now, so the settled frame of i-37 is a frame of the King and is gated as
 * one — head band, clipped pixels and all. */
const EXIT_UNITS = new Set(['i-35-briony', 'i-36-goodnight', 'i-37-door']);

/* ---------------- round-6 review metrics ----------------
 * [R6-1] THE KING'S EXIT IS READER-PACED, AND THAT IS MEASURED AT FOUR DWELLS.
 *        Round 5 walked him out on a sim timer armed at i-35, so what the reader
 *        saw was a function of how long the reader looked: 2.5 s at i-35 gave a
 *        headless goodnight, 3.5 s gave a goodnight to an empty doorway, 0.5–1.0 s
 *        left him standing across the "click the door" gate. The app holds him at
 *        the sill as a STATE with no end time (scene.js kingExit). A claim like that
 *        cannot be proved by one lap at one cadence, so `dwellSweep` re-walks
 *        i-35 -> i-36 -> i-37 at each of DWELLS. The sweep runs AFTER the reader's
 *        lap, like the life probes ([R5-5]), so the reviewed timeline keeps its own
 *        clock.
 *        [R7-1] AND ITS THIRD LEG IS MEASURED AT READER CADENCE. Round 6 asserted
 *        the opposite of what this build promises at i-37 — that he was OUT of the
 *        doorway by the time the gate went live — and it looked for that after
 *        SETTLE + dwell, i.e. 2.2 s+ after the advance, when the 0.98 s walk-out it
 *        was validating had been over for a second. The reviewer walked the same
 *        build at the reader's own pace and found the walk decapitated him from
 *        0.35 s in: a whole class of frame this sweep could not see because it
 *        never looked while the reader was looking. The i-37 leg now measures at the
 *        DWELL ALONE — the first thing the reader gets after the advance — and
 *        asserts, at every one of DWELLS, at both ratios:
 *          · i-35, i-36, i-37: the head band paints >= HEAD_PX_MIN of his own
 *            pixels, and none of his pixels clip anywhere
 *          · his mover is bound to the SILL at all three beats (never to KING_OUT):
 *            nothing is walking him anywhere while the reader reads
 *          · the door target's ring is PAINTING on the plate with him on stage
 *            (measured by hiding the ring and diffing the frame), and the gate
 *            still resolves through the real raycast into the closing card
 *        `standScan` then covers the frames BETWEEN those samples.
 * [R6-2] The transient tolerance is now a MEASURED envelope. See WALK_SCANS.
 * [R6-4] HEAD_PX_MIN was 1 — a gate that could only catch a King who painted
 *        literally nothing. It is 300 px now, an ABSOLUTE count, and the report
 *        carries the fraction of the head-band box he fills next to it. The
 *        alternative the review offered (15% of the head-band box) is not a
 *        reachable target and the fraction says why: the band is the full WIDTH of
 *        his screen box by 16% of its height, and his box is as wide as a cloaked
 *        pair of shoulders, so a whole head — measured, at all three of his beats,
 *        every dwell, both ratios — fills 4.41% to 6.55% of that rectangle, i.e.
 *        1133 to 2128 px of his own head. 300 px is under a third of
 *        the tightest whole head in this lap and it is a line round 4's headless
 *        King, who painted 0 head px with his box still reporting 100% on frame,
 *        misses entirely.
 * [R6-5] The receded margin lines are gated on WCAG AA, measured off the
 *        screenshot by hiding the type and diffing (see contrastProbe).
 */
const DWELLS = [0.5, 2.5, 5, 10];   // sim seconds a reader might sit on a unit
const HEAD_PX_MIN = 300;            // [R6-4] px of his own head band he must paint
const EXIT_ENTER = 'i-35-briony';   // the unit that starts the exit
const GATE_UNIT = 'i-37-door';      // ...and the gate he stands across ([R7-1])
const SILL_OFF_MAX = 0.02;          // m off the sill mark before "standing" is a lie
/* [R7-1] The door gate's ring is a screen-space SVG overlay, so a King standing on
 * the mark it points at cannot occlude it — but "cannot" is an argument, and this is
 * a measurement: hide the element, diff the frame, count the ink inside a box around
 * the target point. Measured, with him on stage at all four dwells: 3274-3585 px of
 * ring inside that box at both ratios, peak per-pixel delta 197.3 luma. The gate is
 * 1000 px — under a third of the thinnest ring measured, and a ring that had gone
 * dark, been pushed off the plate or been drawn under the diorama would be nowhere
 * near it. */
const RING_BOX = 60;                // px half-width of the box the diff counts in
const MIN_RING_PX = 1000;           // ...and the ring ink that has to be inside it

/* [R6-2] TRANSIENT CLIPPING, MEASURED FRAME BY FRAME — AND THEN CLOSED.
 * Round 5 justified a 40 px tolerance from a 0.01 s SAMPLE of the exit walk and
 * wrote "9 px" in scene.js. Both numbers were sampling artefacts: the walks are
 * stepped at FIXED_DT (1/60 s) and the peak lands between samples. `walkScan`
 * steps the sim one fixed step at a time across each window below and counts every
 * clipped pixel in the inset on every one of those frames (window.__insetHot,
 * cross-checked against the PNG census — see `hotCheck`), at four clock phases.
 *   Measured that way, the pre-fix build peaked at 223 px worst-of-four on the
 * inbound crossing (single-phase samples ranged 67 to 356 px) and 64 px on the
 * walk-out. The hide-one-light probe said why: BOTH the threshold lamp and the
 * door's additive glow card are needed to put his chest over the line — with
 * either one off, his hottest pixel is 226.8 or 236.2 — and the card was still at
 * 44% strength over his chest at the peak instant, because its yield ramp only
 * conceded a body once that body's MARK was a third of a metre past the card's
 * plane. His chest is a quarter-metre in front of his mark. scene.js widened the
 * ramp to start where his chest starts occluding the landing, and the transient
 * closed: the reviewer's alternative (a declared <= 350 px envelope) is not needed.
 * MEASURED, this build, worst of four phases:
 *   kingEnter, the inbound crossing      10 px at BOTH ratios (per-phase peaks
 *       1/4/0/10 landscape, 1/5/0/10 portrait), never over 40 px, 0.17/0.15 s
 *       clipping at all, hottest pixel 254.8
 * so the tolerance stays where round 5 put it, and now it is a line the walk clears
 * by 4x rather than a line drawn under it.
 *   [R7-1] There is one walk in the list now, not two. The outbound walk this scan
 * used to cover no longer exists — the King holds the sill and the page turn takes
 * him off — and the beat that replaced it is not a walk, so it gets an instrument
 * that measures what it IS: `standScan`, below, which steps the same FIXED_DT frames
 * from the reader's advance out of the goodnight to the top of the turn and asks on
 * each of them whether he is still whole.
 */
const CLIP_TRANSIENT_MAX = 40;      // clipped px tolerated on a non-settled instant
const CLIP_TRANSIENT_SPAN = 0.2;    // ...and for how long, in sim seconds
const WALK_SCANS = [
  // act, sim seconds after the act to start, seconds to scan
  { act: 'kingEnter', unit: 'i-11-hadnote', from: 0.6, span: 4.2,
    what: 'the King crossing the threshold inbound' },
];
/* [R7-1] `standScan`'s window: the reader's advance into the door gate, a whole
 * second of standing (longer than the walk it replaced), then the gate click and
 * every frame of the cover rising over the plate. TURN_IN is 0.55 s in main.js, so
 * 0.8 s of post-gate scanning covers the swap and the first frames of the card. */
const STAND_SCAN = { unit: GATE_UNIT, before: 1.0, after: 0.8 };
const FIXED_DT = 1 / 60;            // app/clock.js — the only quantum the sim moves in
/* ...AND AT FOUR CLOCK PHASES. A walk's pose is a function of UNIT time, but the
 * light falling on it is not: the threshold lamp flickers on absolute sim time
 * (scene.js, 3.3 rad/s) and so do the four additive door tells. Measured during
 * round 6: the identical window, identical code, scanned at three different
 * absolute phases counted 67, 193 and 356 clipped px — because a flat cream facet
 * sits at the clip line and a 3% swing in the light moves a lot of AREA across it.
 * A one-phase scan of this is a coin toss with more decimal places, so every
 * window is scanned at four phases spread over the lamp's own flicker period and
 * the envelope is the worst of them.
 *   `toPhase` aligns the DOMINANT term only — the hearth, the four door tells and
 * the two sweeps run on their own periods — so the absolute instant a pass lands on
 * also depends on how much sim the probes before it consumed. Same build, same lap:
 * the same pixels (two consecutive laps are byte-identical). Change the probe suite,
 * as [R7-1] did, and the per-phase peaks move a pixel or two (round 6's 4/0/8/5
 * became 1/4/0/10 for exactly that reason). The claim the gate is on is the
 * ENVELOPE — worst of four, never over CLIP_TRANSIENT_MAX — not any one phase. */
const WALK_PHASES = 4;
const FLICKER_PERIOD = 2 * Math.PI / 3.3;    // scene.js hallLight, the dominant term

/* [R6-5] WCAG AA on the margin's type. The two frames the finding was raised on,
 * each of which carries a full three-block stack: one live line and two receded
 * ones, with and without a small-caps speaker label. */
const CONTRAST_UNITS = new Set(['i-04-note2', 'i-24-both']);
const CONTRAST_MIN = 4.5;           // WCAG AA, body text
const CONTRAST_HIER_MIN = 1.5;      // ...and the live line must still LEAD
/* Round 5's authored values for the receded stack, re-injected during the probe
 * so the "was" number is measured on round 5's page — not on this one at round
 * 5's opacity, which is a different page and would be a different claim. */
const CONTRAST_WAS = { opacity: 0.34, who: 'rgba(224,206,168,.94)' };
/* [R6-7] The two hook classes, by name, so the shipped-page check is a list and
 * not a spot check: MUTATORS may only exist under ?harness=1, READ_ONLY must
 * exist everywhere (they are the app's own progress/state surface). */
const MUTATORS = ['__gotoUnit', '__click', '__gateClick', '__gateMiss', '__holdStart',
  '__holdEnd', '__setTime', '__advance', '__renderNow', '__slotPixels', '__emberPixels',
  '__refs', '__mute', '__swapSlot', '__perf', '__insetHot', '__inkHide', '__errors',
  /* ROUND-8: arming the per-frame joint scan costs a matrix walk per figure per
   * frame, so it is a mutator by cost rather than by effect — the reader's loop
   * must never be able to switch it on. */
  '__gaitScan'];
const READ_ONLY = ['__unit', '__state', '__layout', '__slotFrame', '__regions', '__units',
  '__unitByKey', '__validate', '__assets', '__slots', '__gltfReady', '__marginInk', '__ready',
  /* ROUND-8: the cast is geometry this app builds, so what it IS and what it is
   * DOING are both readable without a screenshot and without moving anything —
   * the style census, the accumulated joint ranges, and the vizard's own place in
   * the graph. All three are progress/state surface, like `__state` itself. */
  '__figureStyle', '__gaitScanRead', '__maskState',
  /* [R7-4] three.js's own REVISION tag, not one of ours — but it is on `window` on
   * both pages, so it belongs in the ledger. With it here the two lists are a CLOSED
   * census of every `__` key either page carries (17 shipped, 36 under ?harness=1
   * as of round 8's three read-only cast hooks and one mutating one), which is what
   * `unledgered` below checks: a hook that arrives without being declared is a
   * wedge, in either direction. */
  '__THREE__'];

const CONTRAST_WAS_CSS = `.blk.past{opacity:${CONTRAST_WAS.opacity} !important}` +
                         `.blk .who{color:${CONTRAST_WAS.who} !important}`;

/* ---------------- round-8 review metrics ----------------
 * The cast is not fetched any more. holmes.glb, watson.glb, king.glb and
 * king-unmasked.glb (400k of the 800k triangles this lap used to load, baked PBR,
 * unriggable) are replaced by three figures app/figures.js BUILDS at boot —
 * jointed, flat-shaded, vertex-coloured, ~1.8k triangles each. Four claims come
 * with that, and each one is measured off the scene graph or off the frame.
 *
 * [R8-1] THE UNMASK IS A NODE LEAVING A HEAD JOINT, NOT A MODEL SWAP.
 *        Rounds 3-7 proved fact I.6 by asking whether king-unmasked.glb was
 *        resident and had been swapped in (`king.hasPair && !king.unmasked`).
 *        There is no pair now: `hasPair` is permanently false, so that sign-off
 *        could never fire again — it was inert, which is worse than wrong. The
 *        fact is read off the graph the reader is looking at instead
 *        (`__maskState()` = {attached, visible, onFloor, paintK}), in three parts:
 *          · WORN, at every unit up to and including i-15's settled frame: the
 *            domino is parented to his HEAD JOINT and visible, he reports
 *            `masked`, and none of the fall's repaint has run (paintK 0).
 *          · ON THE RUG, at every unit after the gate: detached, still visible,
 *            `onFloor`, repaint finished — and the node's WORLD position is
 *            within MASK_FLOOR_TOL of scene.js's own MASK_FLOOR mark, so "on the
 *            rug" is a distance in metres and not a boolean, and its scale is the
 *            drop scale rather than the worn one.
 *          · and NOTHING HALF-DETACHED IN BETWEEN. `unmaskScan` steps the tear
 *            one FIXED_DT at a time and asserts, on every frame: the node is
 *            parented to the head or to the slot and never to neither; it is
 *            never invisible; he is never `masked` with it off his head; it is
 *            never attached and on the floor at once; the attachment only ever
 *            goes one way; and the repaint only ever runs forwards and only after
 *            the tear. The 0.34 s between "his hand takes hold" and "it comes
 *            off" is not a violation — it is the act, and `unmasked` (which is
 *            `!masked && !attached`) is false through all of it.
 * [R8-2] A WALK IS JOINTS NOW, SO IT IS GATED AS JOINTS.
 *        [R4-2] asked the SLOT for a vertical bob and a body roll, which any
 *        glide with a sine on it passes — and round 4's did: the numbers it read
 *        back were the numbers it had written. figures.js poses knees, elbows,
 *        ankles and feet, so `__gaitScan(true)` accumulates the true ranges on
 *        EVERY fixed step of a walk (not a sample) and `__gaitScanRead()` reports
 *        them. Three gates on all four walks in the beat, not just the King's
 *        entrance: knee flexion (BOTH legs — a walk has two of them, so the gate
 *        is the smaller span), elbow counter-swing (the FREER arm, because the
 *        other one may be holding the note or the open gazetteer, and the report
 *        prints the arm drives that say which), and the FOOT SLIDE — the
 *        horizontal path a planted foot travels while it is planted, measured off
 *        world joint positions, which is the number that says whether he is
 *        walking or skating.
 * [R8-3] THE STYLE CLAIM IS A CENSUS, AND IT IS CROSS-CHECKED.
 *        `__figureStyle()` reports the cast's triangles, meshes, materials,
 *        texture samplers and whether flat shading and vertex colours survived.
 *        A ledger that reports itself can lie, so the gate also walks each
 *        figure's own root through `__refs` and keys on the mesh names figures.js
 *        authors (`seg:*` for a body segment, `mask*` for the domino): the two
 *        triangle counts have to agree, and anything under a figure's root that
 *        is NOT the figure — the note on Holmes' carry socket and its additive
 *        glow card — is NAMED in the report rather than quietly counted or
 *        quietly skipped. (That traversal has to happen while the domino is still
 *        on his head, because after the tear the node is parented to the SLOT,
 *        which is the figure root's parent. So it runs at boot.)
 * [R8-4] THE FACE-LUMA LAW, MEASURED IN THE DIORAMA.
 *        Likeness lives in the cameo cards; the mesh carries geometry and no
 *        painted marks, and the eye band is an undercut tilted 28-35 degrees
 *        below horizontal that the key light cannot reach. What that buys is a
 *        head with no painted eyes and no black voids in it — and the failure it
 *        risks is a DARK-ON-DARK face. So the law is: THE FACE IS THE BRIGHTEST
 *        PATCH ON THE HEAD, at every framing. Measured by hiding the head,
 *        re-rendering, keeping the pixels that changed, and binning them along
 *        the head's OWN up axis projected to screen — not by screen row, which
 *        mismeasures a pitched seated head (Watson's, under a 26-degree-down
 *        camera, is pitched ~4 degrees back on top of that) and which is why the
 *        band number in the builder's own audit was an artefact. The gate is the
 *        face's brightest decile against the hair cap's; the eye band's dark
 *        fraction is reported next to it, because the band is supposed to be the
 *        DARKEST thing on a lit face and 0 there would mean the undercut is not
 *        working either.
 * [8b-1] ...AND A BRIGHTEST-PATCH TEST IS NOT A FACE TEST. Round 8 passed R8-4 at
 *        every camera with heads that were 0.192 of stature, DEEPER than they
 *        were wide, and presenting their crowns to a 26-degree-down lens: the
 *        King's unmasked close-up read as a banded barrel and the gate had
 *        nothing to say about it, because "the face is the brightest patch on the
 *        head" is true of a head seen from directly above. Three measurements
 *        joined it this round, all on the same hide-and-diff pixels and the same
 *        head-space basis: PROPORTION (0.150-0.165 of stature, and the skull
 *        wider than deep by 1.15 — both read off the figure's own build numbers;
 *        ROUND-8c [8c-5] retired the first as vacuous and moved the second onto
 *        the mesh's real vertices, and added the crown-vs-stature and face-plane
 *        N·L gates beside them — see WD_VERTEX_MIN below), the BELOW-BAND
 *        SPLIT (at least 45% of the head's painted pixels under the eye band, at
 *        the mask and unmask cameras — the arithmetic form of "he has a jaw and
 *        it is pointed at the reader"), and the CHIN, which must project inside
 *        the inset AND paint 4% of the head, because round 8's chin was on frame
 *        the whole time and inside a shirt collar.
 */
const MASK_UNIT = 'i-15-condescend';   // the gate that tears it off
const MASK_FLOOR_TOL = 0.03;           // m between the node and its mark, world space
const MASK_SCAN_SPAN = 1.8;            // sim s of tear + 0.95 s fall, frame by frame
const MASK_FALL_MIN = 0.20;            // ...and the flight has to last (s)
const GAIT_KNEE_MIN = 0.5;             // rad of knee flexion across a walk
const GAIT_ELBOW_MIN = 0.5;            // rad of elbow counter-swing
const GAIT_SLIDE_MAX = 0.05;           // m a planted foot may travel while planted
const GAIT_JOINT_AGREE = 0.02;         // rad between the rig's angle and the world's
/* ROUND-8d [8d-1] THE PLANT-INTERVAL GATE — because the last round's stride was
 * fixed in the LEDGER and not in the picture.
 *   8c's King reported 1.47 footfalls/s and 0.95 m steps off `f`, the cadence
 * arithmetic. His phase, though, is advanced by the GOVERNED rate — and the
 * governor was reading a signed quantity as a distance, so it fired on every
 * stance of every walk in the beat. Measured off his boots: a plant every 0.300 s,
 * 3.33 footfalls/s, 0.42 m of ground a step. A 2.24 m man churning, under a
 * ledger that said he strode.
 *   So the figure now TIMES ITS OWN FOOTFALLS (figures.js `plant()`) and the band
 * below is on that measurement, per walk, on the MEDIAN of the plants inside it —
 * the median because a walk is an ease.inOut and its first and last footfalls are
 * the acceleration, not the man. The bands are the measured numbers with room
 * either side, and they are TIGHT ENOUGH TO CATCH THE 8C BUILD: the King's
 * entrance ran at 3.33 footfalls/s in its cruise stances against a 1.2-1.8 band,
 * and Holmes' two at 4.0-5.0 against 2.2-4.0. `plantStep` is gated on the King
 * alone, because "0.9-1.0 m at 1.4-1.5 footfalls/s" is the review's number for a
 * colossus and it is the whole point of his own `cadK`/`crouch`.
 *   `span` covers the act's own scheduling: kingEnter holds him in the doorway
 * before the crossing starts, and gazetteerFetch's reach waits on arrival. */
const GAIT_WALKS = [
  { unit: 'i-07-gaz1', act: 'gazetteerFetch', who: 'holmes', span: 3.4,
    what: 'Holmes crossing to the desk', plantHz: [2.2, 4.0] },
  { unit: 'i-11-hadnote', act: 'kingEnter', who: 'client', span: 5.0,
    what: 'the King from the landing to the centre of the room',
    plantHz: [1.2, 1.8], plantStep: [0.80, 1.05] },
  { unit: 'i-22-myphoto', act: 'holmesReturn', who: 'holmes', span: 2.8,
    what: 'Holmes coming back to the two of them', plantHz: [2.2, 4.0] },
  { unit: 'i-35-briony', act: 'kingExit', who: 'client', span: 3.0,
    what: 'the King crossing back to the sill', plantHz: [1.2, 2.0] },
];
const CAST_TRIS_MAX = 15000;           // the whole cast's triangle budget
/* The face bins, in head-span units along the head's own up axis (0 = the head
 * joint, 1 = the crown). ROUND-8b: the hair cap crosses the skull at 0.735 of the
 * span by construction ([8b-1] moved it up with the smaller skull), so 0.775-1.10
 * is cap and 0.02-0.70 is face; `cheek` is the part of the face BELOW the eye
 * band, which is the honest "is he lit?" number on a framing where a black vizard
 * is covering the band. The band itself is taken from the figure's own dims
 * (face.eyeY, face.bandH) rather than guessed. */
const FACE_BINS = { cheek: [0.02, 0.42], face: [0.02, 0.70], hair: [0.775, 1.10] };
const FACE_HALF_W = 0.30;              // head-span units either side of the nose
const FACE_MIN_PX = 200;               // fewer changed px than this is not evidence
/* ROUND-8b [8b-1] THE BELOW-BAND GATE — what replaced the vacuous half of R8-4.
 * Round 8's face law gated the face's brightest decile against the hair cap's,
 * and a head that was 0.192 of stature, deeper than wide, and presenting its
 * CROWN to a 26-degree-down camera passed it every time: a brightest-patch test
 * says nothing about whether the reader is looking at a face or at the top of a
 * skull. This does. Of every pixel the frame gets from a man's HEAD NODE — cage,
 * hair, beard, and the vizard while it is still on him, i.e. exactly the mass a
 * reader reads as his head — at least this fraction must lie BELOW the eye band.
 * A crown-first head cannot reach it and a head with a presented jaw cannot miss
 * it. Measured at the two cameras the review named (the mask gate and the
 * unmask); reported, ungated, at the other two, where the head is 20-40 px tall
 * and the number is noise. Round 8 measured 0.389/0.464 here; the gate is 0.45. */
const BELOW_BAND_MIN = 0.45;
const BELOW_BAND_UNITS = new Set([MASK_UNIT, 'i-16-iamking']);
/* ...and the other half of the same claim, which is cheap and independent: the
 * CHIN has to be on the plate and it has to PAINT. `face.chinY/chinZ` is the
 * bottom of the mass under the mouth in head-joint space (the beard's point on a
 * bearded build), so this projects a point the builder actually cut. Round 8's
 * chin was inside the shirt collar at every camera; the pixel half of this test
 * is what catches that, because an occluded chin is on-frame and paints nothing. */
const CHIN_PX_MIN = 0.04;              // fraction of head px under 0.16 of the span
/* ROUND-8c [8c-5] THREE GATES REPLACE ONE VACUOUS ONE.
 *
 * (a) W/D IS MEASURED ON VERTICES, and the spanFrac assert is gone. `spanFrac`
 *     was `(headTopY - headY) / H` — three build constants divided by a fourth,
 *     asserted identically at four framings, and it could not have failed unless
 *     the proportion table itself changed, in which case it would have failed at
 *     all four. The claim worth checking is the SHAPE, and round 8b's w/d was
 *     also off build numbers (`face.headW / face.headD`, i.e. the widths the
 *     builder INTENDED). This walks the head node's actual position attributes
 *     into head-joint space and takes the box they really occupy — bosses, nose,
 *     beard, hair cap and all, minus the vizard, which is a prop — so a head that
 *     is wide in the table and deep in the mesh is caught. TIGHTEST FIGURE >= 1.15.
 *
 * (b) THE CROWN MAY NOT OUTGROW THE STATURE. `headSpan` is `H - headY` by
 *     construction, so the highest vertex of a build belongs at `H` and anything
 *     above it is a figure taller than the height his own dims report — and fact
 *     I.4 is a HEIGHT DIFFERENCE the reader is asked to see. Measured in head
 *     space (`crownRest = headY + maxLocalY - H`) so it is a property of the
 *     BUILD and not of a pitched head or a bobbing pelvis: pose-independent, the
 *     same number at every framing. The hair cap topped out 4.3-5.3 mm proud
 *     before [8c-5] brought its ring down; the gate is +5 mm.
 *
 * (c) N·L AT THE FACE CAMERAS — the [8c-1] finding, as a number that can regress.
 *     The King's face plane took N·L 0.000/0.056/0.135 from the KEY at the three
 *     framings that hold his face and 0.79-0.85 from `under`, a cold blue lamp
 *     aimed up from below, so the linear irradiance on his mid-face was
 *     (0.19, 0.36, 0.90) — a quarter as much red as blue, and the cheek rendered
 *     (63,64,69). WARMTH is that irradiance's R/B: 0.21-0.38 before the face fill,
 *     0.72-0.90 after. Gated at the two cameras the round is judged at, on the
 *     one figure whose face is on the plate there, at 0.55 — halfway between the
 *     two, so neither a regression to the cold build nor a small retune can pass
 *     by accident. `faceLit` (the punctual share of the same irradiance) is
 *     reported beside it, because a warm AMBIENT would satisfy warmth alone. */
const WD_VERTEX_MIN = 1.15;            // head box, from real vertices, W/D
const CROWN_OVER_MAX = 0.005;          // m the highest vertex may stand above H
const FACE_WARMTH_MIN = 0.55;          // R/B of the linear irradiance on the face plane
const FACE_LIT_MIN = 0.60;             // ...and how much of it is punctual, not ambient
/* ROUND-8d [8d-2] AND IT IS EVERY FACE ON THE PLATE, not just the King's.
 *   8c gated the two cameras his face is the subject of, and 8c's own fix — a
 * point light with a 3.0 m cutoff — reached the two marks inside that cutoff.
 * Watson, in the wingback 4.08 m away, stayed at R/B 0.273: a grey-blue face
 * sitting beside two warm ones in the establishing frame, which is a worse
 * picture than the cold build was because now it reads as a mistake. The gate is
 * the same 0.55/0.60 the King is held to, and it now runs at the two SETTLED
 * ensemble framings as well, on every figure the framing holds. */
const FACE_NL_UNITS = new Set([...BELOW_BAND_UNITS, 'i-00-head', 'i-13-delicacy']);
/* The framings, and who has a face on the plate at each. Holmes is wholly OFF the
 * plate at the mask/unmask cameras by design ([R4-1]) so he is not asked for
 * there; i-13-delicacy is the one settled framing in the beat that holds all
 * three heads at once. */
const FACE_FRAMINGS = [
  { unit: 'i-00-head', dwell: SETTLE, who: ['holmes', 'watson'],
    what: 'the establishing frame' },
  { unit: 'i-13-delicacy', dwell: SETTLE, who: ['holmes', 'watson', 'client'],
    what: 'all three heads, the King still masked' },
  { unit: MASK_UNIT, dwell: SETTLE, who: ['client'],
    what: 'the mask gate' },
  { unit: 'i-16-iamking', dwell: SETTLE, who: ['client'],
    what: 'the unmasked King, "I am the King"' },
];

/* ---------------- CLI ---------------- */
const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def;
};
const round = Number(argv.find(a => /^\d+$/.test(a)) ?? flag('round', 0)) || 0;
const wantRatio = flag('ratio', null);
const headed = !!flag('headed', false);
// Real GPU rasterisation (ANGLE/Metal). Headless Chromium defaults to
// SwiftShader, where a frame-time number is meaningless (~350 ms/frame).
const noGpu = !!flag('no-gpu', false);
const noServe = !!flag('no-serve', false);
let port = Number(flag('port', 0)) || 0;

const ratios = RATIOS.filter(r => !wantRatio || r.name === wantRatio);
if (!ratios.length) { console.error(`no ratio matches "${wantRatio}"`); process.exit(2); }

/* ---------------- server ---------------- */
function portOpen(p) {
  return new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port: p }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(500, () => { s.destroy(); res(false); });
  });
}

/* [R7-4] app/.port is serve.py's note to this file: "a server you did not start is
 * on this port". It is a POINTER, so a lap says out loud what it found there and
 * deletes it when it points at nothing — a stale one outlived a killed server every
 * round of this project, sat inside the served tree, and made "which server did that
 * lap run against?" a guess. serve.py removes it on its own way out now. */
const PORT_FILE = path.join(ROOT, 'app', '.port');
const portFile = { path: path.relative(ROOT, PORT_FILE), found: false, value: null,
                   live: null, staleRemoved: false, startedOwn: false };

async function ensureServer() {
  if (fs.existsSync(PORT_FILE)) {
    portFile.found = true;
    portFile.value = Number(fs.readFileSync(PORT_FILE, 'utf8').trim()) || null;
    portFile.live = portFile.value ? await portOpen(portFile.value) : false;
    if (!portFile.live) { fs.rmSync(PORT_FILE, { force: true }); portFile.staleRemoved = true; }
  }
  if (port && await portOpen(port)) return { port, child: null };
  if (!port) {
    if (portFile.live) return { port: portFile.value, child: null };
    if (await portOpen(8150)) return { port: 8150, child: null };
  }
  if (noServe) throw new Error(`--no-serve given but nothing is listening on ${port || 8150}`);
  const child = spawn('python3', [path.join(ROOT, 'app', 'serve.py'),
    ...(port ? ['--port', String(port)] : [])],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SERVE_QUIET: '1' } });
  const chosen = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('serve.py did not report a port in 8s')), 8000);
    child.stdout.on('data', (b) => {
      const m = /PORT (\d+)/.exec(String(b));
      if (m) { clearTimeout(to); res(Number(m[1])); }
    });
    child.on('exit', (c) => { clearTimeout(to); rej(new Error('serve.py exited ' + c)); });
  });
  portFile.startedOwn = true;
  return { port: chosen, child };
}

/* ---------------- shot bookkeeping ---------------- */
function makeShooter(page, dir, report) {
  // [R6-2] Clear this ratio's frames first. A lap only ever OVERWROTE, so a frame
  // the previous build shot and this one does not — the walk-out's `--clip-peak`,
  // which exists only while the walk-out clips — survived on disk and contradicted
  // the report sitting next to it. What is in this directory is what this lap shot.
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  /**
   * Screenshot + measure. Every shot carries the app's own inset rectangle
   * (deviceScaleFactor is 1, so `view` indexes screenshot pixels directly),
   * so `stats.inset.nearBlack` is the V1 metric for exactly the picture and
   * not the page margin around it.
   */
  return async function shoot(name, { allowDark = false, unitId = null } = {}) {
    const file = path.join(dir, name + '.png');
    // The identity card is the one part of the frame that is a DOM <img> rather
    // than a GL draw or a glyph, so it is the one part whose paint the sim clock
    // cannot pin. The app decodes every cameo before __ready (margin.js
    // Cameo.preload) — this waits on the live element's decode as well, because a
    // lap that catches the card mid-pop-in is a lap that is not reproducible.
    await page.evaluate(async () => {
      const im = document.querySelector('#cameo img');
      if (!im || !im.getAttribute('src') || !im.decode) return;
      try { await im.decode(); } catch (_) { /* no art: the monogram is showing */ }
    });
    const probe = await page.evaluate(() => ({ view: window.__state().view,
                                               layout: window.__layout(),
                                               regions: window.__regions() }));
    const buf = await page.screenshot({ path: file, type: 'png' });
    let stats = null, dead = null, surf = null, clip = null, img = null;
    try {
      const v = probe.view;
      img = decodePng(buf);
      stats = { ...statsOf(img, 4, null),
                inset: statsOf(img, 4, { x: v.x, y: v.y, w: v.w, h: v.h }) };
      if (!allowDark) {
        if (stats.stdev < MIN_STDEV) dead = `flat frame (stdev ${stats.stdev})`;
        else if (stats.nonBlack < MIN_NONBLACK) dead = `black frame (nonBlack ${stats.nonBlack})`;
        else if (stats.bright > MAX_BRIGHT) dead = `blown frame (bright ${stats.bright})`;
      }
      // ---- round-3 surface measurements, on the SAME pixels -------------
      const R = probe.regions;
      const paneBig = R.pane.w * R.pane.h >= MIN_REGION_PX && R.pane.frac > 0.5;
      const paneGlass = pointsStats(img, R.paneGrid, 2);
      surf = {
        apron: pointsStats(img, R.apron, 3),
        floor: pointsStats(img, R.floor, 3),
        // the glass itself (surface samples), not the rectangle around it
        pane: paneBig && paneGlass.points >= 20 ? paneGlass : null,
        paneBox: paneBig ? statsOf(img, 2, R.pane) : null,
        paneRect: R.pane,
        lamp: R.lamp,
      };
      // [R4-4]/[R5-2] EXACT clipped-pixel count over the whole inset, every
      // pixel, on every frame of every unit — settled frames and artefacts alike
      if (unitId) clip = hotPixels(img, { x: v.x, y: v.y, w: v.w, h: v.h });
    } catch (e) { dead = 'undecodable png: ' + e.message; }
    const nearBlack = stats && stats.inset ? stats.inset.nearBlack : null;
    const L = probe.layout;
    report.shots.push({ name, file: path.relative(ROOT, file), bytes: buf.length,
                        stats, dead, allowDark, nearBlack, surf, clip,
                        deadBand: L.deadBand, overflow: L.overflow, portrait: L.portrait });
    if (dead) report.dead.push(`${report.ratio}/${name}: ${dead}`);
    // ---- [R4-3] the fire may not clip, at any framing that holds it ------
    // Measured on the fire's OWN pixels (hide it, keep what changed), because
    // its screen box contains Watson's book at the establishing camera.
    if (unitId && !dead) {
      const e = await page.evaluate(() => window.__emberPixels());
      if (e && e.visible >= MIN_EMBER_PX) {
        report.ember.push({ name, unit: unitId, visiblePx: e.visible, hot: e.hot,
                            max: e.max, maxRGB: e.maxRGB, box: e.box });
        if (e.hot > EMBER_HOT_MAX) {
          report.wedges.push(`${name}: ${e.hot} of the hearth ember's own pixels are over ` +
            `luma ${HOT} (max ${e.max} rgb ${JSON.stringify(e.maxRGB)}) — the fire is ` +
            `clipping to a cream card`);
        }
      }
    }
    /* ---- [R6-2] the GL count and the PNG count of the SAME frame ----------
     * The frame-exact scan below cannot afford a screenshot per fixed step, so it
     * counts clipped pixels off the GL colour buffer instead (window.__insetHot).
     * That is only worth anything if the two counts agree, so every frame that
     * gets a PNG census also gets the GL one, and `hotCheck` is the receipt. */
    if (clip) {
      const g = await page.evaluate(() => window.__insetHot());
      if (g) {
        report.hotCheck.push({ name, png: clip.hot, gl: g.hot,
                               pngMax: clip.max, glMax: g.max,
                               dHot: g.hot - clip.hot, dMax: +(g.max - clip.max).toFixed(1) });
      }
    }
    // ---- [R4-4]/[R5-2] and NOTHING in a settled inset may clip ------------
    if (clip) {
      const artefact = /--/.test(name);
      report.clip.push({ name, unit: unitId, artefact,
                         hot: clip.hot, max: clip.max, box: clip.box });
      if (!artefact && clip.hot > CLIP_MAX) {
        report.wedges.push(`${name}: ${clip.hot} clipped px in the inset (over luma ${HOT}, ` +
          `max ${clip.max}) around ${JSON.stringify(clip.box)}`);
      } else if (artefact && clip.hot > CLIP_TRANSIENT_MAX) {
        // [R5-3] reported, never gated: this is one sampled instant of a moving
        // figure, and the tolerance is what keeps that honest instead of silent.
        report.clipTransient.push(`${name}: ${clip.hot} clipped px at a non-settled ` +
          `instant (over luma ${HOT}, max ${clip.max}, tolerance ${CLIP_TRANSIENT_MAX}) ` +
          `around ${JSON.stringify(clip.box)}`);
      }
    }
    // ---- [R3-3] the pane may not clip -----------------------------------
    if (surf && surf.pane && unitId && PANE_UNITS.has(unitId) && !/--/.test(name)) {
      report.pane.push({ name, unit: unitId, mean: surf.pane.mean, max: surf.pane.max,
                         hot: surf.pane.hot, rect: surf.paneRect });
      if (surf.pane.hot > PANE_HOT_MAX) {
        report.wedges.push(`${name}: ${(surf.pane.hot * 100).toFixed(2)}% of the window ` +
          `pane is over luma ${HOT} (max ${surf.pane.max})`);
      }
    }
    // ---- [R3-2] the apron must sit under the room floor ------------------
    if (surf && unitId === APRON_UNIT && !/--/.test(name)
        && surf.apron.mean !== null && surf.floor.mean !== null) {
      report.apron.push({ name, apron: surf.apron.mean, floor: surf.floor.mean,
                          apronPts: surf.apron.points, floorPts: surf.floor.points,
                          lamp: surf.lamp });
      if (surf.apron.mean >= surf.floor.mean) {
        report.wedges.push(`${name}: exterior apron luma ${surf.apron.mean} is not below ` +
          `the room floor's ${surf.floor.mean} — the pedestal is pulling the eye`);
      }
      // ---- [R3-7] and the lantern must read as exterior ------------------
      if (surf.lamp && surf.lamp.onFrame && !surf.lamp.belowFloorEdge) {
        report.wedges.push(`${name}: the street lamp (y ${surf.lamp.y}) is ABOVE the room ` +
          `floor's downstage edge (y ${surf.lamp.floorEdgeY}) — it reads as interior`);
      }
    }
    // ---- [V1] the three round-1 void framings are a hard gate ----------
    if (!allowDark && nearBlack !== null) {
      report.nearBlack.push({ name, unit: unitId, v: nearBlack });
      if (unitId && NEAR_BLACK_BEATS.has(unitId) && nearBlack > NEAR_BLACK_MAX) {
        report.wedges.push(`${name}: nearBlack ${nearBlack} > ${NEAR_BLACK_MAX} ` +
          `(inset fraction below luma ${NEAR_BLACK})`);
      }
    }
    // ---- [V2] portrait must not open a dead band under the plate -------
    if (L.portrait && L.hasText && !allowDark) {
      report.deadBand.push({ name, unit: unitId, v: L.deadBand, overflow: L.overflow });
      if (L.deadBand > DEAD_BAND_MAX) {
        report.wedges.push(`${name}: portrait deadBand ${L.deadBand} > ${DEAD_BAND_MAX}`);
      }
      if (L.overflow > 0.005) {
        report.wedges.push(`${name}: portrait type overflows the leaf by ${L.overflow}`);
      }
    }
    // the decoded frame goes back with the stats: [R4-2] needs to diff two
    // frames of a held beat, and decoding twice would be waste.
    return { stats, img };
  };
}

/* ---------------- [R6-5] WCAG contrast, off the screenshot ----------------
 * The margin's receded lines are BODY TEXT — the reader who looks up from the
 * picture picks the thread back up in them — so they answer to AA. Measuring
 * that honestly means knowing two colours: the ink a glyph actually lands on the
 * page, and the ground that glyph sits on. Neither is knowable from the CSS: the
 * block carries an opacity, the type carries a shadow, the margin carries a
 * gradient and the page under all of it is a crushed paper texture with a
 * vignette.
 *   So the frame is shot twice — once as reviewed, once with `visibility:hidden`
 * on the type and nothing else changed — and the pixels that differ are, exactly,
 * the ones the type paints. The ink is the mean of those pixels at full glyph
 * coverage (within 15% of the strongest difference in the line, so an antialiased
 * edge is never mistaken for a letter), and the ground is the mean of the SAME
 * pixels with the type gone. That is the WCAG pair, measured, on the frame the
 * reviewer is looking at.
 */
const rgbAt = (img, x, y) => {
  const i = y * img.width * img.channels + x * img.channels;
  const d = img.data;
  return img.channels === 1 ? [d[i], d[i], d[i]] : [d[i], d[i + 1], d[i + 2]];
};
const lumaOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function contrastRatio(a, b) {
  const rel = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const L1 = rel(a), L2 = rel(b);
  return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2);
}

/** The ink a rect's type paints, the ground under it, and the ratio between. */
function inkOf(on, off, r) {
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(on.width, Math.ceil(r.x + r.w));
  const y1 = Math.min(on.height, Math.ceil(r.y + r.h));
  let peak = 0, painted = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const d = lumaOf(rgbAt(on, x, y)) - lumaOf(rgbAt(off, x, y));
    if (d > 2) painted++;
    if (d > peak) peak = d;
  }
  if (peak < 6) return null;                       // no type paints in this rect
  const cut = peak * 0.85;
  const ink = [0, 0, 0], gnd = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const a = rgbAt(on, x, y), b = rgbAt(off, x, y);
    if (lumaOf(a) - lumaOf(b) < cut) continue;
    for (let k = 0; k < 3; k++) { ink[k] += a[k]; gnd[k] += b[k]; }
    n++;
  }
  const mean = (v) => v.map(s => Math.round(s / n));
  const I = mean(ink), G = mean(gnd);
  return { corePx: n, paintedPx: painted, peakDelta: +peak.toFixed(1),
           ink: I, ground: G, inkLuma: +lumaOf(I).toFixed(1),
           groundLuma: +lumaOf(G).toFixed(1), ratio: contrastRatio(I, G) };
}

/* ---------------- one ratio's lap ---------------- */
async function lap(browser, ratio, baseUrl, outRoot) {
  const report = { ratio: ratio.name, shots: [], dead: [], consoleErrors: [], pageErrors: [],
                   httpErrors: [], wedges: [], offOrigin: [], requests: [], units: [],
                   gates: [], pending: [], netFailed: [], netNoise: [],
                   nearBlack: [], deadBand: [], sliced: [],
                   pane: [], apron: [], watson: [], lampSwing: null,
                   ember: [], clip: [], clipTransient: [], exit: [],
                   holmesFrame: [], life: {}, hotCheck: [], turns: [],
                   dwell: [], walkScan: [], standScan: [], carriage: [], contrast: [],
                   // ROUND-8: the vizard node, the joint scans, the style census
                   // and the face-luma law
                   mask: [], unmask: null, unmaskScan: null, gaitScan: [],
                   cast: null, face: [],
                   startedAt: new Date().toISOString() };
  const ctx = await browser.newContext({
    viewport: { width: ratio.width, height: ratio.height },
    deviceScaleFactor: 1, reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 500));
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e && e.message || e).slice(0, 500)));
  // runtime-independence gate: the app must fetch ONLY from its own origin
  // and never from /node_modules/. Vendored three or it does not ship.
  const origin = new URL(baseUrl).origin;
  page.on('request', (r) => {
    const u = r.url();
    report.requests.push(u);
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) {
      report.offOrigin.push(u);
    } else if (/\/node_modules\//.test(u)) {
      report.offOrigin.push('node_modules dependency at runtime: ' + u);
    }
  });
  // A `requestfailed` is only a real failure if the APP ends up without the
  // asset. Chromium reports net::ERR_ABORTED on some of these 8 MB GLB
  // transfers even though every byte arrived and the loader parsed them — so
  // the verdict is deferred and cross-checked against __assets() at the end.
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (/favicon/.test(u)) return;
    if (isPending(u)) { report.pending.push(`requestfailed ${u}`); return; }
    report.netFailed.push({ url: u, why: r.failure()?.errorText || 'unknown' });
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) {
      if (isPending(r.url())) { report.pending.push(`HTTP ${r.status()} ${r.url()}`); return; }
      report.httpErrors.push(`HTTP ${r.status()} ${r.url()}`);
    }
  });

  // ?harness=1 — sim control from frame zero, so the lap is reproducible
  await page.goto(baseUrl + '?harness=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 20000 });

  // shape gate: the UNITS array has to be legal before a lap means anything
  const schemaErrors = await page.evaluate(() => window.__validate());
  if (schemaErrors.length) report.pageErrors.push('UNITS schema: ' + schemaErrors.join(' | '));

  // vendoring gate: the app must reach GLTFLoader with no network, no
  // node_modules — otherwise the art lane's GLBs have nowhere to land.
  report.gltfReady = await page.evaluate(() => window.__gltfReady());
  report.slots = await page.evaluate(() => window.__slots());
  if (!report.gltfReady) report.pageErrors.push('vendored GLTFLoader did not resolve via importmap');

  /* ---- [R8-3] THE CAST'S STYLE, CENSUSED AT BOOT ------------------------
   * Two readings of the same three figures. `ledger` is the app's own
   * (`__figureStyle()`, off each figure's mesh inventory); `graph` is this file
   * walking each figure's root through `__refs` and keying on the names
   * figures.js authors, which is the reading that can catch the ledger being
   * wrong — and which is also the only one that can see what ELSE is parented
   * under a figure (the note, on Holmes' right-hand carry socket, with a texture
   * map and an additive halo: exactly the traversal that made an earlier build
   * of the ledger report the whole cast as textured and not flat-shaded).
   *   It runs HERE, before the first advance, for a reason the mask makes
   * necessary: the domino leaves the head joint at the unmask and is parented to
   * the client SLOT, which is the figure root's parent, so a traversal taken any
   * later would be 5 meshes and 256 triangles short of the King. No clock moves;
   * nothing renders.
   */
  {
    const ledger = await page.evaluate(() => window.__figureStyle());
    const graph = await page.evaluate(() => {
      const { THREE, world, renderer, scene } = window.__refs;
      const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
                    'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap',
                    'specularMap', 'envMap', 'lightMap'];
      const read = (o) => {
        const g = o.geometry;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        let tex = 0, flat = true, additive = false;
        for (const m of mats) {
          if (!m.flatShading) flat = false;
          if (m.blending === THREE.AdditiveBlending) additive = true;
          for (const k of MAPS) if (m[k]) tex++;
        }
        return { name: o.name || '(unnamed)', tris: Math.round(g.index
                   ? g.index.count / 3 : g.attributes.position.count / 3),
                 tex, flat, vcol: !!g.attributes.color, additive };
      };
      const per = {};
      for (const [who, fig] of Object.entries(world.figures)) {
        const own = [], foreign = [];
        fig.root.traverse((o) => { if (!o.isMesh || !o.geometry) return;
          const r = read(o);
          (/^(seg:|mask)/.test(r.name) ? own : foreign).push(r); });
        per[who] = {
          tris: own.reduce((n, r) => n + r.tris, 0), meshes: own.length,
          textures: own.reduce((n, r) => n + r.tex, 0),
          notFlat: own.filter(r => !r.flat).map(r => r.name),
          noVertexColour: own.filter(r => !r.vcol).map(r => r.name),
          height: +fig.dims.H.toFixed(3),
          // the eye band, off the builder's own numbers
          face: fig.dims.face,
          // what the SCENE parented under this figure that is not the figure
          foreign: foreign.map(r => `${r.name} ${r.tris}t` +
            (r.tex ? ` ${r.tex}tex` : '') + (r.additive ? ' additive' : '')),
        };
      }
      // ...and the whole diorama, for the triangle budget this round changed
      let tris = 0, meshes = 0;
      scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; meshes++;
        const g = o.geometry;
        tris += Math.round(g.index ? g.index.count / 3
                                   : g.attributes.position.count / 3); });
      /* the DRAWN count needs autoReset off for the length of one frame: the app
       * renders the page backdrop and the diorama as two scenes, and with three.js's
       * default per-render reset `info` would only ever describe the last of them (a
       * two-triangle fullscreen quad, which is not the number anyone means by "the
       * triangles this frame costs"). */
      const info = renderer.info, prevAuto = info.autoReset;
      info.autoReset = false; info.reset();
      window.__renderNow();
      const drawn = info.render.triangles, calls = info.render.calls;
      info.autoReset = prevAuto; info.reset();
      return { per, scene: { tris, meshes, drawn, calls } };
    });
    const sum = (k) => Object.values(graph.per).reduce((n, p) => n + p[k], 0);
    const cast = { ledger, graph: graph.per, scene: graph.scene,
                   graphTris: sum('tris'), graphMeshes: sum('meshes'),
                   graphTextures: sum('textures') };
    report.cast = cast;
    if (ledger.textures !== 0) {
      report.wedges.push(`cast style: the built cast carries ${ledger.textures} texture ` +
        `sampler(s) — this round's figures are geometry and vertex colour, nothing else`);
    }
    if (!ledger.flatShaded) report.wedges.push('cast style: flat shading is off on the cast');
    if (!ledger.vertexColors) {
      report.wedges.push('cast style: a cast mesh has no vertex-colour attribute');
    }
    if (!(ledger.tris <= CAST_TRIS_MAX)) {
      report.wedges.push(`cast style: the cast is ${ledger.tris} triangles ` +
        `(budget ${CAST_TRIS_MAX})`);
    }
    if (cast.graphTris !== ledger.tris) {
      report.wedges.push(`cast style: the app's ledger says ${ledger.tris} triangles and ` +
        `an independent walk of the same three roots says ${cast.graphTris} — one of ` +
        `them is not counting the cast`);
    }
    for (const [who, p] of Object.entries(graph.per)) {
      if (p.textures) {
        report.wedges.push(`cast style: ${who} carries ${p.textures} texture sampler(s) ` +
          `on his own meshes`);
      }
      if (p.notFlat.length) {
        report.wedges.push(`cast style: ${who} has non-flat-shaded meshes ` +
          `(${p.notFlat.join(', ')})`);
      }
      if (p.noVertexColour.length) {
        report.wedges.push(`cast style: ${who} has meshes with no vertex colours ` +
          `(${p.noVertexColour.join(', ')})`);
      }
    }
  }

  await page.evaluate(() => window.__mute(true));           // headless audio, silently
  await page.evaluate(() => window.__gotoUnit(0));

  const dir = path.join(outRoot, ratio.name);
  const shoot = makeShooter(page, dir, report);

  const settle = (dt) => page.evaluate((d) => {
    const s = window.__advance(d); window.__renderNow(); return s;
  }, dt);
  const state = () => page.evaluate(() => window.__state());
  /* [R8-1] THE VIZARD, IN METRES. `__maskState()` answers "attached / on the
   * floor" as booleans off the parent pointer; this answers "where" — the node's
   * world position against scene.js's own MASK_FLOOR mark (authored in
   * client-slot space, which is where the node is reparented to), the scale the
   * fall grew it to, and which of the two parents it is actually hanging from, by
   * name, so a node parented to NEITHER is visible as `other`/`none` rather than
   * hiding inside a false boolean. */
  const maskWorld = () => page.evaluate(() => {
    const { THREE, world } = window.__refs;
    const n = world.mask.node;
    const head = world.figures.client.joints.head, slot = world.slots.client;
    n.updateWorldMatrix(true, false);
    const p = new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
    const fw = slot.localToWorld(world.mask.floor.clone());
    const hp = new THREE.Vector3(); head.getWorldPosition(hp);
    return { pos: p.toArray().map(v => +v.toFixed(4)),
             floor: fw.toArray().map(v => +v.toFixed(4)),
             off: +p.distanceTo(fw).toFixed(4),
             headOff: +p.distanceTo(hp).toFixed(4),
             scale: +n.scale.x.toFixed(3),
             wornScale: world.mask.wornScale, dropScale: world.mask.dropScale,
             parent: n.parent === head ? 'head' : n.parent === slot ? 'slot'
                   : n.parent ? 'other:' + (n.parent.name || '?') : 'none',
             visible: n.visible };
  });

  let guard = 0;
  let st = await state();
  const total = st.total;
  const lifeAt = { walk: null, idle: null };     // [R5-5] filled in during the walk
  // [R8-1] flipped by the mask gate's own click, so the per-unit census below
  // knows which of the two states it is supposed to be looking at
  let maskGateDone = false;

  while (guard++ < MAX_UNITS) {
    st = await state();
    const u = st.unit;
    const nn = String(st.i).padStart(2, '0');

    // ---- a unit that PERFORMS gets a mid-act frame, +0.6 s after entry --
    if (u.act) {
      await settle(ACT_PEEK);
      await shoot(`${nn}-${u.id}--act`, { unitId: u.id });
      await settle(SETTLE - ACT_PEEK);
    } else {
      await settle(SETTLE);
    }
    st = await state();

    const settled = await shoot(`${nn}-${u.id}`, { unitId: u.id });
    const stats = settled.stats;
    report.units.push({
      i: st.i, id: u.id, key: u.key, verb: u.verb, focus: u.focus, page: u.page,
      speaker: u.speaker, chars: (u.text || '').length, act: u.act || null,
      focusOnFrame: st.focusScreen.onFrame, simT: st.t, cameo: st.cameo && st.cameo.id,
      leader: st.leader, marginChars: (st.marginText || '').length,
      stdev: stats && stats.stdev,
    });
    /* ---- [R8-1] WHERE IS THE VIZARD, ON THIS FRAME? --------------------
     * On the settled frame of every unit in the lap, not just the two the gate
     * is between. Before the gate it is on his head and he says so; after it it
     * is on the rug and he says that. `unmasked` is the app's own fact-I.6 bit
     * and it is DERIVED from the graph (`!masked && !mask.attached`), so it
     * cannot disagree with the picture — this is the check that it doesn't
     * disagree with the BEAT either.
     */
    {
      const K = st.king, ms = K.mask;
      const want = maskGateDone ? 'floor' : 'worn';
      const row = { unit: u.id, want, masked: K.masked, unmasked: K.unmasked,
                    attached: ms.attached, visible: ms.visible, onFloor: ms.onFloor,
                    paintK: ms.paintK, onStage: K.visible };
      report.mask.push(row);
      const ok = want === 'worn'
        ? (K.masked && ms.attached && ms.visible && !ms.onFloor && ms.paintK === 0
           && !K.unmasked)
        : (!K.masked && K.unmasked && !ms.attached && ms.visible && ms.onFloor
           && ms.paintK >= 1);
      if (!ok) {
        report.wedges.push(`${u.id}: the vizard should be ${want === 'worn'
          ? 'ON HIS HEAD (this unit is before the mask gate)'
          : 'ON THE RUG (this unit is after the mask gate)'} — ` +
          `${JSON.stringify(row)}`);
      }
    }
    // [c2] Watson may be on stage or off it, but never sliced by the edge
    for (const [who, fr] of Object.entries(st.figures || {})) {
      if (!fr) continue;
      if (fr.inset > FIGURE_SLICE[0] && fr.inset < FIGURE_SLICE[1]) {
        // [R4-6] the box says the edge crosses him. Does he PAINT anything on
        // the plate there? Two renders, one with the slot hidden, and the
        // pixels that changed are the ones he was actually drawing. An entry
        // with 0 of them is not a slice, it is an occluded figure, and the
        // report has to say which.
        const vis = await page.evaluate((w) => window.__slotPixels(w), who);
        const visible = vis ? vis.visible : null;
        const occluded = visible === 0;
        report.sliced.push({ unit: u.id, who, inset: fr.inset, visiblePx: visible,
                             visibleFrac: vis && vis.frac, boxPx: vis && vis.total, occluded });
        // Holmes and the King are the SUBJECT of their close-ups, so a crop
        // there is composition. Watson is dressing: a sliced Watson is the
        // round-1 [c2] finding and fails the lap.
        if (who === 'watson' && !occluded) {
          report.wedges.push(`${u.id}: Watson is sliced by the inset edge ` +
            `(${(fr.inset * 100).toFixed(0)}% inside, ${visible} visible px)`);
        }
        // [R4-1] and at the mask/unmask cameras, neither is Holmes.
        if (who === 'holmes' && HOLMES_FRAME_UNITS.has(u.id) && !occluded) {
          report.wedges.push(`${u.id}: Holmes is sliced by the inset edge ` +
            `(${(fr.inset * 100).toFixed(0)}% inside, ${visible} visible px) — at this ` +
            `camera he must be wholly in frame or wholly off it`);
        }
      }
    }
    /* ---- [R5-1] the King leaves WHOLE ---------------------------------
     * Measured on the settled frame of each of his two exit beats, on HIS OWN
     * pixels: he must paint some of his head band, and none of what he paints
     * anywhere may clip. Round 4 passed every framing gate here and still shipped
     * a decapitated King — the box said 100% inside while the head band said 0.
     */
    if (EXIT_UNITS.has(u.id)) {
      const sp = await page.evaluate(() => window.__slotPixels('client'));
      const head = sp && sp.head;
      report.exit.push({ unit: u.id, kingPx: sp && sp.visible, kingHot: sp && sp.hot,
                         kingMax: sp && sp.max, headPx: head && head.visible,
                         headHot: head && head.hot, headMax: head && head.max,
                         headBox: head && head.box });
      if (!sp) {
        report.wedges.push(`${u.id}: the King is not on stage at his own exit beat`);
      } else {
        if (!(head && head.visible >= HEAD_PX_MIN)) {
          report.wedges.push(`${u.id}: the King paints ${head ? head.visible : 'no'} pixels ` +
            `of his own head band — he is leaving headless`);
        }
        if (sp.hot > 0) {
          report.wedges.push(`${u.id}: ${sp.hot} of the King's own pixels clip ` +
            `(max ${sp.max}) as he leaves — the doorway is washing him out`);
        }
      }
    }
    /* ---- [R7-3] THE CAB IS OUTSIDE EVERY FRAMING IN THIS BEAT ----------
     * Round 6's cab stopped where the door camera caught its roof corner on the
     * plate's bottom-left edge at PORTRAIT — ~1000 px of pale untextured wedge at
     * three units, and 0 px at landscape, so one ratio hid what the other showed.
     * The mark moved down the street ([R7-3] in scene.js); this is the receipt, and
     * it is taken on EVERY unit at BOTH ratios rather than at the three the finding
     * was raised on. Measured on the cab's own pixels (hide it, keep what changed),
     * so a box that overlaps the inset while painting nothing is not a finding —
     * and a single painted pixel is. */
    if (st.figures && (await page.evaluate(() => !!window.__slotFrame('carriage')))) {
      const cab = await page.evaluate(() => window.__slotPixels('carriage'));
      if (cab) {
        report.carriage.push({ unit: u.id, px: cab.visible, max: cab.max,
                               boxPx: cab.total, offPlate: cab.offPlate });
        if (cab.visible > 0) {
          report.wedges.push(`${u.id}: the hansom cab paints ${cab.visible} px on the ` +
            `plate (hottest ${cab.max}) — it is a flat box cut by the inset edge at ` +
            `this camera, and this beat never frames it on purpose`);
        }
      }
    }
    // [R4-1] the three units the bisection was found at, reported every lap
    if (HOLMES_FRAME_UNITS.has(u.id)) {
      const h = (st.figures || {}).holmes;
      report.holmesFrame.push({ unit: u.id, inset: h ? h.inset : null, box: h || null });
    }
    // [R3-1] ...and at the four units that are ABOUT him — the two
    // establishing frames, his own introduction, and the King's "which of you
    // to address" beat — he must be WHOLLY on frame. Round 2 satisfied the
    // slice gate by walking him off stage; this is the gate that says no.
    if (WATSON_UNITS.has(u.id)) {
      const w = (st.figures || {}).watson;
      const onFrame = w ? w.inset : null;
      report.watson.push({ unit: u.id, onFrame, box: w || null });
      if (!w) {
        report.wedges.push(`${u.id}: Watson is not on stage at all, and this unit is his`);
      } else if (!(onFrame >= WATSON_ON_FRAME_MIN)) {
        report.wedges.push(`${u.id}: Watson onFrame ${onFrame} < ${WATSON_ON_FRAME_MIN} ` +
          `— he must be FULLY in frame here`);
      }
    }
    /* ---- [R6-5] the margin's contrast, measured on THIS frame -------------
     * Two extra screenshots, no sim step, at the two units the finding was raised
     * on. `sameAsShot` is the receipt that the frame measured is the frame on
     * disk, and `restored` that hiding the type left nothing behind: both are
     * byte comparisons against the reviewed PNG. */
    if (CONTRAST_UNITS.has(u.id)) {
      const shotRel = report.shots[report.shots.length - 1].file;
      const onDisk = fs.readFileSync(path.join(ROOT, shotRel));
      const ink = await page.evaluate(() => window.__marginInk());
      const onBuf = await page.screenshot({ type: 'png' });
      await page.evaluate(() => window.__inkHide(true));
      const offBuf = await page.screenshot({ type: 'png' });
      await page.evaluate(() => window.__inkHide(false));
      const backBuf = await page.screenshot({ type: 'png' });
      // ...and the SAME measurement at round 5's recession, so "this was under AA
      // and is now over it" is two numbers off one frame instead of an assertion.
      const wasTag = await page.addStyleTag({ content: CONTRAST_WAS_CSS });
      const wasImg = decodePng(await page.screenshot({ type: 'png' }));
      await wasTag.evaluate((el) => el.remove());
      const afterBuf = await page.screenshot({ type: 'png' });
      const off = decodePng(offBuf);
      const rows = [];
      for (const b of ink.blocks) {
        for (const [part, r] of [['body', b.body], ['who', b.who]]) {
          if (!r) continue;
          const m = inkOf(settled.img, off, r);
          if (!m) continue;
          const was = inkOf(wasImg, off, r);
          rows.push({ unit: b.unit, part, live: b.live, opacity: b.opacity,
                      css: r.color, fontSize: r.fontSize, ...m,
                      wasRatio: was ? was.ratio : null, wasInk: was ? was.ink : null });
        }
      }
      const live = rows.filter(r => r.live), past = rows.filter(r => !r.live);
      report.contrast.push({ name: `${nn}-${u.id}`, unit: u.id, rows,
                             sameAsShot: onBuf.equals(onDisk),
                             restored: backBuf.equals(onBuf) && afterBuf.equals(onBuf),
                             liveMin: live.length ? Math.min(...live.map(r => r.ratio)) : null,
                             pastMin: past.length ? Math.min(...past.map(r => r.ratio)) : null,
                             pastMax: past.length ? Math.max(...past.map(r => r.ratio)) : null });
      for (const r of rows) {
        if (r.ratio < CONTRAST_MIN) {
          report.wedges.push(`${u.id}: the ${r.live ? 'live' : 'RECEDED'} ${r.part} of ` +
            `${r.unit} reads at ${r.ratio}:1 (WCAG AA wants ${CONTRAST_MIN}) — ink ` +
            `${JSON.stringify(r.ink)} on ground ${JSON.stringify(r.ground)}, ` +
            `${r.corePx} glyph-core px`);
        }
      }
      if (live.length && past.length) {
        const step = +(Math.min(...live.map(r => r.ratio)) /
                       Math.max(...past.map(r => r.ratio))).toFixed(2);
        if (!(step >= CONTRAST_HIER_MIN)) {
          report.wedges.push(`${u.id}: the live line only leads the receded ones by ` +
            `${step}x (need ${CONTRAST_HIER_MIN}) — the stack has no hierarchy left`);
        }
      }
      if (!onBuf.equals(onDisk)) {
        report.wedges.push(`${u.id}: the contrast probe's frame is not the frame on disk`);
      }
      if (!(backBuf.equals(onBuf) && afterBuf.equals(onBuf))) {
        report.wedges.push(`${u.id}: the contrast probe did not restore the frame ` +
          `byte-identically (hide ${backBuf.equals(onBuf)}, recession override ` +
          `${afterBuf.equals(onBuf)})`);
      }
    }
    if (!st.focusScreen.onFrame) report.wedges.push(`${u.id}: focus "${u.focus}" is off-frame`);
    if ((u.text || '').length && !(st.marginText || '').length) {
      report.wedges.push(`${u.id}: unit has text but the margin is empty`);
    }
    if (u.verb !== 'auto' && !(st.unit.cue || '').length) {
      report.wedges.push(`${u.id}: no affordance cue on a ${u.verb} unit`);
    }

    // ---- [R3-4] the carriage-lamp pass, MEASURED ----------------------
    // The arrival arms a sweep that repeats every LAMP_PASS sim seconds and
    // peaks at LAMP_PEAK_AT inside each cycle. `arrival` fires on entry, so
    // the unit clock IS the sweep clock: step to the next trough, shoot it,
    // step to the following peak, shoot that, and the difference between the
    // two pane means is how legible the pass is. A pair of stills is the only
    // honest way to measure motion in a click-paced freeze frame.
    if (u.act === 'arrival') {
      const now = st.unitT;
      const trough = Math.ceil(now / LAMP_PASS) * LAMP_PASS;
      await settle(Math.max(0.02, trough - now));
      const off = await shoot(`${nn}-${u.id}--lamp-off`, { unitId: u.id });
      await settle(LAMP_PASS * LAMP_PEAK_AT);
      const peak = await shoot(`${nn}-${u.id}--lamp-peak`, { unitId: u.id });
      const a = report.shots[report.shots.length - 2].surf;
      const b = report.shots[report.shots.length - 1].surf;
      if (a && b && a.pane && b.pane) {
        const swing = +(b.pane.mean - a.pane.mean).toFixed(2);
        report.lampSwing = { unit: u.id, off: a.pane.mean, peak: b.pane.mean, swing,
                             offMax: a.pane.max, peakMax: b.pane.max,
                             peakHot: b.pane.hot, rect: b.paneRect };
        if (swing < LAMP_SWING_MIN) {
          report.wedges.push(`${u.id}: the carriage-lamp pass swings the pane only ` +
            `${swing} luma (need ${LAMP_SWING_MIN}) — it is not readable in the glass`);
        }
        if (b.pane.hot > PANE_HOT_MAX) {
          report.wedges.push(`${u.id}: the lamp pass clips the pane ` +
            `(${(b.pane.hot * 100).toFixed(2)}% over luma ${HOT})`);
        }
      } else {
        report.wedges.push(`${u.id}: the pane region was not measurable at the lamp pass`);
      }
      void off; void peak;
    }

    // [R5-5] the two units the life probes re-walk to when the lap is over.
    // Recorded HERE so the probe visits the unit the reader actually visited.
    if (u.act === LIFE_WALK_ACT) lifeAt.walk = st.i;
    if (u.id === LIFE_IDLE_UNIT) lifeAt.idle = st.i;

    // ---- the hold verb: a mid-progress frame is a review artefact -----
    if (u.verb === 'hold') {
      const need = u.hold || 1.5;
      await page.evaluate(() => window.__holdStart());
      await settle(need * 0.5);
      const mid = await state();
      await shoot(`${nn}-${u.id}--hold-mid`, { unitId: u.id });
      report.units.push({ i: st.i, id: u.id + '--hold-mid', verb: 'hold',
        holdK: +mid.hold.k.toFixed(3), resolved: mid.hold.resolved, simT: mid.t,
        plateWatermark: mid.plates.watermark });
      if (!(mid.hold.k > 0.15 && mid.hold.k < 0.95)) {
        report.wedges.push(`${u.id}: hold mid-frame k=${mid.hold.k.toFixed(3)} is not mid-progress`);
      }
      await settle(need * 0.65 + 0.25);
      const done = await state();
      await shoot(`${nn}-${u.id}--hold-done`, { unitId: u.id });
      if (!done.hold.resolved) report.wedges.push(`${u.id}: hold never resolved`);
      await page.evaluate(() => window.__holdEnd());
    }

    // ---- the target gates: click the MASK / the INDEX / the DOOR ------
    if (u.verb === 'target') {
      const before = st.i;
      // 1. a wrong-place click must nudge and NEVER advance
      const miss = await page.evaluate(() => window.__gateMiss());
      if (miss.advanced) report.wedges.push(`${u.id}: a wrong-place click advanced the gate`);
      await settle(0.28);
      await shoot(`${nn}-${u.id}--gate-miss`, { unitId: u.id });
      // 2. the correct click, through the app's own raycast
      const g = await page.evaluate(() => window.__gateClick());
      report.gates.push({ id: u.id, target: g.target, ok: g.ok, onFrame: g.onFrame,
                          at: g.at, from: g.from, to: g.to, ended: g.ended,
                          nudgesBefore: miss.nudges });
      if (!g.onFrame) report.wedges.push(`${u.id}: gate target "${u.target}" is off-frame`);
      if (!g.ok) report.wedges.push(`${u.id}: __gateClick did not resolve target "${u.target}"`);
      /* ---- [R8-1] the mask gate's own click, and where the node lands -----
       * The click is the tear. From here on the census above wants the OTHER
       * state, and the claim "on the rug" gets its metre reading: the node's
       * world position against scene.js's own MASK_FLOOR mark (which lives in
       * client-slot space), plus the scale the fall is supposed to have grown it
       * to. `unmaskScan` re-walks the same 1.8 s frame by frame after the lap. */
      if (u.id === MASK_UNIT) {
        maskGateDone = true;
        report.unmask = { unit: u.id, gate: g.target, resolved: g.ok,
                          wornAtClick: await page.evaluate(() => window.__maskState()),
                          atClick: await maskWorld() };
      }
      /* ---- [R6-6] the door gate TURNS THE LEAF -------------------------
       * The beat's last page change was dead code from round 1 to round 5 (every
       * unit is page 1, so `advance()`'s page test never fired) and the card came
       * up under a cover that never lifted. It is a real turn again, so it leaves
       * the artefact a turn always left: the cover caught at its peak. */
      const mid = await state();
      if (mid.turn.active) {
        await settle(0.42);
        const atPeak = await state();
        await shoot(`${nn}-${u.id}--turn`, { allowDark: true });
        report.turns.push({ unit: u.id, to: atPeak.turn.to, coverK: atPeak.turn.k,
                            page: atPeak.page, pages: atPeak.pages });
        if (!(atPeak.turn.k > 0.5)) {
          report.wedges.push(`${u.id}: the page turn's cover only reached ` +
            `k=${atPeak.turn.k} — the leaf swaps in the open`);
        }
      }
      await settle(TURN_SETTLE);
      let after = await state();
      /* [R8-1] ...and TURN_SETTLE (1.8 s) is longer than the tear (0.34 s) plus
       * the fall (0.95 s), so the frame the reader's next unit opens on is a frame
       * with the vizard already lying on the rug. This is where that is measured in
       * metres, on the reviewed timeline, with no extra sim spent on it. */
      if (u.id === MASK_UNIT && report.unmask) {
        const landed = await maskWorld();
        report.unmask.landed = landed;
        report.unmask.after = after.king;
        report.unmask.cameo = after.cameo && { id: after.cameo.id,
                                               caption: after.cameo.caption };
        if (!(landed.parent === 'slot' && landed.off <= MASK_FLOOR_TOL)) {
          report.wedges.push(`${u.id}: ${MASK_SCAN_SPAN}s after the tear the vizard is ` +
            `${landed.off} m from MASK_FLOOR (tolerance ${MASK_FLOOR_TOL}), parented to ` +
            `'${landed.parent}' — it is not lying on the rug`);
        }
        if (Math.abs(landed.scale - landed.dropScale) > 0.02) {
          report.wedges.push(`${u.id}: the fallen vizard is at scale ${landed.scale}, not ` +
            `the drop scale ${landed.dropScale} the fall is supposed to grow it to`);
        }
      }
      if (after.end.active) {
        await shoot(`${nn}-${u.id}--end`, { allowDark: true });
        if (!(after.end.card > 0.9)) report.wedges.push(`${u.id}: closing card never resolved`);
        // [R6-6] ...and it resolved on a PAGE of its own, with the turn complete
        if (!mid.turn.active) {
          report.wedges.push(`${u.id}: the closing card came up without a page turn`);
        }
        if (after.turn.active) report.wedges.push(`${u.id}: the page turn never finished`);
        if (!(after.pages > 1 && after.page === after.pages)) {
          report.wedges.push(`${u.id}: the closing card is not the last page ` +
            `(page ${after.page} of ${after.pages})`);
        }
        report.endLeaf = { page: after.page, pages: after.pages, card: after.end.card,
                           coverK: after.end.k, finished: after.finished,
                           marginChars: (after.marginText || '').length };
      } else {
        await shoot(`${nn}-${u.id}--gate`, { unitId: u.id });
        if (after.i === before) {
          report.wedges.push(`${u.id}: gate resolved but the unit did not advance`);
          await page.evaluate((n) => window.__gotoUnit(n), before + 1);
        }
      }
      if (before >= total - 1) break;
      continue;
    }

    if (st.i >= total - 1) break;

    // ---- advance like a reader ---------------------------------------
    const before = st.i;
    if (u.verb === 'auto') await settle((u.dwell || 2) + 0.3);
    else await page.evaluate(() => window.__click());
    let after = await state();

    if (after.turn.active) {
      await settle(0.42);                                   // catch the cover at peak
      await shoot(`${nn}-${u.id}--turn`, { allowDark: true });
      await settle(TURN_SETTLE);
      after = await state();
    }

    if (after.i === before) {
      await settle(0.5);
      await page.evaluate(() => window.__click());
      after = await state();
      if (after.i === before) {
        report.wedges.push(`${u.id}: did not advance after two clicks — forcing __gotoUnit`);
        await page.evaluate((n) => window.__gotoUnit(n), before + 1);
      }
    }
  }

  /* ================= the reader's lap is OVER ==========================
   * [R5-5] Everything the end-of-beat gates assert is read HERE, before any
   * probe advances the clock again: `simSeconds` is the length of the READER'S
   * lap and nothing else, and `finished` is still true (a re-walk un-finishes
   * the beat, because __gotoUnit lowers the closing card).
   */
  const final = await state();
  // resolve the deferred network failures against what the app actually holds
  {
    const missing = new Set([...(final.assets.missing || []),
                             ...(final.assets.audioMissing || [])]
      .map(u => String(u).split('/').pop()));
    for (const f of report.netFailed) {
      const base = f.url.split('?')[0].split('/').pop();
      if (missing.has(base)) report.httpErrors.push(`requestfailed ${f.url} (${f.why}) — the app has no ${base}`);
      else report.netNoise.push(`${f.why} on ${base} (delivered anyway: the loader parsed it)`);
    }
  }
  report.finishedAt = new Date().toISOString();
  report.simSeconds = +final.t.toFixed(3);
  report.simFrames = final.frame;
  report.visited = final.visited;
  report.total = total;
  report.audio = final.audio;
  report.assets = final.assets;
  report.acts = final.acts;
  report.nudges = final.nudges;
  report.appErrors = final.errors;
  report.king = final.king;
  report.assetNotes = (final.assets && final.assets.notes) || [];
  /* C1 sign-off, ROUND-8 [R8-1]: the beat ends with fact I.6 TRUE, and it is true
   * about the graph rather than about a manifest. Rounds 3-7 asked `hasPair &&
   * !unmasked`, which cannot fire on a build with no model pair — an inert gate
   * reads green forever, so it is replaced rather than deleted. */
  {
    const K = final.king, ms = K && K.mask;
    if (!K || !ms) {
      report.wedges.push('the King reports no mask state at the end of the beat');
    } else if (!(K.unmasked && !K.masked && !ms.attached && ms.onFloor && ms.paintK >= 1)) {
      report.wedges.push(`fact I.6 is not true at the end of the beat: unmasked ` +
        `${K.unmasked}, masked ${K.masked}, the vizard attached ${ms.attached}, on the ` +
        `floor ${ms.onFloor}, repaint ${ms.paintK}`);
    }
    if (K && K.hasPair) {
      report.wedges.push('king.hasPair is true — a cast GLB pair is loading again, and ' +
        'this round replaced it with a mask NODE');
    }
  }
  if (final.visited < total) report.wedges.push(`only ${final.visited}/${total} units reached`);
  if (!final.finished) report.wedges.push('the beat never reached its closing card');

  /* ---- [R4-2]/[R5-5] the diorama's pulse, measured on a RE-WALK ---------
   * Round 3 left the figures dead after the GLB swap, so round 4 measured them —
   * but it measured them INSIDE the lap, and the sampling advanced the sim clock
   * 4.56 s, which shifted the captured beat phase of every unit after i-11 off
   * the canonical timeline. The measurements are the same measurements; they just
   * happen after the last reviewed frame is on disk, on a jump back to the unit
   * the reader visited.
   *   [R6-3] What that jump actually does, precisely, because round 5's comment
   * here claimed more than the code delivers: __gotoUnit(n) resets the pantomime,
   * then fires and FLUSHES the acts of units 0..n-1 (so everything staged before
   * this beat is snapped to its final pose — King on stage, mask on the floor,
   * Holmes at the desk), and then enters unit n, which fires unit n's OWN act
   * live from unit-time zero. That is what makes the walk probe possible: the
   * entrance really is walking, exactly as it walks for a reader arriving here.
   * What it does NOT do is rewind the absolute sim clock, so anything phase-locked
   * to it — every figure's breath, the hearth flicker, the carriage-lamp pass — is
   * at a different phase than it was during the lap. That is harmless for a RANGE
   * measurement (bob, roll, box drift over a window), which is all this asks for,
   * and it is the reason these frames are `--` artefacts and not review frames.
   *   walk  — the King's entrance. Sampled every 0.12 s from the same unit phase
   *           the lap shot: the slot's vertical bob and body roll have to have
   *           real range, or he is gliding.
   *   idle  — a held beat with three still figures. Their screen boxes have to
   *           DRIFT (breath + sway), and the pixels in them have to change. The
   *           pixel evidence is a pair of frames from inside the re-walk, so it
   *           no longer borrows the reviewed settled frame as its baseline.
   * Both leave `--walk` / `--life-*` artefacts, which is what they always were.
   */
  const lifeProbes = async () => {
    if (lifeAt.walk !== null) {
      const nn = String(lifeAt.walk).padStart(2, '0');
      const u = await page.evaluate((n) => window.__gotoUnit(n), lifeAt.walk);
      await settle(SETTLE);
      const g = [];
      for (let k = 0; k < LIFE_WALK_N; k++) {
        await settle(LIFE_WALK_STEP);
        g.push(await page.evaluate(() => window.__state().gait.client));
        if (k === 4) await shoot(`${nn}-${u.id}--walk`, { unitId: u.id });
      }
      const range = (key) => +(Math.max(...g.map(s => s[key])) -
                               Math.min(...g.map(s => s[key]))).toFixed(4);
      const bob = range('y'), roll = range('roll');
      report.life.walk = { unit: u.id, who: 'client', samples: g.length,
                           walkingSamples: g.filter(s => s.walking).length,
                           bobRange: bob, rollRange: roll,
                           bobPeak: +Math.max(...g.map(s => s.bobY)).toFixed(4) };
      if (!(bob >= LIFE_BOB_MIN)) {
        report.wedges.push(`${u.id}: the King's entrance bobs only ${bob} m ` +
          `(need ${LIFE_BOB_MIN}) — he is gliding`);
      }
      if (!(roll >= LIFE_ROLL_MIN)) {
        report.wedges.push(`${u.id}: the King's entrance rolls only ${roll} rad ` +
          `(need ${LIFE_ROLL_MIN}) — he is gliding`);
      }
    }
    if (lifeAt.idle !== null) {
      const nn = String(lifeAt.idle).padStart(2, '0');
      const u = await page.evaluate((n) => window.__gotoUnit(n), lifeAt.idle);
      await settle(SETTLE);
      const first = await shoot(`${nn}-${u.id}--life-a`, { unitId: u.id });
      const at = await state();
      const boxes = [];
      for (let k = 0; k < LIFE_IDLE_N; k++) {
        boxes.push(await page.evaluate(() => {
          const s = window.__state();
          const b = (f) => (f ? { x: f.x0, y: f.y0 } : null);
          return { holmes: b(s.figures.holmes), client: b(s.figures.client),
                   watson: b(s.figures.watson), gait: s.gait };
        }));
        await settle(LIFE_IDLE_STEP);
      }
      const last = await shoot(`${nn}-${u.id}--life-b`, { unitId: u.id });
      const drift = {};
      for (const who of ['holmes', 'client', 'watson']) {
        const pts = boxes.map(b => b[who]).filter(Boolean);
        if (pts.length < 2) { drift[who] = null; continue; }
        const dx = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
        const dy = Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y));
        drift[who] = { dx: +dx.toFixed(2), dy: +dy.toFixed(2),
                       drift: +Math.max(dx, dy).toFixed(2),
                       walking: boxes.some(b => b.gait[who].walking) };
      }
      // corroborating pixel evidence over the King's own screen box
      const kb = (at.figures || {}).client;
      const rect = kb ? { x: Math.max(kb.x0, at.view.x), y: Math.max(kb.y0, at.view.y),
                          w: Math.min(kb.x1, at.view.x + at.view.w) - Math.max(kb.x0, at.view.x),
                          h: Math.min(kb.y1, at.view.y + at.view.h) - Math.max(kb.y0, at.view.y) }
                     : null;
      const dif = (first.img && last.img && rect && rect.w > 8 && rect.h > 8)
        ? pixelDiff(first.img, last.img, rect, 3, 2) : null;
      report.life.idle = { unit: u.id, span: +(LIFE_IDLE_STEP * LIFE_IDLE_N).toFixed(2),
                           drift, clientBoxDiff: dif };
      for (const who of ['holmes', 'client', 'watson']) {
        const d = drift[who];
        if (!d || d.walking) continue;                 // only judge STILL figures
        if (!(d.drift >= LIFE_IDLE_MIN)) {
          report.wedges.push(`${u.id}: ${who} does not move at all across ` +
            `${(LIFE_IDLE_STEP * LIFE_IDLE_N).toFixed(2)} s of idle ` +
            `(box drift ${d.drift} px, need ${LIFE_IDLE_MIN})`);
        }
      }
    }
  };
  await lifeProbes();

  /* ---- [R6-1]/[R7-1] THE DWELL SWEEP -----------------------------------
   * The King's exit used to be a sim timer, so what a reader saw depended on how
   * long the reader looked — and one lap at one cadence could never show that.
   * This walks the exit FOUR TIMES, at four dwells a reader might plausibly sit
   * at, through the app's own click path, and measures the same things every time:
   *   i-35, i-36, i-37  he paints >= HEAD_PX_MIN of his own head band, NONE of his
   *                     pixels clip, and his mover is bound to the SILL — the
   *                     [R5-1] measurement, at every cadence, on all three of his
   *                     beats now that he stands across the gate ([R7-1])
   *   i-37              ...measured at the DWELL ALONE rather than SETTLE + dwell,
   *                     because the class of failure this exists to catch lives in
   *                     the first second after the reader's advance; plus the gate's
   *                     own ring painting on the plate, and the gate still resolving
   *                     through the real raycast into the card with him on stage
   * Like the life probes, it runs after the reviewed lap so the canonical
   * timeline keeps its own clock ([R5-5]).
   */
  const dwellSweep = async () => {
    const units = await page.evaluate(() => window.__units());
    const at = (id) => units.findIndex(u => u.id === id);
    const i35 = at(EXIT_ENTER), i37 = at(GATE_UNIT), i36 = i35 + 1;
    if (i35 < 0 || i37 < 0 || i37 !== i35 + 2) {
      report.wedges.push(`dwell sweep: the exit units are not where they were ` +
        `(${EXIT_ENTER}=${i35}, ${GATE_UNIT}=${i37})`);
      return;
    }
    const nn = (i) => String(i).padStart(2, '0');
    const kingAt = async (unitId, dwell) => {
      const sp = await page.evaluate(() => window.__slotPixels('client'));
      const head = sp && sp.head;
      // the positive proof that nothing is walking him anywhere: whatever the reader
      // has been doing, the only mark his mover is bound to is the SILL
      const k = (await state()).king;
      if (k.mark !== 'sill') {
        report.wedges.push(`${unitId} @ dwell ${dwell}s: the King's mover is bound to ` +
          `'${k.mark}', not the sill — something other than the reader is moving him`);
      }
      // ...and he is either standing ON that mark or still crossing to it. Anything
      // else means a second path took him somewhere between the two.
      if (!(k.sillOff <= SILL_OFF_MAX || k.walking)) {
        report.wedges.push(`${unitId} @ dwell ${dwell}s: the King is standing still ` +
          `${k.sillOff} m off the sill mark (tolerance ${SILL_OFF_MAX})`);
      }
      const row = { dwell, unit: unitId, onStage: !!sp, mark: k.mark,
                    walking: k.walking, sillOff: k.sillOff,
                    kingPx: sp && sp.visible, kingHot: sp && sp.hot, kingMax: sp && sp.max,
                    headPx: head && head.visible, headHot: head && head.hot,
                    headMax: head && head.max, headBoxPx: head && head.total,
                    headFrac: head && head.frac };
      if (!sp) {
        report.wedges.push(`${unitId} @ dwell ${dwell}s: the King is not on stage at ` +
          `his own exit beat — the exit is still running on a clock`);
      } else {
        if (!(head && head.visible >= HEAD_PX_MIN)) {
          report.wedges.push(`${unitId} @ dwell ${dwell}s: the King paints ` +
            `${head ? head.visible : 'no'} px of his own head band (need ${HEAD_PX_MIN}) ` +
            `— he is leaving headless at this cadence`);
        }
        if (sp.hot > 0) {
          report.wedges.push(`${unitId} @ dwell ${dwell}s: ${sp.hot} of the King's own ` +
            `pixels clip (max ${sp.max})`);
        }
      }
      return row;
    };
    /* [R7-1] Is the gate's own ring PAINTING, with a man standing on the mark it
     * points at? The ring is a screen-space SVG overlay, so the honest measurement
     * is the frame with it and the frame without it: hide the element, diff, count.
     * (No app hook needed or wanted — this is lap.mjs reaching for the DOM of a
     * harness page, and it puts back what it found.) */
    const ringInk = async (tgt) => {
      if (!tgt) return null;
      const onBuf = await page.screenshot({ type: 'png' });
      const was = await page.evaluate(() => {
        const el = document.getElementById('target');
        const prev = el.style.visibility;
        el.style.visibility = 'hidden';
        return prev;
      });
      const offBuf = await page.screenshot({ type: 'png' });
      await page.evaluate((prev) => {
        document.getElementById('target').style.visibility = prev;
      }, was);
      const backBuf = await page.screenshot({ type: 'png' });
      const on = decodePng(onBuf), off = decodePng(offBuf);
      const R = RING_BOX;                       // px around the target point
      const d = pixelDiff(on, off, { x: tgt.x - R, y: tgt.y - R, w: 2 * R, h: 2 * R }, 3, 1);
      return { px: d.changed, maxDelta: d.maxDelta, box: 2 * R,
               restored: Buffer.compare(onBuf, backBuf) === 0 };
    };
    for (const d of DWELLS) {
      await page.evaluate((n) => window.__gotoUnit(n), i35);
      await settle(d);
      const a = await kingAt(EXIT_ENTER, d);
      await shoot(`${nn(i35)}-${EXIT_ENTER}--dwell-${d}`, { unitId: EXIT_ENTER });
      await page.evaluate(() => window.__click());
      await settle(d);
      const b = await kingAt(units[i36].id, d);
      await shoot(`${nn(i36)}-${units[i36].id}--dwell-${d}`, { unitId: units[i36].id });
      // ...and now the reader's advance into the gate beat. [R7-1] The FIRST thing
      // this leg measures is the frame the advance produced, with no sim step at
      // all: round 6's walk-out was already a stride into the lintel by here.
      await page.evaluate(() => window.__click());
      const onEntry = await page.evaluate(() => {
        const sp = window.__slotPixels('client');
        const st = window.__state();
        return { king: st.king, i: st.i, px: sp && sp.visible,
                 headPx: sp && sp.head && sp.head.visible };
      });
      if (!(onEntry.king.visible && onEntry.headPx >= HEAD_PX_MIN)) {
        report.wedges.push(`dwell ${d}s: on the very frame the reader advances into ` +
          `the door gate the King paints ${onEntry.headPx} head px (on stage ` +
          `${onEntry.king.visible}) — his exit is being performed for the reader`);
      }
      // the gate beat gets the dwell at READER cadence: the dwell alone, no SETTLE
      await settle(d);
      const st37 = await state();
      const c = await kingAt(GATE_UNIT, d);
      const ring = await ringInk(st37.targetScreen);
      await shoot(`${nn(i37)}-${GATE_UNIT}--dwell-${d}`, { unitId: GATE_UNIT });
      const tgt = st37.targetScreen;
      const g = await page.evaluate(() => window.__gateClick());
      await settle(TURN_SETTLE);
      const done = await state();
      report.dwell.push({ dwell: d, briony: a, goodnight: b, door: c,
        onEntry: { headPx: onEntry.headPx, kingPx: onEntry.px, mark: onEntry.king.mark },
        gate: { unit: GATE_UNIT, kingOnStage: c.onStage, kingPx: c.kingPx,
                ring, target: tgt, ok: g.ok, ended: g.ended,
                card: done.end.card, page: done.page, finished: done.finished,
                kingOffAfter: !(await page.evaluate(() => window.__state().king.visible)) } });
      if (st37.i !== i37) {
        report.wedges.push(`dwell ${d}s: two clicks out of ${EXIT_ENTER} landed on ` +
          `unit ${st37.i}, not the door gate (${i37})`);
      }
      if (!(tgt && tgt.live && tgt.onFrame)) {
        report.wedges.push(`${GATE_UNIT} @ dwell ${d}s: the door target is not live ` +
          `on the plate (${JSON.stringify(tgt)})`);
      }
      if (!(ring && ring.px >= MIN_RING_PX && ring.restored)) {
        report.wedges.push(`${GATE_UNIT} @ dwell ${d}s: the gate ring paints ` +
          `${ring ? ring.px : 'no'} px (need ${MIN_RING_PX}) with the King on stage — ` +
          `"click the door" has no visible target`);
      }
      if (!g.ok) {
        report.wedges.push(`${GATE_UNIT} @ dwell ${d}s: the door gate did not resolve`);
      }
      if (!(done.end.card > 0.9)) {
        report.wedges.push(`${GATE_UNIT} @ dwell ${d}s: the closing card never resolved ` +
          `(card ${done.end.card})`);
      }
    }
  };
  await dwellSweep();

  /* ---- [R6-2] THE FRAME-EXACT CLIPPING SCAN ----------------------------
   * A walk is a performance, and round 5 judged two of them by SAMPLING one
   * instant every 0.01 s and then wrote the sample down as the peak. The sim only
   * ever moves in FIXED_DT quanta, so the honest measurement is every quantum:
   * step 1/60 s, count every clipped pixel in the inset off the GL buffer, and
   * report the envelope — peak, when it peaks, and how long it is over the old
   * 40 px line. Whatever this measures is what CLIP_TRANSIENT_MAX and the scene.js
   * comment say. The peak frame is then replayed and shot, so the number has a
   * picture next to it.
   */
  const walkScan = async () => {
    const units = await page.evaluate(() => window.__units());
    /* Put the absolute sim clock on a chosen phase of the lamp's flicker before a
     * pass. The clock only moves forward, so this walks it to the next occurrence
     * of the phase asked for; FIXED_DT quantisation lands it within 1/60 s. */
    const toPhase = async (frac) => {
      const now = (await state()).t;
      const want = frac * FLICKER_PERIOD;
      let d = (want - (now % FLICKER_PERIOD) + FLICKER_PERIOD) % FLICKER_PERIOD;
      if (d < FIXED_DT) d += FLICKER_PERIOD;
      await settle(d);
      return +((await state()).t % FLICKER_PERIOD / FLICKER_PERIOD).toFixed(3);
    };
    for (const scan of WALK_SCANS) {
      const idx = units.findIndex(u => u.id === scan.unit);
      if (idx < 0) { report.wedges.push(`walk scan: no unit ${scan.unit}`); continue; }
      const frames = Math.round(scan.span / FIXED_DT);
      const passes = [];
      for (let ph = 0; ph < WALK_PHASES; ph++) {
        const phase = await toPhase(ph / WALK_PHASES);
        const acts = await page.evaluate((n) => {
          window.__gotoUnit(n); return window.__state().acts;
        }, idx);
        if (ph === 0 && !acts.includes(scan.act)) {
          report.wedges.push(`walk scan: ${scan.unit} did not fire ${scan.act} ` +
            `(acts: ${acts.slice(-3).join(',')})`);
        }
        if (scan.from > 0) await settle(scan.from);
        const hots = [];
        for (let k = 0; k < frames; k++) {
          const h = await page.evaluate((dt) => {
            const a = window.__advance(dt);
            return { ...window.__insetHot(), steps: a.steps };
          }, FIXED_DT);
          // "frame-exact" is only true if one step of FIXED_DT is one frame of the
          // app's clock. The clock reports what it took; ask it once per scan.
          if (k === 0 && h.steps !== 1) {
            report.wedges.push(`walk scan: __advance(${FIXED_DT}) moved the sim ` +
              `${h.steps} steps — lap.mjs FIXED_DT no longer matches app/clock.js`);
          }
          hots.push({ f: k, t: +(scan.from + (k + 1) * FIXED_DT).toFixed(4),
                      hot: h.hot, max: h.max });
        }
        const peak = hots.reduce((a, b) => (b.hot > a.hot ? b : a), hots[0]);
        const span = (lim) => +(hots.filter(h => h.hot > lim).length * FIXED_DT).toFixed(4);
        const pass = { phase, peakHot: peak.hot, peakAt: peak.t, peakMax: peak.max,
                       hottestPixel: +Math.max(...hots.map(h => h.max)).toFixed(1),
                       framesOverZero: hots.filter(h => h.hot > 0).length,
                       secondsOverZero: span(0), secondsOver40: span(40),
                       secondsOverTolerance: span(CLIP_TRANSIENT_MAX) };
        passes.push(pass);
      }
      const worst = passes.reduce((a, b) => (b.peakHot > a.peakHot ? b : a), passes[0]);
      const row = { act: scan.act, unit: scan.unit, what: scan.what,
                    frames, framesTotal: frames * WALK_PHASES, phases: passes,
                    from: scan.from, span: scan.span,
                    peakHot: worst.peakHot, peakAt: worst.peakAt, peakPhase: worst.phase,
                    peakSpread: [Math.min(...passes.map(p => p.peakHot)),
                                 Math.max(...passes.map(p => p.peakHot))],
                    hottestPixel: +Math.max(...passes.map(p => p.hottestPixel)).toFixed(1),
                    secondsOverZero: Math.max(...passes.map(p => p.secondsOverZero)),
                    secondsOver40: Math.max(...passes.map(p => p.secondsOver40)),
                    secondsOverTolerance: Math.max(...passes.map(p => p.secondsOverTolerance)) };
      // the worst pass's peak frame, replayed on its own phase and shot
      if (row.peakHot > 0) {
        await toPhase(worst.phase);
        await page.evaluate((n) => window.__gotoUnit(n), idx);
        await settle(row.peakAt);
        const again = await page.evaluate(() => window.__insetHot());
        await shoot(`${String(idx).padStart(2, '0')}-${scan.unit}--clip-peak`, { unitId: scan.unit });
        row.peakHotOnReplay = again.hot;
        row.peakShot = `${String(idx).padStart(2, '0')}-${scan.unit}--clip-peak`;
      }
      report.walkScan.push(row);
      if (row.peakHot > CLIP_TRANSIENT_MAX) {
        report.wedges.push(`${scan.unit}/${scan.act}: ${row.peakHot} clipped px at ` +
          `unit t=${row.peakAt}s, clock phase ${row.peakPhase} (${scan.what}) — over the ` +
          `declared transient envelope of ${CLIP_TRANSIENT_MAX} px`);
      }
      if (row.secondsOver40 > CLIP_TRANSIENT_SPAN) {
        report.wedges.push(`${scan.unit}/${scan.act}: clipping over 40 px lasts ` +
          `${row.secondsOver40}s (envelope allows ${CLIP_TRANSIENT_SPAN}s) — that is ` +
          `no longer a glint on a moving figure`);
      }
    }
  };
  await walkScan();

  /* ---- [R7-1] THE STAND SCAN -------------------------------------------
   * The dwell sweep samples the gate beat at four cadences. This covers the frames
   * BETWEEN those samples — every one of them, at FIXED_DT, from the reader's own
   * advance out of the goodnight, through a second of standing, through the gate
   * click, and up over the top of the page turn. On each frame it asks the app for
   * the King's own pixels and his own head band, and it is looking for exactly the
   * class of frame round 6 shipped and this sweep could not see: a body that paints
   * with a head band that reads ZERO.
   *   The last question is where he goes. The claim is "behind the page", so the
   * frame his pixels first read 0 is found and the COVER's opacity on that frame is
   * reported: 1.000 means the plate was not visible when the stage changed. Anything
   * less is him vanishing in front of the reader, and it is a wedge.
   *   It runs TWICE, because the two beats before the gate are read at the reader's
   * pace too: once walked in at SETTLE (a reader who looks), and once at the fastest
   * dwell in DWELLS (a reader who clicks through, and who therefore arrives at the
   * gate beat while the 2.4 s walk to the sill is still running — a different set of
   * poses under the same lintel).
   */
  const standScan = async (walkIn) => {
    const units = await page.evaluate(() => window.__units());
    const i37 = units.findIndex(u => u.id === STAND_SCAN.unit);
    if (i37 < 1) { report.wedges.push(`stand scan: no unit ${STAND_SCAN.unit}`); return; }
    const tag = `${STAND_SCAN.unit} @ walk-in ${walkIn}s`;
    // walk in through the two beats before it, the way a reader does, so the frame
    // the scan starts on is the frame an advance out of the goodnight produced
    await page.evaluate((n) => window.__gotoUnit(n), i37 - 2);
    await settle(walkIn);
    await page.evaluate(() => window.__click());
    await settle(walkIn);
    await page.evaluate(() => window.__click());
    const frame = () => page.evaluate((dt) => {
      if (dt > 0) window.__advance(dt);
      const st = window.__state();
      const sp = window.__slotPixels('client');
      return { t: +st.t.toFixed(4), i: st.i, page: st.page, cover: st.turn.k,
               card: st.end.card, mark: st.king.mark, onStage: st.king.visible,
               px: sp ? sp.visible : 0, hot: sp ? sp.hot : 0,
               headPx: sp && sp.head ? sp.head.visible : 0,
               headHot: sp && sp.head ? sp.head.hot : 0,
               inset: window.__insetHot() };
    }, 0);
    const step = () => page.evaluate((dt) => {
      window.__advance(dt);
      const st = window.__state();
      const sp = window.__slotPixels('client');
      return { t: +st.t.toFixed(4), i: st.i, page: st.page, cover: st.turn.k,
               card: st.end.card, mark: st.king.mark, onStage: st.king.visible,
               px: sp ? sp.visible : 0, hot: sp ? sp.hot : 0,
               headPx: sp && sp.head ? sp.head.visible : 0,
               headHot: sp && sp.head ? sp.head.hot : 0,
               inset: window.__insetHot() };
    }, FIXED_DT);
    const rows = [await frame()];                       // the advance frame itself
    const nBefore = Math.round(STAND_SCAN.before / FIXED_DT);
    for (let k = 0; k < nBefore; k++) rows.push(await step());
    const gateAt = rows.length;
    /* [R7-1] and a PICTURE of the frame this scan is about, in the slot round 6's
     * headless `37--act` frame used to occupy: the King whole on his mark, a second
     * into the gate beat, with the reader's hand still to come. (One shot, from the
     * settled walk-in — the fast walk-in's own frame is already on disk as the dwell
     * sweep's `--dwell-0.5`.) */
    const standShot = `${String(i37).padStart(2, '0')}-${STAND_SCAN.unit}--stand`;
    if (walkIn === SETTLE) await shoot(standShot, { unitId: STAND_SCAN.unit });
    const g = await page.evaluate(() => window.__gateClick());
    const nAfter = Math.round(STAND_SCAN.after / FIXED_DT);
    for (let k = 0; k < nAfter; k++) rows.push(await step());
    // the frame he goes, and what was over the plate when he did
    const goneIdx = rows.findIndex(r => r.px === 0);
    const gone = goneIdx < 0 ? null : rows[goneIdx];
    const lastSeen = goneIdx < 1 ? null : rows[goneIdx - 1];
    const onPlate = rows.filter(r => r.cover < 1 && r.page === 1);
    const headless = onPlate.filter(r => r.px > 0 && r.headPx < HEAD_PX_MIN);
    const row = {
      unit: STAND_SCAN.unit, walkIn, frames: rows.length, gateAtFrame: gateAt, gate: g.ok,
      standShot: walkIn === SETTLE ? standShot : null,
      spanBefore: STAND_SCAN.before, spanAfter: STAND_SCAN.after,
      headMin: Math.min(...onPlate.map(r => r.headPx)),
      headMax: Math.max(...onPlate.map(r => r.headPx)),
      bodyMin: Math.min(...onPlate.map(r => r.px)),
      kingHotMax: Math.max(...rows.map(r => r.hot)),
      headHotMax: Math.max(...rows.map(r => r.headHot)),
      insetHotMax: Math.max(...rows.map(r => r.inset.hot)),
      insetMaxLuma: +Math.max(...rows.map(r => r.inset.max)).toFixed(1),
      framesOnPlate: onPlate.length, headlessFrames: headless.length,
      marks: [...new Set(onPlate.map(r => r.mark))],
      vanishFrame: gone && { t: gone.t, cover: gone.cover, page: gone.page, card: gone.card },
      lastSeenFrame: lastSeen && { t: lastSeen.t, cover: lastSeen.cover,
                                   px: lastSeen.px, headPx: lastSeen.headPx },
    };
    report.standScan.push(row);
    if (headless.length) {
      const w = headless[0];
      report.wedges.push(`${tag}: ${headless.length} frames between the ` +
        `reader's advance and the cover peak paint the King's body (${w.px} px) with ` +
        `${w.headPx} px of head band (need ${HEAD_PX_MIN}) — first at t=${w.t}s, ` +
        `cover ${w.cover}: he is losing his head in plain view`);
    }
    if (row.kingHotMax > 0) {
      report.wedges.push(`${tag}: ${row.kingHotMax} of the King's own ` +
        `pixels clip across his last beat`);
    }
    if (!gone) {
      report.wedges.push(`${tag}: the King is still on stage ` +
        `${STAND_SCAN.after}s after the door gate — the page turned and he came with it`);
    } else if (!(gone.cover >= 1 && gone.page === 2)) {
      report.wedges.push(`${tag}: the King leaves the stage at t=${gone.t}s ` +
        `with the page-turn cover at ${gone.cover} on page ${gone.page} — the reader ` +
        `can see the plate he disappears from`);
    }
    if (!g.ok) report.wedges.push(`${tag}: stand scan's gate click missed`);
  };
  for (const walkIn of [SETTLE, Math.min(...DWELLS)]) await standScan(walkIn);

  /* ---- [R8-1] THE TEAR, FRAME BY FRAME ---------------------------------
   * The per-unit census says the vizard is on his head before the gate and on the
   * rug after it. This is the 1.8 s in between, at FIXED_DT, and it is looking for
   * a class of frame the two endpoints cannot see: the node in two places, in no
   * place, blinked out, or repainted before it was ever torn off. Every invariant
   * below is a thing a reader would SEE if it broke.
   *   The 0.34 s between "his hand takes hold" and "it comes off" is the act, not a
   * violation: `masked` is already false there (he has decided) while `attached` is
   * still true (his fingers are still on it), which is exactly why fact I.6's bit is
   * `!masked && !attached` and not either half of it.
   */
  const unmaskScan = async () => {
    const units = await page.evaluate(() => window.__units());
    const idx = units.findIndex(u => u.id === MASK_UNIT);
    if (idx < 0) { report.wedges.push(`unmask scan: no unit ${MASK_UNIT}`); return; }
    await page.evaluate((n) => window.__gotoUnit(n), idx);
    await settle(SETTLE);
    const sample = () => page.evaluate(() => {
      const { world } = window.__refs;
      const n = world.mask.node;
      const head = world.figures.client.joints.head, slot = world.slots.client;
      const st = window.__state();
      return { t: +st.t.toFixed(4), masked: st.king.masked, unmasked: st.king.unmasked,
               ...window.__maskState(),
               parent: n.parent === head ? 'head' : n.parent === slot ? 'slot'
                     : n.parent ? 'other' : 'none' };
    });
    const rows = [{ f: -1, ...(await sample()) }];       // the frame before the click
    const g = await page.evaluate(() => window.__gateClick());
    const n = Math.round(MASK_SCAN_SPAN / FIXED_DT);
    for (let k = 0; k < n; k++) {
      await page.evaluate((dt) => window.__advance(dt), FIXED_DT);
      rows.push({ f: k, ...(await sample()) });
    }
    const landed = await maskWorld();
    const attachedIdx = rows.map((r, i) => (r.attached ? i : -1)).filter(i => i >= 0);
    const detachAt = rows.findIndex(r => !r.attached);
    const bad = {
      // he says he is masked with the thing off his head, or invisible
      maskedBare: rows.filter(r => r.masked && !(r.attached && r.visible)),
      // the node hanging off neither the head joint nor the slot
      orphan: rows.filter(r => r.parent !== 'head' && r.parent !== 'slot'),
      invisible: rows.filter(r => !r.visible),
      // in two places at once
      both: rows.filter(r => r.attached && r.onFloor),
      // it went back on his face
      reattached: attachedIdx.length
        ? rows.slice(attachedIdx[attachedIdx.length - 1] + 1).filter(r => r.attached) : [],
      // repainted before the tear, or repainted backwards
      paintedEarly: rows.filter(r => r.attached && r.paintK > 0),
      wentBack: rows.filter((r, i) => i > 0 && r.paintK < rows[i - 1].paintK),
      // and fact I.6 claimed while the mask is still on his head
      falseUnmask: rows.filter(r => r.unmasked && r.attached),
    };
    const flight = rows.filter(r => r.parent === 'slot' && r.paintK < 1);
    const row = {
      unit: MASK_UNIT, gate: g.ok, frames: rows.length, span: MASK_SCAN_SPAN,
      wornFrames: attachedIdx.length,
      tearAt: detachAt < 0 ? null : rows[detachAt].t,
      tearAtFrame: detachAt < 0 ? null : detachAt,
      tearPaintK: detachAt < 0 ? null : rows[detachAt].paintK,
      flightFrames: flight.length,
      flightSeconds: +(flight.length * FIXED_DT).toFixed(4),
      settled: rows[rows.length - 1], landed,
      halfDetachedFrames: bad.orphan.length + bad.both.length + bad.invisible.length,
      violations: Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v.length])),
      firstViolation: Object.entries(bad).find(([, v]) => v.length)?.[0] || null,
    };
    report.unmaskScan = row;
    for (const [k, v] of Object.entries(bad)) {
      if (!v.length) continue;
      report.wedges.push(`${MASK_UNIT}: ${v.length} of ${rows.length} frames of the tear ` +
        `are '${k}' — first at t=${v[0].t}s ${JSON.stringify(v[0])}`);
    }
    if (detachAt < 0) {
      report.wedges.push(`${MASK_UNIT}: the vizard never came off his head in ` +
        `${MASK_SCAN_SPAN}s of the tear`);
    }
    if (!(row.flightSeconds >= MASK_FALL_MIN)) {
      report.wedges.push(`${MASK_UNIT}: the vizard's fall lasts ${row.flightSeconds}s ` +
        `(need ${MASK_FALL_MIN}) — it is snapping to the rug, not being thrown`);
    }
    if (!(row.settled.onFloor && row.settled.paintK >= 1 && landed.off <= MASK_FLOOR_TOL)) {
      report.wedges.push(`${MASK_UNIT}: ${MASK_SCAN_SPAN}s after the gate the vizard is ` +
        `${landed.off} m off its mark (onFloor ${row.settled.onFloor}, repaint ` +
        `${row.settled.paintK})`);
    }
  };
  await unmaskScan();

  /* ---- [R8-2] THE JOINT SCAN ON EVERY WALK IN THE BEAT ------------------
   * Armed after the jump (so the acts __gotoUnit flushes on the way in cannot
   * write into the ranges), then the walk is simply played: the accumulator runs
   * inside the app on every fixed step of it, so this is not a sample of the walk,
   * it is the walk. The still figures are read too — they are the control, and
   * their knees are supposed to be flat.
   */
  const gaitGates = async () => {
    const units = await page.evaluate(() => window.__units());
    for (const w of GAIT_WALKS) {
      const idx = units.findIndex(u => u.id === w.unit);
      if (idx < 0) { report.wedges.push(`gait scan: no unit ${w.unit}`); continue; }
      const acts = await page.evaluate((n) => {
        window.__gotoUnit(n); return window.__state().acts;
      }, idx);
      if (!acts.includes(w.act)) {
        report.wedges.push(`gait scan: ${w.unit} did not fire ${w.act} ` +
          `(acts: ${acts.slice(-3).join(',')})`);
      }
      await page.evaluate(() => window.__gaitScan(true));
      /* [R8-2] the walk is played in whole-frame chunks so the accumulator inside the
       * app sees every fixed step of it, and at the seam of each chunk the joint
       * angles are read a SECOND way: off the world transforms of the hip/knee/ankle
       * and shoulder/elbow/wrist joints through `__refs`, as the angle between the
       * two limb segments. `__gaitScanRead()` reports the angle the rig is HOLDING
       * (the local hinge quaternion); this is the angle the GEOMETRY the reader sees
       * is bent to. A ledger that reports itself can be wrong in the same direction
       * twice, so the gate below asks the two to agree. */
      const frames = Math.round(w.span / FIXED_DT);
      const chunk = Math.max(1, Math.round(frames / 12));
      const worldSamples = [];
      for (let done = 0; done < frames; done += chunk) {
        await settle(Math.min(chunk, frames - done) * FIXED_DT);
        worldSamples.push(await page.evaluate((who) => {
          const { THREE, world } = window.__refs;
          const fig = world.figures[who], J = fig.joints;
          fig.root.updateWorldMatrix(true, true);
          const P = (n) => { const v = new THREE.Vector3(); J[n].getWorldPosition(v); return v; };
          const bend = (a, b, c) => {
            const u = P(b).sub(P(a)), v2 = P(c).sub(P(b));
            if (u.lengthSq() < 1e-9 || v2.lengthSq() < 1e-9) return null;
            return +u.angleTo(v2).toFixed(4);
          };
          const m = fig.metric;
          return { kneeL: bend('upperLegL', 'lowerLegL', 'footL'),
                   kneeR: bend('upperLegR', 'lowerLegR', 'footR'),
                   elbowL: bend('upperArmL', 'lowerArmL', 'handL'),
                   elbowR: bend('upperArmR', 'lowerArmR', 'handR'),
                   appKneeL: m.kneeL, appKneeR: m.kneeR,
                   appElbowL: m.elbowL, appElbowR: m.elbowR };
        }, w.who));
      }
      const all = await page.evaluate(() => window.__gaitScanRead());
      /* [R8-2] ...and what the figure's ARMS were being asked to do while he walked,
       * because one of them may be holding something. Holmes walks back from the
       * desk at i-22 with the open gazetteer in his right hand (`drive.reach` 1) and
       * the note in the same hand at i-07: a man carrying a book does not swing that
       * arm, and a gate that demanded he did would be demanding a worse picture. So
       * the counter-swing gate is on the FREE arm and this is the receipt for which
       * one was not free. */
      const held = await page.evaluate((who) => {
        const d = window.__refs.world.figures[who].drive;
        return { reach: +d.reach.toFixed(3), lift: +d.lift.toFixed(3),
                 present: +d.present.toFixed(3), toss: +d.toss.toFixed(3) };
      }, w.who);
      await page.evaluate(() => window.__gaitScan(false));
      const r = all[w.who];
      if (r) r.elbowFree = Math.max(r.elbowSwingL, r.elbowSwingR);
      // the two readings of the same joints, and the widest disagreement between them
      const wc = { samples: worldSamples.length, maxDelta: 0, worst: null, span: {} };
      for (const s of worldSamples) {
        for (const k of ['kneeL', 'kneeR', 'elbowL', 'elbowR']) {
          const a = s[k], b = s['app' + k[0].toUpperCase() + k.slice(1)];
          if (a === null || b === undefined) continue;
          const d = Math.abs(a - b);
          if (d > wc.maxDelta) { wc.maxDelta = +d.toFixed(4); wc.worst = { joint: k, world: a, app: b }; }
        }
      }
      for (const k of ['kneeL', 'kneeR', 'elbowL', 'elbowR']) {
        const vs = worldSamples.map(s => s[k]).filter(v => v !== null);
        wc.span[k] = vs.length ? +(Math.max(...vs) - Math.min(...vs)).toFixed(4) : null;
      }
      const row = { ...w, who: w.who, scan: r, held, worldCheck: wc,
                    others: Object.fromEntries(Object.entries(all)
                      .filter(([k]) => k !== w.who)
                      .map(([k, v]) => [k, v && { walkFrames: v.walkFrames,
                        kneeSwing: v.kneeSwing, footSlide: v.footSlide }])) };
      report.gaitScan.push(row);
      if (!r) { report.wedges.push(`gait scan: ${w.unit} read no scan for ${w.who}`); continue; }
      if (!r.walkFrames) {
        report.wedges.push(`${w.unit}: ${w.who} never walked in ${w.span}s of ${w.act} ` +
          `(${r.frames} frames scanned, 0 of them walking) — ${w.what}`);
        continue;
      }
      if (!(r.kneeSwing >= GAIT_KNEE_MIN)) {
        report.wedges.push(`${w.unit}: ${w.who}'s knees only flex ${r.kneeSwing} rad ` +
          `across ${w.what} (need ${GAIT_KNEE_MIN}; L ${r.kneeSwingL} R ${r.kneeSwingR}) — ` +
          `that is a glide with a bob on it`);
      }
      if (!(r.elbowFree >= GAIT_ELBOW_MIN)) {
        report.wedges.push(`${w.unit}: ${w.who}'s freest elbow only swings ${r.elbowFree} ` +
          `rad across ${w.what} (need ${GAIT_ELBOW_MIN}; L ${r.elbowSwingL} R ` +
          `${r.elbowSwingR}, arm drives ${JSON.stringify(held)}) — his arms are not ` +
          `countering his legs`);
      }
      if (!(r.footSlide <= GAIT_SLIDE_MAX)) {
        report.wedges.push(`${w.unit}: ${w.who}'s planted foot travels ${r.footSlide} m ` +
          `while it is planted (tolerance ${GAIT_SLIDE_MAX} m, net ${r.footSlideNet}, ` +
          `${r.stances.join('/')} stances) — he is skating through ${w.what}`);
      }
      /* [8d-1] THE FEET, NOT THE TELEMETRY. `footfallHz`/`stepLen` are min/median/max
       * over the walk's real plants (figures.js times them as they land), so a rig
       * that reports a royal stride while churning fails here. No plants at all is
       * also a failure: it is the only reading that cannot be checked. */
      if (w.plantHz || w.plantStep) {
        if (!r.plants || !r.footfallHz) {
          report.wedges.push(`${w.unit}: ${w.who} took NO measurable footfalls across ` +
            `${w.span}s of ${w.what} (${r.walkFrames} walking frames, ` +
            `${r.stances.join('/')} stances) — the plant-interval gate has nothing to read`);
        } else {
          if (w.plantHz && !(r.footfallHz[1] >= w.plantHz[0] && r.footfallHz[1] <= w.plantHz[1])) {
            report.wedges.push(`${w.unit}: ${w.who}'s feet MEASURE ${r.footfallHz[1]} ` +
              `footfalls/s (median of ${r.plants}: ${JSON.stringify(r.footfallHz)}) across ` +
              `${w.what}, outside the ${JSON.stringify(w.plantHz)} band — the cadence ` +
              `arithmetic asked for ${JSON.stringify(r.driveHz)}, so the governor is ` +
              `driving the walk and the picture is not the ledger`);
          }
          if (w.plantStep && !(r.stepLen[1] >= w.plantStep[0] && r.stepLen[1] <= w.plantStep[1])) {
            report.wedges.push(`${w.unit}: ${w.who} covers ${r.stepLen[1]} m of ground per ` +
              `MEASURED footfall (median of ${r.plants}: ${JSON.stringify(r.stepLen)}) across ` +
              `${w.what}, outside the ${JSON.stringify(w.plantStep)} band — that is not the ` +
              `step a man his size takes`);
          }
        }
      }
      if (!(wc.maxDelta <= GAIT_JOINT_AGREE)) {
        report.wedges.push(`${w.unit}: the angle ${w.who}'s rig REPORTS and the angle his ` +
          `world transforms are BENT TO disagree by ${wc.maxDelta} rad ` +
          `(${JSON.stringify(wc.worst)}, tolerance ${GAIT_JOINT_AGREE}) — one of the two ` +
          `is not describing the geometry the reader sees`);
      }
    }
  };
  await gaitGates();

  /* ---- [R8-4] THE FACE-LUMA LAW ----------------------------------------
   * Hide the head, re-render, keep the pixels that changed: that set is exactly
   * the head's own pixels, the same hide-and-diff the slice and ember probes use.
   * Then bin them along the head's OWN up axis, projected to screen — pA is the
   * head joint, pB one head-span above it, pC one head-span to its right — and
   * solve each pixel's (u, t) in that basis. A screen-ROW split cannot do this
   * job: the seated head is pitched, and rows that are hair on one figure are
   * cheek on another.
   *   The gate is the FACE'S BRIGHTEST DECILE against the HAIR CAP'S. p50 is
   * reported next to it but not gated: a masked King's median face pixel is a
   * black vizard, which is correct and would fail a median test for the right
   * reason at the wrong beat. The band's dark fraction is reported as the other
   * half of the same law — the undercut is supposed to be the darkest thing on a
   * lit face, so a 0 there would mean the ledge is not shading anything.
   */
  const faceProbe = async () => {
    const units = await page.evaluate(() => window.__units());
    for (const F of FACE_FRAMINGS) {
      const idx = units.findIndex(u => u.id === F.unit);
      if (idx < 0) { report.wedges.push(`face probe: no unit ${F.unit}`); continue; }
      await page.evaluate((n) => window.__gotoUnit(n), idx);
      await settle(F.dwell);
      for (const who of F.who) {
        const r = await page.evaluate(({ who: w, bins, halfW }) => {
          const { THREE, renderer, camera, scene, world } = window.__refs;
          const fig = world.figures[w];
          const slot = world.slots[w];
          if (!fig || !slot || !slot.visible) return { who: w, offStage: true };
          const headJ = fig.joints.head;
          /* [8c-5a/b] THE MESH, ON ITS OWN VERTICES. Everything under the head
           * joint that is not the vizard, walked position by position into
           * head-joint space: the box it really occupies, and the highest point
           * of it against the stature the build claims. */
          headJ.updateWorldMatrix(true, true);
          const vx = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, n: 0 };
          {
            const inv = new THREE.Matrix4().copy(headJ.matrixWorld).invert();
            const p3 = new THREE.Vector3();
            const isMask = (o) => { for (let k = o; k; k = k.parent) {
              if (k.name === 'maskNode') return true; if (k === headJ) return false; } return false; };
            headJ.traverse((o) => {
              if (!o.isMesh || !o.visible || isMask(o)) return;
              const pos = o.geometry.attributes.position; if (!pos) return;
              for (let i = 0; i < pos.count; i++) {
                p3.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
                if (p3.x < vx.x0) vx.x0 = p3.x; if (p3.x > vx.x1) vx.x1 = p3.x;
                if (p3.y < vx.y0) vx.y0 = p3.y; if (p3.y > vx.y1) vx.y1 = p3.y;
                if (p3.z < vx.z0) vx.z0 = p3.z; if (p3.z > vx.z1) vx.z1 = p3.z;
                vx.n++;
              }
            });
          }
          /* [8c-5c] and the LIGHT the face plane actually receives: the head's own
           * +Z in world, dotted into every light in the scene, in the renderer's
           * own linear working space (THREE.Color already holds linear). */
          const lit = (() => {
            const n = new THREE.Vector3(0, 0, 1)
              .transformDirection(headJ.matrixWorld).normalize();
            const hp = new THREE.Vector3().setFromMatrixPosition(headJ.matrixWorld);
            const E = [0, 0, 0], Ep = [0, 0, 0], per = [];
            scene.traverse((o) => {
              if (!o.isLight || !o.visible) return;
              const c = [o.color.r, o.color.g, o.color.b];
              if (o.isAmbientLight) {
                for (let i = 0; i < 3; i++) E[i] += o.intensity * c[i];
                per.push({ t: 'ambient', i: +o.intensity.toFixed(2) }); return;
              }
              if (o.isHemisphereLight) {
                const t = 0.5 + 0.5 * n.y;
                const g = [o.groundColor.r, o.groundColor.g, o.groundColor.b];
                for (let i = 0; i < 3; i++) E[i] += o.intensity * (g[i] + (c[i] - g[i]) * t);
                per.push({ t: 'hemi', i: +o.intensity.toFixed(2), nl: +t.toFixed(3) }); return;
              }
              const P = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
              let L, at = 1;
              if (o.isDirectionalLight) {
                const T = new THREE.Vector3().setFromMatrixPosition(o.target.matrixWorld);
                L = P.clone().sub(T).normalize();
              } else {
                L = P.clone().sub(hp); const d = L.length(); L.normalize();
                at = 1 / Math.max(Math.pow(d, o.decay === undefined ? 2 : o.decay), 0.01);
                if (o.distance > 0) at *= Math.pow(Math.max(0, 1 - Math.pow(d / o.distance, 4)), 2);
              }
              const nl = Math.max(0, n.dot(L));
              const k = o.intensity * nl * at;
              for (let i = 0; i < 3; i++) { E[i] += k * c[i]; Ep[i] += k * c[i]; }
              per.push({ t: o.type.replace('Light', ''), name: o.name || null,
                         i: +o.intensity.toFixed(2), nl: +nl.toFixed(3),
                         at: +at.toFixed(4), k: +k.toFixed(4) });
            });
            const lum = (a) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
            return { faceN: n.toArray().map((z) => +z.toFixed(3)),
                     irr: E.map((z) => +z.toFixed(3)), punct: Ep.map((z) => +z.toFixed(3)),
                     warmth: +(E[0] / Math.max(1e-6, E[2])).toFixed(3),
                     faceLit: +(lum(Ep) / Math.max(1e-6, lum(E))).toFixed(3),
                     lights: per.filter((q) => q.k === undefined || q.k > 0.002) };
          })();
          const view = window.__state().view, dpr = renderer.getPixelRatio();
          const gl = renderer.getContext();
          const DW = renderer.domElement.width, DH = renderer.domElement.height;
          const hs = fig.dims.headTopY - fig.dims.headY;
          const v = new THREE.Vector3();
          const toPx = (p) => { v.copy(p).project(camera);
            return { x: (view.x + (v.x + 1) / 2 * view.w) * dpr,
                     y: (view.y + (1 - v.y) / 2 * view.h) * dpr }; };
          headJ.updateWorldMatrix(true, true);
          const at = (x, y, z) => toPx(v.set(x, y, z).applyMatrix4(headJ.matrixWorld));
          const inView = (p) => (p.x / dpr >= view.x && p.x / dpr <= view.x + view.w &&
                                 p.y / dpr >= view.y && p.y / dpr <= view.y + view.h);
          const pA = at(0, 0, 0), pB = at(0, hs, 0), pC = at(hs, 0, 0);
          const ex = { x: pC.x - pA.x, y: pC.y - pA.y };
          const ey = { x: pB.x - pA.x, y: pB.y - pA.y };
          const det = ex.x * ey.y - ex.y * ey.x;
          if (!isFinite(det) || Math.abs(det) < 1e-6) return { who: w, degenerate: true };
          // the head's own screen box, from the meshes hanging off the joint
          const seen = [], box = new THREE.Box3();
          headJ.traverse((o) => { if (!o.isMesh || !o.visible) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            seen.push(o);
            box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
          if (box.isEmpty()) return { who: w, noHead: true };
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (const px of [box.min.x, box.max.x])
            for (const py of [box.min.y, box.max.y])
              for (const pz of [box.min.z, box.max.z]) {
                const p = toPx(v.set(px, py, pz));
                x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
                y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
              }
          x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
          x1 = Math.min(DW, Math.ceil(x1)); y1 = Math.min(DH, Math.ceil(y1));
          const bw = x1 - x0, bh = y1 - y0;
          if (bw < 4 || bh < 4) return { who: w, tooSmall: [bw, bh] };
          const grab = () => { const b = new Uint8Array(bw * bh * 4);
            gl.readPixels(x0, DH - y1, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
          window.__renderNow(); const A = grab();
          const was = seen.map((o) => o.visible);
          seen.forEach((o) => { o.visible = false; });
          window.__renderNow(); const B = grab();
          seen.forEach((o, i) => { o.visible = was[i]; });
          window.__renderNow();
          const fc = fig.dims.face;
          const bandT = [(fc.eyeY - fc.bandH / 2) / hs, (fc.eyeY + fc.bandH / 2) / hs];
          const acc = { cheek: [], face: [], hair: [], band: [] };
          let changed = 0, below = 0, inBand = 0, above = 0, chinPx = 0;
          for (let j = 0; j < bh; j++) {
            const sy = y1 - 1 - j;                       // GL rows are bottom-up
            for (let i = 0; i < bw; i++) {
              const k = (j * bw + i) * 4;
              if (A[k] === B[k] && A[k + 1] === B[k + 1] && A[k + 2] === B[k + 2]) continue;
              changed++;
              const L = 0.2126 * A[k] + 0.7152 * A[k + 1] + 0.0722 * A[k + 2];
              const dx = (x0 + i) - pA.x, dy = sy - pA.y;
              const u = (dx * ey.y - dy * ey.x) / det;
              const t = (ex.x * dy - ex.y * dx) / det;
              /* [8b-1] the below-band census takes the WHOLE head, all the way
               * out to the ears — no `halfW` window — because it is a question
               * about the head's mass, not about the mid-face's luma. */
              if (t < bandT[0]) below++; else if (t > bandT[1]) above++; else inBand++;
              if (t < 0.16) chinPx++;
              if (Math.abs(u) > halfW) continue;
              for (const [nm, r2] of Object.entries(bins)) {
                if (t >= r2[0] && t <= r2[1]) acc[nm].push(L);
              }
              if (t >= bandT[0] && t <= bandT[1]) acc.band.push(L);
            }
          }
          const stat = (arr) => { if (!arr.length) return null;
            arr.sort((p, q) => p - q);
            const q = (f) => +arr[Math.min(arr.length - 1, Math.floor(f * arr.length))].toFixed(1);
            return { n: arr.length, p50: q(0.5), p90: q(0.9),
                     max: +arr[arr.length - 1].toFixed(1),
                     darkFrac: +(arr.filter((L) => L < 26).length / arr.length).toFixed(3) }; };
          const chinP = at(0, fc.chinY, fc.chinZ);
          return { who: w, headPx: [bw, bh], changed, hs: +hs.toFixed(4),
                   bandT: bandT.map((z) => +z.toFixed(3)), tilt: fc.tilt,
                   masked: w === 'client' ? window.__maskState().attached : false,
                   /* [8b-1] the proportion claim, off the figure's own build
                    * numbers rather than off a screen box: heads tall, and the
                    * skull's width against its depth. */
                   headsTall: +(fig.dims.H / hs).toFixed(2),
                   spanFrac: +(hs / fig.dims.H).toFixed(4),
                   headW: fc.headW, headD: fc.headD,
                   wd: +(fc.headW / fc.headD).toFixed(3),
                   /* [8c-5a/b] the same two claims off the MESH, not off the
                    * table: the head's real box in head space, and where its
                    * highest vertex sits against the stature it reports. */
                   vtx: vx.n,
                   headWv: +(vx.x1 - vx.x0).toFixed(4),
                   headDv: +(vx.z1 - vx.z0).toFixed(4),
                   headHv: +(vx.y1 - vx.y0).toFixed(4),
                   wdVertex: +((vx.x1 - vx.x0) / Math.max(1e-6, vx.z1 - vx.z0)).toFixed(3),
                   crownOver: +(fig.dims.headY + vx.y1 - fig.dims.H).toFixed(4),
                   lit,
                   below, inBand, above,
                   belowFrac: +(below / changed).toFixed(3),
                   chinFrac: +(chinPx / changed).toFixed(3),
                   chinOn: inView(chinP),
                   chinScreen: [+(chinP.x / dpr).toFixed(1), +(chinP.y / dpr).toFixed(1)],
                   cheek: stat(acc.cheek), face: stat(acc.face),
                   hair: stat(acc.hair), band: stat(acc.band) };
        }, { who, bins: FACE_BINS, halfW: FACE_HALF_W });
        report.face.push({ unit: F.unit, what: F.what, ...r });
        if (r.offStage) continue;                        // not in this framing
        if (!r.face || !r.hair || r.changed < FACE_MIN_PX) {
          report.wedges.push(`${F.unit}: ${who}'s head paints ${r.changed || 0} measurable ` +
            `px (need ${FACE_MIN_PX}) — the face-luma law cannot be measured here ` +
            `(${JSON.stringify(r)})`);
          continue;
        }
        for (const part of ['face', 'cheek']) {
          const m = r[part];
          if (!m) {
            report.wedges.push(`${F.unit}: ${who}'s ${part} band caught no pixels`);
          } else if (!(m.p90 > r.hair.p90)) {
            report.wedges.push(`${F.unit}: ${who}'s ${part} peaks at luma ${m.p90} (p90) ` +
              `against ${r.hair.p90} on his hair cap — the head reads hair-first at ` +
              `${F.what}, which is the face-luma law failing`);
          }
        }
        /* ---- [8b-1] THE PROPORTION LAW, and it is a build number ---------
         * Same three claims the review made in metres, checked on every figure
         * at every face framing (they are constants of the build, so a
         * disagreement between two framings would itself be a finding). */
        /* [8c-5a] the shape claim, on the vertices the renderer draws. (The
         * spanFrac assert this replaces was three build constants over a fourth,
         * asserted four times; `spanFrac`/`headsTall` are still REPORTED.) */
        if (!(r.wdVertex >= WD_VERTEX_MIN)) {
          report.wedges.push(`${F.unit}: ${who}'s head MESH is ${r.headWv} m wide by ` +
            `${r.headDv} m deep over ${r.vtx} vertices (w/d ${r.wdVertex}, table says ` +
            `${r.wd}) — a head must be WIDER THAN DEEP by ${WD_VERTEX_MIN} or a ` +
            `26-degree-down camera is looking at his crown`);
        }
        /* [8c-5b] ...and the height claim, which is fact I.4's carrier. */
        if (!(r.crownOver <= CROWN_OVER_MAX)) {
          report.wedges.push(`${F.unit}: ${who}'s highest vertex stands ` +
            `${(r.crownOver * 1000).toFixed(1)} mm above the ${r.headsTall ? '' : ''}` +
            `stature his dims report (gate ${CROWN_OVER_MAX * 1000} mm) — the build ` +
            `is taller than the number fact I.4 is measured in`);
        }
        /* [8c-5c] and the light on the face plane, at the two cameras the round
         * is judged at. Reported everywhere, gated here. */
        if (FACE_NL_UNITS.has(F.unit) && r.lit) {
          if (!(r.lit.warmth >= FACE_WARMTH_MIN)) {
            report.wedges.push(`${F.unit}: the irradiance on ${who}'s face plane is ` +
              `${JSON.stringify(r.lit.irr)} linear RGB — R/B ${r.lit.warmth} against a ` +
              `${FACE_WARMTH_MIN} gate, i.e. a cold grey-blue mid-face. Face normal ` +
              `${JSON.stringify(r.lit.faceN)}, per-light ${JSON.stringify(r.lit.lights)}`);
          }
          if (!(r.lit.faceLit >= FACE_LIT_MIN)) {
            report.wedges.push(`${F.unit}: only ${r.lit.faceLit} of the light on ` +
              `${who}'s face plane is PUNCTUAL (gate ${FACE_LIT_MIN}) — the face is ` +
              `being carried by the ambient floor, not lit`);
          }
        }
        /* ---- [8b-1] ...AND THE HEAD IS PRESENTED, not surveyed from above --- */
        if (BELOW_BAND_UNITS.has(F.unit) && !(r.belowFrac >= BELOW_BAND_MIN)) {
          report.wedges.push(`${F.unit}: only ${(r.belowFrac * 100).toFixed(1)}% of ` +
            `${who}'s ${r.changed} head pixels fall BELOW his eye band ` +
            `(${r.below} below / ${r.inBand} band / ${r.above} above, gate ` +
            `${BELOW_BAND_MIN}) — at ${F.what} the reader is looking at the top of ` +
            `a skull rather than at a face`);
        }
        if (!r.chinOn) {
          report.wedges.push(`${F.unit}: ${who}'s chin point projects to ` +
            `${r.chinScreen.join(',')}, which is off the plate — the jaw silhouette ` +
            `has to be inside the inset at ${F.what}`);
        } else if (BELOW_BAND_UNITS.has(F.unit) && !(r.chinFrac >= CHIN_PX_MIN)) {
          report.wedges.push(`${F.unit}: ${who}'s chin and jaw paint ` +
            `${(r.chinFrac * 100).toFixed(1)}% of his head's pixels (gate ` +
            `${CHIN_PX_MIN * 100}%) — the chin is on frame but something is in ` +
            `front of it, which is round 8's collar finding coming back`);
        }
      }
    }
  };
  await faceProbe();

  report.probeSeconds = +((await state()).t - final.t).toFixed(3);

  // Frame-time truth at DPR2, synced with a 1-pixel readPixels inside the
  // timer. Two numbers: the harness context (MSAA on, because it runs at
  // deviceScaleFactor 1) and the real DPR2 shipping path (?aa=0), which is
  // what a retina reader actually gets. Renders only — __perf never touches
  // the sim clock, so it cannot move a beat phase either.
  try { report.perfAA = await page.evaluate(() => window.__perf(90, 2)); }
  catch (e) { report.perfAA = { error: String(e && e.message || e) }; }
  try {
    const pp = await ctx.newPage();
    await pp.goto(baseUrl + '?harness=1&aa=0', { waitUntil: 'domcontentloaded' });
    await pp.waitForFunction('window.__ready === true', null, { timeout: 30000 });
    report.perf = await pp.evaluate(() => window.__perf(90, 2));
    await pp.close();
  } catch (e) { report.perf = { error: String(e && e.message || e) }; }

  /* ---- [R6-7] SHIP HYGIENE, checked on a page with no ?harness=1 ---------
   * The claim is that the hooks which can move the beat are not on `window`
   * without the flag. A claim about what a shipped page exposes can only be
   * tested on a shipped page, so this opens one: no query string, the live rAF
   * loop driving the clock, and it asks the page itself what it is carrying. The
   * same pass proves the reader's own path still works with the harness absent —
   * the sim has to advance on wall clock there, which is the one place in this
   * project where that is the correct behaviour.
   */
  try {
    const sp = await ctx.newPage();
    await sp.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await sp.waitForFunction('window.__ready === true', null, { timeout: 30000 });
    const t0 = await sp.evaluate(() => ({ t: window.__state().t, renders: window.__state().renders }));
    await sp.waitForTimeout(300);                       // real wall clock, on purpose
    const t1 = await sp.evaluate(() => ({ t: window.__state().t, renders: window.__state().renders }));
    /* [R7-4] ...and the ledger is CLOSED, in both directions. `unledgered` walks the
     * page's own `__` keys and reports any that neither list declares — the check
     * that caught `__THREE__` (three.js's REVISION tag, now ledgered as read-only).
     * It runs on the shipped page AND on the harness page, so both counts are a
     * census rather than a spot check: 14 keys shipped, 32 under ?harness=1. */
    const CENSUS = ([mut, ro]) => {
      const keys = Object.keys(window).filter(k => k.startsWith('__')).sort();
      return { keys: keys.length,
               unledgered: keys.filter(k => !mut.includes(k) && !ro.includes(k)) };
    };
    report.hygiene = await sp.evaluate(([mut, ro]) => ({
      harnessClass: document.documentElement.classList.contains('harness'),
      harnessLatched: window.__state().harness,
      exposedMutators: mut.filter(k => window[k] !== undefined),
      missingReadOnly: ro.filter(k => window[k] === undefined),
    }), [MUTATORS, READ_ONLY]);
    report.hygiene.shipped = await sp.evaluate(CENSUS, [MUTATORS, READ_ONLY]);
    report.hygiene.harness = await page.evaluate(CENSUS, [MUTATORS, READ_ONLY]);
    report.hygiene.simAdvanced = +(t1.t - t0.t).toFixed(3);
    report.hygiene.rendered = t1.renders - t0.renders;
    await sp.close();
    const H = report.hygiene;
    if (H.exposedMutators.length) {
      report.wedges.push(`ship hygiene: ${H.exposedMutators.join(', ')} reach window ` +
        `on a page with no ?harness=1`);
    }
    if (H.missingReadOnly.length) {
      report.wedges.push(`ship hygiene: the read-only hooks ${H.missingReadOnly.join(', ')} ` +
        `are missing from the shipped page`);
    }
    if (H.harnessClass || H.harnessLatched) {
      report.wedges.push('ship hygiene: the shipped page came up in harness mode');
    }
    for (const [where, c] of [['shipped', H.shipped], ['harness', H.harness]]) {
      if (c && c.unledgered.length) {
        report.wedges.push(`ship hygiene: the ${where} page carries ${c.unledgered.length} ` +
          `undeclared window hook(s) — ${c.unledgered.join(', ')} (add them to the ` +
          `MUTATORS/READ_ONLY ledger, or stop attaching them)`);
      }
    }
    if (!(H.simAdvanced > 0.1 && H.rendered > 5)) {
      report.wedges.push(`ship hygiene: with no harness the reader's own loop did not ` +
        `run (sim advanced ${H.simAdvanced}s, ${H.rendered} renders in 300 ms of wall clock)`);
    }
  } catch (e) { report.hygiene = { error: String(e && e.message || e) }; }

  await ctx.close();
  return report;
}

/* ---------------- main ---------------- */
(async () => {
  const { port: p, child } = await ensureServer();
  const baseUrl = `http://127.0.0.1:${p}/app/index.html`;
  const outRoot = path.join(ROOT, 'shots', `round-${round}`);
  fs.mkdirSync(outRoot, { recursive: true });

  const browser = await chromium.launch({ headless: !headed,
    args: noGpu ? [] : ['--use-gl=angle', '--use-angle=metal', '--enable-gpu',
                        '--ignore-gpu-blocklist'] });
  const reports = [];
  let fatal = null;
  try {
    for (const r of ratios) reports.push(await lap(browser, r, baseUrl, outRoot));
  } catch (e) {
    fatal = String(e && e.stack || e);
  } finally {
    await browser.close();
    if (child) child.kill();
  }

  const summary = {
    round, url: baseUrl, port: p, when: new Date().toISOString(),
    ratios: ratios.map(r => r.name), portFile, fatal, reports,
  };
  const reportPath = path.join(outRoot, 'lap.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

  let bad = 0;
  console.log(`\n=== lap round ${round} @ ${baseUrl} ===`);
  // [R7-4] which server this lap ran against, and what serve.py's pointer said
  console.log(`         ${portFile.path}: ` + (portFile.found
    ? `${portFile.value}, ${portFile.live ? 'live' : 'DEAD — stale pointer removed'}`
    : 'absent') + `; this lap ${portFile.startedOwn ? 'started its own server' : 'reused a running one'}`);
  for (const r of reports) {
    const live = r.shots.filter(s => !s.dead).length;
    console.log(`\n[${r.ratio}] ${r.shots.length} shots (${live} live), ` +
      `${r.visited}/${r.total} units, sim ${r.simSeconds}s / ${r.simFrames} frames, ` +
      `audio cues: ${r.audio ? r.audio.cues.length : '?'}, ` +
      `gltf: ${r.gltfReady ? 'ok' : 'MISSING'}, slots: ${r.slots ? r.slots.length : '?'}`);
    console.log(`         ${r.requests.length} requests, all same-origin: ${r.offOrigin.length === 0}`);
    if (r.perf) {
      console.log(`         frame @DPR2 ${r.perf.drawW}x${r.perf.drawH} (no MSAA): ` +
        `p50 ${r.perf.p50}ms p95 ${r.perf.p95}ms max ${r.perf.max}ms, ${r.perf.tris} tris`);
    }
    if (r.perfAA) {
      console.log(`         frame @DPR2 with MSAA: p50 ${r.perfAA.p50}ms p95 ${r.perfAA.p95}ms`);
    }
    if (r.assets) {
      console.log(`         glb: ${(r.assets.glb || []).join(',') || 'none'}; ` +
        `missing: ${(r.assets.missing || []).length}, audio missing: ${(r.assets.audioMissing || []).length}`);
    }
    if (r.gates && r.gates.length) {
      console.log(`         gates: ${r.gates.map(g => `${g.target}=${g.ok ? 'ok' : 'FAIL'}`).join(' ')}`);
    }
    // ---- the round-2 review metrics, printed where a human reads them ----
    if (r.nearBlack && r.nearBlack.length) {
      const vs = r.nearBlack.map(n => n.v).sort((a, b) => a - b);
      const worst = r.nearBlack.slice().sort((a, b) => b.v - a.v).slice(0, 3);
      console.log(`         nearBlack (inset < luma ${NEAR_BLACK}): median ` +
        `${vs[vs.length >> 1].toFixed(3)}, worst ${worst.map(w => `${w.name} ${w.v}`).join(', ')}`);
      const beats = r.nearBlack.filter(n => n.unit && NEAR_BLACK_BEATS.has(n.unit) &&
        !/--/.test(n.name));
      if (beats.length) {
        console.log(`         V1 beats (<= ${NEAR_BLACK_MAX}): ` +
          beats.map(b => `${b.unit} ${b.v}`).join('  '));
      }
    }
    if (r.deadBand && r.deadBand.length) {
      const vs = r.deadBand.map(d => d.v);
      const mx = Math.max(...vs), ov = Math.max(...r.deadBand.map(d => d.overflow));
      console.log(`         portrait deadBand (<= ${DEAD_BAND_MAX}): max ${mx.toFixed(4)}, ` +
        `median ${vs.slice().sort((a, b) => a - b)[vs.length >> 1].toFixed(4)}, ` +
        `overflow max ${ov.toFixed(4)}, n=${vs.length}`);
    }
    /* ---- the round-8 review metrics --------------------------------------- */
    if (r.king) {
      const m = r.king.mask || {};
      console.log(`         R8-1 fact I.6 at the end of the beat: unmasked ` +
        `${r.king.unmasked} (masked ${r.king.masked}); the vizard is attached ` +
        `${m.attached}, visible ${m.visible}, on the floor ${m.onFloor}, repaint ` +
        `${m.paintK} — procedural ${r.king.procedural}, model pair ${r.king.hasPair}`);
    }
    if (r.mask && r.mask.length) {
      const worn = r.mask.filter(x => x.want === 'worn');
      const floor = r.mask.filter(x => x.want === 'floor');
      const bad = r.mask.filter(x => x.want === 'worn'
        ? !(x.masked && x.attached && x.visible && !x.onFloor && x.paintK === 0)
        : !(!x.masked && x.unmasked && !x.attached && x.visible && x.onFloor && x.paintK >= 1));
      console.log(`              the same question on every settled unit frame: ` +
        `${worn.length} before the gate all report worn+visible+paintK 0, ` +
        `${floor.length} after it all report detached+onFloor+paintK 1; ` +
        `disagreements ${bad.length}`);
    }
    if (r.unmask) {
      const U = r.unmask, L = U.landed || {};
      console.log(`              the gate itself: worn at the click ` +
        `${JSON.stringify(U.wornAtClick)}; ${MASK_SCAN_SPAN}s later the node hangs off ` +
        `'${L.parent}' ${L.off}m from MASK_FLOOR (tolerance ${MASK_FLOOR_TOL}), ` +
        `${L.headOff}m from his head joint, at scale ${L.scale} (worn ${L.wornScale}, ` +
        `drop ${L.dropScale}); the card now reads ` +
        `"${U.cameo ? U.cameo.caption : '?'}"`);
    }
    if (r.unmaskScan) {
      const S = r.unmaskScan;
      console.log(`              and every one of the ${S.frames} frames between: worn ` +
        `for ${S.wornFrames}, torn off at unit-clock t=${S.tearAt}s (frame ` +
        `${S.tearAtFrame}, repaint ${S.tearPaintK}), ${S.flightSeconds}s of flight, ` +
        `HALF-DETACHED frames ${S.halfDetachedFrames}, violations ` +
        `${JSON.stringify(S.violations)}`);
    }
    if (r.cast) {
      const C = r.cast, P = C.ledger.per;
      console.log(`         R8-3 the cast, censused off the built graph: ${C.ledger.tris} ` +
        `triangles (budget ${CAST_TRIS_MAX}), ${C.ledger.meshes} meshes, ` +
        `${C.ledger.materials} materials, ${C.ledger.textures} texture samplers, ` +
        `flat-shaded ${C.ledger.flatShaded}, vertex-coloured ${C.ledger.vertexColors}`);
      for (const [who, p] of Object.entries(P)) {
        const gr = C.graph[who] || {};
        console.log(`           · ${who.padEnd(6)} ${String(p.tris).padStart(4)}t ` +
          `${String(p.meshes).padStart(2)} meshes ${p.materials} mat ${p.textures} tex ` +
          `— ${gr.height}m, eye band ${gr.face && gr.face.tilt} deg below horizontal ` +
          `(ledge ${gr.face && gr.face.ledge}m over ${gr.face && gr.face.bandH}m)` +
          (gr.foreign && gr.foreign.length
            ? `; NOT his, parented under him: ${gr.foreign.join(' ')}` : ''));
      }
      console.log(`              independent walk of the same three roots: ${C.graphTris} ` +
        `triangles / ${C.graphMeshes} meshes / ${C.graphTextures} textures ` +
        `(ledger agrees: ${C.graphTris === C.ledger.tris}); whole diorama ` +
        `${C.scene.tris} triangles in ${C.scene.meshes} meshes, ${C.scene.drawn} drawn in ` +
        `${C.scene.calls} draw calls`);
    }
    if (r.gaitScan && r.gaitScan.length) {
      console.log(`         R8-2 joint animation, accumulated on EVERY fixed step of all ` +
        `${r.gaitScan.length} walks in the beat (knee >= ${GAIT_KNEE_MIN} rad, elbow >= ` +
        `${GAIT_ELBOW_MIN} rad, planted-foot slide <= ${GAIT_SLIDE_MAX} m, [8d-1] median ` +
        `MEASURED plant interval inside its own band):`);
      for (const w of r.gaitScan) {
        const s = w.scan;
        if (!s) { console.log(`           · ${w.unit}/${w.who}: NO SCAN`); continue; }
        console.log(`           · ${w.unit.padEnd(14)} ${w.who.padEnd(6)} ${w.what}`);
        console.log(`             knee ${s.kneeSwing} rad both legs (L ${s.kneeSwingL} / R ` +
          `${s.kneeSwingR}), elbow ${s.elbowFree} freest arm (L ${s.elbowSwingL} / R ` +
          `${s.elbowSwingR}, drives ${JSON.stringify(w.held)}), bob ${s.bob} m, roll ` +
          `${s.roll} rad`);
        console.log(`             MEASURED off ${s.plants} plants: ` +
          `${JSON.stringify(s.footfallHz)} footfalls/s and ${JSON.stringify(s.stepLen)} m ` +
          `of ground each (min/MEDIAN/max)` +
          (w.plantHz ? ` [GATED ${JSON.stringify(w.plantHz)}` +
            (w.plantStep ? ` / ${JSON.stringify(w.plantStep)} m` : '') + ']' : '') +
          `; the cadence arithmetic asked for ${JSON.stringify(s.driveHz)} /s and ` +
          `${JSON.stringify(s.driveStep)} m`);
        console.log(`             foot slide ${s.footSlide} m worst stance (net ` +
          `${s.footSlideNet}, L ${s.footSlideL} / R ${s.footSlideR}) over ` +
          `${s.stances.join('+')} stances; ${s.walkFrames}/${s.frames} frames walking; ` +
          `IK reach shortfall ${s.reachShort} m`);
        if (w.worldCheck) {
          console.log(`             the same joints off their WORLD transforms, ` +
            `${w.worldCheck.samples} samples: widest disagreement with the rig's own ` +
            `number ${w.worldCheck.maxDelta} rad (tolerance ${GAIT_JOINT_AGREE}` +
            (w.worldCheck.worst ? `, at ${JSON.stringify(w.worldCheck.worst)}` : '') +
            `); sampled world spans ${JSON.stringify(w.worldCheck.span)}`);
        }
      }
    }
    if (r.face && r.face.length) {
      console.log(`         R8-4/8b-1/8c-5 the head, measured on its own pixels and binned ` +
        `along its own up axis, plus [8c-5] the MESH's own vertices — vertex w/d >= ` +
        `${WD_VERTEX_MIN}, crown <= stature + ${CROWN_OVER_MAX * 1000} mm, the below-band ` +
        `split (>= ${BELOW_BAND_MIN} at the mask/unmask cams), the face-luma law (face ` +
        `p90 beats the hair cap's) and N·L on the face plane (R/B >= ` +
        `${FACE_WARMTH_MIN}, punctual share >= ${FACE_LIT_MIN}, gated at the face cams):`);
      for (const f of r.face) {
        if (!f.headPx) {
          console.log(`           · ${f.unit.padEnd(14)} ${f.who}: not measurable here ` +
            `(${JSON.stringify(f)})`);
          continue;
        }
        const s = (m) => (m ? `${String(m.p50).padStart(5)}/${String(m.p90).padStart(5)}` : '  -  ');
        console.log(`           · ${f.unit.padEnd(14)} ${f.who.padEnd(6)} head ` +
          `${f.headPx.join('x')}px, ${f.changed} px of his own` +
          (f.masked ? ', VIZARD ON' : '') + ` — p50/p90 face ${s(f.face)}  cheek ` +
          `${s(f.cheek)}  hair ${s(f.hair)}  eye band ${s(f.band)} (dark frac ` +
          `${f.band ? f.band.darkFrac : '-'}, band ${f.bandT.join('-')} of the span, ` +
          `undercut ${f.tilt} deg)`);
        console.log(`             ${' '.repeat(14)} ${' '.repeat(6)} ` +
          `${f.headsTall} heads tall (span ${f.spanFrac} of stature, reported), ` +
          `mesh ${f.headWv}w x ${f.headDv}d over ${f.vtx} verts = w/d ${f.wdVertex} ` +
          `[GATED >= ${WD_VERTEX_MIN}; the table said ${f.wd}], crown ` +
          `${(f.crownOver * 1000).toFixed(1)} mm over stature [GATED <= ` +
          `${CROWN_OVER_MAX * 1000}]; below band ${f.belowFrac} ` +
          `(${f.below}/${f.inBand}/${f.above} below/band/above)` +
          (BELOW_BAND_UNITS.has(f.unit) ? ` [GATED >= ${BELOW_BAND_MIN}]` : ' [reported]') +
          `; chin on frame ${f.chinOn} at ${f.chinScreen && f.chinScreen.join(',')}, ` +
          `painting ${f.chinFrac} of the head`);
        if (f.lit) {
          console.log(`             ${' '.repeat(14)} ${' '.repeat(6)} ` +
            `face plane N ${JSON.stringify(f.lit.faceN)} takes irradiance ` +
            `${JSON.stringify(f.lit.irr)} linear RGB — R/B ${f.lit.warmth}, punctual ` +
            `share ${f.lit.faceLit}` +
            (FACE_NL_UNITS.has(f.unit) ? ` [GATED >= ${FACE_WARMTH_MIN} / ` +
              `${FACE_LIT_MIN}]` : ' [reported]') +
            `; per light ${f.lit.lights.map((q) => `${q.name || q.t}` +
              `${q.nl !== undefined ? ` N·L ${q.nl}` : ''}` +
              `${q.k !== undefined ? ` -> ${q.k}` : ` x${q.i}`}`).join(', ')}`);
        }
      }
    }
    // [R4-6] a slice is only a slice if the figure is PAINTING pixels there
    if (r.sliced && r.sliced.length) {
      const cut = r.sliced.filter(s => !s.occluded);
      const hid = r.sliced.filter(s => s.occluded);
      if (cut.length) {
        console.log(`         figures cut by the inset edge (box% / visible px): ` +
          cut.map(s => `${s.unit}/${s.who} ${s.inset}/${s.visiblePx}`).join(', '));
      }
      if (hid.length) {
        console.log(`         box overlaps the edge but NOTHING of the figure is ` +
          `visible there — occluded, not sliced: ` +
          hid.map(s => `${s.unit}/${s.who} ${s.inset}`).join(', '));
      }
    }
    // ---- the round-3 review metrics --------------------------------------
    if (r.watson && r.watson.length) {
      console.log(`         R3-1 Watson onFrame (>= ${WATSON_ON_FRAME_MIN}): ` +
        r.watson.map(w => `${w.unit} ${w.onFrame === null ? 'ABSENT' : w.onFrame}`).join('  '));
    }
    for (const a of (r.apron || [])) {
      console.log(`         R3-2 apron luma ${a.apron} vs room floor ${a.floor} ` +
        `(${a.apronPts}/${a.floorPts} samples) — apron below floor: ${a.apron < a.floor}`);
      if (a.lamp) {
        console.log(`         R3-7 street lamp at y ${a.lamp.y}, floor's downstage edge ` +
          `y ${a.lamp.floorEdgeY}, onFrame ${a.lamp.onFrame}, ` +
          `below the floor edge: ${a.lamp.belowFloorEdge}`);
      }
    }
    if (r.pane && r.pane.length) {
      console.log(`         R3-3 pane over luma ${HOT} (want ${PANE_HOT_MAX}): ` +
        r.pane.map(p => `${p.unit} ${(p.hot * 100).toFixed(2)}% max ${p.max}`).join('  '));
    }
    if (r.lampSwing) {
      const L = r.lampSwing;
      console.log(`         R3-4 lamp pass pane mean ${L.off} -> ${L.peak} ` +
        `(swing ${L.swing} luma pp, need ${LAMP_SWING_MIN}; peak max ${L.peakMax}, ` +
        `hot ${(L.peakHot * 100).toFixed(2)}%)`);
    }
    // ---- the round-4 review metrics --------------------------------------
    if (r.holmesFrame && r.holmesFrame.length) {
      console.log(`         R4-1 Holmes at the mask/unmask cameras (0 = wholly off ` +
        `the plate, 1 = wholly on it): ` +
        r.holmesFrame.map(h => `${h.unit} ${h.inset}`).join('  '));
    }
    if (r.life && r.life.walk) {
      const L = r.life.walk;
      console.log(`         R4-2 the King's entrance: bob range ${L.bobRange} m ` +
        `(peak ${L.bobPeak}, need ${LIFE_BOB_MIN}), roll range ${L.rollRange} rad ` +
        `(need ${LIFE_ROLL_MIN}), ${L.walkingSamples}/${L.samples} samples walking`);
    }
    if (r.life && r.life.idle) {
      const L = r.life.idle;
      console.log(`         R4-2 idle life over ${L.span}s at ${L.unit} (box drift px, ` +
        `need ${LIFE_IDLE_MIN}): ` +
        Object.entries(L.drift).map(([k, d]) => `${k} ${d ? d.drift : 'absent'}`).join('  ') +
        (L.clientBoxDiff ? `; ${L.clientBoxDiff.changed} px changed in the King's box ` +
          `(max delta ${L.clientBoxDiff.maxDelta})` : ''));
    }
    if (r.ember && r.ember.length) {
      const worst = r.ember.slice().sort((a, b) => b.max - a.max)[0];
      console.log(`         R4-3 hearth ember, measured on its own pixels: ` +
        `${r.ember.reduce((n, e) => n + e.hot, 0)} px over luma ${HOT} ` +
        `(want ${EMBER_HOT_MAX}) across ${r.ember.length} framings; hottest ` +
        `${worst.name} luma ${worst.max} rgb ${JSON.stringify(worst.maxRGB)} ` +
        `(${worst.visiblePx} ember px on the plate)`);
    }
    // [R5-2] the clip census: every unit frame, settled ones gated at 0
    if (r.clip && r.clip.length) {
      const set = r.clip.filter(c => !c.artefact), art = r.clip.filter(c => c.artefact);
      const sum = (xs) => xs.reduce((n, c) => n + c.hot, 0);
      const hottest = (xs) => xs.slice().sort((a, b) => b.max - a.max)[0];
      const hs = hottest(set), ha = hottest(art);
      console.log(`         R5-2 clipped px over the whole inset, exact count: ` +
        `${set.length} SETTLED frames (want ${CLIP_MAX} each) = ${sum(set)} px` +
        (hs ? `, hottest pixel ${hs.max} at ${hs.name}` : ''));
      console.log(`              ...and ${art.length} act/transition artefacts ` +
        `(reported, tolerance ${CLIP_TRANSIENT_MAX}) = ${sum(art)} px` +
        (ha ? `, hottest pixel ${ha.max} at ${ha.name}` : ''));
      const over = r.clip.filter(c => c.hot > 0);
      if (over.length) {
        console.log(`              frames with any clipped px: ` +
          over.map(c => `${c.name} ${c.hot}${c.artefact ? '~' : '!'}`).join('  '));
      }
    }
    if (r.clipTransient && r.clipTransient.length) {
      console.log(`         R5-3 transients over the ${CLIP_TRANSIENT_MAX} px tolerance ` +
        `(reported, not gated): ${r.clipTransient.length}`);
      for (const m of r.clipTransient) console.log(`           · ${m}`);
    }
    // [R5-1] the King leaves whole: his own pixels, and his own head band
    if (r.exit && r.exit.length) {
      console.log(`         R5-1 the King's exit, measured on his own pixels ` +
        `(head band px >= ${HEAD_PX_MIN}, clipped px 0): ` +
        r.exit.map(e => `${e.unit} head ${e.headPx}px/max ${e.headMax} ` +
          `body ${e.kingPx}px/max ${e.kingMax}/hot ${e.kingHot}`).join('  '));
    }
    // [R7-3] the cab: not in this beat's framings at all, measured every unit
    if (r.carriage && r.carriage.length) {
      const seen = r.carriage.filter(c => c.px > 0);
      console.log(`         R7-3 the hansom cab, measured on its own pixels at the ` +
        `${r.carriage.length} framings it is on stage for: painted on ${seen.length} of ` +
        `them (want 0)` + (seen.length ? ` — ${seen.map(c => `${c.unit} ${c.px}px`).join(' ')}`
          : `; its box overlaps the plate at ` +
            `${r.carriage.filter(c => !c.offPlate).length} of them and paints nothing`));
    }
    // ---- the round-6 review metrics ---------------------------------------
    // [R6-1]/[R7-1] the same measurement, at four reader cadences
    if (r.dwell && r.dwell.length) {
      console.log(`         R6-1/R7-1 the King's exit at four dwells (head band px >= ` +
        `${HEAD_PX_MIN}, his own clipped px 0, mover bound to the sill; the GATE leg at ` +
        `reader cadence — the dwell alone, no settle):`);
      for (const d of r.dwell) {
        const leg = (x) => `${x.headPx}px/${((x.headFrac || 0) * 100).toFixed(1)}% hot ${x.kingHot} ${x.mark}`;
        console.log(`           · dwell ${String(d.dwell).padStart(4)}s  ` +
          `i-35 ${leg(d.briony)}  i-36 ${leg(d.goodnight)}  ` +
          `i-37 ${leg(d.door)} (on the advance frame itself ${d.onEntry.headPx}px)  ` +
          `ring ${d.gate.ring ? d.gate.ring.px : '?'}px in a ` +
          `${d.gate.ring ? d.gate.ring.box : '?'}px box, gate ` +
          `${d.gate.ok ? 'resolves' : 'FAILS'}, card ${d.gate.card}, ` +
          `king off after the turn ${d.gate.kingOffAfter}`);
      }
    }
    // [R7-1] ...and every frame between those samples
    if (r.standScan && r.standScan.length) {
      const s0 = r.standScan[0];
      console.log(`         R7-1 stand scan — every ${(FIXED_DT * 1000).toFixed(2)} ms from ` +
        `the reader's advance into ${s0.unit} (${s0.spanBefore}s of standing), the gate ` +
        `click, then ${s0.spanAfter}s of page turn, walked in at two cadences:`);
      for (const s of r.standScan) {
        console.log(`           · walk-in ${s.walkIn}s — ${s.frames} frames, ` +
          `${s.framesOnPlate} with the plate showing: head band ${s.headMin}-${s.headMax}px ` +
          `(gate ${HEAD_PX_MIN}), body min ${s.bodyMin}px, HEADLESS frames ` +
          `${s.headlessFrames}, his clipped px ${s.kingHotMax}, inset clipped px ` +
          `${s.insetHotMax} (hottest pixel on any frame ${s.insetMaxLuma}), marks ` +
          `{${s.marks.join(',')}}`);
        console.log(`             last seen whole at t=${s.lastSeenFrame && s.lastSeenFrame.t}s ` +
          `(${s.lastSeenFrame && s.lastSeenFrame.px}px, head ` +
          `${s.lastSeenFrame && s.lastSeenFrame.headPx}px, cover ` +
          `${s.lastSeenFrame && s.lastSeenFrame.cover}); off stage on the NEXT frame ` +
          `t=${s.vanishFrame && s.vanishFrame.t}s with the cover at ` +
          `${s.vanishFrame && s.vanishFrame.cover} on page ${s.vanishFrame && s.vanishFrame.page}`);
      }
    }
    // [R6-2] the transient envelope, measured every fixed step
    if (r.walkScan && r.walkScan.length) {
      console.log(`         R6-2 frame-exact clipping scan (every ${(FIXED_DT * 1000).toFixed(2)} ms, ` +
        `${WALK_PHASES} clock phases each, envelope ${CLIP_TRANSIENT_MAX} px for ` +
        `<= ${CLIP_TRANSIENT_SPAN}s):`);
      for (const w of r.walkScan) {
        console.log(`           · ${w.act} @ ${w.unit} — ${w.framesTotal} frames of ${w.what}: ` +
          `worst peak ${w.peakHot} px at unit t=${w.peakAt}s (phase ${w.peakPhase}` +
          (w.peakHotOnReplay !== undefined ? `, replayed on that phase ${w.peakHotOnReplay} px` : '') +
          `), per-phase peaks ${w.phases.map(p => p.peakHot).join('/')}, hottest pixel ` +
          `${w.hottestPixel}, clipping at all for ${w.secondsOverZero}s, over 40 px for ` +
          `${w.secondsOver40}s`);
      }
    }
    // [R6-2] ...and the receipt that the GL count is the PNG count
    if (r.hotCheck && r.hotCheck.length) {
      const byHot = r.hotCheck.slice().sort((a, b) => Math.abs(b.dHot) - Math.abs(a.dHot))[0];
      const byMax = r.hotCheck.slice().sort((a, b) => Math.abs(b.dMax) - Math.abs(a.dMax))[0];
      console.log(`         R6-2 GL readback vs PNG census, same frame, ${r.hotCheck.length} frames: ` +
        `clipped-px disagreement max ${Math.abs(byHot.dHot)} (${byHot.name}); ` +
        `hottest-pixel disagreement max ${Math.abs(byMax.dMax).toFixed(1)} luma ` +
        `(${byMax.name}: PNG ${byMax.pngMax} vs GL ${byMax.glMax} — the CSS hold ring ` +
        `is in the composited PNG and not in the GL buffer, and it is nowhere near ` +
        `the ${HOT} line)`);
    }
    // [R6-5] WCAG AA on the margin's type, measured off the frame
    for (const c of (r.contrast || [])) {
      console.log(`         R6-5 margin contrast at ${c.name} (AA needs ${CONTRAST_MIN}:1; ` +
        `frame on disk ${c.sameAsShot}, restored ${c.restored}):`);
      for (const row of c.rows) {
        console.log(`           · ${row.live ? 'LIVE  ' : 'receded'} ${row.part.padEnd(4)} ` +
          `${row.unit.padEnd(14)} ${String(row.ratio).padStart(6)}:1  ` +
          `ink ${JSON.stringify(row.ink)} on ground ${JSON.stringify(row.ground)} ` +
          `(opacity ${row.opacity}, ${row.corePx} glyph-core px of ${row.paintedPx} painted` +
          (row.wasRatio ? `; on round 5's page ${row.wasRatio}:1` : '') + `)`);
      }
    }
    // [R6-6] the door gate turns the leaf into the card
    if (r.turns && r.turns.length) {
      console.log(`         R6-6 page turns: ` + r.turns.map(t =>
        `${t.unit} -> ${t.to} (cover peak k=${t.coverK})`).join('  ') +
        (r.endLeaf ? `; the card resolved on page ${r.endLeaf.page}/${r.endLeaf.pages} ` +
          `(card ${r.endLeaf.card}, cover down to ${r.endLeaf.coverK}, ` +
          `${r.endLeaf.marginChars} chars of beat prose left on the leaf)` : ''));
    }
    // [R6-7] what a page with no ?harness=1 actually carries
    if (r.hygiene) {
      const H = r.hygiene;
      console.log(`         R6-7 shipped page (no ?harness=1): ` +
        (H.error ? `PROBE FAILED ${H.error}`
          : `${MUTATORS.length - H.exposedMutators.length}/${MUTATORS.length} mutating hooks ` +
            `absent, ${READ_ONLY.length - H.missingReadOnly.length}/${READ_ONLY.length} ` +
            `read-only hooks present, harness mode ${H.harnessLatched}; the reader's own ` +
            `loop advanced the sim ${H.simAdvanced}s over ${H.rendered} renders in 300 ms ` +
            `of wall clock`));
      // [R7-4] the ledger as a closed census, both pages
      if (!H.error && H.shipped && H.harness) {
        console.log(`              R7-4 window '__' keys: ${H.shipped.keys} shipped / ` +
          `${H.harness.keys} under ?harness=1, ledger declares ` +
          `${MUTATORS.length + READ_ONLY.length}; undeclared: ` +
          `${[...H.shipped.unledgered, ...H.harness.unledgered].join(', ') || 'none'}`);
      }
    }
    if (r.probeSeconds !== undefined) {
      console.log(`         R5-5 canonical lap ${r.simSeconds}s; the post-lap probes ` +
        `(life re-walk, dwell sweep, walk scan, stand scan) added ${r.probeSeconds}s ` +
        `AFTER it, off the reviewed timeline`);
    }
    if (r.assetNotes && r.assetNotes.length) {
      console.log(`         asset notes: ${r.assetNotes.join(' | ')}`);
    }
    if (r.netNoise && r.netNoise.length) {
      console.log(`         transport noise (asset arrived, not a failure): ${r.netNoise.length}`);
      for (const m of r.netNoise) console.log(`           · ${m}`);
    }
    if (r.pending && r.pending.length) {
      console.log(`         PENDING gap-lane assets (not a failure): ${r.pending.length}`);
      for (const m of r.pending) console.log(`           · ${m}`);
    }
    for (const k of ['pageErrors', 'consoleErrors', 'httpErrors', 'offOrigin', 'dead', 'wedges']) {
      if (r[k].length) {
        bad += r[k].length;
        console.log(`  ${k.toUpperCase()} (${r[k].length}):`);
        for (const m of r[k]) console.log(`    - ${m}`);
      }
    }
    if (r.appErrors && r.appErrors.length) {
      bad += r.appErrors.length;
      console.log(`  APP ERRORS (${r.appErrors.length}):`);
      for (const m of r.appErrors) console.log(`    - ${m.kind}: ${m.msg}`);
    }
  }
  const totalShots = reports.reduce((n, r) => n + r.shots.length, 0);
  console.log(`\nshots: ${totalShots} -> ${path.relative(ROOT, outRoot)}`);
  console.log(`report: ${path.relative(ROOT, reportPath)}`);
  if (fatal) { console.error('\nFATAL: ' + fatal); process.exit(1); }
  if (bad) { console.error(`\nFAILED: ${bad} finding(s)`); process.exit(1); }
  console.log('OK: clean lap');
})();
