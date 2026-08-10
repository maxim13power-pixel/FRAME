# PROJECT_STATUS.md — FRAME App
**Дата обновления:** 10.08.2026
**Этап:** Готов раздел Projects + валидация дат. Следующий: Таблицы материалов.

---

## 🎯 ЦЕЛИ ПРОЕКТА

**Глобальная:** Кроссплатформенное приложение FRAME для учёта строительных
работ (Web + Mobile). Публикация в PlayMarket/RuStore/AppStore.
Доход $5000+/мес через подписку.

**Текущая:** Таблицы материалов/работ внутри проекта ("сердце приложения")
— CRUD, подсчёт процентов, выгрузка в Excel.

---

## ✅ ЧТО УЖЕ СДЕЛАНО

### Раздел Objects (/objects)
- CRUD объектов (создание, редактирование через шестерёнку, удаление)
- Поиск + сортировка (newest, name, endDate, progress)
- Карточки: PlaceIcon, прогресс-бар #1976d2, чип %, чип дней
- Валидация: дата окончания >= дата начала
- plannedEndDate — показывается в скобках если отличается
- Формат дат: 2-значный год (09.08.26)
- FAB зелёный (#4caf50), bottom: 114, right: 21

### Раздел Projects (/objects/:objectId/projects)
- CRUD проектов, поиск
- Дизайн синхронизирован с Objects (DescriptionIcon, прогресс-бар)
- FAB синий (#1976d2) — НАМЕРЕННО отличается от объектов
- Валидация дат + ConfirmDialog при конфликте
- Авто-продление endDate объекта через PATCH /objects/:id/end-date
- pendingProject для сохранения данных во время диалога

### Бэкенд
- NestJS + Prisma + PostgreSQL (локально в Docker, порт 5433)
- Модули: Auth (JWT), Objects, Projects
- class-validator для DTO
- Миграция add-planned-end-date

### Локальная AI-система
- Ollama + deepseek-coder:33b (локально)
- Расширение Continue в VS Code
- Конфиг в .continue/config.json

---

## 🔑 КЛЮЧЕВЫЕ РЕШЕНИЯ (НЕ МЕНЯТЬ!)

1. **FAB разного цвета:** Objects=зелёный, Projects=синий (UX-фишка)
2. **Прогресс-бар однотонный синий #1976d2** (градиент отклонён как "колхозный")
3. **Авто-продление объекта** вместо жёсткой валидации дат
4. **plannedEndDate** — заказчик видит план, прораб двигает endDate
5. **disableRestoreFocus={true}** на всех Modal
6. **component="span"** в Typography внутри DialogTitle

---

## 📁 СТРУКТУРА ПРОЕКТА
FRAME/
├── backend/
│ ├── prisma/schema.prisma ← модели Object, Project
│ ├── src/auth/ ← JWT авторизация
│ ├── src/objects/ ← CRUD + end-date
│ ├── src/projects/ ← CRUD
│ └── src/prisma/ ← PrismaModule
├── frontend/
│ ├── src/pages/ ← Objects.tsx, Projects.tsx
│ ├── src/components/ ← ConfirmDialog.tsx
│ ├── src/services/ ← objectService, projectService
│ └── src/contexts/ ← AuthContext
├── .continue/config.json ← локальная AI
└── PROJECT_STATUS.md ← этот файл


---

## 🚀 КОМАНДЫ ЗАПУСКА

```bash
# Backend
cd C:\PROJECTS\FRAME\backend
npm run start:dev

# Frontend (в отдельном терминале)
cd C:\PROJECTS\FRAME\frontend
npm run dev -- --host

# Доступ с телефона: http://192.168.31.106:5173

⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ
Deprecation MUI: InputLabelProps/inputProps → не трогать сейчас
getProgress() возвращает Math.random() → заглушка
Двойные вызовы useEffect в dev → React StrictMode, норма
🔜 СЛЕДУЮЩИЕ ШАГИ
Этап 1: Таблицы материалов (ПРИОРИТЕТ)
Модель Material в Prisma + enum Unit
Миграция npx prisma migrate dev --name add-materials
Модуль materials на бэкенде (по паттерну projects)
Роут /objects/:objectId/projects/:projectId/materials
Страница Materials.tsx + materialService.ts
Этап 2: Умные фичи
Ежедневные записи (DailyEntry)
Автоподсчёт progressPercent
Фото работ
Этап 3: Импорт/Экспорт Excel
🎨 СТИЛЬ РАБОТЫ
Пошагово, по одному действию за раз
Указывать "куда вставить" (перед/после какой строки)
Пользователь — новичок, объяснять детально
После каждого шага ждать подтверждения


---

### **Шаг 4: Сохрани файл**

Нажми **Ctrl+S**. Всё, файл создан! ✅

---

### **Шаг 5: Закоммить в Git (чтобы не потерять)**

В терминале VS Code (Ctrl + `):

```bash
cd C:\PROJECTS\FRAME
git add PROJECT_STATUS.md
git commit -m "docs: добавлен PROJECT_STATUS.md для контекста"