/**
 * EGSA Academy — Canonical Program & Application Status Resolver
 *
 * Distinguishes the separate dimensions:
 *   1. Application status
 *   2. Eligibility decision
 *   3. Payment status
 *   4. Enrollment status
 *   5. Course availability / capacity
 *
 * Provides a single authoritative mapping for Explore Programs,
 * Student Dashboard, My Applications, and Course Cards.
 */

/**
 * Evaluates whether course applications are currently open, closed, or scheduled to open.
 *
 * @param {Object} course The course object
 * @returns {Object} { isOpen: boolean, state: 'OPEN'|'CLOSED'|'SCHEDULED'|'DEADLINE_PASSED', message: string, openDateStr?: string }
 */
export function getCourseEnrollmentStatus(course) {
  if (!course) return { isOpen: false, state: 'CLOSED', message: 'Course information unavailable.' };
  if (
    course.published === false ||
    course.isActive === false ||
    course.status === 'Closed' ||
    course.status === 'Archived' ||
    course.status === 'Draft' ||
    course.status === 'DRAFT'
  ) {
    return { isOpen: false, state: 'CLOSED', message: 'Applications are currently closed for this course.' };
  }
  if (course.applicationCloseDate && new Date(course.applicationCloseDate) < new Date()) {
    return { isOpen: false, state: 'DEADLINE_PASSED', message: 'The application deadline for this course has passed.' };
  }
  if (course.applicationOpenDate && new Date(course.applicationOpenDate) > new Date()) {
    const openDateStr = new Date(course.applicationOpenDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return { isOpen: false, state: 'SCHEDULED', message: `Applications for this course open on ${openDateStr}.`, openDateStr };
  }
  return { isOpen: true, state: 'OPEN', message: 'Applications are currently open for this course.' };
}

export const PROGRAM_CARD_STATES = {
  AVAILABLE: 'AVAILABLE',
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_VERIFICATION_PENDING: 'PAYMENT_VERIFICATION_PENDING',
  PAYMENT_ACTION_REQUIRED: 'PAYMENT_ACTION_REQUIRED',
  ENROLLMENT_PROCESSING: 'ENROLLMENT_PROCESSING',
  ENROLLED: 'ENROLLED',
  WAITLISTED: 'WAITLISTED',
  FOUNDATION_RECOMMENDED: 'FOUNDATION_RECOMMENDED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  SCHEDULED: 'SCHEDULED',
  UNAVAILABLE: 'UNAVAILABLE',
};

/**
 * Resolves the precise presentation state and actionable metadata
 * for a course card based on persisted backend records.
 *
 * @param {Object} course The course object
 * @param {Object} [app] The student's application object for this course (if any)
 * @returns {Object} { key, badgeLabel, badgeClass, badgeIcon, actionLabel, actionIcon, actionType, actionUrl, isActionDisabled, tooltip }
 */
export function resolveProgramCardState(course, app) {
  if (!course) {
    return {
      key: PROGRAM_CARD_STATES.UNAVAILABLE,
      badgeLabel: 'Unavailable',
      badgeClass: 'error',
      badgeIcon: 'fa-ban',
      actionLabel: 'Unavailable',
      actionType: 'disabled',
      actionUrl: null,
      isActionDisabled: true,
      tooltip: 'Course information is currently unavailable.',
    };
  }

  // 1. Persisted Enrollment -> Student is officially ENROLLED
  const hasEnrollment = Boolean(
    app?.enrollment ||
    app?.status === 'Confirmed' ||
    (app?.status === 'Completed' || app?.status === 'Active')
  );

  if (hasEnrollment) {
    const courseId = course._id || app?.course?._id || app?.course;
    return {
      key: PROGRAM_CARD_STATES.ENROLLED,
      badgeLabel: 'Enrolled',
      badgeClass: 'ready',
      badgeIcon: 'fa-circle-check',
      actionLabel: 'View Training',
      actionIcon: 'fa-play',
      actionType: 'link',
      actionUrl: `/portal/training/${courseId}`,
      fallbackUrl: '/student/training',
      isActionDisabled: false,
      tooltip: 'You are officially enrolled in this training program. Access live sessions, syllabus, and workspace.',
    };
  }

  // If student has an active application for this course:
  if (app && !['Cancelled', 'Withdrawn', 'Rejected'].includes(app.status)) {
    const inv = app.invoice;
    const invId = inv?._id || '';
    const proof = app.paymentProof;
    const paymentUrl = invId
      ? `/student/payments?invoiceId=${invId}&applicationId=${app._id}`
      : `/student/payments?applicationId=${app._id}`;

    // 2. Payment Proof Verification State
    // Student submitted proof, pending Admin financial verification
    if (proof && proof.status === 'Pending') {
      return {
        key: PROGRAM_CARD_STATES.PAYMENT_VERIFICATION_PENDING,
        badgeLabel: 'Payment Verification Pending',
        badgeClass: 'pending',
        badgeIcon: 'fa-clock-rotate-left',
        actionLabel: 'View Payment',
        actionIcon: 'fa-file-invoice-dollar',
        actionType: 'link',
        actionUrl: paymentUrl,
        isActionDisabled: false,
        tooltip: 'Your payment proof has been received and is being verified by EGSA finance. Enrollment activates automatically upon verification.',
      };
    }

    // 3. Payment Proof Rejected
    // Admin reviewed proof and rejected it -> Student needs to resubmit
    if (proof && proof.status === 'Rejected') {
      return {
        key: PROGRAM_CARD_STATES.PAYMENT_ACTION_REQUIRED,
        badgeLabel: 'Payment Action Required',
        badgeClass: 'error',
        badgeIcon: 'fa-triangle-exclamation',
        actionLabel: 'Resubmit Payment',
        actionIcon: 'fa-arrow-rotate-left',
        actionType: 'link',
        actionUrl: paymentUrl,
        isActionDisabled: false,
        rejectionReason: proof.rejectionReason || 'Please review receiving account details and upload valid proof.',
        tooltip: `Payment proof requires revision: "${proof.rejectionReason || 'Please resubmit valid transfer receipt'}".`,
      };
    }

    // 4. Payment Confirmed / Processing Enrollment
    if (inv && (inv.status === 'Paid' || inv.status === 'PAID')) {
      return {
        key: PROGRAM_CARD_STATES.ENROLLMENT_PROCESSING,
        badgeLabel: 'Enrollment Processing',
        badgeClass: 'ready',
        badgeIcon: 'fa-spinner fa-spin',
        actionLabel: 'View Status',
        actionIcon: 'fa-clock',
        actionType: 'link',
        actionUrl: `/student/applications/${app._id}`,
        isActionDisabled: false,
        tooltip: 'Tuition verified. Downstream training enrollment and cohort roster synchronization in progress.',
      };
    }

    // 5. Accepted & Payment Required (Primary actionable state)
    if (['Accepted', 'Eligible - Payment Pending'].includes(app.status)) {
      const isContinue = inv?.status === 'Payment Initiated';
      const amountText = inv?.amount ? ` (${inv.amount.toLocaleString()} ${inv.currency || 'EGP'})` : '';
      return {
        key: PROGRAM_CARD_STATES.PAYMENT_REQUIRED,
        badgeLabel: 'Accepted — Payment Required',
        badgeClass: 'pending',
        badgeIcon: 'fa-credit-card',
        actionLabel: isContinue ? 'Continue Payment' : `Pay Now${amountText}`,
        actionIcon: isContinue ? 'fa-spinner fa-spin' : 'fa-credit-card',
        actionType: 'link',
        actionUrl: paymentUrl,
        isActionDisabled: false,
        dueDate: inv?.dueDate || inv?.dueAt,
        tooltip: 'Application accepted and seat reserved. Complete tuition payment within 72 hours to finalize enrollment.',
      };
    }

    // 6. Waitlisted
    if (app.status === 'Waitlisted') {
      const pos = app.waitlistPosition || 1;
      return {
        key: PROGRAM_CARD_STATES.WAITLISTED,
        badgeLabel: `Waitlisted (#${pos})`,
        badgeClass: 'pending',
        badgeIcon: 'fa-clock',
        actionLabel: 'View Application',
        actionIcon: 'fa-file-lines',
        actionType: 'link',
        actionUrl: `/student/applications/${app._id}`,
        isActionDisabled: false,
        tooltip: `Cohort capacity is currently full. You hold priority position #${pos} on the official waitlist.`,
      };
    }

    // 7. Foundation Recommended (Missing prerequisite)
    if (
      app.status === 'Foundation Recommended' ||
      app.status === 'Foundation Required' ||
      app.eligibilityStatus === 'Not Eligible'
    ) {
      return {
        key: PROGRAM_CARD_STATES.FOUNDATION_RECOMMENDED,
        badgeLabel: 'Foundation Recommended',
        badgeClass: 'gold',
        badgeIcon: 'fa-graduation-cap',
        actionLabel: 'Review Prerequisites',
        actionIcon: 'fa-lightbulb',
        actionType: 'link',
        actionUrl: `/student/applications/${app._id}/foundation`,
        isActionDisabled: false,
        tooltip: 'Prerequisite alignment indicates a foundational preparation course is recommended prior to enrollment.',
      };
    }

    // 8. Manual Review (Admissions exception)
    if (app.status === 'Manual Review') {
      return {
        key: PROGRAM_CARD_STATES.MANUAL_REVIEW,
        badgeLabel: 'Under Review',
        badgeClass: 'pending',
        badgeIcon: 'fa-clipboard-user',
        actionLabel: 'View Application',
        actionIcon: 'fa-magnifying-glass',
        actionType: 'link',
        actionUrl: `/student/applications/${app._id}`,
        isActionDisabled: false,
        tooltip: 'Admissions committee exception review in progress. You will receive an automated notification once finalized.',
      };
    }

    // 9. Standard Submitted / Under Review
    if (app.status === 'Submitted' || app.status === 'Under Review') {
      return {
        key: PROGRAM_CARD_STATES.APPLICATION_SUBMITTED,
        badgeLabel: 'Application Submitted',
        badgeClass: 'pending',
        badgeIcon: 'fa-paper-plane',
        actionLabel: 'View Status',
        actionIcon: 'fa-circle-info',
        actionType: 'link',
        actionUrl: `/student/applications/${app._id}`,
        isActionDisabled: false,
        tooltip: 'Your application has been received and is being processed by the admissions pipeline.',
      };
    }

    // Generic fallback for other active application statuses
    return {
      key: PROGRAM_CARD_STATES.APPLICATION_SUBMITTED,
      badgeLabel: app.status || 'Application Submitted',
      badgeClass: 'pending',
      badgeIcon: 'fa-file-lines',
      actionLabel: 'View Application',
      actionIcon: 'fa-arrow-up-right-from-square',
      actionType: 'link',
      actionUrl: `/student/applications/${app._id}`,
      isActionDisabled: false,
      tooltip: 'Click to view application details.',
    };
  }

  // 10. Course Availability Checks (Student has NOT applied yet)
  const windowStatus = getCourseEnrollmentStatus(course);

  if (windowStatus.state === 'SCHEDULED') {
    return {
      key: PROGRAM_CARD_STATES.SCHEDULED,
      badgeLabel: `Opens ${windowStatus.openDateStr}`,
      badgeClass: 'pending',
      badgeIcon: 'fa-calendar-clock',
      actionLabel: `Opens ${windowStatus.openDateStr}`,
      actionIcon: 'fa-clock',
      actionType: 'disabled',
      actionUrl: null,
      isActionDisabled: true,
      tooltip: windowStatus.message,
    };
  }

  if (windowStatus.state === 'DEADLINE_PASSED') {
    return {
      key: PROGRAM_CARD_STATES.UNAVAILABLE,
      badgeLabel: 'Deadline Passed',
      badgeClass: 'error',
      badgeIcon: 'fa-calendar-xmark',
      actionLabel: 'Enrollment Closed',
      actionIcon: 'fa-lock',
      actionType: 'disabled',
      actionUrl: null,
      isActionDisabled: true,
      tooltip: windowStatus.message,
    };
  }

  if (windowStatus.state === 'CLOSED') {
    return {
      key: PROGRAM_CARD_STATES.UNAVAILABLE,
      badgeLabel: 'Enrollment Closed',
      badgeClass: 'error',
      badgeIcon: 'fa-lock',
      actionLabel: 'Enrollment Closed',
      actionIcon: 'fa-lock',
      actionType: 'disabled',
      actionUrl: null,
      isActionDisabled: true,
      tooltip: windowStatus.message,
    };
  }

  const isFull =
    course.capacity != null &&
    (course.availableSeats != null ? course.availableSeats <= 0 : false);

  if (isFull) {
    return {
      key: PROGRAM_CARD_STATES.AVAILABLE,
      badgeLabel: 'Capacity Full (Waitlist Open)',
      badgeClass: 'pending',
      badgeIcon: 'fa-users',
      actionLabel: 'Apply for Waitlist',
      actionIcon: 'fa-clock',
      actionType: 'apply',
      actionUrl: null,
      isActionDisabled: false,
      tooltip: 'Course capacity has been reached. Submitting an application will place you on the prioritized cohort waitlist.',
    };
  }

  // 11. Ordinary Available Course (NOT applied yet)
  // NEVER show "Pay Now" or "Enrolled" before the student applies and is accepted!
  return {
    key: PROGRAM_CARD_STATES.AVAILABLE,
    badgeLabel: 'Available',
    badgeClass: 'ready',
    badgeIcon: 'fa-check',
    actionLabel: 'Apply Now',
    actionIcon: 'fa-paper-plane',
    actionType: 'apply',
    actionUrl: null,
    isActionDisabled: false,
    tooltip: 'Submit your application. Once verified for eligibility, seat reservation and payment will become available.',
  };
}
