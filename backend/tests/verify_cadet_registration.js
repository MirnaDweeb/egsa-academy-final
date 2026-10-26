const User = require('../src/modules/student/models/User');
const StudentProfile = require('../src/modules/student/models/StudentProfile');

const BASE_URL = 'http://127.0.0.1:5500';

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('--- STARTING EGSA CADET REGISTRATION VERIFICATION SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, JSON.stringify(details || ''));
      failed++;
    }
  }

  // 1. Empty required fields
  console.log('\nTest 1: Empty required fields');
  {
    const res = await postJson('/api/auth/register', {});
    assert(res.status === 400, 'Empty payload returns HTTP 400', res);
    assert(Array.isArray(res.data?.errors), 'Errors array returned', res.data);
    const fields = (res.data?.errors || []).map(e => e.field);
    assert(fields.includes('fullName'), 'Field error for fullName returned', fields);
    assert(fields.includes('email'), 'Field error for email returned', fields);
    assert(fields.includes('phone'), 'Field error for phone returned', fields);
    assert(fields.includes('nationalId'), 'Field error for nationalId returned', fields);
    assert(fields.includes('password'), 'Field error for password returned', fields);
  }

  // 2. Invalid email and mobile number
  console.log('\nTest 2: Invalid email and invalid mobile number');
  {
    const res = await postJson('/api/auth/register', {
      fullName: 'Test Cadet',
      email: 'not-an-email',
      phone: '12345',
      nationalId: '29901011234567',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student'
    });
    assert(res.status === 400, 'Invalid email/phone returns HTTP 400', res);
    const fields = (res.data?.errors || []).map(e => e.field);
    assert(fields.includes('email'), 'Field error for invalid email', fields);
    assert(fields.includes('phone'), 'Field error for invalid mobile number', fields);
  }

  // 3. National ID shorter and longer than 14 digits
  console.log('\nTest 3: National ID shorter or longer than 14 digits');
  {
    const resShort = await postJson('/api/auth/register', {
      fullName: 'Test Cadet',
      email: 'cadet.test3a@egsa.test',
      phone: '01012345678',
      nationalId: '1234567890123', // 13 digits
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student'
    });
    assert(resShort.status === 400, '13-digit National ID rejected with HTTP 400', resShort);
    const shortFields = (resShort.data?.errors || []).map(e => e.field);
    assert(shortFields.includes('nationalId'), 'Field error for short nationalId', shortFields);

    const resLong = await postJson('/api/auth/register', {
      fullName: 'Test Cadet',
      email: 'cadet.test3b@egsa.test',
      phone: '01012345678',
      nationalId: '123456789012345', // 15 digits
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student'
    });
    assert(resLong.status === 400, '15-digit National ID rejected with HTTP 400', resLong);
    const longFields = (resLong.data?.errors || []).map(e => e.field);
    assert(longFields.includes('nationalId'), 'Field error for long nationalId', longFields);
  }

  // 4. National ID string with leading zeros
  console.log('\nTest 4: National ID string with leading zeros');
  const leadingZeroCadet = {
    fullName: 'Cadet Leading Zero',
    email: `cadet.zero.${Date.now()}@egsa.test`,
    phone: '01123456789',
    nationalId: '01234567890123', // Starts with 0
    password: 'Password123!',
    confirmPassword: 'Password123!',
    status: 'student',
    university: 'Cairo Space University',
    faculty: 'Aerospace Systems',
    agreeToTerms: true,
  };
  {
    const res = await postJson('/api/auth/register', leadingZeroCadet);
    assert(res.status === 201, 'National ID with leading zeros accepted with HTTP 201', res);
    assert(res.data?.success === true, 'Success true returned');
    const dbUser = await User.findOne({ email: leadingZeroCadet.email.toLowerCase() });
    assert(dbUser?.nationalId === '01234567890123', 'National ID preserved as string with leading zero intact in database', dbUser?.nationalId);
  }

  // 5. Academic status options (unsupported rejected, valid status types accepted)
  console.log('\nTest 5: Academic status handling');
  {
    const resBad = await postJson('/api/auth/register', {
      fullName: 'Test Cadet',
      email: `cadet.badstatus.${Date.now()}@egsa.test`,
      phone: '01234567890',
      nationalId: '29901011234588',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'doctorate_candidate', // invalid
      agreeToTerms: true,
    });
    assert(resBad.status === 400, 'Unsupported status returns HTTP 400', resBad);
    const fields = (resBad.data?.errors || []).map(e => e.field);
    assert(fields.includes('status'), 'Field error for unsupported status', fields);

    // Test Practicing Engineer status
    const resEngineer = await postJson('/api/auth/register', {
      fullName: 'Engineer Cadet',
      email: `cadet.eng.${Date.now()}@egsa.test`,
      phone: '01512345678',
      nationalId: '29901011234599',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'practicing_engineer',
      agreeToTerms: true,
    });
    assert(resEngineer.status === 201, 'Practicing Engineer status accepted with HTTP 201', resEngineer);
  }

  // 6. Password and confirm-password mismatch
  console.log('\nTest 6: Password and confirm-password mismatch');
  {
    const res = await postJson('/api/auth/register', {
      fullName: 'Mismatch Cadet',
      email: `cadet.mismatch.${Date.now()}@egsa.test`,
      phone: '01099887766',
      nationalId: '29901011234500',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword456!',
      status: 'student',
      agreeToTerms: true,
    });
    assert(res.status === 400, 'Password mismatch returns HTTP 400', res);
    const fields = (res.data?.errors || []).map(e => e.field);
    assert(fields.includes('confirmPassword'), 'Field error for confirmPassword mismatch', fields);
  }

  // 7. Missing terms acceptance
  console.log('\nTest 7: Missing terms acceptance');
  {
    const res = await postJson('/api/auth/register', {
      fullName: 'NoTerms Cadet',
      email: `cadet.noterms.${Date.now()}@egsa.test`,
      phone: '01099887766',
      nationalId: '29901011234501',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student',
      agreeToTerms: false,
    });
    assert(res.status === 400, 'Missing terms returns HTTP 400', res);
    const fields = (res.data?.errors || []).map(e => e.field);
    assert(fields.includes('agreeToTerms'), 'Field error for agreeToTerms', fields);
  }

  // 8. Duplicate-account handling (HTTP 409 conflict)
  console.log('\nTest 8: Duplicate-account handling (409 Conflict)');
  {
    const duplicateRes = await postJson('/api/auth/register', {
      fullName: 'Duplicate Cadet',
      email: leadingZeroCadet.email, // existing email from test 4
      phone: '01055443322',
      nationalId: '29901011234502',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student',
      agreeToTerms: true,
    });
    assert(duplicateRes.status === 409, 'Duplicate email returns HTTP 409', duplicateRes);

    const duplicateIdRes = await postJson('/api/auth/register', {
      fullName: 'Duplicate ID Cadet',
      email: `unique.${Date.now()}@egsa.test`,
      phone: '01055443322',
      nationalId: leadingZeroCadet.nationalId, // existing national ID
      password: 'Password123!',
      confirmPassword: 'Password123!',
      status: 'student',
      agreeToTerms: true,
    });
    assert(duplicateIdRes.status === 409, 'Duplicate National ID returns HTTP 409', duplicateIdRes);
  }

  // 9. Valid registration request against real API
  console.log('\nTest 9: Valid registration request against real API');
  const validCadet = {
    fullName: 'Mahmoud Ahmed Al-Sayed',
    email: `mahmoud.cadet.${Date.now()}@egsa.test`,
    phone: '+201012345678', // Egyptian international format
    nationalId: '29812011234567',
    password: 'CadetSecurePass2026!',
    confirmPassword: 'CadetSecurePass2026!',
    status: 'student',
    university: 'Cairo University',
    faculty: 'Faculty of Engineering',
    agreeToTerms: true,
  };
  let registeredUser;
  {
    const res = await postJson('/api/auth/register', validCadet);
    assert(res.status === 201, 'Valid cadet registration returns HTTP 201', res);
    assert(res.data?.success === true, 'Response indicates success');
    assert(res.data?.data?.email === validCadet.email.toLowerCase(), 'User record created with correct email in response');
    const dbCadet = await User.findOne({ email: validCadet.email.toLowerCase() });
    assert(dbCadet?.role === 'student', 'User role correctly assigned as student in database');
    registeredUser = dbCadet;
  }

  // 10. Login after successful registration
  console.log('\nTest 10: Login flow after registration');
  {
    const loginRes = await postJson('/api/auth/login', {
      email: validCadet.email,
      password: validCadet.password
    });
    assert(loginRes.status === 200, 'Cadet can log in successfully with HTTP 200', loginRes);
    assert(loginRes.data?.success === true, 'Login response success: true');
    assert(typeof loginRes.data?.token === 'string' || typeof loginRes.data?.accessToken === 'string' || typeof loginRes.data?.data?.token === 'string', 'Authentication token returned');
  }

  // Clean up test records
  console.log('\nCleaning up synthetic test records from database...');
  try {
    const result = await User.deleteMany({ email: { $regex: /@egsa\.test$/ } });
    console.log(`Deleted ${result.deletedCount} synthetic test users.`);
    const profResult = await StudentProfile.deleteMany({ nationalId: { $in: ['01234567890123', '29901011234599', '29812011234567'] } });
    console.log(`Deleted ${profResult.deletedCount} synthetic student profiles.`);
  } catch (err) {
    console.warn('Note on cleanup:', err.message);
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
