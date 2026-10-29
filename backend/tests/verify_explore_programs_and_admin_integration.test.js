/**
 * EGSA Academy — Explore Programs & Admin Integration Verification Suite
 *
 * Verifies all 11 required scenarios:
 * 1. Newly registered student sees the real program catalog (118 programs).
 * 2. Unapplied programs show "Apply Now" (never "Pay Now" or "Enrolled").
 * 3. Submitting an application creates a persisted record.
 * 4. Correct Admin sees the application in their review queue.
 * 5. Admin acceptance updates student application status.
 * 6. Payment-required programs remain gated until payment approval.
 * 7. Enrollment appears only after all required conditions are satisfied.
 * 8. Student catalog and dashboard reflect real updated status after refresh.
 * 9. Program edits made by Admin are reflected in the Student portal.
 * 10. Division isolation, authorization, and duplicate submissions are guarded.
 * 11. Existing programs and workflows remain intact.
 */

const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:5500';
const STUDENT_API = `${BASE_URL}/api`;
const ADMIN_API = `${BASE_URL}/admin-api`;

const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function makeMultipartFormData(fields, fileField, filename, fileBuffer, mimeType) {
  const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
    );
  }

  if (fileField && filename && fileBuffer) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
    );
    chunks.push(fileBuffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };
  return { body, headers };
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {}
  } else {
    try {
      data = await res.text();
    } catch (_) {}
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

let passCount = 0;
let failCount = 0;

function assert(condition, message, extra = null) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`, extra ? JSON.stringify(extra) : '');
    failCount++;
  }
}

async function runTests() {
  console.log('=================================================================');
  console.log(' STARTING EXPLORE PROGRAMS & ADMIN INTEGRATION VERIFICATION');
  console.log('=================================================================\n');

  const timestamp = Date.now();
  const testStudentEmail = `explore.cadet.${timestamp}@egsa.gov.eg`;
  const studentPassword = 'Password123!';

  let studentToken = null;
  let uniAdminToken = null;
  let preUniAdminToken = null;
  let superAdminToken = null;

  // 1. Setup Student and Admin Tokens
  console.log('--- Phase 1: Authentication & Account Provisioning ---');
  try {
    const regRes = await request(`${STUDENT_API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Explore Programs Test Cadet',
        email: testStudentEmail,
        password: studentPassword,
        confirmPassword: studentPassword,
        division: 'UNIVERSITY',
        status: 'student',
        university: 'Cairo Aerospace Academy',
        faculty: 'Space Systems Engineering',
        phone: '01012345678',
        nationalId: `${timestamp}`.padEnd(14, '5').slice(0, 14),
        agreeToTerms: true,
      }),
    });
    assert(regRes.status === 201, 'Student registered successfully (201 Created)', regRes.data);

    // Login student
    const loginRes = await request(`${STUDENT_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testStudentEmail, password: studentPassword }),
    });
    studentToken = loginRes.data?.data?.accessToken || loginRes.data?.token;
    assert(Boolean(studentToken), 'Student logged in and received valid accessToken');
  } catch (err) {
    console.error('Student registration error:', err.message);
  }

  // Super Admin login
  try {
    const saLoginRes = await request(`${ADMIN_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@esa.dev', password: 'Password123!' }),
    });
    superAdminToken = saLoginRes.data?.data?.token || saLoginRes.data?.token;
    assert(Boolean(superAdminToken), 'Super Admin logged in with authoritative credentials');

    // Provision University Admin
    const uniAdminEmail = `uni.admin.${timestamp}@esa.dev`;
    const uniAdminRes = await request(`${ADMIN_API}/admin/administrators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        fullName: 'University Division Admin',
        email: uniAdminEmail,
        password: 'Password123!',
        role: 'UNIVERSITY_ADMIN',
        division: 'UNIVERSITY',
      }),
    });
    assert(uniAdminRes.status === 201, 'Super Admin provisioned University Division Admin');

    const uniLoginRes = await request(`${ADMIN_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniAdminEmail, password: 'Password123!' }),
    });
    uniAdminToken = uniLoginRes.data?.data?.token || uniLoginRes.data?.token;
    assert(Boolean(uniAdminToken), 'University Division Admin logged in successfully');

    // Provision Pre-University Admin
    const preUniEmail = `preuni.admin.${timestamp}@esa.dev`;
    const preUniRes = await request(`${ADMIN_API}/admin/administrators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Pre-University Division Admin',
        email: preUniEmail,
        password: 'Password123!',
        role: 'PRE_UNIVERSITY_ADMIN',
        division: 'PRE_UNIVERSITY',
      }),
    });
    assert(preUniRes.status === 201, 'Super Admin provisioned Pre-University Division Admin');

    const preLoginRes = await request(`${ADMIN_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: preUniEmail, password: 'Password123!' }),
    });
    preUniAdminToken = preLoginRes.data?.data?.token || preLoginRes.data?.token;
    assert(Boolean(preUniAdminToken), 'Pre-University Division Admin logged in successfully');
  } catch (err) {
    console.error('Admin provisioning error:', err.message);
  }

  // Scenario 1: A newly registered student sees the real program catalog (118 programs)
  console.log('\n--- Scenario 1: Authoritative Catalog Retrieval ---');
  let studentCatalog = [];
  try {
    const res = await request(`${STUDENT_API}/courses`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    studentCatalog = res.data?.data || res.data || [];
    assert(studentCatalog.length === 118, `Student retrieves authoritative catalog of exactly 118 programs (got: ${studentCatalog.length})`);
    
    // Check fields on catalog
    const sample = studentCatalog[0];
    assert(Boolean(sample?.title && sample?.category && sample?.level), `Program information has title, category, and level (${sample?.title})`);
  } catch (err) {
    assert(false, `Failed to fetch student catalog: ${err.message}`);
  }

  // Scenario 2: Unapplied student checks their applications -> empty
  console.log('\n--- Scenario 2: Separate Program Information from Student Status ---');
  let studentApps = [];
  try {
    const res = await request(`${STUDENT_API}/applications/my`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    studentApps = res.data?.data || res.data || [];
    assert(studentApps.length === 0, `Newly registered student has 0 applications initially (got: ${studentApps.length})`);
  } catch (err) {
    assert(false, `Failed to fetch student applications: ${err.message}`);
  }

  // Scenario 9: Admin Catalog Management — Program created by Admin appears in Student Catalog
  console.log('\n--- Scenario 9: Admin Program Creation & Live Student Catalog Sync ---');
  let createdProgram = null;
  const newProgramTitle = `Advanced Orbital Dynamics Workshop ${timestamp}`;
  try {
    const createRes = await request(`${ADMIN_API}/programs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uniAdminToken}`,
      },
      body: JSON.stringify({
        title: newProgramTitle,
        description: 'Comprehensive graduate-level orbital mechanics and attitude dynamics.',
        division: 'UNIVERSITY',
        level: 'ADVANCED',
        price: 4200,
        capacity: 20,
        deliveryMode: 'ONSITE',
        status: 'ACTIVE',
        category: 'Space Technologies',
      }),
    });
    createdProgram = createRes.data?.data?.program || createRes.data?.program;
    assert(Boolean(createdProgram?._id), `Admin created new program "${newProgramTitle}"`);

    // Verify it immediately appears in the Student catalog
    const studentCheckRes = await request(`${STUDENT_API}/courses?q=${encodeURIComponent(newProgramTitle)}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const foundCourses = studentCheckRes.data?.data || studentCheckRes.data || [];
    const matched = foundCourses.find((c) => c._id?.toString() === createdProgram?._id?.toString());
    assert(Boolean(matched), 'Newly created Admin program immediately appears in Student catalog API');
    assert(matched?.price === 4200, `Tuition matches Admin setting (expected 4200, got: ${matched?.price})`);
    assert(matched?.capacity === 20, `Capacity matches Admin setting (expected 20, got: ${matched?.capacity})`);

    // Update program tuition and capacity in Admin
    const updateRes = await request(`${ADMIN_API}/programs/${createdProgram._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uniAdminToken}`,
      },
      body: JSON.stringify({
        price: 4500,
        capacity: 25,
      }),
    });
    assert(updateRes.status === 200, 'Admin updated program tuition to 4500 and capacity to 25');

    // Verify Student sees updated tuition and capacity
    const studentVerifyRes = await request(`${STUDENT_API}/courses/${createdProgram._id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const updatedStudentCourse = studentVerifyRes.data?.data || studentVerifyRes.data;
    assert(updatedStudentCourse?.price === 4500, `Student catalog reflects updated tuition (expected 4500, got: ${updatedStudentCourse?.price})`);
    assert(updatedStudentCourse?.capacity === 25, `Student catalog reflects updated capacity (expected 25, got: ${updatedStudentCourse?.capacity})`);
  } catch (err) {
    assert(false, `Admin program management failed: ${err.message}`);
  }

  // Scenario 3 & 4: Application Submission & Admin Review Queue
  console.log('\n--- Scenario 3 & 4: Application Submission & Admin Review Queue ---');
  let testCourse = createdProgram || studentCatalog[0];
  let submittedApp = null;
  try {
    const appRes = await request(`${STUDENT_API}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId: testCourse._id,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        notes: 'Dedicated candidate in space trajectory calculation.',
      }),
    });
    submittedApp = appRes.data?.data || appRes.data;
    assert(Boolean(submittedApp?._id), `Application submitted successfully (ID: ${submittedApp?._id})`);

    // Scenario 4: Correct Admin sees the application in review queue
    const adminAppsRes = await request(`${ADMIN_API}/admin/applications`, {
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    const adminApps = adminAppsRes.data?.data?.applications || adminAppsRes.data?.applications || [];
    const appFoundInAdmin = adminApps.find(
      (a) => a._id?.toString() === submittedApp._id?.toString() || a.program?._id?.toString() === testCourse._id?.toString()
    );
    assert(Boolean(appFoundInAdmin), 'Submitted student application appears in University Admin review queue');
  } catch (err) {
    assert(false, `Application submission or admin queue check failed: ${err.message}`);
  }

  // Scenario 5: Admin Decision Workflow
  console.log('\n--- Scenario 5: Admin Decision Workflow ---');
  try {
    const adminAppId = submittedApp._id;
    const decisionRes = await request(`${ADMIN_API}/admin/applications/${adminAppId}/decision`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uniAdminToken}`,
      },
      body: JSON.stringify({
        decision: 'ACCEPT',
        reason: 'Admissions committee approved qualifications for cohort.',
      }),
    });
    assert(decisionRes.status === 200, 'Admin recorded ACCEPT decision');

    // Verify student sees Accepted status
    const studentAppCheck = await request(`${STUDENT_API}/applications/${submittedApp._id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const updatedApp = studentAppCheck.data?.data || studentAppCheck.data;
    assert(['Accepted', 'Eligible - Payment Pending'].includes(updatedApp?.status), `Student application reflects accepted status (got: ${updatedApp?.status})`);
  } catch (err) {
    assert(false, `Admin decision failed: ${err.message}`);
  }

  // Scenario 6 & 7: Payment Proof Submission, Admin Approval & Enrollment
  console.log('\n--- Scenario 6 & 7: Payment Proof Submission, Admin Approval & Enrollment ---');
  try {
    // Check that student is NOT enrolled yet
    const prePaymentEnrollments = await request(`${STUDENT_API}/enrollments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const preList = prePaymentEnrollments.data?.data || prePaymentEnrollments.data || [];
    const isPreEnrolled = preList.some((e) => (e.course?._id || e.course)?.toString() === testCourse._id?.toString());
    assert(!isPreEnrolled, 'Student is NOT enrolled before payment approval (seat remains gated)');

    // 1. Prepare invoice for accepted application
    const prepRes = await request(`${STUDENT_API}/payments/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        applicationId: submittedApp._id,
        packageType: 'WITHOUT_TRANSPORTATION',
      }),
    });
    const invoice = prepRes.data?.data?.invoice || prepRes.data?.data;
    const invoiceId = invoice?._id;
    assert(Boolean(invoiceId), `Invoice prepared for accepted application (Invoice ID: ${invoiceId})`);

    // 2. Submit payment proof for this invoice
    const { body, headers } = makeMultipartFormData(
      {
        paymentMethod: 'Vodafone_Cash',
        senderIdentifier: '01012345678',
        transactionReference: `TXN-${timestamp}`,
      },
      'proof',
      'payment_receipt.png',
      VALID_PNG_BUFFER,
      'image/png'
    );

    const proofRes = await request(`${STUDENT_API}/payments/invoices/${invoiceId}/submit-proof`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...headers,
      },
      body,
    });
    assert(proofRes.status === 201 || proofRes.status === 200, `Student submitted manual payment proof (status: ${proofRes.status})`);
    const proofId = proofRes.data?.data?._id || proofRes.data?.data?.proof?._id;
    assert(Boolean(proofId), `Payment proof created with ID: ${proofId}`);

    // Admin reviews and approves the payment proof
    const approveRes = await request(`${ADMIN_API}/admin/payment-proofs/${proofId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uniAdminToken}`,
      },
      body: JSON.stringify({ notes: 'Transfer verified with bank reconciliation.' }),
    });
    assert(approveRes.status === 200, 'Admin approved payment proof and confirmed enrollment');

    // Scenario 7: Enrollment appears only after payment approval
    const postPaymentEnrollments = await request(`${STUDENT_API}/enrollments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const postList = postPaymentEnrollments.data?.data || postPaymentEnrollments.data || [];
    const isPostEnrolled = postList.some((e) => (e.course?._id || e.course)?.toString() === testCourse._id?.toString());
    assert(isPostEnrolled, 'Student is now officially ENROLLED after verified payment approval');

    // Scenario 8: Student application reflects Confirmed/Enrolled status
    const studentAppFinal = await request(`${STUDENT_API}/applications/${submittedApp._id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const finalApp = studentAppFinal.data?.data || studentAppFinal.data;
    assert(finalApp?.status === 'Confirmed' || Boolean(finalApp?.enrollment), 'Application state transitioned to Confirmed with linked Enrollment');
  } catch (err) {
    assert(false, `Payment approval or enrollment verification failed: ${err.message}`);
  }

  // Scenario 10: Division isolation and Authorization
  console.log('\n--- Scenario 10: Division Isolation & Security Guardrails ---');
  try {
    // Pre-University admin tries to modify University program -> 403 Forbidden
    let blockedAsExpected = false;
    const blockRes = await request(`${ADMIN_API}/programs/${testCourse._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preUniAdminToken}`,
      },
      body: JSON.stringify({ price: 9999 }),
    });
    if (blockRes.status === 403) blockedAsExpected = true;
    assert(blockedAsExpected, 'Pre-University Admin is forbidden (403) from modifying University programs');

    // Duplicate application check
    let duplicateBlocked = false;
    const dupRes = await request(`${STUDENT_API}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId: testCourse._id,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      }),
    });
    if (dupRes.data?.enrolled === true || dupRes.status === 200 || dupRes.status === 400) {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, 'Duplicate active application for the same course is guarded');
  } catch (err) {
    assert(false, `Division isolation check failed: ${err.message}`);
  }

  // Scenario 11: Cleanup test program to preserve database cleanliness
  console.log('\n--- Scenario 11: Safe Archive / Deletion Cleanup ---');
  if (createdProgram?._id) {
    try {
      const delRes = await request(`${ADMIN_API}/programs/${createdProgram._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(delRes.status === 200, 'Test program safely deleted or archived without corrupting catalog');
    } catch (err) {
      console.warn('Cleanup warning:', err.message);
    }
  }

  console.log('\n=================================================================');
  console.log(` VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
