import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import './styles/variables.css';
import './styles/global.css';

import ProtectedRoute from './routes/ProtectedRoute';
import RoleGuard from './routes/RoleGuard';
import DivisionGuard from './routes/DivisionGuard';
import AdminLayout from './layouts/AdminLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import AdminGatewayPage from './pages/admin/AdminGatewayPage';
import AdminManagementPage from './pages/admin/AdminManagementPage';
import DivisionOverviewPage from './pages/admin/DivisionOverviewPage';
import StudentsListPage from './pages/admin/StudentsListPage';
import StudentDetailPage from './pages/admin/StudentDetailPage';
import ProgramsPage from './pages/admin/ProgramsPage';
import InstructorManagementPage from './pages/admin/InstructorManagementPage';
import ApplicationsPage from './pages/admin/ApplicationsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import FinancePage from './pages/admin/FinancePage';
import CohortsPage from './pages/admin/CohortsPage';
import CertificatesPage from './pages/admin/CertificatesPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import ReportsPage from './pages/admin/ReportsPage';
import AssessmentsPage from './pages/admin/AssessmentsPage';
import FeedbackPage from './pages/admin/FeedbackPage';
import SessionMonitoringPage from './pages/admin/SessionMonitoringPage';
import AdminMessagesPage from './pages/admin/AdminMessagesPage';

import PublicVerifyPage from './pages/public/PublicVerifyPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

import { useAuth } from './hooks/useAuth';
import { ROLES } from './constants/roles';

function AdminIndexRoute() {
  const { user } = useAuth();
  if (user?.role === ROLES.SUPER_ADMIN) {
    return <AdminGatewayPage />;
  }
  if (user?.role === ROLES.PRE_UNIVERSITY_ADMIN) {
    return <Navigate to="/admin/PRE_UNIVERSITY" replace />;
  }
  if (user?.role === ROLES.UNIVERSITY_ADMIN) {
    return <Navigate to="/admin/UNIVERSITY" replace />;
  }
  return <Navigate to="/login?role=admin" replace />;
}

/**
 * Admin Feature Module
 * Mounted at `/admin/*` in the shared EGSA Academy frontend.
 */
export default function AdminApp() {
  return (
    <Routes>
      {/* Admin Authentication Routes */}
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="unauthorized" element={<UnauthorizedPage />} />

      {/* Certificate Verification (optional public utility) */}
      <Route path="verify/:token" element={<PublicVerifyPage />} />
      <Route path="verify" element={<PublicVerifyPage />} />

      {/* Protected Administrative Operations Area */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleGuard
              allowedRoles={[
                ROLES.SUPER_ADMIN,
                ROLES.PRE_UNIVERSITY_ADMIN,
                ROLES.UNIVERSITY_ADMIN,
              ]}
            />
          }
        >
          <Route element={<AdminLayout />}>
            {/* Super Admin & Division Index Handler */}
            <Route index element={<AdminIndexRoute />} />

            {/* Platform Administrator Management (Super Admin Exclusive) */}
            <Route
              path="administrators"
              element={
                <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}>
                  <AdminManagementPage />
                </RoleGuard>
              }
            />

            {/* Legacy un-scoped admin operational URL redirects */}
            <Route path="dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="instructors" element={<Navigate to="/admin" replace />} />
            <Route path="programs" element={<Navigate to="/admin" replace />} />
            <Route path="cohorts" element={<Navigate to="/admin" replace />} />
            <Route path="sessions" element={<Navigate to="/admin" replace />} />
            <Route path="assessments" element={<Navigate to="/admin" replace />} />
            <Route path="applications" element={<Navigate to="/admin" replace />} />
            <Route path="invoices" element={<Navigate to="/admin" replace />} />
            <Route path="payments" element={<Navigate to="/admin" replace />} />
            <Route path="certificates" element={<Navigate to="/admin" replace />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="notifications" element={<Navigate to="/admin" replace />} />
            <Route path="audit-logs" element={<Navigate to="/admin" replace />} />
            <Route path="reports" element={<Navigate to="/admin" replace />} />

            {/* Division-Scoped Administration Workspaces */}
            <Route path=":division" element={<DivisionGuard />}>
              <Route index element={<DivisionOverviewPage />} />
              <Route path="students" element={<StudentsListPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
              <Route path="instructors" element={<InstructorManagementPage />} />
              <Route path="programs" element={<ProgramsPage />} />
              <Route path="cohorts" element={<CohortsPage />} />
              <Route path="sessions" element={<SessionMonitoringPage />} />
              <Route path="assessments" element={<AssessmentsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="payments" element={<FinancePage />} />
              <Route path="invoices" element={<Navigate to="../payments" relative="path" replace />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="messages" element={<AdminMessagesPage />} />
              <Route path="messages/:conversationId" element={<AdminMessagesPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="messages/:conversationId" element={<AdminMessagesPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
