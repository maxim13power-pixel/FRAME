// backend/scripts/seed-plans.js
// ⭐ №404: сиды тарифов (docs/PRICING.md §2) + разовый grandfathering.
// Идемпотентно: повторный запуск обновляет тарифы и НЕ трогает аккаунты, созданные позже cutoff.
//
//   node scripts/seed-plans.js
//   npm run db:seed:plans
//
// Grandfather: «Бригада» бессрочно выдаётся ТОЛЬКО аккаунтам, которые существовали на момент
// миграции billing_plans (2026-11-26 07:28:43 UTC). Все, кто зарегистрировался позже, остаются
// на Free — иначе каждый повторный запуск сидов (деплой, staging) дарил бы Бригаду новым людям.
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(BACKEND, '.env'), 'utf8');
process.env.DATABASE_URL = env.match(/DATABASE_URL\s*=\s*"?([^"\r\n]+)/)[1].trim();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Дата миграции billing_plans: всё, что создано ДО неё, получает Бригаду навсегда. */
const GRANDFATHER_CUTOFF = new Date('2026-11-26T07:28:43Z');

// Лимиты — ровно как в docs/PRICING.md §2. Меняются здесь, а не в коде продукта.
const PLANS = [
  {
    code: 'FREE',
    name: 'Старт',
    priceMonthly: 0,
    maxObjects: 1,
    maxRows: 150,
    maxPhotos: 5, // 5 активных фото (удалил — слот свободен)
    maxStorageMb: null,
    maxPdfPerMonth: 3, // PDF с водяным знаком
    maxExportRows: 150,
    maxWriters: 0, // только владелец
    maxViewers: 1,
    historyMonths: 3,
    isPublic: true,
    sortOrder: 1,
  },
  {
    code: 'FOREMAN',
    name: 'Прораб',
    priceMonthly: 499,
    maxObjects: 5,
    maxRows: 5000,
    maxPhotos: null, // ограничение по объёму
    maxStorageMb: 3072, // 3 ГБ ≈ 10 000 снимков по 300 КБ
    maxPdfPerMonth: 200,
    maxExportRows: 5000,
    maxWriters: 3,
    maxViewers: 5,
    historyMonths: 24,
    isPublic: true,
    sortOrder: 2,
  },
  {
    code: 'TEAM',
    name: 'Бригада',
    priceMonthly: 1490,
    maxObjects: 20,
    maxRows: 30000,
    maxPhotos: null,
    maxStorageMb: 15360, // 15 ГБ ≈ 50 000 снимков
    maxPdfPerMonth: 1000,
    maxExportRows: 10000,
    maxWriters: 8,
    maxViewers: 30,
    historyMonths: 36,
    isPublic: true,
    sortOrder: 3,
  },
];

(async () => {
  for (const plan of PLANS) {
    const { code, ...data } = plan;
    await prisma.plan.upsert({ where: { code }, update: data, create: plan });
  }
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('тарифы:');
  for (const p of plans) {
    console.log(
      '  %s (%s): %d ₽, объектов %d, строк %d, фото %s, PDF %d/мес',
      p.code, p.name, p.priceMonthly, p.maxObjects, p.maxRows,
      p.maxPhotos != null ? `${p.maxPhotos} активных` : `${Math.round((p.maxStorageMb || 0) / 1024)} ГБ`,
      p.maxPdfPerMonth,
    );
  }

  // Grandfathering — ОДИН раз и только для аккаунтов, существовавших до миграции.
  const withoutSub = await prisma.user.findMany({
    where: { subscription: null, createdAt: { lt: GRANDFATHER_CUTOFF } },
    select: { id: true, email: true },
  });
  if (withoutSub.length > 0) {
    // skipDuplicates: повторный запуск не упадёт и не перезапишет ручные подписки
    await prisma.subscription.createMany({
      data: withoutSub.map((u) => ({
        userId: u.id,
        planCode: 'TEAM',
        status: 'ACTIVE',
        source: 'GRANDFATHER',
        grandfather: true,
        periodEnd: null,
      })),
      skipDuplicates: true,
    });
    console.log(
      'grandfather выдан %d аккаунтам (cutoff %s): %s',
      withoutSub.length,
      GRANDFATHER_CUTOFF.toISOString(),
      withoutSub.map((u) => u.email).join(', '),
    );
  } else {
    console.log('grandfather: новых аккаунтов до cutoff нет');
  }

  const later = await prisma.user.count({
    where: { subscription: null, createdAt: { gte: GRANDFATHER_CUTOFF } },
  });
  if (later > 0) {
    console.log('новых аккаунтов после cutoff (остаются на Free): %d', later);
  }

  const subs = await prisma.subscription.groupBy({ by: ['planCode'], _count: { _all: true } });
  console.log('подписки по планам:', JSON.stringify(subs.map((s) => ({ plan: s.planCode, count: s._count._all }))));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ сиды не применились:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
