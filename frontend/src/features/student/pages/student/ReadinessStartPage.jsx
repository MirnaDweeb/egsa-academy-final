import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { readinessService, applicationService } from '../../services/cycleServices';
import { courseService } from '../../services/courseService';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, PageHeader } from '../../components/StateComponents.jsx';
import './ReadinessStartPage.css';

const TECHNICAL_COMPETENCIES = [
  {
    icon: 'fa-brain',
    title: 'Logical Thinking & Systems',
    desc: 'Quantitative reasoning, algorithmic logic & systems analysis',
  },
  {
    icon: 'fa-ruler-combined',
    title: 'Measurement & Physics',
    desc: 'Scientific units, telemetry scales & fundamental principles',
  },
  {
    icon: 'fa-flask-vial',
    title: 'Hypothesis & Diagnostics',
    desc: 'Formulating testable models, anomaly detection & troubleshooting',
  },
  {
    icon: 'fa-chart-line',
    title: 'Telemetry & Data Analysis',
    desc: 'Data interpretation, time-series graphs & signal verification',
  },
  {
    icon: 'fa-certificate',
    title: 'Scientific Methodology',
    desc: 'Empirical reproducibility, academic integrity & research rigor',
  },
  {
    icon: 'fa-shield-halved',
    title: 'Operational Lab Protocols',
    desc: 'Equipment handling safety, clean-room standards & compliance',
  },
  {
    icon: 'fa-compass',
    title: 'Independent Critical Inquiry',
    desc: 'Self-directed research, deductive clarity & problem decomposition',
  },
  {
    icon: 'fa-shuttle-space',
    title: 'Curriculum Alignment',
    desc: 'Prerequisite readiness for specialized aerospace and tech tracks',
  },
];

const CROSSFIT_COMPETENCIES = [
  {
    icon: 'fa-dumbbell',
    title: 'Movement Mechanics',
    desc: 'Functional fitness fundamentals and core joint stabilization',
  },
  {
    icon: 'fa-fire',
    title: 'Warm-up & Mobility',
    desc: 'Dynamic activation, joint mobility drills & structured cool-downs',
  },
  {
    icon: 'fa-person-running',
    title: 'Bodyweight Standards',
    desc: 'Controlled air squats, push-ups, lunges & postural balance',
  },
  {
    icon: 'fa-shield-heart',
    title: 'Injury Mitigation',
    desc: 'Joint alignment, neutral spine awareness & safe technical form',
  },
  {
    icon: 'fa-droplet',
    title: 'Hydration & Recovery',
    desc: 'Central recovery protocols, hydration guidelines & muscle rest',
  },
  {
    icon: 'fa-heart-pulse',
    title: 'Effort Calibration',
    desc: 'Distinguishing safe muscular exertion from acute strain signals',
  },
  {
    icon: 'fa-clipboard-user',
    title: 'Coaching Compliance',
    desc: 'Responsiveness to technical cues & academy floor safety rules',
  },
  {
    icon: 'fa-sliders',
    title: 'Movement Scaling',
    desc: 'Appropriate exercise regressions & adaptive workout pacing',
  },
];

const SCORING_TIERS = [
  {
    range: '80% – 100%',
    status: 'Eligible / Ready',
    desc: 'Direct clearance for admissions processing and seat allocation.',
    tierClass: 'tier-ready',
    pillClass: 'pill-ready',
    icon: 'fa-circle-check',
  },
  {
    range: '50% – 79%',
    status: 'Foundation Recommended',
    desc: 'Preparatory foundational modules advised for optimal progression.',
    tierClass: 'tier-foundation',
    pillClass: 'pill-foundation',
    icon: 'fa-triangle-exclamation',
  },
  {
    range: 'Below 50%',
    status: 'Committee Review',
    desc: 'Referred to EGSA Academic Committee for individualized evaluation.',
    tierClass: 'tier-review',
    pillClass: 'pill-review',
    icon: 'fa-user-tie',
  },
];

export default function ReadinessStartPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [courseId, setCourseId] = useState(params.get('courseId') || location.state?.courseId || '');
  const [course, setCourse] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);

  useEffect(() => {
    const id = params.get('courseId') || location.state?.courseId;
    if (id) {
      setCourseId(id);
      setLoadingCourse(true);
      courseService
        .get(id)
        .then((res) => {
          setCourse(res.data);
          if (isAuthenticated) {
            readinessService.status(id)
              .then((sRes) => setStatusData(sRes.data))
              .catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCourse(false));
    } else {
      courseService
        .list({ limit: 50 })
        .then((res) => {
          const list = res.data || [];
          setAvailableCourses(list);
          const firstCourse = list[0];
          if (firstCourse) {
            setCourseId(firstCourse._id);
            setCourse(firstCourse);
            if (isAuthenticated) {
              readinessService.status(firstCourse._id)
                .then((sRes) => setStatusData(sRes.data))
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [params, location.state, isAuthenticated]);

  const handleStart = async (retake = false) => {
    if (!courseId) {
      setError('Please select a course to start the readiness assessment.');
      return;
    }

    if (!isAuthenticated) {
      navigate(`/student/login?redirect=/student/readiness/start?courseId=${courseId}`);
      return;
    }

    setStarting(true);
    setError('');

    try {
      const res = await readinessService.start(courseId, { retake });
      if (res?.data?.attemptId && res?.data?.questions) {
        sessionStorage.setItem(`egsa_attempt_${res.data.attemptId}`, JSON.stringify(res.data.questions));
        navigate(`/student/readiness/${res.data.attemptId}`);
      } else {
        throw new Error('Unexpected assessment response from server.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '';
      setError(
        msg ||
          'Could not initiate readiness assessment. Please ensure your session is active.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleDirectEnroll = async () => {
    const targetId = courseId || course?._id;
    if (!targetId) return;

    if (!isAuthenticated) {
      navigate(`/student/login?redirect=/student/readiness/start?courseId=${targetId}`);
      return;
    }

    try {
      setEnrolling(true);
      setError('');
      const res = await applicationService.create({
        courseId: targetId,
        directEnroll: true,
      });

      const app = res.data;
      const invId = res.invoice?._id || app?.invoice?._id || app?.invoice;

      if (app?.status === 'Waitlisted') {
        navigate('/student/applications');
      } else if (invId) {
        navigate(`/student/payments?invoiceId=${invId}&applicationId=${app._id}`);
      } else {
        navigate('/student/applications');
      }
    } catch (err) {
      console.error('Direct enrollment error:', err);
      setError(err.response?.data?.message || 'Failed to process direct enrollment.');
    } finally {
      setEnrolling(false);
    }
  };

  const isCrossfit = course && (course.slug === 'crossfit-functional-fitness-program' || /crossfit/i.test(course.title));

  return (
    <div>
      <PageHeader
        title={course ? `${course.title} — Readiness Assessment` : 'Course Readiness Assessment'}
        subtitle="Evaluate foundational knowledge, analytical reasoning, and learning readiness standards before admissions processing."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs', to: '/student/programs' },
          { label: 'Readiness Assessment' },
        ]}
      />

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>{error}</div>
        </div>
      )}

      {loadingCourse ? (
        <LoadingState label="Loading program details…" />
      ) : (
        <div className="readiness-container pb-5">
          {/* Active or Completed Attempt Notifications */}
          {statusData?.inProgressAttemptId && (
            <div className="alert alert-info border-info-subtle d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 p-3 rounded-3 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <div className="readiness-section-icon" style={{ width: 38, height: 38, fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <strong className="d-block text-dark">Active Assessment In Progress</strong>
                  <span className="small text-muted">
                    You have an unfinished attempt saved for this course. You can resume without losing progress.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm px-3 py-2 fw-bold shadow-sm rounded-pill"
                onClick={() => handleStart(false)}
                disabled={starting}
              >
                <i className="fa-solid fa-play me-1.5"></i> Resume Assessment
              </button>
            </div>
          )}

          {statusData?.latestSubmittedAttemptId && (
            <div className="alert alert-success-subtle border-success-subtle d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 p-3 rounded-3 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <div className="readiness-section-icon" style={{ width: 38, height: 38, fontSize: '1.1rem', background: '#ecfdf5', color: '#059669' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <strong className="d-block text-dark">
                    Assessment Completed: Score {statusData.latestScore}%
                  </strong>
                  <span className="small text-muted">
                    Status outcome: <strong className="text-dark">{statusData.latestOutcome?.replace(/_/g, ' ')}</strong>
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Link
                  to={`/student/readiness/${statusData.latestSubmittedAttemptId}/result`}
                  className="btn btn-outline-success btn-sm px-3 py-1.5 fw-semibold rounded-pill"
                >
                  View Result
                </Link>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3 py-1.5 rounded-pill"
                  onClick={() => handleStart(true)}
                  disabled={starting}
                  title="Retake the readiness assessment"
                >
                  Retake
                </button>
              </div>
            </div>
          )}

          {/* Course Selector if none preselected */}
          {!params.get('courseId') && availableCourses.length > 0 && (
            <div className="readiness-master-card p-4 mb-4">
              <label className="form-label fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <i className="fa-solid fa-graduation-cap text-primary"></i>
                Select Program to Evaluate:
              </label>
              <select
                className="form-select form-select-lg rounded-3"
                value={courseId}
                onChange={(e) => {
                  const sel = availableCourses.find((c) => c._id === e.target.value);
                  setCourseId(e.target.value);
                  setCourse(sel);
                  if (isAuthenticated && sel) {
                    readinessService.status(sel._id)
                      .then((sRes) => setStatusData(sRes.data))
                      .catch(() => setStatusData(null));
                  }
                }}
              >
                {availableCourses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title} ({c.level || 'All Levels'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Master Overview Card */}
          <div className="readiness-master-card p-4 p-md-5 mb-4">
            {/* Header Badges */}
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <span className="readiness-badge-tech">
                <i className={`fa-solid ${isCrossfit ? 'fa-dumbbell' : 'fa-satellite'}`}></i>
                {isCrossfit ? 'Physical Conditioning & Spaceflight Fitness' : course?.category || 'EGSA Academy Program'}
              </span>
              <span className="readiness-badge-neutral">
                {course?.level || 'Introductory'}
              </span>
              {course?.hasCustomReadinessQuestions ? (
                <span className="readiness-badge-success">
                  <i className="fa-solid fa-check-double"></i> Course-Specific Assessment
                </span>
              ) : (
                <span className="readiness-badge-neutral">
                  <i className="fa-solid fa-certificate"></i> Academy Standard Assessment
                </span>
              )}
            </div>

            <h2 className="fw-bold text-dark mb-2" style={{ letterSpacing: '-0.02em' }}>
              {course?.title || 'EGSA Program Readiness Assessment'}
            </h2>
            <p className="text-muted mb-4 fs-6" style={{ maxWidth: '820px', lineHeight: 1.6 }}>
              {course?.tagline ||
                course?.subtitle ||
                (isCrossfit
                  ? 'Comprehensive physical conditioning readiness evaluation covering functional movement mechanics, injury prevention, progressive overload, and recovery.'
                  : 'Comprehensive foundational readiness evaluation covering logical reasoning, core technical principles, problem solving, and curriculum readiness.')}
            </p>

            {/* Optional Assessment Notice */}
            <div className="alert alert-primary-subtle border-primary-subtle d-flex align-items-center gap-2.5 mb-4 p-3 rounded-3 small text-dark">
              <i className="fa-solid fa-circle-check text-primary fs-5 flex-shrink-0"></i>
              <span>
                <strong>Assessment is Optional:</strong> You can take this assessment to evaluate your knowledge and readiness standards, or proceed directly to enrollment and payment at any time.
              </span>
            </div>

            {/* 1. Modern Top Metric Cards */}
            <div className="readiness-metrics-grid">
              <div className="readiness-metric-card">
                <div className="readiness-metric-icon-wrap readiness-metric-icon-blue">
                  <i className="fa-solid fa-list-check"></i>
                </div>
                <div className="readiness-metric-data">
                  <div className="readiness-metric-value">12 Questions</div>
                  <div className="readiness-metric-label">Multiple Choice</div>
                </div>
              </div>

              <div className="readiness-metric-card">
                <div className="readiness-metric-icon-wrap readiness-metric-icon-amber">
                  <i className="fa-regular fa-clock"></i>
                </div>
                <div className="readiness-metric-data">
                  <div className="readiness-metric-value">10–15 Mins</div>
                  <div className="readiness-metric-label">Self-Paced</div>
                </div>
              </div>

              <div className="readiness-metric-card">
                <div className="readiness-metric-icon-wrap readiness-metric-icon-emerald">
                  <i className="fa-solid fa-award"></i>
                </div>
                <div className="readiness-metric-data">
                  <div className="readiness-metric-value">80% Passing</div>
                  <div className="readiness-metric-label">Direct Eligibility</div>
                </div>
              </div>
            </div>

            {/* 2. What is covered - Compact Micro-cards Grid */}
            <div className="readiness-section-title">
              <span className="readiness-section-icon">
                <i className="fa-solid fa-microchip"></i>
              </span>
              <span>What This Assessment Evaluates</span>
            </div>

            <div className="readiness-eval-grid">
              {(isCrossfit ? CROSSFIT_COMPETENCIES : TECHNICAL_COMPETENCIES).map((item) => (
                <div key={item.title} className="readiness-eval-card">
                  <div className="readiness-eval-icon">
                    <i className={`fa-solid ${item.icon}`}></i>
                  </div>
                  <div className="readiness-eval-body">
                    <div className="readiness-eval-title">{item.title}</div>
                    <p className="readiness-eval-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. Scoring Policy Tiers - Compact Horizontal Roadmap */}
            <div className="readiness-section-title">
              <span className="readiness-section-icon">
                <i className="fa-solid fa-chart-pie"></i>
              </span>
              <span>Admissions Scoring Tiers</span>
            </div>

            <div className="readiness-tiers-strip">
              {SCORING_TIERS.map((tier) => (
                <div key={tier.range} className={`readiness-tier-card ${tier.tierClass}`}>
                  <div className="readiness-tier-header">
                    <span className={`readiness-tier-pill ${tier.pillClass}`}>
                      <i className={`fa-solid ${tier.icon} me-1`}></i>
                      {tier.range}
                    </span>
                    <span className="readiness-tier-title">{tier.status}</span>
                  </div>
                  <p className="readiness-tier-desc">{tier.desc}</p>
                </div>
              ))}
            </div>

            {/* 4. Context Disclaimer Advisory */}
            <div className={`readiness-advisory-box ${isCrossfit ? 'warning-tone' : ''}`}>
              <div className="readiness-advisory-icon">
                <i className={`fa-solid ${isCrossfit ? 'fa-heart-pulse' : 'fa-compass'}`}></i>
              </div>
              <div className="readiness-advisory-content">
                {isCrossfit ? (
                  <>
                    <strong className="d-block mb-1">Important Health & Safety Disclaimer:</strong>
                    This assessment evaluates introductory training concepts, safety rules, and consistency awareness.
                    It is <strong>not</strong> a medical clearance or proof of clinical fitness. Students are encouraged
                    to consult a certified physician before starting high-intensity physical conditioning.
                  </>
                ) : (
                  <>
                    <strong className="d-block mb-1">Academic & Foundational Readiness Advisory:</strong>
                    This diagnostic readiness assessment evaluates foundational concepts, analytical problem solving, and
                    learning readiness. It ensures proper program placement and maximizes cadet academic success across
                    EGSA Space Academy tracks.
                  </>
                )}
              </div>
            </div>

            {/* 5. Start Button & Actions */}
            <div className="readiness-actions-bar">
              <Link to="/student/programs" className="readiness-cta-secondary">
                <i className="fa-solid fa-arrow-left"></i> Return to Programs
              </Link>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                {course?.price != null && (
                  <button
                    type="button"
                    className="readiness-cta-direct"
                    onClick={handleDirectEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Enrolling…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-bolt text-primary"></i> Skip & Enroll Directly ({course.price} {course.currency || 'EGP'})
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  className="readiness-cta-primary"
                  onClick={() => handleStart(false)}
                  disabled={starting || !courseId}
                >
                  {starting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Preparing Question Bank…
                    </>
                  ) : statusData?.inProgressAttemptId ? (
                    <>
                      <i className="fa-solid fa-play"></i>
                      Resume Readiness Assessment
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-play"></i>
                      Start Readiness Assessment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
