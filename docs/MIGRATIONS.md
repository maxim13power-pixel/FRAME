# Миграции базы данных (production-ready)

> ⭐ №394, 25.11.2026. До этой задачи схема на dev накатывалась `prisma db push`, в базе не
> было таблицы `_prisma_migrations`, а 28 старых миграций на пустой базе давали **неполную**
> схему (без `price_categories.catalogId`, unique `[catalogId, name, kind]`,
> `material_fixes.unitPrice/materialUnitPrice`, `rentals.closedAt`).
> `backend/amvera.yaml` и `backend/railway.json` запускают `npx prisma migrate deploy` —
> значит без этой задачи деплой на новую базу создал бы кривую схему, а на существующую упал бы.

## Что теперь в репозитории

| Путь | Что это |
|---|---|
| `backend/prisma/migrations/0_init/migration.sql` | **baseline**: полная схема на 25.11.2026, сгенерирована из `schema.prisma` |
| `backend/prisma/migrations_legacy/` | архив 28 старых миграций + `README.md` (почему архив) |
| `backend/prisma/sql/2026-11-25_sync-from-legacy.sql` | «догоняющий» SQL для базы, собранной старыми миграциями |
| `docs/MIGRATIONS.md` | этот файл — порядок действий |

`0_init` — единственная точка отсчёта. Файлы из `migrations_legacy` обратно в
`prisma/migrations` не переносить.

## Три сценария

### 1. Новая (пустая) база — staging, новое окружение

```bash
cd backend
npx prisma migrate deploy      # или: npm run db:migrate:deploy
```

Создаётся вся схема (`0_init`). Проверка: `npx prisma migrate status` → «Database schema is
up to date!». Проверено 25.11.2026 на пустой базе: 33 таблицы (32 таблицы приложения +
`_prisma_migrations`), 94 индекса, 44 внешних ключа — `migrate diff` к `schema.prisma` пустой.

### 2. Существующая база, схема которой уже совпадает со `schema.prisma`

Так выглядит **dev** (после многомесячного `db push`) и **restore дампа dev** на проде.

```bash
cd backend
# 1) убедиться, что расхождений нет — вывод должен быть «This is an empty migration.»
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
# 2) отметить baseline применённым (это только строка в _prisma_migrations, данные не трогаются)
npx prisma migrate resolve --applied 0_init      # или: npm run db:migrate:baseline
# 3) проверить
npx prisma migrate status                        # → up to date
```

Проверено 25.11.2026 на копии dev-базы (restore дампа `pg_dump -Fc`): до/после —
AuditLog 507, materials 484, material_fixes 10, price_items 1985, price_categories 224,
projects 18, objects 4, users 3; стало +1 таблица и +1 индекс (`_prisma_migrations`),
`migrate diff` к `schema.prisma` пустой. Dev переведён на учёт миграций так же.

### 3. Старая база, собранная 28 legacy-миграциями (например, Railway)

```bash
cd backend
# 1) сверить расхождение — должно совпасть с prisma/sql/2026-11-25_sync-from-legacy.sql
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
# 2) проверить дубли (иначе unique-индекс не создастся)
#    select "catalogId", name, kind, count(*) from price_categories
#    where "catalogId" is not null group by 1,2,3 having count(*) > 1;
# 3) применить SQL в транзакции (psql -v ON_ERROR_STOP=1, begin/commit)
# 4) отметить baseline и проверить
npx prisma migrate resolve --applied 0_init
npx prisma migrate status
```

Проверено 25.11.2026 на копии, собранной этими 28 миграциями: после sync `migrate diff`
пустой, `status` — up to date. Данные не теряются: все новые колонки nullable, а unique по
`(catalogId, name, kind)` не мешает строкам с `catalogId IS NULL` (NULL-ы в PostgreSQL
различаются). Бэкфилл `catalogId` для старых категорий — отдельный скрипт
`backend/scripts/migrate-categories.cjs` (использовался в блоке B2).

## Как добавлять новую миграцию

```bash
cd backend
# dev: Prisma сама сравнит schema.prisma с базой, создаст SQL и применит его
npx prisma migrate dev --name add_something
```

Требования к ревью (перед коммитом):

1. В `migration.sql` нет `DROP TABLE`/`DROP COLUMN` без явного решения владельца.
2. Новые обязательные (NOT NULL) колонки — только с `DEFAULT` или после бэкфилла в той же
   миграции; иначе на проде с данными она упадёт.
3. Индексы по горячим запросам — через `CREATE INDEX` (для больших таблиц на проде —
   `CONCURRENTLY` вручную, Prisma так не умеет).
4. Проверить на копии БД: `migrate deploy` → `migrate status` → `migrate diff` пустой.

## Чего НЕ делать

- `prisma db push` (тем более `--accept-data-loss`) на проде и на любых базах с данными —
  именно из-за него история разъехалась.
- Править уже применённую миграцию: Prisma сверяет контрольную сумму, `migrate deploy`
  начнёт падать. Изменения — только новой миграцией.
- Удалять `_prisma_migrations`.
- Переносить legacy-миграции обратно в `prisma/migrations`.

## Откат

У Prisma нет down-миграций. Поэтому:

1. Перед деплоем — **свежий дамп** (`pg_dump -Fc`) и проверенное восстановление (restore drill).
2. Откат кода — откат образа/коммита; откат схемы — восстановление дампа.
3. Для точечных правок пишем обратный SQL руками и проверяем его на копии базы.

## Полезные команды

```bash
npx prisma migrate status            # что применено, что нет
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
npx prisma migrate resolve --applied 0_init    # baseline для существующей базы
npx prisma migrate deploy                      # применение миграций (прод)
```
