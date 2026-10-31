// frontend/src/utils/importTemplate.ts
// ⭐ №208 (решение владельца): «Скачать шаблон» — ПУСТОЙ документ в нашем формате.
// Юзер заполняет его на своём ПК (материалы, работы, количества, цены) и импортирует
// в проект: позиции попадают в смету, а цены — в НОВЫЙ справочник цен FRAME.
import * as XLSX from 'xlsx-js-style';
import { makeSheet, downloadWorkbook, type ColKind } from './xlsxStyle';

const HEADERS: { top: string; kind: ColKind }[] = [
  { top: 'Наименование', kind: 'text' },
  { top: 'Артикул', kind: 'center' },
  { top: 'Ед. изм.', kind: 'center' },
  { top: 'Количество', kind: 'qty' },
  // ⭐ №211: две цены — работа и материал. Обе уходят в НОВЫЙ справочник цен.
  { top: 'Цена работ за ед.', kind: 'money' },
  { top: 'Цена материала за ед.', kind: 'money' },
  { top: 'Примечание', kind: 'text' },
];

/** Пустых строк в шаблоне — с запасом, лишние просто не попадут в импорт */
const EMPTY_ROWS = 120;

const TEMPLATE_HINT = [
  'Как заполнять шаблон FRAME',
  '',
  '1. Заполняйте лист «Смета»: Наименование, Ед. изм., Количество, две цены.',
  '2. «Цена работ за ед.» — сколько вы платите за единицу работы (м2 стяжки, м кабеля).',
  '3. «Цена материала за ед.» — сколько стоит единица материала. Можно заполнить только одну из цен.',
  '4. Единицы: м, м2, м3, шт, кг, т, пог. м, компл, л, уп — можно писать словами.',
  '5. Цена — за единицу, в рублях. Если цены нет, оставьте пусто: позиция загрузится с 0 и будет помечена «без цены».',
  '6. Строки «Итого», «Всего», «НДС» можно оставлять — они пропускаются при импорте.',
  '7. Пустые строки игнорируются, лишние можно не удалять.',
  '8. Цены из файла сохраняются в НОВЫЙ справочник цен: работы — расценки «работы», материалы — расценки «материалы». Ваши существующие справочники не меняются.',
  '9. Файл не переименовывайте в .xls — нужен .xlsx.',
  '',
  'Импорт: в проекте → «Сметы» → «Из шаблона» → «Импорт из Excel».',
];

/** Собрать и отдать на скачивание пустой шаблон сметы */
export const downloadImportTemplate = (): void => {
  const wb = XLSX.utils.book_new();

  const aoa: (string | number)[][] = [HEADERS.map((h) => h.top)];
  for (let i = 0; i < EMPTY_ROWS; i += 1) {
    aoa.push(HEADERS.map(() => ''));
  }
  const sheet = makeSheet({
    aoa,
    kinds: HEADERS.map((h) => h.kind),
    headerRows: [0],
    headerHeight: 30,
    // ⭐ №213: строки-«пустышки» повыше, но чуть ниже шапки — в них удобно писать руками
    bodyHeight: 24,
  });
  sheet['!cols'] = [
    { wch: 46 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 21 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, 'Смета');

  const hint = XLSX.utils.aoa_to_sheet(TEMPLATE_HINT.map((line) => [line]));
  hint['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, hint, 'Как заполнять');

  // Скрытый служебный лист: по нему импорт узнаёт наш шаблон (projectId нет — это не выгрузка)
  const meta = XLSX.utils.aoa_to_sheet([
    ['frameExport', 0],
    ['templateVersion', 2],
    ['columnsVersion', 2],
    ['generatedAt', new Date().toISOString()],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, '_meta');
  wb.Workbook = {
    Sheets: wb.SheetNames.map((name) => ({ name, Hidden: name === '_meta' ? 1 : 0 })),
  };

  // ⭐ №212: НЕ XLSX.writeFile — в браузере он упирается в fs и пишет битый файл
  downloadWorkbook(wb, 'Шаблон сметы FRAME.xlsx');
};
