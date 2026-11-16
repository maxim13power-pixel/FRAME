// frontend/src/components/PriceTemplateUpdateDialog.tsx
// ⭐ №278 (§122): обновление личной базы из образца — новые позиции и цены.
import React, { useCallback, useEffect, useState } from 'react';
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
import { useFeedback } from '../contexts/FeedbackContext';
import {
  applyTemplateUpdate,
  fetchTemplateUpdate,
  type TemplateUpdatePreview,
} from '../services/priceListService';
import { getApiErrorText } from '../utils/errors';

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'шт',
  METER: 'м',
  LINEAR_METER: 'пог. м',
  SQUARE_METER: 'м²',
  CUBIC_METER: 'м³',
  KILOGRAM: 'кг',
  LITER: 'л',
  TON: 'т',
  BAG: 'мешок',
  PACKAGE: 'упак',
  SET: 'компл',
};

const money = (value: number | null): string =>
  value == null ? '—' : `${value.toLocaleString('ru-RU')} ₽`;

interface PriceTemplateUpdateDialogProps {
  open: boolean;
  catalogId: number;
  onClose: () => void;
  onApplied: () => void | Promise<void>;
}

export const PriceTemplateUpdateDialog: React.FC<PriceTemplateUpdateDialogProps> = ({
  open,
  catalogId,
  onClose,
  onApplied,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { notify, error: notifyError } = useFeedback();

  const [preview, setPreview] = useState<TemplateUpdatePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<'missing' | 'all' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPreview(await fetchTemplateUpdate(catalogId));
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось получить обновления образца'));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [catalogId, notifyError]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const apply = async (mode: 'missing' | 'all') => {
    setApplying(mode);
    try {
      const result = await applyTemplateUpdate(catalogId, mode);
      notify(result.message);
      await onApplied();
      onClose();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось обновить из образца'));
    } finally {
      setApplying(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle>Обновление из образца</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Сравниваем с образцом…</Typography>
          </Box>
        ) : !preview ? (
          <Alert severity="info">Нет данных об образце для этого справочника.</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Образец: <b>{preview.template.name}</b>
              {preview.template.version != null ? ` (версия ${preview.template.version})` : ''}.
              Ваша база: «{preview.catalog.name}»
              {preview.catalog.templateVersion != null
                ? `, версия ${preview.catalog.templateVersion}`
                : ''}
              .
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip color="success" label={`новых позиций ${preview.stats.add}`} />
              <Chip color="info" label={`изменились цены ${preview.stats.price}`} />
            </Box>

            {preview.rows.length === 0 ? (
              <Alert severity="success">База уже соответствует образцу.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Позиция</TableCell>
                    <TableCell>Ед.</TableCell>
                    <TableCell align="right">Было</TableCell>
                    <TableCell align="right">Станет</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.rows.slice(0, 50).map((row) => (
                    <TableRow key={`${row.action}-${row.templateItemId}`}>
                      <TableCell>
                        {row.name}
                        {row.action === 'add' && (
                          <Chip size="small" color="success" label="новая" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>{UNIT_LABELS[row.unit] ?? row.unit}</TableCell>
                      <TableCell align="right">{money(row.oldPrice)}</TableCell>
                      <TableCell align="right">{money(row.newPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Typography variant="caption" color="text.secondary">
              Позиции, которые вы убрали или создали сами, не затрагиваются. Уже созданные сметы не
              меняются — цены строк это снимки.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applying != null}>
          Закрыть
        </Button>
        {preview && preview.stats.add > 0 && (
          <Button
            variant="outlined"
            onClick={() => void apply('missing')}
            disabled={applying != null}
          >
            {applying === 'missing' ? 'Добавляем…' : `Добавить новые (${preview.stats.add})`}
          </Button>
        )}
        {preview && (preview.stats.add > 0 || preview.stats.price > 0) && (
          <Button variant="contained" onClick={() => void apply('all')} disabled={applying != null}>
            {applying === 'all' ? 'Обновляем…' : 'Добавить и обновить цены'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
