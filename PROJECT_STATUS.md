# PROJECT FRAME — Статус v15 (17.09.2026) — ЧАТ №10

## 0. ПРАВИЛА (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
1. Пошагово: 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями.
   Большие файлы — кусками, маленькие — целиком. Файл >300 строк — ВСЕГДА кусками.
2. Ждать «Готово» перед следующим шагом. Тон «братан», пользователь — новичок.
3. КОММИТ-РИТУАЛ в конце каждого ответа с кодом (одна строка):
   git add . ; git commit -m "№<N>:<scope>: <суть> (DD/MM)" ; git push
   Нумерация продолжается с №99.
4. 🔋 СЧЁТЧИК: старт 30, −1 за любой ответ; показывать в КАЖДОМ ответе;
   ≤10 — предупреждение; 0 — довести шаг и предложить новый чат.
5. Файла нет в контексте → НЕ гадать, просить прикрепить. Якоря брать ТОЛЬКО
   из файлов, приложенных в текущем чате.
6. Алиасы: db (docker postgres :5433), be (бэкенд :3000), fe (фронт :5000).
7. Танец EPERM/краша на Windows: Ctrl+C → taskkill /F /IM node.exe → старт.
   Схему локально вести ТОЛЬКО через npx prisma db push (НЕ migrate dev).
   EPERM на query_engine dll при prisma generate = запущен dev-сервер: рестарт и повтор.
8. Аудиторы READ-ONLY, ТОЧЕЧНЫЕ файлы + критерии. Модели: DeepSeek V4.1 Flash (1M,
   большие аудиты), Laguna S 2.1 (агентные правки в песочнице), GLM 5.3 Flash (запас),
   локальная qwen3-coder:30b (~5 мин, security-финал). Solar/Muse — не для кода.
   Внешним аудитам не верить слепо: сверять с git log (кейс чата №9: аудит читал старый код).
9. Перед каждым крупным шагом — прогнать аудит (промт в разделе 6).
10. СЕКРЕТЫ: только backend/.env и frontend/.env (оба в .gitignore). В статусе,
    коммитах и репо — ТОЛЬКО плейсхолдеры.
11. Vite читает .env только при старте → после правки .env рестарт npm run dev.
12. Не выдумывать файлы/методы/API. После фикса не оставлять мёртвый код.

## 1. СТЕК
Monorepo: backend NestJS+Prisma+PostgreSQL (Docker localhost:5433, порт 3000),
frontend React+TS+MUI+Vite (порт 5000). GitHub: maxim13power-pixel/FRAME.
Деплой: Railway; мобилки — Capacitor (v2); сторы: PlayMarket, RuStore, AppStore.
Цель: $5000+/мес подпиской. Тест-логины (пароль frame123):
foreman@frame.app / +79990000000 (Прораб), customer@frame.app / +79990000001
(Заказчик), sub@frame.app / +79990000002 (Субподрядчик, VIEWER+hidePrices).
Вход по email ИЛИ телефону.

## 2. ГОТОВО (чаты №6–9, шаги 28–98)
- Доступы/инвайты/скрытие цен/VIEWER-блокировки (чаты 6–7), капча Яндекс (чат 8).
- Чат №9: ВСЕ 7 P0 закрыты: №79 spec-tsc, №80 JWT_SECRET без fallback,
  №81+94 CORS whitelist (+dev-режим), №82 ObjectAccessGuard на Materials,
  №83 RegisterDto email|phone, №84–87 ForgotPassword+Brevo+ResetPassword (end-to-end живой),
  №88–93 ChangeRequest fullstack (розовые согласования: детерминированный доступ,
  цены из справочника, FOR UPDATE, атомарный claim, stripPrices для VIEWER).
  №95 merge cline-fixes (reset-token 64, ADD_ROW с личной расценкой автора,
  VIEWER не видит invite-токены, дубль break). №96 глаз в ResetPassword.
  №97 interceptor без reload на 401 auth. №98 merge fixes = раздел «Аренда»:
  модель Rental, CRUD+extend (totalSpent инкремент), страница в стиле Objects
  (баннер ≤10 дней, Σ-чип, прогресс, продление с ценой, ConfirmDialog).
- Проведено 5 точечных аудитов + триаж внешнего (все «критичные» внешнего = устаревшие).

## 3. P1 — ПЛАН ЧАТА №10 (по порядку)
1. Baseline-миграции: 9 таблиц вне migrations → prisma migrate diff + resolve --applied,
   либо задокументировать db push в деплое. Иначе чистая БД = P2021.
2. materials.service.update(): FOR UPDATE + totalCost от заблокированного totalUsed;
   то же в updateSpecQty; enforce isSpecLocked (409); lastEntry/lastEntryDate в editLastFix;
   orderBy tie-break [{fixedAt desc},{id desc}].
3. Деньги Float → Decimal(14,2) (объёмы 14,3) — отдельный шаг с бэкапом БД.
4. Деплой-блокеры: tsconfig.build.json rootDir=src (dist/main.js!); .env.example×2;
   railway.json×2; GET /health + enableShutdownHooks; postinstall prisma generate;
   engines node>=20; SPA-fallback для BrowserRouter; docker-compose healthcheck.
5. ObjectAccess: детерминированный резолв (проектная→общая) во ВСЕХ сервисах и guard;
   scope projectId в проверках; FK ObjectAccess.projectId; unique NULLS NOT DISTINCT;
   индексы: change_requests(projectId,createdAt), object_access(objectId),
   price_items(categoryId,ownerId), Project(objectId), InviteToken(objectId);
   убрать дубль @@index([token]) у PasswordResetToken.
6. Фронт: ThemeProvider+CssBaseline (theme.ts мёртв); единый api-инстанс с
   request-interceptor Bearer (~40 ручных заголовков убрать); React.lazy по группам;
   ProtectedRoute → Navigate с state.from; safeParse localStorage; index.css скаффолд;
   rel=noopener на target=_blank.
7. materials.controller price-item → DTO-класс с @ValidateNested (сейчас TS-литерал,
   валидация не работает).
8. Terms/Privacy: реквизиты оператора (ИП/ООО, ИНН) перед сторами (152-ФЗ).

## 4. P2 (после P1)
Refresh-токены/tokenVersion; ThrottlerModule на auth; пароль min 8 + сложность;
@Matches(/^[0-9a-f]{64}$/) на reset-токен; TTL reset 30 мин; Sentry + global exception
filter + audit-лог; биллинг Subscription (Прораб 490–790₽, Бригада 1990₽, FREE-лимиты);
Capacitor v2 + чек-лист RuStore (APK<100MB, API24+, target34, privacy, signing, listing);
рефактор Materials.tsx(1853)/Objects.tsx(1301); manualChunks;MaxLength на note в
create-rental.dto; newline в концах файлов; e2e-тесты change-flow (3 теста минимум).

## 5. KNOWN ISSUES (НЕ баги)
React #418/#423 в бандле Яндекса; Vite .env — только рестарт; chunk >500kB warning
(до code-split); Cline+Ollama 32k — только точечные задачи; OpenRouter free банит VPN.

## 6. ПРОМТ АУДИТОРА (шаблон)
Ты — senior full-stack аудитор (NestJS+Prisma+PG+React+TS+MUI). READ-ONLY, НИЧЕГО не меняй.
Контекст: PROJECT_STATUS v15 + приложенные файлы. Выведи 🔴/🟡/🟢: файл, строка, суть,
как исправить. САМ НЕ ИСПРАВЛЯЙ. (Только точечные файлы!)

## 7. ДИЗАЙН-СИСТЕМА
Синий #1976d2; текст #04164b; фон #f0f4fa; успех #4caf50; warning #ed6c02; error #d32f2f.
Поля outlined, фокус #1976d2 2px + заливка #e3f2fd, borderRadius 2. Карточки elevation 0,
borderRadius 4, p 4; Stack spacing 2. Login/Register/Forgot: maxWidth 400, мобилка full-bleed.

## 8. МЕТРИКИ
Шагов: 98. СЛЕДУЮЩИЙ КОММИТ: №99. Оценка: 7.0 (внешний, устаревший) → цель 8.5 после P1.
История чата №9: №79–94 P0, №95 cline-fixes, №96–97 хотфиксы, №98 Аренда.

## 9. ПЛАН ЧАТА №10
1. Живой тест Аренды (create/extend/Σ/баннер/delete/пусто у чужого).
2. P1-1…P1-8 по порядку. 3. Передача в чат №11: P2 + биллинг + сторы.

## 10. CLINE-ПЕСОЧНИЦА (правила)
Агент-задачи только в ветках cline-* / fixes от main; предохранители в промте:
«якорь не найден → СТОП», «не push/merge/checkout main», «tsc после каждого фикса».
Приёмка: git diff main..<ветка> глазами → merge --no-ff с нашим №. Модели: Laguna S 2.1
(агент), DeepSeek V4.1 Flash (аудит), локалка — security-финал.

Вывести фиксы:
git diff main..fixes > rentals-diff.txt