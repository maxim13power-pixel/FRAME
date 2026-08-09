import axios from 'axios';

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Очищаем localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Перенаправляем на страницу входа (полная перезагрузка страницы)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);