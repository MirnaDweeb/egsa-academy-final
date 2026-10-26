const express = require('express');
const { protect } = require('../middleware/auth');
const messagingService = require('../../instructor/services/messaging.service');

const router = express.Router();
router.use(protect); // Every admin messaging route requires verified admin JWT

/**
 * GET /admin-api/messages/conversations
 * List student and instructor conversations for administrative monitoring and support
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const { type, search, supportStatus, limit, skip } = req.query;
    const r = await messagingService.adminListConversations({
      type,
      search,
      supportStatus,
      limit: parseInt(limit, 10) || 50,
      skip: parseInt(skip, 10) || 0,
    });
    res.json({ success: true, data: r.items, meta: r.meta });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin-api/messages/conversations/:id
 * Get single conversation details
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conv = await messagingService.adminGetConversation(req.params.id);
    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin-api/messages/conversations/:id/messages
 * List messages in conversation
 */
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { limit, before } = req.query;
    const r = await messagingService.adminListMessages(req.params.id, { limit, before });
    res.json({ success: true, data: r.items, meta: { total: r.total } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin-api/messages/conversations/:id/messages
 * Send message as Admin in conversation (persists to DB and emits real-time event)
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { body, attachments } = req.body;
    const message = await messagingService.adminSendMessage(
      req.user,
      req.params.id,
      body,
      attachments
    );
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin-api/messages/conversations/:id/read
 * Mark messages in conversation as read by admin
 */
router.patch('/conversations/:id/read', async (req, res, next) => {
  try {
    const r = await messagingService.adminMarkAsRead(req.user, req.params.id);
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin-api/messages/conversations/:id/status
 * Update conversation support status (open, in_progress, resolved) by administration
 */
router.patch('/conversations/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const conv = await messagingService.updateConversationStatus(
      { id: req.user._id || req.user.id, role: 'admin', isAdmin: true, name: req.user.name || req.user.fullName },
      req.params.id,
      status
    );
    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin-api/messages/unread-count
 * Get total unread messages count for administration
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const r = await messagingService.adminGetUnreadCount();
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
