# PROJECT_STATUS v11 — FRAME (05.09.2026) — ЧАТ №7

## 0. ПРАВИЛА (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
1. Пошагово: 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями. Большие файлы — кусками, маленькие — целиком.
2. Ждать «Готово» перед следующим шагом. Тон «братан», пользователь — новичок.
3. КОММИТ-РИТУАЛ в конце каждого ответа с кодом:
   `git add . ; git commit -m "№<N>:<scope>: <суть> (DD/MM)" ; git push`
   (продолжаем нумерацию с №47)
4. 🔋 СЧЁТЧИК: старт 30, −1 за любой ответ; ≤10 — предупреждение; 0 — довести шаг и предложить новый чат.
5. Файла нет в контексте → НЕ гадать, просить прикрепить.
6. Алиасы: `db` (docker), `be` (бэкенд), `fe` (фронт).
7. Танец EPERM/краша на Windows: Ctrl+C → `taskkill /F /IM node.exe` → старт.
   Схему локально вести ТОЛЬКО через `npx prisma db push` (НЕ migrate dev).
8. Qwen Code в VSCode — только для анализа/аудита, НЕ для генерации кода без ревью.
9. Перед каждым крупным шагом — запускать Qwen Code аудит (промт в разделе 6).

## 1. СТЕК
Monorepo: backend NestJS+Prisma+PostgreSQL (Docker, localhost:5433, порт 3000),
frontend React+TS+MUI+Vite (порт 5000). GitHub: maxim13power-pixel/FRAME.
Деплой-план: Railway; мобилки — Capacitor (v2); сторы: PlayMarket, RuStore, AppStore.
Цель: $5000+/мес через подписки (биллинг P3).
Тестовые логины (пароль `frame123`):
- foreman@frame.app / +79990000000 (Прораб Демо)
- customer@frame.app / +79990000001 (Заказчик Демо)
- sub@frame.app / +79990000002 (Субподрядчик Демо)
Вход по email ИЛИ телефону (глобальный ValidationPipe в main.ts).

## 2. ЧТО ЗАКРЫТО В ЧАТЕ №6 ✅ (шаги 28–46)

### Аудит-фиксы (P-AUDIT)
- ✅ №28: PrismaModule подключён в Materials/PriceList/Auth
- ✅ №29: глобальный ValidationPipe в main.ts + LoginDto
- ✅ №30: тип роли на фронте `CUSTOMER | FOREMAN | VIEWER`

### Модуль доступа и приглашений (P2)
- ✅ №31-34: `accessService.ts` + живая модалка «Участники» (список, роли, удаление)
- ✅ №35: **прораб может приглашать заказчика** (кейс «хозяин не создаёт объект сам»)
- ✅ №36: схема: модель `InviteToken` (token, role, hidePrices, expiresAt, maxUses, usesCount, isActive) + `ObjectAccess.hidePrices`
- ✅ №37: `invite.service/controller` (5 эндпоинтов, `nanoid` установлен)
- ✅ №38: модалка «Поделиться» с вкладками 🔗 Ссылкой / ✉️ Email + Web Share API
- ✅ №39: страница `AcceptInvite.tsx` + авто-возврат после логина через `pendingInviteToken`

### Скрытие цен (фича «субподрядчик без маржи») 🙈
- ✅ №40: тестовые юзеры в seed.ts (customer + sub)
- ✅ №41-42: `materials.service.ts` — `mustHidePrices(access)` + `stripPrices()` во ВСЕХ методах
- ✅ №43: `projects.service` (totalCost=0), `objects.service` (totalCost=0 + возвращаем `role`/`hidePrices`), `dashboard.service` (деньги только по «видимым» объектам, виджет «Без расценок» скрытникам не показывается)
- ✅ №44: хотфикс типов (`'VIEWER' as const` + select project в noPrice)
- ✅ №45: компактные модалки (кол-во+ед. и цена+ед. в один ряд)
- ✅ №46: категории в PriceList свёрнуты по умолчанию + ед.изм. 1/4 строки (100px)

## 3. АУДИТ QWEN CODE (ЧАТ №7 — ЧТО НАДО ПОЧИНИТЬ ПЕРВЫМ ДЕЛОМ)

### 🔴 КРИТИЧНО (закрыть в первые 3-4 шага чата №7)

**1. ObjectAccessGuard не подключён к контроллерам**
Файлы: `objects.controller.ts`, `projects.controller.ts`, `materials.controller.ts`, `price-list.controller.ts`, `dashboard.controller.ts`
Суть: проверки доступа только внутри сервисов (`checkAccess`, `checkObjectAccess`). Нет централизованной защиты на HTTP слое.
Исправление: добавить `@UseGuards(ObjectAccessGuard)` или создать `GlobalAccessGuard` со списком защищённых роутов.

**2. Фронтенд не скрывает цены для VIEWER/hidePrices**
Файл: `frontend/src/pages/Materials.tsx` (строки 1029-1037 и 1119-1135)
Суть: цены отображаются независимо от роли/флага. Бэкенд возвращает 0, но UI всё равно рисует «—»/колонки.
Исправление: прятать ценовые колонки/блоки полностью при `hidePrices=true`.

**3. Race condition в invite.service.acceptInvite**
Файл: `backend/src/invite/invite.service.ts` (строки 256-282)
Суть: проверка существования доступа + создание + инкремент счётчика — отдельные операции. Два параллельных клика → двойное принятие.
Исправление: обернуть в транзакцию с `SELECT ... FOR UPDATE` на inviteToken и проверкой objectAccess внутри.

### 🟡 ВНИМАНИЕ (закрыть в рамках чата №7)

**4. AuthModule всё ещё импортирует PrismaModule** — убрать лишний импорт (PrismaModule приходит от prismaModule).
**5. Отсутствие ValidationPipe в Objects/Projects controller** — добавить `@Body(new ValidationPipe({ whitelist: true }))`.
**6. objectService.ts устаревшие типы** — привести в соответствие с бэкендом.
**7. Фронт: кнопки действий для VIEWER не скрыты** — в `Objects.tsx` скрывать всё управление при `myRole === 'VIEWER'`.
**8. Кнопки согласования в Materials.tsx показываются VIEWER** — скрыть при `hidePrices`.
**9. Опрос ObjectAccess при каждом запросе (N+1)** — кэшировать или JOIN.

### 🟢 ЗАМЕТКА (уже исправлено ✅)

MaterialsModule/PriceListModule → PrismaModule ✅ | JwtStrategy в AuthModule ✅
Глобальный ValidationPipe в main.ts ✅ | AuthController + ValidationPipe ✅
ObjectsService обрабатывает hidePrices ✅ | InviteController с двойной авторизацией ✅
AccessController с req.user.userId ✅ | RoleType включает VIEWER ✅
InviteLink типы с hidePrices ✅

## 4. ЗАДАЧИ ЧАТА №7 (по приоритету)

### 🔥 Первым делом (аудит-фиксы)
1. Подключить ObjectAccessGuard ко всем контроллерам (шаг 47-48)
2. Race condition в `acceptInvite` — транзакция + FOR UPDATE (шаг 49)
3. Фронт-скрытие цен в `Materials.tsx` + `Projects.tsx` (шаг 50-51)
4. Скрыть кнопки управления для VIEWER в `Objects.tsx`

### 🛡 Изоляция и защита
5. **Изоляция проектов**: прораб проекта А не видит проект Б. `ObjectAccess.projectId` уже есть — докрутить проверки в сервисах + UI назначения прораба на проект.
6. **Защита заказчика**: «Заказчика удаляет только он сам» + `Object.ownerId` (для биллинга-лимитов).
7. **Слияние объектов** (сценарий «две бригады позвали одного хозяина»):
   `POST /objects/:targetId/merge/:sourceId` — перенос проектов, объединение доступов (конфликт ролей → старшая), источник в архив. Право: только CUSTOMER обоих объектов. Модалка-превью.

### 👥 Регистрация (критично для прода)
8. `POST /auth/register` (email ИЛИ телефон + пароль + имя)
9. Страница «Регистрация» + кнопка на `AcceptInvite.tsx`
10. Авто-создание аккаунта при первом входе по ссылке (опционально)

### 💰 Биллинг MVP (после регистрации)
11. Модель `Subscription` + тарифы: ПРОРАБ (~490-790 ₽/мес), БРИГАДА (~1990 ₽/мес)
12. FREE-лимиты: 1 объект, 2 проекта, 1 соавтор
13. Промокоды + архивирование объектов

### 🤝 Согласования (розовая фича)
14. `ChangeRequest` уже в схеме: создание при правке утверждённой сметы → розовая подсветка PENDING → кнопки Принять/Отклонить у заказчика.

## 5. ТЕКУЩАЯ МОДЕЛЬ ДОСТУПА

### Роли (объектные, не глобальные)
enum AccessRole {
  CUSTOMER // 👑 Заказчик — видит всё, управляет, утверждает
  FOREMAN  // 👷 Прораб — ведёт работы, может приглашать (в т.ч. заказчика)
  VIEWER   // 👁 Наблюдатель — только прогресс и объёмы, без денег
}

### Ключевые модели
ObjectAccess: userId, objectId, projectId?, role, hidePrices, invitedBy
InviteToken: token, objectId, createdBy, role, hidePrices, expiresAt?, maxUses?, usesCount, isActive
ChangeRequest: (модель есть, логика и UI НЕ сделаны)

### Логика скрытия цен
скрывать = роль VIEWER || ObjectAccess.hidePrices == true
Проверка через записи доступа БЕЗ лишних запросов.

## 6. ПРОМТ ДЛЯ QWEN CODE (запускать перед каждым крупным шагом)
Ты — senior full-stack аудитор (NestJS + Prisma + PostgreSQL + React + TS + MUI).
Проведи READ-ONLY аудит, НИЧЕГО не изменяй.
Контекст проекта — в PROJECT_STATUS_v11.md.
ПРОВЕРЬ И ВЫВЕДИ ОТЧЁТ по категориям:
🔴 КРИТИЧНО (ломает рантайм/безопасность)
🟡 ВНИМАНИЕ (потенциальный баг)
🟢 ЗАМЕТКА (рекомендация)
Каждый пункт: файл, строка, суть, как исправить. САМ НЕ ИСПРАВЛЯЙ.

## 7. НОМЕРАЦИЯ КОММИТОВ
- Чат №6 закрыт на коммите №46 (свёрнутые категории + узкая ед.изм.)
- **Следующий коммит: №47** (первая задача — ObjectAccessGuard)

## 8. ИСТОРИЯ ЧАТОВ
- Чаты №1-4: базовый функционал (объекты, проекты, материалы, дашборд)
- Чат №5: перестройка на ObjectAccess + ChangeRequest, модуль access, модалка ролей
- Чат №6: починка аудита + приглашения ссылкой (как в Notion) + скрытие цен + компактные модалки + свёрнутые категории
- **Чат №7: ObjectAccessGuard + фронт-скрытие цен + регистрация + изоляция проектов + биллинг**