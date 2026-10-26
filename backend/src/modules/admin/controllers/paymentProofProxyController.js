const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { studentApiRequest, createInternalAdminToken } = require('../services/studentIntegrationClient');

/**
 * GET /api/admin/payment-proofs
 * Lists payment proofs submitted by students.
 */
const listPaymentProofsAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'GET',
    path: '/api/admin/payment-proofs',
    query: req.query,
    token: createInternalAdminToken(req.user),
  });

  if (result.statusCode >= 400) {
    throw new ApiError(result.statusCode, result.data?.message || 'Failed to list payment proofs');
  }

  res.status(result.statusCode).json(result.data);
});

/**
 * GET /api/admin/payment-proofs/:id
 * Retrieves single payment proof audit detail.
 */
const getPaymentProofAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'GET',
    path: `/api/admin/payment-proofs/${req.params.id}`,
    token: createInternalAdminToken(req.user),
  });

  if (result.statusCode >= 400) {
    throw new ApiError(result.statusCode, result.data?.message || 'Payment proof not found');
  }

  res.status(result.statusCode).json(result.data);
});

/**
 * PATCH /api/admin/payment-proofs/:id/approve
 * Approves payment proof and confirms course enrollment.
 */
const approvePaymentProofAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'PATCH',
    path: `/api/admin/payment-proofs/${req.params.id}/approve`,
    body: req.body,
    token: createInternalAdminToken(req.user),
  });

  if (result.statusCode >= 400) {
    throw new ApiError(result.statusCode, result.data?.message || 'Failed to approve payment proof');
  }

  res.status(result.statusCode).json(result.data);
});

/**
 * PATCH /api/admin/payment-proofs/:id/reject
 * Declines payment proof with mandatory reason.
 */
const rejectPaymentProofAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'PATCH',
    path: `/api/admin/payment-proofs/${req.params.id}/reject`,
    body: req.body,
    token: createInternalAdminToken(req.user),
  });

  if (result.statusCode >= 400) {
    throw new ApiError(result.statusCode, result.data?.message || 'Failed to reject payment proof');
  }

  res.status(result.statusCode).json(result.data);
});

/**
 * GET /api/admin/payment-proofs/:id/file
 * Securely streams the payment proof screenshot.
 */
const getPaymentProofFileAdmin = asyncHandler(async (req, res) => {
  const upstreamRes = await studentApiRequest({
    method: 'GET',
    path: `/api/admin/payment-proofs/${req.params.id}/file`,
    token: createInternalAdminToken(req.user),
    responseType: 'stream',
  });

  if (upstreamRes.statusCode >= 400) {
    return res.status(upstreamRes.statusCode).json({ success: false, message: 'Evidence file not accessible.' });
  }

  res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'image/jpeg');
  if (upstreamRes.headers['content-disposition']) {
    res.setHeader('Content-Disposition', upstreamRes.headers['content-disposition']);
  }
  upstreamRes.pipe(res);
});

/**
 * GET /api/admin/payment-settings
 */
const getPaymentSettingsAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'GET',
    path: '/api/admin/payment-settings',
    token: createInternalAdminToken(req.user),
  });

  res.status(result.statusCode).json(result.data);
});

/**
 * PUT /api/admin/payment-settings
 */
const updatePaymentSettingsAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'PUT',
    path: '/api/admin/payment-settings',
    body: req.body,
    token: createInternalAdminToken(req.user),
  });

  res.status(result.statusCode).json(result.data);
});

/**
 * POST /api/admin/payment-proofs/:id/message
 * Sends a message/notification to the student regarding their payment proof.
 */
const sendMessagePaymentProofAdmin = asyncHandler(async (req, res) => {
  const result = await studentApiRequest({
    method: 'POST',
    path: `/api/admin/payment-proofs/${req.params.id}/message`,
    body: req.body,
    token: createInternalAdminToken(req.user),
  });

  if (result.statusCode >= 400) {
    throw new ApiError(result.statusCode, result.data?.message || 'Failed to send message to student');
  }

  res.status(result.statusCode).json(result.data);
});

/**
 * GET /api/admin/applications/:id/document
 * Securely streams the student's supporting document / screenshot.
 */
const getApplicationDocumentFileAdmin = asyncHandler(async (req, res) => {
  const upstreamRes = await studentApiRequest({
    method: 'GET',
    path: `/api/admin/applications/${req.params.id}/document`,
    token: createInternalAdminToken(req.user),
    responseType: 'stream',
  });

  if (upstreamRes.statusCode >= 400) {
    return res.status(upstreamRes.statusCode).json({ success: false, message: 'Supporting document not accessible.' });
  }

  res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'image/jpeg');
  if (upstreamRes.headers['content-disposition']) {
    res.setHeader('Content-Disposition', upstreamRes.headers['content-disposition']);
  }
  upstreamRes.pipe(res);
});

module.exports = {
  listPaymentProofsAdmin,
  getPaymentProofAdmin,
  approvePaymentProofAdmin,
  rejectPaymentProofAdmin,
  getPaymentProofFileAdmin,
  sendMessagePaymentProofAdmin,
  getPaymentSettingsAdmin,
  updatePaymentSettingsAdmin,
  getApplicationDocumentFileAdmin,
};
