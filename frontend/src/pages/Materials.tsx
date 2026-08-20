import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Autocomplete,
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
  TableFooter,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Menu,
  FormControl,
  InputLabel,
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
//import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchMaterialsByProject,
  createMaterial,
  addFix,
  updateSpecQuantity,
  toggleSpecLock,
  deleteMaterial,
  fetchFixesByMaterial,
  editLastFix,
  updateMaterial,
} from '../services/materialService';
import type { MaterialData } from '../services/materialService';
import { fetchProjectById } from '../services/materialService';
import type { ProjectData } from '../services/projectService';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { searchPriceItems } from '../services/priceListService';
import type { PriceItemData } from '../services/priceListService';

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

const Materials: React.FC = () => {
  const { objectId, projectId } = useParams<{ objectId: string; projectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();

  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [currentObject, setCurrentObject] = useState<ObjectData | null>(null);

  // Состояния для сортировки
  const [sortBy, setSortBy] = useState<'name' | 'specQuantity' | 'totalPrice' | 'percentage' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('asc');
// Мобилка: компактный поиск и меню сортировки
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  // ⭐ Фильтр по категориям справочника
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null); 

  // Модалка добавления материала
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArticle, setNewArticle] = useState('');
  const [newUnit, setNewUnit] = useState('PIECE');
  //const [newSpecQuantity, setNewSpecQuantity] = useState<number>(0);
  const [newSpecQuantity, setNewSpecQuantity] = useState('');
  const [newNote, setNewNote] = useState('');
  // ⭐ Расценка из справочника (опционально)
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItemData | null>(null);
  const [priceOptions, setPriceOptions] = useState<PriceItemData[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);

  // Модалка фиксации объёма
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [fixingMaterial, setFixingMaterial] = useState<MaterialData | null>(null);
  //const [fixAmount, setFixAmount] = useState<number>(0);
  const [fixAmount, setFixAmount] = useState('');
  const [fixNote, setFixNote] = useState('');

  // Модалка изменения спецификации
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialData | null>(null);
  //const [newSpecQty, setNewSpecQty] = useState<number>(0);
  const [newSpecQty, setNewSpecQty] = useState('');

  // Шестерёнка (настройки материала) и подтверждение удаления
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsMaterial, setSettingsMaterial] = useState<MaterialData | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialData | null>(null);
 
  // Правка последней фиксации («Изменить Итого»)
  const [editFixModalOpen, setEditFixModalOpen] = useState(false);
  const [editFixAmount, setEditFixAmount] = useState('');
  const [editFixNote, setEditFixNote] = useState('');
  // Информационная модалка вместо браузерного alert
  const [infoModal, setInfoModal] = useState<{ open: boolean; text: string }>({ open: false, text: '' }); 
// Полное редактирование материала (шестерёнка)
const [editModalOpen, setEditModalOpen] = useState(false);
const [editName, setEditName] = useState('');
const [editArticle, setEditArticle] = useState('');
const [editUnit, setEditUnit] = useState('PIECE');
const [editSpecQty, setEditSpecQty] = useState('');
const [editNote, setEditNote] = useState('');
  // ⭐ Категории, реально присутствующие в материалах проекта
const availableCategories = useMemo(() => {
  const map = new Map<number, string>();
  materials.forEach(m => {
    if (m.priceItem?.category) {
      map.set(m.priceItem.category.id, m.priceItem.category.name);
    }
  });
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [materials]);

// Поиск + фильтр по категории (двойная фильтрация)
const filteredMaterials = materials.filter(m =>
  (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
   m.article?.toLowerCase().includes(searchQuery.toLowerCase())) &&
  (!categoryFilter || m.priceItem?.category?.id === categoryFilter)
);

  // Сортировка материалов с помощью useMemo
  const sortedMaterials = useMemo(() => {
    if (!sortBy) return filteredMaterials;

    return [...filteredMaterials].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'specQuantity':
          comparison = a.specQuantity - b.specQuantity;
          break;
        case 'totalPrice':
          comparison = a.totalUsed - b.totalUsed;
          break;
        case 'percentage':
          comparison = a.progressPercent - b.progressPercent;
          break;
        default:
          return 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredMaterials, sortBy, sortDirection]);

  // Итоговая строка: суммы по спеке и факту, средний прогресс
const totals = (() => {
  const sumSpecQuantity = filteredMaterials.reduce((acc, m) => acc + (Number(m.specQuantity) || 0), 0);
  const sumTotalUsed = filteredMaterials.reduce((acc, m) => acc + (Number(m.totalUsed) || 0), 0);
  return {
    sumSpecQuantity,
    sumTotalUsed,
    // ⭐ Сумма стоимостей по всем материалам
    sumTotalCost: filteredMaterials.reduce((acc, m) => acc + (Number(m.totalCost) || 0), 0),
    // ⭐ Взвешенный %: общее итого / общее по спец (честнее среднего)
    weightedPercent: sumSpecQuantity > 0
      ? Math.round((sumTotalUsed / sumSpecQuantity) * 100)
      : 0,
  };
})();
useEffect(() => {
  if (!token || !projectId || !objectId) return;
  const loadData = async () => {
    try {
      setLoading(true);
      // Параллельная загрузка материалов, проекта и объекта
      const [materialsData, projectData] = await Promise.all([
        fetchMaterialsByProject(token, parseInt(projectId)),
        fetchProjectById(token, parseInt(projectId)),
      ]);
      setMaterials(materialsData);
      setCurrentProject(projectData);
      // Загружаем объект (для названия)
      //const { fetchObjectById } = await import('../services/objectService');
      const objData = await fetchObjectById(token, parseInt(objectId));
      setCurrentObject(objData);
      setError('');
    } catch (err: any) {
      setError('Ошибка загрузки');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, [token, projectId, objectId]);
const handleOpenAddModal = () => setAddModalOpen(true);
const handleCloseAddModal = () => {
setAddModalOpen(false);
setNewName('');
setNewArticle('');
setNewUnit('PIECE');
setNewSpecQuantity('');
setNewNote('');
setSelectedPriceItem(null);
setPriceOptions([]);
};

// ⭐ Поиск расценок из справочника для Autocomplete
const handlePriceSearch = async (value: string) => {
if (!token) return;
try {
setPriceLoading(true);
const data = await searchPriceItems(token, value || undefined);
setPriceOptions(data);
} catch (err) {
console.error('Ошибка поиска расценок:', err);
} finally {
setPriceLoading(false);
}
};
  const handleCreateMaterial = async () => {
    if (!token || !projectId || !newName.trim()) {
      alert('Введите наименование');
      return;
    }
    const specQty = parseFloat(newSpecQuantity) || 0;
    try {
      const created = await createMaterial(token, {
        name: newName,
        article: newArticle || undefined,
        unit: newUnit,
        specQuantity: specQty,    
        note: newNote || undefined,
        projectId: parseInt(projectId),
        priceItemId: selectedPriceItem?.id ?? undefined,
        });
      setMaterials(prev => [created, ...prev]);
      handleCloseAddModal();
    } catch (err: any) {
      alert('Ошибка при создании материала: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenFixModal = (material: MaterialData) => {
    //setFixingMaterial(material);
    //setFixAmount(0);
    setFixingMaterial(material);
    setFixAmount('');
    setFixNote('');
    setFixModalOpen(true);
  };

  const handleCloseFixModal = () => {
    setFixModalOpen(false);
    setFixingMaterial(null);
  };

  //const handleAddFix = async () => {
    //if (!token || !fixingMaterial || fixAmount <= 0) {
      //alert('Введите объём больше нуля');
      //return;
    //}
    //try {
      //const updated = await addFix(token, fixingMaterial.id, {
        //amount: fixAmount,
  const handleAddFix = async () => {
    const amount = parseFloat(fixAmount);
    if (!token || !fixingMaterial || isNaN(amount) || amount <= 0) {
      alert('Введите объём больше нуля');
      return;
    }
    try {
      const updated = await addFix(token, fixingMaterial.id, {
        amount,
        note: fixNote || undefined,
      });
      setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
      handleCloseFixModal();
    } catch (err: any) {
      alert('Ошибка фиксации: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenSpecModal = (material: MaterialData) => {
    //setEditingMaterial(material);
    //setNewSpecQty(material.specQuantity);
    setEditingMaterial(material);
    setNewSpecQty(String(material.specQuantity));    
    setSpecModalOpen(true);
  };

  const handleCloseSpecModal = () => {
    setSpecModalOpen(false);
    setEditingMaterial(null);
  };

  //const handleUpdateSpec = async () => {
    //if (!token || !editingMaterial || newSpecQty < 0) {
      //alert('Введите корректное количество');
      //return;
    //}
    //try {
      //const updated = await updateSpecQuantity(token, editingMaterial.id, newSpecQty);
  const handleUpdateSpec = async () => {
    const qty = parseFloat(newSpecQty);
    if (!token || !editingMaterial || isNaN(qty) || qty < 0) {
      alert('Введите корректное количество');
      return;
    }
    try {
      const updated = await updateSpecQuantity(token, editingMaterial.id, qty);
      setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
      handleCloseSpecModal();
    } catch (err: any) {
      alert('Ошибка обновления: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleLock = async (material: MaterialData) => {
    if (!token) return;
    try {
      const updated = await toggleSpecLock(token, material.id);
      setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    } catch (err: any) {
      alert('Ошибка: ' + (err.response?.data?.message || err.message));
    }
  };

  // Шестерёнка: открываем настройки материала
  const handleOpenSettings = (material: MaterialData) => {
    setSettingsMaterial(material);
    setSettingsModalOpen(true);
  };

  const handleCloseSettings = () => {
    setSettingsModalOpen(false);
    setSettingsMaterial(null);
  };

  // Из настроек → подтверждение удаления (в стиле объектов/проектов)
  const handleDeleteRequest = () => {
    setDeletingMaterial(settingsMaterial);
    handleCloseSettings();
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!token || !deletingMaterial) return;
    try {
      await deleteMaterial(token, deletingMaterial.id);
      setMaterials(prev => prev.filter(m => m.id !== deletingMaterial.id));
      setDeleteConfirmOpen(false);
      setDeletingMaterial(null);
    } catch (err: any) {
      alert('Ошибка удаления: ' + (err.response?.data?.message || err.message));
    }
  };

// ✏️ Открыть правку последней фиксации (из шестерёнки)
const handleOpenEditFix = async () => {
  if (!token || !settingsMaterial) return;
  try {
    const fixes = await fetchFixesByMaterial(token, settingsMaterial.id);
    if (fixes.length === 0) {
      setInfoModal({ open: true, text: 'У материала ещё нет фиксаций' });
      return;
    }
    const last = fixes[0]; // отсортированы по fixedAt desc
    const ageMs = Date.now() - new Date(last.fixedAt).getTime();
    if (ageMs > 72 * 60 * 60 * 1000) {
      setInfoModal({ open: true, text: 'Исправить можно только фиксацию младше 72 часов' });
      return;
    }
    setEditFixAmount(String(last.amount));
    setEditFixNote(last.note || '');
    setSettingsModalOpen(false);
    setEditFixModalOpen(true);
  } catch (err: any) {
    setInfoModal({ open: true, text: 'Ошибка: ' + (err.response?.data?.message || err.message) });
  }
};

const handleSaveEditFix = async () => {
  const amount = parseFloat(editFixAmount);
  if (!token || !settingsMaterial || isNaN(amount) || amount <= 0) {
    setInfoModal({ open: true, text: 'Введите объём больше нуля' });
    return;
  }
  try {
    const updated = await editLastFix(token, settingsMaterial.id, {
      amount,
      note: editFixNote || undefined,
    });
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditFixModalOpen(false);
  } catch (err: any) {
    setInfoModal({ open: true, text: 'Ошибка: ' + (err.response?.data?.message || err.message) });
  }
};

// ✏️ Полное редактирование: открыть из шестерёнки
const handleOpenEdit = () => {
  if (!settingsMaterial) return;
  setEditName(settingsMaterial.name);
  setEditArticle(settingsMaterial.article || '');
  setEditUnit(settingsMaterial.unit);
  setEditSpecQty(String(settingsMaterial.specQuantity));
  setEditNote(settingsMaterial.note || '');
  setSettingsModalOpen(false);
  setEditModalOpen(true);
};

const handleSaveEdit = async () => {
  if (!token || !settingsMaterial) return;
  if (!editName.trim()) {
    setInfoModal({ open: true, text: 'Введите наименование' });
    return;
  }
  const qty = parseFloat(editSpecQty);
  if (isNaN(qty) || qty < 0) {
    setInfoModal({ open: true, text: 'Введите корректное количество по спецификации' });
    return;
  }
  try {
    const updated = await updateMaterial(token, settingsMaterial.id, {
      name: editName.trim(),
      article: editArticle,
      unit: editUnit,
      specQuantity: qty,
      note: editNote,
    });
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditModalOpen(false);
  } catch (err: any) {
    setInfoModal({ open: true, text: 'Ошибка: ' + (err.response?.data?.message || err.message) });
  }
};
// Применение сортировки из мобильного меню
const applyMobileSort = (
col: 'name' | 'specQuantity' | 'totalPrice' | 'percentage' | null,
dir: 'asc' | 'desc' | null
) => {
setSortBy(col);
setSortDirection(dir);
setSortAnchorEl(null);
};

  // Обработчик клика по заголовку таблицы для сортировки
  const handleSortClick = (sortByColumn: 'name' | 'specQuantity' | 'totalPrice' | 'percentage') => {
    if (sortBy === sortByColumn) {
      // Если уже сортируем по этой колонке → переключаем направление или сбрасываем
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Сброс сортировки
        setSortBy(null);
        setSortDirection(null);
      }
    } else {
      // Новая колонка для сортировки - по возрастанию
      setSortBy(sortByColumn);
      setSortDirection('asc');
    }
  };

  // Отображение иконки сортировки
  const renderSortIcon = (column: 'name' | 'specQuantity' | 'totalPrice' | 'percentage') => {
    if (sortBy !== column) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Верхняя строка с хлебными крошками */}
      <Box sx={{ mb: 2 }}>
        {/* Хлебные крошки: Объекты › Объект › Проект */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          <Typography
            component="button"
            onClick={() => navigate('/objects')}
            sx={{
              background: 'none', border: 'none', padding: 0,
              color: '#1976d2', cursor: 'pointer', fontSize: 14,
              textDecoration: 'underline',
              '&:hover': { color: '#1565c0' },
            }}
          >
            Объекты
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>›</Typography>
          <Typography
            component="button"
            onClick={() => navigate(`/objects/${objectId}/projects`)}
            sx={{
              background: 'none', border: 'none', padding: 0,
              color: '#1976d2', cursor: 'pointer', fontSize: 14,
              textDecoration: 'underline',
              '&:hover': { color: '#1565c0' },
            }}
          >
            {currentObject ? currentObject.name : 'Объект'}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>›</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
            {currentProject ? currentProject.name : 'Проект'}
          </Typography>
        </Box>

        {/* Заголовок с кнопкой назад */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            onClick={() => navigate(`/objects/${objectId}/projects`)}
            sx={{
              mr: 1,
              bgcolor: 'rgba(0, 0, 0, 0.06)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ flexGrow: 1 }}>
            Материал и работы
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

{/* Поиск и кнопка добавления */}
<Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
{isMobile ? (
mobileSearchOpen ? (
<TextField
autoFocus
placeholder="Поиск материалов..."
variant="outlined"
size="small"
fullWidth
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
sx={{ flexGrow: 1 }}
InputProps={{
startAdornment: (
<InputAdornment position="start">
<SearchIcon />
</InputAdornment>
),
endAdornment: (
<InputAdornment position="end">
<IconButton
size="small"
onClick={() => {
setSearchQuery('');
setMobileSearchOpen(false);
}}
>
<CloseIcon fontSize="small" />
</IconButton>
</InputAdornment>
),
}}
/>
) : (
<IconButton
onClick={() => setMobileSearchOpen(true)}
sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}
>
<SearchIcon />
</IconButton>
)
) : (
<TextField
placeholder="Поиск материалов..."
variant="outlined"
size="small"
fullWidth
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
)}
{/* Иконка сортировки (мобилка) — подсвечивается, если сортировка активна */}
{!isMobile && availableCategories.length > 0 && (
<FormControl size="small" sx={{ minWidth: 180 }}>
<InputLabel>Категория</InputLabel>
<Select
value={categoryFilter ?? ''}
label="Категория"
onChange={(e) => setCategoryFilter(e.target.value === '' ? null : Number(e.target.value))}
>
<MenuItem value=""><em>Все категории</em></MenuItem>
{availableCategories.map(cat => (
<MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
))}
</Select>
</FormControl>
)}
{isMobile && (
<IconButton
onClick={(e) => setSortAnchorEl(e.currentTarget)}
sx={{
bgcolor: sortBy ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
color: sortBy ? '#1976d2' : 'inherit',
'&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
}}
>
<SortIcon />
</IconButton>
)}
{isMobile && availableCategories.length > 0 && (
<IconButton
onClick={(e) => setFilterAnchorEl(e.currentTarget)}
sx={{
bgcolor: categoryFilter ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
color: categoryFilter ? '#1976d2' : 'inherit',
'&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
}}
>
<FilterAltIcon />
</IconButton>
)}
{!isMobile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddModal}
            sx={{
              bgcolor: '#4caf50',
              minWidth: '200px',
              '&:hover': {
                bgcolor: '#388e3c',
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              },
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
            }}
          >
            Добавить позицию
          </Button>
        )}
      </Box>
      {/* Мобильное меню сортировки (открывается из иконки) */}
      <Menu
      anchorEl={sortAnchorEl}
      open={Boolean(sortAnchorEl)}
      onClose={() => setSortAnchorEl(null)}
      >
      <MenuItem onClick={() => applyMobileSort(null, null)}>
      <em>По умолчанию</em>
      </MenuItem>
      <MenuItem onClick={() => applyMobileSort('name', 'asc')}>По имени (A→Z)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('name', 'desc')}>По имени (Z→A)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('specQuantity', 'asc')}>По спец. (возрастание)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('specQuantity', 'desc')}>По спец. (убывание)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('totalPrice', 'asc')}>По итогу (возрастание)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('totalPrice', 'desc')}>По итогу (убывание)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('percentage', 'asc')}>По % (возрастание)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('percentage', 'desc')}>По % (убывание)</MenuItem>
      </Menu>

{/* Меню фильтра по категориям (мобилка) */}
<Menu
anchorEl={filterAnchorEl}
open={Boolean(filterAnchorEl)}
onClose={() => setFilterAnchorEl(null)}
>
<MenuItem onClick={() => { setCategoryFilter(null); setFilterAnchorEl(null); }}>
<em>Все категории</em>
</MenuItem>
{availableCategories.map(cat => (
<MenuItem key={cat.id} onClick={() => { setCategoryFilter(cat.id); setFilterAnchorEl(null); }}>
{cat.name}
</MenuItem>
))}
</Menu>
      {/* Таблица для десктопа */}
      {!isMobile && (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>№</TableCell>
                <TableCell 
                  sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }}
                  onClick={() => handleSortClick('name')}
                >
                  Наименование
                  {renderSortIcon('name')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Арт.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ед.</TableCell>
                <TableCell 
                  sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }}
                  onClick={() => handleSortClick('specQuantity')}
                >
                  По спец.
                  {renderSortIcon('specQuantity')}
                </TableCell>
                <TableCell 
                  sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }}
                  onClick={() => handleSortClick('totalPrice')}
                >
                Итого
                {renderSortIcon('totalPrice')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Цена</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Стоимость</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Посл. фикс.</TableCell>
                <TableCell 
                  sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }}
                  onClick={() => handleSortClick('percentage')}
                >
                  %
                  {renderSortIcon('percentage')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedMaterials.map((m, idx) => (
                <TableRow key={m.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.article || '-'}</TableCell>
                  <TableCell>{UNIT_OPTIONS.find(u => u.value === m.unit)?.label || m.unit}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <span>{m.specQuantity}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => m.isSpecLocked ? handleToggleLock(m) : handleOpenSpecModal(m)}
                        sx={{ 
                          bgcolor: m.isSpecLocked ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                          '&:hover': { bgcolor: m.isSpecLocked ? 'rgba(255, 152, 0, 0.2)' : 'rgba(76, 175, 80, 0.2)' }
                        }}
                      >
                        {m.isSpecLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', fontWeight: 600 }}>{m.totalUsed}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                  {m.unitPrice > 0 ? `${m.unitPrice.toLocaleString('ru-RU')} ₽` : '—'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>
                  {m.totalCost > 0 ? `${m.totalCost.toLocaleString('ru-RU')} ₽` : '—'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleOpenFixModal(m)}
                      sx={{ textTransform: 'none', fontSize: 12 }}
                    >
                      + Зафиксировать
                    </Button>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: m.progressPercent >= 100 ? '#4caf50' : '#1976d2' }}>
                    {m.progressPercent}%
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <IconButton size="small" onClick={() => handleOpenSettings(m)}>
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMaterials.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    {materials.length === 0 ? 'Материалы не добавлены' : 'Ничего не найдено'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
            <TableRow sx={{ bgcolor: '#FFF9C4' }}>
            <TableCell colSpan={4} sx={{ fontWeight: 700 }}>ИТОГО:</TableCell>
            <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.sumSpecQuantity}</TableCell>
            <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.sumTotalUsed}</TableCell>
            <TableCell />
            <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
            {totals.sumTotalCost.toLocaleString('ru-RU')} ₽
            </TableCell>
            <TableCell />
            <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.weightedPercent}%</TableCell>
            <TableCell />
            </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}

      {/* Карточки для мобилки */}
      {isMobile && (
        <Stack spacing={2}>
          {sortedMaterials.length > 0 ? (
            sortedMaterials.map((m) => (
              <Paper key={m.id} sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <InventoryIcon sx={{ color: '#1976d2', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {m.name}
                  </Typography>
                  <IconButton size="small" onClick={() => handleOpenSettings(m)}>
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Box>
             <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {m.article || 'Без артикула'} • {UNIT_OPTIONS.find(u => u.value === m.unit)?.label}
              </Typography>
              {/* Прогресс-бар */}
              <LinearProgress
              variant="determinate"
              value={Math.min(m.progressPercent, 100)}
              sx={{
              height: 8,
              borderRadius: 4,
              mb: 1,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
              backgroundColor: m.progressPercent >= 100 ? '#4caf50' : '#1976d2',
              borderRadius: 4,
              },
              }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">По спец.:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body1" fontWeight={600}>{m.specQuantity}</Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => m.isSpecLocked ? handleToggleLock(m) : handleOpenSpecModal(m)}
                      >
                        {m.isSpecLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Итого:</Typography>
                    <Typography variant="body1" fontWeight={600}>{m.totalUsed}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Прогресс:</Typography>
                    <Typography variant="body1" fontWeight={600} color={m.progressPercent >= 100 ? '#4caf50' : '#1976d2'}>
                  {m.progressPercent}%
                  </Typography>
                  </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                  Цена: <b>{m.unitPrice > 0 ? `${m.unitPrice.toLocaleString('ru-RU')} ₽` : '—'}</b>
                  </Typography>
                  <Typography variant="body2">
                  Стоимость: <b>{m.totalCost > 0 ? `${m.totalCost.toLocaleString('ru-RU')} ₽` : '—'}</b>
                  </Typography>
                  </Box>
                  <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={() => handleOpenFixModal(m)}
                  sx={{ mt: 1, bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                >
                  + Зафиксировать объём
                </Button>
              </Paper>
            ))
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {materials.length === 0 ? 'Материалы не добавлены' : 'Ничего не найдено'}
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {/* FAB для мобилки */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }}
          onClick={handleOpenAddModal}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Модалка добавления материала */}
      <Modal open={addModalOpen} onClose={handleCloseAddModal} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 450 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Добавить позицию</Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Наименование"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Артикул"
              value={newArticle}
              onChange={e => setNewArticle(e.target.value)}
            />
            <Autocomplete
            fullWidth
            options={priceOptions}
            loading={priceLoading}
            value={selectedPriceItem}
            onChange={(_e, value) => {
            setSelectedPriceItem(value);
            if (value) {
            setNewUnit(value.unit);
            if (!newName.trim()) setNewName(value.name);
            if (!newArticle.trim() && value.article) setNewArticle(value.article);
            }
            }}
            onInputChange={(_e, value) => handlePriceSearch(value)}
            getOptionLabel={(option) =>
            `${option.name} — ${option.price.toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === option.unit)?.label || option.unit}`
            }
            noOptionsText="Ничего не найдено. Начни вводить название..."
            renderInput={(params) => (
            <TextField {...params} label="Расценка из справочника (необязательно)" placeholder="Начни вводить..." />
            )}
            />
            {selectedPriceItem && (
            <Box sx={{ bgcolor: 'rgba(76, 175, 80, 0.08)', p: 1.5, borderRadius: 1 }}>
            <Typography variant="body2">
            Цена: <strong>{selectedPriceItem.price.toLocaleString('ru-RU')} ₽</strong>
            {' '}• {selectedPriceItem.category?.name || 'Без категории'}
            </Typography>
            </Box>
            )}
            <FormControl fullWidth>
              <InputLabel>Единица измерения</InputLabel>
              <Select
                value={newUnit}
                label="Единица измерения"
                onChange={e => setNewUnit(e.target.value)}
              >
                {UNIT_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Количество по спецификации"
              type="number"
              placeholder="0"
              value={newSpecQuantity}
              onChange={e => setNewSpecQuantity(e.target.value)}
            />
            <TextField
              fullWidth
              label="Примечание"
              multiline
              rows={2}
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseAddModal}>Отмена</Button>
              <Button variant="contained" onClick={handleCreateMaterial}>Сохранить</Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка фиксации объёма */}
      <Modal open={fixModalOpen} onClose={handleCloseFixModal} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>
            Фиксация объёма: {fixingMaterial?.name}
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', p: 2, borderRadius: 1 }}>
              <Typography variant="body2">
                По спецификации: <strong>{fixingMaterial?.specQuantity}</strong> {UNIT_OPTIONS.find(u => u.value === fixingMaterial?.unit)?.label}
              </Typography>
              <Typography variant="body2">
                Уже выполнено: <strong>{fixingMaterial?.totalUsed}</strong> {UNIT_OPTIONS.find(u => u.value === fixingMaterial?.unit)?.label}
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Объём за текущую фиксацию"
              type="number"
              placeholder="0"
              value={fixAmount}
              onChange={e => setFixAmount(e.target.value)}
            />
            <TextField
              fullWidth
              label="Примечание"
              multiline
              rows={2}
              value={fixNote}
              onChange={e => setFixNote(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseFixModal}>Отмена</Button>
              <Button variant="contained" onClick={handleAddFix}>Зафиксировать</Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка изменения спецификации */}
      <Modal open={specModalOpen} onClose={handleCloseSpecModal} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 360 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>
            Изменить количество по спецификации
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Новое количество"
              type="number"
              placeholder="0"
              value={newSpecQty}
              onChange={e => setNewSpecQty(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseSpecModal}>Отмена</Button>
              <Button variant="contained" onClick={handleUpdateSpec}>Сохранить</Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка настроек материала (шестерёнка) */}
      <Modal open={settingsModalOpen} onClose={handleCloseSettings} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 360 },
          p: 3,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Настройки материала</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {settingsMaterial?.name}
          </Typography>
          <Stack spacing={1}>
          <Button
          fullWidth
          variant="outlined"
          onClick={handleOpenEdit}
          >
          Редактировать материал
          </Button>
          <Button
          fullWidth
          variant="outlined"
          onClick={handleOpenEditFix}
          disabled={!settingsMaterial?.lastEntryDate}
          >
          Изменить последнюю фиксацию
          </Button>
          <Button
          fullWidth
          variant="outlined"
          color="error"
          onClick={handleDeleteRequest}
          >
          Удалить материал
          </Button>
            <Button fullWidth variant="text" onClick={handleCloseSettings}>
              Отмена
            </Button>
          </Stack>
        </Paper>
      </Modal>

{/* Модалка правки последней фиксации */}
<Modal open={editFixModalOpen} onClose={() => setEditFixModalOpen(false)} disableRestoreFocus>
<Paper sx={{
position: 'absolute',
top: '50%',
left: '50%',
transform: 'translate(-50%, -50%)',
width: { xs: '90%', sm: 400 },
p: 4,
borderRadius: 2,
}}>
<Typography variant="h6" gutterBottom>Изменить последнюю фиксацию</Typography>
<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
{settingsMaterial?.name} • доступно в течение 72 часов
</Typography>
<Stack spacing={2}>
<TextField
fullWidth
label="Объём фиксации"
type="number"
placeholder="0"
value={editFixAmount}
onChange={e => setEditFixAmount(e.target.value)}
/>
<TextField
fullWidth
label="Примечание"
multiline
rows={2}
value={editFixNote}
onChange={e => setEditFixNote(e.target.value)}
/>
<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
<Button variant="outlined" onClick={() => setEditFixModalOpen(false)}>Отмена</Button>
<Button variant="contained" onClick={handleSaveEditFix}>Сохранить</Button>
</Box>
</Stack>
</Paper>
</Modal>

{/* Информационная модалка вместо браузерного alert */}
<Modal open={infoModal.open} onClose={() => setInfoModal({ open: false, text: '' })} disableRestoreFocus>
<Paper sx={{
position: 'absolute',
top: '50%',
left: '50%',
transform: 'translate(-50%, -50%)',
width: { xs: '90%', sm: 360 },
p: 3,
borderRadius: 2,
textAlign: 'center',
}}>
<ErrorOutlineIcon sx={{ fontSize: 48, color: '#ed6c02', mb: 1 }} />
<Typography variant="h6" gutterBottom>Внимание</Typography>
<Typography sx={{ mb: 3 }}>{infoModal.text}</Typography>
<Button variant="contained" onClick={() => setInfoModal({ open: false, text: '' })}>
Понятно
</Button>
</Paper>
</Modal>

{/* Модалка полного редактирования материала */}
<Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} disableRestoreFocus>
<Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 450 }, p: 4, borderRadius: 2 }}>
<Typography variant="h6" gutterBottom>Редактировать материал</Typography>
<Stack spacing={2}>
<TextField fullWidth label="Наименование" value={editName} onChange={e => setEditName(e.target.value)} required />
<TextField fullWidth label="Артикул" value={editArticle} onChange={e => setEditArticle(e.target.value)} />
<FormControl fullWidth>
<InputLabel>Единица измерения</InputLabel>
<Select value={editUnit} label="Единица измерения" onChange={e => setEditUnit(e.target.value)}>
{UNIT_OPTIONS.map(opt => (
<MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
))}
</Select>
</FormControl>
<TextField
fullWidth
label="Количество по спецификации"
type="number"
value={editSpecQty}
onChange={e => setEditSpecQty(e.target.value)}
disabled={settingsMaterial?.isSpecLocked}
helperText={settingsMaterial?.isSpecLocked ? 'Спека защищена замком — сними замок в таблице, чтобы изменить' : undefined}
/>
<TextField fullWidth label="Примечание" multiline rows={2} value={editNote} onChange={e => setEditNote(e.target.value)} />
<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
<Button variant="outlined" onClick={() => setEditModalOpen(false)}>Отмена</Button>
<Button variant="contained" onClick={handleSaveEdit}>Сохранить</Button>
</Box>
</Stack>
</Paper>
</Modal>
      {/* Модалка подтверждения удаления */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingMaterial(null);
        }}
        disableRestoreFocus
      >
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 360 },
          p: 3,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Подтверждение удаления</Typography>
          <Typography sx={{ mb: 3 }}>
            Вы уверены, что хотите удалить материал <b>"{deletingMaterial?.name}"</b>? Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeletingMaterial(null);
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

export default Materials;