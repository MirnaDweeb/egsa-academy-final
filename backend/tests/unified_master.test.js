const http = require('http');
const app = require('../src/app');
const { initDatabases, closeDatabases } = require('../src/config/database');

const TEST_PORT = 5591;
let server;

function makeRequest(path, { method = 'GET', body = null, token = null } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        host: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, data: json });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runMasterSuite() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY UNIFIED BACKEND MASTER CROSS-PORTAL INTEGRATION SUITE');
  console.log('========================================================================');

  await initDatabases();
  server = app.listen(TEST_PORT);
  console.log(`Unified test server listening on port ${TEST_PORT}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '- ' + JSON.stringify(details) : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Unified Gateway Health & Multi-Database Status
    // -------------------------------------------------------------------------
    console.log('[SECTION 1] System Health & Database Multi-Pool Verification');
    const health = await makeRequest('/health');
    assert(health.status === 200, 'GET /health returns HTTP 200');
    assert(health.data.databases?.student === 'connected', 'Student Database (egsa_academy) pool connected');
    assert(health.data.databases?.instructor === 'connected', 'Instructor Database (egsa_instructor) pool connected');
    assert(health.data.databases?.admin === 'connected', 'Admin Database (esa_academy) pool connected');
    assert(health.data.apiPrefixes?.student === '/api', 'Student prefix mapped to /api');
    assert(health.data.apiPrefixes?.instructor === '/api/v1', 'Instructor prefix mapped to /api/v1');
    assert(health.data.apiPrefixes?.admin === '/admin-api', 'Admin prefix mapped to /admin-api');

    // -------------------------------------------------------------------------
    // 2. Student Portal Workflows (/api/*)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Student Portal Verification (/api/*)');
    const studentLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    });
    const sToken = studentLogin.data.data?.token || studentLogin.data.token;
    assert(studentLogin.status === 200 && sToken, 'Student login succeeds (sara.demo@egsa-academy.example)');

    const sProfile = await makeRequest('/api/students/me', { token: sToken });
    assert(sProfile.status === 200 && sProfile.data.data?.user?.email === 'sara.demo@egsa-academy.example', 'Student fetches own profile from egsa_academy DB');

    const sCourses = await makeRequest('/api/courses', { token: sToken });
    assert(sCourses.status === 200 && Array.isArray(sCourses.data.data), 'Student retrieves course catalog');

    const sApps = await makeRequest('/api/applications/my', { token: sToken });
    assert(sApps.status === 200 && Array.isArray(sApps.data.data), 'Student retrieves personal applications list');

    const sPayments = await makeRequest('/api/payments/my', { token: sToken });
    assert(sPayments.status === 200 && Array.isArray(sPayments.data.data), 'Student retrieves personal invoices/payments');

    const sAttendance = await makeRequest('/api/attendance/summary', { token: sToken });
    assert(sAttendance.status === 200 && sAttendance.data.success === true, 'Student retrieves attendance record summary');

    // -------------------------------------------------------------------------
    // 3. Instructor Portal Workflows (/api/v1/*)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Instructor Portal Verification (/api/v1/*)');
    const instLogin = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
    });
    const instData = instLogin.data?.data || instLogin.data;
    const iAccess = instData?.accessToken;
    const iRefresh = instData?.refreshToken;
    assert(instLogin.status === 200 && iAccess && iRefresh, 'Instructor login succeeds with dual tokens');

    const instMe = await makeRequest('/api/v1/auth/me', { token: iAccess });
    assert(instMe.status === 200 && (instMe.data?.data || instMe.data)?.email === 'instructor@egsa-dev.test', 'Instructor fetches profile from egsa_instructor DB');

    const instDash = await makeRequest('/api/v1/instructor/dashboard', { token: iAccess });
    assert(instDash.status === 200, 'Instructor retrieves scoped dashboard aggregates');

    const instCourses = await makeRequest('/api/v1/instructor/courses', { token: iAccess });
    assert(instCourses.status === 200 && Array.isArray(instCourses.data?.data || instCourses.data), 'Instructor retrieves assigned courses');

    const instSessions = await makeRequest('/api/v1/instructor/sessions', { token: iAccess });
    assert(instSessions.status === 200, 'Instructor retrieves scheduled sessions');

    // Token rotation test
    const rotateRes = await makeRequest('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: iRefresh },
    });
    const rotData = rotateRes.data?.data || rotateRes.data;
    assert(rotateRes.status === 200 && rotData?.accessToken, 'Instructor token rotation succeeds with new access token');

    const replayRes = await makeRequest('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: iRefresh },
    });
    assert(replayRes.status === 401, 'Anti-Replay: Old refresh token rejected with 401');

    // -------------------------------------------------------------------------
    // 4. Admin Portal Workflows (/admin-api/*)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] Admin Portal Verification (/admin-api/*)');
    const adminLogin = await makeRequest('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    const aData = adminLogin.data?.data || adminLogin.data;
    const aToken = aData?.token || aData?.accessToken;
    assert(adminLogin.status === 200 && aToken, 'Super Admin login succeeds from esa_academy DB');

    const gateway = await makeRequest('/admin-api/admin/gateway', { token: aToken });
    assert(gateway.status === 200 && gateway.data?.data?.divisions?.length === 2, 'Super Admin accesses Division Gateway with 2 divisions');

    const prePrograms = await makeRequest('/admin-api/programs?division=PRE_UNIVERSITY', { token: aToken });
    assert(prePrograms.status === 200 && Array.isArray(prePrograms.data?.data?.programs), 'Admin retrieves Pre-University programs');

    const uniPrograms = await makeRequest('/admin-api/programs?division=UNIVERSITY', { token: aToken });
    assert(uniPrograms.status === 200 && Array.isArray(uniPrograms.data?.data?.programs), 'Admin retrieves University programs');

    const adminApps = await makeRequest('/admin-api/admin/applications', { token: aToken });
    assert(adminApps.status === 200 && Array.isArray(adminApps.data?.data?.applications), 'Admin retrieves applications management queue');

    // Pre-University Admin Scope isolation
    const preUniLogin = await makeRequest('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
    });
    const preToken = (preUniLogin.data?.data || preUniLogin.data)?.token;
    assert(preUniLogin.status === 200 && preToken, 'Pre-University Admin login succeeds');

    const preBlockedFromGateway = await makeRequest('/admin-api/admin/gateway', { token: preToken });
    assert(preBlockedFromGateway.status === 403, 'Pre-University Admin blocked from Super Admin Gateway (403 Forbidden)');

    const preBlockedFromForeignDiv = await makeRequest('/admin-api/admin/UNIVERSITY/overview', { token: preToken });
    assert(preBlockedFromForeignDiv.status === 403, 'Pre-University Admin blocked from University Division (403 Forbidden)');

    const preAllowedOwnDiv = await makeRequest('/admin-api/admin/PRE_UNIVERSITY/overview', { token: preToken });
    assert(preAllowedOwnDiv.status === 200, 'Pre-University Admin allowed on Pre-University Division (200 OK)');

    // -------------------------------------------------------------------------
    // 5. Cross-Role Isolation & Anti-Tampering Security
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Cross-Role Isolation & Anti-Tampering Security');
    const sBlockFromInst = await makeRequest('/api/v1/instructor/dashboard', { token: sToken });
    assert(sBlockFromInst.status === 401 || sBlockFromInst.status === 403, 'Student token strictly rejected on Instructor API (401/403)');

    const sBlockFromAdmin = await makeRequest('/admin-api/admin/gateway', { token: sToken });
    assert(sBlockFromAdmin.status === 401 || sBlockFromAdmin.status === 403, 'Student token strictly rejected on Admin Gateway (401/403)');

    const iBlockFromStudentAdmin = await makeRequest('/api/admin/payments/proofs/pending', { token: iAccess });
    assert(iBlockFromStudentAdmin.status === 401 || iBlockFromStudentAdmin.status === 403, 'Instructor token strictly rejected on Student Admin (401/403)');

    const iBlockFromAdminGateway = await makeRequest('/admin-api/admin/gateway', { token: iAccess });
    assert(iBlockFromAdminGateway.status === 401 || iBlockFromAdminGateway.status === 403, 'Instructor token strictly rejected on Admin Gateway (401/403)');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await closeDatabases();
  }

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runMasterSuite();
