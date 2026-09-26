import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Avatar, Chip, Stack, Divider,
  CircularProgress, Alert, Button,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import { useNavigate } from 'react-router-dom';
import { fetchTeam } from '../services/usersService';
import type { TeamObject, TeamMember } from '../services/usersService';
import type { AccessRole } from '../services/accessService';
import { getApiErrorMessage } from '../utils/errors';

// ⭐ Подпись роли (как на странице принятия приглашения)
const roleLabel = (role: AccessRole) => {
  switch (role) {
    case 'CUSTOMER': return '👑 Заказчик';
    case 'FOREMAN': return '👷 Прораб';
    case 'VIEWER': return '👁 Наблюдатель';
    default: return role;
  }
};

const roleColor = (role: AccessRole): 'success' | 'primary' | 'default' => {
  if (role === 'CUSTOMER') return 'success';
  if (role === 'FOREMAN') return 'primary';
  return 'default';
};

const displayName = (m: TeamMember) => m.fullName || m.email || m.phone || 'Без имени';

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTeam(await fetchTeam());
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить участников'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Участники</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Кто работает со мной на объектах. Приглашать и менять роли — в карточке объекта.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={load}>Повторить</Button>}
        >
          {error}
        </Alert>
      ) : team.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Пока нет объектов и участников.</Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/objects')}>
            Перейти к объектам
          </Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {team.map((obj) => (
            <Paper key={obj.id} sx={{ p: 2.5, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <HomeWorkIcon sx={{ color: '#1976d2' }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{obj.name}</Typography>
                {obj.isArchived && <Chip label="архив" size="small" variant="outlined" />}
                <Chip label={`Вы: ${roleLabel(obj.myRole)}`} size="small" variant="outlined" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {obj.address}
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {obj.members.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Нет участников</Typography>
              ) : (
                <Stack spacing={1}>
                  {obj.members.map((m) => (
                    <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{ width: 36, height: 36, bgcolor: '#1976d2', fontSize: '0.9rem', fontWeight: 700 }}
                      >
                        {(displayName(m)[0] || '?').toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{displayName(m)}</Typography>
                        {(m.email || m.phone) && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {m.email || m.phone}
                          </Typography>
                        )}
                      </Box>
                      <Chip label={roleLabel(m.role)} size="small" color={roleColor(m.role)} />
                      {m.hidePrices && <Chip label="🙈 без цен" size="small" variant="outlined" />}
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default Users;