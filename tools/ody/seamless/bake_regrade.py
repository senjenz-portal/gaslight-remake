#!/usr/bin/env python3
"""
bake_regrade.py — the ADOPTED Explorer B (explore-regrade.md), run at BUILD
time: for every actor cut a set uses, bake a per-set graded variant against
the plate ring at the mark the cut mostly plays on, and register the result.

Everything is deterministic (regrade.py has no RNG; PIL's PNG writer is
byte-stable), so two runs produce identical PNGs and an identical registry —
the lap's sha gate can hold the shipped bytes against this file's output.

THE STATE LAW (multi-state sets): each cut is graded against the painted
state it MOSTLY PLAYS IN, counted per unit off units.js's own act timeline:
  cave   dawn ii-00..03 | shut ii-04..09 | embers ii-10..13 | predawn
         iii-00..06 | shut iii-07..12 | embers iii-13+iv-00..10 | master
         iv-11..12 | predawn v-00..04 | dawn v-05..12.
         Cuts that split between the two firelit states take the SHUT/EMBERS
         unit majority (the report's ring data: both giant meals graded
         against cave-shut); cuts that never play in either (the blinded
         doorway bulk, the rams) take their own majority state's plate.
  shore  night i-00..04 | day i-05..12 — every staged cut's majority is DAY
         (council/mainland/twelve/climb all play after `shore-day`), so the
         shore grades against shore-day.jpg, and the rim is None (the day
         map paints the fire OUT — dead coals cast no rim).
  sea    one master.

MARKS: the mark each cut mostly plays at, transcribed from the sets' own
staging tables (MARKS / U_AT / FORM / SPRAWL / TRIOS / flockOut / SPLASH2 /
stern-ulysses / clifftop-giant); hPx is the drawn height the set passes to
pinCut/pinAt/pinSprite for that pose. Light anchors are the layer lanes'
emissives (rim only where the state's own light map keeps the source lit).

Outputs:
  site-deploy/living-odyssey/assets/actor/graded/<set>/<cut>.png
  tools/ody/regrade.json   (source sha -> graded sha + the measured numbers)

Usage: python3 tools/ody/seamless/bake_regrade.py
"""

import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from regrade import grade_cut  # noqa: E402  (the adopted explorer, verbatim)

ROOT = "/Users/samz/Documents/gaslight-remake"
ASSETS = os.path.join(ROOT, "site-deploy/living-odyssey/assets")
REGISTRY = os.path.join(ROOT, "tools/ody/regrade.json")

# the layer lanes' light anchors (layers-*.json / the sets' EMIS tables)
FIRE_CAVE = dict(light=(638, 427), reach=238)    # cave-shut: the blaze
EMBERS_CAVE = dict(light=(662, 456), reach=61)   # cave-embers / predawn (0.5)
MOUTH_CAVE = dict(light=(337, 312), reach=80)    # cave-dawn: the shaft
CAVE_SEA = dict(light=(818, 457), reach=60)      # sea: the lit cave at the base
CRAG_SEA = dict(light=(820, 339), reach=90)      # sea: the crag glow, cliff-high
NO_RIM = dict(light=None, reach=None)            # day: dead coals, no source

# ---- THE BAKE TABLE: set / cut / plate-state / mark / hPx / flip / rim ----
# `why` documents the unit-majority call; `settle` names the representative
# unit the lap's [regrade] gate measures this entry at (6 of them).
BAKE = [
    # ---------------- cave (five painted states; shut/embers majority) ----
    dict(set="cave", cut="ulysses-stand", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(690, 495), h=75, flip=False, **FIRE_CAVE,
         settle="ody-ii-06-plea",
         why="stand plays shut ii-04..09 + iii-07 (7) vs embers ii-10 (1); "
             "mark = suppliant (ii-06)"),
    dict(set="cave", cut="ulysses-walk", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(640, 480), h=75, flip=False, **FIRE_CAVE,
         why="transitional cut; rides the stand's majority state, mid-floor "
             "mark = scheme"),
    dict(set="cave", cut="ulysses-offer", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(700, 468), h=75, flip=False, **FIRE_CAVE,
         settle="ody-iii-08-lookhere",
         why="G3's pose, shut iii-08..12 only; mark = bowl-offer (the "
             "report's cave bowl-offer settle)"),
    dict(set="cave", cut="ulysses-sword", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(768, 462), h=75, flip=False, **EMBERS_CAVE,
         why="sword pose plays embers ii-11..13 (3) vs shut 0; mark = "
             "sword-ulysses"),
    dict(set="cave", cut="ulysses-drive", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(624, 549), h=66, flip=False, **EMBERS_CAVE,
         why="the blinding tableau, embers iv-01..06; mark = U_AT.stakefive, "
             "h the set's own drive 66 (residual dE is the near-black floor "
             "ring vs the crimson accent — ungated, like the report's sea "
             "stern)"),
    dict(set="cave", cut="crew-a-stand", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(522, 459), h=73, flip=False, **EMBERS_CAVE,
         why="crew embers units (huddle ii-10..13 + stake-five iv-01..10, "
             "~15) vs shut 12; mark = FORM.stakefive[0]"),
    dict(set="cave", cut="crew-b-stand", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(492, 441), h=73, flip=False, **EMBERS_CAVE,
         why="as crew-a; mark = FORM.stakefive[1]"),
    dict(set="cave", cut="crew-carry", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(472, 481), h=70, flip=False, **EMBERS_CAVE,
         why="carry plays racks (dawn ii-01) and the stake beam (embers "
             "iv-01..10) — embers majority; mark = FORM.stakefive[2], "
             "h = crew 73 x 0.96"),
    dict(set="cave", cut="polyphemus-stand", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(760, 452), h=300, flip=False, **FIRE_CAVE,
         why="the standing bulk holds giant-seat through ii-04 (shut) "
             "between the walk-in and the seat; embers 0"),
    dict(set="cave", cut="polyphemus-seated", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(760, 452), h=165, flip=False, **FIRE_CAVE,
         settle="ody-ii-05-strangers",
         why="the working seat, shut ii-05..09 + iii-07..12 (12) vs embers 0 "
             "(the report's cave meal settle)"),
    dict(set="cave", cut="polyphemus-clutch", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(760, 452), h=190, flip=False, **FIRE_CAVE,
         why="the three meals split shut iii-07 / embers ii-10 1-1; the "
             "report graded the meal ring on cave-shut (the blaze), so the "
             "tie takes shut"),
    dict(set="cave", cut="polyphemus-drink", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(760, 452), h=175, flip=False, **FIRE_CAVE,
         why="the three pours, shut iii-09..12 only"),
    dict(set="cave", cut="polyphemus-sprawl", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(664, 546), h=70, flip=False, **EMBERS_CAVE,
         why="the sprawl is the embers tableau (ii-10..13 + iii-13..iv-10, "
             "~16 units) vs shut 0; mark = the swept SPRAWL.at"),
    dict(set="cave", cut="polyphemus-blinded-grope",
         plate="set/cave/cave-predawn.jpg",
         state="predawn", mark=(345, 420), h=165, flip=False, **EMBERS_CAVE,
         why="never plays shut/embers: doorway bulk predawn v-02..04 (3) vs "
             "master iv-11..12 (2); mark = doorway-seat at the doorway h 165"),
    dict(set="cave", cut="polyphemus-stroke", plate="set/cave/cave-dawn.jpg",
         state="dawn", mark=(345, 420), h=190, flip=False, **MOUTH_CAVE,
         why="never plays shut/embers: the stroke is the dawn escape "
             "(v-05..10); mark = doorway-seat"),
    dict(set="cave", cut="ram-great", plate="set/cave/cave-predawn.jpg",
         state="predawn", mark=(838, 430), h=83, flip=False, **EMBERS_CAVE,
         settle="ody-v-04-greatram",
         why="the plain great ram plays v-04 (predawn) only — G5's click "
             "slings him before dawn; mark = ram-stand"),
    dict(set="cave", cut="ram-great-slung", plate="set/cave/cave-dawn.jpg",
         state="dawn", mark=(395, 438), h=84, flip=False, **MOUTH_CAVE,
         why="the slung ram is the dawn escape (v-05..07, 3) vs predawn "
             "v-04 (1); mark = ram-at-mouth"),
    dict(set="cave", cut="ram-pair-slung", plate="set/cave/cave-dawn.jpg",
         state="dawn", mark=(660, 536), h=57, flip=False, **MOUTH_CAVE,
         why="lashed pairs predawn v-03..04 (2) vs the dawn stream v-05..07 "
             "(3); mark = flockOut mid-path"),
    dict(set="cave", cut="prop-bowl", plate="set/cave/cave-shut.jpg",
         state="shut", mark=(700, 441), h=16, flip=False, **FIRE_CAVE,
         why="G3's bowl, shut iii-08..12; mark = HOLD_AT.bowl"),
    dict(set="cave", cut="prop-sword", plate="set/cave/cave-embers.jpg",
         state="embers", mark=(768, 445), h=12, flip=False, **EMBERS_CAVE,
         why="G2's glint lives in the low-fire state (ii-11..13); mark = "
             "the hip anchor (768,462)-17"),
    dict(set="cave", cut="prop-stake", plate="set/cave/cave-predawn.jpg",
         state="predawn", mark=(790, 500), h=41, flip=False, **EMBERS_CAVE,
         why="the plain stake plays the make/hide (predawn iii-04..06, 3) "
             "vs embers iv-01 (1); mark = stake-hide, h = 84 x 592/1217"),
    dict(set="cave", cut="prop-stake-glowing",
         plate="set/cave/cave-embers.jpg",
         state="embers", mark=(662, 456), h=43, flip=False, **EMBERS_CAVE,
         why="the glow is the embers heat/drive (iv-02..06); mark = "
             "HOLD_AT.embers, h = 84 x 582/1143"),

    # ---------------- shore (night i-00..04, day i-05..12: DAY majority) --
    dict(set="shore", cut="ulysses-stand", plate="set/shore/shore-day.jpg",
         state="day", mark=(510, 492), h=20, flip=True, **NO_RIM,
         why="stand plays day i-05..12 (8) vs night i-01..04 (4); mark = "
             "council-ulysses (the report's shore settle, now on the state "
             "it actually plays in)"),
    dict(set="shore", cut="crew-a-stand", plate="set/shore/shore-day.jpg",
         state="day", mark=(426, 501), h=19, flip=False, **NO_RIM,
         why="day majority as ulysses; mark = council crew arc [0]"),
    dict(set="shore", cut="crew-b-stand", plate="set/shore/shore-day.jpg",
         state="day", mark=(445, 507), h=19, flip=False, **NO_RIM,
         settle="ody-i-06-council",
         why="day majority; mark = council crew arc [1] (the ledger's "
             "council-crew centroid)"),
    dict(set="shore", cut="prop-wineskin", plate="set/shore/shore-day.jpg",
         state="day", mark=(564, 495), h=7, flip=False, **NO_RIM,
         why="shouldered i-10..12, all day; mark = the twelve-at-ship "
             "shoulder point (560+4, 503-20x0.42)"),

    # ---------------- sea (one master) ------------------------------------
    dict(set="sea", cut="polyphemus-stand", plate="set/sea/sea.jpg",
         state="master", mark=(860, 210), h=89, flip=False, **CRAG_SEA,
         why="clifftop-giant, the ledger's mark; rim off the crag glow"),
    dict(set="sea", cut="polyphemus-hurl", plate="set/sea/sea.jpg",
         state="master", mark=(860, 210), h=105, flip=False, **CRAG_SEA,
         settle="ody-vi-03-jeer",
         why="the hurl at the clifftop, arms h 105"),
    dict(set="sea", cut="polyphemus-curse", plate="set/sea/sea.jpg",
         state="master", mark=(860, 210), h=105, flip=False, **CRAG_SEA,
         why="the curse at the clifftop, arms h 105"),
    dict(set="sea", cut="ulysses-stand", plate="set/sea/sea.jpg",
         state="master", mark=(518, 426), h=22, flip=True, **CAVE_SEA,
         why="the stern mark, flipped at the cliff; rim off the lit cave"),
    dict(set="sea", cut="ulysses-taunt", plate="set/sea/sea.jpg",
         state="master", mark=(518, 426), h=22, flip=True, **CAVE_SEA,
         why="the taunt at the stern (the report's sea stern settle; the "
             "residual is the protected cloak accent, by design)"),
    dict(set="sea", cut="prop-rock", plate="set/sea/sea.jpg",
         state="master", mark=(455, 540), h=48, flip=False, **CAVE_SEA,
         why="rock 2's near-miss water (SPLASH2), the flight's landing ring"),
    dict(set="sea", cut="prop-splash", plate="set/sea/sea.jpg",
         state="master", mark=(455, 540), h=76, flip=False, **CAVE_SEA,
         why="the plume at SPLASH2, h = SPLASH_H 76"),
]

# tools/ody/actors.json pins (grade_cut's signature wants them; the grade
# itself never reads the pin — the ring is the mark's business)
ACTORS = json.load(open(os.path.join(ROOT, "tools/ody/actors.json")))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    entries = {}
    plates = {}
    for row in BAKE:
        plate_path = os.path.join(ASSETS, row["plate"])
        if row["plate"] not in plates:
            plates[row["plate"]] = np.asarray(
                Image.open(plate_path).convert("RGB"))
        plate = plates[row["plate"]]

        src_rel = "actor/" + row["cut"] + ".png"
        src_path = os.path.join(ASSETS, src_rel)
        cut = np.asarray(Image.open(src_path).convert("RGBA"))
        pin = ACTORS.get(row["cut"], {}).get("pin", [0, 0])

        graded, rep = grade_cut(
            cut, plate, row["mark"], row["h"], tuple(pin),
            flip=row["flip"], light_anchor=row["light"],
            light_reach=row["reach"])

        out_rel = "actor/graded/%s/%s.png" % (row["set"], row["cut"])
        out_path = os.path.join(ASSETS, out_rel)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        Image.fromarray(graded).save(out_path, optimize=True)

        key = "%s/%s" % (row["set"], row["cut"])
        entries[key] = {
            "set": row["set"], "cut": row["cut"],
            "source": "assets/" + src_rel,
            "sourceSha256": sha256_file(src_path),
            "graded": "assets/" + out_rel,
            "gradedSha256": sha256_file(out_path),
            "plate": "assets/" + row["plate"], "state": row["state"],
            "mark": list(row["mark"]), "hPx": row["h"], "flip": row["flip"],
            "light": list(row["light"]) if row["light"] else None,
            "reach": row["reach"], "why": row["why"],
            "settle": row.get("settle"),
            "ring": rep["ring"],
            "deltaE": {"before": rep["deltaE_before"],
                       "after": rep["deltaE_after"]},
            "cct": {"ring": rep["ring"]["cct"],
                    "before": rep["cut_before"]["cct"],
                    "after": rep["cut_after"]["cct"],
                    "dBefore": rep["cct_delta_before"],
                    "dAfter": rep["cct_delta_after"]},
            "accent": {"hueDeg": rep["accent_hue_deg"],
                       "px": rep["accent_px"]},
            "rim": rep["rim_applied"],
        }
        print("%-28s %-8s dE %5.1f -> %4.1f   dCCT %5d -> %5d%s" % (
            key, row["state"], rep["deltaE_before"], rep["deltaE_after"],
            rep["cct_delta_before"], rep["cct_delta_after"],
            "   [settle " + row["settle"] + "]" if row.get("settle") else ""))

    reg = {
        "lane": "ody-regrade (Explorer B adopted; "
                "tools/ody/seamless/explore-regrade.md)",
        "tool": "tools/ody/seamless/regrade.py via bake_regrade.py",
        "law": "one graded variant per set x cut, graded against the state "
               "the cut mostly plays in (unit majority; cave shut/embers "
               "ties per the report's ring data); sets load graded, fall "
               "back to the raw cut; the lap holds the shas AND dE <= 9 at "
               "the six settle entries",
        "gate": {"deltaEMax": 9,
                 "settles": [k for k, e in entries.items() if e["settle"]]},
        "entries": entries,
    }
    with open(REGISTRY, "w") as f:
        json.dump(reg, f, indent=1)
        f.write("\n")
    des = [e["deltaE"]["after"] for e in entries.values()]
    settles = [e["deltaE"]["after"] for e in entries.values() if e["settle"]]
    print("\n%d cuts graded, registry -> %s" % (len(entries), REGISTRY))
    print("dE after: mean %.1f, max %.1f; settle entries: %s (gate <= 9)" % (
        float(np.mean(des)), float(np.max(des)),
        ", ".join("%.1f" % v for v in sorted(settles))))


if __name__ == "__main__":
    main()
