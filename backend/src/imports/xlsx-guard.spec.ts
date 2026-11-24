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

// ⭐ №382: STORE нужен там, где важна не степень сжатия, а сама граница лимита.
const zipOf = async (
  files: Record<string, string | Buffer>,
  compression: 'DEFLATE' | 'STORE' = 'DEFLATE',
) => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  if (compression === 'STORE') {
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
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
    expect(() => assertZipSafe(Buffer.from('not a zip'))).toThrow(
      XlsxLimitError,
    );
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
    await expect(assertWorkbookSafe(buffer)).rejects.toThrow(
      /слишком большой/i,
    );
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

// ⭐ №382: проверяем САМУ границу («ровно лимит» проходит, «+1» — нет),
// иначе тест проходит и при `>=`, и при `>`, то есть границу не защищает.
const MB = 1024 * 1024;

interface FakeEntry {
  name: string;
  compressed: number;
  uncompressed: number;
}

/**
 * ZIP только с центральным каталогом: данных нет, потому что `readZipEntries`
 * читает ИМЕННО каталог. Так «25 МБ» проверяются без 25 МБ в памяти.
 */
const fakeZip = (
  entries: FakeEntry[],
  opts: { total?: number; centralOffset?: number } = {},
): Buffer => {
  const records = entries.map((entry) => {
    const name = Buffer.from(entry.name, 'utf8');
    const buf = Buffer.alloc(46 + name.length);
    buf.writeUInt32LE(0x02014b50, 0); // сигнатура центрального каталога
    buf.writeUInt16LE(20, 4); // version made by
    buf.writeUInt16LE(20, 6); // version needed
    buf.writeUInt32LE(entry.compressed, 20);
    buf.writeUInt32LE(entry.uncompressed, 24);
    buf.writeUInt16LE(name.length, 28);
    name.copy(buf, 46);
    return buf;
  });
  const central = Buffer.concat(records);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(opts.total ?? entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(opts.centralOffset ?? 0, 16);
  return Buffer.concat([central, eocd]);
};

/** Сжатый размер, дающий коэффициент ровно на лимите. */
const compressedAtRatioLimit = (uncompressed: number) =>
  Math.ceil(uncompressed / XLSX_LIMITS.maxRatio);

describe('xlsx-guard — границы лимитов (№382)', () => {
  it('ровно 25 МБ распакованных данных проходит, +1 байт — отказ', () => {
    const entries: FakeEntry[] = [
      { name: 'a.bin', uncompressed: 10 * MB, compressed: 0 },
      { name: 'b.bin', uncompressed: 10 * MB, compressed: 0 },
      { name: 'c.bin', uncompressed: 5 * MB, compressed: 0 },
    ];
    for (const entry of entries) {
      entry.compressed = compressedAtRatioLimit(entry.uncompressed);
    }

    const atLimit = fakeZip(entries);
    // 25 МБ в памяти не нужны: проверка идёт по каталогу
    expect(atLimit.length).toBeLessThan(10_000);
    expect(() => assertZipSafe(atLimit)).not.toThrow();

    const overLimit = fakeZip([
      entries[0],
      entries[1],
      {
        name: 'c.bin',
        uncompressed: 5 * MB + 1,
        compressed: compressedAtRatioLimit(5 * MB),
      },
    ]);
    expect(() => assertZipSafe(overLimit)).toThrow(/25 МБ/i);
  });

  it('ровно 10 МБ на одну запись проходит, +1 байт — отказ', () => {
    const atLimit = fakeZip([
      {
        name: 'a.bin',
        uncompressed: 10 * MB,
        compressed: compressedAtRatioLimit(10 * MB),
      },
    ]);
    expect(() => assertZipSafe(atLimit)).not.toThrow();

    const overLimit = fakeZip([
      {
        name: 'a.bin',
        uncompressed: 10 * MB + 1,
        compressed: compressedAtRatioLimit(10 * MB),
      },
    ]);
    expect(() => assertZipSafe(overLimit)).toThrow(/слишком сильно/i);
  });

  it('коэффициент сжатия ровно 120 проходит, больше — отказ', () => {
    const atLimit = fakeZip([
      { name: 'a.bin', uncompressed: 1200, compressed: 10 },
    ]);
    expect(() => assertZipSafe(atLimit)).not.toThrow();

    const overLimit = fakeZip([
      { name: 'a.bin', uncompressed: 1201, compressed: 10 },
    ]);
    expect(() => assertZipSafe(overLimit)).toThrow(/степень сжатия/i);
  });

  it('ровно 300 файлов проходит, 301 — отказ', () => {
    const files = (count: number): FakeEntry[] =>
      Array.from({ length: count }, (_, i) => ({
        name: `f${i}.bin`,
        compressed: 100,
        uncompressed: 100,
      }));

    expect(() =>
      assertZipSafe(fakeZip(files(XLSX_LIMITS.maxFiles))),
    ).not.toThrow();
    expect(() =>
      assertZipSafe(fakeZip(files(XLSX_LIMITS.maxFiles + 1))),
    ).toThrow(/файлов/i);
  });

  it('запись с compressed = 0: коэффициент не проверяется, размер — да', () => {
    // У STORED-записи нет сжатия — делить не на что, проверка пропускается.
    const stored = fakeZip([
      { name: 'a.bin', uncompressed: 10 * MB, compressed: 0 },
    ]);
    expect(() => assertZipSafe(stored)).not.toThrow();

    const huge = fakeZip([
      { name: 'a.bin', uncompressed: 25 * MB + 1, compressed: 0 },
    ]);
    expect(() => assertZipSafe(huge)).toThrow(/25 МБ/i);
  });

  it('ZIP64-каталог отклоняется, а не обходится', () => {
    // 0xFFFF в EOCD = «смотрите ZIP64»: у нас это «слишком много файлов»
    expect(() => assertZipSafe(fakeZip([], { total: 0xffff }))).toThrow(
      /файлов/i,
    );

    // смещение каталога из ZIP64 (0xFFFFFFFF) не читается → понятный отказ
    const badOffset = fakeZip(
      [{ name: 'a.bin', compressed: 10, uncompressed: 10 }],
      { centralOffset: 0xffffffff },
    );
    expect(() => assertZipSafe(badOffset)).toThrow(/каталог/i);
  });

  it('лист ровно 20 000 строк × 256 колонок проходит, +1 — отказ', async () => {
    // IV — 256-я колонка Excel, IW — 257-я
    const atLimit = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:IV20000'),
    });
    await expect(assertWorkbookSafe(atLimit)).resolves.toBeUndefined();

    const wide = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:IW20000'),
    });
    await expect(assertWorkbookSafe(wide)).rejects.toThrow(/слишком большой/i);

    const tall = await zipOf({
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:IV20001'),
    });
    await expect(assertWorkbookSafe(tall)).rejects.toThrow(/слишком большой/i);
  });

  it('ровно 30 листов проходит', async () => {
    const names = Array.from(
      { length: XLSX_LIMITS.maxSheets },
      (_, i) => `Лист${i + 1}`,
    );
    const files: Record<string, string> = {
      'xl/workbook.xml': makeWorkbookXml(names),
    };
    for (let i = 1; i <= names.length; i += 1) {
      files[`xl/worksheets/sheet${i}.xml`] = makeSheetXml('A1:B2');
    }
    await expect(
      assertWorkbookSafe(await zipOf(files)),
    ).resolves.toBeUndefined();
  });

  it('sharedStrings ровно 100 000 строк проходит, 100 001 — отказ', async () => {
    const items = (count: number) =>
      Array.from({ length: count }, (_, i) => `<si><t>${i}</t></si>`).join('');
    const base = {
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:B2'),
    };

    const atLimit = await zipOf(
      {
        ...base,
        'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${items(
          XLSX_LIMITS.maxSharedStringsItems,
        )}</sst>`,
      },
      'STORE',
    );
    await expect(assertWorkbookSafe(atLimit)).resolves.toBeUndefined();

    const overLimit = await zipOf(
      {
        ...base,
        'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${items(
          XLSX_LIMITS.maxSharedStringsItems + 1,
        )}</sst>`,
      },
      'STORE',
    );
    await expect(assertWorkbookSafe(overLimit)).rejects.toThrow(
      /sharedStrings/i,
    );
  }, 30_000);

  it('sharedStrings ровно 5 МБ проходит, +1 байт — отказ', async () => {
    const prefix = '<?xml version="1.0"?><sst><si><t>';
    const suffix = '</t></si></sst>';
    const xmlWithPad = (pad: number) => prefix + 'a'.repeat(pad) + suffix;
    const pad =
      XLSX_LIMITS.maxSharedStrings -
      Buffer.byteLength(prefix) -
      Buffer.byteLength(suffix);
    const atLimitXml = xmlWithPad(pad);
    expect(Buffer.byteLength(atLimitXml)).toBe(XLSX_LIMITS.maxSharedStrings);

    const base = {
      'xl/workbook.xml': makeWorkbookXml(['Лист1']),
      'xl/worksheets/sheet1.xml': makeSheetXml('A1:B2'),
    };
    await expect(
      assertWorkbookSafe(
        await zipOf({ ...base, 'xl/sharedStrings.xml': atLimitXml }, 'STORE'),
      ),
    ).resolves.toBeUndefined();

    await expect(
      assertWorkbookSafe(
        await zipOf(
          { ...base, 'xl/sharedStrings.xml': xmlWithPad(pad + 1) },
          'STORE',
        ),
      ),
    ).rejects.toThrow(/sharedStrings/i);
  }, 30_000);
});
