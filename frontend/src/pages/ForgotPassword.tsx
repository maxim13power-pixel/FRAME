import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Paper, Avatar, Link, Alert, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// ⭐ Шаг 63: страница восстановления пароля (поле email).
// TODO (шаг 64): подключить бэкенд POST /auth/forgot-password + отправку письма (Brevo).
// Пока — демо-режим: показываем стандартное безопасное сообщение
// (одинаковое для существующих и несуществующих email — не утекают данные о том, кто зарегистрирован).
const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Укажите корректный E-mail');
      return;
    }
    // TODO (шаг 64): axios.post('/api/auth/forgot-password', { email })
    setSent(true);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f4fa', p: 2 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar src="/images/frame-logo2.svg" alt="FRAME" sx={{ width: 90, height: 90, mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#04164b', mb: 2, textAlign: 'center' }}>
          Восстановление пароля
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
          Введите E-mail, указанный при регистрации — пришлём ссылку для сброса пароля.
        </Typography>

        {sent ? (
          <Stack spacing={2} width="100%">
            <Alert severity="success">Если аккаунт с этим email существует, мы отправили ссылку для восстановления.</Alert>
            <Alert severity="info">Проверьте папку «Спам», если письма нет во «Входящих».</Alert>
            <Button variant="outlined" onClick={() => navigate('/login')}>Вернуться ко входу</Button>
          </Stack>
        ) : (
          <Box component="form" noValidate width="100%" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                required
                margin="none"
                label="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'white',
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
                    '&.Mui-focused': { backgroundColor: '#e3f2fd', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2', borderWidth: 2 } },
                  },
                }}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 2, bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' }, fontWeight: 'bold' }}>
                Восстановить пароль
              </Button>
              <Link component="button" type="button" onClick={() => navigate('/login')} sx={{ color: '#1976d2', textAlign: 'left' }}>
                ← Вернуться ко входу
              </Link>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ForgotPassword;