#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
EMAIL="${1:-crandimandi@gmail.com}"
cd "$APP_DIR/backend"

echo "=== git ==="
git log -1 --oneline

echo "=== ResetPasswordController (password save) ==="
grep -A6 "function (\$user" app/Modules/Auth/Http/Controllers/Api/V1/ResetPasswordController.php || true

echo "=== user row ==="
php artisan tinker --execute="
\$email = Str::lower('$EMAIL');
\$u = App\\Models\\User::withTrashed()->where('email', \$email)->first();
if (! \$u) { echo 'USER_NOT_FOUND'; exit; }
echo 'id='.\$u->id.' status='.\$u->status->value.' deleted='.( \$u->trashed() ? 'yes' : 'no' ).PHP_EOL;
echo 'hash='.substr((string)\$u->password, 0, 20).'...'.PHP_EOL;
"

echo "=== recent auth log lines ==="
grep -i "$EMAIL" storage/logs/laravel.log 2>/dev/null | tail -20 || echo "(no lines)"
