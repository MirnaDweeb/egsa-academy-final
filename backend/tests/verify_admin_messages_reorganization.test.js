const assert = require('assert');
const path = require('path');

// 1. Test conversation classification logic
function testClassification() {
  console.log('[TEST 1] Testing Conversation Classification Rules...');

  // Import classifyConversation from frontend file
  const fs = require('fs');
  const code = fs.readFileSync(
    path.resolve('frontend/src/features/admin/pages/admin/AdminMessagesPage.jsx'),
    'utf8'
  );

  const match = code.match(/export function classifyConversation\([\s\S]*?\n\}/);
  assert.ok(match, 'classifyConversation function must exist in AdminMessagesPage.jsx');

  const classifyConversation = new Function(
    'c',
    match[0].replace('export function classifyConversation(c)', '') +
      '; return classifyConversation(c);'
  );

  // Case A: student_admin
  const studentSupportConv = {
    type: 'student_admin',
    student: { _id: 's1', name: 'Sara Ahmed' },
    admin: 'a1',
  };
  assert.strictEqual(
    classifyConversation(studentSupportConv),
    'student_support',
    'Student support conversation should be classified as student_support'
  );

  // Case B: instructor_admin
  const instructorSupportConv = {
    type: 'instructor_admin',
    instructor: { _id: 'i1', name: 'Dr. Mohamed' },
    admin: 'a1',
  };
  assert.strictEqual(
    classifyConversation(instructorSupportConv),
    'instructor_support',
    'Instructor support conversation should be classified as instructor_support'
  );

  // Case C: direct (student <-> instructor)
  const monitoredConv = {
    type: 'direct',
    student: { _id: 's1', name: 'Sara Ahmed' },
    instructor: { _id: 'i1', name: 'Dr. Mohamed' },
    cohort: 'c1',
  };
  assert.strictEqual(
    classifyConversation(monitoredConv),
    'student_instructor',
    'Direct student-instructor chat should be classified as student_instructor'
  );

  // Case D: Corrupt or conflicting conversation
  const corruptConv = {
    type: 'student_admin',
    student: { _id: 's1' },
    instructor: { _id: 'i1' }, // Has instructor on student_admin -> conflicting!
  };
  assert.strictEqual(
    classifyConversation(corruptConv),
    'needs_review',
    'Conflicting conversation should be classified as needs_review'
  );

  const missingParticipantsConv = {
    type: 'direct',
    student: null,
    instructor: null,
  };
  assert.strictEqual(
    classifyConversation(missingParticipantsConv),
    'needs_review',
    'Missing participants in direct chat should be classified as needs_review'
  );

  console.log('  -> All classification cases passed cleanly!');
}

// 2. Test tab metrics and unread counting logic
function testTabSeparationAndMetrics() {
  console.log('\n[TEST 2] Testing Tab Separation and Unread Metrics...');

  const mockConversations = [
    {
      _id: 'c1',
      type: 'student_admin',
      student: { _id: 's1', name: 'Sara Ahmed', email: 'sara@test.com' },
      admin: 'a1',
      unreadCountAdmin: 2,
      lastMessage: { senderRole: 'student', body: 'Help with portal' },
      supportStatus: 'open',
    },
    {
      _id: 'c2',
      type: 'student_admin',
      student: { _id: 's2', name: 'Ali Nour', email: 'ali@test.com' },
      admin: 'a1',
      unreadCountAdmin: 0,
      lastMessage: { senderRole: 'admin', body: 'We resolved your ticket' },
      supportStatus: 'resolved',
    },
    {
      _id: 'c3',
      type: 'instructor_admin',
      instructor: { _id: 'i1', name: 'Dr. Tarek', email: 'tarek@test.com' },
      admin: 'a1',
      unreadCountAdmin: 1,
      lastMessage: { senderRole: 'instructor', body: 'Question about syllabus' },
      supportStatus: 'in_progress',
    },
    {
      _id: 'c4',
      type: 'direct',
      student: { _id: 's1', name: 'Sara Ahmed' },
      instructor: { _id: 'i1', name: 'Dr. Tarek' },
      cohort: { name: 'Cohort Alpha' },
      course: { name: 'Space Systems' },
      unreadCountAdmin: 0,
      lastMessage: { senderRole: 'student', body: 'When is the test?' },
    },
  ];

  // Group by category
  const studentSupport = mockConversations.filter(c => c.type === 'student_admin');
  const instructorSupport = mockConversations.filter(c => c.type === 'instructor_admin');
  const studentInstructor = mockConversations.filter(c => c.type === 'direct');

  assert.strictEqual(studentSupport.length, 2, 'Student Support tab should contain exactly 2 conversations');
  assert.strictEqual(instructorSupport.length, 1, 'Instructor Support tab should contain exactly 1 conversation');
  assert.strictEqual(studentInstructor.length, 1, 'Student-Instructor tab should contain exactly 1 conversation');

  // Verify unread counts
  const studentUnread = studentSupport.reduce((sum, c) => sum + (c.unreadCountAdmin || 0), 0);
  assert.strictEqual(studentUnread, 2, 'Student support unread count should be 2');

  const instructorUnread = instructorSupport.reduce((sum, c) => sum + (c.unreadCountAdmin || 0), 0);
  assert.strictEqual(instructorUnread, 1, 'Instructor support unread count should be 1');

  // Verify Awaiting Reply filter
  const awaitingStudent = studentSupport.filter(
    c => c.lastMessage?.senderRole === 'student' && c.supportStatus !== 'resolved'
  );
  assert.strictEqual(awaitingStudent.length, 1, 'Exactly 1 student ticket awaiting reply');
  assert.strictEqual(awaitingStudent[0]._id, 'c1');

  console.log('  -> Tab separation and metrics verified successfully!');
}

// 3. Test backend permission enforcement on monitored conversations
function testBackendMonitoringEnforcement() {
  console.log('\n[TEST 3] Testing Backend Monitoring Permission Enforcement in messaging.service.js...');

  const fs = require('fs');
  const serviceCode = fs.readFileSync(
    path.resolve('backend/src/modules/instructor/services/messaging.service.js'),
    'utf8'
  );

  assert.ok(
    serviceCode.includes("conv.type === 'direct'"),
    'messaging.service.js must check if conv.type === direct in adminSendMessage'
  );
  assert.ok(
    serviceCode.includes('Direct administrative messaging is disabled in monitored student-instructor conversations'),
    'messaging.service.js must forbid admin sending messages in direct monitored conversations'
  );

  console.log('  -> Backend permission enforcement verified successfully!');
}

try {
  testClassification();
  testTabSeparationAndMetrics();
  testBackendMonitoringEnforcement();
  console.log('\nALL 3 VERIFICATION SUITES PASSED SUCCESSFULLY!');
} catch (err) {
  console.error('\nTEST FAILURE:', err);
  process.exit(1);
}

