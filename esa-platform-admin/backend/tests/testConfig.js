/**
 * Shared test configuration for Admin Backend integration tests.
 * Resolves the Admin API base URL to port 5200 by default (matching esa-platform-admin server),
 * while preserving support for an explicitly supplied API_BASE_URL environment variable.
 */

const DEFAULT_ADMIN_PORT = process.env.PORT || 5200;
const ADMIN_API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${DEFAULT_ADMIN_PORT}/api`;

module.exports = {
  ADMIN_API_BASE_URL,
};
