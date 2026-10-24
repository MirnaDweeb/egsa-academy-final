const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    relatedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const { getStudentConn } = require('../../../config/database');
const conn = getStudentConn();
module.exports = conn.models.Notification || conn.model('Notification', NotificationSchema);
