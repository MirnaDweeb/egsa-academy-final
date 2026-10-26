const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getStudentConn, getInstructorConn, getAdminConn } = require('../config/database');

let ioInstance = null;

/**
 * Verify JWT token across student, instructor, and admin authentication schemes.
 * Extracts authenticated user context directly from database verification.
 */
async function verifySocketToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Authentication token is required');
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  if (!cleanToken) {
    throw new Error('Empty authentication token');
  }

  // 1. Try Instructor JWT Secret
  try {
    const payload = jwt.verify(cleanToken, env.jwt.instructorAccessSecret);
    const instructorId = payload.sub || payload.id;
    if (instructorId) {
      const instructorConn = getInstructorConn();
      const User = instructorConn.models.User || instructorConn.model('User');
      const user = await User.findById(instructorId).lean();
      if (user && (user.status === 'active' || user.isActive !== false)) {
        return {
          id: String(user._id),
          role: 'instructor',
          name: user.name || 'Instructor',
          email: user.email,
          db: 'instructor',
        };
      }
    }
  } catch (_) {
    // Continue to next secret
  }

  // 2. Try Student JWT Secret
  try {
    const payload = jwt.verify(cleanToken, env.jwt.studentSecret);
    const studentId = payload.id || payload.sub;
    if (studentId) {
      const studentConn = getStudentConn();
      const User = studentConn.models.User || studentConn.model('User');
      const user = await User.findById(studentId).lean();
      if (user && user.accountStatus !== 'suspended' && user.accountStatus !== 'disabled') {
        return {
          id: String(user._id),
          role: 'student',
          name: user.fullName || user.name || 'Cadet',
          email: user.email,
          db: 'student',
        };
      }
    }
  } catch (_) {
    // Continue to next secret
  }

  // 3. Try Admin JWT Secret
  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || env.jwt.adminSecret;
    const payload = jwt.verify(cleanToken, adminSecret);
    const adminId = payload.id || payload.sub;
    if (adminId) {
      const adminConn = getAdminConn();
      const User = adminConn.models.User || adminConn.model('User');
      const user = await User.findById(adminId).lean();
      if (user && user.isActive) {
        return {
          id: String(user._id),
          role: user.role || 'super_admin',
          isAdmin: true,
          name: user.name || user.fullName || 'EGSA Administrator',
          email: user.email,
          division: user.division || 'PRE_UNIVERSITY',
          db: 'admin',
        };
      }
    }
  } catch (_) {
    // Invalid across all three secrets
  }

  throw new Error('Invalid or expired authentication token');
}

/**
 * Initialize Socket.IO server attached to unified HTTP server.
 */
function initSocketIO(httpServer) {
  const allowedOrigins = [
    ...env.clientUrls,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        return callback(null, true); // Dev-friendly fallback
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!token) {
        return next(new Error('Authentication required: Token missing'));
      }

      const verifiedUser = await verifySocketToken(token);
      socket.user = verifiedUser;
      next();
    } catch (err) {
      console.warn(`[Socket.IO] Authentication rejected: ${err.message}`);
      next(new Error(`Unauthorized: ${err.message}`));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const { id, role, name, isAdmin } = socket.user;
    console.log(`[Socket.IO] Client connected: socket=${socket.id} user=${id} role=${role} name="${name}"`);

    // Join personal private user room (receives conversation updates & unread alerts)
    socket.join(`user:${role}:${id}`);
    socket.join(`user:${id}`);

    // If administrative role, join the admin support room
    if (isAdmin || ['super_admin', 'pre_university_admin', 'university_admin', 'admin'].includes(role)) {
      socket.join('role:admin');
    }

    // Acknowledge connection to client
    socket.emit('connected', {
      success: true,
      user: { id, role, name, isAdmin: !!isAdmin },
    });

    // -------------------------------------------------------------
    // EVENT: conversation:join
    // Authenticate authorization to join the requested conversation room
    // -------------------------------------------------------------
    socket.on('conversation:join', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) {
          return ack({ success: false, error: 'conversationId is required' });
        }

        const messagingService = require('../modules/instructor/services/messaging.service');
        const conv = await messagingService.canUserAccessConversation(socket.user, conversationId);

        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket.IO] User ${socket.user.id} (${socket.user.role}) joined conversation:${conversationId}`);
        return ack({ success: true, conversationId, conversation: conv });
      } catch (err) {
        console.warn(`[Socket.IO] Access denied for user ${socket.user.id} joining conversation:`, err.message);
        return ack({ success: false, error: err.message || 'Forbidden' });
      }
    });

    // -------------------------------------------------------------
    // EVENT: conversation:leave
    // -------------------------------------------------------------
    socket.on('conversation:leave', (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        console.log(`[Socket.IO] User ${socket.user.id} left conversation:${conversationId}`);
      }
      return ack({ success: true });
    });

    // -------------------------------------------------------------
    // EVENT: message:send
    // Persists message to database FIRST, then delivers to conversation room
    // -------------------------------------------------------------
    socket.on('message:send', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { conversationId, body, attachments } = payload || {};
        if (!conversationId) {
          return ack({ success: false, error: 'conversationId is required' });
        }

        const messagingService = require('../modules/instructor/services/messaging.service');
        const result = await messagingService.saveMessageAndDispatch({
          userContext: socket.user,
          conversationId,
          body,
          attachments,
        });

        // Broadcast to conversation room (so all participants currently inside receive it immediately)
        io.to(`conversation:${conversationId}`).emit('message:new', {
          conversationId,
          message: result.message,
        });

        // Send conversation update to recipient private room
        if (result.recipientRooms && result.recipientRooms.length) {
          result.recipientRooms.forEach((room) => {
            io.to(room).emit('conversation:update', {
              conversationId,
              lastMessage: result.message,
              unreadCountDelta: 1,
            });
          });
        }

        return ack({ success: true, data: result.message });
      } catch (err) {
        console.error(`[Socket.IO] Failed to send message for user ${socket.user.id}:`, err.message);
        return ack({ success: false, error: err.message || 'Failed to send message' });
      }
    });

    // -------------------------------------------------------------
    // EVENT: message:read
    // Marks messages as read in database and notifies participants
    // -------------------------------------------------------------
    socket.on('message:read', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) {
          return ack({ success: false, error: 'conversationId is required' });
        }

        const messagingService = require('../modules/instructor/services/messaging.service');
        await messagingService.markConversationRead(socket.user, conversationId);

        // Notify room that messages were marked read
        io.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          readerId: socket.user.id,
          readerRole: socket.user.role,
          readAt: new Date(),
        });

        return ack({ success: true, conversationId });
      } catch (err) {
        return ack({ success: false, error: err.message });
      }
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: socket=${socket.id} reason=${reason}`);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Get active Socket.IO server instance.
 */
function getIO() {
  return ioInstance;
}

/**
 * Emit event to conversation room and recipient user rooms.
 */
function emitNewMessage(conversationId, message, recipientRooms = []) {
  if (!ioInstance) return;

  ioInstance.to(`conversation:${conversationId}`).emit('message:new', {
    conversationId,
    message,
  });

  recipientRooms.forEach((room) => {
    ioInstance.to(room).emit('conversation:update', {
      conversationId,
      lastMessage: message,
      unreadCountDelta: 1,
    });
  });
}

/**
 * Emit read status to conversation room.
 */
function emitMessageRead(conversationId, readerId, readerRole) {
  if (!ioInstance) return;

  ioInstance.to(`conversation:${conversationId}`).emit('message:read', {
    conversationId,
    readerId,
    readerRole,
    readAt: new Date(),
  });
}

module.exports = {
  initSocketIO,
  getIO,
  verifySocketToken,
  emitNewMessage,
  emitMessageRead,
};
