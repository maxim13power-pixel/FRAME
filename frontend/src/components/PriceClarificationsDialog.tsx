// frontend/src/components/PriceClarificationsDialog.tsx
// ⭐ №273 (§121): черновики импорта — позиции, у которых не распознана единица.
// Пока единица не уточнена, позиция неактивна и в смету не подставляется.
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  fetchPriceClarifications,
  resolvePriceClarifications,
  type PriceClarificationGroup,
  type PriceImportKind,
} from '../services/priceListService';
import { getApiErrorText } from '../utils/errors';
import { UNIT_OPTIONS } from './PriceImportDialog';

interface PriceClarificationsDialogProps {
  open: boolean;
  catalogId: number;
  kind: PriceImportKind;
  onClose: () => void;
  onResolved: () => void | Promise<void>;
}

export const PriceClarificationsDialog: React.FC<PriceClarificationsDialogProps> = ({
  open,
  catalogId,
  kind,
  onClose,
  onResolved,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { notify, error: notifyError } = useFeedback();

  const [groups, setGroups] = useState<PriceClarificationGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPriceClarifications(catalogId, kind);
      setGroups(data.groups);
      setTotal(data.total);
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось загрузить черновики'));
    } finally {
      setLoading(false);
    }
  }, [catalogId, kind, notifyError]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const resolve = async (group: PriceClarificationGroup) => {
    const unit = choice[group.key];
    if (!unit) return;
    setSaving(group.key);
    try {
      const result = await resolvePriceClarifications(catalogId, {
        unit,
        ids: group.items.map((item) => item.id),
      });
      notify(`Уточнено позиций: ${result.updated}`);
      await onResolved();
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось сохранить единицу'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>Уточнить единицы измерения</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Загружаем…</Typography>
          </Box>
        ) : total === 0 ? (
          <Alert severity="success">Все единицы уточнены — черновиков нет.</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Позиции сохранены, но неактивны: пока единица не выбрана, их нельзя добавить в смету.
            </Typography>
            {groups.map((group) => (
              <Box key={group.key}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2">
                    «{group.raw || 'пусто'}» — {group.count} поз.
                  </Typography>
                  <Chip size="small" label={group.items[0]?.kind === 'WORK' ? 'работы' : 'материалы'} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {group.items.slice(0, 3).map((item) => item.name).join(', ')}
                  {group.items.length > 3 ? '…' : ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Единица</InputLabel>
                    <Select
                      label="Единица"
                      value={choice[group.key] ?? ''}
                      onChange={(e) =>
                        setChoice((prev) => ({ ...prev, [group.key]: e.target.value }))
                      }
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <MenuItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!choice[group.key] || saving === group.key}
                    onClick={() => void resolve(group)}
                  >
                    {saving === group.key ? 'Сохраняем…' : 'Уточнить'}
                  </Button>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};
