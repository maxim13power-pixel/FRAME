import React, { useState } from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton, Avatar, Typography, Menu, MenuItem } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import EngineeringIcon from '@mui/icons-material/Engineering';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import SellIcon from '@mui/icons-material/Sell';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import CalculateIcon from '@mui/icons-material/Calculate';
import HelpIcon from '@mui/icons-material/Help';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import Logo from './Logo';

interface DrawerMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const menuItems = [
  { label: 'Главная', path: '/', icon: <SpaceDashboardIcon /> },
  { label: 'Объекты', path: '/objects', icon: <HomeIcon /> },
  { label: 'Бригады', path: '/brigades', icon: <EngineeringIcon /> },
  { label: 'Склад', path: '/warehouse', icon: <WarehouseIcon /> },
  { label: 'Справочник цен', path: '/price-list', icon: <SellIcon /> },
  { label: 'Калькуляторы', path: '/calculators', icon: <CalculateIcon /> },
  { label: 'Аренда', path: '/rentals', icon: <HandshakeIcon /> },
  { label: 'Аналитика', path: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'Отчеты', path: '/reports', icon: <AssessmentIcon /> },
  { label: 'Пользователи', path: '/users', icon: <GroupIcon /> },
  { label: 'Настройки', path: '/settings', icon: <SettingsIcon /> },
  { label: 'Помощь', path: '/help', icon: <HelpIcon /> },
];

const DrawerMenu: React.FC<DrawerMenuProps> = ({ open, onClose, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);

  // ⭐ Открыть меню профиля
  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    setProfileAnchor(e.currentTarget);
  };
  const handleCloseProfile = () => setProfileAnchor(null);

  // ⭐ Перейти в настройки аккаунта
  const handleGoSettings = () => {
    handleCloseProfile();
    onNavigate('/settings');
  };

  // ⭐ Выход из аккаунта
  const handleLogout = () => {
    handleCloseProfile();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 250, pt: 1 }}>
        {/* ⭐ Шапка: логотип + кнопка скрытия (как на десктопе) */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size="small" />
          <IconButton
            onClick={onClose}
            aria-label="Скрыть меню"
            sx={{ bgcolor: 'rgba(0, 0, 0, 0.06)', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' } }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 1 }} />
        <List>
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
        {/* ⭐ Блок профиля внизу (Z-паттерн: глаз идёт сверху вниз, внизу — акцент) */}
        <Box sx={{ mt: 'auto' }}>
          <Divider />
          <ListItemButton
            onClick={handleOpenProfile}
            sx={{
              py: 1.5,
              px: 2,
              gap: 1.5,
              '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: '#1976d2',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              {user?.name?.[0]?.toUpperCase() || <PersonIcon />}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, color: '#04164b' }}
              >
                {user?.name || 'Пользователь'}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'text.secondary' }}
              >
                {user?.email || user?.phone || ''}
              </Typography>
            </Box>
            <IconButton size="small" sx={{ color: '#424242' }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        </Box>

        {/* ⭐ Popup-меню профиля */}
        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={handleCloseProfile}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <MenuItem onClick={handleGoSettings}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Настройки аккаунта</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: '#d32f2f' }}>
            <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#d32f2f' }} /></ListItemIcon>
            <ListItemText>Выйти</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Drawer>
  );
};

export default DrawerMenu;