#!/usr/bin/env bash
# Имя SMS-драйвера известно приложению, и у драйвера есть доступы.
#
# Привязка драйвера ленивая: опечатка в `SMS_DRIVER` не проявляется ни при
# `config:cache`, ни при перезагрузке php-fpm. Она проявляется первым
# живым человеком, нажавшим «Получить код», — голой пятисоткой, причём
# слот ограничителя к тому моменту уже списан.
#
# Поэтому проверка стоит здесь и вызывается из smoke-check.sh после
# выкатки: пусть опечатку найдёт выкатка, а не покупатель.
set -uo pipefail

BACKEND="${BACKEND_DIR:-/var/www/modelizmclub/backend}"
cd "${BACKEND}" || { echo "check-sms-driver: нет каталога ${BACKEND}"; exit 1; }

OUT="$(sudo -u www-data php -r '
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$driver = (string) (config("sms.driver") ?: "iqsms");
$map = (array) config("sms.drivers", []);
if (! isset($map[$driver])) {
    printf("FAIL неизвестный драйвер «%s»; известные: %s\n", $driver, implode(", ", array_keys($map)));
    exit(1);
}
try {
    $ok = app($map[$driver])->isConfigured();
} catch (\Throwable $e) {
    printf("FAIL драйвер «%s» не собирается: %s\n", $driver, $e->getMessage());
    exit(1);
}
printf("%s драйвер «%s», доступы %s\n", $ok ? "OK" : "WARN", $driver, $ok ? "есть" : "НЕ ЗАДАНЫ");
exit($ok ? 0 : 2);
' 2>&1)"
CODE=$?

echo "check-sms-driver: ${OUT}"
# 2 — доступов нет. Это предупреждение, а не приговор: на стенде так и
# должно быть. Неизвестное имя (1) — приговор.
[ "${CODE}" -eq 1 ] && exit 1
exit 0
