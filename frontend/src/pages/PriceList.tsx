import React, { useState, useEffect, useMemo } from 'react';
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
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Collapse,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import AddIcon from '@mui/icons-material/Add';
import EngineeringIcon from '@mui/icons-material/Engineering';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CategoryIcon from '@mui/icons-material/Category';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useAuth } from '../contexts/AuthContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import {
  fetchCategoriesWithItems,
  createCategory,
  updateCategory,
  deleteCategory,
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
    // Основные данные
  const [activeTab, setActiveTab] = useState<'WORK' | 'MATERIAL'>('WORK');
  const [categories, setCategories] = useState<PriceCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Какие категории свёрнуты (по умолчанию все раскрыты)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // Сортировка расценок внутри категорий
  const [priceSortBy, setPriceSortBy] = useState<'name' | 'price' | null>(null);
  const [priceSortDirection, setPriceSortDirection] = useState<'asc' | 'desc'>('asc');
  // Мобильный компактный поиск и меню сортировки
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
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

  // Настройки категории (шестерёнка): переименование + защищённое удаление
  const [catSettingsOpen, setCatSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<PriceCategoryData | null>(null);
  const [settingsCatName, setSettingsCatName] = useState('');
  const [catDeleteError, setCatDeleteError] = useState('');
  const [deleteCatConfirmOpen, setDeleteCatConfirmOpen] = useState(false);
    // ============================================================
  // ⭐ ХЭДЕР v2 (по эталону Materials/Projects)
  // ============================================================
  const headerTitle = activeTab === 'WORK' ? 'Цены на работы' : 'Цены на материалы';

  const headerTrailing = useMemo(() => isMobile ? (
    <IconButton
      onClick={(e) => setSortAnchorEl(e.currentTarget)}
      sx={{
        bgcolor: priceSortBy ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
        color: priceSortBy ? '#1976d2' : '#424242',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
      }}
    >
      <SortIcon />
    </IconButton>
  ) : undefined, [isMobile, priceSortBy]);

  useMobileHeader({
    title: headerTitle,
    onBack: () => navigate('/'),
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: activeTab === 'WORK' ? 'Поиск работ...' : 'Поиск материалов...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); },
    onSearchChange: (v) => setSearchQuery(v),
    trailing: headerTrailing,
  });

  // ============================================================
  // ЗАГРУЗКА
  // ============================================================
  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchCategoriesWithItems(token, activeTab);
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
  }, [token, activeTab]);

  // ============================================================
  // ФИЛЬТРАЦИЯ ПО ПОИСКУ (локально, как в Materials)
  // ============================================================
  const filteredCategories = categories
    .map(cat => {
      let items = (cat.items || []).filter(
        item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.article || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      // ⭐ Сортировка расценок внутри категории
      if (priceSortBy) {
        items = [...items].sort((a, b) => {
          let comparison = 0;
          if (priceSortBy === 'name') {
            comparison = a.name.localeCompare(b.name);
          } else if (priceSortBy === 'price') {
            comparison = a.price - b.price;
          }
          return priceSortDirection === 'desc' ? -comparison : comparison;
        });
      }
      return { ...cat, items };
    })
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
      const created = await createCategory(token, { name: newCatName.trim(), kind: activeTab });
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
          article: itemArticle.trim(), // '' = очистить артикул; отсутствие ключа = не трогать
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
        const createdCat = await createCategory(token, { name: newCategoryName.trim(), kind: activeTab });
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
          kind: activeTab,
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
  // НАСТРОЙКИ КАТЕГОРИИ (шестерёнка): переименование + защита
  // ============================================================
  const handleOpenCategorySettings = (cat: PriceCategoryData) => {
    setSettingsCategory(cat);
    setSettingsCatName(cat.name);
    setCatDeleteError('');
    setCatSettingsOpen(true);
  };

  const handleCloseCategorySettings = () => {
    setCatSettingsOpen(false);
    setSettingsCategory(null);
    setCatDeleteError('');
  };

  const handleRenameCategory = async () => {
    if (!token || !settingsCategory) return;
    if (!settingsCatName.trim()) {
      alert('Введите название категории');
      return;
    }
    try {
      const updated = await updateCategory(token, settingsCategory.id, {
        name: settingsCatName.trim(),
      });
      setCategories(prev =>
        prev.map(cat => (cat.id === updated.id ? { ...cat, name: updated.name } : cat))
      );
      handleCloseCategorySettings();
    } catch (err: any) {
      alert('Ошибка переименования: ' + (err.response?.data?.message || err.message));
    }
  };

  // Клик «Удалить»: есть расценки → инлайн-защита, пусто → подтверждение
  const handleDeleteCategoryClick = () => {
    if (!settingsCategory) return;
    const count = (settingsCategory.items || []).length;
    if (count > 0) {
      setCatDeleteError(
        `Нельзя удалить: в категории ${count} расценок(ки). Сначала удалите их или перенесите в другую категорию.`
      );
      return;
    }
    setDeleteCatConfirmOpen(true);
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!token || !settingsCategory) return;
    try {
      await deleteCategory(token, settingsCategory.id);
      setCategories(prev => prev.filter(cat => cat.id !== settingsCategory.id));
      setDeleteCatConfirmOpen(false);
      handleCloseCategorySettings();
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
            {/* Вкладки WORK/MATERIAL — оставляем как есть на мобилке */}
      {isMobile && (
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: 'WORK' | 'MATERIAL') => {
            setActiveTab(newValue);
            setSearchQuery('');
            setMobileSearchOpen(false);
          }}
          variant="fullWidth"
          sx={{
            mt: -3,
            mb: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13, minHeight: 44 },
          }}
        >
          <Tab icon={<EngineeringIcon />} iconPosition="start" label="Работы" value="WORK" />
          <Tab icon={<Inventory2Icon />} iconPosition="start" label="Материалы" value="MATERIAL" />
        </Tabs>
      )}

      {/* Меню сортировки (привязано к trailing-иконке хэдера на мобилке) */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
      >
        <MenuItem onClick={() => { setPriceSortBy(null); setSortAnchorEl(null); }}>
          <em>По умолчанию</em>
        </MenuItem>
        <MenuItem onClick={() => { setPriceSortBy('name'); setPriceSortDirection('asc'); setSortAnchorEl(null); }}>
          По имени (А→Я)
        </MenuItem>
        <MenuItem onClick={() => { setPriceSortBy('name'); setPriceSortDirection('desc'); setSortAnchorEl(null); }}>
          По имени (Я→А)
        </MenuItem>
        <MenuItem onClick={() => { setPriceSortBy('price'); setPriceSortDirection('asc'); setSortAnchorEl(null); }}>
          По цене (возрастание)
        </MenuItem>
        <MenuItem onClick={() => { setPriceSortBy('price'); setPriceSortDirection('desc'); setSortAnchorEl(null); }}>
          По цене (убывание)
        </MenuItem>
      </Menu>

      {/* Десктоп: заголовок + кнопка "назад в главное меню" */}
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/')}
            sx={{
              mr: 1,
              bgcolor: 'rgba(0,0,0,0.06)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' },
            }}
            aria-label="В главное меню"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            {activeTab === 'WORK' ? 'Цены на работы' : 'Цены на материалы'}
          </Typography>
        </Box>
      )}
      {/* Десктоп: вкладки */}
      {!isMobile && (
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: 'WORK' | 'MATERIAL') => {
            setActiveTab(newValue);
            setSearchQuery('');
          }}
          sx={{
            mb: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 15, minHeight: 48 },
          }}
        >
          <Tab icon={<EngineeringIcon />} iconPosition="start" label="Цены на работы" value="WORK" />
          <Tab icon={<Inventory2Icon />} iconPosition="start" label="Цены на материалы" value="MATERIAL" />
        </Tabs>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Поиск и кнопки добавления */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 2 }}>
        {/* На мобилке поиск теперь в шапке — скрываем его здесь */}
        {!isMobile && (
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
        )}
        {isMobile ? (
          // ⭐ МОБИЛКА: только кнопка "Категория" (FAB `$+` справляется с расценками)
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={handleOpenCatModal}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Создать категорию
          </Button>
        ) : (
          // ДЕСКТОП: кнопки не сжимаются (flexShrink: 0) → текст больше не вылезает
          <>
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={handleOpenCatModal}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              + Категория
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
              {activeTab === 'WORK'
                ? 'Справочник работ пуст. Создайте первую категорию.'
                : 'Справочник материалов пуст. Создайте первую категорию.'}
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
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  handleOpenCategorySettings(cat);
                }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
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

      {/* Модалка настроек категории (шестерёнка) */}
      <Modal open={catSettingsOpen} onClose={handleCloseCategorySettings} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Настройки категории</Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название категории"
              value={settingsCatName}
              onChange={e => setSettingsCatName(e.target.value)}
            />
            {/* ⭐ Инлайн-защита: появляется после клика «Удалить», если есть расценки */}
            {catDeleteError && (
              <Alert severity="warning">{catDeleteError}</Alert>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="outlined" color="error" onClick={handleDeleteCategoryClick}>
                Удалить
              </Button>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={handleCloseCategorySettings}>Отмена</Button>
                <Button variant="contained" onClick={handleRenameCategory}>Сохранить</Button>
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Подтверждение удаления ПУСТОЙ категории */}
      <Modal
        open={deleteCatConfirmOpen}
        onClose={() => setDeleteCatConfirmOpen(false)}
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
          <Typography variant="h6" gutterBottom>Удалить категорию?</Typography>
          <Typography sx={{ mb: 3 }}>
            Вы уверены, что хотите удалить категорию <b>"{settingsCategory?.name}"</b>?
            Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => setDeleteCatConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="contained" color="error" onClick={handleDeleteCategoryConfirm}>
              Удалить
            </Button>
          </Box>
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