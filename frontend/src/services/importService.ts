// frontend/src/services/importService.ts
// ⭐ №202: импорт сметы из Excel — предпросмотр и подтверждение (RFC §8.3–8.4).
import api from './api';

export interface ImportPreviewMatch {
  status: 'EXACT' | 'FUZZY' | 'SUGGESTED' | 'NONE';
  priceItemId: number | null;
  price: number | null;
  score: number;
  candidates: { id: number; name: string; score: number; category: string | null }[];
}

export interface ImportPreviewRow {
  row: number;
  name: string;
  qty: number | null;
  unit: string | null;
  unitApprox: boolean;
  article: string | null;
  work: ImportPreviewMatch;
  filePrice: number | null;
  /** ⭐ №208: цена из файла → строка попадёт в новый справочник */
  hasPrice: boolean;
  priceDeltaPct: number | null;
  duplicate: { materialId: number; specQuantity: number; totalUsed: number } | null;
  warnings: string[];
  errors: string[];
}

export interface ImportPreview {
  batchId: number;
  fileName: string | null;
  sheet: string;
  sheets: string[];
  columns: {
    name: number;
    article: number | null;
    unit: number | null;
    qty: number | null;
    price: number | null;
    headerRow: number;
    confidence: number;
  };
  rows: ImportPreviewRow[];
  /** ⭐ №208: служебный лист `_meta` нашего шаблона/выгрузки */
  meta?: {
    frameExport?: number;
    templateVersion?: number;
    projectId?: number;
    projectName?: string;
    objectName?: string;
    includePrices?: boolean;
  } | null;
  /** ⭐ №208: предупреждения по файлу целиком */
  warnings: string[];
  /** ⭐ №208: сколько цен пришло из файла и как назовётся новый справочник */
  prices: { rows: number; catalogName: string | null };
  stats: { ready: number; needsDecision: number; errors: number; duplicates: number };
  totals: { plannedCost: number; zeroPriceRows: number };
}

export interface ImportCommitResult {
  batchId: number;
  status: string;
  created: number;
  skipped: number;
  skippedDetails: { row: number; reason: string }[];
  rowsTotal: number;
  /** ⭐ №208: созданный из цен файла справочник */
  catalog: { id: number; name: string; items: number } | null;
}

export const previewEstimateImport = async (
  projectId: number,
  file: File,
): Promise<ImportPreview> => {
  const form = new FormData();
  form.append('projectId', String(projectId));
  form.append('file', file);
  const response = await api.post('/imports/estimates/preview', form);
  return response.data;
};

export const commitEstimateImport = async (
  batchId: number,
  resolutions: { row: number; action: 'IMPORT' | 'SKIP'; workPriceItemId?: number | null }[],
): Promise<ImportCommitResult> => {
  const response = await api.post(`/imports/estimates/${batchId}/commit`, { resolutions });
  return response.data;
};
