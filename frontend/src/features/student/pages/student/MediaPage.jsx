import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { mediaService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import UploadMediaModal from '../../components/media/UploadMediaModal';
import MediaDetailsModal from '../../components/media/MediaDetailsModal';
import AdminMediaReviewModal from '../../components/media/AdminMediaReviewModal';
import AssessmentDetails from '../../components/assessments/AssessmentDetails';

const FILE_TYPE_CONFIG = {
  pdf: { label: 'PDF Document', icon: 'fa-file-pdf', color: 'text-danger', bg: 'bg-danger-subtle' },
  word: { label: 'Word Document', icon: 'fa-file-word', color: 'text-primary', bg: 'bg-primary-subtle' },
  excel: { label: 'Spreadsheet / Data', icon: 'fa-file-excel', color: 'text-success', bg: 'bg-success-subtle' },
  powerpoint: { label: 'Presentation', icon: 'fa-file-powerpoint', color: 'text-warning', bg: 'bg-warning-subtle' },
  image: { label: 'Image / Diagram', icon: 'fa-file-image', color: 'text-info', bg: 'bg-info-subtle' },
  archive: { label: 'Archive / ZIP', icon: 'fa-file-zipper', color: 'text-secondary', bg: 'bg-secondary-subtle' },
  code: { label: 'Code Deliverable', icon: 'fa-file-code', color: 'text-dark', bg: 'bg-dark-subtle' },
  feedback: { label: 'Graded Evaluation', icon: 'fa-award', color: 'text-warning', bg: 'bg-warning-subtle' },
  document: { label: 'Academic File', icon: 'fa-file-lines', color: 'text-primary', bg: 'bg-primary-subtle' },
};

export default function MediaPage() {
  const { user, language = 'en' } = useAuth();
  const isAr = language === 'ar';
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'superadmin';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'assignments'; // 'assignments' | 'course_materials' | 'my_submissions' | 'public_gallery'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Assignment Sub-Filter: 'all' | 'pending' | 'submitted' | 'overdue' | 'graded'
  const [assignmentFilter, setAssignmentFilter] = useState('all');

  // Academic Resources State
  const [resources, setResources] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    assignments: 0,
    pendingAssignments: 0,
    submittedAssignments: 0,
    overdueAssignments: 0,
    gradedAssignments: 0,
    courseMaterials: 0,
    assignmentResources: 0,
    submissions: 0,
    gradedEvaluations: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(searchParams.get('courseId') || 'ALL');
  const [selectedFileType, setSelectedFileType] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  // Modals
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [previewResource, setPreviewResource] = useState(null);
  const [isAdminWorkspaceOpen, setIsAdminWorkspaceOpen] = useState(false);

  // Public Gallery State (Preserved)
  const [publicMedia, setPublicMedia] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [publicPlacement, setPublicPlacement] = useState('ALL');

  const loadResources = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await mediaService.getAcademicResources();
      setResources(data.resources || []);
      setAssignments(data.assignments || []);
      setCourseMaterials(data.sections?.courseMaterials || []);
      setMySubmissions(data.sections?.mySubmissions || []);
      setCourses(data.courses || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        (isAr ? 'فشل تحميل مركز التعلم والموارد الأكاديمية.' : 'Failed to load learning hub and academic resources.')
      );
    } finally {
      setLoading(false);
    }
  };

  const loadPublicGallery = async () => {
    setPublicLoading(true);
    setPublicError('');
    try {
      const res = await mediaService.getPublicGallery();
      const items = Array.isArray(res) ? res : res?.data || [];
      setPublicMedia(items);
    } catch (err) {
      setPublicError(err.message || (isAr ? 'فشل تحميل المعرض العام.' : 'Failed to load official public gallery.'));
    } finally {
      setPublicLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  useEffect(() => {
    if (activeTab === 'public_gallery' && publicMedia.length === 0) {
      loadPublicGallery();
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', activeTab);
      return next;
    });
  }, [activeTab]);

  // Filtered Assignments
  const filteredAssignments = useMemo(() => {
    let list = [...assignments];

    // Course filter
    if (selectedCourse !== 'ALL') {
      list = list.filter((a) => String(a.courseId || a.course?._id || a.course) === String(selectedCourse));
    }

    // Sub-status filter
    if (assignmentFilter === 'pending') {
      list = list.filter((a) => (a.status === 'Upcoming' || a.submissionStatus === 'Not Submitted') && !a.isDeadlinePassed);
    } else if (assignmentFilter === 'submitted') {
      list = list.filter((a) => a.status === 'Submitted' || a.status === 'Pending Evaluation' || a.submissionStatus === 'Submitted');
    } else if (assignmentFilter === 'overdue') {
      list = list.filter((a) => (a.status === 'Upcoming' || a.submissionStatus === 'Not Submitted') && a.isDeadlinePassed);
    } else if (assignmentFilter === 'graded') {
      list = list.filter((a) => a.status === 'Evaluated' || a.evaluationStatus === 'Evaluated');
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => {
        const titleMatch = a.title?.toLowerCase().includes(q);
        const courseMatch = a.courseTitle?.toLowerCase().includes(q);
        const descMatch = a.description?.toLowerCase().includes(q);
        const instructorMatch = a.instructorName?.toLowerCase().includes(q);
        return titleMatch || courseMatch || descMatch || instructorMatch;
      });
    }

    // Sorting
    if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.dueDate || a.createdAt || 0) - new Date(b.dueDate || b.createdAt || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      // Default: earliest upcoming deadline first
      list.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    }

    return list;
  }, [assignments, selectedCourse, assignmentFilter, searchQuery, sortBy]);

  // Filtered Course Materials
  const filteredCourseMaterials = useMemo(() => {
    let list = [...courseMaterials];

    if (selectedCourse !== 'ALL') {
      list = list.filter((r) => String(r.courseId) === String(selectedCourse));
    }
    if (selectedFileType !== 'ALL') {
      list = list.filter((r) => r.fileType === selectedFileType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const titleMatch = r.title?.toLowerCase().includes(q);
        const nameMatch = r.originalName?.toLowerCase().includes(q) || r.fileName?.toLowerCase().includes(q);
        const courseMatch = r.courseTitle?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        return titleMatch || nameMatch || courseMatch || descMatch;
      });
    }
    if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      list.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    }
    return list;
  }, [courseMaterials, selectedCourse, selectedFileType, searchQuery, sortBy]);

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    let list = [...mySubmissions];

    if (selectedCourse !== 'ALL') {
      list = list.filter((r) => String(r.courseId) === String(selectedCourse));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const titleMatch = r.title?.toLowerCase().includes(q);
        const nameMatch = r.originalName?.toLowerCase().includes(q) || r.fileName?.toLowerCase().includes(q);
        const courseMatch = r.courseTitle?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        return titleMatch || nameMatch || courseMatch || descMatch;
      });
    }
    if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      list.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    }
    return list;
  }, [mySubmissions, selectedCourse, searchQuery, sortBy]);

  // Filtered Public Media
  const filteredPublicMedia = useMemo(() => {
    return publicMedia.filter((item) => {
      if (publicPlacement === 'ALL') return true;
      return item.publicationPlacement === publicPlacement;
    });
  }, [publicMedia, publicPlacement]);

  const handleDownload = (e, item) => {
    e.stopPropagation();
    if (!item.downloadUrl) {
      alert(isAr ? 'رابط التحميل غير متوفر حالياً.' : 'Download file is not available for this entry.');
      return;
    }
    window.open(item.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePreview = (item) => {
    if (item.mediaDoc) {
      setSelectedDetailItem(item.mediaDoc);
    } else {
      setPreviewResource(item);
    }
  };

  const openAssignmentModal = (assessmentId) => {
    setSelectedAssessmentId(assessmentId);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title={isAr ? 'مركز التعلم والموارد الأكاديمية' : 'Learning Hub'}
        subtitle={
          isAr
            ? 'مستودع تدريبي متكامل لمتابعة التكليفات، مراجعة مواد المحاضرات، رفع التسليمات، ومتابعة درجات وملاحظات أعضاء هيئة التدريس.'
            : 'Unified student workspace to track assignments, access course materials, submit deliverables, and review faculty evaluations.'
        }
        breadcrumbs={[
          { label: isAr ? 'لوحة المتابعة' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'تدريبي' : 'My Training', to: '/student/training' },
          { label: isAr ? 'مركز التعلم' : 'Learning Hub' },
        ]}
        actions={
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm fw-semibold d-inline-flex align-items-center gap-1.5"
              onClick={() => setIsUploadOpen(true)}
              title="Upload project photo or training field media"
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>{isAr ? 'رفع وسائط تدريب' : 'Upload Training Media'}</span>
            </button>
            {isAdminOrStaff && (
              <button
                type="button"
                className="btn btn-outline-warning btn-sm rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1"
                onClick={() => setIsAdminWorkspaceOpen(true)}
              >
                <i className="fa-solid fa-list-check me-1"></i>
                <span>{isAr ? 'مراجعة الإشراف' : 'Moderation Workspace'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* 3 Core Metric Counters */}
      <div className="row g-3 mb-4">
        {/* Tab 1: Assignments */}
        <div className="col-12 col-md-4">
          <div
            className={`egsa-card p-3.5 h-100 border-start border-4 border-primary cursor-pointer transition-all ${
              activeTab === 'assignments' ? 'shadow-sm bg-light' : ''
            }`}
            onClick={() => setActiveTab('assignments')}
            role="button"
            tabIndex={0}
          >
            <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
              <span className="text-uppercase fw-semibold">{isAr ? 'التكليفات والمهام' : 'Assignments'}</span>
              <i className="fa-solid fa-list-check text-primary fa-lg"></i>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <span className="fs-3 fw-bold text-primary">{stats.assignments || assignments.length}</span>
              {stats.pendingAssignments > 0 && (
                <span className="badge bg-warning text-dark small" style={{ fontSize: '0.72rem' }}>
                  {stats.pendingAssignments} {isAr ? 'قيد الإجراء' : 'Action Required'}
                </span>
              )}
            </div>
            <div className="text-muted small mt-1">
              {stats.gradedAssignments} {isAr ? 'تم تقييمها' : 'graded'} &bull; {stats.submittedAssignments} {isAr ? 'قيد المراجعة' : 'submitted'}
            </div>
          </div>
        </div>

        {/* Tab 2: Course Materials */}
        <div className="col-12 col-md-4">
          <div
            className={`egsa-card p-3.5 h-100 border-start border-4 border-info cursor-pointer transition-all ${
              activeTab === 'course_materials' ? 'shadow-sm bg-light' : ''
            }`}
            onClick={() => setActiveTab('course_materials')}
            role="button"
            tabIndex={0}
          >
            <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
              <span className="text-uppercase fw-semibold">{isAr ? 'مواد المقررات والمحاضرات' : 'Course Materials'}</span>
              <i className="fa-solid fa-book-open text-info fa-lg"></i>
            </div>
            <div className="fs-3 fw-bold text-info">{stats.courseMaterials || courseMaterials.length}</div>
            <div className="text-muted small mt-1">{isAr ? 'ملفات ومراجع معتمدة من هيئة التدريس' : 'Instructor handouts, slides & references'}</div>
          </div>
        </div>

        {/* Tab 3: My Submissions */}
        <div className="col-12 col-md-4">
          <div
            className={`egsa-card p-3.5 h-100 border-start border-4 border-success cursor-pointer transition-all ${
              activeTab === 'my_submissions' ? 'shadow-sm bg-light' : ''
            }`}
            onClick={() => setActiveTab('my_submissions')}
            role="button"
            tabIndex={0}
          >
            <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
              <span className="text-uppercase fw-semibold">{isAr ? 'تسليماتي وإنجازاتي' : 'My Submissions'}</span>
              <i className="fa-solid fa-file-arrow-up text-success fa-lg"></i>
            </div>
            <div className="fs-3 fw-bold text-success">{stats.submissions || mySubmissions.length}</div>
            <div className="text-muted small mt-1">{isAr ? 'تسليمات مرفوعة مع سجل الإصدارات والتقييم' : 'Submitted deliverables & grade transcripts'}</div>
          </div>
        </div>
      </div>

      {/* Primary Section Navigation Tabs */}
      <div className="border-bottom pb-2 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <ul className="nav nav-pills gap-2 flex-wrap">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3.5 ${activeTab === 'assignments' ? 'active' : 'text-secondary'}`}
              onClick={() => setActiveTab('assignments')}
            >
              <i className="fa-solid fa-list-check me-1.5"></i>
              {isAr ? 'التكليفات والمهام' : 'Assignments'} ({stats.assignments || assignments.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3.5 ${activeTab === 'course_materials' ? 'active' : 'text-secondary'}`}
              onClick={() => setActiveTab('course_materials')}
            >
              <i className="fa-solid fa-book-open me-1.5"></i>
              {isAr ? 'مواد المقررات' : 'Course Materials'} ({stats.courseMaterials || courseMaterials.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3.5 ${activeTab === 'my_submissions' ? 'active' : 'text-secondary'}`}
              onClick={() => setActiveTab('my_submissions')}
            >
              <i className="fa-solid fa-file-arrow-up me-1.5"></i>
              {isAr ? 'تسليماتي' : 'My Submissions'} ({stats.submissions || mySubmissions.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3 text-secondary ${activeTab === 'public_gallery' ? 'active text-white' : ''}`}
              onClick={() => setActiveTab('public_gallery')}
            >
              <i className="fa-solid fa-globe me-1.5"></i>
              {isAr ? 'المعرض العام' : 'Public Gallery'}
            </button>
          </li>
        </ul>
      </div>

      {/* Shared Filter Bar: Search, Course Filter, File Type (for materials), Sort */}
      <div className="bg-white p-3 rounded-3 border mb-4 shadow-sm">
        <div className="row g-3 align-items-center">
          {/* Search Bar */}
          <div className="col-12 col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder={
                  activeTab === 'assignments'
                    ? (isAr ? 'بحث في التكليفات والبرامج...' : 'Search assignments, courses...')
                    : (isAr ? 'بحث بالاسم، الملف، أو المقرر...' : 'Search materials by title or course...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline-secondary border-start-0"
                  onClick={() => setSearchQuery('')}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>

          {/* Course Filter */}
          <div className="col-12 col-sm-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="ALL">{isAr ? 'جميع البرامج المسجلة' : 'All Enrolled Courses'}</option>
              {courses.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Contextual Filter: Sub-filter for Assignments, FileType for Course Materials */}
          {activeTab === 'assignments' ? (
            <div className="col-6 col-sm-3 col-md-3">
              <select
                className="form-select form-select-sm"
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
              >
                <option value="all">{isAr ? 'جميع التكليفات' : 'All Statuses'}</option>
                <option value="pending">{isAr ? 'قيد الانتظار (لم يتم التسليم)' : 'Action Required / Pending'}</option>
                <option value="submitted">{isAr ? 'تم التسليم (قيد المراجعة)' : 'Submitted — Under Review'}</option>
                <option value="graded">{isAr ? 'تم التقييم (مع الملاحظات)' : 'Graded & Evaluated'}</option>
                <option value="overdue">{isAr ? 'متأخرة' : 'Overdue'}</option>
              </select>
            </div>
          ) : (
            <div className="col-6 col-sm-3 col-md-3">
              <select
                className="form-select form-select-sm"
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value)}
              >
                <option value="ALL">{isAr ? 'جميع أنواع الملفات' : 'All File Types'}</option>
                <option value="pdf">PDF Documents</option>
                <option value="word">Word Documents</option>
                <option value="excel">Spreadsheets / Data</option>
                <option value="powerpoint">Presentations</option>
                <option value="image">Images & Diagrams</option>
                <option value="archive">Archives & ZIPs</option>
                <option value="code">Source Code / Scripts</option>
              </select>
            </div>
          )}

          {/* Sorting */}
          <div className="col-6 col-sm-3 col-md-2">
            <select
              className="form-select form-select-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">{isAr ? 'الأحدث أولاً' : 'Newest / Upcoming'}</option>
              <option value="oldest">{isAr ? 'الأقدم أولاً' : 'Oldest First'}</option>
              <option value="name">{isAr ? 'الاسم أ - ي' : 'Name A–Z'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <LoadingState label={isAr ? 'جاري تحميل محتوى مركز التعلم…' : 'Loading Learning Hub workspace…'} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadResources} />
      ) : activeTab === 'assignments' ? (
        /* =========================================================================
           TAB 1: ASSIGNMENTS WORKSPACE
           ========================================================================= */
        <div>
          {/* Sub-Filter Pills */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            {[
              { id: 'all', label: isAr ? 'الكل' : 'All Assignments', count: assignments.length },
              { id: 'pending', label: isAr ? 'مطلوب اتخاذ إجراء' : 'Pending Submission', count: stats.pendingAssignments },
              { id: 'submitted', label: isAr ? 'تم التسليم' : 'Submitted', count: stats.submittedAssignments },
              { id: 'graded', label: isAr ? 'تم التقييم' : 'Graded', count: stats.gradedAssignments },
              { id: 'overdue', label: isAr ? 'متأخرة' : 'Overdue', count: stats.overdueAssignments },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                  assignmentFilter === f.id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
                }`}
                onClick={() => setAssignmentFilter(f.id)}
              >
                {f.label} <span className="opacity-75">({f.count})</span>
              </button>
            ))}
          </div>

          {filteredAssignments.length === 0 ? (
            <EmptyState
              icon="fa-list-check"
              title={isAr ? 'لا توجد تكليفات مطابقة' : 'No assignments found'}
              message={
                searchQuery || selectedCourse !== 'ALL' || assignmentFilter !== 'all'
                  ? (isAr ? 'جرب تغيير تصفية البحث أو اختيار مقرر تدريبي آخر.' : 'Try adjusting your search criteria or status filter.')
                  : (isAr ? 'لا توجد تكليفات معلنة في برامجك التدريبية المسجلة حالياً.' : 'Assignments will appear here as soon as your course instructor publishes them.')
              }
              actionLabel={searchQuery || selectedCourse !== 'ALL' || assignmentFilter !== 'all' ? (isAr ? 'إعادة ضبط التصفية' : 'Reset Filters') : null}
              onAction={() => {
                setSearchQuery('');
                setSelectedCourse('ALL');
                setAssignmentFilter('all');
              }}
            />
          ) : (
            <div className="row g-3">
              {filteredAssignments.map((a) => {
                const isEvaluated = a.status === 'Evaluated' || a.evaluationStatus === 'Evaluated';
                const isSubmitted = a.status === 'Submitted' || a.status === 'Pending Evaluation' || a.submissionStatus === 'Submitted';
                const isOverdue = !isSubmitted && !isEvaluated && a.isDeadlinePassed;
                const dueDate = a.dueDate;
                const formattedDueDate = dueDate
                  ? new Date(dueDate).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <div key={a._id || a.id} className="col-12 col-lg-6">
                    <div
                      className={`egsa-card p-3.5 h-100 shadow-sm border d-flex flex-column transition-all ${
                        isOverdue ? 'border-danger-subtle' : ''
                      }`}
                      style={{ cursor: 'pointer', borderRadius: '12px' }}
                      onClick={() => openAssignmentModal(a._id || a.id)}
                    >
                      {/* Top Badges */}
                      <div className="d-flex justify-content-between align-items-center mb-2.5">
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small fw-semibold">
                          <i className="fa-solid fa-graduation-cap me-1"></i>
                          {a.courseTitle || 'EGSA Course'}
                          {a.cohortName && <span className="ms-1.5 opacity-75">&bull; {a.cohortName}</span>}
                        </span>

                        {isEvaluated ? (
                          <span className={`badge px-2.5 py-1 ${a.resultLabel === 'Passed' ? 'bg-success text-white' : 'bg-warning text-dark'}`}>
                            <i className="fa-solid fa-award me-1"></i>
                            {a.score != null ? `${a.score} / ${a.maxScore || 100} (${a.percentage}%)` : 'Graded'}
                          </span>
                        ) : isSubmitted ? (
                          <span className="badge bg-info text-dark px-2.5 py-1">
                            <i className="fa-solid fa-clock-rotate-left me-1"></i>
                            {isAr ? 'تم التسليم &bull; قيد المراجعة' : 'Submitted — Under Review'}
                          </span>
                        ) : isOverdue ? (
                          <span className="badge bg-danger text-white px-2.5 py-1">
                            <i className="fa-solid fa-triangle-exclamation me-1"></i>
                            {isAr ? 'متأخر' : 'Overdue'}
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-dark border border-warning-subtle px-2.5 py-1">
                            <i className="fa-regular fa-clock me-1 text-warning"></i>
                            {isAr ? 'مطلوب التسليم' : 'Pending Submission'}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h5 className="fw-bold text-dark mb-1 text-truncate" title={a.title}>
                        {a.title}
                      </h5>
                      <p className="text-secondary small mb-3" style={{ lineHeight: '1.5', minHeight: '3rem' }}>
                        {a.description || a.instructions || (isAr ? 'توجيهات ومتطلبات التكليف التدريبي المعتمد من هيئة التدريس.' : 'Instructor assignment instructions and deliverables requirements.')}
                      </p>

                      {/* Metadata Strip */}
                      <div className="bg-light p-2.5 rounded-3 mb-3 small d-flex flex-wrap align-items-center justify-content-between gap-2 text-muted">
                        <div>
                          <i className="fa-regular fa-calendar-clock me-1 text-primary"></i>
                          <span className="fw-semibold text-dark">{isAr ? 'الموعد النهائي:' : 'Deadline:'} </span>
                          <span className={isOverdue ? 'text-danger fw-semibold' : ''}>{formattedDueDate}</span>
                        </div>
                        <div>
                          <i className="fa-solid fa-bullseye me-1 text-success"></i>
                          <span className="fw-semibold text-dark">{isAr ? 'الدرجة:' : 'Max Score:'} </span>
                          <span>{a.maxScore || 100}</span>
                        </div>
                      </div>

                      {/* Footer Actions: Explicit Assignment Action Button */}
                      <div className="mt-auto pt-2.5 border-top d-flex justify-content-between align-items-center" onClick={(e) => e.stopPropagation()}>
                        <div className="small text-muted d-flex align-items-center gap-1.5">
                          <i className="fa-solid fa-user-tie text-secondary"></i>
                          <span>{a.instructorName || 'EGSA Faculty'}</span>
                        </div>

                        <div>
                          {isEvaluated ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
                              onClick={() => openAssignmentModal(a._id || a.id)}
                            >
                              <i className="fa-solid fa-award"></i>
                              <span>{isAr ? 'عرض النتيجة والملاحظات' : 'View Feedback & Score'}</span>
                            </button>
                          ) : isSubmitted ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1.5"
                              onClick={() => openAssignmentModal(a._id || a.id)}
                            >
                              <i className="fa-solid fa-file-lines"></i>
                              <span>{isAr ? 'عرض التسليم' : 'View Submission'}</span>
                            </button>
                          ) : isOverdue && a.allowLateSubmission ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-warning text-dark rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
                              onClick={() => openAssignmentModal(a._id || a.id)}
                            >
                              <i className="fa-solid fa-clock-rotate-left"></i>
                              <span>{isAr ? 'تسليم متأخر' : 'Submit Late'}</span>
                            </button>
                          ) : isOverdue && !a.allowLateSubmission ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1.5"
                              onClick={() => openAssignmentModal(a._id || a.id)}
                            >
                              <i className="fa-solid fa-eye"></i>
                              <span>{isAr ? 'عرض التوجيهات' : 'View Instructions'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary rounded-pill px-3.5 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
                              onClick={() => openAssignmentModal(a._id || a.id)}
                            >
                              <i className="fa-solid fa-arrow-up-from-bracket"></i>
                              <span>{isAr ? 'بدء التكليف ورفع العمل' : 'Start Assignment / Submit Work'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'course_materials' ? (
        /* =========================================================================
           TAB 2: COURSE MATERIALS
           ========================================================================= */
        <div>
          {filteredCourseMaterials.length === 0 ? (
            <EmptyState
              icon="fa-book-open"
              title={isAr ? 'لا توجد مواد مقررات مطابقة' : 'No course materials found'}
              message={
                searchQuery || selectedCourse !== 'ALL' || selectedFileType !== 'ALL'
                  ? (isAr ? 'جرب تغيير شروط البحث أو التصفية.' : 'Try adjusting your search criteria or filter selections.')
                  : (isAr ? 'ستظهر هنا ملفات المحاضرات والمراجع المعتمدة فور قيام هيئة التدريس برفعها.' : 'Instructor handouts and reference materials will appear here as your course progresses.')
              }
            />
          ) : (
            <div className="row g-3">
              {filteredCourseMaterials.map((item) => {
                const conf = FILE_TYPE_CONFIG[item.fileType] || FILE_TYPE_CONFIG.document;
                const formattedDate = item.uploadedAt
                  ? new Date(item.uploadedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <div key={item.id} className="col-12 col-md-6 col-xl-4">
                    <div
                      className="egsa-card p-3 h-100 shadow-sm border d-flex flex-column transition-all"
                      style={{ cursor: 'pointer', borderRadius: '12px' }}
                      onClick={() => handlePreview(item)}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className={`badge ${conf.bg} ${conf.color} border px-2 py-1 small fw-semibold`}>
                          <i className={`fa-solid ${conf.icon} me-1`}></i>
                          {conf.label}
                        </span>
                        <span className="badge bg-light text-secondary border">
                          {item.uploader || 'Instructor'}
                        </span>
                      </div>

                      <h6 className="fw-bold text-dark mb-1 text-truncate" title={item.title}>
                        {item.title}
                      </h6>
                      <p className="text-secondary small mb-3 text-truncate" title={item.description}>
                        {item.description || (isAr ? 'ملف تدريبي معتمد للمقرر' : 'Official course training material')}
                      </p>

                      <div className="mb-3 small text-muted d-flex align-items-center gap-1.5">
                        <i className="fa-solid fa-graduation-cap text-primary"></i>
                        <span className="fw-medium text-dark text-truncate" title={item.courseTitle}>
                          {item.courseTitle}
                        </span>
                        {item.cohortName && <span className="text-secondary">&bull; {item.cohortName}</span>}
                      </div>

                      <div className="mt-auto pt-2.5 border-top d-flex justify-content-between align-items-center small text-muted">
                        <div className="d-flex align-items-center gap-2">
                          {item.fileSize && <span>{item.fileSize}</span>}
                          {item.fileSize && <span>&bull;</span>}
                          <span>{formattedDate}</span>
                        </div>

                        <div className="d-flex align-items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {item.downloadUrl && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={(e) => handleDownload(e, item)}
                              title={isAr ? 'تحميل الملف' : 'Download File'}
                            >
                              <i className="fa-solid fa-download"></i>
                              <span className="small">{isAr ? 'تحميل' : 'Download'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-light border py-1 px-2 rounded-circle"
                            onClick={() => handlePreview(item)}
                            title={isAr ? 'معاينة' : 'Preview'}
                            style={{ width: '28px', height: '28px' }}
                          >
                            <i className="fa-solid fa-eye text-secondary" style={{ fontSize: '0.75rem' }}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'my_submissions' ? (
        /* =========================================================================
           TAB 3: MY SUBMISSIONS & DELIVERABLES
           ========================================================================= */
        <div>
          {filteredSubmissions.length === 0 ? (
            <EmptyState
              icon="fa-file-arrow-up"
              title={isAr ? 'لا توجد تسليمات مسجلة' : 'No submissions found'}
              message={
                searchQuery || selectedCourse !== 'ALL'
                  ? (isAr ? 'جرب تغيير تصفية البحث أو اختيار مقرر تدريبي آخر.' : 'Try adjusting your search criteria.')
                  : (isAr ? 'ستظهر هنا كافة الأعمال والملفات والمشاريع التي ترفعها لتقييمها من هيئة التدريس.' : 'Deliverables you upload for training assignments and projects will appear here.')
              }
            />
          ) : (
            <div className="row g-3">
              {filteredSubmissions.map((item) => {
                const conf = FILE_TYPE_CONFIG[item.fileType] || FILE_TYPE_CONFIG.document;
                const formattedDate = item.uploadedAt
                  ? new Date(item.uploadedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <div key={item.id} className="col-12 col-md-6 col-xl-4">
                    <div
                      className="egsa-card p-3 h-100 shadow-sm border d-flex flex-column transition-all"
                      style={{ cursor: 'pointer', borderRadius: '12px' }}
                      onClick={() => {
                        if (item.assessmentId) {
                          openAssignmentModal(item.assessmentId);
                        } else {
                          handlePreview(item);
                        }
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className={`badge ${conf.bg} ${conf.color} border px-2 py-1 small fw-semibold`}>
                          <i className={`fa-solid ${conf.icon} me-1`}></i>
                          {item.version ? `Deliverable v${item.version}` : 'Submission'}
                        </span>

                        {item.status === 'Graded' || item.status === 'Evaluated' ? (
                          <span className="badge bg-success text-white">
                            <i className="fa-solid fa-award me-1"></i> {isAr ? 'تم التقييم' : 'Graded'}
                          </span>
                        ) : (
                          <span className="badge bg-info text-dark">
                            <i className="fa-solid fa-clock me-1"></i> {item.status || 'Submitted'}
                          </span>
                        )}
                      </div>

                      <h6 className="fw-bold text-dark mb-1 text-truncate" title={item.title}>
                        {item.title}
                      </h6>
                      <p className="text-secondary small mb-3 text-truncate" title={item.description}>
                        {item.description || (isAr ? 'عمل مرفوع للتقييم الأكاديمي' : 'Uploaded student deliverable')}
                      </p>

                      <div className="mb-3 small text-muted d-flex align-items-center gap-1.5">
                        <i className="fa-solid fa-graduation-cap text-primary"></i>
                        <span className="fw-medium text-dark text-truncate" title={item.courseTitle}>
                          {item.courseTitle}
                        </span>
                        {item.cohortName && <span className="text-secondary">&bull; {item.cohortName}</span>}
                      </div>

                      <div className="mt-auto pt-2.5 border-top d-flex justify-content-between align-items-center small text-muted">
                        <div className="d-flex align-items-center gap-2">
                          {item.fileSize && <span>{item.fileSize}</span>}
                          {item.fileSize && <span>&bull;</span>}
                          <span>{formattedDate}</span>
                        </div>

                        <div className="d-flex align-items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {item.downloadUrl && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1"
                              onClick={(e) => handleDownload(e, item)}
                              title={isAr ? 'تحميل الملف' : 'Download File'}
                            >
                              <i className="fa-solid fa-download"></i>
                              <span className="small">{isAr ? 'تحميل' : 'Download'}</span>
                            </button>
                          )}
                          {item.assessmentId ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={() => openAssignmentModal(item.assessmentId)}
                              title={isAr ? 'تفاصيل التكليف' : 'View Details'}
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square"></i>
                              <span className="small">{isAr ? 'التفاصيل' : 'Details'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-light border py-1 px-2 rounded-circle"
                              onClick={() => handlePreview(item)}
                              title={isAr ? 'معاينة' : 'Preview'}
                              style={{ width: '28px', height: '28px' }}
                            >
                              <i className="fa-solid fa-eye text-secondary" style={{ fontSize: '0.75rem' }}></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
           TAB 4: PUBLIC GALLERY (PRESERVED)
           ========================================================================= */
        <div>
          <div className="bg-white p-3 rounded-3 border mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: isAr ? 'جميع المنشورات' : 'All Published' },
                { id: 'homepage', label: isAr ? 'الصفحة الرئيسية' : 'Homepage Hero' },
                { id: 'course_gallery', label: isAr ? 'معرض البرامج' : 'Course Galleries' },
                { id: 'highlights', label: isAr ? 'أبرز الإنجازات' : 'Academy Highlights' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  className={`btn btn-sm rounded-pill px-3 ${publicPlacement === filter.id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                  onClick={() => setPublicPlacement(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="text-muted small">
              <i className="fa-solid fa-circle-check text-success me-1"></i>
              {isAr ? 'وسائط معتمدة للنشر العام' : 'Officially curated & published'}
            </div>
          </div>

          {publicLoading ? (
            <LoadingState label={isAr ? 'جاري تحميل المعرض العام…' : 'Loading public showcase gallery…'} />
          ) : publicError ? (
            <ErrorState message={publicError} onRetry={loadPublicGallery} />
          ) : filteredPublicMedia.length === 0 ? (
            <EmptyState
              icon="fa-images"
              title={isAr ? 'لا توجد وسائط منشورة حالياً' : 'No public media in this section'}
              message={isAr ? 'يتم نشر أعمال الطلاب والصور بعد اعتمادها من هيئة التدريس وإدارة الأكاديمية.' : 'Curated cadet media will appear here once approved by Academy editorial staff.'}
            />
          ) : (
            <div className="row g-4">
              {filteredPublicMedia.map((item) => (
                <div key={item._id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                  <div className="egsa-card h-100 shadow-sm overflow-hidden d-flex flex-column border">
                    <div style={{ height: '180px', backgroundColor: '#0b162c' }} className="position-relative overflow-hidden">
                      <img
                        src={item.thumbnailUrl || item.fileUrl}
                        alt={item.title}
                        className="w-100 h-100"
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="badge bg-primary position-absolute top-0 start-0 m-2 shadow-sm text-uppercase" style={{ fontSize: '0.65rem' }}>
                        {item.publicationPlacement?.replace('_', ' ') || 'Gallery'}
                      </span>
                    </div>
                    <div className="p-3 d-flex flex-column flex-grow-1">
                      <h6 className="fw-bold text-dark mb-1 text-truncate" title={item.title}>
                        {item.title}
                      </h6>
                      <p className="text-secondary small mb-2 text-truncate" title={item.caption || item.description}>
                        {item.caption || item.description || (isAr ? 'نشاط تدريبي معتمد' : 'Official training activity')}
                      </p>
                      <div className="mt-auto pt-2 border-top d-flex justify-content-between align-items-center small text-muted">
                        <span>{item.course?.title || 'EGSA Space Academy'}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary rounded-circle"
                          onClick={() => setSelectedDetailItem(item)}
                          title="View Details"
                          style={{ width: '30px', height: '30px' }}
                        >
                          <i className="fa-solid fa-expand" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          1. ASSIGNMENT DETAILS & SUBMISSION WORKSPACE MODAL
          ========================================================================= */}
      {selectedAssessmentId && (
        <AssessmentDetails
          assessmentId={selectedAssessmentId}
          onClose={() => setSelectedAssessmentId(null)}
          onUpdated={() => {
            loadResources();
          }}
          language={language}
        />
      )}

      {/* =========================================================================
          2. RESOURCE PREVIEW MODAL
          ========================================================================= */}
      {previewResource && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
          tabIndex="-1"
          onClick={() => setPreviewResource(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg text-dark overflow-hidden" style={{ borderRadius: '16px' }}>
              <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg, #0b1a3d 0%, #050c1c 100%)' }}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <span className="badge bg-light text-dark fw-bold text-uppercase mb-2" style={{ fontSize: '0.7rem' }}>
                      {previewResource.category}
                    </span>
                    <h5 className="fw-bold text-white mb-1">{previewResource.title}</h5>
                    <div className="small text-light opacity-75">
                      <i className="fa-solid fa-graduation-cap me-1"></i>
                      {previewResource.courseTitle}
                      {previewResource.cohortName && <span className="ms-2">&bull; {previewResource.cohortName}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light rounded-circle"
                    onClick={() => setPreviewResource(null)}
                    style={{ width: '32px', height: '32px' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>

              <div className="modal-body p-4 bg-light d-flex flex-column gap-3">
                <div className="bg-white p-3 rounded-3 border">
                  <h6 className="fw-bold text-dark small text-uppercase mb-2">
                    <i className="fa-solid fa-circle-info text-primary me-2"></i>
                    {isAr ? 'بيانات الملف والمورد' : 'Resource Details'}
                  </h6>
                  <p className="text-secondary small mb-3">
                    {previewResource.description}
                  </p>
                  <div className="row g-2 small text-muted">
                    {previewResource.originalName && (
                      <div className="col-sm-6">
                        <span className="fw-semibold text-dark">{isAr ? 'اسم الملف الأصلي:' : 'Original File:'} </span>
                        {previewResource.originalName}
                      </div>
                    )}
                    {previewResource.fileSize && (
                      <div className="col-sm-6">
                        <span className="fw-semibold text-dark">{isAr ? 'حجم الملف:' : 'File Size:'} </span>
                        {previewResource.fileSize}
                      </div>
                    )}
                    {previewResource.uploader && (
                      <div className="col-sm-6">
                        <span className="fw-semibold text-dark">{isAr ? 'المصدر:' : 'Source:'} </span>
                        {previewResource.uploader}
                      </div>
                    )}
                    {previewResource.uploadedAt && (
                      <div className="col-sm-6">
                        <span className="fw-semibold text-dark">{isAr ? 'تاريخ الرفع:' : 'Date:'} </span>
                        {new Date(previewResource.uploadedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {previewResource.fileType === 'image' && previewResource.fileUrl && (
                  <div className="text-center bg-dark p-2 rounded-3">
                    <img
                      src={previewResource.fileUrl}
                      alt={previewResource.title}
                      className="img-fluid rounded"
                      style={{ maxHeight: '350px' }}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                  onClick={() => setPreviewResource(null)}
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
                {previewResource.downloadUrl && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-pill px-4 shadow-sm fw-semibold"
                    onClick={(e) => handleDownload(e, previewResource)}
                  >
                    <i className="fa-solid fa-download me-1.5"></i>
                    {isAr ? 'تحميل الملف' : 'Download File'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. OTHER MODALS INTEGRATION
          ========================================================================= */}
      
      {/* Student Upload Modal (Field/Project Media) */}
      <UploadMediaModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          loadResources();
        }}
      />

      {/* Media Details & Lightbox Modal */}
      <MediaDetailsModal
        isOpen={Boolean(selectedDetailItem)}
        onClose={() => setSelectedDetailItem(null)}
        mediaItem={selectedDetailItem}
        onRefreshData={() => {
          loadResources();
          setSelectedDetailItem(null);
        }}
      />

      {/* Admin Moderation & Editorial Workspace Modal */}
      {isAdminOrStaff && (
        <AdminMediaReviewModal
          isOpen={isAdminWorkspaceOpen}
          onClose={() => setIsAdminWorkspaceOpen(false)}
          onRefreshData={() => {
            loadResources();
            if (activeTab === 'public_gallery') loadPublicGallery();
          }}
        />
      )}
    </div>
  );
}
