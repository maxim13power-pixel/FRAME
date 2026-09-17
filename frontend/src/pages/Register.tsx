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
  Checkbox,
  FormControlLabel,
  Stack,
} from '@mui/material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import SmartCaptcha from '../components/SmartCaptcha';
import { getApiErrorMessage } from '../utils/errors';
// ⭐ Шаг 63: регистрация ТОЛЬКО по email (переключатель убран по продуктовому решению).
// Стиль полей — ТОЧНО как на странице логина (outlined, белый фон, синяя рамка при фокусе).
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    backgroundColor: 'white',
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
    '&.Mui-focused': {
      backgroundColor: '#e3f2fd',
      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2', borderWidth: 2 },
    },
  },
};

const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false); // ⭐ 152-ФЗ: согласие обязательно
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Укажите ваше имя');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Укажите корректный E-mail');
      return;
    }
    if (password.length < 6) {
      setError('Пароль минимум 6 символов');
      return;
    }
    if (!consent) {
      setError('Для продолжения необходимо согласие с условиями');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        fullName: fullName.trim(),
        password,
        email: email.trim(),
        captchaToken: captchaToken ?? undefined, // ⭐ токен капчи для бэка
      });
      // ⭐ Редирект делает App.tsx (useEffect + защита маршрута) — без дублей
      login(response.data.access_token, response.data.user);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Ошибка регистрации'));
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
        p: 0,
      }}
    >
      <Paper
        elevation={0}
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
        {/* ⭐ Ссылка на внешний сайт-заглушку (единообразно с Login) */}
        <Link
          href="https://web.max.ru/-77702883548569"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ alignSelf: 'flex-start', mb: 1, color: '#1565c0', fontSize: '0.9rem' }}
        >
          ← Вернуться на сайт
        </Link>

        <Avatar src="/images/frame-logo2.svg" alt="FRAME" sx={{ width: 90, height: 90, mb: 1 }} />

        {/* ⭐ Заголовок по центру, шрифт меньше (h5), отступ 16px */}
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#04164b', mb: 2, textAlign: 'center' }}>
          Регистрация
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
          Если вы уже зарегистрированы, пожалуйста перейдите на страницу{' '}
          <Link
            component="button"
            type="button"
            onClick={() => navigate('/login')}
            underline="always"
            sx={{
              color: '#1976d2',
              fontSize: '0.9rem', // ⭐ как в Login (единообразие)
              p: 0,
              lineHeight: 'inherit',
              verticalAlign: 'baseline',
            }}
          >
            входа в систему
          </Link>
        </Typography>

        <Box component="form" noValidate width="100%" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              required
              margin="none"
              label="Ваше имя"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={fieldSx}
            />
            <TextField
              fullWidth
              required
              margin="none"
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={fieldSx}
            />
            <TextField
              fullWidth
              required
              margin="none"
              label="Придумайте пароль"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={fieldSx}
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
          </Stack>
{/* ⭐ Шаг 76: капча Yandex SmartCaptcha (защита от ботов) */}
<Box sx={{ mt: 2 }}>
<SmartCaptcha onTokenChange={(t) => { setCaptchaToken(t); console.log('✅ token:', t ? 'OK' : 'null'); }} />
</Box>
          {/* ⭐ 152-ФЗ: согласие обязательно, ссылки ведут на реальные страницы */}
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} color="primary" />}
            label={
              <Typography variant="body2" sx={{ fontSize: '0.88rem' }}>
                Я согласен с{' '}
                <Link component="button" type="button" onClick={() => navigate('/terms')} sx={{ color: '#1976d2', fontSize: '0.88rem' }}>
                  условиями обслуживания
                </Link>{' '}
                и{' '}
                <Link component="button" type="button" onClick={() => navigate('/privacy')} sx={{ color: '#1976d2', fontSize: '0.88rem' }}>
                  политикой конфиденциальности
                </Link>
              </Typography>
            }
            sx={{ mt: 2, alignItems: 'flex-start' }}
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
              mt: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0' },
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            {loading ? 'Создаём аккаунт...' : 'Продолжить'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Register;