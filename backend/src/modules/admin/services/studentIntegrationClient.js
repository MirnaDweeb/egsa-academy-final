const http = require('http');
const jwt = require('jsonwebtoken');

function getStudentServiceUrl() {
  return process.env.STUDENT_SERVICE_URL || `http://localhost:${process.env.PORT || 5500}`;
}

function getStudentJwtSecret() {
  const secret = process.env.STUDENT_JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (
      !secret ||
      secret.length < 32 ||
      secret === 'change_this_secret' ||
      secret === 'replace_this_with_a_long_random_secret' ||
      secret === 'your_minimum_32_character_cryptographically_random_student_jwt_secret'
    ) {
      throw new Error(
        '[FATAL] STUDENT_JWT_SECRET must be configured with at least 32 characters in production for S2S communication with Student Backend. This must match the Student Backend JWT secret.'
      );
    }
    return secret;
  }
  return secret || 'change_this_secret';
}

function assertStudentIntegrationConfig() {
  if (process.env.NODE_ENV === 'production') {
    getStudentJwtSecret();
  }
}

/**
 * Creates a short-lived internal admin token for Student Backend requests.
 */
function createInternalAdminToken(adminUser = {}) {
  const secret = getStudentJwtSecret();
  // Use recognized admin id in egsa_academy: sara.univadmin@egsa.gov.eg
  const adminId = '6ad68d5b553bc1845e038644';
  return jwt.sign(
    {
      id: adminId,
      email: adminUser.email || 'admin@egsa-academy.example',
      role: 'admin',
      isServiceCall: true,
    },
    secret,
    { expiresIn: '5m' }
  );
}

/**
 * Makes an HTTP request to the student backend with internal authorization.
 */
function studentApiRequest({ method, path, query = {}, body = null, token = null, responseType = 'json' }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, getStudentServiceUrl());
    Object.keys(query).forEach((key) => {
      if (query[key] !== undefined && query[key] !== null) {
        url.searchParams.append(key, query[key]);
      }
    });

    const authToken = token || createInternalAdminToken();
    const headers = {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/json, image/*, */*',
    };

    let bodyData = null;
    if (body) {
      bodyData = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const options = {
      method: method.toUpperCase(),
      headers,
      timeout: 10000,
    };

    const req = http.request(url, options, (res) => {
      if (responseType === 'stream') {
        return resolve(res);
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Student service communication error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Student service request timed out'));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

module.exports = {
  createInternalAdminToken,
  studentApiRequest,
  assertStudentIntegrationConfig,
  getStudentJwtSecret,
};
