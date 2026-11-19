// backend/prisma/reset-user-data.ts
// ⭐ №336: «нулевая отметка» — удалить ВСЕ данные пользователей, оставив системный образец цен.
// Владелец начинает тестирование с нуля после серьёзных изменений.
//
//   npm --prefix backend run db:reset:users            # только показать, что будет удалено
//   npm --prefix backend run db:reset:users -- --yes   # удалить
//
// Перед удалением СНЯТЬ БЭКАП БД: pg_dump (см. docs/HANDOFF.md, §171).
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const confirmed = process.argv.includes('--yes');

async function report(label: string) {
  const [users, objects, projects, materials, catalogs, items, photos, audit] =
    await Promise.all([
      prisma.user.count(),
      prisma.object.count(),
      prisma.project.count(),
      prisma.material.count(),
      prisma.priceCatalog.count(),
      prisma.priceItem.count(),
      prisma.materialPhoto.count(),
      prisma.auditLog.count(),
    ]);
  console.log(
    `${label}: users=${users} objects=${objects} projects=${projects} materials=${materials} ` +
      `catalogs=${catalogs} items=${items} photos=${photos} audit=${audit}`,
  );
}

async function main() {
  await report('СЕЙЧАС');

  if (!confirmed) {
    console.log('\nЭто предпросмотр. Для удаления: npm --prefix backend run db:reset:users -- --yes');
    return;
  }

  // 1) объекты — каскадом проекты, строки, фиксации, фото, склад, отчёты, бригады
  const objects = await prisma.object.deleteMany({});
  // 2) личные справочники — каскадом позиции (SYSTEM остаётся)
  const catalogs = await prisma.priceCatalog.deleteMany({ where: { kind: 'USER' } });
  // 3) шаблоны, снимки, заявки, приглашения, токены, аудит
  const objTemplates = await prisma.objectTemplate.deleteMany({});
  const estTemplates = await prisma.estimateTemplate.deleteMany({});
  const snapshots = await prisma.accessSnapshot.deleteMany({});
  const requests = await prisma.accessRequest.deleteMany({});
  const invites = await prisma.inviteToken.deleteMany({});
  const verify = await prisma.verificationToken.deleteMany({});
  const reset = await prisma.passwordResetToken.deleteMany({});
  const audit = await prisma.auditLog.deleteMany({});
  // 4) пользователи
  const users = await prisma.user.deleteMany({});

  console.log('удалено:', {
    objects: objects.count,
    catalogs: catalogs.count,
    objTemplates: objTemplates.count,
    estTemplates: estTemplates.count,
    snapshots: snapshots.count,
    requests: requests.count,
    invites: invites.count,
    verify: verify.count,
    reset: reset.count,
    audit: audit.count,
    users: users.count,
  });

  // 5) файлы фото осиротели — убираем (файлы вне БД, поэтому отдельно)
  const photosDir = path.join(process.cwd(), 'uploads', 'photos');
  let removed = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
        fs.unlinkSync(full);
        removed += 1;
      }
    }
  };
  if (fs.existsSync(photosDir)) walk(photosDir);
  console.log('удалено файлов фото:', removed);

  const left = await prisma.priceCatalog.findMany({
    select: { id: true, name: true, kind: true, _count: { select: { items: true } } },
  });
  console.log('осталось справочников:', left);
  await report('ПОСЛЕ');
}

main()
  .catch((error) => {
    console.error('Не удалось очистить данные:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
