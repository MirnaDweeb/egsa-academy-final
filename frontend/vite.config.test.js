import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/admin-api': {
        target: 'http://localhost:5500',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:5500',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5500',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5500',
        changeOrigin: true,
      },
    },
  },
});
