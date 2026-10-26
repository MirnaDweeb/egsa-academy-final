const { Schema, model } = require('mongoose');

const s = new Schema({
  type: {
    type: String,
    enum: ['direct', 'student_admin', 'instructor_admin'],
    default: 'direct',
    index: true,
  },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', index: true },
  admin: { type: Schema.Types.ObjectId, index: true },
  adminName: { type: String, default: 'Academy Administration' },
  adminRole: { type: String, default: 'admin' },
  subject: { type: String, trim: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  lastMessage: {
    body: { type: String, trim: true },
    senderRole: { type: String, enum: ['instructor', 'student', 'admin', 'super_admin', 'pre_university_admin', 'university_admin'] },
    senderId: { type: Schema.Types.ObjectId },
    senderName: { type: String },
    createdAt: { type: Date },
  },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  unreadCountInstructor: { type: Number, default: 0 },
  unreadCountStudent: { type: Number, default: 0 },
  unreadCountAdmin: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  supportStatus: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
  category: { type: String, enum: ['general', 'technical', 'academic', 'complaint'], default: 'general', index: true },
}, { timestamps: true });

// Partial index for direct student-instructor cohort conversations
s.index(
  { instructor: 1, student: 1, cohort: 1 },
  {
    name: 'direct_student_instructor_cohort_unique',
    unique: true,
    partialFilterExpression: {
      type: 'direct',
    },
  }
);
s.index({ instructor: 1, lastMessageAt: -1 });
s.index({ student: 1, lastMessageAt: -1 });
s.index({ admin: 1, lastMessageAt: -1 });

const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.Conversation || conn.model('Conversation', s);
