#!/usr/bin/env bash
# Пароль учётных записей приёмки — из защищённого файла, а не из кода.
#
# Подключается так:
#
#     . "$(dirname "$0")/lib/qa-secrets.sh"
#     PASSWORD="$(qa_password)"
#
# До 26.09 пароль стоял строкой в десяти скриптах, причём в половине —
# умолчанием вида `${SMOKE_PASSWORD:-<пароль>}`. Умолчание
# опаснее прямой записи: пароль сменили, переменную не выставили, и
# скрипт молча пробует старый и сообщает «вход не работает».
#
# Файл живёт там же, где токены приёмки (см. deploy/README.md):
#
#     ~/.config/modelizmclub/qa-secrets.json      права 600
#     {"password": "…"}
#
# Место выбрано сознательно: прежний каталог во временных файлах
# вычистился 25.09 вместе с токенами посреди прогона.

qa_secrets_file() {
  printf '%s' "${QA_SECRETS_FILE:-$HOME/.config/modelizmclub/qa-secrets.json}"
}

# Пароль или громкий отказ. Молчать здесь нельзя: скрипт, не нашедший
# пароля, напишет «вход не работает» и это прочитают как дефект входа.
qa_password() {
  if [ -n "${SMOKE_PASSWORD:-}" ]; then
    printf '%s' "${SMOKE_PASSWORD}"
    return 0
  fi

  local file
  file="$(qa_secrets_file)"

  if [ ! -r "${file}" ]; then
    echo "qa-secrets: не найден ${file}" >&2
    echo "  Создайте его с правами 600 и содержимым {\"password\": \"…\"}," >&2
    echo "  либо задайте SMOKE_PASSWORD в окружении." >&2
    echo "  Подробности — deploy/README.md, раздел про учётные записи приёмки." >&2
    return 1
  fi

  python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d["password"])' "${file}" 2>/dev/null || {
    echo "qa-secrets: в ${file} нет поля \"password\"" >&2
    return 1
  }
}
