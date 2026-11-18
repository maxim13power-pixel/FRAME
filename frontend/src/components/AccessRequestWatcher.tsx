// frontend/src/components/AccessRequestWatcher.tsx
// ⭐ №309: невидимый наблюдатель за заявками на доступ. Живёт рядом с AppRoutes,
// поэтому уведомление всплывает на любой странице, а не только в «Объектах».
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAccessRequestNotifications } from '../hooks/useAccessRequestNotifications';

const AccessRequestWatcher: React.FC = () => {
  const { token } = useAuth();
  // Без токена ничего не запрашиваем: страницы логина/лендинга не должны дёргать API
  useAccessRequestNotifications(Boolean(token));
  return null;
};

export default AccessRequestWatcher;
