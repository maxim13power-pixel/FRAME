// backend/src/auth/access-scope.ts
// ⭐ №163: единая логика «что видит пользователь».
// Семантика ObjectAccess:
//   projectId = null → доступ на ВЕСЬ объект (все проекты, включая созданные позже);
//   projectId = X    → доступ только к проекту X (остальные проекты объекта не видны).
// Все списки/дашборд/аналитика строят where через эти хелперы, чтобы правила
// доступа не расползались по сервисам.
import { ForbiddenException } from '@nestjs/common';
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

/**
 * ⭐ №193 (A₂ F1): в скоуп попадают только АКТИВНЫЕ записи доступа.
 * Отозванный доступ живых данных не открывает: снимок «как на момент отзыва»
 * лежит в личных шаблонах (его отдаёт /estimate-templates), поэтому объект
 * исчезает из списков, а не показывается «на чтение».
 */
export function buildAccessScope(grants: AccessGrant[]): AccessScope {
  const full = new Set<number>();
  const projects = new Set<number>();
  const objects = new Set<number>();
  for (const g of grants) {
    if (g.revokedAt) continue;
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

/** Только те записи, где пользователь видит цены (не VIEWER, hidePrices=false).
 * Отозванные записи отсекает buildAccessScope (№193). */
export function buildMoneyScope(grants: AccessGrant[]): AccessScope {
  return buildAccessScope(
    grants.filter(
      // ⭐ №169: объект из личного архива в деньгах/KPI не участвует
      (g) => !g.isHidden && g.role !== AccessRole.VIEWER && !g.hidePrices,
    ),
  );
}

/**
 * ⭐ №168/№169: скоуп «рабочих» объектов — личный архив не считается.
 * KPI/аналитика/деньги строят where через этот хелпер, чтобы «убрал в архив» =
 * «убрал из расчётов». Отозванные записи выкидывает сам buildAccessScope (№193).
 */
export function buildWorkScope(grants: AccessGrant[]): AccessScope {
  return buildAccessScope(grants.filter((g) => !g.isHidden));
}

/** ⭐ №193 (A₂ F1): единый текст 403 для отозванного доступа.
 * Фронт (services/api.ts) ловит подстроку «Доступ отозван» и показывает модалку. */
export const REVOKED_ACCESS_MESSAGE =
  'Доступ отозван: живые данные закрыты. Копия сметы и справочника цен сохранена в ваших шаблонах.';

/** ⭐ №193: кидает 403, если запись доступа отозвана (живого чтения больше нет). */
export function assertAccessActive(
  access: { revokedAt?: Date | null } | null | undefined,
): void {
  if (access?.revokedAt) {
    throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
  }
}

/**
 * ⭐ №193 (A₂ F1 + A#7): запись доступа с приоритетом АКТИВНОЙ.
 * Раньше findFirst без orderBy мог вернуть отозванную запись при наличии
 * действующей (ложный 403 или «доступ отозван» у живого участника).
 * Возвращает активную запись, если она есть, иначе отозванную — чтобы
 * вызывающий отдал точный 403, а не «нет доступа».
 */
export async function findLiveAccess(
  prisma: PrismaService,
  where: Prisma.ObjectAccessWhereInput,
) {
  const active = await prisma.objectAccess.findFirst({
    where: { ...where, revokedAt: null },
    orderBy: { id: 'asc' },
  });
  if (active) return active;
  return prisma.objectAccess.findFirst({ where, orderBy: { id: 'asc' } });
}

/**
 * ⭐ №193: доступ к проекту — проектная запись приоритетнее объектной,
 * активная приоритетнее отозванной. Один запрос на оба уровня.
 */
export async function findProjectAccess(
  prisma: PrismaService,
  userId: number,
  objectId: number,
  projectId: number,
) {
  const rows = await prisma.objectAccess.findMany({
    where: { userId, objectId, OR: [{ projectId }, { projectId: null }] },
    orderBy: { id: 'asc' },
  });
  const live = rows.filter((r) => !r.revokedAt);
  return (
    live.find((r) => r.projectId === projectId) ??
    live.find((r) => r.projectId === null) ??
    rows.find((r) => r.projectId === projectId) ??
    rows[0] ??
    null
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

/** ⭐ №203 (F12): видит ли пользователь деньги по набору грантов.
 * ПРАВИЛО (единое для JS и SQL): грамоты аддитивны — если в наборе есть хотя бы один
 * активный грант без hidePrices и не VIEWER, деньги видны. Скрывает только полное
 * отсутствие «видимого» гранта (все гранты скрывают цены, либо все отозваны).
 * SQL в analytics/dashboard использует EXISTS(... hidePrices=false AND role<>'VIEWER'),
 * т.е. ровно это же условие. */
export function canSeeMoney(grants: AccessGrant[]): boolean {
  return grants.some(
    (g) => !g.revokedAt && !g.hidePrices && g.role !== AccessRole.VIEWER,
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
    // ⭐ №193/№203 (F12): отозванный доступ и отсутствие «видимого» гранта скрывают цены.
    // Раньше здесь было «любой hidePrices скрывает всё», а SQL считал наоборот —
    // один и тот же пользователь получал 0 в списке и сумму в аналитике.
    hidePrices: revoked || !canSeeMoney(own),
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
  // ⭐ №193 (A₂ F1): активная запись важнее отозванной — иначе отозванная
  // объектная закрывала бы живой доступ к проекту (ложный 403).
  const full = own.find((g) => g.projectId == null && !g.revokedAt);
  if (full) {
    return makeResolution(full, own, true, false);
  }
  const live = own.filter((g) => !g.revokedAt);
  if (live.length > 0) {
    return makeResolution(strongest(live), own, false, false);
  }
  // живых записей нет — доступ отозван целиком
  const fullRevoked = own.some((g) => g.projectId == null);
  return makeResolution(strongest(own), own, fullRevoked, true);
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
  // ⭐ №193 (A₂ F1): активная запись важнее отозванной (см. resolveProjectAccess).
  const full = own.find((g) => g.projectId == null && !g.revokedAt);
  if (full) {
    return makeResolution(full, own, true, false);
  }
  // Только проектные активные записи: берём самую сильную роль, цены скрываем,
  // если их прячет любая из записей.
  const live = own.filter((g) => !g.revokedAt);
  if (live.length > 0) {
    return makeResolution(strongest(live), own, false, false);
  }
  const fullRevoked = own.some((g) => g.projectId == null);
  return makeResolution(strongest(own), own, fullRevoked, true);
}

