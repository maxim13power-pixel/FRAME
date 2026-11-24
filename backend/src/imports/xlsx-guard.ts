// ⭐ №378: защита от XLSX-бомб ДО разбора ExcelJS.
// ExcelJS полностью распаковывает книгу и строит матрицу — поэтому сначала
// проверяем ZIP-структуру (размеры/коэффициент/число файлов), затем размерность
// листов и sharedStrings по XML. Это дешевле, чем ловить OOM после load().
import JSZip from 'jszip';

export const XLSX_LIMITS = {
  /** суммарный распакованный размер, байт */
  maxUncompressed: 25 * 1024 * 1024,
  /** отдельная запись, байт */
  maxEntry: 10 * 1024 * 1024,
  /** файлов в архиве */
  maxFiles: 300,
  /** коэффициент сжатия (uncompressed / compressed) */
  maxRatio: 120,
  /** строк на листе */
  maxRows: 20_000,
  /** колонок на листе */
  maxCols: 256,
  /** размер sharedStrings.xml, байт */
  maxSharedStrings: 5 * 1024 * 1024,
  /** количество строк в sharedStrings */
  maxSharedStringsItems: 100_000,
  /** максимум листов */
  maxSheets: 30,
};

export class XlsxLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxLimitError';
  }
}

interface ZipEntryInfo {
  name: string;
  compressed: number;
  uncompressed: number;
}

/** Разбор центрального каталога ZIP без распаковки данных. */
export function readZipEntries(buffer: Buffer): ZipEntryInfo[] {
  const buf = buffer;
  const minEocd = 22;
  if (buf.length < minEocd) {
    throw new XlsxLimitError('Файл слишком короткий для XLSX');
  }
  let eocd = -1;
  const scanFrom = Math.max(0, buf.length - 65_557);
  for (let i = buf.length - minEocd; i >= scanFrom; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxLimitError('Не найден ZIP-каталог — это не XLSX');

  const total = buf.readUInt16LE(eocd + 10);
  const centralOffset = buf.readUInt32LE(eocd + 16);
  if (total > XLSX_LIMITS.maxFiles) {
    throw new XlsxLimitError(`Слишком много файлов в архиве: ${total}`);
  }

  const entries: ZipEntryInfo[] = [];
  let ptr = centralOffset;
  for (let i = 0; i < total; i += 1) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new XlsxLimitError('Повреждён ZIP-каталог');
    }
    const compressed = buf.readUInt32LE(ptr + 20);
    const uncompressed = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.push({ name, compressed, uncompressed });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Проверить ZIP-структуру: размеры, коэффициент сжатия, число файлов. */
export function assertZipSafe(buffer: Buffer): void {
  const entries = readZipEntries(buffer);
  let total = 0;
  for (const entry of entries) {
    if (entry.uncompressed > XLSX_LIMITS.maxEntry) {
      throw new XlsxLimitError(
        `Файл «${entry.name}» распаковывается слишком сильно (${Math.round(
          entry.uncompressed / 1024 / 1024,
        )} МБ)`,
      );
    }
    total += entry.uncompressed;
    if (total > XLSX_LIMITS.maxUncompressed) {
      throw new XlsxLimitError(
        `Книга распаковывается больше ${Math.round(
          XLSX_LIMITS.maxUncompressed / 1024 / 1024,
        )} МБ — файл отклонён`,
      );
    }
    if (
      entry.compressed > 0 &&
      entry.uncompressed / entry.compressed > XLSX_LIMITS.maxRatio
    ) {
      throw new XlsxLimitError(
        `Подозрительная степень сжатия у «${entry.name}» — файл отклонён`,
      );
    }
  }
}

function parseDimension(xml: string): { rows: number; cols: number } | null {
  const match = xml.match(/<dimension[^>]*ref="([^"]+)"/);
  if (!match) return null;
  const ref = match[1];
  const end = ref.includes(':') ? ref.split(':')[1] : ref;
  const cell = end.match(/^([A-Z]+)(\d+)$/);
  if (!cell) return null;
  let col = 0;
  for (const ch of cell[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { rows: Number(cell[2]), cols: col };
}

/** Проверить книгу после ZIP-проверки, но ДО ExcelJS.load(). */
export async function assertWorkbookSafe(buffer: Buffer): Promise<void> {
  assertZipSafe(buffer);
  const zip = await JSZip.loadAsync(buffer);

  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookXml) {
    throw new XlsxLimitError('В файле нет xl/workbook.xml — это не XLSX');
  }
  const sheetCount = (workbookXml.match(/<sheet\b/g) ?? []).length;
  if (sheetCount > XLSX_LIMITS.maxSheets) {
    throw new XlsxLimitError(
      `Слишком много листов: ${sheetCount} (максимум ${XLSX_LIMITS.maxSheets})`,
    );
  }

  const sheetFiles = Object.keys(zip.files).filter((name) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  for (const name of sheetFiles) {
    const xml = await zip.files[name].async('string');
    const dimension = parseDimension(xml);
    if (!dimension) continue;
    if (
      dimension.rows > XLSX_LIMITS.maxRows ||
      dimension.cols > XLSX_LIMITS.maxCols
    ) {
      throw new XlsxLimitError(
        `Лист «${name}» слишком большой: ${dimension.rows} строк × ${dimension.cols} колонок`,
      );
    }
  }

  const shared = zip.file('xl/sharedStrings.xml');
  if (shared) {
    const xml = await shared.async('string');
    if (Buffer.byteLength(xml, 'utf8') > XLSX_LIMITS.maxSharedStrings) {
      throw new XlsxLimitError('Слишком большой sharedStrings.xml');
    }
    const items = (xml.match(/<si\b/g) ?? []).length;
    if (items > XLSX_LIMITS.maxSharedStringsItems) {
      throw new XlsxLimitError(`Слишком много строк в sharedStrings: ${items}`);
    }
  }
}
