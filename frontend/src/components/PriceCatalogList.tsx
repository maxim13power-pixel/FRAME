// frontend/src/components/PriceCatalogList.tsx
// ⭐ №151: список справочников цен — оформление как «Объекты → Проекты»:
// карточки, внутри справочника — привычный вид с категориями и расценками.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Fab,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Modal,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import SortIcon from '@mui/icons-material/Sort';
import SectionIntro from './SectionIntro'; // ⭐ №179: одноразовая подсказка раздела
import { FAB_STYLE } from '../theme';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import {
  archivePriceCatalog,
  copyPriceCatalog,
  createPriceCatalog,
  fetchPriceCatalogs,
  renamePriceCatalog,
  restorePriceCatalog,
} from '../services/priceListService';
import type { PriceCatalogData } from '../services/priceListService';
import { fetchObjects } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService';
import type { ObjectData } from '../services/objectService';
import type { ProjectData } from '../services/projectService';
import { useFeedback } from '../contexts/FeedbackContext';
import { getApiErrorText } from '../utils/errors';

interface PriceCatalogListProps {
  /** Предзаполненное название для нового справочника (например, имя объекта) */
  defaultNewName?: string;
}

const PriceCatalogList: React.FC<PriceCatalogListProps> = ({ defaultNewName }) => {
  const navigate = useNavigate();
  const { notify, success, error: notifyError, confirm } = useFeedback();

  const [catalogs, setCatalogs] = useState<PriceCatalogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceCatalogData | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  // ⭐ №164: «поделиться» — копия расценок в справочник объекта/проекта
  const [copySource, setCopySource] = useState<PriceCatalogData | null>(null);
  const [copyObjects, setCopyObjects] = useState<ObjectData[]>([]);
  const [copyProjects, setCopyProjects] = useState<ProjectData[]>([]);
  const [copyObjectId, setCopyObjectId] = useState<number | ''>('');
  const [copyProjectId, setCopyProjectId] = useState<number | ''>('');
  const [copyName, setCopyName] = useState('');
  const [copySaving, setCopySaving] = useState(false);
  // ⭐ №179: поиск по справочникам (имя / объект / проект)
  const [search, setSearch] = useState('');
  // ⭐ №179: архив справочников — как у объектов (кнопка «Архив» в шапке + возврат)
  const [showArchived, setShowArchived] = useState(false);
  // ⭐ №195: шестерёнка на карточке — все действия в одном шите (как в «Объектах»)
  const [actionsCatalog, setActionsCatalog] = useState<PriceCatalogData | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  // ⭐ №179: сортировка списка (архив → сортировка → поиск, как в «Объектах»)
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'items'>('name');
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  // как в «Объектах»/«Бригадах»: мобильная раскладка — это < md
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const toggleArchive = () => {
    setShowArchived((v) => !v);
    setSearch('');
    setMobileSearchOpen(false);
  };

  // ⭐ №179: кнопки в шапке обязательно мемоизируем — useMobileHeader держит trailing
  // в зависимостях эффекта (иначе бесконечный ре-рендер), как в Objects.tsx.
  // Порядок как в «Объектах»: сначала архив, потом сортировка (поиск рисует сама шапка).
  const headerTrailing = useMemo(
    () => (
      <>
        <IconButton
          onClick={() => {
            setShowArchived((v) => !v);
            setSearch('');
            setMobileSearchOpen(false);
          }}
          aria-label={showArchived ? 'Активные справочники' : 'Архив справочников'}
          sx={{
            bgcolor: showArchived ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
            color: showArchived ? '#1976d2' : '#424242',
            flexShrink: 0,
          }}
        >
          {showArchived ? <CheckCircleIcon /> : <ArchiveIcon />}
        </IconButton>
        <IconButton
          onClick={(e) => setSortAnchorEl(e.currentTarget)}
          aria-label="Сортировка"
          sx={{
            bgcolor: sortBy !== 'name' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
            color: sortBy !== 'name' ? '#1976d2' : '#424242',
            flexShrink: 0,
          }}
        >
          <SortIcon />
        </IconButton>
      </>
    ),
    [showArchived, sortBy],
  );

  // ⭐ №179: своя мобильная шапка — иначе шапка PriceList дублировала поиск и давала
  // нерабочую сортировку на списке справочников (сортировать тут нечего).
  useMobileHeader({
    title: showArchived ? 'Архив справочников' : 'Справочники цен',
    onBack: () => navigate('/'),
    searchOpen: mobileSearchOpen,
    searchValue: search,
    searchPlaceholder: 'Поиск справочника, объекта или проекта...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => {
      setSearch('');
      setMobileSearchOpen(false);
    },
    onSearchChange: (v) => setSearch(v),
    trailing: headerTrailing,
  });

  const activeCatalogs = useMemo(() => catalogs.filter((c) => !c.isArchived), [catalogs]);
  const archivedCatalogs = useMemo(() => catalogs.filter((c) => c.isArchived), [catalogs]);

  const visibleCatalogs = useMemo(() => {
    const base = showArchived ? archivedCatalogs : activeCatalogs;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter((c) =>
          [c.name, c.objectName ?? '', c.projectName ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : base;
    // ⭐ №179: сортировка
    return [...filtered].sort((a, b) => {
      if (sortBy === 'items') return (b.itemsCount ?? 0) - (a.itemsCount ?? 0);
      if (sortBy === 'newest') {
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [activeCatalogs, archivedCatalogs, search, showArchived, sortBy]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // ⭐ №179: грузим вместе с архивом — иначе кнопка «Архив» не знает, сколько там
      setCatalogs(await fetchPriceCatalogs({ includeArchived: true }));
    } catch (err) {
      notifyError('Не удалось загрузить справочники: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenCreate = () => {
    setEditing(null);
    setName(defaultNewName ?? '');
    setModalOpen(true);
  };

  const handleOpenRename = (catalog: PriceCatalogData) => {
    setEditing(catalog);
    setName(catalog.name);
    setModalOpen(true);
  };


  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Введите название справочника', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await renamePriceCatalog(editing.id, trimmed);
        success(`Справочник переименован в «${trimmed}»`);
      } else {
        const created = await createPriceCatalog(trimmed);
        success(`Справочник «${created.name}» создан`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось сохранить справочник'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (catalog: PriceCatalogData) => {
    const ok = await confirm({
      title: 'Архивировать справочник?',
      text: `«${catalog.name}» (${catalog.itemsCount} расценок) уйдёт из списка. Данные и уже созданные сметы сохранятся — справочник можно будет вернуть.`,
      confirmText: 'Архивировать',
      danger: true,
    });
    if (!ok) return;
    try {
      await archivePriceCatalog(catalog.id);
      success('Справочник архивирован');
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось архивировать справочник'));
    }
  };

  // ⭐ №179: вернуть справочник из архива (как «Вернуть из архива» у объектов)
  const handleRestore = async (catalog: PriceCatalogData) => {
    try {
      await restorePriceCatalog(catalog.id);
      success(`Справочник «${catalog.name}» возвращён из архива`);
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось вернуть справочник'));
    }
  };

  // ⭐ №164: «поделиться» справочником — копия расценок в справочник объекта/проекта
  const handleOpenCopy = async (catalog: PriceCatalogData) => {
    setCopySource(catalog);
    setCopyName(`Копия «${catalog.name}»`);
    setCopyObjectId('');
    setCopyProjectId('');
    setCopyProjects([]);
    try {
      // ⭐ №176: архивные объекты в «Поделиться» больше не попадают (фильтр в fetchObjects)
      setCopyObjects(await fetchObjects());
    } catch {
      setCopyObjects([]);
    }
  };

  const handleCopyObjectChange = async (value: number | '') => {
    setCopyObjectId(value);
    setCopyProjectId('');
    if (!value) {
      setCopyProjects([]);
      return;
    }
    try {
      setCopyProjects(await fetchProjectsByObject(value));
    } catch {
      setCopyProjects([]);
    }
  };

  const handleCopyConfirm = async () => {
    if (!copySource) return;
    if (!copyObjectId && !copyProjectId) {
      notify('Выберите объект или проект', 'warning');
      return;
    }
    setCopySaving(true);
    try {
      const created = await copyPriceCatalog(copySource.id, {
        name: copyName.trim() || undefined,
        objectId: copyProjectId ? undefined : Number(copyObjectId),
        projectId: copyProjectId ? Number(copyProjectId) : undefined,
      });
      success(
        `Скопировано расценок: ${created.itemsCount ?? 0} → «${created.name}»`,
      );
      setCopySource(null);
      await load();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось скопировать справочник'));
    } finally {
      setCopySaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    // ⭐ №179: та же сетка, что в «Объектах» — maxWidth 1000 по центру, без своего padding
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Меню сортировки (привязано к кнопке в шапке на мобилке) */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
      >
        <MenuItem onClick={() => { setSortBy('name'); setSortAnchorEl(null); }}>
          По названию А-Я
        </MenuItem>
        <MenuItem onClick={() => { setSortBy('newest'); setSortAnchorEl(null); }}>
          Сначала новые
        </MenuItem>
        <MenuItem onClick={() => { setSortBy('items'); setSortAnchorEl(null); }}>
          По числу расценок
        </MenuItem>
      </Menu>

      {/* ⭐ №179: заголовок и «Архив» — точно как в «Объектах» (h4 + кнопка справа) */}
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/')}
            sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
            aria-label="В главное меню"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            {showArchived ? 'Архив справочников' : 'Справочники цен'}
          </Typography>
          <Button
            variant={showArchived ? 'contained' : 'outlined'}
            startIcon={showArchived ? <CheckCircleIcon /> : <ArchiveIcon />}
            onClick={toggleArchive}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {showArchived ? 'Активные' : 'Архив'}
          </Button>
        </Box>
      )}

      {/* Панель поиска и создания (десктоп) — как в «Объектах»; на мобилке поиск в шапке */}
      {!isMobile && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Поиск: справочник, объект или проект"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <InputLabel id="catalog-sort-label">Сортировка</InputLabel>
            <Select
              labelId="catalog-sort-label"
              value={sortBy}
              label="Сортировка"
              onChange={(e) => setSortBy(e.target.value as 'name' | 'newest' | 'items')}
            >
              <MenuItem value="name">По названию А-Я</MenuItem>
              <MenuItem value="newest">Сначала новые</MenuItem>
              <MenuItem value="items">По числу расценок</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              bgcolor: '#4caf50',
              border: '2px solid #388e3c',
              whiteSpace: 'nowrap',
              '&:hover': {
                bgcolor: '#388e3c',
                borderColor: '#388e3c',
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Создать
          </Button>
        </Box>
      )}

      <Box sx={{ mb: 2 }}>
        {/* ⭐ №179: одноразовая подсказка раздела (закрывается крестиком, больше не мешает) */}
        <SectionIntro id="price-catalogs" version={4}>
          <b>Справочник</b> — отдельный набор расценок под конкретный объект или тип работ
          («Квартиры/Коттеджи», «Склад X5»). Внутри — свои категории, работы и материалы.
          Нажмите на справочник, чтобы открыть расценки. Все действия — в шестерёнке ⚙ на карточке;
          архивные возвращаются через «Архив» в шапке.
        </SectionIntro>
      </Box>

      <Stack spacing={isMobile ? 1 : 2}>
        {visibleCatalogs.map((catalog) => (
          <Paper
            key={catalog.id}
            elevation={2}
            sx={{
              p: isMobile ? 1.5 : 3,
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'box-shadow 0.3s, transform 0.3s',
              '&:hover': { boxShadow: 6, transform: 'scale(1.01)' },
            }}
            onClick={() => navigate(`/price-list/${catalog.id}`)}
          >
            {/* ⭐ №195: схема как на «Объектах»: иконка, название, шестерёнка действий */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
              <MenuBookIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28, mt: 0.25 }} />
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
                {catalog.name}
              </Typography>
              <IconButton
                title="Действия со справочником"
                aria-label="Действия со справочником"
                onClick={(e) => {
                  e.stopPropagation();
                  setActionsCatalog(catalog);
                }}
                sx={{ bgcolor: 'action.hover', width: 44, height: 44, ml: 0.5, mt: -0.5 }}
              >
                <SettingsIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
              {catalog.isSystem && (
                <Chip label="системный" size="small" variant="outlined" color="primary" />
              )}
              {catalog.scope === 'object' && (
                <Chip
                  label={`объект: ${catalog.objectName ?? '—'}`}
                  size="small"
                  variant="outlined"
                  color="success"
                />
              )}
              {catalog.scope === 'project' && (
                <Chip
                  label={`проект: ${catalog.projectName ?? '—'}`}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              )}
              {catalog.scope === 'personal' && (
                <Chip label="личный" size="small" variant="outlined" />
              )}
              {catalog.canWrite === false && (
                <Chip label="только чтение" size="small" variant="outlined" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              расценок: {catalog.itemsCount} · проектов: {catalog.projectsCount}
              {catalog.scope === 'object' ? ' · справочник объекта' : ''}
            </Typography>
          </Paper>
        ))}

        {visibleCatalogs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {search.trim()
              ? `По запросу «${search.trim()}» ничего не найдено.`
              : showArchived
                ? 'В архиве пусто — сюда попадают справочники, убранные через шестерёнку ⚙.'
                : 'Справочников пока нет — создайте первый.'}
          </Typography>
        )}
      </Stack>

      {/* ⭐ №179: на телефоне «Создать» — FAB внизу справа, как в «Бригадах» */}
      {isMobile && (
        <Fab color="primary" sx={{ ...FAB_STYLE, bottom: 80 }} onClick={handleOpenCreate} aria-label="Создать справочник">
          <LibraryAddIcon />
        </Fab>
      )}

      {/* ⭐ №195: действия со справочником — один шит, как в «Объектах»/«Проектах».
          Недоступное не прячем: кнопка серая + подпись, что нужно для доступа. */}
      <Modal open={!!actionsCatalog} onClose={() => setActionsCatalog(null)}>
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
            {actionsCatalog?.name || 'Справочник'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Действия со справочником. Серые кнопки недоступны вашей роли.
          </Typography>
          {actionsCatalog && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              {actionsCatalog.isSystem && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  label="системный"
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              )}
              {actionsCatalog.scope === 'object' && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  label={`объект: ${actionsCatalog.objectName ?? '—'}`}
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              )}
              {actionsCatalog.scope === 'project' && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="warning"
                  label={`проект: ${actionsCatalog.projectName ?? '—'}`}
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              )}
              {actionsCatalog.scope === 'personal' && (
                <Chip
                  size="small"
                  variant="outlined"
                  label="личный"
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              )}
              <Chip
                size="small"
                variant="outlined"
                label={actionsCatalog.isArchived ? '🗄 в архиве' : `${actionsCatalog.itemsCount} расценок`}
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
            </Box>
          )}

          <Stack spacing={1}>
            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<MenuBookIcon />}
              onClick={() => {
                const c = actionsCatalog;
                setActionsCatalog(null);
                if (c) navigate(`/price-list/${c.id}`);
              }}
            >
              Открыть расценки
            </Button>

            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<EditIcon />}
              disabled={!actionsCatalog || actionsCatalog.canWrite === false || actionsCatalog.isArchived}
              onClick={() => {
                const c = actionsCatalog;
                setActionsCatalog(null);
                if (c) handleOpenRename(c);
              }}
            >
              Переименовать
            </Button>
            {actionsCatalog && (actionsCatalog.canWrite === false || actionsCatalog.isArchived) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
                {actionsCatalog.isArchived
                  ? 'Справочник в архиве — сначала верните его.'
                  : 'Переименовать может автор справочника или администратор объекта.'}
              </Typography>
            )}

            <Button
              size="large"
              fullWidth
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              disabled={!actionsCatalog || actionsCatalog.isArchived}
              onClick={() => {
                const c = actionsCatalog;
                setActionsCatalog(null);
                if (c) void handleOpenCopy(c);
              }}
            >
              Скопировать в объект или проект
            </Button>

            {actionsCatalog?.isArchived ? (
              <Button
                size="large"
                fullWidth
                variant="outlined"
                startIcon={<UnarchiveIcon />}
                disabled={actionsCatalog.canWrite === false}
                onClick={() => {
                  const c = actionsCatalog;
                  setActionsCatalog(null);
                  if (c) void handleRestore(c);
                }}
              >
                Вернуть из архива
              </Button>
            ) : (
              <Button
                size="large"
                fullWidth
                variant="outlined"
                startIcon={<ArchiveIcon />}
                disabled={!actionsCatalog || actionsCatalog.canWrite === false}
                onClick={() => {
                  const c = actionsCatalog;
                  setActionsCatalog(null);
                  if (c) void handleArchive(c);
                }}
              >
                Архивировать
              </Button>
            )}
          </Stack>
        </Paper>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 420 },
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {editing ? 'Переименовать справочник' : 'Новый справочник цен'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {editing
              ? 'Название видно только вам.'
              : 'Например: «Квартиры/Коттеджи», «Склад X5 Новосемейкино». Название можно изменить позже.'}
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label="Название справочника"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 80 }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button variant="contained" onClick={() => { void handleSave(); }} disabled={saving}>
              {saving ? <CircularProgress size={18} /> : 'Сохранить'}
            </Button>
          </Stack>
        </Paper>
      </Modal>
      {/* ⭐ №164: «поделиться» — копия расценок в справочник объекта/проекта */}
      <Modal open={!!copySource} onClose={() => setCopySource(null)} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 460 },
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Поделиться справочником
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Расценки «{copySource?.name}» ({copySource?.itemsCount ?? 0}) будут скопированы
            в новый справочник выбранного объекта или проекта. Исходный справочник не меняется.
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название нового справочника"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              inputProps={{ maxLength: 80 }}
            />
            <FormControl fullWidth>
              <InputLabel id="catalog-copy-object-label">Объект</InputLabel>
              <Select
                labelId="catalog-copy-object-label"
                label="Объект"
                value={copyObjectId}
                onChange={(e) => {
                  void handleCopyObjectChange(
                    e.target.value === '' ? '' : Number(e.target.value),
                  );
                }}
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {copyObjects.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!copyObjectId}>
              <InputLabel id="catalog-copy-project-label">Проект (необязательно)</InputLabel>
              <Select
                labelId="catalog-copy-project-label"
                label="Проект (необязательно)"
                value={copyProjectId}
                onChange={(e) =>
                  setCopyProjectId(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
              >
                <MenuItem value="">
                  <em>Весь объект</em>
                </MenuItem>
                {copyProjects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setCopySource(null)}>Отмена</Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleCopyConfirm();
              }}
              disabled={copySaving}
            >
              {copySaving ? <CircularProgress size={18} /> : 'Скопировать'}
            </Button>
          </Stack>
        </Paper>
      </Modal>

    </Box>
  );
};

export default PriceCatalogList;
