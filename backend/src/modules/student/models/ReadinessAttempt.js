const mongoose = require('mongoose');

const ReadinessAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReadinessQuestion' }],
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadinessQuestion' },
        selectedIndex: { type: Number },
        isCorrect: { type: Boolean },
      },
    ],
    status: { type: String, enum: ['InProgress', 'Submitted'], default: 'InProgress' },
    score: { type: Number },
    outcome: {
      type: String,
      enum: ['READY', 'ELIGIBLE', 'CONDITIONALLY_READY', 'FOUNDATION_REQUIRED', 'FOUNDATION_RECOMMENDED', 'MANUAL_REVIEW'],
    },
    knowledgeGaps: [{ type: String }],
    recommendedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

const { getStudentConn } = require('../../../config/database');
const conn = getStudentConn();
module.exports = conn.models.ReadinessAttempt || conn.model('ReadinessAttempt', ReadinessAttemptSchema);
