import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAuth } from '../contexts/AuthContext';
import { FAB_STYLE } from '../theme';
import { useFeedback } from '../contexts/FeedbackContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import {
  fetchCategoriesWithItems,
  fetchPriceCatalogs,
  downloadPriceTemplate,
  fetchPriceClarifications,
  fetchTemplateUpdate,
  createCategory,
  updateCategory,
  deleteCategory,
  createPriceItem,
  updatePriceItem,
  deletePriceItem,
} from '../services/priceListService';
import type { PriceCategoryData, PriceCatalogData, PriceItemData } from '../services/priceListService';
import PriceCatalogList from '../components/PriceCatalogList';
import { PriceImportDialog } from '../components/PriceImportDialog';
import { PriceClarificationsDialog } from '../components/PriceClarificationsDialog';
import { PriceTemplateUpdateDialog } from '../components/PriceTemplateUpdateDialog';
import type { TemplateUpdatePreview } from '../services/priceListService';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов
import { getApiErrorText } from '../utils/errors';

// Единицы измерения — точно как в Materials.tsx (единообразие)
const UNIT_OPTIONS = [
  { value: 'PIECE', label: 'шт' },
  { value: 'METER', label: 'м' },
  { value: 'LINEAR_METER', label: 'пог. м' },
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

const PriceListInner: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const { notify, error: notifyError } = useFeedback();
  // ⭐ №151: справочник выбирается по URL (/price-list/:catalogId)
  const { catalogId: catalogIdParam } = useParams<{ catalogId?: string }>();
  const catalogId = catalogIdParam ? parseInt(catalogIdParam) : undefined;
  const goBack = useBackNavigation(catalogId ? '/price-list' : '/');
  const [catalogs, setCatalogs] = useState<PriceCatalogData[]>([]);
  const catalogName = catalogs.find((c) => c.id === catalogId)?.name;

  // Основные данные
    // Основные данные
  const [activeTab, setActiveTab] = useState<'WORK' | 'MATERIAL'>('WORK');
  const [categories, setCategories] = useState<PriceCategoryData[]>([]);
  const [loading, setLoading] = useState(!!catalogId);
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
  // ⭐ №318: «в упаковке N кг/л/шт» — для материалов, которые продаются упаковкой
  const [itemPackSize, setItemPackSize] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<number | string>('');
  // ⭐ Название новой категории (если выбран пункт "__new__")
  const [newCategoryName, setNewCategoryName] = useState('');

  // Подтверждение удаления расценки
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PriceItemData | null>(null);

  // ⭐ №273: импорт/выгрузка прайса и черновики без единицы измерения
  const [importOpen, setImportOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // ⭐ №278: что нового в образце (баннер + диалог)
  const [templateUpdate, setTemplateUpdate] = useState<TemplateUpdatePreview | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  // ⭐ №280: одно меню «Из шаблона» — шаблон, импорт и обновление из образца
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  const loadDrafts = useCallback(async () => {
    if (!catalogId) {
      setDraftCount(0);
      return;
    }
    try {
      const data = await fetchPriceClarifications(catalogId, activeTab);
      setDraftCount(data.total);
    } catch {
      setDraftCount(0);
    }
  }, [catalogId, activeTab]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const handleDownloadTemplate = async () => {
    if (!catalogId) return;
    try {
      await downloadPriceTemplate(catalogId, activeTab);
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось скачать шаблон'));
    }
  };

  const handleImported = useCallback(async () => {
    setReloadKey((key) => key + 1);
    await loadDrafts();
  }, [loadDrafts]);

  // ⭐ №278: проверяем, не обновился ли образец (тихо: у справочника может не быть templateId)
  useEffect(() => {
    let alive = true;
    if (!catalogId) {
      setTemplateUpdate(null);
      return;
    }
    fetchTemplateUpdate(catalogId)
      .then((data) => {
        if (alive) setTemplateUpdate(data.available ? data : null);
      })
      .catch(() => {
        if (alive) setTemplateUpdate(null);
      });
    return () => {
      alive = false;
    };
  }, [catalogId, reloadKey]);

  // Настройки категории (шестерёнка): переименование + защищённое удаление
  const [catSettingsOpen, setCatSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<PriceCategoryData | null>(null);
  const [settingsCatName, setSettingsCatName] = useState('');
  const [catDeleteError, setCatDeleteError] = useState('');
  const [deleteCatConfirmOpen, setDeleteCatConfirmOpen] = useState(false);
    // ============================================================
  // ⭐ ХЭДЕР v2 (по эталону Materials/Projects)
  // ============================================================
  const headerTitle = catalogName ?? 'Справочник цен';

  const headerTrailing = useMemo(() => isMobile ? (
    <>
      {/* ⭐ №281: на мобилке «Импорт» живёт в шапке (в тулбаре кнопок больше нет) */}
      <IconButton
        onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
        disabled={!catalogId}
        aria-label="Импорт: из шаблона, Excel, скачать шаблон"
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.06)',
          color: '#1976d2',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
        }}
      >
        <PlaylistAddIcon />
      </IconButton>
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
    </>
  ) : undefined, [isMobile, priceSortBy, catalogId]);

  useMobileHeader({
    title: headerTitle,
    onBack: goBack,
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
    // ⭐ Название справочника нужно для заголовка (в т.ч. после F5)
    fetchPriceCatalogs()
      .then(setCatalogs)
      .catch(() => setCatalogs([]));
  }, [token]);

  useEffect(() => {
    // ⭐ №169: на маршруте списка справочников (/price-list) грузить нечего —
    // иначе loading оставался true и страница навсегда показывала спиннер.
    if (!token || !catalogId) {
      setLoading(false);
      return;
    }
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchCategoriesWithItems(activeTab, catalogId);
        setCategories(data);
        // ⭐ По умолчанию ВСЕ категории свёрнуты — справочник большой, тапнул и открыл
        setCollapsed(data.reduce<Record<number, boolean>>((acc, c) => {
          acc[c.id] = true;
          return acc;
        }, {}));
        setError('');
      } catch (err: unknown) {
        setError('Ошибка загрузки справочника');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token, activeTab, catalogId, reloadKey]);

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
            comparison = (a.price ?? 0) - (b.price ?? 0);
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
      notify('Введите название категории', 'warning');
      return;
    }
    try {
      const created = await createCategory({ name: newCatName.trim(), kind: activeTab });
      setCategories(prev => [...prev, { ...created, items: [] }]);
      handleCloseCatModal();
    } catch (err: unknown) {
      notifyError('Ошибка при создании категории: ' + getApiErrorText(err, 'неизвестная ошибка'));
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
    setItemPackSize('');
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
    setItemPrice(item.price == null ? '' : String(item.price));
    setItemPackSize(item.packSize == null ? '' : String(item.packSize));
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
      notify('Введите наименование', 'warning');
      return;
    }
    if (isNaN(price) || price < 0) {
      notify('Введите корректную цену', 'warning');
      return;
    }
    if (itemCategoryId === '') {
      notify('Выберите категорию', 'warning');
      return;
    }
    // ⭐ Если выбрана новая категория — требуем её название
    if (itemCategoryId === NEW_CATEGORY_VALUE && !newCategoryName.trim()) {
      notify('Введите название новой категории', 'warning');
      return;
    }
    // ⭐ №318: объём упаковки (необязателен; 0/пусто = цена за единицу измерения)
    const packRaw = itemPackSize.replace(',', '.').trim();
    const packSize = packRaw === '' ? null : Number(packRaw);
    if (packSize !== null && (!Number.isFinite(packSize) || packSize < 0)) {
      notify('Объём упаковки должен быть числом ≥ 0', 'warning');
      return;
    }
    try {
      if (editingItem) {
        // ===== РЕДАКТИРОВАНИЕ =====
        const updated = await updatePriceItem(editingItem.id, {
          name: itemName.trim(),
          article: itemArticle.trim(), // '' = очистить артикул; отсутствие ключа = не трогать
          unit: itemUnit,
          price,
          packSize,
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
        const createdCat = await createCategory({ name: newCategoryName.trim(), kind: activeTab });
          setCategories(prev => [...prev, { ...createdCat, items: [] }]);
          setCollapsed(prev => ({ ...prev, [createdCat.id]: false }));
          categoryId = createdCat.id;
        } else {
          categoryId = Number(itemCategoryId);
        }
        // 2) Потом создаём расценку внутри категории
        const created = await createPriceItem({
          name: itemName.trim(),
          article: itemArticle.trim() || undefined,
          unit: itemUnit,
          price,
          packSize, // ⭐ №318: упаковка (для красок/смесей)
          categoryId,
          kind: activeTab,
          catalogId, // ⭐ №151: расценка попадает в текущий справочник
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
    } catch (err: unknown) {
      notifyError('Ошибка при сохранении: ' + getApiErrorText(err, 'неизвестная ошибка'));
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
      await deletePriceItem(deletingItem.id);
      setCategories(prev =>
        prev.map(cat => ({
          ...cat,
          items: (cat.items || []).filter(it => it.id !== deletingItem.id),
        }))
      );
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
    } catch (err: unknown) {
      notifyError('Ошибка удаления: ' + getApiErrorText(err, 'неизвестная ошибка'));
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
      notify('Введите название категории', 'warning');
      return;
    }
    try {
      const updated = await updateCategory(settingsCategory.id, {
        name: settingsCatName.trim(),
      });
      setCategories(prev =>
        prev.map(cat => (cat.id === updated.id ? { ...cat, name: updated.name } : cat))
      );
      handleCloseCategorySettings();
    } catch (err: unknown) {
      notifyError('Ошибка переименования: ' + getApiErrorText(err, 'неизвестная ошибка'));
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
      await deleteCategory(settingsCategory.id);
      setCategories(prev => prev.filter(cat => cat.id !== settingsCategory.id));
      setDeleteCatConfirmOpen(false);
      handleCloseCategorySettings();
    } catch (err: unknown) {
      notifyError('Ошибка удаления: ' + getApiErrorText(err, 'неизвестная ошибка'));
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

  // ⭐ №179: ветку «список справочников» вынес в обёртку ниже — списку нужна СВОЯ мобильная
  // шапка (архив + поиск), иначе шапка PriceList дублировала поиск и показывала нерабочую сортировку.


  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <IconButton
            onClick={goBack}
            sx={{
              mr: 1,
              bgcolor: 'rgba(0,0,0,0.06)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' },
            }}
            aria-label={catalogId ? 'К списку справочников' : 'В главное меню'}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            {activeTab === 'WORK' ? 'Цены на работы' : 'Цены на материалы'}
          </Typography>
        </Box>
      )}
      {/* ⭐ №199: подсказка — под заголовком, до вкладок и поиска */}
      <SectionIntro id="price-items" version={1}>
        Категории сворачиваются кликом по заголовку. Шестерёнка ⚙ у категории — переименовать
        или удалить, у расценки — правка. На телефоне новая расценка добавляется кнопкой «$ +».
      </SectionIntro>

      {/* Десктоп: вкладки */}
      {!isMobile && (
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: 'WORK' | 'MATERIAL') => {
            setActiveTab(newValue);
            setSearchQuery('');
          }}
          sx={{
            mb: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 15, minHeight: 48 },
          }}
        >
          <Tab icon={<EngineeringIcon />} iconPosition="start" label="Цены на работы" value="WORK" />
          <Tab icon={<Inventory2Icon />} iconPosition="start" label="Цены на материалы" value="MATERIAL" />
        </Tabs>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {draftCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setClarifyOpen(true)}>
              Уточнить
            </Button>
          }
        >
          Есть позиции без единицы измерения: {draftCount}. Они серые и не попадают в смету, пока
          единица не выбрана.
        </Alert>
      )}

      {/* ⭐ №278: образец обновился — предложить подтянуть новые позиции и цены */}
      {templateUpdate && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setTemplateDialogOpen(true)}>
              Посмотреть
            </Button>
          }
        >
          Образец обновился: новых позиций {templateUpdate.stats.add}, изменены цены у{' '}
          {templateUpdate.stats.price}. Сметы не меняются — обновляется только база цен.
        </Alert>
      )}

      {/* ⭐ №280/№281: тулбар только на десктопе — на мобилке поиск и «Импорт» живут
          в шапке, а расценка добавляется кнопкой FAB `$+`.
          ⭐ №281: подписи кнопок видны всегда, ширину уступает поиск */}
      {!isMobile && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 1.5,
            mb: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            placeholder="Поиск расценок..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // ⭐ №281: поиск занимает остаток, кнопки не сжимаются и не переносятся
            sx={{ flex: '1 1 auto', minWidth: 120 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexShrink: 0,
              ml: 'auto',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="outlined"
              startIcon={<PlaylistAddIcon />}
              onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
              disabled={!catalogId}
              title="Импорт: скачать шаблон, загрузить прайс, обновить из образца"
              sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 0, px: 1.5 }}
            >
              Импорт
            </Button>
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={handleOpenCatModal}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 0, px: 1.5 }}
            >
              Категория
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenAddItem()}
              sx={{
                bgcolor: '#4caf50',
                border: '2px solid #388e3c',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 0,
                px: 1.75,
                '&:hover': {
                  bgcolor: '#388e3c',
                  borderColor: '#388e3c',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Добавить
            </Button>
          </Box>
        </Box>
      )}

      {/* ⭐ №280: шаблон/импорт/обновление из образца — в одном меню, как в сметах */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setTemplateMenuAnchor(null);
            void handleDownloadTemplate();
          }}
        >
          <FileDownloadIcon fontSize="small" style={{ marginRight: 8 }} />
          Скачать шаблон
        </MenuItem>
        <MenuItem
          onClick={() => {
            setTemplateMenuAnchor(null);
            setImportOpen(true);
          }}
        >
          <UploadFileIcon fontSize="small" style={{ marginRight: 8 }} />
          Импорт из Excel
        </MenuItem>
        {templateUpdate && (
          <MenuItem
            onClick={() => {
              setTemplateMenuAnchor(null);
              setTemplateDialogOpen(true);
            }}
          >
            <SyncIcon fontSize="small" style={{ marginRight: 8 }} />
            Обновить из образца ({templateUpdate.stats.add + templateUpdate.stats.price})
          </MenuItem>
        )}
      </Menu>

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
                bgcolor: 'rgba(25, 118, 210, 0.06)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.10)' },
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
                            {item.price == null ? '—' : `${item.price.toLocaleString('ru-RU')} ₽`}
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
                          {item.price == null ? '—' : `${item.price.toLocaleString('ru-RU')} ₽`}
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
          sx={{ ...FAB_STYLE, bottom: 80 }}
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
         {/* ⭐ Компактно: цена + единица на одном этаже */}
         <Stack direction="row" spacing={2}>
           <TextField
             fullWidth
             label="Цена, ₽"
             type="number"
             placeholder="0"
             value={itemPrice}
             onChange={e => setItemPrice(e.target.value)}
           />
           <FormControl fullWidth sx={{ maxWidth: 100 }}>
             <InputLabel>Ед. изм.</InputLabel>
             <Select
               value={itemUnit}
               label="Ед. изм."
               onChange={e => setItemUnit(e.target.value)}
             >
               {UNIT_OPTIONS.map(opt => (
                 <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
               ))}
             </Select>
           </FormControl>
         </Stack>
            {/* ⭐ №336: поля «В упаковке» больше нет — цена расценки всегда за единицу
                измерения, а норму расхода материал получает в названии. */}
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

      {/* ⭐ №273: импорт прайса и уточнение единиц (черновики) */}
      {catalogId != null && (
        <>
          <PriceImportDialog
            open={importOpen}
            catalogId={catalogId}
            kind={activeTab}
            catalogName={catalogName}
            onClose={() => setImportOpen(false)}
            onImported={handleImported}
          />
          <PriceClarificationsDialog
            open={clarifyOpen}
            catalogId={catalogId}
            kind={activeTab}
            onClose={() => setClarifyOpen(false)}
            onResolved={loadDrafts}
          />
          <PriceTemplateUpdateDialog
            open={templateDialogOpen}
            catalogId={catalogId}
            onClose={() => setTemplateDialogOpen(false)}
            onApplied={handleImported}
          />
        </>
      )}
    </Box>
  );
};

// ⭐ №179: если справочник не выбран — показываем СПИСОК справочников как отдельную страницу
// (свой заголовок, архив в шапке и поиск по справочникам, а не по расценкам).
const PriceList: React.FC = () => {
  const { catalogId } = useParams<{ catalogId?: string }>();
  if (!catalogId) {
    // ⭐ №195: свою оболочку (minHeight 100vh + фон) не рисуем — её даёт Dashboard,
    // иначе страница «Справочники цен» выбивалась из остальных разделов.
    return <PriceCatalogList />;
  }
  return <PriceListInner />;
};

export default PriceList;