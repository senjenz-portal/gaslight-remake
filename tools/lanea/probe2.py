import json,os,sys,urllib.request,urllib.error
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
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
for mid in sys.argv[1:]:
    print("=== "+mid)
    try:
        m=get("/models/"+mid)["model"]
    except urllib.error.HTTPError as e:
        print("HTTP",e.code,e.read()[:400]); continue
    print("caps:",m.get("capabilities"))
    for i in m.get("inputs",[]):
        print(" -",i.get("name"),"|",i.get("type"),i.get("kind",""),"| def=",i.get("default"),
              "| allowed=",str(i.get("allowedValues"))[:100],
              "|",(str(i.get("description")) or "").replace("\n"," ")[:120])
