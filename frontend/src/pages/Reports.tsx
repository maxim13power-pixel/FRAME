import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Modal, Stack, Fab,
  useMediaQuery, useTheme, CircularProgress, Alert, Chip, IconButton,
  MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, ToggleButton,
  ToggleButtonGroup, Menu,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import HistoryIcon from '@mui/icons-material/History';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { FAB_STYLE } from '../theme';
import {
  fetchReports, fetchReport, createReport, updateReport, deleteReport,
  addReportItem, updateReportItem, deleteReportItem, downloadReportExport,
} from '../services/reportsService';
import type { ReportData, ReportStatus, ReportType, ReportItemData } from '../services/reportsService';
import { fetchObjects } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import { fetchCategoriesWithItems } from '../services/priceListService';
import type { PriceItemData } from '../services/priceListService';
import { getApiErrorMessage } from '../utils/errors';
import { parseDecimal } from '../utils/decimal';
import { fetchAuditLog } from '../services/auditService';
import type { AuditLogEntry } from '../services/auditService';

const TYPE_LABELS: Record<ReportType, string> = { estimate: 'Смета', act: 'Акт' };
const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  approved: 'Утверждён',
  rejected: 'Отклонён',
};
const STATUS_COLORS: Record<ReportStatus, 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default',
  sent: 'primary',
  approved: 'success',
  rejected: 'error',
};
const STATUS_OPTIONS: ReportStatus[] = ['draft', 'sent', 'approved', 'rejected'];
const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  status_change: 'Смена статуса',
  price_change: 'Изменение цены',
};

const fmtMoney = (v: number | string) =>
  parseDecimal(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const Reports: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();

  // ─── Данные ───
  const [reports, setReports] = useState<ReportData[]>([]);
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ReportType>('all');
  const [objectFilter, setObjectFilter] = useState<number | ''>('');

  // ─── Вид: список / деталь ───
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // ─── Модалка создания ───
  const [createOpen, setCreateOpen] = useState(false);
  const [fType, setFType] = useState<ReportType>('estimate');
  const [fTitle, setFTitle] = useState('');
  const [fObjectId, setFObjectId] = useState<number | ''>('');
  const [fProjectId, setFProjectId] = useState<number | ''>('');
  const [fProjects, setFProjects] = useState<ProjectData[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Позиции ───
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemMode, setItemMode] = useState<'catalog' | 'manual'>('catalog');
  const [editingItem, setEditingItem] = useState<ReportItemData | null>(null);
  const [catalogItems, setCatalogItems] = useState<PriceItemData[]>([]);
  const [iMaterialId, setIMaterialId] = useState<number | ''>('');
  const [iName, setIName] = useState('');
  const [iUnit, setIUnit] = useState('шт');
  const [iQuantity, setIQuantity] = useState('');
  const [iPrice, setIPrice] = useState('');
  const [deletingItem, setDeletingItem] = useState<ReportItemData | null>(null);

  // ─── Статус (dropdown в детали) ───
  const [statusAnchorEl, setStatusAnchorEl] = useState<null | HTMLElement>(null);
  // ⭐ №131: история изменений (audit-log)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadObjects = useCallback(async () => {
    try {
      setObjects(await fetchObjects());
    } catch {
      /* объекты не критичны */
    }
  }, []);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: { objectId?: number; type?: ReportType } = {};
      if (objectFilter !== '') params.objectId = objectFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      setReports(await fetchReports(params));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить отчёты'));
    } finally {
      setLoading(false);
    }
  }, [token, objectFilter, typeFilter]);

  const loadCatalogItems = useCallback(async () => {
    try {
      const cats = await fetchCategoriesWithItems();
      setCatalogItems(cats.flatMap((c) => c.items || []));
    } catch {
      setCatalogItems([]);
    }
  }, []);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReports]);

  useEffect(() => {
    loadCatalogItems();
  }, [loadCatalogItems]);

  // ─── Создание отчёта ───
  const openCreate = () => {
    setFType('estimate');
    setFTitle('');
    setFObjectId(objectFilter);
    setFProjectId('');
    setFProjects([]);
    setFormError('');
    setCreateOpen(true);
  };

  const handleCreateObjectChange = async (oid: number | '') => {
    setFObjectId(oid);
    setFProjectId('');
    setFProjects([]);
    if (oid !== '') {
      try {
        setFProjects(await fetchProjectsByObject(oid));
      } catch {
        setFProjects([]);
      }
    }
  };

  const handleCreate = async () => {
    if (!fTitle.trim()) {
      setFormError('Введите название отчёта');
      return;
    }
    if (fObjectId === '') {
      setFormError('Выберите объект');
      return;
    }
    if (fProjectId === '') {
      setFormError('Выберите проект');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createReport({
        type: fType,
        title: fTitle.trim(),
        projectId: fProjectId,
        objectId: fObjectId,
      });
      setCreateOpen(false);
      loadReports();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось создать отчёт'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Деталь ───
  const openDetail = async (report: ReportData) => {
    try {
      setSelectedReport(await fetchReport(report.id));
      setView('detail');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось открыть отчёт'));
    }
  };

  const handleBack = useCallback(() => {
    if (viewRef.current === 'detail') {
      setView('list');
      setSelectedReport(null);
    } else {
      navigate(-1);
    }
  }, [navigate]);

  useMobileHeader({
    title: 'Отчёты',
    onBack: handleBack,
  });

  const handleChangeStatus = async (status: ReportStatus) => {
    setStatusAnchorEl(null);
    if (!selectedReport) return;
    try {
      const updated = await updateReport(selectedReport.id, { status });
      setSelectedReport(updated);
      loadReports();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось сменить статус'));
    }
  };

  // ⭐ №131: открыть историю изменений отчёта
  const openHistory = async () => {
    if (!selectedReport) return;
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryRecords([]);
    try {
      setHistoryRecords(await fetchAuditLog('report', selectedReport.id));
    } catch {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    try {
      await deleteReport(selectedReport.id);
      setSelectedReport(null);
      setView('list');
      loadReports();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить отчёт'));
    }
  };

  // ─── Позиции ───
  const openAddItem = () => {
    setEditingItem(null);
    setItemMode('catalog');
    setIMaterialId('');
    setIName('');
    setIUnit('шт');
    setIQuantity('');
    setIPrice('');
    setFormError('');
    setItemModalOpen(true);
  };

  const openEditItem = (item: ReportItemData) => {
    setEditingItem(item);
    setItemMode(item.materialId != null ? 'catalog' : 'manual');
    setIMaterialId(item.materialId ?? '');
    setIName(item.name);
    setIUnit(item.unit);
    setIQuantity(String(item.quantity));
    setIPrice(String(item.price));
    setFormError('');
    setItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!selectedReport) return;
    const qty = parseDecimal(iQuantity);
    if (qty <= 0) {
      setFormError('Укажите количество больше 0');
      return;
    }
    if (itemMode === 'manual' && !iName.trim()) {
      setFormError('Введите название позиции');
      return;
    }
    if (!editingItem && itemMode === 'catalog' && iMaterialId === '') {
      setFormError('Выберите позицию из справочника');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingItem) {
        await updateReportItem(selectedReport.id, editingItem.id, {
          name: iName.trim() || undefined,
          unit: iUnit,
          quantity: qty,
          price: itemMode === 'manual' ? parseDecimal(iPrice) : undefined,
        });
      } else if (itemMode === 'catalog') {
        await addReportItem(selectedReport.id, {
          materialId: iMaterialId as number,
          quantity: qty,
        });
      } else {
        await addReportItem(selectedReport.id, {
          name: iName.trim(),
          unit: iUnit,
          quantity: qty,
          price: parseDecimal(iPrice),
        });
      }
      setItemModalOpen(false);
      setSelectedReport(await fetchReport(selectedReport.id));
      loadReports();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось сохранить позицию'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedReport || !deletingItem) return;
    try {
      await deleteReportItem(selectedReport.id, deletingItem.id);
      setDeletingItem(null);
      setSelectedReport(await fetchReport(selectedReport.id));
      loadReports();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось удалить позицию'));
    }
  };

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    if (!selectedReport) return;
    try {
      await downloadReportExport(selectedReport.id, format);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось выгрузить файл'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {view === 'detail' && selectedReport ? (
        <>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <DescriptionIcon sx={{ color: '#1976d2' }} />
                <Typography variant="h5" sx={{ flexGrow: 1 }}>
                  {TYPE_LABELS[selectedReport.type]}: {selectedReport.title}
                </Typography>
                <Tooltip title="PDF">
                  <IconButton onClick={() => handleExport('pdf')} sx={{ bgcolor: 'action.hover' }}>
                    <PictureAsPdfIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="XLSX">
                  <IconButton onClick={() => handleExport('xlsx')} sx={{ bgcolor: 'action.hover' }}>
                    <TableChartIcon />
                  </IconButton>
                </Tooltip>
                <Chip
                  size="small"
                  color={STATUS_COLORS[selectedReport.status]}
                  label={STATUS_LABELS[selectedReport.status]}
                  onClick={(e) => setStatusAnchorEl(e.currentTarget)}
                  sx={{ cursor: 'pointer' }}
                />
                <Button size="small" startIcon={<HistoryIcon />} onClick={openHistory}>
                  История изменений
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {selectedReport.object?.name || '—'} • {selectedReport.project?.name || '—'} •{' '}
                {new Date(selectedReport.createdAt).toLocaleDateString('ru-RU')}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                Итого: {fmtMoney(selectedReport.totalAmount)} ₽
              </Typography>
            </Paper>

            <Menu
              anchorEl={statusAnchorEl}
              open={Boolean(statusAnchorEl)}
              onClose={() => setStatusAnchorEl(null)}
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} onClick={() => handleChangeStatus(s)}>
                  {STATUS_LABELS[s]}
                </MenuItem>
              ))}
            </Menu>

            {/* ⭐ №131: модалка истории изменений */}
            <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} disableRestoreFocus>
              <Paper sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: { xs: '90%', sm: 520 }, maxHeight: '80vh', overflow: 'auto',
                p: 4, borderRadius: 2,
              }}>
                <Typography variant="h6" gutterBottom>История изменений</Typography>
                {historyLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress /></Box>
                ) : historyRecords.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Изменений пока нет.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {historyRecords.map((r) => (
                      <Paper key={r.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={600}>
                            {ACTION_LABELS[r.action] || r.action}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(r.createdAt).toLocaleString('ru-RU')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {r.actor?.fullName || `#${r.actorId}`}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Modal>

            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Позиции</Typography>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddItem}>
                  Добавить позицию
                </Button>
              </Box>
              {selectedReport.items && selectedReport.items.length > 0 ? (
                isMobile ? (
                  <Stack spacing={1}>
                    {selectedReport.items.map((it) => (
                      <Paper key={it.id} sx={{ p: 1.5, borderRadius: 2 }} variant="outlined">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>{it.name}</Typography>
                          <IconButton size="small" onClick={() => openEditItem(it)} sx={{ bgcolor: 'action.hover' }}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setDeletingItem(it)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {fmtMoney(it.quantity)} {it.unit} × {fmtMoney(it.price)} ₽ = {fmtMoney(it.total)} ₽
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell align="center">Ед.</TableCell>
                          <TableCell align="right">Кол-во</TableCell>
                          <TableCell align="right">Цена</TableCell>
                          <TableCell align="right">Сумма</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedReport.items.map((it) => (
                          <TableRow key={it.id} hover>
                            <TableCell>{it.name}</TableCell>
                            <TableCell align="center">{it.unit}</TableCell>
                            <TableCell align="right">{fmtMoney(it.quantity)}</TableCell>
                            <TableCell align="right">{fmtMoney(it.price)} ₽</TableCell>
                            <TableCell align="right">{fmtMoney(it.total)} ₽</TableCell>
                            <TableCell align="center">
                              <IconButton size="small" onClick={() => openEditItem(it)} sx={{ bgcolor: 'action.hover' }}>
                                <SettingsIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => setDeletingItem(it)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              ) : (
                <Typography color="text.secondary">Позиций пока нет.</Typography>
              )}
            </Paper>

            <Button variant="outlined" color="error" onClick={handleDeleteReport}>
              Удалить отчёт
            </Button>
          </Stack>
        </>
      ) : (
        <>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                size="small"
                value={typeFilter}
                exclusive
                onChange={(_, v) => v != null && setTypeFilter(v)}
              >
                <ToggleButton value="all">Все</ToggleButton>
                <ToggleButton value="estimate">Сметы</ToggleButton>
                <ToggleButton value="act">Акты</ToggleButton>
              </ToggleButtonGroup>
              <FormControl size="small" sx={{ minWidth: 180, flexGrow: isMobile ? 1 : 0 }}>
                <InputLabel>Объект</InputLabel>
                <Select
                  value={objectFilter}
                  label="Объект"
                  onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <MenuItem value="">Все объекты</MenuItem>
                  {objects.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            {reports.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Отчётов пока нет. Создайте первую смету или акт.
                </Typography>
              </Paper>
            ) : isMobile ? (
              <Stack spacing={1}>
                {reports.map((r) => (
                  <Paper key={r.id} sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer' }} onClick={() => openDetail(r)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <DescriptionIcon sx={{ color: '#1976d2', fontSize: 22 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>{r.title}</Typography>
                      <Chip size="small" color={STATUS_COLORS[r.status]} label={STATUS_LABELS[r.status]} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {TYPE_LABELS[r.type]} • {r.project?.name || '—'} • {fmtMoney(r.totalAmount)} ₽ •{' '}
                      {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell>Проект</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Дата</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id} hover onClick={() => openDetail(r)} sx={{ cursor: 'pointer' }}>
                        <TableCell>{r.title}</TableCell>
                        <TableCell>{TYPE_LABELS[r.type]}</TableCell>
                        <TableCell>{r.project?.name || '—'}</TableCell>
                        <TableCell align="right">{fmtMoney(r.totalAmount)} ₽</TableCell>
                        <TableCell>
                          <Chip size="small" color={STATUS_COLORS[r.status]} label={STATUS_LABELS[r.status]} />
                        </TableCell>
                        <TableCell>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Новый отчёт</Typography>
          <Stack spacing={2}>
            <ToggleButtonGroup size="small" value={fType} exclusive onChange={(_, v) => v != null && setFType(v)} fullWidth>
              <ToggleButton value="estimate" sx={{ flex: 1 }}>Смета</ToggleButton>
              <ToggleButton value="act" sx={{ flex: 1 }}>Акт</ToggleButton>
            </ToggleButtonGroup>
            <TextField fullWidth label="Название" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            <FormControl fullWidth size="small">
              <InputLabel>Объект</InputLabel>
              <Select value={fObjectId} label="Объект" onChange={(e) => handleCreateObjectChange(e.target.value === '' ? '' : Number(e.target.value))}>
                <MenuItem value="">Выберите объект</MenuItem>
                {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Проект</InputLabel>
              <Select value={fProjectId} label="Проект" onChange={(e) => setFProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                <MenuItem value="">Выберите проект</MenuItem>
                {fProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleCreate} disabled={saving}>Создать</Button>
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={itemModalOpen} onClose={() => setItemModalOpen(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            {editingItem ? 'Редактировать позицию' : 'Добавить позицию'}
          </Typography>
          <Stack spacing={2}>
            <ToggleButtonGroup
              size="small"
              value={itemMode}
              exclusive
              onChange={(_, v) => v != null && setItemMode(v)}
              fullWidth
              disabled={!!editingItem}
            >
              <ToggleButton value="catalog" sx={{ flex: 1 }}>Из справочника</ToggleButton>
              <ToggleButton value="manual" sx={{ flex: 1 }}>Ручной ввод</ToggleButton>
            </ToggleButtonGroup>

            {itemMode === 'catalog' && !editingItem ? (
              <FormControl fullWidth size="small">
                <InputLabel>Позиция справочника</InputLabel>
                <Select value={iMaterialId} label="Позиция справочника" onChange={(e) => setIMaterialId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <MenuItem value="">Выберите позицию</MenuItem>
                  {catalogItems.map((pi) => (
                    <MenuItem key={pi.id} value={pi.id}>
                      {pi.name} — {fmtMoney(pi.price)} ₽
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <>
                <TextField fullWidth label="Название" value={iName} onChange={(e) => setIName(e.target.value)} />
                <Stack direction="row" spacing={2}>
                  <TextField fullWidth label="Ед. изм." value={iUnit} onChange={(e) => setIUnit(e.target.value)} />
                  <TextField fullWidth label="Цена, ₽" type="number" value={iPrice} onChange={(e) => setIPrice(e.target.value)} />
                </Stack>
              </>
            )}

            {editingItem && itemMode === 'catalog' && (
              <Typography variant="body2" color="text.secondary">
                Позиция: {editingItem.name} ({editingItem.unit}) — цена из справочника.
              </Typography>
            )}

            <TextField fullWidth label="Количество" type="number" value={iQuantity} onChange={(e) => setIQuantity(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setItemModalOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleSaveItem} disabled={saving}>Сохранить</Button>
              {editingItem && (
                <IconButton color="error" aria-label="Удалить позицию" onClick={() => { setItemModalOpen(false); setDeletingItem(editingItem); }}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={!!deletingItem} onClose={() => setDeletingItem(null)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 360 }, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Удалить позицию</Typography>
          <Typography sx={{ mb: 2 }}>Удалить «{deletingItem?.name}» из отчёта?</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingItem(null)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteItem}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      {isMobile && (
        <Fab color="primary" sx={{ ...FAB_STYLE, bottom: 80 }} onClick={openCreate}>
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}

export default Reports;