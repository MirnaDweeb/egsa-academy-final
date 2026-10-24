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

async function runPreCutoverAuditSuite() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY PHASE B.1 PRE-CUTOVER AUDIT & COMPATIBILITY TEST SUITE');
  console.log(' Target: Unified Backend at http://localhost:5500');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // --- SECTION 1: Health & Database Multi-Pool Isolation ---
  console.log('[SECTION 1] System Health & Multi-Database Connection Pools');
  const health = await request('http://localhost:5500/health');
  assert('GET /health returns HTTP 200', health.status === 200);
  assert('Student DB pool connected to egsa_academy', health.json?.databases?.student === 'connected');
  assert('Instructor DB pool connected to egsa_instructor', health.json?.databases?.instructor === 'connected');
  assert('Admin DB pool connected to esa_academy', health.json?.databases?.admin === 'connected');

  // --- SECTION 2: Original Backends Independent Health ---
  console.log('\n[SECTION 2] Original Independent Backends Non-Destructive Health');
  const sOrig = await request('http://localhost:5000/api/health');
  assert('Original Student Backend (Port 5000) is running and healthy', sOrig.status === 200);

  const iOrig = await request('http://localhost:5100/api/v1/health');
  assert('Original Instructor Backend (Port 5100) is running and healthy', iOrig.status === 200);

  const aOrig = await request('http://localhost:5200/api/health');
  assert('Original Admin Backend (Port 5200) is running and healthy', aOrig.status === 200);

  // --- SECTION 3: Authentication & Invalid Credential Rejection ---
  console.log('\n[SECTION 3] Authentication Compatibility & Invalid Credential Rejection');
  
  // Student Auth
  const sBadLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'WrongPassword123!' },
  });
  assert('Student invalid password rejected with 401', sBadLogin.status === 401);

  const sGoodLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
  });
  const studentToken = sGoodLogin.json?.data?.token || sGoodLogin.json?.token;
  assert('Student valid login succeeds with HTTP 200 & JWT', sGoodLogin.status === 200 && !!studentToken);

  // Instructor Auth
  const iBadLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'WrongPassword123!' },
  });
  assert('Instructor invalid password rejected with 401', iBadLogin.status === 401);

  const iGoodLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const instToken = iGoodLogin.json?.data?.accessToken;
  const instRefresh = iGoodLogin.json?.data?.refreshToken;
  assert('Instructor valid login succeeds with dual tokens', iGoodLogin.status === 200 && !!instToken && !!instRefresh);

  // Instructor Refresh Rotation & Anti-Replay
  const iRefresh1 = await request('http://localhost:5500/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken: instRefresh },
  });
  assert('Instructor token refresh rotation succeeds with HTTP 200', iRefresh1.status === 200 && iRefresh1.json?.data?.accessToken);

  const iRefreshReplay = await request('http://localhost:5500/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken: instRefresh },
  });
  assert('Anti-Replay: Old refresh token strictly rejected with 401', iRefreshReplay.status === 401);

  // Admin Auth
  const aBadLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'superadmin@esa.dev', password: 'WrongPassword123!' },
  });
  assert('Admin invalid password rejected with 401', aBadLogin.status === 401);

  const aGoodLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'superadmin@esa.dev', password: 'Password123!' },
  });
  const adminToken = aGoodLogin.json?.data?.token;
  assert('Super Admin login succeeds with HTTP 200 & JWT', aGoodLogin.status === 200 && !!adminToken);

  // Pre-University Admin
  const preUniLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
  });
  const preUniToken = preUniLogin.json?.data?.token;
  assert('Pre-University Admin login succeeds with HTTP 200', preUniLogin.status === 200 && !!preUniToken);

  // --- SECTION 4: Division Scoping & Privilege Enforcement ---
  console.log('\n[SECTION 4] Division Scoping & Privilege Boundaries');
  const superGateway = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Super Admin has access to Division Gateway (200 OK)', superGateway.status === 200 && Array.isArray(superGateway.json?.data?.divisions));

  const preUniGateway = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${preUniToken}` },
  });
  assert('Division Admin strictly blocked from Division Gateway (403 Forbidden)', preUniGateway.status === 403);

  const preUniCrossScope = await request('http://localhost:5500/admin-api/admin/UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${preUniToken}` },
  });
  assert('Pre-University Admin blocked from University Division resources (403 Forbidden)', preUniCrossScope.status === 403);

  const preUniInScope = await request('http://localhost:5500/admin-api/admin/PRE_UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${preUniToken}` },
  });
  assert('Pre-University Admin authorized for Pre-University resources (200 OK)', preUniInScope.status === 200);

  // --- SECTION 5: Cross-Role Isolation & Anti-Tampering ---
  console.log('\n[SECTION 5] Cross-Role Isolation & Anti-Tampering');
  const studentToInstructor = await request('http://localhost:5500/api/v1/instructor/dashboard', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('Student token rejected on Instructor API (401 Unauthorized)', studentToInstructor.status === 401);

  const studentToAdmin = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('Student token rejected on Admin Gateway (401 Unauthorized)', studentToAdmin.status === 401);

  const instructorToAdmin = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${instToken}` },
  });
  assert('Instructor token rejected on Admin Gateway (401 Unauthorized)', instructorToAdmin.status === 401);

  const forgedTokenAccess = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.signature' },
  });
  assert('Forged token rejected with 401 Unauthorized', forgedTokenAccess.status === 401);

  // --- SECTION 6: Uploads & Static Media Security ---
  console.log('\n[SECTION 6] Uploads Handling & Access Control');
  const pubMedia = await request('http://localhost:5500/uploads/media/egsa_sample_oscilloscope.svg');
  assert('Public institutional media returns HTTP 200', pubMedia.status === 200);

  const certNoAuth = await request('http://localhost:5500/uploads/certificates/egsa_cert_1790553608564_959072568.pdf');
  assert('Protected certificate rejected without token (HTTP 401)', certNoAuth.status === 401);

  const assessNoAuth = await request('http://localhost:5500/uploads/assessments/sample_instructions_1790600291950.pdf');
  assert('Protected assessment rejected without token (HTTP 401)', assessNoAuth.status === 401);

  // --- SECTION 7: Representative Read / Write Data Persistence ---
  console.log('\n[SECTION 7] Representative Read / Write Persistence Workflows');
  
  // Student Read
  const sProfile = await request('http://localhost:5500/api/students/me', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert('Student profile fetched successfully from egsa_academy DB', sProfile.status === 200 && (sProfile.json?.data?.user?.email === 'sara.demo@egsa-academy.example' || sProfile.json?.data?.email === 'sara.demo@egsa-academy.example'));

  // Admin Write & Read Verification
  const appList = await request('http://localhost:5500/admin-api/admin/applications?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Admin fetches applications queue from esa_academy DB', appList.status === 200 && Array.isArray(appList.json?.data?.applications));
  
  const appId = appList.json?.data?.applications[0]?._id;
  if (appId) {
    const noteText = `Pre-cutover audit note ${Date.now()}`;
    const addNote = await request(`http://localhost:5500/admin-api/admin/applications/${appId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: { note: noteText },
    });
    assert('Admin appends review note to application (Write)', addNote.status === 201);

    const checkApp = await request(`http://localhost:5500/admin-api/admin/applications/${appId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const hasNote = checkApp.json?.data?.application?.reviewNotes?.some((n) => n.note === noteText);
    assert('Appended note persisted and verified upon re-query (Read)', hasNote === true);
  }

  // Instructor Attendance Write & Read Verification
  const instSessions = await request('http://localhost:5500/api/v1/instructor/sessions?limit=1', {
    headers: { Authorization: `Bearer ${instToken}` },
  });
  const sessionsList = Array.isArray(instSessions.json?.data) ? instSessions.json?.data : instSessions.json?.data?.sessions;
  assert('Instructor fetches scheduled sessions from egsa_instructor DB', instSessions.status === 200 && Array.isArray(sessionsList));
  const sessionId = sessionsList?.[0]?._id;

  if (sessionId) {
    const attGet = await request(`http://localhost:5500/api/v1/instructor/attendance/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${instToken}` },
    });
    assert('Instructor retrieves session attendance record', attGet.status === 200);

    const studentId = attGet.json?.data?.roster?.[0]?.student?._id || '6acb302cd3311fced3e9e730';
    const attPut = await request(`http://localhost:5500/api/v1/instructor/attendance/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instToken}`,
      },
      body: {
        records: [
          {
            studentId,
            status: 'present',
            notes: 'Audit verification present',
          },
        ],
      },
    });
    assert('Instructor updates session attendance (Write)', attPut.status === 200);
  }

  console.log('\n========================================================================');
  console.log(` PRE-CUTOVER AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runPreCutoverAuditSuite().catch(console.error);
