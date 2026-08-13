import json, os, sys, urllib.request, urllib.error
API="https://api.cloud.scenario.com/v1"
def token():
    tok=os.environ.get("SCENARIO_API_TOKEN")
    if not tok:
        for line in open("/Users/samz/Documents/story-orbit/.env"):
            line=line.strip()
            if line.startswith("SCENARIO_API_TOKEN="):
                tok=line.split("=",1)[1].strip().strip('"').strip("'"); break
    return tok
def get(path):
    req=urllib.request.Request(API+path, method="GET")
    req.add_header("Authorization","Basic "+token())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_httperror": e.code, "body": e.read()[:2000].decode(errors="replace")}
for mid in sys.argv[1:]:
    print("=== "+mid)
    print(json.dumps(get("/models/"+mid), indent=1)[:6000])
