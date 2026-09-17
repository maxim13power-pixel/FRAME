import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ⭐ Шаг 100 (P1-8): <AuthProvider> переехал ВНУТРЬ <BrowserRouter> (см. App.tsx).
// Пока он был снаружи, внутри AuthContext не работал useNavigate → soft logout
// приходилось делать через window.location.href (жёсткая перезагрузка SPA).
// ⭐ Шаг 99 (P1-6): импорт services/axiosInterceptor не нужен — Bearer-токен и
// обработка 401 живут в едином инстансе services/api.ts

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)