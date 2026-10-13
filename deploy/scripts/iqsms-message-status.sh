#!/usr/bin/env bash
# Статус доставки iqSMS по smscId (из лога «SMS sent via iqsms»).
# Usage: bash deploy/scripts/iqsms-message-status.sh 6902639333 [more ids…]
set -euo pipefail
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 smscId [smscId…]" >&2
  exit 1
fi
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
cd "$APP_DIR/backend"
IDS_JSON="$(printf '"%s",' "$@")"
IDS_JSON="[${IDS_JSON%,}]"
sudo -u www-data php -r "
require 'vendor/autoload.php';
\$app = require 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
\$login = config('sms.iqsms.login');
\$pass = config('sms.iqsms.password');
\$ids = json_decode('$IDS_JSON', true);
\$messages = array_map(fn (\$id) => ['smscId' => (string) \$id], \$ids);
\$payload = ['login' => \$login, 'password' => \$pass, 'messages' => \$messages];
\$r = Illuminate\Support\Facades\Http::withHeaders(['Host' => 'api.iqsms.ru'])
    ->asJson()
    ->post('https://api.iqsms.ru/messages/v2/status.json', \$payload);
echo \$r->body().PHP_EOL;
"
