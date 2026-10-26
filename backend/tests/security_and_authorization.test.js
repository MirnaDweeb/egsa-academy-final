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

async function runSecurityAudit() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY DEEP SECURITY & AUTHORIZATION AUDIT');
  console.log(' Testing Least Privilege, IDOR Protection, and Anti-Tampering');
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

  // 1. Obtain tokens for all roles
  const sLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
  });
  const sToken = sLogin.json?.data?.token || sLogin.json?.token;

  const iLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const iToken = iLogin.json?.data?.accessToken;

  const daLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
  });
  const daToken = daLogin.json?.data?.token;

  // TEST 1: Student token blocked from Instructor endpoints
  console.log('[CATEGORY 1: CROSS-ROLE ACCESS CONTROL]');
  const sOnInstructor = await request('http://localhost:5500/api/v1/instructor/dashboard', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student token blocked from Instructor Dashboard (401/403)', sOnInstructor.status === 401 || sOnInstructor.status === 403);

  // TEST 2: Student token blocked from Admin endpoints
  const sOnAdmin = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student token blocked from Admin Gateway (401/403)', sOnAdmin.status === 401 || sOnAdmin.status === 403);

  // TEST 3: Instructor token blocked from Admin endpoints
  const iOnAdmin = await request('http://localhost:5500/admin-api/admin/gateway', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor token blocked from Admin Gateway (401/403)', iOnAdmin.status === 401 || iOnAdmin.status === 403);

  // TEST 4: Instructor IDOR protection: accessing foreign or nonexistent cohort returns 404 (anti-enumeration)
  console.log('\n[CATEGORY 2: IDOR & OWNERSHIP BOUNDARIES]');
  const foreignCohortId = '6acb302cd3311fced3e9e000'; // Non-owned cohort ID
  const iForeignCohort = await request(`http://localhost:5500/api/v1/instructor/cohorts/${foreignCohortId}/students`, {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor blocked from unassigned cohort roster (404 anti-enumeration)', iForeignCohort.status === 404);

  // TEST 5: Instructor IDOR protection: foreign submission evaluation
  const foreignSubId = '6acb302cd3311fced3e9e001';
  const iForeignGrade = await request(`http://localhost:5500/api/v1/instructor/submissions/${foreignSubId}/grade`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${iToken}`,
      'Content-Type': 'application/json',
    },
    body: { score: 90, feedback: 'Unauthorized attempt' },
  });
  assert('Instructor blocked from grading foreign submission (404)', iForeignGrade.status === 404);

  // TEST 6: Student cannot modify or resubmit once evaluation is published
  console.log('\n[CATEGORY 3: ACADEMIC INTEGRITY & ANTI-TAMPERING]');
  const iSubs = await request('http://localhost:5500/api/v1/instructor/submissions', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  const publishedSub = (iSubs.json?.data || []).find((s) => s.status === 'result_published');
  if (publishedSub) {
    const reGradeRes = await request(`http://localhost:5500/api/v1/instructor/submissions/${publishedSub._id}/grade`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${iToken}`,
        'Content-Type': 'application/json',
      },
      body: { score: 50, feedback: 'Tampering attempt on published grade' },
    });
    assert('Re-grading an already published result is blocked (409 Conflict)', reGradeRes.status === 409);
  } else {
    console.log('  [SKIP] No published submission found to test 409 protection.');
  }

  // TEST 7: Division Admin strict isolation
  console.log('\n[CATEGORY 4: DIVISION BOUNDARY ISOLATION]');
  const daUnivAccess = await request('http://localhost:5500/admin-api/admin/UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${daToken}` },
  });
  assert('Pre-University Admin blocked from University Division (403 Forbidden)', daUnivAccess.status === 403);

  const daPreUniAccess = await request('http://localhost:5500/admin-api/admin/PRE_UNIVERSITY/overview', {
    headers: { Authorization: `Bearer ${daToken}` },
  });
  assert('Pre-University Admin authorized on Pre-University Division (200 OK)', daPreUniAccess.status === 200);

  // TEST 8: Anti-replay protection on refreshed token
  console.log('\n[CATEGORY 5: AUTHENTICATION TOKEN REPLAY PROTECTION]');
  const iRefresh1 = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const refreshToken = iRefresh1.json?.data?.refreshToken;

  const rotate1 = await request('http://localhost:5500/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken },
  });
  assert('Initial token rotation succeeds (200)', rotate1.status === 200);

  const rotateReplay = await request('http://localhost:5500/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken },
  });
  assert('Replaying old refresh token is strictly rejected (401 Unauthorized)', rotateReplay.status === 401);

  console.log('\n========================================================================');
  console.log(` SECURITY & AUTHORIZATION AUDIT: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runSecurityAudit().catch(console.error);
