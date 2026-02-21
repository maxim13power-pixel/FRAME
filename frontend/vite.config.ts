import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    allowedHosts: [
      'afd895d7-a7fe-4c8b-ab3d-36846b361263-00-2g1su4d4u7yw3.riker.replit.dev'
    ],
  },
})