# PROJECT FRAME — Статус (живой: обновляется в каждой задаче)

## СОСТОЯНИЕ (26.09.2026)
- Стек: backend NestJS 11 + Prisma 5.22 + PostgreSQL 15; frontend React 19 + TS 5.9 + MUI 6.5 + Vite 7.
- Репозиторий: maxim13power-pixel/FRAME. Деплой: Railway (postgres, be, fe).
- Миграции: единый baseline 20260920000000_baseline_all_tables (12 таблиц + 5 enum); чистая БД = migrate deploy OK.
- Тест-логины (пароль frame123): foreman@frame.app (Прораб), customer@frame.app (Заказчик), sub@frame.app (VIEWER+hidePrices). Вход по email ИЛИ телефону.
- Последнее (№112 deploy-pipeline): railway.json startCommand = `npx prisma migrate deploy && node dist/main`;
  5 заглушек (Analytics/Reports/Brigades/Warehouse/Users) скрыты из навигации; logout вынесен в меню профиля.
- Процесс: правила и команды — в `.clinerules/project.md`; полная история шагов — `git log`.

## БЛИЖАЙШИЕ ШАГИ (по порядку)
1. №113 mobile-ux (сводка Materials hide-on-scroll).
2. ДЕПЛОЙ на Railway (чек-лист ниже) + smoke-тест.
3. ФАЗА 1 заглушки: Users → Reports(XLSX/PDF) → Analytics → Brigades → Warehouse.
4. ФАЗА 2 биллинг: ЮKassa, НДС 22%, Plan/Subscription/Payment/PaymentEvent(idempotency), trial 14д, grace 3д.
5. TRACK B (параллельно): Реестр ПО (45 дн), УКЭП, RuStore Console, уведомление РКН.
6. ФАЗА 3 мобилка: Capacitor + офлайн + RuStore Pay SDK.
7. ПРЕД-РЕЛИЗ: плейсхолдеры в Terms/Privacy, Sentry, Throttler, refresh-токены, пароль min 8.

## DEPLOY-ЧЕК-ЛИСТ (Railway)
1. Домен (Q1) → купить. 2. Сервисы postgres/be/fe. 3. backend env: DATABASE_URL, JWT_SECRET, CORS_ORIGINS, FRONTEND_URL, SMARTCAPTCHA_SERVER_KEY, BREVO_*.
4. frontend env ДО сборки: VITE_API_BASE_URL, VITE_APP_URL, VITE_SMARTCAPTCHA_CLIENT_KEY.
5. Deploy be → лог «migrate deploy applied» → /health=200. 6. Deploy fe → / =200, /objects =200 (SPA-fallback).
7. Smoke: регистрация → Brevo → сброс → логин → объект → материал → фиксация → аренда → logout.
8. DNS+SSL, обновить CORS/VITE. 9. Daily backups + тест восстановления.

## ОТКРЫТЫЕ РЕШЕНИЯ
- Q1 Домен: frame-app.ru или frame.app?
- Q2 Биллинг: ЮKassa или CloudPayments? Схема фискализации?
- Q3 Тарифы: лимиты FREE/Прораб/Бригада.
- Q4 Пилот: 3–5 реальных прорабов до биллинга?
- Q5 УКЭП/RuStore Console: есть у ООО?
- Q6 Реестр ПО: подаём на W2?

## KNOWN ISSUES (не баги)
React #418/#423 (Яндекс); console `startTime` (инжектор расширений); Vite .env — только рестарт;
две модели ролей (User.role vs AccessRole) — свести в Фазе 1.