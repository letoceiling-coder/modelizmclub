#!/usr/bin/env bash
#
# Куда на самом деле уходят деньги.
#
# 03.10 замером на проде: эквайринг ВТБ с ключами и `enabled=true` указывал
# на `https://vtb.rbsuat.com/payment/rest/` — песочницу. Выплаты — на
# `epa-ift-sbp.vtb.ru` и `test3.api.vtb.ru:8443`, тоже испытательные.
# Безопасная сделка держит залог тем же эквайрингом, то есть там же.
#
# Снаружи это не видно ничем. Платёж создаётся, возвращает ссылку, человек
# видит форму банка и вводит карту. За всю жизнь сервиса прошёл один платёж,
# и объяснялось это то отказами банка, то поведением людей.
#
# Проверка существует потому, что правило «перед открытием переключить на
# боевой контур» два месяца было записью о намерении: за ним никто не
# следил. Теперь следит выкатка — предупреждением на каждой, и приговором,
# когда её вызывают с `--require-live`.
#
# Ответов три, и путать их нельзя: 0 — боевой контур, 1 — испытательный,
# 2 — выяснить не удалось. Второе не «всё хорошо»: так отвечает недоступный
# artisan, пустой вывод или ответ без нужных ключей, и выкатывать по такому
# ответу нельзя.
#
# Имена переменных латиницей намеренно: кириллица в именах ломает bash, и
# ломает молча — на этом здесь уже ошибались.
set -uo pipefail

ROOT="${ROOT:-/var/www/modelizmclub}"
REQUIRE_LIVE=0
for arg in "$@"; do
  case "${arg}" in
    --require-live) REQUIRE_LIVE=1 ;;
    --root=*) ROOT="${arg#--root=}" ;;
    -h|--help) echo "использование: check-live-money.sh [--require-live] [--root=/путь]"; exit 0 ;;
  esac
done
BACKEND="${ROOT}/backend"

if [[ ! -f "${BACKEND}/artisan" ]]; then
  echo "live-money: ${BACKEND}/artisan не найден — выяснить нечем" >&2
  exit 2
fi

# Признаки испытательного контура в адресе. Регистр не важен.
#
# `rbsuat` — песочница эквайринга ВТБ; `ift` — integration functional testing
# у выплат; `test`, `sandbox`, `uat`, `demo`, `stage` — общие; `localhost` и
# `127.0.0.1` — чужой человек туда не попадёт, но и банк тоже.
TEST_MARKERS='rbsuat|sandbox|-ift-|\.ift\.|ift-|(^|[^a-z])test|uat\.|demo\.|stage\.|localhost|127\.0\.0\.1'

# Вывод строками «ключ<TAB>значение»: разбирать проще, чем JSON без jq,
# а jq на сервере может не быть.
SUMMARY="$(cd "${BACKEND}" && php artisan tinker --execute='
// Каждый замер отдельно: отказ одного не должен обрывать вывод и
// превращать остальные в «не выяснили». На этом здесь уже ошибались —
// опечатка в имени метода унесла пять ключей из пятнадцати.
$out = static function (string $name, callable $probe): void {
    try {
        $value = $probe();
        $text = $value === null ? "" : (is_bool($value) ? ($value ? "1" : "0") : (string) $value);
    } catch (\Throwable $e) {
        $text = "?".get_class($e).": ".$e->getMessage();
    }
    echo $name."\t".$text."\n";
};
$out("app.env", fn () => config("app.env"));
$out("app.debug", fn () => (bool) config("app.debug"));
$out("provider.setting", fn () => config("billing.provider"));
$out("provider.actual", fn () => app(\Modules\Billing\Services\PaymentGatewayManager::class)->provider());
$out("acq.enabled", fn () => (bool) config("billing.vtb.enabled"));
$out("acq.url", fn () => config("billing.vtb.api_url"));
$out("acq.configured", fn () => app(\Modules\Billing\Services\VtbPaymentGateway::class)->isConfigured());
$out("payout.enabled", fn () => (bool) config("billing.vtb_payout.enabled"));
$out("payout.oauth_url", fn () => config("billing.vtb_payout.oauth_url"));
$out("payout.api_url", fn () => config("billing.vtb_payout.api_url"));
$out("payout.configured", fn () => app(\Modules\Billing\Services\SafeDealPayoutService::class)->enabled());
$out("escrow.provider", fn () => config("billing.safe_deal.escrow_provider"));
$out("escrow.enabled", fn () => (bool) config("billing.safe_deal.enabled"));
$out("yk.enabled", fn () => (bool) config("billing.yookassa.enabled"));
$out("yk.key_kind", function () {
    $key = (string) config("billing.yookassa.secret_key");

    return $key === "" ? "нет" : (str_starts_with($key, "live_") ? "live" : (str_starts_with($key, "test_") ? "test" : "неопознан"));
});
' 2>/dev/null)"

if [[ -z "${SUMMARY}" ]]; then
  echo "live-money: artisan ничего не ответил — выяснить не удалось" >&2
  exit 2
fi

read_key() {
  printf '%s\n' "${SUMMARY}" | awk -F'\t' -v k="$1" '$1 == k { print $2; found = 1 } END { if (!found) exit 3 }'
}

# Отсутствие ключа — это «не выяснили», а не «пусто». Иначе опечатка в имени
# читалась бы как «адрес не задан, значит не песочница».
MISSING=()
BROKEN=()
for k in app.env app.debug provider.setting provider.actual acq.enabled acq.url acq.configured \
         payout.enabled payout.oauth_url payout.api_url payout.configured \
         escrow.provider escrow.enabled yk.enabled yk.key_kind; do
  value="$(read_key "${k}")" || { MISSING+=("${k}"); continue; }
  # Замер, упавший с ошибкой, помечен «?» — это тоже «не выяснили», а не
  # «пусто». Иначе сломанный замер читался бы как «адреса нет, значит не
  # песочница», то есть как разрешение открываться.
  [[ "${value}" == \?* ]] && BROKEN+=("${k} → ${value#?}")
done
if ((${#MISSING[@]})); then
  echo "live-money: в ответе нет ключей: ${MISSING[*]} — выяснить не удалось" >&2
  exit 2
fi
if ((${#BROKEN[@]})); then
  echo "live-money: замер не выполнился:" >&2
  for b in "${BROKEN[@]}"; do echo "  ${b}" >&2; done
  echo "live-money: выяснить не удалось" >&2
  exit 2
fi

APP_ENV="$(read_key app.env)"
APP_DEBUG="$(read_key app.debug)"
PROVIDER_SET="$(read_key provider.setting)"
PROVIDER_ACT="$(read_key provider.actual)"
ACQ_ON="$(read_key acq.enabled)"
ACQ_URL="$(read_key acq.url)"
PAY_ON="$(read_key payout.enabled)"
PAY_OAUTH="$(read_key payout.oauth_url)"
PAY_API="$(read_key payout.api_url)"
PAY_OK="$(read_key payout.configured)"
ESCROW="$(read_key escrow.provider)"
ESCROW_ON="$(read_key escrow.enabled)"
YK_ON="$(read_key yk.enabled)"
YK_KIND="$(read_key yk.key_kind)"

SANDBOX=0
NOTES=()

is_test_host() {
  [[ -z "$1" ]] && return 1
  printf '%s' "$1" | tr 'A-Z' 'a-z' | grep -Eq "${TEST_MARKERS}"
}

host_verdict() {
  if [[ -z "$1" ]]; then echo "не задан"; return; fi
  if is_test_host "$1"; then echo "ИСПЫТАТЕЛЬНЫЙ"; else echo "боевой"; fi
}

echo "=== куда уходят деньги ==="
printf '  окружение         %s, отладка %s\n' "${APP_ENV}" \
  "$([[ "${APP_DEBUG}" == "1" ]] && echo включена || echo выключена)"
printf '  провайдер         настройка %s, фактически %s\n' "${PROVIDER_SET:-—}" "${PROVIDER_ACT}"
printf '  эквайринг         %s | %s | %s\n' \
  "$([[ "${ACQ_ON}" == "1" ]] && echo включён || echo выключен)" \
  "${ACQ_URL:-адрес не задан}" "$(host_verdict "${ACQ_URL}")"
printf '  выплаты oauth     %s | %s\n' "${PAY_OAUTH:-адрес не задан}" "$(host_verdict "${PAY_OAUTH}")"
printf '  выплаты api       %s | %s\n' "${PAY_API:-адрес не задан}" "$(host_verdict "${PAY_API}")"
printf '  безопасная сделка %s, залог через %s\n' \
  "$([[ "${ESCROW_ON}" == "1" ]] && echo включена || echo выключена)" "${ESCROW}"
printf '  ЮKassa            %s, ключ %s\n' \
  "$([[ "${YK_ON}" == "1" ]] && echo включена || echo выключена)" "${YK_KIND}"

# ── эквайринг ────────────────────────────────────────────────────────────────
if [[ "${ACQ_ON}" == "1" ]] && is_test_host "${ACQ_URL}"; then
  SANDBOX=1
  NOTES+=("эквайринг включён и указывает на испытательный контур: ${ACQ_URL}")
fi
if [[ "${ACQ_ON}" == "1" && -z "${ACQ_URL}" ]]; then
  NOTES+=("эквайринг включён, но адрес не задан — приём денег уходит на заглушку")
fi
if [[ "${PROVIDER_ACT}" == "stub" ]]; then
  SANDBOX=1
  NOTES+=("приём денег работает через заглушку (/pay/stub), банка в контуре нет")
fi

# ── выплаты ──────────────────────────────────────────────────────────────────
if [[ "${PAY_ON}" == "1" ]]; then
  for addr in "${PAY_OAUTH}" "${PAY_API}"; do
    if is_test_host "${addr}"; then
      SANDBOX=1
      NOTES+=("выплаты включены и указывают на испытательный контур: ${addr}")
    fi
  done
  if [[ "${PAY_OK}" != "1" ]]; then
    NOTES+=("выплаты включены, но контур не настроен — продавец денег не получит")
  fi
fi

# ── безопасная сделка ────────────────────────────────────────────────────────
# Залог держит тот же эквайринг: если он в песочнице, деньги покупателя ждут
# там же. Своего адреса у сделки нет, поэтому проверяется через эквайринг.
if [[ "${ESCROW_ON}" == "1" && "${ESCROW}" == "vtb" ]] && is_test_host "${ACQ_URL}"; then
  NOTES+=("залог безопасной сделки держится эквайрингом, а он в испытательном контуре")
fi

# ── ЮKassa ───────────────────────────────────────────────────────────────────
# Привязка карт для выплат (spec v4.0): приёмом денег не занимается, но
# тестовый ключ здесь означает, что карту человека привязать не выйдет.
if [[ "${YK_ON}" == "1" && "${YK_KIND}" != "live" ]]; then
  NOTES+=("ЮKassa включена с ключом «${YK_KIND}» — привязка карт для выплат не боевая")
fi

# ── окружение ────────────────────────────────────────────────────────────────
if [[ "${APP_ENV}" != "production" ]]; then
  NOTES+=("APP_ENV=${APP_ENV} — это не боевое окружение")
fi
if [[ "${APP_DEBUG}" == "1" ]]; then
  SANDBOX=1
  NOTES+=("APP_DEBUG включена — наружу уходят трассировки и настройки")
fi

echo ""
if ((${#NOTES[@]} == 0)); then
  echo "live-money: денежный контур боевой"
  exit 0
fi

for note in "${NOTES[@]}"; do
  echo "live-money: ${note}"
done

if [[ "${REQUIRE_LIVE}" == "1" ]]; then
  echo "live-money: открывать нельзя — контур не боевой" >&2
  exit 1
fi

echo "live-money: предупреждение, не приговор. Перед открытием — с --require-live."
if [[ "${SANDBOX}" == "1" ]]; then
  exit 1
fi
exit 0
