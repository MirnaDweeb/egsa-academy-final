import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Admin backend API: /admin-api/* -> http://localhost:5500/admin-api/*
      '/admin-api': {
        target: process.env.VITE_UNIFIED_API_URL || 'http://localhost:5500',
        changeOrigin: true,
      },
      // Instructor backend API: /api/v1/* -> http://localhost:5500/api/v1/*
      '/api/v1': {
        target: process.env.VITE_UNIFIED_API_URL || 'http://localhost:5500',
        changeOrigin: true,
      },
      // Student backend API: /api/* -> http://localhost:5500/api/*
      '/api': {
        target: process.env.VITE_UNIFIED_API_URL || 'http://localhost:5500',
        changeOrigin: true,
      },
      // Uploads proxy
      '/uploads': {
        target: process.env.VITE_UNIFIED_API_URL || 'http://localhost:5500',
        changeOrigin: true,
      },
    },
  },
});
