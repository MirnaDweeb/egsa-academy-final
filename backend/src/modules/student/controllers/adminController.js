const User = require('../models/User');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Invoice = require('../models/Invoice');
const Cohort = require('../models/Cohort');
const TrainingSession = require('../models/TrainingSession');
const { issueInvoice } = require('../services/paymentService');
const { notify } = require('../services/notificationService');
const {
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
} = require('../utils/email');
const { AppError } = require('../middleware/error');
const PaymentProof = require('../models/PaymentProof');
const fs = require('fs');
const path = require('path');
const { privateDocsDir } = require('../middleware/applicationDocumentUpload');

async function overview(req, res, next) {
  try {
    const [studentCount, courseCount, applicationCount, enrollmentCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Course.countDocuments({}),
      Application.countDocuments({}),
      Enrollment.countDocuments({}),
    ]);

    res.json({
      success: true,
      data: { studentCount, courseCount, applicationCount, enrollmentCount },
    });
  } catch (err) {
    next(err);
  }
}

async function listApplications(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const applications = await Application.find(filter)
      .populate('student', 'fullName email phone registrationNumber')
      .populate('course', 'title level price transportationPrice currency')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 });

    const appIds = applications.map((a) => a._id);
    const [invoices, enrollments, proofs] = await Promise.all([
      Invoice.find({ application: { $in: appIds } }),
      Enrollment.find({ application: { $in: appIds } }).populate('paymentReference'),
      PaymentProof.find({ application: { $in: appIds } }).sort({ createdAt: -1 }),
    ]);

    const invoiceMap = new Map(invoices.map((inv) => [inv.application.toString(), inv]));
    const enrollmentMap = new Map(enrollments.map((enr) => [enr.application.toString(), enr]));
    const proofMap = new Map();
    for (const p of proofs) {
      if (p.application && !proofMap.has(p.application.toString())) {
        proofMap.set(p.application.toString(), p);
      }
    }

    const enriched = applications.map((app) => {
      const plain = app.toObject();
      plain.invoice = invoiceMap.get(app._id.toString()) || null;
      plain.enrollment = enrollmentMap.get(app._id.toString()) || null;
      plain.paymentProof = proofMap.get(app._id.toString()) || null;
      return plain;
    });

    res.json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

async function listApplicationsForReview(req, res, next) {
  try {
    const applications = await Application.find({
      status: { $in: ['Manual Review', 'Under Review', 'Submitted'] },
    })
      .populate('student', 'fullName email phone registrationNumber')
      .populate('course', 'title level price transportationPrice currency')
      .populate('cohort', 'name startDate')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
}

async function acceptApplication(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id)
      .populate('student')
      .populate('course')
      .populate('cohort');

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    // Idempotency: if already Accepted or Confirmed, return existing status safely without re-incrementing seats
    if (application.status === 'Accepted') {
      let invoice = await Invoice.findOne({ application: application._id, status: { $nin: ['Cancelled', 'Waived'] } });
      if (!invoice && application.course?.price > 0) {
        const existingInactive = await Invoice.findOne({ application: application._id });
        if (existingInactive && ['Waived', 'Cancelled'].includes(existingInactive.status)) {
          existingInactive.status = 'Invoice Issued';
          existingInactive.issuedAt = new Date();
          const days = 3;
          existingInactive.dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          existingInactive.dueAt = existingInactive.dueDate;
          await existingInactive.save();
          invoice = existingInactive;
        } else {
          invoice = await issueInvoice({
            student: application.student._id,
            application: application._id,
            course: application.course,
            cohort: application.cohort,
            transportationAmount: 0,
          });
        }
      }
      return res.json({
        success: true,
        message: 'Application is already accepted.',
        data: { application, invoice },
      });
    }
    if (['Confirmed', 'In Progress', 'Completed'].includes(application.status)) {
      const enrollment = await Enrollment.findOne({ application: application._id });
      return res.json({
        success: true,
        message: 'Application is already confirmed and enrolled.',
        data: { application, enrollment },
      });
    }

    // Business rule: student must be eligible
    if (application.status === 'Foundation Recommended' || application.eligibilityStatus === 'Not Eligible') {
      throw new AppError('Cannot accept an ineligible candidate. Foundational requirements must be met first.', 400);
    }

    // Cohort capacity validation
    let cohort = application.cohort;
    if (!cohort && application.course) {
      cohort = await Cohort.findOne({ course: application.course._id, status: 'Scheduled' }).sort({ startDate: 1 });
      if (cohort) {
        application.cohort = cohort._id;
      }
    }

    if (cohort) {
      const currentCohort = await Cohort.findById(cohort._id || cohort);
      if (currentCohort) {
        if (currentCohort.capacity != null && currentCohort.seatsTaken >= currentCohort.capacity) {
          // Full capacity -> route to Waitlist automatically
          application.status = 'Waitlisted';
          const waitlistCount = await Application.countDocuments({ cohort: currentCohort._id, status: 'Waitlisted' });
          application.waitlistPosition = waitlistCount + 1;
          application.statusHistory = application.statusHistory || [];
          application.statusHistory.push({
            status: 'Waitlisted',
            note: `Cohort ${currentCohort.name} has reached maximum capacity (${currentCohort.capacity}/${currentCohort.capacity}). Placed on waitlist at position #${application.waitlistPosition}.`,
            changedAt: new Date(),
          });
          await application.save();

          try {
            await notify({
              recipient: application.student._id,
              title: 'Application Waitlisted',
              message: 'Your application has been placed on the cohort waitlist.',
              type: 'info',
              relatedCourse: application.course._id,
              relatedApplication: application._id,
            });
          } catch (_) {}

          return res.json({
            success: true,
            message: `Cohort is at maximum capacity (${currentCohort.capacity}/${currentCohort.capacity}). Application placed on waitlist at position #${application.waitlistPosition}.`,
            data: {
              application,
              waitlisted: true,
              waitlistPosition: application.waitlistPosition,
            },
          });
        }

        // Atomically reserve seat
        const reserved = await Cohort.findOneAndUpdate(
          { _id: currentCohort._id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
          { $inc: { seatsTaken: 1 } },
          { new: true }
        );

        if (!reserved && currentCohort.capacity != null) {
          // Race condition: cohort just filled up
          application.status = 'Waitlisted';
          const waitlistCount = await Application.countDocuments({ cohort: currentCohort._id, status: 'Waitlisted' });
          application.waitlistPosition = waitlistCount + 1;
          application.statusHistory = application.statusHistory || [];
          application.statusHistory.push({
            status: 'Waitlisted',
            note: `Cohort ${currentCohort.name} filled concurrently. Placed on waitlist at position #${application.waitlistPosition}.`,
            changedAt: new Date(),
          });
          await application.save();

          return res.json({
            success: true,
            message: `Cohort reached maximum capacity. Application placed on waitlist at position #${application.waitlistPosition}.`,
            data: { application, waitlisted: true, waitlistPosition: application.waitlistPosition },
          });
        }
      }
    }

    application.status = 'Accepted';
    application.waitlistPosition = undefined;
    const note = req.body.note || 'Application accepted by EGSA Academic Committee.';
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({ status: 'Accepted', note, changedAt: new Date() });
    await application.save();

    // If course is free (price === 0), activate enrollment immediately without payment
    let invoice = await Invoice.findOne({ application: application._id, status: { $nin: ['Cancelled', 'Waived'] } });
    let enrollment = null;

    if (application.course?.price === 0) {
      application.status = 'Confirmed';
      enrollment = await Enrollment.findOneAndUpdate(
        { student: application.student._id, course: application.course._id },
        {
          $set: {
            student: application.student._id,
            course: application.course._id,
            cohort: application.cohort,
            application: application._id,
            status: 'Confirmed',
            paidAmount: 0,
            packageType: application.selectedPackage || 'WITHOUT_TRANSPORTATION',
            transportationRequired: application.selectedPackage === 'WITH_TRANSPORTATION',
          },
          $setOnInsert: { enrolledAt: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      application.enrollment = enrollment._id;
      await application.save();
    } else if (application.course?.price > 0) {
      if (!invoice) {
        const existingInactive = await Invoice.findOne({ application: application._id });
        if (existingInactive && ['Waived', 'Cancelled'].includes(existingInactive.status)) {
          existingInactive.status = 'Invoice Issued';
          existingInactive.issuedAt = new Date();
          const days = 3;
          existingInactive.dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          existingInactive.dueAt = existingInactive.dueDate;
          await existingInactive.save();
          invoice = existingInactive;
        } else {
          invoice = await issueInvoice({
            student: application.student._id,
            application: application._id,
            course: application.course,
            cohort: application.cohort,
            transportationAmount: 0,
          });
        }
      }
    }

    const basePrice = application.course?.price || 0;
    const transportationPrice = application.course?.transportationPrice != null ? application.course.transportationPrice : 500;
    const paymentDeadline = invoice ? invoice.dueDate : undefined;

    // Send institutional acceptance email (non-blocking)
    try {
      await sendApplicationAcceptedEmail({
        to: application.student.email,
        fullName: application.student.fullName,
        courseTitle: application.course.title,
        courseLevel: application.course.level,
        cohortName: application.cohort ? application.cohort.name : undefined,
        applicationNumber: application.referenceNumber,
        basePrice,
        transportationPrice,
        paymentDeadline,
        preferredLanguage: application.student.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send acceptance email:', emailErr.message);
    }

    // In-app notification
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Accepted',
        message: 'Your application has been accepted. Payment is now required.',
        type: 'success',
        relatedCourse: application.course._id,
        relatedApplication: application._id,
      });
    } catch (notifErr) {
      console.error('[NOTIF ERROR] Failed to create acceptance notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Application accepted successfully. Acceptance notification and email dispatched.',
      data: {
        application,
        invoice,
        enrollment,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function reviewApplication(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate('student course cohort');
    if (!application) throw new AppError('Application not found.', 404);

    application.status = 'Under Review';
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Under Review',
      note: req.body.note || 'Application placed Under Review by EGSA Academic Committee.',
      changedAt: new Date(),
    });
    await application.save();

    res.json({
      success: true,
      message: 'Application placed Under Review.',
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

async function waitlistApplication(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate('student course cohort');
    if (!application) throw new AppError('Application not found.', 404);

    const cohortId = application.cohort?._id || application.cohort;
    const waitlistCount = cohortId ? await Application.countDocuments({ cohort: cohortId, status: 'Waitlisted' }) : 0;

    application.status = 'Waitlisted';
    application.waitlistPosition = waitlistCount + 1;
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Waitlisted',
      note: req.body.note || `Placed on waitlist at position #${application.waitlistPosition} by Admin.`,
      changedAt: new Date(),
    });
    await application.save();

    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Waitlisted',
        message: 'Your application has been placed on the cohort waitlist.',
        type: 'info',
        relatedCourse: application.course?._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `Application moved to waitlist at position #${application.waitlistPosition}.`,
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

async function rejectApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const rejectionReason = reason || note || 'Your application did not meet the enrollment requirements for this cycle.';

    const application = await Application.findById(id)
      .populate('student')
      .populate('course');

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    const wasHoldingSeat = ['Accepted', 'Eligible - Payment Pending'].includes(application.status);
    const prevStatus = application.status;
    const cohortId = application.cohort;

    application.status = 'Rejected';
    application.waitlistPosition = undefined;
    application.rejectionReason = rejectionReason;
    application.statusHistory.push({ status: 'Rejected', note: rejectionReason, changedAt: new Date() });
    await application.save();

    // Mark any pending invoices as Waived
    await Invoice.updateMany(
      { application: application._id, status: { $in: ['Invoice Issued', 'Pending'] } },
      { status: 'Waived' }
    );

    // If application held a seat, release it and promote next in waitlist
    if (wasHoldingSeat && cohortId) {
      const { releaseSeatAndPromoteWaitlist } = require('../services/paymentService');
      await releaseSeatAndPromoteWaitlist(cohortId);
    } else if (prevStatus === 'Waitlisted' && cohortId) {
      // Re-index remaining waitlisted
      const remainingWaitlisted = await Application.find({
        cohort: cohortId,
        status: 'Waitlisted',
      }).sort({ waitlistPosition: 1, createdAt: 1 });
      for (let i = 0; i < remainingWaitlisted.length; i++) {
        remainingWaitlisted[i].waitlistPosition = i + 1;
        await remainingWaitlisted[i].save();
      }
    }

    // Send institutional rejection email (non-blocking)
    try {
      await sendApplicationRejectedEmail({
        to: application.student.email,
        fullName: application.student.fullName,
        courseTitle: application.course.title,
        applicationNumber: application.referenceNumber,
        reason: rejectionReason,
        preferredLanguage: application.student.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send rejection email:', emailErr.message);
    }

    // In-app notification
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Status Update',
        message: `Update regarding your application for ${application.course.title}: ${rejectionReason}`,
        type: 'warning',
        relatedCourse: application.course._id,
        relatedApplication: application._id,
      });
    } catch (notifErr) {
      console.error('[NOTIF ERROR] Failed to create rejection notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Application rejected and notification dispatched.',
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

async function promoteWaitlist(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id)
      .populate('student')
      .populate('course')
      .populate('cohort');

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    if (application.status !== 'Waitlisted') {
      throw new AppError('Only waitlisted applications can be promoted.', 400);
    }

    // Atomically check capacity and allocate seat
    const cohortId = application.cohort?._id || application.cohort;
    if (cohortId) {
      const reservedCohort = await Cohort.findOneAndUpdate(
        { _id: cohortId, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
        { $inc: { seatsTaken: 1 } },
        { new: true }
      );
      if (!reservedCohort) {
        throw new AppError('Cannot promote: Cohort has reached maximum capacity.', 400);
      }
    }

    application.status = 'Accepted';
    application.waitlistPosition = undefined;
    application.statusHistory.push({
      status: 'Accepted',
      note: 'Manually promoted from waitlist by Admin.',
      changedAt: new Date(),
    });
    await application.save();

    // Re-index remaining waitlisted
    if (cohortId) {
      const remainingWaitlisted = await Application.find({
        cohort: cohortId,
        status: 'Waitlisted',
      }).sort({ waitlistPosition: 1, createdAt: 1 });
      for (let i = 0; i < remainingWaitlisted.length; i++) {
        remainingWaitlisted[i].waitlistPosition = i + 1;
        await remainingWaitlisted[i].save();
      }
    }

    // Issue invoice with 72-hour deadline
    let invoice = await Invoice.findOne({ application: application._id });
    if (!invoice && application.course) {
      invoice = await issueInvoice({
        student: application.student._id,
        application: application._id,
        course: application.course,
      });
    }

    // Non-blocking email
    try {
      const basePrice = application.course?.price || 0;
      const transportationPrice = application.course?.transportationPrice != null ? application.course.transportationPrice : 500;
      await sendApplicationAcceptedEmail({
        to: application.student.email,
        fullName: application.student.fullName,
        courseTitle: application.course.title,
        courseLevel: application.course.level,
        applicationNumber: application.referenceNumber,
        basePrice,
        transportationPrice,
        paymentDeadline: invoice?.dueDate,
        preferredLanguage: application.student.preferredLanguage || 'en',
      });
    } catch (_) {}

    // In-app notification
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Accepted — Space Academy',
        message: `Your application for ${application.course.title} has been promoted from the waitlist and accepted. Please proceed with tuition payment within 72 hours.`,
        type: 'success',
        relatedCourse: application.course._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'Application successfully promoted to Accepted with 72h invoice.',
      data: {
        application,
        invoice,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listCohorts(req, res, next) {
  try {
    const filter = {};
    if (req.query.courseId) filter.course = req.query.courseId;
    if (req.query.status) filter.status = req.query.status;

    const cohorts = await Cohort.find(filter)
      .populate('course', 'title code level price transportationPrice')
      .sort({ startDate: -1 });

    res.json({ success: true, data: cohorts });
  } catch (err) {
    next(err);
  }
}

async function createCohort(req, res, next) {
  try {
    const { courseId, name, startDate, endDate, capacity } = req.body;
    if (!courseId || !name || !startDate) {
      throw new AppError('Course, cohort name, and start date are required.', 400);
    }
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const cohort = await Cohort.create({
      course: courseId,
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      capacity: capacity ? Number(capacity) : 30,
      seatsTaken: 0,
      status: 'Scheduled',
    });

    res.status(201).json({ success: true, data: cohort, message: 'Cohort created successfully.' });
  } catch (err) {
    next(err);
  }
}

async function updateCohort(req, res, next) {
  try {
    const { id } = req.params;
    const { capacity, status, startDate, endDate, name } = req.body;
    const cohort = await Cohort.findById(id);
    if (!cohort) throw new AppError('Cohort not found.', 404);

    if (capacity != null) {
      const capNum = Number(capacity);
      if (capNum < cohort.seatsTaken) {
        throw new AppError(`Cannot reduce capacity below currently reserved seats (${cohort.seatsTaken}).`, 400);
      }
      cohort.capacity = capNum;
    }
    if (status) cohort.status = status;
    if (name) cohort.name = name.trim();
    if (startDate) cohort.startDate = new Date(startDate);
    if (endDate) cohort.endDate = new Date(endDate);

    await cohort.save();
    res.json({ success: true, data: cohort, message: 'Cohort updated successfully.' });
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const filter = {};
    if (req.query.cohortId) filter.cohort = req.query.cohortId;
    if (req.query.courseId) filter.course = req.query.courseId;

    const sessions = await TrainingSession.find(filter)
      .populate('course', 'title code')
      .populate('cohort', 'name startDate endDate')
      .sort({ sessionNumber: 1, date: 1 });

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const { courseId, cohortId, sessionNumber, title, focus, date, startTime, endTime, location, deliveryMode } = req.body;
    if (!courseId || !cohortId || !sessionNumber || !title || !date) {
      throw new AppError('Course, cohort, sessionNumber, title, and date are required.', 400);
    }

    const session = await TrainingSession.create({
      course: courseId,
      cohort: cohortId,
      sessionNumber: Number(sessionNumber),
      title: title.trim(),
      focus: focus ? focus.trim() : undefined,
      date: new Date(date),
      startTime: startTime || '10:00 AM',
      endTime: endTime || '03:00 PM',
      location: location || 'Egyptian Space Academy, Cairo',
      deliveryMode: deliveryMode || 'Onsite',
      status: 'Scheduled',
    });

    res.status(201).json({ success: true, data: session, message: 'Training session created successfully.' });
  } catch (err) {
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
  overview,
  listApplications,
  listApplicationsForReview,
  acceptApplication,
  reviewApplication,
  waitlistApplication,
  rejectApplication,
  promoteWaitlist,
  listCohorts,
  createCohort,
  updateCohort,
  listSessions,
  createSession,
  streamApplicationDocument,
};
