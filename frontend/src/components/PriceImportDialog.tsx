// frontend/src/components/PriceImportDialog.tsx
// ⭐ №273 (§121): импорт прайса из Excel — предпросмотр, групповое уточнение единиц, применение.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  commitPriceImport,
  previewPriceImport,
  type PriceImportKind,
  type PriceImportPreview,
  type PriceImportResult,
} from '../services/priceListService';
import { getApiErrorText } from '../utils/errors';

export const UNIT_OPTIONS = [
  { value: 'PIECE', label: 'шт' },
  { value: 'METER', label: 'м' },
  { value: 'LINEAR_METER', label: 'пог. м' },
  { value: 'SQUARE_METER', label: 'м²' },
  { value: 'CUBIC_METER', label: 'м³' },
  { value: 'KILOGRAM', label: 'кг' },
  { value: 'LITER', label: 'л' },
  { value: 'TON', label: 'т' },
  { value: 'BAG', label: 'мешок' },
  { value: 'PACKAGE', label: 'упак' },
  { value: 'SET', label: 'компл' },
];

interface PriceImportDialogProps {
  open: boolean;
  catalogId: number;
  kind: PriceImportKind;
  catalogName?: string | null;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

export const PriceImportDialog: React.FC<PriceImportDialogProps> = ({
  open,
  catalogId,
  kind,
  catalogName,
  onClose,
  onImported,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { notify, error: notifyError } = useFeedback();

  const [file, setFile] = useState<File | null>(null);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PriceImportPreview | null>(null);
  const [result, setResult] = useState<PriceImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setUnits({});
    setPreview(null);
    setResult(null);
    setLoading(false);
    setCommitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runPreview = useCallback(
    async (nextFile: File, nextUnits: Record<string, string>) => {
      setLoading(true);
      try {
        setPreview(await previewPriceImport(catalogId, kind, nextFile, nextUnits));
      } catch (err) {
        setPreview(null);
        notifyError(getApiErrorText(err, 'Не удалось прочитать файл'));
      } finally {
        setLoading(false);
      }
    },
    [catalogId, kind, notifyError],
  );

  const handleFile = (chosen: File | null) => {
    if (!chosen) return;
    setFile(chosen);
    setUnits({});
    setResult(null);
    void runPreview(chosen, {});
  };

  const handleFix = (key: string, unit: string) => {
    const next = { ...units, [key]: unit };
    setUnits(next);
    if (file) void runPreview(file, next);
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitting(true);
    try {
      const data = await commitPriceImport(catalogId, kind, file, units);
      setResult(data);
      notify(data.message);
      await onImported();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось импортировать прайс'));
    } finally {
      setCommitting(false);
    }
  };

  const problems = useMemo(
    () => (preview ? preview.rows.filter((row) => row.needsUnit) : []),
    [preview],
  );
  const kindLabel = kind === 'WORK' ? 'работы' : 'материалы';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle>Импорт прайса — {kindLabel}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Справочник: <b>{catalogName || preview?.catalog.name || '—'}</b>. Один лист — одна
            категория. Пустые листы не импортируются, новый лист станет новой категорией.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={loading || committing}
            >
              {file ? 'Выбрать другой файл' : 'Выбрать файл .xlsx'}
              <input
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            {file && <Chip label={file.name} onDelete={reset} />}
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Читаем файл…</Typography>
            </Box>
          )}

          {preview && !result && (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip color="success" label={`добавим ${preview.stats.create}`} />
                <Chip color="info" label={`обновим ${preview.stats.update}`} />
                <Chip label={`без изменений ${preview.stats.unchanged}`} />
                {preview.stats.needsUnit > 0 && (
                  <Chip color="warning" label={`уточнить единицу ${preview.stats.needsUnit}`} />
                )}
              </Box>

              {preview.warnings.map((text) => (
                <Alert key={text} severity="info">
                  {text}
                </Alert>
              ))}

              {preview.unitGroups.length > 0 && (
                <Alert severity="warning">
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Не распознана единица измерения
                  </Typography>
                  <Stack spacing={1}>
                    {preview.unitGroups.map((group) => (
                      <Box
                        key={group.key}
                        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Typography variant="body2" sx={{ minWidth: 130 }}>
                          «{group.raw || 'пусто'}» — {group.count} стр.
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Единица</InputLabel>
                          <Select
                            label="Единица"
                            value={units[group.key] ?? ''}
                            onChange={(e) => handleFix(group.key, e.target.value)}
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <MenuItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button size="small" onClick={() => handleFix(group.key, 'PIECE')}>
                          Это шт
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Неуточнённые позиции сохранятся черновиками (серыми) — их можно уточнить в
                    справочнике.
                  </Typography>
                </Alert>
              )}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Лист</TableCell>
                    <TableCell>Категория</TableCell>
                    <TableCell align="right">Строк</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.sheets.map((sheet) => (
                    <TableRow key={sheet.sheet}>
                      <TableCell>{sheet.sheet}</TableCell>
                      <TableCell>
                        {sheet.category}
                        {sheet.newCategory && (
                          <Chip size="small" color="success" label="новая" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {sheet.skipped ? <Chip size="small" label="пусто" /> : sheet.rows}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {problems.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">
                    Позиции без единицы ({problems.length})
                  </Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 160, overflow: 'auto', mt: 1 }}>
                    {problems.slice(0, 50).map((row) => (
                      <Typography key={row.key} variant="caption" color="text.secondary">
                        {row.sheet} · {row.name} — «{row.unitRaw || 'пусто'}»
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}

          {result && (
            <Alert severity={result.drafts > 0 ? 'warning' : 'success'}>
              {result.message}
              {result.drafts > 0 &&
                ' Черновики отмечены в справочнике — уточните единицу, чтобы они стали доступны.'}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={committing}>
          Закрыть
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleCommit}
            disabled={!preview || loading || committing}
          >
            {committing
              ? 'Импортируем…'
              : preview
                ? `Импортировать ${preview.stats.create + preview.stats.update}`
                : 'Импортировать'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

