# Архив старых миграций (до baseline `0_init`)

Эти 28 миграций (сентябрь–ноябрь 2026) **больше не применяются**. Они оставлены только
как история: как появлялись таблицы и колонки.

## Почему архив

- На dev схема всё это время накатывалась `prisma db push`, поэтому `_prisma_migrations`
  в базе не было вовсе — ни одна из этих миграций не применялась.
- На **пустой** базе они дают схему, которая расходится с `schema.prisma` на четыре
  изменения (проверено `prisma migrate diff` 25.11.2026):

  ```sql
  DROP INDEX "price_categories_name_kind_key";                 -- старый unique [name, kind]
  ALTER TABLE "material_fixes" ADD COLUMN "materialUnitPrice" DECIMAL(14,2),
                               ADD COLUMN "unitPrice"         DECIMAL(14,2);
  ALTER TABLE "price_categories" ADD COLUMN "catalogId" INTEGER;
  ALTER TABLE "rentals" ADD COLUMN "closedAt" TIMESTAMP(3);
  CREATE INDEX "price_categories_catalogId_idx" ON "price_categories"("catalogId");
  CREATE UNIQUE INDEX "price_categories_catalogId_name_kind_key"
    ON "price_categories"("catalogId", "name", "kind");
  ALTER TABLE "price_categories" ADD CONSTRAINT "price_categories_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ```

  То есть `migrate deploy` «как есть» на новом окружении дал бы неполную схему.
- Держать их в `prisma/migrations` нельзя: Prisma применила бы их к свежей базе и получила
  расхождение с `schema.prisma`.

## Что вместо них

`prisma/migrations/0_init/migration.sql` — baseline, сгенерированный из `schema.prisma`
(`prisma migrate diff --from-empty --to-schema-datamodel`). Он и есть «схема на 25.11.2026».

Порядок для разных баз — `docs/MIGRATIONS.md` (свежая база, копия dev, старая база из этих
28 миграций). Не переносите файлы обратно в `prisma/migrations`: имя `0_init` должно быть
единственной точкой отсчёта, иначе история разъедется.
