import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, FormControlLabel, Checkbox, Avatar,
  Button, Divider, Modal, Alert, Chip, TextField, CircularProgress,
  List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, useMediaQuery, useTheme,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LogoutIcon from '@mui/icons-material/Logout';
import DevicesIcon from '@mui/icons-material/Devices';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import InfoIcon from '@mui/icons-material/Info';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { ALL_BOTTOM_TABS, getBottomNavConfig, DEFAULT_BOTTOM_TABS } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
// ⭐ №179: сброс одноразовых подсказок разделов
import { resetAllIntros } from '../components/SectionIntro';
import { exportMyData, deleteMyAccount, updateMyProfile } from '../services/usersService';
import { fetchMyAccess } from '../services/accessService';
import type { MyAccess } from '../services/accessService';
import { logoutAll, changePassword } from '../services/authService';
import { getApiErrorMessage } from '../utils/errors';
import { PASSWORD_RULE_TEXT, passwordIssue } from '../utils/password';
import { getTokenExpiry } from '../utils/jwt';

const MAX_TABS = 5;
const MIN_TABS = 3;

// ⭐ Глобальная роль пользователя (Role из Prisma) → человекочитаемое название.
// ⭐ №207: роль ADMIN наружу не показываем (по просьбе владельца): техническая
// роль не должна светиться в профиле — у администратора объекта есть своя подпись.
const ROLE_LABELS: Record<string, string> = {
  STORE_MANAGER: 'Кладовщик',
  FOREMAN: 'Прораб',
  CUSTOMER: 'Администратор объекта',
  VIEWER: 'Наблюдатель', // ⭐ №168: роль доступа на объекте
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout, token, login } = useAuth();
  const { error: notifyError, notify } = useFeedback();
  useMobileHeader({ title: 'Настройки', onBack: () => navigate(-1) });

  const [selected, setSelected] = useState<string[]>(() => getBottomNavConfig());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  // ⭐ №215: правка имени и смена пароля прямо из профиля
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  // ⭐ №168: «Мои доступы» — активные / архив / отозванные
  const [myAccess, setMyAccess] = useState<MyAccess[]>([]);
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchMyAccess()
      .then(setMyAccess)
      .catch(() => setMyAccess([]))
      .finally(() => setAccessLoading(false));
  }, [token]);

  // ⭐ №169: личный архив НЕ переключаем в настройках — единственное место записи
  // это раздел «Объекты» (кнопка «Архив» в шапке). Раньше слайдер здесь писал
  // флаг в отдельную запись доступа, и состояние расходилось с объектами.

  // ⭐ №169: личный архив — свойство ОБЪЕКТА, поэтому группируем записи доступа
  // по объекту (у одного объекта их может быть несколько: весь объект + проекты).
  const myAccessGroups = useMemo(() => {
    const map = new Map<
      number,
      { objectId: number; objectName: string; rows: MyAccess[] }
    >();
    for (const row of myAccess) {
      const group = map.get(row.objectId);
      if (group) group.rows.push(row);
      else map.set(row.objectId, { objectId: row.objectId, objectName: row.objectName, rows: [row] });
    }
    return [...map.values()];
  }, [myAccess]);

  // ⭐ №160: «Сессия активна до …» — читаем exp из текущего JWT
  const sessionExpiry = getTokenExpiry(token);

  const persist = (value: string[]) => {
    localStorage.setItem('frame_bottom_nav', JSON.stringify(value));
    // ⭐ Обновляем BottomNav без reload — подписчик ловит кастомное событие
    window.dispatchEvent(new CustomEvent('frame:bottom-nav-changed'));
    navigate(-1); // автозакрытие страницы после сохранения
  };

  const toggle = (value: string) => {
    setSelected(prev => {
      if (prev.includes(value)) {
        if (prev.length <= MIN_TABS) return prev; // меньше 3 кнопок нельзя
        return prev.filter(v => v !== value);
      }
      if (prev.length >= MAX_TABS) return prev; // больше 5 кнопок нельзя
      return [...prev, value];
    });
  };

  const handleSave = () => {
    persist(selected);
  };

  const handleReset = () => {
    persist([...DEFAULT_BOTTOM_TABS]);
  };

  // ⭐ №130 (152-ФЗ): выгрузить свои данные в JSON-файл
  const handleExport = async () => {
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frame-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      notifyError('Не удалось выгрузить данные');
    }
  };

  // ⭐ №130 (152-ФЗ): удалить аккаунт
  const handleDeleteAccount = async () => {
    try {
      await deleteMyAccount();
      logout();
      navigate('/login', { replace: true });
    } catch {
      notifyError('Не удалось удалить аккаунт');
      setDeleteModalOpen(false);
    }
  };

  // ⭐ №215: черновик имени подтягиваем из профиля
  useEffect(() => {
    setNameDraft(user?.name ?? '');
  }, [user?.name]);

  // ⭐ №215: сохранение имени. Ответ сервера — форма login.user, кладём в контекст.
  const handleSaveName = async () => {
    const fullName = nameDraft.trim();
    if (fullName.length < 2) {
      notifyError('Имя минимум 2 символа');
      return;
    }
    try {
      setSavingName(true);
      const updated = await updateMyProfile({ fullName });
      if (token) login(token, updated);
      notify('Имя сохранено');
    } catch (err: unknown) {
      notifyError(getApiErrorMessage(err, 'Не удалось сохранить имя'));
    } finally {
      setSavingName(false);
    }
  };

  // ⭐ №215: смена пароля. Сервер инкрементит tokenVersion (другие устройства выходят)
  // и отдаёт новый токен — сохраняем его, чтобы текущая сессия осталась живой.
  const handleChangePassword = async () => {
    const issue = passwordIssue(pwNew);
    if (issue) {
      notifyError(issue);
      return;
    }
    if (pwNew !== pwRepeat) {
      notifyError('Пароли не совпадают');
      return;
    }
    if (pwCurrent === pwNew) {
      notifyError('Новый пароль совпадает с текущим');
      return;
    }
    try {
      setSavingPw(true);
      const result = await changePassword(pwCurrent, pwNew);
      login(result.access_token, result.user);
      setPwCurrent('');
      setPwNew('');
      setPwRepeat('');
      notify('Пароль изменён. Остальные устройства вышли из аккаунта');
    } catch (err: unknown) {
      notifyError(getApiErrorMessage(err, 'Не удалось изменить пароль'));
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // ⭐ №160: отзыв всех сессий. Даже если запрос не прошёл (нет сети),
  // локальную сессию закрываем — иначе пользователь останется «в никуда».
  const handleLogoutAll = async () => {
    try {
      setLoggingOutAll(true);
      await logoutAll();
    } catch {
      // молча: локальный выход всё равно выполнится ниже
    } finally {
      setLoggingOutAll(false);
      logout();
      navigate('/login', { replace: true });
    }
  };

  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Заголовок на десктопе (на мобилке — в шапке) */}
      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }} aria-label="В главное меню">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>Настройки</Typography>
        </Box>
      )}

      {/* ⭐ Профиль */}
      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: '#1976d2', fontWeight: 700, fontSize: '1.4rem' }}>
            {user?.name?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#04164b' }} noWrap>
              {user?.name || 'Пользователь'}
            </Typography>
            {user?.role && ROLE_LABELS[user.role] && (
              <Chip
                size="small"
                label={ROLE_LABELS[user.role]}
                sx={{ mt: 0.5, bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>
        {(user?.email || user?.phone) && (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {user?.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              </Box>
            )}
            {user?.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">{user.phone}</Typography>
              </Box>
            )}
          </Stack>
        )}
        {/* ⭐ №215: редактирование профиля и пароля — в том же окне, где выход */}
        <Accordion
          disableGutters
          elevation={0}
          sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon sx={{ color: '#1976d2' }} />
              <Typography variant="subtitle2" fontWeight={700}>Изменить имя</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              <TextField
                size="small"
                label="Имя и фамилия"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleSaveName}
                disabled={
                  savingName || nameDraft.trim().length < 2 || nameDraft.trim() === (user?.name ?? '')
                }
                startIcon={savingName ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ alignSelf: 'flex-start' }}
              >
                Сохранить имя
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion
          disableGutters
          elevation={0}
          sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockResetIcon sx={{ color: '#1976d2' }} />
              <Typography variant="subtitle2" fontWeight={700}>Сменить пароль</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              <TextField
                size="small"
                type="password"
                label="Текущий пароль"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
                fullWidth
              />
              <TextField
                size="small"
                type="password"
                label="Новый пароль"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                helperText={PASSWORD_RULE_TEXT}
                autoComplete="new-password"
                fullWidth
              />
              <TextField
                size="small"
                type="password"
                label="Повторите новый пароль"
                value={pwRepeat}
                onChange={(e) => setPwRepeat(e.target.value)}
                autoComplete="new-password"
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleChangePassword}
                disabled={savingPw || !pwCurrent || !pwNew || !pwRepeat}
                startIcon={savingPw ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ alignSelf: 'flex-start' }}
              >
                Изменить пароль
              </Button>
              <Typography variant="caption" color="text.secondary">
                После смены пароля остальные устройства выйдут из аккаунта.
              </Typography>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 2 }} />
        {/* ⭐ №160: срок действия текущей сессии (из exp в JWT) */}
        {sessionExpiry && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Сессия активна до{' '}
            {sessionExpiry.toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Typography>
        )}
        <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={handleLogout} fullWidth>
          Выйти из аккаунта
        </Button>
        <Button
          variant="text"
          color="error"
          startIcon={<DevicesIcon />}
          onClick={handleLogoutAll}
          disabled={loggingOutAll}
          fullWidth
          sx={{ mt: 1 }}
        >
          {loggingOutAll ? 'Завершаем сессии…' : 'Выйти на всех устройствах'}
        </Button>
      </Paper>

      {/* ⭐ №216: «Нижнее меню» — только для мобилки. На десктопе нижней навигации
          нет (есть сайдбар/шапка), поэтому настройка там бессмысленна и только
          отвлекает от профиля и приватности. */}
      {isMobile && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{ borderRadius: 2, mb: 2, '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider' }}
        >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TuneIcon sx={{ color: '#1976d2' }} />
            <Typography variant="subtitle1" fontWeight={700}>Нижнее меню</Typography>
            <Chip size="small" label={`${selected.length} из ${MAX_TABS}`} sx={{ bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 600 }} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Выбери от {MIN_TABS} до {MAX_TABS} кнопок для нижней навигации. Порядок — как в списке.
        </Typography>
        <Stack spacing={0}>
          {ALL_BOTTOM_TABS.map(tab => {
            const checked = selected.includes(tab.value);
            const disabled =
              (!checked && selected.length >= MAX_TABS) ||
              (checked && selected.length <= MIN_TABS);
            const Icon = tab.icon;
            return (
              <FormControlLabel
                key={tab.value}
                control={
                  <Checkbox checked={checked} disabled={disabled} onChange={() => toggle(tab.value)} />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon sx={{ fontSize: 20, color: '#1976d2' }} />
                    <Typography variant="body2">{tab.label}</Typography>
                  </Box>
                }
              />
            );
          })}
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleSave}>Сохранить</Button>
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}>
            Сбросить
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Выбрано: {selected.length} из {MAX_TABS}. Меню обновится сразу после сохранения.
        </Typography>
        </AccordionDetails>
        </Accordion>
      )}

      {/* ⭐ №168: «Мои доступы» — объекты, где я участник */}
      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <PeopleIcon sx={{ color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Мои доступы</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Объекты, где вы участник. Личный архив включается в разделе «Объекты»
          (кнопка «Архив» в шапке) — здесь только статус. Архив личный: у остальных
          участников объект остаётся на месте, данные не удаляются.
        </Typography>
        {/* ⭐ №184: «Моя команда» — кто работает со мной (включая доступ «только проект») */}
        <Button
          variant="outlined"
          startIcon={<PeopleIcon />}
          endIcon={<ChevronRightIcon />}
          onClick={() => navigate('/users')}
          sx={{ mb: 2 }}
        >
          Моя команда
        </Button>
        {accessLoading ? (
          <Typography variant="body2" color="text.secondary">Загрузка…</Typography>
        ) : myAccessGroups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Пока нет доступа ни к одному объекту.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {myAccessGroups.map(group => {
              // Архив и отзыв считаем на уровне объекта: записей доступа может быть несколько
              const hidden = group.rows.every(r => r.isHidden);
              const revoked = group.rows.every(r => !!r.revokedAt);
              return (
                <Box
                  key={group.objectId}
                  // ⭐ №194: у отозванного объекта живого доступа нет — ведём в снимок
                  onClick={() => navigate(revoked ? '/snapshots' : '/objects')}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: revoked ? '#fdecea' : hidden ? '#eef1f5' : '#f5f7fa',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: revoked ? '#fbdcd7' : '#e9f1fc' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {group.objectName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {group.rows
                          .map(r => (r.projectId ? `📁 ${r.projectName ?? 'проект'}` : '🏗 весь объект'))
                          .join(' · ')}
                        {' · '}
                        {[...new Set(group.rows.map(r => ROLE_LABELS[r.role] ?? r.role))].join(', ')}
                      </Typography>
                    </Box>
                    {revoked ? (
                      <Chip size="small" color="error" label="🔒 Доступ отозван" />
                    ) : hidden ? (
                      <Chip size="small" label="в архиве" sx={{ bgcolor: '#e0e0e0', color: '#424242' }} />
                    ) : null}
                    <ChevronRightIcon sx={{ color: 'text.secondary' }} />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* ⭐ Данные и конфиденциальность */}
      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <SecurityIcon sx={{ color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Данные и конфиденциальность</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Выгрузка и удаление персональных данных (152-ФЗ).
        </Typography>
        <Stack spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            fullWidth
          >
            Выгрузить мои данные
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setDeleteModalOpen(true)}
            fullWidth
          >
            Удалить аккаунт
          </Button>
        </Stack>
      </Paper>

      {/* ⭐ О приложении */}
      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <InfoIcon sx={{ color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>О приложении</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          FRAME — платформа для прораба: объекты, сметы, бригады, склад и аренда в одном месте.
        </Typography>
        <List disablePadding>
          <ListItemButton onClick={() => navigate('/terms')} sx={{ borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}><DescriptionIcon sx={{ color: '#1976d2' }} /></ListItemIcon>
            <ListItemText primary="Пользовательское соглашение" />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
          <ListItemButton onClick={() => navigate('/privacy')} sx={{ borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}><PrivacyTipIcon sx={{ color: '#1976d2' }} /></ListItemIcon>
            <ListItemText primary="Политика конфиденциальности" />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
          <ListItemButton onClick={() => navigate('/help')} sx={{ borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}><HelpOutlineIcon sx={{ color: '#1976d2' }} /></ListItemIcon>
            <ListItemText primary="Помощь" />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
          {/* ⭐ №179: вернуть одноразовые подсказки разделов */}
          <ListItemButton
            onClick={() => {
              const count = resetAllIntros();
              notify(count > 0 ? `Подсказки снова включены: ${count}` : 'Подсказки и так включены');
            }}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><InfoIcon sx={{ color: '#1976d2' }} /></ListItemIcon>
            <ListItemText primary="Показать подсказки разделов снова" />
            <ChevronRightIcon sx={{ color: 'text.secondary' }} />
          </ListItemButton>
        </List>
      </Paper>

      {/* Модалка подтверждения удаления аккаунта (№130) */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} disableRestoreFocus>
        <Paper sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 420 }, p: 4, borderRadius: 2,
        }}>
          <Typography variant="h6" gutterBottom>Удалить аккаунт?</Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            Аккаунт будет обезличен, вход станет невозможен. Общие данные объектов
            (сметы, акты, склад) останутся у остальных участников — они им принадлежат.
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => setDeleteModalOpen(false)}>Отмена</Button>
            <Button variant="contained" color="error" onClick={handleDeleteAccount}>Удалить</Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default Settings;
