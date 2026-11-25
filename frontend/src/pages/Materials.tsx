import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
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
  Divider,
  Snackbar,
  Drawer,
  Checkbox,
  FormControlLabel,
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
import DeleteIcon from '@mui/icons-material/Delete'; // ⭐ №290: удаление шаблона
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import PhotoGalleryDialog from '../components/PhotoGalleryDialog'; // ⭐ №228: фото-фиксация
import PhotoCaptureDialog from '../components/PhotoCaptureDialog'; // ⭐ №228
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import {
  fetchMaterialsByProject,
  createMaterial,
  addFix,
  deleteMaterial,
  fetchFixesByMaterial,
  fetchFixesByProject,
  editLastFix,
  updateMaterial,
  createPriceItemForMaterial,
  duplicateMaterial,
  duplicateMaterialsBulk,
  deleteMaterialsBulk,
  syncMaterialPrice,
  toggleSpecLock,
} from '../services/materialService';
import type { MaterialData, MaterialFixData } from '../services/materialService';
import { fetchProjectById } from '../services/materialService';
import type { ProjectData } from '../services/projectService';
import { updateProject } from '../services/projectService';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { searchPriceItems } from '../services/priceListService';
import type { PriceCatalogData, PriceCategoryData, PriceItemData } from '../services/priceListService';
import { fetchCategoriesWithItems, fetchPriceCatalogs, updatePriceItem } from '../services/priceListService';
import { getApiErrorText } from '../utils/errors';
// ⭐ №393: dev-счётчик рендеров (в production-сборке — no-op)
import { countRender } from '../utils/perf';
// ⭐ №393: строка/карточка сметы и прокруточная обвязка вынесены в memo-компоненты
import { MaterialRow } from '../components/materials/MaterialRow';
import { MaterialCard } from '../components/materials/MaterialCard';
import { EstimateScrollChrome } from '../components/materials/EstimateScrollChrome';
import { UNIT_OPTIONS, rub, unitLabelOf } from '../components/materials/estimateFormat';
import { SUMMARY_BAR_BOTTOM } from '../components/materials/estimateLayout';
import { applyEstimateTemplate, deleteEstimateTemplate, fetchEstimateTemplates } from '../services/estimateTemplateService';
import type { EstimateTemplate } from '../services/estimateTemplateService';
// ⭐ №290: «Добавить из шаблона» — смета из любого доступного проекта (как при создании проекта)
import { copyEstimateFromProject, fetchAvailableProjects } from '../services/projectService';
import type { AvailableProject } from '../services/projectService';
// ⭐ XLSX/PDF-генераторы грузим по требованию (внутри handleExport) — иначе xlsx+pdfmake
// тянутся в бандл страницы «Сметы» и замедляют её открытие.
import type { ExportMeta } from '../utils/exportMaterials';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PrintIcon from '@mui/icons-material/Print';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
// ⭐ №170: пересчёт сметы по справочнику цен (превью «было → станет» + откат)
import { PriceRecalcModal } from '../components/PriceRecalcModal';
import EstimateImportModal from '../components/EstimateImportModal'; // ⭐ №202: импорт сметы из Excel
// ⭐ №305: свежие фото/фиксации с других устройств — без F5
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов

// ⭐ Мобильный UX: размеры нижнего меню и сводной плашки «Смета/Факт/Освоено»
// переехали в `components/materials/estimateLayout.ts` (⭐ №393) — их использует
// и вынесенная прокруточная обвязка.
// ⭐ №388/389: у низа списка FAB остаётся (владелец просил вернуть), но плашка страниц
// резервирует справа 56 px под него — «Свернуть» и кнопки уезжают левее и не перекрываются.
// Отступ списка 65 px (+ ~57 px от layout) — зазор ~8 px до панели итогов (значение владельца).
// ⭐ №384: варианты размера страницы сметы; выбор запоминается в localStorage
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const PAGE_SIZE_KEY = 'materials-page-size';

// ⭐ №177: запоминаем последний выбранный справочник цен (в модалке «Добавить позицию»)
const PRICE_CATALOG_MEMO_KEY = 'frame:priceCatalogChoice';

// ⭐ №392: серверный поиск расценок отдаёт не больше 50 строк — подсказываем уточнить запрос
const PRICE_SEARCH_LIMIT = 50;

/**
 * ⭐ №240: ответы API материала (фиксация/правка/настройки) не содержат `photosCount` —
 * это агрегат списка. При замене строки сохраняем счётчик, иначе бейдж «пропадает»
 * до перезагрузки страницы.
 */
const mergeUpdatedMaterial = (prev: MaterialData, updated: MaterialData): MaterialData => ({
  ...prev,
  ...updated,
  photosCount: prev.photosCount ?? updated.photosCount ?? 0,
});

/**
 * ⭐ №241 / ⭐ №393: `rub`, `UNIT_OPTIONS`, `unitLabelOf` и `InlinePriceEditor` переехали
 * в `components/materials/estimateFormat.ts` — они нужны и странице, и вынесенным
 * строке/карточке (иначе получился бы циклический импорт).
 */

/** ⭐ №275: черновик импорта (единица не уточнена) — показываем серым, выбрать нельзя */
const isDraftPrice = (option: PriceItemData | { __new__?: boolean }): boolean =>
  (option as PriceItemData)?.needsClarification === true;

/**
 * ⭐ №326: поле «Расход материала на 1 ед.» убрано — расчёт живёт в «своя цена материала»
 * (калькулятор 🧮), поэтому цена материала строки = цена расценки как есть.
 */

/** ⭐ №321: рубли без лишних копеек в подсказках («900», «999.9») */
const money2 = (value: number): string =>
  (Math.round(value * 100) / 100).toLocaleString('ru-RU');

/** ⭐ №321: «12,5» из поля ввода → 12.5 (пусто/мусор → 0) */
const numOr0 = (value: string): number => Number(value.replace(',', '.')) || 0;

const renderPriceOption = (
  props: React.HTMLAttributes<HTMLLIElement>,
  option: PriceItemData | { __new__?: boolean },
) => {
  if ((option as { __new__?: boolean })?.__new__) {
    return <li {...props}>➕ Создать новую расценку...</li>;
  }
  const item = option as PriceItemData;
  return (
    <Box
      component="li"
      {...props}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 1,
        opacity: item.needsClarification ? 0.55 : 1,
      }}
    >
      <span>
        {item.name}
        {item.needsClarification ? ' · уточните единицу' : ''}
      </span>
      <span>
        {(item.price ?? 0).toLocaleString('ru-RU')} ₽/
        {UNIT_OPTIONS.find((u) => u.value === item.unit)?.label || item.unit}
      </span>
    </Box>
  );
};

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

  // ⭐ №322: на телефоне две ступени должны стоять в ОДНУ строку — там подпись
  // сокращается до «Справочник» / «Категория» (выбранное значение видно в шторке),
  // а выбранный не по умолчанию фильтр подсвечивается голубым.
  const catalogChipLabel = isPhone ? 'Справочник' : `Справочник: ${catalogCaption}`;
  const categoryChipLabel = isPhone ? 'Категория' : `Категория: ${categoryCaption}`;
  const catalogIsPicked = catalogChoice !== '';
  const categoryIsPicked = categoryChoice !== '';
  const mobileChipSx = isPhone
    ? {
        flex: '1 1 0',
        minWidth: 0,
        justifyContent: 'flex-start',
        bgcolor: 'transparent',
      }
    : {};
  const activeChipSx = (active: boolean) =>
    isPhone && active
      ? { bgcolor: 'rgba(25, 118, 210, 0.10)', borderColor: '#1976d2' }
      : {};

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
      <Stack
        direction="row"
        spacing={1}
        sx={{ flexWrap: isPhone ? 'nowrap' : 'wrap', rowGap: 0.5, width: '100%' }}
      >
        <Chip
          size="small"
          variant="outlined"
          onClick={(e) => openStepWith('catalog', e)}
          icon={<ArrowDropDownIcon />}
          label={catalogChipLabel}
          title={`Справочник: ${catalogCaption}`}
          sx={{ ...chipSx, ...mobileChipSx, ...activeChipSx(catalogIsPicked) }}
        />
        <Chip
          size="small"
          variant="outlined"
          onClick={(e) => openStepWith('category', e)}
          icon={<ArrowDropDownIcon />}
          label={categoryChipLabel}
          title={`Категория: ${categoryCaption}`}
          sx={{ ...chipSx, ...mobileChipSx, ...activeChipSx(categoryIsPicked) }}
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
            {/* ⭐ №322: в чипсе на телефоне только название ступени — выбранное видно здесь */}
            <Typography variant="caption" color="text.secondary">
              Сейчас: {openStep === 'catalog' ? catalogCaption : categoryCaption}
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

/**
 * ⭐ №301: ключи сортировки сметы. `lastFix` — по дате последней фиксации
 * (новые/старые; строки без фиксаций всегда в конце).
 */
type MaterialSortKey = 'name' | 'specQuantity' | 'totalPrice' | 'percentage' | 'lastFix';

// ⭐ №393: `InlinePriceEditor` (⭐ №275/№301) вынесен в `components/materials/InlinePriceEditor.tsx`,
// чтобы строка таблицы могла его импортировать без цикла со страницей.

const Materials: React.FC = () => {
  countRender('materials.page'); // ⭐ №393: точка замера «страница сметы»
  const { objectId, projectId } = useParams<{ objectId: string; projectId: string }>();
  const navigate = useNavigate();
const goBack = useBackNavigation(`/objects/${objectId}/projects`);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const { notify, error: notifyError, success, confirm } = useFeedback();
  // ⭐ №393: направление скролла и «долистали до низа» больше НЕ в странице —
  // они внутри `EstimateScrollChrome` (иначе каждый жест перерисовывал всю смету).
  const mobileListRef = useRef<HTMLDivElement | null>(null);


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
  const [sortBy, setSortBy] = useState<MaterialSortKey | null>(null);
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
  // ⭐ №319: режим «своя цена» — справочник и категории скрываются, остаётся ручной ввод
const [addManualWork, setAddManualWork] = useState(false);
const [addManualMaterial, setAddManualMaterial] = useState(false);
// ⭐ Материал из справочника (цена за материал)
const [selectedMaterialItem, setSelectedMaterialItem] = useState<PriceItemData | null>(null);
// ⭐ №321/№335: калькулятор «сколько материала на объём работ» — вместо ручного расчёта
const [addFromVolume, setAddFromVolume] = useState(false);
const [addCalcVolume, setAddCalcVolume] = useState('');
const [addCalcPacks, setAddCalcPacks] = useState('1');
// ⭐ №325: цена за единицу материала — из неё считается цена материала на единицу строки
const [addCalcPackPrice, setAddCalcPackPrice] = useState('');
const [materialOptions, setMaterialOptions] = useState<PriceItemData[]>([]);
const [materialLoading, setMaterialLoading] = useState(false);
const [addMatCreatingNew, setAddMatCreatingNew] = useState(false);
// ⭐ №271: подтверждение нулевых цен при сохранении позиции
const [zeroConfirmOpen, setZeroConfirmOpen] = useState(false);
const [zeroItems, setZeroItems] = useState<string[]>([]);
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
  // ⭐ №374: защита от двойного клика — фиксация не должна задвоиться
  const [fixSaving, setFixSaving] = useState(false);
  // ⭐ №174: подсветка/скролл к только что скопированной строке
  const [flashId, setFlashId] = useState<number | null>(null);

  // Шестерёнка (настройки материала) и подтверждение удаления
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsMaterial, setSettingsMaterial] = useState<MaterialData | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialData | null>(null);

  // ⭐ №275: правка цены прямо в таблице («За ед.») + подтверждение
  const [inlinePrice, setInlinePrice] = useState<{
    materialId: number;
    side: 'work' | 'material';
    value: string;
  } | null>(null);
  // ⭐ №393: ref-зеркала состояния — колбэки, которые уходят в memo-строки, должны иметь
  // СТАБИЛЬНУЮ идентичность. Через ref они не зависят от `materials`/`inlinePrice`
  // (иначе каждый введённый символ в поле цены перерисовывал бы все строки сметы).
  const inlinePriceRef = useRef(inlinePrice);
  inlinePriceRef.current = inlinePrice;
  const materialsRef = useRef<MaterialData[]>([]);
  materialsRef.current = materials;
  const [priceConfirm, setPriceConfirm] = useState<{
    material: MaterialData;
    side: 'work' | 'material';
    value: number;
    alsoCatalog: boolean;
  } | null>(null);
  const [priceSaving, setPriceSaving] = useState(false);
 
  // Правка последней фиксации («Изменить Итого»)
  const [editFixModalOpen, setEditFixModalOpen] = useState(false);
  const [editFixAmount, setEditFixAmount] = useState('');
  const [editFixNote, setEditFixNote] = useState('');
  // Информационная модалка вместо браузерного alert
  const [infoModal, setInfoModal] = useState<{ open: boolean; text: string }>({ open: false, text: '' });
  // ⭐ №228: фото-фиксация — галерея материала и модалка съёмки/загрузки
  const [photoGalleryMaterial, setPhotoGalleryMaterial] = useState<MaterialData | null>(null);
  const [photoCaptureMaterial, setPhotoCaptureMaterial] = useState<MaterialData | null>(null); 
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
// ⭐ №276: меню смены справочника проекта прямо из сметы
const [catalogMenuAnchor, setCatalogMenuAnchor] = useState<null | HTMLElement>(null);
const [workCatalogChoice, setWorkCatalogChoice] = useState<number | ''>('');
const [workCategoryChoice, setWorkCategoryChoice] = useState<number | ''>('');
const [workCatalogCategories, setWorkCatalogCategories] = useState<PriceCategoryData[]>([]);
const [matCatalogChoice, setMatCatalogChoice] = useState<number | ''>('');
const [matCategoryChoice, setMatCategoryChoice] = useState<number | ''>('');
const [matCatalogCategories, setMatCatalogCategories] = useState<PriceCategoryData[]>([]);
// ⭐ Определяем нужно ли скрывать цены (VIEWER или hidePrices=true)
const hidePrices = currentObject?.hidePrices === true || currentObject?.role === 'VIEWER';
const canWriteMaterials = currentProject?.canWrite === true;
// ⭐ №390: право ПИСАТЬ — от роли, а не от видимости цен. Раньше кнопки скрывались
// вместе с ценами, и скрытый прораб не мог ни добавить строку, ни зафиксировать объём,
// хотя сервер это разрешает. Деньги при этом остаются скрытыми везде.
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
// ⭐ №202: импорт сметы из Excel
const [importOpen, setImportOpen] = useState(false);
// ⭐ №208: одно меню «Из шаблона» вместо отдельных кнопок импорта и шаблона
const [importMenuAnchor, setImportMenuAnchor] = useState<HTMLElement | null>(null);
// ⭐ Добавление позиций из шаблона сметы в текущий проект
const [templateModalOpen, setTemplateModalOpen] = useState(false);
const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
const [applyingTemplate, setApplyingTemplate] = useState(false);
// ⭐ №290: сметы доступных проектов + удаление шаблонов
const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
const [zeroQuantities, setZeroQuantities] = useState(false);
const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
// ⭐ №292: массовое выделение строк сметы (чекбокс в колонке «№»)
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
const [bulkBusy, setBulkBusy] = useState(false);
// ⭐ №393: «режим выделения» нужен колбэку тапа по карточке; через ref он не зависит
// от самого набора и не ломает memo-карточки.
const selectionCountRef = useRef(0);
selectionCountRef.current = selectedIds.size;
// ⭐ №294: мобилка — долгое нажатие на карточку включает выделение
const longPressTimerRef = useRef<number | null>(null);
const longPressFiredRef = useRef(false);
// ⭐ №295: якорь для Shift+Click (индекс последней отмеченной строки)
const lastSelectedIndexRef = useRef<number | null>(null);

// ⭐ №383/384: длинная смета — окно отрисовки. Данные, поиск, сортировка, ИТОГО
// и выделение считаются по ВСЕЙ смете; окно решает только, сколько строк рисуем.
// Размер страницы выбирает пользователь (дефолт 50 на десктопе / 25 на мобилке).
const [pageSize, setPageSize] = useState<number>(() => {
  const saved = Number(localStorage.getItem(PAGE_SIZE_KEY) || '');
  return PAGE_SIZE_OPTIONS.includes(saved) ? saved : isMobile ? 25 : 50;
});
const [windowStart, setWindowStart] = useState(0);
const [windowSize, setWindowSize] = useState(pageSize);
const [showAll, setShowAll] = useState(false);
const [pageInput, setPageInput] = useState('1');
// ⭐ №384: кнопка «вниз» к ИТОГО/страницам
const footerSentinelRef = useRef<HTMLDivElement | null>(null);
// ⭐ №401: липкая шапка и ИТОГО. Страница скроллится как раньше, а шапка/итоги «подтягиваются»
// через transform: `position: sticky` внутри контейнера таблицы не работает (у него есть
// горизонтальная прокрутка, поэтому скролл-контейнер — он сам, а не окно).
const tableHeadRef = useRef<HTMLTableSectionElement | null>(null);
const tableFootRef = useRef<HTMLTableSectionElement | null>(null);
// ⭐ №401: контейнер таблицы — кнопка «вниз» доводит таблицу до конца
const tableScrollRef = useRef<HTMLDivElement | null>(null);
// ⭐ №393: состояние «долистали до низа» живёт в `EstimateScrollChrome`, здесь — только ref
// ⭐ №383: печать из браузера — «вся смета» дорисовывает строки только на время печати
const [printOnlyPage, setPrintOnlyPage] = useState(false);
const [printingAll, setPrintingAll] = useState(false);
const printStateRef = useRef<{ start: number; size: number; all: boolean } | null>(null);
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
        // ⭐ №379: один bulk-запрос вместо N запросов по каждой строке
        const fixes: Record<number, MaterialFixData[]> = {};
        if (projectId) {
          try {
            const allFixes = await fetchFixesByProject(Number(projectId));
            for (const fix of allFixes) {
              (fixes[fix.materialId] ??= []).push(fix);
            }
          } catch {
            // экспорт не должен падать из-за истории — колонка дат просто будет пустой
          }
        }
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

// ⭐ №383: печать из браузера. Галочка «только текущую страницу» печатает окно как есть,
// иначе на время печати дорисовываем всю смету и возвращаем окно после.
const handlePrint = useCallback(() => {
  setExportModalOpen(false);
  if (printOnlyPage) {
    setTimeout(() => window.print(), 50);
    return;
  }
  printStateRef.current = { start: windowStart, size: windowSize, all: showAll };
  setPrintingAll(true);
}, [printOnlyPage, showAll, windowSize, windowStart]);

const restoreAfterPrint = useCallback(() => {
  const prev = printStateRef.current;
  printStateRef.current = null;
  setPrintingAll(false);
  if (prev) {
    setWindowStart(prev.start);
    setWindowSize(prev.size);
    setShowAll(prev.all);
  }
}, []);

useEffect(() => {
  window.addEventListener('afterprint', restoreAfterPrint);
  return () => window.removeEventListener('afterprint', restoreAfterPrint);
}, [restoreAfterPrint]);

// ⭐ №383: печатаем ПОСЛЕ того, как React отрисовал все строки (эффект — после коммита).
// Firefox/Safari иногда не присылают afterprint — подстраховываемся восстановлением.
useEffect(() => {
  if (!printingAll) return;
  const timer = window.setTimeout(() => {
    window.print();
    window.setTimeout(() => {
      if (printStateRef.current) restoreAfterPrint();
    }, 500);
  }, 60);
  return () => window.clearTimeout(timer);
}, [printingAll, restoreAfterPrint]);
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
    // ⭐ №383: один запрос вместо двух — весь прайс больше не грузится дважды.
    // Категории материала отбираем на клиенте (как это делает сервер при kind=MATERIAL).
    const all = await fetchCategoriesWithItems();
    setAllCategories(all.map(c => ({ id: c.id, name: c.name })));
    setMaterialCategories(
      all
        .filter(c => c.kind === 'MATERIAL')
        .map(c => ({ id: c.id, name: c.name })),
    );
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
  // ⭐ №393: массив мемоизирован — иначе каждая перерисовка страницы давала новый
  // `filteredMaterials` → новый `sortedMaterials` → новые props у ВСЕХ строк,
  // и React.memo в строке не срабатывал.
  const filteredMaterials = useMemo(() => materials.filter(m =>
    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.article?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!categoryFilter ||
      m.priceItem?.category?.id === categoryFilter ||
      m.materialItem?.category?.id === categoryFilter)
  ), [materials, searchQuery, categoryFilter]);

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
        // ⭐ №301: по дате последней фиксации; строки без фиксаций — всегда в конце
        case 'lastFix': {
          const at = a.lastEntryDate ? Date.parse(a.lastEntryDate) : null;
          const bt = b.lastEntryDate ? Date.parse(b.lastEntryDate) : null;
          if (at === null && bt === null) return 0;
          if (at === null) return 1;
          if (bt === null) return -1;
          comparison = at - bt;
          break;
        }
        default:
          return 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredMaterials, sortBy, sortDirection]);

  // ⭐ №393: тот же порядок строк в ref — колбэки выделения (Shift-диапазон, «протяжка»,
  // «выбрать все») читают его вместо массива, поэтому их идентичность не меняется
  // при каждом обновлении сметы (иначе memo-строки сбрасывались бы после любой фиксации).
  const sortedMaterialsRef = useRef<MaterialData[]>([]);
  sortedMaterialsRef.current = sortedMaterials;

  // ⭐ №383: окно отрисовки. «Показать все»/печать рисуют весь список, но поиск,
  // сортировка и ИТОГО всегда считаются по всей смете (filteredMaterials).
  const totalRows = sortedMaterials.length;
  const fullRender = showAll || printingAll;
  const sliceStart = fullRender ? 0 : Math.min(windowStart, totalRows);
  const windowEnd = fullRender
    ? totalRows
    : Math.min(windowStart + windowSize, totalRows);
  const visibleMaterials = useMemo(
    () => sortedMaterials.slice(sliceStart, windowEnd),
    [sortedMaterials, sliceStart, windowEnd],
  );
  // ⭐ №383: строки с ГЛОБАЛЬНЫМ индексом — нумерация, Shift-диапазон и «протяжка»
  // остаются сквозными по всей смете, а не по странице.
  const visibleRows = useMemo(
    () =>
      visibleMaterials.map((material, offset) => ({
        material,
        index: sliceStart + offset,
      })),
    [visibleMaterials, sliceStart],
  );
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(pageCount, Math.floor(sliceStart / pageSize) + 1);
  // ⭐ №401: липкая шапка и строка ИТОГО через transform.
  // Почему не `position: sticky` на th: у контейнера таблицы есть горизонтальная прокрутка,
  // поэтому ближайший скролл-контейнер — он сам, и при прокрутке СТРАНИЦЫ шапка уезжает.
  // Здесь страница скроллится как раньше, а шапка/итоги «подтягиваются» к краям экрана.
  useEffect(() => {
    if (isMobile) return; // на мобилке таблицы нет — там карточки
    const container = tableScrollRef.current;
    const head = tableHeadRef.current;
    const foot = tableFootRef.current;
    if (!container || !head) return;

    let lastHead = -1;
    let lastFoot = -1;
    let scheduled = 0;

    const apply = () => {
      scheduled = 0;
      const rect = container.getBoundingClientRect();
      const headHeight = head.offsetHeight;
      const footHeight = foot ? foot.offsetHeight : 0;
      const total = container.offsetHeight;

      // шапка: не выше верхнего края таблицы и не ниже строки ИТОГО
      const maxHead = Math.max(0, total - headHeight - footHeight);
      const headOffset = Math.min(Math.max(0, -rect.top), maxHead);
      if (headOffset !== lastHead) {
        head.style.transform = headOffset > 0 ? `translateY(${headOffset}px)` : '';
        // ⭐ №401: `transform` создаёт слой, но z-index у СТАТИЧНОГО элемента не работает —
        // без `position: relative` позиционированные кнопки из строк (чекбокс, бейдж фото,
        // «+ фикс») рисовались поверх шапки.
        head.style.position = 'relative';
        head.style.zIndex = '3';
        lastHead = headOffset;
      }

      // ИТОГО: не ниже нижнего края таблицы и не выше шапки
      if (foot) {
        const maxFoot = Math.max(0, total - headHeight - footHeight);
        const footOffset = Math.min(Math.max(0, rect.bottom - window.innerHeight), maxFoot);
        if (footOffset !== lastFoot) {
          foot.style.transform = footOffset > 0 ? `translateY(${-footOffset}px)` : '';
          foot.style.position = 'relative';
          foot.style.zIndex = '3';
          lastFoot = footOffset;
        }
      }
    };

    // ⭐ №401: на scroll пересчитываем СРАЗУ (без requestAnimationFrame) — иначе сдвиг шапки
    // применялся кадром позже прокрутки, и при скролле она «дрожала» (отставала на кадр).
    // rAF оставлен только для ResizeObserver: там важна не задержка, а «не чаще кадра».
    const schedule = () => {
      if (scheduled === 0) scheduled = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(container);

    return () => {
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      observer?.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
      head.style.transform = '';
      if (foot) foot.style.transform = '';
    };
  }, [isMobile, loading]);
  const windowCoversAll = sliceStart === 0 && windowEnd >= totalRows;
  // ⭐ №383: плашка нужна и при ровно одной полной странице (200 строк = «Страница 1 из 1»),
  // иначе пользователь не понимает, есть ли вообще страницы.
  const hasWindowBar = totalRows >= pageSize || !windowCoversAll;
  // ⭐ №383: поиск/фильтр работают по всей смете — показываем, сколько нашлось из всех строк
  const filterActive = Boolean(searchQuery.trim()) || categoryFilter != null;
  const filterHint =
    filterActive && totalRows !== materials.length ? (
      <Typography
        variant="caption"
        color="text.secondary"
        className="no-print"
        sx={{ display: 'block', mt: 1 }}
      >
        Найдено: {totalRows} из {materials.length}
      </Typography>
    ) : null;

  // ⭐ №383: навигация по окну — страница, «ещё», «все»
  const goToPage = useCallback(
    (page: number) => {
      const target = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
      setShowAll(false);
      setWindowStart((target - 1) * pageSize);
      setWindowSize(pageSize);
    },
    [pageCount, pageSize],
  );

  const showMoreRows = useCallback(() => {
    setShowAll(false);
    setWindowSize((size) =>
      Math.max(pageSize, Math.min(totalRows - windowStart, size + pageSize)),
    );
  }, [pageSize, totalRows, windowStart]);

  const showAllRows = useCallback(async () => {
    if (totalRows > 1000) {
      const ok = await confirm({
        title: `Показать все строки: ${totalRows}?`,
        text: 'Страница отрисует всю смету целиком — на слабом устройстве это может занять пару секунд. Поиск, ИТОГО и экспорт не меняются.',
        confirmText: 'Показать все',
      });
      if (!ok) return;
    }
    setShowAll(true);
    setWindowStart(0);
    setWindowSize(pageSize);
  }, [confirm, pageSize, totalRows]);

  // ⭐ №383: сменили поиск/фильтр/сортировку — снова первая порция
  useEffect(() => {
    setWindowStart(0);
    setWindowSize(pageSize);
    setShowAll(false);
  }, [searchQuery, categoryFilter, sortBy, sortDirection, pageSize]);

  // ⭐ №383: после удаления строк окно не должно «висеть» за концом списка
  useEffect(() => {
    if (showAll) return;
    if (windowStart > 0 && windowStart >= totalRows) {
      setWindowStart(0);
      setWindowSize(pageSize);
    }
  }, [totalRows, windowStart, showAll, pageSize]);

  // ⭐ №383: поле «Страница» показывает текущую
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // ⭐ №384: размер страницы выбирает пользователь; выбор запоминаем,
  // а до первого выбора дефолт зависит от устройства (50 / 25).
  const changePageSize = useCallback((next: number) => {
    setPageSize(next);
    localStorage.setItem(PAGE_SIZE_KEY, String(next));
  }, []);

  useEffect(() => {
    if (localStorage.getItem(PAGE_SIZE_KEY)) return;
    setPageSize(isMobile ? 25 : 50);
  }, [isMobile]);

  // ⭐ №384/№393: измерение «до низа страницы» переехало в `EstimateScrollChrome`
  // вместе с кнопкой «вниз»: страница на скролл больше не перерисовывается.

  // ⭐ №386 (по жалобе владельца): автодогрузки на мобилке БОЛЬШЕ НЕТ.
  // Она удлиняла список за 320 px до низа, и плашка страниц «убегала» — догнать её
  // можно было только когда строки заканчивались. Теперь список растёт только по
  // явному нажатию «Показать ещё N» (или «Показать все»).

  const scrollToFooter = useCallback(() => {
    // ⭐ №401: у таблицы своя прокрутка — сначала доводим её до конца (там ИТОГО и последние
    // строки), потом прокручиваем страницу к плашке страниц.
    const table = tableScrollRef.current;
    if (table && table.scrollHeight > table.clientHeight) {
      table.scrollTo({ top: table.scrollHeight, behavior: 'smooth' });
    }
    const el = footerSentinelRef.current;
    if (!el) return;
    // ⭐ №386: `scrollIntoView` ставил плашку вплотную к низу, и кнопки уходили
    // под фиксированные плашку итогов и нижнее меню — прокручиваем с запасом.
    const bottomPadding = isMobile ? SUMMARY_BAR_BOTTOM + 72 : 32;
    const rect = el.getBoundingClientRect();
    const maxTop =
      document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.min(
      maxTop,
      Math.max(0, window.scrollY + rect.bottom - window.innerHeight + bottomPadding),
    );
    window.scrollTo({ top, behavior: 'smooth' });
  }, [isMobile]);

  // Итоговая строка: суммы по спеке и факту, средний прогресс
// ⭐ №393: мемоизировано — итоги нужны плашке/футеру и прокруточной обвязке,
// а пересчёт на каждый рендер 404 строк был чистой потерей.
const totals = useMemo(() => {
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
}, [filteredMaterials]);
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

  // ⭐ №228: обновить только материалы (после загрузки/удаления фото) —
  // без мигания всей страницы и повторной загрузки проекта/объекта
  const refreshMaterials = useCallback(async () => {
    if (!projectId) return;
    try {
      setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  // ⭐ №305: вернулись в окно/вкладку — тихо обновляем смету (бейджи фото,
  // факт и проценты). Без этого правки второго участника видны только после F5.
  useRefreshOnFocus(refreshMaterials, { minIntervalMs: 10_000 });

  // ⭐ №383: цель подсветки может быть за пределами окна — переезжаем на её страницу
  useEffect(() => {
    if (loading || fullRender) return;
    const targetId = highlightId ?? flashId;
    if (targetId == null) return;
    const index = sortedMaterials.findIndex((m) => m.id === targetId);
    if (index < 0) return;
    if (index < windowStart || index >= windowStart + windowSize) {
      setWindowStart(Math.floor(index / pageSize) * pageSize);
      setWindowSize(pageSize);
    }
  }, [
    highlightId,
    flashId,
    loading,
    sortedMaterials,
    fullRender,
    windowStart,
    windowSize,
    pageSize,
  ]);

  // ⭐ №161: подсветка строки, на которую перешли из виджета «Без расценки»
  useEffect(() => {
    if (!highlightId || loading || materials.length === 0) return;
    const el = document.getElementById(`material-row-${highlightId}`);
    if (!el) return; // строку не нашли (например, отфильтрована) — молча выходим
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightVisible(true);
    const timer = setTimeout(() => setHighlightVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [highlightId, loading, materials.length, sliceStart, windowSize, fullRender]);
  // ⭐ №174: прокрутить к копии и подсветить её — копия создаётся сразу,
  // «вставлять» её никуда не надо (раньше копия молча терялась в отсортированном списке)
  useEffect(() => {
    if (flashId == null) return;
    const el = document.getElementById(`material-row-${flashId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(timer);
  }, [flashId, materials.length, sliceStart, windowSize, fullRender]);

const handleOpenAddModal = () => {
  setAddModalOpen(true);
  setAddCreatingNew(false);
  setAddPriceName('');
  setAddPriceCategoryId('');
  setAddPriceCategoryName('');
  setAddPriceUnit('PIECE');
  setAddPricePrice('');
  // ⭐ №177: помним последний выбранный справочник — обычно он один и тот же
  // ⭐ №271: если у проекта есть свой справочник — по умолчанию работаем с ним,
  // а не с последним запомненным каталогом.
  const remembered = Number(localStorage.getItem(PRICE_CATALOG_MEMO_KEY) || '');
  const initialCatalog: number | '' =
    priceCatalogId ? '' : Number.isFinite(remembered) && remembered > 0 ? remembered : '';
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
setAddPricePrice('');
setSelectedMaterialItem(null);
setMaterialOptions([]);
setAddMatCreatingNew(false);
setAddMatPricePrice('');
// ⭐ №319: ручной режим сбрасывается вместе с формой
setAddManualWork(false);
setAddManualMaterial(false);
// ⭐ №321: калькулятор «от объёма» сбрасывается вместе с формой
setAddFromVolume(false);
setAddCalcVolume('');
setAddCalcPacks('1');
setZeroConfirmOpen(false);
setZeroItems([]);
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
  // ⭐ №321/№325: калькулятор «количество материала × цена → цена за 1 единицу».
  const addCalcPackPriceNum = numOr0(addCalcPackPrice);
  const addCalcVolumeNum = numOr0(addCalcVolume);
  const addCalcPacksNum = numOr0(addCalcPacks);
  const addCalcMaterialTotal = addCalcPacksNum * addCalcPackPriceNum;
  const addCalcPerUnit =
    addCalcVolumeNum > 0 ? addCalcMaterialTotal / addCalcVolumeNum : 0;
  // ⭐ №325/№326: цена материала за 1 единицу строки (для блока «За 1 <ед.>»).
  // В ручном режиме — введённая/посчитанная цена на единицу, в режиме справочника — цена
  // расценки как есть (поля нормы расхода больше нет, расчёт — в «своя цена материала»).
  const addMaterialPerUnit =
    addManualMaterial || addMatCreatingNew
      ? numOr0(addMatPricePrice)
      : Number(selectedMaterialItem?.price ?? 0);

  /** ⭐ №325: количество × цена материала → цена за единицу, сразу в поле выше */
  const applyCalcToPrice = (packsStr: string, packPriceStr: string, volumeStr: string) => {
    const packs = numOr0(packsStr);
    const packPrice = numOr0(packPriceStr);
    const volume = numOr0(volumeStr);
    if (packs > 0 && packPrice > 0 && volume > 0) {
      setAddMatPricePrice(String(Math.round(((packs * packPrice) / volume) * 100) / 100));
    }
  };

  const handleCreateMaterial = async (confirmedZero = false) => {
    if (!token || !projectId || !newName.trim()) {
      notify('Введите наименование', 'warning');
      return;
    }
    const specQty = parseFloat(newSpecQuantity) || 0;
    try {
      // ⭐ №390: скрытые цены — создаём строку без цен (их заполнит офис).
      // Цен не спрашиваем, поэтому и «нулевое» подтверждение не нужно.
      if (hidePrices) {
        const created = await createMaterial({
          name: newName,
          article: newArticle || undefined,
          unit: newUnit,
          specQuantity: specQty,
          note: newNote || undefined,
          projectId: parseInt(projectId),
        });
        setMaterials(prev => [created, ...prev]);
        handleCloseAddModal();
        return;
      }
      // ⭐ №271: одна форма — выбрал из справочника или ввёл цену руками.
      // Новая цена автоматически становится расценкой справочника проекта.
      let priceItemId: number | undefined = selectedPriceItem?.id;
      let materialItemId: number | undefined = selectedMaterialItem?.id;
      let workPrice: number | undefined;
      let materialPrice: number | undefined;

      const workRaw = addPricePrice.trim();
      if (workRaw !== '') {
        const price = parseFloat(workRaw);
        if (isNaN(price) || price < 0) {
          setInfoModal({ open: true, text: 'Введите корректную цену работы' });
          return;
        }
        if (
          selectedPriceItem &&
          Math.abs(price - Number(selectedPriceItem.price ?? 0)) < 0.005
        ) {
          priceItemId = selectedPriceItem.id;
        } else {
          priceItemId = undefined;
          workPrice = price;
        }
      }

      const matRaw = addMatPricePrice.trim();
      if (matRaw !== '') {
        const price = parseFloat(matRaw);
        if (isNaN(price) || price < 0) {
          setInfoModal({ open: true, text: 'Введите корректную цену материала' });
          return;
        }
        if (
          selectedMaterialItem &&
          Math.abs(price - Number(selectedMaterialItem.price ?? 0)) < 0.005
        ) {
          materialItemId = selectedMaterialItem.id;
        } else {
          materialItemId = undefined;
          materialPrice = price;
        }
      }

      const zero: string[] = [];
      if (
        (workPrice === 0 ||
          (priceItemId != null &&
            Number(selectedPriceItem?.price ?? -1) === 0)) &&
        !zero.some((x) => x.startsWith('работа'))
      ) {
        zero.push('работа — 0 ₽');
      }
      if (
        (materialPrice === 0 ||
          (materialItemId != null &&
            Number(selectedMaterialItem?.price ?? -1) === 0)) &&
        !zero.some((x) => x.startsWith('материал'))
      ) {
        zero.push('материал — 0 ₽');
      }
      const bothEmpty =
        !workRaw &&
        !matRaw &&
        !selectedPriceItem &&
        !selectedMaterialItem;
      if (bothEmpty) {
        zero.push('работа — 0 ₽', 'материал — 0 ₽');
      }

      if (!confirmedZero && zero.length > 0) {
        setZeroItems([...new Set(zero)]);
        setZeroConfirmOpen(true);
        return;
      }

      if (confirmedZero) {
        if (bothEmpty) {
          workPrice = 0;
          materialPrice = 0;
        }
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
        workPrice,
        materialPrice,
      });
      setMaterials(prev => [created, ...prev]);
      loadCategories();
      setZeroConfirmOpen(false);
      handleCloseAddModal();
    } catch (err: unknown) {
      notifyError('Ошибка при создании материала: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

  // ⭐ №393: колбэки строки — стабильные (useCallback с неизменными зависимостями),
  // иначе React.memo в строке не срабатывает: новая функция = новый prop.
  const handleOpenFixModal = useCallback((material: MaterialData) => {
    setFixingMaterial(material);
    setFixAmount('');
    setFixNote('');
    setFixDayOffset(0); // ⭐ №174: по умолчанию — сегодня
    setFixModalOpen(true);
  }, []);

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
  // ⭐ №233: формат ДД.ММ (как принято в РФ). Раньше из ISO брали `slice(5)` —
  // получалось ММ.ДД («11.09» вместо «09.11»).
  const fixDayLabel = (offset: number) => {
    const [, mm, dd] = localDateKey(-offset).split('-');
    const date = `${dd}.${mm}`;
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
    if (fixSaving) return;
    const amount = parseFloat(fixAmount);
    if (!token || !fixingMaterial || isNaN(amount) || amount <= 0) {
      notify('Введите объём больше нуля', 'warning');
      return;
    }
    try {
      setFixSaving(true);
      const updated = await addFix(fixingMaterial.id, {
        amount,
        note: fixNote || undefined,
        // ⭐ №174: дата фиксации задним числом (для сегодняшней не передаём — сервер ставит «сейчас»)
        ...(fixDayOffset > 0 ? { fixedDate: localDateKey(-fixDayOffset) } : {}),
        tzOffset: new Date().getTimezoneOffset(), // окно считаем по календарю устройства
      });
      setMaterials(prev => prev.map(m => m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m));
      handleCloseFixModal();
    } catch (err: unknown) {
      notifyError('Ошибка фиксации: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setFixSaving(false);
    }
  };

  // Шестерёнка: открываем настройки материала (⭐ №393 — стабильный колбэк)
  const handleOpenSettings = useCallback((material: MaterialData) => {
    setSettingsMaterial(material);
    setSettingsModalOpen(true);
  }, []);

  // ⭐ №393: фото-галерея и карточка/строка получают стабильные обработчики
  const handleOpenPhotos = useCallback((material: MaterialData) => {
    setPhotoGalleryMaterial(material);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsModalOpen(false);
    setSettingsMaterial(null);
  }, []);

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
  // ⭐ №275: правка «За ед.» прямо в смете. Меняется только строка (снапшот),
  // справочник остаётся прежним — для него есть отдельная галочка в подтверждении.
  const handleInlinePriceStart = useCallback((material: MaterialData, side: 'work' | 'material') => {
    if (hidePrices) return;
    const current = side === 'work' ? material.unitPrice : material.materialUnitPrice;
    setInlinePrice({
      materialId: material.id,
      side,
      // ⭐ №301: ноль не подставляем — поле пустое, чтобы не стирать его вручную
      value: current > 0 ? String(current) : '',
    });
  }, [hidePrices]);

  // ⭐ №393: ввод цены обновляет только состояние — колбэк не зависит от `inlinePrice`,
  // поэтому строка (и все остальные) не перерисовываются на каждый символ.
  const handleInlinePriceChange = useCallback((value: string) => {
    setInlinePrice((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const handleInlinePriceCancel = useCallback(() => setInlinePrice(null), []);

  const handleInlinePriceCommit = useCallback(() => {
    const current = inlinePriceRef.current;
    if (!current) return;
    const material = materialsRef.current.find((row) => row.id === current.materialId);
    const raw = current.value.trim().replace(',', '.');
    const value = raw === '' ? 0 : Number(raw);
    if (!material || !Number.isFinite(value) || value < 0) {
      notify('Введите корректную цену', 'warning');
      return;
    }
    setInlinePrice(null);
    setPriceConfirm({ material, side: current.side, value, alsoCatalog: false });
  }, [notify]);

  const handlePriceSave = async () => {
    if (!priceConfirm) return;
    const { material, side, value, alsoCatalog } = priceConfirm;
    setPriceSaving(true);
    try {
      const itemId = side === 'work' ? material.priceItemId : material.materialItemId;
      // ⭐ №302: строки без привязки — работа и материал одинаково: позиция ищется
      // по названию (или создаётся), цена ставится и в справочнике, и в строке
      if (alsoCatalog && itemId == null) {
        const updated = await syncMaterialPrice(material.id, { side, price: value });
        setMaterials((prev) =>
          prev.map((m) => (m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m)),
        );
        loadCategories();
        setPriceConfirm(null);
        notify('Цена обновлена и в смете, и в справочнике');
        return;
      }
      if (alsoCatalog && itemId != null) {
        await updatePriceItem(itemId, { price: value });
      }
      const updated = await updateMaterial(
        material.id,
        side === 'work' ? { workPrice: value } : { materialPrice: value },
      );
      setMaterials((prev) =>
        prev.map((m) => (m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m)),
      );
      loadCategories();
      setPriceConfirm(null);
      notify(
        alsoCatalog
          ? 'Цена обновлена и в смете, и в справочнике'
          : 'Цена обновлена в смете',
      );
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось изменить цену'));
    } finally {
      setPriceSaving(false);
    }
  };

  // ⭐ №276: смена справочника проекта. Строки не меняются (снапшоты),
  // поэтому сразу предлагаем пересчёт по новой базе — с превью.
  const handleSwitchCatalog = async (nextCatalogId: number) => {
    setCatalogMenuAnchor(null);
    if (!currentProject || nextCatalogId === priceCatalogId) return;
    try {
      await updateProject(currentProject.id, { catalogId: nextCatalogId });
      const refreshed = await fetchProjectById(currentProject.id);
      setCurrentProject(refreshed);
      notify('Справочник проекта изменён');
      setRecalcOpen(true);
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось сменить справочник'));
    }
  };

  // ⭐ №292: массовое выделение строк в таблице сметы
  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    lastSelectedIndexRef.current = null;
    setSelectedIds(new Set());
  }, []);

  // ⭐ №295/№297: выделение диапазона — Shift+Click и «протяжка» мышью.
  // Ctrl/Cmd+A намеренно не делаем (риск случайного «выделить всё»).
  const applyRangeSelect = useCallback(
    (anchor: number, index: number) => {
      const from = Math.min(anchor, index);
      const to = Math.max(anchor, index);
      // ⭐ №393: порядок строк — из ref, чтобы колбэк был стабильным для memo-строк
      const rangeIds = sortedMaterialsRef.current.slice(from, to + 1).map((m) => m.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((rid) => next.add(rid));
        return next;
      });
    },
    [],
  );

  // Чекбокс: сюда приходит только клавиатура (мышь обрабатывает ячейка, см. startDragSelect)
  const handleRowSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number, id: number) => {
      const shift = (e.nativeEvent as MouseEvent).shiftKey;
      const anchor = lastSelectedIndexRef.current;
      if (shift && anchor !== null) applyRangeSelect(anchor, index);
      else toggleSelected(id);
      lastSelectedIndexRef.current = index;
    },
    [applyRangeSelect, toggleSelected],
  );

  // ⭐ №294: долгое нажатие на карточку (мобилка) — 500 мс, с вибро-откликом.
  // Тапы по кнопкам внутри карточки (шестерёнка, «+ Фикс», фото) не перехватываем.
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ⭐ №393: обработчик карточки принимает материал, а не возвращает новый колбэк на id —
  // иначе memo-карточки получали бы новую функцию на каждый рендер списка.
  const handleCardTouchStart = useCallback((material: MaterialData, e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, [role="button"]')) return;
    cancelLongPress();
    longPressFiredRef.current = false;
    const id = material.id;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      toggleSelected(id);
      navigator.vibrate?.(10);
    }, 500);
  }, [cancelLongPress, toggleSelected]);

  // таймер не должен «выстрелить» после ухода со страницы
  useEffect(() => cancelLongPress, [cancelLongPress]);

  // «Выбрать все» работает по видимым строкам (с учётом поиска/фильтра/сортировки)
  const allVisibleSelected =
    sortedMaterials.length > 0 && sortedMaterials.every((m) => selectedIds.has(m.id));
  const someVisibleSelected =
    !allVisibleSelected && sortedMaterials.some((m) => selectedIds.has(m.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      // ⭐ №393: список — из ref, колбэк стабильный (см. applyRangeSelect)
      const rows = sortedMaterialsRef.current;
      const allSelected = rows.length > 0 && rows.every((m) => prev.has(m.id));
      return allSelected ? new Set<number>() : new Set(rows.map((m) => m.id));
    });
  }, []);

  // Выделение не должно «залипать» на удалённых/отфильтрованных строках
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(materials.map((m) => m.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [materials]);

  // Esc снимает выделение — привычно для таблиц
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds.size, clearSelection]);

  // ⭐ №297: «зажал и провёл» мышью по колонке «№» — выделяется диапазон от нажатой строки.
  // Клик без движения — обычное переключение строки; Shift+Click — диапазон от якоря.
  const dragStateRef = useRef<{ anchor: number; id: number; dragged: boolean } | null>(null);
  const [dragSelecting, setDragSelecting] = useState(false);

  // ⭐ №393: колбэк принимает index/id аргументами (а не создаёт замыкание на строку),
  // поэтому его идентичность одинакова для всех строк — memo не сбрасывается.
  const handleNumberMouseDown = useCallback(
    (e: React.MouseEvent, index: number, id: number) => {
      if (e.button !== 0 || bulkBusy) return;
      // отключаем выделение текста и нативное переключение чекбокса
      e.preventDefault();
      if (e.shiftKey) {
        const anchor = lastSelectedIndexRef.current;
        if (anchor === null) toggleSelected(id);
        else applyRangeSelect(anchor, index);
        lastSelectedIndexRef.current = index;
        return;
      }
      dragStateRef.current = { anchor: index, id, dragged: false };
      setDragSelecting(true);
    },
    [applyRangeSelect, bulkBusy, toggleSelected],
  );

  const handleHoverRow = useCallback(
    (index: number) => {
      const state = dragStateRef.current;
      if (!state || state.anchor === index) return;
      state.dragged = true;
      applyRangeSelect(state.anchor, index);
    },
    [applyRangeSelect],
  );

  // Отпускание мыши в любом месте страницы завершает «протяжку»
  useEffect(() => {
    if (!dragSelecting) return;
    const finish = () => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      setDragSelecting(false);
      // не протянули ни одной строки → это обычный клик: переключаем строку
      if (state && !state.dragged) {
        toggleSelected(state.id);
        lastSelectedIndexRef.current = state.anchor;
      }
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, [dragSelecting, toggleSelected]);


  const selectedTotals = useMemo(() => {
    const rows = materials.filter((m) => selectedIds.has(m.id));
    let fact = 0;
    let plan = 0;
    for (const m of rows) {
      fact += (Number(m.totalCost) || 0) + (Number(m.materialTotalCost) || 0);
      const qty = Number(m.specQuantity) || 0;
      plan +=
        (Number(m.unitPrice) || 0) * qty + (Number(m.materialUnitPrice) || 0) * qty;
    }
    return { count: rows.length, fact, plan };
  }, [materials, selectedIds]);

  // ⭐ №295: дублирование — тоже через подтверждение (защита от случайного нажатия)
  const handleBulkDuplicate = useCallback(async () => {
    if (!projectId || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const ok = await confirm({
      title: `Дублировать строки: ${ids.length}?`,
      text: 'Копии добавятся в конец сметы с именами «… (копия)»: позиции, объёмы и цены скопируются, факт и фиксации — нет.',
      confirmText: 'Дублировать',
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await duplicateMaterialsBulk(ids);
      setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
      clearSelection();
      notify(`Скопировано строк: ${res.copied}`, 'success');
    } catch (err) {
      notifyError('Не удалось скопировать строки: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setBulkBusy(false);
    }
  }, [projectId, selectedIds, confirm, clearSelection, notify, notifyError]);

  // ⭐ №292: удалить выделенные строки (с подтверждением — фиксации уходят вместе со строками)
  const handleBulkDelete = useCallback(async () => {
    if (!projectId || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const ok = await confirm({
      title: `Удалить строк: ${ids.length}?`,
      text: `Строки и все их фиксации будут удалены безвозвратно. Цены и позиции справочника не меняются.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await deleteMaterialsBulk(ids);
      setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
      clearSelection();
      notify(`Удалено строк: ${res.deleted}`, 'success');
    } catch (err) {
      notifyError('Не удалось удалить строки: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setBulkBusy(false);
    }
  }, [projectId, selectedIds, confirm, clearSelection, notify, notifyError]);

  const handleDuplicate = useCallback(async (material: MaterialData) => {
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
  }, [token, handleCloseSettings, notify, notifyError]);

  // ⭐ №294/№393: тап по карточке в режиме выделения. Проверка «режима» — через ref,
  // сам обработчик стабилен и годится для memo-карточки.
  const handleCardClick = useCallback((material: MaterialData, e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false; // это был long-press, не считаем как тап
      return;
    }
    if (selectionCountRef.current === 0) return;
    // тапы по кнопкам внутри карточки (шестерёнка, «+ Фикс», фото) не считаем выбором
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, [role="button"]')) return;
    toggleSelected(material.id);
  }, [toggleSelected]);

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
    setMaterials(prev => prev.map(m => m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m));
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

// ⭐ №326: норму расхода не отправляем — существующая в строке остаётся как есть (PATCH
// без поля её не меняет), а цену материала задаёт расценка или калькулятор «своя цена».

  // ⭐ №390: снять/поставить защиту спецификации прямо из окна редактирования.
  const handleToggleSpecLock = async () => {
    if (!settingsMaterial) return;
    try {
      const updated = await toggleSpecLock(settingsMaterial.id);
      setSettingsMaterial(updated);
      setMaterials(prev =>
        prev.map(m => (m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m)),
      );
      notify(
        updated.isSpecLocked
          ? 'Спецификация защищена'
          : 'Спецификация открыта для изменения количества',
      );
    } catch (err: unknown) {
      notifyError(getApiErrorText(err, 'Не удалось изменить защиту спецификации'));
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
    // ⭐ №390: скрытые цены — правим только «безденежные» поля, цены не трогаем.
    if (hidePrices) {
      const updated = await updateMaterial(settingsMaterial.id, {
        name: editName.trim(),
        article: editArticle,
        unit: editUnit,
        specQuantity: qty,
        note: editNote,
      });
      setMaterials(prev => prev.map(m => m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m));
      setEditModalOpen(false);
      return;
    }
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
      // ⭐ №326: норму расхода не трогаем — если она была в строке, сервер её сохранит
    });
    setMaterials(prev => prev.map(m => m.id === updated.id ? mergeUpdatedMaterial(m, updated) : m));
    loadCategories(); // ⭐ обновить категории фильтра
    setEditModalOpen(false);
  } catch (err: unknown) {
    setInfoModal({ open: true, text: 'Ошибка: ' + getApiErrorText(err, 'неизвестная ошибка') });
  }
};
// Применение сортировки из мобильного меню
const applyMobileSort = (
col: MaterialSortKey | null,
dir: 'asc' | 'desc' | null
) => {
setSortBy(col);
setSortDirection(dir);
setSortAnchorEl(null);
};

  // Обработчик клика по заголовку таблицы для сортировки
  const handleSortClick = (sortByColumn: MaterialSortKey) => {
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
  const renderSortIcon = (column: MaterialSortKey) => {
    if (sortBy !== column) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
    );
  };

  // ⭐ Добавить позиции из шаблона сметы в текущую смету (кнопка в шапке и в мобильном меню)
  // ⭐ №202/№208: после импорта — перечитать смету и сказать, сколько создано
  // и в какой новый справочник ушли цены из файла (напоминание владельца).
  const handleImported = async (
    created: number,
    skipped: number,
    catalogName?: string | null,
  ) => {
    if (projectId) setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
    if (created > 0) {
      notify(
        `Импортировано позиций: ${created}${skipped ? `, пропущено: ${skipped}` : ''}`,
        'success',
      );
      if (catalogName) {
        notify(`Цены из файла прочитаны — создан новый справочник «${catalogName}»`, 'success');
      }
    } else {
      notify('Ни одной строки не импортировано — проверьте предупреждения в файле', 'warning');
    }
  };

  const handleOpenTemplateModal = useCallback(async () => {
    setTemplateModalOpen(true);
    try {
      setTemplates(await fetchEstimateTemplates());
    } catch (err) {
      setTemplates([]);
      notifyError('Не удалось загрузить шаблоны: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
    // ⭐ №290: сметы других доступных проектов — рядом с шаблонами
    try {
      setAvailableProjects(await fetchAvailableProjects());
    } catch {
      setAvailableProjects([]);
    }
  }, [notifyError]);

  // ⭐ №290: добавить в текущую смету позиции из другого проекта (append, прогресс не переносится)
  const handleApplyProjectEstimate = useCallback(
    async (sourceProjectId: number, name: string) => {
      if (!projectId) return;
      setApplyingTemplate(true);
      try {
        const res = await copyEstimateFromProject(parseInt(projectId), {
          sourceProjectId,
          zeroQuantities,
          append: true,
        });
        setMaterials(await fetchMaterialsByProject(parseInt(projectId)));
        setTemplateModalOpen(false);
        if (res?.created) {
          success(
            `Добавлено позиций из «${name}»: ${res.created}` +
              (zeroQuantities ? ' (количества обнулены)' : ''),
          );
        } else {
          notify('В смете проекта-источника нет позиций', 'warning');
        }
      } catch (err) {
        notifyError('Не удалось добавить смету: ' + getApiErrorText(err, 'неизвестная ошибка'));
      } finally {
        setApplyingTemplate(false);
      }
    },
    [projectId, zeroQuantities, success, notify, notifyError],
  );

  // ⭐ №290: шаблоны раньше нельзя было удалить — теперь корзинка в списке
  const handleDeleteTemplate = useCallback(
    async (template: EstimateTemplate) => {
      const ok = await confirm({
        title: 'Удалить шаблон?',
        text: `Шаблон «${template.name}» (${template.items?.length ?? 0} поз.) будет удалён безвозвратно. Уже добавленные в сметы позиции останутся.`,
        confirmText: 'Удалить',
        danger: true,
      });
      if (!ok) return;
      setDeletingTemplateId(template.id);
      try {
        await deleteEstimateTemplate(template.id);
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        success(`Шаблон «${template.name}» удалён`);
      } catch (err) {
        notifyError('Не удалось удалить шаблон: ' + getApiErrorText(err, 'неизвестная ошибка'));
      } finally {
        setDeletingTemplateId(null);
      }
    },
    [confirm, success, notifyError],
  );

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
        onClick={(e) => setImportMenuAnchor(e.currentTarget)}
        aria-label="Импорт: смета из проекта, шаблон, Excel, скачать шаблон"
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
    onBack: goBack,
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: 'Поиск материалов...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); },
    onSearchChange: (v) => setSearchQuery(v),
    trailing: headerTrailing,
  });

  // ⭐ №383: плашка «показано / страница» — под таблицей (десктоп) и под карточками.
  // Поиск, сортировка и ИТОГО при этом всегда считаются по всей смете.
  const paginationBar = hasWindowBar ? (
    <Paper
      ref={footerSentinelRef}
      variant="outlined"
      className="no-print"
      sx={{
        mt: 1.5,
        mb: 1,
        px: 1.5,
        // ⭐ №389: справа место под FAB «+», чтобы он не накрыл «Свернуть» / кнопки
        pr: { xs: 8, sm: 1.5 },
        py: 1,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        borderRadius: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {fullRender
          ? `Показано: все ${totalRows}`
          : `Показано ${sliceStart + 1}–${windowEnd} из ${totalRows}`}
      </Typography>
      {/* ⭐ №384: размер страницы на выбор (запоминается) */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Строк:
        </Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => changePageSize(Number(e.target.value))}
          sx={{
            height: 30,
            fontSize: 13,
            '& .MuiSelect-select': { py: 0.25, px: 1 },
          }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>
              {n}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Box sx={{ flex: 1 }} />
      {!fullRender && windowEnd < totalRows && (
        <Button size="small" variant="outlined" onClick={showMoreRows}>
          Показать ещё {Math.min(pageSize, totalRows - windowEnd)}
        </Button>
      )}
      {!fullRender && (pageCount > 1 || windowStart > 0) && (
        <Button size="small" onClick={() => void showAllRows()}>
          Показать все
        </Button>
      )}
      {fullRender && (
        <Button size="small" onClick={() => goToPage(1)}>
          Свернуть
        </Button>
      )}
      {!isMobile && !fullRender && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            size="small"
            aria-label="Предыдущая страница"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Страница
          </Typography>
          <TextField
            size="small"
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => goToPage(Number(pageInput))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                goToPage(Number(pageInput));
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            inputProps={{
              min: 1,
              max: pageCount,
              style: { width: 44, textAlign: 'center', padding: '4px 4px' },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            из {pageCount}
          </Typography>
          <IconButton
            size="small"
            aria-label="Следующая страница"
            disabled={currentPage >= pageCount}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </Paper>
  ) : null;

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
            <Box className="no-print" sx={{ mb: { xs: 1, md: 0.5 }, mt: { xs: -2, md: -1.5 } }}> {/* ⭐ на десктопе тоже поднимаем выше */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              onClick={goBack}
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
          {/* ⭐ №276: сменить справочник проекта (право карточки проекта), строки не меняются — предложим пересчёт */}
          {!hidePrices && currentProject?.canEditCard && (
            <IconButton
              size="small"
              title="Сменить справочник цен проекта"
              onClick={(e) => setCatalogMenuAnchor(e.currentTarget)}
              sx={{ ml: 0.5, height: 24, width: 24 }}
            >
              <SwapHorizIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Menu
            anchorEl={catalogMenuAnchor}
            open={Boolean(catalogMenuAnchor)}
            onClose={() => setCatalogMenuAnchor(null)}
          >
            {catalogOptions
              .filter((c) => c.scope !== 'system' && !c.isArchived)
              .map((c) => (
                <MenuItem
                  key={c.id}
                  selected={c.id === priceCatalogId}
                  onClick={() => void handleSwitchCatalog(c.id)}
                >
                  {c.name}
                  {c.isDefault ? ' — моя база' : ''}
                </MenuItem>
              ))}
          </Menu>
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

   {/* ⭐ №197: одноразовая подсказка раздела (закрывается крестиком) */}
   <SectionIntro id="materials" version={2}>
     <b>Смета проекта:</b> «Кол-во спец.» — что заложено в спецификации, «Итого на тек. момент» —
     что реально сделано (фиксации). Процент и стоимость считаются по факту.
     <br />
     <b>Добавить строку:</b> «+» → выберите работу или материал из справочника или введите вручную.
     Для удобства можно импортировать несколько работ и материалов — скачайте Excel-шаблон и
     заполните его, инструкции уже внутри. Также можно скопировать смету из любого существующего проекта.
     <br />
     Стоимость материалов по смете рассчитывается на единицу работы (при добавлении строки есть
     калькулятор). Если материал нужен с фактической стоимостью — просто добавьте позицию.
     <br />
     <b>Зафиксировать объём</b> — кнопка в карточке/строке. Исправить фиксацию можно 72 часа,
     позже — только новая фиксация.
     <br />
     <b>Участники</b> добавляются в объекте или проекте (⚙ → «Участники»). Если вам скрыли цены —
     вы видите объёмы и прогресс, но не суммы.
     <br />
     <b>Выделить несколько строк:</b> на телефоне — долгое нажатие; на компьютере — чекбокс,
     Shift+Click или протяжка мышью.
   </SectionIntro>

   {/* ⭐ №208: импорт/шаблон — в одном меню «Из шаблона» (мобилка: иконка в шапке) */}

   {/* Поиск и кнопка добавления (десктоп; мобилка — в хэдере) */}
   {/* ⭐ №238: строго одна строка — без переноса; поиск сжимается, кнопки компактные */}
   <Box className="no-print" sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, minWidth: 0, mb: { xs: 0, md: 2 }, alignItems: 'center' }}>
        {!isMobile && (
          <TextField
            placeholder="Поиск материалов..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // ⭐ №238: без fullWidth и с flexBasis 0 — поиск сжимается, а не переносит кнопки
            sx={{ flexGrow: 1, flexBasis: 0, minWidth: 80 }}
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
<FormControl size="small" sx={{ minWidth: 130, flexShrink: 0 }}>
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

{!isMobile && (
  <Button
    variant="outlined"
    startIcon={<PlaylistAddIcon />}
    onClick={(e) => setImportMenuAnchor(e.currentTarget)}
    sx={{
      flexShrink: 0,
      // ⭐ №238: компактнее по горизонтали (было minWidth 168 + px 2)
      minWidth: 0,
      px: 1.5,
      whiteSpace: 'nowrap',
      // ⭐ №236: та же анимация, что у «Добавить» (раньше её не было)
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
        borderColor: 'primary.main',
        bgcolor: 'rgba(25,118,210,0.04)',
      },
    }}
  >
    Импорт
  </Button>
)}
{!isMobile && (
  <Button
    variant="outlined"
    color="primary"
    size="small"
    onClick={() => setExportModalOpen(true)}
    disabled={exporting !== null}
    title="Скачать смету"
    sx={{ minWidth: 0, px: 1.5, py: 1, flexShrink: 0, transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' } }}
  >
    {exporting ? <CircularProgress size={16} /> : <FileDownloadIcon fontSize="small" />}
  </Button>
)}
{!isMobile && canWriteMaterials && (
  <Button
    variant="contained"
    startIcon={<AddIcon />}
    onClick={handleOpenAddModal}
    sx={{
      bgcolor: '#4caf50',
      border: '2px solid #388e3c',
      // ⭐ №238: компактная кнопка — минимум резервируемой ширины
      minWidth: 0,
      px: 1.5,
      flexShrink: 0,
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
    Добавить
  </Button>
)}
      {/* ⭐ №208: меню «Из шаблона» */}
      <Menu
        anchorEl={importMenuAnchor}
        open={!!importMenuAnchor}
        onClose={() => setImportMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setImportMenuAnchor(null);
            void handleOpenTemplateModal();
          }}
        >
          <PlaylistAddIcon fontSize="small" style={{ marginRight: 8 }} />
          Добавить из проекта или шаблона
        </MenuItem>
        <MenuItem
          onClick={() => {
            setImportMenuAnchor(null);
            setImportOpen(true);
          }}
        >
          <UploadFileIcon fontSize="small" style={{ marginRight: 8 }} />
          Импорт из Excel
        </MenuItem>
        <MenuItem
          onClick={() => {
            setImportMenuAnchor(null);
            // ⭐ №385: xlsx-js-style грузим лениво — иначе он попадает в чанк сметы
            // (870 КБ + предупреждение Vite про Node-модуль stream)
            void import('../utils/importTemplate').then((m) =>
              m.downloadImportTemplate(),
            );
          }}
        >
          <FileDownloadOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
          Скачать пустой шаблон
        </MenuItem>
      </Menu>
      {/* ⭐ Модалка выбора формата экспорта */}
      {/* ⭐ №202: импорт сметы из Excel */}
      {projectId && (
        <EstimateImportModal
          open={importOpen}
          projectId={parseInt(projectId)}
          onClose={() => setImportOpen(false)}
          onImported={(created, skipped, catalogName) => void handleImported(created, skipped, catalogName)}
        />
      )}

      <Modal open={exportModalOpen} onClose={() => setExportModalOpen(false)} disableRestoreFocus>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 320 }, p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Скачать</Typography>
          <Stack spacing={1}>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => { setExportModalOpen(false); handleExport('pdf'); }} fullWidth>PDF</Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => { setExportModalOpen(false); handleExport('xlsx'); }} fullWidth>Excel</Button>
            {/* ⭐ №383: печать из браузера — с галочкой «только текущую страницу» */}
            {!isMobile && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={printOnlyPage}
                      onChange={(e) => setPrintOnlyPage(e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">Только текущую страницу</Typography>}
                />
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  fullWidth
                >
                  Печать
                </Button>
                <Typography variant="caption" color="text.secondary">
                  PDF и Excel — всегда все {materials.length} позиций. Печать:{' '}
                  {printOnlyPage ? 'текущая страница' : 'вся смета'}.
                </Typography>
              </>
            )}
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ №208/№290: позиции из сметы другого проекта или из шаблона */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} disableRestoreFocus>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '92%', sm: 480 }, p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Добавить в смету</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Позиции добавятся к текущей смете (сейчас в ней {materials.length}). Существующие строки
            не изменяются, прогресс и факт не переносятся.
          </Typography>

          <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
            {/* ⭐ №290: сметы других проектов — основной способ, как при создании проекта */}
            {availableProjects.filter((p) => String(p.id) !== projectId).length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Сметы ваших проектов
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.5, mb: 1 }}>
                  {availableProjects
                    .filter((p) => String(p.id) !== projectId)
                    .map((p) => (
                      <Button
                        key={`proj-${p.id}`}
                        variant="outlined"
                        disabled={applyingTemplate}
                        onClick={() => { void handleApplyProjectEstimate(p.id, p.name); }}
                        sx={{ justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name} — {p.objectName}
                        </span>
                        <span style={{ opacity: 0.7, flexShrink: 0, marginLeft: 8 }}>
                          {p.materialsCount} поз.
                        </span>
                      </Button>
                    ))}
                </Stack>
                <FormControlLabel
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                  control={
                    <Checkbox
                      size="small"
                      checked={zeroQuantities}
                      onChange={(e) => setZeroQuantities(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Обнулить количества — оставить названия и единицы измерения
                    </Typography>
                  }
                />
              </>
            )}

            {/* Шаблоны: добавление + удаление (раньше их нельзя было удалить) */}
            {templates.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Шаблоны смет
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {templates.map((t) => (
                    <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Button
                        variant="outlined"
                        disabled={applyingTemplate}
                        onClick={() => { void handleApplyTemplate(t.id); }}
                        sx={{ flex: 1, minWidth: 0, justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </span>
                        <span style={{ opacity: 0.7, flexShrink: 0, marginLeft: 8 }}>
                          {t.items?.length ?? 0} поз.
                        </span>
                      </Button>
                      <IconButton
                        aria-label={`Удалить шаблон ${t.name}`}
                        title="Удалить шаблон"
                        color="error"
                        disabled={deletingTemplateId === t.id || applyingTemplate}
                        onClick={() => { void handleDeleteTemplate(t); }}
                      >
                        {deletingTemplateId === t.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </>
            )}

            {templates.length === 0 &&
              availableProjects.filter((p) => String(p.id) !== projectId).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Пока нечего добавить: у других проектов нет позиций в смете. Заполните смету
                  любого проекта — он появится здесь. Шаблон можно сохранить из меню проекта
                  («Сохранить шаблон»).
                </Typography>
              )}
          </Box>

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
      {/* ⭐ №301: сортировка по дате последней фиксации */}
      <MenuItem onClick={() => applyMobileSort('lastFix', 'desc')}>По фиксации (сначала новые)</MenuItem>
      <MenuItem onClick={() => applyMobileSort('lastFix', 'asc')}>По фиксации (сначала старые)</MenuItem>
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
        <>
        {/* ⭐ №292/№293: панель массовых действий — sticky, иначе при 300 строках
            после выделения внизу приходится скроллить в самое начало сметы */}
        {selectedIds.size > 0 && (
          <Paper
            className="no-print"
            sx={{
              position: 'sticky',
              top: 8,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              px: 1.5,
              py: 1,
              mb: 1,
              borderRadius: 2,
              border: '1px solid #90caf9',
              bgcolor: '#e3f2fd',
              boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            }}
          >
            {/* ⭐ №298: «выбрать все» прямо в панели — как в шапке таблицы,
                чтобы не тянуться наверх после первого выделения */}
            <Checkbox
              size="small"
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              onChange={toggleSelectAll}
              title="Выбрать все строки с учётом поиска и фильтра / снять выделение"
              inputProps={{ 'aria-label': 'Выбрать все строки' }}
              sx={{ p: 0.25, ml: -0.75, mr: 0.25, alignSelf: 'center' }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Выбрано: {selectedIds.size} из {sortedMaterials.length}
              {!hidePrices && selectedTotals.count > 0 && (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                  title="Смета — план по выделенным, факт — уже выполнено (фиксации)"
                >
                  · смета {rub(selectedTotals.plan)} · факт {rub(selectedTotals.fact)}
                </Typography>
              )}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {/* ⭐ №295: «Удалить» левее — подальше от «Отмены», чтобы не промахнуться */}
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => void handleBulkDelete()}
              disabled={bulkBusy}
            >
              Удалить
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => void handleBulkDuplicate()}
              disabled={bulkBusy}
            >
              Дублировать
            </Button>
            <Button size="small" onClick={clearSelection} disabled={bulkBusy}>
              Отмена
            </Button>
          </Paper>
        )}
        {/* ⭐ №383: шапка для печати — на экране скрыта, на бумаге объясняет, что за смета */}
        <Box className="print-only" sx={{ display: 'none', mb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            Смета — {currentProject?.name ?? ''}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {currentObject?.name ?? ''} · печать {new Date().toLocaleString('ru-RU')}
            {fullRender
              ? ''
              : ` · строки ${sliceStart + 1}–${windowEnd} из ${totalRows}`}
          </Typography>
        </Box>
        <TableContainer
          component={Paper}
          ref={tableScrollRef}
          className="print-area"
          sx={{ mb: 2 }}
        >
          <Table sx={{ minWidth: 1500, ...(dragSelecting ? { userSelect: 'none' } : {}) }}>
<TableHead ref={tableHeadRef} sx={{ bgcolor: '#f5f5f5' }}>
<TableRow>
<TableCell rowSpan={2} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
  {/* ⭐ №292: чекбокс «выбрать все» — в колонке «№», раскладка таблицы не меняется */}
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Checkbox
      size="small"
      checked={allVisibleSelected}
      indeterminate={someVisibleSelected}
      onChange={toggleSelectAll}
      disabled={sortedMaterials.length === 0}
      title="Выбрать все строки (по текущему фильтру)"
      inputProps={{ 'aria-label': 'Выбрать все строки' }}
      sx={{ p: 0.25 }}
    />
    №
  </Box>
</TableCell>
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
<TableCell rowSpan={2} sx={{ fontWeight: 600, textAlign: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#e0e0e0' } }} onClick={() => handleSortClick('lastFix')}>
Посл. фикс., ед.{renderSortIcon('lastFix')}
</TableCell>
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
            <TableCell sx={{ fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9' }}>За ед.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>Итого руб.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9' }}>За ед.</TableCell>
            <TableCell sx={{ fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>Итого руб.</TableCell>
          </TableRow>
        )}
</TableHead>
            <TableBody>
{visibleRows.map(({ material: m, index: idx }) => (
  <MaterialRow
    key={m.id}
    material={m}
    index={idx}
    selected={selectedIds.has(m.id)}
    highlighted={(highlightId === m.id && highlightVisible) || flashId === m.id}
    hidePrices={hidePrices}
    canWrite={canWriteMaterials}
    inlineSide={inlinePrice?.materialId === m.id ? inlinePrice.side : null}
    inlineValue={inlinePrice?.materialId === m.id ? inlinePrice.value : ''}
    onHoverRow={handleHoverRow}
    onNumberMouseDown={handleNumberMouseDown}
    onToggleRow={handleRowSelect}
    onOpenPhotos={handleOpenPhotos}
    onOpenFix={handleOpenFixModal}
    onOpenSettings={handleOpenSettings}
    onDuplicate={handleDuplicate}
    onInlinePriceStart={handleInlinePriceStart}
    onInlinePriceChange={handleInlinePriceChange}
    onInlinePriceCommit={handleInlinePriceCommit}
    onInlinePriceCancel={handleInlinePriceCancel}
  />
))}
{filteredMaterials.length === 0 && (
  <TableRow>
    <TableCell colSpan={hidePrices ? 9 : 17} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
      {materials.length === 0 ? 'Материалы не добавлены' : 'Ничего не найдено'}
    </TableCell>
  </TableRow>
)}
            </TableBody>
<TableFooter ref={tableFootRef}>
<TableRow sx={{ bgcolor: '#FFF9C4' }}>
<TableCell colSpan={4} sx={{ fontWeight: 700 }}>ИТОГО:</TableCell>
<TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.sumSpecQuantity}</TableCell>
<TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.sumTotalUsed}</TableCell>
<TableCell />
              <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.weightedPercent}%</TableCell>
              {/* ⭐ Итоги по деньгам скрываем при hidePrices */}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(totals.sumWorkCurrent)}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(totals.sumMatCurrent)}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(totals.sumCurrentTotal)}</TableCell>}
              {!hidePrices && <TableCell sx={{ borderLeft: '2px solid #90caf9' }} />}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(totals.sumWorkEstimate)}</TableCell>}
              {!hidePrices && <TableCell sx={{ borderLeft: '2px solid #90caf9' }} />}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{rub(totals.sumMatEstimate)}</TableCell>}
              {!hidePrices && <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', borderLeft: '2px solid #90caf9' }}>{rub(totals.sumEstimate)}</TableCell>}
              <TableCell />
</TableRow>
</TableFooter>
          </Table>
        </TableContainer>
        {filterHint}
        {paginationBar}
        </>
      )}

  {/* Карточки для мобилки */}
  {isMobile && (
    <Stack
      ref={mobileListRef}
      spacing={1}
      // ⭐ №393: отступ под фиксированную плашку итогов задаёт `EstimateScrollChrome`
      // через ref (CSS), чтобы смена направления скролла не перерисовывала список.
      sx={{ pb: selectedIds.size > 0 ? '150px' : undefined }}
    >
      {/* ⭐ №294/№299: подсказка о жесте переехала в сворачиваемое пояснение раздела
          (SectionIntro выше), чтобы не занимать место в списке */}
      {sortedMaterials.length > 0 ? (
visibleMaterials.map((m) => (
  <MaterialCard
    key={m.id}
    material={m}
    selected={selectedIds.has(m.id)}
    highlighted={(highlightId === m.id && highlightVisible) || flashId === m.id}
    selectionMode={selectedIds.size > 0}
    hidePrices={hidePrices}
    canWrite={canWriteMaterials}
    onTouchStart={handleCardTouchStart}
    onTouchEnd={cancelLongPress}
    onCardClick={handleCardClick}
    onToggle={toggleSelected}
    onOpenPhotos={handleOpenPhotos}
    onOpenFix={handleOpenFixModal}
    onOpenSettings={handleOpenSettings}
  />
))
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {materials.length === 0 ? 'Материалы не добавлены' : 'Ничего не найдено'}
              </Typography>
            </Paper>
          )}
          {filterHint}
          {paginationBar}
        </Stack>
      )}

{/* ⭐ №393: плашка итогов + FAB «+» + кнопка «вниз» живут в отдельном компоненте
    вместе с направлением скролла — страница на скролл больше не перерисовывается.
    ⭐ 6.7: деньги скрыты при hidePrices, процент остаётся;
    ⭐ №294: в режиме выделения место плашки занимает панель массовых действий. */}
<EstimateScrollChrome
  isMobile={isMobile}
  hidePrices={hidePrices}
  canWrite={canWriteMaterials}
  selectionMode={selectedIds.size > 0}
  totals={totals}
  hasWindowBar={hasWindowBar}
  listRef={mobileListRef}
  onAddClick={handleOpenAddModal}
  onScrollToFooter={scrollToFooter}
/>

{/* ⭐ №294: массовые действия на мобилке — панель над нижним меню */}
{isMobile && selectedIds.size > 0 && (
  <Paper
    className="no-print"
    elevation={8}
    sx={{
      position: 'fixed',
      left: 8,
      right: 8,
      bottom: SUMMARY_BAR_BOTTOM,
      zIndex: 9,
      borderRadius: 2,
      border: '1px solid #90caf9',
      bgcolor: '#e3f2fd',
      px: 1.5,
      py: 1,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
      {/* ⭐ №298: «выбрать все» в панели — не нужно возвращаться к шапке таблицы */}
      <Checkbox
        size="small"
        checked={allVisibleSelected}
        indeterminate={someVisibleSelected}
        onChange={toggleSelectAll}
        title="Выбрать все строки с учётом поиска и фильтра / снять выделение"
        inputProps={{ 'aria-label': 'Выбрать все строки' }}
        sx={{ p: 0.25, ml: -0.75, mr: 0.25 }}
      />
      <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
        Выбрано: {selectedIds.size} из {sortedMaterials.length}
        {!hidePrices && selectedTotals.count > 0 && (
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ ml: 1 }}
            title="Смета — план по выделенным, факт — уже выполнено (фиксации)"
          >
            · смета {rub(selectedTotals.plan)} · факт {rub(selectedTotals.fact)}
          </Typography>
        )}
      </Typography>
      <Button size="small" onClick={clearSelection} disabled={bulkBusy}>
        Отмена
      </Button>
    </Box>
    {/* ⭐ №295: «Удалить» слева — на мобилке «Отмена» стоит прямо над правой кнопкой,
        поэтому права́я кнопка теперь безопасное «Дублировать» */}
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button
        size="small"
        variant="contained"
        color="error"
        startIcon={<DeleteIcon />}
        onClick={() => void handleBulkDelete()}
        disabled={bulkBusy}
        sx={{ flex: 1 }}
      >
        Удалить
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopyIcon />}
        onClick={() => void handleBulkDuplicate()}
        disabled={bulkBusy}
        sx={{ flex: 1 }}
      >
        Дублировать
      </Button>
    </Box>
  </Paper>
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
        // ⭐ №329: отступ над заголовком вдвое меньше (32 → 16 px), остальные — как были
        pt: 2,
        px: 4,
        pb: 4,
        borderRadius: 2,
        // ⭐ №331/№334: все поля ниже на 10 % (56 → 50 px). «Примечание» — многострочное:
        // его paddings НЕ трогаем, иначе авторазмер MUI (TextareaAutosize) считает высоту с
        // двойным отступом и поле показывает пустые строки сверху/снизу.
        '& .MuiInputBase-input:not(textarea)': {
          paddingTop: '13px',
          paddingBottom: '13px',
        },
        // фиксируем высоту однострочных (select, input, autocomplete), многострочное — авто
        '& .MuiInputBase-root:not(.MuiInputBase-multiline)': {
          height: 50,
        },
        // подпись внутри поля держим по центру новой высоты
        '& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': {
          transform: 'translate(14px, 14px) scale(1)',
        },
         }}>
          {/* ⭐ №330: заголовок по центру окна */}
          <Typography variant="h6" gutterBottom textAlign="center">Добавить позицию</Typography>
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
        {/* ⭐ №333: примечание — в одну строку, но растёт при вводе (возврат к №327) */}
        <TextField
          fullWidth
          label="Примечание"
          multiline
          minRows={1}
          maxRows={6}
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
        />
        {/* ⭐ №390: при скрытых ценах ценовые поля не показываем — строка создаётся без цены */}
        {!hidePrices && (
          <>
        <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена работ</Typography></Divider>
        {/* ⭐ №319: два режима — «из справочника» и «своя цена». В ручном режиме
            справочник и категории скрыты, чтобы не путать: вводится одна цифра. */}
        {addManualWork ? (
          <>
            <TextField
              fullWidth
              type="number"
              label="Новая цена работы, ₽"
              value={addPricePrice}
              onChange={(e) => setAddPricePrice(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="Рукописная цена: станет расценкой в справочнике проекта"
            />
            <Button
              size="small"
              variant="text"
              onClick={() => setAddManualWork(false)}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              ← Выбрать из справочника
            </Button>
          </>
        ) : (
        <>
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
            setAddPricePrice(String(value.price ?? ''));
            if (!newName.trim()) setNewName(value.name);
            if (!newArticle.trim() && value.article) setNewArticle(value.article);
            } else {
            setAddPricePrice('');
            }
            }}
            onInputChange={(_e, value) => handlePriceSearch(value)}
            getOptionLabel={(option) =>
            `${option.name} — ${option.price == null ? '—' : `${option.price.toLocaleString('ru-RU')} ₽`}/${UNIT_OPTIONS.find(u => u.value === option.unit)?.label || option.unit}`
            }
noOptionsText="Ничего не найдено. Начни вводить название..."
onOpen={() => { if (priceOptions.length === 0) handlePriceSearch(''); }}
// ⭐ №179: доверяем серверному поиску (он ищет и по цене) — клиентский фильтр по подписи мешал
filterOptions={(opts) => opts}
// ⭐ №275: черновики импорта видны серыми и недоступны для выбора
renderOption={renderPriceOption}
getOptionDisabled={isDraftPrice}
renderInput={(params) => (
<TextField {...params} label="Стоимость работ" placeholder="Название или цена..." helperText={priceOptions.length >= PRICE_SEARCH_LIMIT ? 'Не больше 50 строк — уточните запрос' : undefined} />
)}
/>
            {selectedPriceItem && (
            <Box sx={{ bgcolor: 'rgba(76, 175, 80, 0.08)', p: 1.5, borderRadius: 1 }}>
            <Typography variant="body2">
            Цена: <strong>{(selectedPriceItem.price ?? 0).toLocaleString('ru-RU')} ₽</strong>
            {' '}• {selectedPriceItem.category?.name || 'Без категории'}
            </Typography>
            </Box>
            )}
            {/* ⭐ №319: поле «Цена работы» показывается только в ручном режиме (кнопка ниже) */}
            {/* ⭐ №319: переход в ручной режим — справочник и категории скрываются */}
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setAddManualWork(true);
                setSelectedPriceItem(null);
                setPriceOptions([]);
              }}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              ✏️ Указать свою цену работы
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
            </>
            )}
            
    <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Цена материала</Typography></Divider>
    {/* ⭐ №319: режим «своя цена материала» — справочник скрыт, вводится одна цифра */}
    {addManualMaterial ? (
      <>
        <TextField
          fullWidth
          type="number"
          label="Новая цена материала на ед., ₽"
          value={addMatPricePrice}
          onChange={(e) => setAddMatPricePrice(e.target.value)}
          inputProps={{ min: 0, step: 0.01 }}
          helperText={`Цена за 1 ${unitLabelOf(newUnit)} строки — станет расценкой в справочнике проекта`}
        />
        {/* ⭐ №325: калькулятор считает цену за единицу и подставляет её в поле выше */}
        <Button
          size="small"
          variant="text"
          onClick={() => {
            if (addFromVolume) {
              setAddFromVolume(false);
              return;
            }
            setAddFromVolume(true);
            setAddCalcVolume(newSpecQuantity ? String(newSpecQuantity) : '');
            setAddCalcPacks('1');
            setAddCalcPackPrice(
              (selectedMaterialItem?.price ?? 0) > 0
                ? String(selectedMaterialItem?.price)
                : '',
            );
          }}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          {addFromVolume
            ? '↩ Свернуть расчёт'
            : '🧮 Рассчитать расход на 1 ед.'}
        </Button>
        {addFromVolume && (
          <>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                type="number"
                label={`Объём работ, ${unitLabelOf(newUnit)}`}
                value={addCalcVolume}
                onChange={(e) => {
                  setAddCalcVolume(e.target.value);
                  applyCalcToPrice(addCalcPacks, addCalcPackPrice, e.target.value);
                }}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                type="number"
                label="Количество материала"
                value={addCalcPacks}
                onChange={(e) => {
                  setAddCalcPacks(e.target.value);
                  applyCalcToPrice(e.target.value, addCalcPackPrice, addCalcVolume);
                }}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ width: 156, flexShrink: 0 }}
              />
            </Stack>
            <TextField
              fullWidth
              type="number"
              label="Цена за единицу материала, ₽"
              value={addCalcPackPrice}
              onChange={(e) => {
                setAddCalcPackPrice(e.target.value);
                applyCalcToPrice(addCalcPacks, e.target.value, addCalcVolume);
              }}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="За тонну, м³, мешок, рулон — в чём покупаете материал"
            />
            {addCalcPerUnit > 0 ? (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {money2(addCalcPacksNum)} × {money2(addCalcPackPriceNum)} ₽ ={' '}
                  {money2(addCalcMaterialTotal)} ₽ на {money2(addCalcVolumeNum)}{' '}
                  {unitLabelOf(newUnit)} → {money2(addCalcPerUnit)} ₽ за 1{' '}
                  {unitLabelOf(newUnit)}
                </Typography>
                <Typography variant="caption" color="primary" display="block">
                  Цена на ед. подставлена в поле выше — можно поправить вручную.
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Заполните объём работ, количество материала и цену за единицу — цену
                за 1 {unitLabelOf(newUnit)} посчитаем сами.
              </Typography>
            )}
          </>
        )}
        <Button
          size="small"
          variant="text"
          onClick={() => {
            setAddManualMaterial(false);
            setAddFromVolume(false);
          }}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          ← Выбрать из справочника
        </Button>
      </>
    ) : (
    <>
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
    onChange={(_e, value) => {
    setSelectedMaterialItem(value);
    if (value) {
    setNewUnit(value.unit);
    setAddMatPricePrice(String(value.price ?? ''));
    if (!newName.trim()) setNewName(value.name);
    if (!newArticle.trim() && value.article) setNewArticle(value.article);
    } else {
    setAddMatPricePrice('');
    }
    }}
    onInputChange={(_e, value) => handleMaterialPriceSearch(value)}
    getOptionLabel={(o) => `${o.name} — ${(o.price ?? 0).toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`}
    noOptionsText="Ничего не найдено"
    onOpen={() => { if (materialOptions.length === 0) handleMaterialPriceSearch(''); }}
    // ⭐ №179: доверяем серверному поиску (он ищет и по цене)
    filterOptions={(opts) => opts}
    renderOption={renderPriceOption}
    getOptionDisabled={isDraftPrice}
    renderInput={(params) => (
    <TextField {...params} label="Стоимость материала на ед." placeholder="Название или цена..." helperText={materialOptions.length >= PRICE_SEARCH_LIMIT ? 'Не больше 50 строк — уточните запрос' : undefined} />
    )}
    />
    {selectedMaterialItem && (
    <Box sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', p: 1.5, borderRadius: 1 }}>
    <Typography variant="body2">
    Цена: <strong>{(selectedMaterialItem.price ?? 0).toLocaleString('ru-RU')} ₽</strong> • {selectedMaterialItem.category?.name || 'Без категории'}
    </Typography>
    </Box>
    )}
    {/* ⭐ №319: цена материалa показывается только в ручном режиме (кнопка ниже).
        Норма расхода теперь ниже, вне режимов — она доступна всегда. */}
    {/* ⭐ №319: переход в ручной режим — справочник и категории скрываются */}
    <Button
      size="small"
      variant="text"
      onClick={() => {
        setAddManualMaterial(true);
        setSelectedMaterialItem(null);
        setMaterialOptions([]);
      }}
      sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
    >
      ✏️ Указать свою цену материала
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
        {/* ⭐ №326: поля «Расход материала» больше нет — весь расчёт в «своя цена материала».
            Если у расценки указана упаковка, честно предупреждаем: цена строки = цена расценки. */}
        {(selectedMaterialItem?.packSize ?? 0) > 0 && (
          <Typography variant="caption" color="text.secondary">
            У расценки указана упаковка ({selectedMaterialItem?.packSize}{' '}
            {unitLabelOf(selectedMaterialItem?.unit ?? 'PIECE')} за{' '}
            {(selectedMaterialItem?.price ?? 0).toLocaleString('ru-RU')} ₽) — цена строки
            возьмётся как цена расценки. Нужна цена за 1 {unitLabelOf(newUnit)}? Нажмите
            «✏️ Указать свою цену материала» и посчитайте 🧮.
          </Typography>
        )}
        </>
        )}
{/* ⭐ №319: цена за 1 единицу строки — всегда на виду, чтобы не путаться в ценах. */}
{(() => {
  const workPerUnit = numOr0(addPricePrice);
  const materialPerUnit = addMaterialPerUnit;
  return (
    <Box sx={{ bgcolor: 'rgba(25, 118, 210, 0.06)', p: 1.5, borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">
        За 1 {unitLabelOf(newUnit)} (работа + материал)
      </Typography>
      <Typography variant="body1" fontWeight={700}>
        {(workPerUnit + materialPerUnit).toLocaleString('ru-RU')} ₽
      </Typography>
      <Typography variant="caption" color="text.secondary">
        работа {workPerUnit.toLocaleString('ru-RU')} ₽ + материал{' '}
        {materialPerUnit.toLocaleString('ru-RU')} ₽
      </Typography>
    </Box>
  );
})()}
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
<Button variant="contained" onClick={() => void handleCreateMaterial()}>Сохранить</Button>
</Box>
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ №271: подтверждение нулевой цены */}
      <Modal open={zeroConfirmOpen} onClose={() => setZeroConfirmOpen(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 430 },
            p: 3,
            borderRadius: 3,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Сохранить с ценой 0?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            В позиции «{newName}» нулевые цены:
          </Typography>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {zeroItems.map((item) => (
              <Typography key={item} variant="body2">
                • {item}
              </Typography>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Ноль — допустимая цена. После сохранения позиция появится в справочнике проекта.
          </Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setZeroConfirmOpen(false)}>Вернуться</Button>
            <Button variant="contained" onClick={() => void handleCreateMaterial(true)}>
              Сохранить с нулём
            </Button>
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
                Выберите дату
              </Typography>
              {/* ⭐ №233: даты — сетка 2×2, кнопки одинакового размера и не «склеены» */}
              <Box
                sx={{
                  mt: 0.5,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1,
                }}
              >
                {[0, 1, 2, 3].map(offset => (
                  <Button
                    key={offset}
                    size="small"
                    variant={fixDayOffset === offset ? 'contained' : 'outlined'}
                    onClick={() => setFixDayOffset(offset)}
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      px: 1,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      textTransform: 'none',
                    }}
                  >
                    {fixDayLabel(offset)}
                  </Button>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Фиксацию можно исправить 72 часа.
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
              <Button variant="contained" onClick={handleAddFix} disabled={fixSaving}>
                Зафиксировать
              </Button>
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
{/* ⭐ №390: количество меняется только при снятой защите спецификации */}
{settingsMaterial?.isSpecLocked && (
  <Typography variant="caption" color="text.secondary">
    Спецификация защищена — количество изменить нельзя, пока не снимете защиту.
  </Typography>
)}
<Button
  size="small"
  variant="text"
  onClick={() => void handleToggleSpecLock()}
  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
>
  {settingsMaterial?.isSpecLocked
    ? '🔓 Снять защиту спецификации'
    : '🔒 Защитить спецификацию'}
</Button>
<TextField fullWidth label="Примечание" multiline minRows={1} maxRows={6} value={editNote} onChange={e => setEditNote(e.target.value)} />

{/* ⭐ №390: при скрытых ценах ценовые поля в редактировании не показываем */}
{!hidePrices && (<>
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
        return `${o.name} — ${(o.price ?? 0).toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`;
      }}
      noOptionsText="Ничего не найдено"
      // ⭐ №179: серверный поиск ищет и по цене — клиентский фильтр не должен его портить
      filterOptions={(opts) => opts}
      renderOption={renderPriceOption}
      getOptionDisabled={isDraftPrice}
      renderInput={(params) => (
        <TextField {...params} label="Работы из справочника" placeholder="Название или цена..." helperText={editPriceOptions.length >= PRICE_SEARCH_LIMIT ? 'Не больше 50 строк — уточните запрос' : undefined} />
      )}
      onOpen={() => { if (editPriceOptions.length === 0) handleEditPriceSearch(''); }}
    />
    {editSelectedPriceItem && (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Текущая цена: <b>{(editSelectedPriceItem.price ?? 0).toLocaleString('ru-RU')} ₽</b>
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
onChange={(_e, value) => {
  setEditSelectedMaterialItem(value);
  setEditMaterialItemId(value?.id ?? null);
}}
onInputChange={(_e, value) => handleEditMaterialPriceSearch(value)}
getOptionLabel={(o) => `${o.name} — ${(o.price ?? 0).toLocaleString('ru-RU')} ₽/${UNIT_OPTIONS.find(u => u.value === o.unit)?.label || o.unit}`}
noOptionsText="Ничего не найдено"
onOpen={() => { if (editMaterialOptions.length === 0) handleEditMaterialPriceSearch(''); }}
filterOptions={(opts) => opts}
renderOption={renderPriceOption}
getOptionDisabled={isDraftPrice}
renderInput={(params) => (
<TextField {...params} label="Материал из справочника" placeholder="Название или цена..." helperText={editMaterialOptions.length >= PRICE_SEARCH_LIMIT ? 'Не больше 50 строк — уточните запрос' : undefined} />
)}
/>
{editSelectedMaterialItem && (
<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
<Typography variant="body2" color="text.secondary">
Цена: <b>{(editSelectedMaterialItem.price ?? 0).toLocaleString('ru-RU')} ₽</b> • {editSelectedMaterialItem.category?.name || 'Без категории'}
</Typography>
<Button size="small" onClick={() => { setEditSelectedMaterialItem(null); setEditMaterialItemId(null); }}>Сбросить</Button>
</Box>
)}
{/* ⭐ №326: поля «Расход материала» в правке нет — цена материала берётся из расценки,
    а ручная цена на единицу задаётся при добавлении («своя цена материала» + 🧮). */}
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
</>)}
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

      {/* ⭐ №384/№386: кнопка «вниз» к ИТОГО и плашке страниц переехала в
          `EstimateScrollChrome` (⭐ №393) вместе с состоянием «долистали до низа». */}
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

      {/* ⭐ №228: галерея фото материала и модалка «Сделать фото / из галереи» */}
      <PhotoGalleryDialog
        open={Boolean(photoGalleryMaterial)}
        materialId={photoGalleryMaterial?.id ?? 0}
        materialName={photoGalleryMaterial?.name ?? ''}
        objectId={currentObject?.id ?? Number(objectId)}
        projectId={currentProject?.id ?? Number(projectId)}
        objectName={currentObject?.name}
        projectName={currentProject?.name}
        onClose={() => setPhotoGalleryMaterial(null)}
        onAddPhoto={() => {
          setPhotoCaptureMaterial(photoGalleryMaterial);
          setPhotoGalleryMaterial(null);
        }}
        onChanged={() => { void refreshMaterials(); }}
      />
      <PhotoCaptureDialog
        open={Boolean(photoCaptureMaterial)}
        materialId={photoCaptureMaterial?.id ?? 0}
        materialName={photoCaptureMaterial?.name ?? ''}
        onClose={() => setPhotoCaptureMaterial(null)}
        onUploaded={() => {
          setPhotoCaptureMaterial(null);
          // Обновляем список, чтобы бейдж количества был актуальным
          void refreshMaterials();
        }}
      />

      {/* ⭐ №275: подтверждение правки цены в смете */}
      <Modal
        open={Boolean(priceConfirm)}
        onClose={() => {
          if (!priceSaving) setPriceConfirm(null);
        }}
      >
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 440 },
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Изменить цену {priceConfirm?.side === 'work' ? 'работы' : 'материала'}?
          </Typography>
          {priceConfirm && (
            <>
              <Typography sx={{ mb: 1 }}>{priceConfirm.material.name}</Typography>
              <Typography sx={{ mb: 2 }}>
                {(priceConfirm.side === 'work'
                  ? priceConfirm.material.unitPrice
                  : priceConfirm.material.materialUnitPrice
                ).toLocaleString('ru-RU')}{' '}
                ₽ → <b>{priceConfirm.value.toLocaleString('ru-RU')} ₽</b>
                {' за '}
                {UNIT_OPTIONS.find((u) => u.value === priceConfirm.material.unit)?.label ||
                  priceConfirm.material.unit}
              </Typography>
              {priceConfirm.material.totalUsed > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  В строке зафиксировано {priceConfirm.material.totalUsed}{' '}
                  {UNIT_OPTIONS.find((u) => u.value === priceConfirm.material.unit)?.label || ''}.
                  Фактическая стоимость строки изменится:{' '}
                  {rub(
                    (priceConfirm.side === 'work'
                      ? priceConfirm.material.unitPrice
                      : priceConfirm.material.materialUnitPrice) * priceConfirm.material.totalUsed,
                  )}{' '}
                  → {rub(priceConfirm.value * priceConfirm.material.totalUsed)}.
                </Alert>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={priceConfirm.alsoCatalog}
                    onChange={(e) =>
                      setPriceConfirm({ ...priceConfirm, alsoCatalog: e.target.checked })
                    }
                    // ⭐ №302: работа и материал равны — галочка доступна всегда,
                    // при отсутствии привязки позиция найдётся по названию или создастся
                    disabled={priceSaving}
                  />
                }
                label={`Изменить цену и в справочнике${
                  priceCatalogName ? ` «${priceCatalogName}»` : ''
                }`}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {(priceConfirm.side === 'work'
                  ? priceConfirm.material.priceItemId == null
                  : priceConfirm.material.materialItemId == null)
                  ? 'Позиции пока нет в справочнике — при сохранении она будет найдена по названию или создана в категории «Разное». Без галочки изменится только эта смета.'
                  : 'По умолчанию меняется только эта смета — база цен остаётся прежней. Поставьте галочку, если новую цену нужно сохранить и в справочнике.'}
              </Typography>
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setPriceConfirm(null)} disabled={priceSaving}>
              Отмена
            </Button>
            <Button variant="contained" onClick={() => void handlePriceSave()} disabled={priceSaving}>
              {priceSaving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default Materials;