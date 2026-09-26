# PROJECT FRAME — Статус v17 (26.09.2026) — ПЕРЕДАЧА В ЧАТ №11

## 0. ПРАВИЛА ДЛЯ ЧАТОВ QWEN (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
1. Тон «братан», пользователь — новичок. Пошагово с якорями.
2. 🔋 СЧЁТЧИК: старт 30, −1 за ответ, ≤10 предупреждение, 0 — довести шаг и новый чат.
3. КОММИТ-ритуал одной строкой: git add . ; git commit -m "№<N>:<scope>: суть (DD/MM)" ; git push.
4. МЕРЖ-ритуал одной строкой: git checkout main ; git merge --no-ff <ветка> -m "Merge №<N>: суть" ; git push.
5. Перед промтом Cline указывать МОДЕЛЬ + МОЩНОСТЬ (таблица в .clinerules/project.md §5).
6. Секреты только в backend/.env и frontend/.env (оба в .gitignore).
7. Прод ТОЛЬКО `migrate deploy`, локально ТОЛЬКО `db push`. EPERM на generate = запущен dev-сервер.
8. Не выдумывать файлы/API. Мёртвый код не оставлять.

## 1. СОСТОЯНИЕ (свёрнуто)
**Стек:** backend NestJS 11+Prisma 5.22+PG 15 (:3000), frontend React 19+TS 5.9+MUI 6.5+Vite 7 (:5000, прод — serve -s dist).
**Деплой:** Railway (3 сервиса: postgres, be, fe). Миграции: единый baseline, `prisma migrate deploy` в startCommand be.
**Цель:** $5000+/мес (421 000 ₽). **Тест-логины (frame123):** foreman@frame.app (Прораб), customer@frame.app (Заказчик), sub@frame.app (VIEWER+hidePrices).
**Готово (шаги 28–114):** авторизация (email|phone, forgot/reset, капча, Brevo), объекты/проекты/материалы (FOR UPDATE, isSpecLocked 409, lastEntryDate), расценки, согласования (stripPrices), аренда, доступы/инвайты (детерминированный резолв), Dashboard, Home, 24 калькулятора, Help (полноценный).
**Шаги 99–114 (чат №10):** фронт-архитектура (api.ts, React.lazy×23, safeParse, soft logout, lint 68→0, manualChunks B), Decimal миграция, deploy-блокеры (railway.json, /health, shutdownHooks, SPA-fallback), baseline-миграция (squash 5→1), incremental+deleteOutDir фикс, env-контракты Brevo/Vite, migrate deploy в пайплайне, скрытие 5 заглушек, tooling (npm run verify, .clinerules, CI, компактный статус).
**Аудит 21.09:** безопасность/P1 🟢; 2 🔴 блокера деплоя — закрыты в №112.

## 2. БЛИЖАЙШИЕ ШАГИ
1. ФАЗА 1 заглушки (срез фичи, порядок по ценности): Users(участники) → Reports(XLSX/PDF) → Analytics → Brigades → Warehouse.
2. ДЕПЛОЙ на Railway по чек-листу §3 + smoke-тест (параллельно, как решится Q1: домен).
3. ФАЗА 2 биллинг: ЮKassa, НДС 22% включён, Plan/Subscription/Payment/PaymentEvent(idempotency), SubscriptionGuard, trial 14д→FREE, grace 3д.
4. TRACK B (параллельно, бюрократия): Реестр ПО (45 дн, льгота +45% маржи), УКЭП, RuStore Console, ставка НДС 22% ДО первого платежа, уведомление РКН.
5. ФАЗА 3 мобилка: Capacitor + офлайн-очередь + RuStore Pay SDK (BillingClient отключён 01.08.2026) + анти-WebView ценность.
6. ПРЕД-РЕЛИЗ: плейсхолдеры в Terms/Privacy, e2e change-flow ×3, Sentry, Throttler, refresh-токены, пароль min 8.

## 3. DEPLOY-ЧЕК-ЛИСТ (Railway)
1. Домен (frame-app.ru/frame.app) → купить.
2. Railway: проект FRAME → postgres (Railway DB), backend (root backend/), frontend (root frontend/).
3. be env: DATABASE_URL, JWT_SECRET (crypto.randomBytes(64).hex), CORS_ORIGINS, FRONTEND_URL, SMARTCAPTCHA_SERVER_KEY, BREVO_SMTP_* (из .env.example).
4. fe env ДО build (Vite впекает!): VITE_API_BASE_URL, VITE_APP_URL, VITE_SMARTCAPTCHA_CLIENT_KEY.
5. Deploy be → в логах «migrate deploy applied» → GET /health = 200.
6. Deploy fe → / = 200, deep-link /objects = 200 (serve -s SPA-fallback).
7. Smoke: регистрация → письмо → сброс → логин → объект → материал (10.5) → фикс 0.5 → аренда → logout.
8. Домен: DNS → Railway, SSL auto; обновить env → редеплой fe.
9. Daily backups Railway postgres + тест восстановления.

## 4. ОТКРЫТЫЕ РЕШЕНИЯ (ответить в чате №11)
Q1 Домен: frame-app.ru или frame.app?
Q2 Биллинг: ЮKassa или CloudPayments? Схема фискализации (касса/агент/только RuStore)?
Q3 Тарифы: лимиты FREE/Прораб/Бригада (черновик: FREE 1 объект+2 участника без экспорта; Прораб 5 объектов+экспорт; Бригада безлимит объектов+10 участников+отчёты).
Q4 Пилот: 3–5 реальных прорабов до биллинга?
Q5 УКЭП/RuStore Console: есть у ООО?
Q6 Реестр ПО: подаём на W2?

## 5. KNOWN ISSUES (НЕ баги)
React #418/#423 в бандле Яндекса; console `startTime` (VM-скрипт) = инжектор расширений/Яндекса — проверять в инкогнито; Vite .env — только рестарт; две модели ролей (User.role vs AccessRole) — свести в Фазе 1; **console.warn в ObjectAccessGuard (строки ~70)** — оставить как наблюдение.

## 6. НОВЫЙ РАБОЧИЙ ПРОЦЕСС (важно!)
**Qwen = архитектор/роадмап/аудит (мало, но крупно). Cline = исполнитель + сам проверяет (много файлов). Ты = приёмка + merge.**
- Каждая задача = «срез фичи» (вертикальный), не один якорь.
- Plan/Act режимы Cline: plan → ты одобряешь → act → Cline сам прогоняет `npm run verify` → отчёт.
- Правила больше не в промте — они в `.clinerules/project.md` (авто-подхват Cline).
- Одна команда проверки: `npm run verify` (be build + fe tsc -b + fe vite build).
- Cline коммитит на ветке `cline-*` — ты только merge --no-ff.
- Длинный чат Cline = дорого (история пересылается). После merge → новый чат.

## 7. МЕТРИКИ
Шагов: 114. СЛЕДУЮЩИЙ КОММИТ: №115. Счётчик чата №11: 30.
Оценка: 8.2 (P1 закрыт) → цель 8.5 после деплоя.
Юнит-экономика: нетто с 490₽ = 328₽ (RuStore+НДС) / 388₽ (веб) / 477₽ (Реестр, без НДС).
$5000 нетто = ~664 платящих при Реестре (~990 без). Горизонт 9–12 мес.