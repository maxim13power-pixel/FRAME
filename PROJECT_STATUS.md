# PROJECT_STATUS.md — FRAME App
**Дата обновления:** 11.08.2026
**Этап:** Таблицы материалов готовы (CRUD + фиксация + итоговая строка + хлебные крошки). 
Справочник цен: бэкенд готов, фронтенд следующий.

---

## ✅ ЧТО СДЕЛАНО СЕГОДНЯ (11.08.2026)

### Таблицы материалов (Materials.tsx):
- CRUD материалов с модалками добавления/редактирования
- Фиксация объёма (addFix) с историей MaterialFix
- Защита спецификации (isSpecLocked) — замочки
- Шестерёнка вместо урны → модалка настроек → подтверждение удаления
- Итоговая строка (TableFooter) с суммами specQuantity/totalUsed/средний %
- Хлебные крошки: Объекты › [объект] › [проект] › Материалы
- Снэкбары вместо браузерных alert (Snackbar с autoHideDuration)
- Серые плейсхолдеры "0" в числовых полях
- Сортировка кликом по заголовкам (Cline)

### Справочник цен (PriceList):
- Схема Prisma: PriceCategory + PriceItem + связь с Material
- Поля в Material: priceItemId (FK), unitPrice (snapshot), totalCost (автосчёт)
- Бэкенд-модуль price-list: CRUD + search
- Эндпоинты:
  - GET /price-list/categories
  - GET /price-list/categories/full (с items)
  - GET /price-list/items/search?search=&categoryId=
  - POST /price-list/categories
  - POST /price-list/items
  - PATCH /price-list/items/:id
  - DELETE /price-list/items/:id (деактивация, не удаление)
- onDelete: SetNull для Material → PriceItem (защита смет)

### UX-улучшения:
- Хлебные крошки в Materials (навигация)
- Cline провёл UX-аудит мобилки (найдены проблемы с мелкими кнопками)
- Cline проанализировал Excel-шаблон (структура колонок, защита ячеек)

---

## 🔜 СЛЕДУЮЩИЕ ШАГИ

### Этап 1: Фронтенд справочника цен (ПРИОРИТЕТ)
- [ ] Создать `frontend/src/services/priceListService.ts`
- [ ] Создать `frontend/src/pages/PriceList.tsx` (таблица категорий + позиций)
- [ ] Добавить роут `/price-list` в App.tsx
- [ ] Добавить кнопку "Справочник цен" в сайдбар/навигацию

### Этап 2: Интеграция справочника в Materials
- [ ] Autocomplete в модалке добавления материала (поиск по PriceItem)
- [ ] При выборе PriceItem → копируем unitPrice в Material (snapshot)
- [ ] Колонка "Цена" в таблице материалов
- [ ] Колонка "Стоимость" = totalUsed × unitPrice
- [ ] Обновлённая итоговая строка с суммой стоимости

### Этап 3: UX-фиксы мобилки (из аудита Cline)
- [ ] Увеличить IconButton до min 48×48px (для перчаток)
- [ ] Добавить confirm для toggleSpecLock
- [ ] Переместить шестерёнку в удобное место (большой палец)

### Этап 4: Excel-экспорт (бэклог)
- [ ] Кнопка "Экспорт .xlsx" в Materials
- [ ] Структура: ID, Наименование, Ед., Кол-во, Цена, Стоимость
- [ ] Защита ячеек: ID/описание = только чтение, цена = редактирование

---

## 🎨 СТИЛЬ РАБОТЫ

- Пошагово, по одному действию за раз
- Указывать "куда вставить" (перед/после какой строки)
- Пользователь — новичок, объяснять детально
- После каждого шага ждать подтверждения
- Использовать паттерны из Materials для единообразия

---

## 🧠 КОНТЕКСТ ДЛЯ НОВОГО ЧАТА

При старте нового диалога прикрепляй 5 файлов:
1. `backend/prisma/schema.prisma`
2. `backend/src/price-list/price-list.service.ts`
3. `backend/src/price-list/price-list.controller.ts`
4. `frontend/src/services/materialService.ts`
5. `frontend/src/pages/Materials.tsx`

И вставляй этот PROJECT_STATUS.md текстом в начало чата.

---

*Обновлять этот файл после каждого крупного изменения!*