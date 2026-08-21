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
  Modal,
  TextField,
  Fab,
  useMediaQuery,
  useTheme,
  InputAdornment,
  Chip,
  LinearProgress,
  Menu,
  MenuItem, 
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { fetchProjectsByObject, createProject, updateProject, deleteProject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import ConfirmDialog from '../components/ConfirmDialog';
import { updateObjectEndDate } from '../services/objectService';

const Projects: React.FC = () => {
  const { objectId } = useParams<{ objectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();


// ... внутри компонента:
const [currentObject, setCurrentObject] = useState<ObjectData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectData | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'endDate' | 'progress'>('newest');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [dateConflictDialog, setDateConflictDialog] = useState<{
    open: boolean;
    projectEndDate: string;
    objectEndDate: string;
  }>({
    open: false,
    projectEndDate: '',
    objectEndDate: '',
  });
  const [pendingProject, setPendingProject] = useState<{
  name: string;
  startDate: string;
  endDate: string;
} | null>(null);
  
  // Временная функция для процента (позже заменим на реальную)
  //const getProgress = () => Math.floor(Math.random() * 60) + 20;
  
  // Функция для расчёта дней до окончания
  const daysUntil = (endDateStr: string) => {
    const today = new Date();
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  // Цвет чипа в зависимости от дней
  const getDaysColor = (days: number) => {
    if (days < 0) return 'error';
    if (days < 7) return 'error';
    if (days < 15) return 'warning';
    return 'success';
  };

  const handleSearchOpen = () => {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };
  const handleSearchClose = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects.filter(proj =>
      proj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'endDate':
        filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
        break;
      case 'progress':
        // пока прогресс случайный — сортируем по endDate как запасной вариант
        filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
    }
    return filtered;
  }, [projects, searchQuery, sortBy]);


  useEffect(() => {
    if (!token || !objectId) return;
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchProjectsByObject(token, parseInt(objectId));
        setProjects(data);
        setError('');
      } catch (err: any) {
        setError('Ошибка загрузки проектов');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [token, objectId]);
// Загружаем данные объекта для валидации дат
useEffect(() => {
  if (!token || !objectId) return;
  const loadObject = async () => {
    try {
      const obj = await fetchObjectById(token, parseInt(objectId));
      setCurrentObject(obj);
    } catch (err) {
      console.error('Не удалось загрузить объект');
    }
  };
  loadObject();
}, [token, objectId]);

  const handleOpenAddModal = () => setAddModalOpen(true);
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
    setPendingProject(null);
  };

const handleCreateProject = async () => {
  if (!token || !objectId || !newName || !newStartDate || !newEndDate) {
    alert('Заполните все поля');
    return;
  }
  
  // Валидация 1: окончание >= начала
  if (new Date(newEndDate) < new Date(newStartDate)) {
    alert('❌ Дата окончания проекта не может быть раньше даты начала!');
    return;
  }
  
  // Валидация 2: проверяем конфликт с датой объекта
  if (currentObject && new Date(newEndDate) > new Date(currentObject.endDate)) {
    // Сохраняем данные проекта перед открытием диалога
    setPendingProject({
      name: newName,
      startDate: newStartDate,
      endDate: newEndDate,
    });
    
    // Открываем красивое модальное окно
    setDateConflictDialog({
      open: true,
      projectEndDate: newEndDate,
      objectEndDate: currentObject.endDate,
    });
    return;
  }
  
  // Если конфликтов нет - создаём проект
  await createProjectAction({
    name: newName,
    startDate: newStartDate,
    endDate: newEndDate,
  });
};

const createProjectAction = async (projectData?: {
  name: string;
  startDate: string;
  endDate: string;
}) => {
  // Используем переданные данные или pendingProject
  const data = projectData || pendingProject;
  
  if (!data) {
    alert('Нет данных для создания проекта');
    return;
  }
  
  try {
    const created = await createProject(token!, {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      objectId: parseInt(objectId!),
    });
    setProjects(prev => [created, ...prev]);
    handleCloseAddModal();
    setPendingProject(null); // очищаем
  } catch (err: any) {
    alert('Ошибка при создании проекта');
  }
};

// Обработчик подтверждения замены даты объекта
const handleConfirmDateUpdate = async () => {
  //console.log('🔵 handleConfirmDateUpdate started');
  
  if (!token || !currentObject) {
    alert('Ошибка: нет данных объекта');
    return;
  }
  
  try {
    //console.log('🟡 Шаг 1: Обновляем дату объекта...');
    
    // 1. Обновляем дату окончания объекта
    await updateObjectEndDate(
      token, 
      currentObject.id, 
      dateConflictDialog.projectEndDate
    );
    //console.log('✅ Дата объекта обновлена');
    
    // 2. Обновляем локальное состояние объекта
    setCurrentObject(prev => prev ? {
      ...prev,
      endDate: dateConflictDialog.projectEndDate,
    } : null);
    
    // 3. Закрываем диалог
    setDateConflictDialog(prev => ({ ...prev, open: false }));
    
    // 4. Определяем что делать дальше
    if (pendingProject) {
      // ====== СОЗДАНИЕ НОВОГО ПРОЕКТА ======
      //console.log('🟢 Шаг 2: Создаём новый проект...');
      const created = await createProject(token, {
        name: pendingProject.name,
        startDate: pendingProject.startDate,
        endDate: pendingProject.endDate,
        objectId: parseInt(objectId!),
      });
      setProjects(prev => [created, ...prev]);
      handleCloseAddModal();
      setPendingProject(null);
      //console.log('✅ Проект создан!');
      
    } else if (editingProject) {
      // ====== ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО ПРОЕКТА ======
      console.log('🟢 Шаг 2: Обновляем проект...');
      console.log('editingProject.id:', editingProject.id);
      console.log('editName:', editName);
      console.log('editStartDate:', editStartDate);
      console.log('editEndDate:', editEndDate);
      
      const updated = await updateProject(token, Number(editingProject.id), {
        name: editName,
        startDate: editStartDate,
        endDate: editEndDate,
      });
      console.log('✅ Проект обновлён:', updated);
      
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      handleCloseEdit();
      console.log('✅ Модалка закрыта');
      
    } else {
      console.error('❌ Нет данных для создания/обновления проекта');
      alert('Ошибка: нет данных проекта');
    }
    
  } catch (err: any) {
    console.error('❌ Ошибка в handleConfirmDateUpdate:', err);
    alert('Ошибка: ' + (err.response?.data?.message || err.message));
  }
};

  const handleOpenEdit = (proj: ProjectData) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditStartDate(proj.startDate.slice(0, 10));
    setEditEndDate(proj.endDate.slice(0, 10));
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditingProject(null);
  };

const handleUpdateProject = async () => {
  if (!token || !editingProject || !editName || !editStartDate || !editEndDate) {
    alert('Заполните все поля');
    return;
  }
  
  if (new Date(editEndDate) < new Date(editStartDate)) {
    alert('❌ Дата окончания проекта не может быть раньше даты начала!');
    return;
  }

  if (currentObject && new Date(editEndDate) > new Date(currentObject.endDate)) {
    // Очищаем pendingProject (чтобы не было путаницы с созданием)
    setPendingProject(null);
    
    // Открываем диалог
    setDateConflictDialog({
      open: true,
      projectEndDate: editEndDate,
      objectEndDate: currentObject.endDate,
    });
    return;
}
  
  await updateProjectAction();
};

const updateProjectAction = async () => {
  try {
    const updated = await updateProject(token!, Number(editingProject!.id), {
      name: editName,
      startDate: editStartDate,
      endDate: editEndDate,
    });
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    handleCloseEdit();
  } catch (err) {
    alert('Ошибка обновления проекта');
  }
};


  const handleDeleteProject = async () => {
    if (!token || !deletingProject) return;
    try {
      await deleteProject(token, Number(deletingProject.id));
      setProjects(prev => prev.filter(p => p.id !== deletingProject.id));
      setDeleteConfirmOpen(false);
      setDeletingProject(null);
    } catch (err) {
      alert('Ошибка удаления проекта');
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
<Box>
  {/* Хлебные крошки: Объекты › [объект] */}
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
    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
      {currentObject ? currentObject.name : 'Объект'}
    </Typography>
  </Box>

  {/* Мобильная компактная строка: заголовок + иконки */}
  {isMobile && (
    <>
      {showSearch ? (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
          <IconButton onClick={() => navigate('/objects')} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }}>
            <ArrowBackIcon />
          </IconButton>
          <TextField
            inputRef={searchInputRef}
            placeholder="Поиск проектов..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleSearchClose}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, minHeight: 48 }}>
          <IconButton
            onClick={() => navigate('/objects')}
            sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>Проекты (виды работ)</Typography>
          <IconButton
            onClick={handleSearchOpen}
            sx={{ bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
          >
            <SearchIcon />
          </IconButton>
          <IconButton
            onClick={(e) => setSortAnchorEl(e.currentTarget)}
            sx={{
              ml: 0.5,
              bgcolor: sortBy !== 'newest' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
              color: sortBy !== 'newest' ? '#1976d2' : 'inherit',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' },
            }}
          >
            <SortIcon />
          </IconButton>
        </Box>
      )}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
      >
        <MenuItem onClick={() => { setSortBy('newest'); setSortAnchorEl(null); }}>Сначала новые</MenuItem>
        <MenuItem onClick={() => { setSortBy('name'); setSortAnchorEl(null); }}>По названию А-Я</MenuItem>
        <MenuItem onClick={() => { setSortBy('endDate'); setSortAnchorEl(null); }}>По сроку (ближайшие)</MenuItem>
        <MenuItem onClick={() => { setSortBy('progress'); setSortAnchorEl(null); }}>По проценту %</MenuItem>
      </Menu>
    </>
  )}

  {/* Десктоп: большая строка с поиском и кнопкой добавления */}
  {!isMobile && (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/objects')} sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Проекты (виды работ)</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Поиск проектов..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        <Button
          variant="contained"
          startIcon={<NoteAddIcon />}
          onClick={handleOpenAddModal}
          sx={{
            bgcolor: '#4caf50',
            minWidth: '200px',
            '&:hover': { bgcolor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Добавить проект
        </Button>
      </Box>
    </>
  )}

  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2}>
{filteredAndSortedProjects.length > 0 ? (
  filteredAndSortedProjects.map(proj => (
<Paper 
  key={proj.id} 
  onClick={() => {
    console.log('Переход в материалы проекта:', proj.id);
    navigate(`/objects/${objectId}/projects/${proj.id}/materials`);
  }}
  sx={{
    p: isMobile ? 1.5 : 2,
    borderRadius: 2,
    cursor: 'pointer',
    transition: 'box-shadow 0.3s, transform 0.3s',
    '&:hover': {
      boxShadow: 6,
      transform: 'scale(1.01)',
    },
  }}
>
{/* Верхняя строка: иконка, название, шестерёнка, процент */}
<Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
  <DescriptionIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28 }} />
  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
    {proj.name}
  </Typography>
<IconButton 
  size="small" 
  onClick={(e) => { 
    e.stopPropagation(); 
    handleOpenEdit(proj); 
  }}
  sx={{ mr: 1 }}
>
  <SettingsIcon fontSize="small" />
</IconButton>
  <Chip
    label={`${proj.progressPercent ?? 0}%`}
    size="small"
    sx={{
      bgcolor: (proj.progressPercent ?? 0) >= 100 ? '#4caf50' : '#1976d2',
      color: 'white',
      fontWeight: 'bold',
    }}
  />
</Box>

            {/* Прогресс-бар */}
            <LinearProgress
              variant="determinate"
              value={Math.min(proj.progressPercent ?? 0, 100)}
              sx={{
                height: 10,
                borderRadius: 5,
                mb: 2,
                bgcolor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: (proj.progressPercent ?? 0) >= 100 ? '#4caf50' : '#1976d2',
                  borderRadius: 5,
                },
              }}
            />

{/* Строка с датами и днями */}
<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <EventIcon fontSize="small" color="action" />
    <Typography variant="body2">
      {new Date(proj.startDate).toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit' 
      })} – {new Date(proj.endDate).toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit' 
      })}
    </Typography>
  </Box>
  <Chip
    label={daysUntil(proj.endDate) < 0 
      ? `Просрочено ${Math.abs(daysUntil(proj.endDate))}дн.` 
      : `${daysUntil(proj.endDate)} дн.`}
    color={getDaysColor(daysUntil(proj.endDate))}
    size="small"
    variant="outlined"
    sx={{
      backgroundColor: 
        daysUntil(proj.endDate) < 0 || daysUntil(proj.endDate) < 7 
          ? 'rgba(244, 67, 54, 0.1)' 
          : daysUntil(proj.endDate) < 15 
            ? 'rgba(255, 152, 0, 0.1)' 
            : 'rgba(76, 175, 80, 0.1)',
    }}
  />
</Box>
          </Paper>
  ))
) : (
  <Paper sx={{ p: 3, textAlign: 'center' }}>
    <Typography>
      {projects.length === 0 ? 'Нет проектов. Создайте первый проект.' : 'Ничего не найдено'}
    </Typography>
  </Paper>
)}
      </Stack>

      {/* Модалка добавления проекта */}
<Modal open={addModalOpen} onClose={handleCloseAddModal} disableRestoreFocus={true} >
  <Paper sx={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '90%', sm: 450 },
    p: 4,
    borderRadius: 2,
  }}>
    <Typography variant="h6" gutterBottom>Добавить проект</Typography>
    
    {/* ↓↓↓ БЛОК С ГРАНИЦАМИ ОБЪЕКТА ↓↓↓ */}
    {currentObject && (
      <Box sx={{
        mb: 3,
        p: 2,
        bgcolor: 'rgba(25, 118, 210, 0.08)',
        borderRadius: 2,
        border: '1px solid rgba(25, 118, 210, 0.3)',
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
          📅 Сроки работ по объекту "{currentObject.name}":
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<EventIcon />}
            label={`Начало: ${new Date(currentObject.startDate).toLocaleDateString('ru-RU')}`}
            size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
          />
          <Chip
            icon={<EventIcon />}
            label={`Окончание: ${new Date(currentObject.endDate).toLocaleDateString('ru-RU')}`}
            size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
          />
        </Box>
      </Box>
    )}
    {/* ↑↑↑ КОНЕЦ БЛОКА ↑↑↑ */}
    
    <Stack spacing={2}>
      <TextField
        fullWidth
        label="Название"
        value={newName}
        onChange={e => setNewName(e.target.value)}
        required
      />
      <TextField
        fullWidth
        label="Дата начала"
        type="date"
        InputLabelProps={{ shrink: true }}
        value={newStartDate}
        onChange={e => setNewStartDate(e.target.value)}
        required
        inputProps={{
          min: currentObject ? currentObject.startDate.slice(0, 10) : undefined,
                  }}
      />
      <TextField
        fullWidth
        label="Дата окончания"
        type="date"
        InputLabelProps={{ shrink: true }}
        value={newEndDate}
        onChange={e => setNewEndDate(e.target.value)}
        required
        inputProps={{
          min: newStartDate || (currentObject ? currentObject.startDate.slice(0, 10) : undefined),
                  }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={handleCloseAddModal}>Отмена</Button>
        <Button variant="contained" onClick={handleCreateProject}>Сохранить</Button>
      </Box>
    </Stack>
  </Paper>
</Modal>
      {/* Модалка редактирования проекта */}
      <Modal open={editModalOpen} onClose={handleCloseEdit} disableRestoreFocus={true}>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Редактировать проект</Typography>

    {/* ↓↓↓ БЛОК С ГРАНИЦАМИ ОБЪЕКТА ↓↓↓ */}
    {currentObject && (
      <Box sx={{
        mb: 3,
        p: 2,
        bgcolor: 'rgba(25, 118, 210, 0.08)',
        borderRadius: 2,
        border: '1px solid rgba(25, 118, 210, 0.3)',
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
          📅 Сроки работ по объекту "{currentObject.name}":
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<EventIcon />}
            label={`Начало: ${new Date(currentObject.startDate).toLocaleDateString('ru-RU')}`}
            size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
          />
          <Chip
            icon={<EventIcon />}
            label={`Окончание: ${new Date(currentObject.endDate).toLocaleDateString('ru-RU')}`}
            size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
          />
        </Box>
      </Box>
    )}
    {/* ↑↑↑ КОНЕЦ БЛОКА ↑↑↑ */}          
          
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Дата начала"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editStartDate}
              onChange={e => setEditStartDate(e.target.value)}
              required
              inputProps={{
                min: currentObject ? currentObject.startDate.slice(0, 10) : undefined,
              }}
            />
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editEndDate}
              onChange={e => setEditEndDate(e.target.value)}
              required
              inputProps={{
                min: editStartDate || (currentObject ? currentObject.startDate.slice(0, 10) : undefined),
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  setDeletingProject(editingProject);
                  handleCloseEdit();
                  setDeleteConfirmOpen(true);
                }}
              >
                Удалить
              </Button>
              <Box>
                <Button variant="outlined" onClick={handleCloseEdit} sx={{ mr: 1 }}>
                  Отмена
                </Button>
                <Button variant="contained" onClick={handleUpdateProject}>
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
          setDeletingProject(null);
        }}
        disableRestoreFocus={true}
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
            Вы уверены, что хотите удалить проект <b>"{deletingProject?.name}"</b>? Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeletingProject(null);
              }}
            >
              Отмена
            </Button>
            <Button variant="contained" color="error" onClick={handleDeleteProject}>
              Удалить
            </Button>
          </Box>
        </Paper>
      </Modal>

      <ConfirmDialog
        open={dateConflictDialog.open}
        title="Конфликт дат"
        message="Дата окончания проекта позже даты окончания объекта. Хотите автоматически продлить срок объекта?"
        details={{
          currentDate: new Date(dateConflictDialog.objectEndDate).toLocaleDateString('ru-RU'),
          proposedDate: new Date(dateConflictDialog.projectEndDate).toLocaleDateString('ru-RU'),
        }}
        onConfirm={handleConfirmDateUpdate}
        onCancel={() => setDateConflictDialog(prev => ({ ...prev, open: false }))}
        confirmText="Да, продлить объект"
        cancelText="Отмена"
      />

      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16 }}
          onClick={handleOpenAddModal}
        >
          <NoteAddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default Projects;