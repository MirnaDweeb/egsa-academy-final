import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService, learningPathService } from '../../services/studentService';
import { attendanceService, portalAssessmentService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';
import './ProgressPage.css';

export default function ProgressPage() {
  const [profile, setProfile] = useState(null);
  const [learningPath, setLearningPath] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedStepId, setExpandedStepId] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      studentService.getMe().catch(() => ({ data: { profile: {} } })),
      learningPathService.recommended().catch(() => ({ data: null })),
      attendanceService.getStudentAttendance().catch(() => ({ overallPercentage: 0 })),
      portalAssessmentService.getAssessments().catch(() => ({ courseAssessments: [] })),
    ])
      .then(([profRes, pathRes, attRes, assessRes]) => {
        setProfile(profRes.data?.profile || {});
        setLearningPath(pathRes.data || null);
        setAttendance(attRes);
        setAssessments(assessRes.courseAssessments || []);
      })
      .catch((err) => setError(err.message || 'Failed to load progress data.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Compute metrics
  const completedCourses = profile?.completedCourses || [];
  const totalPathCourses = learningPath?.courses?.length || 4;
  const completedPathCount = completedCourses.length;
  const pathPct = totalPathCourses > 0 ? Math.round((completedPathCount / totalPathCourses) * 100) : 0;

  const attendanceRate = attendance?.overallPercentage ?? 100;
  const minAttendance = attendance?.policy?.minimumAttendancePercentage || 85;
  const certEligibility = attendance?.certificateEligibility || 'ON_TRACK';
  const isAttendanceAtRisk = certEligibility === 'AT_RISK';
  const isAttendanceIneligible = certEligibility === 'INELIGIBLE';

  let attendanceStatusLabel = 'On Track';
  if (isAttendanceIneligible) {
    attendanceStatusLabel = 'Ineligible';
  } else if (isAttendanceAtRisk) {
    attendanceStatusLabel = 'At Risk';
  }

  const passedAssessments = assessments.filter((a) => a.status === 'Completed').length;
  const totalAssessments = assessments.length || 4;
  const assessmentPct = totalAssessments > 0 ? Math.round((passedAssessments / totalAssessments) * 100) : 0;

  // Unified Graduation Readiness Score (Weighted composite)
  const rawReadiness = Math.round(
    (pathPct * 0.4) + (Math.min(100, attendanceRate) * 0.35) + (assessmentPct * 0.25)
  );
  const readinessScore = isAttendanceIneligible ? Math.min(45, rawReadiness) : Math.min(100, rawReadiness);

  let readinessTone = 'success';
  let readinessStatusTitle = 'On Track for Graduation';
  let readinessStatusSub = 'You are meeting or exceeding all mandatory pace, attendance, and exam criteria.';
  if (isAttendanceIneligible) {
    readinessTone = 'danger';
    readinessStatusTitle = 'Attendance Disqualified';
    readinessStatusSub = 'Attendance has fallen below academy threshold. Immediate remediation required.';
  } else if (isAttendanceAtRisk) {
    readinessTone = 'warning';
    readinessStatusTitle = 'Attention Required';
    readinessStatusSub = 'Attendance is near threshold. Complete upcoming sessions to secure certification.';
  } else if (readinessScore >= 80) {
    readinessTone = 'success';
    readinessStatusTitle = 'High Graduation Readiness';
    readinessStatusSub = 'Excellent progress across coursework, practical simulations, and attendance.';
  } else if (readinessScore >= 50) {
    readinessTone = 'success';
    readinessStatusTitle = 'Steady Academic Progress';
    readinessStatusSub = 'Continue completing active training modules and graded laboratory assignments.';
  } else {
    readinessTone = 'warning';
    readinessStatusTitle = 'Foundational Phase';
    readinessStatusSub = 'Complete initial training courses and submit required assessments to advance.';
  }

  // Visual Stepper Milestones
  const milestones = [
    {
      id: 1,
      stepNum: 1,
      title: 'Academy Registration & Student Profile',
      description: 'Identity verification, STEM degree details, and EGSA student profile activation.',
      status: profile?.profileCompleted ? 'completed' : 'in_progress',
      actionLink: '/student/profile',
      actionText: 'View Profile',
      modules: ['Identity Clearance', 'Degree Verification', 'Cadet Token Active'],
      details: 'All baseline demographic records and security clearance are validated with the EGSA registry.',
    },
    {
      id: 2,
      stepNum: 2,
      title: 'Specialization Track & Learning Goal',
      description: profile?.learningGoal
        ? `Aligned with ${profile.learningGoal.title || 'Selected Specialization'}.`
        : 'Select an EGSA specialization track to configure your official learning path.',
      status: profile?.learningGoal ? 'completed' : 'in_progress',
      actionLink: '/student/goal',
      actionText: profile?.learningGoal ? 'Adjust Goal' : 'Choose Goal',
      modules: [
        profile?.learningGoal?.title || 'Satellite Engineering Track',
        'Curriculum Roadmap Configured',
      ],
      details: 'Defines your target space industry competencies, prerequisite courses, and graduation electives.',
    },
    {
      id: 3,
      stepNum: 3,
      title: 'Prerequisite Verification & Readiness Clearance',
      description: 'Satisfying mandatory engineering foundations and passing diagnostic readiness assessments.',
      status: 'completed',
      actionLink: '/student/readiness/start',
      actionText: 'Diagnostic Log',
      modules: ['Math & Physics Clearance', 'Orbital Mechanics Basics', 'STEM Baseline Validated'],
      details: 'Ensures strong foundational grounding before accessing advanced mission simulation environments.',
    },
    {
      id: 4,
      stepNum: 4,
      title: 'Active Cohort Training & Lab Attendance',
      description: `Training Attendance: ${attendanceRate}% · Status: ${attendanceStatusLabel} (Minimum ${minAttendance}% required).`,
      status: isAttendanceIneligible
        ? 'in_progress'
        : (attendanceRate >= minAttendance && !isAttendanceAtRisk ? 'completed' : 'in_progress'),
      actionLink: '/student/attendance',
      actionText: 'View Attendance',
      modules: [
        `Live Attendance: ${attendanceRate}%`,
        `Minimum Threshold: ${minAttendance}%`,
        'Ground Station Telemetry Drills',
      ],
      details: 'Hands-on laboratory sessions, clean-room satellite integration drills, and ground communication passes.',
    },
    {
      id: 5,
      stepNum: 5,
      title: 'Technical Quizzes & Practical Mission Capstone',
      description: `${passedAssessments} of ${totalAssessments} graded technical assessments and simulation reports fulfilled.`,
      status: passedAssessments === totalAssessments ? 'completed' : 'in_progress',
      actionLink: '/student/assessments',
      actionText: 'Assessments Hub',
      modules: [
        `Passed: ${passedAssessments}/${totalAssessments}`,
        'ADCS Attitude Simulation',
        'CubeSat Telemetry Script',
      ],
      details: 'Rigorous engineering evaluations, code reviews for flight software, and live hardware-in-the-loop tests.',
    },
    {
      id: 6,
      stepNum: 6,
      title: 'End-of-Course Evaluation & Academic Board Review',
      description: 'Submitting feedback and receiving formal clearance from the Egyptian Space Agency board.',
      status: 'upcoming',
      actionLink: '/student/evaluation',
      actionText: 'Open Evaluation',
      modules: ['Student Quality Feedback', 'Instructor Rating', 'Academic Board Clearance'],
      details: 'Final institutional audit confirming academic integrity, capstone defense, and accreditation requirements.',
    },
    {
      id: 7,
      stepNum: 7,
      title: 'EGSA Space Academy Credential & Certificate',
      description: isAttendanceIneligible
        ? 'Certificate ineligibility enforced due to attendance threshold violation.'
        : 'Official verified digital credential with public cryptographic verification token.',
      status: isAttendanceIneligible ? 'upcoming' : (readinessScore >= 95 ? 'completed' : 'upcoming'),
      actionLink: '/student/certificate',
      actionText: 'Credential Hub',
      modules: ['Cryptographic Verification', 'National Space Registry ID', 'Shareable Digital Badge'],
      details: 'Issued directly by the Egyptian Space Agency upon successful graduation clearance.',
    },
  ];

  // Set initial expanded step to current active step
  useEffect(() => {
    if (!expandedStepId) {
      const currentStep = milestones.find((m) => m.status === 'in_progress');
      if (currentStep) {
        setExpandedStepId(currentStep.id);
      }
    }
  }, [milestones, expandedStepId]);

  if (loading) return <LoadingState label="Analyzing your Academy academic progress…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="container-fluid px-0">
      <PageHeader
        title="My Progress & Academic Milestones"
        subtitle="Holistic overview of learning path completion, attendance compliance, assessment scores, and graduation requirements."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Progress' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <Link to="/student/goal" className="btn btn-outline-secondary btn-sm">
              <i className="fa-solid fa-bullseye me-1"></i> Change Goal
            </Link>
            <Link to="/student/learning-path" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-route me-1"></i> View Path Roadmap
            </Link>
          </div>
        }
      />

      {/* UNIFIED & MODERNIZED TOP METRICS HEADER CARD */}
      <div className="progress-summary-card mb-4">
        <div className="progress-summary-grid">
          {/* Left: Overall Graduation Readiness */}
          <div className="readiness-gauge-box">
            <div
              className="readiness-circle"
              style={{
                background: `conic-gradient(#3B82F6 0% ${readinessScore}%, rgba(255, 255, 255, 0.12) ${readinessScore}% 100%)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '7px',
                  borderRadius: '50%',
                  background: '#0F172A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="readiness-circle-val">{readinessScore}%</span>
                <span className="readiness-circle-label">Readiness</span>
              </div>
            </div>

            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className={`readiness-badge-pill ${readinessTone}`}>
                  <i className="fa-solid fa-circle-check"></i> {readinessStatusTitle}
                </span>
              </div>
              <div className="readiness-status-title">Graduation Readiness</div>
              <div className="readiness-status-sub">{readinessStatusSub}</div>
            </div>
          </div>

          {/* Right: 3 Sleek Progress Pillars */}
          <div className="metrics-pillars-grid">
            {/* Pillar 1: Path Completion */}
            <div className="metric-pillar-card">
              <div>
                <div className="pillar-header">
                  <div className="pillar-icon-wrap">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <span className="pillar-value">{pathPct}%</span>
                </div>
                <div className="pillar-title">Path Completion</div>
                <div className="pillar-sub">
                  {completedPathCount} of {totalPathCourses} courses completed
                </div>
              </div>
              <div>
                <div className="pillar-progress-track">
                  <div
                    className="pillar-progress-bar primary"
                    style={{ width: `${Math.min(100, Math.max(0, pathPct))}%` }}
                  ></div>
                </div>
                <Link to="/student/learning-path" className="pillar-footer-link">
                  View Roadmap <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </div>

            {/* Pillar 2: Training Attendance */}
            <div className="metric-pillar-card">
              <div>
                <div className="pillar-header">
                  <div className="pillar-icon-wrap attendance">
                    <i className="fa-solid fa-user-check"></i>
                  </div>
                  <span className="pillar-value">{attendanceRate}%</span>
                </div>
                <div className="pillar-title">Training Attendance</div>
                <div className="pillar-sub">
                  Min {minAttendance}% required · {attendanceStatusLabel}
                </div>
              </div>
              <div>
                <div className="pillar-progress-track">
                  <div
                    className={`pillar-progress-bar ${
                      isAttendanceIneligible ? 'danger' : isAttendanceAtRisk ? 'warning' : 'success'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                  ></div>
                </div>
                <Link to="/student/attendance" className="pillar-footer-link">
                  Attendance Log <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </div>

            {/* Pillar 3: Assessments & Exams */}
            <div className="metric-pillar-card">
              <div>
                <div className="pillar-header">
                  <div className="pillar-icon-wrap exams">
                    <i className="fa-solid fa-file-pen"></i>
                  </div>
                  <span className="pillar-value">{assessmentPct}%</span>
                </div>
                <div className="pillar-title">Assessments & Exams</div>
                <div className="pillar-sub">
                  {passedAssessments} of {totalAssessments} completed assessments
                </div>
              </div>
              <div>
                <div className="pillar-progress-track">
                  <div
                    className="pillar-progress-bar purple"
                    style={{ width: `${Math.min(100, Math.max(0, assessmentPct))}%` }}
                  ></div>
                </div>
                <Link to="/student/assessments" className="pillar-footer-link">
                  Quizzes & Tests <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN BALANCED LAYOUT */}
      <div className="row g-4 align-items-start">
        {/* Left Column: Interactive Visual Stepper (Milestone Journey) */}
        <div className="col-lg-7 col-xl-7">
          <div className="egsa-card p-4 h-100">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
              <div>
                <h5 className="fw-bold text-dark mb-1">
                  <i className="fa-solid fa-timeline text-primary-egsa me-2"></i>
                  Space Academy Milestone Journey
                </h5>
                <p className="text-muted small mb-0">
                  Interactive visual stepper — click any milestone to review linked modules and actions.
                </p>
              </div>
              <span className="badge bg-light text-secondary-egsa border border-secondary-subtle px-2 py-1 small">
                {milestones.filter((m) => m.status === 'completed').length} of {milestones.length} Milestones Cleared
              </span>
            </div>

            <div className="stepper-container">
              {milestones.map((m, idx) => {
                const isCompleted = m.status === 'completed';
                const isActive = m.status === 'in_progress';
                const isSelected = expandedStepId === m.id;
                const isLast = idx === milestones.length - 1;

                return (
                  <div
                    key={m.id}
                    className={`stepper-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setExpandedStepId(isSelected ? null : m.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedStepId(isSelected ? null : m.id);
                      }
                    }}
                  >
                    {/* Stepper Node Indicator & Connector */}
                    <div className="stepper-node-rail">
                      <div
                        className={`stepper-indicator ${
                          isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'
                        }`}
                      >
                        {isCompleted ? (
                          <i className="fa-solid fa-check"></i>
                        ) : isActive ? (
                          <i className="fa-solid fa-satellite fa-fade"></i>
                        ) : (
                          <span>{m.stepNum}</span>
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`stepper-connector ${
                            isCompleted ? 'completed' : isActive ? 'active' : ''
                          }`}
                        ></div>
                      )}
                    </div>

                    {/* Stepper Content */}
                    <div className="stepper-content">
                      <div className="stepper-top-bar">
                        <div className="stepper-title">
                          <span>{m.title}</span>
                          <i
                            className={`fa-solid fa-chevron-down text-muted small transition-transform ${
                              isSelected ? 'rotate-180' : ''
                            }`}
                            style={{
                              fontSize: '0.7rem',
                              transition: 'transform 0.2s ease',
                              transform: isSelected ? 'rotate(180deg)' : 'none',
                            }}
                          ></i>
                        </div>
                        <div>
                          {isCompleted && (
                            <span className="stepper-badge completed">
                              <i className="fa-solid fa-circle-check me-1"></i> Completed
                            </span>
                          )}
                          {isActive && (
                            <span className="stepper-badge active">
                              <i className="fa-solid fa-spinner fa-spin-pulse me-1"></i> In Progress
                            </span>
                          )}
                          {!isCompleted && !isActive && (
                            <span className="stepper-badge upcoming">Upcoming</span>
                          )}
                        </div>
                      </div>

                      <div className="stepper-desc">{m.description}</div>

                      {/* Expandable associated milestones / linked modules */}
                      {isSelected && (
                        <div
                          className="stepper-details-drawer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="text-dark small fw-bold">
                              <i className="fa-solid fa-cubes-stacked text-primary-egsa me-1"></i> Linked Deliverables & Modules:
                            </span>
                            {m.actionLink && (
                              <Link
                                to={m.actionLink}
                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                style={{ fontSize: '0.74rem' }}
                              >
                                {m.actionText} <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                              </Link>
                            )}
                          </div>

                          <p className="text-muted small mb-2">{m.details}</p>

                          <div className="stepper-modules-list mb-0">
                            {m.modules?.map((mod, modIdx) => (
                              <span
                                key={modIdx}
                                className={`module-tag ${isCompleted ? 'verified' : ''}`}
                              >
                                <i
                                  className={`fa-solid ${
                                    isCompleted ? 'fa-check text-success' : 'fa-circle-dot text-primary-egsa'
                                  }`}
                                  style={{ fontSize: '0.65rem' }}
                                ></i>
                                {mod}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Actionable Remaining Requirements Panel */}
        <div className="col-lg-5 col-xl-5">
          <div className="requirements-panel-card p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="fw-bold text-dark mb-0">
                <i className="fa-solid fa-list-check text-primary-egsa me-2"></i>
                Remaining Requirements
              </h5>
              <span className="badge bg-primary-subtle text-primary fw-semibold px-2 py-1 small">
                Action Tracker
              </span>
            </div>
            <p className="text-muted small mb-3">
              Directly launch submissions, check attendance, and complete mandatory forms to clear your diploma:
            </p>

            <div className="d-flex flex-column gap-3">
              {/* Item 1: Practical Lab Submissions */}
              <div className="req-item-card is-priority">
                <div className="req-header">
                  <div className="req-icon-and-title">
                    <div className="req-icon-box blue">
                      <i className="fa-solid fa-flask-vial"></i>
                    </div>
                    <div>
                      <div className="req-title">Practical Lab Submissions</div>
                      <p className="req-desc">
                        Complete ADCS attitude simulation report and flight telemetry software submission.
                      </p>
                    </div>
                  </div>
                  <span className="req-status-badge in-progress">
                    <i className="fa-solid fa-clock-rotate-left"></i> In Progress
                  </span>
                </div>
                <div className="req-action-row">
                  <div className="req-sub-info">
                    <i className="fa-solid fa-microchip text-primary-egsa"></i> ADCS Sim & Telemetry Code
                  </div>
                  <Link to="/student/media" className="req-action-btn btn-primary-action">
                    Submit Lab <i className="fa-solid fa-arrow-up-from-bracket"></i>
                  </Link>
                </div>
              </div>

              {/* Item 2: Maintain >=85% Attendance */}
              <div className="req-item-card">
                <div className="req-header">
                  <div className="req-icon-and-title">
                    <div className="req-icon-box emerald">
                      <i className="fa-solid fa-user-clock"></i>
                    </div>
                    <div>
                      <div className="req-title">Maintain ≥85% Attendance</div>
                      <p className="req-desc">
                        Attend scheduled orbital mechanics lectures & cleanroom satellite assembly drills.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`req-status-badge ${
                      attendanceRate >= minAttendance ? 'ready' : 'in-progress'
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        attendanceRate >= minAttendance ? 'fa-check' : 'fa-spinner fa-spin-pulse'
                      }`}
                    ></i>{' '}
                    {attendanceRate >= minAttendance ? 'Ready for Review' : 'In Progress'}
                  </span>
                </div>
                <div className="req-action-row">
                  <div className="req-sub-info">
                    <i className="fa-solid fa-chart-line text-success"></i> Current: {attendanceRate}% (Min {minAttendance}%)
                  </div>
                  <Link to="/student/attendance" className="req-action-btn btn-outline-action">
                    View Schedule <i className="fa-solid fa-calendar-check"></i>
                  </Link>
                </div>
              </div>

              {/* Item 3: Course Evaluation Form */}
              <div className="req-item-card">
                <div className="req-header">
                  <div className="req-icon-and-title">
                    <div className="req-icon-box amber">
                      <i className="fa-solid fa-clipboard-check"></i>
                    </div>
                    <div>
                      <div className="req-title">Course & Faculty Evaluation Form</div>
                      <p className="req-desc">
                        Submit mandatory end-of-term student feedback before final graduation clearance.
                      </p>
                    </div>
                  </div>
                  <span className="req-status-badge pending">
                    <i className="fa-solid fa-hourglass-half"></i> Pending
                  </span>
                </div>
                <div className="req-action-row">
                  <div className="req-sub-info">
                    <i className="fa-solid fa-pen-nib text-warning"></i> Mandatory for certificate release
                  </div>
                  <Link to="/student/evaluation" className="req-action-btn btn-outline-action">
                    Open Form <i className="fa-solid fa-file-signature"></i>
                  </Link>
                </div>
              </div>

              {/* Item 4: Technical Quizzes & Capstone */}
              <div className="req-item-card">
                <div className="req-header">
                  <div className="req-icon-and-title">
                    <div className="req-icon-box purple">
                      <i className="fa-solid fa-award"></i>
                    </div>
                    <div>
                      <div className="req-title">Mission Capstone & Quizzes</div>
                      <p className="req-desc">
                        Pass graded modular quizzes and present CubeSat end-to-end design to the faculty panel.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`req-status-badge ${
                      passedAssessments === totalAssessments ? 'ready' : 'in-progress'
                    }`}
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i>{' '}
                    {passedAssessments === totalAssessments ? 'Ready for Review' : 'In Progress'}
                  </span>
                </div>
                <div className="req-action-row">
                  <div className="req-sub-info">
                    <i className="fa-solid fa-circle-check text-primary"></i> {passedAssessments}/{totalAssessments} Graded Complete
                  </div>
                  <Link to="/student/assessments" className="req-action-btn btn-outline-action">
                    Review Quizzes <i className="fa-solid fa-list-check"></i>
                  </Link>
                </div>
              </div>

              {/* Item 5: Academic Board Review */}
              <div className="req-item-card">
                <div className="req-header">
                  <div className="req-icon-and-title">
                    <div className="req-icon-box blue">
                      <i className="fa-solid fa-stamp"></i>
                    </div>
                    <div>
                      <div className="req-title">Academic Board Clearance</div>
                      <p className="req-desc">
                        Formal committee sign-off by EGSA Space Academy faculty upon fulfilling all requirements.
                      </p>
                    </div>
                  </div>
                  <span className="req-status-badge pending">
                    <i className="fa-solid fa-shield-halved"></i> Pending
                  </span>
                </div>
                <div className="req-action-row">
                  <div className="req-sub-info">
                    <i className="fa-solid fa-building-columns text-secondary"></i> EGSA Registry Board
                  </div>
                  <Link to="/student/contact-admin" className="req-action-btn btn-outline-action">
                    Contact Advisor <i className="fa-solid fa-comments"></i>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Advisor Support Card */}
          <div className="advisor-guidance-card">
            <div className="d-flex align-items-center gap-3 mb-2">
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-user-graduate"></i>
              </div>
              <div>
                <h6 className="fw-bold text-dark mb-0">Need Academic Support?</h6>
                <small className="text-muted">EGSA Academy Student Success Office</small>
              </div>
            </div>
            <p className="text-muted small mb-3">
              Your Space Academy academic advisor can help resolve prerequisite locks, attendance recovery plans, and capstone milestone scheduling.
            </p>
            <div className="d-flex gap-2">
              <Link to="/student/contact-instructor" className="btn btn-outline-secondary btn-sm flex-grow-1">
                <i className="fa-solid fa-chalkboard-user me-1"></i> Ask Instructor
              </Link>
              <Link to="/student/notifications" className="btn btn-outline-primary btn-sm flex-grow-1">
                <i className="fa-solid fa-bell me-1"></i> Academy Alerts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
