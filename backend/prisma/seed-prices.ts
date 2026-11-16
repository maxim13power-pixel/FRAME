// backend/prisma/seed-prices.ts
// ⭐ №277 (§120): наполнить образец рыночными ценами БЕЗ удаления позиций.
// Для существующей базы: `npm --prefix backend run db:seed:prices`.
import { PrismaClient } from '@prisma/client';
import { seedSystemPriceCatalog } from './price-seed';

const prisma = new PrismaClient();

async function main() {
  const result = await seedSystemPriceCatalog(prisma);
  console.log('Образец цен обновлён:', result);
}

main()
  .catch((error) => {
    console.error('Не удалось обновить цены образца:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
