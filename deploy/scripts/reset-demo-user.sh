#!/usr/bin/env bash
# Ensure demo@modelizmclub.ru exists with a known password for smoke tests.
set -euo pipefail
cd /var/www/modelizmclub/backend
php artisan db:seed --class=ReferenceDataSeeder --force --no-interaction
php artisan tinker --execute="
\$user = App\\Models\\User::where('email', 'demo@modelizmclub.ru')->firstOrFail();
\$user->forceFill([
    'password' => 'password123',
    'status' => App\\Enums\\UserStatus::Active,
    'email_verified_at' => now(),
])->save();
echo Illuminate\\Support\\Facades\\Hash::check('password123', \$user->fresh()->password) ? 'demo-ok' : 'demo-bad';
"
