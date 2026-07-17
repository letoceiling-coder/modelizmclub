#!/usr/bin/env bash
set -euo pipefail
cd /var/www/modelizmclub/backend
EMAIL="crandimandi@gmail.com"
php artisan tinker --execute="
\$email = '$EMAIL';
\$u = App\\Models\\User::where('email', \$email)->first();
echo 'updated_at='.\$u->updated_at.PHP_EOL;
echo 'created_at='.\$u->created_at.PHP_EOL;
\$cnt = DB::table('password_reset_tokens')->where('email', \$email)->count();
echo 'reset_tokens='.\$cnt.PHP_EOL;
"
