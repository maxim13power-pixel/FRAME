# FRAME на Amvera — ранбук переезда (№209, вариант B)

Дата: 29.10.2026. Заменяет Railway (`railway.json` оставлен как исторический артефакт).

## Архитектура

```
                 ┌── frame-app.ru        (проект Amvera «frontend», окружение node/browser, nginx+SPA)
Пользователь ────┤
                 └── api.frame-app.ru    (проект Amvera «backend»,  окружение node/npm, NestJS :3000)
                                                │  внутренняя сеть Amvera (run-<be>, без шифрования)
                                                ▼
                                         PostgreSQL (managed, cnpg-<pg>-rw)
```

Amvera ищет `amvera.yaml` только в **корне** репозитория, поэтому монорепозиторий уезжает
двумя независимыми репозиториями через `git subtree`:

```powershell
git remote add amvera-be https://git.amvera.ru/<login>/<be-slug>
git remote add amvera-fe https://git.amvera.ru/<login>/<fe-slug>
.\scripts\deploy-amvera.ps1        # или -App be / -App fe
```

Конфиги: `backend/amvera.yaml` (node/npm: `prisma generate && npm run build`, запуск
`prisma migrate deploy && node dist/main`, `containerPort: 3000`), `frontend/amvera.yaml`
(node/browser: `npm install && npm run build`, артефакты `dist/*` → `/`).

> ⚠️ Amvera: «На этапе сборки переменные окружения не доступны». Поэтому все `VITE_*`
> живут в `frontend/.env.production` (закоммичен), а не в панели. Секретов там нет —
> site key капчи публичен.

## Переменные окружения бэкенда (панель Amvera → «Переменные»)

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `postgresql://frame_user:PASS@<внутренний домен PG>:5432/frame_db?schema=public&sslmode=prefer` (домен — вкладка «Домены» СУБД / «Инфо») |
| `JWT_SECRET` | 64+ случайных символов (новый — все токены Railway станут невалидны) |
| `NODE_ENV` | **`production`** (иначе капча пропускается и может вернуться `devCode`) |
| `PORT` | **`3000`** (должен совпадать с `run.containerPort`) |
| `CORS_ORIGINS` | `https://frame-app.ru,https://www.frame-app.ru,https://<fe>.amvera.io` |
| `FRONTEND_URL` | `https://frame-app.ru` (ссылки сброса пароля) |
| `SMARTCAPTCHA_SERVER_KEY` | серверный ключ Яндекс SmartCaptcha (без него prod-регистрация = 400) |
| `SMTP_HOST` | `smtp.yandex.ru` |
| `SMTP_PORT` | `465` (SSL) или `587` (STARTTLS) |
| `SMTP_USER` | полный ящик Яндекс 360, напр. `robot@frame-app.ru` |
| `SMTP_PASS` | «пароль приложения» из Яндекс ID (обычный пароль не подойдёт) |
| `SMTP_FROM` | тот же адрес, что `SMTP_USER` (иначе Яндекс отклонит письмо) |

Старые имена `BREVO_SMTP_*` / `BREVO_FROM_EMAIL` поддерживаются как алиас
(`src/auth/email.service.ts`), но на новых стендах используем `SMTP_*`.

## Порядок переезда

1. **PostgreSQL**: «Создать БД» → тариф не ниже «Начальный Плюс» → БД `frame_db`,
   пользователь `frame_user` (`postgres` зарезервирован) → включить ежедневные бэкапы.
   Для работы с локали включить домен типа **POSTGRES** (`<pg>-<user>.db-msk0.amvera.tech`, SSL prefer).
2. **Дамп Railway** (Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`):
   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' "postgresql://...railway..." `
     --no-owner --no-privileges -Fc -f "$env:TEMP\frame_railway.dump"
   ```
3. **Restore в Amvera** (внешний домен PG):
   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --no-owner --no-privileges `
     -d "postgresql://frame_user:PASS@<pg>-<user>.db-msk0.amvera.tech:5432/frame_db?sslmode=prefer" `
     "$env:TEMP\frame_railway.dump"
   ```
   Сверить `_prisma_migrations` (должно быть 17) и счётчики `User/Object/Project/EstimateItem/PriceItem`.
4. **Миграции** (те же 4, что не доехали на Railway: `access_snapshots`, `import_batches`,
   `owner_general_entities`, `can_create_projects`):
   ```powershell
   cd backend
   $env:DATABASE_URL = 'postgresql://...@<pg>-<user>.db-msk0.amvera.tech:5432/frame_db?sslmode=prefer'
   npx prisma migrate status   # 17 применённых + 4 ожидающих
   npx prisma migrate deploy   # → 21, "Database schema is up to date!"
   ```
5. **Backend**: создать проект (node/npm, 490 ₽), задать env, `.\scripts\deploy-amvera.ps1 -App be`,
   дождаться «Приложение запущено», проверить `https://<be>.amvera.io/health`.
6. **DNS (reg.ru)**: в Amvera «Настройки → Домены → Добавить доменное имя», тип HTTPS,
   тип домена «Свой»: `api.frame-app.ru` (проект backend) и `frame-app.ru` (проект frontend).
   Панель выдаст **TXT** (подтверждение владения) и **A** (IP Amvera) — внести их в зоне
   reg.ru (`ns1.reg.ru`/`ns2.reg.ru`), нажать «Применить». Сертификат Let's Encrypt выпускается сам.
7. **Frontend**: создать проект (node/browser, 290 ₽), `.\scripts\deploy-amvera.ps1 -App fe`.
   `VITE_API_BASE_URL=https://api.frame-app.ru` уже в `frontend/.env.production`.
8. **Smoke**: регистрация (капча + письмо Яндекса), вход, объект → проект, приглашение прораба,
   403 на список участников у прораба, preview/commit импорта xlsx (файл до 2 МБ),
   удаление участника со снимком, экспорт Excel/PDF, `/health`.
9. Через 3–7 дней — погасить Railway, обновить `PROJECT_STATUS.md`.

## Подводные камни

- `db:seed` в старт-команду **не ставим**: он пересоздаёт `[DEMO]`-справочник расценок
  и может порвать `priceItemId` в сметах. Справочник уже есть в дампе.
- Восстановление кластера PG на Amvera создаёт **новый** сервис → `DATABASE_URL` придётся править.
- Входящий трафик на Amvera с 26.09.2026 тарифицируется по порогам (размер/таймаут/RPM) —
  проверить загрузку Excel (лимит 2 МБ) и выгрузку PDF.
- Серверы Amvera в UTC (как и Railway) — на форматирование дат не влияет.
- После паузы >30 дней проект замораживается (артефакты удаляются, код и data остаются).
