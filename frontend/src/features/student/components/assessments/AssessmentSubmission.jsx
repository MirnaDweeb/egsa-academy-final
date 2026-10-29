import React, { useState, useRef } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import { assessmentService } from '../../services/cycleServices';

export default function AssessmentSubmission({
  assessment,
  onSuccess,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';
  const fileInputRef = useRef(null);

  const submissionType = assessment.submissionType || 'file'; // 'file' | 'text' | 'both'
  const allowLate = Boolean(assessment.allowLateSubmission);
  const isDeadlinePassed = Boolean(assessment.isDeadlinePassed);

  const [selectedFile, setSelectedFile] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Determine if student is blocked by deadline
  const isBlockedByDeadline = isDeadlinePassed && !allowLate;

  // Prohibited extensions
  const FORBIDDEN_EXTS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.bin', '.js', '.vbs', '.php', '.jar'];

  const validateFile = (file) => {
    if (!file) return null;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (FORBIDDEN_EXTS.includes(ext)) {
      return t.invalidFileTypeError;
    }
    if (file.size > 25 * 1024 * 1024) {
      return t.fileTooLargeError;
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setClientError('');
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setClientError(error);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setClientError('');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setClientError(error);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const validateBeforePrompt = () => {
    setClientError('');

    if (isBlockedByDeadline) {
      setClientError(t.closedDeadlineNotice);
      return false;
    }

    if (submissionType === 'file' && !selectedFile) {
      setClientError(t.fileRequiredError);
      return false;
    }

    if (submissionType === 'text' && !textAnswer.trim()) {
      setClientError(t.textRequiredError);
      return false;
    }

    if (submissionType === 'both' && !selectedFile && !textAnswer.trim()) {
      setClientError(t.bothRequiredError);
      return false;
    }

    return true;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (validateBeforePrompt()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setClientError('');

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (textAnswer.trim()) {
        formData.append('textAnswer', textAnswer.trim());
      }

      const res = await assessmentService.submit(assessment.id || assessment._id, formData);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      setClientError(
        err.response?.data?.message || err.message || (isAr ? 'فشل تسليم التكليف. يرجى المحاولة مرة أخرى.' : 'Failed to submit assignment. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If blocked by deadline and late submissions disallowed
  if (isBlockedByDeadline) {
    return (
      <div className="alert alert-danger p-4 rounded-3 border-0 shadow-sm d-flex flex-column gap-2 mb-0">
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-lock fa-lg text-danger"></i>
          <h6 className="fw-bold text-dark mb-0">{t.deadlinePassed}</h6>
        </div>
        <p className="small text-secondary mb-0">
          {t.closedDeadlineNotice}
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleOpenConfirm} className="d-flex flex-column gap-3">
        {/* Late Submission Notice if deadline passed and late allowed */}
        {isDeadlinePassed && allowLate && (
          <div className="alert alert-warning p-3 rounded-3 border-0 d-flex align-items-start gap-2 mb-0">
            <i className="fa-solid fa-triangle-exclamation text-warning mt-1"></i>
            <div>
              <span className="badge bg-danger text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                {t.lateSubmission}
              </span>
              <p className="small text-dark mb-0">
                {t.lateNotice}
              </p>
            </div>
          </div>
        )}

        {clientError && (
          <div className="alert alert-danger p-3 rounded-3 border-0 small d-flex align-items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-danger"></i>
            <span>{clientError}</span>
          </div>
        )}

        {/* 1. File Upload Area (if submissionType is 'file' or 'both') */}
        {(submissionType === 'file' || submissionType === 'both') && (
          <div className="d-flex flex-column gap-2">
            <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-0">
              <span>
                <i className="fa-solid fa-cloud-arrow-up text-primary me-2"></i>
                {t.uploadCompleted}
              </span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                {submissionType === 'file' ? t.required : t.optional}
              </span>
            </label>

            {!selectedFile ? (
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="d-none"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.tar,.gz,.csv,.txt,.jpg,.jpeg,.png,.webp"
                />
                <i className="fa-solid fa-cloud-arrow-up fa-2x text-primary mb-2 d-block"></i>
                <strong className="text-dark d-block small mb-1">{t.clickToUpload}</strong>
                <span className="text-muted d-block small mb-2" style={{ fontSize: '0.75rem' }}>
                  {t.allowedFormatsText} (Max: 25MB)
                </span>
                <div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-pill px-3 fw-semibold shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <i className="fa-solid fa-folder-open me-1.5"></i>
                    {isAr ? 'اختيار ملف من جهازك' : 'Choose File'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.selectedFileInfo}>
                <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                  <i className="fa-solid fa-file-circle-check fa-lg text-primary flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <strong className="d-block text-truncate small text-dark">{selectedFile.name}</strong>
                    <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for submission
                    </span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-1 px-2 flex-shrink-0"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Replace file"
                  >
                    <i className="fa-solid fa-arrow-rotate-right me-1"></i>
                    {isAr ? 'استبدال' : 'Replace File'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger py-1 px-2 flex-shrink-0"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    title="Remove file"
                  >
                    <i className="fa-solid fa-trash me-1"></i> {t.removeFile}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Text Answer Area (if submissionType is 'text' or 'both') */}
        {(submissionType === 'text' || submissionType === 'both') && (
          <div className="d-flex flex-column gap-2">
            <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-0">
              <span>
                <i className="fa-solid fa-pen-to-square text-primary me-2"></i>
                {t.yourAnswer}
              </span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                {submissionType === 'text' ? t.required : t.optional}
              </span>
            </label>

            <textarea
              className="form-control"
              rows="5"
              placeholder={t.answerPlaceholder}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              style={{ fontSize: '0.9rem', lineHeight: '1.55' }}
            ></textarea>
          </div>
        )}

        {/* Submit Action Button */}
        <div className="d-flex justify-content-end mt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary fw-semibold px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm rounded-pill"
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span>{t.submitting}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i>
                <span>{t.submitAssessment}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(6px)', zIndex: 1080 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-dark overflow-hidden" style={{ borderRadius: '16px' }}>
              <div className="p-3 text-white d-flex align-items-center justify-content-between" style={{ background: 'linear-gradient(135deg, #0b1a3d 0%, #050c1c 100%)' }}>
                <h6 className="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="fa-solid fa-circle-question text-info"></i>
                  {isAr ? 'تأكيد تسليم التكليف الأكاديمي' : 'Confirm Assignment Submission'}
                </h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light rounded-circle"
                  onClick={() => setShowConfirmModal(false)}
                  style={{ width: '28px', height: '28px' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body p-4 bg-light">
                <p className="text-dark small mb-3">
                  {isAr
                    ? 'هل أنت متأكد من رغبتك في تسليم هذا التكليف الآن؟ سيتم إرسال الملف والملاحظات مباشرة إلى عضو هيئة التدريس المختص لتقييم عملك.'
                    : 'Are you sure you want to submit your assignment now? Your work will be delivered directly to your course instructor for evaluation.'}
                </p>

                <div className="bg-white p-3 rounded-3 border small d-flex flex-column gap-2 mb-0">
                  <div>
                    <span className="text-muted">{isAr ? 'التكليف:' : 'Assignment:'} </span>
                    <strong className="text-dark">{assessment.title}</strong>
                  </div>
                  {selectedFile && (
                    <div>
                      <span className="text-muted">{isAr ? 'الملف المرفق:' : 'Attached File:'} </span>
                      <strong className="text-primary">{selectedFile.name}</strong>{' '}
                      <span className="text-muted">({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  )}
                  {textAnswer.trim() && (
                    <div>
                      <span className="text-muted">{isAr ? 'الإجابة المكتوبة:' : 'Written Answer:'} </span>
                      <span className="text-dark">{textAnswer.trim().slice(0, 80)}{textAnswer.trim().length > 80 ? '…' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-pill px-4 fw-semibold shadow-sm d-inline-flex align-items-center gap-1.5"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>{isAr ? 'تأكيد وإرسال التكليف' : 'Confirm & Submit Deliverable'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
