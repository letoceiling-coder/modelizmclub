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
- Node.js 22 + Bun (frontend на modelizmclub.ru)

## Backend (dev.modelizmclub.ru)

На сервере под root (один раз):

```bash
bash /var/www/modelizmclub/deploy/scripts/server-setup.sh
```

Скрипт устанавливает пакеты, создаёт БД, клонирует репозиторий, настраивает nginx и SSL.

## Обновление backend после push

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-dev.sh
```

## Frontend (modelizmclub.ru)

Источник UI: [modelism-hub-connect](https://github.com/Neeklo1606/modelism-hub-connect) (TanStack Start + Nitro `node-server`).

Первичная настройка (один раз, **не затрагивает** dev API и другие vhost):

```bash
bash /var/www/modelizmclub/deploy/scripts/setup-frontend-vps.sh
```

Обновление после push:

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-frontend.sh
```

| URL | Назначение |
|-----|------------|
| https://modelizmclub.ru | production frontend (SSR, :3000) |
| https://dev.modelizmclub.ru | Laravel API + Swagger |

`frontend/.env.production` → `VITE_API_BASE_URL=https://dev.modelizmclub.ru/api/v1`

## Переменные окружения

Файл `/var/www/modelizmclub/backend/.env` — **не в git**.

Обязательные ключи:

- `DB_*` — PostgreSQL на localhost
- `REDIS_*` — Redis на localhost
- `AWS_*` — Selectel S3
- `APP_URL=https://dev.modelizmclub.ru`

## CI

Тесты запускаются в GitHub Actions (без локального окружения). См. `.github/workflows/tests.yml` в `backend/`.
