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
  Divider,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddHomeIcon from '@mui/icons-material/AddHome';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import { fetchObjects, createObject } from '../services/objectService';
import type { ObjectData } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService'; // ⭐ №163
import type { ProjectData } from '../services/projectService'; // ⭐ №163
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useNavigate } from 'react-router-dom';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import RestoreIcon from '@mui/icons-material/Restore';
import LinkIcon from '@mui/icons-material/Link';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import EditIcon from '@mui/icons-material/Edit';
import { fetchAccessList, addAccess, updateAccess, revokeAccess, restoreAccess, purgeAccess, setMyAccessHidden } from '../services/accessService';
import { APP_URL } from '../config';
import type { AccessMember, AccessRole } from '../services/accessService';
import { createInviteLink, fetchInviteLinks, revokeInviteLink } from '../services/inviteService';
import type { InviteLink } from '../services/inviteService';
// ⭐ №178: заявки на право создавать проекты в объекте
import {
  approveAccessRequest,
  fetchIncomingAccessRequests,
  fetchObjectAccessRequests,
  rejectAccessRequest,
} from '../services/accessRequestService';
import type { AccessRequestData } from '../services/accessRequestService';
// ⭐ №175: шаблоны объектов
import {
  createObjectFromTemplate,
  createObjectTemplate,
  deleteObjectTemplate,
  fetchObjectTemplates,
  updateObjectTemplate,
} from '../services/objectTemplateService';
import type { ObjectTemplateData } from '../services/objectTemplateService';
import { updateObject } from '../services/objectService';
import { fetchPriceCatalogs, createPriceCatalog } from '../services/priceListService'; // ⭐ №164
import type { PriceCatalogData } from '../services/priceListService'; // ⭐ №164
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import SortIcon from '@mui/icons-material/Sort';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArchiveIcon from '@mui/icons-material/Archive';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getApiErrorText, getApiErrorMessage } from '../utils/errors';
import { FAB_STYLE } from '../theme';

// Вспомогательная функция для форматирования даты
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2); // ← только последние 2 цифры
  return `${day}.${month}.${year}`;
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
  const { token, user } = useAuth(); // получаем токен и профиль из контекста
  // ⭐ №175: id текущего пользователя — чтобы понимать, «мой» ли шаблон
  const myUserId: number | undefined = user?.id;
  const { notify, error: notifyError, confirm } = useFeedback();
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
  // ⭐ Переключатель «Активные / Архив»
  const [showArchived, setShowArchived] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  // ⭐ №164: справочник цен объекта ('' — не выбран, 'new' — создать новый)
  const [editCatalogId, setEditCatalogId] = useState<number | '' | 'new'>('');
  const [objectCatalogs, setObjectCatalogs] = useState<PriceCatalogData[]>([]);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteObject, setEditingNoteObject] = useState<ObjectData | null>(null);
  const [editNote, setEditNote] = useState('');
// ⭐ Модалка управления доступом (участники)
// ⭐ №185: все действия с объектом — в одной кнопке (мобилка: легче попасть пальцем)
const [actionsObject, setActionsObject] = useState<ObjectData | null>(null);
const [accessModalOpen, setAccessModalOpen] = useState(false);
const [accessObject, setAccessObject] = useState<ObjectData | null>(null);
const [accessMembers, setAccessMembers] = useState<AccessMember[]>([]);
const [accessLoading, setAccessLoading] = useState(false);
const [accessError, setAccessError] = useState('');
// ⭐ Форма приглашения
const [inviteIdentifier, setInviteIdentifier] = useState(''); // email или телефон
const [inviteRole, setInviteRole] = useState<AccessRole>('FOREMAN');
// ⭐ №163: область доступа — '' = весь объект, иначе конкретный проект
const [inviteProjectId, setInviteProjectId] = useState<number | ''>('');
const [accessProjects, setAccessProjects] = useState<ProjectData[]>([]);
// ⭐ Приглашение по ссылке (как в Google Docs)
const [inviteTab, setInviteTab] = useState<'link' | 'direct'>('link');
const [linkRole, setLinkRole] = useState<AccessRole>('FOREMAN');
const [inviteHidePrices, setInviteHidePrices] = useState(false); // ⭐ №182
const [linkHidePrices, setLinkHidePrices] = useState(false);
const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
const [activeLinks, setActiveLinks] = useState<InviteLink[]>([]);
const [linkCopied, setLinkCopied] = useState(false);
// ⭐ №178: заявки на право создавать проекты (входящие — для менеджера/админа)
const [accessRequests, setAccessRequests] = useState<AccessRequestData[]>([]);
const [accessRequestBusy, setAccessRequestBusy] = useState<number | null>(null);
const [pendingByObject, setPendingByObject] = useState<Record<number, number>>({});
// ⭐ №175: шаблоны объектов
const [templatesOpen, setTemplatesOpen] = useState(false);
const [templates, setTemplates] = useState<ObjectTemplateData[]>([]);
const [templateScope, setTemplateScope] = useState<'mine' | 'all'>('all');
const [templatesLoading, setTemplatesLoading] = useState(false);
const [saveTemplateObject, setSaveTemplateObject] = useState<ObjectData | null>(null);
const [saveTemplateName, setSaveTemplateName] = useState('');
const [saveTemplateNote, setSaveTemplateNote] = useState('');
const [saveTemplatePublic, setSaveTemplatePublic] = useState(false);
const [saveTemplateSaving, setSaveTemplateSaving] = useState(false);
const [fromTemplate, setFromTemplate] = useState<ObjectTemplateData | null>(null);
const [fromTplName, setFromTplName] = useState('');
const [fromTplAddress, setFromTplAddress] = useState('');
const [fromTplStart, setFromTplStart] = useState('');
const [fromTplEnd, setFromTplEnd] = useState('');
const [fromTplSaving, setFromTplSaving] = useState(false);

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
      // ⭐ №176: главному списку архив нужен — там раздел «Архив»
      const data = await fetchObjects({ includeArchived: true });
      setObjects(data);
      //console.log('Получены объекты:', data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Ошибка загрузки объектов'));
      console.error(err);
    } finally {
      setLoading(false);
      
    }
  };
  loadObjects();
}, [token]);

  // ⭐ №164: справочники для выбора справочника объекта
  useEffect(() => {
    if (!token) return;
    fetchPriceCatalogs()
      .then(setObjectCatalogs)
      .catch(() => setObjectCatalogs([]));
  }, [token]);

  // ⭐ №178: входящие заявки «право создавать проекты» — счётчик для карточек объектов
  useEffect(() => {
    if (!token) return;
    fetchIncomingAccessRequests('PENDING')
      .then((rows) => {
        const map: Record<number, number> = {};
        rows.forEach((r) => {
          map[r.objectId] = (map[r.objectId] ?? 0) + 1;
        });
        setPendingByObject(map);
      })
      .catch(() => setPendingByObject({}));
  }, [token]);

  // Фильтрация по поиску + архив
const filteredAndSortedObjects = useMemo(() => {
  // Сначала фильтруем
  const filtered = objects.filter(obj => {
    // ⭐ №168: архив стал ЛИЧНЫМ — фильтруем по своей записи доступа (hiddenForMe)
    const archived = obj.hiddenForMe === true;
    if (archived !== showArchived) return false;
    return (
      obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Потом сортируем
  switch (sortBy) {
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'endDate':
      filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      break;
    case 'progress':
      filtered.sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
      break;
    case 'newest':
    default:
      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      break;
  }
  return filtered;
}, [objects, searchQuery, sortBy, showArchived]);

  const handleOpenAddModal = () => setAddModalOpen(true);
  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    // очищаем форму
    setNewName('');
    setNewAddress('');
    setNewStartDate('');
    setNewEndDate('');
  };
  // ⭐ №181: создатель объекта всегда администратор объекта — роль не выбирается
  const doCreateObject = async () => {
    if (!token) return;
    try {
      const created = await createObject({
        name: newName,
        address: newAddress,
        startDate: newStartDate,
        endDate: newEndDate,
      });
      setObjects(prev => [created, ...prev]);
      handleCloseAddModal();
    } catch (err: unknown) {
      notifyError('Ошибка при создании объекта: ' + getApiErrorText(err, 'неизвестная ошибка'));
    }
  };

  // ⭐ Точка входа: создаём сразу — создатель всегда администратор объекта (№181)
  const handleCreateObject = async () => {
    if (!token || !newName || !newAddress || !newStartDate || !newEndDate) {
      notify('Заполните все поля', 'warning');
      return;
    }
    // ↓↓↓ ВАЛИДАЦИЯ ДАТ ↓↓↓
    if (new Date(newEndDate) < new Date(newStartDate)) {
      notify('Дата окончания не может быть раньше даты начала', 'warning');
      return;
    }
    // ↑↑↑ КОНЕЦ ВАЛИДАЦИИ ↑↑↑
    await doCreateObject();
  };
  
    const handleOpenEdit = (obj: ObjectData) => {
    setEditingObject(obj);
    setEditName(obj.name);
    setEditAddress(obj.address);
    setEditStartDate(obj.startDate.slice(0, 10));
    setEditEndDate(obj.endDate.slice(0, 10));
    setEditCatalogId(obj.catalogId ?? '');
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
    notify('Дата окончания не может быть раньше даты начала', 'warning');
    return;
  }
  // ↑↑↑ КОНЕЦ ВАЛИДАЦИИ ↑↑↑
  
  try {
    // ⭐ №164: справочник объекта — существующий, новый или «не выбран»
    let catalogId: number | null =
      editCatalogId === '' ? null : Number(editCatalogId);
    if (editCatalogId === 'new') {
      setCatalogSaving(true);
      const created = await createPriceCatalog(
        `Справочник «${editName.trim() || editingObject.name}»`,
        { objectId: Number(editingObject.id) },
      );
      setObjectCatalogs((prev) => [...prev, created]);
      catalogId = created.id;
    }
    const updated = await updateObject(Number(editingObject.id), {
      name: editName,
      address: editAddress,
      startDate: editStartDate,
      endDate: editEndDate,
      catalogId,
    });
    setObjects(prev => prev.map(obj => obj.id === updated.id ? updated : obj));
    handleCloseEdit();
  } catch (err) {
    notifyError(getApiErrorText(err, 'Ошибка обновления'));
  } finally {
    setCatalogSaving(false);
  }
};

// ⭐ №168: «Убрать в архив» — это ЛИЧНЫЙ архив (объект исчезает только у меня).
// Данные, акты и склад остаются у всех остальных участников.
const hideObjectForMe = async (obj: ObjectData) => {
  if (!token) return;
  if (!obj.accessId) {
    notifyError('Архивировать можно только объект с доступом на весь объект');
    return;
  }
  try {
    await setMyAccessHidden(obj.accessId, true);
    setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, hiddenForMe: true } : o));
  } catch {
    notifyError('Не удалось убрать объект в архив');
  }
};

const handleDeleteObject = async () => {
  if (!deletingObject) return;
  await hideObjectForMe(deletingObject);
  setDeleteConfirmOpen(false);
  setDeletingObject(null); // очищаем
};

// ⭐ Демо-объект тоже просто скрываем у себя: жёсткое удаление запрещено (№168)
const handleDeleteDemo = async (obj: ObjectData) => {
  await hideObjectForMe(obj);
};

// ⭐ Вернуть объект из личного архива
const handleRestoreObject = async (obj: ObjectData) => {
  if (!token || !obj.accessId) return;
  try {
    await setMyAccessHidden(obj.accessId, false);
    setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, hiddenForMe: false } : o));
  } catch {
    notifyError('Не удалось вернуть объект из архива');
  }
};


// ⭐ №168: право управлять командой (администратор объекта или прораб-менеджер) — с бэка
const canManage = accessObject?.canManage === true;

// ⭐ №185: права для модалки действий. Кнопки не прячем — показываем серыми с пояснением.
const act = actionsObject;
const actHasObject = act ? act.hasObjectAccess !== false : false;
const actCanInvite = !!act && actHasObject && act.canManage === true;
const actCanTemplate = !!act && actHasObject;
const actCanEdit = !!act && actHasObject && act.canWrite === true;
const actCanArchive = !!act && act.accessId != null && act.hiddenForMe !== true;
// ⭐ Текущая роль пользователя на объекте (для UI-подсказок в модалке)
const myRole = accessObject?.role;

// ⭐ Загрузить список участников
const loadAccessMembers = async (objectId: number) => {
  if (!token) return;
  setAccessLoading(true);
  setAccessError('');
  try {
    const members = await fetchAccessList(objectId);
    setAccessMembers(members);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка загрузки участников'));
  } finally {
    setAccessLoading(false);
  }
};

// ⭐ Открыть модалку участников
const handleOpenAccess = (obj: ObjectData) => {
  setAccessObject(obj);
  setAccessModalOpen(true);
  loadAccessMembers(obj.id);
  loadInviteLinks(obj.id);
  // ⭐ №178: заявки «право создавать проекты» — видны менеджеру объекта и админу
  setAccessRequests([]);
  fetchObjectAccessRequests(obj.id)
    .then(setAccessRequests)
    .catch(() => setAccessRequests([]));
  // ⭐ №163: проекты объекта — для выбора «доступ только к проекту»
  fetchProjectsByObject(obj.id)
    .then(setAccessProjects)
    .catch(() => setAccessProjects([]));
};

// ⭐ №178: одобрить / отклонить заявку на право создавать проекты
const handleApproveAccessRequest = async (request: AccessRequestData) => {
  setAccessRequestBusy(request.id);
  try {
    await approveAccessRequest(request.id);
    setAccessRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status: 'APPROVED' } : r)),
    );
    setPendingByObject((prev) => {
      const next = { ...prev };
      if (next[request.objectId]) {
        next[request.objectId] = Math.max(0, next[request.objectId] - 1);
      }
      return next;
    });
    notify(
      `Доступ выдан: ${request.requester?.fullName ?? 'участник'} теперь может создавать проекты в объекте`,
    );
    // Обновляем список участников — появилась объектная запись
    if (accessObject) {
      loadAccessMembers(accessObject.id);
      // и карточка объекта: право на объект изменилось
      fetchObjects({ includeArchived: true }).then(setObjects).catch(() => undefined);
    }
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось одобрить заявку'));
  } finally {
    setAccessRequestBusy(null);
  }
};

const handleRejectAccessRequest = async (request: AccessRequestData) => {
  const ok = await confirm({
    title: 'Отклонить заявку?',
    text: `${request.requester?.fullName ?? 'Участник'} просит право создавать проекты в объекте.`,
    confirmText: 'Отклонить',
    danger: true,
  });
  if (!ok) return;
  setAccessRequestBusy(request.id);
  try {
    await rejectAccessRequest(request.id);
    setAccessRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status: 'REJECTED' } : r)),
    );
    setPendingByObject((prev) => {
      const next = { ...prev };
      if (next[request.objectId]) {
        next[request.objectId] = Math.max(0, next[request.objectId] - 1);
      }
      return next;
    });
    notify('Заявка отклонена');
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось отклонить заявку'));
  } finally {
    setAccessRequestBusy(null);
  }
};

// ⭐ №185: одна кнопка действий с объектом (модалка со крупными кнопками)
const handleOpenActions = (obj: ObjectData) => setActionsObject(obj);
const handleCloseActions = () => setActionsObject(null);

// ⭐ №175: шаблоны объектов — список, сохранение, создание объекта из шаблона
const loadTemplates = async (scope: 'mine' | 'all') => {
  setTemplatesLoading(true);
  try {
    setTemplates(await fetchObjectTemplates(scope));
  } catch (err: unknown) {
    setTemplates([]);
    notifyError(getApiErrorMessage(err, 'Не удалось загрузить шаблоны'));
  } finally {
    setTemplatesLoading(false);
  }
};

const handleOpenTemplates = () => {
  setTemplatesOpen(true);
  void loadTemplates(templateScope);
};

const handleOpenSaveTemplate = (obj: ObjectData) => {
  setSaveTemplateObject(obj);
  setSaveTemplateName(obj.name);
  setSaveTemplateNote(obj.note ?? '');
  setSaveTemplatePublic(false);
};

const handleSaveTemplate = async () => {
  if (!saveTemplateObject) return;
  setSaveTemplateSaving(true);
  try {
    const saved = await createObjectTemplate({
      objectId: saveTemplateObject.id,
      name: saveTemplateName.trim() || undefined,
      note: saveTemplateNote.trim() || undefined,
      isPublic: saveTemplatePublic,
    });
    notify(`Шаблон «${saved.name}» сохранён: проектов ${saved.projects.length}`);
    setSaveTemplateObject(null);
    if (templatesOpen) void loadTemplates(templateScope);
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось сохранить шаблон'));
  } finally {
    setSaveTemplateSaving(false);
  }
};

const handleOpenFromTemplate = (tpl: ObjectTemplateData) => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const inSixMonths = new Date(today);
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);
  setFromTemplate(tpl);
  setFromTplName(tpl.name);
  setFromTplAddress('');
  setFromTplStart(iso(today));
  setFromTplEnd(iso(inSixMonths));
};

const handleCreateFromTemplate = async () => {
  if (!fromTemplate) return;
  if (!fromTplName.trim() || !fromTplAddress.trim() || !fromTplStart || !fromTplEnd) {
    notify('Заполните название, адрес и даты', 'warning');
    return;
  }
  setFromTplSaving(true);
  try {
    const created = await createObjectFromTemplate(fromTemplate.id, {
      name: fromTplName.trim(),
      address: fromTplAddress.trim(),
      startDate: fromTplStart,
      endDate: fromTplEnd,
    });
    setObjects((prev) => [created, ...prev]);
    notify(`Объект «${created.name}» создан из шаблона`);
    setFromTemplate(null);
    setTemplatesOpen(false);
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось создать объект из шаблона'));
  } finally {
    setFromTplSaving(false);
  }
};

const handleTogglePublishTemplate = async (tpl: ObjectTemplateData) => {
  try {
    const updated = await updateObjectTemplate(tpl.id, { isPublic: !tpl.isPublic });
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, isPublic: updated.isPublic } : t)),
    );
    notify(updated.isPublic ? 'Шаблон теперь общий' : 'Шаблон снова личный');
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось изменить шаблон'));
  }
};

const handleDeleteTemplate = async (tpl: ObjectTemplateData) => {
  const ok = await confirm({
    title: 'Удалить шаблон?',
    text: `«${tpl.name}» будет удалён. Объекты, уже созданные из него, не пострадают.`,
    confirmText: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteObjectTemplate(tpl.id);
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    notify('Шаблон удалён');
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось удалить шаблон'));
  }
};

// ⭐ Название проекта по id — для бейджа области доступа
const projectScopeLabel = (projectId: number | null) => {
  if (!projectId) return 'весь объект';
  const project = accessProjects.find((p) => p.id === projectId);
  return project ? project.name : `проект #${projectId}`;
};

// ⭐ Закрыть модалку и сбросить форму
const handleCloseAccess = () => {
  setAccessModalOpen(false);
  setAccessObject(null);
  setAccessMembers([]);
  setAccessError('');
  setAccessRequests([]); // ⭐ №178
  setInviteIdentifier('');
  setInviteRole('FOREMAN');
  setInviteProjectId(''); // ⭐ №163
  setAccessProjects([]);
  setInviteTab('link');
  setLinkRole('FOREMAN');
  setInviteHidePrices(false);
  setLinkHidePrices(false);
  setCreatedLinkUrl(null);
  setActiveLinks([]);
  setLinkCopied(false);
};

// ⭐ Пригласить участника (определяем: это email или телефон)
const handleInvite = async () => {
  if (!token || !accessObject) return;
  const ident = inviteIdentifier.trim();
  if (!ident) {
    setAccessError('Укажите email или телефон');
    return;
  }
  setAccessLoading(true);
  setAccessError('');
  try {
    const isEmail = ident.includes('@');
    await addAccess(accessObject.id, {
      ...(isEmail ? { email: ident } : { phone: ident }),
      role: inviteRole,
      // ⭐ №163: '' = на весь объект, иначе — только на выбранный проект
      projectId: inviteProjectId === '' ? null : inviteProjectId,
      hidePrices: inviteHidePrices, // ⭐ №182
    });
    setInviteIdentifier('');
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка приглашения'));
  } finally {
    setAccessLoading(false);
  }
};

// ⭐ Сменить роль участника (только Администратор объекта)
const handleChangeRole = async (accessId: number, newRole: AccessRole) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await updateAccess(accessObject.id, accessId, { role: newRole });
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка смены роли'));
  }
};

// ⭐ №168/№193: отзыв доступа закрывает ЖИВОЙ доступ целиком (не «только чтение»),
// смета и справочник цен сохраняются в личных шаблонах человека (снимок на дату).
const handleRevokeAccess = async (member: AccessMember) => {
  if (!token || !accessObject) return;
  const who = member.user.fullName || member.user.email || member.user.phone || 'участника';
  const ok = await confirm({
    title: 'Отозвать доступ?',
    text: `Доступ для ${who} закроется: объект станет недоступен. Смета и справочник цен сохранятся в его личных шаблонах (снимок на дату отзыва), данные объекта останутся на месте.`,
    confirmText: 'Отозвать',
    danger: true,
  });
  if (!ok) return;
  setAccessError('');
  try {
    const res = await revokeAccess(accessObject.id, member.id);
    const copy = res.templates > 0
      ? ` Сохранено шаблонов: ${res.templates}${res.catalogCopied ? ' + справочник цен' : ''}.`
      : '';
    notify(`Доступ отозван.${copy}`, 'success');
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка отзыва доступа'));
  }
};

// ⭐ №168: вернуть доступ одним кликом (без повторного приглашения)
const handleRestoreAccess = async (accessId: number) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await restoreAccess(accessObject.id, accessId);
    notify('Доступ возвращён', 'success');
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка возврата доступа'));
  }
};

// ⭐ №168: удалить запись доступа навсегда
const handlePurgeAccess = async (member: AccessMember) => {
  if (!token || !accessObject) return;
  const who = member.user.fullName || member.user.email || member.user.phone || 'участника';
  const ok = await confirm({
    title: 'Удалить доступ навсегда?',
    text: `Запись доступа для ${who} будет удалена. Снимок его сметы останется в его шаблонах.`,
    confirmText: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  setAccessError('');
  try {
    await purgeAccess(accessObject.id, member.id);
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка удаления доступа'));
  }
};

// ⭐ №168: «управляет командой» — флаг прораба, выдаёт администратор объекта
const handleToggleManager = async (accessId: number, isManager: boolean) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await updateAccess(accessObject.id, accessId, { isManager });
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка смены прав'));
  }
};

// ⭐ №182: скрыть/показать цены участнику (делегирование прав)
const handleToggleHidePrices = async (accessId: number, hidePrices: boolean) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await updateAccess(accessObject.id, accessId, { hidePrices });
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка смены видимости цен'));
  }
};

// ============================================================
// ⭐ ПРИГЛАШЕНИЕ ПО ССЫЛКЕ (как в Google Docs / Notion)
// ============================================================

// Загрузить активные ссылки объекта
const loadInviteLinks = async (objectId: number) => {
  if (!token) return;
  try {
    const links = await fetchInviteLinks(objectId);
    setActiveLinks(links);
  } catch {
    // не критично — список ссылок просто не покажется
  }
};

// Создать ссылку-приглашение
const handleCreateLink = async () => {
  if (!token || !accessObject) return;
  setAccessLoading(true);
  setAccessError('');
  try {
    const link = await createInviteLink(accessObject.id, {
      role: linkRole,
      hidePrices: linkHidePrices,
    });
          // ⭐ Используем APP_URL из конфига (для Universal Links в будущем)
      setCreatedLinkUrl(`${APP_URL}/invite/${link.token}`);
    await loadInviteLinks(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка создания ссылки'));
  } finally {
    setAccessLoading(false);
  }
};

// Скопировать ссылку в буфер обмена
const handleCopyLink = async () => {
  if (!createdLinkUrl) return;
  try {
    await navigator.clipboard.writeText(createdLinkUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  } catch {
    setAccessError('Не удалось скопировать ссылку');
  }
};

// ⭐ Нативное «Поделиться» (на мобилке выедет системное меню: TG/WA/SMS)
const handleShareLink = async () => {
  if (!createdLinkUrl) return;
  try {
    if (navigator.share) {
      await navigator.share({
        title: `Приглашение в FRAME — ${accessObject?.name}`,
        text: `Вас приглашают в объект «${accessObject?.name}» в FRAME. Перейдите по ссылке:`,
        url: createdLinkUrl,
      });
    } else {
      // Десктоп без Web Share API → просто копируем
      await handleCopyLink();
    }
  } catch (err: unknown) {
    // Юзер отменил шеринг — это не ошибка
    if ((err as { name?: string })?.name !== 'AbortError') {
      await handleCopyLink();
    }
  }
};

// Отозвать ссылку-приглашение
const handleRevokeLink = async (linkId: number) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await revokeInviteLink(accessObject.id, linkId);
    await loadInviteLinks(accessObject.id);
    setCreatedLinkUrl(null);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка отзыва ссылки'));
  }
};

// ⭐ Подписи и цвета для ролей
const roleLabel = (role: AccessRole) => {
  switch (role) {
    case 'CUSTOMER': return '👑 Администратор объекта';
    case 'FOREMAN': return '👷 Прораб';
    case 'VIEWER': return '👁 Наблюдатель';
    default: return role;
  }
};
const roleColor = (role: AccessRole): 'primary' | 'success' | 'default' => {
  switch (role) {
    case 'CUSTOMER': return 'success';
    case 'FOREMAN': return 'primary';
    default: return 'default';
  }
};

// Обработчик открытия модалки для редактирования заметки
const handleOpenNoteModal = (obj: ObjectData) => {
  setEditingNoteObject(obj);
  setEditNote(obj.note || '');
  setNoteModalOpen(true);
};

const handleCloseNoteModal = () => {
  setNoteModalOpen(false);
  setEditingNoteObject(null);
  setEditNote('');
};

// Обработчик сохранения заметки
const handleSaveNote = async () => {
  if (!token || !editingNoteObject) return;
  
  try {
    const updated = await updateObject(Number(editingNoteObject.id), {
      note: editNote.trim() !== '' ? editNote.trim() : null,
    });
    // ⭐ №фикс: мержим только note, чтобы не сбросить progressPercent/totalCost
    setObjects(prev => prev.map(obj => obj.id === editingNoteObject.id ? { ...obj, note: updated.note } : obj));
    handleCloseNoteModal();
  } catch {
    notifyError('Ошибка обновления заметки');
  }
};

  // Функция для получения цвета текста дней
  const getDaysColor = (days: number) => {
    if (days < 0) return 'error'; // просрочено
    if (days < 7) return 'error';
    if (days < 15) return 'warning';
    return 'success';
  };
  // ⭐ trailing в useMemo — стабильная ссылка, нет бесконечного цикла (как в Materials)
  const headerTrailing = useMemo(() => isMobile ? (
    <>
      {/* ⭐ Архив в шапке (без подписи, как на десктопе): переключение Активные / Архив */}
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
title: showArchived ? 'Архив' : 'Объекты',
onBack: () => navigate('/'),
searchOpen: mobileSearchOpen,
searchValue: searchQuery,
searchPlaceholder: 'Поиск объектов...',
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
   <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
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

{/* Заголовок для десктопа + кнопка "в главное меню" */}
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
      Объекты
    </Typography>
    {/* ⭐ Кнопка «Архив» перенесена наверх (правая сторона заголовка раздела) */}
    <Button
      variant={showArchived ? 'contained' : 'outlined'}
      startIcon={showArchived ? <CheckCircleIcon /> : <ArchiveIcon />}
      onClick={() => setShowArchived(v => !v)}
      sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {showArchived ? 'Активные' : 'Архив'}
    </Button>
  </Box>
)}

  {/* ⭐ Переключатель Активные / Архив убран: архив теперь в шапке (иконка), Активные — вид по умолчанию */}

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
      {!showArchived && (
        <Button
          variant="outlined"
          startIcon={<BookmarkAddIcon />}
          onClick={handleOpenTemplates}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Из шаблона
        </Button>
      )}
      {!showArchived && (
        <Button
          variant="contained"
          startIcon={<AddHomeIcon />}
          onClick={handleOpenAddModal}
          sx={{
            bgcolor: '#4caf50',
            border: '2px solid #388e3c',
            '&:hover': { bgcolor: '#388e3c', borderColor: '#388e3c', transform: 'translateY(-3px)', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Добавить объект
        </Button>
      )}
    </Box>
  )}

  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

         {/* Список объектов – красивые карточки */}
      <Stack spacing={isMobile ? 1 : 2}>
        {filteredAndSortedObjects.length > 0 ? (
          filteredAndSortedObjects.map(obj => {
            const progress = obj.progressPercent ?? 0;
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
                {obj.isDemo && (
                  <Alert
                    severity="info"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mb: 1, borderRadius: 2 }}
                    action={
                      <Button
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDemo(obj);
                        }}
                      >
                        Удалить
                      </Button>
                    }
                  >
                    Это демо-данные.
                  </Alert>
                )}
                {obj.hiddenForMe && (
                  <Alert
                    severity="warning"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mb: 1, borderRadius: 2 }}
                    action={
                      <Button
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreObject(obj);
                        }}
                      >
                        Вернуть
                      </Button>
                    }
                  >
                    Объект в вашем архиве — виден только вам.
                  </Alert>
                )}
                {/* Верхняя строка: иконка, название (до 2 строк), кнопка действий */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                  <PlaceIcon sx={{ color: '#1976d2', mr: 1, fontSize: 28, mt: 0.25 }} />
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
                {obj.name}
              </Typography>
              {/* ⭐ №178: есть заявка на право создавать проекты */}
              {pendingByObject[obj.id] > 0 && (
                <Chip
                  size="small"
                  color="info"
                  label={`📨 ${pendingByObject[obj.id]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAccess(obj);
                  }}
                  sx={{ ml: 0.5, height: 22, fontSize: '0.72rem' }}
                />
              )}
                  {/* ⭐ №187: шестерёнка действий — в первой строке (на месте процента),
                      процент переехал к прогресс-бару */}
                  <IconButton
                    title="Действия с объектом"
                    aria-label="Действия с объектом"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenActions(obj);
                    }}
                    sx={{ bgcolor: 'action.hover', width: 44, height: 44, ml: 0.5, mt: -0.5 }}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Box>

                {/* ⭐ №187: прогресс-бар + процент в одной строке (шестерёнка ушла наверх) */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(progress, 100)}
                    sx={{
                      flexGrow: 1,
                      height: 10,
                      borderRadius: 5,
                      bgcolor: '#e0e0e0',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: progress >= 100 ? '#4caf50' : '#1976d2',
                        borderRadius: 5,
                      },
                    }}
                  />
                  <Chip
                    label={`${progress}%`}
                    size="small"
                    sx={{
                      bgcolor: progress >= 100 ? '#4caf50' : '#1976d2',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                </Box>

                {/* Адрес (⭐ №187: заметка теперь только в меню действий) */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: isMobile ? 1 : 2 }}>
                  {obj.address}
                </Typography>

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
      {isMobile && !showArchived && (
        <Fab
          color="primary"
          sx={{
            ...FAB_STYLE,
            bottom: 80,
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
            {/* ⭐ №164: справочник цен объекта — по умолчанию для всех проектов */}
            <FormControl fullWidth>
              <InputLabel id="object-catalog-label">Справочник цен объекта</InputLabel>
              <Select
                labelId="object-catalog-label"
                label="Справочник цен объекта"
                value={editCatalogId}
                onChange={(e) =>
                  setEditCatalogId(
                    e.target.value === 'new'
                      ? 'new'
                      : e.target.value === ''
                        ? ''
                        : Number(e.target.value),
                  )
                }
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {objectCatalogs.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                    {c.scope === 'object' ? ' (объект)' : ''}
                    {c.scope === 'project' ? ' (проект)' : ''}
                    {c.isSystem ? ' (демо)' : ''}
                  </MenuItem>
                ))}
                <MenuItem value="new">➕ Создать справочник объекта</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              Проекты без своего справочника берут расценки из справочника объекта.
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={handleCloseEdit}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleUpdateObject} disabled={catalogSaving}>
                {catalogSaving ? <CircularProgress size={18} /> : 'Сохранить'}
              </Button>
              <IconButton
                color="error"
                aria-label="Удалить объект"
                onClick={() => {
                  setDeletingObject(editingObject); // запоминаем объект для удаления
                  handleCloseEdit(); // закрываем модалку редактирования
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

      {/* Модалка заметки объекта */}
      <Modal open={noteModalOpen} onClose={handleCloseNoteModal}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 450 },
            maxWidth: 500,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Заметка к объекту "{editingNoteObject?.name}"
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Заметка"
              placeholder="Напишите заметку к объекту..."
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
            Убрать в архив
          </Typography>
          <Typography sx={{ mb: 3 }}>
            Объект <b>"{deletingObject?.name}"</b> будет скрыт только у вас. Остальные
            участники продолжат работу, данные не удаляются. Вернуть объект можно из
            раздела «Архив».
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
          В архив
        </Button>
      </Box>
    </Paper>
  </Modal>

    {/* ⭐ №185: действия с объектом — крупные кнопки (мобилка: шит снизу).
        Недоступные не прячем: показываем серыми, чтобы было видно, что функционал есть. */}
    <Modal open={!!actionsObject} onClose={handleCloseActions}>
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
          {actionsObject?.name || 'Объект'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Действия с объектом. Серые кнопки недоступны вашей роли.
        </Typography>
        {/* ⭐ №186: сразу видно, почему часть кнопок серая */}
        {act && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Вы: ${roleLabel(act.role as AccessRole)}`}
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={act.hasObjectAccess === false ? '📁 только проект' : '🏗 весь объект'}
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
            {act.note && (
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label="📝 есть заметка"
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
            )}
          </Box>
        )}

        <Stack spacing={1}>
          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<PeopleIcon />}
            disabled={!actCanInvite}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) handleOpenAccess(o);
            }}
          >
            Пригласить участника
          </Button>
          {!actCanInvite && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Нужны права на управление командой: администратор объекта или прораб-менеджер.
            </Typography>
          )}

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<BookmarkAddIcon />}
            disabled={!actCanTemplate}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) handleOpenSaveTemplate(o);
            }}
          >
            Сохранить как шаблон
          </Button>
          {!actCanTemplate && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Доступно только участнику всего объекта (не наблюдателю и не отозванному).
            </Typography>
          )}

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<EditIcon />}
            disabled={!actCanEdit}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) handleOpenEdit(o);
            }}
          >
            Редактировать объект
          </Button>
          {!actCanEdit && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Нужны права на запись и доступ на весь объект.
            </Typography>
          )}

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<NoteAltIcon />}
            disabled={!actCanEdit}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) handleOpenNoteModal(o);
            }}
          >
            Заметка к объекту
          </Button>

          <Button
            size="large"
            fullWidth
            variant="outlined"
            color="warning"
            startIcon={<ArchiveIcon />}
            disabled={!actCanArchive}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) {
                setDeletingObject(o);
                setDeleteConfirmOpen(true);
              }
            }}
          >
            Убрать в архив
          </Button>
          {!actCanArchive && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Объект уже в архиве — верните его кнопкой «Вернуть» на карточке.
            </Typography>
          )}

          <Button size="large" fullWidth onClick={handleCloseActions} sx={{ mt: 1 }}>
            Закрыть
          </Button>
        </Stack>
      </Paper>
    </Modal>

    {/* ⭐ №175: шаблоны объектов — список */}
    <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)}>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '94%', sm: 560 },
          maxHeight: '85vh',
          overflowY: 'auto',
          p: 3,
          borderRadius: 3,
          outline: 'none',
        }}
      >
        <Typography variant="h6" gutterBottom>
          📋 Шаблоны объектов
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Шаблон — снимок структуры объекта: проекты и позиции смет. Создание объекта из
          шаблона — разовая копия, дальше они живут независимо.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip
            label="Все доступные"
            color={templateScope === 'all' ? 'primary' : 'default'}
            onClick={() => {
              setTemplateScope('all');
              void loadTemplates('all');
            }}
          />
          <Chip
            label="Только мои"
            color={templateScope === 'mine' ? 'primary' : 'default'}
            onClick={() => {
              setTemplateScope('mine');
              void loadTemplates('mine');
            }}
          />
        </Stack>

        {templatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Alert severity="info">
            Пока нет шаблонов. Откройте объект и нажмите 🔖 «Сохранить как шаблон».
          </Alert>
        ) : (
          <Stack spacing={1}>
            {templates.map((tpl) => {
              const materialsCount = tpl.projects.reduce(
                (sum, p) => sum + (p._count?.materials ?? p.materials?.length ?? 0),
                0,
              );
              const isMine = tpl.authorId === myUserId;
              return (
                <Box key={tpl.id} sx={{ p: 1.5, bgcolor: '#f5f7fa', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {tpl.name}
                    {tpl.isPublic && (
                      <Chip
                        size="small"
                        label="общий"
                        color="success"
                        sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {tpl.projects.length} проект(ов) · {materialsCount} позиций
                    {tpl.sourceObjectName ? ` · из объекта «${tpl.sourceObjectName}»` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Автор: {tpl.author?.fullName || tpl.author?.email || '—'}
                    {' · '}
                    {new Date(tpl.updatedAt).toLocaleDateString('ru-RU')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button size="small" variant="contained" onClick={() => handleOpenFromTemplate(tpl)}>
                      Создать объект
                    </Button>
                    {isMine && (
                      <FormControlLabel
                        sx={{ mr: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={tpl.isPublic}
                            onChange={() => void handleTogglePublishTemplate(tpl)}
                          />
                        }
                        label={<Typography variant="caption">общий для всех</Typography>}
                      />
                    )}
                    {isMine && (
                      <IconButton size="small" onClick={() => void handleDeleteTemplate(tpl)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="outlined" onClick={() => setTemplatesOpen(false)}>
            Закрыть
          </Button>
        </Box>
      </Paper>
    </Modal>


    {/* ⭐ №175: создать объект из шаблона */}
    <Modal open={!!fromTemplate} onClose={() => setFromTemplate(null)} disableRestoreFocus>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '92%', sm: 480 },
          maxHeight: '88vh',
          overflowY: 'auto',
          p: 3,
          borderRadius: 3,
          outline: 'none',
        }}
      >
        <Typography variant="h6" gutterBottom>
          🏗 Объект из шаблона «{fromTemplate?.name}»
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Создастся объект с {fromTemplate?.projects.length ?? 0} проектом(ами) и позициями смет.
          Дальше объект живёт отдельно от шаблона — синхронизации нет.
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Название объекта"
            value={fromTplName}
            onChange={(e) => setFromTplName(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Адрес"
            value={fromTplAddress}
            onChange={(e) => setFromTplAddress(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Дата начала"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={fromTplStart}
            onChange={(e) => setFromTplStart(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Дата окончания"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={fromTplEnd}
            onChange={(e) => setFromTplEnd(e.target.value)}
            required
          />
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={() => setFromTemplate(null)}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={fromTplSaving}
            onClick={() => void handleCreateFromTemplate()}
          >
            Создать объект
          </Button>
        </Box>
      </Paper>
    </Modal>

    <Modal open={!!saveTemplateObject} onClose={() => setSaveTemplateObject(null)} disableRestoreFocus>
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
          🔖 Сохранить как шаблон
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Перенесутся проекты и позиции смет (наименования, объёмы по спецификации, цены).
          Фиксации и фактический расход — нет.
        </Typography>
        <TextField
          fullWidth
          label="Название шаблона"
          value={saveTemplateName}
          onChange={(e) => setSaveTemplateName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Описание (необязательно)"
          multiline
          rows={2}
          value={saveTemplateNote}
          onChange={(e) => setSaveTemplateNote(e.target.value)}
          sx={{ mb: 1 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={saveTemplatePublic}
              onChange={(e) => setSaveTemplatePublic(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Сделать общим (виден всем авторам)</Typography>}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={() => setSaveTemplateObject(null)}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={saveTemplateSaving}
            onClick={() => void handleSaveTemplate()}
          >
            Сохранить шаблон
          </Button>
        </Box>
      </Paper>
    </Modal>

    <Modal open={accessModalOpen} onClose={handleCloseAccess}>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '92%', sm: 520 },
          maxHeight: '85vh',
          overflowY: 'auto',
          p: 3,
          borderRadius: 3,
          outline: 'none',
        }}
      >
        <Typography variant="h6" gutterBottom>
          👥 Участники объекта «{accessObject?.name}»
        </Typography>

        {accessError && <Alert severity="error" sx={{ mb: 2 }}>{accessError}</Alert>}

        {/* ⭐ №178: заявки на право создавать проекты (менеджер объекта / админ) */}
        {accessRequests.filter((r) => r.status === 'PENDING').length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              📨 Заявки на право создавать проекты
            </Typography>
            {accessRequests
              .filter((r) => r.status === 'PENDING')
              .map((r) => (
                <Box
                  key={r.id}
                  sx={{ p: 1.5, mb: 1, bgcolor: 'rgba(25, 118, 210, 0.08)', borderRadius: 2 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.requester?.fullName || r.requester?.email || `Участник #${r.requesterId}`}
                  </Typography>
                  {r.comment && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      «{r.comment}»
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(r.createdAt).toLocaleString('ru-RU')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={accessRequestBusy === r.id}
                      onClick={() => void handleApproveAccessRequest(r)}
                    >
                      Одобрить
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={accessRequestBusy === r.id}
                      onClick={() => void handleRejectAccessRequest(r)}
                    >
                      Отклонить
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Одобрение даёт доступ ко всему объекту и право создавать проекты.
                  </Typography>
                </Box>
              ))}
          </Box>
        )}

        {accessLoading && accessMembers.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Список участников */}
            {accessMembers.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>Пока нет участников. Пригласите первого!</Alert>
            ) : (
              <Box sx={{ mb: 2 }}>
                {accessMembers.map((member) => (
                  <Box
                    key={member.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, mb: 1, bgcolor: '#f5f7fa', borderRadius: 2 }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {member.user.fullName || member.user.email || member.user.phone || 'Без имени'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {member.user.email || member.user.phone || ''}
                      </Typography>
                      {/* ⭐ №163: область доступа — весь объект или конкретный проект */}
                      <Chip
                        size="small"
                        variant={member.projectId ? 'filled' : 'outlined'}
                        color={member.projectId ? 'primary' : 'default'}
                        label={
                          member.projectId
                            ? `📁 ${projectScopeLabel(member.projectId)}`
                            : '🏗 весь объект'
                        }
                        sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                      />
                      {/* ⭐ №168: отозванный участник виден в команде, живой доступ закрыт (№193) */}
                      {member.revokedAt && (
                        <Chip
                          size="small"
                          color="error"
                          label="🔒 Доступ отозван"
                          sx={{ mt: 0.5, ml: 0.5, height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                      {member.hidePrices && !member.revokedAt && (
                        <Chip
                          size="small"
                          label="🙈 цены скрыты"
                          sx={{ mt: 0.5, ml: 0.5, height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>

                    {/* ⭐ №168: «управляет командой» — флаг прораба, выдаёт администратор объекта */}
                    {canManage && member.role === 'FOREMAN' && myRole === 'CUSTOMER' && !member.revokedAt && (
                      <FormControlLabel
                        sx={{ mr: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={member.isManager}
                            onChange={(e) => handleToggleManager(member.id, e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption">менеджер</Typography>}
                      />
                    )}

                    {/* ⭐ №182: видимость цен — отдельное право, не роль */}
                    {canManage && member.role !== 'VIEWER' && !member.revokedAt && (
                      <FormControlLabel
                        sx={{ mr: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={member.hidePrices}
                            onChange={(e) => handleToggleHidePrices(member.id, e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption">🙈 цены</Typography>}
                      />
                    )}

                    {canManage && !member.revokedAt ? (
                      <Select
                        size="small"
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as AccessRole)}
                        sx={{ minWidth: 130 }}
                      >
                        <MenuItem value="CUSTOMER">👑 Администратор объекта</MenuItem>
                        <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                        <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                      </Select>
                    ) : (
                      <Chip label={roleLabel(member.role)} size="small" color={roleColor(member.role)} />
                    )}

                    {canManage && (member.revokedAt ? (
                      <>
                        <IconButton size="small" color="primary" title="Вернуть доступ" onClick={() => handleRestoreAccess(member.id)}>
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" title="Удалить навсегда" onClick={() => handlePurgeAccess(member)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton size="small" color="warning" title="Отозвать доступ" onClick={() => handleRevokeAccess(member)}>
                        <LockIcon fontSize="small" />
                      </IconButton>
                    ))}
                  </Box>
                ))}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Форма приглашения */}
            {!canManage ? (
              <Alert severity="warning">Управлять участниками может администратор объекта или прораб-менеджер.</Alert>
            ) : (
              <>
                <Typography variant="subtitle1" gutterBottom>➕ Пригласить участника</Typography>

                {/* ⭐ Вкладки: ссылкой (главный способ) или напрямую */}
                <Tabs
                  value={inviteTab}
                  onChange={(_, v) => setInviteTab(v)}
                  sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab value="link" label="🔗 Ссылкой" />
                  <Tab value="direct" label="✉️ Email / телефон" />
                </Tabs>

                {inviteTab === 'link' ? (
                  /* ===== ВКЛАДКА: ПРИГЛАШЕНИЕ ССЫЛКОЙ ===== */
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="link-role-label">Кого приглашаем</InputLabel>
                      <Select
                        labelId="link-role-label"
                        value={linkRole}
                        label="Кого приглашаем"
                        onChange={(e) => setLinkRole(e.target.value as AccessRole)}
                      >
                        <MenuItem value="CUSTOMER">👑 Администратор объекта</MenuItem>
                        <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                        <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                      </Select>
                    </FormControl>

                    {/* ⭐ Флаг «скрыть цены» — для субподрядчиков */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={linkHidePrices}
                          onChange={(e) => setLinkHidePrices(e.target.checked)}
                        />
                      }
                      label="🙈 Скрыть цены для приглашённых"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                      {linkHidePrices
                        ? 'Участник сможет вносить работы и объёмы, но не увидит цены — идеально для субподрядчиков.'
                        : 'Участник будет видеть все цены и суммы объекта.'}
                    </Typography>

                    {createdLinkUrl ? (
                      /* Ссылка создана — показываем её с кнопками */
                      <Box sx={{ p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #90caf9' }}>
                        <Typography variant="caption" color="text.secondary">
                          ✅ Ссылка готова! Отправьте её участнику:
                        </Typography>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all', my: 1, fontWeight: 600 }}>
                          {createdLinkUrl}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button size="small" variant="contained" startIcon={<ShareIcon />} onClick={handleShareLink}>
                            Поделиться
                          </Button>
                          <Button size="small" variant="outlined" startIcon={linkCopied ? undefined : <ContentCopyIcon />} onClick={handleCopyLink}>
                            {linkCopied ? '✓ Скопировано' : 'Копировать'}
                          </Button>
                          <Button size="small" color="error" onClick={() => setCreatedLinkUrl(null)}>
                            Создать новую
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Button
                        variant="contained"
                        startIcon={<LinkIcon />}
                        onClick={handleCreateLink}
                        disabled={accessLoading}
                      >
                        Создать ссылку-приглашение
                      </Button>
                    )}

                    {/* Список активных ссылок */}
                    {activeLinks.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Активные ссылки ({activeLinks.length}):
                        </Typography>
                        {activeLinks.map((link) => (
                          <Box key={link.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <LinkIcon fontSize="small" sx={{ color: '#90a4ae' }} />
                            <Typography variant="caption" sx={{ flexGrow: 1 }} noWrap>
                              {roleLabel(link.role)}
                              {link.hidePrices ? ' • 🙈 без цен' : ''} • использований: {link.usesCount}
                              {link.maxUses ? `/${link.maxUses}` : ''}
                            </Typography>
                            <IconButton size="small" color="error" onClick={() => handleRevokeLink(link.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Stack>
                ) : (
                  /* ===== ВКЛАДКА: ПРИГЛАШЕНИЕ ПО EMAIL/ТЕЛЕФОНУ ===== */
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Email или телефон"
                      placeholder="email@example.com или +79990000000"
                      value={inviteIdentifier}
                      onChange={(e) => setInviteIdentifier(e.target.value)}
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel id="invite-role-label">Роль</InputLabel>
                      <Select
                        labelId="invite-role-label"
                        value={inviteRole}
                        label="Роль"
                        onChange={(e) => setInviteRole(e.target.value as AccessRole)}
                      >
                        <MenuItem value="CUSTOMER">👑 Администратор объекта</MenuItem>
                        <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                        <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                      {inviteRole === 'CUSTOMER' && '👑 Администратор объекта: видит все цены, управляет командой и настройками.'}
                      {inviteRole === 'FOREMAN' && '👷 Прораб: ведёт работы и фиксирует объёмы. Его изменения видны в смете и отчётах.'}
                      {inviteRole === 'VIEWER' && '👁 Наблюдатель: видит прогресс и объёмы, но без денег. Не может приглашать.'}
                    </Typography>
                    {/* ⭐ №163: область доступа — весь объект или только один проект */}
                    <FormControl fullWidth size="small">
                      <InputLabel id="invite-scope-label">Доступ</InputLabel>
                      <Select
                        labelId="invite-scope-label"
                        value={inviteProjectId}
                        label="Доступ"
                        onChange={(e) =>
                          setInviteProjectId(
                            e.target.value === '' ? '' : Number(e.target.value),
                          )
                        }
                      >
                        <MenuItem value="">🏗 Весь объект (все проекты)</MenuItem>
                        {accessProjects.map((project) => (
                          <MenuItem key={project.id} value={project.id}>
                            📁 Только «{project.name}»
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                      {inviteProjectId === ''
                        ? 'Участник увидит все проекты объекта, включая созданные позже.'
                        : 'Участник увидит только выбранный проект. Остальные проекты объекта ему недоступны.'}
                    </Typography>
                    {/* ⭐ №182: видимость цен — отдельное право (как в приглашении ссылкой) */}
                    {inviteRole !== 'VIEWER' && (
                      <>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={inviteHidePrices}
                              onChange={(e) => setInviteHidePrices(e.target.checked)}
                            />
                          }
                          label="🙈 Скрыть цены для этого участника"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                          {inviteHidePrices
                            ? 'Участник сможет вносить работы и объёмы, но не увидит цены и суммы.'
                            : 'Участник будет видеть цены и суммы объекта.'}
                        </Typography>
                      </>
                    )}
                    <Button
                      variant="contained"
                      onClick={handleInvite}
                      disabled={accessLoading || !inviteIdentifier.trim()}
                    >
                      Пригласить
                    </Button>
                  </Stack>
                )}

                {/* Кнопка закрытия — общая для обеих вкладок */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button variant="outlined" onClick={handleCloseAccess}>Закрыть</Button>
                </Box>
              </>
            )}
          </>
        )}
      </Paper>
    </Modal>
  </Box>
);
};

export default Objects;