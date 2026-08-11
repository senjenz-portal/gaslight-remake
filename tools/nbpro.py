#!/usr/bin/env python3
"""nbpro.py — NB PRO image lane tool (Gemini image REST, stdlib only).

One generateContent call per invocation: prompt in, PNG out. Tries the model
chain in order (pro -> nano-banana-pro-preview -> flash) and falls through on
any HTTP error, quota, or empty-image response. Reads GEMINI_API_KEY from the
environment; the key value is never printed or written anywhere.

Raw-first discipline: if --manifest is given, an entry (filename, sha256,
generator, model id, full prompt, params) is appended to that manifest.json
after the PNG is written.

Usage:
    python3 nbpro.py --prompt "..." --out /abs/path/img.png [--manifest /abs/path/manifest.json]
Exit 0 on success (prints a one-line JSON result), 1 if every model failed.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

MODEL_CHAIN = [
    'gemini-3-pro-image',
    'nano-banana-pro-preview',
    'gemini-3.1-flash-image',
]

GENERATION_CONFIG = {'responseModalities': ['TEXT', 'IMAGE']}


def call_model(model_id, prompt, key, timeout=300):
    """One generateContent call; returns (mime, bytes) of first image or raises.
    NOTE: gemini-3-pro-image has been observed returning image/jpeg — the
    bytes are written verbatim (raw-first), so check the manifest's
    delivered_mime before assuming the .png extension is truthful."""
    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': GENERATION_CONFIG,
    }).encode()
    req = urllib.request.Request(
        'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent'
        % model_id,
        data=body, method='POST',
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        resp = json.load(r)
    for cand in resp.get('candidates', []):
        for part in cand.get('content', {}).get('parts', []):
            blob = part.get('inlineData') or part.get('inline_data')
            if blob and blob.get('data'):
                return (blob.get('mimeType', 'image/png'),
                        base64.b64decode(blob['data']))
    raise RuntimeError('no image in response')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompt', required=True, help='full image prompt')
    ap.add_argument('--out', required=True, help='absolute output PNG path')
    ap.add_argument('--manifest', default=None,
                    help='manifest.json to append the result entry to')
    ap.add_argument('--models', default=','.join(MODEL_CHAIN),
                    help='comma-separated model-id fallback chain')
    a = ap.parse_args()

    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        sys.exit('GEMINI_API_KEY not in environment')

    errors = []
    data = None
    used = None
    mime = None
    for model_id in [m.strip() for m in a.models.split(',') if m.strip()]:
        try:
            mime, data = call_model(model_id, a.prompt, key)
            used = model_id
            break
        except urllib.error.HTTPError as e:
            detail = ''
            try:
                detail = e.read().decode(errors='replace')[:200]
            except Exception:
                pass
            errors.append({'model': model_id,
                           'error': 'HTTP %s: %s' % (e.code, detail)})
        except Exception as e:
            errors.append({'model': model_id, 'error': str(e)[:200]})

    if data is None:
        print(json.dumps({'ok': False, 'errors': errors}))
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'wb') as f:
        f.write(data)

    entry = {
        'filename': os.path.basename(a.out),
        'sha256': hashlib.sha256(data).hexdigest(),
        'bytes': len(data),
        'generator': 'nbpro.py (gaslight-remake NB PRO lane)',
        'model_id': used,
        'delivered_mime': mime,
        'prompt': a.prompt,
        'params': {'generationConfig': GENERATION_CONFIG,
                   'endpoint': 'v1beta generateContent',
                   'model_chain': a.models},
        'fallback_errors': errors,
        'generated_at': dt.datetime.now().isoformat(timespec='seconds'),
    }
    if a.manifest:
        manifest = {'lane': 'nbpro', 'entries': []}
        if os.path.exists(a.manifest):
            with open(a.manifest) as f:
                manifest = json.load(f)
        manifest.setdefault('entries', []).append(entry)
        with open(a.manifest, 'w') as f:
            json.dump(manifest, f, indent=1)

    print(json.dumps({'ok': True, 'out': a.out, 'model_id': used,
                      'bytes': len(data), 'sha256': entry['sha256'],
                      'fallbacks': [e['model'] for e in errors]}))


if __name__ == '__main__':
    main()
