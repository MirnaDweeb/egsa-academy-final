const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { initDatabases, closeDatabases } = require('./config/database');
const { initSocketIO, getIO } = require('./socket');

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

    let invoiceExpiryInterval = null;

    // Create unified HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    const io = initSocketIO(httpServer);
    console.log('[Server] Real-time Socket.IO server initialized on path /socket.io.');

    const server = httpServer.listen(env.port, () => {
      console.log(`=================================================================`);
      console.log(` EGSA ACADEMY UNIFIED BACKEND LISTENING ON PORT ${env.port}`);
      console.log(` Environment: ${env.nodeEnv}`);
      console.log(` Health Check: http://localhost:${env.port}/health`);
      console.log(` Real-time WS: ws://localhost:${env.port}/socket.io`);
      console.log(` Student API:    http://localhost:${env.port}/api`);
      console.log(` Instructor API: http://localhost:${env.port}/api/v1`);
      console.log(` Admin API:      http://localhost:${env.port}/admin-api`);
      console.log(`=================================================================`);

      // Background invoice expiration sweep (every 10 minutes)
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
    });

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port conflict: Port ${env.port} is already in use by another process.`);
        console.error(`[DIAGNOSTIC] A previously running backend instance or another service is occupying port ${env.port}.`);
        console.error(`[INVESTIGATION] Run 'Get-NetTCPConnection -LocalPort ${env.port}' in PowerShell to identify the occupying process ID (PID).`);
        console.error(`[ACTION] Stop the existing process on port ${env.port} before starting a new instance.`);
      } else {
        console.error(`\n[FATAL] Server listener error (${err.code}):`, err.message);
      }
      try {
        if (invoiceExpiryInterval) clearInterval(invoiceExpiryInterval);
        await closeDatabases();
      } catch (_) {}
      process.exit(1);
    });

    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      if (invoiceExpiryInterval) clearInterval(invoiceExpiryInterval);
      if (io) {
        try { io.close(); } catch (_) {}
      }
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

    // Graceful process termination listeners
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
