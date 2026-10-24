# EGSA Space Academy — Production Deployment & Hardening Guide

## 1. Architecture Overview
EGSA Academy is architected into three independent domain backends and a unified, role-based shared frontend, all communicating across the same origin via an Nginx reverse proxy.

```
                          Internet HTTPS (:443)
                                   │
                         ┌─────────▼─────────┐
                         │   Nginx Ingress   │
                         └─────────┬─────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
/api/* (Port 5000)         /api/v1/* (Port 5100)      /admin-api/* (Port 5200)
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│    Student Backend    │  │  Instructor Backend   │  │     Admin Backend     │
└──────────┬────────────┘  └──────────┬────────────┘  └──────────┬────────────┘
           │                          ▲                          │
           │                          │ S2S Provisioning (x-api-key)
           │                          └──────────────────────────┘
           │                          │                          │
           ▼                          ▼                          ▼
     egsa_academy              egsa_instructor              esa_academy
   (MongoDB :27017)           (MongoDB :27017)           (MongoDB :27017)
```

---

## 2. Service Startup Sequence
To ensure graceful startup and dependency availability, boot services in the following order:

1. **MongoDB Service** (`port 27017`)
   - Verify connectivity: `curl.exe http://127.0.0.1:27017` or PowerShell TCP test.
2. **Student Backend** (`port 5000`)
   - Directory: `EGSA-student/Back_End`
   - Command: `node src/server.js`
   - Readiness verify: `GET http://127.0.0.1:5000/api/health`
3. **Instructor Backend** (`port 5100`)
   - Directory: `egsa-instructor-v2/backend`
   - Command: `node src/server.js`
   - Readiness verify: `GET http://127.0.0.1:5100/api/v1/health`
4. **Admin Backend** (`port 5200`)
   - Directory: `esa-platform-admin/backend`
   - Command: `node src/server.js`
   - Readiness verify: `GET http://127.0.0.1:5200/api/health`
5. **Shared Frontend Build & Nginx**
   - Build assets: `npm run build` in `frontend/`
   - Verify Nginx configuration: `nginx -t -c /path/to/egsa_academy.conf`
   - Start Nginx: `systemctl restart nginx` (or Windows service equivalent).

---

## 3. Health & Readiness Monitoring
Automated health checks must query the dedicated health endpoints, which inspect database connection state (`mongoose.connection.readyState === 1`):

- **Student Service**: `http://localhost:5000/api/health`
  - Expected: `HTTP 200` with `{"success": true, "status": "UP", "database": {"connected": true, "name": "egsa_academy"}}`
- **Instructor Service**: `http://localhost:5100/api/v1/health`
  - Expected: `HTTP 200` with `{"success": true, "data": {"status": "ok", "database": {"connected": true, "name": "egsa_instructor"}}}`
- **Admin Service**: `http://localhost:5200/api/health`
  - Expected: `HTTP 200` with `{"success": true, "data": {"status": "ok", "database": {"connected": true, "name": "esa_academy"}}}`

---

## 4. Production Security Controls
- **JWT Strength Validation**: Every backend enforces >= 32 characters in production. If a default or weak secret is detected, the server fails fast with `[FATAL]` error.
- **S2S Integration Key**: Rotated to a 64-character cryptographically random secret. Configured in local environment files. Protected by `crypto.timingSafeEqual`.
- **Anti-Account-Enumeration**: Authentication endpoints return generic messages on wrong passwords or unknown usernames (`Invalid email or password`).
- **Error Detail Redaction**: In production (`NODE_ENV=production`), 500 error responses suppress internal stack traces and database details.
- **Rate Limiting**: Brute-force protection enabled on `/api/auth/login`, `/api/auth/register`, `/api/v1/auth/login`, `/admin-api/auth/login` (max 30 requests per 15 minutes).

---

## 5. Rollback Procedure
If a deployment defect is detected in staging or production:
1. Stop backend services: `kill` process or stop process manager (PM2 / systemd).
2. Revert Git release tag to previously verified release.
3. If database changes occurred, restore from the verified logical backup created prior to deployment using `mongorestore`.
4. Restart services according to section 2.
