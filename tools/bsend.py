#!/usr/bin/env python3
"""bsend.py — send one execute_code command to the blender-mcp addon socket.

usage: python3 bsend.py <file-with-bpy-code>  (or pipe code on stdin)
Prints the JSON response. One command per connection; generous timeout.
"""
import json
import socket
import sys

code = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
payload = json.dumps({"type": "execute_code", "params": {"code": code}})

s = socket.create_connection(("localhost", 9876), timeout=10)
s.settimeout(120)
s.sendall(payload.encode())

chunks = []
while True:
    try:
        data = s.recv(65536)
    except socket.timeout:
        print(json.dumps({"status": "error", "message": "recv timeout"}))
        sys.exit(1)
    if not data:
        break
    chunks.append(data)
    try:
        resp = json.loads(b"".join(chunks))
        break
    except json.JSONDecodeError:
        continue
s.close()
out = json.dumps(resp, indent=2)
print(out[:8000])
