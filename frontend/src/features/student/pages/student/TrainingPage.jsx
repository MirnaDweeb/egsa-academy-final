import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { enrollmentService, applicationService, notificationService } from '../../services/cycleServices';
import {
  attendanceService,
  portalAssessmentService,
  evaluationService,
  certificateCriteriaService,
} from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import './TrainingPage.css';

// Training Cockpit Modular Components
import StudentTrainingHero from '../../components/training/StudentTrainingHero';
import TrainingProgress from '../../components/training/TrainingProgress';
import LearningTrajectory from '../../components/training/LearningTrajectory';
import NextTrainingAction from '../../components/training/NextTrainingAction';
import TrainingSchedule from '../../components/training/TrainingSchedule';
import AttendanceSnapshot from '../../components/training/AttendanceSnapshot';
import AssessmentSnapshot from '../../components/training/AssessmentSnapshot';
import CurriculumProgress from '../../components/training/CurriculumProgress';
import InstructorCard from '../../components/training/InstructorCard';
import TrainingResources from '../../components/training/TrainingResources';
import TrainingNotifications from '../../components/training/TrainingNotifications';
import TrainingQuickActions from '../../components/training/TrainingQuickActions';
import TrainingJourney from '../../components/training/TrainingJourney';
import QRCheckInModal from '../../components/training/QRCheckInModal';
import TrainingMediaSnapshot from '../../components/training/TrainingMediaSnapshot';
import TrainingAssessmentsSection from '../../components/training/TrainingAssessmentsSection';

export default function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [activeTab, setActiveTab] = useState(
    ['all', 'in_progress', 'applications', 'completed'].includes(initialTab)
      ? initialTab
      : 'all'
  );

  const [enrollments, setEnrollments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [assessmentsData, setAssessmentsData] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [certStatus, setCertStatus] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
  const [showCockpit, setShowCockpit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // QR Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSessionForQR, setSelectedSessionForQR] = useState(null);

  // Sync tab with URL query parameter
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'all') {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const loadAllTrainingData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        enrRes,
        appRes,
        attRes,
        assessRes,
        evalRes,
        certRes,
        notifRes,
      ] = await Promise.all([
        enrollmentService.my().catch(() => ({ data: [] })),
        applicationService.my().catch(() => ({ data: [] })),
        attendanceService.getStudentAttendance().catch(() => null),
        portalAssessmentService.getAssessments().catch(() => ({ courseAssessments: [] })),
        evaluationService.getEvaluations().catch(() => []),
        certificateCriteriaService.getCertificateStatus().catch(() => null),
        notificationService.list().catch(() => ({ data: [] })),
      ]);

      const enrList = enrRes.data || [];
      const appList = appRes.data || [];

      setEnrollments(enrList);
      setApplications(appList);
      setAttendanceData(attRes);
      setAssessmentsData(assessRes.courseAssessments || []);
      setEvaluations(evalRes || []);
      setCertStatus(certRes);
      setNotifications(notifRes.data || []);

      // If there is an active enrollment, set as default cockpit target
      const activeEnr = enrList.find((e) => e.status === 'Active') || enrList[0];
      if (activeEnr) {
        setSelectedEnrollmentId(activeEnr._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize unified Training Hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTrainingData();
  }, []);

  // 1. Normalized Lifecycle Items
  const unifiedPrograms = useMemo(() => {
    const list = [];
    const enrolledCourseIds = new Set();

    // Add enrollments
    enrollments.forEach((enr) => {
      const courseId = enr.course?._id || enr.course;
      if (courseId) enrolledCourseIds.add(String(courseId));

      let lifecycleState = 'IN_PROGRESS';
      let priorityRank = 2;

      if (enr.status === 'Completed') {
        lifecycleState = 'COMPLETED';
        priorityRank = 4;
      } else if (enr.status === 'Active') {
        lifecycleState = 'IN_PROGRESS';
        priorityRank = 2;
      } else if (enr.status === 'Confirmed') {
        const startDate = enr.cohort?.startDate || enr.course?.startDate;
        const isStarted = startDate && new Date(startDate) <= new Date();
        lifecycleState = isStarted ? 'IN_PROGRESS' : 'UPCOMING';
        priorityRank = isStarted ? 2 : 3;
      }

      list.push({
        id: enr._id,
        enrollmentId: enr._id,
        course: enr.course,
        cohort: enr.cohort,
        type: 'enrollment',
        rawEnrollment: enr,
        lifecycleState,
        priorityRank,
        status: enr.status,
        updatedAt: enr.updatedAt || enr.createdAt,
      });
    });

    // Add applications (skip duplicate if course already enrolled unless application has pending gate)
    applications.forEach((app) => {
      const courseId = app.course?._id || app.course;
      const isAlreadyEnrolled = courseId && enrolledCourseIds.has(String(courseId));

      const isActionRequired = [
        'Accepted',
        'Eligible - Payment Pending',
        'Readiness Required',
        'Needs Information',
        'Foundation Recommended',
      ].includes(app.status);

      // If already enrolled and not in action gate, enrollment card handles it
      if (isAlreadyEnrolled && !isActionRequired) return;

      let lifecycleState = 'PENDING_REVIEW';
      let priorityRank = 3;

      if (isActionRequired) {
        lifecycleState = 'ACTION_REQUIRED';
        priorityRank = 1; // Highest priority
      } else if (['Submitted', 'Under Review', 'Manual Review', 'Waitlisted'].includes(app.status)) {
        lifecycleState = 'PENDING_REVIEW';
        priorityRank = 3;
      } else if (app.status === 'Completed') {
        lifecycleState = 'COMPLETED';
        priorityRank = 4;
      } else if (['Cancelled', 'Rejected'].includes(app.status)) {
        lifecycleState = 'CANCELLED';
        priorityRank = 5;
      }

      list.push({
        id: app._id,
        applicationId: app._id,
        course: app.course,
        cohort: app.cohort,
        type: 'application',
        rawApplication: app,
        lifecycleState,
        priorityRank,
        status: app.status,
        updatedAt: app.updatedAt || app.createdAt,
      });
    });

    // Automatic Priority Sorting
    return list.sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [enrollments, applications]);

  // Tab Filtering
  const filteredPrograms = useMemo(() => {
    if (activeTab === 'in_progress') {
      return unifiedPrograms.filter(
        (p) => p.lifecycleState === 'IN_PROGRESS' || p.lifecycleState === 'UPCOMING'
      );
    }
    if (activeTab === 'applications') {
      return unifiedPrograms.filter(
        (p) =>
          p.lifecycleState === 'ACTION_REQUIRED' ||
          p.lifecycleState === 'PENDING_REVIEW' ||
          p.type === 'application'
      );
    }
    if (activeTab === 'completed') {
      return unifiedPrograms.filter((p) => p.lifecycleState === 'COMPLETED');
    }
    return unifiedPrograms;
  }, [unifiedPrograms, activeTab]);

  // Tab Counter Badges
  const counts = useMemo(() => {
    return {
      all: unifiedPrograms.length,
      in_progress: unifiedPrograms.filter(
        (p) => p.lifecycleState === 'IN_PROGRESS' || p.lifecycleState === 'UPCOMING'
      ).length,
      applications: unifiedPrograms.filter(
        (p) =>
          p.lifecycleState === 'ACTION_REQUIRED' ||
          p.lifecycleState === 'PENDING_REVIEW' ||
          p.type === 'application'
      ).length,
      action_urgent: unifiedPrograms.filter((p) => p.lifecycleState === 'ACTION_REQUIRED').length,
      completed: unifiedPrograms.filter((p) => p.lifecycleState === 'COMPLETED').length,
    };
  }, [unifiedPrograms]);

  // Priority Urgent Program if any
  const urgentProgram = useMemo(() => {
    return unifiedPrograms.find((p) => p.lifecycleState === 'ACTION_REQUIRED');
  }, [unifiedPrograms]);

  // Currently Selected Enrollment for Cockpit
  const activeEnrollment = useMemo(() => {
    if (selectedEnrollmentId) {
      return enrollments.find((e) => e._id === selectedEnrollmentId) || enrollments[0];
    }
    return enrollments[0] || null;
  }, [enrollments, selectedEnrollmentId]);

  const activeCourse = activeEnrollment?.course;

  // Correlated telemetry for active enrollment
  const currentAttendanceRecord = useMemo(() => {
    if (!attendanceData?.courses || !activeEnrollment) return null;
    return (
      attendanceData.courses.find(
        (c) =>
          String(c.enrollmentId) === String(activeEnrollment?._id) ||
          String(c.courseId) === String(activeCourse?._id)
      ) || attendanceData.courses[0] || null
    );
  }, [attendanceData, activeEnrollment, activeCourse]);

  const currentCourseAssessments = useMemo(() => {
    if (!activeCourse?._id) return [];
    return assessmentsData.filter((a) => String(a.courseId) === String(activeCourse._id));
  }, [assessmentsData, activeCourse]);

  const currentEvaluation = useMemo(() => {
    if (!activeCourse?._id) return null;
    return evaluations.find((ev) => String(ev.courseId) === String(activeCourse._id)) || null;
  }, [evaluations, activeCourse]);

  if (loading) {
    return <LoadingState label="Loading training programs and academic lifecycle…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadAllTrainingData} />;
  }

  return (
    <div className="training-hub-container">
      <PageHeader
        title="My Training & Programs"
        subtitle="Unified training hub for your space education journey: manage applications, track cohort syllabus, and access credentials."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Training' },
        ]}
        actions={
          <div className="d-flex align-items-center gap-2">
            <Link to="/student/programs" className="btn btn-primary btn-sm px-3">
              <i className="fa-solid fa-compass me-1.5"></i> Browse Programs
            </Link>
            {activeEnrollment && (
              <button
                type="button"
                className={`btn btn-sm ${showCockpit ? 'btn-secondary' : 'btn-outline-secondary'}`}
                onClick={() => setShowCockpit(!showCockpit)}
              >
                <i className={`fa-solid ${showCockpit ? 'fa-list-check' : 'fa-gauge-high'} me-1.5`}></i>
                {showCockpit ? 'Hide Cockpit' : 'Open Mission Cockpit'}
              </button>
            )}
          </div>
        }
      />

      {/* Urgent Gate Banner if Action Required */}
      {urgentProgram && (
        <div className="training-urgent-banner">
          <div className="d-flex align-items-center gap-3">
            <div className="training-urgent-icon">
              <i className="fa-solid fa-bell"></i>
            </div>
            <div>
              <strong className="d-block text-dark fs-6">
                Action Required on "{urgentProgram.course?.title}"
              </strong>
              <span className="small text-muted">
                {urgentProgram.status === 'Accepted' || urgentProgram.status === 'Eligible - Payment Pending'
                  ? 'Your application has been approved. Complete tuition payment to confirm your seat.'
                  : urgentProgram.status === 'Readiness Required'
                  ? 'A foundational readiness evaluation is required to finalize admissions review.'
                  : 'Important action pending to advance your program enrollment.'}
              </span>
            </div>
          </div>
          <div>
            {urgentProgram.status === 'Accepted' || urgentProgram.status === 'Eligible - Payment Pending' ? (
              <Link
                to={`/student/payments?invoiceId=${urgentProgram.rawApplication?.invoice?._id || urgentProgram.rawApplication?.invoice || ''}&applicationId=${urgentProgram.id}`}
                className="btn btn-warning text-dark btn-sm fw-bold px-3 shadow-sm"
              >
                <i className="fa-solid fa-credit-card me-1.5"></i> Complete Payment
              </Link>
            ) : urgentProgram.status === 'Readiness Required' ? (
              <Link
                to={`/student/readiness/start?courseId=${urgentProgram.course?._id}`}
                className="btn btn-primary btn-sm fw-bold px-3 shadow-sm"
              >
                <i className="fa-solid fa-play me-1.5"></i> Start Readiness Test
              </Link>
            ) : (
              <Link
                to={`/student/applications/${urgentProgram.id}`}
                className="btn btn-outline-dark btn-sm px-3"
              >
                View Requirement
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 1. Status Tabs / Filter Controls */}
      <div className="training-tabs-row">
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className={`training-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All Programs
            <span className="training-tab-badge">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`training-tab-btn ${activeTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => handleTabChange('in_progress')}
          >
            <i className="fa-solid fa-bolt text-primary"></i>
            In Progress / Running
            <span className="training-tab-badge">{counts.in_progress}</span>
          </button>
          <button
            type="button"
            className={`training-tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => handleTabChange('applications')}
          >
            <i className="fa-solid fa-file-signature text-warning"></i>
            Applications / Action Required
            <span className={`training-tab-badge ${counts.action_urgent > 0 ? 'badge-urgent' : ''}`}>
              {counts.applications}
            </span>
          </button>
          <button
            type="button"
            className={`training-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => handleTabChange('completed')}
          >
            <i className="fa-solid fa-award text-success"></i>
            Completed
            <span className="training-tab-badge">{counts.completed}</span>
          </button>
        </div>

        <span className="text-muted small">
          Showing {filteredPrograms.length} {filteredPrograms.length === 1 ? 'program' : 'programs'}
        </span>
      </div>

      {/* 2. Empty State */}
      {filteredPrograms.length === 0 ? (
        <EmptyState
          icon={activeTab === 'applications' ? 'fa-file-circle-plus' : 'fa-satellite-dish'}
          title={
            activeTab === 'applications'
              ? 'No pending applications'
              : activeTab === 'in_progress'
              ? 'No active programs in progress'
              : activeTab === 'completed'
              ? 'No completed programs yet'
              : 'You have not enrolled in any programs yet'
          }
          message="Explore accredited space academy tracks, verify prerequisites, and begin your training journey."
          actionLabel="Browse Programs Catalog"
          actionLink="/student/programs"
        />
      ) : (
        /* 3. Unified Program Cards Grid */
        <div className="training-cards-grid">
          {filteredPrograms.map((program) => {
            const course = program.course || {};
            const cohort = program.cohort || {};
            const isEnrollment = program.type === 'enrollment';
            const rawApp = program.rawApplication;
            const rawEnr = program.rawEnrollment;

            // Compute Attendance rate for enrollment
            const attRecord = attendanceData?.courses?.find(
              (c) =>
                String(c.enrollmentId) === String(program.id) ||
                String(c.courseId) === String(course._id)
            );
            const attPct = attRecord?.attendancePercentage ?? 85;

            // Card state class
            let stateClass = 'state-pending-review';
            if (program.lifecycleState === 'ACTION_REQUIRED') stateClass = 'state-action-required';
            else if (program.lifecycleState === 'IN_PROGRESS' || program.lifecycleState === 'UPCOMING')
              stateClass = 'state-in-progress';
            else if (program.lifecycleState === 'COMPLETED') stateClass = 'state-completed';

            return (
              <div key={`${program.type}-${program.id}`} className={`training-program-card ${stateClass}`}>
                {/* Header */}
                <div className="program-card-header">
                  <div>
                    <div className="program-card-category">
                      <i className="fa-solid fa-satellite me-1"></i>
                      {course.category || 'Space Academy Program'}
                    </div>
                    <h3 className="program-card-title">{course.title || 'Untitled Program'}</h3>
                  </div>

                  {/* Lifecycle Status Pill */}
                  {program.lifecycleState === 'ACTION_REQUIRED' ? (
                    <span className="lifecycle-pill pill-action-required">
                      <i className="fa-solid fa-triangle-exclamation me-1"></i>
                      {program.status === 'Accepted'
                        ? 'Accepted — Pay Now'
                        : program.status === 'Readiness Required'
                        ? 'Diagnostic Gate'
                        : program.status}
                    </span>
                  ) : program.lifecycleState === 'IN_PROGRESS' ? (
                    <span className="lifecycle-pill pill-in-progress">
                      <i className="fa-solid fa-circle-play me-1"></i>
                      Running
                    </span>
                  ) : program.lifecycleState === 'UPCOMING' ? (
                    <span className="lifecycle-pill pill-in-progress">
                      <i className="fa-solid fa-clock me-1"></i>
                      Starts Soon
                    </span>
                  ) : program.lifecycleState === 'COMPLETED' ? (
                    <span className="lifecycle-pill pill-completed">
                      <i className="fa-solid fa-circle-check me-1"></i>
                      Completed
                    </span>
                  ) : (
                    <span className="lifecycle-pill pill-under-review">
                      <i className="fa-solid fa-hourglass-half me-1"></i>
                      {program.status || 'Under Review'}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="program-card-body">
                  <div className="program-meta-strip">
                    {course.level && (
                      <span className="program-meta-item">
                        <i className="fa-solid fa-layer-group"></i>
                        {course.level}
                      </span>
                    )}
                    {cohort.name && (
                      <span className="program-meta-item">
                        <i className="fa-solid fa-users"></i>
                        {cohort.name}
                      </span>
                    )}
                    {course.deliveryMode && (
                      <span className="program-meta-item">
                        <i className="fa-solid fa-location-dot"></i>
                        {course.deliveryMode}
                      </span>
                    )}
                  </div>

                  {/* State A: In Progress / Running */}
                  {(program.lifecycleState === 'IN_PROGRESS' || program.lifecycleState === 'UPCOMING') && (
                    <div className="state-active-box">
                      <div className="state-progress-header">
                        <span>Attendance Progress</span>
                        <span className="text-primary fw-bold">{attPct}%</span>
                      </div>
                      <div className="state-progress-bar-wrap">
                        <div className="state-progress-bar-fill" style={{ width: `${attPct}%` }}></div>
                      </div>
                      <div className="state-next-session">
                        <i className="fa-regular fa-calendar-check text-primary"></i>
                        <span>
                          {cohort.startDate
                            ? `Next milestone: ${new Date(cohort.startDate).toLocaleDateString()}`
                            : 'Cohort scheduled · Check session schedule'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* State B: Pending Review */}
                  {program.lifecycleState === 'PENDING_REVIEW' && (
                    <div className="state-review-box">
                      <i className="fa-solid fa-circle-info text-secondary mt-1"></i>
                      <p className="state-review-desc">
                        Application submitted on{' '}
                        <strong>
                          {new Date(rawApp?.submittedAt || program.updatedAt).toLocaleDateString()}
                        </strong>
                        . The EGSA Admissions Committee is currently reviewing your academic prerequisites.
                      </p>
                    </div>
                  )}

                  {/* State C: Accepted / Action Required */}
                  {program.lifecycleState === 'ACTION_REQUIRED' && (
                    <div className="state-action-box">
                      <div className="state-action-title">
                        <i className="fa-solid fa-circle-exclamation"></i> Action Required
                      </div>
                      <p className="state-action-desc">
                        {program.status === 'Accepted' || program.status === 'Eligible - Payment Pending'
                          ? `Tuition settlement of ${course.price != null ? course.price : ''} ${course.currency || 'EGP'} is due to confirm seat reservation.`
                          : program.status === 'Readiness Required'
                          ? 'Diagnostic readiness assessment required before committee evaluation.'
                          : 'Review prerequisite and foundational recommendations.'}
                      </p>
                    </div>
                  )}

                  {/* State D: Completed */}
                  {program.lifecycleState === 'COMPLETED' && (
                    <div className="state-completed-box">
                      <div>
                        <div className="small text-muted">Final Evaluation</div>
                        <strong className="text-dark">Official Space Academy Certificate</strong>
                      </div>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                        Verified 100%
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="program-card-footer">
                  {/* State A Footer */}
                  {(program.lifecycleState === 'IN_PROGRESS' || program.lifecycleState === 'UPCOMING') && (
                    <>
                      <button
                        type="button"
                        className="btn-card-outline"
                        onClick={() => {
                          setSelectedEnrollmentId(program.id);
                          setShowCockpit(true);
                        }}
                      >
                        <i className="fa-solid fa-gauge-high"></i> Open Cockpit
                      </button>
                      <Link to="/student/media" className="btn-card-primary">
                        <i className="fa-solid fa-book-open"></i> View Materials
                      </Link>
                    </>
                  )}

                  {/* State B Footer */}
                  {program.lifecycleState === 'PENDING_REVIEW' && (
                    <>
                      <span className="text-muted small">
                        <i className="fa-regular fa-clock me-1"></i> Under Review
                      </span>
                      <Link to={`/student/applications/${program.id}`} className="btn-card-outline">
                        <i className="fa-solid fa-eye"></i> View Application
                      </Link>
                    </>
                  )}

                  {/* State C Footer */}
                  {program.lifecycleState === 'ACTION_REQUIRED' && (
                    <>
                      <Link to={`/student/applications/${program.id}`} className="btn-card-outline">
                        View Details
                      </Link>
                      {program.status === 'Accepted' || program.status === 'Eligible - Payment Pending' ? (
                        <Link
                          to={`/student/payments?invoiceId=${rawApp?.invoice?._id || rawApp?.invoice || ''}&applicationId=${program.id}`}
                          className="btn-card-action"
                        >
                          <i className="fa-solid fa-bolt"></i> Complete Payment (
                          {course.price ? `${course.price} EGP` : 'Tuition'})
                        </Link>
                      ) : program.status === 'Readiness Required' ? (
                        <Link
                          to={`/student/readiness/start?courseId=${course._id}`}
                          className="btn-card-action"
                        >
                          <i className="fa-solid fa-play"></i> Start Readiness Test
                        </Link>
                      ) : (
                        <Link
                          to={`/student/applications/${program.id}/foundation`}
                          className="btn-card-action"
                        >
                          Review Foundation
                        </Link>
                      )}
                    </>
                  )}

                  {/* State D Footer */}
                  {program.lifecycleState === 'COMPLETED' && (
                    <>
                      <Link to={`/student/certificate`} className="btn-card-outline">
                        <i className="fa-solid fa-award"></i> View Credential
                      </Link>
                      <Link to={`/student/certificate`} className="btn-card-primary">
                        <i className="fa-solid fa-download"></i> Download Certificate
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Active Training Mission Control Cockpit (Deep Telemetry Section) */}
      {activeEnrollment && (showCockpit || activeTab === 'in_progress') && (
        <div className="training-cockpit-section">
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <span className="badge bg-primary px-3 py-1.5 fw-bold text-uppercase me-2">
                Mission Cockpit
              </span>
              <h3 className="fw-bold text-dark d-inline-block mb-0 align-middle">
                {activeCourse?.title || 'Active Training Program'}
              </h3>
            </div>
            {enrollments.length > 1 && (
              <select
                className="form-select form-select-sm w-auto rounded-pill"
                value={activeEnrollment._id}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              >
                {enrollments.map((enr) => (
                  <option key={enr._id} value={enr._id}>
                    {enr.course?.title} ({enr.cohort?.name || 'Cohort'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Training Hero */}
          <StudentTrainingHero
            enrollment={activeEnrollment}
            allEnrollments={enrollments}
            selectedIndex={enrollments.findIndex((e) => e._id === activeEnrollment._id)}
            onSelectIndex={(idx) => setSelectedEnrollmentId(enrollments[idx]?._id)}
          />

          {/* Urgent Next Training Action Notice */}
          <NextTrainingAction
            enrollment={activeEnrollment}
            attendanceRecord={currentAttendanceRecord}
            assessments={currentCourseAssessments}
            evaluationStatus={currentEvaluation}
            onMarkAttendance={(session) => {
              setSelectedSessionForQR(session);
              setIsQRModalOpen(true);
            }}
          />

          {/* Multidimensional Progress Telemetry */}
          <TrainingProgress
            enrollment={activeEnrollment}
            attendanceRecord={currentAttendanceRecord}
            assessments={currentCourseAssessments}
          />

          {/* Main Mission Content Grid */}
          <div className="row g-4">
            <div className="col-lg-7">
              <LearningTrajectory
                enrollment={activeEnrollment}
                attendanceRecord={currentAttendanceRecord}
              />
              <TrainingSchedule
                attendanceRecord={currentAttendanceRecord}
                course={activeCourse}
              />
              <CurriculumProgress
                course={activeCourse}
                enrollment={activeEnrollment}
                attendanceRecord={currentAttendanceRecord}
              />
              <TrainingAssessmentsSection
                enrollment={activeEnrollment}
                onRefresh={loadAllTrainingData}
              />
            </div>

            <div className="col-lg-5">
              <AttendanceSnapshot attendanceRecord={currentAttendanceRecord} />
              <AssessmentSnapshot
                assessments={currentCourseAssessments}
                onRefresh={loadAllTrainingData}
              />
              <TrainingQuickActions
                enrollment={activeEnrollment}
                isCertified={certStatus?.isCertified}
              />
              <InstructorCard course={activeCourse} />
              <TrainingResources course={activeCourse} />
              <TrainingMediaSnapshot
                course={activeCourse}
                enrollment={activeEnrollment}
              />
              <TrainingNotifications
                notifications={notifications}
                courseId={activeCourse?._id}
              />
            </div>
          </div>

          <div className="mt-4">
            <TrainingJourney
              enrollment={activeEnrollment}
              attendanceRecord={currentAttendanceRecord}
              assessments={currentCourseAssessments}
              evaluationStatus={currentEvaluation}
              isCertified={certStatus?.isCertified}
            />
          </div>
        </div>
      )}

      {/* QR Attendance Check-in Modal */}
      <QRCheckInModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={() => loadAllTrainingData()}
        initialSession={selectedSessionForQR}
      />
    </div>
  );
}
