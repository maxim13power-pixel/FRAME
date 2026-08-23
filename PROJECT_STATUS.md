# PROJECT_STATUS v4 — FRAME (22.08.2026, ночь)
## ПЕРЕДАТОЧНЫЙ ДОКУМЕНТ ДЛЯ ЧАТА №3

---
## 0. ПРАВИЛА ЧАТОВ (ОБЯЗАТЕЛЬНО)
1. Стиль: пошагово, 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями.
2. Ждать «Готово» перед следующим шагом. Пользователь — новичок, тон «братан», объяснять просто.
3. КОММИТ-РИТУАЛ в конце каждого ответа с кодом:
   `git add . ; git commit -m "<scope>: <суть> (DD/MM)" ; git push`
4. 🔋 СЧЁТЧИК ЧАТА: в конце КАЖДОГО ответа (после коммита) строка
   «🔋 До нового чата осталось: N». Старт N=30 (только ответы с кодом).
   N≤10 — предупреждение; N=0 — дозакрыть текущий шаг и переходить.
5. Код писать ПОЛНОСТЬЮ (уроки чата-2: обрывы строк и переменные вне scope = баги).
6. Файла нет в контексте → НЕ гадать, просить прикрепить.
7. Агенты (Replit/Cline): только свои файлы/новые файлы; merge после ревью diff --name-status.
8. Алиасы PowerShell: `db` (docker), `be` (бэкенд), `fe` (фронтенд).
9. Танец EPERM: Ctrl+C в бэкенде → `npx prisma generate` → старт.

## 1. СТЕК
- Monorepo: backend NestJS+Prisma+PostgreSQL (Docker, localhost:5433, порт 3000),
  frontend React+TS+MUI+Vite (порт 5000). GitHub: maxim13power-pixel/FRAME (main).
- Деплой-план без карты: Vercel+Render+Neon; позже Railway. Мобилки — Capacitor (v2).

## 2. СХЕМА (ключевое)
- enum PriceKind { WORK MATERIAL }; enum Unit (10 значений); enum Role (4).
- PriceCategory: name + kind, @@unique([name, kind]), sortOrder.
- PriceItem: kind @default(WORK), isActive (удаление = деактивация, сметы живут).
- Material: specQuantity, totalUsed, lastEntry/lastEntryDate, progressPercent,
  isSpecLocked (в UI НЕ используется — не пугаться),
  РАБОТЫ: priceItemId+unitPrice+totalCost (snapshot),
  МАТЕРИАЛЫ: materialItemId+materialUnitPrice+materialTotalCost (snapshot).
- Object.note, Project.note (≤1000), plannedEndDate.
- MaterialFix — история фиксаций.

## 3. БЭКЕНД-ЭНДПОИНТЫ (факт)
- materials: GET by project; POST create; POST :id/fix; PATCH :id (полное, обе расценки);
  PATCH :id/last-fix (72ч); PATCH :id/spec; PATCH :id/lock; DELETE; GET :id/fixes;
  POST /price-item (расценка+категория, kind, findOrCreate категории).
- price-list: GET categories?kind=; GET categories/full?kind=;
  GET items/search?search&categoryId&kind; POST categories(kind); PATCH/DELETE categories/:id;
  POST items(kind); PATCH items/:id; DELETE items/:id (isActive=false).
- objects/projects: findAll/findOne возвращают progressPercent+totalCost
  (агрегация Σ totalUsed/Σ specQuantity и Σ стоимостей); projects.update возвращает findOne.

## 4. ФРОНТЕНД (ГОТОВО)
- Dashboard: сайдбар 240, скрытие → width→0 (анимация), контент maxWidth=false,
  paddingLeft 48 при скрытом, бургер top:24 left:24 = два кружка с «назад».
- Materials: смета-таблица 17 колонок (группы «работ/материалов по смете», синие линии),
  итоговая жёлтая строка (8 сумм); мобилка — компактная карточка с блоком «На тек. момент»;
  модалки: две расценки WORK/MATERIAL + создание расценок/категорий inline;
  правка последней фиксации 72ч; инфо-модалки вместо alert; 📷-заглушка «фото в v2».
- Objects/Projects: честный %, заметки 📝, колонка карточек maxWidth 1000,
  крошки ПОД заголовком (mt:0.5, ml:6).
- Calculators (22 шт, 4 группы, поиск), Help (гайды+FAQ).

## 5. BACKLOG (приоритет чата-3 и далее)
1. ⭐ PriceList: ДВА раздела «Цены на работы»/«Цены на материалы» (вкладки по kind),
   в каждом свои категории+CRUD+шестерёнки; создание с нужным kind.
2. ⭐ Мобилка: проверить/починить фильтр-воронку материалов + добавить фильтр в PriceList.
3. Причёсывание: заголовки выше, высоты/отступы (блокнот), спиннеры на кнопках.
4. BottomNav: кликабельный + настраиваемый пользователем.
5. Excel импорт/экспорт (SheetJS) расценок и материалов — сценарий «тендер».
6. Главная страница; 7. Архив объектов; 8. Роли (до сторов).
9. v2: фото (Yandex Object Storage), инструменты (уровень/отвес/шумомер),
   ИИ (YandexGPT, ключ только на бэке), калькуляторы — через Replit.
10. Блокнот-19 пунктов — хранится в чате-2, ключевое продублировано выше.

## 6. ИЗВЕСТНЫЕ КОСЯКИ (не забыть)
- PriceList показывает ВСЕ kind вперемешку — задача №1.
- Браузерные alert ещё живут в Objects/Projects — постепенно в инфо-модалки.
- isSpecLocked мёртвый в UI — не использовать в новой логике.

## 7. 10 ФАЙЛОВ ДЛЯ НОВОГО ЧАТА
В проект (KB): schema.prisma | materials.service.ts | price-list.service.ts |
Dashboard.tsx | Projects.tsx
В диалог: PriceList.tsx | priceListService.ts | price-list.controller.ts |
Materials.tsx | materialService.ts

## 8. ШАБЛОН ПЕРВОГО ПРОМПТА ЧАТА-3
«Братан, продолжаем FRAME! Ты — senior full-stack + дизайнер. Чат №3.
Стиль работы и правила — в PROJECT_STATUS ниже (особенно п.0: шаги, коммит-ритуал,
счётчик 🔋). Прикрепляю 5 файлов в диалог + 5 в проект. Первая задача: справочник цен
разделить на два раздела «Цены на работы»/«Цены на материалы» (kind уже на бэкенде),
со всеми фишками категорий; затем чиним мобильные фильтры. Поехали!»