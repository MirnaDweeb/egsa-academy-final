const http = require('http');

async function request(url, options = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
}

async function runRoleWorkflows() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY REAL-DATA ROLE WORKFLOW VERIFICATION SUITE');
  console.log(' Target: Unified Backend at http://localhost:5500');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} ${details ? '- ' + JSON.stringify(details) : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. STUDENT ROLE WORKFLOW
  // -------------------------------------------------------------------------
  console.log('[ROLE 1: STUDENT FULL WORKFLOW]');
  const sLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
  });
  const sToken = sLogin.json?.data?.token || sLogin.json?.token;
  assert('Student Login', sLogin.status === 200 && !!sToken);

  const sMe = await request('http://localhost:5500/api/students/me', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Profile Query', sMe.status === 200 && (sMe.json?.data?.user?.email === 'sara.demo@egsa-academy.example' || sMe.json?.data?.email === 'sara.demo@egsa-academy.example'));

  const sCourses = await request('http://localhost:5500/api/courses', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Course Catalog Browsing', sCourses.status === 200 && Array.isArray(sCourses.json?.data?.courses || sCourses.json?.courses || sCourses.json?.data));

  const sApps = await request('http://localhost:5500/api/applications/my', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Applications Query', sApps.status === 200 && Array.isArray(sApps.json?.data?.applications || sApps.json?.applications || sApps.json?.data));

  const sPayments = await request('http://localhost:5500/api/payments/my', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Payments & Invoices Query', sPayments.status === 200);

  const sAttendance = await request('http://localhost:5500/api/attendance/summary', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Attendance Records Query', sAttendance.status === 200);

  const sAssessments = await request('http://localhost:5500/api/assessments', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Assessments Query', sAssessments.status === 200);

  const sCertificates = await request('http://localhost:5500/api/certificates/my', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Certificates Query', sCertificates.status === 200);

  const sLogout = await request('http://localhost:5500/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Logout', sLogout.status === 200);

  // -------------------------------------------------------------------------
  // 2. INSTRUCTOR ROLE WORKFLOW
  // -------------------------------------------------------------------------
  console.log('\n[ROLE 2: INSTRUCTOR FULL WORKFLOW]');
  const iLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const iAccess = iLogin.json?.data?.accessToken;
  const iRefresh = iLogin.json?.data?.refreshToken;
  assert('Instructor Login with Dual Tokens', iLogin.status === 200 && !!iAccess && !!iRefresh);

  const iSessions = await request('http://localhost:5500/api/v1/instructor/sessions', {
    headers: { Authorization: `Bearer ${iAccess}` },
  });
  const sessions = Array.isArray(iSessions.json?.data) ? iSessions.json?.data : iSessions.json?.data?.sessions;
  assert('Instructor Scheduled Sessions Query', iSessions.status === 200 && Array.isArray(sessions));
  const sid = sessions?.[0]?._id;

  if (sid) {
    const iAtt = await request(`http://localhost:5500/api/v1/instructor/attendance/sessions/${sid}`, {
      headers: { Authorization: `Bearer ${iAccess}` },
    });
    assert('Instructor Session Attendance Roster Query', iAtt.status === 200);
  }

  const iAssessments = await request('http://localhost:5500/api/v1/instructor/assessments', {
    headers: { Authorization: `Bearer ${iAccess}` },
  });
  assert('Instructor Assessments Query', iAssessments.status === 200);

  const iCohorts = await request('http://localhost:5500/api/v1/instructor/cohorts', {
    headers: { Authorization: `Bearer ${iAccess}` },
  });
  assert('Instructor Assigned Cohorts Query', iCohorts.status === 200 && Array.isArray(iCohorts.json?.data));

  const iConversations = await request('http://localhost:5500/api/v1/instructor/conversations', {
    headers: { Authorization: `Bearer ${iAccess}` },
  });
  assert('Instructor Messaging & Conversations Query', iConversations.status === 200);

  const iRotate = await request('http://localhost:5500/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken: iRefresh },
  });
  assert('Instructor Refresh Token Rotation', iRotate.status === 200 && !!iRotate.json?.data?.accessToken);

  const iLogout = await request('http://localhost:5500/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${iAccess}` },
  });
  assert('Instructor Logout', iLogout.status === 200);

  // -------------------------------------------------------------------------
  // 3. ADMIN ROLE WORKFLOW (SUPER ADMIN & DIVISION ADMIN)
  // -------------------------------------------------------------------------
  console.log('\n[ROLE 3: ADMIN & DIVISION ADMIN FULL WORKFLOW]');
  // Super Admin
  const saLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'superadmin@esa.dev', password: 'Password123!' },
  });
  const saToken = saLogin.json?.data?.token;
  assert('Super Admin Login', saLogin.status === 200 && !!saToken);

  const saGateway = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Super Admin Division Gateway', saGateway.status === 200 && Array.isArray(saGateway.json?.data?.divisions));

  const saApps = await request('http://localhost:5500/admin-api/admin/applications', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Applications Review Queue', saApps.status === 200 && Array.isArray(saApps.json?.data?.applications));

  const saPrograms = await request('http://localhost:5500/admin-api/programs', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Programs & Courses Directory', saPrograms.status === 200 && Array.isArray(saPrograms.json?.data?.programs));

  const saStudents = await request('http://localhost:5500/admin-api/admin/students', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Student Directory Query', saStudents.status === 200 && Array.isArray(saStudents.json?.data?.students));

  const saInstructors = await request('http://localhost:5500/admin-api/instructor/cohorts', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Instructor Cohorts Query', saInstructors.status === 200 && Array.isArray(saInstructors.json?.data?.cohorts));

  const saReports = await request('http://localhost:5500/admin-api/admin/reports/overview', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Reporting Overview', saReports.status === 200 && !!saReports.json?.data?.summary);

  const saFinance = await request('http://localhost:5500/admin-api/admin/reports/finance', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Financial Reports Query', saFinance.status === 200 && !!saFinance.json?.data?.summary);

  const saAudit = await request('http://localhost:5500/admin-api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  assert('Admin Immutable Audit Logs Query', saAudit.status === 200 && Array.isArray(saAudit.json?.data?.auditLogs));

  // Division Admin Scope Enforcement
  const daLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
  });
  const daToken = daLogin.json?.data?.token;
  assert('Pre-University Division Admin Login', daLogin.status === 200 && !!daToken);

  const daGatewayBlocked = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${daToken}` },
  });
  assert('Division Admin strictly rejected from Super Admin Gateway (403)', daGatewayBlocked.status === 403);

  const daUnivBlocked = await request('http://localhost:5500/admin-api/admin/UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${daToken}` },
  });
  assert('Division Admin strictly rejected from foreign University Division (403)', daUnivBlocked.status === 403);

  const daPreUniAllowed = await request('http://localhost:5500/admin-api/admin/PRE_UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${daToken}` },
  });
  assert('Division Admin authorized on own Pre-University Division (200)', daPreUniAllowed.status === 200);

  console.log('\n========================================================================');
  console.log(` ROLE WORKFLOW RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runRoleWorkflows().catch(console.error);
