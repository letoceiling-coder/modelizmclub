#!/usr/bin/env bash
# Post-deploy smoke for the prod-release batch. Read-only-ish: creates a couple
# of throwaway feed posts and toggles feature.feed_auto_publish (restored at end).
# Does NOT complete a real payment — only generates the YooKassa checkout URL.
set -u

API="https://dev.modelizmclub.ru/api/v1"
FRONT="https://modelizmclub.ru"
PASS="password123"

pv() { python3 -c 'import sys,json,functools;
d=json.load(sys.stdin)
path=sys.argv[1].split(".") if len(sys.argv)>1 and sys.argv[1] else []
cur=d
for p in path:
    if p=="": continue
    if isinstance(cur,list): cur=cur[int(p)]
    else: cur=cur.get(p)
    if cur is None: break
print("" if cur is None else (cur if isinstance(cur,str) else json.dumps(cur,ensure_ascii=False)))' "$1" 2>/dev/null; }

first_cat_id() { python3 -c 'import sys,json
d=json.load(sys.stdin).get("data",[])
def walk(n):
    if isinstance(n,list):
        for x in n:
            r=walk(x)
            if r: return r
    elif isinstance(n,dict):
        if "id" in n: return n["id"]
    return None
print(walk(d) or "")' 2>/dev/null; }

echo "================= SMOKE: prod-release ================="

echo "--- 1) Health + feature-flags"
curl -fsS --max-time 20 "$API/health" && echo
curl -fsS --max-time 20 "$API/public/feature-flags" && echo

echo "--- 2) Auth (demo + admin)"
DEMO_TOKEN=$(curl -fsS --max-time 25 -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"demo@modelizmclub.ru\",\"password\":\"$PASS\"}" | pv meta.token)
ADMIN_TOKEN=$(curl -fsS --max-time 25 -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@modelizmclub.ru\",\"password\":\"$PASS\"}" | pv meta.token)
echo "demo token: ${DEMO_TOKEN:0:12}...  admin token: ${ADMIN_TOKEN:0:12}..."
[ -n "$DEMO_TOKEN" ] && [ -n "$ADMIN_TOKEN" ] || { echo "!! login failed"; }

# Use a category id from an existing published post (guaranteed to exist in
# post_categories), falling back to the category tree.
CAT=$(curl -fsS --max-time 20 "$API/feed" | pv data.0.category.id)
[ -n "$CAT" ] || CAT=$(curl -fsS --max-time 20 "$API/categories/posts" | first_cat_id)
echo "post category id: $CAT"

AJ='Accept: application/json'

echo "--- 3) Feed default = MODERATION (expect pending_moderation)"
U1=$(curl -fsS --max-time 25 -X POST "$API/posts" -H "$AJ" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"SMOKE moderation\",\"body\":\"smoke default\",\"category_id\":$CAT}" | pv data.uuid)
S1=$(curl -fsS --max-time 25 -X POST "$API/posts/$U1/publish" -H "$AJ" -H "Authorization: Bearer $DEMO_TOKEN" | pv data.status)
echo "post1 status (default): $S1   [expect pending_moderation]"

echo "--- 4) Admin toggle feed_auto_publish=ON -> expect published"
curl -fsS --max-time 25 -X PATCH "$API/admin/settings" -H "$AJ" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"settings":[{"key":"feature.feed_auto_publish","value":{"enabled":true},"group":"feed"}]}' >/dev/null && echo "toggled ON"
U2=$(curl -fsS --max-time 25 -X POST "$API/posts" -H "$AJ" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"SMOKE autopublish\",\"body\":\"smoke on\",\"category_id\":$CAT}" | pv data.uuid)
S2=$(curl -fsS --max-time 25 -X POST "$API/posts/$U2/publish" -H "$AJ" -H "Authorization: Bearer $DEMO_TOKEN" | pv data.status)
echo "post2 status (auto ON): $S2   [expect published]"

echo "--- 5) Restore feed_auto_publish=OFF (moderation default)"
curl -fsS --max-time 25 -X PATCH "$API/admin/settings" -H "$AJ" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"settings":[{"key":"feature.feed_auto_publish","value":{"enabled":false},"group":"feed"}]}' >/dev/null && echo "toggled OFF"
CHECK=$(curl -fsS --max-time 20 "$API/admin/settings" -H "$AJ" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c 'import sys,json
for s in json.load(sys.stdin).get("data",[]):
    if s.get("key")=="feature.feed_auto_publish": print(json.dumps(s.get("value")))' 2>/dev/null)
echo "feed_auto_publish now: $CHECK   [expect {\"enabled\": false}]"

echo "--- 6) Billing YooKassa checkout (URL only, NO real payment)"
PLAN=$(curl -fsS --max-time 20 "$API/plans" | python3 -c 'import sys,json
d=json.load(sys.stdin).get("data",[])
paid=[p for p in d if (p.get("price_cents") or 0)>0]
print((paid[0] if paid else d[0])["slug"] if d else "")' 2>/dev/null)
echo "plan: $PLAN"
PAY=$(curl -sS --max-time 30 -X POST "$API/payments" -H "$AJ" -H "Authorization: Bearer $DEMO_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"plan_slug\":\"$PLAN\"}")
echo "provider: $(echo "$PAY" | pv data.provider)"
echo "checkout_url: $(echo "$PAY" | pv data.checkout_url)"
echo "(!) Real test payment must be completed manually at the checkout URL above."

echo "--- 7) Delivery live keys (CDEK cities lookup)"
curl -fsS --max-time 25 "$API/delivery/cdek/cities?query=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0" \
  | head -c 400; echo

echo "--- 8) OAuth buttons removed from /login (expect 0)"
curl -fsS --max-time 25 "$FRONT/login" -o /tmp/smoke-login.html
echo "count 'Яндекс': $(grep -c -F 'Яндекс' /tmp/smoke-login.html)"
echo "count 'startOAuthLogin': $(grep -c -F 'startOAuthLogin' /tmp/smoke-login.html)"
echo "login http: $(curl -fsS --max-time 20 -o /dev/null -w '%{http_code}' $FRONT/login)"

echo "================= SMOKE DONE ================="
