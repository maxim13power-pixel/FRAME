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
  id?: number;
  objectId: number;
  projectId: number | null;
  role: AccessRole;
  hidePrices: boolean;
  /** ⭐ №168: право управлять командой (только для FOREMAN) */
  isManager?: boolean;
  /** ⭐ №168: объект скрыт в личном архиве этого участника */
  isHidden?: boolean;
  /** ⭐ №168: доступ отозван (read-only «как на момент отзыва») */
  revokedAt?: Date | null;
}

/**
 * ⭐ №168: итоговые права пользователя на объект/проект.
 * Один источник истины и для API-проверок, и для UI-флагов.
 */
export interface RoleResolution {
  role: AccessRole | null;
  hidePrices: boolean;
  /** есть общая (projectId = null) запись — права на сам объект */
  hasObjectAccess: boolean;
  isManager: boolean;
  /** доступ отозван → только чтение замороженной копии */
  revoked: boolean;
  canWrite: boolean;
  canManage: boolean;
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
    select: {
      id: true,
      objectId: true,
      projectId: true,
      role: true,
      hidePrices: true,
      isManager: true,
      isHidden: true,
      revokedAt: true,
    },
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

/** Только те записи, где пользователь видит цены (не VIEWER, hidePrices=false, доступ активен) */
export function buildMoneyScope(grants: AccessGrant[]): AccessScope {
  return buildAccessScope(
    grants.filter(
      // ⭐ №169: объект из личного архива в деньгах/KPI не участвует
      (g) =>
        !g.revokedAt &&
        !g.isHidden &&
        g.role !== AccessRole.VIEWER &&
        !g.hidePrices,
    ),
  );
}

/**
 * ⭐ №168: скоуп «рабочих» объектов — отозванные доступы не считаются.
 * Списки читают через buildAccessScope (замороженный объект остаётся видимым),
 * а KPI/аналитика — через этот хелпер: отозванный участник в цифрах не участвует.
 * ⭐ №169: личный архив тоже исключается — «убрал в архив» = убрал из расчётов.
 */
export function buildWorkScope(grants: AccessGrant[]): AccessScope {
  return buildAccessScope(grants.filter((g) => !g.revokedAt && !g.isHidden));
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

const NO_ACCESS: RoleResolution = {
  role: null,
  hidePrices: false,
  hasObjectAccess: false,
  isManager: false,
  revoked: false,
  canWrite: false,
  canManage: false,
};

/** Сильнейшая запись из набора (CUSTOMER > FOREMAN > VIEWER) */
function strongest(grants: AccessGrant[]): AccessGrant {
  return grants.reduce((a, b) =>
    ROLE_PRIORITY[b.role] > ROLE_PRIORITY[a.role] ? b : a,
  );
}

/** ⭐ №168: собрать итоговые права из записи-источника и всего набора */
function makeResolution(
  source: AccessGrant,
  own: AccessGrant[],
  hasObjectAccess: boolean,
  revoked: boolean,
): RoleResolution {
  const role = source.role;
  return {
    role,
    // Отозванный доступ = «снимок»: живые цены нигде не показываем,
    // цифры он видит в собственных шаблонах-копиях.
    hidePrices:
      revoked ||
      role === AccessRole.VIEWER ||
      source.hidePrices ||
      own.some((g) => g.hidePrices),
    hasObjectAccess,
    isManager: !!source.isManager,
    revoked,
    canWrite: !revoked && role !== AccessRole.VIEWER,
    canManage:
      !revoked &&
      (role === AccessRole.CUSTOMER ||
        (role === AccessRole.FOREMAN && !!source.isManager)),
  };
}

/**
 * ⭐ №164: роль пользователя на конкретном проекте.
 * Объектная запись (projectId=null) важнее проектной — та же семантика, что в resolveObjectRole.
 */
export function resolveProjectRole(
  grants: AccessGrant[],
  objectId: number,
  projectId: number,
): AccessRole | null {
  return resolveProjectAccess(grants, objectId, projectId).role;
}

/**
 * ⭐ №168: полные права на проект — роль, отзыв, право записи и управления.
 * Нужны шаблонам смет: сохранить копию может любой читатель (включая отозванного),
 * а применять её в чужой проект — только тот, кто в нём может писать.
 */
export function resolveProjectAccess(
  grants: AccessGrant[],
  objectId: number,
  projectId: number,
): RoleResolution {
  const own = grants.filter(
    (g) =>
      g.objectId === objectId &&
      (g.projectId == null || g.projectId === projectId),
  );
  if (own.length === 0) return NO_ACCESS;
  const full = own.find((g) => g.projectId == null);
  if (full) {
    return makeResolution(full, own, true, !!full.revokedAt);
  }
  const source = strongest(own);
  return makeResolution(
    source,
    own,
    false,
    own.every((g) => !!g.revokedAt),
  );
}

/**
 * Роль пользователя на уровне объекта.
 * Объектная запись (projectId=null) важнее проектных: она и определяет права
 * на сам объект (редактирование, создание проектов, управление командой).
 */
export function resolveObjectRole(
  grants: AccessGrant[],
  objectId: number,
): RoleResolution {
  const own = grants.filter((g) => g.objectId === objectId);
  if (own.length === 0) return NO_ACCESS;
  const full = own.find((g) => g.projectId == null);
  if (full) {
    return makeResolution(full, own, true, !!full.revokedAt);
  }
  // Только проектные записи: берём самую сильную роль, цены скрываем,
  // если их прячет любая из записей.
  const source = strongest(own);
  return makeResolution(
    source,
    own,
    false,
    own.every((g) => !!g.revokedAt),
  );
}

