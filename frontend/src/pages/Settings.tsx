import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, FormControlLabel, Checkbox, Avatar,
  Button, Divider, Modal, Alert, Chip,
  List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LogoutIcon from '@mui/icons-material/Logout';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import InfoIcon from '@mui/icons-material/Info';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { ALL_BOTTOM_TABS, getBottomNavConfig, DEFAULT_BOTTOM_TABS } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { exportMyData, deleteMyAccount } from '../services/usersService';

const MAX_TABS = 5;
const MIN_TABS = 3;

// ⭐ Глобальная роль пользователя (Role из Prisma) → человекочитаемое название
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  STORE_MANAGER: 'Кладовщик',
  FOREMAN: 'Прораб',
  CUSTOMER: 'Заказчик',
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const { error: notifyError } = useFeedback();
  useMobileHeader({ title: 'Настройки', onBack: () => navigate(-1) });

  const [selected, setSelected] = useState<string[]>(() => getBottomNavConfig());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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
            {user?.role && (
              <Chip
                size="small"
                label={ROLE_LABELS[user.role] || user.role}
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
        <Divider sx={{ my: 2 }} />
        <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={handleLogout} fullWidth>
          Выйти из аккаунта
        </Button>
      </Paper>

      {/* ⭐ Интерфейс */}
      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <TuneIcon sx={{ color: '#1976d2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Нижнее меню</Typography>
        </Box>
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
            Это действие необратимо. Все ваши данные будут удалены безвозвратно.
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
