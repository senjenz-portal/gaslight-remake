#!/usr/bin/env python3
"""audiogen.py — gaslight-remake AUDIO lane generator.

Generates the Beat I sound set through the Scenario API's ElevenLabs audio
models (model_elevenlabs-sound-effects-v2), with a direct ElevenLabs
sound-generation fallback for anything Scenario fails on.

Pipeline per sound:
  POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}
  poll  GET /v1/jobs/{jobId} until status success/failure
  GET   /v1/assets/{assetId}  -> signed CDN url -> download mp3
Raw files + manifest.json land in assets/raw/audio/<UTC timestamp>/.
Curated picks are COPIES into assets/audio/.

stdlib only. Secrets are read from the story-orbit .env by parsing the file
directly (the file has a multi-line JSON value that breaks shell `source`);
values are never printed.

Usage:
  python3 audiogen.py            # generate all sounds, 2 variants each
  python3 audiogen.py --only door-knock,page-turn
  python3 audiogen.py --variants 1
"""

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import wave

ENV_PATH = "/Users/samz/Documents/story-orbit/.env"
ROOT = "/Users/samz/Documents/gaslight-remake"
RAW_ROOT = os.path.join(ROOT, "assets", "raw", "audio")
CURATED_DIR = os.path.join(ROOT, "assets", "audio")
SCENARIO_BASE = "https://api.cloud.scenario.com/v1"
SFX_MODEL = "model_elevenlabs-sound-effects-v2"
ELEVEN_SFX_URL = "https://api.elevenlabs.io/v1/sound-generation"

# ---------------------------------------------------------------- target set
# name -> spec. `loop` uses ElevenLabs' seamless-loop generation mode.
SOUNDS = {
    "room-bed": {
        "text": ("close crackling fireplace, clearly audible wood fire "
                 "crackle and pops in the foreground, faint slow mantel "
                 "clock ticking behind it, cozy Victorian sitting room at "
                 "night, no voices, no music, seamless ambient loop"),
        "durationSeconds": 25,
        "promptInfluence": 0.5,
        "loop": True,
    },
    "street-bed": {
        "text": ("distant London night street ambience heard from indoors, "
                 "low wind gusts, faint occasional horse-drawn carriage "
                 "passing on cobblestones far away, sparse quiet city murmur, "
                 "no voices, no music, seamless ambient loop"),
        "durationSeconds": 25,
        "promptInfluence": 0.4,
        "loop": True,
    },
    "page-turn": {
        "text": ("single page turn of one heavy thick paper page in a large "
                 "old book, close perspective, dry stiff paper, one motion, "
                 "no other sounds"),
        "durationSeconds": 1.5,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "paper-rustle": {
        "text": ("unfolding a letter, crisp old paper rustle and handling, "
                 "short, close perspective, no other sounds"),
        "durationSeconds": 1.5,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "hoofbeats": {
        "text": ("horse-drawn carriage approaching on a cobblestone street, "
                 "horse hoofbeats and wooden wheels getting gradually closer, "
                 "then slowing down and coming to a stop, night street, "
                 "no voices"),
        "durationSeconds": 8,
        "promptInfluence": 0.55,
        "loop": False,
    },
    "door-knock": {
        "text": ("exactly three firm knocks on a heavy wooden door, knuckles "
                 "on thick oak, evenly spaced, no other sounds"),
        "durationSeconds": 2,
        "promptInfluence": 0.65,
        "loop": False,
    },
    "click-soft": {
        "text": ("single very short soft fingertip tap on paper, subtle "
                 "quiet muted tick, one tap only, extremely brief"),
        "durationSeconds": 0.5,
        "promptInfluence": 0.65,
        "loop": False,
    },
    "step": {
        "text": ("exactly two slow heavy boot footsteps climbing wooden "
                 "stairs, a large heavy man, old wood creaking under each "
                 "step, close perspective, no other sounds"),
        "durationSeconds": 2,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "reveal": {
        "text": ("soft airy shimmer of warm light passing through thin "
                 "paper, gentle breathy glowing texture swelling briefly, "
                 "very subtle and quiet, non-musical, no melody, no chime, "
                 "no other sounds"),
        "durationSeconds": 1,
        "promptInfluence": 0.5,
        "loop": False,
    },
    "book": {
        "text": ("a heavy old hardcover book pulled out from a wooden "
                 "bookshelf and opened, leather cover sliding then a soft "
                 "thump and stiff pages falling open, close perspective, "
                 "no other sounds"),
        "durationSeconds": 1.5,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "mask-drop": {
        "text": ("a small hard lacquered wooden object dropped onto a "
                 "wooden floor, one short clatter and quick settle, close "
                 "perspective, no other sounds"),
        "durationSeconds": 0.5,
        "promptInfluence": 0.65,
        "loop": False,
    },

    # ------------------------------------------------------------------
    # BEATS II-VII (CONTENT-full.md sec 6.5 "Sfx and beds" + 7.2 GAP #14).
    # Every clip below is named by the ledger; nothing here is invented, and
    # `letter` is deliberately absent because the ledger says reuse
    # paper-rustle. Two beds (chase, church) and nine cues.
    # ------------------------------------------------------------------
    "chase-bed": {
        "text": ("empty London night road ambience, low wind along a stone "
                 "street canyon, very distant carriage wheels and hooves far "
                 "off in the fog, sparse and quiet, no voices, no music, "
                 "seamless ambient loop"),
        "durationSeconds": 25,
        "promptInfluence": 0.4,
        "loop": True,
    },
    "church-bed": {
        "text": ("interior of a large empty stone church at midday, still "
                 "cold air, faint reverberant room tone, a very distant "
                 "muffled street outside, no voices, no music, no organ, "
                 "seamless ambient loop"),
        "durationSeconds": 25,
        "promptInfluence": 0.4,
        "loop": True,
    },
    "bell": {
        "text": ("a single church bell struck once in a stone tower, heard "
                 "from the street below, long natural decay, no other "
                 "sounds"),
        "durationSeconds": 4,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "watch": {
        "text": ("a gold pocket watch pulled from a waistcoat pocket, fine "
                 "chain rattling, then the case lid springing open with a "
                 "small metallic click, close perspective, no other sounds"),
        "durationSeconds": 2,
        "promptInfluence": 0.65,
        "loop": False,
    },
    "whip": {
        "text": ("a single sharp coachman's whip crack outdoors at night, "
                 "one crack only, short echo, no other sounds"),
        "durationSeconds": 1.5,
        "promptInfluence": 0.65,
        "loop": False,
    },
    "wheels": {
        "text": ("a horse-drawn four-wheeler cab travelling at a steady fast "
                 "trot on cobblestones, continuous hooves and iron-rimmed "
                 "wooden wheels rumbling, heard from inside the cab, no "
                 "voices, no music, seamless loop"),
        "durationSeconds": 12,
        "promptInfluence": 0.5,
        "loop": True,
    },
    "rocket": {
        "text": ("a plumber's smoke rocket igniting and hissing, a short "
                 "fizzing whoosh through the air then a soft muffled pop and "
                 "billowing smoke, close perspective, no voices, no "
                 "explosion"),
        "durationSeconds": 3,
        "promptInfluence": 0.6,
        "loop": False,
    },
    "cry-fire": {
        "text": ("a small Victorian street crowd raising a sudden alarm at "
                 "night, several men and women shouting in panic outdoors, "
                 "urgent overlapping shouts, heard from across the street, "
                 "no music"),
        "durationSeconds": 4,
        "promptInfluence": 0.5,
        "loop": False,
    },
    "disperse": {
        "text": ("a small crowd of people losing interest and walking away "
                 "on a wet cobbled street at night, murmuring voices fading, "
                 "scattered footsteps receding into the distance, no music"),
        "durationSeconds": 5,
        "promptInfluence": 0.5,
        "loop": False,
    },
    "window-open": {
        "text": ("a heavy wooden sash window thrown open in a hurry, wood "
                 "sliding hard in its frame and glass rattling once, close "
                 "perspective, no other sounds"),
        "durationSeconds": 2,
        "promptInfluence": 0.65,
        "loop": False,
    },
    "glass": {
        "text": ("fine dry sand running steadily through a small glass "
                 "hourglass, very close perspective, quiet continuous "
                 "trickle, no other sounds"),
        "durationSeconds": 4,
        "promptInfluence": 0.6,
        "loop": False,
    },
}


# ------------------------------------------------------------------- helpers
def load_env(path=ENV_PATH):
    """Parse KEY=VALUE lines; tolerate the multi-line JSON value that breaks
    `source`. Never prints values."""
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
    """Return {duration_s, rms_dbfs, peak_dbfs} decoding via afconvert
    (macOS builtin) -> wav -> stdlib wave. Falls back to size-only."""
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
        # int16 mono-mix RMS/peak without external deps
        import array
        a = array.array("h")
        a.frombytes(raw)
        if ch == 2:
            a = array.array("h", [(a[i] + a[i + 1]) // 2
                                  for i in range(0, len(a) - 1, 2)])
        if len(a):
            import math
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


# ------------------------------------------------------------------ scenario
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
    deadline = time.time() + 300
    status, job = "in-progress", None
    while time.time() < deadline:
        time.sleep(3)
        job = http_json(f"{SCENARIO_BASE}/jobs/{job_id}", auth_header)["job"]
        status = job["status"]
        if status in ("success", "failure", "failed", "canceled"):
            break
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
    download(url, dest)
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


# ---------------------------------------------------------------- elevenlabs
def eleven_generate(api_key, name, spec, variant, out_dir, log):
    payload = {
        "text": spec["text"],
        "duration_seconds": spec["durationSeconds"],
        "prompt_influence": spec["promptInfluence"],
    }
    log(f"  [{name} v{variant}] elevenlabs fallback submit")
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        ELEVEN_SFX_URL, data=data,
        headers={"Content-Type": "application/json", "xi-api-key": api_key})
    fname = f"{name}_v{variant}_elevenlabs.mp3"
    dest = os.path.join(out_dir, fname)
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
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


# ----------------------------------------------------------------------- run
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated sound names")
    ap.add_argument("--variants", type=int, default=2)
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
    os.makedirs(CURATED_DIR, exist_ok=True)

    def log(msg):
        print(msg, flush=True)

    manifest = {"created_utc": ts, "lane": "audio", "entries": []}
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
            entry["sound"] = name
            entry["variant"] = v
            entry["stats"] = stats
            entry["valid"] = ok
            entry["validity_note"] = why
            manifest["entries"].append(entry)
            log(f"  [{name} v{v}] {entry['generator']} -> "
                f"{stats.get('duration_s','?')}s rms={stats.get('rms_dbfs','?')} "
                f"dBFS {'OK' if ok else 'REJECT: ' + why}")

    # curation: per sound, prefer valid entries; pick duration closest to spec
    picks = {}
    for name in names:
        spec = SOUNDS[name]
        cands = [e for e in manifest["entries"]
                 if e["sound"] == name and e["valid"]]
        if not cands:
            failures.append(f"{name}: no valid variant")
            continue
        cands.sort(key=lambda e: abs(
            e["stats"].get("duration_s", spec["durationSeconds"])
            - spec["durationSeconds"]))
        best = cands[0]
        src = os.path.join(out_dir, best["filename"])
        dst = os.path.join(CURATED_DIR, f"{name}.mp3")
        shutil.copy2(src, dst)
        best["curated_copy"] = dst
        picks[name] = best["filename"]

    manifest["curated_picks"] = picks
    manifest["failures"] = failures
    mpath = os.path.join(out_dir, "manifest.json")
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
    log(f"manifest: {mpath}")
    log(f"picks: {json.dumps(picks)}")
    if failures:
        log("FAILURES: " + "; ".join(failures))


if __name__ == "__main__":
    main()
