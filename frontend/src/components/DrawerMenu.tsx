import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton } from '@mui/material';
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
  { label: 'Помощь', path: '/help', icon: <HelpIcon /> },
  { label: 'Аренда', path: '/rentals', icon: <HandshakeIcon /> },
  { label: 'Аналитика', path: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'Отчеты', path: '/reports', icon: <AssessmentIcon /> },
  { label: 'Пользователи', path: '/users', icon: <GroupIcon /> },
  { label: 'Настройки', path: '/settings', icon: <SettingsIcon /> },
];

const DrawerMenu: React.FC<DrawerMenuProps> = ({ open, onClose, onNavigate }) => {
  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 250, pt: 2 }}>
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
      </Box>
    </Drawer>
  );
};

export default DrawerMenu;