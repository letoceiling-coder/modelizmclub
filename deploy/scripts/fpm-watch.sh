#!/usr/bin/env bash
# Records the PHP-FPM pool counters and shouts when the pool hits its ceiling.
#
# On 04.09 the pool ran on five workers and answered 503 to a normal page load.
# Nothing recorded it: nginx logged the code without saying it came from the
# upstream, and FPM's own counter — the one that says how many times the pool
# ran out of workers — was not exposed at all. This closes both halves: the
# counters land in a log every five minutes, and a rise in "max children
# reached" is worth waking someone for, because it means requests were refused.
#
# Config lives in /etc/fpm-watch.conf (optional):
#   FPM_ALERT_MAX_USER_ID=<MAX user id to notify>
#   FPM_STATUS_URL=http://127.0.0.1:8081/fpm-status
set -uo pipefail

CONF=/etc/fpm-watch.conf
[[ -f "${CONF}" ]] && . "${CONF}"

STATUS_URL="${FPM_STATUS_URL:-http://127.0.0.1:8081/fpm-status}"
LOG="${FPM_WATCH_LOG:-/var/log/fpm-watch.log}"
STATE="${FPM_WATCH_STATE:-/var/lib/fpm-watch.state}"
ENV_FILE="${FPM_ENV_FILE:-/var/www/modelizmclub/backend/.env}"

body="$(curl -s --max-time 5 "${STATUS_URL}" 2>/dev/null)"
if [[ -z "${body}" ]]; then
  printf '%s status unreachable at %s\n' "$(date -Iseconds)" "${STATUS_URL}" >> "${LOG}"
  exit 1
fi

field() { echo "${body}" | grep -E "^$1:" | head -1 | sed 's/^[^:]*: *//' | tr -d ' '; }

ACTIVE="$(field 'active processes')"
TOTAL="$(field 'total processes')"
MAXACTIVE="$(field 'max active processes')"
QUEUE="$(field 'listen queue')"
MAXQUEUE="$(field 'max listen queue')"
REACHED="$(field 'max children reached')"
SLOW="$(field 'slow requests')"
ACCEPTED="$(field 'accepted conn')"

printf '%s active=%s total=%s max_active=%s queue=%s max_queue=%s reached=%s slow=%s accepted=%s\n' \
  "$(date -Iseconds)" "${ACTIVE}" "${TOTAL}" "${MAXACTIVE}" "${QUEUE}" "${MAXQUEUE}" "${REACHED}" "${SLOW}" "${ACCEPTED}" \
  >> "${LOG}"

# --- alerting -----------------------------------------------------------------
prev_reached=0
prev_slow=0
[[ -f "${STATE}" ]] && . "${STATE}"

# A reload restarts the master and zeroes the counters. A counter that went
# down is a restart, not a recovery: rebase and stay quiet.
if [[ "${REACHED}" -lt "${prev_reached}" || "${SLOW}" -lt "${prev_slow}" ]]; then
  printf 'prev_reached=%s\nprev_slow=%s\n' "${REACHED}" "${SLOW}" > "${STATE}"
  exit 0
fi

alert=""
if [[ "${REACHED}" -gt "${prev_reached}" ]]; then
  alert="PHP-FPM упёрся в потолок воркеров: max children reached ${prev_reached} → ${REACHED}. Часть запросов получила 503. Пул www, pm.max_children=$(grep -E '^pm.max_children' /etc/php/8.3/fpm/pool.d/www.conf | tr -d ' ' | cut -d= -f2)."
elif [[ "${MAXQUEUE}" -gt 0 ]]; then
  alert="PHP-FPM: очередь ожидания дошла до ${MAXQUEUE}. Воркеров не хватает под пик, до отказов один шаг."
elif [[ "${SLOW}" -gt "${prev_slow}" ]]; then
  alert="PHP-FPM: медленных запросов ${prev_slow} → ${SLOW}. Трассировки в /var/log/php8.3-fpm-slow.log."
fi

printf 'prev_reached=%s\nprev_slow=%s\n' "${REACHED}" "${SLOW}" > "${STATE}"

[[ -z "${alert}" ]] && exit 0

printf '%s ALERT %s\n' "$(date -Iseconds)" "${alert}" >> "${LOG}"

if [[ -z "${FPM_ALERT_MAX_USER_ID:-}" ]]; then
  printf '%s alert not sent: FPM_ALERT_MAX_USER_ID is not set in %s\n' "$(date -Iseconds)" "${CONF}" >> "${LOG}"
  exit 0
fi

envval() { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs; }
TOKEN="$(envval MAX_BOT_TOKEN)"
API="$(envval MAX_API_BASE)"
API="${API:-https://platform-api2.max.ru}"

if [[ -z "${TOKEN}" ]]; then
  printf '%s alert not sent: MAX_BOT_TOKEN missing in %s\n' "$(date -Iseconds)" "${ENV_FILE}" >> "${LOG}"
  exit 0
fi

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 \
  -X POST "${API%/}/messages?user_id=${FPM_ALERT_MAX_USER_ID}" \
  -H "Authorization: ${TOKEN}" \
  -H 'Content-Type: application/json' \
  --data "$(printf '{"text":%s}' "$(printf '%s' "${alert}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" 2>/dev/null)"

printf '%s alert sent to MAX, http %s\n' "$(date -Iseconds)" "${code}" >> "${LOG}"
