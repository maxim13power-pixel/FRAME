import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
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
  Divider,
  Snackbar,
  Drawer,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AddIcon from '@mui/icons-material/Add';
//import LockIcon from '@mui/icons-material/Lock';
//import LockOpenIcon from '@mui/icons-material/LockOpen';
//import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InventoryIcon from '@mui/icons-material/Inventory';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { useScrollDirection } from '../hooks/useScrollDirection';
import {
  fetchMaterialsByProject,
  createMaterial,
  addFix,
  deleteMaterial,
  fetchFixesByMaterial,
  editLastFix,
  updateMaterial,
  createPriceItemForMaterial,
  duplicateMaterial,
} from '../services/materialService';
import type { MaterialData, MaterialFixData } from '../services/materialService';
import { fetchProjectById } from '../services/materialService';
import type { ProjectData } from '../services/projectService';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { searchPriceItems } from '../services/priceListService';
import type { PriceCatalogData, PriceCategoryData, PriceItemData } from '../services/priceListService';
import { fetchCategoriesWithItems, fetchPriceCatalogs } from '../services/priceListService';
import { getApiErrorText } from '../utils/errors';
import { applyEstimateTemplate, fetchEstimateTemplates } from '../services/estimateTemplateService';
import type { EstimateTemplate } from '../services/estimateTemplateService';
// ⭐ XLSX/PDF-генераторы грузим по требованию (внутри handleExport) — иначе xlsx+pdfmake
// тянутся в бандл страницы «Сметы» и замедляют её открытие.
import type { ExportMeta } from '../utils/exportMaterials';
import { FAB_STYLE } from '../theme';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
// ⭐ №170: пересчёт сметы по справочнику цен (превью «было → станет» + откат)
import { PriceRecalcModal } from '../components/PriceRecalcModal';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов

// ⭐ Мобильный UX: размеры нижнего меню и сводной плашки «Смета/Факт/Освоено».
const BOTTOM_NAV_HEIGHT = 56; // высота BottomNav (MUI BottomNavigation по умолчанию)
const SUMMARY_BAR_BOTTOM = BOTTOM_NAV_HEIGHT + 8; // плашка над меню с зазором 8px
const SUMMARY_LIST_CLEARANCE_PX = 64; // доп. отступ списка, чтобы кнопка «Зафиксировать объём» не пряталась под плашку

// ⭐ №177: запоминаем последний выбранный справочник цен (в модалке «Добавить позицию»)
const PRICE_CATALOG_MEMO_KEY = 'frame:priceCatalogChoice';

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

// ⭐ №177: ступени 1–2 выбора расценки — «Справочник → Категория».
// Используется дважды: для цены работ и для цены материала (выбор независимый).
interface PriceStepSelectsProps {
  catalogChoice: number | '';
  categoryChoice: number | '';
  catalogs: PriceCatalogData[];
  categories: PriceCategoryData[];
  /** действующий справочник проекта (для подписи пункта «по умолчанию») */
  projectCatalogId?: number;
  projectCatalogName: string | null;
  catalogLabel: (c: PriceCatalogData) => string;
  onCatalogChange: (value: number | '') => void;
  onCategoryChange: (value: number | '') => void;
}

// ⭐ №179: вместо двух селектов — компактные чипсы «Справочник ▾ · Категория ▾».
// Тап открывает выбор: на телефоне — боттомшит, на десктопе — меню. Логика ступеней та же.
const PriceStepSelects: React.FC<PriceStepSelectsProps> = ({
  catalogChoice,
  categoryChoice,
  catalogs,
  categories,
  projectCatalogId,
  projectCatalogName,
  catalogLabel,
  onCatalogChange,
  onCategoryChange,
}) => {
  const isPhone = useMediaQuery('(max-width: 599.95px)');
  const [openStep, setOpenStep] = useState<'catalog' | 'category' | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const closeStep = () => {
    setOpenStep(null);
    setAnchorEl(null);
  };

  const openStepWith = (step: 'catalog' | 'category', event: React.MouseEvent<HTMLElement>) => {
    setOpenStep(step);
    setAnchorEl(event.currentTarget);
  };

  const chosenCatalog = catalogs.find((c) => c.id === catalogChoice);
  const catalogCaption =
    catalogChoice === ''
      ? projectCatalogId
        ? projectCatalogName ?? 'справочник проекта'
        : 'все доступные'
      : chosenCatalog
        ? chosenCatalog.name
        : 'справочник';
  const categoryCaption =
    categoryChoice === ''
      ? 'все'
      : categories.find((c) => c.id === categoryChoice)?.name ?? 'категория';

  const chipSx = {
    maxWidth: { xs: '100%', sm: 260 },
    bgcolor: '#fff',
    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
  } as const;

  const stepItems =
    openStep === 'catalog'
      ? [
          <MenuItem
            key="all"
            value=""
            selected={catalogChoice === ''}
            onClick={() => {
              onCatalogChange('');
              closeStep();
            }}
          >
            {projectCatalogId
              ? `По проекту: ${projectCatalogName ?? 'справочник проекта'}`
              : 'Все доступные'}
            {catalogChoice === '' && <CheckIcon fontSize="small" sx={{ ml: 'auto', color: '#1976d2' }} />}
          </MenuItem>,
          ...catalogs.map((c) => (
            <MenuItem
              key={c.id}
              value={c.id}
              selected={catalogChoice === c.id}
              onClick={() => {
                onCatalogChange(c.id);
                closeStep();
              }}
            >
              {catalogLabel(c)}
              {catalogChoice === c.id && <CheckIcon fontSize="small" sx={{ ml: 'auto', color: '#1976d2' }} />}
            </MenuItem>
          )),
        ]
      : [
          <MenuItem
            key="all"
            value=""
            selected={categoryChoice === ''}
            onClick={() => {
              onCategoryChange('');
              closeStep();
            }}
          >
            Все категории
            {categoryChoice === '' && <CheckIcon fontSize="small" sx={{ ml: 'auto', color: '#1976d2' }} />}
          </MenuItem>,
          ...categories.map((c) => (
            <MenuItem
              key={c.id}
              value={c.id}
              selected={categoryChoice === c.id}
              onClick={() => {
                onCategoryChange(c.id);
                closeStep();
              }}
            >
              {c.name} ({c.items?.length ?? 0})
              {categoryChoice === c.id && <CheckIcon fontSize="small" sx={{ ml: 'auto', color: '#1976d2' }} />}
            </MenuItem>
          )),
        ];

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        <Chip
          size="small"
          variant="outlined"
          onClick={(e) => openStepWith('catalog', e)}
          icon={<ArrowDropDownIcon />}
          label={`Справочник: ${catalogCaption}`}
          sx={chipSx}
        />
        <Chip
          size="small"
          variant="outlined"
          onClick={(e) => openStepWith('category', e)}
          icon={<ArrowDropDownIcon />}
          label={`Категория: ${categoryCaption}`}
          sx={chipSx}
        />
      </Stack>

      {isPhone ? (
        <Drawer
          anchor="bottom"
          open={openStep !== null}
          onClose={closeStep}
          // ⭐ №179: модалка «Добавить позицию» тоже Modal — поднимаем шит выше, иначе уедет под неё
          ModalProps={{ sx: { zIndex: 1500 } }}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '70vh',
              pb: 1,
            },
          }}
        >
          <Box sx={{ p: 2, pb: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {openStep === 'catalog' ? 'Справочник' : 'Категория'}
            </Typography>
          </Box>
          <Box sx={{ overflowY: 'auto', py: 1 }}>{stepItems}</Box>
        </Drawer>
      ) : (
        <Menu
          anchorEl={anchorEl}
          open={openStep !== null}
          onClose={closeStep}
          PaperProps={{ sx: { maxHeight: 380, minWidth: 280 } }}
        >
          {stepItems}
        </Menu>
      )}
    </>
  );
};

const Materials: React.FC = () => {
  const { objectId, projectId } = useParams<{ objectId: string; projectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const { notify, error: notifyError } = useFeedback();
  const direction = useScrollDirection();

  // ⭐ №161: deep-link из виджета «Без расценки» → ?materialId=…
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get('materialId')) || null;
  const [highlightVisible, setHighlightVisible] = useState(false);

  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [currentObject, setCurrentObject] = useState<ObjectData | null>(null);
  // ⭐ №170: модалка пересчёта сметы по справочнику
  const [recalcOpen, setRecalcOpen] = useState(false);

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
  // ⭐ Создание новой расценки прямо из модалки добавления
  const [addCreatingNew, setAddCreatingNew] = useState(false);
  const [addPriceName, setAddPriceName] = useState('');
  const [addPriceCategoryId, setAddPriceCategoryId] = useState<number | '' | '__new__'>('');
  const [addPriceCategoryName, setAddPriceCategoryName] = useState('');
  const [addPriceUnit, setAddPriceUnit] = useState('PIECE');
  const [addPricePrice, setAddPricePrice] = useState('');
  // ⭐ Материал из справочника (цена за материал)
const [selectedMaterialItem, setSelectedMaterialItem] = useState<PriceItemData | null>(null);
const [materialOptions, setMaterialOptions] = useState<PriceItemData[]>([]);
const [materialLoading, setMaterialLoading] = useState(false);
const [addMatCreatingNew, setAddMatCreatingNew] = useState(false);
const [addMatPriceName, setAddMatPriceName] = useState('');
const [addMatPriceCategoryId, setAddMatPriceCategoryId] = useState<number | '' | '__new__'>('');
const [addMatPriceCategoryName, setAddMatPriceCategoryName] = useState('');
const [addMatPriceUnit, setAddMatPriceUnit] = useState('PIECE');
const [addMatPricePrice, setAddMatPricePrice] = useState('');
// Категории материалов (kind MATERIAL)
const [materialCategories, setMaterialCategories] = useState<{ id: number; name: string }[]>([]);
// Редактирование: материал из справочника
const [editMaterialItemId, setEditMaterialItemId] = useState<number | null>(null);
const [editSelectedMaterialItem, setEditSelectedMaterialItem] = useState<PriceItemData | null>(null);
const [editMaterialOptions, setEditMaterialOptions] = useState<PriceItemData[]>([]);
const [editMaterialLoading, setEditMaterialLoading] = useState(false);
const [editMatCreatingNew, setEditMatCreatingNew] = useState(false);
const [editMatPriceName, setEditMatPriceName] = useState('');
const [editMatPriceCategoryId, setEditMatPriceCategoryId] = useState<number | '' | '__new__'>('');
const [editMatPriceCategoryName, setEditMatPriceCategoryName] = useState('');
const [editMatPriceUnit, setEditMatPriceUnit] = useState('PIECE');
const [editMatPricePrice, setEditMatPricePrice] = useState('');
  // Модалка фиксации объёма
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [fixingMaterial, setFixingMaterial] = useState<MaterialData | null>(null);
  //const [fixAmount, setFixAmount] = useState<number>(0);
  const [fixAmount, setFixAmount] = useState('');
  const [fixNote, setFixNote] = useState('');
  // ⭐ №174: за какой день фиксация — 0 = сегодня, 1..3 = предыдущие календарные дни
  const [fixDayOffset, setFixDayOffset] = useState(0);
  // ⭐ №174: подсветка/скролл к только что скопированной строке
  const [flashId, setFlashId] = useState<number | null>(null);

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
// Расценка в модалке редактирования
const [editPriceItemId, setEditPriceItemId] = useState<number | null>(null);
const [editSelectedPriceItem, setEditSelectedPriceItem] = useState<PriceItemData | null>(null);
const [editPriceOptions, setEditPriceOptions] = useState<PriceItemData[]>([]);
const [editPriceLoading, setEditPriceLoading] = useState(false);
// Создание новой расценки прямо из модалки
const [editCreatingNew, setEditCreatingNew] = useState(false);
const [newPriceName, setNewPriceName] = useState('');
const [newPriceCategoryId, setNewPriceCategoryId] = useState<number | '' | '__new__'>('');
const [newPriceCategoryName, setNewPriceCategoryName] = useState('');
const [newPriceUnit, setNewPriceUnit] = useState('PIECE');
const [newPricePrice, setNewPricePrice] = useState('');
const [allCategories, setAllCategories] = useState<{ id: number; name: string }[]>([]);
// ⭐ №177: трёхступенчатый выбор «справочник → категория → расценка».
// Работы и материалы выбираются независимо: цена работы может быть из одного
// справочника, цена материала — из другого.
const [catalogOptions, setCatalogOptions] = useState<PriceCatalogData[]>([]);
const [workCatalogChoice, setWorkCatalogChoice] = useState<number | ''>('');
const [workCategoryChoice, setWorkCategoryChoice] = useState<number | ''>('');
const [workCatalogCategories, setWorkCatalogCategories] = useState<PriceCategoryData[]>([]);
const [matCatalogChoice, setMatCatalogChoice] = useState<number | ''>('');
const [matCategoryChoice, setMatCategoryChoice] = useState<number | ''>('');
const [matCatalogCategories, setMatCatalogCategories] = useState<PriceCategoryData[]>([]);
// ⭐ Определяем нужно ли скрывать цены (VIEWER или hidePrices=true)
const hidePrices = currentObject?.hidePrices === true || currentObject?.role === 'VIEWER';
  // №159: смета работает в справочнике проекта — поиск и новые расценки идут в него.
  // ⭐ №164: действующий справочник = свой проекта → справочник объекта → нет.
  // Если справочник не выбран — поиск по всем доступным (прежнее поведение).
  const priceCatalogId =
    currentProject?.effectiveCatalogId ?? currentProject?.catalogId ?? undefined;
  const priceCatalogName =
    currentProject?.effectiveCatalogName ?? currentProject?.catalog?.name ?? null;
  const priceCatalogFromObject = currentProject?.catalogSource === 'object';

// ⭐ №177: действующий справочник ступени 1 ('' = справочник проекта / все доступные)
const workEffectiveCatalogId = workCatalogChoice === '' ? priceCatalogId : Number(workCatalogChoice);
const matEffectiveCatalogId = matCatalogChoice === '' ? priceCatalogId : Number(matCatalogChoice);
// Ступень 2: показываем только категории, в которых в этом справочнике есть расценки
const workCategoryOptions = useMemo(
  () => workCatalogCategories.filter(c => (c.items?.length ?? 0) > 0),
  [workCatalogCategories],
);
const matCategoryOptions = useMemo(
  () => matCatalogCategories.filter(c => (c.items?.length ?? 0) > 0),
  [matCatalogCategories],
);
/** Подпись справочника в селекте: имя + к чему привязан */
const catalogLabel = (c: PriceCatalogData) => {
  if (c.scope === 'object' && c.objectName) return `${c.name} · объект «${c.objectName}»`;
  if (c.scope === 'project' && c.projectName) return `${c.name} · проект «${c.projectName}»`;
  if (c.scope === 'personal') return `${c.name} · мой`;
  return c.name;
};

// ⭐ Экспорт XLSX/PDF (клиентская генерация)
const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
const [exportModalOpen, setExportModalOpen] = useState(false);
// ⭐ Добавление позиций из шаблона сметы в текущий проект
const [templateModalOpen, setTemplateModalOpen] = useState(false);
const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
const [applyingTemplate, setApplyingTemplate] = useState(false);
const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
  open: false,
  message: '',
  severity: 'success',
});

const handleExport = useCallback(
  async (kind: 'xlsx' | 'pdf') => {
    if (materials.length === 0) {
      setSnackbar({ open: true, message: 'Нет материалов для выгрузки', severity: 'error' });
      return;
    }
    setExporting(kind);
    // ⭐ даём React отрисовать спиннер до синхронной генерации файла
    await new Promise((r) => setTimeout(r, 50));
    try {
      const meta: ExportMeta = {
        objectName: currentObject?.name || '',
        projectName: currentProject?.name || '',
        exportedAt: new Date(),
        projectId: projectId ?? '',
      };
      const includePrices = !hidePrices;
      // ⭐ Библиотеки выгрузки подгружаем только при клике (ленивый чанк)
      const { exportMaterialsXlsx, exportMaterialsPdf } = await import('../utils/exportMaterials');
      if (kind === 'xlsx') {
        const fixes: Record<number, MaterialFixData[]> = {};
        await Promise.all(
          materials.map(async (m) => {
            try {
              fixes[m.id] = await fetchFixesByMaterial(m.id);
            } catch {
              fixes[m.id] = [];
            }
          }),
        );
        exportMaterialsXlsx(materials, meta, includePrices, fixes);
      } else {
        exportMaterialsPdf(materials, meta, includePrices);
      }
      setSnackbar({ open: true, message: 'Файл скачан', severity: 'success' });
    } catch (err: unknown) {
      setSnackbar({ open: true, message: getApiErrorText(err, 'Ошибка выгрузки'), severity: 'error' });
    } finally {
      setExporting(null);
    }
  },
  [materials, currentObject, currentProject, projectId, hidePrices],
);
// ⭐ Воронка — ТОЛЬКО категории, которые реально есть в смете этого проекта
  // (категория попадает сюда, если в проекте есть хотя бы одна позиция с ней)
  const projectCategories = useMemo(() => {
    const map = new Map<number, { name: string; count: number }>();
    materials.forEach(m => {
      const seen = new Set<number>();
      [m.priceItem?.category, m.materialItem?.category].forEach(c => {
        if (!c || seen.has(c.id)) return;
        seen.add(c.id);
        const cur = map.get(c.id);
        map.set(c.id, { name: c.name, count: (cur?.count || 0) + 1 });
      });
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials]);

// ⭐ Загрузка категорий из справочника (фильтр + модалки)
const loadCategories = async () => {
  if (!token) return;
  try {
    const [all, mats] = await Promise.all([
      fetchCategoriesWithItems(),
      fetchCategoriesWithItems('MATERIAL'),
    ]);
    setAllCategories(all.map(c => ({ id: c.id, name: c.name })));
    setMaterialCategories(mats.map(c => ({ id: c.id, name: c.name })));
  } catch (e) {
    console.error('Не удалось загрузить категории', e);
  }
};

useEffect(() => {
  loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token]);

// ⭐ №177: ступень 1 — список доступных справочников (системные + свои + объектные/проектные)
useEffect(() => {
  if (!token) return;
  fetchPriceCatalogs()
    .then(setCatalogOptions)
    .catch(() => setCatalogOptions([]));
}, [token]);

// ⭐ №177: ступень 2 — категории перезагружаются при смене справочника
// (в ответе приходят ВСЕ категории вида, но с расценками только из этого справочника;
//  для селекта оставляем те, где есть хотя бы одна расценка)
useEffect(() => {
  if (!token || !addModalOpen) return;
  let cancelled = false;
  fetchCategoriesWithItems('WORK', workEffectiveCatalogId)
    .then(cats => { if (!cancelled) setWorkCatalogCategories(cats); })
    .catch(() => { if (!cancelled) setWorkCatalogCategories([]); });
  return () => { cancelled = true; };
}, [token, addModalOpen, workEffectiveCatalogId]);

useEffect(() => {
  if (!token || !addModalOpen) return;
  let cancelled = false;
  fetchCategoriesWithItems('MATERIAL', matEffectiveCatalogId)
    .then(cats => { if (!cancelled) setMatCatalogCategories(cats); })
    .catch(() => { if (!cancelled) setMatCatalogCategories([]); });
  return () => { cancelled = true; };
}, [token, addModalOpen, matEffectiveCatalogId]);

// Поиск + фильтр по категории (двойная фильтрация)
  const filteredMaterials = materials.filter(m =>
    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.article?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!categoryFilter ||
      m.priceItem?.category?.id === categoryFilter ||
      m.materialItem?.category?.id === categoryFilter)
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
  const sumWorkCurrent = filteredMaterials.reduce((acc, m) => acc + (Number(m.totalCost) || 0), 0);
  const sumMatCurrent = filteredMaterials.reduce((acc, m) => acc + (Number(m.materialTotalCost) || 0), 0);
  const sumWorkEstimate = filteredMaterials.reduce((acc, m) => acc + (Number(m.unitPrice) || 0) * (Number(m.specQuantity) || 0), 0);
  const sumMatEstimate = filteredMaterials.reduce((acc, m) => acc + (Number(m.materialUnitPrice) || 0) * (Number(m.specQuantity) || 0), 0);
  return {
    sumSpecQuantity,
    sumTotalUsed,
    sumWorkCurrent,
    sumMatCurrent,
    sumCurrentTotal: sumWorkCurrent + sumMatCurrent,
    sumWorkEstimate,
    sumMatEstimate,
    sumEstimate: sumWorkEstimate + sumMatEstimate,
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
        fetchMaterialsByProject(parseInt(projectId)),
        fetchProjectById(parseInt(projectId)),
      ]);
      setMaterials(materialsData);
      setCurrentProject(projectData);
      // Загружаем объект (для названия)
      //const { fetchObjectById } = await import('../services/objectService');
      const objData = await fetchObjectById(parseInt(objectId));
      setCurrentObject(objData);
      setError('');
    } catch (err: unknown) {
      setError('Ошибка загрузки');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, [token, projectId, objectId]);

  // ⭐ №161: подсветка строки, на которую перешли из виджета «Без расценки»
  useEffect(() => {
    if (!highlightId || loading || materials.length === 0) return;
    const el = document.getElementById(`material-row-${highlightId}`);
    if (!el) return; // строку не нашли (например, отфильтрована) — молча выходим
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightVisible(true);
    const timer = setTimeout(() => setHighlightVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [highlightId, loading, materials.length]);
  // ⭐ №174: прокрутить к копии и подсветить её — копия создаётся сразу,
  // «вставлять» её никуда не надо (раньше копия молча терялась в отсортированном списке)
  useEffect(() => {
    if (flashId == null) return;
    const el = document.getElementById(`material-row-${flashId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(timer);
  }, [flashId, materials.length]);

const handleOpenAddModal = () => {
  setAddModalOpen(true);
  setAddCreatingNew(false);
  setAddPriceName('');
  setAddPriceCategoryId('');
  setAddPriceCategoryName('');
  setAddPriceUnit('PIECE');
  setAddPricePrice('');
  // ⭐ №177: помним последний выбранный справочник — обычно он один и тот же
  const remembered = Number(localStorage.getItem(PRICE_CATALOG_MEMO_KEY) || '');
  const initialCatalog: number | '' =
    Number.isFinite(remembered) && remembered > 0 ? remembered : '';
  setWorkCatalogChoice(initialCatalog);
  setMatCatalogChoice(initialCatalog);
  setWorkCategoryChoice('');
  setMatCategoryChoice('');
  setPriceOptions([]);
  setMaterialOptions([]);
  // Подгружаем категории для создания новой расценки
  if (token) {
    fetchCategoriesWithItems()
      .then(cats => setAllCategories(cats.map(c => ({ id: c.id, name: c.name }))))
      .catch(e => console.error('Не удалось загрузить категории', e));
  }
};
const handleCloseAddModal = () => {
setAddModalOpen(false);
setNewName('');
setNewArticle('');
setNewUnit('PIECE');
setNewSpecQuantity('');
setNewNote('');
setSelectedPriceItem(null);
setPriceOptions([]);
setAddCreatingNew(false);
setSelectedMaterialItem(null);
setMaterialOptions([]);
setAddMatCreatingNew(false);
setWorkCategoryChoice('');
setMatCategoryChoice('');
};

// ⭐ Поиск расценок из справочника для Autocomplete
// ⭐ №177: ищем внутри выбранного справочника и выбранной категории (ступени 1–2)
const handlePriceSearch = async (value: string) => {
if (!token) return;
try {
setPriceLoading(true);
const data = await searchPriceItems(
  value || undefined,
  workCategoryChoice === '' ? undefined : Number(workCategoryChoice),
  'WORK',
  workEffectiveCatalogId,
);
setPriceOptions(data);
} catch (err) {
console.error('Ошибка поиска расценок:', err);
} finally {
setPriceLoading(false);
}
};
  const handleCreateMaterial = async () => {
    if (!token || !projectId || !newName.trim()) {
      notify('Введите наименование', 'warning');
      return;
    }
    const specQty = parseFloat(newSpecQuantity) || 0;
    try {
      // ⭐ Режим «новая расценка РАБОТЫ»
      let priceItemId: number | undefined = selectedPriceItem?.id ?? undefined;
      if (addCreatingNew) {
        if (!addPriceName.trim()) {
          setInfoModal({ open: true, text: 'Введите название новой расценки' });
          return;
        }
        const price = parseFloat(addPricePrice);
        if (isNaN(price) || price < 0) {
          setInfoModal({ open: true, text: 'Введите корректную цену' });
          return;
        }
        const isNewCat = addPriceCategoryId === '__new__';
        if (isNewCat && !addPriceCategoryName.trim()) {
          setInfoModal({ open: true, text: 'Введите название новой категории' });
          return;
        }
        if (!isNewCat && addPriceCategoryId === '') {
          setInfoModal({ open: true, text: 'Выберите категорию для расценки' });
          return;
        }
        const createdPrice = await createPriceItemForMaterial(
          {
            name: addPriceName.trim(),
            unit: addPriceUnit,
            price,
            categoryId: isNewCat ? 0 : Number(addPriceCategoryId),
          },
          isNewCat ? addPriceCategoryName.trim() : undefined,
          undefined,
          workEffectiveCatalogId
        );
        priceItemId = createdPrice.id;
      }

      // ⭐ Режим «новая расценка МАТЕРИАЛА» (kind MATERIAL)
      let materialItemId: number | undefined = selectedMaterialItem?.id ?? undefined;
      if (addMatCreatingNew) {
        if (!addMatPriceName.trim()) {
          setInfoModal({ open: true, text: 'Введите название новой расценки материала' });
          return;
        }
        const mprice = parseFloat(addMatPricePrice);
        if (isNaN(mprice) || mprice < 0) {
          setInfoModal({ open: true, text: 'Введите корректную цену материала' });
          return;
        }
        const isNewMatCat = addMatPriceCategoryId === '__new__';
        if (isNewMatCat && !addMatPriceCategoryName.trim()) {
          setInfoModal({ open: true, text: 'Введите название новой категории' });
          return;
        }
        if (!isNewMatCat && addMatPriceCategoryId === '') {
          setInfoModal({ open: true, text: 'Выберите категорию для расценки материала' });
          return;
        }
        const createdMatPrice = await createPriceItemForMaterial(
          {
            name: addMatPriceName.trim(),
            unit: addMatPriceUnit,
            price: mprice,
            categoryId: isNewMatCat ? 0 : Number(addMatPriceCategoryId),
          },
          isNewMatCat ? addMatPriceCategoryName.trim() : undefined,
          'MATERIAL',
          matEffectiveCatalogId
        );
        materialItemId = createdMatPrice.id;
      }

      const created = await createMaterial({
        name: newName,
        article: newArticle || undefined,
        unit: newUnit,
        specQuantity: specQty,
        note: newNote || undefined,
        projectId: parseInt(projectId),
        priceItemId,
        materialItemId,
      });
      setMaterials(prev => [created, ...prev]);
      loadCategories();
      handleCloseAddModal();
    } catch (err: unknown) {
      notifyError('Ошибка при создании материала: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

  const handleOpenFixModal = (material: MaterialData) => {
    //setFixingMaterial(material);
    //setFixAmount(0);
    setFixingMaterial(material);
    setFixAmount('');
    setFixNote('');
    setFixDayOffset(0); // ⭐ №174: по умолчанию — сегодня
    setFixModalOpen(true);
  };

  const handleCloseFixModal = () => {
    setFixModalOpen(false);
    setFixingMaterial(null);
  };

  // ⭐ №174: ключ календарного дня устройства (YYYY-MM-DD).
  // offsetDays < 0 — назад. Считаем локально, чтобы «сегодня» не уезжало в UTC.
  const localDateKey = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  // ⭐ №174: подпись кнопки выбора дня фиксации
  const fixDayLabel = (offset: number) => {
    const date = localDateKey(-offset).slice(5).replace('-', '.');
    if (offset === 0) return `Сегодня · ${date}`;
    if (offset === 1) return `Вчера · ${date}`;
    return `${offset} дн. назад · ${date}`;
  };

  //const handleAddFix = async () => {
    //if (!token || !fixingMaterial || fixAmount <= 0) {
      //alert('Введите объём больше нуля');
      //return;
    //}
    //try {
      //const updated = await addFix(fixingMaterial.id, {
        //amount: fixAmount,
  const handleAddFix = async () => {
    const amount = parseFloat(fixAmount);
    if (!token || !fixingMaterial || isNaN(amount) || amount <= 0) {
      notify('Введите объём больше нуля', 'warning');
      return;
    }
    try {
      const updated = await addFix(fixingMaterial.id, {
        amount,
        note: fixNote || undefined,
        // ⭐ №174: дата фиксации задним числом (для сегодняшней не передаём — сервер ставит «сейчас»)
        ...(fixDayOffset > 0 ? { fixedDate: localDateKey(-fixDayOffset) } : {}),
        tzOffset: new Date().getTimezoneOffset(), // окно считаем по календарю устройства
      });
      setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
      handleCloseFixModal();
    } catch (err: unknown) {
      notifyError('Ошибка фиксации: ' + getApiErrorText(err, 'неизвестная ошибка'));
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
      await deleteMaterial(deletingMaterial.id);
      setMaterials(prev => prev.filter(m => m.id !== deletingMaterial.id));
      setDeleteConfirmOpen(false);
      setDeletingMaterial(null);
    } catch (err: unknown) {
      notifyError('Ошибка удаления: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

  // ⭐ №162: копирование строки — копия вставляется сразу под источником
  const handleDuplicate = async (material: MaterialData) => {
    if (!token) return;
    try {
      const copy = await duplicateMaterial(material.id);
      setMaterials(prev => {
        const idx = prev.findIndex(m => m.id === material.id);
        if (idx === -1) return [...prev, copy];
        return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      });
      handleCloseSettings();
      setFlashId(copy.id); // ⭐ №174: прокрутим и подсветим копию
      notify(`Скопировано: ${copy.name}`, 'success');
    } catch (err: unknown) {
      notifyError('Ошибка копирования: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

// ✏️ Открыть правку последней фиксации (из шестерёнки)
const handleOpenEditFix = async () => {
  if (!token || !settingsMaterial) return;
  try {
    const fixes = await fetchFixesByMaterial(settingsMaterial.id);
    if (fixes.length === 0) {
      setInfoModal({ open: true, text: 'У материала ещё нет фиксаций' });
      return;
    }
    // ⭐ №176: правим последнюю ВНЕСЁННУЮ фиксацию (createdAt), а не с самой поздней
    // датой работ — иначе фиксация задним числом не редактировалась вообще.
    const last = [...fixes].sort((a, b) => {
      const byCreated =
        new Date(b.createdAt ?? b.fixedAt).getTime() -
        new Date(a.createdAt ?? a.fixedAt).getTime();
      return byCreated !== 0 ? byCreated : b.id - a.id;
    })[0];
    // ⭐ №174: 72 часа считаем от момента ВНЕСЕНИЯ (createdAt), а не от даты работы
    const fixCreatedAt = new Date(last.createdAt ?? last.fixedAt).getTime();
    if (Date.now() - fixCreatedAt > 72 * 60 * 60 * 1000) {
      setInfoModal({ open: true, text: 'Исправить можно только последнюю внесённую фиксацию, если с момента внесения прошло не больше 72 часов' });
      return;
    }
    setEditFixAmount(String(last.amount));
    setEditFixNote(last.note || '');
    setSettingsModalOpen(false);
    setEditFixModalOpen(true);
  } catch (err: unknown) {
    setInfoModal({ open: true, text: 'Ошибка: ' + getApiErrorText(err, 'неизвестная ошибка') });
  }
};

const handleSaveEditFix = async () => {
  const amount = parseFloat(editFixAmount);
  if (!token || !settingsMaterial || isNaN(amount) || amount <= 0) {
    setInfoModal({ open: true, text: 'Введите объём больше нуля' });
    return;
  }
  try {
    const updated = await editLastFix(settingsMaterial.id, {
      amount,
      note: editFixNote || undefined,
    });
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditFixModalOpen(false);
  } catch (err: unknown) {
    setInfoModal({ open: true, text: 'Ошибка: ' + getApiErrorText(err, 'неизвестная ошибка') });
  }
};

// ✏️ Полное редактирование: открыть из шестерёнки
const handleOpenEdit = async () => {
  if (!settingsMaterial || !token) return;
  setEditName(settingsMaterial.name);
  setEditArticle(settingsMaterial.article || '');
  setEditUnit(settingsMaterial.unit);
  setEditSpecQty(settingsMaterial.specQuantity ? String(settingsMaterial.specQuantity) : '');
  setEditNote(settingsMaterial.note || '');
  setEditPriceItemId(settingsMaterial.priceItemId ?? null);
  setEditSelectedPriceItem(settingsMaterial.priceItem ?? null);
  setEditMaterialItemId(settingsMaterial.materialItemId ?? null);
  setEditSelectedMaterialItem(settingsMaterial.materialItem ?? null);
  setEditMatCreatingNew(false);
  setEditMatPriceName('');
  setEditMatPriceCategoryId('');
  setEditMatPriceCategoryName('');
  setEditMatPriceUnit('PIECE');
  setEditMatPricePrice('');
  setEditCreatingNew(false);
  setNewPriceName('');
  setNewPriceCategoryId('');
  setNewPriceCategoryName('');
  setNewPriceUnit('PIECE');
  setNewPricePrice('');
  setSettingsModalOpen(false);
  setEditModalOpen(true);
  // Подгружаем категории для создания новой расценки
  try {
    const cats = await fetchCategoriesWithItems();
    setAllCategories(cats.map(c => ({ id: c.id, name: c.name })));
  } catch (e) {
    console.error('Не удалось загрузить категории', e);
  }
};

// Поиск расценок для Autocomplete в модалке редактирования
const handleEditPriceSearch = async (value: string) => {
  if (!token) return;
  try {
    setEditPriceLoading(true);
    const data = await searchPriceItems(value || undefined, undefined, 'WORK', priceCatalogId);
    setEditPriceOptions(data);
  } catch (err) {
    console.error('Ошибка поиска расценок:', err);
  } finally {
    setEditPriceLoading(false);
  }
};

// ⭐ Поиск MATERIAL-расценок (модалка добавления)
const handleMaterialPriceSearch = async (value: string) => {
  if (!token) return;
  try {
    setMaterialLoading(true);
    // ⭐ №177: поиск внутри выбранного справочника материала и его категории
    const data = await searchPriceItems(
      value || undefined,
      matCategoryChoice === '' ? undefined : Number(matCategoryChoice),
      'MATERIAL',
      matEffectiveCatalogId,
    );
    setMaterialOptions(data);
  } catch (err) {
    console.error('Ошибка поиска расценок материалов:', err);
  } finally {
    setMaterialLoading(false);
  }
};

// ⭐ Поиск MATERIAL-расценок (модалка редактирования)
const handleEditMaterialPriceSearch = async (value: string) => {
  if (!token) return;
  try {
    setEditMaterialLoading(true);
    const data = await searchPriceItems(value || undefined, undefined, 'MATERIAL', priceCatalogId);
    setEditMaterialOptions(data);
  } catch (err) {
    console.error('Ошибка поиска расценок материалов:', err);
  } finally {
    setEditMaterialLoading(false);
  }
};
const handleSaveEdit = async () => {
  if (!token || !settingsMaterial) return;
  if (!editName.trim()) {
    setInfoModal({ open: true, text: 'Введите наименование' });
    return;
  }
  const qty = editSpecQty.trim() === '' ? 0 : parseFloat(editSpecQty);
  if (isNaN(qty) || qty < 0) {
    setInfoModal({ open: true, text: 'Введите корректное количество по спецификации' });
    return;
  }

  try {
    let priceItemIdToSend: number | null | undefined = editPriceItemId;

    // Если включён режим создания новой расценки — сначала создаём её
    if (editCreatingNew) {
      if (!newPriceName.trim()) {
        setInfoModal({ open: true, text: 'Введите название новой расценки' });
        return;
      }
      const price = parseFloat(newPricePrice);
      if (isNaN(price) || price < 0) {
        setInfoModal({ open: true, text: 'Введите корректную цену' });
        return;
      }
      // ⭐ Тот же паттерн, что в handleCreateMaterial (блок addCreatingNew)
      const isNewCat = newPriceCategoryId === '__new__';
      if (isNewCat && !newPriceCategoryName.trim()) {
        setInfoModal({ open: true, text: 'Введите название новой категории' });
        return;
      }
      if (!isNewCat && newPriceCategoryId === '') {
        setInfoModal({ open: true, text: 'Выберите категорию для расценки' });
        return;
      }
      const createdPrice = await createPriceItemForMaterial(
        {
          name: newPriceName.trim(),
          unit: newPriceUnit,
          price,
          categoryId: isNewCat ? 0 : Number(newPriceCategoryId),
        },
        isNewCat ? newPriceCategoryName.trim() : undefined,
        'WORK',
        priceCatalogId
      );
      priceItemIdToSend = createdPrice.id;
    }
    
    // ⭐ Режим «новая расценка материала» в редактировании
    let materialItemIdToSend: number | null | undefined = editMaterialItemId;
    if (editMatCreatingNew) {
      if (!editMatPriceName.trim()) {
        setInfoModal({ open: true, text: 'Введите название новой расценки материала' });
        return;
      }
      const mprice = parseFloat(editMatPricePrice);
      if (isNaN(mprice) || mprice < 0) {
        setInfoModal({ open: true, text: 'Введите корректную цену материала' });
        return;
      }
      const isNewMatCat = editMatPriceCategoryId === '__new__';
      if (isNewMatCat && !editMatPriceCategoryName.trim()) {
        setInfoModal({ open: true, text: 'Введите название новой категории' });
        return;
      }
      if (!isNewMatCat && editMatPriceCategoryId === '') {
        setInfoModal({ open: true, text: 'Выберите категорию для расценки материала' });
        return;
      }
      const createdMat = await createPriceItemForMaterial(
        {
          name: editMatPriceName.trim(),
          unit: editMatPriceUnit,
          price: mprice,
          categoryId: isNewMatCat ? 0 : Number(editMatPriceCategoryId),
        },
        isNewMatCat ? editMatPriceCategoryName.trim() : undefined,
        'MATERIAL',
        priceCatalogId
      );
      materialItemIdToSend = createdMat.id;
    }

    const updated = await updateMaterial(settingsMaterial.id, {
      name: editName.trim(),
      article: editArticle,
      unit: editUnit,
      specQuantity: qty,
      note: editNote,
      priceItemId: priceItemIdToSend,
      materialItemId: materialItemIdToSend,
    });
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    loadCategories(); // ⭐ обновить категории фильтра
    setEditModalOpen(false);
  } catch (err: unknown) {
    setInfoModal({ open: true, text: 'Ошибка: ' + getApiErrorText(err, 'неизвестная ошибка') });
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

  // ⭐ Добавить позиции из шаблона сметы в текущую смету (кнопка в шапке и в мобильном меню)
  const handleOpenTemplateModal = useCallback(async () => {
    setTemplateModalOpen(true);
    try {
      setTemplates(await fetchEstimateTemplates());
    } catch (err) {
      setTemplates([]);
      notifyError('Не удалось загрузить шаблоны: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  }, [notifyError]);

  const handleApplyTemplate = useCallback(
    async (templateId: number) => {
      if (!projectId) return;
      setApplyingTemplate(true);
      try {
        const res = await applyEstimateTemplate(templateId, parseInt(projectId));
        // ⭐ Перечитываем смету, чтобы новые строки сразу появились в таблице
        setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
        setTemplateModalOpen(false);
        if (res?.created) {
          notify(`Добавлено позиций из шаблона: ${res.created}`, 'success');
        } else {
          notify('В шаблоне нет позиций — смета не изменилась', 'warning');
        }
      } catch (err) {
        notifyError('Не удалось применить шаблон: ' + getApiErrorText(err, 'неизвестная ошибка'));
      } finally {
        setApplyingTemplate(false);
      }
    },
    [projectId, notify, notifyError],
  );

  // ⭐ №170: после пересчёта/отката перечитываем смету (цены строк изменились)
  const handleRecalcApplied = useCallback(async () => {
    if (!projectId) return;
    setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
  }, [projectId]);

  // ⭐ Мобильный хэдер v2: trailing в useMemo — стабильная ссылка, нет бесконечного цикла
  // ⭐ №201: порядок кнопок задан владельцем: архив/экспорт · «из шаблона» · воронка · сортировка
  // (поиск рисует AppHeader последним — он остаётся крайним справа).
  const headerTrailing = useMemo(() => isMobile ? (
    <>
      <IconButton
        onClick={() => setExportModalOpen(true)}
        disabled={exporting !== null}
        aria-label="Экспорт и архив"
        sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', color: '#1976d2', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}
      >
        {exporting ? <CircularProgress size={18} /> : <FileDownloadIcon />}
      </IconButton>
      <IconButton
        onClick={() => { void handleOpenTemplateModal(); }}
        disabled={applyingTemplate}
        aria-label="Добавить из шаблона"
        sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', color: '#1976d2', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}
      >
        {applyingTemplate ? <CircularProgress size={18} /> : <PlaylistAddIcon />}
      </IconButton>
      {projectCategories.length > 0 && (
        <IconButton
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          sx={{
            bgcolor: categoryFilter ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
            color: categoryFilter ? '#1976d2' : '#424242',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
          }}
        >
          <FilterAltIcon />
        </IconButton>
      )}
      <IconButton
        onClick={(e) => setSortAnchorEl(e.currentTarget)}
        sx={{
          bgcolor: sortBy ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.06)',
          color: sortBy ? '#1976d2' : '#424242',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
        }}
      >
        <SortIcon />
      </IconButton>
    </>
    ) : undefined, [isMobile, sortBy, categoryFilter, projectCategories.length, exporting, applyingTemplate, handleOpenTemplateModal]);

  useMobileHeader({
    title: 'Сметы',
    onBack: () => navigate(`/objects/${objectId}/projects`),
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: 'Поиск материалов...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); },
    onSearchChange: (v) => setSearchQuery(v),
    trailing: headerTrailing,
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Заголовок (десктоп; мобилка — в хэдере), крошки ниже */}
            <Box sx={{ mb: { xs: 1, md: 0.5 }, mt: { xs: -2, md: -1.5 } }}> {/* ⭐ на десктопе тоже поднимаем выше */}
        {!isMobile && (
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
              Сметы
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: { xs: 0.5, md: 2 }, ml: 0, flexWrap: 'wrap' }}>
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
          {!hidePrices && (
            <Chip
              size="small"
              title={priceCatalogId ? 'Открыть справочник цен' : 'Справочник не выбран — поиск идёт по всем доступным'}
              label={
                priceCatalogId
                  ? `Справочник: ${priceCatalogName ?? '—'}${priceCatalogFromObject ? ' (объект)' : ''}`
                  : 'Справочник не выбран'
              }
              onClick={priceCatalogId ? () => navigate(`/price-list/${priceCatalogId}`) : undefined}
              sx={{
                ml: { xs: 0, md: 1 },
                height: 24,
                fontSize: 12,
                fontWeight: 600,
                bgcolor: priceCatalogId ? 'rgba(25, 118, 210, 0.10)' : 'rgba(0, 0, 0, 0.05)',
                color: priceCatalogId ? '#1565c0' : 'text.secondary',
                cursor: priceCatalogId ? 'pointer' : 'default',
              }}
            />
          )}
          {!hidePrices && priceCatalogId && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setRecalcOpen(true)}
              title={`Пересчитать цены сметы по справочнику «${priceCatalogName ?? ''}»`}
              sx={{
                ml: { xs: 0, md: 0.5 },
                height: 24,
                minWidth: 0,
                px: 1,
                py: 0,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              {isMobile ? <PriceChangeIcon fontSize="small" /> : 'Пересчитать'}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

   {/* ⭐ №197: одноразовая подсказка раздела */}
   <SectionIntro id="materials" version={1}>
     <b>Смета проекта</b>: «План» — спецификация, «Факт» — сумма фиксаций. Процент и стоимость
     считаются по факту. Фиксацию можно исправить 72 часа, остальное фиксируется навсегда.
   </SectionIntro>

   {/* Поиск и кнопка добавления (десктоп; мобилка — в хэдере) */}
   <Box sx={{ display: 'flex', gap: 1, mb: { xs: 0, md: 2 }, alignItems: 'center' }}>
        {!isMobile && (
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
{!isMobile && projectCategories.length > 0 && (
<FormControl size="small" sx={{ minWidth: 180 }}>
<InputLabel>Категория</InputLabel>
<Select
value={categoryFilter ?? ''}
label="Категория"
onChange={(e) => setCategoryFilter(e.target.value === '' ? null : Number(e.target.value))}
>
<MenuItem value=""><em>Все категории</em></MenuItem>
              {projectCategories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name} ({cat.count})</MenuItem>
              ))}
</Select>
</FormControl>
)}

{!isMobile && !hidePrices && (
  <Button
    variant="contained"
    startIcon={<AddIcon />}
    onClick={handleOpenAddModal}
    sx={{
      bgcolor: '#4caf50',
      border: '2px solid #388e3c',
      minWidth: '200px',
      '&:hover': {
        bgcolor: '#388e3c',
        borderColor: '#388e3c',
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
{!isMobile && (
  <Button
    variant="outlined"
    color="primary"
    size="small"
    onClick={() => setExportModalOpen(true)}
    disabled={exporting !== null}
    sx={{ minWidth: 0, px: 1.5, py: 1, transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' } }}
  >
    {exporting ? <CircularProgress size={16} /> : <FileDownloadIcon fontSize="small" />}
  </Button>
)}
{!isMobile && (
  <Button
    variant="outlined"
    color="primary"
    size="small"
    onClick={() => { void handleOpenTemplateModal(); }}
    disabled={applyingTemplate}
    title="Добавить позиции из шаблона сметы"
    sx={{ minWidth: 0, px: 1.5, py: 1, transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' } }}
  >
    {applyingTemplate ? <CircularProgress size={16} /> : <PlaylistAddIcon fontSize="small" />}
  </Button>
)}
      {/* ⭐ Модалка выбора формата экспорта */}
      <Modal open={exportModalOpen} onClose={() => setExportModalOpen(false)} disableRestoreFocus>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 320 }, p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Скачать</Typography>
          <Stack spacing={1}>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => { setExportModalOpen(false); handleExport('pdf'); }} fullWidth>PDF</Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => { setExportModalOpen(false); handleExport('xlsx'); }} fullWidth>Excel</Button>
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ Модалка «Добавить позиции из шаблона сметы» */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} disableRestoreFocus>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '92%', sm: 440 }, p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Добавить из шаблона</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Позиции шаблона добавятся к текущей смете (сейчас в ней {materials.length}). Существующие
            строки не изменяются.
          </Typography>
          {templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Шаблонов нет. Сохраните смету любого проекта как шаблон: «Проекты» → меню проекта →
              «Сохранить шаблон».
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {templates.map((t) => (
                <Button
                  key={t.id}
                  variant="outlined"
                  disabled={applyingTemplate}
                  onClick={() => { void handleApplyTemplate(t.id); }}
                  sx={{ justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                >
                  <span>{t.name}</span>
                  <span style={{ opacity: 0.7 }}>{t.items?.length ?? 0} поз.</span>
                </Button>
              ))}
            </Stack>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button onClick={() => setTemplateModalOpen(false)}>Закрыть</Button>
          </Box>
        </Paper>
      </Modal>

      {/* ⭐ №170: пересчёт сметы по справочнику (превью + история с откатом) */}
      {priceCatalogId && (
        <PriceRecalcModal
          open={recalcOpen}
          projectId={currentProject?.id ?? Number(projectId)}
          catalogId={priceCatalogId}
          catalogName={priceCatalogName}
          onClose={() => setRecalcOpen(false)}
          onApplied={handleRecalcApplied}
        />
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
        {projectCategories.map(cat => (
          <MenuItem key={cat.id} onClick={() => { setCategoryFilter(cat.id); setFilterAnchorEl(null); }}>
            {cat.name} ({cat.count})
          </MenuItem>
        ))}
</Menu>
      {/* Таблица для десктопа */}
      {!isMobile && (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table sx={{ minWidth: 1500 }}>
<TableHead sx={{ bgcolor: '#f5f5f5' }}>
<TableRow>
<TableCell rowSpan={2} sx={{ fontWeight: 600 }}>№</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }} onClick={() => handleSortClick('name')}>
Наименование{renderSortIcon('name')}
</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Арт.</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Ед. изм.</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }} onClick={() => handleSortClick('specQuantity')}>
Кол-во спец.{renderSortIcon('specQuantity')}
</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }} onClick={() => handleSortClick('totalPrice')}>
Итого на тек. момент, ед.{renderSortIcon('totalPrice')}
</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Посл. фикс., ед.</TableCell>
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }} onClick={() => handleSortClick('percentage')}>
% выполн.{renderSortIcon('percentage')}
</TableCell>
          {/* ⭐ Денежные колонки скрываем полностью при hidePrices */}
          {!hidePrices && <TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Работ на тек. момент, руб.</TableCell>}
          {!hidePrices && <TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Материал на тек. момент, руб.</TableCell>}
          {!hidePrices && <TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Итого на тек. момент, руб.</TableCell>}
          {!hidePrices && <TableCell colSpan={2} sx={{ fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #90caf9' }}>Стоимость работ по смете (руб.)</TableCell>}
          {!hidePrices && <TableCell colSpan={2} sx={{ fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #90caf9' }}>Стоимость материалов по смете (руб.)</TableCell>}
          {!hidePrices && <TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center', borderLeft: '2px solid #90caf9' }}>Итого по смете, руб.</TableCell>}
          <TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center' }}>Действия</TableCell>
        </TableRow>
        {!hidePrices && (
          <TableRow sx={{ bgcolor: '#e3f2fd' }}>
            <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderLeft: '2px solid #90caf9' }}>За ед.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Итого руб.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'right', borderLeft: '2px solid #90caf9' }}>За ед.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Итого руб.</TableCell>
          </TableRow>
        )}
</TableHead>
            <TableBody>
{sortedMaterials.map((m, idx) => (
<TableRow
  key={m.id}
  hover
  id={`material-row-${m.id}`}
  sx={(highlightId === m.id && highlightVisible) || flashId === m.id
    ? { bgcolor: '#fff8e1', transition: 'background-color 0.3s' }
    : undefined}
>
<TableCell>{idx + 1}</TableCell>
<TableCell>{m.name}</TableCell>
<TableCell>{m.article || '-'}</TableCell>
<TableCell>{UNIT_OPTIONS.find(u => u.value === m.unit)?.label || m.unit}</TableCell>
<TableCell sx={{ textAlign: 'center' }}>{m.specQuantity}</TableCell>
<TableCell sx={{ textAlign: 'center', fontWeight: 600 }}>{m.totalUsed}</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>{m.lastEntry ?? '—'}</Typography>
                  <IconButton size="small" sx={{ p: 0.3 }} onClick={() => setInfoModal({ open: true, text: '📷 Раздел фото в разработке — появится в версии 2' })}>
                    <CameraAltIcon sx={{ fontSize: 16, color: '#757575' }} />
                  </IconButton>
                </Box>
                {/* ⭐ Кнопка "+ фикс" скрыта для VIEWER (и на бэке addFix кидает 403) */}
                {!hidePrices && (
                  <Button size="small" variant="outlined" onClick={() => handleOpenFixModal(m)} sx={{ textTransform: 'none', fontSize: 11, mt: 0.5 }}>
                    + фикс
                  </Button>
                )}
              </TableCell>
              <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: m.progressPercent >= 100 ? '#4caf50' : '#1976d2' }}>{m.progressPercent}%</TableCell>
              {/* ⭐ Денежные ячейки скрываем при hidePrices */}
              {!hidePrices && <TableCell sx={{ textAlign: 'right' }}>{m.totalCost > 0 ? `${m.totalCost.toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right' }}>{m.materialTotalCost > 0 ? `${m.materialTotalCost.toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{(m.totalCost + m.materialTotalCost) > 0 ? `${(m.totalCost + m.materialTotalCost).toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', borderLeft: '2px solid #90caf9' }}>{m.unitPrice > 0 ? `${m.unitPrice.toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right' }}>{(m.unitPrice * m.specQuantity) > 0 ? `${(m.unitPrice * m.specQuantity).toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', borderLeft: '2px solid #90caf9' }}>{m.materialUnitPrice > 0 ? `${m.materialUnitPrice.toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right' }}>{(m.materialUnitPrice * m.specQuantity) > 0 ? `${(m.materialUnitPrice * m.specQuantity).toLocaleString('ru-RU')} ₽` : '—'}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, borderLeft: '2px solid #90caf9' }}>
                {((m.unitPrice + m.materialUnitPrice) * m.specQuantity) > 0 ? `${((m.unitPrice + m.materialUnitPrice) * m.specQuantity).toLocaleString('ru-RU')} ₽` : '—'}
              </TableCell>}
              <TableCell sx={{ textAlign: 'center' }}>
                {/* ⭐ Шестерёнка настроек скрыта для VIEWER (и на бэке update/remove/editLastFix кидают 403) */}
                {!hidePrices && (
                  <IconButton size="small" onClick={() => handleOpenSettings(m)} sx={{ bgcolor: 'action.hover' }}>
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                )}
                {/* ⭐ №162: быстрое копирование строки (десктоп) */}
                {!hidePrices && (
                  <IconButton
                    size="small"
                    onClick={() => handleDuplicate(m)}
                    sx={{ bgcolor: 'action.hover', ml: 0.5 }}
                    aria-label="Дублировать строку"
                    title="Дублировать строку"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                )}
              </TableCell>
</TableRow>
))}
{filteredMaterials.length === 0 && (
  <TableRow>
    <TableCell colSpan={hidePrices ? 9 : 17} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
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
              <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.weightedPercent}%</TableCell>
              {/* ⭐ Итоги по деньгам скрываем при hidePrices */}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{totals.sumWorkCurrent.toLocaleString('ru-RU')} ₽</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{totals.sumMatCurrent.toLocaleString('ru-RU')} ₽</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{totals.sumCurrentTotal.toLocaleString('ru-RU')} ₽</TableCell>}
              {!hidePrices && <TableCell sx={{ borderLeft: '2px solid #90caf9' }} />}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{totals.sumWorkEstimate.toLocaleString('ru-RU')} ₽</TableCell>}
              {!hidePrices && <TableCell sx={{ borderLeft: '2px solid #90caf9' }} />}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{totals.sumMatEstimate.toLocaleString('ru-RU')} ₽</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, borderLeft: '2px solid #90caf9' }}>{totals.sumEstimate.toLocaleString('ru-RU')} ₽</TableCell>}
              <TableCell />
</TableRow>
</TableFooter>
          </Table>
        </TableContainer>
      )}

  {/* Карточки для мобилки */}
  {isMobile && (
    <Stack spacing={1} sx={{ pb: direction === 'none' ? 0 : `${SUMMARY_LIST_CLEARANCE_PX}px` }}>
      {sortedMaterials.length > 0 ? (
        sortedMaterials.map((m) => (
            <Paper
              key={m.id}
              id={`material-row-${m.id}`}
              sx={{
                p: 1.5,
                borderRadius: 2,
                ...((highlightId === m.id && highlightVisible) || flashId === m.id
                  ? { bgcolor: '#fff8e1', transition: 'background-color 0.3s' }
                  : {}),
              }}
            >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InventoryIcon sx={{ color: '#1976d2', mr: 1, fontSize: 22 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                {m.name}
              </Typography>
              {/* ⭐ Шестерёнка настроек скрыта для VIEWER */}
              {!hidePrices && (
                <IconButton size="small" onClick={() => handleOpenSettings(m)} sx={{ bgcolor: 'action.hover' }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {m.article || 'Без артикула'} • {UNIT_OPTIONS.find(u => u.value === m.unit)?.label}
                </Typography>
                {/* Прогресс-бар с процентом справа */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(m.progressPercent, 100)}
                    sx={{
                      height: 8, borderRadius: 4, flexGrow: 1, bgcolor: '#e0e0e0',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: m.progressPercent >= 100 ? '#4caf50' : '#1976d2',
                        borderRadius: 4,
                      },
                    }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ color: m.progressPercent >= 100 ? '#4caf50' : '#1976d2', minWidth: 40, textAlign: 'right' }}>
                    {m.progressPercent}%
                  </Typography>
                </Box>
                {/* Ключевые цифры в одну строку */}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <Box component="span" color="text.secondary">Спец:</Box> <b>{m.specQuantity}</b>
                  {' • '}<Box component="span" color="text.secondary">Итого:</Box> <b>{m.totalUsed}</b>
                  {' • '}<Box component="span" color="text.secondary">Посл.:</Box> <b>{m.lastEntry ?? '—'}</b>
                </Typography>
            {/* ⭐ Блок "На текущий момент" — полностью скрыт при hidePrices */}
            {!hidePrices && (
              <Box sx={{ bgcolor: '#f5f9ff', borderRadius: 1.5, p: 1, mb: 1, border: '1px solid #e3edf8' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">Работы:</Typography>
                  <Typography variant="caption" fontWeight={600}>{m.totalCost > 0 ? `${m.totalCost.toLocaleString('ru-RU')} ₽` : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">Материалы:</Typography>
                  <Typography variant="caption" fontWeight={600}>{m.materialTotalCost > 0 ? `${m.materialTotalCost.toLocaleString('ru-RU')} ₽` : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" fontWeight={700}>Итого:</Typography>
                  <Typography variant="body2" fontWeight={700} color="#1976d2">
                    {(m.totalCost + m.materialTotalCost) > 0 ? `${(m.totalCost + m.materialTotalCost).toLocaleString('ru-RU')} ₽` : '—'}
                  </Typography>
                </Box>
              </Box>
            )}
              <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setInfoModal({ open: true, text: '📷 Раздел фото в разработке — появится в версии 2' })}
                aria-label="Фотофиксация"
                sx={{
                  minWidth: 48,
                  color: '#757575',
                  borderColor: '#bdbdbd',
                  '&:hover': { borderColor: '#757575', bgcolor: 'rgba(0,0,0,0.04)' },
                }}
              >
                <CameraAltIcon fontSize="small" />
              </Button>
              {/* ⭐ Кнопка фиксации скрыта для VIEWER */}
              {!hidePrices && (
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={() => handleOpenFixModal(m)}
                  sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                >
                  + Зафиксировать объём
                </Button>
              )}
            </Box>
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

{/* ⭐ 6.7 Липкая плашка итогов — деньги скрыты при hidePrices, процент остаётся */}
{isMobile && (
  <Paper
    elevation={8}
    sx={{
      position: direction === 'none' ? 'static' : 'fixed',
      bottom: SUMMARY_BAR_BOTTOM,
      left: 8,
      right: 8,
      zIndex: 9, // < zIndex BottomNav (10) — при скролле плашка уезжает ПОД меню
      borderRadius: 2,
      bgcolor: '#fff',
      px: 2,
      py: 1,
      border: '1px solid #e0e0e0',
      mt: direction === 'none' ? 1 : 0,
      transform:
        direction === 'down'
          ? `translateY(calc(100% + ${SUMMARY_BAR_BOTTOM}px))`
          : 'translateY(0)',
      transition: 'transform 0.2s ease',
    }}
  >
    {hidePrices ? (
      // Для VIEWER показываем только процент
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Освоено</Typography>
        <Typography variant="body2" fontWeight={700} color={totals.weightedPercent >= 100 ? '#4caf50' : '#ef6c00'}>
          {totals.weightedPercent}%
        </Typography>
      </Box>
    ) : (
      // Для остальных показываем всё
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Смета</Typography>
          <Typography variant="body2" fontWeight={700}>
            {totals.sumEstimate.toLocaleString('ru-RU')} ₽
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Факт</Typography>
          <Typography variant="body2" fontWeight={700} color="#1976d2">
            {totals.sumCurrentTotal.toLocaleString('ru-RU')} ₽
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Освоено</Typography>
          <Typography variant="body2" fontWeight={700} color={totals.weightedPercent >= 100 ? '#4caf50' : '#ef6c00'}>
            {totals.weightedPercent}%
          </Typography>
        </Box>
      </Box>
    )}
  </Paper>
)}
{/* FAB для мобилки (поднят выше плашки итогов) — скрыт при hidePrices */}
{isMobile && !hidePrices && (
  <Fab
    color="primary"
    sx={{ ...FAB_STYLE, bottom: 130 }}
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
        maxHeight: '90vh',
        overflowY: 'auto',
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
     {/* ⭐ Компактно: количество + единица на одном этаже */}
     <Stack direction="row" spacing={2}>
       <TextField
         fullWidth
         label="Кол-во по спецификации"
         type="number"
         placeholder="0"
         value={newSpecQuantity}
         onChange={e => setNewSpecQuantity(e.target.value)}
       />
       <FormControl fullWidth sx={{ maxWidth: 100 }}>
         <InputLabel>Ед. изм.</InputLabel>
         <Select
           value={newUnit}
           label="Ед. изм."
           onChange={e => setNewUnit(e.target.value)}
         >
           {UNIT_OPTIONS.map(opt => (
             <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
           ))}
         </Select>
       </FormControl>
     </Stack>
        <TextField
          fullWidth
          label="Примечание"
          multiline
          rows={2}
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
        />
        <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена работ</Typography></Divider>
        {/* ⭐ №177: ступени 1–2 — справочник и категория (ступень 3 — расценка ниже) */}
        <PriceStepSelects
          catalogChoice={workCatalogChoice}
          categoryChoice={workCategoryChoice}
          catalogs={catalogOptions}
          categories={workCategoryOptions}
          projectCatalogId={priceCatalogId}
          projectCatalogName={priceCatalogName}
          catalogLabel={catalogLabel}
          onCatalogChange={(v) => {
            setWorkCatalogChoice(v);
            setWorkCategoryChoice('');
            setSelectedPriceItem(null);
            setPriceOptions([]);
            if (v !== '') localStorage.setItem(PRICE_CATALOG_MEMO_KEY, String(v));
          }}
          onCategoryChange={(v) => {
            setWorkCategoryChoice(v);
            setSelectedPriceItem(null);
            setPriceOptions([]);
          }}
        />
        {!addCreatingNew ? (
            <>
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
onOpen={() => { if (priceOptions.length === 0) handlePriceSearch(''); }}
// ⭐ №179: доверяем серверному поиску (он ищет и по цене) — клиентский фильтр по подписи мешал
filterOptions={(opts) => opts}
renderInput={(params) => (
<TextField {...params} label="Стоимость работ" placeholder="Название или цена..." />
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
            <Button size="small" variant="text" onClick={() => { setAddCreatingNew(true); setAddPriceName(newName); }}>
              ➕ Создать новую расценку
            </Button>
            </>
            ) : (
            <>
            <Typography variant="subtitle2" color="primary">Создать новую расценку</Typography>
            <TextField fullWidth label="Название расценки" value={addPriceName} onChange={e => setAddPriceName(e.target.value)} />
            <FormControl fullWidth>
            <InputLabel>Категория</InputLabel>
            <Select
            value={addPriceCategoryId}
            label="Категория"
            onChange={e => setAddPriceCategoryId(e.target.value as number | '' | '__new__')}
            >
            <MenuItem value="__new__"><em>➕ Создать новую категорию...</em></MenuItem>
            {allCategories.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
            </Select>
            </FormControl>
            {addPriceCategoryId === '__new__' && (
            <TextField fullWidth label="Название новой категории" value={addPriceCategoryName} onChange={e => setAddPriceCategoryName(e.target.value)} />
            )}
 {/* ⭐ Компактно: цена + единица на одном этаже */}
 <Stack direction="row" spacing={2}>
   <TextField fullWidth label="Цена, ₽" type="number" value={addPricePrice} onChange={e => setAddPricePrice(e.target.value)} />
   <FormControl fullWidth sx={{ maxWidth: 100 }}>
     <InputLabel>Ед. изм.</InputLabel>
     <Select value={addPriceUnit} label="Ед. изм." onChange={e => setAddPriceUnit(e.target.value)}>
       {UNIT_OPTIONS.map(opt => (
         <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
       ))}
     </Select>
   </FormControl>
 </Stack>
            <Button size="small" variant="text" onClick={() => setAddCreatingNew(false)}>
              ← Выбрать из существующих
            </Button>
            </>
            )}
            
    <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена материала</Typography></Divider>
    {/* ⭐ №177: у материала свой справочник и своя категория — можно взять из другого справочника */}
    <PriceStepSelects
      catalogChoice={matCatalogChoice}
      categoryChoice={matCategoryChoice}
      catalogs={catalogOptions}
      categories={matCategoryOptions}
      projectCatalogId={priceCatalogId}
      projectCatalogName={priceCatalogName}
      catalogLabel={catalogLabel}
      onCatalogChange={(v) => {
        setMatCatalogChoice(v);
        setMatCategoryChoice('');
        setSelectedMaterialItem(null);
        setMaterialOptions([]);
        if (v !== '') localStorage.setItem(PRICE_CATALOG_MEMO_KEY, String(v));
      }}
      onCategoryChange={(v) => {
        setMatCategoryChoice(v);
        setSelectedMaterialItem(null);
        setMaterialOptions([]);
      }}
    />
    {!addMatCreatingNew ? (
    <>
    <Autocomplete
    fullWidth
    options={materialOptions}
    loading={materialLoading}
    value={selectedMaterialItem}
    onChange={(_e, value) => setSelectedMaterialItem(value)}
    onInputChange={(_e, value) => handleMaterialPriceSearch(value)}
    getOptionLabel={(o) => `${o.name} — ${o.price.toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`}
    noOptionsText="Ничего не найдено"
    onOpen={() => { if (materialOptions.length === 0) handleMaterialPriceSearch(''); }}
    // ⭐ №179: доверяем серверному поиску (он ищет и по цене)
    filterOptions={(opts) => opts}
    renderInput={(params) => (
    <TextField {...params} label="Стоимость материала" placeholder="Название или цена..." />
    )}
    />
    {selectedMaterialItem && (
    <Box sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', p: 1.5, borderRadius: 1 }}>
    <Typography variant="body2">
    Цена: <strong>{selectedMaterialItem.price.toLocaleString('ru-RU')} ₽</strong> • {selectedMaterialItem.category?.name || 'Без категории'}
    </Typography>
    </Box>
    )}
    <Button size="small" variant="text" onClick={() => { setAddMatCreatingNew(true); setAddMatPriceName(newName); }}>
      ➕ Создать новую расценку материала
    </Button>
    </>
    ) : (
    <>
    <Typography variant="subtitle2" color="primary">Новая расценка материала</Typography>
    <TextField fullWidth label="Название расценки" value={addMatPriceName} onChange={e => setAddMatPriceName(e.target.value)} />
    <FormControl fullWidth>
    <InputLabel>Категория</InputLabel>
    <Select value={addMatPriceCategoryId} label="Категория" onChange={e => setAddMatPriceCategoryId(e.target.value as number | '' | '__new__')}>
    <MenuItem value="__new__"><em>➕ Создать новую категорию...</em></MenuItem>
    {materialCategories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
    </Select>
    </FormControl>
    {addMatPriceCategoryId === '__new__' && (
    <TextField fullWidth label="Название новой категории" value={addMatPriceCategoryName} onChange={e => setAddMatPriceCategoryName(e.target.value)} />
    )}
 {/* ⭐ Компактно: цена + единица на одном этаже */}
 <Stack direction="row" spacing={2}>
   <TextField fullWidth label="Цена, ₽" type="number" value={addMatPricePrice} onChange={e => setAddMatPricePrice(e.target.value)} />
   <FormControl fullWidth sx={{ maxWidth: 100 }}>
     <InputLabel>Ед. изм.</InputLabel>
     <Select value={addMatPriceUnit} label="Ед. изм." onChange={e => setAddMatPriceUnit(e.target.value)}>
       {UNIT_OPTIONS.map(opt => (
         <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
       ))}
     </Select>
   </FormControl>
 </Stack>
        <Button size="small" variant="text" onClick={() => setAddMatCreatingNew(false)}>
          ← Выбрать из существующих
        </Button>
        </>
        )}  
<Box sx={{
  display: 'flex', justifyContent: 'flex-end', gap: 2,
  position: 'sticky', bottom: 0, zIndex: 2,
  mx: -2, px: 2, py: 1.5,
  bgcolor: '#fff',
  boxShadow: '0 -6px 12px rgba(0, 0, 0, 0.08)',
  borderRadius: '0 0 16px 16px',
}}>
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
            {/* ⭐ №174: за какой день фиксация. В будущее нельзя, назад — 3 дня
                (в пятницу забыл → в понедельник вносишь задним числом) */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                За какой день · назад можно 3 дня
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                {[0, 1, 2, 3].map(offset => (
                  <Button
                    key={offset}
                    size="small"
                    variant={fixDayOffset === offset ? 'contained' : 'outlined'}
                    onClick={() => setFixDayOffset(offset)}
                    sx={{ px: 1, minWidth: 0, fontSize: 12 }}
                  >
                    {fixDayLabel(offset)}
                  </Button>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Будущее запрещено. Внесённую фиксацию можно исправить 72 часа.
              </Typography>
            </Box>
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
          {/* ⭐ №162: копия строки — доступна и с мобилы через меню настроек */}
          <Button
          fullWidth
          variant="outlined"
          onClick={() => settingsMaterial && handleDuplicate(settingsMaterial)}
          >
          Дублировать строку
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
      <Paper sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: 450 }, maxHeight: '90vh', overflowY: 'auto', p: 4, borderRadius: 2,
        // ⭐ Видимый скроллбар на мобилке
      }}>
<Typography variant="h6" gutterBottom>Редактировать материал</Typography>
<Stack spacing={2}>
<TextField fullWidth label="Наименование" value={editName} onChange={e => setEditName(e.target.value)} required />
<TextField fullWidth label="Артикул" value={editArticle} onChange={e => setEditArticle(e.target.value)} />

{/* ⭐ Компактно: количество + единица на одном этаже */}
<Stack direction="row" spacing={2}>
  <TextField
    fullWidth
    label="Кол-во по спецификации"
    type="number"
    placeholder="0"
    value={editSpecQty}
    onChange={e => setEditSpecQty(e.target.value)}
  />
  <FormControl fullWidth sx={{ maxWidth: 100 }}>
    <InputLabel>Ед. изм.</InputLabel>
    <Select value={editUnit} label="Ед. изм." onChange={e => setEditUnit(e.target.value)}>
      {UNIT_OPTIONS.map(opt => (
        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
</Stack>
<TextField fullWidth label="Примечание" multiline rows={2} value={editNote} onChange={e => setEditNote(e.target.value)} />

<Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена работ</Typography></Divider>
{!editCreatingNew ? (
  <>
    <Autocomplete
      fullWidth
      options={editPriceOptions}
      loading={editPriceLoading}
      value={editSelectedPriceItem}
      onChange={(_e, value) => {
        // Специальное значение — открыть режим создания
        if ((value as { __new__?: boolean } | null)?.__new__) {
          setEditCreatingNew(true);
          setNewPriceName(editName); // подставляем название материала
          return;
        }
        setEditSelectedPriceItem(value);
        setEditPriceItemId(value?.id ?? null);
      }}
      onInputChange={(_e, value) => handleEditPriceSearch(value)}
      getOptionLabel={(option) => {
        if ((option as { __new__?: boolean } | null)?.__new__) return '➕ Создать новую расценку...';
        const o = option as PriceItemData;
        return `${o.name} — ${o.price.toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`;
      }}
      noOptionsText="Ничего не найдено"
      // ⭐ №179: серверный поиск ищет и по цене — клиентский фильтр не должен его портить
      filterOptions={(opts) => opts}
      renderInput={(params) => (
        <TextField {...params} label="Работы из справочника" placeholder="Название или цена..." />
      )}
      onOpen={() => { if (editPriceOptions.length === 0) handleEditPriceSearch(''); }}
    />
    {editSelectedPriceItem && (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Текущая цена: <b>{editSelectedPriceItem.price.toLocaleString('ru-RU')} ₽</b>
          {' '}• {editSelectedPriceItem.category?.name || 'Без категории'}
        </Typography>
        <Button size="small" onClick={() => { setEditSelectedPriceItem(null); setEditPriceItemId(null); }}>
          Сбросить
        </Button>
      </Box>
    )}
    {!editSelectedPriceItem && (
      <Button size="small" variant="text" onClick={() => {
        setEditCreatingNew(true);
        setNewPriceName(editName);
      }}>
        ➕ Создать новую расценку
      </Button>
    )}
  </>
) : (
  <>
    <Typography variant="subtitle2" color="primary">Создать новую расценку</Typography>
    <TextField fullWidth label="Название расценки" value={newPriceName} onChange={e => setNewPriceName(e.target.value)} />
    <FormControl fullWidth>
      <InputLabel>Категория</InputLabel>
      <Select
        value={newPriceCategoryId}
        label="Категория"
        onChange={e => setNewPriceCategoryId(e.target.value as number | '' | '__new__')}
      >
        <MenuItem value="__new__">
          <em>➕ Создать новую категорию...</em>
        </MenuItem>
        {allCategories.map(c => (
          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
    {newPriceCategoryId === '__new__' && (
      <TextField fullWidth label="Название новой категории" value={newPriceCategoryName} onChange={e => setNewPriceCategoryName(e.target.value)} />
    )}
 {/* ⭐ Компактно: цена + единица на одном этаже */}
 <Stack direction="row" spacing={2}>
   <TextField fullWidth label="Цена, ₽" type="number" value={newPricePrice} onChange={e => setNewPricePrice(e.target.value)} />
   <FormControl fullWidth sx={{ maxWidth: 100 }}>
     <InputLabel>Ед. изм.</InputLabel>
     <Select value={newPriceUnit} label="Ед. изм." onChange={e => setNewPriceUnit(e.target.value)}>
       {UNIT_OPTIONS.map(opt => (
         <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
       ))}
     </Select>
   </FormControl>
 </Stack>
    <Button size="small" variant="text" onClick={() => setEditCreatingNew(false)}>
      ← Выбрать из существующих
    </Button>
  </>
)}

<Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена материала</Typography></Divider>
{!editMatCreatingNew ? (
<>
<Autocomplete
fullWidth
options={editMaterialOptions}
loading={editMaterialLoading}
value={editSelectedMaterialItem}
onChange={(_e, value) => { setEditSelectedMaterialItem(value); setEditMaterialItemId(value?.id ?? null); }}
onInputChange={(_e, value) => handleEditMaterialPriceSearch(value)}
getOptionLabel={(o) => `${o.name} — ${o.price.toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`}
noOptionsText="Ничего не найдено"
onOpen={() => { if (editMaterialOptions.length === 0) handleEditMaterialPriceSearch(''); }}
filterOptions={(opts) => opts}
renderInput={(params) => (
<TextField {...params} label="Материал из справочника" placeholder="Название или цена..." />
)}
/>
{editSelectedMaterialItem && (
<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
<Typography variant="body2" color="text.secondary">
Цена: <b>{editSelectedMaterialItem.price.toLocaleString('ru-RU')} ₽</b> • {editSelectedMaterialItem.category?.name || 'Без категории'}
</Typography>
<Button size="small" onClick={() => { setEditSelectedMaterialItem(null); setEditMaterialItemId(null); }}>Сбросить</Button>
</Box>
)}
{!editSelectedMaterialItem && (
<Button size="small" variant="text" onClick={() => { setEditMatCreatingNew(true); setEditMatPriceName(editName); }}>
➕ Создать новую расценку материала
</Button>
)}
</>
) : (
<>
<Typography variant="subtitle2" color="primary">Новая расценка материала</Typography>
<TextField fullWidth label="Название расценки" value={editMatPriceName} onChange={e => setEditMatPriceName(e.target.value)} />
<FormControl fullWidth>
<InputLabel>Категория</InputLabel>
<Select value={editMatPriceCategoryId} label="Категория" onChange={e => setEditMatPriceCategoryId(e.target.value as number | '' | '__new__')}>
<MenuItem value="__new__"><em>➕ Создать новую категорию...</em></MenuItem>
{materialCategories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
</Select>
</FormControl>
{editMatPriceCategoryId === '__new__' && (
<TextField fullWidth label="Название новой категории" value={editMatPriceCategoryName} onChange={e => setEditMatPriceCategoryName(e.target.value)} />
)}
 {/* ⭐ Компактно: цена + единица на одном этаже */}
 <Stack direction="row" spacing={2}>
   <TextField fullWidth label="Цена, ₽" type="number" value={editMatPricePrice} onChange={e => setEditMatPricePrice(e.target.value)} />
   <FormControl fullWidth sx={{ maxWidth: 100 }}>
     <InputLabel>Ед. изм.</InputLabel>
     <Select value={editMatPriceUnit} label="Ед. изм." onChange={e => setEditMatPriceUnit(e.target.value)}>
       {UNIT_OPTIONS.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
     </Select>
   </FormControl>
 </Stack>
<Button size="small" variant="text" onClick={() => setEditMatCreatingNew(false)}>← Выбрать из существующих</Button>
</>
)}
<Box sx={{
  display: 'flex', justifyContent: 'flex-end', gap: 2,
  position: 'sticky', bottom: 0, zIndex: 2,
  mx: -2, px: 2, py: 1.5,
  bgcolor: '#fff',
  boxShadow: '0 -6px 12px rgba(0, 0, 0, 0.08)',
  borderRadius: '0 0 16px 16px',
}}>
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

      {/* ⭐ Snackbar для экспорта (успех/ошибка) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Materials;