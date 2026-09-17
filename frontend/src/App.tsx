import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import ProtectedRoute from './components/ProtectedRoute';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import { PENDING_INVITE_KEY, getToken, safeGetString } from './utils/storage';

// ⭐ Шаг 99 (P1-6): React.lazy — каждая страница грузится своим чанком.
// Раньше первый вход тянул сразу все 24 страницы в одном бандле.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword')); // ⭐ P0-4
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Home = lazy(() => import('./pages/Home'));
const Objects = lazy(() => import('./pages/Objects'));
const Projects = lazy(() => import('./pages/Projects'));
const Materials = lazy(() => import('./pages/Materials'));
const PriceList = lazy(() => import('./pages/PriceList'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Help = lazy(() => import('./pages/Help'));
const Brigades = lazy(() => import('./pages/Brigades'));
const Warehouse = lazy(() => import('./pages/Warehouse'));
const Rentals = lazy(() => import('./pages/Rentals'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));

//  Фолбэк Suspense: пока чанк страницы едет по сети — крутилка по центру
const PageLoader = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

const AppRoutes = () => {
  useLocation();
  const navigate = useNavigate();
  const token = getToken();

  // ⭐ После логина возвращаем юзера на ссылку-приглашение (если он пришёл по ней)
  useEffect(() => {
    const pendingInvite = safeGetString(PENDING_INVITE_KEY);
    if (token && pendingInvite) {
      localStorage.removeItem(PENDING_INVITE_KEY);
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
      {/*  Публичная регистрация */}
      <Route
        path="/register"
        element={token ? <Navigate to="/" replace /> : <Register />}
      />
      {/* ⭐ Восстановление пароля (только для гостей) */}
      <Route
        path="/forgot-password"
        element={token ? <Navigate to="/" replace /> : <ForgotPassword />}
      />
      <Route path="/reset-password" element={<ResetPassword />} /> {/* ⭐ P0-4 */}
      {/*  Публичные правовые документы (доступны и гостям до регистрации) */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

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

      {/*  Публичная страница приглашения (доступна без логина) */}
      <Route path="/invite/:token" element={<AcceptInvite />} />

      {/* 404 редирект */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    // ⭐ Шаг 99 (P1-6): тема MUI + CssBaseline (theme.ts раньше не использовался)
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {/* ⭐ Шаг 100 (P1-8): AuthProvider ВНУТРИ Router — контексту доступен useNavigate (soft logout) */}
        <AuthProvider>
          {/* ⭐ Suspense для lazy-страниц */}
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;