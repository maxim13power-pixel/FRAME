import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token } = useAuth();
  const location = useLocation();

  // ⭐ Шаг 99 (P1-6): нет токена → редирект на логин с запоминанием исходного адреса,
  // чтобы после успешного входа вернуть пользователя на защищённую страницу.
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Если токен есть – показываем защищённый контент
  return <>{children}</>;
};

export default ProtectedRoute;