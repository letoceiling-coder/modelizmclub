#!/usr/bin/env bash
# Restore the ModelizmClub database from a pg_dump custom-format file.
#
#   restore-db.sh <dump-file> [--database NAME] [--yes]
#
# Restoring is the one operation here that destroys data, so it always takes a
# safety dump of the current state first and refuses to run without a typed
# confirmation. --yes skips only the prompt, never the safety dump.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/auto}"
SAFETY_DIR="${BACKUP_ROOT}/pre-restore"

DUMP=""
TARGET_DB=""
ASSUME_YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --database) TARGET_DB="${2:?--database needs a value}"; shift 2 ;;
    --yes)      ASSUME_YES=1; shift ;;
    -h|--help)  echo "usage: $0 <dump-file> [--database NAME] [--yes]"; exit 0 ;;
    *)          [[ -z "${DUMP}" ]] && DUMP="$1" || { echo "unexpected arg: $1" >&2; exit 2; }; shift ;;
  esac
done

[[ -n "${DUMP}" ]] || { echo "usage: $0 <dump-file> [--database NAME] [--yes]" >&2; exit 2; }
[[ -f "${DUMP}" ]] || { echo "no such dump: ${DUMP}" >&2; exit 1; }

ENV_FILE="${APP_DIR}/backend/.env"
[[ -f "${ENV_FILE}" ]] || { echo "no ${ENV_FILE}" >&2; exit 1; }
envval() { grep -E "^$1=" "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs; }
DB_HOST="$(envval DB_HOST)"; DB_PORT="$(envval DB_PORT)"
DB_USER="$(envval DB_USERNAME)"; DB_PASS="$(envval DB_PASSWORD)"
TARGET_DB="${TARGET_DB:-$(envval DB_DATABASE)}"
[[ -n "${TARGET_DB}" ]] || { echo "target database is empty" >&2; exit 1; }

export PGPASSWORD="${DB_PASS}"
PSQL=(psql -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER}")

# --- verify the dump is readable before touching anything ---
pg_restore -l "${DUMP}" >/dev/null 2>&1 || { echo "dump is unreadable: ${DUMP}" >&2; exit 1; }
OBJECTS="$(pg_restore -l "${DUMP}" | grep -c ';' || true)"

echo "restore plan"
echo "  dump:     ${DUMP}"
echo "  size:     $(du -h "${DUMP}" | cut -f1), ${OBJECTS} objects"
echo "  taken:    $(date -r "${DUMP}" -Iseconds 2>/dev/null || echo unknown)"
echo "  target:   ${TARGET_DB} on ${DB_HOST:-127.0.0.1}:${DB_PORT:-5432}"
echo "  WARNING:  every table in ${TARGET_DB} is dropped and rebuilt from the dump."
echo ""

if [[ "${ASSUME_YES}" != "1" ]]; then
  read -r -p "Type the database name (${TARGET_DB}) to continue: " CONFIRM
  [[ "${CONFIRM}" == "${TARGET_DB}" ]] || { echo "aborted — no changes made"; exit 1; }
fi

# --- safety dump of what we are about to overwrite; not optional ---
mkdir -p "${SAFETY_DIR}"
SAFETY="${SAFETY_DIR}/$(date +%Y%m%dT%H%M%S)-${TARGET_DB}-before-restore.dump"
echo "==> safety dump of current ${TARGET_DB} -> ${SAFETY}"
if ! pg_dump -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${TARGET_DB}" \
      -Fc -Z1 -f "${SAFETY}"; then
  echo "safety dump failed — refusing to restore over a database we cannot back up" >&2
  exit 1
fi
pg_restore -l "${SAFETY}" >/dev/null 2>&1 || { echo "safety dump unreadable — aborting" >&2; exit 1; }
chmod 600 "${SAFETY}"
echo "    safety dump ok ($(du -h "${SAFETY}" | cut -f1))"

# --- restore ---
echo "==> restoring ${DUMP} into ${TARGET_DB}"
set +e
pg_restore -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${TARGET_DB}" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error "${DUMP}"
RC=$?
set -e

if [[ ${RC} -ne 0 ]]; then
  echo ""
  echo "RESTORE FAILED (pg_restore exit ${RC})." >&2
  echo "The database may be half-restored. Roll back with:" >&2
  echo "  $0 ${SAFETY} --database ${TARGET_DB} --yes" >&2
  exit "${RC}"
fi

TABLES="$("${PSQL[@]}" -d "${TARGET_DB}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo '?')"
echo ""
echo "restore OK: ${TARGET_DB} now has ${TABLES} tables in public"
echo "previous state kept at: ${SAFETY}"
