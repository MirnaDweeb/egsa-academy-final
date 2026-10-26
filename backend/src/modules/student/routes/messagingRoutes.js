const express = require('express');
const { protect } = require('../middleware/auth');
const messagingService = require('../../instructor/services/messaging.service');

const router = express.Router();
router.use(protect); // Every student messaging route requires verified student JWT

/**
 * GET /api/messages/conversations
 * List student conversations (support conversations with Admin and direct conversations with instructors)
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const { type, supportStatus } = req.query;
    const convs = await messagingService.studentListConversations(req.user._id, { type, supportStatus });
    res.json({ success: true, data: convs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/messages/contacts
 * Returns Admin Support desk and eligible assigned faculty instructors for student's enrolled courses/cohorts
 */
router.get('/contacts', async (req, res, next) => {
  try {
    const contacts = await messagingService.studentListAvailableContacts(req.user._id);
    res.json({ success: true, data: contacts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/conversations/instructor
 * Start or continue a direct conversation with an authorized assigned faculty instructor
 */
router.post('/conversations/instructor', async (req, res, next) => {
  try {
    const { instructorId, cohortId, subject, body } = req.body;
    const conv = await messagingService.studentGetOrCreateInstructorConversation(
      req.user._id,
      { instructorId, cohortId, subject }
    );

    let initialMsg = null;
    if (body && String(body).trim()) {
      initialMsg = await messagingService.studentSendMessage(
        req.user._id,
        conv._id,
        String(body).trim()
      );
    }

    res.status(201).json({ success: true, data: conv, initialMessage: initialMsg });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/conversations/admin-support
 * Initiate or get support conversation with EGSA Academy Administration
 */
router.post('/conversations/admin-support', async (req, res, next) => {
  try {
    const { subject, category, body, forceNew } = req.body;
    const conv = await messagingService.studentGetOrCreateAdminConversation(
      req.user._id,
      { subject, category, forceNew }
    );

    let initialMsg = null;
    if (body && String(body).trim()) {
      initialMsg = await messagingService.studentSendMessage(
        req.user._id,
        conv._id,
        String(body).trim()
      );
    }

    res.status(201).json({ success: true, data: conv, initialMessage: initialMsg });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/messages/conversations/:id
 * Get single conversation details
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conv = await messagingService.canUserAccessConversation(
      { id: req.user._id, role: 'student', name: req.user.fullName || req.user.name },
      req.params.id
    );
    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/messages/conversations/:id/messages
 * List messages in conversation
 */
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { limit, before } = req.query;
    const r = await messagingService.studentListMessages(req.user._id, req.params.id, { limit, before });
    res.json({ success: true, data: r.items, meta: { total: r.total } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/conversations/:id/messages
 * Send message in conversation (saves to DB and emits real-time event)
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { body, attachments } = req.body;
    const message = await messagingService.studentSendMessage(
      req.user._id,
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
 * PATCH /api/messages/conversations/:id/read
 * Mark messages in conversation as read
 */
router.patch('/conversations/:id/read', async (req, res, next) => {
  try {
    const r = await messagingService.studentMarkAsRead(req.user._id, req.params.id);
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/messages/conversations/:id/status
 * Update conversation support status (open, in_progress, resolved)
 */
router.patch('/conversations/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const conv = await messagingService.updateConversationStatus(
      { id: req.user._id, role: 'student', name: req.user.fullName || req.user.name },
      req.params.id,
      status
    );
    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/messages/unread-count
 * Get total unread messages count for student
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const r = await messagingService.studentGetUnreadCount(req.user._id);
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
