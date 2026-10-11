import React from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Box, Divider, IconButton, Avatar, Typography,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import SellIcon from '@mui/icons-material/Sell';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SettingsIcon from '@mui/icons-material/Settings';
import CalculateIcon from '@mui/icons-material/Calculate';
import HelpIcon from '@mui/icons-material/Help';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
// ⭐ Отчёты временно скрыты
// import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import InventoryIcon from '@mui/icons-material/Inventory';
import GroupsIcon from '@mui/icons-material/Groups';
import Logo from './Logo';

interface DrawerMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const menuItems = [
  { label: 'Главная', path: '/', icon: <SpaceDashboardIcon /> },
  { label: 'Объекты', path: '/objects', icon: <HomeIcon /> },
  { label: 'Бригады', path: '/brigades', icon: <GroupsIcon /> },
  { label: 'Справочник цен', path: '/price-list', icon: <SellIcon /> },
  { label: 'Аренда', path: '/rentals', icon: <HandshakeIcon /> },
  { label: 'Склад', path: '/warehouse', icon: <InventoryIcon /> },
  { label: 'Калькуляторы', path: '/calculators', icon: <CalculateIcon /> },
  { label: 'Аналитика', path: '/analytics', icon: <BarChartIcon /> },
  // ⭐ Отчёты временно скрыты
  // { label: 'Отчёты', path: '/reports', icon: <DescriptionIcon /> },
  { label: 'Настройки', path: '/settings', icon: <SettingsIcon /> },
  { label: 'Помощь', path: '/help', icon: <HelpIcon /> },
];

const DrawerMenu: React.FC<DrawerMenuProps> = ({ open, onClose, onNavigate }) => {
  const { user } = useAuth();

  // ⭐ Шаг 67: клик по профилю → страница «Пользователи» (там аккаунт и выход)
  const handleGoProfile = () => {
    onClose();
    onNavigate('/users');
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 250, pt: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* ⭐ Шапка: логотип + кнопка скрытия (как на десктопе) */}
        <Box sx={{ px: 2, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size="small" />
          <IconButton
            onClick={onClose}
            aria-label="Скрыть меню"
            sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 0.5 }} />
        <List
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflowY: 'auto',
            // ⭐ Видимый скроллбар (как на десктопе), чтобы было видно, что список прокручивается
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0, 0, 0, 0.25) rgba(0, 0, 0, 0.05)',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 3 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 3 },
          }}
        >
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton onClick={() => { onNavigate(item.path); onClose(); }}>
                <ListItemIcon sx={{ color: '#1976d2' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} sx={{ color: '#04164b' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        {/* ⭐ Профиль внизу: иконка + имя, клик → «Пользователи» (Z-паттерн) */}
        <Box sx={{ mt: 'auto' }}>
          <Divider />
          <ListItemButton
            onClick={handleGoProfile}
            sx={{ py: 1.5, px: 2, gap: 1.5, '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' } }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#1976d2', fontSize: '1rem', fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase() || <PersonIcon />}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#04164b' }}>
                {user?.name || 'Пользователь'}
              </Typography>
              <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                {user?.email || user?.phone || ''}
              </Typography>
            </Box>
          </ListItemButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default DrawerMenu;