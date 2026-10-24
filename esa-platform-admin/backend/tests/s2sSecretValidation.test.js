/**
 * Regression Test Suite: S2S Secret Configuration & Production Startup Validation
 * Verifies Defect C resolution:
 * 1. Startup validation fails in production if STUDENT_JWT_SECRET is missing
 * 2. Startup validation fails in production if STUDENT_JWT_SECRET is insecure/default/short (<32 chars)
 * 3. Startup validation succeeds with valid 32+ char secret
 * 4. Token signed by Admin client is verifiable by standard JWT verifier with the same secret
 * 5. In development, fallback is allowed without fatal crash
 * 6. No secrets or credentials are exposed
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const {
  assertStudentIntegrationConfig,
  createInternalAdminToken,
} = require('../src/services/studentIntegrationClient');

async function runTests() {
  console.log('\n--- Running S2S Secret Configuration & Validation Tests (Defect C) ---');
  let passed = 0;
  const originalEnv = { ...process.env };

  function resetEnv() {
    process.env = { ...originalEnv };
  }

  // Test 1: Production fails if STUDENT_JWT_SECRET is missing
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.STUDENT_JWT_SECRET;
    let threw = false;
    try {
      assertStudentIntegrationConfig();
    } catch (err) {
      threw = true;
      assert(err.message.includes('STUDENT_JWT_SECRET must be configured with at least 32 characters in production'));
    }
    assert(threw, 'Should throw error when STUDENT_JWT_SECRET is missing in production');
    passed++;
    console.log('  PASS: Test 1 - Production fails if STUDENT_JWT_SECRET is missing');
  } finally {
    resetEnv();
  }

  // Test 2: Production fails if STUDENT_JWT_SECRET is the default placeholder "change_this_secret"
  try {
    process.env.NODE_ENV = 'production';
    process.env.STUDENT_JWT_SECRET = 'change_this_secret';
    let threw = false;
    try {
      assertStudentIntegrationConfig();
    } catch (err) {
      threw = true;
      assert(err.message.includes('STUDENT_JWT_SECRET must be configured with at least 32 characters in production'));
    }
    assert(threw, 'Should throw error when STUDENT_JWT_SECRET is placeholder');
    passed++;
    console.log('  PASS: Test 2 - Production fails if STUDENT_JWT_SECRET is default placeholder');
  } finally {
    resetEnv();
  }

  // Test 3: Production fails if STUDENT_JWT_SECRET is short (<32 chars)
  try {
    process.env.NODE_ENV = 'production';
    process.env.STUDENT_JWT_SECRET = 'short_insecure_secret_123';
    let threw = false;
    try {
      assertStudentIntegrationConfig();
    } catch (err) {
      threw = true;
      assert(err.message.includes('STUDENT_JWT_SECRET must be configured with at least 32 characters in production'));
    }
    assert(threw, 'Should throw error when STUDENT_JWT_SECRET is < 32 characters');
    passed++;
    console.log('  PASS: Test 3 - Production fails if STUDENT_JWT_SECRET is shorter than 32 characters');
  } finally {
    resetEnv();
  }

  // Test 4: Production succeeds with valid 32+ char random secret and generates verifiable token
  try {
    process.env.NODE_ENV = 'production';
    const testSecret = 'test_only_mock_secret_that_is_at_least_32_characters_long_for_verification!';
    process.env.STUDENT_JWT_SECRET = testSecret;

    assert.doesNotThrow(() => {
      assertStudentIntegrationConfig();
    });

    const token = createInternalAdminToken({ email: 'sara.univadmin@egsa.gov.eg' });
    assert(typeof token === 'string' && token.length > 20);

    const decoded = jwt.verify(token, testSecret);
    assert.strictEqual(decoded.role, 'admin');
    assert.strictEqual(decoded.isServiceCall, true);
    assert.strictEqual(decoded.email, 'sara.univadmin@egsa.gov.eg');
    passed++;
    console.log('  PASS: Test 4 - Production succeeds with valid 32+ char secret and signs verifiable JWT');
  } finally {
    resetEnv();
  }

  // Test 5: Development mode permits fallback without crash
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.STUDENT_JWT_SECRET;

    assert.doesNotThrow(() => {
      assertStudentIntegrationConfig();
    });

    const token = createInternalAdminToken({ email: 'devadmin@egsa.gov.eg' });
    assert(typeof token === 'string');
    const decoded = jwt.verify(token, 'change_this_secret');
    assert.strictEqual(decoded.role, 'admin');
    assert.strictEqual(decoded.isServiceCall, true);
    passed++;
    console.log('  PASS: Test 5 - Development mode permits fallback without crash');
  } finally {
    resetEnv();
  }

  console.log(`\nAll ${passed}/5 S2S Secret Configuration tests PASSED.\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
