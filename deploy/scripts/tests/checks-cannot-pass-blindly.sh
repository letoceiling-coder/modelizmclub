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

echo "checks-cannot-pass-blindly: корень подставлен несуществующий"

verdict() {
  local name="$1" code="$2" output="$3"
  if [[ "${code}" == "0" ]]; then
    echo "  ОТВЕЧАЕТ НУЛЁМ   ${name} — ничего не проверив" >&2
    printf '%s\n' "${output}" | head -3 | sed 's/^/      /' >&2
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
  check-sms-driver.sh
)

for name in "${BY_ROOT[@]}"; do
  file="${SCRIPTS}/${name}"
  if [[ ! -f "${file}" ]]; then
    echo "  НЕТ ФАЙЛА       ${name} — список устарел" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi
  out="$(timeout 60 bash "${file}" "${MISSING_ROOT}" 2>&1)"
  verdict "${name}" "$?" "${out}"
done

# `check-live-money.sh` берёт корень флагом, а не параметром.
out="$(timeout 60 bash "${SCRIPTS}/check-live-money.sh" "--root=${MISSING_ROOT}" 2>&1)"
verdict "check-live-money.sh" "$?" "${out}"

# `access-map-drift.sh` берёт корень из переменной APP_DIR.
out="$(APP_DIR="${MISSING_ROOT}" timeout 60 bash "${SCRIPTS}/access-map-drift.sh" --strict 2>&1)"
verdict "access-map-drift.sh" "$?" "${out}"

if [[ "${ERRORS}" != "0" ]]; then
  echo "checks-cannot-pass-blindly: проверок, отвечающих нулём ни о чём — ${ERRORS}" >&2
  exit 1
fi

echo "checks-cannot-pass-blindly: ok — все отвечают ненулевым кодом, когда проверять нечего"
