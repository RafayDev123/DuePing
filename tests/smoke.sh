#!/usr/bin/env bash
# Deployment smoke test: exercises the real HTTP API end to end against a running instance.
#   BASE=http://localhost:3000 bash tests/smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp)"
EMAIL="smoke-$(date +%s)@example.test"
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
post() { curl -s -b "$JAR" -c "$JAR" -H 'content-type: application/json' -X "${3:-POST}" "$BASE$1" -d "$2"; }
get() { curl -s -b "$JAR" -c "$JAR" "$BASE$1"; }
ok() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "Health"; [ "$(get /api/health | j "d['ok']")" = "True" ] && ok "/api/health" || fail health
echo "Public pages"; for p in / /features /pricing /faq /blog /help /login /signup /sitemap.xml /robots.txt /manifest.webmanifest; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p"); [ "$c" = 200 ] && ok "$p" || fail "$p -> $c"; done
echo "Auth"; [ "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/v1/invoices)" = 401 ] && ok "unauthenticated API call rejected" || fail unauth
post /api/v1/auth/signup "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\",\"businessName\":\"Smoke Co\",\"timezone\":\"UTC\"}" | j "d['ok']" | grep -q True && ok signup || fail signup
echo "Clients + invoices"
CID=$(post /api/v1/clients '{"name":"Acme Ltd","email":"acme@example.test","phone":"+14155550123"}' | j "d['data']['id']"); ok "client $CID"
TODAY=$(date +%F); DUE=$(date -d '+10 days' +%F)
INV=$(post /api/v1/invoices "{\"clientId\":\"$CID\",\"currency\":\"USD\",\"issueDate\":\"$TODAY\",\"dueDate\":\"$DUE\",\"items\":[{\"description\":\"Design\",\"quantity\":\"2\",\"unitPrice\":\"250\"}],\"discountType\":\"none\",\"taxRate\":\"0\",\"status\":\"sent\"}" | j "d['data']['id']"); ok "invoice $INV"
echo "Payments"
post /api/v1/payments "{\"invoiceId\":\"$INV\",\"amount\":\"150\",\"paidAt\":\"$TODAY\",\"method\":\"cash\"}" | j "d['data']['balanceAfter']" | grep -q '350.00' && ok "partial payment -> balance 350.00" || fail partial
post /api/v1/payments "{\"invoiceId\":\"$INV\",\"amount\":\"999\",\"paidAt\":\"$TODAY\",\"method\":\"cash\"}" | j "d['error']['code']" | grep -q overpayment && ok "overpayment rejected" || fail overpay
echo "PDF + portal"
[ "$(curl -s -b $JAR $BASE/api/v1/invoices/$INV/pdf | head -c 5)" = "%PDF-" ] && ok "invoice PDF" || fail pdf
URL=$(post /api/v1/invoices/$INV/link '{}' | j "d['data']['url']"); TOKEN="${URL##*/}"
[ "$(curl -s -o /dev/null -w '%{http_code}' $BASE/portal/$TOKEN)" = 200 ] && ok "portal link opens" || fail portal
curl -s $BASE/portal/$TOKEN | grep -q 'noindex' && ok "portal is noindex" || fail noindex
[ "$(curl -s -o /dev/null -w '%{http_code}' $BASE/portal/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA)" = 200 ] && ok "invalid token shows safe page" || fail badtoken
post /api/v1/invoices/$INV/link '' DELETE >/dev/null; curl -s $BASE/portal/$TOKEN | grep -q 'no longer active' && ok "revoked link rejected" || fail revoke
echo "Dashboard + reports"
get /api/v1/dashboard/overview | j "d['data']['outstanding'][0]['amount']" | grep -q '350.00' && ok "dashboard outstanding 350.00" || fail dash
[ "$(curl -s -b $JAR "$BASE/api/v1/reports/export?type=outstanding&format=xlsx" | head -c 2)" = "PK" ] && ok "XLSX export" || fail xlsx
echo "All smoke checks passed."
