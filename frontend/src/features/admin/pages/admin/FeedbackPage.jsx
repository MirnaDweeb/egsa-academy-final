import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import adminService from '../../services/api/adminService';
import programService from '../../services/api/programService';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_TO_DIVISION, DIVISION_LABELS } from '../../constants/divisions';
import styles from './FeedbackPage.module.css';

const CATEGORY_LABELS = {
  COURSE_CONTENT: 'Course Content',
  INSTRUCTOR: 'Instructor Guidance',
  OVERALL: 'Overall Experience',
  FACILITIES: 'Facilities & Labs',
  PLATFORM: 'Platform & Systems',
};

const RATING_COLORS = {
  5: '#1E7C85', // Deep Teal-Green
  4: '#3A6985', // Deep Cosmos Blue
  3: '#996814', // Accessible Warm Gold
  2: '#C9733A', // Supporting Coral-Tan
  1: '#DF4F4C', // Red-Coral
};

export default function FeedbackPage() {
  const { user } = useAuth();
  const params = useParams();
  const activeDivision = params.division || ROLE_TO_DIVISION[user?.role] || 'ALL';

  // Active Tab: 'evaluations' (Gate 4 Quality Assurance) | 'general' (General Sentiment)
  const [activeTab, setActiveTab] = useState('evaluations');

  // Gate 4 Course & Instructor Evaluations State
  const [evalData, setEvalData] = useState(null);
  const [evalLoading, setEvalLoading] = useState(true);
  const [evalError, setEvalError] = useState('');
  const [selectedEval, setSelectedEval] = useState(null);

  // General Feedback Table & Metrics State
  const [feedbackList, setFeedbackList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [metrics, setMetrics] = useState({
    total: 0,
    averageRating: 0,
    positiveCount: 0,
    positivePercentage: 0,
    needsAttentionCount: 0,
    sentimentBreakdown: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    categoryBreakdown: {
      OVERALL: 0,
      COURSE_CONTENT: 0,
      INSTRUCTOR: 0,
      FACILITIES: 0,
      PLATFORM: 0,
    },
    improvementPriorities: [],
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Improvement Priorities expansion
  const [showAllPriorities, setShowAllPriorities] = useState(false);

  // Filters State
  const [ratingFilter, setRatingFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState([]);

  // Detail Modal State (General Feedback)
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const hasActiveFilters = Boolean(
    search.trim() || ratingFilter || sentimentFilter || typeFilter || programFilter
  );

  // Fetch Gate 4 Course Evaluations
  const fetchEvaluations = useCallback(
    async (refreshing = false) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setEvalLoading(true);
      }
      setEvalError('');

      try {
        const res = await adminService.getCourseEvaluations({
          division: activeDivision === 'ALL' ? undefined : activeDivision,
          program: programFilter || undefined,
        });
        setEvalData(res);
        if (res?.programs?.length) {
          setPrograms(res.programs);
        }
      } catch (err) {
        setEvalError(err.message || 'Failed to load course evaluation statistics');
      } finally {
        setEvalLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeDivision, programFilter]
  );

  // Fetch General Feedback & Metrics
  const fetchFeedback = useCallback(
    async (refreshing = false) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const res = await adminService.listFeedback({
          division: activeDivision === 'ALL' ? undefined : activeDivision,
          rating: ratingFilter || undefined,
          sentiment: sentimentFilter || undefined,
          feedbackType: typeFilter || undefined,
          program: programFilter || undefined,
          search: search.trim() || undefined,
          page,
          limit: 20,
        });

        setFeedbackList(res.feedback || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      } catch (err) {
        setError(err.message || 'Failed to load student feedback analytics');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeDivision, ratingFilter, sentimentFilter, typeFilter, programFilter, search, page]
  );

  // Triggers based on tab
  useEffect(() => {
    if (activeTab === 'evaluations') {
      fetchEvaluations();
    } else {
      fetchFeedback();
    }
  }, [activeTab, fetchEvaluations, fetchFeedback]);

  // Load programs dropdown options
  useEffect(() => {
    async function loadPrograms() {
      try {
        const query = activeDivision === 'ALL' ? {} : { division: activeDivision };
        const res = await programService.listPrograms(query);
        setPrograms(res.programs || []);
      } catch (err) {
        console.error('Failed to load programs for feedback filter:', err);
      }
    }
    loadPrograms();
  }, [activeDivision]);

  // Clear all filters action
  const handleClearFilters = () => {
    setSearch('');
    setRatingFilter('');
    setSentimentFilter('');
    setTypeFilter('');
    setProgramFilter('');
    setPage(1);
  };

  // Render Stars helper
  const renderStars = (rating) => {
    const num = Math.round(Number(rating) || 0);
    return (
      <span className={styles.starsRow} aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <i
            key={star}
            className={`fa-solid fa-star ${star <= num ? 'text-warning' : 'text-muted'}`}
            style={{ fontSize: '0.75rem', opacity: star <= num ? 1 : 0.3 }}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  };

  // Filtered evaluations list for evaluations tab
  const filteredEvaluations = useMemo(() => {
    if (!evalData?.evaluations) return [];
    return evalData.evaluations.filter((item) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchCadet = item.anonymousCadetTag?.toLowerCase().includes(q);
        const matchTitle = item.courseTitle?.toLowerCase().includes(q);
        const matchCode = item.courseCode?.toLowerCase().includes(q);
        const matchCohort = item.cohortName?.toLowerCase().includes(q);
        const matchHigh = item.comments?.highlights?.toLowerCase().includes(q);
        const matchImp = item.comments?.improvements?.toLowerCase().includes(q);
        if (!matchCadet && !matchTitle && !matchCode && !matchCohort && !matchHigh && !matchImp) {
          return false;
        }
      }
      if (ratingFilter) {
        const c = item.ratings?.content || 0;
        const i = item.ratings?.instructor || 0;
        const l = item.ratings?.labs || 0;
        const o = item.ratings?.organization || 0;
        const avg = Math.round((c + i + l + o) / 4);
        if (avg !== Number(ratingFilter)) return false;
      }
      return true;
    });
  }, [evalData?.evaluations, search, ratingFilter]);

  // Columns for Gate 4 Course & Instructor Evaluations Table
  const evalColumns = [
    {
      key: 'cadet',
      label: 'Cadet Identifier',
      render: (item) => (
        <div>
          <div className={styles.studentName}>{item.anonymousCadetTag}</div>
          <div className={styles.studentMetaRow}>
            <span className={styles.verifiedBadge}>Verified Anonymous</span>
          </div>
        </div>
      ),
    },
    {
      key: 'course',
      label: 'Program & Cohort',
      render: (item) => (
        <div>
          <div className={styles.programTitle}>{item.courseTitle}</div>
          <div className={styles.cohortTag}>
            {item.courseCode} · {item.cohortName}
          </div>
        </div>
      ),
    },
    {
      key: 'courseRating',
      label: 'Course & Faculty',
      render: (item) => {
        const c = item.ratings?.content || 0;
        const i = item.ratings?.instructor || 0;
        const l = item.ratings?.labs || 0;
        const o = item.ratings?.organization || 0;
        const avg = ((c + i + l + o) / 4).toFixed(1);
        return (
          <div>
            <div className="d-flex align-items-center">
              {renderStars(avg)}
              <span className={styles.ratingNum}>{avg} / 5</span>
            </div>
            <div className={styles.cohortTag}>
              Content: {c}★ · Faculty: {i}★
            </div>
          </div>
        );
      },
    },
    {
      key: 'agencyRating',
      label: 'Agency Experience',
      render: (item) => {
        if (!item.agencyFeedback) {
          return <span className="badge bg-secondary-subtle text-secondary">Pending</span>;
        }
        const sat = item.agencyFeedback.overallSatisfaction || 5;
        const rec = item.agencyFeedback.recommendAgency !== false;
        return (
          <div>
            <div className="d-flex align-items-center">
              {renderStars(sat)}
              <span className={styles.ratingNum}>{sat} / 5</span>
            </div>
            <div className={styles.cohortTag}>
              {rec ? (
                <span className="text-success fw-medium">
                  <i className="fa-solid fa-circle-check me-1" />
                  Recommends EGSA
                </span>
              ) : (
                <span className="text-muted">No recommendation</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'comments',
      label: 'Evaluation Insights',
      render: (item) => (
        <div style={{ maxWidth: '280px' }}>
          {item.comments?.highlights ? (
            <div className={styles.commentSummary} title={item.comments.highlights}>
              &ldquo;{item.comments.highlights}&rdquo;
            </div>
          ) : (
            <div className="text-muted small fst-italic">No highlights provided</div>
          )}
          {item.comments?.improvements && (
            <div className={styles.commentImprovement} title={item.comments.improvements}>
              <i className="fa-solid fa-arrow-turn-up me-1" style={{ transform: 'rotate(90deg)' }} />
              {item.comments.improvements}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Gate 4 Status',
      render: (item) =>
        item.isFullyCompleted ? (
          <span className="badge bg-success-subtle text-success border border-success-subtle">
            <i className="fa-solid fa-check-double me-1" />
            Fully Completed
          </span>
        ) : (
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
            <i className="fa-solid fa-check me-1" />
            Course Only
          </span>
        ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (item) => (
        <span className={styles.dateCell}>
          {item.submittedDate
            ? new Date(item.submittedDate).toLocaleDateString()
            : item.submittedAt
            ? new Date(item.submittedAt).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm py-0 px-2"
          onClick={() => setSelectedEval(item)}
          id={`btn-view-eval-${item._id}`}
          title="Inspect full anonymous evaluation record"
        >
          <i className="fa-solid fa-eye me-1" aria-hidden="true" /> View
        </button>
      ),
    },
  ];

  // Columns definition for General Feedback DataTable
  const columns = [
    {
      key: 'student',
      label: 'Student',
      render: (item) => {
        const studentName = item.student?.fullName?.trim() || 'Enrolled Candidate';
        const studentEmail = item.student?.email || 'Confidential Profile';
        return (
          <div>
            <div className={styles.studentName}>{studentName}</div>
            <div className={styles.studentMetaRow}>
              <span className={styles.studentEmail}>{studentEmail}</span>
              <span className={styles.verifiedBadge}>Verified</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'program',
      label: 'Program & Cohort',
      render: (item) => (
        <div>
          <div className={styles.programTitle}>{item.program?.title || 'Academy Program'}</div>
          <div className={styles.cohortTag}>
            {item.cohort?.cohortNumber || 'General Cohort'}
            {item.division ? ` · ${item.division.replace(/_/g, ' ')}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item) => (
        <span className={styles.badgeCategory}>
          {CATEGORY_LABELS[item.feedbackType] || item.feedbackType?.replace(/_/g, ' ') || 'Overall'}
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (item) => (
        <div className="d-flex align-items-center">
          {renderStars(item.rating)}
          <span className={styles.ratingNum}>{item.rating} / 5</span>
        </div>
      ),
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      render: (item) => {
        const sent = item.sentiment || 'POSITIVE';
        const badgeClass =
          sent === 'POSITIVE'
            ? styles.badgeSentimentPos
            : sent === 'NEGATIVE'
            ? styles.badgeSentimentNeg
            : styles.badgeSentimentNeu;
        return <span className={badgeClass}>{sent}</span>;
      },
    },
    {
      key: 'summary',
      label: 'Feedback Summary',
      render: (item) => (
        <div style={{ maxWidth: '320px' }}>
          <div className={styles.commentSummary} title={item.comments}>
            {item.comments}
          </div>
          {item.improvements && (
            <div className={styles.commentImprovement} title={`Improvement: ${item.improvements}`}>
              <i className="fa-solid fa-arrow-turn-up me-1" style={{ transform: 'rotate(90deg)' }} />
              {item.improvements}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (item) => (
        <span className={styles.dateCell}>
          {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm py-0 px-2"
          onClick={() => setSelectedFeedback(item)}
          id={`btn-view-feedback-${item._id}`}
          title="Inspect full student review"
        >
          <i className="fa-solid fa-eye me-1" aria-hidden="true" /> View
        </button>
      ),
    },
  ];

  const totalValidRatings = useMemo(() => {
    if (!metrics.ratingDistribution) return metrics.total || 0;
    const sum = Object.values(metrics.ratingDistribution).reduce((acc, curr) => acc + (curr || 0), 0);
    return sum > 0 ? sum : metrics.total || 0;
  }, [metrics.ratingDistribution, metrics.total]);

  const visiblePriorities = showAllPriorities
    ? metrics.improvementPriorities || []
    : (metrics.improvementPriorities || []).slice(0, 3);

  const divisionTitle =
    activeDivision === 'ALL'
      ? 'All Divisions'
      : DIVISION_LABELS[activeDivision] || activeDivision;

  return (
    <div className={styles.container}>
      {/* 1. Compact Page Header */}
      <PageHeader
        title={`${divisionTitle} Feedback & Evaluation Analytics`}
        subtitle="Monitor Gate 4 course quality, faculty evaluation telemetry, and cadet sentiment."
        division={activeDivision !== 'ALL' ? activeDivision : undefined}
        actions={
          <button
            type="button"
            className={styles.refreshBtn}
            id="btn-refresh-feedback-analytics"
            onClick={() => (activeTab === 'evaluations' ? fetchEvaluations(true) : fetchFeedback(true))}
            disabled={isRefreshing || loading || evalLoading}
            title="Refresh analytics from active database"
          >
            <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`} aria-hidden="true" />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        }
      />

      {/* 2. Institutional Tab Navigation */}
      <div className={styles.tabNav} role="tablist" aria-label="Feedback and Evaluation Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'evaluations'}
          className={`${styles.tabBtn} ${activeTab === 'evaluations' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('evaluations')}
          id="tab-course-evaluations"
        >
          <i className="fa-solid fa-graduation-cap" aria-hidden="true" />
          <span>Course & Instructor Evaluations (Gate 4)</span>
          {evalData?.stats?.totalEvaluations !== undefined && (
            <span className={styles.tabBadge}>{evalData.stats.totalEvaluations}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('general')}
          id="tab-general-feedback"
        >
          <i className="fa-solid fa-comments" aria-hidden="true" />
          <span>General Student Sentiment & Feedback</span>
          {metrics.total > 0 && <span className={styles.tabBadge}>{metrics.total}</span>}
        </button>
      </div>

      {/* TAB 1: GATE 4 COURSE & INSTRUCTOR EVALUATIONS */}
      {activeTab === 'evaluations' && (
        <>
          {/* Privacy & Anonymity Assurance Banner */}
          <div className={styles.privacyAlert}>
            <i className={`fa-solid fa-shield-halved ${styles.privacyAlertIcon}`} aria-hidden="true" />
            <div>
              <strong>Institutional Anonymity Protection Enforced:</strong> In accordance with Academy governance, all
              course and faculty evaluations are strictly anonymized. Individual student names, emails, and student
              IDs are sanitized server-side to guarantee objective and candid feedback.
            </div>
          </div>

          {/* Evaluations KPI Summary Row */}
          <div className={styles.kpiGrid}>
            {/* KPI 1: Total Evaluations Completed */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Total Evaluations</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconNavy}`}>
                  <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{evalData?.stats?.totalEvaluations ?? 0}</span>
              </div>
              <div className={styles.kpiSubtext}>
                Verified submissions out of {evalData?.stats?.totalEligibleEnrollments ?? 0} enrollments
              </div>
            </div>

            {/* KPI 2: Completion Rate */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Completion Rate</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconGreen}`}>
                  <i className="fa-solid fa-percent" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{evalData?.stats?.completionRate ?? 100}%</span>
              </div>
              <div className={styles.kpiSubtext}>
                {evalData?.stats?.pendingEvaluations ?? 0} pending cadet evaluations
              </div>
            </div>

            {/* KPI 3: Course Quality Average */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Course Quality</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconGold}`}>
                  <i className="fa-solid fa-star" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>
                  {evalData?.courseAverages?.overall ? `${evalData.courseAverages.overall} / 5.0` : '—'}
                </span>
                {evalData?.courseAverages?.overall && <span className={styles.kpiStar}>★</span>}
              </div>
              <div className={styles.kpiSubtext}>Aggregated across 4 pedagogical criteria</div>
            </div>

            {/* KPI 4: Agency Recommendation */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Agency Recommendation</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconGreen}`}>
                  <i className="fa-solid fa-thumbs-up" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>
                  {evalData?.agencyAverages?.recommendPercentage ?? 100}%
                </span>
              </div>
              <div className={styles.kpiSubtext}>Cadets recommending Egyptian Space Agency training</div>
            </div>
          </div>

          {/* Evaluations Telemetry Row */}
          <div className={styles.analyticsRow}>
            {/* Panel A: Course Quality Breakdown */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    <i className="fa-solid fa-chalkboard-user text-primary" aria-hidden="true" />
                    Course & Faculty Telemetry
                  </h2>
                  <div className={styles.panelSubtitle}>Pedagogical criteria averages (1–5 Scale)</div>
                </div>
                <span className={styles.panelBadge}>Gate 4 Telemetry</span>
              </div>

              <div className={styles.chartList}>
                {[
                  {
                    name: 'Course Content & Rigor',
                    val: evalData?.courseAverages?.content ?? 0,
                    color: '#1E7C85',
                  },
                  {
                    name: 'Faculty Guidance & Instruction',
                    val: evalData?.courseAverages?.instructor ?? 0,
                    color: '#3A6985',
                  },
                  {
                    name: 'Practical Labs & Simulations',
                    val: evalData?.courseAverages?.labs ?? 0,
                    color: '#996814',
                  },
                  {
                    name: 'Organization & Course Materials',
                    val: evalData?.courseAverages?.organization ?? 0,
                    color: '#16a34a',
                  },
                ].map((item) => {
                  const pct = Math.round((item.val / 5) * 100);
                  return (
                    <div key={item.name} className={styles.chartRow}>
                      <div className={styles.chartRowLabels}>
                        <span className={styles.chartRowName}>{item.name}</span>
                        <span className={styles.chartRowStats}>
                          <span className={styles.chartRowStatsStrong}>{item.val > 0 ? item.val : '—'}</span> / 5.0
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.ruleNote}>
                Evaluations required for certificate issuance. Scored out of 5.0.
              </div>
            </div>

            {/* Panel B: Agency Experience Breakdown */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    <i className="fa-solid fa-satellite text-primary" aria-hidden="true" />
                    Egyptian Space Agency Experience
                  </h2>
                  <div className={styles.panelSubtitle}>Academy infrastructure & agency support</div>
                </div>
                <span className={styles.panelBadge}>Agency Audit</span>
              </div>

              <div className={styles.chartList}>
                {[
                  {
                    name: 'Training Environment',
                    val: evalData?.agencyAverages?.trainingEnvironment ?? 0,
                    color: '#3A6985',
                  },
                  {
                    name: 'Facilities & Labs',
                    val: evalData?.agencyAverages?.facilitiesAndLabs ?? 0,
                    color: '#1E7C85',
                  },
                  {
                    name: 'Organization & Agency Staff',
                    val: evalData?.agencyAverages?.organizationAndStaff ?? 0,
                    color: '#16a34a',
                  },
                  {
                    name: 'Space LMS Platform & Systems',
                    val: evalData?.agencyAverages?.platformExperience ?? 0,
                    color: '#996814',
                  },
                  {
                    name: 'Overall Cadet Satisfaction',
                    val: evalData?.agencyAverages?.overallSatisfaction ?? 0,
                    color: '#0284c7',
                  },
                ].map((item) => {
                  const pct = Math.round((item.val / 5) * 100);
                  return (
                    <div key={item.name} className={styles.chartRow}>
                      <div className={styles.chartRowLabels}>
                        <span className={styles.chartRowName}>{item.name}</span>
                        <span className={styles.chartRowStats}>
                          <span className={styles.chartRowStatsStrong}>{item.val > 0 ? item.val : '—'}</span> / 5.0
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.ruleNote}>
                {evalData?.agencyAverages?.recommendPercentage ?? 100}% of participating cadets recommend the Egyptian Space Agency.
              </div>
            </div>
          </div>

          {/* Evaluations Table Section */}
          <div className={styles.tableSection}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitleWrap}>
                <h2 className={styles.tableTitle}>Anonymous Course & Faculty Evaluations</h2>
                <span className={styles.tableCountBadge}>
                  {filteredEvaluations.length} {filteredEvaluations.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search comments, suggestions, program title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  id="input-search-evaluations"
                />
              </div>

              <div className={styles.filters}>
                {/* Rating Filter */}
                <select
                  className={styles.selectInput}
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  id="select-eval-rating"
                  aria-label="Filter by rating"
                >
                  <option value="">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>

                {/* Program Filter */}
                <select
                  className={styles.selectInput}
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  id="select-eval-program"
                  aria-label="Filter by program"
                >
                  <option value="">All Programs</option>
                  {programs.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title}
                    </option>
                  ))}
                </select>

                {/* Reset Filters Action */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    className={styles.clearFilterBtn}
                    onClick={handleClearFilters}
                    id="btn-clear-eval-filters"
                    title="Reset all search and filter criteria"
                  >
                    <i className="fa-solid fa-filter-circle-xmark" aria-hidden="true" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Data Table / Loading / Error / Empty States */}
            {evalLoading ? (
              <LoadingState message="Loading course evaluation records..." />
            ) : evalError ? (
              <ErrorState message={evalError} onRetry={() => fetchEvaluations(false)} />
            ) : filteredEvaluations.length === 0 ? (
              <EmptyState
                title="No Course Evaluations Found"
                message={
                  hasActiveFilters
                    ? 'No evaluations match the selected filters. Click Reset Filters to view all records.'
                    : 'No course evaluations recorded yet. Cadets submit feedback upon course completion.'
                }
              />
            ) : (
              <DataTable
                columns={evalColumns}
                rows={filteredEvaluations}
                emptyTitle="No course evaluations found"
                id="table-course-evaluations"
              />
            )}
          </div>
        </>
      )}

      {/* TAB 2: GENERAL STUDENT FEEDBACK & SENTIMENT */}
      {activeTab === 'general' && (
        <>
          {/* General Feedback KPI Summary Row */}
          <div className={styles.kpiGrid}>
            {/* KPI 1: Total Responses */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Total Responses</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconNavy}`}>
                  <i className="fa-solid fa-comments" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{metrics.total}</span>
              </div>
              <div className={styles.kpiSubtext}>Verified student evaluations across cohorts</div>
            </div>

            {/* KPI 2: Average Rating */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Average Rating</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconGold}`}>
                  <i className="fa-solid fa-star" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>
                  {metrics.averageRating > 0 ? `${metrics.averageRating.toFixed(1)} / 5.0` : '—'}
                </span>
                {metrics.averageRating > 0 && <span className={styles.kpiStar}>★</span>}
              </div>
              <div className={styles.kpiSubtext}>
                {metrics.total > 0
                  ? `Based on ${metrics.total} valid evaluations`
                  : 'No evaluations submitted yet'}
              </div>
            </div>

            {/* KPI 3: Positive Feedback */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Positive Feedback</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconGreen}`}>
                  <i className="fa-solid fa-circle-check" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>
                  {metrics.positiveCount}
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>
                    ({metrics.positivePercentage}%)
                  </span>
                </span>
              </div>
              <div className={styles.kpiSubtext}>Ratings ≥ 4★ or verified positive sentiment</div>
            </div>

            {/* KPI 4: Needs Attention */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Needs Attention</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconRose}`}>
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{metrics.needsAttentionCount}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>responses</span>
              </div>
              <div className={styles.kpiSubtext}>Ratings ≤ 2★ or negative sentiment flagged</div>
            </div>
          </div>

          {/* Analytics Panels Row */}
          <div className={styles.analyticsRow}>
            {/* Panel A: Rating Distribution */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    <i className="fa-solid fa-chart-bar text-primary" aria-hidden="true" />
                    Rating Distribution
                  </h2>
                  <div className={styles.panelSubtitle}>
                    Breakdown across {totalValidRatings} verified star evaluations
                  </div>
                </div>
                <span className={styles.panelBadge}>1 – 5 Star Scale</span>
              </div>

              <div className={styles.chartList}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = metrics.ratingDistribution?.[star] || 0;
                  const pct = totalValidRatings > 0 ? Math.round((count / totalValidRatings) * 100) : 0;
                  return (
                    <div key={star} className={styles.chartRow}>
                      <div className={styles.chartRowLabels}>
                        <span className={styles.chartRowName}>
                          <i className="fa-solid fa-star text-warning" style={{ fontSize: '0.75rem' }} />
                          {star} {star === 1 ? 'Star' : 'Stars'}
                        </span>
                        <span className={styles.chartRowStats}>
                          <span className={styles.chartRowStatsStrong}>{count}</span> ({pct}%)
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: RATING_COLORS[star],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.ruleNote}>
                Sum of ratings reconciles to {totalValidRatings} valid records.
              </div>
            </div>

            {/* Panel B: Feedback Breakdown */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    <i className="fa-solid fa-layer-group text-primary" aria-hidden="true" />
                    Feedback Breakdown
                  </h2>
                  <div className={styles.panelSubtitle}>Categorical and sentiment classification</div>
                </div>
                <span className={styles.panelBadge}>Institutional Quality</span>
              </div>

              <div className={styles.breakdownSection}>
                {/* Subsection 1: Category */}
                <div>
                  <div className={styles.subSectionTitle}>
                    <i className="fa-solid fa-shapes text-secondary" />
                    Feedback by Category
                  </div>
                  <div className={styles.chartList}>
                    {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                      const count = metrics.categoryBreakdown?.[catKey] || 0;
                      const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                      return (
                        <div key={catKey} className={styles.chartRow}>
                          <div className={styles.chartRowLabels}>
                            <span className={styles.chartRowName}>{catLabel}</span>
                            <span className={styles.chartRowStats}>
                              <span className={styles.chartRowStatsStrong}>{count}</span> ({pct}%)
                            </span>
                          </div>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${pct}%`,
                                backgroundColor: '#3A6985',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subsection 2: Sentiment */}
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <div className={styles.subSectionTitle}>
                    <i className="fa-solid fa-face-smile text-secondary" />
                    Sentiment Overview
                  </div>
                  <div className={styles.chartList}>
                    {[
                      {
                        key: 'POSITIVE',
                        label: 'Positive Sentiment',
                        color: '#10b981',
                        icon: 'fa-face-smile',
                      },
                      {
                        key: 'NEUTRAL',
                        label: 'Neutral Sentiment',
                        color: '#64748b',
                        icon: 'fa-face-meh',
                      },
                      {
                        key: 'NEGATIVE',
                        label: 'Negative Sentiment',
                        color: '#ef4444',
                        icon: 'fa-face-frown',
                      },
                    ].map((s) => {
                      const count = metrics.sentimentBreakdown?.[s.key] || 0;
                      const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                      return (
                        <div key={s.key} className={styles.chartRow}>
                          <div className={styles.chartRowLabels}>
                            <span className={styles.chartRowName}>
                              <i className={`fa-solid ${s.icon}`} style={{ color: s.color, fontSize: '0.8rem' }} />
                              {s.label}
                            </span>
                            <span className={styles.chartRowStats}>
                              <span className={styles.chartRowStatsStrong}>{count}</span> ({pct}%)
                            </span>
                          </div>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${pct}%`,
                                backgroundColor: s.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Improvement Priorities */}
          <div className={styles.prioritiesCard}>
            <div className={styles.prioritiesHeader}>
              <div className={styles.prioritiesTitleWrap}>
                <h2 className={styles.prioritiesTitle}>
                  <i className="fa-solid fa-flag text-warning" aria-hidden="true" />
                  Improvement Priorities
                </h2>
                <div className={styles.prioritiesSubtitle}>
                  Verified student suggestions and flagged evaluations requiring administrative follow-up
                </div>
              </div>

              {(metrics.improvementPriorities || []).length > 3 && (
                <button
                  type="button"
                  className={styles.togglePrioritiesBtn}
                  onClick={() => setShowAllPriorities(!showAllPriorities)}
                  id="btn-toggle-all-priorities"
                >
                  {showAllPriorities
                    ? 'Show Top 3 Only'
                    : `View All (${metrics.improvementPriorities.length}) Priorities`}
                </button>
              )}
            </div>

            {visiblePriorities.length === 0 ? (
              <div className={styles.prioritiesEmpty}>
                <i className="fa-solid fa-circle-check text-success me-2" />
                No negative feedback or critical improvement items recorded in this scope.
              </div>
            ) : (
              <div className={styles.prioritiesList}>
                {visiblePriorities.map((item) => {
                  const isCritical = item.rating <= 2 || item.sentiment === 'NEGATIVE';
                  return (
                    <div
                      key={item.id}
                      className={`${styles.priorityItem} ${isCritical ? styles.priorityItemDanger : ''}`}
                    >
                      <div className={styles.priorityTop}>
                        <div className={styles.priorityBadges}>
                          <span className={styles.priorityBadgeCategory}>
                            {CATEGORY_LABELS[item.category] || item.category?.replace(/_/g, ' ') || 'Overall'}
                          </span>
                          <span
                            className={`${styles.priorityBadgeRating} ${
                              isCritical ? styles.priorityBadgeRatingDanger : ''
                            }`}
                          >
                            <i className="fa-solid fa-star me-1" style={{ fontSize: '0.65rem' }} />
                            {item.rating} / 5
                          </span>
                          <span
                            className={`badge ${
                              item.sentiment === 'NEGATIVE'
                                ? 'bg-danger-subtle text-danger border border-danger-subtle'
                                : item.sentiment === 'NEUTRAL'
                                ? 'bg-secondary-subtle text-secondary'
                                : 'bg-success-subtle text-success border border-success-subtle'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {item.sentiment}
                          </span>
                        </div>

                        <div className={styles.priorityMeta}>
                          <span>
                            <i className="fa-regular fa-calendar me-1" />
                            {new Date(item.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <p className={styles.priorityQuote}>
                        &ldquo;{item.improvementText}&rdquo;
                      </p>

                      <div className={styles.priorityFooter}>
                        <span className={styles.priorityProgram}>
                          <i className="fa-solid fa-graduation-cap me-1 text-secondary" />
                          {item.programTitle} {item.cohortNumber ? `(${item.cohortNumber})` : ''}
                        </span>
                        <button
                          type="button"
                          className={styles.inspectBtn}
                          onClick={() => {
                            const fullRecord = feedbackList.find((f) => String(f._id) === String(item.id));
                            setSelectedFeedback(
                              fullRecord || {
                                _id: item.id,
                                rating: item.rating,
                                feedbackType: item.category,
                                sentiment: item.sentiment,
                                comments: item.improvementText,
                                improvements: item.improvementText,
                                program: { title: item.programTitle },
                                cohort: { cohortNumber: item.cohortNumber },
                                submittedAt: item.submittedAt,
                              }
                            );
                          }}
                          id={`btn-inspect-priority-${item.id}`}
                        >
                          <i className="fa-solid fa-magnifying-glass me-1" /> Inspect Record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feedback Records Table Section */}
          <div className={styles.tableSection}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitleWrap}>
                <h2 className={styles.tableTitle}>Student Feedback Records</h2>
                <span className={styles.tableCountBadge}>
                  {pagination.total} {pagination.total === 1 ? 'Record' : 'Records'}
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search comments, suggestions, or student names..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  id="input-search-feedback"
                />
              </div>

              <div className={styles.filters}>
                <select
                  className={styles.selectInput}
                  value={ratingFilter}
                  onChange={(e) => {
                    setRatingFilter(e.target.value);
                    setPage(1);
                  }}
                  id="select-feedback-rating"
                  aria-label="Filter by rating"
                >
                  <option value="">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>

                <select
                  className={styles.selectInput}
                  value={sentimentFilter}
                  onChange={(e) => {
                    setSentimentFilter(e.target.value);
                    setPage(1);
                  }}
                  id="select-feedback-sentiment"
                  aria-label="Filter by sentiment"
                >
                  <option value="">All Sentiments</option>
                  <option value="POSITIVE">Positive</option>
                  <option value="NEUTRAL">Neutral</option>
                  <option value="NEGATIVE">Negative</option>
                </select>

                <select
                  className={styles.selectInput}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  id="select-feedback-type"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  <option value="COURSE_CONTENT">Course Content</option>
                  <option value="INSTRUCTOR">Instructor Guidance</option>
                  <option value="OVERALL">Overall Experience</option>
                  <option value="FACILITIES">Facilities & Labs</option>
                  <option value="PLATFORM">Platform & Systems</option>
                </select>

                <select
                  className={styles.selectInput}
                  value={programFilter}
                  onChange={(e) => {
                    setProgramFilter(e.target.value);
                    setPage(1);
                  }}
                  id="select-feedback-program"
                  aria-label="Filter by program"
                >
                  <option value="">All Programs</option>
                  {programs.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title}
                    </option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className={styles.clearFilterBtn}
                    onClick={handleClearFilters}
                    id="btn-clear-feedback-filters"
                    title="Reset all search and filter criteria"
                  >
                    <i className="fa-solid fa-filter-circle-xmark" aria-hidden="true" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Data Table / Loading / Error / Empty States */}
            {loading ? (
              <LoadingState message="Loading student feedback analytics..." />
            ) : error ? (
              <ErrorState message={error} onRetry={() => fetchFeedback(false)} />
            ) : feedbackList.length === 0 ? (
              <EmptyState
                title="No Feedback Records Found"
                message={
                  hasActiveFilters
                    ? 'No student feedback matches the selected filters. Click Reset Filters to view all records.'
                    : 'No feedback submissions recorded for this division yet. Candidates submit feedback upon course completion.'
                }
              />
            ) : (
              <DataTable
                columns={columns}
                rows={feedbackList}
                pagination={{
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: (p) => setPage(p),
                }}
                emptyTitle="No student feedback records found"
                id="table-student-feedback"
              />
            )}
          </div>
        </>
      )}

      {/* Modal A: Course & Faculty Evaluation Detail Modal (Strictly Anonymous) */}
      {selectedEval && (
        <Modal
          isOpen={Boolean(selectedEval)}
          onClose={() => setSelectedEval(null)}
          title={`Course Evaluation — ${selectedEval.anonymousCadetTag}`}
          size="lg"
        >
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div>
              <div className="fw-bold text-dark fs-6">{selectedEval.courseTitle}</div>
              <div className="text-muted small">
                {selectedEval.courseCode} · {selectedEval.cohortName}
              </div>
            </div>
            <div className="text-end">
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="fa-solid fa-user-shield me-1" />
                Verified Anonymous Cadet
              </span>
              <div className="text-muted small mt-1">
                Submitted {selectedEval.submittedDate
                  ? new Date(selectedEval.submittedDate).toLocaleDateString()
                  : selectedEval.submittedAt
                  ? new Date(selectedEval.submittedAt).toLocaleDateString()
                  : '—'}
              </div>
            </div>
          </div>

          {/* Section 1: Course & Instructor Criteria */}
          <div className="mb-4">
            <h6 className="fw-bold text-primary mb-2">
              <i className="fa-solid fa-chalkboard-user me-2" />
              1. Course & Faculty Pedagogical Ratings
            </h6>
            <div className={styles.evalCriteriaGrid}>
              <div className={styles.evalCriteriaItem}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-secondary small fw-medium">Course Content & Scientific Depth</span>
                  <span className="fw-bold text-dark">{selectedEval.ratings?.content || 5} / 5</span>
                </div>
                {renderStars(selectedEval.ratings?.content || 5)}
              </div>
              <div className={styles.evalCriteriaItem}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-secondary small fw-medium">Instructor Guidance & Delivery</span>
                  <span className="fw-bold text-dark">{selectedEval.ratings?.instructor || 5} / 5</span>
                </div>
                {renderStars(selectedEval.ratings?.instructor || 5)}
              </div>
              <div className={styles.evalCriteriaItem}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-secondary small fw-medium">Practical Labs & Simulations</span>
                  <span className="fw-bold text-dark">{selectedEval.ratings?.labs || 5} / 5</span>
                </div>
                {renderStars(selectedEval.ratings?.labs || 5)}
              </div>
              <div className={styles.evalCriteriaItem}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-secondary small fw-medium">Program Organization & Materials</span>
                  <span className="fw-bold text-dark">{selectedEval.ratings?.organization || 5} / 5</span>
                </div>
                {renderStars(selectedEval.ratings?.organization || 5)}
              </div>
            </div>
          </div>

          {/* Qualitative Observations */}
          <div className="mb-4">
            <h6 className="fw-bold text-dark mb-2">
              <i className="fa-solid fa-comment-dots me-2 text-secondary" />
              Cadet Feedback & Observations
            </h6>
            {selectedEval.comments?.highlights && (
              <div className="p-3 bg-light rounded border mb-2 small">
                <div className="fw-bold text-success mb-1">
                  <i className="fa-solid fa-thumbs-up me-1" /> Noted Highlights
                </div>
                <div className="text-dark">&ldquo;{selectedEval.comments.highlights}&rdquo;</div>
              </div>
            )}
            {selectedEval.comments?.improvements && (
              <div className="p-3 bg-light rounded border small">
                <div className="fw-bold text-warning mb-1">
                  <i className="fa-solid fa-lightbulb me-1" /> Constructive Suggestions
                </div>
                <div className="text-dark">&ldquo;{selectedEval.comments.improvements}&rdquo;</div>
              </div>
            )}
          </div>

          {/* Section 2: Egyptian Space Agency Experience */}
          {selectedEval.agencyFeedback && (
            <div className="mb-4">
              <h6 className="fw-bold text-primary mb-2">
                <i className="fa-solid fa-satellite me-2" />
                2. Egyptian Space Agency Institutional Experience
              </h6>
              <div className={styles.evalCriteriaGrid}>
                <div className={styles.evalCriteriaItem}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small fw-medium">Training Environment</span>
                    <span className="fw-bold text-dark">
                      {selectedEval.agencyFeedback.trainingEnvironment || 5} / 5
                    </span>
                  </div>
                  {renderStars(selectedEval.agencyFeedback.trainingEnvironment || 5)}
                </div>
                <div className={styles.evalCriteriaItem}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small fw-medium">Facilities & Labs</span>
                    <span className="fw-bold text-dark">
                      {selectedEval.agencyFeedback.facilitiesAndLabs || 5} / 5
                    </span>
                  </div>
                  {renderStars(selectedEval.agencyFeedback.facilitiesAndLabs || 5)}
                </div>
                <div className={styles.evalCriteriaItem}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small fw-medium">Staff & Academy Support</span>
                    <span className="fw-bold text-dark">
                      {selectedEval.agencyFeedback.organizationAndStaff || 5} / 5
                    </span>
                  </div>
                  {renderStars(selectedEval.agencyFeedback.organizationAndStaff || 5)}
                </div>
                <div className={styles.evalCriteriaItem}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small fw-medium">Space Platform & LMS</span>
                    <span className="fw-bold text-dark">
                      {selectedEval.agencyFeedback.platformExperience || 5} / 5
                    </span>
                  </div>
                  {renderStars(selectedEval.agencyFeedback.platformExperience || 5)}
                </div>
              </div>

              {selectedEval.agencyFeedback.comments && (
                <div className="p-3 bg-light rounded border small mt-2">
                  <div className="fw-bold text-primary mb-1">
                    <i className="fa-solid fa-message me-1" /> Agency Comments
                  </div>
                  <div className="text-dark">&ldquo;{selectedEval.agencyFeedback.comments}&rdquo;</div>
                </div>
              )}
            </div>
          )}

          <div className="d-flex justify-content-end pt-2 border-top">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedEval(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Modal B: General Student Feedback Modal */}
      {selectedFeedback && (
        <Modal
          isOpen={Boolean(selectedFeedback)}
          onClose={() => setSelectedFeedback(null)}
          title="Student Feedback Record"
          size="md"
        >
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div>
              <div className="fw-bold text-dark fs-6">
                {selectedFeedback.student?.fullName?.trim() || 'Enrolled Student'}
              </div>
              <div className="text-muted small">
                {selectedFeedback.student?.email || 'Confidential Student Account'}
              </div>
            </div>
            <div className="text-end">
              <div>{renderStars(selectedFeedback.rating)}</div>
              <span
                className={`badge mt-1 ${
                  selectedFeedback.sentiment === 'POSITIVE'
                    ? 'bg-success-subtle text-success border border-success-subtle'
                    : selectedFeedback.sentiment === 'NEGATIVE'
                    ? 'bg-danger-subtle text-danger border border-danger-subtle'
                    : 'bg-secondary-subtle text-secondary'
                }`}
                style={{ fontSize: '0.725rem' }}
              >
                {selectedFeedback.sentiment || 'POSITIVE'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-light rounded border mb-3 small">
            <div className="row g-2">
              <div className="col-sm-6">
                <span className="text-secondary fw-semibold">Program:</span>
                <div className="fw-medium text-dark">
                  {selectedFeedback.program?.title || 'Academy Program'}
                </div>
              </div>
              <div className="col-sm-6">
                <span className="text-secondary fw-semibold">Cohort:</span>
                <div className="fw-medium text-dark">
                  {selectedFeedback.cohort?.cohortNumber || 'Cohort'}
                  {selectedFeedback.division ? ` (${selectedFeedback.division.replace(/_/g, ' ')})` : ''}
                </div>
              </div>
              <div className="col-sm-6">
                <span className="text-secondary fw-semibold">Category:</span>
                <div className="fw-medium text-dark">
                  {CATEGORY_LABELS[selectedFeedback.feedbackType] ||
                    selectedFeedback.feedbackType?.replace(/_/g, ' ') ||
                    'Overall'}
                </div>
              </div>
              <div className="col-sm-6">
                <span className="text-secondary fw-semibold">Submission Date:</span>
                <div className="fw-medium text-dark">
                  {new Date(
                    selectedFeedback.submittedAt || selectedFeedback.createdAt
                  ).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold text-dark small">Student Review & Comments</label>
            <div
              className="p-3 bg-white border rounded small text-dark"
              style={{ minHeight: '75px', lineHeight: 1.55 }}
            >
              {selectedFeedback.comments}
            </div>
          </div>

          {selectedFeedback.strengths && (
            <div className="mb-3">
              <label className="form-label fw-bold text-success small">Noted Strengths</label>
              <div className="p-2 bg-success bg-opacity-10 border border-success border-opacity-25 rounded small text-dark">
                {selectedFeedback.strengths}
              </div>
            </div>
          )}

          {selectedFeedback.improvements && (
            <div className="mb-3">
              <label className="form-label fw-bold text-warning small">Suggested Improvements</label>
              <div className="p-2 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded small text-dark">
                {selectedFeedback.improvements}
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end pt-2 border-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedFeedback(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
