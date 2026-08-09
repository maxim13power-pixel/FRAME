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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddHomeIcon from '@mui/icons-material/AddHome';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import { fetchObjects, createObject } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { useAuth } from '../contexts/AuthContext'; // предполагаем, что есть контекст авторизации
import { useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import { updateObject, deleteObject } from '../services/objectService';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CloseIcon from '@mui/icons-material/Close';

// Вспомогательная функция для форматирования даты
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2); // ← только последние 2 цифры
  return `${day}.${month}.${year}`;
};

// Функция для вычисления процента выполнения (пока случайный или 0)
const getProgress = () => {
  // позже будем вычислять по проектам, сейчас просто случайное число
  return Math.floor(Math.random() * 60) + 20; // от 20 до 80%
};

// Функция для вычисления дней до окончания
const daysUntil = (endDateStr: string) => {
  const today = new Date();
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const Objects: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth(); // получаем токен из контекста (если используете)
  const navigate = useNavigate();
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'name', 'endDate', 'progress'
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Форма нового объекта
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<ObjectData | null>(null);
  const [deletingObject, setDeletingObject] = useState<ObjectData | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  

//console.log('Objects render, token:', token);

//const getProgressColor = (progress: number) => {
  // Нелинейный переход: прогресс в квадрате, чтобы цвет дольше оставался в теплой зоне
  //const t = Math.pow(progress / 100, 2.0); // степень >1 смещает зеленый к концу
  //const hue = 30 + t * (120 - 30);
  //return `hsl(${hue}, 100%, 45%)`;
//};

  // Загрузка объектов при монтировании
useEffect(() => {
  if (!token) {
    setLoading(false);
    setError('Не авторизован');
    return;
  }

  const loadObjects = async () => {
    try {
      console.log('Загружаем объекты...');
      setLoading(true);
      const data = await fetchObjects(token);
      setObjects(data);
      //console.log('Получены объекты:', data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка загрузки объектов');
      console.error(err);
    } finally {
      setLoading(false);
      
    }
  };
  loadObjects();
}, [token]);

  // Фильтрация по поиску
const filteredAndSortedObjects = useMemo(() => {
  // Сначала фильтруем
  let filtered = objects.filter(obj =>
    obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Потом сортируем
  switch (sortBy) {
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'endDate':
      filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      break;
    case 'progress':
      // пока прогресс случайный, сортировка по нему не имеет смысла, но позже заменим
      // пока сортируем по дате окончания для примера
      filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      break;
    case 'newest':
    default:
      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      break;
  }
  return filtered;
}, [objects, searchQuery, sortBy]);

  const handleOpenAddModal = () => setAddModalOpen(true);
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    // очищаем форму
    setNewName('');
    setNewAddress('');
    setNewStartDate('');
    setNewEndDate('');
  };
const handleCreateObject = async () => {
  if (!token || !newName || !newAddress || !newStartDate || !newEndDate) {
    alert('Заполните все поля');
    return;
  }
  
  // ↓↓↓ ВАЛИДАЦИЯ ДАТ ↓↓↓
  if (new Date(newEndDate) < new Date(newStartDate)) {
    alert('❌ Дата окончания не может быть раньше даты начала!');
    return;
  }
  // ↑↑↑ КОНЕЦ ВАЛИДАЦИИ ↑↑↑
  
  try {
    const created = await createObject(token, {
      name: newName,
      address: newAddress,
      startDate: newStartDate,
      endDate: newEndDate,
    });
    setObjects(prev => [created, ...prev]);
    handleCloseAddModal();
  } catch (err: any) {
    alert('Ошибка при создании объекта: ' + (err.response?.data?.message || err.message));
  }
};
  //const handleCreateObject = async () => {
    //if (!token || !newName || !newAddress || !newStartDate || !newEndDate) {
      //alert('Заполните все поля');
      //return;
    //}
    //try {
      //const created = await createObject(token, {
        //name: newName,
        //address: newAddress,
        //startDate: newStartDate,
        //endDate: newEndDate,
      //});
      //setObjects(prev => [created, ...prev]); // добавляем новый объект в начало списка
      //handleCloseAddModal();
    //} catch (err: any) {
      //alert('Ошибка при создании объекта: ' + (err.response?.data?.message || err.message));
    //}
  //};
  
    const handleOpenEdit = (obj: ObjectData) => {
    setEditingObject(obj);
    setEditName(obj.name);
    setEditAddress(obj.address);
    setEditStartDate(obj.startDate.slice(0, 10));
    setEditEndDate(obj.endDate.slice(0, 10));
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditingObject(null);
  };

const handleUpdateObject = async () => {
  if (!token || !editingObject) return;
  
  // ↓↓↓ ВАЛИДАЦИЯ ДАТ ↓↓↓
  if (new Date(editEndDate) < new Date(editStartDate)) {
    alert('❌ Дата окончания не может быть раньше даты начала!');
    return;
  }
  // ↑↑↑ КОНЕЦ ВАЛИДАЦИИ ↑↑↑
  
  try {
    const updated = await updateObject(token, Number(editingObject.id), {
      name: editName,
      address: editAddress,
      startDate: editStartDate,
      endDate: editEndDate,
    });
    setObjects(prev => prev.map(obj => obj.id === updated.id ? updated : obj));
    handleCloseEdit();
  } catch (err) {
    alert('Ошибка обновления');
  }
};

const handleDeleteObject = async () => {
  if (!token || !deletingObject) return;
  try {
    await deleteObject(token, Number(deletingObject.id));
    setObjects(prev => prev.filter(obj => obj.id !== deletingObject.id));
    setDeleteConfirmOpen(false);
    setDeletingObject(null); // очищаем
  } catch (err) {
    alert('Ошибка удаления');
  }
};
const handleSearchOpen = () => {
  setShowSearch(true);
  setTimeout(() => searchInputRef.current?.focus(), 100);
};

const handleSearchClose = () => {
  setShowSearch(false);
  setSearchQuery(''); // опционально: очищать поиск при закрытии
};
  // Функция для получения цвета текста дней
  const getDaysColor = (days: number) => {
    if (days < 0) return 'error'; // просрочено
    if (days < 7) return 'error';
    if (days < 15) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
   <Box sx={{ mt: -1.7 }}>
  {/* Верхний блок с заголовком и иконками (только для мобилок) */}
{isMobile && (
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, minHeight: 48 }}>
    {showSearch ? (
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
        <TextField
          inputRef={searchInputRef}
          placeholder="Поиск объектов..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <IconButton onClick={handleSearchClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Box>
    ) : (
<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
  <Typography variant="h5">Объекты</Typography>
  <Box
    onClick={handleSearchOpen}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      cursor: 'pointer',
      px: 1,
      py: 0.5,
      borderRadius: 2,
      border: '1px solid transparent',
      transition: 'border-color 0.2s',
      '&:hover': {
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.04)',
      },
      alignSelf: 'flex-end',  // <-- добавляем эту строку
      mt: 0.6,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      Поиск объектов...
    </Typography>
    <SearchIcon fontSize="small" color="action" />
  </Box>
</Box>
    )}
  </Box>
)}

  {/* Заголовок для десктопа (всегда виден) */}
  {!isMobile && (
    <Typography variant="h4" sx={{ mb: 2 }}>
      Объекты
    </Typography>
  )}

  {/* Панель поиска и добавления (десктоп) */}
  {!isMobile && (
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <TextField
        placeholder="Поиск объектов..."
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
        <InputLabel id="sort-label">Сортировка</InputLabel>
        <Select
          labelId="sort-label"
          value={sortBy}
          label="Сортировка"
          onChange={(e) => setSortBy(e.target.value)}
        >
          <MenuItem value="newest">Сначала новые</MenuItem>
          <MenuItem value="name">По названию А-Я</MenuItem>
          <MenuItem value="endDate">По сроку (ближайшие)</MenuItem>
          <MenuItem value="progress">По проценту %</MenuItem>
        </Select>
      </FormControl>
      <Button
        variant="contained"
        startIcon={<AddHomeIcon />}
        onClick={handleOpenAddModal}
        sx={{
          bgcolor: '#4caf50',
          '&:hover': { bgcolor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
          transition: 'all 0.3s ease',
          whiteSpace: 'nowrap',
        }}
      >
        Добавить объект
      </Button>
    </Box>
  )}

  {/* Сортировка на мобилках (всегда под поиском) */}
  {isMobile && (
    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
      <InputLabel id="sort-label-mobile">Сортировка</InputLabel>
      <Select
        labelId="sort-label-mobile"
        value={sortBy}
        label="Сортировка"
        onChange={(e) => setSortBy(e.target.value)}
      >
        <MenuItem value="newest">Сначала новые</MenuItem>
        <MenuItem value="name">По названию А-Я</MenuItem>
        <MenuItem value="endDate">По сроку (ближайшие)</MenuItem>
        <MenuItem value="progress">По проценту %</MenuItem>
      </Select>
    </FormControl>
  )}

  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

   

      {/* Список объектов – красивые карточки */}
      <Stack spacing={isMobile ? 1.5 : 2}>
        {filteredAndSortedObjects.length > 0 ? (
          filteredAndSortedObjects.map(obj => {
            const progress = getProgress(); // позже заменим на реальный процент
            const daysLeft = daysUntil(obj.endDate);
            //const daysColor = getDaysColor(daysLeft);

            return (
<Paper
  key={obj.id}
   onClick={() => {
    //console.log('Клик по объекту:', obj.id, obj.name);
    navigate(`/objects/${obj.id}/projects`);
  }}
  elevation={2}
  sx={{
    p: isMobile ? 1.5 : 3,
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'box-shadow 0.3s, transform 0.3s',
    '&:hover': {
      boxShadow: 6,
      transform: 'scale(1.01)',
    },
  }}
>
                {/* Верхняя строка: иконка, название, процент */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: isMobile ? 0.5 : 1 }}>
                  <PlaceIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {obj.name}
                  </Typography>
                    <IconButton 
    size="small" 
    onClick={(e) => { 
      e.stopPropagation(); 
      handleOpenEdit(obj); 
    }}
    sx={{ mr: 1 }}
  >
    <SettingsIcon fontSize="small" />
  </IconButton>
                  
                  <Chip
                    label={`${progress}%`}
                    size="small"
                    sx={{
                      bgcolor: '#1976d2',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                </Box>

                {/* Адрес */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: isMobile ? 1 : 2 }}>
                  {obj.address}
                </Typography>

                {/* Прогресс-бар */}
<LinearProgress
  variant="determinate"
  value={progress}
  sx={{
    height: 10,
    borderRadius: 5,
    mb: isMobile ? 1.7 : 2,
    bgcolor: '#e0e0e0',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#1976d2',  // синий (как у иконок)
      borderRadius: 5,
    },
  }}
/>

{/* Строка с датами и днями */}
<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <EventIcon fontSize="small" color="action" />
    <Box>
      <Typography variant="body2">
        {formatDate(obj.startDate)} – {formatDate(obj.endDate)}
        {obj.plannedEndDate && obj.plannedEndDate !== obj.endDate && (
          <Typography 
            component="span" 
            variant="body2" 
            sx={{ 
              color: '#ff9800', 
              fontSize: '0.85em',
              ml: 0.5,
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
            }}
          >
            ({formatDate(obj.plannedEndDate)})
          </Typography>
        )}
      </Typography>
    </Box>
  </Box>
  <Chip
    label={daysLeft < 0 ? `Просрочено ${Math.abs(daysLeft)}дн.` : `${daysLeft} дн.`}
    color={getDaysColor(daysLeft)}
    size="small"
    variant="outlined"
    sx={{
      backgroundColor: 
        daysLeft < 0 || daysLeft < 7 ? 'rgba(244, 67, 54, 0.1)' :
        daysLeft < 15 ? 'rgba(255, 152, 0, 0.1)' :
        'rgba(76, 175, 80, 0.1)',
    }}
  />
</Box>
              </Paper>
            );
          })
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Объекты не найдены</Typography>
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
          <AddHomeIcon />
        </Fab>
      )}

      {/* Модалка добавления объекта */}
      <Modal open={addModalOpen} onClose={handleCloseAddModal}>
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
            Добавить новый объект
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название объекта"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Адрес"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              required
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button variant="outlined" onClick={handleCloseAddModal}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleCreateObject}>
                Сохранить
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>
            {/* Модалка редактирования объекта */}
      <Modal open={editModalOpen} onClose={handleCloseEdit}>
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
            Редактировать объект
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название объекта"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Адрес"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              required
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Button 
                variant="outlined" 
                color="error"
                onClick={() => {
    setDeletingObject(editingObject); // запоминаем объект для удаления
    handleCloseEdit(); // закрываем модалку редактирования
    setDeleteConfirmOpen(true);
                }}
              >
                Удалить
              </Button>
              <Box>
                <Button variant="outlined" onClick={handleCloseEdit} sx={{ mr: 1 }}>
                  Отмена
                </Button>
                <Button variant="contained" onClick={handleUpdateObject}>
                  Сохранить
                </Button>
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* Модалка подтверждения удаления */}
      <Modal 
        open={deleteConfirmOpen} 
  onClose={() => {
    setDeleteConfirmOpen(false);
    setDeletingObject(null);
  }}
>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 360 },
            p: 3,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Подтверждение удаления
          </Typography>
          <Typography sx={{ mb: 3 }}>
            Вы уверены, что хотите удалить объект <b>"{deletingObject?.name}"</b>? Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button 
              variant="outlined" 
  onClick={() => {
    setDeleteConfirmOpen(false);
    setDeletingObject(null);
  }}
>
              Отмена
            </Button>
            <Button variant="contained" color="error" onClick={handleDeleteObject}>
              Удалить
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default Objects;