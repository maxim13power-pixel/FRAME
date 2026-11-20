// frontend/src/components/ProjectTeamDialog.tsx
// ⭐ №249: участники проекта — по принципу «Объектов», но в рамках одного проекта.
// Объектные участники видят проект всегда (read-only в этом окне); проектные — только свой.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Modal,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { APP_URL } from '../config';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  addAccess,
  fetchAccessCandidates,
  fetchAccessList,
  removeProjectAccess,
  updateAccess,
} from '../services/accessService';
import type {
  AccessCandidate,
  AccessMember,
  AccessRole,
} from '../services/accessService';
import type { ProjectData } from '../services/projectService';
import {
  createInviteLink,
  fetchInviteLinks,
  revokeInviteLink,
} from '../services/inviteService';
import type { InviteLink } from '../services/inviteService';
import { getApiErrorText } from '../utils/errors';

interface ProjectTeamDialogProps {
  open: boolean;
  onClose: () => void;
  objectId: number;
  project: ProjectData | null;
  canManage: boolean;
  onChanged?: () => void;
}

const ROLE_LABEL: Record<AccessRole, string> = {
  CUSTOMER: 'Администратор',
  FOREMAN: 'Прораб',
  VIEWER: 'Наблюдатель',
};

const userLabel = (m: AccessMember) =>
  m.user.fullName || m.user.email || m.user.phone || `Участник #${m.userId}`;

const ProjectTeamDialog: React.FC<ProjectTeamDialogProps> = ({
  open,
  onClose,
  objectId,
  project,
  canManage,
  onChanged,
}) => {
  const { confirm, notify, error: notifyError } = useFeedback();

  const [members, setMembers] = useState<AccessMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ⭐ №346/№352: список участников — в свёрнутой по умолчанию панели
  const [membersExpanded, setMembersExpanded] = useState(false);
  // ⭐ №303: приглашение только ссылкой — email/телефон убраны из UI
  const [linkRole, setLinkRole] = useState<AccessRole>('FOREMAN');
  const [linkHidePrices, setLinkHidePrices] = useState(false);
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
  // ⭐ №345: срок действия созданной ссылки (по умолчанию 2 часа)
  const [createdLinkExpiresAt, setCreatedLinkExpiresAt] = useState<string | null>(null);
  const [activeLinks, setActiveLinks] = useState<InviteLink[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  // ⭐ №352: выбор участника из команды моих объектов (как в модалке объекта)
  const [pickOpen, setPickOpen] = useState(false);
  const [pickList, setPickList] = useState<AccessCandidate[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState('');
  const [pickQuery, setPickQuery] = useState('');
  const [pickBusyId, setPickBusyId] = useState<number | null>(null);
  // ⭐ №352: изменение доступа к проекту из списка выбранных
  const [editGrant, setEditGrant] = useState<{
    candidate: AccessCandidate;
    accessId: number;
    role: AccessRole;
    hidePrices: boolean;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      const rows = await fetchAccessList(objectId);
      setMembers(rows.filter((m) => !m.revokedAt));
    } catch (err) {
      setError(getApiErrorText(err, 'Не удалось загрузить участников'));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [open, objectId]);

  const loadLinks = useCallback(async () => {
    if (!open || !project) return;
    try {
      setActiveLinks(await fetchInviteLinks(objectId, project.id));
    } catch {
      setActiveLinks([]);
    }
  }, [open, objectId, project]);

  useEffect(() => {
    void load();
    void loadLinks();
    setMembersExpanded(false);
    setCreatedLinkUrl(null);
    setCreatedLinkExpiresAt(null);
    setLinkCopied(false);
    setPickOpen(false);
    setPickList([]);
    setPickError('');
    setEditGrant(null);
  }, [load, loadLinks]);

  const objectWide = useMemo(
    () => members.filter((m) => m.projectId == null),
    [members],
  );
  const projectMembers = useMemo(
    () =>
      project
        ? members.filter((m) => m.projectId === project.id)
        : [],
    [members, project],
  );
  // ⭐ №352: людей считаем по людям, а не по записям доступа
  const participantCount = useMemo(
    () =>
      new Set([...objectWide.map((m) => m.userId), ...projectMembers.map((m) => m.userId)])
        .size,
    [objectWide, projectMembers],
  );

  const refresh = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  // ⭐ №352: открыть список людей из команды моих объектов (для этого проекта)
  const openPicker = async () => {
    if (!project) return;
    setPickOpen(true);
    setPickLoading(true);
    setPickError('');
    setPickQuery('');
    try {
      setPickList(await fetchAccessCandidates(objectId, project.id));
    } catch (err) {
      setPickList([]);
      setPickError(getApiErrorText(err, 'Не удалось загрузить список участников'));
    } finally {
      setPickLoading(false);
    }
  };

  const handleAddCandidate = async (candidate: AccessCandidate) => {
    if (!project) return;
    setPickBusyId(candidate.userId);
    setPickError('');
    try {
      await addAccess(objectId, {
        userId: candidate.userId,
        // «Администратор» — объектная роль, в проекте её нет (№304)
        role: linkRole === 'CUSTOMER' ? 'FOREMAN' : linkRole,
        projectId: project.id,
        hidePrices: linkHidePrices,
      });
      notify(
        `Добавлен: ${candidate.fullName || candidate.email || candidate.phone || 'участник'}`,
        'success',
      );
      setPickList(await fetchAccessCandidates(objectId, project.id));
      await refresh();
    } catch (err) {
      setPickError(getApiErrorText(err, 'Не удалось добавить участника'));
    } finally {
      setPickBusyId(null);
    }
  };

  const handleSaveGrant = async () => {
    if (!editGrant || !project) return;
    setEditSaving(true);
    setEditError('');
    try {
      await updateAccess(objectId, editGrant.accessId, {
        role: editGrant.role,
        hidePrices: editGrant.hidePrices,
      });
      notify('Доступ к проекту обновлён', 'success');
      setEditGrant(null);
      setPickList(await fetchAccessCandidates(objectId, project.id));
      await refresh();
    } catch (err) {
      setEditError(getApiErrorText(err, 'Не удалось изменить доступ'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleRoleChange = async (member: AccessMember, role: AccessRole) => {
    setBusy(true);
    try {
      await updateAccess(objectId, member.id, { role });
      await refresh();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось сменить роль'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member: AccessMember) => {
    if (!project) return;
    const ok = await confirm({
      title: 'Удалить участника проекта?',
      text: `Доступ к проекту «${project.name}» для ${userLabel(member)} будет удалён. Перед удалением FRAME сохранит ему личную копию сметы и снимок данных — они останутся в его шаблонах.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeProjectAccess(project.id, member.id);
      notify('Участник удалён из проекта; копия сметы сохранена');
      await refresh();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось удалить участника'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateLink = async () => {
    if (!project) return;
    setBusy(true);
    setError('');
    try {
      const link = await createInviteLink(objectId, {
        role: linkRole,
        hidePrices: linkHidePrices,
        projectId: project.id,
      });
      setCreatedLinkUrl(`${APP_URL}/invite/${link.token}`);
      setCreatedLinkExpiresAt(link.expiresAt ?? null);
      await loadLinks();
    } catch (err) {
      setError(getApiErrorText(err, 'Не удалось создать ссылку'));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdLinkUrl) return;
    try {
      await navigator.clipboard.writeText(createdLinkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать ссылку');
    }
  };

  const handleShareLink = async () => {
    if (!createdLinkUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Приглашение в FRAME — ${project?.name || ''}`,
          text: `Вас приглашают в проект «${project?.name || ''}» в FRAME. Перейдите по ссылке:`,
          url: createdLinkUrl,
        });
      } else {
        await handleCopyLink();
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        await handleCopyLink();
      }
    }
  };

  const handleRevokeLink = async (linkId: number) => {
    try {
      await revokeInviteLink(objectId, linkId);
      setCreatedLinkUrl(null);
      await loadLinks();
    } catch (err) {
      setError(getApiErrorText(err, 'Не удалось отозвать ссылку'));
    }
  };

  return (
    // ⭐ №353: оформление как у модалки участников объекта (тот же Modal + Paper, 92% на телефоне)
    <Modal open={open} onClose={onClose}>
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
          👥 Участники проекта «{project?.name || ''}»
        </Typography>
        {!canManage && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Участниками проекта управляет администратор объекта. Здесь доступен
            только просмотр.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ⭐ №346/№352: участники — в свёрнутой по умолчанию подсвеченной панели */}
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
                👥 Участники · {participantCount}
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
            <Box sx={{ maxHeight: { xs: 260, md: 340 }, overflowY: 'auto', pr: 0.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Видят весь объект ({objectWide.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Эти люди видят все проекты объекта, включая этот.
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                mt: 1,
                mb: 2,
              }}
            >
              {objectWide.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет участников с доступом на весь объект.
                </Typography>
              ) : (
                objectWide.map((m) => (
                  <Chip
                    key={m.id}
                    size="small"
                    label={`${userLabel(m)} · ${ROLE_LABEL[m.role]}`}
                  />
                ))
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Участники проекта ({projectMembers.length})
            </Typography>
            {projectMembers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Пока только объектный доступ. Добавьте людей ниже.
              </Typography>
            ) : (
              <List dense disablePadding>
                {projectMembers.map((m) => (
                  <ListItem
                    key={m.id}
                    disableGutters
                    secondaryAction={
                      <IconButton
                        edge="end"
                        color="error"
                        aria-label="Удалить участника проекта"
                        disabled={!canManage || busy}
                        onClick={() => void handleRemove(m)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={userLabel(m)}
                      secondary={m.hidePrices ? 'цены скрыты' : 'цены видны'}
                    />
                    <FormControl size="small" sx={{ minWidth: 140, mr: 1 }}>
                      <Select
                        value={m.role}
                        disabled={!canManage || busy}
                        onChange={(e) =>
                          void handleRoleChange(
                            m,
                            e.target.value as AccessRole,
                          )
                        }
                      >
                        {(
                          ['CUSTOMER', 'FOREMAN', 'VIEWER'] as AccessRole[]
                        ).map((r) => (
                          <MenuItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </ListItem>
                ))}
              </List>
            )}
            </Box>
            </Collapse>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle1" gutterBottom>
              ➕ Пригласить участника
            </Typography>
            {/* ⭐ №303: только ссылка — email/телефон убраны (чужую почту никто не вписывает) */}
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="project-link-role-label">
                    Кого приглашаем
                  </InputLabel>
                  <Select
                    labelId="project-link-role-label"
                    value={linkRole}
                    label="Кого приглашаем"
                    onChange={(e) => setLinkRole(e.target.value as AccessRole)}
                    // ⭐ №348: шрифт как у подписи галочки (1rem)
                    sx={{ fontSize: '1rem', '& .MuiSelect-select': { fontSize: '1rem' } }}
                  >
                    {/* ⭐ №304: «Администратор» — объектная роль, в ссылке в проект её нет */}
                    <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                    <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                  </Select>
                </FormControl>

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

                {createdLinkUrl ? (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#f0f7ff',
                      borderRadius: 2,
                      border: '1px solid #90caf9',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      ✅ Ссылка готова! Отправьте её участнику:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ wordBreak: 'break-all', my: 1, fontWeight: 600 }}
                    >
                      {createdLinkUrl}
                    </Typography>
                    {/* ⭐ №345: срок действия — 2 часа */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {createdLinkExpiresAt
                        ? `Действует до ${new Date(createdLinkExpiresAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Действует 2 часа'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ShareIcon />}
                        onClick={() => void handleShareLink()}
                      >
                        Поделиться
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={linkCopied ? undefined : <ContentCopyIcon />}
                        onClick={() => void handleCopyLink()}
                      >
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
                        onClick={() => void openPicker()}
                        disabled={!canManage || busy}
                        sx={{ flex: 1 }}
                      >
                        Выбрать участника
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<LinkIcon />}
                        onClick={() => void handleCreateLink()}
                        disabled={!canManage || busy}
                        sx={{ flex: 1 }}
                      >
                        Создать ссылку
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Ссылка действует 2 часа. Отправьте её в мессенджере — человек войдёт
                      по ней и получит доступ к проекту. Не успели — выпустите новую.
                    </Typography>
                  </>
                )}

                {activeLinks.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Активные ссылки ({activeLinks.length}):
                    </Typography>
                    {activeLinks.map((link) => (
                      <Box
                        key={link.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mt: 0.5,
                        }}
                      >
                        <LinkIcon
                          fontSize="small"
                          sx={{ color: '#90a4ae' }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ flexGrow: 1 }}
                          noWrap
                        >
                          {ROLE_LABEL[link.role]}
                          {link.hidePrices ? ' • 🙈 без цен' : ''} •
                          использований: {link.usesCount}
                          {link.maxUses ? `/${link.maxUses}` : ''}
                          {/* ⭐ №349: срок — только время (ссылка живёт 2 часа) */}
                          {link.expiresAt
                            ? ` • до ${new Date(link.expiresAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ''}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={!canManage || busy}
                          onClick={() => void handleRevokeLink(link.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* ⭐ №352: выбор участника из команды моих объектов (как в модалке объекта) */}
                <Modal
                  open={pickOpen}
                  onClose={() => setPickOpen(false)}
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
                      Люди из команды ваших объектов. Добавим в этот проект с ролью «
                      {ROLE_LABEL[linkRole === 'CUSTOMER' ? 'FOREMAN' : linkRole]}»
                      {linkHidePrices ? ', без цен' : ''}.
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Поиск по имени или e-mail"
                      value={pickQuery}
                      onChange={(e) => setPickQuery(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 1.5 }}
                    />
                    {pickError && (
                      <Alert severity="error" sx={{ mb: 1.5 }}>
                        {pickError}
                      </Alert>
                    )}
                    {pickLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress />
                      </Box>
                    ) : pickList.length === 0 ? (
                      <Alert severity="info">
                        Пока нет людей в ваших объектах — пригласите первого по ссылке.
                      </Alert>
                    ) : (
                      <Stack spacing={1} sx={{ maxHeight: '50vh', overflowY: 'auto', pr: 0.5 }}>
                        {pickList
                          .filter((c) => {
                            const q = pickQuery.trim().toLowerCase();
                            if (!q) return true;
                            return `${c.fullName ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`
                              .toLowerCase()
                              .includes(q);
                          })
                          .map((c) => {
                            const projectGrant = c.grantsInObject[0] ?? null;
                            return (
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
                                  </Typography>
                                </Box>
                                {c.objectWide ? (
                                  <Chip size="small" label="видит весь объект" />
                                ) : projectGrant ? (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Chip size="small" label="уже в проекте" />
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() =>
                                        setEditGrant({
                                          candidate: c,
                                          accessId: projectGrant.accessId,
                                          role: projectGrant.role,
                                          hidePrices: projectGrant.hidePrices,
                                        })
                                      }
                                    >
                                      Изменить
                                    </Button>
                                  </Stack>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={pickBusyId === c.userId || !canManage}
                                    onClick={() => void handleAddCandidate(c)}
                                  >
                                    Добавить
                                  </Button>
                                )}
                              </Box>
                            );
                          })}
                      </Stack>
                    )}
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                      <Button variant="outlined" onClick={() => setPickOpen(false)}>
                        Закрыть
                      </Button>
                    </Stack>
                  </Paper>
                </Modal>

                {/* ⭐ №352: изменение доступа к проекту */}
                <Modal
                  open={editGrant != null}
                  onClose={() => setEditGrant(null)}
                  disableRestoreFocus
                >
                  <Paper
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: { xs: '92%', sm: 420 },
                      p: 3,
                      borderRadius: 3,
                      outline: 'none',
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      ✏️ Изменить доступ
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {editGrant?.candidate.fullName ||
                        editGrant?.candidate.email ||
                        ''}
                      {' · проект: '}
                      {project?.name ?? ''}
                    </Typography>
                    {editError && (
                      <Alert severity="error" sx={{ mb: 1.5 }}>
                        {editError}
                      </Alert>
                    )}
                    {editGrant && (
                      <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Роль</InputLabel>
                          <Select
                            label="Роль"
                            value={editGrant.role === 'CUSTOMER' ? 'FOREMAN' : editGrant.role}
                            onChange={(e) =>
                              setEditGrant({
                                ...editGrant,
                                role: e.target.value as AccessRole,
                              })
                            }
                          >
                            <MenuItem value="FOREMAN">👷 Прораб</MenuItem>
                            <MenuItem value="VIEWER">👁 Наблюдатель</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControlLabel
                          sx={{ mr: 0 }}
                          control={
                            <Checkbox
                              checked={editGrant.hidePrices}
                              onChange={(e) =>
                                setEditGrant({
                                  ...editGrant,
                                  hidePrices: e.target.checked,
                                })
                              }
                            />
                          }
                          label={<Typography variant="body1">🙈 цены скрыты</Typography>}
                        />
                      </Stack>
                    )}
                    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                      <Button onClick={() => setEditGrant(null)} disabled={editSaving}>
                        Отмена
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => void handleSaveGrant()}
                        disabled={editSaving || editGrant == null}
                      >
                        {editSaving ? <CircularProgress size={22} /> : 'Сохранить'}
                      </Button>
                    </Stack>
                  </Paper>
                </Modal>
              </Stack>

          </>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="outlined" onClick={onClose}>
            Закрыть
          </Button>
        </Box>
      </Paper>
    </Modal>
  );
};

export default ProjectTeamDialog;

