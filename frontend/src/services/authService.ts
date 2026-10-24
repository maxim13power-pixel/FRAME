// frontend/src/services/authService.ts
// ⭐ P0-4: API-клиент для forgot/reset password
// ⭐ Шаг 99: используется общий api-инстанс; /auth/* исключены из авто-логаута по 401.
import api from './api';

export const forgotPassword = async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { token, newPassword });
  return response.data;
};

// ⭐ №160: «Выйти на всех устройствах» — бэкенд инкрементит tokenVersion,
// после чего все выданные ранее JWT (включая текущий) становятся невалидными.
export const logoutAll = async () => {
  const response = await api.post('/auth/logout-all');
  return response.data;
};
