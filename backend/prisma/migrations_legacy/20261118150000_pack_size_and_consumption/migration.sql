-- ⭐ №318: упаковка материала и норма расхода в строке сметы.
-- PriceItem.packSize — сколько единиц (кг/л/шт) в упаковке; цена `price` — за упаковку.
-- Material.consumption — сколько единиц материала нужно на 1 единицу строки.
-- Тогда цена материала на единицу строки = price / packSize × consumption.
ALTER TABLE "price_items" ADD COLUMN "packSize" DOUBLE PRECISION;
ALTER TABLE "materials" ADD COLUMN "consumption" DOUBLE PRECISION;
