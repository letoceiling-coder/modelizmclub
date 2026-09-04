#!/usr/bin/env bash
# Compares a database against what the migrations describe.
#
# The August escrow episode ran a migration on production and then deleted the
# file without calling down(). Nothing noticed for three weeks, until a later
# migration tried to drop a table that an undocumented foreign key still held.
# No test could have caught it: the test database is built from migrations, so
# objects that exist only on production are invisible there. Only comparing the
# two catches this, which is what this script does.
#
#   schema-drift.sh                      compare the app's database with the
#                                        committed baseline
#   schema-drift.sh --build-reference    build the reference by running the
#                                        migrations into a scratch database
#                                        instead of trusting the baseline
#   schema-drift.sh --update-baseline    rewrite the baseline from the
#                                        migrations (run when a PR changes it)
#   schema-drift.sh --strict             exit 1 when the schemas differ
#
# Drift is reported as a warning by default because production carries known
# leftovers until chore/cleanup-escrow-schema lands. Flip the deploy and CI
# call sites to --strict once it has.
set -uo pipefail

# The object lists are sorted and compared byte by byte. Without a fixed locale
# `sort` and `comm` disagree on a Russian-locale server and every line looks
# out of order, and psql announces its \pset changes in the server's language
# straight into the output — both were hit on production on 04.09.
export LC_ALL=C

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKEND_DIR="${APP_DIR}/backend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUERY="${SCRIPT_DIR}/schema-objects.sql"
BASELINE="${SCHEMA_BASELINE:-${BACKEND_DIR}/database/schema/objects.txt}"

MODE="compare"
STRICT=0
for arg in "$@"; do
  case "${arg}" in
    --build-reference) MODE="build" ;;
    --update-baseline) MODE="update" ;;
    --strict)          STRICT=1 ;;
    -h|--help)         sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: ${arg}" >&2; exit 2 ;;
  esac
done

[[ -f "${QUERY}" ]] || { echo "schema-drift: no query file at ${QUERY}" >&2; exit 2; }

envval() {  # read one key out of the app's .env without sourcing it
  grep -E "^$1=" "${BACKEND_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs
}

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

# --- the reference: what the migrations say the schema should be -------------
build_reference() {
  local db="schema_drift_ref_$$"
  local host port user pass
  host="$(envval DB_HOST)"; port="$(envval DB_PORT)"
  user="$(envval DB_USERNAME)"; pass="$(envval DB_PASSWORD)"

  PGPASSWORD="${pass}" createdb -h "${host}" -p "${port}" -U "${user}" "${db}" >/dev/null 2>&1 || {
    echo "schema-drift: cannot create the scratch database ${db}" >&2; return 1; }

  # CACHE_STORE=array keeps the reference build side-effect free: the permission
  # package flushes its cache after migrating, and with the app's own store that
  # flush would land on the live cache of whatever host this runs on.
  ( cd "${BACKEND_DIR}" && DB_DATABASE="${db}" CACHE_STORE=array QUEUE_CONNECTION=sync \
      php artisan migrate --force --no-interaction >/dev/null 2>&1 ) || {
    PGPASSWORD="${pass}" dropdb -h "${host}" -p "${port}" -U "${user}" "${db}" >/dev/null 2>&1
    echo "schema-drift: migrations failed against the scratch database" >&2; return 1; }

  PGPASSWORD="${pass}" psql -q -h "${host}" -p "${port}" -U "${user}" -d "${db}" -f "${QUERY}" 2>/dev/null | grep -E '^(TABLE|COLUMN|INDEX|FK|SEQ)\|' | sort
  PGPASSWORD="${pass}" dropdb -h "${host}" -p "${port}" -U "${user}" "${db}" >/dev/null 2>&1
}

dump_target() {
  local host port user pass name
  host="$(envval DB_HOST)"; port="$(envval DB_PORT)"
  user="$(envval DB_USERNAME)"; pass="$(envval DB_PASSWORD)"; name="$(envval DB_DATABASE)"
  [[ -n "${name}" ]] || { echo "schema-drift: DB_DATABASE is empty in ${BACKEND_DIR}/.env" >&2; return 1; }
  PGPASSWORD="${pass}" psql -q -h "${host}" -p "${port}" -U "${user}" -d "${name}" -f "${QUERY}" 2>/dev/null | grep -E '^(TABLE|COLUMN|INDEX|FK|SEQ)\|' | sort
}

if [[ "${MODE}" == "update" ]]; then
  mkdir -p "$(dirname "${BASELINE}")"
  build_reference > "${TMP}/ref" || exit 1
  mv "${TMP}/ref" "${BASELINE}"
  echo "schema-drift: baseline rewritten from the migrations — $(wc -l < "${BASELINE}" | tr -d ' ') objects"
  exit 0
fi

if [[ "${MODE}" == "build" ]]; then
  build_reference > "${TMP}/ref" || exit 1
else
  [[ -f "${BASELINE}" ]] || { echo "schema-drift: no baseline at ${BASELINE} — run --update-baseline" >&2; exit 2; }
  grep -E '^(TABLE|COLUMN|INDEX|FK|SEQ)\|' "${BASELINE}" | sort > "${TMP}/ref"
fi

dump_target > "${TMP}/target" || exit 1

comm -23 "${TMP}/target" "${TMP}/ref" > "${TMP}/extra"    # on the database, not in the migrations
comm -13 "${TMP}/target" "${TMP}/ref" > "${TMP}/missing"  # in the migrations, not on the database

EXTRA=$(grep -c . "${TMP}/extra" || true)
MISSING=$(grep -c . "${TMP}/missing" || true)
TOTAL=$(grep -c . "${TMP}/target" || true)

report() {  # $1 stream
  {
    if [[ "${EXTRA}" == "0" && "${MISSING}" == "0" ]]; then
      echo "schema drift: none — ${TOTAL} objects match the migrations"
      return
    fi
    echo "schema drift: ${EXTRA} object(s) only on the database, ${MISSING} only in the migrations"
    if [[ "${EXTRA}" != "0" ]]; then
      echo "  on the database, created by nothing in this repository:"
      sed 's/^/    /' "${TMP}/extra" | head -40
      [[ "${EXTRA}" -gt 40 ]] && echo "    … and $((EXTRA - 40)) more"
    fi
    if [[ "${MISSING}" != "0" ]]; then
      echo "  described by a migration but absent — the more dangerous direction:"
      sed 's/^/    /' "${TMP}/missing" | head -40
      [[ "${MISSING}" -gt 40 ]] && echo "    … and $((MISSING - 40)) more"
    fi
  } >> "$1"
}

report /dev/stdout

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Schema drift"
    echo ""
    echo '```'
  } >> "${GITHUB_STEP_SUMMARY}"
  report "${GITHUB_STEP_SUMMARY}"
  echo '```' >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ "${EXTRA}" == "0" && "${MISSING}" == "0" ]]; then
  exit 0
fi

# Missing objects always break the code; extra ones only surprise a later
# migration. Report both, fail on either only when asked.
[[ "${STRICT}" == "1" ]] && exit 1
echo "schema-drift: reporting only (pass --strict to make this a failure)"
exit 0
