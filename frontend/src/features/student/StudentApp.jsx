import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

import MainLayout from './layouts/MainLayout.jsx';
import StudentLayout from './layouts/StudentLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Auth Pages
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import { VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthExtras.jsx';

// Student Portal Pages (13 Core Modules)
import DashboardPage from './pages/student/DashboardPage.jsx';
import ExploreProgramsPage from './pages/student/ExploreProgramsPage.jsx';
import CourseDetailsPage from './pages/student/CourseDetailsPage.jsx';
import CourseFitPage from './pages/student/CourseFitPage.jsx';
import ApplicationDetailPage from './pages/student/ApplicationDetailPage.jsx';
import FoundationReviewPage from './pages/student/FoundationReviewPage.jsx';
import TrainingPage from './pages/student/TrainingPage.jsx';
import TrainingWorkspace from './pages/student/TrainingWorkspace.jsx';
import AttendancePage from './pages/student/AttendancePage.jsx';
import AssessmentsPage from './pages/student/AssessmentsPage.jsx';
import ReadinessStartPage from './pages/student/ReadinessStartPage.jsx';
import ReadinessAssessmentPage from './pages/student/ReadinessAssessmentPage.jsx';
import ReadinessResultPage from './pages/student/ReadinessResultPage.jsx';
import ProgressPage from './pages/student/ProgressPage.jsx';
import GoalPage from './pages/student/GoalPage.jsx';
import LearningPathPage from './pages/student/LearningPathPage.jsx';
import EvaluationPage from './pages/student/EvaluationPage.jsx';
import PaymentsPage from './pages/student/PaymentsPage.jsx';
import MockCheckoutPage from './pages/student/MockCheckoutPage.jsx';
import MediaPage from './pages/student/MediaPage.jsx';
import CertificatePage from './pages/student/CertificatePage.jsx';
import NotificationsPage from './pages/student/NotificationsPage.jsx';
import MessagesPage from './pages/student/MessagesPage.jsx';
import ContactAdminPage from './pages/student/ContactAdminPage.jsx';
import ContactInstructorPage from './pages/student/ContactInstructorPage.jsx';
import ProfilePage from './pages/student/ProfilePage.jsx';

export default function StudentApp() {
  return (
    <Routes>
      {/* Student Authentication Pages */}
      <Route element={<MainLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Protected Student Portal with StudentLayout (Persistent Sidebar) */}
      <Route element={<ProtectedRoute />}>
        {/* Isolated Mock Checkout Route */}
        <Route path="payments/mock-checkout" element={<MockCheckoutPage />} />

        <Route element={<StudentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* 2. Explore Programs */}
          <Route path="programs" element={<ExploreProgramsPage />} />
          <Route path="courses" element={<ExploreProgramsPage />} />
          <Route path="courses/:id" element={<CourseDetailsPage />} />
          <Route path="courses/:id/fit" element={<CourseFitPage />} />
          <Route path="programs/:id" element={<CourseDetailsPage />} />
          <Route path="programs/:id/fit" element={<CourseFitPage />} />

          {/* 3. Training & Applications Unified Hub */}
          <Route path="applications" element={<Navigate to="/student/training?tab=applications" replace />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="applications/:id/foundation" element={<FoundationReviewPage />} />

          {/* 4. My Training & Interactive Program Workspace */}
          <Route path="training" element={<TrainingPage />} />
          <Route path="training/:programId" element={<TrainingWorkspace />} />
          <Route path="workspace/:programId" element={<TrainingWorkspace />} />
          <Route path="my-training" element={<Navigate to="/student/training" replace />} />
          <Route path="my-courses" element={<Navigate to="/student/training" replace />} />
          <Route path="enrollments" element={<Navigate to="/student/training" replace />} />

          {/* 5. Attendance */}
          <Route path="attendance" element={<AttendancePage />} />

          {/* 6. Assessments */}
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="readiness/start" element={<ReadinessStartPage />} />
          <Route path="readiness/:attemptId" element={<ReadinessAssessmentPage />} />
          <Route path="readiness/:attemptId/result" element={<ReadinessResultPage />} />

          {/* 7. My Progress */}
          <Route path="progress" element={<ProgressPage />} />
          <Route path="goal" element={<GoalPage />} />
          <Route path="learning-path" element={<LearningPathPage />} />

          {/* 8. Evaluation */}
          <Route path="evaluation" element={<EvaluationPage />} />
          <Route path="feedback" element={<EvaluationPage />} />

          {/* 9. Payments */}
          <Route path="payments" element={<PaymentsPage />} />

          {/* 10. Learning Hub (formerly My Media) */}
          <Route path="learning-hub" element={<MediaPage />} />
          <Route path="media" element={<MediaPage />} />

          {/* 11. Certificate */}
          <Route path="certificate" element={<CertificatePage />} />
          <Route path="certificates" element={<CertificatePage />} />

          {/* 12. Notifications */}
          <Route path="notifications" element={<NotificationsPage />} />

          {/* 13. Contact & Communications with Administration and Instructors */}
          <Route path="contact" element={<ContactAdminPage />} />
          <Route path="contact/:conversationId" element={<ContactAdminPage />} />
          <Route path="contact-admin" element={<ContactAdminPage />} />
          <Route path="contact-admin/:conversationId" element={<ContactAdminPage />} />
          <Route path="contact-instructor" element={<ContactInstructorPage />} />
          <Route path="contact-instructor/:conversationId" element={<ContactInstructorPage />} />
          <Route path="messages" element={<Navigate to="/student/contact-admin" replace />} />
          <Route path="messages/:conversationId" element={<ContactAdminPage />} />

          {/* 14. My Profile */}
          <Route path="profile" element={<ProfilePage />} />

          {/* Catch-all student route */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
