const { Schema, model } = require('mongoose');
const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.ActivityLog || conn.model('ActivityLog', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entityType: String,
  entityId: Schema.Types.ObjectId,
  summary: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));
