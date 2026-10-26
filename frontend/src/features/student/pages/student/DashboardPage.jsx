import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/studentService';
import { attendanceService } from '../../services/studentPortalServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorState } from '../../components/StateComponents.jsx';

// Institutional Dashboard Subcomponents
import DashboardHero from '../../components/student/dashboard/DashboardHero.jsx';
import DashboardStats from '../../components/student/dashboard/DashboardStats.jsx';
import CurrentTrainingCard from '../../components/student/dashboard/CurrentTrainingCard.jsx';
import QuickActions from '../../components/student/dashboard/QuickActions.jsx';
import UpcomingItems from '../../components/student/dashboard/UpcomingItems.jsx';
import NotificationsPreview from '../../components/student/dashboard/NotificationsPreview.jsx';
import ActivityTimeline from '../../components/student/dashboard/ActivityTimeline.jsx';
import DashboardSkeleton from '../../components/student/dashboard/DashboardSkeleton.jsx';

import './DashboardPage.css';

/**
 * Egyptian Space Agency — National Space Technology Training Platform
 * Student Operations & Academic Trajectory Dashboard
 */
export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      dashboardService.get(),
      attendanceService.getStudentAttendance().catch(() => null),
    ])
      .then(([dashRes, attRes]) => {
        setData(dashRes.data);
        setAttendanceData(attRes);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Unable to retrieve academic records from Egyptian Space Agency servers.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const {
    profile,
    learningPath,
    currentApplication,
    applications = [],
    upcomingEnrollments = [],
    recommendations = [],
    notifications = [],
    unreadNotificationsCount = 0,
    certificatesCount = 0,
    upcomingSessions = [],
    upcomingAssessments = [],
    timeline = [],
  } = data;

  const progressPct =
    learningPath && learningPath.totalCourses > 0
      ? Math.round((learningPath.completedCount / learningPath.totalCourses) * 100)
      : 0;

  const activeApplicationsCount = applications.filter((a) =>
    [
      'Submitted',
      'Under Review',
      'Needs Information',
      'Readiness Required',
      'Manual Review',
      'Accepted',
      'Eligible - Payment Pending',
    ].includes(a.status)
  ).length;

  // Determine if there is an active urgent gate
  let urgentGate = null;
  if (
    currentApplication?.status === 'Accepted' ||
    currentApplication?.status === 'Eligible - Payment Pending'
  ) {
    urgentGate = {
      type: 'urgent',
      badge: 'ACTION REQUIRED',
      title: 'Tuition Settlement & Package Selection Required',
      message: `Your application for "${currentApplication.course?.title}" is accepted. Select logistics and confirm tuition.`,
      deadline: 'Pending Settle',
      actionLabel: 'Select Package & Pay',
      actionLink: '/student/payments',
    };
  } else if (currentApplication?.status === 'Readiness Required') {
    urgentGate = {
      type: 'urgent',
      badge: 'DIAGNOSTIC GATE',
      title: 'Prerequisite Readiness Assessment Required',
      message: `Complete the 10-question technical diagnostic for "${currentApplication.course?.title}" to advance review.`,
      deadline: 'Prerequisite Check',
      actionLabel: 'Start Readiness Test',
      actionLink: `/student/readiness/start?courseId=${currentApplication.course?._id}`,
    };
  }

  const hasPendingPayment =
    currentApplication?.status === 'Accepted' ||
    currentApplication?.status === 'Eligible - Payment Pending';
  const hasPendingReadiness = currentApplication?.status === 'Readiness Required';

  return (
    <div className="egsa-dashboard-root">
      {/* 1. Dashboard Hero Section */}
      <DashboardHero
        user={authUser}
        profile={profile}
        currentApplication={currentApplication}
        upcomingEnrollments={upcomingEnrollments}
        urgentGate={urgentGate}
      />

      {/* 2. Key Academic & Training Statistics Grid */}
      <DashboardStats
        enrollmentsCount={upcomingEnrollments.length}
        applicationsCount={applications.length}
        activeApplicationsCount={activeApplicationsCount}
        attendanceData={attendanceData}
        progressPct={progressPct}
        learningPath={learningPath}
        certificatesCount={certificatesCount}
      />

      {/* 3. Quick Operational Actions Grid (Compact, evenly distributed) */}
      <div className="mb-4">
        <QuickActions
          hasActiveEnrollment={upcomingEnrollments.length > 0}
          hasActiveApplication={applications.length > 0}
          hasPendingPayment={hasPendingPayment}
          hasPendingReadiness={hasPendingReadiness}
          currentApplicationId={currentApplication?._id}
          readinessCourseId={currentApplication?.course?._id}
        />
      </div>

      {/* 4. Main Operational Area: Current Training & Upcoming Schedule Side by Side */}
      <div className="row g-4 mb-4 align-items-stretch">
        {/* Active Enrolled Training Program / Unified Training Overview */}
        <div className="col-12 col-lg-7 col-xl-8">
          <CurrentTrainingCard
            enrollments={upcomingEnrollments}
            applications={applications}
            attendanceData={attendanceData}
            upcomingSessions={upcomingSessions}
            upcomingAssessments={upcomingAssessments}
          />
        </div>

        {/* Real Upcoming Items, Sessions & Urgent Deadlines */}
        <div className="col-12 col-lg-5 col-xl-4">
          <UpcomingItems
            upcomingSessions={upcomingSessions}
            upcomingAssessments={upcomingAssessments}
            urgentGate={urgentGate}
          />
        </div>
      </div>

      {/* 5. Specialization Trajectory / Learning Roadmap */}
      {learningPath && (
        <div className="mb-4">
          <div className="egsa-institutional-card" aria-labelledby="roadmap-heading">
            <div className="card-header-clean">
              <div className="d-flex align-items-center gap-2">
                <span className="card-header-icon-pill">
                  <i className="fa-solid fa-route text-secondary-egsa"></i>
                </span>
                <div>
                  <span className="card-overline">Specialization Trajectory</span>
                  <h2 id="roadmap-heading" className="card-heading-title">
                    Curriculum Track — {learningPath.title}
                  </h2>
                </div>
              </div>
              <Link to="/student/learning-path" className="clean-action-link">
                Full Roadmap <i className="fa-solid fa-arrow-right ms-1"></i>
              </Link>
            </div>

            <div className="p-3 p-md-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center text-muted small mb-2 gap-2">
                <span>
                  {learningPath.completedCount} of {learningPath.totalCourses} courses completed
                </span>
                <span className="fw-bold text-dark">{progressPct}% Complete</span>
              </div>

              <div className="training-progress-track" style={{ height: '8px' }}>
                <div
                  className="training-progress-fill fill-qualified"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Secondary Content: Notifications Preview & Activity Timeline Side by Side */}
      <div className="row g-4 mb-4 align-items-stretch">
        <div className="col-12 col-lg-6">
          <NotificationsPreview
            notifications={notifications}
            unreadCount={unreadNotificationsCount}
          />
        </div>

        <div className="col-12 col-lg-6">
          <ActivityTimeline timeline={timeline} />
        </div>
      </div>

      {/* 7. Recommended Programs Based on Goal */}
      {recommendations?.length > 0 && (
        <div className="egsa-institutional-card mb-4" aria-labelledby="recommendations-heading">
          <div className="card-header-clean">
            <div className="d-flex align-items-center gap-2">
              <span className="card-header-icon-pill">
                <i className="fa-solid fa-wand-magic-sparkles text-accent-egsa"></i>
              </span>
              <div>
                <span className="card-overline">Specialization Recommendations</span>
                <h2 id="recommendations-heading" className="card-heading-title">
                  Courses Recommended for Your Trajectory
                </h2>
              </div>
            </div>
            <Link to="/student/programs" className="clean-action-link">
              Full Catalog <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>

          <div className="row g-3">
            {recommendations.slice(0, 4).map((c) => (
              <div key={c._id} className="col-12 col-sm-6 col-lg-3">
                <div className="p-3 border rounded h-100 d-flex flex-column justify-content-between bg-surface-subtle recommendation-subcard">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="code-pill">{c.level || 'Accredited'}</span>
                      <span className="fw-bold small text-accent-egsa">
                        {c.price != null ? `${c.price} EGP` : 'Tuition TBA'}
                      </span>
                    </div>
                    <h3 className="h6 fw-bold text-dark mb-1">{c.title}</h3>
                    <p className="text-muted small mb-3 text-truncate-2">
                      {c.shortDescription || c.overview || 'Comprehensive space technology training.'}
                    </p>
                  </div>
                  <div className="d-flex gap-2 mt-auto pt-2">
                    <Link
                      to={`/student/courses/${c._id}`}
                      className="btn btn-outline-primary btn-sm flex-grow-1"
                    >
                      Details
                    </Link>
                    {c.price != null && (
                      <Link
                        to={`/student/courses/${c._id}/fit`}
                        className="btn btn-primary btn-sm flex-grow-1"
                      >
                        Check Fit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {recommendations.length > 4 && (
            <div className="card-bottom-action pt-3 mt-3 border-top text-center">
              <Link
                to="/student/programs"
                className="btn btn-light btn-sm w-100 fw-semibold text-primary d-inline-flex align-items-center justify-content-center gap-2"
              >
                <span>Explore All Recommended Courses ({recommendations.length})</span>
                <i className="fa-solid fa-arrow-right small"></i>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
