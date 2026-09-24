#!/usr/bin/env bash
# Сторож места на диске.  usage: disk-alert.sh [--force-percent N] [--quiet]
#
# Заполнившийся диск роняет сайт без предупреждения: postgres перестаёт
# писать, php-fpm — логировать, выкатка обрывается на полуслове. Узнать об
# этом от пользователей — худший из вариантов.
#
# Каналы те же три, что у backup-db-notify.sh, и по тем же причинам:
#   1. журнал — всегда, виден в `journalctl -t disk-alert`;
#   2. отметка на диске — переживает ротацию журнала, её видит smoke-check;
#   3. письмо через SMTP приложения — на VPS нет MTA, другого пути нет.
# Четвёртого канала (Telegram) не завожу: он требует своего бота и токена,
# а письмо уже настроено и проверено.
#
# Пороги. 80% — предупреждение: место есть, но пора смотреть. 90% —
# тревога: на 77 ГБ это меньше 8 ГБ свободного, и одна выкатка с
# пересборкой фронта может их съесть.
#
# Письмо уходит ОДИН раз на каждый уровень, пока он держится: таймер ходит
# каждые 15 минут, и без этого за сутки пришло бы 96 писем, после чего их
# перестают читать — то есть сторож сам себя отключает.
#
# Имена переменных латиницей намеренно: bash кириллические идентификаторы
# не принимает, а `bash -n` этого не ловит — он считает `ХУЖЕ=0` командой
# и молчит. Найдено запуском 24.09, после того как разбор синтаксиса
# отчитался «в порядке».
set -uo pipefail

WARN="${DISK_WARN_PERCENT:-80}"
CRIT="${DISK_CRIT_PERCENT:-90}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
STATE_DIR="${DISK_ALERT_STATE:-/var/lib/modelizmclub}"
MARKER="${STATE_DIR}/DISK.log"
HOST="$(hostname -f 2>/dev/null || hostname)"
WHEN="$(date -Iseconds)"
FORCE=""
QUIET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-percent) FORCE="${2:-}"; shift 2 ;;
    --quiet) QUIET=1; shift ;;
    *) echo "usage: disk-alert.sh [--force-percent N] [--quiet]" >&2; exit 2 ;;
  esac
done

mkdir -p "${STATE_DIR}"

# Разделы: только настоящие, без tmpfs и загрузочных. На 24.09 данные,
# база и бэкапы лежат на одном `/` — отдельных разделов под базу и медиа
# нет, и порогов для них поэтому тоже нет. Медиа вообще в S3.
worst=0
worst_mount=""
table=""
while read -r _fs size used avail pct mount; do
  [[ "${pct}" == "Use%" ]] && continue
  n="${pct%\%}"
  [[ "${n}" =~ ^[0-9]+$ ]] || continue
  table+="  ${mount}: занято ${used} из ${size} (${pct}), свободно ${avail}"$'\n'
  if (( n > worst )); then worst="${n}"; worst_mount="${mount}"; fi
done < <(df -P -x tmpfs -x devtmpfs -x overlay 2>/dev/null | grep -vE '/boot')

# Подложенное условие для проверки: проходит весь путь до письма, не
# заполняя диск на самом деле.
if [[ -n "${FORCE}" ]]; then
  worst="${FORCE}"
  worst_mount="${worst_mount:-/} (подложено --force-percent ${FORCE})"
fi

if (( worst >= CRIT )); then level="CRIT"
elif (( worst >= WARN )); then level="WARN"
else level="OK"; fi

[[ -n "${QUIET}" ]] || printf '%s: %s%% на %s (пороги %s/%s)\n' "${level}" "${worst}" "${worst_mount}" "${WARN}" "${CRIT}"

prev="$(cat "${STATE_DIR}/level" 2>/dev/null || echo OK)"
echo "${level}" > "${STATE_DIR}/level"

if [[ "${level}" == "OK" ]]; then
  if [[ "${prev}" != "OK" ]]; then
    logger -t disk-alert "место на диске вернулось в норму: ${worst}% на ${worst_mount}"
    echo "=== ${WHEN} ВОССТАНОВЛЕНО: ${worst}% на ${worst_mount}" >> "${MARKER}"
  fi
  exit 0
fi

# Чем занято — чтобы письмо говорило, что делать, а не только что плохо.
big="$(du -xh --max-depth=2 / 2>/dev/null | sort -rh | head -12 | sed 's/^/  /')"
backups="$(du -sh /root/backups 2>/dev/null | cut -f1)"

body="ModelizmClub: МЕСТО НА ДИСКЕ — ${level}
хост:   ${HOST}
время:  ${WHEN}
занято: ${worst}% на ${worst_mount}  (предупреждение ${WARN}%, тревога ${CRIT}%)

--- разделы ---
${table}
--- чем занято (верхние 12) ---
${big}

--- бэкапы занимают ---
  ${backups:-?}   (ротация в backup-db.sh; копии есть в S3)
"

logger -t disk-alert -p daemon.err "ДИСК ${level}: ${worst}% на ${worst_mount} (${HOST})"
{ echo "=== ${WHEN} ${level} ==="; echo "${body}"; echo; } >> "${MARKER}"

# Письмо — один раз на уровень. Переход WARN→CRIT письмо шлёт: это
# ухудшение, о нём надо знать, даже если про WARN уже сообщали.
if [[ "${level}" == "${prev}" ]]; then
  [[ -n "${QUIET}" ]] || echo "  письмо не шлю: про уровень ${level} уже сообщали"
  exit 0
fi

TO="${DISK_ALERT_TO:-}"
if [[ -z "${TO}" && -f "${APP_DIR}/backend/.env" ]]; then
  TO="$(grep -E '^MAIL_FROM_ADDRESS=' "${APP_DIR}/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'' | xargs)"
fi

if [[ -z "${TO}" ]]; then
  [[ -n "${QUIET}" ]] || echo "  адрес получателя не задан — письмо не шлю (журнал и отметка записаны)"
  exit 0
fi

if command -v php >/dev/null 2>&1; then
  # Помощник называется backup-db-notify.php, но шлёт любое письмо через
  # почту приложения. Второй такой же заводить незачем.
  if printf '%s' "${body}" | php "$(dirname "$0")/backup-db-notify.php" "${TO}" "Диск ${level} ${worst}% — ${HOST}"; then
    logger -t disk-alert "оповещение отправлено на ${TO}"
    [[ -n "${QUIET}" ]] || echo "  письмо отправлено на ${TO}"
  else
    logger -t disk-alert -p daemon.err "не удалось отправить оповещение на ${TO}"
    [[ -n "${QUIET}" ]] || echo "  ПИСЬМО НЕ УШЛО (журнал и отметка на диске всё равно записаны)"
  fi
fi

exit 0
