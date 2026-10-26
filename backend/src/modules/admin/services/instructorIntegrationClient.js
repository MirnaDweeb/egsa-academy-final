const http = require('http');

function getInstructorServiceUrl() {
  return process.env.INSTRUCTOR_SERVICE_URL || `http://localhost:${process.env.PORT || 5500}`;
}
const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY;

if (process.env.NODE_ENV === 'production') {
  if (!INTEGRATION_API_KEY || INTEGRATION_API_KEY.length < 32) {
    throw new Error('[FATAL] INTEGRATION_API_KEY must be configured with at least 32 characters in production.');
  }
}

async function requestWithRetry(url, options, bodyData, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve) => {
        const req = http.request(url, options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            let parsed = null;
            try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              statusCode: res.statusCode,
              data: parsed,
            });
          });
        });

        req.on('error', (err) => {
          resolve({ success: false, error: err.message, networkError: true });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'TIMEOUT', networkError: true });
        });

        req.write(bodyData);
        req.end();
      });

      if (result.success || (!result.networkError && result.statusCode < 500)) {
        return result;
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      } else {
        return result;
      }
    } catch (err) {
      if (attempt >= maxRetries) return { success: false, error: err.message };
    }
  }
}

async function syncInstructorToPortal(payload) {
  try {
    const url = new URL('/api/v1/integration/instructors', getInstructorServiceUrl());
    const bodyData = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': INTEGRATION_API_KEY || '',
        'Content-Length': Buffer.byteLength(bodyData),
      },
      timeout: 5000,
    };

    const res = await requestWithRetry(url, options, bodyData, 1);
    if (!res.success) {
      console.warn('[S2S] Instructor sync incomplete:', res.error || `HTTP ${res.statusCode}`);
    }
    return res;
  } catch (err) {
    console.warn('[S2S] Error building instructor sync request:', err.message);
    return { success: false, error: err.message };
  }
}

async function syncCohortToPortal(payload) {
  try {
    const url = new URL('/api/v1/integration/cohorts', getInstructorServiceUrl());
    const bodyData = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': INTEGRATION_API_KEY || '',
        'Content-Length': Buffer.byteLength(bodyData),
      },
      timeout: 5000,
    };

    const res = await requestWithRetry(url, options, bodyData, 1);
    if (!res.success) {
      console.warn('[S2S] Cohort sync incomplete:', res.error || `HTTP ${res.statusCode}`);
    }
    return res;
  } catch (err) {
    console.warn('[S2S] Error building cohort sync request:', err.message);
    return { success: false, error: err.message };
  }
}

async function syncEnrollmentToPortal(payload) {
  try {
    const url = new URL('/api/v1/integration/enrollments', getInstructorServiceUrl());
    const bodyData = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': INTEGRATION_API_KEY || '',
        'Content-Length': Buffer.byteLength(bodyData),
      },
      timeout: 5000,
    };

    const res = await requestWithRetry(url, options, bodyData, 1);
    if (!res.success) {
      console.warn('[S2S] Enrollment sync incomplete:', res.error || `HTTP ${res.statusCode}`);
    }
    return res;
  } catch (err) {
    console.warn('[S2S] Error building enrollment sync request:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { syncInstructorToPortal, syncCohortToPortal, syncEnrollmentToPortal, getInstructorServiceUrl };
