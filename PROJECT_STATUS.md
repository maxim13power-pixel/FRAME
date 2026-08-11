# PROJECT_STATUS.md — FRAME App
**Дата обновления:** 10.08.2026
**Этап:** Prisma-модели Material/MaterialFix готовы. Следующий шаг: NestJS-модуль materials.

---

## 🎯 ЦЕЛИ ПРОЕКТА

**Глобальная:** Кроссплатформенное приложение FRAME для учёта строительных
работ (Web + Mobile). Публикация в PlayMarket/RuStore/AppStore.
Доход $5000+/мес через подписку.

**Текущая:** Таблицы материалов/работ внутри проекта ("сердце приложения")
— CRUD, фиксация объёмов, подсчёт процентов, выгрузка в Excel.

---

## ✅ ЧТО УЖЕ СДЕЛАНО

### Раздел Objects (/objects)
- CRUD объектов (создание, редактирование через шестерёнку, удаление)
- Поиск + сортировка (newest, name, endDate, progress)
- Карточки: PlaceIcon, прогресс-бар #1976d2, чип %, чип дней
- Валидация: дата окончания >= дата начала
- plannedEndDate — показывается в скобках если отличается от endDate
- Формат дат: 2-значный год (09.08.26)
- FAB зелёный (#4caf50), bottom: 114, right: 21

### Раздел Projects (/objects/:objectId/projects)
- CRUD проектов, поиск
- Дизайн синхронизирован с Objects (DescriptionIcon, прогресс-бар)
- FAB синий (#1976d2) — НАМЕРЕННО отличается от объектов (UX-фишка)
- Валидация дат + ConfirmDialog при конфликте
- Авто-продление endDate объекта через PATCH /objects/:id/end-date
- pendingProject для сохранения данных во время диалога
- Блок "Сроки работ по объекту" в модалках (синяя рамка с чипами дат)

### Бэкенд
- NestJS + Prisma + PostgreSQL в Docker (порт 5432)
- Модули: Auth (JWT), Objects, Projects
- class-validator для DTO
- Миграции: add-planned-end-date, add-materials-and-fixes

### Prisma-схема (актуальное состояние)
- User, Object, Project, Role — готовы
- **Material** — добавлена с полями:
  - specQuantity (план), totalUsed (факт), progressPercent
  - isSpecLocked (защита спецификации от случайного изменения)
  - lastEntry, lastEntryDate, note, article
- **MaterialFix** — добавлена для истории каждой фиксации объёма
  - amount, note, fixedAt, userId
- **Enum Unit** — 10 значений (PIECE, METER, M2, M3, KG, L, T, BAG, PACKAGE, SET)
- Связи: Project → Materials (1:N), Material → Fixes (1:N)
- Все связи с onDelete: Cascade

### Локальная AI-система
- Ollama + deepseek-coder:33b (локально, для VS Code)
- Расширение Continue в VS Code
- Конфиг в .continue/config.json

---

## 🔑 КЛЮЧЕВЫЕ РЕШЕНИЯ (НЕ МЕНЯТЬ!)

1. **FAB разного цвета:** Objects=зелёный (#4caf50), Projects=синий (primary)
   Осознанное UX-решение — пользователь визуально различает разделы.
2. **Прогресс-бар однотонный синий #1976d2** (градиент отклонён как "колхозный"
   для аудитории прорабов/инженеров).
3. **Авто-продление объекта** вместо жёсткой валидации дат (в стройке даты
   постоянно сдвигаются).
4. **plannedEndDate** — заказчик видит первоначальный план, прораб может
   сдвигать endDate. Если отличаются — план показывается в скобках.
5. **disableRestoreFocus={true}** на всех Modal — убирает aria-hidden warning.
6. **component="span"** в Typography внутри DialogTitle — убирает warning
   h6 inside h2.
7. **isSpecLocked** — защита спецификации от случайного редактирования
   (нужно подтверждение через модалку).
8. **MaterialFix** — отдельная таблица для истории каждой фиксации объёма
   (не просто обновление поля, а запись каждой операции).
9. **Pending-паттерн** (pendingProject) — сохранение данных проекта во время
   диалога подтверждения, чтобы они не потерялись.

---

## 📁 СТРУКТУРА ПРОЕКТА
frame-app/
├── backend/
│ ├── prisma/
│ │ ├── schema.prisma ← все модели + enum
│ │ └── migrations/ ← миграции
│ ├── src/
│ │ ├── auth/ ← JWT авторизация
│ │ ├── objects/ ← CRUD + end-date
│ │ ├── projects/ ← CRUD
│ │ ├── materials/ ← 🔜 СЛЕДУЮЩИЙ ШАГ (ещё не создан)
│ │ └── prisma/ ← PrismaModule + PrismaService
│ └── .env ← DATABASE_URL
├── frontend/
│ ├── src/
│ │ ├── pages/ ← Objects.tsx, Projects.tsx
│ │ ├── components/ ← ConfirmDialog.tsx
│ │ ├── services/ ← objectService, projectService
│ │ └── contexts/ ← AuthContext
│ └── vite.config.ts
├── .continue/config.json ← локальный DeepSeek
├── docker-compose.yml ← PostgreSQL в Docker
└── PROJECT_STATUS.md ← этот файл

---

## 🚀 КОМАНДЫ ЗАПУСКА

```bash
# 1. База данных (Docker) — в корне проекта
cd C:\PROJECTS\frame-app
docker compose up -d

# 2. Backend (в отдельном терминале)
cd C:\PROJECTS\frame-app\backend
npm run start:dev

# 3. Frontend (в отдельном терминале)
cd C:\PROJECTS\frame-app\frontend
npm run dev

# 4. Просмотр БД
cd C:\PROJECTS\frame-app\backend
npx prisma studio

# 5. Новая миграция
npx prisma migrate dev --name <имя-миграции>
npx prisma generate

Доступ с телефона: http://192.168.31.106:5173 (IP компьютера в локальной сети)

⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ
Deprecation MUI: InputLabelProps / inputProps → не трогать сейчас.
Замена на slotProps ломает TypeScript. Оставим до MUI v7.
getProgress() возвращает Math.random() → заглушка. Нужно заменить на
реальный расчёт из MaterialFix / Material.progressPercent когда будут таблицы.
Двойные вызовы useEffect в dev → React StrictMode, норма.
content.js: Extension context invalidated → расширение браузера,
не наш код.
Путь проекта — frame-app (строчными!) — НЕ путать с FRAME в документации.

❌ ОПРОБОВАННЫЕ, НО НЕ СРАБОТАВШИЕ ПОДХОДЫ
Подход
Причина отказа
Градиентный прогресс-бар
Не соответствует строгому стилю
Жёсткая блокировка дат (max)
В стройке даты постоянно сдвигаются
window.confirm() / alert()
Плохо на мобильных, не в стиле приложения
slotProps вместо InputLabelProps
TypeScript ошибки
Replit Agent
Слишком много токенов, потеря контроля
Одиночная фиксация без истории
Нужно MaterialFix для полного аудита
🔜 СЛЕДУЮЩИЕ ШАГИ (ПРИОРИТЕТ)
Этап 1: Таблицы материалов
✅ Уже сделано:
Модель Material в Prisma
Модель MaterialFix в Prisma
Enum Unit
Миграция add-materials-and-fixes
Prisma Client сгенерирован
🔲 Что осталось:
Шаг 3: Создать модуль materials на бэкенде:
src/materials/materials.module.ts
src/materials/materials.service.ts (create, findAllByProject,
findOne, remove, addFix, updateSpecQty)
src/materials/materials.controller.ts (с JwtAuthGuard)
dto/create-material.dto.ts
dto/create-fix.dto.ts
dto/update-spec-qty.dto.ts
Зарегистрировать MaterialsModule в AppModule
Создать frontend/src/services/materialService.ts
Создать frontend/src/pages/Materials.tsx с MUI DataGrid/таблицей
Добавить роут /objects/:objectId/projects/:projectId/materials
Добавить кнопку "Материалы" в карточке проекта
Этап 2: Умные фичи
Ежедневные записи расхода (DailyEntry)
Автоподсчёт progressPercent из MaterialFix
Фото работ (до 5 фото)
Этап 3: Импорт/Экспорт
Выгрузка в Excel (exceljs)
Импорт спецификаций из Excel
Защита specQuantity (isSpecLocked)
🎨 СТИЛЬ РАБОТЫ
Пошагово, по одному действию за раз
Указывать "куда вставить" (перед/после какой строки, в каком файле)
Пользователь — новичок, объяснять детально
После каждого шага ждать подтверждения
Использовать паттерны из modules/projects для единообразия
🧠 КОНТЕКСТ ДЛЯ НОВОГО ЧАТА
При старте нового диалога прикрепляй 5 файлов:
backend/prisma/schema.prisma
backend/src/projects/projects.service.ts (паттерн сервиса)
backend/src/projects/projects.controller.ts (паттерн контроллера)
frontend/src/services/projectService.ts (паттерн фронт-сервиса)
frontend/src/pages/Projects.tsx (паттерн страницы)
И вставляй этот PROJECT_STATUS.md текстом в начало чата.


---

## ✅ Твои действия:

1. Открой `PROJECT_STATUS.md` в VS Code
2. Выдели всё (**Ctrl+A**) → удали
3. Вставь текст выше (**Ctrl+V**)
4. Сохрани (**Ctrl+S**)
5. Закоммить:

```bash
cd C:\PROJECTS\frame-app
git add PROJECT_STATUS.md
git commit -m "docs: обновлён PROJECT_STATUS.md - правильные пути, актуальный статус"