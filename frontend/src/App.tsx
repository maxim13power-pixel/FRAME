import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

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
              <div>Главная страница (скоро тут будет дашборд)</div>
            </ProtectedRoute>
          }
        />

        {/* Пример: сюда позже добавим /objects, /equipment и т.д. */}
        <Route
          path="/objects"
          element={
            <ProtectedRoute>
              <div>Список объектов</div>
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