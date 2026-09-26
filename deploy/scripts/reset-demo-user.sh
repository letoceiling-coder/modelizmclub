#!/usr/bin/env bash
# Привести demo@modelizmclub.ru к паролю из защищённого файла.
#
# Что было не так. Скрипт держал пароль строкой в коде и ставил его
# живой учётке. То есть после смены пароля любой его запуск
# возвращал старый — и откатывал смену молча, без единого слова. Пока
# десять дымовых скриптов ходили с тем же паролем, это выглядело
# «починкой»: прогон начинал работать, потому что пароль вернули к тому,
# что у скриптов зашито.
#
# Теперь источник один — ~/.config/modelizmclub/qa-secrets.json, тот же,
# из которого пароль берут дымовые скрипты. Записывается ровно он, так
# что возврата к неизвестно чему не происходит.
#
# Справочные данные не наполняет, пароли админа и модератора не трогает.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/qa-secrets.sh"
QA_PASSWORD="$(qa_password)"

cd /var/www/modelizmclub/backend
QA_PASSWORD="${QA_PASSWORD}" php artisan tinker --execute="
\$email = 'demo@modelizmclub.ru';
\$пароль = (string) getenv('QA_PASSWORD');
if (\$пароль === '') {
    echo 'нет пароля в окружении';
    return;
}
\$user = App\\Models\\User::where('email', \$email)->first();
if (! \$user) {
    echo 'demo-missing';
    return;
}
\$user->forceFill([
    'password' => \$пароль,
    'status' => App\\Enums\\UserStatus::Active,
    'email_verified_at' => now(),
])->save();
echo Illuminate\\Support\\Facades\\Hash::check(\$пароль, \$user->fresh()->password) ? 'demo-ok' : 'demo-bad';
"
