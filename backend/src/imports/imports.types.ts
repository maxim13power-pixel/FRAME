// backend/src/imports/imports.types.ts
// ⭐ №202: общие типы конвейера импорта (парсер → матчер → предпросмотр → commit).
import type { Unit } from '@prisma/client';

export interface ParsedRow {
  /** номер строки в файле (1-based, как в Excel) */
  row: number;
  name: string;
  article: string | null;
  qtyRaw: string | null;
  unitRaw: string | null;
  priceRaw: string | null;
}

export interface DetectedColumns {
  name: number;
  article: number | null;
  unit: number | null;
  qty: number | null;
  price: number | null;
  headerRow: number;
  /** 0..1 — уверенность в распознавании шапки */
  confidence: number;
}

/** ⭐ №208: содержимое скрытого листа `_meta` нашей выгрузки/шаблона */
export interface ImportMetaInfo {
  frameExport?: number;
  templateVersion?: number;
  projectId?: number;
  projectName?: string;
  objectName?: string;
  includePrices?: boolean;
}

export interface ParsedEstimate {
  sheet: string;
  sheets: string[];
  rows: ParsedRow[];
  columns: DetectedColumns;
  meta?: ImportMetaInfo | null;
}

export type MatchStatus = 'EXACT' | 'FUZZY' | 'SUGGESTED' | 'NONE';

export interface MatchCandidate {
  id: number;
  name: string;
  score: number;
  category: string | null;
}

export interface RowMatch {
  status: MatchStatus;
  priceItemId: number | null;
  price: number | null;
  score: number;
  candidates: MatchCandidate[];
}

export interface CatalogItem {
  id: number;
  name: string;
  article: string | null;
  unit: Unit;
  price: number;
  kind: 'WORK' | 'MATERIAL';
  category: string | null;
}

export interface PreviewRow {
  row: number;
  raw: { name: string; article: string | null; qty: string | null; unit: string | null };
  name: string;
  qty: number | null;
  unit: Unit | null;
  unitApprox: boolean;
  article: string | null;
  /** найденная расценка (работа) и её цена из справочника */
  work: RowMatch;
  filePrice: number | null;
  /** ⭐ №208: в файле есть цена → строка пойдёт в новый справочник */
  hasPrice: boolean;
  priceDeltaPct: number | null;
  /** существующая строка сметы с таким же названием (импорт не блокирует — №208) */
  duplicate: { materialId: number; specQuantity: number; totalUsed: number } | null;
  warnings: string[];
  errors: string[];
}

export interface PreviewPayload {
  version: 1;
  fileName: string | null;
  sheet: string;
  sheets: string[];
  columns: DetectedColumns;
  rows: PreviewRow[];
  /** ⭐ №208: что было в скрытом листе `_meta` (наш файл/шаблон) */
  meta?: ImportMetaInfo | null;
  /** ⭐ №208: предупреждения по всему файлу (например, выгрузка другого проекта) */
  warnings: string[];
  /** ⭐ №208: цены из файла уйдут в новый справочник цен */
  prices: { rows: number; catalogName: string | null };
  stats: {
    ready: number;
    needsDecision: number;
    errors: number;
    duplicates: number;
  };
  totals: {
    plannedCost: number;
    zeroPriceRows: number;
  };
}
