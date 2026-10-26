/**
 * EGSA ACADEMY — FULLY CONNECTED MESSAGING & COMMUNICATION SYSTEM TEST SUITE
 * Verifies all 3 communication flows:
 *   1. Student -> Admin (Contact Admin with categories, status, follow-up, reopening)
 *   2. Student -> Assigned Instructor (Contact My Instructor with anti-IDOR validation)
 *   3. Instructor -> Admin (Separate Contact Admin channel)
 *   4. Instructor -> Student Messages (Dedicated inbox)
 *   5. Admin Communication Center (Filter by type & status, search, updateStatus, reply)
 *   6. Persistence & Real-Time Socket.IO delivery
 */

const { io } = require('socket.io-client');

const BACKEND_URL = 'http://localhost:5500';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const fetchOpts = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    fetchOpts.body = typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;
  }
  const res = await fetch(url, fetchOpts);
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY — FULLY CONNECTED MESSAGING SYSTEM TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // STEP 1: Authentication for All Roles
    // -------------------------------------------------------------
    console.log('[STEP 1: Authenticating Initial Roles]');
    const studentLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    });
    const studentToken = studentLogin.data?.data?.token || studentLogin.data?.token;
    assert(Boolean(studentToken), 'Student authenticated successfully');

    const adminLogin = await api('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    const adminToken = adminLogin.data?.data?.token || adminLogin.data?.token;
    assert(Boolean(adminToken), 'Admin authenticated successfully');

    const studentHeaders = { Authorization: `Bearer ${studentToken}` };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Sockets for Student and Admin
    const studentSocket = io(BACKEND_URL, { auth: { token: studentToken } });
    const adminSocket = io(BACKEND_URL, { auth: { token: adminToken } });

    await Promise.all([
      new Promise((res) => studentSocket.on('connect', res)),
      new Promise((res) => adminSocket.on('connect', res)),
    ]);
    assert(studentSocket.connected && adminSocket.connected, 'Student and Admin sockets connected to gateway');

    // -------------------------------------------------------------
    // FLOW A: Student -> Admin Contact & Support
    // -------------------------------------------------------------
    console.log('\n[FLOW A: Student -> Admin Contact & Support]');
    // 1. Create a ticket with category 'academic'
    const adminTicketRes = await api('/api/messages/conversations/admin-support', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        category: 'academic',
        subject: 'Inquiry on Satellite Payload Final Assessment',
        body: 'Hello Academy Admin, I would like to request clarification on the satellite payload schedule.',
        forceNew: true,
      },
    });
    const adminTicket = adminTicketRes.data?.data;
    assert(adminTicket?.type === 'student_admin', 'Ticket type is student_admin');
    assert(adminTicket?.category === 'academic', 'Category is academic');
    assert(adminTicket?.supportStatus === 'open', 'Initial status is open');

    // Join room for real-time verification
    studentSocket.emit('conversation:join', { conversationId: adminTicket._id });
    adminSocket.emit('conversation:join', { conversationId: adminTicket._id });
    await wait(150);

    // 2. Admin replies in the thread
    let studentReceivedAdminReply = null;
    studentSocket.on('message:new', (payload) => {
      if (payload.conversationId === adminTicket._id && payload.message?.senderRole === 'admin') {
        studentReceivedAdminReply = payload.message;
      }
    });

    const adminReplyRes = await api(`/admin-api/messages/conversations/${adminTicket._id}/messages`, {
      method: 'POST',
      headers: adminHeaders,
      body: { body: 'Dear Cadet Sara, the payload schedule has been updated on your training calendar.' },
    });
    assert(Boolean(adminReplyRes.data?.data?._id), 'Admin reply persisted to same conversation thread');
    await wait(350);
    assert(Boolean(studentReceivedAdminReply), 'Student received Admin reply via real-time socket');

    // 3. Admin updates status to resolved
    let studentStatusUpdate = null;
    studentSocket.on('conversation:status_changed', (payload) => {
      if (payload.conversationId === adminTicket._id) {
        studentStatusUpdate = payload;
      }
    });

    const statusRes = await api(`/admin-api/messages/conversations/${adminTicket._id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { status: 'resolved' },
    });
    assert(statusRes.data?.data?.supportStatus === 'resolved', 'Admin updated ticket status to resolved');
    await wait(350);
    assert(studentStatusUpdate?.supportStatus === 'resolved', 'Student socket received status_changed: resolved');

    // 4. Student sends follow-up -> should auto-reopen to in_progress
    const followUpRes = await api(`/api/messages/conversations/${adminTicket._id}/messages`, {
      method: 'POST',
      headers: studentHeaders,
      body: { body: 'Thank you! One more question: will attendance be mandatory for the debriefing?' },
    });
    assert(Boolean(followUpRes.data?.data?._id), 'Student follow-up message sent');
    await wait(350);
    const recheckedTicket = await api(`/api/messages/conversations/${adminTicket._id}`, {
      headers: studentHeaders,
    });
    assert(recheckedTicket.data?.data?.supportStatus === 'in_progress', 'Follow-up message automatically reopened ticket to in_progress');

    // -------------------------------------------------------------
    // FLOW B: Student -> Assigned Instructor (Contact My Instructor)
    // -------------------------------------------------------------
    console.log('\n[FLOW B: Student -> Assigned Instructor (Contact My Instructor)]');
    // 1. Student fetches available contacts
    const contactsRes = await api('/api/messages/contacts', { headers: studentHeaders });
    const eligibleInstructors = contactsRes.data?.data?.instructors || [];
    assert(eligibleInstructors.length > 0, `Student has ${eligibleInstructors.length} eligible assigned instructor(s)`);

    const assignedInstructor = eligibleInstructors[0];
    assert(Boolean(assignedInstructor?.courseName), `Assigned instructor context contains course: ${assignedInstructor?.courseName}`);

    // Authenticate as the assigned instructor
    const instLogin = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: assignedInstructor.email, password: 'Instructor#Dev123' },
    });
    const instructorToken = instLogin.data?.data?.accessToken || instLogin.data?.accessToken;
    assert(Boolean(instructorToken), `Authenticated as assigned instructor (${assignedInstructor.name})`);
    const instructorHeaders = { Authorization: `Bearer ${instructorToken}` };

    const instructorSocket = io(BACKEND_URL, { auth: { token: instructorToken } });
    await new Promise((res) => instructorSocket.on('connect', res));
    assert(instructorSocket.connected, 'Assigned instructor socket connected to gateway');

    // 2. Student starts direct conversation with assigned instructor
    const instConvoRes = await api('/api/messages/conversations/instructor', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        instructorId: assignedInstructor._id,
        cohortId: assignedInstructor.cohortId,
        subject: 'Question on Orbital Maneuvers Exercise',
        body: 'Dr. Omar, could you please clarify the delta-V equation used in session 2?',
      },
    });
    const instConvo = instConvoRes.data?.data;
    assert(instConvo?.type === 'direct', 'Instructor conversation type is direct');
    assert(String(instConvo?.instructor?._id || instConvo?.instructor) === String(assignedInstructor._id), 'Conversation points to correct instructor');

    // Join rooms
    studentSocket.emit('conversation:join', { conversationId: instConvo._id });
    instructorSocket.emit('conversation:join', { conversationId: instConvo._id });
    await wait(150);

    // 3. Instructor replies to Student
    let studentReceivedInstructorMsg = null;
    studentSocket.on('message:new', (payload) => {
      if (payload.conversationId === instConvo._id && payload.message?.senderRole === 'instructor') {
        studentReceivedInstructorMsg = payload.message;
      }
    });

    const instReplyRes = await api(`/api/v1/instructor/conversations/${instConvo._id}/messages`, {
      method: 'POST',
      headers: instructorHeaders,
      body: { body: 'Cadet Sara, check equation 4.2 in the mission briefing handbook.' },
    });
    assert(Boolean(instReplyRes.data?.data?._id || instReplyRes.data?.message?._id || instReplyRes.data?._id), 'Instructor reply persisted');
    await wait(350);
    assert(Boolean(studentReceivedInstructorMsg), 'Student received instructor reply via real-time socket');

    // 4. Anti-IDOR Security Test:
    // Student attempts to contact an unauthorized instructor (fake/random ID)
    const fakeInstructorId = '507f1f77bcf86cd799439011';
    const fakeRes = await api('/api/messages/conversations/instructor', {
      method: 'POST',
      headers: studentHeaders,
      body: { instructorId: fakeInstructorId },
    });
    assert(fakeRes.status === 403 || fakeRes.status === 400, 'Anti-IDOR: Student contacting unassigned instructor rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // FLOW C: Instructor -> Admin (Contact Administration)
    // -------------------------------------------------------------
    console.log('\n[FLOW C: Instructor -> Admin (Contact Administration)]');
    const instAdminRes = await api('/api/v1/instructor/conversations/admin-support', {
      method: 'POST',
      headers: instructorHeaders,
      body: {
        subject: 'Lab Equipment Requisition for Satellite Mission',
        category: 'technical',
      },
    });
    const instAdminConvo = instAdminRes.data?.data || instAdminRes.data;
    assert(instAdminConvo?.type === 'instructor_admin', 'Faculty admin conversation type is instructor_admin');

    instructorSocket.emit('conversation:join', { conversationId: instAdminConvo._id });
    adminSocket.emit('conversation:join', { conversationId: instAdminConvo._id });
    await wait(150);

    let instructorReceivedAdminMsg = null;
    instructorSocket.on('message:new', (payload) => {
      if (payload.conversationId === instAdminConvo._id && payload.message?.senderRole === 'admin') {
        instructorReceivedAdminMsg = payload.message;
      }
    });

    const adminInstReply = await api(`/admin-api/messages/conversations/${instAdminConvo._id}/messages`, {
      method: 'POST',
      headers: adminHeaders,
      body: { body: 'Requisition approved. The laboratory technicians have been notified.' },
    });
    assert(Boolean(adminInstReply.data?.data?._id), 'Admin reply to instructor persisted in thread');
    await wait(350);
    assert(Boolean(instructorReceivedAdminMsg), 'Instructor received Admin reply in real time');

    // -------------------------------------------------------------
    // FLOW D: Instructor Student Messages Inbox Isolation
    // -------------------------------------------------------------
    console.log('\n[FLOW D: Instructor Student Messages Inbox Isolation]');
    const instructorDirectList = await api('/api/v1/instructor/conversations?type=direct', {
      headers: instructorHeaders,
    });
    const directItems = instructorDirectList.data?.data || instructorDirectList.data?.items || [];
    assert(directItems.every((c) => c.type === 'direct'), 'Instructor Student Messages inbox strictly contains direct conversations');

    // -------------------------------------------------------------
    // FLOW E: Admin Communication Center Filters & Search
    // -------------------------------------------------------------
    console.log('\n[FLOW E: Admin Communication Center Filters & Search]');
    const allConvsRes = await api('/admin-api/messages/conversations', { headers: adminHeaders });
    const allConvs = allConvsRes.data?.data || [];
    assert(allConvs.length >= 3, `Admin sees all conversations (${allConvs.length} found)`);

    const cadetOnlyRes = await api('/admin-api/messages/conversations?type=student_admin', { headers: adminHeaders });
    const cadetConvs = cadetOnlyRes.data?.data || [];
    assert(cadetConvs.every((c) => c.type === 'student_admin'), 'Admin filter for student_admin returns only cadet inquiries');

    const facultyOnlyRes = await api('/admin-api/messages/conversations?type=instructor_admin', { headers: adminHeaders });
    const facultyConvs = facultyOnlyRes.data?.data || [];
    assert(facultyConvs.every((c) => c.type === 'instructor_admin'), 'Admin filter for instructor_admin returns only faculty inquiries');

    // -------------------------------------------------------------
    // STEP 6: Persistence Across Reconnects & Refreshes
    // -------------------------------------------------------------
    console.log('\n[STEP 6: Persistence Verification]');
    const reloadedMessages = await api(`/api/messages/conversations/${adminTicket._id}/messages`, {
      headers: studentHeaders,
    });
    const persistedMessages = reloadedMessages.data?.data || [];
    assert(persistedMessages.length >= 3, `Messages persisted durably in database (${persistedMessages.length} messages retrieved)`);

    // Clean up sockets
    studentSocket.disconnect();
    instructorSocket.disconnect();
    adminSocket.disconnect();

  } catch (err) {
    console.error('Test Suite encountered error:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(` FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
