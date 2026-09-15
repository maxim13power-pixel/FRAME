// frontend/src/services/authService.ts
// ⭐ P0-4: API-клиент для forgot/reset password
import axios from 'axios';
import { API_BASE_URL } from '../config';

const authApi = axios.create({
  baseURL: API_BASE_URL,
});

export const forgotPassword = async (email: string) => {
  const response = await authApi.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token: string, newPassword: string) => {
  const response = await authApi.post('/auth/reset-password', { token, newPassword });
  return response.data;
};