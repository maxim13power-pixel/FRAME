-- ⭐ №169: состав выхода бригады — по строке на рабочего.
-- Зачем: «Зафиксировать выход» должен собираться из состава бригады
-- (чекбоксы + часы у каждого), а не из одного поля «Часы».
-- brigade_shifts.hoursWorked остаётся СУММОЙ часов — отчёты/статистика не меняются.

CREATE TABLE IF NOT EXISTS "brigade_shift_members" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "fullName" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brigade_shift_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brigade_shift_members_shiftId_idx"
    ON "brigade_shift_members" ("shiftId");
CREATE INDEX IF NOT EXISTS "brigade_shift_members_memberId_idx"
    ON "brigade_shift_members" ("memberId");

-- Рабочего убрали из бригады → история выходов остаётся (ФИО сохранено снимком).
ALTER TABLE "brigade_shift_members"
    DROP CONSTRAINT IF EXISTS "brigade_shift_members_shiftId_fkey";
ALTER TABLE "brigade_shift_members"
    ADD CONSTRAINT "brigade_shift_members_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "brigade_shifts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brigade_shift_members"
    DROP CONSTRAINT IF EXISTS "brigade_shift_members_memberId_fkey";
ALTER TABLE "brigade_shift_members"
    ADD CONSTRAINT "brigade_shift_members_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "brigade_members"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Старые выходы (до №169) остаются без разреза по рабочим:
-- в списке у них просто показывается общее число часов.
