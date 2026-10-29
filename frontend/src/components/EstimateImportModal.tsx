// frontend/src/components/EstimateImportModal.tsx
// ⭐ №202 (RFC §5): импорт сметы из чужого Excel — файл → предпросмотр → запись.
// Цены из файла не записываются: сервер берёт их из справочника, в предпросмотре — только сверка.
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { previewEstimateImport, commitEstimateImport } from '../services/importService';
import type { ImportPreview, ImportPreviewRow } from '../services/importService';
import { getApiErrorMessage } from '../utils/errors';
import { money, unitLabel } from '../utils/exportShared';

interface Props {
  open: boolean;
  projectId: number;
  onClose: () => void;
  /** После успешной записи — страница перечитывает смету */
  onImported: (created: number, skipped: number, catalogName?: string | null) => void;
}

const MAX_ROWS = 500;
const rowUsable = (r: ImportPreviewRow) => r.errors.length === 0;

const statusChip = (r: ImportPreviewRow) => {
  if (r.errors.length > 0) return <Chip size="small" color="error" label="ошибка" />;
  if (r.hasPrice) return <Chip size="small" color="success" variant="outlined" label="цена из файла" />;
  if (r.work.status === 'EXACT') return <Chip size="small" color="success" label="расценка найдена" />;
  if (r.work.status === 'FUZZY') return <Chip size="small" color="warning" label="проверьте расценку" />;
  if (r.work.status === 'SUGGESTED') {
    return <Chip size="small" color="warning" variant="outlined" label="выберите вручную" />;
  }
  return <Chip size="small" variant="outlined" label="без цены — пойдёт в 0" />;
};

const EstimateImportModal: React.FC<Props> = ({ open, projectId, onClose, onImported }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const reset = () => {
    setPreview(null);
    setLoading(false);
    setSaving(false);
    setError('');
    setSelected({});
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const data = await previewEstimateImport(projectId, file);
      setPreview(data);
      const initial: Record<number, boolean> = {};
      // ⭐ №208: по умолчанию берём ВСЕ строки без ошибок — в том числе без расценки
      // (они пишутся с ценой из файла или с 0, чтобы не терять позиции)
      data.rows.forEach((r) => {
        initial[r.row] = rowUsable(r);
      });
      setSelected(initial);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Не удалось прочитать файл'));
    } finally {
      setLoading(false);
    }
  };

  const toImport = useMemo(
    () => (preview ? preview.rows.filter((r) => selected[r.row]) : []),
    [preview, selected],
  );
  const planned = toImport.reduce(
    (sum, r) => sum + (r.qty ?? 0) * (r.filePrice ?? r.work.price ?? 0),
    0,
  );

  const commit = async () => {
    if (!preview) return;
    setSaving(true);
    setError('');
    try {
      const result = await commitEstimateImport(
        preview.batchId,
        toImport.map((r) => ({ row: r.row, action: 'IMPORT' as const, workPriceItemId: r.work.priceItemId })),
      );
      onImported(result.created, result.skipped, result.catalog?.name ?? null);
      reset();
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Не удалось записать смету'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle>Импорт сметы из Excel</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!preview ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Подойдёт любой файл .xlsx или .csv: шапка и колонки определяются автоматически
              («Наименование», «Ед.», «Количество», «Цена»). Если в файле есть цены, FRAME сохранит
              их в <b>новый справочник цен</b> — существующие справочники не изменяются.
            </Typography>
            <Dropzone
              loading={loading}
              onPick={() => fileRef.current?.click()}
              onFile={(file) => void handleFile(file)}
            />
            <Typography variant="caption" color="text.secondary">
              До {MAX_ROWS} строк за раз. Повторная загрузка того же файла добавит позиции ещё раз
              (дубли не суммируются) и создаст ещё один справочник.
            </Typography>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".xlsx,.csv,.txt"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {/* ⭐ №208: предупреждения по файлу (другой проект, новый справочник, чужой формат) */}
            {preview.warnings.length > 0 && (
              <Alert severity="info">
                <Stack spacing={0.5}>
                  {preview.warnings.map((w) => (
                    <Typography key={w} variant="caption" display="block">
                      • {w}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip size="small" color="success" label={`готово: ${preview.stats.ready}`} />
              <Chip size="small" color="error" label={`с ошибками: ${preview.stats.errors}`} />
              <Chip size="small" label={`уже в смете: ${preview.stats.duplicates}`} />
              {preview.prices.rows > 0 && (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`цен из файла: ${preview.prices.rows}`}
                />
              )}
              <Chip size="small" variant="outlined" label={`строк: ${preview.rows.length}`} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Лист «{preview.sheet}», шапка в строке {preview.columns.headerRow}. Отмечено к импорту:{' '}
              <b>{toImport.length}</b> на сумму <b>{money(planned)} ₽</b>.
              {preview.totals.zeroPriceRows > 0 && (
                <> Без цены (пойдут с 0): <b>{preview.totals.zeroPriceRows}</b>.</>
              )}
            </Typography>

            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Стр.</TableCell>
                    <TableCell>Позиция</TableCell>
                    {!isMobile && <TableCell align="right">Кол-во</TableCell>}
                    <TableCell>Ед.</TableCell>
                    <TableCell>Расценка</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.row} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={!!selected[r.row]}
                          disabled={!rowUsable(r) || saving}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [r.row]: e.target.checked }))
                          }
                        />
                      </TableCell>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.name}</Typography>
                        {r.warnings.length > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {r.warnings.join(' · ')}
                          </Typography>
                        )}
                        {r.errors.length > 0 && (
                          <Typography variant="caption" color="error" display="block">
                            {r.errors.join(' · ')}
                          </Typography>
                        )}
                      </TableCell>
                      {!isMobile && <TableCell align="right">{r.qty ?? '—'}</TableCell>}
                      <TableCell>{r.unit ? unitLabel(r.unit) : '—'}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {statusChip(r)}
                          {r.filePrice != null && r.filePrice > 0 && (
                            <Typography variant="caption" color="success.main">
                              {money(r.filePrice)} ₽ из файла
                            </Typography>
                          )}
                          {r.work.price != null && (
                            <Typography variant="caption" color="text.secondary">
                              {r.work.candidates[0]?.name ?? '—'} · {money(r.work.price)} ₽
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {preview && (
          <Button onClick={reset} disabled={saving}>
            Другой файл
          </Button>
        )}
        <Button onClick={close} disabled={saving}>
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={() => void commit()}
          disabled={!preview || saving || toImport.length === 0}
          startIcon={saving ? <CircularProgress size={18} /> : <UploadFileIcon />}
        >
          {preview ? `Импортировать ${toImport.length}` : 'Импортировать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Зона выбора файла: клик или перетаскивание (без внешних библиотек) */
const Dropzone: React.FC<{
  loading: boolean;
  onPick: () => void;
  onFile: (file: File | null | undefined) => void;
}> = ({ loading, onPick, onFile }) => {
  const [over, setOver] = useState(false);
  return (
    <Box
      onClick={loading ? undefined : onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!loading) onFile(e.dataTransfer.files?.[0]);
      }}
      sx={{
        border: '2px dashed',
        borderColor: over ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: loading ? 'default' : 'pointer',
        bgcolor: over ? 'action.hover' : 'transparent',
      }}
    >
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2">Нажмите, чтобы выбрать файл .xlsx или .csv</Typography>
          <Typography variant="caption" color="text.secondary">
            Или перетащите файл в эту область
          </Typography>
        </>
      )}
    </Box>
  );
};

export default EstimateImportModal;
