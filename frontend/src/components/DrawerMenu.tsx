import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EngineeringIcon from '@mui/icons-material/Engineering';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';

interface DrawerMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const menuItems = [
  { label: 'Объекты', path: '/objects', icon: <HomeIcon /> },
  { label: 'Бригады', path: '/brigades', icon: <EngineeringIcon /> },
  { label: 'Склад', path: '/warehouse', icon: <WarehouseIcon /> },
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