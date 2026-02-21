import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';

interface BottomNavProps {
  value: string;
  onChange: (newValue: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ value, onChange }) => {
  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_event, newValue) => onChange(newValue)}
        sx={{ bgcolor: '#fff' }}
      >
        <BottomNavigationAction
          label="Объекты"
          value="objects"
          icon={<HomeIcon sx={{ color: value === 'objects' ? '#1976d2' : '#757575' }} />}
          sx={{ color: value === 'objects' ? '#1976d2' : '#757575' }}
        />
        <BottomNavigationAction
          label="Бригады"
          value="brigades"
          icon={<EngineeringIcon sx={{ color: value === 'brigades' ? '#1976d2' : '#757575' }} />}
          sx={{ color: value === 'brigades' ? '#1976d2' : '#757575' }}
        />
        <BottomNavigationAction
          label="Настройки"
          value="settings"
          icon={<SettingsIcon sx={{ color: value === 'settings' ? '#1976d2' : '#757575' }} />}
          sx={{ color: value === 'settings' ? '#1976d2' : '#757575' }}
        />
        <BottomNavigationAction
          label="Профиль"
          value="profile"
          icon={<PersonIcon sx={{ color: value === 'profile' ? '#1976d2' : '#757575' }} />}
          sx={{ color: value === 'profile' ? '#1976d2' : '#757575' }}
        />
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;