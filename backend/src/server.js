const app = require('./app');
const env = require('./config/env');
const { initDatabases, closeDatabases } = require('./config/database');

async function start() {
  try {
    console.log('[Server] Initializing scoped database connection pools...');
    await initDatabases();
    console.log('[Server] All three database connection pools successfully initialized.');

    // Startup Initializers
    try {
      const { ensureDefaultReadinessQuestions } = require('./modules/student/services/defaultReadinessInitService');
      await ensureDefaultReadinessQuestions();
      console.log('[Server] Student default readiness questions verified.');
    } catch (initErr) {
      console.warn('[Server] Student readiness questions init warning:', initErr.message);
    }

    // Background invoice expiration sweep (every 10 minutes)
    let invoiceExpiryInterval = null;
    try {
      const { processExpiredInvoices } = require('./modules/student/services/paymentService');
      processExpiredInvoices().catch(err => console.error('[Server] Invoice sweep failed:', err.message));
      invoiceExpiryInterval = setInterval(() => {
        processExpiredInvoices().catch(err => console.error('[Server] Invoice sweep failed:', err.message));
      }, 10 * 60 * 1000);
      if (invoiceExpiryInterval.unref) invoiceExpiryInterval.unref();
      console.log('[Server] Payment reservation expiration task scheduled (10m).');
    } catch (schedErr) {
      console.warn('[Server] Invoice expiry scheduler warning:', schedErr.message);
    }

    const server = app.listen(env.port, () => {
      console.log(`=================================================================`);
      console.log(` EGSA ACADEMY UNIFIED BACKEND LISTENING ON PORT ${env.port}`);
      console.log(` Environment: ${env.nodeEnv}`);
      console.log(` Health Check: http://localhost:${env.port}/health`);
      console.log(` Student API:    http://localhost:${env.port}/api`);
      console.log(` Instructor API: http://localhost:${env.port}/api/v1`);
      console.log(` Admin API:      http://localhost:${env.port}/admin-api`);
      console.log(`=================================================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      if (invoiceExpiryInterval) clearInterval(invoiceExpiryInterval);
      server.close(async () => {
        console.log('[Server] HTTP listener closed.');
        try {
          await closeDatabases();
          console.log('[Server] Database connections closed.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10s timeout
      setTimeout(() => {
        console.error('[Server] Shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
