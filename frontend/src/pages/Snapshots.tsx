// frontend/src/pages/Snapshots.tsx
// ⭐ №194 (F1 шаг 2): «Снимки доступа» — личные копии данных объекта,
// снятые в момент отзыва доступа. Только чтение: правки здесь невозможны,
// цены показываются, если они были видны участнику на момент отзыва.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HistoryIcon from '@mui/icons-material/History';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import SectionIntro from '../components/SectionIntro';
import { fetchSnapshot, fetchSnapshots } from '../services/snapshotService';
import type { SnapshotDetail, SnapshotRow } from '../services/snapshotService';
import { getApiErrorMessage } from '../utils/errors';
import { money, unitLabel } from '../utils/exportShared';

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: '👑 администратор объекта',
  FOREMAN: '👷 прораб',
  VIEWER: '👁 наблюдатель',
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
};

const rub = (v: number | null | undefined) => (v == null ? '—' : `${money(v)} ₽`);

const qtyText = (v: number | null | undefined) =>
  v == null ? '—' : Number(v.toFixed(3)).toLocaleString('ru-RU');

/** Короткая строка «что внутри копии» для карточки списка */
const summaryLine = (row: SnapshotRow) => {
  const parts: string[] = [];
  if (row.summary.projects) parts.push(`проектов: ${row.summary.projects}`);
  if (row.summary.materials) parts.push(`позиций сметы: ${row.summary.materials}`);
  if (row.summary.reports) parts.push(`актов: ${row.summary.reports}`);
  if (row.summary.warehouseItems) parts.push(`склад: ${row.summary.warehouseItems}`);
  if (row.summary.brigades) parts.push(`бригад: ${row.summary.brigades}`);
  return parts.join(' · ') || 'данных не было';
};

const Snapshots: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useMobileHeader({
    title: detail ? 'Снимок доступа' : 'Снимки доступа',
    onBack: () => (detail ? setDetail(null) : navigate('/settings')),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await fetchSnapshots());
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить снимки'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (row: SnapshotRow) => {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await fetchSnapshot(row.id));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Не удалось открыть снимок'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => (detail ? setDetail(null) : navigate('/settings'))}
            aria-label={detail ? 'К списку снимков' : 'Назад в настройки'}
            sx={{
              mr: 1,
              bgcolor: 'rgba(0,0,0,0.06)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            {detail ? 'Снимок доступа' : 'Снимки доступа'}
          </Typography>
        </Box>
      )}

      {!detail && (
        <SectionIntro id="snapshots" version={1}>
          Копии данных объектов, доступ к которым вам отозвали. Снимок делается
          автоматически в момент отзыва и не меняется — это «как было», даже если
          объект с тех пор изменился.
        </SectionIntro>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            !detail ? (
              <Button color="inherit" size="small" onClick={load}>
                Повторить
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}


      {detailLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : detail ? (
        <SnapshotView data={detail} />
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <HistoryIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">
            Снимков пока нет. Они появляются, когда администратор объекта отзывает доступ —
            вам остаётся копия сметы, актов, склада и бригад.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((row) => (
            <Paper
              key={row.id}
              onClick={() => openDetail(row)}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: '#eef4fd' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                  🔒 {row.objectName}
                </Typography>
                <Chip size="small" label={fmtDate(row.takenAt)} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {row.projectName ? `📁 ${row.projectName}` : '🏗 весь объект'}
                {' · '}
                {ROLE_LABELS[row.role] ?? row.role}
                {row.hidePrices ? ' · 🙈 без цен' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summaryLine(row)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

/** Детальный просмотр одной копии: сметы, акты, склад, бригады — только чтение */
const SnapshotView: React.FC<{ data: SnapshotDetail }> = ({ data }) => {
  const p = data.payload;
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          🔒 {p.object.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {p.object.address}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Снимок на {fmtDate(p.takenAt)} ·{' '}
          {data.projectName ? `проект «${data.projectName}»` : 'весь объект'} ·{' '}
          {ROLE_LABELS[data.role] ?? data.role}
        </Typography>
        {data.hidePrices && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            На момент отзыва цены вам были недоступны — в копии сохранены только объёмы.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          📋 Смета
        </Typography>
        {p.projects.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Проектов на момент отзыва не было.
          </Typography>
        ) : (
          p.projects.map((project) => (
            <Box key={project.id} sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                📁 {project.name}
              </Typography>
              {project.materials.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Позиций нет
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Позиция</TableCell>
                        <TableCell>Ед.</TableCell>
                        <TableCell align="right">План</TableCell>
                        <TableCell align="right">Факт</TableCell>
                        {!data.hidePrices && <TableCell align="right">Цена работы</TableCell>}
                        {!data.hidePrices && (
                          <TableCell align="right">Цена материала</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {project.materials.map((m, idx) => (
                        <TableRow key={`${project.id}-${idx}`}>
                          <TableCell>{m.name}</TableCell>
                          <TableCell>{unitLabel(m.unit)}</TableCell>
                          <TableCell align="right">{qtyText(m.specQuantity)}</TableCell>
                          <TableCell align="right">{qtyText(m.totalUsed)}</TableCell>
                          {!data.hidePrices && (
                            <TableCell align="right">{rub(m.unitPrice)}</TableCell>
                          )}
                          {!data.hidePrices && (
                            <TableCell align="right">{rub(m.materialUnitPrice)}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          ))
        )}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          📄 Акты и отчёты
        </Typography>
        {p.reports.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Актов на момент отзыва не было.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {p.reports.map((r) => (
              <Box key={r.id}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                    {r.type === 'act' ? 'Акт' : 'Смета'}: {r.title}
                  </Typography>
                  {!data.hidePrices && (
                    <Typography variant="body2" color="text.secondary">
                      {rub(r.totalAmount)}
                    </Typography>
                  )}
                </Box>
                {r.items.length > 0 && (
                  <Table size="small">
                    <TableBody>
                      {r.items.map((i, idx) => (
                        <TableRow key={`${r.id}-${idx}`}>
                          <TableCell>{i.name}</TableCell>
                          <TableCell align="right">
                            {qtyText(i.quantity)} {i.unit}
                          </TableCell>
                          {!data.hidePrices && (
                            <TableCell align="right">{rub(i.total)}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <Divider sx={{ mt: 1 }} />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          📦 Склад
        </Typography>
        {p.warehouse.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Позиций склада на момент отзыва не было.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Позиция</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell align="right">Остаток</TableCell>
                  {!data.hidePrices && <TableCell align="right">Цена</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {p.warehouse.items.map((i, idx) => (
                  <TableRow key={`w-${idx}`}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell>{i.category ?? '—'}</TableCell>
                    <TableCell align="right">
                      {qtyText(i.quantity)} {i.unit}
                    </TableCell>
                    {!data.hidePrices && <TableCell align="right">{rub(i.price)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {p.warehouse.transactions.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Операций по складу: {p.warehouse.transactions.length}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          👷 Бригады
        </Typography>
        {p.brigades.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Бригад на момент отзыва не было.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {p.brigades.map((b, idx) => (
              <Box key={`b-${idx}`}>
                <Typography variant="body2" fontWeight={600}>
                  {b.name}
                  {b.specialty ? ` · ${b.specialty}` : ''}
                  {b.foremanName ? ` · бригадир: ${b.foremanName}` : ''}
                </Typography>
                {b.members.length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Состав: {b.members.map((m) => m.fullName).join(', ')}
                  </Typography>
                )}
                {b.shifts.length > 0 && (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Дата</TableCell>
                        <TableCell>Проект</TableCell>
                        <TableCell align="right">Часы</TableCell>
                        <TableCell>Кто выходил</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {b.shifts.map((s, sIdx) => (
                        <TableRow key={`s-${idx}-${sIdx}`}>
                          <TableCell>{fmtDate(s.date)}</TableCell>
                          <TableCell>{s.projectName ?? '—'}</TableCell>
                          <TableCell align="right">{qtyText(s.hoursWorked)}</TableCell>
                          <TableCell>
                            {s.members.length > 0
                              ? s.members
                                  .map((m) => `${m.fullName} (${qtyText(m.hours)} ч)`)
                                  .join(', ')
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {idx < p.brigades.length - 1 && <Divider sx={{ mt: 1.5 }} />}
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Снимок неизменяем: данные в нём не обновляются, живой объект вам больше не доступен.
      </Typography>
    </Stack>
  );
};

export default Snapshots;

