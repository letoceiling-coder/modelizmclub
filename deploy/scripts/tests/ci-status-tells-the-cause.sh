#!/usr/bin/env bash
#
# `check-ci-status.sh` называет настоящую причину, а не догадку.
#
# 03.10 на закрытом репозитории он отвечал «Без токена GitHub даёт 60 запросов
# в час, задайте GH_TOKEN или подождите» при 55 свободных запросах из 60. То
# есть отправлял ждать то, что не наступит: без токена GitHub отвечает 404 на
# сам закрытый репозиторий, и время тут ничего не меняет.
#
# Причин две, и советы у них противоположные. Проверка подменяет ответы
# GitHub и требует, чтобы совет соответствовал причине.
#
# Подмена — через заглушку `curl` в PATH: сам скрипт не трогается, значит
# проверяется он, а не его копия.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="${ROOT}/deploy/scripts/check-ci-status.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
ERRORS=0

make_curl() {
  # $1 — тело для /check-runs или /actions/runs, $2 — тело для /rate_limit
  mkdir -p "${WORK}/bin"
  cat > "${WORK}/bin/curl" <<CURL
#!/usr/bin/env bash
for a in "\$@"; do
  case "\$a" in
    *rate_limit*) cat <<'RATE'
$2
RATE
      exit 0 ;;
  esac
done
cat <<'RUNS'
$1
RUNS
CURL
  chmod +x "${WORK}/bin/curl"
}

check() {
  local name="$1" expect_code="$2" expect_text="$3"
  local out code
  out="$(PATH="${WORK}/bin:${PATH}" bash "${SCRIPT}" 0123456789abcdef0123456789abcdef01234567 2>&1)"
  code=$?
  if [[ "${code}" != "${expect_code}" ]]; then
    echo "  НЕ ТОТ КОД      ${name}: ждали ${expect_code}, получили ${code}" >&2
    printf '%s\n' "${out}" | sed 's/^/      /' >&2
    ERRORS=$((ERRORS + 1))
    return
  fi
  if ! printf '%s' "${out}" | grep -q "${expect_text}"; then
    echo "  НЕ ТОТ СОВЕТ    ${name}: в ответе нет «${expect_text}»" >&2
    printf '%s\n' "${out}" | sed 's/^/      /' >&2
    ERRORS=$((ERRORS + 1))
    return
  fi
  printf '  ok    %-34s код %s\n' "${name}" "${code}"
}

echo "ci-status-tells-the-cause: подменённые ответы GitHub"

# 1. закрытый репозиторий: 404 при целом лимите — ждать бессмысленно
make_curl '{"message":"Not Found"}' '{"resources":{"core":{"remaining":55,"limit":60}}}'
check "закрытый репозиторий" 2 "Ждать бессмысленно"

# 2. кончился лимит: тот же 404, но свободных запросов нет — ждать помогает
make_curl '{"message":"API rate limit exceeded"}' '{"resources":{"core":{"remaining":0,"limit":60}}}'
check "лимит кончился" 2 "лимит без токена кончился"

# 3. остаток выяснить не удалось — третий совет, а не один из первых двух
make_curl '{"message":"Not Found"}' 'не json'
check "остаток неизвестен" 2 "Остаток лимита выяснить не удалось"

# 4. зелёный прогон остаётся зелёным
make_curl '{"workflow_runs":[{"status":"completed","conclusion":"success","html_url":"https://x"}]}' \
          '{"resources":{"core":{"remaining":55,"limit":60}}}'
check "зелёный прогон" 0 "зелёный"

# 5. красный остаётся красным
make_curl '{"workflow_runs":[{"status":"completed","conclusion":"failure","html_url":"https://x"}]}' \
          '{"resources":{"core":{"remaining":55,"limit":60}}}'
check "красный прогон" 1 "failure"

if [[ "${ERRORS}" != "0" ]]; then
  echo "ci-status-tells-the-cause: находок — ${ERRORS}" >&2
  exit 1
fi
echo "ci-status-tells-the-cause: ok — причина и совет сходятся во всех пяти случаях"
