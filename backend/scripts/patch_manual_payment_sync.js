const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/modules/student/services/manualPaymentService.js');
let content = fs.readFileSync(file, 'utf8');

const target = `  // Unified cross-role sync: ensure student is in Instructor and Admin rosters
  try {
    const { syncEnrollment } = require('../../integration/unifiedSyncService');
    syncEnrollment({
      student: approvedProof.student,
      course: approvedProof.course,
      cohort: approvedProof.cohort || (enrollment ? enrollment.cohort : null),
      enrollmentId: enrollment?._id,
      status: 'Confirmed',
    }).catch(err => console.warn('[ManualPaymentService] Unified sync notice:', err.message));
  } catch (_) {}`;

const replacement = `  // Unified cross-role sync: ensure student is in Instructor and Admin rosters
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
  }`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  let patched = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
  if (content.includes('\r\n')) {
    patched = patched.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(file, patched, 'utf8');
  console.log('Successfully patched manualPaymentService.js to await syncEnrollment');
} else {
  console.error('Target not found in manualPaymentService.js');
}

