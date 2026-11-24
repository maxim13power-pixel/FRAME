// ⭐ №381: макет PDF — цены скрываются ещё до рендера, проверяем docDefinition.
import { buildReportDocDefinition } from './pdf.service';

const report = {
  type: 'estimate',
  title: 'Смета',
  status: 'draft',
  totalAmount: 0,
  createdAt: new Date('2026-11-24T00:00:00.000Z'),
  object: { name: 'Объект' },
  project: { name: 'Проект' },
};

describe('ReportPdfService — макет отчёта (№381)', () => {
  it('скрытые цены не попадают в макет', () => {
    const def = buildReportDocDefinition(report, [
      { name: 'Бетон', unit: 'м³', quantity: 2, price: 0, total: 0 },
    ]);
    const json = JSON.stringify(def);

    expect(json).toContain('Бетон');
    expect(json).toContain('Итого');
    expect(json).not.toMatch(/12\s?345/);
  });

  it('открытые цены попадают в макет', () => {
    const def = buildReportDocDefinition(report, [
      { name: 'Бетон', unit: 'м³', quantity: 2, price: 12345, total: 24690 },
    ]);
    const json = JSON.stringify(def);

    // ru-RU разделяет разряды неразрывным пробелом — \s его покрывает
    expect(json).toMatch(/12\s?345/);
    expect(json).toMatch(/24\s?690/);
  });
});
