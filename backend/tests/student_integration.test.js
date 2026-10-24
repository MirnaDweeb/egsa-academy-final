const http = require('http');
const app = require('../src/app');
const { initDatabases, closeDatabases } = require('../src/config/database');

const TEST_PORT = 5588;
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
  console.log(' TESTING STUDENT MODULE IN UNIFIED BACKEND');
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
    // 1. Health check
    const health = await makeRequest('/api/health');
    assert(health.status === 200 && health.data.success === true, 'GET /api/health returns 200 UP', health.data);

    // 2. Unauthenticated access to protected profile rejected
    const unauth = await makeRequest('/api/students/profile');
    assert(unauth.status === 401, 'GET /api/students/profile rejected with 401 when token missing', unauth.data);

    // 3. Student login
    const loginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    });
    assert(loginRes.status === 200 && (loginRes.data.data?.token || loginRes.data.token), 'POST /api/auth/login succeeds and returns JWT', { hasToken: !!(loginRes.data.data?.token || loginRes.data.token) });

    const studentToken = loginRes.data.data?.token || loginRes.data.token;

    if (studentToken) {
      // 4. Authenticated course catalog
      const courses = await makeRequest('/api/courses', { token: studentToken });
      assert(courses.status === 200 && Array.isArray(courses.data.data), 'GET /api/courses returns course catalog array', { count: courses.data?.data?.length });

      // 5. Authenticated profile lookup
      const profile = await makeRequest('/api/students/me', { token: studentToken });
      assert(profile.status === 200 && profile.data.data?.user?.email === 'sara.demo@egsa-academy.example', 'GET /api/students/me returns student profile', { email: profile.data?.data?.user?.email });

      // 6. Student applications
      const apps = await makeRequest('/api/applications/my', { token: studentToken });
      assert(apps.status === 200 && Array.isArray(apps.data.data), 'GET /api/applications/my returns applications array', { count: apps.data?.data?.length });

      // 7. Student payments
      const payments = await makeRequest('/api/payments/my', { token: studentToken });
      assert(payments.status === 200 && Array.isArray(payments.data.data), 'GET /api/payments/my returns invoices/payments array', { count: payments.data?.data?.length });

      // 8. Student attendance summary
      const attendance = await makeRequest('/api/attendance/summary', { token: studentToken });
      assert(attendance.status === 200 && attendance.data.success === true, 'GET /api/attendance/summary returns attendance record', attendance.data);

      // 9. Dashboard aggregates
      const dash = await makeRequest('/api/dashboard', { token: studentToken });
      assert(dash.status === 200, 'GET /api/dashboard returns student dashboard', dash.data);

      // 10. Role isolation: student blocked from student-admin routes
      const adminBlock = await makeRequest('/api/admin/payments/proofs/pending', { token: studentToken });
      assert(adminBlock.status === 403, 'POST/GET /api/admin/* blocked with 403 for student role', adminBlock.data);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await closeDatabases();
  }

  console.log('=================================================================');
  console.log(`STUDENT MODULE VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
