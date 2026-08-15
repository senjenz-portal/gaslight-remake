#!/usr/bin/env python3
"""audiogen_ody.py — living-odyssey AUDIO lane generator.

Same pipeline as tools/audiogen.py (sherlock's lane): Scenario API brokering
ElevenLabs SFX v2 (model_elevenlabs-sound-effects-v2), with a direct
ElevenLabs sound-generation fallback.

  POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}
  poll  GET /v1/jobs/{jobId} until status success/failure   (bounded 120 s,
        then the job is marked failed and the run moves on)
  GET   /v1/assets/{assetId} -> signed CDN url -> download mp3

RAW-FIRST: every variant lands in assets/raw/ody-audio/<UTC ts>/ with a
per-run manifest; the lane-level curated manifest is written to
assets/raw/ody-audio/manifest.json. Curated picks are COPIES shipped to
site-deploy/living-odyssey/assets/audio/ (flat kebab names, beds carrying
the -bed suffix, exactly sherlock's layout) plus a manifest.json alongside,
so app/audio.js needs only its FILES/GAIN/BEDS name map swapped.

stdlib only. Secrets parsed from the story-orbit .env (multi-line JSON value
in that file breaks shell `source`); values are never printed.

Usage:
  python3 audiogen_ody.py                 # all sounds, 1 variant each
  python3 audiogen_ody.py --only sea-bed,oar-stroke --variants 2
  python3 audiogen_ody.py --resume        # skip sounds already shipped
"""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import wave

ENV_PATH = "/Users/samz/Documents/story-orbit/.env"
ROOT = "/Users/samz/Documents/gaslight-remake"
RAW_ROOT = os.path.join(ROOT, "assets", "raw", "ody-audio")
SHIP_DIR = os.path.join(ROOT, "site-deploy", "living-odyssey", "assets", "audio")
SCENARIO_BASE = "https://api.cloud.scenario.com/v1"
SFX_MODEL = "model_elevenlabs-sound-effects-v2"
ELEVEN_SFX_URL = "https://api.elevenlabs.io/v1/sound-generation"
POLL_MAX_S = 120          # per-job poll budget; past it: mark failed, move on

# ------------------------------------------------------------- target set
# CONTENT-odyssey.md staging ledger. Beds are seamless loops (ElevenLabs
# loop mode); cues one-shots. giant-snore generates in loop mode because the
# staging uses it as a snore-BED under beats II-IV.
SOUNDS = {
    # ------------------------------------------------------------- beds
    "shore-night-bed": {
        "role": "bed",
        "text": ("night seashore ambience on a pebble beach, gentle surf "
                 "waves washing in and out, soft campfire embers crackling "
                 "quietly nearby, low night breeze, no voices, no music, "
                 "seamless ambient loop"),
        "durationSeconds": 25, "promptInfluence": 0.45, "loop": True,
        "description": "Beat I/VI night shore: surf + camp embers.",
    },
    "shore-day-bed": {
        "role": "bed",
        "text": ("bright daytime seashore ambience, seagulls calling and "
                 "wheeling overhead, light sea breeze, gentle waves washing "
                 "a rocky shore, no voices, no music, seamless ambient loop"),
        "durationSeconds": 25, "promptInfluence": 0.45, "loop": True,
        "description": "Daytime shore: gulls + breeze over light surf.",
    },
    "cave-bed": {
        "role": "bed",
        "text": ("deep stone cave interior ambience, slow echoing water "
                 "drips, the soft murmur of a resting sheep flock shuffling "
                 "and faintly bleating far in the dark, cold reverberant "
                 "air, no voices, no music, seamless ambient loop"),
        "durationSeconds": 25, "promptInfluence": 0.4, "loop": True,
        "description": "The cave: drips + flock murmur, no fire.",
    },
    "cave-fire-bed": {
        "role": "bed",
        "text": ("deep stone cave interior at night, a wood fire crackling "
                 "steadily in the foreground, slow echoing water drips, "
                 "faint sheep flock shuffling and soft distant bleats, "
                 "reverberant stone air, no voices, no music, seamless "
                 "ambient loop"),
        "durationSeconds": 25, "promptInfluence": 0.45, "loop": True,
        "description": "The cave with the fire lit: cave-bed + crackle.",
    },
    "sea-bed": {
        "role": "bed",
        "text": ("open sea aboard a wooden galley under way, rolling ocean "
                 "swell against the hull, steady rhythmic oar strokes "
                 "dipping and pulling in water, creaking timbers, sea wind, "
                 "no voices, no music, seamless ambient loop"),
        "durationSeconds": 25, "promptInfluence": 0.45, "loop": True,
        "description": "Open water: swell + oars (Beat I landfall, Beat VI).",
    },
    # ------------------------------------------------------------- cues
    "boulder-boom": {
        "role": "cue",
        "text": ("an enormous stone boulder rolled across a cave mouth, "
                 "deep heavy grinding of rock on rock ending in a massive "
                 "booming thud as it seats, dust trickling down after, huge "
                 "cavern echo, no other sounds"),
        "durationSeconds": 5, "promptInfluence": 0.6, "loop": False,
        "description": "Boulder-shut: grind -> boom -> settling dust. "
                       "Reverse-play for the stone-drag open.",
    },
    "fire-roar": {
        "role": "cue",
        "text": ("a large fire suddenly flaring up into a roaring blaze, a "
                 "whoosh of flame and fierce crackling roar, then easing, "
                 "no voices, no music"),
        "durationSeconds": 3, "promptInfluence": 0.6, "loop": False,
        "description": "The fire lit / flaring in the cave.",
    },
    "bleat-flock": {
        "role": "cue",
        "text": ("a flock of sheep and goats bleating together, many "
                 "overlapping deep and small bleats, hooves shuffling on "
                 "stone, a faint small bell, no voices, no music"),
        "durationSeconds": 4, "promptInfluence": 0.55, "loop": False,
        "description": "Bleat-chorus swell: flock driven in / dawn rush out.",
    },
    "wine-pour": {
        "role": "cue",
        "text": ("wine poured generously from a skin into a large wooden "
                 "bowl, rich glugging liquid pour, close perspective, no "
                 "other sounds"),
        "durationSeconds": 2.5, "promptInfluence": 0.6, "loop": False,
        "description": "The hold gate's pour (x3).",
    },
    "bowl-drain": {
        "role": "cue",
        "text": ("long deep gulping swallows draining a large bowl of "
                 "liquid, greedy continuous gulps, liquid sloshing, a final "
                 "wet exhale, close perspective, no speech, no other sounds"),
        "durationSeconds": 3, "promptInfluence": 0.6, "loop": False,
        "description": "Each release drained without thought or heed.",
    },
    "ember-hiss": {
        "role": "cue",
        "text": ("green wood pressed into hot embers, soft sap hiss and "
                 "fine crackle, faint ember pops, close on a fire pit, no "
                 "other sounds"),
        "durationSeconds": 3, "promptInfluence": 0.6, "loop": False,
        "description": "The stake heating in the coals (glow-hold gate).",
    },
    "stake-sizzle": {
        "role": "cue",
        "text": ("a red-hot wooden point plunged with a violent hissing "
                 "sizzle, like a blacksmith quenching glowing iron, a loud "
                 "steam burst then sputtering fade, no other sounds"),
        "durationSeconds": 3, "promptInfluence": 0.65, "loop": False,
        "description": "The blinding: quench-hiss cutting to the roar.",
    },
    "giant-roar": {
        "role": "cue",
        "text": ("a colossal abstract bellow of pain, deep non-human "
                 "monstrous roar echoing through a vast stone cavern, one "
                 "single anguished roar with a long decaying echo, no "
                 "words, no music"),
        "durationSeconds": 4, "promptInfluence": 0.55, "loop": False,
        "description": "Polyphemus' pain, abstract — no words.",
    },
    "giant-snore": {
        "role": "cue",
        "text": ("enormous slow snoring of a huge sleeping creature, deep "
                 "rumbling inhale and heavy blustery exhale repeating "
                 "steadily, echo of a large stone cavern, no other sounds, "
                 "seamless loop"),
        "durationSeconds": 12, "promptInfluence": 0.5, "loop": True,
        "description": "Snore-bed: loops under the sword gate and the stake.",
    },
    "rock-whoosh-splash": {
        "role": "cue",
        "text": ("a huge boulder hurled through the air, a heavy whoosh "
                 "passing overhead then a tremendous splash into deep sea "
                 "water, spray raining down onto waves, no other sounds"),
        "durationSeconds": 5, "promptInfluence": 0.6, "loop": False,
        "description": "The hurled rock (both throws share this cue).",
    },
    "oar-stroke": {
        "role": "cue",
        "text": ("a single wooden oar stroke, the blade dipping into sea "
                 "water, a strong pull with swirl and drips, wooden thole "
                 "pin creak, close perspective, no other sounds"),
        "durationSeconds": 2, "promptInfluence": 0.6, "loop": False,
        "description": "One oar stroke: the backwater scramble, departure.",
    },
    "dawn-birds": {
        "role": "cue",
        "text": ("first birdsong at dawn, sparse gentle chirps and warbles "
                 "of small birds waking on a quiet mediterranean shore, "
                 "quiet and airy, no music, no other sounds"),
        "durationSeconds": 5, "promptInfluence": 0.5, "loop": False,
        "description": "Rosy-fingered Dawn state changes.",
    },
}


# ---------------------------------------------------------------- helpers
def load_env(path=ENV_PATH):
    env = {}
    line_re = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            m = line_re.match(line.rstrip("\n"))
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[k] = v
    return env


def http_json(url, headers, payload=None, method=None, timeout=120):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json",
                                          **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def download(url, dest, headers=None, timeout=300):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def audio_stats(path):
    stats = {"bytes": os.path.getsize(path)}
    if not shutil.which("afconvert"):
        return stats
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "x.wav")
        p = subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16@44100", path, wav],
            capture_output=True)
        if p.returncode != 0 or not os.path.exists(wav):
            return stats
        with wave.open(wav, "rb") as w:
            n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
            raw = w.readframes(n)
        stats["duration_s"] = round(n / float(sr), 3)
        import array
        a = array.array("h")
        a.frombytes(raw)
        if ch == 2:
            a = array.array("h", [(a[i] + a[i + 1]) // 2
                                  for i in range(0, len(a) - 1, 2)])
        if len(a):
            sq = 0
            peak = 0
            for s in a:
                sq += s * s
                if abs(s) > peak:
                    peak = abs(s)
            rms = math.sqrt(sq / len(a))
            stats["rms_dbfs"] = round(20 * math.log10(max(rms, 1e-9) / 32768.0), 1)
            stats["peak_dbfs"] = round(20 * math.log10(max(peak, 1e-9) / 32768.0), 1)
    return stats


def is_valid(stats, spec):
    if stats.get("bytes", 0) < 2000:
        return False, "file too small"
    if "rms_dbfs" in stats and stats["rms_dbfs"] < -60:
        return False, "near-silent (rms %s dBFS)" % stats["rms_dbfs"]
    if "duration_s" in stats:
        want = spec["durationSeconds"]
        if stats["duration_s"] < want * 0.4:
            return False, "too short (%ss vs %ss)" % (stats["duration_s"], want)
    return True, "ok"


def suggested_volume(stats, role):
    """Rough mix suggestion off measured RMS: beds sit low, cues forward."""
    rms = stats.get("rms_dbfs")
    if rms is None:
        return 0.8
    target = -38.0 if role == "bed" else -28.0
    v = 10 ** ((target - rms) / 20.0)
    return round(max(0.3, min(1.0, v)), 2)


# --------------------------------------------------------------- scenario
def scenario_generate(auth_header, name, spec, variant, out_dir, log):
    payload = {
        "text": spec["text"],
        "durationSeconds": spec["durationSeconds"],
        "promptInfluence": spec["promptInfluence"],
        "loop": spec["loop"],
        "outputFormat": "mp3_44100_128",
    }
    r = http_json(f"{SCENARIO_BASE}/generate/custom/{SFX_MODEL}",
                  auth_header, payload)
    job_id = r["job"]["jobId"]
    log(f"  [{name} v{variant}] scenario job {job_id} submitted")
    # BOUNDED poll: at most POLL_MAX_S of wall time per job (short per-request
    # socket timeouts so one wedged HTTP call cannot blow the budget), then
    # the job is marked failed and the run moves on.
    deadline = time.time() + POLL_MAX_S
    status, job = "in-progress", None
    while time.time() < deadline:
        time.sleep(3)
        try:
            job = http_json(f"{SCENARIO_BASE}/jobs/{job_id}", auth_header,
                            timeout=30)["job"]
        except Exception as e:
            log(f"  [{name} v{variant}] poll error ({e}); retrying")
            continue
        status = job["status"]
        if status in ("success", "failure", "failed", "canceled"):
            break
    if status == "in-progress":
        raise RuntimeError(
            f"scenario job {job_id} poll timeout after {POLL_MAX_S}s")
    if status != "success":
        raise RuntimeError(f"scenario job {job_id} ended {status}")
    asset_ids = job["metadata"].get("assetIds") or []
    if not asset_ids:
        raise RuntimeError(f"scenario job {job_id} success but no assets")
    asset = http_json(f"{SCENARIO_BASE}/assets/{asset_ids[0]}",
                      auth_header).get("asset", {})
    url = asset["url"]
    fname = f"{name}_v{variant}_scenario.mp3"
    dest = os.path.join(out_dir, fname)
    download(url, dest, timeout=POLL_MAX_S)
    return {
        "filename": fname,
        "sha256": sha256_of(dest),
        "generator": "scenario",
        "model_id": SFX_MODEL,
        "prompt": spec["text"],
        "params": {k: v for k, v in payload.items() if k != "text"},
        "scenario_job_id": job_id,
        "scenario_asset_id": asset_ids[0],
        "mime": asset.get("mimeType", "audio/mpeg"),
    }


# ------------------------------------------------------------- elevenlabs
def eleven_generate(api_key, name, spec, variant, out_dir, log):
    payload = {
        "text": spec["text"],
        "duration_seconds": min(spec["durationSeconds"], 22),
        "prompt_influence": spec["promptInfluence"],
    }
    log(f"  [{name} v{variant}] elevenlabs fallback submit")
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        ELEVEN_SFX_URL, data=data,
        headers={"Content-Type": "application/json", "xi-api-key": api_key})
    fname = f"{name}_v{variant}_elevenlabs.mp3"
    dest = os.path.join(out_dir, fname)
    with urllib.request.urlopen(req, timeout=POLL_MAX_S) as r, \
            open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return {
        "filename": fname,
        "sha256": sha256_of(dest),
        "generator": "elevenlabs-fallback",
        "model_id": "sound-generation",
        "prompt": spec["text"],
        "params": {k: v for k, v in payload.items() if k != "text"},
        "mime": "audio/mpeg",
    }


# -------------------------------------------------------------------- run
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated sound names")
    ap.add_argument("--variants", type=int, default=1)
    ap.add_argument("--resume", action="store_true",
                    help="skip sounds whose curated copy already shipped")
    args = ap.parse_args()

    names = list(SOUNDS)
    if args.only:
        names = [n for n in args.only.split(",") if n in SOUNDS]

    env = load_env()
    scen_token = env.get("SCENARIO_API_TOKEN", "")
    eleven_key = env.get("ELEVEN_API_KEY", "")
    if not scen_token and not eleven_key:
        print("no API credentials found", file=sys.stderr)
        sys.exit(1)
    auth = {"Authorization": "Basic " + scen_token}

    ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    out_dir = os.path.join(RAW_ROOT, ts)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(SHIP_DIR, exist_ok=True)

    def log(msg):
        print(msg, flush=True)

    # resume-awareness: a sound whose curated copy already shipped is skipped
    # entirely (no generation, no re-curation) — a relaunch only pays for what
    # is still missing.
    if args.resume:
        shipped = [n for n in names
                   if os.path.exists(os.path.join(SHIP_DIR, n + ".mp3"))]
        for n in shipped:
            log(f"  [{n}] SKIP — already shipped ({n}.mp3)")
        names = [n for n in names if n not in shipped]

    log(f"RUN {ts} pid={os.getpid()} sounds={len(names)} "
        f"variants={args.variants} poll<={POLL_MAX_S}s resume={args.resume}")

    run = {"created_utc": ts, "lane": "ody-audio", "entries": []}
    failures = []

    for name in names:
        spec = SOUNDS[name]
        for v in range(1, args.variants + 1):
            entry = None
            err_scen = None
            if scen_token:
                try:
                    entry = scenario_generate(auth, name, spec, v, out_dir, log)
                except Exception as e:
                    err_scen = str(e)
                    log(f"  [{name} v{v}] scenario FAILED: {e}")
            if entry is None and eleven_key:
                try:
                    entry = eleven_generate(eleven_key, name, spec, v,
                                            out_dir, log)
                except Exception as e:
                    failures.append(f"{name} v{v}: scenario={err_scen} "
                                    f"eleven={e}")
                    continue
            if entry is None:
                failures.append(f"{name} v{v}: scenario={err_scen}, "
                                "no fallback key")
                continue
            path = os.path.join(out_dir, entry["filename"])
            stats = audio_stats(path)
            ok, why = is_valid(stats, spec)
            entry.update(sound=name, variant=v, stats=stats,
                         valid=ok, validity_note=why)
            run["entries"].append(entry)
            log(f"  [{name} v{v}] {entry['generator']} -> "
                f"{stats.get('duration_s','?')}s rms={stats.get('rms_dbfs','?')} "
                f"dBFS {'OK' if ok else 'REJECT: ' + why}")

    # curation: per sound prefer valid entries; pick duration closest to spec
    curated = {}
    for name in names:
        spec = SOUNDS[name]
        cands = [e for e in run["entries"] if e["sound"] == name and e["valid"]]
        if not cands:
            failures.append(f"{name}: no valid variant")
            continue
        cands.sort(key=lambda e: abs(
            e["stats"].get("duration_s", spec["durationSeconds"])
            - spec["durationSeconds"]))
        best = cands[0]
        src = os.path.join(out_dir, best["filename"])
        dst = os.path.join(SHIP_DIR, f"{name}.mp3")
        shutil.copy2(src, dst)
        best["curated_copy"] = dst
        rec = {
            "file": f"{name}.mp3",
            "sha256": best["sha256"],
            "raw_source": os.path.relpath(src, ROOT),
            "duration_s": best["stats"].get("duration_s"),
            "loop": spec["loop"],
            "rms_dbfs": best["stats"].get("rms_dbfs"),
            "peak_dbfs": best["stats"].get("peak_dbfs"),
            "suggested_volume": suggested_volume(best["stats"], spec["role"]),
            "role": spec["role"],
            "generator": best["generator"],
            "description": spec["description"],
        }
        if spec["loop"] and best["stats"].get("duration_s"):
            rec["loop_points_s"] = [0.0, best["stats"]["duration_s"]]
        curated[name] = rec

    run["failures"] = failures
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(run, f, indent=2)

    # lane-level raw-first manifest (append-safe: merge over any prior run)
    lane_path = os.path.join(RAW_ROOT, "manifest.json")
    lane = {"lane": "ody-audio", "assets": {}}
    if os.path.exists(lane_path):
        try:
            lane = json.load(open(lane_path))
        except Exception:
            pass
    lane["updated_utc"] = ts
    lane["generator"] = "scenario"
    lane["model_id"] = SFX_MODEL
    lane["note"] = ("Curated picks for site-deploy/living-odyssey/assets/"
                    "audio/ (COPIES). Immutable raws + per-run manifests in "
                    "assets/raw/ody-audio/<timestamp>/. Scenario API "
                    "(model_elevenlabs-sound-effects-v2), mp3 44100 Hz "
                    "128 kbps. Beds carry the -bed suffix per sherlock's "
                    "naming; giant-snore loops (used as the snore-bed).")
    lane.setdefault("assets", {}).update(curated)
    lane["failures"] = failures
    with open(lane_path, "w") as f:
        json.dump(lane, f, indent=2)

    # ship-dir manifest mirrors the lane manifest (sherlock ships one too)
    with open(os.path.join(SHIP_DIR, "manifest.json"), "w") as f:
        json.dump(lane, f, indent=2)

    log(f"run manifest: {os.path.join(out_dir, 'manifest.json')}")
    log(f"lane manifest: {lane_path}")
    log(f"shipped: {json.dumps(sorted(curated))}")
    if failures:
        log("FAILURES: " + "; ".join(failures))
    log("DONE")


if __name__ == "__main__":
    main()
