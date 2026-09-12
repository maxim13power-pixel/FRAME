# PROJECT FRAME — Статус v14 (12.09.2026) — ЧАТ №9

## 0. ПРАВИЛА (копируются из чата в чат, ОБЯЗАТЕЛЬНО)
1. Пошагово: 1 шаг = 1 сообщение, формат «Найди / Замени» с точными якорями.
   Большие файлы — кусками, маленькие — целиком. Файл >300 строк — ВСЕГДА кусками.
2. Ждать «Готово» перед следующим шагом. Тон «братан», пользователь — новичок.
3. КОММИТ-РИТУАЛ в конце каждого ответа с кодом (одна строка, один copy-paste):
   git add . ; git commit -m "№<N>:<scope>: <суть> (DD/MM)" ; git push
   Нумерация продолжается с №79.
4. 🔋 СЧЁТЧИК: старт 30, −1 за любой ответ; показывать в КАЖДОМ ответе;
   ≤10 — предупреждение; 0 — довести шаг и предложить новый чат.
5. Файла нет в контексте → НЕ гадать, просить прикрепить. Копии из старых чатов
   устаревают: якоря брать ТОЛЬКО из файлов, приложенных в текущем чате.
6. Алиасы: db (docker postgres :5433), be (бэкенд :3000), fe (фронт :5000).
7. Танец EPERM/краша на Windows: Ctrl+C → taskkill /F /IM node.exe → старт.
   Схему локально вести ТОЛЬКО через npx prisma db push (НЕ migrate dev).
8. Qwen Code (VSCode) — только анализ/аудит, СТРОГО READ-ONLY, ТОЧЕЧНЫЕ файлы +
   критерии («общие аудиты проекта» галлюцинирует). После шага с кодом — промт
   аудитора; вместе с «Готово» требовать итог аудита.
9. Перед каждым крупным шагом — прогнать аудит (промт в разделе 6).
10. СЕКРЕТЫ: только backend/.env и frontend/.env (оба в .gitignore). В статусе,
    коммитах и репо — ТОЛЬКО плейсхолдеры. Если GitHub Push Protection заблокировал:
    reset --soft → чистый коммит → push --force-with-lease. Ключи НЕ перевыпускать.
11. Vite читает .env только при старте → после правки .env рестарт npm run dev.
12. Не выдумывать файлы/методы/API. После фикса не оставлять мёртвый код.

## 1. СТЕК
Monorepo: backend NestJS+Prisma+PostgreSQL (Docker localhost:5433, порт 3000),
frontend React+TS+MUI+Vite (порт 5000). GitHub: maxim13power-pixel/FRAME.
Деплой: Railway; мобилки — Capacitor (v2); сторы: PlayMarket, RuStore, AppStore.
Цель: $5000+/мес подпиской. Тест-логины (пароль frame123):
foreman@frame.app / +79990000000 (Прораб), customer@frame.app / +79990000001
(Заказчик), sub@frame.app / +79990000002 (Субподрядчик, VIEWER+hidePrices).
Вход по email ИЛИ телефону (validateUser детектит '@').

## 2. ГОТОВО (чаты №6–8, шаги 28–78)
- Доступ: ObjectAccess (role CUSTOMER/FOREMAN/VIEWER + hidePrices + projectId),
  InviteToken (ссылки как в Notion), acceptInvite в транзакции (P2002), модалки
  «Участники»/«Поделиться», AcceptInvite + pendingInviteToken.
- Скрытие цен: stripPrices во всех методах materials.service; totalCost=0 в
  objects/dashboard; фронт Materials.tsx прячет колонки/кнопки/FAB/плашку.
- VIEWER: все мутирующие методы materials.service → 403.
- Регистрация/вход: POST /auth/register (email ИЛИ телефон, race-фикс P2002),
  страницы Login/Register/ForgotPassword(демо)/Terms/Privacy (152-ФЗ),
  «лицо приложения» в стиле Smetter (единые поля, отступы 16px, maxWidth 400).
- Капча (чат №8): CaptchaService (Yandex SmartCaptcha, fail-open, timeout 5s),
  SmartCaptcha.tsx (render() API, изолированный DOM, StrictMode-защита),
  капча на /register, RegisterDto.captchaToken, IP из x-forwarded-for. Аудит 10/10.
- Git: секреты вычищены из истории (force-with-lease).
- UI: Dashboard rail sticky + профиль→/users, DrawerMenu с профилем,
  MobileHeaderContext, настраиваемый BottomNav (Settings), 20+ калькуляторов.

## 3. P0 / P1 / P2 (аудит)
### 🔴 P0 — план чата №9
1. MaterialsController БЕЗ ObjectAccessGuard (все методы + price-item)
2. JWT_SECRET fallback 'SECRET_KEY' в jwt.strategy.ts И auth.module.ts → убрать, кидать ошибку при старте
3. CORS origin:true в main.ts → whitelist origin фронтенда
4. ForgotPassword: демо без бэка → endpoint + модель PasswordResetToken + Brevo SMTP
5. RegisterDto: валидация «email ИЛИ phone обязательны» (сейчас оба @IsOptional)
6. ChangeRequest: модель есть, логики НЕТ (controller/service/DTO) — розовые согласования
7. auth.controller.spec.ts активен → 'Cannot find name describe' ломает tsc:
   закомментировать целиком (как auth.service.spec.ts) ИЛИ npm i -D @types/jest
### 🟡 P1
- Objects.tsx (1301) / Materials.tsx (1853) — разбить на подкомпоненты
- Почистить закомментированный код в Materials.tsx (LockIcon, DeleteIcon, старый handleAddFix)
- Мёртвые файлы «Home copy*.tsx» и т.п. — НЕ трогать без команды
- Terms/Privacy: реквизиты оператора (ИП/ООО, ИНН) перед сторами
- Проверить Register.tsx НА ДИСКЕ: шлёт captchaToken (KB-копия устарела)
- Изоляция проектов: ObjectAccess.projectId не участвует в проверках
### 🟢 P2
- STORE_URLS пусты (задел Universal Links готов); orgId-заглушка в dashboard.types.ts
- ThrottlerModule на register/login; refresh-токены
- Биллинг: модель Subscription, тарифы (Прораб ~490-790₽, Бригада ~1990₽), FREE-лимиты

## 4. KNOWN ISSUES (НЕ баги, не чиним)
- Консоль React #418/#423 + «robustness level» — внутри бандла Яндекса, влияния нет.
- Vite .env — только рестарт (правило 11).
- Cline+Ollama qwen3-coder:30b: контекст 32768, только точечные задачи.
- OpenRouter free банит VPN-IP.

## 5. СЕКРЕТЫ (НЕ в репо!)
backend/.env: DATABASE_URL, JWT_SECRET, SMARTCAPTCHA_SERVER_KEY (ysc2_…), BREVO_*
frontend/.env: VITE_SMARTCAPTCHA_CLIENT_KEY (ysc1_…)
В статусе/коммитах — только плейсхолдеры (правило 10).

## 6. ПРОМТ ДЛЯ QWEN CODE (перед крупным шагом и после шага)
Ты — senior full-stack аудитор (NestJS+Prisma+PostgreSQL+React+TS+MUI).
Проведи READ-ONLY аудит, НИЧЕГО не изменяй. Контекст: PROJECT_STATUS v14 +
приложенные файлы. Выведи: 🔴 КРИТИЧНО / 🟡 ВНИМАНИЕ / 🟢 ЗАМЕТКА.
Каждый пункт: файл, строка, суть, как исправить. САМ НЕ ИСПРАВЛЯЙ.
(Давай только точечные файлы, не «весь проект».)

## 7. ДИЗАЙН-СИСТЕМА (для UI-шагов)
Синий #1976d2; текст #04164b; фон страниц #f0f4fa; успех #4caf50;
warning #ed6c02; error #d32f2f. Поля: outlined, белый фон, фокус — рамка
#1976d2 2px + заливка #e3f2fd, borderRadius 2. Карточки: elevation 0,
borderRadius 4, p 4; отступы Stack spacing 2 (16px). Login/Register/Forgot:
maxWidth 400, мобилка full-bleed (borderRadius xs 0). Ссылки «регистрации» /
«Забыли пароль?»: underline always + baseline sx (p:0, lineHeight inherit).

## 8. МЕТРИКИ И НОМЕРАЦИЯ
Шагов сделано: 78. СЛЕДУЮЩИЙ КОММИТ: №79. Оценка аудита: 7.0/10 (цель 8.5 после P0).
История: №1-4 база; №5 схема доступов; №6 приглашения+скрытие цен;
№7 (шаги 47-72): guard, транзакция invite, регистрация, лицо приложения;
№8 (шаги 73-78): капча Яндекс end-to-end, вычистка секретов.

## 9. ПЛАН ЧАТА №9
1. Сверка нумерации: git log --oneline -15 (последний = №78)
2. P0-7 spec → чистая сборка | 3. P0-2 JWT_SECRET | 4. P0-3 CORS
5. P0-1 Guard на MaterialsController | 6. P0-5 RegisterDto | 7. P0-4 ForgotPassword+Brevo
8. P0-6 ChangeRequest (если позволит счётчик) | 9. Передача в чат №10 с планом P1