import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicApp from './features/public/App.jsx';
import StudentApp from './features/student/StudentApp.jsx';
import { AuthProvider as StudentAuthProvider } from './features/student/context/AuthContext.jsx';
import InstructorApp from './features/instructor/InstructorApp.jsx';
import { AuthProvider as InstructorAuthProvider } from './features/instructor/context/AuthContext.jsx';
import { ToastProvider as InstructorToastProvider } from './features/instructor/context/ToastContext.jsx';
import { I18nProvider as InstructorI18nProvider } from './features/instructor/i18n/index.jsx';
import AdminApp from './features/admin/AdminApp.jsx';
import { AuthProvider as AdminAuthProvider } from './features/admin/contexts/AuthContext.jsx';
import ErrorBoundary from './features/student/components/ErrorBoundary.jsx';
import UnifiedLogin from './shared/auth/UnifiedLogin.jsx';
import UnifiedRegister from './shared/auth/UnifiedRegister.jsx';

/**
 * Top-level application router and root layout container.
 * - Serves Public Website feature slice on / (home, about, programs, research, training, news, contact, login)
 * - Serves Student Portal feature slice on /student/* (13 modules, student login, registration, auth context)
 * - Serves Unified Authentication at /login and /register
 */
export default function App() {
  return (
    <Routes>
      {/* Unified Authentication Routes (Dark SaaS Aerospace Identity) */}
      <Route path="/login" element={<UnifiedLogin />} />
      <Route path="/register" element={<UnifiedRegister />} />

      {/* Direct Academy & Portal Aliases */}
      <Route path="/academy" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="/portal" element={<Navigate to="/student/dashboard" replace />} />

      {/* Student Portal and Auth Routes */}
      <Route
        path="/student/*"
        element={
          <ErrorBoundary>
            <StudentAuthProvider>
              <StudentApp />
            </StudentAuthProvider>
          </ErrorBoundary>
        }
      />

      {/* Instructor Cockpit and Auth Routes */}
      <Route
        path="/instructor/*"
        element={
          <ErrorBoundary>
            <InstructorI18nProvider>
              <InstructorToastProvider>
                <InstructorAuthProvider>
                  <InstructorApp />
                </InstructorAuthProvider>
              </InstructorToastProvider>
            </InstructorI18nProvider>
          </ErrorBoundary>
        }
      />

      {/* Admin Platform and Governance Routes */}
      <Route
        path="/admin/*"
        element={
          <ErrorBoundary>
            <AdminAuthProvider>
              <AdminApp />
            </AdminAuthProvider>
          </ErrorBoundary>
        }
      />

      {/* Public Agency Website */}
      <Route path="/*" element={<PublicApp />} />
    </Routes>
  );
}
