import React, { useState } from 'react';
import {
  Box, Typography, Paper, Stack, FormControlLabel, Checkbox,
  Button, Divider, Snackbar,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { ALL_BOTTOM_TABS, getBottomNavConfig, DEFAULT_BOTTOM_TABS } from '../components/BottomNav';

const MAX_TABS = 5;
const MIN_TABS = 3;

const Settings: React.FC = () => {
  const [selected, setSelected] = useState<string[]>(() => getBottomNavConfig());
  const [saved, setSaved] = useState(false);

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
    localStorage.setItem('frame_bottom_nav', JSON.stringify(selected));
    setSaved(true);
  };

  const handleReset = () => {
    setSelected([...DEFAULT_BOTTOM_TABS]);
    localStorage.setItem('frame_bottom_nav', JSON.stringify(DEFAULT_BOTTOM_TABS));
    setSaved(true);
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>Настройки</Typography>

      <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
          Нижнее меню (мобилка)
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
          Выбрано: {selected.length} из {MAX_TABS}. Меню обновится при переходе на другую страницу.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="body1" color="text.secondary">
          Здесь появятся остальные настройки приложения (профиль, уведомления, темы).
        </Typography>
      </Paper>

      <Snackbar
        open={saved}
        autoHideDuration={2500}
        onClose={() => setSaved(false)}
        message="Настройки сохранены ✅"
      />
    </Box>
  );
};

export default Settings;