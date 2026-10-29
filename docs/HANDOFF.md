# FRAME — карточка состояния для нового чата

Дата: 29.10.2026. Репозиторий: `C:\PROJECTS\frame-app`, ветка `main`. Актуальный коммит — №209 (§55, подготовка переезда на Amvera); `origin/main` отстаёт на него (не запушен).
Подробная история решений — `PROJECT_STATUS.md`, разделы **§52–§54** (самое свежее), §37–§51 — долги аудита.

## Что это за проект
FRAME — учёт строительных объектов: объекты → проекты → сметы (материалы/работы), склад, бригады,
отчёты, аналитика, справочники цен, доступы участников.

- backend: NestJS + Prisma + PostgreSQL (dev: `localhost:5433`, БД `frame_db`), порт **3000**
- frontend: React + Vite + MUI, порт **5000**
- Прод сейчас: Railway; **следующий шаг — переезд на Amvera** (миграции + env)

## Команды

```powershell
# проверки (lint + jest + tsc + vite build) — БЕКЕНД ПЕРЕД ЭТИМ ОСТАНОВИТЬ
cd C:\PROJECTS\frame-app; npm run verify
cd backend; npx jest            # 25 сьютов / 193 passed / 2 todo
cd backend; npx prisma migrate status
cd backend; npx prisma migrate deploy   # применять миграции

# деплой на Amvera (№209, вариант B: два отдельных репозитория Amvera)
.\scripts\deploy-amvera.ps1              # или -App be / -App fe
.\scripts\db-migrate-railway-to-amvera.ps1 -RailwayUrl <railway> -AmveraUrl <amvera> -RunMigrations
```

⚠️ Гоча: `nest build` (внутри `verify`) виснет/ломает `dist`, если запущен `start:dev` — сначала убить backend-ноды (и вотчер `nest start --watch`!), потом verify, потом поднять снова.
⚠️ Гоча Windows: PowerShell 5.1 читает .ps1 без BOM как ANSI — наши скрипты в `scripts/` записаны **с BOM**, не пересохранять без него.

Запуск dev-серверов (detached, чтобы не держать сессию):
```powershell
$log = Join-Path $env:TEMP 'frame-backend-dev.log'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = "cmd /c npm --prefix backend run start:dev > `"$log`" 2>&1"; CurrentDirectory = 'C:\PROJECTS\frame-app' }
```

## Состояние кода (всё в main, запушено)

| № | Тема | Коммит |
|---|---|---|
| §52 №206 | регистрация в dev: капча без серверного ключа пропускается, `devCode` в ответе | `6919fb3` |
| §53 №207 | S1+S2 модель доступа по решению владельца | `0b5e06c` |
| §54 №208 | S3 импорт сметы по решению владельца | `6b4b79a` |
| — | `POST /objects` отдаёт флаги прав создателя | `e4bcdbe` |
| §55 №209 | подготовка переезда Railway → Amvera (вариант B): amvera.yaml, прод-конфиг фронта, скрипты | последний |

### Действующая модель доступа (№207)
- `canManage` (команда) = **только `CUSTOMER` с объектным доступом**. «Прораб-менеджер» (`isManager`) упразднён; колонка в БД осталась как история, в правах не участвует.
- `ObjectAccess.canCreateProjects` — право прораба создавать проекты; выдаётся админом объекта при приглашении/в команде или автоматически при одобрении заявки (`access-request.approve`).
- `projects.create`: `CUSTOMER` или `canCreateProjects`, иначе 403 «отправьте заявку».
- Удаление участника — **hard delete** всех его грантов (`DELETE /objects/:id/access/:accessId`), но сначала снимаются личные копии: шаблоны смет + `AccessSnapshot` (read-only, `/me/snapshots`). Восстановления нет.
- `hidePrices` задаётся **только при приглашении**, у существующего участника не меняется.
- Ответы объектов содержат: `canManage`, `canCreateProjects`, `participantsCount` (счётчик только тем, кто управляет).
- Роль `ADMIN` в профиле не показывается (чип «Суперадмин FRAME» убран), права админа сохранены.

### Импорт сметы (№208)
- «Из шаблона» → меню: «Добавить из шаблона» / «Импорт из Excel» / «Скачать пустой шаблон».
- Шаблон — **пустой** .xlsx (лист «Смета» + «Как заполнять» + скрытый `_meta`).
- Парсер читает нашу выгрузку: «По спецификации» → количество, `_meta` (frameExport/columnsVersion/projectId/projectName/objectName/includePrices).
- Цены из файла → **всегда новый справочник** «Импорт «файл» — дд.мм.гггг чч:мм» (+ категория «Импорт из Excel»); материалы получают цену и `priceItemId` из него.
- Строки без цены пишутся с 0 и помечаются «без цены»; дубли при повторном импорте **разрешены** (ключ строки уникален внутри партии).
- Скрытые цены + цены в файле ⇒ 403. Файл из другого проекта ⇒ предупреждение, импорт разрешён.
- Ошибки: повреждённый файл / нет листа / нет шапки «Наименование» / пустой список / >500 строк.

## Dev-окружение: что важно знать
- `backend/.env` **не содержит** `SMARTCAPTCHA_SERVER_KEY` и SMTP — в dev капча пропускается, `devCode` приходит в ответе (в проде так нельзя).
- `NODE_ENV=production` обязателен на стенде: иначе капча без серверного ключа пропускается и `devCode` может уехать в ответ.
- SMTP (№209): переменные `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM`, старые `BREVO_*` — алиас. Прод — **Яндекс 360** (`smtp.yandex.ru:465`, пароль приложения), Brevo из РФ не работает.
- Vite-переменные прода лежат в **`frontend/.env.production`** (закоммичен): на Amvera env недоступны на этапе сборки. `frontend/.env` — только для dev (там site key капчи).
- Dev-БД чинилась: была в состоянии «`db push` без истории миграций»; сейчас `db push` + `migrate resolve --applied` для четырёх миграций, `migrate status` = «Database schema is up to date!» (21 миграция). В `_prisma_migrations` 22 строки — 21 применённая + 1 откаченная (`20261029140000_access_snapshots`), это норма.

## Что осталось
1. **Переезд Railway → Amvera (№209, вариант B)** — подготовка сделана (`amvera.yaml` в обоих модулях, `frontend/.env.production`, скрипты `deploy-amvera.ps1` / `db-migrate-railway-to-amvera.ps1`, ранбук `docs/AMVERA.md`). Осталось сделать в панелях: PG на Amvera + внешний домен POSTGRES → перенос данных (dump/restore + `migrate deploy` 4 миграций) → проекты backend/frontend + env → DNS reg.ru (`frame-app.ru`, `api.frame-app.ru`) → smoke.
2. Отложено осознанно: **F13/F15** — слой capabilities (~18 файлов, ~17 локальных `assert*`), рискованно и без пользовательской ценности до запуска.
3. Опционально: удалить неиспользуемую колонку `object_access.isManager` отдельной миграцией.
4. Мелочи на будущее: лимит 2 МБ на JSON/файл импорта; `prices.catalogName` строится по времени — повторный preview даёт другое имя.

## Правила работы
- Коммиты — осмысленные, по-русски, с номером задачи (`№NNN: ...`); документация каждой итерации — в `PROJECT_STATUS.md` новым разделом.
- Перед каждым коммитом: `npx tsc --noEmit` (be), `tsc -b` (fe), `npx jest`, `npm run verify`.
- Токен-экономия: не перечитывать файлы целиком без нужды, точечные `Select-String`/чтение диапазонов.
