/**
 * cine-mount.js — the storyteller camera, mounted on the stage.
 *
 * The stage owns the world and leaves two seams: setCamera() takes the lens,
 * setRenderPass() takes the draw. This module fills both with cine3d.js and
 * nothing else changes hands — the stage never learns what a shot is, and the
 * camera never learns what a set is.
 *
 *   const cine = await mountCine(stage);       // once, after the first mount
 *   cine.enter(unitId);                        // on unit ENTER — this is a CUT
 *   cine.step(simT);                           // every fixed step
 *   cine.metrics();                            // what the composition gates read
 *
 * THE CUT (the teleport law, amended). A unit advance is a CUT: instant, no
 * tween. The teleport law that forbids a one-frame position substitution binds
 * ACTORS; a camera cut is the grammar of the form, and the gate counts cuts
 * rather than forbidding them. Two consecutive units that share a shot do not
 * cut — the move simply keeps running, which is what a held shot across two
 * lines of one speech is.
 */
import * as THREE from 'three';
import { CineCam, CineDof, measureShot, ReadRig, readSubjectPixels, READ_LAW, DISSOLVE_S } from '../cine3d.js';

/** the void a cutaway set shows when the lens can see past its shell */
export const VOID_COLOUR = { cave: '#0a0806', shore: '#060910', sea: '#070b16' };

/* scratch for the must-see point handed to the aspect solve */
const _see = new THREE.Vector3();

export async function mountCine(stage, url = './shots3d.json') {
  const table = await (await fetch(url, { cache: 'force-cache' })).json();
  const cam = new CineCam(table);
  const dof = new CineDof(stage.renderer);

  /* the stage's own resolver, corrected on one point: a body's ANCHOR is where
     it stands, not the centre of its bind-pose box. A SkinnedMesh AABB does not
     know the character is kneeling, so the same man measures 1.75 m standing
     and 3.02 m as a suppliant — the size comes from the row's frame.h, and this
     only has to say where he is. */
  const resolve = (subject) => {
    if (!subject) return null;
    if (subject.a) {
      const ids = /^poly/.test(subject.a)
        ? [subject.a, 'poly-seat', 'poly-idle', 'poly-walk'] : [subject.a];
      for (const id of ids) {
        const a = stage.actors && stage.actors.get(id);
        if (!a || !a.group.visible) continue;
        a.group.updateWorldMatrix(true, false);
        return { p: a.group.getWorldPosition(new THREE.Vector3()),
                 face: a.group.rotation.y, id };
      }
    }
    const r = stage.resolve(subject);
    return r ? { p: r.p, face: r.face, point: true } : null;
  };

  /* THE READABILITY RIG. Two motivated lamps that belong to the SUBJECT OF THE
     LINE and travel with it — the answer to Fable's round-1 defect. The set's
     own light story is untouched; these are short-range and die a couple of
     subject-heights out. Re-parented on every set turn because unmount() takes
     the whole scene graph the set was mounted into. */
  const rig = new ReadRig();
  const attach = () => {
    if (rig.group.parent !== stage.scene) stage.scene.add(rig.group);
    if (rig.setName !== stage.setName) rig.setSet(stage.setName);
  };

  /* THE PAGE-TURN SEAM (live-book cut). A beat head has to AWAIT the new set's
     mount, and the draw loop kept running through the await: the reader's
     actual frame was the old lens pointed at a half-built world — measured at
     013-ody-ii-00-head-entry, an unlit cave shell floating in navy void where
     the master had an interior establishing shot. The page now HOLDS THE LAST
     GOOD FRAME across the mount (main3d stops drawing; the buffer is preserved)
     and the new shot dissolves out of it. This fade is the camera's own
     DISSOLVE machinery, kept on its own counter so the cut ledger — which the
     coverage gate reads — never learns a page was turned. */
  let turnFade = 0;
  stage.setCamera(cam.cam);
  stage.setRenderPass((scene, camera, renderer) => {
    if (!scene.background) scene.background =
      new THREE.Color(VOID_COLOUR[stage.setName] || '#07080c');
    dof.render(scene, camera, {
      focus: cam.focusDist, focal: cam.focalLength(), fstop: cam.fstop,
      near: cam.dofNear, expo: (renderer.toneMappingExposure || 1) * (cam.expo || 1),
      tone: 1, grain: 0,
      /* THE TRANSITION. Straight cut everywhere; the five declared time
         ellipses cross-fade out of the frame the reader was just looking at. */
      fade: Math.max(cam.dissolve > 0 ? cam.dissolve / DISSOLVE_S : 0,
                     turnFade > 0 ? turnFade / DISSOLVE_S : 0),
    });
  });
  /* the tone map moves to the focus pass: three applies its own only when it
     draws to the default framebuffer, and this pass draws through a target */
  stage.renderer.toneMappingExposure = stage.renderer.toneMappingExposure || 1.38;
  stage.renderer.toneMapping = THREE.NoToneMapping;

  const light = () => {
    attach();
    rig.aim(cam.cam, cam.anchor, (cam.shot && cam.shot.frame.h) || 1.75, cam.read);
  };

  const api = {
    cam, dof, table, rig,
    /**
     * @param {string} unitId
     * @param {{own?:boolean}} [opt] `own: true` — the reader's finger is on
     *   this unit (a target/hold/release/clock verb), so the dwell grammar may
     *   breathe but may NOT re-cycle coverage: the ring is drawn where THIS
     *   station puts it and cutting away would move the reader's target.
     */
    enter(unitId, opt) {
      const c = cam.cutTo(unitId, stage.simT, resolve);
      cam.noRecycle = !!(opt && opt.own);
      light();
      return c;
    },
    step(t, dt = 1 / 60) {
      if (turnFade > 0) turnFade = Math.max(0, turnFade - dt);
      cam.step(t, dt, resolve); light(); return cam.tookCut || 0;
    },
    /** the page turned: dissolve the new shot out of the frame that was held */
    turn(sec = DISSOLVE_S) { turnFade = sec; },
    setAspect(a) { cam.setAspect(a); },
    /** the reader's target, so a narrower frame may not crop away his gate */
    mustSee(obj) {
      if (!obj || !obj.visible) { cam.setMustSee(null); return; }
      obj.updateWorldMatrix(true, false);
      cam.setMustSee(obj.getWorldPosition(_see));
    },
    snapshot() { return { ...cam.snapshot(), read: rig.report }; },
    /**
     * THE READABILITY GATE. The subject's projected box, read off the pixels
     * the reader is looking at: is anything on this body actually LIT, and
     * does it separate from what is behind it?
     */
    readback() {
      const m = measureShot(cam.cam, cam.subjBox, {});
      if (!m.ok) return { ok: false, why: 'no subject box' };
      /* THE FRAME MUST BE DRAWN IN THIS TURN. A WebGL canvas hands drawImage a
         STALE surface once the compositor has taken the frame — measured, not
         guessed: the same cave shot read a flat 0.068 band before this line and
         a real 0.34-mean picture after it (tools/ody/_readprobe.mjs). The book
         renders with preserveDrawingBuffer, so one synchronous re-render puts
         the pixels the reader is looking at back under the sampler. */
      dof.forceNoFade = true;
      stage.render();
      dof.forceNoFade = false;
      const r = readSubjectPixels(stage.canvas, m.box, 160, cam.shot && cam.shot.class,
                                  cam.shot && cam.shot.setupRole);
      if (!r) return { ok: false, why: 'no canvas' };
      return { unit: cam.unitId, cls: cam.shot && cam.shot.class, box: m.box,
               law: READ_LAW, rig: rig.report, ...r };
    },
    /** the composition gates' whole reading of the frame on screen */
    metrics() {
      const row = cam.shot;
      if (!row) return null;
      const m = measureShot(cam.cam, cam.subjBox, { facing: cam.subjFace });
      const cls = cam.classOf(row.class);
      const out = {
        unit: row.unit, cls: row.class, set: row.set, floor: cls.floor,
        size: m.h, inFrame: m.inFrame, cutSides: m.cutSides, fill: !!row.frame.fill,
        lookRoom: m.lookRoom, lookRoomOk: m.lookRoomOk, roll: m.rollDeg,
        cx: m.cx, cy: m.cy, live: cam.subjOk, cuts: cam.cuts, holds: cam.holds,
        setup: row.setup || null, transition: row.transition || 'cut',
        hold: row.hold || null,
        /* the cut list: which shot of the unit is on screen, and how many the
           unit still owes — the pacing law's own readout */
        sub: cam.subI, subCuts: cam.subCuts,
        subsOwed: Math.max(0, cam.subs.length - cam.subI),
        subAt: row.t === undefined ? null : row.t,
        fov: cam.cam.fov, camY: cam.cam.position.y, focus: cam.focusDist,
        fstop: cam.fstop, move: row.move.k, shake: cam.shakeAmp,
        rack: cam.rackK || 0, rig: rig.report,
        /* THE DWELL GRAMMAR, on the record. `dwell` is how long this station
           has been past its own move; `breath` the creep it is riding;
           `recycles` how many times the unit has re-cut its own coverage
           because the reader stayed. A live-dwell gate reads these. */
        aspect: +cam.cam.aspect.toFixed(4), fitYaw: cam.fitYaw || 0,
        fitFov: cam.fitFov || 0, dwell: +(cam.dwellS || 0).toFixed(2),
        breath: cam.breath || 0, recycles: cam.recycles || 0,
      };
      /* THE SCREEN-DIRECTION SYSTEM. In the cave the giant is ALWAYS frame
         right and the men are ALWAYS frame left, so a cut never swaps who is
         where and the eyelines answer each other across every cut. The row
         carries the side it was baked to; this reports the side it landed on. */
      if (row.frame.side) {
        out.wantSide = row.frame.side;
        out.side = m.cx === 0 ? 0 : (m.cx > 0 ? 1 : -1);
        out.sideOk = Math.abs(m.cx) < 0.03 || out.side === row.frame.side;
        out.facingSide = m.facingSide === undefined ? null : m.facingSide;
      }
      /* THE SCALE REFERENCE: a giant is only giant beside something known */
      if (row.fg) {
        const fg = resolve({ a: row.fg });
        if (fg) {
          const dF = cam.cam.position.distanceTo(fg.p);
          const dS = cam.cam.position.distanceTo(cam.anchor);
          out.scaleRef = { id: row.fg, ratio: +(dF / Math.max(0.01, dS)).toFixed(3) };
          out.scaleRefOk = out.scaleRef.ratio < 0.72;
        } else out.scaleRefOk = false;
      }
      if (row.over) out.overOnScreen = !!resolve({ a: row.over });
      return out;
    },
  };
  return api;
}
