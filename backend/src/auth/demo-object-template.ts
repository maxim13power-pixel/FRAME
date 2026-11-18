// backend/src/auth/demo-object-template.ts
// ⭐ №288: смета демо-объекта вынесена отдельным модулем (без Nest-зависимостей),
// чтобы её можно было сверять тестом с образцом цен `prisma/price-seed.ts`.
// Причина: названия демо-позиций разошлись с датасетом → в демо-смете были прочерки
// вместо денег («непрофессионально»).
import { Unit } from '@prisma/client';

/** Строка демо-сметы. Единицы и количества — только для демонстрации. */
export interface DemoEstimateRow {
  name: string;
  unit: Unit;
  spec: number;
  used: number;
  /** расценка материала в демо-справочнике (та же единица измерения) */
  matItem?: string;
  /**
   * ⭐ №318: норма расхода материала на 1 единицу строки (в единицах упаковки).
   * Пример: «Покраска стен» в м², краска 9 л за 3200 ₽, расход 0.2 л/м²
   * → цена материала = 3200 / 9 × 0.2 ≈ 71.11 ₽/м².
   */
  consumption?: number;
  /**
   * Резервная цена, если позиции нет в справочнике (её переименовали/удалили).
   * Демо не должно показывать прочерки вместо денег — это выглядит как поломка.
   */
  workPrice: number;
  matPrice?: number;
}

/** Проект демо-объекта (3 штуки: подготовка → черновые → чистовые). */
export interface DemoProjectTemplate {
  name: string;
  /** дни назад, за которые бригада фиксировала объёмы (для «Посменной сводки») */
  shifts: number[];
  materials: DemoEstimateRow[];
}

/**
 * Ключ сравнения позиций со справочником.
 * Терпимее, чем точное совпадение: «3×1.5» = «3х1.5», «25мм» = «25 мм».
 */
export const demoNameKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[×x]/g, 'х')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, '')
    .trim();

/**
 * Смета демо-объекта. Названия работ/материалов обязаны совпадать с образцом цен
 * (`prisma/price-seed.ts`) — это проверяет `demo-object-template.spec.ts`.
 */
export const DEMO_PROJECT_TEMPLATES: DemoProjectTemplate[] = [
  {
    name: 'Демонтаж и подготовка',
    shifts: [11, 4],
    materials: [
      { name: 'Демонтаж штукатурки', unit: Unit.SQUARE_METER, spec: 68, used: 68, workPrice: 220 },
      // ⭐ №318: грунтовка продаётся упаковкой 10 л — цена считается по расходу
      {
        name: 'Грунтовка стен',
        unit: Unit.SQUARE_METER,
        spec: 180,
        used: 120,
        matItem: 'Грунтовка для стен (10 л)',
        consumption: 0.1,
        workPrice: 70,
        matPrice: 7.5,
      },
      { name: 'Демонтаж обоев', unit: Unit.SQUARE_METER, spec: 40, used: 0, workPrice: 90 },
    ],
  },
  {
    name: 'Черновые работы',
    shifts: [8, 3],
    materials: [
      {
        name: 'Устройство полусухой стяжки',
        unit: Unit.SQUARE_METER,
        spec: 68,
        used: 68,
        matItem: 'Стяжка самовыравнивающаяся (25 кг)',
        consumption: 1.8,
        workPrice: 650,
        matPrice: 37.44,
      },
      {
        name: 'Шпаклёвка стен',
        unit: Unit.SQUARE_METER,
        spec: 120,
        used: 84,
        matItem: 'Шпаклёвка стартовая (20 кг)',
        consumption: 1.2,
        workPrice: 380,
        matPrice: 36,
      },
      {
        name: 'Прокладка кабеля в штробе',
        unit: Unit.METER,
        spec: 120,
        used: 60,
        matItem: 'Кабель ВВГнг-LS 3х1.5',
        workPrice: 120,
        matPrice: 45,
      },
      {
        name: 'Разводка труб водоснабжения',
        unit: Unit.METER,
        spec: 30,
        used: 12,
        matItem: 'Труба полипропилен PN20 25 мм',
        workPrice: 450,
        matPrice: 140,
      },
    ],
  },
  {
    name: 'Чистовая отделка',
    shifts: [2],
    materials: [
      {
        name: 'Укладка ламината',
        unit: Unit.SQUARE_METER,
        spec: 68,
        used: 0,
        matItem: 'Ламинат 32 класс (8 мм)',
        workPrice: 550,
        matPrice: 900,
      },
      {
        name: 'Укладка керамогранита на пол',
        unit: Unit.SQUARE_METER,
        spec: 18,
        used: 18,
        matItem: 'Керамогранит 600х600',
        workPrice: 1300,
        matPrice: 1500,
      },
      {
        name: 'Покраска стен',
        unit: Unit.SQUARE_METER,
        spec: 120,
        used: 24,
        // ⭐ №318: краска 9 л за 3200 ₽ и расход 0.2 л/м² → ≈ 71.11 ₽/м²
        matItem: 'Краска для стен моющаяся (9 л)',
        consumption: 0.2,
        workPrice: 280,
        matPrice: 71.11,
      },
      {
        // ⚠️ имя ровно как в демо-справочнике («встроенной», не «встроенная»)
        name: 'Установка розетки встроенной',
        unit: Unit.PIECE,
        spec: 24,
        used: 0,
        matItem: 'Розетка встроенная Legrand',
        workPrice: 350,
        matPrice: 420,
      },
    ],
  },
];
