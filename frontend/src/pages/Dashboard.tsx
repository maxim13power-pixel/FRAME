import React, { useState } from 'react';
import {
  Box, Container,  useMediaQuery, useTheme,
  //Paper, TextField, Button, Typography,
  Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, //InputAdornment
} from '@mui/material';
//import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import EngineeringIcon from '@mui/icons-material/Engineering';
import InventoryIcon from '@mui/icons-material/Inventory';
import SellIcon from '@mui/icons-material/Sell';
import CalculateIcon from '@mui/icons-material/Calculate';
import HelpIcon from '@mui/icons-material/Help';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';

import { Outlet,useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import DrawerMenu from '../components/DrawerMenu';
import { MobileHeaderProvider } from '../contexts/MobileHeaderContext';
import Logo from '../components/Logo'; // компонент логотипа


// Цвета для пунктов меню
const menuColors = [
  '#1976d2', '#2e7d32', '#ed6c02', '#9c27b0',
  '#d32f2f', '#0288d1', '#7b1fa2', '#546e7a',
];

const menuItems = [
  { label: 'Объекты', path: '/objects', icon: <HomeWorkIcon /> },
  { label: 'Бригады', path: '/brigades', icon: <EngineeringIcon /> },
  { label: 'Склад', path: '/warehouse', icon: <InventoryIcon /> },
  { label: 'Справочник цен', path: '/price-list', icon: <SellIcon /> },
  { label: 'Калькуляторы', path: '/calculators', icon: <CalculateIcon /> },
  { label: 'Помощь', path: '/help', icon: <HelpIcon /> },
  { label: 'Аренда', path: '/rentals', icon: <HandshakeIcon /> },
  { label: 'Аналитика', path: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'Отчеты', path: '/reports', icon: <AssessmentIcon /> },
  { label: 'Пользователи', path: '/users', icon: <PeopleIcon /> },
  { label: 'Настройки', path: '/settings', icon: <SettingsIcon /> },
];

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomNavValue, setBottomNavValue] = useState('objects');


  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleBottomNavChange = (newValue: string) => {
    setBottomNavValue(newValue);
  };

  const handleLogoClick = () => {
    window.open('https://t.me/frame_inf', '_blank');
  };



  const sidebarWidth = 240;

  return (
    <MobileHeaderProvider>
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f0f4fa' }}>
      {/* Мобильная шапка */}
      {isMobile && (
        <AppHeader onMenuClick={() => setDrawerOpen(true)} />
      )}

      {/* Мобильное выезжающее меню */}
      {isMobile && (
        <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} onNavigate={handleNavigate} />
      )}

      {/* Десктопное боковое меню */}
      {!isMobile && (
        <Drawer
          variant="persistent"
          anchor="left"
          open={sidebarOpen}
          sx={{
            width: sidebarOpen ? sidebarWidth : 0,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.easeInOut,
              duration: theme.transitions.duration.standard,
            }),
            '& .MuiDrawer-paper': {
              width: sidebarWidth,
              boxSizing: 'border-box',
              bgcolor: '#fff',
              borderRight: '1px solid #e0e0e0',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          {/* Логотип сверху */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo size="small" onClick={handleLogoClick} />
          
         
          {/* Кнопка скрытия меню */}
          
            <IconButton 
            onClick={() => setSidebarOpen(false)}
              sx={{
              bgcolor: 'rgba(0, 0, 0, 0.06)',   // светло-серый фон всегда
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.10)' }
              }}
              >
               <ChevronLeftIcon />
            </IconButton>
          </Box>
          <Divider />
          {/* Пункты меню */}
          <List sx={{ flexGrow: 1 }}>
            {menuItems.map((item, index) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton onClick={() => handleNavigate(item.path)}>
                  <ListItemIcon sx={{ color: menuColors[index % menuColors.length] }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}

      {/* Основная область контента */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          paddingLeft: !isMobile && !sidebarOpen ? '48px' : 0,
          transition: theme.transitions.create('padding', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        {/* Кнопка открытия бокового меню (когда оно скрыто) */}
        {!isMobile && !sidebarOpen && (
          <IconButton
            onClick={() => setSidebarOpen(true)}
     sx={{
      position: 'fixed',
      top: 24,
      left: 24,
      zIndex: 1200,
      bgcolor: 'rgba(0, 0, 0, 0.06)',
      '&:hover': {
        bgcolor: 'rgba(0, 0, 0, 0.10)'
      }
    }}
  >
            <MenuIcon />
          </IconButton>
        )}

        <Container
          maxWidth={false}
          sx={{
            mt: { xs: 10, md: 3 },
            mb: { xs: 8, md: 4 },
            px: { xs: 2, md: 3 },
            position: 'relative',
          }}
        >
          {/* Строка поиска и кнопка добавления (только для десктопа) */}
 

<Outlet />
        </Container>
      </Box>

      {/* Мобильная нижняя навигация */}
      {isMobile && (
        <BottomNav value={bottomNavValue} onChange={handleBottomNavChange} />
      )}
      //{/* Модалка добавления объекта (адаптивная) */}
    </Box>
    </MobileHeaderProvider>
  );
};

export default Dashboard;