// backend/src/auth/access-scope.spec.ts
// ⭐ №163: правила видимости по проектам — без БД, чистые функции.
import { AccessRole } from '@prisma/client';
import {
  AccessGrant,
  accessibleObjectWhere,
  accessibleProjectWhere,
  assertAccessActive,
  buildAccessScope,
  buildMoneyScope,
  buildWorkScope,
  isScopeEmpty,
  REVOKED_ACCESS_MESSAGE,
  resolveObjectRole,
  resolveProjectAccess,
  resolveProjectRole,
} from './access-scope';

const grant = (
  objectId: number,
  projectId: number | null,
  role: AccessRole = AccessRole.FOREMAN,
  hidePrices = false,
  extra: Partial<AccessGrant> = {},
): AccessGrant => ({ objectId, projectId, role, hidePrices, ...extra });

/** Права «нет доступа» — эталон для сравнения */
const NO_ACCESS = {
  role: null,
  hidePrices: false,
  hasObjectAccess: false,
  isManager: false,
  revoked: false,
  canWrite: false,
  canManage: false,
};

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

    // ⭐ №193 (A₂ F1): отозванный доступ живых данных не открывает
    it('отозванные записи в скоуп не попадают', () => {
      const scope = buildAccessScope([
        grant(1, null, AccessRole.CUSTOMER, false, { revokedAt: new Date() }),
        grant(2, 20),
      ]);
      expect(scope.fullObjectIds).toEqual([]);
      expect(scope.projectIds).toEqual([20]);
      expect(scope.objectIds).toEqual([2]);
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
      expect(my).toEqual({
        role: 'CUSTOMER',
        hidePrices: false,
        hasObjectAccess: true,
        isManager: false,
        revoked: false,
        canWrite: true,
        canManage: true,
      });
    });

    it('только проектные записи → сильнейшая роль, без прав на объект', () => {
      const my = resolveObjectRole(
        [grant(1, 10, AccessRole.FOREMAN), grant(1, 11, AccessRole.CUSTOMER)],
        1,
      );
      expect(my.role).toBe('CUSTOMER');
      expect(my.hasObjectAccess).toBe(false);
    });

    // ⭐ №203 (F12): правило аддитивное — деньги видны, если есть ХОТЯ БЫ ОДИН видимый грант.
    // Это же условие считает SQL аналитики/дашборда (EXISTS ... hidePrices=false AND role<>VIEWER).
    it('цены видны, если хотя бы один грант не скрывает их (аддитивное правило)', () => {
      const my = resolveObjectRole(
        [grant(1, 10, AccessRole.FOREMAN), grant(1, 11, AccessRole.FOREMAN, true)],
        1,
      );
      expect(my.hidePrices).toBe(false);
    });

    it('цены скрыты, если ВСЕ гранты скрывают их или это наблюдатель', () => {
      expect(
        resolveObjectRole([grant(1, 10, AccessRole.FOREMAN, true)], 1).hidePrices,
      ).toBe(true);
      expect(
        resolveObjectRole([grant(1, 11, AccessRole.VIEWER, false)], 1).hidePrices,
      ).toBe(true);
    });

    it('нет доступа к объекту → role=null', () => {
      const my = resolveObjectRole([grant(2, 20)], 1);
      expect(my).toEqual(NO_ACCESS);
    });

    // ⭐ №168: мягкий отзыв = только чтение, живые цены скрыты (снимок в шаблонах)
    it('отозванный доступ → read-only и без живых цен', () => {
      const my = resolveObjectRole(
        [
          grant(1, null, AccessRole.FOREMAN, false, {
            revokedAt: new Date('2026-11-01'),
          }),
        ],
        1,
      );
      expect(my.role).toBe('FOREMAN');
      expect(my.revoked).toBe(true);
      expect(my.canWrite).toBe(false);
      expect(my.canManage).toBe(false);
      expect(my.hidePrices).toBe(true);
      expect(my.hasObjectAccess).toBe(true);
    });

    // ⭐ №193: отозванная ОБЪЕКТНАЯ запись не перекрывает живую ПРОЕКТНУЮ
    it('активная проектная запись важнее отозванной объектной', () => {
      const my = resolveObjectRole(
        [
          grant(1, null, AccessRole.CUSTOMER, false, { revokedAt: new Date() }),
          grant(1, 10, AccessRole.FOREMAN),
        ],
        1,
      );
      expect(my.revoked).toBe(false);
      expect(my.role).toBe('FOREMAN');
      expect(my.hasObjectAccess).toBe(false);
      expect(my.canWrite).toBe(true);
    });

    // ⭐ №168: управлять командой может администратор объекта и прораб-менеджер
    it('прораб с isManager управляет командой, обычный — нет', () => {
      const manager = resolveObjectRole(
        [grant(1, null, AccessRole.FOREMAN, false, { isManager: true })],
        1,
      );
      const worker = resolveObjectRole([grant(1, null, AccessRole.FOREMAN)], 1);
      expect(manager.canManage).toBe(true);
      expect(worker.canManage).toBe(false);
      expect(worker.canWrite).toBe(true);
    });

    it('наблюдатель никогда не управляет и не пишет', () => {
      const my = resolveObjectRole(
        [grant(1, null, AccessRole.VIEWER, false, { isManager: true })],
        1,
      );
      expect(my.canManage).toBe(false);
      expect(my.canWrite).toBe(false);
      expect(my.hidePrices).toBe(true);
    });
  });

  // ⭐ №168: шаблоны смет — копию сохраняет любой читатель, применяет только пишущий
  describe('resolveProjectAccess / resolveProjectRole', () => {
    it('роль проекта с фолбэком на объектную запись', () => {
      expect(
        resolveProjectRole([grant(1, null, AccessRole.CUSTOMER)], 1, 10),
      ).toBe('CUSTOMER');
      expect(resolveProjectRole([grant(1, 11, AccessRole.VIEWER)], 1, 10)).toBe(
        null,
      );
    });

    it('отозванная запись проекта: revoked, без права записи (№193)', () => {
      const my = resolveProjectAccess(
        [grant(1, 10, AccessRole.FOREMAN, false, { revokedAt: new Date() })],
        1,
        10,
      );
      expect(my.role).toBe('FOREMAN');
      expect(my.revoked).toBe(true);
      expect(my.canWrite).toBe(false);
    });

    // ⭐ №203 (F12): скрытый объектный грант не гасит видимый проектный (аддитивное правило)
    it('F12: объектный грант с hidePrices + видимый проектный ⇒ деньги по проекту видны', () => {
      const my = resolveProjectAccess(
        [
          grant(1, null, AccessRole.CUSTOMER, true),
          grant(1, 10, AccessRole.FOREMAN, false),
        ],
        1,
        10,
      );
      expect(my.hidePrices).toBe(false);
    });

    // ⭐ №193 (A₂ F1): отозванная объектная не должна гасить живой проектный доступ
    it('проектная запись активна, объектная отозвана → доступ жив', () => {
      const my = resolveProjectAccess(
        [
          grant(1, null, AccessRole.CUSTOMER, false, { revokedAt: new Date() }),
          grant(1, 10, AccessRole.FOREMAN),
        ],
        1,
        10,
      );
      expect(my.revoked).toBe(false);
      expect(my.role).toBe('FOREMAN');
      expect(my.canWrite).toBe(true);
      expect(my.hasObjectAccess).toBe(false);
    });

    // ⭐ №193 (A₂ F1): 403 отозванному — единый текст для guard и сервисов
    it('assertAccessActive кидает 403 на отозванную запись и молчит на активную', () => {
      expect(() => assertAccessActive({ revokedAt: new Date() })).toThrow(
        REVOKED_ACCESS_MESSAGE,
      );
      expect(() => assertAccessActive({ revokedAt: null })).not.toThrow();
      expect(() => assertAccessActive(null)).not.toThrow();
    });

    it('наблюдатель может сохранить копию, но не применить её в проект', () => {
      const my = resolveProjectAccess(
        [grant(1, null, AccessRole.VIEWER)],
        1,
        10,
      );
      expect(my.role).toBe('VIEWER');
      expect(my.canWrite).toBe(false);
    });
  });

  // ⭐ №168/№193: отозванные доступы выпадают из списков и из KPI
  describe('buildWorkScope', () => {
    it('выкидывает отозванные записи вместе со списками (№193)', () => {
      const grants = [
        grant(1, null, AccessRole.CUSTOMER, false, { revokedAt: new Date() }),
        grant(2, 20, AccessRole.FOREMAN),
      ];
      expect(buildAccessScope(grants).objectIds).toEqual([2]);
      expect(buildWorkScope(grants).objectIds).toEqual([2]);
      expect(buildMoneyScope(grants).projectIds).toEqual([20]);
    });

    // ⭐ №169: личный архив убирает объект из KPI/аналитики, но не из списков
    it('выкидывает объекты из личного архива только из рабочих скоупов', () => {
      const grants = [
        grant(1, null, AccessRole.CUSTOMER, false, { isHidden: true }),
        grant(2, 20, AccessRole.FOREMAN),
      ];
      // списки видят всё (вкладка «Архив» в Объектах)
      expect(buildAccessScope(grants).objectIds.sort()).toEqual([1, 2]);
      // KPI/деньги/аналитика — без архивного объекта
      expect(buildWorkScope(grants).objectIds).toEqual([2]);
      expect(buildMoneyScope(grants).objectIds).toEqual([2]);
      expect(buildMoneyScope(grants).fullObjectIds).toEqual([]);
    });
  });

});
