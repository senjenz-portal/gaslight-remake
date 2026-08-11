#!/usr/bin/env python3
"""nbpro_edit.py — NB PRO image-to-image EDIT tool (Gemini image REST, stdlib only).

Like nbpro.py but sends an INPUT IMAGE + instruction (contents parts:
[inlineData image, text]) so the model edits the given picture instead of
generating from scratch. Tries the model chain in order and falls through on
any HTTP error, quota, or empty-image response.

Auth: GEMINI_API_KEY from the environment, else parsed line-by-line from the
story-orbit .env IN PYTHON (that file has a zsh parse error mid-file — never
shell-source it). The key value is never printed or written anywhere.

Raw-first discipline: if --manifest is given, an entry (filename, sha256,
input image path+sha256, generator, model id, full instruction, params) is
appended to that manifest.json after the image is written. NOTE:
gemini-3-pro-image has been observed returning image/jpeg — bytes are written
verbatim (raw-first); check delivered_mime before trusting the extension.

Usage:
    python3 nbpro_edit.py --image /abs/in.png --prompt "..." --out /abs/out.png
                          [--manifest /abs/manifest.json]
Exit 0 on success (prints one-line JSON), 1 if every model failed.
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

ENV_FILE_DEFAULT = '/Users/samz/Documents/story-orbit/.env'


def _key():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        envfile = os.environ.get('GEMINI_ENV_FILE', ENV_FILE_DEFAULT)
        try:
            for line in open(envfile):
                line = line.strip()
                if line.startswith('GEMINI_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
        except OSError:
            pass
    if not key:
        sys.exit('GEMINI_API_KEY not found (env or env-file)')
    return key


def _sniff_mime(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if data[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return 'image/png'


def call_model(model_id, image_bytes, image_mime, prompt, key, timeout=300):
    """One generateContent call with [image, text] parts; returns (mime, bytes)."""
    body = json.dumps({
        'contents': [{'parts': [
            {'inlineData': {'mimeType': image_mime,
                            'data': base64.b64encode(image_bytes).decode()}},
            {'text': prompt},
        ]}],
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
    ap.add_argument('--image', required=True, help='absolute input image path')
    ap.add_argument('--prompt', required=True, help='full edit instruction')
    ap.add_argument('--out', required=True, help='absolute output image path')
    ap.add_argument('--manifest', default=None,
                    help='manifest.json to append the result entry to')
    ap.add_argument('--models', default=','.join(MODEL_CHAIN),
                    help='comma-separated model-id fallback chain')
    a = ap.parse_args()

    key = _key()
    with open(a.image, 'rb') as f:
        image_bytes = f.read()
    image_mime = _sniff_mime(image_bytes)
    image_sha = hashlib.sha256(image_bytes).hexdigest()

    errors = []
    data = None
    used = None
    mime = None
    for model_id in [m.strip() for m in a.models.split(',') if m.strip()]:
        try:
            mime, data = call_model(model_id, image_bytes, image_mime,
                                    a.prompt, key)
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
        'generator': 'nbpro_edit.py (gaslight-remake NB PRO i2i lane)',
        'model_id': used,
        'delivered_mime': mime,
        'input_image': os.path.abspath(a.image),
        'input_image_sha256': image_sha,
        'input_image_mime': image_mime,
        'prompt': a.prompt,
        'params': {'generationConfig': GENERATION_CONFIG,
                   'endpoint': 'v1beta generateContent',
                   'contents': '[inlineData image, text instruction]',
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
                      'delivered_mime': mime,
                      'fallbacks': [e['model'] for e in errors]}))


if __name__ == '__main__':
    main()
