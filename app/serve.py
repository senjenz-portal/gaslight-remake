#!/usr/bin/env python3
"""serve.py — stdlib-only dev server for the gaslight-remake app.

Serves the REPO ROOT (/Users/samz/Documents/gaslight-remake) so the app at
/app/index.html can reach ../assets/ without symlinks. No cache, ever: a
review round must never see a stale module.

Port: 8150 by default; if it is taken we walk up to 8160 and print the port
we actually got. The chosen port is written to app/.port so tools/lap.mjs
can find a server it did not start, and REMOVED again on the way out — on
Ctrl-C or on the SIGTERM lap.mjs sends its own child — because a pointer to
a socket that is gone is worse than no pointer at all.

    python3 app/serve.py [--port 8150] [--root <dir>]
"""
import argparse
import http.server
import os
import signal
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT_FILE = os.path.join(ROOT, "app", ".port")

EXTRA_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
    ".ktx2": "image/ktx2",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.0 closes the socket after every response; under seven concurrent
    # 8 MB GLB transfers Chromium reports the close as net::ERR_ABORTED even
    # though the bytes arrived. Keep-alive removes the race.
    protocol_version = "HTTP/1.1"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_TYPES:
            return EXTRA_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # harmless locally; keeps the door open for SharedArrayBuffer-based tools
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        if os.environ.get("SERVE_QUIET") == "1":
            return
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8150)
    ap.add_argument("--tries", type=int, default=11)
    args = ap.parse_args()

    # SIGTERM is how tools/lap.mjs stops a server it started, and the default
    # action would skip the cleanup below. Turn it into an ordinary exit.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    last = None
    for p in range(args.port, args.port + args.tries):
        try:
            httpd = Server(("127.0.0.1", p), Handler)
        except OSError as e:
            last = e
            continue
        try:
            with open(PORT_FILE, "w") as f:
                f.write(str(p))
        except OSError:
            pass
        # tools/lap.mjs greps stdout for this exact line
        print("PORT %d" % p, flush=True)
        print("serving %s -> http://127.0.0.1:%d/app/index.html" % (ROOT, p), flush=True)
        try:
            httpd.serve_forever()
        except (KeyboardInterrupt, SystemExit):
            print("", flush=True)
        finally:
            httpd.server_close()
            # [R7-4] the port file is a POINTER to a listening socket, so it dies
            # with the socket. Leaving it behind left a stale number inside the
            # served tree for the next lap to find and disbelieve; lap.mjs reports
            # whatever it finds here and deletes it if nothing answers.
            try:
                if os.path.exists(PORT_FILE):
                    os.remove(PORT_FILE)
            except OSError:
                pass
        return 0

    print("no free port in %d..%d (%s)" % (args.port, args.port + args.tries - 1, last),
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
