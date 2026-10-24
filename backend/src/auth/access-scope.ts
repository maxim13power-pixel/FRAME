// backend/src/auth/access-scope.ts
// ⭐ №163: единая логика «что видит пользователь».
// Семантика ObjectAccess:
//   projectId = null → доступ на ВЕСЬ объект (все проекты, включая созданные позже);
//   projectId = X    → доступ только к проекту X (остальные проекты объекта не видны).
// Все списки/дашборд/аналитика строят where через эти хелперы, чтобы правила
// доступа не расползались по сервисам.
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessGrant {
  objectId: number;
  projectId: number | null;
  role: AccessRole;
  hidePrices: boolean;
}

export interface AccessScope {
  /** Объекты, где доступ выдан на весь объект */
  fullObjectIds: number[];
  /** Проекты, где доступ выдан точечно */
  projectIds: number[];
  /** Все объекты, где есть хотя бы частичный доступ */
  objectIds: number[];
}

/** Записи доступа пользователя одним запросом (обычно 1–3 строки) */
export async function loadAccessGrants(
  prisma: PrismaService,
  userId: number,
): Promise<AccessGrant[]> {
  return prisma.objectAccess.findMany({
    where: { userId },
    select: { objectId: true, projectId: true, role: true, hidePrices: true },
  });
}

export function buildAccessScope(grants: AccessGrant[]): AccessScope {
  const full = new Set<number>();
  const projects = new Set<number>();
  const objects = new Set<number>();
  for (const g of grants) {
    objects.add(g.objectId);
    if (g.projectId == null) full.add(g.objectId);
    else projects.add(g.projectId);
  }
  return {
    fullObjectIds: [...full],
    projectIds: [...projects],
    objectIds: [...objects],
  };
}

/** Только те записи, где пользователь видит цены (не VIEWER и hidePrices=false) */
export function buildMoneyScope(grants: AccessGrant[]): AccessScope {
  return buildAccessScope(
    grants.filter((g) => g.role !== AccessRole.VIEWER && !g.hidePrices),
  );
}

export function isScopeEmpty(scope: AccessScope): boolean {
  return scope.fullObjectIds.length === 0 && scope.projectIds.length === 0;
}

/** where для Project — только доступные пользователю проекты */
export function accessibleProjectWhere(
  scope: AccessScope,
  opts: { includeArchived?: boolean } = {},
): Prisma.ProjectWhereInput {
  if (isScopeEmpty(scope)) return { id: -1 }; // заведомо пустой результат
  const or: Prisma.ProjectWhereInput[] = [];
  if (scope.fullObjectIds.length) {
    or.push({ objectId: { in: scope.fullObjectIds } });
  }
  if (scope.projectIds.length) {
    or.push({ id: { in: scope.projectIds } });
  }
  return {
    AND: [
      ...(opts.includeArchived ? [] : [{ object: { isArchived: false } }]),
      { OR: or },
    ],
  };
}

/** where для Object — объекты, где есть хотя бы частичный доступ */
export function accessibleObjectWhere(
  scope: AccessScope,
  opts: { includeArchived?: boolean } = {},
): Prisma.ObjectWhereInput {
  if (isScopeEmpty(scope)) return { id: -1 };
  const or: Prisma.ObjectWhereInput[] = [];
  if (scope.fullObjectIds.length) or.push({ id: { in: scope.fullObjectIds } });
  if (scope.projectIds.length) {
    or.push({ projects: { some: { id: { in: scope.projectIds } } } });
  }
  return {
    ...(opts.includeArchived ? {} : { isArchived: false }),
    OR: or,
  };
}

const ROLE_PRIORITY: Record<AccessRole, number> = {
  CUSTOMER: 3,
  FOREMAN: 2,
  VIEWER: 1,
};

/**
 * Роль пользователя на уровне объекта.
 * Объектная запись (projectId=null) важнее проектных: она и определяет права
 * на сам объект (редактирование, архив, создание проектов).
 */
export function resolveObjectRole(
  grants: AccessGrant[],
  objectId: number,
): { role: AccessRole | null; hidePrices: boolean; hasObjectAccess: boolean } {
  const own = grants.filter((g) => g.objectId === objectId);
  const full = own.find((g) => g.projectId == null);
  if (full) {
    return {
      role: full.role,
      hidePrices: full.role === AccessRole.VIEWER || full.hidePrices,
      hasObjectAccess: true,
    };
  }
  if (own.length === 0) {
    return { role: null, hidePrices: false, hasObjectAccess: false };
  }
  // Только проектные записи: берём самую сильную роль, цены скрываем,
  // если их прячет любая из записей.
  const best = own.reduce((a, b) =>
    ROLE_PRIORITY[b.role] > ROLE_PRIORITY[a.role] ? b : a,
  );
  return {
    role: best.role,
    hidePrices: best.role === AccessRole.VIEWER || own.some((g) => g.hidePrices),
    hasObjectAccess: false,
  };
}
