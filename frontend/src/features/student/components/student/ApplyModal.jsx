import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';

export default function ApplyModal({
  isOpen,
  course,
  onClose,
  onSuccess,
}) {
  const navigate = useNavigate();

  const [selectedPackage, setSelectedPackage] = useState('WITHOUT_TRANSPORTATION');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);

  const isPriced = course?.price != null;
  const isDirectPermitted = isPriced && course?.directEnrollmentPermitted !== false;

  useEffect(() => {
    if (isOpen) {
      setSelectedPackage('WITHOUT_TRANSPORTATION');
      setNotes('');
      setError(null);
      setErrorType(null);
    }
  }, [isOpen, course]);

  if (!isOpen || !course) return null;

  const basePrice = Number(course.price != null ? course.price : 0);
  const transPrice = Number(course.transportationPrice != null ? course.transportationPrice : 500);
  const totalAmount = selectedPackage === 'WITH_TRANSPORTATION' ? basePrice + transPrice : basePrice;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrorType(null);

    try {
      const res = await applicationService.create({
        courseId: course._id,
        directEnroll: isDirectPermitted,
        selectedPackage,
        notes: notes.trim() || undefined,
        statementOfInterest: notes.trim() || undefined,
      });

      const app = res.data;
      const invId = res.invoice?._id || app?.invoice?._id || '';

      if (onSuccess) {
        onSuccess(app, res.invoice);
      }

      onClose();

      // Navigation based on outcome
      if (app.status === 'Waitlisted') {
        navigate(`/student/applications/${app._id}?waitlisted=true`);
      } else if (invId) {
        navigate(`/student/payments?invoiceId=${invId}&applicationId=${app._id}`);
      } else {
        navigate(`/student/applications/${app._id}`);
      }
    } catch (err) {
      console.error('Application submission error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit application.';
      setError(msg);

      if (/profile/i.test(msg)) {
        setErrorType('PROFILE');
      } else if (/prerequisite|foundation/i.test(msg)) {
        setErrorType('PREREQUISITE');
      } else {
        setErrorType('GENERAL');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }}
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
          {/* Header */}
          <div className="modal-header bg-gradient bg-primary text-white p-3 p-md-4 position-relative">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <span className="badge bg-white text-primary fw-bold">{course.level || 'Program'}</span>
                <span className="badge bg-white-subtle text-white border border-white-50">
                  <i className="fa-solid fa-location-dot me-1"></i>
                  {course.deliveryMode || 'Onsite'}
                </span>
                {course.category && (
                  <span className="badge bg-black-subtle text-white">{course.category}</span>
                )}
              </div>
              <h5 className="modal-title fw-bold text-white mb-0">{course.title}</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-3 p-md-4" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Error Banner */}
              {error && (
                <div className="alert alert-danger d-flex align-items-start gap-2 shadow-sm mb-3" role="alert">
                  <i className="fa-solid fa-circle-exclamation mt-1 fs-5"></i>
                  <div className="flex-grow-1">
                    <strong className="d-block">Submission Error</strong>
                    <span className="small">{error}</span>
                    {errorType === 'PROFILE' && (
                      <div className="mt-2">
                        <Link to="/student/profile" className="btn btn-sm btn-outline-danger bg-white">
                          <i className="fa-solid fa-user-pen me-1"></i> Complete Student Profile
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Course Prerequisites Notice */}
              {course.mandatoryPrerequisites?.length > 0 && (
                <div className="alert alert-warning border-warning-subtle d-flex align-items-start gap-2 small mb-3">
                  <i className="fa-solid fa-graduation-cap text-warning fs-5 mt-1"></i>
                  <div>
                    <strong className="d-block text-dark">Prerequisite Review Notice</strong>
                    <span>
                      This course has foundational requirements. Your background will be validated to ensure prerequisite alignment.
                    </span>
                  </div>
                </div>
              )}

              {/* Tuition & Package Options (Primary Step) */}
              {isPriced ? (
                <div className="mb-4">
                  <label className="form-label fw-bold text-dark small text-uppercase tracking-wider">
                    Tuition & Transportation Package
                  </label>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div
                        className={`p-3 border rounded-3 h-100 cursor-pointer ${
                          selectedPackage === 'WITHOUT_TRANSPORTATION' ? 'border-primary bg-primary-subtle shadow-sm' : ''
                        }`}
                        onClick={() => setSelectedPackage('WITHOUT_TRANSPORTATION')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="packageSelection"
                            id="pkgStandard"
                            checked={selectedPackage === 'WITHOUT_TRANSPORTATION'}
                            onChange={() => setSelectedPackage('WITHOUT_TRANSPORTATION')}
                          />
                          <label className="form-check-label fw-semibold text-dark ms-1" htmlFor="pkgStandard">
                            Standard Tuition
                          </label>
                        </div>
                        <div className="h5 fw-bold text-primary mt-2 mb-0 ps-4">
                          {basePrice.toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted ps-4 d-block">Campus self-transportation</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div
                        className={`p-3 border rounded-3 h-100 cursor-pointer ${
                          selectedPackage === 'WITH_TRANSPORTATION' ? 'border-primary bg-primary-subtle shadow-sm' : ''
                        }`}
                        onClick={() => setSelectedPackage('WITH_TRANSPORTATION')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="packageSelection"
                            id="pkgTrans"
                            checked={selectedPackage === 'WITH_TRANSPORTATION'}
                            onChange={() => setSelectedPackage('WITH_TRANSPORTATION')}
                          />
                          <label className="form-check-label fw-semibold text-dark ms-1" htmlFor="pkgTrans">
                            Tuition + Daily Transport
                          </label>
                        </div>
                        <div className="h5 fw-bold text-primary mt-2 mb-0 ps-4">
                          {(basePrice + transPrice).toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted ps-4 d-block">
                          Includes EGSA daily shuttle service (+{transPrice} EGP)
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 border rounded-3 bg-light-subtle">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong className="text-dark d-block">Tuition Status</strong>
                      <span className="text-muted small">Pricing published upon official schedule publication</span>
                    </div>
                    <span className="badge bg-secondary-subtle text-secondary px-3 py-2 fw-semibold">
                      Pricing TBA
                    </span>
                  </div>
                </div>
              )}

              {/* Statement of Interest & Notes */}
              <div className="mb-3">
                <label htmlFor="appNotes" className="form-label fw-bold text-dark small text-uppercase tracking-wider">
                  Notes & Special Requests <span className="text-muted fw-normal">(Optional)</span>
                </label>
                <textarea
                  id="appNotes"
                  className="form-control"
                  rows="3"
                  placeholder="Share any special requirements, relevant experience, or notes for your enrollment…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                ></textarea>
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <small className="text-muted">Direct enrollment reserves your seat immediately.</small>
                  <small className="text-muted">{notes.length}/1000</small>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer bg-light p-3 d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-outline-secondary px-3"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary px-4 fw-bold shadow-sm"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Processing…
                  </>
                ) : isPriced ? (
                  <>
                    <i className="fa-solid fa-credit-card me-2"></i>
                    Confirm & Pay ({totalAmount.toLocaleString()} {course.currency || 'EGP'})
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane me-2"></i>
                    Confirm Enrollment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
