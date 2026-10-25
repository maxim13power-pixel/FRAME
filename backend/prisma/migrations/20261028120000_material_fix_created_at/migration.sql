-- ⭐ №174: момент ВНЕСЕНИЯ фиксации.
-- fixedAt остаётся «за какой день работа» (его можно ставить задним числом
-- в окне «сегодня + 3 предыдущих дня»), а createdAt — когда запись создали:
-- от него отсчитываются 72 часа, в течение которых фиксацию можно исправить.
ALTER TABLE "material_fixes"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
