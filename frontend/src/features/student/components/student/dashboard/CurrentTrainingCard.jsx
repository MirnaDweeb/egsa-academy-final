import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Unified "My Training Overview" widget for Egyptian Space Agency Dashboard.
 * Consolidates active running courses, cohort attendance health, upcoming milestones,
 * and any pending application gates into one unified, balanced card.
 */
export default function CurrentTrainingCard({
  enrollments = [],
  applications = [],
  attendanceData,
  upcomingSessions = [],
  upcomingAssessments = [],
}) {
  const activeEnrollment = enrollments[0];

  // Look for any pending application requiring action or under review
  const urgentApp = applications.find((a) =>
    ['Accepted', 'Eligible - Payment Pending', 'Readiness Required', 'Foundation Recommended'].includes(a.status)
  );
  const pendingApp = applications.find((a) =>
    ['Submitted', 'Under Review', 'Manual Review', 'Waitlisted'].includes(a.status)
  );

  // If no enrolled program and no applications, render institutional empty state
  if (!activeEnrollment && !urgentApp && !pendingApp) {
    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Training Lifecycle</span>
              <h2 id="training-heading" className="card-heading-title">My Training Overview</h2>
            </div>
          </div>
          <Link to="/student/programs" className="clean-action-link">
            Browse Programs <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>

        <div className="empty-training-state">
          <div className="empty-state-icon-circle">
            <i className="fa-solid fa-satellite-dish"></i>
          </div>
          <h3 className="empty-state-title">No Active Programs in Training Hub</h3>
          <p className="empty-state-description">
            You currently have no active cohorts or pending applications.
            Explore available accredited space programs, review prerequisites, and initiate your enrollment.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2 pt-2">
            <Link to="/student/programs" className="btn btn-primary btn-sm px-3">
              <i className="fa-solid fa-compass me-1"></i> Explore Space Programs
            </Link>
            <Link to="/student/training" className="btn btn-outline-primary btn-sm px-3">
              <i className="fa-solid fa-graduation-cap me-1"></i> Open Training Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: No active enrollment, but has an active application
  if (!activeEnrollment && (urgentApp || pendingApp)) {
    const targetApp = urgentApp || pendingApp;
    const isActionRequired = !!urgentApp;
    const course = targetApp.course || {};
    const cohort = targetApp.cohort || {};

    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-solid fa-file-signature text-primary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Training Hub · Program Lifecycle</span>
              <h2 id="training-heading" className="card-heading-title">My Training Overview</h2>
            </div>
          </div>
          <Link to="/student/training?tab=applications" className="clean-action-link">
            Training Hub <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>

        <div className="active-training-card-body p-4">
          <div className="p-3 border rounded-3 bg-light-subtle mb-3 d-flex align-items-start justify-content-between flex-wrap gap-2">
            <div>
              <span className={`badge ${isActionRequired ? 'bg-warning text-dark' : 'bg-primary'} mb-1`}>
                {targetApp.status}
              </span>
              <h4 className="fw-bold text-dark mb-1">{course.title || 'Space Technology Program'}</h4>
              <p className="text-muted small mb-0">
                {isActionRequired
                  ? targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending'
                    ? 'Application accepted! Tuition settlement is required to confirm cohort seat allocation.'
                    : 'Diagnostic gate required before admissions processing can be finalized.'
                  : `Application submitted on ${new Date(targetApp.submittedAt || targetApp.createdAt).toLocaleDateString()}. Academic committee review in progress.`}
              </p>
            </div>
            <div>
              {targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending' ? (
                <Link
                  to={`/student/payments?invoiceId=${targetApp.invoice?._id || targetApp.invoice || ''}&applicationId=${targetApp._id}`}
                  className="btn btn-warning text-dark btn-sm fw-bold px-3 shadow-sm"
                >
                  <i className="fa-solid fa-credit-card me-1"></i> Complete Payment
                </Link>
              ) : targetApp.status === 'Readiness Required' ? (
                <Link
                  to={`/student/readiness/start?courseId=${course._id}`}
                  className="btn btn-primary btn-sm fw-bold px-3 shadow-sm"
                >
                  <i className="fa-solid fa-play me-1"></i> Start Readiness Test
                </Link>
              ) : (
                <Link to="/student/training?tab=applications" className="btn btn-outline-primary btn-sm px-3">
                  <i className="fa-solid fa-eye me-1"></i> View Training Hub
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Has active enrollment
  const course = activeEnrollment.course || {};
  const cohort = activeEnrollment.cohort || {};
  const attendanceRate = attendanceData?.overallPercentage;

  // Next milestone from real sessions or assessments
  let nextMilestone = null;
  if (upcomingAssessments.length > 0) {
    const nextAss = upcomingAssessments[0];
    nextMilestone = {
      label: nextAss.title || 'Technical Assessment',
      type: nextAss.type || 'Assessment',
      date: nextAss.dueDate || nextAss.assessmentDate,
      icon: 'fa-flask-vial',
      link: '/student/assessments',
    };
  } else if (upcomingSessions.length > 0) {
    const nextSess = upcomingSessions[0];
    nextMilestone = {
      label: nextSess.title || `Session ${nextSess.sessionNumber}`,
      type: 'Training Session',
      date: nextSess.date,
      icon: 'fa-chalkboard-user',
      link: '/student/training',
    };
  }

  const startDateFormatted = cohort.startDate
    ? new Date(cohort.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.startDate
    ? new Date(course.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Scheduled';

  const endDateFormatted = cohort.endDate
    ? new Date(cohort.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.endDate
    ? new Date(course.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Training Lifecycle</span>
            <h2 id="training-heading" className="card-heading-title">My Training Overview</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge-egsa-status badge-status-confirmed">
            <i className="fa-solid fa-circle-play me-1"></i>
            {activeEnrollment.status || 'Active'}
          </span>
          <Link to="/student/training" className="clean-action-link d-none d-sm-inline-flex">
            All Programs ({enrollments.length + applications.length}) <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      <div className="active-training-card-body">
        {/* Inline Action Required Alert if there is a pending application gate */}
        {urgentApp && (
          <div className="alert alert-warning border-warning-subtle d-flex align-items-center justify-content-between p-2.5 mb-3 rounded-3 small">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-warning fa-lg"></i>
              <span>
                <strong>Action Required:</strong> {urgentApp.course?.title} ({urgentApp.status})
              </span>
            </div>
            <Link
              to="/student/training?tab=applications"
              className="btn btn-warning btn-sm py-0.5 px-2.5 fw-semibold text-dark"
            >
              Resolve Gate
            </Link>
          </div>
        )}

        <div className="row g-4 align-items-stretch">
          {/* Main Course Info */}
          <div className="col-12 col-xl-7 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                {course.code && (
                  <span className="code-pill">
                    <i className="fa-solid fa-fingerprint me-1"></i>
                    {course.code}
                  </span>
                )}
                {course.level && (
                  <span className="badge-egsa-subtle">
                    Level: {course.level}
                  </span>
                )}
                <span className="badge-egsa-subtle">
                  <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                  {course.deliveryMode || 'Onsite'} · {course.location || 'EGSA Cairo'}
                </span>
              </div>

              <h3 className="training-program-title mb-2">
                {course.title || 'Egyptian Space Agency Training Program'}
              </h3>

              {course.overview && (
                <p className="training-program-desc text-muted mb-3">
                  {course.overview}
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="training-metadata-strip mt-3">
              <div className="meta-item">
                <span className="meta-label">Cohort / Cycle</span>
                <span className="meta-value">
                  {cohort.name || 'Autumn Cycle 2026/27'}
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Start Date</span>
                <span className="meta-value">{startDateFormatted}</span>
              </div>

              {endDateFormatted && (
                <div className="meta-item d-none d-sm-block">
                  <span className="meta-label">Completion Target</span>
                  <span className="meta-value">{endDateFormatted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress & Milestone Column */}
          <div className="col-12 col-xl-5">
            <div className="training-telemetry-box h-100 d-flex flex-column justify-content-between">
              <div>
                {/* Attendance Indicator */}
                <div className="telemetry-row mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="telemetry-label">
                      <i className="fa-solid fa-calendar-check me-1 text-primary-egsa"></i>
                      Attendance Health
                    </span>
                    <span className="telemetry-value">
                      {attendanceRate != null ? `${attendanceRate}%` : 'Awaiting Records'}
                    </span>
                  </div>
                  <div className="training-progress-track">
                    <div
                      className={`training-progress-fill ${
                        attendanceRate >= 85 ? 'fill-qualified' : 'fill-standard'
                      }`}
                      style={{ width: `${Math.min(100, attendanceRate || 0)}%` }}
                    />
                  </div>
                  <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                    <span>Required: 85% for Certificate</span>
                    <span>{attendanceRate >= 85 ? 'Qualified' : 'In Progress'}</span>
                  </div>
                </div>

                {/* Next Milestone */}
                {nextMilestone ? (
                  <div className="next-milestone-box mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="milestone-tag">
                        <i className={`fa-solid ${nextMilestone.icon} me-1`}></i>
                        NEXT MILESTONE
                      </span>
                      {nextMilestone.date && (
                        <span className="milestone-date">
                          {new Date(nextMilestone.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="milestone-title">{nextMilestone.label}</div>
                    <div className="milestone-type">{nextMilestone.type}</div>
                  </div>
                ) : (
                  <div className="next-milestone-box mb-3">
                    <div className="milestone-tag">
                      <i className="fa-solid fa-circle-check me-1"></i>
                      COURSE STATUS
                    </div>
                    <div className="milestone-title">Class Active & On Schedule</div>
                    <div className="milestone-type">Follow weekly syllabus in the training portal</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="d-flex flex-wrap gap-2 pt-2 mt-auto">
                <Link to="/student/training" className="btn btn-primary btn-sm flex-grow-1">
                  <i className="fa-solid fa-graduation-cap me-1"></i> My Training Hub
                </Link>
                <Link to="/student/attendance" className="btn btn-outline-primary btn-sm flex-grow-1 flex-sm-grow-0">
                  <i className="fa-solid fa-calendar-check me-1"></i> Attendance
                </Link>
                <Link to="/student/media" className="btn btn-outline-secondary btn-sm flex-grow-1 flex-sm-grow-0" title="Course Materials">
                  <i className="fa-solid fa-folder-open me-1"></i> Media
                </Link>
              </div>
            </div>
          </div>
        </div>

        {(enrollments.length > 1 || applications.length > 0) && (
          <div className="card-bottom-action pt-3 mt-3 border-top text-center">
            <Link
              to="/student/training"
              className="btn btn-light btn-sm w-100 fw-semibold text-primary d-inline-flex align-items-center justify-content-center gap-2"
            >
              <span>View All Training & Programs ({enrollments.length + applications.length})</span>
              <i className="fa-solid fa-arrow-right small"></i>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
