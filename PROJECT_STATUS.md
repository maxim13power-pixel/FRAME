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
- ✅ P1-1 Baseline-миграция создана (20260920000000_baseline_all_tables, 12 таблиц + 5 enum),
  история миграций сконсолидирована — чистая БД поднимается через `npx prisma migrate deploy`.
- ✅ Подготовка к первому деплою завершена (блокеры B/C/D + мелочи):
  B) backend/.env.example = BREVO_SMTP_HOST/PORT/USER/PASS + BREVO_FROM_EMAIL (убраны неиспользуемые BREVO_API_KEY/BREVO_SENDER_*);
  C) frontend/.env.example = VITE_API_BASE_URL/VITE_APP_URL/VITE_API_URL(override)/VITE_SMARTCAPTCHA_CLIENT_KEY;
  D) frontend railway.json: `npm run preview` → `serve -s dist -l tcp://0.0.0.0:$PORT` (SPA-fallback);
  docker-compose healthcheck → `pg_isready -U frame_user -d frame_db`; backend .gitignore +`*.tsbuildinfo`;
  удалён мусор из репо (Stop=SilentlyContinue, cline-diff-frontend.txt, full-structure.txt, fe-dev.log, lint-fe.log).
- ✅ Мобильный UX (ветка cline-mobile-summary): сводная плашка «Смета/Факт/Освоено» в Materials.tsx
  скрывается при скролле вниз и выезжает при скролле вверх — хук useScrollDirection.ts (passive + rAF,
  порог 8px, cleanup при unmount), transform: translateY + transition 0.2s ease; скрытие только на мобилке
  (<900px, десктоп всегда видим); tsc -b и npm run build → 0.
- ✅ Мобильный UX v2 (ветка cline-mobile-summary-v2): плашка «Смета/Факт/Освоено» больше не
  перекрывает BottomNav — z-index 9 (< BottomNav 10), bottom = 56+8px, при скролле вниз уезжает
  translateY(calc(100% + 64px)) ПОД меню; короткий контент без скролла → useScrollDirection
  возвращает 'none' (scrollHeight ≤ innerHeight) и плашка становится position: static, поэтому
  кнопка «Зафиксировать объём» всегда доступна; добавлен отступ списка, чтобы последняя карточка
  не пряталась под плашку; tsc -b и npm run build → 0.


## 3. P1 — ПЛАН ЧАТА №10 (по порядку)
1. ✅ ГОТОВО: Baseline-миграции (prisma migrate diff --from-empty → одна baseline-миграция,
   старые add_models/float_to_decimal/add_indexes заменены; чистая БД = migrate deploy OK).
2. materials.service.update(): FOR UPDATE + totalCost от заблокированного totalUsed;
   то же в updateSpecQty; enforce isSpecLocked (409); lastEntry/lastEntryDate в editLastFix;
   orderBy tie-break [{fixedAt desc},{id desc}].
3. Деньги Float → Decimal(14,2) (объёмы 14,3) — отдельный шаг с бэкапом БД.
4. ✅ ГОТОВО: Деплой-блокеры: tsconfig.build.json rootDir=src (dist/main.js!); .env.example×2;
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

---

# ДОРОЖНАЯ КАРТА «ПО ФАКТУ» (аудит репозитория, 19.09.2026)

> Ниже — переписанная карта по реальному состоянию кода (git/схема/пакеты/страницы),
> НЕ по исходному брифу. P1-бэклог из v15 уже закрыт (см. раздел A).

## A. Фактическое состояние (сверено с репозиторием)

### Стек (реальный)
| Слой | Факт |
|---|---|
| Backend | NestJS 11, Prisma 5.22, PostgreSQL 15 (Docker localhost:5433), Node >=20, порт 3000 |
| Frontend | React 19, TS 5.9, MUI 6.5, Vite 7, react-router-dom 7, порт 5000 |
| Деплой | Railway (railway.json в be+fe); остаток vercel.json во frontend |
| Мобилка | НЕТ — Capacitor заявлен в статусе, но в package.json отсутствует |
| Git | 168 коммитов; ветка cline-terms-privacy (не в main), 2 файла не закоммичены |

### Готово (подтверждено кодом)
Авторизация (email ИЛИ phone, forgot/reset, капча Яндекс, Brevo), объекты,
проекты, материалы (MaterialFix + спецификация + замок + snapshot цен), расценки
(работы/материалы, приватные), согласования ChangeRequest (детерминированный
доступ, stripPrices, FOR UPDATE), аренда Rental, доступы/инвайты ObjectAccess +
hidePrices, Dashboard (бэкенд dashboard.service.ts), Home, **Calculators (есть!),
Help (полноценный хелп-центр, НЕ заглушка)**.

### P1 из статуса v15 — УЖЕ ВЫПОЛНЕН (merged)
| Коммит | Пункт | Статус |
|---|---|---|
| №102 | materials race (FOR UPDATE, 409, lastEntryDate) | ✅ |
| №103 | Float→Decimal(14,2/14,3) + миграция + parseDecimal | ✅ |
| №104 | deploy-blockers (railway.json, health, SPA-fallback, postinstall) | ✅ |
| №105–106 | ObjectAccess детерминированный резолв + 5 индексов | ✅ |
| №99–101 | фронт-архитектура (React.lazy, единый api, safeParse) | ✅ |
| №100 | materials DTO @ValidateNested | ✅ |
| baseline | 5 миграций на месте (не только db push) | ✅ |
| P1-8 | Terms/Privacy реквизиты | ⏳ в работе на cline-terms-privacy, не в main |

### Что реально НЕ готово
1. **Заглушки (5 шт.):** Brigades, Warehouse, Analytics, Reports, Users (Help — не заглушка).
2. **Биллинг:** ноль — нет модели Subscription, нет модуля, нет тарифов в коде.
3. **Мобилка:** нет ни Capacitor, ни Android-кода.
4. **Terms/Privacy:** реквизиты «ООО КОНСУЛ / ИНН 6311077769» помечены «заменить на реальные».
5. **Техдолг-мусор:** `change/change.service copy.ts.txt` (17КБ), `Home copy.tsx`,
   `Home copy 2.tsx.txt`, `Login copy.tsx`, `frontend/test-app/` (дубль скаффолда), `vercel.json`.
6. **Две модели ролей:** `User.role` (ADMIN/STORE_MANAGER/FOREMAN/CUSTOMER — STORE_MANAGER
   и ADMIN не используются) и `AccessRole` (CUSTOMER/FOREMAN/VIEWER). Модели `Brigade` в схеме нет.

## B. Фазы (приоритет: веб → биллинг → RuStore)

### Фаза 0 — Закрыть хвосты и зафиксировать веб-релиз (1–2 нед., P0)
| Задача | Критичность | Зависимости |
|---|---|---|
| Реальные реквизиты ООО (ИНН/ОГРН/КПП/адрес/email) в Terms/Privacy, merge cline-terms-privacy | P0 | юрист |
| Проверить, что деплой гонит `prisma migrate deploy`, а не `db push` | P0 | №104 |
| Убрать мусор: change.service copy, Home/Login copy, test-app/, vercel.json | P2 | — |
| Регресс deploy-блокеров (health, SPA-fallback) + живой тест Аренды | P0 | №104, №98 |

### Фаза 1 — Закрыть 5 заглушек + контракт Entitlements (4–6 нед., P0)
| Задача | Критичность |
|---|---|
| Бригады: модель Brigade + связи ObjectAccess + фронт (создание/состав/назначение) | P1 |
| Склад: модели Warehouse/Movement (приход/расход/остаток) + фронт | P1 |
| Аналитика: агрегация затрат/объёмов по объекту/проекту + фронт | P1 |
| Отчёты: выгрузка сметы/затрат (PDF/XLSX, минимум) | P1 |
| Пользователи: список + роли + управление доступом | P1 |
| Entitlements-контракт (права по тарифу) — мост к биллингу | P0 |

### Фаза 2 — Биллинг (ООО + НДС) (4–6 нед., P0)
| Задача | Критичность |
|---|---|
| Выбор агрегатора/эквайринга (приём карт юр. лицом, 54-ФЗ, НДС-чеки) | P0 |
| Модель данных: Plan, Subscription, Invoice, Payment, Receipt (НДС) | P0 |
| Оплата + вебхуки + идемпотентность + сверка | P0 |
| Профиль подписки: апгрейд/даунгрейд/отмена/продление | P0 |
| Enforce Entitlements на сервере, заморозка при неоплате | P0 |
| Документы (счёт/акт/чек) + возвраты | P1 |

### Фаза 3 — Ценность тарифа «Бригада» + P2-безопасность (6–8 нед., P1)
| Задача | Критичность |
|---|---|
| Мультипользовательские роли внутри бригады, приглашение по ссылке | P1 |
| Полный склад: переносы, инвентаризация, списание | P1 |
| Отчёты/аналитика факт-план, экономика объекта (маржа/перерасход) | P1 |
| Лимиты мест/бригад в биллинге | P1 |
| P2-security: refresh-токены, Throttler на auth, пароль min 8, Sentry+audit-log | P1 |

### Фаза 4 — Мобилка (Capacitor → RuStore) (8–12 нед., P1)
| Задача | Критичность |
|---|---|
| Подтвердить Capacitor v2 (обёртка над React) vs натив — см. вопросы | P0 |
| Полевые сценарии: вход, объекты, материалы, согласования, фото | P1 |
| Офлайн фиксаций объёмов + синхронизация | P1 |
| Пуш-уведомления (согласования, оплата) | P2 |
| Подпись + RuStore: приватность, signing, listing, целевая 34 | P0 |

### Фаза 5 — Рост (постоянно, P2)
Онбординг/NPS, рефералки, воронка (PostHog), производительность (индексы/кэш),
поддержка + база знаний, корпоративный тариф.

## C. Диаграмма Ганта (текстовая)

```
Неделя от старта                1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Фаза 0 Хвосты + веб-релиз       ██
Фаза 1 Заглушки + Entitlements     ████ ████ ████ ████ █
Фаза 2 Биллинг (НДС)                              ████ ████ ████ ████ █
Фаза 3 Ценность «Бригада»                                            ████ ████ ████ ████ ███ ██
Фаза 4 Мобилка (RuStore)                                                                 ████ ████ ████ ████ ████ ████ ████ ██
Фаза 5 Рост                                                                                                               ███ ███ ███ ███
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Вехи                                ▲Web released   ▲First revenue      ▲Бригада-ready          ▲RuStore Live       ▲$5000 MRR
```

- **First revenue** (первая оплата подписки): конец Фазы 2 ≈ неделя 12–15.
- **RuStore Live**: конец Фазы 4 ≈ неделя 26–32.
- **$5000 MRR** — целевая веха, зависит от Фаз 3–5 и маркетинга.

## D. Сводный реестр рисков (по факту репозитория)

| # | Риск | Вер. | Влияние | Митигация |
|---|---|--------|---------|-----------|
| R1 | Terms/Privacy содержат чужие/заглушечные реквизиты (ООО КОНСУЛ) — штраф, блокировка стора | Выс. | Крит. | Заменить на реальные реквизиты до merge; юрист валидирует оферту |
| R2 | Деплой ещё гонит `db push` → чистая/новая БД = P2021 | Сред. | Выс. | Верифицировать `prisma migrate deploy` в Railway; smoke-тест на пустой БД |
| R3 | Без биллинга нет выручки — цель $5000 недостижима | В. | Крит. | Фаза 2 сразу после заглушек; агрегатор выбирать параллельно |
| R4 | Capacitor не установлен — факт расходится со статусом | В. | Выс. | Зафиксировать платформу мобилки ДО Фазы 4 (Capacitor vs натив) |
| R5 | Две модели ролей (User.role vs AccessRole) → рассинхрон прав | Сред. | Выс. | Свести к одной модели до Фазы 1-3 |
| R6 | Ошибки НДС/чеков/возвратов → штраф, блокировка эквайринга | Сред. | Крит. | Юрист валидирует чеки до прода; идемпотентность + сверка |
| R7 | Хлам в коде (копии, test-app) ломает сборку/линтинг | Низ. | Сред. | Удалить в Фазе 0; git rm |
| R8 | Мобильная офлайн-синхронизация нестабильна | Сред. | Выс. | Сузить офлайн до объёмов+фото; last-write-wins |

## E. Метрики успеха по фазам

| Фаза | Метрики (таргет) |
|------|------------------|
| 0 | Terms/Privacy с реальными реквизитами; `migrate deploy` зелёный; 0 deploy-блокеров |
| 1 | 5/5 заглушек рабочие; Entitlements-контракт готов; defect density ≤ 1 P0/P1 |
| 2 | Первая оплата; auth success ≥ 90%; отказы повторных списаний ≤ 5%; churn ≤ 5%; сверка 0 расхождений |
| 3 | Апселл Прораб→Бригада ≥ 15%; NRR ≥ 100%; активация функций Бригады ≥ 60% |
| 4 | Публикация RuStore; рейтинг ≥ 4.0; MAU mobile ≥ 50%; crash-free ≥ 99.5% |
| 5 | **MRR ≥ $5000**; LTV/CAC ≥ 3; NPS ≥ 40 |

## F. Вопросы для уточнения

**Юр./биллинг**
1. Какие реальные реквизиты ООО вписывать в Terms/Privacy (сейчас «ООО КОНСУЛ / ИНН 6311077769» — заглушка)?
2. Какой платёжный агрегатор согласован под ООО с НДС (ЮKassa/CloudPayments/Робокасса/СБП)? Онлайн-касса по 54-ФЗ?
3. Тарифы «с НДС» или «НДС сверху»? Цены зафиксировать (490/1990 ₽ или новые)?

**Продукт/аудитория**
4. Кто платит: прораб (ИП/самозанятый) или заказчик?
5. Нужен trial/freemium и какой длительности?
6. Какие 2–3 «полевых» сценария прораба самые частые (для мобильного MVP)?

**Технология (mobile)**
7. Мобилка: **Capacitor (обёртка над React)** или **нативный Android (Kotlin)**? Капаситор в статусе заявлен, но не установлен.
8. Какие сценарии обязаны работать офлайн?
9. RuStore: разрешены ли встроенные подписки для нашего ООО, или Deep-Link на веб-оплату?

**Приоритет/ресурсы**
10. Размер команды и часы (для точной калибровки сроков)?
11. Подтверждаете последовательность веб → биллинг → RuStore, или нужен ранний мобильный build?
12. Есть ли бюджет на агрегатор/юриста/рекламу до первых денег?

---
