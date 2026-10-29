const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const StudentProfile = require('../models/StudentProfile');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Invoice = require('../models/Invoice');
const Enrollment = require('../models/Enrollment');
const { checkCourseFit } = require('../services/eligibilityService');
const { autoAcceptAndReserveSeat } = require('../services/admissionService');
const { issueInvoice, processExpiredInvoices, releaseSeatAndPromoteWaitlist } = require('../services/paymentService');
const { notify } = require('../services/notificationService');
const { sendApplicationSubmittedEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');
const fs = require('fs');
const path = require('path');
const PaymentProof = require('../models/PaymentProof');
const { validateDocumentMagicBytes, privateDocsDir } = require('../middleware/applicationDocumentUpload');

async function trySyncAppToAdmin(appDoc) {
  if (!appDoc) return;
  try {
    const { syncApplicationFromStudent } = require('../../integration/unifiedSyncService');
    await syncApplicationFromStudent(appDoc);
  } catch (err) {
    console.warn('[APPLICATION CONTROLLER] Sync to admin notice:', err.message);
  }
}

async function createApplication(req, res, next) {
  try {
    const {
      courseId,
      readinessAttemptId,
      directEnroll,
      selectedPackage = 'WITHOUT_TRANSPORTATION',
      notes,
      statementOfInterest,
    } = req.body;
    const isDirectEnroll = directEnroll === true;

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    // 1. Validate Course Availability & Application Window
    if (course.published === false || course.isActive === false || course.status === 'Closed' || course.status === 'Archived') {
      throw new AppError('Applications are currently closed for this course.', 400);
    }
    if (course.applicationCloseDate && new Date(course.applicationCloseDate) < new Date()) {
      throw new AppError('The application deadline for this course has passed.', 400);
    }
    if (course.applicationOpenDate && new Date(course.applicationOpenDate) > new Date()) {
      throw new AppError('Applications for this course have not opened yet.', 400);
    }

    // 2. Direct Enrollment Constraints
    if (isDirectEnroll) {
      if (course.price == null) {
        throw new AppError('This course does not have published pricing yet. Please submit an application for admissions review.', 400);
      }
      if (course.directEnrollmentPermitted === false) {
        throw new AppError('Direct enrollment is not permitted for this program. Mandatory readiness completion or committee review required.', 400);
      }
    }

    // 3. Resolve or Auto-initialize Student Profile
    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await StudentProfile.create({
        user: req.user._id,
        status: 'student',
        university: 'Egyptian Space Academy Candidate',
        faculty: 'Engineering & Space Sciences',
        profileCompleted: false,
      });
    }

    // 4. Prevent duplicate active applications for the same student and course
    let existingQuery = Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
    });
    if (existingQuery && typeof existingQuery.sort === 'function') {
      existingQuery = existingQuery.sort({ createdAt: -1 });
    }
    let existingActiveApp = await existingQuery;

    if (existingActiveApp) {
      if (readinessAttemptId && !existingActiveApp.readinessAttempt) {
        existingActiveApp.readinessAttempt = readinessAttemptId;
        await existingActiveApp.save();
      }

      // Check if student is already enrolled in this course
      const existingEnrollment = await Enrollment.findOne({
        $or: [{ application: existingActiveApp._id }, { student: req.user._id, course: course._id }],
      });
      if (existingEnrollment || existingActiveApp.status === 'Confirmed') {
        return res.status(200).json({
          success: true,
          data: existingActiveApp,
          enrollment: existingEnrollment,
          enrolled: true,
          message: 'You are already enrolled in this training program.',
        });
      }

      // If active application is already Accepted, reuse the invoice without duplicates
      if (['Accepted', 'Eligible - Payment Pending'].includes(existingActiveApp.status)) {
        let invoice = await Invoice.findOne({ application: existingActiveApp._id, status: { $ne: 'Cancelled' } });
        if (!invoice && course.price != null) {
          invoice = await issueInvoice({
            student: req.user._id,
            application: existingActiveApp._id,
            course,
            cohort: existingActiveApp.cohort,
            packageType: selectedPackage || existingActiveApp.selectedPackage,
          });
        }
        return res.status(200).json({
          success: true,
          data: existingActiveApp,
          invoice,
          message: 'Application accepted and seat reserved. Payment is available.',
        });
      }

      // If application is waitlisted
      if (existingActiveApp.status === 'Waitlisted') {
        return res.status(200).json({
          success: true,
          data: existingActiveApp,
          waitlisted: true,
          waitlistPosition: existingActiveApp.waitlistPosition,
          message: `You are currently on the waitlist at position #${existingActiveApp.waitlistPosition || 1}.`,
        });
      }

      // If existing app is eligible and priced, auto-accept and reserve seat now
      if (
        course.price != null &&
        existingActiveApp.status !== 'Foundation Recommended' &&
        existingActiveApp.status !== 'Manual Review' &&
        existingActiveApp.eligibilityStatus !== 'Not Eligible'
      ) {
        existingActiveApp.eligibilityStatus = 'Eligible';
        const admissionRes = await autoAcceptAndReserveSeat({
          application: existingActiveApp,
          packageType: selectedPackage || existingActiveApp.selectedPackage,
          directEnroll: true,
        });

        return res.status(200).json({
          success: true,
          data: admissionRes?.application || existingActiveApp,
          invoice: admissionRes?.invoice || null,
          waitlisted: admissionRes?.waitlisted || false,
          waitlistPosition: admissionRes?.waitlistPosition,
          message: admissionRes?.application?.status === 'Accepted'
            ? 'Application accepted and seat reserved. Payment is now available.'
            : 'Active application already exists for this course.',
        });
      }

      let invoice = await Invoice.findOne({ application: existingActiveApp._id, status: { $ne: 'Cancelled' } });
      return res.status(200).json({
        success: true,
        data: existingActiveApp,
        invoice,
        waitlisted: existingActiveApp.status === 'Waitlisted',
        waitlistPosition: existingActiveApp.waitlistPosition,
        message: 'Active application already exists for this course.',
      });
    }

    // 5. Evaluate Course Fit & Prerequisites
    const fit = await checkCourseFit(profile, course);
    const applicantNotes = notes || statementOfInterest || undefined;

    if (fit.result === 'Foundation Required') {
      const application = await Application.create({
        student: req.user._id,
        course: course._id,
        status: 'Foundation Recommended',
        eligibilityStatus: 'Not Eligible',
        selectedPackage,
        notes: applicantNotes,
        statementOfInterest: applicantNotes,
        statusHistory: [{ status: 'Foundation Recommended', note: fit.reasons[0]?.message }],
        fitResultSnapshot: fit,
        submittedAt: new Date(),
      });
      await trySyncAppToAdmin(application);
      return res.status(201).json({
        success: true,
        data: application,
        message: fit.reasons[0]?.message || 'Foundation course required before applying.',
      });
    }

    if (fit.result === 'Manual Review') {
      const application = await Application.create({
        student: req.user._id,
        course: course._id,
        status: 'Manual Review',
        eligibilityStatus: 'In Progress',
        selectedPackage,
        notes: applicantNotes,
        statementOfInterest: applicantNotes,
        statusHistory: [{ status: 'Manual Review', note: fit.reasons[0]?.message || 'Admissions committee manual review required.' }],
        fitResultSnapshot: fit,
        submittedAt: new Date(),
      });
      await trySyncAppToAdmin(application);
      return res.status(201).json({
        success: true,
        data: application,
        message: 'Application requires manual review by admissions committee.',
      });
    }

    // 6. Check for Readiness Attempt
    let readinessAttempt = null;
    if (readinessAttemptId) {
      readinessAttempt = await ReadinessAttempt.findOne({
        _id: readinessAttemptId,
        student: req.user._id,
        course: course._id,
        status: 'Submitted',
      });
    }

    if (!readinessAttempt) {
      readinessAttempt = await ReadinessAttempt.findOne({
        student: req.user._id,
        course: course._id,
        status: 'Submitted',
      }).sort({ createdAt: -1 });
    }

    let cohort = await Cohort.findOne({ course: course._id, status: 'Scheduled' }).sort({ startDate: 1 });

    // 7. Case A: Course has no published pricing (price == null)
    if (course.price == null) {
      const application = await Application.create({
        student: req.user._id,
        course: course._id,
        cohort: cohort ? cohort._id : undefined,
        readinessAttempt: readinessAttempt ? readinessAttempt._id : undefined,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        selectedPackage,
        notes: applicantNotes,
        statementOfInterest: applicantNotes,
        statusHistory: [{ status: 'Submitted', note: 'Application registered. Course pricing will be published upon cohort schedule release.' }],
        fitResultSnapshot: fit,
        submittedAt: new Date(),
      });

      try {
        await sendApplicationSubmittedEmail({
          to: req.user.email,
          fullName: req.user.fullName,
          courseTitle: course.title,
          applicationNumber: application.referenceNumber,
          preferredLanguage: req.user.preferredLanguage || 'en',
        });
      } catch (_) {}

      try {
        await notify({
          recipient: req.user._id,
          title: 'Application Submitted',
          message: `Your application for ${course.title} has been received. Pricing will be published upon schedule release.`,
          type: 'info',
          relatedCourse: course._id,
          relatedApplication: application._id,
        });
      } catch (_) {}

      await trySyncAppToAdmin(application);

      return res.status(201).json({
        success: true,
        data: application,
        message: 'Application submitted successfully. Course tuition will be published upon schedule release.',
      });
    }

    // 8. Case B: Ordinary Eligible Course Application (Automated Acceptance & Seat Reservation)
    let application = await Application.create({
      student: req.user._id,
      course: course._id,
      cohort: cohort ? cohort._id : undefined,
      readinessAttempt: readinessAttempt ? readinessAttempt._id : undefined,
      status: 'Submitted',
      eligibilityStatus: 'Eligible',
      selectedPackage,
      notes: applicantNotes,
      statementOfInterest: applicantNotes,
      statusHistory: [{ status: 'Submitted', note: 'Application submitted by student. Running automated admission eligibility evaluation.' }],
      fitResultSnapshot: fit,
      submittedAt: new Date(),
    });

    try {
      await sendApplicationSubmittedEmail({
        to: req.user.email,
        fullName: req.user.fullName,
        courseTitle: course.title,
        applicationNumber: application.referenceNumber,
        preferredLanguage: req.user.preferredLanguage || 'en',
      });
    } catch (_) {}

    // Auto-accept and atomically reserve seat up to capacity
    const admissionRes = await autoAcceptAndReserveSeat({
      application,
      studentId: req.user._id,
      courseId: course._id,
      cohortId: cohort ? cohort._id : undefined,
      packageType: selectedPackage,
      directEnroll: true,
    });

    if (admissionRes?.application) {
      application = admissionRes.application;
    }
    let invoice = admissionRes?.invoice || null;
    if (!invoice && ['Accepted', 'Eligible - Payment Pending'].includes(application.status)) {
      invoice = await Invoice.findOne({ application: application._id, status: { $ne: 'Cancelled' } });
    }

    await trySyncAppToAdmin(application);

    res.status(201).json({
      success: true,
      data: application,
      invoice,
      waitlisted: application.status === 'Waitlisted',
      waitlistPosition: application.waitlistPosition,
      message: application.status === 'Accepted'
        ? 'Application automatically accepted and seat reserved. Payment is now available.'
        : application.status === 'Waitlisted'
        ? 'Cohort is currently full. You have been placed on the priority waitlist.'
        : 'Application submitted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function myApplications(req, res, next) {
  try {
    await processExpiredInvoices();
    const rawApplications = await Application.find({ student: req.user._id })
      .populate('course', 'title level price transportationPrice currency startDate directEnrollmentPermitted')
      .populate('cohort')
      .populate('readinessAttempt')
      .sort({ createdAt: -1 });

    // Self-heal eligible applications previously stuck in Under Review / Submitted
    const applications = [];
    for (const app of rawApplications) {
      if (
        ['Under Review', 'Submitted'].includes(app.status) &&
        app.course?.price != null &&
        app.status !== 'Foundation Recommended' &&
        app.status !== 'Manual Review' &&
        app.eligibilityStatus !== 'Not Eligible'
      ) {
        app.eligibilityStatus = 'Eligible';
        const healed = await autoAcceptAndReserveSeat({ application: app, directEnroll: true });
        applications.push(healed?.application || app);
      } else {
        applications.push(app);
      }
    }

    const appIds = applications.map((a) => a._id);
    const [invoices, enrollments, proofs] = await Promise.all([
      Invoice.find({ application: { $in: appIds } }),
      Enrollment.find({ application: { $in: appIds } }),
      PaymentProof.find({ application: { $in: appIds } }).sort({ createdAt: -1 }),
    ]);

    const invMap = new Map(invoices.map((inv) => [inv.application?.toString(), inv]));
    const enrMap = new Map(enrollments.map((enr) => [enr.application?.toString(), enr]));
    const proofMap = new Map();
    for (const p of proofs) {
      const aId = p.application?.toString();
      if (aId && !proofMap.has(aId)) {
        proofMap.set(aId, p);
      }
    }

    const enriched = applications.map((app) => {
      const plain = typeof app.toObject === 'function' ? app.toObject() : app;
      plain.invoice = invMap.get(app._id.toString()) || null;
      plain.enrollment = enrMap.get(app._id.toString()) || null;
      plain.paymentProof = proofMap.get(app._id.toString()) || null;
      return plain;
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

async function getApplication(req, res, next) {
  try {
    let application = await Application.findOne({ _id: req.params.id, student: req.user._id })
      .populate('course')
      .populate('cohort')
      .populate('readinessAttempt');
    if (!application) throw new AppError('Application not found.', 404);

    // Self-heal eligible application stuck in Under Review / Submitted
    if (
      application.eligibilityStatus === 'Eligible' &&
      ['Under Review', 'Submitted'].includes(application.status) &&
      application.course?.price != null &&
      application.course?.directEnrollmentPermitted !== false
    ) {
      const healed = await autoAcceptAndReserveSeat({ application });
      if (healed?.application) {
        application = healed.application;
      }
    }

    // Attach or heal fitResultSnapshot if missing
    if (!application.fitResultSnapshot) {
      try {
        const profile = await StudentProfile.findOne({ user: req.user._id });
        if (profile && application.course) {
          const fit = await checkCourseFit(profile, application.course);
          application.fitResultSnapshot = fit;
          if (application.course?.directEnrollmentPermitted !== false && fit?.result === 'Eligible' && application.eligibilityStatus === 'Not Eligible') {
            application.eligibilityStatus = 'Eligible';
          }
          await application.save();
        }
      } catch (_) {}
    }

    const [invoice, enrollment, paymentProof] = await Promise.all([
      Invoice.findOne({ application: application._id, student: req.user._id }),
      Enrollment.findOne({ application: application._id, student: req.user._id }),
      PaymentProof.findOne({ application: application._id, student: req.user._id }).sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      data: {
        ...(typeof application.toObject === 'function' ? application.toObject() : application),
        invoice: invoice || null,
        enrollment: enrollment || null,
        paymentProof: paymentProof || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function cancelApplication(req, res, next) {
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!application) throw new AppError('Application not found.', 404);

    if (['Cancelled', 'Withdrawn', 'Rejected'].includes(application.status)) {
      throw new AppError(`Application is already ${application.status}.`, 400);
    }

    const wasHoldingSeat = ['Accepted', 'Eligible - Payment Pending'].includes(application.status);
    const prevStatus = application.status;
    const cohortId = application.cohort;

    application.status = 'Cancelled';
    application.waitlistPosition = undefined;
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Cancelled',
      note: 'Application cancelled by student.',
      changedAt: new Date(),
    });
    await application.save();

    // Void or cancel any pending/issued invoice for this application
    await Invoice.updateMany(
      { application: application._id, status: { $in: ['Invoice Issued', 'Pending', 'Payment Initiated'] } },
      { $set: { status: 'Cancelled' } }
    );

    // If waitlisted, re-index remaining waitlist positions
    if (prevStatus === 'Waitlisted' && cohortId) {
      const remainingWaitlisted = await Application.find({
        cohort: cohortId,
        status: 'Waitlisted',
      }).sort({ waitlistPosition: 1, createdAt: 1 });

      for (let i = 0; i < remainingWaitlisted.length; i++) {
        remainingWaitlisted[i].waitlistPosition = i + 1;
        await remainingWaitlisted[i].save();
      }
    }

    // If holding a seat, release and promote waitlist
    let promotionResult = { promoted: null };
    if (wasHoldingSeat && cohortId) {
      promotionResult = await releaseSeatAndPromoteWaitlist(cohortId);
    }

    res.json({
      success: true,
      message: 'Application cancelled successfully.',
      data: application,
      promotedWaitlist: !!promotionResult.promoted,
    });
  } catch (err) {
    next(err);
  }
}

async function directEnrollApplication(req, res, next) {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id,
    }).populate('course');

    if (!application) throw new AppError('Application not found.', 404);

    const course = application.course;
    if (!course) throw new AppError('Course not found.', 404);

    if (course.price == null) {
      throw new AppError('Direct enrollment is not available for this program as tuition has not yet been finalized.', 400);
    }

    if (course.directEnrollmentPermitted === false) {
      throw new AppError('Direct enrollment is not permitted for this program. Mandatory readiness completion or committee review required.', 400);
    }

    if (application.status === 'Foundation Recommended' || application.eligibilityStatus === 'Not Eligible') {
      throw new AppError('Prerequisite course requirements must be completed before direct enrollment.', 400);
    }

    application.eligibilityStatus = 'Eligible';
    if (['Draft', 'Submitted', 'Under Review'].includes(application.status)) {
      application.status = 'Submitted';
    }
    await application.save();

    const admissionRes = await autoAcceptAndReserveSeat({
      application,
      studentId: req.user._id,
      courseId: course._id,
      directEnroll: true,
      packageType: req.body?.packageType || application.selectedPackage || 'WITHOUT_TRANSPORTATION',
    });

    res.json({
      success: true,
      data: admissionRes?.application || application,
      invoice: admissionRes?.invoice || null,
      message: 'Direct enrollment processed successfully. Seat reserved.',
    });
  } catch (err) {
    next(err);
  }
}

async function uploadApplicationDocument(req, res, next) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      throw new AppError('File is required. Please upload an image (JPEG, PNG, WEBP) or PDF.', 400);
    }

    const isValid = validateDocumentMagicBytes(file.path);
    if (!isValid) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new AppError('Uploaded file is corrupted or invalid. Please upload an authentic image or PDF.', 400);
    }

    const application = await Application.findById(id).populate('course cohort student');
    if (!application) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new AppError('Application not found.', 404);
    }

    const studentOwnerId = application.student?._id ? application.student._id.toString() : application.student?.toString();
    if (studentOwnerId !== req.user._id.toString()) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new AppError("Forbidden: you cannot upload documents for another student's application.", 403);
    }

    if (['Cancelled', 'No Show', 'Rejected'].includes(application.status)) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new AppError(`Cannot upload documents to an application with status: ${application.status}.`, 400);
    }

    if (application.supportingDocument?.path && application.supportingDocument.path !== file.path) {
      try {
        if (fs.existsSync(application.supportingDocument.path)) {
          fs.unlinkSync(application.supportingDocument.path);
        }
      } catch (_) {}
    }

    const docType = req.body?.documentType || 'Supporting_Document';
    application.supportingDocument = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      documentType: docType,
      uploadedAt: new Date(),
    };

    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: application.status,
      note: `Student uploaded supporting document: "${file.originalname}".`,
      changedAt: new Date(),
    });

    await application.save();

    res.json({
      success: true,
      message: 'Supporting document uploaded successfully.',
      data: application,
    });
  } catch (err) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    next(err);
  }
}

async function streamApplicationDocument(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    const isOwner = (application.student?._id ? application.student._id.toString() : application.student?.toString()) === req.user._id.toString();
    const isAdmin = ['admin', 'superadmin', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to view this document.', 403);
    }

    const doc = application.supportingDocument;
    if (!doc || !doc.path || !fs.existsSync(doc.path)) {
      throw new AppError('No supporting document has been uploaded for this application.', 404);
    }

    const resolvedBase = path.resolve(privateDocsDir);
    const resolvedTarget = path.resolve(doc.path);
    if (!resolvedTarget.startsWith(resolvedBase)) {
      throw new AppError('Forbidden: invalid storage path confinement.', 403);
    }

    res.setHeader('Content-Type', doc.mimetype || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || doc.filename}"`);
    fs.createReadStream(doc.path).pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createApplication,
  myApplications,
  getApplication,
  cancelApplication,
  directEnrollApplication,
  uploadApplicationDocument,
  streamApplicationDocument,
};
