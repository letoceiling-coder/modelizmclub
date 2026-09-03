#!/usr/bin/env bash
# Push one backup file to S3.  usage: backup-db-upload.sh <local-file> <remote-key>
#
# The VPS has no aws CLI, but the app already ships league/flysystem-aws-s3-v3
# and a configured `s3` disk, so the PHP helper below is the primary path and
# the aws CLI is used only if someone installs it later.
set -euo pipefail

SRC="${1:?local file required}"
KEY="${2:?remote key required}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

[[ -f "${SRC}" ]] || { echo "upload: no such file: ${SRC}" >&2; exit 1; }

if [[ "${BACKUP_S3_ENABLED:-1}" != "1" ]]; then
  echo "upload: skipped (BACKUP_S3_ENABLED=0)"
  exit 0
fi

if command -v aws >/dev/null 2>&1; then
  bucket="$(grep -E '^AWS_BUCKET=' "${APP_DIR}/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs)"
  endpoint="$(grep -E '^AWS_ENDPOINT=' "${APP_DIR}/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs)"
  [[ -n "${bucket}" ]] || { echo "upload: AWS_BUCKET is empty" >&2; exit 1; }
  exec aws s3 cp "${SRC}" "s3://${bucket}/${KEY}" ${endpoint:+--endpoint-url "${endpoint}"}
fi

exec php "$(dirname "$0")/backup-db-upload.php" "${SRC}" "${KEY}"
