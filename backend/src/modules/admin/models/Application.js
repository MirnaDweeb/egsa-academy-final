const mongoose = require('mongoose');
const { DIVISIONS } = require('../constants/divisions');
const { APPLICATION_STATUS } = require('../constants/statuses');

const reviewNoteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    note: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    division: { type: String, enum: Object.values(DIVISIONS), required: true, index: true },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.DRAFT,
      index: true,
    },
    submittedAt: { type: Date },
    eligibilityStatus: { type: String, default: 'NOT_EVALUATED' },
    decision: {
      type: String,
      enum: ['ACCEPT', 'REJECT', 'WAITLIST', 'REQUEST_INFO', null],
      default: null,
    },
    decisionReason: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    adminDecision: {
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decidedAt: { type: Date },
      outcome: { type: String },
    },
    supportingDocument: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      path: { type: String },
      documentType: { type: String, default: 'Supporting_Document' },
      uploadedAt: { type: Date },
    },
    reviewNotes: [reviewNoteSchema],
  },
  { timestamps: true }
);

applicationSchema.index({ division: 1, status: 1, createdAt: -1 });
applicationSchema.index({ status: 1, division: 1 });
applicationSchema.index({ program: 1, status: 1 });

const { getAdminConn } = require('../../../config/database');
const conn = getAdminConn();
module.exports = conn.models.Application || conn.model('Application', applicationSchema);
