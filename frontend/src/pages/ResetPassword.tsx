// frontend/src/pages/ResetPassword.tsx
// ⭐ P0-4: страница сброса пароля (переход из письма)
import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Paper, Avatar, Link, Alert, Stack, CircularProgress } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/authService';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Неверная или устаревшая ссылка. Запросите восстановление ещё раз.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Не удалось сбросить пароль. Ссылка могла устареть.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f4fa', p: 0 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Link
          component="button"
          type="button"
          onClick={() => navigate('/login')}
          underline="none"
          sx={{ alignSelf: 'flex-start', mb: 1, color: '#1565c0', fontSize: '0.9rem' }}
        >
          ← Вернуться ко входу
        </Link>
        <Avatar src="/images/frame-logo2.svg" alt="FRAME" sx={{ width: 90, height: 90, mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#04164b', mb: 2, textAlign: 'center' }}>
          Новый пароль
        </Typography>
        {success ? (
          <Stack spacing={2} width="100%">
            <Alert severity="success">Пароль успешно изменён!</Alert>
            <Button variant="contained" onClick={() => navigate('/login')}>
              Войти с новым паролем
            </Button>
          </Stack>
        ) : (
          <Box component="form" noValidate width="100%" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                required
                label="Новый пароль"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'white',
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
                    '&.Mui-focused': { backgroundColor: '#e3f2fd', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2', borderWidth: 2 } },
                  },
                }}
              />
              <TextField
                fullWidth
                required
                label="Повторите пароль"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ py: 1.5, borderRadius: 2, bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' }, fontWeight: 'bold' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Сохранить пароль'}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ResetPassword;