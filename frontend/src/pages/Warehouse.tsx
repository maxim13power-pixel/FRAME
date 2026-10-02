import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, InputAdornment, Button, Modal, Stack,
  Fab, useMediaQuery, useTheme, CircularProgress, Alert, Chip, IconButton,
  MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import InventoryIcon from '@mui/icons-material/Inventory';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { FAB_STYLE } from '../theme';
import {
  fetchWarehouseItems, fetchWarehouseItem, createWarehouseItem,
  updateWarehouseItem, deleteWarehouseItem, createWarehouseTransaction,
} from '../services/warehouseService';
import type { WarehouseItemData, WarehouseTransactionType } from '../services/warehouseService';
import { fetchObjects } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import { getApiErrorMessage } from '../utils/errors';
import { parseDecimal } from '../utils/decimal';

const UNIT_OPTIONS = ['шт', 'м', 'м²', 'м³', 'кг', 'л', 'т', 'мешок', 'упак', 'компл'];
const CATEGORY_OPTIONS = ['инструмент', 'расходник', 'оборудование'];

const fmtQty = (v: number | string) => parseDecimal(v).toLocaleString('ru-RU');
const fmtMoney = (v: number | null | undefined) =>
  v == null ? '—' : parseDecimal(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const Warehouse: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();

  const [items, setItems] = useState<WarehouseItemData[]>([]);
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [objectFilter, setObjectFilter] = useState<number | ''>('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedItem, setSelectedItem] = useState<WarehouseItemData | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<WarehouseItemData | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItemData | null>(null);
  const [txMode, setTxMode] = useState<WarehouseTransactionType | null>(null);
  const [txItem, setTxItem] = useState<WarehouseItemData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [fName, setFName] = useState('');
  const [fUnit, setFUnit] = useState('шт');
  const [fCategory, setFCategory] = useState('');
  const [fQuantity, setFQuantity] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fComment, setFComment] = useState('');
  const [fObjectId, setFObjectId] = useState<number | ''>('');

  const [txQuantity, setTxQuantity] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txComment, setTxComment] = useState('');
  const [txProjectId, setTxProjectId] = useState<number | ''>('');
  const [txObjectId, setTxObjectId] = useState<number | ''>('');
  const [txProjects, setTxProjects] = useState<ProjectData[]>([]);

  const loadObjects = useCallback(async () => {
    try {
      setObjects(await fetchObjects());
    } catch {
      /* объекты не критичны */
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: { objectId?: number; search?: string } = {};
      if (objectFilter !== '') params.objectId = objectFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      setItems(await fetchWarehouseItems(params));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить склад'));
    } finally {
      setLoading(false);
    }
  }, [token, objectFilter, searchQuery]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadItems]);

  const loadTxProjects = async (objectId: number) => {
    try {
      setTxProjects(await fetchProjectsByObject(objectId));
    } catch {
      setTxProjects([]);
    }
  };

  const openTx = useCallback(async (mode: WarehouseTransactionType, item: WarehouseItemData) => {
    setTxMode(mode);
    setTxItem(item);
    setTxQuantity('');
    setTxPrice('');
    setTxComment('');
    setTxProjectId('');
    setTxObjectId(item.objectId ?? '');
    setTxProjects([]);
    setFormError('');
    if (mode !== 'income' && item.objectId != null) {
      await loadTxProjects(item.objectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeTx = () => {
    setTxMode(null);
    setTxItem(null);
  };

  const resetCreateForm = () => {
    setFName('');
    setFUnit('шт');
    setFCategory('');
    setFQuantity('');
    setFPrice('');
    setFComment('');
    setFObjectId(objectFilter);
    setFormError('');
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!fName.trim()) {
      setFormError('Введите название позиции');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createWarehouseItem({
        name: fName.trim(),
        unit: fUnit,
        category: fCategory || undefined,
        quantity: fQuantity === '' ? undefined : parseDecimal(fQuantity),
        price: fPrice === '' ? undefined : parseDecimal(fPrice),
        comment: fComment || undefined,
        objectId: fObjectId === '' ? undefined : fObjectId,
      });
      setCreateOpen(false);
      loadItems();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось создать позицию'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: WarehouseItemData) => {
    setEditItem(item);
    setFName(item.name);
    setFUnit(item.unit);
    setFCategory(item.category || '');
    setFComment(item.comment || '');
    setFormError('');
  };

  const handleUpdate = async () => {
    if (!editItem || !fName.trim()) {
      setFormError('Введите название позиции');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updateWarehouseItem(editItem.id, {
        name: fName.trim(),
        unit: fUnit,
        category: fCategory || undefined,
        comment: fComment || undefined,
      });
      setEditItem(null);
      loadItems();
      if (selectedItem?.id === editItem.id) {
        setSelectedItem(await fetchWarehouseItem(editItem.id));
      }
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteWarehouseItem(deletingItem.id);
      setDeletingItem(null);
      if (selectedItem?.id === deletingItem.id) {
        setSelectedItem(null);
        setView('list');
      }
      loadItems();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось удалить'));
    }
  };

  const handleTx = async () => {
    if (!txItem || !txMode) return;
    const qty = parseDecimal(txQuantity);
    if (qty <= 0) {
      setFormError('Укажите количество больше 0');
      return;
    }
    if (txMode !== 'income' && txProjectId === '') {
      setFormError('Выберите проект для списания');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createWarehouseTransaction({
        warehouseItemId: txItem.id,
        type: txMode,
        quantity: qty,
        price: txPrice === '' ? undefined : parseDecimal(txPrice),
        projectId: txMode === 'income' ? undefined : txProjectId === '' ? undefined : txProjectId,
        comment: txComment || undefined,
      });
      closeTx();
      if (selectedItem) {
        setSelectedItem(await fetchWarehouseItem(selectedItem.id));
      }
      loadItems();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Не удалось провести операцию'));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (item: WarehouseItemData) => {
    try {
      setSelectedItem(await fetchWarehouseItem(item.id));
      setView('detail');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось открыть позицию'));
    }
  };

  const handleBack = useCallback(() => {
    if (viewRef.current === 'detail') {
      setView('list');
      setSelectedItem(null);
    } else {
      navigate(-1);
    }
  }, [navigate]);

  useMobileHeader({
    title: 'Склад',
    onBack: handleBack,
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: 'Поиск по складу...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => {
      setSearchQuery('');
      setMobileSearchOpen(false);
    },
    onSearchChange: (v) => setSearchQuery(v),
  });

  const handleExport = () => {
    const aoa: (string | number)[][] = [
      ['Название', 'Категория', 'Остаток', 'Ед.', 'Цена', 'Сумма', 'Объект'],
      ...items.map((i) => [
        i.name,
        i.category || '',
        i.quantity,
        i.unit,
        i.price ?? '',
        i.price != null ? i.price * i.quantity : '',
        i.object?.name || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Склад');
    XLSX.writeFile(wb, 'sklad.xlsx');
  };

  const totalValue = useMemo(
    () => items.reduce((s, i) => s + (i.price != null ? i.price * i.quantity : 0), 0),
    [items],
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {view === 'detail' && selectedItem ? (
        <>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <InventoryIcon sx={{ color: '#1976d2' }} />
                <Typography variant="h5" sx={{ flexGrow: 1 }}>{selectedItem.name}</Typography>
                {selectedItem.category && <Chip size="small" label={selectedItem.category} />}
                <IconButton size="small" onClick={() => openEdit(selectedItem)} sx={{ bgcolor: 'action.hover' }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Остаток: {fmtQty(selectedItem.quantity)} {selectedItem.unit}
                {selectedItem.price != null ? ` • Цена: ${fmtMoney(selectedItem.price)} ₽` : ''}
                {selectedItem.object ? ` • Объект: ${selectedItem.object.name}` : ' • Общий склад'}
              </Typography>
              {selectedItem.comment && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedItem.comment}
                </Typography>
              )}
            </Paper>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openTx('income', selectedItem)}>
                Приход
              </Button>
              <Button variant="outlined" onClick={() => openTx('expense', selectedItem)}>
                Списать на проект
              </Button>
            </Stack>

            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>История операций</Typography>
              {selectedItem.transactions && selectedItem.transactions.length > 0 ? (
                <Stack divider={<Divider />} spacing={1}>
                  {selectedItem.transactions.map((t) => (
                    <Box key={t.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {t.type === 'income' ? 'Приход' : t.type === 'expense' ? 'Расход' : 'Списание'}
                          {' • '}{fmtQty(t.quantity)} {selectedItem.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(t.createdAt).toLocaleString('ru-RU')}
                          {t.project ? ` • ${t.project.name}` : ''}
                        </Typography>
                      </Box>
                      {t.price != null && (
                        <Typography variant="body2">{fmtMoney(t.price)} ₽</Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">Операций пока нет.</Typography>
              )}
            </Paper>
          </Stack>
        </>
      ) : (
        <>
          <Stack spacing={2}>
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Поиск по складу..."
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
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
                <Tooltip title="Excel">
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={handleExport}
                    sx={{ minWidth: 0, p: 1 }}
                  >
                    <FileDownloadIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </Box>
            )}

            {isMobile && (
              <FormControl size="small" fullWidth>
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
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {items.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Склад пуст. Нажмите + чтобы добавить первую позицию.
                </Typography>
              </Paper>
            ) : isMobile ? (
              <Stack spacing={1}>
                {items.map((item) => (
                  <Paper key={item.id} sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer' }} onClick={() => openDetail(item)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <InventoryIcon sx={{ color: '#1976d2', fontSize: 22 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>{item.name}</Typography>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(item); }} sx={{ bgcolor: 'action.hover' }}>
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Остаток: {fmtQty(item.quantity)} {item.unit}
                      {item.price != null ? ` • ${fmtMoney(item.price)} ₽` : ''}
                      {item.object ? ` • ${item.object.name}` : ''}
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
                      <TableCell>Категория</TableCell>
                      <TableCell align="right">Остаток</TableCell>
                      <TableCell align="right">Цена</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell align="center"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} hover onClick={() => openDetail(item)} sx={{ cursor: 'pointer' }}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category || '—'}</TableCell>
                        <TableCell align="right">{fmtQty(item.quantity)} {item.unit}</TableCell>
                        <TableCell align="right">{item.price != null ? `${fmtMoney(item.price)} ₽` : '—'}</TableCell>
                        <TableCell align="right">{item.price != null ? `${fmtMoney(item.price * item.quantity)} ₽` : '—'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(item); }} sx={{ bgcolor: 'action.hover' }}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {items.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                Итого по складу: {fmtMoney(totalValue)} ₽
              </Typography>
            )}
          </Stack>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>Новая позиция</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="Название" value={fName} onChange={(e) => setFName(e.target.value)} required />
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Ед. изм.</InputLabel>
                <Select value={fUnit} label="Ед. изм." onChange={(e) => setFUnit(e.target.value)}>
                  {UNIT_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Категория</InputLabel>
                <Select value={fCategory} label="Категория" onChange={(e) => setFCategory(e.target.value)}>
                  <MenuItem value="">Без категории</MenuItem>
                  {CATEGORY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField fullWidth label="Количество" type="number" value={fQuantity} onChange={(e) => setFQuantity(e.target.value)} />
              <TextField fullWidth label="Цена, ₽" type="number" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>Объект</InputLabel>
              <Select value={fObjectId} label="Объект" onChange={(e) => setFObjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                <MenuItem value="">Без объекта (общий склад)</MenuItem>
                {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Комментарий" multiline rows={2} value={fComment} onChange={(e) => setFComment(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button variant="contained" onClick={handleCreate} disabled={saving}>Сохранить</Button>
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 460 }, maxWidth: 460, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Редактировать позицию</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="Название" value={fName} onChange={(e) => setFName(e.target.value)} required />
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Ед. изм.</InputLabel>
                <Select value={fUnit} label="Ед. изм." onChange={(e) => setFUnit(e.target.value)}>
                  {UNIT_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Категория</InputLabel>
                <Select value={fCategory} label="Категория" onChange={(e) => setFCategory(e.target.value)}>
                  <MenuItem value="">Без категории</MenuItem>
                  {CATEGORY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <TextField fullWidth label="Комментарий" multiline rows={2} value={fComment} onChange={(e) => setFComment(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={() => setEditItem(null)}>Отмена</Button>
              <Button variant="contained" onClick={handleUpdate} disabled={saving}>Сохранить</Button>
              <IconButton color="error" aria-label="Удалить позицию" onClick={() => { setDeletingItem(editItem); setEditItem(null); }}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={!!deletingItem} onClose={() => setDeletingItem(null)}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 360 }, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>Удалить позицию</Typography>
          <Typography sx={{ mb: 2 }}>Удалить «{deletingItem?.name}»? Все операции будут удалены. Это необратимо.</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setDeletingItem(null)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>Удалить</Button>
          </Stack>
        </Paper>
      </Modal>

      <Modal open={!!txMode} onClose={closeTx}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 420 }, maxWidth: 420, p: 3, borderRadius: 2, outline: 'none' }}>
          <Typography variant="h6" gutterBottom>
            {txMode === 'income' ? 'Приход' : 'Списание'} — {txItem?.name}
          </Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="Количество" type="number" value={txQuantity} onChange={(e) => setTxQuantity(e.target.value)} />
            {txMode === 'income' && (
              <TextField fullWidth label="Цена, ₽" type="number" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} />
            )}
            {txMode !== 'income' && txItem?.objectId == null && (
              <FormControl fullWidth size="small">
                <InputLabel>Объект</InputLabel>
                <Select
                  value={txObjectId}
                  label="Объект"
                  onChange={(e) => {
                    const oid = e.target.value === '' ? '' : Number(e.target.value);
                    setTxObjectId(oid);
                    setTxProjectId('');
                    if (oid !== '') loadTxProjects(oid);
                    else setTxProjects([]);
                  }}
                >
                  <MenuItem value="">Выберите объект</MenuItem>
                  {objects.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {txMode !== 'income' && (
              <FormControl fullWidth size="small">
                <InputLabel>Проект</InputLabel>
                <Select value={txProjectId} label="Проект" onChange={(e) => setTxProjectId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <MenuItem value="">Выберите проект</MenuItem>
                  {txProjects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <TextField fullWidth label="Комментарий" multiline rows={2} value={txComment} onChange={(e) => setTxComment(e.target.value)} />
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="outlined" onClick={closeTx}>Отмена</Button>
              <Button variant="contained" onClick={handleTx} disabled={saving}>Провести</Button>
            </Stack>
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

export default Warehouse;