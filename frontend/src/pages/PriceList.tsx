import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Modal,
  TextField,
  Fab,
  useMediaQuery,
  useTheme,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Collapse,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CategoryIcon from '@mui/icons-material/Category';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCategoriesWithItems,
  createCategory,
  createPriceItem,
  updatePriceItem,
  deletePriceItem,
} from '../services/priceListService';
import type { PriceCategoryData, PriceItemData } from '../services/priceListService';

// Единицы измерения — точно как в Materials.tsx (единообразие)
const UNIT_OPTIONS = [
  { value: 'PIECE', label: 'шт' },
  { value: 'METER', label: 'м' },
  { value: 'SQUARE_METER', label: 'м²' },
  { value: 'CUBIC_METER', label: 'м³' },
  { value: 'KILOGRAM', label: 'кг' },
  { value: 'LITER', label: 'л' },
  { value: 'TON', label: 'т' },
  { value: 'BAG', label: 'мешок' },
  { value: 'PACKAGE', label: 'упак' },
  { value: 'SET', label: 'компл' },
];

// ⭐ Служебное значение для селекта: "создать новую категорию прямо отсюда"
const NEW_CATEGORY_VALUE = '__new__';

const PriceList: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();

  // Основные данные
  const [categories, setCategories] = useState<PriceCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Какие категории свёрнуты (по умолчанию все раскрыты)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // Модалка категории
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Модалка расценки (общая для создания и редактирования)
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItemData | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemArticle, setItemArticle] = useState('');
  const [itemUnit, setItemUnit] = useState('PIECE');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<number | string>('');
  // ⭐ Название новой категории (если выбран пункт "__new__")
  const [newCategoryName, setNewCategoryName] = useState('');

  // Подтверждение удаления расценки
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PriceItemData | null>(null);

  // ============================================================
  // ЗАГРУЗКА
  // ============================================================
  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchCategoriesWithItems(token);
        setCategories(data);
        setError('');
      } catch (err: any) {
        setError('Ошибка загрузки справочника');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  // ============================================================
  // ФИЛЬТРАЦИЯ ПО ПОИСКУ (локально, как в Materials)
  // ============================================================
  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      items: (cat.items || []).filter(
        item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.article || '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter(cat => cat.items!.length > 0 || !searchQuery);

  const isCategoryExpanded = (catId: number) =>
    searchQuery ? true : !collapsed[catId];

  const handleToggleCategory = (catId: number) => {
    setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // ============================================================
  // КАТЕГОРИИ
  // ============================================================
  const handleOpenCatModal = () => setCatModalOpen(true);

  const handleCloseCatModal = () => {
    setCatModalOpen(false);
    setNewCatName('');
  };

  const handleCreateCategory = async () => {
    if (!token || !newCatName.trim()) {
      alert('Введите название категории');
      return;
    }
    try {
      const created = await createCategory(token, { name: newCatName.trim() });
      setCategories(prev => [...prev, { ...created, items: [] }]);
      handleCloseCatModal();
    } catch (err: any) {
      alert('Ошибка при создании категории: ' + (err.response?.data?.message || err.message));
    }
  };

  // ============================================================
  // РАСЦЕНКИ: модалка (создание / редактирование)
  // ============================================================
  const handleOpenAddItem = (categoryId?: number) => {
    setEditingItem(null);
    setItemName('');
    setItemArticle('');
    setItemUnit('PIECE');
    setItemPrice('');
    setNewCategoryName('');
    // Если категорий ещё нет — сразу предлагаем создать новую
    setItemCategoryId(
      categoryId ?? (categories.length > 0 ? categories[0].id : NEW_CATEGORY_VALUE)
    );
    setItemModalOpen(true);
  };

  const handleOpenEditItem = (item: PriceItemData) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemArticle(item.article || '');
    setItemUnit(item.unit);
    setItemPrice(String(item.price));
    setItemCategoryId(item.categoryId);
    setNewCategoryName('');
    setItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setItemModalOpen(false);
    setEditingItem(null);
    setNewCategoryName('');
  };

  const handleSaveItem = async () => {
    if (!token) return;
    const price = parseFloat(itemPrice);
    if (!itemName.trim()) {
      alert('Введите наименование');
      return;
    }
    if (isNaN(price) || price < 0) {
      alert('Введите корректную цену');
      return;
    }
    if (itemCategoryId === '') {
      alert('Выберите категорию');
      return;
    }
    // ⭐ Если выбрана новая категория — требуем её название
    if (itemCategoryId === NEW_CATEGORY_VALUE && !newCategoryName.trim()) {
      alert('Введите название новой категории');
      return;
    }
    try {
      if (editingItem) {
        // ===== РЕДАКТИРОВАНИЕ =====
        const updated = await updatePriceItem(token, editingItem.id, {
          name: itemName.trim(),
          article: itemArticle.trim() || undefined,
          unit: itemUnit,
          price,
        });
        setCategories(prev =>
          prev.map(cat => ({
            ...cat,
            items: (cat.items || []).map(it =>
              it.id === updated.id ? { ...it, ...updated } : it
            ),
          }))
        );
      } else {
        // ===== СОЗДАНИЕ (возможно, вместе с новой категорией) =====
        let categoryId: number;
        if (itemCategoryId === NEW_CATEGORY_VALUE) {
          // 1) Сначала создаём категорию
          const createdCat = await createCategory(token, { name: newCategoryName.trim() });
          setCategories(prev => [...prev, { ...createdCat, items: [] }]);
          setCollapsed(prev => ({ ...prev, [createdCat.id]: false }));
          categoryId = createdCat.id;
        } else {
          categoryId = Number(itemCategoryId);
        }
        // 2) Потом создаём расценку внутри категории
        const created = await createPriceItem(token, {
          name: itemName.trim(),
          article: itemArticle.trim() || undefined,
          unit: itemUnit,
          price,
          categoryId,
        });
        setCategories(prev =>
          prev.map(cat =>
            cat.id === categoryId
              ? { ...cat, items: [...(cat.items || []), created] }
              : cat
          )
        );
      }
      handleCloseItemModal();
    } catch (err: any) {
      alert('Ошибка при сохранении: ' + (err.response?.data?.message || err.message));
    }
  };

  // ============================================================
  // УДАЛЕНИЕ (деактивация) РАСЦЕНКИ
  // ============================================================
  const handleDeleteRequest = (item: PriceItemData) => {
    setDeletingItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!token || !deletingItem) return;
    try {
      await deletePriceItem(token, deletingItem.id);
      setCategories(prev =>
        prev.map(cat => ({
          ...cat,
          items: (cat.items || []).filter(it => it.id !== deletingItem.id),
        }))
      );
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
    } catch (err: any) {
      alert('Ошибка удаления: ' + (err.response?.data?.message || err.message));
    }
  };

  // ============================================================
  // РЕНДЕР
  // ============================================================
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Заголовок с кнопкой назад */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            mr: 1,
            bgcolor: 'rgba(0, 0, 0, 0.06)',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ flexGrow: 1 }}>
          Справочник цен
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Поиск и кнопки добавления */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Поиск расценок..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        {isMobile ? (
          // ⭐ МОБИЛКА: обе кнопки рядом под поиском
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={handleOpenCatModal}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Категория
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenAddItem()}
              sx={{
                bgcolor: '#4caf50',
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#388e3c' },
              }}
            >
              Расценка
            </Button>
          </Box>
        ) : (
          // ДЕСКТОП: кнопки не сжимаются (flexShrink: 0) → текст больше не вылезает
          <>
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={handleOpenCatModal}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Категория
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenAddItem()}
              sx={{
                bgcolor: '#4caf50',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: '#388e3c',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Добавить расценку
            </Button>
          </>
        )}
      </Box>

      {categories.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PriceCheckIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Справочник пуст. Создайте первую категорию.
          </Typography>
          <Button variant="contained" startIcon={<CategoryIcon />} onClick={handleOpenCatModal}>
            Создать категорию
          </Button>
        </Paper>
      )}

      {/* Список категорий */}
      <Stack spacing={2}>
        {filteredCategories.map(cat => (
          <Paper key={cat.id} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {/* Шапка категории (клик = свернуть/развернуть) */}
            <Box
              onClick={() => handleToggleCategory(cat.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1.5,
                bgcolor: '#f5f5f5',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#eeeeee' },
              }}
            >
              <CategoryIcon sx={{ color: '#1976d2' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, fontSize: 16 }}>
                {cat.name}
              </Typography>
              <Chip label={`${(cat.items || []).length} поз.`} size="small" variant="outlined" />
              {!isMobile && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={e => {
                    e.stopPropagation();
                    handleOpenAddItem(cat.id);
                  }}
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                >
                  Добавить
                </Button>
              )}
              <IconButton size="small" onClick={e => { e.stopPropagation(); handleToggleCategory(cat.id); }}>
                {isCategoryExpanded(cat.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={isCategoryExpanded(cat.id)}>
              {/* ===== ДЕСКТОП: таблица ===== */}
              {!isMobile && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, width: 50 }}>№</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Наименование</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Артикул</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: 80 }}>Ед.</TableCell>
                        <TableCell sx={{ fontWeight: 600, textAlign: 'right', width: 130 }}>Цена</TableCell>
                        <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 80 }}>Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(cat.items || []).map((item, idx) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.article || '-'}</TableCell>
                          <TableCell>
                            {UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {item.price.toLocaleString('ru-RU')} ₽
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <IconButton size="small" onClick={() => handleOpenEditItem(item)}>
                              <SettingsIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(cat.items || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                            В категории пока нет расценок
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* ===== МОБИЛКА: карточки ===== */}
              {isMobile && (
                <Stack spacing={1} sx={{ p: 1.5 }}>
                  {(cat.items || []).map(item => (
                    <Paper
                      key={item.id}
                      variant="outlined"
                      sx={{ p: 1.5, borderRadius: 2 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.article || 'Без артикула'} •{' '}
                            {UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 700, mr: 1 }}>
                          {item.price.toLocaleString('ru-RU')} ₽
                        </Typography>
                        <IconButton size="small" onClick={() => handleOpenEditItem(item)}>
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                  {(cat.items || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                      В категории пока нет расценок
                    </Typography>
                  )}
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenAddItem(cat.id)}
                  >
                    Добавить расценку
                  </Button>
                </Stack>
              )}
            </Collapse>
          </Paper>
        ))}

        {filteredCategories.length === 0 && categories.length > 0 && (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Ничего не найдено</Typography>
          </Paper>
        )}
      </Stack>

      {/* FAB для мобилки: добавить расценку (+$) */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }}
          onClick={() => handleOpenAddItem()}
        >
           <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AttachMoneyIcon />
            <AddIcon sx={{ fontSize: 18, ml: -0.5 }} />
          </Box>
        </Fab>
      )}

      {/* Модалка создания категории */}
      <Modal open={catModalOpen} onClose={handleCloseCatModal} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Новая категория</Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название (например: Электрика, Отделка)"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              required
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseCatModal}>Отмена</Button>
              <Button variant="contained" onClick={handleCreateCategory}>Сохранить</Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка расценки (создание и редактирование) */}
      <Modal open={itemModalOpen} onClose={handleCloseItemModal} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 450 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>
            {editingItem ? 'Редактировать расценку' : 'Новая расценка'}
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Наименование (например: Установка розетки)"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Артикул"
              value={itemArticle}
              onChange={e => setItemArticle(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Единица измерения</InputLabel>
              <Select
                value={itemUnit}
                label="Единица измерения"
                onChange={e => setItemUnit(e.target.value)}
              >
                {UNIT_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Цена, ₽"
              type="number"
              placeholder="0"
              value={itemPrice}
              onChange={e => setItemPrice(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Категория</InputLabel>
              <Select
                value={itemCategoryId}
                label="Категория"
                onChange={e => setItemCategoryId(e.target.value)}
              >
                {/* ⭐ Пункт "создать новую категорию" — только при создании */}
                {!editingItem && (
                  <MenuItem value={NEW_CATEGORY_VALUE}>
                    <Box component="span" sx={{ fontStyle: 'italic', color: '#1976d2' }}>
                      ➕ Создать новую категорию...
                    </Box>
                  </MenuItem>
                )}
                {categories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* ⭐ Поле названия появляется, если выбрана новая категория */}
            {itemCategoryId === NEW_CATEGORY_VALUE && (
              <TextField
                fullWidth
                label="Название новой категории"
                placeholder="Например: Электрика, Сантехника"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingItem ? (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    handleCloseItemModal();
                    handleDeleteRequest(editingItem);
                  }}
                >
                  Удалить
                </Button>
              ) : <Box />}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={handleCloseItemModal}>Отмена</Button>
                <Button variant="contained" onClick={handleSaveItem}>Сохранить</Button>
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка подтверждения удаления (деактивации) */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingItem(null);
        }}
        disableRestoreFocus
      >
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 380 },
          p: 3,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Удалить расценку?</Typography>
          <Typography sx={{ mb: 1 }}>
            Расценка <b>"{deletingItem?.name}"</b> будет скрыта из справочника.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Уже созданные сметы не пострадают — расценка останется в истории.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeletingItem(null);
              }}
            >
              Отмена
            </Button>
            <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
              Удалить
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default PriceList;