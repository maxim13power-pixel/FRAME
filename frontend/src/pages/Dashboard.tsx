import React, { useState } from 'react';
import {
  Box, Container, Fab, useMediaQuery, useTheme,
  Modal, Paper, TextField, Button, Typography,
  Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import EngineeringIcon from '@mui/icons-material/Engineering';
import InventoryIcon from '@mui/icons-material/Inventory';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import AddHomeIcon from '@mui/icons-material/AddHome';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import DrawerMenu from '../components/DrawerMenu';
import Logo from '../components/Logo'; // компонент логотипа

// Цвета для пунктов меню
const menuColors = [
  '#1976d2', '#2e7d32', '#ed6c02', '#9c27b0',
  '#d32f2f', '#0288d1', '#7b1fa2', '#546e7a',
];

const menuItems = [
  { label: 'Объекты', path: '/objects', icon: <HomeWorkIcon /> },
  { label: 'Бригады', path: '/brigades', icon: <EngineeringIcon /> },
  { label: 'Склад', path: '/equipment', icon: <InventoryIcon /> },
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
  const [addObjectModalOpen, setAddObjectModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleBottomNavChange = (newValue: string) => {
    setBottomNavValue(newValue);
  };

  const handleLogoClick = () => {
    window.open('https://t.me/frame_inf', '_blank');
  };

  const handleAddObject = () => {
    setAddObjectModalOpen(false);
    // TODO: отправить данные на сервер
  };

  const sidebarWidth = 240;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f0f4fa' }}>
      {/* Мобильная шапка */}
      {isMobile && (
        <AppHeader onMenuClick={() => setDrawerOpen(true)} onLogoClick={handleLogoClick} />
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
            width: sidebarWidth,
            flexShrink: 0,
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
          
            <IconButton onClick={() => setSidebarOpen(false)}>
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
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Кнопка открытия бокового меню (когда оно скрыто) */}
        {!isMobile && !sidebarOpen && (
          <IconButton
            onClick={() => setSidebarOpen(true)}
            sx={{ position: 'fixed', top: 16, left: 16, zIndex: 1200 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Container
          sx={{
            mt: { xs: 10, md: 4 },
            mb: { xs: 8, md: 4 },
            position: 'relative',
          }}
        >
          {/* Строка поиска и кнопка добавления (только для десктопа) */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <TextField
                placeholder="Поиск объектов..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flexGrow: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddHomeIcon />}
                onClick={() => setAddObjectModalOpen(true)}
                sx={{
                  bgcolor: '#4caf50',
                  '&:hover': {
                    bgcolor: '#388e3c',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Добавить объект
              </Button>
            </Box>
          )}

          {/* Заглушка списка объектов */}
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              Объекты
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Здесь будет список объектов. Пока это демо-версия.
            </Typography>
          </Paper>
        </Container>
      </Box>

      {/* Мобильная нижняя навигация */}
      {isMobile && (
        <BottomNav value={bottomNavValue} onChange={handleBottomNavChange} />
      )}

      {/* Мобильная зелёная FAB */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 1000,
            bgcolor: '#4caf50',
            '&:hover': { bgcolor: '#388e3c' },
          }}
          onClick={() => setAddObjectModalOpen(true)}
        >
          <AddHomeIcon />
        </Fab>
      )}

      {/* Модалка добавления объекта (адаптивная) */}
      <Modal open={addObjectModalOpen} onClose={() => setAddObjectModalOpen(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            maxWidth: 400,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Добавить новый объект
          </Typography>
          <TextField fullWidth label="Название объекта" margin="normal" />
          <TextField fullWidth label="Адрес" margin="normal" />
          <TextField
            fullWidth
            label="Дата начала"
            type="date"
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Дата окончания"
            type="date"
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" onClick={() => setAddObjectModalOpen(false)}>
              Отмена
            </Button>
            <Button variant="contained" onClick={handleAddObject}>
              Сохранить
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default Dashboard;