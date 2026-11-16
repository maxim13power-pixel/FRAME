// backend/src/price-list/working-catalog.ts
// ⭐ №274 (§117): у пользователя ОДНА рабочая база цен.
// Проект ССЫЛАЕТСЯ на справочник и никогда не создаёт копию: новые позиции из
// сметы/импорта пишутся в базу проекта, а если её нет — в рабочую базу владельца.
import { Prisma } from '@prisma/client';

export const WORKING_CATALOG_NAME = 'Мой справочник';

/** Prisma-клиент или транзакция */
type Db = Prisma.TransactionClient;

/**
 * Рабочий справочник пользователя: помеченный isDefault → любой свой → создать пустой.
 * Ошибка «нет справочника» невозможна: пользователь всегда получает базу.
 */
export async function ensureWorkingCatalog(
  db: Db,
  userId: number,
): Promise<{ id: number; name: string; ownerId: number | null }> {
  const preferred = await db.priceCatalog.findFirst({
    where: { ownerId: userId, kind: 'USER', isArchived: false, isDefault: true },
    select: { id: true, name: true, ownerId: true },
  });
  if (preferred) return preferred;

  const fallback = await db.priceCatalog.findFirst({
    where: { ownerId: userId, kind: 'USER', isArchived: false },
    // самая наполненная база — лучший кандидат на «рабочую»
    orderBy: [{ items: { _count: 'desc' } }, { id: 'asc' }],
    select: { id: true, name: true, ownerId: true },
  });
  if (fallback) {
    await db.priceCatalog.update({ where: { id: fallback.id }, data: { isDefault: true } });
    return fallback;
  }

  return db.priceCatalog.create({
    data: { name: WORKING_CATALOG_NAME, ownerId: userId, kind: 'USER', isDefault: true },
    select: { id: true, name: true, ownerId: true },
  });
}

/**
 * Рабочая база пользователя БЕЗ создания (для чтения/предпросмотра):
 * isDefault → самая наполненная → null. Ничего не пишет.
 */
export async function findWorkingCatalog(
  db: Db,
  userId: number,
): Promise<{ id: number; name: string; ownerId: number | null } | null> {
  return db.priceCatalog.findFirst({
    where: { ownerId: userId, kind: 'USER', isArchived: false },
    orderBy: [{ isDefault: 'desc' }, { items: { _count: 'desc' } }, { id: 'asc' }],
    select: { id: true, name: true, ownerId: true },
  });
}

/**
 * Справочник проекта для записи цен.
 * Есть привязка → она; нет (старый проект) → привязываем рабочую базу БЕЗ копии позиций.
 */
export async function ensureProjectCatalog(
  db: Db,
  projectId: number,
  userId: number,
): Promise<{ id: number; name: string; ownerId: number | null }> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      catalogId: true,
      catalog: { select: { id: true, name: true, ownerId: true } },
    },
  });
  if (!project) throw new Error('Проект не найден');
  if (project.catalog) return project.catalog;

  const working = await ensureWorkingCatalog(db, userId);
  await db.project.update({ where: { id: projectId }, data: { catalogId: working.id } });
  return working;
}
