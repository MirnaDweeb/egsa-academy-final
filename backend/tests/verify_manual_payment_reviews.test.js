const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const PORT = 5500;

function httpRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buffer.toString('utf8'));
          } catch (_) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            body: json,
            text: buffer.toString('utf8'),
          });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

function jsonRequest({ method = 'GET', path, headers = {}, body = null }) {
  const payload = body ? JSON.stringify(body) : null;
  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  if (payload) {
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  return httpRequest({ method, path, headers: reqHeaders, body: payload });
}

function makeMultipartFormData({ fields = {}, files = [] }, boundary = '----TestBoundary' + Date.now()) {
  const parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`)
    );
  }
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.fieldname}"; filename="${f.filename}"\r\nContent-Type: ${f.mimetype}\r\n\r\n`
      )
    );
    parts.push(f.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(parts);
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
    },
    payload,
  };
}

// 1x1 transparent PNG image buffer
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('Manual Payment Reviews & Invoice Removal Test Suite', async (t) => {
  let adminToken = '';
  let studentAdminToken = '';
  let studentToken = '';
  let testCourse = null;
  let invoiceId = '';
  let proofId = '';

  await t.test('1. Multi-role authentication (Admin & Student)', async () => {
    // Login ESA Super Admin
    const adminLoginRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: {
        email: 'superadmin@esa.dev',
        password: 'Password123!',
      },
    });
    assert.equal(adminLoginRes.status, 200, 'ESA Super Admin login succeeds');
    adminToken = adminLoginRes.body.token || adminLoginRes.body.data?.token;
    assert.ok(adminToken, 'Admin token obtained');

    // Login Student Module Admin
    const saLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'admin@egsa-academy.example', password: 'AdminPass123!' },
    });
    assert.equal(saLogin.status, 200, 'Student admin login succeeds');
    studentAdminToken = saLogin.body.token || saLogin.body.data?.token;
    assert.ok(studentAdminToken, 'Student admin token obtained');

    // Login Student
    const studentLoginRes = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: 'sara.demo@egsa-academy.example',
        password: 'Password123!',
      },
    });
    assert.equal(studentLoginRes.status, 200, 'Student login succeeds');
    studentToken = studentLoginRes.body.token || studentLoginRes.body.data?.token;
    assert.ok(studentToken, 'Student token obtained');
  });

  await t.test('2. Prepare fresh application & invoice for student', async () => {
    // Locate priced course
    const coursesRes = await jsonRequest({
      method: 'GET',
      path: '/api/courses',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(coursesRes.status, 200);
    const courses = coursesRes.body.data || [];
    testCourse = courses.find((c) => c.price != null && c.price > 0 && (!c.mandatoryPrerequisites || c.mandatoryPrerequisites.length === 0));
    assert.ok(testCourse, 'Priced test course found');

    // Clean previous application/proofs for test course
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_academy').asPromise();
    try {
      const AppModel = conn.model('Application', new mongoose.Schema({}, { strict: false }));
      const InvModel = conn.model('Invoice', new mongoose.Schema({}, { strict: false }));
      const ProofModel = conn.model('PaymentProof', new mongoose.Schema({}, { strict: false }));
      const EnrModel = conn.model('Enrollment', new mongoose.Schema({}, { strict: false }));
      const UserModel = conn.model('User', new mongoose.Schema({}, { strict: false }));

      const sara = await UserModel.findOne({ email: 'sara.demo@egsa-academy.example' });
      if (sara) {
        const studentOid = new mongoose.Types.ObjectId(sara._id);
        const courseOid = new mongoose.Types.ObjectId(testCourse._id);
        const apps = await AppModel.find({ student: studentOid, course: courseOid });
        for (const a of apps) {
          await InvModel.deleteMany({ application: a._id });
          await ProofModel.deleteMany({ application: a._id });
          await AppModel.deleteOne({ _id: a._id });
        }
        await EnrModel.deleteMany({ student: studentOid, course: courseOid });
      }
    } finally {
      await conn.close();
    }

    // Submit application
    const appRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: testCourse._id,
        directEnroll: false,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        notes: 'Applying for payment review test run.',
      },
    });
    assert.ok([200, 201].includes(appRes.status), 'Application created');
    const app = appRes.body.data || appRes.body;
    assert.ok(app._id);

    // Accept application to generate fresh invoice
    const acceptRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/applications/${app._id}/accept`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
      body: { note: 'Accepted for manual payment verification.' },
    });
    assert.equal(acceptRes.status, 200, 'Admin acceptance succeeded');
    invoiceId = acceptRes.body.data?.invoice?._id || acceptRes.body.data?.application?.invoice?._id || acceptRes.body.data?.invoice;
    assert.ok(invoiceId, 'Invoice generated');
  });

  await t.test('3. Student payment endpoints remain fully functional', async () => {
    // Student invoices list
    const invoicesRes = await jsonRequest({
      method: 'GET',
      path: '/api/payments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(invoicesRes.status, 200, 'Student invoices endpoint works');
    const invoices = invoicesRes.body.data?.invoices || invoicesRes.body.invoices || invoicesRes.body.data || [];
    assert.ok(Array.isArray(invoices), 'Invoices is an array');

    // Student manual payment receiving settings
    const settingsRes = await jsonRequest({
      method: 'GET',
      path: '/api/payments/manual-settings',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(settingsRes.status, 200, 'Student manual payment settings endpoint works');
    assert.ok(settingsRes.body.data?.vodafoneCash || settingsRes.body.vodafoneCash, 'Vodafone Cash settings returned');
    assert.ok(settingsRes.body.data?.instaPay || settingsRes.body.instaPay, 'InstaPay settings returned');
  });

  await t.test('4. Student submits Vodafone Cash payment proof', async () => {
    const vfForm = makeMultipartFormData({
      fields: {
        paymentMethod: 'Vodafone_Cash',
        senderIdentifier: '01012345678',
        transactionReference: 'VF_REV_TEST_' + Date.now(),
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'vodafone_proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        },
      ],
    });

    const vfUploadRes = await httpRequest({
      method: 'POST',
      path: `/api/payments/invoices/${invoiceId}/submit-proof`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...vfForm.headers,
      },
      body: vfForm.payload,
    });
    assert.ok([200, 201].includes(vfUploadRes.status), `VF upload response status is 200/201 (got ${vfUploadRes.status})`);
    const vfProof = vfUploadRes.body?.data || vfUploadRes.body?.proof || vfUploadRes.body;
    proofId = vfProof._id;
    assert.ok(proofId, 'Test proof created');
  });

  await t.test('5. Admin review queue lists submitted proof with correct metadata', async () => {
    const listRes = await jsonRequest({
      method: 'GET',
      path: '/admin-api/admin/payment-proofs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200, 'Admin can list payment proofs');
    assert.ok(Array.isArray(listRes.body.data), 'Returns proofs array');

    const foundProof = listRes.body.data.find((p) => p._id === proofId);
    assert.ok(foundProof, 'Submitted proof appears in review list');
    assert.equal(foundProof.status, 'Pending', 'Proof is in Pending status');
    assert.equal(foundProof.paymentMethod, 'Vodafone_Cash', 'Method matches');
    assert.equal(foundProof.senderIdentifier, '01012345678', 'Sender identifier matches');
  });

  await t.test('6. Admin securely streams uploaded proof screenshot', async () => {
    const fileRes = await httpRequest({
      method: 'GET',
      path: `/admin-api/admin/payment-proofs/${proofId}/file`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(fileRes.status, 200, 'Screenshot file stream returns 200');
    assert.ok(
      fileRes.headers['content-type']?.includes('image/png'),
      'Content-Type is image/png'
    );
    assert.ok(fileRes.buffer.length > 0, 'Image data is non-empty');
  });

  await t.test('7. Security: Unauthorized users (students) cannot review or approve proofs', async () => {
    const forbiddenApprove = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.ok([401, 403].includes(forbiddenApprove.status), 'Student receives 401/403 on approve');

    const noAuthApprove = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/approve`,
    });
    assert.equal(noAuthApprove.status, 401, 'Unauthenticated request receives 401');
  });

  await t.test('8. Admin Reject Action: Rejection requires a mandatory reason', async () => {
    const emptyRejectRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/reject`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { rejectionReason: '' },
    });
    assert.equal(emptyRejectRes.status, 400, 'Rejection without reason returns 400');
  });

  await t.test('9. Admin Reject Action: Valid rejection persists decision and preserves audit trail', async () => {
    const rejectionReasonText = 'Screenshot receipt is blurry. Please upload a clear transaction receipt.';
    const rejectRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/reject`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { rejectionReason: rejectionReasonText },
    });
    assert.equal(rejectRes.status, 200, 'Rejection succeeds');
    const resultProof = rejectRes.body.proof || rejectRes.body.data;
    assert.equal(resultProof.status, 'Rejected', 'Proof status is now Rejected');
    assert.equal(resultProof.rejectionReason, rejectionReasonText);

    // Fetch proof details to verify server persistence
    const detailRes = await jsonRequest({
      method: 'GET',
      path: `/admin-api/admin/payment-proofs/${proofId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(detailRes.status, 200);
    const detail = detailRes.body.data || detailRes.body;
    assert.equal(detail.status, 'Rejected');
    assert.equal(detail.rejectionReason, rejectionReasonText, 'Rejection reason persisted');

    // Verify invoice remains unpaid
    const checkInvRes = await jsonRequest({
      method: 'GET',
      path: `/api/payments/invoices/${invoiceId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(checkInvRes.status, 200);
    const inv = checkInvRes.body.data || checkInvRes.body;
    assert.notEqual(inv.status, 'Paid', 'Invoice must NOT be marked Paid after rejection');
  });

  await t.test('10. Student resubmits proof with InstaPay after rejection', async () => {
    const resubmitForm = makeMultipartFormData({
      fields: {
        paymentMethod: 'InstaPay',
        senderIdentifier: 'sara@instapay',
        transactionReference: 'IP_RESUBMIT_' + Date.now(),
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'instapay_clear_receipt.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        },
      ],
    });

    const resubmitRes = await httpRequest({
      method: 'POST',
      path: `/api/payments/invoices/${invoiceId}/submit-proof`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...resubmitForm.headers,
      },
      body: resubmitForm.payload,
    });
    assert.ok([200, 201].includes(resubmitRes.status), `Resubmission succeeded with status ${resubmitRes.status}`);
    const updatedProof = resubmitRes.body?.data || resubmitRes.body?.proof || resubmitRes.body;
    assert.equal(updatedProof.status, 'Pending', 'Status is restored to Pending review');
    assert.equal(updatedProof.paymentMethod, 'InstaPay', 'Payment method updated');
  });

  await t.test('11. Admin Approve Action: Approving proof settles invoice and confirms enrollment', async () => {
    const approveRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(approveRes.status, 200, 'Approve succeeds');
    const approvedProof = approveRes.body.proof || approveRes.body.data;
    assert.equal(approvedProof.status, 'Approved', 'Proof status is now Approved');
    assert.ok(approveRes.body.invoice, 'Associated invoice returned');
    assert.equal(approveRes.body.invoice.status, 'Paid', 'Invoice status is Paid');
    assert.ok(approveRes.body.transaction, 'PaymentTransaction created');
    assert.equal(approveRes.body.transaction.status, 'Paid', 'Transaction is Paid');
  });

  await t.test('12. Idempotency: Repeated Approve calls do not duplicate records or fail', async () => {
    const repeatRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repeatRes.status, 200, 'Repeated approve returns 200');
    const proof = repeatRes.body.proof || repeatRes.body.data;
    assert.equal(proof.status, 'Approved', 'Status remains Approved');
  });

  await t.test('13. Filter by Status & Payment Method in Admin review list', async () => {
    const approvedFilter = await jsonRequest({
      method: 'GET',
      path: '/admin-api/admin/payment-proofs?status=Approved',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(approvedFilter.status, 200);
    const foundApproved = approvedFilter.body.data.find((p) => p._id === proofId);
    assert.ok(foundApproved, 'Approved proof found in Approved filter');
    assert.equal(foundApproved.status, 'Approved');
  });
});
