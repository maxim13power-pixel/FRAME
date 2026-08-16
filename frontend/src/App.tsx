import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Objects from './pages/Objects';   
import Projects from './pages/Projects'; 
import Materials from './pages/Materials';
import PriceList from './pages/PriceList';
import Brigades from './pages/Brigades';   
import Warehouse from './pages/Warehouse';
import Rentals from './pages/Rentals';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный логин */}
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Защищённые маршруты – все внутри Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          {/* По умолчанию показываем, например, список объектов */}
          <Route index element={<Objects />} />
          <Route path="objects" element={<Objects />} />
          <Route path="objects/:objectId/projects" element={<Projects />} />
          <Route path="objects/:objectId/projects/:projectId/materials" element={<Materials />} />
          <Route path="price-list" element={<PriceList />} />
          <Route path="brigades" element={<Brigades />} />
          <Route path="warehouse" element={<Warehouse />} />
          <Route path="rentals" element={<Rentals />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 404 редирект */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;