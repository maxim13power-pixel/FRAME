-- P1-3 (шаг 103): Float -> Decimal для денег и объёмов.
-- Деньги:  DECIMAL(14,2); объёмы: DECIMAL(14,3).
-- USING с явным приведением: безопасная конвертация существующих значений
-- (Postgres округлит до нужной точности; NULL остаётся NULL).
-- progressPercent НЕ трогаем — это процент, а не деньги/объём.

-- materials: объёмы (14,3)
ALTER TABLE "materials"
  ALTER COLUMN "specQuantity" TYPE DECIMAL(14,3) USING "specQuantity"::numeric(14,3),
  ALTER COLUMN "totalUsed"    TYPE DECIMAL(14,3) USING "totalUsed"::numeric(14,3),
  ALTER COLUMN "lastEntry"    TYPE DECIMAL(14,3) USING "lastEntry"::numeric(14,3);

-- materials: деньги (14,2)
ALTER TABLE "materials"
  ALTER COLUMN "unitPrice"         TYPE DECIMAL(14,2) USING "unitPrice"::numeric(14,2),
  ALTER COLUMN "totalCost"         TYPE DECIMAL(14,2) USING "totalCost"::numeric(14,2),
  ALTER COLUMN "materialUnitPrice" TYPE DECIMAL(14,2) USING "materialUnitPrice"::numeric(14,2),
  ALTER COLUMN "materialTotalCost" TYPE DECIMAL(14,2) USING "materialTotalCost"::numeric(14,2);

-- material_fixes: объём фиксации (14,3)
ALTER TABLE "material_fixes"
  ALTER COLUMN "amount" TYPE DECIMAL(14,3) USING "amount"::numeric(14,3);

-- price_items: цена расценки (14,2)
ALTER TABLE "price_items"
  ALTER COLUMN "price" TYPE DECIMAL(14,2) USING "price"::numeric(14,2);

-- rentals: деньги (14,2)
ALTER TABLE "rentals"
  ALTER COLUMN "price"      TYPE DECIMAL(14,2) USING "price"::numeric(14,2),
  ALTER COLUMN "totalSpent" TYPE DECIMAL(14,2) USING "totalSpent"::numeric(14,2);