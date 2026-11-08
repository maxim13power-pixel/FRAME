// backend/src/dashboard/dashboard.metrics.spec.ts
// ⭐ №225 (§71, №118): объём и деньги — разные сущности.
// Пороги бейджа «объём перевыполнен на N %»: 0.99 / 1.0 / 1.86.
import { buildMoneyMetrics, buildVolumeMetrics, normalizeNoPriceLimit } from './dashboard.metrics';

describe('buildVolumeMetrics — бейдж «объём перевыполнен на N %»', () => {
  it('0.99 (не выполнили план) — процента перевыполнения нет', () => {
    const v = buildVolumeMetrics(99, 100);
    expect(v.percent).toBeCloseTo(0.99, 10);
    expect(v.overrunPercent).toBeNull();
  });

  it('1.0 (ровно план) — бейджа нет', () => {
    const v = buildVolumeMetrics(100, 100);
    expect(v.percent).toBe(1);
    expect(v.overrunPercent).toBeNull();
  });

  it('1.86 — «перевыполнен на 86 %»', () => {
    const v = buildVolumeMetrics(186, 100);
    expect(v.percent).toBeCloseTo(1.86, 10);
    expect(v.overrunPercent).toBe(86);
  });

  it('864 % (тот самый №118) — перевыполнение 764 %, а не «перерасход»', () => {
    const v = buildVolumeMetrics(864, 100);
    expect(v.overrunPercent).toBe(764);
  });

  it('перевыполнение меньше 0,5 % округляется в 0 — бейджа нет', () => {
    const v = buildVolumeMetrics(100.4, 100);
    expect(v.percent).toBeCloseTo(1.004, 10);
    expect(v.overrunPercent).toBeNull();
  });

  it('пустая спецификация — нули, без Infinity/NaN', () => {
    const v = buildVolumeMetrics(50, 0);
    expect(v.percent).toBe(0);
    expect(v.overrunPercent).toBeNull();
    expect(Number.isFinite(v.percent)).toBe(true);
  });

  it('мусор на входе не даёт NaN', () => {
    const v = buildVolumeMetrics(NaN, 100);
    expect(v.used).toBe(0);
    expect(v.percent).toBe(0);
  });
});

describe('normalizeNoPriceLimit — лимит списка «без расценки»', () => {
  it('мусор и границы', () => {
    expect(normalizeNoPriceLimit(NaN)).toBe(5);
    expect(normalizeNoPriceLimit(0)).toBe(1);
    expect(normalizeNoPriceLimit(-3)).toBe(1);
    expect(normalizeNoPriceLimit(500)).toBe(200);
    expect(normalizeNoPriceLimit(7.9)).toBe(7);
    expect(normalizeNoPriceLimit(12)).toBe(12);
  });
});

describe('buildMoneyMetrics — деньги отдельно от объёмов', () => {
  it('факт больше сметы: сумма и процент перерасхода', () => {
    const m = buildMoneyMetrics(1000, 1200);
    expect(m.overBudget).toBe(true);
    expect(m.difference).toBe(200);
    expect(m.percentOfEstimate).toBe(120);
    expect(m.overPercent).toBe(20);
  });

  it('факт в пределах сметы — перерасхода нет', () => {
    const m = buildMoneyMetrics(1000, 950);
    expect(m.overBudget).toBe(false);
    expect(m.difference).toBe(-50);
    expect(m.percentOfEstimate).toBe(95);
    expect(m.overPercent).toBeNull();
  });

  it('факт равен смете — не перерасход', () => {
    const m = buildMoneyMetrics(1000, 1000);
    expect(m.overBudget).toBe(false);
    expect(m.overPercent).toBeNull();
  });

  it('смета = 0 при факте > 0: перерасход есть, процентов нет (никакого Infinity/NaN)', () => {
    const m = buildMoneyMetrics(0, 500);
    expect(m.overBudget).toBe(true);
    expect(m.difference).toBe(500);
    expect(m.percentOfEstimate).toBeNull();
    expect(m.overPercent).toBeNull();
  });

  it('смета = 0 и факт = 0 — всё нулевое и конечное', () => {
    const m = buildMoneyMetrics(0, 0);
    expect(m.overBudget).toBe(false);
    expect(m.overPercent).toBeNull();
    expect(Number.isFinite(m.percentOfEstimate ?? 0)).toBe(true);
  });

  it('копейки округляются до 2 знаков, процент — до 1', () => {
    const m = buildMoneyMetrics(1000, 1234.567);
    expect(m.actual).toBe(1234.57);
    expect(m.difference).toBe(234.57);
    expect(m.overPercent).toBe(23.5);
  });

  it('отрицательная смета (битые данные) не даёт деления на отрицательное', () => {
    const m = buildMoneyMetrics(-100, 50);
    expect(Number.isFinite(m.actual)).toBe(true);
    // percentOfEstimate считается только при смете > 0
    expect(m.percentOfEstimate).toBeNull();
  });
});
