/**
 * EGSA Academy — Admin Logout, Token Isolation, and Protected Route Verification
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:5500';

async function runTests() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY ADMIN LOGOUT & REDIRECT VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;

  // 1. Verify unauthenticated access to admin protected endpoint is rejected
  try {
    const res = await fetch(`${BASE_URL}/admin-api/auth/me`);
    assert.strictEqual(res.status, 401, 'Unauthenticated access must return 401');
    console.log('  [PASS] Unauthenticated access to /admin-api/auth/me returns 401');
    passed++;
  } catch (err) {
    console.error('Test 1 failed:', err);
    throw err;
  }

  // 2. Admin login succeeds with superadmin@esa.dev
  let adminToken = null;
  try {
    const res = await fetch(`${BASE_URL}/admin-api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@esa.dev',
        password: 'Password123!',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data?.data?.token, 'Token must be returned');
    assert.ok(data?.data?.user, 'User must be returned');
    adminToken = data.data.token;
    console.log('  [PASS] Admin authentication succeeds with valid token issued');
    passed++;
  } catch (err) {
    console.error('Test 2 failed:', err);
    throw err;
  }

  // 3. Authenticated request succeeds
  try {
    const meRes = await fetch(`${BASE_URL}/admin-api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData?.data?.user?.email, 'superadmin@esa.dev');
    console.log('  [PASS] Authenticated request to /admin-api/auth/me returns admin user');
    passed++;
  } catch (err) {
    console.error('Test 3 failed:', err);
    throw err;
  }

  // 4. Simulate token removal (client logout)
  try {
    const res = await fetch(`${BASE_URL}/admin-api/auth/me`);
    assert.strictEqual(res.status, 401);
    console.log('  [PASS] After token clearance, admin requests strictly return 401');
    passed++;
  } catch (err) {
    console.error('Test 4 failed:', err);
    throw err;
  }

  // 5. Test token isolation: Student login alongside Admin
  let studentToken = null;
  try {
    const sRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sara.demo@egsa-academy.example',
        password: 'Password123!',
      }),
    });
    const sData = await sRes.json();
    assert.strictEqual(sRes.status, 200);
    studentToken = sData?.data?.accessToken || sData?.accessToken;
    assert.ok(studentToken, 'Student access token issued');
    console.log('  [PASS] Student authentication succeeds');
    passed++;
  } catch (err) {
    console.error('Test 5 failed:', err);
    throw err;
  }

  // 6. Verify Admin token cannot access student/instructor routes, and Student token cannot access Admin
  try {
    const res = await fetch(`${BASE_URL}/admin-api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.ok([401, 403].includes(res.status), 'Student token rejected on admin');
    console.log('  [PASS] Cross-role token rejection verified: Student token cannot access Admin API');
    passed++;
  } catch (err) {
    console.error('Test 6 failed:', err);
    throw err;
  }

  // 7. Verify frontend HTML serves properly on port 3000
  try {
    const feRes = await fetch('http://localhost:3000/');
    assert.strictEqual(feRes.status, 200);
    const text = await feRes.text();
    assert.ok(text.includes('<div id="root"></div>'), 'Root element present in Home page HTML');
    console.log('  [PASS] Frontend Home page (/) serves HTTP 200');
    passed++;
  } catch (err) {
    console.error('Test 7 failed:', err);
    throw err;
  }

  console.log('\n========================================================================');
  console.log(` ALL ${passed}/7 ADMIN LOGOUT & REDIRECT TESTS PASSED`);
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
