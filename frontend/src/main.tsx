import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'   // <-- добавить эту строку
import './services/axiosInterceptor'; // добавить после остальных импортов

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>      {/* <-- обернуть */}
      <App />
    </AuthProvider>     {/* <-- закрыть */}
  </StrictMode>,
)