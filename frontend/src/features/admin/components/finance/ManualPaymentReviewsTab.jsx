import { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/api/adminService';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import LoadingState from '../common/LoadingState';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import SearchBar from '../common/SearchBar';
import styles from './ManualPaymentReviewsTab.module.css';

export default function ManualPaymentReviewsTab({ canManageFinance = true }) {
  const [proofs, setProofs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // View Evidence Modal
  const [viewingProof, setViewingProof] = useState(null);
  const [imageBlobUrl, setImageBlobUrl] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');

  // Message Student Modal
  const [messagingProof, setMessagingProof] = useState(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState('');

  // Approve Modal
  const [approvingProof, setApprovingProof] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState('');

  // Reject Modal
  const [rejectingProof, setRejectingProof] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Securely load screenshot blob using authenticated API client
  useEffect(() => {
    let active = true;
    let objectUrl = '';

    if (viewingProof?._id) {
      setImageLoading(true);
      setImageError('');
      setImageBlobUrl('');

      adminService
        .fetchPaymentProofFileBlob(viewingProof._id)
        .then((blob) => {
          if (!active) return;
          if (!blob.type || !blob.type.startsWith('image/')) {
            throw new Error('Retrieved file is not a valid image format.');
          }
          objectUrl = URL.createObjectURL(blob);
          setImageBlobUrl(objectUrl);
        })
        .catch((err) => {
          if (!active) return;
          setImageError(err.response?.data?.message || err.message || 'Unable to load proof screenshot.');
        })
        .finally(() => {
          if (active) setImageLoading(false);
        });
    } else {
      setImageBlobUrl('');
      setImageError('');
      setImageLoading(false);
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [viewingProof]);

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = { page, limit: 15 };
      if (statusFilter && statusFilter !== 'ALL') q.status = statusFilter;
      if (methodFilter && methodFilter !== 'ALL') q.paymentMethod = methodFilter;
      if (search.trim()) q.search = search.trim();

      const res = await adminService.listPaymentProofs(q);
      setProofs(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load manual payment submissions.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, search]);

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const data = await adminService.getManualPaymentSettings();
      setSettings(data);
    } catch (err) {
      setSettingsError(err.message || 'Failed to load receiving payment settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
    fetchSettings();
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsError('');
    try {
      await adminService.updateManualPaymentSettings(settings);
      setSuccessMessage('Payment receiving settings updated successfully.');
      setShowSettingsModal(false);
    } catch (err) {
      setSettingsError(err.message || 'Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingProof) return;
    setApproveLoading(true);
    setApproveError('');
    try {
      await adminService.approvePaymentProof(approvingProof._id);
      setSuccessMessage(
        `Payment proof for ${approvingProof.student?.fullName || 'student'} approved. Enrollment confirmed successfully!`
      );
      setApprovingProof(null);
      await fetchProofs();
    } catch (err) {
      setApproveError(err.response?.data?.message || err.message || 'Failed to approve payment proof.');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingProof) return;
    if (!rejectionReason.trim()) {
      setRejectError('A valid rejection reason is required so the student can rectify their submission.');
      return;
    }
    setRejectLoading(true);
    setRejectError('');
    try {
      await adminService.rejectPaymentProof(rejectingProof._id, rejectionReason.trim());
      setSuccessMessage(
        `Payment proof for ${rejectingProof.student?.fullName || 'student'} rejected. Student has been notified.`
      );
      setRejectingProof(null);
      setRejectionReason('');
      await fetchProofs();
    } catch (err) {
      setRejectError(err.response?.data?.message || err.message || 'Failed to reject payment proof.');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleOpenMessage = (proof) => {
    setMessagingProof(proof);
    setMessageSubject(`Update regarding your ${proof.course?.title || 'course'} payment`);
    setMessageBody('');
    setMessageError('');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messagingProof || !messageBody.trim()) return;

    setMessageLoading(true);
    setMessageError('');
    try {
      await adminService.sendPaymentProofMessage(messagingProof._id, {
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setSuccessMessage(`Message successfully sent to ${messagingProof.student?.fullName || 'student'}.`);
      setMessagingProof(null);
      setMessageBody('');
      await fetchProofs();
    } catch (err) {
      setMessageError(err.response?.data?.message || err.message || 'Failed to send message to student.');
    } finally {
      setMessageLoading(false);
    }
  };

  const pendingCount = proofs.filter((p) => p.status === 'Pending').length;

  return (
    <div className={styles.container}>
      {/* HEADER & ACTIONS */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>
            <i className="fa-solid fa-receipt me-2 text-primary" aria-hidden="true"></i>
            Manual Payment Review Queue
          </h3>
          <p className={styles.subtitle}>
            Review and verify student payment receipts transferred via Vodafone Cash and InstaPay before activating official course enrollments.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {canManageFinance && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1.5"
              onClick={handleOpenSettings}
              id="btn-manual-payment-settings"
            >
              <i className="fa-solid fa-gear" aria-hidden="true"></i>
              <span>Receiving Accounts Config</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5"
            onClick={fetchProofs}
            disabled={loading}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`} aria-hidden="true"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4 shadow-sm" role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-circle-check fs-5 text-success"></i>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessMessage('')}
            aria-label="Close alert"
          ></button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchProofs} />}

      {/* FILTER CONTROLS */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by student name, email, reference number, or sender identifier…"
          />
        </div>
        <div className={styles.filtersGroup}>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="filter-proof-status" className="small text-muted fw-semibold">Status:</label>
            <select
              id="filter-proof-status"
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="d-flex align-items-center gap-2">
            <label htmlFor="filter-proof-method" className="small text-muted fw-semibold">Method:</label>
            <select
              id="filter-proof-method"
              className="form-select form-select-sm"
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="Vodafone_Cash">Vodafone Cash</option>
              <option value="InstaPay">InstaPay</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE / LIST */}
      {loading ? (
        <LoadingState label="Loading payment proof submissions…" />
      ) : proofs.length === 0 ? (
        <EmptyState
          icon="fa-file-invoice"
          title="No Payment Proofs Found"
          description={
            statusFilter === 'Pending'
              ? 'No pending manual payment submissions currently require administrative review.'
              : 'No payment proofs match your current filter and search criteria.'
          }
        />
      ) : (
        <div className="card border-0 shadow-sm overflow-hidden mb-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-uppercase">
                <tr>
                  <th>Student</th>
                  <th>Course / Cohort</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Sender Info</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="small">
                {proofs.map((proof) => (
                  <tr key={proof._id}>
                    <td>
                      <div className="fw-bold text-dark">{proof.student?.fullName || 'Student'}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>{proof.student?.email}</div>
                      {proof.student?.registrationNumber && (
                        <div className="badge bg-light text-secondary border mt-1" style={{ fontSize: '0.7rem' }}>
                          {proof.student.registrationNumber}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{proof.course?.title || 'Course'}</div>
                      {proof.cohort?.name && (
                        <div className="text-muted small">
                          <i className="fa-solid fa-people-group me-1 text-primary"></i>
                          {proof.cohort.name}
                        </div>
                      )}
                      {proof.invoice?.invoiceNumber && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Inv: {proof.invoice.invoiceNumber}
                        </span>
                      )}
                    </td>
                    <td>
                      {proof.paymentMethod === 'Vodafone_Cash' ? (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                          <i className="fa-solid fa-mobile-screen-button me-1"></i> Vodafone Cash
                        </span>
                      ) : (
                        <span className="badge bg-purple-subtle text-purple border border-purple-subtle px-2 py-1" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>
                          <i className="fa-solid fa-bolt me-1"></i> InstaPay
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="fw-bold text-dark">
                        {proof.amount?.toLocaleString()} {proof.currency || 'EGP'}
                      </div>
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{proof.senderIdentifier}</div>
                      {proof.transactionReference ? (
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Ref: {proof.transactionReference}
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>No Ref</span>
                      )}
                    </td>
                    <td>
                      <div className="text-dark">
                        {proof.submittedAt ? new Date(proof.submittedAt).toLocaleDateString() : '—'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {proof.submittedAt ? new Date(proof.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                      {proof.resubmissionCount > 0 && (
                        <span className="badge bg-info-subtle text-info p-1" style={{ fontSize: '0.65rem' }}>
                          Resubmitted x{proof.resubmissionCount}
                        </span>
                      )}
                    </td>
                    <td>
                      {proof.status === 'Pending' && (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">
                          <i className="fa-solid fa-clock me-1"></i> Pending Review
                        </span>
                      )}
                      {proof.status === 'Approved' && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                          <i className="fa-solid fa-circle-check me-1"></i> Approved
                        </span>
                      )}
                      {proof.status === 'Rejected' && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" title={proof.rejectionReason}>
                          <i className="fa-solid fa-circle-xmark me-1"></i> Rejected
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setViewingProof(proof)}
                          title="View submitted proof screenshot and audit trail"
                        >
                          <i className="fa-solid fa-eye me-1"></i> View Proof
                        </button>
                        {canManageFinance && proof.status === 'Pending' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline-success"
                              onClick={() => {
                                setApprovingProof(proof);
                                setApproveError('');
                              }}
                              title="Approve manual payment and activate enrollment"
                            >
                              <i className="fa-solid fa-check me-1"></i> Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => {
                                setRejectingProof(proof);
                                setRejectionReason('');
                                setRejectError('');
                              }}
                              title="Reject payment proof with mandatory reason"
                            >
                              <i className="fa-solid fa-xmark me-1"></i> Reject
                            </button>
                          </>
                        )}
                        {canManageFinance && (
                          <button
                            type="button"
                            className="btn btn-outline-info"
                            onClick={() => handleOpenMessage(proof)}
                            title="Send an official notification message to the student"
                          >
                            <i className="fa-solid fa-envelope me-1"></i> Message
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {pagination.totalPages > 1 && (
            <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2 px-3 small">
              <span className="text-muted">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} submissions
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW EVIDENCE & AUDIT MODAL */}
      {viewingProof && (
        <Modal
          isOpen={!!viewingProof}
          title={`Payment Evidence: ${viewingProof.student?.fullName || 'Student'}`}
          onClose={() => setViewingProof(null)}
          size="lg"
        >
          <div className="row g-4">
            <div className="col-md-7 text-center">
              <div className="p-2 border rounded bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: '380px' }}>
                {imageLoading ? (
                  <div className="text-white text-center py-5">
                    <div className="spinner-border text-primary mb-2" role="status"></div>
                    <div className="small">Loading secure proof image…</div>
                  </div>
                ) : imageError ? (
                  <div className="text-white text-center p-4">
                    <i className="fa-solid fa-triangle-exclamation text-warning fs-3 mb-2 d-block"></i>
                    <p className="small text-danger mb-0">{imageError}</p>
                  </div>
                ) : (
                  <img
                    src={imageBlobUrl}
                    alt="Proof Screenshot"
                    className="img-fluid rounded"
                    style={{ maxHeight: '420px', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      setImageError('Unable to display screenshot. File may be corrupted or inaccessible.');
                    }}
                  />
                )}
              </div>
              <div className="mt-2 d-flex justify-content-center gap-2">
                {imageBlobUrl && (
                  <a
                    href={imageBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> Open Full Image
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info"
                  onClick={() => {
                    const p = viewingProof;
                    setViewingProof(null);
                    handleOpenMessage(p);
                  }}
                >
                  <i className="fa-solid fa-envelope me-1"></i> Message Student
                </button>
              </div>
            </div>

            <div className="col-md-5">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Submission Details</h6>
              <ul className="list-unstyled small text-muted mb-3 d-flex flex-column gap-2">
                <li>
                  <span className="fw-semibold text-dark d-block">Course:</span>
                  {viewingProof.course?.title}
                </li>
                <li>
                  <span className="fw-semibold text-dark d-block">Amount:</span>
                  <span className="fs-6 fw-bold text-primary">
                    {viewingProof.amount?.toLocaleString()} {viewingProof.currency || 'EGP'}
                  </span>
                </li>
                <li>
                  <span className="fw-semibold text-dark d-block">Method:</span>
                  {viewingProof.paymentMethod?.replace('_', ' ')}
                </li>
                <li>
                  <span className="fw-semibold text-dark d-block">Sender Identifier:</span>
                  <code className="text-dark bg-light px-1 rounded">{viewingProof.senderIdentifier}</code>
                </li>
                {viewingProof.transactionReference && (
                  <li>
                    <span className="fw-semibold text-dark d-block">Transaction Reference:</span>
                    <code className="text-dark bg-light px-1 rounded">{viewingProof.transactionReference}</code>
                  </li>
                )}
                <li>
                  <span className="fw-semibold text-dark d-block">Submitted Date:</span>
                  {viewingProof.submittedAt ? new Date(viewingProof.submittedAt).toLocaleString() : '—'}
                </li>
                <li>
                  <span className="fw-semibold text-dark d-block">Current Status:</span>
                  <StatusBadge status={viewingProof.status} />
                </li>
                {viewingProof.rejectionReason && (
                  <li className="p-2 bg-danger-subtle text-danger rounded border border-danger-subtle">
                    <span className="fw-bold d-block">Rejection Reason:</span>
                    {viewingProof.rejectionReason}
                  </li>
                )}
              </ul>

              {/* AUDIT TRAIL */}
              {Array.isArray(viewingProof.auditTrail) && viewingProof.auditTrail.length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <h6 className="fw-bold text-dark small mb-2">Audit History</h6>
                  <div className="d-flex flex-column gap-1.5" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                    {viewingProof.auditTrail.map((item, idx) => (
                      <div key={idx} className="p-1.5 bg-light rounded text-muted" style={{ fontSize: '0.75rem' }}>
                        <div className="d-flex justify-content-between">
                          <strong className="text-dark">{item.action}</strong>
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                        {item.note && <div className="text-secondary">{item.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canManageFinance && viewingProof.status === 'Pending' && (
                <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => {
                      const p = viewingProof;
                      setViewingProof(null);
                      setRejectingProof(p);
                      setRejectionReason('');
                      setRejectError('');
                    }}
                  >
                    <i className="fa-solid fa-xmark me-1"></i> Reject Proof
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      const p = viewingProof;
                      setViewingProof(null);
                      setApprovingProof(p);
                      setApproveError('');
                    }}
                  >
                    <i className="fa-solid fa-check me-1"></i> Approve Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      {approvingProof && (
        <ConfirmModal
          isOpen={!!approvingProof}
          title="Approve Manual Payment & Confirm Enrollment"
          message={`Are you sure you want to approve the ${approvingProof.paymentMethod?.replace('_', ' ')} payment of ${approvingProof.amount} EGP for ${approvingProof.student?.fullName || 'this student'}? This will officially settle the invoice and activate course enrollment.`}
          confirmText={approveLoading ? 'Approving…' : 'Confirm & Activate Enrollment'}
          confirmTone="success"
          loading={approveLoading}
          error={approveError}
          onConfirm={handleConfirmApprove}
          onClose={() => {
            setApprovingProof(null);
            setApproveError('');
          }}
        />
      )}

      {/* REJECT MODAL WITH MANDATORY REASON */}
      {rejectingProof && (
        <Modal
          isOpen={!!rejectingProof}
          title={`Reject Payment Proof: ${rejectingProof.student?.fullName || 'Student'}`}
          onClose={() => {
            setRejectingProof(null);
            setRejectError('');
            setRejectionReason('');
          }}
        >
          <form onSubmit={handleConfirmReject}>
            {rejectError && <div className="alert alert-danger small p-2 mb-3">{rejectError}</div>}
            <div className="mb-3">
              <p className="small text-muted mb-2">
                Rejecting this proof will notify the student and leave the invoice in a pending/resubmission state. No enrollment will be created.
              </p>
              <label htmlFor="rejection-reason-input" className="form-label fw-bold small text-dark">
                Reason for Rejection <span className="text-danger">*</span>
              </label>
              <textarea
                id="rejection-reason-input"
                className="form-control"
                rows={3}
                placeholder="Explain clearly why this payment proof was declined (e.g. transfer amount does not match invoice, receipt is unreadable, incorrect receiving account)…"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setRejectingProof(null)}
                disabled={rejectLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger btn-sm"
                disabled={rejectLoading || !rejectionReason.trim()}
              >
                {rejectLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Rejecting…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-xmark me-1"></i> Decline Proof
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MESSAGE STUDENT MODAL */}
      {messagingProof && (
        <Modal
          isOpen={!!messagingProof}
          title={`Message Student: ${messagingProof.student?.fullName || 'Student'}`}
          onClose={() => setMessagingProof(null)}
        >
          <form onSubmit={handleSendMessage}>
            {messageError && <div className="alert alert-danger small p-2 mb-3">{messageError}</div>}
            <div className="mb-3">
              <label htmlFor="msg-student-subject" className="form-label small fw-bold text-dark">Subject</label>
              <input
                id="msg-student-subject"
                type="text"
                className="form-control form-control-sm"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="msg-student-body" className="form-label small fw-bold text-dark">
                Message Content <span className="text-danger">*</span>
              </label>
              <textarea
                id="msg-student-body"
                className="form-control"
                rows={4}
                placeholder="Type your message to the student regarding their payment proof…"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                required
                autoFocus
              />
              <div className="form-text small text-muted">
                This message will be recorded in the payment audit history and immediately delivered to the student's notification center.
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setMessagingProof(null)}
                disabled={messageLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={messageLoading || !messageBody.trim()}
              >
                {messageLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Sending…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane me-1"></i> Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECEIVING SETTINGS CONFIG MODAL */}
      {showSettingsModal && (
        <Modal
          isOpen={showSettingsModal}
          title="Manual Payment Receiving Accounts Configuration"
          onClose={() => setShowSettingsModal(false)}
          size="lg"
        >
          {settingsLoading ? (
            <LoadingState label="Loading payment configuration…" />
          ) : settings ? (
            <form onSubmit={handleSaveSettings}>
              {settingsError && <div className="alert alert-danger small p-2 mb-3">{settingsError}</div>}

              {/* Vodafone Cash Settings */}
              <div className="card p-3 mb-3 bg-light border">
                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                  <i className="fa-solid fa-mobile-screen-button text-danger"></i>
                  Vodafone Cash Wallet Configuration
                </h6>
                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Receiving Wallet Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settings.vodafoneCash?.walletNumber || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          vodafoneCash: { ...prev.vodafoneCash, walletNumber: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Account Beneficiary Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settings.vodafoneCash?.accountName || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          vodafoneCash: { ...prev.vodafoneCash, accountName: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-dark">English Instructions for Student</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={2}
                    value={settings.vodafoneCash?.instructionsEn || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        vodafoneCash: { ...prev.vodafoneCash, instructionsEn: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              {/* InstaPay Settings */}
              <div className="card p-3 mb-3 bg-light border">
                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3" style={{ color: '#7e22ce' }}>
                  <i className="fa-solid fa-bolt"></i>
                  InstaPay Account Configuration
                </h6>
                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">InstaPay Address (IPA)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settings.instaPay?.ipaAddress || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          instaPay: { ...prev.instaPay, ipaAddress: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Beneficiary Account Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settings.instaPay?.accountName || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          instaPay: { ...prev.instaPay, accountName: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-dark">Bank Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={settings.instaPay?.bankName || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        instaPay: { ...prev.instaPay, bankName: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowSettingsModal(false)}
                  disabled={settingsSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={settingsSaving}>
                  {settingsSaving ? 'Saving…' : 'Save Receiving Settings'}
                </button>
              </div>
            </form>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
