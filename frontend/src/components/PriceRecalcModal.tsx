// frontend/src/components/PriceRecalcModal.tsx
// ⭐ №170: пересчёт сметы по справочнику цен.
// Вкладка «Превью» показывает «было → станет» по каждой строке, вкладка «История» —
// версии пересчёта с откатом. Объёмы, фиксации и проценты не меняются.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Modal,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  applyPriceRecalc,
  fetchPriceRecalcHistory,
  fetchPriceRecalcPreview,
  rollbackPriceRecalc,
} from '../services/projectService';
import type {
  PriceRecalcPreview,
  PriceRecalcReason,
  PriceRecalcRow,
  PriceRecalcVersion,
} from '../services/projectService';
import { getApiErrorText } from '../utils/errors';

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'шт',
  METER: 'м',
  SQUARE_METER: 'м²',
  CUBIC_METER: 'м³',
  KILOGRAM: 'кг',
  LITER: 'л',
  TON: 'т',
  BAG: 'мешок',
  PACKAGE: 'упак',
  SET: 'компл',
};

/** Подписи причин: почему строка обновится или останется как есть */
const REASON_META: Record<
  PriceRecalcReason,
  { label: string; color: 'success' | 'default' | 'info' | 'warning' }
> = {
  ok: { label: 'обновится', color: 'success' },
  same: { label: 'цена та же', color: 'default' },
  hasFacts: { label: 'есть фиксации', color: 'info' },
  notFound: { label: 'нет в справочнике', color: 'warning' },
  ambiguous: { label: 'несколько совпадений', color: 'warning' },
};

const MATCH_LABELS: Record<string, string> = {
  id: 'по ссылке',
  article: 'по артикулу',
  name: 'по названию',
};

const money = (value?: number | null): string =>
  value == null || Number.isNaN(Number(value))
    ? '—'
    : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

const unitLabel = (unit: string): string => UNIT_LABELS[unit] ?? unit;

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

interface PriceRecalcModalProps {
  open: boolean;
  projectId: number;
  /** Действующий справочник проекта (undefined — берём на сервере) */
  catalogId?: number | null;
  catalogName?: string | null;
  onClose: () => void;
  /** Вызывается после применения/отката — страница перечитывает смету */
  onApplied: () => void | Promise<void>;
}

export const PriceRecalcModal: React.FC<PriceRecalcModalProps> = ({
  open,
  projectId,
  catalogId,
  catalogName,
  onClose,
  onApplied,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { notify, error: notifyError, confirm } = useFeedback();

  const [tab, setTab] = useState<'preview' | 'history'>('preview');
  const [preview, setPreview] = useState<PriceRecalcPreview | null>(null);
  const [versions, setVersions] = useState<PriceRecalcVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rollingId, setRollingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPriceRecalcPreview(
        projectId,
        catalogId ?? undefined,
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(getApiErrorText(err, 'Не удалось построить превью пересчёта'));
    } finally {
      setLoading(false);
    }
  }, [projectId, catalogId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setVersions(await fetchPriceRecalcHistory(projectId));
    } catch {
      setVersions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setTab('preview');
    void loadPreview();
    void loadHistory();
  }, [open, loadPreview, loadHistory]);

  const handleApply = async () => {
    if (!preview || preview.summary.willUpdate === 0) return;
    const ok = await confirm({
      title: 'Пересчитать смету?',
      text:
        `Обновим цены в строках: ${preview.summary.willUpdate}. ` +
        `Строки с фиксациями не тронем (${preview.summary.withFacts}). ` +
        'Объёмы и проценты останутся прежними.',
      confirmText: 'Пересчитать',
    });
    if (!ok) return;
    setApplying(true);
    try {
      const result = await applyPriceRecalc(projectId, catalogId ?? undefined);
      notify(
        result.message || `Пересчитано строк: ${result.updated}`,
        'success',
      );
      await onApplied();
      await Promise.all([loadPreview(), loadHistory()]);
      setTab('history');
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось пересчитать смету'));
    } finally {
      setApplying(false);
    }
  };

  const handleRollback = async (version: PriceRecalcVersion) => {
    const ok = await confirm({
      title: 'Откатить цены?',
      text:
        `Вернём цены строк из версии от ${formatDate(version.createdAt)}. ` +
        'Текущие цены сохранятся в истории — откат тоже можно отменить.',
      confirmText: 'Откатить',
      danger: true,
    });
    if (!ok) return;
    setRollingId(version.id);
    try {
      const result = await rollbackPriceRecalc(projectId, version.id);
      notify(result.message || 'Цены возвращены', 'success');
      await onApplied();
      await Promise.all([loadPreview(), loadHistory()]);
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось откатить пересчёт'));
    } finally {
      setRollingId(null);
    }
  };

  const summary = preview?.summary;
  const catalogLabel = preview?.catalog.name ?? catalogName ?? 'Справочник';
  const catalogFromObject = preview?.catalog.source === 'object';

  return (
    <Modal open={open} onClose={onClose} disableRestoreFocus>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '96%', md: 920 },
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
        }}
      >
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0 }}>
          <Typography variant="h6">Пересчёт по справочнику</Typography>
          <Typography variant="body2" color="text.secondary">
            «{catalogLabel}»{catalogFromObject ? ' (справочник объекта)' : ''} —
            меняем только цены работ и материалов. Объёмы, фиксации и проценты
            не трогаем.
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, value: 'preview' | 'history') => setTab(value)}
            sx={{ mt: 1 }}
          >
            <Tab
              value="preview"
              label={`Превью${summary ? ` · ${summary.willUpdate}` : ''}`}
            />
            <Tab
              value="history"
              label={`История${versions.length ? ` · ${versions.length}` : ''}`}
            />
          </Tabs>
        </Box>
        <Divider />

        <Box sx={{ px: { xs: 2, md: 3 }, py: 2, overflowY: 'auto', flexGrow: 1 }}>
          {tab === 'preview' &&
            (loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : preview ? (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mb: 2 }}
                >
                  <Chip size="small" label={`Строк: ${preview.summary.rows}`} />
                  <Chip
                    size="small"
                    color="success"
                    label={`Обновится: ${preview.summary.willUpdate}`}
                  />
                  {preview.summary.withFacts > 0 && (
                    <Chip
                      size="small"
                      color="info"
                      label={`С фиксациями: ${preview.summary.withFacts}`}
                    />
                  )}
                  {preview.summary.notFound > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      label={`Нет в справочнике: ${preview.summary.notFound}`}
                    />
                  )}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Смета: ${money(preview.summary.planOld)} → ${money(
                      preview.summary.planNew,
                    )}`}
                  />
                  <Chip
                    size="small"
                    color={
                      preview.summary.delta === 0
                        ? 'default'
                        : preview.summary.delta > 0
                          ? 'error'
                          : 'success'
                    }
                    label={`Δ ${preview.summary.delta > 0 ? '+' : ''}${money(
                      preview.summary.delta,
                    )}`}
                  />
                </Stack>

                {preview.summary.willUpdate === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Менять нечего: цены уже совпадают со справочником либо во
                    всех строках есть фиксации.
                  </Alert>
                )}

                {isMobile ? (
                  <Stack spacing={1}>
                    {preview.rows.map((row) => (
                      <PreviewCard key={row.materialId} row={row} />
                    ))}
                  </Stack>
                ) : (
                  <PreviewTable rows={preview.rows} />
                )}
              </>
            ) : null)}

          {tab === 'history' && (
            <HistoryList
              versions={versions}
              loading={historyLoading}
              rollingId={rollingId}
              onRollback={(version) => {
                void handleRollback(version);
              }}
            />
          )}
        </Box>

        <Divider />
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 2,
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <Button onClick={onClose} disabled={applying || rollingId !== null}>
            Закрыть
          </Button>
          {tab === 'preview' && (
            <Button
              variant="contained"
              onClick={() => {
                void handleApply();
              }}
              disabled={
                !summary ||
                summary.willUpdate === 0 ||
                applying ||
                loading ||
                !!error
              }
              startIcon={
                applying ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              Пересчитать{summary ? ` ${summary.willUpdate}` : ''}
            </Button>
          )}
        </Box>
      </Paper>
    </Modal>
  );
};


/** Цена «было → станет» (или одна цена, если не меняется) */
const PriceCell: React.FC<{
  oldPrice: number;
  newPrice: number;
  changed: boolean;
  match: string;
  align?: 'left' | 'right';
}> = ({ oldPrice, newPrice, changed, match, align = 'right' }) => {
  const dash = oldPrice === 0 && newPrice === 0;
  if (!changed) {
    return (
      <Typography
        variant="body2"
        color={dash ? 'text.secondary' : 'text.primary'}
        sx={{ textAlign: align }}
      >
        {dash ? '—' : money(oldPrice)}
      </Typography>
    );
  }
  return (
    <Box sx={{ textAlign: align }}>
      <Typography
        variant="caption"
        sx={{ display: 'block', textDecoration: 'line-through', color: 'text.secondary' }}
      >
        {money(oldPrice)}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {money(newPrice)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {MATCH_LABELS[match] ?? ''}
      </Typography>
    </Box>
  );
};

const PreviewTable: React.FC<{ rows: PriceRecalcRow[] }> = ({ rows }) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Строка сметы</TableCell>
          <TableCell align="right">Кол-во</TableCell>
          <TableCell align="right">Работа, ₽</TableCell>
          <TableCell align="right">Материал, ₽</TableCell>
          <TableCell align="right">Смета, ₽</TableCell>
          <TableCell>Статус</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const meta = REASON_META[row.reason];
          return (
            <TableRow key={row.materialId} hover sx={{ opacity: row.hasFacts ? 0.7 : 1 }}>
              <TableCell sx={{ maxWidth: 280 }}>
                <Typography variant="body2" fontWeight={row.apply ? 700 : 500}>
                  {row.name}
                </Typography>
                {row.article && (
                  <Typography variant="caption" color="text.secondary">
                    арт. {row.article}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">
                  {row.specQuantity.toLocaleString('ru-RU')} {unitLabel(row.unit)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <PriceCell
                  oldPrice={row.work.oldPrice}
                  newPrice={row.work.newPrice}
                  changed={row.work.changed}
                  match={row.work.match}
                />
              </TableCell>
              <TableCell align="right">
                <PriceCell
                  oldPrice={row.material.oldPrice}
                  newPrice={row.material.newPrice}
                  changed={row.material.changed}
                  match={row.material.match}
                />
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="text.secondary">
                  {money(row.planOld)}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {money(row.planNew)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip size="small" color={meta.color} label={meta.label} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);


const PriceLine: React.FC<{
  label: string;
  side: PriceRecalcRow['work'];
}> = ({ label, side }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <PriceCell
      oldPrice={side.oldPrice}
      newPrice={side.newPrice}
      changed={side.changed}
      match={side.match}
    />
  </Box>
);

const PreviewCard: React.FC<{ row: PriceRecalcRow }> = ({ row }) => {
  const meta = REASON_META[row.reason];
  return (
    <Paper variant="outlined" sx={{ p: 1.5, opacity: row.hasFacts ? 0.75 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
          {row.name}
        </Typography>
        <Chip size="small" color={meta.color} label={meta.label} />
      </Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {row.specQuantity.toLocaleString('ru-RU')} {unitLabel(row.unit)}
        {row.article ? ` · арт. ${row.article}` : ''}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <PriceLine label="Работа" side={row.work} />
      <PriceLine label="Материал" side={row.material} />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          mt: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Смета по строке
        </Typography>
        <Typography variant="body2">
          <span style={{ color: 'gray', textDecoration: row.apply ? 'line-through' : 'none' }}>
            {money(row.planOld)}
          </span>
          {row.apply ? ` → ${money(row.planNew)}` : ''}
        </Typography>
      </Box>
    </Paper>
  );
};

const HistoryList: React.FC<{
  versions: PriceRecalcVersion[];
  loading: boolean;
  rollingId: number | null;
  onRollback: (version: PriceRecalcVersion) => void;
}> = ({ versions, loading, rollingId, onRollback }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (versions.length === 0) {
    return (
      <Alert severity="info">
        Пересчётов ещё не было. После первого пересчёта здесь появится версия,
        к которой можно откатиться.
      </Alert>
    );
  }
  return (
    <Stack spacing={1}>
      {versions.map((version) => {
        const title =
          version.action === 'price_recalc_rollback'
            ? `Откат · возвращено строк: ${version.restored ?? 0}`
            : `Пересчёт · обновлено строк: ${version.updated ?? 0}`;
        const actor =
          version.actor?.fullName || version.actor?.email || 'Пользователь';
        const plan =
          version.planOld != null && version.planNew != null
            ? ` · смета ${money(version.planOld)} → ${money(version.planNew)}`
            : '';
        return (
          <Paper key={version.id} variant="outlined" sx={{ p: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="body2" fontWeight={700}>
                  {formatDate(version.createdAt)} · {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {actor}
                  {version.catalogName ? ` · «${version.catalogName}»` : ''}
                  {plan}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={rollingId !== null}
                startIcon={
                  rollingId === version.id ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
                onClick={() => onRollback(version)}
              >
                Откатить
              </Button>
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
};

