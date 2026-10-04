import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, FormControlLabel, Checkbox,
  Button, Divider, Modal, Alert,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useMobileHeader } from '../contexts/MobileHeaderContext';
import { ALL_BOTTOM_TABS, getBottomNavConfig, DEFAULT_BOTTOM_TABS } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { exportMyData, deleteMyAccount } from '../services/usersService';

const MAX_TABS = 5;
const MIN_TABS = 3;

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
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
      alert('Не удалось выгрузить данные');
    }
  };

  // ⭐ №130 (152-ФЗ): удалить аккаунт
  const handleDeleteAccount = async () => {
    try {
      await deleteMyAccount();
      logout();
      navigate('/login', { replace: true });
    } catch {
      alert('Не удалось удалить аккаунт');
      setDeleteModalOpen(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>Настройки</Typography>

      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
          Нижнее меню
        </Typography>
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

      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
          Данные
        </Typography>
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