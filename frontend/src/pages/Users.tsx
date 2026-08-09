import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Users: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Пользователи
      </Typography>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography>Здесь будет список пользователей</Typography>
      </Paper>

      {/* Кнопка выхода */}
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={handleLogout}
          sx={{ minWidth: 200 }}
        >
          Выйти из аккаунта
        </Button>
      </Paper>
    </Box>
  );
};

export default Users;