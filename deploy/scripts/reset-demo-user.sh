#!/usr/bin/env bash
# Reset demo@modelizmclub.ru password for smoke tests (plain text; User model hashed cast applies).
set -euo pipefail
cd /var/www/modelizmclub/backend
php artisan tinker --execute="
\$user = App\\Models\\User::withTrashed()->where('email', 'demo@modelizmclub.ru')->first();
if (! \$user) { echo 'demo-missing'; exit(1); }
if (\$user->trashed()) { \$user->restore(); }
\$user->forceFill([
    'password' => 'password123',
    'status' => App\\Enums\\UserStatus::Active,
    'email_verified_at' => now(),
])->save();
echo Illuminate\\Support\\Facades\\Hash::check('password123', \$user->fresh()->password) ? 'demo-ok' : 'demo-bad';
"
