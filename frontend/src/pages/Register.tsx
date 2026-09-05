import React, { useState } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Avatar,
  Link,
  InputAdornment,
  IconButton,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  // ⭐ Переключатель: регистрация по email или по телефону
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация на фронте
    if (!fullName.trim()) {
      setError('Укажите имя');
      return;
    }
    if (mode === 'email' && !email.trim()) {
      setError('Укажите email');
      return;
    }
    if (mode === 'phone' && !phone.trim()) {
      setError('Укажите телефон');
      return;
    }
    if (password.length < 6) {
      setError('Пароль минимум 6 символов');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        password,
        ...(mode === 'email' ? { email: email.trim() } : { phone: phone.trim() }),
      };
      // ⭐ Прямой запрос на бэкенд (как в Login.tsx — без отдельного сервиса)
      const response = await axios.post('/api/auth/register', payload);

      // Сразу логинимся — бэк возвращает JWT + данные юзера
      login(response.data.access_token, response.data.user);

      // ⭐ Если есть отложенное приглашение — ведём на него
      const pendingInvite = localStorage.getItem('pendingInviteToken');
      if (pendingInvite) {
        localStorage.removeItem('pendingInviteToken');
        navigate(`/invite/${pendingInvite}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
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
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 4,
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Link
          component="button"
          type="button"
          onClick={() => navigate('/')}
          underline="hover"
          sx={{ alignSelf: 'flex-start', mb: 1, color: '#1565c0', fontSize: '0.9rem' }}
        >
          ← На главную
        </Link>

        {/* Логотип */}
        <Avatar
          src="/images/frame-logo2.svg"
          alt="FRAME"
          sx={{ width: 80, height: 80, mb: 1 }}
        />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#04164b', mb: 2 }}>
          Регистрация в FRAME
        </Typography>

        <Box component="form" onSubmit={handleSubmit} width="100%">
          {/* Переключатель email/телефон */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="email">📧 Email</ToggleButton>
            <ToggleButton value="phone">📱 Телефон</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            margin="normal"
            required
            fullWidth
            label="Ваше имя"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {mode === 'email' ? (
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          ) : (
            <TextField
              margin="normal"
              required
              fullWidth
              label="Телефон"
              placeholder="+79990000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          )}

          <TextField
            margin="normal"
            required
            fullWidth
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            margin="normal"
            required
            fullWidth
            label="Повторите пароль"
            type={showPassword ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: '#4caf50',
              '&:hover': { bgcolor: '#388e3c' },
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </Button>

          <Typography variant="body2" align="center" sx={{ mt: 1 }}>
            Уже есть аккаунт?{' '}
            <Link
              component="button"
              type="button"
              onClick={() => navigate('/login')}
              sx={{ color: '#1976d2', fontWeight: 600 }}
            >
              Войти
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Register;