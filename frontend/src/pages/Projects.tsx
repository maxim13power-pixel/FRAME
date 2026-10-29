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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { fetchProjectsByObject, createProject, updateProject, deleteProject } from '../services/projectService';
import { fetchPriceCatalogs, createPriceCatalog } from '../services/priceListService';
import type { PriceCatalogData } from '../services/priceListService';

import type { ProjectData } from '../services/projectService';
import { fetchEstimateTemplates, createEstimateTemplate, applyEstimateTemplate } from '../services/estimateTemplateService';
import type { EstimateTemplate } from '../services/estimateTemplateService';
import { createObjectTemplate } from '../services/objectTemplateService'; // ⭐ №192
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import EditIcon from '@mui/icons-material/Edit';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'; // ⭐ №192
import SortIcon from '@mui/icons-material/Sort';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
// ⭐ №163: напоминание о доступе к новому проекту
import { fetchAccessList, addAccess } from '../services/accessService';
import type { AccessMember } from '../services/accessService';
import ConfirmDialog from '../components/ConfirmDialog';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов
import { updateObjectEndDate } from '../services/objectService';
// ⭐ №178: заявка на право создавать проекты в объекте
import {
  cancelAccessRequest,
  createAccessRequest,
  fetchMyAccessRequests,
} from '../services/accessRequestService';
import type { AccessRequestData } from '../services/accessRequestService';
import { getApiErrorText } from '../utils/errors';
import DeleteIcon from '@mui/icons-material/Delete';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PeopleIcon from '@mui/icons-material/People'; // ⭐ №207: команда объекта из карточки проекта
import { FAB_STYLE } from '../theme';

// ⭐ №158: значение селекта справочника — id, «не выбран» или «создать новый»
type CatalogSelectValue = number | '' | 'new';

const Projects: React.FC = () => {
  const { objectId } = useParams<{ objectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const { notify, success, error: notifyError, confirm } = useFeedback();


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
  // ⭐ №188: меню действий с проектом (шестерёнка на карточке)
  const [actionsProject, setActionsProject] = useState<ProjectData | null>(null);
  // ⭐ №192: сохранение ПРОЕКТА как шаблона объекта
  const [objTplProject, setObjTplProject] = useState<ProjectData | null>(null);
  const [objTplName, setObjTplName] = useState('');
  const [objTplPublic, setObjTplPublic] = useState(false);
  const [objTplSaving, setObjTplSaving] = useState(false);
  // ⭐ №163: после создания проекта предлагаем выдать доступ команде (по умолчанию — только администратор объекта)
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderProject, setReminderProject] = useState<ProjectData | null>(null);
  const [reminderMembers, setReminderMembers] = useState<AccessMember[]>([]);
  const [reminderSelected, setReminderSelected] = useState<number[]>([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'endDate' | 'progress'>('newest');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
  catalogId?: number | null;
} | null>(null);

  // Заметки к проекту
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteProject, setEditingNoteProject] = useState<ProjectData | null>(null);
  const [editNote, setEditNote] = useState('');

  // ⭐ №129: шаблоны смет
  const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [savingTemplateProject, setSavingTemplateProject] = useState<ProjectData | null>(null);
  const [templateName, setTemplateName] = useState('');
  // ⭐ №158: справочник цен проекта
  const [catalogs, setCatalogs] = useState<PriceCatalogData[]>([]);
  const [newCatalogId, setNewCatalogId] = useState<CatalogSelectValue>('');
  const [editCatalogId, setEditCatalogId] = useState<CatalogSelectValue>('');
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogModalTarget, setCatalogModalTarget] = useState<'create' | 'edit'>('create');
  const [newCatalogName, setNewCatalogName] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);

  // ⭐ №178: участник с доступом только к проекту не может создать новый проект —
  // он подаёт заявку, её одобряет админ или менеджер объекта
  const [myAccessRequest, setMyAccessRequest] = useState<AccessRequestData | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestComment, setRequestComment] = useState('');
  const [requestSaving, setRequestSaving] = useState(false);
  // Может ли пользователь создавать проекты в этом объекте.
  // ⭐ №207: серверный флаг — админ объекта всегда может; прораб — если админ
  // выдал право canCreateProjects или одобрил его заявку. Участник одного проекта
  // видит «Запросить право» вместо тупикового 403.
  const canCreateProjects = currentObject?.canCreateProjects === true;

  // ⭐ №158: кому скрыты цены (VIEWER/hidePrices) — блок справочника не показываем
  const hideFinance = currentObject?.hidePrices === true;
  // ⭐ №158: привязанный справочник в архиве — показываем с пометкой (бэкенд архивные не отдаёт)
  const archivedCatalog =
    editingProject?.catalog && !catalogs.some((c) => c.id === editingProject.catalog!.id)
      ? editingProject.catalog
      : null;

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

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter(proj =>
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
        const data = await fetchProjectsByObject(parseInt(objectId));
        setProjects(data);
        setError('');
      } catch (err: unknown) {
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
      const obj = await fetchObjectById(parseInt(objectId));
      setCurrentObject(obj);
    } catch {
      console.error('Не удалось загрузить объект');
    }
  };
  loadObject();
}, [token, objectId]);

// ⭐ №178: есть ли уже отправленная заявка на право создавать проекты
useEffect(() => {
  if (!token || !objectId || !currentObject || canCreateProjects) return;
  fetchMyAccessRequests()
    .then((rows) => {
      const pending = rows.find(
        (r) => r.objectId === parseInt(objectId) && r.status === 'PENDING',
      );
      setMyAccessRequest(pending ?? null);
    })
    .catch(() => setMyAccessRequest(null));
}, [token, objectId, canCreateProjects, currentObject]);

// ⭐ №178: отправить заявку на право создавать проекты
const handleSubmitAccessRequest = async () => {
  if (!objectId) return;
  setRequestSaving(true);
  try {
    const created = await createAccessRequest(parseInt(objectId), {
      comment: requestComment.trim() || undefined,
    });
    setMyAccessRequest(created);
    setRequestModalOpen(false);
    setRequestComment('');
    notify('Заявка отправлена. Админ или менеджер объекта её рассмотрит.', 'success');
  } catch (err) {
    notifyError(getApiErrorText(err, 'Не удалось отправить заявку'));
  } finally {
    setRequestSaving(false);
  }
};

// ⭐ №178: отменить свою заявку
const handleCancelAccessRequest = async () => {
  if (!myAccessRequest) return;
  try {
    await cancelAccessRequest(myAccessRequest.id);
    setMyAccessRequest(null);
    notify('Заявка отменена');
  } catch (err) {
    notifyError(getApiErrorText(err, 'Не удалось отменить заявку'));
  }
};

  // ⭐ №129: загрузить свои шаблоны (для селекта «Из шаблона»)
  const loadTemplates = async () => {
    try {
      setTemplates(await fetchEstimateTemplates());
    } catch {
      // шаблоны не критичны — оставляем пустой список
    }
  };

  // ⭐ Шаблоны грузим сразу при открытии страницы, чтобы список был актуален
  useEffect(() => {
    fetchEstimateTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  // ⭐ №158: справочники цен для привязки к проекту (системные + свои, архивные бэкенд не отдаёт)
  useEffect(() => {
    if (!token) return;
    fetchPriceCatalogs()
      .then(setCatalogs)
      .catch(() => setCatalogs([]));
  }, [token]);

  // ⭐ №129: применить выбранный шаблон после создания проекта
  const applyTemplateIfNeeded = async (projectId: number) => {
    if (!selectedTemplateId) return;
    try {
      const res = await applyEstimateTemplate(selectedTemplateId, projectId);
      if (!res?.created) {
        notify('Шаблон применён, но в нём нет позиций — смета нового проекта пустая.', 'warning');
      }
    } catch (err) {
      // ⭐ Раньше ошибка проглатывалась в console.warn — пользователь видел «не работает» без причины
      notifyError(
        'Проект создан, но шаблон применить не удалось:\n' +
          getApiErrorText(err, 'неизвестная ошибка'),
      );
    }
  };

  // ⭐ №129: сохранить проект как шаблон
  const handleOpenSaveTemplate = (proj: ProjectData) => {
    setSavingTemplateProject(proj);
    setTemplateName('');
    setSaveTemplateModalOpen(true);
  };
  const handleCloseSaveTemplate = () => {
    setSaveTemplateModalOpen(false);
    setSavingTemplateProject(null);
    setTemplateName('');
  };
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !savingTemplateProject) {
      notify('Введите название шаблона', 'warning');
      return;
    }
    try {
      await createEstimateTemplate({
        name: templateName.trim(),
        projectId: savingTemplateProject.id,
      });
      const savedName = templateName.trim();
      // ⭐ Обновляем список сразу — иначе шаблон «пропадает» из вида и кажется, что не сохранился
      await loadTemplates();
      handleCloseSaveTemplate();
      success(
        `Шаблон «${savedName}» сохранён.\n\n` +
          'Выбрать его можно при создании проекта — в поле «Из шаблона».\n' +
          'Шаблоны видны только вам (они личные).',
      );
    } catch (err) {
      notifyError('Ошибка при сохранении шаблона: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

  const handleOpenAddModal = () => {
    setAddModalOpen(true);
    loadTemplates();
  };
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
    setNewCatalogId('');
    setPendingProject(null);
    setSelectedTemplateId('');
  };

  // ⭐ №158: значение селекта «Справочник цен» -> catalogId для API ('' и «создать новый» = не выбран)
  const catalogIdFromSelect = (value: CatalogSelectValue): number | null =>
    typeof value === 'number' ? value : null;

  // ⭐ №158: выбор справочника в модалке проекта
  const handleCatalogSelectChange = async (value: CatalogSelectValue, target: 'create' | 'edit') => {
    if (value === 'new') {
      // ⭐ Название подставляем из имени объекта — прораб обычно так и называет справочник
      setCatalogModalTarget(target);
      setNewCatalogName(currentObject?.name ?? '');
      setCatalogModalOpen(true);
      return;
    }
    // ⭐ Смена справочника у проекта со строками: предупреждаем один раз (цены строк НЕ меняются)
    if (target === 'edit' && editingProject && (editingProject.materialsCount ?? 0) > 0) {
      if (value !== (editingProject.catalogId ?? '')) {
        const ok = await confirm({
          title: 'Сменить справочник цен?',
          text:
            `В смете проекта уже ${editingProject.materialsCount} поз. Их цены НЕ изменятся — ` +
            'цена фиксируется в момент добавления строки. Новый справочник станет основным ' +
            'для новых строк сметы.',
          confirmText: 'Сменить',
        });
        if (!ok) return;
      }
    }
    if (target === 'create') setNewCatalogId(value);
    else setEditCatalogId(value);
  };

  // ⭐ №158: создать справочник прямо из модалки проекта (личный, название — имя объекта)
  const handleCreateCatalogFromProject = async () => {
    const trimmed = newCatalogName.trim();
    if (!trimmed) {
      notify('Введите название справочника', 'warning');
      return;
    }
    setSavingCatalog(true);
    try {
      const created = await createPriceCatalog(trimmed);
      // ⭐ Перезапрашиваем список: в ответе на создание нет счётчиков и признака «системный»
      setCatalogs(await fetchPriceCatalogs());
      if (catalogModalTarget === 'create') setNewCatalogId(created.id);
      else setEditCatalogId(created.id);
      setCatalogModalOpen(false);
      setNewCatalogName('');
      success(`Справочник «${created.name}» создан`);
    } catch (err) {
      notifyError('Не удалось создать справочник: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setSavingCatalog(false);
    }
  };

const handleCreateProject = async () => {
  if (!token || !objectId || !newName || !newStartDate || !newEndDate) {
    notify('Заполните все поля', 'warning');
    return;
  }
  
  // Валидация 1: окончание >= начала
  if (new Date(newEndDate) < new Date(newStartDate)) {
    notify('Дата окончания проекта не может быть раньше даты начала', 'warning');
    return;
  }
  
  // Валидация 2: проверяем конфликт с датой объекта
  if (currentObject && new Date(newEndDate) > new Date(currentObject.endDate)) {
    // Сохраняем данные проекта перед открытием диалога
    setPendingProject({
      name: newName,
      startDate: newStartDate,
      endDate: newEndDate,
      catalogId: catalogIdFromSelect(newCatalogId),
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
    catalogId: catalogIdFromSelect(newCatalogId),
  });
};

const createProjectAction = async (projectData?: {
  name: string;
  startDate: string;
  endDate: string;
  catalogId?: number | null;
}) => {
  // Используем переданные данные или pendingProject
  const data = projectData || pendingProject;
  
  if (!data) {
    notifyError('Нет данных для создания проекта');
    return;
  }
  
  try {
    const created = await createProject({
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      catalogId: data.catalogId ?? null,
      objectId: parseInt(objectId!),
    });
    await applyTemplateIfNeeded(created.id);
    setProjects(prev => [created, ...prev]);
    handleCloseAddModal();
    setPendingProject(null); // очищаем
    // ⭐ №163: сразу предлагаем выдать доступ к новому проекту
    void openAccessReminder(created);
  } catch (err) {
    const text = getApiErrorText(err, 'неизвестная ошибка');
    // ⭐ №179: 403 «нет доступа к объекту» больше не тупик — сразу предлагаем заявку
    if (/нет доступа/i.test(text) && currentObject && currentObject.hasObjectAccess === false) {
      notify('Создавать проекты может участник объекта — отправьте заявку', 'warning');
      setRequestModalOpen(true);
      return;
    }
    // ⭐ №176: раньше текст ошибки терялся («Ошибка при создании проекта» без причины)
    notifyError('Не удалось создать проект: ' + text);
  }
};

// ⭐ №163: напоминание о доступе. Показываем участников объекта, у которых ещё
// нет доступа к новому проекту (объектные записи и участники этого проекта исключены).
// По умолчанию отмечен только администратор объекта — решение владельца 10.1(1).
const openAccessReminder = async (project: ProjectData) => {
  if (!objectId) return;
  // ⭐ №207: список участников и выдачу доступа делает только администратор объекта.
  // Прораб с правом создания проектов создаёт проект, но команду не трогает.
  if (currentObject?.canManage !== true) return;
  setReminderProject(project);
  setReminderOpen(true);
  setReminderLoading(true);
  setReminderMembers([]);
  setReminderSelected([]);
  try {
    const members = await fetchAccessList(parseInt(objectId));
    const candidates = members.filter(
      (m) => m.projectId !== null && m.projectId !== project.id,
    );
    setReminderMembers(candidates);
    setReminderSelected(
      candidates.filter((m) => m.role === 'CUSTOMER').map((m) => m.id),
    );
  } catch {
    // Список не критичен: проект уже создан, просто не показываем чекбоксы
    setReminderMembers([]);
  } finally {
    setReminderLoading(false);
  }
};

const closeAccessReminder = () => {
  setReminderOpen(false);
  setReminderProject(null);
  setReminderMembers([]);
  setReminderSelected([]);
};

const handleReminderSave = async () => {
  if (!objectId || !reminderProject) return;
  const chosen = reminderMembers.filter((m) => reminderSelected.includes(m.id));
  if (chosen.length === 0) {
    closeAccessReminder();
    return;
  }
  setReminderSaving(true);
  try {
    for (const member of chosen) {
      await addAccess(parseInt(objectId), {
        userId: member.userId,
        role: member.role,
        projectId: reminderProject.id,
      });
    }
    success(
      `Доступ к проекту «${reminderProject.name}» выдан: ${chosen.length} ` +
        `${chosen.length === 1 ? 'участнику' : 'участникам'}.`,
    );
    closeAccessReminder();
  } catch (err) {
    notifyError(
      'Проект создан, но доступ выдать не удалось: ' +
        getApiErrorText(err, 'неизвестная ошибка'),
    );
  } finally {
    setReminderSaving(false);
  }
};

// Обработчик подтверждения замены даты объекта
const handleConfirmDateUpdate = async () => {
  //console.log('🔵 handleConfirmDateUpdate started');
  
  if (!token || !currentObject) {
    notifyError('Ошибка: нет данных объекта');
    return;
  }
  
  try {
    //console.log('🟡 Шаг 1: Обновляем дату объекта...');
    
    // 1. Обновляем дату окончания объекта
    await updateObjectEndDate(
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
      const created = await createProject({
        name: pendingProject.name,
        startDate: pendingProject.startDate,
        endDate: pendingProject.endDate,
        catalogId: catalogIdFromSelect(pendingProject.catalogId ?? ''),
        objectId: parseInt(objectId!),
      });
      await applyTemplateIfNeeded(created.id);
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
      
      const updated = await updateProject(Number(editingProject.id), {
        name: editName,
        startDate: editStartDate,
        endDate: editEndDate,
        catalogId: catalogIdFromSelect(editCatalogId),
      });
      console.log('✅ Проект обновлён:', updated);
      
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      handleCloseEdit();
      console.log('✅ Модалка закрыта');
      
    } else {
      console.error('❌ Нет данных для создания/обновления проекта');
      notifyError('Ошибка: нет данных проекта');
    }
    
  } catch (err: unknown) {
    console.error('❌ Ошибка в handleConfirmDateUpdate:', err);
    notifyError('Ошибка: ' + getApiErrorText(err, 'неизвестная ошибка'));
  }
};

  const handleOpenEdit = (proj: ProjectData) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditStartDate(proj.startDate.slice(0, 10));
    setEditEndDate(proj.endDate.slice(0, 10));
    setEditCatalogId(proj.catalogId ?? '');
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditingProject(null);
    setEditCatalogId('');
  };

const handleUpdateProject = async () => {
  if (!token || !editingProject || !editName || !editStartDate || !editEndDate) {
    notify('Заполните все поля', 'warning');
    return;
  }
  
  if (new Date(editEndDate) < new Date(editStartDate)) {
    notify('Дата окончания проекта не может быть раньше даты начала', 'warning');
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
    const updated = await updateProject(Number(editingProject!.id), {
      name: editName,
      startDate: editStartDate,
      endDate: editEndDate,
      catalogId: catalogIdFromSelect(editCatalogId),
    });
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    handleCloseEdit();
  } catch {
    notifyError('Ошибка обновления проекта');
  }
};
// ⭐ №188: меню действий проекта (как на «Объектах»)
const handleOpenActions = (proj: ProjectData) => setActionsProject(proj);
const handleCloseActions = () => setActionsProject(null);
// Писать в проект можно, если есть права записи
// (отозванный доступ проект не получает вовсе — №193)
const canEditProject = (p: ProjectData | null) => !!p && p.canWrite === true;
// ⭐ №204 (A#10): карточка проекта — объектное право. «Гость» проекта смету ведёт,
// но переименовать проект/сменить даты/удалить его не может.
const canEditProjectCard = (p: ProjectData | null) => !!p && p.canEditCard === true;
const canDeleteProjectCard = (p: ProjectData | null) => !!p && p.canDeleteCard === true;

// ⭐ №192: сохранить проект как шаблон объекта (структура + позиции сметы)
const handleOpenObjectTemplate = (p: ProjectData) => {
  setObjTplProject(p);
  setObjTplName(currentObject ? `${currentObject.name} → ${p.name}` : p.name);
  setObjTplPublic(false);
};

const handleCloseObjectTemplate = () => {
  setObjTplProject(null);
  setObjTplName('');
  setObjTplPublic(false);
};

const handleSaveObjectTemplate = async () => {
  if (!objTplProject || !objectId) return;
  setObjTplSaving(true);
  try {
    const saved = await createObjectTemplate({
      objectId: Number(objectId),
      projectId: objTplProject.id,
      name: objTplName.trim() || undefined,
      isPublic: objTplPublic,
    });
    notify(
      `Шаблон «${saved.name}» сохранён: позиций ${saved.projects?.[0]?.materials?.length ?? 0}. ` +
        'Создать из него объект можно в разделе «Объекты» → «Из шаблона».',
    );
    handleCloseObjectTemplate();
  } catch (err: unknown) {
    notifyError(getApiErrorText(err, 'Не удалось сохранить шаблон'));
  } finally {
    setObjTplSaving(false);
  }
};

// Обработчик открытия модалки заметки
const handleOpenNoteModal = (proj: ProjectData) => {
  setEditingNoteProject(proj);
  setEditNote(proj.note || '');
  setNoteModalOpen(true);
};

const handleCloseNoteModal = () => {
  setNoteModalOpen(false);
  setEditingNoteProject(null);
  setEditNote('');
};

const handleSaveNote = async () => {
  if (!token || !editingNoteProject) return;
  try {
    const updated = await updateProject(Number(editingNoteProject.id), {
      note: editNote.trim() !== '' ? editNote.trim() : null,
    });
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    handleCloseNoteModal();
  } catch (err: unknown) {
    notifyError('Ошибка обновления заметки: ' + getApiErrorText(err, 'неизвестная ошибка'));
  }
};


  const handleDeleteProject = async () => {
    if (!token || !deletingProject) return;
    try {
      await deleteProject(Number(deletingProject.id));
      setProjects(prev => prev.filter(p => p.id !== deletingProject.id));
      setDeleteConfirmOpen(false);
      setDeletingProject(null);
    } catch {
      notifyError('Ошибка удаления проекта');
    }
  };
  // ⭐ trailing в useMemo — стабильная ссылка, нет бесконечного цикла (как в Materials)
  const headerTrailing = useMemo(() => isMobile ? (
    <IconButton
      onClick={(e) => setSortAnchorEl(e.currentTarget)}
      sx={{
        bgcolor: sortBy !== 'newest' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
        color: sortBy !== 'newest' ? '#1976d2' : '#424242',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
      }}
    >
      <SortIcon />
    </IconButton>
  ) : undefined, [isMobile, sortBy]);

useMobileHeader({
title: 'Проекты',
editableKey: 'frame_title_projects',
onBack: () => navigate('/objects'),
    searchOpen: mobileSearchOpen,
    searchValue: searchQuery,
    searchPlaceholder: 'Поиск проектов...',
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Заголовок (десктоп) + хлебные крошки — единый блок, как в Сметах */}
            <Box sx={{ mb: { xs: 1, md: 0.5 }, mt: { xs: -2, md: -1.5 } }}> {/* ⭐ на десктопе тоже поднимаем выше */}
        {/* Десктоп: заголовок с кнопкой "назад" */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              onClick={() => navigate('/objects')}
              sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
              aria-label="Назад к объектам"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{ flexGrow: 1 }}>Проекты (виды работ)</Typography>
          </Box>
        )}
        {/* Хлебные крошки (видны и на мобилке, и на десктопе) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: { xs: 0.5, md: 2 }, ml: 0, flexWrap: 'wrap' }}>
          <Typography
            component="button"
            onClick={() => navigate('/objects')}
            sx={{
              background: 'none', border: 'none', padding: 0,
              color: '#1976d2', cursor: 'pointer', fontSize: isMobile ? 13 : 14,
              textDecoration: 'underline',
              '&:hover': { color: '#1565c0' },
            }}
          >
            Объекты
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? 13 : 14 }}>›</Typography>
          <Typography sx={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>
            {currentObject ? currentObject.name : 'Объект'}
          </Typography>
        </Box>
      </Box>

  {/* Меню сортировки (привязано к trailing-кнопке хэдера на мобилке) */}
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

      {/* ⭐ №197: одноразовая подсказка раздела */}
      <SectionIntro id="projects" version={1}>
        <b>Проект</b> — часть объекта со своей сметой. Нажмите на карточку, чтобы открыть материалы;
        шестерёнка ⚙ собирает все действия — серые кнопки недоступны вашей роли.
      </SectionIntro>

      {/* Десктоп: панель поиска, сортировки и кнопки добавления */}
      {!isMobile && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            placeholder="Поиск проектов..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="projects-sort-label">Сортировка</InputLabel>
            <Select
              labelId="projects-sort-label"
              value={sortBy}
              label="Сортировка"
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <MenuItem value="newest">Сначала новые</MenuItem>
              <MenuItem value="name">По названию А-Я</MenuItem>
              <MenuItem value="endDate">По сроку (ближайшие)</MenuItem>
              <MenuItem value="progress">По проценту %</MenuItem>
            </Select>
          </FormControl>
          {/* ⭐ №178: если доступ только к проекту — вместо создания проекта подаём заявку */}
          {!currentObject ? (
            <Button variant="contained" startIcon={<NoteAddIcon />} disabled sx={{ minWidth: '200px' }}>
              Добавить проект
            </Button>
          ) : canCreateProjects ? (
            <Button
              variant="contained"
              startIcon={<NoteAddIcon />}
              onClick={handleOpenAddModal}
              sx={{
                bgcolor: '#4caf50',
                border: '2px solid #388e3c',
                minWidth: '200px',
                '&:hover': { bgcolor: '#388e3c', borderColor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              Добавить проект
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LockOutlinedIcon />}
              onClick={() => setRequestModalOpen(true)}
              sx={{ minWidth: '200px', whiteSpace: 'nowrap' }}
            >
              {myAccessRequest ? 'Заявка отправлена' : 'Запросить право'}
            </Button>
          )}
        </Box>
      )}


  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={isMobile ? 1 : 2}>
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
{/* Верхняя строка: иконка, название (до 2 строк), меню действий */}
<Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
  <DescriptionIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28, mt: 0.25 }} />
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
{proj.name}
</Typography>
{/* ⭐ №188: все действия — в одной кнопке, как на «Объектах» */}
<IconButton
  title="Действия с проектом"
  aria-label="Действия с проектом"
  onClick={(e) => {
    e.stopPropagation();
    handleOpenActions(proj);
  }}
  sx={{ bgcolor: 'action.hover', width: 44, height: 44, ml: 0.5, mt: -0.5 }}
>
  <SettingsIcon />
</IconButton>
</Box>

            {/* ⭐ №188: прогресс-бар + процент в одной строке */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(proj.progressPercent ?? 0, 100)}
                sx={{
                  flexGrow: 1,
                  height: 10,
                  borderRadius: 5,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: (proj.progressPercent ?? 0) >= 100 ? '#4caf50' : '#1976d2',
                    borderRadius: 5,
                  },
                }}
              />
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
      <FormControl fullWidth>
        <InputLabel id="template-select-label">Из шаблона (опционально)</InputLabel>
        <Select
          labelId="template-select-label"
          label="Из шаблона (опционально)"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value as number | '')}
        >
          <MenuItem value="">Без шаблона</MenuItem>
          {templates.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {templates.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Шаблонов пока нет. Сохраните смету любого проекта как шаблон (меню проекта → «Сохранить
          шаблон») — он появится в этом списке.
        </Typography>
      )}
      {!hideFinance && (
        <FormControl fullWidth>
          <InputLabel id="project-catalog-label">Справочник цен</InputLabel>
          <Select
            labelId="project-catalog-label"
            label="Справочник цен"
            value={newCatalogId}
            onChange={(e) => handleCatalogSelectChange(e.target.value as CatalogSelectValue, 'create')}
          >
            <MenuItem value="">
              <em>Как у объекта (наследуется)</em>
            </MenuItem>
            {catalogs.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}{c.isSystem ? ' (демо)' : ''}
                {c.scope === 'object' ? ' (объект)' : ''}
                {c.scope === 'project' ? ' (проект)' : ''}
              </MenuItem>
            ))}
            <MenuItem value="new">➕ Создать новый…</MenuItem>
          </Select>
        </FormControl>
      )}
      {!hideFinance && currentObject?.catalog?.name && (
        <Typography variant="caption" color="text.secondary">
          Справочник объекта: «{currentObject.catalog.name}» — используется, пока у проекта не выбран свой.
        </Typography>
      )}
      {!hideFinance && catalogs.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Справочников пока нет — выберите «Создать новый…», название подставится из имени объекта.
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={handleCloseAddModal}>Отмена</Button>
        <Button variant="contained" onClick={handleCreateProject}>Сохранить</Button>
      </Box>
    </Stack>
  </Paper>
</Modal>
      {/* ⭐ №188: действия с проектом — шит снизу на мобилке, крупные кнопки (как на «Объектах») */}
    <Modal open={!!actionsProject} onClose={handleCloseActions}>
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
          {actionsProject?.name || 'Проект'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Действия с проектом. Серые кнопки недоступны вашей роли.
        </Typography>
        {actionsProject && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              size="small"
              variant="outlined"
              label={
                actionsProject.canWrite === true
                  ? '✍️ можно вносить данные'
                  : '👁 только чтение'
              }
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
          </Box>
        )}

        <Stack spacing={1}>
          <Button
            size="large"
            fullWidth
            variant="contained"
            startIcon={<DescriptionIcon />}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) navigate(`/objects/${objectId}/projects/${p.id}/materials`);
            }}
          >
            Открыть смету
          </Button>

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<SaveAltIcon />}
            disabled={!canEditProject(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) handleOpenSaveTemplate(p);
            }}
          >
            Сохранить шаблон сметы
          </Button>

          {/* ⭐ №192: шаблон проекта (структура + позиции) — создаёт объект из одного проекта */}
          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<BookmarkAddIcon />}
            disabled={!canEditProject(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) handleOpenObjectTemplate(p);
            }}
          >
            Сохранить проект как шаблон
          </Button>

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<EditIcon />}
            disabled={!canEditProjectCard(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) handleOpenEdit(p);
            }}
          >
            Редактировать проект
          </Button>

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<NoteAltIcon />}
            disabled={!canEditProjectCard(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) handleOpenNoteModal(p);
            }}
          >
            Заметка к проекту
          </Button>

          {/* ⭐ №207: команда объекта — из карточки проекта, чтобы не искать её в «Объектах» */}
          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<PeopleIcon />}
            disabled={currentObject?.canManage !== true}
            onClick={() => {
              const objectIdNum = currentObject?.id;
              handleCloseActions();
              if (objectIdNum) {
                navigate('/objects', { state: { openAccessObjectId: objectIdNum } });
              }
            }}
          >
            Участники объекта
          </Button>
          {currentObject?.canManage !== true && (
            <Typography variant="caption" color="text.secondary">
              Командой управляет администратор объекта — откройте «Объекты» → ⚙️ → «Участники».
            </Typography>
          )}

          {!canEditProjectCard(actionsProject) && (
            <Typography variant="caption" color="text.secondary">
              Карточку проекта меняет участник всего объекта с правом записи.
              Участник одного проекта работает в смете, но не в карточке.
            </Typography>
          )}
          {canEditProjectCard(actionsProject) && !canEditProject(actionsProject) && (
            <Typography variant="caption" color="text.secondary">
              Изменения недоступны: нужны права записи (наблюдатель и отозванный доступ — только чтение).
            </Typography>
          )}

          <Button size="large" fullWidth onClick={handleCloseActions} sx={{ mt: 1 }}>
            Закрыть
          </Button>
        </Stack>
      </Paper>
    </Modal>

    {/* ⭐ №192: сохранить проект как шаблон объекта */}
    <Modal open={!!objTplProject} onClose={handleCloseObjectTemplate}>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '94%', sm: 440 },
          p: 3,
          borderRadius: 3,
          outline: 'none',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Сохранить как шаблон
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Проект «{objTplProject?.name}» сохранится как шаблон: название и позиции сметы
          (цены — снимком на дату). Создать из него объект можно в «Объектах» → «Из шаблона».
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="Название шаблона"
          value={objTplName}
          onChange={(e) => setObjTplName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={objTplPublic}
              onChange={(e) => setObjTplPublic(e.target.checked)}
            />
          }
          label="Общий шаблон (виден другим пользователям)"
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={handleCloseObjectTemplate}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveObjectTemplate()}
            disabled={objTplSaving}
          >
            {objTplSaving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Box>
      </Paper>
    </Modal>

    {/* Модалка сохранения шаблона (№129) */}
<Modal open={saveTemplateModalOpen} onClose={handleCloseSaveTemplate} disableRestoreFocus={true}>
  <Paper sx={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '90%', sm: 450 },
    p: 4,
    borderRadius: 2,
  }}>
    <Typography variant="h6" gutterBottom>Сохранить шаблон</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Проект «{savingTemplateProject?.name}» будет сохранён как шаблон сметы.
    </Typography>
    <Stack spacing={2}>
      <TextField
        fullWidth
        label="Название шаблона"
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        autoFocus
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={handleCloseSaveTemplate}>Отмена</Button>
        <Button variant="contained" onClick={handleSaveTemplate}>Сохранить</Button>
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
            {!hideFinance && (
              <FormControl fullWidth>
                <InputLabel id="project-edit-catalog-label">Справочник цен</InputLabel>
                <Select
                  labelId="project-edit-catalog-label"
                  label="Справочник цен"
                  value={editCatalogId}
                  onChange={(e) => handleCatalogSelectChange(e.target.value as CatalogSelectValue, 'edit')}
                >
                <MenuItem value="">
                  <em>Как у объекта (наследуется)</em>
                </MenuItem>
                {catalogs.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}{c.isSystem ? ' (демо)' : ''}
                    {c.scope === 'object' ? ' (объект)' : ''}
                    {c.scope === 'project' ? ' (проект)' : ''}
                  </MenuItem>
                ))}
                  {archivedCatalog && (
                    <MenuItem value={archivedCatalog.id}>
                      {archivedCatalog.name} (в архиве)
                    </MenuItem>
                  )}
                  <MenuItem value="new">➕ Создать новый…</MenuItem>
                </Select>
              </FormControl>
            )}

            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={handleCloseEdit}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleUpdateProject}>
                Сохранить
              </Button>
              <IconButton
                color="error"
                aria-label="Удалить проект"
                // ⭐ №204 (A#10): удаление карточки — право администратора объекта
                disabled={!canDeleteProjectCard(editingProject)}
                onClick={() => {
                  setDeletingProject(editingProject);
                  handleCloseEdit();
                  setDeleteConfirmOpen(true);
                }}
                sx={{
                  border: '1px solid rgba(211, 47, 47, 0.35)',
                  bgcolor: 'rgba(211, 47, 47, 0.06)',
                  '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.12)' },
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>
      </Modal>
      {/* Модалка создания справочника цен из проекта (№158) */}
      <Modal open={catalogModalOpen} onClose={() => setCatalogModalOpen(false)} disableRestoreFocus={true}>
        <Paper sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 420 },
          p: 4,
          borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Новый справочник цен</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Название подставлено из имени объекта — можно изменить. Справочник личный: его видите только вы.
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название справочника"
              value={newCatalogName}
              onChange={e => setNewCatalogName(e.target.value)}
              autoFocus
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={() => setCatalogModalOpen(false)} disabled={savingCatalog}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleCreateCatalogFromProject} disabled={savingCatalog}>
                Создать
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ №178: заявка на право создавать проекты в объекте */}
      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 460 },
            p: 3,
            borderRadius: 3,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            🔓 Право создавать проекты
          </Typography>
          {myAccessRequest ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Заявка отправлена {new Date(myAccessRequest.createdAt).toLocaleString('ru-RU')} и
                ждёт решения админа или менеджера объекта
                {myAccessRequest.object?.name ? ` «${myAccessRequest.object.name}»` : ''}.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Как только заявку одобрят, у вас появится доступ ко всему объекту и кнопка
                «Добавить проект».
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Button variant="text" color="error" onClick={() => void handleCancelAccessRequest()}>
                  Отменить заявку
                </Button>
                <Button variant="outlined" onClick={() => setRequestModalOpen(false)}>
                  Закрыть
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                У вас доступ только к проекту этого объекта. Создавать новые проекты может
                участник объекта — отправьте заявку, её рассмотрит админ или менеджер объекта.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Комментарий (необязательно)"
                placeholder="Например: нужно добавить проект по ЭОМ"
                value={requestComment}
                onChange={(e) => setRequestComment(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Одобрение откроет вам доступ ко всему объекту (роль «Прораб» с управлением
                командой) — иначе созданный проект был бы виден только частично.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button variant="outlined" onClick={() => setRequestModalOpen(false)}>
                  Отмена
                </Button>
                <Button
                  variant="contained"
                  disabled={requestSaving}
                  onClick={() => void handleSubmitAccessRequest()}
                >
                  Отправить заявку
                </Button>
              </Box>
            </>
          )}
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
      {/* Модалка заметки проекта */}
      <Modal open={noteModalOpen} onClose={handleCloseNoteModal} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 450 },
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Заметка к проекту "{editingNoteProject?.name}"
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Заметка"
              placeholder="Напишите заметку к проекту..."
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              inputProps={{ maxLength: 1000 }}
              helperText={`${editNote.length}/1000`}
              FormHelperTextProps={{ sx: { textAlign: 'right' } }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={handleCloseNoteModal}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleSaveNote}>
                Сохранить
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Modal>

      {/* ⭐ №163: напоминание выдать доступ к новому проекту */}
      <Modal open={reminderOpen} onClose={() => !reminderSaving && closeAccessReminder()} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', sm: 480 },
            maxHeight: '85vh',
            overflowY: 'auto',
            p: 3,
            borderRadius: 3,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            👥 Кому открыть проект?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Проект «{reminderProject?.name}» создан. Отметьте, кто из команды объекта
            должен его видеть. По умолчанию отмечен только администратор объекта — остальных
            можно добавить позже в карточке объекта.
          </Typography>

          {reminderLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : reminderMembers.length === 0 ? (
            <Alert severity="info">
              В команде объекта нет участников с доступом к отдельным проектам.
              Объектные участники видят новые проекты автоматически.
            </Alert>
          ) : (
            <Stack spacing={0.5}>
              {reminderMembers.map((member) => (
                <FormControlLabel
                  key={member.id}
                  control={
                    <Checkbox
                      checked={reminderSelected.includes(member.id)}
                      onChange={(e) =>
                        setReminderSelected((prev) =>
                          e.target.checked
                            ? [...prev, member.id]
                            : prev.filter((id) => id !== member.id),
                        )
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        {member.user.fullName || member.user.email || member.user.phone || 'Без имени'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.role === 'CUSTOMER'
                          ? '👑 Администратор объекта'
                          : member.role === 'FOREMAN'
                            ? '👷 Прораб'
                            : '👁 Наблюдатель'}
                        {member.projectId ? ' • доступ к другому проекту' : ''}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={closeAccessReminder} disabled={reminderSaving}>
              Позже
            </Button>
            <Button
              variant="contained"
              onClick={handleReminderSave}
              disabled={reminderSaving || reminderLoading || reminderMembers.length === 0}
            >
              Выдать доступ
            </Button>
          </Box>
        </Paper>
      </Modal>

      {isMobile && (
        <Fab
          color="primary"
          sx={{ ...FAB_STYLE, bottom: 80 }}
          onClick={handleOpenAddModal}
        >
          <NoteAddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default Projects;