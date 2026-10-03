#!/usr/bin/env bash
#
# Ни одна проверка не отвечает «всё хорошо», ничего не проверив.
#
# 03.10 при попытке поставить `nginx-drift.sh` в ворота CI выяснилось, что он
# печатает «ok — боевой nginx совпадает с репозиторием» в любом месте, где нет
# ни репозитория, ни nginx: `nullglob` даёт пустые циклы, STATUS остаётся
# нулём, успех печатается. Рядом нашлись `check-moderation-gates.sh`,
# `check-config-access.sh` и `check-avif-encoder.sh` — все три отвечали нулём
# на «каталог не похож на приложение».
#
# Пока эти проверки зовут из `smoke-check.sh` через `|| true`, код возврата
# никого не касается. Касается он в ту минуту, когда проверку ставят в
# ворота, — и тогда зелёный ответ ни о чём читается как разрешение.
#
# Правило: ответов три. 0 — проверено и сошлось, 1 — проверено и разошлось,
# 2 — выяснить не удалось. Третье не «всё хорошо».
#
# Список явный: добавить проверку в `deploy/scripts` и не вписать её сюда —
# значит оставить правило без присмотра, а правило без присмотра через месяц
# становится записью о намерении.
#
# Имена переменных латиницей: кириллица в именах ломает bash, и ломает молча.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPTS="${ROOT}/deploy/scripts"
MISSING_ROOT=/nonexistent-root-for-this-test
ERRORS=0

# `timeout` есть не везде: в macOS его нет в составе системы, в coreutils от
# brew он называется и `timeout`, и `gtimeout`. Без него каждый вызов давал бы
# 127 — ненулевой код, то есть «ok», — и проверка печатала бы успех, не
# запустив ни одного скрипта. Проверка, живущая под девизом «проверка, которая
# не умеет провалиться, опаснее отсутствующей», именно этим и становилась бы.
TIMEOUT="$(command -v timeout || command -v gtimeout || true)"
if [[ -z "${TIMEOUT}" ]]; then
  echo "checks-cannot-pass-blindly: нет ни timeout, ни gtimeout — выяснить не удалось" >&2
  exit 2
fi

echo "checks-cannot-pass-blindly: корень подставлен несуществующий"

verdict() {
  local name="$1" code="$2" output="$3"
  if [[ "${code}" == "0" ]]; then
    echo "  ОТВЕЧАЕТ НУЛЁМ   ${name} — ничего не проверив" >&2
    printf '%s\n' "${output}" | head -3 | sed 's/^/      /' >&2
    ERRORS=$((ERRORS + 1))
    return
  fi
  # Ненулевой код сам по себе не годится: 124 от `timeout` означает зависание,
  # 127 — что скрипт вообще не запустился. И то и другое зачлось бы как «ok».
  if [[ "${code}" == "124" ]]; then
    echo "  ЗАВИСЛА          ${name} — ответа нет, а не отказ" >&2
    ERRORS=$((ERRORS + 1))
    return
  fi
  if [[ "${code}" == "127" ]]; then
    echo "  НЕ ЗАПУСТИЛАСЬ   ${name} — нечем проверять" >&2
    ERRORS=$((ERRORS + 1))
    return
  fi
  printf '  ok    %-30s код %s\n' "${name}" "${code}"
}

# Проверки, принимающие корень приложения первым параметром.
BY_ROOT=(
  nginx-drift.sh
  check-moderation-gates.sh
  check-config-access.sh
  check-avif-encoder.sh
)

for name in "${BY_ROOT[@]}"; do
  file="${SCRIPTS}/${name}"
  if [[ ! -f "${file}" ]]; then
    echo "  НЕТ ФАЙЛА       ${name} — список устарел" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi
  out="$("${TIMEOUT}" 60 bash "${file}" "${MISSING_ROOT}" 2>&1)"
  verdict "${name}" "$?" "${out}"
done

# Дальше — те, кому подставной корень передаётся не первым доводом. Способ у
# каждого свой, и перепутать их нельзя: `check-sms-driver.sh` первый довод не
# читает вовсе, а берёт каталог из `BACKEND_DIR`. Пока он стоял в списке выше,
# его вердикт получался не от подставного корня, а от того, что на раннере нет
# `/var/www/modelizmclub/backend`, — то есть контракт у него не проверялся. А
# на боевом сервере, где этот путь есть, проверка пошла бы против настоящего
# бэкенда, ответила 0 при настроенном драйвере и дала бы ложный отказ.
out="$(BACKEND_DIR="${MISSING_ROOT}/backend" "${TIMEOUT}" 60 bash "${SCRIPTS}/check-sms-driver.sh" 2>&1)"
verdict "check-sms-driver.sh" "$?" "${out}"

# `check-live-money.sh` берёт корень флагом.
out="$("${TIMEOUT}" 60 bash "${SCRIPTS}/check-live-money.sh" "--root=${MISSING_ROOT}" 2>&1)"
verdict "check-live-money.sh" "$?" "${out}"

# `access-map-drift.sh` берёт корень из переменной APP_DIR.
out="$(APP_DIR="${MISSING_ROOT}" "${TIMEOUT}" 60 bash "${SCRIPTS}/access-map-drift.sh" --strict 2>&1)"
verdict "access-map-drift.sh" "$?" "${out}"

# ── список следит за собой ───────────────────────────────────────────────────
#
# Явный список без присмотра — та же запись о намерении, что и правило без
# проверки. Поэтому каждый `check-*.sh` и `*-drift.sh` в `deploy/scripts`
# обязан быть либо в проверяемых выше, либо здесь, с причиной. Добавили
# скрипт и нигде не вписали — проверка падает и называет его.
#
# Освобождение — не поблажка, а утверждение, которое можно прочитать и
# оспорить. Поэтому у каждого написано, почему подставить ему «нечего
# проверять» нечем.
declare -a EXEMPT_NAMES=(
  schema-drift.sh
  category-tree-drift.sh
  check-workspace.sh
  check-empty-catch.sh
  check-config-cache-chmod.sh
  check-no-sandbox-defaults.sh
  check-ci-status.sh
  check-cities-sa.sh
  check-neeklo-table-owner.sh
)
declare -a EXEMPT_WHY=(
  "корень считает от своего расположения — подставить нечего"
  "то же; корня ни параметром, ни переменной не принимает"
  "смотрит сам репозиторий, а не приложение"
  "смотрит сам репозиторий"
  "смотрит сам репозиторий"
  "смотрит сам репозиторий"
  "спрашивает GitHub, а не приложение; свои три кода уже есть"
  "разовый разбор справочника городов, не сторож выкатки"
  "разовый разбор владельца таблиц, не сторож выкатки"
)

# Без `mapfile`: его нет в bash 3.2, который стоит в macOS по умолчанию, — а
# проверка должна работать и там, где её пишут, иначе она снова «не умеет
# провалиться» на машине автора.
ALL_CHECKS=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && ALL_CHECKS+=("${line}")
done < <(cd "${SCRIPTS}" && ls check-*.sh ./*-drift.sh 2>/dev/null | xargs -n1 basename | sort -u)

if ((${#ALL_CHECKS[@]} == 0)); then
  echo "checks-cannot-pass-blindly: в ${SCRIPTS} не нашлось ни одной проверки — выяснить не удалось" >&2
  exit 2
fi

exempt_reason() {
  local i
  for i in "${!EXEMPT_NAMES[@]}"; do
    [[ "${EXEMPT_NAMES[$i]}" == "$1" ]] && { printf '%s' "${EXEMPT_WHY[$i]}"; return 0; }
  done
  return 1
}

CHECKED=("${BY_ROOT[@]}" check-sms-driver.sh check-live-money.sh access-map-drift.sh)

echo ""
echo "checks-cannot-pass-blindly: все проверки названы"
for name in "${ALL_CHECKS[@]}"; do
  seen=0
  for done_name in "${CHECKED[@]}"; do
    [[ "${done_name}" == "${name}" ]] && seen=1 && break
  done
  if [[ "${seen}" == "1" ]]; then
    continue
  fi
  if why="$(exempt_reason "${name}")"; then
    printf '  освобождена      %-30s %s\n' "${name}" "${why}"
    continue
  fi
  echo "  НЕ НАЗВАНА       ${name} — впишите её в проверяемые или в освобождённые с причиной" >&2
  ERRORS=$((ERRORS + 1))
done

if [[ "${ERRORS}" != "0" ]]; then
  echo "checks-cannot-pass-blindly: находок — ${ERRORS}" >&2
  exit 1
fi

echo "checks-cannot-pass-blindly: ok — все отвечают ненулевым кодом, когда проверять нечего"
