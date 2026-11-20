// backend/prisma/cleanup-access-duplicates.ts
// ⭐ №343: разовая уборка «объект + проекты» — после №341 такие записи больше не создаются,
// но у старых участников они остались. У кого есть активный доступ на весь объект,
// проектные записи удаляем (доступ не теряется — он шире).
//
//   npm --prefix backend run db:cleanup:access            # предпросмотр
//   npm --prefix backend run db:cleanup:access -- --apply # удалить
//
// Перед запуском с --apply СНЯТЬ БЭКАП БД (pg_dump).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const grants = await prisma.objectAccess.findMany({
    where: { revokedAt: null },
    select: {
      id: true,
      userId: true,
      objectId: true,
      projectId: true,
      role: true,
      user: { select: { email: true, fullName: true } },
      object: { select: { name: true } },
    },
    orderBy: [{ objectId: 'asc' }, { userId: 'asc' }],
  });

  const objectGrants = grants.filter((g) => g.projectId == null);
  const byUserObject = new Map<string, typeof grants>();
  for (const g of grants) {
    const key = `${g.objectId}|${g.userId}`;
    const list = byUserObject.get(key) ?? [];
    list.push(g);
    byUserObject.set(key, list);
  }

  const targets = objectGrants
    .map((full) => {
      const key = `${full.objectId}|${full.userId}`;
      const projectGrants = (byUserObject.get(key) ?? []).filter(
        (g) => g.projectId != null,
      );
      return { full, projectGrants };
    })
    .filter((t) => t.projectGrants.length > 0);

  console.log(`активных записей доступа: ${grants.length}`);
  console.log(`людей с объектным доступом: ${objectGrants.length}`);
  console.log(`из них с лишними проектными записями: ${targets.length}`);

  for (const { full, projectGrants } of targets) {
    const who = full.user.email || full.user.fullName || `#${full.userId}`;
    console.log(
      `  ${who} · «${full.object.name}» · объектная роль ${full.role}` +
        ` → удалить проектных записей: ${projectGrants.length}` +
        ` (${projectGrants.map((g) => `#${g.projectId}`).join(', ')})`,
    );
  }

  if (!apply) {
    console.log('\nЭто предпросмотр. Для удаления: npm --prefix backend run db:cleanup:access -- --apply');
    return;
  }

  let removed = 0;
  for (const { full, projectGrants } of targets) {
    const admin = await prisma.objectAccess.findFirst({
      where: {
        objectId: full.objectId,
        projectId: null,
        role: 'CUSTOMER',
        revokedAt: null,
        userId: { not: full.userId },
      },
      select: { userId: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.objectAccess.deleteMany({
        where: { id: { in: projectGrants.map((g) => g.id) } },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin?.userId ?? full.userId,
          entity: 'object',
          entityId: full.objectId,
          action: 'access_merge_to_object',
          before: {
            grants: projectGrants.map((g) => ({
              id: g.id,
              projectId: g.projectId,
              role: g.role,
            })),
          },
          after: { userId: full.userId, merged: projectGrants.length, cleanup: true },
        },
      });
    });
    removed += projectGrants.length;
  }
  console.log(`удалено проектных записей: ${removed}`);
  console.log('готово');
}

main()
  .catch((error) => {
    console.error('Не удалось убрать дубли доступов:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
