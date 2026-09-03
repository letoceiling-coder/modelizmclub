#!/usr/bin/env bash
# OnFailure handler for backup-db.service.  usage: backup-db-notify.sh <failed-unit>
#
# Runs when a backup run fails. The journal entry and the failure log are
# unconditional; e-mail is best effort — the VPS has no MTA, so delivery goes
# through the app's configured SMTP and must never mask the original failure.
set -uo pipefail

UNIT="${1:-backup-db.service}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/auto}"
FAILLOG="${BACKUP_ROOT}/FAILURES.log"
HOST="$(hostname -f 2>/dev/null || hostname)"
WHEN="$(date -Iseconds)"

mkdir -p "${BACKUP_ROOT}"

DETAIL="$(systemctl status "${UNIT}" --no-pager --lines=25 2>&1 || true)"
LAST_LOG="$(tail -n 25 "${BACKUP_ROOT}/backup.log" 2>/dev/null || echo '(no backup.log)')"

BODY="ModelizmClub: DATABASE BACKUP FAILED
host:   ${HOST}
unit:   ${UNIT}
when:   ${WHEN}

--- last lines of backup.log ---
${LAST_LOG}

--- systemctl status ---
${DETAIL}
"

# 1. journal — always, and visible in `journalctl -u backup-db.service`
logger -t backup-db -p daemon.err "BACKUP FAILED on ${HOST} (${UNIT}) — see ${FAILLOG}"

# 2. on-disk marker — survives log rotation, easy to spot from a smoke check
{ echo "=== ${WHEN} ${UNIT} ==="; echo "${BODY}"; echo; } >> "${FAILLOG}"

# 3. e-mail through the app's SMTP, best effort
TO="${BACKUP_ALERT_TO:-}"
if [[ -z "${TO}" && -f "${APP_DIR}/backend/.env" ]]; then
  TO="$(grep -E '^MAIL_FROM_ADDRESS=' "${APP_DIR}/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs)"
fi

if [[ -n "${TO}" ]] && command -v php >/dev/null 2>&1; then
  if printf '%s' "${BODY}" | php "$(dirname "$0")/backup-db-notify.php" "${TO}" "Backup FAILED — ${HOST}"; then
    logger -t backup-db "failure notice e-mailed to ${TO}"
  else
    logger -t backup-db -p daemon.err "could not e-mail failure notice to ${TO}"
  fi
fi

# Always exit 0: this unit reports a failure, it is not itself a failure.
exit 0
