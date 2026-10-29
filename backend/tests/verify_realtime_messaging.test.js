const http = require('http');
const ioClient = require('socket.io-client');

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

function createSocket(token) {
  return ioClient('http://localhost:5500', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
}

function waitEventWithTimeout(socket, event, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

async function runMessagingVerification() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY CONTACT MESSAGING FINAL SCOPE VERIFICATION SUITE');
  console.log(' Scope: Student -> Admin, Instructor -> Admin, Admin bidirectional replies');
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

  // STEP 1: Log in all 3 roles
  console.log('[STEP 1: Authenticating All Three Roles via REST]');
  const sLogin = await request('http://localhost:5500/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
  });
  const sToken = sLogin.json?.data?.token || sLogin.json?.token;
  const studentUser = sLogin.json?.data?.user || sLogin.json?.user;
  assert('Student (Sara) Login', sLogin.status === 200 && !!sToken);

  const iLogin = await request('http://localhost:5500/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
  });
  const iToken = iLogin.json?.data?.accessToken;
  const instructorUser = iLogin.json?.data?.user;
  assert('Instructor Login', iLogin.status === 200 && !!iToken);

  const aLogin = await request('http://localhost:5500/admin-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'superadmin@esa.dev', password: 'Password123!' },
  });
  const aToken = aLogin.json?.data?.token;
  const adminUser = aLogin.json?.data?.user;
  assert('Admin Login', aLogin.status === 200 && !!aToken);

  if (!sToken || !iToken || !aToken) {
    console.error('Fatal: Cannot proceed without tokens for all three roles.');
    process.exit(1);
  }

  // Connect Sockets
  console.log('\n[Establishing Authenticated Real-Time Socket Connections]');
  const studentSocket = createSocket(sToken);
  const instructorSocket = createSocket(iToken);
  const adminSocket = createSocket(aToken);

  await Promise.all([
    new Promise((resolve) => studentSocket.on('connect', resolve)),
    new Promise((resolve) => instructorSocket.on('connect', resolve)),
    new Promise((resolve) => adminSocket.on('connect', resolve)),
  ]);

  assert('Student Socket connected to gateway', studentSocket.connected);
  assert('Instructor Socket connected to gateway', instructorSocket.connected);
  assert('Admin Socket connected to gateway', adminSocket.connected);

  // SCENARIO 1: Student opens Contact, sends a message to Admin, and receives Admin's reply
  console.log('\n[SCENARIO 1: Student -> Admin Contact & Real-Time Reply]');
  const sContactRes = await request('http://localhost:5500/api/messages/conversations/admin-support', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sToken}`,
    },
    body: { subject: 'Cadet Registration Inquiry' },
  });
  assert('Student opens Admin Contact conversation', sContactRes.status === 201 && !!sContactRes.json?.data?._id);
  const studentAdminConvId = sContactRes.json?.data?._id;

  await new Promise((res) => studentSocket.emit('conversation:join', { conversationId: studentAdminConvId }, res));
  await new Promise((res) => adminSocket.emit('conversation:join', { conversationId: studentAdminConvId }, res));

  const studentMsgText = `Student inquiry regarding satellite lab admission_${Date.now()}`;
  const adminReceivedStudentPromise = waitEventWithTimeout(adminSocket, 'message:new');

  const sMsgAck = await new Promise((res) => {
    studentSocket.emit('message:send', { conversationId: studentAdminConvId, body: studentMsgText }, res);
  });
  assert('Student message acknowledged by gateway', sMsgAck?.success === true);

  const adminReceivedStudent = await adminReceivedStudentPromise;
  assert(
    'Admin received Student message in real time',
    adminReceivedStudent?.conversationId === studentAdminConvId &&
    adminReceivedStudent?.message?.body === studentMsgText &&
    adminReceivedStudent?.message?.senderRole === 'student'
  );

  const adminReplyToStudentText = `Admin official response: Admission confirmed_${Date.now()}`;
  const studentReceivedAdminReplyPromise = waitEventWithTimeout(studentSocket, 'message:new');

  const aReplyStudentAck = await new Promise((res) => {
    adminSocket.emit('message:send', { conversationId: studentAdminConvId, body: adminReplyToStudentText }, res);
  });
  assert('Admin reply to Student acknowledged by gateway', aReplyStudentAck?.success === true);

  const studentReceivedAdminReply = await studentReceivedAdminReplyPromise;
  assert(
    'Student received Admin reply in real time',
    studentReceivedAdminReply?.conversationId === studentAdminConvId &&
    studentReceivedAdminReply?.message?.body === adminReplyToStudentText &&
    studentReceivedAdminReply?.message?.senderRole === 'admin'
  );

  // SCENARIO 2: Instructor opens Contact, sends a message to Admin, and receives Admin's reply
  console.log('\n[SCENARIO 2: Instructor -> Admin Contact & Real-Time Reply]');
  const iContactRes = await request('http://localhost:5500/api/v1/instructor/conversations/admin-support', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${iToken}`,
    },
    body: { subject: 'Faculty Curriculum Allocation' },
  });
  assert('Instructor opens Admin Contact conversation', iContactRes.status === 201 && !!iContactRes.json?.data?._id);
  const instructorAdminConvId = iContactRes.json?.data?._id;

  await new Promise((res) => instructorSocket.emit('conversation:join', { conversationId: instructorAdminConvId }, res));
  await new Promise((res) => adminSocket.emit('conversation:join', { conversationId: instructorAdminConvId }, res));

  const instructorMsgText = `Faculty inquiry regarding aerospace simulation quota_${Date.now()}`;
  const adminReceivedInstructorPromise = waitEventWithTimeout(adminSocket, 'message:new');

  const iMsgAck = await new Promise((res) => {
    instructorSocket.emit('message:send', { conversationId: instructorAdminConvId, body: instructorMsgText }, res);
  });
  assert('Instructor message acknowledged by gateway', iMsgAck?.success === true);

  const adminReceivedInstructor = await adminReceivedInstructorPromise;
  assert(
    'Admin received Instructor message in real time',
    adminReceivedInstructor?.conversationId === instructorAdminConvId &&
    adminReceivedInstructor?.message?.body === instructorMsgText &&
    adminReceivedInstructor?.message?.senderRole === 'instructor'
  );

  const adminReplyToInstructorText = `Admin response: Simulation compute quota extended_${Date.now()}`;
  const instructorReceivedAdminReplyPromise = waitEventWithTimeout(instructorSocket, 'message:new');

  const aReplyInstAck = await new Promise((res) => {
    adminSocket.emit('message:send', { conversationId: instructorAdminConvId, body: adminReplyToInstructorText }, res);
  });
  assert('Admin reply to Instructor acknowledged by gateway', aReplyInstAck?.success === true);

  const instructorReceivedAdminReply = await instructorReceivedAdminReplyPromise;
  assert(
    'Instructor received Admin reply in real time',
    instructorReceivedAdminReply?.conversationId === instructorAdminConvId &&
    instructorReceivedAdminReply?.message?.body === adminReplyToInstructorText &&
    instructorReceivedAdminReply?.message?.senderRole === 'admin'
  );

  // SCENARIO 3: Admin can distinguish Student and Instructor conversations and reply to correct person
  console.log('\n[SCENARIO 3: Admin Distinguishes Student vs Instructor Conversations]');
  const adminConvsRes = await request('http://localhost:5500/admin-api/messages/conversations', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert('Admin lists all support conversations', adminConvsRes.status === 200 && Array.isArray(adminConvsRes.json?.data));
  const allConvs = adminConvsRes.json?.data || [];

  const foundStudentConv = allConvs.find((c) => c._id === studentAdminConvId);
  const foundInstructorConv = allConvs.find((c) => c._id === instructorAdminConvId);

  assert('Admin identifies Student conversation with student_admin type', foundStudentConv && foundStudentConv.type === 'student_admin');
  assert('Admin identifies Instructor conversation with instructor_admin type', foundInstructorConv && foundInstructorConv.type === 'instructor_admin');

  // Filter test
  const filterStudentRes = await request('http://localhost:5500/admin-api/messages/conversations?type=student_admin', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  const filterStudentList = filterStudentRes.json?.data || [];
  assert('Admin filters for student_admin conversations', filterStudentList.every((c) => c.type === 'student_admin'));

  const filterInstRes = await request('http://localhost:5500/admin-api/messages/conversations?type=instructor_admin', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  const filterInstList = filterInstRes.json?.data || [];
  assert('Admin filters for instructor_admin conversations', filterInstList.every((c) => c.type === 'instructor_admin'));

  // SCENARIO 4: Both conversations persist after refreshing
  console.log('\n[SCENARIO 4: Durable Persistence Across Refreshes]');
  const studentHistory = await request(`http://localhost:5500/api/messages/conversations/${studentAdminConvId}/messages`, {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  const sMsgs = studentHistory.json?.data || [];
  const sHasSent = sMsgs.some((m) => m.body === studentMsgText && m.senderRole === 'student');
  const sHasReply = sMsgs.some((m) => m.body === adminReplyToStudentText && m.senderRole === 'admin');
  assert('Student Contact conversation persisted in DB after refresh', sHasSent && sHasReply);

  const instHistory = await request(`http://localhost:5500/api/v1/instructor/conversations/${instructorAdminConvId}/messages`, {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  const iMsgs = instHistory.json?.data || [];
  const iHasSent = iMsgs.some((m) => m.body === instructorMsgText && m.senderRole === 'instructor');
  const iHasReply = iMsgs.some((m) => m.body === adminReplyToInstructorText && m.senderRole === 'admin');
  assert('Instructor Contact conversation persisted in DB after refresh', iHasSent && iHasReply);

  // SCENARIO 5: A Student cannot initiate an Instructor conversation with an unassigned instructor (anti-IDOR)
  console.log('\n[SCENARIO 5: Student Cannot Initiate Unassigned Instructor Conversation (Anti-IDOR)]');
  const unassignedInstructorId = '507f1f77bcf86cd799439011';
  const blockedAttempt = await request('http://localhost:5500/api/messages/conversations/instructor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sToken}`,
    },
    body: { instructorId: unassignedInstructorId },
  });
  assert(
    'Student initiation of unassigned Instructor conversation blocked with 403 Forbidden',
    blockedAttempt.status === 403 && blockedAttempt.json?.success === false
  );

  const contactsRes = await request('http://localhost:5500/api/messages/contacts', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  const contactsData = contactsRes.json?.data;
  assert('Contacts endpoint provides Admin Support and eligible instructors list', contactsData?.support?.type === 'student_admin' && Array.isArray(contactsData?.instructors));

  // SCENARIO 6: Existing login, dashboards, payments, instructor features, and unrelated routes continue working
  console.log('\n[SCENARIO 6: Preserving Unrelated Features & Core Workflows]');
  const sDashboard = await request('http://localhost:5500/api/applications/my', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Applications / Dashboard route operational', sDashboard.status === 200);

  const sPayments = await request('http://localhost:5500/api/payments/my', {
    headers: { Authorization: `Bearer ${sToken}` },
  });
  assert('Student Payments route operational', sPayments.status === 200);

  const iDashboard = await request('http://localhost:5500/api/v1/instructor/dashboard', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor Dashboard route operational', iDashboard.status === 200);

  const iStudents = await request('http://localhost:5500/api/v1/instructor/students', {
    headers: { Authorization: `Bearer ${iToken}` },
  });
  assert('Instructor Students roster route operational', iStudents.status === 200);

  const aCohorts = await request('http://localhost:5500/admin-api/admin/cohorts', {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert('Admin Cohorts operational', aCohorts.status === 200);

  // Close sockets
  studentSocket.close();
  instructorSocket.close();
  adminSocket.close();

  console.log('\n========================================================================');
  console.log(` FINAL VERIFICATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMessagingVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
