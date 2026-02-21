import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный маршрут: если уже залогинен, уходим с логина на главную */}
        <Route
          path="/login"
          element={
            token ? <Navigate to="/" replace /> : <Login />
          }
        />

        {/* Защищённые маршруты */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
            <Dashboard />  
            </ProtectedRoute>
          }
        />

        {/* Пример: сюда позже добавим /objects, /equipment и т.д. */}
        <Route
          path="/objects"
          element={
            <ProtectedRoute>
              <div>Объекты</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/brigades"
          element={
            <ProtectedRoute>
              <div>Бригады</div>
            </ProtectedRoute>
          }
        />
<Route
  path="/warehouse"
  element={
    <ProtectedRoute>
      <div>Склад</div>
    </ProtectedRoute>
  }
/>
<Route
  path="/rentals"
  element={
    <ProtectedRoute>
      <div>Аренда</div>
    </ProtectedRoute>
  }
/>
<Route
  path="/analytics"
  element={
    <ProtectedRoute>
      <div>Аналитика</div>
    </ProtectedRoute>
  }
/>
<Route
  path="/reports"
  element={
    <ProtectedRoute>
      <div>Отчеты</div>
    </ProtectedRoute>
  }
/>
<Route
  path="/users"
  element={
    <ProtectedRoute>
      <div>Пользователи</div>
    </ProtectedRoute>
  }
/>
<Route
  path="/settings"
  element={
    <ProtectedRoute>
      <div>Настройки</div>
    </ProtectedRoute>
  }
/>
        
        {/* Если маршрут не найден — редирект на логин или на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;