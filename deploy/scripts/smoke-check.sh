#!/usr/bin/env bash
# Post-deploy smoke check. Non-zero exit means the deploy did not work.
#
#   smoke-check.sh                      frontend + backend
#   smoke-check.sh --frontend [URL]     public page only
#   smoke-check.sh --backend  [BASE]    API only
#
# A systemd unit that reached "active" only proves the process did not exit —
# it says nothing about whether the site answers. These three checks are the
# cheapest thing that does.
set -uo pipefail

FRONT_URL="${FRONTEND_HEALTH_URL:-https://modelizmclub.ru/}"
API_BASE="${API_HEALTH_BASE:-https://api.modelizmclub.ru/api/v1}"
RETRIES="${SMOKE_RETRIES:-10}"
SLEEP="${SMOKE_SLEEP:-3}"
DO_FRONT=1
DO_BACK=1

case "${1:-}" in
  --frontend) DO_BACK=0; [[ -n "${2:-}" ]] && FRONT_URL="$2" ;;
  --backend)  DO_FRONT=0; [[ -n "${2:-}" ]] && API_BASE="$2" ;;
  "")         ;;
  -h|--help)  echo "usage: $0 [--frontend URL | --backend BASE]"; exit 0 ;;
  *)          echo "unknown option: $1" >&2; exit 2 ;;
esac

FAILED=0
code_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || echo 000; }

# The service has just been restarted, so give it a few seconds to bind before
# calling it dead — but never more than RETRIES*SLEEP.
check() {  # $1 label, $2 expected, $3.. curl args
  local label="$1" want="$2"; shift 2
  local got="" i
  for ((i = 1; i <= RETRIES; i++)); do
    got="$(code_of "$@")"
    [[ "${got}" == "${want}" ]] && { printf '  ok    %-34s %s\n' "${label}" "${got}"; return 0; }
    sleep "${SLEEP}"
  done
  printf '  FAIL  %-34s got %s, want %s\n' "${label}" "${got}" "${want}"
  FAILED=1
  return 1
}

echo "smoke check $(date -Iseconds)"

if [[ "${DO_FRONT}" == "1" ]]; then
  check "frontend ${FRONT_URL}" 200 "${FRONT_URL}"
fi

if [[ "${DO_BACK}" == "1" ]]; then
  check "api health" 200 "${API_BASE}/health"

  # An authenticated route. With a token we expect it to answer; without one we
  # still assert it says 401 — that distinguishes "auth layer alive" from
  # "route 500s" or, worse, "route leaks data unauthenticated".
  #
  # /users/me/listings rather than /users/me: there is no `GET users/me` route
  # (only PATCH), so that path falls through to the public `users/{slug}`
  # catch-all and currently answers 500 instead of 401 — a separate bug, not
  # something a deploy gate should trip over.
  AUTH_ROUTE="${SMOKE_AUTH_ROUTE:-users/me/listings}"
  if [[ -n "${SMOKE_TOKEN:-}" ]]; then
    check "api /${AUTH_ROUTE} (authorised)" 200 -H "Authorization: Bearer ${SMOKE_TOKEN}" -H 'Accept: application/json' "${API_BASE}/${AUTH_ROUTE}"
  else
    check "api /${AUTH_ROUTE} (rejects anon)" 401 -H 'Accept: application/json' "${API_BASE}/${AUTH_ROUTE}"
  fi
fi

# Schema drift, now a gate. It stopped being advisory on 04.09, when
# chore/cleanup-escrow-schema removed the last known divergence and production
# matched the migrations object for object, 2132 on both sides. From here any
# difference is new and worth stopping a deploy for — that is the whole point of
# having measured it. Set SMOKE_SCHEMA_STRICT=0 to fall back to reporting.
if [[ "${DO_BACK}" == "1" && "${SMOKE_SKIP_SCHEMA:-0}" != "1" ]]; then
  DRIFT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/schema-drift.sh"
  if [[ -x "${DRIFT}" ]] && command -v psql >/dev/null 2>&1; then
    echo ""
    if ! "${DRIFT}" $([[ "${SMOKE_SCHEMA_STRICT:-1}" == "1" ]] && echo --strict); then
      echo "  FAIL  schema drift"
      FAILED=1
    fi
  fi
fi

# Access map drift — reporting only, never a gate. The map is edited from
# /admin on purpose, so a difference from the registry defaults is news rather
# than a fault; what must not happen is a difference nobody knows about. On
# 04.09 route.user sat overridden to `auth` while the registry said `guest` and
# the router treated profiles as public, and it surfaced only by accident.
# Printing the list after every deploy is what makes the next one visible.
if [[ "${DO_BACK}" == "1" && "${SMOKE_SKIP_ACCESS_MAP:-0}" != "1" ]]; then
  ACCESS_MAP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/access-map-drift.sh"
  if [[ -x "${ACCESS_MAP}" ]]; then
    echo ""
    # Its exit code is deliberately ignored for the deploy verdict: only a
    # broken comparison (exit 2) is worth a line, and it says so itself.
    "${ACCESS_MAP}" || true
  fi
fi

if [[ "${FAILED}" != "0" ]]; then
  echo "smoke check FAILED" >&2
  exit 1
fi
echo "smoke check passed"
