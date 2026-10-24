// backend/src/price-list/catalog-access.ts
// ⭐ №164: единая проверка доступа к справочнику цен.
// Справочник бывает:
//   • системный (ownerId=null, ни к чему не привязан) — читают все, правит ADMIN;
//   • личный (ownerId=userId) — читает и правит владелец;
//   • объектный (Object.catalogId) — читают участники объекта, правят заказчик/прораб;
//   • проектный (Project.catalogId) — то же, но в рамках проекта (проект перекрывает объект).
// Отдельной модели «шаринга» нет: поделиться = скопировать расценки (см. copyCatalog).
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  loadAccessGrants,
  resolveObjectRole,
  resolveProjectRole,
} from '../auth/access-scope';

/** Роли, которым разрешено менять справочник объекта/проекта (решение 10.1(2)) */
export const CATALOG_WRITE_ROLES: AccessRole[] = [
  AccessRole.CUSTOMER,
  AccessRole.FOREMAN,
];

export function canWriteWithRole(role: AccessRole | null | undefined) {
  return !!role && CATALOG_WRITE_ROLES.includes(role);
}

export interface CatalogBindings {
  objects: { id: number; name: string }[];
  projects: { id: number; name: string; objectId: number }[];
}

export interface CatalogAccess extends CatalogBindings {
  catalog: {
    id: number;
    name: string;
    ownerId: number | null;
    isArchived: boolean;
  };
  canRead: boolean;
  canWrite: boolean;
}

/** Привязки справочника: к каким объектам и проектам он подключён */
export async function loadCatalogBindings(
  prisma: PrismaService,
  catalogId: number,
): Promise<CatalogBindings> {
  const [objects, projects] = await Promise.all([
    prisma.object.findMany({
      where: { catalogId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    }),
    prisma.project.findMany({
      where: { catalogId },
      select: { id: true, name: true, objectId: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { objects, projects };
}

/**
 * Права пользователя на справочник. null — справочника нет.
 * Один запрос за привязками; записи доступа читаются только если иначе прав не видно.
 */
export async function loadCatalogAccess(
  prisma: PrismaService,
  catalogId: number,
  userId?: number,
): Promise<CatalogAccess | null> {
  const catalog = await prisma.priceCatalog.findUnique({
    where: { id: catalogId },
    select: { id: true, name: true, ownerId: true, isArchived: true },
  });
  if (!catalog) return null;

  const bindings = await loadCatalogBindings(prisma, catalogId);
  const isSystem = catalog.ownerId === null;
  let canRead = isSystem || (!!userId && catalog.ownerId === userId);
  let canWrite = isSystem ? false : !!userId && catalog.ownerId === userId;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') {
      canRead = true;
      canWrite = true;
    }
    // Системный справочник правит только ADMIN — привязка к проекту этого не меняет
    if ((!canRead || !canWrite) && catalog.ownerId !== null) {
      const grants = await loadAccessGrants(prisma, userId);
      for (const o of bindings.objects) {
        const role = resolveObjectRole(grants, o.id).role;
        if (role) canRead = true;
        if (canWriteWithRole(role)) canWrite = true;
      }
      for (const p of bindings.projects) {
        const role = resolveProjectRole(grants, p.objectId, p.id);
        if (role) canRead = true;
        if (canWriteWithRole(role)) canWrite = true;
      }
    }
  }

  return { catalog, canRead, canWrite, ...bindings };
}
