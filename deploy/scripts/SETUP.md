# Одноразовые скрипты развёртывания

Перечисленное ниже запускается **один раз при развёртывании нового сервера**
(или при подключении новой подсистемы), а не при каждом деплое. Регулярный
деплой — это `deploy/scripts/deploy-dev.sh` и `deploy/scripts/deploy-frontend.sh`.

Все они лежат в `deploy/scripts/` вместе с остальными. Раньше их держал
отдельный каталог `deploy/setup/`, но он оказался копией — и копией
отставшей: в двух скриптах там не было `chmod 640` после `config:cache`,
и запуск не того файла возвращал кешу конфигурации права 644 вместе с
паролем базы внутри. Каталог убран 10.09.2026.

Порядок для чистого сервера:

| # | Скрипт | Что делает |
|---|---|---|
| 1 | `server-setup.sh` | Пакеты, PostgreSQL, Redis, nginx, SSL, клон репозитория |
| 2 | `finish-setup.sh` | Доводка после первого клона (ключ приложения, права) |
| 3 | `setup-frontend-vps.sh` | Node 22 + Bun, vhost и SSL для `modelizmclub.ru` |
| 4 | `setup-reverb-vps.sh` | systemd + nginx + SSL для `ws.modelizmclub.ru` |
| 5 | `setup-upload-limits.sh` | Лимиты загрузки в PHP-FPM и nginx |

По потребности:

| Скрипт | Когда нужен |
|---|---|
| `configure-mail-env.sh` | Прописать SMTP в `backend/.env` |
| `configure-s3-env.sh` | Прописать S3 (Selectel) в `backend/.env` |
| `setup-coturn.sh` | TURN-сервер для звонков |
| `setup-livekit-vps.sh` | LiveKit SFU для групповых звонков |
| `setup-delivery-scheduler.sh` | Проверка подписки на webhook СДЭК |
| `setup-test-db.sh` | Изолированная БД `modelizmclub_test` для PHPUnit |
| `setup-neeklo-vps.sh` + `neeklo-finish-setup.sh` | Отдельный стенд neeklo |

> Скрипты меняют системную конфигурацию и `.env`. Перед запуском на работающем
> сервере снимите бэкап: `deploy/scripts/backup-db.sh`.
