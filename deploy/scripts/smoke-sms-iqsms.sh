#!/usr/bin/env bash
# Проверка СМС Дисконт после выкатки: конфиг, unit-тест, одна отправка.
# На prod: bash deploy/scripts/smoke-sms-iqsms.sh +79892473472
set -euo pipefail
PHONE="${1:-}"
if [[ -z "$PHONE" ]]; then
  echo "Usage: $0 +79XXXXXXXXX" >&2
  exit 1
fi
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
cd "$APP_DIR/backend"
sudo -u www-data php -r "
require 'vendor/autoload.php';
\$app = require 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo 'driver='.config('sms.driver').' sender=['.config('sms.iqsms.sender').']'.PHP_EOL;
"
if [[ -f vendor/phpunit/phpunit/phpunit ]]; then
  sudo -u www-data php artisan test --filter=IqSmsClientTest
else
  echo "skip: phpunit not installed on prod (--no-dev)"
fi
sudo -u www-data php -r "
require 'vendor/autoload.php';
\$app = require 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Support\PhoneNormalizer;
use App\Services\Sms\IqSmsClient;
use App\Services\Sms\SmsTemplate;
\$n = PhoneNormalizer::normalize('$PHONE');
if (\$n === null) { fwrite(STDERR, \"invalid phone\n\"); exit(2); }
\$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
\$text = SmsTemplate::Verification->render([\$code]);
echo \"phone=\$n sender=[\".config('sms.iqsms.sender').\"] code=\$code\n\$text\n\";
\$r = app(IqSmsClient::class)->send(\$n, \$text);
echo 'smsc_id='.(\$r['messages'][0]['smscId'] ?? '?').\"\n\";
"
