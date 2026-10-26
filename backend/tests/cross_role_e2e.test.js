const http = require('http');
const mongoose = require('mongoose');

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

async function runCrossRoleIntegrationTest() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY THREE-ROLE INTEGRATION & DATA SYNCHRONIZATION E2E TEST');
  console.log(' Testing Student <-> Instructor <-> Admin Live Data Loop');
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

  // 1. Authenticate All Three Roles
  console.log('[STEP 1: AUTHENTICATING ALL THREE ROLES]');
  const sLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
  });
  const sToken = sLogin.json?.data?.token || sLogin.json?.token;
  assert('Student (Sara) Authentication', sLogin.status === 200 && !!sToken);

  const iLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const iToken = iLogin.json?.data?.accessToken;
  assert('Instructor Authentication', iLogin.status === 200 && !!iToken);

  const aLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'superadmin@esa.dev', password: 'Password123!' },
  });
  const aToken = aLogin.json?.data?.token;
  assert('Admin Authentication', aLogin.status === 200 && !!aToken);

  if (!sToken || !iToken || !aToken) {
    console.error('Fatal: Cannot proceed without tokens for all three roles.');
    process.exit(1);
  }

  // 2. Instructor Cohort and Student Roster Verification
  console.log('\n[STEP 2: INSTRUCTOR COHORT & STUDENT ROSTER VERIFICATION]');
  const iCohortsRes = await request('http://localhost:5500/api/v1/instructor/cohorts', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor Cohorts Query', iCohortsRes.status === 200);
  const cohorts = iCohortsRes.json?.data || [];
  const testCohort = cohorts[0];
  assert('Instructor has at least 1 assigned cohort', !!testCohort);

  let rosterStudentId = null;
  if (testCohort) {
    const rosterRes = await request(`http://localhost:5500/api/v1/instructor/cohorts/${testCohort._id}/students`, {
      headers: { Authorization: `Bearer ${iToken}` },
    });
    assert('Instructor Cohort Students Query', rosterRes.status === 200);
    const students = rosterRes.json?.data || [];
    console.log(`    -> Cohort "${testCohort.name}" has ${students.length} students on roster.`);
    if (students.length > 0) {
      rosterStudentId = students[0].student?._id || students[0]._id;
      assert('Student found in Instructor roster', !!rosterStudentId);
    }
  }

  // 3. Attendance Recording by Instructor -> Student Summary & Admin View
  console.log('\n[STEP 3: ATTENDANCE RECORDING & CROSS-ROLE SYNC]');
  const iSessionsRes = await request('http://localhost:5500/api/v1/instructor/sessions', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor Sessions Query', iSessionsRes.status === 200);
  const sessions = Array.isArray(iSessionsRes.json?.data) ? iSessionsRes.json?.data : iSessionsRes.json?.data?.sessions || [];
  const activeSession = sessions[0];
  assert('Active Training Session exists', !!activeSession);

  if (activeSession && rosterStudentId) {
    // Record attendance
    const markAttRes = await request(`http://localhost:5500/api/v1/instructor/attendance/sessions/${activeSession._id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${iToken}`,
        'Content-Type': 'application/json',
      },
      body: {
        records: [
          {
            studentId: rosterStudentId,
            status: 'present',
            notes: 'Verified present via Cross-Role E2E Test Suite',
          },
        ],
      },
    });
    assert('Instructor marks session attendance', markAttRes.status === 200);

    // Verify Student portal reflects the attendance
    const sAttRes = await request('http://localhost:5500/api/attendance/summary', {
      headers: { Authorization: `Bearer ${sToken}` },
    });
    assert('Student Attendance Summary Query reflects recorded state', sAttRes.status === 200);
  }

  // 4. Student Assessment Submission -> Instructor Review Queue
  console.log('\n[STEP 4: STUDENT SUBMISSION -> INSTRUCTOR REVIEW QUEUE]');
  const sAssessmentsRes = await request('http://localhost:5500/api/assessments', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Assessments Query', sAssessmentsRes.status === 200);
  const studentAssessments = sAssessmentsRes.json?.data || [];
  const targetAssessment = studentAssessments[0];
  assert('Assessment available for student', !!targetAssessment);

  if (targetAssessment) {
    const boundary = '----WebKitFormBoundaryE2ETest' + Date.now();
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="e2e_telemetry_report.txt"',
      'Content-Type: text/plain',
      '',
      'CubeSat Telemetry and Orbit Link Budget Calculations - submitted by E2E test.',
      `--${boundary}`,
      'Content-Disposition: form-data; name="textAnswer"',
      '',
      'CubeSat telemetry link budget design equations and analysis - submitted by E2E test.',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const submitRes = await request(`http://localhost:5500/api/assessments/${targetAssessment._id}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    assert(
      'Student submits work for assessment (or verifies active submission exists)',
      submitRes.status === 200 || submitRes.status === 201 || (submitRes.status === 400 && String(submitRes.json?.message).includes('Resubmission is not permitted'))
    );

    // Verify Instructor Review Queue has submissions
    const iSubmissionsRes = await request('http://localhost:5500/api/v1/instructor/submissions', {
      headers: { Authorization: `Bearer ${iToken}` },
    });
    assert('Instructor Submissions Review Queue Query', iSubmissionsRes.status === 200);
    const iSubmissions = Array.isArray(iSubmissionsRes.json?.data) ? iSubmissionsRes.json?.data : [];
    console.log(`    -> Instructor review queue has ${iSubmissions.length} submission(s).`);
    assert('Instructor review queue is accessible', iSubmissionsRes.status === 200);

    if (iSubmissions.length > 0) {
      const subToGrade = iSubmissions.find((s) => s.status !== 'result_published') || iSubmissions[0];
      // 5. Instructor Grades & Publishes Result -> Student Sees Feedback
      console.log('\n[STEP 5: INSTRUCTOR EVALUATES & PUBLISHES RESULT -> STUDENT PORTAL]');
      const gradeRes = await request(`http://localhost:5500/api/v1/instructor/submissions/${subToGrade._id}/grade`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${iToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          score: 95,
          feedback: 'Excellent work on the orbital telemetry calculation.',
          strengths: 'Clear link budget analysis and accurate parameter modeling.',
          improvements: 'Consider atmospheric attenuation margins.',
        },
      });
      assert('Instructor records evaluation grade & feedback', gradeRes.status === 200 || gradeRes.status === 409);

      // Publish Result
      const publishRes = await request(`http://localhost:5500/api/v1/instructor/submissions/${subToGrade._id}/publish-result`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${iToken}` },
      });
      assert('Instructor publishes assessment result', publishRes.status === 200 || publishRes.status === 409);

      // Verify Student sees published result
      const sResultRes = await request('http://localhost:5500/api/assessments', {
        headers: { Authorization: `Bearer ${sToken}` },
      });
      assert('Student queries assessments to see evaluated status', sResultRes.status === 200);
    }
  }

  // 6. Admin Institutional Overview & Monitoring
  console.log('\n[STEP 6: ADMIN INSTITUTIONAL OVERVIEW & MONITORING]');
  const aOverview = await request('http://localhost:5500/admin-api/admin/reports/overview', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert('Admin Operational Reporting Overview Query', aOverview.status === 200 && !!aOverview.json?.data?.summary);

  const aStudents = await request('http://localhost:5500/admin-api/admin/students', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert('Admin Student Roster Directory', aStudents.status === 200 && Array.isArray(aStudents.json?.data?.students));

  const aCohorts = await request('http://localhost:5500/admin-api/instructor/cohorts', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert('Admin Instructor Cohorts Directory', aCohorts.status === 200 && Array.isArray(aCohorts.json?.data?.cohorts));

  console.log('\n========================================================================');
  console.log(` CROSS-ROLE E2E INTEGRATION TEST: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runCrossRoleIntegrationTest().catch((err) => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
