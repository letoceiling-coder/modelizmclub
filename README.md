# ModelizmClub

Платформа «Моделизм» — социальная сеть, доска объявлений и мессенджер для hobby-сообщества.

## Структура

```
backend/     Laravel 11 API (PostgreSQL)
frontend/    Next.js (этап после API)
docs/        Планы и ADR
deploy/      Конфиги деплоя на VPS
```

## Окружение разработки

**Локально проект не разворачивается.** Рабочий цикл:

1. Разработка кода в репозитории (IDE + git)
2. Push в `git@github.com:letoceiling-coder/modelizmclub.git`
3. Деплой на **dev.modelizmclub.ru** (VPS Beget, `31.207.75.124`)
4. Миграции и проверка API на dev-сервере

| Окружение | URL | Назначение |
|-----------|-----|------------|
| dev | https://dev.modelizmclub.ru | разработка, демо клиенту |
| production | modelizmclub.ru | после Этапа 3 |

Файлы — **Selectel S3**. БД и Redis — на VPS.

## Dev-сервер

- SSH: ключ (без пароля)
- API health: `https://dev.modelizmclub.ru/api/v1/health`
- Инструкция по настройке сервера: [deploy/README.md](deploy/README.md)

## Документация

- [План БД и API](docs/PLAN-DB-API.md)

## Git

```bash
git remote add origin git@github.com:letoceiling-coder/modelizmclub.git
git push -u origin master
```
