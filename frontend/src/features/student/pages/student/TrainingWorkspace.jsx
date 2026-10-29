import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { enrollmentService } from '../../services/cycleServices';

export default function TrainingWorkspace() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProgram() {
      try {
        setLoading(true);
        const res = await enrollmentService.getMyEnrollments();
        const list = res?.data || res || [];
        const found = list.find(
          (e) =>
            e._id === programId ||
            e.id === programId ||
            e.course?._id === programId ||
            e.course?.id === programId
        );
        if (isMounted) setEnrollment(found || null);
      } catch (err) {
        console.warn('[TrainingWorkspace] Could not fetch program details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProgram();
    return () => {
      isMounted = false;
    };
  }, [programId]);

  const course = enrollment?.course || {};
  const cohort = enrollment?.cohort || {};
  const title = course.title || 'Space Academy Training Workspace';
  const category = course.category || 'Space Technologies & Mission Operations';

  return (
    <div className="container-fluid py-4 px-md-5">
      {/* Top Breadcrumb & Return Action */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate('/student/training')}
          className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>Back to My Training</span>
        </button>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill">
            <i className="fa-solid fa-satellite me-1"></i> Active Workspace
          </span>
          <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 rounded-pill">
            <i className="fa-solid fa-circle-check me-1"></i> Cohort Verified
          </span>
        </div>
      </div>

      {/* Program Workspace Hero Banner */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="card-body p-4 p-md-5 text-white">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <span className="text-info text-uppercase fw-bold letter-spacing-1 small">
                {category}
              </span>
              <h1 className="h2 fw-bold mt-1 text-white mb-2">{title}</h1>
              <p className="text-slate-300 text-light opacity-75 mb-3 max-w-2xl">
                Official Egyptian Space Agency digital learning environment, session schedule, laboratory media, and attendance tracking.
              </p>
              <div className="d-flex flex-wrap gap-3 text-light small opacity-90">
                {course.level && (
                  <span className="d-inline-flex align-items-center gap-1.5">
                    <i className="fa-solid fa-layer-group text-info"></i> {course.level}
                  </span>
                )}
                {cohort.name && (
                  <span className="d-inline-flex align-items-center gap-1.5">
                    <i className="fa-solid fa-users text-info"></i> {cohort.name}
                  </span>
                )}
                {course.deliveryMode && (
                  <span className="d-inline-flex align-items-center gap-1.5">
                    <i className="fa-solid fa-location-dot text-info"></i> {course.deliveryMode}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white bg-opacity-10 border border-white border-opacity-10 p-3 rounded-3 text-center">
              <div className="small text-uppercase text-light opacity-75">Status</div>
              <div className="h5 fw-bold text-success mb-0 mt-1">
                <i className="fa-solid fa-circle-play me-1"></i> Running
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Quick-Access Hub */}
      <div className="row g-4">
        {/* Module 1: Materials & Syllabus */}
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift transition-all">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="rounded-3 p-3 bg-primary bg-opacity-10 text-primary">
                <i className="fa-solid fa-book-open fs-4"></i>
              </div>
              <span className="badge bg-light text-muted">Curriculum</span>
            </div>
            <h5 className="fw-bold mb-1">Course Materials</h5>
            <p className="text-muted small mb-4">
              Access lecture slides, lab manuals, and scientific datasets.
            </p>
            <Link
              to={`/student/learning-hub?courseId=${programId}`}
              className="btn btn-outline-primary btn-sm rounded-pill mt-auto d-inline-flex align-items-center justify-content-center gap-2"
            >
              <span>View Materials</span>
              <i className="fa-solid fa-arrow-right small"></i>
            </Link>
          </div>
        </div>

        {/* Module 2: Attendance & QR Check-in */}
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift transition-all">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="rounded-3 p-3 bg-success bg-opacity-10 text-success">
                <i className="fa-solid fa-clipboard-user fs-4"></i>
              </div>
              <span className="badge bg-light text-muted">Attendance</span>
            </div>
            <h5 className="fw-bold mb-1">Session Attendance</h5>
            <p className="text-muted small mb-4">
              Check in to live lectures, lab sessions, and view verified records.
            </p>
            <Link
              to="/student/attendance"
              className="btn btn-outline-success btn-sm rounded-pill mt-auto d-inline-flex align-items-center justify-content-center gap-2"
            >
              <span>Check Attendance</span>
              <i className="fa-solid fa-arrow-right small"></i>
            </Link>
          </div>
        </div>

        {/* Module 3: Assessments & Quizzes */}
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift transition-all">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="rounded-3 p-3 bg-warning bg-opacity-10 text-warning">
                <i className="fa-solid fa-award fs-4"></i>
              </div>
              <span className="badge bg-light text-muted">Assessments</span>
            </div>
            <h5 className="fw-bold mb-1">Grading & Exams</h5>
            <p className="text-muted small mb-4">
              Diagnostic readiness tests, lab assignments, and project deliverables.
            </p>
            <Link
              to="/student/assessments"
              className="btn btn-outline-warning btn-sm rounded-pill mt-auto d-inline-flex align-items-center justify-content-center gap-2"
            >
              <span>View Assessments</span>
              <i className="fa-solid fa-arrow-right small"></i>
            </Link>
          </div>
        </div>

        {/* Module 4: Course Evaluation */}
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift transition-all">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="rounded-3 p-3 bg-info bg-opacity-10 text-info">
                <i className="fa-solid fa-comment-dots fs-4"></i>
              </div>
              <span className="badge bg-light text-muted">Feedback</span>
            </div>
            <h5 className="fw-bold mb-1">Program Evaluation</h5>
            <p className="text-muted small mb-4">
              Submit cohort evaluations, mentor reviews, and request certificate.
            </p>
            <Link
              to="/student/evaluation"
              className="btn btn-outline-info btn-sm rounded-pill mt-auto d-inline-flex align-items-center justify-content-center gap-2"
            >
              <span>Provide Feedback</span>
              <i className="fa-solid fa-arrow-right small"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
