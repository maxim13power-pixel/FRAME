// backend/src/auth/demo-object-template.spec.ts
// ⭐ №288: названия демо-сметы обязаны совпадать с образцом цен.
// Если позицию в датасете переименуют/удалят, демо останется без цены («прочерки» в смете).
import { DEMO_PROJECT_TEMPLATES, demoNameKey } from './demo-object-template';
import { MATERIAL_CATALOG, WORK_CATALOG } from '../../prisma/price-seed';

const keysOf = (catalog: typeof WORK_CATALOG | typeof MATERIAL_CATALOG) =>
  new Set(
    Object.values(catalog)
      .flat()
      .map(([name]) => demoNameKey(name)),
  );

const workKeys = keysOf(WORK_CATALOG);
const materialKeys = keysOf(MATERIAL_CATALOG);
const rows = DEMO_PROJECT_TEMPLATES.flatMap((p) => p.materials);

describe('демо-смета (№288)', () => {
  it('у демо-объекта три проекта и 11 позиций', () => {
    expect(DEMO_PROJECT_TEMPLATES).toHaveLength(3);
    expect(rows).toHaveLength(11);
  });

  it('каждая работа есть в образце цен', () => {
    const missing = rows
      .filter((r) => !workKeys.has(demoNameKey(r.name)))
      .map((r) => r.name);
    expect(missing).toEqual([]);
  });

  it('каждый материал есть в образце цен', () => {
    const missing = rows
      .filter((r) => r.matItem && !materialKeys.has(demoNameKey(r.matItem)))
      .map((r) => r.matItem);
    expect(missing).toEqual([]);
  });

  it('у каждой позиции есть резервная цена — прочерков в демо быть не должно', () => {
    for (const r of rows) {
      expect(r.workPrice).toBeGreaterThan(0);
      if (r.matItem) expect(r.matPrice ?? 0).toBeGreaterThan(0);
    }
  });

  it('факт не превышает план', () => {
    for (const r of rows) expect(r.used).toBeLessThanOrEqual(r.spec);
  });

  it('ключ сравнения прощает «3×1.5»/«3х1.5» и «25мм»/«25 мм»', () => {
    expect(demoNameKey('Кабель ВВГнг-LS 3×1.5')).toBe(demoNameKey('Кабель ВВГнг-LS 3х1.5'));
    expect(demoNameKey('Труба полипропилен PN20 25мм')).toBe(
      demoNameKey('Труба полипропилен PN20 25 мм'),
    );
    expect(demoNameKey('Шпаклёвка стен')).toBe(demoNameKey('Шпаклевка  стен'));
  });
});
