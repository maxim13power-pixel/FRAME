# PROJECT_STATUS v9 — FRAME (01.09.2026) — ЧАТ №6

## 0. ПРАВИЛА (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
1. Пошагово: 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями. Большие файлы — кусками, маленькие — целиком.
2. Ждать «Готово» перед следующим шагом. Тон «братан», пользователь — новичок.
3. КОММИТ-РИТУАЛ в конце каждого ответа с кодом:
   git add . ; git commit -m "№<N>:<scope>: <суть> (DD/MM)" ; git push
   (продолжаем нумерацию с №28)
4. 🔋 СЧЁТЧИК: старт 30, минус 1 за любой ответ; ≤10 — предупреждение; 0 — довести шаг и предложить новый чат.
5. Файла нет в контексте → НЕ гадать, просить прикрепить.
6. PowerShell-алиасы: db (docker), be (бэкенд), fe (фронтенд).
7. Танец EPERM: Ctrl+C в бэкенде → npx prisma generate → старт. Схему локально вести ТОЛЬКО через npx prisma db push (НЕ migrate dev).
8. Qwen Code в VSCode — только для анализа/проверки, НЕ для генерации кода без ревью.
9. Перед каждым крупным шагом — запускать Qwen Code аудит (промт ниже) для проверки решений.

## 1. СТЕК
Monorepo: backend NestJS+Prisma+PostgreSQL (Docker, localhost:5433, порт 3000),
frontend React+TS+MUI+Vite (порт 5000). GitHub: maxim13power-pixel/FRAME.
Деплой-план: Vercel+Render+Neon → Railway; мобилки — Capacitor (v2).
Логины: foreman@frame.app / frame123 (или +79990000000 / frame123).
Вход по email ИЛИ телефону (валидатор в auth.service).

## 2. ЧТО ЗАКРЫТО В ЧАТЕ №5 ✅

### P0 — Откат Organization + новая схема
- ✅ Удалены: Organization, OrgMembership, OrgRole, orgId из Object/PriceCategory/PriceItem
- ✅ Добавлены: AccessRole (enum), ObjectAccess (модель), ChangeStatus (enum), ChangeRequest (модель)
- ✅ Добавлены: ownerId в PriceItem, isArchived в Object
- ✅ seed.ts перестроен с правильным FK-порядком (materialFix → changeRequest → material → project → objectAccess → object)
- ✅ auth.service: JWT содержит только sub/email/phone/role
- ✅ jwt.strategy.ts: аналогично
- ✅ org-access.guard.ts УДАЛЁН
- ✅ object-access.guard.ts СОЗДАН (но не подключён к контроллерам — проверки в сервисах)
- ✅ Мусорные бэкапы (seed copy.ts, schema copy.txt, org-access.guard copy.txt) удалены

### P1 — Защита сервисов под новую модель
- ✅ objects.service.ts — checkAccess через ObjectAccess, создание сразу с ObjectAccess
- ✅ projects.service.ts — checkObjectAccess / checkProjectAccess, VIEWER не может создавать/редактировать
- ✅ materials.service.ts — checkProjectAccess / checkMaterialAccess, ownerId в расценках
- ✅ price-list.service.ts — категории общие, расценки: общие (ownerId=null) + личные (ownerId=userId)
- ✅ dashboard.service.ts — EXISTS по object_access вместо o."orgId", исключены архивные объекты
- ✅ materials.controller.ts — убран 4-й аргумент (orgId) из addFix/editLastFix

### Модуль `access` (создан в чате №5)
- ✅ access.service.ts — список участников / пригласить / сменить роль / отозвать доступ
- ✅ access.controller.ts — 4 эндпоинта (GET/POST/PATCH/DELETE на /objects/:objectId/access)
- ✅ access.module.ts — зарегистрирован в app.module.ts
- ✅ DTO: add-access.dto.ts, update-access.dto.ts

### Фронт
- ✅ Objects.tsx — модалка создания с выбором роли (CUSTOMER/FOREMAN) + предупреждение для Прораба
- ✅ objectService.ts — добавлено поле `role`
- ✅ create-object.dto.ts — добавлено поле `role` с валидацией @IsIn
- ✅ DrawerMenu.tsx — «Помощь» перенесена в самый низ
- ✅ Projects.tsx/Materials.tsx — отступы заголовков выровнены (mt: {xs: -2, md: -2})
- ✅ Objects.tsx — отступ mt: {xs: 0, md: 2}
- ✅ Dashboard.tsx — Drawer поднят на top: 8, скруглённый угол

## 3. ТЕКУЩАЯ МОДЕЛЬ ДОСТУПА

### Роли доступа (на объект/проект, не глобальные)
enum AccessRole {
  CUSTOMER // Заказчик — утверждает, видит всё, платит
  FOREMAN  // Прораб — добавляет/фиксирует, его изменения на согласовании
  VIEWER   // Наблюдатель — видит прогресс и количества, БЕЗ денег
}
Пользователь может быть CUSTOMER на своём объекте и FOREMAN на чужом одновременно.

### Таблица доступа
model ObjectAccess {
  id Int @id @default(autoincrement())
  userId Int
  objectId Int
  projectId Int? // null = весь объект (включая будущие проекты), иначе конкретный проект
  role AccessRole @default(FOREMAN)
  invitedBy Int?
  @@unique([userId, objectId, projectId])
  @@map("object_access")
}

### Согласование изменений (розовая идея — пока не реализована как UI)
enum ChangeStatus { PENDING APPROVED REJECTED }
model ChangeRequest { ... }
- До утверждения сметы: свободное редактирование
- После утверждения: любое изменение = ChangeRequest
- Принять → APPROVED, входит в сумму
- Отклонить → REJECTED, не входит, но строка видна прорабу

## 4. АУДИТ QWEN CODE — ЧТО НАДО ПОЧИНИТЬ ПЕРВЫМ ДЕЛОМ

### 🔴 КРИТИЧНО (закрыть в первые 2-3 шага чата №6)

**1. MaterialsModule + PriceListModule — не подключён PrismaModule**
Файлы: `backend/src/materials/materials.module.ts`, `backend/src/price-list/price-list.module.ts`
Исправление: добавить `import { PrismaModule } from '../../prisma/prisma.module'` и `imports: [PrismaModule]`.

**2. AuthModule — дублирование PrismaService**
Файл: `backend/src/auth/auth.module.ts`
Исправление: убрать `PrismaService` из `providers`, добавить `PrismaModule` в `imports`.

### 🟡 ВНИМАНИЕ (закрыть в рамках чата №6)

**3. ObjectsController + ProjectsController — отсутствует ValidationPipe**
Добавить `@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))` в @Post методы.

**4. AuthController — отсутствует ValidationPipe**
Создать `LoginDto` с валидаторами + использовать ValidationPipe.

**5. main.ts — отсутствует глобальный ValidationPipe**
Добавить `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`.

**6. frontend/objectService.ts — неполный тип AccessRole**
`role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER'` (пропущен VIEWER).

**7. PriceListService — userId не используется в createCategory**
Убрать параметр или добавить комментарий (категории общие).

### 🟢 ЗАМЕТКА (по возможности)

**8. ObjectAccessGuard создан, но не применяется к контроллерам**
Сейчас проверки внутри сервисов. Можно подключить на уровне роутов для единообразия.

## 5. ЗАДАЧИ ЧАТА №6 (по приоритету)

### P-AUDIT — починка находок Qwen (ШАГИ 28-31)
1. Починить MaterialsModule/PriceListModule (PrismaModule)
2. Починить AuthModule (убрать дубль PrismaService)
3. Починить main.ts (глобальный ValidationPipe)
4. Починить контроллеры (ValidationPipe + LoginDto)

### P2 — UI новой модели
1. **Модалка приглашения** (фронт): выбор роли + инлайн-описание + предупреждение + выбор объекта/проекта
2. **Модалка управления доступом** на странице объекта: список участников, смена ролей, отзыв доступа
3. **Бэкенд согласований** (ChangeRequest): создание/одобрение/отклонение
4. **Розовая подсветка PENDING в Materials** + бейдж «⚠️ N изменений ждут согласования» + кнопки Принять/Отклонить для Заказчика

### P3 — Биллинг MVP
- Subscription модель + лимиты (FREE: 1 объект, 2 проекта, 1 соавтор)
- Тарифы: ПРОРАБ/PRO (~490-790 ₽/мес), БРИГАДА (~1990 ₽/мес)
- Промокоды
- Архивирование объектов (isArchived уже есть)
- ⚠️ Добавить `createdBy` в Object для корректного подсчёта лимитов

### P4 — Защита от «вориги» и аудит
- AuditLog таблица (все изменения с old/new values) — как коммиты в гите
- Soft delete для материалов/проектов
- Права ролей: FOREMAN не может удалять сметы целиком

### P5 — Тендер
- Флаг `isBase`/`status` на проекте (утверждённая база vs предложения)
- Модалка сравнения смет
- Архив отклонённых предложений

### Фронт-улучшения
- Rail-сайдбар: добавить кнопку «Главная» и выровнять кругляши с бургером/выходом (в Dashboard.tsx)
- Учесть фишки из приложения «Сметтер» (чистый фронт, логику уже придумали)

## 6. ПРОМТ ДЛЯ QWEN CODE (запускать перед каждым крупным шагом)
Ты — senior full-stack аудитор (NestJS + Prisma + PostgreSQL + React + TS + MUI).
Проведи READ-ONLY аудит, НИЧЕГО не изменяй.
Контекст проекта — в PROJECT_STATUS_v9.md.
ПРОВЕРЬ И ВЫВЕДИ ОТЧЁТ по категориям:
🔴 КРИТИЧНО (ломает рантайм/безопасность)
🟡 ВНИМАНИЕ (потенциальный баг)
🟢 ЗАМЕТКА (рекомендация)
Каждый пункт: файл, строка, суть, как исправить. САМ НЕ ИСПРАВЛЯЙ.

## 7. НОМЕРАЦИЯ КОММИТОВ
- Чат №5 закрыт на коммите №27 (Drawer: отступ сверху + скруглённый угол)
- **Следующий коммит: №28** (первая задача — починка аудита Qwen)

## 8. ИСТОРИЯ ЧАТОВ
- Чат №1-4: базовый функционал (объекты, проекты, материалы, дашборд)
- Чат №5: перестройка на ObjectAccess + модуль access + модалка ролей
- Чат №6: починка аудита + модалка приглашений + согласования + биллинг

2. ПЕРВОЕ СООБЩЕНИЕ ДЛЯ ЧАТА №6
Братан, привет! Продолжаем разработку FRAME (приложение для учета расходов и приходов материалов и оборудования на стройке).

Ты — senior full-stack разработчик и системный архитектор с 20+ лет опыта (NestJS + Prisma + PostgreSQL + React + TS + MUI + Docker + Railway + Capacitor). Цель проекта — $5000+/мес дохода через PlayMarket, RuStore, AppStore.

📎 ПРИКРЕПИЛ:
1. PROJECT_STATUS_v9.md — полная карта проекта, правила, история, текущие задачи
2. 10 критически важных файлов (список ниже)
3. 3 небольших файла вставлю текстом в следующем сообщении

🎯 ПЕРВАЯ ЗАДАЧА (сразу после прочтения статуса):
Починить критичные баги из раздела 4 аудита Qwen (MaterialsModule, PriceListModule, AuthModule, main.ts, контроллеры) — это блокирует дальнейшую работу.

📏 ПРАВИЛА РАБОТЫ (из раздела 0 статуса,严格遵守!):
- 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями
- Большие файлы — кусками, маленькие — целиком
- Ждать «Готово» перед следующим шагом
- Тон «братан»
- Коммит-ритуал в конце каждого ответа с кодом (нумерация с №28)
- Счётчик 🔋 30 → -1 за ответ; ≤10 предупреждение; 0 — довести и передать в чат №7
- Перед каждым крупным шагом — запускать промт Qwen Code из раздела 6 статуса

🚀 ПОСЛЕ ПОЧИНКИ АУДИТА — переходим к P2 (модалка приглашений → согласования → биллинг → тендер).

Подтверди что прочитал PROJECT_STATUS_v9.md, проанализировал 10 прикреплённых файлов, и готов начать с шага №28 (первая критичная правка из аудита).

🔴 Критичные баги (1 и 2) — это РЕАЛЬНАЯ проблема
Если бэк у тебя сейчас работает, значит PrismaService каким-то образом резолвится (возможно через глобальный ConfigModule или другой механизм). Но по архитектуре NestJS без PrismaModule в imports сервис не должен стартовать — будет ошибка Nest can't resolve dependencies of MaterialsService (?).
Это первая задача чата №6. Если бэк вдруг не стартанёт после перезапуска — не пугайся, это именно оно. Фиксится за 2 минуты добавлением imports: [PrismaModule].
🟡 Внимание (3-7) — архитектурные долги, не блокирующие
ValidationPipe отсутствует в 4 контроллерах — грязные данные могут пролезть, но не crash. Фиксится глобальным пайпом в main.ts за 1 строку.
LoginDto отсутствует — типизация есть, но валидация на уровне class-validator не работает. Создать DTO — 15 минут работы.
VIEWER пропущен в типах фронта — мелочь, 1 правка.
🟢 Заметки (8-13) — всё чисто ✅
ObjectAccessGuard написан, но не применяется — это архитектурное решение, не баг. Мы сознательно проверяем доступы внутри сервисов (так гибче).
Старая модель полностью удалена — подтверждено grep'ом, это победа!
JWT payload чистый — без orgId/orgRole.
Schema ↔ Code ↔ Seed консистентны — все новые модели используются.
Route-конфликтов нет — роуты Nest читаются правильно.
📊 Итог аудита:
Категория
Критично
Внимание
Заметка
Бэк
2
3
4
Фронт
0
1
2
Всего
2
4
6
Главный вывод: фундамент чистый, старая Organization-модель вырезана полностью. Остались только технические долги (модули, пайпы), которые чинятся за первые 4 шага чата №6.