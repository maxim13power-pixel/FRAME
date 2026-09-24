import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // ⭐ Шаг 111: вендоры — в отдельные чанки. Они меняются редко, поэтому браузер
        // держит их в кэше между деплоями, а обновляется только код приложения.
        // ВАЖНО: сюда попадают ТОЛЬКО реально установленные пакеты — Rollup падает,
        // если указать модуль, которого нет в node_modules (например date-fns тут нет).
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['axios'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      '@emotion/react', 
      '@emotion/styled', 
      '@mui/material',
      '@mui/icons-material',
      '@mui/styled-engine'
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})