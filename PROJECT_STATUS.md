PROJECT FRAME — Статус v19 (02.10.2026) — ПЕРЕДАЧА В ЧАТ №13 (Cline + Qwen)

0. ПРАВИЛА ДЛЯ ЧАТОВ QWEN (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
Тон «братан», пользователь — новичок. Пошагово с якорями.
🔋 СЧЁТЧИК: старт 30, −1 за ответ, ≤10 предупреждение, 0 — довести шаг и новый чат.
КОММИТ-ритуал одной строкой: git add . ; git commit -m "№<N>:<scope>: суть (DD/MM)" ; git push.
МЕРЖ-ритуал одной строкой: git checkout main ; git merge --no-ff <ветка> -m "Merge №<N>: суть" ; git push.
Перед промтом Cline указывать МОДЕЛЬ + МОЩНОСТЬ (таблица в .clinerules/project.md §5).
Секреты только в backend/.env и frontend/.env (оба в .gitignore). В чатах — плейсхолдеры.
Прод ТОЛЬКО `migrate deploy`, локально ТОЛЬКО `db push`. EPERM на generate = запущен dev-сервер.
Не выдумывать файлы/API. Мёртвый код не оставлять. Git-команды владельцу — с «;» (PowerShell < 7), НЕ «&&».

1. СОСТОЯНИЕ
Стек: backend NestJS 11+Prisma 5.22+PG 15 (:3000), frontend React 19+TS 5.9+MUI 6.5+Vite 7 (:5000, прод — serve -s dist).
GitHub: maxim13power-pixel/FRAME. Код в main: №115 Users, №116 экспорт XLSX/PDF (клиентский, xlsx+pdfmake, hidePrices учтён).
⚠️ №118 (дашборд, зона перерасхода >100%) — промт выдавался Cline в чате №11, ВЫПОЛНЕНИЕ НЕ ПОДТВЕРЖДЕНО:
   в начале чата №12 ПЕРВЫМ ДЕЛОМ проверить git log / ветки cline-* / git status.
⚠️ №119 (почта через Yandex Cloud Postbox, HTTP API) — промт готов (§2), НЕ выдавался.

ДЕПЛОЙ ( Railway, РАБОТАЕТ ):
- be: https://frame-production-aa1f.up.railway.app — /health=200, миграции применены (baseline 20260920000000).
- fe: https://frame-production-37a1.up.railway.app — SPA-fallback ок, регистрация/логин/капча/дашборд/экспорт работают в проде.
- PG: managed Postgres в том же проекте; бэкапы Railway — ПРОВЕРИТЬ включён ли daily (в чате №11 не подтверждено).
- be env: DATABASE_URL (ПРЯМОЙ строкой postgresql://… — ссылочные ${{…}} НЕ зарезолвились, урок зафиксирован),
  JWT_SECRET (РОТИРОВАН после засвета куска в чате), SMARTCAPTCHA_SERVER_KEY, CORS_ORIGINS, FRONTEND_URL,
  BREVO_SMTP_* (указывают на Яндекс, НЕ работают — см. §5).
- fe env (впечены в билд): VITE_API_BASE_URL, VITE_APP_URL, VITE_SMARTCAPTCHA_CLIENT_KEY.

ДОМЕН frame-app.ru: куплен REG.RU; подключён к Яндекс 360 (MX/SPF/DKIM/DMARC пройдены, «Домен настроен»);
DNS на Railway НЕ поднят (сознательно отложен до выбора платформы).

ПОЧТА: Яндекс 360 для бизнеса (тариф Минимальный), ящик noreply@frame-app.ru создан.
SMTP с Railway НЕ работает: ETIMEDOUT — Railway блокирует исходящие 25/465/587 (анти-спам). Это НЕ баг кода.
Решение: срез №119 = Yandex Cloud Postbox (HTTP API, AWS SES-совместимый) ИЛИ переезд на Timeweb (там SMTP жив).

ИНФРА-АНАЛИЗ (Алиса, 30.09):推荐-связка для РФ = Timeweb Cloud App Platform + Managed PG (~1500₽/мес)
+ Яндекс 360 (319₽/мес): автодеплой из GitHub, SSL авто, оплата рублями, УПД по ЭДО.
Запасной: Amvera (~1070₽/мес, git push deploy, потолок 6GB RAM). Yandex Cloud — дорого/сложно (нет PaaS из GitHub).
Решение владельца: миграцию на Timeweb отложить до ~середины октября; триал Railway до ~28.10.2026.

2. БЛИЖАЙШИЕ ШАГИ (приоритеты чата №12)
A. ФРОНТ-АУДИТ: пройтись по всем страницам (App.tsx роуты): заглушки/пустые разделы
   (кандидаты: Analytics, Brigades, Warehouse, Reports — страницы есть, контент пуст/скрыт),
   плюс известные косяки (перерасход 864% на Главной). Составить план срезов по ценности → выполнять.
B. ПОЧТА: №119 Postbox (если остаёмся на Railway) — промт ниже; ИЛИ после миграции на Timeweb — Яндекс 360 SMTP нативно.
C. ДЕПЛОЙ-ПЛАТФОРМА: финальное решение Railway→Timeweb (свежий взгляд Cline + план Алисы из §1) → миграция по чек-листу.
D. ДОМЕН: DNS frame-app.ru на выбранную платформу (be=api.frame-app.ru, fe=frame-app.ru), SSL, правка env, редеплой обоих.
E. БЭКАПЫ: daily на текущей платформе + тестовый restore.
F. ФАЗА 2 биллинг (ЮKassa, НДС 22%, Plan/Subscription/Payment/PaymentEvent, SubscriptionGuard, trial 14д) — после A–E.
TRACK B параллельно: Реестр ПО, УКЭП, RuStore Console, уведомление РКН — бюрократия владельца.

ПРОМТ №119 (готов, выдавать Cline после решения B):
МОДЕЛЬ: DeepSeek V4 Pro | МОЩНОСТЬ: HIGH
«ЗАДАЧА №119 — backend: провайдер почты Yandex Cloud Postbox (HTTP API) вместо SMTP.
Postbox совместим с AWS SES API. Установить @aws-sdk/client-ses; новый provider в email.service.ts;
env: POSTBOX_ACCESS_KEY_ID, POSTBOX_SECRET_ACCESS_KEY, POSTBOX_REGION=ru-central1, POSTBOX_FROM_EMAIL=noreply@frame-app.ru;
логика: есть POSTBOX_* → Postbox, иначе SMTP (локалка); BREVO_* убрать из .env.example; verify → 0;
коммит: git checkout -b cline-postbox ; git add . ; git commit -m "№119:email: Postbox HTTP API вместо SMTP (DD/MM)" ; git push -u origin cline-postbox»

3. DEPLOY-ЧЕК-ЛИСТ (статус)
[✅] Railway: 3 сервиса, be/fe онлайн, миграции применены, капча/регистрация/логин/экспорт в проде.
[✅] Яндекс 360: домен верифицирован, MX/SPF/DKIM/DMARC, ящик noreply.
[❌] DNS frame-app.ru → платформа (отложен).
[❓] Daily backups Railway — проверить/включить + тест restore.
[❌] Миграция Timeweb (план: PG → be App Platform → fe → pg_dump/pg_restore → домен → smoke) — старт по решению C.
[❌] Smoke после домена: регистрация→письмо→сброс→логин→объект→материал→фикс→экспорт→logout на frame-app.ru.

4. ОТКРЫТЫЕ РЕШЕНИЯ
Q1 ДОМЕН: РЕШЕНО — frame-app.ru.
Q7 НОВОЕ: почта сейчас = Postbox на Railway ИЛИ ускоренный переезд на Timeweb (SMTP нативно)? Решить в чате №12 с Cline.
Q8 НОВОЕ: порядок фронт-срезов (какие пустые разделы делать первыми) — владелец ставит приоритет после аудита.
Q2 Биллинг: ЮKassa или CloudPayments? Фискализация? | Q3 Тарифы FREE/Прораб/Бригада. | Q4 Пилот 3–5 прорабов?
Q5 УКЭП/RuStore Console у ООО? | Q6 Реестр ПО: подаём?

5. KNOWN ISSUES (НЕ баги)
Railway блокирует исходящий SMTP (ETIMEDOUT) — лечится Postbox или переездом, код не виноват.
${{ Service.VAR }} ссылки Railway могут резолвиться в пустоту после Edit — использовать прямые значения.
React #418/#423 — внутри iframe виджета Яндекса; console startTime — инжектор расширений (проверять в инкогнито).
Vite читает .env только при старте → рестарт fe после правки. Две модели ролей (User.role vs AccessRole) — свести в Фазе 1.
pdfmake даёт чанк >500kB (warning допустим). 864% на Главной — честная математика, правим отображение (№118).

6. РАБОЧИЙ ПРОЦЕСС (без изменений)
Qwen = архитектор/роадмап/аудит (мало, но крупно). Cline = исполнитель + сам гоняет npm run verify.
Ты = приёмка + merge. Задачи = «срезы фичи» вертикально. Cline коммитит на cline-*, ты merge --no-ff.
Правила Cline — в .clinerules/project.md (авто-подхват). Длинный чат Cline = дорого → новый чат на новую большую фичу.

7. МЕТРИКИ
Код-шагов: 116 в main (+№117 деплой без кода). СЛЕДУЮЩИЙ КОММИТ: №118 (если не закоммичен) иначе №119/120 по факту аудита.
Счётчик чата №12: 30. Оценка: 8.3 (прод живой) → цель 8.6 после фронт-аудита и почты.
Юнит-экономика: нетто с 490₽ = 328₽ (RuStore+НДС) / 388₽ (веб) / 477₽ (Реестр, без НДС). $5000 нетто ≈ 664 платящих при Реестре.

8. ДОРОЖНАЯ КАРТА CLINE-СРЕЗОВ (обновлено 02.10.2026)
ВЫПОЛНЕНО (все в main, кроме №124):
- №120 Срез 0: баг №118 (перерасход >100% на Главной) + UX-гигиена (Settings/BottomNav/модалки/FAB/focus-ring).
- №121 Срез 1: Warehouse (Склад) — Prisma+NestJS+React, приход/расход/списание, экспорт Excel.
- №122a: Reports backend — акты/сметы CRUD + автопересчёт totalAmount.
- №122b: Reports frontend + экспорт PDF (pdfmake 0.3+Roboto)/XLSX (exceljs) + верификация email при регистрации (код 6 цифр, request-code/verify).
- №123: Analytics (Recharts) — summary-карточки, бюджет vs факт, тренд 6 мес, топ-5 перерасходов, ссылка с Главной.
- №124: Brigades — бригады/состав/выходы/статистика. ← ЭТОТ чат: ветка cline-brigades-mvp, ждёт merge.
ЗАГЛУШЕК НЕ ОСТАЛОСЬ — все 4 раздела живые (Warehouse, Reports, Analytics, Brigades).

ДАЛЬШЕ (приоритет):
1. №119: почта Postbox (промт готов в §2) — нужен после решения по платформе.
2. Миграция Railway→Timeweb + DNS frame-app.ru + бэкапы (§2 B–E).
3. Фаза 2: биллинг ЮKassa, тарифы, пилот.

ПРАВИЛА БЕСШОВНОГО ПЕРЕХОДА — Cline (новый чат, ПЕРВЫЙ ПРОМТ):
«Привет! Ты — исполнитель проекта FRAME (monorepo backend/ + frontend/ в C:\PROJECTS\frame-app).
Прочитай .clinerules/project.md (жёсткие правила) и PROJECT_STATUS.md §8 (дорожная карта).
Выполни: git fetch; git log origin/main -5; git branch -a | grep cline; npm run verify (фоном, ~40с).
Подтверди готовность и жди срез от владельца.»
Каждый срез: ветка cline-<scope> от origin/main; npm run verify ПОСЛЕ каждого блока; коммиты по блокам; push ветки; в отчёте НЕ писать «Создать PR» (владелец сам мержит терминалом); секреты — плейсхолдеры.

ПРАВИЛА БЕСШОВНОГО ПЕРЕХОДА — Qwen (новый чат):
Копировать §0 (правила) + этот §8. Роль Qwen = архитектор/наблюдатель (роадмап, аудиты, генерация промтов срезов), НЕ исполнитель — исполнитель Cline. Перед исчерпанием лимита (30/чат) — подвести итог и открыть новый чат с §0+§8.