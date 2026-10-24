const http = require('http');
const app = require('../src/app');
const { initDatabases, closeDatabases } = require('../src/config/database');

const TEST_PORT = 5590;
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

async function runTests() {
  console.log('=================================================================');
  console.log(' TESTING ADMIN MODULE IN UNIFIED BACKEND');
  console.log('=================================================================');

  await initDatabases();
  server = app.listen(TEST_PORT);
  console.log(`Test server running on port ${TEST_PORT}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '- ' + JSON.stringify(details) : ''}`);
      failed++;
    }
  }

  try {
    // 1. Admin Health check
    const health = await makeRequest('/admin-api/health');
    assert(health.status === 200 && health.data.success === true, 'GET /admin-api/health returns 200 UP', health.data);

    // 2. Unauthenticated access to /admin-api/admin/gateway rejected
    const unauth = await makeRequest('/admin-api/admin/gateway');
    assert(unauth.status === 401, 'GET /admin-api/admin/gateway rejected with 401 when token missing', unauth.data);

    // 3. Super Admin login
    const loginRes = await makeRequest('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    const d = loginRes.data?.data || loginRes.data;
    const token = d?.token || d?.accessToken;
    assert(loginRes.status === 200 && token, 'POST /admin-api/auth/login succeeds and returns token', { role: d?.user?.role });

    if (token) {
      // 4. Gateway access & metrics
      const gateway = await makeRequest('/admin-api/admin/gateway', { token });
      assert(gateway.status === 200 && Array.isArray(gateway.data?.data?.divisions), 'GET /admin-api/admin/gateway returns division cards array', { count: gateway.data?.data?.divisions?.length });

      // 5. Pre-University programs
      const preUniPrograms = await makeRequest('/admin-api/programs?division=PRE_UNIVERSITY', { token });
      assert(preUniPrograms.status === 200 && Array.isArray(preUniPrograms.data?.data?.programs), 'GET /admin-api/programs?division=PRE_UNIVERSITY returns array', { count: preUniPrograms.data?.data?.programs?.length });

      // 6. University programs
      const uniPrograms = await makeRequest('/admin-api/programs?division=UNIVERSITY', { token });
      assert(uniPrograms.status === 200 && Array.isArray(uniPrograms.data?.data?.programs), 'GET /admin-api/programs?division=UNIVERSITY returns array', { count: uniPrograms.data?.data?.programs?.length });

      // 7. Applications list for admin
      const apps = await makeRequest('/admin-api/admin/applications', { token });
      assert(apps.status === 200 && Array.isArray(apps.data?.data?.applications), 'GET /admin-api/admin/applications returns applications list', { count: apps.data?.data?.applications?.length });

      // 8. Administrator management (Super Admin lists administrators)
      const admins = await makeRequest('/admin-api/admin/administrators', { token });
      assert(admins.status === 200 && Array.isArray(admins.data?.data?.administrators), 'GET /admin-api/admin/administrators lists platform administrators', { count: admins.data?.data?.administrators?.length });
    }

    // 9. Pre-University Admin login & division boundary test
    const preUniLogin = await makeRequest('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
    });
    const preUniData = preUniLogin.data?.data || preUniLogin.data;
    const preUniToken = preUniData?.token || preUniData?.accessToken;

    if (preUniToken) {
      // Blocked from Gateway (Super Admin only)
      const gatewayBlocked = await makeRequest('/admin-api/admin/gateway', { token: preUniToken });
      assert(gatewayBlocked.status === 403, 'Pre-University Admin blocked from /admin-api/admin/gateway (403 Forbidden)', gatewayBlocked.data);

      // Blocked from University division overview
      const foreignDivisionBlocked = await makeRequest('/admin-api/admin/UNIVERSITY/overview', { token: preUniToken });
      assert(foreignDivisionBlocked.status === 403, 'Pre-University Admin blocked from foreign division /admin-api/admin/UNIVERSITY/overview (403 Forbidden)', foreignDivisionBlocked.data);

      // Permitted on Pre-University division overview
      const ownDivisionAllowed = await makeRequest('/admin-api/admin/PRE_UNIVERSITY/overview', { token: preUniToken });
      assert(ownDivisionAllowed.status === 200, 'Pre-University Admin permitted on own division overview /admin-api/admin/PRE_UNIVERSITY/overview (200 OK)', ownDivisionAllowed.data);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await closeDatabases();
  }

  console.log('=================================================================');
  console.log(`ADMIN MODULE VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
