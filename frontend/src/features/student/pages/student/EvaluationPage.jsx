import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { evaluationService } from '../../services/studentPortalServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './EvaluationPage.module.css';

export default function EvaluationPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetCourseId = searchParams.get('courseId');

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active evaluation modal state
  const [activeEval, setActiveEval] = useState(null); // course item
  const [evalType, setEvalType] = useState('course'); // 'course' | 'agency'
  const [isReviewing, setIsReviewing] = useState(false); // viewing past submission

  // Form ratings (1-5) for Course Feedback
  const [courseRatings, setCourseRatings] = useState({
    content: 5,
    instructor: 5,
    labs: 5,
    organization: 5,
    overall: 5,
  });
  const [courseComments, setCourseComments] = useState({
    highlights: '',
    improvements: '',
  });

  // Form ratings (1-5) for Agency Feedback
  const [agencyRatings, setAgencyRatings] = useState({
    trainingEnvironment: 5,
    facilitiesAndLabs: 5,
    organizationAndStaff: 5,
    platformExperience: 5,
    overallSatisfaction: 5,
  });
  const [recommendAgency, setRecommendAgency] = useState(true);
  const [agencyComments, setAgencyComments] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    evaluationService
      .getEvaluations()
      .then((data) => {
        const evalsList = data || [];
        setEvaluations(evalsList);

        // Auto-open target course if provided via ?courseId=
        if (targetCourseId) {
          const match = evalsList.find((ev) => String(ev.courseId) === String(targetCourseId));
          if (match && !match.isLocked) {
            if (!match.isCourseCompleted) {
              openCourseForm(match);
            } else if (!match.isAgencyCompleted) {
              openAgencyForm(match);
            }
          }
        }
      })
      .catch((err) => setError(err.message || 'Failed to load evaluations.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [targetCourseId]);

  // Real progress statistics calculation
  const progressStats = useMemo(() => {
    if (!evaluations.length) {
      return { totalRequired: 0, totalCompleted: 0, percentage: 0, pendingCount: 0 };
    }
    // Only active/confirmed courses require evaluations for certificate release
    const eligibleRecords = evaluations.filter((item) => !item.isLocked);
    const totalRequired = eligibleRecords.length * 2; // 2 evaluations per eligible course
    let totalCompleted = 0;

    eligibleRecords.forEach((item) => {
      if (item.isCourseCompleted) totalCompleted += 1;
      if (item.isAgencyCompleted) totalCompleted += 1;
    });

    const percentage = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
    const pendingCount = totalRequired - totalCompleted;

    return { totalRequired, totalCompleted, percentage, pendingCount };
  }, [evaluations]);

  const openCourseForm = (item, reviewOnly = false) => {
    setActiveEval(item);
    setEvalType('course');
    setIsReviewing(reviewOnly);
    setSuccessMsg('');
    setError('');

    if (reviewOnly && item.submission?.ratings) {
      setCourseRatings({
        content: item.submission.ratings.content || 5,
        instructor: item.submission.ratings.instructor || 5,
        labs: item.submission.ratings.labs || 5,
        organization: item.submission.ratings.organization || 5,
        overall: item.submission.overallRating || 5,
      });
      setCourseComments({
        highlights: item.submission.comments?.highlights || (typeof item.submission.comments === 'string' ? item.submission.comments : ''),
        improvements: item.submission.comments?.improvements || '',
      });
    } else {
      setCourseRatings({ content: 5, instructor: 5, labs: 5, organization: 5, overall: 5 });
      setCourseComments({ highlights: '', improvements: '' });
    }
  };

  const openAgencyForm = (item, reviewOnly = false) => {
    setActiveEval(item);
    setEvalType('agency');
    setIsReviewing(reviewOnly);
    setSuccessMsg('');
    setError('');

    const agencyData = item.submission?.agencyFeedback;
    if (reviewOnly && agencyData) {
      setAgencyRatings({
        trainingEnvironment: agencyData.trainingEnvironment || 5,
        facilitiesAndLabs: agencyData.facilitiesAndLabs || 5,
        organizationAndStaff: agencyData.organizationAndStaff || 5,
        platformExperience: agencyData.platformExperience || 5,
        overallSatisfaction: agencyData.overallSatisfaction || 5,
      });
      setRecommendAgency(agencyData.recommendAgency !== false);
      setAgencyComments(agencyData.comments || '');
    } else {
      setAgencyRatings({
        trainingEnvironment: 5,
        facilitiesAndLabs: 5,
        organizationAndStaff: 5,
        platformExperience: 5,
        overallSatisfaction: 5,
      });
      setRecommendAgency(true);
      setAgencyComments('');
    }
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    if (!activeEval) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await evaluationService.submitEvaluation({
        courseId: activeEval.courseId,
        ratings: courseRatings,
        comments: courseComments,
      });
      setSuccessMsg(
        res?.message ||
          'Course & Instructor feedback submitted successfully. Complete the Egyptian Space Agency experience survey to unlock your certificate.'
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit course feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAgency = async (e) => {
    e.preventDefault();
    if (!activeEval) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await evaluationService.submitAgencyEvaluation({
        courseId: activeEval.courseId,
        ratings: agencyRatings,
        comments: agencyComments,
        recommendAgency,
      });
      setSuccessMsg(
        res?.message ||
          'Egyptian Space Agency experience feedback submitted successfully. All institutional evaluation requirements for this program are now complete!'
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit agency feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarInput = (val, onChange) => (
    <div className={styles.starRatingGroup}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={isReviewing}
          className={`${styles.starBtn} ${star <= val ? styles.starFilled : ''}`}
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} stars`}
        >
          <i className={`fa-star ${star <= val ? 'fa-solid' : 'fa-regular'}`}></i>
        </button>
      ))}
      <span className={styles.ratingValueBadge}>{val} / 5</span>
    </div>
  );

  if (loading) return <LoadingState label="Loading training evaluations…" />;
  if (error && evaluations.length === 0) return <ErrorState message={error} onRetry={load} />;

  const studentName = user?.fullName || 'Egyptian Space Agency Cadet';
  const academicCycle = user?.academicCycle || '2026 Space Training Cycle';
  const divisionName = user?.division || 'Space Systems & Orbital Engineering';

  return (
    <div className={`container-fluid px-0 ${styles.pageContainer}`}>
      {/* Page Header */}
      <PageHeader
        title="Course & Instructor Evaluation"
        subtitle="Submit anonymous constructive feedback on academic curriculum, instructional mentorship, and Egyptian Space Agency training facilities to fulfill official graduation requirements."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Academic Affairs', to: '/student/programs' },
          { label: 'Evaluation & Feedback' },
        ]}
      />

      {/* Student Academic Context & Confidentiality Bar */}
      <div className={styles.contextBanner}>
        <div className={styles.contextCadet}>
          <div className={styles.cadetAvatar}>
            <i className="fa-solid fa-user-astronaut"></i>
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className={styles.cadetName}>{studentName}</span>
              <span className="badge rounded-pill bg-slate-100 text-slate-700 border border-slate-200 font-monospace text-xs px-2 py-0.5">
                {academicCycle}
              </span>
            </div>
            <div className={styles.cadetMeta}>
              <i className="fa-solid fa-satellite text-primary"></i>
              <span>{divisionName}</span>
            </div>
          </div>
        </div>

        <div className={styles.anonymityBadge}>
          <i className="fa-solid fa-shield-halved fs-6 text-emerald-600"></i>
          <span>
            <strong>Anonymity Guarantee:</strong> Individual feedback is compiled anonymously. Instructors only receive aggregate summaries.
          </span>
        </div>
      </div>

      {/* Graduation Requirement Summary Card */}
      <div className={styles.summaryCard}>
        <div className="row align-items-center g-4">
          <div className="col-lg-7">
            <span className={styles.summaryHeaderBadge}>
              <i className="fa-solid fa-graduation-cap"></i>
              Graduation Prerequisite • Gate 4
            </span>
            <h3 className={styles.summaryTitle}>
              Certificate Release & Feedback Requirements
            </h3>
            <p className={styles.summaryDescription}>
              In accordance with Egyptian Space Agency academic governance, both the{' '}
              <strong>Course & Instructor Evaluation</strong> and the{' '}
              <strong>Egyptian Space Agency Experience</strong> must be submitted for each active training record before official verified certificates can be issued and released by the Academy.
            </p>
            <div className={styles.summaryStatsRow}>
              <div className={styles.statPill}>
                <i className="fa-solid fa-circle-check text-emerald-600"></i>
                <span>Completed: <strong>{progressStats.totalCompleted}</strong> evaluations</span>
              </div>
              <div className={styles.statPill}>
                <i className="fa-solid fa-clock text-amber-600"></i>
                <span>Pending: <strong>{progressStats.pendingCount}</strong> evaluations</span>
              </div>
              <div className={styles.statPill}>
                <i className="fa-solid fa-list-check text-primary"></i>
                <span>Total Required: <strong>{progressStats.totalRequired}</strong> surveys</span>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className={styles.progressPanel}>
              <div className={styles.progressLabelRow}>
                <span className={styles.progressLabel}>
                  Overall Completion Status
                </span>
                <span className={styles.progressPercent}>
                  {progressStats.percentage}%
                </span>
              </div>
              <div className={styles.progressBarTrack}>
                <div
                  className={`${styles.progressBarFill} ${
                    progressStats.percentage === 100
                      ? styles.fillComplete
                      : progressStats.percentage > 50
                      ? styles.fillPartial
                      : styles.fillInitial
                  }`}
                  style={{ width: `${progressStats.percentage}%` }}
                />
              </div>
              <div className={styles.progressFooter}>
                <span>
                  {progressStats.totalCompleted} of {progressStats.totalRequired} Surveys Complete
                </span>
                {progressStats.percentage === 100 ? (
                  <span className="text-success fw-bold d-flex align-items-center gap-1">
                    <i className="fa-solid fa-check-circle"></i>
                    All Requirements Met
                  </span>
                ) : (
                  <span className="text-amber-700 fw-medium">
                    {progressStats.pendingCount} Survey{progressStats.pendingCount === 1 ? '' : 's'} Remaining
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Title */}
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionHeading}>Enrolled Training Records</h2>
          <p className={styles.sectionSubheading}>
            Select a program below to review its evaluation statuses and complete mandatory forms.
          </p>
        </div>
        <span className="badge bg-light text-dark border mono px-2.5 py-1">
          {evaluations.length} Program Records
        </span>
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon="fa-star-half-stroke"
          title="No training records available for evaluation"
          message="Course evaluations will open once your cohort training begins. Check your enrolled programs in My Training Hub."
          actionLabel="View Training Hub"
          actionLink="/student/programs"
        />
      ) : (
        /* Balanced Responsive Grid: 2 columns on desktop/tablet, 1 on mobile */
        <div className="row g-4 row-cols-1 row-cols-md-2">
          {evaluations.map((item) => {
            const isAllDone = item.isCourseCompleted && item.isAgencyCompleted;
            const isPartiallyDone = (item.isCourseCompleted || item.isAgencyCompleted) && !isAllDone;
            const isLocked = item.isLocked;

            const cardStateClass = isLocked
              ? styles.cardLocked
              : isAllDone
              ? styles.cardCompleted
              : isPartiallyDone
              ? styles.cardInProgress
              : '';

            return (
              <div key={item.enrollmentId} className="col">
                <div className={`${styles.evalCard} ${cardStateClass}`}>
                  {/* Card Header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderTop}>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className={styles.codePill}>
                          {item.courseCode || 'EGSA-PROG'}
                        </span>
                        {item.cohortName && (
                          <span className={styles.cohortPill}>
                            {item.cohortName}
                          </span>
                        )}
                      </div>

                      {/* Certificate Status Badge */}
                      <div>
                        {isLocked ? (
                          <span className="badge bg-secondary-subtle text-secondary small">
                            <i className="fa-solid fa-lock me-1"></i>
                            Enrollment Pending
                          </span>
                        ) : isAllDone ? (
                          <Link
                            to="/student/certificate"
                            className={styles.certBadgeUnlock}
                          >
                            <i className="fa-solid fa-award"></i>
                            Certificate Unlocked &rarr;
                          </Link>
                        ) : (
                          <span className={styles.certBadgeLocked}>
                            <i className="fa-solid fa-lock"></i>
                            Certificate Locked
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {item.courseTitle}
                    </h3>
                    <div className={styles.cardFaculty}>
                      <i className="fa-solid fa-chalkboard-user text-secondary"></i>
                      <span>Instructor: <strong>{item.instructor}</strong></span>
                    </div>
                  </div>

                  {/* Card Body: The Two Evaluation Workflows */}
                  <div className={styles.cardBody}>
                    <div className="d-flex flex-column gap-3">
                      {/* Workflow 1: Course & Instructor Evaluation */}
                      <div className={`${styles.workflowRow} ${item.isCourseCompleted ? styles.workflowRowCompleted : ''}`}>
                        <div className={styles.workflowLeft}>
                          <div
                            className={`${styles.workflowIcon} ${
                              item.isCourseCompleted ? styles.iconCompleted : styles.iconPending
                            }`}
                          >
                            <i className="fa-solid fa-chalkboard-user"></i>
                          </div>
                          <div>
                            <div className={styles.workflowTitle}>
                              1. Course & Instructor Evaluation
                            </div>
                            <div className={styles.workflowDesc}>
                              Curriculum depth, instructional clarity & labs
                            </div>
                          </div>
                        </div>

                        <div className={styles.workflowRight}>
                          {isLocked ? (
                            <span className="badge bg-secondary-subtle text-secondary small">
                              Unavailable
                            </span>
                          ) : item.isCourseCompleted ? (
                            <div className="d-flex align-items-center gap-2">
                              <span className={styles.badgeCompleted}>
                                <i className="fa-solid fa-check"></i>
                                Completed
                              </span>
                              <button
                                type="button"
                                onClick={() => openCourseForm(item, true)}
                                className={styles.btnReview}
                              >
                                View Response
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCourseForm(item, false)}
                              className={styles.btnEvaluate}
                            >
                              <span>Evaluate</span>
                              <i className="fa-solid fa-arrow-right"></i>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Workflow 2: Egyptian Space Agency Experience */}
                      <div className={`${styles.workflowRow} ${item.isAgencyCompleted ? styles.workflowRowCompleted : ''}`}>
                        <div className={styles.workflowLeft}>
                          <div
                            className={`${styles.workflowIcon} ${
                              item.isAgencyCompleted ? styles.iconCompleted : styles.iconPending
                            }`}
                          >
                            <i className="fa-solid fa-satellite"></i>
                          </div>
                          <div>
                            <div className={styles.workflowTitle}>
                              2. Egyptian Space Agency Experience
                            </div>
                            <div className={styles.workflowDesc}>
                              Facilities, Space City atmosphere & systems
                            </div>
                          </div>
                        </div>

                        <div className={styles.workflowRight}>
                          {isLocked ? (
                            <span className="badge bg-secondary-subtle text-secondary small">
                              Unavailable
                            </span>
                          ) : item.isAgencyCompleted ? (
                            <div className="d-flex align-items-center gap-2">
                              <span className={styles.badgeCompleted}>
                                <i className="fa-solid fa-check"></i>
                                Completed
                              </span>
                              <button
                                type="button"
                                onClick={() => openAgencyForm(item, true)}
                                className={styles.btnReview}
                              >
                                View Response
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAgencyForm(item, false)}
                              className={styles.btnEvaluate}
                            >
                              <span>Evaluate</span>
                              <i className="fa-solid fa-arrow-right"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Summary Status */}
                    <div className="pt-3 mt-2 border-top border-slate-100 d-flex align-items-center justify-content-between text-xs text-muted">
                      <div>
                        {isLocked ? (
                          <span className="text-secondary">
                            <i className="fa-solid fa-circle-exclamation me-1"></i>
                            Seat on hold — feedback opens upon confirmation
                          </span>
                        ) : isAllDone ? (
                          <span className="text-success fw-medium">
                            <i className="fa-solid fa-circle-check me-1"></i>
                            Both requirements fulfilled for this program
                          </span>
                        ) : isPartiallyDone ? (
                          <span className="text-amber-800 fw-medium">
                            <i className="fa-solid fa-circle-notch me-1 fa-spin"></i>
                            {item.isCourseCompleted
                              ? 'Agency Experience survey required'
                              : 'Course Evaluation required'}
                          </span>
                        ) : (
                          <span className="text-slate-600 fw-medium">
                            <i className="fa-solid fa-hourglass-start me-1"></i>
                            2 evaluations pending completion
                          </span>
                        )}
                      </div>
                      <span className="mono text-muted text-[11px]">
                        ID: {String(item.enrollmentId).slice(-6)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FEEDBACK MODAL (Course Feedback OR Agency Feedback) */}
      {activeEval && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-2xl overflow-hidden">
              <div className="modal-header bg-slate-900 text-white px-4 py-3 border-0">
                <div>
                  <div className="text-slate-400 text-xs font-monospace uppercase tracking-wider mb-0.5">
                    {evalType === 'course' ? 'Institutional Survey Part A' : 'Institutional Survey Part B'}
                  </div>
                  <h5 className="modal-title fw-bold text-white mb-0">
                    {evalType === 'course'
                      ? (isReviewing ? 'Submitted Course & Instructor Evaluation' : 'Course & Instructor Evaluation')
                      : (isReviewing ? 'Submitted Egyptian Space Agency Experience' : 'Egyptian Space Agency Experience Survey')}
                  </h5>
                  <div className="text-slate-300 small mt-1">
                    <strong>Program:</strong> {activeEval.courseTitle}
                    {activeEval.cohortName && <> · <strong>Cohort:</strong> {activeEval.cohortName}</>}
                    {activeEval.instructor && <> · <strong>Instructor:</strong> {activeEval.instructor}</>}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setActiveEval(null);
                    setSuccessMsg('');
                    setError('');
                  }}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4 bg-white">
                {error && (
                  <div className="alert alert-danger d-flex align-items-center mb-4 rounded-xl border-danger-subtle">
                    <i className="fa-solid fa-triangle-exclamation me-2 fs-5"></i>
                    <div className="small">{error}</div>
                  </div>
                )}

                {successMsg ? (
                  <div className="text-center py-4">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3 bg-emerald-50 text-emerald-600 border border-emerald-200"
                      style={{ width: '70px', height: '70px' }}
                    >
                      <i className="fa-solid fa-circle-check fa-2x"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">Feedback Recorded Successfully</h5>
                    <p className="text-muted mx-auto mb-4 small" style={{ maxWidth: '520px' }}>
                      {successMsg}
                    </p>
                    <div className="d-flex flex-wrap justify-content-center gap-2">
                      <Link to="/student/certificate" className="btn btn-primary px-4 py-2 text-xs fw-semibold rounded-lg shadow-2xs">
                        <i className="fa-solid fa-award me-1.5"></i>
                        Check Certificate Status
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-3 py-2 text-xs rounded-lg"
                        onClick={() => {
                          setActiveEval(null);
                          setSuccessMsg('');
                        }}
                      >
                        Close Window
                      </button>
                    </div>
                  </div>
                ) : evalType === 'course' ? (
                  /* COURSE FEEDBACK FORM */
                  <form onSubmit={handleSubmitCourse}>
                    <div className="p-3 mb-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-shield-cat text-primary fs-6"></i>
                      <span>
                        Your responses are anonymous and help Egyptian Space Agency faculty optimize aerospace curriculum and hands-on laboratory experiences.
                      </span>
                    </div>

                    {/* Rating 1: Curriculum */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          1. Curriculum Depth, Technical Relevance & Syllabus Quality
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        Was the academic content challenging, up-to-date with aerospace standards, and well-structured?
                      </p>
                      {renderStarInput(courseRatings.content, (star) =>
                        setCourseRatings((r) => ({ ...r, content: star }))
                      )}
                    </div>

                    {/* Rating 2: Instructor */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          2. Teaching Clarity, Technical Expertise & Faculty Mentorship
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        {activeEval.instructor && activeEval.instructor !== 'EGSA Faculty'
                          ? `Did ${activeEval.instructor} communicate engineering concepts clearly and provide responsive support?`
                          : 'Did the assigned instructional team communicate aerospace concepts clearly and provide constructive mentorship?'}
                      </p>
                      {renderStarInput(courseRatings.instructor, (star) =>
                        setCourseRatings((r) => ({ ...r, instructor: star }))
                      )}
                    </div>

                    {/* Rating 3: Labs */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          3. Practical Engineering Labs, Software Tools & Telemetry Simulations
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        Were the lab exercises, telemetry ground simulations, and practical kits effective in consolidating your knowledge?
                      </p>
                      {renderStarInput(courseRatings.labs, (star) =>
                        setCourseRatings((r) => ({ ...r, labs: star }))
                      )}
                    </div>

                    {/* Rating 4: Organization */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          4. Program Scheduling, Academic Materials & Operational Support
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        Were schedule timelines, learning materials, and academic coordinator communications reliable and prompt?
                      </p>
                      {renderStarInput(courseRatings.organization, (star) =>
                        setCourseRatings((r) => ({ ...r, organization: star }))
                      )}
                    </div>

                    {/* Rating 5: Overall Experience */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          5. Overall Learning Experience with this Training Program
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        How would you rate the overall educational outcome of this program?
                      </p>
                      {renderStarInput(courseRatings.overall || 5, (star) =>
                        setCourseRatings((r) => ({ ...r, overall: star }))
                      )}
                    </div>

                    {/* Written Highlights */}
                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        What was the most valuable aspect of this program? (Optional)
                      </label>
                      {isReviewing ? (
                        <p className="p-3 bg-light rounded-xl text-dark small mb-0 border">
                          {courseComments.highlights || 'No highlights entered.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control rounded-xl text-sm"
                          rows="3"
                          placeholder="e.g. The hands-on CubeSat ADCS telemetry tracking pass and orbital simulation laboratory..."
                          value={courseComments.highlights}
                          onChange={(e) => setCourseComments((c) => ({ ...c, highlights: e.target.value }))}
                        />
                      )}
                    </div>

                    {/* Written Improvements */}
                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        Constructive recommendations for upcoming cohorts: (Optional)
                      </label>
                      {isReviewing ? (
                        <p className="p-3 bg-light rounded-xl text-dark small mb-0 border">
                          {courseComments.improvements || 'No recommendations entered.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control rounded-xl text-sm"
                          rows="3"
                          placeholder="e.g. Provide additional practical hours for differential power bus impedance testing..."
                          value={courseComments.improvements}
                          onChange={(e) => setCourseComments((c) => ({ ...c, improvements: e.target.value }))}
                        />
                      )}
                    </div>

                    {!isReviewing && (
                      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm px-3 rounded-lg"
                          onClick={() => setActiveEval(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm px-4 fw-semibold rounded-lg shadow-2xs"
                          disabled={submitting}
                        >
                          {submitting ? 'Submitting…' : 'Submit Course Feedback'}
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  /* AGENCY EXPERIENCE FORM */
                  <form onSubmit={handleSubmitAgency}>
                    <div className="p-3 mb-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-satellite text-primary fs-6"></i>
                      <span>
                        This evaluation covers your institutional experience with the Egyptian Space Agency, Space City facilities, digital platform, and overall program atmosphere.
                      </span>
                    </div>

                    {/* Rating 1: Training Environment */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          1. Egyptian Space Agency Training Environment & Space City Atmosphere
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        How would you rate the overall aerospace learning climate, institutional readiness, and safety?
                      </p>
                      {renderStarInput(agencyRatings.trainingEnvironment, (star) =>
                        setAgencyRatings((r) => ({ ...r, trainingEnvironment: star }))
                      )}
                    </div>

                    {/* Rating 2: Facilities & Labs */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          2. Cleanrooms, Laboratories & Practical Space Testing Infrastructure
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        Did the training facilities and engineering tools provided meet your practical learning expectations?
                      </p>
                      {renderStarInput(agencyRatings.facilitiesAndLabs, (star) =>
                        setAgencyRatings((r) => ({ ...r, facilitiesAndLabs: star }))
                      )}
                    </div>

                    {/* Rating 3: Organization & Staff */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          3. Egyptian Space Agency Administrative Staff & Student Services
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        How professional and helpful was the Agency's academic affairs and administrative support staff?
                      </p>
                      {renderStarInput(agencyRatings.organizationAndStaff, (star) =>
                        setAgencyRatings((r) => ({ ...r, organizationAndStaff: star }))
                      )}
                    </div>

                    {/* Rating 4: Platform Experience */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          4. EGSA Space Academy Digital Platform & Student Portal Experience
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        Was the digital portal intuitive for tracking your progress, accessing resources, and submitting assignments?
                      </p>
                      {renderStarInput(agencyRatings.platformExperience, (star) =>
                        setAgencyRatings((r) => ({ ...r, platformExperience: star }))
                      )}
                    </div>

                    {/* Rating 5: Overall Satisfaction */}
                    <div className="mb-4 pb-3 border-bottom border-slate-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="fw-bold text-dark small mb-0">
                          5. Overall Satisfaction with the Egyptian Space Agency Program
                        </label>
                      </div>
                      <p className="text-muted small mb-2">
                        How would you rate your institutional space agency journey as a cadet?
                      </p>
                      {renderStarInput(agencyRatings.overallSatisfaction, (star) =>
                        setAgencyRatings((r) => ({ ...r, overallSatisfaction: star }))
                      )}
                    </div>

                    {/* Recommend Agency */}
                    <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <label className="fw-bold text-dark small d-block mb-2">
                        Would you recommend Egyptian Space Agency programs to other engineers and researchers?
                      </label>
                      <div className="d-flex gap-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="recommendAgencyRadio"
                            id="recYes"
                            disabled={isReviewing}
                            checked={recommendAgency === true}
                            onChange={() => setRecommendAgency(true)}
                          />
                          <label className="form-check-label text-dark small fw-medium" htmlFor="recYes">
                            Yes, highly recommend
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="recommendAgencyRadio"
                            id="recNo"
                            disabled={isReviewing}
                            checked={recommendAgency === false}
                            onChange={() => setRecommendAgency(false)}
                          />
                          <label className="form-check-label text-dark small fw-medium" htmlFor="recNo">
                            No
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Agency Comments */}
                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        General suggestions or observations for the Egyptian Space Agency: (Optional)
                      </label>
                      {isReviewing ? (
                        <p className="p-3 bg-light rounded-xl text-dark small mb-0 border">
                          {agencyComments || 'No additional comments entered.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control rounded-xl text-sm"
                          rows="3"
                          placeholder="e.g. Expand university cleanroom access and add advanced orbital payload design workshops..."
                          value={agencyComments}
                          onChange={(e) => setAgencyComments(e.target.value)}
                        />
                      )}
                    </div>

                    {!isReviewing && (
                      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm px-3 rounded-lg"
                          onClick={() => setActiveEval(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm px-4 fw-semibold rounded-lg shadow-2xs"
                          disabled={submitting}
                        >
                          {submitting ? 'Submitting…' : 'Submit Agency Feedback'}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>

              {isReviewing && (
                <div className="modal-footer bg-light px-4 py-2.5">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3 rounded-lg"
                    onClick={() => setActiveEval(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
