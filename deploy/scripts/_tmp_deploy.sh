#!/usr/bin/env bash
set -uo pipefail
cd /var/www/modelizmclub
git fetch origin
git reset --hard origin/master
cd backend
php artisan config:clear
php artisan config:cache
php artisan route:cache >/dev/null 2>&1 || true
systemctl reload php8.3-fpm
echo "===== php lint ====="
php -l app/Modules/Auth/Notifications/ResetPasswordNotification.php
echo "===== render reset email (no send) ====="
php artisan tinker --execute='
$u=App\Models\User::where("email","dsc-23@yandex.ru")->first();
$n=new Modules\Auth\Notifications\ResetPasswordNotification(Illuminate\Support\Facades\Password::createToken($u));
$m=$n->toMail($u);
echo "SUBJECT: ".$m->subject."\n";
echo "ACTION: ".$m->actionText." -> ".$m->actionUrl."\n";
'
echo DONE
