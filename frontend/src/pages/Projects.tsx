import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
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
import { fetchProjectsByObject, createProject, updateProject, setProjectHidden, deleteProject, fetchAvailableProjects, copyEstimateFromProject, copyProject } from '../services/projectService';
import { fetchPriceCatalogs } from '../services/priceListService';
import type { PriceCatalogData } from '../services/priceListService';

import type { ProjectData, AvailableProject } from '../services/projectService';
import { fetchEstimateTemplates, createEstimateTemplate, applyEstimateTemplate, deleteEstimateTemplate } from '../services/estimateTemplateService';
import type { EstimateTemplate } from '../services/estimateTemplateService';
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
import SortIcon from '@mui/icons-material/Sort';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { fetchObjectById } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { safeGetString } from '../utils/storage'; // ⭐ №235: кастомный заголовок раздела

// ⭐ №235: переименование заголовка «Проекты» — тот же ключ, что у мобильной шапки
const PROJECTS_TITLE_KEY = 'frame_title_projects';
const PROJECTS_TITLE_DEFAULT = 'Проекты (виды работ)';
const TITLE_CHANGED_EVENT = 'frame:title-changed';
// ⭐ №163: напоминание о доступе к новому проекту
import { fetchAccessList, addAccess } from '../services/accessService';
import type { AccessMember, AccessRole } from '../services/accessService';
// ⭐ №305: свежие данные при возврате в окно (без F5)
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

/**
 * ⭐ №305: человек в модалке «Кому открыть проект?».
 * Раньше строка шла на каждую ВЫДАЧУ доступа: прораб с доступом к четырём
 * проектам выглядел как «Петька • Прораб • доступ к другому проекту» ×4.
 * Теперь строка одна на человека, а роль и видимость цен выбираются прямо
 * здесь: в разных проектах у него могут быть разные роли.
 */
interface ReminderCandidate {
  userId: number;
  name: string;
  /** Логин — показываем, если в списке есть тёзки (иначе «Петька» ×2 не различить) */
  email: string;
  /** Сколько других проектов объекта он уже видит */
  projectsCount: number;
  /** Роли, которые у него уже есть в этих проектах (для подсказки) */
  roles: AccessRole[];
  /** В скольких проектах ему скрыты цены */
  hiddenCount: number;
  /** Что выдаём в СОЗДАННОМ проекте (по умолчанию — его самая частая роль) */
  role: AccessRole;
  /** И с какой видимостью цен (по умолчанию — скрыты, если у него везде скрыты) */
  hidePrices: boolean;
  checked: boolean;
}

const REMINDER_ROLE_LABEL: Record<AccessRole, string> = {
  CUSTOMER: 'Администратор',
  FOREMAN: 'Прораб',
  VIEWER: 'Наблюдатель',
};
const REMINDER_ROLE_ICON: Record<AccessRole, string> = {
  CUSTOMER: '👑',
  FOREMAN: '👷',
  VIEWER: '👁',
};
/** «1 проект / 2 проекта / 5 проектов» */
const projectsWord = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'проект';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'проекта';
  return 'проектов';
};
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
import ArchiveIcon from '@mui/icons-material/Archive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ProjectTeamDialog from '../components/ProjectTeamDialog'; // ⭐ №249
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PeopleIcon from '@mui/icons-material/People'; // ⭐ №207: команда объекта из карточки проекта
import ContentCopyIcon from '@mui/icons-material/ContentCopy'; // ⭐ №307: копия проекта
import { FAB_STYLE } from '../theme';

// ⭐ №158: значение селекта справочника — id, «не выбран» или «создать новый»
type CatalogSelectValue = number | '' | 'new';

/** ⭐ №249: сколько дней осталось до удаления проекта. */
const deletionDaysLeft = (iso: string): number =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

const deletionPhrase = (iso: string): string => {
  const days = deletionDaysLeft(iso);
  return days <= 0 ? 'сегодня' : `через ${days} дн.`;
};

/**
 * ⭐ №252: слияние ответа PATCH с карточкой проекта.
 * Сервер может вернуть не все UI-поля (права, прогресс) — не теряем их,
 * иначе после переименования прогресс падал в 0 до перезагрузки.
 */
const mergeProjectUpdate = (
  prev: ProjectData,
  updated: ProjectData,
): ProjectData => ({
  ...prev,
  ...updated,
  progressPercent: updated.progressPercent ?? prev.progressPercent,
  materialsCount: updated.materialsCount ?? prev.materialsCount,
  totalCost: updated.totalCost ?? prev.totalCost,
  canWrite: updated.canWrite ?? prev.canWrite,
  canManage: updated.canManage ?? prev.canManage,
  hiddenForMe: updated.hiddenForMe ?? prev.hiddenForMe,
  // ⭐ №306: PATCH проекта не отдаёт счётчик команды — иначе «· N» пропадёт до перезагрузки
  participantsCount: updated.participantsCount ?? prev.participantsCount,
});

const Projects: React.FC = () => {
  const { objectId } = useParams<{ objectId: string }>();
  const navigate = useNavigate();
const goBack = useBackNavigation('/objects');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const { notify, success, error: notifyError, confirm } = useFeedback();


// ... внутри компонента:
const [currentObject, setCurrentObject] = useState<ObjectData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ⭐ №235: кастомный заголовок раздела (в мобильной шапке уже работал, теперь и на десктопе)
  const [titleCustom, setTitleCustom] = useState(() => safeGetString(PROJECTS_TITLE_KEY));
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  useEffect(() => {
    // синхронизация, если заголовок поменяли в мобильной шапке (или в другой вкладке)
    const onTitleChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (detail?.key === PROJECTS_TITLE_KEY) setTitleCustom(detail.value || '');
    };
    window.addEventListener(TITLE_CHANGED_EVENT, onTitleChanged);
    return () => window.removeEventListener(TITLE_CHANGED_EVENT, onTitleChanged);
  }, []);

  const startTitleEdit = () => {
    setTitleDraft(titleCustom || PROJECTS_TITLE_DEFAULT);
    setTitleEditing(true);
  };

  const commitTitleEdit = () => {
    const value = titleDraft.trim();
    const next = value && value !== PROJECTS_TITLE_DEFAULT ? value : '';
    try {
      if (next) localStorage.setItem(PROJECTS_TITLE_KEY, next);
      else localStorage.removeItem(PROJECTS_TITLE_KEY);
    } catch {
      // localStorage недоступен — применяем хотя бы на текущую сессию
    }
    setTitleCustom(next);
    window.dispatchEvent(
      new CustomEvent(TITLE_CHANGED_EVENT, {
        detail: { key: PROJECTS_TITLE_KEY, value: next },
      }),
    );
    setTitleEditing(false);
  };
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  // ⭐ №299: отдельные состояния/модалка подтверждения удаления убраны —
  // удаление спрашивает общий confirm() (как у объектов)
  // ⭐ №188: меню действий с проектом (шестерёнка на карточке)
  const [actionsProject, setActionsProject] = useState<ProjectData | null>(null);
  // ⭐ №249: личный архив проектов + модалка участников проекта
  const [showArchived, setShowArchived] = useState(false);
  const [teamProject, setTeamProject] = useState<ProjectData | null>(null);
  // ⭐ №163: после создания проекта предлагаем выдать доступ команде
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderProject, setReminderProject] = useState<ProjectData | null>(null);
  // ⭐ №305: одна строка на ЧЕЛОВЕКА + выбранные для этого проекта роль и цены
  const [reminderMembers, setReminderMembers] = useState<ReminderCandidate[]>([]);
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

  // ⭐ №307: копия проекта (как «Копировать объект», только внутри объекта)
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState<ProjectData | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyStartDate, setCopyStartDate] = useState('');
  const [copyEndDate, setCopyEndDate] = useState('');
  const [copyNote, setCopyNote] = useState('');
  const [copyFacts, setCopyFacts] = useState(false);
  const [copySaving, setCopySaving] = useState(false);

  // ⭐ №129: шаблоны смет (снимки доступа остаются доступны)
  const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
  // ⭐ №286: смета из другого проекта — вместо «глупого» списка шаблонов.
  // В одном селекте: проекты (копия сметы) + шаблоны/снимки доступа.
  const [estimateSource, setEstimateSource] = useState<string>(''); // '' | 'proj:12' | 'tpl:3'
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [zeroQuantities, setZeroQuantities] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null); // ⭐ №300
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [savingTemplateProject, setSavingTemplateProject] = useState<ProjectData | null>(null);
  const [templateName, setTemplateName] = useState('');
  // ⭐ №158: справочник цен проекта
  const [catalogs, setCatalogs] = useState<PriceCatalogData[]>([]);
  const [newCatalogId, setNewCatalogId] = useState<CatalogSelectValue>('');

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
    const filtered = projects.filter(proj => {
      // ⭐ №249: личный архив — как на «Объектах»: активные/архив раздельно
      const archived = proj.hiddenForMe === true;
      if (archived !== showArchived) return false;
      return proj.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
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
  }, [projects, searchQuery, sortBy, showArchived]);


  useEffect(() => {
    if (!token || !objectId) return;
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchProjectsByObject(parseInt(objectId), { includeHidden: true });
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

  // ⭐ №129: загрузить свои шаблоны (второй блок селекта «Смета из другого проекта»)
  const loadTemplates = async () => {
    try {
      setTemplates(await fetchEstimateTemplates());
    } catch {
      // шаблоны не критичны — оставляем пустой список
    }
  };

  // ⭐ №286: все доступные пользователю проекты со сметами (копирование при создании)
  const loadAvailableProjects = async () => {
    try {
      setAvailableProjects(await fetchAvailableProjects());
    } catch {
      setAvailableProjects([]);
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

  // ⭐ №286: смета нового проекта — копия из выбранного проекта (или шаблона).
  // Проект уже создан; копируем позиции и цены. Прогресс/факт не переносятся.
  const applyEstimateIfNeeded = async (projectId: number) => {
    if (!estimateSource) return;
    const [kind, rawId] = estimateSource.split(':');
    const sourceId = Number(rawId);
    if (!sourceId) return;
    try {
      if (kind === 'proj') {
        const res = await copyEstimateFromProject(projectId, {
          sourceProjectId: sourceId,
          zeroQuantities,
        });
        if (!res?.created) {
          notify('В проекте-источнике нет позиций — смета нового проекта пустая.', 'warning');
        } else {
          success(
            `Смета скопирована: ${res.created} поз. Прогресс — 0 %.` +
              (zeroQuantities ? ' Количества обнулены.' : ''),
          );
        }
        return;
      }
      const res = await applyEstimateTemplate(sourceId, projectId);
      if (!res?.created) {
        notify('Шаблон применён, но в нём нет позиций — смета нового проекта пустая.', 'warning');
      }
    } catch (err) {
      // ⭐ Раньше ошибка проглатывалась в console.warn — пользователь видел «не работает» без причины
      notifyError(
        'Проект создан, но смету скопировать не удалось:\n' +
          getApiErrorText(err, 'неизвестная ошибка'),
      );
    }
  };

  // ⭐ №129: сохранить проект как шаблон
  // ⭐ №300: удаление шаблона прямо из окна «Добавить проект» (раньше нельзя было)
  const handleDeleteTemplate = async (template: EstimateTemplate) => {
    const ok = await confirm({
      title: 'Удалить шаблон?',
      text: `Шаблон «${template.name}» (${template.items?.length ?? 0} поз.) будет удалён безвозвратно. Уже созданные по нему сметы не изменятся.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setDeletingTemplateId(template.id);
    try {
      await deleteEstimateTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      if (estimateSource === `tpl:${template.id}`) setEstimateSource('');
      success(`Шаблон «${template.name}» удалён`);
    } catch (err) {
      notifyError('Не удалось удалить шаблон: ' + getApiErrorText(err, 'неизвестная ошибка'));
    } finally {
      setDeletingTemplateId(null);
    }
  };

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
    // ⭐ №285: в архиве проекты не создаём (кнопка/фаб серые, но страхуем и здесь)
    if (showArchived) return;
    setAddModalOpen(true);
    // ⭐ Даты проекта по умолчанию — как у объекта: меньше ручного ввода
    setNewStartDate(currentObject?.startDate.slice(0, 10) ?? '');
    setNewEndDate(currentObject?.endDate.slice(0, 10) ?? '');
    loadTemplates();
    // ⭐ №286: список проектов, из которых можно взять смету
    void loadAvailableProjects();
    // ⭐ №274: по умолчанию — моя рабочая база цен
    const preferred =
      catalogs.find((c) => c.isDefault) ?? catalogs.find((c) => c.scope !== 'system');
    setNewCatalogId(preferred?.id ?? '');
  };
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
    setNewCatalogId('');
    setPendingProject(null);
    setEstimateSource(''); // ⭐ №286
    setZeroQuantities(false);
  };

  // ⭐ №158: значение селекта «Справочник цен» -> catalogId для API ('' и «создать новый» = не выбран)
  const catalogIdFromSelect = (value: CatalogSelectValue): number | null =>
    typeof value === 'number' ? value : null;

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
    await applyEstimateIfNeeded(created.id);
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

// ⭐ №163: напоминание о доступе. Показываем участников объекта, которых ещё
// нет в новом проекте (объектные записи и доступы к нему исключены).
// ⭐ №305: одна строка на человека — роль и видимость цен выбираются в модалке.
const openAccessReminder = async (project: ProjectData) => {
  if (!objectId) return;
  // ⭐ №207: список участников и выдачу доступа делает только администратор объекта.
  // Прораб с правом создания проектов создаёт проект, но команду не трогает.
  if (currentObject?.canManage !== true) return;
  setReminderProject(project);
  setReminderOpen(true);
  setReminderLoading(true);
  setReminderMembers([]);
  try {
    const rows = (await fetchAccessList(parseInt(objectId))).filter(
      // projectId = null — доступ на весь объект: такие видят проект сами
      (m) => m.projectId !== null && m.projectId !== project.id && m.revokedAt == null,
    );
    // Один человек может иметь доступ к нескольким проектам — склеиваем по userId
    const byUser = new Map<number, AccessMember[]>();
    rows.forEach((row) => {
      const list = byUser.get(row.userId);
      if (list) list.push(row);
      else byUser.set(row.userId, [row]);
    });
    // При равенстве голосов предпочитаем «рабочие» роли проекта
    const order: AccessRole[] = ['FOREMAN', 'VIEWER', 'CUSTOMER'];
    const candidates: ReminderCandidate[] = Array.from(byUser.values()).map((list) => {
      const counts = new Map<AccessRole, number>();
      list.forEach((row) => counts.set(row.role, (counts.get(row.role) ?? 0) + 1));
      const roles = Array.from(counts.keys()).sort(
        (a, b) =>
          (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
          order.indexOf(a) - order.indexOf(b),
      );
      const hiddenCount = list.filter((row) => row.hidePrices).length;
      const user = list[0].user;
      return {
        userId: list[0].userId,
        name: user.fullName || user.email || user.phone || 'Без имени',
        email: user.email ?? '',
        projectsCount: list.length,
        roles,
        hiddenCount,
        role: roles[0],
        // Открывать цены молча нельзя: если у него везде скрыты, оставляем скрытыми
        hidePrices: hiddenCount === list.length,
        checked: false,
      };
    });
    candidates.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    setReminderMembers(candidates);
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
};

/** ⭐ №305: точечно меняем выбор человека (роль / цены / галочка) */
const updateReminderMember = (userId: number, patch: Partial<ReminderCandidate>) => {
  setReminderMembers((prev) =>
    prev.map((m) => (m.userId === userId ? { ...m, ...patch } : m)),
  );
};

const handleReminderSave = async () => {
  if (!objectId || !reminderProject) return;
  const chosen = reminderMembers.filter((m) => m.checked);
  if (chosen.length === 0) {
    closeAccessReminder();
    return;
  }
  setReminderSaving(true);
  try {
    for (const member of chosen) {
      // ⭐ №305: роль и видимость цен — из модалки, а не «как повезёт»
      await addAccess(parseInt(objectId), {
        userId: member.userId,
        role: member.role,
        hidePrices: member.hidePrices,
        projectId: reminderProject.id,
      });
    }
    success(
      `Доступ к проекту «${reminderProject.name}» выдан: ${chosen.length} ` +
        `${chosen.length === 1 ? 'участнику' : 'участникам'}.`,
    );
    closeAccessReminder();
    // ⭐ №306: счётчик «Участники проекта · N» должен обновиться сразу
    void reloadProjects();
  } catch (err) {
    notifyError(
      'Проект создан, но доступ выдать не удалось: ' +
        getApiErrorText(err, 'неизвестная ошибка'),
    );
  } finally {
    setReminderSaving(false);
  }
};

// ⭐ №305: есть ли в списке тёзки — тогда показываем логин, чтобы людей различить
const reminderDuplicateNames = useMemo(() => {
  const counts = new Map<string, number>();
  reminderMembers.forEach((m) => counts.set(m.name, (counts.get(m.name) ?? 0) + 1));
  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );
}, [reminderMembers]);

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
      await applyEstimateIfNeeded(created.id);
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
      });
      console.log('✅ Проект обновлён:', updated);
      
      setProjects(prev => prev.map(p => p.id === updated.id ? mergeProjectUpdate(p, updated) : p));
      handleCloseEdit();
      void reloadProjects();
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
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditingProject(null);
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
    });
    setProjects(prev => prev.map(p => p.id === updated.id ? mergeProjectUpdate(p, updated) : p));
    handleCloseEdit();
    void reloadProjects();
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

// ⭐ №307: «Копировать проект» — как у объектов: нужны право записи в проекте,
// видимые цены и право создавать проекты (админ объекта или прораб с флагом).
const canCopyProject = (p: ProjectData | null): boolean =>
  !!p &&
  p.canWrite === true &&
  currentObject?.hidePrices !== true &&
  (currentObject?.canManage === true || currentObject?.canCreateProjects === true);

/** ⭐ №307: имя копии как у объектов — «X (копия)», «X (копия 2)», … */
const nextProjectCopyName = (sourceName: string) => {
  const base = `${sourceName} (копия)`;
  if (!projects.some((p) => p.name === base)) return base;
  for (let i = 2; i <= 99; i += 1) {
    const candidate = `${sourceName} (копия ${i})`;
    if (!projects.some((p) => p.name === candidate)) return candidate;
  }
  return `${sourceName} (копия ${Date.now()})`;
};

// ⭐ №192: сохранение проекта как шаблона объекта удалено —
// вместо него в «Объектах» работает «Копировать объект».

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
    setProjects(prev => prev.map(p => p.id === updated.id ? mergeProjectUpdate(p, updated) : p));
    handleCloseNoteModal();
  } catch (err: unknown) {
    notifyError('Ошибка обновления заметки: ' + getApiErrorText(err, 'неизвестная ошибка'));
  }
};


// ⭐ №307: открыть диалог копии — поля предзаполнены как у оригинала
const handleOpenCopy = (proj: ProjectData) => {
  if (!canCopyProject(proj)) return;
  setCopySource(proj);
  setCopyName(nextProjectCopyName(proj.name));
  setCopyStartDate((proj.startDate ?? '').slice(0, 10));
  setCopyEndDate((proj.endDate ?? '').slice(0, 10));
  setCopyNote(proj.note ?? '');
  setCopyFacts(false); // по умолчанию копия «чистая»: расход и прогресс = 0
  setCopyOpen(true);
};

const handleCloseCopy = () => {
  setCopyOpen(false);
  setCopySource(null);
  setCopyName('');
  setCopyStartDate('');
  setCopyEndDate('');
  setCopyNote('');
  setCopyFacts(false);
};

const handleCopyProject = async () => {
  if (!copySource) return;
  if (!copyName.trim()) {
    notify('Введите название копии', 'warning');
    return;
  }
  if (!copyStartDate || !copyEndDate) {
    notify('Заполните даты начала и окончания', 'warning');
    return;
  }
  if (new Date(copyEndDate) < new Date(copyStartDate)) {
    notify('Дата окончания не может быть раньше даты начала', 'warning');
    return;
  }
  setCopySaving(true);
  try {
    const created = await copyProject(copySource.id, {
      name: copyName.trim(),
      startDate: copyStartDate,
      endDate: copyEndDate,
      note: copyNote.trim(),
      copyFacts,
    });
    setProjects((prev) => [created, ...prev]);
    const stats = created.copyStats;
    notify(
      `Копия «${created.name}» создана: позиций ${stats?.materials ?? 0}` +
        (stats?.factsCopied ? ' · факт перенесён' : ' · без факта и прогресса'),
      'success',
    );
    handleCloseCopy();
  } catch (err: unknown) {
    notifyError(
      'Не удалось скопировать проект: ' + getApiErrorText(err, 'неизвестная ошибка'),
    );
  } finally {
    setCopySaving(false);
  }
};

  const reloadProjects = async () => {
    if (!objectId) return;
    try {
      const data = await fetchProjectsByObject(parseInt(objectId), {
        includeHidden: true,
      });
      setProjects(data);
    } catch {
      // список обновится при следующем входе — страницу не роняем
    }
  };

  // ⭐ №305: прогресс на карточках обновляем при возврате в окно —
  // иначе фиксации прораба видны только после перезагрузки страницы.
  useRefreshOnFocus(() => void reloadProjects(), { minIntervalMs: 10_000 });

  // ⭐ №249: личный архив проекта (скрыт только у меня)
  const handleToggleProjectArchive = async (proj: ProjectData) => {
    try {
      await setProjectHidden(proj.id, !proj.hiddenForMe);
      await reloadProjects();
      notify(
        proj.hiddenForMe
          ? `Проект «${proj.name}» возвращён из архива`
          : `Проект «${proj.name}» убран в архив`,
      );
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось изменить архив'));
    }
  };

  // ⭐ №299: удаление проекта — как у объектов: «Удалить окончательно» сразу, без 30 дней.
  // Архив (handleToggleProjectArchive выше) — только личное скрытие, удаление не назначает.
  const handlePurgeProject = async (proj: ProjectData) => {
    const ok = await confirm({
      title: 'Удалить проект окончательно?',
      text: `«${proj.name}» и все его данные (смета, фиксации, склад, отчёты, выходы бригад) удалятся сразу и безвозвратно — отменить это нельзя. Остальные участники получат личные копии проекта, но без фото.`,
      confirmText: 'Удалить окончательно',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProject(proj.id);
      await reloadProjects();
      notify(`Проект «${proj.name}» удалён окончательно`);
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось удалить проект'));
    }
  };
  // ⭐ trailing в useMemo — стабильная ссылка, нет бесконечного цикла (как в Materials)
  const headerTrailing = useMemo(() => isMobile ? (
    <>
      <IconButton
        onClick={() => setShowArchived(v => !v)}
        aria-label={showArchived ? 'Активные' : 'Архив'}
        sx={{
          bgcolor: showArchived ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.06)',
          color: showArchived ? '#1976d2' : '#424242',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' },
        }}
      >
        {showArchived ? <CheckCircleIcon /> : <ArchiveIcon />}
      </IconButton>
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
    </>
  ) : undefined, [isMobile, sortBy, showArchived]);

useMobileHeader({
title: showArchived ? 'Архив' : 'Проекты',
editableKey: 'frame_title_projects',
onBack: goBack,
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
              onClick={goBack}
              sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }}
              aria-label="Назад к объектам"
            >
              <ArrowBackIcon />
            </IconButton>
            {titleEditing ? (
              <TextField
                autoFocus
                size="small"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitleEdit();
                  if (e.key === 'Escape') setTitleEditing(false);
                }}
                inputProps={{ maxLength: 30 }}
                sx={{ flexGrow: 1, maxWidth: 560 }}
              />
            ) : (
              <Box
                role="button"
                tabIndex={0}
                onClick={startTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startTitleEdit();
                  }
                }}
                title="Нажмите, чтобы переименовать раздел"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1,
                  cursor: 'pointer', borderRadius: 1, px: 0.5,
                  '&:hover': { bgcolor: 'rgba(25,118,210,0.06)' },
                }}
              >
                <Typography variant="h4">{titleCustom || PROJECTS_TITLE_DEFAULT}</Typography>
                <EditIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </Box>
            )}
            {/* ⭐ Архив в шапке раздела, как в «Объектах» */}
            <Button
              variant={showArchived ? 'contained' : 'outlined'}
              startIcon={showArchived ? <CheckCircleIcon /> : <ArchiveIcon />}
              onClick={() => setShowArchived(v => !v)}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0, ml: 2 }}
            >
              {showArchived ? 'Активные' : 'Архив'}
            </Button>
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
          {/* ⭐ №287: ширины как в «Объектах» — сортировка 150, кнопки по содержимому */}
          <FormControl size="small" sx={{ minWidth: 150, flexShrink: 0 }}>
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
            <Button variant="contained" startIcon={<NoteAddIcon />} disabled sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              Добавить проект
            </Button>
          ) : canCreateProjects ? (
            <Button
              variant="contained"
              startIcon={<NoteAddIcon />}
              onClick={handleOpenAddModal}
              // ⭐ №285: в архиве создание недоступно — кнопка серая
              disabled={showArchived}
              title={showArchived ? 'В архиве создание недоступно — вернитесь в «Активные»' : undefined}
              sx={{
                ...(showArchived
                  ? {}
                  : {
                      bgcolor: '#4caf50',
                      border: '2px solid #388e3c',
                      '&:hover': { bgcolor: '#388e3c', borderColor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
                      transition: 'all 0.3s ease',
                    }),
                whiteSpace: 'nowrap',
                flexShrink: 0,
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
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
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
  onClick={proj.hiddenForMe ? undefined : () => {
    navigate(`/objects/${objectId}/projects/${proj.id}/materials`);
  }}
  sx={{
    p: isMobile ? 1.5 : 2,
    borderRadius: 2,
    // ⭐ №249: проект в личном архиве не открывается (как объект в архиве)
    cursor: proj.hiddenForMe ? 'default' : 'pointer',
    transition: 'box-shadow 0.3s, transform 0.3s',
    '&:hover': proj.hiddenForMe ? {} : {
      boxShadow: 6,
      transform: 'scale(1.01)',
    },
  }}
>
{/* ⭐ №299: как у объектов — «Удалить окончательно» сразу, только админ объекта */}
{proj.deleteAfter && (
  <Alert
    severity="error"
    onClick={(e) => e.stopPropagation()}
    sx={{ mb: 1, borderRadius: 2 }}
    action={
      proj.canDeleteCard ? (
        <Button
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            void handlePurgeProject(proj);
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {isMobile ? 'Удалить' : 'Удалить окончательно'}
        </Button>
      ) : undefined
    }
  >
    {`Проект помечен на удаление ${deletionPhrase(proj.deleteAfter)}. Участники получат личные копии (без фото).`}
  </Alert>
)}
{proj.hiddenForMe && (
  <Alert
    severity="warning"
    onClick={(e) => e.stopPropagation()}
    sx={{ mb: 1, borderRadius: 2 }}
    action={
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Button
          size="small"
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            void handleToggleProjectArchive(proj);
          }}
        >
          Вернуть
        </Button>
        {proj.canDeleteCard && (
          <Button
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              void handlePurgeProject(proj);
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {isMobile ? 'Удалить' : 'Удалить окончательно'}
          </Button>
        )}
      </Box>
    }
  >
    Проект в вашем архиве — виден только вам.
  </Alert>
)}
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
  title={proj.hiddenForMe ? 'Проект в архиве — действия через панель' : 'Действия с проектом'}
  aria-label="Действия с проектом"
  disabled={proj.hiddenForMe}
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
      {projects.length === 0
        ? 'Нет проектов. Создайте первый проект.'
        : showArchived
          ? 'В архиве пока нет проектов'
          : 'Ничего не найдено'}
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
    width: { xs: '92%', sm: 480 },
    p: 4,
    borderRadius: 2,
    // ⭐ №300: список смет со своим скроллом — окно не должно вылезать за экран
    maxHeight: '92vh',
    overflowY: 'auto',
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
      {/* ⭐ №286/№300: выбор сметы — как в «Добавить в смету»: скроллируемый список
          кнопкой-строкой, выбранная строка подсвечена, у шаблонов есть корзинка */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Смета из другого проекта
        </Typography>
        <Box sx={{ maxHeight: 300, overflowY: 'auto', mt: 0.5, pr: 0.5 }}>
          <Button
            fullWidth
            variant={estimateSource === '' ? 'contained' : 'outlined'}
            onClick={() => setEstimateSource('')}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 1 }}
          >
            {estimateSource === '' ? '✓ ' : ''}Пустой проект — смету заполню сам
          </Button>

          {availableProjects.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Сметы ваших проектов
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5, mb: 1 }}>
                {availableProjects.map((p) => {
                  const value = `proj:${p.id}`;
                  const selected = estimateSource === value;
                  return (
                    <Button
                      key={value}
                      fullWidth
                      variant={selected ? 'contained' : 'outlined'}
                      onClick={() => setEstimateSource(selected ? '' : value)}
                      sx={{ justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selected ? '✓ ' : ''}{p.name} — {p.objectName}
                      </span>
                      <span style={{ opacity: 0.7, flexShrink: 0, marginLeft: 8 }}>
                        {p.materialsCount} поз.
                      </span>
                    </Button>
                  );
                })}
              </Stack>
            </>
          )}

          {templates.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Шаблоны и снимки доступа
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {templates.map((t) => {
                  const value = `tpl:${t.id}`;
                  const selected = estimateSource === value;
                  const empty = t.items.length === 0;
                  return (
                    <Box key={value} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Button
                        fullWidth
                        variant={selected ? 'contained' : 'outlined'}
                        disabled={empty}
                        onClick={() => setEstimateSource(selected ? '' : value)}
                        sx={{ flex: 1, minWidth: 0, justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selected ? '✓ ' : ''}{t.name}
                        </span>
                        <span style={{ opacity: 0.7, flexShrink: 0, marginLeft: 8 }}>
                          {empty ? 'пусто' : `${t.items.length} поз.`}
                        </span>
                      </Button>
                      <IconButton
                        aria-label={`Удалить шаблон ${t.name}`}
                        title="Удалить шаблон"
                        color="error"
                        disabled={deletingTemplateId === t.id}
                        onClick={() => { void handleDeleteTemplate(t); }}
                      >
                        {deletingTemplateId === t.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}

          {availableProjects.length === 0 && templates.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Пока нечего копировать: у доступных проектов нет позиций. Сначала заполните смету
              любого проекта — он появится здесь.
            </Typography>
          )}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        Можно вставить смету существующего проекта: позиции, единицы и цены скопируются,
        а прогресс начнётся с 0 % (факт, фиксации и фото не переносятся).
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={zeroQuantities}
            onChange={(e) => setZeroQuantities(e.target.checked)}
            // ⭐ №286: имеет смысл только для копии проекта (у шаблонов свои количества)
            disabled={!estimateSource.startsWith('proj:')}
          />
        }
        label="Обнулить количества — оставить названия и единицы измерения"
      />
      {!hideFinance && (
        <FormControl fullWidth>
          <InputLabel id="project-catalog-label">Справочник цен проекта</InputLabel>
          <Select
            labelId="project-catalog-label"
            label="Справочник цен проекта"
            value={newCatalogId}
            onChange={(e) => setNewCatalogId(e.target.value as CatalogSelectValue)}
          >
            <MenuItem value="">
              <em>Моя база по умолчанию</em>
            </MenuItem>
            {catalogs
              .filter((c) => c.scope !== 'system')
              .map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                  {c.isDefault ? ' — моя база' : ''}
                  {c.scope === 'object' ? ' (объект)' : ''}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      )}
      {!hideFinance && (
        <Typography variant="caption" color="text.secondary">
          Проект работает с выбранной базой цен: новые материалы и расценки попадают в неё.
          Копий не создаётся — изменить выбор можно в карточке проекта.
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
          {/* ⭐ №306: «Участники проекта» — первой строкой меню, как «Участники» в объектах,
              и со счётчиком команды в подписи */}
          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<PeopleIcon />}
            disabled={currentObject?.canManage !== true}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) setTeamProject(p);
            }}
          >
            Участники проекта
            {actionsProject?.participantsCount != null
              ? ` · ${actionsProject.participantsCount}`
              : ''}
          </Button>

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

          {/* ⭐ №307: копия проекта — как «Копировать объект» у объектов */}
          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            disabled={!canCopyProject(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) handleOpenCopy(p);
            }}
          >
            Копировать проект
          </Button>
          {!canCopyProject(actionsProject) && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Нужны права на запись, видимые цены и право создавать проекты в объекте.
            </Typography>
          )}

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

          {/* ⭐ №249/№300: личный архив проекта — цвет как у «Убрать в архив» в объектах */}
          <Button
            size="large"
            fullWidth
            variant="outlined"
            color="warning"
            startIcon={<ArchiveIcon />}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) void handleToggleProjectArchive(p);
            }}
          >
            {actionsProject?.hiddenForMe ? 'Вернуть из архива' : 'Убрать в архив'}
          </Button>

          {/* ⭐ №299: удаление проекта окончательно и сразу — как у объектов */}
          <Button
            size="large"
            fullWidth
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!canDeleteProjectCard(actionsProject)}
            onClick={() => {
              const p = actionsProject;
              handleCloseActions();
              if (p) void handlePurgeProject(p);
            }}
            sx={{ mt: 1 }}
          >
            Удалить окончательно
          </Button>

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
            {!hideFinance && editingProject?.catalog && (
              <Typography variant="body2" color="text.secondary">
                Справочник проекта: «{editingProject.catalog.name}»
              </Typography>
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
                aria-label="Удалить проект окончательно"
                title="Удалить проект окончательно"
                // ⭐ №204 (A#10): удаление карточки — право администратора объекта
                disabled={!canDeleteProjectCard(editingProject)}
                onClick={() => {
                  // ⭐ №299: корзина в редактировании удаляет сразу (как у объектов)
                  const target = editingProject;
                  handleCloseEdit();
                  if (target) void handlePurgeProject(target);
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


      {/* ⭐ №249: участники проекта */}
      <ProjectTeamDialog
        open={!!teamProject}
        onClose={() => setTeamProject(null)}
        objectId={currentObject?.id ?? Number(objectId)}
        project={teamProject}
        canManage={currentObject?.canManage === true}
        onChanged={() => {
          void reloadProjects();
        }}
      />

      {/* ⭐ №299: отдельная модалка «Удалить проект?» больше не нужна —
          подтверждение даёт общий диалог в handlePurgeProject (как у объектов) */}

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

      {/* ⭐ №307: копия проекта — как «Копировать объект» у объектов */}
      <Modal open={copyOpen} onClose={() => !copySaving && handleCloseCopy()} disableRestoreFocus>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '94%', sm: 520 },
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 3,
            borderRadius: 3,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Копировать проект?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Будет создан новый проект «{copySource?.name}» в этом же объекте.
            Оригинал не изменится. Переносятся позиции сметы с ценами; фото,
            история фиксаций и участники не копируются.
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Название копии"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              inputProps={{ maxLength: 200 }}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Дата начала"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={copyStartDate}
                onChange={(e) => setCopyStartDate(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Дата окончания"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={copyEndDate}
                onChange={(e) => setCopyEndDate(e.target.value)}
                required
              />
            </Stack>
            <TextField
              fullWidth
              label="Заметка (необязательно)"
              multiline
              rows={2}
              value={copyNote}
              onChange={(e) => setCopyNote(e.target.value)}
              inputProps={{ maxLength: 1000 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={copyFacts}
                  onChange={(e) => setCopyFacts(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Перенести фактический расход</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {copyFacts
                      ? 'Объёмы, прогресс и последняя фиксация перейдут в копию.'
                      : 'Копия начнётся с нуля: факт и прогресс = 0, останется только план.'}
                  </Typography>
                </Box>
              }
            />
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={handleCloseCopy} disabled={copySaving}>
              Отмена
            </Button>
            <Button variant="contained" onClick={() => void handleCopyProject()} disabled={copySaving}>
              {copySaving ? 'Копируем…' : 'Создать копию'}
            </Button>
          </Box>
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
            Проект «{reminderProject?.name}» создан. Отметьте, кому из команды объекта
            открыть доступ именно к этому проекту, и выберите роль. Участники с доступом
            на весь объект видят новый проект автоматически.
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
            <Stack spacing={1}>
              {reminderMembers.map((member) => (
                <Box
                  key={member.userId}
                  sx={{
                    border: '1px solid',
                    borderColor: member.checked ? 'primary.light' : 'divider',
                    bgcolor: member.checked ? 'action.hover' : 'transparent',
                    borderRadius: 2,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <FormControlLabel
                    sx={{ m: 0, alignItems: 'flex-start' }}
                    control={
                      <Checkbox
                        checked={member.checked}
                        onChange={(e) =>
                          updateReminderMember(member.userId, { checked: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Box sx={{ py: 0.75 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {member.name}
                        </Typography>
                        {reminderDuplicateNames.has(member.name) && member.email && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {member.email}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {/* ⭐ №305: роль и цены в других проектах — чтобы было видно,
                              откуда взялись значения по умолчанию */}
                          {member.projectsCount} {projectsWord(member.projectsCount)} •{' '}
                          {member.roles
                            .map(
                              (r) => `${REMINDER_ROLE_ICON[r]} ${REMINDER_ROLE_LABEL[r]}`,
                            )
                            .join(', ')}
                          {member.hiddenCount > 0
                            ? ` • 🙈 цены скрыты в ${member.hiddenCount}`
                            : ''}
                        </Typography>
                      </Box>
                    }
                  />
                  {member.checked && (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{ pl: { xs: 0, sm: 5 }, pb: 1 }}
                    >
                      <FormControl size="small" sx={{ minWidth: 190 }}>
                        <InputLabel id={`reminder-role-${member.userId}`}>
                          Роль в этом проекте
                        </InputLabel>
                        <Select
                          labelId={`reminder-role-${member.userId}`}
                          value={member.role}
                          label="Роль в этом проекте"
                          onChange={(e) =>
                            updateReminderMember(member.userId, {
                              role: e.target.value as AccessRole,
                            })
                          }
                        >
                          <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                          <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                          {member.roles.includes('CUSTOMER') && (
                            <MenuItem value="CUSTOMER">👑 Администратор</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={member.hidePrices}
                            onChange={(e) =>
                              updateReminderMember(member.userId, {
                                hidePrices: e.target.checked,
                              })
                            }
                          />
                        }
                        label={
                          <Typography variant="caption" color="text.secondary">
                            🙈 не показывать цены
                          </Typography>
                        }
                      />
                    </Stack>
                  )}
                </Box>
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
              // ⭐ №305: пока никого не отметили — доступ выдавать нечего
              disabled={
                reminderSaving ||
                reminderLoading ||
                !reminderMembers.some((m) => m.checked)
              }
            >
              {reminderSaving ? 'Выдаём…' : 'Выдать доступ'}
            </Button>
          </Box>
        </Paper>
      </Modal>

      {isMobile && (
        <Fab
          color="primary"
          sx={{ ...FAB_STYLE, bottom: 80 }}
          onClick={handleOpenAddModal}
          // ⭐ №285: в архиве создание недоступно — фаб серый
          disabled={showArchived}
          aria-label={showArchived ? 'В архиве создание недоступно' : 'Добавить проект'}
        >
          <NoteAddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default Projects;