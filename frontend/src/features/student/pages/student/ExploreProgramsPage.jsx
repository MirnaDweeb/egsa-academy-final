import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import ApplyModal from '../../components/student/ApplyModal.jsx';
import { resolveProgramCardState } from '../../utils/programStatus';
import './ExploreProgramsPage.css';

const TRACK_CATEGORIES = [
  'All Tracks',
  'Physical Conditioning & Human Spaceflight',
  'Space Technologies',
  'Advanced Technologies',
  'Cybersecurity',
  'Remote Sensing & Geospatial Analytics',
  'Electronics & Technology Manufacturing',
  'Environment & Space Weather',
  'Robotics & Autonomous Systems',
  'Technology Entrepreneurship',
  'Project & Program Management',
];

export default function ExploreProgramsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [courses, setCourses] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected quick details modal course
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Filters
  const [selectedTrack, setSelectedTrack] = useState('All Tracks');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('');

  const loadCourses = () => {
    setLoading(true);
    setError('');

    const params = {};
    if (selectedTrack !== 'All Tracks') params.category = selectedTrack;
    if (selectedLevel) params.level = selectedLevel;
    if (selectedMode) params.deliveryMode = selectedMode;
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (sortBy) params.sort = sortBy;

    const coursePromise = courseService.list(params);
    const appPromise = isAuthenticated
      ? applicationService.my().catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] });

    Promise.all([coursePromise, appPromise])
      .then(([courseRes, appRes]) => {
        setCourses(courseRes.data || []);
        setMyApplications(appRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCourses();
  }, [selectedTrack, selectedLevel, selectedMode, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadCourses();
  };

  const handleResetFilters = () => {
    setSelectedTrack('All Tracks');
    setSelectedLevel('');
    setSelectedMode('');
    setSearchQuery('');
    setSortBy('');
  };

  const appMap = useMemo(() => {
    const map = {};
    (myApplications || []).forEach((app) => {
      const cId = (app.course?._id || app.course)?.toString();
      if (cId) map[cId] = app;
    });
    return map;
  }, [myApplications]);

  const [applyModalCourse, setApplyModalCourse] = useState(null);

  const handleOpenApplyModal = (course) => {
    if (!isAuthenticated) {
      navigate('/student/login?redirect=/student/programs');
      return;
    }
    setApplyModalCourse(course);
  };

  const renderActionForCourse = (course, isFullBtn = false) => {
    const app = appMap[course._id?.toString()];
    const cardState = resolveProgramCardState(course, app);

    const renderButton = () => {
      if (cardState.actionType === 'apply') {
        return (
          <button
            type="button"
            className="btn egsa-btn-primary w-100"
            onClick={() => handleOpenApplyModal(course)}
            title={cardState.tooltip}
          >
            <i className={`fa-solid ${cardState.actionIcon || 'fa-paper-plane'} me-1.5`}></i>{' '}
            {cardState.actionLabel}
          </button>
        );
      }

      if (cardState.actionType === 'link') {
        const btnClass =
          cardState.key === 'ENROLLED'
            ? 'egsa-btn-enrolled'
            : cardState.key === 'PAYMENT_REQUIRED'
            ? 'btn egsa-btn-pay-primary w-100'
            : cardState.badgeClass === 'pending'
            ? 'egsa-btn-status-pending'
            : 'egsa-btn-status-info';

        return (
          <Link
            to={cardState.actionUrl}
            className={btnClass}
            title={cardState.tooltip}
          >
            <i className={`fa-solid ${cardState.actionIcon} me-1`}></i>{' '}
            {cardState.actionLabel}
          </Link>
        );
      }

      // Disabled state (e.g. course closed)
      return (
        <button
          type="button"
          disabled
          className="btn btn-secondary w-100 disabled"
          title={cardState.tooltip}
        >
          <i className={`fa-solid ${cardState.actionIcon || 'fa-lock'} me-1.5`}></i>{' '}
          {cardState.actionLabel}
        </button>
      );
    };

    if (isFullBtn) {
      return (
        <div className="egsa-actions-container">
          <div className="w-100">{renderButton()}</div>
          <div className="egsa-subtle-links-row">
            <Link
              to={`/student/courses/${course._id}/fit`}
              className="egsa-subtle-link"
              title="Evaluate prerequisite alignment"
            >
              <i className="fa-solid fa-magnifying-glass-chart egsa-subtle-icon"></i> Course Fit
            </Link>
            <span className="egsa-subtle-divider">·</span>
            <Link
              to={`/student/readiness/start?courseId=${course._id}`}
              className="egsa-subtle-link"
              title="Diagnostic foundational assessment (optional)"
            >
              <i className="fa-solid fa-clipboard-check egsa-subtle-icon"></i> Readiness
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="egsa-actions-container">
        <div className="w-100">{renderButton()}</div>
        <div className="egsa-subtle-links-row">
          <Link
            to={`/student/courses/${course._id}/fit`}
            className="egsa-subtle-link"
            title="Evaluate prerequisite alignment"
          >
            <i className="fa-solid fa-magnifying-glass-chart egsa-subtle-icon"></i> Course Fit
          </Link>
          <span className="egsa-subtle-divider">·</span>
          <Link
            to={`/student/readiness/start?courseId=${course._id}`}
            className="egsa-subtle-link"
            title="Diagnostic foundational assessment (optional)"
          >
            <i className="fa-solid fa-clipboard-check egsa-subtle-icon"></i> Readiness
          </Link>
        </div>
        <div className="egsa-card-footer">
          <span className="egsa-footer-accreditation">
            {course.price == null ? (
              <span className="text-secondary"><i className="fa-solid fa-circle-info me-1"></i>Tuition TBA</span>
            ) : (
              <><i className="fa-regular fa-circle-check text-success me-1"></i>Accredited EGSA Program</>
            )}
          </span>
          <Link
            to={`/student/courses/${course._id}`}
            className="egsa-footer-details-link"
          >
            View Details <i className="fa-solid fa-arrow-right egsa-footer-arrow"></i>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Explore Space Programs & Courses"
        subtitle="Discover accredited training tracks across Space Systems, Satellite Engineering, AI, and Mission Operations."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs' },
        ]}
      />

      {/* Track Selector Pills */}
      <div className="mb-4 overflow-auto pb-2" style={{ whiteSpace: 'nowrap' }}>
        <div className="d-inline-flex gap-2">
          {TRACK_CATEGORIES.map((track) => (
            <button
              key={track}
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${
                selectedTrack === track ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setSelectedTrack(track)}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="egsa-card mb-4 p-3">
        <form onSubmit={handleSearchSubmit} className="d-flex flex-wrap gap-2 align-items-center">
          <div className="flex-grow-1" style={{ minWidth: '240px' }}>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by title, topic or keyword…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
            <select
              className="form-select"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="">All Level Tiers</option>
              <option value="Awareness / Fundamentals">Level 1: Awareness & Fundamentals</option>
              <option value="Core Skills">Level 2: Core Engineering Skills</option>
              <option value="Specialization/Integration/Applications">Level 3: Specialization & Integration</option>
              <option value="Professional/Industry">Level 4: Professional & Industry</option>
            </select>
          </div>

          <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
            <select
              className="form-select"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <option value="">All Delivery Modes</option>
              <option value="Onsite">Onsite (EGSA Labs)</option>
              <option value="Online">Online</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          <div style={{ minWidth: '150px', flex: '1 1 150px' }}>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="">Sort By</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>

          <div className="d-flex gap-1" style={{ minWidth: '100px' }}>
            <button type="submit" className="btn btn-primary px-3" title="Search">
              <i className="fa-solid fa-filter me-1"></i> Apply
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary px-3"
              onClick={handleResetFilters}
              title="Reset Filters"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          </div>
        </form>
      </div>

      {/* Results Header */}
      {!loading && !error && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="text-muted small mb-0">
            Showing <strong className="text-dark">{courses.length}</strong> accredited programs
            {selectedTrack !== 'All Tracks' && ` in ${selectedTrack}`}
          </p>
        </div>
      )}

      {/* State Renderers */}
      {loading && <LoadingState label="Loading Space Academy catalog…" />}
      {!loading && error && <ErrorState message={error} onRetry={loadCourses} />}
      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon="fa-satellite"
          title="No programs match your filters"
          message="Try selecting another track or broadening your search criteria."
          actionLabel="Clear All Filters"
          onAction={handleResetFilters}
        />
      )}

      {/* Courses Grid */}
      {!loading && !error && courses.length > 0 && (
        <div className="egsa-grid-cards mb-4">
          {courses.map((course) => (
            <div key={course._id} className="h-100">
              <div className="egsa-program-card h-100 d-flex flex-column justify-content-between position-relative">
                {/* Header: Track & Level */}
                <div>
                  <div className="egsa-badges-row">
                    <div className="d-flex align-items-center gap-1 flex-wrap">
                      <span className="egsa-badge-category">
                        {course.category}
                      </span>
                      <span className="egsa-badge-level">{course.level}</span>
                    </div>
                    {appMap[course._id] && (() => {
                      const cardState = resolveProgramCardState(course, appMap[course._id]);
                      const badgeColorClass =
                        cardState.badgeClass === 'ready'
                          ? 'bg-success-subtle text-success-emphasis border border-success-subtle'
                          : cardState.badgeClass === 'pending'
                          ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                          : cardState.badgeClass === 'error'
                          ? 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'
                          : cardState.badgeClass === 'gold'
                          ? 'bg-warning-subtle text-dark border border-warning'
                          : 'bg-info-subtle text-info-emphasis border border-info-subtle';
                      return (
                        <span
                          className={`egsa-badge-status ${badgeColorClass}`}
                          title={cardState.tooltip}
                        >
                          <i className={`fa-solid ${cardState.badgeIcon} me-1`}></i>
                          {cardState.badgeLabel}
                        </span>
                      );
                    })()}
                  </div>

                  <h5 className="egsa-program-title" title={course.title}>
                    {course.title}
                  </h5>
                  {course.tagline && (
                    <p className="egsa-program-tagline" title={course.tagline}>
                      {course.tagline}
                    </p>
                  )}

                  <p className="egsa-program-desc">
                    {course.shortDescription ||
                      course.overview ||
                      'Comprehensive practical curriculum designed by Egyptian Space Agency engineers.'}
                  </p>

                  {/* Attributes List */}
                  <ul className="egsa-program-meta">
                    <li className="egsa-program-meta-item">
                      <i className="fa-regular fa-clock egsa-meta-icon"></i>
                      <span>
                        {course.duration != null
                          ? `${course.duration} ${course.durationUnit || 'Days'}`
                          : 'Duration TBA'}
                        {course.hoursPerDay ? ` · ${course.hoursPerDay}` : ''}
                      </span>
                    </li>
                    <li className="egsa-program-meta-item">
                      <i className="fa-solid fa-location-dot egsa-meta-icon"></i>
                      <span>{course.deliveryMode} — {course.location || 'EGSA Cairo'}</span>
                    </li>
                    {course.startDate && (
                      <li className="egsa-program-meta-item">
                        <i className="fa-regular fa-calendar egsa-meta-icon"></i>
                        <span>Starts {new Date(course.startDate).toLocaleDateString()}</span>
                      </li>
                    )}
                    <li className="egsa-program-meta-item">
                      <i className="fa-solid fa-users egsa-meta-icon"></i>
                      <span>
                        {course.capacity != null
                          ? `${course.availableSeats ?? course.capacity} seats available`
                          : 'Capacity: Open'}
                      </span>
                    </li>
                    {course.instructor && course.instructor !== 'TBD' && (
                      <li className="egsa-program-meta-item" data-testid={`course-instructor-${course._id}`}>
                        <i className="fa-solid fa-chalkboard-user egsa-meta-icon"></i>
                        <span>Instructor: {course.instructor}</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Bottom Actions and Pricing */}
                <div className="egsa-card-actions-wrapper">
                  <div className="egsa-program-pricing-block">
                    <span className="egsa-tuition-label">Tuition</span>
                    <div className="egsa-price-value">
                      {course.price != null ? (
                        <>{course.price.toLocaleString()} <span className="egsa-currency">{course.currency || 'EGP'}</span></>
                      ) : (
                        'Pricing TBA'
                      )}
                    </div>
                  </div>

                  <div className="w-100">
                    {renderActionForCourse(course)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick View Details Modal */}
      {selectedCourse && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-primary-egsa">{selectedCourse.category}</span>
                    {selectedCourse.titleAr && (
                      <span className="badge bg-light text-dark border">{selectedCourse.titleAr}</span>
                    )}
                  </div>
                  <h5 className="modal-title fw-bold text-dark">{selectedCourse.title}</h5>
                  {selectedCourse.tagline && (
                    <small className="text-secondary-egsa fw-semibold d-block mt-1">
                      {selectedCourse.tagline}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedCourse(null)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Level Tier</small>
                      <strong className="text-dark small">{selectedCourse.level}</strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Duration</small>
                      <strong className="text-dark small">
                        {selectedCourse.duration ? `${selectedCourse.duration} ${selectedCourse.durationUnit}` : 'TBA'}
                        {selectedCourse.hoursPerDay ? ` (${selectedCourse.hoursPerDay})` : ''}
                      </strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Delivery Mode</small>
                      <strong className="text-dark small">{selectedCourse.deliveryMode}</strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Tuition</small>
                      <strong className="text-accent-egsa small">
                        {selectedCourse.price != null ? `${selectedCourse.price} EGP` : 'Pricing TBA'}
                      </strong>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-secondary-egsa mb-2">Program Overview</h6>
                <p className="text-muted small mb-3">
                  {selectedCourse.overview || selectedCourse.shortDescription || 'No overview provided.'}
                </p>

                {selectedCourse.whyThisCourse && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Purpose & What You Will Achieve</h6>
                    <p className="text-muted small mb-3">{selectedCourse.whyThisCourse}</p>
                  </>
                )}

                {selectedCourse.whoIsItFor && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Target Audience & Prerequisites</h6>
                    <p className="text-muted small mb-3">{selectedCourse.whoIsItFor}</p>
                  </>
                )}

                {selectedCourse.learningObjectives?.length > 0 && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Learning Objectives</h6>
                    <ul className="small text-muted mb-3">
                      {selectedCourse.learningObjectives.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}

                {selectedCourse.modules?.length > 0 ? (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">
                      Course Structure ({selectedCourse.modules.length} Days)
                    </h6>
                    <div className="d-flex flex-column gap-2 mb-3">
                      {selectedCourse.modules.map((m, idx) => (
                        <div key={idx} className="p-2 border rounded bg-light-subtle small">
                          <div className="d-flex justify-content-between align-items-center">
                            <strong className="text-dark">{m.title || `Day ${m.day}`}</strong>
                            {m.focus && <span className="badge bg-secondary-egsa">{m.focus}</span>}
                          </div>
                          {m.activities?.length > 0 && (
                            <div className="text-muted ps-2 mt-1 border-start border-2 border-primary-subtle">
                              {m.activities.join(' · ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : selectedCourse.syllabus?.length > 0 ? (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Syllabus & Core Modules</h6>
                    <ul className="small text-muted mb-3">
                      {selectedCourse.syllabus.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {selectedCourse.handsOnTools?.softwareTools?.length > 0 && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-secondary-egsa mb-2">Software Tools & Platforms</h6>
                    <div className="d-flex flex-wrap gap-1">
                      {selectedCourse.handsOnTools.softwareTools.map((t, idx) => (
                        <span key={idx} className="badge bg-light text-dark border">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCourse.certificationDetails?.certificateType && (
                  <div className="p-2 border rounded bg-success-subtle text-success-emphasis small">
                    <i className="fa-solid fa-certificate me-1"></i>
                    Awarded: <strong>{selectedCourse.certificationDetails.certificateType}</strong> upon completion
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light flex-column align-items-stretch">
                <div className="d-flex justify-content-between align-items-center w-100 mb-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setSelectedCourse(null)}
                  >
                    Close
                  </button>
                  <Link
                    to={`/student/courses/${selectedCourse._id}`}
                    className="btn btn-outline-primary btn-sm"
                  >
                    Full Details Page
                  </Link>
                </div>
                {renderActionForCourse(selectedCourse, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      <ApplyModal
        isOpen={!!applyModalCourse}
        course={applyModalCourse}
        onClose={() => setApplyModalCourse(null)}
        onSuccess={() => loadCourses()}
      />
    </div>
  );
}
