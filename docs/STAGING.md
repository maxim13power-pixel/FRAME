# Staging-контур (проверка «как на проде», но не на проде)

> ⭐ №397, 25.11.2026. Смысл: проверять **миграции, деплой, оплату и новые фичи на отдельной
> базе**, а не на живой. Плюс staging — единственное место, где можно безопасно «сломать» данные.

## Что уже проверено (25.11.2026)

Поднял полноценный staging-экземпляр на dev-машине:

| Шаг | Результат |
|---|---|
| Пустая БД `frame_staging` | создана |
| `prisma migrate deploy` | применилась миграция `0_init` (33 таблицы с `_prisma_migrations`, 44 FK) |
| `prisma migrate status` | «Database schema is up to date!» |
| `prisma migrate diff` (staging → `schema.prisma`) | «This is an empty migration» — схема идентична |
| Бэкенд на :3101 с `DATABASE_URL` на staging | стартовал, `/health` → 200 |
| `node scripts/smoke-staging.js` (7 шагов) | 7/7 ✅: регистрация, демо-объект, проект, строка сметы, фиксация (4 из 10 = 40 %), удаление аккаунта |
| После smoke | объектов/проектов/строк — 0, пользователей — 0 |

## Как поднять локально (5 минут)

```powershell
# 1) отдельная база
docker exec frame_postgres psql -U frame_user -d postgres `
  -c "drop database if exists frame_staging" `
  -c "create database frame_staging owner frame_user"

# 2) схема ТОЛЬКО миграциями (как на проде)
cd C:\PROJECTS\frame-app\backend
$env:DATABASE_URL="postgresql://frame_user:frame_pass@127.0.0.1:5433/frame_staging?schema=public"
npx prisma migrate deploy
npx prisma migrate status          # → up to date

# 3) второй экземпляр бэкенда на свободном порту, со своим каталогом фото
#    (см. пример run-staging.cmd: PORT=3101, PHOTO_STORAGE_DIR=<временный каталог>)
npx ts-node src/main.ts

# 4) smoke
node scripts/smoke-staging.js                         # по умолчанию :3000
$env:API_BASE="http://127.0.0.1:3101"; node scripts/smoke-staging.js
```

Что важно:

- **Не останавливайте dev-серверы** (:3000/:5000) — staging живёт на своём порту.
- `PHOTO_STORAGE_DIR` у staging должен быть **свой** каталог, иначе фото смешаются с dev.
- Алерты на staging лучше выключить (`TELEGRAM_ALERT_*` пустые) — иначе тестовые ошибки
  полетят в боевой канал.

## Smoke-скрипт (`backend/scripts/smoke-staging.js`)

7 шагов, без Prisma напрямую (только HTTP): health → регистрация по коду → демо-объект →
проект → строка сметы с ценами → фиксация (проверяет `totalUsed` и процент) → удаление
аккаунта. Создаёт только `*@local.test`, данные реальных пользователей не трогает.

Пригодится после **каждого** деплоя на прод:

```bash
API_BASE=https://api.frame-app.ru node scripts/smoke-staging.js
```

Особенность: `DELETE /users/me` — это **обезличивание** (email = null), строка пользователя
остаётся. На staging её можно убрать `delete from "User" where email is null;`, на проде такая
запись безвредна (никаких ПДн, кроме истории).

Для прода нужен доступ к коду из письма: на проде `devCode` не возвращается, поэтому smoke
либо запускают на стенде с тестовым SMTP-ящиком, либо проверяют первые 5 шагов вручную.

## Staging на Amvera (прод-подобно)

1. Отдельная база PG (не продовая!) → строка подключения в env второго проекта.
2. Второй проект приложения из того же репозитория (`amvera.yaml` уже делает
   `prisma migrate deploy`) — так проверяется именно деплой-путь.
3. Env: `DATABASE_URL` (staging), `JWT_SECRET` (свой!), `CORS_ORIGINS` (staging-фронт),
   `SMTP_*` (можно тестовый ящик), алерты — выключены или отдельный канал.
4. После деплоя: `API_BASE=https://<staging-be> node scripts/smoke-staging.js`.

## Чего staging не закрывает

- Реальные платежи и чеки (для них — тестовый режим эквайринга, этап 1).
- Настоящую почту/домен (SPF/DKIM проверяются на проде).
- Нагрузку и отказоустойчивость (для этого — отдельный нагрузочный прогон).

## Уборка

`frame_staging` можно удалять/пересоздавать в любой момент: это стенд, данных пользователей
там быть не должно. Если нужно сохранить состояние для разбора дефекта — сделайте дамп
(`npm run db:backup` с `DATABASE_URL` на staging) и приложите к задаче.
