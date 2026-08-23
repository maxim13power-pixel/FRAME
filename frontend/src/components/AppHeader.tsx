import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Box, Typography, TextField, InputAdornment } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation } from 'react-router-dom';
import { useHeaderConfig } from '../contexts/MobileHeaderContext';

// Заголовки по умолчанию для страниц, которые ещё не подключили useMobileHeader
const DEFAULT_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/objects', title: 'Объекты' },
  { prefix: '/price-list', title: 'Справочник цен' },
  { prefix: '/calculators', title: 'Калькуляторы' },
  { prefix: '/help', title: 'Помощь' },
  { prefix: '/settings', title: 'Настройки' },
  { prefix: '/users', title: 'Пользователи' },
  { prefix: '/brigades', title: 'Бригады' },
  { prefix: '/warehouse', title: 'Склад' },
  { prefix: '/analytics', title: 'Аналитика' },
  { prefix: '/reports', title: 'Отчёты' },
  { prefix: '/rentals', title: 'Аренда' },
];

interface AppHeaderProps {
  onMenuClick: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuClick }) => {
  const { config } = useHeaderConfig();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [custom, setCustom] = useState('');

  const editableKey = config?.editableKey;
  React.useEffect(() => {
    setCustom(editableKey ? localStorage.getItem(editableKey) || '' : '');
    setEditing(false);
  }, [editableKey]);

  const routeTitle =
    DEFAULT_TITLES.find(t => location.pathname.startsWith(t.prefix))?.title || 'FRAME';
  const title = config?.title || routeTitle;
  const displayTitle = custom || title;

  const startEdit = () => {
    if (editableKey) {
      setDraft(displayTitle);
      setEditing(true);
    }
  };
  const commitEdit = () => {
    if (editableKey) {
      const v = draft.trim();
      if (v && v !== title) {
        localStorage.setItem(editableKey, v);
        setCustom(v);
      } else {
        localStorage.removeItem(editableKey);
        setCustom('');
      }
    }
    setEditing(false);
  };

  const searchOpen = !!config?.searchOpen;

  return (
    <AppBar position="fixed" sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <Toolbar sx={{ gap: 1, minHeight: 56 }}>
        <IconButton edge="start" color="primary" aria-label="menu" onClick={onMenuClick} sx={{ flexShrink: 0 }}>
          <MenuIcon />
        </IconButton>

        {config?.onBack && !searchOpen && !editing && (
          <IconButton
            onClick={config.onBack}
            sx={{ bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' }, flexShrink: 0 }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        {searchOpen ? (
          <TextField
            autoFocus
            size="small"
            fullWidth
            placeholder={config?.searchPlaceholder || 'Поиск...'}
            value={config?.searchValue || ''}
            onChange={e => config?.onSearchChange?.(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => config?.onSearchClose?.()}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : editing ? (
          <TextField
            autoFocus
            size="small"
            fullWidth
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
            inputProps={{ maxLength: 30 }}
          />
        ) : (
          <Box
            onClick={startEdit}
            sx={{
              flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: editableKey ? 'pointer' : 'default',
            }}
          >
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: '#04164b', flexGrow: 1 }}>
              {displayTitle}
            </Typography>
            {editableKey && <EditIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />}
          </Box>
        )}

        {!searchOpen && !editing && config?.trailing}
        {!searchOpen && !editing && config?.onSearchOpen && (
          <IconButton
            onClick={config.onSearchOpen}
            sx={{ bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' }, flexShrink: 0 }}
          >
            <SearchIcon />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;