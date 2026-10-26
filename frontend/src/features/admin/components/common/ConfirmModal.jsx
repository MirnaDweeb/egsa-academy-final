import Modal from './Modal';

export default function ConfirmModal({
  isOpen = true,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmTone = 'danger',
  loading = false,
  icon = 'fa-triangle-exclamation',
  // Support aliases used by components
  confirmLabel,
  confirmVariant,
  isLoading,
  onCancel,
  error,
}) {
  const actualClose = onCancel || onClose;
  const actualLoading = isLoading !== undefined ? isLoading : loading;
  const actualConfirmText = confirmLabel || confirmText;
  const actualTone = confirmVariant || confirmTone;

  const footer = (
    <>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={actualClose}
        disabled={actualLoading}
      >
        {cancelText}
      </button>
      <button
        type="button"
        className={`btn btn-${actualTone} btn-sm`}
        onClick={onConfirm}
        disabled={actualLoading}
      >
        {actualLoading ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            Processing...
          </>
        ) : (
          actualConfirmText
        )}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={actualClose} title={title} footer={footer} size="sm">
      {error && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          {error}
        </div>
      )}
      <div className="d-flex align-items-start gap-3">
        <div
          className={`rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0 bg-${actualTone}-subtle text-${actualTone}`}
          style={{ width: '42px', height: '42px' }}
        >
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        </div>
        <div className="text-secondary" style={{ fontSize: '0.95rem' }}>
          {message}
        </div>
      </div>
    </Modal>
  );
}
