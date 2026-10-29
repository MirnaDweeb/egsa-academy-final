const http = require('http');

const PORT = 5500; // Live backend port
let testStudentEmail = `cadet.test.${Date.now()}@egsa.test`;
let testStudentPassword = 'TestPassword123!';
let createdStudentId = null;
let createdProfileId = null;

function request(path, { method = 'GET', body = null, token = null } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
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

let passed = 0;
let failed = 0;

function assert(condition, message, extra = '') {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`, extra ? JSON.stringify(extra) : '');
    failed++;
  }
}

async function run() {
  console.log('========================================================================');
  console.log(' VERIFYING STUDENT REGISTRATION TO ADMIN INTEGRATION FLOW');
  console.log('========================================================================\n');

  try {
    // 1. Register a brand new student via public Student Registration API
    console.log('Step 1: Registering new test student...');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Test Space Cadet',
        email: testStudentEmail,
        password: testStudentPassword,
        confirmPassword: testStudentPassword,
        phone: '01012345678',
        nationalId: `${Date.now()}`.padEnd(14, '0').slice(0, 14),
        status: 'student',
        university: 'Cairo Space Institute',
        faculty: 'Aerospace Engineering',
        agreeToTerms: true,
      },
    });

    assert(regRes.status === 201, 'Student registration returns 201 Created', regRes.data);
    assert(regRes.data?.data?.email === testStudentEmail, 'Response contains registered email');

    // 2. Student logs in to verify account credentials
    console.log('\nStep 2: Logging in as the newly registered student...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testStudentEmail,
        password: testStudentPassword,
      },
    });

    assert(loginRes.status === 200, 'Student login returns 200 OK', loginRes.data);
    const studentToken = loginRes.data?.data?.accessToken || loginRes.data?.token;
    assert(Boolean(studentToken), 'Student receives valid accessToken');

    // 3. Admin logs in (Super Admin)
    console.log('\nStep 3: Logging in as Super Admin...');
    const adminLoginRes = await request('/admin-api/auth/login', {
      method: 'POST',
      body: {
        email: 'superadmin@esa.dev',
        password: 'Password123!',
      },
    });

    assert(adminLoginRes.status === 200, 'Super Admin login returns 200 OK');
    const adminToken = adminLoginRes.data?.data?.token || adminLoginRes.data?.data?.accessToken;
    assert(Boolean(adminToken), 'Admin receives valid token');

    // 4. Admin lists students and verifies newly registered student appears
    console.log('\nStep 4: Admin listing students and checking for newly registered student...');
    const listRes = await request('/admin-api/admin/students?limit=50', {
      token: adminToken,
    });

    assert(listRes.status === 200, 'GET /admin-api/admin/students returns 200');
    const students = listRes.data?.data?.students || [];
    assert(students.length > 0, `Admin student list contains ${students.length} students`);

    const foundTestStudent = students.find((s) => s.user?.email === testStudentEmail);
    assert(Boolean(foundTestStudent), `Newly registered student (${testStudentEmail}) is present in Admin list!`);
    if (foundTestStudent) {
      createdProfileId = foundTestStudent._id;
      createdStudentId = foundTestStudent.user?._id || foundTestStudent.user?.id;
      assert(foundTestStudent.user?.fullName === 'Test Space Cadet', 'Student fullName is correct');
      assert(foundTestStudent.division === 'UNIVERSITY', 'Student division is correctly resolved to UNIVERSITY');
      assert(foundTestStudent.isActive === true, 'Student isActive status is true');
      assert(foundTestStudent.institution.includes('Cairo Space Institute'), 'Institution name is populated');
    }

    // 4b. Verify haidy@gmail.com is also visible in Admin
    console.log('\nStep 4b: Verifying haidy@gmail.com is visible in Admin...');
    const foundHaidy = students.find((s) => s.user?.email === 'haidy@gmail.com');
    assert(Boolean(foundHaidy), 'Existing student haidy@gmail.com is present in Admin student list!');
    if (foundHaidy) {
      assert(foundHaidy.division === 'UNIVERSITY', 'haidy division is UNIVERSITY');
      assert(foundHaidy.isActive === true, 'haidy isActive is true');
    }

    // 5. Admin search filtering
    console.log('\nStep 5: Testing Admin search filter...');
    const searchRes = await request(`/admin-api/admin/students?search=${encodeURIComponent(testStudentEmail)}`, {
      token: adminToken,
    });
    assert(searchRes.status === 200, 'Search query returns 200');
    const searchStudents = searchRes.data?.data?.students || [];
    assert(searchStudents.length === 1 && searchStudents[0].user?.email === testStudentEmail, 'Search by email returns exactly the target student');

    // 6. View Student Detail Dossier
    if (createdProfileId) {
      console.log('\nStep 6: Fetching student detail dossier...');
      const detailRes = await request(`/admin-api/admin/students/${createdProfileId}`, {
        token: adminToken,
      });
      assert(detailRes.status === 200, 'GET /admin-api/admin/students/:id returns 200');
      assert(detailRes.data?.data?.student?.user?.email === testStudentEmail, 'Detail response matches test student');

      const overviewRes = await request(`/admin-api/admin/students/${createdProfileId}/overview`, {
        token: adminToken,
      });
      assert(overviewRes.status === 200, 'GET /admin-api/admin/students/:id/overview returns 200');
      assert(Array.isArray(overviewRes.data?.data?.applications), 'Overview includes applications array');
      assert(Array.isArray(overviewRes.data?.data?.enrollments), 'Overview includes enrollments array');
    }

    // 7. Admin toggles Student status (Deactivate / Activate)
    if (createdProfileId) {
      console.log('\nStep 7: Testing Admin student deactivation & reactivation...');
      const deactRes = await request(`/admin-api/admin/students/${createdProfileId}/status`, {
        method: 'PATCH',
        body: { isActive: false, reason: 'Administrative test suspension' },
        token: adminToken,
      });
      assert(deactRes.status === 200, 'PATCH student status to inactive returns 200');
      assert(deactRes.data?.data?.student?.isActive === false, 'Student status reflected as inactive in response');

      // Verify student cannot login while deactivated
      const failedLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testStudentEmail, password: testStudentPassword },
      });
      assert(failedLogin.status === 403 || failedLogin.data?.error || failedLogin.data?.message?.includes('deactivated') || failedLogin.data?.message?.includes('inactive'), 'Deactivated student login rejected', failedLogin.data);

      // Reactivate
      const reactRes = await request(`/admin-api/admin/students/${createdProfileId}/status`, {
        method: 'PATCH',
        body: { isActive: true, reason: 'Reactivation test' },
        token: adminToken,
      });
      assert(reactRes.status === 200, 'PATCH student status to active returns 200');
      assert(reactRes.data?.data?.student?.isActive === true, 'Student status reflected as active');

      // Verify student can log in again
      const reloginRes = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testStudentEmail, password: testStudentPassword },
      });
      assert(reloginRes.status === 200, 'Reactivated student can log in successfully');
    }

    // 8. Division Isolation test
    console.log('\nStep 8: Testing Division Isolation...');
    // Login as Pre-University Admin
    const preUniAdminLogin = await request('/admin-api/auth/login', {
      method: 'POST',
      body: {
        email: 'preuni.admin@esa.dev',
        password: 'Password123!',
      },
    });

    if (preUniAdminLogin.status === 200) {
      const preUniToken = preUniAdminLogin.data?.data?.token || preUniAdminLogin.data?.data?.accessToken;
      // Pre-Uni Admin lists students - should NOT see University student
      const preUniList = await request('/admin-api/admin/students', { token: preUniToken });
      const preUniStudents = preUniList.data?.data?.students || [];
      const hasUniversityStudent = preUniStudents.some((s) => s.user?.email === testStudentEmail);
      assert(!hasUniversityStudent, 'Pre-University Admin CANNOT see University student in student list');

      // Pre-Uni Admin attempts to view University student detail directly -> 403 Forbidden
      if (createdProfileId) {
        const forbiddenDetail = await request(`/admin-api/admin/students/${createdProfileId}`, { token: preUniToken });
        assert(forbiddenDetail.status === 403, 'Pre-University Admin direct access to University student returns 403 Forbidden', forbiddenDetail.data);
      }
    } else {
      console.log('  (Skipping division admin specific check, preuni admin account check returned ' + preUniAdminLogin.status + ')');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Clean up synthetic test student
    if (createdStudentId) {
      console.log('\nCleaning up synthetic test student...');
      const { getStudentConn } = require('../src/config/database');
      const sConn = getStudentConn();
      try {
        await sConn.db.collection('users').deleteOne({ email: testStudentEmail });
        await sConn.db.collection('studentprofiles').deleteOne({ user: sConn.models.User ? require('mongoose').Types.ObjectId(createdStudentId) : createdStudentId });
        console.log('Cleaned up synthetic test student.');
      } catch (cleanErr) {
        // ignore
      }
    }
  }

  console.log('\n========================================================================');
  console.log(` VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

run();
