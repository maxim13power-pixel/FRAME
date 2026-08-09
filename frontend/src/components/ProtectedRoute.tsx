import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token } = useAuth();

  // Если нет токена – редирект на логин
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Если токен есть – показываем защищённый контент
  return <>{children}</>;
};

export default ProtectedRoute;