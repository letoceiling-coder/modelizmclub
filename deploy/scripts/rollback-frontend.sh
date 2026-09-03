#!/usr/bin/env bash
# Point the frontend back at the previous release — no rebuild.
#
#   rollback-frontend.sh            switch to the previous worktree release
#   rollback-frontend.sh --list     show what is available
#   rollback-frontend.sh <release>  switch to a specific release id
#
# Only ever repoints the .output symlink at a release that is already built and
# still on disk, so it takes about as long as a service restart.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"
WORKTREES_DIR="${APP_DIR}/.worktrees"
SERVICE="${ROLLBACK_SERVICE:-modelizmclub-frontend.service}"
HEALTH_URL="${FRONTEND_HEALTH_URL:-https://modelizmclub.ru/}"

releases() {  # newest first
  find "${WORKTREES_DIR}" -maxdepth 1 -type d -name 'frontend-*' 2>/dev/null | sort -r
}

CURRENT=""
[[ -L "${FRONTEND_DIR}/.output" ]] && CURRENT="$(readlink -f "${FRONTEND_DIR}/.output" || true)"

if [[ "${1:-}" == "--list" ]]; then
  echo "releases in ${WORKTREES_DIR} (newest first):"
  while IFS= read -r r; do
    [[ -n "${r}" ]] || continue
    mark="  "
    [[ -n "${CURRENT}" && "${CURRENT}" == "${r}/frontend/.output" ]] && mark="* "
    printf '%s%s  (%s)\n' "${mark}" "$(basename "${r}")" "$(du -sh "${r}/frontend/.output" 2>/dev/null | cut -f1 || echo 'no .output')"
  done < <(releases)
  echo ""
  echo "* = currently served"
  exit 0
fi

mapfile -t ALL < <(releases)
[[ ${#ALL[@]} -gt 0 ]] || { echo "no releases in ${WORKTREES_DIR} — nothing to roll back to" >&2; exit 1; }

if [[ -n "${1:-}" ]]; then
  TARGET="${WORKTREES_DIR}/${1}"
  [[ "${1}" == frontend-* ]] || TARGET="${WORKTREES_DIR}/frontend-${1}"
else
  # Default: the newest release that is not the one currently served.
  TARGET=""
  for r in "${ALL[@]}"; do
    if [[ -z "${CURRENT}" || "${CURRENT}" != "${r}/frontend/.output" ]]; then
      TARGET="${r}"
      break
    fi
  done
  [[ -n "${TARGET}" ]] || { echo "only one release on disk (${ALL[0]}) — nowhere to roll back" >&2; exit 1; }
fi

OUT="${TARGET}/frontend/.output"
[[ -d "${TARGET}" ]] || { echo "release not found: ${TARGET}" >&2; exit 1; }
[[ -d "${OUT}" ]]    || { echo "release has no build output: ${OUT}" >&2; exit 1; }
[[ -f "${OUT}/server/index.mjs" ]] || { echo "release looks incomplete (no server/index.mjs): ${OUT}" >&2; exit 1; }

echo "current:  ${CURRENT:-<not a symlink>}"
echo "rollback: ${OUT}"

ln -sfn "${OUT}" "${FRONTEND_DIR}/.output.next"
mv -Tf "${FRONTEND_DIR}/.output.next" "${FRONTEND_DIR}/.output"
systemctl restart "${SERVICE}"

if "${APP_DIR}/deploy/scripts/smoke-check.sh" --frontend "${HEALTH_URL}"; then
  echo "rollback OK -> $(basename "${TARGET}")"
else
  echo "rollback done but smoke check still failing — the problem is not this release" >&2
  exit 1
fi
