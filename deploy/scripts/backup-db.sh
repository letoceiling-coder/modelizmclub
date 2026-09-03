#!/usr/bin/env bash
# PostgreSQL backup for ModelizmClub — rotated local copies + an off-box copy in S3.
#
#   backup-db.sh                 daily dump  -> auto/daily (14 kept), promoted to
#                                auto/weekly on Mondays (8 kept)
#   backup-db.sh --pre-deploy    fast dump before migrations -> auto/pre-deploy (7 days)
#
# A dump that only exists on the machine it was taken from is not a backup, so
# every file is also pushed to S3 under backups/. Any failure — dump, integrity
# check or upload — exits non-zero so the systemd OnFailure hook fires.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/auto}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
KEEP_PRE_DEPLOY_DAYS="${KEEP_PRE_DEPLOY_DAYS:-7}"
LOG_FILE="${BACKUP_LOG:-${BACKUP_ROOT}/backup.log}"

MODE="daily"
if [[ "${1:-}" == "--pre-deploy" ]]; then
  MODE="pre-deploy"
elif [[ -n "${1:-}" ]]; then
  echo "usage: $0 [--pre-deploy]" >&2
  exit 2
fi

mkdir -p "${BACKUP_ROOT}"/{daily,weekly,pre-deploy}

log() { printf '%s [%s] %s\n' "$(date -Iseconds)" "${MODE}" "$*" | tee -a "${LOG_FILE}" >&2; }

fail() {
  log "FAILED: $*"
  exit 1
}

# --- database credentials come from the app's own .env, never duplicated here ---
ENV_FILE="${APP_DIR}/backend/.env"
[[ -f "${ENV_FILE}" ]] || fail "no ${ENV_FILE}"

envval() { grep -E "^$1=" "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs; }
DB_HOST="$(envval DB_HOST)"; DB_PORT="$(envval DB_PORT)"
DB_NAME="$(envval DB_DATABASE)"; DB_USER="$(envval DB_USERNAME)"
DB_PASS="$(envval DB_PASSWORD)"
[[ -n "${DB_NAME}" && -n "${DB_USER}" ]] || fail "DB_DATABASE/DB_USERNAME missing in ${ENV_FILE}"

# --- name carries the moment and the deployed commit, so a dump can always be
#     matched to the code that produced the schema ---
TS="$(date +%Y%m%dT%H%M%S)"
SHA="$(git -C "${APP_DIR}" -c safe.directory="${APP_DIR}" rev-parse --short HEAD 2>/dev/null || echo nogit)"

if [[ "${MODE}" == "pre-deploy" ]]; then
  DEST_DIR="${BACKUP_ROOT}/pre-deploy"
  NAME="${TS}-${SHA}-pre-deploy.dump"
  ZLEVEL=1          # speed matters here: the deploy is blocked until this finishes
else
  DEST_DIR="${BACKUP_ROOT}/daily"
  NAME="${TS}-${SHA}.dump"
  ZLEVEL=6
fi
DEST="${DEST_DIR}/${NAME}"

log "starting: db=${DB_NAME} commit=${SHA} -> ${DEST}"

# --- dump ---
if ! PGPASSWORD="${DB_PASS}" pg_dump \
      -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" \
      -Fc -Z"${ZLEVEL}" -f "${DEST}.part" 2>>"${LOG_FILE}"; then
  rm -f "${DEST}.part"
  fail "pg_dump returned non-zero"
fi

# --- verify before the file is allowed to count as a backup ---
if ! pg_restore -l "${DEST}.part" >/dev/null 2>>"${LOG_FILE}"; then
  rm -f "${DEST}.part"
  fail "dump is unreadable by pg_restore — not keeping it"
fi
OBJECTS="$(pg_restore -l "${DEST}.part" 2>/dev/null | grep -c ';' || true)"
[[ "${OBJECTS}" -gt 0 ]] || { rm -f "${DEST}.part"; fail "dump contains no objects"; }

mv -f "${DEST}.part" "${DEST}"
chmod 600 "${DEST}"
SIZE="$(du -h "${DEST}" | cut -f1)"
log "dump ok: ${NAME} (${SIZE}, ${OBJECTS} objects)"

# --- weekly promotion: Monday's daily is hard-linked into weekly/ ---
if [[ "${MODE}" == "daily" && "$(date +%u)" == "1" ]]; then
  ln -f "${DEST}" "${BACKUP_ROOT}/weekly/${NAME}" && log "promoted to weekly: ${NAME}"
fi

# --- off-box copy ---
if "$(dirname "$0")/backup-db-upload.sh" "${DEST}" "${S3_PREFIX}/$(basename "${DEST_DIR}")/${NAME}" >>"${LOG_FILE}" 2>&1; then
  log "uploaded to s3://${S3_PREFIX}/$(basename "${DEST_DIR}")/${NAME}"
else
  fail "S3 upload failed — the local copy exists but is not off-box"
fi

# --- rotation (runs only after a successful backup, so a failing job never
#     deletes the last good copies) ---
prune_keep_n() {  # $1 dir, $2 how many newest to keep
  # `ls glob` exits non-zero on an empty directory, which under `set -e` +
  # pipefail would abort the script *after* a successful backup — find keeps
  # the empty case quiet.
  local dir="$1" keep="$2" f
  local -a stale=()
  mapfile -t stale < <(
    find "${dir}" -maxdepth 1 -type f -name '*.dump' -printf '%T@\t%p\n' 2>/dev/null \
      | sort -rn | tail -n +$((keep + 1)) | cut -f2-
  )
  for f in "${stale[@]}"; do
    [[ -n "${f}" ]] || continue
    rm -f -- "${f}" && log "rotated out: ${f#"${BACKUP_ROOT}/"}"
  done
}

case "${MODE}" in
  daily)
    prune_keep_n "${BACKUP_ROOT}/daily" "${KEEP_DAILY}"
    prune_keep_n "${BACKUP_ROOT}/weekly" "${KEEP_WEEKLY}"
    ;;
  pre-deploy)
    while IFS= read -r f; do
      [[ -n "${f}" ]] || continue
      log "rotated out: ${f#"${BACKUP_ROOT}/"}"
    done < <(find "${BACKUP_ROOT}/pre-deploy" -maxdepth 1 -type f -name '*.dump' \
               -mtime "+${KEEP_PRE_DEPLOY_DAYS}" -print -delete 2>/dev/null)
    ;;
esac

log "done: ${NAME}"
