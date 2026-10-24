const http = require('http');
const app = require('../src/app');
const { initDatabases, closeDatabases } = require('../src/config/database');

const TEST_PORT = 5589;
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
  console.log(' TESTING INSTRUCTOR MODULE IN UNIFIED BACKEND');
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
    // 1. Instructor Health check
    const health = await makeRequest('/api/v1/health');
    assert(health.status === 200 && health.data.success === true, 'GET /api/v1/health returns 200 UP', health.data);

    // 2. Unauthenticated access rejected
    const unauth = await makeRequest('/api/v1/instructor/me');
    assert(unauth.status === 401, 'GET /api/v1/instructor/me rejected with 401 when token missing', unauth.data);

    // 3. Instructor login
    const loginRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
    });
    const d = loginRes.data?.data || loginRes.data;
    assert(loginRes.status === 200 && d?.accessToken && d?.refreshToken, 'POST /api/v1/auth/login succeeds and returns access + refresh tokens', { hasAccess: !!d?.accessToken, hasRefresh: !!d?.refreshToken });

    const accessToken = d?.accessToken;
    const refreshToken = d?.refreshToken;

    if (accessToken) {
      // 4. Authenticated me lookup
      const me = await makeRequest('/api/v1/auth/me', { token: accessToken });
      const meData = me.data?.data || me.data;
      assert(me.status === 200 && meData?.email === 'instructor@egsa-dev.test', 'GET /api/v1/auth/me returns instructor profile', { email: meData?.email });

      // 5. Dashboard aggregates
      const dash = await makeRequest('/api/v1/instructor/dashboard', { token: accessToken });
      assert(dash.status === 200, 'GET /api/v1/instructor/dashboard returns dashboard data', dash.data);

      // 6. Assigned courses
      const courses = await makeRequest('/api/v1/instructor/courses', { token: accessToken });
      assert(courses.status === 200, 'GET /api/v1/instructor/courses returns assigned courses', courses.data);

      // 7. Assigned cohorts
      const cohorts = await makeRequest('/api/v1/instructor/cohorts', { token: accessToken });
      assert(cohorts.status === 200, 'GET /api/v1/instructor/cohorts returns assigned cohorts', cohorts.data);

      // 8. Sessions list
      const sessions = await makeRequest('/api/v1/instructor/sessions', { token: accessToken });
      assert(sessions.status === 200, 'GET /api/v1/instructor/sessions returns sessions list', sessions.data);

      // 9. Refresh token rotation
      const refreshRes = await makeRequest('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      const refData = refreshRes.data?.data || refreshRes.data;
      assert(refreshRes.status === 200 && refData?.accessToken && refData?.refreshToken, 'POST /api/v1/auth/refresh rotates tokens successfully', { rotated: !!refData?.accessToken });

      // 10. Replay of old refresh token rejected with 401
      const replayRes = await makeRequest('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      assert(replayRes.status === 401, 'POST /api/v1/auth/refresh rejects rotated/replayed token with 401', replayRes.data);

      // 11. Logout invalidates the active session
      if (refData?.refreshToken) {
        const logoutRes = await makeRequest('/api/v1/auth/logout', {
          method: 'POST',
          token: refData.accessToken,
          body: { refreshToken: refData.refreshToken },
        });
        assert(logoutRes.status === 200, 'POST /api/v1/auth/logout succeeds', logoutRes.data);
      }
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await closeDatabases();
  }

  console.log('=================================================================');
  console.log(`INSTRUCTOR MODULE VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
