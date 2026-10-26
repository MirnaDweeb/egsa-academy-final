const { Schema, model } = require('mongoose');

const s = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderRole: {
    type: String,
    enum: ['instructor', 'student', 'admin', 'super_admin', 'pre_university_admin', 'university_admin'],
    required: true,
  },
  senderId: { type: Schema.Types.ObjectId, required: true },
  senderName: { type: String, trim: true },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  attachments: [
    {
      name: { type: String, trim: true },
      url: { type: String, trim: true },
      fileType: { type: String },
      size: { type: Number },
    },
  ],
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
}, { timestamps: true });

s.index({ conversation: 1, createdAt: 1 });
s.index({ conversation: 1, read: 1 });

const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.Message || conn.model('Message', s);
