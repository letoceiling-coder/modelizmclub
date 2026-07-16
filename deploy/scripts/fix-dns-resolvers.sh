#!/usr/bin/env bash
# Harden DNS resolution on the VPS. The provider's resolver (198.18.18.18)
# intermittently fails to resolve public hosts (e.g. api.yookassa.ru), which
# broke payment calls with "cURL error 6: Could not resolve host". Add reliable
# public resolvers with fast failover; keep the provider resolver as a fallback.
set -euo pipefail

RC=/etc/resolv.conf
STAMP=$(date +%Y%m%d-%H%M%S)

if [[ ! -f "${RC}.bak-orig" ]]; then
  cp -a "$RC" "${RC}.bak-orig"
fi
cp -a "$RC" "${RC}.bak-${STAMP}"

cat > "$RC" <<'EOF'
# Managed manually (see deploy/scripts/fix-dns-resolvers.sh).
# Public resolvers first for reliable external lookups; the provider resolver
# is kept last as a fallback for any internal names.
nameserver 8.8.8.8
nameserver 1.1.1.1
nameserver 198.18.18.18
options timeout:2 attempts:2 single-request-reopen
EOF

echo "==> new /etc/resolv.conf:"
cat "$RC"

echo "==> verify resolution (8 tries):"
ok=0
for i in $(seq 1 8); do
  if getent hosts api.yookassa.ru >/dev/null 2>&1; then ok=$((ok+1)); fi
done
echo "resolved ${ok}/8"

echo "==> curl api.yookassa.ru:"
curl -sS -o /dev/null -w 'http=%{http_code} namelookup=%{time_namelookup}s\n' --max-time 15 https://api.yookassa.ru/v3/payments || echo "curl failed"
