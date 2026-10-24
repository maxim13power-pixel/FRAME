// backend/src/auth/access-scope.spec.ts
// ⭐ №163: правила видимости по проектам — без БД, чистые функции.
import { AccessRole } from '@prisma/client';
import {
  AccessGrant,
  accessibleObjectWhere,
  accessibleProjectWhere,
  buildAccessScope,
  buildMoneyScope,
  isScopeEmpty,
  resolveObjectRole,
} from './access-scope';

const grant = (
  objectId: number,
  projectId: number | null,
  role: AccessRole = AccessRole.FOREMAN,
  hidePrices = false,
): AccessGrant => ({ objectId, projectId, role, hidePrices });

describe('access-scope (№163)', () => {
  describe('buildAccessScope', () => {
    it('делит записи на объектные и проектные без дублей', () => {
      const scope = buildAccessScope([
        grant(1, null),
        grant(1, null), // дубль объектной записи
        grant(1, 10),
        grant(1, 11),
        grant(2, 20),
      ]);
      expect(scope.fullObjectIds).toEqual([1]);
      expect(scope.projectIds.sort((a, b) => a - b)).toEqual([10, 11, 20]);
      expect(scope.objectIds.sort((a, b) => a - b)).toEqual([1, 2]);
      expect(isScopeEmpty(scope)).toBe(false);
    });

    it('пустой список записей → пустой скоуп', () => {
      const scope = buildAccessScope([]);
      expect(scope.fullObjectIds).toEqual([]);
      expect(scope.projectIds).toEqual([]);
      expect(isScopeEmpty(scope)).toBe(true);
    });
  });

  describe('buildMoneyScope', () => {
    it('выкидывает VIEWER и записи с hidePrices', () => {
      const scope = buildMoneyScope([
        grant(1, null, AccessRole.VIEWER),
        grant(1, 10, AccessRole.FOREMAN, true),
        grant(2, null, AccessRole.CUSTOMER),
        grant(2, 20, AccessRole.FOREMAN),
      ]);
      expect(scope.fullObjectIds).toEqual([2]);
      expect(scope.projectIds).toEqual([20]);
    });
  });

  describe('accessibleProjectWhere', () => {
    it('пустой скоуп → заведомо пустой результат', () => {
      expect(accessibleProjectWhere(buildAccessScope([]))).toEqual({ id: -1 });
    });

    it('объектный доступ открывает все проекты, проектный — только свои', () => {
      const where = accessibleProjectWhere(
        buildAccessScope([grant(1, null), grant(2, 20)]),
      );
      expect(where).toEqual({
        AND: [{ object: { isArchived: false } }, { OR: [{ objectId: { in: [1] } }, { id: { in: [20] } }] }],
      });
    });

    it('includeArchived убирает фильтр архива (страница «Архив»)', () => {
      const where = accessibleProjectWhere(buildAccessScope([grant(1, null)]), {
        includeArchived: true,
      });
      expect(where).toEqual({ AND: [{ OR: [{ objectId: { in: [1] } }] }] });
    });
  });

  describe('accessibleObjectWhere', () => {
    it('участник проекта видит объект через projects.some', () => {
      const where = accessibleObjectWhere(buildAccessScope([grant(2, 20)]));
      expect(where).toEqual({
        isArchived: false,
        OR: [{ projects: { some: { id: { in: [20] } } } }],
      });
    });

    it('пустой скоуп → id: -1', () => {
      expect(accessibleObjectWhere(buildAccessScope([]))).toEqual({ id: -1 });
    });
  });

  describe('resolveObjectRole', () => {
    it('объектная запись важнее проектных (права на сам объект)', () => {
      const my = resolveObjectRole(
        [grant(1, null, AccessRole.CUSTOMER), grant(1, 10, AccessRole.VIEWER)],
        1,
      );
      expect(my).toEqual({ role: 'CUSTOMER', hidePrices: false, hasObjectAccess: true });
    });

    it('только проектные записи → сильнейшая роль, без прав на объект', () => {
      const my = resolveObjectRole(
        [grant(1, 10, AccessRole.FOREMAN), grant(1, 11, AccessRole.CUSTOMER)],
        1,
      );
      expect(my.role).toBe('CUSTOMER');
      expect(my.hasObjectAccess).toBe(false);
    });

    it('цены скрыты, если их прячет любая проектная запись', () => {
      const my = resolveObjectRole(
        [grant(1, 10, AccessRole.FOREMAN), grant(1, 11, AccessRole.FOREMAN, true)],
        1,
      );
      expect(my.hidePrices).toBe(true);
    });

    it('нет доступа к объекту → role=null', () => {
      const my = resolveObjectRole([grant(2, 20)], 1);
      expect(my).toEqual({ role: null, hidePrices: false, hasObjectAccess: false });
    });
  });
});
