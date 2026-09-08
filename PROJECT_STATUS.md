# PROJECT FRAME — Статус v12 (09.09.2026)

## 🎯 Проект
SaaS для учёта строительных работ, материалов и оборудования.
Роли: CUSTOMER (заказчик), FOREMAN (прораб), VIEWER (наблюдатель без денег).
Стек: NestJS + Prisma + PostgreSQL (Railway) / React + TypeScript + MUI + React Router.

## ✅ Реализовано (72 шага)

### Backend
- **Auth:** JWT + bcrypt, регистрация (email-only по решению продукта), логин email/phone по @, rememberMe (30d/1d)
- **ObjectAccessGuard:** подключён к Objects/Projects/Invites; **ОТСУТСТВУЕТ на MaterialsController (P0!)**
- **VIEWER protection:** все 8 мутирующих методов materials.service.ts защищены (create/addFix/editLastFix/update/remove/updateSpecQty/toggleSpecLock/createPriceItemWithCategory)
- **Race conditions:** транзакции + SELECT FOR UPDATE в addFix/editLastFix/acceptInvite; P2002-retry в createPriceItemWithCategory
- **Скрытие цен:** stripPrices + mustHidePrices в materials.service.ts, фильтрация в objects.service.ts
- **Приглашения:** ссылки-приглашения (InviteToken), прямое приглашение email/phone, автопринятие после логина (pendingInviteToken в localStorage)
- **Модель данных:** User, Object, Project, Material, MaterialFix, PriceCategory, PriceItem, ObjectAccess, InviteToken, ChangeRequest (модель есть, логики НЕТ — P1)

### Frontend
- **Auth pages:** Login, Register, ForgotPassword (демо), AcceptInvite — единый Smetter-стиль
- **Основные страницы:** Objects, Projects, Materials (самая сложная — 1853 строки), PriceList, Calculators (15+ штук)
- **Layout:** Dashboard с rail-сайдбаром (64px свёрнутый, 240px раскрытый), статичный через sticky+minHeight:0, профиль внизу с Z-паттерном
- **Mobile:** AppHeader, BottomNav, DrawerMenu с профилем, MobileHeaderContext
- **VIEWER UI:** скрытие денежных колонок/кнопок/модалок при hidePrices/role=VIEWER
- **Правовые документы:** Terms.tsx, Privacy.tsx (шаблоны 152-ФЗ, TODO реквизиты)

## 🔴 КРИТИЧНО (из аудита, P0 блокеры)
1. MaterialsController без ObjectAccessGuard (все методы + price-item)
2. JWT_SECRET fallback 'SECRET_KEY' в jwt.strategy.ts — убрать, кидать ошибку
3. CORS origin:true в main.ts — ограничить одним origin фронтенда
4. ForgotPassword — демо без бэкенда (реализовать POST /auth/forgot-password + Brevo)
5. RegisterDto: email/phone @IsOptional — нужна кастомная валидация "хотя бы одно"
6. ChangeRequest модель без логики (нет controller/service)
7. **Капча Yandex SmartCaptcha — НЕ ПОДКЛЮЧЕНА** (ключи есть, интеграции нет)

## 🟡 ВНИМАНИЕ (P1)
- Objects.tsx (1301 строка) и Materials.tsx (1853 строки) — слишком длинные, разбить на подкомпоненты
- Закомментированный код в Materials.tsx (LockIcon, DeleteIcon) — почистить
- Мёртвые файлы: Login copy.tsx, Home copy.tsx, Home copy 2.tsx
- MobileHeaderContext не проверен на Warehouse/Analytics/Reports/Settings
- Terms/Privacy — пустые реквизиты оператора (ИП/ООО, ИНН)

## 🟢 ЗАМЕТКА (P2)
- STORE_URLS в config.ts пустые (заполнить при публикации в сторы)
- orgId в dashboard.types.ts — заглушка мульти-тенантности
- Автофокус на email в ForgotPassword
- Hover-эффект на avatar в rail
- Placeholder "Email / телефон" в Login.tsx

## 📊 Метрики
- Backend: ~45 файлов
- Frontend: ~60 файлов
- Строк кода: ~25000
- Шагов реализации: 72
- Оценка аудита: 7.0/10
# backend/.env
DATABASE_URL="postgresql://..."  # Railway, уже настроено
JWT_SECRET=...  # ⚠️ ПРОВЕРИТЬ что не 'SECRET_KEY'!
SMARTCAPTCHA_SERVER_KEY="***_REDACTED_***"  # ЛОКАЛЬНО, не перевыпускать
BREVO_API_KEY=...  # TODO: настроить
BREVO_SENDER_EMAIL=...  # TODO
BREVO_SENDER_NAME="FRAME"
// frontend — публичные ключи
SMARTCAPTCHA_CLIENT_KEY = "***_REDACTED_***"
SITE_URL = "https://web.max.ru/-77702883548569"  // заглушка, заменить на реальный сайт
// frontend — публичные ключи
SMARTCAPTCHA_CLIENT_KEY = "***_REDACTED_***"
SITE_URL = "https://web.max.ru/-77702883548569"  // заглушка, заменить на реальный сайт
Цвета:
  primary:       #1976d2
  primary-dark:  #1565c0
  text-dark:     #04164b
  bg-page:       #f0f4fa
  success:       #4caf50
  success-dark:  #388e3c
  warning:       #ed6c02 / #ff9800
  error:         #d32f2f / #f44336
  focus-bg:      #e3f2fd (голубая заливка полей)

Поля (fieldSx):
  variant: outlined
  borderRadius: 2
  backgroundColor: white
  transition: background-color 0.2s
  hover border: #1976d2
  focus: backgroundColor #e3f2fd, border #1976d2 width 2

Карточки:
  elevation: 0
  borderRadius: 4
  p: 4

Отступы:
  Stack spacing: 2 (16px)
  Paper padding: 4 (32px)

Typography:
  h4: 1.8rem, weight 780 (FRAME на логине)
  h5: weight 700 (заголовки страниц)
  body2: weight 400
  caption: weight 400, text.secondary