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

export interface ParsedEstimate {
  sheet: string;
  sheets: string[];
  rows: ParsedRow[];
  columns: DetectedColumns;
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
  priceDeltaPct: number | null;
  /** существующая строка сметы с таким же названием */
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
