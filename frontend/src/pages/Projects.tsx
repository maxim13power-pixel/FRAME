import React, { useState, useEffect } from 'react';
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
  Chip,              // ← добавить
  LinearProgress,  
} from '@mui/material';
//import AddIcon from '@mui/icons-material/Add';//
import { useAuth } from '../contexts/AuthContext';
import { fetchProjectsByObject, createProject, updateProject, deleteProject } from '../services/projectService';
import type { ProjectData } from '../services/projectService';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';  // ← листочек 📄
import EventIcon from '@mui/icons-material/Event';  

const Projects: React.FC = () => {
  const { objectId } = useParams<{ objectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();

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
  // ↓↓↓ ВСТАВИТЬ СЮДА ↓↓↓
  
  // Временная функция для процента (позже заменим на реальную)
  const getProgress = () => Math.floor(Math.random() * 60) + 20;
  
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
  
  // ↑↑↑ ДО СЮДА ↑↑↑  
  const filteredProjects = projects.filter(proj =>
  proj.name.toLowerCase().includes(searchQuery.toLowerCase())
);

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

  const handleOpenAddModal = () => setAddModalOpen(true);
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
  };

  const handleCreateProject = async () => {
    if (!token || !objectId || !newName || !newStartDate || !newEndDate) {
      alert('Заполните все поля');
      return;
    }
    try {
      const created = await createProject(token, {
        name: newName,
        startDate: newStartDate,
        endDate: newEndDate,
        objectId: parseInt(objectId),
      });
      setProjects(prev => [created, ...prev]);
      handleCloseAddModal();
    } catch (err: any) {
      alert('Ошибка при создании проекта');
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
    try {
      const updated = await updateProject(token, Number(editingProject.id), {
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
  {/* Верхняя строка с кнопкой назад, заголовком и кнопкой добавления (для десктопа) */}
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
    <IconButton onClick={() => navigate('/objects')} sx={{ mr: 1,
    bgcolor: 'rgba(0, 0, 0, 0.06)', // светло-серый фон всегда
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}>
      <ArrowBackIcon />
    </IconButton>
    <Typography variant={isMobile ? "h5" : "h4"} 
    sx={{ flexGrow: 1 }}>
      Проекты (виды работ)
    </Typography>

  </Box>

  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

{/* Поиск проекта */}
{/* Блок поиска и кнопки добавления (для десктопа) */}
<Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 2 }}>
  <TextField
    placeholder="Поиск проектов..."
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
  {!isMobile && (
    <Button
      variant="contained"
      startIcon={<NoteAddIcon />}
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
      Добавить проект
    </Button>
  )}
</Box>
      <Stack spacing={2}>
{filteredProjects.length > 0 ? (
  filteredProjects.map(proj => (
          <Paper key={proj.id} sx={{
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
    label={`${getProgress()}%`}
    size="small"
    sx={{
      bgcolor: '#1976d2',
      color: 'white',
      fontWeight: 'bold',
    }}
  />
</Box>

            {/* Прогресс-бар */}
            <LinearProgress
              variant="determinate"
              value={getProgress()}
              sx={{
                height: 10,
                borderRadius: 5,
                mb: 2,
                bgcolor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#1976d2',
                  borderRadius: 5,
                },
              }}
            />

            {/* Строка с датами и днями */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {new Date(proj.startDate).toLocaleDateString('ru-RU')} – {new Date(proj.endDate).toLocaleDateString('ru-RU')}
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
      <Modal open={addModalOpen} onClose={handleCloseAddModal}>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Добавить проект</Typography>
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
            />
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={newEndDate}
              onChange={e => setNewEndDate(e.target.value)}
              required
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseAddModal}>Отмена</Button>
              <Button variant="contained" onClick={handleCreateProject}>Сохранить</Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>
      {/* Модалка редактирования проекта */}
      <Modal open={editModalOpen} onClose={handleCloseEdit}>
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
            />
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editEndDate}
              onChange={e => setEditEndDate(e.target.value)}
              required
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