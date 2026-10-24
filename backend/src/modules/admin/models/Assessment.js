const mongoose = require('mongoose');

const assessmentHistorySchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gradedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
      default: 'Grade correction',
    },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gradedAt: {
      type: Date,
      default: Date.now,
    },
    history: {
      type: [assessmentHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// One assessment per student per assignment
assessmentSchema.index({ assignment: 1, student: 1 }, { unique: true });
assessmentSchema.index({ cohort: 1, student: 1 });
assessmentSchema.index({ student: 1, createdAt: -1 });

const { getAdminConn } = require('../../../config/database');
const conn = getAdminConn();
module.exports = conn.models.Assessment || conn.model('Assessment', assessmentSchema);
