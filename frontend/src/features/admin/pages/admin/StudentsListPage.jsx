import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import adminService from '../../services/api/adminService';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { DIVISION_LABELS } from '../../constants/divisions';
import styles from './StudentsListPage.module.css';

function getInitials(name) {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function StudentsListPage() {
  const { division } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Status toggle confirmation modal
  const [confirmStudent, setConfirmStudent] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Add Student Modal State
  const defaultAddDivision =
    division && division.toUpperCase() === 'UNIVERSITY' ? 'UNIVERSITY' : 'PRE_UNIVERSITY';
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    password: '',
    division: defaultAddDivision,
    phone: '',
    institution: '',
    academicYear: '',
  });

  const load = useCallback(
    async (isBackground = false) => {
      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const params = { page, limit: 10 };
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== '') params.isActive = statusFilter;

        const divisionParam = user.role === ROLES.SUPER_ADMIN ? division : undefined;
        const res = await adminService.listStudents(divisionParam, params);
        setResult(res);
      } catch (err) {
        setError(err.message || 'Failed to load students');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [division, page, search, statusFilter, user.role]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  const handleConfirmToggle = async () => {
    if (!confirmStudent) return;
    setStatusLoading(true);
    try {
      const newStatus = !confirmStudent.user?.isActive;
      await adminService.updateStudentStatus(confirmStudent._id, newStatus);
      setConfirmStudent(null);
      load(true);
    } catch (err) {
      alert(err.message || 'Failed to update student status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await adminService.createStudent(addForm);
      setAddSuccess(`Cadet account for ${addForm.fullName} created successfully.`);
      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess('');
        setAddForm({
          fullName: '',
          email: '',
          password: '',
          division: defaultAddDivision,
          phone: '',
          institution: '',
          academicYear: '',
        });
        load(true);
      }, 800);
    } catch (err) {
      setAddError(err.response?.data?.message || err.message || 'Failed to create student account');
    } finally {
      setAddLoading(false);
    }
  };

  const rows = result?.data?.students || [];
  const totalCount = result?.meta?.total ?? rows.length;
  const activeCount = rows.filter((r) => r.user?.isActive).length;
  const inactiveCount = rows.filter((r) => !r.user?.isActive).length;
  const activeDivisionSlug = division || 'all';

  const divisionLabel =
    division && DIVISION_LABELS[division.toUpperCase()]
      ? DIVISION_LABELS[division.toUpperCase()]
      : division
      ? division.replace(/_/g, ' ')
      : 'All Divisions';

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== '');
  const isFullSet = !result?.meta?.totalPages || result.meta.totalPages <= 1;
  const activeSubtitle = isFullSet
    ? 'Active student portal accounts'
    : `${activeCount} of ${rows.length} active on current page`;
  const inactiveSubtitle = isFullSet
    ? inactiveCount > 0
      ? 'Logins suspended'
      : 'Zero deactivated accounts'
    : `${inactiveCount} suspended on current page`;

  const columns = [
    {
      key: 'fullName',
      label: 'Cadet Identity',
      render: (row) => {
        const targetDiv = division || row.division?.toLowerCase() || 'all';
        return (
          <div className={styles.studentCell}>
            <div className={styles.avatar}>{getInitials(row.user?.fullName)}</div>
            <div className={styles.studentMeta}>
              <Link
                to={`/admin/${targetDiv}/students/${row._id}`}
                className={styles.studentNameLink}
                title="Open cadet dossier"
              >
                {row.user?.fullName || 'Academy Student'}
              </Link>
              <div className={styles.studentEmail}>
                <i className="fa-regular fa-envelope me-1 opacity-75" />
                {row.user?.email || '—'}
              </div>
              {row.user?.phone && (
                <div className={styles.studentSubtext}>
                  <i className="fa-solid fa-phone" />
                  <span>{row.user.phone}</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'institution',
      label: 'Affiliation & Major',
      render: (row) => (
        <div className={styles.affiliationCell}>
          <div className={styles.institutionName}>
            {row.institution || row.university || 'Egyptian Space Agency Candidate'}
          </div>
          <div className={styles.majorYear}>
            {row.major && row.major !== '—' ? row.major : 'Aerospace Engineering'}
            {row.academicYear && row.academicYear !== '—' ? ` · ${row.academicYear}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'division',
      label: 'Division',
      render: (row) => {
        const isUni = row.division === 'UNIVERSITY';
        return (
          <span className={`${styles.divisionTag} ${isUni ? styles.tagUni : styles.tagPreUni}`}>
            <i className={`fa-solid ${isUni ? 'fa-graduation-cap' : 'fa-school'}`} />
            {DIVISION_LABELS[row.division] || row.division?.replace(/_/g, ' ') || '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.user?.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'createdAt',
      label: 'Enrolled On',
      render: (row) => (
        <div className={styles.dateCell}>
          <i className="fa-regular fa-calendar" />
          <span>{formatDate(row.user?.createdAt || row.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const isActive = row.user?.isActive;
        const targetDiv = division || row.division?.toLowerCase() || 'all';
        return (
          <div className={styles.actionsRow}>
            <Link
              to={`/admin/${targetDiv}/students/${row._id}`}
              className={styles.viewBtn}
              title="Inspect complete cadet dossier, applications, and enrollments"
            >
              <i className="fa-solid fa-address-card" />
              <span>Dossier</span>
            </Link>
            <button
              type="button"
              className={isActive ? styles.deactivateBtn : styles.activateBtn}
              onClick={() => setConfirmStudent(row)}
              title={isActive ? 'Deactivate student account' : 'Reactivate student account'}
            >
              <i className={`fa-solid ${isActive ? 'fa-user-slash' : 'fa-user-check'}`} />
              <span>{isActive ? 'Deactivate' : 'Activate'}</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Students Directory"
        subtitle={`Authoritative registry of enrolled cadets and trainees in ${divisionLabel}.`}
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => load(true)}
              disabled={refreshing || loading}
              title="Refresh directory records from database"
            >
              <i className={`fa-solid fa-arrows-rotate ${refreshing ? 'fa-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => setShowAddModal(true)}
              id="btn-add-student"
            >
              <i className="fa-solid fa-user-plus" />
              <span>Add Student</span>
            </button>
          </div>
        }
      />

      {/* 4-Pillar Summary Metric Grid */}
      <div className={styles.statsGrid} role="region" aria-label="Student directory metrics overview">
        {/* Card 1: Enrolled Cadets */}
        <div
          className={`${styles.metricCard} ${styles.cardNavy}`}
          aria-label={`Enrolled Cadets: ${totalCount}`}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Enrolled Cadets</span>
            <div className={`${styles.cardIconWrap} ${styles.iconNavy}`}>
              <i className="fa-solid fa-user-graduate" aria-hidden="true" />
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardNumber}>{totalCount}</div>
          </div>
          <p className={styles.cardSubtitle}>
            <span className={`${styles.subDot} ${styles.dotNavy}`} />
            {hasActiveFilters ? 'Matching filtered search query' : 'Total registered student profiles'}
          </p>
        </div>

        {/* Card 2: Active Accounts */}
        <div
          className={`${styles.metricCard} ${styles.cardEmerald}`}
          aria-label={`Active Accounts: ${activeCount}`}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>
              {isFullSet ? 'Active Accounts' : 'Active (Page)'}
            </span>
            <div className={`${styles.cardIconWrap} ${styles.iconEmerald}`}>
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardNumber}>{activeCount}</div>
          </div>
          <p className={styles.cardSubtitle}>
            <span className={`${styles.subDot} ${styles.dotEmerald}`} />
            {activeSubtitle}
          </p>
        </div>

        {/* Card 3: Inactive / On Hold */}
        <div
          className={`${styles.metricCard} ${
            inactiveCount > 0 ? styles.cardCoral : styles.cardSlate
          }`}
          aria-label={`Inactive or on hold accounts: ${inactiveCount}`}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>
              {isFullSet ? 'Inactive / On Hold' : 'Inactive (Page)'}
            </span>
            <div
              className={`${styles.cardIconWrap} ${
                inactiveCount > 0 ? styles.iconCoral : styles.iconSlate
              }`}
            >
              <i className="fa-solid fa-user-slash" aria-hidden="true" />
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardNumber}>{inactiveCount}</div>
          </div>
          <p className={styles.cardSubtitle}>
            <span
              className={`${styles.subDot} ${
                inactiveCount > 0 ? styles.dotCoral : styles.subDot
              }`}
            />
            {inactiveSubtitle}
          </p>
        </div>

        {/* Card 4: Administrative Scope */}
        <div
          className={`${styles.metricCard} ${styles.cardGold}`}
          aria-label={`Division Scope: ${divisionLabel}`}
        >
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Division Scope</span>
            <div className={`${styles.cardIconWrap} ${styles.iconGold}`}>
              <i className="fa-solid fa-landmark" aria-hidden="true" />
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardTextValue} title={divisionLabel}>
              {divisionLabel}
            </div>
          </div>
          <p className={styles.cardSubtitle}>
            <span className={`${styles.subDot} ${styles.dotGold}`} />
            Active division boundaries
          </p>
        </div>
      </div>

      {/* Institutional Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <i className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by cadet name, email, phone, or ID..."
            value={search}
            onChange={handleSearchChange}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={handleClearSearch}
              title="Clear search query"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        <div className={styles.filterControls}>
          <select
            className={styles.selectInput}
            value={statusFilter}
            onChange={handleStatusFilterChange}
            aria-label="Filter by account status"
          >
            <option value="">All Account Statuses</option>
            <option value="true">Active Cadets Only</option>
            <option value="false">Inactive / Suspended</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className={styles.resetFilterBtn}
              onClick={handleResetFilters}
              title="Reset search and filters"
            >
              <i className="fa-solid fa-rotate-left" />
              <span>Reset</span>
            </button>
          )}

          <div className={styles.resultsCountBadge}>
            Showing {rows.length} of {totalCount} cadet{totalCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Content State: Loading, Error, or Table */}
      {loading && !result ? (
        <LoadingState message="Loading academy student directory..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : rows.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No Matching Cadets Found"
            message={`No student records match your query "${search}" with status "${statusFilter || 'any'}".`}
            action={
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mt-2"
                onClick={handleResetFilters}
              >
                <i className="fa-solid fa-rotate-left me-1" />
                Clear Filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No Registered Students"
            message={`No cadets have been enrolled in the ${divisionLabel} yet. Click 'Add Student' to register candidates.`}
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm mt-2"
                onClick={() => setShowAddModal(true)}
              >
                <i className="fa-solid fa-user-plus me-1" />
                Add Student
              </button>
            }
          />
        )
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            const targetDiv = division || row.division?.toLowerCase() || 'all';
            navigate(`/admin/${targetDiv}/students/${row._id}`);
          }}
          pagination={
            result?.meta && result.meta.totalPages > 1
              ? {
                  page: result.meta.page,
                  limit: result.meta.limit,
                  total: result.meta.total,
                  totalPages: result.meta.totalPages,
                  onPageChange: (newPage) => setPage(newPage),
                }
              : undefined
          }
        />
      )}

      {/* Confirmation Modal for Quick Status Toggle */}
      {confirmStudent && (
        <ConfirmModal
          isOpen={!!confirmStudent}
          onClose={() => !statusLoading && setConfirmStudent(null)}
          onConfirm={handleConfirmToggle}
          title={confirmStudent.user?.isActive ? 'Deactivate Student Account' : 'Reactivate Student Account'}
          message={
            confirmStudent.user?.isActive ? (
              <>
                Are you sure you want to deactivate{' '}
                <strong>{confirmStudent.user?.fullName}</strong>?
                <br />
                <span className="text-danger mt-1 d-block" style={{ fontSize: '0.85rem' }}>
                  This student will immediately lose platform access and be rejected on login with a 403 Forbidden status.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to reactivate{' '}
                <strong>{confirmStudent.user?.fullName}</strong>?
                <br />
                <span className="text-success mt-1 d-block" style={{ fontSize: '0.85rem' }}>
                  This student will regain system access to browse programs and view application status.
                </span>
              </>
            )
          }
          confirmText={confirmStudent.user?.isActive ? 'Deactivate Account' : 'Reactivate Account'}
          confirmTone={confirmStudent.user?.isActive ? 'danger' : 'success'}
          loading={statusLoading}
          icon={confirmStudent.user?.isActive ? 'fa-user-slash' : 'fa-user-check'}
        />
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <Modal
          title="Register Academy Cadet"
          isOpen={showAddModal}
          onClose={() => !addLoading && setShowAddModal(false)}
          size="lg"
        >
          <form onSubmit={handleCreateStudent} className="d-flex flex-column gap-3">
            {addError && <div className="alert alert-danger py-2 small mb-0">{addError}</div>}
            {addSuccess && <div className="alert alert-success py-2 small mb-0">{addSuccess}</div>}

            <div className={styles.formSection}>
              <div className={styles.formSectionTitle}>
                <i className="fa-solid fa-id-card text-primary" />
                <span>Cadet Identity & Account Credentials</span>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className={styles.formLabel}>Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="e.g. Mariam Soliman"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className={styles.formLabel}>Email Address *</label>
                  <input
                    type="email"
                    required
                    className={styles.formInput}
                    placeholder="student@egsa.academy"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className={styles.formLabel}>Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className={styles.formInput}
                    placeholder="Minimum 8 characters"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className={styles.formLabel}>Assigned Division *</label>
                  <select
                    className={styles.formInput}
                    disabled={
                      user.role !== ROLES.SUPER_ADMIN &&
                      (division?.toLowerCase() === 'university' || division?.toLowerCase() === 'pre-university')
                    }
                    value={addForm.division}
                    onChange={(e) => setAddForm({ ...addForm, division: e.target.value })}
                  >
                    <option value="PRE_UNIVERSITY">Pre-University Division</option>
                    <option value="UNIVERSITY">University Division</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionTitle}>
                <i className="fa-solid fa-graduation-cap text-warning" />
                <span>Academic Affiliation & Background</span>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className={styles.formLabel}>Phone Number</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    placeholder="+20 100 123 4567"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className={styles.formLabel}>University / School</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Cairo University"
                    value={addForm.institution}
                    onChange={(e) => setAddForm({ ...addForm, institution: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className={styles.formLabel}>Academic Year / Grade</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Year 3 / Senior"
                    value={addForm.academicYear}
                    onChange={(e) => setAddForm({ ...addForm, academicYear: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={addLoading}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5"
                disabled={addLoading}
              >
                {addLoading && <i className="fa-solid fa-spinner fa-spin" />}
                <span>{addLoading ? 'Registering Cadet...' : 'Register Student'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
