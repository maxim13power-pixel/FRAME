import React, { useState } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Avatar,
  Checkbox,
  FormControlLabel,
  Link,
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext'; // добавить эту строку

const Login: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const handleClickShowPassword = () => setShowPassword((show) => !show);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/auth/login', {
        phone,
        password,
        rememberMe, // добавляем состояние чекбокса
      });
login(response.data.access_token, response.data.user);
navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка входа');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f0f4fa',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 4,
          width: '100%',
          maxWidth: 380,
          mx: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Link
          component="button"
          type="button"
          onClick={() => navigate('/landing')}
          underline="hover"
          sx={{ alignSelf: 'flex-start', mb: 1, color: '#1565c0', fontSize: '0.9rem', minHeight: 48, display: 'inline-flex', alignItems: 'center' }}
        >
          ← На главную
        </Link>
        {/* Логотип + название */}
        <Box
          component="a"
          href="https://t.me/frame_inf"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            mb: 2,
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          <Avatar
            src="/images/frame-logo2.svg"
            alt="FRAME"
            sx={{
              width: 100,
              height: 100,
              mb: 0.1,
              animation: 'pulse 5s infinite ease-in-out',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.05)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          />
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontWeight: 780,
              letterSpacing: '1px',
              color: '#04164b',
              textShadow: '1px 1px 2px rgba(0,0,0,0.05)',
              fontSize: '1.8rem', 
            }}
          >
            FRAME
          </Typography>
        </Box>

        {/* Форма */}
        <Box component="form" onSubmit={handleSubmit} width="100%">
          {/* Поле телефона/email — нормальный размер, стандартный отступ */}
          <TextField
            margin="normal"               // нормальный вертикальный отступ
            required
            fullWidth
            label="Телефон или Email"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                // Убираем чёрный цвет при наведении, ставим синий
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                },
              },
              // При фокусе — синий
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#1976d2',
                borderWidth: 2,
              },
            }}
          />

          {/* Поле пароля — аналогично */}
<TextField
  margin="normal"
  required
  fullWidth
  label="Пароль"
   autoComplete="current-password"
  type={showPassword ? 'text' : 'password'}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  slotProps={{
    input: {
      endAdornment: (
        <InputAdornment position="end">
          <IconButton
            aria-label="toggle password visibility"
            onClick={handleClickShowPassword}
            edge="end"
            disableRipple
            sx={{
              backgroundColor: 'transparent !important',
              '&:hover': { backgroundColor: 'transparent !important' },
              '&:focus': { outline: 'none' },
            }}
          >
            {showPassword ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </InputAdornment>
      ),
    },
  }}
  sx={{
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'white',
      borderRadius: 2,
      transition: 'background-color 0.2s',
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1976d2',
      },
      '&.Mui-focused': {
        backgroundColor: '#e3f2fd', // голубая заливка при фокусе
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#1976d2',
          borderWidth: 2,
        },
      },
    },
    // прозрачный фон у области глазка всегда
    '& .MuiInputAdornment-root': {
      backgroundColor: 'transparent !important',
    },
    '& .MuiIconButton-root': {
      backgroundColor: 'transparent !important',
      outline: 'none',
    },
    // дополнительно при фокусе (чтобы перебить возможные стили)
    '& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root': {
      backgroundColor: 'transparent !important',
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiIconButton-root': {
      backgroundColor: 'transparent !important',
    }
  }}
/>

          {/* Чекбокс "Запомнить меня" */}
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: '#1976d2',
                  },
                }}
              />
            }
            label="Запомнить меня"
            sx={{ mt: 1, mb: 1 }}
          />

          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{
              mt: 2,
              mb: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: '#1976d2',
              '&:hover': {
                bgcolor: '#1565C0',
              },
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            Войти
          </Button>

          {/* Дополнительные способы входа */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Link
              href="#"
              underline="hover"
              sx={{ color: '#1976d2', fontSize: '0.9rem' }}
              onClick={(e) => {
                e.preventDefault();
                alert('Функция входа по QR-коду в разработке');
              }}
            >
              Вход по QR‑коду
            </Link>
            <Link
              href="#"
              underline="hover"
              sx={{ color: '#1976d2', fontSize: '0.9rem' }}
              onClick={(e) => {
                e.preventDefault();
                alert('Функция входа с ключом доступа в разработке');
              }}
            >
              Вход с ключом доступа
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;