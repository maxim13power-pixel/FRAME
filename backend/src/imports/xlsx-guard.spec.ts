// ⭐ №378: adversarial-проверки XLSX-лимитов — важен отказ ДО ExcelJS.load.
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  assertWorkbookSafe,
  assertZipSafe,
  readZipEntries,
  XLSX_LIMITS,
  XlsxLimitError,
} from './xlsx-guard';

const makeWorkbookXml = (sheets: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets>${sheets
    .map(
      (name, index) =>
        `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')}</sheets></workbook>`;

const makeSheetXml = (dimension: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/><sheetData/></worksheet>`;

const zipOf = async (files: Record<string, string | Buffer>) => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
};

describe('xlsx-guard — защита от XLSX-бомб (№378)', () => {
  it('обычная книга проходит проверку', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Смета');
    ws.addRow(['Наименование', 'Кол-во']);
    ws.addRow(['Бетон', 3]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await expect(assertWorkbookSafe(buffer)).resolves.toBeUndefined();
  });

  it('не ZIP → понятная ошибка', () => {
    expect(() => assertZipSafe(Buffer.from('not a zip'))).toThrow(XlsxLimitError);
  });

  it('zip-bomb по коэффициенту сжатия отклоняется', async () => {
    const bomb = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:C10'),
      // 4 МБ нулей сжимаются в единицы КБ → коэффициент выше лимита
      'xl/media/padding.bin': Buffer.alloc(4 * 1024 * 1024),
    });
    expect(() => assertZipSafe(bomb)).toThrow(/степень сжатия/i);
  });

  it('огромная размерность листа отклоняется до load', async () => {
    const buffer = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:XFD1048576'),
    });
    await expect(assertWorkbookSafe(buffer)).rejects.toThrow(/слишком большой/i);
  });

  it('слишком много листов отклоняется', async () => {
    const names = Array.from(
      { length: XLSX_LIMITS.maxSheets + 1 },
      (_, i) => `Лист${i + 1}`,
    );
    const files: Record<string, string> = {
      'xl/workbook.xml': makeWorkbookXml(names),
    };
    for (let i = 1; i <= names.length; i += 1) {
      files[`xl/worksheets/sheet${i}.xml`] = makeSheetXml('A1:B2');
    }
    const buffer = await zipOf(files);
    await expect(assertWorkbookSafe(buffer)).rejects.toThrow(/листов/i);
  });

  it('большой sharedStrings отклоняется', async () => {
    const items = Array.from(
      { length: XLSX_LIMITS.maxSharedStringsItems + 1 },
      (_, i) => `<si><t>${i}</t></si>`,
    ).join('');
    const buffer = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:B2'),
      'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${items}</sst>`,
    });
    await expect(assertWorkbookSafe(buffer)).rejects.toThrow(/sharedStrings/i);
  });

  it('readZipEntries видит имена и размеры записей', async () => {
    const buffer = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:B2'),
    });
    const entries = readZipEntries(buffer);
    expect(entries.map((e) => e.name)).toContain('xl/workbook.xml');
    expect(
      entries.some((e) => e.name === 'xl/workbook.xml' && e.uncompressed > 0),
    ).toBe(true);
  });
});
