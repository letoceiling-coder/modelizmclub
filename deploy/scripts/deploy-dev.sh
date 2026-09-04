#!/usr/bin/env bash
# Deploy the ModelizmClub backend (api./dev.modelizmclub.ru).
#
# Order matters here. Everything that can refuse to proceed runs before the
# first irreversible step: the working tree is inspected before `reset --hard`,
# the script re-execs itself before it (not after), and the database is dumped
# before migrations touch it.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/modelizmclub}"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"

cd "${APP_DIR}"

# --- P7: pick up the new version of this script BEFORE anything destructive.
#     `git fetch` only writes remote-tracking refs, so re-execing here means the
#     checks below are always the ones from the commit being deployed.
git fetch origin master

if [[ "${DEPLOY_REEXECED:-}" != 1 ]]; then
  NEW_SELF="$(git show origin/master:deploy/scripts/deploy-dev.sh 2>/dev/null || true)"
  if [[ -n "${NEW_SELF}" ]] && ! diff -q <(printf '%s\n' "${NEW_SELF}") "$0" >/dev/null 2>&1; then
    TMP_SELF="$(mktemp)"; printf '%s\n' "${NEW_SELF}" > "${TMP_SELF}"; chmod +x "${TMP_SELF}"
    echo "==> deploy script changed upstream — re-running the new one"
    DEPLOY_REEXECED=1 exec bash "${TMP_SELF}" "$@"
  fi
  export DEPLOY_REEXECED=1
fi

# --- P1: never silently discard work that exists only on this server.
#     Build artefacts regenerate on every deploy and are expected to be dirty;
#     anything else is somebody's change and stops us.
KNOWN_ARTEFACTS='^(frontend/bun\.lock|frontend/src/routeTree\.gen\.ts|backend/composer\.lock)$'
DIRTY="$(git status --porcelain | awk '{print $2}' | grep -vE "${KNOWN_ARTEFACTS}" || true)"
if [[ -n "${DIRTY}" ]]; then
  cat >&2 <<MSG

DEPLOY STOPPED — the working tree has changes that are not build artefacts:

$(printf '  %s\n' ${DIRTY})

\`git reset --hard\` below would delete them permanently. Decide first:

  keep them      cd ${APP_DIR} && git stash push -m "server-local-\$(date +%F)" -- ${DIRTY//$'\n'/ }
  inspect them   cd ${APP_DIR} && git diff -- ${DIRTY//$'\n'/ }
  discard them   cd ${APP_DIR} && git checkout -- ${DIRTY//$'\n'/ }

Then run this script again.
MSG
  exit 1
fi

git reset --hard origin/master

mkdir -p "${LOG_DIR}"
MIGRATION_LOG="${LOG_DIR}/migrate-${RELEASE_ID}.log"

cd backend

composer install --optimize-autoloader --no-interaction

# --- P10: rebuild the config cache immediately, so the migration and
#     everything after it run with cached config rather than in the slow,
#     uncached window the old order left open.
php artisan config:clear
php artisan config:cache

# --- P6: configuration comes from .env as written. A deploy that rewrites
#     .env silently undoes deliberate operator changes, so required keys are
#     verified instead.
REQUIRED_ENV=(APP_KEY DB_DATABASE DB_USERNAME FEED_AUTO_PUBLISH)
MISSING=()
for key in "${REQUIRED_ENV[@]}"; do
  grep -qE "^${key}=." .env || MISSING+=("${key}")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "" >&2
  echo "DEPLOY STOPPED — required keys missing or empty in ${APP_DIR}/backend/.env:" >&2
  printf '  %s\n' "${MISSING[@]}" >&2
  echo "" >&2
  echo "Set them and re-run. This script no longer edits .env for you." >&2
  exit 1
fi

# --- P2: a snapshot before migrations is the only thing between a bad
#     migration and permanent data loss.
BACKUP_SCRIPT="${APP_DIR}/deploy/scripts/backup-db.sh"
if [[ ! -x "${BACKUP_SCRIPT}" ]]; then
  echo "DEPLOY STOPPED — ${BACKUP_SCRIPT} not found." >&2
  echo "Migrations must not run without a pre-deploy dump (see chore/db-backups)." >&2
  exit 1
fi
"${BACKUP_SCRIPT}" --pre-deploy
PRE_DEPLOY_DUMP="$(find /root/backups/auto/pre-deploy -maxdepth 1 -name '*.dump' -printf '%T@\t%p\n' 2>/dev/null | sort -rn | head -1 | cut -f2-)"
echo "==> pre-deploy dump: ${PRE_DEPLOY_DUMP:-<not found>}"

# What is about to change, recorded before it changes.
echo "==> migration plan -> ${MIGRATION_LOG}"
php artisan migrate --pretend >"${MIGRATION_LOG}" 2>&1 || true
# grep -c exits 1 when it counts nothing, and under `set -e` with pipefail
# that ended the deploy right here — silently, with a plausible last line.
# Every release without migrations stopped before `artisan down`, so the
# route cache, the role seeder, the FPM reload and the reverb/worker restart
# never ran, while the site stayed up and the code was already checked out.
# Two releases went out this way on 04.09 before anyone read the exit code.
PLANNED="$(grep -cE '^\s*\w+:' "${MIGRATION_LOG}" 2>/dev/null || true)"
echo "    ${PLANNED:-0} statement(s) planned"

# --- maintenance window: writes stop while the schema moves.
#     --secret lets an operator keep browsing the site to verify the deploy.
MAINT_SECRET="${DEPLOY_MAINT_SECRET:-deploy-${RELEASE_ID}}"
php artisan down --render="errors::503" --secret="${MAINT_SECRET}" --retry=60 || php artisan down --secret="${MAINT_SECRET}" --retry=60
echo "==> maintenance mode on (bypass: /${MAINT_SECRET})"

restore_hint() {
  cat >&2 <<MSG

MIGRATION FAILED. The site is still in maintenance mode.

  plan/output      ${MIGRATION_LOG}
  restore command  ${APP_DIR}/deploy/scripts/restore-db.sh ${PRE_DEPLOY_DUMP:-<no dump>}
  then             cd ${APP_DIR}/backend && php artisan up

MSG
}

if ! php artisan migrate --force 2>&1 | tee -a "${MIGRATION_LOG}"; then
  restore_hint
  exit 1
fi
if ! grep -qvE 'ERROR|SQLSTATE' <<<"$(tail -1 "${MIGRATION_LOG}")"; then
  restore_hint
  exit 1
fi

php artisan db:seed --class=RoleSeeder --force --no-interaction

php artisan route:clear
php artisan route:cache
php artisan view:cache 2>/dev/null || true

chown -R www-data:www-data storage bootstrap/cache
systemctl reload php8.3-fpm

php artisan up
echo "==> maintenance mode off"

# --- P5: queue workers and Reverb hold PHP code in memory, so without this
#     they keep executing the previous release for up to --max-time.
php artisan queue:restart
systemctl restart modelizmclub-reverb.service modelizmclub-worker.service
sleep 3
for unit in modelizmclub-reverb.service modelizmclub-worker.service; do
  if systemctl is-active --quiet "${unit}"; then
    echo "==> ${unit}: active"
  else
    echo "DEPLOY FAILED — ${unit} did not come back:" >&2
    systemctl --no-pager status "${unit}" | head -15 >&2
    exit 1
  fi
done

# --- P8: prove the API actually answers before calling this a success.
if ! "${APP_DIR}/deploy/scripts/smoke-check.sh" --backend; then
  echo "" >&2
  echo "SMOKE CHECK FAILED after backend deploy ${RELEASE_ID}." >&2
  echo "The code is deployed and migrations are applied — this is not auto-rolled back," >&2
  echo "because reverting a migrated schema needs the dump, not a symlink swap:" >&2
  echo "  ${APP_DIR}/deploy/scripts/restore-db.sh ${PRE_DEPLOY_DUMP:-<no dump>}" >&2
  exit 1
fi

echo "Deploy OK: ${RELEASE_ID} $(date -Iseconds)"
