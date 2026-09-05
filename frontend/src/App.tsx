import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Objects from './pages/Objects';   
import Projects from './pages/Projects'; 
import Materials from './pages/Materials';
import PriceList from './pages/PriceList';
import Calculators from './pages/Calculators';
import Help from './pages/Help';
import Brigades from './pages/Brigades';   
import Warehouse from './pages/Warehouse';
import Rentals from './pages/Rentals';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import AcceptInvite from './pages/AcceptInvite';

const AppRoutes = () => {
  useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // ⭐ После логина возвращаем юзера на ссылку-приглашение (если он пришёл по ней)
  useEffect(() => {
    const pendingInvite = localStorage.getItem('pendingInviteToken');
    if (token && pendingInvite) {
      localStorage.removeItem('pendingInviteToken');
      navigate(`/invite/${pendingInvite}`, { replace: true });
    }
  }, [token, navigate]);
  return (
    <Routes>
      {/* Публичный логин */}
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <Login />}
      />
      {/* ⭐ Публичная регистрация */}
      <Route
        path="/register"
        element={token ? <Navigate to="/" replace /> : <Register />}
      />

        {/* Гостям показываем лендинг, авторизованных ведём в приложение */}
        <Route
          path="/"
          element={
            token ? (
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            ) : (
              <Landing />
            )
          }
        >
             {/* После логина попадаем на Главную (командный центр прораба) */}
        <Route index element={<Home />} />
        <Route path="home" element={<Home />} />
        <Route path="objects" element={<Objects />} />
          <Route path="objects/:objectId/projects" element={<Projects />} />
          <Route path="objects/:objectId/projects/:projectId/materials" element={<Materials />} />
          <Route path="price-list" element={<PriceList />} />
          <Route path="calculators" element={<Calculators />} />
          <Route path="help" element={<Help />} />
          <Route path="brigades" element={<Brigades />} />
          <Route path="warehouse" element={<Warehouse />} />
          <Route path="rentals" element={<Rentals />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* ⭐ Публичная страница приглашения (доступна без логина) */}
        <Route path="/invite/:token" element={<AcceptInvite />} />

        {/* 404 редирект */}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;