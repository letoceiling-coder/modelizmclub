#!/usr/bin/env bash
# Ensure demo@modelizmclub.ru exists with a known password for smoke tests.
# Does NOT seed reference data and does NOT reset admin/moderator passwords.
set -euo pipefail
cd /var/www/modelizmclub/backend
php artisan tinker --execute="
\$email = 'demo@modelizmclub.ru';
\$user = App\\Models\\User::where('email', \$email)->first();
if (! \$user) {
    echo 'demo-missing';
    return;
}
\$user->forceFill([
    'password' => 'password123',
    'status' => App\\Enums\\UserStatus::Active,
    'email_verified_at' => now(),
])->save();
echo Illuminate\\Support\\Facades\\Hash::check('password123', \$user->fresh()->password) ? 'demo-ok' : 'demo-bad';
"
