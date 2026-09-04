import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useParams, useNavigate } from 'react-router-dom';
import { getInviteInfo, acceptInvite } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import type { AccessRole } from '../services/accessService';

// ⭐ Инфа о приглашении (приходит с публичного эндпоинта)
interface InviteInfo {
  token: string;
  role: AccessRole;
  hidePrices: boolean;
  creator: { id: number; fullName: string | null; email: string | null; phone: string | null };
  object: { id: number; name: string; address: string };
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
}

const roleLabel = (role: AccessRole) => {
  switch (role) {
    case 'CUSTOMER': return '👑 Заказчик';
    case 'FOREMAN': return '👷 Прораб';
    case 'VIEWER': return '👁 Наблюдатель';
    default: return role;
  }
};

const AcceptInvite: React.FC = () => {
  const { token: inviteToken } = useParams<{ token: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // ⭐ Загружаем инфу о приглашении (публичный эндпоинт, без JWT)
  useEffect(() => {
    if (!inviteToken) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getInviteInfo(inviteToken);
        setInfo(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Не удалось загрузить приглашение');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [inviteToken]);

  // ⭐ Принять приглашение (для залогиненных)
  const handleAccept = async () => {
    if (!token || !inviteToken) return;
    setAccepting(true);
    setError('');
    try {
      await acceptInvite(token, inviteToken);
      setAccepted(true);
      // Через 1.5 сек уводим в список объектов
      setTimeout(() => navigate('/objects'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось принять приглашение');
    } finally {
      setAccepting(false);
    }
  };

  // ⭐ Для незалогиненных: запоминаем ссылку и ведём на логин
  const handleGoLogin = () => {
    if (!inviteToken) return;
    localStorage.setItem('pendingInviteToken', inviteToken);
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f0f4fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, borderRadius: 3, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        {loading ? (
          <Box sx={{ py: 4 }}><CircularProgress /></Box>
        ) : error && !info ? (
          /* Ссылка не найдена / отозвана / истекла */
          <>
            <Typography variant="h6" gutterBottom>😕 Что-то пошло не так</Typography>
            <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
            <Button variant="contained" onClick={() => navigate('/')}>На главную</Button>
          </>
        ) : accepted ? (
          /* Успешное принятие */
          <>
            <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
            <Typography variant="h6" gutterBottom>Приглашение принято!</Typography>
            <Typography color="text.secondary">Перенаправляем вас в список объектов…</Typography>
          </>
        ) : info ? (
          /* Карточка приглашения */
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              📩 Приглашение в <span style={{ color: '#1976d2' }}>FRAME</span>
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {info.creator.fullName || info.creator.email || info.creator.phone} приглашает вас
            </Typography>

            <Box sx={{ bgcolor: '#f5f7fa', borderRadius: 2, p: 2, mb: 2, textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HomeWorkIcon sx={{ color: '#1976d2' }} />
                <Typography variant="h6">{info.object.name}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">{info.object.address}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Ваша роль:</Typography>
                <Chip
                  label={roleLabel(info.role)}
                  size="small"
                  color={info.role === 'CUSTOMER' ? 'success' : 'primary'}
                />
              </Stack>
              {info.hidePrices && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  🙈 Цены будут скрыты для вас — вы увидите объёмы и прогресс работ.
                </Typography>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {token ? (
              <Button variant="contained" size="large" fullWidth onClick={handleAccept} disabled={accepting}>
                {accepting ? <CircularProgress size={24} /> : '✅ Принять приглашение'}
              </Button>
            ) : (
              <>
                <Button variant="contained" size="large" fullWidth onClick={handleGoLogin}>
                  🔑 Войти и принять
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  После входа вы автоматически вернётесь на эту страницу.
                </Typography>
              </>
            )}
          </>
        ) : null}
      </Paper>
    </Box>
  );
};

export default AcceptInvite;