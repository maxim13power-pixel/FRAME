import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import AddHomeIcon from '@mui/icons-material/AddHome';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import { fetchObjects, createObject, previewObjectCopy, copyObject } from '../services/objectService';
import type { ObjectData, ObjectCopyPreview, ObjectCopyPayload } from '../services/objectService';
import { fetchProjectsByObject } from '../services/projectService'; // ⭐ №163
import type { ProjectData } from '../services/projectService'; // ⭐ №163
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
// ⭐ №305: свежие данные при возврате в окно (без F5)
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import SectionIntro from '../components/SectionIntro'; // ⭐ №197: подсказки разделов
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import { fetchAccessList, updateAccess, removeAccess, removeAccessScope, setMyAccessHidden, addAccess, fetchAccessCandidates } from '../services/accessService';
import type { AccessCandidate } from '../services/accessService';
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
import { updateObject, deleteObjectPermanently } from '../services/objectService';
import { fetchPriceCatalogs } from '../services/priceListService'; // ⭐ №164
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

/**
 * ⭐ №246: сколько дней осталось до безвозвратного удаления объекта.
 * 0 — сегодня/просрочено (purge уже мог сработать).
 */
const deletionDaysLeft = (iso: string): number =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** «сегодня» / «через 29 дн.» */
const deletionPhrase = (iso: string): string => {
  const days = deletionDaysLeft(iso);
  return days <= 0 ? 'сегодня' : `через ${days} дн.`;
};

/**
 * ⭐ №265: PATCH объекта возвращает «сырую» запись без вычисляемых полей
 * (progressPercent/projectsCount/права). Сохраняем их из карточки, иначе
 * после переименования прогресс падает в 0 до перезагрузки.
 */
const mergeObjectUpdate = (
  prev: ObjectData,
  updated: ObjectData,
): ObjectData => ({
  ...prev,
  ...updated,
  progressPercent: updated.progressPercent ?? prev.progressPercent,
  totalCost: updated.totalCost ?? prev.totalCost,
  projectsCount: updated.projectsCount ?? prev.projectsCount,
  role: updated.role ?? prev.role,
  hidePrices: updated.hidePrices ?? prev.hidePrices,
  hasObjectAccess: updated.hasObjectAccess ?? prev.hasObjectAccess,
  accessId: updated.accessId ?? prev.accessId,
  hiddenForMe: updated.hiddenForMe ?? prev.hiddenForMe,
  canWrite: updated.canWrite ?? prev.canWrite,
  canManage: updated.canManage ?? prev.canManage,
  canCreateProjects: updated.canCreateProjects ?? prev.canCreateProjects,
  participantsCount: updated.participantsCount ?? prev.participantsCount,
});

const Objects: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth(); // получаем токен из контекста
  const { notify, error: notifyError, confirm } = useFeedback();
  const navigate = useNavigate();
const goBack = useBackNavigation('/');
  const location = useLocation();
  // ⭐ №207: переход «Участники объекта» из карточки проекта
  const openAccessFromState = (
    location.state as { openAccessObjectId?: number } | null
  )?.openAccessObjectId;
  const openAccessHandledRef = useRef<number | null>(null);
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
  // ⭐ №164: справочники для выбора справочника объекта
  const [objectCatalogs, setObjectCatalogs] = useState<PriceCatalogData[]>([]);
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
// ⭐ Форма приглашения — только ссылкой (⭐ №303: email/телефон убраны из UI)
const [accessProjects, setAccessProjects] = useState<ProjectData[]>([]);
// ⭐ №197: «Команда проекта» — фильтр участников по области доступа
const [memberScopeFilter, setMemberScopeFilter] = useState<'all' | 'object' | number>('all');
// ⭐ №346: список участников — в свёрнутой по умолчанию панели (чтобы модалка была короткой)
const [membersExpanded, setMembersExpanded] = useState(false);
// ⭐ Приглашение по ссылке (как в Google Docs)
const [linkRole, setLinkRole] = useState<AccessRole>('FOREMAN');
const [linkHidePrices, setLinkHidePrices] = useState(false);
// ⭐ №303: «разрешить создавать проекты» теперь можно выдать и по ссылке
const [linkCanCreateProjects, setLinkCanCreateProjects] = useState(false);
const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
// ⭐ №345: показываем, до какого момента действует созданная ссылка (по умолчанию 2 часа)
const [createdLinkExpiresAt, setCreatedLinkExpiresAt] = useState<string | null>(null);
const [activeLinks, setActiveLinks] = useState<InviteLink[]>([]);
const [linkCopied, setLinkCopied] = useState(false);
// ⭐ №350: прямой выбор участника из команды моих объектов (без ссылки)
const [candidatesOpen, setCandidatesOpen] = useState(false);
const [candidates, setCandidates] = useState<AccessCandidate[]>([]);
const [candidatesLoading, setCandidatesLoading] = useState(false);
const [candidatesError, setCandidatesError] = useState('');
const [candidatesQuery, setCandidatesQuery] = useState('');
const [candidateBusyId, setCandidateBusyId] = useState<number | null>(null);
// ⭐ №178: заявки на право создавать проекты (входящие — для менеджера/админа)
const [accessRequests, setAccessRequests] = useState<AccessRequestData[]>([]);
const [accessRequestBusy, setAccessRequestBusy] = useState<number | null>(null);
const [pendingByObject, setPendingByObject] = useState<Record<number, number>>({});
// ⭐ Копирование объекта (вместо шаблонов): подтверждение → форма с проектами,
// фактом и ценами. Старый объект не меняется.
const [copySource, setCopySource] = useState<ObjectData | null>(null);
const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
const [copyFormOpen, setCopyFormOpen] = useState(false);
const [copyProjects, setCopyProjects] = useState<ProjectData[]>([]);
const [copyProjectsLoading, setCopyProjectsLoading] = useState(false);
const [copyProjectsLoaded, setCopyProjectsLoaded] = useState(false);
const [copyProjectIds, setCopyProjectIds] = useState<number[]>([]);
const [copyName, setCopyName] = useState('');
const [copyAddress, setCopyAddress] = useState('');
const [copyStartDate, setCopyStartDate] = useState('');
const [copyEndDate, setCopyEndDate] = useState('');
const [copyNote, setCopyNote] = useState('');
const [copyFacts, setCopyFacts] = useState(false);
const [copyPricingMode, setCopyPricingMode] =
  useState<ObjectCopyPayload['pricingMode']>('keep');
const [copyCatalogId, setCopyCatalogId] = useState<number | ''>('');
const [copySourceCatalogId, setCopySourceCatalogId] = useState<number | ''>('');
const [copyCatalogName, setCopyCatalogName] = useState('');
const [copyWorkMarkup, setCopyWorkMarkup] = useState('0');
const [copyMaterialMarkup, setCopyMaterialMarkup] = useState('0');
const [copyStrict, setCopyStrict] = useState(true);
const [copyPreview, setCopyPreview] = useState<ObjectCopyPreview | null>(null);
const [copyPreviewLoading, setCopyPreviewLoading] = useState(false);
const [copyPreviewError, setCopyPreviewError] = useState('');
const [copySaving, setCopySaving] = useState(false);

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

  // ⭐ №285: в архиве создание недоступно (кнопка/фаб серые) — страхуем и сам обработчик
  const handleOpenAddModal = () => {
    if (showArchived) return;
    setAddModalOpen(true);
  };
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
    const updated = await updateObject(Number(editingObject.id), {
      name: editName,
      address: editAddress,
      startDate: editStartDate,
      endDate: editEndDate,
    });
    setObjects(prev => prev.map(obj => obj.id === updated.id ? mergeObjectUpdate(obj, updated) : obj));
    handleCloseEdit();
    void refreshObjects();
  } catch (err) {
    notifyError(getApiErrorText(err, 'Ошибка обновления'));
  }
};

const refreshObjects = async () => {
  try {
    setObjects(await fetchObjects({ includeArchived: true }));
  } catch {
    // список обновится при следующем входе — не роняем страницу
  }
};

// ⭐ №305: прогресс объектов подтягиваем при возврате в окно — фиксации
// и новые проекты второго участника видны без перезагрузки страницы.
useRefreshOnFocus(() => void refreshObjects(), { minIntervalMs: 10_000 });

// ⭐ №284: «Убрать в архив» — только скрыть объект у себя. Удаление больше НЕ назначается:
// раньше после «В архив» сразу выскакивал второй диалог «Удалить безвозвратно?».
const handleArchiveObject = async (obj: ObjectData) => {
  if (!obj.accessId) return;
  try {
    await setMyAccessHidden(obj.accessId, true);
    await refreshObjects();
    notify(`Объект «${obj.name}» убран в архив`);
  } catch (err) {
    notifyError(getApiErrorMessage(err, 'Не удалось убрать объект в архив'));
  }
};

// ⭐ №284: удаление СРАЗУ, без 30-дневного ожидания. Юзер сам решает, когда чистить —
// объект не висит месяц в архиве (и не занимает место в тарифе). Копии участникам делает бэк.
const handlePurgeObject = async (obj: ObjectData) => {
  const ok = await confirm({
    title: 'Удалить объект окончательно?',
    text: obj.isDemo
      ? `Демо-объект «${obj.name}» и все его данные удалятся сразу и безвозвратно — отменить это нельзя.`
      : `«${obj.name}» и все его данные (проекты, сметы, фиксации, склад, бригады, отчёты) удалятся сразу и безвозвратно — отменить это нельзя. Остальные участники получат личные копии объекта, но без фото.`,
    confirmText: 'Удалить окончательно',
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteObjectPermanently(obj.id);
    await refreshObjects();
    notify(`Объект «${obj.name}» удалён окончательно`);
  } catch (err) {
    notifyError(getApiErrorMessage(err, 'Не удалось удалить объект'));
  }
};

const handleDeleteObject = async () => {
  if (!deletingObject) return;
  const target = deletingObject;
  setDeleteConfirmOpen(false);
  setDeletingObject(null); // очищаем
  await handleArchiveObject(target);
};

// ⭐ Вернуть объект из личного архива (бэкенд заодно снимает мой срок удаления)
const handleRestoreObject = async (obj: ObjectData) => {
  if (!token || !obj.accessId) return;
  try {
    await setMyAccessHidden(obj.accessId, false);
    await refreshObjects();
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
const actCanCopy = !!act && actHasObject && act.canWrite === true && act.hidePrices !== true && act.role !== 'VIEWER';
const actCanEdit = !!act && actHasObject && act.canWrite === true;
const actCanArchive = !!act && act.accessId != null && act.hiddenForMe !== true;
// ⭐ №284: окончательное удаление — только администратор объекта (как и на бэке)
const actCanPurge = !!act && actHasObject && act.canManage === true;

// ⭐ №197: «Команда проекта» — отдельные участники проекта vs участники всего объекта.
// Участник всего объекта видит все проекты, поэтому в команду проекта он входит неявно.
const objectWideMembers = accessMembers.filter((m) => m.projectId == null);
// ⭐ №308: в пояснениях считаем только ЖИВЫЕ записи — отозванный доступ живых данных
// не видит, поэтому «видят проект» про него говорить нельзя (в списке он остаётся
// с плашкой «Доступ отозван»).
const objectWideActiveCount = objectWideMembers.filter((m) => !m.revokedAt).length;
// ⭐ №341: один человек = одна карточка в списке (у него может быть несколько записей)
const uniquePeople = (rows: AccessMember[]) => new Set(rows.map((m) => m.userId)).size;
const allPeopleCount = uniquePeople(accessMembers);
const objectPeopleActiveCount = uniquePeople(
  objectWideMembers.filter((m) => !m.revokedAt),
);
const scopedAccessMembers =
  memberScopeFilter === 'all'
    ? accessMembers
    : memberScopeFilter === 'object'
      ? objectWideMembers
      : accessMembers.filter((m) => m.projectId === memberScopeFilter);
const scopedProject =
  typeof memberScopeFilter === 'number'
    ? accessProjects.find((p) => p.id === memberScopeFilter) ?? null
    : null;
// ⭐ №341: группируем записи по человеку — иначе один человек занимает N строк
const groupedAccessMembers = (() => {
  const map = new Map<number, AccessMember[]>();
  for (const m of scopedAccessMembers) {
    const list = map.get(m.userId) ?? [];
    list.push(m);
    map.set(m.userId, list);
  }
  return [...map.entries()].map(([userId, grants]) => ({
    userId,
    grants: grants.sort((a, b) => (a.projectId == null ? -1 : 0) - (b.projectId == null ? -1 : 0)),
  }));
})();
const projectMemberCount = (projectId: number) =>
  uniquePeople(accessMembers.filter((m) => m.projectId === projectId));

// ⭐ Загрузить список участников
const loadAccessMembers = async (objectId: number) => {
  if (!token) return;
  setAccessLoading(true);
  setAccessError('');
  try {
    const members = await fetchAccessList(objectId);
    setAccessMembers(members);
    // ⭐ №207: держим счётчик у кнопки «Участники» в актуальном состоянии
    const uniqueUsers = new Set(members.filter((m) => !m.revokedAt).map((m) => m.userId)).size;
    setObjects((prev) =>
      prev.map((o) => (o.id === objectId ? { ...o, participantsCount: uniqueUsers } : o)),
    );
    setAccessObject((prev) =>
      prev && prev.id === objectId ? { ...prev, participantsCount: uniqueUsers } : prev,
    );
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

// ⭐ №207: «Участники объекта» из карточки проекта (Projects → Objects).
// Открываем модалку один раз и сразу чистим state, чтобы возврат назад её не повторял.
useEffect(() => {
  if (!openAccessFromState || objects.length === 0) return;
  if (openAccessHandledRef.current === openAccessFromState) return;
  openAccessHandledRef.current = openAccessFromState;
  const target = objects.find((o) => o.id === openAccessFromState);
  navigate('/objects', { replace: true, state: null });
  if (target && target.canManage) handleOpenAccess(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [openAccessFromState, objects]);

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

// ⭐ Копирование объекта: подтверждение → форма. Старый объект не меняется.
const nextCopyName = (sourceName: string) => {
  const base = `${sourceName} (копия)`;
  if (!objects.some((o) => o.name === base)) return base;
  for (let i = 2; i <= 99; i += 1) {
    const candidate = `${sourceName} (копия ${i})`;
    if (!objects.some((o) => o.name === candidate)) return candidate;
  }
  return `${sourceName} (копия ${Date.now()})`;
};

const buildCopyPayload = (): ObjectCopyPayload => ({
  name: copyName.trim(),
  address: copyAddress.trim(),
  startDate: copyStartDate,
  endDate: copyEndDate,
  note: copyNote.trim() || undefined,
  projectIds: copyProjectIds,
  copyFacts,
  pricingMode: copyPricingMode,
  ...(copyPricingMode === 'existing' && copyCatalogId !== ''
    ? { catalogId: Number(copyCatalogId) }
    : {}),
  ...(copyPricingMode === 'copy'
    ? {
        ...(copySourceCatalogId !== ''
          ? { sourceCatalogId: Number(copySourceCatalogId) }
          : {}),
        catalogName: copyCatalogName.trim() || undefined,
        workMarkupPercent: Number(copyWorkMarkup) || 0,
        materialMarkupPercent: Number(copyMaterialMarkup) || 0,
      }
    : {}),
  strictMatch: copyStrict,
});

const handleOpenCopy = (obj: ObjectData) => {
  setCopySource(obj);
  setCopyConfirmOpen(true);
};

const handleCloseCopy = () => {
  setCopyConfirmOpen(false);
  setCopyFormOpen(false);
  setCopySource(null);
  setCopyPreview(null);
  setCopyPreviewError('');
  setCopyProjectsLoading(false);
  setCopyProjectsLoaded(false);
};

const handleProceedCopy = async () => {
  const src = copySource;
  if (!src) return;
  setCopyConfirmOpen(false);
  setCopyFormOpen(true);
  setCopyName(nextCopyName(src.name));
  setCopyAddress(src.address);
  setCopyStartDate(src.startDate.slice(0, 10));
  setCopyEndDate(src.endDate.slice(0, 10));
  setCopyNote(src.note ?? '');
  setCopyFacts(false);
  setCopyPricingMode('keep');
  setCopyCatalogId(objectCatalogs[0]?.id ?? '');
  setCopySourceCatalogId(src.catalogId ?? '');
  setCopyCatalogName(`Копия «${src.catalog?.name ?? 'справочник'}»`);
  setCopyWorkMarkup('0');
  setCopyMaterialMarkup('0');
  setCopyStrict(true);
  setCopyPreview(null);
  setCopyPreviewError('');
  setCopyProjects([]);
  setCopyProjectIds([]);
  setCopyProjectsLoaded(false);
  setCopyProjectsLoading(true);
  try {
    const projects = await fetchProjectsByObject(src.id);
    setCopyProjects(projects);
    setCopyProjectIds(projects.map((p) => p.id));
    setCopyProjectsLoaded(true);
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось загрузить проекты'));
  } finally {
    setCopyProjectsLoading(false);
  }
};

// Предпросмотр соответствия и изменений цен. Для режима «как в оригинале»
// пересчёта нет — превью не нужно.
useEffect(() => {
  if (!copyFormOpen || !copySource || copyPricingMode === 'keep') {
    setCopyPreview(null);
    setCopyPreviewError('');
    setCopyPreviewLoading(false);
    return;
  }
  let cancelled = false;
  const timer = setTimeout(() => {
    setCopyPreviewLoading(true);
    setCopyPreviewError('');
    previewObjectCopy(copySource.id, buildCopyPayload())
      .then((data) => {
        if (!cancelled) setCopyPreview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCopyPreview(null);
          setCopyPreviewError(
            getApiErrorMessage(err, 'Не удалось проверить справочник'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCopyPreviewLoading(false);
      });
  }, 450);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  copyFormOpen,
  copySource,
  copyPricingMode,
  copyCatalogId,
  copySourceCatalogId,
  copyWorkMarkup,
  copyMaterialMarkup,
  copyProjectIds,
  copyStrict,
]);

const handleCopyObject = async () => {
  if (!copySource) return;
  if (copyProjectsLoading || !copyProjectsLoaded) {
    notify('Дождитесь загрузки проектов', 'warning');
    return;
  }
  if (!copyName.trim() || !copyAddress.trim() || !copyStartDate || !copyEndDate) {
    notify('Заполните название, адрес и даты', 'warning');
    return;
  }
  if (copyProjects.length > 0 && copyProjectIds.length === 0) {
    notify('Выберите хотя бы один проект', 'warning');
    return;
  }
  if (new Date(copyEndDate) < new Date(copyStartDate)) {
    notify('Дата окончания не может быть раньше даты начала', 'warning');
    return;
  }
  if (copyPricingMode === 'existing' && copyCatalogId === '') {
    notify('Выберите справочник для пересчёта', 'warning');
    return;
  }
  if (copyPricingMode === 'copy' && copySourceCatalogId === '') {
    notify('Выберите исходный справочник для копии', 'warning');
    return;
  }
  if (
    copyPricingMode !== 'keep' &&
    copyStrict &&
    copyPreview &&
    copyPreview.summary.unmatchedRows > 0
  ) {
    notify(
      `Не все позиции сопоставлены: ${copyPreview.summary.unmatchedRows} из ${copyPreview.summary.rows}. Снимите строгий режим или поправьте справочник.`,
      'warning',
    );
    return;
  }
  setCopySaving(true);
  try {
    const created = await copyObject(copySource.id, buildCopyPayload());
    setObjects((prev) => [created, ...prev]);
    setShowArchived(false);
    const stats = created.copyStats;
    const facts = stats?.factsCopied ? ' · факт перенесён' : '';
    const prices =
      stats?.pricingMode === 'keep'
        ? ' · цены как в оригинале'
        : ` · цены по справочнику «${stats?.catalogName ?? '—'}»`;
    notify(`Копия «${created.name}» создана: проектов ${stats?.projects ?? 0}, позиций ${stats?.materials ?? 0}${facts}${prices}`, 'success');
    handleCloseCopy();
  } catch (err: unknown) {
    notifyError(getApiErrorMessage(err, 'Не удалось скопировать объект'));
  } finally {
    setCopySaving(false);
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
  setAccessProjects([]);
  setMemberScopeFilter('all'); // ⭐ №197
  setLinkRole('FOREMAN');
  setLinkHidePrices(false);
  setLinkCanCreateProjects(false);
  setCreatedLinkUrl(null);
  setCreatedLinkExpiresAt(null);
  setActiveLinks([]);
  setLinkCopied(false);
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

// ⭐ №207: «Удалить участника» — единственное действие. Бэкенд перед удалением
// снимает личные копии (шаблоны смет + снимок доступа), поэтому наработка человека
// не пропадает: он останется с ней даже без доступа к объекту.
const handleRemoveAccess = async (member: AccessMember) => {
  if (!token || !accessObject) return;
  const who = member.user.fullName || member.user.email || member.user.phone || 'участника';
  const ok = await confirm({
    title: 'Удалить участника?',
    text: `Доступ для ${who} будет удалён без возможности восстановления: объект и его проекты станут недоступны. Перед удалением FRAME сохранит ему личную копию сметы и справочника цен — эти данные останутся в его шаблонах. Чтобы вернуть человека, его нужно пригласить заново.`,
    confirmText: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  setAccessError('');
  setAccessLoading(true);
  try {
    const res = await removeAccess(accessObject.id, member.id);
    const copy = res.templates > 0
      ? ` Сохранено шаблонов: ${res.templates}${res.catalogCopied ? ' + справочник цен' : ''}.`
      : '';
    notify(`Участник удалён.${copy}`, 'success');
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка удаления участника'));
  } finally {
    setAccessLoading(false);
  }
};

// ⭐ №341: убрать доступ только к одному проекту (человек остаётся в остальных)
const handleRemoveAccessScope = async (member: AccessMember) => {
  if (!token || !accessObject) return;
  const who = member.user.fullName || member.user.email || member.user.phone || 'участника';
  const project = member.projectId ? projectScopeLabel(member.projectId) : 'проект';
  const ok = await confirm({
    title: 'Убрать доступ к проекту?',
    text: `${who} больше не будет видеть проект «${project}». Остальные доступы и данные сохранятся.`,
    confirmText: 'Убрать',
  });
  if (!ok) return;
  setAccessError('');
  setAccessLoading(true);
  try {
    await removeAccessScope(accessObject.id, member.id);
    notify('Доступ к проекту убран', 'success');
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка удаления доступа'));
  } finally {
    setAccessLoading(false);
  }
};

// ⭐ №207: «может создавать проекты» — право прораба, выдаётся администратором объекта
const handleToggleCreateProjects = async (accessId: number, canCreateProjects: boolean) => {
  if (!token || !accessObject) return;
  setAccessError('');
  try {
    await updateAccess(accessObject.id, accessId, { canCreateProjects });
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setAccessError(getApiErrorMessage(err, 'Ошибка смены прав'));
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
      // ⭐ №303: право создания проектов — только для прораба (бэкенд нормализует и проверит права)
      canCreateProjects: linkRole === 'FOREMAN' ? linkCanCreateProjects : false,
    });
          // ⭐ Используем APP_URL из конфига (для Universal Links в будущем)
      setCreatedLinkUrl(`${APP_URL}/invite/${link.token}`);
      setCreatedLinkExpiresAt(link.expiresAt ?? null);
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

// ⭐ №350: список людей из команды моих объектов — добавляем напрямую, без ссылки
const openCandidates = async () => {
  if (!token || !accessObject) return;
  setCandidatesOpen(true);
  setCandidatesLoading(true);
  setCandidatesError('');
  setCandidatesQuery('');
  try {
    setCandidates(await fetchAccessCandidates(accessObject.id));
  } catch (err: unknown) {
    setCandidates([]);
    setCandidatesError(getApiErrorMessage(err, 'Не удалось загрузить список участников'));
  } finally {
    setCandidatesLoading(false);
  }
};

const handleAddCandidate = async (candidate: AccessCandidate) => {
  if (!token || !accessObject) return;
  setCandidateBusyId(candidate.userId);
  setCandidatesError('');
  try {
    await addAccess(accessObject.id, {
      userId: candidate.userId,
      role: linkRole,
      hidePrices: linkHidePrices,
      canCreateProjects: linkRole === 'FOREMAN' ? linkCanCreateProjects : false,
    });
    notify(
      `Добавлен: ${candidate.fullName || candidate.email || candidate.phone || 'участник'}`,
      'success',
    );
    setCandidates((prev) =>
      prev.map((c) =>
        c.userId === candidate.userId
          ? { ...c, inObject: true, roleInObject: linkRole }
          : c,
      ),
    );
    await loadAccessMembers(accessObject.id);
  } catch (err: unknown) {
    setCandidatesError(getApiErrorMessage(err, 'Не удалось добавить участника'));
  } finally {
    setCandidateBusyId(null);
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

// ⭐ №345: ссылка живёт 2 часа — показываем дату И время, иначе «до 20.11.2026» врёт
const formatLinkExpiry = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ⭐ №349: в списке активных ссылок достаточно времени («до 10:54») — срок всего 2 часа
const formatLinkExpiryTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

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
onBack: goBack,
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
      onClick={goBack}
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

  {/* ⭐ №197: одноразовая подсказка раздела (закрывается крестиком) */}
  <SectionIntro id="objects" version={1}>
    <b>Объект</b> — ваша стройка. Внутри — проекты со сметами. Нажмите на карточку, чтобы открыть
    проекты; шестерёнка ⚙ — команда, копия, архив и правка. «Архив» справа в шапке — личный,
    остальные участники его не видят.
  </SectionIntro>

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
      <FormControl size="small" sx={{ minWidth: 150, flexShrink: 0 }}>
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
      {/* ⭐ №285: в архиве создавать нельзя — кнопка серая, а не пропадает из тулбара */}
      <Button
        variant="contained"
        startIcon={<AddHomeIcon />}
        onClick={handleOpenAddModal}
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
        Добавить объект
      </Button>
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
   onClick={obj.hiddenForMe ? undefined : () => {
     navigate(`/objects/${obj.id}/projects`);
   }}
   elevation={2}
   sx={{
     p: isMobile ? 1.5 : 3,
     borderRadius: 3,
     // ⭐ №246: объект в личном архиве не открывается — проектов у него нет,
     // клик и шестерёнка отключены (раньше вели в пустой раздел «Проекты»)
     cursor: obj.hiddenForMe ? 'default' : 'pointer',
     transition: 'box-shadow 0.3s, transform 0.3s',
     '&:hover': obj.hiddenForMe ? {} : {
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
                    // ⭐ №284: у демо-объекта снова есть кнопка удаления — сразу и безвозвратно
                    action={
                      obj.canManage ? (
                        <Button
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePurgeObject(obj);
                          }}
                        >
                          Удалить
                        </Button>
                      ) : undefined
                    }
                  >
                    Это демо-данные.
                  </Alert>
                )}
                {/* ⭐ №284: срок удаления остался только у объектов, помеченных раньше —
                    вместо «Отменить» даём сразу добить объект, чтобы не ждать 30 дней */}
                {obj.deleteAfter && (
                  <Alert
                    severity="error"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mb: 1, borderRadius: 2 }}
                    action={
                      obj.canManage ? (
                        <Button
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePurgeObject(obj);
                          }}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          {isMobile ? 'Удалить' : 'Удалить окончательно'}
                        </Button>
                      ) : undefined
                    }
                  >
                    {`Объект помечен на удаление ${deletionPhrase(obj.deleteAfter)}. Остальные участники получат личные копии (без фото).`}
                  </Alert>
                )}
                {obj.hiddenForMe && (
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
                            handleRestoreObject(obj);
                          }}
                        >
                          Вернуть
                        </Button>
                        {/* ⭐ №284: красная кнопка вместо «Отменить удаление»:
                            объект не висит 30 дней в архиве — юзер удаляет сам */}
                        {obj.canManage && (
                          <Button
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handlePurgeObject(obj);
                            }}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            {isMobile ? 'Удалить' : 'Удалить окончательно'}
                          </Button>
                        )}
                      </Box>
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
                    title={obj.hiddenForMe ? 'Объект в архиве — действия недоступны' : 'Действия с объектом'}
                    aria-label="Действия с объектом"
                    disabled={obj.hiddenForMe}
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

      {/* Мобильная плавающая кнопка — ⭐ №285: в архиве серая и неактивная */}
      {isMobile && (
        <Fab
          color="primary"
          disabled={showArchived}
          sx={{
            ...FAB_STYLE,
            bottom: 80,
            ...(showArchived ? {} : { bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }),
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
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={handleCloseEdit}>
                Отмена
              </Button>
              <Button variant="contained" onClick={handleUpdateObject}>
                Сохранить
              </Button>
              <IconButton
                color="error"
                aria-label="Удалить объект окончательно"
                title="Удалить объект окончательно"
                onClick={() => {
                  // ⭐ №284: корзина в редактировании удаляет сразу (раньше отправляла в архив)
                  const target = editingObject;
                  handleCloseEdit(); // закрываем модалку редактирования
                  if (target) void handlePurgeObject(target);
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
            Участники
            {actCanInvite && act?.participantsCount != null
              ? ` · ${act.participantsCount}`
              : ''}
          </Button>
          {!actCanInvite && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Командой управляет администратор объекта. Прораб может отправить заявку на доступ.
            </Typography>
          )}

          <Button
            size="large"
            fullWidth
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            disabled={!actCanCopy}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) handleOpenCopy(o);
            }}
          >
            Копировать объект
          </Button>
          {!actCanCopy && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Нужны права на запись, доступ на весь объект и видимые цены.
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

          {/* ⭐ №284: окончательное удаление сразу — без 30 дней в архиве */}
          <Button
            size="large"
            fullWidth
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!actCanPurge}
            onClick={() => {
              const o = actionsObject;
              handleCloseActions();
              if (o) void handlePurgeObject(o);
            }}
            sx={{ mt: 1 }}
          >
            Удалить окончательно
          </Button>
          {!actCanPurge && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
              Удалить объект окончательно может только его администратор.
            </Typography>
          )}

          <Button size="large" fullWidth onClick={handleCloseActions} sx={{ mt: 1 }}>
            Закрыть
          </Button>
        </Stack>
      </Paper>
    </Modal>

    {/* ⭐ Копирование объекта: шаг 1 — подтверждение */}
    <Modal open={copyConfirmOpen} onClose={handleCloseCopy}>
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
          Копировать объект?
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Будет создан новый объект «{copySource?.name}». Старый объект не изменится.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Перенесутся проекты и позиции смет. Команда, склад, бригады, отчёты, фото
          и история фиксаций не копируются. Фактический расход и цены можно выбрать
          на следующем шаге.
        </Typography>
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={handleCloseCopy}>Отмена</Button>
          <Button variant="contained" onClick={() => void handleProceedCopy()}>
            Продолжить
          </Button>
        </Stack>
      </Paper>
    </Modal>


    {/* ⭐ Копирование объекта: шаг 2 — параметры копии */}
    <Modal open={copyFormOpen} onClose={handleCloseCopy} disableRestoreFocus>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '94%', sm: 640 },
          maxHeight: '90vh',
          overflowY: 'auto',
          p: 3,
          borderRadius: 3,
          outline: 'none',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Копия объекта «{copySource?.name}»
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Новый объект будет жить отдельно. Даты можно изменить — в копии они
          предзаполнены как у оригинала.
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Название объекта"
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
            inputProps={{ maxLength: 200 }}
            required
          />
          <TextField
            fullWidth
            label="Адрес"
            value={copyAddress}
            onChange={(e) => setCopyAddress(e.target.value)}
            inputProps={{ maxLength: 500 }}
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

          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">
              Проекты: {copyProjectIds.length} из {copyProjects.length}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                onClick={() => setCopyProjectIds(copyProjects.map((p) => p.id))}
              >
                Все
              </Button>
              <Button size="small" onClick={() => setCopyProjectIds([])}>
                Ничего
              </Button>
            </Stack>
          </Box>
          {copyProjectsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="caption" color="text.secondary">
                Загружаем проекты…
              </Typography>
            </Box>
          ) : !copyProjectsLoaded ? (
            <Alert severity="error">
              Не удалось загрузить проекты. Закройте окно и попробуйте снова.
            </Alert>
          ) : copyProjects.length === 0 ? (
            <Alert severity="info">
              У объекта нет доступных проектов — создастся пустой объект.
            </Alert>
          ) : (
            <Box
              sx={{
                maxHeight: 190,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1,
              }}
            >
              {copyProjects.map((project) => (
                <FormControlLabel
                  key={project.id}
                  sx={{ display: 'flex', mx: 0 }}
                  control={
                    <Checkbox
                      checked={copyProjectIds.includes(project.id)}
                      onChange={(e) =>
                        setCopyProjectIds((prev) =>
                          e.target.checked
                            ? [...prev, project.id]
                            : prev.filter((id) => id !== project.id),
                        )
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{project.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {project.materialsCount ?? 0} позиций
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          )}
          <Divider />
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
                  Если выключено — фактический расход и прогресс в копии будут нулевыми.
                </Typography>
              </Box>
            }
          />
          {copyFacts && (
            <Alert severity="info">
              Перенесём итог фактического расхода и последнюю фиксацию. История
              фиксаций не копируется. При пересчёте цен прогресс не изменится,
              а фактическая стоимость будет считаться по новым ценам.
            </Alert>
          )}

          <Divider />
          <Typography variant="subtitle2">Цены и справочник</Typography>
          <FormControl>
            <RadioGroup
              value={copyPricingMode}
              onChange={(e) =>
                setCopyPricingMode(
                  e.target.value as ObjectCopyPayload['pricingMode'],
                )
              }
            >
              <FormControlLabel
                value="keep"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Как в оригинале — без пересчёта</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Цены и ссылки на расценки копируются как есть.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="existing"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Пересчитать по существующему справочнику</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Все строки, включая строки с фактическим расходом.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="copy"
                control={<Radio />}
                disabled={!copySource?.catalogId && objectCatalogs.length === 0}
                label={
                  <Box>
                    <Typography variant="body2">Создать копию справочника с наценкой</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Новый справочник + новые цены в копии объекта.
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
          {copyPricingMode === 'existing' && (
            <FormControl fullWidth>
              <InputLabel id="copy-existing-catalog-label">Справочник для пересчёта</InputLabel>
              <Select
                labelId="copy-existing-catalog-label"
                label="Справочник для пересчёта"
                value={copyCatalogId}
                onChange={(e) =>
                  setCopyCatalogId(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {objectCatalogs.map((catalog) => (
                  <MenuItem key={catalog.id} value={catalog.id}>
                    {catalog.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {copyPricingMode === 'copy' && (
            <>
              <FormControl fullWidth>
                <InputLabel id="copy-source-catalog-label">Исходный справочник</InputLabel>
                <Select
                  labelId="copy-source-catalog-label"
                  label="Исходный справочник"
                  value={copySourceCatalogId}
                  onChange={(e) =>
                    setCopySourceCatalogId(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                >
                  <MenuItem value="">
                    <em>Не выбран</em>
                  </MenuItem>
                  {copySource?.catalogId != null &&
                    !objectCatalogs.some((c) => c.id === copySource.catalogId) && (
                      <MenuItem value={copySource.catalogId}>
                        {copySource.catalog?.name ?? `Справочник #${copySource.catalogId}`}
                      </MenuItem>
                    )}
                  {objectCatalogs.map((catalog) => (
                    <MenuItem key={catalog.id} value={catalog.id}>
                      {catalog.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Название копии справочника"
                value={copyCatalogName}
                onChange={(e) => setCopyCatalogName(e.target.value)}
                inputProps={{ maxLength: 80 }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Наценка на работы, %"
                  value={copyWorkMarkup}
                  onChange={(e) => setCopyWorkMarkup(e.target.value)}
                  inputProps={{ min: -90, max: 500, step: 0.1 }}
                  helperText="0 — без наценки, минус — скидка"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Наценка на материалы, %"
                  value={copyMaterialMarkup}
                  onChange={(e) => setCopyMaterialMarkup(e.target.value)}
                  inputProps={{ min: -90, max: 500, step: 0.1 }}
                  helperText="Цены меняются только в копии"
                />
              </Stack>
            </>
          )}

          {copyPricingMode !== 'keep' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={copyStrict}
                  onChange={(e) => setCopyStrict(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Требовать полное соответствие позиций</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Если позиция не нашлась — копия не создастся, пока вы не разрешите
                    оставить у неё старые цены.
                  </Typography>
                </Box>
              }
            />
          )}
          {copyPricingMode === 'keep' ? (
            <Alert severity="info">
              Пересчёта не будет: цены, скидки и ссылки на расценки копируются
              как в оригинале.
            </Alert>
          ) : (
            <>
              {copyPreviewLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="caption" color="text.secondary">
                    Проверяем соответствие справочнику…
                  </Typography>
                </Box>
              )}
              {copyPreviewError && (
                <Alert severity="warning">{copyPreviewError}</Alert>
              )}
              {copyPreview && (
                <Alert
                  severity={
                    copyPreview.summary.unmatchedRows > 0 ? 'warning' : 'success'
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    {copyPreview.summary.rows === 0
                      ? 'В выбранных проектах нет позиций'
                      : `Совпало ${copyPreview.summary.matchedRows} из ${copyPreview.summary.rows}`}
                  </Typography>
                  {copyPreview.summary.rows > 0 && (
                    <Typography variant="caption">
                      Строк к обновлению: {copyPreview.summary.priceChanges}
                      {' · '}
                      строк с фактом: {copyPreview.summary.factsRows}
                      {copyPreview.summary.unmatchedRows > 0
                        ? ` · не сопоставлено: ${copyPreview.summary.unmatchedRows}`
                        : ''}
                    </Typography>
                  )}
                </Alert>
              )}
              {copyPreview && copyPreview.issues.length > 0 && (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: 'rgba(255, 152, 0, 0.06)',
                  }}
                >
                  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                    Не сопоставлены:
                  </Typography>
                  {copyPreview.issues.slice(0, 8).map((issue) => (
                    <Typography
                      key={`${issue.materialId}-${issue.side}`}
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      • {issue.name} —{' '}
                      {issue.side === 'work' ? 'работа' : 'материал'}:{' '}
                      {issue.reason === 'ambiguous' ? 'неоднозначно' : 'не найдено'}
                    </Typography>
                  ))}
                  {copyPreview.issueTotal > 8 && (
                    <Typography variant="caption" color="text.secondary">
                      …и ещё {copyPreview.issueTotal - 8}
                    </Typography>
                  )}
                </Box>
              )}
              {copyPreview?.warnings.map((warning) => (
                <Alert key={warning} severity="info">
                  {warning}
                </Alert>
              ))}
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button onClick={handleCloseCopy} disabled={copySaving}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleCopyObject()}
              disabled={
                copySaving ||
                copyProjectsLoading ||
                !copyProjectsLoaded ||
                copyPreviewLoading ||
                (copyPricingMode !== 'keep' &&
                  (!!copyPreviewError ||
                    (copyStrict &&
                      !!copyPreview &&
                      copyPreview.summary.unmatchedRows > 0)))
              }
            >
              {copySaving ? <CircularProgress size={18} /> : 'Создать копию'}
            </Button>
          </Box>
        </Stack>
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
                {/* ⭐ №344/№346: карточки участников — в раскрывающейся панели.
                    Панель свёрнута по умолчанию и подсвечена, чтобы было понятно,
                    что она нажимается. */}
                <Box
                  onClick={() => setMembersExpanded((v) => !v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMembersExpanded((v) => !v);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: membersExpanded ? 'primary.main' : 'divider',
                    bgcolor: membersExpanded
                      ? 'rgba(25, 118, 210, 0.06)'
                      : 'rgba(25, 118, 210, 0.04)',
                    transition: 'background-color 0.2s, border-color 0.2s',
                    '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.12)' },
                    mb: membersExpanded ? 1 : 0,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    👥 Участники · {allPeopleCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {membersExpanded ? 'свернуть' : 'развернуть'}
                  </Typography>
                  <IconButton size="small" aria-label="Свернуть или развернуть список участников">
                    {membersExpanded ? (
                      <ExpandLessIcon fontSize="small" />
                    ) : (
                      <ExpandMoreIcon fontSize="small" />
                    )}
                  </IconButton>
                </Box>
                <Collapse in={membersExpanded}>
                <Box
                  sx={{
                    maxHeight: { xs: 260, md: 340 },
                    overflowY: 'auto',
                    pr: 0.5,
                  }}
                >
                {/* ⭐ №197: «Команда проекта» — фильтр по области доступа.
                    Клик по проекту сразу подставляет его в форму приглашения. */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                  <Chip
                    size="small"
                    label={`Все: ${allPeopleCount}`}
                    variant={memberScopeFilter === 'all' ? 'filled' : 'outlined'}
                    color={memberScopeFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setMemberScopeFilter('all')}
                    // ⭐ №341: считаем ЛЮДЕЙ, а не записи доступа
                    title="Сколько людей имеет доступ к объекту (включая отозванных)"
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    size="small"
                    label={`🏗 Весь объект: ${objectPeopleActiveCount}`}
                    variant={memberScopeFilter === 'object' ? 'filled' : 'outlined'}
                    color={memberScopeFilter === 'object' ? 'primary' : 'default'}
                    onClick={() => {
                      setMemberScopeFilter('object');
                    }}
                    title="Доступ на весь объект: эти люди видят все проекты, включая новые"
                    sx={{ cursor: 'pointer' }}
                  />
                  {accessProjects.map((project) => (
                    <Chip
                      key={project.id}
                      size="small"
                      label={`📁 ${project.name}: ${projectMemberCount(project.id)}`}
                      variant={memberScopeFilter === project.id ? 'filled' : 'outlined'}
                      color={memberScopeFilter === project.id ? 'primary' : 'default'}
                      onClick={() => {
                        setMemberScopeFilter(project.id);
                      }}
                      title={`Сколько людей приглашены ОТДЕЛЬНО в проект «${project.name}». Участники всего объекта видят его и без отдельного приглашения`}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>

                {/* ⭐ №308: одно понятное пояснение вместо двух канцелярских.
                    Смысл: «0» у проекта ≠ «никто не видит» — его видят все, у кого
                    доступ на весь объект (и админ объекта в их числе). */}
                {scopedProject && (
                  <Alert severity="info" icon={false} sx={{ mb: 1.5 }}>
                    {scopedAccessMembers.filter((m) => !m.revokedAt).length === 0
                      ? `Проект «${scopedProject.name}» отдельно никому не открывали.`
                      : `В проект «${scopedProject.name}» отдельно приглашены: ${scopedAccessMembers.filter((m) => !m.revokedAt).length} чел. (список ниже).`}
                    {objectWideActiveCount > 0
                      ? ` Но он всё равно виден участникам всего объекта — их ${objectWideActiveCount} чел. (раздел «🏗 Весь объект»), и вы как администратор в их числе.`
                      : ' Участников с доступом на весь объект нет.'}
                  </Alert>
                )}

                {groupedAccessMembers.map(({ userId, grants }) => {
                  const objectGrant = grants.find((g) => g.projectId == null) ?? null;
                  const projectGrants = grants.filter((g) => g.projectId != null);
                  const head = grants[0];
                  const anyLive = grants.some((g) => !g.revokedAt);
                  return (
                    <Box
                      key={userId}
                      sx={{ p: 1.5, mb: 1, bgcolor: '#f5f7fa', borderRadius: 2 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {head.user.fullName || head.user.email || head.user.phone || 'Без имени'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {head.user.email || head.user.phone || ''}
                          </Typography>
                        </Box>
                        {/* ⭐ №207: одно действие — удалить человека из объекта */}
                        {canManage && anyLive && (
                          <IconButton
                            size="small"
                            color="error"
                            title="Удалить участника из объекта"
                            disabled={accessLoading}
                            onClick={() => handleRemoveAccess(objectGrant ?? head)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>

                      {/* ⭐ №341: объектный доступ поглощает проектные — показываем одну строку */}
                      {objectGrant ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label="🏗 весь объект"
                            sx={{ height: 22, fontSize: '0.72rem' }}
                          />
                          {objectGrant.revokedAt && (
                            <Chip size="small" color="error" label="🔒 Доступ отозван" sx={{ height: 22, fontSize: '0.72rem' }} />
                          )}
                          {objectGrant.hidePrices && !objectGrant.revokedAt && (
                            <Chip size="small" label="🙈 цены скрыты" sx={{ height: 22, fontSize: '0.72rem' }} />
                          )}
                          {canManage && !objectGrant.revokedAt ? (
                            <>
                              <Select
                                size="small"
                                value={objectGrant.role}
                                onChange={(e) => handleChangeRole(objectGrant.id, e.target.value as AccessRole)}
                                sx={{ minWidth: 150 }}
                              >
                                <MenuItem value="CUSTOMER">👑 Администратор объекта</MenuItem>
                                <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                                <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                              </Select>
                              {objectGrant.role === 'FOREMAN' && (
                                <FormControlLabel
                                  sx={{ mr: 0 }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={objectGrant.canCreateProjects}
                                      onChange={(e) => handleToggleCreateProjects(objectGrant.id, e.target.checked)}
                                    />
                                  }
                                  label={<Typography variant="caption">проекты</Typography>}
                                />
                              )}
                            </>
                          ) : (
                            <Chip label={roleLabel(objectGrant.role)} size="small" color={roleColor(objectGrant.role)} />
                          )}
                        </Box>
                      ) : (
                        <Stack spacing={0.75} sx={{ mt: 1 }}>
                          {projectGrants.map((g) => (
                            <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                color="primary"
                                label={`📁 ${projectScopeLabel(g.projectId as number)}`}
                                sx={{ height: 22, fontSize: '0.72rem' }}
                              />
                              {g.revokedAt && (
                                <Chip size="small" color="error" label="🔒 Доступ отозван" sx={{ height: 22, fontSize: '0.72rem' }} />
                              )}
                              {g.hidePrices && !g.revokedAt && (
                                <Chip size="small" label="🙈 цены скрыты" sx={{ height: 22, fontSize: '0.72rem' }} />
                              )}
                              {canManage && !g.revokedAt ? (
                                <Select
                                  size="small"
                                  value={g.role}
                                  onChange={(e) => handleChangeRole(g.id, e.target.value as AccessRole)}
                                  sx={{ minWidth: 130 }}
                                >
                                  <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                                  <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                                </Select>
                              ) : (
                                <Chip label={roleLabel(g.role)} size="small" color={roleColor(g.role)} />
                              )}
                              {canManage && !g.revokedAt && (
                                <IconButton
                                  size="small"
                                  color="error"
                                  title="Убрать доступ к этому проекту"
                                  disabled={accessLoading}
                                  onClick={() => void handleRemoveAccessScope(g)}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
                </Box>
                </Collapse>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Форма приглашения */}
            {!canManage ? (
              <Alert severity="warning">Управлять участниками может только администратор объекта.</Alert>
            ) : (
              <>
                <Typography variant="subtitle1" gutterBottom>➕ Пригласить участника</Typography>

                {/* ⭐ №303: приглашаем ТОЛЬКО ссылкой — табы и ввод email/телефона убраны:
                    люди пересылают ссылку в мессенджере, чужую почту никто не вписывает */}
                <Stack spacing={1.5}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="link-role-label">Кого приглашаем</InputLabel>
                      <Select
                        labelId="link-role-label"
                        value={linkRole}
                        label="Кого приглашаем"
                        onChange={(e) => setLinkRole(e.target.value as AccessRole)}
                        // ⭐ №348: шрифт как у подписей галочек (1rem)
                        sx={{ fontSize: '1rem', '& .MuiSelect-select': { fontSize: '1rem' } }}
                      >
                        <MenuItem value="CUSTOMER">👑 Администратор объекта</MenuItem>
                        <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                        <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                      </Select>
                    </FormControl>

                    {/* ⭐ Флаг «скрыть цены» — для субподрядчиков */}
                    <FormControlLabel
                      sx={{ '& .MuiFormControlLabel-label': { fontSize: '1rem' } }}
                      control={
                        <Checkbox
                          checked={linkHidePrices}
                          onChange={(e) => setLinkHidePrices(e.target.checked)}
                        />
                      }
                      label="🙈 Скрыть цены для приглашённых"
                    />

                    {/* ⭐ №303: право создавать проекты — как в прежней выдаче доступа,
                        доступно только для прораба */}
                    {linkRole === 'FOREMAN' && (
                      <>
                        <FormControlLabel
                          sx={{ '& .MuiFormControlLabel-label': { fontSize: '1rem' } }}
                          control={
                            <Checkbox
                              checked={linkCanCreateProjects}
                              onChange={(e) => setLinkCanCreateProjects(e.target.checked)}
                            />
                          }
                          label="🏗 Разрешить создавать проекты"
                        />
                      </>
                    )}

                    {createdLinkUrl ? (
                      /* Ссылка создана — показываем её с кнопками */
                      <Box sx={{ p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #90caf9' }}>
                        <Typography variant="caption" color="text.secondary">
                          ✅ Ссылка готова! Отправьте её участнику:
                        </Typography>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all', my: 1, fontWeight: 600 }}>
                          {createdLinkUrl}
                        </Typography>
                        {/* ⭐ №345: срок действия — 2 часа */}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {createdLinkExpiresAt
                            ? `Действует до ${formatLinkExpiry(createdLinkExpiresAt)}`
                            : 'Действует 2 часа'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button size="small" variant="contained" startIcon={<ShareIcon />} onClick={handleShareLink}>
                            Поделиться
                          </Button>
                          <Button size="small" variant="outlined" startIcon={linkCopied ? undefined : <ContentCopyIcon />} onClick={handleCopyLink}>
                            {linkCopied ? '✓ Скопировано' : 'Копировать'}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              setCreatedLinkUrl(null);
                              setCreatedLinkExpiresAt(null);
                            }}
                          >
                            Создать новую
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Button
                            variant="outlined"
                            startIcon={<PersonSearchIcon />}
                            onClick={() => void openCandidates()}
                            disabled={accessLoading}
                            sx={{ flex: 1 }}
                          >
                            Выбрать участника
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<LinkIcon />}
                            onClick={handleCreateLink}
                            disabled={accessLoading}
                            sx={{ flex: 1 }}
                          >
                            Создать ссылку
                          </Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Ссылка действует 2 часа. Отправьте её в мессенджере — человек
                          войдёт по ней и получит доступ. Не успели — выпустите новую.
                        </Typography>
                      </>
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
                              {link.project ? ` • проект: ${link.project.name}` : ''}
                              {link.hidePrices ? ' • 🙈 без цен' : ''}
                              {link.canCreateProjects ? ' • 🏗 может создавать проекты' : ''}
                              {' • '}использований: {link.usesCount}
                              {link.maxUses ? `/${link.maxUses}` : ''}
                              {/* ⭐ №349: срок — только время (ссылка живёт 2 часа) */}
                              {link.expiresAt
                                ? ` • до ${formatLinkExpiryTime(link.expiresAt)}`
                                : ''}
                            </Typography>
                            <IconButton size="small" color="error" onClick={() => handleRevokeLink(link.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Stack>

                {/* ⭐ №350: прямой выбор участника из команды моих объектов */}
                <Modal
                  open={candidatesOpen}
                  onClose={() => setCandidatesOpen(false)}
                  disableRestoreFocus
                >
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
                      👥 Выбрать участника
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Люди из команды ваших объектов. Добавим с ролью «{roleLabel(linkRole)}»
                      {linkHidePrices ? ', без цен' : ''}
                      {linkRole === 'FOREMAN' && linkCanCreateProjects
                        ? ', с правом создавать проекты'
                        : ''}
                      .
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Поиск по имени или e-mail"
                      value={candidatesQuery}
                      onChange={(e) => setCandidatesQuery(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 1.5 }}
                    />
                    {candidatesError && (
                      <Alert severity="error" sx={{ mb: 1.5 }}>
                        {candidatesError}
                      </Alert>
                    )}
                    {candidatesLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress />
                      </Box>
                    ) : candidates.length === 0 ? (
                      <Alert severity="info">
                        Пока нет людей в ваших объектах — пригласите первого по ссылке.
                      </Alert>
                    ) : (
                      <Stack spacing={1} sx={{ maxHeight: '50vh', overflowY: 'auto', pr: 0.5 }}>
                        {candidates
                          .filter((c) => {
                            const q = candidatesQuery.trim().toLowerCase();
                            if (!q) return true;
                            return `${c.fullName ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`
                              .toLowerCase()
                              .includes(q);
                          })
                          .map((c) => (
                            <Box
                              key={c.userId}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                borderRadius: 2,
                                bgcolor: '#f5f7fa',
                              }}
                            >
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                  {c.fullName || c.email || c.phone || 'Без имени'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {c.email || c.phone || ''}
                                  {' · '}объектов: {c.objectsCount}
                                  {c.projectsCount > 0 ? ` · проектов: ${c.projectsCount}` : ''}
                                </Typography>
                              </Box>
                              {c.inObject ? (
                                <Chip size="small" label="уже в объекте" />
                              ) : (
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={candidateBusyId === c.userId}
                                  onClick={() => void handleAddCandidate(c)}
                                >
                                  Добавить
                                </Button>
                              )}
                            </Box>
                          ))}
                      </Stack>
                    )}
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                      <Button variant="outlined" onClick={() => setCandidatesOpen(false)}>
                        Закрыть
                      </Button>
                    </Stack>
                  </Paper>
                </Modal>

                {/* Кнопка закрытия */}
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