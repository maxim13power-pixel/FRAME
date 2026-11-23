// backend/src/price-list-import/price-list-import.types.ts
// ⭐ №273 (§121): импорт и выгрузка прайс-листа (лист = категория).
import type { PriceKind, Unit } from '@prisma/client';

/** Что сделает импорт со строкой */
export type PriceImportAction = 'create' | 'update' | 'unchanged';

export interface PriceImportRow {
  /** стабильный ключ строки: `лист!номер` — по нему фронт присылает правки */
  key: string;
  sheet: string;
  row: number;
  id: number | null;
  /** ⭐ №372: id существующей позиции В ЭТОМ справочнике (для update);
   *  id из файла не использовать — он может принадлежать чужому каталогу */
  targetId?: number | null;
  name: string;
  article: string | null;
  unitRaw: string | null;
  unit: Unit | null;
  unitApprox: boolean;
  price: number | null;
  note: string | null;
  category: string;
  action: PriceImportAction;
  matchedBy: 'id' | 'article' | 'name' | null;
  /** единица не распознана и позиция будет создана черновиком */
  needsUnit: boolean;
  /** что изменится у существующей позиции */
  changes: string[];
  warnings: string[];
}

export interface PriceImportSheet {
  sheet: string;
  category: string;
  rows: number;
  newCategory: boolean;
  skipped: boolean;
}

export interface PriceUnitGroup {
  /** как написал пользователь (для показа) */
  raw: string;
  /** ключ для правки (trim + lowercase) */
  key: string;
  count: number;
  /** что предположил парсер (может быть null) */
  suggestion: Unit | null;
  approx: boolean;
}

export interface PriceImportPreview {
  fileName: string | null;
  kind: PriceKind;
  catalog: { id: number; name: string };
  template: boolean;
  sheets: PriceImportSheet[];
  rows: PriceImportRow[];
  unitGroups: PriceUnitGroup[];
  stats: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    needsUnit: number;
    warnings: number;
  };
  warnings: string[];
}

/** Правки единиц из предпросмотра: ключ группы → единица */
export type PriceUnitOverrides = Record<string, Unit>;

export interface PriceImportResult {
  created: number;
  updated: number;
  unchanged: number;
  drafts: number;
  categoriesCreated: number;
  message: string;
}
