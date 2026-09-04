#!/usr/bin/env bash
set -euo pipefail

echo "========== VERIFY CALLS / TURN / LIVEKIT =========="
echo "Date: $(date -Iseconds)"
echo "Host: $(hostname -f)"
echo "Public IP: $(curl -s --max-time 5 https://api.ipify.org || echo unknown)"
echo ""

echo "--- DNS ---"
for h in turn.modelizmclub.ru livekit.modelizmclub.ru ws.modelizmclub.ru api.modelizmclub.ru; do
  echo "  $h -> $(dig +short "$h" | head -1)"
done
echo ""

echo "--- Services ---"
for s in coturn livekit modelizmclub-reverb nginx php8.3-fpm; do
  printf "  %-24s %s\n" "$s" "$(systemctl is-active "$s" 2>/dev/null || echo inactive)"
done
echo ""

echo "--- Listening ports ---"
ss -tlnup | grep -E '3478|5349|7880|7881|7882|8080' || true
echo ""

echo "--- coturn config (key lines) ---"
grep -E '^(listening-port|tls-listening|min-port|max-port|relay-ip|external-ip|realm|server-name)' /etc/turnserver.conf
echo ""

echo "--- TLS cert turn.modelizmclub.ru:5349 ---"
echo | timeout 5 openssl s_client -connect turn.modelizmclub.ru:5349 -servername turn.modelizmclub.ru 2>/dev/null \
  | openssl x509 -noout -dates -subject 2>/dev/null || echo "TLS check failed"
echo ""

echo "--- STUN test ---"
turnutils_stunclient turn.modelizmclub.ru 2>&1 | tail -6
echo ""

echo "--- TURN test (ephemeral creds) ---"
SECRET=$(grep '^static-auth-secret=' /etc/turnserver.conf | cut -d= -f2-)
TTL=3600
U="$(($(date +%s)+TTL)):verify"
C=$(printf '%s' "$U" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)
turnutils_uclient -y -u "$U" -w "$C" turn.modelizmclub.ru 2>&1 | tail -6
echo ""

echo "--- LiveKit / WS HTTP ---"
curl -sS -o /dev/null -w "  livekit HTTPS: %{http_code}\n" https://livekit.modelizmclub.ru/
curl -sS -o /dev/null -w "  ws HTTPS:      %{http_code}\n" https://ws.modelizmclub.ru/
echo ""

echo "--- Laravel CALLS_* env ---"
grep -E '^CALLS_' /var/www/modelizmclub/backend/.env | sed 's/SECRET=.*/SECRET=***/'
echo ""

echo "--- TURN log: real sessions with relay traffic (rp>100) ---"
grep 'peer usage' /var/log/turnserver/turnserver.log 2>/dev/null \
  | grep -v 'rp=0' | grep -v 'rp=5,' | grep -v 'rp=13,' | tail -15 || echo "(none recent)"
echo ""

echo "--- TURN log: config warnings ---"
grep 'Bad configuration' /var/log/turnserver/turnserver.log 2>/dev/null | sort -u | head -5 || true
echo ""

echo "--- call_logs (last 15) ---"
PGPASSWORD=$(grep '^DB_PASSWORD=' /var/www/modelizmclub/backend/.env | cut -d= -f2-) \
psql -h 127.0.0.1 -U modelizmclub -d modelizmclub -t -A -F'|' \
  -c "SELECT id,status,duration_seconds,started_at::date FROM call_logs ORDER BY started_at DESC LIMIT 15;" 2>/dev/null || echo "DB query failed"
echo ""

echo "--- client_logs: ice pairs ever ---"
PGPASSWORD=$(grep '^DB_PASSWORD=' /var/www/modelizmclub/backend/.env | cut -d= -f2-) \
psql -h 127.0.0.1 -U modelizmclub -d modelizmclub -t \
  -c "SELECT count(*) FROM client_logs WHERE message LIKE 'ice pair%';" 2>/dev/null || echo "?"
echo ""

echo "--- External UDP relay port sample (50000) ---"
timeout 2 nc -u -l -p 50000 &
NCPID=$!
sleep 0.5
echo "test" | nc -u -w1 127.0.0.1 50000 && echo "  localhost UDP 50000: OK" || echo "  localhost UDP 50000: FAIL"
kill $NCPID 2>/dev/null || true

echo ""
echo "========== DONE =========="
