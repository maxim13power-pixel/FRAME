import React from 'react';
import { AppBar, Toolbar, IconButton, Box } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Logo from './Logo';

interface AppHeaderProps {
  onMenuClick: () => void;
  onLogoClick: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuClick, onLogoClick }) => {
  return (
    <AppBar position="fixed" sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Левая часть: бургер + логотип (для мобильных бургер слева, логотип рядом) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            edge="start"
            color="primary"
            aria-label="menu"
            onClick={onMenuClick}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Logo size="small" onClick={onLogoClick} />
        </Box>

        {/* Правая часть: аватар / кнопка профиля */}
        <IconButton color="primary" onClick={() => {}}>
          <AccountCircleIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;