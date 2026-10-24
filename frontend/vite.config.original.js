import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Admin backend API: /admin-api/* -> http://localhost:5200/api/*
      '/admin-api': {
        target: process.env.VITE_ADMIN_API_URL || 'http://localhost:5200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin-api/, '/api'),
      },
      // Instructor backend API: /api/v1/* -> http://localhost:5100
      '/api/v1': {
        target: process.env.VITE_INSTRUCTOR_API_URL || 'http://localhost:5100',
        changeOrigin: true,
      },
      // Student backend API: /api/* -> http://localhost:5000
      '/api': {
        target: process.env.VITE_STUDENT_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Uploads proxy
      '/uploads': {
        target: process.env.VITE_STUDENT_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
