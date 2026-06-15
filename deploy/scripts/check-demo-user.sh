#!/usr/bin/env bash
set -euo pipefail
cd /var/www/modelizmclub/backend
php artisan db:seed --class=ReferenceDataSeeder --force --no-interaction
php artisan tinker --execute="echo App\\Models\\User::where('email','demo@modelizmclub.ru')->exists() ? 'demo:yes' : 'demo:no';"
