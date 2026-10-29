const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const PORT = 5500;

function httpRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buffer.toString('utf8'));
          } catch (_) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            body: json,
            text: buffer.toString('utf8'),
          });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

function jsonRequest({ method = 'GET', path, headers = {}, body = null }) {
  const payload = body ? JSON.stringify(body) : null;
  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  if (payload) {
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  return httpRequest({ method, path, headers: reqHeaders, body: payload });
}

function makeMultipartFormData({ fields = {}, files = [] }, boundary = '----TestBoundary' + Date.now()) {
  const parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`)
    );
  }
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.fieldname}"; filename="${f.filename}"\r\nContent-Type: ${f.mimetype}\r\n\r\n`
      )
    );
    parts.push(f.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(parts);
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
    },
    payload,
  };
}

const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('EGSA Academy: End-to-End Admin, Instructor, Student & Course Integration', async (t) => {
  let superAdminToken = null;
  let uniAdminToken = null;
  let preuniAdminToken = null;
  let studentAdminToken = null;
  let studentToken = null;
  let instAToken = null;
  let instBToken = null;
  let instCToken = null;

  let instructorAUser = null;
  let instructorBUser = null;
  let preuniInstructorUser = null;

  let createdCourse = null;
  let createdCourseId = null;
  let studentCourseId = null;
  let instructorCourseId = null;
  let testApplicationId = null;
  let testInvoiceId = null;

  const testSuffix = Date.now();
  const testStudentEmail = `cadet.integration.${testSuffix}@egsa.gov.eg`;

  // -------------------------------------------------------------------------
  // 1. Authentication & Multi-Role Discovery
  // -------------------------------------------------------------------------
  await t.test('1. Authentication & Multi-Role Setup', async () => {
    // 1a. Super Admin
    const saLogin = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    assert.equal(saLogin.status, 200, 'Super Admin login succeeded');
    superAdminToken = saLogin.body.token || saLogin.body.data?.token;
    assert.ok(superAdminToken, 'Super Admin token obtained');

    // 1b. University Admin
    const uaLogin = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'uni.admin@esa.dev', password: 'Password123!' },
    });
    assert.equal(uaLogin.status, 200, 'University Admin login succeeded');
    uniAdminToken = uaLogin.body.token || uaLogin.body.data?.token;
    assert.ok(uniAdminToken, 'University Admin token obtained');

    // 1c. Pre-University Admin
    const puaLogin = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
    });
    assert.equal(puaLogin.status, 200, 'Pre-University Admin login succeeded');
    preuniAdminToken = puaLogin.body.token || puaLogin.body.data?.token;
    assert.ok(preuniAdminToken, 'Pre-University Admin token obtained');

    // 1d. Student Module Admin
    const smaLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'admin@egsa-academy.example', password: 'AdminPass123!' },
    });
    assert.equal(smaLogin.status, 200, 'Student Admin login succeeded');
    studentAdminToken = smaLogin.body.token || smaLogin.body.data?.token;
    assert.ok(studentAdminToken, 'Student Admin token obtained');

    // 1e. Student Registration & Login
    const regPayload = {
      fullName: `Integration Cadet ${testSuffix}`,
      email: testStudentEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      agreeToTerms: true,
      phone: '010' + String(testSuffix).slice(-8),
      nationalId: '298' + String(testSuffix).slice(-11),
      division: 'UNIVERSITY',
      track: 'Space Technologies',
    };
    const regRes = await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: regPayload,
    });
    assert.equal(regRes.status, 201, 'Student registration succeeded');

    const studLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testStudentEmail, password: 'Password123!' },
    });
    assert.equal(studLogin.status, 200, 'Student login succeeded');
    studentToken = studLogin.body.data?.token || studLogin.body.token;
    assert.ok(studentToken, 'Student token obtained');

    // 1f. Instructor A Login (/api/v1/auth/login)
    const instALogin = await jsonRequest({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'uni.instructor@esa.dev', password: 'Instructor#Dev123' },
    });
    assert.equal(instALogin.status, 200, 'Instructor A login succeeded');
    instAToken = instALogin.body.data?.accessToken;
    assert.ok(instAToken, 'Instructor A access token obtained');

    // 1g. Instructor B Login (/api/v1/auth/login)
    const instBLogin = await jsonRequest({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'uni.instructor.b@esa.dev', password: 'Instructor#Dev123' },
    });
    assert.equal(instBLogin.status, 200, 'Instructor B login succeeded');
    instBToken = instBLogin.body.data?.accessToken;
    assert.ok(instBToken, 'Instructor B access token obtained');

    // 1h. Instructor C (Unassigned) Login (/api/v1/auth/login)
    const instCLogin = await jsonRequest({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
    });
    assert.equal(instCLogin.status, 200, 'Instructor C login succeeded');
    instCToken = instCLogin.body.data?.accessToken;
    assert.ok(instCToken, 'Instructor C access token obtained');

    // 1i. Locate Admin User documents for instructors via GET /admin-api/admin/instructors
    const instructorsListRes = await jsonRequest({
      method: 'GET',
      path: '/admin-api/admin/instructors',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(instructorsListRes.status, 200, 'Admin instructors list fetched');
    const instructorsList = instructorsListRes.body.data?.instructors || instructorsListRes.body.data || [];

    const getInstUser = (email) => {
      const item = instructorsList.find((i) => (i.user?.email || i.email) === email);
      if (!item) return null;
      const u = item.user || item;
      return {
        _id: u.id || u._id,
        id: u.id || u._id,
        profileId: item._id || item.id,
        fullName: u.fullName || u.name,
        email: u.email,
        division: u.division || item.division,
      };
    };

    instructorAUser = getInstUser('uni.instructor@esa.dev');
    instructorBUser = getInstUser('uni.instructor.b@esa.dev');
    preuniInstructorUser = getInstUser('instructor@esa.dev');

    assert.ok(instructorAUser, 'Instructor A user located in Admin DB');
    assert.ok(instructorBUser, 'Instructor B user located in Admin DB');
    assert.ok(preuniInstructorUser, 'Pre-University Instructor user located in Admin DB');
  });

  // -------------------------------------------------------------------------
  // 2. Admin Course Creation
  // -------------------------------------------------------------------------
  await t.test('2. Admin Creates Course in UNIVERSITY Division', async () => {
    const coursePayload = {
      title: `Orbital Mechanics & Satellite Dynamics ${testSuffix}`,
      code: `SAT-${String(testSuffix).slice(-4)}`,
      description: 'Advanced astrodynamics, trajectory analysis, and orbital maneuver optimization.',
      division: 'UNIVERSITY',
      level: 'ADVANCED',
      status: 'ACTIVE',
      capacity: 25,
      price: 600,
      currency: 'EGP',
      category: 'Space Technologies',
      deliveryMode: 'HYBRID',
      location: 'EGSA Space Academy Labs',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const createRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/programs',
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: coursePayload,
    });
    assert.equal(createRes.status, 201, 'Course created in UNIVERSITY division');
    createdCourse = createRes.body.data?.program || createRes.body.data;
    createdCourseId = createdCourse._id;
    assert.ok(createdCourseId, 'Course ID generated');
    assert.equal(createdCourse.division, 'UNIVERSITY');

    // Verify course in admin listing
    const listRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs?division=UNIVERSITY`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(listRes.status, 200);
    const programs = listRes.body.data?.programs || listRes.body.data || [];
    const found = programs.find((p) => p._id === createdCourseId);
    assert.ok(found, 'Created course present in admin programs list');
    assert.equal(found.enrolledCount, 0, 'Initial enrolled count is 0');
  });

  // -------------------------------------------------------------------------
  // 3. Server-Side Authorization & Division Validation on Instructor Assignment
  // -------------------------------------------------------------------------
  await t.test('3. Instructor Assignment Validation & Security Rules', async () => {
    // 3a. Rejection: Non-existent instructor ID
    const fakeId = '507f1f77bcf86cd799439011';
    const fakeAssignRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: { instructorId: fakeId },
    });
    assert.equal(fakeAssignRes.status, 404, 'Non-existent instructor assignment rejected with 404');

    // 3b. Rejection: Out-of-division instructor (PRE_UNIVERSITY instructor assigned to UNIVERSITY course)
    const outOfDivRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: { instructorId: preuniInstructorUser._id },
    });
    assert.equal(outOfDivRes.status, 400, 'Out-of-division instructor assignment rejected with 400');
    assert.ok(
      outOfDivRes.body.message.includes('PRE_UNIVERSITY') || outOfDivRes.body.message.includes('division'),
      'Clear validation error message for division mismatch'
    );

    // 3c. Rejection: Unauthorized user (Student) attempts to assign instructor
    const unauthAssignRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { instructorId: instructorAUser._id },
    });
    assert.ok([401, 403].includes(unauthAssignRes.status), 'Student cannot assign instructors (401/403)');

    // 3d. Success: Authorized University Admin assigns Instructor A
    const goodAssignRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: { instructorId: instructorAUser._id, reason: 'Initial Lead Faculty Assignment' },
    });
    assert.equal(goodAssignRes.status, 200, 'Instructor A assigned successfully');
    const updatedProgram = goodAssignRes.body.data?.program || goodAssignRes.body.data;
    assert.equal(
      String(updatedProgram.assignedInstructor?._id || updatedProgram.assignedInstructor),
      String(instructorAUser._id)
    );

    // 3e. Verify assigned instructor details via GET /admin-api/programs/:id
    const getProgRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${createdCourseId}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(getProgRes.status, 200);
    const progData = getProgRes.body.data?.program || getProgRes.body.data;
    assert.equal(progData.assignedInstructor?.email, 'uni.instructor@esa.dev');
    assert.equal(progData.enrolledCount, 0);

    // 3f. Dual-Identifier Contract: Assigning via InstructorProfile ID resolves to User ID
    const profileAssignRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: { instructorId: instructorAUser.profileId, reason: 'Profile ID Contract Verification' },
    });
    assert.equal(profileAssignRes.status, 200, 'Instructor assignment via Profile ID succeeded (200)');
    const progAssignedViaProfile = profileAssignRes.body.data?.program || profileAssignRes.body.data;
    assert.equal(
      String(progAssignedViaProfile.assignedInstructor?._id || progAssignedViaProfile.assignedInstructor),
      String(instructorAUser._id),
      'Profile ID resolved to authoritative User ID'
    );

    // 3g. Course listing filter works with both User ID and InstructorProfile ID
    const filterByUserRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs?instructorId=${instructorAUser._id}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(filterByUserRes.status, 200);
    const progsFilteredByUser = filterByUserRes.body.data?.programs || [];
    assert.ok(progsFilteredByUser.some((p) => p._id === createdCourseId), 'Found by User ID filter');

    const filterByProfileRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs?instructorId=${instructorAUser.profileId}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(filterByProfileRes.status, 200);
    const progsFilteredByProfile = filterByProfileRes.body.data?.programs || [];
    assert.ok(progsFilteredByProfile.some((p) => p._id === createdCourseId), 'Found by Profile ID filter');
  });

  // -------------------------------------------------------------------------
  // 4. Student Catalog Visibility & Multi-Database Synchronized State
  // -------------------------------------------------------------------------
  await t.test('4. Student Catalog & Multi-Database Synchronization', async () => {
    // 4a. Student queries catalog
    const studentCatalogRes = await jsonRequest({
      method: 'GET',
      path: '/api/courses',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentCatalogRes.status, 200, 'Student catalog fetched');
    const catalogCourses = studentCatalogRes.body.data || [];
    const courseInCatalog = catalogCourses.find(
      (c) => c._id === createdCourseId || c.title === createdCourse.title
    );
    assert.ok(courseInCatalog, 'Course is visible in student catalog');
    assert.equal(
      courseInCatalog.instructor,
      instructorAUser.fullName,
      'Synchronized instructor name matches Instructor A'
    );

    // 4b. Course details endpoint
    studentCourseId = courseInCatalog._id;
    const courseDetailRes = await jsonRequest({
      method: 'GET',
      path: `/api/courses/${studentCourseId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(courseDetailRes.status, 200);
    assert.equal(courseDetailRes.body.data.instructor, instructorAUser.fullName);
  });

  // -------------------------------------------------------------------------
  // 5. Student Application & Payment Approval Workflow
  // -------------------------------------------------------------------------
  await t.test('5. Student Application, Review & Payment Lifecycle', async () => {
    // 5a. Student submits application
    const appRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: studentCourseId,
        directEnroll: false,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        notes: 'Integration test application by cadet.',
      },
    });
    assert.equal(appRes.status, 201, 'Student application submitted');
    testApplicationId = (appRes.body.data || appRes.body)._id;
    assert.ok(testApplicationId, 'Application ID recorded');

    // 5b. Check application status and invoice issuance
    const currentApp = appRes.body.data;
    if (appRes.body.invoice?._id) {
      testInvoiceId = appRes.body.invoice._id;
    } else if (currentApp.invoice?._id || currentApp.invoice) {
      testInvoiceId = currentApp.invoice?._id || currentApp.invoice;
    } else {
      // If manual acceptance required
      const acceptRes = await jsonRequest({
        method: 'PATCH',
        path: `/api/admin/applications/${testApplicationId}/accept`,
        headers: { Authorization: `Bearer ${studentAdminToken}` },
        body: { note: 'Approved by Admissions Committee' },
      });
      assert.equal(acceptRes.status, 200, 'Application approved by Admin');
      testInvoiceId = acceptRes.body.data?.invoice?._id || acceptRes.body.invoice?._id;
    }
    assert.ok(testInvoiceId, 'Invoice issued for course tuition');

    // 5c. Student submits InstaPay / Bank payment proof
    const paymentProofMultipart = makeMultipartFormData({
      fields: {
        paymentMethod: 'InstaPay',
        senderIdentifier: 'cadet@egsa-instapay',
        transactionReference: `TRX-INST-${testSuffix}`,
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'instapay_receipt.png',
          mimetype: 'image/png',
          buffer: SAMPLE_PNG_BUFFER,
        },
      ],
    });
    const submitProofRes = await httpRequest({
      method: 'POST',
      path: `/api/payments/invoices/${testInvoiceId}/submit-proof`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...paymentProofMultipart.headers,
      },
      body: paymentProofMultipart.payload,
    });
    assert.equal(submitProofRes.status, 201, 'Payment proof submitted');
    const proofId = submitProofRes.body.data?._id;
    assert.ok(proofId, 'Payment proof ID recorded');

    // 5d. Admin approves payment proof -> establishes confirmed canonical enrollment
    const approvePaymentRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
    });
    assert.equal(approvePaymentRes.status, 200, 'Finance Admin approved payment proof');

    // Verify application status is now Confirmed
    const appStatusRes = await jsonRequest({
      method: 'GET',
      path: `/api/applications/${testApplicationId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(appStatusRes.status, 200);
    assert.equal(appStatusRes.body.data?.status, 'Confirmed');
    assert.ok(appStatusRes.body.data?.enrollment, 'Enrollment reference attached');
  });

  // -------------------------------------------------------------------------
  // 6. Student "My Courses" & Admin Enrollment Inspection
  // -------------------------------------------------------------------------
  await t.test('6. Student My Courses & Admin Enrollment Inspection', async () => {
    // 6a. Student My Enrollments
    const myEnrollmentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myEnrollmentsRes.status, 200, 'Student My Enrollments fetched');
    const enrollments = myEnrollmentsRes.body.data || [];
    const myEnrollment = enrollments.find(
      (e) => (e.course?._id || e.course) === studentCourseId
    );
    assert.ok(myEnrollment, 'Confirmed course enrollment present in Student portal');
    assert.ok(['Enrolled', 'Active', 'Confirmed'].includes(myEnrollment.status));
    assert.equal(myEnrollment.course?.instructor, instructorAUser.fullName);

    // 6b. Admin inspects course enrollments via GET /admin-api/programs/:id/enrollments
    const adminEnrRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${createdCourseId}/enrollments`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(adminEnrRes.status, 200, 'Admin can view course enrollments');
    const count6 = adminEnrRes.body.data?.enrolledCount ?? adminEnrRes.body.data?.total ?? adminEnrRes.body.data?.enrollments?.length;
    assert.equal(count6, 1, 'Actual enrolled count is 1');
    const enrolledStudents = adminEnrRes.body.data?.enrollments || [];
    assert.equal(enrolledStudents.length, 1);
    assert.equal(enrolledStudents[0].student?.email, testStudentEmail);
    assert.equal(enrolledStudents[0].status, 'CONFIRMED');

    // 6c. Admin program details reflects enrolledCount
    const progDetailRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${createdCourseId}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(progDetailRes.status, 200);
    const progData = progDetailRes.body.data?.program || progDetailRes.body.data;
    assert.equal(progData.enrolledCount, 1);
  });

  // -------------------------------------------------------------------------
  // 7. Instructor A Assigned Courses & Student Roster
  // -------------------------------------------------------------------------
  await t.test('7. Instructor A Portal: Assigned Courses & Student Roster', async () => {
    // 7a. Instructor A queries assigned courses
    const instCoursesRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/courses',
      headers: { Authorization: `Bearer ${instAToken}` },
    });
    assert.equal(instCoursesRes.status, 200, 'Instructor A courses fetched');
    const instCourses = instCoursesRes.body.data || [];
    const matchedInstCourse = instCourses.find(
      (c) => c.externalCourseId === createdCourseId || c.name === createdCourse.title
    );
    assert.ok(matchedInstCourse, 'Course is present in Instructor A assigned courses');
    instructorCourseId = matchedInstCourse._id;
    assert.ok(matchedInstCourse.assignedCohorts?.length > 0, 'Assigned cohorts present');

    // 7b. Instructor A queries single course details
    const singleCourseRes = await jsonRequest({
      method: 'GET',
      path: `/api/v1/instructor/courses/${instructorCourseId}`,
      headers: { Authorization: `Bearer ${instAToken}` },
    });
    assert.equal(singleCourseRes.status, 200, 'Instructor A can access course details');
    assert.equal(singleCourseRes.body.data.name, createdCourse.title);

    // 7c. Instructor A queries student roster
    const rosterRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/students',
      headers: { Authorization: `Bearer ${instAToken}` },
    });
    assert.equal(rosterRes.status, 200, 'Instructor A students fetched');
    const studentsList = rosterRes.body.data || [];
    const studentOnRoster = studentsList.find(
      (s) => s.student?.email === testStudentEmail
    );
    assert.ok(studentOnRoster, 'Enrolled student automatically appears in Instructor A roster');
    assert.equal(studentOnRoster.course?.name, createdCourse.title);
  });

  // -------------------------------------------------------------------------
  // 8. Security & Anti-IDOR Enforcement (Unassigned Instructor & Cross-Division Admin)
  // -------------------------------------------------------------------------
  await t.test('8. Anti-IDOR Protection & Division Isolation', async () => {
    // 8a. Anti-IDOR: Unassigned Instructor C attempts to access course details
    const idorCourseRes = await jsonRequest({
      method: 'GET',
      path: `/api/v1/instructor/courses/${instructorCourseId}`,
      headers: { Authorization: `Bearer ${instCToken}` },
    });
    assert.equal(idorCourseRes.status, 404, 'Unassigned Instructor receives 404 (Anti-IDOR)');

    // 8b. Anti-IDOR: Unassigned Instructor C cannot see student in their roster
    const idorStudentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/students',
      headers: { Authorization: `Bearer ${instCToken}` },
    });
    assert.equal(idorStudentsRes.status, 200);
    const cStudents = idorStudentsRes.body.data || [];
    const idorLeak = cStudents.find((s) => s.student?.email === testStudentEmail);
    assert.equal(idorLeak, undefined, 'Student does NOT appear in unassigned instructor roster');

    // 8c. Division Isolation: Pre-University Admin attempts to modify University course
    const preuniEditRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${preuniAdminToken}` },
      body: { instructorId: instructorBUser._id },
    });
    assert.equal(preuniEditRes.status, 403, 'Pre-University Admin blocked by division isolation (403)');
  });

  // -------------------------------------------------------------------------
  // 9. Course Reassignment from Instructor A to Instructor B
  // -------------------------------------------------------------------------
  await t.test('9. Admin Reassigns Course from Instructor A to Instructor B', async () => {
    // 9a. Reassign course to Instructor B
    const reassignRes = await jsonRequest({
      method: 'POST',
      path: `/admin-api/programs/${createdCourseId}/assign-instructor`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
      body: {
        instructorId: instructorBUser._id,
        reason: 'Curriculum faculty rotation to Dr. Tarek Orbital',
      },
    });
    assert.equal(reassignRes.status, 200, 'Reassignment to Instructor B succeeded');
    const reassignedProgram = reassignRes.body.data?.program || reassignRes.body.data;
    assert.equal(
      String(reassignedProgram.assignedInstructor?._id || reassignedProgram.assignedInstructor),
      String(instructorBUser._id)
    );

    // 9b. Verify updated assignment in Admin DB
    const adminCheckRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${createdCourseId}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(adminCheckRes.status, 200);
    const progData = adminCheckRes.body.data?.program || adminCheckRes.body.data;
    assert.equal(progData.assignedInstructor?.email, 'uni.instructor.b@esa.dev');
    assert.equal(progData.enrolledCount, 1, 'Enrolled count preserved at 1');
  });

  // -------------------------------------------------------------------------
  // 10. Roster Transfer & Historical Record Preservation
  // -------------------------------------------------------------------------
  await t.test('10. Roster Access Transferred to Instructor B & Revoked from Instructor A', async () => {
    // 10a. Instructor B now sees the assigned course
    const instBCoursesRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/courses',
      headers: { Authorization: `Bearer ${instBToken}` },
    });
    assert.equal(instBCoursesRes.status, 200);
    const bCourses = instBCoursesRes.body.data || [];
    const courseForB = bCourses.find(
      (c) => c._id === instructorCourseId || c.name === createdCourse.title
    );
    assert.ok(courseForB, 'Course is now visible to Instructor B');

    // 10b. Instructor B can access course details
    const bCourseDetailRes = await jsonRequest({
      method: 'GET',
      path: `/api/v1/instructor/courses/${instructorCourseId}`,
      headers: { Authorization: `Bearer ${instBToken}` },
    });
    assert.equal(bCourseDetailRes.status, 200, 'Instructor B can access course details');

    // 10c. Enrolled student now appears in Instructor B roster
    const bStudentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/students',
      headers: { Authorization: `Bearer ${instBToken}` },
    });
    assert.equal(bStudentsRes.status, 200);
    const bStudents = bStudentsRes.body.data || [];
    const studentForB = bStudents.find((s) => s.student?.email === testStudentEmail);
    assert.ok(studentForB, 'Enrolled student is now on Instructor B roster');

    // 10d. Instructor A's access is revoked (Anti-IDOR)
    const oldInstCourseRes = await jsonRequest({
      method: 'GET',
      path: `/api/v1/instructor/courses/${instructorCourseId}`,
      headers: { Authorization: `Bearer ${instAToken}` },
    });
    assert.equal(oldInstCourseRes.status, 404, 'Instructor A receives 404 for reassigned course');

    // 10e. Student no longer appears in Instructor A roster for this course
    const aStudentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/v1/instructor/students',
      headers: { Authorization: `Bearer ${instAToken}` },
    });
    assert.equal(aStudentsRes.status, 200);
    const aStudents = aStudentsRes.body.data || [];
    const leakedToA = aStudents.find(
      (s) => s.student?.email === testStudentEmail && s.course?.name === createdCourse.title
    );
    assert.equal(leakedToA, undefined, 'Student no longer appears in Instructor A roster for this course');
  });

  // -------------------------------------------------------------------------
  // 11. Student Portal & Admin Filter Consistency After Reassignment
  // -------------------------------------------------------------------------
  await t.test('11. Student Portal & Admin Filter Consistency Post-Reassignment', async () => {
    // 11a. Student views course details -> reflects new instructor
    const studentCourseRes = await jsonRequest({
      method: 'GET',
      path: `/api/courses/${studentCourseId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentCourseRes.status, 200);
    assert.equal(
      studentCourseRes.body.data.instructor,
      instructorBUser.fullName,
      'Student course details updated to reflect Instructor B'
    );

    // 11b. Student My Enrollments remains intact
    const myEnrollmentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myEnrollmentsRes.status, 200);
    const enrollments = myEnrollmentsRes.body.data || [];
    const found = enrollments.find(
      (e) => (e.course?._id || e.course) === studentCourseId
    );
    assert.ok(found, 'Student enrollment is preserved without interruption');
    assert.ok(['Enrolled', 'Active', 'Confirmed'].includes(found.status));

    // 11c. Admin queries programs filtered by Instructor B -> includes course
    const filterBRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs?instructorId=${instructorBUser._id}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(filterBRes.status, 200);
    const listB = filterBRes.body.data?.programs || filterBRes.body.data || [];
    assert.ok(
      listB.some((p) => p._id === createdCourseId),
      'Course found when filtering by Instructor B'
    );

    // 11d. Admin queries programs filtered by Instructor A -> does not include course
    const filterARes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs?instructorId=${instructorAUser._id}`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(filterARes.status, 200);
    const listA = filterARes.body.data?.programs || filterARes.body.data || [];
    assert.ok(
      !listA.some((p) => p._id === createdCourseId),
      'Course NOT found when filtering by Instructor A'
    );

    // 11e. Admin queries course enrollments -> student and payment data intact
    const finalAdminEnrRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${createdCourseId}/enrollments`,
      headers: { Authorization: `Bearer ${uniAdminToken}` },
    });
    assert.equal(finalAdminEnrRes.status, 200);
    const count11 = finalAdminEnrRes.body.data?.enrolledCount ?? finalAdminEnrRes.body.data?.total ?? finalAdminEnrRes.body.data?.enrollments?.length;
    assert.equal(count11, 1);
    const finalEnrList = finalAdminEnrRes.body.data?.enrollments || [];
    assert.equal(finalEnrList.length, 1);
    assert.equal(finalEnrList[0].student?.email, testStudentEmail);
    assert.equal(finalEnrList[0].status, 'CONFIRMED');
    assert.equal(finalEnrList[0].paymentStatus, 'PAID');
  });
});
