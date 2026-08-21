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
import { CineCam, CineDof, measureShot } from '../cine3d.js';

/** the void a cutaway set shows when the lens can see past its shell */
export const VOID_COLOUR = { cave: '#0a0806', shore: '#060910', sea: '#070b16' };

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

  stage.setCamera(cam.cam);
  stage.setRenderPass((scene, camera, renderer) => {
    if (!scene.background) scene.background =
      new THREE.Color(VOID_COLOUR[stage.setName] || '#07080c');
    dof.render(scene, camera, {
      focus: cam.focusDist, focal: cam.focalLength(), fstop: cam.fstop,
      near: cam.dofNear, expo: (renderer.toneMappingExposure || 1) * (cam.expo || 1),
      tone: 1, grain: 0,
    });
  });
  /* the tone map moves to the focus pass: three applies its own only when it
     draws to the default framebuffer, and this pass draws through a target */
  stage.renderer.toneMappingExposure = stage.renderer.toneMappingExposure || 1.38;
  stage.renderer.toneMapping = THREE.NoToneMapping;

  const api = {
    cam, dof, table,
    enter(unitId) { return cam.cutTo(unitId, stage.simT, resolve); },
    step(t, dt = 1 / 60) { cam.step(t, dt, resolve); },
    setAspect(a) { cam.setAspect(a); },
    snapshot() { return cam.snapshot(); },
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
        cx: m.cx, cy: m.cy, live: cam.subjOk, cuts: cam.cuts,
        fov: cam.cam.fov, camY: cam.cam.position.y, focus: cam.focusDist,
        fstop: cam.fstop, move: row.move.k, shake: cam.shakeAmp,
      };
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
