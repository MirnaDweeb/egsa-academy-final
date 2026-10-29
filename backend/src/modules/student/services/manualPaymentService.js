const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Cohort = require('../models/Cohort');
const PaymentProof = require('../models/PaymentProof');
const PaymentSettings = require('../models/PaymentSettings');
const Invoice = require('../models/Invoice');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const PaymentTransaction = require('../models/PaymentTransaction');
const { notify } = require('./notificationService');
const { AppError } = require('../middleware/error');
const { validateImageMagicBytes } = require('../middleware/paymentProofUpload');

/**
 * Returns safe receiving payment settings for students and public display.
 * Never leaks administrative metadata or internal system details.
 */
async function getManualPaymentSettings() {
  const settings = await PaymentSettings.getSettings();
  return {
    vodafoneCash: {
      walletNumber: settings.vodafoneCash?.walletNumber || '01012345678',
      accountName: settings.vodafoneCash?.accountName || 'Egyptian Space Agency — National Training Fund',
      instructionsEn: settings.vodafoneCash?.instructionsEn,
      instructionsAr: settings.vodafoneCash?.instructionsAr,
      isActive: settings.vodafoneCash?.isActive !== false,
    },
    instaPay: {
      ipaAddress: settings.instaPay?.ipaAddress || 'egsa.academy@instapay',
      accountName: settings.instaPay?.accountName || 'Egyptian Space Agency',
      bankName: settings.instaPay?.bankName || 'National Bank of Egypt (NBE)',
      instructionsEn: settings.instaPay?.instructionsEn,
      instructionsAr: settings.instaPay?.instructionsAr,
      isActive: settings.instaPay?.isActive !== false,
    },
    uploadLimits: {
      maxFileSizeMB: settings.uploadLimits?.maxFileSizeMB || 5,
      allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    },
    disclaimer: {
      en: 'Uploading proof of payment does not constitute a completed payment or grant automatic course access. Your submission will be verified by EGSA administration before enrollment is activated.',
      ar: 'رفع إيصال السداد لا يُعد تأكيداً نهائياً للدفع ولا يمنح وصولاً فورياً للمقرر. تخضع جميع التحويلات لمراجعة وتدقيق الإدارة المالية قبل تفعيل الالتحاق الرسمي.',
    },
  };
}

/**
 * Administrative update of receiving payment settings.
 */
async function updateManualPaymentSettings(payload, adminUser) {
  const settings = await PaymentSettings.getSettings();

  if (payload.vodafoneCash) {
    settings.vodafoneCash = {
      ...settings.vodafoneCash.toObject(),
      ...payload.vodafoneCash,
    };
  }
  if (payload.instaPay) {
    settings.instaPay = {
      ...settings.instaPay.toObject(),
      ...payload.instaPay,
    };
  }
  if (payload.uploadLimits?.maxFileSizeMB) {
    settings.uploadLimits.maxFileSizeMB = payload.uploadLimits.maxFileSizeMB;
  }
  settings.updatedBy = adminUser._id;
  await settings.save();

  return getManualPaymentSettings();
}

/**
 * Student submits manual payment proof for an issued invoice.
 */
async function submitPaymentProof({
  invoiceId,
  studentId,
  paymentMethod,
  senderIdentifier,
  transactionReference,
  file,
}) {
  if (!file) {
    throw new AppError('Payment proof screenshot or receipt file is required.', 400);
  }

  // Verify genuine image file signature (magic bytes)
  const isGenuineImage = validateImageMagicBytes(file.path);
  if (!isGenuineImage) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('Uploaded file is corrupted or not a valid image. Please upload an authentic JPEG, PNG, or WEBP.', 400);
  }

  if (!['Vodafone_Cash', 'InstaPay'].includes(paymentMethod)) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('Invalid payment method. Supported methods are Vodafone_Cash and InstaPay.', 400);
  }

  if (!senderIdentifier || !senderIdentifier.trim()) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('Sender wallet number or InstaPay account handle is required for reconciliation.', 400);
  }

  // Load and validate invoice
  const invoice = await Invoice.findById(invoiceId)
    .populate('course')
    .populate('application');

  if (!invoice) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('Invoice not found.', 404);
  }

  // Strict ownership check
  if (invoice.student.toString() !== studentId.toString()) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('Forbidden: you cannot submit payment proof for another student’s invoice.', 403);
  }

  // Invoice must be in payable status
  if (['Paid', 'PAID'].includes(invoice.status)) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError('This invoice has already been fully paid and confirmed.', 400);
  }

  if (['Cancelled', 'Expired', 'Overdue', 'Waived'].includes(invoice.status)) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    throw new AppError(`Cannot submit proof for an invoice in "${invoice.status}" status.`, 400);
  }

  // Calculate authoritative payable amount directly from invoice/course
  const payableAmount = Number(invoice.amount) || Number(invoice.baseAmount) || Number(invoice.course?.price) || 0;

  // Check if a prior submission exists for this invoice
  let existingProof = await PaymentProof.findOne({ invoice: invoice._id }).sort({ createdAt: -1 });

  let proofRecord;
  if (existingProof) {
    // If previous proof was already Approved, block further submission
    if (existingProof.status === 'Approved') {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new AppError('Payment for this invoice has already been approved and settled.', 400);
    }

    // Replacement/resubmission (e.g. after Rejection or updating before review)
    const oldPath = existingProof.proofFile?.path;
    const isResubmission = existingProof.status === 'Rejected';

    existingProof.paymentMethod = paymentMethod;
    existingProof.amount = payableAmount;
    existingProof.senderIdentifier = senderIdentifier.trim();
    existingProof.transactionReference = (transactionReference || '').trim();
    existingProof.proofFile = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      storageType: 'private_disk',
    };
    existingProof.status = 'Pending';
    existingProof.rejectionReason = undefined;
    existingProof.reviewedBy = undefined;
    existingProof.reviewedAt = undefined;
    existingProof.submittedAt = new Date();
    if (isResubmission) {
      existingProof.resubmissionCount = (existingProof.resubmissionCount || 0) + 1;
    }

    existingProof.auditTrail.push({
      action: isResubmission ? 'RESUBMITTED' : 'UPDATED',
      actor: studentId,
      actorRole: 'student',
      status: 'Pending',
      note: isResubmission ? 'Student resubmitted proof following previous rejection.' : 'Student updated proof file before review.',
      timestamp: new Date(),
    });

    proofRecord = await existingProof.save();

    // Clean up replaced file if path changed
    if (oldPath && oldPath !== file.path && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (_) {}
    }
  } else {
    // Create new proof submission record
    proofRecord = await PaymentProof.create({
      student: studentId,
      application: invoice.application?._id || invoice.application,
      course: invoice.course?._id || invoice.course,
      cohort: invoice.cohort,
      invoice: invoice._id,
      paymentMethod,
      amount: payableAmount,
      currency: invoice.currency || 'EGP',
      senderIdentifier: senderIdentifier.trim(),
      transactionReference: (transactionReference || '').trim(),
      proofFile: {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        storageType: 'private_disk',
      },
      status: 'Pending',
      submittedAt: new Date(),
      auditTrail: [
        {
          action: 'SUBMITTED',
          actor: studentId,
          actorRole: 'student',
          status: 'Pending',
          note: `Payment proof uploaded via ${paymentMethod}.`,
          timestamp: new Date(),
        },
      ],
    });
  }

  // Keep invoice in Pending status for admin review (Do NOT mark Paid!)
  if (invoice.status === 'Invoice Issued' || invoice.status === 'Payment Initiated') {
    invoice.status = 'Pending';
    await invoice.save();
  }

  return proofRecord;
}

/**
 * Returns all payment proofs for the authenticated student.
 */
async function getStudentPaymentProofs(studentId) {
  return PaymentProof.find({ student: studentId })
    .populate('course', 'title price currency level')
    .populate('invoice', 'invoiceNumber amount dueDate status')
    .populate('application', 'referenceNumber status')
    .sort({ submittedAt: -1 });
}

/**
 * Authorized file access: allows student owner or authorized admins to view proof file.
 */
async function getPaymentProofFilePath({ proofId, user }) {
  const proof = await PaymentProof.findById(proofId);
  if (!proof) {
    throw new AppError('Payment proof not found.', 404);
  }

  const isOwner = user && proof.student.toString() === user._id.toString();
  const isAdmin = user && ['admin', 'superadmin'].includes(user.role);

  if (!isOwner && !isAdmin) {
    throw new AppError('Forbidden: you do not have permission to view this payment proof.', 403);
  }

  const filePath = proof.proofFile?.path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new AppError('Evidence file not found on storage.', 404);
  }

  // Path confinement enforcement: ensure file resides inside privateProofDir
  const resolvedBase = path.resolve(__dirname, '../../../../data/uploads/private_proofs');
  const resolvedTarget = path.resolve(filePath);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new AppError('Forbidden: invalid storage path confinement.', 403);
  }

  return {
    filePath,
    mimetype: proof.proofFile.mimetype || 'image/jpeg',
    filename: proof.proofFile.originalName || proof.proofFile.filename,
  };
}

/**
 * Admin: list payment proofs with filtering, pagination, and search.
 */
async function adminListPaymentProofs(query = {}) {
  const { status, paymentMethod, courseId, search, page = 1, limit = 20 } = query;

  const filter = {};
  if (status && status !== 'ALL') {
    filter.status = status;
  }
  if (paymentMethod && paymentMethod !== 'ALL') {
    filter.paymentMethod = paymentMethod;
  }
  if (courseId) {
    filter.course = courseId;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));

  let proofQuery = PaymentProof.find(filter)
    .populate('student', 'fullName email phone registrationNumber')
    .populate('course', 'title code price currency level')
    .populate('cohort', 'name startDate endDate')
    .populate('invoice', 'invoiceNumber amount status dueDate')
    .populate('application', 'referenceNumber status selectedPackage')
    .populate('reviewedBy', 'fullName email')
    .sort({ submittedAt: -1 });

  const total = await PaymentProof.countDocuments(filter);
  let proofs = await proofQuery.skip(skip).limit(pageSize);

  // In-memory search filter if keyword provided
  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    proofs = proofs.filter((p) => {
      const studentName = p.student?.fullName?.toLowerCase() || '';
      const studentEmail = p.student?.email?.toLowerCase() || '';
      const courseTitle = p.course?.title?.toLowerCase() || '';
      const ref = p.transactionReference?.toLowerCase() || '';
      const sender = p.senderIdentifier?.toLowerCase() || '';
      const invNum = p.invoice?.invoiceNumber?.toLowerCase() || '';
      return (
        studentName.includes(term) ||
        studentEmail.includes(term) ||
        courseTitle.includes(term) ||
        ref.includes(term) ||
        sender.includes(term) ||
        invNum.includes(term)
      );
    });
  }

  return {
    proofs,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/**
 * Admin: get single payment proof audit detail.
 */
async function adminGetPaymentProof(id) {
  const proof = await PaymentProof.findById(id)
    .populate('student', 'fullName email phone registrationNumber')
    .populate('course', 'title code price currency level')
    .populate('cohort', 'name startDate endDate')
    .populate('invoice', 'invoiceNumber amount baseAmount transportationAmount status dueDate')
    .populate('application', 'referenceNumber status selectedPackage')
    .populate('reviewedBy', 'fullName email')
    .populate('auditTrail.actor', 'fullName email');

  if (!proof) {
    throw new AppError('Payment proof not found.', 404);
  }

  return proof;
}

/**
 * Admin: Approve payment proof.
 * Atomic and idempotent:
 * 1. Confirms the submission is in 'Pending' state.
 * 2. If already approved, returns existing state safely (idempotent).
 * 3. Conditional update marks status 'Approved'.
 * 4. Settles Invoice to 'Paid'.
 * 5. Creates immutable PaymentTransaction.
 * 6. Finalizes Application to 'Confirmed'.
 * 7. Activates single Enrollment via unique upsert.
 * 8. Triggers student notification.
 */
async function adminApprovePaymentProof({ proofId, adminUser }) {
  // 1. Check current submission status
  const existing = await PaymentProof.findById(proofId)
    .populate('student')
    .populate('course')
    .populate('invoice')
    .populate('application');

  if (!existing) {
    throw new AppError('Payment proof not found.', 404);
  }

  // 1b. Idempotency & Downstream Verification:
  // If already marked Approved, verify all downstream records exist. Reconcile any missing records.
  if (existing.status === 'Approved') {
    let inv = await Invoice.findById(existing.invoice);
    if (inv && inv.status !== 'Paid') {
      inv.status = 'Paid';
      inv.paidAt = inv.paidAt || new Date();
      inv.remainingAmount = 0;
      await inv.save();
    }

    const deterministicTxId = `TXN_PROOF_${existing._id}`;
    let txn = await PaymentTransaction.findOne({
      $or: [
        { 'metadata.proofId': existing._id },
        { transactionId: deterministicTxId },
      ],
    });
    if (!txn) {
      txn = await PaymentTransaction.create({
        invoice: inv?._id || existing.invoice,
        student: existing.student?._id || existing.student,
        amount: existing.amount,
        currency: existing.currency || 'EGP',
        method: existing.paymentMethod === 'Vodafone_Cash' ? 'Other' : 'BankTransfer',
        transactionId: deterministicTxId,
        provider: 'MANUAL',
        providerReference: existing.transactionReference || existing.senderIdentifier,
        isMock: false,
        packageType: inv?.packageType || 'WITHOUT_TRANSPORTATION',
        status: 'Paid',
        paymentDate: new Date(),
        metadata: {
          proofId: existing._id,
          manualMethod: existing.paymentMethod,
          senderIdentifier: existing.senderIdentifier,
          approvedBy: adminUser.email,
        },
        refundableBalance: existing.amount,
      });
    }

    const application = await Application.findById(existing.application);
    if (application && application.status !== 'Confirmed') {
      application.status = 'Confirmed';
      await application.save();
    }

    const enrUpdate = {
      student: existing.student?._id || existing.student,
      course: existing.course?._id || existing.course,
      application: application?._id || existing.application,
      status: 'Confirmed',
      paidAmount: existing.amount,
      paymentReference: txn?._id,
    };
    if (application?.cohort || existing.cohort) {
      enrUpdate.cohort = application?.cohort || existing.cohort;
    }

    const existingEnrollment = await Enrollment.findOneAndUpdate(
      {
        student: existing.student?._id || existing.student,
        course: existing.course?._id || existing.course,
      },
      {
        $set: enrUpdate,
        $setOnInsert: {
          packageType: application?.selectedPackage || 'WITHOUT_TRANSPORTATION',
          transportationRequired: application?.selectedPackage === 'WITH_TRANSPORTATION',
          enrollmentDate: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      success: true,
      alreadyApproved: true,
      message: 'Payment proof was already approved and all downstream records are verified.',
      proof: existing,
      invoice: inv,
      transaction: txn,
      enrollment: existingEnrollment,
    };
  }

  if (existing.status === 'Rejected') {
    throw new AppError('Cannot approve a rejected payment proof. The student must resubmit new proof before review.', 400);
  }

  // 2. Atomic conditional update to claim Pending -> Approved
  const approvedProof = await PaymentProof.findOneAndUpdate(
    { _id: proofId, status: 'Pending' },
    {
      $set: {
        status: 'Approved',
        reviewedBy: adminUser._id,
        reviewedAt: new Date(),
      },
      $push: {
        auditTrail: {
          action: 'APPROVED',
          actor: adminUser._id,
          actorRole: adminUser.role || 'admin',
          status: 'Approved',
          note: `Manual payment verified and approved by admin (${adminUser.fullName || adminUser.email}).`,
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!approvedProof) {
    // Race condition or state changed concurrently
    const refreshed = await PaymentProof.findById(proofId);
    if (refreshed?.status === 'Approved') {
      return {
        success: true,
        alreadyApproved: true,
        message: 'Payment proof was approved concurrently.',
        proof: refreshed,
      };
    }
    throw new AppError('Payment proof is not in reviewable Pending status.', 400);
  }

  let invoice = null;
  let transaction = null;
  let enrollment = null;

  try {
    // 3. Authoritative Settle Invoice to Paid
    invoice = await Invoice.findByIdAndUpdate(
      approvedProof.invoice,
      {
        $set: {
          status: 'Paid',
          paidAt: new Date(),
          remainingAmount: 0,
        },
      },
      { new: true }
    );

    // 4. Create or retrieve immutable PaymentTransaction with deterministic proof ID
    const deterministicTxId = `TXN_PROOF_${approvedProof._id}`;
    transaction = await PaymentTransaction.findOne({
      $or: [
        { 'metadata.proofId': approvedProof._id },
        { transactionId: deterministicTxId },
      ],
    });

    if (!transaction) {
      transaction = await PaymentTransaction.create({
        invoice: invoice?._id || approvedProof.invoice,
        student: approvedProof.student,
        amount: approvedProof.amount,
        currency: approvedProof.currency || 'EGP',
        method: approvedProof.paymentMethod === 'Vodafone_Cash' ? 'Other' : 'BankTransfer',
        transactionId: deterministicTxId,
        provider: 'MANUAL',
        providerReference: approvedProof.transactionReference || approvedProof.senderIdentifier,
        isMock: false,
        packageType: invoice?.packageType || 'WITHOUT_TRANSPORTATION',
        status: 'Paid',
        paymentDate: new Date(),
        metadata: {
          proofId: approvedProof._id,
          manualMethod: approvedProof.paymentMethod,
          senderIdentifier: approvedProof.senderIdentifier,
          approvedBy: adminUser.email,
        },
        refundableBalance: approvedProof.amount,
      });
    }

    // 5. Finalize Application
    const application = await Application.findById(approvedProof.application);

    if (application) {
      application.status = 'Confirmed';
      application.statusHistory.push({
        status: 'Confirmed',
        note: `Manual payment proof approved by admin (${adminUser.email}). Enrollment confirmed.`,
        changedAt: new Date(),
      });

      // 6. Idempotent single Enrollment creation via unique { student, course }
      const enrollmentUpdate = {
        student: approvedProof.student,
        course: approvedProof.course,
        application: application._id,
        status: 'Confirmed',
        packageType: application.selectedPackage || 'WITHOUT_TRANSPORTATION',
        transportationRequired: application.selectedPackage === 'WITH_TRANSPORTATION',
        paidAmount: approvedProof.amount,
        paymentReference: transaction._id,
        enrollmentDate: new Date(),
      };
      if (application.cohort || approvedProof.cohort) {
        enrollmentUpdate.cohort = application.cohort || approvedProof.cohort;
      }

      enrollment = await Enrollment.findOneAndUpdate(
        {
          student: approvedProof.student,
          course: approvedProof.course,
        },
        { $set: enrollmentUpdate },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      application.enrollment = enrollment._id;
      await application.save();
    } else {
      // Direct enrollment fallback if application reference is absent
      enrollment = await Enrollment.findOneAndUpdate(
        {
          student: approvedProof.student,
          course: approvedProof.course,
        },
        {
          $set: {
            student: approvedProof.student,
            course: approvedProof.course,
            status: 'Confirmed',
            paidAmount: approvedProof.amount,
            paymentReference: transaction._id,
            enrollmentDate: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  } catch (stepErr) {
    console.error('[ManualPaymentService] Approval pipeline error encountered on standalone DB. Executing clean compensating rollback:', stepErr);

    // 1. Revert Invoice back to Pending
    try {
      await Invoice.findByIdAndUpdate(approvedProof.invoice, {
        $set: {
          status: 'Pending',
          remainingAmount: approvedProof.amount,
          paidAt: null,
        },
      });
    } catch (invRollbackErr) {
      console.error('[ManualPaymentService] Failed to revert invoice during rollback:', invRollbackErr.message);
    }

    // 2. Remove any newly created transaction for this attempt to prevent duplicates or dangling records
    try {
      await PaymentTransaction.deleteOne({
        $or: [
          { 'metadata.proofId': approvedProof._id },
          { transactionId: `TXN_PROOF_${approvedProof._id}` },
        ],
      });
    } catch (txnRollbackErr) {
      console.error('[ManualPaymentService] Failed to clean transaction during rollback:', txnRollbackErr.message);
    }

    // 3. Remove/revert any enrollment activated during this failed attempt
    try {
      await Enrollment.deleteOne({
        student: approvedProof.student,
        course: approvedProof.course,
        status: 'Confirmed',
      });
    } catch (enrRollbackErr) {
      console.error('[ManualPaymentService] Failed to clean enrollment during rollback:', enrRollbackErr.message);
    }

    // 4. Revert PaymentProof back to Pending with comprehensive audit note
    await PaymentProof.findByIdAndUpdate(proofId, {
      $set: {
        status: 'Pending',
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: `Approval state reconciliation: rollback triggered due to execution error: ${stepErr.message}`,
      },
      $push: {
        auditTrail: {
          action: 'APPROVAL_FAILED_ROLLEDBACK',
          actor: adminUser._id,
          actorRole: adminUser.role || 'admin',
          status: 'Pending',
          note: `Approval downstream write failed (${stepErr.message}). Clean rollback executed: invoice restored to Pending, transaction and enrollment cleaned up.`,
          timestamp: new Date(),
        },
      },
    });

    throw new AppError(`Approval execution failed during financial record reconciliation: ${stepErr.message}. The payment proof and financial records have been cleanly restored to Pending.`, 500);
  }

  // 7. Student Notification
  try {
    const courseDoc = await Course.findById(approvedProof.course);
    await notify(
      approvedProof.student,
      'Payment Approved & Enrollment Confirmed',
      `Your manual payment of ${approvedProof.amount} ${approvedProof.currency} via ${approvedProof.paymentMethod.replace('_', ' ')} has been approved. You now have full access to ${courseDoc?.title || 'your course'}.`,
      'success',
      approvedProof.course,
      approvedProof.application
    );
  } catch (notifyErr) {
    console.error('[ManualPaymentService] Notification error (non-fatal):', notifyErr.message);
  }

  // Unified cross-role sync: ensure student is in Instructor and Admin rosters
  try {
    const { syncEnrollment } = require('../../integration/unifiedSyncService');
    await syncEnrollment({
      student: approvedProof.student,
      course: approvedProof.course,
      cohort: approvedProof.cohort || (enrollment ? enrollment.cohort : null),
      enrollmentId: enrollment?._id,
      status: 'Confirmed',
    });
  } catch (syncErr) {
    console.warn('[ManualPaymentService] Unified sync notice:', syncErr.message);
  }

  return {
    success: true,
    message: 'Manual payment successfully approved and course enrollment activated.',
    proof: approvedProof,
    invoice,
    transaction,
    enrollment,
  };
}

/**
 * Admin: Reject payment proof.
 * Requires mandatory rejection reason. Does NOT create an enrollment or grant access.
 */
async function adminRejectPaymentProof({ proofId, rejectionReason, adminUser }) {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new AppError('A valid rejection reason is mandatory when declining payment proof.', 400);
  }

  const existing = await PaymentProof.findById(proofId);
  if (!existing) {
    throw new AppError('Payment proof not found.', 404);
  }

  if (existing.status === 'Approved') {
    throw new AppError('Cannot reject a payment proof that has already been approved and settled.', 400);
  }

  // Idempotency: If already rejected, return existing record safely
  if (existing.status === 'Rejected') {
    return {
      success: true,
      alreadyRejected: true,
      message: 'Payment proof already marked as rejected.',
      proof: existing,
    };
  }

  // Atomic update to mark Rejected
  const rejectedProof = await PaymentProof.findOneAndUpdate(
    { _id: proofId, status: { $in: ['Pending', 'Rejected'] } },
    {
      $set: {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: adminUser._id,
        reviewedAt: new Date(),
      },
      $push: {
        auditTrail: {
          action: 'REJECTED',
          actor: adminUser._id,
          actorRole: adminUser.role || 'admin',
          status: 'Rejected',
          note: rejectionReason.trim(),
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!rejectedProof) {
    throw new AppError('Payment proof status could not be updated.', 400);
  }

  // Notify student of rejection and explanation
  try {
    const courseDoc = await Course.findById(rejectedProof.course);
    await notify(
      rejectedProof.student,
      'Payment Proof Rejected',
      `Your payment proof submission for ${courseDoc?.title || 'the course'} was declined: "${rejectionReason.trim()}". Please review the receiving instructions and upload a valid receipt.`,
      'warning',
      rejectedProof.course,
      rejectedProof.application
    );
  } catch (notifyErr) {
    console.error('[ManualPaymentService] Notification error (non-fatal):', notifyErr.message);
  }

  return {
    success: true,
    message: 'Payment proof rejected successfully. Student was notified to resubmit.',
    proof: rejectedProof,
  };
}

/**
 * Admin: Send direct message to student regarding payment proof.
 * Records auditTrail entry and creates a student notification.
 */
async function adminSendMessageToStudent({ proofId, subject, message, adminUser }) {
  if (!message || !message.trim()) {
    throw new AppError('Message content is required.', 400);
  }

  const proof = await PaymentProof.findById(proofId);
  if (!proof) {
    throw new AppError('Payment proof not found.', 404);
  }

  const trimmedMessage = message.trim();
  const trimmedSubject = (subject && subject.trim()) || 'Message Regarding Payment Proof';

  proof.auditTrail.push({
    action: 'MESSAGE_SENT',
    actor: adminUser._id,
    actorRole: adminUser.role || 'admin',
    status: proof.status,
    note: `[Admin Message] ${trimmedSubject}: ${trimmedMessage}`,
    timestamp: new Date(),
  });
  await proof.save();

  // Notify student in-app
  try {
    const courseDoc = await Course.findById(proof.course);
    await notify(
      proof.student,
      trimmedSubject,
      `Message regarding your payment for ${courseDoc?.title || 'your course'}: ${trimmedMessage}`,
      'info',
      proof.course,
      proof.application
    );
  } catch (notifyErr) {
    console.error('[ManualPaymentService] Message notification error (non-fatal):', notifyErr.message);
  }

  return {
    success: true,
    message: 'Message delivered to student successfully.',
    proof,
  };
}

module.exports = {
  getManualPaymentSettings,
  updateManualPaymentSettings,
  submitPaymentProof,
  getStudentPaymentProofs,
  getPaymentProofFilePath,
  adminListPaymentProofs,
  adminGetPaymentProof,
  adminApprovePaymentProof,
  adminRejectPaymentProof,
  adminSendMessageToStudent,
};
