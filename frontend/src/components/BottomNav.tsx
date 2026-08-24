import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import HomeIcon from '@mui/icons-material/Home';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import SellIcon from '@mui/icons-material/Sell';
import CalculateIcon from '@mui/icons-material/Calculate';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import HelpIcon from '@mui/icons-material/Help';

// ⭐ ВСЕ доступные табы (в Настройках юзер сможет выбрать любые 5)
export const ALL_BOTTOM_TABS: {
  value: string;
  label: string;
  path: string;
  icon: React.ElementType;
}[] = [
  { value: 'home', label: 'Главная', path: '/', icon: SpaceDashboardIcon },
  { value: 'objects', label: 'Объекты', path: '/objects', icon: HomeIcon },
  { value: 'brigades', label: 'Бригады', path: '/brigades', icon: EngineeringIcon },
  { value: 'price-list', label: 'Цены', path: '/price-list', icon: SellIcon },
  { value: 'calculators', label: 'Калькуляторы', path: '/calculators', icon: CalculateIcon },
  { value: 'warehouse', label: 'Склад', path: '/warehouse', icon: WarehouseIcon },
  { value: 'help', label: 'Помощь', path: '/help', icon: HelpIcon },
  { value: 'settings', label: 'Настройки', path: '/settings', icon: SettingsIcon },
  { value: 'profile', label: 'Профиль', path: '/users', icon: PersonIcon },
];

export const DEFAULT_BOTTOM_TABS = ['home', 'objects', 'brigades', 'settings', 'profile'];

// ⭐ Конфиг нижних кнопок (Шаг 12: Настройки будут писать сюда)
export const getBottomNavConfig = (): string[] => {
  try {
    const raw = localStorage.getItem('frame_bottom_nav');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length >= 3 && arr.length <= 5) {
        // только известные табы
        const valid = arr.filter(v => ALL_BOTTOM_TABS.some(t => t.value === v));
        if (valid.length >= 3) return valid;
      }
    }
  } catch {
    // битый JSON — используем дефолт
  }
  return DEFAULT_BOTTOM_TABS;
};

interface BottomNavProps {
  value?: string;
  onChange?: (newValue: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = ALL_BOTTOM_TABS.filter(t => getBottomNavConfig().includes(t.value));

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10 }} elevation={3}>
      <BottomNavigation showLabels sx={{ bgcolor: '#fff' }}>
        {tabs.map(tab => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <BottomNavigationAction
              key={tab.value}
              label={tab.label}
              value={tab.value}
              icon={<Icon sx={{ color: active ? '#1976d2' : '#757575' }} />}
              sx={{ color: active ? '#1976d2' : '#757575' }}
              onClick={() => navigate(tab.path)}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;