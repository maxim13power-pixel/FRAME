# FRAME — правила и конвенции для Cline (авто-подхват)

## Проект
- Monorepo: `backend/` NestJS 11 + Prisma 5.22 + PostgreSQL 15; `frontend/` React 19 + TS 5.9 + MUI 6.5 + Vite 7.
- Алиасы: db = docker postgres :5433, be = :3000, fe = :5000.
- Деплой: Railway (postgres, be, fe). GitHub: maxim13power-pixel/FRAME.

## Команды (выполнять сам, не спрашивать)
- Полная проверка (be + fe): `npm run verify` в корне.
- be сборка: `npm --prefix backend run build`; dev: `npm --prefix backend run start:dev`.
- fe сборка: `npm --prefix frontend run build` (tsc -b && vite build); dev: `npm --prefix frontend run dev`.
- БД локально ТОЛЬКО `npx prisma db push`; прод ТОЛЬКО `npx prisma migrate deploy`.
- EPERM на prisma generate / query_engine = запущен dev-сервер → `taskkill /F /IM node.exe` → повтор.

## Git (ЖЁСТКИЕ запреты)
- НЕ выполнять: `git checkout main`, `git push main`, `git merge main`.
- Работа только на ветке `cline-*` от main: `git checkout -b cline-<scope>`.
- После ЛЮБЫХ правок: `npm run verify` → 0, прежде чем отдавать дифф.
- Commit/merge/push в main делает владелец проекта; Cline может коммитить только на ветке `cline-*`.

## Секреты
- Только `backend/.env` и `frontend/.env` (оба в .gitignore). В коде/коммитах/отчётах — плейсхолдеры.

## Стиль правок
- Якорь не найден → СТОП (не гадать). Файл >300 строк — править кусками.
- Не выдумывать файлы/методы/API. Мёртвый код не оставлять.
- TS strict (noUnusedLocals/noUnusedParameters) → удаляй неиспользуемые импорты.
- Vite читает .env только при старте → после правки .env рестарт fe.

## Дизайн-система
- Синий #1976d2, текст #04164b, фон #f0f4fa, успех #4caf50, warning #ed6c02, error #d32f2f.
- Поля outlined, фокус #1976d2 (2px) + заливка #e3f2fd, borderRadius 2. Карточки elevation 0, borderRadius 4, p 4; Stack spacing 2.
- Login/Register/Forgot: maxWidth 400, мобилка full-bleed.

## Аудит (шаблон промта для аудитора)
- «Ты — senior full-stack аудитор (NestJS+Prisma+PG+React+TS+MUI). READ-ONLY. Выведи 🔴/🟡/🟢: файл, строка, суть, как исправить. САМ НЕ ИСПРАВЛЯЙ.»
- Внешним аудитам не верить слепо — сверять с git log.

## Модели/мощность (справочно)
- Мультифайл/гонки/деньги → high (DeepSeek V4 Pro / Kimi K2.7 / Qwen3.8 Max).
- Архитектура/деплой/биллинг → Qwen3.8 Max / DeepSeek V4 Pro.
- Большие аудиты → DeepSeek V4.1 Flash / Qwen3.8 Max.
- Точечный фикс/конфиг → flash-модели (low–medium).
