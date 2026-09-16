import axios from 'axios';

// ⭐ Шаг 97: централизованный обработчик ошибок API.
// Не делаем hard reload на 401 — это ломает формы логина и deep-links.
// Вместо этого диспатчим событие, на которое подписан AuthContext.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Только если мы уже были авторизованы — чистим сессию.
      // Если 401 пришёл от /auth/login или /auth/register — ничего не делаем,
      // пусть страница сама покажет ошибку "Неверный пароль".
      const authEndpoint = error.config?.url?.includes('/auth/');
      if (!authEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        // Мягкий редирект через роутер (не ломает состояние)
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // 403 и 500 тоже ловим — раньше молча проглатывались
    if (status === 403) {
      console.warn('⚠️ Доступ запрещён:', error.response?.data?.message);
    }
    if (status >= 500) {
      console.error('❌ Ошибка сервера:', error.response?.data?.message || error.message);
    }

    return Promise.reject(error);
  },
);