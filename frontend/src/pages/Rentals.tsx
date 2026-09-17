import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Button,
  Modal,
  Stack,
  Fab,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import EngineeringIcon from '@mui/icons-material/Engineering';
import UpdateIcon from '@mui/icons-material/Update';
import SettingsIcon from '@mui/icons-material/Settings';
import SortIcon from '@mui/icons-material/Sort';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchRentals, createRental, extendRental, updateRental, deleteRental } from '../services/rentalsService';
import type { RentalData } from '../services/rentalsService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import ConfirmDialog from '../components/ConfirmDialog';

// Вспомогательная функция для форматирования даты (как в Objects)
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2); // ← только последние 2 цифры
  return `${day}.${month}.${year}`;
};

// ⭐ Дата в формате input[type=date] (YYYY-MM-DD) — для min в модалке продления
const toInputDate = (dateStr: string) => new Date(dateStr).toISOString().slice(0, 10);

// Функция для вычисления дней до окончания (как в Objects)
const daysUntil = (endDateStr: string) => {
  const today = new Date();
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// ⭐ % прошедших дней аренды (clamp 0..100) — для LinearProgress
const rentalProgress = (startDate: string, endDate: string) => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end <= start) return 100;
  const percent = ((Date.now() - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, percent));
};

// ⭐ Сумма для Chip: 15000 → «15 000», 15000.5 → «15 000,5»
const formatMoney = (v: number) => {
  const hasFraction = Math.abs(v % 1) > 0.001;
  return v.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

// ⭐ Чип дней: <0 → error «Просрочено», <=3 → error, <=10 → warning, иначе success
const getDaysChip = (days: number) => {
  if (days < 0) return { color: 'error' as const, label: `Просрочено ${Math.abs(days)}дн.` };
  if (days <= 3) return { color: 'error' as const, label: `${days} дн.` };
  if (days <= 10) return { color: 'warning' as const, label: `${days} дн.` };
  return { color: 'success' as const, label: `${days} дн.` };
};

// ⭐ Сообщение об ошибке из axios (class-validator присылает массив)
const extractError = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  if (Array.isArray(m)) return m[0];
  if (typeof m === 'string') return m;
  return fallback;
};

const Rentals: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<RentalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nearest'); // 'nearest' (дефолт), 'newest', 'name', 'price'
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);

  // ⭐ Форма нового оборудования
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);

  // ⭐ Продление аренды
  const [extendingRental, setExtendingRental] = useState<RentalData | null>(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extEndDate, setExtEndDate] = useState('');
  const [extPrice, setExtPrice] = useState('');
  const [extendError, setExtendError] = useState('');

  // ⭐ Удаление (через ConfirmDialog, кнопка внутри модалки редактирования)
  const [deletingRental, setDeletingRental] = useState<RentalData | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ⭐ Редактирование аренды (шестерёнка на карточке)
  const [editingRental, setEditingRental] = useState<RentalData | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState('');

  // Загрузка аренд при монтировании
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Не авторизован');
      return;
    }

    const loadRentals = async () => {
      try {
        setLoading(true);
        const data = await fetchRentals();
        setRentals(data);
        setError('');
      } catch (err: any) {
        setError(extractError(err, 'Ошибка загрузки аренд'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadRentals();
  }, [token]);

  // Фильтрация по name/location + сортировка
  const filteredAndSortedRentals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let filtered = rentals.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q)
    );

    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );
        break;
      case 'price':
        filtered.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case 'nearest':
      default:
        // ⭐ дефолт: ближайшие по дате окончания сверху
        filtered.sort(
          (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        );
        break;
    }
    return filtered;
  }, [rentals, searchQuery, sortBy]);

  // ⭐ Баннер-уведомления: аренды с daysLeft <= 10 или < 0 (от горящих к спокойным)
  const upcoming = useMemo(() => {
    return rentals
      .map((r) => ({ rental: r, daysLeft: daysUntil(r.endDate) }))
      .filter((x) => x.daysLeft <= 10)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [rentals]);
  const bannerSeverity = upcoming.some((x) => x.daysLeft <= 3) ? 'error' : 'warning';

  // ⭐ trailing для мобильного хэдера — стабильная ссылка через useMemo (как в Objects)
  const headerTrailing = useMemo(
    () =>
      isMobile ? (
        <IconButton
          onClick={(e) => setSortAnchorEl(e.currentTarget)}
          sx={{
            bgcolor: sortBy !== 'nearest' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
            color: sortBy !== 'nearest' ? '#1976d2' : '#424242',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
          }}
        >
          <SortIcon />
        </IconButton>
      ) : undefined,
    [isMobile, sortBy]
  );

  useMobileHeader({
    title: 'Аренда',
    onBack: () => navigate('/'),
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: 'Поиск аренд...',
    onSearchOpen: () => setMobileSearchOpen(true),
    onSearchClose: () => { setSearchQuery(''); setMobileSearchOpen(false); },
    onSearchChange: (v) => setSearchQuery(v),
    trailing: headerTrailing,
  });

  // Открыть модалку добавления (сброс формы)
  const handleOpenAddModal = () => {
    setNewName('');
    setNewLocation('');
    setNewResponsible('');
    setNewStartDate('');
    setNewEndDate('');
    setNewPrice('');
    setNewNote('');
    setAddError('');
    setAddModalOpen(true);
  };

  // ⭐ Создать аренду — клиентская валидация, ошибки через Alert в модалке (не window.alert)
  const handleCreateRental = async () => {
    if (!token) return;
    if (!newName.trim()) {
      setAddError('Введите название оборудования');
      return;
    }
    if (!newStartDate || !newEndDate) {
      setAddError('Укажите даты аренды');
      return;
    }
    if (new Date(newEndDate).getTime() < new Date(newStartDate).getTime()) {
      setAddError('Дата окончания не может быть раньше даты начала');
      return;
    }
    const price = parseFloat(newPrice.replace(',', '.'));
    if (isNaN(price) || price < 0) {
      setAddError('Укажите цену (число, не меньше 0)');
      return;
    }
    try {
      setSaving(true);
      const created = await createRental({
        name: newName.trim(),
        location: newLocation.trim() || undefined,
        responsible: newResponsible.trim() || undefined,
        startDate: newStartDate,
        endDate: newEndDate,
        price,
        note: newNote.trim() || undefined,
      });
      setRentals((prev) => [created, ...prev]);
      setAddModalOpen(false);
    } catch (err: any) {
      setAddError(extractError(err, 'Ошибка создания аренды'));
    } finally {
      setSaving(false);
    }
  };

  // Открыть модалку продления
  const handleOpenExtend = (rental: RentalData) => {
    setExtendingRental(rental);
    setExtEndDate('');
    setExtPrice('');
    setExtendError('');
    setExtendModalOpen(true);
  };

  // ⭐ Продлить аренду: newEndDate строго больше текущей endDate
  const handleExtend = async () => {
    if (!token || !extendingRental) return;
    if (!extEndDate) {
      setExtendError('Укажите новую дату окончания');
      return;
    }
    if (new Date(extEndDate).getTime() <= new Date(extendingRental.endDate).getTime()) {
      setExtendError('Новая дата должна быть строго больше текущей даты окончания');
      return;
    }
    const price = parseFloat(extPrice.replace(',', '.'));
    if (isNaN(price) || price < 0) {
      setExtendError('Укажите цену продления (число, не меньше 0)');
      return;
    }
    try {
      setSaving(true);
      const updated = await extendRental(extendingRental.id, {
        newEndDate: extEndDate,
        price,
      });
      setRentals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setExtendModalOpen(false);
    } catch (err: any) {
      setExtendError(extractError(err, 'Ошибка продления аренды'));
    } finally {
      setSaving(false);
    }
  };

  // Открыть модалку редактирования (предзаполняем поля из записи)
  const handleOpenEdit = (rental: RentalData) => {
    setEditingRental(rental);
    setEditName(rental.name);
    setEditLocation(rental.location ?? '');
    setEditResponsible(rental.responsible ?? '');
    setEditStartDate(toInputDate(rental.startDate));
    setEditEndDate(toInputDate(rental.endDate));
    setEditNote(rental.note ?? '');
    setEditError('');
    setEditModalOpen(true);
  };

  // ⭐ Сохранить редактирование: price/totalSpent не трогаем (финансовая история)
  const handleUpdateRental = async () => {
    if (!token || !editingRental) return;
    if (!editName.trim()) {
      setEditError('Введите название оборудования');
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditError('Укажите даты аренды');
      return;
    }
    if (new Date(editEndDate).getTime() < new Date(editStartDate).getTime()) {
      setEditError('Дата окончания не может быть раньше даты начала');
      return;
    }
    try {
      setSaving(true);
      const updated = await updateRental(editingRental.id, {
        name: editName.trim(),
        location: editLocation.trim(),
        responsible: editResponsible.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        note: editNote.trim(),
      });
      setRentals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditModalOpen(false);
    } catch (err: any) {
      setEditError(extractError(err, 'Ошибка сохранения аренды'));
    } finally {
      setSaving(false);
    }
  };

  // ⭐ Удалить аренду (после подтверждения в ConfirmDialog)
  const handleDelete = async () => {
    if (!token || !deletingRental) return;
    try {
      await deleteRental(deletingRental.id);
      setRentals((prev) => prev.filter((r) => r.id !== deletingRental.id));
    } catch (err: any) {
      setError(extractError(err, 'Ошибка удаления аренды'));
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingRental(null);
      setEditModalOpen(false); // ⭐ удалили из модалки редактирования — закрываем её тоже
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Меню сортировки (привязано к trailing-кнопке хэдера на мобилке) */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
      >
        <MenuItem onClick={() => { setSortBy('nearest'); setSortAnchorEl(null); }}>По дате окончания (ближайшие)</MenuItem>
        <MenuItem onClick={() => { setSortBy('newest'); setSortAnchorEl(null); }}>Сначала новые</MenuItem>
        <MenuItem onClick={() => { setSortBy('name'); setSortAnchorEl(null); }}>По названию А-Я</MenuItem>
        <MenuItem onClick={() => { setSortBy('price'); setSortAnchorEl(null); }}>По сумме (сначала больше)</MenuItem>
      </Menu>

      {/* Заголовок для десктопа + кнопка «в главное меню» */}
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
            Аренда
          </Typography>
        </Box>
      )}

      {/* Панель поиска и добавления (десктоп) */}
      {!isMobile && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            placeholder="Поиск аренд..."
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="rentals-sort-label">Сортировка</InputLabel>
            <Select
              labelId="rentals-sort-label"
              value={sortBy}
              label="Сортировка"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="nearest">По дате окончания (ближайшие)</MenuItem>
              <MenuItem value="newest">Сначала новые</MenuItem>
              <MenuItem value="name">По названию А-Я</MenuItem>
              <MenuItem value="price">По сумме (сначала больше)</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<NoteAddIcon />}
            onClick={handleOpenAddModal}
            sx={{
              bgcolor: '#4caf50',
              '&:hover': { bgcolor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
            }}
          >
            Добавить оборудование
          </Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ⭐ Баннер-уведомления: аренды с daysLeft <= 10 или < 0 (списком) */}
      {upcoming.length > 0 && (
        <Alert severity={bannerSeverity} sx={{ mb: 2 }}>
          {upcoming.map(({ rental, daysLeft }) => (
            <Typography key={rental.id} variant="body2" sx={{ display: 'block' }}>
              ⏰ Аренда заканчивается: {rental.name} —{' '}
              {daysLeft < 0
                ? `просрочено ${Math.abs(daysLeft)} дн.`
                : `осталось ${daysLeft} дн.`}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Список аренд – красивые карточки */}
      <Stack spacing={isMobile ? 1 : 2}>
        {filteredAndSortedRentals.length > 0 ? (
          filteredAndSortedRentals.map((rental) => {
            const daysLeft = daysUntil(rental.endDate);
            const percent = rentalProgress(rental.startDate, rental.endDate);
            const chip = getDaysChip(daysLeft);
            // ⭐ Цвет полосы прогресса повторяет пороги чипа
            const barColor =
              daysLeft < 0 || percent >= 100
                ? '#d32f2f'
                : daysLeft <= 10
                ? '#ed6c02'
                : '#1976d2';

            return (
              <Paper
                key={rental.id}
                elevation={2}
                sx={{
                  p: isMobile ? 1.5 : 3,
                  borderRadius: 3,
                  transition: 'box-shadow 0.3s, transform 0.3s',
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'scale(1.01)',
                  },
                }}
              >
                {/* Верхняя строка: иконка, название, кнопки, чипы */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: isMobile ? 0.5 : 1 }}>
                  <EngineeringIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, fontSize: { xs: '1.05rem', md: '1.15rem' } }}>
                    {rental.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenExtend(rental)}
                    title="Продлить"
                    sx={{ mr: 0.5, color: '#1976d2' }}
                  >
                    <UpdateIcon fontSize="small" />
                  </IconButton>
                  {/* ⭐ Шестерёнка: редактирование + удаление (внутри модалки) */}
                  <IconButton
                    size="small"
                    onClick={() => handleOpenEdit(rental)}
                    title="Настройки"
                    sx={{ mr: 0.5, color: '#424242' }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                  {/* ⭐ Чип суммы — всего потрачено (price + все продления) */}
                  <Chip
                    label={`Σ ${formatMoney(rental.totalSpent)} ₽`}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontWeight: 'bold',
                      mr: 1,
                      backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    }}
                  />
                  <Chip
                    label={chip.label}
                    color={chip.color}
                    size="small"
                    variant="outlined"
                    sx={{
                      backgroundColor:
                        daysLeft < 0 || daysLeft <= 3 ? 'rgba(211, 47, 47, 0.1)' :
                        daysLeft <= 10 ? 'rgba(237, 108, 2, 0.1)' :
                        'rgba(76, 175, 80, 0.1)',
                    }}
                  />
                </Box>

                {/* Где лежит (рендерим только если заполнено) */}
                {rental.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PlaceIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {rental.location}
                    </Typography>
                  </Box>
                )}

                {/* Кто ответственный (рендерим только если заполнено) */}
                {rental.responsible && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {rental.responsible}
                    </Typography>
                  </Box>
                )}

                {/* Прогресс: прошедшие дни / всего дней (clamp 0..100) */}
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    mt: 1,
                    mb: isMobile ? 1.7 : 2,
                    bgcolor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: barColor,
                      borderRadius: 5,
                    },
                  }}
                />

                {/* Строка с датами и ценой аренды */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Цена аренды: {formatMoney(rental.price)} ₽
                  </Typography>
                </Box>
              </Paper>
            );
          })
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Оборудование не найдено</Typography>
          </Paper>
        )}
      </Stack>

      {/* Мобильная плавающая кнопка */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 114,
            right: 21,
            zIndex: 1000,
            bgcolor: '#4caf50',
            '&:hover': { bgcolor: '#388e3c' },
          }}
          onClick={handleOpenAddModal}
        >
          <NoteAddIcon />
        </Fab>
      )}

      {/* Модалка добавления оборудования */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            maxWidth: 400,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Добавить оборудование
          </Typography>
          {/* ⭐ Ошибки — Alert внутри модалки (не window.alert) */}
          {addError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Что за оборудование"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Где лежит"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              helperText="необязательно"
            />
            <TextField
              fullWidth
              label="Ответственный"
              value={newResponsible}
              onChange={(e) => setNewResponsible(e.target.value)}
              helperText="необязательно"
            />
            <TextField
              fullWidth
              label="Дата начала"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Цена аренды, ₽"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              required
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Заметка"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              helperText="необязательно"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button variant="outlined" onClick={() => setAddModalOpen(false)}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleCreateRental} disabled={saving}>
                Сохранить
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка продления аренды */}
      <Modal open={extendModalOpen} onClose={() => setExtendModalOpen(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            maxWidth: 400,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Продлить аренду
          </Typography>
          {extendingRental && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {extendingRental.name}
            </Typography>
          )}
          {/* ⭐ Ошибки — Alert внутри модалки */}
          {extendError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {extendError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Новая дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={extEndDate}
              onChange={(e) => setExtEndDate(e.target.value)}
              inputProps={{ min: extendingRental ? toInputDate(extendingRental.endDate) : undefined }}
              required
            />
            <TextField
              fullWidth
              label="Цена продления, ₽"
              type="number"
              value={extPrice}
              onChange={(e) => setExtPrice(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              helperText='Сумма прибавится к «Всего потрачено»'
              required
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button variant="outlined" onClick={() => setExtendModalOpen(false)}>
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={handleExtend}
                disabled={saving}
                sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
              >
                Продлить
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ Модалка редактирования аренды (открывается с шестерёнки) */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            maxWidth: 400,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Редактировать аренду
          </Typography>
          {editingRental && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {editingRental.name}
            </Typography>
          )}
          {/* ⭐ Ошибки — Alert внутри модалки (не window.alert) */}
          {editError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {editError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Что за оборудование"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Где лежит"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              helperText="необязательно"
            />
            <TextField
              fullWidth
              label="Ответственный"
              value={editResponsible}
              onChange={(e) => setEditResponsible(e.target.value)}
              helperText="необязательно"
            />
            <TextField
              fullWidth
              label="Дата начала"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
              required
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Заметка"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              helperText="необязательно"
            />
            {/* ⭐ Слева удаление, справа Отмена/Сохранить (как в Objects) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  setDeletingRental(editingRental); // запоминаем аренду для удаления
                  setDeleteConfirmOpen(true); // ConfirmDialog УЖЕ есть — просто открываем
                }}
              >
                Удалить
              </Button>
              <Box>
                <Button variant="outlined" onClick={() => setEditModalOpen(false)} sx={{ mr: 1 }}>
                  Отмена
                </Button>
                <Button variant="contained" onClick={handleUpdateRental} disabled={saving}>
                  Сохранить
                </Button>
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка подтверждения удаления */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Удалить аренду?"
        message={
          deletingRental
            ? `«${deletingRental.name}» будет удалена безвозвратно.`
            : ''
        }
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeletingRental(null);
        }}
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </Box>
  );
};

export default Rentals;







