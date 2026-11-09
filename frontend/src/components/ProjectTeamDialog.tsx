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
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import {
  addAccess,
  fetchAccessList,
  removeProjectAccess,
  updateAccess,
} from '../services/accessService';
import type { AccessMember, AccessRole } from '../services/accessService';
import type { ProjectData } from '../services/projectService';
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { confirm, notify, error: notifyError } = useFeedback();

  const [members, setMembers] = useState<AccessMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [newRole, setNewRole] = useState<AccessRole>('FOREMAN');
  const [hidePrices, setHidePrices] = useState(false);
  const [invite, setInvite] = useState('');

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

  useEffect(() => {
    void load();
    setSelected([]);
    setInvite('');
    setNewRole('FOREMAN');
    setHidePrices(false);
  }, [load]);

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
  const candidates = useMemo(() => {
    if (!project) return [];
    const already = new Set(projectMembers.map((m) => m.userId));
    const seen = new Set<number>();
    return members.filter((m) => {
      if (m.projectId == null || m.projectId === project.id) return false;
      if (already.has(m.userId) || seen.has(m.userId)) return false;
      if (user?.id === m.userId) return false;
      seen.add(m.userId);
      return true;
    });
  }, [members, project, projectMembers, user?.id]);

  const refresh = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const handleAddSelected = async () => {
    if (!project || selected.length === 0) return;
    setBusy(true);
    try {
      const chosen = candidates.filter((m) => selected.includes(m.userId));
      for (const m of chosen) {
        await addAccess(objectId, {
          userId: m.userId,
          role: newRole,
          projectId: project.id,
          hidePrices,
        });
      }
      notify(
        `Доступ к проекту выдан: ${chosen.length} ${
          chosen.length === 1 ? 'участнику' : 'участникам'
        }.`,
      );
      setSelected([]);
      await refresh();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось выдать доступ'));
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!project) return;
    const value = invite.trim();
    if (!value) return;
    setBusy(true);
    try {
      const payload = value.includes('@')
        ? { email: value }
        : { phone: value };
      await addAccess(objectId, {
        ...payload,
        role: newRole,
        projectId: project.id,
        hidePrices,
      });
      setInvite('');
      notify('Участник добавлен в проект');
      await refresh();
    } catch (err) {
      notifyError(getApiErrorText(err, 'Не удалось пригласить участника'));
    } finally {
      setBusy(false);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={{ pr: 6, position: 'relative' }}>
        Участники проекта
        <Typography variant="body2" color="text.secondary" noWrap>
          {project?.name || ''}
        </Typography>
        <IconButton
          aria-label="Закрыть"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
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

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Добавить из команды объекта
            </Typography>
            {candidates.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Все участники команды уже имеют доступ к этому проекту.
              </Typography>
            ) : (
              <List dense disablePadding>
                {candidates.map((m) => (
                  <ListItem key={m.id} disableGutters>
                    <Checkbox
                      edge="start"
                      checked={selected.includes(m.userId)}
                      disabled={!canManage || busy}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, m.userId]
                            : prev.filter((id) => id !== m.userId),
                        )
                      }
                    />
                    <ListItemText
                      primary={userLabel(m)}
                      secondary={`сейчас: ${ROLE_LABEL[m.role]}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Роль</InputLabel>
                <Select
                  label="Роль"
                  value={newRole}
                  disabled={!canManage || busy}
                  onChange={(e) => setNewRole(e.target.value as AccessRole)}
                >
                  {(['CUSTOMER', 'FOREMAN', 'VIEWER'] as AccessRole[]).map(
                    (r) => (
                      <MenuItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hidePrices}
                    disabled={!canManage || busy}
                    onChange={(e) => setHidePrices(e.target.checked)}
                  />
                }
                label="Скрыть цены"
              />
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                disabled={!canManage || busy || selected.length === 0}
                onClick={() => void handleAddSelected()}
              >
                Добавить ({selected.length})
              </Button>
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Пригласить по email или телефону
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="email@example.com или +7..."
                value={invite}
                disabled={!canManage || busy}
                onChange={(e) => setInvite(e.target.value)}
              />
              <Button
                variant="outlined"
                disabled={!canManage || busy || !invite.trim()}
                onClick={() => void handleInvite()}
              >
                Пригласить
              </Button>
            </Box>

          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectTeamDialog;

