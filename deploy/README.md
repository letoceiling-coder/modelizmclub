# Деплой на VPS (dev.modelizmclub.ru)

Локальный Docker не используется. Все сервисы — на VPS Beget.

## Сервер

| Параметр | Значение |
|----------|----------|
| IP | 31.207.75.124 |
| ОС | Ubuntu 24.04 |
| Домен | dev.modelizmclub.ru |
| DNS | `*.modelizmclub.ru` → A 31.207.75.124 |
| Путь приложения | `/var/www/modelizmclub` |

## Стек на сервере

- nginx + PHP 8.3-FPM
- PostgreSQL 16
- Redis 7
- Certbot (Let's Encrypt)
- Supervisor (очереди Laravel)
- Node.js 22 (для frontend, позже)

## Первичная настройка

На сервере под root (один раз):

```bash
bash /var/www/modelizmclub/deploy/scripts/server-setup.sh
```

Скрипт устанавливает пакеты, создаёт БД, клонирует репозиторий, настраивает nginx и SSL.

## Обновление после push

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-dev.sh
```

## Переменные окружения

Файл `/var/www/modelizmclub/backend/.env` — **не в git**.

Обязательные ключи:

- `DB_*` — PostgreSQL на localhost
- `REDIS_*` — Redis на localhost
- `AWS_*` — Selectel S3
- `APP_URL=https://dev.modelizmclub.ru`

## CI

Тесты запускаются в GitHub Actions (без локального окружения). См. `.github/workflows/tests.yml` в `backend/`.
