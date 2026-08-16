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
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
//import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchMaterialsByProject,
  createMaterial,
  addFix,
  updateSpecQuantity,
  toggleSpecLock,
  deleteMaterial,
} from '../services/materialService';
import type { MaterialData } from '../services/materialService';
import { fetchProjectById } from '../services/materialService';
import type { ProjectData } from '../services/projectService';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';

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
  

  // Модалка добавления материала
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArticle, setNewArticle] = useState('');
  const [newUnit, setNewUnit] = useState('PIECE');
  //const [newSpecQuantity, setNewSpecQuantity] = useState<number>(0);
  const [newSpecQuantity, setNewSpecQuantity] = useState('');
  const [newNote, setNewNote] = useState('');

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

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.article?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Итоговая строка: суммы по спеке и факту, средний прогресс
  const totals = {
    sumSpecQuantity: filteredMaterials.reduce((acc, m) => acc + (Number(m.specQuantity) || 0), 0),
    sumTotalUsed: filteredMaterials.reduce((acc, m) => acc + (Number(m.totalUsed) || 0), 0),
    avgProgressPercent: filteredMaterials.length > 0
      ? Math.round(filteredMaterials.reduce((acc, m) => acc + (Number(m.progressPercent) || 0), 0) / filteredMaterials.length)
      : 0,
  };
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
  };
    //setNewSpecQuantity(0);
    //setNewNote('');
  //};

  //const handleCreateMaterial = async () => {
    //if (!token || !projectId || !newName || !newSpecQuantity) {
      //alert('Заполните наименование и количество по спецификации');
      //return;
    //}
    //try {
      //const created = await createMaterial(token, {
        //name: newName,
        //article: newArticle || undefined,
        //unit: newUnit,
        //specQuantity: newSpecQuantity,
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
            Материалы и работы
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Поиск и кнопка добавления */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 2 }}>
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

      {/* Таблица для десктопа */}
      {!isMobile && (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>№</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Наименование</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Артикул</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ед.</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>По спец</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Итого</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Посл. фикс</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>%</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMaterials.map((m, idx) => (
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
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
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
                <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{totals.avgProgressPercent}%</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}

      {/* Карточки для мобилки */}
      {isMobile && (
        <Stack spacing={2}>
          {filteredMaterials.length > 0 ? (
            filteredMaterials.map((m) => (
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">По спец:</Typography>
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