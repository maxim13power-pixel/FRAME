import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, InputAdornment, Button, Modal, Stack,
  Fab, useMediaQuery, useTheme, CircularProgress, Alert, Chip, IconButton,
  Menu, MenuItem, Select, FormControl, InputLabel, Tooltip, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import InventoryIcon from '@mui/icons-material/Inventory';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов
import { FAB_STYLE } from '../theme';
import {
  fetchWarehouseItems, fetchWarehouseItem, fetchWarehousePermissions,
  createWarehouseItem, updateWarehouseItem, deleteWarehouseItem,
  createWarehouseTransaction,
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
  // ⭐ №205: права записи в склад (наблюдатель — только чтение)
  const [canWrite, setCanWrite] = useState(true);
  const [editItem, setEditItem] = useState<WarehouseItemData | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItemData | null>(null);
  // ⭐ №196: шестерёнка на карточке — все действия в одном шите (как в «Объектах»)
  const [actionsItem, setActionsItem] = useState<WarehouseItemData | null>(null);
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

  // ⭐ №205: наблюдатель видит склад, но писать не может — кнопки гаснут заранее
  useEffect(() => {
    if (!token) return;
    fetchWarehousePermissions()
      .then((p) => setCanWrite(p.canWrite !== false))
      .catch(() => setCanWrite(false));
  }, [token]);

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

  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);

  const headerTrailing = useMemo(() => isMobile ? (
    <IconButton
      onClick={(e) => setFilterAnchorEl(e.currentTarget)}
      sx={{
        bgcolor: objectFilter ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
        color: objectFilter ? '#1976d2' : '#424242',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
      }}
    >
      <FilterAltIcon />
    </IconButton>
  ) : undefined, [isMobile, objectFilter]);

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
    trailing: headerTrailing,
  });

  // ⭐ Генератор XLSX грузим только при клике (ленивый чанк), оформление — общее со «Сметами»
  const handleExport = async () => {
    const { exportWarehouseXlsx } = await import('../utils/exportWarehouse');
    exportWarehouseXlsx(items);
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
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/')}
            sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
            aria-label="В главное меню"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>Склад</Typography>
        </Box>
      )}
      <Menu anchorEl={filterAnchorEl} open={Boolean(filterAnchorEl)} onClose={() => setFilterAnchorEl(null)}>
        <MenuItem onClick={() => { setObjectFilter(''); setFilterAnchorEl(null); }}>Все объекты</MenuItem>
        {objects.map((o) => (
          <MenuItem key={o.id} onClick={() => { setObjectFilter(o.id); setFilterAnchorEl(null); }}>{o.name}</MenuItem>
        ))}
      </Menu>
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
              {/* ⭐ №205: наблюдателю доступно только чтение */}
              <Button variant="contained" startIcon={<AddIcon />} disabled={!canWrite} onClick={() => openTx('income', selectedItem)}>
                Приход
              </Button>
              <Button variant="outlined" disabled={!canWrite} onClick={() => openTx('expense', selectedItem)}>
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
            {/* ⭐ №197: одноразовая подсказка раздела */}
            <SectionIntro id="warehouse" version={1}>
              <b>Склад</b> — позиции объекта и общий склад. Приход и списание меняют остаток,
              каждая операция остаётся в истории. Шестерёнка ⚙ на карточке — все действия.
            </SectionIntro>
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                {objects.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Объект</InputLabel>
                    <Select
                      value={objectFilter}
                      label="Объект"
                      onChange={(e) => setObjectFilter(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <MenuItem value=""><em>Все объекты</em></MenuItem>
                      {objects.map((o) => (
                        <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!canWrite} sx={{ bgcolor: '#4caf50', border: '2px solid #388e3c', '&:hover': { bgcolor: '#388e3c', borderColor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }, transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}>
                  Добавить
                </Button>
                <Tooltip title="Excel">
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={handleExport}
                    sx={{ minWidth: 0, px: 1.5, py: 1, transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' } }}
                  >
                    <FileDownloadIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {/* ⭐ №205: наблюдатель — только чтение (кнопки погашены, причина видна) */}
            {!canWrite && (
              <Alert severity="info" icon={false}>
                👁 Изменения недоступны: у вас роль наблюдателя. Склад можно смотреть, но не менять.
              </Alert>
            )}

            {items.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Склад пуст. Нажмите + чтобы добавить первую позицию.
                </Typography>
              </Paper>
            ) : (
              // ⭐ №196: карточки как в «Объектах»/«Проектах» — на всех разрешениях
              <Stack spacing={isMobile ? 1 : 2}>
                {items.map((item) => (
                  <Paper
                    key={item.id}
                    elevation={2}
                    sx={{
                      p: isMobile ? 1.5 : 3,
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'box-shadow 0.3s, transform 0.3s',
                      '&:hover': { boxShadow: 6, transform: 'scale(1.01)' },
                    }}
                    onClick={() => openDetail(item)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                      <InventoryIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28, mt: 0.25 }} />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          flexGrow: 1,
                          minWidth: 0,
                          fontSize: { xs: '1.05rem', md: '1.15rem' },
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.name}
                      </Typography>
                      <IconButton
                        title="Действия с позицией"
                        aria-label="Действия с позицией"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsItem(item);
                        }}
                        sx={{ bgcolor: 'action.hover', width: 44, height: 44, ml: 0.5, mt: -0.5 }}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                      {item.category && (
                        <Chip size="small" variant="outlined" label={item.category} />
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.object ? 'primary' : 'default'}
                        label={item.object ? item.object.name : 'общий склад'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Остаток: {fmtQty(item.quantity)} {item.unit}
                      {item.price != null ? ` · ${fmtMoney(item.price)} ₽` : ''}
                      {item.price != null
                        ? ` · сумма ${fmtMoney(parseDecimal(item.price) * parseDecimal(item.quantity))} ₽`
                        : ''}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}

            {items.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                Итого по складу: {fmtMoney(totalValue)} ₽
              </Typography>
            )}
          </Stack>
        </>
      )}

      {/* ⭐ №196: действия с позицией — шит как в «Объектах»/«Проектах» */}
      <Modal open={!!actionsItem} onClose={() => setActionsItem(null)}>
        <Paper
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: { xs: 0, sm: 'auto' },
            top: { xs: 'auto', sm: '50%' },
            transform: { xs: 'translateX(-50%)', sm: 'translate(-50%, -50%)' },
            width: { xs: '100%', sm: 420 },
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 3,
            pb: { xs: 4, sm: 3 },
            borderRadius: { xs: '16px 16px 0 0', sm: 3 },
            outline: 'none',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ mb: 0.5 }}>
            {actionsItem?.name || 'Позиция'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Действия со складской позицией. Операции меняют остаток.
          </Typography>
          {actionsItem && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                size="small"
                variant="outlined"
                label={`остаток: ${fmtQty(actionsItem.quantity)} ${actionsItem.unit}`}
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
              {actionsItem.category && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={actionsItem.category}
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              )}
              <Chip
                size="small"
                variant="outlined"
                color={actionsItem.object ? 'primary' : 'default'}
                label={actionsItem.object ? actionsItem.object.name : 'общий склад'}
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
            </Box>
          )}

          <Stack spacing={1}>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<InventoryIcon />}
              onClick={() => {
                const it = actionsItem;
                setActionsItem(null);
                if (it) void openDetail(it);
              }}
            >
              Открыть позицию
            </Button>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<SettingsIcon />}
              disabled={!canWrite}
              onClick={() => {
                const it = actionsItem;
                setActionsItem(null);
                if (it) openEdit(it);
              }}
            >
              Редактировать
            </Button>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!canWrite}
              onClick={() => {
                const it = actionsItem;
                setActionsItem(null);
                if (it) void openTx('income', it);
              }}
            >
              Приход
            </Button>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!canWrite}
              onClick={() => {
                const it = actionsItem;
                setActionsItem(null);
                if (it) void openTx('expense', it);
              }}
            >
              Списать на проект
            </Button>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={!canWrite}
              onClick={() => {
                const it = actionsItem;
                setActionsItem(null);
                if (it) setDeletingItem(it);
              }}
            >
              Удалить позицию
            </Button>
            {!canWrite && (
              <Typography variant="caption" color="text.secondary">
                Наблюдатель видит склад, но не может менять остатки и позиции.
              </Typography>
            )}
          </Stack>
        </Paper>
      </Modal>

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

      {isMobile && canWrite && (
        <Fab color="primary" sx={{ ...FAB_STYLE, bottom: 80 }} onClick={openCreate}>
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}

export default Warehouse;