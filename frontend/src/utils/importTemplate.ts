// frontend/src/utils/importTemplate.ts
// ⭐ №208 (решение владельца): «Скачать шаблон» — ПУСТОЙ документ в нашем формате.
// Юзер заполняет его на своём ПК (материалы, работы, количества, цены) и импортирует
// в проект: позиции попадают в смету, а цены — в НОВЫЙ справочник цен FRAME.
import * as XLSX from 'xlsx-js-style';
import { makeSheet, type ColKind } from './xlsxStyle';

const HEADERS: { top: string; kind: ColKind }[] = [
  { top: 'Наименование', kind: 'text' },
  { top: 'Артикул', kind: 'center' },
  { top: 'Ед. изм.', kind: 'center' },
  { top: 'Количество', kind: 'qty' },
  { top: 'Цена', kind: 'money' },
  { top: 'Примечание', kind: 'text' },
];

/** Пустых строк в шаблоне — с запасом, лишние просто не попадут в импорт */
const EMPTY_ROWS = 120;

const TEMPLATE_HINT = [
  'Как заполнять шаблон FRAME',
  '',
  '1. Заполняйте лист «Смета»: Наименование, Ед. изм., Количество, Цена.',
  '2. Единицы: м, м2, м3, шт, кг, т, пог. м, компл, л, уп — можно писать словами.',
  '3. Цена — за единицу, в рублях. Если цены нет, оставьте пусто: позиция загрузится с 0 и будет помечена «без цены».',
  '4. Строки «Итого», «Всего», «НДС» можно оставлять — они пропускаются при импорте.',
  '5. Пустые строки игнорируются, лишние можно не удалять.',
  '6. Цены из файла сохраняются в НОВЫЙ справочник цен — ваши существующие справочники не меняются.',
  '7. Файл не переименовывайте в .xls — нужен .xlsx.',
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
  });
  sheet['!cols'] = [
    { wch: 46 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, 'Смета');

  const hint = XLSX.utils.aoa_to_sheet(TEMPLATE_HINT.map((line) => [line]));
  hint['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, hint, 'Как заполнять');

  // Скрытый служебный лист: по нему импорт узнаёт наш шаблон (projectId нет — это не выгрузка)
  const meta = XLSX.utils.aoa_to_sheet([
    ['frameExport', 0],
    ['templateVersion', 1],
    ['columnsVersion', 1],
    ['generatedAt', new Date().toISOString()],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, '_meta');
  wb.Workbook = {
    Sheets: wb.SheetNames.map((name) => ({ name, Hidden: name === '_meta' ? 1 : 0 })),
  };

  XLSX.writeFile(wb, 'Шаблон сметы FRAME.xlsx', { cellStyles: true });
};
